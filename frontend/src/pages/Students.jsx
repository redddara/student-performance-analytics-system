import { useEffect, useState, useCallback } from "react";
import axios from "axios";

function Students() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade_level: "",
    section: "",
    course_id: ""
  });
  const [editingId, setEditingId] = useState(null);
  const token = localStorage.getItem("token");

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentsRes, coursesRes] = await Promise.all([
          axios.get("http://localhost:5000/api/students", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("http://localhost:5000/api/courses", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setStudents(studentsRes.data);
        setCourses(coursesRes.data);
      } catch (err) {
        console.error("Load error:", err);
        alert("Failed to load students or courses");
      }
    };
    if (token) loadData();
  }, [token]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.course_id) return alert("Please select a course");

    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/students/${editingId}`, form, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEditingId(null);
      } else {
        await axios.post("http://localhost:5000/api/students", form, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setForm({
        first_name: "",
        last_name: "",
        grade_level: "",
        section: "",
        course_id: ""
      });

      fetchStudents();

    } catch (err) {
      console.error(err);
      alert(editingId ? "Failed to update student" : "Failed to add student");
    }
  };

  const handleEdit = (student) => {
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      grade_level: student.grade_level,
      section: student.section,
      course_id: student.course_id || ""
    });
    setEditingId(student.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;

    try {
      await axios.delete(`http://localhost:5000/api/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchStudents();
    } catch {
      alert("Failed to delete student");
    }
  };

  const filteredStudents = students.filter((student) =>
    `${student.first_name} ${student.last_name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page">

      <h2>Manage Students</h2>

      {/* Form */}
      <div className="card">
        <h3>{editingId ? "Edit Student" : "Add New Student"}</h3>

        <form onSubmit={handleSubmit} className="student-form">

          <input name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange} required />

          <input name="last_name" placeholder="Last Name" value={form.last_name} onChange={handleChange} required />

          <input name="grade_level" placeholder="Grade Level" value={form.grade_level} onChange={handleChange} required />

          <input name="section" placeholder="Section" value={form.section} onChange={handleChange} required />

          <select name="course_id" value={form.course_id} onChange={handleChange} required>
            <option value="">Select Course</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">
              {editingId ? "Update" : "Add"} Student
            </button>

            {editingId && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    first_name: "",
                    last_name: "",
                    grade_level: "",
                    section: "",
                    course_id: ""
                  });
                }}
              >
                Cancel
              </button>
            )}
          </div>

        </form>
      </div>

      {/* Students List */}
      <div className="card">

        <h3>All Students</h3>

        {/* Search */}
        <div style={{ marginBottom: "20px" }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="students-grid">
          {filteredStudents.map(student => (

            <div key={student.id} className="student-card">

              <p><strong>Name:</strong> {student.first_name} {student.last_name}</p>
              <p><strong>Grade Level:</strong> {student.grade_level}</p>
              <p><strong>Section:</strong> {student.section}</p>
              <p>
                <strong>Course:</strong>
                {courses.find(c => c.id === student.course_id)?.name || "-"}
              </p>

              <div className="student-actions">
                <button className="btn btn-primary" onClick={() => handleEdit(student)}>
                  Edit
                </button>

                <button className="btn btn-danger" onClick={() => handleDelete(student.id)}>
                  Delete
                </button>
              </div>

            </div>

          ))}
        </div>

      </div>

    </div>
  );
}

export default Students;