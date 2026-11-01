// backend/services/marcasVendedor.js
const pool = require('../db'); // ajustá al path de tu pool mysql2/promise

// Marcas/categorías que el owner puede asignar.
// Los ids coinciden con lo que se guarda en leads.marca ('vw', 'fiat', ...).
// Chery, BAIC y ARCFOX se agrupan en 'chinos'.
const MARCAS = [
  { id: 'vw',         label: 'Volkswagen' },
  { id: 'fiat',       label: 'Fiat' },
  { id: 'peugeot',    label: 'Peugeot' },
  { id: 'renault',    label: 'Renault' },
  { id: 'chinos',     label: 'Autos chinos' },
  { id: 'motos',      label: 'Motos CFMOTO' },
];

const MARCA_IDS = new Set(MARCAS.map(m => m.id));

// Cómo puede venir la marca en el lead (bot, landing, Meta, ruleta) -> categoría
const ALIAS = {
  // VW
  vw: 'vw',
  volkswagen: 'vw',
  'volks wagen': 'vw',
  // Fiat
  fiat: 'fiat',
  // Peugeot
  peugeot: 'peugeot',
  peugot: 'peugeot',
  // Renault
  renault: 'renault',
  // Chinos (sumá acá las que manejen)
  chinos: 'chinos',
  chino: 'chinos',
  'autos chinos': 'chinos',
  baic: 'chinos',
  chery: 'chinos',
  arcfox: 'chinos',
  jac: 'chinos',
  haval: 'chinos',
  gwm: 'chinos',
  'great wall': 'chinos',
  byd: 'chinos',
  jetour: 'chinos',
  dfsk: 'chinos',
  changan: 'chinos',
  geely: 'chinos',
  'dongfeng': 'chinos',
  // Motos
  motos: 'motos',
  moto: 'motos',
  cfmoto: 'motos',
  'cf moto': 'motos',
  'cf-moto': 'motos',
};

function normalizarMarca(marca) {
  if (!marca) return null;
  const key = String(marca)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  return ALIAS[key] || (MARCA_IDS.has(key) ? key : null);
}

function parseMarcas(valor) {
  if (valor == null) return null;
  const arr = typeof valor === 'string' ? JSON.parse(valor) : valor;
  return Array.isArray(arr) ? arr.filter(m => MARCA_IDS.has(m)) : null;
}

// Devuelve Map<usuario_id, string[] | null>  (null = todas)
async function getConfigMarcas(usuarioIds = null) {
  let sql = 'SELECT usuario_id, marcas FROM vendedor_marcas';
  const params = [];
  if (Array.isArray(usuarioIds)) {
    if (usuarioIds.length === 0) return new Map();
    sql += ' WHERE usuario_id IN (?)';
    params.push(usuarioIds);
  }
  const [rows] = await pool.query(sql, params);
  return new Map(rows.map(r => [Number(r.usuario_id), parseMarcas(r.marcas)]));
}

/**
 * Filtra una lista de vendedores candidatos según la marca del lead.
 * Usalo en el asignador ANTES del round-robin / distribución.
 *
 * @param {Array<{id:number}>|number[]} vendedores
 * @param {string} marcaLead  marca tal cual viene en el lead (ej: "vw", "Chery", "CFMOTO")
 * @returns {Promise<Array>} mismos elementos, filtrados. Puede devolver [].
 */
async function filtrarVendedoresPorMarca(vendedores, marcaLead) {
  const marca = normalizarMarca(marcaLead);
  if (!marca || !vendedores?.length) return vendedores || [];

  const ids = vendedores.map(v => Number(typeof v === 'object' ? v.id : v));
  const config = await getConfigMarcas(ids);

  return vendedores.filter(v => {
    const id = Number(typeof v === 'object' ? v.id : v);
    if (!config.has(id)) return true;          // sin config => todas
    const marcas = config.get(id);
    return marcas === null || marcas.includes(marca);
  });
}

module.exports = {
  MARCAS,
  MARCA_IDS,
  normalizarMarca,
  parseMarcas,
  getConfigMarcas,
  filtrarVendedoresPorMarca,
};
