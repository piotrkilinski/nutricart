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

router.get('/:barcode', async (req, res) => {
  const { barcode } = req.params;
  const { store_id } = req.query;

  try {
    // Sprawdz czy produkt juz istnieje
    const [existing] = await db.query('SELECT * FROM products WHERE barcode = ?', [barcode]);
    if (existing.length > 0) {
      const product = existing[0];
      if (store_id) {
        await db.query(
          'INSERT IGNORE INTO product_stores (product_id, store_id) VALUES (?, ?)',
          [product.id, store_id]
        );
      }
      const [stores] = await db.query('SELECT store_id FROM product_stores WHERE product_id = ?', [product.id]);
      return res.json({
        status: 'existing',
        message: 'Produkt już istnieje w bazie',
        product: { ...product, store_ids: stores.map(s => s.store_id) }
      });
    }

    // Pobierz z OpenFoodFacts
    const offRes = await fetch(`${OFF_API}/${barcode}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': 'NutriCart/1.0 (nutricart@example.com)' }
    });
    const offData = await offRes.json();

    if (!offData.product || offData.status === 0) {
      return res.status(404).json({ status: 'not_found', message: 'Produkt nie znaleziony w OpenFoodFacts' });
    }

    const p = offData.product;
    const n = p.nutriments || {};
    const labels = p.labels_tags || [];
    const attrs = extractAttributes(p.attribute_groups_en || []);

    // Buduj obiekt z danymi — INSERT użyje kluczy jako nazw kolumn
    const data = {
      name: p.product_name_pl || p.product_name || 'Nieznany produkt',
      barcode,
      brand: p.brands || null,
      quantity: p.quantity || null,
      category: mapCategory(p.categories_tags),
      serving_unit: 'g',
      serving_weight_g: parseServingWeight(p.serving_size),

      // Makroskładniki
      calories_per_100g: n['energy-kcal_100g'] || (n['energy-kj_100g'] ? Math.round(n['energy-kj_100g'] / 4.184) : null),
      protein_per_100g: n.proteins_100g || null,
      carbs_per_100g: n.carbohydrates_100g || null,
      fat_per_100g: n.fat_100g || null,
      fiber_per_100g: n.fiber_100g || null,
      sugars_per_100g: n.sugars_100g || null,
      saturated_fat_per_100g: n['saturated-fat_100g'] || null,
      salt_per_100g: n.salt_100g || null,
      sodium_per_100g: n.sodium_100g ? n.sodium_100g * 1000 : null,

      // Witaminy
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

      // Minerały
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

      // Składniki i alergeny
      ingredients_text: p.ingredients_text_pl || p.ingredients_text || null,
      allergens: p.allergens_tags?.length ? JSON.stringify(p.allergens_tags) : null,
      traces: p.traces_tags?.length ? JSON.stringify(p.traces_tags) : null,
      additives: p.additives_tags?.length ? JSON.stringify(p.additives_tags) : null,

      // Oceny
      nutriscore: p.nutrition_grades?.toUpperCase() || null,
      nova_group: p.nova_group || null,
      ecoscore: p.ecoscore_grade?.toUpperCase() || null,

      // Preferencje dietetyczne
      is_vegan: attrs.vegan ?? inferFromLabels(labels, ['en:vegan']),
      is_vegetarian: attrs.vegetarian ?? inferFromLabels(labels, ['en:vegetarian', 'en:vegan']),
      is_gluten_free: inferFromLabels(labels, ['en:gluten-free', 'en:no-gluten']),
      is_lactose_free: inferFromLabels(labels, ['en:lactose-free', 'en:no-lactose']),
      is_organic: inferFromLabels(labels, ['en:organic', 'en:eu-organic', 'pl:bio']),
      is_palm_oil_free: inferFromLabels(labels, ['en:no-palm-oil', 'en:palm-oil-free']),
      is_halal: inferFromLabels(labels, ['en:halal']),
      is_kosher: inferFromLabels(labels, ['en:kosher']),

      // Opakowanie i pochodzenie
      packaging: p.packaging_tags?.length ? JSON.stringify(p.packaging_tags) : null,
      origins: p.origins || null,
      countries: p.countries_tags?.length ? JSON.stringify(p.countries_tags) : null,

      // Zdjęcia
      image_url: p.image_front_url || null,
      image_nutrition_url: p.image_nutrition_url || null,
      image_ingredients_url: p.image_ingredients_url || null,

      off_data: JSON.stringify(offData.product),
    };

    // Dynamiczny INSERT — kolumny i wartości generowane z obiektu
    // Gwarantuje że liczba kolumn = liczba wartości
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    const columnNames = columns.map(c => `\`${c}\``).join(', ');

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO products (${columnNames}) VALUES (${placeholders})`,
        values
      );

      if (store_id) {
        await conn.query(
          'INSERT IGNORE INTO product_stores (product_id, store_id) VALUES (?, ?)',
          [result.insertId, store_id]
        );
      }

      await conn.commit();
      res.status(201).json({
        status: 'created',
        message: 'Produkt dodany do bazy',
        product: { id: result.insertId, ...data, store_ids: store_id ? [parseInt(store_id)] : [] }
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('Scan error:', err);
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
