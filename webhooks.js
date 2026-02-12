const express = require('express');
const pool = require('../db');
const { getAssignedVendorByBrand } = require('../utils/assign');
const router = express.Router();

// ========= Índices Round Robin para Sheets =========
let aresSheetsIndex = 0;
let brianSheetsIndex = 0;
let sebastianSheetsIndex = 0;
let lucianoSheetsIndex = 0;
let brianDPSheetsIndex = 0;
let sebastianDPSheetsIndex = 0;
let lucianoDPSheetsIndex = 0;
let favierSheetsIndex = 0; // NUEVO: índice para Favier

// ========= VENDEDORES DE ARES - ROBAINA (para Google Sheets) =========
const VENDEDORES_ARES_SHEETS = [
  { id: 226, name: 'Esteban Cappone' },
  { id: 260, name: 'Fiorella Chirico' },
  { id: 256, name: 'Gisela Sanchez' },
  { id: 258, name: 'Gonzalo Rafalski' },
  { id: 225, name: 'Jaqueline Susbielles' },
  { id: 257, name: 'Luana Rios' },
  { id: 259, name: 'Pablo Civilotti' },
  { id: 89, name: 'Pablo Valencia' },
  { id: 90, name: 'Walter Torres' }
];

// ========= VENDEDORES DE FAVIER (para Google Sheets) =========
const VENDEDORES_FAVIER_SHEETS = [
  { id: 170, name: 'Juarez' },
  { id: 172, name: 'Sebastian Calderon' },
  { id: 223, name: 'Brian Vendedor' }
];

// ========= USUARIOS CONTENEDOR POR PROVEEDOR =========
const USUARIOS_PROVEEDORES = {
  // GALLARDO VW
  emanuelAres: { id: 299, name: 'Leads Emanuel Ares', marca: 'vw' },
  emanuelMartinez: { id: 300, name: 'Leads Emanuel Martinez', marca: 'vw' },
  fastLeadsNigro: { id: 301, name: 'Leads Fast Leads Nigro', marca: 'vw' },
  // MITRE FIAT
  fastLeadsSebastian: { id: 302, name: 'Leads Fast Leads Sebastian', marca: 'fiat' },
  fastleadIpperi: { id: 303, name: 'Leads Fast Leads Ipperi', marca: 'fiat' },
  planesOficialesBrian: { id: 312, name: 'Leads Planes Oficiales Brian', marca: 'fiat' },
  planesOficialesSebastian: { id: 335, name: 'Leads Planes Oficiales Sebastian', marca: 'fiat' }
};

// ========= Contador cíclico Planes Oficiales (6 Brian, 1 Sebastian cada 7) =========
let planesOficialesCounter = 0;

// ========= Helpers de limpieza / normalización =========

function stripLabel(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s.replace(/^(\s*\d+\.\s*)?[^:]*:\s*/i, '').trim();
}

function normalizePhone(v) {
  const s = stripLabel(v);
  const cleaned = s.replace(/[^\d+]/g, '');
  return cleaned.replace(/\++/g, '+');
}

function cleanText(v) {
  return stripLabel(v);
}

function detectMarca(text) {
  const t = (text || '').toLowerCase();
  if (/volkswagen|vw/.test(t)) return 'vw';
  if (/fiat/.test(t)) return 'fiat';
  if (/peugeot/.test(t)) return 'peugeot';
  if (/renault/.test(t)) return 'renault';
  return null;
}

