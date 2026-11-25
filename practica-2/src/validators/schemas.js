// Esquemas Zod. Un objeto Zod descarta por defecto los campos desconocidos.
const { z } = require("zod");

const CATEGORIES = ["entrante", "principal", "postre", "vegetariano", "rapida"];
const SORT_FIELDS = ["id", "title", "minutes", "favorite", "category"];
const MAX_INT = 2147483647;

// ---------- Receta ----------

const MINUTES_MSG = "minutes must be an integer between 1 and 600";
const CATEGORY_MSG = "category must be one of: " + CATEGORIES.join(", ");

// Mensaje distinto si el campo falta o si llega con un tipo incorrecto
const field = (name, wrongType) => ({
  error: (issue) => (issue.input === undefined ? name + " is required" : wrongType),
});

const title = z
  .string(field("title", "title must be a non-empty string"))
  .trim()
  .min(1, "title must be a non-empty string");
const minutes = z
  .number(field("minutes", MINUTES_MSG))
  .int(MINUTES_MSG)
  .min(1, MINUTES_MSG)
  .max(600, MINUTES_MSG);
const favorite = z.boolean({ error: "favorite must be true or false" });
const category = z.enum(CATEGORIES, field("category", CATEGORY_MSG));

// POST y PUT: validación completa
const recipeSchema = z.object({ title, minutes, favorite: favorite.default(false), category });

// PATCH: parcial; al menos un campo
const recipePatchSchema = z
  .object({
    title: title.optional(),
    minutes: minutes.optional(),
    favorite: favorite.optional(),
    category: category.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "at least one field is required",
  });

// ---------- Consulta del listado ----------

const text = (name) => z.string({ error: name + " must appear only once" });
const integer = (name, min, max) =>
  text(name)
    .regex(/^\d+$/, name + " must be an integer between " + min + " and " + max)
    .transform(Number)
    .refine((n) => n >= min && n <= max, name + " must be an integer between " + min + " and " + max);

// strictObject: un parámetro desconocido se rechaza con 400
const recipeQuerySchema = z.strictObject({
  search: text("search").optional(),
  favorite: text("favorite")
    .pipe(z.enum(["true", "false"], "favorite must be true or false"))
    .transform((v) => v === "true")
    .optional(),
  category: text("category").pipe(z.enum(CATEGORIES, CATEGORY_MSG)).optional(),
  userId: integer("userId", 1, MAX_INT).optional(),
  sort: text("sort")
    .pipe(z.enum(SORT_FIELDS, "sort must be one of: " + SORT_FIELDS.join(", ")))
    .default("id"),
  order: text("order").pipe(z.enum(["asc", "desc"], "order must be asc or desc")).default("asc"),
  page: integer("page", 1, 100000).default(1),
  limit: integer("limit", 1, 100).default(10),
});

// ---------- Autenticación ----------

const byteLength = (s) => Buffer.byteLength(s, "utf8");

const registerSchema = z.object({
  email: z.string({ error: "email is required" }).trim().toLowerCase().pipe(z.email("email must be valid")),
  password: z
    .string({ error: "password is required" })
    .min(8, "password must have at least 8 characters")
    .refine((p) => byteLength(p) <= 72, "password must be at most 72 bytes"),
});

// En el acceso solo se exige que lleguen los dos campos como texto; el resto es 401.
const loginSchema = z.object({
  email: z.string({ error: "email is required" }),
  password: z.string({ error: "password is required" }),
});

module.exports = {
  CATEGORIES,
  recipeSchema,
  recipePatchSchema,
  recipeQuerySchema,
  registerSchema,
  loginSchema,
};
