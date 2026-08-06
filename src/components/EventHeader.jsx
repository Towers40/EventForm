import { VERDE_PASTEL_BG, NEGRO_PURO, NEGRO_MUTED_70, BLANCO_CONTRASTE } from "../lib/theme.js";
import { formatEventType } from "../lib/colombia.js";
import { isSoldOut } from "../lib/capacity.js";

export default function EventHeader({ event, compact = false }) {
  const h = compact ? 140 : 200;
  return (
    <div
      style={{
        border: `2px solid ${NEGRO_PURO}`,
        borderRadius: compact ? 12 : 16,
        overflow: "hidden",
        marginBottom: compact ? 16 : 20,
        background: BLANCO_CONTRASTE,
      }}
    >
      {event.headerImage ? (
        <img
          src={event.headerImage}
          alt=""
          style={{ width: "100%", height: h, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            height: compact ? 72 : 100,
            background: `linear-gradient(135deg, ${VERDE_PASTEL_BG} 0%, #c8e6d0 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: NEGRO_MUTED_70,
          }}
        >
          Sin imagen de portada
        </div>
      )}
      <div style={{ padding: compact ? "14px 16px" : "18px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
          {event.date && (
            <span style={{ fontSize: 11, fontWeight: 800, color: NEGRO_MUTED_70, textTransform: "uppercase" }}>
              {event.date}
            </span>
          )}
          {isSoldOut(event) && <span className="sold-out-badge">Sold out</span>}
        </div>
        <h1
          style={{
            fontSize: compact ? 20 : 26,
            fontWeight: 500,
            margin: 0,
            color: NEGRO_PURO,
            lineHeight: 1.15,
          }}
        >
          {event.title}
        </h1>
        {formatEventType(event) && (
          <p style={{ fontSize: 13, color: NEGRO_MUTED_70, margin: "8px 0 0", fontWeight: 600 }}>
            {formatEventType(event)}
          </p>
        )}
      </div>
    </div>
  );
}
