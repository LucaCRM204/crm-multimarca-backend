const bcrypt = require('bcryptjs');
const pool = require('./db');

async function resetAllPasswords() {
  try {
    // Obtener TODOS los usuarios con información de jerarquía
    const [usuarios] = await pool.execute(`
      SELECT 
        u.id, u.name, u.email, u.role, u.reportsTo,
        manager.name as manager_name,
        manager.role as manager_role
      FROM users u 
      LEFT JOIN users manager ON u.reportsTo = manager.id
      ORDER BY u.role, u.name
    `);
    
    console.log(`\n=== RESETEANDO ${usuarios.length} USUARIOS ===\n`);
    
    const credenciales = {};
    
    for (const user of usuarios) {
      let password;
      
      // Contraseñas específicas por rol
      if (user.email === 'Luca@alluma.com') {
        password = 'Luca2702'; // Mantener tu contraseña
      } else if (user.role === 'supervisor') {
        const nombre = user.name.split(' ')[0].toLowerCase();
        password = nombre + '123';
      } else if (user.role === 'vendedor') {
        const nombre = user.name.split(' ')[0].toLowerCase();
        password = nombre + '123';
      } else if (user.role === 'gerente') {
        const nombre = user.name.split(' ')[0].toLowerCase();
        password = nombre + '123';
      } else if (user.role === 'director') {
        password = 'Dona1211';
      } else {
        password = '123456';
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id]
      );
      
      if (!credenciales[user.role]) {
        credenciales[user.role] = [];
      }
      
      credenciales[user.role].push({
        nombre: user.name,
        email: user.email,
        password: password,
        reportsTo: user.reportsTo,
        manager_name: user.manager_name,
        manager_role: user.manager_role
      });
      
      console.log(`✅ ${user.role.toUpperCase()}: ${user.name} - ${user.email} - Password: ${password}`);
    }
    
    // Organizar por equipos
    const equipos = {
      'ADMINISTRACION': [],
      'EQUIPO_ROBERTO': [],
      'EQUIPO_DANIEL': []
    };
    
    // Clasificar usuarios por equipos
    usuarios.forEach(user => {
      const userData = {
        nombre: user.name,
        email: user.email,
        password: credenciales[user.role].find(u => u.email === user.email).password,
        role: user.role
      };
      
      // Clasificación por equipos
      if (user.role === 'owner' || user.role === 'director') {
        equipos.ADMINISTRACION.push(userData);
      } 
      // Equipo Roberto (Roberto Sauer y sus subordinados)
      else if (user.name === 'Roberto Sauer' || 
               (user.manager_name && user.manager_name.includes('Roberto')) ||
               (user.reportsTo === 3) || // Roberto es ID 3
               (user.reportsTo === 7)) { // supervisor1 reporta a Roberto
        equipos.EQUIPO_ROBERTO.push(userData);
      }
      // Equipo Daniel (Daniel Mottino y sus subordinados)  
      else if (user.name === 'Daniel Mottino' ||
               (user.manager_name && user.manager_name.includes('Daniel')) ||
               (user.reportsTo === 30) || // Daniel es ID 30
               (user.reportsTo === 31) || // Supervisor M1
               (user.reportsTo === 32)) { // Supervisor M2
        equipos.EQUIPO_DANIEL.push(userData);
      }
      else {
        equipos.ADMINISTRACION.push(userData);
      }
    });
    
    // Mostrar resumen por equipos
    console.log('\n=============================');
    console.log('CREDENCIALES POR EQUIPOS:');
    console.log('=============================\n');
    
    // Administración
    console.log(`🏢 ADMINISTRACIÓN (${equipos.ADMINISTRACION.length} usuarios):`);
    console.log('=====================================');
    equipos.ADMINISTRACION.forEach(u => {
      console.log(`👤 ${u.nombre} (${u.role.toUpperCase()})`);
      console.log(`📧 Email: ${u.email}`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
    
    // Equipo Roberto
    console.log(`\n🔵 EQUIPO ROBERTO (${equipos.EQUIPO_ROBERTO.length} usuarios):`);
    console.log('=====================================');
    
    // Organizar por jerarquía dentro del equipo Roberto
    const roberto = equipos.EQUIPO_ROBERTO.find(u => u.nombre === 'Roberto Sauer');
    const supervisoresRoberto = equipos.EQUIPO_ROBERTO.filter(u => u.role === 'supervisor');
    const vendedoresRoberto = equipos.EQUIPO_ROBERTO.filter(u => u.role === 'vendedor');
    
    if (roberto) {
      console.log(`👔 GERENTE: ${roberto.nombre}`);
      console.log(`📧 Email: ${roberto.email}`);
      console.log(`🔑 Password: ${roberto.password}`);
      console.log('---');
    }
    
    supervisoresRoberto.forEach(u => {
      console.log(`📋 SUPERVISOR: ${u.nombre}`);
      console.log(`📧 Email: ${u.email}`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
    
    vendedoresRoberto.forEach(u => {
      console.log(`💼 VENDEDOR: ${u.nombre}`);
      console.log(`📧 Email: ${u.email}`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
    
    // Equipo Daniel
    console.log(`\n🟡 EQUIPO DANIEL (${equipos.EQUIPO_DANIEL.length} usuarios):`);
    console.log('=====================================');
    
    // Organizar por jerarquía dentro del equipo Daniel
    const daniel = equipos.EQUIPO_DANIEL.find(u => u.nombre === 'Daniel Mottino');
    const supervisoresDaniel = equipos.EQUIPO_DANIEL.filter(u => u.role === 'supervisor');
    const vendedoresDaniel = equipos.EQUIPO_DANIEL.filter(u => u.role === 'vendedor');
    
    if (daniel) {
      console.log(`👔 GERENTE: ${daniel.nombre}`);
      console.log(`📧 Email: ${daniel.email}`);
      console.log(`🔑 Password: ${daniel.password}`);
      console.log('---');
    }
    
    supervisoresDaniel.forEach(u => {
      console.log(`📋 SUPERVISOR: ${u.nombre}`);
      console.log(`📧 Email: ${u.email}`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
    
    vendedoresDaniel.forEach(u => {
      console.log(`💼 VENDEDOR: ${u.nombre}`);
      console.log(`📧 Email: ${u.email}`);
      console.log(`🔑 Password: ${u.password}`);
      console.log('---');
    });
    
    // Resumen final
    console.log('\n📊 RESUMEN POR EQUIPOS:');
    console.log('========================');
    console.log(`🏢 Administración: ${equipos.ADMINISTRACION.length} usuarios`);
    console.log(`🔵 Equipo Roberto: ${equipos.EQUIPO_ROBERTO.length} usuarios`);
    console.log(`🟡 Equipo Daniel: ${equipos.EQUIPO_DANIEL.length} usuarios`);
    console.log(`📋 Total: ${usuarios.length} usuarios`);
    
    console.log('\n✅ TODAS LAS CONTRASEÑAS HAN SIDO RESETEADAS');
    console.log('📋 Guarda esta lista organizada por equipos!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAllPasswords();