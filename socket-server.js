/**
 * ============================================
 * SOCKET SERVER - TIEMPO REAL PARA CRM (MySQL)
 * ============================================
 * Adaptado para tu schema con:
 * - assigned_to (no vendedor)
 * - MySQL con mysql2/promise
 */

const { Server } = require('socket.io');

// Almacenamiento en memoria (en producción podrías usar Redis)
const connectedUsers = new Map(); // Map<socketId, { userId, userName, role, connectedAt }>
const userSessions = new Map();   // Map<userId, Set<socketId>> - un usuario puede tener múltiples tabs
const activityLog = [];           // Array de registros de actividad

/**
 * Inicializa el servidor de WebSockets
 * @param {http.Server} httpServer - Servidor HTTP de Express
 * @param {Pool} pool - Pool de conexiones MySQL (tu db.js)
 */
function initSocketServer(httpServer, pool) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware de autenticación
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Autenticación requerida'));
      }
      
      // Verificar token JWT
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      socket.userId = decoded.id || decoded.userId;
      socket.userName = decoded.name;
      socket.userRole = decoded.role;
      
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, userName, userRole } = socket;
    console.log(`✅ Usuario conectado: ${userName} (ID: ${userId}, Role: ${userRole})`);

    // Registrar conexión
    handleUserConnect(socket, io, pool);

    // ===== EVENTOS DE LEADS =====
    
    // Cuando se crea un nuevo lead
    socket.on('lead:created', (lead) => {
      console.log(`📥 Nuevo lead creado: ${lead.nombre}`);
      socket.broadcast.emit('lead:new', lead);
      
      // Si el lead tiene vendedor asignado, notificarle
      if (lead.assigned_to) {
        emitToUser(io, lead.assigned_to, 'notification', {
          type: 'lead_assigned',
          title: '🎯 Nuevo Lead Asignado',
          message: `Se te ha asignado el lead: ${lead.nombre}`,
          leadId: lead.id,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Cuando se actualiza un lead
    socket.on('lead:updated', (lead) => {
      console.log(`📝 Lead actualizado: ${lead.nombre} (ID: ${lead.id})`);
      socket.broadcast.emit('lead:changed', lead);
    });

    // Cuando se elimina un lead
    socket.on('lead:deleted', (leadId) => {
      console.log(`🗑️ Lead eliminado: ID ${leadId}`);
      socket.broadcast.emit('lead:removed', leadId);
    });

    // Cuando un vendedor acepta un lead
    socket.on('lead:accepted', async ({ leadId, odUserId }) => {
      console.log(`✅ Lead ${leadId} aceptado por usuario ${odUserId}`);
      
      // Cancelar el timer de reasignación si existe
      cancelReassignmentTimer(leadId);
      
      // Actualizar en la BD
      try {
        await pool.execute(`
          UPDATE leads 
          SET accepted_at = NOW(),
              response_time_minutes = TIMESTAMPDIFF(MINUTE, assigned_at, NOW())
          WHERE id = ?
        `, [leadId]);
      } catch (err) {
        console.error('Error actualizando accepted_at:', err);
      }
      
      // Notificar a todos
      io.emit('lead:accepted', { leadId, odUserId, acceptedAt: new Date().toISOString() });
      
      // Registrar actividad
      logActivity(odUserId, 'lead_accepted', { leadId });
    });

    // ===== EVENTOS DE PRESENCIA =====
    
    socket.on('presence:heartbeat', () => {
      updateUserActivity(userId);
    });

    socket.on('presence:active', () => {
      updateUserPresence(socket, io, 'active');
    });

    socket.on('presence:idle', () => {
      updateUserPresence(socket, io, 'idle');
    });

    // ===== EVENTOS DE ALERTAS =====
    
    socket.on('alert:send', ({ targetUserId, alert }) => {
      emitToUser(io, targetUserId, 'alert:received', alert);
    });

    socket.on('alert:broadcast', (alert) => {
      io.emit('alert:received', alert);
    });

    // ===== DESCONEXIÓN =====
    
    socket.on('disconnect', (reason) => {
      console.log(`❌ Usuario desconectado: ${userName} (Razón: ${reason})`);
      handleUserDisconnect(socket, io, pool);
    });
  });

  // Iniciar el sistema de reasignación automática
  startReassignmentChecker(io, pool);

  return io;
}

// ============================================
// FUNCIONES DE PRESENCIA
// ============================================

async function handleUserConnect(socket, io, pool) {
  const { userId, userName, userRole } = socket;
  const now = new Date();

  // Registrar en el mapa de usuarios conectados
  connectedUsers.set(socket.id, {
    odUserId: userId,
    odUserName: userName,
    role: userRole,
    connectedAt: now,
    lastActivity: now,
    status: 'active'
  });

  // Registrar sesión (un usuario puede tener múltiples tabs)
  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  userSessions.get(userId).add(socket.id);

  // Registrar inicio de sesión en la BD para reportes
  await logSessionStart(pool, userId);

  // Registrar actividad
  logActivity(userId, 'connected', { socketId: socket.id });

  // Notificar a todos los demás que este usuario está online
  socket.broadcast.emit('presence:user_online', {
    odUserId: userId,
    odUserName: userName,
    role: userRole,
    status: 'active',
    connectedAt: now.toISOString()
  });

  // Enviar al usuario que se conecta la lista de usuarios online
  socket.emit('presence:users_list', getOnlineUsers());
}

async function handleUserDisconnect(socket, io, pool) {
  const { userId, userName } = socket;
  const userData = connectedUsers.get(socket.id);

  // Remover socket del mapa
  connectedUsers.delete(socket.id);

  // Remover de las sesiones del usuario
  if (userSessions.has(userId)) {
    userSessions.get(userId).delete(socket.id);
    
    // Si no tiene más sesiones activas, está offline
    if (userSessions.get(userId).size === 0) {
      userSessions.delete(userId);
      
      // Registrar fin de sesión para reportes
      if (userData) {
        await logSessionEnd(pool, userId, userData.connectedAt);
      }

      // Notificar a todos que este usuario está offline
      io.emit('presence:user_offline', {
        odUserId: userId,
        odUserName: userName,
        disconnectedAt: new Date().toISOString()
      });

      logActivity(userId, 'disconnected', {});
    }
  }
}

function updateUserPresence(socket, io, status) {
  const userData = connectedUsers.get(socket.id);
  if (userData) {
    userData.status = status;
    userData.lastActivity = new Date();
    
    io.emit('presence:user_status_changed', {
      odUserId: socket.userId,
      status: status,
      lastActivity: userData.lastActivity.toISOString()
    });
  }
}

function updateUserActivity(userId) {
  userSessions.get(userId)?.forEach(socketId => {
    const userData = connectedUsers.get(socketId);
    if (userData) {
      userData.lastActivity = new Date();
    }
  });
}

function getOnlineUsers() {
  const users = new Map();
  
  connectedUsers.forEach((data, socketId) => {
    if (!users.has(data.odUserId) || users.get(data.odUserId).lastActivity < data.lastActivity) {
      users.set(data.odUserId, {
        odUserId: data.odUserId,
        odUserName: data.odUserName,
        role: data.role,
        status: data.status,
        connectedAt: data.connectedAt.toISOString(),
        lastActivity: data.lastActivity.toISOString(),
        sessionsCount: userSessions.get(data.odUserId)?.size || 1
      });
    }
  });

  return Array.from(users.values());
}

// ============================================
// FUNCIONES DE ACTIVIDAD Y REPORTES
// ============================================

function logActivity(userId, action, data) {
  activityLog.push({
    userId,
    action,
    data,
    timestamp: new Date()
  });

  // Limpiar logs viejos (mantener últimas 24 horas)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  while (activityLog.length > 0 && activityLog[0].timestamp < oneDayAgo) {
    activityLog.shift();
  }
}

async function logSessionStart(pool, userId) {
  if (!pool) return;
  
  try {
    await pool.execute(`
      INSERT INTO user_sessions (user_id, session_start, date)
      VALUES (?, NOW(), CURDATE())
    `, [userId]);
  } catch (err) {
    console.error('Error logging session start:', err);
  }
}

async function logSessionEnd(pool, userId, connectedAt) {
  if (!pool) return;
  
  try {
    const durationMinutes = Math.round((Date.now() - connectedAt.getTime()) / 60000);
    
    await pool.execute(`
      UPDATE user_sessions 
      SET session_end = NOW(),
          duration_minutes = ?
      WHERE user_id = ? 
        AND session_end IS NULL
        AND date = CURDATE()
      ORDER BY session_start DESC
      LIMIT 1
    `, [durationMinutes, userId]);
  } catch (err) {
    console.error('Error logging session end:', err);
  }
}

// ============================================
// SISTEMA DE REASIGNACIÓN AUTOMÁTICA
// ============================================

const pendingReassignments = new Map(); // Map<leadId, timeoutId>
const REASSIGNMENT_TIMEOUT_MINUTES = parseInt(process.env.LEAD_TIMEOUT_MINUTES) || 10;

function startReassignmentChecker(io, pool) {
  console.log(`⏰ Checker de reasignación iniciado (timeout: ${REASSIGNMENT_TIMEOUT_MINUTES} min)`);
  
  // Verificar cada minuto si hay leads sin atender
  setInterval(async () => {
    if (!pool) return;
    
    try {
      // Buscar leads asignados hace más de X minutos que no han sido aceptados
      const [unattendedLeads] = await pool.execute(`
        SELECT l.*, u.name as vendedor_nombre
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE l.assigned_to IS NOT NULL
          AND l.estado = 'nuevo'
          AND l.accepted_at IS NULL
          AND l.assigned_at IS NOT NULL
          AND l.assigned_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
          AND l.id NOT IN (
            SELECT lead_id FROM lead_reassignment_log 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
          )
      `, [REASSIGNMENT_TIMEOUT_MINUTES]);

      for (const lead of unattendedLeads) {
        await reassignLead(io, pool, lead);
      }
    } catch (err) {
      console.error('Error en checker de reasignación:', err);
    }
  }, 60000); // Cada minuto
}

async function reassignLead(io, pool, lead) {
  try {
    console.log(`⏰ Reasignando lead ${lead.id} (${lead.nombre}) - No atendido en ${REASSIGNMENT_TIMEOUT_MINUTES} min`);
    
    // Buscar siguiente vendedor disponible
    const nextVendedor = await getNextAvailableVendedor(pool, lead.assigned_to);
    
    if (!nextVendedor) {
      console.log('No hay vendedores disponibles para reasignar');
      
      // Notificar al owner/gerentes
      io.emit('alert:system', {
        type: 'warning',
        title: '⚠️ Lead sin atender',
        message: `El lead ${lead.nombre} lleva más de ${REASSIGNMENT_TIMEOUT_MINUTES} min sin ser atendido y no hay vendedores disponibles`,
        leadId: lead.id,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const previousVendedor = lead.assigned_to;

    // Actualizar el lead en la BD
    await pool.execute(`
      UPDATE leads 
      SET assigned_to = ?,
          assigned_at = NOW(),
          accepted_at = NULL,
          reassignment_count = COALESCE(reassignment_count, 0) + 1
      WHERE id = ?
    `, [nextVendedor.id, lead.id]);

    // Registrar la reasignación
    await pool.execute(`
      INSERT INTO lead_reassignment_log (lead_id, from_user_id, to_user_id, reason)
      VALUES (?, ?, ?, 'timeout_10_min')
    `, [lead.id, previousVendedor, nextVendedor.id]);

    // Notificar al vendedor anterior
    emitToUser(io, previousVendedor, 'notification', {
      type: 'lead_reassigned_away',
      title: '⏰ Lead Reasignado',
      message: `El lead ${lead.nombre} fue reasignado a ${nextVendedor.name} por no responder en ${REASSIGNMENT_TIMEOUT_MINUTES} minutos`,
      leadId: lead.id,
      severity: 'warning',
      timestamp: new Date().toISOString()
    });

    // Notificar al nuevo vendedor
    emitToUser(io, nextVendedor.id, 'notification', {
      type: 'lead_assigned',
      title: '🎯 Nuevo Lead Reasignado',
      message: `Se te reasignó el lead: ${lead.nombre} (el vendedor anterior no respondió)`,
      leadId: lead.id,
      severity: 'high',
      timestamp: new Date().toISOString()
    });

    // Notificar a todos del cambio
    io.emit('lead:reassigned', {
      leadId: lead.id,
      previousVendedor: previousVendedor,
      newVendedor: nextVendedor.id,
      newVendedorName: nextVendedor.name,
      reason: 'timeout',
      timestamp: new Date().toISOString()
    });

    // Obtener el lead actualizado
    const [[updatedLead]] = await pool.execute('SELECT * FROM leads WHERE id = ?', [lead.id]);
    io.emit('lead:changed', updatedLead);

    console.log(`✅ Lead ${lead.id} reasignado de ${previousVendedor} a ${nextVendedor.id}`);

  } catch (err) {
    console.error('Error reasignando lead:', err);
  }
}

async function getNextAvailableVendedor(pool, excludeUserId) {
  // Buscar vendedor con menos leads activos que esté online
  const onlineUserIds = Array.from(userSessions.keys());
  
  if (onlineUserIds.length > 0) {
    // Preferir vendedores que están online
    const placeholders = onlineUserIds.map(() => '?').join(',');
    const [vendors] = await pool.execute(`
      SELECT u.id, u.name, COUNT(l.id) as lead_count
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id AND l.estado NOT IN ('vendido', 'perdido')
      WHERE u.role = 'vendedor' 
        AND u.active = 1
        AND u.id != ?
        AND u.id IN (${placeholders})
      GROUP BY u.id
      ORDER BY lead_count ASC
      LIMIT 1
    `, [excludeUserId, ...onlineUserIds]);

    if (vendors.length > 0) return vendors[0];
  }

  // Si no hay nadie online, buscar cualquier vendedor activo
  const [vendors] = await pool.execute(`
    SELECT u.id, u.name, COUNT(l.id) as lead_count
    FROM users u
    LEFT JOIN leads l ON l.assigned_to = u.id AND l.estado NOT IN ('vendido', 'perdido')
    WHERE u.role = 'vendedor' 
      AND u.active = 1
      AND u.id != ?
    GROUP BY u.id
    ORDER BY lead_count ASC
    LIMIT 1
  `, [excludeUserId]);

  return vendors.length > 0 ? vendors[0] : null;
}

function cancelReassignmentTimer(leadId) {
  if (pendingReassignments.has(leadId)) {
    clearTimeout(pendingReassignments.get(leadId));
    pendingReassignments.delete(leadId);
    console.log(`⏹️ Timer de reasignación cancelado para lead ${leadId}`);
  }
}

// ============================================
// UTILIDADES
// ============================================

function emitToUser(io, userId, event, data) {
  const sockets = userSessions.get(userId);
  if (sockets) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  initSocketServer,
  getOnlineUsers,
  emitToUser
};
