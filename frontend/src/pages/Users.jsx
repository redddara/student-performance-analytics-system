import { useEffect, useState, useCallback } from "react";
import axios from "axios";

function Users() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  const token = localStorage.getItem("token");

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch users");
    }
  }, [token]);

  useEffect(() => {
  const fetch = async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch users");
    }
  };

  fetch();
}, [token]);

  // Add new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        "http://localhost:5000/api/users",
        { email, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("User added successfully!");
      setEmail("");
      setPassword("");
      setRole("student");
      fetchUsers(); // refresh list
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to add user");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manage Users (Admin)</h2>

      {/* Add User Form */}
      <form onSubmit={handleAddUser} style={{ marginBottom: "30px" }}>
        <h3>Add New User</h3>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br /><br />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
        <br /><br />
        <button type="submit">Add User</button>
      </form>

      {/* Users Table */}
      <h3>All Users</h3>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id || user._id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Users;