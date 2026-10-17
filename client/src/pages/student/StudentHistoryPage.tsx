import React, { useState, useEffect } from 'react';
import { History, Footprints, Camera, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';

interface StudentHistoryPageProps {
  onBack: () => void;
}

export const StudentHistoryPage: React.FC<StudentHistoryPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<'attendance' | 'movements'>('attendance');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/history')
      .then((res) => {
        setAttendance(res.attendanceHistory || []);
        setMovements(res.movementHistory || []);
      })
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Movement & Attendance History</h1>
          <p className="text-xs text-slate-500">Comprehensive log of past attendance records and gate check-in/outs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('attendance')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            tab === 'attendance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Attendance Records ({attendance.length})</span>
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            tab === 'movements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Gate Movements ({movements.length})</span>
        </button>
      </div>

      {/* Content Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading history logs...</div>
        ) : tab === 'attendance' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Session</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Verification Method</th>
                  <th className="py-2.5 px-3">Proximity</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No attendance entries logged.
                    </td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-medium text-slate-900">{att.date}</td>
                      <td className="py-3 px-3 text-slate-600">{att.session_name}</td>
                      <td className="py-3 px-3">{getStatusBadge(att.status)}</td>
                      <td className="py-3 px-3 text-slate-500">{att.verification_method}</td>
                      <td className="py-3 px-3 text-slate-500">
                        {att.distance_from_hostel_meters !== null ? `${att.distance_from_hostel_meters}m` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{att.timestamp}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Departure</th>
                  <th className="py-2.5 px-3">Expected Return</th>
                  <th className="py-2.5 px-3">Actual Return</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No gate movement entries logged.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{mov.movement_type}</td>
                      <td className="py-3 px-3 text-slate-600">{mov.destination || 'Campus Perimeter'}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{mov.actual_departure_time}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{mov.expected_return_time}</td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{mov.actual_return_time || '—'}</td>
                      <td className="py-3 px-3">{getStatusBadge(mov.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
