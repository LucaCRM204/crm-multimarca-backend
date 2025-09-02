const fs = require('fs');
const pool = require('./db');

async function importLeads() {
  try {
    // Leer el archivo con codificación UTF-16
    const buffer = fs.readFileSync('leads_facebook.csv');
    // Convertir de UTF-16 a string
    const csvContent = buffer.toString('utf16le');
    
    // Limpiar BOM si existe
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    
    // Dividir en líneas y filtrar vacías
    const lines = cleanContent.split('\n').filter(line => line.trim());
    
    // Obtener headers
    const headers = lines[0].split('\t').map(h => h.trim());
    
    console.log(`Procesando ${lines.length - 1} leads de CM (200)...`);
    console.log('Columnas encontradas:', headers.length);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Procesar cada línea de datos
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('\t');
      const lead = {};
      
      // Mapear valores
      headers.forEach((header, index) => {
        lead[header] = values[index] ? values[index].trim() : '';
      });
      
      // Verificar que tenga datos mínimos
      if (!lead['nombre_y_apellidos'] || !lead['número_de_teléfono']) {
        console.log(`Saltando línea ${i}: sin nombre o teléfono`);
        continue;
      }
      
      try {
        // Limpiar teléfono
        let telefono = lead['número_de_teléfono'].replace('p:', '').replace('+', '');
        
        // Determinar fuente
        const platform = lead.platform || 'fb';
        const fuente = platform === 'fb' ? 'facebook-200' : 'instagram-200';
        
        // Determinar modelo
        const modeloRaw = lead.modelo || '';
        const modelo = modeloRaw.toLowerCase().includes('tera') || modeloRaw.toLowerCase().includes('cross') 
          ? 'T-Cross' 
          : modeloRaw.toLowerCase().includes('polo') 
            ? 'Polo' 
            : 'Consultar';
        
        // Crear notas
        const notas = `Origen: CM (200)
Campaña: ${lead.campaign_name || 'Sin campaña'}
Anticipo/Usado: ${lead['cuenta_con_anticipo_o_usado_?'] || 'No especificado'}
Plataforma: ${platform === 'fb' ? 'Facebook' : 'Instagram'}
Fecha: ${lead.created_time || ''}`;
        
        // Obtener vendedor aleatorio
        const [vendedores] = await pool.execute(
          'SELECT id FROM users WHERE role = ? AND active = 1',
          ['vendedor']
        );
        
        let assigned_to = null;
        if (vendedores.length > 0) {
          const randomIndex = Math.floor(Math.random() * vendedores.length);
          assigned_to = vendedores[randomIndex].id;
        }
        
        // Insertar lead
        await pool.execute(
          `INSERT INTO leads (nombre, telefono, modelo, formaPago, estado, fuente, notas, assigned_to, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            lead['nombre_y_apellidos'],
            telefono,
            modelo,
            'Consultar',
            'nuevo',
            fuente,
            notas,
            assigned_to
          ]
        );
        
        console.log(`✅ [${i}/${lines.length-1}] ${lead['nombre_y_apellidos']} - ${fuente}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error con ${lead['nombre_y_apellidos']}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=============================');
    console.log(`✅ Importación completada`);
    console.log(`✅ Exitosos: ${successCount} leads`);
    console.log(`❌ Errores: ${errorCount} leads`);
    console.log('=============================');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
importLeads();
