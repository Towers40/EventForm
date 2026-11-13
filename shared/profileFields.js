// ─── Datos de perfil reutilizables entre inscripciones ──────────────────────
//
// Lo comparten el servidor (guarda las respuestas en la cuenta al inscribirse)
// y el cliente (rellena el formulario del siguiente evento). Vive fuera de
// src/ y de server/ para que ambos importen LA MISMA lógica: si cada lado
// tuviera su propia lista, un campo se guardaría con una clave y se buscaría
// con otra.
//
// Solo se reconocen datos PERSONALES y estables (teléfono, edad, ciudad…), no
// las preguntas propias de cada evento ("¿alergias?", "¿talla de camiseta?"):
// reutilizar esas respuestas sería adivinar, y guardarlas, acumular datos que
// nadie pidió conservar.

const quitarTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Claves de perfil que se guardan y se pueden editar en "Mi cuenta". */
export const PROFILE_KEYS = [
  { key: "phone",     label: "Teléfono" },
  { key: "age",       label: "Edad" },
  { key: "city",      label: "Ciudad" },
  { key: "document",  label: "Documento" },
  { key: "company",   label: "Empresa u organización" },
  { key: "role",      label: "Cargo u ocupación" },
  { key: "instagram", label: "Instagram" },
  { key: "gender",    label: "Género" },
];
const CLAVES = new Set(PROFILE_KEYS.map((k) => k.key));

/**
 * ¿Qué dato de perfil pide este campo? Devuelve "name", "email", una de
 * PROFILE_KEYS o null si es una pregunta propia del evento.
 */
export function profileKeyFor(field) {
  if (!field) return null;
  const t = field.type;
  const l = quitarTildes(field.label);
  if (t === "email") return "email";
  if (t === "phone" || /\b(telefono|celular|whatsapp|movil)\b/.test(l)) return "phone";
  if (t === "age" || /\bedad\b/.test(l)) return "age";
  if (t === "checkbox" || t === "multi_select" || t === "textarea") return null;
  if (/\b(genero|sexo)\b/.test(l)) return "gender";
  if (t !== "text" && t !== "select" && t !== "number") return null;
  if (/\bnombre/.test(l) && !/\b(empresa|evento|equipo|marca|negocio)\b/.test(l)) return "name";
  if (/\b(cedula|documento|identificacion|dni|pasaporte)\b/.test(l)) return "document";
  if (/\b(ciudad|municipio)\b/.test(l)) return "city";
  if (/\b(empresa|compania|organizacion|universidad|colegio)\b/.test(l)) return "company";
  if (/\b(cargo|ocupacion|profesion|rol)\b/.test(l)) return "role";
  if (/\binstagram\b/.test(l)) return "instagram";
  return null;
}

/** Valor que la cuenta tiene para una clave (nombre y correo vienen de la cuenta). */
export function profileValue(user, key) {
  if (!user || !key) return "";
  if (key === "name") return String(user.name || "").trim();
  if (key === "email") return String(user.email || "").trim();
  return String(user.profile?.[key] ?? "").trim();
}

/**
 * Rellena el formulario de un evento con los datos de la cuenta.
 * - `form`: respuestas prellenadas (por id de campo).
 * - `filled`: ids que se completaron solos.
 * - `missing`: campos OBLIGATORIOS que la cuenta no puede contestar.
 * Un select solo se rellena si el valor guardado es una de sus opciones.
 */
export function prefillFromProfile(fields = [], user) {
  const form = {};
  const filled = [];
  const missing = [];
  for (const f of fields) {
    const key = profileKeyFor(f);
    let v = key ? profileValue(user, key) : "";
    if (v && f.type === "select") {
      const opt = (f.options || []).find((o) => quitarTildes(o) === quitarTildes(v));
      v = opt || "";
    }
    if (v && (f.type === "age" || f.type === "number") && !Number.isFinite(Number(v))) v = "";
    if (v) { form[f.id] = v; filled.push(f.id); }
    else if (f.required) missing.push(f);
  }
  return { form, filled, missing };
}

/**
 * Del formulario enviado, saca los datos de perfil que vale la pena recordar
 * para la próxima. Nunca nombre ni correo: esos son de la cuenta y se cambian
 * desde "Mi cuenta", no por lo que alguien escribió al inscribirse.
 */
export function extractProfile(fields = [], form = {}) {
  const out = {};
  for (const f of fields) {
    const key = profileKeyFor(f);
    if (!key || !CLAVES.has(key)) continue;
    const v = form?.[f.id];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const s = String(v).trim().slice(0, 120);
    if (s) out[key] = s;
  }
  return out;
}

/** Limpia un objeto de perfil que llega del cliente (solo claves conocidas). */
export function sanitizeProfile(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input)) {
    if (!CLAVES.has(k)) continue;
    out[k] = v == null ? null : String(v).trim().slice(0, 120) || null;
  }
  return out;
}
