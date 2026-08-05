import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { BRAND_NAME, CONTACT_EMAIL, TapInMark } from "../lib/brand.jsx";
import { DISCOVER_CATEGORIES } from "../lib/categories.js";
import { CAT_ICONS } from "../lib/categoryIcons.jsx";

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

const PinIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

// A partir de aquí un evento se considera que "está llenando". Es un número
// bajo a propósito: en eventos de barrio, 8 personas ya es señal.
const POPULAR_MIN = 8;
// Caja común para categoría, ubicación y avatar del organizador: sin esto cada
// uno traía su propio tamaño y la columna de texto quedaba desalineada.
const ICON_BOX = 16;
const ICON_SIZE = 13;

function EventCard({ ev, destacado = false }) {
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

  return (
    <a
      href={`/e/${ev.slug}`}
      className="ef-hover-fill"
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: 10, borderRadius: 16, textDecoration: "none",
        background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Fecha · hora */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3, fontSize: 11 }}>
          {fecha && (
            <span style={{ fontWeight: 800, color: "#c8dff0", background: "rgba(107,159,212,0.16)", borderRadius: 6, padding: "2px 7px", letterSpacing: "0.02em" }}>
              {fecha.d} {MONTHS[fecha.m - 1].toUpperCase()}
            </span>
          )}
          {live && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fca5a5", fontWeight: 800 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />EN VIVO
            </span>
          )}
          {horaInicio && <span style={{ color: "rgba(232,234,240,0.5)" }}>{horaInicio}</span>}
          <span style={{
            marginLeft: "auto", fontWeight: 700, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap",
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
            margin: 0, fontSize: 15, fontWeight: 700, color: "#e8eaf0", lineHeight: 1.25,
            minWidth: 0, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {ev.title}
          </h3>
        </div>

        {/* Dónde */}
        {(lugar || ev.city) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, minWidth: 0 }}>
            <span style={{ flexShrink: 0, width: ICON_BOX, height: ICON_BOX, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "rgba(232,234,240,0.42)" }}>
              {ev.isVirtual ? <VideoIcon /> : <PinIcon />}
            </span>
            <span style={{ fontSize: 11.5, lineHeight: 1.3, color: "rgba(232,234,240,0.5)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ev.isVirtual ? "Evento virtual" : lugar || ev.city}
              {!ev.isVirtual && lugar && ev.city && <span style={{ color: "rgba(232,234,240,0.3)" }}> · {ev.city}</span>}
            </span>
          </div>
        )}

        {/* Organizador. El número de inscritos ya no se muestra. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {ev.hostAvatar ? (
            <img src={ev.hostAvatar} alt="" loading="lazy" decoding="async" width={ICON_BOX} height={ICON_BOX}
              style={{ width: ICON_BOX, height: ICON_BOX, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span style={{ width: ICON_BOX, height: ICON_BOX, borderRadius: "50%", flexShrink: 0, background: "rgba(107,159,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700, color: "#c8dff0" }}>
              {(ev.hostName || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 11.5, lineHeight: 1.3, color: "rgba(232,234,240,0.5)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ev.hostName || "Organizador"}
          </span>
        </div>
      </div>

      {/* Imagen */}
      <div style={{ position: "relative", flexShrink: 0, width: 74, height: 74, borderRadius: 12, overflow: "hidden", background: "#111" }}>
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
    </a>
  );
}

function CategoryPill({ cat, count, active, onClick }) {
  const Icon = CAT_ICONS[cat.slug];
  const iconColor = active ? "#fff" : cat.color;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        background: active ? cat.color : "rgba(255,255,255,0.07)",
        border: `1px solid ${active ? cat.color : "rgba(255,255,255,0.11)"}`,
        borderRadius: 16, padding: "12px 13px",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s",
        boxShadow: active ? `0 4px 20px ${cat.color}55` : "none",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; } }}
    >
      {/* Icon side — LEFT */}
      <div style={{
        flexShrink: 0, width: 34, height: 34,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(255,255,255,0.18)" : `${cat.color}22`,
        borderRadius: 10,
      }}>
        {Icon ? Icon(iconColor) : <span style={{ fontSize: 22 }}>{cat.emoji}</span>}
      </div>
      {/* Text side — RIGHT */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : "#e8eaf0", lineHeight: 1.3, marginBottom: count != null ? 2 : 0 }}>
          {cat.label}
        </div>
        {count != null && (
          <div style={{ fontSize: 12, fontWeight: 400, color: active ? "rgba(255,255,255,0.75)" : "rgba(232,234,240,0.42)", lineHeight: 1 }}>
            {count > 999 ? `${(count/1000).toFixed(1)}K` : count} {count === 1 ? "evento" : "eventos"}
          </div>
        )}
      </div>
    </button>
  );
}

const FlameIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 2s1 3.5-1.5 6C8 10.5 6 12.4 6 15a6 6 0 0 0 12 0c0-2.2-1-3.6-2-5-.6 1-1.3 1.6-2 1.6 1-3.2-.6-7-2-9.6z" />
  </svg>
);

const chipStyle = (activo) => ({
  flexShrink: 0, whiteSpace: "nowrap", cursor: "pointer",
  padding: "9px 16px", borderRadius: 999, fontSize: 13.5,
  fontWeight: activo ? 700 : 600,
  background: activo ? "rgba(107,159,212,0.22)" : "rgba(255,255,255,0.06)",
  border: activo ? "1px solid rgba(107,159,212,0.5)" : "1px solid rgba(255,255,255,0.1)",
  color: activo ? "#e8eaf0" : "rgba(232,234,240,0.65)",
});

const VideoIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" />
  </svg>
);

/**
 * Carrusel que avanza solo.
 *
 * Avanza de tarjeta en tarjeta (no en píxeles continuos) para que encaje con
 * el scroll-snap y nunca quede una tarjeta a medias. Se pausa en cuanto la
 * persona lo toca y se reanuda unos segundos después: pelearse con el dedo del
 * usuario es la forma más rápida de que un carrusel resulte molesto.
 *
 * No hace nada si el sistema pide reducir el movimiento, ni en escritorio,
 * donde la tira es una rejilla y no hay nada que desplazar.
 */
