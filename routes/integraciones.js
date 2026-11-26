'use strict';

/**
 * Integraciones de fuentes externas (Emanuel y futuras).
 * Una fuente carga leads con un botón (estilo "Enviar a Pilot") y el owner conecta
 * cada destino a un equipo desde el panel. Las tablas se crean solas al arrancar.
 *
 * Montaje (server.js):
 *   app.use('/api/integraciones', require('./routes/integraciones')({ pool, requireAdmin: [authenticateToken, requireRole(['owner'])] }));
 *
 * Endpoints públicos (para la fuente, con header x-api-key):
 *   POST /api/integraciones/in/:slug             → carga un lead
 *   GET  /api/integraciones/in/:slug/destinos    → destinos activos (para armar su dropdown)
 *
 * Endpoints de administración (panel del CRM, protegidos con requireAdmin):
 *   GET    /admin/fuentes
 *   POST   /admin/fuentes                        { nombre, slug }  → devuelve api_key UNA vez
 *   PUT    /admin/fuentes/:id                      { nombre?, activo?, destino_default_id? }
 *   POST   /admin/fuentes/:id/regenerar-key      → devuelve api_key nueva UNA vez
 *   POST   /admin/fuentes/:id/destinos           { codigo, nombre, equipo_id }
 *   PUT    /admin/destinos/:id                    { nombre?, equipo_id?, activo? }
 *   DELETE /admin/destinos/:id
 *   GET    /admin/equipos
 *   GET    /admin/envios?fuente_id=&limit=
 */

const express = require('express');
const crypto = require('crypto');
const adapter = require('../services/integracionesAdapter');

