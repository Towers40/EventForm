// Zona horaria del producto. El servidor corre en UTC, así que comparar
// fechas "a pelo" rechazaría eventos legítimos: las 14:30 de Bogotá son las
// 19:30 UTC del mismo día.
const TZ = process.env.EVENT_TIMEZONE || "America/Bogota";

/** "Ahora" en la zona del producto, como {date:"YYYY-MM-DD", time:"HH:MM"}. */
export function nowInTz(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

/**
 * ¿El inicio del evento ya pasó? Se compara como texto ordenable
 * ("YYYY-MM-DD HH:MM"), que es exactamente lo que manda el cliente.
 * `graceMin` absorbe el desfase de reloj entre el móvil y el servidor.
 */
export function startIsPast(ev, { graceMin = 10, now = new Date() } = {}) {
  const fecha = ev?.startDate || ev?.date;
  if (!fecha) return false; // sin fecha no hay nada que validar
  const ahora = nowInTz(new Date(now.getTime() + graceMin * 60_000));
  if (fecha > ahora.date) return false;
  if (fecha < ahora.date) return true;
  // Mismo día: sin hora se da por válido (el evento dura el día).
  if (!ev.startTime) return false;
  return ev.startTime < ahora.time;
}

// Aforo máximo de un evento. Vive aquí y no en index.js porque lo necesitan
// tanto las rutas como la lógica de pagos (al recuperar una reserva caducada).
export function capacityMaxOf(ev) {
  const maxMap = { "under-50": 49, "0-50": 50, "50-100": 100, "100-300": 300, "300+": 10000 };
  if (ev.capacity === "under-50") { const c = Number(ev.capacityCustom); return c > 0 && c < 50 ? c : 49; }
  if (ev.capacity in maxMap) return maxMap[ev.capacity];
  const n = Number(ev.capacity);
  return Number.isFinite(n) && n > 0 ? n : null;
}
