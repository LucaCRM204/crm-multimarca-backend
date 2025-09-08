const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function setupDatabase() {
  try {
    // Usar DATABASE_URL que funciona tanto local como en Railway
    const connection = await mysql.createConnection(
      process.env.DATABASE_URL || {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      }
    );

    console.log('🔧 Configurando CRM Multimarca en Railway...');

    // 1. Crear tabla users
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('owner', 'director', 'gerente', 'supervisor', 'vendedor') NOT NULL,
        reportsTo INT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (reportsTo) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 2. Crear tabla leads
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        telefono VARCHAR(50) NOT NULL,
        modelo VARCHAR(255) NOT NULL,
        marca VARCHAR(20) DEFAULT 'vw',
        formaPago VARCHAR(50),
        infoUsado TEXT,
        entrega BOOLEAN DEFAULT FALSE,
        fecha DATE,
        estado VARCHAR(50) DEFAULT 'nuevo',
        assigned_to INT NULL,
        notas TEXT,
        fuente VARCHAR(100) DEFAULT 'otro',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ Tablas creadas');

    // 3. Crear usuarios iniciales
    const passwords = {
      'admin@alluma.com': await bcrypt.hash('admin123', 10),
      'director@alluma.com': await bcrypt.hash('director123', 10),
      'gerente@alluma.com': await bcrypt.hash('gerente123', 10)
    };

    for (const [email, hashedPassword] of Object.entries(passwords)) {
      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      
      if (existing.length === 0) {
        const role = email.includes('admin') ? 'owner' : 
                    email.includes('director') ? 'director' : 'gerente';
        const name = email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1);
        
        await connection.execute(`
          INSERT INTO users (name, email, password, role, active) 
          VALUES (?, ?, ?, ?, 1)
        `, [name, email, hashedPassword, role]);
        
        console.log(`✅ Usuario creado: ${email} (${role})`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${email}`);
      }
    }
    
    await connection.end();
    console.log('🎉 CRM Multimarca configurado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;