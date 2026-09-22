import pg from 'pg';
const { Client } = pg;

async function run() {
  const connectionString = 'postgresql://postgres:8L52CU%25Kdkm5jn7@db.xxyfdlnecjkmrphkybkj.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    const res = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM daily_meal_calendar 
      WHERE student_id = 2 AND TO_CHAR(meal_date, 'YYYY-MM') = '2026-07'
      GROUP BY status
    `);

    console.log('--- Status counts for July 2026 for student 2 ---');
    console.log(res.rows);

    await client.end();
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

run();
