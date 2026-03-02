import { useEffect, useState } from "react";
import axios from "axios";

function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: "", course_id: "" });
  const [editingId, setEditingId] = useState(null);

  const token = localStorage.getItem("token");

  // Fetch subjects and courses
  useEffect(() => {
    const loadData = async () => {
      try {
        const [subjectsRes, coursesRes] = await Promise.all([
          axios.get("http://localhost:5000/api/subjects", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("http://localhost:5000/api/courses", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setSubjects(subjectsRes.data);
        setCourses(coursesRes.data);
      } catch (err) {
        console.error("Load error:", err);
        alert("Failed to load subjects or courses");
      }
    };

    if (token) loadData();
  }, [token]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!form.course_id) return alert("Please select a course");

      if (editingId) {
        await axios.put(
          `http://localhost:5000/api/subjects/${editingId}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEditingId(null);
      } else {
        await axios.post("http://localhost:5000/api/subjects", form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setForm({ name: "", course_id: "" });

      const [subjectsRes] = await Promise.all([
        axios.get("http://localhost:5000/api/subjects", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setSubjects(subjectsRes.data);
    } catch (err) {
      console.error("Add/update subject error:", err);
      alert(editingId ? "Failed to update subject" : "Failed to add subject");
    }
  };

  const handleEdit = (subject) => {
    setForm({ name: subject.name, course_id: subject.course_id });
    setEditingId(subject.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/subjects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubjects(subjects.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete subject error:", err);
      alert("Failed to delete subject");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manage Subjects</h2>

      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        <h3>{editingId ? "Edit Subject" : "Add New Subject"}</h3>

        <input
          name="name"
          placeholder="Subject Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <br /><br />

        <select name="course_id" value={form.course_id} onChange={handleChange} required>
          <option value="">Select Course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <br /><br />

        <button type="submit">{editingId ? "Update Subject" : "Add Subject"}</button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ name: "", course_id: "" });
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Subjects Table */}
      <h3>All Subjects</h3>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Subject Name</th>
            <th>Course</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => {
            const courseName = courses.find((c) => c.id === subject.course_id)?.name || "-";
            return (
              <tr key={subject.id}>
                <td>{subject.name}</td>
                <td>{courseName}</td>
                <td>
                  <button onClick={() => handleEdit(subject)}>Edit</button>
                  <button onClick={() => handleDelete(subject.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Subjects;