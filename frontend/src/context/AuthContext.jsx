import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rasoi_user')); } catch { return null; }
  });

  const login = (userData, token) => {
    localStorage.setItem('rasoi_token', token);
    localStorage.setItem('rasoi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('rasoi_token');
    localStorage.removeItem('rasoi_user');
    setUser(null);
  };

  const isOwner = user?.role === 'OWNER';
  const isStudent = user?.role === 'STUDENT';

  return (
    <AuthContext.Provider value={{ user, login, logout, isOwner, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
