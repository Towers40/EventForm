import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { COLOMBIA_CITIES } from "../lib/colombia.js";
import { EVENT_TYPE_OTHER, EVENT_TYPE_PRESETS } from "../lib/colombia.js";
import { searchPlacesInColombia } from "../lib/geocoding.js";
import { VERDE_CORPORATIVO } from "../lib/theme.js";
import { api } from "../lib/api.js";
import "../styles/typeform.css";

const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

function makeSlug(title) {
  return (
    String(title || "evento")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) + `-${Math.random().toString(36).slice(2, 6)}`
  );
}

function buildBaseFields(capacity) {
  const fields = [
    { id: "F" + uid(), type: "text", label: "Nombre completo del asistente", description: "Escribe tus nombres tal como aparecen en tu documento", placeholder: "", required: true, options: [] },
    { id: "F" + uid(), type: "email", label: "Correo electrónico", description: "Usa un correo al que tengas acceso; lo verás en tu boleto", placeholder: "", required: true, options: [] },
  ];
  if (capacity === "100-300" || capacity === "300+") {
    fields.push({ id: "F" + uid(), type: "phone", label: "Teléfono de Contacto", description: "", placeholder: "", required: true, options: [] });
  }
  return fields;
}

const CAPACITY_OPTS = [
  { label: "Menos de 50 personas", value: "under-50" },
  { label: "Pequeño — hasta 50 personas", value: "0-50" },
  { label: "Mediano — 50 a 100 personas", value: "50-100" },
  { label: "Grande — 100 a 300 personas", value: "100-300" },
  { label: "Masivo — más de 300 personas", value: "300+" },
];

