const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/meals - lista posilkow ze skladnikami
router.get('/', async (req, res) => {
  try {
    const [meals] = await db.query('SELECT * FROM meals ORDER BY meal_type, name');
    const [ingredients] = await db.query(`
      SELECT mi.*, p.name as product_name, p.calories_per_100g, p.protein_per_100g,
             p.carbs_per_100g, p.fat_per_100g, p.serving_weight_g
      FROM meal_ingredients mi
      JOIN products p ON mi.product_id = p.id
    `);

    const result = meals.map(meal => ({
      ...meal,
      ingredients: ingredients.filter(i => i.meal_id === meal.id).map(i => ({
        ...i,
        calories: calcCalories(i)
      }))
    }));

    result.forEach(meal => {
      meal.total_calories = meal.ingredients.reduce((sum, i) => sum + i.calories, 0);
      meal.total_protein = meal.ingredients.reduce((sum, i) => sum + calcNutrient(i, 'protein_per_100g'), 0);
      meal.total_carbs = meal.ingredients.reduce((sum, i) => sum + calcNutrient(i, 'carbs_per_100g'), 0);
      meal.total_fat = meal.ingredients.reduce((sum, i) => sum + calcNutrient(i, 'fat_per_100g'), 0);
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getWeightInGrams(ingredient) {
  if (ingredient.unit === 'piece') {
    return ingredient.quantity * (ingredient.serving_weight_g || 100);
  }
  if (ingredient.unit === 'tbsp') return ingredient.quantity * 14;
  if (ingredient.unit === 'tsp') return ingredient.quantity * 5;
  if (ingredient.unit === 'cup') return ingredient.quantity * 240;
  return ingredient.quantity; // g lub ml
}

function calcCalories(ingredient) {
  const grams = getWeightInGrams(ingredient);
  return Math.round((grams / 100) * ingredient.calories_per_100g);
}

function calcNutrient(ingredient, field) {
  const grams = getWeightInGrams(ingredient);
  return Math.round((grams / 100) * ingredient[field] * 10) / 10;
}

// POST /api/meals - dodaj posilek
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, meal_type, description, ingredients = [] } = req.body;
    const [result] = await conn.query(
      'INSERT INTO meals (name, meal_type, description) VALUES (?, ?, ?)',
      [name, meal_type, description]
    );
    const mealId = result.insertId;
    for (const ing of ingredients) {
      await conn.query(
        'INSERT INTO meal_ingredients (meal_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
        [mealId, ing.product_id, ing.quantity, ing.unit]
      );
    }
    await conn.commit();
    res.status(201).json({ id: mealId, ...req.body });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/meals/:id
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, meal_type, description, ingredients = [] } = req.body;
    await conn.query(
      'UPDATE meals SET name=?, meal_type=?, description=? WHERE id=?',
      [name, meal_type, description, req.params.id]
    );
    await conn.query('DELETE FROM meal_ingredients WHERE meal_id = ?', [req.params.id]);
    for (const ing of ingredients) {
      await conn.query(
        'INSERT INTO meal_ingredients (meal_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
        [req.params.id, ing.product_id, ing.quantity, ing.unit]
      );
    }
    await conn.commit();
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/meals/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM meals WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
