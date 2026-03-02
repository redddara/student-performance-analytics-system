import { supabase } from "../utils/supabaseClient.js";

/*
=====================================
  GET ALL STUDENTS
  (Includes Course Name)
=====================================
*/
export const getStudents = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select(`
        id,
        first_name,
        last_name,
        grade_level,
        section,
        course_id,
        created_at,
        courses(name)
      `)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  ADD NEW STUDENT
=====================================
*/
export const addStudent = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      grade_level,
      section,
      course_id
    } = req.body;

    // Basic validation
    if (!first_name || !last_name || !grade_level) {
      return res.status(400).json({
        error: "First name, last name, and grade level are required."
      });
    }

    if (!course_id) {
      return res.status(400).json({
        error: "Course is required."
      });
    }

    const { data, error } = await supabase
      .from("students")
      .insert([
        {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          grade_level,
          section,
          course_id
        }
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  UPDATE STUDENT
=====================================
*/
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      grade_level,
      section,
      course_id
    } = req.body;

    if (!first_name || !last_name || !grade_level || !course_id) {
      return res.status(400).json({
        error: "All fields including course are required."
      });
    }

    const { data, error } = await supabase
      .from("students")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        grade_level,
        section,
        course_id
      })
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  DELETE STUDENT
=====================================
*/
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};