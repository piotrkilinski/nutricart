const express = require('express');
const router = express.Router();
const db = require('../db');

// ── GET /api/products — lista wszystkich produktów ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT p.*, GROUP_CONCAT(ps.store_id) as store_ids
      FROM products p
      LEFT JOIN product_stores ps ON p.id = ps.product_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(products.map(p => ({
      ...p,
      store_ids: p.store_ids ? p.store_ids.split(',').map(Number) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GENERIC ROUTES — muszą być PRZED /:id ─────────────────────────────────────

// GET /api/products/generic — lista produktów generycznych
router.get('/generic', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, GROUP_CONCAT(ps.store_id) as store_ids
       FROM products p
       LEFT JOIN product_stores ps ON p.id = ps.product_id
       WHERE p.is_generic = 1
       GROUP BY p.id
       ORDER BY p.category, p.name`
    );
    res.json(rows.map(p => ({
      ...p,
      store_ids: p.store_ids ? p.store_ids.split(',').map(Number) : []
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/generic — dodaj produkt generyczny
router.post('/generic', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, category,
      calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      fiber_per_100g, sugars_per_100g, saturated_fat_per_100g, salt_per_100g,
      serving_unit = 'g', serving_weight_g = 100,
      is_ready_to_eat = null,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Nazwa jest wymagana' });

    const [result] = await conn.query(
      `INSERT INTO products
        (name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
         fiber_per_100g, sugars_per_100g, saturated_fat_per_100g, salt_per_100g,
         serving_unit, serving_weight_g, is_ready_to_eat, is_generic, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
      [name.trim(), category || 'inne',
       calories_per_100g || null, protein_per_100g || null, carbs_per_100g || null, fat_per_100g || null,
       fiber_per_100g || null, sugars_per_100g || null, saturated_fat_per_100g || null, salt_per_100g || null,
       serving_unit, serving_weight_g, is_ready_to_eat]
    );
    const productId = result.insertId;

    // Podpnij automatycznie pod wszystkie aktywne sklepy
    const [stores] = await conn.query("SELECT id FROM stores WHERE status = 'active'");
    if (stores.length > 0) {
      const vals = stores.map(s => [productId, s.id]);
      await conn.query('INSERT IGNORE INTO product_stores (product_id, store_id) VALUES ?', [vals]);
    }

    await conn.commit();
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
    res.status(201).json({ ...rows[0], store_ids: stores.map(s => s.id) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PATCH /api/products/generic/:id — edytuj produkt generyczny
router.patch('/generic/:id', async (req, res) => {
  try {
    const allowed = [
      'name','category','calories_per_100g','protein_per_100g','carbs_per_100g','fat_per_100g',
      'fiber_per_100g','sugars_per_100g','saturated_fat_per_100g','salt_per_100g',
      'serving_unit','serving_weight_g','is_ready_to_eat','status',
    ];
    const fields = [];
    const vals = [];
    for (const [k, v] of Object.entries(req.body)) {
      if (allowed.includes(k)) { fields.push(`\`${k}\` = ?`); vals.push(v); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Brak pól' });
    vals.push(req.params.id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ? AND is_generic = 1`, vals);
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PARAMETRIC ROUTES ─────────────────────────────────────────────────────────

// GET /api/products/:id — szczegóły produktu
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    const [stores] = await db.query(
      'SELECT store_id FROM product_stores WHERE product_id = ?', [req.params.id]
    );
    res.json({ ...rows[0], store_ids: stores.map(s => s.store_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — dodaj produkt
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, category, calories_per_100g, protein_per_100g,
      carbs_per_100g, fat_per_100g, vitamins,
      serving_unit, serving_weight_g, store_ids = []
    } = req.body;

    const [result] = await conn.query(
      `INSERT INTO products
       (name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, vitamins, serving_unit, serving_weight_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
       vitamins ? JSON.stringify(vitamins) : null, serving_unit || 'g', serving_weight_g || null]
    );

    const productId = result.insertId;
    if (store_ids.length > 0) {
      const values = store_ids.map(sid => [productId, sid]);
      await conn.query('INSERT INTO product_stores (product_id, store_id) VALUES ?', [values]);
    }

    await conn.commit();
    res.status(201).json({ id: productId, ...req.body });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/products/:id — edytuj produkt
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, category, calories_per_100g, protein_per_100g,
      carbs_per_100g, fat_per_100g, vitamins,
      serving_unit, serving_weight_g, store_ids = []
    } = req.body;

    await conn.query(
      `UPDATE products SET
       name=?, category=?, calories_per_100g=?, protein_per_100g=?,
       carbs_per_100g=?, fat_per_100g=?, vitamins=?, serving_unit=?, serving_weight_g=?
       WHERE id=?`,
      [name, category, calories_per_100g, protein_per_100g, carbs_per_100g,
       fat_per_100g, vitamins ? JSON.stringify(vitamins) : null,
       serving_unit, serving_weight_g, req.params.id]
    );

    await conn.query('DELETE FROM product_stores WHERE product_id = ?', [req.params.id]);
    if (store_ids.length > 0) {
      const values = store_ids.map(sid => [req.params.id, sid]);
      await conn.query('INSERT INTO product_stores (product_id, store_id) VALUES ?', [values]);
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

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id/quick-update — szybka aktualizacja statusu i gotowości
router.patch('/:id/quick-update', async (req, res) => {
  try {
    const { status, is_ready_to_eat } = req.body;
    const allowed_statuses = ['active', 'inactive_incomplete', 'inactive_deleted'];

    if (status && !allowed_statuses.includes(status)) {
      return res.status(400).json({ error: 'Nieprawidłowy status' });
    }

    const fields = [];
    const values = [];
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (is_ready_to_eat !== undefined) { fields.push('is_ready_to_eat = ?'); values.push(is_ready_to_eat); }
    if (!fields.length) return res.status(400).json({ error: 'Brak pól do aktualizacji' });

    values.push(req.params.id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await db.query('SELECT id, name, status, is_ready_to_eat FROM products WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
