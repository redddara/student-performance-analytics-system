import express from "express";
import { getUsers, addUser } from "../controllers/userController.js";
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Admin can view all users
router.get("/", verifyToken, authorize("admin"), getUsers);

// Admin can add a user
router.post("/", verifyToken, authorize("admin"), addUser);

export default router;