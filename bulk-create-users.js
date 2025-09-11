// bulk-create-users.js
// Script completo para crear usuarios usando tu API backend

const axios = require('axios');

// Configuración
const API_BASE = 'https://crm-multimarca-backend-production.up.railway.app/api'; // REEMPLAZA con tu URL real de Railway
const TIMEOUT = 10000; // 10 segundos timeout

// Configurar axios
axios.defaults.timeout = TIMEOUT;

// Datos de usuarios a crear
const users = [
  { 
    name: 'Braian Belpulsi', 
    email: 'braian.belpulsi', 
    role: 'gerente', 
    password: 'braian123',
    order: 1 // Para controlar el orden de creación
  },
  { 
    name: 'Cecilia Caceres', 
    email: 'cecilia.caceres', 
    role: 'supervisor', 
    password: 'cecilia123',
    order: 2
  },
  { 
    name: 'Isaias Portillo', 
    email: 'isaias.portillo', 
    role: 'vendedor', 
    password: 'isaias123',
    order: 3
  },
  { 
    name: 'Brenda Nuñez', 
    email: 'brenda.nunez', 
    role: 'vendedor', 
    password: 'brenda123',
    order: 4
  },
  { 
    name: 'Juan Ignacio Fernandez', 
    email: 'juan.fernandez', 
    role: 'vendedor', 
    password: 'juan123',
    order: 5
  },
  { 
    name: 'Juan Ignacio Ameijeiras', 
    email: 'juan.ameijeiras', 
    role: 'vendedor', 
    password: 'juani123',
    order: 6
  },
  { 
    name: 'Ariana Godoy', 
    email: 'ariana.godoy', 
    role: 'vendedor', 
    password: 'ariana123',
    order: 7
  },
  { 
    name: 'Gonzalo Arias', 
    email: 'gonzalo.arias', 
    role: 'vendedor', 
    password: 'gonzalo123',
    order: 8
  },
  { 
    name: 'Yesica Morgante', 
    email: 'yesica.morgante', 
    role: 'vendedor', 
    password: 'yesica123',
    order: 9
  },
  { 
    name: 'Esteban Vorraber', 
    email: 'esteban.vorraber', 
    role: 'vendedor', 
    password: 'esteban123',
    order: 10
  }
];

