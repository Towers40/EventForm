import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSoldOut, capacityLabel, getCapacityMax } from "../lib/capacity.js";
import { groupRegistrations } from "../lib/tickets.js";
import { DataRow, IcoCalendar, IcoPin } from "../components/ui.jsx";
import "../styles/typeform.css";
import { coverImgStyle } from "../lib/images.js";

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
    <div style={{ maxWidth: 1560, margin: "0 auto" }}>
      <style>{GRID_CSS}</style>
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 18px", color: "#ffffff" }}>Mis eventos</h1>
      {/* Los bloques de estado no se estiran a 1240 px: un mensaje centrado en
          una franja tan ancha queda desangelado. */}

      {/* Filtros: control segmentado en píldoras (activo relleno claro, el
          resto con contorno), siempre en una sola línea. */}
      <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, marginBottom: 24, overflowX: "auto" }}>
        {FILTERS.map(f => {
          const active = tab === f.key;
          return (
            <button key={f.key} type="button" className="ef-hover-fill" onClick={() => setTab(f.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 40, padding: "0 16px", borderRadius: 999, cursor: "pointer",
                fontSize: 14.5, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0,
                background: active ? "#ffffff" : "transparent",
                border: active ? "1px solid #ffffff" : "1px solid rgba(229,238,255,0.24)",
                color: active ? "#000000" : "#ffffff",
              }}>
              {f.label}
              <span style={{ fontSize: 13, fontWeight: 500, color: active ? "rgba(0,0,0,0.55)" : "var(--tf-muted)" }}>{f.count}</span>
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
  grid-template-columns: minmax(0, 1fr);
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
@media (min-width: 1400px) {
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
  // Tocar la portada o los datos lleva a la página del evento (antes
  // desplegaba "Últimos inscritos"; esa lista vive en el botón Inscritos).
  const nav = useNavigate();
  const abrirEvento = () => { if (ev.slug) nav(`/e/${ev.slug}`); };
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
        <div style={{ width: "100%", aspectRatio: "16/7", overflow: "hidden", cursor: "pointer" }} onClick={abrirEvento}>
          <img src={ev.headerImage} alt={ev.title} style={coverImgStyle(ev.imagePos, ev.imageZoom)} />
        </div>
      ) : ev.coverNeedsMigration ? (
        // La portada estaba guardada dentro del evento y no se envía (hacía
        // que la lista pesara megas). Se sube sola en las próximas cargas.
        <div style={{ width: "100%", aspectRatio: "16/7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(135deg,#1b1d21,#101113)", color: "rgba(229,238,255,0.5)", fontSize: 12, textAlign: "center", padding: "0 20px" }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L4 20"/></svg>
          Optimizando la portada…
        </div>
      ) : null}

      {/* Header del evento */}
      <div style={{ padding: "18px 20px 16px", cursor: "pointer" }} onClick={abrirEvento}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                background: isPast ? "rgba(220,38,38,0.15)" : sold ? "rgba(220,38,38,0.15)" : "rgba(52,211,153,0.15)",
                color: isPast ? "#fca5a5" : sold ? "#fca5a5" : "#a7f3d0",
              }}>
                {isPast ? "Pasado" : sold ? "Sold out" : "Activo"}
              </span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "#ffffff", margin: "0 0 6px", lineHeight: 1.2 }}>
              {ev.title}
            </h3>
            {dateLabel && (
              <DataRow icon={<IcoCalendar />} style={{ marginBottom: 1 }}>{dateLabel}</DataRow>
            )}
            {ev.city && <DataRow icon={<IcoPin />}>{ev.city}</DataRow>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: "#ffffff" }}>{regs.length}</div>
            <div style={{ fontSize: 12, color: "var(--tf-muted)", marginTop: 6 }}>inscritos</div>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <span style={{ fontSize: 13, color: "var(--tf-muted)" }}>✓ {checkins} check-ins</span>
          <span style={{ fontSize: 13, color: "var(--tf-muted)" }}>{capacityLabel(ev)}</span>
        </div>
      </div>

      {/* Barra de progreso de aforo */}
      {ev.capacity && regs.length > 0 && (() => {
        // getCapacityMax entiende tanto los rangos antiguos como la capacidad
        // numérica del formulario actual (antes la barra no salía con "80").
        const max = getCapacityMax(ev.capacity, ev);
        if (!max) return null;
        const pct = Math.min(100, Math.round((regs.length / max) * 100));
        return (
          <div style={{ height: 4, borderRadius: 4, background: "var(--tf-surface-2)", margin: "0 20px 16px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#f87171" : "var(--tf-accent)", transition: "width 0.3s" }} />
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

      {/* Acciones: una fila de iconos con etiqueta (estilo Plata). Antes eran
          cinco botones de texto que en móvil se partían en dos filas. */}
      <div style={{ padding: "6px 8px 10px", borderTop: "1px solid var(--tf-divider)", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }}>
        {[
          { label: "Inscritos", onClick: () => onOpen(), icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></> },
          { label: "Compartir", onClick: onShare, icon: <><path d="M21.5 2.5 10.8 13.2" /><path d="M21.5 2.5 14.8 21.5l-4-8.3-8.3-4z" /></> },
          { label: "Escanear", onClick: onValidate, icon: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></> },
          { label: "Editar", onClick: onEdit, icon: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></> },
          { label: "Eliminar", onClick: onDelete, danger: true, icon: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></> },
        ].map((a) => (
          <button key={a.label} type="button" className="ef-hover-fill" onClick={a.onClick}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              padding: "10px 2px 8px", border: "none", borderRadius: 12, background: "transparent", cursor: "pointer",
              color: a.danger ? "#fca5a5" : "var(--tf-text)", minWidth: 0,
            }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{a.icon}</svg>
            <span style={{ fontSize: 11.5, fontWeight: 500, color: a.danger ? "#fca5a5" : "var(--tf-muted)", whiteSpace: "nowrap" }}>{a.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}

function DraftCard({ ev, onEdit, onDelete }) {
  const fields = ev.fields || [];
  return (
    <div className="panel-card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 20px" }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 100, background: "rgba(251,191,36,0.14)", color: "#fbbf24", display: "inline-block", marginBottom: 8 }}>
          Borrador — sin publicar
        </span>
        <h3 style={{ fontSize: 16, fontWeight: 500, color: "#ffffff", margin: "0 0 4px" }}>
          {ev.title || "Sin título"}
        </h3>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: 0 }}>
          {fields.length} campo{fields.length !== 1 ? "s" : ""} configurado{fields.length !== 1 ? "s" : ""}
          {ev.city ? ` · ${ev.city}` : ""}
        </p>
      </div>
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8 }}>
        <button type="button" className="soft-btn soft-btn-primary" style={{ fontSize: 14, flex: 1 }} onClick={onEdit}>
          Continuar editando
        </button>
        <button type="button" className="soft-btn soft-btn-ghost ef-hover-fill" style={{ fontSize: 14, color: "#fca5a5" }} onClick={onDelete}>
          Descartar
        </button>
      </div>
    </div>
  );
}
