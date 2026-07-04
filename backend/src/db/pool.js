import pg from 'pg';
import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

let useSqlite = false;
let sqliteDb = null;
let pgPool = null;
let sqliteWarned = false;

// Simple mutex lock to serialize SQLite query/transaction access across requests
let sqliteLock = Promise.resolve();

const acquireLock = async () => {
  const currentLock = sqliteLock;
  let release;
  sqliteLock = new Promise(resolve => {
    release = resolve;
  });
  await currentLock;
  return release;
};

// Initialize PostgreSQL pool
try {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  // We don't want the pool to crash the process on error
  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PG client', err);
  });
} catch (err) {
  console.warn('❌ Failed to initialize PG pool, falling back to SQLite:', err.message);
  useSqlite = true;
}

// Function to translate PostgreSQL query to SQLite query
function translateSql(sql) {
  if (!sql) return sql;
  let s = sql;
  
  // Replace SERIAL PRIMARY KEY with INTEGER PRIMARY KEY AUTOINCREMENT
  s = s.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  
  // Replace ILIKE with LIKE
  s = s.replace(/ILIKE/gi, 'LIKE');
  
  // Replace NOW() with datetime('now')
  s = s.replace(/NOW\(\)/gi, "datetime('now')");
  
  // Replace TO_CHAR(col, 'YYYY-MM') with strftime('%Y-%m', col)
  s = s.replace(/TO_CHAR\(([^,]+),\s*['"]YYYY-MM['"]\)/gi, "strftime('%Y-%m', $1)");
  
  // Translate parameters: $1, $2, ... -> ?1, ?2, ...
  s = s.replace(/\$(\d+)/g, '?$1');
  
  return s;
}

// Initialize SQLite database
function initSqlite() {
  if (sqliteDb) return;
  
  const dbPath = join(__dirname, '../../rasoi_db.sqlite');
  const isNew = !existsSync(dbPath);
  
  console.log(`🔌 Initializing SQLite database at ${dbPath}...`);
  sqliteDb = new DatabaseSync(dbPath);
  
  // Enable foreign keys
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  
  if (isNew) {
    console.log('📝 Creating database schema in SQLite...');
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      
      const translatedSchema = translateSql(schemaSql);
      
      sqliteDb.exec(translatedSchema);
      console.log('✅ SQLite schema created and seeded successfully!');
    } catch (err) {
      console.error('❌ Failed to initialize SQLite schema:', err.message);
    }
  }
}

// Execute query on SQLite connection (expects lock to be held already)
function runSqliteQueryInternal(text, params) {
  initSqlite();
  
  const translatedText = translateSql(text);
  const stmt = sqliteDb.prepare(translatedText);
  
  const sanitizedParams = params.map(val => {
    if (val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  });
  
  const rows = stmt.all(...sanitizedParams);
  
  // Convert boolean values from 0/1 to true/false
  const booleanColumns = [
    'has_breakfast', 'has_lunch', 'has_dinner',
    'skip_breakfast', 'skip_lunch', 'skip_dinner',
    'is_locked', 'tiffin_box_returned', 'create_login'
  ];
  
  // Convert date columns to Date objects to match node-pg behavior
  const dateColumns = [
    'joining_date', 'leaving_date', 'meal_date', 'payment_date',
    'expense_date', 'effective_from', 'created_at', 'updated_at'
  ];
  
  rows.forEach(row => {
    booleanColumns.forEach(col => {
      if (col in row) {
        row[col] = row[col] === 1 || row[col] === true;
      }
    });
    dateColumns.forEach(col => {
      if (col in row && row[col] !== null && row[col] !== undefined) {
        row[col] = new Date(row[col]);
      }
    });
  });
  
  return { rows };
}

// Check database connection and execute query
export const query = async (text, params = []) => {
  if (!useSqlite) {
    try {
      // Try querying PG
      const res = await pgPool.query(text, params);
      return res;
    } catch (err) {
      // If connection refused, switch to SQLite
      if (err.code === 'ECONNREFUSED' || err.message.includes('connect ECONNREFUSED') || err.message.includes('connection')) {
        if (!sqliteWarned) {
          console.warn('⚠️ PostgreSQL connection refused. Switching to local SQLite fallback...');
          sqliteWarned = true;
        }
        useSqlite = true;
        initSqlite();
      } else {
        throw err;
      }
    }
  }
  
  if (useSqlite) {
    const release = await acquireLock();
    try {
      return runSqliteQueryInternal(text, params);
    } finally {
      release();
    }
  }
};

const pool = {
  connect: async () => {
    if (!useSqlite) {
      try {
        const client = await pgPool.connect();
        return client;
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.message.includes('connect ECONNREFUSED') || err.message.includes('connection')) {
          if (!sqliteWarned) {
            console.warn('⚠️ PostgreSQL connection refused. Switching to local SQLite fallback...');
            sqliteWarned = true;
          }
          useSqlite = true;
          initSqlite();
        } else {
          throw err;
        }
      }
    }
    
    // SQLite Client mock with inherited database lock
    const releaseLock = await acquireLock();
    return {
      query: async (text, params = []) => {
        return runSqliteQueryInternal(text, params);
      },
      release: () => {
        releaseLock();
      }
    };
  },
  query: async (text, params = []) => {
    return query(text, params);
  },
  on: (event, handler) => {
    if (pgPool) {
      pgPool.on(event, handler);
    }
  },
  end: async () => {
    if (pgPool) {
      await pgPool.end();
    }
  }
};

export default pool;

