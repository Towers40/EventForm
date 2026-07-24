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

// Icono envuelto en una placa "liquid glass" (frosted, translúcida) — usado
// para el pin de ubicación en la fila de cada evento.
function GlassIcon({ children, size = 20 }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      color: "rgba(232,234,240,0.8)",
    }}>
      {children}
    </span>
  );
}

const PinIcon = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

// Rango horario del evento (inicio – fin) en formato 12h.
function eventTimeRange(ev) {
  if (!ev.startTime) return "";
  const start = formatTime12(ev.startTime);
  const end = ev.endTime ? formatTime12(ev.endTime) : "";
  return end ? `${start} – ${end}` : start;
}

// Placa de calendario estilo iOS (mes arriba, día grande) en tono translúcido,
// para el lado derecho de la tarjeta.
function CalendarBadge({ dateStr }) {
  if (!dateStr) return null;
  const [, m, d] = dateStr.split("-").map(Number);
  if (!m || !d) return null;
  return (
    <div style={{
      width: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0,
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
      textAlign: "center", lineHeight: 1,
    }}>
      <div style={{ background: "rgba(239,68,68,0.32)", color: "rgba(255,255,255,0.88)", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 0", textTransform: "uppercase" }}>
        {MONTHS[m - 1]}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(232,234,240,0.82)", padding: "4px 0 5px" }}>
        {d}
      </div>
    </div>
  );
}

const ClockIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);

// Fila compacta por evento: miniatura pequeña a la izquierda; a su lado la hora
// (con fin), el nombre con el icono de categoría, la ubicación y el promotor —
// todo en tono atenuado salvo el nombre. A la derecha: precio y placa de fecha.
function EventCard({ ev }) {
  const live  = isLive(ev);
  // Los eventos sin categoría definida se muestran como "Otro" por defecto.
  const cat   = DISCOVER_CATEGORIES.find(c => c.slug === ev.category)
    || DISCOVER_CATEGORIES.find(c => c.slug === "otro");
  const price = ev.isPaid
    ? (ev.price ? `COP ${Number(ev.price).toLocaleString("es-CO")}` : "De pago")
    : "Gratis";
  const timeRange = eventTimeRange(ev);

  return (
    <a
      href={`/e/${ev.slug}`}
      className="ef-hover-fill"
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: 14, borderRadius: 18, textDecoration: "none",
        background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Miniatura (la categoría ahora va junto al nombre, no en la imagen) */}
      <div style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 14, overflow: "hidden", background: "#111" }}>
        {ev.headerImage ? (
          <img src={ev.headerImage} alt={ev.title} loading="lazy" decoding="async" width={76} height={76} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: cat ? `linear-gradient(135deg, ${cat.color}44, #111)` : "linear-gradient(135deg, #1e3a5f, #0d1b2a)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {cat && CAT_ICONS[cat.slug]
              ? <div style={{ opacity: 0.55 }}>{CAT_ICONS[cat.slug](cat.color, 30)}</div>
              : <span style={{ fontSize: 26, opacity: 0.5 }}>🗓️</span>
            }
          </div>
        )}
      </div>

      {/* Texto: hora · nombre (+categoría) · ubicación · promotor */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 1) Hora del evento (con hora de finalización) / EN VIVO */}
        {(timeRange || live) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(232,234,240,0.5)", marginBottom: 3 }}>
            {live && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fca5a5", fontWeight: 700 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                EN VIVO
              </span>
            )}
            {timeRange && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <ClockIcon /> {timeRange}
              </span>
            )}
          </div>
        )}

        {/* 2) Nombre del evento + icono de categoría al lado */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          {cat && CAT_ICONS[cat.slug] && (
            <span title={cat.label} style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: "50%",
              background: `${cat.color}22`, border: `1px solid ${cat.color}55`,
            }}>
              {CAT_ICONS[cat.slug](cat.color, 13)}
            </span>
          )}
          <h3 style={{
            margin: 0, fontSize: 15.5, fontWeight: 700, color: "#e8eaf0", lineHeight: 1.3,
            minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {ev.title}
          </h3>
        </div>

        {/* 3) Ubicación con icono (liquid glass) */}
        {ev.city && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <GlassIcon><PinIcon /></GlassIcon>
            <span style={{ fontSize: 12.5, color: "rgba(232,234,240,0.5)" }}>{ev.city}</span>
          </div>
        )}

        {/* 4) Promotor (con su foto/avatar) */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {ev.hostAvatar ? (
            <img src={ev.hostAvatar} alt="" loading="lazy" decoding="async" width={20} height={20} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: "rgba(107,159,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#c8dff0" }}>
              {(ev.hostName || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 12.5, color: "rgba(232,234,240,0.5)" }}>
            {ev.hostName ? `Por ${ev.hostName}` : "Organizador"}
          </span>
        </div>
      </div>

      {/* Derecha: precio arriba, placa de calendario (día/mes) debajo — mismo ancho */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <span style={{
          width: 44, boxSizing: "border-box", textAlign: "center",
          display: "inline-block",
          background: ev.isPaid ? "rgba(251,191,36,0.12)" : "rgba(34,197,94,0.12)",
          color: ev.isPaid ? "#fbbf24" : "#22c55e",
          borderRadius: 8, padding: "5px 4px",
          fontSize: 11, fontWeight: 700, lineHeight: 1.25,
        }}>
          {price}
        </span>
        <CalendarBadge dateStr={ev.startDate} />
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
        borderRadius: 16, padding: "14px 16px",
        cursor: "pointer", textAlign: "left",
        transition: "all 0.15s",
        boxShadow: active ? `0 4px 20px ${cat.color}55` : "none",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.11)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; } }}
    >
      {/* Icon side — LEFT */}
      <div style={{
        flexShrink: 0, width: 38, height: 38,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "rgba(255,255,255,0.18)" : `${cat.color}22`,
        borderRadius: 10,
      }}>
        {Icon ? Icon(iconColor) : <span style={{ fontSize: 22 }}>{cat.emoji}</span>}
      </div>
      {/* Text side — RIGHT */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: active ? "#fff" : "#e8eaf0", lineHeight: 1.3, marginBottom: count != null ? 3 : 0 }}>
          {cat.label}
        </div>
        {count != null && (
          <div style={{ fontSize: 14, fontWeight: 400, color: active ? "rgba(255,255,255,0.75)" : "rgba(232,234,240,0.42)", lineHeight: 1 }}>
            {count > 999 ? `${(count/1000).toFixed(1)}K` : count} eventos
          </div>
        )}
      </div>
    </button>
  );
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
  const [categoryCounts, setCategoryCounts] = useState({});
  const searchTimer = useRef(null);

  // Una sola función para primera página (append=false, reemplaza) y siguientes
  // (append=true, agrega). Así el listado escala a cientos de eventos sin traer
  // todo de golpe: cada request pide solo PAGE_SIZE.
  async function fetchEvents(q, category, pageToLoad = 1, append = false) {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = { page: pageToLoad, limit: PAGE_SIZE };
      if (q)        params.q        = q;
      if (category) params.category = category;
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

  useEffect(() => {
    fetchEvents("", null, 1);
    fetchCategories();
  }, []);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchEvents(val, activeCategory, 1), 350);
  }

  function handleCategory(slug) {
    const next = activeCategory === slug ? null : slug;
    setActiveCategory(next);
    fetchEvents(search, next, 1);
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
          <a href="/app" className="ef-hover-fill" style={{
            justifySelf: "start",
            display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
            background: "rgba(107,159,212,0.25)", color: "#e8eaf0",
            border: "1px solid rgba(107,159,212,0.4)",
            borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700,
          }}>
            ← Inicio
          </a>
          <a href="/" className="ef-hover-fill" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "6px 12px", borderRadius: 12 }}>
            <TapInMark size={20} color="#22c55e" />
            <span style={{ fontWeight: 800, fontSize: 16, color: "#e8eaf0" }}>{BRAND_NAME}</span>
          </a>
          <a href="/app" className="ef-hover-fill" style={{
            justifySelf: "end",
            background: "rgba(107,159,212,0.25)", color: "#e8eaf0",
            border: "1px solid rgba(107,159,212,0.4)",
            borderRadius: 20, padding: "7px 16px",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}>
            Empieza gratis →
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

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Categories ── */}
        <section style={{ marginBottom: 52 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: "#e8eaf0" }}>
            Explorar por categoría
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
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
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!loading && total > 0 && (
                <span style={{ fontSize: 13, color: "#555f6b" }}>
                  {total} resultado{total !== 1 ? "s" : ""}
                </span>
              )}
              {activeCategory && (
                <button
                  type="button"
                  className="ef-hover-fill"
                  onClick={() => { setActiveCategory(null); fetchEvents(search, null, 1); }}
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  × Quitar filtro
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
                onClick={() => fetchEvents(search, activeCategory)}
                style={{ background: "rgba(107,159,212,0.22)", color: "#e8eaf0", border: "1px solid rgba(107,159,212,0.4)", borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
              >
                Reintentar
              </button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🗓️</div>
              <p style={{ color: "#8fa3b1", fontSize: 16, marginBottom: 20 }}>
                {search || activeCategory ? "No hay eventos con esos filtros." : "No hay eventos públicos todavía."}
              </p>
              {(search || activeCategory) && (
                <button
                  className="ef-hover-fill"
                  onClick={() => { setSearch(""); setActiveCategory(null); fetchEvents("", null, 1); }}
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
                >
                  Ver todos los eventos
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
              </div>
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  <button
                    type="button"
                    className="ef-hover-fill"
                    disabled={loadingMore}
                    onClick={() => fetchEvents(search, activeCategory, page + 1, true)}
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
      `}</style>
    </div>
  );
}
