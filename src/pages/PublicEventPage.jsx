import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import { useAuth } from "../context/AuthContext.jsx";
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

// Un solo botón "Ir aquí" que despliega el menú de apps de navegación
// (Waze · Google Maps · Apple Maps) para que el usuario elija.
function DirectionsMenu({ lat, lng }) {
  const [open, setOpen] = useState(false);
  const ll = `${lat},${lng}`;
  const apps = [
    { label: "Waze",        href: `https://waze.com/ul?ll=${ll}&navigate=yes`, color: "#33ccff" },
    { label: "Google Maps", href: `https://maps.google.com/?daddr=${ll}`,      color: "#34a853" },
    { label: "Apple Maps",  href: `https://maps.apple.com/?daddr=${ll}`,       color: "#7d8590" },
  ];
  return (
    <div style={{ position: "relative", marginTop: 14 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px 18px", borderRadius: 14, cursor: "pointer",
          background: "rgba(107,159,212,0.2)", color: "#e8eaf0",
          border: "1px solid rgba(107,159,212,0.4)", fontWeight: 800, fontSize: 15,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Ir aquí
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          marginTop: 8, borderRadius: 14, overflow: "hidden",
          background: "rgba(20,24,40,0.96)", border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
        }}>
          {apps.map((a, i) => (
            <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", textDecoration: "none", color: "#e8eaf0",
                fontSize: 15, fontWeight: 600,
                borderTop: i ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
              {a.label}
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="rgba(232,234,240,0.5)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M7 17 17 7M7 7h10v10"/></svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
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

// ── Avatar circle (foto del organizador si tiene; si no, iniciales) ───────────
function Avatar({ name, src, size = 24 }) {
  if (src) {
    return (
      <img src={src} alt={name || ""} width={size} height={size} loading="lazy" decoding="async"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(107,159,212,0.5)" }} />
    );
  }
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
  const { token }                  = useAuth();
  const [event, setEvent]          = useState(null);
  const [reg, setReg]              = useState(null);
  // Todas las entradas de esta persona para el evento (los eventos que
  // permiten más de una por persona generan un QR por cada una).
  const [regs, setRegs]            = useState(null);
  // Mientras vale true no se sabe aún si el usuario tiene entrada, así que la
  // tarjeta de registro muestra "Comprobando…" en vez de "Registrarse" (evita
  // el parpadeo en móvil, donde la entrada se resuelve por API, no localStorage).
  const [regLoading, setRegLoading] = useState(true);
  const [phase, setPhase]          = useState("event");
  const [err, setErr]              = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // fuerza recarga del estado

  useEffect(() => {
    let cancelled = false;
    setRegLoading(true);

    // 1) Entrada guardada en ESTE dispositivo (instantáneo).
    let localReg = null;
    try {
      const saved = localStorage.getItem(`ef_ticket_${slug}`);
      if (saved) { const p = JSON.parse(saved); if (!p.cancelled) localReg = p; }
    } catch { /* ignora JSON inválido */ }
    if (localReg) { setReg(localReg); setRegs(localReg._all?.length ? localReg._all : null); }

    // 2) Evento y entrada de la cuenta se piden EN PARALELO, para que el estado
    //    de inscripción esté listo cuando la página se pinta (no después).
    const eventP = apiEnabled
      ? api.publicEvent(slug).then(r => r.event)
      : Promise.resolve(loadEvents().find(e => e.slug === slug));
    // Se consulta SIEMPRE que haya sesión, incluso con una entrada guardada en
    // el dispositivo: esa copia se escribió al inscribirse y no se entera de
    // nada después. Por eso un QR aprobado seguía saliendo borroso aquí — la
    // página se quedaba con el "pendiente" del primer día.
    const ticketsP = (apiEnabled && token)
      ? api.myTickets(token).then(r => r.tickets).catch(() => null)
      : Promise.resolve(null);

    eventP.then(ev => {
      if (cancelled) return;
      if (!ev) { setErr("Evento no encontrado"); return; }
      setEvent(ev);
    }).catch(() => { if (!cancelled) setErr("Evento no encontrado o no disponible"); });

    ticketsP.then(tickets => {
      if (cancelled) return;
      if (tickets) {
        const mias = tickets.filter(t => t.event?.slug === slug);
        if (mias.length) {
          // El servidor manda sobre la copia local: es donde vive el estado de
          // aprobación al día.
          const norm = mias.map(t => ({ id: t.id, used: Boolean(t.used), approved: t.approved !== false }));
          setReg(norm[0]);
          setRegs(norm.length > 1 ? norm : null);
          try {
            const key = `ef_ticket_${slug}`;
            const saved = JSON.parse(localStorage.getItem(key) || "null");
            if (saved) localStorage.setItem(key, JSON.stringify({ ...saved, ...norm[0], _all: norm }));
          } catch { /* noop */ }
        }
      }
      setRegLoading(false);
    });

    return () => { cancelled = true; };
  }, [slug, token, refreshTick]);

  // Con alguna entrada pendiente de aprobación se refresca al volver a la
  // pestaña y cada 20 s, para que el QR se destape sin recargar a mano.
  useEffect(() => {
    const pendientes = (regs || (reg ? [reg] : [])).some(t => t?.approved === false);
    if (!pendientes || !apiEnabled || !token) return;
    const bump = () => setRefreshTick(n => n + 1);
    const tick = setInterval(bump, 20000);
    window.addEventListener("focus", bump);
    return () => { clearInterval(tick); window.removeEventListener("focus", bump); };
  }, [regs, reg, token]);

  // Los eventos con aprobación exigen cuenta: es en "Mis tickets" donde la
  // persona ve si su QR sigue pendiente o ya se activó.
  const goToLogin = () => {
    try { sessionStorage.setItem("ef_return_to", `/e/${slug}`); } catch { /* noop */ }
    window.location.href = "/login";
  };

  const handleSubmit = async (payload) => {
    if (apiEnabled) {
      let registration, registrations;
      try {
        ({ registration, registrations } = await api.publicRegister(slug, payload, token));
      } catch (e) {
        // La sesión caducó entre abrir el formulario y enviarlo.
        if (e?.status === 401 || e?.data?.error === "account_required") { goToLogin(); return; }
        if (e?.data?.error === "limit_per_user") {
          const tope = e.data.maxPerUser;
          const ya = e.data.already;
          throw new Error(ya
            ? `Ya tienes ${ya} entrada${ya === 1 ? "" : "s"} de este evento y el límite es ${tope} por persona.`
            : `Este evento permite un máximo de ${tope} entradas por persona.`);
        }
        throw e;
      }
      const snap = event ? { title: event.title, slug, startDate: event.startDate, date: event.date, headerImage: event.headerImage, city: event.city, location: event.location } : null;
      // En el dispositivo se guarda la primera; el resto viaja en `_all` para
      // poder pintarlas todas sin volver a pedirlas.
      const all = registrations?.length ? registrations : [registration];
      localStorage.setItem(`ef_ticket_${slug}`, JSON.stringify({ ...registration, _event: snap, _all: all }));
      setReg(registration); setRegs(all); setPhase("ticket"); return;
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

  const BG   = "transparent"; // fondo global en body (typeform.css)
  const TEXT = "#e8eaf0";
  const SUB  = "rgba(232,234,240,0.5)";

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
    <ConfirmTicket ev={event} reg={reg} regs={regs} standalone onCancel={handleCancel} cancelling={cancelling}
      onBack={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/app"; }} />
  );

  const soldOut     = isSoldOut(event);
  const needsAccount = Boolean(event.requireApproval) && !token;
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
      {/* Volver: solo la flecha, en círculo (móvil y ordenador) */}
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/app"; }}
        title="Volver" aria-label="Volver"
        style={{ position: "fixed", top: 14, left: 14, zIndex: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", color: "#fff", cursor: "pointer", padding: 0 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* ── Cover image ── */}
        <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#1a1c1e" }}>
          {event.headerImage
            ? <img src={event.headerImage} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${event.imagePos?.x ?? 50}% ${event.imagePos?.y ?? 50}%`, display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1a2540,#0d1520)", fontSize: 64 }}>🎉</div>
          }
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "24px 20px 0" }}>

          {/* Title */}
          <h1 style={{ fontSize: 32, fontWeight: 800, color: TEXT, margin: "0 0 10px", lineHeight: 1.15, letterSpacing: "-0.5px" }}>
            {event.title}
          </h1>

          {/* Organizado por — con el avatar (foto) del organizador */}
          {event.hostName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Avatar name={event.hostName} src={event.hostAvatar} size={26} />
              <span style={{ fontSize: 14, color: SUB }}>Organizado por <strong style={{ color: TEXT, fontWeight: 600 }}>{event.hostName}</strong></span>
            </div>
          )}

          {/* Date row */}
          {startP && dateDesc && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
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

          {/* Registro — solo la barra de acción (sin texto ni recuadro) */}
          <div style={{ marginBottom: 28 }}>
            {reg ? (
              <button onClick={() => setPhase("ticket")} style={{ width: "100%", padding: "16px", background: "rgba(107,159,212,0.25)", color: "#e8eaf0", borderRadius: 14, fontWeight: 800, fontSize: 16, border: "1px solid rgba(107,159,212,0.4)", cursor: "pointer", letterSpacing: "0.01em" }}>
                Ver mi entrada (QR)
              </button>
            ) : regLoading ? (
              // Aún no se sabe si tiene entrada: placeholder neutro (mismo tamaño
              // que el botón) para no mostrar "Registrarse" por error.
              <div style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: 14, textAlign: "center", color: SUB, fontWeight: 700, fontSize: 15, boxSizing: "border-box" }}>
                Comprobando tu inscripción…
              </div>
            ) : soldOut ? (
              <div style={{ padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: 14, textAlign: "center", color: SUB, fontWeight: 700, fontSize: 15 }}>Entradas agotadas</div>
            ) : needsAccount ? (
              <>
                <button onClick={goToLogin} style={{ width: "100%", padding: "16px", background: "#fff", color: "#0d1520", borderRadius: 14, fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "0.01em" }}>
                  Inicia sesión para solicitar tu lugar
                </button>
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: SUB, textAlign: "center", lineHeight: 1.5 }}>
                  Este evento requiere aprobación del organizador. Necesitas una cuenta
                  para seguir el estado de tu entrada.
                </p>
              </>
            ) : (
              <>
                <button onClick={() => setPhase("register")} style={{ width: "100%", padding: "16px", background: "#fff", color: "#0d1520", borderRadius: 14, fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "0.01em" }}>
                  {event.requireApproval ? "Solicitar mi lugar" : "Registrarse"}
                </button>
                {event.requireApproval && (
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, color: SUB, textAlign: "center", lineHeight: 1.5 }}>
                    El organizador debe aprobar tu solicitud. Tu QR se activará cuando lo haga.
                  </p>
                )}
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

          {/* Ubicación — el nombre y un solo botón "Ir aquí" con menú de GPS */}
          {locName && (
            <div style={{ marginBottom: 28, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ubicación</p>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT }}>{locName}</p>
              {event.locationInstructions && <p style={{ margin: "6px 0 0", fontSize: 13, color: SUB, lineHeight: 1.5 }}>{event.locationInstructions}</p>}
              {hasCoords && <DirectionsMenu lat={event.lat} lng={event.lng} />}
            </div>
          )}

          {/* Contacta al organizador (sin la ficha "Organizado por") */}
          {event.hostEmail && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, marginBottom: 24, textAlign: "center" }}>
              <a href={`mailto:${event.hostEmail}?subject=${encodeURIComponent("Consulta: " + event.title)}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  fontSize: 15, fontWeight: 700, color: "#6b9fd4", textDecoration: "none",
                  background: "rgba(107,159,212,0.12)", border: "1px solid rgba(107,159,212,0.28)",
                  borderRadius: 12, padding: "11px 18px",
                }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                Contacta al organizador
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
