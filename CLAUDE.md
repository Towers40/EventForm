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
  Fondo `#000`; tarjetas y campos blancos translúcidos sin borde (`--tf-surface`
  11 %, `--tf-surface-2` 17 %, `--tf-field` 13 %) con desenfoque, para que se
  despeguen del fondo y tomen el tinte de la portada; modales `--tf-sheet`. Texto `#fff`; secundario frío `rgba(229,238,255,.78/.56/.36)`.
  **Un solo color de acción**: esmeralda `#34d399` con texto `#03140c`, solo en el
  CTA principal (uno por pantalla). Estados activos/seleccionados en blanco
  (píldora `#fff` + texto negro), no en verde. Denegado rojo `rgba(220,38,38,*)`.
* **Tipografía Onest** (Google Fonts, variable): titulares 600 con tracking
  negativo (`-0.02em` a `-0.035em`), alineados a la izquierda; jerarquía por tamaño.
* **Categorías:** baldosas tipo app (`CategoryIcon` en `src/lib/categoryIcons.jsx`):
  color de la categoría translúcido (~30 %) + glifo en tono claro de su familia.
* **Encabezado:** en móvil `[avatar | ←] [logo centrado] [dashboard, +]`. En
  pantallas secundarias (`SUB_VIEWS` en HostApp) la flecha de volver ocupa el
  sitio del avatar; no poner flechas de volver dentro del contenido.
* **Portada:** encuadre `imagePos` {x,y} % + `imageZoom` (≥1). Pintar SIEMPRE con
  `coverImgStyle(pos, zoom)` de `src/lib/images.js` (editor, página pública,
  entrada, tarjetas). El zoom máximo lo limita la resolución real de la foto.
* **Ubicación:** `LocationSearch.jsx` (pantalla completa, campo ≥16 px para que
  iOS no haga zoom) + `searchEventPlaces` (UNA consulta a Photon por búsqueda,
  sesgada a la ciudad; Photon limita a quien abusa). Lugares de referencia
  validados en `CITY_LANDMARKS` (`src/lib/colombia.js`).
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

## ⚡ Inscripción con un clic
* `shared/profileFields.js` (lo importan cliente y servidor) mapea cada campo
  del formulario a un dato de perfil (nombre, correo, teléfono, edad, ciudad,
  documento, empresa, cargo, instagram, género). Las preguntas propias del
  evento NO se guardan ni se rellenan.
* Con sesión, `/e/:slug` prellena el formulario; si cubre todos los obligatorios
  muestra "Inscripción con un clic". Al inscribirse, el servidor guarda esos
  datos en `users.profile` (solo si el correo es el de la cuenta). Se editan en
  Mi cuenta → "Datos para inscribirte".

## 🔐 Seguridad (no romper)
* Códigos de verificación/recuperación de **6 cifras** con límite de intentos en
  base (`code_fails`/`login_fails`, ventana 30 min). En producción (`VERCEL`)
  nunca se auto-verifica una cuenta ni se devuelve un código en la respuesta.
* `verify-code`/`resend-code` **nunca** devuelven token para cuentas ya verificadas.

## ⏭️ Pendientes
* **Pagos in-app** (Stripe/Apple Pay/Google Pay, sin redirección externa) — único gran pendiente.
* Push notifications (opcional). Entregabilidad de correo: configurar SPF/DKIM/DMARC del dominio.
</content>
