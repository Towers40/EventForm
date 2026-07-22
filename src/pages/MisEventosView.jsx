import { useState } from "react";
import { isSoldOut, capacityLabel } from "../lib/capacity.js";
import { buildParticipant } from "../lib/tickets.js";
import "../styles/typeform.css";

function statusOf(ev) {
  const dateStr = ev.startDate || ev.date;
  if (!dateStr) return "activo";
  const d = new Date(dateStr + "T12:00:00");
  return d < new Date() ? "pasado" : "activo";
}

export default function MisEventosView({ events, onNew, onOpen, onEdit, onValidate, onDelete, onShare, onToggleSoldOut }) {
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
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 18px", color: "#e8eaf0", textAlign: "center" }}>Mis eventos</h1>

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

      {lista.length === 0 ? (
        <div className="panel-card" style={{ padding: "48px 24px", textAlign: "center" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lista.map(ev => (
            ev.isDraft
              ? <DraftCard key={ev.id} ev={ev} onEdit={() => onEdit(ev)} onDelete={() => onDelete(ev.id)} />
              : <EventCard
                  key={ev.id} ev={ev}
                  onOpen={() => onOpen(ev.id)} onEdit={() => onEdit(ev)}
                  onValidate={() => onValidate(ev.id)} onDelete={() => onDelete(ev.id)}
                  onShare={() => onShare(ev)} onToggleSoldOut={(v) => onToggleSoldOut(ev.id, v)}
                />
          ))}
        </div>
      )}
    </div>
  );
}

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

      {/* Acciones — centradas */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onOpen}>
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
          {[...regs].reverse().slice(0, 10).map(r => {
            const p = buildParticipant(ev, r);
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0" }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "#8fa3b1", marginLeft: 8 }}>{new Date(r.ts).toLocaleString("es-CO")}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: r.used ? "rgba(107,159,212,0.25)" : "rgba(52,199,89,0.15)", color: r.used ? "#6b9fd4" : "#86efac" }}>
                  {r.used ? "CHECK-IN" : "ACTIVO"}
                </span>
              </div>
            );
          })}
          {regs.length > 10 && (
            <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, marginTop: 12, width: "100%" }} onClick={onOpen}>
              Ver todos los {regs.length} inscritos →
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
