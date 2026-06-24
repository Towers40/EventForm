import { isNative, PUBLIC_WEB_URL } from "./platform.js";

// VITE_API_URL = URL del backend externo (Vercel/local).
// - Web: si está vacío, las llamadas van a /api/* en el mismo dominio (Vercel).
// - Nativo (Capacitor): no existe "mismo dominio", así que se usa la URL
//   absoluta de producción (PUBLIC_WEB_URL) cuando no hay VITE_API_URL.
const ENV_API = import.meta.env.VITE_API_URL || "";
const API = ENV_API || (isNative ? PUBLIC_WEB_URL : "");

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
    const err = new Error(data.error || data.message || "Error de servidor");
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
  publicRegister: (slug, body) =>
    request(`/api/public/events/${slug}/register`, { method: "POST", body: JSON.stringify(body) }),
  cancelRegistration: (ticketId) =>
    request(`/api/public/registrations/${ticketId}/cancel`, { method: "PATCH" }),
  adminOverview: (token) => request("/api/admin/overview", {}, token),
  discoverEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/public/events${qs ? `?${qs}` : ""}`);
  },
  discoverCategories: () => request("/api/public/categories"),
};
