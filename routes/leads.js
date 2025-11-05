const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getAssignedVendorByBrand, getRoundRobinStatus, resetRoundRobinIndex } = require('../utils/assign');

// Utilidad para mapear assigned_to -> vendedor
const mapLead = (row) => ({
  ...row,
  vendedor: row.assigned_to ?? null,
});

// 🔐 HELPER: Validar si el usuario puede asignar a un vendedor específico
const canAssignToVendor = async (userId, userRole, targetVendorId) => {
  // Owner y Director pueden asignar a cualquiera
  if (['owner', 'dueño', 'director'].includes(userRole)) {
    return true;
  }

  // Si intenta asignarse a sí mismo, siempre puede
  if (userId === targetVendorId) {
    return true;
  }

  // Obtener información del vendedor objetivo
  const [targetUser] = await pool.execute(
    'SELECT id, role, reportsTo FROM users WHERE id = ?',
    [targetVendorId]
  );

  if (targetUser.length === 0) {
    return false;
  }

  const target = targetUser[0];

  // Gerente puede asignar a su equipo (supervisores y vendedores bajo él)
  if (userRole === 'gerente') {
    // Verificar si reporta directamente al gerente
    if (target.reportsTo === userId) {
      return true;
    }
    
    // Verificar si reporta a un supervisor que reporta al gerente
    if (target.reportsTo) {
      const [supervisor] = await pool.execute(
        'SELECT reportsTo FROM users WHERE id = ?',
        [target.reportsTo]
      );
      if (supervisor.length > 0 && supervisor[0].reportsTo === userId) {
        return true;
      }
    }
    
    return false;
  }

  // Supervisor solo puede asignar a vendedores que reportan directamente a él
  if (userRole === 'supervisor') {
    return target.reportsTo === userId;
  }

  // Vendedor solo puede asignarse a sí mismo (ya verificado arriba)
  return false;
};

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

// ðŸ"ˆ VER DISTRIBUCIÃ"N COMPLETA
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
    res.status(500).json({ error: 'Error al obtener distribuciÃ³n' });
  }
});

// 🆕 VER LEADS SIN ASIGNAR (sin marca o sin vendedor)
router.get('/unassigned', authenticateToken, async (req, res) => {
  try {
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const [rows] = await pool.execute(`
      SELECT * FROM leads 
      WHERE marca IS NULL OR assigned_to IS NULL
      ORDER BY created_at DESC
    `);
    
    const leads = rows.map(mapLead);
    
    res.json({ 
      ok: true, 
      leads,
      count: leads.length,
      message: `${leads.length} leads sin asignar encontrados`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener leads sin asignar' });
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
      vendedor = null
    } = req.body;

    // 🔴 VALIDAR CAMPOS REQUERIDOS
    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltantes',
        details: { 
          nombre: !nombre ? 'requerido' : 'ok', 
          telefono: !telefono ? 'requerido' : 'ok' 
        }
      });
    }

    // Validar marca
    if (!['vw', 'fiat', 'peugeot', 'renault'].includes(marca)) {
      return res.status(400).json({ error: 'Marca inválida. Debe ser vw, fiat, peugeot o renault' });
    }

    // 🔐 ASIGNACIÓN CON VALIDACIÓN DE PERMISOS
    let assigned_to = vendedor;

    if (assigned_to) {
      // Si se especifica un vendedor, validar permisos
      const hasPermission = await canAssignToVendor(req.user.id, req.user.role, assigned_to);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'No tienes permisos para asignar leads a este vendedor',
          details: 'Solo puedes crear leads para ti mismo o para tu equipo directo'
        });
      }
      
      console.log(`✅ Lead asignado manualmente al vendedor ${assigned_to} (validado)`);
      
    } else {
      // Asignación automática según el rol
      if (req.user.role === 'vendedor') {
        // Los vendedores se auto-asignan
        assigned_to = req.user.id;
        console.log(`🎯 Lead auto-asignado al vendedor ${assigned_to} (creador)`);
        
      } else if (['supervisor', 'gerente'].includes(req.user.role)) {
        // Supervisores y Gerentes: asignar por round-robin dentro de su equipo
        try {
          assigned_to = await getAssignedVendorByBrand(marca);
          
          // Validar que el vendedor asignado pertenece a su equipo
          const hasPermission = await canAssignToVendor(req.user.id, req.user.role, assigned_to);
          if (!hasPermission) {
            // Si el round-robin asignó a alguien fuera del equipo, asignar al creador
            assigned_to = req.user.id;
            console.log(`⚠️ Round-robin asignó fuera del equipo, reasignando al creador ${assigned_to}`);
          } else {
            console.log(`🎯 Lead auto-asignado por round-robin al vendedor ${assigned_to}`);
          }
        } catch (assignError) {
          console.error('❌ Error en asignación automática:', assignError);
          // Fallback: asignar al creador
          assigned_to = req.user.id;
        }
        
      } else {
        // Owner y Director: usar round-robin normal
        try {
          assigned_to = await getAssignedVendorByBrand(marca);
          console.log(`🎯 Lead auto-asignado por round-robin al vendedor ${assigned_to}`);
        } catch (assignError) {
          console.error('❌ Error en asignación automática:', assignError);
          return res.status(500).json({ 
            error: 'Error al asignar vendedor automáticamente',
            details: assignError.message 
          });
        }
      }
    }

    // 🔴 LOGS DETALLADOS PARA DEBUG
    console.log('📝 Creando lead con datos:', {
      nombre, telefono, modelo, marca, formaPago, estado, 
      fuente, assigned_to, created_by: req.user.id, 
      creator_role: req.user.role
    });

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, created_at, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, req.user.id]
    );

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    
    console.log('✅ Lead creado exitosamente, ID:', result.insertId);
    
    res.json({ ok: true, lead: mapLead(rows[0]) });
  } catch (error) {
    console.error('❌ Error POST /leads:', error);
    console.error('❌ Body recibido:', req.body);
    console.error('❌ Usuario:', req.user);
    
    res.status(500).json({ 
      error: 'Error al crear lead',
      message: error.message,
      sqlMessage: error.sqlMessage || null,
      code: error.code || null
    });
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

    // 🔥 NUEVO: Si se está asignando marca y NO viene vendedor, asignar automáticamente
    if (updates.marca && !updates.vendedor && !updates.assigned_to) {
      try {
        const autoVendor = await getAssignedVendorByBrand(updates.marca);
        if (autoVendor) {
          updates.assigned_to = autoVendor;
          console.log(`🎯 Lead ${id}: marca ${updates.marca} asignada, vendedor auto-asignado: ${autoVendor}`);
        }
      } catch (error) {
        console.error('⚠️ Error en auto-asignación:', error);
        // Continuar sin asignar vendedor
      }
    }

    // Si viene 'vendedor' o 'assigned_to', validar permisos jerárquicos
    if (Object.prototype.hasOwnProperty.call(updates, 'vendedor') || 
        Object.prototype.hasOwnProperty.call(updates, 'assigned_to')) {
      
      const newVendorId = updates.vendedor || updates.assigned_to;
      
      if (newVendorId !== null && newVendorId !== undefined) {
        const hasPermission = await canAssignToVendor(req.user.id, req.user.role, newVendorId);
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'No tienes permisos para asignar leads a este vendedor',
            details: 'Solo puedes asignar leads a ti mismo o a tu equipo directo'
          });
        }
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