import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { isSoldOut } from "../lib/capacity.js";
import "../styles/typeform.css";

// ── helpers ──────────────────────────────────────────────────────────────────
const DAYS_ES   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d, dt: new Date(y, m - 1, d) };
}

function fmtTime(t) {
  if (!t) return null;
  const [h, mi] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12    = h % 12 || 12;
  return `${h12}:${String(mi).padStart(2, "0")} ${suffix}`;
}

function mapsUrl(lat, lng, label) {
  return `https://maps.google.com/?q=${lat},${lng}&query=${encodeURIComponent(label || "")}`;
}

// ── Calendar date widget ──────────────────────────────────────────────────────
function DateChip({ dateStr }) {
  const p = parseDateParts(dateStr);
  if (!p) return null;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 12, flexShrink: 0,
      background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#6b9fd4", letterSpacing: "0.06em", lineHeight: 1 }}>
        {MONTHS_ES[p.m - 1].toUpperCase()}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#e8eaf0", lineHeight: 1.1 }}>{p.d}</span>
    </div>
  );
}

// ── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 24 }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(107,159,212,0.35)", border: "1.5px solid rgba(107,159,212,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#6b9fd4",
    }}>
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PublicEventPage() {
  const { slug }                   = useParams();
  const [event, setEvent]          = useState(null);
  const [reg, setReg]              = useState(null);
  const [phase, setPhase]          = useState("event");
  const [err, setErr]              = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        let ev;
        if (apiEnabled) {
          const { event: fetched } = await api.publicEvent(slug);
          ev = fetched;
        } else {
          ev = loadEvents().find(e => e.slug === slug);
          if (!ev) { setErr("Evento no encontrado"); return; }
        }
        setEvent(ev);
        const saved = localStorage.getItem(`ef_ticket_${slug}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (!parsed.cancelled) { setReg(parsed); setPhase("ticket"); }
          } catch {}
        }
      } catch { setErr("Evento no encontrado o no disponible"); }
    })();
  }, [slug]);

  const handleSubmit = async (payload) => {
    if (apiEnabled) {
      const { registration } = await api.publicRegister(slug, payload);
      localStorage.setItem(`ef_ticket_${slug}`, JSON.stringify(registration));
      setReg(registration); setPhase("ticket"); return;
    }
    const ev   = loadEvents().find(e => e.slug === slug);
    const ticket = { id: "TICKET-" + Math.random().toString(36).slice(2, 10).toUpperCase(), eventId: ev.id, data: payload.form, ts: Date.now(), used: false };
    localStorage.setItem(`ef_ticket_${slug}`, JSON.stringify(ticket));
    setReg(ticket); setPhase("ticket");
  };

  const handleCancel = async () => {
    if (!reg?.id) return;
    setCancelling(true);
    try {
      if (apiEnabled) await api.cancelRegistration(reg.id);
      localStorage.removeItem(`ef_ticket_${slug}`);
      setReg(null); setPhase("event");
    } catch (e) { alert("No se pudo cancelar: " + e.message); }
    finally { setCancelling(false); }
  };

  const BG   = "#0d0f10";
  const TEXT = "#e8eaf0";
  const SUB  = "rgba(232,234,240,0.5)";
  const CARD = "rgba(255,255,255,0.06)";
  const BORDER = "1px solid rgba(255,255,255,0.1)";

  if (err) return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: SUB, fontSize: 16 }}>{err}</p>
    </div>
  );

  if (!event) return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: SUB, fontSize: 14 }}>Cargando…</p>
    </div>
  );

  if (phase === "register") return (
    <TypeformRegister event={event} onSubmit={handleSubmit} onBack={() => setPhase("event")} />
  );

  if (phase === "ticket") return (
    <ConfirmTicket ev={event} reg={reg} standalone onCancel={handleCancel} cancelling={cancelling} />
  );

  const soldOut   = isSoldOut(event);
  const startP    = parseDateParts(event.startDate);
  const endP      = parseDateParts(event.endDate);
  const locName   = event.address || event.location || event.city || null;
  const hasCoords = event.lat != null && event.lng != null;

  // Build date description string
  let dateDesc = null;
  if (startP) {
    const day     = DAYS_ES[startP.dt.getDay()];
    const dateStr = `${day}, ${startP.d} de ${MONTHS_FULL[startP.m - 1]}`;
    const t1      = fmtTime(event.startTime);
    const t2      = fmtTime(event.endTime);
    const timeStr = t1 && t2 ? `${t1} – ${t2}` : t1 || "";
    dateDesc = { dateStr, timeStr };
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, paddingBottom: 60 }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* ── Cover image ── */}
        <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#1a1c1e" }}>
          {event.headerImage
            ? <img src={event.headerImage} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1a2540,#0d1520)", fontSize: 64 }}>🎉</div>
          }
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "24px 20px 0" }}>

          {/* Title */}
          <h1 style={{ fontSize: 32, fontWeight: 800, color: TEXT, margin: "0 0 10px", lineHeight: 1.15, letterSpacing: "-0.5px" }}>
            {event.title}
          </h1>

          {/* Hosted by */}
          {event.hostName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Avatar name={event.hostName} size={26} />
              <span style={{ fontSize: 14, color: SUB }}>Organizado por <strong style={{ color: TEXT, fontWeight: 600 }}>{event.hostName}</strong></span>
            </div>
          )}

          {/* Date row */}
          {startP && dateDesc && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <DateChip dateStr={event.startDate} />
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>{dateDesc.dateStr}</p>
                {dateDesc.timeStr && <p style={{ margin: "2px 0 0", fontSize: 13, color: SUB }}>{dateDesc.timeStr}</p>}
                {endP && endP.d !== startP.d && (
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: SUB }}>hasta {endP.d} de {MONTHS_FULL[endP.m - 1]}</p>
                )}
              </div>
            </div>
          )}

          {/* Location row */}
          {locName && (
            hasCoords
              ? (
                <a href={mapsUrl(event.lat, event.lng, locName)} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, textDecoration: "none", cursor: "pointer" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b9fd4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT, display: "flex", alignItems: "center", gap: 6 }}>
                      {locName}
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#6b9fd4" strokeWidth={2.5} strokeLinecap="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                    </p>
                    {event.city && event.address && event.city !== locName && (
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: SUB }}>{event.city}</p>
                    )}
                  </div>
                </a>
              )
              : (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#6b9fd4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{locName}</p>
                </div>
              )
          )}

          {/* Registration card */}
          <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: "20px", marginBottom: 28 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Registro</p>
            {soldOut ? (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: SUB, lineHeight: 1.5 }}>Las entradas para este evento se agotaron.</p>
                <div style={{ padding: "15px", background: "rgba(255,255,255,0.05)", borderRadius: 14, textAlign: "center", color: SUB, fontWeight: 700, fontSize: 15 }}>Entradas agotadas</div>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: SUB, lineHeight: 1.5 }}>¡Bienvenido! Para participar en este evento, regístrate a continuación.</p>
                <button onClick={() => setPhase("register")} style={{ width: "100%", padding: "16px", background: "#fff", color: "#0d1520", borderRadius: 14, fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "0.01em" }}>
                  Registrarse
                </button>
              </>
            )}
          </div>

          {/* Description */}
          {event.eventDescription && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Acerca del evento</p>
              <p style={{ margin: 0, color: "rgba(232,234,240,0.8)", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                {event.eventDescription}
              </p>
            </div>
          )}

          {/* Location section */}
          {locName && (
            <div style={{ marginBottom: 28, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ubicación</p>
              {hasCoords ? (
                <a href={mapsUrl(event.lat, event.lng, locName)} target="_blank" rel="noopener noreferrer" style={{ color: TEXT, textDecoration: "none" }}>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT }}>{locName}</p>
                  {event.locationInstructions && <p style={{ margin: "6px 0 0", fontSize: 13, color: SUB, lineHeight: 1.5 }}>{event.locationInstructions}</p>}
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b9fd4" }}>Ver en Google Maps ↗</p>
                </a>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT }}>{locName}</p>
                  {event.locationInstructions && <p style={{ margin: "6px 0 0", fontSize: 13, color: SUB, lineHeight: 1.5 }}>{event.locationInstructions}</p>}
                </>
              )}
            </div>
          )}

          {/* Hosted by section */}
          {event.hostName && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, marginBottom: 24 }}>
              <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Organizado por</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Avatar name={event.hostName} size={44} />
                <span style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>{event.hostName}</span>
              </div>
              {event.hostEmail && (
                <a href={`mailto:${event.hostEmail}?subject=${encodeURIComponent("Consulta: " + event.title)}`}
                  style={{ display: "block", fontSize: 14, color: "#6b9fd4", textDecoration: "none", marginBottom: 10 }}>
                  Contactar al organizador
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
