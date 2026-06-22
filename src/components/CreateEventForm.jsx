import { useState, useRef, useEffect, useCallback } from "react";
import { compressHeaderImage } from "../lib/images.js";

// ── Tokens ──────────────────────────────────────────────────────────────────
const BG     = "linear-gradient(170deg, #1d2340 0%, #131628 100%)";
const CARD   = "rgba(255,255,255,0.08)";
const BORDER = "1px solid rgba(255,255,255,0.11)";
const RADIUS = 20;
const TEXT   = "#e8eaf0";
const SUB    = "rgba(232,234,240,0.5)";
const ACCENT = "#6b9fd4";

// ── Spanish date formatting ──────────────────────────────────────────────────
const DAYS_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_ES[dt.getDay()]}, ${d} ${MONTHS_ES[m - 1]}`;
}
function fmtDateTime(dateStr, timeStr) {
  const base = fmtDate(dateStr);
  return base ? (timeStr ? `${base} · ${timeStr}` : base) : null;
}

// ── General address search (Photon / OpenStreetMap) ─────────────────────────
async function searchAddresses(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const params = new URLSearchParams({ q, limit: "8" });
    const res = await fetch(`https://photon.komoot.io/api/?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.features || []).map(f => {
      const p = f.properties || {};
      const parts = [p.name, p.street, p.housenumber, p.district, p.city, p.country].filter(Boolean);
      return {
        id: `${p.osm_type || "n"}-${p.osm_id || Math.random()}`,
        label: parts.join(", "),
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
      };
    }).filter(x => x.lat && x.lng && x.label);
  } catch { return []; }
}

// ── Full-screen location search modal ────────────────────────────────────────
function LocationModal({ onSelect, onClose }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounce.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const res = await searchAddresses(q);
      setResults(res);
      setLoading(false);
    }, 300);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#131628", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#6b9fd4", fontSize: 15, cursor: "pointer", padding: "4px 8px 4px 0", fontWeight: 600, whiteSpace: "nowrap" }}>
          ← Cancelar
        </button>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            ref={inputRef}
            type="text" value={query} onChange={handleChange}
            placeholder="Buscar dirección o lugar…"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "11px 40px 11px 14px", fontSize: 16, color: "#e8eaf0", outline: "none", caretColor: "#6b9fd4", fontFamily: "inherit" }}
          />
          {loading && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(232,234,240,0.4)" }}>…</span>}
        </div>
      </div>

      {/* Suggestions */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p style={{ padding: "20px 20px", color: "rgba(232,234,240,0.4)", fontSize: 14, margin: 0 }}>Sin resultados. Intenta con otro término.</p>
        )}
        {results.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(107,159,212,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <svg style={{ flexShrink: 0, marginTop: 1 }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(107,159,212,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: 15, color: "#e8eaf0", lineHeight: 1.4 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Wheel picker internals ───────────────────────────────────────────────────
const ITEM_H  = 46;
const VISIBLE = 5;

const MAX_YEAR = 2080;
const pad2 = (n) => String(n).padStart(2, "0");
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); } // m: 1-12

const HOURS   = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));
const MINUTES = [0, 15, 30, 45].map(m => ({ value: m, label: String(m).padStart(2, "0") }));

