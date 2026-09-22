import express from 'express';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/zones — delivery zones with active-student counts
router.get('/', authenticate, requireOwner, async (_req, res) => {
  try {
    const result = await query(`
      SELECT dz.*, COUNT(s.id) AS student_count
      FROM delivery_zones dz
      LEFT JOIN students s ON s.delivery_zone_id = dz.id AND s.status = 'ACTIVE'
      GROUP BY dz.id
      ORDER BY dz.route_order ASC, dz.name ASC
    `);
    res.json(result.rows.map(zone => ({ ...zone, student_count: Number(zone.student_count) })));
  } catch (err) {
    console.error('Error fetching delivery zones:', err);
    res.status(500).json({ message: 'Failed to load delivery zones' });
  }
});

// POST /api/zones — create a delivery zone
router.post('/', authenticate, requireOwner, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim() || null;
    const routeOrder = Number.isFinite(Number(req.body.route_order)) ? Number(req.body.route_order) : 0;
    if (!name) return res.status(400).json({ message: 'Zone name is required' });

    const result = await query(
      'INSERT INTO delivery_zones (name, description, route_order) VALUES ($1, $2, $3) RETURNING *',
      [name, description, routeOrder],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
      return res.status(400).json({ message: 'A zone with this name already exists' });
    }
    console.error('Error creating delivery zone:', err);
    res.status(500).json({ message: 'Failed to create delivery zone' });
  }
});

// GET /api/zones/:id/students — members of a zone and students available to assign
router.get('/:id/students', authenticate, requireOwner, async (req, res) => {
  try {
    const zone = await query('SELECT * FROM delivery_zones WHERE id = $1', [req.params.id]);
    if (!zone.rows[0]) return res.status(404).json({ message: 'Zone not found' });

    const [assigned, available] = await Promise.all([
      query(`SELECT id, name, mobile, room_number, hostel FROM students
             WHERE delivery_zone_id = $1 ORDER BY name ASC`, [req.params.id]),
      query(`SELECT s.id, s.name, s.mobile, s.room_number, s.hostel, dz.name AS current_zone_name
             FROM students s LEFT JOIN delivery_zones dz ON dz.id = s.delivery_zone_id
             WHERE s.status = 'ACTIVE' AND (s.delivery_zone_id IS NULL OR s.delivery_zone_id != $1)
             ORDER BY s.name ASC`, [req.params.id]),
    ]);
    res.json({ zone: zone.rows[0], assigned: assigned.rows, available: available.rows });
  } catch (err) {
    console.error('Error loading zone students:', err);
    res.status(500).json({ message: 'Failed to load zone students' });
  }
});

// PUT /api/zones/:id/students/:studentId — assign or move a student into a zone
router.put('/:id/students/:studentId', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`UPDATE students SET delivery_zone_id = $1
      WHERE id = $2 RETURNING id, name, mobile, room_number, hostel, delivery_zone_id`, [req.params.id, req.params.studentId]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') return res.status(404).json({ message: 'Zone not found' });
    console.error('Error assigning student to zone:', err);
    res.status(500).json({ message: 'Failed to assign student' });
  }
});

// DELETE /api/zones/:id/students/:studentId — remove a student from this zone
router.delete('/:id/students/:studentId', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`UPDATE students SET delivery_zone_id = NULL
      WHERE id = $1 AND delivery_zone_id = $2 RETURNING id`, [req.params.studentId, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Student is not assigned to this zone' });
    res.json({ message: 'Student removed from zone' });
  } catch (err) {
    console.error('Error removing student from zone:', err);
    res.status(500).json({ message: 'Failed to remove student from zone' });
  }
});

router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query('DELETE FROM delivery_zones WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Zone not found' });
    res.json({ message: 'Zone removed. Assigned students are now unassigned.' });
  } catch (err) {
    console.error('Error deleting delivery zone:', err);
    res.status(500).json({ message: 'Failed to remove delivery zone' });
  }
});

export default router;
