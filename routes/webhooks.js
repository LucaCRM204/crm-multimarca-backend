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
    
    console.log('Datos recibidos de Zapier:', req.body);
    
    // Extraer datos del body
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
    
    // Usar los valores que vienen, con fallbacks solo si est?n vac?os
    const nombreFinal = nombre || 'Sin nombre';
    const telefonoFinal = telefono || '';
    const modeloFinal = modelo || 'Consultar';
    const formaPagoFinal = formaPago || formapago || 'Consultar';
    const fuenteFinal = fuente || 'facebook';
    const estadoFinal = estado || 'nuevo';
    const notasFinal = notas || '';
    
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
    
    console.log('Insertando lead:', {
      nombre: nombreFinal,
      telefono: telefonoFinal,
      modelo: modeloFinal,
      formaPago: formaPagoFinal,
      fuente: fuenteFinal
    });
    
    // Crear lead
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombreFinal, telefonoFinal, modeloFinal, formaPagoFinal, estadoFinal, fuenteFinal, notasFinal, assigned_to]
    );
    
    res.json({ 
      ok: true, 
      message: 'Lead creado exitosamente',
      leadId: result.insertId,
      leadData: {
        nombre: nombreFinal,
        telefono: telefonoFinal,
        modelo: modeloFinal,
        formaPago: formaPagoFinal,
        fuente: fuenteFinal
      }
    });
    
  } catch (error) {
    console.error('Error webhook Zapier:', error);
    res.status(500).json({ error: 'Error al procesar lead' });
  }
});

module.exports = router;
