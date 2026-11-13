// ─── Iconos de categoría, estilo app ────────────────────────────────────────
//
// Cada categoría es una "baldosa" como las de la App Store: cuadrado de
// esquinas muy redondeadas, degradado propio y un glifo blanco de trazo
// grueso y redondeado. Antes eran contornos finos de 1,8 px en el color de la
// categoría: sobre el negro se veían débiles y no tenían personalidad.
//
// Versión suave (nov 2026): el fondo es el color de la categoría TRANSLÚCIDO
// (≈ 30 %) con desenfoque y un borde fino, y el glifo va en un tono claro de
// la misma familia. Con colores plenos las baldosas gritaban sobre el negro;
// así conservan su identidad sin competir con el contenido.
//
// API:
//   <CategoryIcon slug="tech" size={44} />          baldosa completa
//   CAT_ICONS.tech(color, size)                     compatibilidad: devuelve la
//                                                   misma baldosa (ignora color)

export const CATEGORY_STYLE = {
  tech:      { from: "#8b9dff", to: "#4f46e5", glyph: "#c9d0ff" }, // índigo
  social:    { from: "#ff7ac2", to: "#c026d3", glyph: "#ffc6e6" }, // magenta
  comida:    { from: "#ffa25c", to: "#ef4444", glyph: "#ffd0b0" }, // naranja → rojo
  deporte:   { from: "#6ee7a0", to: "#16a34a", glyph: "#b8f5cf" }, // verde
  bienestar: { from: "#67e8f9", to: "#0e7490", glyph: "#bff4fb" }, // cian
  arte:      { from: "#fcd34d", to: "#ea8a00", glyph: "#fde9a8" }, // oro
  otro:      { from: "#a1a1aa", to: "#3f3f46", glyph: "#e4e4e7" }, // grafito
};

/** "#rrggbb" + alfa → "rgba(r,g,b,a)". */
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Glifos en una rejilla de 24 px, pensados para leerse a 16 px: pocas piezas,
// trazos de 2,2 px con puntas redondas y rellenos donde el contorno no basta.
const S = (c) => ({ fill: "none", stroke: c, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" });
const GLYPHS = {
  // </> — código: lo más reconocible de un meetup tech.
  tech: (c) => (
    <g {...S(c)}>
      <path d="M8.5 7.5 4 12l4.5 4.5" />
      <path d="M15.5 7.5 20 12l-4.5 4.5" />
      <path d="M13.4 5.5 10.6 18.5" />
    </g>
  ),
  // Matasuegras con confeti: fiesta, encuentro.
  social: (c) => (
    <g>
      <path d="M4.2 19.8 8 9.6l6.4 6.4z" fill={c} stroke={c} strokeWidth={1.4} strokeLinejoin="round" />
      <g {...S(c)} strokeWidth={2}>
        <path d="M13.5 6.5c.8-1.6 2.6-2 3.6-1" />
        <path d="M17.6 10.4c1.6-.8 3.4-.2 3.6 1.3" />
      </g>
      <circle cx="12.4" cy="4.4" r="1.25" fill={c} />
      <circle cx="19.6" cy="7.2" r="1.25" fill={c} />
      <circle cx="16.6" cy="14.6" r="1.1" fill={c} opacity="0.85" />
    </g>
  ),
  // Tenedor y cuchillo.
  comida: (c) => (
    <g {...S(c)}>
      <path d="M6.5 3.5v5a2.5 2.5 0 0 0 5 0v-5" />
      <path d="M9 3.5v17" />
      <path d="M17 20.5V3.5c-2 1.4-3 4-3 7.2V13h3" />
    </g>
  ),
  // Balón: deporte en general, no un deporte concreto.
  deporte: (c) => (
    <g {...S(c)}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c-3.2 2.4-3.2 14 0 16.4" />
      <path d="M12 3.8c3.2 2.4 3.2 14 0 16.4" />
    </g>
  ),
  // Hoja: bienestar, calma, naturaleza.
  bienestar: (c) => (
    <g>
      <path d="M19.5 4.2C10.5 4.2 5 8.6 5 15c0 1.6.4 3 1.1 4.2C7.7 14 11.4 10.4 15.6 8.4c-3.6 2.6-6.2 6.2-7.4 10.6 1.1.6 2.4.9 3.8.9 5.9 0 7.5-6.4 7.5-15.7Z" fill={c} />
    </g>
  ),
  // Paleta con huecos de pintura (los huecos dejan ver el degradado).
  arte: (c) => (
    <g>
      <path fillRule="evenodd" fill={c}
        d="M12 3.2c-4.9 0-8.8 3.8-8.8 8.6 0 4.9 3.9 8.9 8.8 8.9 1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h2.2c2.6 0 4.8-2.1 4.8-4.8 0-4-4-7.4-9.8-7.4ZM7.6 12.6a1.45 1.45 0 1 1 0-2.9 1.45 1.45 0 0 1 0 2.9Zm2.6-3.9a1.45 1.45 0 1 1 0-2.9 1.45 1.45 0 0 1 0 2.9Zm4.6 0a1.45 1.45 0 1 1 0-2.9 1.45 1.45 0 0 1 0 2.9Z" />
    </g>
  ),
  // Cuatro baldosas: "más cosas".
  otro: (c) => (
    <g fill={c}>
      <rect x="4" y="4" width="7" height="7" rx="2.2" />
      <rect x="13" y="4" width="7" height="7" rx="2.2" opacity="0.75" />
      <rect x="4" y="13" width="7" height="7" rx="2.2" opacity="0.75" />
      <rect x="13" y="13" width="7" height="7" rx="2.2" />
    </g>
  ),
};

/**
 * Baldosa de categoría. `size` es el lado en px; el radio (≈ 30 %) y el glifo
 * (≈ 56 %) escalan con ella, igual que un icono de app.
 */
export function CategoryIcon({ slug, size = 44, style, title }) {
  const c = CATEGORY_STYLE[slug] || CATEGORY_STYLE.otro;
  const glyph = (GLYPHS[slug] || GLYPHS.otro)(c.glyph);
  const g = Math.round(size * 0.56);
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: size * 0.3,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(145deg, ${rgba(c.from, 0.36)} 0%, ${rgba(c.to, 0.26)} 100%)`,
        border: `1px solid ${rgba(c.from, 0.28)}`,
        boxSizing: "border-box",
        WebkitBackdropFilter: "blur(10px)",
        backdropFilter: "blur(10px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        ...style,
      }}
    >
      <svg width={g} height={g} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
        {glyph}
      </svg>
    </span>
  );
}

// Compatibilidad con el uso anterior `CAT_ICONS[slug](color, size)`.
export const CAT_ICONS = Object.fromEntries(
  Object.keys(GLYPHS).map((slug) => [slug, (_color, size = 28) => <CategoryIcon slug={slug} size={size} />])
);
