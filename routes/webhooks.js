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
      modelo,
      formaPago,
      formapago,
      fuente,
      estado,
      notas
    } = req.body;
    
    // Validar que al menos tenga nombre Y tel?fono
    if (!nombre || !telefono) {
      console.log('Lead rechazado - Falta nombre o tel?fono:', { nombre, telefono });
      return res.status(400).json({ 
        error: 'Lead incompleto - se requiere nombre y tel?fono',
        datosRecibidos: { nombre, telefono }
      });
    }
    
    // Si no hay informaci?n ?til adicional, rechazar
    if (!email && !modelo && !formaPago && !formapago) {
      console.log('Lead rechazado - Sin informaci?n adicional ?til');
      return res.status(400).json({ 
        error: 'Lead sin informaci?n suficiente para procesar'
      });
    }
    
    // Procesar datos v?lidos
    const nombreFinal = nombre;
    const telefonoFinal = telefono;
    const modeloFinal = modelo || 'Consultar';
    const formaPagoFinal = formaPago || formapago || 'Consultar';
    const fuenteFinal = fuente || 'facebook';
    const estadoFinal = estado || 'nuevo';
    const notasFinal = notas || '';
    
    // Asignaci?n autom?tica
    let assigned_to = null;
    const [vendedores] = await pool.execute(
      'SELECT id FROM users WHERE role = ? AND active = 1',
      ['vendedor']
    );
    if (vendedores.length > 0) {
      const randomIndex = Math.floor(Math.random() * vendedores.length);
      assigned_to = vendedores[randomIndex].id;
    }
    
    // Crear lead solo si tiene datos v?lidos
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombreFinal, telefonoFinal, modeloFinal, formaPagoFinal, estadoFinal, fuenteFinal, notasFinal, assigned_to]
    );
    
    console.log('Lead creado exitosamente:', { 
      id: result.insertId, 
      nombre: nombreFinal, 
      telefono: telefonoFinal 
    });
    
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
