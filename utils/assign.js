// utils/assign.js
const getNextVendorId = async (conn) => {
  // Vendedor activo menos "reciente" según updated_at
  const [rows] = await conn.execute(
    `SELECT id FROM users WHERE role = 'vendedor' AND active = 1
     ORDER BY updated_at ASC, id ASC LIMIT 1`
  );
  return rows.length ? rows[0].id : null;
};

const touchUser = async (conn, userId) => {
  if (!userId) return;
  await conn.execute(`UPDATE users SET updated_at = NOW() WHERE id = ?`, [userId]);
};

module.exports = { getNextVendorId, touchUser };
