const express = require("express");
const logger = require("./middleware/logger");

const app = express();

const tasks = [
  { id: 1, title: "Write the API skeleton", done: true, userId: 1 },
  { id: 2, title: "Add a request logger", done: false, userId: 1 },
  { id: 3, title: "Create the first routes", done: false, userId: 2 },
];

// --- application-level middleware ---
app.use(express.json());
app.use(logger);

// --- routes ---
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/echo/:msg", (req, res) => {
  res.json({ echo: req.params.msg });
});

app.get("/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/tasks", (req, res) => {
  res.status(201).json({ received: req.body });
});

module.exports = app;