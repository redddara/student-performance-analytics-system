import express from "express";
import {
  getSubjects,
  addSubject,
  updateSubject,
  deleteSubject
} from "../controllers/subjectController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

/*
=====================================
  VIEW SUBJECTS
  (Admin + Teacher)
=====================================
*/
router.get(
  "/",
  verifyToken,
  authorize(["admin", "teacher"]),
  getSubjects
);

/*
=====================================
  ADD SUBJECT
  (Admin only)
=====================================
*/
router.post(
  "/",
  verifyToken,
  authorize(["admin"]),
  addSubject
);

/*
=====================================
  UPDATE SUBJECT
  (Admin only)
=====================================
*/
router.put(
  "/:id",
  verifyToken,
  authorize(["admin"]),
  updateSubject
);

/*
=====================================
  DELETE SUBJECT
  (Admin only)
=====================================
*/
router.delete(
  "/:id",
  verifyToken,
  authorize(["admin"]),
  deleteSubject
);

export default router;