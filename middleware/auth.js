/**
 * ============================================
 * AUTH MIDDLEWARE
 * ============================================
 * Middleware para autenticar y autorizar usuarios
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar token JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(403).json({ ok: false, error: 'Token inválido o expirado' });
  }
};

/**
 * Middleware para verificar roles
 * @param {string[]} allowedRoles - Roles permitidos
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        ok: false, 
        error: 'No tienes permisos para esta acción',
        requiredRoles: allowedRoles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware para verificar que es el owner o tiene rol específico
 */
const requireOwnerOrRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'No autenticado' });
    }

    // El owner siempre puede
    if (req.user.role === 'owner') {
      return next();
    }

    // Verificar roles permitidos
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ 
      ok: false, 
      error: 'No tienes permisos para esta acción'
    });
  };
};

/**
 * Middleware para verificar que el usuario accede a sus propios recursos
 * o tiene rol de supervisor/gerente/etc
 */
const requireSelfOrSupervisor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }

  const targetUserId = parseInt(req.params.userId || req.params.id);
  
  // Es su propio recurso
  if (req.user.id === targetUserId) {
    return next();
  }

  // Es supervisor o superior
  const supervisorRoles = ['owner', 'director', 'gerente', 'supervisor'];
  if (supervisorRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ 
    ok: false, 
    error: 'Solo puedes acceder a tus propios recursos'
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnerOrRole,
  requireSelfOrSupervisor
};
