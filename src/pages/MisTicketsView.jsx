import { useState, useEffect, useRef } from "react";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { useAuth } from "../context/AuthContext.jsx";
import TicketWallet from "../components/TicketWallet.jsx";
import "../styles/typeform.css";
import { coverImgStyle } from "../lib/images.js";

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

export default function MisTicketsView() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("proximos");
  // Evento cuyo ticket electrónico está abierto a pantalla completa.
  const [openQr, setOpenQr] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null); // { id, slug }
  const [cancelling, setCancelling] = useState(false);
  const cleanupRef = useRef(null); // corta el sondeo de entradas pendientes

  const doCancel = async () => {
    if (!confirmCancel) return;
    const { id, slug } = confirmCancel;
    setCancelling(true);
    try {
      if (apiEnabled) await api.cancelRegistration(id);
      const quedan = tickets.filter(t => t.id !== id && (t.slug || t.event?.slug) === slug);
      try {
        // Con varias entradas del mismo evento, la caché local solo se borra
        // cuando se cancela la última: si no, desaparecerían todas de golpe.
        const key = `ef_ticket_${slug}`;
        if (!quedan.length) localStorage.removeItem(key);
        else {
          const saved = JSON.parse(localStorage.getItem(key) || "null");
          if (saved) {
            const all = (saved._all || []).filter(r => r.id !== id);
            localStorage.setItem(key, JSON.stringify({ ...saved, ...(saved.id === id ? all[0] : {}), _all: all }));
          }
        }
      } catch { /* noop */ }
      setTickets(prev => prev.filter(t => t.id !== id));
      if (!quedan.length) setOpenQr(null);
      setConfirmCancel(null);
    } catch (e) {
      alert("No se pudo cancelar: " + (e?.message || "error"));
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    let stop = false;

    const load = async () => {
      const byId = new Map();

      // 1) Entradas vinculadas a la cuenta (cruce por email en el servidor) —
      //    funcionan en cualquier dispositivo.
      if (apiEnabled && token) {
        try {
          const { tickets: serverTickets } = await api.myTickets(token);
          for (const t of serverTickets || []) {
            byId.set(t.id, {
              slug: t.event?.slug, id: t.id, used: t.used,
              approved: t.approved !== false,
              paid: Boolean(t.paid), resale: t.resale || "none",
              event: t.event || { title: "Evento", slug: t.event?.slug },
            });
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
        byId.set(reg.id, { slug, id: reg.id, used: Boolean(reg.used), approved: reg.approved !== false, event: event || { title: "Evento", slug } });
      }));

      if (stop) return;
      const list = Array.from(byId.values());
      setTickets(list);
      setLoading(false);
      return list;
    };

    load().then(list => {
      // Con alguna entrada pendiente de aprobación se refresca sola: así el QR
      // se activa sin que la persona tenga que recargar la app.
      if (stop || !list?.some(t => t.approved === false)) return;
      const tick = setInterval(() => { if (!stop) load(); }, 20000);
      const onFocus = () => { if (!stop) load(); };
      window.addEventListener("focus", onFocus);
      cleanupRef.current = () => { clearInterval(tick); window.removeEventListener("focus", onFocus); };
    });

    return () => { stop = true; cleanupRef.current?.(); cleanupRef.current = null; };
  }, [token]);

  // Las entradas del MISMO evento van juntas en una tarjeta: quien reservó 3
  // no ve tres filas repetidas, sino una con las tres pasables a los lados.
  const grupos = (() => {
    const porEvento = new Map();
    for (const t of tickets) {
      const clave = t.slug || t.event?.slug || t.id;
      if (!porEvento.has(clave)) porEvento.set(clave, { key: clave, slug: t.slug, event: t.event, items: [] });
      porEvento.get(clave).items.push({ id: t.id, used: t.used, approved: t.approved !== false, paid: Boolean(t.paid), resale: t.resale || "none" });
    }
    return Array.from(porEvento.values());
  })();

  const proximos = grupos.filter(g => !isPast(g.event));
  const pasados  = grupos.filter(g => isPast(g.event));
  const usados   = tickets.filter(t => t.used).length;
  const lista    = tab === "proximos" ? proximos : pasados;

  return (
    <div className="tickets">
      {/* Inicio ya vive en el encabezado (icono de casa en móvil, texto en escritorio). */}
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 18px", color: "#ffffff" }}>Mis tickets</h1>

      {/* Resumen */}
      <div className="panel-card" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 22 }}>
        {[
          { label: "Total", value: tickets.length },
          { label: "Próximos", value: proximos.length },
          { label: "QR usados", value: usados },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: "18px 8px 16px", textAlign: "center", borderLeft: i ? "1px solid var(--tf-divider)" : "none" }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: "#ffffff" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--tf-muted)", marginTop: 8 }}>{s.label}</div>
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
            className="ef-hover-fill"
            style={{
              height: 40, padding: "0 16px", borderRadius: 999, cursor: "pointer",
              fontSize: 14.5, fontWeight: 500, whiteSpace: "nowrap",
              background: tab === t.key ? "#ffffff" : "transparent",
              border: tab === t.key ? "1px solid #ffffff" : "1px solid rgba(229,238,255,0.24)",
              color: tab === t.key ? "#000000" : "#ffffff",
            }}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "rgba(229,238,255,0.5)", fontSize: 14, textAlign: "center", padding: 40 }}>Cargando tus tickets…</p>
      ) : lista.length === 0 ? (
        <div className="panel-card" style={{ padding: "44px 24px", textAlign: "center" }}>
          <p style={{ color: "#8fa3b1", fontSize: 15, margin: 0 }}>
            {tab === "proximos" ? "No tienes eventos próximos a los que te hayas registrado." : "No hay eventos pasados en tu historial."}
          </p>
          <a href="/discover" className="soft-btn soft-btn-primary" style={{ marginTop: 20, textDecoration: "none" }}>Descubrir eventos</a>
        </div>
      ) : (
        <div className="tickets-lista">
          {lista.map((grupo) => {
            const { key, slug, event, items } = grupo;
            const past = isPast(event);
            const varias = items.length > 1;
            const pendientes = items.filter(i => !i.approved).length;
            const usadas = items.filter(i => i.used).length;
            return (
              // Toda la tarjeta abre el ticket electrónico a pantalla completa.
              <button key={key} type="button" className="panel-card ef-hover-fill" onClick={() => setOpenQr(key)}
                aria-label={`Abrir entrada de ${event.title || "evento"}`}
                style={{ padding: 0, overflow: "hidden", border: "none", textAlign: "left", cursor: "pointer", color: "inherit", width: "100%", display: "block" }}>
                <div style={{ display: "flex", gap: 14, padding: 16, alignItems: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0, overflow: "hidden", background: "rgba(52,211,153,0.18)" }}>
                    {event.headerImage && <img src={event.headerImage} alt="" style={coverImgStyle(event.imagePos, event.imageZoom)} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title || "Evento"}</div>
                    <div style={{ fontSize: 12.5, color: "rgba(229,238,255,0.55)", marginTop: 1, lineHeight: 1.32 }}>{fmt(event.startDate || event.date)}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: past ? "rgba(220,38,38,0.18)" : "rgba(52,211,153,0.16)", color: past ? "#fca5a5" : "#6ee7b7" }}>{past ? "Pasado" : "Próximo"}</span>
                      {varias && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(52,211,153,0.2)", color: "#a7f3d0" }}>{items.length} entradas</span>}
                      {pendientes > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(251,191,36,0.16)", color: "#fbbf24" }}>Sujeto a aprobación</span>}
                      {usadas > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: "rgba(52,211,153,0.2)", color: "#a7f3d0" }}>{varias ? `${usadas} usada${usadas === 1 ? "" : "s"}` : "QR usado"}</span>}
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ flexShrink: 0, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "8px 10px", color: "#ffffff", fontSize: 11, fontWeight: 600 }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 21v.01M21 14v.01M14 21v.01"/></svg>
                    {varias ? `${items.length} QR` : "QR"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirmación de cancelación */}
      {confirmCancel && (
        <div onClick={() => !cancelling && setConfirmCancel(null)}
          style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "var(--tf-sheet)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 22, padding: 24, textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(248,113,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 500, color: "#ffffff", margin: "0 0 8px" }}>
              {confirmCancel.varias ? "¿Cancelar esta entrada?" : "¿Estás seguro que quieres cancelar tu participación?"}
            </h3>
            <p style={{ fontSize: 13.5, color: "rgba(229,238,255,0.6)", margin: "0 0 22px", lineHeight: 1.5 }}>
              {confirmCancel.varias
                ? "Solo se anula esta entrada; las demás que reservaste siguen activas y su lugar se libera para otra persona."
                : "Tu entrada quedará anulada y perderás tu lugar en este evento."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill" onClick={() => setConfirmCancel(null)} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.18)", color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                No, volver
              </button>
              <button type="button" className="ef-hover-fill" onClick={doCancel} disabled={cancelling}
                style={{ flex: 1, padding: 13, borderRadius: 14, background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.45)", color: "#fca5a5", fontWeight: 800, fontSize: 14, cursor: cancelling ? "not-allowed" : "pointer" }}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket electrónico a pantalla completa */}
      {(() => {
        const g = openQr && grupos.find((x) => x.key === openQr);
        if (!g) return null;
        return (
          <TicketWallet
            grupo={g}
            token={token}
            onClose={() => setOpenQr(null)}
            onCancel={(id) => setConfirmCancel({ id, slug: g.slug, varias: g.items.length > 1 })}
            onResaleChange={(id, estado) => setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, resale: estado } : t)))}
          />
        );
      })()}
    </div>
  );
}
