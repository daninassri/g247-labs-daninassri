/* src/server.js. Define DATABASE_URL y JWT_SECRET antes de arrancar. */
const { Pool } = require("pg");
const { buildApp } = require("./app");

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error("DATABASE_URL and JWT_SECRET are required");
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT) || 3000;
buildApp(db).listen(port, () => console.log(`Listening on http://localhost:${port}`));
