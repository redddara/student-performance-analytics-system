import { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
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
      setGrades(prev => prev.map(g => (g.id === gradeObj.id ? { ...g, grade: newValue } : g)));
      setEditing({ ...editing, [gradeObj.id]: undefined });
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update grade");
    }
  };

  const groupedGrades = {};
  grades
    .filter(g => (semesterFilter === "All" ? true : g.semester.toString() === semesterFilter))
    .forEach(g => {
      if (!groupedGrades[g.student_id]) groupedGrades[g.student_id] = {};
      if (!groupedGrades[g.student_id][g.semester]) groupedGrades[g.student_id][g.semester] = {};
      if (!groupedGrades[g.student_id][g.semester][g.quarter]) groupedGrades[g.student_id][g.semester][g.quarter] = {};
      groupedGrades[g.student_id][g.semester][g.quarter][g.subject_id] = g;
    });

  const computeSubjectAverage = (semesterGrades, subjectId) => {
    const values = Object.values(semesterGrades)
      .map(q => q[subjectId]?.grade)
      .filter(v => v !== undefined)
      .map(Number);
    if (!values.length) return null;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
  };

  const computeSemesterGWA = (semesterGrades, studentCourseId) => {
    const studentSubjects = subjects.filter(s => s.course_id === studentCourseId);
    const subjectAverages = studentSubjects.map(sub => computeSubjectAverage(semesterGrades, sub.id))
      .filter(Boolean).map(Number);
    if (!subjectAverages.length) return "-";
    return (subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length).toFixed(2);
  };

  const chartLabels = [];
  const chartDataValues = [];
  students.forEach(student => {
    const semesters = groupedGrades[student.id];
    if (!semesters) return;
    Object.keys(semesters).forEach(sem => {
      const gwa = computeSemesterGWA(semesters[sem], student.course_id);
      if (gwa !== "-") {
        chartLabels.push(`${student.first_name} ${student.last_name} (Sem ${sem})`);
        chartDataValues.push(gwa);
      }
    });
  });

  const chartData = {
    labels: chartLabels,
    datasets: [{ label: "Semester GWA", data: chartDataValues, backgroundColor: "rgba(54,162,235,0.6)" }]
  };

  return (
    
      <div className="page">
        <h2>Teacher Grades Dashboard</h2>
        <div className="filter-semester">
          <label>Filter Semester: </label>
          <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
          </select>
        </div>

        {students.map(student => {
          const studentSemesters = groupedGrades[student.id];
          if (!studentSemesters) return null;
          const studentSubjects = subjects.filter(s => s.course_id === student.course_id);

          return (
            <div key={student.id} className="card">
              <h3>{student.first_name} {student.last_name}</h3>
              {Object.keys(studentSemesters).map(semester => {
                const semesterGrades = studentSemesters[semester];
                return (
                  <div key={semester} className="semester-section">
                    <h4>Semester {semester} - GWA: {computeSemesterGWA(semesterGrades, student.course_id)}</h4>
                    <div className="table-wrapper">
                      <table className="table">
                        <thead>
                          <tr>
                            <th className="col-subject">Subject</th>
                            <th className="col-quarter">Q1</th>
                            <th className="col-quarter">Q2</th>
                            <th className="col-quarter">Q3</th>
                            <th className="col-quarter">Q4</th>
                            <th className="col-final">Final Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentSubjects.map(subject => {
                            const avg = computeSubjectAverage(semesterGrades, subject.id);
                            return (
                              <tr key={subject.id}>
                                <td>{subject.name}</td>
                                {[1, 2, 3, 4].map(q => {
                                  const gradeObj = semesterGrades[q]?.[subject.id];
                                  return (
                                    <td key={q}>
                                      {gradeObj ? (
                                        <div className="grade-cell">
                                          <input
                                            type="number"
                                            value={editing[gradeObj.id] ?? gradeObj.grade}
                                            onChange={e => handleChange(gradeObj.id, e.target.value)}
                                            className="grade-input"
                                            style={{ color: gradeObj.grade < 75 ? "red" : "black" }}
                                          />
                                          <button
                                            className="grade-save"
                                            onClick={() => handleSave(gradeObj)}
                                          >✔</button>
                                        </div>
                                      ) : "-"}
                                    </td>
                                  );
                                })}
                                <td><strong style={{ color: avg && avg < 75 ? "red" : "black" }}>{avg || "-"}</strong></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="card">
          <h3>Class Performance Overview</h3>
          <Bar data={chartData} />
        </div>
      </div>
    
  );
}

export default Grades;