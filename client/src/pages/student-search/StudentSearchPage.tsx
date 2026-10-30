import React, { useState, useEffect } from 'react';
import { Search, Filter, Phone, User, Home, CalendarDays, History, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Student } from '../../types';
import { getStatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';

interface StudentSearchPageProps {
  initialStudentId?: string | null;
  onClearInitialStudentId?: () => void;
}

export const StudentSearchPage: React.FC<StudentSearchPageProps> = ({
  initialStudentId,
  onClearInitialStudentId
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [blockFilter, setBlockFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Student Profile Modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search: searchTerm,
        block_id: blockFilter,
        status: statusFilter,
        page: String(page),
        limit: '15'
      }).toString();

      const res = await api.get(`/hostel/students?${queryParams}`);
      setStudents(res.students || []);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [blockFilter, statusFilter, page]);

  useEffect(() => {
    if (initialStudentId) {
      handleOpenProfile(initialStudentId);
      if (onClearInitialStudentId) onClearInitialStudentId();
    }
  }, [initialStudentId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleOpenProfile = async (id: string) => {
    setSelectedStudentId(id);
    setLoadingProfile(true);
    try {
      const res = await api.get(`/hostel/students/${id}`);
      setProfileData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Hostel Student Directory & Search</h1>
          <p className="text-xs text-slate-500">
            Search and view comprehensive records for all 1,200 enrolled hostel residents
          </p>
        </div>
        <button
          onClick={fetchStudents}
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filters Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name, roll number, room number, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </form>

          <select
            value={blockFilter}
            onChange={(e) => {
              setBlockFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All Blocks</option>
            <option value="block-a">Block A - Annapurna</option>
            <option value="block-b">Block B - Arundhati</option>
            <option value="block-c">Block C - Anuradha</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Status Filter:</span>
          {['All', 'Inside', 'Outside', 'On Leave'].map((st) => (
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

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading student directory...</div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No students found matching current criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Room / Block</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Curfew Attendance</th>
                  <th className="py-2.5 px-3">Live Status</th>
                  <th className="py-2.5 px-3 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((std) => (
                  <tr key={std.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{std.full_name}</p>
                      <p className="text-[11px] text-slate-400">{std.email}</p>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">{std.roll_number}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{std.room_number}</span>
                      <p className="text-[10px] text-slate-400">{std.block_name}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{std.department}</td>
                    <td className="py-3 px-3">
                      <span className="flex items-center gap-1 font-mono text-slate-600 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400" /> {std.phone}
                      </span>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(std.today_attendance || 'Present')}</td>
                    <td className="py-3 px-3">{getStatusBadge(std.current_status)}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleOpenProfile(std.id)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        View Profile
                      </button>
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

      {/* Comprehensive Student Profile Modal */}
      <Modal
        isOpen={!!selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
        title="Student Profile & Safety Dossier"
        subtitle={profileData?.student?.full_name}
        maxWidth="2xl"
      >
        {loadingProfile ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading student profile dossier...</div>
        ) : profileData?.student ? (
          <div className="space-y-6 text-xs">
            {/* Top Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl border border-blue-200">
                  {profileData.student.full_name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{profileData.student.full_name}</h3>
                  <p className="text-slate-500 text-xs">
                    Roll No: <span className="font-semibold text-slate-800">{profileData.student.roll_number}</span> •{' '}
                    {profileData.student.department} (Year {profileData.student.year_of_study})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Room {profileData.student.room_number} • {profileData.student.block_name}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {getStatusBadge(profileData.student.current_status)}
                <span className="text-[11px] text-slate-500">
                  Biometrics:{' '}
                  <strong className={profileData.student.has_face_enrolled ? 'text-emerald-600' : 'text-amber-600'}>
                    {profileData.student.has_face_enrolled ? 'Enrolled' : 'Pending'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Primary Contact</span>
                <p className="font-bold text-slate-800 mt-0.5">{profileData.student.phone}</p>
                <p className="text-[11px] text-slate-500">Emergency: {profileData.student.emergency_phone}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Parent / Guardian</span>
                <p className="font-bold text-slate-800 mt-0.5">{profileData.student.parent_name}</p>
                <p className="text-[11px] text-slate-500">Phone: {profileData.student.parent_phone}</p>
              </div>
            </div>

            {/* Active Leave / Movement (if any) */}
            {profileData.activeMovement && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="font-bold text-amber-900 text-xs">Active Outside Movement:</span>
                <p className="text-slate-700 text-[11px] mt-0.5">
                  Departed at {profileData.activeMovement.actual_departure_time} to {profileData.activeMovement.destination}. Expected Return:{' '}
                  <strong>{profileData.activeMovement.expected_return_time}</strong>.
                </p>
              </div>
            )}

            {/* Attendance History (Last 10) */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-2">Recent Attendance Records (Last 10 Days)</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Method</th>
                      <th className="py-2 px-3">Distance</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profileData.attendanceHistory?.slice(0, 8).map((att: any) => (
                      <tr key={att.id}>
                        <td className="py-2 px-3 font-medium text-slate-800">{att.date}</td>
                        <td className="py-2 px-3">{getStatusBadge(att.status)}</td>
                        <td className="py-2 px-3 text-slate-500">{att.verification_method}</td>
                        <td className="py-2 px-3 text-slate-500">{att.distance_from_hostel_meters ? `${att.distance_from_hostel_meters}m` : 'N/A'}</td>
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{att.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Open Exceptions (if any) */}
            {profileData.exceptions && profileData.exceptions.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5 text-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Exception Alerts ({profileData.exceptions.length})
                </h4>
                <div className="space-y-2">
                  {profileData.exceptions.map((e: any) => (
                    <div key={e.id} className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{e.title}</span>
                        {getStatusBadge(e.status)}
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1">{e.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
