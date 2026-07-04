import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { UtensilsCrossed, Phone, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('STUDENT'); // 'STUDENT' or 'ADMIN'
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      const userRole = res.data.user.role;
      
      if (loginType === 'STUDENT' && userRole === 'OWNER') {
        toast.error('This account is registered as Admin. Please use Admin Login.');
        setLoading(false);
        return;
      }
      if (loginType === 'ADMIN' && userRole !== 'OWNER') {
        toast.error('This account is registered as User. Please use User Login.');
        setLoading(false);
        return;
      }

      login(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center px-4 relative">
      {/* Back Arrow button */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-white/40 hover:text-white transition-colors cursor-pointer group z-20"
      >
        <ArrowLeft size={20} className="transform group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium hidden sm:inline">Back to Home</span>
      </Link>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand-700/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-4 shadow-lg shadow-brand-900/50">
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Rasoi Management</h1>
          <p className="text-white/40 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-2xl shadow-black/50">
          <div className="flex bg-surface-950 p-1 rounded-xl mb-5 border border-white/5">
            <button
              type="button"
              onClick={() => setLoginType('STUDENT')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                loginType === 'STUDENT'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              User Login
            </button>
            <button
              type="button"
              onClick={() => setLoginType('ADMIN')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
                loginType === 'ADMIN'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              Admin Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                {!form.phone && (
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 transition-all duration-200" />
                )}
                 <input
                  type="tel"
                  className="input-field transition-all duration-200"
                  style={{ paddingLeft: form.phone ? '0.875rem' : '2.5rem' }}
                  placeholder="Enter your phone number"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  required
                  inputMode="numeric"
                  autoComplete="new-phone"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                {!form.password && (
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 transition-all duration-200" />
                )}
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field transition-all duration-200 pr-10"
                  style={{ paddingLeft: form.password ? '0.875rem' : '2.5rem' }}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo hint */}
        {loginType === 'ADMIN' && (
          <p className="text-center text-white/20 text-xs mt-6">
            Default admin: 9999999999 / admin123
          </p>
        )}
      </div>
    </div>
  );
}
