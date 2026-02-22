-- NutriCart - schemat bazy danych MySQL

CREATE DATABASE IF NOT EXISTS nutricart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nutricart;

CREATE TABLE stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50),
  calories_per_100g DECIMAL(6,2),
  protein_per_100g DECIMAL(6,2),
  carbs_per_100g DECIMAL(6,2),
  fat_per_100g DECIMAL(6,2),
  vitamins JSON,
  serving_unit ENUM('g', 'ml', 'piece', 'tbsp', 'tsp', 'cup') DEFAULT 'g',
  serving_weight_g DECIMAL(6,2) NULL COMMENT 'srednia waga jednej porcji w gramach',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_stores (
  product_id INT NOT NULL,
  store_id INT NOT NULL,
  PRIMARY KEY (product_id, store_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE meals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meal_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meal_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  unit ENUM('g', 'ml', 'piece', 'tbsp', 'tsp', 'cup') NOT NULL DEFAULT 'g',
  FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Przykladowe dane
INSERT INTO stores (name) VALUES ('Biedronka'), ('Lidl'), ('Żabka'), ('Carrefour'), ('Netto');

INSERT INTO products (name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_unit, serving_weight_g) VALUES
('Jabłko', 'owoce', 52, 0.3, 14, 0.2, 'piece', 150),
('Banan', 'owoce', 89, 1.1, 23, 0.3, 'piece', 120),
('Jajko', 'nabiał', 155, 13, 1.1, 11, 'piece', 60),
('Pierś z kurczaka', 'mięso', 165, 31, 0, 3.6, 'g', 100),
('Płatki owsiane', 'zboża', 389, 17, 66, 7, 'g', 100),
('Mleko 2%', 'nabiał', 50, 3.4, 4.8, 2, 'ml', 250),
('Chleb pszenny', 'zboża', 265, 9, 49, 3.2, 'piece', 35),
('Masło orzechowe', 'inne', 588, 25, 20, 50, 'tbsp', 15),
('Jogurt naturalny', 'nabiał', 59, 10, 3.6, 0.4, 'g', 150),
('Ryż biały', 'zboża', 130, 2.7, 28, 0.3, 'g', 100),
('Brokuł', 'warzywa', 34, 2.8, 7, 0.4, 'g', 200),
('Łosoś', 'mięso', 208, 20, 0, 13, 'g', 150),
('Oliwa z oliwek', 'inne', 884, 0, 0, 100, 'tbsp', 14),
('Pomidor', 'warzywa', 18, 0.9, 3.9, 0.2, 'piece', 120),
('Sałata', 'warzywa', 15, 1.4, 2.9, 0.2, 'g', 50);

-- Przypisanie produktow do sklepow
INSERT INTO product_stores (product_id, store_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),
(2,1),(2,2),(2,3),(2,4),
(3,1),(3,2),(3,3),(3,4),(3,5),
(4,1),(4,2),(4,4),
(5,1),(5,2),(5,4),(5,5),
(6,1),(6,2),(6,3),(6,4),(6,5),
(7,1),(7,2),(7,3),(7,4),(7,5),
(8,1),(8,2),(8,4),
(9,1),(9,2),(9,4),(9,5),
(10,1),(10,2),(10,4),(10,5),
(11,1),(11,2),(11,4),
(12,1),(12,2),(12,4),
(13,1),(13,2),(13,4),(13,5),
(14,1),(14,2),(14,3),(14,4),(14,5),
(15,1),(15,2),(15,4);

-- Przykladowe posilki
INSERT INTO meals (name, meal_type, description) VALUES
('Owsianka z bananem', 'breakfast', 'Klasyczna owsianka na mleku z bananem'),
('Jajecznica z pomidorem', 'breakfast', 'Prosta jajecznica na masle z pomidorem'),
('Kurczak z ryzem i brokolami', 'lunch', 'Klasyczny posilek fitness'),
('Losos z salatka', 'dinner', 'Lekka kolacja bogata w omega-3'),
('Jogurt z jablkiem', 'snack', 'Lekka przekaska');

INSERT INTO meal_ingredients (meal_id, product_id, quantity, unit) VALUES
-- Owsianka z bananem: platki 80g, mleko 200ml, banan 1szt
(1, 5, 80, 'g'),
(1, 6, 200, 'ml'),
(1, 2, 1, 'piece'),
-- Jajecznica: 3 jajka, 1 pomidor, 1 lyzka oliwy
(2, 3, 3, 'piece'),
(2, 14, 1, 'piece'),
(2, 13, 1, 'tbsp'),
-- Kurczak z ryzem
(3, 4, 180, 'g'),
(3, 10, 150, 'g'),
(3, 11, 200, 'g'),
-- Losos z salatka
(4, 12, 1, 'piece'),
(4, 15, 50, 'g'),
(4, 13, 1, 'tbsp'),
-- Jogurt z jablkiem
(5, 9, 150, 'g'),
(5, 1, 1, 'piece');
