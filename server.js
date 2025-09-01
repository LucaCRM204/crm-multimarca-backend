// server.js — limpio y sin duplicados
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// ===== Routers propios =====
const authRouter  = require('./routes/auth');
const leadsRouter = require('./routes/leads');
let usersRouter;
try {
  usersRouter = require('./routes/users'); // si no existe, no rompe
} catch (e) {
  usersRouter = null;
}

// ===== Zapier / Meta webhook =====
const metaWebhookRouter = require('./integrations/zapier/metaWebhookRelay');

const app = express();

// Seguridad y parsers
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// CORS
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

// ===== Rutas del CRM =====
app.use('/api/auth',  authRouter);
app.use('/auth',      authRouter);

app.use('/api/leads', leadsRouter);
app.use('/leads',     leadsRouter);

if (usersRouter) {
  app.use('/api/users', usersRouter);
  app.use('/users',     usersRouter);
}

// ===== Webhook Meta (Zapier) =====
app.use('/meta', metaWebhookRouter);

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/health',     (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ===== Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend escuchando en :${PORT}`));
