import { useState, useRef, useEffect, useCallback } from "react";
import { resolveLimit, hoursFor, minutesFor, clampToLimit, MINUTE_VALUES } from "../lib/datetime.js";

const MONTHS_ES  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAYS_ES    = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const ITEM_H     = 46; // height per row (px)
const VISIBLE    = 5;  // rows shown at once

function generateDates(desde) {
  const opts = [];
  const start = new Date(desde + "T12:00:00");
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    opts.push({
      value: `${y}-${mo}-${dy}`,
      label: `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES[d.getMonth()]}`,
    });
  }
  return opts;
}


function parseDateLabel(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d);
  return `${DAYS_ES[dt.getDay()]} ${d} ${MONTHS_ES[mo - 1]}`;
}

function parseTimeLabel(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h)) return null;
  return `${String(h).padStart(2,"0")}:${String(m||0).padStart(2,"0")}`;
}

// ── Wheel column ──────────────────────────────────────────────────────────────
function WheelCol({ items, selectedKey, getKey, getLabel, onChange, flex }) {
  const ref     = useRef(null);
  const timer   = useRef(null);
  const [liveIdx, setLiveIdx] = useState(() => Math.max(0, items.findIndex(i => getKey(i) === selectedKey)));

  // Scroll to selection on open
  useEffect(() => {
    const idx = items.findIndex(i => getKey(i) === selectedKey);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTop = idx * ITEM_H;
      setLiveIdx(idx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    if (!ref.current) return;
    const raw = Math.round(ref.current.scrollTop / ITEM_H);
    const idx = Math.max(0, Math.min(raw, items.length - 1));
    setLiveIdx(idx);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange(getKey(items[idx]));
    }, 180);
  }, [items, onChange, getKey]);

  return (
    <div style={{ flex: flex || 1, position: "relative", height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      {/* Top/bottom fade gradient */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: `linear-gradient(to bottom,
          rgba(14,16,18,0.92) 0%,
          rgba(14,16,18,0.4) 22%,
          transparent 38%,
          transparent 62%,
          rgba(14,16,18,0.4) 78%,
          rgba(14,16,18,0.92) 100%)`,
      }} />
      {/* Center highlight bar */}
      <div style={{
        position: "absolute", left: 6, right: 6,
        top: ITEM_H * 2, height: ITEM_H,
        background: "rgba(255,255,255,0.07)",
        borderRadius: 14, pointerEvents: "none", zIndex: 1,
      }} />
      {/* Scrollable list */}
      <div
        ref={ref}
        onScroll={handleScroll}
        style={{
          height: "100%", overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          position: "relative", zIndex: 0,
        }}
        className="wheel-col-inner"
      >
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => {
          const active = i === liveIdx;
          return (
            <div
              key={getKey(item)}
              style={{
                height: ITEM_H,
                scrollSnapAlign: "center",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: active ? 19 : 16,
                fontWeight: active ? 700 : 400,
                color: active ? "#ffffff" : "rgba(255,255,255,0.28)",
                userSelect: "none",
                letterSpacing: active ? "0.02em" : 0,
                transition: "color 0.08s, font-size 0.08s",
              }}
            >
              {getLabel(item)}
            </div>
          );
        })}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DateTimePicker({ date, time, onChange, minDate, minTime, label }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState(null);
  const wrapRef           = useRef(null);
  // La cota incluye la HORA: en el día de hoy no se pueden ofrecer horas ya
  // pasadas. Antes solo se acotaba el día y se podía crear un evento hoy a una
  // hora anterior a la actual.
  const limit             = resolveLimit({ minDate, minTime });
  const dateOptions       = generateDates(limit.date);

  const curDate = date || limit.date;
  const hour   = time ? parseInt(time.split(":")[0], 10) : null;
  const minute = time ? parseInt(time.split(":")[1], 10) : null;
  // Round minute to nearest 15 for wheel
  const minuteSnapped = minute != null ? MINUTE_VALUES.reduce((a, b) => Math.abs(b - minute) < Math.abs(a - minute) ? b : a) : null;

  const HOURS   = hoursFor(curDate, limit);
  const MINUTES = minutesFor(curDate, hour ?? HOURS[0]?.value ?? 8, limit);
  const emit    = (d, t) => onChange(clampToLimit({ date: d, time: t }, limit));

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openPicker(btnRef) {
    const rect = btnRef?.getBoundingClientRect?.() || wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const W = Math.min(320, window.innerWidth - 16);
    let left = rect.left;
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
    if (left < 8) left = 8;
    let top = rect.bottom + 10;
    const H = ITEM_H * VISIBLE + 2;
    if (top + H > window.innerHeight - 12) top = Math.max(8, rect.top - H - 10);
    setPos({ top, left, width: W });
    setOpen(s => !s);
  }

  const triggerStyle = (filled) => ({
    minHeight: 58, flexShrink: 0,
    border: `1.5px solid ${filled ? "#7fb3e6" : "rgba(255,255,255,0.13)"}`,
    borderRadius: 14,
    background: filled ? "rgba(26,95,138,0.18)" : "rgba(255,255,255,0.04)",
    cursor: "pointer", padding: "0 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  });

  const dateFmt = parseDateLabel(date);
  const timeFmt = parseTimeLabel(time);

  return (
    <>
      <style>{`.wheel-col-inner::-webkit-scrollbar { display: none; }`}</style>

      {label && (
        <p style={{ fontSize: 11, fontWeight: 800, color: "#5c6b7a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          {label}
        </p>
      )}

      {/* Trigger buttons */}
      <div ref={wrapRef} style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={(e) => openPicker(e.currentTarget)}
          style={{ ...triggerStyle(!!date), flex: 1 }}
        >
          <span style={{ fontSize: 15, fontWeight: date ? 700 : 400, color: date ? "#eef1f7" : "#7fb3e6", whiteSpace: "nowrap" }}>
            {dateFmt || "Fecha"}
          </span>
          <span style={{ fontSize: 11, color: "#8fa3b1" }}>▾</span>
        </button>

        <button
          type="button"
          onClick={(e) => openPicker(e.currentTarget)}
          style={{ ...triggerStyle(!!time), width: 110 }}
        >
          <span style={{ fontSize: 15, fontWeight: time ? 700 : 400, color: time ? "#eef1f7" : "#7fb3e6", whiteSpace: "nowrap" }}>
            {timeFmt || "Hora"}
          </span>
          <span style={{ fontSize: 11, color: "#8fa3b1" }}>▾</span>
        </button>
      </div>

      {/* Wheel picker popup */}
      {open && pos && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
          width: pos.width,
          background: "rgba(14,16,18,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}>
          {/* Column separators label row */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 6px" }}>
            <div style={{ flex: 2, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Día</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Hr</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Min</div>
          </div>

          {/* Three-column wheel */}
          <div style={{ display: "flex" }}>
            {/* Date column */}
            <WheelCol
              flex={2}
              items={dateOptions}
              selectedKey={curDate}
              getKey={i => i.value}
              getLabel={i => i.label}
              onChange={d => emit(d, time || limit.time)}
            />
            {/* Vertical divider */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.07)", alignSelf: "stretch", margin: "8px 0" }} />
            {/* Hour column */}
            <WheelCol
              flex={1}
              items={HOURS}
              selectedKey={hour ?? HOURS[0]?.value ?? 8}
              getKey={i => i.value}
              getLabel={i => i.label}
              onChange={h => {
                const m = minuteSnapped ?? 0;
                emit(curDate, `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
              }}
            />
            {/* Vertical divider */}
            <div style={{ width: 1, background: "rgba(255,255,255,0.07)", alignSelf: "stretch", margin: "8px 0" }} />
            {/* Minute column */}
            <WheelCol
              flex={1}
              items={MINUTES}
              selectedKey={minuteSnapped ?? 0}
              getKey={i => i.value}
              getLabel={i => i.label}
              onChange={m => {
                const h = hour ?? HOURS[0]?.value ?? 8;
                emit(curDate, `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
              }}
            />
          </div>

          {/* Done button */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: "100%", padding: "11px",
                background: "rgba(26,95,138,0.5)",
                border: "none", borderRadius: 14,
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
