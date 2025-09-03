// migrate.js
const pool = require('./db');

async function migrate() {
  try {
    console.log('Iniciando migración...');
    
    // 1. Agregar columna equipo
    await pool.execute(`
      ALTER TABLE leads 
      ADD COLUMN equipo VARCHAR(50) DEFAULT 'roberto' AFTER fuente
    `);
    console.log('✓ Columna equipo agregada');
    
    // 2. Actualizar leads existentes
    await pool.execute(`
      UPDATE leads SET equipo = 'roberto' WHERE equipo IS NULL
    `);
    console.log('✓ Leads existentes actualizados');
    
    // 3. Crear índice
    await pool.execute(`
      CREATE INDEX idx_leads_equipo ON leads(equipo)
    `);
    console.log('✓ Índice creado');
    
    console.log('🎉 Migración completada exitosamente');
    process.exit(0);
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ La columna equipo ya existe');
    } else {
      console.error('❌ Error en migración:', error);
    }
    process.exit(1);
  }
}

migrate();