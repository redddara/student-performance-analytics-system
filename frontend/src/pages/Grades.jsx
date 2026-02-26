import { useEffect, useState } from "react";
import axios from "axios";

function Grades() {
  const [grades, setGrades] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/grades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrades(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGrades();
  }, [token]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>All Grades</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Student</th>
            <th>Subject</th>
            <th>Grade</th>
            <th>Semester</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((g) => (
            <tr key={g.id}>
              <td>{g.students.first_name} {g.students.last_name}</td>
              <td>{g.subjects.name}</td>
              <td>{g.grade}</td>
              <td>{g.semester}</td>
              <td>{g.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Grades;