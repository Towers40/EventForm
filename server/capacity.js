// Aforo máximo de un evento. Vive aquí y no en index.js porque lo necesitan
// tanto las rutas como la lógica de pagos (al recuperar una reserva caducada).
export function capacityMaxOf(ev) {
  const maxMap = { "under-50": 49, "0-50": 50, "50-100": 100, "100-300": 300, "300+": 10000 };
  if (ev.capacity === "under-50") { const c = Number(ev.capacityCustom); return c > 0 && c < 50 ? c : 49; }
  if (ev.capacity in maxMap) return maxMap[ev.capacity];
  const n = Number(ev.capacity);
  return Number.isFinite(n) && n > 0 ? n : null;
}
