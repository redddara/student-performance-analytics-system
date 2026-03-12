import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./layout.css";

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop collapsed/expanded
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile dropdown
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // Detect mobile

  // User role
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "student";

  const links = {
    admin: [
      { path: "/dashboard", label: "Dashboard", icon: "📊" },
      { path: "/users", label: "Users", icon: "👤" },
      { path: "/students", label: "Students", icon: "🎓" },
      { path: "/courses", label: "Courses", icon: "📚" },
      { path: "/subjects", label: "Subjects", icon: "📝" },
      { path: "/analytics", label: "Analytics", icon: "📈" },
    ],
    teacher: [
      { path: "/dashboard", label: "Dashboard", icon: "📊" },
      { path: "/students", label: "Students", icon: "🎓" },
      { path: "/grades", label: "Grades", icon: "📝" },
      { path: "/analytics", label: "Analytics", icon: "📈" },
      { path: "/add-grade", label: "Add Grade", icon: "➕" },
    ],
    student: [
      { path: "/dashboard", label: "Dashboard", icon: "📊" },
      { path: "/my-grades", label: "My Grades", icon: "📝" },
    ],
  };

  const roleLinks = links[role] || [];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // Update isMobile when window resizes
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false); // Close mobile menu if switching to desktop
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // initial check

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`layout ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isMobile ? "mobile" : ""} ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2 className="logo">Philtech</h2>

          {/* Hamburger (mobile only) */}
          {isMobile && (
            <div
              className={`hamburger ${mobileMenuOpen ? "active" : ""}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}

          {/* Toggle button for desktop */}
          {!isMobile && (
            <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              
            </button>
          )}
        </div>

        {/* Links */}
        <div className={`sidebar-links ${isMobile && mobileMenuOpen ? "dropdown" : ""}`}>
          {roleLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`sidebar-link ${location.pathname === link.path ? "active" : ""}`}
              onClick={() => isMobile && setMobileMenuOpen(false)}
            >
              <span className="icon">{link.icon}</span>
              {(!isMobile || sidebarOpen) && link.label}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn" onClick={() => document.body.classList.toggle("dark")}>
            🌙 Dark Mode
          </button>

          <button className="btn logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;