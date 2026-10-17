import React, { useState, useEffect } from 'react';
import { CheckSquare, Search, Filter, CheckCircle2, XCircle, Phone, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { LeaveRequest } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

export const LeaveApprovalPage: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Review Modal
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'Approved' | 'Rejected'>('Approved');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        status: statusFilter,
        type: typeFilter,
        search: searchTerm,
        page: String(page),
        limit: '15'
      }).toString();

      const response = await api.get(`/warden/leaves?${queryParams}`);
      setLeaves(response.leaves || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [statusFilter, typeFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLeaves();
  };

  const handleReviewSubmit = async () => {
    if (!selectedLeave) return;
    setSubmitting(true);
    try {
      await api.post(`/warden/leaves/${selectedLeave.id}/review`, {
        action: actionType,
        remarks: remarks || `Leave ${actionType.toLowerCase()} by warden`
      });
      setSelectedLeave(null);
      setRemarks('');
      await fetchLeaves();
    } catch (err: any) {
      alert(err.message || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leave & Movement Approvals Queue</h1>
          <p className="text-xs text-slate-500">Review, approve, or reject student leave and outing permissions</p>
        </div>
        <button
          onClick={fetchLeaves}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name, roll number, room or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </form>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All Leave Types</option>
            <option value="Outing">Day Outing</option>
            <option value="Night Out">Night Out</option>
            <option value="Home Leave">Home Leave</option>
            <option value="Emergency/Medical">Emergency/Medical</option>
            <option value="Academic Visit">Academic Visit</option>
          </select>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Status:</span>
          {['All', 'Pending', 'Approved', 'Rejected', 'Expired'].map((st) => (
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

      {/* Data Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading leave requests...</div>
        ) : leaves.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No leave requests match the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Room / Block</th>
                  <th className="py-2.5 px-3">Leave Type</th>
                  <th className="py-2.5 px-3">Destination & Reason</th>
                  <th className="py-2.5 px-3">Departure Date</th>
                  <th className="py-2.5 px-3">Expected Return</th>
                  <th className="py-2.5 px-3">Parent Contact</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{l.full_name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{l.roll_number}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{l.room_number}</span>
                      <p className="text-[10px] text-slate-400">{l.block_name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{l.leave_type}</span>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">{l.destination}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{l.reason}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{l.departure_date}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{l.expected_return_date}</td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {l.parent_consent_phone || l.phone}
                      </span>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(l.status)}</td>
                    <td className="py-3 px-3 text-right">
                      {l.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedLeave(l);
                              setActionType('Approved');
                              setRemarks('Approved. Return before curfew roll call.');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLeave(l);
                              setActionType('Rejected');
                              setRemarks('Rejected due to academic commitments.');
                            }}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Reviewed</span>
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

      {/* Review Modal */}
      <Modal
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
        title={`${actionType} Leave Request`}
        subtitle={`${selectedLeave?.full_name} (${selectedLeave?.roll_number})`}
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <p><span className="text-slate-400">Destination:</span> <span className="font-semibold text-slate-800">{selectedLeave?.destination}</span></p>
            <p><span className="text-slate-400">Departure:</span> <span className="font-semibold text-slate-800">{selectedLeave?.departure_date}</span></p>
            <p><span className="text-slate-400">Expected Return:</span> <span className="font-semibold text-slate-800">{selectedLeave?.expected_return_date}</span></p>
            <p><span className="text-slate-400">Reason:</span> <span className="text-slate-700">{selectedLeave?.reason}</span></p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Warden Remarks *</label>
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
              disabled={submitting}
              className={`px-4 py-2 text-white rounded-xl font-semibold cursor-pointer ${
                actionType === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting ? 'Saving...' : `Confirm ${actionType}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
