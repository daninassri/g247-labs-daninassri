const { Pool } = require("pg");
const { buildApp } = require("./app");

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error("DATABASE_URL and JWT_SECRET are required (see .env.example)");
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 3000;

buildApp(db).listen(PORT, () => {
  console.log("Recipes API listening on http://localhost:" + PORT);
});
