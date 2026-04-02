import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { GlassCard, Button } from '../ui';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

const menuItems = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'hgi-dashboard-square-01' },
    { id: 'users', label: 'Users', icon: 'hgi-user-multiple' },
    { id: 'courses', label: 'Courses', icon: 'hgi-book-user' },
    { id: 'subjects', label: 'Subjects', icon: 'hgi-school-tie' },
    { id: 'analytics', label: 'Analytics', icon: 'hgi-chart' },
  ],
  teacher: [
    { id: 'dashboard', label: 'Dashboard', icon: 'hgi-dashboard-square-01' },
    { id: 'subjects', label: 'My Subjects', icon: 'hgi-school-tie' },
    { id: 'grades', label: 'Grades', icon: 'hgi-edit-user-02' },
    { id: 'students', label: 'Students', icon: 'hgi-student' },
    { id: 'analytics', label: 'Analytics', icon: 'hgi-chart' },
    { id: 'upload', label: 'Upload Grades', icon: 'hgi-upload' },
  ],
  student: [
    { id: 'dashboard', label: 'Dashboard', icon: 'hgi-dashboard-square-01' },
    { id: 'subjects', label: 'My Subjects', icon: 'hgi-school-tie' },
    { id: 'grades', label: 'My Grades', icon: 'hgi-edit-user-02' },
    { id: 'analytics', label: 'Analytics', icon: 'hgi-chart' },
  ],
};

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const role = user?.role || 'admin';
  const items = menuItems[role as keyof typeof menuItems] || menuItems.admin;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentPage = location.pathname.split('/')[2] || 'dashboard';

  return (
    <div className="min-h-screen flex">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#f5f5f5] via-[#e8e8e8] to-[#d4d4d4]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-64 h-64 bg-[#800000]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d4af37]/10 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="relative z-10 w-64 min-h-screen bg-white/20 backdrop-blur-xl border-r border-white/30 p-4 flex flex-col">
        {/* Logo */}
        <div className="mb-8 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center shadow-lg">
              <i className="hgi-stroke hgi-mortarboard-01 text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#800000]">SAPAS</h1>
              <p className="text-xs text-gray-500">Academic System</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <GlassCard className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white font-bold">
              {user?.name?.[0] || user?.first_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name || `${user?.first_name} ${user?.last_name}` || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">{role}</p>
            </div>
          </div>
        </GlassCard>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {items.map(item => (
            <Link
              key={item.id}
              to={`/${role}/${item.id}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                currentPage === item.id || activeMenu === item.id
                  ? 'bg-gradient-to-r from-[#800000] to-[#a52a2a] text-white shadow-lg'
                  : 'text-gray-700 hover:bg-white/40'
              }`}
            >
              <i className={`hgi-stroke hgi-${item.icon} text-lg`}></i>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="mt-4 pt-4 border-t border-white/30">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-gray-700"
            onClick={handleLogout}
          >
            <i className="hgi-stroke hgi-logout-01 mr-2"></i> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#800000]">{title}</h1>
            <p className="text-gray-500 mt-1">Welcome back, {user?.name || user?.first_name || 'User'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-xl bg-white/30 backdrop-blur-sm border border-white/30">
              <span className="text-sm text-gray-600"><i className="hgi-stroke hgi-calendar-01 mr-2"></i>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}