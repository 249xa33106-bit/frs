import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Clock } from 'lucide-react';
import { api } from '../../services/api';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs?limit=50');
      setLogs(res.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-blue-600" />
            Security Audit Trail & Activity Log
          </h1>
          <p className="text-xs text-slate-500">Immutable ledger of administrative approvals, parameter adjustments, and gate interventions</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading audit log entries...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No audit log entries recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{log.user_full_name || 'System / Auto'}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{log.target_type}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-md">{log.details}</td>
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
