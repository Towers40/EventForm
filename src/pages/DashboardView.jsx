import "../styles/typeform.css";

export default function DashboardView({ events }) {
  const regs = events.flatMap(e => e.registrations || []);
  const total = regs.length;
  const checkins = regs.filter(r => r.used).length;

  const byMonth = {};
  events.forEach(ev => {
    const m = ev.date ? ev.date.slice(0, 7) : "Sin fecha";
    byMonth[m] = (byMonth[m] || 0) + 1;
  });

  const topEvent = [...events].sort((a, b) => (b.registrations?.length || 0) - (a.registrations?.length || 0))[0];
  const fastestEvent = events.length > 0
    ? [...events].filter(e => (e.registrations?.length || 0) > 0).sort((a, b) => {
        const rateA = (a.registrations?.length || 0) / Math.max(1, a.registrations?.length || 1);
        const rateB = (b.registrations?.length || 0) / Math.max(1, b.registrations?.length || 1);
        return rateB - rateA;
      })[0]
    : null;

  const stat = (label, value, sub) => (
    <div className="panel-card" style={{ padding: "24px 20px" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#6b9fd4", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaf0", marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#8fa3b1", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8eaf0", marginBottom: 8 }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: "#8fa3b1", marginBottom: 28 }}>Visión global de tu actividad en TapIn</p>

      {/* Stats principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
        {stat("Eventos creados", events.length)}
        {stat("Inscritos totales", total)}
        {stat("Check-ins totales", checkins)}
        {stat("Tasa de asistencia", total > 0 ? `${Math.round((checkins / total) * 100)}%` : "—", "check-ins / inscritos")}
      </div>

      {/* Eventos destacados */}
      {topEvent && (
        <div className="panel-card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            Evento con más inscritos
          </p>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0", margin: "0 0 4px" }}>{topEvent.title}</p>
          <p style={{ fontSize: 13, color: "#6b9fd4", fontWeight: 700, margin: 0 }}>
            {topEvent.registrations?.length || 0} inscritos
          </p>
        </div>
      )}

      {/* Eventos por mes */}
      <div className="panel-card" style={{ padding: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
          Eventos por mes
        </p>
        {Object.keys(byMonth).length === 0 ? (
          <p style={{ color: "#8fa3b1", fontSize: 14 }}>Sin datos aún</p>
        ) : (
          Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([mes, n]) => {
            const maxN = Math.max(...Object.values(byMonth));
            return (
              <div key={mes} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "rgba(232,234,240,0.5)", width: 80, flexShrink: 0 }}>{mes}</span>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${(n / maxN) * 100}%`, height: "100%", background: "#6b9fd4", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6b9fd4", width: 24, textAlign: "right" }}>{n}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
