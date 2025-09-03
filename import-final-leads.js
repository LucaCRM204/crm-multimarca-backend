const pool = require('./db');

async function importAllLeads() {
  const leads = [
    // POLO de Facebook
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "011 2249-7542"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "0223 497-4527"},
    {origen: "fb", modelo: "Polo", pago: "USADO +ANTICIPO", telefono: "0351 15-816-6216"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "02901 52-6705"},
    {origen: "fb", modelo: "Polo", pago: "USADO", telefono: "0263 463-5136"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "03837 69-9498"},
    {origen: "fb", modelo: "Polo", pago: "USADO 2015", telefono: "0370 462-3037"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "03382 40-5363"},
    {origen: "fb", modelo: "Polo", pago: "USADO", telefono: "0260 438-5573"},
    {origen: "fb", modelo: "Polo", pago: "USADO", telefono: "02945 54-7310"},
    {origen: "fb", modelo: "Polo", pago: "USADO", telefono: "0387 467-5933"},
    {origen: "fb", modelo: "Polo", pago: "USADO", telefono: "0379 467-4415"},
    {origen: "fb", modelo: "Polo", pago: "", telefono: "3584011846"},
    {origen: "fb", modelo: "Polo", pago: "reciben plan de ahorro toyota con 56 cuotas pagas de 84", telefono: "2942469605"},
    {origen: "fb", modelo: "Polo", pago: "ANTICIPO", telefono: "541157970913"},
    {origen: "fb", modelo: "Polo", pago: "Anticipo", telefono: "542922453330"},
    {origen: "fb", modelo: "Polo", pago: "si un gol power 2009", telefono: "542615382166"},
    {origen: "fb", modelo: "Polo", pago: "un usado, Suran trendline 2013 única mano", telefono: "542984910127"},
    {origen: "fb", modelo: "Polo", pago: "Me interesa .NO QUIERO NINGUN PLAN .Entrega de usado y dinero", telefono: "543436666669"},
    {origen: "fb", modelo: "Polo", pago: "SI", telefono: "542616367222"},
    {origen: "fb", modelo: "Polo", pago: "Ramiro Sporting", nombre: "Ramiro Sporting", telefono: "542254613345"},
    {origen: "fb", modelo: "Polo", pago: "Maria Caceres", nombre: "Maria Caceres", telefono: "541167203119"},
    
    // POLO de Instagram
    {origen: "ig", modelo: "Polo", pago: "anticipo", telefono: "5493884131674"},
    {origen: "ig", modelo: "Polo", pago: "Usado", telefono: "542976244613"},
    {origen: "ig", modelo: "Polo", pago: "Usado", telefono: "541132906561"},
    {origen: "ig", modelo: "Polo", pago: "Usado", telefono: "541150399517"},
    {origen: "ig", modelo: "Polo", pago: "No tengo usado", telefono: "543482318585"},
    {origen: "ig", modelo: "Polo", pago: "Si", telefono: "543813467393"},
    
    // TERA de Facebook
    {origen: "fb", modelo: "Tera", pago: "Usado", telefono: "543814132837"},
    {origen: "fb", modelo: "Tera", pago: "Usado", telefono: "542996544961"},
    {origen: "fb", modelo: "Tera", pago: "Usado", telefono: "543435666669"},
    {origen: "fb", modelo: "Tera", pago: "wy", telefono: "543466999859"},
    {origen: "fb", modelo: "Tera", pago: "Ecosport 2010", telefono: "542915035185"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", telefono: "542666188926"},
    {origen: "fb", modelo: "Tera", pago: "Información", telefono: "541149494186"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", telefono: "542942469605"},
    {origen: "fb", modelo: "Tera", pago: "Hola tengo un Toyota Etios corto 2021 versión x", telefono: "543794223498"},
    {origen: "fb", modelo: "Tera", pago: "Usado", telefono: "541132691741"},
    {origen: "fb", modelo: "Tera", pago: "Info", telefono: "542604587940"},
    {origen: "fb", modelo: "Tera", pago: "usado", telefono: "543584011846"},
    {origen: "fb", modelo: "Tera", pago: "reciben plan de ahorro toyota con 56 cuotas pagas de 84", telefono: "541157970913"},
    {origen: "fb", modelo: "Tera", pago: "Anticipo", telefono: "543492207364"},
    {origen: "fb", modelo: "Tera", pago: "Eli Comoglio", nombre: "Eli Comoglio", telefono: "543876830754"},
    {origen: "fb", modelo: "Tera", pago: "Vanesa Barrera", nombre: "Vanesa Barrera", telefono: "542634245990"},
    {origen: "fb", modelo: "Tera", pago: "Lubo Lorenzo", nombre: "Lubo Lorenzo", telefono: "0280 470-5006"},
    
    // TERA de Instagram
    {origen: "ig", modelo: "Tera", pago: "si", telefono: "3549572962"},
    {origen: "ig", modelo: "Tera", pago: "SIN ANTICIPO", telefono: "541132006133"},
    {origen: "ig", modelo: "Tera", pago: "Usado", telefono: "3624628261"},
    {origen: "ig", modelo: "Tera", pago: "ncnvnv", telefono: "542622571834"},
    {origen: "ig", modelo: "Tera", pago: "usado", telefono: "5493516718516"},
    {origen: "ig", modelo: "Tera", pago: "anticipo", telefono: "543454744471"},
    {origen: "ig", modelo: "Tera", pago: "Usado", telefono: "543815712846"},
    {origen: "ig", modelo: "Tera", pago: "si", telefono: "542625408538"},
    {origen: "ig", modelo: "Tera", pago: "si", telefono: "50544428"},
    {origen: "ig", modelo: "Tera", pago: "cuento con usado", telefono: "2233436856"},
    {origen: "ig", modelo: "Tera", pago: "Si", telefono: "543547576903"},
    
    // POLO de TikTok
    {origen: "tiktok", modelo: "Polo", pago: "ALEJANDRO MARCOS ANTONIO", nombre: "ALEJANDRO MARCOS ANTONIO", telefono: "1170377740"},
    {origen: "tiktok", modelo: "Polo", pago: "NELSON", nombre: "NELSON", telefono: "1120226091"},
    {origen: "tiktok", modelo: "Polo", pago: "WALTER", nombre: "WALTER", telefono: "1128563975"}
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
        fuente = 'otro'; // O puedes agregar 'tiktok' a las fuentes
      }
      
      // Nombre - usar el que viene o "Sin nombre"
      const nombre = lead.nombre || 'Sin nombre';
      
      // Insertar lead
      await pool.execute(
        `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          nombre,
          telefono,
          lead.modelo, // Mantener Tera o Polo exacto
          'Consultar',
          'nuevo',
          fuente,
          `Info: ${lead.pago}\nOrigen: ${lead.origen === 'fb' ? 'Facebook' : lead.origen === 'ig' ? 'Instagram' : 'TikTok'}`,
          assigned_to
        ]
      );
      
      console.log(`✅ ${nombre} - ${lead.modelo} - ${fuente}`);
      successCount++;
      
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️ Duplicado: ${lead.nombre || 'Sin nombre'} - ${lead.telefono}`);
        duplicateCount++;
      } else {
        console.error(`❌ Error:`, error.message);
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

importAllLeads();
