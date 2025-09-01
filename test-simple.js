require('dotenv').config();
const mysql = require('mysql2');

console.log('Variables de entorno:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD existe:', !!process.env.DB_PASSWORD);

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Luca2702',
  database: 'alluma_crm'
});

connection.connect((err) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('? Conectado exitosamente!');
  }
  connection.end();
});
