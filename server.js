const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const authRouter  = require('./routes/auth');
const leadsRouter = require('./routes/leads');
const usersRouter = require('./routes/users');   // <— NUEVO

// Con /api (llamados directos)
app.use('/api/auth',  authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/users', usersRouter);              // <— NUEVO

// Sin /api (porque Vercel quita /api en el rewrite)
app.use('/auth',  authRouter);
app.use('/leads', leadsRouter);
app.use('/users', usersRouter);                  // <— NUEVO

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

// ===== Rutas =====
const authRouter  = require('./routes/auth');
const leadsRouter = require('./routes/leads');

// Con prefijo /api (por si en algún momento llamás directo)
app.use('/api/auth',  authRouter);
app.use('/api/leads', leadsRouter);

// SIN prefijo /api (para el rewrite de Vercel que quita /api)
app.use('/auth',  authRouter);
app.use('/leads', leadsRouter);

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/health',     (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend escuchando en :${PORT}`));
