import { useEffect, useState, useCallback } from "react";
import axios from "axios";

function Students() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade_level: "",
    section: "",
  });
  const [editingId, setEditingId] = useState(null);
  const token = localStorage.getItem("token");

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch {
      alert("Failed to fetch students");
    }
  }, [token]);

  useEffect(() => {
  (async () => {
    await fetchStudents();
  })();
}, [fetchStudents]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({ first_name: "", last_name: "", grade_level: "", section: "" });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(
          `http://localhost:5000/api/students/${editingId}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post("http://localhost:5000/api/students", form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      resetForm();
      fetchStudents();
    } catch {
      alert(editingId ? "Failed to update student" : "Failed to add student");
    }
  };

  const handleEdit = (student) => {
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      grade_level: student.grade_level,
      section: student.section,
    });
    setEditingId(student.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchStudents();
    } catch {
      alert("Failed to delete student");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Students</h1>

      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <h3>{editingId ? "Edit Student" : "Add New Student"}</h3>
        <input
          name="first_name"
          placeholder="First Name"
          value={form.first_name}
          onChange={handleChange}
          required
        />
        <input
          name="last_name"
          placeholder="Last Name"
          value={form.last_name}
          onChange={handleChange}
          required
        />
        <input
          name="grade_level"
          placeholder="Grade Level"
          value={form.grade_level}
          onChange={handleChange}
          required
        />
        <input
          name="section"
          placeholder="Section"
          value={form.section}
          onChange={handleChange}
          required
        />
        <div style={{ marginTop: "10px" }}>
          <button type="submit">{editingId ? "Update Student" : "Add Student"}</button>
          {editingId && (
            <button type="button" onClick={resetForm} style={{ marginLeft: "10px" }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Students Table */}
      <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Grade Level</th>
            <th>Section</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.first_name}</td>
              <td>{s.last_name}</td>
              <td>{s.grade_level}</td>
              <td>{s.section}</td>
              <td>
                <button onClick={() => handleEdit(s)}>Edit</button>
                <button onClick={() => handleDelete(s.id)} style={{ marginLeft: "5px" }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                No students found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Students;