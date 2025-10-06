const XLSX = require('xlsx');
const axios = require('axios');
require('dotenv').config();

// Configuración
let API_URL = process.env.API_URL || 'http://localhost:3001';
if (API_URL && !API_URL.startsWith('http://') && !API_URL.startsWith('https://')) {
  API_URL = 'https://' + API_URL;
}
const EMAIL = process.env.CRM_EMAIL || 'tu_email@example.com';
const PASSWORD = process.env.CRM_PASSWORD || 'tu_password';

// Archivo Excel a importar
const EXCEL_FILE = 'DATOS_PEUGEOT_SEP_2025_para_subir[1].xlsx';

// Variable para guardar el token
let authToken = null;

// Función para hacer login y obtener el token
async function login() {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    // Tu backend devuelve el token en response.data.token
    authToken = response.data.token;
    
    console.log('✅ Login exitoso');
    return authToken;
  } catch (error) {
    console.error('❌ Error en login:', error.response?.data || error.message);
    throw error;
  }
}

// Función para obtener todos los usuarios activos
async function getActiveVendors() {
  try {
    const response = await axios.get(`${API_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    // Manejar diferentes formatos de respuesta
    let users = [];
    if (response.data.users && Array.isArray(response.data.users)) {
      users = response.data.users;
    } else if (Array.isArray(response.data)) {
      users = response.data;
    } else {
      console.log('⚠️  Respuesta inesperada de /api/users:', response.data);
      return [];
    }
    
    // Filtrar solo usuarios activos con rol de vendedor
    const activeVendors = users.filter(user => 
      user.active === 1 && user.role === 'vendedor'
    );
    
    return activeVendors;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Endpoint /api/users no disponible. Se usará asignación automática.');
      return [];
    }
    console.error('❌ Error obteniendo usuarios:', error.response?.data || error.message);
    return [];
  }
}

// Función para crear un lead
async function createLead(leadData) {
  try {
    const response = await axios.post(`${API_URL}/api/leads`, leadData, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Error creando lead ${leadData.nombre}:`, error.response?.data || error.message);
    throw error;
  }
}

// Función principal
async function importLeads() {
  console.log('🚀 Iniciando importación de leads...\n');
  
  // 1. Leer el archivo Excel
  console.log(`📂 Leyendo archivo: ${EXCEL_FILE}`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Total de leads encontrados: ${rawData.length}\n`);
  
  // 2. Mapear los datos al formato del CRM
  const leadsParaCRM = rawData.map((row) => {
    let telefono = row.phone_number || '';
    if (typeof telefono === 'string') {
      telefono = telefono.replace(/^p:/, '').trim();
    }
    
    let modelo = row.modelo || '';
    if (typeof modelo === 'string') {
      modelo = modelo.replace(/^peugeot_/, '').toUpperCase();
    }
    
    let formaPago = 'Contado';
    if (row.anticipo) {
      const anticipo = String(row.anticipo).toLowerCase();
      if (anticipo.includes('no') || anticipo === 'no') {
        formaPago = 'Financiado';
      }
    }
    
    return {
      nombre: row.full_name || 'Sin nombre',
      telefono: telefono,
      modelo: modelo,
      marca: 'peugeot',
      formaPago: formaPago,
      estado: 'nuevo',
      fuente: 'importacion',
      notas: `Email: ${row.email || 'N/A'} | Anticipo: ${row.anticipo || 'N/A'}`,
      infoUsado: '',
      entrega: false,
      fecha: new Date().toISOString().split('T')[0]
    };
  });
  
  // 3. Login
  console.log('🔐 Autenticando...');
  await login();
  
  // 4. Obtener vendedores activos para distribución equitativa
  console.log('\n👥 Obteniendo vendedores activos...');
  const vendedores = await getActiveVendors();
  
  if (vendedores.length === 0) {
    console.error('❌ No hay vendedores activos. Los leads se asignarán automáticamente.');
  } else {
    console.log(`✅ ${vendedores.length} vendedores activos encontrados:`);
    vendedores.forEach((v, idx) => {
      console.log(`   ${idx + 1}. ${v.name} (${v.email})`);
    });
    
    const leadsPerVendor = Math.ceil(leadsParaCRM.length / vendedores.length);
    console.log(`\n📐 Se asignarán ~${leadsPerVendor} leads por vendedor`);
  }
  
  // 5. Importar leads uno por uno con asignación rotativa
  console.log('\n📤 Iniciando carga de leads...\n');
  
  let exitosos = 0;
  let fallidos = 0;
  const errores = [];
  const distribucion = {};
  
  // Inicializar contador de distribución
  vendedores.forEach(v => {
    distribucion[v.name] = 0;
  });
  
  for (let i = 0; i < leadsParaCRM.length; i++) {
    const lead = leadsParaCRM[i];
    
    // Asignar vendedor de forma rotativa si hay vendedores disponibles
    if (vendedores.length > 0) {
      const vendorIndex = i % vendedores.length;
      lead.vendedor = vendedores[vendorIndex].id;
    }
    
    try {
      await createLead(lead);
      exitosos++;
      
      if (lead.vendedor && vendedores.length > 0) {
        const vendedor = vendedores.find(v => v.id === lead.vendedor);
        if (vendedor) {
          distribucion[vendedor.name]++;
          console.log(`✅ [${i + 1}/${leadsParaCRM.length}] ${lead.nombre} → ${vendedor.name}`);
        }
      } else {
        console.log(`✅ [${i + 1}/${leadsParaCRM.length}] ${lead.nombre} - ${lead.telefono}`);
      }
      
      // Pequeña pausa para no saturar el servidor
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      fallidos++;
      errores.push({ lead: lead.nombre, error: error.message });
      console.log(`❌ [${i + 1}/${leadsParaCRM.length}] ${lead.nombre} - ERROR`);
    }
  }
  
  // 6. Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(50));
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  console.log(`📝 Total procesados: ${leadsParaCRM.length}`);
  
  if (vendedores.length > 0) {
    console.log('\n📈 Distribución por vendedor:');
    Object.entries(distribucion).forEach(([nombre, count]) => {
      const porcentaje = exitosos > 0 ? ((count / exitosos) * 100).toFixed(1) : 0;
      console.log(`   ${nombre}: ${count} leads (${porcentaje}%)`);
    });
  }
  
  if (errores.length > 0) {
    console.log('\n❌ Errores encontrados:');
    errores.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.lead}: ${err.error}`);
    });
  }
  
  console.log('\n✨ Importación completada!');
}

// Ejecutar
importLeads().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});