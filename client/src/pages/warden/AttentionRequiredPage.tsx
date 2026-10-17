import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Filter, CheckCircle2, RefreshCw, Play, ShieldAlert, Phone } from 'lucide-react';
import { api } from '../../services/api';
import { ExceptionAlert } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

export const AttentionRequiredPage: React.FC = () => {
  const [exceptions, setExceptions] = useState<ExceptionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Open');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [triggeringEngine, setTriggeringEngine] = useState(false);
  const [engineMsg, setEngineMsg] = useState<string | null>(null);

  // Action Modal State
  const [selectedExp, setSelectedExp] = useState<ExceptionAlert | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        status: statusFilter,
        severity: severityFilter,
        search: searchTerm,
        page: String(page),
        limit: '15'
      }).toString();

      const res = await api.get(`/warden/exceptions?${queryParams}`);
      setExceptions(res.exceptions || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [statusFilter, severityFilter, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchExceptions();
  };

  const handleTriggerEngine = async () => {
    setTriggeringEngine(true);
    setEngineMsg(null);
    try {
      const res = await api.post('/admin/run-exception-checks');
      setEngineMsg(`Exception engine executed: ${res.results.overdueCount} new overdue alerts detected.`);
      await fetchExceptions();
    } catch (err: any) {
      alert(err.message || 'Trigger failed');
    } finally {
      setTriggeringEngine(false);
    }
  };

  const handleAction = async (action: 'Acknowledged' | 'Resolved' | 'Dismissed') => {
    if (!selectedExp) return;
    setSubmitting(true);
    try {
      await api.post(`/warden/exceptions/${selectedExp.id}/action`, {
        action,
        notes: notes || `Action marked as ${action} by duty warden`
      });
      setSelectedExp(null);
      setNotes('');
      await fetchExceptions();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            Attention Required & Exception Alerts
          </h1>
          <p className="text-xs text-slate-500">
            Actionable exceptions: Overdue returns, curfew non-compliance, and biometric verification anomalies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerEngine}
            disabled={triggeringEngine}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{triggeringEngine ? 'Checking...' : 'Run Exception Engine'}</span>
          </button>
          <button
            onClick={fetchExceptions}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {engineMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{engineMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name, roll number, room or exception title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </form>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Alert Status:</span>
          {['Open', 'Acknowledged', 'Resolved', 'Dismissed', 'All'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Exceptions List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading exceptions queue...</div>
        ) : exceptions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No exception alerts match current filters.</div>
        ) : (
          <div className="space-y-3">
            {exceptions.map((exp) => (
              <div
                key={exp.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors text-xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {getStatusBadge(exp.severity)}
                    <h3 className="font-bold text-slate-900 text-sm">{exp.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(exp.status)}
                    <span className="text-[11px] text-slate-400 font-mono">{exp.created_at}</span>
                  </div>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed">{exp.description}</p>

                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-4 text-slate-500">
                    <span>Student: <strong className="text-slate-800">{exp.full_name}</strong> ({exp.roll_number})</span>
                    <span>Room: <strong className="text-slate-800">{exp.room_number}</strong></span>
                    {exp.phone && (
                      <span className="flex items-center gap-1 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" /> {exp.phone}
                      </span>
                    )}
                  </div>

                  {exp.status === 'Open' || exp.status === 'Acknowledged' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedExp(exp)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Review & Resolve
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">
                      Resolved by {exp.resolved_by_name || 'Warden'} at {exp.resolved_at}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exception Resolution Modal */}
      <Modal
        isOpen={!!selectedExp}
        onClose={() => setSelectedExp(null)}
        title="Resolve Exception Alert"
        subtitle={selectedExp?.title}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
            {selectedExp?.description}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Action / Resolution Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Contacted student parent; confirmed arrival delayed due to rain; student arrived safely."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => handleAction('Acknowledged')}
              disabled={submitting}
              className="px-3.5 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl font-semibold cursor-pointer"
            >
              Acknowledge
            </button>
            <button
              onClick={() => handleAction('Resolved')}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              Mark Resolved
            </button>
            <button
              onClick={() => handleAction('Dismissed')}
              disabled={submitting}
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
