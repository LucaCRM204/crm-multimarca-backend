const express = require('express');
const pool = require('../db');
const router = express.Router();

// Variable para round-robin
let vendorIndex = 0;

// Función para obtener vendedores activos
async function getActiveVendors() {
  const [vendors] = await pool.execute(
    'SELECT id FROM users WHERE role = "vendedor" AND active = 1 ORDER BY id'
  );
  return vendors;
}

// Webhook para bot multimarca
router.post('/bot-multimarca', async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      modelo = 'Consultar',
      marca = 'vw',
      fuente = 'bot_multimarca',
      notas = '',
      formaPago = 'Consultar'
    } = req.body;

    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    // Validar marca
    const validMarcas = ['vw', 'fiat', 'peugeot', 'renault'];
    const marcaFinal = validMarcas.includes(marca) ? marca : 'vw';

    // Asignación automática round-robin
    const vendors = await getActiveVendors();
    let assigned_to = null;
    
    if (vendors.length > 0) {
      assigned_to = vendors[vendorIndex % vendors.length].id;
      vendorIndex++;
    }

    // Crear el lead
    const [result] = await pool.execute(
      `INSERT INTO leads (nombre, telefono, modelo, marca, formaPago, fuente, notas, assigned_to, estado, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', NOW())`,
      [nombre, telefono, modelo, marcaFinal, formaPago, fuente, notas, assigned_to]
    );

    console.log(`Lead creado: ID ${result.insertId}, asignado a vendedor ${assigned_to}`);

    res.json({ 
      ok: true, 
      leadId: result.insertId,
      assignedTo: assigned_to,
      marca: marcaFinal,
      message: 'Lead creado correctamente' 
    });

  } catch (error) {
    console.error('Error webhook bot:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;