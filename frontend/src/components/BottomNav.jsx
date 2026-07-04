import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, CalendarDays, CreditCard, BarChart3 } from 'lucide-react';

const ownerNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/students',  icon: Users,           label: 'Students' },
  { to: '/calendar',  icon: CalendarDays,    label: 'Calendar' },
  { to: '/payments',  icon: CreditCard,      label: 'Payments' },
  { to: '/reports',   icon: BarChart3,       label: 'Reports' },
];

const studentNav = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-calendar', icon: CalendarDays,    label: 'Calendar' },
  { to: '/my-balance',  icon: CreditCard,      label: 'Balance' },
];

export default function BottomNav() {
  const { isOwner } = useAuth();
  const navItems = isOwner ? ownerNav : studentNav;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-900/95 backdrop-blur-xl border-t border-white/5 bottom-nav-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl flex-1 mx-0.5
              transition-all duration-150 min-h-[44px] justify-center
              ${isActive ? 'text-brand-400 bg-brand-500/10' : 'text-white/40'}
            `}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
