import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  UtensilsCrossed, LogIn, LayoutDashboard, Coffee, Sun, Moon,
  Calendar, ShieldAlert, Award, Clock, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function LandingPage() {
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch menu publicly
    api.get('/menu')
      .then(res => {
        setMenu(res.data);
      })
      .catch(() => {
        toast.error('Failed to load weekly menu');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getMenuForDayAndMeal = (day, meal) => {
    const item = menu.find(
      m => m.day_of_week.toLowerCase() === day.toLowerCase() && m.meal_type.toUpperCase() === meal.toUpperCase()
    );
    return item ? item.items : 'Loading...';
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col text-white select-none">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-brand-700/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/20">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">Rasoi</p>
              <p className="text-xs text-white/40">Management</p>
            </div>
          </div>

          <div>
            {user ? (
              <button
                onClick={() => navigate(isOwner ? '/dashboard' : '/my-calendar')}
                className="btn-primary"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Go to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn-primary"
              >
                <LogIn size={16} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-8 lg:py-16 space-y-16 lg:space-y-24 z-10">
        
        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-3xl mx-auto py-4">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider">
            Premium Tiffin Experience
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white">
            Smart Rasoi Management & <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">Tiffin Delivery</span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Fresh, delicious home-cooked meals delivered daily. Manage your schedule, pauses, and monthly payments effortlessly through our smart student portal.
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={() => {
                document.getElementById('weekly-menu-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-primary px-6"
            >
              View Weekly Menu <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* Weekly Menu Section */}
        <section id="weekly-menu-section" className="space-y-6 scroll-mt-24">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">What's Cooking This Week?</h2>
            <p className="text-white/40 text-sm">Deliciously planned daily menus from our home kitchen</p>
          </div>

          {/* Weekday Tabs */}
          <div className="flex overflow-x-auto pb-2 justify-start sm:justify-center gap-2 no-scrollbar">
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  selectedDay === day
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                    : 'bg-surface-800 text-white/50 border border-white/5 hover:text-white hover:bg-surface-700'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Menu Cards */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Breakfast */}
              <div className="card p-6 border-white/5 flex flex-col gap-4 card-hover">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                    <Coffee size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Breakfast</h3>
                    <p className="text-xs text-white/40">Morning Fuel (8:00 AM)</p>
                  </div>
                </div>
                <div className="h-[1px] bg-white/5" />
                <p className="text-white/80 text-sm leading-relaxed min-h-[4rem]">
                  {getMenuForDayAndMeal(selectedDay, 'BREAKFAST')}
                </p>
              </div>

              {/* Lunch */}
              <div className="card p-6 border-white/5 flex flex-col gap-4 card-hover">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                    <Sun size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Lunch</h3>
                    <p className="text-xs text-white/40">Hearty Midday Meal (1:00 PM)</p>
                  </div>
                </div>
                <div className="h-[1px] bg-white/5" />
                <p className="text-white/80 text-sm leading-relaxed min-h-[4rem]">
                  {getMenuForDayAndMeal(selectedDay, 'LUNCH')}
                </p>
              </div>

              {/* Dinner */}
              <div className="card p-6 border-white/5 flex flex-col gap-4 card-hover">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Moon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Dinner</h3>
                    <p className="text-xs text-white/40">Warm Night Meal (8:30 PM)</p>
                  </div>
                </div>
                <div className="h-[1px] bg-white/5" />
                <p className="text-white/80 text-sm leading-relaxed min-h-[4rem]">
                  {getMenuForDayAndMeal(selectedDay, 'DINNER')}
                </p>
              </div>

            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Platform Features</h2>
            <p className="text-white/40 text-sm">How we make tiffin management hassle-free for everyone</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1 */}
            <div className="card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shadow-inner">
                <Calendar size={22} />
              </div>
              <h3 className="font-bold text-white text-base">Personalized Plan</h3>
              <p className="text-white/50 text-xs leading-relaxed">
                Choose custom default meal schedules (Breakfast, Lunch, Dinner) based on your routine. Set custom pricing filters on the fly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shadow-inner">
                <Clock size={22} />
              </div>
              <h3 className="font-bold text-white text-base">Flexible Leaves</h3>
              <p className="text-white/50 text-xs leading-relaxed">
                Going home for weekends? Mark single/multi-day leaves via your dashboard. Skipped meals are automatically subtracted from your balance.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shadow-inner">
                <Award size={22} />
              </div>
              <h3 className="font-bold text-white text-base">Waste Prevention</h3>
              <p className="text-white/50 text-xs leading-relaxed">
                Our kitchen view compiles real-time numbers of active servings for today, helping our cooks prevent food and material waste.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card p-6 border-white/5 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shadow-inner">
                <ShieldAlert size={22} />
              </div>
              <h3 className="font-bold text-white text-base">Auto Invoicing</h3>
              <p className="text-white/50 text-xs leading-relaxed">
                Transparent monthly invoice billing logs showing opening balance, totals served, leaves recorded, payments, and dues.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-surface-900/40 border-t border-white/5 py-8 px-4 text-center text-white/30 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Rasoi Tiffin Service. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-white transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
