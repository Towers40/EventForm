import EventHeader from "./EventHeader.jsx";
import {
  VERDE_PASTEL_BG,
  VERDE_CORPORATIVO,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  BLANCO_CONTRASTE,
  ROJO_SUAVE,
} from "../lib/theme.js";
import { formatEventType } from "../lib/colombia.js";
import {
  isSoldOut,
  capacityLabel,
  spotsRemaining,
  getRegistrationCount,
} from "../lib/capacity.js";

export default function AdminPanel({
  events,
  onNew,
  onOpen,
  onEdit,
  onRegister,
  onValidate,
  onDelete,
}) {
  const totalRegs = events.reduce((n, e) => n + getRegistrationCount(e), 0);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, margin: "0 0 8px" }}>Panel de administración</h1>
        <p style={{ fontSize: 14, color: NEGRO_MUTED_70, fontWeight: 600 }}>
          {events.length} eventos · {totalRegs} inscripciones totales · Colombia
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <StatCard label="Eventos activos" value={events.length} />
        <StatCard label="Inscripciones" value={totalRegs} />
        <StatCard
          label="Agotados"
          value={events.filter(isSoldOut).length}
          highlight={ROJO_SUAVE}
        />
      </div>

      <button
        type="button"
        className="touch-target"
        onClick={onNew}
        style={{
          width: "100%",
          background: NEGRO_PURO,
          color: BLANCO_CONTRASTE,
          border: "none",
          borderRadius: 14,
          padding: 16,
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        + Crear nuevo evento
      </button>

      {events.length === 0 ? (
        <p style={{ textAlign: "center", color: NEGRO_MUTED_70, padding: 40 }}>
          Aún no tienes eventos. Crea el primero para empezar a gestionar inscripciones y check-in.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {events.map((e) => (
            <article
              key={e.id}
              style={{
                border: `2px solid ${NEGRO_PURO}`,
                borderRadius: 18,
                overflow: "hidden",
                background: BLANCO_CONTRASTE,
              }}
            >
              <EventHeader event={e} compact />
              <div style={{ padding: "0 16px 16px" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: NEGRO_MUTED_70, marginBottom: 4 }}>
                  {e.city ? `${e.city} · ` : ""}
                  {e.location || e.address || "Sin ubicación"}
                </p>
                <p style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
                  {capacityLabel(e)}
                  {!isSoldOut(e) && spotsRemaining(e) != null && (
                    <span style={{ color: VERDE_CORPORATIVO }}> · {spotsRemaining(e)} disponibles</span>
                  )}
                </p>

                <div className="admin-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <ActionBtn label="Gestionar" primary onClick={() => onOpen(e.id)} />
                  <ActionBtn label="Editar formulario" onClick={() => onEdit(e)} />
                  <ActionBtn
                    label="Inscripción"
                    onClick={() => onRegister(e.id)}
                    disabled={isSoldOut(e)}
                  />
                  <ActionBtn label="Check-in QR" onClick={() => onValidate(e.id)} />
                  <ActionBtn label="Eliminar" danger onClick={() => onDelete(e.id)} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div
      style={{
        border: `2px solid ${NEGRO_PURO}`,
        borderRadius: 14,
        padding: 14,
        background: highlight || VERDE_PASTEL_BG,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, primary, danger, disabled }) {
  return (
    <button
      type="button"
      className="touch-target"
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: "1 1 120px",
        padding: "10px 12px",
        borderRadius: 8,
        border: `2px solid ${NEGRO_PURO}`,
        fontWeight: 800,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        background: danger ? ROJO_SUAVE : primary ? NEGRO_PURO : BLANCO_CONTRASTE,
        color: primary ? BLANCO_CONTRASTE : NEGRO_PURO,
      }}
    >
      {label}
    </button>
  );
}
