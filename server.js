// server.js — consolidado y sin duplicados
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();
import './integrations/zapier/metaWebhookRelay.js';

const app = express();

// Seguridad y parsers
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// CORS
const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

// ===== Importar routers UNA SOLA VEZ =====
const authRouter  = require('./routes/auth');
const leadsRouter = require('./routes/leads');
let usersRouter;
try {
  usersRouter = require('./routes/users'); // si aún no existe, el try-catch evita crashear
} catch (e) {
  usersRouter = null;
}

// ===== Montar con y sin /api (Vercel quita /api en el rewrite) =====
app.use('/api/auth',  authRouter);
app.use('/auth',      authRouter);

app.use('/api/leads', leadsRouter);
app.use('/leads',     leadsRouter);

if (usersRouter) {
  app.use('/api/users', usersRouter);
  app.use('/users',     usersRouter);
}

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/health',     (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend escuchando en :${PORT}`));