function WheelCol({ items, selectedKey, getKey, getLabel, onChange, flex }) {
  const ref   = useRef(null);
  const timer = useRef(null);
  const [live, setLive] = useState(() => Math.max(0, items.findIndex(i => getKey(i) === selectedKey)));

  useEffect(() => {
    const idx = items.findIndex(i => getKey(i) === selectedKey);
    if (idx >= 0 && ref.current) { ref.current.scrollTop = idx * ITEM_H; setLive(idx); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    if (!ref.current) return;
    const idx = Math.max(0, Math.min(Math.round(ref.current.scrollTop / ITEM_H), items.length - 1));
    setLive(idx);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(getKey(items[idx])), 180);
  }, [items, onChange, getKey]);

  return (
    <div style={{ flex: flex || 1, position: "relative", height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: `linear-gradient(to bottom,rgba(18,20,34,0.92) 0%,rgba(18,20,34,0.4) 22%,transparent 38%,transparent 62%,rgba(18,20,34,0.4) 78%,rgba(18,20,34,0.92) 100%)` }} />
      <div style={{ position: "absolute", left: 6, right: 6, top: ITEM_H * 2, height: ITEM_H, background: "rgba(255,255,255,0.07)", borderRadius: 10, pointerEvents: "none", zIndex: 1 }} />
      <div ref={ref} onScroll={onScroll} className="ce-wheel"
        style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => (
          <div key={getKey(item)} style={{ height: ITEM_H, scrollSnapAlign: "center", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: i === live ? 17 : 14, fontWeight: i === live ? 700 : 400,
            color: i === live ? "#fff" : "rgba(255,255,255,0.28)", userSelect: "none", transition: "color 0.08s, font-size 0.08s" }}>
            {getLabel(item)}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

function WheelPanel({ date, time, minDate, onChange, onClose }) {
  const min = minDate ? minDate.split("-").map(Number) : null; // [y, m, d]
  const now = new Date();

  // Selected date parts: from `date`, else minDate, else today.
  const sel = date
    ? date.split("-").map(Number)
    : (min || [now.getFullYear(), now.getMonth() + 1, now.getDate()]);
  const [sy, sm, sd] = sel;

  const hour   = time ? parseInt(time.split(":")[0], 10) : 8;
  const minRaw = time ? parseInt(time.split(":")[1], 10) : 0;
  const minute = [0, 15, 30, 45].reduce((a, b) => Math.abs(b - minRaw) < Math.abs(a - minRaw) ? b : a);
  const curTime = time || `${pad2(hour)}:${pad2(minute)}`;
  const curDate = date || `${sy}-${pad2(sm)}-${pad2(sd)}`;

  // Build column ranges, respecting minDate as a lower bound.
  const minY = min ? min[0] : now.getFullYear();
  const years = [];
  for (let y = minY; y <= MAX_YEAR; y++) years.push({ value: y, label: String(y) });

  const monthStart = (min && sy === min[0]) ? min[1] : 1;
  const months = [];
  for (let m = monthStart; m <= 12; m++) months.push({ value: m, label: MONTHS_ES[m - 1] });

  const dayStart = (min && sy === min[0] && sm === min[1]) ? min[2] : 1;
  const days = [];
  for (let d = dayStart; d <= daysInMonth(sy, sm); d++) days.push({ value: d, label: String(d) });

  // Normalize a (y, m, d) selection back into a valid, in-range date string.
  const emit = (y, m, d) => {
    const mStart = (min && y === min[0]) ? min[1] : 1;
    const mm = Math.max(m, mStart);
    const dStart = (min && y === min[0] && mm === min[1]) ? min[2] : 1;
    const dd = Math.min(Math.max(d, dStart), daysInMonth(y, mm));
    onChange({ date: `${y}-${pad2(mm)}-${pad2(dd)}`, time: curTime });
  };

  // Auto-select the default date (today / min) on open so "hoy" needs no scrolling.
  useEffect(() => {
    if (!date) onChange({ date: curDate, time: curTime });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "rgba(18,20,34,0.95)", border: "1px solid rgba(255,255,255,0.1)", margin: "8px 0 0" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 6px" }}>
        {[["Día",0.8],["Mes",1.2],["Año",1.2],["Hr",0.8],["Min",0.8]].map(([lbl, f]) => (
          <div key={lbl} style={{ flex: f, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{lbl}</div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        <WheelCol key={`d-${sy}-${sm}`} flex={0.8} items={days} selectedKey={sd} getKey={i => i.value} getLabel={i => i.label}
          onChange={d => emit(sy, sm, d)} />
        <WheelCol key={`m-${sy}`} flex={1.2} items={months} selectedKey={sm} getKey={i => i.value} getLabel={i => i.label}
          onChange={m => emit(sy, m, sd)} />
        <WheelCol key="y" flex={1.2} items={years} selectedKey={sy} getKey={i => i.value} getLabel={i => i.label}
          onChange={y => emit(y, sm, sd)} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
        <WheelCol key="h" flex={0.8} items={HOURS} selectedKey={hour} getKey={i => i.value} getLabel={i => i.label}
          onChange={h => onChange({ date: curDate, time: `${pad2(h)}:${pad2(minute)}` })} />
        <WheelCol key="mi" flex={0.8} items={MINUTES} selectedKey={minute} getKey={i => i.value} getLabel={i => i.label}
          onChange={m => onChange({ date: curDate, time: `${pad2(hour)}:${pad2(m)}` })} />
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: 11, background: "rgba(107,159,212,0.3)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Listo
        </button>
      </div>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 51, height: 30, borderRadius: 15, flexShrink: 0, background: value ? "#34c759" : "rgba(255,255,255,0.18)", position: "relative", cursor: "pointer", transition: "background 0.22s" }}>
      <div style={{ position: "absolute", top: 3, left: value ? 24 : 3, width: 24, height: 24, borderRadius: 12, background: "#fff", transition: "left 0.22s", boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }} />
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
const I = {
  MapPin:    () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Text:      () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="14" x2="3" y2="14"/><line x1="15" y1="18" x2="3" y2="18"/></svg>,
  Lock:      () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Dollar:    () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Globe:     () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Capacity:  () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Check:     () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  ChevronDown: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevronRight: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronsUD: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>,
  Image:     () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Plus:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  X:         () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Video:     () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CreateEventForm({ draft, setDraft, onDone, onCancel, user, avatarUrl }) {
  const today = new Date().toISOString().split("T")[0];

  const [startPicker, setStartPicker] = useState(false);
  const [endPicker,   setEndPicker]   = useState(false);
  const [showLocModal,setShowLocModal]= useState(false);
  const [showDesc,    setShowDesc]    = useState(false);
  const [showPrice,   setShowPrice]   = useState(false);
  const [showCap,     setShowCap]     = useState(false);
  const [visSheet,    setVisSheet]    = useState(false);
  const [imgBusy,     setImgBusy]     = useState(false);
  const [isDragging,  setIsDragging]  = useState(false);
  const [err,         setErr]         = useState("");

  const imgRef   = useRef(null);
  const capRef   = useRef(null);
  const priceRef = useRef(null);
  const dragRef  = useRef({ startX: 0, startY: 0, startPosX: 50, startPosY: 50 });

  const up = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const startLabel = fmtDateTime(draft.startDate, draft.startTime);
  const endLabel   = draft.endDate
    ? (draft.endDate === draft.startDate
        ? (draft.endTime || null)
        : fmtDateTime(draft.endDate, draft.endTime))
    : null;

  const locLabel  = draft.address || "";
  const capVal    = draft.capacityNum;
  const capLabel  = (capVal && Number(capVal) > 0) ? `${Number(capVal).toLocaleString("es-CO")} personas` : "Ilimitada";
  const priceVal  = draft.priceType === "paid" && draft.price ? Number(draft.price) : 0;
  const priceLabel = priceVal > 0 ? `$${priceVal.toLocaleString("es-CO")} COP` : "Gratis";
  const visLabel  = draft.visibility === "private" ? "Privado" : "Público";
  const initials  = (user?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Focus capacity input when opened
  useEffect(() => { if (showCap) capRef.current?.focus(); }, [showCap]);
  useEffect(() => { if (showPrice) priceRef.current?.focus(); }, [showPrice]);

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    try { up("headerImage", await compressHeaderImage(file)); }
    catch (ex) { alert(ex.message); }
    finally { setImgBusy(false); e.target.value = ""; }
  }

  function handleSubmit() {
    if (!draft.title?.trim()) { setErr("Ingresa el nombre del evento."); return; }
    if (!draft.startDate)     { setErr("Selecciona la fecha de inicio."); return; }
    if (!draft.startTime)     { setErr("Selecciona la hora de inicio."); return; }
    setErr("");
    onDone({ ...draft, capacity: draft.capacityNum ? String(draft.capacityNum) : "" });
  }

  const cardStyle = { background: CARD, border: BORDER, borderRadius: RADIUS, overflow: "hidden", marginBottom: 12 };
  const rowDivider = { borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <>
      <style>{`
        .ce-wheel::-webkit-scrollbar { display: none; }
        .ce-bg { background: ${BG}; min-height: 100dvh; }
        .ce-scroll { max-width: 540px; margin: 0 auto; padding: 0 16px 100px; }
        .ce-header-inner { max-width: 540px; margin: 0 auto; }
        @media (min-width: 768px) { .ce-scroll { padding-bottom: 60px; } }
      `}</style>

      <div className="ce-bg">
        {/* ── Sticky header ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 16px" }}>
          <div className="ce-header-inner" style={{ display: "flex", alignItems: "center", height: 60, gap: 12 }}>
            {!user ? (
              <button type="button" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "8px 4px", color: SUB, fontSize: 22, lineHeight: 1 }}>
                ←
              </button>
            ) : (
              <button type="button" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(107,159,212,0.3)", border: "1px solid rgba(107,159,212,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 13, fontWeight: 700, color: ACCENT }}>
                  {avatarUrl ? <img src={avatarUrl} alt="perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
                </div>
                <span style={{ color: SUB }}><I.ChevronDown /></span>
              </button>
            )}
            <p style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 17, color: TEXT, margin: 0 }}>Crear evento</p>
            <button type="button" onClick={handleSubmit} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(232,234,240,0.15)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TEXT, flexShrink: 0 }}>
              <I.Check />
            </button>
          </div>
        </div>

        <div className="ce-scroll">
          {/* ── Cover image ── */}
          <div
            style={{ position: "relative", margin: "20px 0 12px", borderRadius: 20, overflow: "hidden", aspectRatio: "16/10", background: draft.headerImage ? "none" : "rgba(255,255,255,0.05)", border: BORDER, cursor: draft.headerImage ? (isDragging ? "grabbing" : "grab") : "default", touchAction: draft.headerImage ? "none" : "auto", userSelect: "none" }}
            onPointerDown={e => {
              if (!draft.headerImage || e.target.closest("button, label, input")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: draft.imagePos?.x ?? 50, startPosY: draft.imagePos?.y ?? 50 };
              setIsDragging(true);
            }}
            onPointerMove={e => {
              if (!isDragging) return;
              const dx = e.clientX - dragRef.current.startX;
              const dy = e.clientY - dragRef.current.startY;
              up("imagePos", {
                x: Math.max(0, Math.min(100, dragRef.current.startPosX - dx * 0.13)),
                y: Math.max(0, Math.min(100, dragRef.current.startPosY - dy * 0.13)),
              });
            }}
            onPointerUp={() => setIsDragging(false)}
            onPointerCancel={() => setIsDragging(false)}
          >
            {draft.headerImage
              ? <>
                  <img
                    src={draft.headerImage} alt="portada" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${draft.imagePos?.x ?? 50}% ${draft.imagePos?.y ?? 50}%`, display: "block", pointerEvents: "none" }}
                  />
                  {!isDragging && (
                    <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", borderRadius: 20, padding: "5px 13px", fontSize: 11, color: "rgba(255,255,255,0.75)", pointerEvents: "none", whiteSpace: "nowrap" }}>
                      ✥ Arrastra para reencuadrar
                    </div>
                  )}
                </>
              : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: SUB }}>
                  <I.Image /><span style={{ fontSize: 13 }}>Portada del evento</span>
                </div>
            }
            <label style={{ position: "absolute", bottom: 12, right: 12, width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: imgBusy ? "wait" : "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", color: "#1a1e32" }}>
              {imgBusy ? <span style={{ fontSize: 11 }}>…</span> : <I.Image />}
              <span style={{ position: "absolute", bottom: 6, right: 6, background: "#1a1e32", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><I.Plus /></span>
              <input type="file" accept="image/*" hidden onChange={handleImage} ref={imgRef} />
            </label>
            {draft.headerImage && (
              <button type="button" onClick={() => { up("headerImage", ""); up("imagePos", { x: 50, y: 50 }); }} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 20, padding: "4px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Quitar</button>
            )}
          </div>

          {/* ── Event name ── */}
          <input
            type="text" placeholder="Nombre del evento"
            value={draft.title || ""}
            onChange={e => up("title", e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: CARD, border: BORDER, borderRadius: RADIUS, padding: "18px 20px", fontSize: 20, fontWeight: 600, color: TEXT, outline: "none", marginBottom: 12, caretColor: ACCENT, fontFamily: "inherit" }}
          />

          {/* ── Date card ── */}
          <div style={cardStyle}>
            {/* Inicio */}
            <button type="button" onClick={() => { setStartPicker(v => !v); setEndPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...rowDivider, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: startLabel ? TEXT : SUB }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Inicio</span>
                <span style={{ fontSize: 15, color: startLabel ? TEXT : SUB, fontWeight: startLabel ? 600 : 400 }}>{startLabel || "Seleccionar fecha"}</span>
              </div>
            </button>
            {startPicker && (
              <div style={{ padding: "0 12px 8px" }}>
                <WheelPanel date={draft.startDate} time={draft.startTime} minDate={today}
                  onChange={({ date, time }) => setDraft(p => ({ ...p, startDate: date, startTime: time, date, endDate: p.endDate || date }))}
                  onClose={() => setStartPicker(false)} />
              </div>
            )}
            {/* Fin */}
            <button type="button" onClick={() => { setEndPicker(v => !v); setStartPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${endLabel ? TEXT : SUB}`, background: "transparent" }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Fin</span>
                <span style={{ fontSize: 15, color: endLabel ? TEXT : SUB, fontWeight: endLabel ? 600 : 400 }}>{endLabel || "Seleccionar fecha"}</span>
              </div>
            </button>
            {endPicker && (
              <div style={{ padding: "0 12px 8px" }}>
                <WheelPanel date={draft.endDate} time={draft.endTime} minDate={draft.startDate || today}
                  onChange={({ date, time }) => setDraft(p => ({ ...p, endDate: date, endTime: time }))}
                  onClose={() => setEndPicker(false)} />
              </div>
            )}
          </div>

          {/* ── Location ── */}
          <div style={cardStyle}>
            {/* Physical location picker */}
            <button type="button" onClick={() => setShowLocModal(true)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...rowDivider, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.MapPin /></span>
                <span style={{ flex: 1, fontSize: 15, color: locLabel ? TEXT : SUB, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {locLabel || "Elegir ubicación"}
                </span>
                {locLabel
                  ? <span onClick={e => { e.stopPropagation(); setDraft(p => ({ ...p, address: "", lat: null, lng: null })); }} style={{ color: SUB, cursor: "pointer", flexShrink: 0 }}><I.X /></span>
                  : <span style={{ color: SUB, flexShrink: 0 }}><I.ChevronRight /></span>
                }
              </div>
            </button>

            {/* Virtual event toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", ...(draft.isVirtual ? rowDivider : {}) }}>
              <span style={{ color: SUB }}><I.Video /></span>
              <span style={{ flex: 1, fontSize: 15, color: TEXT }}>Evento virtual</span>
              <Toggle value={Boolean(draft.isVirtual)} onChange={v => up("isVirtual", v)} />
            </div>

            {/* Virtual URL input */}
            {draft.isVirtual && (
              <div style={{ padding: "4px 18px 14px" }}>
                <input
                  type="url"
                  inputMode="url"
                  placeholder="Enlace del evento (Zoom, Meet, Teams…)"
                  value={draft.virtualUrl || ""}
                  onChange={e => up("virtualUrl", e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: BORDER, borderRadius: 14, padding: "13px 16px", fontSize: 15, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>

          {/* ── Description ── */}
          <div style={cardStyle}>
            <button type="button" onClick={() => setShowDesc(v => !v)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...(showDesc ? rowDivider : {}), textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Text /></span>
                <span style={{ flex: 1, fontSize: 15, color: draft.eventDescription ? TEXT : SUB, textAlign: "left" }}>
                  {!showDesc && draft.eventDescription
                    ? draft.eventDescription.slice(0, 55) + (draft.eventDescription.length > 55 ? "…" : "")
                    : "Agregar descripción"}
                </span>
                <span style={{ color: SUB }}><I.ChevronRight /></span>
              </div>
            </button>
            {showDesc && (
              <div style={{ padding: "0 16px 16px" }}>
                <textarea
                  value={draft.eventDescription || ""}
                  onChange={e => up("eventDescription", e.target.value)}
                  placeholder="Describe tu evento: qué pasará, para quién es, qué traer…"
                  rows={5} autoFocus
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: TEXT, resize: "vertical", outline: "none", caretColor: ACCENT, lineHeight: 1.5, fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>

          {/* ── Entradas ── */}
          <p style={{ fontSize: 13, fontWeight: 600, color: SUB, marginBottom: 8, paddingLeft: 4 }}>Entradas</p>
          <div style={cardStyle}>
            {/* Require approval */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", ...rowDivider }}>
              <span style={{ color: SUB }}><I.Lock /></span>
              <span style={{ flex: 1, fontSize: 15, color: TEXT }}>Requerir aprobación</span>
              <Toggle value={Boolean(draft.requireApproval)} onChange={v => up("requireApproval", v)} />
            </div>

            {/* Price */}
            <button type="button"
              onClick={() => { if (draft.priceType !== "paid") up("priceType", "paid"); setShowPrice(true); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Dollar /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Precio</span>
                <span style={{ fontSize: 15, color: priceVal > 0 ? ACCENT : SUB, fontWeight: priceVal > 0 ? 600 : 400, display: "flex", alignItems: "center", gap: 4 }}>
                  {priceLabel} <I.ChevronRight />
                </span>
              </div>
            </button>
          </div>

          {/* ── Opciones ── */}
          <p style={{ fontSize: 13, fontWeight: 600, color: SUB, marginBottom: 8, paddingLeft: 4 }}>Opciones</p>
          <div style={cardStyle}>
            {/* Visibility */}
            <button type="button" onClick={() => setVisSheet(v => !v)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...rowDivider, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Globe /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Visibilidad</span>
                <span style={{ fontSize: 15, color: SUB, display: "flex", alignItems: "center", gap: 4 }}>{visLabel} <I.ChevronsUD /></span>
              </div>
            </button>
            {visSheet && (
              <div style={{ padding: "8px 16px 12px" }}>
                {[{ v: "public", l: "Público" }, { v: "private", l: "Privado" }].map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => { up("visibility", opt.v); setVisSheet(false); }}
                    style={{ width: "100%", padding: "12px 14px", marginBottom: 6, background: (draft.visibility || "public") === opt.v ? "rgba(107,159,212,0.2)" : "rgba(255,255,255,0.04)", border: (draft.visibility || "public") === opt.v ? "1px solid rgba(107,159,212,0.4)" : BORDER, borderRadius: 12, color: TEXT, fontSize: 15, cursor: "pointer", textAlign: "left" }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}

            {/* Capacity */}
            <button type="button" onClick={() => setShowCap(true)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Capacity /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Capacidad</span>
                <span style={{ fontSize: 15, color: (capVal && Number(capVal) > 0) ? ACCENT : SUB, fontWeight: (capVal && Number(capVal) > 0) ? 600 : 400, display: "flex", alignItems: "center", gap: 4 }}>
                  {capLabel} <I.ChevronsUD />
                </span>
              </div>
            </button>
          </div>

          {/* Error */}
          {err && (
            <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 14, padding: "12px 16px", marginTop: 4 }}>
              <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{err}</p>
            </div>
          )}

          {/* Bottom CTA */}
          <button type="button" onClick={handleSubmit} style={{ width: "100%", marginTop: 20, padding: 16, background: "rgba(107,159,212,0.25)", border: "1px solid rgba(107,159,212,0.4)", borderRadius: RADIUS, color: TEXT, fontWeight: 700, fontSize: 16, cursor: "pointer", letterSpacing: "0.02em" }}>
            Continuar →
          </button>
        </div>
      </div>

      {/* ── Price bottom sheet ── */}
      {showPrice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowPrice(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "rgba(18,20,38,0.98)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 2, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>Precio de entrada</p>
            <p style={{ fontSize: 13, color: SUB, margin: "0 0 16px" }}>Ingresa el valor en pesos colombianos (COP)</p>
            <input
              ref={priceRef}
              autoFocus
              type="number" inputMode="numeric" placeholder="Ej. 50000"
              value={draft.price || ""}
              onChange={e => up("price", e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 16, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button"
                onClick={() => { up("priceType", "free"); up("price", ""); setShowPrice(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 16, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Gratis
              </button>
              <button type="button"
                onClick={() => setShowPrice(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(107,159,212,0.25)", border: "1px solid rgba(107,159,212,0.4)", borderRadius: 16, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Capacity bottom sheet ── */}
      {showCap && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowCap(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "rgba(18,20,38,0.98)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 2, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>Capacidad del evento</p>
            <p style={{ fontSize: 13, color: SUB, margin: "0 0 16px" }}>Número máximo de asistentes (0 = ilimitada)</p>
            <input
              ref={capRef}
              autoFocus
              type="number" inputMode="numeric" min="0" max="1000" placeholder="Ilimitada"
              value={draft.capacityNum || ""}
              onChange={e => {
                const v = e.target.value;
                if (v === "" || (Number(v) >= 0 && Number(v) <= 1000)) up("capacityNum", v);
              }}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 16, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button"
                onClick={() => { up("capacityNum", ""); setShowCap(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 16, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Ilimitada
              </button>
              <button type="button"
                onClick={() => setShowCap(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(107,159,212,0.25)", border: "1px solid rgba(107,159,212,0.4)", borderRadius: 16, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location modal (full-screen) ── */}
      {showLocModal && (
        <LocationModal
          onSelect={item => {
            setDraft(p => ({ ...p, address: item.label, lat: item.lat, lng: item.lng }));
            setShowLocModal(false);
          }}
          onClose={() => setShowLocModal(false)}
        />
      )}
    </>
  );
}
