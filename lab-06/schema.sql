-- schema.sql — Session 22 Lab: SQL & the models/ seam
-- Web Application Programming (G247) · CUNEF EPS · Block II · Week 8
--
-- Two related tables: a user OWNS many tasks (one-to-many).
-- Run it against a real Postgres, e.g.:
--   psql "$DATABASE_URL" -f schema.sql
--
-- The DROPs make the script re-runnable while you experiment. tasks is
-- dropped first because it references users.

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------
-- Seed data — a handful of rows so the queries in queries.sql return
-- something interesting. ids are assigned by SERIAL: 1, 2, 3, ...
-- ---------------------------------------------------------------------

INSERT INTO users (email) VALUES
  ('ana@example.com'),
  ('ben@example.com'),
  ('cleo@example.com');

INSERT INTO tasks (user_id, title, done) VALUES
  (1, 'Buy milk',              FALSE),
  (1, 'Write the SQL schema',  TRUE),
  (1, 'Read the pg docs',      FALSE),
  (1, 'Add pagination',        FALSE),
  (2, 'Set up CI',             FALSE),
  (2, 'Review pull request',   TRUE),
  (3, 'Draft Practice 1 plan', FALSE);
