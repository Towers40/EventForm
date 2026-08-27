import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { BRAND_NAME, TapInMark } from "../lib/brand.jsx";
import EventCard from "../components/EventCard.jsx";
import { IconButton, IcoBack } from "../components/ui.jsx";
import "../styles/typeform.css";

// Perfil público de quien organiza: persona, empresa o fundación. Se llega
// desde el nombre del organizador en cualquier tarjeta de Descubrir, y la
// pregunta que responde es "¿y qué más hace esta gente?".

function Avatar({ name, src, size = 76 }) {
  if (src) {
    return (
      <img src={src} alt="" width={size} height={size}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(127,179,230,0.4)" }} />
    );
  }
  const iniciales = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(127,179,230,0.28)", border: "2px solid rgba(127,179,230,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: "#bfd9f2",
    }}>
      {iniciales}
    </div>
  );
}

function Dato({ n, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#eef1f7", lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: "rgba(238,241,247,0.5)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function OrganizerPage() {
  const { hostId } = useParams();
  const [datos, setDatos]     = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let vivo = true;
    api.publicHost(hostId)
      .then(d => { if (vivo) { setDatos(d); setError(null); } })
      .catch(e => { if (vivo) setError(e.message || "No se pudo cargar el organizador."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [hostId]);

  const host     = datos?.host;
  const proximos = datos?.upcoming || [];
  const pasados  = datos?.past || [];
  const anio     = host?.since ? new Date(Number(host.since)).getFullYear() : null;

  const volver = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/discover";
  };

  return (
    <div style={{ minHeight: "100dvh", color: "#eef1f7", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Barra: volver a donde se venía (normalmente Descubrir) */}
      <nav style={{
        padding: "0 16px", height: 56,
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)",
      }}>
        <span style={{ justifySelf: "start" }}>
          <IconButton title="Volver" tone="soft" onClick={volver}><IcoBack /></IconButton>
        </span>
        <a href="/discover" className="ef-hover-fill" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 12px", borderRadius: 14 }}>
          <TapInMark size={20} color="#22c55e" />
          <span style={{ fontWeight: 800, fontSize: 16, color: "#eef1f7" }}>{BRAND_NAME}</span>
        </a>
        <span />
      </nav>

      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "0 24px 80px" }}>
        {cargando ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8fa3b1" }}>
            <div style={{ lineHeight: 1, marginBottom: 14, animation: "ef-logo-pulse 1.3s ease-in-out infinite", display: "inline-block" }}>
              <TapInMark size={44} color="#22c55e" />
            </div>
            <p style={{ fontSize: 15, margin: 0 }}>Cargando perfil…</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <p style={{ color: "#8fa3b1", fontSize: 15, marginBottom: 18 }}>{error}</p>
            <a href="/discover" className="ef-hover-fill" style={{ textDecoration: "none", background: "rgba(127,179,230,0.2)", color: "#eef1f7", border: "1px solid rgba(127,179,230,0.4)", borderRadius: 14, padding: "11px 22px", fontWeight: 700, fontSize: 14 }}>
              Ver todos los eventos
            </a>
          </div>
        ) : (
          <>
            {/* ── Quién organiza ── */}
            <header style={{ padding: "44px 0 34px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
              <Avatar name={host.name} src={host.avatar} />
              <div>
                <h1 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 500, margin: 0, lineHeight: 1.15 }}>{host.name}</h1>
                <p style={{ fontSize: 13.5, color: "#8fa3b1", margin: "6px 0 0" }}>
                  Organiza en {BRAND_NAME}{anio ? ` desde ${anio}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 28, marginTop: 4 }}>
                <Dato n={host.totalEvents} label={host.totalEvents === 1 ? "evento" : "eventos"} />
                <Dato n={proximos.length} label="por venir" />
                {host.totalAttendees > 0 && <Dato n={host.totalAttendees} label="asistentes" />}
              </div>
            </header>

            {/* ── Próximos ── */}
            <section style={{ marginBottom: 44 }}>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: "#eef1f7", margin: "0 0 16px" }}>
                Próximos eventos
              </h2>
              {proximos.length > 0 ? (
                <div className="ef-ev-grid">
                  {proximos.map(ev => <EventCard key={ev.id} ev={{ ...ev, hostName: host.name, hostAvatar: host.avatar, hostId: host.id }} />)}
                </div>
              ) : (
                <p style={{ color: "#8fa3b1", fontSize: 14.5, margin: 0 }}>
                  No tiene eventos programados por ahora.
                </p>
              )}
            </section>

            {/* ── Ya pasaron: son el historial, la prueba de que esto va en serio ── */}
            {pasados.length > 0 && (
              <section>
                <h2 style={{ fontSize: 18, fontWeight: 500, color: "#eef1f7", margin: "0 0 16px" }}>
                  Ya pasaron
                </h2>
                {/* Atenuados: se pueden abrir, pero no compiten con lo que
                    todavía se puede vivir. */}
                <div className="ef-ev-grid" style={{ opacity: 0.62 }}>
                  {pasados.map(ev => <EventCard key={ev.id} ev={{ ...ev, hostName: host.name, hostAvatar: host.avatar, hostId: host.id }} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes ef-logo-pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.3; }
          50%      { transform: scale(1.15); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
