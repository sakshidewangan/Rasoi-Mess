import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// GET /api/students — list all students (owner only)
router.get('/', authenticate, requireOwner, async (req, res) => {
  try {
    const { search, status, zone } = req.query;
    let sql = `
      SELECT s.*, dz.name as zone_name,
        sdm.has_breakfast, sdm.has_lunch, sdm.has_dinner,
        sdm.custom_breakfast_price, sdm.custom_lunch_price, sdm.custom_dinner_price
      FROM students s
      LEFT JOIN delivery_zones dz ON s.delivery_zone_id = dz.id
      LEFT JOIN student_default_meals sdm ON sdm.student_id = s.id
        AND sdm.effective_from = (
          SELECT MAX(effective_from) FROM student_default_meals WHERE student_id = s.id AND effective_from <= CURRENT_DATE
        )
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (search) {
      sql += ` AND (s.name ILIKE $${i} OR s.mobile ILIKE $${i} OR s.room_number ILIKE $${i} OR s.college ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }
    if (status) { sql += ` AND s.status = $${i++}`; params.push(status); }
    if (zone) { sql += ` AND s.delivery_zone_id = $${i++}`; params.push(zone); }
    sql += ' ORDER BY s.name ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/students/:id — get single student with full details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    // Students can only view their own profile
    if (req.user.role === 'STUDENT' && req.user.studentId !== parseInt(id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const result = await query(`
      SELECT s.*, dz.name as zone_name
      FROM students s
      LEFT JOIN delivery_zones dz ON s.delivery_zone_id = dz.id
      WHERE s.id = $1
    `, [id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/students — add new student (owner only)
router.post('/', authenticate, requireOwner, async (req, res) => {
  const client = await (await import('../db/pool.js')).default.connect();
  try {
    await client.query('BEGIN');
    const {
      name, mobile, guardian_mobile, college, hostel, room_number,
      google_map_link, delivery_zone_id, credit_limit, veg_status,
      academic_session, joining_date, remarks, photo_url,
      has_breakfast = true, has_lunch = true, has_dinner = true,
      custom_breakfast_price, custom_lunch_price, custom_dinner_price,
      create_login = false, password
    } = req.body;

    // Create student record
    const studentResult = await client.query(`
      INSERT INTO students (name, mobile, guardian_mobile, college, hostel, room_number,
        google_map_link, delivery_zone_id, credit_limit, veg_status, academic_session,
        joining_date, remarks, photo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [name, mobile, guardian_mobile, college, hostel, room_number,
        google_map_link, delivery_zone_id, credit_limit || 1000, veg_status || 'VEG',
        academic_session, joining_date, remarks, photo_url]);

    const student = studentResult.rows[0];

    // Set default meal schedule
    await client.query(`
      INSERT INTO student_default_meals (student_id, has_breakfast, has_lunch, has_dinner,
        custom_breakfast_price, custom_lunch_price, custom_dinner_price, effective_from)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [student.id, has_breakfast, has_lunch, has_dinner,
        custom_breakfast_price, custom_lunch_price, custom_dinner_price, joining_date]);

    // Create user login if requested
    if (create_login && password) {
      const hash = await bcrypt.hash(password, 10);
      const userResult = await client.query(`
        INSERT INTO users (name, phone, password_hash, role) VALUES ($1,$2,$3,'STUDENT') RETURNING id
      `, [name, mobile, hash]);
      await client.query('UPDATE students SET user_id = $1 WHERE id = $2', [userResult.rows[0].id, student.id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Student added successfully', student });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ message: 'Mobile number already exists' });
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/students/:id — update student (owner only)
router.put('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, mobile, guardian_mobile, college, hostel, room_number,
      google_map_link, delivery_zone_id, credit_limit, veg_status,
      academic_session, joining_date, leaving_date, remarks, photo_url, status
    } = req.body;

    const result = await query(`
      UPDATE students SET name=$1, mobile=$2, guardian_mobile=$3, college=$4, hostel=$5,
        room_number=$6, google_map_link=$7, delivery_zone_id=$8, credit_limit=$9,
        veg_status=$10, academic_session=$11, joining_date=$12, leaving_date=$13,
        remarks=$14, photo_url=$15, status=$16
      WHERE id=$17 RETURNING *
    `, [name, mobile, guardian_mobile, college, hostel, room_number,
        google_map_link, delivery_zone_id, credit_limit, veg_status,
        academic_session, joining_date, leaving_date, remarks, photo_url, status, id]);

    if (!result.rows[0]) return res.status(404).json({ message: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/students/:id/status — block/activate/deactivate
router.patch('/:id/status', authenticate, requireOwner, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'BLOCKED', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const result = await query('UPDATE students SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
