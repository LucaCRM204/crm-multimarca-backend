const bcrypt = require('bcryptjs');
const pool = require('./db');

async function resetAllPasswords() {
  try {
    // Obtener TODOS los usuarios
    const [usuarios] = await pool.execute(
      'SELECT id, name, email, role FROM users ORDER BY role, name'
    );
    
    console.log(`\n=== RESETEANDO ${usuarios.length} USUARIOS ===\n`);
    
    const credenciales = {};
    
    for (const user of usuarios) {
      let password;
      
      // Contraseñas específicas por rol
      if (user.email === 'Luca@alluma.com') {
        password = 'Luca2702'; // Mantener tu contraseña
      } else if (user.role === 'supervisor') {
        password = 'supervisor123';
      } else if (user.role === 'vendedor') {
        const nombre = user.name.split(' ')[0].toLowerCase();
        password = nombre + '123';
      } else if (user.role === 'gerente') {
        password = 'gerente123';
      } else if (user.role === 'director') {
        password = 'director123';
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
        password: password
      });
      
      console.log(`✅ ${user.role.toUpperCase()}: ${user.name} - ${user.email} - Password: ${password}`);
    }
    
    // Mostrar resumen
    console.log('\n=============================');
    console.log('RESUMEN POR ROL:');
    console.log('=============================\n');
    
    Object.keys(credenciales).forEach(rol => {
      console.log(`\n${rol.toUpperCase()}S (${credenciales[rol].length}):`);
      console.log('------------------------');
      credenciales[rol].forEach(u => {
        console.log(`Email: ${u.email}`);
        console.log(`Password: ${u.password}`);
        console.log('---');
      });
    });
    
    console.log('\n✅ TODAS LAS CONTRASEÑAS HAN SIDO RESETEADAS');
    console.log('📋 Guarda esta lista!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetAllPasswords();
