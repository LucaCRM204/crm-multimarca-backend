const router = require('express').Router();
const pool = require('../db');

// Webhook para Zapier - NO requiere JWT
router.post('/zapier', async (req, res) => {
  try {
    // Verificar clave secreta de Zapier
    const zapierKey = req.headers['x-zapier-key'];
    if (zapierKey !== 'alluma-zapier-secret-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const {
      nombre,
      telefono,
      email,
      modelo = 'Consultar',
      formaPago = 'Consultar',
      fuente = 'facebook',
      estado = 'nuevo',
      notas = 'Lead de Facebook Ads'
    } = req.body;
    
    // Asignaci?n autom?tica a vendedor activo
    let assigned_to = null;
    const [vendedores] = await pool.execute(
      'SELECT id FROM users WHERE role = ? AND active = 1',
      ['vendedor']
    );
    if (vendedores.length > 0) {
      const randomIndex = Math.floor(Math.random() * vendedores.length);
      assigned_to = vendedores[randomIndex].id;
    }
    
    // Crear lead
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono || '', modelo, formaPago, estado, fuente, notas, assigned_to]
    );
    
    res.json({ 
      ok: true, 
      message: 'Lead creado exitosamente',
      leadId: result.insertId 
    });
    
  } catch (error) {
    console.error('Error webhook Zapier:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

module.exports = router;
