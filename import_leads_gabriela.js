const pool = require('./db');

async function importLeadsToGabriela() {
  // Array con todos los leads para Gabriela Bianchi
  const leads = [
    // Leads originales de TikTok/Instagram
    {modelo: "Polo", platform: "tiktok", anticipo: "con anticipo", nombre: "Martin", telefono: "1127675811"},
    {modelo: "Polo", platform: "tiktok", anticipo: "consulta", nombre: "Juan", telefono: "1131592786"},
    {modelo: "Consulta general", platform: "ig", anticipo: "interesada en el total", nombre: "Cecilia Ponce", telefono: "2604410282"},
    {modelo: "Audi A4", platform: "ig", anticipo: "usado Audi A4", nombre: "Emilio", telefono: "3516525847"},
    {modelo: "Por definir", platform: "ig", anticipo: "consulta", nombre: "Emi", telefono: "3492207364"},
    {modelo: "Plan mujer", platform: "ig", anticipo: "quiere saber por plan mujer", nombre: "Daniela", telefono: "3794753755"},
    {modelo: "Por definir", platform: "ig", anticipo: "consulta", nombre: "Juan", telefono: "1138676501"},
    {modelo: "0km", platform: "ig", anticipo: "VW Gol 2004, documentación completa, quiere saber tiempo entrega 0km, tiene recibo sueldo", nombre: "Miguel Acuña", telefono: "3786513536"},
    
    // Nuevos leads de Facebook
    {modelo: "VW T Cross", platform: "fb", anticipo: "Citroen cactus 2022 para permutar", nombre: "Daiana", telefono: "1136488244"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Tiene Capital", nombre: "German", telefono: "3704942414"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Tiene Capital", nombre: "Pricila", telefono: "2615765515"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Tiene Capital", nombre: "Jon", telefono: "1161231738"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Esta interesado", nombre: "Catriel", telefono: "1130754471"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Esta interesado", nombre: "Nicolas", telefono: "1134457635"},
    {modelo: "VW Polo", platform: "fb", anticipo: "Esta interesado", nombre: "Mili", telefono: "3435011537"},
    {modelo: "VW", platform: "fb", anticipo: "Esta interesado", nombre: "Gustavo", telefono: "3413072386"}
  ];

  console.log(`Procesando ${leads.length} leads para el equipo de Gabriela Bianchi...`);
  
  // Primero buscar a Gabriela Bianchi y su equipo
  const [gabrielaRows] = await pool.execute(
    'SELECT id, name FROM users WHERE role = ? AND name LIKE ?',
    ['gerente', '%Gabriela%']
  );
  
  if (gabrielaRows.length === 0) {
    console.error('❌ No se encontró a Gabriela Bianchi como gerente');
    process.exit(1);
  }
  
  const gabrielaId = gabrielaRows[0].id;
  console.log(`✅ Encontrada Gabriela Bianchi - ID: ${gabrielaId}`);
  
  // Buscar supervisores que reportan a Gabriela
  const [supervisores] = await pool.execute(
    'SELECT id FROM users WHERE reportsTo = ?',
    [gabrielaId]
  );
  
  if (supervisores.length === 0) {
    console.error('❌ Gabriela no tiene supervisores asignados');
    process.exit(1);
  }
  
  // Buscar vendedores activos en el equipo de Gabriela
  const supervisorIds = supervisores.map(s => s.id);
  const placeholders = supervisorIds.map(() => '?').join(',');
  
  const [vendedores] = await pool.execute(
    `SELECT id, name FROM users WHERE role = 'vendedor' AND active = 1 AND reportsTo IN (${placeholders})`,
    supervisorIds
  );
  
  if (vendedores.length === 0) {
    console.error('❌ No hay vendedores activos en el equipo de Gabriela');
    process.exit(1);
  }
  
  console.log(`✅ Encontrados ${vendedores.length} vendedores activos en el equipo de Gabriela:`);
  vendedores.forEach(v => console.log(`   - ${v.name} (ID: ${v.id})`));
  
  let successCount = 0;
  let errorCount = 0;
  let vendedorIndex = 0;

  for (const lead of leads) {
    try {
      // Limpiar teléfono
      const telefono = lead.telefono.replace('+', '').replace(/\s/g, '');
      
      // Determinar fuente
      let fuente;
      switch(lead.platform) {
        case 'fb':
          fuente = 'meta';
          break;
        case 'ig':
          fuente = 'instagram';
          break;
        case 'tiktok':
          fuente = 'otro'; // TikTok no está en las opciones estándar
          break;
        default:
          fuente = 'otro';
      }
      
      // Crear notas detalladas
      const plataformaLabel = lead.platform === 'fb' ? 'Facebook' : 
                             lead.platform === 'ig' ? 'Instagram' : 
                             lead.platform === 'tiktok' ? 'TikTok' : 'Otra';
      
      const notas = `Origen: Equipo Gabriela Bianchi\nPlataforma: ${plataformaLabel}\nInfo adicional: ${lead.anticipo}`;
      
      // Asignar vendedor rotativo del equipo de Gabriela
      const vendedorAsignado = vendedores[vendedorIndex % vendedores.length];
      vendedorIndex++;
      
      // Determinar forma de pago
      const formaPago = lead.anticipo && 
                       (lead.anticipo.toLowerCase().includes('anticipo') || 
                        lead.anticipo.toLowerCase().includes('financiad')) ? 'Financiado' : 'Contado';
      
      // Determinar si tiene entrega de usado
      const tieneEntrega = lead.anticipo && 
                          (lead.anticipo.toLowerCase().includes('usado') || 
                           lead.anticipo.toLowerCase().includes('permut') ||
                           lead.anticipo.toLowerCase().includes('entrega'));
      
      // Extraer info de usado si existe
      let infoUsado = '';
      if (tieneEntrega) {
        if (lead.anticipo.toLowerCase().includes('gol')) infoUsado = 'VW Gol';
        else if (lead.anticipo.toLowerCase().includes('audi')) infoUsado = 'Audi A4';
        else if (lead.anticipo.toLowerCase().includes('citroen')) infoUsado = 'Citroen Cactus';
        else infoUsado = 'Vehículo usado';
      }
      
      // Insertar lead - SIN infoUsado y entrega que no existen en la BD
      await pool.execute(
        `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          lead.nombre,
          telefono,
          lead.modelo,
          formaPago,
          'nuevo',
          fuente,
          notas + (infoUsado ? `\nVehículo usado: ${infoUsado}` : '') + (tieneEntrega ? '\nTiene vehículo para entregar' : ''),
          vendedorAsignado.id
        ]
      );
      
      console.log(`✅ ${lead.nombre} - ${lead.modelo} - ${plataformaLabel} → ${vendedorAsignado.name}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error con ${lead.nombre}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n=============================');
  console.log(`✅ Importación completada para equipo de Gabriela Bianchi`);
  console.log(`✅ Exitosos: ${successCount} leads`);
  console.log(`❌ Errores: ${errorCount} leads`);
  console.log(`👥 Leads distribuidos entre ${vendedores.length} vendedores`);
  console.log('=============================');
  
  process.exit(0);
}

// Ejecutar
importLeadsToGabriela();