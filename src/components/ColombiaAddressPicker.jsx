import { useState, useEffect, useRef, useCallback } from "react";
import { COLOMBIA_CITIES, CITY_LANDMARKS } from "../lib/colombia.js";
import {
  searchPlacesInColombia,
  geocodePlaceInColombia,
} from "../lib/geocoding.js";
import LocationMap from "./LocationMap.jsx";
import {
  inputStyle,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  VERDE_PASTEL_BG,
  VERDE_CORPORATIVO,
  BLANCO_CONTRASTE,
} from "../lib/theme.js";

function Lbl({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 800,
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

export default function ColombiaAddressPicker({ value, onChange }) {
  const { city = "", address = "", lat = null, lng = null } = value || {};
  const [query, setQuery] = useState(address || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(Boolean(lat != null && lng != null));
  const debounceRef = useRef(null);
  const requestId = useRef(0);

  const isLocated = lat != null && lng != null && confirmed;

  useEffect(() => {
    if (address && address !== query) setQuery(address);
    if (lat != null && lng != null) setConfirmed(true);
  }, [address, lat, lng]);

  const applyPlace = useCallback(
    (place) => {
      setQuery(place.shortLabel || place.label);
      setOpen(false);
      setError("");
      setConfirmed(true);
      onChange({
        city,
        address: place.address || place.label,
        location: place.shortLabel || place.label,
        lat: place.lat,
        lng: place.lng,
      });
    },
    [city, onChange]
  );

  const runSearch = useCallback(
    async (text) => {
      if (!city || text.length < 1) {
        setSuggestions([]);
        return;
      }
      const id = ++requestId.current;
      setLoading(true);
      setError("");
      try {
        const results = await searchPlacesInColombia(city, text);
        if (id !== requestId.current) return;
        setSuggestions(results);
        setOpen(true);
        if (results.length === 0 && text.length >= 2) {
          setError("No hay sugerencias. Prueba otro nombre o usa «Ubicar en mapa».");
        }
      } catch {
        if (id === requestId.current) {
          setError("Sin conexión. Revisa internet e intenta de nuevo.");
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [city]
  );

  useEffect(() => {
    if (!city) {
      setSuggestions([]);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [city, query, runSearch]);

  const onCityChange = (newCity) => {
    onChange({
      city: newCity,
      address: "",
      location: "",
      lat: null,
      lng: null,
    });
    setQuery("");
    setSuggestions([]);
    setConfirmed(false);
    setError("");
    setOpen(false);
  };

  const onQueryChange = (text) => {
    setQuery(text);
    setConfirmed(false);
    setError("");
    onChange({
      city,
      address: text,
      location: text,
      lat: null,
      lng: null,
    });
  };

  const locateOnMap = async () => {
    if (!city || query.trim().length < 2) {
      setError("Escribe al menos 2 letras del nombre del lugar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const place = await geocodePlaceInColombia(city, query.trim());
      if (!place) {
        setError(
          `No encontramos «${query}» en ${city}. Prueba un nombre más conocido o elige una sugerencia.`
        );
        return;
      }
      applyPlace(place);
    } catch {
      setError("Error al ubicar. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const landmarks = CITY_LANDMARKS[city] || [];

  return (
    <div>
      <Lbl>Ciudad en Colombia *</Lbl>
      <select
        style={inputStyle}
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
      >
        <option value="">— Selecciona la ciudad —</option>
        {COLOMBIA_CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {city && (
        <div style={{ marginTop: 16, position: "relative" }}>
          <Lbl>Nombre del lugar o dirección *</Lbl>
          <p style={{ fontSize: 12, color: NEGRO_MUTED_70, marginBottom: 10, lineHeight: 1.4 }}>
            Escribe como en Google Maps o Waze: solo el nombre del local, parque, centro
            comercial o dirección. La app ubica las coordenadas en {city}.
          </p>

          <input
            type="text"
            style={{ ...inputStyle, paddingRight: 12 }}
            placeholder="Ej. Movistar Arena, Corferias, Parque 93…"
            value={query}
            autoComplete="off"
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 250)}
          />

          {landmarks.length > 0 && !isLocated && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {landmarks.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={async () => {
                    setQuery(name);
                    setLoading(true);
                    setError("");
                    try {
                      const place = await geocodePlaceInColombia(city, name);
                      if (place) applyPlace(place);
                      else {
                        onQueryChange(name);
                        await runSearch(name);
                      }
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "6px 10px",
                    borderRadius: 100,
                    border: `1px solid ${NEGRO_PURO}`,
                    background: VERDE_PASTEL_BG,
                    cursor: "pointer",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="touch-target"
              onClick={locateOnMap}
              disabled={loading || query.trim().length < 2}
              style={{
                flex: 1,
                minWidth: 140,
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                background: "#222b4c",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? "wait" : "pointer",
                opacity: query.trim().length < 2 ? 0.4 : 1,
              }}
            >
              {loading ? "Buscando…" : "📍 Ubicar en mapa"}
            </button>
          </div>

          {loading && (
            <p style={{ fontSize: 12, color: NEGRO_MUTED_70, marginTop: 8 }}>
              Buscando lugares en {city}…
            </p>
          )}

          {error && (
            <p style={{ fontSize: 12, color: "#991b1b", marginTop: 8, fontWeight: 700 }}>
              {error}
            </p>
          )}

          {open && suggestions.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: "8px 0 0",
                padding: 0,
                border: `2px solid ${NEGRO_PURO}`,
                borderRadius: 14,
                background: "#fff",
                maxHeight: 260,
                overflowY: "auto",
                position: "absolute",
                left: 0,
                right: 0,
                zIndex: 30,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyPlace(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      border: "none",
                      borderBottom: `1px solid ${VERDE_PASTEL_BG}`,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: NEGRO_PURO }}>
                      {s.shortLabel}
                    </div>
                    {s.subtitle && (
                      <div style={{ fontSize: 11, color: NEGRO_MUTED_70, marginTop: 2 }}>
                        {s.subtitle}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isLocated && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: VERDE_PASTEL_BG,
                border: `2px solid ${VERDE_CORPORATIVO}`,
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ✓ Ubicación confirmada — {address}
            </div>
          )}
        </div>
      )}

      {isLocated && (
        <>
          <LocationMap lat={lat} lng={lng} />
        </>
      )}
    </div>
  );
}

/** Indica si la ubicación está lista para continuar el wizard. */
export function isLocationReady(value) {
  return Boolean(
    value?.city?.trim() &&
      value?.address?.trim() &&
      value?.lat != null &&
      value?.lng != null
  );
}
