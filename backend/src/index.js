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
import excelRoutes from './routes/excel.js';
import zoneRoutes from './routes/zones.js';
import { syncToFirestore, backupDatabaseFile } from './db/backup.js';

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

app.use((req, res, next) => {
  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
app.use("/api/excel", excelRoutes);
app.use("/api/zones", zoneRoutes);

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

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Rasoi API running on http://localhost:${port}`);
    console.log(`📡 Health check: http://localhost:${port}/api/health`);

    // Attempt automatic backup/sync on start (asynchronous, doesn't block startup)
    setTimeout(async () => {
      console.log('⏰ Running startup automatic cloud backup...');
      await syncToFirestore();
      await backupDatabaseFile();
    }, 5000);
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
