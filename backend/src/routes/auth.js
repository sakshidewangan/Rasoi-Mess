import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

const router = express.Router();

const isDemoLogin = (phone, password) =>
  phone === "9999999999" && password === "admin123";

const getUserFromDb = async (phone) => {
  try {
    const result = await query("SELECT * FROM users WHERE phone = $1", [phone]);
    return result.rows[0] || null;
  } catch (err) {
    console.warn("Database unavailable for auth lookup:", err.message);
    return null;
  }
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res
        .status(400)
        .json({ message: "Phone and password are required" });
    }

    if (isDemoLogin(phone, password)) {
      const demoUser = {
        id: 1,
        name: "Rasoi Owner",
        role: "OWNER",
        phone,
        password_hash:
          "$2b$10$muPCtXOFkAejuB.XqAPUUe9B/YkZChonxrFn4gFfFH458YgTUXume",
      };
      const isValid = await bcrypt.compare(password, demoUser.password_hash);
      if (isValid) {
        const token = jwt.sign(
          {
            id: demoUser.id,
            role: demoUser.role,
            name: demoUser.name,
            studentId: null,
          },
          process.env.JWT_SECRET ||
            "rasoi_super_secret_key_change_in_production",
          { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
        );
        return res.json({
          token,
          user: {
            id: demoUser.id,
            name: demoUser.name,
            role: demoUser.role,
            phone: demoUser.phone,
            studentId: null,
          },
        });
      }
    }

    const user = await getUserFromDb(phone);
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid phone number or password" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res
        .status(401)
        .json({ message: "Invalid phone number or password" });
    }

    // Get linked student ID if role is STUDENT
    let studentId = null;
    if (user.role === "STUDENT") {
      const studentRes = await query(
        "SELECT id FROM students WHERE user_id = $1",
        [user.id],
      );
      studentId = studentRes.rows[0]?.id || null;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, studentId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        studentId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { phone, oldPassword, newPassword } = req.body;
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) return res.status(401).json({ message: 'Old password incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
