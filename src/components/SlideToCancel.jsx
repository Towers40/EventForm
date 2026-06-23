import { useState, useRef } from "react";

// Barra deslizable para cancelar la asistencia.
export default function SlideToCancel({ onComplete, disabled, label = "Desliza para cancelar asistencia  →" }) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const THUMB = 48;
  const PAD = 5;

  const maxX = () => (trackRef.current ? trackRef.current.offsetWidth - THUMB - PAD * 2 : 0);

  const setFromClientX = (clientX) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left - PAD - THUMB / 2;
    setDragX(Math.max(0, Math.min(x, maxX())));
  };

  const onDown = (e) => {
    if (disabled) return;
    draggingRef.current = true;
    try { trackRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
    setFromClientX(e.clientX);
  };
  const onMove = (e) => {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  };
  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
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
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ position: "relative", height: 58, borderRadius: 29, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", overflow: "hidden", userSelect: "none", touchAction: "none", opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontWeight: 700, fontSize: 13.5, opacity: 1 - pct, pointerEvents: "none", padding: "0 12px", textAlign: "center" }}>
        {disabled ? "Cancelando…" : label}
      </span>
      <div
        style={{ position: "absolute", top: PAD, left: PAD, width: THUMB, height: THUMB, borderRadius: "50%", background: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${dragX}px)`, transition: draggingRef.current ? "none" : "transform 0.25s", color: "#fff", pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}
