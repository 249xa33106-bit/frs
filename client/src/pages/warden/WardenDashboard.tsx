import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
  Users,
  Home,
  CalendarCheck,
  Footprints,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  UserPlus,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { api } from '../../services/api';
import { WardenStats, LeaveRequest, ExceptionAlert } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

interface WardenDashboardProps {
  onNavigate: (route: string) => void;
  onOpenStudentModal?: (studentId: string) => void;
}

export const WardenDashboard: React.FC<WardenDashboardProps> = ({ onNavigate, onOpenStudentModal }) => {
  const [stats, setStats] = useState<WardenStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [remarks, setRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Exception Action Modal
  const [selectedException, setSelectedException] = useState<ExceptionAlert | null>(null);
  const [expNotes, setExpNotes] = useState('');
  const [submittingExp, setSubmittingExp] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/warden/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to load warden stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh stats fallback
    const timer = setInterval(fetchStats, 45000);

    // Supabase Live Realtime Subscription
    const channel = supabase
      .channel('warden-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movement_records' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exception_alerts' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchStats())
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleReviewSubmit = async () => {
    if (!selectedLeave) return;
    setSubmittingReview(true);
    try {
      await api.post(`/warden/leaves/${selectedLeave.id}/review`, {
        action: reviewAction,
        remarks: remarks || `Leave ${reviewAction.toLowerCase()} by duty warden`
      });
      setSelectedLeave(null);
      setRemarks('');
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleExceptionAction = async (action: 'Acknowledged' | 'Resolved' | 'Dismissed') => {
    if (!selectedException) return;
    setSubmittingExp(true);
    try {
      await api.post(`/warden/exceptions/${selectedException.id}/action`, {
        action,
        notes: expNotes || `Action: ${action} by duty warden`
      });
      setSelectedException(null);
      setExpNotes('');
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmittingExp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading operational dashboard metrics...</span>
        </div>
      </div>
    );
  }

  const kpis = stats?.kpis || {
    totalStudents: 1200,
    insideHostel: 1120,
    onLeave: 45,
    currentlyOutside: 25,
    attentionRequired: 10
  };

  const att = stats?.attendanceOverview || {
    present: 1120,
    notGiven: 60,
    verificationFailed: 10,
    excused: 10,
    totalStudents: 1200
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Hostel Operational Dashboard</h1>
          <p className="text-xs text-slate-500">
            Real-time attendance, movement tracking, return-overdue detection & safety monitoring
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Reports</span>
          </button>
          <button
            onClick={() => onNavigate('admin-students')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Student</span>
          </button>
          <button
            onClick={fetchStats}
            title="Refresh Data"
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* KPI 1: Total Students */}
        <div
          onClick={() => onNavigate('student-search')}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{kpis.totalStudents.toLocaleString()}</div>
          <p className="text-[11px] text-slate-500 mt-1">Tagore Complex (3 Blocks)</p>
        </div>

        {/* KPI 2: Inside Hostel */}
        <div
          onClick={() => onNavigate('warden-live-status')}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Inside Hostel</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.insideHostel.toLocaleString()}</div>
          <p className="text-[11px] text-emerald-700/80 mt-1">
            {Math.round((kpis.insideHostel / kpis.totalStudents) * 100)}% on premises
          </p>
        </div>

        {/* KPI 3: On Approved Leave */}
        <div
          onClick={() => onNavigate('warden-leaves')}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-purple-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">On Approved Leave</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-600">{kpis.onLeave}</div>
          <p className="text-[11px] text-purple-700/80 mt-1">Official home / night leaves</p>
        </div>

        {/* KPI 4: Currently Outside */}
        <div
          onClick={() => onNavigate('warden-movements')}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Currently Outside</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Footprints className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">{kpis.currentlyOutside}</div>
          <p className="text-[11px] text-amber-700/80 mt-1">Gate checkouts active</p>
        </div>

        {/* KPI 5: Attention Required */}
        <div
          onClick={() => onNavigate('warden-attention')}
          className="bg-white rounded-2xl border border-rose-200 p-4 shadow-xs hover:border-rose-400 transition-colors cursor-pointer bg-rose-50/20"
        >
          <div className="flex items-center justify-between text-rose-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Attention Required</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">{kpis.attentionRequired}</div>
          <p className="text-[11px] text-rose-600 font-medium mt-1">Overdues & failed checks</p>
        </div>
      </div>

      {/* Return Overdue Urgent Alert Banner (If overdues exist) */}
      {stats?.overdueAlerts && stats.overdueAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {stats.overdueAlerts.length} Students Exceeded Return Deadline (Overdue Outside)
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Overdue return detection engine has flagged students outside beyond their scheduled grace period.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('warden-attention')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Review Overdues
            </button>
          </div>
        </div>
      )}

      {/* Main Operational Split: Attendance Overview & Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: Today's Attendance Overview Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Today's Attendance Overview</h3>
                <p className="text-xs text-slate-500">Roll Call & Curfew Verification</p>
              </div>
              <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                Live Data
              </span>
            </div>

            <div className="space-y-3">
              {/* Present */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-700">Verified Present</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-slate-900">{att.present}</span>
                  <span className="text-[10px] text-slate-400 block">
                    {Math.round((att.present / (att.totalStudents || 1)) * 100)}%
                  </span>
                </div>
              </div>

              {/* Not Given */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-slate-700">Not Given Yet</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-slate-900">{att.notGiven}</span>
                  <span className="text-[10px] text-slate-400 block">Pending curfew</span>
                </div>
              </div>

              {/* Verification Failed */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-semibold text-slate-700">Verification Failed</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-rose-600">{att.verificationFailed}</span>
                  <span className="text-[10px] text-slate-400 block">Flagged for check</span>
                </div>
              </div>

              {/* Excused / On Leave */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-xs font-semibold text-slate-700">Excused / On Leave</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-slate-900">{att.excused}</span>
                  <span className="text-[10px] text-slate-400 block">Valid permission</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              View Full Daily Attendance Sheet →
            </button>
          </div>
        </div>

        {/* Right 2 cols: 7-Day Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">7-Day Attendance Trend</h3>
              <p className="text-xs text-slate-500">Historical verified roll call vs absence rate across all blocks</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" /> Present
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626]" /> Absent / Failed
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.attendanceTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '0.75rem',
                    fontSize: '11px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}
                />
                <Bar dataKey="present" name="Present" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="absent" name="Absent" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operational Queues: Pending Leaves & Attention Required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue 1: Pending Leave Approvals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Pending Leave Requests</h3>
              <p className="text-xs text-slate-500">Requires warden review and approval</p>
            </div>
            <button
              onClick={() => onNavigate('warden-leaves')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              View All ({stats?.pendingLeaves?.length || 0}) →
            </button>
          </div>

          <div className="space-y-3">
            {stats?.pendingLeaves?.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No pending leave requests.</p>
            ) : (
              stats?.pendingLeaves?.slice(0, 5).map((leave) => (
                <div
                  key={leave.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{leave.full_name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {leave.room_number} ({leave.roll_number})
                      </span>
                    </div>
                    {getStatusBadge(leave.leave_type)}
                  </div>

                  <p className="text-slate-600 font-medium text-[11px]">Destination: {leave.destination}</p>
                  <p className="text-slate-500 text-[11px] line-clamp-1">Reason: {leave.reason}</p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Return: <span className="font-semibold text-slate-700">{leave.expected_return_date}</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedLeave(leave);
                          setReviewAction('Approved');
                          setRemarks('Approved. Ensure return before evening roll call.');
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLeave(leave);
                          setReviewAction('Rejected');
                          setRemarks('Disapproved due to upcoming departmental exam.');
                        }}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Queue 2: Attention Required (Exceptions) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Attention Required Queue
              </h3>
              <p className="text-xs text-slate-500">Active automated safety exceptions & overdue returns</p>
            </div>
            <button
              onClick={() => onNavigate('warden-attention')}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              View All ({stats?.attentionQueue?.length || 0}) →
            </button>
          </div>

          <div className="space-y-3">
            {stats?.attentionQueue?.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">All clear! No open exceptions.</p>
            ) : (
              stats?.attentionQueue?.slice(0, 5).map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 text-xs space-y-2 hover:bg-rose-50/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600" />
                      {exp.title}
                    </span>
                    {getStatusBadge(exp.severity)}
                  </div>

                  <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">{exp.description}</p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono">{exp.created_at}</span>
                    <button
                      onClick={() => setSelectedException(exp)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      Take Action
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Movements Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Student Movements</h3>
            <p className="text-xs text-slate-500">Live gate entry and departure timestamps</p>
          </div>
          <button
            onClick={() => onNavigate('warden-movements')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
          >
            Manage Movements →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Destination</th>
                <th className="py-2.5 px-3">Departure</th>
                <th className="py-2.5 px-3">Expected Return</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recentMovements?.slice(0, 6).map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{mov.full_name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{mov.room_number}</td>
                  <td className="py-2.5 px-3 text-slate-600">{mov.leave_type || mov.movement_type}</td>
                  <td className="py-2.5 px-3 text-slate-500">{mov.destination || 'Campus Perimeter'}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{mov.actual_departure_time}</td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{mov.expected_return_time}</td>
                  <td className="py-2.5 px-3">{getStatusBadge(mov.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Review Confirmation Dialog */}
      <Modal
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
        title={`${reviewAction} Leave Application`}
        subtitle={`Reviewing for ${selectedLeave?.full_name} (${selectedLeave?.roll_number})`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p><span className="text-slate-400">Type:</span> <span className="font-semibold text-slate-800">{selectedLeave?.leave_type}</span></p>
            <p><span className="text-slate-400">Destination:</span> <span className="font-semibold text-slate-800">{selectedLeave?.destination}</span></p>
            <p><span className="text-slate-400">Departure:</span> <span className="font-semibold text-slate-800">{selectedLeave?.departure_date}</span></p>
            <p><span className="text-slate-400">Expected Return:</span> <span className="font-semibold text-slate-800">{selectedLeave?.expected_return_date}</span></p>
            <p><span className="text-slate-400">Reason:</span> <span className="text-slate-700">{selectedLeave?.reason}</span></p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Warden Remarks / Instructions *</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSelectedLeave(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleReviewSubmit}
              disabled={submittingReview}
              className={`px-4 py-2 text-white rounded-xl font-semibold cursor-pointer ${
                reviewAction === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submittingReview ? 'Saving...' : `Confirm ${reviewAction}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Exception Action Modal */}
      <Modal
        isOpen={!!selectedException}
        onClose={() => setSelectedException(null)}
        title="Exception Resolution"
        subtitle={selectedException?.title}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
            {selectedException?.description}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution / Action Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Spoke to student / Verified student at dispensary / Acknowledged delay"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => handleExceptionAction('Acknowledged')}
              disabled={submittingExp}
              className="px-3.5 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl font-semibold cursor-pointer"
            >
              Mark Acknowledged
            </button>
            <button
              onClick={() => handleExceptionAction('Resolved')}
              disabled={submittingExp}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              Mark Resolved
            </button>
            <button
              onClick={() => handleExceptionAction('Dismissed')}
              disabled={submittingExp}
              className="px-3.5 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
