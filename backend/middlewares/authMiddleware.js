import jwt from "jsonwebtoken";

// --------------------------
// Verify JWT token middleware
// --------------------------
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1]; // optional chaining

  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });

    // Attach user info to req
    req.user = user;
    next();
  });
};

// --------------------------
// Role-based authorization middleware
// --------------------------
export const authorize = (roles = []) => (req, res, next) => {
  // roles can be a single string or an array
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
};