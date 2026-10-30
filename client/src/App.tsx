import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/auth/LoginPage';

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAttendancePage } from './pages/student/StudentAttendancePage';
import { StudentLeavePage } from './pages/student/StudentLeavePage';
import { StudentHistoryPage } from './pages/student/StudentHistoryPage';
import { StudentNotificationsPage } from './pages/student/StudentNotificationsPage';

// Warden Pages
import { WardenDashboard } from './pages/warden/WardenDashboard';
import { LeaveApprovalPage } from './pages/warden/LeaveApprovalPage';
import { MovementManagementPage } from './pages/warden/MovementManagementPage';
import { LiveHostelStatusPage } from './pages/warden/LiveHostelStatusPage';
import { AttentionRequiredPage } from './pages/warden/AttentionRequiredPage';
import { RoomMonitoringPage } from './pages/room/RoomMonitoringPage';
import { StudentSearchPage } from './pages/student-search/StudentSearchPage';
import { ReportsPage } from './pages/reports/ReportsPage';

// Admin Pages
import { StudentManagementPage } from './pages/admin/StudentManagementPage';
import { HostelConfigPage } from './pages/admin/HostelConfigPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { SystemSettingsPage } from './pages/admin/SystemSettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return sessionStorage.getItem('hostel_current_route') || '';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);

  // Restore route or set default route whenever user or role changes
  useEffect(() => {
    if (user) {
      const savedRoute = sessionStorage.getItem('hostel_current_route');
      if (savedRoute && (
        (user.role === 'student' && savedRoute.startsWith('student-')) ||
        (user.role !== 'student' && !savedRoute.startsWith('student-'))
      )) {
        setCurrentRoute(savedRoute);
      } else {
        const defaultRoute = user.role === 'student' ? 'student-dashboard' : 'warden-dashboard';
        setCurrentRoute(defaultRoute);
        sessionStorage.setItem('hostel_current_route', defaultRoute);
      }
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-semibold">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Starting Hostel Safety Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    sessionStorage.setItem('hostel_current_route', route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectStudentForSearch = (studentId: string) => {
    setFocusedStudentId(studentId);
    setCurrentRoute('student-search');
  };

  const renderCurrentView = () => {
    switch (currentRoute) {
      // Student Routes
      case 'student-dashboard':
        return <StudentDashboard onNavigate={navigateTo} />;
      case 'student-attendance':
        return <StudentAttendancePage onBack={() => navigateTo('student-dashboard')} />;
      case 'student-leave':
        return <StudentLeavePage onBack={() => navigateTo('student-dashboard')} />;
      case 'student-history':
        return <StudentHistoryPage onBack={() => navigateTo('student-dashboard')} />;
      case 'student-notifications':
        return <StudentNotificationsPage onBack={() => navigateTo('student-dashboard')} />;

      // Warden Routes
      case 'warden-dashboard':
        return <WardenDashboard onNavigate={navigateTo} onOpenStudentModal={handleSelectStudentForSearch} />;
      case 'warden-leaves':
        return <LeaveApprovalPage />;
      case 'warden-movements':
        return <MovementManagementPage />;
      case 'warden-live-status':
        return <LiveHostelStatusPage />;
      case 'warden-attention':
        return <AttentionRequiredPage />;
      case 'room-monitoring':
        return <RoomMonitoringPage onSelectStudent={handleSelectStudentForSearch} />;
      case 'student-search':
        return (
          <StudentSearchPage
            initialStudentId={focusedStudentId}
            onClearInitialStudentId={() => setFocusedStudentId(null)}
          />
        );
      case 'reports':
        return <ReportsPage />;

      // Admin Routes
      case 'admin-students':
        return <StudentManagementPage />;
      case 'admin-hostel':
        return <HostelConfigPage />;
      case 'admin-users':
        return <UserManagementPage />;
      case 'admin-settings':
        return <SystemSettingsPage />;
      case 'admin-audit':
        return <AuditLogsPage />;

      default:
        return user.role === 'student' ? (
          <StudentDashboard onNavigate={navigateTo} />
        ) : (
          <WardenDashboard onNavigate={navigateTo} onOpenStudentModal={handleSelectStudentForSearch} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col font-sans">
      <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="flex-1 flex">
        <Sidebar
          currentRoute={currentRoute}
          onNavigate={navigateTo}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
