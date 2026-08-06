// QR de una entrada que todavía no da acceso.
//
// Se usa en las tres pantallas donde el asistente ve su entrada (la confirmación
// tras inscribirse, "Mis tickets" y la página pública /t/:id). Mientras el
// anfitrión no apruebe, el código se pinta difuminado y con el aviso encima;
// en cuanto aprueba, `approved` llega en true y el mismo QR se ve nítido.

export function qrUrlFor(id, size = 260) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(id)}&bgcolor=ffffff&color=000000&margin=12&qzone=2`;
}

export default function PendingQr({ id, size = 220, approved = true, style }) {
  const img = (
    <img
      src={qrUrlFor(id, Math.max(size, 240))}
      alt={approved ? "QR de acceso" : "QR pendiente de aprobación"}
      style={{
        width: size, height: size, borderRadius: 14, display: "block",
        margin: "0 auto", background: "#fff", padding: 10, boxSizing: "border-box",
        ...(approved ? null : { filter: "blur(6px)", opacity: 0.45 }),
        ...style,
      }}
    />
  );

  if (approved) return img;

  return (
    <div style={{ position: "relative", width: size, margin: "0 auto" }}>
      {img}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center",
          padding: 12, boxSizing: "border-box",
        }}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fbbf24", lineHeight: 1.3, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
          Sujeto a aprobación
        </span>
      </div>
    </div>
  );
}

// Aviso que acompaña al QR difuminado.
export function PendingNotice({ style }) {
  return (
    <p style={{
      fontSize: 12.5, fontWeight: 700, color: "#fbbf24",
      background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)",
      borderRadius: 14, padding: "9px 12px", margin: "14px 0 0", lineHeight: 1.45,
      ...style,
    }}>
      Tu entrada está pendiente de aprobación del organizador. El código QR se
      activará aquí automáticamente en cuanto la apruebe.
    </p>
  );
}
