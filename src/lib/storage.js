const STORAGE_KEY = "eventform_events_v1";

export function normalizeEvent(event) {
  const e = { ...event };
  if (e.desc && !e.eventType) e.eventType = e.desc;
  if (!e.city) e.city = "";
  if (!e.headerImage) e.headerImage = "";
  if (!e.eventTypeCustom) e.eventTypeCustom = "";
  if (e.lat != null && e.lat !== "") e.lat = Number(e.lat);
  else e.lat = null;
  if (e.lng != null && e.lng !== "") e.lng = Number(e.lng);
  else e.lng = null;
  if (!e.registrations) e.registrations = [];
  if (!e.fields) e.fields = [];
  e.registrations = e.registrations.map((r) => ({
    ...r,
    used: Boolean(r.used),
    checkedInAt: r.checkedInAt ?? null,
  }));
  return e;
}

export function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEvent);
  } catch {
    return [];
  }
}

export function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* quota / modo privado */
  }
}
