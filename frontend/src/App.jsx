import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import AddStudentPage from './pages/AddStudentPage';
import CalendarPage from './pages/CalendarPage';
import KitchenPage from './pages/KitchenPage';
import BillingPage from './pages/BillingPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';
import StudentProfilePage from './pages/StudentProfilePage';

function ProtectedRoute({ children, ownerOnly = false }) {
  const { user, isOwner } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/my-calendar" replace />;
  return children;
}

function AppRoutes() {
  const { user, isOwner } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={isOwner ? "/dashboard" : "/my-calendar"} replace /> : <LoginPage />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Owner routes */}
        <Route path="/dashboard" element={<ProtectedRoute ownerOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute ownerOnly><StudentsPage /></ProtectedRoute>} />
        <Route path="/students/add" element={<ProtectedRoute ownerOnly><AddStudentPage /></ProtectedRoute>} />
        <Route path="/students/:id" element={<StudentProfilePage />} />
        <Route path="/calendar" element={<ProtectedRoute ownerOnly><StudentsPage /></ProtectedRoute>} />
        <Route path="/calendar/:id" element={<CalendarPage />} />
        <Route path="/kitchen" element={<ProtectedRoute ownerOnly><KitchenPage /></ProtectedRoute>} />
        <Route path="/billing/:id" element={<BillingPage />} />
        <Route path="/payments" element={<ProtectedRoute ownerOnly><StudentsPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute ownerOnly><ExpensesPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute ownerOnly><DashboardPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute ownerOnly><SettingsPage /></ProtectedRoute>} />

        {/* Student routes */}
        <Route path="/my-calendar" element={<Navigate to={user?.studentId ? `/calendar/${user.studentId}` : '/login'} replace />} />
        <Route path="/my-balance" element={<Navigate to={user?.studentId ? `/billing/${user.studentId}` : '/login'} replace />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? (isOwner ? "/dashboard" : "/my-calendar") : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1c2028',
              color: '#e8eaf0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#4ade80', secondary: '#1c2028' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#1c2028' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
