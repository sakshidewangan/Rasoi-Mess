import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings(res.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
          Save
        </button>
      </div>

      {/* Rasoi Info */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Rasoi Info</h2>
        <div>
          <label className="label">Rasoi Name</label>
          <input className="input-field" value={settings.rasoi_name || ''} onChange={e => set('rasoi_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Receipt Prefix</label>
          <input className="input-field" placeholder="RCP" value={settings.receipt_prefix || ''} onChange={e => set('receipt_prefix', e.target.value)} />
          <p className="text-xs text-white/25 mt-1">Receipts will be numbered: {settings.receipt_prefix || 'RCP'}-2026-0001</p>
        </div>
      </div>

      {/* Meal Prices */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Meal Prices</h2>
        <p className="text-xs text-white/30">Changes apply from today. Historical records keep their original price.</p>
        {[
          ['breakfast_price', '☀️ Breakfast Price (₹)'],
          ['lunch_price',     '🍱 Lunch Price (₹)'],
          ['dinner_price',    '🌙 Dinner Price (₹)'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="label">{label}</label>
            <input
              className="input-field"
              type="number"
              inputMode="decimal"
              value={settings[key] || ''}
              onChange={e => set(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Financial Settings */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Financial Settings</h2>
        <div>
          <label className="label">Financial Year Start Month</label>
          <select className="input-field cursor-pointer" value={settings.financial_year_start || '04'} onChange={e => set('financial_year_start', e.target.value)}>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
              <option key={m} value={m}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
