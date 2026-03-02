import { useEffect, useState } from "react";
import axios from "axios";

function Courses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: "" });
  const [editingId, setEditingId] = useState(null);

  const token = localStorage.getItem("token");

  // Fetch courses
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const { data } = await axios.get("http://localhost:5000/api/courses", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCourses(data);
      } catch (err) {
        console.error("Fetch courses error:", err);
        alert("Failed to load courses");
      }
    };

    if (token) loadCourses();
  }, [token]);

  // Handle input change
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Add or update course
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(
          `http://localhost:5000/api/courses/${editingId}`,
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEditingId(null);
      } else {
        await axios.post("http://localhost:5000/api/courses", form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setForm({ name: "" });
      // Refresh courses
      const { data } = await axios.get("http://localhost:5000/api/courses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(data);
    } catch (err) {
      console.error("Add/update course error:", err);
      alert(editingId ? "Failed to update course" : "Failed to add course");
    }
  };

  // Edit course
  const handleEdit = (course) => {
    setForm({ name: course.name });
    setEditingId(course.id);
  };

  // Delete course
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(courses.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Delete course error:", err);
      alert("Failed to delete course");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Manage Courses</h2>

      {/* Add/Edit Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        <h3>{editingId ? "Edit Course" : "Add New Course"}</h3>
        <input
          name="name"
          placeholder="Course Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <br /><br />
        <button type="submit">{editingId ? "Update Course" : "Add Course"}</button>
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ name: "" });
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Courses Table */}
      <h3>All Courses</h3>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Course Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id}>
              <td>{course.name}</td>
              <td>
                <button onClick={() => handleEdit(course)}>Edit</button>
                <button onClick={() => handleDelete(course.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Courses;