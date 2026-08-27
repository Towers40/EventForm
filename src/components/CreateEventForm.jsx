import { useState, useRef, useEffect, useCallback } from "react";
import { uploadImage } from "../lib/upload.js";
import { dominantColorFromFile, dominantColorFromUrl, eventTint } from "../lib/dominantColor.js";
import { EVENT_FONTS, DEFAULT_FONT_ID, getEventFont, loadAllEventFonts, loadEventFont, eventFontProps } from "../lib/fonts.js";
import { resolveLimit, hoursFor, minutesFor, clampToLimit, MINUTE_VALUES } from "../lib/datetime.js";
import { IconButton, IcoBack, EventTintLayer } from "./ui.jsx";

// ── Tokens ──────────────────────────────────────────────────────────────────
const CARD   = "rgba(255,255,255,0.08)";
const BORDER = "1px solid rgba(255,255,255,0.11)";
const RADIUS = 20;
const TEXT   = "#eef1f7";
const SUB    = "rgba(238,241,247,0.5)";
const ACCENT = "#7fb3e6";

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
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 420, maxHeight: "76vh", display: "flex", flexDirection: "column", background: "rgba(20,23,40,0.98)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 22, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              ref={inputRef}
              type="text" value={query} onChange={handleChange}
              placeholder="Buscar dirección o lugar…"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "11px 40px 11px 14px", fontSize: 15, color: "#eef1f7", outline: "none", caretColor: "#7fb3e6", fontFamily: "inherit" }}
            />
            {loading && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(238,241,247,0.4)" }}>…</span>}
          </div>
          <button type="button" onClick={onClose} className="ef-hover-fill" style={{ background: "rgba(127,179,230,0.16)", border: "1px solid rgba(127,179,230,0.32)", borderRadius: 999, color: "#bfd9f2", fontSize: 20, lineHeight: 1, width: 36, height: 36, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Suggestions */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p style={{ padding: "20px 20px", color: "rgba(238,241,247,0.4)", fontSize: 14, margin: 0 }}>Sin resultados. Intenta con otro término.</p>
          )}
          {query.trim().length < 2 && results.length === 0 && (
            <p style={{ padding: "20px 20px", color: "rgba(238,241,247,0.4)", fontSize: 14, margin: 0 }}>Escribe al menos 2 letras para buscar una dirección o lugar.</p>
          )}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="ef-hover-fill"
              style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 18px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
            >
              <svg style={{ flexShrink: 0, marginTop: 1 }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(127,179,230,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: 14, color: "#eef1f7", lineHeight: 1.4 }}>{item.label}</span>
            </button>
          ))}
        </div>
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
function addOneHour(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  if (Number.isNaN(h)) return t;
  if (h >= 23) return "23:59";
  return `${pad2(h + 1)}:${pad2(m || 0)}`;
}


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
      <div style={{ position: "absolute", left: 6, right: 6, top: ITEM_H * 2, height: ITEM_H, background: "rgba(255,255,255,0.07)", borderRadius: 14, pointerEvents: "none", zIndex: 1 }} />
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

