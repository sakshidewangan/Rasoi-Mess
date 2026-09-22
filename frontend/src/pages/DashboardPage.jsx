import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  UtensilsCrossed, Users,
  ArrowRight, Coffee, Sun, Moon, CalendarDays,
  ChevronDown, ChevronUp, Search, Check, X, MapPinned, ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, label, value, sub, color = 'brand', to, onClick }) {
  const colorMap = {
    brand:  'from-brand-500/20 to-brand-700/10 border-brand-500/20 text-brand-400',
    green:  'from-green-500/20 to-green-700/10 border-green-500/20 text-green-400',
    red:    'from-red-500/20 to-red-700/10 border-red-500/20 text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-700/10 border-yellow-500/20 text-yellow-400',
  };
  const inner = (
    <div 
      onClick={onClick}
      className={`card card-hover p-4 bg-gradient-to-br ${colorMap[color]} cursor-pointer`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl bg-current/10`}>
          <Icon size={18} className="text-current" />
        </div>
        {(to || onClick) && <ArrowRight size={14} className="text-current opacity-50 mt-1" />}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-xs font-medium text-current mt-1">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function KitchenCard({ icon: Icon, label, count, onClick, status, isOwner, cutoff }) {
  return (
    <button
      onClick={onClick}
      className="card card-hover p-4 flex items-center gap-4 text-left w-full cursor-pointer border border-white/5"
    >
      <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
        <Icon size={22} className="text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-white/40">{label} today</p>
          <span className="text-[10px] text-brand-400/80 font-medium">Cutoff: {cutoff}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          {!isOwner ? (
            status === 'SKIPPED' ? (
              <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                SKIPPING
              </span>
            ) : (
              <span className="text-[10px] text-green-500/80 font-medium flex items-center gap-1">
                Active Selection
              </span>
            )
          ) : (
            <p className="text-xl font-bold text-white">{count}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function LeavesModal({ onClose }) {
  const [data, setData] = useState({ today: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStudent, setExpandedStudent] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/calendar/leaves/summary')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load summary'))
      .finally(() => setLoading(false));
  }, []);

  const activeList = data.today || [];

  const filteredData = activeList.filter(record => {
    const nameMatch = record.student_name ? record.student_name.toLowerCase().includes(search.toLowerCase()) : false;
    const roomMatch = record.student_room ? String(record.student_room).includes(search) : false;
    const mobileMatch = record.student_mobile ? String(record.student_mobile).includes(search) : false;
    return nameMatch || roomMatch || mobileMatch;
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-white/10 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Unavailable Log
            </h3>
            <p className="text-xs text-white/40 mt-0.5">Showing today's unavailable students (leaves & student skips)</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl font-bold">×</button>
        </div>

        {/* Search */}
        <div className="p-4 bg-surface-900/40 border-b border-white/5">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="input-field text-xs py-2"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by name or room..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : filteredData.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-8">No matching records found</p>
          ) : (
            // Today list: expand/collapse arrow layout showing only unavailable meals today
            filteredData.map(record => {
              const isExpanded = expandedStudent === record.student_id;
              return (
                <div key={record.student_id} className="border border-white/5 bg-white/5 rounded-xl overflow-hidden transition-all duration-200">
                  <div 
                    onClick={() => setExpandedStudent(isExpanded ? null : record.student_id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{record.student_name}</h4>
                      <p className="text-[11px] text-white/40 mt-0.5">Room {record.student_room || 'N/A'} · {record.student_mobile || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          navigate(`/calendar/${record.student_id}`);
                        }}
                        className="text-[10px] text-brand-400 hover:underline cursor-pointer font-bold"
                      >
                        Calendar
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-black/20 p-4 border-t border-white/5 space-y-2 text-xs text-left">
                      {[
                        { label: 'Breakfast', key: 'breakfast' },
                        { label: 'Lunch', key: 'lunch' },
                        { label: 'Dinner', key: 'dinner' }
                      ]
                        .filter(meal => record[meal.key].unavailable)
                        .map(meal => {
                          const mealInfo = record[meal.key];
                          return (
                            <div key={meal.key} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-b-0">
                              <span className="font-semibold text-white/80">{meal.label}</span>
                              <div className="text-right">
                                <span className="text-red-400 font-semibold">Unavailable</span>
                                <p className="text-[10px] text-white/40 mt-0.5">Reason: {mealInfo.reason}</p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-2 cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isOwner } = useAuth();
  const [data, setData] = useState(null);
  const [menu, setMenu] = useState([]);
  const [selectedMenuMeal, setSelectedMenuMeal] = useState(null);
  const [selectedDeliveryMeal, setSelectedDeliveryMeal] = useState(null);
  const [showConfirmSkip, setShowConfirmSkip] = useState(null);
  const [skipReason, setSkipReason] = useState('');
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const navigate = useNavigate(); // Need to import or define useNavigate for redirection inside the parent component

  useEffect(() => {
    Promise.all([
      api.get('/settings/dashboard'),
      api.get('/menu')
    ]).then(([dRes, mRes]) => {
      setData(dRes.data);
      setMenu(mRes.data);
    })
    .catch(() => toast.error('Failed to load dashboard data'))
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const today = format(new Date(), 'd MMMM yyyy');
  const todayDayName = format(new Date(), 'EEEE'); // "Monday", "Tuesday", etc.

  const getTodayMenu = (meal) => {
    const item = menu.find(
      m => m.day_of_week.toLowerCase() === todayDayName.toLowerCase() && m.meal_type.toUpperCase() === meal.toUpperCase()
    );
    return item ? item.items : 'No menu set for today.';
  };

  const getStudentSelectionForMeal = (mealType) => {
    if (!data?.studentTodayMeals) return 'SCHEDULED';
    const record = data.studentTodayMeals.find(m => m.meal_type.toUpperCase() === mealType.toUpperCase());
    return record ? record.status : 'SCHEDULED';
  };

  const isBeforeCutoff = (mealType) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeVal = hours * 100 + minutes;
    if (mealType === 'BREAKFAST') return timeVal < 800;
    if (mealType === 'LUNCH') return timeVal < 1200;
    if (mealType === 'DINNER') return timeVal < 1800;
    return false;
  };

  const isMealLocked = (mealType) => {
    if (!isBeforeCutoff(mealType)) return true;
    if (!data?.studentTodayMeals) return false;
    const record = data.studentTodayMeals.find(m => m.meal_type.toUpperCase() === mealType.toUpperCase());
    return record ? !!record.is_locked : false;
  };

  const handleToggleTodaySelection = async (mealType, status, reason = '') => {
    setSavingToggle(true);
    try {
      await api.put('/calendar/today-toggle', { meal_type: mealType, status, reason });
      toast.success('Selection updated successfully!');
      const res = await api.get('/settings/dashboard');
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update selection');
    } finally {
      setSavingToggle(false);
    }
  };

  const handleCardClick = (mealLabel, mealType) => {
    if (isOwner) {
      setSelectedDeliveryMeal({ label: mealLabel, type: mealType });
    } else {
      const items = getTodayMenu(mealType);
      setSelectedMenuMeal({ meal_type: mealLabel, type: mealType, items });
    }
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KitchenCard 
            icon={Coffee} 
            label="Breakfast" 
            count={data?.kitchenSummary?.BREAKFAST ?? 0} 
            onClick={() => handleCardClick('Breakfast', 'BREAKFAST')}
            status={getStudentSelectionForMeal('BREAKFAST')}
            isOwner={isOwner}
            cutoff="8:00 AM"
          />
          <KitchenCard 
            icon={Sun}    
            label="Lunch"     
            count={data?.kitchenSummary?.LUNCH ?? 0} 
            onClick={() => handleCardClick('Lunch', 'LUNCH')}
            status={getStudentSelectionForMeal('LUNCH')}
            isOwner={isOwner}
            cutoff="12:00 PM"
          />
          <KitchenCard 
            icon={Moon}   
            label="Dinner"    
            count={data?.kitchenSummary?.DINNER ?? 0} 
            onClick={() => handleCardClick('Dinner', 'DINNER')}
            status={getStudentSelectionForMeal('DINNER')}
            isOwner={isOwner}
            cutoff="6:00 PM"
          />
        </div>
      </section>

      {/* Stats Grid */}
      <section>
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">Overview</h2>
        <div className="grid grid-cols-2 gap-3">
          {isOwner && (
            <StatCard
              icon={Users} label="Active Students" color="green"
              value={data?.activeStudents ?? 0}
              to="/students"
            />
          )}
          <StatCard
            icon={CalendarDays}
            label={isOwner ? "Unavailable Today" : "Meal Status Overview"}
            color="yellow"
            value={data?.studentsOnLeave ?? 0}
            sub={isOwner ? null : `${data?.studentsOnLeave ?? 0} meals missed`}
            onClick={isOwner ? () => setShowLeavesModal(true) : null}
            to={isOwner ? null : "/my-calendar"}
          />
        </div>
      </section>

      {/* Daily Menu Modal */}
      {selectedMenuMeal && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-4" 
          onClick={() => setSelectedMenuMeal(null)}
        >
          <div 
            className="bg-surface-800 border border-white/5 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                <UtensilsCrossed size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">
                  {selectedMenuMeal.meal_type} Menu
                </h3>
                <p className="text-xs text-white/40">{todayDayName}, {today}</p>
              </div>
            </div>
            
            <div className="h-[1px] bg-white/5 my-3" />
            
            <div className="py-2">
              <p className="text-white/90 text-sm font-medium leading-relaxed bg-surface-950 p-4 rounded-xl border border-white/5">
                {selectedMenuMeal.items || 'No menu set for today.'}
              </p>
            </div>
            
            {!isOwner && (
              <div className="mt-4 space-y-3 bg-surface-950/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>My Selection for Today</span>
                  {isMealLocked(selectedMenuMeal.type) ? (
                    <span className="text-red-400 font-semibold flex items-center gap-1 text-[9px]">
                      🔒 Locked {getStudentSelectionForMeal(selectedMenuMeal.type) === 'SKIPPED' ? '(Confirmed Skip)' : `(Passed ${selectedMenuMeal.type === 'BREAKFAST' ? '8:00 AM' : selectedMenuMeal.type === 'LUNCH' ? '12:00 PM' : '6:00 PM'})`}
                    </span>
                  ) : (
                    <span className="text-brand-400">Cutoff: {selectedMenuMeal.type === 'BREAKFAST' ? '8:00 AM' : selectedMenuMeal.type === 'LUNCH' ? '12:00 PM' : '6:00 PM'}</span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    disabled={isMealLocked(selectedMenuMeal.type) || savingToggle}
                    onClick={() => setShowConfirmSkip(selectedMenuMeal.type)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center justify-center flex items-center gap-2 ${
                      getStudentSelectionForMeal(selectedMenuMeal.type) === 'SKIPPED'
                        ? 'border-red-500 bg-red-500/20 text-red-400 font-bold'
                        : isMealLocked(selectedMenuMeal.type)
                          ? 'border-white/5 bg-white/5 text-white/20'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {getStudentSelectionForMeal(selectedMenuMeal.type) === 'SKIPPED' ? '🔴 Skipped today' : 'Skip Meal'}
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={() => setSelectedMenuMeal(null)} 
              className="btn-secondary w-full justify-center mt-4 text-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Skip Confirmation Modal */}
      {showConfirmSkip && (
        <div 
          className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setShowConfirmSkip(null);
            setSkipReason('');
          }}
        >
          <div 
            className="bg-surface-800 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            
            <h3 className="font-bold text-white text-lg mb-2">
              Are you sure to skip the meal?
            </h3>
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              Once skipped, this meal selection will be locked for today. You cannot undo this change.
            </p>

            <input
              type="text"
              placeholder="Reason for skipping (optional)..."
              className="input-field text-xs py-2.5 mb-5 w-full text-left bg-surface-900 border-white/10"
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowConfirmSkip(null);
                  setSkipReason('');
                }}
                className="btn-secondary flex-1 justify-center text-xs cursor-pointer py-2.5"
              >
                No, cancel
              </button>
              <button 
                onClick={async () => {
                  const meal = showConfirmSkip;
                  const reasonText = skipReason;
                  setShowConfirmSkip(null);
                  setSkipReason('');
                  await handleToggleTodaySelection(meal, 'SKIPPED', reasonText);
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex-1 justify-center cursor-pointer transition-colors"
              >
                Yes, skip meal
              </button>
            </div>
          </div>
        </div>
      )}
      {showLeavesModal && (
        <LeavesModal onClose={() => setShowLeavesModal(false)} />
      )}
      {selectedDeliveryMeal && (
        <DeliveryManagementModal 
          meal={selectedDeliveryMeal} 
          onClose={() => {
            setSelectedDeliveryMeal(null);
            api.get('/settings/dashboard').then(res => setData(res.data));
          }} 
        />
      )}
    </div>
  );
}

function DeliveryManagementModal({ meal, onClose }) {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending'); // 'pending' or 'completed'
  const [markingId, setMarkingId] = useState(null);

  useEffect(() => {
    api.get('/zones')
      .then(res => setZones(res.data))
      .catch(() => toast.error('Failed to load delivery zones'))
      .finally(() => setZonesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedZone) return;
    setLoading(true);
    api.get(`/calendar/delivery/list/${meal.type}?zone_id=${selectedZone.id}`)
      .then(res => setStudents(res.data))
      .catch(() => toast.error('Failed to load delivery list'))
      .finally(() => setLoading(false));
  }, [meal.type, selectedZone]);

  const handleStatusUpdate = async (studentId, status) => {
    setMarkingId(studentId);
    try {
      await api.put('/calendar/delivery/status', {
        student_id: studentId,
        meal_type: meal.type,
        status: status
      });
      setStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, status } : s));
      toast.success(`Marked as ${status === 'SERVED' ? 'Delivered' : 'Not Delivered'}`);
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setMarkingId(null);
    }
  };

  const filtered = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const pending = filtered.filter(s => s.status === 'SCHEDULED');
  const completed = filtered.filter(s => s.status === 'SERVED' || s.status === 'CANCELLED' || s.status === 'SKIPPED');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-white/10 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
              {selectedZone ? `${meal.label} Delivery — ${selectedZone.name}` : `${meal.label} Delivery Zones`}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">{selectedZone ? "Mark today's meal delivery checklist" : 'Choose an area to start delivery'}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedZone && <button onClick={() => { setSelectedZone(null); setStudents([]); setSearch(''); setTab('pending'); }} className="p-1 text-white/40 hover:text-white" title="All zones"><ChevronLeft size={19} /></button>}
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl font-bold">×</button>
          </div>
        </div>

        {selectedZone && <div className="p-4 bg-surface-900/40 border-b border-white/5 flex flex-col gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="input-field text-xs py-2"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search student..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-surface-950 rounded-xl border border-white/5">
            <button
              onClick={() => setTab('pending')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'pending'
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Pending ({pending.length})
            </button>
            <button
              onClick={() => setTab('completed')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === 'completed'
                  ? 'bg-brand-500 text-white shadow'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Completed ({completed.length})
            </button>
          </div>
        </div>}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!selectedZone ? (zonesLoading ? (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" /></div>
          ) : zones.length === 0 ? (
            <div className="text-center py-10 text-white/35"><MapPinned size={30} className="mx-auto mb-3 opacity-50" /><p className="text-sm">No delivery zones created</p><p className="text-xs mt-1">Create a zone and assign students before dispatching meals.</p></div>
          ) : zones.map(zone => (
            <button key={zone.id} onClick={() => setSelectedZone(zone)} className="w-full flex items-center gap-3 text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-brand-500/10 hover:border-brand-500/25 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center"><MapPinned size={18} /></div>
              <div className="flex-1 min-w-0"><p className="font-semibold text-white text-sm">{zone.name}</p><p className="text-xs text-white/40 truncate mt-0.5">{zone.description || 'No delivery notes'}</p></div><span className="text-xs text-brand-400 font-semibold">{zone.student_count} students</span>
            </button>
          ))) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (tab === 'pending' ? pending : completed).length === 0 ? (
            <p className="text-center text-white/30 text-xs py-8">No students found</p>
          ) : (
            (tab === 'pending' ? pending : completed).map(s => (
              <div key={s.student_id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5">
                <span className="font-bold text-white text-sm">{s.name}</span>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {s.status === 'SKIPPED' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      Skipped
                    </span>
                  ) : s.status === 'SCHEDULED' ? (
                    <>
                      <button
                        disabled={markingId === s.student_id}
                        onClick={() => handleStatusUpdate(s.student_id, 'CANCELLED')}
                        className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                        title="Not Delivered"
                      >
                        <X size={14} />
                      </button>
                      <button
                        disabled={markingId === s.student_id}
                        onClick={() => handleStatusUpdate(s.student_id, 'SERVED')}
                        className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 flex items-center justify-center cursor-pointer transition-colors"
                        title="Delivered"
                      >
                        <Check size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      {s.status === 'SERVED' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          Delivered
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          Not Delivered
                        </span>
                      )}
                      <button
                        disabled={markingId === s.student_id}
                        onClick={() => handleStatusUpdate(s.student_id, s.status === 'SERVED' ? 'CANCELLED' : 'SERVED')}
                        className="text-[10px] text-brand-400 hover:underline cursor-pointer font-semibold"
                      >
                        Change Status
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
