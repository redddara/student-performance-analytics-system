import { useEffect, useState } from "react";
import axios from "axios";

function AddGrade() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);

  const [formData, setFormData] = useState({
    student_id: "",
    subject_id: "",
    grade: "",
    semester: "",
    quarter: "",
    remarks: ""
  });

  const token = localStorage.getItem("token");

  // Fetch students and subjects
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, subjectsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/students", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("http://localhost:5000/api/subjects", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setStudents(studentsRes.data);
        setSubjects(subjectsRes.data);
      } catch (error) {
        console.error(error);
        alert("Failed to fetch students or subjects");
      }
    };
    if (token) fetchData();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "student_id") {
      const selectedStudent = students.find((s) => s.id === value);
      if (selectedStudent) {
        const filtered = subjects.filter((subj) => subj.course_id === selectedStudent.course_id);
        setFilteredSubjects(filtered);
        setFormData({ ...formData, student_id: value, subject_id: "" });
        return;
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.semester || !formData.quarter) return alert("Please select both semester and quarter");

    try {
      await axios.post("http://localhost:5000/api/grades", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Grade added successfully!");
      setFormData({
        student_id: "",
        subject_id: "",
        grade: "",
        semester: "",
        quarter: "",
        remarks: ""
      });
      setFilteredSubjects([]);
    } catch (error) {
      alert(error.response?.data?.error || "Error adding grade");
    }
  };

  return (
    <div className="page">
      <h2>Add Grade</h2>

      <div className="card">
        <h3>Add New Grade</h3>
        <form onSubmit={handleSubmit} className="student-form">
          {/* Student */}
          <select name="student_id" value={formData.student_id} onChange={handleChange} required>
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>

          {/* Subject */}
          <select
            name="subject_id"
            value={formData.subject_id}
            onChange={handleChange}
            required
            disabled={!formData.student_id}
          >
            <option value="">Select Subject</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Grade */}
          <input
            type="number"
            name="grade"
            value={formData.grade}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.01"
            placeholder="Grade"
            required
          />

          {/* Semester */}
          <select name="semester" value={formData.semester} onChange={handleChange} required>
            <option value="">Select Semester</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>

          {/* Quarter */}
          <select name="quarter" value={formData.quarter} onChange={handleChange} required>
            <option value="">Select Quarter</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>

          {/* Remarks */}
          <input
            type="text"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            placeholder="Remarks (optional)"
          />

          <div className="form-buttons">
            <button type="submit" className="btn btn-primary">Add Grade</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddGrade;