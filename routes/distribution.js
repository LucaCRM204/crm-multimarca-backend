/**
 * ============================================
 * LEAD DISTRIBUTION ROUTES
 * ============================================
 * GET  /api/distribution/all       - todas las distribuciones (bulk)
 * GET  /api/distribution/:supId    - distribución de un supervisor
 * PUT  /api/distribution           - actualizar config
 */

const express = require('express');
const router = express.Router();

function getPool(req) {
  const p = req.app.get('db');
  if (p) return p;
  try { return require('../db'); } catch(e) { return null; }
}

// GET /api/distribution/all — un solo call, trae todos los supervisores con vendedores
router.get('/all', async (req, res) => {
  try {
    const pool = getPool(req);
    
    const [vendors] = await pool.execute(`
      SELECT 
        u.id, u.name, u.lead_percentage, u.reportsTo as supervisor_id,
        sup.name as supervisor_name
      FROM users u
      JOIN users sup ON u.reportsTo = sup.id
      WHERE u.role = 'vendedor' AND u.active = 1
      ORDER BY sup.name, u.name
    `);

    const [stats] = await pool.execute(`
      SELECT 
        l.assigned_to, COUNT(*) as leads_recibidos,
        SUM(CASE WHEN l.estado = 'vendido' THEN 1 ELSE 0 END) as ventas
      FROM leads l
      WHERE l.assigned_to IS NOT NULL
        AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY l.assigned_to
    `);

    const statsMap = new Map();
    stats.forEach(s => statsMap.set(s.assigned_to, s));

    const groups = new Map();
    for (const v of vendors) {
      if (!groups.has(v.supervisor_id)) {
        groups.set(v.supervisor_id, {
          supervisorId: v.supervisor_id,
          supervisorName: v.supervisor_name,
          vendors: []
        });
      }
      const st = statsMap.get(v.id);
      groups.get(v.supervisor_id).vendors.push({
        id: v.id,
        name: v.name,
        lead_percentage: v.lead_percentage || 0,
        leads_recibidos: st ? Number(st.leads_recibidos) : 0,
        ventas: st ? Number(st.ventas) : 0
      });
    }

    const result = Array.from(groups.values()).map(g => {
      const totalLeads = g.vendors.reduce((sum, v) => sum + v.leads_recibidos, 0);
      return {
        ...g,
        totalLeads,
        vendors: g.vendors.map(v => ({
          ...v,
          porcentaje_real: totalLeads > 0 ? Math.round((v.leads_recibidos / totalLeads) * 100) : 0,
          porcentaje_target: v.lead_percentage || 0
        }))
      };
    });

    res.json({ ok: true, teams: result });
  } catch (err) {
    console.error('Error getting all distributions:', err.message);
    res.status(500).json({ error: 'Error al obtener distribución' });
  }
});

// GET /api/distribution/:supervisorId
router.get('/:supervisorId', async (req, res) => {
  try {
    const pool = getPool(req);
    const supId = parseInt(req.params.supervisorId);
    
    const [vendors] = await pool.execute(
      `SELECT id, name, role, lead_percentage, active 
       FROM users 
       WHERE reportsTo = ? AND role = 'vendedor' AND active = 1
       ORDER BY name`,
      [supId]
    );
    
    res.json({ ok: true, vendors });
  } catch (err) {
    console.error('Error getting distribution:', err.message);
    res.status(500).json({ error: 'Error al obtener distribución' });
  }
});

// PUT /api/distribution
router.put('/', async (req, res) => {
  try {
    const pool = getPool(req);
    const { distributions } = req.body;
    
    if (!distributions || !Array.isArray(distributions)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }
    
    const total = distributions.reduce((sum, d) => sum + (d.percentage || 0), 0);
    if (total !== 100 && total !== 0) {
      return res.status(400).json({ error: `Los porcentajes deben sumar 100% (actual: ${total}%)` });
    }
    
    for (const d of distributions) {
      await pool.execute(
        'UPDATE users SET lead_percentage = ? WHERE id = ?',
        [d.percentage || 0, d.userId]
      );
    }
    
    res.json({ ok: true, message: 'Distribución actualizada' });
  } catch (err) {
    console.error('Error updating distribution:', err.message);
    res.status(500).json({ error: 'Error al actualizar distribución' });
  }
});

module.exports = router;
