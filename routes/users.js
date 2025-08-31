const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /users  → lista usuarios
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, reportsTo, active, created_at, updated_at FROM users ORDER BY id ASC'
    );
    res.json(rows);
  } catch (e) {
    console.error('[USERS LIST]', e);
    res.status(500).json({ error: 'Users list failed' });
  }
});

// POST /users  → crear usuario
router.post('/', async (req, res) => {
  try {
    const { name, email, password = '123456', role = 'vendedor', reportsTo = null, active = 1 } = req.body || {};
    const [r] = await pool.query(
      'INSERT INTO users (name,email,password,role,reportsTo,active) VALUES (?,?,?,?,?,?)',
      [name, email, password, role, reportsTo, active ? 1 : 0]
    );
    const [row] = await pool.query('SELECT id, name, email, role, reportsTo, active FROM users WHERE id=?', [r.insertId]);
    res.status(201).json(row[0]);
  } catch (e) {
    console.error('[USERS CREATE]', e);
    res.status(500).json({ error: 'User create failed' });
  }
});

// PUT /users/:id  → actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const fields = ['name','email','password','role','reportsTo','active'];
    const sets = [];
    const vals = [];
    for (const f of fields) if (f in req.body) { sets.push(`${f}=?`); vals.push(req.body[f]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(id);
    await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals);
    const [row] = await pool.query('SELECT id, name, email, role, reportsTo, active FROM users WHERE id=?', [id]);
    res.json(row[0]);
  } catch (e) {
    console.error('[USERS UPDATE]', e);
    res.status(500).json({ error: 'User update failed' });
  }
});

// DELETE /users/:id  → eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[USERS DELETE]', e);
    res.status(500).json({ error: 'User delete failed' });
  }
});

module.exports = router;
