import { useState, useRef, useEffect } from "react";

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAYS_SHORT   = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

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

function generateDates(minDate) {
  const opts = [];
  const start = minDate ? new Date(minDate + "T12:00:00") : new Date();
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    opts.push({
      value: `${y}-${mo}-${dy}`,
      label: `${DAYS_SHORT[d.getDay()]} · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
    });
  }
  return opts;
}

function parseDateLabel(dateStr, minDate) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d);
  return `${DAYS_SHORT[dt.getDay()]} · ${d} ${MONTHS_SHORT[mo - 1]}`;
}

function formatTime12(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const DROPDOWN = {
  position: "fixed",
  zIndex: 9999,
  width: 220,
  background: "rgba(14,16,18,0.82)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(107,159,212,0.22)",
  borderRadius: 18,
  maxHeight: 264,
  overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
  padding: "6px 0",
};

function itemStyle(active) {
  return {
    display: "block", width: "100%",
    textAlign: "left", padding: "12px 20px",
    background: active ? "rgba(26,95,138,0.65)" : "transparent",
    color: active ? "#fff" : "#d4dae6",
    fontSize: 15, fontWeight: active ? 700 : 400,
    border: "none", cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "background 0.1s",
  };
}

export default function DateTimePicker({ date, time, onChange, minDate, label }) {
  const timeFmt = formatTime12(time);
  const dateFmt = parseDateLabel(date);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [datePos,  setDatePos]  = useState(null);
  const [timePos,  setTimePos]  = useState(null);

  const dateBtnRef  = useRef(null);
  const timeBtnRef  = useRef(null);
  const dateListRef = useRef(null);
  const timeListRef = useRef(null);

  const dateOptions = generateDates(minDate);

  useEffect(() => {
    function onDown(e) {
      if (!dateBtnRef.current?.contains(e.target) && !e.target.closest("[data-dtp-date]"))
        setShowDate(false);
      if (!timeBtnRef.current?.contains(e.target) && !e.target.closest("[data-dtp-time]"))
        setShowTime(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (showDate && date && dateListRef.current) {
      const sel = dateListRef.current.querySelector("[data-selected='true']");
      if (sel) sel.scrollIntoView({ block: "center" });
    }
  }, [showDate, date]);

  useEffect(() => {
    if (showTime && time && timeListRef.current) {
      const sel = timeListRef.current.querySelector("[data-selected='true']");
      if (sel) sel.scrollIntoView({ block: "center" });
    }
  }, [showTime, time]);

  function calcPos(btnRef) {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const W = 220;
    let left = rect.left;
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
    if (left < 8) left = 8;
    let top = rect.bottom + 8;
    if (top + 280 > window.innerHeight - 8) top = Math.max(8, rect.top - 280 - 8);
    return { top, left };
  }

  function openDate() {
    const pos = calcPos(dateBtnRef);
    setDatePos(pos);
    setShowTime(false);
    setShowDate(s => !s);
  }

  function openTime() {
    const pos = calcPos(timeBtnRef);
    setTimePos(pos);
    setShowDate(false);
    setShowTime(s => !s);
  }

  const triggerBtn = (filled) => ({
    minHeight: 60, flexShrink: 0,
    border: `1.5px solid ${filled ? "#1a5f8a" : "rgba(255,255,255,0.13)"}`,
    borderRadius: 14,
    background: filled ? "rgba(26,95,138,0.18)" : "rgba(255,255,255,0.04)",
    cursor: "pointer", padding: "0 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 8,
  });

  return (
    <>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 800, color: "#5c6b7a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          {label}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {/* Date button */}
        <button ref={dateBtnRef} type="button" onClick={openDate} style={{ ...triggerBtn(!!date), flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: date ? 700 : 400, color: date ? "#e8eaf0" : "#6b9fd4", whiteSpace: "nowrap" }}>
            {dateFmt || "Fecha"}
          </span>
          <span style={{ fontSize: 11, color: "#8fa3b1" }}>▾</span>
        </button>

        {/* Time button */}
        <button ref={timeBtnRef} type="button" onClick={openTime} style={{ ...triggerBtn(!!time), width: 120 }}>
          <span style={{ fontSize: 15, fontWeight: time ? 700 : 400, color: time ? "#e8eaf0" : "#6b9fd4", whiteSpace: "nowrap" }}>
            {timeFmt || "Hora"}
          </span>
          <span style={{ fontSize: 11, color: "#8fa3b1" }}>▾</span>
        </button>
      </div>

      {/* Date scroll dropdown */}
      {showDate && datePos && (
        <div data-dtp-date="true" ref={dateListRef} style={{ ...DROPDOWN, top: datePos.top, left: datePos.left }}>
          {dateOptions.map(opt => {
            const active = opt.value === date;
            return (
              <button
                key={opt.value}
                type="button"
                data-selected={active ? "true" : "false"}
                onClick={() => { onChange({ date: opt.value, time }); setShowDate(false); }}
                style={itemStyle(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(107,159,212,0.12)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Time scroll dropdown */}
      {showTime && timePos && (
        <div data-dtp-time="true" ref={timeListRef} style={{ ...DROPDOWN, top: timePos.top, left: timePos.left }}>
          {TIME_OPTIONS.map(opt => {
            const active = opt.value === time;
            return (
              <button
                key={opt.value}
                type="button"
                data-selected={active ? "true" : "false"}
                onClick={() => { onChange({ date, time: opt.value }); setShowTime(false); }}
                style={itemStyle(active)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(107,159,212,0.12)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
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
