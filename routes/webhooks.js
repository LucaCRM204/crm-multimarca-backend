const router = require('express').Router();
const pool = require('../db');

// Variable global para mantener el índice round-robin
let vendorIndex = 0;

// Webhook para Zapier
router.post('/zapier', async (req, res) => {
  try {
    const zapierKey = req.headers['x-zapier-key'];
    if (zapierKey !== 'alluma-zapier-secret-2024') {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const {
      nombre,
      telefono,
      email,
      modelo,
      formaPago,
      fuente,
      notas
    } = req.body;
    
    // Validación básica
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    
    // Obtener vendedores activos ordenados por ID
    const [vendedores] = await pool.execute(
      'SELECT id FROM users WHERE role = ? AND active = 1 ORDER BY id',
      ['vendedor']
    );
    
    let assigned_to = null;
    if (vendedores.length > 0) {
      // Round-robin: usar el siguiente vendedor en la lista
      assigned_to = vendedores[vendorIndex % vendedores.length].id;
      vendorIndex++; // Incrementar para el próximo lead
      
      console.log(`Asignando a vendedor ID ${assigned_to} (índice ${vendorIndex - 1})`);
    }
    
    // Insertar lead
    await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        nombre,
        telefono || '',
        modelo || 'Consultar',
        formaPago || 'Consultar',
        'nuevo',
        fuente || 'facebook',
        notas || '',
        assigned_to
      ]
    );
    
    res.json({ 
      ok: true, 
      message: 'Lead creado',
      assignedTo: assigned_to
    });
    
  } catch (error) {
    console.error('Error webhook:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

module.exports = router;
