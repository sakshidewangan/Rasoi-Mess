import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Search, Calendar, ChevronDown, ChevronUp, Phone, Home, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function LeavesOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedStudent, setExpandedStudent] = useState(null); // student_id of expanded details

  useEffect(() => {
    api.get('/calendar/leaves/summary')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load leaves summary'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (studentId) => {
    setExpandedStudent(prev => prev === studentId ? null : studentId);
  };

  const filteredData = data.filter(student => {
    const nameMatch = student.name ? student.name.toLowerCase().includes(search.toLowerCase()) : false;
    const roomMatch = student.room_number ? String(student.room_number).includes(search) : false;
    const mobileMatch = student.mobile ? String(student.mobile).includes(search) : false;
    return nameMatch || roomMatch || mobileMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="text-brand-400" size={24} />
            Leaves & Skips Overview
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Showing only students who have skipped meals or applied leaves.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xs w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30">
            <Search size={16} />
          </span>
          <input
            type="text"
            className="input-field text-xs"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by name or room..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Card */}
      <div className="card p-4 border border-brand-500/10 bg-gradient-to-b from-brand-950/10 to-transparent flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/70">Total Users on Leave</h3>
          <p className="text-xs text-white/40 mt-0.5">Active skip configurations</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-brand-400">{filteredData.length}</p>
          <p className="text-[10px] text-white/30">matching search</p>
        </div>
      </div>

      {/* Students List */}
      {filteredData.length === 0 ? (
        <div className="card p-8 text-center text-white/30 space-y-2">
          <AlertCircle className="mx-auto text-white/20" size={32} />
          <p className="text-sm font-medium">No leaves or skipped meals found</p>
          <p className="text-xs text-white/20">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map(student => {
            const isExpanded = expandedStudent === student.student_id;
            return (
              <div key={student.student_id} className="card overflow-hidden transition-all duration-200 border border-white/5 hover:border-white/10">
                {/* Main Card Header */}
                <div 
                  onClick={() => toggleExpand(student.student_id)}
                  className="p-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-sm sm:text-base hover:text-brand-400 transition-colors">
                      {student.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
                      {student.mobile && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {student.mobile}
                        </span>
                      )}
                      {student.room_number && (
                        <span className="flex items-center gap-1">
                          <Home size={12} />
                          Room {student.room_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="inline-block text-xs font-bold px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {student.skipped_count} meals skipped
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-white/40" />
                    ) : (
                      <ChevronDown size={20} className="text-white/40" />
                    )}
                  </div>
                </div>

                {/* Expandable skipped details */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-surface-900/30 p-4 space-y-2">
                    <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                      Skipped Meal Breakdown
                    </h4>
                    <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
                      {student.skips.map((skip, idx) => {
                        const mealDate = new Date(skip.meal_date);
                        const formattedDate = format(mealDate, 'EEEE, d MMMM yyyy');
                        return (
                          <div key={skip.meal_id || idx} className="flex justify-between items-center text-xs py-2 text-white/70">
                            <div>
                              <span className="font-medium text-white">{formattedDate}</span>
                              <span className="text-white/40 ml-2">· {skip.meal_type}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-white/30">₹{skip.price}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                {skip.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* View Calendar Button */}
                    <div className="pt-2 flex justify-end">
                      <button 
                        onClick={() => navigate(`/calendar/${student.student_id}`)}
                        className="btn-secondary text-[11px] py-1.5 px-3"
                      >
                        View Full Calendar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
