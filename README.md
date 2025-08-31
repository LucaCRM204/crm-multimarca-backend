# Alluma CRM — Backend (carpeta separada)

Este es el backend que compartiste (Claude) listo para usar en carpeta aparte.
Incluye: package.json, .env.example, setup-db.js, middleware/auth.js, utils/validation.js, Dockerfile, docker-compose.yml.

## Archivos que faltan para correr
- `server.js` (tu servidor Express)
- `database.sql` (esquema MySQL con tablas users/leads)
- Rutas (`routes/*.js`) para auth/leads/etc.

> Si no los tenés, podés usar los del ZIP `alluma-crm-integration-pack` que te pasé antes (server.js + routes + database.sql).

## Pasos básicos
1) Copiá esta carpeta fuera de tu frontend (proyecto aparte).
2) `cp .env.example .env` y completá valores reales.
3) `npm i`
4) Crear DB y tablas (importá tu `database.sql`).
5) `npm run dev` o `npm start`

### Docker (opcional)
```
docker-compose up -d
```

### Hashear contraseñas demo
```
node setup-db.js
```
