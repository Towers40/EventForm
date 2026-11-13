import { useEffect, useState } from "react";
import { publicBaseUrl } from "../lib/platform.js";
import { useIsDesktop } from "../lib/useMediaQuery.js";
import "../styles/typeform.css";

// ─── Compartir el evento recién publicado ───────────────────────────────────
//
// Una fila de logos (WhatsApp, Facebook, X, LinkedIn) en vez de botones de
// texto. Al tocar uno pasan dos cosas a la vez: se COPIA el enlace del evento
// (por si la red no lo adjunta sola o se quiere pegar en otro sitio) y se abre
// esa red con el enlace ya puesto. Además, un botón para solo copiar.

const marca = (d) => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);

const REDES = [
  { key: "whatsapp", label: "WhatsApp",
    href: (url, texto) => `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`,
    icon: marca("M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z") },
  { key: "facebook", label: "Facebook",
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: marca("M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z") },
  { key: "x", label: "X",
    href: (url, texto) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(url)}`,
    icon: marca("M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z") },
  { key: "linkedin", label: "LinkedIn",
    href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: marca("M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z") },
];

export default function ShareEventModal({ event, onClose }) {
  const escritorio = useIsDesktop();
  const url = `${publicBaseUrl()}/e/${event.slug || event.id}`;
  const texto = `¡Inscríbete a ${event.title}!`;
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  // No se espera a que termine: el enlace de la red debe abrirse en el mismo
  // toque (si no, el navegador lo bloquea como ventana emergente).
  const copiar = () => {
    const ok = () => { setCopiado(true); setTimeout(() => setCopiado(false), 2400); };
    try { navigator.clipboard.writeText(url).then(ok).catch(() => {}); }
    catch { /* sin portapapeles: la red se abre igual con el enlace */ }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Compartir evento" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: escritorio ? "center" : "flex-end", justifyContent: "center", padding: escritorio ? 24 : 0 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, boxSizing: "border-box", background: "var(--tf-sheet, #1c1d21)", borderRadius: escritorio ? 24 : "24px 24px 0 0", padding: escritorio ? "24px 24px 22px" : "10px 20px calc(22px + env(safe-area-inset-bottom))", boxShadow: "0 24px 70px rgba(0,0,0,0.55)" }}>
        {!escritorio && <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.25)", margin: "4px auto 16px" }} />}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#fff" }}>Comparte tu evento</h3>
            <p style={{ margin: "4px 0 0", fontSize: 14.5, color: "var(--tf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ef-hover-fill"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "var(--tf-surface-2)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {/* Redes: logo + nombre. Copia el enlace y abre la red. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 22 }}>
          {REDES.map((r) => (
            <a key={r.key} href={r.href(url, texto)} target="_blank" rel="noopener noreferrer" onClick={copiar}
              aria-label={`Compartir en ${r.label}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textDecoration: "none", color: "#fff" }}>
              <span className="ef-hover-fill" style={{ width: 62, height: 62, borderRadius: 20, background: "var(--tf-surface-2)", display: "grid", placeItems: "center" }}>{r.icon}</span>
              <span style={{ fontSize: 13, color: "var(--tf-desc, rgba(229,238,255,0.78))" }}>{r.label}</span>
            </a>
          ))}
        </div>

        {/* Enlace + copiar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--tf-field)", borderRadius: 16, padding: "6px 6px 6px 16px" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "var(--tf-desc, rgba(229,238,255,0.78))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.replace(/^https?:\/\//, "")}</span>
          <button type="button" onClick={copiar}
            style={{ flexShrink: 0, height: 44, padding: "0 18px", borderRadius: 12, border: "none", background: "#fff", color: "#000", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p role="status" style={{ fontSize: 13, color: "var(--tf-muted)", textAlign: "center", margin: "14px 0 0", minHeight: 18 }}>
          {copiado ? "Enlace copiado. Ya puedes pegarlo donde quieras." : "Al tocar una red se copia el enlace y se abre lista para publicar."}
        </p>
      </div>
    </div>
  );
}
