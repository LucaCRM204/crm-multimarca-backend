const pool = require('./db');

async function importLeadsConNombres() {
  const leads = [
    // POLO de Facebook
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "analia isla", telefono: "011 2249-7542"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "Alfredo Jose Cardinali", telefono: "0223 497-4527"},
    {origen: "fb", modelo: "Polo", pago: "USADO +ANTICIPO", nombre: "JAVIER TOLEDO", telefono: "0351 15-816-6216"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "Laura Ester Unquen Rivera", telefono: "02901 52-6705"},
    {origen: "fb", modelo: "Polo", pago: "USADO", nombre: "Constanza Miranda", telefono: "0263 463-5136"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "Romero Carlos", telefono: "03837 69-9498"},
    {origen: "fb", modelo: "Polo", pago: "USADO 2015", nombre: "Samuel Ortiz", telefono: "0370 462-3037"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "Vanina Bengolea", telefono: "03382 40-5363"},
    {origen: "fb", modelo: "Polo", pago: "USADO", nombre: "Susana Garcia", telefono: "0260 438-5573"},
    {origen: "fb", modelo: "Polo", pago: "USADO", nombre: "Mario Gonza", telefono: "02945 54-7310"},
    {origen: "fb", modelo: "Polo", pago: "USADO", nombre: "Javi Rojas", telefono: "0387 467-5933"},
    {origen: "fb", modelo: "Polo", pago: "USADO", nombre: "Carlos José Mallorca", telefono: "0379 467-4415"},
    {origen: "fb", modelo: "Polo", pago: "", nombre: "Estela Cristina Peirone Zorzenon", telefono: "3584011846"},
    {origen: "fb", modelo: "Polo", pago: "reciben plan de ahorro toyota con 56 cuotas pagas de 84", nombre: "Diego Eduardo Gutierrez", telefono: "2942469605"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", nombre: "Belén Lopez", telefono: "541157970913"},
    {origen: "fb", modelo: "Polo", pago: "Anticipo", nombre: "Veronica Abadia", telefono: "542922453330"},
    {origen: "fb", modelo: "Polo", pago: "si un gol power 2009", nombre: "Omar Miranda", telefono: "542615382166"},
    {origen: "fb", modelo: "Polo", pago: "un usado, Suran trendline 2013 única mano", nombre: "Florencia Villalobos", telefono: "542984910127"},
    {origen: "fb", modelo: "Polo", pago: "Me interesa .NO QUIERO NINGUN PLAN", nombre: "Man Sara", telefono: "543436666669"},
    {origen: "fb", modelo: "Polo", pago: "SI", nombre: "Ricardo Retamales", telefono: "542616367222"},
    {origen: "fb", modelo: "Polo", pago: "No", nombre: "Ramiro Sporting", telefono: "542254613345"},
    {origen: "fb", modelo: "Polo", pago: "", nombre: "Maria Caceres", telefono: "541167203119"},
    {origen: "fb", modelo: "Polo", pago: "NO TENGO ANTICIPO", nombre: "Mili Cilenetti", telefono: "542235045186"},
    {origen: "fb", modelo: "Polo", pago: "NO TENGO ANTICIPO", nombre: "Ruben Silvestri", telefono: "541150399517"},
    {origen: "fb", modelo: "Polo", pago: "anticipo", nombre: "Gonzalo Ruiiz", telefono: "543516799723"},
    
    // POLO de Instagram
    {origen: "ig", modelo: "Polo", pago: "anticipo", nombre: "huer", telefono: "5493884131674"},
    {origen: "ig", modelo: "Polo", pago: "Usado", nombre: "Nadia Ximena Castro", telefono: "542976244613"},
    {origen: "ig", modelo: "Polo", pago: "Usado", nombre: "Pedro Martínez", telefono: "541132906561"},
    {origen: "ig", modelo: "Polo", pago: "Usado", nombre: "Ruben Silvestri", telefono: "541150399517"},
    {origen: "ig", modelo: "Polo", pago: "No tengo usado", nombre: "Cecilia Gomez", telefono: "543482318585"},
    {origen: "ig", modelo: "Polo", pago: "Si", nombre: "Rama", telefono: "543813467393"},
    {origen: "ig", modelo: "Polo", pago: "anticipo", nombre: "Aleee", telefono: "543865566161"},
    
    // TERA de Facebook
    {origen: "fb", modelo: "Tera", pago: "Usado", nombre: "GONZALEZ RODOLFO", telefono: "543814132837"},
    {origen: "fb", modelo: "Tera", pago: "Usado", nombre: "Ariadna Avila", telefono: "542996544961"},
    {origen: "fb", modelo: "Tera", pago: "Usado", nombre: "Man Sarax", telefono: "543435666669"},
    {origen: "fb", modelo: "Tera", pago: "wy", nombre: "Man Sara", telefono: "543466999859"},
    {origen: "fb", modelo: "Tera", pago: "Ecosport 2010", nombre: "Maria Ruth Rocha Gonzales", telefono: "542915035185"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", nombre: "Claudio Tejada", telefono: "542666188926"},
    {origen: "fb", modelo: "Tera", pago: "Información", nombre: "Nicolee Nieva", telefono: "541149494186"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", nombre: "Diego Eduardo Gutierrez", telefono: "542942469605"},
    {origen: "fb", modelo: "Tera", pago: "Hola tengo un Toyota Etios corto 2021 versión x", nombre: "Mili V. Acevedo", telefono: "543794223498"},
    {origen: "fb", modelo: "Tera", pago: "Usado", nombre: "Eric Herrera", telefono: "541132691741"},
    {origen: "fb", modelo: "Tera", pago: "Info", nombre: "Javier mesa", telefono: "542604587940"},
    {origen: "fb", modelo: "Tera", pago: "usado", nombre: "Estela Cristina Peirone Zorzenon", telefono: "543584011846"},
    {origen: "fb", modelo: "Tera", pago: "reciben plan de ahorro toyota con 56 cuotas pagas de 84", nombre: "Belén Lopez", telefono: "541157970913"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", nombre: "Emi Pignatta", telefono: "543492207364"},
    {origen: "fb", modelo: "Tera", pago: "", nombre: "Eli Comoglio", telefono: "543876830754"},
    {origen: "fb", modelo: "Tera", pago: "", nombre: "Vanesa Barrera", telefono: "542634245990"},
    {origen: "fb", modelo: "Tera", pago: "", nombre: "Lubo Lorenzo", telefono: "0280 470-5006"},
    
    // TERA de Instagram
    {origen: "ig", modelo: "Tera", pago: "si", nombre: "Lorena Peña", telefono: "3549572962"},
    {origen: "ig", modelo: "Tera", pago: "SIN ANTICIPO", nombre: "Gabriela Serio", telefono: "541132006133"},
    {origen: "ig", modelo: "Tera", pago: "Usado", nombre: "Carli", telefono: "3624628261"},
    {origen: "ig", modelo: "Tera", pago: "ncnvnv", nombre: "Mauricio Flores", telefono: "542622571834"},
    {origen: "ig", modelo: "Tera", pago: "usado", nombre: "Vane Iñigo", telefono: "5493516718516"},
    {origen: "ig", modelo: "Tera", pago: "anticipo", nombre: "Franco González", telefono: "543454744471"},
    {origen: "ig", modelo: "Tera", pago: "Usado", nombre: "Nancy Ismael", telefono: "543815712846"},
    {origen: "ig", modelo: "Tera", pago: "si", nombre: "Paula Arezzo", telefono: "542625408538"},
    {origen: "ig", modelo: "Tera", pago: "si", nombre: "Leo Ant", telefono: "50544428"},
    {origen: "ig", modelo: "Tera", pago: "cuento con usado", nombre: "Lautii Raimondi", telefono: "2233436856"},
    {origen: "ig", modelo: "Tera", pago: "Si", nombre: "Hernan Rodriguez", telefono: "543547576903"},
    {origen: "ig", modelo: "Tera", pago: "anticipo", nombre: "Florencio Montiel", telefono: "543455406647"},
    
    // POLO de TikTok
    {origen: "tiktok", modelo: "Polo", pago: "", nombre: "Alejandro", telefono: "1170377740"},
    {origen: "tiktok", modelo: "Polo", pago: "", nombre: "Nelson", telefono: "1120226091"},
    {origen: "tiktok", modelo: "Polo", pago: "", nombre: "Walter", telefono: "1128563975"}
  ];

  console.log(`Procesando ${leads.length} leads...`);
  
  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

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
      } else if (telefono.startsWith('0')) {
        telefono = telefono.substring(1);
      }
      
      // Asignación round-robin
      let assigned_to = null;
      if (vendedores.length > 0) {
        assigned_to = vendedores[vendorIndex % vendedores.length].id;
        vendorIndex++;
      }
      
      // Determinar fuente
      let fuente;
      if (lead.origen === 'fb') {
        fuente = 'meta';
      } else if (lead.origen === 'ig') {
        fuente = 'instagram';
      } else if (lead.origen === 'tiktok') {
        fuente = 'otro'; 
      }
      
      // Insertar lead
      await pool.execute(
        `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          lead.nombre,
          telefono,
          lead.modelo, // Mantener Tera o Polo exacto
          'Consultar',
          'nuevo',
          fuente,
          `Info: ${lead.pago}\nOrigen: ${lead.origen === 'fb' ? 'Facebook' : lead.origen === 'ig' ? 'Instagram' : 'TikTok'}`,
          assigned_to
        ]
      );
      
      console.log(`✅ ${lead.nombre} - ${lead.modelo} - ${fuente}`);
      successCount++;
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️ Duplicado: ${lead.nombre} - Tel: ${lead.telefono}`);
        duplicateCount++;
      } else {
        console.error(`❌ Error con ${lead.nombre}:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log('\n=============================');
  console.log(`✅ Importación completada`);
  console.log(`✅ Exitosos: ${successCount} leads`);
  console.log(`⚠️ Duplicados: ${duplicateCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`📊 Total procesados: ${leads.length}`);
  console.log('=============================');
  
  process.exit(0);
}

importLeadsConNombres();
