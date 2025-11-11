const express = require('express');
const pool = require('../db');
const { getAssignedVendorByBrand } = require('../utils/assign');
const router = express.Router();

// ========= Helpers de limpieza / normalización =========

// Quita prefijos del tipo "1. Campo: valor" o "Campo: valor"
function stripLabel(v) {
  if (v == null) return '';
  const s = String(v).trim();
  // elimina "1. .... : " al inicio (con o sin número)
  return s.replace(/^(\s*\d+\.\s*)?[^:]*:\s*/i, '').trim();
}

// Deja solo + y dígitos, y colapsa espacios
function normalizePhone(v) {
  const s = stripLabel(v);
  const cleaned = s.replace(/[^\d+]/g, '');
  // evita ++ y similares
  return cleaned.replace(/\++/g, '+');
}

// Limpia texto genérico
function cleanText(v) {
  return stripLabel(v);
}

// Detecta marca a partir de texto libre
function detectMarca(text) {
  const t = (text || '').toLowerCase();
  if (/volkswagen|vw/.test(t)) return 'vw';
  if (/fiat/.test(t)) return 'fiat';
  if (/peugeot/.test(t)) return 'peugeot';
  if (/renault/.test(t)) return 'renault';
  return null;
}

// 🆕 Función para obtener todos los vendedores de un equipo (jerárquico)
async function getVendedoresDeEquipo(equipoId) {
  try {
    // Primero obtengo el rol del líder del equipo
    const [leader] = await pool.execute(
      'SELECT id, role, name FROM users WHERE id = ? AND active = 1',
      [equipoId]
    );

    if (leader.length === 0) {
      console.error('❌ No se encontró líder de equipo con ID:', equipoId);
      return [];
    }

    const leaderRole = leader[0].role;
    const leaderName = leader[0].name;

    console.log(`👥 Buscando vendedores del equipo liderado por ${leaderName} (${leaderRole})`);

    let vendedores = [];

    if (leaderRole === 'gerente') {
      // GERENTE: Obtener vendedores que reportan a él directamente 
      // O que reportan a supervisores que reportan a él
      [vendedores] = await pool.execute(`
        SELECT u.id, u.name, u.role
        FROM users u
        WHERE u.active = 1
          AND u.role = 'vendedor'
          AND (
            u.reportsTo = ?
            OR u.reportsTo IN (
              SELECT id FROM users 
              WHERE reportsTo = ? 
                AND role = 'supervisor' 
                AND active = 1
            )
          )
        ORDER BY u.id
      `, [equipoId, equipoId]);

    } else if (leaderRole === 'supervisor') {
      // SUPERVISOR: Solo vendedores que reportan directamente a él
      [vendedores] = await pool.execute(`
        SELECT u.id, u.name, u.role
        FROM users u
        WHERE u.active = 1
          AND u.role = 'vendedor'
          AND u.reportsTo = ?
        ORDER BY u.id
      `, [equipoId]);

    } else {
      console.error('⚠️ El equipoId debe ser un gerente o supervisor, recibido:', leaderRole);
      return [];
    }

    console.log(`✅ Encontrados ${vendedores.length} vendedores en equipo de ${leaderName}`);
    vendedores.forEach(v => console.log(`   - ${v.name} (ID: ${v.id})`));

    return vendedores;

  } catch (error) {
    console.error('❌ Error al obtener vendedores del equipo:', error);
    return [];
  }
}

// 🆕 Round-robin por equipo
let roundRobinIndex = {}; // { equipoId: currentIndex }

async function assignVendorInTeam(equipoId) {
  const vendedores = await getVendedoresDeEquipo(equipoId);
  
  if (vendedores.length === 0) {
    console.error('❌ No hay vendedores disponibles en el equipo:', equipoId);
    return null;
  }

  // Inicializar índice si no existe
  if (roundRobinIndex[equipoId] === undefined) {
    roundRobinIndex[equipoId] = 0;
  }

  // Obtener vendedor actual
  const vendedor = vendedores[roundRobinIndex[equipoId]];
  
  // Incrementar índice para el próximo lead (circular)
  roundRobinIndex[equipoId] = (roundRobinIndex[equipoId] + 1) % vendedores.length;

  console.log(`🎯 Equipo ${equipoId}: Asignado a ${vendedor.name} (ID: ${vendedor.id})`);
  console.log(`   Próximo índice: ${roundRobinIndex[equipoId]}/${vendedores.length}`);

  return vendedor.id;
}

