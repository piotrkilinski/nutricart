const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/generate
 * Body:
 * {
 *   store_ids: [1, 3],
 *   target_calories: 2000,
 *   modes: {
 *     breakfast: 'meal' | 'products',
 *     lunch:     'meal' | 'products',
 *     dinner:    'meal' | 'products',
 *     snack:     'meal' | 'products'
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { store_ids, target_calories, modes = {} } = req.body;

    if (!store_ids?.length || !target_calories) {
      return res.status(400).json({ error: 'Podaj store_ids i target_calories' });
    }

    // Domyślne tryby jeśli nie podano
    const slotModes = {
      breakfast: modes.breakfast || 'meal',
      lunch:     modes.lunch     || 'meal',
      dinner:    modes.dinner    || 'meal',
      snack:     modes.snack     || 'meal',
    };

    // Pobierz dostępne produkty (aktywne, w wybranych sklepach)
    const placeholders = store_ids.map(() => '?').join(',');
    const [availableRows] = await db.query(
      `SELECT DISTINCT p.id, p.name, p.calories_per_100g, p.protein_per_100g,
              p.carbs_per_100g, p.fat_per_100g, p.serving_unit, p.serving_weight_g, p.category
       FROM products p
       JOIN product_stores ps ON p.id = ps.product_id
       WHERE ps.store_id IN (${placeholders})
         AND p.status = 'active'
         AND p.calories_per_100g IS NOT NULL
         AND p.is_ready_to_eat = 1`,
      store_ids
    );

    const availableProductIds = new Set(availableRows.map(p => p.id));

    // Pobierz posiłki ze składnikami
    const [meals] = await db.query('SELECT * FROM meals');
    const [ingredients] = await db.query(`
      SELECT mi.*, p.calories_per_100g, p.protein_per_100g, p.carbs_per_100g,
             p.fat_per_100g, p.serving_weight_g, p.name as product_name
      FROM meal_ingredients mi
      JOIN products p ON mi.product_id = p.id
      WHERE p.status = 'active'
    `);

    // Oblicz kalorie posiłków i sprawdź dostępność składników
    const mealsWithCalories = meals.map(meal => {
      const mealIngr = ingredients.filter(i => i.meal_id === meal.id);
      const allAvailable = mealIngr.every(i => availableProductIds.has(i.product_id));
      if (!allAvailable) return null;

      const totalCalories = mealIngr.reduce((s, i) => s + calcCalories(i), 0);
      const totalProtein  = mealIngr.reduce((s, i) => s + calcNutrient(i, 'protein_per_100g'), 0);
      const totalCarbs    = mealIngr.reduce((s, i) => s + calcNutrient(i, 'carbs_per_100g'), 0);
      const totalFat      = mealIngr.reduce((s, i) => s + calcNutrient(i, 'fat_per_100g'), 0);

      return {
        ...meal,
        total_calories: Math.round(totalCalories),
        total_protein:  round1(totalProtein),
        total_carbs:    round1(totalCarbs),
        total_fat:      round1(totalFat),
        ingredients: mealIngr.map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          calories: Math.round(calcCalories(i))
        }))
      };
    }).filter(Boolean);

    // Podział kalorii na pory dnia (śniadanie 25%, obiad 35%, kolacja 30%, przekąska 10%)
    const calSplit = {
      breakfast: Math.round(target_calories * 0.25),
      lunch:     Math.round(target_calories * 0.35),
      dinner:    Math.round(target_calories * 0.30),
      snack:     Math.round(target_calories * 0.10),
    };

    // Generuj każdy slot
    const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
    const slotLabels = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska' };
    const results = [];

    for (const slot of slots) {
      const mode = slotModes[slot];
      const targetCal = calSplit[slot];
      const byType = mealsWithCalories.filter(m => m.meal_type === slot);

      if (mode === 'meal') {
        const meal = pickClosest(byType, targetCal);
        if (!meal) {
          results.push({
            slot,
            type_label: slotLabels[slot],
            mode: 'meal',
            error: 'Brak dostępnych posiłków dla tej pory dnia',
            total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0,
            ingredients: []
          });
        } else {
          results.push({ ...meal, slot, type_label: slotLabels[slot], mode: 'meal' });
        }
      } else {
        // Tryb produktów — dobierz zestaw produktów wg kalorii
        const productMeal = buildProductMeal(availableRows, targetCal, slot);
        results.push({ ...productMeal, slot, type_label: slotLabels[slot], mode: 'products' });
      }
    }

    const totalCalories = results.reduce((s, r) => s + (r.total_calories || 0), 0);
    const totalProtein  = round1(results.reduce((s, r) => s + (r.total_protein || 0), 0));
    const totalCarbs    = round1(results.reduce((s, r) => s + (r.total_carbs || 0), 0));
    const totalFat      = round1(results.reduce((s, r) => s + (r.total_fat || 0), 0));

    res.json({
      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,
      target_calories,
      meals: results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Dobór produktów według kalorii ───────────────────────────────────────────

const SLOT_CATEGORIES = {
  breakfast: ['nabiał', 'zboża', 'owoce'],
  lunch:     ['mięso', 'zboża', 'warzywa', 'strączkowe'],
  dinner:    ['mięso', 'warzywa', 'nabiał'],
  snack:     ['owoce', 'orzechy', 'nabiał', 'przekąski'],
};

function buildProductMeal(allProducts, targetCal, slot) {
  const preferredCats = SLOT_CATEGORIES[slot] || [];
  const TOLERANCE = 0.20; // ±20%
  const MIN = targetCal * (1 - TOLERANCE);
  const MAX = targetCal * (1 + TOLERANCE);

  // Preferuj produkty z odpowiednich kategorii, dopełnij resztą
  const preferred = allProducts.filter(p => preferredCats.includes(p.category));
  const other = allProducts.filter(p => !preferredCats.includes(p.category));
  const pool = [...preferred, ...other];

  // Losuj produkty i dodawaj dopóki nie przekroczymy kalorii
  let best = null;
  let bestDiff = Infinity;

  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = shuffle([...pool]);
    const selected = [];
    let totalCal = 0;

    for (const product of shuffled) {
      const cal = caloriesForProduct(product);
      if (totalCal + cal > MAX) continue;
      selected.push(product);
      totalCal += cal;
      if (totalCal >= MIN) break;
    }

    if (!selected.length) continue;

    const diff = Math.abs(totalCal - targetCal);
    if (totalCal >= MIN && totalCal <= MAX && diff < bestDiff) {
      bestDiff = diff;
      best = { selected, totalCal };
      if (diff < targetCal * 0.05) break; // wystarczająco blisko
    }
  }

  if (!best) {
    // Fallback: weź pierwszy produkt z preferowanych
    const fallback = preferred[0] || pool[0];
    if (!fallback) return emptyMeal();
    best = { selected: [fallback], totalCal: caloriesForProduct(fallback) };
  }

  const ingredients = best.selected.map(p => {
    const servingG = getServingG(p);
    const unit = p.serving_unit === 'piece' ? 'piece' : 'g';
    const qty = p.serving_unit === 'piece' ? 1 : servingG;
    return {
      product_name: p.name,
      quantity: qty,
      unit,
      serving_weight_g: servingG,
      calories: Math.round(caloriesForProduct(p))
    };
  });

  return {
    name: 'Zestaw produktów',
    description: `${ingredients.map(i => i.product_name).join(', ')}`,
    total_calories: Math.round(best.totalCal),
    total_protein: round1(best.selected.reduce((s, p) => s + calcNutrientProduct(p, 'protein_per_100g'), 0)),
    total_carbs:   round1(best.selected.reduce((s, p) => s + calcNutrientProduct(p, 'carbs_per_100g'), 0)),
    total_fat:     round1(best.selected.reduce((s, p) => s + calcNutrientProduct(p, 'fat_per_100g'), 0)),
    ingredients,
  };
}

function emptyMeal() {
  return { name: 'Brak produktów', total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, ingredients: [] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeightInGrams(ingredient) {
  if (ingredient.unit === 'piece') return ingredient.quantity * (ingredient.serving_weight_g || 100);
  if (ingredient.unit === 'tbsp')  return ingredient.quantity * 14;
  if (ingredient.unit === 'tsp')   return ingredient.quantity * 5;
  if (ingredient.unit === 'cup')   return ingredient.quantity * 240;
  return ingredient.quantity;
}

function calcCalories(ingredient) {
  return (getWeightInGrams(ingredient) / 100) * ingredient.calories_per_100g;
}

function calcNutrient(ingredient, field) {
  return (getWeightInGrams(ingredient) / 100) * ingredient[field];
}

function getServingG(product) {
  if (product.serving_unit === 'piece') return product.serving_weight_g || 100;
  if (product.serving_unit === 'tbsp')  return 14;
  if (product.serving_unit === 'tsp')   return 5;
  if (product.serving_unit === 'cup')   return 240;
  return product.serving_weight_g || 100;
}

function caloriesForProduct(product) {
  return (getServingG(product) / 100) * product.calories_per_100g;
}

function calcNutrientProduct(product, field) {
  return (getServingG(product) / 100) * (product[field] || 0);
}

function pickClosest(meals, targetCal) {
  if (!meals.length) return null;
  return meals.reduce((best, m) =>
    Math.abs(m.total_calories - targetCal) < Math.abs(best.total_calories - targetCal) ? m : best
  );
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function round1(val) { return Math.round(val * 10) / 10; }

module.exports = router;
