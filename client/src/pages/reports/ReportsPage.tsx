import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Printer, Filter, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { getStatusBadge } from '../../components/common/Badge';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<
    'daily-attendance' | 'overdue-summary' | 'room-wise' | 'movement-history' | 'exceptions'
  >('daily-attendance');

  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [blockFilter, setBlockFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      const params = new URLSearchParams();

      if (reportType === 'daily-attendance') {
        endpoint = '/reports/daily-attendance';
        params.append('date', date);
        if (blockFilter !== 'All') params.append('block_id', blockFilter);
        if (statusFilter !== 'All') params.append('status', statusFilter);
      } else if (reportType === 'overdue-summary') {
        endpoint = '/reports/overdue-summary';
      } else if (reportType === 'room-wise') {
        endpoint = '/reports/room-wise';
        if (blockFilter !== 'All') params.append('block_id', blockFilter);
      } else if (reportType === 'movement-history') {
        endpoint = '/reports/movement-history';
        if (statusFilter !== 'All') params.append('status', statusFilter);
      } else if (reportType === 'exceptions') {
        endpoint = '/reports/exceptions';
      }

      const res = await api.get(`${endpoint}?${params.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, date, blockFilter, statusFilter]);

  const handleExportCSV = () => {
    const token = localStorage.getItem('hostel_safety_token');
    const url = `/api/reports/export-csv?type=${reportType}&date=${date}&token=${token || ''}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header (Hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reports & Export Center</h1>
          <p className="text-xs text-slate-500">
            Export official daily attendance sheets, overdue logs, room-wise presence and safety audit documents
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Report Selection Tabs (Hidden on print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center gap-1 overflow-x-auto">
        {[
          { id: 'daily-attendance', label: 'Daily Attendance' },
          { id: 'overdue-summary', label: 'Overdue Returns' },
          { id: 'room-wise', label: 'Room-Wise Attendance' },
          { id: 'movement-history', label: 'Movement Logs' },
          { id: 'exceptions', label: 'Exception Incident Logs' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              reportType === t.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter Controls (Hidden on print) */}
      {reportType === 'daily-attendance' && (
        <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Block:</span>
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
            >
              <option value="All">All Blocks</option>
              <option value="block-a">Block A - Nalanda</option>
              <option value="block-b">Block B - Takshashila</option>
              <option value="block-c">Block C - Aryabhata</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Verification Failed">Verification Failed</option>
              <option value="Excused">Excused</option>
            </select>
          </div>

          <button
            onClick={fetchReport}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 ml-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Official Report Document Container (Supports high-fidelity Print/PDF rendering) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Document Header */}
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              Tagore Central Hostel Complex • Administration Office
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Document: <strong className="text-slate-700 capitalize">{reportType.replace('-', ' ')}</strong>
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500 font-mono">
            <p>Generated: {data?.generatedAt || new Date().toLocaleString()}</p>
            <p>Authorized by: Office of the Chief Warden</p>
          </div>
        </div>

        {/* Report Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Records</span>
              <span className="text-base font-bold text-slate-900">{data.summary.total}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verified Present</span>
              <span className="text-base font-bold text-emerald-600">{data.summary.present}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Absent</span>
              <span className="text-base font-bold text-rose-600">{data.summary.absent}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Failed Verification</span>
              <span className="text-base font-bold text-amber-600">{data.summary.failed}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Excused / Leave</span>
              <span className="text-base font-bold text-purple-600">{data.summary.excused}</span>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Compiling database report...</div>
        ) : reportType === 'daily-attendance' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Room / Block</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Proximity</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.records?.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{r.roll_number}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {r.room_number} <span className="text-slate-400">({r.block_name})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.department}</td>
                    <td className="py-2.5 px-3">{getStatusBadge(r.status)}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.distance_from_hostel_meters ? `${r.distance_from_hostel_meters}m` : 'N/A'}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{r.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'overdue-summary' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Departure</th>
                  <th className="py-2.5 px-3">Expected Return</th>
                  <th className="py-2.5 px-3">Overdue Delay</th>
                  <th className="py-2.5 px-3">Parent Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.overdues?.map((ov: any) => (
                  <tr key={ov.id}>
                    <td className="py-2.5 px-3 font-mono font-medium">{ov.roll_number}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{ov.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{ov.room_number}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{ov.actual_departure_time}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{ov.expected_return_time}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600">{ov.overdue_minutes} mins overdue</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{ov.parent_phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reportType === 'room-wise' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Block / Floor</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Residents</th>
                  <th className="py-2.5 px-3">Inside</th>
                  <th className="py-2.5 px-3">Outside</th>
                  <th className="py-2.5 px-3">On Leave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.rooms?.slice(0, 50).map((rm: any) => (
                  <tr key={rm.id}>
                    <td className="py-2 px-3 font-bold text-slate-900">{rm.room_number}</td>
                    <td className="py-2 px-3 text-slate-600">{rm.block_name} • {rm.floor_name}</td>
                    <td className="py-2 px-3 text-slate-500">{rm.capacity} beds</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{rm.total_students || 4}</td>
                    <td className="py-2 px-3 text-emerald-600 font-semibold">{rm.inside_students || 0}</td>
                    <td className="py-2 px-3 text-amber-600 font-semibold">{rm.outside_students || 0}</td>
                    <td className="py-2 px-3 text-purple-600 font-semibold">{rm.leave_students || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Title</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.exceptions?.map((exp: any) => (
                  <tr key={exp.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{exp.title}</td>
                    <td className="py-2.5 px-3 text-slate-800">{exp.full_name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{exp.room_number}</td>
                    <td className="py-2.5 px-3">{getStatusBadge(exp.severity)}</td>
                    <td className="py-2.5 px-3">{getStatusBadge(exp.status)}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{exp.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
