import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle2, History, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CameraCapture } from '../../components/face/CameraCapture';
import { getStatusBadge } from '../../components/common/Badge';

interface StudentAttendancePageProps {
  onBack: () => void;
}

export const StudentAttendancePage: React.FC<StudentAttendancePageProps> = ({ onBack }) => {
  const { student, refreshProfile } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<any>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/student/history');
      setHistory(res.attendanceHistory || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSuccess = (result: any) => {
    setLastSubmissionResult(result);
    fetchHistory();
    refreshProfile();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Back button & Page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Hostel Attendance (FRS)</h1>
          <p className="text-xs text-slate-500">
            Facial recognition verification with anti-spoofing liveness & campus boundary check
          </p>
        </div>
      </div>

      {/* Camera Capture Section */}
      <CameraCapture onSuccess={handleSuccess} />

      {/* Safety & Protocol Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs text-xs space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <ShieldAlert className="w-4 h-4 text-blue-600" />
          Attendance Submission Guidelines
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
          <li>Ensure adequate room lighting and remove sunglasses or face coverings.</li>
          <li>Hold device steady and align your face inside the central oval frame.</li>
          <li>GPS Geolocation must be enabled to verify that you are within the 250m campus perimeter.</li>
          <li>Duplicate submissions for the same curfew session are prohibited by system rules.</li>
          <li>All failed verification attempts are logged with biometric telemetry for warden review.</li>
        </ul>
      </div>

      {/* Past Attendance History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            My Recent Attendance Records
          </h3>
          <span className="text-xs text-slate-400">{history.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Session</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Proximity</th>
                <th className="py-2.5 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No attendance records found yet.
                  </td>
                </tr>
              ) : (
                history.slice(0, 10).map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{record.date}</td>
                    <td className="py-2.5 px-3 text-slate-600">{record.session_name}</td>
                    <td className="py-2.5 px-3">{getStatusBadge(record.status)}</td>
                    <td className="py-2.5 px-3 text-slate-500">{record.verification_method}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {record.distance_from_hostel_meters !== null ? `${record.distance_from_hostel_meters}m` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{record.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
