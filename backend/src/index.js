import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './db/pool.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import calendarRoutes from './routes/calendar.js';
import leaveRoutes from './routes/leaves.js';
import billingRoutes from './routes/billing.js';
import paymentRoutes from './routes/payments.js';
import expenseRoutes from './routes/expenses.js';
import settingsRoutes from './routes/settings.js';
import menuRoutes from './routes/menu.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Rasoi Management API",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/menu", menuRoutes);

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({ message: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Background task scheduler to auto-mark tiffins as served at 11:59 PM daily (IST / UTC+5:30)
function scheduleDailyAutoServe() {
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  
  // Create a Date object for 11:59 PM today in IST representation (using UTC methods on offset date)
  const targetIST = new Date(istNow);
  targetIST.setUTCHours(23, 59, 0, 0);
  
  // If it's already past 11:59 PM today in IST, set for tomorrow 11:59 PM IST
  if (istNow > targetIST) {
    targetIST.setUTCDate(targetIST.getUTCDate() + 1);
  }
  
  const delay = targetIST.getTime() - istNow.getTime();
  const targetTimeStr = new Date(targetIST.getTime() - 5.5 * 60 * 60 * 1000).toLocaleString();
  console.log(`[AutoServe Scheduler] Next daily serve update scheduled in ${(delay / 1000 / 60).toFixed(2)} minutes (at ${targetTimeStr} IST)`);
  
  setTimeout(async () => {
    try {
      const todayStr = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
      console.log(`[AutoServe] Running daily auto-serve transition for date <= ${todayStr}...`);
      
      const res = await query(`
        UPDATE daily_meal_calendar
        SET status = 'SERVED', updated_at = NOW()
        WHERE meal_date <= $1 AND status = 'SCHEDULED'
      `, [todayStr]);
      
      console.log(`[AutoServe] Success! Marked ${res.rowCount} scheduled meals as SERVED.`);
    } catch (err) {
      console.error('[AutoServe] Error updating meals:', err);
    }
    
    // Reschedule for next day
    scheduleDailyAutoServe();
  }, delay);
}

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Rasoi API running on http://localhost:${port}`);
    console.log(`📡 Health check: http://localhost:${port}/api/health`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is busy. Stop the other process or change PORT.`,
      );
      process.exit(1);
    } else {
      console.error("Server failed to start:", err);
      process.exit(1);
    }
  });
};

startServer(PORT);
scheduleDailyAutoServe();
