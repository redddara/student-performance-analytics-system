import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function Analytics() {
  const [grades, setGrades] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filteredGrades, setFilteredGrades] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState("All");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedSemester, setSelectedSemester] = useState("All");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  // Fetch grades + courses
  useEffect(() => {
    const fetchData = async () => {
      try {

        let gradeUrl = "http://localhost:5000/api/grades";
        if (user?.role === "student") {
          gradeUrl = "http://localhost:5000/api/grades/my-grades";
        }

        const [gradesRes, coursesRes] = await Promise.all([
          axios.get(gradeUrl, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get("http://localhost:5000/api/courses", {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setGrades(gradesRes.data);
        setCourses(coursesRes.data);

      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [token, user]);

  // Extract subjects & semesters
  const subjects = useMemo(
    () => ["All", ...new Set(grades.map(g => g.subject || "Unknown"))],
    [grades]
  );

  const semesters = useMemo(
    () => [...new Set(grades.map(g => g.semester))],
    [grades]
  );

  // Filter grades
  useEffect(() => {
    let temp = [...grades];

    if (selectedCourse !== "All")
      temp = temp.filter(g => g.course === selectedCourse);

    if (selectedSubject !== "All")
      temp = temp.filter(g => g.subject === selectedSubject);

    if (selectedSemester !== "All")
      temp = temp.filter(g => g.semester === Number(selectedSemester));

    setFilteredGrades(temp);
  }, [grades, selectedCourse, selectedSubject, selectedSemester]);

  // ===========================
  // Stats
  // ===========================
  const gradeValues = useMemo(
    () => filteredGrades.map(g => Number(g.grade)),
    [filteredGrades]
  );

  const avgGrade = useMemo(
    () =>
      gradeValues.length
        ? (
            gradeValues.reduce((a, b) => a + b, 0) /
            gradeValues.length
          ).toFixed(2)
        : 0,
    [gradeValues]
  );

  const highestGrade = useMemo(
    () => (gradeValues.length ? Math.max(...gradeValues) : 0),
    [gradeValues]
  );

  const lowestGrade = useMemo(
    () => (gradeValues.length ? Math.min(...gradeValues) : 0),
    [gradeValues]
  );

  // ===========================
  // Top Students
  // ===========================
  const topStudents = useMemo(() => {
    const studentMap = {};

    filteredGrades.forEach(g => {
      const name = g.student_name || "Unknown";
      if (!studentMap[name]) studentMap[name] = [];
      studentMap[name].push(Number(g.grade));
    });

    const studentAvg = Object.entries(studentMap).map(([name, grades]) => ({
      name,
      avg: grades.reduce((a, b) => a + b, 0) / grades.length
    }));

    return studentAvg.sort((a, b) => b.avg - a.avg).slice(0, 5);
  }, [filteredGrades]);

  const failingStudents = useMemo(
    () => filteredGrades.filter(g => Number(g.grade) < 75),
    [filteredGrades]
  );

  // ===========================
  // Subject Performance
  // ===========================
  const { subjectLabels, subjectAvg } = useMemo(() => {
    const map = {};

    filteredGrades.forEach(g => {
      const subject = g.subject || "Unknown";
      if (!map[subject]) map[subject] = [];
      map[subject].push(Number(g.grade));
    });

    const labels = Object.keys(map);
    const avg = labels.map(
      s => map[s].reduce((a, b) => a + b, 0) / map[s].length
    );

    return { subjectLabels: labels, subjectAvg: avg };
  }, [filteredGrades]);

  // ===========================
  // Grade Distribution
  // ===========================
  const distributionChart = useMemo(() => {
    const distribution = {
      "90-100": 0,
      "85-89": 0,
      "80-84": 0,
      "75-79": 0,
      "Below 75": 0
    };

    gradeValues.forEach(g => {
      if (g >= 90) distribution["90-100"]++;
      else if (g >= 85) distribution["85-89"]++;
      else if (g >= 80) distribution["80-84"]++;
      else if (g >= 75) distribution["75-79"]++;
      else distribution["Below 75"]++;
    });

    return {
      labels: Object.keys(distribution),
      datasets: [
        {
          data: Object.values(distribution),
          backgroundColor: [
            "#8b1f2b",
            "#b45309",
            "#facc15",
            "#22c55e",
            "#dc2626"
          ]
        }
      ]
    };
  }, [gradeValues]);

  const trendChart = useMemo(
    () => ({
      labels: filteredGrades.map(g => g.semester || g.subject || "Grade"),
      datasets: [
        {
          label: "Grade Trend",
          data: gradeValues,
          borderColor: "#8b1f2b",
          backgroundColor: "#ffcf66",
          tension: 0.4
        }
      ]
    }),
    [filteredGrades, gradeValues]
  );

  const subjectChart = useMemo(
    () => ({
      labels: subjectLabels,
      datasets: [
        {
          label: "Average Grade",
          data: subjectAvg,
          backgroundColor: "#ffcf66",
          borderColor: "#8b1f2b",
          borderWidth: 1
        }
      ]
    }),
    [subjectLabels, subjectAvg]
  );

  const chartOptions = {
    responsive: true,
    animation: { duration: 1000, easing: "easeOutQuart" }
  };

  return (
    <div className="page">
      <h2>Analytics Dashboard</h2>

      {/* FILTERS */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap"
        }}
      >
        {/* Course Filter */}
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
        >
          <option value="All">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Subject Filter */}
        <select
          value={selectedSubject}
          onChange={e => setSelectedSubject(e.target.value)}
        >
          {subjects.map((s, i) => (
            <option key={i} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Semester Filter */}
        <select
          value={selectedSemester}
          onChange={e => setSelectedSemester(e.target.value)}
        >
          <option value="All">All Semesters</option>
          {semesters.map((s, i) => (
            <option key={i} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Average Grade</h3>
          <p>{avgGrade}</p>
        </div>

        <div className="dashboard-card">
          <h3>Highest Grade</h3>
          <p>{highestGrade}</p>
        </div>

        <div className="dashboard-card">
          <h3>Lowest Grade</h3>
          <p>{lowestGrade}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Records</h3>
          <p>{filteredGrades.length}</p>
        </div>
      </div>

      {failingStudents.length > 0 && (
        <div className="card failing">
          <h3>⚠ Students At Risk</h3>
          <p>{failingStudents.length} students have grades below 75</p>
        </div>
      )}

      {/* TOP STUDENTS */}
      <div className="card">
        <h3>🏆 Top 5 Students</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Average</th>
            </tr>
          </thead>

          <tbody>
            {topStudents.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{s.name}</td>
                <td>{s.avg.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CHARTS */}
      <div className="card">
        <h3>Subject Performance</h3>
        <Bar data={subjectChart} options={chartOptions} />
      </div>

      <div className="card">
        <h3>Grade Trend</h3>
        <Line data={trendChart} options={chartOptions} />
      </div>

      <div className="card">
        <h3>Grade Distribution</h3>
        <Pie data={distributionChart} options={chartOptions} />
      </div>
    </div>
  );
}

export default Analytics;
