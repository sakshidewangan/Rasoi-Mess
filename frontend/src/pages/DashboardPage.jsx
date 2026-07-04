import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  UtensilsCrossed, Users, AlertCircle, TrendingDown,
  CreditCard, ArrowRight, Coffee, Sun, Moon, CalendarDays,
  ChevronDown, ChevronUp, Search
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
          <p className="text-[10px] text-brand-400 hover:underline">View Menu</p>
        </div>
      </div>
    </button>
  );
}

function LeavesModal({ onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStudent, setExpandedStudent] = useState(null);
  const navigate = useNavigate(); // For navigating to calendar from inside modal

  useEffect(() => {
    api.get('/calendar/leaves/summary')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load leaves summary'))
      .finally(() => setLoading(false));
  }, []);

  const filteredData = data.filter(student => {
    const nameMatch = student.name ? student.name.toLowerCase().includes(search.toLowerCase()) : false;
    const roomMatch = student.room_number ? String(student.room_number).includes(search) : false;
    const mobileMatch = student.mobile ? String(student.mobile).includes(search) : false;
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
              Leaves & Skips Log
            </h3>
            <p className="text-xs text-white/40 mt-0.5">Showing only students who have skipped meals or taken leaves</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl font-bold">×</button>
        </div>

        {/* Search */}
        <div className="p-4 bg-surface-900/40 border-b border-white/5 flex items-center gap-3">
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
            filteredData.map(student => {
              const isExpanded = expandedStudent === student.student_id;
              return (
                <div key={student.student_id} className="border border-white/5 bg-white/5 rounded-xl overflow-hidden transition-all duration-200">
                  <div 
                    onClick={() => setExpandedStudent(isExpanded ? null : student.student_id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{student.name}</h4>
                      <p className="text-[11px] text-white/40 mt-0.5">Room {student.room_number} · {student.mobile}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {student.skipped_count} skipped
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-black/20 p-3 border-t border-white/5 space-y-2">
                      <div className="divide-y divide-white/5 max-h-48 overflow-y-auto pr-1">
                        {student.skips.map((skip, idx) => {
                          const dateObj = new Date(skip.meal_date);
                          const formattedDate = format(dateObj, 'EEEE, d MMM yyyy');
                          return (
                            <div key={skip.meal_id || idx} className="flex justify-between items-center text-[11px] py-1.5 text-white/70">
                              <span>{formattedDate} · {skip.meal_type}</span>
                              <span className="text-red-400 font-medium">SKIPPED</span>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* View Calendar Button */}
                      <div className="pt-2 flex justify-end">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            navigate(`/calendar/${student.student_id}`);
                          }}
                          className="btn-secondary text-[10px] py-1 px-2.5 cursor-pointer"
                        >
                          View Full Calendar
                        </button>
                      </div>
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
  const [showConfirmSkip, setShowConfirmSkip] = useState(null);
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

  const handleToggleTodaySelection = async (mealType, status) => {
    setSavingToggle(true);
    try {
      await api.put('/calendar/today-toggle', { meal_type: mealType, status });
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
    const items = getTodayMenu(mealType);
    setSelectedMenuMeal({ meal_type: mealLabel, type: mealType, items });
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
        <div className={`grid grid-cols-2 ${isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
          {isOwner && (
            <StatCard
              icon={Users} label="Active Students" color="green"
              value={data?.activeStudents ?? 0}
              to="/students"
            />
          )}
          <StatCard
            icon={CalendarDays}
            label={isOwner ? "On Leave Today" : "Meal Status Overview"}
            color="yellow"
            value={data?.studentsOnLeave ?? 0}
            sub={isOwner ? null : `${data?.studentsOnLeave ?? 0} meals missed`}
            onClick={isOwner ? () => setShowLeavesModal(true) : null}
            to={isOwner ? null : "/my-calendar"}
          />
          <StatCard
            icon={AlertCircle}
            label="Pending Dues"
            color="red"
            value={`₹${data?.pendingDues?.total?.toLocaleString('en-IN') ?? 0}`}
            sub={isOwner ? `${data?.pendingDues?.count ?? 0} students` : "Your Current Balance"}
            to={isOwner ? "/billing" : "/my-balance"}
          />
          <StatCard
            icon={TrendingDown}
            label="Today's Expenses"
            color="brand"
            value={`₹${data?.todayExpenses?.toLocaleString('en-IN') ?? 0}`}
            to={isOwner ? "/expenses" : null}
          />
        </div>
      </section>

      {/* Recent Payments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Recent Payments</h2>
          {isOwner && (
            <Link to="/payments" className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          )}
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
          onClick={() => setShowConfirmSkip(null)}
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
            <p className="text-xs text-white/40 mb-6 leading-relaxed">
              Once skipped, this meal selection will be locked for today. You cannot undo this change.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmSkip(null)}
                className="btn-secondary flex-1 justify-center text-xs cursor-pointer py-2.5"
              >
                No, cancel
              </button>
              <button 
                onClick={async () => {
                  const meal = showConfirmSkip;
                  setShowConfirmSkip(null);
                  await handleToggleTodaySelection(meal, 'SKIPPED');
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
    </div>
  );
}
