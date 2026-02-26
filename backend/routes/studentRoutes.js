import express from "express";
import { getStudents, addStudent, updateStudent, deleteStudent } from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);        // Get all students
router.post("/", addStudent);        // Add new student
router.put("/:id", updateStudent);   // Update student by ID
router.delete("/:id", deleteStudent); // Delete student by ID

export default router;