function WheelPanel({ date, time, minDate, minTime, onChange, onClose }) {
  // La cota no es solo el día: si el día elegido es hoy, la hora tampoco puede
  // ser anterior a la actual. Antes solo se acotaba la fecha y se podía crear
  // un evento hoy a una hora ya pasada.
  const limit = resolveLimit({ minDate, minTime });
  const min = limit.date.split("-").map(Number); // [y, m, d]
  const now = new Date();

  // Selección normalizada a la cota, de una sola vez.
  const bruto = { date: date || limit.date, time: time || (limit.date === date || !date ? limit.time : "08:00") };
  const cur = clampToLimit(bruto, limit);
  const curDate = cur.date;
  const [sy, sm, sd] = curDate.split("-").map(Number);

  const hour   = parseInt(cur.time.split(":")[0], 10);
  const minRaw = parseInt(cur.time.split(":")[1], 10);
  const minute = MINUTE_VALUES.reduce((a, b) => Math.abs(b - minRaw) < Math.abs(a - minRaw) ? b : a);
  const curTime = `${pad2(hour)}:${pad2(minute)}`;

  // Horas y minutos que siguen siendo elegibles para el día seleccionado.
  const HOURS = hoursFor(curDate, limit);
  const MINUTES = minutesFor(curDate, hour, limit);

  // Build column ranges, respecting minDate as a lower bound.
  const minY = min[0];
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
    const mStart = (y === min[0]) ? min[1] : 1;
    const mm = Math.max(m, mStart);
    const dStart = (y === min[0] && mm === min[1]) ? min[2] : 1;
    const dd = Math.min(Math.max(d, dStart), daysInMonth(y, mm));
    // Al pasar a hoy con una hora de la mañana elegida, la hora también se
    // corrige: si no, quedaría en el pasado sin que el usuario lo tocara.
    onChange(clampToLimit({ date: `${y}-${pad2(mm)}-${pad2(dd)}`, time: curTime }, limit));
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
          onChange={h => onChange(clampToLimit({ date: curDate, time: `${pad2(h)}:${pad2(minute)}` }, limit))} />
        <WheelCol key="mi" flex={0.8} items={MINUTES} selectedKey={minute} getKey={i => i.value} getLabel={i => i.label}
          onChange={m => onChange(clampToLimit({ date: curDate, time: `${pad2(hour)}:${pad2(m)}` }, limit))} />
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: 11, background: "rgba(127,179,230,0.3)", border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
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
      <div style={{ position: "absolute", top: 3, left: value ? 24 : 3, width: 24, height: 24, borderRadius: 14, background: "#fff", transition: "left 0.22s", boxShadow: "0 2px 6px rgba(0,0,0,0.35)" }} />
    </div>
  );
}

