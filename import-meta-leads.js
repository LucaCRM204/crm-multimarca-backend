// import_leads.js - Para ejecutar en terminal con Node.js
// Instalar primero: npm install node-fetch
// Ejecutar: node import_leads.js

const fetch = require('node-fetch');

const baseUrl = 'https://crm-multimarca-backend-production.up.railway.app';
const email = 'Luca@alluma.com';
const password = 'Luca2702';

const leadsData = [
  {
    nombre: "Adolfo Antunez",
    telefono: "+54155080777",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Financiado",
    notas: "Auto año 24 con 32000 km puedo aportar uno dólares y el resto en cuotas",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Miguel Angel Vieira",
    telefono: "+542664555527",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Enrique plastina",
    telefono: "3757628854",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Jonatan Emir",
    telefono: "3498403814",
    modelo: "fastback",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Info",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Juan Rebholz",
    telefono: "+543704682180",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "si amarok4x4 180hp 2011",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "miguel",
    telefono: "+543854419123",
    modelo: "pulse",
    marca: "fiat",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Marta Ricca",
    telefono: "+543584193891",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "No",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Javier Antonio Scutaro",
    telefono: "+541170212892",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "pedroramon",
    telefono: "+541141610054",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Financiado",
    notas: "usado más cuotas",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Juan Gualberto Vallejos",
    telefono: "+543794243621",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Toro 2019, Freedom 1.8 C Aut.84.000 km Excelente estado todo pago",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Alberto Cagol",
    telefono: "+543515741574",
    modelo: "tera",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Olga Guerrero",
    telefono: "+542914352052",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    notas: "tengo un usado y efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Olver Paz",
    telefono: "+543874200800",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Carlos Enrique Moro",
    telefono: "+543815130968",
    modelo: "pulse",
    marca: "fiat",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Mario Saade",
    telefono: "+543413856846",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Cuál es la dirección ?",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Claudia Giordano la Rosa",
    telefono: "+541150646872",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Financiado",
    notas: "Estoy interesada en comprar una tcrosss totalmente en cuotas y recibirla en 4/5 meses",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "SURDICA",
    telefono: "+541134299870",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Tal vez",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Susana Bock",
    telefono: "+543425059857",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Nelson Santos Palacios",
    telefono: "+542622526199",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "ambos",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Ricardo Cuevas",
    telefono: "+542984310548",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Una Ecosport 2015",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Francisco Luis Sosa",
    telefono: "+542291499018",
    modelo: "polo",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Gloria Cristina Vilas",
    telefono: "+12364685681",
    modelo: "taos",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Juan D Muraña",
    telefono: "+543401433547",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    notas: "No",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Gabriel Coronel",
    telefono: "+541168968156",
    modelo: "pulse",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "Renault kwid",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Estela SabinaBorre",
    telefono: "+543364344735",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Pablo Cuva",
    telefono: "+542302525479",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "si un gol 2012 power",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Fernando Schamne",
    telefono: "+5491161321802",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Rodrigo Chandia",
    telefono: "+543518657358",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Contado",
    notas: "ambos",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Alejandra Sosa",
    telefono: "+542625448097",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    notas: "Efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Vanesa Zabala",
    telefono: "+542616064079",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    notas: "Si tengo y tengo efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Hugo Corzo",
    telefono: "+543573430397",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Santi Ardanaz",
    telefono: "+543512300123",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "Auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Fede Flores",
    telefono: "+543875157663",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Juan González",
    telefono: "+542216414310",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "suzuki fun 2005",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Victoria Eva Godoy",
    telefono: "+543513735342",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Jose Manuel Alvarez Urdaneta",
    telefono: "+541123979842",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "No",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Nahuel Gonzalez",
    telefono: "1131051318",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Argo hgt",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Federico Layh",
    telefono: "+543758480331",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Auto usado oroch",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Carlos Vicente Gomez",
    telefono: "+541161268884",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "Solo auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Maximo Felix Scheinsohn",
    telefono: "+541169062094",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Julieta Sentin",
    telefono: "+542271438764",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Lucia Marino",
    telefono: "+5492615397662",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Carlos Eduardo",
    telefono: "+541125063996",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "auto usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Alejandro Rosalez",
    telefono: "+543804720755",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Si cuarto con un usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Fernando Fernandez",
    telefono: "+541131697917",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "efectivo",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Monchi Herrera",
    telefono: "+543493495418",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Simon Lucas Sanconte",
    telefono: "+541159566883",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    notas: "algo efec",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Naty Naty",
    telefono: "3518500773",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "Si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Ce Cii",
    telefono: "+542215624502",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "5000000",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Aron Elías costanzo",
    telefono: "+53405439368",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "4000000",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Lizandro Daniel Comet",
    telefono: "+541127917517",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Rocy Rodriguez",
    telefono: "+543755396798",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Fabián Benjamín Gabriel Flores",
    telefono: "+543413707935",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    notas: "si",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Ricardo Augusto Caraballo",
    telefono: "+543764172086",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Contado",
    notas: "no",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Enrique Medrano",
    telefono: "+541164394388",
    modelo: "polo",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Jesus Cruz",
    telefono: "+542622353681",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Con Usado",
    notas: "Usado",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  },
  {
    nombre: "Miguel E Ortiz",
    telefono: "+543888685192",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Con Usado",
    notas: "si un auto",
    estado: "nuevo",
    fuente: "otro",
    fecha: "2025-09-09"
  }
];

