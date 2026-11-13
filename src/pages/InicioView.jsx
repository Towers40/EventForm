import { useNavigate } from "react-router-dom";
import "../styles/typeform.css";
import { TapInMark } from "../lib/brand.jsx";
import PosterMarquee from "../components/PosterMarquee.jsx";

// Inicio del anfitrión, con la estructura de plata.co: titular grande alineado
// a la izquierda, una sola acción principal, cifras grandes y una lista de
// pasos "icono + título + una línea" sin cajas alrededor.

const ico = (d) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const STEPS = [
  { icon: ico(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18M12 14v4M10 16h4" /></>),
    title: "Crea tu evento", desc: "Nombre, fecha, lugar y aforo. Listo en menos de 3 minutos." },
  { icon: ico(<><path d="M9 5h11M9 12h11M9 19h11" /><circle cx="4.5" cy="5" r="1.5" /><circle cx="4.5" cy="12" r="1.5" /><circle cx="4.5" cy="19" r="1.5" /></>),
    title: "Arma el formulario", desc: "Pide solo lo que necesitas: nombre, correo, teléfono u opciones." },
  { icon: ico(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>),
    title: "Comparte el enlace", desc: "Por WhatsApp o Instagram. La gente se inscribe sola." },
  { icon: ico(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>),
    title: "Escanea en la puerta", desc: "Valida cada QR con la cámara de tu celular, en segundos." },
];

export default function InicioView({ events, onNew, onGoTo }) {
  const nav = useNavigate();
  const totalRegs = events.reduce((n, e) => n + (e.registrations?.length || 0), 0);
  const totalCheckins = events.reduce((n, e) => n + (e.registrations?.filter((r) => r.used).length || 0), 0);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 4px" }}>

      {/* Carrusel de ideas de evento (los pósters de la bienvenida): dice de un
          vistazo qué se puede organizar con TapIn. Va a sangre, de borde a borde. */}
      <section className="ef-bleed" style={{ paddingTop: 12 }}>
        <PosterMarquee variante="cinta" filas={2} card={98} />
      </section>

      {/* Hero */}
      <section style={{ padding: "24px 0 36px" }}>
        <TapInMark size={30} color="var(--tf-accent)" />
        <h1 style={{ fontSize: "clamp(34px, 9vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 600, margin: "18px 0 14px" }}>
          Crea tu evento en minutos
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: "var(--tf-desc)", margin: "0 0 28px", maxWidth: 460 }}>
          Inscripciones, entradas con QR y control de acceso desde tu celular.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
          <button type="button" className="soft-btn soft-btn-primary" onClick={onNew} style={{ width: "100%" }}>
            Crear evento
          </button>
          <button type="button" className="soft-btn soft-btn-secondary" onClick={() => nav("/discover")} style={{ width: "100%" }}>
            Descubrir eventos
          </button>
        </div>
      </section>

      {/* Cifras: grandes y sin cajas, como las de Plata. */}
      {events.length > 0 && (
        <section className="panel-card" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 40 }}>
          {[
            { label: "Eventos",   value: events.length, to: "mis_eventos" },
            { label: "Inscritos", value: totalRegs,     to: "mis_eventos" },
            { label: "Check-ins", value: totalCheckins, to: "stats" },
          ].map((s, i) => (
            <button
              key={s.label}
              type="button"
              className="ef-hover-fill"
              onClick={() => onGoTo?.(s.to)}
              style={{
                padding: "20px 8px 18px", textAlign: "center", cursor: "pointer", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "transparent", color: "inherit", borderRadius: 0,
                borderLeft: i ? "1px solid var(--tf-divider)" : "none",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "var(--tf-muted)", marginTop: 8 }}>{s.label}</div>
            </button>
          ))}
        </section>
      )}

      {/* Cómo funciona */}
      <section style={{ paddingBottom: 48 }}>
        <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", margin: "0 0 22px" }}>
          Cómo funciona
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {STEPS.map((s) => (
            <div key={s.title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--tf-surface-2)", color: "var(--tf-text)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                {s.icon}
              </div>
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.01em", marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 15, color: "var(--tf-muted)", lineHeight: 1.45 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
