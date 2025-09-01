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
    
    console.log('Headers recibidos:', req.headers);
    console.log('Body tipo:', typeof req.body);
    console.log('Body completo:', req.body);
    
    // Intentar parsear si viene como string
    let datosLead = req.body;
    
    // Si el body es un string, intentar parsearlo
    if (typeof req.body === 'string') {
      try {
        datosLead = JSON.parse(req.body);
      } catch (e) {
        console.log('No se pudo parsear como JSON');
      }
    }
    
    // Si tiene la propiedad data, usar esa
    if (datosLead.data) {
      datosLead = datosLead.data;
    }
    
    console.log('Datos procesados:', datosLead);
    
    // Extraer datos con diferentes posibles nombres
    const nombre = datosLead.nombre || datosLead.Nombre || 'Sin nombre';
    const telefono = datosLead.telefono || datosLead.Telefono || '';
    const modelo = datosLead.modelo || datosLead.Modelo || 'Consultar';
    const formaPago = datosLead.formaPago || datosLead.formapago || datosLead.Formapago || 'Consultar';
    const fuente = datosLead.fuente || datosLead.Fuente || 'facebook';
    const estado = datosLead.estado || 'nuevo';
    const notas = datosLead.notas || datosLead.Origen || '';
    
    console.log('Valores finales para insertar:', {
      nombre,
      telefono,
      modelo,
      formaPago,
      fuente,
      estado,
      notas
    });
    
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
    
    // Crear lead
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to]
    );
    
    res.json({ 
      ok: true, 
      message: 'Lead creado exitosamente',
      leadId: result.insertId,
      recibido: datosLead
    });
    
  } catch (error) {
    console.error('Error webhook Zapier:', error);
    res.status(500).json({ error: 'Error al procesar lead: ' + error.message });
  }
});

module.exports = router;
