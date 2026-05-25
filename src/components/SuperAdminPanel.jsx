import { capacityLabel } from "../lib/capacity.js";
import { NEGRO_MUTED_70 } from "../lib/theme.js";

export default function SuperAdminPanel({ data, onOpenEvent }) {
  const { hosts = [], events = [], stats = {} } = data || {};

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Super administración</h1>
      <p style={{ color: NEGRO_MUTED_70, marginBottom: 24 }}>
        Vista global de anfitriones y eventos en la plataforma.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Stat n={stats.hostCount} label="Anfitriones" />
        <Stat n={stats.eventCount} label="Eventos" />
        <Stat n={stats.regCount} label="Inscripciones" />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Anfitriones registrados</h2>
      <div className="panel-card" style={{ marginBottom: 28, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f9f4", textAlign: "left" }}>
              <th style={{ padding: 10 }}>Nombre</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Alta</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                <td style={{ padding: 10 }}>{h.name || "—"}</td>
                <td style={{ padding: 10 }}>{h.email}</td>
                <td style={{ padding: 10 }}>{new Date(h.createdAt).toLocaleDateString("es-CO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Todos los eventos</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.map((e) => (
          <div key={e.id} className="panel-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 900 }}>{e.title}</div>
            <div style={{ fontSize: 12, color: NEGRO_MUTED_70, marginTop: 4 }}>
              Anfitrión: {e.hostName || e.hostEmail} · {capacityLabel(e)}
            </div>
            <button
              type="button"
              className="soft-btn soft-btn-secondary"
              style={{ marginTop: 10 }}
              onClick={() => onOpenEvent(e.id)}
            >
              Ver detalle
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="panel-card" style={{ padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{n ?? 0}</div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
