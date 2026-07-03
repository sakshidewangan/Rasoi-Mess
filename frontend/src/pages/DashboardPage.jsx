import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  UtensilsCrossed, Users, AlertCircle, TrendingDown,
  CreditCard, ArrowRight, Coffee, Sun, Moon, CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, sub, color = 'brand', to }) {
  const colorMap = {
    brand:  'from-brand-500/20 to-brand-700/10 border-brand-500/20 text-brand-400',
    green:  'from-green-500/20 to-green-700/10 border-green-500/20 text-green-400',
    red:    'from-red-500/20 to-red-700/10 border-red-500/20 text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-700/10 border-yellow-500/20 text-yellow-400',
  };
  const inner = (
    <div className={`card card-hover p-4 bg-gradient-to-br ${colorMap[color]} cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl bg-current/10`}>
          <Icon size={18} className="text-current" />
        </div>
        {to && <ArrowRight size={14} className="text-current opacity-50 mt-1" />}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-xs font-medium text-current mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function KitchenCard({ icon: Icon, label, count }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
        <Icon size={22} className="text-brand-400" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{count}</p>
        <p className="text-xs text-white/40">{label} today</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings/dashboard')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const today = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">{today}</p>
      </div>

      {/* Kitchen Summary */}
      <section>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
          Today's Kitchen
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <KitchenCard icon={Coffee} label="Breakfast" count={data?.kitchenSummary?.BREAKFAST ?? 0} />
          <KitchenCard icon={Sun}    label="Lunch"     count={data?.kitchenSummary?.LUNCH ?? 0} />
          <KitchenCard icon={Moon}   label="Dinner"    count={data?.kitchenSummary?.DINNER ?? 0} />
        </div>
      </section>

      {/* Stats Grid */}
      <section>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Users} label="Active Students" color="green"
            value={data?.activeStudents ?? 0}
            to="/students"
          />
          <StatCard
            icon={CalendarDays} label="On Leave Today" color="yellow"
            value={data?.studentsOnLeave ?? 0}
            to="/calendar"
          />
          <StatCard
            icon={AlertCircle} label="Pending Dues" color="red"
            value={`₹${data?.pendingDues?.total?.toLocaleString('en-IN') ?? 0}`}
            sub={`${data?.pendingDues?.count ?? 0} students`}
            to="/billing"
          />
          <StatCard
            icon={TrendingDown} label="Today's Expenses" color="brand"
            value={`₹${data?.todayExpenses?.toLocaleString('en-IN') ?? 0}`}
            to="/expenses"
          />
        </div>
      </section>

      {/* Recent Payments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Recent Payments</h2>
          <Link to="/payments" className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="card divide-y divide-white/5">
          {data?.recentPayments?.length === 0 && (
            <p className="text-white/30 text-sm px-4 py-6 text-center">No payments recorded yet</p>
          )}
          {data?.recentPayments?.map(p => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">{p.student_name}</p>
                <p className="text-xs text-white/30">{format(new Date(p.payment_date), 'd MMM yyyy')} · {p.payment_mode}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-400">+₹{parseFloat(p.amount).toLocaleString('en-IN')}</p>
                <p className="text-xs text-white/25">{p.receipt_number}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
