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

  // Fetch all students
  const fetchStudents = useCallback(async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/students", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(data);
    } catch {
      alert("Failed to fetch students");
    }
  }, [token]);

  // Load students on mount
  useEffect(() => {
    const fetchData = async () => {
      await fetchStudents();
    };
    fetchData();
  }, [fetchStudents]);

  // Handle form input changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Add or update student
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        // Update student
        await axios.put(
          `http://localhost:5000/api/students/${editingId}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEditingId(null);
      } else {
        // Add new student
        await axios.post("http://localhost:5000/api/students", form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setForm({ first_name: "", last_name: "", grade_level: "", section: "" });
      fetchStudents();
    } catch {
      alert(editingId ? "Failed to update student" : "Failed to add student");
    }
  };

  // Populate form for editing
  const handleEdit = (student) => {
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      grade_level: student.grade_level,
      section: student.section,
    });
    setEditingId(student.id);
  };

  // Delete student
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
      <h2>Manage Students</h2>

      {/* Add/Edit Student Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        <h3>{editingId ? "Edit Student" : "Add New Student"}</h3>

        <input
          name="first_name"
          placeholder="First Name"
          value={form.first_name}
          onChange={handleChange}
          required
        />
        <br /><br />

        <input
          name="last_name"
          placeholder="Last Name"
          value={form.last_name}
          onChange={handleChange}
          required
        />
        <br /><br />

        <input
          name="grade_level"
          placeholder="Grade Level"
          value={form.grade_level}
          onChange={handleChange}
          required
        />
        <br /><br />

        <input
          name="section"
          placeholder="Section"
          value={form.section}
          onChange={handleChange}
          required
        />
        <br /><br />

        <button type="submit">{editingId ? "Update Student" : "Add Student"}</button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ first_name: "", last_name: "", grade_level: "", section: "" });
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Students Table */}
      <h3>All Students</h3>
      <table border="1" cellPadding="10">
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
          {students.map((student) => (
            <tr key={student.id}>
              <td>{student.first_name}</td>
              <td>{student.last_name}</td>
              <td>{student.grade_level}</td>
              <td>{student.section}</td>
              <td>
                <button onClick={() => handleEdit(student)}>Edit</button>
                <button onClick={() => handleDelete(student.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Students;