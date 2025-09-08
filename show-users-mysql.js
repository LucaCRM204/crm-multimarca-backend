const db = require('./db.js');

async function showAllUsers() {
  let connection;
  
  try {
    console.log('🔍 Conectando a la base de datos MySQL...\n');
    
    connection = await db.getConnection();
    console.log('✅ Conectado a MySQL exitosamente.\n');

    // Consultar todos los usuarios
    const [users] = await connection.execute(`
      SELECT id, name, email, role, reportsTo, active 
      FROM users 
      ORDER BY 
        CASE role 
          WHEN 'owner' THEN 1
          WHEN 'director' THEN 2
          WHEN 'gerente' THEN 3
          WHEN 'supervisor' THEN 4
          WHEN 'vendedor' THEN 5
          ELSE 6
        END,
        name
    `);

    if (users.length === 0) {
      console.log('📭 No se encontraron usuarios en la base de datos.');
      return;
    }

    console.log('👥 LISTA DE USUARIOS DEL CRM');
    console.log('═'.repeat(80));
    console.log();

    // Agrupar por rol
    const usersByRole = users.reduce((acc, user) => {
      if (!acc[user.role]) acc[user.role] = [];
      acc[user.role].push(user);
      return acc;
    }, {});

    const roleOrder = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'];
    const roleNames = {
      owner: '👑 DUEÑO',
      director: '🎯 DIRECTOR',
      gerente: '👔 GERENTE', 
      supervisor: '📋 SUPERVISOR',
      vendedor: '💼 VENDEDOR'
    };

    roleOrder.forEach(role => {
      if (usersByRole[role]) {
        console.log(`${roleNames[role] || role.toUpperCase()}`);
        console.log('─'.repeat(40));
        
        usersByRole[role].forEach(user => {
          const status = user.active ? '🟢 Activo' : '🔴 Inactivo';
          const reportsTo = user.reportsTo ? `Reporta a: ID ${user.reportsTo}` : 'Sin supervisor';
          
          console.log(`📧 Email: ${user.email}`);
          console.log(`👤 Nombre: ${user.name}`);
          console.log(`🔢 ID: ${user.id}`);
          console.log(`📊 Estado: ${status}`);
          console.log(`🔗 ${reportsTo}`);
          console.log('─'.repeat(40));
        });
        console.log();
      }
    });

    // Obtener información adicional sobre relaciones
    console.log('🔐 CREDENCIALES DE ACCESO');
    console.log('═'.repeat(80));
    console.log();
    console.log('⚠️  IMPORTANTE: Las contraseñas están hasheadas en la DB.');
    console.log('💡 Contraseñas por defecto suelen ser: 123456, password, admin');
    console.log('💡 Puedes resetear contraseñas usando reset-password-mysql.js');
    console.log();
    
    console.log('📋 RESUMEN:');
    console.log(`Total de usuarios: ${users.length}`);
    console.log(`Activos: ${users.filter(u => u.active).length}`);
    console.log(`Inactivos: ${users.filter(u => !u.active).length}`);
    console.log();

    // Mostrar estructura jerárquica
    console.log('🌳 ESTRUCTURA ORGANIZACIONAL');
    console.log('═'.repeat(80));
    
    function printHierarchy(users, parentId = null, indent = '') {
      const children = users.filter(u => u.reportsTo === parentId);
      children.forEach((user, index) => {
        const isLast = index === children.length - 1;
        const prefix = indent + (isLast ? '└── ' : '├── ');
        const nextIndent = indent + (isLast ? '    ' : '│   ');
        
        console.log(`${prefix}${user.name} (${user.email}) - ${user.role.toUpperCase()}`);
        printHierarchy(users, user.id, nextIndent);
      });
    }
    
    printHierarchy(users);
    console.log();

    // Obtener estadísticas de leads si existe la tabla
    try {
      const [leads] = await connection.execute(`
        SELECT l.*, u.name as vendedor_name 
        FROM leads l 
        LEFT JOIN users u ON l.assigned_to = u.id
      `);

      console.log('📊 ESTADÍSTICAS DE LEADS');
      console.log('═'.repeat(80));
      
      const vendedores = users.filter(u => u.role === 'vendedor');
      vendedores.forEach(vendedor => {
        const vendedorLeads = leads.filter(l => l.assigned_to === vendedor.id);
        const ventasCount = vendedorLeads.filter(l => l.estado === 'vendido').length;
        const conversion = vendedorLeads.length > 0 ? ((ventasCount / vendedorLeads.length) * 100).toFixed(1) : '0';
        
        console.log(`👤 ${vendedor.name}`);
        console.log(`   📧 ${vendedor.email}`);
        console.log(`   📋 ${vendedorLeads.length} leads asignados`);
        console.log(`   💰 ${ventasCount} ventas`);
        console.log(`   📈 ${conversion}% conversión`);
        console.log('─'.repeat(40));
      });
      console.log();
    } catch (leadError) {
      console.log('⚠️  No se pudieron cargar estadísticas de leads (tabla puede no existir)');
      console.log();
    }

    console.log('💡 Para usar estas credenciales:');
    console.log('   1. Ve a tu CRM en el navegador');
    console.log('   2. Usa el email del usuario');
    console.log('   3. Prueba contraseñas: 123456, password, admin');
    console.log('   4. Si no funciona, usa reset-password-mysql.js');

  } catch (error) {
    console.error('❌ Error al consultar la base de datos:', error.message);
    console.log('');
    console.log('🔍 POSIBLES CAUSAS:');
    console.log('   - Base de datos no disponible');
    console.log('   - Tabla users no existe');
    console.log('   - Credenciales incorrectas en .env');
    console.log('   - Conexión de red');
  } finally {
    if (connection) {
      connection.release();
      console.log('\n🔒 Conexión cerrada.');
    }
  }
}

// Ejecutar el script
showAllUsers();