import { Link, useLocation } from "react-router-dom";
import "./layout.css";

function Layout({ children, role }) {
  const location = useLocation();

  const links = {
    admin: [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/users", label: "Users" },
      { path: "/students", label: "Students" },
      { path: "/courses", label: "Courses" },
      { path: "/subjects", label: "Subjects" },
      { path: "/analytics", label: "Analytics" },
    ],
    teacher: [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/students", label: "Students" },
      { path: "/grades", label: "Grades" },
      { path: "/analytics", label: "Analytics" },
      { path: "/add-grade", label: "Add Grade" },
    ],
    student: [
      { path: "/dashboard", label: "Dashboard" },
      { path: "/my-grades", label: "My Grades" },
    ],
  };

  return (
    <div className={`layout role-${role}`}>
      <aside className="sidebar">
              <button
        className="btn"
        onClick={() => document.body.classList.toggle("dark")}
      >
        Toggle Dark
      </button>
        <h2 className="logo">SchoolSys</h2>

        {links[role]?.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`sidebar-link ${
              location.pathname === link.path ? "active" : ""
            }`}
          >
            {link.label}
          </Link>
        ))}
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}

export default Layout;