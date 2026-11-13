import { getCityGeo, getCityCenter, matchColombiaCity } from "./colombia.js";

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

// ─── Buscador de lugares para crear un evento ───────────────────────────────
//
// UNA consulta por búsqueda (Photon limita a quien abusa: con tres en paralelo
// por tecla, como hace searchPlacesInColombia, se llega rápido al límite),
// acotada a Colombia y sesgada hacia la ciudad elegida. Los resultados se
// ordenan para que salgan primero los SITIOS (parques, teatros, bares…) de esa
// ciudad, y después calles, paradas de bus y lo de fuera.


const COLOMBIA_BBOX = "-79.1,-4.3,-66.8,13.5";

const TIPOS = {
  park: "Parque", theatre: "Teatro", stadium: "Estadio", events_venue: "Lugar de eventos",
  conference_centre: "Centro de convenciones", exhibition_centre: "Centro de convenciones",
  arts_centre: "Centro cultural", museum: "Museo", mall: "Centro comercial", restaurant: "Restaurante",
  cafe: "Café", bar: "Bar", pub: "Bar", biergarten: "Bar", nightclub: "Discoteca", university: "Universidad",
  college: "Universidad", school: "Colegio", hotel: "Hotel", hostel: "Hostal", square: "Plaza",
  place_of_worship: "Iglesia", cinema: "Cine", library: "Biblioteca", sports_centre: "Centro deportivo",
  fast_food: "Comida rápida", zoo: "Zoológico", garden: "Jardín", neighbourhood: "Barrio",
  suburb: "Barrio", quarter: "Barrio", community_centre: "Centro comunitario", attraction: "Atracción",
  viewpoint: "Mirador", castle: "Sitio histórico", historic: "Sitio histórico", marina: "Marina",
  beach: "Playa", coworking_space: "Coworking", gym: "Gimnasio", fitness_centre: "Gimnasio",
  pitch: "Cancha", recreation_ground: "Parque", nature_reserve: "Reserva natural",
};
const TRANSPORTE = new Set(["bus_stop", "bus_station", "platform", "station", "stop_position", "halt"]);

const cache = new Map();

/** Etiqueta en español del tipo de lugar (o "" si no aporta). */
export function placeTypeLabel(p) {
  if (p?.osm_key === "highway") return "Calle";
  return TIPOS[p?.osm_value] || "";
}

/**
 * Busca lugares y direcciones. `city` sesga los resultados hacia esa ciudad.
 * Devuelve [{ id, name, subtitle, type, label, address, city, lat, lng }].
 */
export async function searchEventPlaces(query, city, { signal } = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];
  const clave = `${city}|${q.toLowerCase()}`;
  if (cache.has(clave)) return cache.get(clave);

  const { lat, lon } = getCityCenter(city);
  const params = new URLSearchParams({
    q, limit: "15", bbox: COLOMBIA_BBOX,
    lat: String(lat), lon: String(lon), location_bias_scale: "0.2", zoom: "12",
  });
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error("No se pudo buscar. Intenta de nuevo en un momento.");
  const data = await res.json();

  const pareceDireccion = /\d|\b(calle|cl|carrera|cra|kr|av|avenida|diagonal|dg|transversal|tv)\b/i.test(q);
  const vistos = new Set();
  const lista = (data?.features || []).map((f) => {
    const p = f.properties || {};
    const [lng, latF] = f.geometry?.coordinates || [];
    const ciudadRes = matchColombiaCity(p.city) || matchColombiaCity(p.county) || null;
    const cerca = Number.isFinite(latF) && Math.hypot(latF - lat, lng - lon) < 0.3;
    const nombre = p.name || [p.street, p.housenumber].filter(Boolean).join(" ") || "";
    const zona = [p.district || p.locality, p.city || p.county].filter(Boolean);
    const tipo = placeTypeLabel(p);
    const calle = [p.street, p.housenumber].filter(Boolean).join(" ");
    return {
      id: `${p.osm_type || "n"}${p.osm_id || nombre}`,
      name: nombre,
      type: tipo,
      subtitle: [tipo, calle && calle !== nombre ? calle : null, ...zona].filter(Boolean).join(" · "),
      label: [nombre, calle && calle !== nombre ? calle : null, ...zona].filter(Boolean).join(", "),
      address: [nombre, calle && calle !== nombre ? calle : null, ...zona].filter(Boolean).join(", "),
      city: ciudadRes || (cerca ? city : (p.city || "")),
      lat: latF, lng,
      _puntos: (cerca ? 4 : 0)
        + (TRANSPORTE.has(p.osm_value) ? -3 : 0)
        + (p.osm_key === "highway" ? (pareceDireccion ? 1 : -2) : 1)
        + (tipo && p.osm_key !== "highway" ? 1 : 0),
    };
  }).filter((x) => {
    if (!x.name || !Number.isFinite(x.lat) || !Number.isFinite(x.lng)) return false;
    const k = `${x.name.toLowerCase()}|${x.lat.toFixed(3)}|${x.lng.toFixed(3)}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  // Orden estable: más puntos primero; a igualdad, el orden de Photon.
  const ordenados = lista
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x._puntos - a.x._puntos || a.i - b.i)
    .map(({ x }) => { delete x._puntos; return x; })
    .slice(0, 10);
  cache.set(clave, ordenados);
  return ordenados;
}
