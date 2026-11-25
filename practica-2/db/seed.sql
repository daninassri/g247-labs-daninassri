-- Datos iniciales. Vacía las tablas y las vuelve a llenar: se puede repetir.
-- Credenciales de demostración (solo para uso local):
--   admin@example.com / Admin1234   (rol admin)
--   ana@example.com   / Demo1234    (rol user)
--   ben@example.com   / Demo1234    (rol user)
TRUNCATE recipes, users RESTART IDENTITY CASCADE;

INSERT INTO users (email, password_hash, role) VALUES
  ('admin@example.com', '$2b$10$Qu1MSqt91LwYXEfTxoAqnO7Bq9nZqt7GiD9crayPB/xXSIe2E5SiC', 'admin'),
  ('ana@example.com',   '$2b$10$4INlKi/Isuduxh8ssXY9CuURfdjsJw7.5dad3mNlkBjRytjVZKT4a', 'user'),
  ('ben@example.com',   '$2b$10$4INlKi/Isuduxh8ssXY9CuURfdjsJw7.5dad3mNlkBjRytjVZKT4a', 'user');

-- user_id: 1 = admin, 2 = ana, 3 = ben
INSERT INTO recipes (user_id, title, minutes, favorite, category) VALUES
  (2, 'Tortilla de patatas',      45, TRUE,  'principal'),
  (2, 'Gazpacho andaluz',         15, FALSE, 'entrante'),
  (2, 'Paella valenciana',        90, TRUE,  'principal'),
  (2, 'Crema catalana',           30, FALSE, 'postre'),
  (2, 'Ensalada de garbanzos',    20, FALSE, 'vegetariano'),
  (2, 'Tostada con tomate',        5, TRUE,  'rapida'),
  (2, 'Croquetas de jamón',       60, TRUE,  'entrante'),
  (2, 'Lentejas estofadas',       50, FALSE, 'principal'),
  (2, 'Arroz con leche',          40, FALSE, 'postre'),
  (2, 'Pisto manchego',           35, FALSE, 'vegetariano'),
  (2, 'Huevos rotos',             15, FALSE, 'rapida'),
  (2, 'Salmorejo cordobés',       20, TRUE,  'entrante'),
  (2, 'Cocido madrileño',        150, FALSE, 'principal'),
  (2, 'Flan de huevo',            55, FALSE, 'postre'),
  (3, 'Pimientos de Padrón',      10, FALSE, 'entrante'),
  (3, 'Fabada asturiana',        120, TRUE,  'principal'),
  (3, 'Tarta de queso',           70, TRUE,  'postre'),
  (3, 'Espinacas con garbanzos',  25, FALSE, 'vegetariano'),
  (3, 'Bocadillo de calamares',   15, FALSE, 'rapida'),
  (3, 'Ensaladilla rusa',         30, FALSE, 'entrante'),
  (3, 'Merluza en salsa verde',   35, FALSE, 'principal'),
  (3, 'Torrijas',                 40, TRUE,  'postre'),
  (3, 'Berenjenas con miel',      25, FALSE, 'vegetariano'),
  (3, 'Pan con tomate y jamón',    5, FALSE, 'rapida'),
  (3, 'Pulpo a la gallega',       60, TRUE,  'principal'),
  (3, 'Migas extremeñas',         45, FALSE, 'principal'),
  (1, 'Gambas al ajillo',         15, TRUE,  'entrante'),
  (1, 'Menestra de verduras',     40, FALSE, 'vegetariano'),
  (1, 'Natillas',                 30, FALSE, 'postre'),
  (1, 'Sándwich mixto',            8, FALSE, 'rapida');
