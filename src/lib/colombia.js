/** Principales ciudades de Colombia para acotar búsqueda de direcciones. */
export const COLOMBIA_CITIES = [
  "Bogotá D.C.",
  "Medellín",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Santa Marta",
  "Ibagué",
  "Pasto",
  "Cúcuta",
  "Villavicencio",
  "Armenia",
  "Montería",
  "Neiva",
  "Sincelejo",
  "Popayán",
  "Valledupar",
  "Tunja",
  "Riohacha",
  "Florencia",
  "Yopal",
  "Quibdó",
  "San Andrés",
];

/**
 * Metadatos por ciudad: nombre para APIs, bbox (minLon,minLat,maxLon,maxLat).
 */
export const CITY_GEO = {
  "Bogotá D.C.": { search: "Bogota", bbox: "-74.25,4.45,-73.95,4.85" },
  Medellín: { search: "Medellin", bbox: "-75.72,6.05,-75.48,6.35" },
  Cali: { search: "Cali", bbox: "-76.58,3.35,-76.42,3.48" },
  Barranquilla: { search: "Barranquilla", bbox: "-74.85,10.95,-74.74,11.05" },
  Cartagena: { search: "Cartagena", bbox: "-75.58,10.35,-75.48,10.48" },
  Bucaramanga: { search: "Bucaramanga", bbox: "-73.15,7.08,-73.08,7.15" },
  Pereira: { search: "Pereira", bbox: "-75.72,4.78,-75.64,4.84" },
  Manizales: { search: "Manizales", bbox: "-75.55,5.04,-75.48,5.10" },
  "Santa Marta": { search: "Santa Marta", bbox: "-74.25,11.20,-74.18,11.28" },
  Ibagué: { search: "Ibague", bbox: "-75.25,4.40,-75.18,4.46" },
  Pasto: { search: "Pasto", bbox: "-77.12,1.20,-77.05,1.24" },
  Cúcuta: { search: "Cucuta", bbox: "-72.55,7.85,-72.45,7.95" },
  Villavicencio: { search: "Villavicencio", bbox: "-73.68,4.12,-73.60,4.18" },
  Armenia: { search: "Armenia", bbox: "-75.72,4.52,-75.65,4.56" },
  Montería: { search: "Monteria", bbox: "-75.92,8.72,-75.85,8.78" },
  Neiva: { search: "Neiva", bbox: "-75.32,2.90,-75.25,2.96" },
  Sincelejo: { search: "Sincelejo", bbox: "-75.42,9.28,-75.35,9.34" },
  Popayán: { search: "Popayan", bbox: "-76.65,2.42,-76.58,2.48" },
  Valledupar: { search: "Valledupar", bbox: "-73.28,10.45,-73.22,10.50" },
  Tunja: { search: "Tunja", bbox: "-73.40,5.52,-73.34,5.56" },
  Riohacha: { search: "Riohacha", bbox: "-72.92,11.52,-72.85,11.56" },
  Florencia: { search: "Florencia", bbox: "-75.62,1.60,-75.55,1.64" },
  Yopal: { search: "Yopal", bbox: "-72.42,5.33,-72.35,5.37" },
  Quibdó: { search: "Quibdo", bbox: "-76.68,5.68,-76.62,5.72" },
  "San Andrés": { search: "San Andres", bbox: "-81.75,12.55,-81.68,12.62" },
};

/**
 * Lugares de referencia por ciudad: atajos en el buscador de ubicación.
 * Son SEMILLAS de búsqueda (al tocarlas se busca ese nombre), no coordenadas
 * fijas. Cada una se comprobó contra Photon (nov 2026) con el sesgo de su
 * ciudad; las que devolvían otro sitio o nada (p. ej. "Parque Lleras") se
 * quitaron para no ofrecer atajos que llevan a "sin resultados".
 */
export const CITY_LANDMARKS = {
  "Bogotá D.C.": [
    "Movistar Arena", "Parque Simón Bolívar", "Teatro Colón", "Teatro Mayor Julio Mario Santo Domingo",
    "Corferias", "Parque de la 93", "Zona T", "Usaquén", "Plaza de Bolívar", "Museo del Oro",
    "Estadio El Campín", "Parque El Virrey", "Centro Comercial Andino", "Ágora Bogotá", "Universidad de los Andes",
  ],
  Medellín: [
    "Estadio Atanasio Girardot", "Parque Explora", "Jardín Botánico de Medellín", "Pueblito Paisa",
    "Museo de Antioquia", "Teatro Metropolitano", "Centro Comercial Santafé", "Parque de los Deseos",
    "Plaza Botero", "Universidad EAFIT",
  ],
  Cali: [
    "Estadio Pascual Guerrero", "Teatro Municipal", "Parque del Perro", "Cristo Rey", "Zoológico de Cali",
    "Centro Comercial Chipichape", "Granada", "Teatro Jorge Isaacs", "Universidad Icesi",
  ],
  Barranquilla: [
    "Estadio Metropolitano Roberto Meléndez", "Gran Malecón", "Museo del Caribe", "Parque Washington",
    "Teatro Amira de la Rosa", "Universidad del Norte",
  ],
  Cartagena: [
    "Centro de Convenciones Cartagena de Indias", "Castillo de San Felipe de Barajas", "Getsemaní",
    "Bocagrande", "Plaza de la Trinidad", "Teatro Adolfo Mejía",
  ],
  Bucaramanga: ["Parque San Pío", "Cenfer", "Parque de los Niños", "Centro Comercial Cacique", "Parque García Rovira"],
  Pereira: ["Expofuturo", "Centro Comercial Unicentro", "Estadio Hernán Ramírez Villegas"],
  Manizales: ["Catedral Basílica de Manizales", "Teatro Los Fundadores", "Expoferias", "Recinto del Pensamiento", "Estadio Palogrande"],
  "Santa Marta": ["Parque de los Novios", "Marina Santa Marta", "Quinta de San Pedro Alejandrino", "Estadio Sierra Nevada"],
};

/** Centro aproximado de una ciudad (punto medio de su bbox). */
export function getCityCenter(city) {
  const [a, b, c, d] = getCityGeo(city || "Bogotá D.C.").bbox.split(",").map(Number);
  return { lat: (b + d) / 2, lon: (a + c) / 2 };
}

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Nombre de ciudad de un resultado ("Santiago de Cali", "Bogotá") → el de la lista ("Cali", "Bogotá D.C."). */
export function matchColombiaCity(name) {
  const n = sinTildes(name);
  if (!n) return null;
  if (n.startsWith("bogota")) return "Bogotá D.C.";
  return COLOMBIA_CITIES.find((c) => {
    const k = sinTildes(c.replace(/D\.C\./, ""));
    return n === k || n.includes(k);
  }) || null;
}

export function getCityGeo(city) {
  return CITY_GEO[city] || { search: city.replace(/D\.C\./gi, "").trim(), bbox: "-81.8,-4.2,-66.9,13.5" };
}

export function formatEventType(event) {
  if (!event) return "";
  if (event.eventType === EVENT_TYPE_OTHER) {
    return event.eventTypeCustom?.trim() || "Otro";
  }
  return event.eventType || event.desc || "";
}

export const EVENT_TYPE_OTHER = "__OTRO__";

export const EVENT_TYPE_PRESETS = [
  "Corporativo / Workshop",
  "Social / Fiesta Privada",
  "Concierto / Evento Masivo",
  "Deporte",
  "Comida & Bebida",
  "Bienestar",
];
