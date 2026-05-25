// En desarrollo, '' usa el proxy de Vite (/api → localhost:3001)
const API = import.meta.env.VITE_API_URL ?? "";

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}, token) {
  if (!API) throw new Error("API no configurada");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(token), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || "Error de servidor");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const apiEnabled = Boolean(API) || import.meta.env.DEV;

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  registerHost: (email, password, name) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  me: (token) => request("/api/auth/me", {}, token),
  events: (token) => request("/api/events", {}, token),
  saveEvent: (token, event) =>
    event.id && event._persisted
      ? request(`/api/events/${event.id}`, { method: "PUT", body: JSON.stringify(event) }, token)
      : request("/api/events", { method: "POST", body: JSON.stringify(event) }, token),
  deleteEvent: (token, id) => request(`/api/events/${id}`, { method: "DELETE" }, token),
  setSoldOut: (token, id, manualSoldOut) =>
    request(`/api/events/${id}/sold-out`, {
      method: "PATCH",
      body: JSON.stringify({ manualSoldOut }),
    }, token),
  checkIn: (token, eventId, ticketId) =>
    request(`/api/events/${eventId}/check-in`, {
      method: "POST",
      body: JSON.stringify({ ticketId }),
    }, token),
  verifyEmail: (token) => request(`/api/auth/verify-email/${token}`),
  resendVerification: (email) =>
    request("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
  adminOverview: (token) => request("/api/admin/overview", {}, token),
  publicEvent: (slug) => request(`/api/public/events/${slug}`),
  publicRegister: (slug, body) =>
    request(`/api/public/events/${slug}/register`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
