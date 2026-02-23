import express from "express";
import { getCourses, addCourse } from "../controllers/courseController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getCourses);
router.post("/", authenticate, authorize(["admin"]), addCourse);

export default router;