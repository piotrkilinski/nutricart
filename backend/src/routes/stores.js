const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stores - lista wszystkich sklepow
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM stores ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores - dodaj sklep
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa sklepu jest wymagana' });
    const [result] = await db.query('INSERT INTO stores (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stores/:id - edytuj sklep
router.put('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    await db.query('UPDATE stores SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ id: req.params.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stores/:id - usun sklep
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM stores WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
