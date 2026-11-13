import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TypeformRegister from "../components/TypeformRegister.jsx";
import ConfirmTicket from "../components/ConfirmTicket.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { isSoldOut } from "../lib/capacity.js";
import { validateRegistrationForm } from "../lib/tickets.js";
import { prefillFromProfile } from "../../shared/profileFields.js";
import { IconButton, IcoBack, IcoShare, IcoMail, IcoQr, EventCover, CopiedToast, AttendeeStack, EventTintLayer } from "../components/ui.jsx";
import LocationMap from "../components/LocationMap.jsx";
import { eventTint, dominantColorFromUrl } from "../lib/dominantColor.js";
import { loadEventFont, eventFontProps, getEventFont } from "../lib/fonts.js";
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
function DateChip({ dateStr, tinte }) {
  const p = parseDateParts(dateStr);
  if (!p) return null;
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      // Con color de portada, el recuadro de la fecha se tiñe con él: es la
      // pieza más visible después del título y ata el dato al evento.
      background: tinte ? tinte.soft : "rgba(255,255,255,0.1)",
      border: `1px solid ${tinte ? tinte.border : "rgba(255,255,255,0.15)"}`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: tinte ? tinte.accent : "#34d399", letterSpacing: "0.06em", lineHeight: 1 }}>
        {MONTHS_ES[p.m - 1].toUpperCase()}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>{p.d}</span>
    </div>
  );
}

// ── Avatar circle (foto del organizador si tiene; si no, iniciales) ───────────
function Avatar({ name, src, size = 24 }) {
  if (src) {
    return (
      <img src={src} alt={name || ""} width={size} height={size} loading="lazy" decoding="async"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(52,211,153,0.5)" }} />
    );
  }
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(52,211,153,0.35)", border: "1.5px solid rgba(52,211,153,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#34d399",
    }}>
      {initials}
    </div>
  );
}

