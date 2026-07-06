// Fondo global: actualiza --scroll-tint (0–1) según el desplazamiento.
// Al bajar, la capa verde oscura del body (typeform.css) gana opacidad;
// al subir vuelve a aclararse. Escucha en fase de captura para cubrir
// también los contenedores internos con scroll propio.

const MAX_SCROLL_PX = 900; // desplazamiento con el que se alcanza el tono más oscuro

function setTint(value) {
  document.documentElement.style.setProperty("--scroll-tint", value.toFixed(3));
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
}

export function initScrollTint() {
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  setTint(0);
}
