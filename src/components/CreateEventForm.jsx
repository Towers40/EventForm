import { useState, useRef, useEffect, useCallback } from "react";
import ColombiaAddressPicker from "./ColombiaAddressPicker.jsx";
import { compressHeaderImage } from "../lib/images.js";

// ── Tokens ──────────────────────────────────────────────────────────────────
const BG      = "linear-gradient(170deg, #1d2340 0%, #131628 100%)";
const CARD    = "rgba(255,255,255,0.08)";
const BORDER  = "1px solid rgba(255,255,255,0.11)";
const RADIUS  = 20;
const TEXT    = "#e8eaf0";
const SUB     = "rgba(232,234,240,0.5)";
const ACCENT  = "#6b9fd4";

// ── Spanish date formatting ─────────────────────────────────────────────────
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
  if (!base) return null;
  return timeStr ? `${base} · ${timeStr}` : base;
}

// ── Wheel picker internals ──────────────────────────────────────────────────
const ITEM_H  = 46;
const VISIBLE = 5;

function generateDates(minDate) {
  const opts = [];
  const start = minDate ? new Date(minDate + "T12:00:00") : new Date();
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    opts.push({ value: `${y}-${mo}-${dy}`, label: `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}` });
  }
  return opts;
}

const HOURS   = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, "0") }));
const MINUTES = [0, 15, 30, 45].map(m => ({ value: m, label: String(m).padStart(2, "0") }));

