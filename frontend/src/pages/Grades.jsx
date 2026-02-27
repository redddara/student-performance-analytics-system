import { useEffect, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Grades() {
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [editing, setEditing] = useState({});
  const [semesterFilter, setSemesterFilter] = useState("All");

  const token = localStorage.getItem("token");

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gradesRes, studentsRes, subjectsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/grades", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("http://localhost:5000/api/students", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("http://localhost:5000/api/subjects", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setGrades(gradesRes.data);
        setStudents(studentsRes.data);
        setSubjects(subjectsRes.data);
      } catch (error) {
        console.error(error);
        alert("Failed to fetch grades, students, or subjects.");
      }
    };

    if (token) fetchData();
  }, [token]);

  // Inline edit handlers
  const handleChange = (gradeId, value) => setEditing({ ...editing, [gradeId]: value });

  const handleSave = async (gradeObj) => {
    const newValue = editing[gradeObj.id];
    if (newValue === undefined) return;

    try {
      await axios.put(
        `http://localhost:5000/api/grades/${gradeObj.id}`,
        { grade: newValue, semester: gradeObj.semester, quarter: gradeObj.quarter, remarks: gradeObj.remarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setGrades((prev) => prev.map((g) => (g.id === gradeObj.id ? { ...g, grade: newValue } : g)));
      setEditing({ ...editing, [gradeObj.id]: undefined });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update grade");
    }
  };

  // Group grades: student → semester → quarter → subject_id
  const groupedGrades = {};
  grades
    .filter((g) => (semesterFilter === "All" ? true : g.semester === semesterFilter))
    .forEach((g) => {
      if (!groupedGrades[g.student_id]) groupedGrades[g.student_id] = {};
      if (!groupedGrades[g.student_id][g.semester]) groupedGrades[g.student_id][g.semester] = {};
      if (!groupedGrades[g.student_id][g.semester][g.quarter]) groupedGrades[g.student_id][g.semester][g.quarter] = {};
      groupedGrades[g.student_id][g.semester][g.quarter][g.subject_id] = g; // <-- use subject_id
    });

  // Compute subject avg (Q1-Q4)
  const computeSubjectAverage = (semesterGrades, subjectId) => {
    const values = Object.values(semesterGrades)
      .map((quarterObj) => quarterObj[subjectId]?.grade)
      .filter((v) => v !== undefined)
      .map(Number);

    if (!values.length) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  };

  // Compute GWA per semester
  const computeSemesterGWA = (semesterGrades) => {
    const subjectAverages = subjects
      .map((sub) => computeSubjectAverage(semesterGrades, sub.id))
      .filter(Boolean)
      .map(Number);

    if (!subjectAverages.length) return "-";
    return (subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length).toFixed(2);
  };

  // Chart: class performance
  const chartLabels = [];
  const chartDataValues = [];
  students.forEach((student) => {
    const semesters = groupedGrades[student.id];
    if (!semesters) return;

    Object.keys(semesters).forEach((sem) => {
      const gwa = computeSemesterGWA(semesters[sem]);
      if (gwa !== "-") {
        chartLabels.push(`${student.first_name} ${student.last_name} (Sem ${sem})`);
        chartDataValues.push(gwa);
      }
    });
  });

  const chartData = { labels: chartLabels, datasets: [{ label: "Semester GWA", data: chartDataValues, backgroundColor: "rgba(54,162,235,0.6)" }] };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Teacher Grades Dashboard</h2>

      <label>Filter Semester: </label>
      <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)}>
        <option value="All">All</option>
        <option value="1">1</option>
        <option value="2">2</option>
      </select>

      {students.map((student) => {
        const studentSemesters = groupedGrades[student.id];
        if (!studentSemesters) return null;

        return (
          <div key={student.id} style={{ marginBottom: "40px" }}>
            <h3>{student.first_name} {student.last_name}</h3>

            {Object.keys(studentSemesters).map((semester) => {
              const semesterGrades = studentSemesters[semester];

              return (
                <div key={semester} style={{ marginBottom: "20px" }}>
                  <h4>Semester {semester} - GWA: {computeSemesterGWA(semesterGrades)}</h4>

                  <table border="1" cellPadding="8">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Q1</th>
                        <th>Q2</th>
                        <th>Q3</th>
                        <th>Q4</th>
                        <th>Final Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject) => {
                        const avg = computeSubjectAverage(semesterGrades, subject.id);

                        return (
                          <tr key={subject.id}>
                            <td>{subject.name}</td>

                            {[1, 2, 3, 4].map((q) => {
                              const gradeObj = semesterGrades[q]?.[subject.id];

                              return (
                                <td key={q}>
                                  {gradeObj ? (
                                    <>
                                      <input
                                        type="number"
                                        value={editing[gradeObj.id] ?? gradeObj.grade}
                                        onChange={(e) => handleChange(gradeObj.id, e.target.value)}
                                        style={{ width: "55px", color: gradeObj.grade < 75 ? "red" : "black" }}
                                      />
                                      <button onClick={() => handleSave(gradeObj)}>💾</button>
                                    </>
                                  ) : "-"}
                                </td>
                              );
                            })}

                            <td><strong style={{ color: avg && avg < 75 ? "red" : "black" }}>{avg || "-"}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* CLASS ANALYTICS */}
      <div style={{ marginTop: "60px" }}>
        <h3>Class Performance Overview</h3>
        <Bar data={chartData} />
      </div>
    </div>
  );
}

export default Grades;