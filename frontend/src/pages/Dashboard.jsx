import { Link } from "react-router-dom";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  // Dashboard sections based on role
  const adminLinks = [
    { path: "/users", label: "Manage Users" },
    { path: "/students", label: "Students" },
    { path: "/my-grades", label: "View Grades" },
  ];

  const teacherLinks = [
    { path: "/students", label: "Students" },
    { path: "/add-grade", label: "Add Grade" },
    { path: "/my-grades", label: "View Grades" },
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