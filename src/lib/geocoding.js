import { getCityGeo } from "./colombia.js";

const PHOTON = "https://photon.komoot.io/api/";

function mapPhotonFeature(f, cityLabel) {
  const p = f.properties || {};
  const name = p.name || p.street || p.city || "";
  const locality = p.city || p.locality || p.district || cityLabel;
  const detail = [p.street, p.housenumber, p.district, p.state]
    .filter(Boolean)
    .join(", ");
  const label = [p.name, detail, locality, "Colombia"].filter(Boolean).join(", ");
  const [lng, lat] = f.geometry?.coordinates || [];

  return {
    id: `${p.osm_type || "osm"}-${p.osm_id || label}`,
    label,
    shortLabel: p.name || label.split(",")[0],
    subtitle: detail || locality,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    address: label,
    source: "photon",
  };
}

async function fetchPhoton(query, bbox) {
  const params = new URLSearchParams({
    q: query,
    limit: "15",
    bbox,
  });

  const res = await fetch(`${PHOTON}?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  if (data?.lang || data?.message) return [];

  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .map((f) => mapPhotonFeature(f, ""))
    .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}

function dedupePlaces(list) {
  const seen = new Set();
  return list.filter((p) => {
    const key = `${p.lat.toFixed(5)}-${p.lng.toFixed(5)}-${p.shortLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Autocompletado: nombre de lugar o dirección parcial en la ciudad.
 */
export async function searchPlacesInColombia(city, query) {
  const q = String(query ?? "").trim();
  const c = String(city ?? "").trim();
  if (!c || q.length < 1) return [];

  const geo = getCityGeo(c);
  const queries = [
    `${q}, ${geo.search}, Colombia`,
    `${q} ${geo.search}`,
    q.length >= 3 ? q : null,
  ].filter(Boolean);

  const batches = await Promise.all(
    queries.map((searchQ) => fetchPhoton(searchQ, geo.bbox))
  );

  return dedupePlaces(batches.flat()).slice(0, 12);
}

/**
 * Ubica un solo lugar por nombre (sin dirección completa).
 */
export async function geocodePlaceInColombia(city, query) {
  const results = await searchPlacesInColombia(city, query);
  if (!results.length) return null;

  const qLower = query.trim().toLowerCase();
  const exact = results.find(
    (r) =>
      r.shortLabel?.toLowerCase() === qLower ||
      r.shortLabel?.toLowerCase().includes(qLower)
  );
  return exact || results[0];
}
