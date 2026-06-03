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

/** Lugares frecuentes por ciudad (atajos como apps de mapas). */
export const CITY_LANDMARKS = {
  "Bogotá D.C.": [
    "Corferias",
    "Movistar Arena",
    "Centro Comercial Santafé",
    "Parque Simón Bolívar",
    "Teatro Colón",
    "Centro Internacional",
  ],
  Medellín: [
    "Plaza Mayor",
    "Centro Comercial Santafé Medellín",
    "Estadio Atanasio Girardot",
    "Parque Lleras",
  ],
  Cali: ["Estadio Olímpico Pascual Guerrero", "Centro Comercial Jardín Plaza", "Granada"],
  Cartagena: ["Centro Histórico", "Convention Center Cartagena", "Bocagrande"],
  Barranquilla: ["Estadio Metropolitano", "Puerta de Oro"],
};

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
