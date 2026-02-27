import express from "express";
import {
  getGrades,
  addGrade,
  updateGrade,
  deleteGrade
} from "../controllers/gradeController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
=====================================
  VIEW GRADES
=====================================

ADMIN   → all grades
TEACHER → all grades
STUDENT → only their own grades
*/

router.get(
  "/",
  verifyToken,
  authorize(["admin", "teacher", "student"]),
  getGrades
);

/*
=====================================
  ADD GRADE (Teacher only)
=====================================
*/
router.post(
  "/",
  verifyToken,
  authorize(["teacher"]),
  addGrade
);

/*
=====================================
  UPDATE GRADE (Teacher only)
=====================================
*/
router.put(
  "/:id",
  verifyToken,
  authorize(["teacher"]),
  updateGrade
);

/*
=====================================
  DELETE GRADE (Teacher only)
=====================================
*/
router.delete(
  "/:id",
  verifyToken,
  authorize(["teacher"]),
  deleteGrade
);

/*
=====================================
  OPTIONAL: STUDENT SELF ENDPOINT
  (Cleaner REST style)
=====================================
*/

router.get(
  "/me",
  verifyToken,
  authorize(["student"]),
  getGrades
);

export default router;