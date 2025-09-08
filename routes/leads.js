const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET todos los leads
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = 'SELECT * FROM leads ORDER BY created_at DESC';
    const [leads] = await pool.execute(query);
    res.json({ ok: true, leads });
  } catch (error) {
    console.error('Error GET /leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// GET un lead
router.get('/:id', authenticateToken, async (req, res) => {
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
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      modelo,
      marca = 'vw', // NUEVO CAMPO
      formaPago = 'Contado',
      infoUsado = '',
      entrega = false,
      fecha = new Date().toISOString().split('T')[0],
      estado = 'nuevo',
      fuente = 'otro',
      notas = '',
      vendedor = null
    } = req.body;

    // Validar marca
    if (!['vw', 'fiat', 'peugeot', 'renault'].includes(marca)) {
      return res.status(400).json({ error: 'Marca inválida. Debe ser vw, fiat, peugeot o renault' });
    }

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, vendedor, infoUsado, entrega, fecha]
    );

    const [newLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.json({ ok: true, lead: newLead[0] });
  } catch (error) {
    console.error('Error POST /leads:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// PUT actualizar lead
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = ['nombre', 'telefono', 'modelo', 'marca', 'formaPago', 'estado', 'fuente', 'notas', 'assigned_to', 'vendedor', 'infoUsado', 'entrega', 'fecha'];
    
    const setClause = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const fieldName = key === 'vendedor' ? 'assigned_to' : key;
      
      if (allowedFields.includes(key)) {
        // Validar marca si se está actualizando
        if (key === 'marca' && !['vw', 'fiat', 'peugeot', 'renault'].includes(value)) {
          return res.status(400).json({ error: 'Marca inválida' });
        }
        
        setClause.push(`${fieldName} = ?`);
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
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error DELETE /leads/:id:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

module.exports = router;