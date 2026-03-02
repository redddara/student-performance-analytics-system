import express from "express";
import {
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse
} from "../controllers/courseController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
=====================================
  VIEW COURSES
  (Admin + Teacher)
=====================================
*/
router.get(
  "/",
  verifyToken,
  authorize(["admin", "teacher"]),
  getCourses
);

/*
=====================================
  ADD COURSE
  (Admin only)
=====================================
*/
router.post(
  "/",
  verifyToken,
  authorize(["admin"]),
  addCourse
);

/*
=====================================
  UPDATE COURSE
  (Admin only)
=====================================
*/
router.put(
  "/:id",
  verifyToken,
  authorize(["admin"]),
  updateCourse
);

/*
=====================================
  DELETE COURSE
  (Admin only)
=====================================
*/
router.delete(
  "/:id",
  verifyToken,
  authorize(["admin"]),
  deleteCourse
);

export default router;