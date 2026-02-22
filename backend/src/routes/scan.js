const express = require('express');
const router = express.Router();
const db = require('../db');

const OFF_API = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = [
  'product_name', 'product_name_pl', 'brands', 'quantity', 'serving_size',
  'categories_tags', 'labels_tags',
  'ingredients_text', 'ingredients_text_pl',
  'allergens_tags', 'traces_tags', 'additives_tags',
  'nutriments', 'nutrition_grades',
  'nova_group', 'ecoscore_grade',
  'image_front_url', 'image_nutrition_url', 'image_ingredients_url',
  'packaging_tags', 'origins', 'countries_tags',
  'attribute_groups_en',
].join(',');

/**
 * GET /api/scan/:barcode
 * Tylko CZYTA — nie zapisuje nic do bazy.
 * Zwraca:
 *   - dane z OFF (zawsze świeże)
 *   - jeśli produkt jest w bazie: aktualne wartości (status, is_ready_to_eat, store_ids, id)
 *   - is_new: true/false
 */
router.get('/:barcode', async (req, res) => {
  const { barcode } = req.params;
  try {
    // 1. Sprawdz bazę
    const [existing] = await db.query('SELECT * FROM products WHERE barcode = ?', [barcode]);
    const dbProduct = existing.length > 0 ? existing[0] : null;
    let dbStoreIds = [];
    if (dbProduct) {
      const [stores] = await db.query(
        'SELECT store_id FROM product_stores WHERE product_id = ?', [dbProduct.id]
      );
      dbStoreIds = stores.map(s => s.store_id);
    }

    // 2. Pobierz z OpenFoodFacts
    const offRes = await fetch(`${OFF_API}/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'NutriCart/1.0 (nutricart@example.com)' }
    });
    const offData = await offRes.json();

    if (!offData.product || offData.status === 0) {
      // Nie ma w OFF — jeśli jest w bazie to i tak pokaż
      if (dbProduct) {
        return res.json({
          is_new: false,
          product: { ...dbProduct, store_ids: dbStoreIds },
          off_preview: null,
        });
      }
      return res.status(404).json({ status: 'not_found', message: 'Produkt nie znaleziony w OpenFoodFacts' });
    }

    // 3. Zbuduj podgląd z OFF (bez zapisywania)
    const p = offData.product;
    const n = p.nutriments || {};
    const labels = p.labels_tags || [];
    const attrs = extractAttributes(p.attribute_groups_en || []);

    const offPreview = {
      name: p.product_name_pl || p.product_name || 'Nieznany produkt',
      barcode,
      brand: p.brands || null,
      quantity: p.quantity || null,
      category: mapCategory(p.categories_tags),
      serving_unit: 'g',
      serving_weight_g: parseServingWeight(p.serving_size),
      calories_per_100g: n['energy-kcal_100g'] || (n['energy-kj_100g'] ? Math.round(n['energy-kj_100g'] / 4.184) : null),
      protein_per_100g: n.proteins_100g || null,
      carbs_per_100g: n.carbohydrates_100g || null,
      fat_per_100g: n.fat_100g || null,
      fiber_per_100g: n.fiber_100g || null,
      sugars_per_100g: n.sugars_100g || null,
      saturated_fat_per_100g: n['saturated-fat_100g'] || null,
      salt_per_100g: n.salt_100g || null,
      sodium_per_100g: n.sodium_100g ? n.sodium_100g * 1000 : null,
      vitamin_a_per_100g: n['vitamin-a_100g'] ? n['vitamin-a_100g'] * 1000000 : null,
      vitamin_b1_per_100g: n['vitamin-b1_100g'] ? n['vitamin-b1_100g'] * 1000 : null,
      vitamin_b2_per_100g: n['vitamin-b2_100g'] ? n['vitamin-b2_100g'] * 1000 : null,
      vitamin_b3_per_100g: n['vitamin-pp_100g'] ? n['vitamin-pp_100g'] * 1000 : null,
      vitamin_b6_per_100g: n['vitamin-b6_100g'] ? n['vitamin-b6_100g'] * 1000 : null,
      vitamin_b9_per_100g: n['vitamin-b9_100g'] ? n['vitamin-b9_100g'] * 1000000 : null,
      vitamin_b12_per_100g: n['vitamin-b12_100g'] ? n['vitamin-b12_100g'] * 1000000 : null,
      vitamin_c_per_100g: n['vitamin-c_100g'] ? n['vitamin-c_100g'] * 1000 : null,
      vitamin_d_per_100g: n['vitamin-d_100g'] ? n['vitamin-d_100g'] * 1000000 : null,
      vitamin_e_per_100g: n['vitamin-e_100g'] ? n['vitamin-e_100g'] * 1000 : null,
      vitamin_k_per_100g: n['vitamin-k_100g'] ? n['vitamin-k_100g'] * 1000000 : null,
      calcium_per_100g: n.calcium_100g ? n.calcium_100g * 1000 : null,
      iron_per_100g: n.iron_100g ? n.iron_100g * 1000 : null,
      magnesium_per_100g: n.magnesium_100g ? n.magnesium_100g * 1000 : null,
      phosphorus_per_100g: n.phosphorus_100g ? n.phosphorus_100g * 1000 : null,
      potassium_per_100g: n.potassium_100g ? n.potassium_100g * 1000 : null,
      zinc_per_100g: n.zinc_100g ? n.zinc_100g * 1000 : null,
      selenium_per_100g: n.selenium_100g ? n.selenium_100g * 1000000 : null,
      copper_per_100g: n.copper_100g ? n.copper_100g * 1000 : null,
      manganese_per_100g: n.manganese_100g ? n.manganese_100g * 1000 : null,
      iodine_per_100g: n.iodine_100g ? n.iodine_100g * 1000000 : null,
      chromium_per_100g: n.chromium_100g ? n.chromium_100g * 1000000 : null,
      ingredients_text: p.ingredients_text_pl || p.ingredients_text || null,
      allergens: p.allergens_tags?.length ? JSON.stringify(p.allergens_tags) : null,
      traces: p.traces_tags?.length ? JSON.stringify(p.traces_tags) : null,
      additives: p.additives_tags?.length ? JSON.stringify(p.additives_tags) : null,
      nutriscore: p.nutrition_grades ? p.nutrition_grades.trim().toUpperCase().charAt(0) : null,
      nova_group: p.nova_group || null,
      ecoscore: p.ecoscore_grade ? p.ecoscore_grade.trim().toUpperCase().charAt(0) : null,
      is_vegan: attrs.vegan ?? inferFromLabels(labels, ['en:vegan']),
      is_vegetarian: attrs.vegetarian ?? inferFromLabels(labels, ['en:vegetarian', 'en:vegan']),
      is_gluten_free: inferFromLabels(labels, ['en:gluten-free', 'en:no-gluten']),
      is_lactose_free: inferFromLabels(labels, ['en:lactose-free', 'en:no-lactose']),
      is_organic: inferFromLabels(labels, ['en:organic', 'en:eu-organic', 'pl:bio']),
      is_palm_oil_free: inferFromLabels(labels, ['en:no-palm-oil', 'en:palm-oil-free']),
      is_halal: inferFromLabels(labels, ['en:halal']),
      is_kosher: inferFromLabels(labels, ['en:kosher']),
      packaging: p.packaging_tags?.length ? JSON.stringify(p.packaging_tags) : null,
      origins: p.origins || null,
      countries: p.countries_tags?.length ? JSON.stringify(p.countries_tags) : null,
      image_url: p.image_front_url || null,
      image_nutrition_url: p.image_nutrition_url || null,
      image_ingredients_url: p.image_ingredients_url || null,
      off_data: JSON.stringify(offData.product),
    };

    res.json({
      is_new: !dbProduct,
      // Jeśli jest w bazie — zwróć dane z bazy (mają priorytet), podgląd OFF jako uzupełnienie
      product: dbProduct
        ? { ...dbProduct, store_ids: dbStoreIds }
        : null,
      off_preview: offPreview,
    });

  } catch (err) {
    console.error('Scan GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scan/:barcode
 * Zapisuje produkt do bazy (nowy lub aktualizacja istniejącego).
 * Body: { store_ids, status, is_ready_to_eat, ...off_preview_data }
 */
router.post('/:barcode', async (req, res) => {
  const { barcode } = req.params;
  const { store_ids = [], status, is_ready_to_eat, ...offData } = req.body;

  try {
    const [existing] = await db.query('SELECT id FROM products WHERE barcode = ?', [barcode]);
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      let productId;

      if (existing.length > 0) {
        // Aktualizuj istniejący
        productId = existing[0].id;
        await conn.query(
          `UPDATE products SET status = ?, is_ready_to_eat = ? WHERE id = ?`,
          [status, is_ready_to_eat, productId]
        );
      } else {
        // Nowy produkt — wstaw z pełnymi danymi z OFF
        const data = {
          ...offData,
          barcode,
          status: status || 'inactive_incomplete',
          is_ready_to_eat: is_ready_to_eat ?? null,
        };
        // Usuń pola których nie ma w bazie
        delete data.store_ids;

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');
        const columnNames = columns.map(c => `\`${c}\``).join(', ');

        const [result] = await conn.query(
          `INSERT INTO products (${columnNames}) VALUES (${placeholders})`,
          values
        );
        productId = result.insertId;
      }

      // Aktualizuj sklepy — usuń stare, wstaw nowe
      await conn.query('DELETE FROM product_stores WHERE product_id = ?', [productId]);
      if (store_ids.length > 0) {
        const storeValues = store_ids.map(sid => [productId, sid]);
        await conn.query('INSERT INTO product_stores (product_id, store_id) VALUES ?', [storeValues]);
      }

      await conn.commit();

      const [updated] = await conn.query('SELECT * FROM products WHERE id = ?', [productId]);
      res.status(existing.length > 0 ? 200 : 201).json({
        status: existing.length > 0 ? 'updated' : 'created',
        product: { ...updated[0], store_ids },
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('Scan POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferFromLabels(labels, keywords) {
  if (!labels?.length) return null;
  return keywords.some(k => labels.includes(k)) ? 1 : null;
}

function extractAttributes(attrGroups) {
  const result = {};
  for (const group of attrGroups) {
    for (const attr of (group.attributes || [])) {
      if (attr.id === 'vegan') result.vegan = attr.status === 'yes' ? 1 : attr.status === 'no' ? 0 : null;
      if (attr.id === 'vegetarian') result.vegetarian = attr.status === 'yes' ? 1 : attr.status === 'no' ? 0 : null;
    }
  }
  return result;
}

function mapCategory(tags) {
  if (!tags?.length) return 'inne';
  const map = {
    'en:dairies': 'nabiał', 'en:cheeses': 'nabiał', 'en:yogurts': 'nabiał',
    'en:fruits': 'owoce', 'en:fresh-fruits': 'owoce',
    'en:vegetables': 'warzywa', 'en:fresh-vegetables': 'warzywa',
    'en:meats': 'mięso', 'en:poultry': 'mięso', 'en:fish': 'mięso',
    'en:cereals': 'zboża', 'en:breads': 'zboża', 'en:pasta': 'zboża', 'en:rice': 'zboża',
    'en:beverages': 'napoje', 'en:waters': 'napoje', 'en:juices': 'napoje',
    'en:sweets': 'słodycze', 'en:chocolates': 'słodycze', 'en:biscuits': 'słodycze',
    'en:snacks': 'przekąski', 'en:legumes': 'strączkowe', 'en:nuts': 'orzechy',
    'en:sauces': 'sosy', 'en:spices': 'przyprawy',
    'en:frozen-foods': 'mrożone', 'en:canned-foods': 'konserwy',
  };
  for (const tag of tags) { if (map[tag]) return map[tag]; }
  return 'inne';
}

function parseServingWeight(servingSize) {
  if (!servingSize) return null;
  const match = servingSize.match(/(\d+(?:\.\d+)?)\s*g/i);
  return match ? parseFloat(match[1]) : null;
}

module.exports = router;
