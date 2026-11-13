# 🚀 TapIn — Manual de Contexto y Desarrollo

> La app se llama **TapIn** (antes "EventForm"). El repo de GitHub sigue siendo
> `Towers40/EventForm` y el dominio de producción `event-form-navy.vercel.app`;
> no se renombraron para no romper CI/CD ni enlaces.

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
* **Una sola estética: negro puro + esmeralda, inspirada en plata.co** (nov 2026).
  Fondo `#000`, superficies sólidas sin borde `#121416` / `#1b1d21` (sin vidrio ni
  velos navy). Texto `#fff`; secundario frío `rgba(229,238,255,.78/.56/.36)`.
  **Un solo color de acción**: esmeralda `#34d399` con texto `#03140c`, solo en el
  CTA principal (uno por pantalla). Estados activos/seleccionados en blanco
  (píldora `#fff` + texto negro), no en verde. Denegado rojo `rgba(220,38,38,*)`.
* **Tipografía Onest** (Google Fonts, variable): titulares 600 con tracking
  negativo (`-0.02em` a `-0.035em`), alineados a la izquierda; jerarquía por tamaño.
* **Forma:** tarjetas radio 24, botones 52 px radio 14 (no píldora), campos 56 px
  radio 16. Clases: `.soft-btn-primary` (CTA), `.soft-btn-secondary` (contorno
  blanco), `.soft-btn-ghost` (superficie gris), `.tf-input-line`, `.panel-card`.
* **Tokens en `:root` de `src/styles/typeform.css`** (`--tf-*`, `--r-*`, `--font`)
  y espejo en `src/lib/ds.jsx` (objeto `DS`). En estilos inline usar
  `var(--tf-…)` en vez de copiar valores. CSS global solo en `typeform.css`,
  `mobile.css` e `index.css` (reset). Sin Tailwind/Sass. `theme.js` es legacy.

## 📱 App nativa (Capacitor) — preparada
* Web lista para empaquetar con Capacitor (`capacitor.config.json`, guía `CAPACITOR.md`).
* `src/lib/platform.js` (`isNative`, `publicBaseUrl`) conmuta web vs nativo
  (API absoluta, enlaces públicos). Deep links en `src/lib/useDeepLinks.js`.
  Falta el build nativo (Xcode/Android Studio) y assets de tienda (`STORE_LISTING.md`).

## 🗺️ Rutas
`/app` (host), `/e/:slug` (evento público), `/t/:ticketId` (entrada/QR público),
`/discover`, `/o/:hostId`, `/login`, `/privacidad`, `/verify-email`. El panel vive en `HostApp.jsx`.

## 🔐 Seguridad (no romper)
* Códigos de verificación/recuperación de **6 cifras** con límite de intentos en
  base (`code_fails`/`login_fails`, ventana 30 min). En producción (`VERCEL`)
  nunca se auto-verifica una cuenta ni se devuelve un código en la respuesta.
* `verify-code`/`resend-code` **nunca** devuelven token para cuentas ya verificadas.

## ⏭️ Pendientes
* **Pagos in-app** (Stripe/Apple Pay/Google Pay, sin redirección externa) — único gran pendiente.
* Push notifications (opcional). Entregabilidad de correo: configurar SPF/DKIM/DMARC del dominio.
</content>
