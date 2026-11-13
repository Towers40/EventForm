import { useState, useRef, useEffect, useCallback } from "react";
import { coverImgStyle } from "../lib/images.js";
import LocationSearch from "./LocationSearch.jsx";
import { uploadImage } from "../lib/upload.js";
import { dominantColorFromFile, dominantColorFromUrl, eventTint } from "../lib/dominantColor.js";
import { EVENT_FONTS, DEFAULT_FONT_ID, getEventFont, loadAllEventFonts, loadEventFont, eventFontProps } from "../lib/fonts.js";
import { resolveLimit, hoursFor, minutesFor, clampToLimit, MINUTE_VALUES } from "../lib/datetime.js";
import { IconButton, IcoBack, EventTintLayer } from "./ui.jsx";

// ── Tokens ──────────────────────────────────────────────────────────────────
// Superficies sólidas sin borde (sistema TapIn, ver src/lib/ds.jsx).
const CARD   = "var(--tf-surface)";
const BORDER = "none";
const RADIUS = 20;
const TEXT   = "#ffffff";
const SUB    = "rgba(229,238,255,0.5)";
const ACCENT = "#34d399";

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

/** Color del selector propio: tono (0–359) e intensidad 0 claro · 1 medio · 2 profundo. */
function colorDeHsl(h, intensidad) {
  const [sat, lum] = [[70, 66], [65, 52], [60, 38]][intensidad] || [65, 52];
  const s = sat / 100, l = lum / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
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
        background: `linear-gradient(to bottom,rgba(18,20,22,0.92) 0%,rgba(18,20,22,0.4) 22%,transparent 38%,transparent 62%,rgba(18,20,22,0.4) 78%,rgba(18,20,22,0.92) 100%)` }} />
      <div style={{ position: "absolute", left: 6, right: 6, top: ITEM_H * 2, height: ITEM_H, background: "rgba(255,255,255,0.12)", borderRadius: 14, pointerEvents: "none", zIndex: 1 }} />
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
    <div style={{ borderRadius: 18, overflow: "hidden", background: "var(--tf-sheet)", border: "1px solid rgba(255,255,255,0.1)", margin: "8px 0 0" }}>
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
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0" }} />
        <WheelCol key="h" flex={0.8} items={HOURS} selectedKey={hour} getKey={i => i.value} getLabel={i => i.label}
          onChange={h => onChange(clampToLimit({ date: curDate, time: `${pad2(h)}:${pad2(minute)}` }, limit))} />
        <WheelCol key="mi" flex={0.8} items={MINUTES} selectedKey={minute} getKey={i => i.value} getLabel={i => i.label}
          onChange={m => onChange(clampToLimit({ date: curDate, time: `${pad2(hour)}:${pad2(m)}` }, limit))} />
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: 11, background: "rgba(52,211,153,0.3)", border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Listo
        </button>
      </div>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 51, height: 30, borderRadius: 15, flexShrink: 0, background: value ? "#34d399" : "rgba(255,255,255,0.18)", position: "relative", cursor: "pointer", transition: "background 0.22s" }}>
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
export default function CreateEventForm({ draft, setDraft, onDone, onCancel, user, avatarUrl, isEditing, onHome, inApp = false }) {
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
  // Selector de color propio (el "+").
  const [colorLibre, setColorLibre] = useState(false);
  const [tonoLibre, setTonoLibre] = useState(210);
  const [intensidadLibre, setIntensidadLibre] = useState(1);
  const [err,         setErr]         = useState("");

  const imgRef   = useRef(null);
  const capRef   = useRef(null);
  const priceRef = useRef(null);

  const up = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const startLabel = fmtDateTime(draft.startDate, draft.startTime);
  const endLabel   = draft.endDate
    ? (draft.endDate === draft.startDate
        ? (draft.endTime || null)
        : fmtDateTime(draft.endDate, draft.endTime))
    : null;

  const locLabel  = draft.location && draft.address && !draft.address.startsWith(draft.location) ? `${draft.location} · ${draft.address}` : (draft.address || draft.location || "");
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

  // ── Gestos de la portada ──────────────────────────────────────────────────
  const coverBoxRef = useRef(null);
  const punterosRef = useRef(new Map());
  const gestoRef = useRef(null);
  const [natSize, setNatSize] = useState(null);
  const coverZoom = Math.max(1, Number(draft.imageZoom) || 1);
  // Tope de zoom según la resolución de la foto: el lado corto, dividido entre
  // los píxeles FÍSICOS del recuadro, con un 25 % de tolerancia. Más allá de
  // eso la foto se vería borrosa.
  // Ancho del recuadro en estado (no leído del ref durante el render).
  const [boxW, setBoxW] = useState(340);
  useEffect(() => {
    const el = coverBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setBoxW(Math.round(entry.contentRect.width) || 340));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxZoom = (() => {
    if (!natSize) return 1;
    const box = boxW;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const k = (Math.min(natSize.w, natSize.h) * 1.25) / (box * dpr);
    return Math.max(1, Math.min(4, Math.round(k * 100) / 100));
  })();
  const zoomEfectivo = Math.min(coverZoom, maxZoom);

  /** Cuánto % se mueve el encuadre por cada px arrastrado, en cada eje. */
  function pasoPorPx(z) {
    const B = coverBoxRef.current?.offsetWidth || 1;
    if (!natSize) return { x: 0, y: 0 };
    const s0 = B / Math.min(natSize.w, natSize.h);          // escala de "cover" en un recuadro cuadrado
    const sobraX = natSize.w * s0 * z - B;                   // lo que sobresale de la foto en cada eje
    const sobraY = natSize.h * s0 * z - B;
    return { x: sobraX > 0.5 ? 100 / sobraX : 0, y: sobraY > 0.5 ? 100 / sobraY : 0 };
  }
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

  function iniciarArrastre(px, py) {
    gestoRef.current = { modo: "mover", x: px, y: py, pos: { x: draft.imagePos?.x ?? 50, y: draft.imagePos?.y ?? 50 } };
  }
  function iniciarPellizco() {
    const [a, b] = [...punterosRef.current.values()];
    gestoRef.current = { modo: "zoom", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomEfectivo };
  }
  function coverPointerDown(e) {
    if (!draft.headerImage || e.target.closest("button, label, input")) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punterosRef.current.size >= 2) iniciarPellizco(); else iniciarArrastre(e.clientX, e.clientY);
    setIsDragging(true);
  }
  function coverPointerMove(e) {
    if (!punterosRef.current.has(e.pointerId) || !gestoRef.current) return;
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestoRef.current;
    if (g.modo === "zoom" && punterosRef.current.size >= 2) {
      const [a, b] = [...punterosRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      up("imageZoom", Math.round(limitar(g.zoom * (d / g.dist), 1, maxZoom) * 1000) / 1000);
      return;
    }
    const paso = pasoPorPx(zoomEfectivo);
    up("imagePos", {
      x: limitar(g.pos.x - (e.clientX - g.x) * paso.x, 0, 100),
      y: limitar(g.pos.y - (e.clientY - g.y) * paso.y, 0, 100),
    });
  }
  function coverPointerUp(e) {
    punterosRef.current.delete(e.pointerId);
    // Al soltar un dedo del pellizco se sigue moviendo con el otro, sin salto.
    if (punterosRef.current.size === 1) {
      const [p] = [...punterosRef.current.values()];
      iniciarArrastre(p.x, p.y);
    } else if (punterosRef.current.size === 0) {
      gestoRef.current = null;
      setIsDragging(false);
    }
  }
  // Rueda / pellizco de trackpad en escritorio. Va como listener nativo (no
  // pasivo) para poder evitar que la página haga zoom o se desplace.
  useEffect(() => {
    const el = coverBoxRef.current;
    if (!el || !draft.headerImage) return;
    const onWheel = (ev) => {
      if (!ev.ctrlKey && Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
      if (!ev.ctrlKey && !ev.altKey) return; // sin modificador, deja desplazar la página
      ev.preventDefault();
      setDraft(p => ({ ...p, imageZoom: Math.round(limitar((Number(p.imageZoom) || 1) * Math.exp(-ev.deltaY * 0.01), 1, maxZoom) * 1000) / 1000 }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [draft.headerImage, maxZoom, setDraft]);

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
      setNatSize(null);
      setDraft(p => ({
        ...p,
        headerImage: url,
        imagePos: { x: 50, y: 50 },
        imageZoom: 1,
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
        .ce-hue { flex: 1; -webkit-appearance: none; appearance: none; height: 14px; border-radius: 999px; outline: none;
          background: linear-gradient(90deg,#f00,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00); }
        .ce-hue::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 3px solid rgba(0,0,0,0.25); box-shadow: 0 1px 6px rgba(0,0,0,0.4); cursor: pointer; }
        .ce-hue::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 3px solid rgba(0,0,0,0.25); cursor: pointer; }
        .ce-zoom { flex: 1; -webkit-appearance: none; appearance: none; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.2); outline: none; }
        .ce-zoom::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.4); cursor: pointer; }
        .ce-zoom::-moz-range-thumb { width: 22px; height: 22px; border: none; border-radius: 50%; background: #fff; cursor: pointer; }
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
          {/* Título. La flecha de volver vive en el encabezado de la app; solo
              se pinta aquí cuando el formulario se usa fuera de él (bienvenida,
              sin sesión), donde no hay encabezado. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            {!inApp && <IconButton title="Volver" tone="soft" onClick={onCancel}><IcoBack /></IconButton>}
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", color: TEXT }}>{isEditing ? "Editar evento" : "Crear evento"}</h1>
          </div>
          {/* ── Portada ──
              Con foto: se arrastra en cualquier dirección y se acerca con dos
              dedos (o rueda/trackpad, o el deslizador de abajo). El tope del
              zoom sale de la resolución REAL de la foto, para no acercar más
              allá de lo que se ve nítido. Ver coverImgStyle (lib/images.js). */}
          <div
            ref={coverBoxRef}
            style={{ position: "relative", margin: "20px 0 12px", borderRadius: 22, overflow: "hidden", aspectRatio: "1 / 1", background: draft.headerImage ? "#000" : "var(--tf-surface)", border: BORDER, cursor: draft.headerImage ? (isDragging ? "grabbing" : "grab") : "default", touchAction: draft.headerImage ? "none" : "auto", userSelect: "none" }}
            onPointerDown={coverPointerDown}
            onPointerMove={coverPointerMove}
            onPointerUp={coverPointerUp}
            onPointerCancel={coverPointerUp}
          >
            {draft.headerImage
              ? <>
                  <img
                    src={draft.headerImage} alt="portada" draggable={false}
                    onLoad={e => setNatSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ ...coverImgStyle(draft.imagePos, zoomEfectivo), pointerEvents: "none" }}
                  />
                  {!isDragging && (
                    <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", borderRadius: 22, padding: "6px 13px", fontSize: 12, color: "rgba(255,255,255,0.85)", pointerEvents: "none", whiteSpace: "nowrap" }}>
                      ✥ Arrastra para mover{maxZoom > 1.05 ? " · pellizca para acercar" : ""}
                    </div>
                  )}
                </>
              : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: SUB }}>
                  <I.Image /><span style={{ fontSize: 13 }}>Portada del evento</span>
                </div>
            }
            <label style={{ position: "absolute", bottom: 12, right: 12, width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: imgBusy ? "wait" : "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", color: "#17181b" }}>
              {imgBusy ? <span style={{ fontSize: 11 }}>…</span> : <I.Image />}
              <span style={{ position: "absolute", bottom: 6, right: 6, background: "#17181b", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><I.Plus /></span>
              <input type="file" accept="image/*" hidden onChange={handleImage} ref={imgRef} />
            </label>
            {draft.headerImage && (
              <button type="button" className="ef-hover-fill" onClick={() => { setColorPortada(null); setNatSize(null); setDraft(p => ({ ...p, headerImage: "", imagePos: { x: 50, y: 50 }, imageZoom: 1, ...(p.themeColorManual ? {} : { themeColor: null }) })); }} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 22, padding: "5px 11px", color: "#fff", fontSize: 12, cursor: "pointer" }}>Quitar</button>
            )}
          </div>

          {/* Zoom: alternativa visible al pellizco (y la única en escritorio sin trackpad). */}
          {draft.headerImage && maxZoom > 1.05 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "-2px 6px 14px" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={SUB} strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6" /></svg>
              <input type="range" className="ce-zoom" min={1} max={maxZoom} step={0.01} value={zoomEfectivo}
                aria-label="Acercar portada"
                onChange={e => up("imageZoom", Number(e.target.value))} />
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={SUB} strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6M11 8v6" /></svg>
            </div>
          )}

          {/* ── Nombre del evento ──
              La tipografía se elige AQUÍ, en el propio campo del nombre: es
              una decisión sobre el nombre, no un ajuste más del final. El
              control es un recuadro pequeño al lado del título, y su menú se
              abre FLOTANDO por encima de la pantalla —no empujando el resto
              hacia abajo—, para que el campo no se mueva de sitio mientras se
              prueba una letra y otra. */}
          <div style={{ ...cardStyle, overflow: "visible", position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 16px" }}>
            <div {...eventFontProps(draft.fontId, { extraStyle: { flex: 1, minWidth: 0 } })}>
              <input
                type="text" placeholder="Nombre del evento"
                value={draft.title || ""}
                onChange={e => up("title", e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", padding: "12px 0", fontSize: 20 * fuente.headingScale, fontWeight: fuente.headingWeight, color: TEXT, outline: "none", caretColor: ACCENT, letterSpacing: fuente.headingSpacing }}
              />
            </div>

            {/* El recuadro: la letra puesta, escrita con ella misma. */}
            <button
              type="button" className="ef-hover-fill"
              onClick={() => { if (!fontMenu) loadAllEventFonts(); setFontMenu(v => !v); }}
              aria-expanded={fontMenu}
              aria-label={`Tipografía: ${fuente.name}`}
              title={`Tipografía: ${fuente.name}`}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                height: 38, padding: "0 8px", borderRadius: 12, cursor: "pointer",
                background: fontMenu ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)",
                border: fontMenu ? "1px solid rgba(52,211,153,0.45)" : BORDER,
                color: fontMenu ? TEXT : "rgba(229,238,255,0.8)",
              }}
            >
              <span style={{
                fontFamily: fuente.family, fontWeight: fuente.headingWeight,
                letterSpacing: fuente.headingSpacing,
                fontSize: 16 * fuente.headingScale, lineHeight: 1,
              }}>
                Aa
              </span>
              <span style={{ display: "flex", color: SUB, transform: fontMenu ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}>
                <I.ChevronDown />
              </span>
            </button>

            {/* Ventana flotante. La capa de debajo cierra al tocar fuera: sin
                ella habría que acertarle otra vez al recuadro. */}
            {fontMenu && (
              <>
                <div
                  onClick={() => setFontMenu(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  role="listbox"
                  style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
                    width: 232, maxWidth: "calc(100vw - 40px)",
                    background: "rgba(22,24,27,0.98)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.14)", borderRadius: 18,
                    boxShadow: "0 18px 50px rgba(0,0,0,0.55)", padding: 6, overflow: "hidden",
                  }}
                >
                  {EVENT_FONTS.map(f => {
                    const activa = (draft.fontId || DEFAULT_FONT_ID) === f.id;
                    return (
                      <button
                        key={f.id} type="button" className="ef-hover-fill"
                        role="option" aria-selected={activa}
                        onClick={() => { up("fontId", f.id); setFontMenu(false); }}
                        title={f.note}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                          background: activa ? "rgba(52,211,153,0.18)" : "transparent",
                          border: "none",
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 30, textAlign: "center",
                          fontFamily: f.family, fontWeight: f.headingWeight,
                          letterSpacing: f.headingSpacing,
                          fontSize: 18 * f.headingScale, lineHeight: 1.1,
                          color: activa ? TEXT : "rgba(229,238,255,0.85)",
                        }}>
                          Aa
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: activa ? TEXT : "rgba(229,238,255,0.9)", lineHeight: 1.25 }}>
                            {f.name}
                          </span>
                          <span style={{ display: "block", fontSize: 10.5, color: SUB, lineHeight: 1.25 }}>
                            {f.tagline}
                          </span>
                        </span>
                        {activa && <span style={{ color: ACCENT, display: "flex", flexShrink: 0 }}><I.Check /></span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
                  ? <span onClick={e => { e.stopPropagation(); setDraft(p => ({ ...p, address: "", location: "", lat: null, lng: null })); }} style={{ color: SUB, cursor: "pointer", flexShrink: 0 }}><I.X /></span>
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
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.10)", border: BORDER, borderRadius: 14, padding: "13px 16px", fontSize: 15, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit" }}
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
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: TEXT, resize: "vertical", outline: "none", caretColor: ACCENT, lineHeight: 1.5, fontFamily: "inherit" }}
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
                  style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.11)", border: BORDER, color: (Number(draft.maxPerUser) || 1) <= 1 ? "rgba(255,255,255,0.2)" : TEXT, fontSize: 17, fontWeight: 700, cursor: (Number(draft.maxPerUser) || 1) <= 1 ? "default" : "pointer", lineHeight: 1 }}>
                  −
                </button>
                <span style={{ minWidth: 26, textAlign: "center", fontSize: 15, fontWeight: 700, color: (Number(draft.maxPerUser) || 1) > 1 ? ACCENT : TEXT }}>
                  {Number(draft.maxPerUser) || 1}
                </span>
                <button type="button" className="ef-hover-fill" aria-label="Más entradas"
                  onClick={() => up("maxPerUser", Math.min(20, (Number(draft.maxPerUser) || 1) + 1))}
                  disabled={(Number(draft.maxPerUser) || 1) >= 20}
                  style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.11)", border: BORDER, color: (Number(draft.maxPerUser) || 1) >= 20 ? "rgba(255,255,255,0.2)" : TEXT, fontSize: 17, fontWeight: 700, cursor: (Number(draft.maxPerUser) || 1) >= 20 ? "default" : "pointer", lineHeight: 1 }}>
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
                    style={{ width: "100%", padding: "12px 14px", marginBottom: 6, background: (draft.visibility || "public") === opt.v ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)", border: (draft.visibility || "public") === opt.v ? "1px solid rgba(52,211,153,0.4)" : BORDER, borderRadius: 14, color: TEXT, fontSize: 15, cursor: "pointer", textAlign: "left" }}>
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
          <button type="button" className="soft-btn soft-btn-primary" onClick={handleSubmit} style={{ width: "100%", marginTop: 20 }}>
            Continuar
          </button>
        </div>
      </div>

      {/* ── Price bottom sheet ── */}
      {showPrice && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowPrice(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "var(--tf-sheet)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
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
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.12)", border: BORDER, borderRadius: 18, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => { up("priceType", "free"); up("price", ""); setShowPrice(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.12)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Gratis
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowPrice(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(52,211,153,0.25)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Capacity bottom sheet ── */}
      {showCap && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowCap(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "var(--tf-sheet)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
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
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.12)", border: BORDER, borderRadius: 18, padding: "16px 18px", fontSize: 22, color: TEXT, outline: "none", caretColor: ACCENT, fontFamily: "inherit", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => { up("capacityNum", ""); setShowCap(false); }}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.12)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Ilimitada
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowCap(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(52,211,153,0.25)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Color del evento ── */}
      {showColor && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)" }} onClick={() => setShowColor(false)}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxWidth: 540, margin: "0 auto", background: "var(--tf-sheet)", borderRadius: "24px 24px 0 0", padding: "28px 20px 44px", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.11)", borderBottom: "none" }}
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
                  background: !draft.themeColorManual && draft.themeColor ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)",
                  border: !draft.themeColorManual && draft.themeColor ? "1px solid rgba(52,211,153,0.45)" : BORDER,
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
                      border: activo ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.2)",
                      boxShadow: activo ? `0 0 0 4px ${c}55` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                    {activo && <I.Check />}
                  </button>
                );
              })}
              {/* Cualquier otro color. Antes abría el selector del sistema con un
                  <input type="color" hidden>, y Safari de iOS no abre el de un
                  campo oculto: el "+" no hacía nada. Ahora es un selector
                  propio (tono + intensidad) que funciona igual en todas partes. */}
              {(() => {
                const propio = draft.themeColorManual && draft.themeColor && !COLORES.includes(draft.themeColor.toLowerCase());
                return (
                  <button type="button" title="Otro color" aria-label="Elegir otro color" aria-expanded={colorLibre}
                    onClick={() => setColorLibre(v => !v)}
                    style={{
                      width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0, padding: 0,
                      border: propio || colorLibre ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.2)",
                      background: propio ? draft.themeColor : "conic-gradient(#e0574a,#d4b02f,#5aad4f,#2fa89c,#3d8ad9,#6a5ae0,#db5a94,#e0574a)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    }}>
                    {propio ? <I.Check /> : <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(18,20,22,0.9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, lineHeight: 1 }}>+</span>}
                  </button>
                );
              })()}
            </div>

            {colorLibre && (
              <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 14px 12px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: "50%", background: colorDeHsl(tonoLibre, intensidadLibre), flexShrink: 0, border: "2px solid rgba(255,255,255,0.85)" }} />
                  <input type="range" className="ce-hue" min={0} max={359} value={tonoLibre} aria-label="Tono"
                    onChange={e => { const h = Number(e.target.value); setTonoLibre(h); setDraft(p => ({ ...p, themeColor: colorDeHsl(h, intensidadLibre), themeColorManual: true })); }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["Claro", 0], ["Medio", 1], ["Profundo", 2]].map(([etq, i]) => (
                    <button key={etq} type="button" onClick={() => { setIntensidadLibre(i); setDraft(p => ({ ...p, themeColor: colorDeHsl(tonoLibre, i), themeColorManual: true })); }}
                      style={{
                        flex: 1, height: 36, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 500,
                        border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        background: intensidadLibre === i ? "#ffffff" : "rgba(255,255,255,0.1)",
                        color: intensidadLibre === i ? "#000" : "#fff",
                      }}>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: colorDeHsl(tonoLibre, i) }} />{etq}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="ef-hover-fill"
                onClick={() => setDraft(p => ({ ...p, themeColor: null, themeColorManual: true }))}
                style={{ flex: 1, padding: "14px 0", background: "rgba(255,255,255,0.12)", border: BORDER, borderRadius: 18, color: SUB, fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                Sin color
              </button>
              <button type="button" className="ef-hover-fill"
                onClick={() => setShowColor(false)}
                style={{ flex: 2, padding: "14px 0", background: "rgba(52,211,153,0.25)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 18, color: TEXT, fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location modal (full-screen) ── */}
      {showLocModal && (
        <LocationSearch
          initialCity={draft.city}
          onSelect={item => {
            // Ahora también se guarda la CIUDAD (antes solo dirección y
            // coordenadas): sin ella el evento no salía al filtrar por ciudad
            // en Descubrir ni en su tarjeta.
            setDraft(p => ({ ...p, address: item.address, location: item.location, city: item.city || p.city, lat: item.lat, lng: item.lng }));
            setShowLocModal(false);
          }}
          onClose={() => setShowLocModal(false)}
        />
      )}
    </>
  );
}
