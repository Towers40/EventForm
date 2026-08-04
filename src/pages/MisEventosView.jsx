import { useState } from "react";
import { isSoldOut, capacityLabel } from "../lib/capacity.js";
import { groupRegistrations } from "../lib/tickets.js";
import "../styles/typeform.css";

function statusOf(ev) {
  const dateStr = ev.startDate || ev.date;
  if (!dateStr) return "activo";
  const d = new Date(dateStr + "T12:00:00");
  return d < new Date() ? "pasado" : "activo";
}

export default function MisEventosView({ events, loading, error, onRetry, onNew, onOpen, onEdit, onValidate, onDelete, onShare, onToggleSoldOut }) {
  const [tab, setTab] = useState("todos");

  // Los borradores ya no tienen pestaña propia: aparecen dentro de "Todos" con
  // su tarjeta de borrador, para que un evento a medio crear no quede oculto.
  const borradores = events.filter(e => e.isDraft);
  const proximos   = events.filter(e => statusOf(e) === "activo" && !e.isDraft);
  const pasados    = events.filter(e => statusOf(e) === "pasado" && !e.isDraft);
  const todos      = [...borradores, ...proximos, ...pasados];

  const lista = tab === "proximos" ? proximos
    : tab === "pasados"  ? pasados
    : todos;

  const FILTERS = [
    { key: "todos",    label: "Todos",    count: todos.length },
    { key: "proximos", label: "Próximos", count: proximos.length },
    { key: "pasados",  label: "Pasados",  count: pasados.length },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto" }}>
      <style>{GRID_CSS}</style>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 18px", color: "#e8eaf0", textAlign: "center" }}>Mis eventos</h1>
      {/* Los bloques de estado no se estiran a 1240 px: un mensaje centrado en
          una franja tan ancha queda desangelado. */}

      {/* Filtros centrados, siempre en una sola línea (móvil y escritorio) */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "nowrap", gap: 4, marginBottom: 24 }}>
        {FILTERS.map(f => {
          const active = tab === f.key;
          return (
            <button key={f.key} type="button" className="ef-hover-fill" onClick={() => setTab(f.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                fontSize: 13, fontWeight: active ? 700 : 600, whiteSpace: "nowrap",
                background: "transparent", border: "none",
                color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
              }}>
              {f.label}
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.38)" }}>{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* Cargando y error se distinguen del vacío: antes un fallo del API se
          veía igual que "no tienes eventos" y parecía que se perdieron. */}
      {loading && events.length === 0 ? (
        <div className="panel-card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "#8fa3b1", fontSize: 15, margin: 0 }}>Cargando tus eventos…</p>
        </div>
      ) : error && events.length === 0 ? (
        <div className="panel-card" style={{ padding: "40px 24px", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "#fca5a5", fontSize: 15, margin: "0 0 6px", fontWeight: 700 }}>No se pudieron cargar tus eventos</p>
          <p style={{ color: "#8fa3b1", fontSize: 13.5, margin: "0 0 20px" }}>{error}</p>
          <button type="button" className="soft-btn soft-btn-primary" onClick={onRetry}>Reintentar</button>
        </div>
      ) : lista.length === 0 ? (
        <div className="panel-card" style={{ padding: "48px 24px", textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <p style={{ color: "#8fa3b1", fontSize: 15, margin: 0 }}>
            {tab === "proximos" ? "No tienes eventos próximos."
              : tab === "pasados" ? "No tienes eventos pasados."
              : "No tienes eventos publicados."}
          </p>
          {tab !== "pasados" && (
            <button type="button" className="soft-btn soft-btn-primary" onClick={onNew} style={{ marginTop: 20 }}>
              Crear mi primer evento
            </button>
          )}
        </div>
      ) : (
        <div className="ef-mis-eventos">
          {lista.map(ev => (
            ev.isDraft
              ? <DraftCard key={ev.id} ev={ev} onEdit={() => onEdit(ev)} onDelete={() => onDelete(ev.id)} />
              : <EventCard
                  key={ev.id} ev={ev}
                  onOpen={(filtro) => onOpen(ev.id, filtro)} onEdit={() => onEdit(ev)}
                  onValidate={() => onValidate(ev.id)} onDelete={() => onDelete(ev.id)}
                  onShare={() => onShare(ev)} onToggleSoldOut={(v) => onToggleSoldOut(ev.id, v)}
                />
          ))}
        </div>
      )}
    </div>
  );
}

// Rejilla de eventos. En escritorio la columna única de 760 px desperdiciaba
// media pantalla; ahora se reparten en dos, tres o cuatro columnas según el
// ancho. `align-items: start` evita que una tarjeta desplegada estire a sus
// vecinas.
const GRID_CSS = `
.ef-mis-eventos {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  align-items: start;
  max-width: 760px;
  margin: 0 auto;
}
@media (min-width: 820px) {
  .ef-mis-eventos { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: none; }
}
@media (min-width: 1180px) {
  .ef-mis-eventos { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1560px) {
  .ef-mis-eventos { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
`;

function fmtDate(dateStr) {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function EventCard({ ev, onOpen, onEdit, onValidate, onDelete, onShare, onToggleSoldOut }) {
  const [expanded, setExpanded] = useState(false);
  const regs = ev.registrations || [];
  const checkins = regs.filter(r => r.used).length;
  const grupos = groupRegistrations(ev, regs);
  // Personas (no entradas) con alguna solicitud sin aprobar.
  const porAprobar = grupos.filter(g => g.pendientes > 0);
  const sold = isSoldOut(ev);
  const isPast = statusOf(ev) === "pasado";

  const startLabel = fmtDate(ev.startDate);
  const endLabel = ev.endDate && ev.endDate !== ev.startDate ? fmtDate(ev.endDate) : null;
  const dateLabel = startLabel
    ? (endLabel ? `${startLabel} → ${endLabel}` : startLabel)
    : (ev.date || null);

  return (
    <div className="panel-card" style={{ overflow: "hidden" }}>
      {/* Cover image */}
      {ev.headerImage ? (
        <div style={{ width: "100%", aspectRatio: "16/7", overflow: "hidden", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
          <img src={ev.headerImage} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ev.imagePos?.x ?? 50}% ${ev.imagePos?.y ?? 50}%`, display: "block" }} />
        </div>
      ) : ev.coverNeedsMigration ? (
        // La portada estaba guardada dentro del evento y no se envía (hacía
        // que la lista pesara megas). Se sube sola en las próximas cargas.
        <div style={{ width: "100%", aspectRatio: "16/7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(135deg,#1a2540,#0d1520)", color: "rgba(232,234,240,0.5)", fontSize: 12, textAlign: "center", padding: "0 20px" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 20"/></svg>
          Optimizando la portada…
        </div>
      ) : (
        <div style={{ width: "100%", height: 6, background: "linear-gradient(90deg, #0d3b66, #1a5f8a)" }} />
      )}

      {/* Header del evento */}
      <div style={{ padding: "16px 20px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                background: isPast ? "rgba(220,38,38,0.15)" : sold ? "rgba(220,38,38,0.15)" : "rgba(52,199,89,0.15)",
                color: isPast ? "#fca5a5" : sold ? "#fca5a5" : "#86efac",
              }}>
                {isPast ? "Pasado" : sold ? "Sold out" : "Activo"}
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0", margin: "0 0 4px", lineHeight: 1.3 }}>
              {ev.title}
            </h3>
            {dateLabel && (
              <p style={{ fontSize: 12, color: "#6b9fd4", margin: "0 0 2px", fontWeight: 600 }}>📅 {dateLabel}</p>
            )}
            {ev.city && <p style={{ fontSize: 12, color: "#8fa3b1", margin: 0 }}>📍 {ev.city}</p>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#6b9fd4" }}>{regs.length}</div>
            <div style={{ fontSize: 11, color: "#8fa3b1", fontWeight: 700 }}>inscritos</div>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "rgba(232,234,240,0.5)" }}>✓ {checkins} check-ins</span>
          <span style={{ fontSize: 12, color: "rgba(232,234,240,0.5)" }}>{capacityLabel(ev)}</span>
        </div>
      </div>

      {/* Barra de progreso de aforo */}
      {ev.capacity && regs.length > 0 && (() => {
        const maxMap = { "0-50": 50, "50-100": 100, "100-300": 300, "300+": 999 };
        const max = maxMap[ev.capacity];
        if (!max) return null;
        const pct = Math.min(100, Math.round((regs.length / max) * 100));
        return (
          <div style={{ height: 3, background: "rgba(255,255,255,0.08)", margin: "0 20px" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#ef4444" : "#6b9fd4", transition: "width 0.3s" }} />
          </div>
        );
      })()}

      {/* Aviso de solicitudes por aprobar: lleva directo a la lista filtrada,
          que es lo que el anfitrión quiere hacer al verlo. */}
      {porAprobar.length > 0 && (
        <button type="button" className="ef-hover-fill" onClick={() => onOpen("pendientes")}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            padding: "12px 20px", border: "none", cursor: "pointer",
            borderTop: "1px solid rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.1)", color: "#fbbf24",
          }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
            {porAprobar.length} {porAprobar.length === 1 ? "solicitud" : "solicitudes"} por aprobar
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>
              Su QR no funciona hasta que las apruebes
            </span>
          </span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {/* Acciones — centradas */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 12, padding: "8px 14px" }} onClick={() => onOpen()}>
          Inscritos
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" title="Compartir" aria-label="Compartir" style={{ fontSize: 12, padding: "8px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center" }} onClick={onShare}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={onValidate}>
          Verificar
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></svg>
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onEdit}>
          Editar
        </button>
        <button type="button"
          className="soft-btn ef-hover-fill"
          style={{ fontSize: 12, padding: "8px 14px", background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10 }}
          onClick={onDelete}
        >
          Eliminar
        </button>
      </div>

      {/* Lista de últimos inscritos */}
      {expanded && regs.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "0 20px 16px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 10px" }}>
            Últimos inscritos
          </p>
          {/* Una línea por PERSONA con su número de entradas: antes quien
              reservaba 3 aparecía tres veces con el mismo nombre. */}
          {grupos.slice(0, 10).map(g => (
            <div key={g.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>{g.name}</span>
                {g.total > 1 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6b9fd4", marginLeft: 7, background: "rgba(107,159,212,0.16)", padding: "2px 7px", borderRadius: 100 }}>
                    ×{g.total}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "#8fa3b1", marginLeft: 8 }}>{new Date(g.ts).toLocaleString("es-CO")}</span>
              </div>
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                background: g.pendientes ? "rgba(251,191,36,0.16)" : g.usadas ? "rgba(107,159,212,0.25)" : "rgba(52,199,89,0.15)",
                color: g.pendientes ? "#fbbf24" : g.usadas ? "#6b9fd4" : "#86efac" }}>
                {g.pendientes ? "POR APROBAR" : g.usadas === g.total ? "CHECK-IN" : g.usadas ? `${g.usadas}/${g.total}` : "ACTIVO"}
              </span>
            </div>
          ))}
          {grupos.length > 10 && (
            <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, marginTop: 12, width: "100%" }} onClick={() => onOpen()}>
              Ver los {grupos.length} inscritos →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DraftCard({ ev, onEdit, onDelete }) {
  const fields = ev.fields || [];
  return (
    <div className="panel-card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 20px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: "#fef3c7", color: "#92400e", display: "inline-block", marginBottom: 8 }}>
          Borrador — sin publicar
        </span>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0", margin: "0 0 4px" }}>
          {ev.title || "Sin título"}
        </h3>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: 0 }}>
          {fields.length} campo{fields.length !== 1 ? "s" : ""} configurado{fields.length !== 1 ? "s" : ""}
          {ev.city ? ` · ${ev.city}` : ""}
        </p>
      </div>
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
        <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 13 }} onClick={onEdit}>
          Continuar editando →
        </button>
        <button type="button" className="soft-btn ef-hover-fill" style={{ fontSize: 13, background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10 }} onClick={onDelete}>
          Descartar
        </button>
      </div>
    </div>
  );
}
