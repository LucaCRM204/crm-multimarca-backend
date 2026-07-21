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
let paginaGoldplanIndex = 0; // índice para leads de la página web
let herreraSheetsIndex = 0; // NUEVO: índice para equipo Carlos Herrera
let caseresSheetsIndex = 0; // NUEVO: índice para equipo Martin Caseres
let delvalleNigroIndex = 0; // NUEVO: índice para webhook fastleads-nigro redirigido a equipo Delvalle
let emanuelGeneralIndex = 0; // NUEVO: índice para Emanuel General (todos los vendedores activos)

// IDs a excluir del round-robin de Emanuel General (contenedores + datos viejos)
const VENDEDORES_EXCLUIDOS_EMANUEL = [
  13, 198, 380,                            // Datos, Datos viejos, Datos victor
  136,                                     // FAVIER VENDEDOR
  266,                                     // Ruleta
  299, 300, 301, 302, 303, 312, 335, 349   // Contenedores USUARIOS_PROVEEDORES
];

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
  emanuelNeder: { id: 300, name: 'Leads Emanuel Neder', marca: 'vw' },
  fastLeadsNigro: { id: 301, name: 'Leads Fast Leads Nigro', marca: 'vw' },
  // MITRE FIAT
  fastLeadsSebastian: { id: 302, name: 'Leads Fast Leads Sebastian', marca: 'fiat' },
  fastleadIpperi: { id: 303, name: 'Leads Fast Leads Ipperi', marca: 'fiat' },
  planesOficialesBrian: { id: 312, name: 'Leads Planes Oficiales Brian', marca: 'fiat' },
  planesOficialesSebastian: { id: 335, name: 'Leads Planes Oficiales Sebastian', marca: 'fiat' },
  planesOficialesRodrigo: { id: 349, name: 'Leads Planes Oficiales Rodrigo', marca: 'fiat' }
};

// ========= Planes Oficiales: distribución proporcional por % =========
// Brian 700 (50.54%), Sebastian 320 (23.10%), Rodrigo 365 (26.35%) = 1385 total
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

// Función para obtener todos los vendedores de un equipo (jerárquico via CTE recursivo)
// ROBUSTO: recorre toda la jerarquía descendente sin importar la profundidad ni los roles intermedios.
// Funciona aunque el líder sea director, gerente, supervisor, o cambie la estructura del equipo.
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

    const leaderName = leader[0].name;
    const leaderRole = leader[0].role;

    console.log(`👥 Buscando vendedores del equipo de ${leaderName} (${leaderRole}) — CTE recursivo`);

    const [vendedores] = await pool.execute(`
      WITH RECURSIVE tree AS (
        SELECT id FROM users WHERE id = ?
        UNION ALL
        SELECT u.id
        FROM users u
        INNER JOIN tree t ON u.reportsTo = t.id
        WHERE u.active = 1
      )
      SELECT DISTINCT u.id, u.name, u.role
      FROM users u
      INNER JOIN tree t ON u.id = t.id
      WHERE u.active = 1
        AND u.role = 'vendedor'
      ORDER BY u.id
    `, [equipoId]);

    console.log(`✅ Encontrados ${vendedores.length} vendedores en equipo de ${leaderName}`);

    return vendedores;

  } catch (error) {
    console.error('❌ Error al obtener vendedores del equipo:', error);
    return [];
  }
}

// Igual que getVendedoresDeEquipo pero para VARIOS líderes a la vez (ej: Caseres + Orge)
async function getVendedoresDeEquipos(equipoIds) {
  try {
    if (!equipoIds || equipoIds.length === 0) return [];
    const ph = equipoIds.map(() => '?').join(',');
    const [vendedores] = await pool.execute(`
      WITH RECURSIVE tree AS (
        SELECT id FROM users WHERE id IN (${ph})
        UNION ALL
        SELECT u.id FROM users u INNER JOIN tree t ON u.reportsTo = t.id WHERE u.active = 1
      )
      SELECT DISTINCT u.id, u.name
      FROM users u INNER JOIN tree t ON u.id = t.id
      WHERE u.active = 1 AND u.role = 'vendedor'
      ORDER BY u.id
    `, equipoIds);
    return vendedores;
  } catch (e) {
    console.error('❌ getVendedoresDeEquipos:', e.message);
    return [];
  }
}

