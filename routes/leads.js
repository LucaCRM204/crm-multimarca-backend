/**
 * ============================================
 * ROUTES/LEADS.JS - CON SISTEMA DE ACEPTACIÓN
 * ============================================
 * FEATURES:
 * - Estados protegidos (rechazado_supervisor, rechazado_scoring)
 * - Sistema de aceptación con timeout de 10 min
 * - Solo en horario laboral (9:30 - 19:30)
 * - NUEVO: Protección contra reasignación de leads con venta activa
 */

const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getAssignedVendorByBrand, getRoundRobinStatus, resetRoundRobinIndex } = require('../utils/assign');

// Importar funciones del socket server
let socketFunctions = null;
try {
  socketFunctions = require('../socket-server');
} catch (e) {
  console.log('Socket server not loaded yet');
}

// ============================================
// ESTADOS PROTEGIDOS
// ============================================
const ESTADOS_PROTEGIDOS = ['rechazado_supervisor', 'rechazado_scoring'];

// ============================================
// ESTADOS DE VENTA QUE BLOQUEAN REASIGNACIÓN
// ============================================
const ESTADOS_VENTA_ACTIVOS = [
  'pendiente_supervisor',
  'ingresada',
  'asignada',
  'en_proceso',
  'observada',
  'pendiente_pago',
  'seña'
];

function validarCambioEstadoLead(estadoActual, nuevoEstado, role, esAutomatico = false) {
  if (ESTADOS_PROTEGIDOS.includes(estadoActual)) {
    if (role !== 'owner') {
      return {
        permitido: false,
        error: `El estado "${estadoActual}" es final y solo puede ser modificado por el Owner del sistema.`
      };
    }
  }
  
  if (ESTADOS_PROTEGIDOS.includes(nuevoEstado) && !esAutomatico) {
    return {
      permitido: false,
      error: `No se puede cambiar manualmente a "${nuevoEstado}". Este estado solo se asigna automáticamente.`
    };
  }
  
  return { permitido: true };
}

// ============================================
// HELPER: Verificar si lead tiene venta activa
// ============================================
async function tieneVentaActiva(leadId) {
  try {
    const [ventas] = await pool.execute(`
      SELECT id, estado, vendedor_id 
      FROM ventas_scoring 
      WHERE lead_id = ? AND estado IN (?, ?, ?, ?, ?, ?, ?)
      LIMIT 1
    `, [leadId, ...ESTADOS_VENTA_ACTIVOS]);
    
    if (ventas.length > 0) {
      return {
        tiene: true,
        venta: ventas[0]
      };
    }
    return { tiene: false };
  } catch (error) {
    console.error('Error verificando venta activa:', error.message);
    return { tiene: false };
  }
}

// Utilidad para mapear
const mapLead = (row) => ({
  ...row,
  vendedor: row.assigned_to ?? null,
});