async function getAuthToken() {
  try {
    console.log('🔐 Haciendo login...');
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token obtenido exitosamente');
      return data.token;
    } else {
      const error = await response.json();
      console.error('❌ Error en login:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error de conexión en login:', error.message);
    return null;
  }
}

async function importAllLeads() {
  console.log('🚀 Iniciando proceso de importación...\n');
  
  // Obtener token
  const token = await getAuthToken();
  if (!token) {
    console.log('❌ No se pudo obtener el token. Proceso cancelado.');
    return;
  }
  
  let imported = 0;
  let errors = 0;
  const errorDetails = [];
  
  console.log(`📊 Procesando ${leadsData.length} leads...\n`);
  
  for (let i = 0; i < leadsData.length; i++) {
    const lead = leadsData[i];
    
    try {
      const response = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lead)
      });
      
      if (response.ok) {
        imported++;
        console.log(`✅ ${i+1}/${leadsData.length} - ${lead.nombre} (${lead.marca} ${lead.modelo})`);
      } else {
        const error = await response.json();
        errors++;
        errorDetails.push(`${lead.nombre}: ${error.error || 'Error desconocido'}`);
        console.log(`❌ ${i+1}/${leadsData.length} - Error: ${lead.nombre} - ${error.error || 'Error desconocido'}`);
      }
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      errorDetails.push(`${lead.nombre}: Error de conexión - ${error.message}`);
      console.log(`❌ ${i+1}/${leadsData.length} - Error conexión: ${lead.nombre}`);
    }
  }
  
  // Reporte final
  console.log('\n' + '='.repeat(50));
  console.log('📈 REPORTE FINAL:');
  console.log('='.repeat(50));
  console.log(`✅ Leads importados exitosamente: ${imported}`);
  console.log(`❌ Errores encontrados: ${errors}`);
  console.log(`📊 Total procesados: ${leadsData.length}`);
  console.log(`🎯 Tasa de éxito: ${((imported / leadsData.length) * 100).toFixed(1)}%`);
  
  if (errorDetails.length > 0) {
    console.log('\n📋 DETALLE DE ERRORES:');
    console.log('-'.repeat(30));
    errorDetails.forEach((error, i) => {
      console.log(`${i+1}. ${error}`);
    });
  }
  
  console.log('\n🏁 Proceso completado.');
}

// Ejecutar la importación
importAllLeads().catch(console.error);