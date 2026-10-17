import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, Search, CheckCircle2, AlertCircle, Camera, RefreshCw, Trash2 } from 'lucide-react';
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
    department: 'Computer Science & Engg',
    year_of_study: 1
  });

  // Face Enrollment Modal
  const [enrollingStudent, setEnrollingStudent] = useState<Student | null>(null);
  const [enrollingSuccess, setEnrollingSuccess] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stdRes, hRes] = await Promise.all([
        api.get(`/hostel/students?search=${searchTerm}&limit=20`),
        api.get('/hostel/hierarchy')
      ]);
      setStudents(stdRes.students || []);
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
    fetchData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await api.post('/admin/students', form);
      setMsg({ type: 'success', text: res.message });
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
        department: 'Computer Science & Engg',
        year_of_study: 1
      });
      fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Registration failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearDemoStudents = async () => {
    if (!confirm('This will remove all 1,200 synthetic demo students, movements, and attendance logs, leaving a clean campus structure for your real students. Continue?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/admin/clear-demo-students');
      setMsg({ type: 'success', text: res.message });
      fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to clear demo data' });
    } finally {
      setLoading(false);
    }
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
            title="Wipe 1,200 synthetic demo records to start fresh with real students"
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
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">Registered Residents ({students.length})</h3>
          <button
            onClick={fetchData}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
                <th className="py-2.5 px-3 text-right">Biometric Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((std) => (
                <tr key={std.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-bold text-slate-900">{std.full_name}</td>
                  <td className="py-3 px-3 font-mono font-medium text-slate-700">{std.roll_number}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">{std.room_number}</span>
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
                    <button
                      onClick={() => setEnrollingStudent(std)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      {std.has_face_enrolled ? 'Re-enroll Face' : 'Enroll Face'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                placeholder="e.g. 2024CS999"
                value={form.roll_number}
                onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Manav Saxena"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Student Email *</label>
              <input
                type="email"
                placeholder="student@hostelsafety.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Student Phone *</label>
              <input
                type="text"
                placeholder="+91 98..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                value={form.parent_name}
                onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Parent Phone Number</label>
              <input
                type="text"
                value={form.parent_phone}
                onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assign Hostel Room *</label>
              <select
                value={form.room_id}
                onChange={(e) => setForm({ ...form, room_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {rooms.slice(0, 50).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} (Occupied: {r.student_count || 4}/{r.capacity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Academic Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Register Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Real Live Camera Face Biometric Enrollment Modal */}
      <FaceEnrollModal
        isOpen={!!enrollingStudent}
        onClose={() => setEnrollingStudent(null)}
        studentName={enrollingStudent ? `${enrollingStudent.full_name} (${enrollingStudent.roll_number})` : ''}
        studentId={enrollingStudent?.id}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
};
