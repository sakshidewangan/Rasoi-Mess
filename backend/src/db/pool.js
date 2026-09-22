import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '..', 'rasoi_db.sqlite');
console.log(`💾 SQLite Database Path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err.message);
  } else {
    console.log('🔌 Connected to SQLite database.');
  }
});

// Enable WAL mode and foreign keys
db.serialize(() => {
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");
});

// ──────────────────────────────────────────────
// SQL Translation: PostgreSQL → SQLite
// ──────────────────────────────────────────────
function translateSQL(sql, params = []) {
  let q = sql;
  q = q.replace(/\bSERIAL PRIMARY KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
  q = q.replace(/::TEXT/gi, '');
  q = q.replace(/::DATE/gi, '');
  q = q.replace(/bool_or\((.*?)\)/gi, 'MAX($1)');
  q = q.replace(/TO_CHAR\((.*?),\s*['"]YYYY-MM['"]\)/gi, "strftime('%Y-%m', $1)");
  q = q.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  q = q.replace(/\bILIKE\b/gi, 'LIKE');
  // PostgreSQL permits reusing a placeholder (for example, $2) more than
  // once. SQLite's anonymous `?` placeholders need a value for every
  // occurrence, so duplicate the mapped parameter while translating.
  const translatedParams = [];
  q = q.replace(/\$(\d+)/g, (_, index) => {
    translatedParams.push(params[Number(index) - 1]);
    return '?';
  });
  return { sql: q, params: translatedParams.length ? translatedParams : params };
}

// Determine the type of SQL statement
function getQueryType(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT'))  return 'SELECT';
  if (trimmed.startsWith('INSERT'))  return 'INSERT';
  if (trimmed.startsWith('UPDATE'))  return 'UPDATE';
  if (trimmed.startsWith('DELETE'))  return 'DELETE';
  if (trimmed.startsWith('BEGIN') || trimmed.startsWith('START')) return 'BEGIN';
  if (trimmed.startsWith('COMMIT'))  return 'COMMIT';
  if (trimmed.startsWith('ROLLBACK')) return 'ROLLBACK';
  if (trimmed.startsWith('PRAGMA'))  return 'PRAGMA';
  return 'OTHER';
}

// ──────────────────────────────────────────────
// Core query function
// ──────────────────────────────────────────────
export const query = (text, params = [], dbInstance = db) => {
  return new Promise((resolve, reject) => {
    const { sql: translated, params: translatedParams } = translateSQL(text, params);
    const type = getQueryType(text);

    // Schema setup (multi-statement DDL — no params)
    const isSchema = params.length === 0 &&
      (translated.includes('CREATE TABLE') || translated.includes('PRAGMA'));

    if (isSchema) {
      dbInstance.exec(translated, (err) => {
        if (err) {
          console.error("❌ SQLite Exec Error:", err.message);
          return reject(err);
        }
        resolve({ rows: [], rowCount: 0 });
      });
      return;
    }

    // Transaction control statements
    if (type === 'BEGIN' || type === 'COMMIT' || type === 'ROLLBACK') {
      dbInstance.run(translated, [], function (err) {
        if (err) {
          // SQLite is already in correct state — ignore benign errors
          if (err.message.includes('cannot start a transaction') ||
              err.message.includes('no transaction is active')) {
            return resolve({ rows: [], rowCount: 0 });
          }
          return reject(err);
        }
        resolve({ rows: [], rowCount: 0 });
      });
      return;
    }

    // SELECT queries
    if (type === 'SELECT') {
      dbInstance.all(translated, translatedParams, (err, rows) => {
        if (err) {
          console.error("❌ SQLite Query Error:", err.message);
          console.error("Original SQL:", text);
          console.error("Translated SQL:", translated);
          console.error("Parameters:", params);
          return reject(err);
        }
        resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
      });
      return;
    }

    // SQLite supports RETURNING natively. Use it directly so a write and the
    // returned row are one atomic operation. The former last-insert-id lookup
    // could occasionally return no row under concurrent requests.
    const hasReturning = /\bRETURNING\b/i.test(translated);
    if (hasReturning) {
      dbInstance.all(translated, translatedParams, (err, rows) => {
        if (err) {
          console.error("❌ SQLite Query Error:", err.message);
          console.error("Original SQL:", text);
          console.error("Translated SQL:", translated);
          console.error("Parameters:", params);
          return reject(err);
        }
        resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
      });
      return;
    }

    // INSERT / UPDATE / DELETE without RETURNING
    const sqlWithoutReturning = translated.replace(/\s+RETURNING\s+\*\s*$/i, '').trim();

    dbInstance.run(sqlWithoutReturning, translatedParams, function (err) {
      if (err) {
        console.error("❌ SQLite Query Error:", err.message);
        console.error("Original SQL:", text);
        console.error("Translated SQL:", translated);
        console.error("Parameters:", params);
        return reject(err);
      }

      if (!hasReturning) {
        resolve({ rows: [], rowCount: this.changes });
        return;
      }

      // Fetch the affected row(s) after write
      let fetchSQL;
      if (type === 'INSERT') {
        const lastId = this.lastID;
        // Detect which table was inserted into
        const tableMatch = sqlWithoutReturning.match(/INSERT\s+INTO\s+(\w+)/i);
        if (tableMatch) {
          fetchSQL = `SELECT * FROM ${tableMatch[1]} WHERE id = ${lastId}`;
        }
      } else if (type === 'UPDATE') {
        // Extract WHERE clause from the update statement to refetch the row
        const tableMatch = sqlWithoutReturning.match(/UPDATE\s+(\w+)/i);
        const whereMatch = sqlWithoutReturning.match(/WHERE\s+(.+)$/i);
        if (tableMatch && whereMatch) {
          fetchSQL = `SELECT * FROM ${tableMatch[1]} WHERE ${whereMatch[1]}`;
        }
      } else if (type === 'DELETE') {
        resolve({ rows: [], rowCount: this.changes });
        return;
      }

      if (!fetchSQL) {
        resolve({ rows: [], rowCount: this.changes });
        return;
      }

      dbInstance.all(fetchSQL, translatedParams.slice(translatedParams.length - (fetchSQL.match(/\?/g) || []).length), (fetchErr, rows) => {
        if (fetchErr) {
          // Non-fatal: return empty rows but don't crash
          console.warn("⚠️ RETURNING fetch failed:", fetchErr.message);
          resolve({ rows: [], rowCount: this.changes });
          return;
        }
        resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
      });
    });
  });
};

// ──────────────────────────────────────────────
// Transaction-aware client
// ──────────────────────────────────────────────
const pool = {
  connect: async () => new Promise((resolve, reject) => {
    // Transactions must not share the module-level SQLite connection. Two
    // concurrent requests could otherwise join or roll back each other's work.
    const connection = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);

      connection.serialize(() => {
        connection.run('PRAGMA foreign_keys = ON;');
        connection.run('PRAGMA busy_timeout = 5000;');
      });

      let released = false;
      resolve({
        query: (text, params = []) => query(text, params, connection),
        release: () => {
          if (released) return;
          released = true;
          connection.close((closeErr) => {
            if (closeErr) console.error('❌ Failed to close SQLite transaction connection:', closeErr.message);
          });
        }
      });
    });
  }),
  query: async (text, params = []) => {
    return query(text, params, db);
  },
  on: () => {},
  end: async () => {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export default pool;
