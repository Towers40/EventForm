import { buildParticipant } from "../lib/tickets.js";
import { capacityLabel, isSoldOut } from "../lib/capacity.js";
import {
  VERDE_CORPORATIVO,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  BLANCO_CONTRASTE,
  VERDE_PASTEL_BG,
} from "../lib/theme.js";

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

export default function EventCrm({ event, onBack, onToggleSoldOut, onShare }) {
  const regs = event.registrations || [];
  const checked = regs.filter((r) => r.used).length;

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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>CRM — {event.title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: NEGRO_MUTED_70 }}>
            {capacityLabel(event)} · {checked} ingresaron ·{" "}
            {isSoldOut(event) ? "🔴 Venta cerrada" : "🟢 Venta abierta"}
          </p>
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
              background: event.manualSoldOut ? VERDE_CORPORATIVO : "#fee2e2",
              color: event.manualSoldOut ? "#fff" : NEGRO_PURO,
              border: `2px solid ${NEGRO_PURO}`,
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
              <tr style={{ background: VERDE_PASTEL_BG, textAlign: "left" }}>
                <th style={{ padding: 12, borderBottom: `2px solid ${NEGRO_PURO}` }}>Asistente</th>
                <th style={{ padding: 12, borderBottom: `2px solid ${NEGRO_PURO}` }}>Ticket</th>
                <th style={{ padding: 12, borderBottom: `2px solid ${NEGRO_PURO}` }}>Registro</th>
                <th style={{ padding: 12, borderBottom: `2px solid ${NEGRO_PURO}` }}>Ingreso</th>
                <th style={{ padding: 12, borderBottom: `2px solid ${NEGRO_PURO}` }}>Marketing</th>
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: "center", color: NEGRO_MUTED_70 }}>
                    Sin inscripciones aún
                  </td>
                </tr>
              ) : (
                regs.map((r) => {
                  const p = buildParticipant(event, r);
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${VERDE_PASTEL_BG}` }}>
                      <td style={{ padding: 12, fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: 12, fontFamily: "monospace", fontSize: 11 }}>{r.id}</td>
                      <td style={{ padding: 12 }}>
                        {new Date(r.ts).toLocaleString("es-CO")}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span
                          style={{
                            background: r.used ? NEGRO_PURO : VERDE_CORPORATIVO,
                            color: BLANCO_CONTRASTE,
                            padding: "4px 8px",
                            borderRadius: 100,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {r.used ? "INGRESÓ" : "PENDIENTE"}
                        </span>
                      </td>
                      <td style={{ padding: 12 }}>{r.consentMarketing ? "Sí" : "No"}</td>
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
