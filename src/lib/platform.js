// Detección de plataforma y URLs base para web vs. app nativa (Capacitor).
//
// En web (Vercel) el frontend y el API viven en el mismo dominio, así que las
// llamadas relativas (/api) y window.location.origin funcionan tal cual.
//
// Dentro de la app nativa (Capacitor) el WebView se sirve desde
// capacitor://localhost (iOS) o https://localhost (Android), por lo que:
//   - las llamadas al API deben ir a la URL ABSOLUTA de producción.
//   - los enlaces para compartir deben usar la URL web pública (no capacitor://).

export const isNative =
  typeof window !== "undefined" &&
  !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function"
    ? window.Capacitor.isNativePlatform()
    : window.Capacitor);

// URL web pública de producción (para API en nativo y enlaces para compartir).
// Configurable con VITE_PUBLIC_URL; si no, usa el dominio de Vercel.
export const PUBLIC_WEB_URL =
  import.meta.env.VITE_PUBLIC_URL || "https://event-form-navy.vercel.app";

// Base para enlaces públicos compartibles (/e/:slug).
export function publicBaseUrl() {
  if (isNative) return PUBLIC_WEB_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return PUBLIC_WEB_URL;
}
