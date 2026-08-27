import { DISCOVER_CATEGORIES } from "../lib/categories.js";
import { CAT_ICONS } from "../lib/categoryIcons.jsx";
import { IcoPin, IcoVideo, ROW_ICON, ROW_BOX, AttendeeStack } from "./ui.jsx";

// La tarjeta de evento del listado. Vive aquí y no dentro de Descubrir porque
// la usan también el perfil de un organizador y cualquier listado que venga
// después: dos copias de esta tarjeta serían dos diseños distintos en cuanto
// alguien tocara una.

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function isLive(ev) {
  if (!ev.startDate || !ev.startTime) return false;
  const now = new Date();
  const start = new Date(`${ev.startDate}T${ev.startTime}`);
  if (ev.endDate && ev.endTime) {
    return now >= start && now <= new Date(`${ev.endDate}T${ev.endTime}`);
  }
  return now >= start && now <= new Date(start.getTime() + 4 * 3600000);
}


// A partir de aquí un evento se considera que "está llenando". Es un número
// bajo a propósito: en eventos de barrio, 8 personas ya es señal.
const POPULAR_MIN = 8;
// Caja común para categoría, ubicación y avatar del organizador: sin esto cada
// uno traía su propio tamaño y la columna de texto quedaba desalineada.
const ICON_BOX = ROW_BOX;
const ICON_SIZE = ROW_ICON;

