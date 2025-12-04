/**
 * ============================================
 * ROUTES/SCORING.JS - MÓDULO DE SCORING v6
 * ============================================
 * CAMBIOS v6:
 * - Sistema de mensajes internos entre Scoring y Supervisores
 * - Guardar fecha/hora cuando se observa una venta
 * - Endpoint para marcar observación como resuelta
 * - Notificaciones de mensajes nuevos
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// CLOUDINARY SETUP
// ============================================
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
  limits: { fileSize: 10 * 1024 * 1024 },
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

// Estados posibles de VENTA (scoring)
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

// Estados protegidos de LEAD (solo automáticos)
const ESTADOS_LEAD_PROTEGIDOS = {
  RECHAZADO_SUPERVISOR: 'rechazado_supervisor',
  RECHAZADO_SCORING: 'rechazado_scoring'
};

// Transiciones permitidas
const TRANSICIONES_PERMITIDAS = {
  [ESTADOS.PENDIENTE_SUPERVISOR]: [ESTADOS.INGRESADA],
  [ESTADOS.INGRESADA]: [ESTADOS.ASIGNADA],
  [ESTADOS.ASIGNADA]: [ESTADOS.EN_PROCESO, ESTADOS.OBSERVADA, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.EN_PROCESO]: [ESTADOS.OBSERVADA, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.OBSERVADA]: [ESTADOS.EN_PROCESO, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO],
  [ESTADOS.RECHAZADA]: [],
  [ESTADOS.PENDIENTE_PAGO]: [ESTADOS.SENA, ESTADOS.FINALIZADA],
  [ESTADOS.SENA]: [ESTADOS.FINALIZADA],
  [ESTADOS.FINALIZADA]: [ESTADOS.CARGADA_CONCESIONARIO],
  [ESTADOS.CARGADA_CONCESIONARIO]: []
};

// Roles permitidos
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
// HELPER: Cambiar estado del lead automáticamente
// ============================================
async function cambiarEstadoLead(pool, leadId, nuevoEstado, motivo) {
  const timestamp = new Date().toISOString();
  await pool.query(`
    UPDATE leads 
    SET estado = ?, 
        notas = CONCAT(IFNULL(notas, ''), '\n[', ?, '] Estado cambiado automáticamente a ', ?, ': ', ?)
    WHERE id = ?
  `, [nuevoEstado, timestamp, nuevoEstado, motivo || 'Cambio desde scoring', leadId]);
}

// ============================================
// HELPER: Crear mensaje interno
// ============================================
async function crearMensajeInterno(pool, ventaId, remitenteId, destinatarioId, mensaje, tipo) {
  const [result] = await pool.query(`
    INSERT INTO scoring_mensajes (venta_id, remitente_id, destinatario_id, mensaje, tipo)
    VALUES (?, ?, ?, ?, ?)
  `, [ventaId, remitenteId, destinatarioId, mensaje, tipo]);
  return result.insertId;
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
    
    if (!lead_id || !fecha_venta) {
      return res.status(400).json({ error: 'lead_id y fecha_venta son obligatorios' });
    }
    
    // Obtener info del lead
    const [leadRows] = await pool.query(`
      SELECT l.*, u.reportsTo as supervisor_id
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = ?
    `, [lead_id]);
    
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const lead = leadRows[0];
    
    // Verificar que el lead no esté en estado protegido
    if ([ESTADOS_LEAD_PROTEGIDOS.RECHAZADO_SUPERVISOR, ESTADOS_LEAD_PROTEGIDOS.RECHAZADO_SCORING].includes(lead.estado)) {
      return res.status(400).json({ 
        error: 'No se puede crear una venta para un lead rechazado',
        detalle: 'Este lead fue rechazado previamente. Contactá al owner para reactivarlo.'
      });
    }
    
    const supervisorId = lead.supervisor_id || null;
    
    // Subir archivo a Cloudinary si existe
    let pdfUrl = null;
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'scoring',
          resource_type: 'auto',
          public_id: `venta-${Date.now()}`,
        });
        pdfUrl = result.secure_url;
        fs.unlink(req.file.path, () => {});
      } catch (cloudinaryError) {
        console.error('Error subiendo a Cloudinary:', cloudinaryError);
        pdfUrl = `/tmp/scoring/${req.file.filename}`;
      }
    }
    
    // Crear la venta
    const [result] = await pool.query(`
      INSERT INTO ventas_scoring 
      (lead_id, vendedor_id, supervisor_id, estado, fecha_venta, pdf_url, notas_vendedor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [lead_id, userId, supervisorId, ESTADOS.PENDIENTE_SUPERVISOR, fecha_venta, pdfUrl, notas_vendedor || null]);
    
    const ventaId = result.insertId;
    
    await crearNota(pool, ventaId, userId, 'creacion', null, ESTADOS.PENDIENTE_SUPERVISOR, 'Venta creada por vendedor');
    
    if (supervisorId) {
      await crearAlerta(pool, ventaId, supervisorId, 'nueva_venta', `Nueva venta pendiente de autorización: ${lead.nombre}`);
      
      if (io) {
        io.to(`user_${supervisorId}`).emit('scoring:alerta', {
          tipo: 'nueva_venta',
          ventaId,
          mensaje: `Nueva venta pendiente de autorización: ${lead.nombre}`
        });
      }
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
    
    if (ROLES_VER_TODO.includes(role)) {
      // Owner y Director ven todo
    } else if (role === 'jefe_scoring') {
      query += ` AND estado != 'pendiente_supervisor'`;
    } else if (role === 'scoring') {
      query += ` AND (scoring_user_id = ? OR (estado = 'ingresada' AND scoring_user_id IS NULL))`;
      params.push(userId);
    } else if (role === 'cobranza') {
      query += ` AND estado IN ('pendiente_pago', 'seña', 'finalizada', 'cargada_concesionario')`;
    } else if (ROLES_AUTORIZACION.includes(role)) {
      query += ` AND (vendedor_id = ? OR supervisor_id = ?)`;
      params.push(userId, userId);
    } else if (role === 'vendedor') {
      query += ` AND vendedor_id = ?`;
      params.push(userId);
    }
    
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
// 3. OBTENER VENTA POR ID (con historial y mensajes)
// ============================================
router.get('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM v_scoring_dashboard WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
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
    
    // Obtener notas/historial
    const [notas] = await pool.query(`
      SELECT sn.*, u.name as usuario_nombre
      FROM scoring_notas sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.venta_id = ?
      ORDER BY sn.created_at DESC
    `, [id]);
    
    // Obtener mensajes internos
    const [mensajes] = await pool.query(`
      SELECT 
        sm.*,
        u_rem.name as remitente_nombre,
        u_rem.role as remitente_rol
      FROM scoring_mensajes sm
      LEFT JOIN users u_rem ON sm.remitente_id = u_rem.id
      WHERE sm.venta_id = ?
      ORDER BY sm.created_at ASC
    `, [id]);
    
    res.json({ ok: true, venta, notas, mensajes });
    
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
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.estado !== ESTADOS.PENDIENTE_SUPERVISOR) {
      return res.status(400).json({ error: 'Esta venta ya fue procesada' });
    }
    
    if (role !== 'owner' && role !== 'director' && venta.supervisor_id !== userId) {
      return res.status(403).json({ error: 'Solo podés autorizar ventas de tu equipo' });
    }
    
    if (!pv || !medio_pago) {
      return res.status(400).json({ error: 'PV y medio de pago son obligatorios' });
    }
    
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, pv = ?, medio_pago = ?, autorizado_por = ?, autorizado_at = NOW()
      WHERE id = ?
    `, [ESTADOS.INGRESADA, pv, medio_pago, userId, id]);
    
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.PENDIENTE_SUPERVISOR, ESTADOS.INGRESADA, 'Venta autorizada por supervisor');
    
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
// 4.1 RECHAZAR VENTA (Supervisor) - CON CAMBIO DE LEAD
// ============================================
router.post('/:id/rechazar-supervisor', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { motivo } = req.body;
  
  if (!ROLES_AUTORIZACION.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para rechazar ventas' });
  }
  
  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'El motivo del rechazo es obligatorio' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.estado !== ESTADOS.PENDIENTE_SUPERVISOR) {
      return res.status(400).json({ error: 'Esta venta ya fue procesada' });
    }
    
    if (role !== 'owner' && role !== 'director' && venta.supervisor_id !== userId) {
      return res.status(403).json({ error: 'Solo podés rechazar ventas de tu equipo' });
    }
    
    // Actualizar venta a rechazada
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = 'rechazada', 
          motivo_rechazo = ?,
          rechazado_por = ?,
          rechazado_at = NOW()
      WHERE id = ?
    `, [motivo, userId, id]);
    
    // CAMBIAR ESTADO DEL LEAD A 'rechazado_supervisor'
    await cambiarEstadoLead(
      pool, 
      venta.lead_id, 
      ESTADOS_LEAD_PROTEGIDOS.RECHAZADO_SUPERVISOR, 
      `Rechazado por supervisor: ${motivo}`
    );
    
    await crearNota(pool, id, userId, 'rechazo_supervisor', ESTADOS.PENDIENTE_SUPERVISOR, 'rechazada', `Rechazado por supervisor: ${motivo}`);
    
    // Crear alerta para el vendedor
    await crearAlerta(pool, id, venta.vendedor_id, 'venta_rechazada_supervisor', `Tu venta fue rechazada por el supervisor: ${motivo}`);
    
    if (io) {
      io.to(`user_${venta.vendedor_id}`).emit('scoring:alerta', {
        tipo: 'venta_rechazada_supervisor',
        ventaId: id,
        mensaje: `Tu venta fue rechazada: ${motivo}`
      });
      
      io.emit('scoring:estado_cambiado', { 
        ventaId: id, 
        estadoAnterior: ESTADOS.PENDIENTE_SUPERVISOR, 
        nuevoEstado: 'rechazada' 
      });
      
      io.emit('lead:updated', { leadId: venta.lead_id });
    }
    
    res.json({ ok: true, mensaje: 'Venta rechazada correctamente' });
    
  } catch (error) {
    console.error('Error al rechazar venta:', error);
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
// 6. CAMBIAR ESTADO (Scoring/Cobranza) - CON MENSAJES EN OBSERVACIONES
// ============================================
router.post('/:id/estado', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role, name: userName } = req.user;
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
    
    // Verificar permisos
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
    
    // GUARDAR FECHA/HORA EN NOTAS CON FORMATO ESPECIAL
    if (notas) {
      const timestamp = new Date().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const notaFormateada = `[${timestamp}] ${userName || 'Scoring'}: ${notas}`;
      updateQuery += `, notas_scoring = CONCAT(IFNULL(notas_scoring, ''), '\n', ?)`;
      updateParams.push(notaFormateada);
    }
    
    if (motivo_rechazo) {
      updateQuery += `, motivo_rechazo = ?`;
      updateParams.push(motivo_rechazo);
    }
    
    // SI ES OBSERVACIÓN, GUARDAR TIMESTAMP Y CREAR MENSAJE
    if (nuevo_estado === ESTADOS.OBSERVADA) {
      updateQuery += `, observada_at = NOW(), observada_por = ?`;
      updateParams.push(userId);
      
      // Crear mensaje interno automático para supervisor
      await crearMensajeInterno(
        pool, 
        id, 
        userId, 
        venta.supervisor_id,
        notas,
        'observacion'
      );
      
      // También para vendedor si es distinto
      if (venta.vendedor_id && venta.vendedor_id !== venta.supervisor_id) {
        await crearMensajeInterno(
          pool, 
          id, 
          userId, 
          venta.vendedor_id,
          notas,
          'observacion'
        );
      }
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
    
    // SI ES RECHAZO DE SCORING, CAMBIAR ESTADO DEL LEAD
    if (nuevo_estado === ESTADOS.RECHAZADA) {
      await cambiarEstadoLead(
        pool, 
        venta.lead_id, 
        ESTADOS_LEAD_PROTEGIDOS.RECHAZADO_SCORING, 
        `Rechazado por scoring: ${motivo_rechazo}`
      );
      
      if (io) {
        io.emit('lead:updated', { leadId: venta.lead_id });
      }
    }
    
    await crearNota(pool, id, userId, 'cambio_estado', estadoActual, nuevo_estado, notas || motivo_rechazo || 'Cambio de estado');
    
    // Notificar si es rechazo u observación
    if ([ESTADOS.RECHAZADA, ESTADOS.OBSERVADA].includes(nuevo_estado)) {
      const notificarA = [venta.vendedor_id, venta.supervisor_id].filter(Boolean);
      
      for (const targetUserId of notificarA) {
        const tipoAlerta = nuevo_estado === ESTADOS.RECHAZADA ? 'venta_rechazada_scoring' : 'venta_observada';
        await crearAlerta(pool, id, targetUserId, tipoAlerta, `Venta ${nuevo_estado}: ${motivo_rechazo || notas}`);
        
        if (io) {
          io.to(`user_${targetUserId}`).emit('scoring:alerta', {
            tipo: tipoAlerta,
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
// 7. ENVIAR MENSAJE INTERNO (Supervisor/Vendedor responde a Scoring)
// ============================================
router.post('/:id/mensaje', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role, name: userName } = req.user;
  const { mensaje, tipo } = req.body;
  
  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje es obligatorio' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar que el usuario tiene acceso a esta venta
    const tieneAcceso = 
      ROLES_VER_TODO.includes(role) ||
      venta.vendedor_id === userId ||
      venta.supervisor_id === userId ||
      venta.scoring_user_id === userId ||
      ['jefe_scoring', 'scoring'].includes(role);
    
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tenés acceso a esta venta' });
    }
    
    // Determinar el tipo de mensaje
    let tipoMensaje = tipo || 'sistema';
    if (ROLES_AUTORIZACION.includes(role)) {
      tipoMensaje = tipo === 'resuelto' ? 'resuelto' : 'respuesta_supervisor';
    } else if (role === 'vendedor') {
      tipoMensaje = 'respuesta_vendedor';
    } else if (ROLES_SCORING.includes(role)) {
      tipoMensaje = 'observacion';
    }
    
    // Determinar destinatario
    let destinatarioId = null;
    if (ROLES_AUTORIZACION.includes(role) || role === 'vendedor') {
      // Supervisor o vendedor responde a scoring
      destinatarioId = venta.scoring_user_id;
    } else if (ROLES_SCORING.includes(role)) {
      // Scoring responde a supervisor
      destinatarioId = venta.supervisor_id;
    }
    
    // Crear el mensaje
    const mensajeId = await crearMensajeInterno(pool, id, userId, destinatarioId, mensaje, tipoMensaje);
    
    // Guardar en notas de la venta también (para historial)
    const timestamp = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    await crearNota(pool, id, userId, 'mensaje_interno', null, null, `[${timestamp}] ${userName}: ${mensaje}`);
    
    // Si es mensaje de "resuelto", actualizar la venta y notificar a scoring
    if (tipoMensaje === 'resuelto') {
      await pool.query(`
        UPDATE ventas_scoring 
        SET resuelta_at = NOW(), resuelta_por = ?
        WHERE id = ?
      `, [userId, id]);
      
      // Crear alerta para el usuario de scoring
      if (venta.scoring_user_id) {
        await crearAlerta(
          pool, 
          id, 
          venta.scoring_user_id, 
          'observacion_resuelta', 
          `La observación de la venta #${id} fue resuelta por ${userName}: ${mensaje}`
        );
        
        if (io) {
          io.to(`user_${venta.scoring_user_id}`).emit('scoring:alerta', {
            tipo: 'observacion_resuelta',
            ventaId: id,
            mensaje: `Observación resuelta: ${mensaje}`
          });
        }
      }
    } else {
      // Notificar nuevo mensaje
      if (destinatarioId && io) {
        await crearAlerta(pool, id, destinatarioId, 'mensaje_nuevo', `Nuevo mensaje en venta #${id}: ${mensaje.substring(0, 50)}...`);
        
        io.to(`user_${destinatarioId}`).emit('scoring:mensaje_nuevo', {
          ventaId: id,
          mensaje,
          remitente: userName,
          tipo: tipoMensaje
        });
      }
    }
    
    res.json({ 
      ok: true, 
      mensajeId,
      mensaje: 'Mensaje enviado correctamente' 
    });
    
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 8. OBTENER MENSAJES DE UNA VENTA
// ============================================
router.get('/:id/mensajes', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar acceso
    const tieneAcceso = 
      ROLES_VER_TODO.includes(role) ||
      venta.vendedor_id === userId ||
      venta.supervisor_id === userId ||
      venta.scoring_user_id === userId ||
      ['jefe_scoring', 'scoring', 'cobranza'].includes(role);
    
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tenés acceso a esta venta' });
    }
    
    const [mensajes] = await pool.query(`
      SELECT 
        sm.*,
        u_rem.name as remitente_nombre,
        u_rem.role as remitente_rol
      FROM scoring_mensajes sm
      LEFT JOIN users u_rem ON sm.remitente_id = u_rem.id
      WHERE sm.venta_id = ?
      ORDER BY sm.created_at ASC
    `, [id]);
    
    // Marcar como leídos los mensajes dirigidos al usuario actual
    await pool.query(`
      UPDATE scoring_mensajes 
      SET leido = TRUE, leido_at = NOW()
      WHERE venta_id = ? AND destinatario_id = ? AND leido = FALSE
    `, [id, userId]);
    
    res.json(mensajes);
    
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 9. ACTUALIZAR MONTOS (Cobranza)
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
      const timestamp = new Date().toISOString();
      updateFields.push(`notas_cobranza = CONCAT(IFNULL(notas_cobranza, ''), '\n[', ?, '] ', ?)`);
      updateParams.push(timestamp, notas_cobranza);
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
// 10. OBTENER MIS ALERTAS
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
    
    res.json(alertas);
    
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 11. MARCAR ALERTA COMO LEÍDA
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
// 12. CONTAR MENSAJES NO LEÍDOS
// ============================================
router.get('/mensajes/no-leidos', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId } = req.user;
  
  try {
    const [result] = await pool.query(`
      SELECT COUNT(*) as count
      FROM scoring_mensajes
      WHERE destinatario_id = ? AND leido = FALSE
    `, [userId]);
    
    res.json({ count: result[0]?.count || 0 });
    
  } catch (error) {
    console.error('Error al contar mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 13. ESTADÍSTICAS
// ============================================
router.get('/stats/dashboard', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  const { fecha_desde, fecha_hasta } = req.query;
  
  try {
    let whereClause = '1=1';
    const params = [];
    
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
    
    const [estadoStats] = await pool.query(`
      SELECT estado, COUNT(*) as cantidad
      FROM ventas_scoring
      WHERE ${whereClause}
      GROUP BY estado
    `, params);
    
    const [tiempoStats] = await pool.query(`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, created_at, autorizado_at)) as avg_tiempo_autorizacion,
        AVG(TIMESTAMPDIFF(MINUTE, autorizado_at, tomada_scoring_at)) as avg_tiempo_tomar,
        AVG(TIMESTAMPDIFF(MINUTE, tomada_scoring_at, scoring_completado_at)) as avg_tiempo_scoring,
        AVG(TIMESTAMPDIFF(MINUTE, scoring_completado_at, cobranza_completada_at)) as avg_tiempo_cobranza
      FROM ventas_scoring
      WHERE ${whereClause}
    `, params);
    
    let topVendedores = [];
    if (ROLES_VER_TODO.includes(role) || ['gerente', 'jefe_scoring'].includes(role)) {
      const [vendedores] = await pool.query(`
        SELECT 
          u.id, u.name,
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