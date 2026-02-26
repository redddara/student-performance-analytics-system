import { supabase } from "../utils/supabaseClient.js";

// Get all students
export const getStudents = async (req, res) => {
  try {
    const { data, error } = await supabase.from("students").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add new student
export const addStudent = async (req, res) => {
  try {
    const { first_name, last_name, grade_level, section } = req.body;
    const { data, error } = await supabase
      .from("students")
      .insert([{ first_name, last_name, grade_level, section }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update student
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, grade_level, section } = req.body;
    const { data, error } = await supabase
      .from("students")
      .update({ first_name, last_name, grade_level, section })
      .eq("id", id)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete student
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};