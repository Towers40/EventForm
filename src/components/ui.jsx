// Piezas de interfaz compartidas, para que el mismo elemento se vea igual en
// todas las pantallas. Antes cada página resolvía a su manera los botones de
// acción y el marco de las imágenes, y el resultado era desigual.


import { COVER_RADIUS, COVER_PAD } from "../lib/ui-tokens.js";

// ── Botón de solo icono ─────────────────────────────────────────────────────
// Los botones de navegación (volver, inicio, nuevo, compartir) van sin texto en
// toda la app. El significado se transmite con `title` y `aria-label`, que es
// lo que además leen los lectores de pantalla.
export function IconButton({
  onClick, href, title, children,
  size = 40, tone = "glass", style, ...rest
}) {
  const tonos = {
    glass:  { background: "rgba(0,0,0,0.5)",            border: "1px solid rgba(255,255,255,0.2)",  color: "#fff" },
    soft:   { background: "rgba(255,255,255,0.07)",     border: "1px solid rgba(255,255,255,0.14)", color: "#bfd9f2" },
    accent: { background: "rgba(127,179,230,0.22)",     border: "1px solid rgba(127,179,230,0.45)", color: "#eef1f7" },
    green:  { background: "rgba(52,199,89,0.16)",       border: "1px solid rgba(52,199,89,0.4)",    color: "#5ee07f" },
  };
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: size, height: size, flexShrink: 0, padding: 0,
    borderRadius: "50%", cursor: "pointer", textDecoration: "none",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    ...tonos[tone], ...style,
  };
  const Comp = href ? "a" : "button";
  return (
    <Comp
      {...(href ? { href } : { type: "button", onClick })}
      title={title} aria-label={title}
      className="ef-hover-fill" style={base} {...rest}
    >
      {children}
    </Comp>
  );
}

// ── Iconos de navegación ────────────────────────────────────────────────────
const svg = (d, extra) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{d}{extra}</svg>
);
export const IcoBack   = () => svg(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const IcoHome   = () => svg(<><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>);
export const IcoPlus   = () => svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IcoShare  = () => svg(<><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /></>);
export const IcoMail   = () => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const IcoRoute  = () => svg(<><path d="m3 11 19-8-8 19-2-9-9-2z" /></>);
export const IcoQr     = () => svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 14v.01M14 21v.01" /></>);
// ── Iconos de fila (fecha, lugar) ───────────────────────────────────────────
// Comparten tamaño y grosor de trazo para que las filas de datos se vean
// iguales en Descubrir, Mis eventos y el detalle del evento. Antes unas
// pantallas usaban SVG y otras emoji (📅 📍), que además cambian de aspecto
// según el sistema operativo.
export const ROW_ICON = 13;   // tamaño del dibujo
export const ROW_BOX  = 16;   // caja que lo contiene, para alinear el texto

export const IcoPin = ({ size = ROW_ICON }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

export const IcoCalendar = ({ size = ROW_ICON }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const IcoVideo = ({ size = ROW_ICON }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" />
  </svg>
);

/** Fila "icono + texto" con la caja y la alineación del sistema. */
export function DataRow({ icon, children, color = "rgba(238,241,247,0.64)", size = 12, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, ...style }}>
      <span style={{ flexShrink: 0, width: ROW_BOX, height: ROW_BOX, display: "inline-flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </span>
      <span style={{ fontSize: size, lineHeight: 1.3, color, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </div>
  );
}

// ── Tinte del evento ────────────────────────────────────────────────────────
// Manchas muy abiertas del color que domina la portada, fijas sobre el fondo
// global de la app. La usan la página del evento, la inscripción y la entrada:
// las tres son el mismo evento y tienen que sentirse igual.
export function EventTintLayer({ tinte }) {
  if (!tinte) return null;
  return (
    <div aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      background: tinte.glow,
    }} />
  );
}

// ── Quién va ────────────────────────────────────────────────────────────────
// Fila de caras superpuestas + "+N" con el resto. Responde de un vistazo a la
// única pregunta que decide si vas a un evento: ¿quién más va y cuántos son?
//
// `gente` es el TOTAL de inscritos y `personas` las pocas que llegan con
// nombre o foto; el círculo del final cubre la diferencia. Si no llega nadie
// pero el contador es mayor que cero (evento con inscritos sin cuenta), se
// pinta igualmente el círculo con el número: el dato importante es cuántos son.
export function AttendeeStack({
  personas = [], gente = 0, size = 22, max = 4, texto = true, style,
}) {
  const total    = Math.max(Number(gente) || 0, personas.length);
  if (total <= 0) return null;
  const visibles = personas.slice(0, max);
  const resto    = total - visibles.length;
  const fuente   = Math.max(8.5, size * 0.42);
  const circulo  = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    // El borde del color del fondo es lo que separa una cara de la siguiente
    // cuando se solapan; sin él se ven como una mancha.
    border: "1.5px solid rgba(20,23,40,0.95)",
    marginLeft: -size * 0.3,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: fuente, fontWeight: 700, lineHeight: 1, boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "center", paddingLeft: size * 0.3 }}>
        {visibles.map((p, i) => (
          p.avatar ? (
            <img
              key={i} src={p.avatar} alt="" title={p.name || undefined}
              loading="lazy" decoding="async" width={size} height={size}
              style={{ ...circulo, objectFit: "cover", background: "rgba(127,179,230,0.25)" }}
            />
          ) : (
            <span key={i} title={p.name || undefined}
              style={{ ...circulo, background: "rgba(127,179,230,0.3)", color: "#dbe9fa" }}>
              {(p.initial || p.name?.[0] || "?").toUpperCase()}
            </span>
          )
        ))}
        {resto > 0 && (
          <span style={{ ...circulo, background: "rgba(255,255,255,0.12)", color: "rgba(238,241,247,0.8)", fontSize: fuente * 0.95 }}>
            +{resto > 99 ? "99" : resto}
          </span>
        )}
      </div>
      {texto && (
        <span style={{ fontSize: 11.5, color: "rgba(238,241,247,0.5)", whiteSpace: "nowrap" }}>
          {total === 1 ? "1 va" : `${total} van`}
        </span>
      )}
    </div>
  );
}

