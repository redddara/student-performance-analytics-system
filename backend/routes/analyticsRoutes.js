import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { getTopStudents, getSubjectAverages } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/top-students", authenticate, getTopStudents);
router.get("/subject-averages", authenticate, getSubjectAverages);

export default router;