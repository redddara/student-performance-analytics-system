import express from "express";
import { supabase } from "../utils/supabaseClient.js";
import { getGrades, addGrade, updateGrade, deleteGrade } from "../controllers/gradeController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// --------------------------
// TEACHER: Add a grade
// --------------------------
router.post("/", verifyToken, authorize(["teacher"]), addGrade);

// --------------------------
// TEACHER: Update a grade
// --------------------------
router.put("/:id", verifyToken, authorize(["teacher"]), updateGrade);

// --------------------------
// TEACHER: Delete a grade
// --------------------------
router.delete("/:id", verifyToken, authorize(["teacher"]), deleteGrade);

// --------------------------
// ADMIN, TEACHER, STUDENT: View grades
// --------------------------
router.get("/", verifyToken, authorize(["admin", "teacher", "student"]), getGrades);

// --------------------------
// STUDENT: View only their own grades
// --------------------------
router.get("/my-grades", verifyToken, authorize(["student"]), async (req, res) => {
  try {
    const { id } = req.user;

    const { data, error } = await supabase
      .from("grades")
      .select("id, grade, semester, remarks, subjects(name)")
      .eq("student_id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;