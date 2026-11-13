import { useEffect, useRef, useState } from "react";
import { COLOMBIA_CITIES, CITY_LANDMARKS } from "../lib/colombia.js";
import { searchEventPlaces } from "../lib/geocoding.js";

// ─── Buscador de ubicación (pantalla completa) ──────────────────────────────
//
// Antes era una tarjeta centrada con el campo a 15 px: al tocarlo, iOS hacía
// zoom (lo hace con cualquier campo de menos de 16 px), el teclado empujaba la
// tarjeta y la barra de búsqueda se salía por arriba en cuanto llegaban
// resultados. Ahora:
//   · ocupa la pantalla VISIBLE (visualViewport): el teclado nunca la tapa y
//     la barra queda fija arriba; solo se desplaza la lista;
//   · el campo va a 17 px (sin zoom de iOS);
//   · se elige la ciudad y la búsqueda se sesga hacia ella;
//   · sin texto, ofrece los lugares de referencia de esa ciudad;
//   · si un sitio no aparece, se puede usar lo escrito como dirección.

function useViewportVisible() {
  const leer = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: typeof window !== "undefined" ? window.innerHeight : 800 };
  };
  const [vp, setVp] = useState(leer);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setVp(leer());
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); };
  }, []);
  return vp;
}

const Pin = ({ color = "currentColor" }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
const Estrella = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
);
const Lapiz = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);

function Fila({ icono, titulo, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} className="ef-hover-fill"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
        padding: "12px 16px", border: "none", background: "transparent", cursor: "pointer", color: "#fff",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center", flexShrink: 0, color: "rgba(229,238,255,0.85)" }}>
        {icono}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
        {sub && <span style={{ display: "block", fontSize: 13, color: "rgba(229,238,255,0.56)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </button>
  );
}

export default function LocationSearch({ initialCity, onSelect, onClose }) {
  const vp = useViewportVisible();
  const [ciudad, setCiudad] = useState(COLOMBIA_CITIES.includes(initialCity) ? initialCity : "Bogotá D.C.");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  // Bloquea el desplazamiento de la página de debajo mientras está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => { document.body.style.overflow = prev; clearTimeout(t); abortRef.current?.abort(); clearTimeout(timerRef.current); };
  }, []);

  function buscar(texto, enCiudad = ciudad) {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setError("");
    if (texto.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await searchEventPlaces(texto, enCiudad, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) { setResults(r); setLoading(false); }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setResults([]); setLoading(false); setError(e.message || "No se pudo buscar.");
      }
    }, 350);
  }

  const elegirCiudad = (c) => { setCiudad(c); if (query.trim().length >= 2) buscar(query, c); };
  const usarReferencia = (nombre) => { setQuery(nombre); buscar(nombre); };
  const ciudadCorta = ciudad.replace(" D.C.", "");
  const referencias = CITY_LANDMARKS[ciudad] || [];
  // La ciudad elegida va primero en la fila de chips.
  const ciudades = [ciudad, ...COLOMBIA_CITIES.filter((c) => c !== ciudad)];

  return (
    <div role="dialog" aria-modal="true" aria-label="Elegir ubicación"
      style={{
        position: "fixed", left: 0, right: 0, top: vp.top, height: vp.height, zIndex: 600,
        background: "#141518", display: "flex", flexDirection: "column",
      }}>
      {/* Barra fija arriba */}
      <div style={{ padding: "12px 12px 8px", paddingTop: "calc(max(12px, env(safe-area-inset-top)) + var(--ef-top-offset, 0px))", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 640, margin: "0 auto" }}>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ef-hover-fill"
            style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={inputRef}
              type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off"
              value={query}
              onChange={(e) => { setQuery(e.target.value); buscar(e.target.value); }}
              placeholder={`Lugar o dirección en ${ciudadCorta}`}
              style={{
                width: "100%", boxSizing: "border-box", height: 48, borderRadius: 14, border: "none", outline: "none",
                background: "rgba(255,255,255,0.13)", color: "#fff", fontSize: 17, padding: "0 40px 0 14px",
                caretColor: "var(--tf-accent)", fontFamily: "inherit", WebkitAppearance: "none",
              }}
            />
            {query && (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => { setQuery(""); buscar(""); inputRef.current?.focus(); }}
                style={{ position: "absolute", right: 8, top: 12, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.25)", color: "#000", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>
                ×
              </button>
            )}
          </div>
        </div>
        {/* Ciudad: la búsqueda se sesga hacia ella. */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 0 2px", maxWidth: 640, margin: "0 auto", scrollbarWidth: "none" }}>
          {ciudades.map((c) => {
            const on = c === ciudad;
            return (
              <button key={c} type="button" onClick={() => elegirCiudad(c)} aria-pressed={on}
                style={{
                  flexShrink: 0, height: 34, padding: "0 13px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
                  fontSize: 13.5, fontWeight: 500,
                  background: on ? "#fff" : "transparent", color: on ? "#000" : "#fff",
                  border: on ? "1px solid #fff" : "1px solid rgba(229,238,255,0.24)",
                }}>
                {c.replace(" D.C.", "")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista: lo único que se desplaza. Al arrastrarla se esconde el teclado
          para ver más resultados. */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
        onTouchMove={() => { if (document.activeElement === inputRef.current) inputRef.current.blur(); }}>
        <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 24 }}>
          {query.trim().length < 2 ? (
            referencias.length ? (
              <>
                <p style={{ margin: 0, padding: "16px 16px 6px", fontSize: 13, color: "rgba(229,238,255,0.56)" }}>
                  Lugares de referencia en {ciudadCorta}
                </p>
                {referencias.map((n) => <Fila key={n} icono={<Estrella />} titulo={n} onClick={() => usarReferencia(n)} />)}
              </>
            ) : (
              <p style={{ margin: 0, padding: "20px 16px", fontSize: 14.5, color: "rgba(229,238,255,0.56)", lineHeight: 1.5 }}>
                Escribe el nombre del lugar, el barrio o la dirección en {ciudadCorta}.
              </p>
            )
          ) : (
            <>
              {loading && results.length === 0 && (
                <p style={{ margin: 0, padding: "18px 16px", fontSize: 14, color: "rgba(229,238,255,0.56)" }}>Buscando…</p>
              )}
              {error && <p style={{ margin: 0, padding: "18px 16px", fontSize: 14, color: "#fca5a5" }}>{error}</p>}
              {!loading && !error && results.length === 0 && (
                <p style={{ margin: 0, padding: "18px 16px 6px", fontSize: 14, color: "rgba(229,238,255,0.56)", lineHeight: 1.5 }}>
                  No encontramos «{query.trim()}» en {ciudadCorta}. Prueba con otro nombre o usa lo que escribiste como dirección.
                </p>
              )}
              {results.map((r) => (
                <Fila key={r.id} icono={<Pin />} titulo={r.name} sub={r.subtitle}
                  onClick={() => onSelect({ label: r.label, address: r.address, location: r.name, city: r.city || ciudad, lat: r.lat, lng: r.lng })} />
              ))}
              {query.trim().length >= 3 && (
                <Fila icono={<Lapiz />} titulo={`Usar «${query.trim()}»`} sub={`Como dirección escrita, en ${ciudadCorta} (sin mapa)`}
                  onClick={() => onSelect({ label: query.trim(), address: `${query.trim()}, ${ciudadCorta}`, location: query.trim(), city: ciudad, lat: null, lng: null })} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
