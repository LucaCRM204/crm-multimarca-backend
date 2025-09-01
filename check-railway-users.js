require('dotenv').config();
const pool = require('./db');

(async () => {
  try {
    console.log('Conectando a Railway DB...');
    const [users] = await pool.execute('SELECT id, email, name, role FROM users');
    console.log('\nUsuarios en Railway:');
    users.forEach(u => {
      console.log(`- ${u.email} (${u.name}) - Rol: ${u.role}`);
    });
    
    if (users.length === 0) {
      console.log('No hay usuarios. Necesitas crear uno.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();