let rateLimit = null;
try {
  rateLimit = require('express-rate-limit');
} catch {
  rateLimit = null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS integraciones_fuentes (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    slug                VARCHAR(50)  NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    api_key_hash        CHAR(64)     NOT NULL,
    api_key_prefix      VARCHAR(12)  NOT NULL,
    destino_default_id  INT          NULL,
    activo              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_fuente_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS integraciones_destinos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    fuente_id   INT          NOT NULL,
    codigo      VARCHAR(50)  NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    equipo_id   INT          NULL,
    activo      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_destino_fuente_codigo (fuente_id, codigo),
    CONSTRAINT fk_destino_fuente FOREIGN KEY (fuente_id)
      REFERENCES integraciones_fuentes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS integraciones_envios (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    fuente_id    INT          NOT NULL,
    destino_id   INT          NULL,
    ref_externa  VARCHAR(100) NULL,
    ref_ok       VARCHAR(100) NULL,
    telefono     VARCHAR(20)  NULL,
    nombre       VARCHAR(150) NULL,
    lead_id      INT          NULL,
    estado       ENUM('procesando','ok','duplicado','rechazado','error','prueba') NOT NULL,
    error        VARCHAR(255) NULL,
    payload      JSON         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_envio_ref_ok (fuente_id, ref_ok),
    KEY idx_envio_fuente_fecha (fuente_id, created_at),
    KEY idx_envio_fuente_tel (fuente_id, telefono, estado)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const DEDUPE_DIAS = Number(process.env.INTEGRACIONES_DEDUPE_DIAS ?? 30);
const SLUG_RE = /^[a-z0-9-]{2,50}$/;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const nuevaKey = () => 'ik_' + crypto.randomBytes(24).toString('hex');

function hashIgual(aHex, bHex) {
  const a = Buffer.from(String(aHex), 'hex');
  const b = Buffer.from(String(bHex), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function txt(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s.length ? s : null;
}

function urlSegura(v) {
  const s = txt(v, 1000);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Normaliza un celular argentino a 549 + área + número (13 dígitos). */
function normalizarTelefono(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);

  if (d.startsWith('549')) {
    // ok
  } else if (d.startsWith('54')) {
    d = '549' + d.slice(2);
  } else {
    if (d.startsWith('0')) d = d.slice(1);
    d = '549' + d;
  }

  // Quitar el "15" después del código de área (área de 2 a 4 dígitos).
  if (d.length === 15) {
    for (const largoArea of [2, 3, 4]) {
      const pos = 3 + largoArea;
      if (d.slice(pos, pos + 2) === '15') {
        d = d.slice(0, pos) + d.slice(pos + 2);
        break;
      }
    }
  }

  return d.length === 13 ? d : null;
}

function asArray(mw) {
  if (!mw) return [];
  return Array.isArray(mw) ? mw : [mw];
}

module.exports = function integracionesRouter({ pool, requireAdmin }) {
  if (!pool) throw new Error('integraciones: falta pool');
  if (!requireAdmin) throw new Error('integraciones: falta requireAdmin (no expongas el panel sin auth)');

  const router = express.Router();
  const json = express.json({ limit: '200kb' });

  // Crea las tablas una sola vez; si falla (DB caída) reintenta en el próximo request.
  let schemaListo = null;
  function asegurarSchema() {
    if (!schemaListo) {
      schemaListo = (async () => {
        for (const sql of SCHEMA) await pool.query(sql);
      })().catch((err) => {
        schemaListo = null;
        throw err;
      });
    }
    return schemaListo;
  }
  asegurarSchema().catch((err) => console.error('[integraciones] schema:', err.message));
  router.use((req, res, next) => {
    asegurarSchema().then(() => next(), (err) => {
      console.error('[integraciones] schema:', err.message);
      res.status(503).json({ ok: false, error: 'no_disponible' });
    });
  });

  // Límite por IP en los endpoints públicos (evita fuerza bruta de keys).
  const limiteFuente = rateLimit
    ? rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false })
    : (_req, _res, next) => next();

  // ───────────────────────── helpers DB ─────────────────────────

  async function autenticarFuente(req) {
    const key = req.get('x-api-key') || '';
    const slug = String(req.params.slug || '');
    if (!key || !SLUG_RE.test(slug)) return null;
    const [rows] = await pool.query('SELECT * FROM integraciones_fuentes WHERE slug = ? LIMIT 1', [slug]);
    const f = rows[0];
    if (!f || !f.activo) return null;
    return hashIgual(sha256(key), f.api_key_hash) ? f : null;
  }

  async function registrar(fuenteId, datos) {
    const [r] = await pool.query(
      `INSERT INTO integraciones_envios
         (fuente_id, destino_id, ref_externa, ref_ok, telefono, nombre, lead_id, estado, error, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fuenteId,
        datos.destino_id ?? null,
        datos.ref_externa ?? null,
        datos.ref_ok ?? null,
        datos.telefono ?? null,
        datos.nombre ?? null,
        datos.lead_id ?? null,
        datos.estado,
        datos.error ? String(datos.error).slice(0, 255) : null,
        datos.payload ? JSON.stringify(datos.payload) : null,
      ]
    );
    return r.insertId;
  }

  async function destinosActivos(fuenteId) {
    const [rows] = await pool.query(
      `SELECT codigo, nombre FROM integraciones_destinos
        WHERE fuente_id = ? AND activo = 1 AND equipo_id IS NOT NULL
        ORDER BY nombre`,
      [fuenteId]
    );
    return rows;
  }

  // ───────────────────────── públicos (fuente) ─────────────────────────

  router.get('/in/:slug/destinos', limiteFuente, async (req, res) => {
    try {
      const fuente = await autenticarFuente(req);
      if (!fuente) return res.status(401).json({ ok: false, error: 'no_autorizado' });
      res.json({ ok: true, destinos: await destinosActivos(fuente.id) });
    } catch (err) {
      console.error('[integraciones] destinos', err);
      res.status(500).json({ ok: false, error: 'error_interno' });
    }
  });

  router.post('/in/:slug', limiteFuente, json, async (req, res) => {
    let envioId = null;
    try {
      const fuente = await autenticarFuente(req);
      if (!fuente) return res.status(401).json({ ok: false, error: 'no_autorizado' });

      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const lead = {
        ref_id: txt(b.ref_id, 100),
        nombre: txt(b.nombre, 150) || 'Sin nombre',
        telefono: normalizarTelefono(b.telefono),
        modelo: txt(b.modelo, 150),
        resumen: txt(b.resumen, 2000),
        captura_url: urlSegura(b.captura_url),
        chat_url: urlSegura(b.chat_url),
      };
      const payload = { ...b };
      const base = { ref_externa: lead.ref_id, telefono: lead.telefono, nombre: lead.nombre, payload };

      if (!lead.telefono) {
        await registrar(fuente.id, { ...base, telefono: txt(b.telefono, 20), estado: 'rechazado', error: 'telefono_invalido' });
        return res.status(422).json({ ok: false, error: 'telefono_invalido' });
      }

      // Destino: el que manda la fuente, o el default de la fuente.
      const codigo = txt(b.destino, 50);
      let destino = null;
      if (codigo) {
        const [rows] = await pool.query(
          'SELECT * FROM integraciones_destinos WHERE fuente_id = ? AND codigo = ? LIMIT 1',
          [fuente.id, codigo.toLowerCase()]
        );
        destino = rows[0] || null;
      } else if (fuente.destino_default_id) {
        const [rows] = await pool.query(
          'SELECT * FROM integraciones_destinos WHERE id = ? AND fuente_id = ? LIMIT 1',
          [fuente.destino_default_id, fuente.id]
        );
        destino = rows[0] || null;
      }

      if (!destino || !destino.activo || !destino.equipo_id) {
        await registrar(fuente.id, { ...base, destino_id: destino?.id, estado: 'rechazado', error: 'destino_invalido' });
        return res.status(422).json({
          ok: false,
          error: 'destino_invalido',
          destinos_validos: await destinosActivos(fuente.id),
        });
      }

      // Modo prueba: valida todo y no crea el lead.
      if (b.prueba === true) {
        await registrar(fuente.id, { ...base, destino_id: destino.id, estado: 'prueba' });
        return res.json({ ok: true, prueba: true, destino: destino.codigo });
      }

      // Dedupe por teléfono dentro de la misma fuente.
      if (DEDUPE_DIAS > 0) {
        const [dups] = await pool.query(
          `SELECT lead_id FROM integraciones_envios
            WHERE fuente_id = ? AND telefono = ? AND estado = 'ok'
              AND created_at >= NOW() - INTERVAL ? DAY
            ORDER BY id DESC LIMIT 1`,
          [fuente.id, lead.telefono, DEDUPE_DIAS]
        );
        if (dups.length) {
          await registrar(fuente.id, { ...base, destino_id: destino.id, lead_id: dups[0].lead_id, estado: 'duplicado' });
          return res.json({ ok: true, duplicado: true, lead_id: dups[0].lead_id });
        }
      }

      // Reserva del ref_id (evita doble alta por doble click / reintento).
      try {
        envioId = await registrar(fuente.id, {
          ...base,
          destino_id: destino.id,
          ref_ok: lead.ref_id,
          estado: 'procesando',
        });
      } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
          const [prev] = await pool.query(
            'SELECT lead_id, estado FROM integraciones_envios WHERE fuente_id = ? AND ref_ok = ? LIMIT 1',
            [fuente.id, lead.ref_id]
          );
          if (prev[0]?.estado === 'ok') {
            return res.json({ ok: true, duplicado: true, lead_id: prev[0].lead_id });
          }
          return res.status(409).json({ ok: false, error: 'en_proceso' });
        }
        throw err;
      }

      const leadId = await adapter.crearLead(pool, lead, destino, fuente, { io: req.app.get('io') });

      await pool.query('UPDATE integraciones_envios SET estado = ?, lead_id = ? WHERE id = ?', ['ok', leadId, envioId]);
      res.json({ ok: true, lead_id: leadId, destino: destino.codigo });
    } catch (err) {
      console.error('[integraciones] alta lead', err);
      if (envioId) {
        await pool
          .query("UPDATE integraciones_envios SET estado = 'error', error = ?, ref_ok = NULL WHERE id = ?", [
            String(err?.message || err).slice(0, 255),
            envioId,
          ])
          .catch(() => {});
      }
      res.status(500).json({ ok: false, error: 'error_interno' });
    }
  });

  // ───────────────────────── admin (panel) ─────────────────────────

  const admin = express.Router();
  admin.use(...asArray(requireAdmin));
  admin.use(json);

  const wrap = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error('[integraciones] admin', err);
      res.status(500).json({ ok: false, error: 'error_interno' });
    });

  const idParam = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  admin.get(
    '/fuentes',
    wrap(async (_req, res) => {
      const [fuentes] = await pool.query(
        `SELECT f.id, f.slug, f.nombre, f.api_key_prefix, f.destino_default_id, f.activo, f.created_at,
                (SELECT COUNT(*) FROM integraciones_envios e
                  WHERE e.fuente_id = f.id AND e.estado = 'ok' AND e.created_at >= CURDATE()) AS ok_hoy
           FROM integraciones_fuentes f
          ORDER BY f.nombre`
      );
      const [destinos] = await pool.query(
        'SELECT id, fuente_id, codigo, nombre, equipo_id, activo FROM integraciones_destinos ORDER BY nombre'
      );
      res.json({
        ok: true,
        fuentes: fuentes.map((f) => ({
          ...f,
          activo: !!f.activo,
          ok_hoy: Number(f.ok_hoy),
          destinos: destinos
            .filter((d) => d.fuente_id === f.id)
            .map((d) => ({ ...d, activo: !!d.activo })),
        })),
      });
    })
  );

  admin.post(
    '/fuentes',
    wrap(async (req, res) => {
      const nombre = txt(req.body?.nombre, 100);
      const slug = txt(req.body?.slug, 50)?.toLowerCase();
      if (!nombre || !slug || !SLUG_RE.test(slug)) {
        return res.status(400).json({ ok: false, error: 'nombre y slug (a-z, 0-9, -) son obligatorios' });
      }
      const key = nuevaKey();
      try {
        const [r] = await pool.query(
          'INSERT INTO integraciones_fuentes (slug, nombre, api_key_hash, api_key_prefix) VALUES (?, ?, ?, ?)',
          [slug, nombre, sha256(key), key.slice(0, 10)]
        );
        res.json({ ok: true, id: r.insertId, api_key: key });
      } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, error: 'slug_existente' });
        throw err;
      }
    })
  );

  admin.put(
    '/fuentes/:id',
    wrap(async (req, res) => {
      const id = idParam(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'id_invalido' });
      const sets = [];
      const vals = [];
      if (req.body?.nombre !== undefined) {
        const n = txt(req.body.nombre, 100);
        if (!n) return res.status(400).json({ ok: false, error: 'nombre_invalido' });
        sets.push('nombre = ?');
        vals.push(n);
      }
      if (req.body?.activo !== undefined) {
        sets.push('activo = ?');
        vals.push(req.body.activo ? 1 : 0);
      }
      if (req.body?.destino_default_id !== undefined) {
        const did = req.body.destino_default_id === null ? null : idParam(req.body.destino_default_id);
        if (did) {
          const [d] = await pool.query('SELECT id FROM integraciones_destinos WHERE id = ? AND fuente_id = ?', [did, id]);
          if (!d.length) return res.status(400).json({ ok: false, error: 'destino_invalido' });
        }
        sets.push('destino_default_id = ?');
        vals.push(did);
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: 'sin_cambios' });
      vals.push(id);
      await pool.query(`UPDATE integraciones_fuentes SET ${sets.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    })
  );

  admin.post(
    '/fuentes/:id/regenerar-key',
    wrap(async (req, res) => {
      const id = idParam(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'id_invalido' });
      const key = nuevaKey();
      const [r] = await pool.query(
        'UPDATE integraciones_fuentes SET api_key_hash = ?, api_key_prefix = ? WHERE id = ?',
        [sha256(key), key.slice(0, 10), id]
      );
      if (!r.affectedRows) return res.status(404).json({ ok: false, error: 'no_encontrada' });
      res.json({ ok: true, api_key: key });
    })
  );

  admin.post(
    '/fuentes/:id/destinos',
    wrap(async (req, res) => {
      const fuenteId = idParam(req.params.id);
      const codigo = txt(req.body?.codigo, 50)?.toLowerCase();
      const nombre = txt(req.body?.nombre, 100);
      const equipoId = req.body?.equipo_id ? idParam(req.body.equipo_id) : null;
      if (!fuenteId || !codigo || !SLUG_RE.test(codigo) || !nombre) {
        return res.status(400).json({ ok: false, error: 'codigo (a-z, 0-9, -) y nombre son obligatorios' });
      }
      try {
        const [r] = await pool.query(
          'INSERT INTO integraciones_destinos (fuente_id, codigo, nombre, equipo_id) VALUES (?, ?, ?, ?)',
          [fuenteId, codigo, nombre, equipoId]
        );
        res.json({ ok: true, id: r.insertId });
      } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ ok: false, error: 'codigo_existente' });
        if (err?.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ ok: false, error: 'fuente_inexistente' });
        throw err;
      }
    })
  );

  admin.put(
    '/destinos/:id',
    wrap(async (req, res) => {
      const id = idParam(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'id_invalido' });
      const sets = [];
      const vals = [];
      if (req.body?.nombre !== undefined) {
        const n = txt(req.body.nombre, 100);
        if (!n) return res.status(400).json({ ok: false, error: 'nombre_invalido' });
        sets.push('nombre = ?');
        vals.push(n);
      }
      if (req.body?.equipo_id !== undefined) {
        sets.push('equipo_id = ?');
        vals.push(req.body.equipo_id === null ? null : idParam(req.body.equipo_id));
      }
      if (req.body?.activo !== undefined) {
        sets.push('activo = ?');
        vals.push(req.body.activo ? 1 : 0);
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: 'sin_cambios' });
      vals.push(id);
      await pool.query(`UPDATE integraciones_destinos SET ${sets.join(', ')} WHERE id = ?`, vals);
      res.json({ ok: true });
    })
  );

  admin.delete(
    '/destinos/:id',
    wrap(async (req, res) => {
      const id = idParam(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'id_invalido' });
      await pool.query('UPDATE integraciones_fuentes SET destino_default_id = NULL WHERE destino_default_id = ?', [id]);
      await pool.query('DELETE FROM integraciones_destinos WHERE id = ?', [id]);
      res.json({ ok: true });
    })
  );

  admin.get(
    '/equipos',
    wrap(async (_req, res) => {
      res.json({ ok: true, equipos: await adapter.listarEquipos(pool) });
    })
  );

  admin.get(
    '/envios',
    wrap(async (req, res) => {
      const fuenteId = req.query.fuente_id ? idParam(req.query.fuente_id) : null;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const [rows] = await pool.query(
        `SELECT e.id, e.fuente_id, e.created_at, e.nombre, e.telefono, e.estado, e.error, e.lead_id,
                e.ref_externa, d.nombre AS destino
           FROM integraciones_envios e
           LEFT JOIN integraciones_destinos d ON d.id = e.destino_id
          ${fuenteId ? 'WHERE e.fuente_id = ?' : ''}
          ORDER BY e.id DESC
          LIMIT ?`,
        fuenteId ? [fuenteId, limit] : [limit]
      );
      res.json({ ok: true, envios: rows });
    })
  );

  router.use('/admin', admin);
  return router;
};

module.exports.normalizarTelefono = normalizarTelefono;
