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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data);
    } catch {
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
    <div className="page">

      <h2>Manage Users</h2>

      {message && (
        <div className="card" style={{background:"#e6ffed", color:"#065f46"}}>
          {message}
        </div>
      )}

      {/* Form */}
      <div className="card">

        <h3>{editingUser ? "Edit User" : "Add New User"}</h3>

        <form onSubmit={handleSubmit} className="student-form">

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder={editingUser ? "Leave blank to keep password" : "Password"}
            onChange={(e) => setPassword(e.target.value)}
            required={!editingUser}
          />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              {editingUser ? "Update User" : "Add User"}
            </button>

            {editingUser && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>

        </form>

      </div>

      {/* Table */}
      <div className="card">

        <h3>All Users</h3>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="table-wrapper">

            <table className="table">

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
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(user.id)}
                      >
                        Delete
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}

export default Users;