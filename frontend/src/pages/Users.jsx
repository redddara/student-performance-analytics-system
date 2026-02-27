import { useEffect, useState, useCallback } from "react";
import axios from "axios";

function Users() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [editingUser, setEditingUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data);
    } catch  {
      alert("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("student");
    setEditingUser(null);
  };

  // Add / Update
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        await axios.put(
          `http://localhost:5000/api/users/${editingUser.id}`,
          { email, password, role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("User updated successfully!");
      } else {
        await axios.post(
          "http://localhost:5000/api/users",
          { email, password, role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage("User added successfully!");
      }

      resetForm();
      fetchUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.error || "Operation failed");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setEmail(user.email);
    setRole(user.role);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "This user will be permanently deleted. Continue?"
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(`http://localhost:5000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage("User deleted successfully!");
      fetchUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
      <h2 style={{ marginBottom: "20px" }}>Manage Users (Admin)</h2>

      {message && (
        <div
          style={{
            backgroundColor: "#e6ffed",
            color: "#065f46",
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "6px",
          }}
        >
          {message}
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#f9f9f9",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "30px",
        }}
      >
        <h3>{editingUser ? "Edit User" : "Add New User"}</h3>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <input
          type="password"
          placeholder={editingUser ? "Leave blank to keep password" : "Password"}
          onChange={(e) => setPassword(e.target.value)}
          required={!editingUser}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "15px" }}
        >
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>

        <button
          type="submit"
          style={{
            padding: "8px 15px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          {editingUser ? "Update User" : "Add User"}
        </button>

        {editingUser && (
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "8px 15px",
              backgroundColor: "#9ca3af",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Table */}
      <h3>All Users</h3>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "15px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <th style={{ padding: "10px", textAlign: "left" }}>Email</th>
              <th style={{ padding: "10px", textAlign: "left" }}>Role</th>
              <th style={{ padding: "10px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "10px" }}>{user.email}</td>
                <td style={{ padding: "10px" }}>{user.role}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>
                  <button
                    onClick={() => handleEdit(user)}
                    style={{
                      marginRight: "8px",
                      padding: "5px 10px",
                      backgroundColor: "#f59e0b",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    style={{
                      padding: "5px 10px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Users;