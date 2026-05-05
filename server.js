/**
 * ============================================
 * SERVER.JS CON WEBSOCKETS + SCORING + METAS - CRM Alluma
 * ============================================
 */
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Importar socket server
const { initSocketServer } = require('./socket-server');

// Importar pool de MySQL
const pool = require('./db');

// Importar rutas
const authRouter = require('./routes/auth');
const leadsRouter = require('./routes/leads');
const activityRouter = require('./routes/activity');
const scoringRouter = require('./routes/scoring');
const metasRouter = require('./routes/metas'); // ← NUEVO: Metas
const whatsappRouter = require('./routes/whatsapp'); // ← WhatsApp Chat

let usersRouter;
try { 
  usersRouter = require('./routes/users'); 
} catch (_) { 
  usersRouter = null; 
}

const app = express();
const server = http.createServer(app);

// Guardar pool en app para usar en rutas
app.set('db', pool);

// Proxy (necesario para cookie Secure detrás de Railway)
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// CORS configuration
const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOpts = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOpts));
app.options('*', cors(corsOpts));

// Servir archivos estáticos (PDFs de scoring)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas principales
app.use('/api/auth', authRouter);

// Middleware: auto-emit socket events on lead changes
app.use('/api/leads', (req, res, next) => {
  if (req.method === 'GET') return next();
  
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const io = req.app.get('io');
    if (!io) return originalJson(data);

    try {
      // POST /api/leads (solo creación, no búsqueda)
      if (req.method === 'POST' && req.path === '/' && data?.lead && !data?.leads) {
        io.emit('lead:created', data.lead);
        console.log(`📡 [RT] lead:created #${data.lead.id}`);
      }
      
      // PUT/PATCH → lead:updated
      if ((req.method === 'PUT' || req.method === 'PATCH') && data?.lead) {
        io.emit('lead:updated', data.lead);
        console.log(`📡 [RT] lead:updated #${data.lead.id} (${req.method} ${req.path})`);
      }

      // DELETE → lead:deleted
      if (req.method === 'DELETE' && req.path.match(/^\/\d+$/)) {
        const leadId = parseInt(req.path.replace('/', ''));
        io.emit('lead:deleted', leadId);
        console.log(`📡 [RT] lead:deleted #${leadId}`);
      }

      // Notificación al asignado
      if (req.method === 'POST' && data?.lead?.assigned_to) {
        io.emit('notification', {
          id: `lead-${data.lead.id}-${Date.now()}`,
          type: 'lead_created',
          title: 'Nuevo lead asignado',
          message: `${data.lead.nombre || 'Lead nuevo'} - ${data.lead.modelo || 'Sin modelo'}`,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'info',
          leadId: data.lead.id,
          targetUserId: data.lead.assigned_to
        });
      }
    } catch (err) {
      console.error('Socket emit error:', err.message);
    }

    return originalJson(data);
  };

  next();
});

app.use('/api/leads', leadsRouter);
app.use('/api/presupuestos', require('./routes/presupuestos'));
// Middleware: auto-emit on webhook lead creation
app.use('/api/webhooks', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const io = req.app.get('io');
    if (io && req.method === 'POST' && data?.lead) {
      io.emit('lead:created', data.lead);
      console.log(`📡 [RT] lead:created via webhook #${data.lead.id}`);
    }
    return originalJson(data);
  };
  next();
});
app.use('/api/webhooks', require('./routes/webhooks'));
// app.use('/api/ruleta-stats', require('./routes/ruleta-stats')); // DESHABILITADO: archivo no existe en el repo
app.use('/api/activity', activityRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/metas', metasRouter(pool)); // ← NUEVO: Rutas de metas
app.use('/api/whatsapp', whatsappRouter(pool)); // ← WhatsApp Chat
app.use('/api/distribution', require('./routes/distribution')); // ← Distribución de leads
app.use('/api/calls', require('./routes/calls')); // ← Registro de llamadas
if (usersRouter) app.use('/api/users', usersRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Ruta raíz
app.get('/', (_req, res) => res.json({ 
  message: 'Alluma CRM Backend API', 
  version: '2.2.0',
  features: ['realtime', 'presence', 'activity-tracking', 'auto-reassignment', 'scoring', 'metas', 'whatsapp-chat']
}));

// Inicializar WebSockets
const io = initSocketServer(server, pool);
app.set('io', io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n🚀 Backend escuchando en puerto ${PORT}`);
  console.log(`⚡ WebSockets habilitados`);
  console.log(`📊 Reportes de actividad disponibles`);
  console.log(`📋 Módulo de Scoring activo`);
  console.log(`🎯 Módulo de Metas activo`);
  console.log(`💬 WhatsApp Chat activo\n`);
});