// Función para esperar un tiempo determinado
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para verificar si el servidor está corriendo
async function checkServer() {
  try {
    console.log('🔍 Verificando conexión al servidor...');
    console.log('URL API:', API_BASE);
    
    // Verificar ruta base (sin /api)
    const baseUrl = API_BASE.replace('/api', '');
    const baseResponse = await axios.get(baseUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'CRM-User-Creator/1.0' }
    });
    console.log('✅ Servidor base responde:', baseResponse.data);
    
    // Verificar endpoint /api/users
    console.log('🔍 Verificando endpoint /api/users...');
    const usersResponse = await axios.get(`${API_BASE}/users`, {
      timeout: 10000,
      headers: { 'User-Agent': 'CRM-User-Creator/1.0' }
    });
    
    console.log('✅ Endpoint /api/users conectado correctamente');
    console.log('   Status:', usersResponse.status);
    console.log('   Usuarios encontrados:', Array.isArray(usersResponse.data) ? usersResponse.data.length : 'N/A');
    return true;
    
  } catch (error) {
    console.error('❌ Error:');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    
    if (error.response) {
      console.error('   HTTP Status:', error.response.status);
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// Función principal para crear usuarios
async function createUsers() {
  console.log('🚀 Iniciando creación masiva de usuarios...');
  console.log('=' .repeat(50));
  
  // Verificar servidor
  const serverOk = await checkServer();
  if (!serverOk) {
    process.exit(1);
  }

  let gerenteId = null;
  let supervisorId = null;
  let createdUsers = [];
  let failedUsers = [];

  // Ordenar usuarios para crear gerente primero, luego supervisor, luego vendedores
  const sortedUsers = users.sort((a, b) => a.order - b.order);

  for (const [index, user] of sortedUsers.entries()) {
    try {
      console.log(`\n📝 [${index + 1}/${users.length}] Creando: ${user.name} (${user.role})...`);
      
      // Determinar reportsTo basado en la jerarquía
      let reportsTo = null;
      if (user.role === 'supervisor' && gerenteId) {
        reportsTo = gerenteId;
      } else if (user.role === 'vendedor') {
        reportsTo = supervisorId || gerenteId; // Prefiere supervisor, sino gerente
      }

      // Preparar datos del usuario
      const userData = {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        reportsTo: reportsTo,
        active: 1
      };

      console.log(`   📤 Enviando datos:`, JSON.stringify(userData, null, 2));

      // Crear usuario via API
      const response = await axios.post(`${API_BASE}/users`, userData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Guardar IDs para jerarquía
      if (user.role === 'gerente') {
        gerenteId = response.data.id;
        console.log(`   👑 Gerente ID guardado: ${gerenteId}`);
      } else if (user.role === 'supervisor') {
        supervisorId = response.data.id;
        console.log(`   👮 Supervisor ID guardado: ${supervisorId}`);
      }

      createdUsers.push({
        ...user,
        id: response.data.id,
        reportsTo: reportsTo
      });

      console.log(`   ✅ ${user.name} creado exitosamente con ID: ${response.data.id}`);
      
      // Pequeña pausa entre requests para no saturar el servidor
      if (index < sortedUsers.length - 1) {
        await sleep(500); // 0.5 segundos
      }
      
    } catch (error) {
      console.error(`   ❌ Error creando ${user.name}:`);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      } else {
        console.error(`   Error: ${error.message}`);
      }
      
      failedUsers.push({
        ...user,
        error: error.response?.data || error.message
      });
    }
  }

  // Actualizar jerarquías si es necesario (segundo pase)
  console.log('\n🔄 Actualizando jerarquías...');
  
  if (supervisorId && gerenteId) {
    try {
      await axios.put(`${API_BASE}/users/${supervisorId}`, { 
        reportsTo: gerenteId 
      });
      console.log('✅ Supervisor asignado al Gerente');
    } catch (error) {
      console.error('❌ Error actualizando supervisor:', error.response?.data || error.message);
    }
  }

  // Actualizar vendedores para que reporten al supervisor si existe
  if (supervisorId) {
    const vendedores = createdUsers.filter(u => u.role === 'vendedor');
    for (const vendedor of vendedores) {
      try {
        await axios.put(`${API_BASE}/users/${vendedor.id}`, { 
          reportsTo: supervisorId 
        });
        console.log(`✅ ${vendedor.name} asignado al Supervisor`);
        await sleep(200); // Pausa pequeña
      } catch (error) {
        console.error(`❌ Error actualizando ${vendedor.name}:`, error.response?.data || error.message);
      }
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(50));
  console.log(`✅ Usuarios creados exitosamente: ${createdUsers.length}`);
  console.log(`❌ Usuarios con errores: ${failedUsers.length}`);
  
  if (createdUsers.length > 0) {
    console.log('\n👥 USUARIOS CREADOS:');
    createdUsers.forEach(user => {
      console.log(`   • ${user.name} (${user.role}) - ID: ${user.id} - Reporta a: ${user.reportsTo || 'Nadie'}`);
    });
  }
  
  if (failedUsers.length > 0) {
    console.log('\n💥 USUARIOS CON ERROR:');
    failedUsers.forEach(user => {
      console.log(`   • ${user.name} (${user.role}) - Error: ${JSON.stringify(user.error)}`);
    });
  }

  console.log('\n🎉 Proceso completado!');
  
  if (failedUsers.length > 0) {
    console.log('\n⚠️  Algunos usuarios no se pudieron crear. Revisa los errores arriba.');
    console.log('   Puedes intentar crearlos manualmente o ejecutar el script de nuevo.');
  }
}

// Ejecutar script
if (require.main === module) {
  createUsers().catch(error => {
    console.error('\n💥 Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = createUsers;