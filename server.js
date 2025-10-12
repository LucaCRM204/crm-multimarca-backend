const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const authRouter = require('./routes/auth');
const leadsRouter = require('./routes/leads');
let usersRouter;
try { 
  usersRouter = require('./routes/users'); 
} catch (_) { 
  usersRouter = null; 
}

const app = express();

// Proxy (necesario para cookie Secure detrás de Railway)
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

const origins = (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean);
const corsOpts = {
  origin: true, // Permite todos los orígenes temporalmente
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token','Accept'],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOpts));
app.options('*', cors(corsOpts));

// Rutas principales
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/presupuestos', require('./routes/presupuestos'));
app.use('/api/webhooks', require('./routes/webhooks'));
if (usersRouter) app.use('/api/users', usersRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Ruta raíz
app.get('/', (_req, res) => res.json({ message: 'Alluma CRM Backend API', version: '1.0.0' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend escuchando en :${PORT}`));