// Función para obtener todos los vendedores de un equipo (jerárquico)
async function getVendedoresDeEquipo(equipoId) {
  try {
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

// Round-robin por equipo
let roundRobinIndex = {};

async function assignVendorInTeam(equipoId) {
  const vendedores = await getVendedoresDeEquipo(equipoId);
  
  if (vendedores.length === 0) {
    console.error('❌ No hay vendedores disponibles en el equipo:', equipoId);
    return null;
  }

  if (roundRobinIndex[equipoId] === undefined) {
    roundRobinIndex[equipoId] = 0;
  }

  const vendedor = vendedores[roundRobinIndex[equipoId]];
  roundRobinIndex[equipoId] = (roundRobinIndex[equipoId] + 1) % vendedores.length;

  console.log(`🎯 Equipo ${equipoId}: Asignado a ${vendedor.name} (ID: ${vendedor.id})`);
  console.log(`   Próximo índice: ${roundRobinIndex[equipoId]}/${vendedores.length}`);

  return vendedor.id;
}

// ========= Webhook: La Comer =========
router.post('/lacomer', async (req, res) => {
  try {
    const body = req.body || {};
    
    console.log('📥 Webhook La Comer recibido:', JSON.stringify(body, null, 2));
    
    let nombre    = cleanText(body.nombre);
    let telefono  = normalizePhone(body.telefono);
    let modelo    = cleanText(body.modelo || 'Consultar');
    let marca     = cleanText(body.marca || 'vw').toLowerCase();
    let formaPago = cleanText(body.formaPago || 'Consultar');
    let notas     = cleanText(body.notas || '');
    const fuente  = cleanText(body.fuente) || 'lacomer';
    
    const equipoId = body.equipoId || body.teamId || body.equipo_id;
    
    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y teléfono son requeridos',
        received: { nombre, telefono }
      });
    }

    const validMarcas = ['vw', 'fiat', 'peugeot', 'renault'];
    if (!validMarcas.includes(marca)) {
      console.log(`⚠️ Marca "${marca}" no válida, usando VW por default`);
      marca = 'vw';
    }

    let assigned_to;

    // Si viene de la ruleta digital, asignar directamente al vendedor Ruleta
    if (fuente === 'ruleta_digital') {
      assigned_to = 266; // Vendedor Ruleta
      console.log('🎰 Lead de Ruleta Digital: Asignado directamente a vendedor Ruleta (ID: 266)');
    } else if (equipoId) {
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
      console.log('🌐 No se especificó equipo, usando asignación general por marca');
      
      assigned_to = await getAssignedVendorByBrand(marca);
      
      if (!assigned_to) {
        console.error('⚠️ No hay vendedores activos para la marca:', marca);
        return res.status(500).json({ error: 'No hay vendedores activos disponibles' });
      }
    }

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

// ========= Webhook: Google Sheets Ares (equipo Robaina) =========
router.post('/sheets-ares', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-ares-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, observaciones } = req.body;

    console.log('Webhook Sheets Ares recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedor = VENDEDORES_ARES_SHEETS[aresSheetsIndex];
    aresSheetsIndex = (aresSheetsIndex + 1) % VENDEDORES_ARES_SHEETS.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Ares: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, 'Consultar', 'nuevo', 'sheets-ares', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        observaciones || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Ares:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Favier (3 vendedores fijos) =========
router.post('/sheets-favier', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-favier-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, formaPago, notas, observaciones } = req.body;

    console.log('📥 Webhook Sheets Favier recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedor = VENDEDORES_FAVIER_SHEETS[favierSheetsIndex];
    favierSheetsIndex = (favierSheetsIndex + 1) % VENDEDORES_FAVIER_SHEETS.length;

    const assigned_to = vendedor.id;

    console.log(`📋 Sheets Favier: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'nuevo', 'sheets-favier', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        formaPago || 'Consultar',
        notas || observaciones || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('❌ Error webhook Sheets Favier:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Brian (equipo Favier - dinámico) =========
router.post('/sheets-brian', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-brian-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, formaPago, notas } = req.body;

    console.log('Webhook Sheets Brian recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(221);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Brian' });
    }

    const vendedor = vendedores[brianSheetsIndex % vendedores.length];
    brianSheetsIndex = (brianSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Brian: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'nuevo', 'sheets-brian', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        formaPago || 'Consultar',
        notas || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Brian:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Sebastian (equipo Favier - dinámico) =========
router.post('/sheets-sebastian', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-sebastian-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, formaPago, notas } = req.body;

    console.log('Webhook Sheets Sebastian recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(173);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Sebastian' });
    }

    const vendedor = vendedores[sebastianSheetsIndex % vendedores.length];
    sebastianSheetsIndex = (sebastianSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Sebastian: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'nuevo', 'sheets-sebastian', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        formaPago || 'Consultar',
        notas || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Sebastian:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Luciano (equipo Favier - dinámico) =========
router.post('/sheets-luciano', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-luciano-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, formaPago, notas } = req.body;

    console.log('Webhook Sheets Luciano recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(160);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Luciano' });
    }

    const vendedor = vendedores[lucianoSheetsIndex % vendedores.length];
    lucianoSheetsIndex = (lucianoSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Luciano: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'nuevo', 'sheets-luciano', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        formaPago || 'Consultar',
        notas || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Luciano:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Brian DP (equipo Favier - dinámico) =========
router.post('/sheets-brian-dp', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-brian-dp-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, observaciones } = req.body;

    console.log('Webhook Sheets Brian DP recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(221);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Brian' });
    }

    const vendedor = vendedores[brianDPSheetsIndex % vendedores.length];
    brianDPSheetsIndex = (brianDPSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Brian DP: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, 'Consultar', 'nuevo', 'sheets-brian-dp', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        observaciones || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Brian DP:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Sebastian DP (equipo Favier - dinámico) =========
router.post('/sheets-sebastian-dp', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-sebastian-dp-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, observaciones } = req.body;

    console.log('Webhook Sheets Sebastian DP recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(173);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Sebastian' });
    }

    const vendedor = vendedores[sebastianDPSheetsIndex % vendedores.length];
    sebastianDPSheetsIndex = (sebastianDPSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Sebastian DP: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, 'Consultar', 'nuevo', 'sheets-sebastian-dp', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        observaciones || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Sebastian DP:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Luciano DP (equipo Favier - dinámico) =========
router.post('/sheets-luciano-dp', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'alluma-sheets-luciano-dp-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, observaciones } = req.body;

    console.log('Webhook Sheets Luciano DP recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(160);
    
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Luciano' });
    }

    const vendedor = vendedores[lucianoDPSheetsIndex % vendedores.length];
    lucianoDPSheetsIndex = (lucianoDPSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Luciano DP: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, 'Consultar', 'nuevo', 'sheets-luciano-dp', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        observaciones || '',
        assigned_to
      ]
    );

    res.json({
      ok: true,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name
    });

  } catch (error) {
    console.error('Error webhook Sheets Luciano DP:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= ENDPOINT PARA VER ESTADO DE LOS EQUIPOS =========
router.get('/equipos/status', async (req, res) => {
  try {
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

// =====================================================================
// WEBHOOKS - PROVEEDORES CON USUARIO CONTENEDOR (SIN ROUND ROBIN)
// =====================================================================

// ========= Webhook: Emanuel Ares (Gallardo Ares) =========
router.post('/emanuel-ares', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-emanuel-ares-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, notas } = req.body;

    console.log('📩 Webhook Emanuel Ares recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const usuario = USUARIOS_PROVEEDORES.emanuelAres;

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        (notas || ''),
        usuario.id
      ]
    );

    console.log(`✅ Emanuel Ares: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('❌ Error webhook Emanuel Ares:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Emanuel Martinez (Gallardo Martinez) =========
router.post('/emanuel-martinez', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-emanuel-martinez-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, notas } = req.body;

    console.log('📩 Webhook Emanuel Martinez recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const usuario = USUARIOS_PROVEEDORES.emanuelMartinez;

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        (notas || ''),
        usuario.id
      ]
    );

    console.log(`✅ Emanuel Martinez: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('❌ Error webhook Emanuel Martinez:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Fast Leads Nigro (Gallardo Nigro) =========
router.post('/fastleads-nigro', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-fastleads-nigro-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, notas } = req.body;

    console.log('📩 Webhook Fast Leads Nigro recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const usuario = USUARIOS_PROVEEDORES.fastLeadsNigro;

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fast Leads', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        (notas || ''),
        usuario.id
      ]
    );

    console.log(`✅ Fast Leads Nigro: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Fast Leads'
    });

  } catch (error) {
    console.error('❌ Error webhook Fast Leads Nigro:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Fast Leads Sebastian (Mitre Sebastian) =========
router.post('/fastleads-sebastian', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-fastleads-sebastian-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, notas } = req.body;

    console.log('📩 Webhook Fast Leads Sebastian recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const usuario = USUARIOS_PROVEEDORES.fastLeadsSebastian;

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fast Leads', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        (notas || ''),
        usuario.id
      ]
    );

    console.log(`✅ Fast Leads Sebastian: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Fast Leads'
    });

  } catch (error) {
    console.error('❌ Error webhook Fast Leads Sebastian:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Fast Leads Ipperi (Mitre Ipperi) =========
router.post('/fastlead-ipperi', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-fastlead-ipperi-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, notas } = req.body;

    console.log('📩 Webhook FastLead Ipperi recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const usuario = USUARIOS_PROVEEDORES.fastleadIpperi;

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fast Leads', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        (notas || ''),
        usuario.id
      ]
    );

    console.log(`✅ FastLead Ipperi: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Fast Leads'
    });

  } catch (error) {
    console.error('❌ Error webhook FastLead Ipperi:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Planes Oficiales (Mitre - distribución 6 Brian / 1 Sebastian) =========
router.post('/planes-oficiales-brian', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-planes-oficiales-brian-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, telefono2, modelo, email, provincia, campana, mensaje } = req.body;

    console.log('📩 Webhook Planes Oficiales recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    // Distribución cíclica: cada 7 leads, 6 van a Brian y 1 va a Sebastian
    // Patrón: B B B B B B S  B B B B B B S  ...
    const esSebastian = (planesOficialesCounter % 7 === 6);
    const usuario = esSebastian 
      ? USUARIOS_PROVEEDORES.planesOficialesSebastian 
      : USUARIOS_PROVEEDORES.planesOficialesBrian;
    
    planesOficialesCounter++;
    console.log(`📊 Planes Oficiales contador: ${planesOficialesCounter} → ${usuario.name} (${esSebastian ? 'Sebastian 1/7' : 'Brian 6/7'})`);

    // Construir notas con datos adicionales
    let notasArr = [];
    if (email) notasArr.push('Email: ' + email);
    if (telefono2) notasArr.push('Tel2: ' + telefono2);
    if (provincia) notasArr.push('Provincia: ' + provincia);
    if (campana) notasArr.push('Campaña: ' + campana);
    if (mensaje) notasArr.push('Mensaje: ' + mensaje);
    const notas = notasArr.join(' | ');

    await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Planes Oficiales', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        usuario.marca,
        notas,
        usuario.id
      ]
    );

    console.log(`✅ Planes Oficiales: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    res.json({
      ok: true,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Planes Oficiales',
      distribucion: esSebastian ? 'Sebastian (1/7)' : 'Brian (6/7)',
      contadorActual: planesOficialesCounter
    });

  } catch (error) {
    console.error('❌ Error webhook Planes Oficiales:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Health check =========
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    sheetsRoundRobin: {
      ares: aresSheetsIndex,
      brian: brianSheetsIndex,
      sebastian: sebastianSheetsIndex,
      luciano: lucianoSheetsIndex,
      brianDP: brianDPSheetsIndex,
      sebastianDP: sebastianDPSheetsIndex,
      lucianoDP: lucianoDPSheetsIndex,
      favier: favierSheetsIndex,
      planesOficiales: planesOficialesCounter
    },
    vendedoresFavier: VENDEDORES_FAVIER_SHEETS.map(v => v.name),
    usuariosProveedores: Object.values(USUARIOS_PROVEEDORES).map(u => u.name)
  });
});

module.exports = router;