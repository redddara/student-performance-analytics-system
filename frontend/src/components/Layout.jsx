import { Link, useNavigate } from "react-router-dom";

function Layout({ children }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* Sidebar */}
      <div style={{
        width: "220px",
        background: "#1e293b",
        color: "white",
        padding: "20px"
      }}>
        <h2>Analytics</h2>
        <nav>
          <p><Link to="/dashboard" style={{ color: "white" }}>Dashboard</Link></p>
          <p><Link to="/students" style={{ color: "white" }}>Students</Link></p>
        </nav>
        <button onClick={handleLogout} style={{ marginTop: "20px" }}>
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "30px", background: "#f1f5f9" }}>
        {children}
      </div>

    </div>
  );
}

export default Layout;