# 🚀 EventForm — Manual de Contexto y Desarrollo

Instrucciones de arquitectura, stack y estilo para el asistente de IA. 

## 🌐 Stack e Infraestructura
* **Frontend:** React 19 + Vite, SPA. React Router v7.
* **Backend:** Express (`server/`) ejecutado como **función serverless de Vercel**
  vía `api/index.js` (`vercel.json` reescribe `/api/*`). No hay servidor aparte.
  (`server/railway.json` existe como alternativa, pero NO está en uso.)
* **Base de datos:** Turso (SQLite edge) con `@libsql/client`. Requiere
  `TURSO_URL`/`TURSO_TOKEN` en Vercel; sin ellas las rutas dan 503. En local usa
  archivo SQLite. SQL siempre parametrizado.
* **Auth/Email:** JWT + bcrypt (`server/auth.js`); correos por Gmail SMTP con
  nodemailer (`server/mailer.js`, `From` = cuenta autenticada).
* **Hosting:** Vercel (frontend + backend) con CI/CD desde GitHub (`Towers40/EventForm`, rama `main`).

## 🏗️ Datos y estado
* La **API es la fuente principal** de eventos/inscripciones. `localStorage`
  (`src/lib/storage.js`) es solo **caché/fallback**: tickets (`ef_ticket_<slug>`),
  avatar (`ef_avatar_<user>`), borrador del builder. Todo desarrollo nuevo es `async/await`.
* El cliente nunca habla directo con Turso; todo pasa por `/api`.

## 🎨 UI y estilo
* **Una sola estética: glass oscuro navy.** Fondo
  `linear-gradient(170deg,#1d2340,#131628)`, tarjetas `rgba(255,255,255,0.06–0.08)`
  + `backdrop-filter: blur`, `border-radius` 16–24, TEXT `#e8eaf0`, ACCENT `#6b9fd4`.
  Acción/confirmar verde `#34c759`/`#5ee07f`; denegado rojo `rgba(220,38,38,*)`.
  (Ya NO se usa la línea neo-brutalista; `theme.js` con `NEGRO_PURO` es legacy.)
* **Tokens en `src/lib/ds.jsx` (objeto `DS`)** + estilos **inline en JSX** (patrón
  dominante). CSS global solo en `src/styles/typeform.css` y `mobile.css`
  (clases `.tf-*`, `.panel-card`, `.soft-btn`). Sin Tailwind/Sass.

## 📱 App nativa (Capacitor) — preparada
* Web lista para empaquetar con Capacitor (`capacitor.config.json`, guía `CAPACITOR.md`).
* `src/lib/platform.js` (`isNative`, `publicBaseUrl`) conmuta web vs nativo
  (API absoluta, enlaces públicos). Deep links en `src/lib/useDeepLinks.js`.
  Falta el build nativo (Xcode/Android Studio) y assets de tienda (`STORE_LISTING.md`).

## 🗺️ Rutas
`/app` (host), `/e/:slug` (evento público), `/t/:ticketId` (entrada/QR público),
`/discover`, `/login`, `/privacidad`, `/verify-email`. `App.jsx` está **deprecado** → usar `HostApp.jsx`.

## ⏭️ Pendientes
* **Pagos in-app** (Stripe/Apple Pay/Google Pay, sin redirección externa) — único gran pendiente.
* Push notifications (opcional). Entregabilidad de correo: configurar SPF/DKIM/DMARC del dominio.
</content>
