const CAPACITY_MAX = {
  "under-50": 49,
  "0-50": 50,
  "50-100": 100,
  "100-300": 300,
  "300+": 10000,
};

export function getCapacityMax(capacity, event) {
  if (capacity === "under-50") {
    const custom = Number(event?.capacityCustom);
    return custom > 0 && custom < 50 ? custom : CAPACITY_MAX[capacity];
  }
  if (capacity in CAPACITY_MAX) return CAPACITY_MAX[capacity];
  // Capacidad numérica del formulario nuevo (ej. "50" → 50)
  const n = Number(capacity);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getRegistrationCount(event) {
  return event?.registrations?.length ?? 0;
}

export function spotsRemaining(event) {
  const max = getCapacityMax(event?.capacity, event);
  if (max == null) return null;
  return Math.max(0, max - getRegistrationCount(event));
}

export function isSoldOut(event) {
  if (event?.manualSoldOut) return true;
  const max = getCapacityMax(event?.capacity, event);
  if (max == null) return false;
  return getRegistrationCount(event) >= max;
}

export function capacityLabel(event) {
  const count = getRegistrationCount(event);
  const max = getCapacityMax(event?.capacity, event);
  if (max == null) return `${count} inscritos`;
  if (isSoldOut(event)) return `${count} / ${max} · AGOTADO`;
  return `${count} / ${max} cupos`;
}