// Paleta para elegir el color a mano. Son tonos medios y saturados a
// propósito: sobre el navy oscuro de la app, un pastel no se ve y un color
// apagado ensucia. El difuminado los baja de intensidad por sí solo.
const COLORES = [
  "#e0574a", "#e08a2e", "#d4b02f", "#5aad4f",
  "#2fa89c", "#3d8ad9", "#6a5ae0", "#a557d6", "#db5a94",
];

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
  Home:      () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>,
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CreateEventForm({ draft, setDraft, onDone, onCancel, user, avatarUrl, isEditing, onHome }) {
  const today = new Date().toISOString().split("T")[0];

  const [startPicker, setStartPicker] = useState(false);
  const [endPicker,   setEndPicker]   = useState(false);
  const [showLocModal,setShowLocModal]= useState(false);
  const [showDesc,    setShowDesc]    = useState(false);
  const [showPrice,   setShowPrice]   = useState(false);
  const [showCap,     setShowCap]     = useState(false);
  const [visSheet,    setVisSheet]    = useState(false);
  const [fontMenu,    setFontMenu]    = useState(false);
  const [showColor,   setShowColor]   = useState(false);
  // Color que da la portada actual. Se guarda aparte del elegido para poder
  // volver a él después de haber tocado otro a mano.
  const [colorPortada, setColorPortada] = useState(null);
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
  const fuente    = getEventFont(draft.fontId || DEFAULT_FONT_ID);
  const tinte     = eventTint(draft.themeColor);
  const initials  = (user?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // Al abrir un evento ya creado no se conoce el color de su portada (se
  // calculó el día que se subió). Se recalcula una vez, en segundo plano, para
  // poder ofrecer "el de la portada" en el selector de color.
  useEffect(() => {
    if (colorPortada || !draft.headerImage) return;
    let vivo = true;
    dominantColorFromUrl(draft.headerImage).then(c => { if (vivo && c) setColorPortada(c); });
    return () => { vivo = false; };
  }, [draft.headerImage, colorPortada]);

  // Solo se descarga la letra puesta; las otras cinco esperan a que se abra el
  // menú (ahí sí hay que enseñarlas escritas con su propia letra, o las seis
  // saldrían en Inter, que es justo lo que no sirve para elegir).
  useEffect(() => { loadEventFont(draft.fontId || DEFAULT_FONT_ID); }, [draft.fontId]);

  // Focus capacity input when opened
  useEffect(() => { if (showCap) capRef.current?.focus(); }, [showCap]);
  useEffect(() => { if (showPrice) priceRef.current?.focus(); }, [showPrice]);

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    try {
      // El color que más ocupa la portada pasa a ser el color del evento y
      // tiñe su página. Se calcula del archivo ORIGINAL, aquí mismo: una vez
      // subido a Cloudinary habría que volver a descargarlo para analizarlo.
      // Va en paralelo con la subida porque no depende de ella.
      const [url, color] = await Promise.all([
        uploadImage(file),
        dominantColorFromFile(file),
      ]);
      setColorPortada(color || null);
      // Si ya se eligió un color a mano, cambiar de portada NO lo pisa: sería
      // deshacer una decisión sin avisar. Se vuelve al de la portada desde el
      // propio selector de color.
      setDraft(p => ({
        ...p,
        headerImage: url,
        themeColor: p.themeColorManual ? p.themeColor : (color || null),
      }));
    }
    catch (ex) { alert(ex.message); }
    finally { setImgBusy(false); e.target.value = ""; }
  }

  function handleSubmit() {
    if (!draft.title?.trim()) { setErr("Ingresa el nombre del evento."); return; }
    if (!draft.startDate)     { setErr("Selecciona la fecha de inicio."); return; }
    if (!draft.startTime)     { setErr("Selecciona la hora de inicio."); return; }
    // La fecha/hora de fin no puede ser anterior ni igual a la de inicio.
    if (draft.endDate) {
      if (draft.endDate < draft.startDate) { setErr("La fecha de fin no puede ser anterior a la de inicio."); return; }
      if (draft.endDate === draft.startDate && draft.endTime && draft.startTime && draft.endTime <= draft.startTime) {
        setErr("La hora de fin debe ser posterior a la hora de inicio."); return;
      }
    }
    setErr("");
    onDone({ ...draft, capacity: draft.capacityNum ? String(draft.capacityNum) : "" });
  }

  const cardStyle = { background: CARD, border: BORDER, borderRadius: RADIUS, overflow: "hidden", marginBottom: 12 };
  const rowDivider = { borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <>
      <style>{`
        .ce-wheel::-webkit-scrollbar { display: none; }
        /* Sin fondo propio: hereda el degradado global de la página (antes pintaba
           su propio degradado sobre la columna y se veía como un recuadro). */
        .ce-bg { min-height: 100dvh; }
        .ce-scroll { max-width: 540px; margin: 0 auto; padding: 0 16px 100px; position: relative; z-index: 1; }
        .ce-header-inner { max-width: 540px; margin: 0 auto; }
        @media (min-width: 768px) { .ce-scroll { padding-bottom: 60px; } }
      `}</style>

      <div className="ce-bg">
        {/* En cuanto hay portada, la pantalla de creación se tiñe con su color:
            es la única forma de ver mientras se crea cómo va a quedar el
            evento. Es la MISMA capa que usa la página pública, así que lo que
            se ve aquí es literalmente lo que verá quien lo abra. */}
        <EventTintLayer tinte={tinte} />
        <div className="ce-scroll">
          {/* ── Volver (acción translúcida) — regresa a la pantalla anterior ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
            <IconButton title="Volver" tone="soft" onClick={onCancel}><IcoBack /></IconButton>
            <span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>{isEditing ? "Editar evento" : "Crear evento"}</span>
          </div>
          {/* ── Cover image ── */}
          <div
            style={{ position: "relative", margin: "20px 0 12px", borderRadius: 22, overflow: "hidden", aspectRatio: "1 / 1", background: draft.headerImage ? "none" : "rgba(255,255,255,0.05)", border: BORDER, cursor: draft.headerImage ? (isDragging ? "grabbing" : "grab") : "default", touchAction: draft.headerImage ? "none" : "auto", userSelect: "none" }}
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
                    <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", borderRadius: 22, padding: "5px 13px", fontSize: 11, color: "rgba(255,255,255,0.75)", pointerEvents: "none", whiteSpace: "nowrap" }}>
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
              <button type="button" className="ef-hover-fill" onClick={() => { setColorPortada(null); setDraft(p => ({ ...p, headerImage: "", imagePos: { x: 50, y: 50 }, ...(p.themeColorManual ? {} : { themeColor: null }) })); }} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 22, padding: "4px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Quitar</button>
            )}
          </div>

          {/* ── Nombre del evento ──
              La tipografía se elige AQUÍ, encima del nombre y antes de
              escribirlo, no escondida en "Opciones" al final: es una decisión
              sobre el nombre. Va detrás de un botón y no siempre desplegada:
              quien se quede con la letra de la app —la mayoría— no tiene que
              pasar por encima de seis opciones para escribir el título. */}
          <div style={{ ...cardStyle, padding: "10px 12px 14px" }}>

            {/* Botón: muestra la letra puesta, escrita con ella misma. */}
            <button
              type="button" className="ef-hover-fill"
              onClick={() => { if (!fontMenu) loadAllEventFonts(); setFontMenu(v => !v); }}
              aria-expanded={fontMenu}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                background: fontMenu ? "rgba(127,179,230,0.14)" : "rgba(255,255,255,0.05)",
                border: fontMenu ? "1px solid rgba(127,179,230,0.4)" : BORDER,
              }}
            >
              <span style={{
                flexShrink: 0, width: 30, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: fuente.family, fontWeight: fuente.headingWeight,
                letterSpacing: fuente.headingSpacing,
                fontSize: 17 * fuente.headingScale, color: TEXT,
              }}>
                Aa
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: SUB }}>Tipografía</span>
              <span style={{
                fontFamily: fuente.family, fontSize: 13.5, fontWeight: 600,
                color: (draft.fontId || DEFAULT_FONT_ID) === DEFAULT_FONT_ID ? SUB : ACCENT,
                whiteSpace: "nowrap",
              }}>
                {fuente.name}
              </span>
              <span style={{ flexShrink: 0, color: SUB, display: "flex", transform: fontMenu ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
                <I.ChevronDown />
              </span>
            </button>

            {/* Menú desplegado: las seis se reparten el ancho (flex: 1) en vez
                de medir fijo y desplazarse; una opción cortada por el borde no
                parece una opción, parece un fallo. */}
            {fontMenu && (
              <>
                <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                  {EVENT_FONTS.map(f => {
                    const activa = (draft.fontId || DEFAULT_FONT_ID) === f.id;
                    return (
                      <button
                        key={f.id} type="button" className="ef-hover-fill"
                        onClick={() => { up("fontId", f.id); setFontMenu(false); }}
                        aria-pressed={activa}
                        title={`${f.name} — ${f.note}`}
                        style={{
                          flex: "1 1 0", minWidth: 0, padding: "7px 2px 6px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                          borderRadius: 14, cursor: "pointer",
                          background: activa ? "rgba(127,179,230,0.2)" : "rgba(255,255,255,0.05)",
                          border: activa ? "1px solid rgba(127,179,230,0.5)" : BORDER,
                        }}
                      >
                        <span style={{
                          fontFamily: f.family, fontWeight: f.headingWeight,
                          letterSpacing: f.headingSpacing,
                          fontSize: 20 * f.headingScale, lineHeight: 1.15,
                          color: activa ? TEXT : "rgba(238,241,247,0.75)",
                        }}>
                          Aa
                        </span>
                        <span style={{ fontSize: 9, lineHeight: 1.2, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", color: activa ? ACCENT : SUB, fontWeight: activa ? 700 : 500 }}>
                          {f.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: "8px 4px 0", fontSize: 11.5, color: SUB, lineHeight: 1.4 }}>
                  {fuente.note}
                </p>
              </>
            )}

            {/* El nombre se escribe ya con la letra elegida. */}
            <div {...eventFontProps(draft.fontId)}>
              <input
                type="text" placeholder="Nombre del evento"
                value={draft.title || ""}
                onChange={e => up("title", e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", padding: "12px 8px 2px", fontSize: 20 * fuente.headingScale, fontWeight: fuente.headingWeight, color: TEXT, outline: "none", caretColor: ACCENT, letterSpacing: fuente.headingSpacing }}
              />
            </div>
          </div>

          {/* ── Date card ── */}
          <div style={cardStyle}>
            {/* Inicio */}
            <button type="button" className="ef-hover-fill" onClick={() => { setStartPicker(v => !v); setEndPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...rowDivider, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: startLabel ? TEXT : SUB }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Inicio</span>
                <span style={{ fontSize: 15, color: startLabel ? TEXT : SUB, fontWeight: startLabel ? 600 : 400 }}>{startLabel || "Seleccionar fecha"}</span>
              </div>
            </button>
            {/* Fin */}
            <button type="button" className="ef-hover-fill" onClick={() => { setEndPicker(v => !v); setStartPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <div style={{ width: 18, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${endLabel ? TEXT : SUB}`, background: "transparent" }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Fin</span>
                <span style={{ fontSize: 15, color: endLabel ? TEXT : SUB, fontWeight: endLabel ? 600 : 400 }}>{endLabel || "Seleccionar fecha"}</span>
              </div>
            </button>
          </div>

          {/* ── Date picker modal (centrado, mobile-first) ── */}
          {(startPicker || endPicker) && (
            <div
              onClick={() => { setStartPicker(false); setEndPicker(false); }}
              style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            >
              <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }}>
                <p style={{ margin: "0 0 4px", textAlign: "center", fontWeight: 700, fontSize: 15, color: TEXT }}>
                  {startPicker ? "Fecha de inicio" : "Fecha de fin"}
                </p>
                {startPicker && (
                  <WheelPanel date={draft.startDate} time={draft.startTime} minDate={today}
                    onChange={({ date, time }) => setDraft(p => {
                      const endDate = p.endDate || date;
                      let endTime = p.endTime;
                      // Si el fin queda el mismo día y su hora ya no es posterior, ajústala.
                      if (endDate === date && endTime && time && endTime <= time) endTime = addOneHour(time);
                      return { ...p, startDate: date, startTime: time, date, endDate, endTime };
                    })}
                    onClose={() => setStartPicker(false)} />
                )}
                {endPicker && (
                  // El fin tampoco puede ser anterior al inicio el mismo día.
                  <WheelPanel date={draft.endDate} time={draft.endTime} minDate={draft.startDate || today} minTime={draft.startTime}
                    onChange={({ date, time }) => setDraft(p => {
                      // No permitir hora de fin igual o anterior a la de inicio el mismo día.
                      let endTime = time;
                      if (date === p.startDate && p.startTime && time && time <= p.startTime) endTime = addOneHour(p.startTime);
                      return { ...p, endDate: date, endTime };
                    })}
                    onClose={() => setEndPicker(false)} />
                )}
              </div>
            </div>
          )}

          {/* ── Location ── */}
          <div style={cardStyle}>
            {/* Physical location picker */}
            <button type="button" className="ef-hover-fill" onClick={() => setShowLocModal(true)}
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
            <button type="button" className="ef-hover-fill" onClick={() => setShowDesc(v => !v)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...(showDesc ? rowDivider : {}), textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Text /></span>
                {/* El resumen es texto del evento: se lee con su letra. */}
                <span {...eventFontProps(draft.fontId, {
                  extraStyle: { flex: 1, fontSize: 15, color: draft.eventDescription ? TEXT : SUB, textAlign: "left" },
                })}>
                  {!showDesc && draft.eventDescription
                    ? draft.eventDescription.slice(0, 55) + (draft.eventDescription.length > 55 ? "…" : "")
                    : "Agregar descripción"}
                </span>
                <span style={{ color: SUB }}><I.ChevronRight /></span>
              </div>
            </button>
            {showDesc && (
              <div {...eventFontProps(draft.fontId, { extraStyle: { padding: "12px 16px 16px" } })}>
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

            {/* Entradas por persona */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", ...rowDivider }}>
              <span style={{ color: SUB, display: "flex" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/></svg>
              </span>
              <span style={{ flex: 1, fontSize: 15, color: TEXT }}>Entradas por persona</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button" className="ef-hover-fill" aria-label="Menos entradas"
                  onClick={() => up("maxPerUser", Math.max(1, (Number(draft.maxPerUser) || 1) - 1))}
                  disabled={(Number(draft.maxPerUser) || 1) <= 1}
                  style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.06)", border: BORDER, color: (Number(draft.maxPerUser) || 1) <= 1 ? "rgba(255,255,255,0.2)" : TEXT, fontSize: 17, fontWeight: 700, cursor: (Number(draft.maxPerUser) || 1) <= 1 ? "default" : "pointer", lineHeight: 1 }}>
                  −
                </button>
                <span style={{ minWidth: 26, textAlign: "center", fontSize: 15, fontWeight: 700, color: (Number(draft.maxPerUser) || 1) > 1 ? ACCENT : TEXT }}>
                  {Number(draft.maxPerUser) || 1}
                </span>
                <button type="button" className="ef-hover-fill" aria-label="Más entradas"
                  onClick={() => up("maxPerUser", Math.min(20, (Number(draft.maxPerUser) || 1) + 1))}
                  disabled={(Number(draft.maxPerUser) || 1) >= 20}
                  style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.06)", border: BORDER, color: (Number(draft.maxPerUser) || 1) >= 20 ? "rgba(255,255,255,0.2)" : TEXT, fontSize: 17, fontWeight: 700, cursor: (Number(draft.maxPerUser) || 1) >= 20 ? "default" : "pointer", lineHeight: 1 }}>
                  +
                </button>
              </div>
            </div>
            {(Number(draft.maxPerUser) || 1) > 1 && (
              <p style={{ fontSize: 12.5, color: SUB, margin: 0, padding: "0 18px 14px", lineHeight: 1.45, ...rowDivider }}>
                Cada persona podrá reservar hasta {draft.maxPerUser} entradas y recibirá un código QR por cada una.
              </p>
            )}

            {/* Sold out — solo al editar */}
            {isEditing && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", ...rowDivider }}>
                <span style={{ color: SUB, display: "flex" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                </span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT }}>Marcar como agotado</span>
                <Toggle value={Boolean(draft.manualSoldOut)} onChange={v => up("manualSoldOut", v)} />
              </div>
            )}

            {/* Price */}
            <button type="button" className="ef-hover-fill"
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
            <button type="button" className="ef-hover-fill" onClick={() => setVisSheet(v => !v)}
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
                  <button key={opt.v} type="button" className="ef-hover-fill"
                    onClick={() => { up("visibility", opt.v); setVisSheet(false); }}
                    style={{ width: "100%", padding: "12px 14px", marginBottom: 6, background: (draft.visibility || "public") === opt.v ? "rgba(127,179,230,0.2)" : "rgba(255,255,255,0.04)", border: (draft.visibility || "public") === opt.v ? "1px solid rgba(127,179,230,0.4)" : BORDER, borderRadius: 14, color: TEXT, fontSize: 15, cursor: "pointer", textAlign: "left" }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}

            {/* Capacity */}
            <button type="button" className="ef-hover-fill" onClick={() => setShowCap(true)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", ...rowDivider, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Capacity /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Capacidad</span>
                <span style={{ fontSize: 15, color: (capVal && Number(capVal) > 0) ? ACCENT : SUB, fontWeight: (capVal && Number(capVal) > 0) ? 600 : 400, display: "flex", alignItems: "center", gap: 4 }}>
                  {capLabel} <I.ChevronsUD />
                </span>
              </div>
            </button>

            {/* Color del evento. Lo pone la portada solo, pero se puede
                cambiar: hay portadas cuyo color dominante no es el que el
                organizador quiere para su evento. */}
            <button type="button" className="ef-hover-fill" onClick={() => setShowColor(true)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB, display: "flex" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
                  </svg>
                </span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT }}>
                  Color del evento
                  <span style={{ display: "block", fontSize: 12, color: SUB, marginTop: 2 }}>
                    {!draft.themeColor
                      ? "Sin color"
                      : draft.themeColorManual ? "Elegido a mano" : "Tomado de tu portada"}
                  </span>
                </span>
                <span aria-label={draft.themeColor ? `Color ${draft.themeColor}` : "Sin color"} style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: tinte ? tinte.hex : "rgba(255,255,255,0.08)",
                  border: `1px ${tinte ? "solid" : "dashed"} rgba(255,255,255,0.35)`,
                  boxShadow: tinte ? `0 0 0 4px ${tinte.soft}` : "none",
                }} />
                <span style={{ color: SUB, flexShrink: 0 }}><I.ChevronRight /></span>
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
          <button type="button" className="ef-hover-fill" onClick={handleSubmit} style={{ width: "100%", marginTop: 20, padding: 16, background: "rgba(52,199,89,0.18)", border: "1px solid rgba(52,199,89,0.45)", borderRadius: RADIUS, color: "#5ee07f", fontWeight: 800, fontSize: 16, cursor: "pointer", letterSpacing: "0.02em" }}>
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
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 18, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => { up("priceType", "free"); up("price", ""); setShowPrice(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Gratis
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowPrice(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(127,179,230,0.25)", border: "1px solid rgba(127,179,230,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
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
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 18, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => { up("capacityNum", ""); setShowCap(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Ilimitada
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowCap(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(127,179,230,0.25)", border: "1px solid rgba(127,179,230,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Color del evento ── */}
      {showColor && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowColor(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "rgba(18,20,38,0.98)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 2, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: TEXT, margin: "0 0 6px" }}>Color del evento</p>
            <p style={{ fontSize: 13, color: SUB, margin: "0 0 18px", lineHeight: 1.45 }}>
              Tiñe el fondo de la página del evento, la inscripción y la entrada.
              Lo pone tu portada, pero puedes cambiarlo.
            </p>

            {/* El de la portada, primero: es el que la app propone sola. */}
            {colorPortada && (
              <button type="button" className="ef-hover-fill"
                onClick={() => setDraft(p => ({ ...p, themeColor: colorPortada, themeColorManual: false }))}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", marginBottom: 14, borderRadius: 16, cursor: "pointer", textAlign: "left",
                  background: !draft.themeColorManual && draft.themeColor ? "rgba(127,179,230,0.18)" : "rgba(255,255,255,0.05)",
                  border: !draft.themeColorManual && draft.themeColor ? "1px solid rgba(127,179,230,0.45)" : BORDER,
                }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: colorPortada, border: "1px solid rgba(255,255,255,0.25)" }} />
                <span style={{ flex: 1, fontSize: 14.5, color: TEXT, fontWeight: 600 }}>
                  El de tu portada
                  <span style={{ display: "block", fontSize: 12, color: SUB, fontWeight: 400, marginTop: 2 }}>
                    El color que más ocupa la imagen
                  </span>
                </span>
                {!draft.themeColorManual && draft.themeColor && <span style={{ color: ACCENT }}><I.Check /></span>}
              </button>
            )}

            <p style={{ fontSize: 12, fontWeight: 700, color: SUB, margin: "0 0 10px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              O elige otro
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              {COLORES.map(c => {
                const activo = draft.themeColorManual && draft.themeColor?.toLowerCase() === c;
                return (
                  <button key={c} type="button" aria-label={`Color ${c}`} title={c}
                    onClick={() => setDraft(p => ({ ...p, themeColor: c, themeColorManual: true }))}
                    style={{
                      width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
                      background: c, padding: 0,
                      border: activo ? "2px solid #eef1f7" : "1px solid rgba(255,255,255,0.2)",
                      boxShadow: activo ? `0 0 0 4px ${c}55` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                    {activo && <I.Check />}
                  </button>
                );
              })}
              {/* Cualquier otro color, con el selector del sistema. */}
              <label title="Otro color" style={{
                width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "conic-gradient(#e0574a,#d4b02f,#5aad4f,#2fa89c,#3d8ad9,#6a5ae0,#db5a94,#e0574a)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(18,20,38,0.9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, lineHeight: 1 }}>+</span>
                <input type="color" value={draft.themeColor || "#3d8ad9"} hidden
                  onChange={e => setDraft(p => ({ ...p, themeColor: e.target.value, themeColorManual: true }))} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => setDraft(p => ({ ...p, themeColor: null, themeColorManual: true }))}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.07)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Sin color
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowColor(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(127,179,230,0.25)", border: "1px solid rgba(127,179,230,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Listo
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
