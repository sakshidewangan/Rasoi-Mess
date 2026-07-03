import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/billing/:studentId?month=2026-07 — calculate monthly bill
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query;

    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if snapshot exists (month closed)
    const snapshot = await query(`
      SELECT * FROM monthly_bill_snapshots WHERE student_id=$1 AND billing_month=$2
    `, [studentId, month]);

    if (snapshot.rows[0]) {
      return res.json({ ...snapshot.rows[0], source: 'snapshot' });
    }

    // Live calculation from calendar
    const meals = await query(`
      SELECT meal_type, status, price FROM daily_meal_calendar
      WHERE student_id=$1 AND TO_CHAR(meal_date, 'YYYY-MM')=$2
    `, [studentId, month]);

    const summary = {
      breakfast_taken: 0, lunch_taken: 0, dinner_taken: 0,
      breakfast_skipped: 0, lunch_skipped: 0, dinner_skipped: 0,
      breakfast_amount: 0, lunch_amount: 0, dinner_amount: 0,
    };

    for (const m of meals.rows) {
      const type = m.meal_type.toLowerCase();
      if (m.status === 'SERVED' || m.status === 'SCHEDULED') {
        summary[`${type}_taken`]++;
        summary[`${type}_amount`] += parseFloat(m.price);
      } else if (m.status === 'SKIPPED' || m.status === 'CANCELLED') {
        summary[`${type}_skipped`]++;
      }
    }

    const total = summary.breakfast_amount + summary.lunch_amount + summary.dinner_amount;

    // Get payments for this month
    const payments = await query(`
      SELECT COALESCE(SUM(amount), 0) as paid
      FROM payments WHERE student_id=$1 AND TO_CHAR(payment_date, 'YYYY-MM')=$2
    `, [studentId, month]);

    const paid = parseFloat(payments.rows[0].paid);
    const student = await query('SELECT current_balance FROM students WHERE id=$1', [studentId]);
    const openingBalance = parseFloat(student.rows[0]?.current_balance || 0);

    res.json({
      ...summary,
      total_bill_amount: total,
      total_paid: paid,
      opening_balance: openingBalance,
      closing_balance: openingBalance + total - paid,
      source: 'live',
      billing_month: month,
      student_id: parseInt(studentId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/billing/:studentId/close — freeze month (owner only)
router.post('/:studentId/close', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    const { studentId } = req.params;
    const { month } = req.body;

    await client.query('BEGIN');

    // Calculate final bill
    const meals = await client.query(`
      SELECT meal_type, status, price FROM daily_meal_calendar
      WHERE student_id=$1 AND TO_CHAR(meal_date, 'YYYY-MM')=$2
    `, [studentId, month]);

    const s = { breakfast_taken:0, lunch_taken:0, dinner_taken:0, breakfast_skipped:0, lunch_skipped:0, dinner_skipped:0 };
    let total = 0;
    for (const m of meals.rows) {
      const type = m.meal_type.toLowerCase();
      if (m.status === 'SERVED' || m.status === 'SCHEDULED') { s[`${type}_taken`]++; total += parseFloat(m.price); }
      else if (m.status === 'SKIPPED' || m.status === 'CANCELLED') s[`${type}_skipped`]++;
    }

    const payments = await client.query(`
      SELECT COALESCE(SUM(amount),0) as paid FROM payments WHERE student_id=$1 AND TO_CHAR(payment_date,'YYYY-MM')=$2
    `, [studentId, month]);
    const paid = parseFloat(payments.rows[0].paid);

    const studentRes = await client.query('SELECT current_balance FROM students WHERE id=$1', [studentId]);
    const opening = parseFloat(studentRes.rows[0]?.current_balance || 0);
    const closing = opening + total - paid;

    // Save snapshot
    await client.query(`
      INSERT INTO monthly_bill_snapshots
        (student_id, billing_month, breakfast_taken, lunch_taken, dinner_taken,
         breakfast_skipped, lunch_skipped, dinner_skipped, total_bill_amount, total_paid,
         opening_balance, closing_balance, is_locked)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
      ON CONFLICT (student_id, billing_month) DO UPDATE SET
        breakfast_taken=$3, lunch_taken=$4, dinner_taken=$5, breakfast_skipped=$6,
        lunch_skipped=$7, dinner_skipped=$8, total_bill_amount=$9, total_paid=$10,
        opening_balance=$11, closing_balance=$12, is_locked=TRUE
    `, [studentId, month, s.breakfast_taken, s.lunch_taken, s.dinner_taken,
        s.breakfast_skipped, s.lunch_skipped, s.dinner_skipped, total, paid, opening, closing]);

    // Lock all calendar records for this month
    await client.query(`
      UPDATE daily_meal_calendar SET is_locked=TRUE
      WHERE student_id=$1 AND TO_CHAR(meal_date,'YYYY-MM')=$2
    `, [studentId, month]);

    // Update student's running balance
    await client.query('UPDATE students SET current_balance=$1 WHERE id=$2', [closing, studentId]);

    await client.query('COMMIT');
    res.json({ message: `Month ${month} closed successfully`, closing_balance: closing });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
