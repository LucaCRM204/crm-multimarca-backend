/**
 * ============================================
 * SOCKET SERVER - TIEMPO REAL PARA CRM (MySQL)
 * ============================================
 * Adaptado para tu schema con:
 * - assigned_to (no vendedor)
 * - MySQL con mysql2/promise
 * 
 * NOTA: Reasignación automática DESHABILITADA
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

  // NOTA: Reasignación automática DESHABILITADA
  // startReassignmentChecker(io, pool);

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