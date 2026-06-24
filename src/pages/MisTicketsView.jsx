import { useState, useEffect } from "react";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { useAuth } from "../context/AuthContext.jsx";
import SlideToCancel from "../components/SlideToCancel.jsx";
import "../styles/typeform.css";

const DAYS_ES   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fmt(dateStr) {
  if (!dateStr) return "Fecha por confirmar";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y) return "Fecha por confirmar";
  const dt = new Date(y, m - 1, d);
  return `${DAYS_ES[dt.getDay()]}, ${d} ${MONTHS_ES[m - 1]} ${y}`;
}

function isPast(ev) {
  const ds = ev?.startDate || ev?.date;
  if (!ds) return false;
  return new Date(ds + "T23:59:59") < new Date();
}

function qrFor(id) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(id)}&bgcolor=ffffff&color=000000&margin=12&qzone=2`;
}

export default function MisTicketsView({ onHome }) {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("proximos");
  const [openQr, setOpenQr] = useState(null);
  const [eventModal, setEventModal] = useState(null); // { slug, event, loading }
  const [confirmCancel, setConfirmCancel] = useState(null); // { id, slug }
  const [cancelling, setCancelling] = useState(false);

  const doCancel = async () => {
    if (!confirmCancel) return;
    const { id, slug } = confirmCancel;
    setCancelling(true);
    try {
      if (apiEnabled) await api.cancelRegistration(id);
      try { localStorage.removeItem(`ef_ticket_${slug}`); } catch { /* noop */ }
      setTickets(prev => prev.filter(t => t.id !== id));
      setOpenQr(null);
      setConfirmCancel(null);
    } catch (e) {
      alert("No se pudo cancelar: " + (e?.message || "error"));
    } finally {
      setCancelling(false);
    }
  };

  const openEvent = async (slug, fallback) => {
    setEventModal({ slug, event: fallback, loading: apiEnabled });
    if (apiEnabled) {
      try {
        const { event } = await api.publicEvent(slug);
        setEventModal({ slug, event, loading: false });
      } catch {
        setEventModal({ slug, event: fallback, loading: false });
      }
    }
  };

  useEffect(() => {
    (async () => {
      const byId = new Map();

      // 1) Entradas vinculadas a la cuenta (cruce por email en el servidor) —
      //    funcionan en cualquier dispositivo.
      if (apiEnabled && token) {
        try {
          const { tickets: serverTickets } = await api.myTickets(token);
          for (const t of serverTickets || []) {
            byId.set(t.id, { slug: t.event?.slug, id: t.id, used: t.used, event: t.event || { title: "Evento", slug: t.event?.slug } });
          }
        } catch { /* sigue con las locales */ }
      }

      // 2) Entradas guardadas en este dispositivo (ef_ticket_<slug>).
      const entries = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("ef_ticket_")) continue;
        const slug = key.slice("ef_ticket_".length);
        try {
          const reg = JSON.parse(localStorage.getItem(key));
          if (reg && !reg.cancelled && !byId.has(reg.id)) entries.push({ slug, reg });
        } catch { /* ignorar */ }
      }

      await Promise.all(entries.map(async ({ slug, reg }) => {
        let event = reg._event || null;
        try {
          if (apiEnabled) {
            const { event: ev } = await api.publicEvent(slug);
            event = ev;
          } else {
            event = loadEvents().find(e => e.slug === slug) || event;
          }
        } catch { /* usa snapshot si falla */ }
        byId.set(reg.id, { slug, id: reg.id, used: Boolean(reg.used), event: event || { title: "Evento", slug } });
      }));

      setTickets(Array.from(byId.values()));
      setLoading(false);
    })();
  }, [token]);

  const proximos = tickets.filter(t => !isPast(t.event));
  const pasados  = tickets.filter(t => isPast(t.event));
  const usados   = tickets.filter(t => t.used).length;
  const lista    = tab === "proximos" ? proximos : pasados;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {onHome && (
        <button type="button" onClick={onHome} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(107,159,212,0.25)", borderRadius: 10, color: "#c8dff0", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 14px", marginBottom: 16 }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
          Inicio
        </button>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 20px", color: "#e8eaf0" }}>Mis tickets</h1>

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Total", value: tickets.length },
          { label: "Próximos", value: proximos.length },
          { label: "QR usados", value: usados },
        ].map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#c8dff0" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "rgba(232,234,240,0.55)", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "proximos", label: `Próximos (${proximos.length})` },
          { key: "pasados",  label: `Historial (${pasados.length})` },
        ].map(t => (
          <button key={t.key} type="button"
            className={`soft-btn ${tab === t.key ? "soft-btn-primary" : "soft-btn-secondary"}`}
            style={{ fontSize: 13, padding: "10px 18px" }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "rgba(232,234,240,0.5)", fontSize: 14, textAlign: "center", padding: 40 }}>Cargando tus tickets…</p>
      ) : lista.length === 0 ? (
        <div className="panel-card" style={{ padding: "44px 24px", textAlign: "center" }}>
          <p style={{ color: "#8fa3b1", fontSize: 15, margin: 0 }}>
            {tab === "proximos" ? "No tienes eventos próximos a los que te hayas registrado." : "No hay eventos pasados en tu historial."}
          </p>
          <a href="/discover" className="soft-btn soft-btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>Descubrir eventos</a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(({ slug, id, used, event }) => {
            const past = isPast(event);
            return (
              <div key={id} className="panel-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0, overflow: "hidden", background: "rgba(107,159,212,0.18)" }}>
                    {event.headerImage && <img src={event.headerImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#e8eaf0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title || "Evento"}</div>
                    <div style={{ fontSize: 12.5, color: "rgba(232,234,240,0.55)", marginTop: 2 }}>{fmt(event.startDate || event.date)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: past ? "rgba(220,38,38,0.18)" : "rgba(52,199,89,0.16)", color: past ? "#fca5a5" : "#5ee07f" }}>{past ? "Pasado" : "Próximo"}</span>
                      {used && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(107,159,212,0.2)", color: "#c8dff0" }}>QR usado</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setOpenQr(openQr === id ? null : id)}
                    style={{ flexShrink: 0, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, background: openQr === id ? "rgba(107,159,212,0.22)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(107,159,212,0.3)", borderRadius: 12, padding: "8px 10px", color: "#c8dff0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 21v.01M21 14v.01M14 21v.01"/></svg>
                    QR
                  </button>
                </div>
                {openQr === id && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 20, textAlign: "center", background: "rgba(0,0,0,0.2)" }}>
                    <img src={qrFor(id)} alt="QR de acceso" style={{ width: 220, height: 220, borderRadius: 14, background: "#fff", padding: 8 }} />
                    <p style={{ fontSize: 12, color: "rgba(232,234,240,0.5)", margin: "12px 0 4px" }}>Presenta este QR en la entrada. Solo permite un ingreso.</p>
                    <p style={{ fontFamily: "monospace", fontSize: 13, color: "#c8dff0", margin: 0 }}>{id}</p>
                    <button type="button" onClick={() => openEvent(slug, event)} className="soft-btn soft-btn-secondary" style={{ marginTop: 14, fontSize: 13 }}>Ver evento</button>
                    {!past && (
                      <div style={{ marginTop: 16, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
                        <SlideToCancel onComplete={() => setConfirmCancel({ id, slug })} disabled={cancelling && confirmCancel?.id === id} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmación de cancelación */}
      {confirmCancel && (
        <div onClick={() => !cancelling && setConfirmCancel(null)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 24, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", margin: "0 0 8px" }}>¿Estás seguro que quieres cancelar tu participación?</h3>
            <p style={{ fontSize: 13.5, color: "rgba(232,234,240,0.6)", margin: "0 0 22px", lineHeight: 1.5 }}>Tu entrada quedará anulada y perderás tu lugar en este evento.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setConfirmCancel(null)} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "#e8eaf0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                No, volver
              </button>
              <button type="button" onClick={doCancel} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 12, background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.45)", color: "#fca5a5", fontWeight: 800, fontSize: 14, cursor: cancelling ? "not-allowed" : "pointer" }}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de información del evento (X regresa al QR desplegado) */}
      {eventModal && (
        <div onClick={() => setEventModal(null)}
          style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ position: "relative" }}>
              {eventModal.event?.headerImage
                ? <img src={eventModal.event.headerImage} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                : <div style={{ width: "100%", aspectRatio: "16/7", background: "linear-gradient(135deg, #0d3b66, #1a5f8a)" }} />}
              <button type="button" onClick={() => setEventModal(null)} aria-label="Cerrar"
                style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.5)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#e8eaf0", margin: "0 0 10px" }}>{eventModal.event?.title || "Evento"}</h2>
              <p style={{ fontSize: 14, color: "#c8dff0", margin: "0 0 6px", fontWeight: 600 }}>{fmt(eventModal.event?.startDate || eventModal.event?.date)}</p>
              {(eventModal.event?.city || eventModal.event?.location) && (
                <p style={{ fontSize: 13.5, color: "rgba(232,234,240,0.6)", margin: "0 0 14px" }}>
                  {[eventModal.event?.location, eventModal.event?.city].filter(Boolean).join(" — ")}
                </p>
              )}
              {eventModal.loading && <p style={{ fontSize: 13, color: "rgba(232,234,240,0.5)" }}>Cargando detalles…</p>}
              {eventModal.event?.eventDescription && (
                <p style={{ fontSize: 14, color: "rgba(232,234,240,0.8)", lineHeight: 1.55, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{eventModal.event.eventDescription}</p>
              )}
              <a href={`/e/${eventModal.slug}`} className="soft-btn soft-btn-primary" style={{ display: "inline-block", textDecoration: "none", fontSize: 13 }}>Abrir página del evento</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
