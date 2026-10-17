import React, { useState } from 'react';
import { ShieldCheck, LogIn, Lock, User, AlertCircle, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { StudentRegisterModal } from './StudentRegisterModal';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172033] tracking-tight">
            Hostel Safety
          </h1>
          <p className="text-xs text-[#64748B] max-w-xs mx-auto">
            Attendance & Student Movement Management System • 1,200 Residents
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Use your university student or warden credentials</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username or Academic Email</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. student or warden"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            </button>
          </form>

          {/* Real Student Self-Registration & Account Access Guide */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">New hostel resident without an account?</p>
              <button
                type="button"
                onClick={() => setShowRegisterModal(true)}
                className="w-full py-2.5 px-4 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-blue-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>Register New Student Account</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Account Access Guide:</p>
              <p>• <strong>Students:</strong> Sign in using your Roll Number or registered email.</p>
              <p>• <strong>Staff & Wardens:</strong> Sign in with your assigned institutional username.</p>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
          <Shield className="w-4 h-4 text-slate-400" />
          <span>Biometric & GPS data encrypted with strict retention policies</span>
        </div>
      </div>

      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
      <StudentRegisterModal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} />
    </div>
  );
};
