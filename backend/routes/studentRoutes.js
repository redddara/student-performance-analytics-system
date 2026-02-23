import express from "express";
import { getStudents, addStudent } from "../controllers/studentController.js";

const router = express.Router();

router.get("/", getStudents);
router.post("/", addStudent);

export default router;