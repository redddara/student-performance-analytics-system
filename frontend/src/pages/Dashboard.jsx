function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="page">
      <h1>Welcome, {user?.email}</h1>
      <h3>Role: {user?.role}</h3>

      <div style={{ marginTop: "30px" }}>
        <p>Use the sidebar to navigate through the system.</p>
      </div>
    </div>
  );
}

export default Dashboard;