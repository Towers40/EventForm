const CAPACITY_MAX = {
  "0-50": 50,
  "50-100": 100,
  "100-300": 300,
  "300+": 10000,
};

export function getCapacityMax(capacity) {
  return CAPACITY_MAX[capacity] ?? null;
}

export function getRegistrationCount(event) {
  return event?.registrations?.length ?? 0;
}

export function spotsRemaining(event) {
  const max = getCapacityMax(event?.capacity);
  if (max == null) return null;
  return Math.max(0, max - getRegistrationCount(event));
}

export function isSoldOut(event) {
  if (event?.manualSoldOut) return true;
  const max = getCapacityMax(event?.capacity);
  if (max == null) return false;
  return getRegistrationCount(event) >= max;
}

export function capacityLabel(event) {
  const count = getRegistrationCount(event);
  const max = getCapacityMax(event?.capacity);
  if (max == null) return `${count} inscritos`;
  if (isSoldOut(event)) return `${count} / ${max} · AGOTADO`;
  return `${count} / ${max} cupos`;
}
