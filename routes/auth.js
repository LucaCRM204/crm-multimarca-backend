// routes/auth.js
// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');         // <- recuerda que cambiamos a bcryptjs
const jwt = require('jsonwebtoken');
const pool = require('../db');              // <- ESTE require
const router = express.Router();


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, useCookie = false } = req.body;
    const [rows] = await pool.query(
      'SELECT id, email, password, role, active FROM users WHERE email=? AND active=1',
      [email]
    );
    if (!rows.length) return res.status(400).json({ error: 'Usuario no encontrado' });

    const user = rows[0];

    // soportal: si las claves están sin hash (demo) permite y las hashéa
    const isHashed = /^\$2[aby]\$/.test(user.password || '');
    let ok = false;
    if (isHashed) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = user.password === password;
      if (ok) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password=? WHERE id=?', [hash, user.id]);
      }
    }
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    if (useCookie) {
      res.cookie('alluma_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 8 * 60 * 60 * 1000,
      });
      return res.json({ user: { id: user.id, email: user.email, role: user.role } });
    }

    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Error en login' });
  }
});

module.exports = router;
