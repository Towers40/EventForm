import { useState } from "react";
import { DirectionsSheet } from "./ui.jsx";

/**
 * Mapa del evento. Al tocarlo pregunta con qué app de navegación ir, en vez de
 * tener un botón aparte: el mapa ya es la señal visual de "aquí es", y pulsarlo
 * para que te lleve es lo que la gente espera.
 *
 * El iframe no deja pasar los clics al contenedor, así que se le superpone una
 * capa transparente que los captura. Es también lo que evita que el usuario
 * arrastre el mapa incrustado sin querer al hacer scroll.
 */
export default function LocationMap({ lat, lng, height = 200, label, radius = 16 }) {
  const [abierto, setAbierto] = useState(false);
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const pad = 0.012;
  const bbox = `${ln - pad},${la - pad},${ln + pad},${la + pad}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${la}%2C${ln}`;

  return (
    <>
      <div
        role="button" tabIndex={0}
        aria-label={label ? `Cómo llegar a ${label}` : "Cómo llegar"}
        onClick={() => setAbierto(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAbierto(true); } }}
        style={{
          position: "relative", borderRadius: radius, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          boxShadow: "0 6px 22px rgba(0,0,0,0.3)",
        }}
      >
        <iframe
          title="Mapa del evento"
          src={src}
          style={{ width: "100%", height, border: "none", display: "block", pointerEvents: "none" }}
          loading="lazy"
        />
        {/* Capa que captura el toque (el iframe se lo tragaría) y da la pista
            de que el mapa es pulsable. */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 10 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(13,18,32,0.86)", color: "#ffffff",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.16)", borderRadius: 100,
            padding: "7px 13px", fontSize: 12.5, fontWeight: 600,
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 11 19-8-8 19-2-9-9-2z" />
            </svg>
            Cómo llegar
          </span>
        </div>
      </div>

      <DirectionsSheet lat={la} lng={ln} abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
}
