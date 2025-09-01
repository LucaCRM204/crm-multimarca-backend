require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const newPassword = 'Luca2702'; // Tu contrase?a preferida
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Actualizar password para Luca
    await pool.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'Luca@alluma.com']
    );
    
    console.log('? Password actualizada exitosamente');
    console.log('Email: Luca@alluma.com');
    console.log('Password: Luca2702');
    console.log('\nYa puedes hacer login con estas credenciales');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();
