const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./db');

async function importLeads() {
  const leads = [];
  
  // Leer CSV
  fs.createReadStream('leads_facebook.csv')
    .pipe(csv({
      separator: '\t' // Tab separated
    }))
    .on('data', (row) => {
      leads.push(row);
    })
    .on('end', async () => {
      console.log(`Procesando ${leads.length} leads de CM (200)...`);
      
      for (const lead of leads) {
        try {
          // Limpiar teléfono
          let telefono = (lead['número_de_teléfono'] || '').replace('p:', '');
          
          // Determinar fuente con código 200
          const platform = lead.platform;
          const fuente = platform === 'fb' ? 'facebook-200' : 'instagram-200';
          
          // Extraer modelo
          const modelo = lead.modelo === 'tera' ? 'T-Cross' : lead.modelo === 'polo' ? 'Polo' : 'Consultar';
          
          // Crear notas con toda la info adicional
          const notas = `Origen: CM (200)
Campaña: ${lead.campaign_name || ''}
Anticipo/Usado: ${lead['cuenta_con_anticipo_o_usado_?'] || ''}
Plataforma: ${platform === 'fb' ? 'Facebook' : 'Instagram'}
Fecha: ${lead.created_time || ''}
Ad: ${lead.ad_name || ''}`;
          
          // Asignar a vendedor aleatorio
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
              lead['nombre_y_apellidos'] || 'Sin nombre',
              telefono,
              modelo,
              'Consultar',
              'nuevo',
              fuente,
              notas,
              assigned_to
            ]
          );
          
          console.log(`✅ Lead agregado: ${lead['nombre_y_apellidos']} - ${fuente}`);
        } catch (error) {
          console.error(`❌ Error con lead ${lead['nombre_y_apellidos']}:`, error.message);
        }
      }
      
      console.log(`✅ Importación completada - ${leads.length} leads de CM (200)`);
      console.log('Fuentes utilizadas: facebook-200 e instagram-200');
      process.exit(0);
    });
}

// Ejecutar
importLeads();