// Helper: Validar permisos de asignación
const canAssignToVendor = async (userId, userRole, targetVendorId) => {
  if (['owner', 'dueño', 'director'].includes(userRole)) {
    return true;
  }

  if (userId === targetVendorId) {
    return true;
  }

  const [targetUser] = await pool.execute(
    'SELECT id, role, reportsTo FROM users WHERE id = ?',
    [targetVendorId]
  );

  if (targetUser.length === 0) {
    return false;
  }

  const target = targetUser[0];

  if (userRole === 'gerente') {
    if (target.reportsTo === userId) {
      return true;
    }
    
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

  if (userRole === 'supervisor') {
    return target.reportsTo === userId;
  }

  return false;
};

// ============================================
// HELPER: Verificar horario laboral
// ============================================
function isWorkingHours() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = 9 * 60 + 30; // 9:30
  const endMinutes = 19 * 60 + 30;  // 19:30
  
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  return isWeekday && currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// GET todos los leads
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Para vendedores: no mostrar leads pendientes de aceptación de OTROS
    // Solo mostrar sus propios leads aceptados
    const { role, id: userId } = req.user;
    
    let query = 'SELECT * FROM leads';
    let params = [];
    
    if (role === 'vendedor') {
      // Vendedor solo ve leads que aceptó O que no están en pending
      query = `
        SELECT * FROM leads 
        WHERE (assigned_to = ? AND pending_acceptance = FALSE)
           OR (pending_acceptance = FALSE AND assigned_to IS NULL)
        ORDER BY created_at DESC
      `;
      params = [userId];
    } else {
      query = 'SELECT * FROM leads ORDER BY created_at DESC';
    }
    
    const [rows] = await pool.execute(query, params);
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
    
    const lead = rows[0];
    const { role, id: userId } = req.user;
    
    // Si es vendedor y el lead está pendiente de aceptación para ÉL, no mostrar datos
    if (role === 'vendedor' && lead.pending_acceptance && lead.current_offer_to === userId) {
      return res.json({ 
        ok: true, 
        lead: {
          id: lead.id,
          pending_acceptance: true,
          message: 'Debés aceptar este lead para ver los datos'
        }
      });
    }
    
    // Si es vendedor y el lead no es suyo, no mostrar
    if (role === 'vendedor' && lead.assigned_to !== userId && lead.pending_acceptance) {
      return res.status(403).json({ error: 'No tenés acceso a este lead' });
    }
    
    // Agregar info de venta activa si existe
    const ventaInfo = await tieneVentaActiva(lead.id);
    const leadConInfo = {
      ...mapLead(lead),
      tiene_venta_activa: ventaInfo.tiene,
      venta_activa: ventaInfo.venta || null
    };
    
    res.json({ ok: true, lead: leadConInfo });
  } catch (error) {
    console.error('Error GET /leads/:id:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

// GET estado del round-robin
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

// POST resetear round-robin
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

// GET distribución de leads
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

// GET leads sin asignar
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
      count: leads.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// POST crear lead
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { nombre, telefono, modelo, marca, formaPago, fuente, notas } = req.body;

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y teléfono son obligatorios' });
    }

    let assignedTo = null;
    let pendingAcceptance = false;
    let acceptanceExpiresAt = null;
    let currentOfferTo = null;

    if (marca && ['vw', 'fiat', 'peugeot', 'renault'].includes(marca)) {
      try {
        const vendorId = await getAssignedVendorByBrand(marca);
        if (vendorId) {
          if (isWorkingHours()) {
            pendingAcceptance = true;
            currentOfferTo = vendorId;
            acceptanceExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
          } else {
            assignedTo = vendorId;
          }
        }
      } catch (error) {
        console.error('Error en auto-asignación:', error);
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, fuente, notas, 
        assigned_to, pending_acceptance, current_offer_to, acceptance_expires_at, acceptance_attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
      [
        nombre,
        telefono,
        modelo || null,
        marca || null,
        formaPago || null,
        fuente || null,
        notas || null,
        assignedTo,
        pendingAcceptance,
        currentOfferTo,
        acceptanceExpiresAt
      ]
    );

    const leadId = result.insertId;

    if (pendingAcceptance && currentOfferTo) {
      const io = req.app.get('io');
      if (io) {
        const sockets = require('../socket-server');
        if (sockets && sockets.emitToUser) {
          sockets.emitToUser(io, currentOfferTo, 'lead:offer', {
            leadId,
            expiresAt: acceptanceExpiresAt.toISOString(),
            timeoutMinutes: 10,
            message: '🔔 NUEVO LEAD DISPONIBLE',
            timestamp: new Date().toISOString()
          });

          sockets.emitToUser(io, currentOfferTo, 'notification', {
            type: 'lead_offer',
            title: '🔔 NUEVO LEAD DISPONIBLE',
            message: 'Tenés 10 minutos para aceptar',
            leadId,
            requiresAction: true,
            sound: true,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [leadId]);
    res.status(201).json({ ok: true, lead: mapLead(rows[0]) });
  } catch (error) {
    console.error('Error POST /leads:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// ============================================
// POST Aceptar lead
// ============================================
router.post('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const lead = rows[0];

    if (!lead.pending_acceptance) {
      return res.status(400).json({ error: 'Este lead no está pendiente de aceptación' });
    }

    if (lead.current_offer_to !== userId) {
      return res.status(403).json({ error: 'Este lead no está asignado a vos' });
    }

    if (new Date(lead.acceptance_expires_at) < new Date()) {
      return res.status(400).json({ error: 'El tiempo para aceptar este lead expiró' });
    }

    await pool.execute(`
      UPDATE leads 
      SET assigned_to = ?,
          pending_acceptance = FALSE,
          current_offer_to = NULL,
          acceptance_expires_at = NULL,
          accepted_at = NOW()
      WHERE id = ?
    `, [userId, id]);

    const [updatedRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    console.log(`✅ Lead ${id} aceptado por vendedor ${userId}`);
    
    res.json({ 
      ok: true, 
      message: 'Lead aceptado correctamente',
      lead: mapLead(updatedRows[0])
    });

  } catch (error) {
    console.error('Error aceptando lead:', error);
    res.status(500).json({ error: 'Error al aceptar lead' });
  }
});

// ============================================
// POST Rechazar lead
// ============================================
router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const lead = rows[0];

    if (!lead.pending_acceptance) {
      return res.status(400).json({ error: 'Este lead no está pendiente de aceptación' });
    }

    if (lead.current_offer_to !== userId) {
      return res.status(403).json({ error: 'Este lead no está asignado a vos' });
    }

    let attempts = [];
    try {
      attempts = JSON.parse(lead.acceptance_attempts || '[]');
    } catch (e) {
      attempts = [];
    }
    
    attempts.push({
      vendorId: userId,
      action: 'rejected',
      timestamp: new Date().toISOString()
    });

    const [teamVendors] = await pool.execute(`
      SELECT id FROM users 
      WHERE role = 'vendedor' 
        AND active = TRUE 
        AND id IN (
          SELECT id FROM users WHERE marca_asignada = ?
          UNION
          SELECT id FROM users WHERE JSON_CONTAINS(marcas_adicionales, ?)
        )
      ORDER BY RAND()
    `, [lead.marca, JSON.stringify(lead.marca)]);

    const attemptedIds = attempts.map(a => a.vendorId);
    const availableVendors = teamVendors.filter(v => !attemptedIds.includes(v.id));

    let nextVendor = null;
    const io = req.app.get('io');

    if (availableVendors.length > 0) {
      nextVendor = availableVendors[0];
    } else if (teamVendors.length > 0) {
      attempts = [];
      nextVendor = teamVendors[0];
    }

    if (nextVendor) {
      const newExpires = new Date(Date.now() + 10 * 60 * 1000);
      
      await pool.execute(`
        UPDATE leads 
        SET acceptance_attempts = ?,
            current_offer_to = ?,
            acceptance_expires_at = ?
        WHERE id = ?
      `, [JSON.stringify(attempts), nextVendor.id, newExpires, id]);

      if (io) {
        const sockets = require('../socket-server');
        if (sockets && sockets.emitToUser) {
          sockets.emitToUser(io, nextVendor.id, 'lead:offer', {
            leadId: lead.id,
            expiresAt: newExpires.toISOString(),
            timeoutMinutes: 10,
            message: '🔔 NUEVO LEAD DISPONIBLE',
            timestamp: new Date().toISOString()
          });

          sockets.emitToUser(io, nextVendor.id, 'notification', {
            type: 'lead_offer',
            title: '🔔 NUEVO LEAD DISPONIBLE',
            message: 'Tenés 10 minutos para aceptar',
            leadId: lead.id,
            requiresAction: true,
            sound: true,
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log(`➡️ Lead ${id} pasado a vendedor ${nextVendor.id}`);
    }

    res.json({ ok: true, message: 'Lead rechazado, pasando al siguiente vendedor' });

  } catch (error) {
    console.error('Error rechazando lead:', error);
    res.status(500).json({ error: 'Error al rechazar lead' });
  }
});

// ============================================
// GET Ofertas pendientes para el usuario actual
// ============================================
router.get('/pending-offers/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(`
      SELECT id, acceptance_expires_at 
      FROM leads 
      WHERE current_offer_to = ? 
        AND pending_acceptance = TRUE
        AND acceptance_expires_at > NOW()
    `, [userId]);

    res.json({ 
      ok: true, 
      offers: rows.map(r => ({
        leadId: r.id,
        expiresAt: r.acceptance_expires_at
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener ofertas' });
  }
});

// ============================================
// PUT actualizar lead - CON PROTECCIÓN DE VENTA ACTIVA
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [currentLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (currentLead.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const leadActual = currentLead[0];

    // Validar estados protegidos
    if (updates.estado && updates.estado !== leadActual.estado) {
      const validacion = validarCambioEstadoLead(
        leadActual.estado, 
        updates.estado, 
        req.user.role,
        false
      );
      
      if (!validacion.permitido) {
        return res.status(403).json({ error: validacion.error });
      }
    }

    if (ESTADOS_PROTEGIDOS.includes(leadActual.estado) && req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: `Este lead está en estado "${leadActual.estado}" y no puede ser modificado.`
      });
    }

    // ============================================
    // NUEVO: PROTECCIÓN CONTRA REASIGNACIÓN CON VENTA ACTIVA
    // ============================================
    const nuevoVendedor = updates.vendedor || updates.assigned_to;
    const vendedorActual = leadActual.assigned_to;
    
    // Si se está intentando cambiar el vendedor
    if (nuevoVendedor !== undefined && nuevoVendedor !== vendedorActual) {
      const ventaInfo = await tieneVentaActiva(id);
      
      if (ventaInfo.tiene) {
        // Solo el owner puede reasignar leads con venta activa
        if (req.user.role !== 'owner') {
          return res.status(403).json({ 
            error: `No se puede reasignar este lead porque tiene una venta activa en estado "${ventaInfo.venta.estado}". Solo el Owner puede hacerlo.`,
            venta_id: ventaInfo.venta.id,
            estado_venta: ventaInfo.venta.estado
          });
        }
        
        // Si es owner, advertir pero permitir
        console.log(`⚠️ Owner reasignando lead ${id} con venta activa (venta #${ventaInfo.venta.id})`);
      }
    }
    // ============================================

    const allowedFields = [
      'nombre', 'telefono', 'modelo', 'marca', 'formaPago', 'estado',
      'fuente', 'notas', 'assigned_to', 'vendedor', 'infoUsado', 'entrega', 'fecha'
    ];

    if (updates.marca && !updates.vendedor && !updates.assigned_to) {
      try {
        const autoVendor = await getAssignedVendorByBrand(updates.marca);
        if (autoVendor) {
          updates.assigned_to = autoVendor;
        }
      } catch (error) {
        console.error('Error en auto-asignación:', error);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'vendedor') || 
        Object.prototype.hasOwnProperty.call(updates, 'assigned_to')) {
      
      const newVendorId = updates.vendedor || updates.assigned_to;
      
      if (newVendorId !== null && newVendorId !== undefined) {
        const hasPermission = await canAssignToVendor(req.user.id, req.user.role, newVendorId);
        
        if (!hasPermission) {
          return res.status(403).json({ error: 'No tenés permisos para asignar a este vendedor' });
        }
      }
    }

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) continue;

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

// POST reactivar lead (solo owner)
router.post('/:id/reactivar', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;
  const { nuevo_estado, motivo } = req.body;
  
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Solo el Owner puede reactivar leads rechazados' });
  }
  
  try {
    const [leads] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const lead = leads[0];
    
    if (!ESTADOS_PROTEGIDOS.includes(lead.estado)) {
      return res.status(400).json({ error: 'Este lead no está en estado rechazado' });
    }
    
    if (!nuevo_estado) {
      return res.status(400).json({ error: 'Debe especificar el nuevo estado' });
    }
    
    if (ESTADOS_PROTEGIDOS.includes(nuevo_estado)) {
      return res.status(400).json({ error: 'No se puede reactivar a un estado de rechazo' });
    }
    
    const timestamp = new Date().toISOString();
    const notaReactivacion = `\n[${timestamp}] REACTIVADO por Owner desde "${lead.estado}": ${motivo || 'Sin motivo'}`;
    
    await pool.execute(`
      UPDATE leads 
      SET estado = ?,
          notas = CONCAT(IFNULL(notas, ''), ?),
          updated_at = NOW()
      WHERE id = ?
    `, [nuevo_estado, notaReactivacion, id]);
    
    const [leadActualizado] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    
    res.json({ 
      ok: true, 
      mensaje: `Lead reactivado a "${nuevo_estado}"`,
      lead: mapLead(leadActualizado[0])
    });
    
  } catch (error) {
    console.error('Error al reactivar lead:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE eliminar lead - CON PROTECCIÓN DE VENTA ACTIVA
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [currentLead] = await pool.execute('SELECT estado FROM leads WHERE id = ?', [id]);
    
    if (currentLead.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    if (ESTADOS_PROTEGIDOS.includes(currentLead[0].estado)) {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ 
          error: `No se puede eliminar un lead en estado "${currentLead[0].estado}".`
        });
      }
    }
    
    // NUEVO: Verificar si tiene venta activa
    const ventaInfo = await tieneVentaActiva(id);
    if (ventaInfo.tiene) {
      return res.status(403).json({ 
        error: `No se puede eliminar este lead porque tiene una venta activa en estado "${ventaInfo.venta.estado}".`,
        venta_id: ventaInfo.venta.id,
        estado_venta: ventaInfo.venta.estado
      });
    }
    
    await pool.execute('DELETE FROM leads WHERE id = ?', [id]);
    res.json({ ok: true, message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error DELETE /leads/:id:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

module.exports = router;