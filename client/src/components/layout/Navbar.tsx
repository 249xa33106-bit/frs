import React, { useState, useEffect } from 'react';
import { ShieldCheck, Bell, LogOut, CheckCircle2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { NotificationItem } from '../../types';

interface NavbarProps {
  onToggleSidebar?: () => void;
  currentPageTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, currentPageTitle }) => {
  const { user, student, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<{ status: string; engine: string; dbStatus: string }>({
    status: 'checking',
    engine: '...',
    dbStatus: '...'
  });

  useEffect(() => {
    // Check system status
    api.get('/system/status')
      .then((res) => {
        const isPg = res.services?.databaseDetails?.postgresConnected;
        const dbLabel = isPg ? 'PostgreSQL' : 'SQLite';
        if (res.services?.pythonFaceService?.status === 'Connected') {
          setServiceStatus({ status: 'Connected', engine: 'OpenCV Microservice', dbStatus: dbLabel });
        } else {
          setServiceStatus({ status: 'Integrated', engine: 'Client Matcher', dbStatus: dbLabel });
        }
      })
      .catch(() => {
        setServiceStatus({ status: 'Offline', engine: 'Fallback', dbStatus: 'Offline' });
      });

    // Fetch notifications
    const fetchNotifs = async () => {
      try {
        if (user?.role === 'student') {
          const res = await api.get('/student/notifications');
          setNotifications(res.notifications || []);
        }
      } catch (e) {}
    };
    fetchNotifs();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs h-16 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Brand & Mobile Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          aria-label="Toggle navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200/90 p-0.5 shadow-xs shrink-0 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="GPREC Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">GPREC Hostel Safety</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                Official
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 font-medium">G. Pulla Reddy Engineering College • Kurnool</p>
          </div>
        </div>

        {currentPageTitle && (
          <div className="hidden xl:flex items-center pl-6 border-l border-slate-200 ml-4">
            <span className="text-sm font-semibold text-slate-700">{currentPageTitle}</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Python OpenCV Service Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className={`w-2 h-2 rounded-full ${serviceStatus.status === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
          <span className="font-medium text-slate-700">FRS:</span>
          <span>{serviceStatus.engine}</span>
        </div>

        {/* Database Engine Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className={`w-2 h-2 rounded-full ${serviceStatus.dbStatus === 'PostgreSQL' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
          <span className="font-medium text-slate-700">DB:</span>
          <span className="font-semibold text-slate-800">{serviceStatus.dbStatus}</span>
        </div>

        {/* Authenticated User Role Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="capitalize">{user?.role}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Notifications</span>
                <span className="text-[11px] text-blue-600 font-medium">{unreadCount} unread</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 py-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">No new notifications</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-3 hover:bg-slate-50 transition-colors text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{notif.title}</span>
                      </div>
                      <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">{notif.created_at}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
            {user?.full_name ? user.full_name[0] : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.full_name}</p>
            <p className="text-[11px] text-slate-500 capitalize">{student ? `Room ${student.room_number}` : user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
