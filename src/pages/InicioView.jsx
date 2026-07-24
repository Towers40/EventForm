import { useNavigate } from "react-router-dom";
import "../styles/typeform.css";
import { VERDE_CORPORATIVO } from "../lib/theme.js";
import { BRAND_NAME, TapInMark } from "../lib/brand.jsx";

const STEPS = [
  { n: "1", title: "Crea tu evento", desc: "Responde 4 preguntas rápidas: nombre, tipo, aforo y lugar. En menos de 3 minutos." },
  { n: "2", title: "Personaliza el formulario", desc: "Añade campos a medida: nombre, correo, teléfono, selección múltiple, checkboxes y más." },
  { n: "3", title: "Comparte el enlace", desc: "Un link público para WhatsApp, Instagram o email. Los asistentes se inscriben solos." },
  { n: "4", title: "Check-in con QR", desc: "El día del evento escanea el código QR de cada asistente desde tu celular en segundos." },
];

export default function InicioView({ events, onNew, onGoTo }) {
  const totalRegs = events.reduce((n, e) => n + (e.registrations?.length || 0), 0);
  const nav = useNavigate();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "48px 24px 40px" }}>
        <span style={{ display: "block", marginBottom: 12 }}><TapInMark size={44} color={VERDE_CORPORATIVO} /></span>
        <h1 className="tf-question" style={{ fontSize: "clamp(26px,5vw,38px)", fontWeight: 300, margin: "0 0 16px" }}>
          Bienvenido a <strong style={{ fontWeight: 700 }}>{BRAND_NAME}</strong>
        </h1>
        <p className="tf-hint" style={{ maxWidth: 400, margin: "0 auto 32px" }}>
          Gestiona inscripciones, controla el acceso con QR y analiza tus eventos — todo desde un solo lugar.
        </p>
        <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" onClick={onNew} style={{ fontSize: 16, padding: "16px 40px", borderRadius: 12 }}>
          + Crear nuevo evento
        </button>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="ef-hover-fill" onClick={() => nav("/discover")} style={{ background: "none", border: "none", borderRadius: 8, padding: "6px 10px", color: "#6b9fd4", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>
            Descubrir eventos →
          </button>
        </div>
      </div>

      {/* Stats rápidas si hay eventos */}
      {events.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 40, padding: "0 8px" }}>
          {[
            { label: "Eventos",   value: events.length,  nav: "mis_eventos" },
            { label: "Inscritos", value: totalRegs,       nav: "mis_eventos" },
            { label: "Check-ins", value: events.reduce((n, e) => n + (e.registrations?.filter(r => r.used).length || 0), 0), nav: "stats" },
          ].map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => onGoTo?.(s.nav)}
              className="panel-card"
              style={{ padding: "20px 16px", textAlign: "center", cursor: "pointer", border: "none", width: "100%", transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: "#6b9fd4" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#8fa3b1", fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Cómo funciona */}
      <div style={{ padding: "0 8px 48px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
          Cómo funciona
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STEPS.map(s => (
            <div key={s.n} className="panel-card" style={{ padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1a5f8a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#8fa3b1", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
