import { useRef, useState, useEffect } from "react";
import PendingQr, { PendingNotice } from "./PendingQr.jsx";
import { publicBaseUrl } from "../lib/platform.js";

// Varias entradas de un mismo evento, una al lado de otra: se pasa de una a
// otra deslizando a los lados, sin apilarlas en vertical ni salir de la
// pantalla. El desplazamiento es scroll nativo con scroll-snap, así que el
// gesto táctil funciona igual que en cualquier carrusel del sistema.
export default function TicketCarousel({ tickets, eventTitle, qrSize = 200, onIndexChange }) {
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const varias = tickets.length > 1;

  // Quien contiene el carrusel necesita saber qué entrada se está viendo
  // (p. ej. para cancelar esa y no otra).
  useEffect(() => { onIndexChange?.(idx); }, [idx, onIndexChange]);

  // Índice activo a partir de la posición del scroll (así queda sincronizado
  // tanto si se desliza con el dedo como si se usan las flechas).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !varias) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth);
        setIdx(Math.max(0, Math.min(i, tickets.length - 1)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [varias, tickets.length]);

  const goTo = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(i, tickets.length - 1));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIdx(next);
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        ref={trackRef}
        className="ef-hscroll"
        style={{
          display: "flex",
          overflowX: varias ? "auto" : "visible",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          borderRadius: 22,
        }}
      >
        {tickets.map((t, i) => {
          const aprobada = t.approved !== false;
          return (
            <div
              key={t.id}
              style={{
                flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "center", scrollSnapStop: "always",
                boxSizing: "border-box",
              }}
            >
              <div style={{
                background: "#1a1c1e",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 22, padding: "26px 20px",
                textAlign: "center",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}>
                {varias && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#34d399", letterSpacing: 1.5, marginBottom: 14, textTransform: "uppercase" }}>
                    Entrada {i + 1} de {tickets.length}
                  </div>
                )}
                <PendingQr id={t.id} size={qrSize} approved={aprobada} />
                <p style={{ fontFamily: "monospace", fontWeight: 700, marginTop: 16, fontSize: 13, color: "#34d399", letterSpacing: 1 }}>
                  {t.id}
                </p>
                {aprobada ? (
                  <p style={{ fontSize: 12, color: "#8fa3b1", margin: "8px 0 0", lineHeight: 1.5 }}>
                    Presenta este QR en la entrada.<br />Solo permite un ingreso.
                  </p>
                ) : (
                  <PendingNotice />
                )}
                {aprobada && typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <button
                    type="button"
                    onClick={() => navigator.share({
                      title: `Mi entrada: ${eventTitle}`,
                      text: `Mi entrada (QR) para ${eventTitle} — ID: ${t.id}`,
                      url: `${publicBaseUrl()}/t/${t.id}`,
                    }).catch(() => {})}
                    style={{
                      marginTop: 16, width: "100%", padding: "13px",
                      background: "rgba(52,211,153,0.08)", color: "#34d399",
                      borderRadius: 14, border: "1px solid rgba(52,211,153,0.25)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    ↗ {varias ? `Compartir entrada ${i + 1}` : "Compartir ticket"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flechas + puntos. Las flechas hacen falta en escritorio, donde no hay
          gesto de deslizar; en móvil sirven de pista de que hay más entradas. */}
      {varias && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14 }}>
          <Flecha dir="prev" onClick={() => goTo(idx - 1)} disabled={idx === 0} />
          <div style={{ display: "flex", gap: 7 }}>
            {tickets.map((t, i) => (
              <button
                key={t.id} type="button"
                onClick={() => goTo(i)}
                aria-label={`Ver entrada ${i + 1}`}
                aria-current={i === idx}
                style={{
                  width: i === idx ? 22 : 8, height: 8, borderRadius: 4, padding: 0, border: "none",
                  background: i === idx ? "#34d399" : "rgba(229,238,255,0.28)",
                  cursor: "pointer", transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>
          <Flecha dir="next" onClick={() => goTo(idx + 1)} disabled={idx === tickets.length - 1} />
        </div>
      )}
    </div>
  );
}

function Flecha({ dir, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      aria-label={dir === "prev" ? "Entrada anterior" : "Entrada siguiente"}
      style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.11)", border: "1px solid rgba(255,255,255,0.14)",
        color: disabled ? "rgba(229,238,255,0.22)" : "#a7f3d0",
        cursor: disabled ? "default" : "pointer", padding: 0,
      }}
    >
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
      </svg>
    </button>
  );
}