// ── Inscripción con un clic ───────────────────────────────────────────────────
// Muestra QUÉ datos se van a enviar antes de confirmar: un clic no debe ser un
// salto a ciegas, y así la persona ve que el teléfono o el correo son los
// correctos (y puede cambiarlos con "Editar").
function QuickRegister({ event, campos, valores, cantidad, setCantidad, busy, error, onConfirm, onEdit }) {
  const maxPorPersona = Math.max(1, Math.min(Number(event.maxPerUser) || 1, 20));
  const mostrar = (v) => Array.isArray(v) ? v.join(", ") : String(v);
  return (
    <div className="panel-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--tf-accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Inscripción con un clic</span>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--tf-muted)", lineHeight: 1.45 }}>
        Usaremos los datos de tu cuenta:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
        {campos.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--tf-divider)", fontSize: 14 }}>
            <span style={{ color: "var(--tf-muted)", flexShrink: 0 }}>{f.label}</span>
            <span style={{ color: "#ffffff", fontWeight: 500, textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mostrar(valores[f.id])}</span>
          </div>
        ))}
      </div>

      {maxPorPersona > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 14, color: "var(--tf-muted)" }}>Entradas</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <button type="button" aria-label="Una entrada menos" disabled={cantidad <= 1} onClick={() => setCantidad((q) => Math.max(1, q - 1))}
              style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "var(--tf-surface-2)", color: "#fff", fontSize: 18, cursor: "pointer", opacity: cantidad <= 1 ? 0.4 : 1 }}>−</button>
            <span className="ef-app-font" style={{ minWidth: 18, textAlign: "center", fontWeight: 600 }}>{cantidad}</span>
            <button type="button" aria-label="Una entrada más" disabled={cantidad >= maxPorPersona} onClick={() => setCantidad((q) => Math.min(maxPorPersona, q + 1))}
              style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "var(--tf-surface-2)", color: "#fff", fontSize: 18, cursor: "pointer", opacity: cantidad >= maxPorPersona ? 0.4 : 1 }}>+</button>
          </span>
        </div>
      )}

      <button type="button" onClick={onConfirm} disabled={busy} className="soft-btn soft-btn-primary" style={{ width: "100%" }}>
        {busy ? "Confirmando…" : event.requireApproval ? "Solicitar mi lugar" : "Confirmar mi entrada"}
      </button>
      {error && <p style={{ color: "#f87171", fontSize: 13, margin: "10px 0 0", textAlign: "center" }}>{error}</p>}
      <button type="button" onClick={onEdit} disabled={busy}
        style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "#ffffff", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", padding: 6 }}>
        Editar mis datos
      </button>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--tf-faint)", textAlign: "center", lineHeight: 1.5 }}>
        Al confirmar aceptas la <a href="/privacidad" style={{ color: "var(--tf-muted)" }}>política de privacidad</a> y que el organizador reciba estos datos.
        {event.requireApproval && " El organizador debe aprobar tu solicitud."}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PublicEventPage() {
  const { slug }                   = useParams();
  const { token, user }            = useAuth();
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
  // Color de la portada para eventos publicados ANTES de que existiera esta
  // personalización: no lo traen guardado, así que se calcula aquí una vez.
  const [colorPortada, setColorPortada] = useState(null);
  const { compartir, copiado } = useShare();
  // Inscripción con un clic (datos de la cuenta).
  const [quickBusy, setQuickBusy]   = useState(false);
  const [quickErr, setQuickErr]     = useState("");
  const [quickQty, setQuickQty]     = useState(1);

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

  // Portada sin color guardado → se analiza en el navegador (queda en caché,
  // ver dominantColorFromUrl). Los eventos nuevos ya llegan con `themeColor` y
  // no entran aquí.
  useEffect(() => {
    const img = event?.headerImage;
    if (!img || event?.themeColor) return;
    let vivo = true;
    dominantColorFromUrl(img).then(c => { if (vivo && c) setColorPortada(c); });
    return () => { vivo = false; };
  }, [event?.headerImage, event?.themeColor]);

  // La tipografía elegida por el organizador se descarga solo aquí, en su
  // evento: quien no la use no paga por ella.
  useEffect(() => { loadEventFont(event?.fontId); }, [event?.fontId]);

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
  const TEXT = "#ffffff";
  const SUB  = "rgba(229,238,255,0.5)";

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

  // El color puede venir guardado en el evento o haberse calculado aquí a
  // partir de la portada; sea cual sea, las tres pantallas del evento
  // (página, inscripción y entrada) usan el mismo.
  const colorEvento = event?.themeColor || colorPortada;

  // Con sesión iniciada, el formulario se contesta con los datos de la cuenta
  // (nombre, correo, teléfono y lo que ya dio en otros eventos). Si con eso
  // basta para todos los campos obligatorios, la inscripción es un solo clic.
  const prellenado = token && user ? prefillFromProfile(event.fields || [], user) : null;
  const puedeUnClic = Boolean(prellenado) && prellenado.missing.length === 0
    && prellenado.filled.length > 0
    && Object.keys(validateRegistrationForm(event.fields || [], prellenado.form)).length === 0;

  const inscribirUnClic = async () => {
    setQuickBusy(true); setQuickErr("");
    try {
      // El clic en "Confirmar" ES la aceptación: el texto de debajo lo dice
      // antes de pulsar, con enlace a la política (Ley 1581: consentimiento
      // previo, expreso e informado).
      await handleSubmit({ form: prellenado.form, quantity: quickQty, consentPrivacy: true, consentMarketing: false });
    } catch (e) {
      setQuickErr(e.message || "No se pudo completar la inscripción.");
    } finally {
      setQuickBusy(false);
    }
  };

  if (phase === "register") return (
    <TypeformRegister event={event} tintColor={colorEvento}
      initialForm={prellenado?.form} prefilledCount={prellenado?.filled.length || 0}
      onSubmit={handleSubmit} onBack={() => setPhase("event")} />
  );

  if (phase === "ticket") return (
    <ConfirmTicket ev={event} reg={reg} regs={regs} standalone tintColor={colorEvento}
      onCancel={handleCancel} cancelling={cancelling}
      onBack={() => { if (window.history.length > 1) window.history.back(); else window.location.href = "/app"; }} />
  );

  // Personalización del evento: el color que domina su portada y la
  // tipografía que eligió el organizador.
  const tinte     = eventTint(colorEvento);
  const fuente    = getEventFont(event.fontId);
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
      {/* Difuminado y no color plano a propósito: un verde plano detrás del
          texto lo haría ilegible y convertiría cada evento en otra
          aplicación. */}
      <EventTintLayer tinte={tinte} />
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
      {/* La tipografía elegida NO baña la página entera: se reserva para lo que
          el organizador escribe —el nombre, la fecha en palabras y lo que
          cuenta del evento—. Los datos de servicio (ubicación, organizador,
          entradas) van en la letra de la app: son de TapIn y tienen que leerse
          igual en todos los eventos. */}
      {/* Móvil: una columna de 520 px. Ordenador (desktop.css): portada fija
          a la izquierda y la información a la derecha. */}
      <div className="pe-wrap" style={{ position: "relative", zIndex: 1 }}>

        {/* ── Portada: cuadrada, con margen y esquinas suavizadas ── */}
        <div className="pe-cover-col">
          <EventCover src={event.headerImage} alt={event.title} pos={event.imagePos} zoom={event.imageZoom} />
        </div>

        {/* ── Content ── */}
        <div className="pe-content" style={{ padding: `24px ${COVER_PAD}px 0` }}>

          {/* Nombre del evento: la pieza con la letra elegida. El cuerpo y el
              peso se ajustan a ella —una display necesita menos cuerpo que una
              de texto para ocupar lo mismo—. */}
          <h1 {...eventFontProps(event.fontId, {
            extraStyle: {
              // --pe-k agranda el título en ordenador (desktop.css).
              fontSize: `calc(var(--pe-k, 1) * ${32 * fuente.headingScale}px)`, fontWeight: fuente.headingWeight,
              color: TEXT, margin: "0 0 10px", lineHeight: 1.15,
              letterSpacing: fuente.headingSpacing,
            },
          })}>
            {event.title}
          </h1>

          {/* Organizado por — con el avatar (foto) del organizador */}
          {event.hostName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Avatar name={event.hostName} src={event.hostAvatar} size={26} />
              {/* El nombre lleva a su perfil: quién es y qué más organiza. */}
              {event.hostId ? (
                <a href={`/o/${event.hostId}`} style={{ fontSize: 14, color: SUB, textDecoration: "none" }}>
                  Organizado por{" "}
                  <strong style={{ color: TEXT, fontWeight: 600, borderBottom: "1px solid rgba(229,238,255,0.35)" }}>
                    {event.hostName}
                  </strong>
                </a>
              ) : (
                <span style={{ fontSize: 14, color: SUB }}>Organizado por <strong style={{ color: TEXT, fontWeight: 600 }}>{event.hostName}</strong></span>
              )}
            </div>
          )}

          {/* Date row */}
          {startP && dateDesc && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              {/* El recuadro del día se queda con la letra de la app: es un
                  icono de calendario, no texto del evento, y tiene que verse
                  igual en todos. */}
              <DateChip dateStr={event.startDate} tinte={tinte} />
              {/* La fecha en palabras SÍ va con la letra elegida. Las tres
                  líneas van juntas: antes cada una traía su propio margen y el
                  bloque se leía como tres datos sueltos. */}
              <div {...eventFontProps(event.fontId, { extraStyle: { lineHeight: 1.32 } })}>
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
              <button onClick={() => setPhase("ticket")} style={{ width: "100%", minHeight: 52, padding: "0 16px", background: "#ffffff", color: "#000000", borderRadius: 14, fontWeight: 600, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IcoQr />
                {(regs?.length || 1) > 1 ? `Ver entradas (${regs.length})` : "Ver entrada"}
              </button>
            ) : regLoading ? (
              // Aún no se sabe si tiene entrada: placeholder neutro (mismo tamaño
              // que el botón) para no mostrar "Registrarse" por error.
              <div style={{ width: "100%", padding: "16px", background: "rgba(255,255,255,0.10)", borderRadius: 14, textAlign: "center", color: SUB, fontWeight: 700, fontSize: 15, boxSizing: "border-box" }}>
                Comprobando tu inscripción…
              </div>
            ) : soldOut ? (
              <div style={{ padding: "16px", background: "rgba(255,255,255,0.10)", borderRadius: 14, textAlign: "center", color: SUB, fontWeight: 700, fontSize: 15 }}>Entradas agotadas</div>
            ) : needsAccount ? (
              <>
                <button onClick={goToLogin} style={{ width: "100%", minHeight: 52, padding: "0 16px", background: "var(--tf-accent)", color: "var(--tf-on-accent)", borderRadius: 14, fontWeight: 600, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "-0.01em" }}>
                  Inicia sesión para solicitar tu lugar
                </button>
                <p style={{ margin: "10px 0 0", fontSize: 12.5, color: SUB, textAlign: "center", lineHeight: 1.5 }}>
                  Este evento requiere aprobación del organizador. Necesitas una cuenta
                  para seguir el estado de tu entrada.
                </p>
              </>
            ) : puedeUnClic ? (
              <QuickRegister
                event={event}
                campos={(event.fields || []).filter((f) => prellenado.filled.includes(f.id))}
                valores={prellenado.form}
                cantidad={quickQty} setCantidad={setQuickQty}
                busy={quickBusy} error={quickErr}
                onConfirm={inscribirUnClic}
                onEdit={() => setPhase("register")}
              />
            ) : (
              <>
                <button onClick={() => setPhase("register")} style={{ width: "100%", minHeight: 52, padding: "0 16px", background: "var(--tf-accent)", color: "var(--tf-on-accent)", borderRadius: 14, fontWeight: 600, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: "-0.01em" }}>
                  {event.requireApproval ? "Solicitar mi lugar" : "Registrarse"}
                </button>
                {prellenado && prellenado.filled.length > 0 && (
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, color: SUB, textAlign: "center", lineHeight: 1.5 }}>
                    Ya completamos {prellenado.filled.length} {prellenado.filled.length === 1 ? "dato" : "datos"} con tu cuenta; solo falta lo demás.
                  </p>
                )}
                {event.requireApproval && (
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, color: SUB, textAlign: "center", lineHeight: 1.5 }}>
                    El organizador debe aprobar tu solicitud. Tu QR se activará cuando lo haga.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Lo que el organizador cuenta de su evento: con su letra, rótulo
              incluido. Es su voz, no la de la app. */}
          {event.eventDescription && (
            <div {...eventFontProps(event.fontId, { extraStyle: { marginBottom: 28 } })}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Acerca del evento</p>
              <p style={{ margin: 0, color: "rgba(229,238,255,0.8)", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                {event.eventDescription}
              </p>
            </div>
          )}

          {/* Ubicación: nombre del sitio, ciudad debajo y el mapa. El mapa
              ES el botón: al tocarlo se elige la app de navegación. */}
          {(locName || hasCoords) && (
            <div style={{ marginBottom: 28, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Ubicación</p>
              <div style={{ lineHeight: 1.32, marginBottom: hasCoords ? 14 : 0 }}>
                {locName && <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: TEXT }}>{locName}</p>}
                {event.city && <p style={{ margin: 0, fontSize: 13.5, color: SUB }}>{event.city}</p>}
                {event.locationInstructions && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: SUB }}>{event.locationInstructions}</p>
                )}
              </div>
              {hasCoords && <LocationMap lat={event.lat} lng={event.lng} label={locName} height={190} />}
            </div>
          )}

          {/* ── Quién va ──
              Va DEBAJO de la ubicación porque es el último dato que empuja a
              decidir: ya sabes qué es, cuándo y dónde; falta saber con quién.
              De quien se inscribió sin cuenta solo se muestra su inicial. */}
          {event.registrationCount > 0 && (
            <div style={{ marginBottom: 28, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em" }}>Quién va</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <AttendeeStack
                  personas={event.attendeePreview || []}
                  gente={event.registrationCount}
                  size={38}
                  texto={false}
                />
                <span style={{ fontSize: 14, color: "rgba(229,238,255,0.8)" }}>
                  {event.registrationCount === 1
                    ? "1 persona ya tiene su lugar"
                    : `${event.registrationCount} personas ya tienen su lugar`}
                </span>
              </div>
            </div>
          )}

          {/* Contactar: mismo relleno y forma que "Ver entrada", compacto. */}
          {event.hostEmail && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20, marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <a href={`mailto:${event.hostEmail}?subject=${encodeURIComponent("Consulta: " + event.title)}`}
                className="ef-hover-fill"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                  textDecoration: "none", color: "#ffffff",
                  background: "var(--tf-surface-2)", border: "none",
                  borderRadius: 14, padding: "12px 18px", fontSize: 15, fontWeight: 500,
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
