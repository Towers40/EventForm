// Sistema de diseño de TapIn — fuente única de verdad.
//
// Combinación elegida a partir del estudio de parejas de color y tipografía:
//   · FORMA   → "Rumba" (1d): radios generosos (22/18/14) y acciones en
//               píldora, que es lo que da el aire de la app.
//   · COLOR   → "Navy Refinado" (1a): la misma familia navy sin el velo verde,
//               acento #7fb3e6 y subtítulos al 64% para que 12–13 px se lean
//               en móvil.
//   · TIPO    → "Nocturne" (1b): Inter 500 en titulares y 400 en texto. La
//               jerarquía la marca el TAMAÑO, no el peso; por eso los
//               titulares no van en 800.
//
// Estos valores se publican además como variables CSS en :root (typeform.css)
// para que las clases globales (.panel-card, .soft-btn, .tf-*) usen los mismos
// y no haya dos verdades.

export const DS = {
  // ── Color ────────────────────────────────────────────────────────────────
  pageBg:       "radial-gradient(120% 80% at 80% -10%, rgba(127,179,230,0.16), transparent 60%), linear-gradient(170deg,#1d2340 0%,#12152a 100%)",
  bgTop:        "#1d2340",
  bgBottom:     "#12152a",

  text:         "#eef1f7",
  desc:         "rgba(238,241,247,0.84)",
  sub:          "rgba(238,241,247,0.64)",
  muted:        "rgba(238,241,247,0.42)",

  accent:       "#7fb3e6",
  accentSoft:   "#bfd9f2",

  cardBg:       "rgba(255,255,255,0.06)",
  cardHover:    "rgba(255,255,255,0.09)",
  panelBg:      "rgba(255,255,255,0.06)",
  chipBg:       "rgba(255,255,255,0.08)",
  chipBorder:   "rgba(255,255,255,0.14)",
  borderColor:  "rgba(255,255,255,0.14)",
  border:       "1px solid rgba(255,255,255,0.14)",
  divider:      "1px solid rgba(255,255,255,0.1)",
  mutedBg:      "rgba(255,255,255,0.06)",

  coverBg:      "linear-gradient(135deg,#222b4c,#12182b)",
  mapBg:        "linear-gradient(135deg,#1e2643,#141a2e)",

  softBg:       "rgba(127,179,230,0.2)",
  softBorder:   "rgba(127,179,230,0.45)",
  softText:     "#eef1f7",

  iconBtnBg:     "rgba(11,14,26,0.6)",
  iconBtnBorder: "rgba(255,255,255,0.22)",
  iconBtnColor:  "#eef1f7",

  avatarBg:     "rgba(127,179,230,0.3)",
  avatarBorder: "rgba(127,179,230,0.55)",
  avatarColor:  "#bfd9f2",

  mapPillBg:     "rgba(15,19,36,0.88)",
  mapPillBorder: "rgba(255,255,255,0.18)",

  // Acción principal: relleno claro sobre navy.
  ctaBg:     "#eef1f7",
  ctaColor:  "#12152a",
  ctaWeight: 600,

  ok:          "#5ee07f",
  okBg:        "rgba(52,199,89,0.16)",
  okBorder:    "rgba(52,199,89,0.4)",
  warn:        "#fbbf24",
  warnBg:      "rgba(251,191,36,0.14)",
  warnBorder:  "rgba(251,191,36,0.38)",
  danger:      "rgba(220,38,38,0.15)",
  dangerBorder:"rgba(220,38,38,0.35)",
  dangerText:  "#fca5a5",

  // ── Forma (Rumba) ────────────────────────────────────────────────────────
  rLg:  22,
  rMd:  18,
  rSm:  14,
  rCta: 999, // píldora

  // ── Tipografía (Nocturne) ────────────────────────────────────────────────
  font:        "'Inter', system-ui, -apple-system, sans-serif",
  hWeight:     500,  // titulares: la jerarquía va por tamaño, no por peso
  hLetter:     "-0.4px",
  bodyWeight:  400,
  emphWeight:  600,  // lo mínimo para destacar sin volver al 800
};

/** Estilo de titular coherente en toda la app. */
export const heading = (size, extra) => ({
  fontFamily: DS.font,
  fontWeight: DS.hWeight,
  letterSpacing: DS.hLetter,
  fontSize: size,
  color: DS.text,
  margin: 0,
  lineHeight: 1.22,
  ...extra,
});
