import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CalendarDays, LogOut,
  UtensilsCrossed, CreditCard, TrendingDown, BarChart3,
  Settings, FileText, X, ChefHat
} from 'lucide-react';

const ownerNav = [
  { to: '/dashboard',  icon: LayoutDashboard,  label: 'Dashboard' },
  { to: '/students',   icon: Users,             label: 'Students' },
  { to: '/calendar',   icon: CalendarDays,      label: 'Meal Calendar' },
  { to: '/kitchen',    icon: UtensilsCrossed,   label: 'Kitchen Sheet' },
  { to: '/daily-menu', icon: ChefHat,           label: 'Daily Menu' },
  { to: '/billing',    icon: FileText,           label: 'Billing' },
  { to: '/payments',   icon: CreditCard,         label: 'Payments' },
  { to: '/expenses',   icon: TrendingDown,       label: 'Expenses' },
  { to: '/reports',    icon: BarChart3,          label: 'Reports' },
  { to: '/settings',   icon: Settings,           label: 'Settings' },
];

const studentNav = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-calendar', icon: CalendarDays,    label: 'My Calendar' },
  { to: '/my-balance',  icon: CreditCard,      label: 'My Balance' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();
  const navItems = isOwner ? ownerNav : studentNav;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 w-64 flex flex-col
        bg-surface-900 border-r border-white/5
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">Rasoi</p>
              <p className="text-xs text-white/40">Management</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 mx-3 mt-3 rounded-xl bg-surface-800 border border-white/5">
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{isOwner ? '👑 Owner / Admin' : '🎓 Student'}</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}
              `}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
