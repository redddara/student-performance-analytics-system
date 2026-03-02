import { supabase } from "../utils/supabaseClient.js";

/*
=====================================
  GET ALL COURSES
=====================================
*/
export const getCourses = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  ADD COURSE
=====================================
*/
export const addCourse = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Course name is required." });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("courses")
      .select("id")
      .ilike("name", name.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: "Course already exists." });
    }

    const { data, error } = await supabase
      .from("courses")
      .insert([{ name: name.trim() }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  UPDATE COURSE
=====================================
*/
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Course name is required." });
    }

    const { data, error } = await supabase
      .from("courses")
      .update({ name: name.trim() })
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  DELETE COURSE
=====================================
*/
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Course deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};