function useAutoCarousel(ref, activo, { intervalo = 3200, esperaTrasTocar = 7000 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !activo) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let pausadoHasta = 0;
    const pausar = () => { pausadoHasta = Date.now() + esperaTrasTocar; };

    const tick = () => {
      // En rejilla (escritorio) no hay desbordamiento: no hay nada que mover.
      if (el.scrollWidth <= el.clientWidth + 4) return;
      if (Date.now() < pausadoHasta) return;
      // Se avanza el ancho REAL de una tarjeta, no el del contenedor: las
      // tarjetas miden el 92%, así que usar el contenedor saltaba de a dos.
      const primera = el.children[0];
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const paso = primera ? primera.getBoundingClientRect().width + gap : el.clientWidth;
      const finalizado = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: finalizado ? 0 : el.scrollLeft + paso, behavior: "smooth" });
    };

    const id = setInterval(tick, intervalo);
    for (const ev of ["pointerdown", "wheel", "touchstart", "mouseenter"]) {
      el.addEventListener(ev, pausar, { passive: true });
    }
    return () => {
      clearInterval(id);
      for (const ev of ["pointerdown", "wheel", "touchstart", "mouseenter"]) {
        el.removeEventListener(ev, pausar);
      }
    };
  }, [ref, activo, intervalo, esperaTrasTocar]);
}

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
  const [categoryCounts, setCategoryCounts] = useState({});
  const [cities,         setCities]         = useState([]);
  const [populares,      setPopulares]      = useState([]);
  const searchTimer = useRef(null);
  const popRef = useRef(null);

  // Con algún filtro puesto, la persona ya sabe lo que busca: las secciones
  // de descubrimiento estorban y se ocultan.
  const filtrando = Boolean(search || activeCategory || activeCity);
  useAutoCarousel(popRef, !filtrando && populares.length > 1);

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

  async function fetchCategories() {
    try {
      const { categories } = await api.discoverCategories();
      const counts = {};
      (categories || []).forEach(c => { counts[c.slug] = c.count; });
      setCategoryCounts(counts);
    } catch {}
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
    fetchCategories();
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
      ? { color: "#e8eaf0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }
      : { minHeight: "100vh", background: "transparent", color: "#e8eaf0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Nav (solo en página independiente) ── */}
      {!embedded && (
        <nav style={{
          padding: "0 16px", height: 56,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)",
        }}>
          {/* Inicio: círculo con icono de casa */}
          <a href="/app" className="ef-hover-fill" title="Inicio" aria-label="Inicio" style={{
            justifySelf: "start",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%", textDecoration: "none",
            background: "rgba(107,159,212,0.25)", color: "#e8eaf0",
            border: "1px solid rgba(107,159,212,0.4)",
          }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>
          </a>
          <a href="/" className="ef-hover-fill" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 12px", borderRadius: 12 }}>
            <TapInMark size={20} color="#22c55e" />
            <span style={{ fontWeight: 800, fontSize: 16, color: "#e8eaf0" }}>{BRAND_NAME}</span>
          </a>
          {/* Empieza gratis: solo texto, sin óvalo, sin flecha, sin relleno */}
          <a href="/app" style={{
            justifySelf: "end",
            color: "#e8eaf0", textDecoration: "none",
            fontSize: 14, fontWeight: 700, padding: "6px 4px", background: "transparent", border: "none",
          }}>
            Empieza gratis
          </a>
        </nav>
      )}

      {/* ── Hero ── */}
      <div style={{ padding: "56px 24px 44px", textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px" }}>
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
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.11)",
              borderRadius: 28, padding: "14px 20px 14px 50px",
              fontSize: 15, color: "#e8eaf0", outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 1560, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Lo más popular ── */}
        {!filtrando && populares.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            {/* Solo la llama: la sección se explica sola por su posición. */}
            <div style={{ marginBottom: 12, color: "#fb923c", display: "flex" }} aria-label="Eventos que se están llenando">
              <FlameIcon size={22} />
            </div>
            <div className="ef-pop ef-hscroll" ref={popRef}>
              {populares.map(ev => <EventCard key={"pop-" + ev.id} ev={ev} destacado />)}
            </div>
          </section>
        )}

        {/* ── Categories ── */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#e8eaf0" }}>
            Explorar por categoría
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 10,
          }}>
            {DISCOVER_CATEGORIES.map(cat => (
              <CategoryPill
                key={cat.slug}
                cat={cat}
                count={categoryCounts[cat.slug] ?? null}
                active={activeCategory === cat.slug}
                onClick={() => handleCategory(cat.slug)}
              />
            ))}
          </div>
        </section>

        {/* ── Ciudades ── */}
        {cities.length > 1 && (
          <section style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: "#e8eaf0" }}>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              {activeCat ? (
                <>
                  {CAT_ICONS[activeCat.slug]
                    ? <span style={{ display: "inline-flex" }}>{CAT_ICONS[activeCat.slug](activeCat.color, 22)}</span>
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
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  × Quitar filtros
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#8fa3b1" }}>
              <div style={{ lineHeight: 1, marginBottom: 14, animation: "ef-logo-pulse 1.3s ease-in-out infinite", display: "inline-block" }}><TapInMark size={44} color="#22c55e" /></div>
              <p style={{ fontSize: 15, margin: 0 }}>Cargando eventos…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
              <p style={{ color: "#8fa3b1", fontSize: 15, marginBottom: 16 }}>{error}</p>
              <button
                className="ef-hover-fill"
                onClick={() => fetchEvents(search, activeCategory, 1, false, activeCity)}
                style={{ background: "rgba(107,159,212,0.22)", color: "#e8eaf0", border: "1px solid rgba(107,159,212,0.4)", borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
              >
                Reintentar
              </button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🗓️</div>
              <p style={{ color: "#8fa3b1", fontSize: 16, marginBottom: 20 }}>
                {filtrando ? "No hay eventos con esos filtros." : "No hay eventos públicos todavía."}
              </p>
              {filtrando && (
                <button
                  className="ef-hover-fill"
                  onClick={limpiarFiltros}
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
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
                      background: "rgba(107,159,212,0.18)", color: "#c8dff0",
                      border: "1px solid rgba(107,159,212,0.35)", borderRadius: 12,
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
            <TapInMark size={22} color="#22c55e" />
            <span style={{ fontWeight: 800, fontSize: 17, color: "#e8eaf0" }}>{BRAND_NAME}</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", margin: "0 0 8px" }}>Comunícate con nosotros</h3>
          <p style={{ fontSize: 14, color: "#8fa3b1", margin: "0 0 16px", lineHeight: 1.5 }}>
            ¿Dudas, sugerencias o soporte? Escríbenos y te respondemos.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="ef-hover-fill"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
              background: "rgba(34,197,94,0.12)", color: "#5ee07f",
              border: "1px solid rgba(34,197,94,0.35)", borderRadius: 12,
              padding: "11px 20px", fontSize: 14, fontWeight: 700,
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

        /* Listado: una columna en móvil, dos en tableta y tres en escritorio.
           La tarjeta es una fila compacta, así que en 3 columnas sigue
           cabiendo todo sin recortar información. */
        .ef-ev-grid { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 760px)  { .ef-ev-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1100px) { .ef-ev-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (min-width: 1400px) { .ef-ev-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

        /* Destacados: en móvil se pasan deslizando (sin comerse la pantalla);
           en escritorio se despliegan en rejilla. */
        .ef-pop {
          display: grid; gap: 10px;
          grid-auto-flow: column; grid-auto-columns: 92%;
          overflow-x: auto; scroll-snap-type: x mandatory;
          padding-bottom: 4px;
        }
        .ef-pop > * { scroll-snap-align: start; min-width: 0; }
        @media (prefers-reduced-motion: reduce) { .ef-pop { scroll-behavior: auto; } }
        @media (min-width: 760px) {
          .ef-pop {
            grid-auto-flow: row; grid-auto-columns: auto;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            overflow: visible;
          }
        }
        @media (min-width: 1100px) {
          .ef-pop { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 1400px) {
          .ef-pop { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}
