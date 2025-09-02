const pool = require('./db');

async function importLeads() {
  // Array con todos los leads
  const leads = [
   {modelo: "polo", platform: "fb", anticipo: "no", nombre: "Daniela Bastiani", telefono: "+543794753755"},
    {modelo: "tera", platform: "ig", anticipo: "No", nombre: "Melina Molina", telefono: "+543425235830"},
    {modelo: "polo", platform: "ig", anticipo: "Si", nombre: "Iiliana Najera", telefono: "+542223428233"},
    {modelo: "tera", platform: "ig", anticipo: "Yo tengo un gol trend serie 2017 con 130000km", nombre: "raúl Alberto cortez", telefono: "+5491130727780"},
    {modelo: "tera", platform: "fb", anticipo: "usado", nombre: "Lubo Lorenzo", telefono: "+542804705006"},
    {modelo: "polo", platform: "fb", anticipo: "No", nombre: "Lucia Arregui", telefono: "+542233552036"},
    {modelo: "tera", platform: "fb", anticipo: "usado + anticipo", nombre: "Alfredo Jose Cardinali", telefono: "+542234974527"},
    {modelo: "tera", platform: "ig", anticipo: "Si", nombre: "Turi", telefono: "+543743512896"},
    {modelo: "tera", platform: "ig", anticipo: "Y luego del anticipo cuantas cuotas Gracias", nombre: "Vanesa Castañeda", telefono: "+543813641965"},
    {modelo: "tera", platform: "fb", anticipo: "Anticipo", nombre: "Javier Toledo", telefono: "+5493518166216"},
    {modelo: "tera", platform: "fb", anticipo: "Con usado", nombre: "Laura Ester Unquen Rivera", telefono: "+542901526705"},
    {modelo: "polo", platform: "fb", anticipo: "anticipo", nombre: "Constanza Miranda", telefono: "+542634635136"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Jorge A Freyre.", telefono: "+542314476549"},
    {modelo: "tera", platform: "fb", anticipo: "Usado 2015", nombre: "Romero Carlos", telefono: "+543837699498"},
    {modelo: "tera", platform: "ig", anticipo: "Información", nombre: "Guady Sierra", telefono: "+543815274360"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Carolina Benavidez", telefono: "+543512138055"},
    {modelo: "polo", platform: "fb", anticipo: "usado", nombre: "Raul Fernando Sosa", telefono: "+542974585167"},
    {modelo: "tera", platform: "ig", anticipo: "Más información??", nombre: "Patricia Domesi", telefono: "+543471527790"},
    {modelo: "polo", platform: "fb", anticipo: "no", nombre: "Nahuel Martinez", telefono: "+542915096306"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "natpesa", telefono: "2215404155"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Florencia Colautti", telefono: "3476536823"},
    {modelo: "polo", platform: "fb", anticipo: "anticipo", nombre: "Samuel Ortiz", telefono: "+543704623037"},
    {modelo: "tera", platform: "ig", anticipo: "Info", nombre: "Leo Cogorno", telefono: "+543444628217"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Laura Valis", telefono: "+543413377110"},
    {modelo: "tera", platform: "fb", anticipo: "usado", nombre: "Vanina Bengolea", telefono: "+543382405363"},
    {modelo: "tera", platform: "fb", anticipo: "usado", nombre: "Susana Garcia", telefono: "+542604385573"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Cari Coli", telefono: "+543416258127"},
    {modelo: "tera", platform: "fb", anticipo: "anticipo", nombre: "Carlos José Mallorca", telefono: "+543794674415"},
    {modelo: "polo", platform: "fb", anticipo: "usado", nombre: "Mario Gonza", telefono: "+542945547310"},
    {modelo: "polo", platform: "ig", anticipo: "Usado", nombre: "Eliana Arias", telefono: "+543416619211"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Sole Caprio", telefono: "+5493425303757"},
    {modelo: "tera", platform: "ig", anticipo: "Hola buenas noches entregando un anticipo y cuotas retiras", nombre: "Veronica Silva", telefono: "+542215421597"},
    {modelo: "tera", platform: "ig", anticipo: "Usado y anticipo", nombre: "Romi Asmus", telefono: "+543364291124"},
    {modelo: "tera", platform: "ig", anticipo: "Compro", nombre: "Sergio Contreras", telefono: "+542995011048"},
    {modelo: "polo", platform: "fb", anticipo: "anticipo", nombre: "Sofia Lopez", telefono: "+543518516860"},
    {modelo: "polo", platform: "ig", anticipo: "Me interesaria saber", nombre: "Cristian Gonzalez", telefono: "+542235999955"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Rosana Moràn", telefono: "2646220297"},
    {modelo: "tera", platform: "fb", anticipo: "anticipo", nombre: "Javi Rojas", telefono: "+543874675933"},
    {modelo: "polo", platform: "ig", anticipo: "Usado", nombre: "Marcelo Torres", telefono: "+542996324403"},
    {modelo: "tera", platform: "ig", anticipo: "Usado", nombre: "Cristian Garin Martinez", telefono: "+541134520608"},
    {modelo: "tera", platform: "ig", anticipo: "Si", nombre: "Sergio Anibal Martinez", telefono: "+543757405791"},
    {modelo: "tera", platform: "ig", anticipo: "No", nombre: "ohmestudio", telefono: "3437411247"},
    {modelo: "tera", platform: "fb", anticipo: "si", nombre: "Paula Martínez", telefono: "+542396487620"},
    {modelo: "tera", platform: "fb", anticipo: "usado", nombre: "NELIDA Baliosian", telefono: "+543515146278"}
  ];

  console.log(`Procesando ${leads.length} leads de CM (200)...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    try {
      // Limpiar teléfono
      const telefono = lead.telefono.replace('p:', '').replace('+', '');
      
      // Determinar fuente
      const fuente = lead.platform === 'fb' ? 'facebook-200' : 'instagram-200';
      
      // Determinar modelo correcto
      const modelo = lead.modelo === 'tera' ? 'T-Cross' : 'Polo';
      
      // Crear notas
      const notas = `Origen: CM (200)\nPlataforma: ${lead.platform === 'fb' ? 'Facebook' : 'Instagram'}\nInfo adicional: ${lead.anticipo}`;
      
      // Obtener vendedor aleatorio
      const [vendedores] = await pool.execute(
        'SELECT id FROM users WHERE role = ? AND active = 1',
        ['vendedor']
      );
      
      let assigned_to = null;
      if (vendedores.length > 0) {
        const randomIndex = Math.floor(Math.random() * vendedores.length);
        assigned_to = vendedores[randomIndex].id;
      }
      
      // Insertar lead
      await pool.execute(
        `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          lead.nombre,
          telefono,
          modelo,
          'Consultar',
          'nuevo',
          fuente,
          notas,
          assigned_to
        ]
      );
      
      console.log(`✅ ${lead.nombre} - ${modelo} - ${fuente}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error con ${lead.nombre}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n=============================');
  console.log(`✅ Importación completada`);
  console.log(`✅ Exitosos: ${successCount} leads`);
  console.log(`❌ Errores: ${errorCount} leads`);
  console.log('=============================');
  
  process.exit(0);
}

// Ejecutar
importLeads();
