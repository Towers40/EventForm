import { publicBaseUrl } from "../lib/platform.js";
import "../styles/typeform.css";

export default function ShareEventModal({ event, onClose }) {
  const url = `${publicBaseUrl()}/e/${event.slug || event.id}`;
  const text = encodeURIComponent(`¡Inscríbete a ${event.title}!`);
  const links = {
    whatsapp: `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };

  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(13,27,42,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 16px 16px" }}
      onClick={onClose}
    >
      <div className="panel-card" style={{ maxWidth: 480, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#0d0e10" }}>Compartir formulario</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8fa3b1" }}>{event.title}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8fa3b1", padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* URL display */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              readOnly
              value={url}
              style={{ flex: 1, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1b1d21", background: "#f8fafc", outline: "none" }}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="soft-btn soft-btn-primary" style={{ flexShrink: 0, padding: "10px 16px" }} onClick={copy}>
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>

          {/* Social buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-ghost" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              WhatsApp
            </a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-ghost" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              Facebook
            </a>
            <a href={links.twitter} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-ghost" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              X (Twitter)
            </a>
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="soft-btn soft-btn-ghost" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
              LinkedIn
            </a>
          </div>

          <p style={{ fontSize: 12, color: "#8fa3b1", textAlign: "center", margin: 0 }}>
            En Instagram: copia el enlace y pégalo en tu bio o stories.
          </p>
        </div>
      </div>
    </div>
  );
}

// useState needed
import { useState } from "react";
