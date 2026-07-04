import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

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
    for (const [key, value] of Object.entries(updates)) {
      await query(`
        INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
      `, [key, String(value)]);
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/settings/dashboard — full dashboard stats
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Auto-mark past SCHEDULED meals as SERVED
    await query(`
      UPDATE daily_meal_calendar
      SET status = 'SERVED', updated_at = NOW()
      WHERE meal_date < $1 AND status = 'SCHEDULED'
    `, [today]);

    const thisMonth = today.substring(0, 7);

    const [kitchen, onLeave, activeStudents, pendingDues, todayExpenses, recentPayments] = await Promise.all([
      query(`SELECT meal_type, COUNT(*) as total FROM daily_meal_calendar
             WHERE meal_date=$1 AND status IN ('SCHEDULED','SERVED') GROUP BY meal_type`, [today]),
      query(`SELECT COUNT(DISTINCT student_id) as count FROM daily_meal_calendar
             WHERE meal_date=$1 AND status='SKIPPED'`, [today]),
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
        query(`SELECT COUNT(*) as count FROM daily_meal_calendar WHERE student_id=$1 AND status='SKIPPED'`, [req.user.studentId]),
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
