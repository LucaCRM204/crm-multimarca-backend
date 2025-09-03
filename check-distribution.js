const pool = require('./db');

async function verDistribucion() {
  const [stats] = await pool.execute(`
    SELECT 
      u.name,
      u.role,
      COUNT(l.id) as total_leads,
      SUM(CASE WHEN l.estado = 'vendido' THEN 1 ELSE 0 END) as vendidos
    FROM users u
    LEFT JOIN leads l ON u.id = l.assigned_to
    WHERE u.role = 'vendedor'
    GROUP BY u.id
    ORDER BY total_leads DESC
  `);
  
  console.log('\n=== DISTRIBUCIÓN DE LEADS ===');
  stats.forEach(v => {
    console.log(`${v.name}: ${v.total_leads} leads (${v.vendidos} vendidos)`);
  });
  
  process.exit(0);
}

verDistribucion();
