import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { syncToFirestore, backupDatabaseFile } from '../db/backup.js';

const router = express.Router();

// GET /api/settings — get all settings (owner only)
router.get('/', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query('SELECT * FROM settings ORDER BY key');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings — update settings (owner only)
router.put('/', authenticate, requireOwner, async (req, res) => {
  try {
    const updates = req.body; // { breakfast_price: '45', rasoi_name: 'My Mess', ... }
    for (const key of ['breakfast_price', 'lunch_price', 'dinner_price']) {
      if (key in updates && (!Number.isFinite(Number(updates[key])) || Number(updates[key]) < 0)) {
        return res.status(400).json({ message: `Invalid ${key.replace('_', ' ')}` });
      }
    }
    for (const [key, value] of Object.entries(updates)) {
      await query(`
        INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
      `, [key, String(value)]);
    }

    // Prices are snapshotted on calendar records for billing. When an admin
    // changes a global meal price, refresh every open scheduled record that
    // uses that global price. Custom student prices, served meals, and locked
    // months retain their original values.
    const priceUpdates = [
      { setting: 'breakfast_price', mealType: 'BREAKFAST', customColumn: 'custom_breakfast_price' },
      { setting: 'lunch_price', mealType: 'LUNCH', customColumn: 'custom_lunch_price' },
      { setting: 'dinner_price', mealType: 'DINNER', customColumn: 'custom_dinner_price' },
    ];

    for (const priceUpdate of priceUpdates) {
      if (!(priceUpdate.setting in updates)) continue;
      const price = Number(updates[priceUpdate.setting]);
      await query(`
        UPDATE daily_meal_calendar
        SET price = $1, updated_at = NOW()
        WHERE meal_type = $2 AND status = 'SCHEDULED' AND is_locked = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM student_default_meals sdm
            WHERE sdm.student_id = daily_meal_calendar.student_id
              AND sdm.effective_from = (
                SELECT MAX(effective_from) FROM student_default_meals
                WHERE student_id = daily_meal_calendar.student_id
                  AND effective_from <= daily_meal_calendar.meal_date
              )
              AND sdm.${priceUpdate.customColumn} IS NOT NULL
          )
      `, [price, priceUpdate.mealType]);
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/settings/backup — trigger Firebase manual backup (owner only)
router.post('/backup', authenticate, requireOwner, async (req, res) => {
  try {
    const firestoreSynced = await syncToFirestore();
    const fileBackupSuccess = await backupDatabaseFile();
    
    if (!firestoreSynced && !fileBackupSuccess) {
      return res.status(400).json({ 
        message: 'Firebase is not configured. Please add firebase-key.json or config environment variables.' 
      });
    }

    res.json({ 
      message: 'Cloud backup triggered successfully!',
      firestoreSynced,
      fileBackupSuccess
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ message: 'Backup execution failed.' });
  }
});

// GET /api/settings/dashboard — full dashboard stats
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // A student becomes part of dispatch only after being assigned to a
    // delivery zone. This keeps newly added, unassigned students off the
    // meal cards until the admin has placed them on a route.
    const settingsRes = await query(`SELECT key, value FROM settings
      WHERE key IN ('breakfast_price', 'lunch_price', 'dinner_price')`);
    const prices = Object.fromEntries(settingsRes.rows.map(row => [row.key, Number(row.value)]));
    const todayMeals = [
      { type: 'BREAKFAST', enabled: 'has_breakfast', customPrice: 'custom_breakfast_price', price: prices.breakfast_price || 0 },
      { type: 'LUNCH', enabled: 'has_lunch', customPrice: 'custom_lunch_price', price: prices.lunch_price || 0 },
      { type: 'DINNER', enabled: 'has_dinner', customPrice: 'custom_dinner_price', price: prices.dinner_price || 0 },
    ];

    for (const meal of todayMeals) {
      await query(`
        INSERT INTO daily_meal_calendar (student_id, meal_date, meal_type, price, status)
        SELECT s.id, $1, $2, COALESCE(sdm.${meal.customPrice}, $3), 'SCHEDULED'
        FROM students s
        JOIN student_default_meals sdm ON sdm.student_id = s.id
          AND sdm.effective_from = (
            SELECT MAX(effective_from) FROM student_default_meals
            WHERE student_id = s.id AND effective_from <= $1
          )
        WHERE s.status = 'ACTIVE' AND s.joining_date <= $1
          AND s.delivery_zone_id IS NOT NULL AND sdm.${meal.enabled} = true
        ON CONFLICT (student_id, meal_date, meal_type) DO NOTHING
      `, [today, meal.type, meal.price]);
    }

    const thisMonth = today.substring(0, 7);

    const [kitchen, onLeave, activeStudents, pendingDues, todayExpenses, recentPayments] = await Promise.all([
      query(`SELECT dmc.meal_type, COUNT(*) as total FROM daily_meal_calendar dmc
             JOIN students s ON dmc.student_id = s.id
             WHERE dmc.meal_date=$1 AND dmc.status IN ('SCHEDULED','SERVED')
               AND s.status='ACTIVE' AND s.delivery_zone_id IS NOT NULL
             GROUP BY dmc.meal_type`, [today]),
      query(`SELECT COUNT(DISTINCT s.id) as count
             FROM students s
             LEFT JOIN leaves_and_pauses lp ON s.id = lp.student_id AND $1 BETWEEN lp.start_date AND lp.end_date
             LEFT JOIN meal_skip_log msl ON s.id = msl.student_id AND msl.meal_date = $1 AND msl.initiated_by = 'STUDENT_SELF'
             WHERE s.status='ACTIVE' AND (lp.id IS NOT NULL OR msl.id IS NOT NULL)`, [today]),
      query(`SELECT COUNT(*) as count FROM students WHERE status='ACTIVE'`),
      query(`SELECT COUNT(*) as count, COALESCE(SUM(current_balance),0) as total
             FROM students WHERE current_balance > 0 AND status='ACTIVE'`),
      query(`SELECT COALESCE(SUM(amount),0) as total FROM expenses
             WHERE expense_date=$1`, [today]),
      query(`SELECT p.*, s.name as student_name FROM payments p
             JOIN students s ON p.student_id=s.id
             ORDER BY p.created_at DESC LIMIT 5`),
    ]);

    const kitchenSummary = { BREAKFAST: 0, LUNCH: 0, DINNER: 0 };
    kitchen.rows.forEach(r => { kitchenSummary[r.meal_type] = parseInt(r.total); });

    let studentSkips = 0;
    let studentBalance = 0;
    let studentPayments = [];
    let studentTodayMeals = [];

    if (req.user.role === 'STUDENT' && req.user.studentId) {
      const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [skipsRes, balanceRes, paymentsRes, todayMealsRes] = await Promise.all([
        query(`SELECT COUNT(*) as count FROM daily_meal_calendar WHERE student_id=$1 AND status IN ('SKIPPED', 'CANCELLED')`, [req.user.studentId]),
        query(`SELECT current_balance FROM students WHERE id=$1`, [req.user.studentId]),
        query(`SELECT p.*, s.name as student_name FROM payments p
               JOIN students s ON p.student_id=s.id
               WHERE p.student_id=$1
               ORDER BY p.created_at DESC LIMIT 5`, [req.user.studentId]),
        query(`SELECT id, meal_type, status, is_locked FROM daily_meal_calendar WHERE student_id=$1 AND meal_date=$2`, [req.user.studentId, todayStr])
      ]);
      studentSkips = parseInt(skipsRes.rows[0]?.count || 0);
      studentBalance = parseFloat(balanceRes.rows[0]?.current_balance || 0);
      studentPayments = paymentsRes.rows;
      studentTodayMeals = todayMealsRes.rows;
    }

    res.json({
      kitchenSummary,
      studentsOnLeave: req.user.role === 'OWNER' ? parseInt(onLeave.rows[0]?.count || 0) : studentSkips,
      activeStudents: parseInt(activeStudents.rows[0]?.count || 0),
      pendingDues: {
        count: req.user.role === 'OWNER' ? parseInt(pendingDues.rows[0]?.count || 0) : 1,
        total: req.user.role === 'OWNER' ? parseFloat(pendingDues.rows[0]?.total || 0) : studentBalance,
      },
      todayExpenses: parseFloat(todayExpenses.rows[0]?.total || 0),
      recentPayments: req.user.role === 'OWNER' ? recentPayments.rows : studentPayments,
      studentTodayMeals,
      date: today,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
