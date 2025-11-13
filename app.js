//Express config
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

//middleware
// Configure CORS to allow requests from the frontend (set CLIENT_ORIGIN in env)
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || "*",
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
// Ensure preflight requests are handled for all routes
app.options("*", cors(corsOptions));
app.use(express.json());

//routes:
const puzzlesRouter = require("./routes/puzzles");
const authRouter = require("./routes/auth");

app.use("/auth", authRouter);
app.use("/puzzles", puzzlesRouter);

// Basic route to verify server is running
app.get("/", (req, res) => {
  res.send("🔑 KeyMaster API is running!");
});

// Health check for Railway
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
