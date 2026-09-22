import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/calendar/leaves/summary — get summary of all student leaves/skips (owner only)
router.get('/leaves/summary', authenticate, requireOwner, async (req, res) => {
  try {
    const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Today's leaves: Active students currently on leave today
    const todayLeaves = await query(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.mobile as student_mobile,
        s.room_number as student_room,
        lp.id as record_id,
        lp.start_date::TEXT as start_date,
        lp.end_date::TEXT as end_date,
        lp.skip_breakfast,
        lp.skip_lunch,
        lp.skip_dinner,
        lp.reason
      FROM leaves_and_pauses lp
      JOIN students s ON lp.student_id = s.id
      WHERE s.status = 'ACTIVE' AND $1 BETWEEN lp.start_date AND lp.end_date
    `, [todayStr]);

    // Today's student skips: Active students who voluntarily skipped today
    const todaySkips = await query(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.mobile as student_mobile,
        s.room_number as student_room,
        msl.id as record_id,
        msl.meal_type,
        msl.reason,
        msl.recorded_at::TEXT as recorded_at
      FROM meal_skip_log msl
      JOIN students s ON msl.student_id = s.id
      WHERE s.status = 'ACTIVE' AND msl.meal_date = $1 AND msl.initiated_by = 'STUDENT_SELF'
    `, [todayStr]);

    // Group Today's unavailable students by student_id
    const todayMap = {};

    todayLeaves.rows.forEach(r => {
      if (!todayMap[r.student_id]) {
        todayMap[r.student_id] = {
          student_id: r.student_id,
          student_name: r.student_name,
          student_room: r.student_room,
          student_mobile: r.student_mobile,
          breakfast: { unavailable: false, reason: '' },
          lunch: { unavailable: false, reason: '' },
          dinner: { unavailable: false, reason: '' }
        };
      }
      const sObj = todayMap[r.student_id];
      const leaveReason = r.reason || 'on leave';
      if (r.skip_breakfast) sObj.breakfast = { unavailable: true, reason: leaveReason };
      if (r.skip_lunch) sObj.lunch = { unavailable: true, reason: leaveReason };
      if (r.skip_dinner) sObj.dinner = { unavailable: true, reason: leaveReason };
    });

    todaySkips.rows.forEach(r => {
      if (!todayMap[r.student_id]) {
        todayMap[r.student_id] = {
          student_id: r.student_id,
          student_name: r.student_name,
          student_room: r.student_room,
          student_mobile: r.student_mobile,
          breakfast: { unavailable: false, reason: '' },
          lunch: { unavailable: false, reason: '' },
          dinner: { unavailable: false, reason: '' }
        };
      }
      const sObj = todayMap[r.student_id];
      const mealKey = r.meal_type.toLowerCase();
      // Only set to Skipped by User if not already marked unavailable by a leave
      if (sObj[mealKey] && !sObj[mealKey].unavailable) {
        sObj[mealKey] = { unavailable: true, reason: 'Skipped by User' };
      }
    });

    const todayList = Object.values(todayMap);
    todayList.sort((a, b) => a.student_name.localeCompare(b.student_name));

    // Past leaves: Completed historical leave records (including inactive students)
    const pastLeaves = await query(`
      SELECT 
        'LEAVE' as type,
        s.id as student_id,
        s.name as student_name,
        s.mobile as student_mobile,
        s.room_number as student_room,
        lp.id as record_id,
        lp.start_date::TEXT as start_date,
        lp.end_date::TEXT as end_date,
        lp.skip_breakfast,
        lp.skip_lunch,
        lp.skip_dinner,
        lp.reason
      FROM leaves_and_pauses lp
      JOIN students s ON lp.student_id = s.id
      WHERE lp.end_date < $1
    `, [todayStr]);

    // Past student skips: Group skips on the same date for the same student (including inactive students)
    const pastSkips = await query(`
      SELECT 
        msl.student_id,
        s.name as student_name,
        s.mobile as student_mobile,
        s.room_number as student_room,
        msl.meal_date::TEXT as meal_date,
        bool_or(msl.meal_type = 'BREAKFAST') as skip_breakfast,
        bool_or(msl.meal_type = 'LUNCH') as skip_lunch,
        bool_or(msl.meal_type = 'DINNER') as skip_dinner
      FROM meal_skip_log msl
      JOIN students s ON msl.student_id = s.id
      WHERE msl.meal_date < $1 AND msl.initiated_by = 'STUDENT_SELF'
      GROUP BY msl.student_id, s.name, s.mobile, s.room_number, msl.meal_date
    `, [todayStr]);

    const pastLeavesList = pastLeaves.rows.map(r => ({
      ...r,
      is_leave: true,
      start_date: new Date(r.start_date).toISOString().split('T')[0],
      end_date: new Date(r.end_date).toISOString().split('T')[0],
      reason: r.reason || 'on leave',
      skip_breakfast: !!r.skip_breakfast,
      skip_lunch: !!r.skip_lunch,
      skip_dinner: !!r.skip_dinner
    }));

    const pastSkipsList = pastSkips.rows.map(r => ({
      record_id: `skip-${r.student_id}-${r.meal_date}`,
      student_id: r.student_id,
      student_name: r.student_name,
      student_room: r.student_room,
      student_mobile: r.student_mobile,
      start_date: r.meal_date,
      end_date: r.meal_date,
      skip_breakfast: !!r.skip_breakfast,
      skip_lunch: !!r.skip_lunch,
      skip_dinner: !!r.skip_dinner,
      reason: 'Skipped by User',
      is_leave: false
    }));

    const filteredPastSkips = [];
    pastSkipsList.forEach(skip => {
      const skipDate = skip.start_date;
      const overlappingLeave = pastLeavesList.find(leave => {
        return leave.student_id === skip.student_id && skipDate >= leave.start_date && skipDate <= leave.end_date;
      });

      if (overlappingLeave) {
        if (skip.skip_breakfast) overlappingLeave.skip_breakfast = true;
        if (skip.skip_lunch) overlappingLeave.skip_lunch = true;
        if (skip.skip_dinner) overlappingLeave.skip_dinner = true;
      } else {
        filteredPastSkips.push(skip);
      }
    });

    const pastList = [...pastLeavesList, ...filteredPastSkips];
    pastList.sort((a, b) => b.start_date.localeCompare(a.start_date));

    res.json({
      today: todayList,
      past: pastList
    });
  } catch (err) {
    console.error('Error fetching leaves summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// POST /api/calendar/generate — auto-generate calendar for a student for a month (owner only)
router.post('/generate', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    const { student_id, month } = req.body; // month: YYYY-MM
    await client.query('BEGIN');

    // A student only receives calendar entries from the date their service
    // starts (joining date / effective meal plan date), never before it.
    const defaultMeal = await client.query(`
      SELECT s.joining_date, sdm.*
      FROM students s
      JOIN student_default_meals sdm ON sdm.student_id = s.id
      WHERE s.id = $1
      ORDER BY effective_from DESC LIMIT 1
    `, [student_id]);

    if (!defaultMeal.rows[0]) {
      return res.status(400).json({ message: 'No default meal schedule found for this student' });
    }

    const dm = defaultMeal.rows[0];
    const serviceStart = [dm.joining_date, dm.effective_from].filter(Boolean).sort().at(-1);

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
      if (serviceStart && date < serviceStart) continue;

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
      SELECT dmc.meal_type, COUNT(*) as total
      FROM daily_meal_calendar dmc
      JOIN students s ON dmc.student_id = s.id
      WHERE dmc.meal_date = $1 AND dmc.status IN ('SCHEDULED', 'SERVED') AND s.status = 'ACTIVE'
      GROUP BY dmc.meal_type
      ORDER BY dmc.meal_type
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

    const { meal_type, status, reason } = req.body;
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
        const logReason = reason || 'Skipped by student via dashboard';
        await query(`
          INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
          VALUES ($1, $2, $3, 'STUDENT_SELF', $4, $5, $6)
        `, [studentId, todayStr, meal_type, req.user.id, logReason, existing.rows[0].price]);
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
        const logReason = reason || 'Skipped by student via dashboard';
        await query(`
          INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
          VALUES ($1, $2, $3, 'STUDENT_SELF', $4, $5, $6)
        `, [studentId, todayStr, meal_type, req.user.id, logReason, price]);
      }
    }

    res.json({ message: 'Selection updated successfully' });
  } catch (err) {
    console.error('Error toggling today meal selection:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/delivery/list/:meal — get all subscribed active students for today's delivery checklist (owner only)
router.get('/delivery/list/:meal', authenticate, requireOwner, async (req, res) => {
  try {
    const { meal } = req.params;
    const zoneId = req.query.zone_id ? Number(req.query.zone_id) : null;
    const mealType = meal.toUpperCase();
    if (req.query.zone_id && (!Number.isInteger(zoneId) || zoneId < 1)) {
      return res.status(400).json({ message: 'Invalid delivery zone' });
    }
    const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Get default prices
    const settingsRes = await query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
    const prices = {};
    settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

    // 2. Fetch all active students with default meal configurations
    const zoneFilter = zoneId ? ' AND s.delivery_zone_id = $1' : '';
    const students = await query(`
      SELECT s.id as student_id, s.name,
             sdm.has_breakfast, sdm.has_lunch, sdm.has_dinner,
             sdm.custom_breakfast_price, sdm.custom_lunch_price, sdm.custom_dinner_price
      FROM students s
      JOIN student_default_meals sdm ON s.id = sdm.student_id
        AND sdm.effective_from = (
          SELECT MAX(effective_from) FROM student_default_meals WHERE student_id = s.id AND effective_from <= CURRENT_DATE
        )
      WHERE s.status = 'ACTIVE' AND s.joining_date <= CURRENT_DATE${zoneFilter}
    `, zoneId ? [zoneId] : []);

    // 3. Insert missing calendar entries for today
    for (const s of students.rows) {
      const hasMeal = (mealType === 'BREAKFAST' && s.has_breakfast) ||
                      (mealType === 'LUNCH' && s.has_lunch) ||
                      (mealType === 'DINNER' && s.has_dinner);
      if (hasMeal) {
        const key = `${mealType.toLowerCase()}_price`;
        const customKey = `custom_${mealType.toLowerCase()}_price`;
        const price = s[customKey] || prices[key] || 0;

        await query(`
          INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
          VALUES ($1, $2, $3, $4, 'SCHEDULED')
          ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
        `, [s.student_id, todayStr, mealType, price]);
      }
    }

    // 4. Return list of students
    const resultZoneFilter = zoneId ? ' AND s.delivery_zone_id = $3' : '';
    const result = await query(`
      SELECT s.id as student_id, s.name,
             dmc.id as calendar_id, dmc.status, dmc.price
      FROM students s
      JOIN student_default_meals sdm ON s.id = sdm.student_id
        AND sdm.effective_from = (
          SELECT MAX(effective_from) FROM student_default_meals WHERE student_id = s.id AND effective_from <= CURRENT_DATE
        )
      JOIN daily_meal_calendar dmc ON s.id = dmc.student_id AND dmc.meal_date = $1 AND dmc.meal_type = $2
      WHERE s.status = 'ACTIVE'${resultZoneFilter} AND 
        (
          ($2 = 'BREAKFAST' AND sdm.has_breakfast = true) OR
          ($2 = 'LUNCH' AND sdm.has_lunch = true) OR
          ($2 = 'DINNER' AND sdm.has_dinner = true)
        )
      ORDER BY s.name ASC
    `, zoneId ? [todayStr, mealType, zoneId] : [todayStr, mealType]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching delivery list:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/calendar/delivery/status — record/update delivery status for a student (owner only)
router.put('/delivery/status', authenticate, requireOwner, async (req, res) => {
  try {
    const { student_id, meal_type, status, date } = req.body;
    const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetDate = date || todayStr;
    const mealType = meal_type.toUpperCase();

    // Fetch correct price
    const defaultMeal = await query(`
      SELECT * FROM student_default_meals
      WHERE student_id = $1
      ORDER BY effective_from DESC LIMIT 1
    `, [student_id]);

    let price = 0;
    if (defaultMeal.rows[0]) {
      const dm = defaultMeal.rows[0];
      const key = `${mealType.toLowerCase()}_price`;
      const settingsRes = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
      const basePrice = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].value) : 0;
      const customKey = `custom_${mealType.toLowerCase()}_price`;
      price = dm[customKey] || basePrice;
    }

    const result = await query(`
      INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, meal_date, meal_type)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING *
    `, [student_id, targetDate, mealType, price, status]);

    // Synchronize to meal_skip_log: delete any old STUDENT_SELF/OWNER skip log entries first
    await query(`
      DELETE FROM meal_skip_log 
      WHERE student_id = $1 AND meal_date = $2 AND meal_type = $3 AND initiated_by IN ('STUDENT_SELF', 'OWNER')
    `, [student_id, targetDate, mealType]);

    if (status === 'CANCELLED') {
      await query(`
        INSERT INTO meal_skip_log (student_id, meal_date, meal_type, initiated_by, initiated_by_user_id, reason, price_deducted)
        VALUES ($1, $2, $3, 'OWNER', $4, 'Marked Not Delivered by Admin', $5)
      `, [student_id, targetDate, mealType, req.user.id, price]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating delivery status:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/daily-records — fetch counts and lists of Served vs. Not Delivered students for a specific date (owner only)
router.get('/daily-records', authenticate, requireOwner, async (req, res) => {
  try {
    const { date } = req.query;
    const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetDate = date || todayStr;

    // Auto-populate today's active students' cells if requesting today
    if (targetDate === todayStr) {
      const settingsRes = await query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
      const prices = {};
      settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

      const students = await query(`
        SELECT s.id as student_id,
               sdm.has_breakfast, sdm.has_lunch, sdm.has_dinner,
               sdm.custom_breakfast_price, sdm.custom_lunch_price, sdm.custom_dinner_price
        FROM students s
        JOIN student_default_meals sdm ON s.id = sdm.student_id
          AND sdm.effective_from = (
            SELECT MAX(effective_from) FROM student_default_meals WHERE student_id = s.id AND effective_from <= CURRENT_DATE
          )
        WHERE s.status = 'ACTIVE'
      `);

      for (const s of students.rows) {
        const meals = [
          { type: 'BREAKFAST', active: s.has_breakfast, price: s.custom_breakfast_price || prices.breakfast_price },
          { type: 'LUNCH',     active: s.has_lunch,     price: s.custom_lunch_price     || prices.lunch_price },
          { type: 'DINNER',    active: s.has_dinner,    price: s.custom_dinner_price    || prices.dinner_price },
        ];
        for (const meal of meals) {
          if (!meal.active) continue;
          await query(`
            INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
            VALUES ($1, $2, $3, $4, 'SCHEDULED')
            ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
          `, [s.student_id, todayStr, meal.type, meal.price]);
        }
      }
    }

    const result = await query(`
      SELECT dmc.student_id, s.name as student_name, dmc.meal_type, dmc.status
      FROM daily_meal_calendar dmc
      JOIN students s ON dmc.student_id = s.id
      WHERE dmc.meal_date = $1 AND dmc.status IN ('SERVED', 'CANCELLED', 'SKIPPED')
      ORDER BY s.name ASC
    `, [targetDate]);

    const summary = {
      BREAKFAST: { served: [], not_delivered: [] },
      LUNCH: { served: [], not_delivered: [] },
      DINNER: { served: [], not_delivered: [] }
    };

    result.rows.forEach(row => {
      const meal = row.meal_type.toUpperCase();
      const studentInfo = { id: row.student_id, name: row.student_name, status: row.status };
      
      if (row.status === 'SERVED') {
        summary[meal].served.push(studentInfo);
      } else if (row.status === 'CANCELLED' || row.status === 'SKIPPED') {
        summary[meal].not_delivered.push(studentInfo);
      }
    });

    res.json(summary);
  } catch (err) {
    console.error('Error fetching daily records summary:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/skips/:studentId — get skip history for a student
router.get('/skips/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const result = await query(`
      SELECT *, recorded_at::TEXT as recorded_at_str
      FROM meal_skip_log
      WHERE student_id = $1 AND initiated_by IN ('STUDENT_SELF', 'OWNER')
      ORDER BY meal_date DESC, recorded_at DESC
    `, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching student skip history:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/calendar/:studentId?month=2026-07 (Relocated to the bottom to avoid Express route parameter prefix interception)
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query; // YYYY-MM
    const today = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Students can only see their own calendar
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if student status is ACTIVE before running self-healing calendar auto-generation
    const studentCheck = await query('SELECT status, joining_date FROM students WHERE id = $1', [studentId]);
    const isActive = studentCheck.rows[0]?.status === 'ACTIVE';

    if (isActive) {
      const defaultMeal = await query(`
        SELECT * FROM student_default_meals
        WHERE student_id = $1
        ORDER BY effective_from DESC LIMIT 1
      `, [studentId]);

    if (defaultMeal.rows[0]) {
      const dm = defaultMeal.rows[0];
      const serviceStart = [studentCheck.rows[0].joining_date, dm.effective_from].filter(Boolean).sort().at(-1);

      const settingsRes = await query(`SELECT key, value FROM settings WHERE key IN ('breakfast_price','lunch_price','dinner_price')`);
      const prices = {};
      settingsRes.rows.forEach(r => { prices[r.key] = parseFloat(r.value); });

      const [year, mon] = month.split('-').map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();

      const values = [];
      const valueStrings = [];
      let paramIndex = 1;

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        if (serviceStart && date < serviceStart) continue;

        const meals = [
          { type: 'BREAKFAST', active: dm.has_breakfast, price: dm.custom_breakfast_price || prices.breakfast_price },
          { type: 'LUNCH',     active: dm.has_lunch,     price: dm.custom_lunch_price     || prices.lunch_price },
          { type: 'DINNER',    active: dm.has_dinner,    price: dm.custom_dinner_price    || prices.dinner_price },
        ];

        for (const meal of meals) {
          if (!meal.active) continue;
          valueStrings.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, 'SCHEDULED')`);
          values.push(studentId, date, meal.type, meal.price);
          paramIndex += 4;
        }
      }

      if (valueStrings.length > 0) {
        await query(`
          INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
          VALUES ${valueStrings.join(', ')}
          ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
        `, values);
      }
    }
    }

    // Query the final state of the calendar with date casted to text to avoid JSON timezone offsets
    const result = await query(`
      SELECT id, student_id, meal_date::TEXT as meal_date, meal_type, price, status, is_locked, tiffin_box_returned, note, updated_at
      FROM daily_meal_calendar
      WHERE student_id = $1 AND TO_CHAR(meal_date, 'YYYY-MM') = $2
      ORDER BY meal_date ASC, meal_type ASC
    `, [studentId, month]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
