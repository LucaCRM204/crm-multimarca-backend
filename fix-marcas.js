const pool = require('./db');
require('dotenv').config();

// Modelos específicos por marca
const MODELOS_VW = [
  'polo', 'taos', 't-cross', 'tcross', 'nivus', 'virtus', 'amarok', 
  'gol', 'saveiro', 'tiguan', 'vento', 'up', 'volkswagen', 'vw'
];

const MODELOS_PEUGEOT = [
  '208', '2008', '3008', '5008', 'partner', 'expert', 'boxer', 
  'traveller', 'rifter', 'peugeot'
];

const MODELOS_FIAT = [
  'titano', 'argo', 'cronos', 'fastback', 'mobi', 'toro', 'pulse', 
  'fiorino', 'strada', 'ducato', 'uno', 'palio', 'siena', 
  'doblo', 'toro', 'fiat'
];

const MODELOS_RENAULT = [
  'sandero', 'logan', 'duster', 'alaskan', 'kangoo', 'captur', 
  'koleos', 'oroch', 'stepway', 'kwid', 'master', 'renault'
];

function detectarMarca(modelo) {
  if (!modelo) return null;
  
  const modeloLower = modelo.toLowerCase().trim();
  
  // Casos especiales primero
  if (modeloLower.includes('a consultar') || 
      modeloLower === 'consultar' || 
      modeloLower === 'a consultar') {
    return 'fiat'; // Según tu indicación
  }
  
  // Detectar por palabras clave
  for (const keyword of MODELOS_VW) {
    if (modeloLower.includes(keyword)) {
      return 'vw';
    }
  }
  
  for (const keyword of MODELOS_PEUGEOT) {
    if (modeloLower.includes(keyword)) {
      return 'peugeot';
    }
  }
  
  for (const keyword of MODELOS_FIAT) {
    if (modeloLower.includes(keyword)) {
      return 'fiat';
    }
  }
  
  for (const keyword of MODELOS_RENAULT) {
    if (modeloLower.includes(keyword)) {
      return 'renault';
    }
  }
  
  return null; // No se pudo detectar
}

async function fixMarcas() {
  try {
    console.log('🔧 Corrigiendo marcas de leads...\n');

    // Obtener todos los leads
    const [leads] = await pool.execute('SELECT id, nombre, modelo, marca FROM leads ORDER BY id');
    
    console.log(`📊 Total de leads encontrados: ${leads.length}\n`);

    const cambios = [];
    const sinDetectar = [];
    
    for (const lead of leads) {
      const nuevaMarca = detectarMarca(lead.modelo);
      
      if (nuevaMarca && nuevaMarca !== lead.marca) {
        cambios.push({
          id: lead.id,
          nombre: lead.nombre,
          modelo: lead.modelo,
          marcaAntigua: lead.marca,
          marcaNueva: nuevaMarca
        });
      } else if (!nuevaMarca) {
        sinDetectar.push({
          id: lead.id,
          nombre: lead.nombre,
          modelo: lead.modelo,
          marcaActual: lead.marca
        });
      }
    }

    // Mostrar resumen antes de aplicar
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📋 RESUMEN DE CAMBIOS A REALIZAR:`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (cambios.length > 0) {
      console.log(`✏️  Leads a actualizar: ${cambios.length}\n`);
      
      // Agrupar por cambio de marca
      const porCambio = {};
      cambios.forEach(c => {
        const key = `${c.marcaAntigua} → ${c.marcaNueva}`;
        if (!porCambio[key]) porCambio[key] = [];
        porCambio[key].push(c);
      });
      
      Object.entries(porCambio).forEach(([cambio, items]) => {
        console.log(`   ${cambio}: ${items.length} leads`);
        items.slice(0, 3).forEach(item => {
          console.log(`      • #${item.id} - ${item.nombre} - "${item.modelo}"`);
        });
        if (items.length > 3) {
          console.log(`      ... y ${items.length - 3} más`);
        }
        console.log('');
      });
    } else {
      console.log('✅ No hay leads para actualizar\n');
    }
    
    if (sinDetectar.length > 0) {
      console.log(`⚠️  Leads sin marca detectada: ${sinDetectar.length}`);
      console.log('   (Estos NO se modificarán, revísalos manualmente)\n');
      sinDetectar.slice(0, 5).forEach(item => {
        console.log(`      • #${item.id} - ${item.nombre} - "${item.modelo}" (actual: ${item.marcaActual})`);
      });
      if (sinDetectar.length > 5) {
        console.log(`      ... y ${sinDetectar.length - 5} más`);
      }
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

    // Confirmar antes de ejecutar
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('¿Deseas aplicar estos cambios? (si/no): ', async (respuesta) => {
      readline.close();
      
      if (respuesta.toLowerCase() !== 'si' && respuesta.toLowerCase() !== 's') {
        console.log('\n❌ Operación cancelada. No se realizaron cambios.');
        process.exit(0);
      }

      // Aplicar cambios
      console.log('\n🔄 Aplicando cambios...\n');
      
      for (const cambio of cambios) {
        await pool.execute(
          'UPDATE leads SET marca = ? WHERE id = ?',
          [cambio.marcaNueva, cambio.id]
        );
        console.log(`✅ #${cambio.id} - ${cambio.modelo}: ${cambio.marcaAntigua} → ${cambio.marcaNueva}`);
      }

      // Mostrar resumen final
      const [resumen] = await pool.execute(`
        SELECT 
          marca,
          COUNT(*) as total
        FROM leads 
        GROUP BY marca 
        ORDER BY marca
      `);

      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`🎉 PROCESO COMPLETADO EXITOSAMENTE`);
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`📊 Resumen final por marca:\n`);
      resumen.forEach(r => {
        const emoji = r.marca === 'vw' ? '🚗' : 
                     r.marca === 'fiat' ? '🏎️' : 
                     r.marca === 'peugeot' ? '🦁' : 
                     r.marca === 'renault' ? '⚡' : '❓';
        console.log(`   ${emoji} ${r.marca.toUpperCase()}: ${r.total} leads`);
      });
      console.log('');

      await pool.end();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixMarcas();