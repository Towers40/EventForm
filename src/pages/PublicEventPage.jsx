import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { isSoldOut } from "../lib/capacity.js";
import { IconButton, IcoBack, IcoShare, IcoMail, IcoQr, EventCover, DirectionsButton, CopiedToast } from "../components/ui.jsx";
import { COVER_PAD } from "../lib/ui-tokens.js";
import { useShare } from "../lib/useShare.js";
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
  const { compartir, copiado } = useShare();

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
    // La copia guardada en el dispositivo se escribió al inscribirse y no se
    // entera de nada después: por eso un QR ya aprobado seguía saliendo
    // borroso aquí. Hay que refrescar el estado SIEMPRE, y no solo con sesión
    // iniciada — quien llega desde Descubrir puede no haber entrado a su
    // cuenta en este navegador.
    const ticketsP = (apiEnabled && token)
      ? api.myTickets(token).then(r => r.tickets).catch(() => null)
      : Promise.resolve(null);

    // Sin sesión: se pregunta por cada entrada guardada, que es público.
    const localIds = localReg
      ? (localReg._all?.length ? localReg._all.map(t => t.id) : [localReg.id]).filter(Boolean)
      : [];
    const localesP = (!token && apiEnabled && localIds.length)
      ? Promise.all(localIds.map(id =>
          api.publicTicket(id)
            .then(r => ({ id, used: Boolean(r.ticket.used), approved: r.ticket.approved !== false, cancelled: Boolean(r.ticket.cancelled) }))
            .catch(() => null)))
        .then(list => list.filter(Boolean).filter(t => !t.cancelled))
      : Promise.resolve(null);

    localesP.then(list => {
      if (cancelled || !list?.length) return;
      setReg(list[0]);
      setRegs(list.length > 1 ? list : null);
      try {
        const key = `ef_ticket_${slug}`;
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (saved) localStorage.setItem(key, JSON.stringify({ ...saved, ...list[0], _all: list }));
      } catch { /* noop */ }
    });

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
    if (!pendientes || !apiEnabled) return;
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
      {/* Acciones flotantes: solo iconos, como el resto de la app. */}
      <div style={{ position: "fixed", top: "calc(14px + var(--ef-top-offset, 0px))", left: 14, right: 14, zIndex: 20, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
        <span style={{ pointerEvents: "auto" }}>
          <IconButton title="Volver" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/app"; }}>
            <IcoBack />
          </IconButton>
        </span>
        <span style={{ pointerEvents: "auto" }}>
          <IconButton title="Compartir evento"
            onClick={() => compartir({ url: `/e/${slug}`, title: event.title, text: `${event.title} — en TapIn` })}>
            <IcoShare />
          </IconButton>
        </span>
      </div>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* ── Portada: cuadrada, con margen y esquinas suavizadas ── */}
        <div style={{ paddingTop: 68 }}>
          <EventCover src={event.headerImage} alt={event.title} />
        </div>

        {/* ── Content ── */}
        <div style={{ padding: `24px ${COVER_PAD}px 0` }}>

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
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <DateChip dateStr={event.startDate} />
              {/* Las tres líneas van juntas: antes cada una traía su propio
                  margen y el bloque se leía como tres datos sueltos. */}
              <div style={{ lineHeight: 1.32 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>{dateDesc.dateStr}</p>
                {dateDesc.timeStr && <p style={{ margin: 0, fontSize: 13, color: SUB }}>{dateDesc.timeStr}</p>}
                {endP && endP.d !== startP.d && (
                  <p style={{ margin: 0, fontSize: 12, color: SUB }}>hasta {endP.d} de {MONTHS_FULL[endP.m - 1]}</p>
                )}
              </div>
            </div>
          )}

          {/* Registro — solo la barra de acción (sin texto ni recuadro) */}
          <div style={{ marginBottom: 28 }}>
            {reg ? (
              <button onClick={() => setPhase("ticket")} style={{ width: "100%", padding: "15px", background: "rgba(107,159,212,0.25)", color: "#e8eaf0", borderRadius: 14, fontWeight: 800, fontSize: 16, border: "1px solid rgba(107,159,212,0.4)", cursor: "pointer", letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IcoQr />
                {(regs?.length || 1) > 1 ? `Ver entradas (${regs.length})` : "Ver entrada"}
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
              {hasCoords && (
                <div style={{ marginTop: 14 }}>
                  <DirectionsButton lat={event.lat} lng={event.lng} label={locName} variant="pill" />
                </div>
              )}
            </div>
          )}

          {/* Contactar: mismo relleno y forma que "Ver entrada", compacto. */}
          {event.hostEmail && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20, marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <a href={`mailto:${event.hostEmail}?subject=${encodeURIComponent("Consulta: " + event.title)}`}
                className="ef-hover-fill"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                  textDecoration: "none", color: "#e8eaf0",
                  background: "rgba(107,159,212,0.25)", border: "1px solid rgba(107,159,212,0.4)",
                  borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 800,
                }}>
                <IcoMail />
                Organizador
              </a>
            </div>
          )}

        </div>
      </div>
      <CopiedToast visible={copiado} />
    </div>
  );
}
