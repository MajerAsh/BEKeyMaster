const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRouter = require("./routes/auth");
const puzzlesRouter = require("./routes/puzzles");
const scoresRouter = require("./routes/scores");

const app = express();

app.use(express.json());

// ---- CORS ----
// using Authorization headers/ Bearer tokens
const allowlist = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowlist.length
    ? (origin, cb) => {
        // Allow non-browser requests (no Origin header), e.g. curl/health checks
        if (!origin) return cb(null, true);
        return allowlist.includes(origin)
          ? cb(null, true)
          : cb(new Error("Not allowed by CORS"));
      }
    : true, // if no allowlist set, reflect origin (dev-friendly)
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

app.use(cors(corsOptions));
// Preflight support
app.options(/.*/, cors(corsOptions));

if (process.env.NODE_ENV !== "test") {
  console.log("CORS origins:", allowlist.length ? allowlist : ["(any)"]);
}

// ---- Routes ----
app.get("/", (req, res) => res.send("KeyPaw API is running!"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/puzzles", puzzlesRouter);
app.use("/scores", scoresRouter);

// ---- 404 ----
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---- Error handler ----
// Handles thrown errors, including CORS allowlist rejections.
app.use((err, req, res, next) => {
  // CORS allowlist errors should be 403, not 500
  if (err && typeof err.message === "string" && err.message.includes("CORS")) {
    return res.status(403).json({ error: "CORS blocked" });
  }

  console.error(err);
  res.status(500).json({ error: "Server error" });
});

module.exports = app;
