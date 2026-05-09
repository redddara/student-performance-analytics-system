import express from "express";
import path from "node:path";

const app = express();

// In production we serve the Vite build output.
const distDir = path.resolve(process.cwd(), "dist");

app.disable("x-powered-by");

const FRAME_ANCESTORS_RULE = "frame-ancestors 'none'";

function withFrameAncestorsNone(existingCsp) {
  if (!existingCsp) return FRAME_ANCESTORS_RULE;
  if (existingCsp.includes("frame-ancestors")) return existingCsp;
  return `${existingCsp}; ${FRAME_ANCESTORS_RULE}`;
}

// Prevent the site from being embedded in <iframe>.
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    withFrameAncestorsNone(res.getHeader("Content-Security-Policy")?.toString()),
  );
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

