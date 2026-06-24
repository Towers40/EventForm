import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.js";
import { DISCOVER_CATEGORIES } from "../lib/categories.js";
import { CAT_ICONS } from "../lib/categoryIcons.jsx";

const DAYS   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function formatEventDate(ev) {
  if (!ev.startDate) return "Fecha por confirmar";
  const evDay = new Date(ev.startDate + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  evDay.setHours(0,0,0,0);
  const timeStr = ev.startTime ? ` · ${formatTime12(ev.startTime)}` : "";
  if (evDay.getTime() === today.getTime())    return `Hoy${timeStr}`;
  if (evDay.getTime() === tomorrow.getTime()) return `Mañana${timeStr}`;
  const d = new Date(ev.startDate + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${timeStr}`;
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

function EventCard({ ev }) {
  const live  = isLive(ev);
  const cat   = DISCOVER_CATEGORIES.find(c => c.slug === ev.category);
  const price = ev.isPaid
    ? (ev.price ? `COP ${Number(ev.price).toLocaleString("es-CO")}` : "De pago")
    : "Gratis";

  return (
    <a
      href={`/e/${ev.slug}`}
      style={{
        display: "block", textDecoration: "none",
        borderRadius: 20, overflow: "hidden",
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        transition: "transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 18px 48px rgba(0,0,0,0.55)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Cover */}
      <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "#111" }}>
        {ev.headerImage ? (
          <img src={ev.headerImage} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: cat ? `linear-gradient(135deg, ${cat.color}33, #111)` : "linear-gradient(135deg, #1e3a5f, #0d1b2a)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {cat && CAT_ICONS[cat.slug]
              ? <div style={{ opacity: 0.45, transform: "scale(2.2)", transformOrigin: "center" }}>{CAT_ICONS[cat.slug](cat.color)}</div>
              : <span style={{ fontSize: 52, opacity: 0.5 }}>🗓️</span>
            }
          </div>
        )}
        {live && (
          <div style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(239,68,68,0.85)", color: "#fff",
            backdropFilter: "blur(6px)",
            borderRadius: 8, padding: "5px 10px",
            fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, background: "#fff", borderRadius: "50%", display: "inline-block" }} />
            EN VIVO
          </div>
        )}
        {cat && CAT_ICONS[cat.slug] && (
          <div style={{
            position: "absolute", top: 10, right: 10,
            background: live ? "rgba(220,38,38,0.22)" : `${cat.color}28`,
            border: live ? "1px solid rgba(220,38,38,0.45)" : `1px solid ${cat.color}55`,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            borderRadius: 12, padding: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {CAT_ICONS[cat.slug](live ? "#fca5a5" : cat.color)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b9fd4", marginBottom: 5 }}>
          {formatEventDate(ev)}
        </div>
        <h3 style={{
          fontSize: 16, fontWeight: 700, color: "#e8eaf0",
          margin: "0 0 6px", lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {ev.title}
        </h3>
        {ev.city && (
          <div style={{ fontSize: 12, color: "#8fa3b1", marginBottom: 10 }}>
            📍 {ev.city}
          </div>
        )}
        <span style={{
          display: "inline-block",
          background: ev.isPaid ? "rgba(251,191,36,0.12)" : "rgba(34,197,94,0.12)",
          color: ev.isPaid ? "#fbbf24" : "#22c55e",
          borderRadius: 6, padding: "4px 10px",
          fontSize: 12, fontWeight: 700,
        }}>
          {price}
        </span>
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

export default function DiscoverPage({ embedded = false }) {
  const [events,         setEvents]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [search,         setSearch]         = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});
  const searchTimer = useRef(null);

  async function fetchEvents(q, category) {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (q)        params.q        = q;
      if (category) params.category = category;
      const { events: evs } = await api.discoverEvents(params);
      setEvents(evs || []);
    } catch (e) {
      setError(e.message || "No se pudo cargar los eventos.");
    } finally {
      setLoading(false);
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
    fetchEvents("", null);
    fetchCategories();
  }, []);

  function handleSearch(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchEvents(val, activeCategory), 350);
  }

  function handleCategory(slug) {
    const next = activeCategory === slug ? null : slug;
    setActiveCategory(next);
    fetchEvents(search, next);
  }

  const activeCat = DISCOVER_CATEGORIES.find(c => c.slug === activeCategory);

  return (
    <div style={embedded
      ? { color: "#e8eaf0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }
      : { minHeight: "100vh", background: "linear-gradient(170deg, #1d2340 0%, #131628 100%)", backgroundAttachment: "fixed", color: "#e8eaf0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── Nav (solo en página independiente) ── */}
      {!embedded && (
        <nav style={{
          padding: "0 16px", height: 56,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)",
        }}>
          <a href="/app" style={{
            justifySelf: "start",
            display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
            background: "rgba(107,159,212,0.25)", color: "#e8eaf0",
            border: "1px solid rgba(107,159,212,0.4)",
            borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700,
          }}>
            ← Inicio
          </a>
          <a href="/" style={{ justifySelf: "center", display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <span style={{ color: "#22c55e", fontSize: 18 }}>●</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#e8eaf0" }}>EventForm</span>
          </a>
          <a href="/app" style={{
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#e8eaf0", margin: 0 }}>
              {activeCat ? `${activeCat.emoji} ${activeCat.label}` : "Próximos eventos"}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!loading && events.length > 0 && (
                <span style={{ fontSize: 13, color: "#555f6b" }}>
                  {events.length} resultado{events.length !== 1 ? "s" : ""}
                </span>
              )}
              {activeCategory && (
                <button
                  type="button"
                  onClick={() => { setActiveCategory(null); fetchEvents(search, null); }}
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  × Quitar filtro
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#555f6b" }}>
              <div style={{ fontSize: 36, marginBottom: 14, animation: "spin 1.5s linear infinite", display: "inline-block" }}>✦</div>
              <p style={{ fontSize: 15, margin: 0 }}>Cargando eventos…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
              <p style={{ color: "#8fa3b1", fontSize: 15, marginBottom: 16 }}>{error}</p>
              <button
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
                  onClick={() => { setSearch(""); setActiveCategory(null); fetchEvents("", null); }}
                  style={{ background: "transparent", color: "#6b9fd4", border: "1px solid #6b9fd4", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
                >
                  Ver todos los eventos
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}>
              {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) { .hide-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}
