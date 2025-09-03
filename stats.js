const pool = require('./db');

async function verEstadisticas() {
  console.log('\n=== ESTADÍSTICAS DEL CRM ===\n');
  
  // Total de usuarios por rol
  const [roles] = await pool.execute(`
    SELECT role, COUNT(*) as total, 
           SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as activos
    FROM users 
    GROUP BY role
  `);
  
  console.log('USUARIOS POR ROL:');
  roles.forEach(r => {
    console.log(`${r.role}: ${r.total} total (${r.activos} activos)`);
  });
  
  // Distribución de leads por vendedor
  const [distribucion] = await pool.execute(`
    SELECT 
      u.name,
      u.active,
      COUNT(l.id) as total_leads,
      SUM(CASE WHEN l.estado = 'nuevo' THEN 1 ELSE 0 END) as nuevos,
      SUM(CASE WHEN l.estado = 'vendido' THEN 1 ELSE 0 END) as vendidos
    FROM users u
    LEFT JOIN leads l ON u.id = l.assigned_to
    WHERE u.role = 'vendedor'
    GROUP BY u.id
    ORDER BY total_leads DESC
  `);
  
  console.log('\n\nDISTRIBUCIÓN DE LEADS POR VENDEDOR:');
  console.log('=====================================');
  distribucion.forEach(v => {
    const estado = v.active ? '✅' : '❌';
    console.log(`${estado} ${v.name}: ${v.total_leads} leads (${v.nuevos} nuevos, ${v.vendidos} vendidos)`);
  });
  
  // Promedio y desviación
  const totalLeads = distribucion.reduce((sum, v) => sum + v.total_leads, 0);
  const promedio = totalLeads / distribucion.length;
  console.log(`\nPromedio: ${promedio.toFixed(1)} leads por vendedor`);
  
  // Leads sin asignar
  const [sinAsignar] = await pool.execute(
    'SELECT COUNT(*) as total FROM leads WHERE assigned_to IS NULL'
  );
  console.log(`Sin asignar: ${sinAsignar[0].total} leads`);
  
  process.exit(0);
}

verEstadisticas();