// ─── PICKER DE UBICACIÓN estilo Typeform ─────────────────────────────────────
function TFLocationPicker({ value, onChange }) {
  const { city = "", address = "", lat = null, lng = null } = value || {};
  const [query, setQuery] = useState(address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [confirmed, setConfirmed] = useState(lat != null);
  const debounceRef = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (address && address !== query) setQuery(address);
    if (lat != null) setConfirmed(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, lat]);

  const runSearch = useCallback(async (text) => {
    if (!city || text.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    const id = ++reqId.current;
    setSearching(true);
    try {
      const results = await searchPlacesInColombia(city, text.trim());
      if (id !== reqId.current) return;
      setSuggestions(results.slice(0, 6));
      setOpen(results.length > 0);
    } catch {
      if (id === reqId.current) setSuggestions([]);
    } finally {
      if (id === reqId.current) setSearching(false);
    }
  }, [city]);

  useEffect(() => {
    if (!city) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 380);
    return () => clearTimeout(debounceRef.current);
  }, [query, city, runSearch]);

  const onCityChange = (newCity) => {
    onChange({ city: newCity, address: "", location: "", lat: null, lng: null });
    setQuery(""); setSuggestions([]); setConfirmed(false); setOpen(false);
  };

  const onQueryChange = (text) => {
    setQuery(text);
    setConfirmed(false);
    // Preserva lo que el usuario escribe como dirección; lat/lng se actualizan solo si elige sugerencia
    onChange({ city, address: text, location: text, lat: null, lng: null });
  };

  const applyPlace = (place) => {
    const label = place.shortLabel || place.label;
    setQuery(label);
    setSuggestions([]); setOpen(false); setConfirmed(true);
    onChange({ city, address: place.address || place.label, location: label, lat: place.lat, lng: place.lng });
  };

  return (
    <div>
      <p style={tfLabel}>Ciudad *</p>
      <select
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
        style={{
          width: "100%", border: "none", borderBottom: "2px solid #b8c5d4",
          padding: "10px 0", fontSize: 18, color: city ? "#0d3b66" : "#a8b8c8",
          background: "transparent", outline: "none", marginBottom: 28,
          cursor: "pointer", appearance: "none",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b8c5d4' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center", paddingRight: 24,
        }}
      >
        <option value="">— Selecciona la ciudad —</option>
        {COLOMBIA_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {city && (
        <div>
          <p style={tfLabel}>Lugar o dirección</p>
          <p style={{ fontSize: 13, color: "#8fa3b1", marginBottom: 10, lineHeight: 1.5 }}>
            Escribe el nombre o dirección. Puedes elegir una sugerencia o dejarlo como quieras.
          </p>
          <div style={{ position: "relative" }}>
            <input
              className="tf-input-line"
              placeholder={`Ej. Movistar Arena, Calle 93 # 14-20…`}
              value={query}
              autoComplete="off"
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 180)}
            />
            {searching && (
              <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#b8c5d4" }}>
                ···
              </span>
            )}

            {/* Suggestions dropdown — typeform style */}
            {open && suggestions.length > 0 && (
              <div style={{
                position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
                background: "#fff", borderRadius: 10, zIndex: 50,
                boxShadow: "0 8px 32px rgba(13,59,102,0.13)",
                border: "1px solid #e2e8f0", overflow: "hidden",
              }}>
                {suggestions.map((s, i) => (
                  <button
                    key={s.id || i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyPlace(s)}
                    style={{
                      width: "100%", textAlign: "left", padding: "11px 16px",
                      border: "none", background: "transparent", cursor: "pointer",
                      borderBottom: i < suggestions.length - 1 ? "1px solid #f0f4f8" : "none",
                      display: "block",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0d3b66", display: "block" }}>
                      {s.shortLabel}
                    </span>
                    {s.subtitle && (
                      <span style={{ fontSize: 12, color: "#8fa3b1", display: "block", marginTop: 2 }}>
                        {s.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {confirmed && (
            <p style={{ marginTop: 10, fontSize: 13, color: "#16a34a", fontWeight: 700 }}>
              ✓ Ubicación confirmada
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const tfLabel = {
  fontSize: 11,
  fontWeight: 800,
  color: "#5c6b7a",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

// ─── CAMPO CONTRASEÑA CON VISIBILIDAD ────────────────────────────────────────
function PasswordField({ value, onChange, placeholder = "Contraseña" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        className="tf-input-line"
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingRight: 56 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          color: "#8fa3b1",
          padding: "4px 2px",
          userSelect: "none",
        }}
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}

// ─── VALIDACIÓN DE CONTRASEÑA ────────────────────────────────────────────────
function validatePassword(pw) {
  if (!pw || pw.length < 8) return "Mínimo 8 caracteres.";
  if (!/[A-Z]/.test(pw)) return "Debe incluir al menos una letra mayúscula.";
  return null;
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    { ok: password.length >= 8, label: "8 caracteres" },
    { ok: /[A-Z]/.test(password), label: "Una mayúscula" },
    { ok: /[0-9]/.test(password), label: "Un número" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      {checks.map((c) => (
        <span
          key={c.label}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: c.ok ? "#16a34a" : "#a0aec0",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {c.ok ? "✓" : "○"} {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── ONBOARDING FLOW PRINCIPAL ────────────────────────────────────────────────
function toLocalDateTimeValue(date = "", time = "") {
  return date && time ? `${date}T${time}` : "";
}

function splitLocalDateTime(value) {
  const [date = "", timeWithSeconds = ""] = String(value || "").split("T");
  return { date, time: timeWithSeconds.slice(0, 5) };
}

// phase: 0=bienvenida, 1–6=wizard, 7=crear cuenta, 8=verificar correo
export default function OnboardingFlow({ onDraftReady }) {
  const { register, loginWithToken } = useAuth();
  const nav = useNavigate();

  const [phase, setPhase] = useState(0);
  const [animClass, setAnimClass] = useState("tf-fade");

  const [draft, setDraft] = useState({
    id: "E" + uid(),
    title: "",
    eventType: "",
    eventTypeCustom: "",
    slug: "",
    date: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    city: "",
    location: "",
    address: "",
    locationInstructions: "",
    lat: null,
    lng: null,
    capacity: "",
    capacityCustom: "",
    headerImage: "",
    fields: [],
    registrations: [],
    eventDescription: "",
  });

  const [acName, setAcName] = useState("");
  const [acEmail, setAcEmail] = useState("");
  const [acPassword, setAcPassword] = useState("");
  const [acErr, setAcErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [codeErr, setCodeErr] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [resendStatus, setResendStatus] = useState("idle");
  const [dateErr, setDateErr] = useState("");
  const digitRefs = [useRef(), useRef(), useRef(), useRef()];

  const go = (next) => {
    setAnimClass("tf-fade-out");
    setTimeout(() => {
      setPhase(next);
      setAnimClass("tf-fade");
    }, 220);
  };

  const updateStartDateTime = (value) => {
    const next = splitLocalDateTime(value);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
    if (next.date && next.date < today) {
      setDateErr("No puedes crear un evento en una fecha pasada.");
      return;
    }
    setDateErr("");
    setDraft((p) => ({
      ...p,
      startDate: next.date,
      startTime: next.time,
      date: next.date,
      endDate: p.endDate || next.date,
    }));
  };

  const updateEndDateTime = (value) => {
    const next = splitLocalDateTime(value);
    setDraft((p) => {
      if (next.date && p.startDate && next.date < p.startDate) {
        setDateErr("La fecha de fin no puede ser anterior a la fecha de inicio.");
        return p;
      }
      if (next.date === p.startDate && next.time <= p.startTime) {
        setDateErr("La hora de fin debe ser posterior a la hora de inicio del mismo día.");
        return p;
      }
      setDateErr("");
      return { ...p, endDate: next.date, endTime: next.time };
    });
  };

  const canNext = () => {
    if (phase === 1) return draft.title.trim().length > 0;
    if (phase === 2)
      return (
        !!(draft.eventType || draft.desc) &&
        !(draft.eventType === EVENT_TYPE_OTHER && !draft.eventTypeCustom?.trim())
      );
    if (phase === 3) {
      if (draft.capacity !== "under-50") return !!draft.capacity;
      const custom = Number(draft.capacityCustom);
      return custom > 0 && custom < 50;
    }
    if (phase === 4) {
      if (!draft.startDate || !draft.startTime || !draft.endDate || !draft.endTime) return false;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
      // No permitir fechas en el pasado
      if (draft.startDate < today) return false;
      if (draft.endDate < draft.startDate) return false;
      // Si es el mismo día, validar que endTime > startTime
      if (draft.endDate === draft.startDate && draft.endTime <= draft.startTime) return false;
      return true;
    }
    if (phase === 5)
      return !!(draft.city && draft.address?.trim());
    if (phase === 6) return true;
    return false;
  };

  const next = () => {
    if (!canNext()) return;
    if (phase === 6) {
      const date = draft.startDate || draft.date;
      const fields = buildBaseFields(draft.capacity);
      setDraft((prev) => ({ ...prev, date, fields, slug: makeSlug(prev.title) }));
    }
    go(phase + 1);
  };

  const back = () => go(phase <= 1 ? 0 : phase - 1);

  const handleRegister = async (e) => {
    e.preventDefault();
    const pwErr = validatePassword(acPassword);
    if (pwErr) { setAcErr(pwErr); return; }
    if (!acName.trim()) { setAcErr("Escribe tu nombre."); return; }
    if (!acEmail.trim()) { setAcErr("Escribe tu correo."); return; }
    setAcErr("");
    setBusy(true);

    // Guardar draft en localStorage para recuperarlo después de verificar
    const date = draft.startDate || draft.date;
    const finalDraft = { ...draft, date };
    localStorage.setItem("ef_pending_draft", JSON.stringify(finalDraft));

    try {
      const result = await register(acEmail.trim(), acPassword, acName.trim());

      if (result?.pending) {
        // Email de verificación enviado
        setPendingEmail(acEmail.trim());
        go(8);
        return;
      }

      // Sin verificación de correo (SMTP no configurado): ir directo al builder
      onDraftReady(finalDraft);
    } catch (ex) {
      setAcErr(ex.message || "Error al crear la cuenta. Intenta de nuevo.");
      localStorage.removeItem("ef_pending_draft");
    } finally {
      setBusy(false);
    }
  };

  const handleDigitChange = (i, val) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setCodeErr("");
    if (v && i < 3) digitRefs[i + 1].current?.focus();
    if (next.every((d) => d !== "")) handleVerifyCode(next.join(""));
  };

  const handleDigitKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) digitRefs[i - 1].current?.focus();
  };

  const handleVerifyCode = async (code) => {
    setCodeErr(""); setCodeBusy(true);
    try {
      const { token: jwt, user } = await api.verifyCode(pendingEmail, code);
      loginWithToken(jwt, user);
      // Draft already in localStorage, HostApp lo cargará
    } catch (ex) {
      setCodeErr(ex.message || "Código incorrecto. Intenta de nuevo.");
      setDigits(["", "", "", ""]);
      setTimeout(() => digitRefs[0].current?.focus(), 50);
    } finally {
      setCodeBusy(false);
    }
  };

  const handleResend = async () => {
    setResendStatus("sending");
    try {
      await api.resendCode(pendingEmail);
      setResendStatus("sent");
      setDigits(["", "", "", ""]);
      setTimeout(() => digitRefs[0].current?.focus(), 50);
    } catch {
      setResendStatus("error");
    }
  };

  const progressPct =
    phase === 0 ? 0 : phase >= 7 ? 95 : Math.round((phase / 6) * 85);

  return (
    <div className="tf-screen">
      {phase > 0 && (
        <div className="tf-progress">
          <div className="tf-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className={`tf-body ${animClass}`}>

        {/* ── BIENVENIDA ── */}
        {phase === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 36 }}>
              <span style={{ color: VERDE_CORPORATIVO, fontSize: 48, display: "block", lineHeight: 1, marginBottom: 10 }}>●</span>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.15em", color: "#8fa3b1" }}>EVENTFORM COLOMBIA</span>
            </div>
            <h1 className="tf-question" style={{ fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 300, lineHeight: 1.25, marginBottom: 20 }}>
              Empecemos a crear<br />
              <strong style={{ fontWeight: 700 }}>tu próximo evento</strong>
            </h1>
            <p className="tf-hint" style={{ maxWidth: 420, margin: "0 auto 44px", fontSize: 16 }}>
              Configura en minutos, inscribe asistentes y gestiona el acceso con QR el día del evento.
            </p>
            <button type="button" onClick={() => go(1)} className="soft-btn soft-btn-primary" style={{ fontSize: 16, padding: "16px 48px", borderRadius: 12 }}>
              Empezar →
            </button>
            <div style={{ marginTop: 32 }}>
              <button type="button" onClick={() => nav("/login")} style={{ background: "none", border: "none", color: "#0d3b66", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Ya tengo cuenta → Iniciar sesión
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 1: Nombre ── */}
        {phase === 1 && (
          <>
            <div className="tf-step-num">1</div>
            <h2 className="tf-question">¿Qué nombre llevará tu evento?</h2>
            <p className="tf-hint">Elige un nombre memorable para tus asistentes.</p>
            <input
              className="tf-input-line"
              autoFocus
              placeholder="Ej. Congreso de Innovación 2026"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && canNext() && next()}
            />
          </>
        )}

        {/* ── PASO 2: Tipo ── */}
        {phase === 2 && (
          <>
            <div className="tf-step-num">2</div>
            <h2 className="tf-question">¿Qué tipo de evento vas a realizar?</h2>
            <p className="tf-hint">Selecciona la categoría que mejor lo describe.</p>
            <div>
              {[...EVENT_TYPE_PRESETS, "Otro (especificar)"].map((type) => {
                const isOtro = type === "Otro (especificar)";
                const isSelected = isOtro ? draft.eventType === EVENT_TYPE_OTHER : draft.eventType === type;
                return (
                  <button key={type} type="button" className={`tf-choice${isSelected ? " selected" : ""}`}
                    onClick={() => {
                      if (isOtro) setDraft((p) => ({ ...p, eventType: EVENT_TYPE_OTHER }));
                      else setDraft((p) => ({ ...p, eventType: type, eventTypeCustom: "" }));
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            {draft.eventType === EVENT_TYPE_OTHER && (
              <input className="tf-input-line" style={{ marginTop: 16 }} autoFocus
                placeholder="Describe el tipo de evento"
                value={draft.eventTypeCustom || ""}
                onChange={(e) => setDraft((p) => ({ ...p, eventTypeCustom: e.target.value }))}
              />
            )}
          </>
        )}

        {/* ── PASO 3: Aforo ── */}
        {phase === 3 && (
          <>
            <div className="tf-step-num">3</div>
            <h2 className="tf-question">¿Cuál es el aforo aproximado?</h2>
            <p className="tf-hint">Esto nos ayuda a preparar el formulario adecuado para tu evento.</p>
            <div>
              {CAPACITY_OPTS.map((opt) => (
                <button key={opt.value} type="button" className={`tf-choice${draft.capacity === opt.value ? " selected" : ""}`}
                  onClick={() => setDraft((p) => ({ ...p, capacity: opt.value, capacityCustom: opt.value === "under-50" ? p.capacityCustom : "" }))}>
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              className="tf-input-line"
              type="number"
              min="1"
              max="49"
              inputMode="numeric"
              placeholder="Cantidad exacta de asistentes"
              value={draft.capacityCustom || ""}
              disabled={draft.capacity !== "under-50"}
              onChange={(e) => setDraft((p) => ({ ...p, capacityCustom: e.target.value }))}
              style={{ marginTop: 12, opacity: draft.capacity === "under-50" ? 1 : 0.35 }}
            />
            {draft.capacity === "under-50" && (
              <p className="tf-hint" style={{ marginTop: 10, fontSize: 13 }}>
                Escribe un número entre 1 y 49. Esta casilla solo se habilita para esta opción.
              </p>
            )}
          </>
        )}

        {/* ── PASO 4: Fecha y hora ── */}
        {phase === 4 && (
          <>
            <div className="tf-step-num">4</div>
            <h2 className="tf-question">¿Cuándo será tu evento?</h2>
            <p className="tf-hint">Define fecha y hora de inicio, y también fecha y hora de finalización.</p>

            <div style={{ display: "grid", gap: 22 }}>
              <div>
                <p style={tfLabel}>Inicio del evento</p>
                <input
                  className="tf-input-line"
                  type="datetime-local"
                  value={toLocalDateTimeValue(draft.startDate, draft.startTime)}
                  onInput={(e) => updateStartDateTime(e.target.value)}
                  onChange={(e) => updateStartDateTime(e.target.value)}
                />
              </div>
              <div>
                <p style={tfLabel}>Fin del evento</p>
                <input
                  className="tf-input-line"
                  type="datetime-local"
                  value={toLocalDateTimeValue(draft.endDate, draft.endTime)}
                  onInput={(e) => updateEndDateTime(e.target.value)}
                  onChange={(e) => updateEndDateTime(e.target.value)}
                />
              </div>
            </div>
            {dateErr && (
              <p style={{ color: "#991b1b", fontWeight: 700, marginTop: 16, fontSize: 14 }}>
                ⚠️ {dateErr}
              </p>
            )}
          </>
        )}

        {/* ── PASO 5: Lugar ── */}
        {phase === 5 && (
          <>
            <div className="tf-step-num">5</div>
            <h2 className="tf-question">¿Dónde será el evento?</h2>
            <p className="tf-hint">Selecciona ciudad, lugar o dirección. Puedes añadir instrucciones si la llegada necesita más contexto.</p>

            {/* Ubicación typeform */}
            <TFLocationPicker
              value={{ city: draft.city, address: draft.address, lat: draft.lat, lng: draft.lng }}
              onChange={(loc) =>
                setDraft((p) => ({
                  ...p,
                  city: loc.city,
                  address: loc.address,
                  location: loc.location,
                  lat: loc.lat,
                  lng: loc.lng,
                }))
              }
            />
            <div style={{ marginTop: 28 }}>
              <p style={tfLabel}>Instrucciones adicionales opcionales</p>
              <textarea
                className="tf-input-line"
                rows={3}
                placeholder="Ej. Entrada por la portería norte, preguntar por recepción…"
                value={draft.locationInstructions || ""}
                onChange={(e) => setDraft((p) => ({ ...p, locationInstructions: e.target.value }))}
                style={{ resize: "vertical", minHeight: 92, lineHeight: 1.4 }}
              />
            </div>
          </>
        )}

        {/* ── PASO 6: Imagen ── */}
        {phase === 6 && (
          <>
            <div className="tf-step-num">6</div>
            <h2 className="tf-question">Agrega una imagen para tu evento</h2>
            <p className="tf-hint">Será la portada del enlace público y del pase QR. Puedes continuar sin imagen si aún no la tienes.</p>
            <div className="tf-upload-card">
              <label className="tf-upload-drop">
                {draft.headerImage ? (
                  <img src={draft.headerImage} alt="Vista previa del evento" className="tf-upload-preview" />
                ) : (
                  <span>Subir imagen del evento</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setDraft((p) => ({ ...p, headerImage: reader.result || "" }));
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {draft.headerImage && (
                <button
                  type="button"
                  className="soft-btn soft-btn-secondary"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={() => setDraft((p) => ({ ...p, headerImage: "" }))}
                >
                  Quitar imagen
                </button>
              )}
            </div>
          </>
        )}

        {/* ── PASO 7: Crear cuenta ── */}
        {phase === 7 && (
          <form onSubmit={handleRegister}>
            <div className="tf-step-num" style={{ background: VERDE_CORPORATIVO, fontSize: 16 }}>✓</div>
            <h2 className="tf-question">
              ¡Casi listo! Crea tu <strong>cuenta de anfitrión</strong>
            </h2>
            <p className="tf-hint">
              Tu evento <strong>"{draft.title}"</strong> está configurado.
              Crea tu cuenta para publicarlo y gestionar inscripciones.
            </p>

            <input
              className="tf-input-line"
              placeholder="Tu nombre completo"
              value={acName}
              onChange={(e) => setAcName(e.target.value)}
              style={{ marginBottom: 28 }}
              autoFocus
              autoComplete="name"
            />
            <input
              className="tf-input-line"
              type="email"
              placeholder="Correo electrónico"
              value={acEmail}
              onChange={(e) => setAcEmail(e.target.value)}
              style={{ marginBottom: 28 }}
              autoComplete="email"
            />

            {/* Contraseña con visibilidad */}
            <p style={{ ...tfLabel, marginBottom: 8 }}>Contraseña</p>
            <PasswordField
              value={acPassword}
              onChange={(e) => { setAcPassword(e.target.value); setAcErr(""); }}
              placeholder="Mínimo 8 caracteres, una mayúscula"
            />
            <PasswordStrength password={acPassword} />

            {acErr && (
              <p style={{ color: "#991b1b", fontWeight: 700, marginTop: 14, fontSize: 14, lineHeight: 1.4 }}>
                {acErr}
              </p>
            )}

            <button type="submit" className="soft-btn soft-btn-primary"
              style={{ marginTop: 36, width: "100%", fontSize: 15, padding: "16px" }}
              disabled={busy}
            >
              {busy ? "Creando cuenta…" : "Crear cuenta y continuar →"}
            </button>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button type="button" onClick={() => nav("/login")}
                style={{ background: "none", border: "none", color: "#0d3b66", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3 }}>
                Ya tengo cuenta → Iniciar sesión
              </button>
            </div>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button type="button" onClick={() => go(6)}
                style={{ background: "none", border: "none", color: "#8fa3b1", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                ← Volver al paso anterior
              </button>
            </div>
          </form>
        )}

        {/* ── PASO 8: Código de 4 dígitos ── */}
        {phase === 8 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📩</div>
            <h2 className="tf-question">Ingresa tu código</h2>
            <p className="tf-hint" style={{ maxWidth: 380, margin: "0 auto 8px" }}>
              Enviamos un código de 4 dígitos a
            </p>
            <p style={{ fontWeight: 800, fontSize: 15, color: "#0d3b66", marginBottom: 32 }}>
              {pendingEmail}
            </p>

            {/* 4 cajas de dígito */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={digitRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  autoFocus={i === 0}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleDigitKey(i, e)}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  style={{
                    width: 56, height: 64, textAlign: "center",
                    fontSize: 28, fontWeight: 800, color: "#0d3b66",
                    border: "2px solid #b8c5d4", borderRadius: 10,
                    outline: "none", background: "#f8fafc",
                    transition: "border-color 0.15s",
                    borderColor: d ? "#0d3b66" : "#b8c5d4",
                  }}
                />
              ))}
            </div>

            {codeBusy && <p style={{ color: "#8fa3b1", fontSize: 14 }}>Verificando…</p>}
            {codeErr && (
              <p style={{ color: "#991b1b", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                {codeErr}
              </p>
            )}

            <button
              type="button"
              className="soft-btn soft-btn-primary"
              style={{ width: "100%", maxWidth: 280, margin: "8px auto 0", display: "block", fontSize: 15 }}
              disabled={codeBusy || digits.some((d) => !d)}
              onClick={() => handleVerifyCode(digits.join(""))}
            >
              Verificar código →
            </button>

            <div style={{ marginTop: 28 }}>
              {resendStatus === "idle" && (
                <button type="button" onClick={handleResend}
                  style={{ background: "none", border: "none", color: "#0d3b66", fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  ¿No llegó? Reenviar código
                </button>
              )}
              {resendStatus === "sending" && <p style={{ fontSize: 13, color: "#8fa3b1" }}>Enviando…</p>}
              {resendStatus === "sent" && <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>✓ Código reenviado — revisa tu correo</p>}
              {resendStatus === "error" && <p style={{ fontSize: 13, color: "#991b1b", fontWeight: 700 }}>Error al reenviar. Intenta más tarde.</p>}
            </div>

            <div style={{ marginTop: 20 }}>
              <button type="button" onClick={() => nav("/login")}
                style={{ background: "none", border: "none", color: "#8fa3b1", cursor: "pointer", fontSize: 12 }}>
                Ir al inicio de sesión
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer navegación (pasos 1–4) */}
      {phase >= 1 && phase <= 6 && (
        <div className="tf-footer">
          <button type="button" className="tf-btn-back" onClick={back} title="Atrás">↑</button>
          <button type="button" className="tf-btn-ok" onClick={next} disabled={!canNext()}>
            {phase === 6 ? "Continuar" : phase >= 4 ? "OK ✓" : "OK ✓"}
          </button>
          <span style={{ fontSize: 12, color: "#9B9B9B", userSelect: "none" }}>
            Presiona Enter ↵
          </span>
        </div>
      )}
    </div>
  );
}
