import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/calendar/leaves/summary — get summary of all student leaves/skips (owner only)
router.get('/leaves/summary', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.mobile as student_mobile,
        s.room_number as student_room,
        dmc.id as meal_id,
        dmc.meal_date,
        dmc.meal_type,
        dmc.status,
        dmc.price
      FROM daily_meal_calendar dmc
      JOIN students s ON dmc.student_id = s.id
      WHERE dmc.status IN ('SKIPPED', 'CANCELLED')
      ORDER BY s.name ASC, dmc.meal_date DESC, dmc.meal_type ASC
    `);

    // Group by student
    const studentsMap = {};
    result.rows.forEach(r => {
      if (!studentsMap[r.student_id]) {
        studentsMap[r.student_id] = {
          student_id: r.student_id,
          name: r.student_name,
          mobile: r.student_mobile,
          room_number: r.student_room,
          skipped_count: 0,
          skips: []
        };
      }
      studentsMap[r.student_id].skipped_count++;
      studentsMap[r.student_id].skips.push({
        meal_id: r.meal_id,
        meal_date: r.meal_date,
        meal_type: r.meal_type,
        status: r.status,
        price: r.price
      });
    });

    res.json(Object.values(studentsMap));
  } catch (err) {
    console.error('Error fetching leaves summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/:studentId?month=2026-07
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query; // YYYY-MM
    const today = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Auto-mark past SCHEDULED meals as SERVED
    await query(`
      UPDATE daily_meal_calendar
      SET status = 'SERVED', updated_at = NOW()
      WHERE student_id = $1 AND meal_date < $2 AND status = 'SCHEDULED'
    `, [studentId, today]);

    // Students can only see their own calendar
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Self-healing calendar auto-generation:
    // Fetch latest default meal settings to fill in any missing day cells for the month
    const defaultMeal = await query(`
      SELECT * FROM student_default_meals
      WHERE student_id = $1
      ORDER BY effective_from DESC LIMIT 1
    `, [studentId]);

    if (defaultMeal.rows[0]) {
      const dm = defaultMeal.rows[0];

      const settingsRes = await query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
      const prices = {};
      settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

      const [year, mon] = month.split('-').map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;

        const meals = [
          { type: 'BREAKFAST', active: dm.has_breakfast, price: dm.custom_breakfast_price || prices.breakfast_price },
          { type: 'LUNCH',     active: dm.has_lunch,     price: dm.custom_lunch_price     || prices.lunch_price },
          { type: 'DINNER',    active: dm.has_dinner,    price: dm.custom_dinner_price    || prices.dinner_price },
        ];

        for (const meal of meals) {
          if (!meal.active) continue;
          await query(`
            INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
            VALUES ($1, $2, $3, $4, 'SCHEDULED')
            ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
          `, [studentId, date, meal.type, meal.price]);
        }
      }
    }

    // Query the final state of the calendar
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
      WHERE student_id = $1
      ORDER BY effective_from DESC LIMIT 1
    `, [student_id]);

    if (!defaultMeal.rows[0]) {
      return res.status(400).json({ message: 'No default meal schedule found for this student' });
    }

    const dm = defaultMeal.rows[0];

    // Get current meal prices from settings
    const settingsRes = await client.query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
    const prices = {};
    settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

    // Generate all days in the month
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    let generated = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;

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
    const today = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
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

// PUT /api/calendar/today-toggle — Student toggles today's meal choice before cutoff
router.put('/today-toggle', authenticate, async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(403).json({ message: 'Only registered users can toggle meals' });
    }

    const { meal_type, status } = req.body;
    if (!['BREAKFAST', 'LUNCH', 'DINNER'].includes(meal_type)) {
      return res.status(400).json({ message: 'Invalid meal type' });
    }
    if (!['SCHEDULED', 'SKIPPED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status choice' });
    }

    // Cutoff validation (Indian Standard Time / local time)
    const ist = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const hours = ist.getUTCHours();
    const minutes = ist.getUTCMinutes();
    const timeVal = hours * 100 + minutes;

    if (meal_type === 'BREAKFAST' && timeVal >= 800) {
      return res.status(400).json({ message: 'Breakfast cutoff time (8:00 AM) has passed' });
    }
    if (meal_type === 'LUNCH' && timeVal >= 1200) {
      return res.status(400).json({ message: 'Lunch cutoff time (12:00 PM) has passed' });
    }
    if (meal_type === 'DINNER' && timeVal >= 1800) {
      return res.status(400).json({ message: 'Dinner cutoff time (6:00 PM) has passed' });
    }

    const todayStr = ist.toISOString().split('T')[0];

    // Check if record exists
    const existing = await query(
      'SELECT id, is_locked, price FROM daily_meal_calendar WHERE student_id = $1 AND meal_date = $2 AND meal_type = $3',
      [studentId, todayStr, meal_type]
    );

    if (existing.rows[0]) {
      if (existing.rows[0].is_locked) {
        return res.status(400).json({ message: 'This record is locked' });
      }
      await query(
        'UPDATE daily_meal_calendar SET status = $1, is_locked = $2, updated_at = NOW() WHERE id = $3',
        [status, status === 'SKIPPED', existing.rows[0].id]
      );
      
      // Handle skip log synchronization
      if (status === 'SKIPPED') {
        await query(`
          INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
          VALUES ($1, $2, $3, 'STUDENT_SELF', $4, 'Skipped by student via dashboard', $5)
          ON CONFLICT DO NOTHING
        `, [studentId, todayStr, meal_type, req.user.id, existing.rows[0].price]);
      } else if (status === 'SCHEDULED') {
        await query(
          'DELETE FROM meal_skip_log WHERE student_id = $1 AND meal_date = $2 AND meal_type = $3',
          [studentId, todayStr, meal_type]
        );
      }
    } else {
      // Fetch default pricing
      const pricesRes = await query("SELECT key, value FROM settings WHERE key IN ('breakfast_price', 'lunch_price', 'dinner_price')");
      const prices = {};
      pricesRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });
      const price = prices[`${meal_type.toLowerCase()}_price`] || 0;

      await query(
        'INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status, is_locked) VALUES ($1, $2, $3, $4, $5, $6)',
        [studentId, todayStr, meal_type, price, status, status === 'SKIPPED']
      );

      if (status === 'SKIPPED') {
        await query(`
          INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
          VALUES ($1, $2, $3, 'STUDENT_SELF', $4, 'Skipped by student via dashboard', $5)
          ON CONFLICT DO NOTHING
        `, [studentId, todayStr, meal_type, req.user.id, price]);
      }
    }

    res.json({ message: 'Selection updated successfully' });
  } catch (err) {
    console.error('Error toggling today meal selection:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
