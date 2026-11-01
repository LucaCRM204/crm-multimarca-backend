// backend/routes/ownerMarcas.js
// Sección "Marcas por vendedor" — solo owner/dueño.
// Montado en server.js:  app.use('/api/owner/marcas-vendedores', require('./routes/ownerMarcas'));

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { MARCAS, MARCA_IDS, getConfigMarcas } = require('../services/marcasVendedor');

const router = express.Router();

const ROLES_OWNER = ['owner', 'dueño'];
// Solo 'vendedor': es el único rol que entra en las ruedas (getVendedoresDeEquipo)
const ROLES_VENDEDOR = ['vendedor'];

// Auth propia: valida el JWT (mismo que manda el front en Authorization)
// y chequea el rol contra la base, no contra el token.
async function requireOwner(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : (req.cookies?.token || null);
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Sesión inválida o vencida' });
    }

    const userId = payload.id ?? payload.userId ?? payload.sub ?? payload.user?.id;
    if (!userId) return res.status(401).json({ error: 'Token sin usuario' });

    const [rows] = await pool.execute('SELECT id, role, active FROM users WHERE id = ?', [userId]);
    const u = rows[0];
    if (!u || !Number(u.active) || !ROLES_OWNER.includes(String(u.role).toLowerCase())) {
      return res.status(403).json({ error: 'Solo el owner puede acceder a esta sección' });
    }

    req.user = { id: u.id, role: u.role };
    next();
  } catch (err) {
    console.error('[ownerMarcas] auth', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

router.use(requireOwner);

// GET -> marcas disponibles + vendedores con su config
router.get('/', async (req, res) => {
  try {
    const [vendedores] = await pool.query(
      `SELECT u.id, u.name AS nombre, u.role AS rol, u.active AS activo,
              u.recibe_leads, l.name AS equipo
         FROM users u
         LEFT JOIN users l ON l.id = u.reportsTo
        WHERE LOWER(u.role) IN (?)
        ORDER BY u.active DESC, l.name ASC, u.name ASC`,
      [ROLES_VENDEDOR]
    );

    const config = await getConfigMarcas();

    res.json({
      marcas: MARCAS,
      vendedores: vendedores.map(v => ({
        id: v.id,
        nombre: v.nombre,
        rol: v.rol,
        equipo: v.equipo || null,
        activo: !!Number(v.activo),
        recibeLeads: !!Number(v.recibe_leads),
        marcas: config.has(Number(v.id)) ? config.get(Number(v.id)) : null, // null = todas
      })),
    });
  } catch (err) {
    console.error('[ownerMarcas] GET', err);
    res.status(500).json({ error: 'No se pudo cargar la configuración' });
  }
});

// PUT -> guardado en bloque
// body: { cambios: [{ id: 12, marcas: ['fiat','chinos'] }, { id: 15, marcas: null }] }
router.put('/', async (req, res) => {
  const cambios = req.body?.cambios;
  if (!Array.isArray(cambios) || cambios.length === 0) {
    return res.status(400).json({ error: 'No hay cambios para guardar' });
  }

  for (const c of cambios) {
    if (!Number.isInteger(Number(c.id))) {
      return res.status(400).json({ error: `ID de vendedor inválido: ${c.id}` });
    }
    if (c.marcas !== null) {
      if (!Array.isArray(c.marcas) || c.marcas.some(m => !MARCA_IDS.has(m))) {
        return res.status(400).json({ error: `Marcas inválidas para el vendedor ${c.id}` });
      }
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const c of cambios) {
      const id = Number(c.id);
      if (c.marcas === null) {
        await conn.query('DELETE FROM vendedor_marcas WHERE usuario_id = ?', [id]);
      } else {
        const unicas = [...new Set(c.marcas)];
        await conn.query(
          `INSERT INTO vendedor_marcas (usuario_id, marcas, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE marcas = VALUES(marcas), updated_by = VALUES(updated_by)`,
          [id, JSON.stringify(unicas), req.user.id]
        );
      }
    }

    await conn.commit();
    console.log(`🏷️ [Marcas por vendedor] ${req.user.id} actualizó ${cambios.length} vendedor(es)`);
    res.json({ ok: true, guardados: cambios.length });
  } catch (err) {
    await conn.rollback();
    console.error('[ownerMarcas] PUT', err);
    res.status(500).json({ error: 'No se pudieron guardar los cambios' });
  } finally {
    conn.release();
  }
});

module.exports = router;
