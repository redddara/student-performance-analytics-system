import { supabase } from "../utils/supabaseClient.js";
import bcrypt from "bcryptjs";

// Get all users (admin only)
export const getUsers = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, created_at");

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add new user (admin only)
export const addUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Access denied" });

    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: "Email, password, role required" });

    // Hash password
    const password_hash = bcrypt.hashSync(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ email, password_hash, role }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ message: "User added successfully", user: data[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};