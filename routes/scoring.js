/**
 * ============================================
 * ROUTES/SCORING.JS - MÓDULO DE SCORING (CORREGIDO v2)
 * ============================================
 * CAMBIOS:
 * 1. Alerta va al supervisor del VENDEDOR, no del lead
 * 2. Respuestas de alertas normalizadas
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subir PDFs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = '/tmp/scoring';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'venta-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máx
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten PDF e imágenes'), false);
    }
  }
});

// =============================================
// Importar middleware de autenticación
// =============================================
const { authenticateToken } = require('../middleware/auth');
const authMiddleware = authenticateToken;

// Estados posibles
const ESTADOS = {
  PENDIENTE_SUPERVISOR: 'pendiente_supervisor',
  INGRESADA: 'ingresada',
  ASIGNADA: 'asignada',
  EN_PROCESO: 'en_proceso',
  OBSERVADA: 'observada',
  RECHAZADA: 'rechazada',
  PENDIENTE_PAGO: 'pendiente_pago',
  SENA: 'seña',
  FINALIZADA: 'finalizada',
  CARGADA_CONCESIONARIO: 'cargada_concesionario'
};

// Transiciones permitidas según el estado actual
const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PENDIENTE_SUPERVISOR]: [ESTADOS.INGRESADA],
  [ESTADOS.INGRESADA]: [ESTADOS.ASIGNADA],
  [ESTADOS.ASIGNADA]: [ESTADOS.EN_PROCESO, ESTADOS.OBSERVADA, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.EN_PROCESO]: [ESTADOS.OBSERVADA, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.OBSERVADA]: [ESTADOS.EN_PROCESO, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.RECHAZADA]: [], // Estado final negativo
  [ESTADOS.PENDIENTE_PAGO]: [ESTADOS.SENA, ESTADOS.FINALIZADA],
  [ESTADOS.SENA]: [ESTADOS.FINALIZADA],
  [ESTADOS.FINALIZADA]: [ESTADOS.CARGADA_CONCESIONARIO],
  [ESTADOS.CARGADA_CONCESIONARIO]: [] // Estado final positivo
};

// Roles permitidos para cada acción
const ROLES_VENTAS = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'];
const ROLES_AUTORIZACION = ['owner', 'director', 'gerente', 'supervisor'];
const ROLES_SCORING = ['owner', 'jefe_scoring', 'scoring'];
const ROLES_COBRANZA = ['owner', 'cobranza'];
const ROLES_VER_TODO = ['owner', 'director'];

// Helper para crear alertas
async function crearAlerta(pool, ventaId, userId, tipo, mensaje) {
  await pool.query(`
    INSERT INTO scoring_alertas (venta_id, user_id, tipo, mensaje)
    VALUES (?, ?, ?, ?)
  `, [ventaId, userId, tipo, mensaje]);
}

// Helper para crear nota en historial
async function crearNota(pool, ventaId, userId, tipo, estadoAnterior, estadoNuevo, mensaje, visiblePara = null) {
  await pool.query(`
    INSERT INTO scoring_notas (venta_id, user_id, tipo, estado_anterior, estado_nuevo, mensaje, visible_para)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [ventaId, userId, tipo, estadoAnterior, estadoNuevo, mensaje, visiblePara ? JSON.stringify(visiblePara) : null]);
}

// ============================================
// 1. CREAR VENTA (Vendedor)
// ============================================
router.post('/', authMiddleware, upload.single('pdf'), async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id: userId, role } = req.user;
  
  if (!ROLES_VENTAS.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para crear ventas' });
  }
  
  try {
    const { lead_id, fecha_venta, notas_vendedor } = req.body;
    const pdfUrl = req.file ? `/tmp/scoring/${req.file.filename}` : null;
    
    if (!lead_id || !fecha_venta) {
      return res.status(400).json({ error: 'lead_id y fecha_venta son obligatorios' });
    }
    
    // Obtener info del lead
    const [leadRows] = await pool.query(`SELECT * FROM leads WHERE id = ?`, [lead_id]);
    
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const lead = leadRows[0];
    
    // ✅ CORREGIDO: Obtener el supervisor del VENDEDOR que está creando la venta
    const [userRows] = await pool.query(`SELECT reportsTo FROM users WHERE id = ?`, [userId]);
    const supervisorId = userRows[0]?.reportsTo || null;
    
    console.log('📧 Creando venta - Vendedor ID:', userId, '- Supervisor ID:', supervisorId);
    
    // Crear la venta
    const [result] = await pool.query(`
      INSERT INTO ventas_scoring 
      (lead_id, vendedor_id, supervisor_id, estado, fecha_venta, pdf_url, notas_vendedor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [lead_id, userId, supervisorId, ESTADOS.PENDIENTE_SUPERVISOR, fecha_venta, pdfUrl, notas_vendedor || null]);
    
    const ventaId = result.insertId;
    
    // Crear nota de creación
    await crearNota(pool, ventaId, userId, 'creacion', null, ESTADOS.PENDIENTE_SUPERVISOR, 'Venta creada por vendedor');
    
    // ✅ Crear alerta para el supervisor del vendedor
    if (supervisorId) {
      console.log('🔔 Creando alerta para supervisor ID:', supervisorId);
      await crearAlerta(pool, ventaId, supervisorId, 'nueva_venta', `Nueva venta pendiente de autorización: ${lead.nombre}`);
      
      // Emitir evento WebSocket
      if (io) {
        io.to(`user_${supervisorId}`).emit('scoring:alerta', {
          tipo: 'nueva_venta',
          ventaId,
          mensaje: `Nueva venta pendiente de autorización: ${lead.nombre}`
        });
      }
    } else {
      console.log('⚠️ El vendedor no tiene supervisor asignado');
    }
    
    res.status(201).json({ 
      ok: true, 
      ventaId,
      mensaje: 'Venta creada correctamente. Esperando autorización del supervisor.'
    });
    
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 2. LISTAR VENTAS (según rol)
// ============================================
router.get('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  const { estado, vendedor_id, fecha_desde, fecha_hasta } = req.query;
  
  try {
    let query = `SELECT * FROM v_scoring_dashboard WHERE 1=1`;
    const params = [];
    
    // Filtrar según rol
    if (ROLES_VER_TODO.includes(role)) {
      // Owner y Director ven todo
    } else if (role === 'jefe_scoring') {
      // Jefe de scoring ve todas las ventas desde "ingresada"
      query += ` AND estado != 'pendiente_supervisor'`;
    } else if (role === 'scoring') {
      // Scoring ve ventas asignadas a él o disponibles
      query += ` AND (scoring_user_id = ? OR (estado = 'ingresada' AND scoring_user_id IS NULL))`;
      params.push(userId);
    } else if (role === 'cobranza') {
      // Cobranza ve ventas en pendiente_pago, seña, finalizada
      query += ` AND estado IN ('pendiente_pago', 'seña', 'finalizada', 'cargada_concesionario')`;
    } else if (ROLES_AUTORIZACION.includes(role)) {
      // Supervisor/Gerente ven ventas de su equipo
      query += ` AND (vendedor_id = ? OR supervisor_id = ?)`;
      params.push(userId, userId);
    } else if (role === 'vendedor') {
      // Vendedor solo ve sus propias ventas
      query += ` AND vendedor_id = ?`;
      params.push(userId);
    }
    
    // Filtros opcionales
    if (estado) {
      query += ` AND estado = ?`;
      params.push(estado);
    }
    if (vendedor_id) {
      query += ` AND vendedor_id = ?`;
      params.push(vendedor_id);
    }
    if (fecha_desde) {
      query += ` AND fecha_venta >= ?`;
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ` AND fecha_venta <= ?`;
      params.push(fecha_hasta);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const [ventas] = await pool.query(query, params);
    
    res.json(ventas);
    
  } catch (error) {
    console.error('Error al listar ventas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 3. OBTENER VENTA POR ID (con historial)
// ============================================
router.get('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  
  try {
    // Obtener venta
    const [ventas] = await pool.query(`SELECT * FROM v_scoring_dashboard WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar permisos de acceso
    const tieneAcceso = 
      ROLES_VER_TODO.includes(role) ||
      venta.vendedor_id === userId ||
      venta.supervisor_id === userId ||
      venta.scoring_user_id === userId ||
      venta.cobranza_user_id === userId ||
      ['jefe_scoring', 'scoring', 'cobranza'].includes(role);
    
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tenés acceso a esta venta' });
    }
    
    // Obtener historial de notas
    const [notas] = await pool.query(`
      SELECT sn.*, u.name as usuario_nombre
      FROM scoring_notas sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.venta_id = ?
      ORDER BY sn.created_at DESC
    `, [id]);
    
    res.json({ ok: true, venta, notas });
    
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 4. AUTORIZAR VENTA (Supervisor)
// ============================================
router.post('/:id/autorizar', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { pv, medio_pago } = req.body;
  
  if (!ROLES_AUTORIZACION.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para autorizar ventas' });
  }
  
  try {
    // Verificar estado actual
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.estado !== ESTADOS.PENDIENTE_SUPERVISOR) {
      return res.status(400).json({ error: 'Esta venta ya fue procesada' });
    }
    
    // Verificar que sea supervisor del vendedor
    if (role !== 'owner' && role !== 'director' && venta.supervisor_id !== userId) {
      return res.status(403).json({ error: 'Solo podés autorizar ventas de tu equipo' });
    }
    
    if (!pv || !medio_pago) {
      return res.status(400).json({ error: 'PV y medio de pago son obligatorios' });
    }
    
    // Actualizar venta
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, pv = ?, medio_pago = ?, autorizado_por = ?, autorizado_at = NOW()
      WHERE id = ?
    `, [ESTADOS.INGRESADA, pv, medio_pago, userId, id]);
    
    // Crear nota
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.PENDIENTE_SUPERVISOR, ESTADOS.INGRESADA, 'Venta autorizada por supervisor');
    
    // Notificar al equipo de scoring
    if (io) {
      io.emit('scoring:nueva_venta_disponible', { ventaId: id });
    }
    
    res.json({ ok: true, mensaje: 'Venta autorizada correctamente' });
    
  } catch (error) {
    console.error('Error al autorizar venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 5. TOMAR VENTA (Scoring)
// ============================================
router.post('/:id/tomar', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  
  if (!ROLES_SCORING.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para tomar ventas' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.estado !== ESTADOS.INGRESADA) {
      return res.status(400).json({ error: 'Esta venta no está disponible para tomar' });
    }
    
    if (venta.scoring_user_id && venta.scoring_user_id !== userId) {
      return res.status(400).json({ error: 'Esta venta ya fue tomada por otro usuario' });
    }
    
    // Asignar venta
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, scoring_user_id = ?, tomada_scoring_at = NOW()
      WHERE id = ?
    `, [ESTADOS.ASIGNADA, userId, id]);
    
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.INGRESADA, ESTADOS.ASIGNADA, 'Venta tomada por scoring');
    
    if (io) {
      io.emit('scoring:venta_tomada', { ventaId: id, scoringUserId: userId });
    }
    
    res.json({ ok: true, mensaje: 'Venta asignada correctamente' });
    
  } catch (error) {
    console.error('Error al tomar venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 6. CAMBIAR ESTADO (Scoring/Cobranza)
// ============================================
router.post('/:id/estado', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { nuevo_estado, notas, motivo_rechazo } = req.body;
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    const estadoActual = venta.estado;
    
    // Verificar transición permitida
    const transicionesPermitidas = TRANSICIONES_PERMITIDAS[estadoActual] || [];
    if (!transicionesPermitidas.includes(nuevo_estado)) {
      return res.status(400).json({ 
        error: `No se puede pasar de "${estadoActual}" a "${nuevo_estado}"`,
        transiciones_permitidas: transicionesPermitidas
      });
    }
    
    // Verificar permisos según el nuevo estado
    let tienePermiso = false;
    
    if (['asignada', 'en_proceso', 'observada', 'rechazada', 'pendiente_pago'].includes(nuevo_estado)) {
      tienePermiso = ROLES_SCORING.includes(role) && (venta.scoring_user_id === userId || role === 'jefe_scoring' || role === 'owner');
    } else if (['seña', 'finalizada', 'cargada_concesionario'].includes(nuevo_estado)) {
      tienePermiso = ROLES_COBRANZA.includes(role) || role === 'owner';
    }
    
    if (!tienePermiso) {
      return res.status(403).json({ error: 'No tenés permiso para este cambio de estado' });
    }
    
    // Validaciones específicas
    if (nuevo_estado === ESTADOS.RECHAZADA && !motivo_rechazo) {
      return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
    }
    if (nuevo_estado === ESTADOS.OBSERVADA && !notas) {
      return res.status(400).json({ error: 'Las notas son obligatorias para observar' });
    }
    
    // Construir query de actualización
    let updateQuery = `UPDATE ventas_scoring SET estado = ?`;
    const updateParams = [nuevo_estado];
    
    if (notas) {
      updateQuery += `, notas_scoring = CONCAT(IFNULL(notas_scoring, ''), '\n[${new Date().toISOString()}] ', ?)`;
      updateParams.push(notas);
    }
    if (motivo_rechazo) {
      updateQuery += `, motivo_rechazo = ?`;
      updateParams.push(motivo_rechazo);
    }
    
    // Timestamps específicos
    if (nuevo_estado === ESTADOS.PENDIENTE_PAGO) {
      updateQuery += `, scoring_completado_at = NOW()`;
    } else if (nuevo_estado === ESTADOS.FINALIZADA) {
      updateQuery += `, cobranza_completada_at = NOW()`;
    } else if (nuevo_estado === ESTADOS.CARGADA_CONCESIONARIO) {
      updateQuery += `, cargada_concesionario_at = NOW()`;
    }
    
    // Asignar usuario de cobranza si corresponde
    if (['seña', 'finalizada', 'cargada_concesionario'].includes(nuevo_estado) && !venta.cobranza_user_id) {
      updateQuery += `, cobranza_user_id = ?`;
      updateParams.push(userId);
    }
    
    updateQuery += ` WHERE id = ?`;
    updateParams.push(id);
    
    await pool.query(updateQuery, updateParams);
    
    // Crear nota de cambio
    await crearNota(pool, id, userId, 'cambio_estado', estadoActual, nuevo_estado, notas || motivo_rechazo || 'Cambio de estado');
    
    // Notificar si es rechazo u observación
    if ([ESTADOS.RECHAZADA, ESTADOS.OBSERVADA].includes(nuevo_estado)) {
      const notificarA = [venta.vendedor_id, venta.supervisor_id].filter(Boolean);
      
      for (const targetUserId of notificarA) {
        await crearAlerta(pool, id, targetUserId, nuevo_estado === ESTADOS.RECHAZADA ? 'venta_rechazada' : 'venta_observada', 
          `Venta ${nuevo_estado}: ${motivo_rechazo || notas}`);
        
        if (io) {
          io.to(`user_${targetUserId}`).emit('scoring:alerta', {
            tipo: nuevo_estado === ESTADOS.RECHAZADA ? 'venta_rechazada' : 'venta_observada',
            ventaId: id,
            mensaje: motivo_rechazo || notas
          });
        }
      }
    }
    
    if (io) {
      io.emit('scoring:estado_cambiado', { ventaId: id, estadoAnterior: estadoActual, nuevoEstado: nuevo_estado });
    }
    
    res.json({ ok: true, mensaje: `Estado cambiado a "${nuevo_estado}"` });
    
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 7. ACTUALIZAR MONTOS (Cobranza)
// ============================================
router.put('/:id/montos', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { monto_total, monto_seña, notas_cobranza } = req.body;
  
  if (!ROLES_COBRANZA.includes(role) && role !== 'owner') {
    return res.status(403).json({ error: 'No tenés permiso para actualizar montos' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (!['pendiente_pago', 'seña', 'finalizada'].includes(venta.estado)) {
      return res.status(400).json({ error: 'Solo se pueden actualizar montos en estados de cobranza' });
    }
    
    let updateFields = [];
    let updateParams = [];
    
    if (monto_total !== undefined) {
      updateFields.push('monto_total = ?');
      updateParams.push(monto_total);
    }
    if (monto_seña !== undefined) {
      updateFields.push('monto_seña = ?');
      updateParams.push(monto_seña);
    }
    if (notas_cobranza) {
      updateFields.push(`notas_cobranza = CONCAT(IFNULL(notas_cobranza, ''), '\n[${new Date().toISOString()}] ', ?)`);
      updateParams.push(notas_cobranza);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    
    updateParams.push(id);
    
    await pool.query(`UPDATE ventas_scoring SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    
    await crearNota(pool, id, userId, 'actualizacion', null, null, `Montos actualizados: ${JSON.stringify({ monto_total, monto_seña })}`);
    
    res.json({ ok: true, mensaje: 'Montos actualizados correctamente' });
    
  } catch (error) {
    console.error('Error al actualizar montos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 8. OBTENER MIS ALERTAS
// ============================================
router.get('/alertas/mis-alertas', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId } = req.user;
  
  try {
    const [alertas] = await pool.query(`
      SELECT sa.*, vs.lead_id, l.nombre as lead_nombre
      FROM scoring_alertas sa
      LEFT JOIN ventas_scoring vs ON sa.venta_id = vs.id
      LEFT JOIN leads l ON vs.lead_id = l.id
      WHERE sa.user_id = ? AND sa.leida = FALSE
      ORDER BY sa.created_at DESC
      LIMIT 50
    `, [userId]);
    
    // ✅ Devolver array directamente para consistencia
    res.json(alertas);
    
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 9. MARCAR ALERTA COMO LEÍDA
// ============================================
router.post('/alertas/:alertaId/leer', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { alertaId } = req.params;
  const { id: userId } = req.user;
  
  try {
    await pool.query(`
      UPDATE scoring_alertas 
      SET leida = TRUE, leida_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [alertaId, userId]);
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('Error al marcar alerta como leída:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 10. ESTADÍSTICAS Y MÉTRICAS
// ============================================
router.get('/stats/dashboard', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  const { fecha_desde, fecha_hasta } = req.query;
  
  try {
    let whereClause = '1=1';
    const params = [];
    
    // Filtrar según rol
    if (!ROLES_VER_TODO.includes(role)) {
      if (role === 'vendedor') {
        whereClause += ' AND vendedor_id = ?';
        params.push(userId);
      } else if (['supervisor', 'gerente'].includes(role)) {
        whereClause += ' AND (vendedor_id = ? OR supervisor_id = ?)';
        params.push(userId, userId);
      }
    }
    
    if (fecha_desde) {
      whereClause += ' AND fecha_venta >= ?';
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      whereClause += ' AND fecha_venta <= ?';
      params.push(fecha_hasta);
    }
    
    // Estadísticas por estado
    const [estadoStats] = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as cantidad
      FROM ventas_scoring
      WHERE ${whereClause}
      GROUP BY estado
    `, params);
    
    // Tiempo promedio por etapa
    const [tiempoStats] = await pool.query(`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, created_at, autorizado_at)) as avg_tiempo_autorizacion,
        AVG(TIMESTAMPDIFF(MINUTE, autorizado_at, tomada_scoring_at)) as avg_tiempo_tomar,
        AVG(TIMESTAMPDIFF(MINUTE, tomada_scoring_at, scoring_completado_at)) as avg_tiempo_scoring,
        AVG(TIMESTAMPDIFF(MINUTE, scoring_completado_at, cobranza_completada_at)) as avg_tiempo_cobranza
      FROM ventas_scoring
      WHERE ${whereClause}
    `, params);
    
    // Top vendedores (solo para roles superiores)
    let topVendedores = [];
    if (ROLES_VER_TODO.includes(role) || ['gerente', 'jefe_scoring'].includes(role)) {
      const [vendedores] = await pool.query(`
        SELECT 
          u.id,
          u.name,
          COUNT(vs.id) as total_ventas,
          SUM(CASE WHEN vs.estado = 'finalizada' THEN 1 ELSE 0 END) as ventas_finalizadas,
          SUM(CASE WHEN vs.estado = 'rechazada' THEN 1 ELSE 0 END) as ventas_rechazadas
        FROM users u
        LEFT JOIN ventas_scoring vs ON u.id = vs.vendedor_id
        WHERE u.role = 'vendedor'
        GROUP BY u.id
        ORDER BY ventas_finalizadas DESC
        LIMIT 10
      `);
      topVendedores = vendedores;
    }
    
    res.json({
      ok: true,
      estadisticas: {
        por_estado: estadoStats,
        tiempos_promedio: tiempoStats[0],
        top_vendedores: topVendedores
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;