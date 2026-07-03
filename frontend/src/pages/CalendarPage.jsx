import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  ArrowLeft, Coffee, Sun, Moon, Plus, CalendarDays,
  Phone, Home, AlertCircle, CreditCard, PenLine
} from 'lucide-react';
import { format, parse, addMonths, subMonths } from 'date-fns';
import toast from 'react-hot-toast';

const MEAL_STATUS = {
  SERVED:    { dot: 'bg-green-400',  text: 'text-green-400',  label: '✔' },
  SCHEDULED: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: '~' },
  SKIPPED:   { dot: 'bg-red-400',    text: 'text-red-400',    label: '✕' },
  CANCELLED: { dot: 'bg-red-500',    text: 'text-red-500',    label: '✕' },
  WASTED:    { dot: 'bg-orange-400', text: 'text-orange-400', label: 'W' },
  ISSUE:     { dot: 'bg-purple-400', text: 'text-purple-400', label: '!' },
};

function MealCell({ meal, onClick }) {
  if (!meal) return <div className="w-7 h-5 rounded opacity-20" />;
  const s = MEAL_STATUS[meal.status] || MEAL_STATUS.SCHEDULED;
  return (
    <button
      onClick={() => onClick(meal)}
      className={`w-7 h-5 rounded text-[9px] font-bold border ${
        meal.status === 'SERVED'    ? 'bg-green-500/20 border-green-500/30 text-green-400' :
        meal.status === 'SKIPPED' || meal.status === 'CANCELLED' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
        meal.status === 'SCHEDULED' ? 'bg-yellow-500/15 border-yellow-500/20 text-yellow-400' :
        'bg-white/5 border-white/5 text-white/20'
      } hover:scale-110 transition-transform`}
      title={`${meal.meal_type} - ${meal.status}`}
    >
      {s.label}
    </button>
  );
}

