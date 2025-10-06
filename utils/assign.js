// utils/assign.js
const pool = require('../db');

// Mapeo de marcas a IDs de supervisoras
const BRAND_SUPERVISORS = {
  'fiat': 5,     // Cecilia Caceres
  'peugeot': 5,  // Cecilia Caceres
  'vw': 14,      // Karina Martinez  
  'renault': 14  // Karina Martinez
};

// Función principal: asigna por marca
const getAssignedVendorByBrand = async (marca) => {
  try {
    const supervisorId = BRAND_SUPERVISORS[marca?.toLowerCase()];
    
    if (!supervisorId) {
      console.warn(`Marca no reconocida: ${marca}, usando asignación por defecto`);
      return await getNextVendorId();
    }

    // 🔧 CORRECCIÓN: Buscar vendedores ordenados por cantidad de leads asignados
    const [vendors] = await pool.execute(
      `SELECT u.id, u.nombre,
              COUNT(l.id) as lead_count,
              COALESCE(MAX(l.created_at), '2000-01-01') as ultimo_lead
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id 
                         AND l.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       WHERE u.role = 'vendedor' 
         AND u.active = 1 
         AND u.reportsTo = ?
       GROUP BY u.id, u.nombre
       ORDER BY lead_count ASC, ultimo_lead ASC, u.id ASC
       LIMIT 1`,
      [supervisorId]
    );

    if (vendors.length === 0) {
      console.warn(`No hay vendedores activos para supervisora ID: ${supervisorId}`);
      return await getNextVendorId();
    }

    const assignedVendor = vendors[0].id;
    
    console.log(`✅ Lead asignado a vendedor ${assignedVendor} (${vendors[0].nombre}) del equipo de supervisora ${supervisorId} (marca: ${marca}) - Leads recientes: ${vendors[0].lead_count}`);
    
    return assignedVendor;

  } catch (error) {
    console.error('❌ Error en asignación por marca:', error);
    return await getNextVendorId();
  }
};

// Función original mejorada
const getNextVendorId = async (conn = pool) => {
  try {
    const [rows] = await conn.execute(
      `SELECT u.id, COUNT(l.id) as lead_count
       FROM users u
       LEFT JOIN leads l ON l.assigned_to = u.id 
                         AND l.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       WHERE u.role = 'vendedor' AND u.active = 1
       GROUP BY u.id
       ORDER BY lead_count ASC, u.id ASC 
       LIMIT 1`
    );
    return rows.length ? rows[0].id : null;
  } catch (error) {
    console.error('Error en getNextVendorId:', error);
    return null;
  }
};

// Ya no necesitas touchUser - la asignación es por conteo de leads
const touchUser = async (conn, userId) => {
  // Función legacy - ya no se usa pero se mantiene por compatibilidad
  return;
};

module.exports = { 
  getAssignedVendorByBrand,
  getNextVendorId, 
  touchUser 
};