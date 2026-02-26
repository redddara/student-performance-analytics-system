import express from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { getTopStudents, getSubjectAverages } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/top-students", verifyToken, getTopStudents);
router.get("/subject-averages", verifyToken, getSubjectAverages);

export default router;