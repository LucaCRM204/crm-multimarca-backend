const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ========================================
// METAS - Objetivos mensuales de ventas y contactos
// ========================================

// GET todas las metas (con permisos jerárquicos)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        m.*,
        u.name as usuario_nombre,
        u.role as usuario_role
      FROM metas m
      INNER JOIN users u ON m.user_id = u.id
    `;
    
    const params = [];

    // Filtrar según rol
    if (req.user.role === 'vendedor') {
      // Vendedores solo ven sus propias metas
      query += ' WHERE m.user_id = ?';
      params.push(req.user.id);
    } else if (['supervisor', 'gerente'].includes(req.user.role)) {
      // Supervisores y gerentes ven las metas de su equipo
      query += ' WHERE u.reportsTo = ?';
      params.push(req.user.id);
    }
    // Owner y director ven todas las metas

    query += ' ORDER BY m.mes DESC, u.name ASC';

    const [metas] = await pool.execute(query, params);

    res.json({ ok: true, metas });
  } catch (error) {
    console.error('Error GET /metas:', error);
    res.status(500).json({ error: 'Error al obtener metas' });
  }
});

// GET metas de un usuario específico
router.get('/usuario/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar permisos
    if (req.user.role === 'vendedor' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const [metas] = await pool.execute(
      `SELECT 
        m.*,
        u.name as usuario_nombre,
        u.role as usuario_role
       FROM metas m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.user_id = ?
       ORDER BY m.mes DESC`,
      [userId]
    );

    res.json({ ok: true, metas });
  } catch (error) {
    console.error('Error GET /metas/usuario/:userId:', error);
    res.status(500).json({ error: 'Error al obtener metas del usuario' });
  }
});

// GET progreso de una meta
router.get('/progreso/:userId/:mes', authenticateToken, async (req, res) => {
  try {
    const { userId, mes } = req.params;

    // Verificar permisos
    if (req.user.role === 'vendedor' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Obtener la meta
    const [metas] = await pool.execute(
      'SELECT * FROM metas WHERE user_id = ? AND mes = ?',
      [userId, mes]
    );

    if (metas.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    const meta = metas[0];

    // Calcular rango de fechas del mes
    const [year, month] = mes.split('-');
    const inicioMes = `${year}-${month}-01`;
    const finMes = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    // Contar ventas del mes
    const [ventasResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM leads
       WHERE assigned_to = ?
         AND estado = 'vendido'
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, inicioMes, finMes]
    );

    // Contar contactos del mes
    const [contactosResult] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM leads
       WHERE assigned_to = ?
         AND estado IN ('contactado', 'interesado', 'negociacion', 'vendido')
         AND DATE(created_at) BETWEEN ? AND ?`,
      [userId, inicioMes, finMes]
    );

    const progreso = {
      meta: meta,
      ventas: {
        actual: ventasResult[0].total,
        objetivo: meta.meta_ventas,
        porcentaje: meta.meta_ventas > 0 ? Math.round((ventasResult[0].total / meta.meta_ventas) * 100) : 0
      },
      contactos: {
        actual: contactosResult[0].total,
        objetivo: meta.meta_contactos,
        porcentaje: meta.meta_contactos > 0 ? Math.round((contactosResult[0].total / meta.meta_contactos) * 100) : 0
      }
    };

    res.json({ ok: true, progreso });
  } catch (error) {
    console.error('Error GET /metas/progreso/:userId/:mes:', error);
    res.status(500).json({ error: 'Error al obtener progreso de meta' });
  }
});

// POST crear meta
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { userId, mes, metaVentas, metaContactos } = req.body;

    // Validaciones
    if (!userId || !mes || metaVentas === undefined || metaContactos === undefined) {
      return res.status(400).json({ 
        error: 'Campos requeridos: userId, mes, metaVentas, metaContactos' 
      });
    }

    // Validar formato de mes (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ 
        error: 'Formato de mes inválido. Use YYYY-MM' 
      });
    }

    // Verificar permisos (solo gerente, director, owner pueden crear metas)
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para crear metas' });
    }

    // Verificar que el usuario objetivo existe
    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si ya existe una meta para ese usuario y mes
    const [existente] = await pool.execute(
      'SELECT id FROM metas WHERE user_id = ? AND mes = ?',
      [userId, mes]
    );

    if (existente.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe una meta para este usuario y mes. Use PUT para actualizar.' 
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO metas (user_id, mes, meta_ventas, meta_contactos) VALUES (?, ?, ?, ?)',
      [userId, mes, metaVentas, metaContactos]
    );

    const [nuevaMeta] = await pool.execute(
      `SELECT 
        m.*,
        u.name as usuario_nombre,
        u.role as usuario_role
       FROM metas m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    console.log(`🎯 Meta creada - Usuario ${userId}, Mes: ${mes}, Ventas: ${metaVentas}, Contactos: ${metaContactos}`);

    res.json({ ok: true, meta: nuevaMeta[0] });
  } catch (error) {
    console.error('Error POST /metas:', error);
    res.status(500).json({ error: 'Error al crear meta' });
  }
});

// PUT actualizar meta
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { metaVentas, metaContactos } = req.body;

    // Verificar permisos
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para actualizar metas' });
    }

    // Verificar que la meta existe
    const [metas] = await pool.execute('SELECT * FROM metas WHERE id = ?', [id]);
    if (metas.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    const updates = [];
    const values = [];

    if (metaVentas !== undefined) {
      updates.push('meta_ventas = ?');
      values.push(metaVentas);
    }

    if (metaContactos !== undefined) {
      updates.push('meta_contactos = ?');
      values.push(metaContactos);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id);

    await pool.execute(
      `UPDATE metas SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const [metaActualizada] = await pool.execute(
      `SELECT 
        m.*,
        u.name as usuario_nombre,
        u.role as usuario_role
       FROM metas m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [id]
    );

    console.log(`✅ Meta actualizada - ID ${id}`);

    res.json({ ok: true, meta: metaActualizada[0] });
  } catch (error) {
    console.error('Error PUT /metas/:id:', error);
    res.status(500).json({ error: 'Error al actualizar meta' });
  }
});

// DELETE eliminar meta
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar permisos
    if (!['owner', 'director', 'gerente'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para eliminar metas' });
    }

    // Verificar que la meta existe
    const [metas] = await pool.execute('SELECT * FROM metas WHERE id = ?', [id]);
    if (metas.length === 0) {
      return res.status(404).json({ error: 'Meta no encontrada' });
    }

    await pool.execute('DELETE FROM metas WHERE id = ?', [id]);

    console.log(`🗑️ Meta eliminada - ID ${id}`);

    res.json({ ok: true, message: 'Meta eliminada' });
  } catch (error) {
    console.error('Error DELETE /metas/:id:', error);
    res.status(500).json({ error: 'Error al eliminar meta' });
  }
});

module.exports = router;
