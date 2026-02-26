import { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function MyGrades() {
  const [grades, setGrades] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/grades/my-grades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrades(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGrades();
  }, [token]);

  // Prepare data for chart
  const chartData = {
    labels: grades.map((g) => g.semester),
    datasets: [
      {
        label: "Grades",
        data: grades.map((g) => g.grade),
        fill: false,
        borderColor: "#4f46e5",
        backgroundColor: "#4f46e5",
        tension: 0.3,
      },
    ],
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Grades</h2>
      {grades.length === 0 ? (
        <p>No grades available yet.</p>
      ) : (
        <Line data={chartData} />
      )}
    </div>
  );
}

export default MyGrades;