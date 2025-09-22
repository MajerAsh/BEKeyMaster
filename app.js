//Express config
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

//routes:
const puzzlesRouter = require("./routes/puzzles");
const authRouter = require("./routes/auth");

app.use("/auth", authRouter);
app.use("/puzzles", puzzlesRouter);

module.exports = app;
