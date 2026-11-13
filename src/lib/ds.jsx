// Sistema de diseño de TapIn — fuente única de verdad.
//
// Inspirado en el lenguaje visual de plata.co, adaptado a la marca TapIn:
//   · COLOR → negro puro (#000) y superficies sólidas carbón (#121416 /
//             #1b1d21), sin velos de color ni vidrio. UN solo color de acción:
//             el esmeralda de la marca (#34d399), con texto casi negro encima.
//             Todo lo demás es blanco o gris frío (229,238,255) con opacidad.
//   · TIPO  → Onest (grotesca geométrica, la alternativa libre más cercana a la
//             Rothorn de Plata). Titulares en 600 con tracking negativo; la
//             jerarquía la marca el tamaño.
//   · FORMA → tarjetas con radio 24 sin borde; botones de 52 px con radio 14
//             (no píldora); campos de 56 px con radio 16.
//
// Los mismos valores se publican como variables CSS en :root (typeform.css),
// para que las clases globales (.panel-card, .soft-btn, .tf-*) y los estilos
// en línea compartan una sola verdad. En estilos en línea, preferir
// "var(--tf-…)" a copiar el valor.

export const DS = {
  // ── Color ────────────────────────────────────────────────────────────────
  pageBg:       "#000000",
  bgTop:        "#000000",
  bgBottom:     "#000000",

  text:         "#ffffff",
  desc:         "rgba(229,238,255,0.78)",
  sub:          "rgba(229,238,255,0.64)",
  muted:        "rgba(229,238,255,0.56)",
  faint:        "rgba(229,238,255,0.36)",

  accent:       "#34d399",
  accentPress:  "#22c38a",
  onAccent:     "#03140c",
  accentSoft:   "#a7f3d0",

  surface:      "#121416",
  surface2:     "#1b1d21",
  cardBg:       "#121416",
  cardHover:    "#17191c",
  panelBg:      "#121416",
  chipBg:       "#1b1d21",
  chipBorder:   "rgba(229,238,255,0.12)",
  borderColor:  "rgba(229,238,255,0.12)",
  border:       "1px solid rgba(229,238,255,0.12)",
  divider:      "1px solid rgba(229,238,255,0.08)",
  mutedBg:      "#121416",

  coverBg:      "linear-gradient(135deg,#1b1d21,#0e0f11)",
  mapBg:        "linear-gradient(135deg,#17181b,#0e0f11)",

  softBg:       "rgba(52,211,153,0.14)",
  softBorder:   "rgba(52,211,153,0.42)",
  softText:     "#ffffff",

  iconBtnBg:     "rgba(18,20,22,0.72)",
  iconBtnBorder: "rgba(229,238,255,0.14)",
  iconBtnColor:  "#ffffff",

  avatarBg:     "#1b1d21",
  avatarBorder: "transparent",
  avatarColor:  "#ffffff",

  mapPillBg:     "rgba(18,20,22,0.9)",
  mapPillBorder: "rgba(229,238,255,0.16)",

  // Acción principal: relleno esmeralda sólido, texto casi negro.
  ctaBg:     "#34d399",
  ctaColor:  "#03140c",
  ctaWeight: 600,

  ok:          "#6ee7b7",
  okBg:        "rgba(52,211,153,0.14)",
  okBorder:    "rgba(52,211,153,0.4)",
  warn:        "#fbbf24",
  warnBg:      "rgba(251,191,36,0.14)",
  warnBorder:  "rgba(251,191,36,0.38)",
  danger:      "rgba(220,38,38,0.15)",
  dangerBorder:"rgba(220,38,38,0.35)",
  dangerText:  "#fca5a5",

  // ── Forma ────────────────────────────────────────────────────────────────
  rLg:  24,
  rMd:  16,
  rSm:  12,
  rCta: 14,
  ctaH: 52,

  // ── Tipografía ───────────────────────────────────────────────────────────
  font:        "'Onest', system-ui, -apple-system, sans-serif",
  hWeight:     600,
  hLetter:     "-0.02em",
  bodyWeight:  400,
  emphWeight:  600,
};

/** Estilo de titular coherente en toda la app. */
export const heading = (size, extra) => ({
  fontFamily: DS.font,
  fontWeight: DS.hWeight,
  letterSpacing: DS.hLetter,
  fontSize: size,
  color: DS.text,
  margin: 0,
  lineHeight: 1.12,
  ...extra,
});
