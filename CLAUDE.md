# EventForm Colombia — CLAUDE.md

## Descripción
App MVP para crear y gestionar eventos en Colombia. Flujo completo:
Crear evento (wizard 4 pasos) → Builder de formulario → Inscripción pública
estilo Typeform (una pregunta por pantalla) → Pase QR estilo Eventbrite
→ Check-in por escaneo QR el día del evento.

## Stack
- Frontend: React + Vite (puerto 5173)
- Backend: Node.js / Express en /server
- Base de datos: SQLite
- Estilos: sistema propio de variables en /src/lib/theme.js
- CSS de formulario: typeform.css

## Comandos clave
- Frontend: `npm run dev` (desde raíz)
- Backend: `cd server && npm run dev`
- Seed DB: `cd server && npm run seed`
  → crea super admin: admin@eventform.co / cambiar-esta-clave

## Estructura del proyecto
- /src/App.jsx → componente principal (legacy, compatibilidad)
- /src/HostApp.jsx → componente principal activo
- /src/AppRouter.jsx → enrutamiento
- /src/components/ → QrScanner, AdminPanel, FieldInput, EventHeader,
                      ColombiaAddressPicker, LocationMap, NavigateButtons,
                      HeaderImageUpload
- /src/lib/theme.js → variables de color del sistema de diseño
- /src/lib/tickets.js → lógica check-in, validación, build participante
- /src/lib/capacity.js → control de aforo y sold-out
- /src/lib/colombia.js → tipos de evento, presets
- /src/lib/storage.js → persistencia local (loadEvents / saveEvents)
- /src/pages/ → vistas por ruta
- /server/ → API REST Express + SQLite
- /public/ → assets estáticos

## ⚡ REFERENCIA DE DISEÑO — Estilo Typeform (PRIORITARIO)
El formulario de inscripción debe replicar la experiencia de Typeform:

### Principios visuales
- Fondo blanco puro, sin distracciones ni sidebars
- UNA sola pregunta visible por pantalla (full-screen per question)
- Transiciones suaves al avanzar (slide up / fade)
- Barra de progreso delgada (3–4px) en la parte superior, color VERDE_CORPORATIVO
- Número de pregunta con formato: círculo azul oscuro + número (ej. "3")
  seguido del texto de la pregunta en tipografía grande (28–32px, peso 500)
- Descripción/hint en gris claro debajo del título (14px)
- Input minimalista: solo línea inferior (border-bottom), sin caja completa
- Botón "OK" rectangular azul oscuro con check ✓ o flecha →, esquinas redondeadas
- Hint de teclado: "Presiona Enter ↵" junto al botón OK
- Navegación con flechas ↑ ↓ en esquina inferior derecha
- Sin bordes de card ni sombras en el formulario de inscripción
- Espacio generoso alrededor del contenido (padding mínimo 20% lateral)

### Paleta específica para el formulario Typeform
- Fondo: #FFFFFF puro
- Número de pregunta: círculo #1A3E6F (azul marino), texto blanco
- Texto pregunta: #1A1A1A (casi negro), 28–32px
- Descripción: #9B9B9B, 14px
- Input (border-bottom): #CCCCCC en reposo, #1A3E6F en foco
- Botón OK: fondo #1A3E6F, texto blanco, border-radius 4px, padding 10px 20px
- Texto hint teclado: #9B9B9B, 12px
- Barra progreso: VERDE_CORPORATIVO del sistema

### Paleta general del sistema (no cambiar)
- VERDE_CORPORATIVO → acción principal, progreso, check-in exitoso
- VERDE_PASTEL_BG → fondos de sección y cards secundarias
- NEGRO_PURO → bordes, headers, botones primarios generales
- BLANCO_CONTRASTE → superficies y texto sobre negro
- NEGRO_MUTED_70 / _50 → textos secundarios y terciarios
- ROJO_SUAVE → error / acceso denegado

## Flujo de vistas
dashboard → create_wizard (4 pasos) → builder → detail
detail → register (ESTILO TYPEFORM: 1 pregunta/pantalla) → confirm (QR)
dashboard / detail → validate (escáner QR / manual)
admin → gestión de eventos

## Reglas generales de UI (fuera del formulario)
- Bordes: `2px solid NEGRO_PURO` en cards y botones
- Botones primarios: NEGRO_PURO + BLANCO_CONTRASTE
- Botones acción: VERDE_CORPORATIVO + borde NEGRO_PURO
- Tipografía: system-ui, peso 700–900 en títulos
- Border-radius: 8–20px según tamaño del componente

## Objetivos actuales (en orden de prioridad)
1. Rediseñar formulario de inscripción — una pregunta por pantalla estilo Typeform
2. Mejorar diseño del pase QR / boleta — inspiración Eventbrite
3. Mejorar panel de check-in — optimizado para mobile y uso rápido
4. Agregar funcionalidad de compartir enlace de evento
5. Estadísticas básicas en panel de administración
6. Preparar deploy: Railway (backend) + Vercel (frontend)

## Contexto Colombia
- Solo ciudades colombianas (ColombiaAddressPicker)
- Fechas en español (es-MX locale)
- IDs tickets: TICKET-XXXXXXXX / IDs eventos: EXXXXXXXX
