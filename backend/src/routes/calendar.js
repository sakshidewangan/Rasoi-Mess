import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/calendar/:studentId?month=2026-07
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query; // YYYY-MM

    // Students can only see their own calendar
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await query(`
      SELECT * FROM daily_meal_calendar
      WHERE student_id = $1 AND TO_CHAR(meal_date, 'YYYY-MM') = $2
      ORDER BY meal_date ASC, meal_type ASC
    `, [studentId, month]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/calendar/generate — auto-generate calendar for a student for a month (owner only)
router.post('/generate', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    const { student_id, month } = req.body; // month: YYYY-MM
    await client.query('BEGIN');

    // Get student default meal schedule
    const defaultMeal = await client.query(`
      SELECT * FROM student_default_meals
      WHERE student_id = $1 AND effective_from <= $2
      ORDER BY effective_from DESC LIMIT 1
    `, [student_id, `${month}-01`]);

    if (!defaultMeal.rows[0]) {
      return res.status(400).json({ message: 'No default meal schedule found for this student' });
    }

    const dm = defaultMeal.rows[0];

    // Get current meal prices from settings
    const settingsRes = await client.query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
    const prices = {};
    settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

    // Get student's joining date
    const studentRes = await client.query('SELECT joining_date FROM students WHERE id = $1', [student_id]);
    const joiningDate = studentRes.rows[0]?.joining_date;

    // Generate all days in the month
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    let generated = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (joiningDate && date < joiningDate.toISOString().split('T')[0]) continue;

      const meals = [
        { type: 'BREAKFAST', active: dm.has_breakfast, price: dm.custom_breakfast_price || prices.breakfast_price },
        { type: 'LUNCH',     active: dm.has_lunch,     price: dm.custom_lunch_price     || prices.lunch_price },
        { type: 'DINNER',    active: dm.has_dinner,    price: dm.custom_dinner_price    || prices.dinner_price },
      ];

      for (const meal of meals) {
        if (!meal.active) continue;
        await client.query(`
          INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
          VALUES ($1, $2, $3, $4, 'SCHEDULED')
          ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
        `, [student_id, date, meal.type, meal.price]);
        generated++;
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Generated ${generated} meal records for ${month}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/calendar/:id/status — update a single meal status (override)
router.patch('/:id/status', authenticate, requireOwner, async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['SCHEDULED', 'SERVED', 'SKIPPED', 'CANCELLED', 'WASTED', 'ISSUE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if locked
    const existing = await query('SELECT * FROM daily_meal_calendar WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Record not found' });
    if (existing.rows[0].is_locked) return res.status(400).json({ message: 'This record is locked (month closed)' });

    const result = await query(`
      UPDATE daily_meal_calendar SET status=$1, note=$2, updated_at=NOW() WHERE id=$3 RETURNING *
    `, [status, note, req.params.id]);

    // If skipping, log to skip audit
    if (status === 'SKIPPED' || status === 'CANCELLED') {
      const meal = existing.rows[0];
      await query(`
        INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
        VALUES ($1, $2, $3, 'OWNER', $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [meal.student_id, meal.meal_date, meal.meal_type, req.user.id, note, meal.price]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/kitchen/today — daily kitchen summary
router.get('/kitchen/today', authenticate, requireOwner, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(`
      SELECT meal_type, COUNT(*) as total
      FROM daily_meal_calendar
      WHERE meal_date = $1 AND status IN ('SCHEDULED', 'SERVED')
      GROUP BY meal_type
      ORDER BY meal_type
    `, [today]);

    const summary = { BREAKFAST: 0, LUNCH: 0, DINNER: 0, date: today };
    result.rows.forEach(r => { summary[r.meal_type] = parseInt(r.total); });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
