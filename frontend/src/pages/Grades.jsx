import { useEffect, useState, useMemo } from "react";
import axios from "axios";

function Grades() {
  const [grades, setGrades] = useState([]);
  const [semesterFilter, setSemesterFilter] = useState("1");
  const [yearFilter, setYearFilter] = useState("All");
  const [courseFilter, setCourseFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const token = localStorage.getItem("token");

  // Fetch grades
  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/grades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGrades(res.data);
      } catch (err) {
        console.error(err);
        alert("Failed to fetch grades");
      }
    };
    if (token) fetchGrades();
  }, [token]);

  // Extract unique courses for dropdown
  const courses = useMemo(() => {
    const set = new Set(grades.map((g) => g.course));
    return ["All", ...set];
  }, [grades]);

  // Handle grade edit
  const handleChange = (gradeId, value) =>
    setEditing((prev) => ({ ...prev, [gradeId]: value }));

  const handleSave = async (gradeObj) => {
    const newValue = editing[gradeObj.id];
    if (newValue === undefined) return;

    if (isNaN(newValue) || newValue < 0 || newValue > 100) {
      alert("Grade must be between 0 and 100");
      return;
    }

    try {
      await axios.put(
        `http://localhost:5000/api/grades/${gradeObj.id}`,
        {
          grade: Number(newValue),
          semester: gradeObj.semester,
          quarter: gradeObj.quarter,
          remarks: gradeObj.remarks,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setGrades((prev) =>
        prev.map((g) =>
          g.id === gradeObj.id ? { ...g, grade: Number(newValue) } : g
        )
      );

      setEditing((prev) => ({ ...prev, [gradeObj.id]: undefined }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update grade");
    }
  };

  // FILTERING
  const filteredGrades = useMemo(() => {
    return grades.filter((g) => {
      const matchesSemester =
        semesterFilter === "All" ||
        g.semester.toString() === semesterFilter;

      const matchesYear =
        yearFilter === "All" ||
        (g.grade_level && g.grade_level === yearFilter);

      const matchesCourse =
        courseFilter === "All" ||
        (g.course && g.course === courseFilter);

      const matchesSearch =
        g.student_name
          .toLowerCase()
          .includes(search.toLowerCase());

      return (
        matchesSemester &&
        matchesYear &&
        matchesCourse &&
        matchesSearch
      );
    });
  }, [grades, semesterFilter, yearFilter, courseFilter, search]);

  // GROUP STUDENT → SUBJECT → QUARTER
  const studentsGrouped = useMemo(() => {
    const map = {};

    filteredGrades.forEach((g) => {
      if (!map[g.student_name]) map[g.student_name] = {};
      if (!map[g.student_name][g.subject]) map[g.student_name][g.subject] = {};

      map[g.student_name][g.subject][g.quarter] = g.grade;
    });

    return map;
  }, [filteredGrades]);

  // FINAL SUBJECT AVERAGE
  const computeFinal = (subjectGrades) => {
    const vals = Object.values(subjectGrades).map(Number);
    if (!vals.length) return "-";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  };

  // SEMESTER GWA
  const computeGWA = (subjects) => {
    const finalAverages = Object.values(subjects).map((q) =>
      Number(computeFinal(q))
    );
    if (!finalAverages.length) return "-";
    return (
      finalAverages.reduce((a, b) => a + b, 0) /
      finalAverages.length
    ).toFixed(2);
  };

  const toggleCollapse = (studentName) => {
    setCollapsed((prev) => ({
      ...prev,
      [studentName]: !prev[studentName],
    }));
  };

  return (
    <div className="page">
      <h2>Teacher Grades Dashboard</h2>

      {/* FILTERS */}
      <div
        className="filters"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search student..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px", minWidth: "200px" }}
        />

        {/* Semester */}
        <select
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
        >
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
        </select>

        {/* Year Level */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
        >
          <option value="All">All Year Levels</option>
          <option value="1st-Year">1st-Year</option>
          <option value="2nd-Year">2nd-Year</option>
          <option value="3rd-Year">3rd-Year</option>
          <option value="4th-Year">4th-Year</option>
        </select>

        {/* Course Filter */}
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
        >
          {courses.map((c, i) => (
            <option key={i} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* STUDENTS */}
      {Object.keys(studentsGrouped).map((student) => {
        const subjects = studentsGrouped[student];
        const studentGWA = computeGWA(subjects);
        const isCollapsed = collapsed[student];

        return (
          <div key={student} className="card" style={{ marginBottom: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => toggleCollapse(student)}
            >
              <h3>{student}</h3>

              <div>
                Semester GWA:{" "}
                <strong style={{ color: studentGWA < 75 ? "red" : "black" }}>
                  {studentGWA}
                </strong>{" "}
                {isCollapsed ? "▼" : "▲"}
              </div>
            </div>

            {!isCollapsed && (
              <table
                className="table"
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
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
                  {Object.entries(subjects).map(([subject, quarters]) => (
                    <tr key={subject}>
                      <td>{subject}</td>

                      {[1, 2, 3, 4].map((q) => {
                        const gradeObj = filteredGrades.find(
                          (g) =>
                            g.student_name === student &&
                            g.subject === subject &&
                            g.quarter === q
                        );

                        return (
                          <td key={q} style={{ textAlign: "center" }}>
                            {gradeObj ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  justifyContent: "center",
                                }}
                              >
                                <input
                                  type="number"
                                  value={
                                    editing[gradeObj.id] ??
                                    gradeObj.grade
                                  }
                                  onChange={(e) =>
                                    handleChange(
                                      gradeObj.id,
                                      e.target.value
                                    )
                                  }
                                  style={{ width: "70px", textAlign: "center" }}
                                />

                                <button onClick={() => handleSave(gradeObj)}>
                                  ✔
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}

                      <td style={{ textAlign: "center", fontWeight: "bold" }}>
                        {computeFinal(quarters)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {grades.length === 0 && <p>No grades available yet.</p>}
    </div>
  );
}

export default Grades;
