import { useEffect, useState } from "react";
import axios from "axios";

function AddGrade() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.semester || !formData.quarter) {
      return alert("Please select both semester and quarter");
    }

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
    } catch (error) {
      alert(error.response?.data?.error || "Error adding grade");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
      <h2>Add Grade</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {/* Student */}
        <div>
          <label>Student:</label>
          <select name="student_id" value={formData.student_id} onChange={handleChange} required>
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label>Subject:</label>
          <select name="subject_id" value={formData.subject_id} onChange={handleChange} required>
            <option value="">Select Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Grade */}
        <div>
          <label>Grade:</label>
          <input
            type="number"
            name="grade"
            value={formData.grade}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.01"
            required
          />
        </div>

        {/* Semester */}
        <div>
          <label>Semester:</label>
          <select name="semester" value={formData.semester} onChange={handleChange} required>
            <option value="">Select Semester</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </div>

        {/* Quarter */}
        <div>
          <label>Quarter:</label>
          <select name="quarter" value={formData.quarter} onChange={handleChange} required>
            <option value="">Select Quarter</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>

        {/* Remarks */}
        <div>
          <label>Remarks:</label>
          <input type="text" name="remarks" value={formData.remarks} onChange={handleChange} />
        </div>

        <button type="submit">Add Grade</button>
      </form>
    </div>
  );
}

export default AddGrade;