import { useState, useRef, useEffect } from "react";

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_LONG  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_SHORT   = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

// 30-min intervals, 12:00 AM → 11:30 PM
const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const ampm = h < 12 ? "AM" : "PM";
      const h12  = h % 12 || 12;
      opts.push({
        label: `${h12}:${String(m).padStart(2, "0")} ${ampm}`,
        value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
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
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year, month) { return new Date(year, month - 1, 1).getDay(); }

export default function DateTimePicker({ date, time, onChange, minDate, label }) {
  const today   = new Date();
  const parts   = parseDateParts(date);
  const timeFmt = formatTime12(time);

  const [showCal,  setShowCal]  = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [calYear,  setCalYear]  = useState(parts?.year  || today.getFullYear());
  const [calMonth, setCalMonth] = useState(parts?.month || today.getMonth() + 1);
  const [calPos,   setCalPos]   = useState(null);
  const [timePos,  setTimePos]  = useState(null);

  const dateBtnRef = useRef(null);
  const timeBtnRef = useRef(null);
  const timeListRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    function onDown(e) {
      if (
        !dateBtnRef.current?.contains(e.target) &&
        !e.target.closest("[data-dtp-cal]")
      ) setShowCal(false);
      if (
        !timeBtnRef.current?.contains(e.target) &&
        !e.target.closest("[data-dtp-time]")
      ) setShowTime(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Scroll selected time into view when dropdown opens
  useEffect(() => {
    if (showTime && time && timeListRef.current) {
      const selected = timeListRef.current.querySelector("[data-selected='true']");
      if (selected) selected.scrollIntoView({ block: "center" });
    }
  }, [showTime, time]);

  function openCal() {
    const rect = dateBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const CAL_W = 480;
    let left = rect.left;
    if (left + CAL_W > window.innerWidth - 12) left = window.innerWidth - CAL_W - 12;
    if (left < 8) left = 8;
    let top = rect.bottom + 10;
    if (top + 430 > window.innerHeight - 12) top = rect.top - 430 - 10;
    setCalPos({ top, left });
    setShowCal(s => !s);
    setShowTime(false);
  }

  function openTime() {
    const rect = timeBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const MENU_W = 200;
    let left = rect.left;
    if (left + MENU_W > window.innerWidth - 12) left = rect.right - MENU_W;
    if (left < 8) left = 8;
    let top = rect.bottom + 8;
    if (top + 260 > window.innerHeight - 12) top = rect.top - 260 - 8;
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
    const newDate = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange({ date: newDate, time });
    setShowCal(false);
  }

  function selectTime(val) {
    onChange({ date, time: val });
    setShowTime(false);
  }

  function isDisabled(day) {
    if (!minDate) return false;
    const d = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
        <p style={{
          fontSize: 11, fontWeight: 800, color: "#5c6b7a",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
        }}>
          {label}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>

        {/* ── Date trigger button — shows "15 / Ene" (no year) ── */}
        <button
          ref={dateBtnRef}
          type="button"
          onClick={openCal}
          style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            width: 84, minHeight: 72, flexShrink: 0,
            border: "2px solid #1a5f8a", borderRadius: 14,
            background: parts ? "#1a5f8a" : "rgba(255,255,255,0.05)",
            cursor: "pointer", padding: "10px 0",
          }}
        >
          {parts ? (
            <>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                {parts.day}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700, lineHeight: 1,
                color: "rgba(255,255,255,0.75)",
                textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 5,
              }}>
                {MONTHS_SHORT[parts.month - 1]}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 22 }}>📅</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b9fd4", marginTop: 4 }}>Fecha</span>
            </>
          )}
        </button>

        {/* ── Time — fully custom fixed dropdown (no native select) ── */}
        <button
          ref={timeBtnRef}
          type="button"
          onClick={openTime}
          style={{
            minWidth: 148, minHeight: 72, flexShrink: 0,
            border: "2px solid #1a5f8a", borderRadius: 14,
            background: timeFmt ? "#1a5f8a" : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 14px 0 18px", cursor: "pointer",
          }}
        >
          <span style={{
            fontSize: 18, fontWeight: 800, whiteSpace: "nowrap",
            color: timeFmt ? "#fff" : "#6b9fd4",
          }}>
            {timeFmt || "Hora"}
          </span>
          <span style={{
            fontSize: 12, marginLeft: 8,
            color: timeFmt ? "rgba(255,255,255,0.65)" : "#8fa3b1",
          }}>
            ▾
          </span>
        </button>
      </div>

      {/* ── Custom time dropdown — fixed position, scrollable ── */}
      {showTime && timePos && (
        <div
          data-dtp-time="true"
          ref={timeListRef}
          style={{
            position: "fixed", top: timePos.top, left: timePos.left,
            zIndex: 9999, width: 200,
            background: "#1a1c1e",
            border: "2px solid #1a5f8a", borderRadius: 16,
            maxHeight: 240, overflowY: "auto",
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            padding: "6px 0",
          }}
        >
          {TIME_OPTIONS.map(opt => {
            const isSel = opt.value === time;
            return (
              <button
                key={opt.value}
                type="button"
                data-selected={isSel ? "true" : "false"}
                onClick={() => selectTime(opt.value)}
                style={{
                  display: "block", width: "100%",
                  textAlign: "left", padding: "12px 20px",
                  background: isSel ? "#1a5f8a" : "transparent",
                  color: isSel ? "#fff" : "#e8eaf0",
                  fontSize: 18, fontWeight: isSel ? 800 : 400,
                  border: "none", cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(107,159,212,0.15)"; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Calendar overlay — fixed position, BIG (480px) ── */}
      {showCal && calPos && (
        <div
          data-dtp-cal="true"
          style={{
            position: "fixed", top: calPos.top, left: calPos.left,
            zIndex: 9999, width: 480,
            background: "#1a1c1e",
            border: "2px solid #1a5f8a", borderRadius: 22,
            padding: "26px 28px 28px",
            boxShadow: "0 20px 64px rgba(0,0,0,0.5)",
          }}
        >
          {/* Month / year navigation */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 22,
          }}>
            <button type="button" onClick={prevMonth} style={navBtnStyle()}>‹</button>
            <span style={{ fontWeight: 800, fontSize: 19, color: "#e8eaf0" }}>
              {MONTHS_LONG[calMonth - 1]} {calYear}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle()}>›</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 8 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{
                textAlign: "center", fontSize: 12, fontWeight: 800,
                color: "#6b9fd4", paddingBottom: 10, textTransform: "uppercase",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
            {Array.from({ length: firstWd }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const isSel    = parts?.day === day && parts?.month === calMonth && parts?.year === calYear;
              const disabled = isDisabled(day);
              const isToday  = day === todayD && calMonth === todayM && calYear === todayY;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  onMouseEnter={e => { if (!isSel && !disabled) e.currentTarget.style.background = "rgba(107,159,212,0.18)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                  style={{
                    height: 52, borderRadius: 12, fontSize: 16,
                    border: isToday && !isSel ? "2px solid #1a5f8a" : "2px solid transparent",
                    background: isSel ? "#1a5f8a" : "transparent",
                    color: isSel ? "#fff" : disabled ? "#444" : "#e8eaf0",
                    fontWeight: isSel ? 800 : 500,
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.3 : 1,
                    transition: "background 0.1s",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function navBtnStyle() {
  return {
    width: 42, height: 42, borderRadius: 10,
    border: "2px solid #1a5f8a", background: "rgba(107,159,212,0.1)",
    cursor: "pointer", fontSize: 22, fontWeight: 800, color: "#6b9fd4",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}
