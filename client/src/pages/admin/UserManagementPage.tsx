import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { User, UserRole } from '../../types';
import { Modal } from '../../components/common/Modal';

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'warden' as UserRole,
    full_name: '',
    phone: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users?limit=30');
      setUsers(res.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    try {
      const res = await api.post('/admin/users', form);
      setSuccessMsg(res.message);
      setShowAddModal(false);
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'warden',
        full_name: '',
        phone: ''
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Creation failed');
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
            <Users className="w-6 h-6 text-blue-600" />
            Staff & User Role Administration
          </h1>
          <p className="text-xs text-slate-500">Manage warden accounts, system administrators, and access privileges</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Account</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">System Staff Accounts</h3>
          <button
            onClick={fetchUsers}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-bold text-slate-900">{u.full_name}</td>
                  <td className="py-3 px-3 font-mono font-medium text-slate-700">{u.username}</td>
                  <td className="py-3 px-3 text-slate-600">{u.email}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : u.role === 'warden'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">{u.phone || '—'}</td>
                  <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{u.last_login || 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Staff User Account"
        subtitle="Provision access for new wardens or hostel administration staff"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Dr. Ramesh Chander"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                placeholder="e.g. warden_c"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="warden">Hostel Warden</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Email *</label>
              <input
                type="email"
                placeholder="warden@hostelsafety.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="+91 98..."
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
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
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