export default function CalendarPage() {
  const { id: studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [meals, setMeals] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      api.get(`/students/${studentId}`),
      api.get(`/calendar/${studentId}?month=${currentMonth}`)
    ]).then(([sRes, mRes]) => {
      setStudent(sRes.data);
      setMeals(mRes.data);
    }).catch(() => toast.error('Failed to load calendar'))
      .finally(() => setLoading(false));
  }, [studentId, currentMonth]);

  const mealByDateType = {};
  meals.forEach(m => {
    const key = `${m.meal_date?.split('T')[0]}_${m.meal_type}`;
    mealByDateType[key] = m;
  });

  const [year, mon] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const firstDay = new Date(year, mon - 1, 1).getDay();

  const handleMealClick = (meal) => setSelectedMeal(meal);

  const handleStatusUpdate = async (newStatus) => {
    try {
      await api.patch(`/calendar/${selectedMeal.id}/status`, { status: newStatus });
      toast.success('Meal status updated');
      setSelectedMeal(null);
      const res = await api.get(`/calendar/${studentId}?month=${currentMonth}`);
      setMeals(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const generateCalendar = async () => {
    try {
      await api.post('/calendar/generate', { student_id: parseInt(studentId), month: currentMonth });
      toast.success('Calendar generated!');
      const res = await api.get(`/calendar/${studentId}?month=${currentMonth}`);
      setMeals(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>;

  const served = meals.filter(m => m.status === 'SERVED' || m.status === 'SCHEDULED');
  const totalAmt = served.reduce((acc, m) => acc + parseFloat(m.price || 0), 0);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">{student?.name}'s Calendar</h1>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-white/40">
            {student?.mobile && <span className="flex items-center gap-1"><Phone size={10} />{student.mobile}</span>}
            {student?.room_number && <span className="flex items-center gap-1"><Home size={10} />Room {student.room_number}</span>}
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(format(subMonths(parse(currentMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM'))} className="btn-secondary px-3">‹</button>
        <h2 className="text-base font-bold text-white">{format(parse(currentMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(format(addMonths(parse(currentMonth, 'yyyy-MM', new Date()), 1), 'yyyy-MM'))} className="btn-secondary px-3">›</button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={generateCalendar} className="btn-secondary text-xs">
          <CalendarDays size={14} /> Generate Month
        </button>
        <button onClick={() => setShowLeave(true)} className="btn-secondary text-xs">
          <Plus size={14} /> Add Leave
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-[10px]">
        {[['bg-green-400', 'Served'], ['bg-yellow-400', 'Scheduled'], ['bg-red-400', 'Skipped']].map(([bg, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-white/40">
            <span className={`w-2 h-2 rounded-full ${bg}`} /> {l}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="card p-3 lg:p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <div key={d} className="text-center text-[10px] text-white/30 font-medium py-1">{d}</div>
          ))}
        </div>
        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
            const B = mealByDateType[`${dateStr}_BREAKFAST`];
            const L = mealByDateType[`${dateStr}_LUNCH`];
            const D = mealByDateType[`${dateStr}_DINNER`];
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

            return (
              <div key={day} className={`rounded-lg p-1 ${isToday ? 'bg-brand-500/10 ring-1 ring-brand-500/30' : 'hover:bg-white/3'} transition-colors`}>
                <p className={`text-[10px] font-bold text-center mb-1 ${isToday ? 'text-brand-400' : 'text-white/40'}`}>{day}</p>
                <div className="flex flex-col gap-0.5 items-center">
                  <MealCell meal={B} onClick={handleMealClick} />
                  <MealCell meal={L} onClick={handleMealClick} />
                  <MealCell meal={D} onClick={handleMealClick} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-wider">Month Summary</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ['B', 'Breakfast', 'BREAKFAST'],
            ['L', 'Lunch',     'LUNCH'],
            ['D', 'Dinner',    'DINNER'],
          ].map(([abbr, label, type]) => {
            const taken   = meals.filter(m => m.meal_type === type && (m.status === 'SERVED' || m.status === 'SCHEDULED')).length;
            const skipped = meals.filter(m => m.meal_type === type && (m.status === 'SKIPPED' || m.status === 'CANCELLED')).length;
            return (
              <div key={type} className="bg-surface-800 rounded-xl p-3">
                <p className="text-xs text-white/40 font-medium">{label}</p>
                <p className="text-lg font-bold text-green-400 mt-1">{taken}</p>
                <p className="text-[10px] text-red-400">{skipped} skipped</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-sm text-white/40">Estimated Bill</span>
          <span className="text-lg font-bold text-brand-400">₹{totalAmt.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Meal Edit Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-4" onClick={() => setSelectedMeal(null)}>
          <div className="bg-surface-800 rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-1">
              {selectedMeal.meal_type} · {format(new Date(selectedMeal.meal_date), 'd MMM')}
            </h3>
            <p className="text-xs text-white/40 mb-4">₹{selectedMeal.price} · Currently: <span className="text-white">{selectedMeal.status}</span></p>
            <div className="grid grid-cols-2 gap-2">
              {['SERVED', 'SCHEDULED', 'SKIPPED', 'CANCELLED', 'WASTED'].map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(s)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    s === selectedMeal.status
                      ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedMeal(null)} className="btn-secondary w-full justify-center mt-3 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeave && <LeaveModal studentId={studentId} onClose={() => setShowLeave(false)} onSuccess={() => {
        setShowLeave(false);
        api.get(`/calendar/${studentId}?month=${currentMonth}`).then(r => setMeals(r.data));
      }} />}
    </div>
  );
}

function LeaveModal({ studentId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    start_date: '', end_date: '',
    skip_breakfast: true, skip_lunch: true, skip_dinner: true, reason: ''
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/leaves', { ...form, student_id: parseInt(studentId) });
      toast.success('Leave applied!');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply leave');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white mb-4">Add Leave / Skip Meals</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">From</label>
              <input className="input-field" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input-field" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Meals to Skip</label>
            <div className="flex gap-2">
              {[['skip_breakfast', Coffee, 'Breakfast'], ['skip_lunch', Sun, 'Lunch'], ['skip_dinner', Moon, 'Dinner']].map(([field, Icon, label]) => (
                <button key={field} type="button"
                  onClick={() => set(field, !form[field])}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                    form[field] ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/5 text-white/30'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input-field" placeholder="Going home, medical..." value={form.reason} onChange={e => set('reason', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Apply Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
