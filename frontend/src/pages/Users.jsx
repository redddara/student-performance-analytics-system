import { useEffect, useState, useCallback } from "react";
import axios from "axios";

function Users() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [editingUser, setEditingUser] = useState(null);

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
  const fetchData = async () => {
    await fetchUsers();
  };
  fetchData();
}, [fetchUsers]);

  // Add or update user
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        // Update user
        await axios.put(
          `http://localhost:5000/api/users/${editingUser.id}`,
          { email, password, role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEditingUser(null);
      } else {
        // Add user
        await axios.post(
          "http://localhost:5000/api/users",
          { email, password, role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setEmail("");
      setPassword("");
      setRole("student");
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add/update user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEmail(user.email);
    setRole(user.role);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manage Users (Admin)</h2>

      {/* Add/Edit User Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        <h3>{editingUser ? "Edit User" : "Add New User"}</h3>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br /><br />

        <input
          type="password"
          placeholder={editingUser ? "Leave blank to keep password" : "Password"}
          onChange={(e) => setPassword(e.target.value)}
          required={!editingUser}
        />
        <br /><br />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
        <br /><br />

        <button type="submit">{editingUser ? "Update User" : "Add User"}</button>
        {editingUser && (
          <button
            type="button"
            onClick={() => {
              setEditingUser(null);
              setEmail("");
              setPassword("");
              setRole("student");
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Users Table */}
      <h3>All Users</h3>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                <button onClick={() => handleEdit(user)}>Edit</button>
                <button onClick={() => handleDelete(user.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Users;