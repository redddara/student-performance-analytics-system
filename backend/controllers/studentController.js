import { supabase } from "../utils/supabaseClient.js";

// Get all students
export const getStudents = async (req, res) => {
  const { data, error } = await supabase.from("students").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

// Add new student
export const addStudent = async (req, res) => {
  const { first_name, last_name, grade_level, section } = req.body;
  const { data, error } = await supabase
    .from("students")
    .insert([{ first_name, last_name, grade_level, section }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};