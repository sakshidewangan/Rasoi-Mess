import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Coffee, Sun, Moon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function KitchenPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/calendar/kitchen/today')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load kitchen sheet'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const today = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Kitchen Sheet</h1>
          <p className="text-white/40 text-sm">{today}</p>
        </div>
        <button onClick={load} className="btn-secondary px-3" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-3">
        {[
          { icon: Coffee, label: 'Breakfast', key: 'BREAKFAST', gradient: 'from-amber-500/20 to-amber-700/10', border: 'border-amber-500/20', text: 'text-amber-400', time: '8:00 AM' },
          { icon: Sun,    label: 'Lunch',     key: 'LUNCH',     gradient: 'from-blue-500/20 to-blue-700/10',   border: 'border-blue-500/20',  text: 'text-blue-400',  time: '1:00 PM' },
          { icon: Moon,   label: 'Dinner',    key: 'DINNER',    gradient: 'from-indigo-500/20 to-indigo-700/10', border: 'border-indigo-500/20', text: 'text-indigo-400', time: '8:00 PM' },
        ].map(({ icon: Icon, label, key, gradient, border, text, time }) => (
          <div key={key} className={`card p-6 bg-gradient-to-br ${gradient} border ${border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center ${text}`}>
                  <Icon size={24} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{label}</p>
                  <p className={`text-xs ${text} opacity-70`}>{time}</p>
                </div>
              </div>
              <div className="text-right">
                {loading ? (
                  <div className="w-10 h-10 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  <>
                    <p className="text-5xl font-black text-white">{data?.[key] ?? 0}</p>
                    <p className="text-xs text-white/30 mt-1">servings</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4 text-center">
        <p className="text-xs text-white/30">Total meals today</p>
        <p className="text-3xl font-black text-white mt-1">
          {loading ? '—' : ((data?.BREAKFAST ?? 0) + (data?.LUNCH ?? 0) + (data?.DINNER ?? 0))}
        </p>
        <p className="text-xs text-white/20 mt-1">Students on leave are automatically excluded</p>
      </div>
    </div>
  );
}
