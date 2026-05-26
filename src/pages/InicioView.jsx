import "../styles/typeform.css";
import { VERDE_CORPORATIVO } from "../lib/theme.js";

const STEPS = [
  { n: "1", title: "Crea tu evento", desc: "Responde 4 preguntas rápidas: nombre, tipo, aforo y lugar. En menos de 3 minutos." },
  { n: "2", title: "Personaliza el formulario", desc: "Añade campos a medida: nombre, correo, teléfono, selección múltiple, checkboxes y más." },
  { n: "3", title: "Comparte el enlace", desc: "Un link público para WhatsApp, Instagram o email. Los asistentes se inscriben solos." },
  { n: "4", title: "Check-in con QR", desc: "El día del evento escanea el código QR de cada asistente desde tu celular en segundos." },
];

export default function InicioView({ events, onNew }) {
  const totalRegs = events.reduce((n, e) => n + (e.registrations?.length || 0), 0);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "48px 24px 40px" }}>
        <span style={{ color: VERDE_CORPORATIVO, fontSize: 40, display: "block", marginBottom: 12 }}>●</span>
        <h1 className="tf-question" style={{ fontSize: "clamp(26px,5vw,38px)", fontWeight: 300, margin: "0 0 16px" }}>
          Bienvenido a <strong style={{ fontWeight: 700 }}>EventForm</strong>
        </h1>
        <p className="tf-hint" style={{ maxWidth: 400, margin: "0 auto 32px" }}>
          Gestiona inscripciones, controla el acceso con QR y analiza tus eventos — todo desde un solo lugar.
        </p>
        <button type="button" className="soft-btn soft-btn-primary" onClick={onNew} style={{ fontSize: 16, padding: "16px 40px", borderRadius: 12 }}>
          + Crear nuevo evento
        </button>
      </div>

      {/* Stats rápidas si hay eventos */}
      {events.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 40, padding: "0 8px" }}>
          {[
            { label: "Eventos", value: events.length },
            { label: "Inscritos", value: totalRegs },
            { label: "Check-ins", value: events.reduce((n, e) => n + (e.registrations?.filter(r => r.used).length || 0), 0) },
          ].map(s => (
            <div key={s.label} className="panel-card" style={{ padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0d3b66" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#8fa3b1", fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            </div>
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
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0d3b66", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0d1b2a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#5c6b7a", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
