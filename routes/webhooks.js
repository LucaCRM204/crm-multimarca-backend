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
    
    // Extraer datos y manejar valores undefined
    const {
      nombre = 'Sin nombre',
      telefono = '',
      email = '',
      modelo = 'Consultar',
      formaPago = 'Consultar',
      fuente = 'facebook',
      estado = 'nuevo',
      notas = 'Lead de Facebook Ads'
    } = req.body;
    
    // Limpiar valores - convertir undefined/null/"No data" a valores v?lidos
    const nombreLimpio = nombre || 'Sin nombre';
    const telefonoLimpio = telefono || '';
    const modeloLimpio = (modelo === 'No data' || !modelo) ? 'Consultar' : modelo;
    const formaPagoLimpio = formaPago || 'Consultar';
    const fuenteLimpia = fuente || 'facebook';
    const notasLimpias = notas || '';
    
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
    
    // Crear lead con valores limpios
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        nombreLimpio, 
        telefonoLimpio, 
        modeloLimpio, 
        formaPagoLimpio, 
        estado, 
        fuenteLimpia, 
        notasLimpias, 
        assigned_to
      ]
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
