import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/payments/:studentId — list payments for a student
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(studentId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const result = await query(`
      SELECT * FROM payments WHERE student_id=$1 ORDER BY payment_date DESC
    `, [studentId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments — record a payment (owner only)
router.post('/', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    const { student_id, amount, payment_date, payment_mode, remarks } = req.body;
    await client.query('BEGIN');

    // Auto-generate receipt number: RCP-YYYY-XXXX
    const countRes = await client.query('SELECT COUNT(*) FROM payments');
    const count = parseInt(countRes.rows[0].count) + 1;
    const year = new Date(payment_date).getFullYear();

    const settingsRes = await client.query(`SELECT value FROM settings WHERE key='receipt_prefix'`);
    const prefix = settingsRes.rows[0]?.value || 'RCP';
    const receipt_number = `${prefix}-${year}-${String(count).padStart(4, '0')}`;

    const result = await client.query(`
      INSERT INTO payments (student_id, amount, payment_date, payment_mode, receipt_number, remarks)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [student_id, amount, payment_date, payment_mode, receipt_number, remarks]);

    // Update student balance (reduce what they owe)
    await client.query(`
      UPDATE students SET current_balance = current_balance - $1 WHERE id=$2
    `, [amount, student_id]);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
