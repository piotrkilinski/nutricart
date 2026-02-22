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
 *     breakfast: 'meal' | 'products',   // domyślnie 'products'
 *     lunch:     'meal' | 'products',
 *     dinner:    'meal' | 'products',
 *     snack:     'meal' | 'products'
 *   }
 * }
 *
 * Logika:
 * - tryb 'products': dobieramy gotowe produkty kaloryjnie + sprawdzamy czy jest
 *   gotowy snack-meal (zestaw z meals o typie 'snack') — snack-meal ma wyższą wagę
 * - tryb 'meal': szukamy przepisu, a niedobór kalorii dopełniamy gotowym produktem
 * - snack w trybie 'products': snack-meals (zestawy gotowych produktów) mają
 *   wyższą wagę niż pojedyncze produkty
 */
router.post('/', async (req, res) => {
  try {
    const { store_ids, target_calories, modes = {} } = req.body;

    if (!store_ids?.length || !target_calories) {
      return res.status(400).json({ error: 'Podaj store_ids i target_calories' });
    }

    // Domyślnie 'products' dla wszystkich slotów
    const slotModes = {
      breakfast: modes.breakfast || 'products',
      lunch:     modes.lunch     || 'products',
      dinner:    modes.dinner    || 'products',
      snack:     modes.snack     || 'products',
    };

    const placeholders = store_ids.map(() => '?').join(',');

    // Aktywne produkty w wybranych sklepach — wykluczamy konkretne instancje generycznych
    // (generic_product_id IS NOT NULL = produkt ma swój generyczny odpowiednik → pomijamy)
    const [allActiveProducts] = await db.query(
      `SELECT DISTINCT p.id, p.name, p.calories_per_100g, p.protein_per_100g,
              p.carbs_per_100g, p.fat_per_100g, p.serving_unit, p.serving_weight_g,
              p.category, p.is_ready_to_eat, p.is_generic
       FROM products p
       JOIN product_stores ps ON p.id = ps.product_id
       WHERE ps.store_id IN (${placeholders})
         AND p.status = 'active'
         AND p.calories_per_100g IS NOT NULL
         AND p.generic_product_id IS NULL`,
      store_ids
    );

    // Tylko gotowe do jedzenia — do trybu 'products' i dopełniania
    const readyProducts = allActiveProducts.filter(p => p.is_ready_to_eat === 1);
    const allProductIds = new Set(allActiveProducts.map(p => p.id));

    // Pobierz posiłki ze składnikami
    const [meals] = await db.query('SELECT * FROM meals');
    const [ingredients] = await db.query(`
      SELECT mi.*, p.calories_per_100g, p.protein_per_100g, p.carbs_per_100g,
             p.fat_per_100g, p.serving_weight_g, p.name as product_name, p.is_ready_to_eat
      FROM meal_ingredients mi
      JOIN products p ON mi.product_id = p.id
      WHERE p.status = 'active'
    `);

    // Oblicz kalorie i sprawdź dostępność składników
    const mealsWithCalories = meals.map(meal => {
      const mealIngr = ingredients.filter(i => i.meal_id === meal.id);
      if (!mealIngr.length) return null;
      // Przepis dostępny gdy WSZYSTKIE składniki są w wybranych sklepach
      const allAvailable = mealIngr.every(i => allProductIds.has(i.product_id));
      if (!allAvailable) return null;

      const totalCalories = mealIngr.reduce((s, i) => s + calcCalories(i), 0);
      const totalProtein  = mealIngr.reduce((s, i) => s + calcNutrient(i, 'protein_per_100g'), 0);
      const totalCarbs    = mealIngr.reduce((s, i) => s + calcNutrient(i, 'carbs_per_100g'), 0);
      const totalFat      = mealIngr.reduce((s, i) => s + calcNutrient(i, 'fat_per_100g'), 0);

      // Czy to "snack meal" — zestaw złożony wyłącznie z gotowych produktów
      const isReadyToEatMeal = mealIngr.every(i => i.is_ready_to_eat === 1);

      return {
        ...meal,
        total_calories: Math.round(totalCalories),
        total_protein:  round1(totalProtein),
        total_carbs:    round1(totalCarbs),
        total_fat:      round1(totalFat),
        is_ready_to_eat_meal: isReadyToEatMeal,
        ingredients: mealIngr.map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          calories: Math.round(calcCalories(i))
        }))
      };
    }).filter(Boolean);

    // Podział kalorii (śniadanie 25%, obiad 35%, kolacja 30%, przekąska 10%)
    const calSplit = {
      breakfast: Math.round(target_calories * 0.25),
      lunch:     Math.round(target_calories * 0.35),
      dinner:    Math.round(target_calories * 0.30),
      snack:     Math.round(target_calories * 0.10),
    };

    const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
    const slotLabels = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska' };
    const results = [];

    for (const slot of slots) {
      const mode = slotModes[slot];
      const targetCal = calSplit[slot];
      const byType = mealsWithCalories.filter(m => m.meal_type === slot);

      if (mode === 'products') {
        const result = buildProductsSlot(readyProducts, byType, targetCal, slot);
        results.push({ ...result, slot, type_label: slotLabels[slot], mode: 'products' });

      } else {
        // tryb 'meal' — znajdź przepis, dopełnij gotowym produktem
        const result = buildMealSlot(byType, readyProducts, targetCal);
        results.push({ ...result, slot, type_label: slotLabels[slot], mode: 'meal' });
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

// ── Tryb PRODUCTS ─────────────────────────────────────────────────────────────
// Dla snacka: snack-meals (tylko gotowe produkty) mają wyższą wagę niż pojedyncze.
// Dla pozostałych slotów: tylko pojedyncze gotowe produkty.

function buildProductsSlot(readyProducts, mealsForSlot, targetCal, slot) {
  if (slot === 'snack') {
    // Snack-meals — gotowe zestawy z tabeli meals złożone wyłącznie z ready_to_eat produktów
    const snackMeals = mealsForSlot.filter(m => m.is_ready_to_eat_meal);

    if (snackMeals.length > 0) {
      // 70% szans na snack-meal, 30% na pojedyncze produkty
      const useSnackMeal = Math.random() < 0.70;
      if (useSnackMeal) {
        const picked = pickClosest(snackMeals, targetCal);
        return {
          ...picked,
          source: 'snack_meal',
          name: picked.name,
        };
      }
    }
    // Fallback lub 30% — zestaw pojedynczych produktów
    return buildProductMeal(readyProducts, targetCal, slot);
  }

  // Pozostałe sloty — tylko gotowe produkty
  return buildProductMeal(readyProducts, targetCal, slot);
}

// ── Tryb MEAL ─────────────────────────────────────────────────────────────────
// Znajdź przepis. Jeśli brakuje kalorii (>10% różnicy) — dopełnij gotowym produktem.

function buildMealSlot(mealsForSlot, readyProducts, targetCal) {
  if (!mealsForSlot.length) {
    return {
      name: 'Brak dostępnych przepisów',
      error: 'Brak przepisów dla tej pory dnia w wybranych sklepach',
      total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0,
      ingredients: [],
    };
  }

  const meal = pickClosest(mealsForSlot, targetCal);
  const gap = targetCal - meal.total_calories;
  const gapPercent = gap / targetCal;

  // Dopełnij jeśli brakuje więcej niż 10% i mamy gotowe produkty
  if (gapPercent > 0.10 && readyProducts.length > 0) {
    const topping = pickToppingProduct(readyProducts, gap);
    if (topping) {
      const toppingCal = Math.round(caloriesForProduct(topping));
      const servingG = getServingG(topping);
      return {
        ...meal,
        name: meal.name,
        total_calories: meal.total_calories + toppingCal,
        total_protein:  round1(meal.total_protein + calcNutrientProduct(topping, 'protein_per_100g')),
        total_carbs:    round1(meal.total_carbs   + calcNutrientProduct(topping, 'carbs_per_100g')),
        total_fat:      round1(meal.total_fat     + calcNutrientProduct(topping, 'fat_per_100g')),
        ingredients: [
          ...meal.ingredients,
          {
            product_name: topping.name + ' ✚',  // znacznik że to dodatek
            quantity: topping.serving_unit === 'piece' ? 1 : servingG,
            unit: topping.serving_unit === 'piece' ? 'piece' : 'g',
            calories: toppingCal,
          }
        ],
        topping_added: true,
      };
    }
  }

  return meal;
}

// Wybierz produkt którego kalorie najlepiej pasują do niedoboru
function pickToppingProduct(products, gap) {
  if (!products.length || gap <= 0) return null;
  // Filtruj produkty które nie przekroczą luki o więcej niż 50%
  const candidates = products.filter(p => caloriesForProduct(p) <= gap * 1.5);
  if (!candidates.length) return products.reduce((a, b) =>
    caloriesForProduct(a) < caloriesForProduct(b) ? a : b
  );
  return candidates.reduce((best, p) =>
    Math.abs(caloriesForProduct(p) - gap) < Math.abs(caloriesForProduct(best) - gap) ? p : best
  );
}

// ── Dobór zestawu produktów ───────────────────────────────────────────────────

const SLOT_CATEGORIES = {
  breakfast: ['nabiał', 'zboża', 'owoce'],
  lunch:     ['mięso', 'zboża', 'warzywa', 'strączkowe'],
  dinner:    ['mięso', 'warzywa', 'nabiał'],
  snack:     ['owoce', 'orzechy', 'nabiał', 'przekąski'],
};

function buildProductMeal(allProducts, targetCal, slot) {
  const preferredCats = SLOT_CATEGORIES[slot] || [];
  const TOLERANCE = 0.20;
  const MIN = targetCal * (1 - TOLERANCE);
  const MAX = targetCal * (1 + TOLERANCE);

  const preferred = allProducts.filter(p => preferredCats.includes(p.category));
  const other = allProducts.filter(p => !preferredCats.includes(p.category));
  const pool = [...preferred, ...other];

  if (!pool.length) return emptyMeal();

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
      if (diff < targetCal * 0.05) break;
    }
  }

  if (!best) {
    const fallback = preferred[0] || pool[0];
    best = { selected: [fallback], totalCal: caloriesForProduct(fallback) };
  }

  const ingredients = best.selected.map(p => {
    const servingG = getServingG(p);
    return {
      product_name: p.name,
      quantity: p.serving_unit === 'piece' ? 1 : servingG,
      unit: p.serving_unit === 'piece' ? 'piece' : 'g',
      calories: Math.round(caloriesForProduct(p))
    };
  });

  return {
    name: 'Zestaw produktów',
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
  return (getWeightInGrams(ingredient) / 100) * (ingredient[field] || 0);
}

function getServingG(product) {
  if (product.serving_unit === 'piece') return product.serving_weight_g || 100;
  if (product.serving_unit === 'tbsp')  return 14;
  if (product.serving_unit === 'tsp')   return 5;
  if (product.serving_unit === 'cup')   return 240;
  return product.serving_weight_g || 100;
}

function caloriesForProduct(product) {
  return (getServingG(product) / 100) * (product.calories_per_100g || 0);
}

function calcNutrientProduct(product, field) {
  return (getServingG(product) / 100) * (product[field] || 0);
}

function pickClosest(items, targetCal) {
  if (!items.length) return null;
  return items.reduce((best, m) =>
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
