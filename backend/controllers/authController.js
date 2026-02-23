import { supabase } from "../utils/supabaseClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const signup = async (req, res) => {
  const { email, password, role } = req.body;

  const hashedPassword = bcrypt.hashSync(password, 10);

  const { data, error } = await supabase.from("users").insert([
    { email, password_hash: hashedPassword, role }
  ]);

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ message: "User created successfully" });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.from("users").select("*").eq("email", email).single();

  if (error || !data) return res.status(400).json({ error: "Invalid credentials" });

  const isValid = bcrypt.compareSync(password, data.password_hash);
  if (!isValid) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, role: data.role });
};