// ========= Webhook: La Comer (con soporte para equipos jerárquicos) =========
router.post('/lacomer', async (req, res) => {
  try {
    const body = req.body || {};
    
    console.log('📥 Webhook La Comer recibido:', JSON.stringify(body, null, 2));
    
    // Limpio campos
    let nombre    = cleanText(body.nombre);
    let telefono  = normalizePhone(body.telefono);
    let modelo    = cleanText(body.modelo || 'Consultar');
    let marca     = cleanText(body.marca || 'vw').toLowerCase();
    let formaPago = cleanText(body.formaPago || 'Consultar');
    let notas     = cleanText(body.notas || '');
    const fuente  = 'lacomer';
    
    // 🆕 Nuevo: Recibir equipoId desde Zapier (puede venir como equipoId, teamId o equipo_id)
    const equipoId = body.equipoId || body.teamId || body.equipo_id;
    
    // Validación básica
    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y teléfono son requeridos',
        received: { nombre, telefono }
      });
    }

    // Validar marca - si no es válida, usar VW
    const validMarcas = ['vw', 'fiat', 'peugeot', 'renault'];
    if (!validMarcas.includes(marca)) {
      console.log(`⚠️ Marca "${marca}" no válida, usando VW por default`);
      marca = 'vw';
    }

    let assigned_to;

    // 🆕 ASIGNACIÓN CON O SIN EQUIPO
    if (equipoId) {
      // Si viene equipoId, asignar dentro de ese equipo específico
      console.log(`👥 Asignando lead al equipo ID: ${equipoId}`);
      
      assigned_to = await assignVendorInTeam(equipoId);
      
      if (!assigned_to) {
        console.error('❌ No se pudo asignar vendedor en el equipo:', equipoId);
        return res.status(500).json({ 
          error: 'No hay vendedores activos en el equipo especificado',
          equipoId: equipoId
        });
      }

    } else {
      // Si NO viene equipoId, usar el método anterior (round-robin general por marca)
      console.log('🌐 No se especificó equipo, usando asignación general por marca');
      
      assigned_to = await getAssignedVendorByBrand(marca);
      
      if (!assigned_to) {
        console.error('⚠️ No hay vendedores activos para la marca:', marca);
        return res.status(500).json({ error: 'No hay vendedores activos disponibles' });
      }
    }

    // Inserción en base de datos
    const [result] = await pool.execute(
      `INSERT INTO leads
         (nombre, telefono, modelo, marca, formaPago, fuente, notas, assigned_to, estado, created_at)
       VALUES
         (?,      ?,        ?,      ?,     ?,         ?,      ?,     ?,           'nuevo', NOW())`,
      [nombre, telefono, modelo, marca, formaPago, fuente, notas, assigned_to]
    );

    const logMsg = equipoId 
      ? `✅ Lead La Comer creado: ID ${result.insertId}, equipo ${equipoId}, marca ${marca}, asignado a vendedor ${assigned_to}`
      : `✅ Lead La Comer creado: ID ${result.insertId}, marca ${marca}, asignado a vendedor ${assigned_to} (sin equipo específico)`;
    
    console.log(logMsg);

    // Respuesta exitosa
    res.json({
      ok: true,
      leadId: result.insertId,
      assignedTo: assigned_to,
      marca: marca,
      equipoId: equipoId || null,
      message: 'Lead creado correctamente',
    });

  } catch (error) {
    console.error('❌ Error webhook La Comer:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// 🆕 ENDPOINT PARA VER ESTADO DE LOS EQUIPOS (útil para debugging)
router.get('/equipos/status', async (req, res) => {
  try {
    // Obtener todos los gerentes y supervisores
    const [lideres] = await pool.execute(`
      SELECT id, name, role 
      FROM users 
      WHERE role IN ('gerente', 'supervisor') 
        AND active = 1
      ORDER BY role, name
    `);

    const equipos = [];

    for (const lider of lideres) {
      const vendedores = await getVendedoresDeEquipo(lider.id);
      equipos.push({
        equipoId: lider.id,
        lider: lider.name,
        rol: lider.role,
        vendedores: vendedores.length,
        vendedoresList: vendedores.map(v => ({ id: v.id, name: v.name })),
        roundRobinIndex: roundRobinIndex[lider.id] || 0
      });
    }

    res.json({
      ok: true,
      equipos,
      totalEquipos: equipos.length,
      roundRobinState: roundRobinIndex
    });

  } catch (error) {
    console.error('❌ Error al obtener status de equipos:', error);
    res.status(500).json({ error: 'Error al obtener información de equipos' });
  }
});

module.exports = router;