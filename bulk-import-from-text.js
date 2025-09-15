// bulk-import-from-text.js
// Uso: 1) npm i axios  2) node bulk-import-from-text.js
// Importa leads desde texto TAB-separado con orden:
// Nombre    p:Telefono    marca_modelo    comentario    fechaISO
//
// POST a: https://crm-multimarca-backend-production.up.railway.app/api/webhooks/bot-multimarca

const axios = require("axios");

// ================== CONFIG ==================
const ENDPOINT =
  "https://crm-multimarca-backend-production.up.railway.app/api/webhooks/bot-multimarca";
const FUENTE = "import_masivo";
const DEFAULT_FORMA_PAGO = "Consultar";
const BATCH_DELAY_MS = 250; // espaciado entre requests
const MAX_RETRIES = 3;

// ============ Pega acá tus filas (TSV) ============
const RAW = `
Alberto Rabasa	p:91162447135	volkswagen_tera	Precio de efectivo,gracias	2025-09-11T20:45:05-03:00	
María Catalina Mansilla	p:+5492616632713	volkswagen_taos	usado	2025-09-11T20:31:19-03:00	
Celso Argentino, do SANTOS	p:+543754460209	volkswagen_amarok	tengo un VW SURAN Higline 1.6 2016 caja automática con 155000 Kms	2025-09-11T20:22:41-03:00	
Carla Armas	p:+542226483393	fiat_pulse	ambos	2025-09-11T17:32:47-03:00	
Carla Algeri	p:+541167411364	volkswagen_nivus	Si	2025-09-11T17:21:12-03:00	
Bernardo Granone	p:+542625633325	fiat_argo	efectivo	2025-09-11T14:12:56-03:00	
Miguel Acosta Sosa	p:+541168097208	volkswagen_taos	Usado	2025-09-11T07:34:34-03:00	
Pelotero Aventureros	p:+41774750590	peugeot_parner	$ 5.000.000	2025-09-11T06:17:20-03:00	
Oscar del Valle	p:+542314411769	fiat_strada	Usado y efectivo	2025-09-11T06:05:15-03:00	
Miguel Angel Gorrachategui	p:+542235707975	peugeot_parner	Efectivo	2025-09-11T00:51:43-03:00	
Jorge Castro	p:+541161031391	volkswagen_polo	No	2025-09-10T22:59:11-03:00	
Roque anibal Chaves	p:+543413716845	volkswagen_taos	si fiat fiorino 2011 utilitaria	2025-09-10T22:31:59-03:00	
Jose Luis Casco	p:+542235411466	peugeot_2008	no	2025-09-10T22:21:59-03:00	
Kutty Martinez	p:+543751475757	fiat_cronos_	auto usado	2025-09-10T21:58:53-03:00	
Salvador Guarneri	p:+541154142360	volkswagen_taos	si	2025-09-10T21:03:59-03:00	
Mabel Gardiol	p:+543413140050	volkswagen_nivus	Auto usado	2025-09-10T20:48:25-03:00	
Charlie	p:91141810340	volkswagen_polo	No necesito financiación	2025-09-10T20:04:34-03:00	
Rosendo Palacio	p:+5491150193340	volkswagen_t-cross	un. auto	2025-09-10T17:05:16-03:00	
Jorge Rondo	p:+541150458139	fiat_cronos_	No	2025-09-10T15:56:40-03:00	
Roberto Jauregui Lorda	p:+542355647591	fiat_toro	usado	2025-09-10T15:32:21-03:00	
Fernando Davila	p:+542614686431	peugeot_expert	efectivo	2025-09-10T15:15:54-03:00	
Miguel Maximowicz	p:+543765092566	fiat_fastback	3.000.000	2025-09-10T14:19:43-03:00	
Jose Antonio Neziz	p:+543873432561	fiat_toro	1000000	2025-09-10T14:07:16-03:00	
Antonio Lauro	p:+542255507474	fiat_toro	cuento con una fiat toro volcano 2023 4x4 con 40000km	2025-09-10T12:34:42-03:00	
Kico Quinteros	p:+541154219839	volkswagen_t-cross	Ambos	2025-09-10T12:06:07-03:00	
MARCELO EDUARDO RUIZ	p:+543874449185	volkswagen_taos	Si	2025-09-10T11:18:00-03:00	
Noelia Tontarelli	p:Si	fiat_toro	Si	2025-09-10T11:13:22-03:00	
Benjamín Rodríguez	p:+543644449838	fiat_toro	Ambos	2025-09-10T09:23:23-03:00	
Karina Urquia	p:+5493533401892	volkswagen_t-cross	Efectivo	2025-09-10T02:07:44-03:00	
Horacio Rossi	p:+541162823329	volkswagen_taos	Auto usado	2025-09-10T01:38:36-03:00	
Carlos Baez	p:+5491150940664	fiat_toro	ambos	2025-09-10T01:29:43-03:00	
Miguel Angel Sirimarco	p:+5493814587178	fiat_toro	Usado	2025-09-10T00:26:06-03:00	
Arturo Vazquez	p:+541136735543	fiat_strada	fiat fiorino 2013	2025-09-11T21:14:14-03:00	
El Vichi Luis Rios	p:+543816345990	peugeot_208	Tengo una Citroen berlingo XTR diesel 2015 con 162.000 km mi única mano	2025-09-11T20:20:53-03:00	
Walter Monzon	p:+543624901646	fiat_cronos_	Efectivo	2025-09-11T20:19:17-03:00	
Oscar Alberto CARABALLO	p:+541166807767	fiat_strada	no	2025-09-11T19:58:12-03:00	
Walter Oscar Lapellegrina	p:+541157361282	fiat_strada	usado	2025-09-11T19:40:17-03:00	
Daniel Suliban	p:+541155680805	fiat_cronos_	si	2025-09-11T19:36:05-03:00	
Adolfo Antunez	p:+54 155080777	volkswagen_amarok	Busco Amarok últimos modelo lo de más no hay problema, estoy en Cba Cap	2025-09-11T19:28:25-03:00	
Félix Caballero	p:+543424664320	volkswagen_tera	no	2025-09-11T19:22:37-03:00	
andres manuel	p:+541127934827	fiat_argo	Hola solamente quiero averiguar cómo se manejan con las cuotas si son o accesible y de dónde son?	2025-09-11T19:13:22-03:00	
Daniel Rubilar	p:+542942615542	peugeot_2008	efectibo	2025-09-11T19:07:35-03:00	
Luisa Lemos	p:+543886710634	fiat_cronos_	efectivo	2025-09-11T18:22:04-03:00	
Rubén Orlando Martínez Bidart	p:1140944832	volkswagen_polo	Auto usado y/o efectivo	2025-09-11T18:08:52-03:00	
Rodolfo Peirano	p:+541144221916	fiat_cronos_	si,7000	2025-09-11T18:01:33-03:00	
Kary Biasucci	p:+542235220757	peugeot_208	2500000	2025-09-11T16:36:11-03:00	
Marcelo dobler	p:+543564522682	peugeot_parner	camioneta usada	2025-09-11T16:16:09-03:00	
Elvira Olivera	p:+541123029755	volkswagen_polo	no	2025-09-11T16:15:46-03:00	
Juan José Cassano	p:+543584636584	fiat_titano	Ambos...	2025-09-11T16:01:25-03:00	
Claudia Williams Del Castillo Arredondo	p:+542944816269	peugeot_parner	5000000	2025-09-11T16:01:21-03:00	
Marcelo Nievas	p:+5492644032258	fiat_argo	Si	2025-09-11T15:41:55-03:00	
Ramóns Ortiz	p:+5491150186842	fiat_cronos_	Auto usado	2025-09-11T14:32:57-03:00	
Yanet Bustamante	p:+541154552703	fiat_cronos_	2millones	2025-09-11T14:31:12-03:00	
Cintia Mena	p:+541133073839	fiat_cronos_	$ 3.000.000	2025-09-11T14:17:04-03:00	
Cesar Rivas	p:+541140440195	fiat_cronos_	aambos	2025-09-11T12:36:42-03:00	
monica fernanda macovaz	p:+543516421684	peugeot_parner	Necesito saber modelo y km que tiene y valor	2025-09-11T11:51:03-03:00	
Victor David Aguilar	p:+541153045563	fiat_cronos_	Tengo un Fiat palio	2025-09-11T11:16:21-03:00	
Jorge Pattacini	p:+542954528218	volkswagen_polo	si	2025-09-11T10:12:15-03:00	
sergio Javier luna	p:+542234551951	peugeot_2008	Efectivo	2025-09-11T09:57:22-03:00	
Leonela Paola Pereyra	p:+541137782876	peugeot_parner	sin anticipo	2025-09-11T09:46:47-03:00	
Ariel Ramirez	p:91140869495	peugeot_parner	Si tengo efectivo	2025-09-11T09:30:34-03:00	
Carlos Anderson	p:+543442542754	volkswagen_amarok	efectivo	2025-09-11T08:21:17-03:00	
Ramon Barboza	p:+541133038660	fiat_mobi	hola cuanto es la cuotas del auto usado yo entregando un 206	2025-09-11T07:49:37-03:00	
Fabian Cesar Barrera	p:+541123601921	fiat_cronos_	no	2025-09-11T07:48:16-03:00	
Víctor h	p:+541128941909	fiat_cronos_	Con un auto usado modelo 2000	2025-09-11T06:48:44-03:00	
Miguel Rodriguez	p:+5491156418881	peugeot_parner	si	2025-09-11T06:40:50-03:00	
Alberto Cufre	p:+541159620445	fiat_cronos_	no	2025-09-11T06:11:45-03:00	
Leonela	p:+541144387918	fiat_cronos_	Si	2025-09-11T02:42:06-03:00	
Ulises Laura	p:+541137010458	volkswagen_polo	si	2025-09-11T00:50:20-03:00	
German Camus	p:+542634726970	volkswagen_polo	Tengo un auto	2025-09-11T00:38:16-03:00	
Miguel Villafuerte	p:+541162763071	fiat_cronos_	auto usado	2025-09-10T23:58:51-03:00	
Valeria Coronel	p:+542914427993	fiat_mobi	Me interesa uno auto	2025-09-10T23:36:17-03:00	
Marcelo Raliati	p:+541176349255	fiat_cronos_	fiat crono con gnc	2025-09-10T23:14:24-03:00	
Carina Noemi Salazar	p:+5491157235496	volkswagen_polo	no	2025-09-10T23:10:02-03:00	
Hector Sanchez	p:+541168826145	volkswagen_nivus	auto usado	2025-09-10T22:47:33-03:00	
Daniel Figueroa	p:+541166763378	fiat_cronos_	Usado	2025-09-10T22:33:58-03:00	
@KimeyRodriguez	p:+543415718115	fiat_titano	No	2025-09-10T22:24:29-03:00	
Roberto Carlos Galvan	p:+542915006245	fiat_fastback	no	2025-09-10T22:02:54-03:00	
Dami Ortiz	p:+543541607411	fiat_toro	auto usado	2025-09-10T20:46:54-03:00	
Julio De la Cruz	p:+541167082059	fiat_cronos_	auto usado	2025-09-10T20:46:19-03:00	
Gabriel Musante	p:+5491121767564	volkswagen_tera	Si	2025-09-10T20:26:48-03:00	
Enrique clodomiroTejada	p:+542612131506	fiat_titano	si nissan frontier mp 300 2012	2025-09-10T20:12:08-03:00	
Solange Curto	p:+542212213224	peugeot_parner	si	2025-09-10T19:54:32-03:00	
Alejandra Reyes	p:+543489559757	volkswagen_polo	usado	2025-09-10T19:32:33-03:00	
Raul Bals	p:+5492616400371	peugeot_parner	si con antisipo	2025-09-10T19:19:50-03:00	
Luis Cruzate	p:+542604024037	peugeot_parner	auto usado	2025-09-10T18:51:29-03:00	
Dario Valenzuela	p:No	peugeot_expert	Las 2 cosas	2025-09-10T18:37:58-03:00	
Marcelo Barreiro	p:+541154975123	peugeot_parner	si las 2	2025-09-10T18:35:26-03:00	
Mario Vega	p:2932507041	fiat_cronos_	Cuántos es lo minimo	2025-09-10T18:17:43-03:00	
Felix Silva	p:+541161038309	fiat_strada	usado y un plan de strada 12cuta paga	2025-09-10T18:04:15-03:00	
Victor H. Aguirre	p:+543415763424	peugeot_2008	Auto usado, Peugeot 208 Allure 2018 triptonic	2025-09-10T17:36:04-03:00	
Alberto Denegri	p:+541154242002	volkswagen_t-cross	Ecosport 2009,-1.6	2025-09-10T17:13:04-03:00	
Ramon Lugo	p:+543743567412	volkswagen_polo	auto usado	2025-09-10T16:46:45-03:00	
Debora Rebeca	p:+542657493030	volkswagen_amarok	efectivo	2025-09-10T16:37:16-03:00	
Gutiérrez María	p:+541169662025	peugeot_208	1.000.000	2025-09-10T16:12:34-03:00	
Pablo Spanos	p:+543516245622	fiat_mobi	no. auto usado si	2025-09-10T16:06:40-03:00	
Nativo Vivero	p:+5491145590045	volkswagen_amarok	Ambos	2025-09-10T15:16:59-03:00	
Lorena Ivars	p:+542612092724	volkswagen_polo	Si	2025-09-10T14:52:54-03:00	
Daniela Castellanos	p:+543876401260	peugeot_parner	efectivo	2025-09-10T14:04:31-03:00	
Lorenzo Delvalle Mañotti	p:+541168731828	fiat_fiorino	efectivo	2025-09-10T13:52:05-03:00	
Claudio Alberto blanca	p:+543496558421	fiat_fiorino	10000	2025-09-10T13:03:46-03:00	
Daniel García	p:+542235438174	fiat_fiorino	Auto usado	2025-09-10T12:47:57-03:00	
Monica Beatriz Carrasco	p:+542236188146	fiat_cronos_	si	2025-09-10T12:35:14-03:00	
Claudia Roman	p:+543786465479	volkswagen_polo	no	2025-09-10T12:14:01-03:00	
Carlos Emilo Kolodziej	p:+542664204465	volkswagen_amarok	Tengo una Suran 2014, con 125000km.	2025-09-10T11:19:38-03:00	
Noe Sosa	p:+543517022735	peugeot_2008	Sip	2025-09-10T11:18:33-03:00	
Luis Alberto Barbosa	p:+543794951673	volkswagen_amarok	anticipo	2025-09-10T09:28:01-03:00	
Gabriel Rodolfo Stigliano	p:+541169330359	fiat_toro	si	2025-09-10T09:15:28-03:00	
Mercedes mankeliunas	p:+541162410793	fiat_cronos_	Auto usado	2025-09-10T08:42:31-03:00	
Jacki Sardisco	p:+543415699468	fiat_cronos_	no	2025-09-10T08:20:42-03:00	
Anáhi Bellido	p:+5491160075767	fiat_cronos_	Hola quisiera saber como es el sistema	2025-09-10T06:31:21-03:00	
emilia Cosimi	p:+541140796350	volkswagen_polo	3.000.000	2025-09-10T06:10:02-03:00	
Yanina Vega	p:+541127349467	volkswagen_t-cross	ussdo	2025-09-10T05:25:55-03:00	
Cristina Gonzalez	p:+543756596621	fiat_argo	efectico 4000000	2025-09-10T02:58:47-03:00	
Mariela Viviana Maldonado	p:+541138342889	peugeot_parner	usado	2025-09-10T01:15:36-03:00	
`;
// ==========================================

// Helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizePhone(raw) {
  if (!raw) return "";
  // admite formatos "p:...", "tel:", etc.
  let s = String(raw).trim().replace(/^p\s*:\s*/i, "");
  s = s.replace(/[^\d+]/g, "").replace(/\++/g, "+");
  return s;
}

function brandCode(brandToken) {
  const t = (brandToken || "").toLowerCase();
  if (t.startsWith("volkswagen") || t.startsWith("vw")) return "vw";
  if (t.startsWith("fiat")) return "fiat";
  if (t.startsWith("peugeot")) return "peugeot";
  if (t.startsWith("renault")) return "renault";
  return "vw";
}

function prettifyModel(token) {
  if (!token) return "Consultar";
  let m = token.replace(/^_+|_+$/g, "").replace(/_/g, " ").trim();
  // algunos fixes comunes
  m = m.replace(/\bt cross\b/i, "T-Cross");
  m = m.replace(/\bparner\b/i, "Partner");
  m = m.replace(/\btera\b/i, "Tera");
  m = m.replace(/\bcronos\b/i, "Cronos");
  m = m.replace(/\bnivus\b/i, "Nivus");
  m = m.replace(/\bpolo\b/i, "Polo");
  m = m.replace(/\bamarok\b/i, "Amarok");
  m = m.replace(/\bstrada\b/i, "Strada");
  m = m.replace(/\bargo\b/i, "Argo");
  m = m.replace(/\bmobi\b/i, "Mobi");
  m = m.replace(/\btoro\b/i, "Toro");
  m = m.replace(/\bfastback\b/i, "Fastback");
  m = m.replace(/\btitano\b/i, "Titano");
  m = m.replace(/\b2008\b/g, "2008");
  m = m.replace(/\b208\b/g, "208");
  m = m.replace(/\bexpert\b/i, "Expert");
  m = m.replace(/\bfiorino\b/i, "Fiorino");
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function parseBrandModel(token) {
  // ejemplo: volkswagen_t-cross | fiat_cronos_ | peugeot_parner
  const t = (token || "").trim().toLowerCase();
  const [brandToken, ...rest] = t.split("_");
  const modelToken = rest.join("_"); // preserva guiones
  const marca = brandCode(brandToken);
  const modelo = prettifyModel(modelToken || "Consultar");
  return { marca, modelo };
}

function deduceFormaPago(comment) {
  const c = (comment || "").toLowerCase();
  if (/efectivo|contado|precio/.test(c)) return "Contado";
  if (/cuota|cuotas|financia|financiado/.test(c)) return "Financiado";
  if (/anticipo/.test(c)) return "Anticipo";
  if (/ambos|las 2/.test(c)) return "Ambos";
  if (/usado/.test(c)) return "Usado";
  return DEFAULT_FORMA_PAGO;
}

function parseLine(line) {
  // split por TAB; filtra vacíos al final
  const cols = line.split("\t").map((x) => x.trim());
  if (cols.length < 4) {
    return null;
  }
  const [nombre, telRaw, brandModel, comentario, fecha] = cols;

  const telefono = normalizePhone(telRaw);
  const { marca, modelo } = parseBrandModel(brandModel);
  const formaPago = deduceFormaPago(comentario);
  const notas = comentario || "";

  return {
    nombre,
    telefono,
    marca,
    modelo,
    formaPago,
    notas,
    fecha: fecha || "",
  };
}

async function postLead(payload) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(ENDPOINT, {
        nombre: payload.nombre,
        telefono: payload.telefono,
        modelo: payload.modelo,
        marca: payload.marca,
        formaPago: payload.formaPago,
        notas: payload.notas,
        fuente: FUENTE,
        // si tu backend usa limpieza/validación interna, fecha puede ignorarse
      }, { timeout: 15000 });
      return res.data;
    } catch (err) {
      const code = err.response?.status;
      const msg = err.response?.data?.error || err.message;
      console.warn(`Intento ${attempt}/${MAX_RETRIES} FALLÓ [${code||"ERR"}]: ${msg}`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(500 * attempt);
    }
  }
}

async function run() {
  const lines = RAW.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  console.log(`Filas detectadas: ${lines.length}`);

  let ok = 0, skip = 0, fail = 0;

  for (const line of lines) {
    const rec = parseLine(line);
    if (!rec) {
      console.log(`SKIP: línea inválida → ${line}`);
      skip++;
      continue;
    }
    if (!rec.nombre || !rec.telefono) {
      console.log(`SKIP: falta nombre/teléfono → ${JSON.stringify(rec)}`);
      skip++;
      continue;
    }
    try {
      const out = await postLead(rec);
      console.log(`OK → ${rec.nombre} (${rec.telefono}) • ${rec.marca.toUpperCase()} ${rec.modelo} • id:${out?.leadId ?? "?"}`);
      ok++;
    } catch (e) {
      console.error(`FAIL → ${rec.nombre} (${rec.telefono}) • ${rec.marca.toUpperCase()} ${rec.modelo}`);
      fail++;
    }
    await sleep(BATCH_DELAY_MS);
  }

  console.log("====================================");
  console.log(`Resumen → OK: ${ok} • SKIP: ${skip} • FAIL: ${fail}`);
}

run().catch((e) => {
  console.error("Proceso abortado:", e?.message || e);
  process.exit(1);
});