// IDs de gerentes GoldPlan (mes actual)
const CASERES_ID = 357;
const ORGE_ID = 419;
const SANTIAGO_DE_TORRES_ID = 424;
// Santiago tiene 2 supervisiones: los leads de planillas van SOLO al equipo de Martin Favier
const FAVIER_ID = 116;
// índices round-robin para los webhooks de Santiago de Torres
let santiagoEmanuelIdx = 0, santiagoFastIdx = 0, santiagoGleIdx = 0, fastleadsGeneralIdx = 0;

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
    } else if (body.assigned_to) {
      // El número por donde entró pertenece a un vendedor → lead directo a él
      assigned_to = parseInt(body.assigned_to);
      console.log(`🎯 Lead asignado DIRECTO a vendedor ${assigned_to} (dueño del número WhatsApp)`);
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

// ========= Webhook: Emanuel Neder (Gallardo Neder) =========
router.post('/emanuel-neder', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-emanuel-neder-2024') {
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

    const usuario = USUARIOS_PROVEEDORES.emanuelNeder;

    const [result] = await pool.execute(
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

    console.log(`✅ Emanuel Neder: Asignado a ${usuario.name} (ID: ${usuario.id})`);

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('❌ Error webhook Emanuel Neder:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Fast Leads Nigro (redirigido a equipo Delvalle - dinámico) =========
// Antes: assigned_to = 301 (usuario contenedor "Leads Fast Leads Nigro")
// Ahora: round-robin entre vendedores activos del árbol de Victor Delvalle (gerente ID 368)
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

    // Round-robin entre vendedores del equipo de Victor Delvalle (ID 368)
    const VICTOR_DELVALLE_ID = 368;
    const vendedores = await getVendedoresDeEquipo(VICTOR_DELVALLE_ID);

    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Victor Delvalle' });
    }

    const vendedor = vendedores[delvalleNigroIndex % vendedores.length];
    delvalleNigroIndex = (delvalleNigroIndex + 1) % vendedores.length;
    const assigned_to = vendedor.id;

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fast Leads', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        'vw',
        (notas || ''),
        assigned_to
      ]
    );

    console.log(`✅ Fast Leads Nigro → equipo Delvalle: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
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

// ========= Webhook: Planes Oficiales (Mitre - distribución Brian 59% / Sebastian 22% / Rodrigo 19%) =========
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

    // Targets: Brian 800 / Sebastian 300 / Rodrigo 250
    const PLANES_WEIGHTS = [
      { ...USUARIOS_PROVEEDORES.planesOficialesBrian,     weight: 800 },
      { ...USUARIOS_PROVEEDORES.planesOficialesSebastian, weight: 300 },
      { ...USUARIOS_PROVEEDORES.planesOficialesRodrigo,   weight: 250 },
    ];
    const targetIds = PLANES_WEIGHTS.map(t => t.id);
    const ph = targetIds.map(() => '?').join(',');

    const [currentCounts] = await pool.execute(
      `SELECT assigned_to, COUNT(*) as total FROM leads 
       WHERE assigned_to IN (${ph}) AND fuente = 'Planes Oficiales'
       GROUP BY assigned_to`,
      targetIds
    );
    const cMap = new Map();
    currentCounts.forEach(c => cMap.set(c.assigned_to, c.total));
    const N = currentCounts.reduce((s, c) => s + c.total, 0);

    // Bresenham: asignar al que más necesita para mantener su proporción
    const totalWeight = PLANES_WEIGHTS.reduce((s, t) => s + t.weight, 0);
    let usuario = PLANES_WEIGHTS[0];
    let maxNeed = -Infinity;
    for (const t of PLANES_WEIGHTS) {
      const expected = (N + 1) * t.weight / totalWeight;
      const actual = cMap.get(t.id) || 0;
      const need = expected - actual;
      if (need > maxNeed) { maxNeed = need; usuario = t; }
    }

    const actualCount = cMap.get(usuario.id) || 0;
    planesOficialesCounter++;
    const destino = `${usuario.name} (${actualCount + 1} total, peso ${usuario.weight}/${totalWeight})`;
    console.log(`📊 Planes Oficiales: lead #${N + 1} → ${destino}`);

    // Construir notas con datos adicionales
    let notasArr = [];
    if (email)     notasArr.push('Email: ' + email);
    if (telefono2) notasArr.push('Tel2: ' + telefono2);
    if (provincia) notasArr.push('Provincia: ' + provincia);
    if (campana)   notasArr.push('Campaña: ' + campana);
    if (mensaje)   notasArr.push('Mensaje: ' + mensaje);
    const notas = notasArr.join(' | ');

    const [result] = await pool.execute(
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

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${usuario.name}`,
      assignedTo: usuario.id,
      vendedor: usuario.name,
      fuente: 'Planes Oficiales',
      distribucion: destino,
      contadorActual: planesOficialesCounter
    });

  } catch (error) {
    console.error('❌ Error webhook Planes Oficiales:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Página GoldPlan (formulario web público) =========
router.post('/pagina-goldplan', async (req, res) => {
  try {
    const { nombre, telefono, modelo, notas } = req.body;

    console.log('🌐 Webhook Página GoldPlan recibido:', JSON.stringify(req.body, null, 2));

    // Validaciones
    if (!nombre || !telefono) {
      return res.status(400).json({ 
        error: 'Nombre y teléfono son requeridos',
        received: { nombre, telefono }
      });
    }

    // Limpiar teléfono
    const telefonoLimpio = normalizePhone(telefono);
    if (!telefonoLimpio || telefonoLimpio.length < 8) {
      return res.status(400).json({ error: 'Teléfono inválido' });
    }

    // Detectar marca del modelo seleccionado
    const marca = detectMarca(modelo) || 'vw';

    // Round-robin con vendedores Favier
    const vendedor = VENDEDORES_FAVIER_SHEETS[paginaGoldplanIndex];
    paginaGoldplanIndex = (paginaGoldplanIndex + 1) % VENDEDORES_FAVIER_SHEETS.length;

    const assigned_to = vendedor.id;

    console.log(`🌐 Página GoldPlan: Asignado a ${vendedor.name} (ID: ${assigned_to}), marca: ${marca}`);

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Plan de ahorro', 'nuevo', 'Pagina GoldPlan', ?, ?, NOW())`,
      [
        cleanText(nombre),
        telefonoLimpio,
        cleanText(modelo) || 'Consultar',
        marca,
        cleanText(notas) || '',
        assigned_to
      ]
    );

    console.log(`✅ Página GoldPlan: Lead creado, asignado a ${vendedor.name}`);

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead recibido correctamente`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
      fuente: 'Pagina GoldPlan'
    });

  } catch (error) {
    console.error('❌ Error webhook Página GoldPlan:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Equipo Herrera (equipo Delvalle - dinámico) =========
// Supervisor: Carlos Hererra (ID 370, reporta a Victor Delvalle ID 368)
// Vendedores: Yesica 371, Agustin 372, Alejandro 373, Jose 374, Sebastian 375, Mia 376
const CARLOS_HERRERA_ID = 370;

router.post('/sheets-herrera', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-sheets-herrera-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;

    console.log('Webhook Sheets Herrera recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(CARLOS_HERRERA_ID);

    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Carlos Herrera' });
    }

    const vendedor = vendedores[herreraSheetsIndex % vendedores.length];
    herreraSheetsIndex = (herreraSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Herrera: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    // Armar notas combinando localidad + consulta original
    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        marcaFinal,
        notasFinal,
        assigned_to
      ]
    );

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('Error webhook Sheets Herrera:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Webhook: Google Sheets Lucas Ponce (vendedor único, mismo sheet que Herrera) =========
// Vendedor: Lucas Gabriel Ponce (ID 377, reporta al supervisor ID 358)
// Sin round-robin: todo va directo a 377.
const LUCAS_PONCE_ID = 377;

router.post('/sheets-ponce', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-sheets-ponce-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;

    console.log('Webhook Sheets Ponce recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    // Verificar que el vendedor sigue activo
    const [check] = await pool.execute(
      'SELECT id, name FROM users WHERE id = ? AND active = 1',
      [LUCAS_PONCE_ID]
    );
    if (check.length === 0) {
      return res.status(500).json({ error: 'Lucas Ponce (377) no está activo en la DB' });
    }

    const vendedorNombre = check[0].name;

    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        marcaFinal,
        notasFinal,
        LUCAS_PONCE_ID
      ]
    );

    console.log(`✅ Sheets Ponce: Lead #${result.insertId} asignado a ${vendedorNombre}`);

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${vendedorNombre}`,
      assignedTo: LUCAS_PONCE_ID,
      vendedor: vendedorNombre,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('Error webhook Sheets Ponce:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});
// ========= Webhook: Google Sheets Martin Caseres (equipo dinámico) =========
// ⚠️ COMPLETAR MARTIN_CASERES_ID con el ID del supervisor/gerente en la DB.
//    Query: SELECT id, name, role FROM users WHERE name LIKE '%Caseres%';
const MARTIN_CASERES_ID = 357; // <-- COMPLETAR

router.post('/sheets-caseres', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-sheets-caseres-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;

    console.log('Webhook Sheets Caseres recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    if (!MARTIN_CASERES_ID) {
      return res.status(500).json({ error: 'MARTIN_CASERES_ID no configurado en webhooks.js' });
    }

    const vendedores = await getVendedoresDeEquipo(MARTIN_CASERES_ID);

    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Martin Caseres' });
    }

    const vendedor = vendedores[caseresSheetsIndex % vendedores.length];
    caseresSheetsIndex = (caseresSheetsIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`Sheets Caseres: Asignado a ${vendedor.name} (ID: ${assigned_to})`);

    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        marcaFinal,
        notasFinal,
        assigned_to
      ]
    );

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
      fuente: 'Emanuel'
    });

  } catch (error) {
    console.error('Error webhook Sheets Caseres:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});
// ========= Webhook: Google Sheets Emanuel General (TODOS los vendedores) =========
// Reparte leads de fuente "Emanuel" en round-robin entre TODOS los vendedores activos.
// Excluye usuarios contenedores (Leads Emanuel Ares, Fast Leads Nigro, etc.) y "Datos viejos" (198).
router.post('/sheets-emanuel-general', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-sheets-emanuel-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;

    console.log('📥 Webhook Sheets Emanuel General recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    // Reparte SOLO entre los equipos de Caseres (357) y Orge (419)
    const vendedores = await getVendedoresDeEquipos([CASERES_ID, ORGE_ID]);

    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos disponibles' });
    }

    const vendedor = vendedores[emanuelGeneralIndex % vendedores.length];
    emanuelGeneralIndex = (emanuelGeneralIndex + 1) % vendedores.length;

    const assigned_to = vendedor.id;

    console.log(`📋 Emanuel General → ${vendedor.name} (ID ${assigned_to}). Pool: ${vendedores.length}, próximo idx: ${emanuelGeneralIndex}`);

    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
         (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
         (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [
        nombre || '',
        telefono || '',
        modelo || 'Consultar',
        marcaFinal,
        notasFinal,
        assigned_to
      ]
    );

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    res.json({
      ok: true,
      lead: createdLead,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
      fuente: 'Emanuel',
      totalVendedores: vendedores.length
    });

  } catch (error) {
    console.error('❌ Error webhook Sheets Emanuel General:', error);
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
      paginaGoldplan: paginaGoldplanIndex,
      herrera: herreraSheetsIndex,
      caseres: caseresSheetsIndex,
      emanuelGeneral: emanuelGeneralIndex,
      planesOficiales: planesOficialesCounter
    },
    vendedoresFavier: VENDEDORES_FAVIER_SHEETS.map(v => v.name),
    usuariosProveedores: Object.values(USUARIOS_PROVEEDORES).map(u => u.name)
  });
});


// ============================================================
// GOLDPLAN POOL - Smooth Weighted Round-Robin
// Pesos 9:5:5 -> Caseres:Favier:Delvalle (4500/2500/2500)
// Distribucion intercalada: cada 19 leads cumple exacto 9/5/5
// Compartido entre Mastropasqua, Osvaldo, Fast Leads, Emanuel
// ============================================================

const GOLDPLAN_POOL_GERENTES = {
  caseres:  { id: 357, peso: 9, label: 'Caseres' },
  favier:   { id: 116, peso: 5, label: 'Favier' },
  delvalle: { id: 368, peso: 5, label: 'Delvalle' }
};
const GOLDPLAN_POOL_PESO_TOTAL = 19; // 9+5+5

// Estado del WRR (current weights) - compartido entre los 4 endpoints
const goldplanPoolCw = { caseres: 0, favier: 0, delvalle: 0 };
// Round-robin dentro de cada equipo
const goldplanPoolRR = { caseres: 0, favier: 0, delvalle: 0 };

function elegirEquipoGoldplanPool() {
  // Smooth WRR (estilo Nginx upstream)
  goldplanPoolCw.caseres  += GOLDPLAN_POOL_GERENTES.caseres.peso;
  goldplanPoolCw.favier   += GOLDPLAN_POOL_GERENTES.favier.peso;
  goldplanPoolCw.delvalle += GOLDPLAN_POOL_GERENTES.delvalle.peso;

  let max = 'caseres';
  if (goldplanPoolCw.favier   > goldplanPoolCw[max]) max = 'favier';
  if (goldplanPoolCw.delvalle > goldplanPoolCw[max]) max = 'delvalle';

  goldplanPoolCw[max] -= GOLDPLAN_POOL_PESO_TOTAL;
  return max;
}

async function asignarVendedorGoldplanPool(equipoKey) {
  const equipo = GOLDPLAN_POOL_GERENTES[equipoKey];
  const vendedores = await getVendedoresDeEquipo(equipo.id);
  if (vendedores.length === 0) return null;
  const idx = goldplanPoolRR[equipoKey];
  const vendedor = vendedores[idx % vendedores.length];
  goldplanPoolRR[equipoKey] = (idx + 1) % vendedores.length;
  return { vendedor, equipoLabel: equipo.label };
}

// Factory para crear los 4 endpoints sin duplicar logica
function crearEndpointGoldplanPool(opts) {
  const { ruta, sheetKey, fuente } = opts;
  router.post(ruta, async (req, res) => {
    try {
      const key = req.headers['x-sheet-key'];
      if (key !== sheetKey) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { nombre, telefono, modelo, marca, localidad, notas, correo } = req.body;
      console.log(`[${fuente}] Recibido:`, JSON.stringify(req.body));

      if (!nombre || !telefono) {
        return res.status(400).json({ error: 'Nombre y telefono son requeridos', received: { nombre, telefono } });
      }

      const equipoKey = elegirEquipoGoldplanPool();
      const result = await asignarVendedorGoldplanPool(equipoKey);
      if (!result) {
        return res.status(500).json({ error: `No hay vendedores activos en equipo ${equipoKey}` });
      }

      const { vendedor, equipoLabel } = result;
      const assigned_to = vendedor.id;

      const notasArr = [];
      if (localidad) notasArr.push('Localidad: ' + localidad);
      if (correo)    notasArr.push('Mail: ' + correo);
      if (notas)     notasArr.push(notas);
      const notasFinal = notasArr.join(' | ');

      const marcaFinal = (marca || 'fiat').toString().toLowerCase();

      const [ins] = await pool.execute(
        `INSERT INTO leads
          (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
         VALUES
          (?, ?, ?, ?, 'Consultar', 'nuevo', ?, ?, ?, NOW())`,
        [nombre || '', telefono || '', modelo || 'Consultar', marcaFinal, fuente, notasFinal, assigned_to]
      );

      console.log(`[${fuente}] Lead #${ins.insertId} -> ${equipoLabel}: ${vendedor.name} (${assigned_to})`);

      const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [ins.insertId]);

      res.json({
        ok: true,
        lead: leadRows[0] || null,
        leadId: ins.insertId,
        vendedor: vendedor.name,
        assignedTo: assigned_to,
        equipo: equipoLabel,
        fuente
      });
    } catch (error) {
      console.error(`[${fuente}] Error:`, error);
      res.status(500).json({ error: 'Error al procesar lead' });
    }
  });
}

