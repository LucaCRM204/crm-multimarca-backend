const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔧 Configurando base de datos...');

    // Crear contraseñas hasheadas para usuarios
    const passwords = {
      'maria@alluma.com': await bcrypt.hash('admin123', 10),
      'carlos@alluma.com': await bcrypt.hash('director123', 10),
      'ana@alluma.com': await bcrypt.hash('gerente123', 10)
    };

    console.log('✅ Contraseñas hasheadas generadas');

    // Actualizar contraseñas en la base de datos
    for (const [email, hashedPassword] of Object.entries(passwords)) {
      await connection.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    }

    console.log('✅ Usuarios actualizados con contraseñas seguras');
    
    await connection.end();
    console.log('🎉 Configuración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;