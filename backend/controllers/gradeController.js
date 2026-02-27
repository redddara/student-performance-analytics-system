import { supabase } from "../utils/supabaseClient.js";

// GET GRADES
export const getGrades = async (req, res) => {
  try {
    let query = supabase
      .from("grades")
      .select(`
        id,
        student_id,
        subject_id,     
        grade,
        semester,
        quarter,
        remarks,
        subjects(name),
        students(first_name, last_name)
      `);

    // Students only see their own grades
    if (req.user.role === "student") {
      query = query.eq("student_id", req.user.id);
    }

    const { data, error } = await query
      .order("semester", { ascending: true })
      .order("quarter", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --------------------------
// ADD GRADE (TEACHER ONLY)
// --------------------------
export const addGrade = async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ error: "Access denied" });
    }

    const { student_id, subject_id, grade, semester, quarter, remarks } = req.body;

    if (!student_id || !subject_id || !grade || !semester || !quarter) {
      return res.status(400).json({ error: "student_id, subject_id, grade, semester, and quarter are required" });
    }

    // Check if grade already exists for this student, subject, semester, and quarter
    const { data: existing, error: checkError } = await supabase
      .from("grades")
      .select("*")
      .eq("student_id", student_id)
      .eq("subject_id", subject_id)
      .eq("semester", semester)
      .eq("quarter", quarter);

    if (checkError) return res.status(500).json({ error: checkError.message });
    if (existing.length > 0) return res.status(400).json({ error: "Grade for this student, subject, semester, and quarter already exists" });

    const { data, error } = await supabase
      .from("grades")
      .insert([{ student_id, subject_id, grade, semester, quarter, remarks }])
      .select(); // return inserted record

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ message: "Grade added successfully", grade: data[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --------------------------
// UPDATE GRADE (TEACHER ONLY)
// --------------------------
export const updateGrade = async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ error: "Access denied" });

    const { id } = req.params;
    const { grade, semester, quarter, remarks } = req.body;

    const { data, error } = await supabase
      .from("grades")
      .update({ grade, semester, quarter, remarks })
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "Grade not found" });

    res.json({ message: "Grade updated successfully", grade: data[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --------------------------
// DELETE GRADE (TEACHER ONLY)
// --------------------------
export const deleteGrade = async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ error: "Access denied" });

    const { id } = req.params;

    const { data, error } = await supabase
      .from("grades")
      .delete()
      .eq("id", id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "Grade not found" });

    res.json({ message: "Grade deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};