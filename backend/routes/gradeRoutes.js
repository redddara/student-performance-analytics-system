import express from "express";
import { getGrades, addGrade } from "../controllers/gradeController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getGrades);
router.post("/", authenticate, authorize(["admin", "teacher"]), addGrade);

export default router;