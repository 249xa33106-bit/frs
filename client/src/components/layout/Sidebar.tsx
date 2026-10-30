import React from 'react';
import {
  LayoutDashboard,
  Camera,
  CalendarDays,
  History,
  Bell,
  CheckSquare,
  Footprints,
  Radio,
  AlertTriangle,
  Building2,
  Users,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const role = user?.role || 'student';

  // Navigation configurations
  const studentNav = [
    { id: 'student-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { id: 'student-attendance', label: 'Give Attendance (FRS)', icon: Camera },
    { id: 'student-leave', label: 'Outgoing / Leave Application', icon: CalendarDays },
    { id: 'student-history', label: 'Movement & Leave History', icon: History },
    { id: 'student-notifications', label: 'Notifications', icon: Bell }
  ];

  const wardenNav = [
    { id: 'warden-dashboard', label: 'Warden Dashboard', icon: LayoutDashboard },
    { id: 'warden-leaves', label: 'Leave Approval Queue', icon: CheckSquare },
    { id: 'warden-movements', label: 'Movement Management', icon: Footprints },
    { id: 'warden-live-status', label: 'Live Hostel Status', icon: Radio },
    { id: 'warden-attention', label: 'Attention Required', icon: AlertTriangle },
    { id: 'room-monitoring', label: 'Room-Wise Monitoring', icon: Building2 },
    { id: 'student-search', label: 'Student Search & Profile', icon: Users },
    { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet }
  ];

  const adminNav = [
    { id: 'warden-dashboard', label: 'Operations Overview', icon: LayoutDashboard },
    { id: 'admin-students', label: 'Student Management', icon: UserCheck },
    { id: 'admin-hostel', label: 'Hostel & Room Config', icon: Building2 },
    { id: 'admin-users', label: 'User & Role Management', icon: Users },
    { id: 'admin-settings', label: 'System Settings', icon: Settings },
    { id: 'admin-audit', label: 'Audit Logs', icon: ShieldAlert },
    { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet }
  ];

  const navItems = role === 'student' ? studentNav : role === 'admin' ? adminNav : wardenNav;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="py-4 px-3 overflow-y-auto">
          {/* Role Section Header */}
          <div className="px-3 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {role === 'student' ? 'Student Portal' : role === 'admin' ? 'Administrator Portal' : 'Warden Portal'}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
              v2.4
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/90 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-xs">
              <img src="/logo.png" alt="GPREC Logo" className="w-full h-full object-contain" />
            </div>
            <div className="text-[11px] text-slate-500 min-w-0">
              <span className="font-semibold text-slate-800 block truncate">GPREC Hostel Campus</span>
              <p className="text-[10px] text-slate-400">Kurnool • Andhra Pradesh</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
