import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./layout.css";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  BarChart,
  LogOut,
  Moon,
  Menu
} from "lucide-react";

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop expanded/collapsed
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile dropdown
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // Mobile detection

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "student";

  const links = {
    admin: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/users", label: "Users", icon: Users },
      { path: "/students", label: "Students", icon: GraduationCap },
      { path: "/courses", label: "Courses", icon: BookOpen },
      { path: "/subjects", label: "Subjects", icon: BookOpen },
      { path: "/analytics", label: "Analytics", icon: BarChart }
    ],
    teacher: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/students", label: "Students", icon: GraduationCap },
      { path: "/grades", label: "Grades", icon: BookOpen },
      { path: "/analytics", label: "Analytics", icon: BarChart },
      { path: "/add-grade", label: "Add Grade", icon: BookOpen }
    ],
    student: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/my-grades", label: "My Grades", icon: BookOpen }
    ]
  };

  const roleLinks = links[role] || [];

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // Responsive check
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false); // close mobile menu if switching to desktop
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // initial check
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`layout ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${isMobile ? "mobile" : ""} ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2 className="logo">PhilTech</h2>

          {/* Mobile hamburger (only visible on small screens) */}
          {isMobile && (
            <button
              className="hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu size={24} />
            </button>
          )}

          {/* Desktop toggle (only visible on large screens) */}
          {!isMobile && (
            <button
              className="toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              
            </button>
          )}
        </div>

        {/* NAV LINKS */}
        <div className={`sidebar-links ${isMobile && mobileMenuOpen ? "dropdown" : ""}`}>
          {roleLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`sidebar-link ${location.pathname === link.path ? "active" : ""}`}
                onClick={() => isMobile && setMobileMenuOpen(false)}
              >
                <Icon className="icon" size={18} />
                {(!isMobile || sidebarOpen) && <span className="label">{link.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="sidebar-footer">
          <button className="btn" onClick={() => document.body.classList.toggle("dark")}>
            <Moon size={16} />
            {(!isMobile || sidebarOpen) && "Dark Mode"}
          </button>

          <button className="btn logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            {(!isMobile || sidebarOpen) && "Logout"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;