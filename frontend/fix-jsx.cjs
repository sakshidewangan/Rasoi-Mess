const fs = require('fs');
const path = 'src/pages/AddStudentPage.jsx';
let c = fs.readFileSync(path, 'utf8');

const target = `{/* Mess Details */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Mess Details</h2>
          <div>

              <label className="label">Joining Date *</label>
              <input className="input-field" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label mb-2">Default Meal Plan</label>`;

// We will use a regex that ignores whitespace differences
const regex = /\{\/\*\s*Mess Details\s*\*\/\}\s*<div className="card p-4 space-y-3">\s*<h2 className="text-sm font-semibold text-white\/60 uppercase tracking-wider">Mess Details<\/h2>\s*<div>\s*<label className="label">Joining Date \*\<\/label>\s*<input className="input-field" type="date" value=\{form\.joining_date\} onChange=\{e => set\('joining_date', e\.target\.value\)\} required \/>\s*<\/div>\s*<\/div>\s*<div>\s*<label className="label mb-2">Default Meal Plan<\/label>/;

const replacement = `{/* Mess Details */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Mess Details</h2>
          <div>
            <label className="label">Joining Date *</label>
            <input className="input-field" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} required />
          </div>
          <div>
            <label className="label mb-2">Default Meal Plan</label>`;

c = c.replace(regex, replacement);
fs.writeFileSync(path, c);
console.log('Fixed AddStudentPage.jsx');
