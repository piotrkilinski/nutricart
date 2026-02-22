const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/generate
 * Body: { store_ids: [1, 3], target_calories: 2000 }
 * Zwraca plan posilkow na caly dzien
 */
router.post('/', async (req, res) => {
  try {
    const { store_ids, target_calories } = req.body;
    if (!store_ids || !store_ids.length || !target_calories) {
      return res.status(400).json({ error: 'Podaj store_ids i target_calories' });
    }

    // Pobierz ID produktow dostepnych w wybranych sklepach
    const placeholders = store_ids.map(() => '?').join(',');
    const [availableProducts] = await db.query(
      `SELECT DISTINCT product_id FROM product_stores WHERE store_id IN (${placeholders})`,
      store_ids
    );
    const availableProductIds = availableProducts.map(p => p.product_id);

    if (!availableProductIds.length) {
      return res.status(404).json({ error: 'Brak produktow dla wybranych sklepow' });
    }

    // Pobierz posilki ze skladnikami i przelicz kalorie
    const [meals] = await db.query('SELECT * FROM meals');
    const [ingredients] = await db.query(`
      SELECT mi.*, p.calories_per_100g, p.protein_per_100g, p.carbs_per_100g,
             p.fat_per_100g, p.serving_weight_g, p.name as product_name
      FROM meal_ingredients mi
      JOIN products p ON mi.product_id = p.id
    `);

    // Przypisz skladniki do posilkow i oblicz kalorie
    const mealsWithCalories = meals.map(meal => {
      const mealIngredients = ingredients.filter(i => i.meal_id === meal.id);
      const allAvailable = mealIngredients.every(i =>
        availableProductIds.includes(i.product_id)
      );
      const totalCalories = mealIngredients.reduce((sum, i) => {
        const grams = getWeightInGrams(i);
        return sum + (grams / 100) * i.calories_per_100g;
      }, 0);
      const totalProtein = mealIngredients.reduce((sum, i) => {
        const grams = getWeightInGrams(i);
        return sum + (grams / 100) * i.protein_per_100g;
      }, 0);
      const totalCarbs = mealIngredients.reduce((sum, i) => {
        const grams = getWeightInGrams(i);
        return sum + (grams / 100) * i.carbs_per_100g;
      }, 0);
      const totalFat = mealIngredients.reduce((sum, i) => {
        const grams = getWeightInGrams(i);
        return sum + (grams / 100) * i.fat_per_100g;
      }, 0);

      return {
        ...meal,
        allAvailable,
        total_calories: Math.round(totalCalories),
        total_protein: Math.round(totalProtein * 10) / 10,
        total_carbs: Math.round(totalCarbs * 10) / 10,
        total_fat: Math.round(totalFat * 10) / 10,
        ingredients: mealIngredients.map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          calories: Math.round((getWeightInGrams(i) / 100) * i.calories_per_100g)
        }))
      };
    }).filter(m => m.allAvailable);

    // Podziel na typy
    const byType = {
      breakfast: mealsWithCalories.filter(m => m.meal_type === 'breakfast'),
      lunch: mealsWithCalories.filter(m => m.meal_type === 'lunch'),
      dinner: mealsWithCalories.filter(m => m.meal_type === 'dinner'),
      snack: mealsWithCalories.filter(m => m.meal_type === 'snack'),
    };

    // Sprawdz czy mamy co wybierac
    if (!byType.breakfast.length || !byType.lunch.length || !byType.dinner.length) {
      return res.status(404).json({
        error: 'Za malo posilkow dostepnych dla wybranych sklepow. Dodaj wiecej posilkow w panelu admina.'
      });
    }

    // Szukaj kombinacji mieszczacej sie w target_calories ± 15%
    const MIN = target_calories * 0.85;
    const MAX = target_calories * 1.15;
    const MAX_ATTEMPTS = 100;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const breakfast = pick(byType.breakfast);
      const lunch = pick(byType.lunch);
      const dinner = pick(byType.dinner);
      let snack = null;

      const base = breakfast.total_calories + lunch.total_calories + dinner.total_calories;

      // Dodaj snacka jesli jest i kalorie na to pozwalaja
      if (byType.snack.length && base < target_calories * 0.9) {
        snack = pick(byType.snack);
      }

      const total = base + (snack ? snack.total_calories : 0);

      if (total >= MIN && total <= MAX) {
        const plan = {
          total_calories: total,
          total_protein: round(breakfast.total_protein + lunch.total_protein + dinner.total_protein + (snack?.total_protein || 0)),
          total_carbs: round(breakfast.total_carbs + lunch.total_carbs + dinner.total_carbs + (snack?.total_carbs || 0)),
          total_fat: round(breakfast.total_fat + lunch.total_fat + dinner.total_fat + (snack?.total_fat || 0)),
          meals: [
            { ...breakfast, type_label: 'Śniadanie' },
            { ...lunch, type_label: 'Obiad' },
            ...(snack ? [{ ...snack, type_label: 'Przekąska' }] : []),
            { ...dinner, type_label: 'Kolacja' },
          ]
        };
        return res.json(plan);
      }
    }

    // Nie znaleziono idealnej kombinacji - zwroc najlepsza
    const breakfast = pick(byType.breakfast);
    const lunch = pick(byType.lunch);
    const dinner = pick(byType.dinner);
    const total = breakfast.total_calories + lunch.total_calories + dinner.total_calories;

    res.json({
      total_calories: total,
      total_protein: round(breakfast.total_protein + lunch.total_protein + dinner.total_protein),
      total_carbs: round(breakfast.total_carbs + lunch.total_carbs + dinner.total_carbs),
      total_fat: round(breakfast.total_fat + lunch.total_fat + dinner.total_fat),
      warning: `Nie znaleziono idealnej kombinacji dla ${target_calories} kcal. Dodaj wiecej posilkow.`,
      meals: [
        { ...breakfast, type_label: 'Śniadanie' },
        { ...lunch, type_label: 'Obiad' },
        { ...dinner, type_label: 'Kolacja' },
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round(val) {
  return Math.round(val * 10) / 10;
}

function getWeightInGrams(ingredient) {
  if (ingredient.unit === 'piece') return ingredient.quantity * (ingredient.serving_weight_g || 100);
  if (ingredient.unit === 'tbsp') return ingredient.quantity * 14;
  if (ingredient.unit === 'tsp') return ingredient.quantity * 5;
  if (ingredient.unit === 'cup') return ingredient.quantity * 240;
  return ingredient.quantity;
}

module.exports = router;
