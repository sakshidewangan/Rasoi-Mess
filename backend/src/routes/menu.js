import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/menu — Fetch the complete weekly menu (publicly accessible)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM weekly_menu ORDER BY day_of_week, meal_type');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching weekly menu:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/menu — Update a menu item (authenticated, owner only)
router.put('/', authenticate, requireOwner, async (req, res) => {
  try {
    const { day_of_week, meal_type, items } = req.body;
    
    if (!day_of_week || !meal_type || items === undefined) {
      return res.status(400).json({ message: 'day_of_week, meal_type, and items are required' });
    }
    
    // Validate inputs
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const validMeals = ['BREAKFAST', 'LUNCH', 'DINNER'];
    
    if (!validDays.includes(day_of_week)) {
      return res.status(400).json({ message: 'Invalid day of week' });
    }
    
    if (!validMeals.includes(meal_type)) {
      return res.status(400).json({ message: 'Invalid meal type' });
    }
    
    await query(`
      INSERT INTO weekly_menu (day_of_week, meal_type, items) VALUES ($1, $2, $3)
      ON CONFLICT (day_of_week, meal_type) DO UPDATE SET items = $3, updated_at = NOW()
    `, [day_of_week, meal_type, items]);
    
    res.json({ message: 'Menu updated successfully' });
  } catch (err) {
    console.error('Error updating menu:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
