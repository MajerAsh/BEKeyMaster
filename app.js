//Express config
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

//middleware
// Configure CORS to allow requests from the frontend.
// NOTE: Never use `origin: "*"` together with `credentials: true`.
const clientOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const enableCredentials = clientOrigins.length > 0;

const corsOptions = {
  origin:
    clientOrigins.length > 0
      ? (origin, cb) => {
          // Allow non-browser requests (no Origin header), e.g., curl/health checks.
          if (!origin) return cb(null, true);

          if (clientOrigins.includes(origin)) return cb(null, true);
          return cb(new Error(`CORS blocked origin: ${origin}`));
        }
      : "*",
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: enableCredentials,
};
app.use(cors(corsOptions));

// Log the configured CLIENT_ORIGIN for debugging in deployed environments
console.log(
  "CORS configured origins:",
  clientOrigins.length ? clientOrigins : ["*"]
);
if (!enableCredentials) {
  console.warn(
    "CORS credentials are disabled because CLIENT_ORIGIN is not set. " +
      "Set CLIENT_ORIGIN (comma-separated) to enable credentialed requests."
  );
}

// Handle CORS preflight requests (avoid '*' path-to-regexp edge cases)
app.options(/.*/, cors(corsOptions));
app.use(express.json());

//routes:
const puzzlesRouter = require("./routes/puzzles");
const authRouter = require("./routes/auth");
const scoresRouter = require("./routes/scores");

/* Mount routers with CORS applied at the router level so preflight
 requests for /auth and /puzzles are handled before falling through.*/
/* Routers are mounted normally; CORS is applied globally above. */
app.use("/auth", authRouter);
app.use("/puzzles", puzzlesRouter);
app.use("/scores", scoresRouter);

// Basic route to verify server is running
app.get("/", (req, res) => {
  res.send("KeyPaw API is running!");
});

// Health check for Railway
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
