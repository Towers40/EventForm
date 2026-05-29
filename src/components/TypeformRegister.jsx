import { useState, useMemo } from "react";
import FieldInput, { FieldError } from "./FieldInput.jsx";
import { validateRegistrationForm } from "../lib/tickets.js";
import { isSoldOut } from "../lib/capacity.js";
import "../styles/typeform.css";

const CONSENT_PRIVACY_ID = "__consent_privacy__";
const CONSENT_MARKETING_ID = "__consent_marketing__";

export default function TypeformRegister({ event, onSubmit, onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const soldOut = isSoldOut(event);

  const steps = useMemo(() => {
    const s = [{ type: "intro", id: "intro" }];
    for (const f of event.fields || []) {
      s.push({ type: "field", field: f, id: f.id });
    }
    s.push({ type: "consent", id: "consent" });
    return s;
  }, [event]);

  const total = steps.length;
  const current = steps[step];
  const progress = ((step + 1) / total) * 100;

  const setField = (fid, value) => {
    setForm((p) => ({ ...p, [fid]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[fid];
      return n;
    });
  };

  const validateStep = () => {
    if (current?.type === "intro") return true;
    if (current?.type === "consent") {
      const e = {};
      if (!form[CONSENT_PRIVACY_ID]) {
        e[CONSENT_PRIVACY_ID] = "Debes aceptar para continuar.";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    }
    if (current?.type === "field") {
      const e = validateRegistrationForm([current.field], form);
      setErrors(e);
      return Object.keys(e).length === 0;
    }
    return true;
  };

  const next = async () => {
    if (!validateStep()) return;
    if (step < total - 1) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        form,
        consentPrivacy: Boolean(form[CONSENT_PRIVACY_ID]),
        consentMarketing: Boolean(form[CONSENT_MARKETING_ID]),
      });
      onDone?.();
    } catch (err) {
      setErrors({ submit: err.message || "No se pudo completar el registro." });
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  if (soldOut) {
    return (
      <div className="tf-screen">
        <div className="tf-body" style={{ textAlign: "center" }}>
          <h1 className="tf-question">Entradas agotadas</h1>
          <p className="tf-hint">Este evento ya no acepta más inscripciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tf-screen">
      <div className="tf-progress">
        <div className="tf-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className={`tf-body tf-fade${current?.type === "intro" ? " tf-body-cover" : ""}`} key={step}>
        {current?.type === "intro" && (
          <div className="tf-event-cover">
            <div className="tf-event-cover-media">
              {event.headerImage ? (
                <img src={event.headerImage} alt={event.title} />
              ) : (
                <div className="tf-event-cover-placeholder">{event.title?.slice(0, 1) || "E"}</div>
              )}
            </div>
            <div className="tf-event-cover-content">
              <p className="tf-event-cover-kicker">Evento privado</p>
              <h1>{event.title}</h1>
              {event.eventDescription && <p className="tf-event-cover-desc">{event.eventDescription}</p>}
              <div className="tf-event-cover-meta">
                <span>{event.startDate && event.startTime ? `${event.startDate} · ${event.startTime}` : event.date || "Fecha por confirmar"}</span>
                <span>{event.city ? `${event.city} · ` : ""}{event.location || event.address || "Lugar por confirmar"}</span>
              </div>
              {event.locationInstructions && (
                <p className="tf-event-cover-instructions">{event.locationInstructions}</p>
              )}
              <button type="button" className="tf-event-cover-btn" onClick={next}>
                Reservar
              </button>
            </div>
          </div>
        )}

        {current?.type === "field" && (
          <>
            <div className="tf-step-num">{step + 1}</div>
            <h1 className="tf-question">
              {current.field.label}
              {current.field.required && " *"}
            </h1>
            {current.field.description && (
              <p className="tf-hint">{current.field.description}</p>
            )}
            {["select", "multi_select", "textarea", "checkbox"].includes(
              current.field.type
            ) ? (
              <div style={{ marginTop: 8 }}>
                <FieldInput
                  field={current.field}
                  value={form[current.field.id]}
                  onChange={setField}
                />
              </div>
            ) : (
              <input
                className="tf-input-line"
                type={
                  current.field.type === "email"
                    ? "email"
                    : current.field.type === "phone"
                      ? "tel"
                      : current.field.type === "age" || current.field.type === "number"
                        ? "number"
                        : "text"
                }
                value={form[current.field.id] ?? ""}
                onChange={(e) => setField(current.field.id, e.target.value)}
                placeholder="Escribe tu respuesta…"
                autoFocus
              />
            )}
            <FieldError error={errors[current.field.id]} />
          </>
        )}

        {current?.type === "consent" && (
          <>
            <div className="tf-step-num">{step + 1}</div>
            <h1 className="tf-question">Último paso: tu consentimiento</h1>
            <p className="tf-hint">
              Tratamos tus datos según nuestra política de privacidad (Ley 1581 de 2012 — Colombia).
            </p>
            <label className="tf-consent" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={form[CONSENT_PRIVACY_ID] === true}
                onChange={(e) => setField(CONSENT_PRIVACY_ID, e.target.checked)}
              />
              <span>
                Acepto la{" "}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer">
                  política de privacidad y tratamiento de datos
                </a>{" "}
                *
              </span>
            </label>
            <label className="tf-consent" style={{ display: "flex", gap: 10 }}>
              <input
                type="checkbox"
                checked={form[CONSENT_MARKETING_ID] === true}
                onChange={(e) => setField(CONSENT_MARKETING_ID, e.target.checked)}
              />
              <span>
                Autorizo recibir información, promociones y novedades sobre eventos por correo o
                mensaje (opcional).
              </span>
            </label>
            <FieldError error={errors[CONSENT_PRIVACY_ID]} />
            <FieldError error={errors.submit} />
          </>
        )}
      </div>

      {current?.type !== "intro" && <div className="tf-footer">
        {step > 0 && (
          <button type="button" className="tf-btn-back" onClick={back} aria-label="Atrás">
            ↑
          </button>
        )}
        <button
          type="button"
          className="tf-btn-ok"
          onClick={next}
          disabled={submitting}
        >
          {submitting ? "…" : step === total - 1 ? "ENVIAR" : "OK"}
        </button>
      </div>}
    </div>
  );
}
