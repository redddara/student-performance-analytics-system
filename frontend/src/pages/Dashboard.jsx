import { Link } from "react-router-dom";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  // Dashboard sections based on role
  const adminLinks = [
    { path: "/users", label: "Manage Users" },
    { path: "/students", label: "Manage Students" },
    { path: "/courses", label: "Course Management" },   // Added
    { path: "/subjects", label: "Subject Management" } // Added
  ];

  const teacherLinks = [
    { path: "/students", label: "Manage Students" },
    { path: "/add-grade", label: "Manage Grade" },
    { path: "/grades", label: "Students Grades" },
  ];

  const studentLinks = [
    { path: "/my-grades", label: "My Grades" },
  ];

  let linksToShow = [];
  if (user?.role === "admin") linksToShow = adminLinks;
  else if (user?.role === "teacher") linksToShow = teacherLinks;
  else if (user?.role === "student") linksToShow = studentLinks;

  return (
    <div style={{ padding: "20px" }}>
      <h1>Welcome, {user?.email}</h1>
      <h3>Role: {user?.role}</h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", marginTop: "20px" }}>
        {linksToShow.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            style={{
              padding: "15px 25px",
              backgroundColor: "#4f46e5",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              transition: "background-color 0.3s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#3730a3")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#4f46e5")}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;