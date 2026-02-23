import { supabase } from "../utils/supabaseClient.js";

export const getCourses = async (req, res) => {
  const { data, error } = await supabase.from("courses").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const addCourse = async (req, res) => {
  const { name, description } = req.body;
  const { data, error } = await supabase.from("courses").insert([{ name, description }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};