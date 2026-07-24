# TapIn Colombia

MVP de gestión de eventos: formularios tipo Typeform, check-in QR, CRM de inscritos y panel super administrador.

## Desarrollo local

```bash
# 1. Dependencias
npm install
cd server && npm install && cd ..

# 2. Variables (copia .env.example → .env en raíz y en server/)
cp .env.example .env
cp .env.example server/.env

# 3. Crear super administrador (dueño de la app)
cd server && npm run seed && cd ..

# 4. Terminal A — API
cd server && npm run dev

# 5. Terminal B — Frontend
npm run dev
```

- App anfitrión: http://localhost:5173/app  
- Login: http://localhost:5173/login  
- Formulario público: http://localhost:5173/e/{slug}  
- Super admin por defecto (cambiar en `server/.env` antes del seed): ver salida de `npm run seed`

## Despliegue recomendado

| Componente | Servicio sugerido | Motivo |
|------------|-------------------|--------|
| Frontend (Vite/React) | **Vercel** o Netlify | Build estático, CDN, dominio fácil |
| API + SQLite | **Railway**, Render o Fly.io | Servidor Node persistente + volumen para `data/eventform.db` |

**¿Solo Vercel?** El frontend encaja perfecto. La API necesita un proceso Node siempre activo o serverless con base externa (no SQLite en disco efímero). Opciones:

1. **Vercel + Railway** (recomendado para este MVP): front en Vercel, API en Railway con `DATA_DIR=/data`.
2. **Vercel + Supabase/Postgres**: migrar DB más adelante.
3. **Todo en Railway**: monorepo con build del front servido por Express.

### Variables producción

```env
VITE_API_URL=https://tu-api.railway.app
JWT_SECRET=secreto-largo-aleatorio
APP_URL=https://tu-dominio.vercel.app
CORS_ORIGIN=https://tu-dominio.vercel.app
DATA_DIR=/data
```

## Funciones

- Formulario público estilo Typeform (`/e/:slug`)
- Compartir enlace (WhatsApp, Facebook, copiar)
- CRM: tabla inscritos, export CSV, cerrar venta manual (sold out)
- Super admin: todos los anfitriones y eventos
- Política de privacidad: `/privacidad`
- Check-in QR con cámara