function WheelCol({ items, selectedKey, getKey, getLabel, onChange, flex }) {
  const ref    = useRef(null);
  const timer  = useRef(null);
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
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: `linear-gradient(to bottom,
          rgba(18,20,34,0.92) 0%,rgba(18,20,34,0.4) 22%,transparent 38%,
          transparent 62%,rgba(18,20,34,0.4) 78%,rgba(18,20,34,0.92) 100%)`,
      }} />
      <div style={{ position: "absolute", left: 6, right: 6, top: ITEM_H * 2, height: ITEM_H, background: "rgba(255,255,255,0.07)", borderRadius: 10, pointerEvents: "none", zIndex: 1 }} />
      <div ref={ref} onScroll={onScroll} className="ce-wheel" style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => (
          <div key={getKey(item)} style={{ height: ITEM_H, scrollSnapAlign: "center", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: i === live ? 19 : 16, fontWeight: i === live ? 700 : 400,
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
  const dates   = generateDates(minDate);
  const hour    = time ? parseInt(time.split(":")[0], 10) : 8;
  const minRaw  = time ? parseInt(time.split(":")[1], 10) : 0;
  const minute  = [0, 15, 30, 45].reduce((a, b) => Math.abs(b - minRaw) < Math.abs(a - minRaw) ? b : a);

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "rgba(18,20,34,0.95)", border: "1px solid rgba(255,255,255,0.1)", margin: "8px 0 0" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 6px" }}>
        {["Día", "Hr", "Min"].map((lbl, i) => (
          <div key={lbl} style={{ flex: i === 0 ? 2 : 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{lbl}</div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        <WheelCol flex={2} items={dates} selectedKey={date || dates[0]?.value} getKey={i => i.value} getLabel={i => i.label}
          onChange={d => onChange({ date: d, time })} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
        <WheelCol flex={1} items={HOURS} selectedKey={hour} getKey={i => i.value} getLabel={i => i.label}
          onChange={h => { const m = minute ?? 0; onChange({ date, time: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` }); }} />
        <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
        <WheelCol flex={1} items={MINUTES} selectedKey={minute} getKey={i => i.value} getLabel={i => i.label}
          onChange={m => { onChange({ date, time: `${String(hour ?? 8).padStart(2,"0")}:${String(m).padStart(2,"0")}` }); }} />
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={onClose} style={{ width: "100%", padding: 11, background: "rgba(107,159,212,0.3)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Listo
        </button>
      </div>
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 51, height: 30, borderRadius: 15, flexShrink: 0,
      background: value ? "#34c759" : "rgba(255,255,255,0.18)",
      position: "relative", cursor: "pointer", transition: "background 0.22s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: value ? 24 : 3, width: 24, height: 24,
        borderRadius: 12, background: "#fff", transition: "left 0.22s",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }} />
    </div>
  );
}

// ── Inline SVG icons ─────────────────────────────────────────────────────────
const I = {
  MapPin: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Text: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="14" x2="3" y2="14"/><line x1="15" y1="18" x2="3" y2="18"/></svg>,
  Lock: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Dollar: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Globe: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Capacity: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Check: () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  ChevronDown: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevronRight: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronsUD: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>,
  Image: () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Plus: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Clock: () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

// ── Bottom sheet helper ──────────────────────────────────────────────────────
function Sheet({ show, title, onClose, children }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", background: "#1a1e32", borderRadius: "24px 24px 0 0", padding: "0 0 env(safe-area-inset-bottom,0)", maxWidth: 560, width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>
        {title && <p style={{ margin: "0 0 4px", padding: "0 24px 12px", fontWeight: 700, fontSize: 16, color: TEXT, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{title}</p>}
        <div style={{ padding: "16px 20px 28px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Option list row ──────────────────────────────────────────────────────────
function OptionRow({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width: "100%", padding: "14px 16px", background: selected ? "rgba(107,159,212,0.2)" : "transparent",
      border: selected ? "1px solid rgba(107,159,212,0.4)" : "1px solid transparent",
      borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
      color: TEXT, fontSize: 15, cursor: "pointer", marginBottom: 8,
    }}>
      <span>{label}</span>
      {selected && <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13 }}>✓</span>}
    </button>
  );
}

// ── Row (icon + label + right content) ──────────────────────────────────────
function FormRow({ icon, label, right, onClick, children, noBorder }) {
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", minHeight: 54 }}>
      <span style={{ color: SUB, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 15, color: label ? TEXT : SUB }}>{label || children}</span>
      {right && <span style={{ fontSize: 15, color: SUB, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>{right}</span>}
    </div>
  );
  return onClick
    ? <button type="button" onClick={onClick} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.07)", textAlign: "left" }}>{inner}</button>
    : <div style={{ borderBottom: noBorder ? "none" : "1px solid rgba(255,255,255,0.07)" }}>{inner}</div>;
}

// ── CAPACITY options ─────────────────────────────────────────────────────────
const CAPACITY_OPTS = [
  { value: "", label: "Ilimitada" },
  { value: "0-50", label: "Hasta 50 personas" },
  { value: "50-100", label: "50 – 100 personas" },
  { value: "100-300", label: "100 – 300 personas" },
  { value: "300+", label: "Más de 300 personas" },
];

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CreateEventForm({ draft, setDraft, onDone, onCancel, user, avatarUrl }) {
  const today = new Date().toISOString().split("T")[0];

  const [startPicker, setStartPicker] = useState(false);
  const [endPicker,   setEndPicker]   = useState(false);
  const [showLoc,     setShowLoc]     = useState(false);
  const [showDesc,    setShowDesc]    = useState(false);
  const [priceSheet,  setPriceSheet]  = useState(false);
  const [visSheet,    setVisSheet]    = useState(false);
  const [capSheet,    setCapSheet]    = useState(false);
  const [imgBusy,     setImgBusy]     = useState(false);
  const [err,         setErr]         = useState("");

  const imgRef = useRef(null);

  const up = (k, v) => setDraft(p => ({ ...p, [k]: v }));

  const startLabel = fmtDateTime(draft.startDate, draft.startTime);
  const endLabel   = draft.endDate
    ? (draft.endDate === draft.startDate ? fmtDateTime(null, draft.endTime) || draft.endTime : fmtDateTime(draft.endDate, draft.endTime))
    : null;

  const locLabel = [draft.city, draft.address].filter(Boolean).join(" · ");

  const priceLabel = draft.priceType === "paid"
    ? (draft.price ? `$${Number(draft.price).toLocaleString("es-CO")}` : "De pago")
    : "Gratis";

  const capLabel = CAPACITY_OPTS.find(o => o.value === (draft.capacity || ""))?.label || "Ilimitada";
  const visLabel = draft.visibility === "private" ? "Privado" : "Público";

  const initials = (user?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

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
    onDone(draft);
  }

  const cardStyle = { background: CARD, border: BORDER, borderRadius: RADIUS, overflow: "hidden", marginBottom: 12 };

  return (
    <>
      <style>{`
        .ce-wheel::-webkit-scrollbar { display: none; }
        .ce-bg { background: ${BG}; min-height: 100dvh; }
        .ce-scroll { max-width: 540px; margin: 0 auto; padding: 0 16px 100px; }
        @media (min-width: 768px) {
          .ce-header-inner { max-width: 540px; margin: 0 auto; }
          .ce-scroll { padding-bottom: 60px; }
        }
      `}</style>

      <div className="ce-bg">
        {/* ── Sticky header ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(18,20,34,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 16px" }}>
          <div className="ce-header-inner" style={{ display: "flex", alignItems: "center", height: 60, gap: 12 }}>
            {/* Avatar */}
            <button type="button" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(107,159,212,0.3)", border: "1px solid rgba(107,159,212,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 13, fontWeight: 700, color: ACCENT }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials}
              </div>
              <span style={{ color: SUB }}><I.ChevronDown /></span>
            </button>

            {/* Title */}
            <p style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 17, color: TEXT, margin: 0 }}>Crear evento</p>

            {/* Confirm button */}
            <button type="button" onClick={handleSubmit} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(232,234,240,0.15)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TEXT, flexShrink: 0 }}>
              <I.Check />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="ce-scroll">

          {/* Cover image */}
          <div style={{ position: "relative", margin: "20px 0 12px", borderRadius: 20, overflow: "hidden", aspectRatio: "16/10", background: draft.headerImage ? "none" : "rgba(255,255,255,0.05)", border: BORDER }}>
            {draft.headerImage
              ? <img src={draft.headerImage} alt="portada" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: SUB }}>
                  <I.Image />
                  <span style={{ fontSize: 13 }}>Portada del evento</span>
                </div>
              )
            }
            {/* Upload button */}
            <label style={{ position: "absolute", bottom: 12, right: 12, width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: imgBusy ? "wait" : "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", color: "#1a1e32" }}>
              {imgBusy ? <span style={{ fontSize: 11 }}>…</span> : <><I.Image /><span style={{ position: "absolute", bottom: 6, right: 6, background: "#1a1e32", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><I.Plus /></span></>}
              <input type="file" accept="image/*" hidden onChange={handleImage} ref={imgRef} />
            </label>
            {draft.headerImage && (
              <button type="button" onClick={() => up("headerImage", "")} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 20, padding: "4px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Quitar</button>
            )}
          </div>

          {/* Event name */}
          <input
            type="text"
            placeholder="Nombre del evento"
            value={draft.title || ""}
            onChange={e => up("title", e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: CARD, border: BORDER, borderRadius: RADIUS, padding: "18px 20px", fontSize: 20, fontWeight: 600, color: TEXT, outline: "none", marginBottom: 12, caretColor: ACCENT }}
          />

          {/* Date card */}
          <div style={cardStyle}>
            {/* Inicio row */}
            <button type="button" onClick={() => { setStartPicker(v => !v); setEndPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", borderBottom: "1px solid rgba(255,255,255,0.07)", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                {/* Timeline */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: 18, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: startLabel ? TEXT : SUB }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Inicio</span>
                <span style={{ fontSize: 15, color: startLabel ? TEXT : SUB, fontWeight: startLabel ? 600 : 400 }}>
                  {startLabel || "Seleccionar fecha"}
                </span>
              </div>
            </button>

            {startPicker && (
              <div style={{ padding: "0 12px 8px" }}>
                <WheelPanel
                  date={draft.startDate} time={draft.startTime} minDate={today}
                  onChange={({ date, time }) => setDraft(p => ({ ...p, startDate: date, startTime: time, date: date, endDate: p.endDate || date }))}
                  onClose={() => setStartPicker(false)}
                />
              </div>
            )}

            {/* Fin row */}
            <button type="button" onClick={() => { setEndPicker(v => !v); setStartPicker(false); }}
              style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: 18, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${endLabel ? TEXT : SUB}`, background: "transparent" }} />
                </div>
                <span style={{ flex: 1, fontSize: 14, color: SUB }}>Fin</span>
                <span style={{ fontSize: 15, color: endLabel ? TEXT : SUB, fontWeight: endLabel ? 600 : 400 }}>
                  {endLabel || "Seleccionar fecha"}
                </span>
              </div>
            </button>

            {endPicker && (
              <div style={{ padding: "0 12px 8px" }}>
                <WheelPanel
                  date={draft.endDate} time={draft.endTime} minDate={draft.startDate || today}
                  onChange={({ date, time }) => setDraft(p => ({ ...p, endDate: date, endTime: time }))}
                  onClose={() => setEndPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div style={cardStyle}>
            <FormRow
              icon={<I.MapPin />}
              label={locLabel || null}
              right={<I.ChevronRight />}
              onClick={() => setShowLoc(v => !v)}
              noBorder={!showLoc}
            >
              {!locLabel && <span style={{ color: SUB }}>Elegir ubicación</span>}
            </FormRow>
            {showLoc && (
              <div style={{ padding: "0 16px 16px" }}>
                <ColombiaAddressPicker
                  value={{ city: draft.city, address: draft.address, lat: draft.lat, lng: draft.lng }}
                  onChange={loc => setDraft(p => ({ ...p, city: loc.city, address: loc.address, location: loc.location, lat: loc.lat, lng: loc.lng }))}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div style={cardStyle}>
            <FormRow
              icon={<I.Text />}
              label={(!showDesc && draft.eventDescription) ? draft.eventDescription.slice(0, 60) + (draft.eventDescription.length > 60 ? "…" : "") : null}
              right={<I.ChevronRight />}
              onClick={() => setShowDesc(v => !v)}
              noBorder={!showDesc}
            >
              {(showDesc || !draft.eventDescription) && <span style={{ color: draft.eventDescription ? TEXT : SUB }}>Agregar descripción</span>}
            </FormRow>
            {showDesc && (
              <div style={{ padding: "0 16px 16px" }}>
                <textarea
                  value={draft.eventDescription || ""}
                  onChange={e => up("eventDescription", e.target.value)}
                  placeholder="Describe tu evento: qué pasará, para quién es, qué traer…"
                  rows={5}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: TEXT, resize: "vertical", outline: "none", caretColor: ACCENT, lineHeight: 1.5, fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>

          {/* Entradas section */}
          <p style={{ fontSize: 13, fontWeight: 600, color: SUB, marginBottom: 8, paddingLeft: 4 }}>Entradas</p>
          <div style={cardStyle}>
            {/* Require approval */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span style={{ color: SUB }}><I.Lock /></span>
              <span style={{ flex: 1, fontSize: 15, color: TEXT }}>Requerir aprobación</span>
              <Toggle value={Boolean(draft.requireApproval)} onChange={v => up("requireApproval", v)} />
            </div>
            {/* Price */}
            <button type="button" onClick={() => setPriceSheet(true)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Dollar /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Precio</span>
                <span style={{ fontSize: 15, color: SUB, display: "flex", alignItems: "center", gap: 4 }}>
                  {priceLabel} <I.ChevronRight />
                </span>
              </div>
            </button>
          </div>

          {/* Opciones section */}
          <p style={{ fontSize: 13, fontWeight: 600, color: SUB, marginBottom: 8, paddingLeft: 4 }}>Opciones</p>
          <div style={cardStyle}>
            {/* Visibility */}
            <button type="button" onClick={() => setVisSheet(true)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Globe /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Visibilidad</span>
                <span style={{ fontSize: 15, color: SUB, display: "flex", alignItems: "center", gap: 4 }}>
                  {visLabel} <I.ChevronsUD />
                </span>
              </div>
            </button>
            {/* Capacity */}
            <button type="button" onClick={() => setCapSheet(true)} style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px" }}>
                <span style={{ color: SUB }}><I.Capacity /></span>
                <span style={{ flex: 1, fontSize: 15, color: TEXT, textAlign: "left" }}>Capacidad</span>
                <span style={{ fontSize: 15, color: SUB, display: "flex", alignItems: "center", gap: 4 }}>
                  {capLabel} <I.ChevronsUD />
                </span>
              </div>
            </button>
          </div>

          {/* Error message */}
          {err && (
            <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 14, padding: "12px 16px", marginTop: 4 }}>
              <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{err}</p>
            </div>
          )}

          {/* Mobile confirm button (bottom) */}
          <button type="button" onClick={handleSubmit} style={{ width: "100%", marginTop: 20, padding: "16px", background: "rgba(107,159,212,0.25)", border: "1px solid rgba(107,159,212,0.4)", borderRadius: RADIUS, color: TEXT, fontWeight: 700, fontSize: 16, cursor: "pointer", letterSpacing: "0.02em" }}>
            Continuar →
          </button>
        </div>
      </div>

      {/* ── Price sheet ── */}
      <Sheet show={priceSheet} title="Precio de entrada" onClose={() => setPriceSheet(false)}>
        <OptionRow label="Gratis" selected={draft.priceType !== "paid"} onClick={() => { up("priceType", "free"); up("price", ""); setPriceSheet(false); }} />
        <OptionRow label="De pago" selected={draft.priceType === "paid"} onClick={() => up("priceType", "paid")} />
        {draft.priceType === "paid" && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>Precio (COP)</p>
            <input
              type="number" inputMode="numeric" placeholder="Ej. 50000"
              value={draft.price || ""}
              onChange={e => up("price", e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: BORDER, borderRadius: 14, padding: "14px 16px", fontSize: 16, color: TEXT, outline: "none" }}
            />
            <button type="button" onClick={() => setPriceSheet(false)} style={{ width: "100%", marginTop: 12, padding: 13, background: "rgba(107,159,212,0.3)", border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Listo
            </button>
          </div>
        )}
      </Sheet>

      {/* ── Visibility sheet ── */}
      <Sheet show={visSheet} title="Visibilidad del evento" onClose={() => setVisSheet(false)}>
        {[{ value: "public", label: "Público — cualquiera puede ver y registrarse" }, { value: "private", label: "Privado — solo con enlace directo" }].map(opt => (
          <OptionRow key={opt.value} label={opt.label} selected={(draft.visibility || "public") === opt.value}
            onClick={() => { up("visibility", opt.value); setVisSheet(false); }} />
        ))}
      </Sheet>

      {/* ── Capacity sheet ── */}
      <Sheet show={capSheet} title="Capacidad del evento" onClose={() => setCapSheet(false)}>
        {CAPACITY_OPTS.map(opt => (
          <OptionRow key={opt.value} label={opt.label} selected={(draft.capacity || "") === opt.value}
            onClick={() => { up("capacity", opt.value); setCapSheet(false); }} />
        ))}
      </Sheet>
    </>
  );
}
