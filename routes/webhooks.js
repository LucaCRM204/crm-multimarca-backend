const express = require('express');
const pool = require('../db');
const { getAssignedVendorByBrand } = require('../utils/assign');
const router = express.Router();

// ========= Helpers de limpieza / normalización =========

// Quita prefijos del tipo "1. Campo: valor" o "Campo: valor"
function stripLabel(v) {
  if (v == null) return '';
  const s = String(v).trim();
  // elimina "1. .... : " al inicio (con o sin número)
  return s.replace(/^(\s*\d+\.\s*)?[^:]*:\s*/i, '').trim();
}

// Deja solo + y dígitos, y colapsa espacios
function normalizePhone(v) {
  const s = stripLabel(v);
  const cleaned = s.replace(/[^\d+]/g, '');
  // evita ++ y similares
  return cleaned.replace(/\++/g, '+');
}

// Limpia texto genérico
function cleanText(v) {
  return stripLabel(v);
}

// Detecta marca a partir de texto libre
function detectMarca(text) {
  const t = (text || '').toLowerCase();
  if (/volkswagen|vw/.test(t)) return 'vw';
  if (/fiat/.test(t)) return 'fiat';
  if (/peugeot/.test(t)) return 'peugeot';
  if (/renault/.test(t)) return 'renault';
  return null;
}

// ========= Webhook: bot multimarca =========
router.post('/bot-multimarca', async (req, res) => {
  try {
    // 1) Tomo crudo lo que llega
    const body = req.body || {};
    // 2) Limpio campos que vienen con el label del formulario
    let nombre    = cleanText(body.nombre);
    let telefono  = normalizePhone(body.telefono);
    let modelo    = cleanText(body.modelo || 'Consultar');
    let marca     = cleanText(body.marca || '');
    let formaPago = cleanText(body.formaPago || 'Consultar');
    let notas     = cleanText(body.notas || '');
    const fuente  = cleanText(body.fuente || 'bot_multimarca');

    // 3) Validación después de limpiar
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
    }

    // 4) Marca final: si no viene como código válido, detecto por texto
    const validMarcas = ['vw', 'fiat', 'peugeot', 'renault'];
    let marcaFinal = validMarcas.includes(marca.toLowerCase()) ? marca.toLowerCase() : null;
    if (!marcaFinal) {
      // pruebo detectar por modelo/marca textual
      marcaFinal = detectMarca(marca) || detectMarca(modelo) || 'vw';
    }

    // 5) Asignación automática por marca y equipo
    const assigned_to = await getAssignedVendorByBrand(marcaFinal);

    // 6) Inserción
    const [result] = await pool.execute(
      `INSERT INTO leads
         (nombre, telefono, modelo, marca, formaPago, fuente, notas, assigned_to, estado, created_at)
       VALUES
         (?,      ?,        ?,      ?,     ?,         ?,      ?,     ?,           'nuevo', NOW())`,
      [nombre, telefono, modelo, marcaFinal, formaPago, fuente, notas, assigned_to]
    );

    console.log(`Lead creado: ID ${result.insertId}, marca ${marcaFinal}, asignado a vendedor ${assigned_to}`);

    // 7) Respuesta
    res.json({
      ok: true,
      leadId: result.insertId,
      assignedTo: assigned_to,
      marca: marcaFinal,
      message: 'Lead creado correctamente',
    });

  } catch (error) {
    console.error('Error webhook bot:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;