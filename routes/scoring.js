/**
 * ============================================
 * ROUTES/SCORING.JS - MÓDULO DE SCORING
 * ============================================
 * Endpoints para gestión de ventas y scoring
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subir PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/scoring';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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

// Middleware de autenticación (asumiendo que ya lo tenés)
const authMiddleware = require('../middleware/auth');

// Estados posibles
const ESTADOS = {
  PENDIENTE_SUPERVISOR: 'pendiente_supervisor',
  INGRESADA: 'ingresada',
  ASIGNADA: 'asignada',
  EN_PROCESO: 'en_proceso',
  OBSERVADA: 'observada',
  RECHAZADA: 'rechazada',
  PENDIENTE_PAGO: 'pendiente_pago',
  SEÑA: 'seña',
  FINALIZADA: 'finalizada',
  CARGADA_CONCESIONARIO: 'cargada_concesionario'
};

// Roles que pueden ver scoring
const ROLES_SCORING = ['owner', 'director', 'jefe_scoring', 'scoring'];
const ROLES_COBRANZA = ['owner', 'director', 'jefe_scoring', 'cobranza'];
const ROLES_VENTAS = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'];

// ============================================
// HELPER: Obtener IDs de usuarios visibles según jerarquía
// ============================================
async function getVisibleUserIds(pool, user) {
  if (['owner', 'director', 'jefe_scoring', 'cobranza'].includes(user.role)) {
    // Ve todos
    const [users] = await pool.execute('SELECT id FROM users');
    return users.map(u => u.id);
  }
  
  if (user.role === 'scoring') {
    // Scoring solo ve ventas en estados de scoring
    return null; // Retornamos null para indicar que filtre por estado
  }
  
  if (user.role === 'gerente') {
    // Ve su equipo completo
    const [descendants] = await pool.execute(`
      WITH RECURSIVE subordinates AS (
        SELECT id FROM users WHERE reportsTo = ?
        UNION ALL
        SELECT u.id FROM users u
        INNER JOIN subordinates s ON u.reportsTo = s.id
      )
      SELECT id FROM subordinates
    `, [user.id]);
    return [user.id, ...descendants.map(u => u.id)];
  }
  
  if (user.role === 'supervisor') {
    // Ve sus vendedores directos
    const [vendors] = await pool.execute('SELECT id FROM users WHERE reportsTo = ?', [user.id]);
    return [user.id, ...vendors.map(u => u.id)];
  }
  
  // Vendedor solo ve lo propio
  return [user.id];
}

// ============================================
// HELPER: Crear alerta de scoring
// ============================================
async function crearAlertaScoring(pool, io, ventaId, tipo, mensaje, userId = null) {
  await pool.execute(`
    INSERT INTO scoring_alertas (venta_id, user_id, tipo, mensaje)
    VALUES (?, ?, ?, ?)
  `, [ventaId, userId, tipo, mensaje]);
  
  // Emitir por WebSocket
  if (io) {
    if (userId) {
      // Alerta para usuario específico
      io.to(`user_${userId}`).emit('scoring:alerta', { ventaId, tipo, mensaje });
    } else {
      // Alerta para todo el equipo de scoring
      io.to('scoring_team').emit('scoring:alerta', { ventaId, tipo, mensaje });
    }
  }
}

// ============================================
// HELPER: Crear nota en historial
// ============================================
async function crearNota(pool, ventaId, userId, tipo, mensaje, estadoAnterior = null, estadoNuevo = null, visiblePara = null) {
  await pool.execute(`
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
    const pdfUrl = req.file ? `/uploads/scoring/${req.file.filename}` : null;
    
    if (!lead_id || !fecha_venta) {
      return res.status(400).json({ error: 'lead_id y fecha_venta son obligatorios' });
    }
    
    // Verificar que el lead existe y pertenece al vendedor
    const [leads] = await pool.execute(
      'SELECT * FROM leads WHERE id = ? AND assigned_to = ?',
      [lead_id, userId]
    );
    
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado o no te pertenece' });
    }
    
    // Obtener supervisor del vendedor
    const [userInfo] = await pool.execute('SELECT reportsTo FROM users WHERE id = ?', [userId]);
    const supervisorId = userInfo[0]?.reportsTo || null;
    
    // Crear la venta
    const [result] = await pool.execute(`
      INSERT INTO ventas_scoring 
      (lead_id, vendedor_id, supervisor_id, fecha_venta, pdf_url, notas_vendedor, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'pendiente_supervisor')
    `, [lead_id, userId, supervisorId, fecha_venta, pdfUrl, notas_vendedor]);
    
    const ventaId = result.insertId;
    
    // Crear nota en historial
    await crearNota(pool, ventaId, userId, 'sistema', 'Venta creada por vendedor');
    
    // Alerta al supervisor
    if (supervisorId) {
      await crearAlertaScoring(pool, io, ventaId, 'nueva_venta', 
        `Nueva venta pendiente de autorización - Lead: ${leads[0].nombre}`, supervisorId);
    }
    
    // Obtener la venta creada con datos completos
    const [ventas] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [ventaId]);
    
    res.status(201).json(ventas[0]);
    
  } catch (error) {
    console.error('Error creando venta:', error);
    res.status(500).json({ error: 'Error al crear la venta' });
  }
});

// ============================================
// 2. LISTAR VENTAS (según rol)
// ============================================
router.get('/', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  const { estado, vendedor_id, desde, hasta } = req.query;
  
  try {
    let query = 'SELECT * FROM v_scoring_dashboard WHERE 1=1';
    const params = [];
    
    // Filtrar según rol
    if (role === 'vendedor') {
      query += ' AND vendedor_id = ?';
      params.push(userId);
    } else if (role === 'supervisor') {
      const [vendors] = await pool.execute('SELECT id FROM users WHERE reportsTo = ?', [userId]);
      const vendorIds = [userId, ...vendors.map(v => v.id)];
      query += ` AND vendedor_id IN (${vendorIds.map(() => '?').join(',')})`;
      params.push(...vendorIds);
    } else if (role === 'gerente') {
      const visibleIds = await getVisibleUserIds(pool, req.user);
      query += ` AND vendedor_id IN (${visibleIds.map(() => '?').join(',')})`;
      params.push(...visibleIds);
    } else if (role === 'scoring') {
      // Scoring solo ve estados que le corresponden
      query += ` AND estado IN ('ingresada', 'asignada', 'en_proceso')`;
    } else if (role === 'cobranza') {
      // Cobranza solo ve pendiente_pago, seña, finalizada
      query += ` AND estado IN ('pendiente_pago', 'seña', 'finalizada')`;
    }
    // owner, director, jefe_scoring ven todo
    
    // Filtros adicionales
    if (estado) {
      query += ' AND estado = ?';
      params.push(estado);
    }
    
    if (vendedor_id) {
      query += ' AND vendedor_id = ?';
      params.push(vendedor_id);
    }
    
    if (desde) {
      query += ' AND fecha_venta >= ?';
      params.push(desde);
    }
    
    if (hasta) {
      query += ' AND fecha_venta <= ?';
      params.push(hasta);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [ventas] = await pool.execute(query, params);
    
    res.json(ventas);
    
  } catch (error) {
    console.error('Error listando ventas:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// ============================================
// 3. OBTENER VENTA POR ID
// ============================================
router.get('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  
  try {
    const [ventas] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    // Obtener historial de notas
    const [notas] = await pool.execute(`
      SELECT sn.*, u.name as usuario_nombre
      FROM scoring_notas sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.venta_id = ?
      ORDER BY sn.created_at DESC
    `, [id]);
    
    res.json({ ...ventas[0], notas });
    
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({ error: 'Error al obtener la venta' });
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
  
  if (!['owner', 'director', 'gerente', 'supervisor'].includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para autorizar ventas' });
  }
  
  if (!pv || !medio_pago) {
    return res.status(400).json({ error: 'PV y medio de pago son obligatorios' });
  }
  
  try {
    // Verificar que la venta existe y está en estado correcto
    const [ventas] = await pool.execute(
      'SELECT * FROM ventas_scoring WHERE id = ? AND estado = ?',
      [id, ESTADOS.PENDIENTE_SUPERVISOR]
    );
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada o ya fue procesada' });
    }
    
    // Actualizar venta
    await pool.execute(`
      UPDATE ventas_scoring 
      SET estado = 'ingresada',
          pv = ?,
          medio_pago = ?,
          autorizado_por = ?,
          autorizado_at = NOW()
      WHERE id = ?
    `, [pv, medio_pago, userId, id]);
    
    // Registrar en historial
    await crearNota(pool, id, userId, 'cambio_estado', 
      `Venta autorizada. PV: ${pv}, Medio de pago: ${medio_pago}`,
      ESTADOS.PENDIENTE_SUPERVISOR, ESTADOS.INGRESADA);
    
    // Alerta a equipo de scoring
    const [leadInfo] = await pool.execute(`
      SELECT l.nombre FROM ventas_scoring vs
      JOIN leads l ON vs.lead_id = l.id
      WHERE vs.id = ?
    `, [id]);
    
    await crearAlertaScoring(pool, io, id, 'nueva_venta',
      `Nueva venta autorizada - Cliente: ${leadInfo[0]?.nombre || 'N/A'}`);
    
    // Obtener venta actualizada
    const [updated] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [id]);
    
    res.json(updated[0]);
    
  } catch (error) {
    console.error('Error autorizando venta:', error);
    res.status(500).json({ error: 'Error al autorizar la venta' });
  }
});

// ============================================
// 5. TOMAR VENTA (Scoring)
// ============================================
router.post('/:id/tomar', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role, name } = req.user;
  
  if (!ROLES_SCORING.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para tomar ventas' });
  }
  
  try {
    // Verificar que está en estado 'ingresada'
    const [ventas] = await pool.execute(
      'SELECT * FROM ventas_scoring WHERE id = ? AND estado = ?',
      [id, ESTADOS.INGRESADA]
    );
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no disponible para tomar' });
    }
    
    // Asignar al usuario de scoring
    await pool.execute(`
      UPDATE ventas_scoring 
      SET estado = 'asignada',
          scoring_user_id = ?,
          asignada_at = NOW()
      WHERE id = ?
    `, [userId, id]);
    
    await crearNota(pool, id, userId, 'cambio_estado',
      `Venta tomada por ${name}`,
      ESTADOS.INGRESADA, ESTADOS.ASIGNADA);
    
    const [updated] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [id]);
    
    // Notificar a otros que ya fue tomada
    if (io) {
      io.to('scoring_team').emit('scoring:venta_tomada', { ventaId: id, scoringUser: name });
    }
    
    res.json(updated[0]);
    
  } catch (error) {
    console.error('Error tomando venta:', error);
    res.status(500).json({ error: 'Error al tomar la venta' });
  }
});

// ============================================
// 6. CAMBIAR ESTADO (Scoring evalúa)
// ============================================
router.post('/:id/estado', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role, name } = req.user;
  const { estado, notas_scoring, motivo_rechazo } = req.body;
  
  if (!ROLES_SCORING.includes(role) && !ROLES_COBRANZA.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para cambiar estados' });
  }
  
  try {
    const [ventas] = await pool.execute('SELECT * FROM ventas_scoring WHERE id = ?', [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    const estadoAnterior = venta.estado;
    
    // Validar transiciones de estado permitidas
    const transicionesValidas = {
      'asignada': ['en_proceso', 'observada', 'rechazada', 'pendiente_pago'],
      'en_proceso': ['en_proceso', 'observada', 'rechazada', 'pendiente_pago'],
      'pendiente_pago': ['seña', 'finalizada'],
      'seña': ['finalizada'],
      'finalizada': ['cargada_concesionario']
    };
    
    if (!transicionesValidas[estadoAnterior]?.includes(estado)) {
      return res.status(400).json({ 
        error: `No se puede cambiar de ${estadoAnterior} a ${estado}` 
      });
    }
    
    // Construir query de actualización
    let updateQuery = 'UPDATE ventas_scoring SET estado = ?';
    const updateParams = [estado];
    
    if (notas_scoring) {
      updateQuery += ', notas_scoring = ?';
      updateParams.push(notas_scoring);
    }
    
    if (motivo_rechazo && ['observada', 'rechazada'].includes(estado)) {
      updateQuery += ', motivo_rechazo = ?';
      updateParams.push(motivo_rechazo);
    }
    
    if (estado === 'pendiente_pago') {
      updateQuery += ', scoring_resuelto_at = NOW()';
    }
    
    if (['seña', 'finalizada'].includes(estado)) {
      updateQuery += ', cobrado_at = NOW(), cobranza_user_id = ?';
      updateParams.push(userId);
    }
    
    if (estado === 'cargada_concesionario') {
      updateQuery += ', cargado_concesionario_at = NOW()';
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);
    
    await pool.execute(updateQuery, updateParams);
    
    // Crear nota
    let mensaje = `Estado cambiado de ${estadoAnterior} a ${estado}`;
    if (motivo_rechazo) {
      mensaje += `. Motivo: ${motivo_rechazo}`;
    }
    
    await crearNota(pool, id, userId, 'cambio_estado', mensaje, estadoAnterior, estado);
    
    // Si es rechazo u observada, notificar a vendedor/supervisor/gerente
    if (['observada', 'rechazada'].includes(estado)) {
      // Notificar al vendedor
      await crearAlertaScoring(pool, io, id, 'cambio_estado',
        `Venta ${estado}: ${motivo_rechazo || 'Sin motivo especificado'}`,
        venta.vendedor_id);
      
      // Notificar al supervisor
      if (venta.supervisor_id) {
        await crearAlertaScoring(pool, io, id, 'cambio_estado',
          `Venta de su equipo ${estado}: ${motivo_rechazo || 'Sin motivo'}`,
          venta.supervisor_id);
      }
    }
    
    // Si pasa a pendiente_pago, notificar a cobranza
    if (estado === 'pendiente_pago') {
      // Obtener usuarios de cobranza
      const [cobranzaUsers] = await pool.execute(
        "SELECT id FROM users WHERE role = 'cobranza' AND active = 1"
      );
      
      for (const u of cobranzaUsers) {
        await crearAlertaScoring(pool, io, id, 'nueva_venta',
          'Nueva venta lista para cobrar', u.id);
      }
    }
    
    const [updated] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [id]);
    
    // Emitir actualización por WebSocket
    if (io) {
      io.emit('scoring:estado_cambiado', { 
        ventaId: id, 
        estadoAnterior, 
        estadoNuevo: estado,
        usuario: name 
      });
    }
    
    res.json(updated[0]);
    
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({ error: 'Error al cambiar el estado' });
  }
});

// ============================================
// 7. ACTUALIZAR MONTOS (Cobranza)
// ============================================
router.put('/:id/montos', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { role } = req.user;
  const { monto_total, monto_seña, notas_cobranza } = req.body;
  
  if (!ROLES_COBRANZA.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para actualizar montos' });
  }
  
  try {
    await pool.execute(`
      UPDATE ventas_scoring 
      SET monto_total = ?, monto_seña = ?, notas_cobranza = ?
      WHERE id = ?
    `, [monto_total, monto_seña, notas_cobranza, id]);
    
    const [updated] = await pool.execute('SELECT * FROM v_scoring_dashboard WHERE id = ?', [id]);
    
    res.json(updated[0]);
    
  } catch (error) {
    console.error('Error actualizando montos:', error);
    res.status(500).json({ error: 'Error al actualizar montos' });
  }
});

// ============================================
// 8. OBTENER ALERTAS DE SCORING
// ============================================
router.get('/alertas/mis-alertas', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  
  try {
    let query = `
      SELECT sa.*, vs.pv, l.nombre as cliente_nombre
      FROM scoring_alertas sa
      JOIN ventas_scoring vs ON sa.venta_id = vs.id
      JOIN leads l ON vs.lead_id = l.id
      WHERE sa.leida = 0
    `;
    const params = [];
    
    if (ROLES_SCORING.includes(role)) {
      // Scoring ve alertas sin usuario específico (para el equipo) y las propias
      query += ' AND (sa.user_id IS NULL OR sa.user_id = ?)';
      params.push(userId);
    } else {
      // Otros roles solo ven sus alertas específicas
      query += ' AND sa.user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY sa.created_at DESC LIMIT 50';
    
    const [alertas] = await pool.execute(query, params);
    
    res.json(alertas);
    
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

// ============================================
// 9. MARCAR ALERTA COMO LEÍDA
// ============================================
router.post('/alertas/:alertaId/leer', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { alertaId } = req.params;
  
  try {
    await pool.execute(`
      UPDATE scoring_alertas 
      SET leida = 1, leida_at = NOW()
      WHERE id = ?
    `, [alertaId]);
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('Error marcando alerta:', error);
    res.status(500).json({ error: 'Error al marcar alerta' });
  }
});

// ============================================
// 10. DASHBOARD/ESTADÍSTICAS
// ============================================
router.get('/stats/dashboard', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId, role } = req.user;
  const { desde, hasta } = req.query;
  
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // Filtrar según rol
    if (role === 'vendedor') {
      whereClause += ' AND vendedor_id = ?';
      params.push(userId);
    } else if (role === 'supervisor') {
      const [vendors] = await pool.execute('SELECT id FROM users WHERE reportsTo = ?', [userId]);
      const ids = [userId, ...vendors.map(v => v.id)];
      whereClause += ` AND vendedor_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    }
    // gerente, director, owner ven todo
    
    if (desde) {
      whereClause += ' AND fecha_venta >= ?';
      params.push(desde);
    }
    if (hasta) {
      whereClause += ' AND fecha_venta <= ?';
      params.push(hasta);
    }
    
    // Contar por estado
    const [porEstado] = await pool.execute(`
      SELECT estado, COUNT(*) as cantidad
      FROM ventas_scoring
      ${whereClause}
      GROUP BY estado
    `, params);
    
    // Total de ventas
    const [total] = await pool.execute(`
      SELECT COUNT(*) as total FROM ventas_scoring ${whereClause}
    `, params);
    
    // Ventas por vendedor (solo para supervisores+)
    let porVendedor = [];
    if (['supervisor', 'gerente', 'director', 'owner', 'jefe_scoring'].includes(role)) {
      const [vendedores] = await pool.execute(`
        SELECT 
          vs.vendedor_id,
          u.name as vendedor_nombre,
          COUNT(*) as total,
          SUM(CASE WHEN vs.estado = 'finalizada' OR vs.estado = 'cargada_concesionario' THEN 1 ELSE 0 END) as finalizadas,
          SUM(CASE WHEN vs.estado = 'rechazada' THEN 1 ELSE 0 END) as rechazadas
        FROM ventas_scoring vs
        JOIN users u ON vs.vendedor_id = u.id
        ${whereClause}
        GROUP BY vs.vendedor_id
        ORDER BY finalizadas DESC
      `, params);
      porVendedor = vendedores;
    }
    
    // Tiempos promedio
    const [tiempos] = await pool.execute(`
      SELECT 
        AVG(TIMESTAMPDIFF(MINUTE, created_at, autorizado_at)) as promedio_autorizacion,
        AVG(TIMESTAMPDIFF(MINUTE, autorizado_at, asignada_at)) as promedio_toma,
        AVG(TIMESTAMPDIFF(MINUTE, asignada_at, scoring_resuelto_at)) as promedio_scoring
      FROM ventas_scoring
      ${whereClause}
    `, params);
    
    res.json({
      total: total[0].total,
      porEstado: porEstado.reduce((acc, row) => {
        acc[row.estado] = row.cantidad;
        return acc;
      }, {}),
      porVendedor,
      tiemposPromedio: tiempos[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;