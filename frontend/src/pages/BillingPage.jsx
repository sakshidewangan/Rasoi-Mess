import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Plus, CreditCard, Lock } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function BillingPage() {
  const { id: studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [bill, setBill] = useState(null);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    Promise.all([
      api.get(`/students/${studentId}`),
      api.get(`/billing/${studentId}?month=${month}`)
    ]).then(([sRes, bRes]) => {
      setStudent(sRes.data);
      setBill(bRes.data);
    }).catch(() => toast.error('Failed to load billing'))
      .finally(() => setLoading(false));
  }, [studentId, month]);

  const handleClose = async () => {
    if (!confirm(`Close and freeze ${month} for ${student?.name}? This cannot be undone.`)) return;
    setClosing(true);
    try {
      await api.post(`/billing/${studentId}/close`, { month });
      toast.success(`Month ${month} closed!`);
      const res = await api.get(`/billing/${studentId}?month=${month}`);
      setBill(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close month');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">{student?.name}</h1>
          <p className="text-xs text-white/40">Billing & Payments</p>
        </div>
      </div>

      <input className="input-field" type="month" value={month} onChange={e => setMonth(e.target.value)} />

      {bill && (
        <>
          {/* Frozen badge */}
          {bill.is_locked && (
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-xl border border-brand-500/20 text-xs text-brand-400">
              <Lock size={13} /> Month closed — billing is frozen
            </div>
          )}

          {/* Bill breakdown */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Bill Breakdown</h2>
            {[
              ['Breakfast', 'breakfast', 'text-amber-400'],
              ['Lunch',     'lunch',     'text-blue-400'],
              ['Dinner',    'dinner',    'text-indigo-400'],
            ].map(([label, key, cls]) => {
              const taken   = bill[`${key}_taken`]   ?? 0;
              const skipped = bill[`${key}_skipped`] ?? 0;
              return (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <div>
                    <p className={`text-sm font-medium ${cls}`}>{label}</p>
                    <p className="text-xs text-white/30">{taken} served · {skipped} skipped</p>
                  </div>
                  <p className="text-sm font-bold text-white">
                    ₹{(bill[`${key}_amount`] ?? (taken * 0)).toLocaleString('en-IN')}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2">
              <p className="font-bold text-white">Total Bill</p>
              <p className="text-lg font-black text-white">₹{parseFloat(bill.total_bill_amount ?? 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Balance summary */}
          <div className="card p-4 space-y-2">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Balance</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-white/40">Opening Balance</span><span className="text-white">₹{parseFloat(bill.opening_balance ?? 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Meals Charged</span><span className="text-red-400">+₹{parseFloat(bill.total_bill_amount ?? 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Payments Received</span><span className="text-green-400">-₹{parseFloat(bill.total_paid ?? 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t border-white/5">
                <span className="text-white">Closing Balance</span>
                <span className={parseFloat(bill.closing_balance ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}>
                  ₹{parseFloat(bill.closing_balance ?? 0).toLocaleString('en-IN')}
                  {parseFloat(bill.closing_balance ?? 0) > 0 ? ' (Due)' : ' (Advance)'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!bill.is_locked && (
            <div className="flex gap-2">
              <button onClick={() => setShowPayment(true)} className="btn-primary flex-1 justify-center">
                <Plus size={16} /> Record Payment
              </button>
              <button onClick={handleClose} disabled={closing} className="btn-secondary px-4">
                {closing ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock size={16} />}
              </button>
            </div>
          )}
        </>
      )}

      {showPayment && (
        <PaymentModal studentId={studentId} onClose={() => setShowPayment(false)} onSuccess={async () => {
          setShowPayment(false);
          const res = await api.get(`/billing/${studentId}?month=${month}`);
          setBill(res.data);
        }} />
      )}
    </div>
  );
}

function PaymentModal({ studentId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_mode: 'CASH', remarks: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments', { ...form, student_id: parseInt(studentId), amount: parseFloat(form.amount) });
      toast.success('Payment recorded!');
      onSuccess();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-white mb-4">Record Payment</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Amount (₹) *</label>
            <input className="input-field" type="number" inputMode="decimal" placeholder="Enter amount" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input-field" type="date" value={form.payment_date} onChange={e => setForm(p => ({...p, payment_date: e.target.value}))} />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input-field cursor-pointer" value={form.payment_mode} onChange={e => setForm(p => ({...p, payment_mode: e.target.value}))}>
              <option value="CASH">💵 Cash</option>
              <option value="UPI">📱 UPI</option>
              <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="label">Remarks</label>
            <input className="input-field" placeholder="Optional note" value={form.remarks} onChange={e => setForm(p => ({...p, remarks: e.target.value}))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
