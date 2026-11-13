import { useState } from "react";
import { IconButton, IcoBack } from "./ui.jsx";
import { buildParticipant, groupRegistrations } from "../lib/tickets.js";
import { capacityLabel, isSoldOut } from "../lib/capacity.js";

const SUB  = "rgba(229,238,255,0.5)";
const TEXT = "#ffffff";
const BORDER = "1px solid rgba(255,255,255,0.09)";

function exportCsv(event, registrations) {
  const fields = event.fields || [];
  const headers = [
    "Ticket",
    "Fecha",
    "Check-in",
    "Marketing",
    ...fields.map((f) => f.label),
  ];
  const rows = registrations.map((r) => {
    const p = buildParticipant(event, r);
    return [
      r.id,
      new Date(r.ts).toISOString(),
      r.used ? "Sí" : "No",
      r.consentMarketing ? "Sí" : "No",
      ...fields.map((f) => {
        const v = r.data[f.id];
        if (Array.isArray(v)) return v.join("; ");
        if (typeof v === "boolean") return v ? "Sí" : "No";
        return v ?? "";
      }),
    ];
  });
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${event.slug || event.id}-inscritos.csv`;
  a.click();
}

export default function EventCrm({ event, onBack, onToggleSoldOut, onShare, onSetApproval, initialFilter = "todos" }) {
  const regs = event.registrations || [];
  const checked = regs.filter((r) => r.used).length;
  const needsApproval = Boolean(event.requireApproval);
  const pending = regs.filter((r) => r.approved === false).length;

  const [filtro, setFiltro] = useState(initialFilter);
  // Una fila por persona, no por entrada: quien reservó 3 aparecía 3 veces.
  const grupos = groupRegistrations(event, regs);
  const visibles = filtro === "pendientes" ? grupos.filter((g) => g.pendientes > 0) : grupos;

  return (
    <div>
      {/* Volver vive en el encabezado de la app. */}
      {onBack && (
        <div style={{ marginBottom: 20 }}>
          <IconButton title="Volver" tone="soft" onClick={onBack}><IcoBack /></IconButton>
        </div>
      )}

      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: TEXT }}>CRM — {event.title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: SUB }}>
            {capacityLabel(event)} · {checked} ingresaron ·{" "}
            {isSoldOut(event) ? "🔴 Venta cerrada" : "🟢 Venta abierta"}
          </p>
          {needsApproval && (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 700, color: pending ? "#fbbf24" : "#a7f3d0" }}>
              {pending
                ? `⏳ ${pending} solicitud${pending === 1 ? "" : "es"} por aprobar — su QR no funciona hasta que la apruebes`
                : "✓ Sin solicitudes pendientes"}
            </p>
          )}
        </div>
        <div style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="soft-btn soft-btn-primary" onClick={onShare}>
            Compartir enlace
          </button>
          <button
            type="button"
            className="soft-btn soft-btn-secondary"
            onClick={() => exportCsv(event, regs)}
          >
            Exportar CSV (Excel)
          </button>
          <button
            type="button"
            className="soft-btn"
            onClick={() => onToggleSoldOut(!event.manualSoldOut)}
            style={{
              background: event.manualSoldOut ? "rgba(52,211,153,0.15)" : "rgba(220,38,38,0.12)",
              color: event.manualSoldOut ? "#a7f3d0" : "#fca5a5",
              border: event.manualSoldOut ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(220,38,38,0.3)",
            }}
          >
            {event.manualSoldOut ? "Reabrir venta de entradas" : "Cerrar venta (sold out manual)"}
          </button>
        </div>
      </div>

      {/* Filtro de aprobación */}
      {needsApproval && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { key: "todos", label: `Todos (${grupos.length})` },
            { key: "pendientes", label: `Por aprobar (${grupos.filter(g => g.pendientes > 0).length})` },
          ].map((f) => (
            <button key={f.key} type="button" onClick={() => setFiltro(f.key)}
              style={{
                padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontSize: 13,
                fontWeight: filtro === f.key ? 700 : 600,
                background: filtro === f.key ? "rgba(52,211,153,0.22)" : "rgba(255,255,255,0.05)",
                border: filtro === f.key ? "1px solid rgba(52,211,153,0.45)" : BORDER,
                color: filtro === f.key ? "#ffffff" : SUB,
              }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="panel-card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.09)", textAlign: "left" }}>
                {["Asistente", "Entradas", "Registro", "Ingreso", "Marketing", ...(needsApproval ? ["Aprobación"] : [])].map((h) => (
                  <th key={h} style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={needsApproval ? 6 : 5} style={{ padding: 24, textAlign: "center", color: SUB }}>
                    {filtro === "pendientes" ? "No hay solicitudes por aprobar" : "Sin inscripciones aún"}
                  </td>
                </tr>
              ) : (
                visibles.map((g) => {
                  const ids = g.items.map((i) => i.id);
                  const pendientesIds = g.items.filter((i) => i.approved === false).map((i) => i.id);
                  return (
                    <tr key={g.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: 12, color: TEXT }}>
                        <div style={{ fontWeight: 700 }}>{g.name}</div>
                        {g.email && <div style={{ fontSize: 11.5, color: SUB, marginTop: 2 }}>{g.email}</div>}
                      </td>
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 800, color: g.total > 1 ? "#34d399" : TEXT, fontSize: 14 }}>{g.total}</span>
                        <span style={{ color: SUB, fontSize: 11.5, marginLeft: 5 }}>{g.total === 1 ? "entrada" : "entradas"}</span>
                        {/* Los códigos solo cuando son pocos: con 5 la celda se vuelve ilegible. */}
                        {g.total <= 3 && (
                          <div style={{ fontFamily: "monospace", fontSize: 10.5, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
                            {ids.join(" · ")}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 12, color: SUB, whiteSpace: "nowrap" }}>{new Date(g.ts).toLocaleString("es-CO")}</td>
                      <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                        <span style={{
                          background: g.usadas ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.15)",
                          color: g.usadas ? "#34d399" : "#a7f3d0",
                          padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                        }}>
                          {g.usadas === 0 ? "PENDIENTE" : g.usadas === g.total ? "INGRESÓ" : `${g.usadas}/${g.total} INGRESARON`}
                        </span>
                      </td>
                      <td style={{ padding: 12, color: SUB }}>{g.items.some((i) => i.consentMarketing) ? "Sí" : "No"}</td>
                      {needsApproval && (
                        <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                          {g.pendientes > 0 ? (
                            <button type="button" onClick={() => onSetApproval?.(pendientesIds, true)}
                              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: "rgba(52,211,153,0.16)", color: "#a7f3d0", border: "1px solid rgba(52,211,153,0.35)" }}>
                              {g.pendientes === g.total ? `Aprobar ${g.total > 1 ? "las " + g.total : ""}` : `Aprobar ${g.pendientes} restantes`}
                            </button>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{ background: "rgba(52,211,153,0.15)", color: "#a7f3d0", padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>
                                APROBADO
                              </span>
                              {g.usadas === 0 && (
                                <button type="button" onClick={() => onSetApproval?.(ids, false)}
                                  style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "transparent", color: SUB, border: BORDER }}>
                                  Revocar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
