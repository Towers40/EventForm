import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { BRAND_NAME, CONTACT_EMAIL, TapInMark } from "../lib/brand.jsx";
import { DISCOVER_CATEGORIES } from "../lib/categories.js";
import { CAT_ICONS, CategoryIcon, CalendarIcon } from "../lib/categoryIcons.jsx";
import EventCard from "../components/EventCard.jsx";
import CategoryCarousel from "../components/CategoryCarousel.jsx";

const chipStyle = (activo) => ({
  flexShrink: 0, whiteSpace: "nowrap", cursor: "pointer",
  padding: "9px 16px", borderRadius: 999, fontSize: 13.5,
  fontWeight: 500,
  background: activo ? "#ffffff" : "transparent",
  border: activo ? "1px solid #ffffff" : "1px solid rgba(229,238,255,0.24)",
  color: activo ? "#000000" : "#ffffff",
});


const PAGE_SIZE = 24; // por request; se cargan más con el botón "Cargar más"

export default function DiscoverPage({ embedded = false }) {
  const [events,         setEvents]         = useState([]);
  const [loading,        setLoading]        = useState(true);  // primera página
  const [loadingMore,    setLoadingMore]    = useState(false); // páginas siguientes
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [error,          setError]          = useState(null);
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeCity,     setActiveCity]     = useState(null);
  const [cities,         setCities]         = useState([]);
  const [populares,      setPopulares]      = useState([]);
  const searchTimer = useRef(null);

  // Con algún filtro puesto, la persona ya sabe lo que busca: las secciones
  // de descubrimiento estorban y se ocultan.
  const filtrando = Boolean(search || activeCategory || activeCity);

  // Una sola función para primera página (append=false, reemplaza) y siguientes
  // (append=true, agrega). Así el listado escala a cientos de eventos sin traer
  // todo de golpe: cada request pide solo PAGE_SIZE.
  async function fetchEvents(q, category, pageToLoad = 1, append = false, city = activeCity) {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = { page: pageToLoad, limit: PAGE_SIZE };
      if (q)        params.q        = q;
      if (category) params.category = category;
      if (city)     params.city     = city;
      const { events: evs, total: tot } = await api.discoverEvents(params);
      setTotal(Number(tot || 0));
      setPage(pageToLoad);
      setEvents(prev => append ? [...prev, ...(evs || [])] : (evs || []));
    } catch (e) {
      if (!append) setError(e.message || "No se pudo cargar los eventos.");
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }

  async function fetchCities() {
    try { setCities((await api.discoverCities()).cities || []); } catch {}
  }

  // Lo que la gente ya está llenando. Va en su propia consulta ordenada por
  // inscritos, no recortando la página actual: si no, "popular" dependería de
  // qué eventos hayan caído en la primera página.
  async function fetchPopulares() {
    try {
      const { events: evs } = await api.discoverEvents({ page: 1, limit: 6, sort: "popular" });
      setPopulares((evs || []).filter(e => (e.attendees || 0) > 0));
    } catch {}
  }

  useEffect(() => {
    fetchEvents("", null, 1);
    fetchCities();
    fetchPopulares();
  }, []);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchEvents(val, activeCategory, 1, false, activeCity), 350);
  }

  function handleCategory(slug) {
    const next = activeCategory === slug ? null : slug;
    setActiveCategory(next);
    fetchEvents(search, next, 1, false, activeCity);
  }

  function handleCity(name) {
    const next = activeCity === name ? null : name;
    setActiveCity(next);
    fetchEvents(search, activeCategory, 1, false, next);
  }

  function limpiarFiltros() {
    setSearch(""); setActiveCategory(null); setActiveCity(null);
    fetchEvents("", null, 1, false, null);
  }

  const hasMore = events.length < total;

  const activeCat = DISCOVER_CATEGORIES.find(c => c.slug === activeCategory);

  return (
    <div style={embedded
      ? { color: "#ffffff", fontFamily: "'Onest', system-ui, -apple-system, sans-serif" }
      : { minHeight: "100vh", background: "transparent", color: "#ffffff", fontFamily: "'Onest', system-ui, -apple-system, sans-serif" }}>

      {/* ── Nav (solo en página independiente) ── */}
      {!embedded && (
        <nav style={{
          padding: "0 16px", height: 56,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(18,20,22,0.82)", backdropFilter: "blur(16px)",
        }}>
          {/* Inicio: círculo con icono de casa */}
          <a href="/app" className="ef-hover-fill" title="Inicio" aria-label="Inicio" style={{
            justifySelf: "start",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%", textDecoration: "none",
            background: "rgba(52,211,153,0.25)", color: "#ffffff",
            border: "1px solid rgba(52,211,153,0.4)",
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
          </a>
          <a href="/" className="ef-hover-fill" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 12px", borderRadius: 14 }}>
            <TapInMark size={20} color="#34d399" />
            <span style={{ fontWeight: 800, fontSize: 16, color: "#ffffff" }}>{BRAND_NAME}</span>
          </a>
          {/* Empieza gratis: solo texto, sin óvalo, sin flecha, sin relleno */}
          <a href="/app" style={{
            justifySelf: "end",
            color: "#ffffff", textDecoration: "none",
            fontSize: 14, fontWeight: 700, padding: "6px 4px", background: "transparent", border: "none",
          }}>
            Empieza gratis
          </a>
        </nav>
      )}

      {/* ── Hero ── */}
      <div style={{ padding: "56px 24px 44px", textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 500, lineHeight: 1.1, margin: "0 0 14px" }}>
          Descubre eventos en Colombia
        </h1>
        <p style={{ fontSize: 16, color: "#8fa3b1", margin: "0 0 32px", lineHeight: 1.5 }}>
          Conciertos, workshops, fiestas, tech meetups y mucho más
        </p>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
          <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", fontSize: 18, pointerEvents: "none", lineHeight: 1 }}>🔍</span>
          <input
            type="text"
            placeholder="Busca un evento, ciudad o categoría…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.11)",
              borderRadius: 28, padding: "14px 20px 14px 50px",
              fontSize: 15, color: "#ffffff", outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Categorías: pegadas al buscador, porque filtrar por categoría es
            parte de buscar. Carrusel circular en bucle: con ratón se para al
            pasar por encima; en móvil se desliza y la del centro se agranda. */}
        <CategoryCarousel
          categories={DISCOVER_CATEGORIES}
          active={activeCategory}
          onSelect={handleCategory}
        />
      </div>

      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Lo más popular ── */}
        {!filtrando && populares.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            {/* Dos copias: la segunda es la que permite el bucle sin corte.
                Se oculta a los lectores de pantalla para no leerlo dos veces. */}
            {/* Cinta continua, igual que la de pósters de la bienvenida: una
                animación CSS de transform (la mueve la GPU, sin saltos) y los
                bordes desvanecidos con una máscara. Antes avanzaba a golpes de
                píxel con scrollLeft y las tarjetas se cortaban en seco a los
                lados. Se pausa al tocar o pasar el cursor. */}
            <div className={populares.length > 1 ? "ef-pop ef-pop--cinta" : "ef-pop"}>
              <div className="ef-pop-track" style={{ animationDuration: `${Math.max(18, populares.length * 9)}s` }}>
                {populares.map(ev => <EventCard key={"pop-" + ev.id} ev={ev} destacado />)}
                {populares.length > 1 && populares.map(ev => (
                  <EventCard key={"dup-" + ev.id} ev={ev} destacado duplicado />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Ciudades ── */}
        {cities.length > 1 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 14, color: "#ffffff" }}>
              ¿Dónde?
            </h2>
            {/* En móvil se desliza a los lados: con 20 ciudades, apiladas
                empujarían el listado fuera de la pantalla. */}
            <div className="ef-hscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              <button type="button" onClick={() => handleCity(null)}
                style={chipStyle(!activeCity)}>
                Todas
              </button>
              {cities.map(c => (
                <button key={c.name} type="button" onClick={() => handleCity(c.name)}
                  style={chipStyle(activeCity === c.name)}>
                  {c.name}
                  <span style={{ opacity: 0.6, marginLeft: 6, fontWeight: 600 }}>{c.count}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Events grid ── */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: "#ffffff", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              {activeCat ? (
                <>
                  {CAT_ICONS[activeCat.slug]
                    ? <CategoryIcon slug={activeCat.slug} size={26} round />
                    : <span>{activeCat.emoji}</span>}
                  {activeCat.label}
                </>
              ) : "Próximos eventos"}
              {activeCity && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "#8fa3b1" }}>en {activeCity}</span>
              )}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!loading && total > 0 && (
                <span style={{ fontSize: 13, color: "#555f6b" }}>
                  {total} resultado{total !== 1 ? "s" : ""}
                </span>
              )}
              {filtrando && (
                <button
                  type="button"
                  className="ef-hover-fill"
                  onClick={limpiarFiltros}
                  style={{ background: "transparent", color: "#34d399", border: "1px solid #34d399", borderRadius: 22, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  × Quitar filtros
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#8fa3b1" }}>
              <div style={{ lineHeight: 1, marginBottom: 14, animation: "ef-logo-pulse 1.3s ease-in-out infinite", display: "inline-block" }}><TapInMark size={44} color="#34d399" /></div>
              <p style={{ fontSize: 15, margin: 0 }}>Cargando eventos…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
              <p style={{ color: "#8fa3b1", fontSize: 15, marginBottom: 16 }}>{error}</p>
              <button
                className="ef-hover-fill"
                onClick={() => fetchEvents(search, activeCategory, 1, false, activeCity)}
                style={{ background: "rgba(52,211,153,0.22)", color: "#ffffff", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 14, padding: "11px 22px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
              >
                Reintentar
              </button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <CalendarIcon size={76} round />
              </div>
              <p style={{ color: "#8fa3b1", fontSize: 16, marginBottom: 20 }}>
                {filtrando ? "No hay eventos con esos filtros." : "No hay eventos públicos todavía."}
              </p>
              {filtrando && (
                <button
                  className="ef-hover-fill"
                  onClick={limpiarFiltros}
                  style={{ background: "transparent", color: "#34d399", border: "1px solid #34d399", borderRadius: 14, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
                >
                  Ver todos los eventos
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="ef-ev-grid">
                {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
              </div>
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  <button
                    type="button"
                    className="ef-hover-fill"
                    disabled={loadingMore}
                    onClick={() => fetchEvents(search, activeCategory, page + 1, true, activeCity)}
                    style={{
                      background: "rgba(52,211,153,0.18)", color: "#a7f3d0",
                      border: "1px solid rgba(52,211,153,0.35)", borderRadius: 14,
                      padding: "12px 28px", cursor: loadingMore ? "default" : "pointer",
                      fontWeight: 700, fontSize: 14, opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? "Cargando…" : `Cargar más (${total - events.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Comunícate con nosotros ── */}
        <section style={{ marginTop: 72, paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <TapInMark size={22} color="#34d399" />
            <span style={{ fontWeight: 800, fontSize: 17, color: "#ffffff" }}>{BRAND_NAME}</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 500, color: "#ffffff", margin: "0 0 8px" }}>Comunícate con nosotros</h3>
          <p style={{ fontSize: 14, color: "#8fa3b1", margin: "0 0 16px", lineHeight: 1.5 }}>
            ¿Dudas, sugerencias o soporte? Escríbenos y te respondemos.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="ef-hover-fill"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
              background: "var(--tf-surface-2)", color: "#ffffff",
              border: "none", borderRadius: 14,
              padding: "14px 20px", fontSize: 15, fontWeight: 500,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ef-logo-pulse {
          0%, 100% { transform: scale(0.6); opacity: 0.3; }
          50%      { transform: scale(1.15); opacity: 0.75; }
        }
        @media (max-width: 480px) { .hide-mobile { display: none !important; } }

        /* La rejilla del listado (.ef-ev-grid) vive en typeform.css: la
           comparte el perfil del organizador. */

        /* Destacados: cinta continua (transform + máscara en los bordes). */
        .ef-pop { overflow: hidden; }
        .ef-pop-track { display: flex; gap: 10px; justify-content: center; }
        .ef-pop-track > * { flex: 0 0 88%; min-width: 0; }
        @media (min-width: 760px)  { .ef-pop-track > * { flex: 0 0 340px; } }
        @media (min-width: 1100px) { .ef-pop-track > * { flex: 0 0 360px; } }
        .ef-pop--cinta {
          margin: 0 -24px;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%);
        }
        .ef-pop--cinta .ef-pop-track {
          width: max-content; justify-content: flex-start;
          animation: ef-pop-drift linear infinite; will-change: transform;
        }
        .ef-pop--cinta .ef-pop-track > * { flex: 0 0 300px; }
        @media (min-width: 760px) { .ef-pop--cinta .ef-pop-track > * { flex: 0 0 350px; } }
        .ef-pop--cinta:hover .ef-pop-track, .ef-pop--cinta:active .ef-pop-track { animation-play-state: paused; }
        /* -50% menos medio hueco = exactamente el ancho de UNA copia. */
        @keyframes ef-pop-drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(calc(-50% - 5px),0,0); } }
        @media (prefers-reduced-motion: reduce) { .ef-pop--cinta .ef-pop-track { animation: none; } }
      `}</style>
    </div>
  );
}
