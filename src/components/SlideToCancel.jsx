import { useState, useRef } from "react";

// Barra deslizable de confirmación (cancelar, publicar, etc.).
export default function SlideToCancel({
  onComplete,
  disabled,
  label = "Cancelar asistencia",
  accent = "#f87171",
  bg = "rgba(248,113,113,0.12)",
  border = "rgba(248,113,113,0.3)",
}) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ pointer: 0, dragX: 0 });
  const THUMB = 48;
  const PAD = 5;

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
      style={{ position: "relative", height: 58, borderRadius: 29, background: bg, border: `1px solid ${border}`, overflow: "hidden", userSelect: "none", opacity: disabled ? 0.6 : 1 }}
    >
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: accent, fontWeight: 700, fontSize: 13.5, opacity: 1 - pct, pointerEvents: "none", padding: "0 12px", textAlign: "center" }}>
        {disabled ? "…" : label}
      </span>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ position: "absolute", top: PAD, left: PAD, width: THUMB, height: THUMB, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 0.25s", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", cursor: disabled ? "not-allowed" : "grab", touchAction: "none" }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}
