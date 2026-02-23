import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Role-based authorization
export const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};