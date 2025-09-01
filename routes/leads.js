const router = require('express').Router();
const pool = require('../db');
const { jwtAuth } = require('../middleware/auth');

// GET todos los leads
router.get('/', jwtAuth, async (req, res) => {
  try {
    const [leads] = await pool.execute('SELECT * FROM leads ORDER BY created_at DESC');
    res.json({ ok: true, leads });
  } catch (error) {
    console.error('Error GET /leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// GET un lead
router.get('/:id', jwtAuth, async (req, res) => {
  try {
    const [leads] = await pool.execute('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    res.json({ ok: true, lead: leads[0] });
  } catch (error) {
    console.error('Error GET /leads/:id:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

// POST crear lead
router.post('/', jwtAuth, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      modelo,
      formaPago = 'Contado',
      infoUsado = '',
      entrega = false,
      fecha = new Date().toISOString().split('T')[0],
      estado = 'nuevo',
      fuente = 'otro',
      notas = '',
      vendedor = null
    } = req.body;

    // Asignaci?n autom?tica si no hay vendedor
    let assigned_to = vendedor;
    if (!assigned_to) {
      const [vendedores] = await pool.execute(
        'SELECT id FROM users WHERE role = ? AND active = 1',
        ['vendedor']
      );
      if (vendedores.length > 0) {
        // Round-robin simple
        const randomIndex = Math.floor(Math.random() * vendedores.length);
        assigned_to = vendedores[randomIndex].id;
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, infoUsado, entrega, fecha, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono, modelo, formaPago, infoUsado, entrega ? 1 : 0, fecha, estado, fuente, notas, assigned_to]
    );

    const [newLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.json({ ok: true, lead: newLead[0] });
  } catch (error) {
    console.error('Error POST /leads:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// PUT actualizar lead
router.put('/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Campos permitidos para actualizar
    const allowedFields = ['nombre', 'telefono', 'modelo', 'formaPago', 'infoUsado', 
                          'entrega', 'fecha', 'estado', 'fuente', 'notas', 'assigned_to', 'vendedor'];
    
    const setClause = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      // Mapear vendedor a assigned_to
      const fieldName = key === 'vendedor' ? 'assigned_to' : key;
      
      if (allowedFields.includes(key)) {
        setClause.push(`${fieldName} = ?`);
        // Convertir undefined a null para SQL
        values.push(value === undefined ? null : value);
      }
    }
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    
    values.push(id);
    
    await pool.execute(
      `UPDATE leads SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updated] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    res.json({ ok: true, lead: updated[0] });
  } catch (error) {
    console.error('Error PUT /leads/:id:', error);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

// DELETE eliminar lead
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error DELETE /leads/:id:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

module.exports = router;
