import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths for Firebase credentials
const localKeyPath = join(__dirname, '..', '..', 'firebase-key.json');
const dbPath = join(__dirname, '..', '..', 'rasoi_db.sqlite');

let firebaseApp = null;
let firestore = null;
let storage = null;

// Initialize Firebase Admin SDK if credentials are available
export const initFirebase = () => {
  if (firebaseApp) return true;

  try {
    let serviceAccount = null;

    if (existsSync(localKeyPath)) {
      console.log(`🔥 Firebase: Found credential file at ${localKeyPath}`);
      serviceAccount = JSON.parse(readFileSync(localKeyPath, 'utf8'));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      console.log('🔥 Firebase: Found credential environment variables.');
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }

    if (!serviceAccount) {
      return false;
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.projectId}.appspot.com`;

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });

    firestore = admin.firestore(firebaseApp);
    storage = admin.storage(firebaseApp);

    console.log('✅ Firebase Admin SDK initialized successfully!');
    return true;
  } catch (err) {
    console.warn('⚠️ Failed to initialize Firebase:', err.message);
    return false;
  }
};

// Sync SQLite tables to Firebase Firestore collections
export const syncToFirestore = async () => {
  if (!initFirebase()) {
    console.log('ℹ️ Firebase not configured. Skipping Firestore sync.');
    return false;
  }

  console.log('🔄 Starting Firestore database sync...');
  try {
    // 1. Sync Settings
    const settings = await query("SELECT * FROM settings");
    for (const row of settings.rows) {
      await firestore.collection('settings').doc(row.key).set({
        value: row.value,
        updated_at: row.updated_at || new Date().toISOString()
      });
    }
    console.log(`✅ Synced ${settings.rows.length} settings to Firestore.`);

    // 2. Sync Students
    const students = await query("SELECT * FROM students");
    for (const row of students.rows) {
      await firestore.collection('students').doc(row.id.toString()).set(row);
    }
    console.log(`✅ Synced ${students.rows.length} students to Firestore.`);

    // 3. Sync Payments
    const payments = await query("SELECT * FROM payments");
    for (const row of payments.rows) {
      await firestore.collection('payments').doc(row.id.toString()).set(row);
    }
    console.log(`✅ Synced ${payments.rows.length} payments to Firestore.`);

    // 4. Sync Expenses
    const expenses = await query("SELECT * FROM expenses");
    for (const row of expenses.rows) {
      await firestore.collection('expenses').doc(row.id.toString()).set(row);
    }
    console.log(`✅ Synced ${expenses.rows.length} expenses to Firestore.`);

    console.log('🎉 Firestore database sync completed successfully!');
    return true;
  } catch (err) {
    console.error('❌ Firestore sync failed:', err.message);
    return false;
  }
};

// Upload SQLite database file to Firebase Cloud Storage
export const backupDatabaseFile = async () => {
  if (!initFirebase()) {
    console.log('ℹ️ Firebase not configured. Skipping Storage file backup.');
    return false;
  }

  if (!existsSync(dbPath)) {
    console.error('❌ SQLite database file not found for backup:', dbPath);
    return false;
  }

  console.log('📦 Starting database file backup to Firebase Storage...');
  try {
    const bucket = storage.bucket();
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const destinationPath = `backups/rasoi_db_${dateStr}.sqlite`;

    // Upload with timestamped name
    await bucket.upload(dbPath, {
      destination: destinationPath,
      metadata: {
        contentType: 'application/x-sqlite3',
      }
    });
    console.log(`✅ Uploaded backup to Firebase Storage: ${destinationPath}`);

    // Update the latest copy
    await bucket.upload(dbPath, {
      destination: 'backups/rasoi_db_latest.sqlite',
      metadata: {
        contentType: 'application/x-sqlite3',
      }
    });
    console.log(`✅ Updated latest backup: backups/rasoi_db_latest.sqlite`);

    return true;
  } catch (err) {
    console.error('❌ Storage database backup failed:', err.message);
    return false;
  }
};
