export function getNavigationLinks(lat, lng, label = "") {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const q = encodeURIComponent(label || `${la},${ln}`);
  return {
    apple: `https://maps.apple.com/?daddr=${la},${ln}&q=${q}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}`,
    waze: `https://waze.com/ul?ll=${la},${ln}&navigate=yes`,
  };
}
