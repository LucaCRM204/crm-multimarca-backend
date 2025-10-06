const axios = require('axios');

// Configuración del CRM
const CRM_CONFIG = {
  baseURL: 'https://crm-multimarca-backend-production.up.railway.app/api',
  // Credenciales para hacer login automático
  email: 'Luca@alluma.com', // Cambiar por tu email de admin
  password: 'Luca2702'    // Cambiar por tu password
};

// Variable para almacenar el token
let authToken = null;

// Función para hacer login y obtener token
async function login() {
  try {
    console.log('🔐 Haciendo login...');
    const response = await axios.post(`${CRM_CONFIG.baseURL}/auth/login`, {
      email: CRM_CONFIG.email,
      password: CRM_CONFIG.password
    });
    
    if (response.data.ok && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login exitoso');
      return true;
    } else {
      console.log('❌ Login falló:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en login:', error.response?.data || error.message);
    return false;
  }
}

// TODOS LOS 133 LEADS EXTRAÍDOS DEL EXCEL COMPLETO
const LEAD_DATA = [
  {
    nombre: "Francisco Valenzuel",
    telefono: "+543416056935",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: usado"
  },
  {
    nombre: "Mario Paez",
    telefono: "+543515400249",
    modelo: "expert",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Adriano Reinek",
    telefono: "+543754458553",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No tengo entrega"
  },
  {
    nombre: "Dante Ruben Klein",
    telefono: "3492567187",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo"
  },
  {
    nombre: "Raul Agustin Walton",
    telefono: "+542477350162",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Ernesto Ruiz",
    telefono: "+541166431598",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Miguel Angel Izaguirre",
    telefono: "+541159643544",
    modelo: "208",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "un Ford Focus mod.2007, nasfta aire direcc. levanta crist. elrc. delanteros y motor hecho nuevo a full.",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: un Ford Focus mod.2007, nasfta aire direcc. levanta crist. elrc. delanteros y motor hecho nuevo a full."
  },
  {
    nombre: "Bibiana Enriquez",
    telefono: "+541140580561",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efetivo"
  },
  {
    nombre: "Roxana Márquez",
    telefono: "+543518180850",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  },
  {
    nombre: "Teresa perez",
    telefono: "+542254531043",
    modelo: "208",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "un usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: un usado"
  },
  {
    nombre: "Karen Cereijo",
    telefono: "+541127938374",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado"
  },
  {
    nombre: "Eduardo Abel Gioria",
    telefono: "+543541571006",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Fiat mod 98 Palio y dos millones"
  },
  {
    nombre: "Luciano Leonel",
    telefono: "+542617190639",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Mariano Matias Videla",
    telefono: "+5493541540683",
    modelo: "tera",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo"
  },
  {
    nombre: "Ramon Perez",
    telefono: "+542616294568",
    modelo: "taos",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo o ambos"
  },
  {
    nombre: "Viviana Rossetti",
    telefono: "+543512126389",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Solo financiación . Info solo por wasap por favor no puedo atender llamadas"
  },
  {
    nombre: "Claudia Pelozo",
    telefono: "+541167077972",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo"
  },
  {
    nombre: "Cristian Luque",
    telefono: "+543406423780",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Ruben Barrientos",
    telefono: "+541136940037",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: vogage 2013"
  },
  {
    nombre: "Julio Ferrer",
    telefono: "+543517702577",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Ernesto Furnes",
    telefono: "Si",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Ambos"
  },
  {
    nombre: "Sergio Torassa",
    telefono: "+5493404524644",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No.no.tengo empezar de cero"
  },
  {
    nombre: "Juan Pettersson",
    telefono: "+541136136317",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "walter nestor vilchez",
    telefono: "+543462532259",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "rpp",
    telefono: "+543834383838",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Vera Angel Gabriel",
    telefono: "+5491138616813",
    modelo: "polo",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Claudio Melo",
    telefono: "+542984191333",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Alex Ferrari",
    telefono: "+541164751512",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Dorita Hernandez",
    telefono: "2364348686",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "Usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Usado"
  },
  {
    nombre: "Ezequiel Andres Gerez",
    telefono: "+541176335987",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "Erica Pacifico",
    telefono: "+13435213147",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Omar Abranca",
    telefono: "+541123383649",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Astra 2006"
  },
  {
    nombre: "Pedro Alberto Moderne",
    telefono: "+543416651846",
    modelo: "polo",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto y efectivo",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto y efectivo"
  },
  {
    nombre: "Isaías Daniel Gómez",
    telefono: "+541127447098",
    modelo: "expert",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Roque Correa leonardo",
    telefono: "+541151085933",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "Usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Usado"
  },
  {
    nombre: "Gustavo Amoroso",
    telefono: "+542214118464",
    modelo: "polo",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "Usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Usado"
  },
  {
    nombre: "Walter Fabian Zaracho",
    telefono: "+541159957021",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Javier Pereira Morinigo",
    telefono: "+542804963981",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Joaquín Merlo Marelli",
    telefono: "+542236369024",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Esteban Luna",
    telefono: "+541131433207",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Carlos Alberto Sanchez",
    telefono: "+5493735406477",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "un gol usado mod.2007",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: un gol usado mod.2007"
  },
  {
    nombre: "Angel Lezcano",
    telefono: "+541171303498",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Tengo planes"
  },
  {
    nombre: "Rosa Martinez",
    telefono: "+541144149933",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Silvia Garcia",
    telefono: "+541168074262",
    modelo: "polo",
    marca: "vw",
    formaPago: "Financiado",
    infoUsado: "Si con anticipo",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si con anticipo"
  },
  {
    nombre: "Carlos Quadrelli",
    telefono: "+541145630810",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si una fiorino 2011 conaire dirección y gnc",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si una fiorino 2011 conaire dirección y gnc"
  },
  {
    nombre: "Francisco Ortigoza",
    telefono: "+541171094867",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo solo"
  },
  {
    nombre: "Diego Burgos",
    telefono: "3704527718",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  },
  {
    nombre: "si me intrress",
    telefono: "+541127051117",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Mariano Julian Castro Olivera",
    telefono: "+5491164987440",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Ricardo Serrano",
    telefono: "+543835510284",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Roberto Alvarez",
    telefono: "+542923652069",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "entregi auto",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: entregi auto"
  },
  {
    nombre: "flavia blanco",
    telefono: "+543777511054",
    modelo: "titano",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "usado y efectivo",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: usado y efectivo"
  },
  {
    nombre: "Claudio Battistelli",
    telefono: "+541127057489",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "si un Chevrolet Sonic 2015",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si un Chevrolet Sonic 2015"
  },
  {
    nombre: "Ariel Hernan Motta",
    telefono: "+541136042546",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: nada"
  },
  {
    nombre: "Stella Maris Ladeda",
    telefono: "+541137610175",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "Angel Duran",
    telefono: "+542645638259",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Augusto Chávez",
    telefono: "+543513856660",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Ariel Daban",
    telefono: "+542656446080",
    modelo: "titano",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "Auto usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Auto usado"
  },
  {
    nombre: "Ruben Amarilla",
    telefono: "+542215241254",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado sí..",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado sí.."
  },
  {
    nombre: "Nacho",
    telefono: "+541176165526",
    modelo: "expert",
    marca: "peugeot",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Anticipo y cuotas"
  },
  {
    nombre: "Ruben Silvestri",
    telefono: "+541150399517",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Juan domingo Brito",
    telefono: "+541124582865",
    modelo: "titano",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "si efectivo",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si efectivo"
  },
  {
    nombre: "Mandy Ortiz",
    telefono: "+541165690756",
    modelo: "polo",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Ismael Borean",
    telefono: "+542214631509",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efe"
  },
  {
    nombre: "Daniela Cuto",
    telefono: "+542355645973",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: gol gti 2010 3p"
  },
  {
    nombre: "Carmen Ogliastre",
    telefono: "+5491168326183",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  },
  {
    nombre: "Walter Quiroga",
    telefono: "+542616157473",
    modelo: "polo",
    marca: "vw",
    formaPago: "Financiado",
    infoUsado: "Si un anticipo",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si un anticipo"
  },
  {
    nombre: "Alfredo Gallardo",
    telefono: "+543794540209",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "Si tengo",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si tengo"
  },
  {
    nombre: "Alberto Luis Aldana",
    telefono: "+542996563578",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "si entrego cinco palos de cuánto sería la cuota",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si entrego cinco palos de cuánto sería la cuota"
  },
  {
    nombre: "Silvia Nuñez",
    telefono: "+543489359735",
    modelo: "polo",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "Auto usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Auto usado"
  },
  {
    nombre: "Manuel Cataldo",
    telefono: "+541155237785",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "xrtvrctc",
    telefono: "+543435214558",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: ubrxuhxfvyyc"
  },
  {
    nombre: "Fabricio Gonzalez",
    telefono: "+542645476134",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "Auto Usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Auto Usado"
  },
  {
    nombre: "Juanga Medina",
    telefono: "+542216496746",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "ricardo.daniel.ortiz65@gmail.com Orti",
    telefono: "+541124560598",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: 20000 dólares"
  },
  {
    nombre: "Barbara Pinharanda",
    telefono: "+5493484453768",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: puede ser"
  },
  {
    nombre: "Jorge Luis Caram",
    telefono: "+541162857256",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado"
  },
  {
    nombre: "maría de los ángeles Bondia",
    telefono: "+5493513952479",
    modelo: "2008",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Alan Jonatan Larrosa",
    telefono: "+542914704447",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Jose Handel",
    telefono: "+541164401640",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: coche y efctivo"
  },
  {
    nombre: "Paula Servin",
    telefono: "+541131253144",
    modelo: "2008",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Ernesto Pereyra",
    telefono: "+543511568868",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: financiación"
  },
  {
    nombre: "Isabel Simplemente",
    telefono: "+541140411218",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "Fabio Amarilla",
    telefono: "+543512691971",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "Tengo un usado que no anda y efectivo...el usado es viejo,es un Renault 9 modelo 95...",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Tengo un usado que no anda y efectivo...el usado es viejo,es un Renault 9 modelo 95..."
  },
  {
    nombre: "Ignacio Ramon Aquino",
    telefono: "+543718633698",
    modelo: "expert",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: ninguno de los dos"
  },
  {
    nombre: "Pedro Montenegro",
    telefono: "+541122875917",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Eduardo Orlando Acosta",
    telefono: "+543624053259",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Antonio Domínguez",
    telefono: "+543704831503",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "vehículo usado Ecosport 2011",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: vehículo usado Ecosport 2011"
  },
  {
    nombre: "Ricardo anastasio trevisi",
    telefono: "+542915245692",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: tengo un Ford Fiesta max año 2010 muy bueno"
  },
  {
    nombre: "Juan Carlos Ledesma",
    telefono: "+543518186570",
    modelo: "208",
    marca: "peugeot",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Valeria Chueco",
    telefono: "+542216027105",
    modelo: "expert",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Lavadero Oscar",
    telefono: "+541158306978",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si 2.500",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si 2.500"
  },
  {
    nombre: "Jose Luis Spehrs",
    telefono: "+541131481584",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  },
  {
    nombre: "J C",
    telefono: "1132972552",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: 500000"
  },
  {
    nombre: "Patricia Morais",
    telefono: "+543741403175",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Anticipo"
  },
  {
    nombre: "Jose Luis Cabanillas",
    telefono: "+541138056007",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Sergio Andres Benitez",
    telefono: "+543624048648",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Corsa 1.6 modelo 2007"
  },
  {
    nombre: "Jose Luis Villordo",
    telefono: "+543415499794",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: no"
  },
  {
    nombre: "Claudio Oyola",
    telefono: "+542616323070",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Deseo presupuestos."
  },
  {
    nombre: "Olga Susana Cancino",
    telefono: "+542995073735",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: anticipo en efectivo"
  },
  {
    nombre: "Alejandro Morrone",
    telefono: "+541140801034",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Victoria Salvatierra",
    telefono: "+5493413347544",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: usado"
  },
  {
    nombre: "Jacob Llanos",
    telefono: "+541167848914",
    modelo: "parner",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "Un auto usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Un auto usado"
  },
  {
    nombre: "lorena maria poblete",
    telefono: "+541156526262",
    modelo: "mobi",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: puedo pagar cuotas"
  },
  {
    nombre: "Cristina Tohara Tacuri",
    telefono: "+59175733172",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Ani Teruelo",
    telefono: "+541124843758",
    modelo: "208",
    marca: "peugeot",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Solo anticipo"
  },
  {
    nombre: "Jorge Mercado",
    telefono: "+541163755996",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Patocho Matamala-pinto",
    telefono: "+542994223369",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Paola Diaz",
    telefono: "+543813546934",
    modelo: "argo",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "sii",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: sii"
  },
  {
    nombre: "Daniel Cangaro",
    telefono: "+541141707212",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Ambos"
  },
  {
    nombre: "Ivar Ayllon",
    telefono: "+5493884588311",
    modelo: "pulse",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: efectivo"
  },
  {
    nombre: "Rikii Saucedo",
    telefono: "+543625279722",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Una moto"
  },
  {
    nombre: "Federico Romero",
    telefono: "+542932529453",
    modelo: "titano",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: ambos"
  },
  {
    nombre: "Luis Muñoz Vicuña",
    telefono: "+541157237373",
    modelo: "fiorino",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo"
  },
  {
    nombre: "vanesa cardenas",
    telefono: "+5491168245428",
    modelo: "cronos",
    marca: "fiat",
    formaPago: "Efectivo",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Efectivo"
  },
  {
    nombre: "Richard Bohn",
    telefono: "+5492302566434",
    modelo: "amarok",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "Un auto",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Un auto"
  },
  {
    nombre: "Carlos Alberto Latorre",
    telefono: "+542901488134",
    modelo: "taos",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Ecosport titanium at"
  },
  {
    nombre: "Mara Palatucci",
    telefono: "+543435102858",
    modelo: "tera",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Nada porque vendi mi auto para pagar deudas."
  },
  {
    nombre: "Jorge Gomez",
    telefono: "+543854405066",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Fiat crono"
  },
  {
    nombre: "Jorgeevaristopuccini",
    telefono: "+543794948466",
    modelo: "2008",
    marca: "peugeot",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: El pegador 2008 como seria"
  },
  {
    nombre: "Victor Hugo Jofre",
    telefono: "+542664514993",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado y efectivo",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado y efectivo"
  },
  {
    nombre: "Julio Cesar Villagra",
    telefono: "+543834774225",
    modelo: "nivus",
    marca: "vw",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado"
  },
  {
    nombre: "Carlos Luna",
    telefono: "+542334404310",
    modelo: "polo",
    marca: "vw",
    formaPago: "Financiado",
    infoUsado: "Si con anticipo",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si con anticipo"
  },
  {
    nombre: "Carlos Quadrelli",
    telefono: "+541145630810",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "Poseo una fiorino 2011 Fire con aire direccion y gnc de 5.º generación soy único dueño la tengo de 0 k",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Poseo una fiorino 2011 Fire con aire direccion y gnc de 5.º generación soy único dueño la tengo de 0 k"
  },
  {
    nombre: "Angel Bustos",
    telefono: "+543815372839",
    modelo: "strada",
    marca: "fiat",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado"
  },
  {
    nombre: "Ruben Mendieta",
    telefono: "+5491132861886",
    modelo: "polo",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  },
  {
    nombre: "Lorena Solesdad Gonzalez",
    telefono: "+541165924839",
    modelo: "t-cross",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Lorena Tene",
    telefono: "+542944289775",
    modelo: "pulse",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "Tengo anticipo",
    entrega: false,
    fecha: "2025-09-14",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Tengo anticipo"
  },
  {
    nombre: "Claudia Amuchastegui",
    telefono: "+5492616350419",
    modelo: "208",
    marca: "peugeot",
    formaPago: "Usado + Efectivo",
    infoUsado: "auto usado",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: auto usado"
  },
  {
    nombre: "Oscar Barada",
    telefono: "+543764646100",
    modelo: "tera",
    marca: "vw",
    formaPago: "Contado",
    infoUsado: "si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: si"
  },
  {
    nombre: "Nemy Castillo",
    telefono: "+92612464239",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Financiado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Solo financiacion por favor.gracias"
  },
  {
    nombre: "Toty Ferre",
    telefono: "+542975922399",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "Si",
    entrega: true,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: Si"
  },
  {
    nombre: "Juan Cruz Castro",
    telefono: "+543549533248",
    modelo: "toro",
    marca: "fiat",
    formaPago: "Contado",
    infoUsado: "",
    entrega: false,
    fecha: "2025-09-13",
    estado: "nuevo",
    fuente: "formulario_web",
    notas: "Importado desde Excel. Info original: No"
  }
];

// Función para crear un lead en el CRM
async function createLead(leadData) {
  try {
    const response = await axios.post(`${CRM_CONFIG.baseURL}/leads`, leadData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: response.data, lead: leadData };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      lead: leadData 
    };
  }
}

