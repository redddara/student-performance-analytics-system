import { supabase } from "../utils/supabaseClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ----------------------
// SIGNUP CONTROLLER
// ----------------------
export const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required" });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user into Supabase
    const { data, error } = await supabase
      .from("users")
      .insert([{ email, password_hash: hashedPassword, role }])
      .select(); // select returns the inserted record

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ message: "User created successfully", user: data[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ----------------------
// LOGIN CONTROLLER
// ----------------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(400).json({ error: "Invalid credentials" });

    // Check password
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

    // Generate JWT with role included
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Send token + full user info (id, email, role)
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};