// ── Marco estándar de imagen de evento ──────────────────────────────────────
// Cuadrada, esquinas suavizadas y con margen a los lados: nunca pegada al
// borde de la pantalla. Es el mismo marco en la página del evento, en la
// entrada y al crear, para que no haya tres tratamientos distintos.
export function EventCover({ src, alt, ratio = "1 / 1", radius = COVER_RADIUS, pad = COVER_PAD, children, style }) {
  return (
    <div style={{ padding: `0 ${pad}px`, boxSizing: "border-box", ...style }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: ratio,
        borderRadius: radius, overflow: "hidden",
        background: "linear-gradient(135deg,#222b4c,#12182b)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}>
        {src
          ? <img src={src} alt={alt || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, opacity: 0.5 }}>🎉</div>}
        {children}
      </div>
    </div>
  );
}

/** Avisito flotante de "enlace copiado". */
export function CopiedToast({ visible, texto = "Enlace copiado" }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
      zIndex: 400, background: "rgba(20,23,40,0.97)", color: "#5ee07f",
      border: "1px solid rgba(52,199,89,0.4)", borderRadius: 100,
      padding: "10px 18px", fontSize: 13.5, fontWeight: 700,
      boxShadow: "0 8px 28px rgba(0,0,0,0.5)", pointerEvents: "none",
    }}>
      ✓ {texto}
    </div>
  );
}

// ── Cómo llegar ─────────────────────────────────────────────────────────────
/**
 * Hoja para elegir app de navegación. Se ofrecen las que tienen sentido en la
 * plataforma: Waze y Google Maps en todas, Apple Maps solo en dispositivos
 * Apple, donde viene instalada de fábrica.
 */
export function DirectionsSheet({ lat, lng, abierto, onCerrar }) {
  if (!abierto) return null;
  const ll = `${lat},${lng}`;
  const esApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
  const apps = [
    { label: "Waze", href: `https://waze.com/ul?ll=${ll}&navigate=yes`, color: "#33ccff" },
    { label: "Google Maps", href: `https://maps.google.com/?daddr=${ll}`, color: "#34a853" },
    ...(esApple ? [{ label: "Apple Maps", href: `https://maps.apple.com/?daddr=${ll}`, color: "#7d8590" }] : []),
  ];
  return (
    <div onClick={onCerrar}
      style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 22, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <p style={{ margin: 0, padding: "18px 20px 12px", fontSize: 15, fontWeight: 700, color: "#eef1f7" }}>
          ¿Con qué app quieres ir?
        </p>
        {apps.map((a) => (
          <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" onClick={onCerrar}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 20px", textDecoration: "none", color: "#eef1f7", fontSize: 15, fontWeight: 600, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
            {a.label}
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="rgba(238,241,247,0.5)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}><path d="M7 17 17 7M7 7h10v10" /></svg>
          </a>
        ))}
        <button type="button" onClick={onCerrar}
          style={{ width: "100%", padding: "15px 20px", background: "rgba(255,255,255,0.04)", border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", color: "rgba(238,241,247,0.6)", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
