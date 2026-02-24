import { useEffect, useState } from "react";
import axios from "axios";

function Dashboard() {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await axios.get(
          "http://localhost:5000/api/students",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setStudents(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStudents();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      <h2>Students</h2>
      <ul>
        {students.map((student) => (
          <li key={student.id}>
            {student.first_name} {student.last_name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;