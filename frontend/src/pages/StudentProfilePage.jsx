import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Phone, Home, Calendar, Clock,
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
  const { isOwner } = useAuth();
  const [student, setStudent] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchStudentData = () => {
    return Promise.all([
      api.get(`/students/${id}`),
      api.get(`/leaves/${id}`)
    ]).then(([sRes, lRes]) => {
      setStudent(sRes.data);
      setLeaves(lRes.data);
    }).catch(() => {
      toast.error('Failed to load profile details');
    });
  };

  useEffect(() => {
    fetchStudentData().finally(() => setLoading(false));
  }, [id]);

  const handleDeactivate = async () => {
    setStatusUpdating(true);
    try {
      await api.patch(`/students/${id}/status`, { status: 'INACTIVE' });
      toast.success('Student deactivated successfully');
      setShowDeactivateModal(false);
      await fetchStudentData();
    } catch {
      toast.error('Failed to deactivate student');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleReactivate = async () => {
    setStatusUpdating(true);
    try {
      await api.patch(`/students/${id}/status`, { status: 'ACTIVE' });
      toast.success('Student reactivated successfully');
      setShowReactivateModal(false);
      await fetchStudentData();
    } catch {
      toast.error('Failed to reactivate student');
    } finally {
      setStatusUpdating(false);
    }
  };

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
        <div className="pt-2">
          <Link to={`/calendar/${student.id}`} className="btn-secondary justify-center text-xs w-full">
            <Calendar size={14} className="text-brand-400" /> View Meal Calendar
          </Link>



        </div>
      </div>

      {/* Details list */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Account Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">


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

      {/* Leaves / Pauses Timeline (Merged Leave History) */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Leave History</h3>
        <div className="space-y-2">
          {leaves.length === 0 ? (
            <p className="text-xs text-white/30 py-2">No leave records registered</p>
          ) : (
            leaves.map(l => {
              const isSingleDay = l.start_date === l.end_date;
              const dateStr = isSingleDay
                ? format(new Date(l.start_date.replace(/-/g, '/')), 'd MMM yyyy')
                : `${format(new Date(l.start_date.replace(/-/g, '/')), 'd MMM')} – ${format(new Date(l.end_date.replace(/-/g, '/')), 'd MMM yyyy')}`;

              return (
                <div key={l.id} className="p-3 bg-surface-800 rounded-xl flex items-start justify-between gap-3 text-xs border border-white/5">
                  <div>
                    <p className="font-semibold text-white">{dateStr}</p>
                    <p className="text-white/40 mt-1">Reason: {l.reason || 'on leave'}</p>
                  </div>
                  <div className="flex gap-1">
                    {l.skip_breakfast && <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold text-[9px]">B</span>}
                    {l.skip_lunch && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold text-[9px]">L</span>}
                    {l.skip_dinner && <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold text-[9px]">D</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Deactivate/Reactivate Button */}
      {isOwner && (
        student.status === 'INACTIVE' ? (
          <button
            onClick={() => setShowReactivateModal(true)}
            className="w-full btn-secondary text-green-400 hover:bg-green-500/10 border-green-500/20 py-3 font-semibold rounded-xl text-sm transition-all shadow-md mt-4 justify-center flex items-center gap-2 cursor-pointer"
          >
            Reactivate Student
          </button>
        ) : (
          <button
            onClick={() => setShowDeactivateModal(true)}
            className="w-full btn-secondary text-red-400 hover:bg-red-500/10 border-red-500/20 py-3 font-semibold rounded-xl text-sm transition-all shadow-md mt-4 justify-center flex items-center gap-2 cursor-pointer"
          >
            Deactivate Student
          </button>
        )
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4" onClick={() => setShowDeactivateModal(false)}>
          <div className="bg-surface-800 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Ban size={24} className="text-red-500" />
            </div>
            
            <h3 className="font-bold text-white text-lg mb-2">
              Deactivate Student?
            </h3>
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              Are you sure you want to deactivate this student?
            </p>
            <p className="text-[11px] text-white/40 mb-6 leading-relaxed text-left bg-white/5 p-3 rounded-xl border border-white/5">
              The student will no longer appear in active operations such as meal delivery, kitchen sheets, dashboard counts, or active student lists.
              <br /><br />
              All previous records including profile information, delivery history, leave history, reports, and calendar history will be safely preserved.
              <br /><br />
              The student can be reactivated at any time.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeactivateModal(false)}
                className="btn-secondary flex-1 justify-center text-xs cursor-pointer py-2.5"
              >
                Cancel
              </button>
              <button 
                disabled={statusUpdating}
                onClick={handleDeactivate}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex-1 justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                {statusUpdating ? 'Deactivating...' : 'Deactivate Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Confirmation Modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4" onClick={() => setShowReactivateModal(false)}>
          <div className="bg-surface-800 border border-green-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-4 border border-green-500/20">
              <CheckCircle size={24} className="text-green-500" />
            </div>
            
            <h3 className="font-bold text-white text-lg mb-2">
              Reactivate Student?
            </h3>
            <p className="text-xs text-white/40 mb-6 leading-relaxed">
              Are you sure you want to reactivate this student? They will immediately be included in active counts and operational meal delivery workflows.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowReactivateModal(false)}
                className="btn-secondary flex-1 justify-center text-xs cursor-pointer py-2.5"
              >
                Cancel
              </button>
              <button 
                disabled={statusUpdating}
                onClick={handleReactivate}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex-1 justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                {statusUpdating ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
