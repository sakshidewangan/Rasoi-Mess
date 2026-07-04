import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import {
  UserPlus, Search, Filter, Phone, Home, Coffee, Sun, Moon,
  MoreVertical, CheckCircle, XCircle, Clock, User
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  ACTIVE:   { cls: 'badge-green',  label: 'Active' },
  BLOCKED:  { cls: 'badge-red',    label: 'Blocked' },
  INACTIVE: { cls: 'badge-gray',   label: 'Inactive' },
};

function StudentCard({ student, onStatusChange, isCalendarView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const badge = STATUS_BADGE[student.status] || STATUS_BADGE.INACTIVE;

  return (
    <div className="card card-hover p-4 relative">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/30 to-surface-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-base">
          {student.name?.[0]?.toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={isCalendarView ? `/calendar/${student.id}` : `/students/${student.id}`} className="font-semibold text-white hover:text-brand-400 transition-colors text-sm">
              {student.name}
            </Link>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {student.mobile && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Phone size={11} /> {student.mobile}
              </span>
            )}
            {student.room_number && (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Home size={11} /> Room {student.room_number}
              </span>
            )}
          </div>
          {/* Meal plan indicators */}
          <div className="flex items-center gap-1.5 mt-2">
            {[{ key: 'has_breakfast', icon: Coffee, label: 'B' },
              { key: 'has_lunch',     icon: Sun,    label: 'L' },
              { key: 'has_dinner',    icon: Moon,   label: 'D' }].map(({ key, label }) => (
              <span
                key={key}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  student[key] ? 'bg-brand-500/20 text-brand-400' : 'bg-white/5 text-white/20'
                }`}
              >
                {label}
              </span>
            ))}
            {student.current_balance > 0 && (
              <span className="ml-auto text-xs font-semibold text-red-400">
                Due: ₹{parseFloat(student.current_balance).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(p => !p)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 bg-surface-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1 min-w-[140px]">
              {['ACTIVE', 'BLOCKED', 'INACTIVE'].filter(s => s !== student.status).map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(student.id, s); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {s === 'ACTIVE' ? <CheckCircle size={13} className="text-green-400" /> :
                   s === 'BLOCKED' ? <XCircle size={13} className="text-red-400" /> :
                   <Clock size={13} className="text-gray-400" />}
                  Mark {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const navigate = useNavigate();
  const location = useLocation();
  const isCalendarView = location.pathname.startsWith('/calendar');

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);
    api.get(`/students?${params}`)
      .then(res => setStudents(res.data))
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(); }, [search, statusFilter]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/students/${id}/status`, { status });
      toast.success(`Student marked as ${status}`);
      fetchStudents();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">
          {isCalendarView ? 'Meal Calendar' : 'Students'}
        </h1>
        {!isCalendarView && (
          <button onClick={() => navigate('/students/add')} className="btn-primary">
            <UserPlus size={16} /> Add
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            className="input-field"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search name, phone, room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field cursor-pointer flex-shrink-0"
          style={{ width: '120px' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-white/30">{students.length} student{students.length !== 1 ? 's' : ''} found</p>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No students found</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {students.map(s => (
            <StudentCard key={s.id} student={s} onStatusChange={handleStatusChange} isCalendarView={isCalendarView} />
          ))}
        </div>
      )}
    </div>
  );
}
