// utils/assign.js
const pool = require('../db');

// 🎯 EQUIPO ALFARO - IDs autorizados
const EQUIPO_ALFARO = [25, 55, 24, 54, 47, 22, 59, 28, 52, 45, 48, 29, 44, 33, 35, 60, 51, 36, 56, 39];

// 🎯 Índice único para el equipo Alfaro
let globalRoundRobinIndex = 0;

// Función principal: asigna de forma equitativa SOLO al equipo de Alfaro
const getAssignedVendorByBrand = async (marca) => {
  try {
    // 🔥 FILTRADO: Solo vendedores del equipo Alfaro que estén activos
    const [vendors] = await pool.execute(
      `SELECT u.id, u.name, COUNT(l.id) as total_leads
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id
       WHERE u.role = 'vendedor' 
         AND u.active = 1
         AND u.id IN (?)
       GROUP BY u.id, u.name
       ORDER BY u.id ASC`,
      [EQUIPO_ALFARO]
    );

    if (vendors.length === 0) {
      console.warn('⚠️ No hay vendedores del equipo Alfaro activos en el sistema');
      return null;
    }

    console.log(`👥 Vendedores del equipo Alfaro disponibles: ${vendors.length}`);
    
    // 🎯 ROUND-ROBIN: Rotar entre vendedores del equipo Alfaro
    const selectedVendor = vendors[globalRoundRobinIndex % vendors.length];
    
    // Incrementar para el próximo lead
    globalRoundRobinIndex = (globalRoundRobinIndex + 1) % vendors.length;

    console.log(`✅ Lead [${marca?.toUpperCase() || 'SIN MARCA'}] → Vendedor ${selectedVendor.id} (${selectedVendor.name}) [EQUIPO ALFARO]`);
    console.log(`   📊 Tiene ${selectedVendor.total_leads} leads totales`);
    console.log(`   🔄 Índice actual: ${globalRoundRobinIndex - 1}/${vendors.length - 1} | Próximo: ${globalRoundRobinIndex}`);
    
    return selectedVendor.id;
  } catch (error) {
    console.error('❌ Error en asignación:', error);
    return null;
  }
};

// Función alternativa (mismo comportamiento ahora)
const getNextVendorId = async () => {
  return await getAssignedVendorByBrand(null);
};

// 🆕 Resetear el índice (útil si agregas/quitas vendedores)
const resetRoundRobinIndex = () => {
  globalRoundRobinIndex = 0;
  console.log('🔄 Índice round-robin reseteado a 0');
};

// 🆕 Ver el estado actual del round-robin - SOLO EQUIPO ALFARO
const getRoundRobinStatus = async () => {
  try {
    const [vendors] = await pool.execute(
      `SELECT 
         u.id, 
         u.name, 
         u.active,
         COUNT(l.id) as total_leads,
         SUM(CASE WHEN l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as leads_7d,
         SUM(CASE WHEN l.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as leads_24h,
         MAX(l.created_at) as ultimo_lead
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id
       WHERE u.role = 'vendedor' 
         AND u.active = 1 
         AND u.id IN (?)
       GROUP BY u.id, u.name, u.active
       ORDER BY u.id ASC`,
      [EQUIPO_ALFARO]
    );

    if (vendors.length === 0) {
      return {
        equipo: 'Alfaro',
        totalVendedoresActivos: 0,
        indiceActual: globalRoundRobinIndex,
        proximoVendedor: null,
        todosLosVendedores: []
      };
    }

    const nextVendor = vendors[globalRoundRobinIndex % vendors.length];

    return {
      equipo: 'Alfaro',
      totalVendedoresActivos: vendors.length,
      indiceActual: globalRoundRobinIndex,
      proximoVendedor: {
        id: nextVendor.id,
        nombre: nextVendor.name,
        leads_totales: nextVendor.total_leads
      },
      todosLosVendedores: vendors
    };
  } catch (error) {
    console.error('Error obteniendo estado:', error);
    return null;
  }
};

// Legacy - se mantiene por compatibilidad
const touchUser = async (conn, userId) => {
  return;
};

module.exports = { 
  getAssignedVendorByBrand,
  getNextVendorId, 
  touchUser,
  resetRoundRobinIndex,
  getRoundRobinStatus
};
