import { useState, useRef } from "react";
import NavigateButtons from "./NavigateButtons.jsx";
import LocationMap from "./LocationMap.jsx";
import "../styles/typeform.css";

// Barra deslizable para cancelar la asistencia.
function SlideToCancel({ onComplete, disabled }) {
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
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontWeight: 700, fontSize: 13.5, opacity: 1 - pct, pointerEvents: "none" }}>
        {disabled ? "Cancelando…" : "Desliza para cancelar asistencia  →"}
      </span>
      <div
        style={{ position: "absolute", top: PAD, left: PAD, width: THUMB, height: THUMB, borderRadius: "50%", background: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${dragX}px)`, transition: draggingRef.current ? "none" : "transform 0.25s", color: "#fff", pointerEvents: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
    </div>
  );
}

export default function ConfirmTicket({ ev, reg, onDone, standalone, onCancel, cancelling, onBack }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(reg.id)}&bgcolor=1a1c1e&color=e8eaf0&margin=10`;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inner = (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>

      {/* Volver a la ventana anterior */}
      {onBack && (
        <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(107,159,212,0.25)", borderRadius: 10, color: "#c8dff0", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 14px", marginBottom: 18 }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Volver
        </button>
      )}

      {/* Event cover */}
      {ev.headerImage && (
        <div style={{
          width: "100%", aspectRatio: "2 / 1", borderRadius: 16,
          overflow: "hidden", marginBottom: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <img src={ev.headerImage} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* Ticket header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#4ade80", letterSpacing: 2, marginBottom: 6 }}>
          ✓ INSCRIPCIÓN CONFIRMADA
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e8eaf0", margin: 0 }}>{ev.title}</h2>
      </div>

      {/* QR card */}
      <div style={{
        background: "#1a1c1e",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20, padding: "28px 20px",
        textAlign: "center",
        marginBottom: 24,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}>
        <img
          src={qrUrl}
          alt="QR de acceso"
          style={{ width: 180, height: 180, borderRadius: 12, display: "block", margin: "0 auto" }}
        />
        <p style={{
          fontFamily: "monospace", fontWeight: 700, marginTop: 16,
          fontSize: 13, color: "#6b9fd4", letterSpacing: 1,
        }}>
          {reg.id}
        </p>
        <p style={{ fontSize: 12, color: "#8fa3b1", margin: "8px 0 0", lineHeight: 1.5 }}>
          Presenta este QR en la entrada.<br />Solo permite un ingreso.
        </p>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <button
            type="button"
            onClick={() => navigator.share({
              title: `Mi entrada: ${ev.title}`,
              text: `Tengo entrada para ${ev.title} — ID: ${reg.id}`,
              url: window.location.href,
            }).catch(() => {})}
            style={{
              marginTop: 16, width: "100%",
              padding: "13px",
              background: "rgba(107,159,212,0.08)",
              color: "#6b9fd4", borderRadius: 12,
              border: "1px solid rgba(107,159,212,0.25)",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            ↗ Compartir ticket
          </button>
        )}
      </div>

      {/* Map */}
      {ev.lat != null && ev.lng != null && (
        <>
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
            <LocationMap lat={ev.lat} lng={ev.lng} height={180} />
          </div>
          <NavigateButtons lat={ev.lat} lng={ev.lng} label={ev.address || ev.location} />
        </>
      )}

      {/* Back button (for embedded use) */}
      {onDone && (
        <button type="button" className="soft-btn soft-btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={onDone}>
          Volver
        </button>
      )}

      {/* Organizer CTA */}
      <div style={{
        marginTop: 28, padding: "18px 20px", borderRadius: 14,
        background: "rgba(107,159,212,0.08)",
        border: "1px solid rgba(107,159,212,0.2)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: "0 0 12px" }}>¿Quieres organizar tus propios eventos?</p>
        <a href="/app" style={{
          display: "inline-block", padding: "11px 22px",
          background: "#1a5f8a", color: "#fff",
          borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none",
        }}>
          Crear cuenta de organizador →
        </a>
      </div>

      {/* Cancel attendance — barra deslizable */}
      {onCancel && (
        <div style={{ marginTop: 24 }}>
          <SlideToCancel onComplete={() => setConfirmOpen(true)} disabled={cancelling} />
        </div>
      )}

      {/* Confirmación de cancelación */}
      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 24, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", margin: "0 0 8px" }}>¿Estás seguro que quieres cancelar tu participación?</h3>
            <p style={{ fontSize: 13.5, color: "rgba(232,234,240,0.6)", margin: "0 0 22px", lineHeight: 1.5 }}>Tu entrada quedará anulada y perderás tu lugar en este evento.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "#e8eaf0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                No, volver
              </button>
              <button type="button" onClick={() => { setConfirmOpen(false); onCancel(); }} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 12, background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.45)", color: "#fca5a5", fontWeight: 800, fontSize: 14, cursor: cancelling ? "not-allowed" : "pointer" }}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return (
      <div className="tf-screen" style={{ display: "block", overflowY: "auto" }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      {inner}
    </div>
  );
}
