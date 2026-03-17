import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { supabase } from '../../lib/supabase';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  BarChart3,
  ClipboardList
} from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, fetchCourses, fetchSubjects, fetchStudents, fetchGrades, fetchStudentSubjects } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const initUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (data) {
          setUser(data);
          await Promise.all([
            fetchCourses(),
            fetchSubjects(),
            fetchStudents(),
            fetchGrades(),
            fetchStudentSubjects()
          ]);
        }
      } else {
        navigate('/auth/login');
      }
    };
    
    initUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/auth/login');
  };

  const navItems = user?.role === 'admin' ? [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/courses', label: 'Courses', icon: BookOpen },
    { path: '/admin/subjects', label: 'Subjects', icon: ClipboardList },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  ] : user?.role === 'teacher' ? [
    { path: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/teacher/my-subjects', label: 'My Subjects', icon: BookOpen },
    { path: '/teacher/grades', label: 'Grade Entry', icon: ClipboardList },
    { path: '/teacher/analytics', label: 'Analytics', icon: BarChart3 },
  ] : [
    { path: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/student/subjects', label: 'My Subjects', icon: BookOpen },
    { path: '/student/grades', label: 'My Grades', icon: GraduationCap },
    { path: '/student/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-maroon-950 to-black">
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-black/40 backdrop-blur-xl border border-maroon-700/50 text-white"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-black/60 backdrop-blur-xl border-r border-maroon-800/50 z-40 transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-maroon-600 to-gold-500 flex items-center justify-center">
              <GraduationCap className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold text-white">EduAnalytics</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  location.pathname === item.path
                    ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                    : 'text-gray-400 hover:bg-maroon-900/50 hover:text-white'
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="pt-6 border-t border-maroon-800/50">
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-maroon-900/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-600 to-gold-500 flex items-center justify-center text-white font-semibold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{user?.name}</p>
                  <p className="text-gray-400 text-sm capitalize">{user?.role}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              
              {profileOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-maroon-950/90 backdrop-blur-xl rounded-xl border border-maroon-700/50 overflow-hidden">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-maroon-950 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
};
