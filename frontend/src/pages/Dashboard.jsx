import { Link } from "react-router-dom";
import Layout from "../components/Layout";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <Layout role={user?.role}>
      <div className="page">
        <h1>Welcome, {user?.email}</h1>
        <h3>Role: {user?.role}</h3>

        {/* You can add any dashboard widgets, stats, or charts here */}
        <div style={{ marginTop: "30px" }}>
          <p>Use the sidebar to navigate through the system.</p>
        </div>
      </div>
    </Layout>
  );
}

export default Dashboard;