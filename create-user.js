const db = require('./db.js');
const bcrypt = require('bcrypt');

// Obtener argumentos de línea de comandos
const args = process.argv.slice(2);

async function createUser() {
  // Verificar argumentos
  if (args.length < 4 || args.includes('--help') || args.includes('-h')) {
    console.log('📖 CREAR NUEVO USUARIO');
    console.log('═'.repeat(40));
    console.log();
    console.log('💡 USO:');
    console.log('   node create-user.js <email> <nombre> <rol> <contraseña> [reporta_a_id]');
    console.log();
    console.log('📝 ROLES DISPONIBLES:');
    console.log('   - owner     (Dueño - máximo nivel)');
    console.log('   - director  (Director)');
    console.log('   - gerente   (Gerente)');
    console.log('   - supervisor (Supervisor)');
    console.log('   - vendedor  (Vendedor)');
    console.log();
    console.log('📋 EJEMPLOS:');
    console.log('   node create-user.js juan@alluma.com "Juan Pérez" vendedor 123456 7');
    console.log('   node create-user.js maria@alluma.com "Maria García" supervisor password123 3');
    console.log('   node create-user.js admin@alluma.com "Nuevo Admin" director admin123 1');
    console.log();
    console.log('💡 NOTAS:');
    console.log('   - El último parámetro [reporta_a_id] es opcional');
    console.log('   - Si no se especifica reporta_a_id, se asignará automáticamente');
    console.log('   - Usa show-users-mysql.js para ver los IDs disponibles');
    process.exit(0);
  }

  const [email, nombre, rol, contraseña, reportsToId] = args;
  let connection;

  try {
    console.log('👤 CREANDO NUEVO USUARIO');
    console.log('═'.repeat(40));
    console.log();

    connection = await db.getConnection();
    console.log('✅ Conectado a MySQL exitosamente.');

    // Validar rol
    const validRoles = ['owner', 'director', 'gerente', 'supervisor', 'vendedor'];
    if (!validRoles.includes(rol)) {
      console.log('❌ Rol inválido. Roles válidos:', validRoles.join(', '));
      return;
    }

    // Verificar si el email ya existe
    const [existingUsers] = await connection.execute(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      console.log(`❌ Ya existe un usuario con email: ${email}`);
      console.log(`   ID existente: ${existingUsers[0].id}`);
      return;
    }

    // Determinar a quién reporta automáticamente si no se especifica
    let finalReportsTo = null;
    
    if (reportsToId) {
      // Verificar que el usuario padre existe
      const [parentUser] = await connection.execute(
        'SELECT id, name, role FROM users WHERE id = ?',
        [parseInt(reportsToId)]
      );
      
      if (parentUser.length === 0) {
        console.log(`❌ No existe usuario con ID: ${reportsToId}`);
        return;
      }
      
      finalReportsTo = parseInt(reportsToId);
      console.log(`👥 Reportará a: ${parentUser[0].name} (${parentUser[0].role})`);
    } else {
      // Asignación automática según jerarquía
      if (rol === 'director') {
        const [owners] = await connection.execute("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
        finalReportsTo = owners.length > 0 ? owners[0].id : null;
      } else if (rol === 'gerente') {
        const [directors] = await connection.execute("SELECT id FROM users WHERE role = 'director' LIMIT 1");
        finalReportsTo = directors.length > 0 ? directors[0].id : null;
      } else if (rol === 'supervisor') {
        const [managers] = await connection.execute("SELECT id FROM users WHERE role = 'gerente' LIMIT 1");
        finalReportsTo = managers.length > 0 ? managers[0].id : null;
      } else if (rol === 'vendedor') {
        const [supervisors] = await connection.execute("SELECT id FROM users WHERE role = 'supervisor' LIMIT 1");
        finalReportsTo = supervisors.length > 0 ? supervisors[0].id : null;
      }
      
      if (finalReportsTo) {
        const [autoParent] = await connection.execute("SELECT name, role FROM users WHERE id = ?", [finalReportsTo]);
        console.log(`🤖 Asignación automática - Reportará a: ${autoParent[0].name} (${autoParent[0].role})`);
      }
    }

    // Hashear la contraseña
    console.log('🔐 Hasheando contraseña...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(contraseña, saltRounds);

    // Crear el usuario
    const [result] = await connection.execute(`
      INSERT INTO users (name, email, password, role, reportsTo, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    `, [nombre, email, hashedPassword, rol, finalReportsTo]);

    console.log();
    console.log('✅ Usuario creado exitosamente!');
    console.log('─'.repeat(40));
    console.log(`🆔 ID: ${result.insertId}`);
    console.log(`👤 Nombre: ${nombre}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🎭 Rol: ${rol}`);
    console.log(`🔑 Contraseña: ${contraseña}`);
    console.log(`👥 Reporta a ID: ${finalReportsTo || 'Nadie'}`);
    console.log(`📊 Estado: Activo`);
    console.log();

    // Mostrar jerarquía actualizada para este usuario
    if (finalReportsTo) {
      const [hierarchy] = await connection.execute(`
        SELECT u1.name as usuario, u1.role as usuario_rol, 
               u2.name as jefe, u2.role as jefe_rol
        FROM users u1 
        LEFT JOIN users u2 ON u1.reportsTo = u2.id 
        WHERE u1.id = ?
      `, [result.insertId]);

      if (hierarchy.length > 0) {
        console.log('🌳 UBICACIÓN EN JERARQUÍA:');
        console.log(`   ${hierarchy[0].jefe} (${hierarchy[0].jefe_rol})`);
        console.log(`   └── ${hierarchy[0].usuario} (${hierarchy[0].usuario_rol}) ← NUEVO`);
        console.log();
      }
    }

    console.log('🎯 PRÓXIMOS PASOS:');
    console.log('   1. El usuario ya puede ingresar al CRM');
    console.log('   2. Usa las credenciales mostradas arriba');
    console.log('   3. Recomienda cambiar la contraseña desde el sistema');
    console.log(`   4. Usa show-users-mysql.js para ver la estructura actualizada`);

  } catch (error) {
    console.error('❌ Error al crear usuario:', error.message);
    
    if (error.code === 'ER_DUP_ENTRY') {
      console.log('💡 El email ya existe en la base de datos');
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      console.log('💡 El ID del supervisor especificado no existe');
    } else {
      console.log('💡 Verifica la conexión a la base de datos y los datos ingresados');
    }
  } finally {
    if (connection) {
      connection.release();
      console.log('\n🔒 Conexión cerrada.');
    }
  }
}

// Ejecutar el script
createUser();