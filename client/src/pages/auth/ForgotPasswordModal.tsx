import React, { useState } from 'react';
import { Mail, MailCheck, CheckCircle2, AlertCircle, KeyRound, Lock, Eye, EyeOff, ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../../components/common/Modal';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [identifier, setIdentifier] = useState('');
  const [userId, setUserId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetState = () => {
    setStep('request');
    setIdentifier('');
    setUserId('');
    setMaskedEmail('');
    setDemoOtp(null);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Step 1: Request Password Reset OTP via Gmail
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your registered Gmail address or Roll Number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password-otp', { identifier: identifier.trim() });
      if (res.success) {
        setUserId(res.userId || '');
        setMaskedEmail(res.email || identifier);
        setDemoOtp(res.otp || null);
        if (res.otp) {
          // Pre-populate for convenience, user can also type it
          setOtp(res.otp);
        }
        setStep('verify');
      } else {
        setError(res.error || 'Failed to dispatch verification email.');
      }
    } catch (err: any) {
      setError(err.message || 'Could not find an account with that email address or roll number.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code sent to your Gmail.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify your typing.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/reset-password-otp', {
        identifier: identifier.trim(),
        userId,
        otp: otp.trim(),
        newPassword
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Password reset successfully!');
        setStep('success');
      } else {
        setError(res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code or password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'request'
          ? 'Reset Password via Gmail'
          : step === 'verify'
          ? 'Enter Gmail Verification Code'
          : 'Password Reset Successful'
      }
      subtitle={
        step === 'request'
          ? 'Enter your registered Gmail or academic email address to receive a 6-digit verification OTP'
          : step === 'verify'
          ? `Verification code dispatched to your Gmail inbox (${maskedEmail || 'registered email'})`
          : 'Your account credentials have been updated securely'
      }
    >
      <div className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Enter Gmail / Roll No */}
        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Registered Gmail / Academic Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. yourname@gmail.com or 2024CS1001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                We will send a 6-digit verification code directly to your registered Gmail address.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending to Gmail...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Reset Code to Gmail</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter OTP & Set New Password */}
        {step === 'verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Live Gmail Dispatch Notice */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 text-blue-900 rounded-xl space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-xs text-blue-800">
                  <MailCheck className="w-4 h-4 text-blue-600" />
                  Gmail Email Dispatched
                </span>
                <span className="text-[10px] bg-blue-200/80 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  Inbox Sent
                </span>
              </div>
              <p className="text-[11px] text-blue-800">
                A 6-digit password reset code was sent to <strong>{maskedEmail}</strong>. Please check your inbox and Spam / Promotions folder.
              </p>
              {demoOtp && (
                <div className="pt-1 mt-1 border-t border-blue-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Verification Code:</span>
                  <span className="font-mono text-xs font-bold text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-300">
                    {demoOtp}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Enter 6-Digit Gmail Verification Code *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm New Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Email</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify & Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: Success Confirmation */}
        {step === 'success' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">Password Updated Successfully!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {successMsg || 'Your new password is now active. You can now log into your account using your updated credentials.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Proceed to Sign In
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
