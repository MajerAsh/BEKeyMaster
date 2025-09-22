//Express config
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const puzzlesRouter = require("./routes/puzzles");

app.use(cors());
app.use(express.json());

app.use("/puzzles", puzzlesRouter);

module.exports = app;
