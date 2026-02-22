const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stores — lista sklepów (domyślnie tylko aktywne, ?all=1 dla wszystkich)
router.get('/', async (req, res) => {
  try {
    const where = req.query.all ? '' : "WHERE status = 'active'";
    const [rows] = await db.query(`SELECT * FROM stores ${where} ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores — dodaj sklep
router.post('/', async (req, res) => {
  try {
    const { name, status = 'active' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nazwa sklepu jest wymagana' });
    const [result] = await db.query(
      'INSERT INTO stores (name, status) VALUES (?, ?)',
      [name.trim(), status]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stores/:id — zmień nazwę lub status
router.patch('/:id', async (req, res) => {
  try {
    const { name, status } = req.body;
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
    if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
    if (!fields.length) return res.status(400).json({ error: 'Brak pól do aktualizacji' });
    vals.push(req.params.id);
    await db.query(`UPDATE stores SET ${fields.join(', ')} WHERE id = ?`, vals);
    const [rows] = await db.query('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stores/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM stores WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
