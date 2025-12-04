/**
 * ============================================
 * SERVER.JS CON WEBSOCKETS + SCORING - CRM Alluma
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
const scoringRouter = require('./routes/scoring'); // ← NUEVO: Scoring

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

// ← NUEVO: Servir archivos estáticos (PDFs de scoring)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas principales
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/presupuestos', require('./routes/presupuestos'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/activity', activityRouter);
app.use('/api/scoring', scoringRouter); // ← NUEVO: Rutas de scoring
if (usersRouter) app.use('/api/users', usersRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Ruta raíz
app.get('/', (_req, res) => res.json({ 
  message: 'Alluma CRM Backend API', 
  version: '2.1.0',
  features: ['realtime', 'presence', 'activity-tracking', 'auto-reassignment', 'scoring']
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
  console.log(`🔄 Reasignación automática activa (${process.env.LEAD_TIMEOUT_MINUTES || 10} min)\n`);
});