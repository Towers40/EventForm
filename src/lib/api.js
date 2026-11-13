import { isNative, PUBLIC_WEB_URL } from "./platform.js";

// En WEB el frontend y el API viven SIEMPRE en el mismo dominio: en Vercel es
// la función serverless (/api/*) del propio dominio, y en desarrollo el proxy
// de Vite enruta /api → localhost:3001. Por eso en web usamos rutas relativas
// y NO una URL absoluta.
//
// Fijar VITE_API_URL a una URL absoluta rompía los dominios de preview de
// Vercel (event-form-git-main-…, event-form-<hash>-…): el login se volvía
// cross-origin hacia otro dominio y, con la barra final, el preflight de CORS
// recibía un redirect (no permitido) → "Failed to fetch" → no se podía entrar.
//
// La URL absoluta solo aplica a la app NATIVA (Capacitor), donde no existe
// "mismo dominio". Se normaliza la barra final para evitar rutas con "//api".
const ENV_API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API = isNative ? (ENV_API || PUBLIC_WEB_URL).replace(/\/+$/, "") : "";

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}, token) {
  // Usa URL relativa cuando no hay base configurada (mismo dominio Vercel)
  const url = API ? `${API}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(token), ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // `message` primero: `error` es el código para el código (p. ej.
    // "start_in_past") y enseñárselo al usuario tal cual queda fatal. El código
    // sigue disponible en `err.data.error` para quien lo necesite.
    const err = new Error(data.message || data.error || "Error de servidor");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// API activa si hay URL configurada, en producción (Vercel) o en desarrollo local
export const apiEnabled = Boolean(API) || import.meta.env.PROD || import.meta.env.DEV;

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  registerHost: (email, password, name) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  me: (token) => request("/api/auth/me", {}, token),
  myTickets: (token) => request("/api/auth/my-tickets", {}, token),
  events: (token) => request("/api/events", {}, token),
  saveEvent: (token, event) =>
    event.id && event._persisted
      ? request(`/api/events/${event.id}`, { method: "PUT", body: JSON.stringify(event) }, token)
      : request("/api/events", { method: "POST", body: JSON.stringify(event) }, token),
  deleteEvent: (token, id) => request(`/api/events/${id}`, { method: "DELETE" }, token),
  setSoldOut: (token, id, manualSoldOut) =>
    request(`/api/events/${id}/sold-out`, { method: "PATCH", body: JSON.stringify({ manualSoldOut }) }, token),
  checkIn: (token, eventId, ticketId) =>
    request(`/api/events/${eventId}/check-in`, { method: "POST", body: JSON.stringify({ ticketId }) }, token),
  verifyCode: (email, code) =>
    request("/api/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) }),
  resendCode: (email) =>
    request("/api/auth/resend-code", { method: "POST", body: JSON.stringify({ email }) }),
  forgotPassword: (email) =>
    request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (email, code, newPassword) =>
    request("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code, newPassword }) }),
  updateMe: (token, fields) =>
    request("/api/auth/me", { method: "PATCH", body: JSON.stringify(typeof fields === "string" ? { name: fields } : fields) }, token),
  changePassword: (token, currentPassword, newPassword) =>
    request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }, token),
  deleteAccount: (token) =>
    request("/api/auth/me", { method: "DELETE" }, token),
  verifyEmail: (token) => request(`/api/auth/verify-email/${token}`),
  publicEvent: (slug) => request(`/api/public/events/${slug}`),
  publicTicket: (ticketId) => request(`/api/public/tickets/${ticketId}`),
  // El token es opcional: solo los eventos con "Requerir aprobación" lo exigen
  // (el servidor responde 401 account_required si falta).
  publicRegister: (slug, body, token) =>
    request(`/api/public/events/${slug}/register`, { method: "POST", body: JSON.stringify(body) }, token),
  // Acepta un ticket o varios. En lote, el servidor manda UN solo correo por
  // persona con todas sus entradas aprobadas.
  setRegistrationApproval: (token, eventId, ticketIds, approved) => {
    const ids = Array.isArray(ticketIds) ? ticketIds : [ticketIds];
    return request(`/api/events/${eventId}/registrations/approval`,
      { method: "PATCH", body: JSON.stringify({ ticketIds: ids, approved }) }, token);
  },
  cancelRegistration: (ticketId) =>
    request(`/api/public/registrations/${ticketId}/cancel`, { method: "PATCH" }),
  // Poner / quitar una entrada pagada en reventa.
  ticketResale: (token, ticketId, listed) =>
    request(`/api/public/tickets/${ticketId}/resale`, { method: "POST", body: JSON.stringify({ listed }) }, token),
  adminOverview: (token) => request("/api/admin/overview", {}, token),
  migrateAvatars: (token) => request("/api/admin/migrate-avatars", { method: "POST" }, token),
  migrateEventImages: (token) => request("/api/admin/migrate-event-images", { method: "POST" }, token),
  discoverEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/public/events${qs ? `?${qs}` : ""}`);
  },
  discoverCategories: () => request("/api/public/categories"),
  // Perfil público de un organizador: sus datos y todo lo que organiza.
  publicHost: (id) => request(`/api/public/hosts/${encodeURIComponent(id)}`),
  discoverCities: () => request("/api/public/cities"),
};
