//Express config
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

//middleware
app.use(cors());
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
