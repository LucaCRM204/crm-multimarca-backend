/**
 * ============================================
 * ROUTES/LEADS.JS - CON ESTADOS PROTEGIDOS
 * ============================================
 * CAMBIOS:
 * - Estados protegidos: rechazado_supervisor, rechazado_scoring
 * - Nadie puede cambiar manualmente A estos estados
 * - Nadie puede cambiar DESDE estos estados (excepto owner)
 * - Nuevo endpoint /reactivar solo para owner
 */

const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getAssignedVendorByBrand, getRoundRobinStatus, resetRoundRobinIndex } = require('../utils/assign');

// ============================================
// ESTADOS PROTEGIDOS
// ============================================
const ESTADOS_PROTEGIDOS = ['rechazado_supervisor', 'rechazado_scoring'];

/**
 * Valida si un cambio de estado de lead es permitido
 */
function validarCambioEstadoLead(estadoActual, nuevoEstado, role, esAutomatico = false) {
  // Si el estado actual es protegido, solo owner puede cambiarlo
  if (ESTADOS_PROTEGIDOS.includes(estadoActual)) {
    if (role !== 'owner') {
      return {
        permitido: false,
        error: `El estado "${estadoActual}" es final y solo puede ser modificado por el Owner del sistema.`
      };
    }
  }
  
  // Nadie puede cambiar manualmente A un estado protegido
  if (ESTADOS_PROTEGIDOS.includes(nuevoEstado) && !esAutomatico) {
    return {
      permitido: false,
      error: `No se puede cambiar manualmente a "${nuevoEstado}". Este estado solo se asigna automáticamente cuando se rechaza en scoring.`
    };
  }
  
  return { permitido: true };
}

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
      vendedor = null,
      assigned_to = null
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

    // ============================================
    // VALIDAR ESTADO PROTEGIDO EN CREACIÓN
    // ============================================
    if (ESTADOS_PROTEGIDOS.includes(estado)) {
      return res.status(400).json({ 
        error: `No se puede crear un lead con estado "${estado}". Este estado solo se asigna automáticamente.`
      });
    }

    // 🔐 ASIGNACIÓN CON VALIDACIÓN DE PERMISOS
    let finalAssignedTo = assigned_to || vendedor;

    if (finalAssignedTo) {
      const isFromBot = fuente && (fuente.includes('whatsapp') || fuente.includes('bot'));
      
      if (!isFromBot) {
        const hasPermission = await canAssignToVendor(req.user.id, req.user.role, finalAssignedTo);
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'No tienes permisos para asignar leads a este vendedor',
            details: 'Solo puedes crear leads para ti mismo o para tu equipo directo'
          });
        }
      }
      
      console.log(`✅ Lead asignado a vendedor ${finalAssignedTo} ${isFromBot ? '(BOT)' : '(manual validado)'}`);
      
    } else {
      if (req.user.role === 'vendedor') {
        finalAssignedTo = req.user.id;
        console.log(`🎯 Lead auto-asignado al vendedor ${finalAssignedTo} (creador)`);
        
      } else if (['supervisor', 'gerente'].includes(req.user.role)) {
        try {
          finalAssignedTo = await getAssignedVendorByBrand(marca);
          
          const hasPermission = await canAssignToVendor(req.user.id, req.user.role, finalAssignedTo);
          if (!hasPermission) {
            finalAssignedTo = req.user.id;
            console.log(`⚠️ Round-robin asignó fuera del equipo, reasignando al creador ${finalAssignedTo}`);
          } else {
            console.log(`🎯 Lead auto-asignado por round-robin al vendedor ${finalAssignedTo}`);
          }
        } catch (assignError) {
          console.error('❌ Error en asignación automática:', assignError);
          finalAssignedTo = req.user.id;
        }
        
      } else {
        try {
          finalAssignedTo = await getAssignedVendorByBrand(marca);
          console.log(`🎯 Lead auto-asignado por round-robin al vendedor ${finalAssignedTo}`);
        } catch (assignError) {
          console.error('❌ Error en asignación automática:', assignError);
          return res.status(500).json({ 
            error: 'Error al asignar vendedor automáticamente',
            details: assignError.message 
          });
        }
      }
    }

    console.log('📝 Creando lead con datos:', {
      nombre, telefono, modelo, marca, formaPago, estado, 
      fuente, assigned_to: finalAssignedTo, created_by: req.user.id, 
      creator_role: req.user.role,
      from_bot: fuente && (fuente.includes('whatsapp') || fuente.includes('bot'))
    });

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, infoUsado, entrega, fecha, created_at, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, finalAssignedTo, infoUsado, entrega, fecha, req.user.id]
    );

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    
    console.log('✅ Lead creado exitosamente, ID:', result.insertId, 'Asignado a:', finalAssignedTo);
    
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

