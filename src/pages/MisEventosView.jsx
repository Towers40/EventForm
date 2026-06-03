import { useState } from "react";
import { isSoldOut, capacityLabel } from "../lib/capacity.js";
import { buildParticipant } from "../lib/tickets.js";
import "../styles/typeform.css";

function statusOf(ev) {
  if (!ev.date) return "activo";
  const d = new Date(ev.date);
  return d < new Date() ? "pasado" : "activo";
}

export default function MisEventosView({ events, onNew, onOpen, onEdit, onValidate, onDelete, onShare, onToggleSoldOut }) {
  const [tab, setTab] = useState("activos");

  const borradores = events.filter(e => e.isDraft);
  const activos = events.filter(e => statusOf(e) === "activo" && !e.isDraft);
  const pasados = events.filter(e => statusOf(e) === "pasado" && !e.isDraft);
  const lista = tab === "activos" ? activos : tab === "pasados" ? pasados : borradores;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#0d1b2a" }}>Mis eventos</h1>
        <button type="button" className="soft-btn soft-btn-primary" onClick={onNew} style={{ fontSize: 13 }}>
          + Crear evento
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { key: "activos", label: `Próximos (${activos.length})` },
          { key: "pasados", label: `Pasados (${pasados.length})` },
          { key: "borradores", label: `Borradores (${borradores.length})` },
        ].map(t => (
          <button key={t.key} type="button"
            className={`soft-btn ${tab === t.key ? "soft-btn-primary" : "soft-btn-secondary"}`}
            style={{ fontSize: 13, padding: "10px 18px" }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="panel-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ color: "#8fa3b1", fontSize: 15, margin: 0 }}>
            {tab === "activos" ? "No tienes eventos próximos."
              : tab === "pasados" ? "No tienes eventos pasados."
              : "No hay borradores guardados."}
          </p>
          {tab === "activos" && (
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

function EventCard({ ev, onOpen, onEdit, onValidate, onDelete, onShare, onToggleSoldOut }) {
  const [expanded, setExpanded] = useState(false);
  const regs = ev.registrations || [];
  const checkins = regs.filter(r => r.used).length;
  const sold = isSoldOut(ev);

  return (
    <div className="panel-card" style={{ overflow: "hidden" }}>
      {/* Header del evento */}
      <div style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
                background: sold ? "#fee2e2" : "#f0fdf4", color: sold ? "#991b1b" : "#16a34a",
              }}>
                {sold ? "Sold out" : "Activo"}
              </span>
              {ev.date && <span style={{ fontSize: 12, color: "#8fa3b1" }}>{ev.date}</span>}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0d1b2a", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ev.title}
            </h3>
            {ev.city && <p style={{ fontSize: 13, color: "#8fa3b1", margin: 0 }}>{ev.city}</p>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0d3b66" }}>{regs.length}</div>
            <div style={{ fontSize: 11, color: "#8fa3b1", fontWeight: 700 }}>inscritos</div>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: "#5c6b7a" }}>✓ {checkins} check-ins</span>
          <span style={{ fontSize: 12, color: "#5c6b7a" }}>{capacityLabel(ev)}</span>
        </div>
      </div>

      {/* Barra de progreso de aforo */}
      {ev.capacity && regs.length > 0 && (() => {
        const maxMap = { "0-50": 50, "50-100": 100, "100-300": 300, "300+": 999 };
        const max = maxMap[ev.capacity];
        if (!max) return null;
        const pct = Math.min(100, Math.round((regs.length / max) * 100));
        return (
          <div style={{ height: 3, background: "#f0f4f8", margin: "0 20px" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#e53e3e" : "#0d3b66", transition: "width 0.3s" }} />
          </div>
        );
      })()}

      {/* Acciones */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f4f8", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="soft-btn soft-btn-primary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onOpen}>
          Ver inscritos
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onShare}>
          Compartir
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onValidate}>
          Check-in QR
        </button>
        <button type="button" className="soft-btn soft-btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onEdit}>
          Editar
        </button>
        <button type="button"
          className="soft-btn"
          style={{ fontSize: 12, padding: "8px 14px", background: sold ? "#f0fdf4" : "#fff7ed", color: sold ? "#16a34a" : "#c2410c", border: `1px solid ${sold ? "#bbf7d0" : "#fed7aa"}`, borderRadius: 10 }}
          onClick={() => onToggleSoldOut(!ev.manualSoldOut)}
        >
          {sold ? "Reabrir" : "Sold out"}
        </button>
        <button type="button"
          className="soft-btn"
          style={{ fontSize: 12, padding: "8px 14px", background: "#fff", color: "#e53e3e", border: "1px solid #fed7d7", borderRadius: 10 }}
          onClick={onDelete}
        >
          Eliminar
        </button>
      </div>

      {/* Lista de últimos inscritos */}
      {expanded && regs.length > 0 && (
        <div style={{ borderTop: "1px solid #f0f4f8", padding: "0 20px 16px" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 10px" }}>
            Últimos inscritos
          </p>
          {[...regs].reverse().slice(0, 10).map(r => {
            const p = buildParticipant(ev, r);
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#0d1b2a" }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "#8fa3b1", marginLeft: 8 }}>{new Date(r.ts).toLocaleString("es-CO")}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: r.used ? "#0d3b66" : "#f0fdf4", color: r.used ? "#fff" : "#16a34a" }}>
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
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0d1b2a", margin: "0 0 4px" }}>
          {ev.title || "Sin título"}
        </h3>
        <p style={{ fontSize: 13, color: "#8fa3b1", margin: 0 }}>
          {fields.length} campo{fields.length !== 1 ? "s" : ""} configurado{fields.length !== 1 ? "s" : ""}
          {ev.city ? ` · ${ev.city}` : ""}
        </p>
      </div>
      <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f4f8", display: "flex", gap: 8 }}>
        <button type="button" className="soft-btn soft-btn-primary" style={{ fontSize: 13 }} onClick={onEdit}>
          Continuar editando →
        </button>
        <button type="button" className="soft-btn" style={{ fontSize: 13, background: "#fff", color: "#e53e3e", border: "1px solid #fed7d7", borderRadius: 10 }} onClick={onDelete}>
          Descartar
        </button>
      </div>
    </div>
  );
}
