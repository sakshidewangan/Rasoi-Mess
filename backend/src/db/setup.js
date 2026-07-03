import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './pool.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to PostgreSQL database...');
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Database schema created and seeded successfully!');
    console.log('');
    console.log('📋 Default admin credentials:');
    console.log('   Phone:    9999999999');
    console.log('   Password: admin123');
    console.log('   ⚠️  CHANGE THE PASSWORD AFTER FIRST LOGIN!');
  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
