import { VERDE_PASTEL_BG, NEGRO_PURO, NEGRO_MUTED_70 } from "../lib/theme.js";

export default function ShareEventModal({ event, publicUrl, onClose }) {
  const url = publicUrl || `${window.location.origin}/e/${event.slug}`;
  const text = encodeURIComponent(`Inscríbete a ${event.title}`);
  const links = {
    whatsapp: `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    alert("Enlace copiado. Pégalo en Instagram, TikTok o donde quieras.");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="panel-card"
        style={{ maxWidth: 480, width: "100%", marginBottom: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-card-header">
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Compartir formulario</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: NEGRO_MUTED_70 }}>
            Enlace público de inscripción
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <input
            readOnly
            value={url}
            style={{
              width: "100%",
              padding: 12,
              border: `2px solid ${NEGRO_PURO}`,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            className="soft-btn soft-btn-primary"
            style={{ width: "100%", marginBottom: 12 }}
            onClick={copy}
          >
            Copiar enlace
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-secondary" style={{ textAlign: "center", textDecoration: "none" }}>
              WhatsApp
            </a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-secondary" style={{ textAlign: "center", textDecoration: "none" }}>
              Facebook
            </a>
          </div>
          <p style={{ fontSize: 11, color: NEGRO_MUTED_70, marginTop: 12, background: VERDE_PASTEL_BG, padding: 10, borderRadius: 8 }}>
            En Instagram o TikTok: copia el enlace y pégalo en tu bio, stories o mensaje directo.
          </p>
          <button type="button" onClick={onClose} style={{ marginTop: 12, background: "none", border: "none", fontWeight: 700, cursor: "pointer", width: "100%" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
