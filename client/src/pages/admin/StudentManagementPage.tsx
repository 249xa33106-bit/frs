import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, Search, CheckCircle2, AlertCircle, Camera, RefreshCw, Trash2, Sparkles, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../../services/api';
import { Student } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { FaceEnrollModal } from '../../components/face/FaceEnrollModal';

export const StudentManagementPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Student Form
  const [form, setForm] = useState({
    roll_number: '',
    full_name: '',
    email: '',
    phone: '',
    emergency_phone: '',
    parent_name: '',
    parent_phone: '',
    room_id: '',
    department: 'Computer Science & Engineering',
    year_of_study: 1
  });

  // Face Enrollment Modal
  const [enrollingStudent, setEnrollingStudent] = useState<Student | null>(null);

  const fetchData = async (currentPage = page, search = searchTerm) => {
    setLoading(true);
    try {
      const [stdRes, hRes] = await Promise.all([
        api.get(`/hostel/students?search=${encodeURIComponent(search)}&page=${currentPage}&limit=${limit}`),
        api.get('/hostel/hierarchy')
      ]);
      setStudents(stdRes.students || []);
      setTotalPages(stdRes.pagination?.totalPages || 1);
      setTotalCount(stdRes.pagination?.totalCount || 0);
      setRooms(hRes.rooms || []);
      if (hRes.rooms?.length > 0 && !form.room_id) {
        setForm((prev) => ({ ...prev, room_id: hRes.rooms[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page, searchTerm);
  }, [page, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData(1, searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
    fetchData(1, '');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await api.post('/admin/students', form);
      setMsg({ type: 'success', text: res.message || 'Student enrolled successfully!' });
      setShowAddModal(false);
      setForm({
        roll_number: '',
        full_name: '',
        email: '',
        phone: '',
        emergency_phone: '',
        parent_name: '',
        parent_phone: '',
        room_id: rooms[0]?.id || '',
        department: 'Computer Science & Engineering',
        year_of_study: 1
      });
      // Refresh to page 1 where the newly created student appears on row 1
      setPage(1);
      setSearchTerm('');
      fetchData(1, '');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Registration failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearDemoStudents = async () => {
    if (!confirm('This will clear seeded records, leaving real registered students and campus architecture intact. Continue?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/admin/clear-demo-students');
      setMsg({ type: 'success', text: res.message });
      setPage(1);
      fetchData(1, searchTerm);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to clear student records' });
    } finally {
      setLoading(false);
    }
  };

  const isRecentStudent = (created_at?: string, id?: string) => {
    if (!created_at) return false;
    if (id?.includes('real')) return true;
    const now = new Date().getTime();
    const createdTime = new Date(created_at).getTime();
    return (now - createdTime) < (14 * 24 * 60 * 60 * 1000); // Created within last 14 days
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            Hostel Student Enrollment & Management
          </h1>
          <p className="text-xs text-slate-500">
            Register new residents, manage room allocations, and enroll biometric facial templates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearDemoStudents}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset student intake database"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Reset Demo Records</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Filter & Live Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name, roll number, phone, or room (e.g. Sowpan, 249XA, A-101)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={() => fetchData(page, searchTerm)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-pointer transition-colors"
              title="Refresh student list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Registered Residents ({totalCount})
            </h3>
            <p className="text-[11px] text-slate-400">
              Showing page {page} of {totalPages} (Most recent admissions listed first)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px]">Per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none"
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Roll Number</th>
                <th className="py-2.5 px-3">Room / Block</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Biometrics</th>
                <th className="py-2.5 px-3">Live Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No matching students found. Try clearing your search filters.
                  </td>
                </tr>
              ) : (
                students.map((std) => {
                  const recent = isRecentStudent(std.created_at, std.id);
                  return (
                    <tr key={std.id} className={`hover:bg-slate-50/50 transition-colors ${recent ? 'bg-blue-50/20' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{std.full_name}</span>
                          {recent && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              <Sparkles className="w-2.5 h-2.5" /> Recent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">{std.roll_number}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{std.room_number || 'Unassigned'}</span>
                        {std.block_name && (
                          <span className="text-[10px] text-slate-400 block">{std.block_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{std.department}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{std.phone}</td>
                      <td className="py-3 px-3">
                        {std.has_face_enrolled ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Enrolled
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">{getStatusBadge(std.current_status)}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEnrollingStudent(std)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            {std.has_face_enrolled ? 'Re-enroll Face' : 'Enroll Face'}
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Delete student ${std.full_name} (${std.roll_number})? This cannot be undone.`)) return;
                              try {
                                await api.delete(`/admin/students/${std.id}`);
                                fetchData(page, searchTerm);
                              } catch (err: any) {
                                alert('Failed to delete: ' + (err.message || 'Unknown error'));
                              }
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer border border-rose-200"
                            title="Delete student"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Hostel Resident"
        subtitle="Creates login credentials, assigns room, and prepares biometric record"
        maxWidth="lg"
      >
        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Roll Number *</label>
              <input
                type="text"
                placeholder="e.g. 24BCSE102"
                value={form.roll_number}
                onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Legal Name *</label>
              <input
                type="text"
                placeholder="e.g. Mohamed Ali"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Academic Email *</label>
              <input
                type="email"
                placeholder="student@university.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Phone *</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Biotechnology">Biotechnology</option>
                <option value="Business Administration (MBA)">Business Administration (MBA)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Year of Study</label>
              <select
                value={form.year_of_study}
                onChange={(e) => setForm({ ...form, year_of_study: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value={1}>1st Year (Freshman)</option>
                <option value={2}>2nd Year (Sophomore)</option>
                <option value={3}>3rd Year (Junior)</option>
                <option value={4}>4th Year (Senior)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Sharma"
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Parent Contact Number</label>
              <input
                type="tel"
                placeholder="+91 91234 56789"
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hostel Room Assignment *</label>
            <select
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} (Capacity: {r.occupied_count || 0}/{r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
            >
              {submitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Face Enrollment Modal */}
      {enrollingStudent && (
        <FaceEnrollModal
          isOpen={!!enrollingStudent}
          onClose={() => setEnrollingStudent(null)}
          studentName={enrollingStudent.full_name}
          studentId={enrollingStudent.id}
          onSuccess={() => {
            setMsg({ type: 'success', text: `Face biometrics enrolled for ${enrollingStudent.full_name}!` });
            fetchData(page, searchTerm);
          }}
        />
      )}
    </div>
  );
};
