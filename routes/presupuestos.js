const router = require('express').Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET todos los presupuestos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { marca, activo } = req.query;
    
    let query = 'SELECT * FROM presupuestos WHERE 1=1';
    const params = [];
    
    // Filtrar por marca si se proporciona
    if (marca && ['vw', 'fiat', 'peugeot', 'renault'].includes(marca)) {
      query += ' AND marcaVehiculo = ?';
      params.push(marca);
    }
    
    // Filtrar por activo (por defecto solo los activos)
    if (activo !== undefined) {
      query += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    } else {
      query += ' AND activo = 1';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error GET /presupuestos:', error);
    res.status(500).json({ 
      error: 'Error al obtener presupuestos',
      details: error.message 
    });
  }
});

// GET un presupuesto específico
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error GET /presupuestos/:id:', error);
    res.status(500).json({ 
      error: 'Error al obtener presupuesto',
      details: error.message 
    });
  }
});

// POST crear presupuesto
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Solo owner puede crear presupuestos
    if (!['owner', 'dueño'].includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para crear presupuestos' 
      });
    }

    const {
      modelo,
      marca,
      marcaVehiculo = null,
      imagen_url = null,
      precio_contado = null,
      especificaciones_tecnicas = null,
      planes_cuotas = null,
      bonificaciones = null,
      anticipo = null,
      activo = true
    } = req.body;

    // Validaciones
    if (!modelo || !marca) {
      return res.status(400).json({ 
        error: 'Modelo y marca son obligatorios' 
      });
    }

    if (marcaVehiculo && !['vw', 'fiat', 'peugeot', 'renault'].includes(marcaVehiculo)) {
      return res.status(400).json({ 
        error: 'Marca de vehículo inválida. Debe ser: vw, fiat, peugeot o renault' 
      });
    }

    // Convertir planes_cuotas a JSON si es necesario
    const planes_cuotas_json = planes_cuotas ? JSON.stringify(planes_cuotas) : null;

    const [result] = await pool.execute(
      `INSERT INTO presupuestos 
        (modelo, marca, marcaVehiculo, imagen_url, precio_contado, 
         especificaciones_tecnicas, planes_cuotas, bonificaciones, 
         anticipo, activo, created_by, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        modelo,
        marca,
        marcaVehiculo,
        imagen_url,
        precio_contado,
        especificaciones_tecnicas,
        planes_cuotas_json,
        bonificaciones,
        anticipo,
        activo ? 1 : 0,
        req.user.id
      ]
    );

    // Obtener el presupuesto recién creado
    const [rows] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error POST /presupuestos:', error);
    res.status(500).json({ 
      error: 'Error al crear presupuesto',
      details: error.message 
    });
  }
});

// PUT actualizar presupuesto
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Solo owner puede actualizar presupuestos
    if (!['owner', 'dueño'].includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para actualizar presupuestos' 
      });
    }

    const { id } = req.params;
    const {
      modelo,
      marca,
      marcaVehiculo,
      imagen_url,
      precio_contado,
      especificaciones_tecnicas,
      planes_cuotas,
      bonificaciones,
      anticipo,
      activo
    } = req.body;

    // Verificar que existe
    const [existing] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    if (marcaVehiculo && !['vw', 'fiat', 'peugeot', 'renault'].includes(marcaVehiculo)) {
      return res.status(400).json({ 
        error: 'Marca de vehículo inválida. Debe ser: vw, fiat, peugeot o renault' 
      });
    }

    // Construir query dinámico
    const updates = [];
    const values = [];

    if (modelo !== undefined) {
      updates.push('modelo = ?');
      values.push(modelo);
    }
    if (marca !== undefined) {
      updates.push('marca = ?');
      values.push(marca);
    }
    if (marcaVehiculo !== undefined) {
      updates.push('marcaVehiculo = ?');
      values.push(marcaVehiculo);
    }
    if (imagen_url !== undefined) {
      updates.push('imagen_url = ?');
      values.push(imagen_url);
    }
    if (precio_contado !== undefined) {
      updates.push('precio_contado = ?');
      values.push(precio_contado);
    }
    if (especificaciones_tecnicas !== undefined) {
      updates.push('especificaciones_tecnicas = ?');
      values.push(especificaciones_tecnicas);
    }
    if (planes_cuotas !== undefined) {
      updates.push('planes_cuotas = ?');
      values.push(planes_cuotas ? JSON.stringify(planes_cuotas) : null);
    }
    if (bonificaciones !== undefined) {
      updates.push('bonificaciones = ?');
      values.push(bonificaciones);
    }
    if (anticipo !== undefined) {
      updates.push('anticipo = ?');
      values.push(anticipo);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      values.push(activo ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE presupuestos SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Obtener el presupuesto actualizado
    const [rows] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Error PUT /presupuestos/:id:', error);
    res.status(500).json({ 
      error: 'Error al actualizar presupuesto',
      details: error.message 
    });
  }
});

// DELETE eliminar presupuesto
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Solo owner puede eliminar presupuestos
    if (!['owner', 'dueño'].includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'No tienes permisos para eliminar presupuestos' 
      });
    }

    const { id } = req.params;

    // Verificar que existe
    const [existing] = await pool.execute(
      'SELECT * FROM presupuestos WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    await pool.execute('DELETE FROM presupuestos WHERE id = ?', [id]);

    res.json({ 
      message: 'Presupuesto eliminado exitosamente',
      id: parseInt(id)
    });
  } catch (error) {
    console.error('Error DELETE /presupuestos/:id:', error);
    res.status(500).json({ 
      error: 'Error al eliminar presupuesto',
      details: error.message 
    });
  }
});

module.exports = router;