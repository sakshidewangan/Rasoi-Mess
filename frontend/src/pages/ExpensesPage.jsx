import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Plus, Trash2, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CATEGORIES = ['Milk', 'Vegetables', 'Rice', 'Dal', 'Gas', 'Oil', 'Salary', 'Electricity', 'Repairs', 'Miscellaneous'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  const load = () => {
    setLoading(true);
    api.get(`/expenses?month=${month}`)
      .then(res => setExpenses(res.data))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    toast.success('Deleted');
    load();
  };

  const total = expenses.reduce((a, e) => a + parseFloat(e.amount), 0);

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Expenses</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input className="input-field" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <div className="card px-4 py-2 flex items-center gap-2 whitespace-nowrap">
          <TrendingDown size={14} className="text-red-400" />
          <span className="text-sm font-bold text-white">₹{total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="card divide-y divide-white/5">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-center text-white/25 text-sm py-10">No expenses for this month</p>
        ) : expenses.map(e => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">{e.description || e.category}</p>
              <p className="text-xs text-white/30">{e.category} · {format(new Date(e.expense_date), 'd MMM')}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-red-400">₹{parseFloat(e.amount).toLocaleString('en-IN')}</p>
              <button onClick={() => handleDelete(e.id)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddExpenseModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Milk', description: '', amount: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense added');
      onSuccess();
    } catch {
      toast.error('Failed to add');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white mb-4">Add Expense</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Date</label>
            <input className="input-field" type="date" value={form.expense_date} onChange={e => setForm(p => ({...p, expense_date: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input-field cursor-pointer" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input-field" placeholder="Optional details" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input className="input-field" type="number" inputMode="decimal" placeholder="0" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} required />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
