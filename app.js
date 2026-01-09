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

/* Ensure preflight requests are handled for all routes.
 Some router/path-to-regexp combinations reject patterns like '*' or '/*',
so using a small middleware that handles OPTIONS requests instead
of registering a route with a potentially unsupported pattern.*/
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    /* Apply CORS headers, then terminate the preflight with 204 so the
     request does not fall through to a 404 for OPTIONS requests.*/
    return cors(corsOptions)(req, res, () => {
      // cors middleware set the headers; respond to preflight immediately
      res.sendStatus(204);
    });
  }
  next();
});
app.use(express.json());

//routes:
const puzzlesRouter = require("./routes/puzzles");
const authRouter = require("./routes/auth");
const scoresRouter = require("./routes/scores");

/* Mount routers with CORS applied at the router level so preflight
 requests for /auth and /puzzles are handled before falling through.*/
app.use("/auth", cors(corsOptions), authRouter);
app.use("/puzzles", cors(corsOptions), puzzlesRouter);
app.use("/scores", cors(corsOptions), scoresRouter);

// Basic route to verify server is running
app.get("/", (req, res) => {
  res.send("KeyPaw API is running!");
});

// Health check for Railway
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
