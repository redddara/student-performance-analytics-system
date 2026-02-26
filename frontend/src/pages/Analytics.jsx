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

function Analytics() {
  const [grades, setGrades] = useState([]);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        let url = "http://localhost:5000/api/grades";
        if (user?.role === "student") url = "http://localhost:5000/api/grades/my-grades";

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrades(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchGrades();
  }, [token, user]);

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
      <h2>Analytics</h2>
      {grades.length === 0 ? (
        <p>No grades available yet.</p>
      ) : (
        <Line data={chartData} />
      )}
    </div>
  );
}

export default Analytics;