import { useEffect, useState } from "react";
import axios from "axios";

function Courses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: "" });
  const [editingId, setEditingId] = useState(null);

  const token = localStorage.getItem("token");

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

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

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
        await axios.post(
          "http://localhost:5000/api/courses",
          form,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setForm({ name: "" });

      const { data } = await axios.get(
        "http://localhost:5000/api/courses",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCourses(data);

    } catch (err) {
      console.error(err);
      alert(editingId ? "Failed to update course" : "Failed to add course");
    }
  };

  const handleEdit = (course) => {
    setForm({ name: course.name });
    setEditingId(course.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;

    try {
      await axios.delete(
        `http://localhost:5000/api/courses/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCourses(courses.filter((c) => c.id !== id));

    } catch (err) {
      console.error(err);
      alert("Failed to delete course");
    }
  };

  return (
    <div className="page">

      <h2>Manage Courses</h2>

      {/* Form Card */}
      <div className="card">

        <h3>{editingId ? "Edit Course" : "Add New Course"}</h3>

        <form onSubmit={handleSubmit} className="student-form">

          <input
            name="name"
            placeholder="Course Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              {editingId ? "Update Course" : "Add Course"}
            </button>

            {editingId && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: "" });
                }}
              >
                Cancel
              </button>
            )}
          </div>

        </form>

      </div>

      {/* Courses Table */}
      <div className="card">

        <h3>All Courses</h3>

        <div className="table-wrapper">
          <table className="table">

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
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEdit(course)}
                    >
                      Edit
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(course.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>

      </div>

    </div>
  );
}

export default Courses;