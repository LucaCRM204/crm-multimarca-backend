const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');

// pdfGenerator es opcional: si el archivo no está todavía, el server bootea igual
// y solo el endpoint /generar-pdf devuelve 501 hasta que lo agregues.
let generarPresupuestoPDF = null;
try {
  ({ generarPresupuestoPDF } = require('../services/pdfGenerator'));
} catch (e) {
  console.warn('⚠️ services/pdfGenerator no disponible — /presupuestos/generar-pdf deshabilitado:', e.message);
}

const MARCAS_VALIDAS = ['vw', 'fiat', 'peugeot', 'renault'];

// Función para verificar si es Owner
async function isOwner(userId) {
  try {
    const [users] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return false;
    return ['owner', 'dueño'].includes(users[0].role);
  } catch (error) {
    console.error('Error checking owner:', error);
    return false;
  }
}

// GET todas las plantillas (todos los usuarios autenticados pueden ver)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { marca } = req.query;
    let query = 'SELECT * FROM presupuestos WHERE activo = 1';
    const params = [];
    // Filtro opcional por marca de vehículo (GoldPlan es multimarca)
    if (marca && MARCAS_VALIDAS.includes(marca)) {
      query += ' AND marcaVehiculo = ?';
      params.push(marca);
    }
    query += ' ORDER BY marcaVehiculo, marca, modelo';
    const [plantillas] = await pool.execute(query, params);
    res.json({ ok: true, plantillas });
  } catch (error) {
    console.error('Error GET /presupuestos:', error);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

// GET una plantilla específica
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [plantillas] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ? AND activo = 1',
      [req.params.id]
    );

    if (plantillas.length === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    res.json({ ok: true, plantilla: plantillas[0] });
  } catch (error) {
    console.error('Error GET /presupuestos/:id:', error);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

// POST crear plantilla (solo Owner)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    if (!(await isOwner(userId))) {
      return res.status(403).json({
        error: 'Solo el Dueño puede crear plantillas de presupuesto'
      });
    }

    const {
      modelo,
      marca,
      marcaVehiculo,
      imagen_url,
      precio_contado,
      especificaciones_tecnicas,
      planes_cuotas,
      bonificaciones,
      anticipo
    } = req.body;

    if (!modelo || !marca) {
      return res.status(400).json({ error: 'Modelo y marca son obligatorios' });
    }

    if (marcaVehiculo && !MARCAS_VALIDAS.includes(marcaVehiculo)) {
      return res.status(400).json({
        error: 'Marca de vehículo inválida. Debe ser: vw, fiat, peugeot o renault'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO presupuestos
       (modelo, marca, marcaVehiculo, imagen_url, precio_contado, especificaciones_tecnicas,
        planes_cuotas, bonificaciones, anticipo, activo, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())`,
      [
        modelo,
        marca,
        marcaVehiculo || null,
        imagen_url || null,
        precio_contado || null,
        especificaciones_tecnicas || null,
        planes_cuotas ? JSON.stringify(planes_cuotas) : null,
        bonificaciones || null,
        anticipo || null,
        userId
      ]
    );

    const [newPlantilla] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [result.insertId]
    );

    res.json({ ok: true, plantilla: newPlantilla[0] });
  } catch (error) {
    console.error('Error POST /presupuestos:', error);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

// PUT actualizar plantilla (solo Owner)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    if (!(await isOwner(userId))) {
      return res.status(403).json({
        error: 'Solo el Dueño puede editar plantillas de presupuesto'
      });
    }

    const { id } = req.params;
    const updates = req.body;

    if (updates.marcaVehiculo && !MARCAS_VALIDAS.includes(updates.marcaVehiculo)) {
      return res.status(400).json({
        error: 'Marca de vehículo inválida. Debe ser: vw, fiat, peugeot o renault'
      });
    }

    const allowedFields = [
      'modelo', 'marca', 'marcaVehiculo', 'imagen_url', 'precio_contado',
      'especificaciones_tecnicas', 'planes_cuotas', 'bonificaciones',
      'anticipo', 'activo'
    ];

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'planes_cuotas' && typeof value === 'object') {
          setClause.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(id);

    await pool.execute(
      `UPDATE presupuestos SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    const [updated] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [id]
    );

    res.json({ ok: true, plantilla: updated[0] });
  } catch (error) {
    console.error('Error PUT /presupuestos/:id:', error);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

// DELETE plantilla (solo Owner - soft delete, igual que ALRA)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    if (!(await isOwner(userId))) {
      return res.status(403).json({
        error: 'Solo el Dueño puede eliminar plantillas de presupuesto'
      });
    }

    const { id } = req.params;

    await pool.execute(
      'UPDATE presupuestos SET activo = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({ ok: true, message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    console.error('Error DELETE /presupuestos/:id:', error);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

// POST generar PDF del presupuesto
router.post('/generar-pdf', authenticateToken, async (req, res) => {
  try {
    if (!generarPresupuestoPDF) {
      return res.status(501).json({ error: 'Generador de PDF no instalado en este servidor (falta services/pdfGenerator.js)' });
    }

    console.log(`User ${req.user.username || 'unknown'} (ID: ${req.user.userId || req.user.id}) accessing POST /generar-pdf`);

    const { filePath, fileName } = await generarPresupuestoPDF(req.body);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temp file:', unlinkErr);
        } else {
          console.log('Temp file deleted successfully:', fileName);
        }
      });
    });

  } catch (error) {
    console.error('Error POST /presupuestos/generar-pdf:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
});

module.exports = router;