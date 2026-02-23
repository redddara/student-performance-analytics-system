import { supabase } from "../utils/supabaseClient.js";

// Top 5 students by average score
export const getTopStudents = async (req, res) => {
  const { data, error } = await supabase
    .from("grades")
    .select("student_id, score")
  
  if (error) return res.status(500).json({ error: error.message });

  // Calculate average per student
  const averages = {};
  data.forEach(g => {
    if (!averages[g.student_id]) averages[g.student_id] = [];
    averages[g.student_id].push(g.score);
  });

  const results = Object.entries(averages).map(([student_id, scores]) => ({
    student_id,
    avg: scores.reduce((a,b)=>a+b,0)/scores.length
  }));

  results.sort((a,b)=>b.avg - a.avg);
  res.json(results.slice(0,5));
};

// Average per subject
export const getSubjectAverages = async (req, res) => {
  const { data, error } = await supabase
    .from("grades")
    .select("subject_id, score");

  if (error) return res.status(500).json({ error: error.message });

  const averages = {};
  data.forEach(g => {
    if (!averages[g.subject_id]) averages[g.subject_id] = [];
    averages[g.subject_id].push(g.score);
  });

  const results = Object.entries(averages).map(([subject_id, scores]) => ({
    subject_id,
    avg: scores.reduce((a,b)=>a+b,0)/scores.length
  }));

  res.json(results);
};