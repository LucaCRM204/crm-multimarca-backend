/**
 * ============================================
 * ROUTES/SCORING.JS - MÓDULO DE SCORING (CORREGIDO v2)
 * ============================================
 * Endpoints para gestión de ventas y scoring
 * 
 * CAMBIOS:
 * - Agregado endpoint GET /archivo/:filename para servir PDFs
 * - Validación de duplicados: no permite mismo lead o teléfono dos veces
 * - URL de PDF corregida para usar el nuevo endpoint
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
// ENDPOINT PARA SERVIR ARCHIVOS PDF/IMÁGENES
// ============================================
router.get('/archivo/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;
  
  // Validar que el filename no contenga path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  
  const filePath = path.join('/tmp/scoring', filename);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  
  // Determinar el content-type
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.webp') contentType = 'image/webp';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  
  // Enviar el archivo
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

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
    
    // Obtener info del lead para determinar supervisor y teléfono
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
    const supervisorId = lead.supervisor_id || null;
    
    // =============================================
    // VALIDACIÓN DE DUPLICADOS
    // =============================================
    
    // 1. Verificar si ya existe una venta con este lead_id (que no esté rechazada)
    const [ventaExistenteLead] = await pool.query(`
      SELECT id, estado FROM ventas_scoring 
      WHERE lead_id = ? AND estado != 'rechazada'
      LIMIT 1
    `, [lead_id]);
    
    if (ventaExistenteLead.length > 0) {
      // Si hay archivo subido, eliminarlo
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ 
        error: 'Este lead ya tiene una venta en proceso',
        detalle: `Ya existe una venta para este lead en estado: ${ventaExistenteLead[0].estado}`
      });
    }
    
    // 2. Verificar si ya existe una venta con el mismo teléfono (que no esté rechazada)
    if (lead.phone) {
      // Normalizar teléfono (quitar espacios, guiones, etc.)
      const telefonoNormalizado = lead.phone.replace(/[\s\-\(\)\.]/g, '');
      
      const [ventaExistenteTelefono] = await pool.query(`
        SELECT vs.id, vs.estado, l.nombre as lead_nombre
        FROM ventas_scoring vs
        INNER JOIN leads l ON vs.lead_id = l.id
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
        AND vs.estado != 'rechazada'
        AND vs.lead_id != ?
        LIMIT 1
      `, [telefonoNormalizado, lead_id]);
      
      if (ventaExistenteTelefono.length > 0) {
        // Si hay archivo subido, eliminarlo
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }
        return res.status(400).json({ 
          error: 'Ya existe una venta con este número de teléfono',
          detalle: `El teléfono ${lead.phone} ya está asociado a otra venta (Lead: ${ventaExistenteTelefono[0].lead_nombre}, Estado: ${ventaExistenteTelefono[0].estado})`
        });
      }
    }
    
    // =============================================
    // FIN VALIDACIÓN DE DUPLICADOS
    // =============================================
    
    // URL corregida: usar el endpoint /api/scoring/archivo/
    const pdfUrl = req.file ? `/api/scoring/archivo/${req.file.filename}` : null;
    
    // Crear la venta
    const [result] = await pool.query(`
      INSERT INTO ventas_scoring 
      (lead_id, vendedor_id, supervisor_id, estado, fecha_venta, pdf_url, notas_vendedor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [lead_id, userId, supervisorId, ESTADOS.PENDIENTE_SUPERVISOR, fecha_venta, pdfUrl, notas_vendedor || null]);
    
    const ventaId = result.insertId;
    
    // Crear nota de creación
    await crearNota(pool, ventaId, userId, 'creacion', null, ESTADOS.PENDIENTE_SUPERVISOR, 'Venta creada por vendedor');
    
    // Crear alerta para supervisor
    if (supervisorId) {
      await crearAlerta(pool, ventaId, supervisorId, 'nueva_venta', `Nueva venta pendiente de autorización: ${lead.nombre}`);
      
      // Emitir evento WebSocket
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
// 3. OBTENER DETALLE DE VENTA
// ============================================
router.get('/:id', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  
  try {
    // Obtener venta con información relacionada
    const [ventas] = await pool.query(`
      SELECT v.*, 
             l.nombre as lead_nombre,
             l.phone as lead_telefono,
             l.email as lead_email,
             vend.name as vendedor_nombre,
             sup.name as supervisor_nombre,
             scoring_u.name as scoring_nombre
      FROM ventas_scoring v
      LEFT JOIN leads l ON v.lead_id = l.id
      LEFT JOIN users vend ON v.vendedor_id = vend.id
      LEFT JOIN users sup ON v.supervisor_id = sup.id
      LEFT JOIN users scoring_u ON v.scoring_user_id = scoring_u.id
      WHERE v.id = ?
    `, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar permisos de acceso
    const puedeVer = ROLES_VER_TODO.includes(role) ||
                     role === 'jefe_scoring' ||
                     (role === 'scoring' && venta.scoring_user_id === userId) ||
                     venta.vendedor_id === userId ||
                     venta.supervisor_id === userId;
    
    if (!puedeVer) {
      return res.status(403).json({ error: 'No tenés permiso para ver esta venta' });
    }
    
    // Obtener historial de notas
    const [notas] = await pool.query(`
      SELECT n.*, u.name as usuario_nombre
      FROM scoring_notas n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.venta_id = ?
      ORDER BY n.created_at DESC
    `, [id]);
    
    venta.historial = notas;
    
    res.json(venta);
    
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
  
  if (!ROLES_AUTORIZACION.includes(role)) {
    return res.status(403).json({ error: 'No tenés permiso para autorizar ventas' });
  }
  
  try {
    // Obtener venta
    const [ventas] = await pool.query(`
      SELECT v.*, l.nombre as lead_nombre
      FROM ventas_scoring v
      LEFT JOIN leads l ON v.lead_id = l.id
      WHERE v.id = ?
    `, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar que es supervisor de esta venta o tiene rol superior
    if (!ROLES_VER_TODO.includes(role) && venta.supervisor_id !== userId) {
      return res.status(403).json({ error: 'No sos supervisor de esta venta' });
    }
    
    // Verificar estado
    if (venta.estado !== ESTADOS.PENDIENTE_SUPERVISOR) {
      return res.status(400).json({ error: `No se puede autorizar una venta en estado: ${venta.estado}` });
    }
    
    // Actualizar estado
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, updated_at = NOW()
      WHERE id = ?
    `, [ESTADOS.INGRESADA, id]);
    
    // Crear nota
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.PENDIENTE_SUPERVISOR, ESTADOS.INGRESADA, 'Venta autorizada por supervisor');
    
    // Notificar a jefes de scoring
    const [jefesScoring] = await pool.query(`SELECT id FROM users WHERE role = 'jefe_scoring'`);
    for (const jefe of jefesScoring) {
      await crearAlerta(pool, id, jefe.id, 'nueva_venta', `Nueva venta ingresada: ${venta.lead_nombre}`);
      if (io) {
        io.to(`user_${jefe.id}`).emit('scoring:alerta', {
          tipo: 'nueva_venta',
          ventaId: id,
          mensaje: `Nueva venta ingresada: ${venta.lead_nombre}`
        });
      }
    }
    
    res.json({ ok: true, mensaje: 'Venta autorizada correctamente' });
    
  } catch (error) {
    console.error('Error al autorizar venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 5. RECHAZAR VENTA (Supervisor)
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
  
  if (!motivo) {
    return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
  }
  
  try {
    const [ventas] = await pool.query(`
      SELECT v.*, l.nombre as lead_nombre
      FROM ventas_scoring v
      LEFT JOIN leads l ON v.lead_id = l.id
      WHERE v.id = ?
    `, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (!ROLES_VER_TODO.includes(role) && venta.supervisor_id !== userId) {
      return res.status(403).json({ error: 'No sos supervisor de esta venta' });
    }
    
    if (venta.estado !== ESTADOS.PENDIENTE_SUPERVISOR) {
      return res.status(400).json({ error: `No se puede rechazar una venta en estado: ${venta.estado}` });
    }
    
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, motivo_rechazo = ?, updated_at = NOW()
      WHERE id = ?
    `, [ESTADOS.RECHAZADA, motivo, id]);
    
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.PENDIENTE_SUPERVISOR, ESTADOS.RECHAZADA, `Rechazada por supervisor: ${motivo}`);
    
    // Notificar al vendedor
    await crearAlerta(pool, id, venta.vendedor_id, 'venta_rechazada', `Tu venta fue rechazada: ${motivo}`);
    if (io) {
      io.to(`user_${venta.vendedor_id}`).emit('scoring:alerta', {
        tipo: 'venta_rechazada',
        ventaId: id,
        mensaje: `Tu venta fue rechazada: ${motivo}`
      });
    }
    
    res.json({ ok: true, mensaje: 'Venta rechazada' });
    
  } catch (error) {
    console.error('Error al rechazar venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 6. ASIGNAR A SCORING (Jefe Scoring)
// ============================================
router.post('/:id/asignar', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { scoring_user_id } = req.body;
  
  if (role !== 'jefe_scoring' && role !== 'owner') {
    return res.status(403).json({ error: 'Solo el jefe de scoring puede asignar ventas' });
  }
  
  if (!scoring_user_id) {
    return res.status(400).json({ error: 'Debe especificar el usuario de scoring' });
  }
  
  try {
    const [ventas] = await pool.query(`
      SELECT v.*, l.nombre as lead_nombre
      FROM ventas_scoring v
      LEFT JOIN leads l ON v.lead_id = l.id
      WHERE v.id = ?
    `, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.estado !== ESTADOS.INGRESADA) {
      return res.status(400).json({ error: `No se puede asignar una venta en estado: ${venta.estado}` });
    }
    
    // Verificar que el usuario destino es de scoring
    const [scoringUser] = await pool.query(`SELECT id, name FROM users WHERE id = ? AND role IN ('scoring', 'jefe_scoring')`, [scoring_user_id]);
    if (scoringUser.length === 0) {
      return res.status(400).json({ error: 'El usuario seleccionado no es del área de scoring' });
    }
    
    await pool.query(`
      UPDATE ventas_scoring 
      SET estado = ?, scoring_user_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [ESTADOS.ASIGNADA, scoring_user_id, id]);
    
    await crearNota(pool, id, userId, 'cambio_estado', ESTADOS.INGRESADA, ESTADOS.ASIGNADA, `Asignada a ${scoringUser[0].name}`);
    
    // Notificar al usuario de scoring
    await crearAlerta(pool, id, scoring_user_id, 'venta_asignada', `Se te asignó una venta: ${venta.lead_nombre}`);
    if (io) {
      io.to(`user_${scoring_user_id}`).emit('scoring:alerta', {
        tipo: 'venta_asignada',
        ventaId: id,
        mensaje: `Se te asignó una venta: ${venta.lead_nombre}`
      });
    }
    
    res.json({ ok: true, mensaje: 'Venta asignada correctamente' });
    
  } catch (error) {
    console.error('Error al asignar venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 7. CAMBIAR ESTADO (Scoring)
// ============================================
router.post('/:id/estado', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const io = req.app.get('io');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { nuevo_estado, motivo, notas } = req.body;
  
  try {
    const [ventas] = await pool.query(`
      SELECT v.*, l.nombre as lead_nombre
      FROM ventas_scoring v
      LEFT JOIN leads l ON v.lead_id = l.id
      WHERE v.id = ?
    `, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    const estadoActual = venta.estado;
    
    // Verificar permisos según el nuevo estado
    if ([ESTADOS.EN_PROCESO, ESTADOS.OBSERVADA, ESTADOS.RECHAZADA, ESTADOS.PENDIENTE_PAGO].includes(nuevo_estado)) {
      if (!ROLES_SCORING.includes(role) && !ROLES_VER_TODO.includes(role)) {
        return res.status(403).json({ error: 'No tenés permiso para este cambio de estado' });
      }
      // Verificar que es el scoring asignado
      if (role === 'scoring' && venta.scoring_user_id !== userId) {
        return res.status(403).json({ error: 'No estás asignado a esta venta' });
      }
    } else if ([ESTADOS.SENA, ESTADOS.FINALIZADA].includes(nuevo_estado)) {
      if (!ROLES_COBRANZA.includes(role) && !ROLES_VER_TODO.includes(role)) {
        return res.status(403).json({ error: 'Solo cobranza puede cambiar a este estado' });
      }
    }
    
    // Verificar transición permitida
    const transicionesPermitidas = TRANSICIONES_PERMITIDAS[estadoActual] || [];
    if (!transicionesPermitidas.includes(nuevo_estado)) {
      return res.status(400).json({ 
        error: `No se puede pasar de ${estadoActual} a ${nuevo_estado}`,
        transiciones_permitidas: transicionesPermitidas
      });
    }
    
    // Validaciones específicas
    if (nuevo_estado === ESTADOS.RECHAZADA && !motivo) {
      return res.status(400).json({ error: 'El motivo de rechazo es obligatorio' });
    }
    if (nuevo_estado === ESTADOS.OBSERVADA && !motivo) {
      return res.status(400).json({ error: 'El motivo de observación es obligatorio' });
    }
    
    // Actualizar estado
    const updateFields = ['estado = ?', 'updated_at = NOW()'];
    const updateValues = [nuevo_estado];
    
    if (motivo) {
      if (nuevo_estado === ESTADOS.RECHAZADA) {
        updateFields.push('motivo_rechazo = ?');
      } else if (nuevo_estado === ESTADOS.OBSERVADA) {
        updateFields.push('motivo_observacion = ?');
      }
      updateValues.push(motivo);
    }
    
    updateValues.push(id);
    
    await pool.query(`UPDATE ventas_scoring SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    
    // Crear nota
    const mensajeNota = motivo ? `${nuevo_estado}: ${motivo}` : `Cambio a ${nuevo_estado}`;
    await crearNota(pool, id, userId, 'cambio_estado', estadoActual, nuevo_estado, notas || mensajeNota);
    
    // Notificaciones según el nuevo estado
    if (nuevo_estado === ESTADOS.RECHAZADA) {
      // Notificar a vendedor y supervisor
      await crearAlerta(pool, id, venta.vendedor_id, 'venta_rechazada', `Venta rechazada: ${motivo}`);
      if (venta.supervisor_id) {
        await crearAlerta(pool, id, venta.supervisor_id, 'venta_rechazada', `Venta rechazada: ${motivo}`);
      }
    } else if (nuevo_estado === ESTADOS.OBSERVADA) {
      await crearAlerta(pool, id, venta.vendedor_id, 'venta_observada', `Venta observada: ${motivo}`);
      if (venta.supervisor_id) {
        await crearAlerta(pool, id, venta.supervisor_id, 'venta_observada', `Venta observada: ${motivo}`);
      }
    } else if (nuevo_estado === ESTADOS.PENDIENTE_PAGO) {
      // Notificar a cobranza
      const [cobranzaUsers] = await pool.query(`SELECT id FROM users WHERE role = 'cobranza'`);
      for (const user of cobranzaUsers) {
        await crearAlerta(pool, id, user.id, 'pendiente_pago', `Nueva venta pendiente de pago: ${venta.lead_nombre}`);
      }
    } else if (nuevo_estado === ESTADOS.FINALIZADA) {
      await crearAlerta(pool, id, venta.vendedor_id, 'venta_finalizada', `¡Felicitaciones! Tu venta fue finalizada: ${venta.lead_nombre}`);
    }
    
    res.json({ ok: true, mensaje: `Estado actualizado a: ${nuevo_estado}` });
    
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 8. AGREGAR NOTA (Cualquier usuario involucrado)
// ============================================
router.post('/:id/notas', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { mensaje, visible_para } = req.body;
  
  if (!mensaje) {
    return res.status(400).json({ error: 'El mensaje es obligatorio' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    // Verificar que el usuario está involucrado
    const involucrado = ROLES_VER_TODO.includes(role) ||
                        role === 'jefe_scoring' ||
                        venta.vendedor_id === userId ||
                        venta.supervisor_id === userId ||
                        venta.scoring_user_id === userId;
    
    if (!involucrado) {
      return res.status(403).json({ error: 'No tenés permiso para agregar notas a esta venta' });
    }
    
    await crearNota(pool, id, userId, 'nota', venta.estado, venta.estado, mensaje, visible_para);
    
    res.json({ ok: true, mensaje: 'Nota agregada correctamente' });
    
  } catch (error) {
    console.error('Error al agregar nota:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 9. SUBIR DOCUMENTO ADICIONAL
// ============================================
router.post('/:id/documentos', authMiddleware, upload.single('documento'), async (req, res) => {
  const pool = req.app.get('db');
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { tipo_documento } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Debe subir un archivo' });
  }
  
  try {
    const [ventas] = await pool.query(`SELECT * FROM ventas_scoring WHERE id = ?`, [id]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    // URL corregida
    const documentoUrl = `/api/scoring/archivo/${req.file.filename}`;
    
    await pool.query(`
      INSERT INTO scoring_documentos (venta_id, user_id, tipo, url, nombre_original)
      VALUES (?, ?, ?, ?, ?)
    `, [id, userId, tipo_documento || 'otro', documentoUrl, req.file.originalname]);
    
    await crearNota(pool, id, userId, 'documento', null, null, `Documento subido: ${req.file.originalname}`);
    
    res.json({ ok: true, mensaje: 'Documento subido correctamente', url: documentoUrl });
    
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 10. OBTENER ALERTAS DEL USUARIO
// ============================================
router.get('/alertas/mis-alertas', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { id: userId } = req.user;
  
  try {
    const [alertas] = await pool.query(`
      SELECT a.*, l.nombre as lead_nombre
      FROM scoring_alertas a
      LEFT JOIN ventas_scoring v ON a.venta_id = v.id
      LEFT JOIN leads l ON v.lead_id = l.id
      WHERE a.user_id = ? AND a.leida = FALSE
      ORDER BY a.created_at DESC
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
      SET leida = TRUE, fecha_leida = NOW()
      WHERE id = ? AND user_id = ?
    `, [alertaId, userId]);
    
    res.json({ ok: true });
    
  } catch (error) {
    console.error('Error al marcar alerta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 12. VERIFICAR DUPLICADO (para frontend)
// ============================================
router.get('/verificar-duplicado/:leadId', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { leadId } = req.params;
  
  try {
    // Obtener datos del lead
    const [leadRows] = await pool.query(`SELECT * FROM leads WHERE id = ?`, [leadId]);
    
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    
    const lead = leadRows[0];
    
    // Verificar por lead_id
    const [ventaExistenteLead] = await pool.query(`
      SELECT id, estado FROM ventas_scoring 
      WHERE lead_id = ? AND estado != 'rechazada'
      LIMIT 1
    `, [leadId]);
    
    if (ventaExistenteLead.length > 0) {
      return res.json({
        duplicado: true,
        tipo: 'lead',
        mensaje: `Este lead ya tiene una venta en estado: ${ventaExistenteLead[0].estado}`
      });
    }
    
    // Verificar por teléfono
    if (lead.phone) {
      const telefonoNormalizado = lead.phone.replace(/[\s\-\(\)\.]/g, '');
      
      const [ventaExistenteTelefono] = await pool.query(`
        SELECT vs.id, vs.estado, l.nombre as lead_nombre
        FROM ventas_scoring vs
        INNER JOIN leads l ON vs.lead_id = l.id
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(l.phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
        AND vs.estado != 'rechazada'
        AND vs.lead_id != ?
        LIMIT 1
      `, [telefonoNormalizado, leadId]);
      
      if (ventaExistenteTelefono.length > 0) {
        return res.json({
          duplicado: true,
          tipo: 'telefono',
          mensaje: `El teléfono ${lead.phone} ya está asociado a otra venta (Lead: ${ventaExistenteTelefono[0].lead_nombre})`
        });
      }
    }
    
    res.json({ duplicado: false });
    
  } catch (error) {
    console.error('Error al verificar duplicado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// 13. ESTADÍSTICAS
// ============================================
router.get('/estadisticas/resumen', authMiddleware, async (req, res) => {
  const pool = req.app.get('db');
  const { role } = req.user;
  
  if (!ROLES_VER_TODO.includes(role) && role !== 'jefe_scoring') {
    return res.status(403).json({ error: 'No tenés permiso para ver estadísticas' });
  }
  
  try {
    // Estadísticas por estado
    const [estadoStats] = await pool.query(`
      SELECT estado, COUNT(*) as cantidad
      FROM ventas_scoring
      GROUP BY estado
    `);
    
    // Tiempos promedio
    const [tiempoStats] = await pool.query(`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as tiempo_promedio_horas,
        COUNT(*) as total_ventas
      FROM ventas_scoring
      WHERE estado IN ('finalizada', 'cargada_concesionario')
    `);
    
    // Top vendedores
    let topVendedores = [];
    if (ROLES_VER_TODO.includes(role)) {
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