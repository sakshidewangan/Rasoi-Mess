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

    // Apply overrides or insert skipped meals in daily_meal_calendar
    const parseLocalDate = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    
    const formatLocalDate = (dateObj) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const start = parseLocalDate(start_date);
    const end = parseLocalDate(end_date);

    // Fetch default prices
    const settingsRes = await client.query("SELECT key, value FROM settings WHERE key IN ('breakfast_price', 'lunch_price', 'dinner_price')");
    const prices = {};
    settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

    let skipped = 0;
    let curr = new Date(start);
    while (curr <= end) {
      const dateStr = formatLocalDate(curr);

      const meals = [
        { type: 'BREAKFAST', active: skip_breakfast, price: prices.breakfast_price || 0 },
        { type: 'LUNCH',     active: skip_lunch,     price: prices.lunch_price || 0 },
        { type: 'DINNER',    active: skip_dinner,    price: prices.dinner_price || 0 }
      ];

      for (const meal of meals) {
        if (!meal.active) continue;

        // Check if record exists
        const existing = await client.query(
          'SELECT id, status, is_locked FROM daily_meal_calendar WHERE student_id = $1 AND meal_date = $2 AND meal_type = $3',
          [student_id, dateStr, meal.type]
        );

        if (existing.rows[0]) {
          const record = existing.rows[0];
          if (!record.is_locked && record.status === 'SCHEDULED') {
            await client.query(
              "UPDATE daily_meal_calendar SET status = 'SKIPPED', updated_at = NOW() WHERE id = $1",
              [record.id]
            );
            await client.query(`
              INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, leave_id, reason, price_deducted)
              VALUES ($1,$2,$3,'SYSTEM_LEAVE',$4,$5,$6,$7)
            `, [student_id, dateStr, meal.type, req.user.id, leave.id, reason, meal.price]);
            skipped++;
          }
        } else {
          // Record doesn't exist yet, insert it as SKIPPED
          await client.query(`
            INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
            VALUES ($1, $2, $3, $4, 'SKIPPED')
          `, [student_id, dateStr, meal.type, meal.price]);

          await client.query(`
            INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, leave_id, reason, price_deducted)
            VALUES ($1,$2,$3,'SYSTEM_LEAVE',$4,$5,$6,$7)
          `, [student_id, dateStr, meal.type, req.user.id, leave.id, reason, meal.price]);
          skipped++;
        }
      }

      // Advance by 1 day
      curr.setDate(curr.getDate() + 1);
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

// GET /api/leaves/:studentId — get all leaves/skips for a student (merged Leave History)
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const leavesRes = await query(`
      SELECT 
        id, student_id, 
        start_date::TEXT as start_date, 
        end_date::TEXT as end_date, 
        skip_breakfast, skip_lunch, skip_dinner, 
        reason, created_by, created_at
      FROM leaves_and_pauses 
      WHERE student_id = $1 
      ORDER BY created_at ASC
    `, [studentId]);

    const skipsRes = await query(`
      SELECT 
        meal_date::TEXT as meal_date,
        bool_or(meal_type = 'BREAKFAST') as skip_breakfast,
        bool_or(meal_type = 'LUNCH') as skip_lunch,
        bool_or(meal_type = 'DINNER') as skip_dinner
      FROM meal_skip_log
      WHERE student_id = $1 AND initiated_by = 'STUDENT_SELF'
      GROUP BY meal_date
      ORDER BY meal_date ASC
    `, [studentId]);

    const dayMap = {}; // key: YYYY-MM-DD, value: { date, skip_breakfast, skip_lunch, skip_dinner, reason, is_leave, created_at, id }

    const addDays = (dateStr, days) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + days);
      const ry = date.getFullYear();
      const rm = String(date.getMonth() + 1).padStart(2, '0');
      const rd = String(date.getDate()).padStart(2, '0');
      return `${ry}-${rm}-${rd}`;
    };

    const getDatesInRange = (startDate, endDate) => {
      const dates = [];
      let curr = startDate;
      while (curr <= endDate) {
        dates.push(curr);
        curr = addDays(curr, 1);
      }
      return dates;
    };

    // Process actual leaves (sorted ASC, so newer leaves process last and override reason)
    leavesRes.rows.forEach(r => {
      const dates = getDatesInRange(r.start_date, r.end_date);
      dates.forEach(date => {
        const leaveReason = r.reason || 'on leave';
        if (!dayMap[date]) {
          dayMap[date] = {
            date,
            skip_breakfast: !!r.skip_breakfast,
            skip_lunch: !!r.skip_lunch,
            skip_dinner: !!r.skip_dinner,
            reason: leaveReason,
            is_leave: true,
            created_at: r.created_at,
            id: r.id
          };
        } else {
          const existing = dayMap[date];
          existing.skip_breakfast = existing.skip_breakfast || !!r.skip_breakfast;
          existing.skip_lunch = existing.skip_lunch || !!r.skip_lunch;
          existing.skip_dinner = existing.skip_dinner || !!r.skip_dinner;
          existing.reason = leaveReason; // later leave overrides earlier
          existing.is_leave = true;
          existing.created_at = r.created_at;
          existing.id = r.id;
        }
      });
    });

    // Process student skips
    skipsRes.rows.forEach(r => {
      const date = r.meal_date;
      if (!dayMap[date]) {
        dayMap[date] = {
          date,
          skip_breakfast: !!r.skip_breakfast,
          skip_lunch: !!r.skip_lunch,
          skip_dinner: !!r.skip_dinner,
          reason: 'Skipped by User',
          is_leave: false,
          created_at: null,
          id: null
        };
      } else {
        const existing = dayMap[date];
        existing.skip_breakfast = existing.skip_breakfast || !!r.skip_breakfast;
        existing.skip_lunch = existing.skip_lunch || !!r.skip_lunch;
        existing.skip_dinner = existing.skip_dinner || !!r.skip_dinner;
        // Skip does not override active leave reason
        if (!existing.is_leave) {
          existing.reason = 'Skipped by User';
        }
      }
    });

    // Reconstruct consecutive day blocks back into ranges
    const sortedDates = Object.keys(dayMap).sort();
    const ranges = [];
    let currentRange = null;

    sortedDates.forEach(date => {
      const dayData = dayMap[date];

      if (!currentRange) {
        currentRange = {
          id: dayData.id || `merged-${date}`,
          student_id: parseInt(studentId),
          start_date: date,
          end_date: date,
          skip_breakfast: dayData.skip_breakfast,
          skip_lunch: dayData.skip_lunch,
          skip_dinner: dayData.skip_dinner,
          reason: dayData.reason
        };
      } else {
        const expectedNextDate = addDays(currentRange.end_date, 1);
        if (
          date === expectedNextDate &&
          currentRange.skip_breakfast === dayData.skip_breakfast &&
          currentRange.skip_lunch === dayData.skip_lunch &&
          currentRange.skip_dinner === dayData.skip_dinner &&
          currentRange.reason === dayData.reason
        ) {
          currentRange.end_date = date;
        } else {
          ranges.push(currentRange);
          currentRange = {
            id: dayData.id || `merged-${date}`,
            student_id: parseInt(studentId),
            start_date: date,
            end_date: date,
            skip_breakfast: dayData.skip_breakfast,
            skip_lunch: dayData.skip_lunch,
            skip_dinner: dayData.skip_dinner,
            reason: dayData.reason
          };
        }
      }
    });

    if (currentRange) {
      ranges.push(currentRange);
    }

    // Sort final history list reverse chronologically (newest first)
    ranges.sort((a, b) => b.start_date.localeCompare(a.start_date));

    res.json(ranges);
  } catch (err) {
    console.error('Error fetching leaves summary for student:', err);
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
