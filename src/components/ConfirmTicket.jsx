import { useState, useEffect } from "react";
import LocationMap from "./LocationMap.jsx";
import SlideToCancel from "./SlideToCancel.jsx";
import TicketCarousel from "./TicketCarousel.jsx";
import { IconButton, IcoBack, EventCover, EventTintLayer } from "./ui.jsx";
import { eventTint } from "../lib/dominantColor.js";
import { useAuth } from "../context/AuthContext.jsx";
import { loadEventFont, eventFontProps } from "../lib/fonts.js";
import "../styles/typeform.css";

export default function ConfirmTicket({ ev, reg, regs, onDone, standalone, tintColor, onCancel, cancelling, onBack }) {
  // Quien ya tiene cuenta no necesita que le ofrezcan crear una.
  const { user } = useAuth() || {};
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => { loadEventFont(ev?.fontId); }, [ev?.fontId]);
  // `approved` solo llega en false cuando el evento requiere aprobación.
  const approved = reg?.approved !== false;
  // Eventos que permiten varias entradas por persona: un QR por entrada.
  const tickets = regs?.length ? regs : (reg ? [reg] : []);
  const varias = tickets.length > 1;

  const inner = (
    // La entrada es el último paso del evento: se ve con su misma letra.
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px", position: "relative", zIndex: 1 }}>

      {/* Volver: solo icono, como en el resto de la app. */}
      {onBack && (
        <div style={{ marginBottom: 16 }}>
          <IconButton title="Volver" tone="soft" onClick={onBack}><IcoBack /></IconButton>
        </div>
      )}

      {/* Portada cuadrada con esquinas suavizadas: el mismo marco que en la
          página del evento. Antes era 2:1 y cada pantalla se veía distinta. */}
      {ev.headerImage && (
        <EventCover src={ev.headerImage} alt={ev.title} pad={0} style={{ marginBottom: 20 }} pos={ev.imagePos} zoom={ev.imageZoom} />
      )}

      {/* Ticket header */}
      <div style={{ textAlign: "center", marginBottom: 20, lineHeight: 1.32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: approved ? "#6ee7b7" : "#fbbf24", letterSpacing: 2, marginBottom: 6 }}>
          {approved
            ? (varias ? `✓ ${tickets.length} ENTRADAS CONFIRMADAS` : "✓ INSCRIPCIÓN CONFIRMADA")
            : "⏳ SUJETO A APROBACIÓN"}
        </div>
        {/* El nombre del evento conserva su letra; el resto de la entrada
            (QR, instrucciones, acciones) es de la app. */}
        <h2 {...eventFontProps(ev?.fontId, {
          extraStyle: { fontSize: 22, fontWeight: 500, color: "#ffffff", margin: 0 },
        })}>{ev.title}</h2>
        {varias && (
          <p style={{ fontSize: 13, color: "#8fa3b1", margin: "8px 0 0", lineHeight: 1.5 }}>
            Cada acompañante entra con su propio código. Cada QR permite un solo ingreso.
          </p>
        )}
      </div>

      {/* Entradas: una al lado de otra, se pasa deslizando */}
      <TicketCarousel tickets={tickets} eventTitle={ev.title} />

      {/* Map */}
      {ev.lat != null && ev.lng != null && (
        <>
          <div style={{ marginBottom: 12 }}>
            <LocationMap lat={ev.lat} lng={ev.lng} height={180} label={ev.address || ev.location} />
          </div>
        </>
      )}

      {/* Back button (for embedded use) */}
      {onDone && (
        <button type="button" className="soft-btn soft-btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={onDone}>
          Volver
        </button>
      )}

      {/* Organizer CTA — solo para quien aún no tiene cuenta */}
      {!user && <div style={{
        marginTop: 28, padding: "18px 20px", borderRadius: 14,
        background: "rgba(52,211,153,0.08)",
        border: "1px solid rgba(52,211,153,0.2)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: "0 0 12px" }}>¿Quieres organizar tus propios eventos?</p>
        <a href="/app" style={{
          display: "inline-block", padding: "14px 22px",
          background: "var(--tf-accent)", color: "var(--tf-on-accent)",
          borderRadius: 14, fontWeight: 600, fontSize: 15, textDecoration: "none",
        }}>
          Crear cuenta de organizador →
        </a>
      </div>}

      {/* Cancel attendance — barra deslizable */}
      {onCancel && (
        <div style={{ marginTop: 24 }}>
          <SlideToCancel onComplete={() => setConfirmOpen(true)} disabled={cancelling} maxWidth={260} height={50} />
        </div>
      )}

      {/* Confirmación de cancelación */}
      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "var(--tf-sheet)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 22, padding: 24, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: "#ffffff", margin: "0 0 8px" }}>¿Estás seguro que quieres cancelar tu participación?</h3>
            <p style={{ fontSize: 13.5, color: "rgba(229,238,255,0.6)", margin: "0 0 22px", lineHeight: 1.5 }}>Tu entrada quedará anulada y perderás tu lugar en este evento.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)", color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                No, volver
              </button>
              <button type="button" onClick={() => { setConfirmOpen(false); onCancel(); }} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 14, background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.45)", color: "#fca5a5", fontWeight: 800, fontSize: 14, cursor: cancelling ? "not-allowed" : "pointer" }}>
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
        {/* La entrada llega desde la página del evento: mismo color de fondo,
            para que no parezca que se cambió de aplicación. */}
        <EventTintLayer tinte={eventTint(tintColor || ev?.themeColor)} />
        {inner}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      {inner}
    </div>
  );
}