// Función principal de importación
async function importLeads() {
  console.log('🚀 Iniciando importación de leads...\n');
  
  // Hacer login primero
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ No se pudo hacer login. Verifica las credenciales.');
    return;
  }
  
  console.log(`📊 Se importarán ${LEAD_DATA.length} leads\n`);
  
  // Estadísticas previas
  const marcas = LEAD_DATA.reduce((acc, lead) => {
    acc[lead.marca] = (acc[lead.marca] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📈 Distribución por marca:');
  Object.entries(marcas).forEach(([marca, count]) => {
    console.log(`   ${marca}: ${count} leads`);
  });
  console.log('');
  
  // Importar leads uno por uno
  const results = {
    success: [],
    errors: []
  };
  
  for (let i = 0; i < LEAD_DATA.length; i++) {
    const lead = LEAD_DATA[i];
    console.log(`⏳ Importando lead ${i + 1}/${LEAD_DATA.length}: ${lead.nombre}`);
    
    const result = await createLead(lead);
    
    if (result.success) {
      results.success.push(result);
      console.log(`✅ Lead creado exitosamente (ID: ${result.data.lead?.id})`);
    } else {
      results.errors.push(result);
      console.log(`❌ Error: ${result.error}`);
    }
    
    // Pausa breve entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Resumen final
  console.log('\n🎉 Importación completada!');
  console.log(`✅ Exitosos: ${results.success.length}`);
  console.log(`❌ Errores: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n💾 Leads con errores:');
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.lead.nombre} - ${error.error}`);
    });
  }
  
  return results;
}

