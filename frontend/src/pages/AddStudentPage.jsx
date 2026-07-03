import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { UserPlus, ArrowLeft, Coffee, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddStudentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', mobile: '', guardian_mobile: '', college: '',
    hostel: '', room_number: '', veg_status: 'VEG',
    joining_date: new Date().toISOString().split('T')[0],
    academic_session: '2025-26', credit_limit: 1000,
    has_breakfast: true, has_lunch: true, has_dinner: true,
    remarks: '', create_login: false, password: '',
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/students', form);
      toast.success(`${form.name} added successfully!`);
      navigate('/students');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const MealToggle = ({ icon: Icon, label, field }) => (
    <button
      type="button"
      onClick={() => set(field, !form[field])}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
        form[field]
          ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
          : 'bg-surface-800 border-white/5 text-white/25'
      }`}
    >
      <Icon size={20} />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] font-bold">{form[field] ? 'ON' : 'OFF'}</span>
    </button>
  );

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">Add New Student</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Personal Details */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Personal Details</h2>
          <div>
            <label className="label">Full Name *</label>
            <input className="input-field" placeholder="Student name" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mobile *</label>
              <input className="input-field" type="tel" inputMode="numeric" placeholder="10-digit number" value={form.mobile} onChange={e => set('mobile', e.target.value)} required />
            </div>
            <div>
              <label className="label">Guardian Mobile</label>
              <input className="input-field" type="tel" inputMode="numeric" placeholder="Optional" value={form.guardian_mobile} onChange={e => set('guardian_mobile', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">College / Institute</label>
            <input className="input-field" placeholder="College name" value={form.college} onChange={e => set('college', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hostel / Building</label>
              <input className="input-field" placeholder="Hostel name" value={form.hostel} onChange={e => set('hostel', e.target.value)} />
            </div>
            <div>
              <label className="label">Room Number</label>
              <input className="input-field" placeholder="Room no." value={form.room_number} onChange={e => set('room_number', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Food Type</label>
              <select className="input-field cursor-pointer" value={form.veg_status} onChange={e => set('veg_status', e.target.value)}>
                <option value="VEG">🥦 Veg</option>
                <option value="NON_VEG">🍗 Non-Veg</option>
              </select>
            </div>
            <div>
              <label className="label">Academic Session</label>
              <input className="input-field" placeholder="2025-26" value={form.academic_session} onChange={e => set('academic_session', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Mess Details */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Mess Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Joining Date *</label>
              <input className="input-field" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Credit Limit (₹)</label>
              <input className="input-field" type="number" inputMode="numeric" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label mb-2">Default Meal Plan</label>
            <div className="flex gap-2">
              <MealToggle icon={Coffee} label="Breakfast" field="has_breakfast" />
              <MealToggle icon={Sun}    label="Lunch"     field="has_lunch" />
              <MealToggle icon={Moon}   label="Dinner"    field="has_dinner" />
            </div>
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Any notes..." value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>
        </div>

        {/* Student Login */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Student App Access</h2>
            <button
              type="button"
              onClick={() => set('create_login', !form.create_login)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.create_login ? 'bg-brand-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.create_login ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {form.create_login && (
            <div>
              <label className="label">App Password</label>
              <input className="input-field" type="password" placeholder="Set a password for the student" value={form.password} onChange={e => set('password', e.target.value)} />
              <p className="text-xs text-white/30 mt-1">Student will log in with their mobile number and this password.</p>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus size={16} /> Add Student</>}
        </button>
      </form>
    </div>
  );
}
