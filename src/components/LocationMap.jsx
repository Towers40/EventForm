import { NEGRO_PURO } from "../lib/theme.js";

export default function LocationMap({ lat, lng, height = 220 }) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const pad = 0.012;
  const bbox = `${ln - pad},${la - pad},${ln + pad},${la + pad}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${la}%2C${ln}`;

  return (
    <div
      style={{
        border: `2px solid ${NEGRO_PURO}`,
        borderRadius: 12,
        overflow: "hidden",
        marginTop: 12,
        marginBottom: 12,
      }}
    >
      <iframe
        title="Mapa del evento"
        src={src}
        style={{ width: "100%", height, border: "none", display: "block" }}
        loading="lazy"
      />
    </div>
  );
}
