import { useState, useEffect } from "react";
import { validateRegistrationForm } from "../lib/tickets.js";
import { isSoldOut } from "../lib/capacity.js";
import { loadEventFont, eventFontProps } from "../lib/fonts.js";
import { eventTint } from "../lib/dominantColor.js";
import { EventTintLayer } from "./ui.jsx";
import "../styles/typeform.css";

const CONSENT_PRIVACY_ID = "__consent_privacy__";
const CONSENT_MARKETING_ID = "__consent_marketing__";

// Descripciones que la app añadía por defecto y que ya no se muestran. Los
// eventos creados antes las llevan guardadas en su payload, así que se filtran
// al pintar en vez de migrar la base de datos.
const LEGACY_HINTS = new Set([
  "Escribe tus nombres tal como aparecen en tu documento",
]);

const inputBase = {
  width: "100%",
  padding: "12px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 14,
  color: "#ffffff",
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
};

function PillSelect({ field, value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {(field.options || []).map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(field.id, active ? "" : opt)}
            style={{
              padding: "9px 18px",
              borderRadius: 100,
              border: `1.5px solid ${active ? "#34d399" : "rgba(255,255,255,0.15)"}`,
              background: active ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.04)",
              color: active ? "#34d399" : "#b0bac8",
              fontWeight: active ? 700 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function PillMultiSelect({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {(field.options || []).map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = active
                ? selected.filter((x) => x !== opt)
                : [...selected, opt];
              onChange(field.id, next);
            }}
            style={{
              padding: "9px 18px",
              borderRadius: 100,
              border: `1.5px solid ${active ? "#34d399" : "rgba(255,255,255,0.15)"}`,
              background: active ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.04)",
              color: active ? "#34d399" : "#b0bac8",
              fontWeight: active ? 700 : 400,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {active ? "✓ " : ""}{opt}
          </button>
        );
      })}
    </div>
  );
}

function FieldWidget({ field, value, onChange }) {
  if (field.type === "select") {
    return <PillSelect field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "multi_select") {
    return <PillMultiSelect field={field} value={value} onChange={onChange} />;
  }
  if (field.type === "textarea") {
    return (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        placeholder={field.placeholder || "Escribe aquí…"}
        style={{ ...inputBase, minHeight: 90, resize: "vertical" }}
      />
    );
  }
  if (field.type === "checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(field.id, e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#34d399" }}
        />
        <span style={{ fontSize: 14, color: "#c4cad6" }}>{field.label}</span>
      </label>
    );
  }
  const inputType =
    field.type === "email" ? "email"
    : field.type === "phone" ? "tel"
    : field.type === "age" || field.type === "number" ? "number"
    : "text";
  const autoComplete =
    field.type === "email" ? "email"
    : field.type === "phone" ? "tel"
    : field.label?.toLowerCase().includes("nombre") ? "name"
    : "off";
  return (
    <input
      type={inputType}
      value={value ?? ""}
      onChange={(e) => onChange(field.id, e.target.value)}
      placeholder={field.placeholder || "Escribe aquí…"}
      autoComplete={autoComplete}
      style={inputBase}
      min={field.type === "age" ? 1 : undefined}
      max={field.type === "age" ? 120 : undefined}
    />
  );
}

