import express from 'express';
import XLSX from 'xlsx';
import { query } from '../db/pool.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate and send Excel buffer from JSON data
const sendExcelFile = (res, sheets, defaultFilename = 'export.xlsx') => {
  const wb = XLSX.utils.book_new();
  
  sheets.forEach(({ data, sheetName }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${defaultFilename}"`);
  res.send(buffer);
};

// GET /api/excel/export/all - Export entire database to a multi-sheet Excel workbook
router.get('/all', authenticate, requireOwner, async (req, res) => {
  try {
    // 1. Fetch Students
    const studentsRes = await query(`
      SELECT s.id, s.name, s.mobile, s.guardian_mobile, s.college, s.hostel, s.room_number, 
             s.current_balance as outstanding_dues, s.credit_limit, s.veg_status, s.status, 
             s.joining_date, s.remarks, dz.name as delivery_zone 
      FROM students s 
      LEFT JOIN delivery_zones dz ON s.delivery_zone_id = dz.id
      ORDER BY s.name ASC
    `);

    // 2. Fetch Payments
    const paymentsRes = await query(`
      SELECT p.id, s.name as student_name, s.mobile as student_mobile, p.amount, 
             p.payment_date, p.payment_mode, p.receipt_number, p.remarks, p.created_at
      FROM payments p 
      JOIN students s ON p.student_id = s.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);

    // 3. Fetch Expenses
    const expensesRes = await query(`
      SELECT id, expense_date, category, description, amount, created_at 
      FROM expenses 
      ORDER BY expense_date DESC
    `);

    // 4. Fetch System Settings
    const settingsRes = await query(`
      SELECT key as setting_name, value as setting_value, updated_at 
      FROM settings 
      ORDER BY key ASC
    `);

    const sheets = [
      { data: studentsRes.rows, sheetName: 'Students' },
      { data: paymentsRes.rows, sheetName: 'Payments' },
      { data: expensesRes.rows, sheetName: 'Expenses' },
      { data: settingsRes.rows, sheetName: 'Settings' }
    ];

    sendExcelFile(res, sheets, 'rasoi_complete_backup.xlsx');
  } catch (err) {
    console.error('❌ Failed to export database to Excel:', err);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
});

// GET /api/excel/export/students - Export students list
router.get('/students', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`
      SELECT s.id, s.name, s.mobile, s.guardian_mobile, s.college, s.hostel, s.room_number, 
             s.current_balance as outstanding_dues, s.credit_limit, s.veg_status, s.status, 
             s.joining_date, s.remarks, dz.name as delivery_zone 
      FROM students s 
      LEFT JOIN delivery_zones dz ON s.delivery_zone_id = dz.id
      ORDER BY s.name ASC
    `);
    
    sendExcelFile(res, [{ data: result.rows, sheetName: 'Students' }], 'rasoi_students.xlsx');
  } catch (err) {
    console.error('❌ Failed to export students to Excel:', err);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
});

// GET /api/excel/export/payments - Export payment records
router.get('/payments', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.id, s.name as student_name, s.mobile as student_mobile, p.amount, 
             p.payment_date, p.payment_mode, p.receipt_number, p.remarks, p.created_at
      FROM payments p 
      JOIN students s ON p.student_id = s.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    
    sendExcelFile(res, [{ data: result.rows, sheetName: 'Payments' }], 'rasoi_payments.xlsx');
  } catch (err) {
    console.error('❌ Failed to export payments to Excel:', err);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
});

// GET /api/excel/export/expenses - Export expense records
router.get('/expenses', authenticate, requireOwner, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, expense_date, category, description, amount, created_at 
      FROM expenses 
      ORDER BY expense_date DESC
    `);
    
    sendExcelFile(res, [{ data: result.rows, sheetName: 'Expenses' }], 'rasoi_expenses.xlsx');
  } catch (err) {
    console.error('❌ Failed to export expenses to Excel:', err);
    res.status(500).json({ message: 'Failed to generate Excel file' });
  }
});

export default router;
