const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getAssignedVendorByBrand, getRoundRobinStatus, resetRoundRobinIndex } = require('../utils/assign');

// Utilidad para mapear assigned_to -> vendedor
const mapLead = (row) => ({
  ...row,
  vendedor: row.assigned_to ?? null,
});

// GET todos los leads
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM leads ORDER BY created_at DESC');
    const leads = rows.map(mapLead);
    res.json({ ok: true, leads });
  } catch (error) {
    console.error('Error GET /leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// GET un lead
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    res.json({ ok: true, lead: mapLead(rows[0]) });
  } catch (error) {
    console.error('Error GET /leads/:id:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

// 📊 VER ESTADO DEL ROUND-ROBIN
router.get('/round-robin/status', authenticateToken, async (req, res) => {
  try {
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const status = await getRoundRobinStatus();
    
    res.json({ ok: true, ...status });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener estado' });
  }
});

// 🔄 RESETEAR ÍNDICE (solo owner)
router.post('/round-robin/reset', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede resetear' });
    }

    resetRoundRobinIndex();

    res.json({ ok: true, message: 'Índice round-robin reseteado a 0' });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al resetear' });
  }
});

// 📈 VER DISTRIBUCIÓN COMPLETA
router.get('/distribution', authenticateToken, async (req, res) => {
  try {
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const [distribution] = await pool.execute(`
      SELECT 
        u.id,
        u.name as nombre,
        u.active,
        COUNT(l.id) as total_leads,
        SUM(CASE WHEN l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as leads_30d,
        SUM(CASE WHEN l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as leads_7d,
        SUM(CASE WHEN l.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as leads_hoy,
        MAX(l.created_at) as ultimo_lead
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id
      WHERE u.role = 'vendedor'
      GROUP BY u.id, u.name, u.active
      ORDER BY u.active DESC, total_leads DESC
    `);

    res.json({ ok: true, distribution });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener distribución' });
  }
});

// POST crear lead (desde el CRM)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      modelo,
      marca = 'vw',
      formaPago = 'Contado',
      infoUsado = '',
      entrega = false,
      fecha = new Date().toISOString().split('T')[0],
      estado = 'nuevo',
      fuente = 'otro',
      notas = '',
      vendedor = null,
      equipo = 'roberto'
    } = req.body;

    // Validar marca
    if (!['vw', 'fiat', 'peugeot', 'renault'].includes(marca)) {
      return res.status(400).json({ error: 'Marca inválida. Debe ser vw, fiat, peugeot o renault' });
    }

    // Asignación automática si no viene vendedor específico
    let assigned_to = vendedor;
    if (!assigned_to) {
      assigned_to = await getAssignedVendorByBrand(marca);
      console.log(`🎯 Lead auto-asignado por round-robin al vendedor ${assigned_to}`);
    } else {
      console.log(`✅ Lead asignado manualmente al vendedor ${assigned_to}`);
    }

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, created_at, created_by, equipo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, req.user.id, equipo]
    );

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.json({ ok: true, lead: mapLead(rows[0]) });
  } catch (error) {
    console.error('❌ Error POST /leads:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// PUT actualizar lead (incluye reasignación)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'nombre', 'telefono', 'modelo', 'marca', 'formaPago', 'estado',
      'fuente', 'notas', 'assigned_to', 'vendedor', 'infoUsado', 'entrega', 'fecha'
    ];

    // Si viene 'vendedor', chequear permisos de rol
    if (Object.prototype.hasOwnProperty.call(updates, 'vendedor')) {
      const me = req.user;
      if (!['owner','director','gerente','supervisor'].includes(me.role)) {
        return res.status(403).json({ error: 'No autorizado para reasignar leads' });
      }
    }

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) continue;

      // Validar marca si se actualiza
      if (key === 'marca' && !['vw', 'fiat', 'peugeot', 'renault'].includes(value)) {
        return res.status(400).json({ error: 'Marca inválida' });
      }

      const fieldName = key === 'vendedor' ? 'assigned_to' : key;
      setClause.push(`${fieldName} = ?`);
      values.push(value === undefined ? null : value);
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id);

    await pool.execute(
      `UPDATE leads SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    res.json({ ok: true, lead: mapLead(rows[0]) });
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