import { supabase } from "../utils/supabaseClient.js";

export const getSubjects = async (req, res) => {
  const { data, error } = await supabase.from("subjects").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const addSubject = async (req, res) => {
  const { name, course_id } = req.body;
  const { data, error } = await supabase.from("subjects").insert([{ name, course_id }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};