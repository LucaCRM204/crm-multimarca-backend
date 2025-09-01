// routes/leads.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM leads ORDER BY created_at DESC LIMIT 1000');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { nombre, telefono, modelo, fuente, formaPago, notas, estado='nuevo', vendedor=null } = req.body;
  const [r] = await pool.query(
    'INSERT INTO leads (nombre,telefono,modelo,fuente,formaPago,notas,estado,assigned_to) VALUES (?,?,?,?,?,?,?,?)',
    [nombre, telefono, modelo, fuente, formaPago, notas || '', estado, vendedor]
  );
  const [row] = await pool.query('SELECT * FROM leads WHERE id=?', [r.insertId]);
  res.status(201).json(row[0]);
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const payload = req.body;
  const set = Object.keys(payload).map(k => `${k}=?`);
  const vals = Object.keys(payload).map(k => payload[k]);
  vals.push(id);
  await pool.query(`UPDATE leads SET ${set.join(',')} WHERE id=?`, vals);
  const [row] = await pool.query('SELECT * FROM leads WHERE id=?', [id]);
  res.json(row[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM leads WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
const intakeAuth = require('../middleware/intakeAuth');

router.post('/intake', intakeAuth, async (req,res)=>{
  try{
    const b = req.body || {};
    const nombre    = (b.nombre && String(b.nombre).trim()) || 'Sin nombre';
    const telefono  = (b.telefono && String(b.telefono).trim()) || '';
    const modelo    = (b.modelo && String(b.modelo).trim()) || '';
    const fuente    = (b.fuente && String(b.fuente).trim()) || 'zapier';
    const formaPago = (b.formaPago && String(b.formaPago).trim()) || '';
    const notas     = (b.notas && String(b.notas).trim()) || '';
    const estado    = (b.estado && String(b.estado).trim()) || 'nuevo';
    const assigned  = b.vendedor ?? null;

    await pool.query(
      `INSERT INTO leads (nombre, telefono, modelo, fuente, formaPago, notas, estado, assigned_to)
       VALUES (?,?,?,?,?,?,?,?)`,
      [nombre, telefono, modelo, fuente, formaPago, notas, estado, assigned]
    );

    res.json({ ok:true, provider: req.provider });
  }catch(e){
    console.error('[INTAKE ERROR]', e);
    res.status(500).json({ error: 'Intake failed' });
  }
});
