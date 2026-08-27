// ─── Color dominante de una portada ────────────────────────────────────────
//
// Saca de una imagen el color que MÁS ocupa el recuadro para teñir con él la
// interfaz del evento. No es un promedio: promediar una foto devuelve casi
// siempre un gris pardo (los colores opuestos se cancelan). Aquí se agrupan
// los píxeles en cubos de color y gana el cubo con más peso, donde el peso
// premia lo que de verdad se ve como "el color de la imagen":
//
//   · los grises y los casi negros/blancos cuentan poco (son fondo, sombra o
//     papel, no el color de la foto);
//   · los tonos vivos cuentan más, porque son los que recuerda el ojo.
//
// El resultado se guarda en el evento (`themeColor`) al subir la portada, así
// que la página pública no tiene que recalcularlo en cada visita.

const MUESTRA = 64;        // lado del lienzo de análisis (px)
const MIN_ALPHA = 125;     // por debajo, píxel transparente → se ignora

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** {r,g,b} → "#rrggbb" */
export function rgbToHex({ r, g, b }) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** "#rrggbb" (o "#rgb") → {r,g,b}; null si no es un color válido. */
export function hexToRgb(hex) {
  const s = String(hex || "").trim().replace(/^#/, "");
  const full = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** {r,g,b} 0–255 → {h,s,l} con h en grados y s/l en 0–1. */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn)      h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else                 h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Extrae el color dominante de un <img>/<canvas> ya cargado. */
export function dominantColorFromImage(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const lado = MUESTRA;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  // Se dibuja la imagen entera deformada al cuadrado: interesa qué color ocupa
  // más superficie, no respetar la proporción.
  ctx.drawImage(img, 0, 0, w, h, 0, 0, lado, lado);

  let datos;
  try { datos = ctx.getImageData(0, 0, lado, lado).data; }
  catch { return null; }   // lienzo "manchado" por CORS

  // Cubos de 4 bits por canal (16 niveles): suficiente para agrupar variantes
  // del mismo color sin fundir dos colores distintos.
  const cubos = new Map();
  for (let i = 0; i < datos.length; i += 4) {
    if (datos[i + 3] < MIN_ALPHA) continue;
    const r = datos[i], g = datos[i + 1], b = datos[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

    // Peso del píxel: casi negro o casi blanco pesa poco (suele ser fondo o
    // sombra) y el color vivo pesa más.
    let peso = 1;
    if (lum < 26 || lum > 236) peso = 0.1;
    peso *= 0.3 + sat * 1.5;

    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let c = cubos.get(clave);
    if (!c) { c = { n: 0, peso: 0, r: 0, g: 0, b: 0 }; cubos.set(clave, c); }
    c.n++; c.peso += peso; c.r += r; c.g += g; c.b += b;
  }
  if (!cubos.size) return null;

  let mejor = null;
  for (const c of cubos.values()) if (!mejor || c.peso > mejor.peso) mejor = c;
  // Todo el peso a cero (imagen en blanco y negro puro): gana el cubo con más
  // píxeles, aunque sea gris.
  if (!mejor || mejor.peso === 0) {
    for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  }
  if (!mejor) return null;

  return rgbToHex({ r: mejor.r / mejor.n, g: mejor.g / mejor.n, b: mejor.b / mejor.n });
}

function cargar(src, { cors = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Sin crossOrigin el lienzo queda "manchado" y getImageData lanza; con él,
    // el servidor debe responder CORS (Cloudinary lo hace).
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}

/** Color dominante de un archivo recién elegido (antes de subirlo). */
export async function dominantColorFromFile(file) {
  if (!file?.type?.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await cargar(url);
    return dominantColorFromImage(img);
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

/**
 * Color dominante de una portada ya publicada (URL o base64). Sirve para los
 * eventos creados antes de que existiera `themeColor`: se calcula una vez en
 * el navegador y se guarda en caché para no repetirlo en cada visita.
 */
export async function dominantColorFromUrl(url) {
  if (!url) return null;
  const esDato = url.startsWith("data:");
  const cacheKey = esDato ? null : `ef_tint_${url}`;
  if (cacheKey) {
    try {
      const guardado = localStorage.getItem(cacheKey);
      if (guardado) return guardado;
    } catch { /* modo privado */ }
  }
  try {
    const img = await cargar(url, { cors: !esDato });
    const hex = dominantColorFromImage(img);
    if (hex && cacheKey) { try { localStorage.setItem(cacheKey, hex); } catch { /* lleno */ } }
    return hex;
  } catch { return null; }
}

/**
 * Paleta difuminada para la interfaz de un evento a partir de su color.
 *
 * La app es oscura, así que el color NO se usa tal cual: se le fija un rango
 * de saturación y luminosidad para que un amarillo flúor y un vino oscuro
 * produzcan tintes igual de legibles. Lo que viaja al fondo son manchas muy
 * transparentes (de ahí "difuminado"), no un color plano.
 */
export function eventTint(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  // Un color casi gris no da tinte: teñir con él solo ensucia la pantalla.
  if (s < 0.08) return null;

  const sat = clamp(s, 0.35, 0.85) * 100;
  const hsl = (lum, alpha) => `hsla(${h.toFixed(0)}, ${sat.toFixed(0)}%, ${lum}%, ${alpha})`;

  return {
    hex,
    // Manchas fijas sobre el fondo global: una arriba (donde está la portada)
    // y otra abajo, ambas muy abiertas para que no se lean como un círculo.
    glow: [
      `radial-gradient(130% 78% at 50% -10%, ${hsl(58, 0.42)}, transparent 66%)`,
      `radial-gradient(100% 60% at 10% 110%, ${hsl(50, 0.22)}, transparent 72%)`,
      `linear-gradient(180deg, ${hsl(45, 0.16)} 0%, ${hsl(40, 0.07)} 55%, transparent 100%)`,
    ].join(", "),
    // Acentos derivados, para bordes y superficies que deben sentirse del
    // mismo color sin gritar.
    soft:   hsl(60, 0.16),
    border: hsl(65, 0.34),
    accent: hsl(l > 0.55 ? 68 : 72, 1),
    // Texto sobre `accent` como fondo sólido.
    onAccent: l > 0.6 ? "#10131f" : "#ffffff",
  };
}
