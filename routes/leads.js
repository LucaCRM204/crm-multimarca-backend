const express = require('express');
const router = express.Router();

// Intentar importar intakeAuth (si no existe, usar dummy)
let intakeAuth;
try {
  intakeAuth = require('../middleware/intakeAuth');
} catch (e) {
  console.warn('[warn] intakeAuth middleware no encontrado, se usará dummy');
  intakeAuth = (req, res, next) => next();
}

// ===== Ejemplo de rutas =====

// GET /leads
router.get('/', intakeAuth, async (req, res) => {
  try {
    // lógica para listar leads
    res.json({ ok: true, leads: [] });
  } catch (err) {
    console.error('Error GET /leads:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /leads
router.post('/', intakeAuth, async (req, res) => {
  try {
    const data = req.body;
    // lógica para guardar lead
    res.status(201).json({ ok: true, lead: data });
  } catch (err) {
    console.error('Error POST /leads:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
