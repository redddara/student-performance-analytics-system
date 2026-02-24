import { supabase } from "../utils/supabaseClient.js";

export const getGrades = async (req, res) => {
  const { data, error } = await supabase.from("grades").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const addGrade = async (req, res) => {
  const { student_id, subject_id, grade, semester } = req.body;
  const { data, error } = await supabase.from("grades").insert([{ student_id, subject_id, grade, semester }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};  