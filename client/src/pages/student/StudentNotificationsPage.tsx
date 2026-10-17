import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Clock, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { NotificationItem } from '../../types';

interface StudentNotificationsPageProps {
  onBack: () => void;
}

export const StudentNotificationsPage: React.FC<StudentNotificationsPageProps> = ({ onBack }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/notifications');
      setNotifications(res.notifications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/student/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (e) {}
  };

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Safety Notifications & System Alerts
          </h1>
          <p className="text-xs text-slate-500">Official notices regarding curfew deadlines, leave decisions, and security alerts</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No notifications found.</div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkAsRead(n.id)}
                className={`p-4 rounded-xl border text-xs transition-colors cursor-pointer flex items-start gap-3 ${
                  n.is_read
                    ? 'bg-slate-50/50 border-slate-200 text-slate-600'
                    : 'bg-blue-50/40 border-blue-200 text-slate-900 font-medium'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{n.title}</h4>
                    <span className="text-[11px] text-slate-400 font-mono">{n.created_at}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
