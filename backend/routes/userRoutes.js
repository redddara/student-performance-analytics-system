import express from "express";
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js"; // note the plural "usersController.js"
import { verifyToken, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Admin can view all users
router.get("/", verifyToken, authorize("admin"), getUsers);

// Admin can add a new user
router.post("/", verifyToken, authorize("admin"), addUser);

// Admin can update a user
router.put("/:id", verifyToken, authorize("admin"), updateUser);

// Admin can delete a user
router.delete("/:id", verifyToken, authorize("admin"), deleteUser);

export default router;