import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import LocationMap from "../components/LocationMap.jsx";
import NavigateButtons from "../components/NavigateButtons.jsx";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { isSoldOut } from "../lib/capacity.js";
import "../styles/typeform.css";

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [year, month, day] = dateStr.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function capacityText(event) {
  const maxMap = { "0-50": 50, "50-100": 100, "100-300": 300, "300+": "300+" };
  if (event.capacity === "under-50" && event.capacityCustom) {
    const max = Number(event.capacityCustom);
    const left = Math.max(0, max - (event.registrationCount || 0));
    return `${event.registrationCount || 0}/${max} inscritos · ${left} lugar${left !== 1 ? "es" : ""} disponible${left !== 1 ? "s" : ""}`;
  }
  if (event.capacity && event.capacity !== "under-50") {
    return `Hasta ${maxMap[event.capacity]} personas`;
  }
  return `${event.registrationCount || 0} inscritos`;
}

export default function PublicEventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [reg, setReg] = useState(null);
  const [phase, setPhase] = useState("event"); // "event" | "register" | "ticket"
  const [err, setErr] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let ev;
        if (apiEnabled) {
          const { event: fetched } = await api.publicEvent(slug);
          ev = fetched;
        } else {
          ev = loadEvents().find((e) => e.slug === slug);
          if (!ev) { setErr("Evento no encontrado"); return; }
        }
        setEvent(ev);

        const saved = localStorage.getItem(`ef_ticket_${slug}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (!parsed.cancelled) {
              setReg(parsed);
              setPhase("ticket");
            }
          } catch {}
        }
      } catch {
        setErr("Evento no encontrado o no disponible");
      }
    })();
  }, [slug]);

  const handleSubmit = async (payload) => {
    if (apiEnabled) {
      const { registration } = await api.publicRegister(slug, payload);
      localStorage.setItem(`ef_ticket_${slug}`, JSON.stringify(registration));
      setReg(registration);
      setPhase("ticket");
      return;
    }
    const ev = loadEvents().find((e) => e.slug === slug);
    const ticket = {
      id: "TICKET-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      eventId: ev.id,
      data: payload.form,
      ts: Date.now(),
      used: false,
    };
    localStorage.setItem(`ef_ticket_${slug}`, JSON.stringify(ticket));
    setReg(ticket);
    setPhase("ticket");
  };

  const handleCancel = async () => {
    if (!reg?.id) return;
    setCancelling(true);
    try {
      if (apiEnabled) await api.cancelRegistration(reg.id);
      localStorage.removeItem(`ef_ticket_${slug}`);
      setReg(null);
      setPhase("event");
    } catch (e) {
      alert("No se pudo cancelar la asistencia: " + e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (err) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <h1 className="tf-question">{err}</h1>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <p className="tf-hint">Cargando…</p>
        </div>
      </div>
    );
  }

  if (phase === "register") {
    return (
      <TypeformRegister
        event={event}
        onSubmit={handleSubmit}
        onBack={() => setPhase("event")}
      />
    );
  }

  if (phase === "ticket") {
    return (
      <ConfirmTicket
        ev={event}
        reg={reg}
        standalone
        onCancel={handleCancel}
        cancelling={cancelling}
      />
    );
  }

  const soldOut = isSoldOut(event);

  return (
    <div className="tf-screen" style={{ display: "block", overflowY: "auto" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>

        {/* Cover image — square, rounded */}
        <div style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 20,
          overflow: "hidden",
          background: "#1a1c1e",
          marginBottom: 20,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {event.headerImage ? (
            <img
              src={event.headerImage}
              alt={event.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              background: "linear-gradient(135deg, #1a1c1e 0%, #0d1520 100%)",
            }}>
              🎉
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#e8eaf0",
          margin: "0 0 12px",
          lineHeight: 1.2,
          letterSpacing: "-0.5px",
        }}>
          {event.title}
        </h1>

        {/* Date */}
        {event.startDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b9fd4", fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            <span>📅</span>
            <span>{formatDate(event.startDate)}{event.startTime ? ` · ${event.startTime}` : ""}</span>
          </div>
        )}

        {/* Location */}
        {(event.city || event.location || event.address) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8fa3b1", fontSize: 14, marginBottom: 20 }}>
            <span>📍</span>
            <span>{[event.city, event.location || event.address].filter(Boolean).join(" · ")}</span>
          </div>
        )}

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {soldOut ? (
            <div style={{
              flex: 1, padding: "15px", background: "rgba(255,255,255,0.06)",
              color: "#8fa3b1", borderRadius: 12, fontWeight: 700, fontSize: 15,
              border: "1px solid rgba(255,255,255,0.1)", textAlign: "center",
            }}>
              Entradas agotadas
            </div>
          ) : (
            <button
              onClick={() => setPhase("register")}
              style={{
                flex: 1, padding: "15px", background: "linear-gradient(135deg, #0d3b66, #1a5f8a)",
                color: "#fff", borderRadius: 12, fontWeight: 700, fontSize: 15,
                border: "none", cursor: "pointer", letterSpacing: "0.2px",
              }}
            >
              Registrarse →
            </button>
          )}
          {event.hostEmail && (
            <a
              href={`mailto:${event.hostEmail}?subject=${encodeURIComponent("Consulta: " + event.title)}`}
              style={{
                padding: "15px 16px", background: "rgba(255,255,255,0.05)",
                color: "#c4cad6", borderRadius: 12, fontWeight: 600, fontSize: 13,
                border: "1px solid rgba(255,255,255,0.1)", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              }}
            >
              ✉️ Contactar host
            </a>
          )}
        </div>

        {/* Description */}
        {event.eventDescription && (
          <div style={{
            marginBottom: 24, padding: "16px 18px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <p style={{
              color: "#b0bac8", fontSize: 14, lineHeight: 1.75,
              margin: 0, whiteSpace: "pre-wrap",
            }}>
              {event.eventDescription}
            </p>
          </div>
        )}

        {/* Instructions */}
        {event.locationInstructions && (
          <div style={{
            marginBottom: 24, padding: "12px 16px",
            background: "rgba(107,159,212,0.07)",
            borderRadius: 12, border: "1px solid rgba(107,159,212,0.15)",
          }}>
            <p style={{ color: "#8fa3b1", fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
              📌 {event.locationInstructions}
            </p>
          </div>
        )}

        {/* Meta info row */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {event.capacity && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8fa3b1", fontSize: 13 }}>
              <span>👥</span>
              <span>{capacityText(event)}</span>
            </div>
          )}
          {event.hostName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8fa3b1", fontSize: 13 }}>
              <span>🎤</span>
              <span>Organiza: <strong style={{ color: "#c4cad6" }}>{event.hostName}</strong></span>
            </div>
          )}
        </div>

        {/* Map */}
        {event.lat != null && event.lng != null && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
            <LocationMap lat={event.lat} lng={event.lng} height={200} />
          </div>
        )}
        {event.lat != null && event.lng != null && (
          <NavigateButtons lat={event.lat} lng={event.lng} label={event.address || event.location} />
        )}

      </div>
    </div>
  );
}
