import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
// import { GlassCard, Button } from '../ui';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'admin';
  const items = menuItems[role as keyof typeof menuItems] || menuItems.admin;

  const currentPage = location.pathname.split('/')[2] || 'dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Glassmorphism background */}
      <div className="fixed inset-0 bg-white/10 backdrop-blur-3xl border border-white/20" />

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`z-40 w-64 maroon-sidebar flex flex-col fixed md:sticky top-0 left-0 h-screen transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="mb-6 px-4 pt-6">
          <div className="flex items-center gap-3">
            <img 
              src="/src/assets/logo.png" 
              className="w-10 h-10 object-contain drop-shadow-lg" 
              alt="SAPAS Logo" 
            />
            <div>
              <h1 className="text-lg font-bold text-maroon-100">Edulytics PHILTECH</h1>
              <p className="text-xs text-maroon-200">Academic Performance System</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="mx-4 mb-4 p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-700 flex items-center justify-center text-white font-bold shadow-md">
              {user?.name?.[0] || user?.first_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-maroon-100 truncate">
                {user?.name || `${user?.first_name} ${user?.last_name}` || 'User'}
              </p>
              <p className="text-xs text-maroon-200 capitalize">{role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {items.map(item => (
            <Link
              key={item.id}
              to={`/${role}/${item.id}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                currentPage === item.id
                  ? 'bg-gold-400/30 backdrop-blur-sm border border-gold-400/50 text-black-800 shadow-lg hover:shadow-xl gold-glow'
                  : 'text-maroon-200 hover:bg-white/20 hover:shadow-md hover:maroon-glow'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <i className={`hgi-stroke hgi-${item.icon} text-lg flex-shrink-0`}></i>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="mx-4 mb-6 pt-4 border-t border-white/30">
<button 
            className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg hover:bg-white/20 hover:shadow-2xl hover:border-white/40 transition-all duration-300 hover:maroon-glow text-maroon-200"
            onClick={handleLogout}
          >
            <i className="hgi-stroke hgi-logout-01 text-lg"></i>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-6 md:p-8 lg:p-12 min-h-screen bg-white/50 backdrop-blur-sm">
        {/* Mobile Header with Hamburger */}
        <header className="flex items-center justify-between mb-6 md:mb-10">
          <div className="flex items-center gap-4">
            <button 
            className="md:hidden p-3 rounded-2xl bg-white/40 backdrop-blur-lg text-maroon-100 border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 glass-hover"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="hgi-stroke hgi-menu-05 text-xl"></i>
            </button>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800 bg-gradient-to-r from-maroon-800 to-maroon-600 bg-clip-text text-transparent drop-shadow-lg">{title}</h1>
              <p className="text-gray-500 mt-1 hidden md:block font-medium">Welcome back, {user?.name || user?.first_name || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 md:px-5 rounded-2xl glass-card glass-hover">
              <span className="text-sm text-gray-700 font-medium"><i className="hgi-stroke hgi-calendar-01 mr-2"></i>{new Date().toLocaleDateString()}</span>
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

