// Mutable in-memory store — pretend it is a database table.
let tasks = [
  { id: 1, title: "Write the API skeleton", done: true, userId: 1 },
  { id: 2, title: "Add full CRUD", done: false, userId: 1 },
  { id: 3, title: "Return the right status codes", done: false, userId: 2 },
];
let nextId = 4;

function isValidTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

// GET /tasks
function listTasks(req, res, next) {
  res.status(200).json(tasks);
}

// GET /tasks/:id
function getTask(req, res, next) {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.status(200).json(task);
}

// POST /tasks
function createTask(req, res, next) {
  const body = req.body || {};
  if (!isValidTitle(body.title)) {
    return res.status(400).json({ error: "title is required" });
  }
  const task = {
    id: nextId++,
    title: body.title,
    done: body.done ?? false,
    userId: body.userId ?? null,
  };
  tasks.push(task);
  res.status(201).location(`/tasks/${task.id}`).json(task);
}

// PUT /tasks/:id (reemplazo completo)
function updateTask(req, res, next) {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: "Task not found" });
  }
  const body = req.body || {};
  if (!isValidTitle(body.title)) {
    return res.status(400).json({ error: "title is required" });
  }
  const replaced = {
    id: tasks[index].id,
    title: body.title,
    done: body.done ?? false,
    userId: body.userId ?? null,
  };
  tasks[index] = replaced;
  res.status(200).json(replaced);
}

// DELETE /tasks/:id
function deleteTask(req, res, next) {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: "Task not found" });
  }
  tasks.splice(index, 1);
  res.status(204).end();
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask };