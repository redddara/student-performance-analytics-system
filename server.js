import express from "express";
import path from "node:path";

const app = express();

// In production we serve the Vite build output.
const distDir = path.resolve(process.cwd(), "dist");

app.disable("x-powered-by");

// Prevent the site from being embedded in <iframe>.
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  next();
});

app.use(express.static(distDir, { index: false }));

// SPA fallback: serve index.html for all non-file routes.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

