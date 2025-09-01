const pool = require('./db');

(async () => {
  try {
    console.log('🔍 Probando conexión a la base de datos...');
    
    // Verificar conexión básica
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM leads');
    console.log('✅ Conexión DB OK. Leads en tabla:', rows[0].count);
    
    // Intentar insertar directamente
    console.log('🚀 Insertando lead de prueba...');
    const [result] = await pool.execute(
      'INSERT INTO leads (nombre, telefono, modelo, fuente, formaPago, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      ['TEST DIRECTO', '555-TEST', 'TEST MODEL', 'test', 'test pago']
    );
    console.log('✅ Insert directo OK, ID:', result.insertId);
    
    // Ver todos los leads
    console.log('📋 Consultando todos los leads...');
    const [leads] = await pool.execute('SELECT * FROM leads ORDER BY created_at DESC');
    console.log('Leads encontrados:', leads.length);
    
    if (leads.length > 0) {
      console.log('Último lead creado:', leads[0]);
    }
    
  } catch (error) {
    console.error('❌ Error de DB:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('🏁 Prueba completada');
  process.exit(0);
})();