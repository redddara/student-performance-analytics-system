import { useEffect, useState } from "react";
import axios from "axios";

function MyGrades() {
  const [grades, setGrades] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/grades/my-grades",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        setGrades(res.data);
      } catch (error) {
        console.error(error);
      }
    };

    if (token) {
      fetchGrades();
    }
  }, [token]);

  // Group grades by semester and subject
  const groupedGrades = grades.reduce((acc, grade) => {
    const semester = grade.semester;
    const subject = grade.subjects?.name || "Unknown Subject";

    if (!acc[semester]) {
      acc[semester] = {};
    }

    if (!acc[semester][subject]) {
      acc[semester][subject] = {
        Q1: null,
        Q2: null,
        Q3: null,
        Q4: null
      };
    }

    acc[semester][subject][`Q${grade.quarter}`] = grade.grade;

    return acc;
  }, {});

  const computeAverage = (subjectGrades) => {
    const values = Object.values(subjectGrades).filter(
      (g) => g !== null
    );

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    return (sum / values.length).toFixed(2);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>My Grades</h2>

      {Object.keys(groupedGrades).map((semester) => {
        const subjects = groupedGrades[semester];

        let semesterTotal = 0;
        let subjectCount = 0;

        return (
          <div key={semester} style={{ marginBottom: "40px" }}>
            <h3>{semester}</h3>

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
                {Object.keys(subjects).map((subject) => {
                  const avg = computeAverage(subjects[subject]);

                  if (avg) {
                    semesterTotal += parseFloat(avg);
                    subjectCount++;
                  }

                  return (
                    <tr key={subject}>
                      <td>{subject}</td>
                      {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                        <td
                          key={q}
                          style={{
                            color:
                              subjects[subject][q] &&
                              subjects[subject][q] < 75
                                ? "red"
                                : "black"
                          }}
                        >
                          {subjects[subject][q] || "-"}
                        </td>
                      ))}
                      <td><strong>{avg || "-"}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Semester GWA */}
            {subjectCount > 0 && (
              <h4 style={{ marginTop: "10px" }}>
                Semester GWA:{" "}
                <span>
                  {(semesterTotal / subjectCount).toFixed(2)}
                </span>
              </h4>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MyGrades;