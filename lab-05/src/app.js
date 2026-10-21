const express = require("express");
const logger = require("./middleware/logger");
const tasksRouter = require("./routes/tasks");

const app = express();

app.use(express.json());
app.use(logger);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/tasks", tasksRouter);

// error-handling middleware: siempre el último
app.use((err, req, res, next) => {
  console.error(err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

module.exports = app;