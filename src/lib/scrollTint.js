// Fondo global: actualiza --scroll-tint (0–1) según el desplazamiento.
// Al bajar, la capa verde oscura del body (typeform.css) gana opacidad;
// al subir vuelve a aclararse. Escucha en fase de captura para cubrir
// también los contenedores internos con scroll propio.
//
// El mismo listener publica la dirección del scroll en
// `document.documentElement.dataset.scrollDir` ("up" | "down"), que la barra
// inferior usa para retraerse al bajar y expandirse al subir. Va aquí y no en
// un listener nuevo para no duplicar trabajo en cada evento de scroll.

const MAX_SCROLL_PX = 900; // desplazamiento con el que se alcanza el tono más oscuro
const DIR_UMBRAL_PX = 6;   // ignora micro-movimientos y el rebote táctil
const DIR_TOPE_PX   = 24;  // cerca del inicio la barra siempre está expandida

let dirActual = null;
// Última posición significativa de cada contenedor. Es un WeakMap y no una
// variable suelta porque cada uno tiene su propio scroll: con una sola
// referencia, el primer evento tras cambiar de contenedor se perdía fijándola.
const ultimoTop = new WeakMap();

function setTint(value) {
  document.documentElement.style.setProperty("--scroll-tint", value.toFixed(3));
}

function setDir(valor) {
  if (valor === dirActual) return;
  dirActual = valor;
  document.documentElement.dataset.scrollDir = valor;
}

function actualizarDireccion(target, top) {
  if (top <= DIR_TOPE_PX) { ultimoTop.set(target, top); setDir("up"); return; }
  const previo = ultimoTop.get(target);
  if (previo === undefined) { ultimoTop.set(target, top); setDir("down"); return; }
  const delta = top - previo;
  // Por debajo del umbral no se guarda la posición, así que varios movimientos
  // pequeños en la misma dirección acaban sumando y disparando el cambio.
  if (Math.abs(delta) < DIR_UMBRAL_PX) return;
  ultimoTop.set(target, top);
  setDir(delta > 0 ? "down" : "up");
}

function readScroll(target) {
  if (target instanceof Element && target !== document.documentElement && target !== document.body) {
    const max = target.scrollHeight - target.clientHeight;
    if (max <= 0) return null;
    return { top: target.scrollTop, max };
  }
  const doc = document.documentElement;
  return { top: window.scrollY || doc.scrollTop || 0, max: doc.scrollHeight - window.innerHeight };
}

function onScroll(e) {
  const s = readScroll(e.target);
  if (!s) return;
  const limit = Math.min(Math.max(s.max, 1), MAX_SCROLL_PX);
  setTint(Math.min(1, s.top / limit));
  actualizarDireccion(e.target, s.top);
}

export function initScrollTint() {
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  setTint(0);
  setDir("up");
}
