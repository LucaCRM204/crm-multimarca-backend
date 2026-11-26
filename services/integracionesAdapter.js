'use strict';

/**
 * Adapter de integraciones externas → CRM GoldPlan (multimarca).
 * Es el único archivo que conoce el esquema de este CRM. routes/integraciones.js es genérico.
 *
 * Reparto: usa assignVendorInTeam de routes/webhooks.js, el mismo de los webhooks de siempre:
 *   - distribución por % si el equipo está en distribucion_equipos, si no rueda pareja
 *   - filtro "Marcas por vendedor" (marca detectada del modelo)
 *   - si nadie del equipo recibe esa marca, queda en el líder
 * Si el equipo no tiene vendedores activos, el lead queda en el líder (si está activo).
 */

const { assignVendorInTeam, marcaDelLead, detectMarca } = require('../routes/webhooks');

const ROLES_LIDER = ['director', 'gerente', 'supervisor'];
const MARCAS_VALIDAS = ['vw', 'fiat', 'peugeot', 'renault', 'chery', 'baic', 'arcfox'];

async function listarEquipos(pool) {
  const [rows] = await pool.query(
    `SELECT id, name, role
       FROM users
      WHERE active = 1 AND role IN (?)
      ORDER BY FIELD(role, 'director', 'gerente', 'supervisor'), name`,
    [ROLES_LIDER]
  );
  return rows.map((r) => ({ id: r.id, nombre: `${r.name} (${r.role})` }));
}

/**
 * @returns {Promise<number>} id del lead creado
 */
async function crearLead(pool, lead, destino, fuente, ctx = {}) {
  const [lider] = await pool.query('SELECT id, name, active FROM users WHERE id = ? LIMIT 1', [destino.equipo_id]);
  if (!lider[0] || !Number(lider[0].active)) {
    throw new Error(`El líder del equipo (${destino.equipo_id}) no existe o está inactivo`);
  }

  const marcaFiltro = marcaDelLead(null, lead.modelo);
  let assignedTo = await assignVendorInTeam(destino.equipo_id, null, fuente.nombre, marcaFiltro);
  if (!assignedTo) assignedTo = destino.equipo_id; // sin vendedores activos: queda en el líder

  const marca = detectMarca(lead.modelo);
  const marcaFinal = MARCAS_VALIDAS.includes(marca) ? marca : 'vw';

  const notas = [
    lead.resumen,
    lead.captura_url ? `Captura: ${lead.captura_url}` : null,
    lead.chat_url ? `Chat: ${lead.chat_url}` : null,
    `Destino: ${destino.nombre}`,
  ]
    .filter(Boolean)
    .join(' | ');

  const [ins] = await pool.execute(
    `INSERT INTO leads
       (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
     VALUES
       (?, ?, ?, ?, 'Consultar', 'nuevo', ?, ?, ?, NOW())`,
    [lead.nombre, lead.telefono, lead.modelo || 'Consultar', marcaFinal, fuente.nombre, notas, assignedTo]
  );

  console.log(`[Integración ${fuente.nombre}] Lead #${ins.insertId} → ${destino.nombre} → usuario ${assignedTo}`);

  // Tiempo real: mismo aviso que dispara POST /api/leads
  const io = ctx.io;
  if (io) {
    try {
      const [rows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [ins.insertId]);
      const creado = rows[0];
      if (creado) {
        io.emit('lead:created', creado);
        io.emit('notification', {
          id: `lead-${creado.id}-${Date.now()}`,
          type: 'lead_created',
          title: 'Nuevo lead asignado',
          message: `${creado.nombre || 'Lead nuevo'} - ${creado.modelo || 'Sin modelo'}`,
          timestamp: new Date().toISOString(),
          read: false,
          severity: 'info',
          leadId: creado.id,
          targetUserId: creado.assigned_to,
        });
      }
    } catch (e) {
      console.error('[Integración] socket emit:', e.message);
    }
  }

  return ins.insertId;
}

module.exports = { listarEquipos, crearLead };
