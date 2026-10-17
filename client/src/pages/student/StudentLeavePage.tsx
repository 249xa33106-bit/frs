import React, { useState, useEffect } from 'react';
import { CalendarDays, Send, Clock, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';
import { LeaveRequest } from '../../types';

interface StudentLeavePageProps {
  onBack: () => void;
}

export const StudentLeavePage: React.FC<StudentLeavePageProps> = ({ onBack }) => {
  const { student } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const depDefault = `${todayStr} 15:00`;
  const retDefault = `${todayStr} 20:30`;

  const [form, setForm] = useState({
    leave_type: 'Outing' as LeaveRequest['leave_type'],
    reason: '',
    destination: '',
    departure_date: depDefault,
    expected_return_date: retDefault,
    parent_consent_phone: student?.parent_phone || ''
  });

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/student/leaves');
      setLeaves(res.leaves || []);
    } catch (e) {
      console.error('Failed to load leaves:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/student/leaves', form);
      setSuccessMsg(res.message || 'Leave request submitted successfully.');
      setForm({
        leave_type: 'Outing',
        reason: '',
        destination: '',
        departure_date: depDefault,
        expected_return_date: retDefault,
        parent_consent_phone: student?.parent_phone || ''
      });
      fetchLeaves();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Outgoing & Leave Application</h1>
          <p className="text-xs text-slate-500">Apply for campus exit permission and track warden approvals</p>
        </div>
      </div>

      {/* Application Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-purple-600" />
          New Leave Application Form
        </h3>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Movement / Leave Type *</label>
              <select
                value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Outing">Day Outing (Return same day)</option>
                <option value="Night Out">Night Out (Return next morning)</option>
                <option value="Home Leave">Home Leave (Multi-day visit)</option>
                <option value="Emergency/Medical">Emergency / Medical Consultation</option>
                <option value="Academic Visit">Academic Visit / Conference / Exam</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Address *</label>
              <input
                type="text"
                placeholder="e.g. City Central Library / AIIMS Hospital"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Departure (YYYY-MM-DD HH:MM) *</label>
              <input
                type="text"
                value={form.departure_date}
                onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Return (YYYY-MM-DD HH:MM) *</label>
              <input
                type="text"
                value={form.expected_return_date}
                onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave *</label>
            <textarea
              rows={2}
              placeholder="Provide a clear explanation for this movement..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parent / Guardian Contact Number</label>
            <input
              type="text"
              value={form.parent_consent_phone}
              onChange={(e) => setForm({ ...form, parent_consent_phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting Application...' : 'Submit Leave Request'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Leave Application History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
          <span>My Leave Applications & Status</span>
          <span className="text-xs text-slate-400 font-normal">{leaves.length} records</span>
        </h3>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading applications...</div>
        ) : leaves.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No leave applications submitted yet.</div>
        ) : (
          <div className="space-y-3">
            {leaves.map((l) => (
              <div
                key={l.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-slate-900 text-sm">{l.leave_type}</span>
                    {getStatusBadge(l.status)}
                  </div>
                  <span className="text-[11px] text-slate-400">Applied on {l.created_at}</span>
                </div>

                <p className="text-slate-600 font-medium">Destination: <span className="text-slate-900">{l.destination}</span></p>
                <p className="text-slate-500 text-[11px] leading-relaxed">Reason: {l.reason}</p>

                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <span className="text-slate-400">Departure: </span>
                    <span className="font-medium text-slate-700">{l.departure_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Expected Return: </span>
                    <span className="font-medium text-slate-700">{l.expected_return_date}</span>
                  </div>
                </div>

                {l.warden_remarks && (
                  <div className="mt-2 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px]">
                    <span className="font-semibold text-blue-800">Warden Note ({l.reviewer_name || 'Duty Warden'}): </span>
                    <span className="text-slate-700">{l.warden_remarks}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
