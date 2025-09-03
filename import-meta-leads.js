const pool = require('./db');

async function importLeadsManual() {
  const leads = [
    {nombre: "Luciano", telefono: "5493465651828", modelo: "Tera"},
    {nombre: "Mendo", telefono: "5492284586730", modelo: "Tera"},
    {nombre: "Alexis", telefono: "1139183354", modelo: "Tera"},
    {nombre: "Ivan", telefono: "1128473075", modelo: "Tera"},
    {nombre: "Ivan", telefono: "2396487620", modelo: "Tera"},
    {nombre: "Nelly", telefono: "3515146278", modelo: "Tera"},
    {nombre: "Sin nombre", telefono: "5493875527407", modelo: "Tera"},
    {nombre: "Daniela Bastini", telefono: "3794753755", modelo: "Polo"},
    {nombre: "Diego A", telefono: "2996306188", modelo: "Tera"},
    {nombre: "Lucia Arregui", telefono: "2233552036", modelo: "Polo", notas: "quiere saber sobre el nuevo polo"},
    {nombre: "Mauricio Perez", telefono: "3518054521", modelo: "Tera"},
    {nombre: "Raul Sosa", telefono: "2974585167", modelo: "Polo"},
    {nombre: "Nahuel Martinez", telefono: "2915096306", modelo: "Polo"},
    {nombre: "Jani", telefono: "2302465297", modelo: "Tera"},
    {nombre: "Martin", telefono: "3794553478", modelo: "Tera"},
    {nombre: "Francisco", telefono: "1135569610", modelo: "Tera"},
    {nombre: "Luis Marcelo Aguilar", telefono: "1168277750", modelo: "Tera"},
    {nombre: "Analia Isla", telefono: "1122497542", modelo: "Tera"},
    {nombre: "Alejandro Corribolo", telefono: "2915765782", modelo: "Tera"},
    {nombre: "Mario Silva", telefono: "3878360816", modelo: "Tera"},
    {nombre: "Sin nombre", telefono: "541132691741", modelo: "Polo"}
  ];

  console.log(`Procesando ${leads.length} leads de META...`);
  
  let successCount = 0;
  let errorCount = 0;

  // Obtener vendedores activos
  const [vendedores] = await pool.execute(
    'SELECT id FROM users WHERE role = ? AND active = 1 ORDER BY id',
    ['vendedor']
  );
  
  let vendorIndex = 0;

  for (const lead of leads) {
    try {
      // Limpiar teléfono
      let telefono = lead.telefono.replace(/[\s\-+]/g, '');
      if (telefono.startsWith('549')) {
        telefono = telefono.substring(3);
      } else if (telefono.startsWith('54')) {
        telefono = telefono.substring(2);
      }
      
      // Asignación round-robin
      let assigned_to = null;
      if (vendedores.length > 0) {
        assigned_to = vendedores[vendorIndex % vendedores.length].id;
        vendorIndex++;
      }
      
      // Insertar lead con fuente META
      await pool.execute(
        `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          lead.nombre,
          telefono,
          lead.modelo,
          'Consultar',
          'nuevo',
          'meta',  // FUENTE: META
          lead.notas || 'Lead de Meta/Facebook',
          assigned_to
        ]
      );
      
      console.log(`✅ ${lead.nombre} - ${lead.modelo} - META - Vendedor ID: ${assigned_to}`);
      successCount++;
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️ ${lead.nombre} - Teléfono duplicado`);
      } else {
        console.error(`❌ Error con ${lead.nombre}:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log('\n=============================');
  console.log(`✅ Importación completada`);
  console.log(`✅ Exitosos: ${successCount} leads de META`);
  console.log(`⚠️ Duplicados/Errores: ${errorCount}`);
  console.log('=============================');
  
  process.exit(0);
}

importLeadsManual();
