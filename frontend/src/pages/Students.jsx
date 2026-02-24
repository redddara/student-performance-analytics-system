import { useEffect, useState } from "react";
import axios from "axios";

function Students() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    grade_level: "",
    section: "",
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/students",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setStudents(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStudents();
  }, [token]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleAddStudent = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/students",
        form,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setForm({
        first_name: "",
        last_name: "",
        grade_level: "",
        section: "",
      });

      // Refresh list safely
      const res = await axios.get(
        "http://localhost:5000/api/students",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setStudents(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to add student");
    }
  };

  return (
    <div>
      <h1>Students</h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          name="first_name"
          placeholder="First Name"
          value={form.first_name}
          onChange={handleChange}
        />
        <input
          name="last_name"
          placeholder="Last Name"
          value={form.last_name}
          onChange={handleChange}
        />
        <input
          name="grade_level"
          placeholder="Grade Level"
          value={form.grade_level}
          onChange={handleChange}
        />
        <input
          name="section"
          placeholder="Section"
          value={form.section}
          onChange={handleChange}
        />
        <button onClick={handleAddStudent}>
          Add Student
        </button>
      </div>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Grade Level</th>
            <th>Section</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>{s.first_name}</td>
              <td>{s.last_name}</td>
              <td>{s.grade_level}</td>
              <td>{s.section}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Students;