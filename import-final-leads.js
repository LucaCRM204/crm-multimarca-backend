// import-final-leads.js - Import con asignación garantizada (todo bajo /api)
// Instalar: npm install axios
// Ejecutar: node import-final-leads.js

const axios = require('axios');

const baseUrl = 'https://crm-multimarca-backend-production.up.railway.app';
const email = 'Luca@alluma.com';
const password = 'Luca2702';
const DIRECT_TOKEN = ''; // opcional

let currentSellerIndex = 0; // Rotación round-robin

// ======= TU ARRAY (sin cambios) =======
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


// =======================
//   AUTH / HELPERS
// =======================
async function getAuthToken() {
  try {
    console.log('Haciendo login...');
    // LOGIN: SIEMPRE /api
    const { data } = await axios.post(`${baseUrl}/api/auth/login`, { email, password });
    if (data?.token) {
      console.log('Token obtenido exitosamente');
      return data.token;
    }
    console.error('Error en login (sin token):', data);
    return null;
  } catch (error) {
    console.error('Error de conexión en login:', error.response?.data || error.message);
    return null;
  }
}

async function fetchSellersFromAPI(token) {
  try {
    // USERS: también bajo /api (tu router de users está montado con /api en el server)
    const { data } = await axios.get(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const list = Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []);
    return list
      .filter(u => u.role === 'vendedor' && (u.active === 1 || u.active === true))
      .map(u => ({ id: u.id, nombre: u.name, email: u.email }));
  } catch {
    return [];
  }
}

function hardcodedSellers() {
  return [
    { id: 5,  nombre: 'Isaias Portillo',        email: 'isaias.portillo' },
    { id: 6,  nombre: 'Brenda Nuñez',           email: 'brenda.nunez' },
    { id: 7,  nombre: 'Juan Ignacio Fernandez', email: 'juan.fernandez' },
    { id: 8,  nombre: 'Juan Ignacio Armejeiras',email: 'juan.armejeiras' },
    { id: 9,  nombre: 'Ariana Godoy',           email: 'ariana.godoy' },
    { id: 10, nombre: 'Gonzalo Arias',          email: 'gonzalo.arias' },
    { id: 11, nombre: 'Yesica Morgante',        email: 'yesica.morgante' },
    { id: 12, nombre: 'Esteban Vorraber',       email: 'esteban.vorraber' },
  ];
}

function getNextSeller(sellers) {
  if (!sellers.length) return null;
  const seller = sellers[currentSellerIndex];
  currentSellerIndex = (currentSellerIndex + 1) % sellers.length;
  return seller;
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// =======================
//   IMPORT PRINCIPAL
// =======================
async function importAllLeads() {
  console.log('Iniciando proceso de importación con derivación automática...\n');

  // 1) Token
  let token = DIRECT_TOKEN;
  if (!token) {
    console.log('Probando login automático...');
    token = await getAuthToken();
    if (!token) {
      console.log('No se pudo obtener el token. Proceso cancelado.');
      return;
    }
  } else {
    console.log('Usando token directo proporcionado...');
  }

  // 2) Vendedores (API > fallback)
  let sellers = await fetchSellersFromAPI(token);
  if (!sellers.length) {
    console.log('No pude obtener vendedores por API. Usando lista predefinida...');
    sellers = hardcodedSellers();
  }
  console.log(`Vendedores disponibles: ${sellers.length}`);
  sellers.forEach((s, i) => console.log(`${i + 1}. ${s.nombre}`));
  if (sellers.length) {
    console.log(`Se distribuirán los leads entre ${sellers.length} vendedores usando rotación round-robin.\n`);
  }

  // 3) Stats
  let imported = 0;
  let errors = 0;
  const errorDetails = [];
  const assignmentStats = {};
  sellers.forEach(s => { assignmentStats[s.nombre] = 0; });

  console.log(`Procesando ${leadsData.length} leads...\n`);

  // 4) Loop
  for (let i = 0; i < leadsData.length; i++) {
    const original = leadsData[i];
    const lead = { ...original };

    // Elegir vendedor
    let chosenSeller = null;
    if (sellers.length) {
      chosenSeller = getNextSeller(sellers);
      lead.vendedor = chosenSeller.id; // tu API lo mapea a assigned_to:contentReference[oaicite:3]{index=3}
    }

    try {
      // (A) CREAR: /api/leads  (¡ojo el prefijo!)
      const createRes = await axios.post(`${baseUrl}/api/leads`, lead, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const created = createRes.data || {};
      const leadId = created?.lead?.id || created?.id;
      if (!leadId) {
        throw new Error('No llegó el ID del lead creado');
      }

      // (B) FORZAR ASIGNACIÓN (por si el create no tomó vendedor): PUT /api/leads/:id
      if (chosenSeller?.id) {
        let assignedOk = false;

        // Intento 1: { vendedor }
        try {
          await axios.put(`${baseUrl}/api/leads/${leadId}`, { vendedor: chosenSeller.id }, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          const { data: check1 } = await axios.get(`${baseUrl}/api/leads/${leadId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (check1?.lead?.vendedor === chosenSeller.id) assignedOk = true;
        } catch (_) {}

        if (!assignedOk) {
          console.log(`⚠ ${i + 1}/${leadsData.length} - No pude confirmar asignación de ${lead.nombre} a ${chosenSeller.nombre}`);
        } else {
          assignmentStats[chosenSeller.nombre] = (assignmentStats[chosenSeller.nombre] || 0) + 1;
        }
      }

      imported++;
      const suffix = chosenSeller ? ` → ${chosenSeller.nombre}` : '';
      console.log(`✓ ${i + 1}/${leadsData.length} - ${lead.nombre} (${lead.marca} ${lead.modelo})${suffix}`);

      await sleep(150);

    } catch (err) {
      errors++;
      const errorMsg = err.response?.data?.error || err.message;
      errorDetails.push(`${lead.nombre}: ${errorMsg}`);
      console.log(`✗ ${i + 1}/${leadsData.length} - Error: ${lead.nombre} - ${errorMsg}`);
      await sleep(150);
    }
  }

  // 5) Reporte
  console.log('\n' + '='.repeat(50));
  console.log('REPORTE FINAL:');
  console.log('='.repeat(50));
  console.log(`Leads importados exitosamente: ${imported}`);
  console.log(`Errores encontrados: ${errors}`);
  console.log(`Total procesados: ${leadsData.length}`);
  console.log(`Tasa de éxito: ${((imported / leadsData.length) * 100).toFixed(1)}%`);

  if (sellers.length) {
    console.log('\nDISTRIBUCION DE LEADS POR VENDEDOR:');
    console.log('-'.repeat(40));
    Object.entries(assignmentStats).forEach(([nombre, cantidad]) => {
      console.log(`${nombre}: ${cantidad} leads`);
    });
  }

  if (errorDetails.length) {
    console.log('\nDETALLE DE ERRORES:');
    console.log('-'.repeat(30));
    errorDetails.forEach((msg, idx) => console.log(`${idx + 1}. ${msg}`));
  }

  console.log('\nProceso completado.');
}

// Ejecutar
importAllLeads().catch(console.error);
