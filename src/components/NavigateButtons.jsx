import { getNavigationLinks } from "../lib/navigation.js";
import { NEGRO_PURO, BLANCO_CONTRASTE, VERDE_CORPORATIVO, VERDE_PASTEL_BG } from "../lib/theme.js";

export default function NavigateButtons({ lat, lng, label }) {
  const links = getNavigationLinks(lat, lng, label);
  if (!links) return null;

  const btn = {
    flex: 1,
    minWidth: 100,
    padding: "12px 10px",
    borderRadius: 10,
    border: `2px solid ${NEGRO_PURO}`,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
    display: "inline-block",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
        Cómo llegar
      </p>
      <div className="nav-links-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={links.apple} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: NEGRO_PURO, color: BLANCO_CONTRASTE }}>
           Mapas
        </a>
        <a href={links.google} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: BLANCO_CONTRASTE, color: NEGRO_PURO }}>
          Google Maps
        </a>
        <a href={links.waze} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: VERDE_CORPORATIVO, color: BLANCO_CONTRASTE }}>
          Waze
        </a>
      </div>
    </div>
  );
}
