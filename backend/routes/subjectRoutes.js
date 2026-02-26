import express from "express";
import { getSubjects, addSubject } from "../controllers/subjectController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getSubjects);
router.post("/", verifyToken, authorize(["admin"]), addSubject);

export default router;