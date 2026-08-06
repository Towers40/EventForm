import { getNavigationLinks } from "../lib/navigation.js";

export default function NavigateButtons({ lat, lng, label }) {
  const links = getNavigationLinks(lat, lng, label);
  if (!links) return null;

  const btn = {
    flex: 1,
    minWidth: 100,
    padding: "12px 10px",
    borderRadius: 14,
    border: "1px solid rgba(127,179,230,0.35)",
    background: "rgba(127,179,230,0.14)",
    color: "#7fb3e6",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none",
    display: "inline-block",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, textTransform: "uppercase", color: "#8fa3b1" }}>
        Cómo llegar
      </p>
      <div className="nav-links-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={links.apple} target="_blank" rel="noopener noreferrer" style={btn}>
          Mapas
        </a>
        <a href={links.google} target="_blank" rel="noopener noreferrer" style={btn}>
          Google Maps
        </a>
        <a href={links.waze} target="_blank" rel="noopener noreferrer" style={btn}>
          Waze
        </a>
      </div>
    </div>
  );
}
