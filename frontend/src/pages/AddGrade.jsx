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
    remarks: ""
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const studentsRes = await axios.get(
          "http://localhost:5000/api/students",
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const subjectsRes = await axios.get(
          "http://localhost:5000/api/subjects",
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setStudents(studentsRes.data);
        setSubjects(subjectsRes.data);

      } catch (error) {
        console.error(error);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post(
        "http://localhost:5000/api/grades",
        formData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert("Grade added successfully!");

      setFormData({
        student_id: "",
        subject_id: "",
        grade: "",
        semester: "",
        remarks: ""
      });

    } catch (error) {
      alert(error.response?.data?.error || "Error adding grade");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Add Grade</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Student:</label>
          <select
            name="student_id"
            value={formData.student_id}
            onChange={handleChange}
            required
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Subject:</label>
          <select
            name="subject_id"
            value={formData.subject_id}
            onChange={handleChange}
            required
          >
            <option value="">Select Subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Grade:</label>
          <input
            type="number"
            name="grade"
            value={formData.grade}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Semester:</label>
          <input
            type="text"
            name="semester"
            value={formData.semester}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Remarks:</label>
          <input
            type="text"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
          />
        </div>

        <button type="submit">Add Grade</button>
      </form>
    </div>
  );
}

export default AddGrade;