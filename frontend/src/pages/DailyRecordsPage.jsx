import { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { format, addDays, subDays } from 'date-fns';
import {
  Coffee, Sun, Moon, Calendar, ChevronLeft, ChevronRight,
  Search, ArrowRight, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function DailyRecordsPage() {
  const [date, setDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDetails, setSelectedDetails] = useState(null); // { meal, type, students }

  const dateStr = format(date, 'yyyy-MM-dd');

  const fetchRecords = () => {
    setLoading(true);
    api.get(`/calendar/daily-records?date=${dateStr}`)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load daily records'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
  }, [dateStr]);

  const handlePrevDay = () => setDate(prev => subDays(prev, 1));
  const handleNextDay = () => setDate(prev => addDays(prev, 1));
  const handleToday = () => setDate(new Date());

  const handleStatusToggleInModal = async (studentId, mealType, currentStatus) => {
    const nextStatus = currentStatus === 'SERVED' ? 'CANCELLED' : 'SERVED';
    try {
      await api.put('/calendar/delivery/status', {
        student_id: studentId,
        meal_type: mealType,
        status: nextStatus,
        date: dateStr
      });
      toast.success('Status updated successfully!');
      
      // Update local state to instantly reflect in circles and lists
      setData(prev => {
        const nextData = JSON.parse(JSON.stringify(prev));
        const meal = mealType.toUpperCase();
        
        // Find student in current list
        let foundStudent = null;
        if (currentStatus === 'SERVED') {
          const idx = nextData[meal].served.findIndex(s => s.id === studentId);
          if (idx > -1) {
            foundStudent = nextData[meal].served.splice(idx, 1)[0];
            if (foundStudent) {
              foundStudent.status = 'CANCELLED';
              nextData[meal].not_delivered.push(foundStudent);
            }
          }
        } else {
          const idx = nextData[meal].not_delivered.findIndex(s => s.id === studentId);
          if (idx > -1) {
            foundStudent = nextData[meal].not_delivered.splice(idx, 1)[0];
            if (foundStudent) {
              foundStudent.status = 'SERVED';
              nextData[meal].served.push(foundStudent);
            }
          }
        }
        
        // Update selected modal details state in real-time
        if (selectedDetails) {
          setSelectedDetails(prevDetails => {
            const isServedType = prevDetails.type === 'served';
            const studentsCopy = [...prevDetails.students];
            
            if (isServedType && currentStatus === 'SERVED') {
              // Remove from served list
              return {
                ...prevDetails,
                students: studentsCopy.filter(s => s.id !== studentId)
              };
            } else if (!isServedType && currentStatus !== 'SERVED') {
              // Remove from not_delivered list
              return {
                ...prevDetails,
                students: studentsCopy.filter(s => s.id !== studentId)
              };
            }
            return prevDetails;
          });
        }

        return nextData;
      });

    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const sections = [
    { label: 'Breakfast', type: 'BREAKFAST', icon: Coffee },
    { label: 'Lunch',     type: 'LUNCH',     icon: Sun },
    { label: 'Dinner',    type: 'DINNER',    icon: Moon }
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header & Date Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Daily Records</h1>
          <p className="text-white/40 text-xs mt-1">Delivery summary & dispatch history</p>
        </div>
        
        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-surface-900 border border-white/5 p-1.5 rounded-xl self-start">
          <button 
            onClick={handlePrevDay} 
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-white">
            <Calendar size={14} className="text-brand-400" />
            <span>{format(date, 'd MMMM yyyy')}</span>
          </div>

          <button 
            onClick={handleNextDay} 
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>

          <div className="w-[1px] bg-white/10 h-4 mx-1" />

          <button 
            onClick={handleToday} 
            className="text-[10px] px-2 py-1 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(section => {
            const group = data?.[section.type] || { served: [], not_delivered: [] };
            const Icon = section.icon;
            
            return (
              <div key={section.type} className="card p-6 bg-surface-800 border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                {/* Section Header */}
                <div className="flex items-center gap-3.5 text-brand-400 sm:w-1/4">
                  <Icon size={24} />
                  <h3 className="font-extrabold text-white text-lg">{section.label}</h3>
                </div>

                {/* Circles Container */}
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Not Delivered Circle */}
                  <div 
                    onClick={() => setSelectedDetails({
                      meal: section.label,
                      mealType: section.type,
                      type: 'not_delivered',
                      students: group.not_delivered
                    })}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-red-600 hover:bg-red-700 text-white cursor-pointer flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg border border-red-500/20"
                  >
                    <span className="text-2xl sm:text-3xl font-black leading-none">
                      {group.not_delivered.length}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider mt-1.5 opacity-90">Not Delivered</span>
                  </div>

                  {/* Served Circle */}
                  <div 
                    onClick={() => setSelectedDetails({
                      meal: section.label,
                      mealType: section.type,
                      type: 'served',
                      students: group.served
                    })}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-green-600 hover:bg-green-700 text-white cursor-pointer flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg border border-green-500/20"
                  >
                    <span className="text-2xl sm:text-3xl font-black leading-none">
                      {group.served.length}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider mt-1.5 opacity-90">Served</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details list Overlay Modal */}
      {selectedDetails && (
        <DailyRecordsDetailModal
          details={selectedDetails}
          onClose={() => setSelectedDetails(null)}
          onToggle={(studentId, currentStatus) => handleStatusToggleInModal(studentId, selectedDetails.mealType, currentStatus)}
        />
      )}
    </div>
  );
}

function DailyRecordsDetailModal({ details, onClose, onToggle }) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const isServed = details.type === 'served';

  const filtered = details.students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-white/10 w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isServed ? 'bg-green-500' : 'bg-red-500'}`} />
              {details.meal} - {isServed ? 'Served' : 'Not Delivered'}
            </h3>
            <p className="text-[10px] text-white/40 mt-0.5">Showing {details.students.length} students</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl font-bold">×</button>
        </div>

        {/* Search */}
        <div className="p-4 bg-surface-900/40 border-b border-white/5">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="input-field text-xs py-2"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-6">No records found</p>
          ) : (
            filtered.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/students/${s.id}`);
                  }}
                  className="font-bold text-white hover:text-brand-400 text-sm flex items-center gap-2 cursor-pointer transition-colors text-left"
                >
                  <User size={14} className="text-white/40" />
                  <span>{s.name}</span>
                </button>
                
                {s.status === 'SKIPPED' ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    Skipped (User)
                  </span>
                ) : (
                  <button
                    onClick={() => onToggle(s.id, s.status)}
                    className="text-[10px] font-semibold text-brand-400 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    Change Status <ArrowRight size={10} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
