import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import {
  ArrowLeft, Phone, Home, Calendar, CreditCard, Clock,
  FileText, Shield, Sparkles, CheckCircle, Ban, HelpCircle, Utensils
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  ACTIVE:   { cls: 'badge-green',  label: 'Active' },
  BLOCKED:  { cls: 'badge-red',    label: 'Blocked' },
  INACTIVE: { cls: 'badge-gray',   label: 'Inactive' },
};

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/students/${id}`),
      api.get(`/leaves/${id}`),
      api.get(`/payments/${id}`)
    ]).then(([sRes, lRes, pRes]) => {
      setStudent(sRes.data);
      setLeaves(lRes.data);
      setPayments(pRes.data);
    }).catch(() => {
      toast.error('Failed to load profile details');
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-6 text-center text-white/40">
        <HelpCircle size={48} className="mx-auto mb-2 opacity-30" />
        <p>Student profile not found</p>
      </div>
    );
  }

  const badge = STATUS_BADGE[student.status] || STATUS_BADGE.INACTIVE;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white">Student Profile</h1>
      </div>

      {/* Main card */}
      <div className="card p-5 space-y-4 bg-gradient-to-br from-surface-800 to-surface-900 border-white/5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand-900/20">
            {student.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">{student.name}</h2>
              <span className={`badge ${badge.cls}`}>{badge.label}</span>
            </div>
            <p className="text-xs text-white/40 mt-1">{student.college || 'No college listed'} · Session {student.academic_session}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-white/60">
              <span className="flex items-center gap-1.5"><Phone size={13} className="text-white/30" /> {student.mobile}</span>
              <span className="flex items-center gap-1.5"><Home size={13} className="text-white/30" /> Room {student.room_number || 'N/A'}, {student.hostel || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link to={`/calendar/${student.id}`} className="btn-secondary justify-center text-xs">
            <Calendar size={14} className="text-brand-400" /> View Meal Calendar
          </Link>
          <Link to={`/billing/${student.id}`} className="btn-secondary justify-center text-xs">
            <CreditCard size={14} className="text-green-400" /> View Bills & Payments
          </Link>
        </div>
      </div>

      {/* Details list */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Account Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-white/40 text-xs">Current Balance</p>
            <p className={`font-bold mt-0.5 ${parseFloat(student.current_balance) > 0 ? 'text-red-400' : 'text-green-400'}`}>
              ₹{parseFloat(student.current_balance).toLocaleString('en-IN')}
              {parseFloat(student.current_balance) > 0 ? ' (Due)' : ' (Advance)'}
            </p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Credit Limit</p>
            <p className="text-white font-semibold mt-0.5">₹{parseFloat(student.credit_limit).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Joining Date</p>
            <p className="text-white font-medium mt-0.5">{format(new Date(student.joining_date), 'd MMMM yyyy')}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Veg/Non-Veg</p>
            <p className="text-white font-medium mt-0.5">{student.veg_status === 'VEG' ? '🥦 Vegetarian' : '🍗 Non-Vegetarian'}</p>
          </div>
          {student.guardian_mobile && (
            <div className="col-span-2">
              <p className="text-white/40 text-xs">Guardian Mobile</p>
              <p className="text-white font-medium mt-0.5">{student.guardian_mobile}</p>
            </div>
          )}
        </div>
      </div>

      {/* Leaves / Pauses Timeline */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Leave History</h3>
        <div className="space-y-2">
          {leaves.length === 0 ? (
            <p className="text-xs text-white/30 py-2">No leave records registered</p>
          ) : (
            leaves.map(l => (
              <div key={l.id} className="p-3 bg-surface-800 rounded-xl flex items-start justify-between gap-3 text-xs border border-white/5">
                <div>
                  <p className="font-semibold text-white">
                    {format(new Date(l.start_date), 'd MMM')} – {format(new Date(l.end_date), 'd MMM yyyy')}
                  </p>
                  <p className="text-white/40 mt-1">Reason: {l.reason || 'None provided'}</p>
                </div>
                <div className="flex gap-1">
                  {l.skip_breakfast && <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold text-[9px]">B</span>}
                  {l.skip_lunch && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold text-[9px]">L</span>}
                  {l.skip_dinner && <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[9px]">D</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Recent Transactions</h3>
        <div className="divide-y divide-white/5">
          {payments.length === 0 ? (
            <p className="text-xs text-white/30 py-2">No transaction records found</p>
          ) : (
            payments.slice(0, 5).map(p => (
              <div key={p.id} className="flex justify-between py-2.5 text-xs first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-white">{p.receipt_number}</p>
                  <p className="text-white/30 mt-0.5">{format(new Date(p.payment_date), 'd MMM yyyy')} · {p.payment_mode}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-400">+₹{parseFloat(p.amount).toLocaleString('en-IN')}</p>
                  {p.remarks && <p className="text-white/20 mt-0.5 truncate max-w-[120px]">{p.remarks}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
