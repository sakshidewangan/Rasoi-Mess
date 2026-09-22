import fs from 'fs';

// ── App.jsx ──────────────────────────────────────────────────────────────────
{
  const path = 'src/App.jsx';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(/import BillingPage from '\.\/pages\/BillingPage';\r?\n/, '');
  c = c.replace(/[ \t]*<Route path="\/billing\/:id" element=\{<BillingPage \/>\} \/>\r?\n/, '');
  c = c.replace(/[ \t]*<Route path="\/payments" element=\{<ProtectedRoute ownerOnly><StudentsPage \/><\/ProtectedRoute>\} \/>\r?\n/, '');
  c = c.replace(/[ \t]*<Route path="\/payments\/:id" element=\{<ProtectedRoute ownerOnly><BillingPage \/><\/ProtectedRoute>\} \/>\r?\n/, '');
  c = c.replace(/[ \t]*<Route path="\/my-balance" element=\{.*?replace \/>\} \/>\r?\n/, '');
  fs.writeFileSync(path, c);
  console.log('App.jsx BillingPage remaining:', c.includes('BillingPage') ? 'YES (check manually)' : 'NONE ✅');
  console.log('App.jsx /payments remaining:', c.includes('/payments') ? 'YES (check manually)' : 'NONE ✅');
}

// ── DashboardPage.jsx ─────────────────────────────────────────────────────────
{
  const path = 'src/pages/DashboardPage.jsx';
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(/, CreditCard/g, '').replace(/CreditCard, /g, '');
  const hadPayments = c.includes('Recent Payments');
  console.log('DashboardPage has CreditCard:', c.includes('CreditCard'), '| has Recent Payments:', hadPayments);
  fs.writeFileSync(path, c);
}

// ── AddStudentPage.jsx ────────────────────────────────────────────────────────
{
  const path = 'src/pages/AddStudentPage.jsx';
  let c = fs.readFileSync(path, 'utf8');
  // Remove orphan empty div block
  c = c.replace(/[ \t]*<div>\r?\n\r?\n\r?\n[ \t]*<\/div>\r?\n/g, '');
  c = c.replace(/,\s*credit_limit:\s*\d+/, '');
  c = c.replace(/credit_limit:\s*\d+,\s*/, '');
  fs.writeFileSync(path, c);
  console.log('AddStudentPage: cleaned ✅');
}
