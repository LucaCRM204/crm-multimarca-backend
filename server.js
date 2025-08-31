// server.js
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

// 👉 MONTA las rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));

// Health
app.get('/api/health', (_req, res)=>res.json({ ok:true, ts:new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=>console.log(`Backend escuchando en :${PORT}`));
