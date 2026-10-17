import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Student, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  student: Student | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole, username?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('hostel_safety_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setStudent(data.student);
    } catch (err) {
      console.warn('Failed to load user profile:', err);
      setUser(null);
      setStudent(null);
      setToken(null);
      localStorage.removeItem('hostel_safety_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { username, password });
      localStorage.setItem('hostel_safety_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setStudent(data.student);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('hostel_safety_token');
    setToken(null);
    setUser(null);
    setStudent(null);
  };

  const switchRole = async (role: UserRole, username?: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/switch-demo-role', { role, username });
      localStorage.setItem('hostel_safety_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setStudent(data.student);
    } catch (err: any) {
      console.error('Role switch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        token,
        loading,
        login,
        logout,
        switchRole,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
