import React, { useState, useEffect } from 'react';
import { Footprints, Search, CheckCircle2, AlertTriangle, Clock, RefreshCw, DoorOpen } from 'lucide-react';
import { api } from '../../services/api';
import { MovementRecord } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

export const MovementManagementPage: React.FC = () => {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Outside');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Manual Gate Checkin Modal
  const [selectedMov, setSelectedMov] = useState<MovementRecord | null>(null);
  const [gate, setGate] = useState('Main Campus Gate A');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        status: statusFilter,
        search: searchTerm,
        page: String(page),
        limit: '15'
      }).toString();

      const res = await api.get(`/warden/movements?${queryParams}`);
      setMovements(res.movements || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load movements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [statusFilter, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMovements();
  };

  const handleGateCheckin = async () => {
    if (!selectedMov) return;
    setSubmitting(true);
    try {
      await api.post(`/warden/movements/${selectedMov.id}/gate-checkin`, {
        gate,
        notes: notes || 'Verified entry at campus security gate'
      });
      setSelectedMov(null);
      setNotes('');
      await fetchMovements();
    } catch (err: any) {
      alert(err.message || 'Gate check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Student Movement & Gate Tracking</h1>
          <p className="text-xs text-slate-500">Live monitoring of students outside, gate returns, and overdue alerts</p>
        </div>
        <button
          onClick={fetchMovements}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by student name, roll number, room or destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Movement Status:</span>
          {['All', 'Outside', 'Overdue', 'Returned'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Movement Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading movement records...</div>
        ) : movements.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No movements match current filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Departure</th>
                  <th className="py-2.5 px-3">Expected Return</th>
                  <th className="py-2.5 px-3">Actual Return</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{m.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{m.roll_number}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{m.room_number}</span>
                      <p className="text-[10px] text-slate-400">{m.block_name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{m.movement_type}</span>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">{m.destination || 'Campus Perimeter'}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{m.reason}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{m.actual_departure_time}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{m.expected_return_time}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{m.actual_return_time || '—'}</td>
                    <td className="py-3 px-3">
                      {m.is_overdue === 1 ? (
                        <div className="flex flex-col gap-0.5">
                          {getStatusBadge('Overdue')}
                          <span className="text-[10px] font-bold text-rose-600">{m.overdue_minutes}m overdue</span>
                        </div>
                      ) : (
                        getStatusBadge(m.status)
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {m.status !== 'Returned' ? (
                        <button
                          onClick={() => setSelectedMov(m)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg font-semibold text-[11px] flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span>Gate In</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Manual Gate Check-in Modal */}
      <Modal
        isOpen={!!selectedMov}
        onClose={() => setSelectedMov(null)}
        title="Physical Gate Entry Check-in"
        subtitle={`Verify return for ${selectedMov?.full_name} (${selectedMov?.roll_number})`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p><span className="text-slate-400">Destination:</span> <span className="font-semibold text-slate-800">{selectedMov?.destination}</span></p>
            <p><span className="text-slate-400">Scheduled Return:</span> <span className="font-semibold text-slate-800">{selectedMov?.expected_return_time}</span></p>
            {selectedMov?.is_overdue === 1 && (
              <p className="text-rose-600 font-bold">⚠️ Student was {selectedMov.overdue_minutes} minutes overdue</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Gate *</label>
            <select
              value={gate}
              onChange={(e) => setGate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Main Campus Gate A">Main Campus Gate A</option>
              <option value="North Wing Gate B">North Wing Gate B</option>
              <option value="Hostel Complex Gate C">Hostel Complex Gate C</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Guard / Warden Observation Notes</label>
            <input
              type="text"
              placeholder="e.g. Student presented valid physical ID badge"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSelectedMov(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleGateCheckin}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              {submitting ? 'Confirming...' : 'Confirm Return & Check-in'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