// Los 4 endpoints del pool
crearEndpointGoldplanPool({ ruta: '/goldplan-pool-mastropasqua', sheetKey: 'goldplan-pool-mastropasqua-2026', fuente: 'Mastropasqua' });
crearEndpointGoldplanPool({ ruta: '/goldplan-pool-osvaldo',      sheetKey: 'goldplan-pool-osvaldo-2026',      fuente: 'Osvaldo' });
crearEndpointGoldplanPool({ ruta: '/goldplan-pool-fastleads',    sheetKey: 'goldplan-pool-fastleads-2026',    fuente: 'Fast Leads' });

// ============================================================
// EMANUEL → equipo David (gerente 457) - EXCLUSIVO
// Reemplaza al pool 9:5:5 para esta fuente. Misma URL y key,
// así el Apps Script de la planilla no cambia.
// ============================================================
let emanuelDavidIndex = 0;
router.post('/goldplan-pool-emanuel', async (req, res) => {
  try {
    const key = req.headers['x-sheet-key'];
    if (key !== 'goldplan-pool-emanuel-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas, correo } = req.body;
    console.log('[Emanuel-David] Recibido:', JSON.stringify(req.body));

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y telefono son requeridos', received: { nombre, telefono } });
    }

    const vendedores = await getVendedoresDeEquipo(457);
    if (!vendedores || vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en equipo David (457)' });
    }
    const vendedor = vendedores[emanuelDavidIndex % vendedores.length];
    emanuelDavidIndex = (emanuelDavidIndex + 1) % vendedores.length;
    const assigned_to = vendedor.id;

    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (correo)    notasArr.push('Mail: ' + correo);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [ins] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Emanuel', ?, ?, NOW())`,
      [nombre || '', telefono || '', modelo || 'Consultar', marcaFinal, notasFinal, assigned_to]
    );

    console.log(`[Emanuel-David] Lead #${ins.insertId} -> David: ${vendedor.name} (${assigned_to})`);

    res.json({
      ok: true,
      leadId: ins.insertId,
      vendedor: vendedor.name,
      assignedTo: assigned_to,
      equipo: 'David',
      fuente: 'Emanuel'
    });
  } catch (error) {
    console.error('[Emanuel-David] Error:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});
// [MOVIDO] Emanuel salió del pool 9:5:5 → ahora va exclusivo al gerente David (457), ver ruta dedicada abajo
// crearEndpointGoldplanPool({ ruta: '/goldplan-pool-emanuel',      sheetKey: 'goldplan-pool-emanuel-2026',      fuente: 'Emanuel' });



// ============================================================
// FERNANDO NIEVA → equipo Martin Caseres (357) - exclusivo
// Round-robin estricto entre los vendedores de Caseres
// ============================================================
let fernandoCaseresIndex = 0;

router.post('/sheets-fernando-caseres', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-fernando-caseres-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const {
      nombre, telefono, modelo, marca,
      tipo_entrega, tipo_anticipo, localidad, horario
    } = req.body;

    console.log('[Fernando-Caseres] Recibido:', JSON.stringify(req.body));

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y telefono requeridos', received: { nombre, telefono } });
    }

    const vendedores = await getVendedoresDeEquipo(357); // Martin Caseres
    if (!vendedores.length) {
      return res.status(500).json({ error: 'No hay vendedores activos en equipo Caseres' });
    }

    const vendedor = vendedores[fernandoCaseresIndex % vendedores.length];
    fernandoCaseresIndex = (fernandoCaseresIndex + 1) % vendedores.length;
    const assigned_to = vendedor.id;

    // Armar notas con todos los campos extras
    const notasArr = [];
    if (tipo_entrega)  notasArr.push('Tipo de entrega: ' + tipo_entrega);
    if (tipo_anticipo) notasArr.push('Anticipo: ' + tipo_anticipo);
    if (localidad)     notasArr.push('Localidad: ' + localidad);
    if (horario)       notasArr.push('Horario contacto: ' + horario);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'fiat').toString().toLowerCase();

    const [ins] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fernando', ?, ?, NOW())`,
      [nombre, telefono, modelo || 'Consultar', marcaFinal, notasFinal, assigned_to]
    );

    console.log(`[Fernando-Caseres] Lead #${ins.insertId} -> ${vendedor.name} (${assigned_to}) | pool: ${vendedores.length}`);

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [ins.insertId]);

    res.json({
      ok: true,
      lead: leadRows[0] || null,
      leadId: ins.insertId,
      vendedor: vendedor.name,
      assignedTo: assigned_to,
      equipo: 'Caseres',
      fuente: 'Fernando',
      pool: vendedores.length
    });
  } catch (error) {
    console.error('[Fernando-Caseres] Error:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});


// ========= Webhook: Bot WhatsApp GoldPlan — Caseres + Favier =========
// El bot ya hace el round-robin internamente y manda el assigned_to resuelto.
// Este endpoint solo inserta el lead tal como llega.
// Header requerido: x-sheet-key: goldplan-bot-cf-2026
router.post('/bot-caseres-favier', async (req, res) => {
  try {
    const sheetKey = req.headers['x-sheet-key'];
    if (sheetKey !== 'goldplan-bot-cf-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, notas, assigned_to } = req.body;

    console.log('[Bot CF] Lead recibido:', JSON.stringify(req.body, null, 2));

    if (!telefono || !assigned_to) {
      return res.status(400).json({ error: 'telefono y assigned_to son requeridos' });
    }

    const marcaFinal = (marca || 'vw').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Alessio', ?, ?, NOW())`,
      [
        nombre      || 'Sin nombre',
        telefono    || '',
        modelo      || 'Consultar',
        marcaFinal,
        notas       || '',
        assigned_to,
      ]
    );

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    const createdLead = leadRows[0] || null;

    console.log(`[Bot CF] Lead #${result.insertId} creado → assigned_to ${assigned_to}`);

    res.json({
      ok:          true,
      lead:        createdLead,
      assignedTo:  assigned_to,
    });

  } catch (error) {
    console.error('[Bot CF] Error:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

// ========= Santiago De Torres (424) — Emanuel / Fast Leads / GLE =========
async function crearLeadSantiago(req, res, fuente, getIdx, setIdx) {
  try {
    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y telefono son requeridos' });
    const vendedores = await getVendedoresDeEquipo(FAVIER_ID);
    if (vendedores.length === 0) return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Martin Favier' });
    const idx = getIdx() % vendedores.length;
    const vendedor = vendedores[idx];
    setIdx((idx + 1) % vendedores.length);
    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const marcaFinal = (marca || 'fiat').toString().toLowerCase();
    const [result] = await pool.execute(
      `INSERT INTO leads
         (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
         (?, ?, ?, ?, 'Consultar', 'nuevo', ?, ?, ?, NOW())`,
      [nombre || '', telefono || '', modelo || 'Consultar', marcaFinal, fuente, notasArr.join(' | '), vendedor.id]
    );
    console.log(`[SANTIAGO ${fuente}] Lead ${result.insertId} -> ${vendedor.name} (${vendedor.id})`);
    res.json({ ok: true, leadId: result.insertId, assignedTo: vendedor.id, vendedor: vendedor.name, fuente });
  } catch (error) {
    console.error('Error Santiago ' + fuente + ':', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
}

router.post('/sheets-emanuel-santiago', async (req, res) => {
  if (req.headers['x-sheet-key'] !== 'goldplan-emanuel-santiago-2026') return res.status(401).json({ error: 'No autorizado' });
  await crearLeadSantiago(req, res, 'Emanuel', () => santiagoEmanuelIdx, v => { santiagoEmanuelIdx = v; });
});

router.post('/sheets-fastleads-general', async (req, res) => {
  try {
    if (req.headers['x-sheet-key'] !== 'goldplan-fastleads-2026') return res.status(401).json({ error: 'No autorizado' });
    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;
    if (!nombre || !telefono) return res.status(400).json({ error: 'Nombre y telefono son requeridos' });
    const vendedores = await getVendedoresDeEquipos([CASERES_ID, ORGE_ID]);
    if (vendedores.length === 0) return res.status(500).json({ error: 'No hay vendedores activos en Caseres+Orge' });
    const vendedor = vendedores[fastleadsGeneralIdx % vendedores.length];
    fastleadsGeneralIdx = (fastleadsGeneralIdx + 1) % vendedores.length;
    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const marcaFinal = (marca || 'fiat').toString().toLowerCase();
    const [result] = await pool.execute(
      `INSERT INTO leads
         (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
         (?, ?, ?, ?, 'Consultar', 'nuevo', 'Fast Leads', ?, ?, NOW())`,
      [nombre || '', telefono || '', modelo || 'Consultar', marcaFinal, notasArr.join(' | '), vendedor.id]
    );
    console.log(`[FASTLEADS Caseres+Orge] Lead ${result.insertId} -> ${vendedor.name} (${vendedor.id})`);
    res.json({ ok: true, leadId: result.insertId, assignedTo: vendedor.id, vendedor: vendedor.name, fuente: 'Fast Leads' });
  } catch (error) {
    console.error('Error FastLeads Caseres+Orge:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

router.post('/sheets-gle-santiago', async (req, res) => {
  if (req.headers['x-sheet-key'] !== 'goldplan-gle-santiago-2026') return res.status(401).json({ error: 'No autorizado' });
  await crearLeadSantiago(req, res, 'GLE Leads', () => santiagoGleIdx, v => { santiagoGleIdx = v; });
});

// ========= Bot: actualización progresiva de leads (espejo de ALRA) =========
router.post('/bot-lead-update', async (req, res) => {
  try {
    const key = req.headers['x-bot-key'] || req.headers['x-zapier-key'];
    if (key !== 'goldplan-bot-update-2026') return res.status(401).json({ error: 'No autorizado' });
    const { leadId, nombre, modelo, marca, notas } = req.body || {};
    if (!leadId) return res.status(400).json({ error: 'Falta leadId' });
    const sets = [];
    const vals = [];
    if (nombre !== undefined && nombre !== null) { sets.push('nombre = ?'); vals.push(String(nombre)); }
    if (modelo !== undefined && modelo !== null) { sets.push('modelo = ?'); vals.push(String(modelo)); }
    if (marca && ['vw', 'fiat', 'peugeot', 'renault'].includes(String(marca).toLowerCase())) {
      sets.push('marca = ?'); vals.push(String(marca).toLowerCase());
    }
    if (notas !== undefined && notas !== null) { sets.push('notas = ?'); vals.push(String(notas)); }
    if (sets.length === 0) return res.json({ ok: true, updated: 0, noop: true });
    vals.push(parseInt(leadId));
    const [r] = await pool.execute(`UPDATE leads SET ${sets.join(', ')} WHERE id = ?`, vals);
    console.log(`🔄 [BOT-UPDATE] Lead ${leadId} actualizado:`, JSON.stringify({ nombre, modelo, marca }));
    res.json({ ok: true, updated: r.affectedRows });
  } catch (err) {
    console.error('[bot-lead-update] Error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ========= Webhook: Zapier — Equipo JOSE LUIS TRENCH (507) =========
// Round-robin entre los vendedores activos que cuelgan de Trench (CTE recursivo).
// Pool actual (9): Figueroa 509, Flores 510, Ortega 511, Rogna 512, Bedetti 514,
//                  Romano 515, Forte 516, Medina 517, Soria 518
// Header requerido: x-zapier-key: goldplan-trench-2026
const TRENCH_ID = 507;
let trenchIndex = 0;

router.post('/zap-trench', async (req, res) => {
  try {
    if (req.headers['x-zapier-key'] !== 'goldplan-trench-2026') {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { nombre, telefono, modelo, marca, localidad, notas } = req.body;

    console.log('[Zap Trench] Recibido:', JSON.stringify(req.body, null, 2));

    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Nombre y telefono son requeridos',
        received: { nombre, telefono }
      });
    }

    const vendedores = await getVendedoresDeEquipo(TRENCH_ID);
    if (vendedores.length === 0) {
      return res.status(500).json({ error: 'No hay vendedores activos en el equipo de Jose Luis Trench' });
    }

    const vendedor = vendedores[trenchIndex % vendedores.length];
    trenchIndex = (trenchIndex + 1) % vendedores.length;
    const assigned_to = vendedor.id;

    const notasArr = [];
    if (localidad) notasArr.push('Localidad: ' + localidad);
    if (notas)     notasArr.push(notas);
    const notasFinal = notasArr.join(' | ');

    const marcaFinal = (marca || 'vw').toString().toLowerCase();

    const [result] = await pool.execute(
      `INSERT INTO leads
        (nombre, telefono, modelo, marca, formaPago, estado, fuente, notas, assigned_to, created_at)
       VALUES
        (?, ?, ?, ?, 'Consultar', 'nuevo', 'Alessio Formularios', ?, ?, NOW())`,
      [
        nombre   || '',
        telefono || '',
        modelo   || 'Consultar',
        marcaFinal,
        notasFinal,
        assigned_to
      ]
    );

    const [leadRows] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);

    console.log(`[Zap Trench] Lead #${result.insertId} -> ${vendedor.name} (${assigned_to}) | pool: ${vendedores.length}`);

    res.json({
      ok: true,
      lead: leadRows[0] || null,
      leadId: result.insertId,
      message: `Lead asignado a ${vendedor.name}`,
      assignedTo: assigned_to,
      vendedor: vendedor.name,
      equipo: 'Trench',
      fuente: 'Alessio Formularios',
      pool: vendedores.length
    });

  } catch (error) {
    console.error('[Zap Trench] Error:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});


module.exports = router;