// PUT actualizar lead (incluye reasignación) - CON VALIDACIÓN DE ESTADOS PROTEGIDOS
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // ============================================
    // OBTENER LEAD ACTUAL PARA VALIDAR ESTADO
    // ============================================
    const [currentLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (currentLead.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const leadActual = currentLead[0];

    // ============================================
    // VALIDAR CAMBIO DE ESTADO PROTEGIDO
    // ============================================
    if (updates.estado && updates.estado !== leadActual.estado) {
      const validacion = validarCambioEstadoLead(
        leadActual.estado, 
        updates.estado, 
        req.user.role,
        false // No es automático, es cambio manual
      );
      
      if (!validacion.permitido) {
        return res.status(403).json({ error: validacion.error });
      }
    }

    // Si el lead está en estado protegido y se intenta cambiar cualquier cosa (no solo estado)
    // Solo el owner puede modificarlo
    if (ESTADOS_PROTEGIDOS.includes(leadActual.estado) && req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: `Este lead está en estado "${leadActual.estado}" y no puede ser modificado. Solo el Owner puede cambiarlo.`
      });
    }

    const allowedFields = [
      'nombre', 'telefono', 'modelo', 'marca', 'formaPago', 'estado',
      'fuente', 'notas', 'assigned_to', 'vendedor', 'infoUsado', 'entrega', 'fecha'
    ];

    // 🔥 Si se está asignando marca y NO viene vendedor, asignar automáticamente
    if (updates.marca && !updates.vendedor && !updates.assigned_to) {
      try {
        const autoVendor = await getAssignedVendorByBrand(updates.marca);
        if (autoVendor) {
          updates.assigned_to = autoVendor;
          console.log(`🎯 Lead ${id}: marca ${updates.marca} asignada, vendedor auto-asignado: ${autoVendor}`);
        }
      } catch (error) {
        console.error('⚠️ Error en auto-asignación:', error);
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

// ============================================
// 🔓 REACTIVAR LEAD (Solo Owner)
// ============================================
router.post('/:id/reactivar', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const { nuevo_estado, motivo } = req.body;
  
  // Solo owner puede reactivar
  if (role !== 'owner') {
    return res.status(403).json({ 
      error: 'Solo el Owner puede reactivar leads rechazados' 
    });
  }
  
  try {
    const [leads] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const lead = leads[0];
    
    // Verificar que está en estado protegido
    if (!ESTADOS_PROTEGIDOS.includes(lead.estado)) {
      return res.status(400).json({ 
        error: 'Este lead no está en estado rechazado' 
      });
    }
    
    if (!nuevo_estado) {
      return res.status(400).json({ 
        error: 'Debe especificar el nuevo estado para el lead' 
      });
    }
    
    // No permitir reactivar a otro estado protegido
    if (ESTADOS_PROTEGIDOS.includes(nuevo_estado)) {
      return res.status(400).json({ 
        error: 'No se puede reactivar a un estado de rechazo' 
      });
    }
    
    const timestamp = new Date().toISOString();
    const notaReactivacion = `\n[${timestamp}] REACTIVADO por Owner desde "${lead.estado}": ${motivo || 'Sin motivo especificado'}`;
    
    await pool.execute(`
      UPDATE leads 
      SET estado = ?,
          notas = CONCAT(IFNULL(notas, ''), ?),
          updated_at = NOW()
      WHERE id = ?
    `, [nuevo_estado, notaReactivacion, id]);
    
    const [leadActualizado] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    console.log(`🔓 Lead ${id} reactivado por Owner: ${lead.estado} → ${nuevo_estado}`);
    
    res.json({ 
      ok: true, 
      mensaje: `Lead reactivado correctamente a estado "${nuevo_estado}"`,
      lead: mapLead(leadActualizado[0])
    });
    
  } catch (error) {
    console.error('Error al reactivar lead:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE eliminar lead
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // ============================================
    // VALIDAR QUE NO SEA ESTADO PROTEGIDO (excepto owner)
    // ============================================
    const [currentLead] = await pool.execute('SELECT estado FROM leads WHERE id = ?', [req.params.id]);
    
    if (currentLead.length > 0 && ESTADOS_PROTEGIDOS.includes(currentLead[0].estado)) {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ 
          error: `No se puede eliminar un lead en estado "${currentLead[0].estado}". Solo el Owner puede hacerlo.`
        });
      }
    }
    
    await pool.execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error DELETE /leads/:id:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

module.exports = router;