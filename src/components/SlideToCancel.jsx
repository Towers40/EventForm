import { useState, useRef } from "react";

// Barra deslizable de confirmación (publicar, cancelar asistencia, etc.).
//
// Fondo OPACO: el color de la acción mezclado con un gris carbón. Antes era el
// mismo color al 12–14 % de opacidad y, sobre el negro (o sobre una portada
// teñida), la barra casi no se distinguía del fondo. El relleno que sigue al
// dedo confirma que el gesto va por buen camino.

const BASE = [24, 25, 28]; // #18191c

function hexRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mezcla `color` con `con` al `p` (0–1) del color. */
function mezcla(color, p, con = BASE) {
  return `rgb(${color.map((v, i) => Math.round(v * p + con[i] * (1 - p))).join(",")})`;
}
const luminancia = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export default function SlideToCancel({
  onComplete,
  disabled,
  label = "Cancelar asistencia",
  accent = "#f87171",
  // `bg`/`border` siguen aceptándose, pero por defecto se calculan opacos.
  bg,
  border,
  // `maxWidth` acota la barra y la centra en su contenedor (móvil y escritorio).
  // Sin él ocupa todo el ancho, que es como se usa para "Publicar".
  maxWidth = null,
  height = 58,
}) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ pointer: 0, dragX: 0 });
  const PAD = 5;
  const THUMB = height - PAD * 2;

  const rgb = hexRgb(accent) || [248, 113, 113];
  const fondo = bg || mezcla(rgb, 0.22);
  const borde = border || mezcla(rgb, 0.45);
  const relleno = mezcla(rgb, 0.42);
  const textoColor = mezcla(rgb, 0.55, [255, 255, 255]);
  const flecha = luminancia(rgb) > 0.55 ? "#05140d" : "#ffffff";

  const maxX = () => (trackRef.current ? trackRef.current.offsetWidth - THUMB - PAD * 2 : 0);

  // El arrastre SOLO inicia sobre la flecha (thumb).
  const onDown = (e) => {
    if (disabled) return;
    e.stopPropagation();
    setDragging(true);
    startRef.current = { pointer: e.clientX, dragX };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startRef.current.pointer;
    setDragX(Math.max(0, Math.min(startRef.current.dragX + dx, maxX())));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX >= maxX() - 8) {
      setDragX(maxX());
      onComplete();
      setTimeout(() => setDragX(0), 350);
    } else {
      setDragX(0);
    }
  };

  const pct = maxX() ? dragX / maxX() : 0;
  return (
    <div
      ref={trackRef}
      style={{
        position: "relative", height, borderRadius: height / 2, background: fondo, border: `1px solid ${borde}`,
        overflow: "hidden", userSelect: "none", opacity: disabled ? 0.6 : 1,
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        ...(maxWidth ? { maxWidth, marginLeft: "auto", marginRight: "auto" } : null),
      }}
    >
      {/* Rastro que sigue al dedo */}
      <div aria-hidden="true" style={{
        position: "absolute", top: 0, bottom: 0, left: 0, width: dragX + THUMB + PAD * 2,
        background: relleno, borderRadius: height / 2,
        transition: dragging ? "none" : "width 0.25s", pointerEvents: "none",
      }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: textoColor, fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em", opacity: 1 - pct, pointerEvents: "none", padding: `0 12px 0 ${THUMB + 12}px`, textAlign: "center" }}>
        {disabled ? "…" : label}
      </span>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}
        style={{ position: "absolute", top: PAD, left: PAD, width: THUMB, height: THUMB, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 0.25s", color: flecha, boxShadow: "0 2px 10px rgba(0,0,0,0.4)", cursor: disabled ? "not-allowed" : "grab", touchAction: "none" }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}
