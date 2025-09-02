const bcrypt = require('bcryptjs');
const pool = require('./db');

async function resetPasswords() {
  try {
    // Obtener todos los vendedores
    const [vendedores] = await pool.execute(
      'SELECT id, name, email FROM users WHERE role = ?',
      ['vendedor']
    );
    
    console.log(`Reseteando contraseñas para ${vendedores.length} vendedores...`);
    
    for (const vendedor of vendedores) {
      // Crear contraseña simple: primera parte del nombre + 123
      const nombre = vendedor.name.split(' ')[0].toLowerCase();
      const password = nombre + '123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, vendedor.id]
      );
      
      console.log(`✅ ${vendedor.name}: email: ${vendedor.email}, password: ${password}`);
    }
    
    console.log('\n=============================');
    console.log('Contraseñas reseteadas. Guarda esta lista!');
    console.log('=============================');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetPasswords();
