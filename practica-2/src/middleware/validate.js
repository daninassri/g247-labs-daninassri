// Middleware reutilizable de validación con Zod.
// validate(schema)           -> valida req.body
// validate(schema, "query")  -> valida req.query
// Si falla: 400 con las incidencias por campo. Si pasa: req.valid[source] con los datos limpios.

function toErrors(issues) {
  const errors = [];
  for (const issue of issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        errors.push({ field: key, message: "unknown query parameter" });
      }
    } else {
      errors.push({ field: issue.path.join(".") || "body", message: issue.message });
    }
  }
  return errors;
}

function validate(schema, source = "body") {
  return (req, res, next) => {
    const input = source === "body" ? req.body ?? {} : req.query;
    const result = schema.safeParse(input);
    if (!result.success) {
      return res.status(400).json({ errors: toErrors(result.error.issues) });
    }
    req.valid = { ...req.valid, [source]: result.data };
    next();
  };
}

module.exports = { validate };