// El listado va TODO con la letra de la app, aunque cada evento tenga la suya.
// Se probó al revés —cada tarjeta con su tipografía— y una lista de veinte
// eventos se volvía veinte diseños: la letra del organizador aparece cuando se
// entra a su evento, que es donde personaliza y no compite con nadie.
export default function EventCard({ ev, destacado = false, duplicado = false }) {
  const live  = isLive(ev);
  const gente = Number(ev.attendees || 0);
  const cat   = DISCOVER_CATEGORIES.find(c => c.slug === ev.category)
    || DISCOVER_CATEGORIES.find(c => c.slug === "otro");
  const price = ev.isPaid
    ? (ev.price ? `$${Number(ev.price).toLocaleString("es-CO")}` : "De pago")
    : "Gratis";
  const horaInicio = formatTime12(ev.startTime);
  const lugar = (ev.location || ev.address || "").trim();
  const [, mesN, diaN] = (ev.startDate || "").split("-").map(Number);
  const fecha = mesN && diaN ? { m: mesN, d: diaN } : null;

  // La tarjeta entera lleva al evento, pero el nombre del organizador lleva a
  // SU perfil, y un enlace no puede ir dentro de otro. Por eso el enlace del
  // evento es una capa que cubre la tarjeta por debajo del contenido: el
  // contenido no recibe clics (pointerEvents: none) salvo el del organizador,
  // que los recupera y queda por encima.
  return (
    <div
      {...(duplicado ? { "aria-hidden": "true" } : null)}
      style={{
        position: "relative",
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: 10, borderRadius: 18,
        background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <a
        href={`/e/${ev.slug}`}
        className="ef-hover-fill"
        aria-label={ev.title}
        {...(duplicado ? { tabIndex: -1 } : null)}
        style={{ position: "absolute", inset: 0, zIndex: 0, borderRadius: 18, textDecoration: "none" }}
      />
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1, pointerEvents: "none" }}>
        {/* Fecha · hora */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3, fontSize: 11 }}>
          {fecha && (
            <span style={{ fontWeight: 800, color: "#bfd9f2", background: "rgba(127,179,230,0.16)", borderRadius: 6, padding: "1px 7px", lineHeight: 1.35, letterSpacing: "0.02em" }}>
              {fecha.d} {MONTHS[fecha.m - 1].toUpperCase()}
            </span>
          )}
          {live && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fca5a5", fontWeight: 800 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />EN VIVO
            </span>
          )}
          {horaInicio && <span style={{ color: "rgba(238,241,247,0.5)" }}>{horaInicio}</span>}
          <span style={{
            marginLeft: "auto", fontWeight: 700, borderRadius: 6, padding: "1px 7px", lineHeight: 1.35, whiteSpace: "nowrap",
            background: ev.isPaid ? "rgba(251,191,36,0.12)" : "rgba(34,197,94,0.12)",
            color: ev.isPaid ? "#fbbf24" : "#22c55e",
          }}>
            {price}
          </span>
        </div>

        {/* Nombre + categoría. Los tres iconos de la tarjeta (categoría,
            ubicación y organizador) comparten caja de ICON_BOX px para que la
            columna de texto quede alineada. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
          {cat && CAT_ICONS[cat.slug] && (
            <span title={cat.label} style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: ICON_BOX, height: ICON_BOX, marginTop: 1, color: cat.color,
            }}>
              {CAT_ICONS[cat.slug](cat.color, ICON_SIZE)}
            </span>
          )}
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 500, color: "#eef1f7", lineHeight: 1.25,
            minWidth: 0, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {ev.title}
          </h3>
        </div>

        {/* Dónde */}
        {(lugar || ev.city) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, minWidth: 0 }}>
            <span style={{ flexShrink: 0, width: ICON_BOX, height: ICON_BOX, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "rgba(238,241,247,0.42)" }}>
              {ev.isVirtual ? <IcoVideo /> : <IcoPin />}
            </span>
            <span style={{ fontSize: 11.5, lineHeight: 1.3, color: "rgba(238,241,247,0.5)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ev.isVirtual ? "Evento virtual" : lugar || ev.city}
              {!ev.isVirtual && lugar && ev.city && <span style={{ color: "rgba(238,241,247,0.3)" }}> · {ev.city}</span>}
            </span>
          </div>
        )}

        {/* Quién va: caras de los primeros inscritos y "+N" con el resto. */}
        {gente > 0 && (
          <AttendeeStack
            personas={ev.attendeePreview || []}
            gente={gente}
            size={18}
            style={{ marginBottom: 3 }}
          />
        )}

        {/* Organizador. Su nombre lleva a su perfil, con todo lo que organiza. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {ev.hostAvatar ? (
            <img src={ev.hostAvatar} alt="" loading="lazy" decoding="async" width={ICON_BOX} height={ICON_BOX}
              style={{ width: ICON_BOX, height: ICON_BOX, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span style={{ width: ICON_BOX, height: ICON_BOX, borderRadius: "50%", flexShrink: 0, background: "rgba(127,179,230,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700, color: "#bfd9f2" }}>
              {(ev.hostName || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          {ev.hostId && !duplicado ? (
            <a
              href={`/o/${ev.hostId}`}
              title={`Ver todo lo que organiza ${ev.hostName || "este organizador"}`}
              style={{
                position: "relative", zIndex: 2, pointerEvents: "auto",
                fontSize: 11.5, lineHeight: 1.3, color: "rgba(191,217,242,0.85)",
                textDecoration: "none", borderBottom: "1px solid rgba(191,217,242,0.35)",
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {ev.hostName || "Organizador"}
            </a>
          ) : (
            <span style={{ fontSize: 11.5, lineHeight: 1.3, color: "rgba(238,241,247,0.5)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ev.hostName || "Organizador"}
            </span>
          )}
        </div>
      </div>

      {/* Imagen */}
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none", flexShrink: 0, width: 74, height: 74, borderRadius: 14, overflow: "hidden", background: "#111" }}>
        {destacado && gente >= POPULAR_MIN && (
          <span style={{ position: "absolute", top: 4, left: 4, zIndex: 1, color: "#fb923c", display: "inline-flex", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.9))" }}>
            <FlameIcon size={14} />
          </span>
        )}
        {ev.headerImage ? (
          <img src={ev.headerImage} alt={ev.title} loading="lazy" decoding="async" width={74} height={74} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: cat ? `linear-gradient(135deg, ${cat.color}44, #111)` : "linear-gradient(135deg, #1e3a5f, #0d1b2a)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {cat && CAT_ICONS[cat.slug]
              ? <div style={{ opacity: 0.55 }}>{CAT_ICONS[cat.slug](cat.color, 28)}</div>
              : <span style={{ fontSize: 24, opacity: 0.5 }}>🗓️</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export const FlameIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2s1 3.5-1.5 6C8 10.5 6 12.4 6 15a6 6 0 0 0 12 0c0-2.2-1-3.6-2-5-.6 1-1.3 1.6-2 1.6 1-3.2-.6-7-2-9.6z" />
  </svg>
);