export default function TypeformRegister({ event, tintColor, onSubmit, onBack }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // La descarga de la tipografía va en un efecto (toca el <head>, no puede
  // pasar durante el render). Es idempotente: si ya se cargó en la página del
  // evento, esto no hace nada.
  useEffect(() => { loadEventFont(event?.fontId); }, [event?.fontId]);

  const soldOut = isSoldOut(event);
  const tinte = eventTint(tintColor || event?.themeColor);
  // Tope de entradas por persona que fijó el anfitrión (1 si no lo configuró).
  const maxPerUser = Math.max(1, Math.min(Number(event.maxPerUser) || 1, 20));

  const setField = (fid, value) => {
    setForm((p) => ({ ...p, [fid]: value }));
    setErrors((e) => { const n = { ...e }; delete n[fid]; return n; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateRegistrationForm(event.fields || [], form);
    if (!form[CONSENT_PRIVACY_ID]) {
      fieldErrors[CONSENT_PRIVACY_ID] = "Debes aceptar para continuar.";
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        form,
        quantity,
        consentPrivacy: Boolean(form[CONSENT_PRIVACY_ID]),
        consentMarketing: Boolean(form[CONSENT_MARKETING_ID]),
      });
    } catch (err) {
      setErrors({ submit: err.message || "No se pudo completar el registro." });
    } finally {
      setSubmitting(false);
    }
  };

  if (soldOut) {
    return (
      <div className="tf-screen">
        <div className="tf-body" style={{ textAlign: "center" }}>
          <h1 className="tf-question">Entradas agotadas</h1>
          <p className="tf-hint">Este evento ya no acepta más inscripciones.</p>
          {onBack && (
            <button type="button" onClick={onBack} style={{ marginTop: 20, background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
              ← Volver al evento
            </button>
          )}
        </div>
      </div>
    );
  }

  // El formulario va en la letra de la app: son campos de TapIn y se rellenan
  // igual en todos los eventos. Lo único que conserva la letra elegida es el
  // nombre del evento, que es lo que dice DÓNDE se está inscribiendo uno. El
  // color del evento sí acompaña, que no depende de leerse.
  return (
    <div className="tf-screen" style={{ display: "block", overflowY: "auto" }}>
      <EventTintLayer tinte={tinte} />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 80px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{ background: "none", border: "none", color: "#8fa3b1", cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}
            >
              ← Volver
            </button>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>
            Inscripción
          </h1>
          <p {...eventFontProps(event.fontId, {
            extraStyle: { fontSize: 14, color: "#8fa3b1", margin: "4px 0 0" },
          })}>{event.title}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Cuántas entradas — solo si el anfitrión permite más de una */}
          {maxPerUser > 1 && (
            <div style={{ marginBottom: 24, padding: "16px 18px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)", borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>¿Cuántas entradas?</div>
                  <div style={{ fontSize: 12, color: "#8fa3b1", marginTop: 2 }}>Hasta {maxPerUser} por persona · un QR por entrada</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button type="button" aria-label="Una entrada menos"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    style={{ width: 34, height: 34, borderRadius: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: quantity <= 1 ? "rgba(255,255,255,0.25)" : "#ffffff", fontSize: 19, fontWeight: 700, cursor: quantity <= 1 ? "default" : "pointer", lineHeight: 1 }}>
                    −
                  </button>
                  <span aria-live="polite" style={{ minWidth: 28, textAlign: "center", fontSize: 18, fontWeight: 800, color: "#34d399" }}>{quantity}</span>
                  <button type="button" aria-label="Una entrada más"
                    onClick={() => setQuantity((q) => Math.min(maxPerUser, q + 1))}
                    disabled={quantity >= maxPerUser}
                    style={{ width: 34, height: 34, borderRadius: 14, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: quantity >= maxPerUser ? "rgba(255,255,255,0.25)" : "#ffffff", fontSize: 19, fontWeight: 700, cursor: quantity >= maxPerUser ? "default" : "pointer", lineHeight: 1 }}>
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fields */}
          {(event.fields || []).map((field) => (
            <div key={field.id} style={{ marginBottom: 24 }}>
              {field.type !== "checkbox" && (
                <label style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#8fa3b1",
                  marginBottom: 8,
                  letterSpacing: "0.3px",
                }}>
                  {field.label}{field.required && <span style={{ color: "#f87171" }}> *</span>}
                </label>
              )}
              {field.description && field.type !== "checkbox" && !LEGACY_HINTS.has(field.description.trim()) && (
                <p style={{ fontSize: 12, color: "#6b7a8d", margin: "0 0 8px" }}>{field.description}</p>
              )}
              <FieldWidget field={field} value={form[field.id]} onChange={setField} />
              {errors[field.id] && (
                <p style={{ color: "#f87171", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  ⚠ {errors[field.id]}
                </p>
              )}
            </div>
          ))}

          {/* Consent */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 24, marginTop: 8,
          }}>
            <label style={{
              display: "flex", gap: 12, cursor: "pointer", marginBottom: 14,
              alignItems: "flex-start",
            }}>
              <input
                type="checkbox"
                checked={Boolean(form[CONSENT_PRIVACY_ID])}
                onChange={(e) => setField(CONSENT_PRIVACY_ID, e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: "#34d399", flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "#8fa3b1", lineHeight: 1.5 }}>
                Acepto la{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: "#34d399" }}>
                  política de privacidad y tratamiento de datos
                </a>{" "}
                <span style={{ color: "#f87171" }}>*</span>
              </span>
            </label>
            <label style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={Boolean(form[CONSENT_MARKETING_ID])}
                onChange={(e) => setField(CONSENT_MARKETING_ID, e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: "#34d399", flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "#8fa3b1", lineHeight: 1.5 }}>
                Autorizo recibir información, promociones y novedades sobre eventos (opcional).
              </span>
            </label>
            {errors[CONSENT_PRIVACY_ID] && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 10, fontWeight: 600 }}>
                ⚠ {errors[CONSENT_PRIVACY_ID]}
              </p>
            )}
          </div>

          {errors.submit && (
            <p style={{ color: "#f87171", fontSize: 14, marginTop: 16, fontWeight: 600 }}>
              {errors.submit}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", marginTop: 28, minHeight: 52, padding: "0 16px",
              background: submitting ? "var(--tf-surface-2)" : "var(--tf-accent)",
              color: submitting ? "var(--tf-faint)" : "var(--tf-on-accent)", borderRadius: 14, fontWeight: 600, fontSize: 16,
              border: "none", cursor: submitting ? "not-allowed" : "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            {submitting ? "Registrando…" : "Registrarme →"}
          </button>
        </form>
      </div>
    </div>
  );
}
