// Límites de fecha y hora de los selectores.
//
// Los dos selectores acotaban solo el DÍA: en el día de hoy seguían ofreciendo
// las 24 horas, así que se podía crear un evento hoy a una hora ya pasada.
// Aquí se calcula, para una fecha dada, qué horas y minutos siguen siendo
// elegibles.

const pad2 = (n) => String(n).padStart(2, "0");

export const MINUTE_STEP = 15;
export const MINUTE_VALUES = [0, 15, 30, 45];

export const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Primer hueco válido a partir de `now`, redondeando hacia arriba al paso de
 * minutos. Si al redondear se pasa de las 23:45, salta al día siguiente: a las
 * 23:50 ya no queda ninguna hora válida hoy.
 */
export function earliestSlot(now = new Date()) {
  const d = new Date(now);
  const m = Math.ceil(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  d.setSeconds(0, 0);
  if (m >= 60) { d.setMinutes(0); d.setHours(d.getHours() + 1); }
  else d.setMinutes(m);
  return { date: toDateStr(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, at: d };
}

/**
 * Cota inferior efectiva: la que pida quien llama (p. ej. la fecha de inicio
 * para el selector de fin) o, si no, "de ahora en adelante".
 */
export function resolveLimit({ minDate, minTime } = {}) {
  const slot = earliestSlot();
  if (!minDate) return { date: slot.date, time: slot.time };
  // Una cota anterior a ahora no sirve de nada: nunca se puede crear en el pasado.
  if (minDate < slot.date) return { date: slot.date, time: minTime || slot.time };
  if (minDate === slot.date) return { date: minDate, time: minTime && minTime > slot.time ? minTime : slot.time };
  return { date: minDate, time: minTime || "00:00" };
}

const partsOf = (t) => {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return { h: h || 0, m: m || 0 };
};

/** Horas elegibles para `dateStr`. En días posteriores al límite, las 24. */
export function hoursFor(dateStr, limit) {
  const all = Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad2(i) }));
  if (!dateStr || !limit || dateStr !== limit.date) return all;
  const { h, m } = partsOf(limit.time);
  // Si en la hora del límite ya no queda ningún minuto del paso, esa hora se cae.
  const desde = m > MINUTE_VALUES[MINUTE_VALUES.length - 1] ? h + 1 : h;
  return all.filter((o) => o.value >= desde);
}

/** Minutos elegibles para `dateStr` a la hora `hour`. */
export function minutesFor(dateStr, hour, limit) {
  const all = MINUTE_VALUES.map((m) => ({ value: m, label: pad2(m) }));
  if (!dateStr || !limit || dateStr !== limit.date) return all;
  const { h, m } = partsOf(limit.time);
  if (hour > h) return all;
  if (hour < h) return [];
  return all.filter((o) => o.value >= m);
}

/**
 * Ajusta una fecha/hora a la cota. Hace falta porque la selección puede quedar
 * inválida sin tocar la hora: basta con mover el día a hoy teniendo elegida
 * una hora de la mañana.
 */
export function clampToLimit({ date, time }, limit) {
  if (!limit) return { date, time };
  const d = date && date > limit.date ? date : limit.date;
  if (d > limit.date) return { date: d, time: time || "00:00" };
  const t = time && time >= limit.time ? time : limit.time;
  return { date: d, time: t };
}
