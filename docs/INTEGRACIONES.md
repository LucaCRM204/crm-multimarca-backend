# Integraciones externas (Emanuel y futuras)

Entrada nueva para que una fuente externa cargue leads con un botón (estilo "Enviar a Pilot").
No toca ningún webhook existente. Las tablas (`integraciones_fuentes`, `integraciones_destinos`, `integraciones_envios`) se crean solas al arrancar el server.

- `routes/integraciones.js`: endpoints (genérico, igual en todos los CRMs)
- `services/integracionesAdapter.js`: alta del lead en GoldPlan con `assignVendorInTeam` (distribución por %, marcas por vendedor y fallback al líder, igual que los webhooks)
- Montado en `server.js` en `/api/integraciones`. El panel `/admin/*` es solo owner

## Panel (owner)

1. Nueva fuente → `Emanuel` / `emanuel` → copiar la API key (se muestra una sola vez)
2. Agregar destinos (`recalde`, `darwin`, …) y conectar cada uno a un gerente o supervisor
3. Prender/apagar destinos, marcar uno por defecto, regenerar la key, ver los últimos envíos

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/integraciones/admin/fuentes` | fuentes + destinos + leads de hoy |
| POST | `/api/integraciones/admin/fuentes` | `{ nombre, slug }` → devuelve `api_key` una vez |
| PUT | `/api/integraciones/admin/fuentes/:id` | `{ nombre?, activo?, destino_default_id? }` |
| POST | `/api/integraciones/admin/fuentes/:id/regenerar-key` | devuelve `api_key` nueva una vez |
| POST | `/api/integraciones/admin/fuentes/:id/destinos` | `{ codigo, nombre, equipo_id }` |
| PUT | `/api/integraciones/admin/destinos/:id` | `{ nombre?, equipo_id?, activo? }` |
| DELETE | `/api/integraciones/admin/destinos/:id` | |
| GET | `/api/integraciones/admin/equipos` | directores, gerentes y supervisores activos |
| GET | `/api/integraciones/admin/envios?fuente_id=&limit=` | log |

## Spec para la fuente

```
POST https://crm-multimarca-backend-production.up.railway.app/api/integraciones/in/emanuel
Content-Type: application/json
x-api-key: {KEY}

{
  "ref_id": "id-unico-de-la-captura",
  "destino": "recalde",
  "nombre": "Leonardo",
  "telefono": "+54 9 3858 50-1326",
  "modelo": "Volkswagen Polo Robust 0 km",
  "resumen": "Le interesa el Polo Robust...",
  "captura_url": "https://...",
  "chat_url": "https://...",
  "prueba": false
}
```

| Caso | HTTP | Body |
|---|---|---|
| Creado | 200 | `{ "ok": true, "lead_id": 123, "destino": "recalde" }` |
| Ya enviado (mismo `ref_id` o teléfono en 30 días) | 200 | `{ "ok": true, "duplicado": true, "lead_id": 123 }` |
| Prueba | 200 | `{ "ok": true, "prueba": true, "destino": "recalde" }` |
| Key inválida / fuente pausada | 401 | `{ "ok": false, "error": "no_autorizado" }` |
| Teléfono inválido | 422 | `{ "ok": false, "error": "telefono_invalido" }` |
| Destino inexistente, apagado o sin equipo | 422 | `{ "ok": false, "error": "destino_invalido", "destinos_validos": [...] }` |
| Doble click simultáneo | 409 | `{ "ok": false, "error": "en_proceso" }` |
| Error del CRM | 500 | `{ "ok": false, "error": "error_interno" }` (se puede reintentar) |

`GET .../in/emanuel/destinos` con la misma key devuelve los destinos activos para armar el dropdown.

La llamada tiene que salir del servidor de la fuente, no del navegador. Límite: 120 requests por minuto por IP.
`INTEGRACIONES_DEDUPE_DIAS` (default 30, `0` desactiva) controla el dedupe por teléfono.
