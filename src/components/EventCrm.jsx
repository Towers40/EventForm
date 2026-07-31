import { buildParticipant } from "../lib/tickets.js";
import { capacityLabel, isSoldOut } from "../lib/capacity.js";

const SUB  = "rgba(232,234,240,0.5)";
const TEXT = "#e8eaf0";
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

export default function EventCrm({ event, onBack, onToggleSoldOut, onShare, onSetApproval }) {
  const regs = event.registrations || [];
  const checked = regs.filter((r) => r.used).length;
  const needsApproval = Boolean(event.requireApproval);
  const pending = regs.filter((r) => r.approved === false).length;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="soft-btn soft-btn-secondary"
        style={{ marginBottom: 20 }}
      >
        ← Volver
      </button>

      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: TEXT }}>CRM — {event.title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: SUB }}>
            {capacityLabel(event)} · {checked} ingresaron ·{" "}
            {isSoldOut(event) ? "🔴 Venta cerrada" : "🟢 Venta abierta"}
          </p>
          {needsApproval && (
            <p style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 700, color: pending ? "#fbbf24" : "#86efac" }}>
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
              background: event.manualSoldOut ? "rgba(52,199,89,0.15)" : "rgba(220,38,38,0.12)",
              color: event.manualSoldOut ? "#86efac" : "#fca5a5",
              border: event.manualSoldOut ? "1px solid rgba(52,199,89,0.3)" : "1px solid rgba(220,38,38,0.3)",
            }}
          >
            {event.manualSoldOut ? "Reabrir venta de entradas" : "Cerrar venta (sold out manual)"}
          </button>
        </div>
      </div>

      <div className="panel-card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Asistente</th>
                <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ticket</th>
                <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Registro</th>
                <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ingreso</th>
                <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Marketing</th>
                {needsApproval && (
                  <th style={{ padding: 12, borderBottom: BORDER, color: SUB, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Aprobación</th>
                )}
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 ? (
                <tr>
                  <td colSpan={needsApproval ? 6 : 5} style={{ padding: 24, textAlign: "center", color: SUB }}>
                    Sin inscripciones aún
                  </td>
                </tr>
              ) : (
                regs.map((r) => {
                  const p = buildParticipant(event, r);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: 12, fontWeight: 700, color: TEXT }}>{p.name}</td>
                      <td style={{ padding: 12, fontFamily: "monospace", fontSize: 11, color: SUB }}>{r.id}</td>
                      <td style={{ padding: 12, color: SUB }}>
                        {new Date(r.ts).toLocaleString("es-CO")}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            background: r.used ? "rgba(107,159,212,0.2)" : "rgba(52,199,89,0.15)",
                            color: r.used ? "#6b9fd4" : "#86efac",
                            padding: "4px 10px",
                            borderRadius: 100,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {r.used ? "INGRESÓ" : "PENDIENTE"}
                        </span>
                      </td>
                      <td style={{ padding: 12, color: SUB }}>{r.consentMarketing ? "Sí" : "No"}</td>
                      {needsApproval && (
                        <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                          {r.approved === false ? (
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button type="button" onClick={() => onSetApproval?.(r.id, true)}
                                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: "rgba(52,199,89,0.16)", color: "#86efac", border: "1px solid rgba(52,199,89,0.35)" }}>
                                Aprobar
                              </button>
                              <button type="button" onClick={() => onSetApproval?.(r.id, false)}
                                title="Mantener pendiente" disabled
                                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)", cursor: "default" }}>
                                Pendiente
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{ background: "rgba(52,199,89,0.15)", color: "#86efac", padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700 }}>
                                APROBADO
                              </span>
                              {!r.used && (
                                <button type="button" onClick={() => onSetApproval?.(r.id, false)}
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
