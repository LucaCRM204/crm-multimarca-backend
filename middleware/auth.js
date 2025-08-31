const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Rate limiting por endpoint
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limits específicos
const authLimiter = createRateLimit(15 * 60 * 1000, 5, 'Demasiados intentos de login, intenta en 15 minutos');
const apiLimiter = createRateLimit(15 * 60 * 1000, 100, 'Demasiadas peticiones, intenta en 15 minutos');

// Middleware de autenticación con logging
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log de actividad
    console.log(`User ${decoded.email} accessing ${req.method} ${req.path}`);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(403).json({ error: 'Token inválido' });
  }
};

module.exports = { authenticateToken, authLimiter, apiLimiter };