// cleanup-payments.mjs — removes all payment/billing features from the frontend
import fs from 'fs';

function patch(filePath, fn) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  content = fn(content);
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Patched: ${filePath}`);
  } else {
    console.log(`⚠️  No changes: ${filePath}`);
  }
}

// ── 1. StudentProfilePage.jsx ──────────────────────────────────────────────
patch('src/pages/StudentProfilePage.jsx', (c) => {
  // Remove CreditCard import
  c = c.replace(', CreditCard', '').replace('CreditCard, ', '');

  // Remove payments state
  c = c.replace(/\s*const \[payments, setPayments\] = useState\(\[\]\);\n/, '\n');

  // Remove payments from Promise.all
  c = c.replace(/,?\s*api\.get\(`\/payments\/\$\{id\}`\)\n/, '\n');
  c = c.replace(/,?\s*api\.get\(`\/payments\/\$\{id\}`\)/, '');
  c = c.replace(/\[sRes, lRes, pRes\]/, '[sRes, lRes]');
  c = c.replace(/\s*setPayments\(pRes\.data\);\n/, '\n');
  c = c.replace(/\s*setPayments\(pRes\.data\);/, '');

  // Remove "View Bills & Payments" link (the whole Link element)
  c = c.replace(/\s*<Link to=\{`\/payments\/\$\{student\.id\}`\}[^>]*>[\s\S]*?<\/Link>/g, '');

  // Change grid-cols-2 shortcut container to single column
  c = c.replace('className="grid grid-cols-2 gap-2 pt-2"', 'className="pt-2"');
  // Make the calendar button full width
  c = c.replace(
    /(<Link to=\{`\/calendar\/\$\{student\.id\}`\} className="btn-secondary justify-center text-xs)(")/,
    '$1 w-full$2'
  );

  // Remove Current Balance block
  c = c.replace(/\s*<div>\s*<p className="text-white\/40 text-xs">Current Balance<\/p>[\s\S]*?<\/div>/m, '');

  // Remove Credit Limit block
  c = c.replace(/\s*<div>\s*<p className="text-white\/40 text-xs">Credit Limit<\/p>[\s\S]*?<\/div>/m, '');

  // Remove whole "Recent Transactions" / "Recent Payments" card
  c = c.replace(/\s*\{\/\* Recent Payments \*\/\}[\s\S]*?\{\/\* Deactivate\/Reactivate Button \*\/\}/, '\n      {/* Deactivate/Reactivate Button */}');

  // Clean up modal text
  c = c.replace('meal delivery, billing, kitchen sheets', 'meal delivery, kitchen sheets');
  c = c.replace('payment history, billing history, ', '');
  c = c.replace('payment history, billing history,', '');

  return c;
});

// ── 2. AddStudentPage.jsx ──────────────────────────────────────────────────
patch('src/pages/AddStudentPage.jsx', (c) => {
  // Remove credit_limit from initial form state
  c = c.replace(/,\s*credit_limit:\s*\d+/, '');
  c = c.replace(/credit_limit:\s*\d+,\s*/, '');

  // Remove Credit Limit label+input block
  c = c.replace(/\s*<div>\s*<label className="label">Credit Limit \(₹\)<\/label>\s*<input[^\/]*\/>\s*<\/div>/g, '');

  // Change 2-col grid wrapper to single div around Joining Date
  c = c.replace(/<div className="grid grid-cols-2 gap-3">\s*(<div>\s*<label className="label">Joining Date)/, '<div>\n            $1');
  // Close the now-missing outer div — remove the extra </div> that matched the old grid wrapper
  c = c.replace(/(<input[^\/]*type="date"[^\/]*\/>\s*<\/div>)\s*<\/div>(\s*<div>)/, '$1$2');

  return c;
});

// ── 3. StudentsPage.jsx ────────────────────────────────────────────────────
patch('src/pages/StudentsPage.jsx', (c) => {
  // Remove the "Due: ₹..." balance pill
  c = c.replace(/\s*\{student\.current_balance > 0 && \(\s*<span[^>]*>\s*Due: ₹[^<]*<\/span>\s*\)\}/g, '');
  return c;
});

// ── 4. App.jsx ─────────────────────────────────────────────────────────────
patch('src/App.jsx', (c) => {
  // Remove BillingPage import
  c = c.replace(/import BillingPage from '\.\/pages\/BillingPage';\n/, '');

  // Remove billing/payments routes
  c = c.replace(/\s*<Route path="\/billing\/:id"[^\/]*\/>\n/, '\n');
  c = c.replace(/\s*<Route path="\/payments"[^\/]*\/>\n/, '\n');
  c = c.replace(/\s*<Route path="\/payments\/:id"[^\/]*\/>\n/, '\n');
  c = c.replace(/\s*<Route path="\/my-balance"[^\/]*\/>\n/, '\n');

  return c;
});

// ── 5. DashboardPage.jsx — remove recentPayments section ──────────────────
patch('src/pages/DashboardPage.jsx', (c) => {
  // Remove CreditCard from imports (if still present)
  c = c.replace('CreditCard, ', '').replace(', CreditCard', '');

  // Remove the recentPayments section (everything between its comment and Daily Menu Modal)
  c = c.replace(
    /\s*\{\/\* Recent Payments \*\/\}[\s\S]*?(\s*\{\/\* Daily Menu Modal)/,
    '\n\n      {/* Daily Menu Modal'
  );

  // Also remove any leftover empty/broken section tags
  c = c.replace(/\s*<section>\s*<\/section>/g, '');

  return c;
});

console.log('\n🎉 All payment/billing features removed from frontend!');
