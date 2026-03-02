import { supabase } from "../utils/supabaseClient.js";

/*
=====================================
  GET SUBJECTS
  (Optional: filter by course)
=====================================
*/
export const getSubjects = async (req, res) => {
  try {
    const { course_id } = req.query;

    let query = supabase
      .from("subjects")
      .select(`
        id,
        name,
        course_id,
        created_at,
        courses(name)
      `)
      .order("created_at", { ascending: false });

    if (course_id) {
      query = query.eq("course_id", course_id);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  ADD SUBJECT
=====================================
*/
export const addSubject = async (req, res) => {
  try {
    const { name, course_id } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Subject name is required." });
    }

    if (!course_id) {
      return res.status(400).json({ error: "Course is required." });
    }

    // Prevent duplicate subject in same course
    const { data: existing } = await supabase
      .from("subjects")
      .select("id")
      .ilike("name", name.trim())
      .eq("course_id", course_id)
      .single();

    if (existing) {
      return res
        .status(400)
        .json({ error: "Subject already exists in this course." });
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert([{ name: name.trim(), course_id }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/*
=====================================
  UPDATE SUBJECT
=====================================
*/
export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, course_id } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Subject name is required." });
    }

    if (!course_id) {
      return res.status(400).json({ error: "Course is required." });
    }

    const { data, error } = await supabase
      .from("subjects")
      .update({ name: name.trim(), course_id })
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
  DELETE SUBJECT
=====================================
*/
export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional safety: prevent delete if grades exist
    const { data: grades } = await supabase
      .from("grades")
      .select("id")
      .eq("subject_id", id)
      .limit(1);

    if (grades && grades.length > 0) {
      return res.status(400).json({
        error: "Cannot delete subject with existing grades.",
      });
    }

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Subject deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};