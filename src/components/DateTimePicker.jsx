import { useState, useRef, useEffect } from "react";

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_LONG  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT   = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const ampm = h < 12 ? "AM" : "PM";
      const h12  = h % 12 || 12;
      opts.push({
        label: `${h12}:${String(m).padStart(2,"0")} ${ampm}`,
        value: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`,
      });
    }
  }
  return opts;
})();

function parseDateParts(dateStr) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return { year: y, month: mo, day: d };
}

function formatTime12(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year, month) { return new Date(year, month - 1, 1).getDay(); }

export default function DateTimePicker({ date, time, onChange, minDate, label }) {
  const today    = new Date();
  const parts    = parseDateParts(date);
  const timeFmt  = formatTime12(time);

  const initYear  = parts?.year  || today.getFullYear();
  const initMonth = parts?.month || today.getMonth() + 1;

  const [showCal,  setShowCal]  = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [calYear,  setCalYear]  = useState(initYear);
  const [calMonth, setCalMonth] = useState(initMonth);
  const [calPos,   setCalPos]   = useState(null);
  const [timePos,  setTimePos]  = useState(null);

  const dateBtnRef  = useRef(null);
  const timeBtnRef  = useRef(null);
  const timeListRef = useRef(null);

  // Scroll selected time into view when dropdown opens
  useEffect(() => {
    if (!showTime) return;
    const timer = setTimeout(() => {
      const el = timeListRef.current?.querySelector("[data-sel='true']");
      el?.scrollIntoView({ block: "center" });
    }, 30);
    return () => clearTimeout(timer);
  }, [showTime]);

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (!dateBtnRef.current?.contains(e.target) && !e.target.closest("[data-dtp-cal]")) setShowCal(false);
      if (!timeBtnRef.current?.contains(e.target) && !e.target.closest("[data-dtp-time]")) setShowTime(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function openCal() {
    const rect = dateBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    if (left + 348 > window.innerWidth - 12) left = window.innerWidth - 348 - 12;
    let top  = rect.bottom + 8;
    if (top + 380 > window.innerHeight - 12) top = rect.top - 380 - 8;
    setCalPos({ top, left });
    setShowCal(s => !s);
    setShowTime(false);
  }

  function openTime() {
    const rect = timeBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    let left = rect.left;
    if (left + 152 > window.innerWidth - 12) left = window.innerWidth - 152 - 12;
    let top  = rect.bottom + 8;
    if (top + 304 > window.innerHeight - 12) top = rect.top - 304 - 8;
    setTimePos({ top, left });
    setShowTime(s => !s);
    setShowCal(false);
  }

  function prevMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  function selectDay(day) {
    const newDate = `${calYear}-${String(calMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onChange({ date: newDate, time });
    setShowCal(false);
  }

  function isDisabled(day) {
    if (!minDate) return false;
    const d = `${calYear}-${String(calMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return d < minDate;
  }

  const totalDays = daysInMonth(calYear, calMonth);
  const firstWd   = firstWeekday(calYear, calMonth);
  const todayD    = today.getDate();
  const todayM    = today.getMonth() + 1;
  const todayY    = today.getFullYear();

  return (
    <>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 800, color: "#5c6b7a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          {label}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* ── Date button ── */}
        <button
          ref={dateBtnRef}
          type="button"
          onClick={openCal}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", width: 82, height: 72,
            border: "2px solid #0d3b66", borderRadius: 14,
            background: parts ? "#0d3b66" : "#f0f6fc",
            cursor: "pointer", padding: 0, flexShrink: 0,
          }}
        >
          {parts ? (
            <>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                {parts.day}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
                {MONTHS_SHORT[parts.month - 1]}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0d3b66" }}>Fecha</span>
          )}
        </button>

        {/* ── Time button ── */}
        <button
          ref={timeBtnRef}
          type="button"
          onClick={openTime}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 72, minWidth: 122, border: "2px solid #0d3b66", borderRadius: 14,
            background: timeFmt ? "#0d3b66" : "#f0f6fc",
            cursor: "pointer", padding: "0 18px", flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, color: timeFmt ? "#fff" : "#0d3b66", whiteSpace: "nowrap" }}>
            {timeFmt || "Hora"}
          </span>
        </button>
      </div>

      {/* ── Calendar overlay (fixed) ── */}
      {showCal && calPos && (
        <div
          data-dtp-cal="true"
          style={{
            position: "fixed", top: calPos.top, left: calPos.left, zIndex: 9999,
            background: "#fff", border: "2px solid #0d3b66", borderRadius: 20,
            padding: 24, boxShadow: "0 16px 56px rgba(13,59,102,0.22)", width: 348,
          }}
        >
          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button type="button" onClick={prevMonth} style={navBtn()}>‹</button>
            <span style={{ fontWeight: 800, fontSize: 17, color: "#0d1b2a" }}>
              {MONTHS_LONG[calMonth - 1]} {calYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtn()}>›</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 8 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#8fa3b1", paddingBottom: 6, textTransform: "uppercase" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {Array.from({ length: firstWd }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const isSel     = parts?.day === day && parts?.month === calMonth && parts?.year === calYear;
              const disabled  = isDisabled(day);
              const isToday   = day === todayD && calMonth === todayM && calYear === todayY;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  style={{
                    height: 44, borderRadius: 10,
                    border: isToday && !isSel ? "2px solid #0d3b66" : "2px solid transparent",
                    background: isSel ? "#0d3b66" : "transparent",
                    color: isSel ? "#fff" : disabled ? "#ccc" : "#0d1b2a",
                    fontWeight: isSel ? 800 : 500,
                    fontSize: 15, cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.3 : 1,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isSel && !disabled) e.currentTarget.style.background = "#e8f4fd"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Time dropdown (fixed) ── */}
      {showTime && timePos && (
        <div
          ref={timeListRef}
          data-dtp-time="true"
          style={{
            position: "fixed", top: timePos.top, left: timePos.left, zIndex: 9999,
            background: "#fff", border: "2px solid #0d3b66", borderRadius: 14,
            boxShadow: "0 16px 56px rgba(13,59,102,0.22)",
            maxHeight: 304, overflowY: "auto", width: 152,
          }}
        >
          {TIME_OPTIONS.map(opt => {
            const isSel = time === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-sel={isSel ? "true" : "false"}
                onClick={() => { onChange({ date, time: opt.value }); setShowTime(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "center",
                  padding: "11px 12px", border: "none",
                  background: isSel ? "#0d3b66" : "transparent",
                  color: isSel ? "#fff" : "#0d1b2a",
                  fontWeight: isSel ? 800 : 500,
                  fontSize: 14, cursor: "pointer",
                  borderBottom: "1px solid #f0f4f8",
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#f0f6fc"; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function navBtn() {
  return {
    width: 38, height: 38, borderRadius: 10,
    border: "2px solid #0d3b66", background: "#f0f6fc",
    cursor: "pointer", fontSize: 20, fontWeight: 800, color: "#0d3b66",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}
