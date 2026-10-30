import React, { useState, useEffect } from 'react';
import {
  Camera,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Bell,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';
import { FaceEnrollModal } from '../../components/face/FaceEnrollModal';

interface StudentDashboardProps {
  onNavigate: (route: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigate }) => {
  const { student, user, refreshProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState<string | null>(null);
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/student/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleReturnClick = async () => {
    if (!confirm('Confirm return to hostel premises? Server will log your arrival timestamp and update your status to Inside.')) {
      return;
    }
    setReturnSubmitting(true);
    try {
      const res = await api.post('/student/return', {
        return_gate: 'Main Campus Gate A',
        notes: 'Confirmed return via student portal'
      });
      setReturnSuccessMsg(res.message);
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to record return.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span>Loading student dashboard...</span>
        </div>
      </div>
    );
  }

  const currentStatus = student?.current_status || 'Inside';
  const hasActiveMovement = !!data?.activeMovement;
  const isAttendanceMarked = data?.todayAttendance?.status === 'Present';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Welcome & Live Status Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xl shadow-xs">
              {student?.full_name ? student.full_name[0] : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{student?.full_name || user?.full_name}</h1>
                {getStatusBadge(currentStatus)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Roll No: <span className="font-semibold text-slate-700">{student?.roll_number}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-xs">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-slate-500 block text-[11px]">Evening Curfew:</span>
              <span className="font-bold text-slate-800">{data?.settings?.curfewTime || '21:30'} hrs</span>
            </div>
          </div>
        </div>

        {/* Return Success Alert if just returned */}
        {returnSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{returnSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Prominent "I HAVE RETURNED" Banner (When Student is Outside or Overdue) */}
      {hasActiveMovement && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-slate-900 text-base">You are currently outside hostel premises</h2>
              </div>
              <p className="text-xs text-slate-600">
                Destination: <span className="font-semibold">{data.activeMovement.destination}</span> • Expected Return:{' '}
                <span className="font-semibold text-amber-700">{data.activeMovement.expected_return_time}</span>
              </p>
            </div>

            <button
              onClick={handleReturnClick}
              disabled={returnSubmitting}
              className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{returnSubmitting ? 'Recording Arrival...' : 'I Have Returned'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Biometric Status & Real Face Enrollment Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            student?.has_face_enrolled ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Biometric Face Recognition Profile</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                student?.has_face_enrolled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {student?.has_face_enrolled ? '● Enrolled & Active' : '● Action Required'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {student?.has_face_enrolled
                ? 'Your live face template is registered for FRS attendance & gate movements.'
                : 'Enroll your live face using your webcam to enable 1-second biometric attendance verification.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFaceEnrollModal(true)}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
            student?.has_face_enrolled
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{student?.has_face_enrolled ? 'Re-enroll / Update Face' : 'Enroll My Face Now'}</span>
        </button>
      </div>

      {/* Core Action Cards (Mobile-first large cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Action 1: Give Attendance (FRS) */}
        <div
          onClick={() => onNavigate('student-attendance')}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              {isAttendanceMarked ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Present Today
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  Action Required
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Give Attendance (FRS)
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Verify your presence using live Face Recognition & Campus Geofencing signals.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
            <span>{isAttendanceMarked ? 'View Submission Status' : 'Open Camera & Mark Now'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Action 2: Apply for Leave / Outing */}
        <div
          onClick={() => onNavigate('student-leave')}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CalendarDays className="w-6 h-6" />
              </div>
              {data?.pendingLeaves?.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                  {data.pendingLeaves.length} Pending
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
              Outgoing / Leave Request
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Submit request for Day Outing, Night Out, Home Leave or Medical visit with warden approval.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-600">
            <span>Apply for New Leave</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Info Sections: Today's Status Details & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Attendance & Leave Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="font-bold text-slate-900 text-sm mb-3">Today's Attendance Status</h2>
            {data?.todayAttendance ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800">Evening Curfew Session</span>
                    {getStatusBadge(data.todayAttendance.status)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recorded at {data.todayAttendance.timestamp} via {data.todayAttendance.verification_method}
                  </p>
                </div>
                {data.todayAttendance.confidence_score && (
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Match Score:</span>
                    <span className="font-bold text-xs text-emerald-600">
                      {Math.round(data.todayAttendance.confidence_score * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Attendance Not Yet Marked</p>
                  <p className="text-slate-500 text-[11px]">Please mark attendance prior to curfew deadline.</p>
                </div>
                <button
                  onClick={() => onNavigate('student-attendance')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold text-xs cursor-pointer hover:bg-blue-700"
                >
                  Mark Now
                </button>
              </div>
            )}
          </div>

          {/* Pending Leaves Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 text-sm">Recent Leave Applications</h2>
              <button
                onClick={() => onNavigate('student-leave')}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                View All
              </button>
            </div>

            {data?.pendingLeaves?.length === 0 && data?.approvedLeaves?.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No active or recent leave requests.</p>
            ) : (
              <div className="space-y-2.5">
                {[...(data?.pendingLeaves || []), ...(data?.approvedLeaves || [])].slice(0, 3).map((l: any) => (
                  <div key={l.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{l.leave_type}</span>
                        {getStatusBadge(l.status)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{l.destination} • {l.departure_date}</p>
                    </div>
                    <span className="text-[11px] text-slate-400">Return: {l.expected_return_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right col: Notifications & Safety Guideline */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-blue-600" /> Notifications
              </h2>
            </div>
            <div className="space-y-2.5">
              {data?.notifications?.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No notifications</p>
              ) : (
                data?.notifications?.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <p className="font-semibold text-slate-800 text-[11px]">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Safety & Geofencing Note */}
          <div className="bg-blue-50/60 rounded-2xl border border-blue-200 p-4 text-xs text-slate-600 leading-relaxed">
            <div className="flex items-center gap-2 text-blue-800 font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Campus Safety Notice</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Attendance strictly requires physical presence within the hostel premises (Q1-Q4 4-corner geofence boundary). Face ID capture is only permitted inside the hostel grounds. Automated return-overdue alerts will notify the warden office if return deadlines are exceeded.
            </p>
          </div>
        </div>
      </div>

      <FaceEnrollModal
        isOpen={showFaceEnrollModal}
        onClose={() => setShowFaceEnrollModal(false)}
        studentName={student?.full_name || user?.full_name || 'Student'}
        onSuccess={() => {
          fetchDashboard();
          refreshProfile();
        }}
      />
    </div>
  );
};
