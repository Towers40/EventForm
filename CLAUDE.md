# 🚀 EventForm - Manual de Contexto y Desarrollo

Este archivo contiene las instrucciones de arquitectura, stack tecnológico y reglas de estilo para el asistente de IA. Debe respetarse estrictamente en cada generación de código.

---

## 🌐 Stack Tecnológico e Infraestructura

* **Frontend:** React (Vite) - SPA moderna.
* **Enrutamiento:** React Router v7 (Arquitectura basada en vistas y componentes modulares).
* **Hosting & Despliegue:** **Vercel** con integración continua (CI/CD) automatizada vía **GitHub**.
* **Base de Datos:** **Turso (SQLite en el Edge)**.
* **Cliente de Datos:** `@libsql/client` (LibSQL).

---

## 🏗️ Arquitectura de Datos y Backend (Turso + Vercel)

* **Transición de Estado:** La persistencia síncrona actual basada en `localStorage` (`loadEvents`/`saveEvents` en `src/lib/storage.js`) está en proceso de migración. Todo desarrollo nuevo debe ser asíncronico (`async/await`).
* **Estrategia API Serverless:** Los componentes del cliente **no** deben conectarse directamente a Turso usando credenciales administrativas. Toda mutación y consulta debe pasar por funciones serverless alojadas en la carpeta `/api` de Vercel.
* **Consultas a Base de Datos:** Utilizar sentencias SQL parametrizadas nativas mediante el cliente de LibSQL:
    ```javascript
    await client.execute({
      sql: "INSERT INTO registrations (id, event_id, data, ts) VALUES (?, ?, ?, ?)",
      args: [id, eventId, JSON.stringify(data), ts]
    });
    ```

---

## 🎨 Reglas de UI y Sistema de Estilos (CSS Moderno)

### 1. Especificación Técnica de CSS
* **Sin Preprocesadores:** No usar Tailwind, Sass, ni Less. Se utiliza **CSS puro nativo**.
* **Nesting Nativo:** Está permitido y estandarizado el uso de *CSS Nesting* (anidamiento con `&`) y Media Queries internas dentro del selector del componente (ej. `#center`, `#next-steps`).
* **Variables de Entorno CSS:** Respetar los tokens globales (`var(--accent)`, `var(--border)`, `var(--shadow)`).

### 2. Dualidad de Identidad Visual
El proyecto maneja dos líneas estéticas estrictas que no deben mezclarse:

* **Línea Neo-brutalista:** Aplicada en vistas de administración (`DashboardView`, `MisEventosView`, `EventCrm`, `HostApp`). Características: bordes gruesos `2px solid #000`, sin border-radius pronunciado, fondo blanco/negro de alto contraste, tipografía pesada (font-weight: 800-900), paleta de constantes JS en `src/lib/theme.js` (`NEGRO_PURO`, `VERDE_CORPORATIVO`, `BLANCO_CONTRASTE`).

* **Línea Premium (estilo lu.ma):** Aplicada en todas las vistas públicas (`PublicEventPage`, `TypeformRegister`, `ConfirmTicket`, `OnboardingFlow`). Características: `border-radius: 16-24px`, `box-shadow` suaves, colores pastel (#0d3b66, #f0f6fc), tipografía espaciada de peso ligero (font-weight: 300-400), clases CSS en `src/styles/typeform.css` (`.tf-*`, `.panel-card`, `.soft-btn`). **No mezclar ambas líneas en la misma vista.**

## 🗺️ Roadmap de Funcionalidades Futuras (Para Planificación de Código)
1. **Pasarela de Pagos:** Preparar el modelo de datos en Turso para soportar eventos con `price` y estados de tickets (`payment_status`).
2. **Evolución Estética (Estilo lu.ma):** Las vistas públicas orientadas a la comunidad deben transicionar del Neo-brutalismo a un diseño UI premium: bordes curvos (`border-radius: 24px`), sombras suaves, tipografía espaciada y efectos de desenfoque (`backdrop-filter`).
3. **Descubrimiento y Categorías:** La página de inicio pública debe implementar un sistema de filtrado por taxonomías (Música, Deporte, Comida, Creatividad, Bienestar) y una sección de urgencia ("Últimos Cupos").

## 📱 Enfoque de Desarrollo Móvil & Pagos Integrados
* **Prioridad Mobile-First:** Todo el diseño público debe ser pensado para pantallas táctiles (teléfonos). Elementos interactivos grandes, optimización de teclados móviles y navegación fluida sin recargas.
* **Flujo de Pago In-App:** El sistema de cobros se integrará mediante Stripe Elements o SDK local. **Prohibido redirigir fuera de la aplicación** para realizar pagos. El botón de Apple Pay / Google Pay debe renderizarse de forma nativa directamente en el formulario de inscripción.