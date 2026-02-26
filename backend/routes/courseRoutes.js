import express from "express";
import { getCourses, addCourse } from "../controllers/courseController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getCourses);
router.post("/", verifyToken, authorize(["admin"]), addCourse);

export default router;