// Redes sociales del organizador de un evento.
//
// Al crear el evento se puede escribir el usuario ("@tapin.co") o pegar el
// enlace completo; `socialUrl` lo convierte siempre en una URL de ESA red (un
// enlace a otro dominio se descarta: el logo de Instagram no puede llevar a
// una web cualquiera). Los logos son glifos monocromos que heredan el color.

const g = (d, extra) => (size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{d}</svg>
);

export const SOCIALS = [
  { key: "instagram", label: "Instagram", placeholder: "@usuario", host: "instagram.com", base: "https://www.instagram.com/",
    icon: g(<><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" /></>) },
  { key: "linkedin", label: "LinkedIn", placeholder: "usuario o enlace", host: "linkedin.com", base: "https://www.linkedin.com/in/",
    icon: g(<><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M8 10.5v6M8 7.6v.01M11.6 16.5v-6M11.6 13.2c0-1.6 1-2.7 2.4-2.7s2.2 1 2.2 2.7v3.3" /></>) },
  { key: "facebook", label: "Facebook", placeholder: "página o enlace", host: "facebook.com", base: "https://www.facebook.com/",
    icon: g(<><circle cx="12" cy="12" r="9" /><path d="M15 8.2h-1.3c-.9 0-1.4.6-1.4 1.5V20.6M10.2 13h4.4" /></>) },
  { key: "spotify", label: "Spotify", placeholder: "enlace del perfil o playlist", host: "spotify.com", base: "https://open.spotify.com/user/",
    icon: g(<><circle cx="12" cy="12" r="9" /><path d="M7.6 9.8c3-.9 6.3-.6 8.9.9M8.2 12.7c2.5-.7 5.1-.4 7.2.8M8.9 15.5c1.9-.5 3.7-.3 5.3.6" /></>) },
];

/** Usuario o enlace → URL segura de esa red, o "" si no es válido. */
export function socialUrl(key, valor) {
  const red = SOCIALS.find((s) => s.key === key);
  const v = String(valor || "").trim();
  if (!red || !v) return "";
  if (/^https?:\/\//i.test(v) || v.includes(red.host)) {
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      const ok = u.hostname === red.host || u.hostname.endsWith(`.${red.host}`);
      return ok && u.protocol === "https:" ? u.toString() : "";
    } catch { return ""; }
  }
  const usuario = v.replace(/^@/, "").replace(/[^A-Za-z0-9._-]/g, "");
  return usuario ? red.base + encodeURIComponent(usuario) + (key === "instagram" ? "/" : "") : "";
}

/** Redes de un evento listas para pintar: [{ key, label, url, icon }]. */
export function eventSocials(ev) {
  return SOCIALS.map((s) => ({ ...s, url: socialUrl(s.key, ev?.socials?.[s.key]) })).filter((s) => s.url);
}
