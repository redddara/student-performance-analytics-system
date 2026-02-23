import express from "express";
import { getSubjects, addSubject } from "../controllers/subjectController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getSubjects);
router.post("/", authenticate, authorize(["admin"]), addSubject);

export default router;