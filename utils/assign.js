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
      return await getNextVendorId(); // fallback a la lógica anterior
    }

    // Buscar vendedores del equipo de esta supervisora
    const [vendors] = await pool.execute(
      `SELECT id FROM users 
       WHERE role = 'vendedor' 
       AND active = 1 
       AND reportsTo = ?
       ORDER BY updated_at ASC, id ASC`,
      [supervisorId]
    );

    if (vendors.length === 0) {
      console.warn(`No hay vendedores activos para supervisora ID: ${supervisorId}`);
      return await getNextVendorId(); // fallback
    }

    // Retornar el vendedor menos reciente del equipo
    const assignedVendor = vendors[0].id;
    
    // Actualizar su timestamp para rotación
    await touchUser(pool, assignedVendor);
    
    console.log(`Lead asignado a vendedor ${assignedVendor} del equipo de supervisora ${supervisorId} (marca: ${marca})`);
    
    return assignedVendor;

  } catch (error) {
    console.error('Error en asignación por marca:', error);
    return await getNextVendorId(); // fallback en caso de error
  }
};

// Función original (mantener como fallback)
const getNextVendorId = async (conn = pool) => {
  try {
    const [rows] = await conn.execute(
      `SELECT id FROM users WHERE role = 'vendedor' AND active = 1
       ORDER BY updated_at ASC, id ASC LIMIT 1`
    );
    return rows.length ? rows[0].id : null;
  } catch (error) {
    console.error('Error en getNextVendorId:', error);
    return null;
  }
};

const touchUser = async (conn, userId) => {
  if (!userId) return;
  try {
    await conn.execute(`UPDATE users SET updated_at = NOW() WHERE id = ?`, [userId]);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
  }
};

module.exports = { 
  getAssignedVendorByBrand,
  getNextVendorId, 
  touchUser 
};