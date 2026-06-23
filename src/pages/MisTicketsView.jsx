import { useState, useEffect } from "react";
import { api, apiEnabled } from "../lib/api.js";
import { loadEvents } from "../lib/storage.js";
import { useAuth } from "../context/AuthContext.jsx";
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
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(id)}&bgcolor=1a1c1e&color=e8eaf0&margin=12`;
}

export default function MisTicketsView({ onHome }) {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("proximos");
  const [openQr, setOpenQr] = useState(null);

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
              <div key={slug} className="panel-card" style={{ padding: 0, overflow: "hidden" }}>
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
                  <button type="button" onClick={() => setOpenQr(openQr === slug ? null : slug)}
                    style={{ flexShrink: 0, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(107,159,212,0.3)", borderRadius: 12, padding: "8px 10px", color: "#c8dff0", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 21v.01M21 14v.01M14 21v.01"/></svg>
                    QR
                  </button>
                </div>
                {openQr === slug && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 20, textAlign: "center", background: "rgba(0,0,0,0.2)" }}>
                    <img src={qrFor(id)} alt="QR de acceso" style={{ width: 200, height: 200, borderRadius: 14, background: "#1a1c1e" }} />
                    <p style={{ fontSize: 12, color: "rgba(232,234,240,0.5)", margin: "12px 0 4px" }}>Presenta este QR en la entrada. Solo permite un ingreso.</p>
                    <p style={{ fontFamily: "monospace", fontSize: 13, color: "#c8dff0", margin: 0 }}>{id}</p>
                    <a href={`/e/${slug}`} className="soft-btn soft-btn-secondary" style={{ display: "inline-block", marginTop: 14, textDecoration: "none", fontSize: 13 }}>Ver evento</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
