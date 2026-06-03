import { getNavigationLinks } from "../lib/navigation.js";
import { NEGRO_PURO, BLANCO_CONTRASTE, AZUL_OSCURO, AZUL_CLARO_MEDIO } from "../lib/theme.js";

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
        <a href={links.apple} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: AZUL_OSCURO, color: BLANCO_CONTRASTE }}>
           Mapas
        </a>
        <a href={links.google} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: AZUL_CLARO_MEDIO, color: BLANCO_CONTRASTE }}>
          Google Maps
        </a>
        <a href={links.waze} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: AZUL_OSCURO, color: BLANCO_CONTRASTE }}>
          Waze
        </a>
      </div>
    </div>
  );
}
