import { useState, useEffect } from 'react';
import api from '../lib/api';
import { ChefHat, Save, Coffee, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DailyMenuPage() {
  const [form, setForm] = useState({});
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/menu')
      .then(res => {
        const initialForm = {};
        DAYS.forEach(day => {
          initialForm[day] = { BREAKFAST: '', LUNCH: '', DINNER: '' };
        });
        res.data.forEach(item => {
          if (initialForm[item.day_of_week]) {
            initialForm[item.day_of_week][item.meal_type] = item.items;
          }
        });
        setForm(initialForm);
      })
      .catch(() => {
        toast.error('Failed to load weekly menu');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleChange = (day, meal, val) => {
    setForm(p => ({
      ...p,
      [day]: {
        ...p[day],
        [meal]: val
      }
    }));
  };

  const handleSaveDay = async () => {
    setSaving(true);
    try {
      const dayData = form[selectedDay];
      await Promise.all([
        api.put('/menu', { day_of_week: selectedDay, meal_type: 'BREAKFAST', items: dayData.BREAKFAST || '' }),
        api.put('/menu', { day_of_week: selectedDay, meal_type: 'LUNCH', items: dayData.LUNCH || '' }),
        api.put('/menu', { day_of_week: selectedDay, meal_type: 'DINNER', items: dayData.DINNER || '' })
      ]);
      toast.success(`${selectedDay} menu saved!`);
    } catch {
      toast.error('Failed to save menu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const currentDayMenu = form[selectedDay] || { BREAKFAST: '', LUNCH: '', DINNER: '' };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ChefHat className="text-brand-500" size={24} />
          <h1 className="text-xl font-bold text-white">Daily Menu Manager</h1>
        </div>
        <button
          onClick={handleSaveDay}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Save {selectedDay} Menu
        </button>
      </div>

      {/* Weekday Selection Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
              selectedDay === day
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                : 'bg-surface-800 text-white/50 border border-white/5 hover:text-white hover:bg-surface-700'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Editor Inputs */}
      <div className="card p-5 space-y-5 border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-brand-400 uppercase tracking-wider">{selectedDay}'s Menu</h2>
          <span className="text-[10px] text-white/30">Changes display instantly on landing page</span>
        </div>

        {/* Breakfast Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/60">
            <Coffee size={15} className="text-orange-400" />
            <label className="text-xs font-semibold">Breakfast Menu Items</label>
          </div>
          <input
            className="input-field"
            placeholder="e.g. Poha, Jalebi, Tea"
            value={currentDayMenu.BREAKFAST || ''}
            onChange={e => handleChange(selectedDay, 'BREAKFAST', e.target.value)}
          />
        </div>

        {/* Lunch Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/60">
            <Sun size={15} className="text-brand-400" />
            <label className="text-xs font-semibold">Lunch Menu Items</label>
          </div>
          <input
            className="input-field"
            placeholder="e.g. Dal Fry, Mix Veg, Rice, Roti, Salad"
            value={currentDayMenu.LUNCH || ''}
            onChange={e => handleChange(selectedDay, 'LUNCH', e.target.value)}
          />
        </div>

        {/* Dinner Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/60">
            <Moon size={15} className="text-purple-400" />
            <label className="text-xs font-semibold">Dinner Menu Items</label>
          </div>
          <input
            className="input-field"
            placeholder="e.g. Paneer Masala, Paratha, Rice, Dal"
            value={currentDayMenu.DINNER || ''}
            onChange={e => handleChange(selectedDay, 'DINNER', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
