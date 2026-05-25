const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()-]{8,}$/;

/** Extrae TICKET-XXXX desde texto crudo o URL del QR. */
export function parseTicketCode(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const data = url.searchParams.get("data");
      if (data) return parseTicketCode(data);
    }
  } catch {
    /* no es URL válida */
  }

  if (upper.includes("DATA=")) {
    const part = upper.split("DATA=")[1]?.split("&")[0];
    if (part) return parseTicketCode(decodeURIComponent(part));
  }

  const match = upper.match(/TICKET-[A-Z0-9]+/);
  return match ? match[0] : upper.replace(/\s/g, "");
}

export function validateRegistrationForm(fields, form) {
  const errors = {};

  for (const f of fields) {
    const v = form[f.id];

    if (f.required) {
      if (f.type === "checkbox") {
        if (v !== true) errors[f.id] = "Debes aceptar para continuar.";
        continue;
      }
      if (f.type === "multi_select") {
        if (!Array.isArray(v) || v.length === 0) {
          errors[f.id] = "Selecciona al menos una opción.";
        }
        continue;
      }
      if (v === undefined || v === null || String(v).trim() === "") {
        errors[f.id] = "Este campo es requerido.";
      }
    }

    if (!v && v !== false) continue;

    if (f.type === "email" && !EMAIL_RE.test(String(v))) {
      errors[f.id] = "Ingresa un correo electrónico válido.";
    }
    if (f.type === "phone" && !PHONE_RE.test(String(v))) {
      errors[f.id] = "Ingresa un teléfono válido (mín. 8 dígitos).";
    }
    if (f.type === "age") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 120) {
        errors[f.id] = "Ingresa una edad válida (1–120).";
      }
    }
    if (f.type === "number" && Number.isNaN(Number(v))) {
      errors[f.id] = "Ingresa un número válido.";
    }
    if (f.type === "select" && f.options?.length && !f.options.includes(v)) {
      errors[f.id] = "Selecciona una opción de la lista.";
    }
    if (f.type === "multi_select" && Array.isArray(v)) {
      const invalid = v.some((opt) => !f.options?.includes(opt));
      if (invalid) errors[f.id] = "Hay opciones no válidas.";
    }
  }

  return errors;
}

/**
 * Busca boleto, marca check-in y devuelve estado.
 * @param {string|null} eventIdFilter - si se define, solo busca en ese evento
 */
export function performCheckIn(events, rawCode, eventIdFilter = null) {
  const ticketId = parseTicketCode(rawCode);
  if (!ticketId) return { status: "nf" };

  let foundEvent = null;
  let foundReg = null;

  for (const e of events) {
    if (eventIdFilter && e.id !== eventIdFilter) continue;
    const r = e.registrations.find((reg) => reg.id === ticketId);
    if (r) {
      foundEvent = e;
      foundReg = r;
      break;
    }
  }

  if (!foundReg) return { status: "nf", ticketId };

  if (foundReg.used) {
    return {
      status: "used",
      ticketId,
      event: foundEvent,
      reg: foundReg,
      participant: buildParticipant(foundEvent, foundReg),
    };
  }

  const checkedInAt = Date.now();
  const updatedReg = { ...foundReg, used: true, checkedInAt };
  const updatedEvents = events.map((e) => {
    if (e.id !== foundEvent.id) return e;
    return {
      ...e,
      registrations: e.registrations.map((reg) =>
        reg.id === ticketId ? updatedReg : reg
      ),
    };
  });

  return {
    status: "ok",
    ticketId,
    events: updatedEvents,
    event: foundEvent,
    reg: updatedReg,
    participant: buildParticipant(foundEvent, updatedReg),
    checkedInAt,
  };
}

export function buildParticipant(event, reg) {
  const rows = [];
  for (const f of event.fields) {
    const val = reg.data[f.id];
    if (val === undefined || val === null || val === "") continue;
    const display =
      f.type === "checkbox"
        ? val
          ? "Sí"
          : "No"
        : Array.isArray(val)
          ? val.join(", ")
          : String(val);
    rows.push({ label: f.label, value: display });
  }
  const primary =
    rows.find((r) => /nombre/i.test(r.label))?.value ||
    rows[0]?.value ||
    "Participante";
  return { name: primary, rows };
}

export function daysInMonth(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!m || !y) return 31;
  return new Date(y, m, 0).getDate();
}
