const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware JWT que lee cookies Y headers (igual que requireAuth en auth.js)
const jwtAuth = (req, res, next) => {
  try {
    // Buscar token en cookie O en header Authorization
    const token = req.cookies?.session || (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token requerido' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Tendrá uid, role, id, email
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido' });
  }
};

// GET /leads - Obtener todos los leads
router.get('/', jwtAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM leads ORDER BY created_at DESC'
    );
    res.json({ ok: true, leads: rows });
  } catch (err) {
    console.error('Error GET /leads:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /leads/:id - Obtener un lead específico
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    }
    
    res.json({ ok: true, lead: rows[0] });
  } catch (err) {
    console.error('Error GET /leads/:id:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /leads - Crear nuevo lead
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { nombre, telefono, modelo, fuente, formaPago } = req.body;
    
    // Validar campos requeridos
    if (!nombre || !telefono) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Nombre y teléfono son requeridos' 
      });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, fuente, formaPago, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono, modelo, fuente, formaPago]
    );
    
    // Obtener el lead creado
    const [newLead] = await pool.execute(
      'SELECT * FROM leads WHERE id = ?', 
      [result.insertId]
    );
    
    res.status(201).json({ ok: true, lead: newLead[0] });
  } catch (err) {
    console.error('Error POST /leads:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /leads/:id - Actualizar lead
router.put('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, modelo, fuente, formaPago, estado, vendedor } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE leads 
       SET nombre = COALESCE(?, nombre), 
           telefono = COALESCE(?, telefono), 
           modelo = COALESCE(?, modelo), 
           fuente = COALESCE(?, fuente), 
           formaPago = COALESCE(?, formaPago),
           estado = COALESCE(?, estado),
           assigned_to = COALESCE(?, assigned_to),
           updated_at = NOW()
       WHERE id = ?`,
      [nombre, telefono, modelo, fuente, formaPago, estado, vendedor, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    }
    
    // Obtener el lead actualizado
    const [updatedLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    res.json({ ok: true, lead: updatedLead[0] });
  } catch (err) {
    console.error('Error PUT /leads/:id:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /leads/:id - Eliminar lead
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM leads WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    }
    
    res.json({ ok: true, message: 'Lead eliminado correctamente' });
  } catch (err) {
    console.error('Error DELETE /leads/:id:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;