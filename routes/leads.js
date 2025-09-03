const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Función para obtener equipo del usuario basado en jerarquía
async function getUserTeam(userId) {
  try {
    const [users] = await pool.execute('SELECT * FROM users');
    const userMap = new Map(users.map(u => [u.id, u]));
    
    let currentUser = userMap.get(userId);
    if (!currentUser) return 'roberto'; // Default
    
    // Owner/Director pueden ver ambos equipos
    if (['owner', 'director'].includes(currentUser.role)) {
      return 'both';
    }
    
    // Buscar el gerente raíz
    while (currentUser && currentUser.reportsTo) {
      currentUser = userMap.get(currentUser.reportsTo);
      if (!currentUser) break;
      
      if (currentUser.role === 'gerente') {
        if (currentUser.name === 'Daniel Mottino') return 'daniel';
        if (currentUser.name === 'Roberto Sauer') return 'roberto';
      }
    }
    
    return 'roberto'; // Default
  } catch (error) {
    console.error('Error getUserTeam:', error);
    return 'roberto';
  }
}

// GET todos los leads (filtrados por equipo)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userTeam = await getUserTeam(req.user.userId);
    
    let query = 'SELECT * FROM leads';
    let params = [];
    
    // Filtrar por equipo si no es owner/director
    if (userTeam !== 'both') {
      query += ' WHERE equipo = ?';
      params.push(userTeam);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [leads] = await pool.execute(query, params);
    res.json({ ok: true, leads });
  } catch (error) {
    console.error('Error GET /leads:', error);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// GET un lead
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userTeam = await getUserTeam(req.user.userId);
    
    let query = 'SELECT * FROM leads WHERE id = ?';
    let params = [req.params.id];
    
    // Filtrar por equipo si no es owner/director
    if (userTeam !== 'both') {
      query += ' AND equipo = ?';
      params.push(userTeam);
    }
    
    const [leads] = await pool.execute(query, params);
    if (leads.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    res.json({ ok: true, lead: leads[0] });
  } catch (error) {
    console.error('Error GET /leads/:id:', error);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

// POST crear lead
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      modelo,
      formaPago = 'Contado',
      infoUsado = '',
      entrega = false,
      fecha = new Date().toISOString().split('T')[0],
      estado = 'nuevo',
      fuente = 'otro',
      notas = '',
      vendedor = null,
      equipo = 'roberto' // NUEVO CAMPO
    } = req.body;

    // Validar equipo
    if (!['roberto', 'daniel'].includes(equipo)) {
      return res.status(400).json({ error: 'Equipo inválido. Debe ser "roberto" o "daniel"' });
    }

    // Incluir infoUsado y entrega en las notas si vienen
    let notasCompletas = notas;
    if (infoUsado) {
      notasCompletas += `\nInfo usado: ${infoUsado}`;
    }
    if (entrega) {
      notasCompletas += `\nEntrega usado: Si`;
    }

    // Asignación automática si no hay vendedor (filtrar por equipo)
    let assigned_to = vendedor;
    if (!assigned_to) {
      // Obtener vendedores del equipo específico
      const [vendedoresResult] = await pool.execute(`
        SELECT u.id 
        FROM users u
        WHERE u.role = 'vendedor' 
        AND u.active = 1
        AND EXISTS (
          SELECT 1 FROM users gerente 
          WHERE gerente.role = 'gerente' 
          AND gerente.name = ?
          AND (
            u.reportsTo IN (
              SELECT supervisor.id FROM users supervisor 
              WHERE supervisor.role = 'supervisor' 
              AND supervisor.reportsTo = gerente.id
            )
          )
        )
      `, [equipo === 'daniel' ? 'Daniel Mottino' : 'Roberto Sauer']);
      
      if (vendedoresResult.length > 0) {
        const randomIndex = Math.floor(Math.random() * vendedoresResult.length);
        assigned_to = vendedoresResult[randomIndex].id;
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, equipo, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono, modelo, formaPago, estado, fuente, notasCompletas, assigned_to, equipo]
    );

    const [newLead] = await pool.execute('SELECT * FROM leads WHERE id = ?', [result.insertId]);
    res.json({ ok: true, lead: newLead[0] });
  } catch (error) {
    console.error('Error POST /leads:', error);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// PUT actualizar lead
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Verificar acceso por equipo
    const userTeam = await getUserTeam(req.user.userId);
    if (userTeam !== 'both') {
      const [existingLead] = await pool.execute('SELECT equipo FROM leads WHERE id = ?', [id]);
      if (existingLead.length === 0) {
        return res.status(404).json({ error: 'Lead no encontrado' });
      }
      if (existingLead[0].equipo !== userTeam) {
        return res.status(403).json({ error: 'No tienes acceso a este lead' });
      }
    }
    
    const allowedFields = ['nombre', 'telefono', 'modelo', 'formaPago', 'estado', 'fuente', 'notas', 'assigned_to', 'vendedor', 'equipo'];
    
    const setClause = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const fieldName = key === 'vendedor' ? 'assigned_to' : key;
      
      if (allowedFields.includes(key)) {
        // Validar equipo si se está actualizando
        if (key === 'equipo' && !['roberto', 'daniel'].includes(value)) {
          return res.status(400).json({ error: 'Equipo inválido' });
        }
        
        setClause.push(`${fieldName} = ?`);
        values.push(value === undefined ? null : value);
      }
    }
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    
    values.push(id);
    
    await pool.execute(
      `UPDATE leads SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updated] = await pool.execute('SELECT * FROM leads WHERE id = ?', [id]);
    res.json({ ok: true, lead: updated[0] });
  } catch (error) {
    console.error('Error PUT /leads/:id:', error);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

// DELETE eliminar lead
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar acceso por equipo
    const userTeam = await getUserTeam(req.user.userId);
    if (userTeam !== 'both') {
      const [existingLead] = await pool.execute('SELECT equipo FROM leads WHERE id = ?', [req.params.id]);
      if (existingLead.length === 0) {
        return res.status(404).json({ error: 'Lead no encontrado' });
      }
      if (existingLead[0].equipo !== userTeam) {
        return res.status(403).json({ error: 'No tienes acceso a este lead' });
      }
    }
    
    await pool.execute('DELETE FROM leads WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: 'Lead eliminado' });
  } catch (error) {
    console.error('Error DELETE /leads/:id:', error);
    res.status(500).json({ error: 'Error al eliminar lead' });
  }
});

// Endpoint específico para crear leads desde bots/webhooks
router.post('/webhook/:equipo', authenticateToken, async (req, res) => {
  try {
    const equipoFromUrl = req.params.equipo;
    
    if (!['roberto', 'daniel'].includes(equipoFromUrl)) {
      return res.status(400).json({ error: 'Equipo inválido en URL' });
    }
    
    // Forzar el equipo desde la URL
    const leadData = { ...req.body, equipo: equipoFromUrl };
    
    // Reutilizar lógica del POST principal
    req.body = leadData;
    return router.handle(req, res, 'post', '/');
  } catch (error) {
    console.error('Error POST /leads/webhook/:equipo:', error);
    res.status(500).json({ error: 'Error al crear lead desde webhook' });
  }
});

module.exports = router;