// Función para modo dry-run (solo mostrar sin importar)
function dryRun() {
  console.log('🔍 MODO DRY-RUN: Solo mostrando datos, sin importar\n');
  
  console.log(`📊 Se procesarían ${LEAD_DATA.length} leads:\n`);
  
  LEAD_DATA.forEach((lead, index) => {
    console.log(`${index + 1}. ${lead.nombre}`);
    console.log(`   📞 ${lead.telefono}`);
    console.log(`   🚗 ${lead.marca} ${lead.modelo}`);
    console.log(`   💰 ${lead.formaPago}`);
    console.log(`   📅 ${lead.fecha}`);
    if (lead.infoUsado) console.log(`   📝 ${lead.infoUsado}`);
    console.log('');
  });
}

// Ejecutar según modo
if (process.argv.includes('--dry-run')) {
  dryRun();
} else {
  // Verificar configuración antes de importar
  if (!CRM_CONFIG.email || CRM_CONFIG.email === 'admin@multimarca.com') {
    console.log('❌ ERROR: Debes configurar tu email en CRM_CONFIG.email');
    process.exit(1);
  }
  
  if (!CRM_CONFIG.password || CRM_CONFIG.password === 'tu_password_aqui') {
    console.log('❌ ERROR: Debes configurar tu password en CRM_CONFIG.password');
    process.exit(1);
  }
  
  importLeads()
    .then((results) => {
      if (results) {
        console.log('\n✨ Proceso finalizado');
        process.exit(results.errors?.length > 0 ? 1 : 0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}