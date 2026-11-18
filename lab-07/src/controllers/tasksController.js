/*
  src/controllers/tasksController.js
  Respaldado por tasksModel (llamadas async a la base de datos). Cada manejador
  comprueba el propietario y el listado está paginado.
  toDTO mantiene el contrato público: la fila es user_id, la respuesta userId.
*/

const MAX_ID = 2147483647; // límite de INT en PostgreSQL

// Id canónico: solo dígitos, sin ceros a la izquierda y dentro del rango de INT.
// Cualquier otra cosa devuelve null y el manejador responde 404.
function parseId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_ID ? n : null;
}

// Entero normalizado: ausente, repetido o no entero -> valor por defecto;
// fuera de rango -> se recorta a [min, max].
function toBoundedInt(raw, fallback, min, max) {
  if (typeof raw !== "string" || !/^-?\d+$/.test(raw.trim())) return fallback;
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function createTasksController({ tasksModel }) {
  const toDTO = (row) => ({
    id: row.id,
    title: row.title,
    done: row.done,
    userId: row.user_id,
  });

  const isOwner = (task, req) => Number(task.user_id) === Number(req.user.sub);

  return {
    // GET /tasks?page=&limit=  - solo las tareas del que llama, paginadas
    async list(req, res, next) {
      try {
        const page = toBoundedInt(req.query.page, 1, 1, 100000);
        const limit = toBoundedInt(req.query.limit, 20, 1, 100);
        const offset = (page - 1) * limit;
        const rows = await tasksModel.findByOwner(req.user.sub, { limit, offset });
        res.json({ page, limit, items: rows.map(toDTO) });
      } catch (err) {
        next(err);
      }
    },

    // GET /tasks/:id - 404 si no existe, 403 si no es suya, 200 si lo es
    async getOne(req, res, next) {
      try {
        const id = parseId(req.params.id);
        if (id === null) return res.status(404).json({ error: "Task not found" });
        const task = await tasksModel.findById(id);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (!isOwner(task, req)) return res.status(403).json({ error: "Forbidden" });
        res.json(toDTO(task));
      } catch (err) {
        next(err);
      }
    },

    // POST /tasks - el cuerpo ya viene validado; el propietario sale del token
    async create(req, res, next) {
      try {
        const { title, done } = req.body;
        const created = await tasksModel.create({
          title,
          userId: req.user.sub,
          done,
        });
        res
          .status(201)
          .location("/tasks/" + created.id)
          .json(toDTO(created));
      } catch (err) {
        next(err);
      }
    },

    // PUT /tasks/:id - sustitución completa, solo del propietario
    async update(req, res, next) {
      try {
        const id = parseId(req.params.id);
        if (id === null) return res.status(404).json({ error: "Task not found" });
        const task = await tasksModel.findById(id);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (!isOwner(task, req)) return res.status(403).json({ error: "Forbidden" });
        const { title, done } = req.body;
        const updated = await tasksModel.update(id, { title, done });
        if (!updated) return res.status(404).json({ error: "Task not found" });
        res.status(200).json(toDTO(updated));
      } catch (err) {
        next(err);
      }
    },

    // DELETE /tasks/:id - solo del propietario, 204 sin cuerpo
    async remove(req, res, next) {
      try {
        const id = parseId(req.params.id);
        if (id === null) return res.status(404).json({ error: "Task not found" });
        const task = await tasksModel.findById(id);
        if (!task) return res.status(404).json({ error: "Task not found" });
        if (!isOwner(task, req)) return res.status(403).json({ error: "Forbidden" });
        await tasksModel.remove(id);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { createTasksController };
