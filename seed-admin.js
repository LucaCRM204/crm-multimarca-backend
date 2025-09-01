// seed-admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

(async () => {
  // SI TENÉS .env, cargalo:
  // require('dotenv').config();

  const host = process.env.DB_HOST || 'maglev.proxy.rlwy.net';
  const port = +(process.env.DB_PORT || 10808);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'QqvpWzNrRUsGCxZECmukFdoCxtcItAGH';
  const database = process.env.DB_NAME || 'railway';

  if (!password) {
    throw new Error('Falta DB_PASSWORD (password real de la base de Railway)');
  }

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }  // evita el HANDSHAKE_SSL_ERROR
  });

  // SIN PEPPER (tu backend no muestra PEPPER en variables)
  const hash = await bcrypt.hash('admin123', 10);

  await conn.execute(
    'UPDATE users SET password=?, updated_at=NOW() WHERE email=?',
    [hash, 'luca@alluma.com']
  );

  console.log('✅ Password reseteada con bcrypt( admin123 )');
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
