// routes/users.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

// Listar usuarios
router.get('/', async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, reportsTo, active, created_at, updated_at FROM users ORDER BY id ASC'
  );
  res.json(rows);
});

// Crear usuario
router.post('/', async (req, res) => {
  const { name, email, password = '123456', role = 'vendedor', reportsTo = null, active = 1 } = req.body;
  const [r] = await pool.query(
    'INSERT INTO users (name,email,password,role,reportsTo,active) VALUES (?,?,?,?,?,?)',
    [name, email, password, role, reportsTo, active ? 1 : 0]
  );
  const [row] = await pool.query('SELECT id, name, email, role, reportsTo, active FROM users WHERE id=?', [r.insertId]);
  res.status(201).json(row[0]);
});

// Actualizar usuario
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const fields = ['name','email','password','role','reportsTo','active'];
  const set = [];
  const vals = [];
  for (const f of fields) if (f in req.body) { set.push(`${f}=?`); vals.push(req.body[f]); }
  if (!set.length) return res.status(400).json({ error: 'Nada para actualizar' });
  vals.push(id);
  await pool.query(`UPDATE users SET ${set.join(',')} WHERE id=?`, vals);
  const [row] = await pool.query('SELECT id, name, email, role, reportsTo, active FROM users WHERE id=?', [id]);
  res.json(row[0]);
});

// Eliminar usuario (soft o hard; acá hard)
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
