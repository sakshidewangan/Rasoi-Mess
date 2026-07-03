import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/expenses?month=2026-07
router.get('/', authenticate, requireOwner, async (req, res) => {
  try {
    const { month } = req.query;
    let sql = 'SELECT * FROM expenses';
    const params = [];
    if (month) { sql += ' WHERE TO_CHAR(expense_date, \'YYYY-MM\') = $1'; params.push(month); }
    sql += ' ORDER BY expense_date DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/expenses — add expense
router.post('/', authenticate, requireOwner, async (req, res) => {
  try {
    const { expense_date, category, description, amount } = req.body;
    const result = await query(`
      INSERT INTO expenses (expense_date, category, description, amount) VALUES ($1,$2,$3,$4) RETURNING *
    `, [expense_date, category, description, amount]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    await query('DELETE FROM expenses WHERE id=$1', [req.params.id]);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
