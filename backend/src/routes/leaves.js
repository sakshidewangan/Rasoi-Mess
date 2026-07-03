import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// POST /api/leaves — add leave / batch meal override
router.post('/', authenticate, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    const { student_id, start_date, end_date, skip_breakfast, skip_lunch, skip_dinner, reason } = req.body;

    // Students can only create leave for themselves
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(student_id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await client.query('BEGIN');

    // Insert leave record
    const leaveResult = await client.query(`
      INSERT INTO leaves_and_pauses (student_id, start_date, end_date, skip_breakfast, skip_lunch, skip_dinner, reason, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [student_id, start_date, end_date, skip_breakfast, skip_lunch, skip_dinner, reason,
        req.user.role === 'STUDENT' ? 'STUDENT' : 'OWNER']);

    const leave = leaveResult.rows[0];

    // Apply overrides to daily_meal_calendar
    const mealsToSkip = [];
    if (skip_breakfast) mealsToSkip.push('BREAKFAST');
    if (skip_lunch)     mealsToSkip.push('LUNCH');
    if (skip_dinner)    mealsToSkip.push('DINNER');

    let skipped = 0;
    for (const mealType of mealsToSkip) {
      const result = await client.query(`
        UPDATE daily_meal_calendar
        SET status = 'SKIPPED', updated_at = NOW()
        WHERE student_id = $1
          AND meal_date BETWEEN $2 AND $3
          AND meal_type = $4
          AND is_locked = FALSE
          AND status = 'SCHEDULED'
        RETURNING *
      `, [student_id, start_date, end_date, mealType]);

      // Log each skipped meal
      for (const meal of result.rows) {
        await client.query(`
          INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, leave_id, reason, price_deducted)
          VALUES ($1,$2,$3,'SYSTEM_LEAVE',$4,$5,$6,$7)
        `, [student_id, meal.meal_date, mealType, req.user.id, leave.id, reason, meal.price]);
        skipped++;
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: `Leave applied. ${skipped} meals marked as skipped.`, leave });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/leaves/:studentId — get all leaves for a student
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const result = await query(`
      SELECT * FROM leaves_and_pauses WHERE student_id = $1 ORDER BY start_date DESC
    `, [studentId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/leaves/:id — cancel a leave and restore scheduled meals
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    await client.query('BEGIN');
    const leaveRes = await client.query('SELECT * FROM leaves_and_pauses WHERE id = $1', [req.params.id]);
    if (!leaveRes.rows[0]) return res.status(404).json({ message: 'Leave not found' });
    const leave = leaveRes.rows[0];

    // Restore skipped meals linked to this leave
    await client.query(`
      UPDATE daily_meal_calendar dmc
      SET status = 'SCHEDULED', updated_at = NOW()
      WHERE student_id = $1
        AND meal_date BETWEEN $2 AND $3
        AND is_locked = FALSE
        AND id IN (
          SELECT dmc2.id FROM daily_meal_calendar dmc2
          JOIN meal_skip_log msl ON msl.student_id = dmc2.student_id
            AND msl.meal_date = dmc2.meal_date AND msl.meal_type = dmc2.meal_type
          WHERE msl.leave_id = $4
        )
    `, [leave.student_id, leave.start_date, leave.end_date, leave.id]);

    // Remove skip log entries for this leave
    await client.query('DELETE FROM meal_skip_log WHERE leave_id = $1', [leave.id]);
    await client.query('DELETE FROM leaves_and_pauses WHERE id = $1', [leave.id]);

    await client.query('COMMIT');
    res.json({ message: 'Leave cancelled and meals restored' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
