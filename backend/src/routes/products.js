const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products - lista produktow (z info o sklepach)
router.get('/', async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT p.*, GROUP_CONCAT(ps.store_id) as store_ids
      FROM products p
      LEFT JOIN product_stores ps ON p.id = ps.product_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    const result = products.map(p => ({
      ...p,
      store_ids: p.store_ids ? p.store_ids.split(',').map(Number) : []
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id - szczegoly produktu
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

// POST /api/products - dodaj produkt
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

// PUT /api/products/:id - edytuj produkt
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

module.exports = router;
