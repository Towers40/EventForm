// ─── Tipografías del evento ────────────────────────────────────────────────
//
// Cinco alternativas para personalizar un evento, además de la tipografía de
// la app (Inter). El criterio de la selección: todas son modernas y limpias,
// pero cada una lleva el evento a un sitio distinto —técnico, artístico,
// nocturno, editorial o de revista—, que es lo que hace que elegir signifique
// algo. Ninguna es decorativa "de plantilla": siguen siendo legibles a 13 px
// en un móvil, que es donde de verdad se lee un evento.
//
// Se cargan BAJO DEMANDA (ver `loadEventFont`): quien visita un evento con
// Space Grotesk no descarga las otras cuatro.

export const DEFAULT_FONT_ID = "tapin";

export const EVENT_FONTS = [
  {
    id: "tapin",
    name: "TapIn",
    tagline: "La de siempre",
    note: "Neutra y clarísima. La que usa toda la app.",
    family: "'Inter', system-ui, -apple-system, sans-serif",
    google: null,                 // ya viene cargada en index.html
    headingWeight: 500,
    headingSpacing: "-0.5px",
    headingScale: 1,
  },
  {
    id: "neo",
    name: "Neo",
    tagline: "Técnica",
    note: "Geométrica, de ingeniería. Meetups, tech, producto, talleres.",
    family: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    google: "Space+Grotesk:wght@400;500;700",
    headingWeight: 600,
    headingSpacing: "-1px",
    headingScale: 1,
  },
  {
    id: "rebelde",
    name: "Rebelde",
    tagline: "Disruptiva",
    note: "Formas raras y ancho variable. Arte, música y lo que rompe molde.",
    family: "'Syne', 'Inter', system-ui, sans-serif",
    google: "Syne:wght@400;600;800",
    headingWeight: 800,
    headingSpacing: "-0.6px",
    headingScale: 0.94,
  },
  {
    id: "orbita",
    name: "Órbita",
    tagline: "Futurista",
    note: "Redonda y muy presente. Fiestas, lanzamientos, noche.",
    family: "'Unbounded', 'Inter', system-ui, sans-serif",
    google: "Unbounded:wght@400;600;800",
    headingWeight: 600,
    headingSpacing: "-1.2px",
    headingScale: 0.84,
  },
  {
    id: "taller",
    name: "Taller",
    tagline: "Creativa",
    note: "Grotesca con carácter, de fanzine. Diseño, comida, comunidad.",
    family: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
    google: "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800",
    headingWeight: 700,
    headingSpacing: "-0.8px",
    headingScale: 0.97,
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Elegante",
    note: "Serif de alto contraste. Cenas, galas, conferencias, bodas.",
    family: "'Instrument Serif', Georgia, serif",
    google: "Instrument+Serif:ital@0;1",
    headingWeight: 400,
    headingSpacing: "-0.2px",
    headingScale: 1.1,
  },
];

const PORid = Object.fromEntries(EVENT_FONTS.map(f => [f.id, f]));

/** Ficha de la tipografía de un evento; la de la app si el id no existe. */
export function getEventFont(id) {
  return PORid[id] || PORid[DEFAULT_FONT_ID];
}

/**
 * Añade el <link> de Google Fonts de esa tipografía, una sola vez.
 * Es idempotente: llamarlo en cada render no dispara descargas nuevas.
 */
export function loadEventFont(id) {
  const font = PORid[id];
  if (!font?.google || typeof document === "undefined") return;
  const marca = `ef-font-${font.id}`;
  if (document.getElementById(marca)) return;
  const link = document.createElement("link");
  link.id = marca;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
  document.head.appendChild(link);
}

/** Carga las cinco: solo cuando se abre el selector, para poder previsualizar. */
export function loadAllEventFonts() {
  for (const f of EVENT_FONTS) loadEventFont(f.id);
}

/**
 * Props para teñir de la tipografía del evento TODO lo que hay dentro de una
 * superficie: la tarjeta, la página, el formulario de inscripción, la entrada.
 *
 *     <div {...eventFontProps(ev.fontId)}>…</div>
 *
 * Devuelve la clase que sube la especificidad (ver .ef-event-font en
 * typeform.css) y la variable con la familia. `extraStyle` y `extraClass`
 * permiten conservar los estilos propios del contenedor.
 *
 * NO carga la fuente: eso lo hace `loadEventFont`, que hay que llamar desde un
 * efecto para que la descarga no ocurra durante el render.
 */
export function eventFontProps(fontId, { extraClass = "", extraStyle = {} } = {}) {
  const f = getEventFont(fontId);
  return {
    className: `ef-event-font${extraClass ? " " + extraClass : ""}`,
    style: { "--ef-font": f.family, ...extraStyle },
  };
}
