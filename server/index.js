import "dotenv/config";
import express from "express";
import cors from "cors";
import { customAlphabet } from "nanoid";
import { db, dbReady, initDb, parseEvent, slugify } from "./db.js";
import { uploadToCloudinary, isDataUrl, cloudinaryEnabled } from "./cloudinary.js";
import { migrateBase64Avatars } from "./avatarMigration.js";
import { migrateBase64EventImages } from "./eventImageMigration.js";
import { extractProfile, sanitizeProfile } from "../shared/profileFields.js";

/**
 * Caché de CDN.
 *
 * Se envían las DOS cabeceras a propósito: en producción se observó que el
 * borde de Vercel devolvía `x-vercel-cache: MISS` en peticiones seguidas
 * usando solo `s-maxage`, así que cada visita golpeaba la función y Turso
 * (~1,2 s en caliente, ~8 s en frío). `CDN-Cache-Control` es la cabecera que
 * el borde interpreta de forma explícita; `Cache-Control` queda para el
 * navegador, con max-age=0 para que revalide y no muestre datos viejos.
 */
function setCache(res, { cdn = 30, swr = 60 } = {}) {
  res.set("Cache-Control", `public, max-age=0, s-maxage=${cdn}, stale-while-revalidate=${swr}`);
  res.set("CDN-Cache-Control", `public, s-maxage=${cdn}, stale-while-revalidate=${swr}`);
}

// Middleware: rechaza rutas de DB si no está configurada
function requireDb(req, res, next) {
  if (!dbReady || !db) {
    return res.status(503).json({
      error: "Base de datos no configurada. Agrega TURSO_URL en Vercel → Settings → Environment Variables y haz Redeploy."
    });
  }
  next();
}
import {
  authMiddleware,
  hashPassword,
  optionalAuth,
  requireRole,
  signToken,
  verifyPassword,
} from "./auth.js";
import { emailEnabled, sendVerificationCode, sendPasswordResetCode, sendRegistrationConfirmation, sendApprovalPending } from "./mailer.js";
import { capacityMaxOf, startIsPast } from "./capacity.js";
import { getPaymentProvider, paymentsEnabled, PAYMENT_STATUS, REG_PAYMENT, PaymentError, computeOrder } from "./payments/index.js";
import {
  createOrder, getOrder, getOrderByRef, approveOrder, cancelOrder, markWebhookSeen,
  releaseExpiredHolds, countOccupied, listForResale, unlistResale, countResaleListed, refundTicket,
} from "./payments/orders.js";

const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 3001;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

const configuredOrigins = new Set(
  (process.env.CORS_ORIGIN || "http://localhost:4173,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (vercelProductionUrl) configuredOrigins.add(`https://${vercelProductionUrl}`);
if (APP_URL) configuredOrigins.add(APP_URL);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (configuredOrigins.has(origin)) return true;
  // Orígenes del WebView de la app nativa (Capacitor / Ionic)
  if (origin === "capacitor://localhost" || origin === "ionic://localhost") return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".vercel.app") || hostname.endsWith(".railway.app");
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, origin);
    return callback(null, false);
  },
  credentials: true,
}));
// Se guarda el cuerpo sin parsear: la firma del webhook de la pasarela se
// calcula sobre los bytes exactos que llegaron, no sobre el JSON reserializado
// (un espacio o un orden de claves distinto la invalidaría).
app.use(express.json({
  limit: "6mb",
  verify: (req, _res, buf) => { req.rawBody = buf?.toString("utf8") || ""; },
}));

// Alfabeto solo alfanumérico (sin "_" ni "-") para IDs/tickets legibles y
// sin caracteres que compliquen el parseo del QR.
const nano = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);
function uid() { return nano(); }
// Códigos de verificación y de recuperación: 6 cifras con generador
// criptográfico. Con 4 cifras (9.000 combinaciones) y sin tope de intentos, un
// código de recuperación se adivinaba por fuerza bruta en minutos.
const genCode = customAlphabet("0123456789", 6);

// En producción (Vercel) NUNCA se auto-verifica una cuenta ni se devuelve un
// código en la respuesta: si el correo falla, se dice que falló. Hacerlo
// permitía registrar el correo de otra persona (y ver sus entradas en "Mis
// tickets") o resetear su contraseña sin acceso a su buzón. En local, sin SMTP,
// se mantiene el atajo para poder desarrollar.
const IS_PROD = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

// Límite de intentos por cuenta, guardado en la base (en serverless la memoria
// no se comparte entre instancias, así que un contador en RAM no serviría).
const CODE_MAX_FAILS = 8;          // códigos (verificación + recuperación)
const LOGIN_MAX_FAILS = 10;        // contraseña
const FAIL_WINDOW_MS = 30 * 60 * 1000;
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_RESEND_COOLDOWN_MS = 30 * 1000;

/** ¿La cuenta está bloqueada por demasiados fallos de `kind` ("code"|"login")? */
function isLocked(row, kind) {
  const fails = Number(row?.[`${kind}_fails`] || 0);
  const since = Number(row?.[`${kind}_fail_window`] || 0);
  const max = kind === "login" ? LOGIN_MAX_FAILS : CODE_MAX_FAILS;
  return fails >= max && Date.now() - since < FAIL_WINDOW_MS;
}

async function registerFail(row, kind) {
  try {
  const since = Number(row?.[`${kind}_fail_window`] || 0);
  const fresh = Date.now() - since >= FAIL_WINDOW_MS;
  // `kind` es siempre un literal interno ("code" | "login"), nunca entrada del usuario.
  await db.execute(fresh
    ? { sql: `UPDATE users SET ${kind}_fails = 1, ${kind}_fail_window = ? WHERE id = ?`, args: [Date.now(), row.id] }
    : { sql: `UPDATE users SET ${kind}_fails = ${kind}_fails + 1 WHERE id = ?`, args: [row.id] });
  } catch (e) { console.error("[intentos] no se pudo registrar:", e.message); }
}

async function clearFails(row, kind) {
  if (!Number(row?.[`${kind}_fails`] || 0)) return;
  try {
    await db.execute({ sql: `UPDATE users SET ${kind}_fails = 0, ${kind}_fail_window = NULL WHERE id = ?`, args: [row.id] });
  } catch (e) { console.error("[intentos] no se pudo limpiar:", e.message); }
}

const TOO_MANY = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

/** 500 sin filtrar detalles internos (mensajes de SQL, rutas) en producción. */
function serverError(res, e, tag = "") {
  console.error(`[500]${tag ? " " + tag : ""}`, e?.message || e);
  return res.status(500).json({ error: IS_PROD ? "Error del servidor. Intenta de nuevo." : (e?.message || "Error") });
}

function uniqueSlugBase(title) {
  return slugify(title) || "evento";
}

async function uniqueSlug(title, excludeId = null) {
  let base = uniqueSlugBase(title);
  let slug = base;
  let n = 0;
  while (true) {
    const { rows } = await db.execute({ sql: "SELECT id FROM events WHERE slug = ?", args: [slug] });
    const row = rows[0];
    if (!row || row.id === excludeId) return slug;
    n++;
    slug = `${base}-${n}`;
  }
}

// El "dueño" es la cuenta cuyo correo coincide con SUPER_ADMIN_EMAIL. Se calcula
// en cada petición desde la variable de entorno, sin promover roles en la base
// (más fiable en Vercel, que puede congelar la función antes de terminar la
// inicialización). Da acceso a las acciones de administrador.
function isOwnerEmail(email) {
  const owner = process.env.SUPER_ADMIN_EMAIL;
  return Boolean(owner && email && String(email).toLowerCase() === owner.trim().toLowerCase());
}

// Permite super_admin (por rol en la base) o el dueño (por email en el env).
function requireOwner(req, res, next) {
  if (req.user?.role === "super_admin" || isOwnerEmail(req.user?.email)) return next();
  return res.status(403).json({ error: "Solo el administrador puede hacer esto." });
}

function parseProfile(raw) {
  if (!raw) return {};
  try { const p = JSON.parse(raw); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, name: row.name, role: row.role, avatar: row.avatar || null,
    createdAt: row.created_at, isOwner: isOwnerEmail(row.email),
    // Datos para inscribirse con un clic (ver shared/profileFields.js).
    profile: parseProfile(row.profile),
  };
}

/** Mezcla `cambios` en el perfil guardado; null borra la clave. */
async function mergeProfile(userId, cambios) {
  if (!cambios || !Object.keys(cambios).length) return;
  const { rows } = await db.execute({ sql: "SELECT profile FROM users WHERE id = ?", args: [userId] });
  if (!rows[0]) return;
  const actual = parseProfile(rows[0].profile);
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null || v === "") delete actual[k]; else actual[k] = v;
  }
  await db.execute({ sql: "UPDATE users SET profile = ? WHERE id = ?", args: [JSON.stringify(actual), userId] });
}

async function getRegsForEvent(eventId) {
  // Un checkout a medias no es un inscrito: el anfitrión no debe verlo en su
  // lista ni contarlo como venta.
  const { rows } = await db.execute({
    sql: `SELECT * FROM registrations WHERE event_id = ? AND cancelled = 0
          AND payment_status != 'pending' ORDER BY created_at DESC`,
    args: [eventId],
  });
  return rows.map((r) => ({
    id: r.ticket_id, eventId: r.event_id, data: JSON.parse(r.payload),
    ts: r.created_at, used: Boolean(r.used), checkedInAt: r.checked_in_at,
    consentPrivacy: Boolean(r.consent_privacy), consentMarketing: Boolean(r.consent_marketing),
    approved: r.approved == null ? true : Boolean(r.approved),
    email: r.email || null,
  }));
}

async function attachRegs(ev) {
  ev.registrations = await getRegsForEvent(ev.id);
  return ev;
}

/**
 * Caras de quienes ya se inscribieron, tal como las pinta la tarjeta.
 *
 * Del asistente CON cuenta sale su nombre de pila y su foto; del que se
 * inscribió sin cuenta, solo la inicial. Nunca sale el correo ni el apellido:
 * el listado es público y esto se ve sin haber entrado a la app.
 */
function parseAttendeePreview(raw) {
  if (!raw) return [];
  let lista;
  try { lista = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 4).map((a) => {
    const nombre = String(a?.n || "").trim();
    return {
      name: nombre ? nombre.split(/\s+/)[0] : "",
      initial: String(a?.i || nombre.charAt(0) || "?").toUpperCase().slice(0, 1),
      avatar: a?.a || null,
    };
  });
}

// ─── Auth ──────────────────────────────────────────────────────────────────
app.post("/api/auth/register", requireDb, async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email?.trim() || !password || password.length < 8)
      return res.status(400).json({ error: "Email y contraseña (mín. 8 caracteres) requeridos" });
    if (!/[A-Z]/.test(password))
      return res.status(400).json({ error: "La contraseña debe contener al menos una letra mayúscula" });

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = name?.trim() || "";

    const { rows: existing } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [cleanEmail] });
    const existingUser = existing[0];

    // Email already registered AND verified → block
    if (existingUser && existingUser.email_verified) {
      return res.status(409).json({ error: "Este correo ya tiene una cuenta. Usa 'Iniciar sesión'." });
    }

    const hash = await hashPassword(password);

    let userId;
    if (existingUser) {
      // Unverified account → update password + name so user can verify fresh
      userId = existingUser.id;
      await db.execute({
        sql: "UPDATE users SET password_hash = ?, name = ? WHERE id = ?",
        args: [hash, cleanName, userId],
      });
    } else {
      userId = "U" + uid();
      await db.execute({
        sql: `INSERT INTO users (id, email, password_hash, name, role, email_verified, created_at) VALUES (?, ?, ?, ?, 'host', 0, ?)`,
        args: [userId, cleanEmail, hash, cleanName, Date.now()],
      });
    }

    // Enviar el código de verificación.
    if (emailEnabled) {
      // Re-registro inmediato de una cuenta sin verificar: no reenviar dentro
      // del enfriamiento (evita usar el registro para bombardear un buzón).
      const issuedAt = Number(existingUser?.verify_code_expires || 0) - CODE_TTL_MS;
      if (existingUser?.verify_code && Date.now() - issuedAt < CODE_RESEND_COOLDOWN_MS) {
        return res.json({ pending: true, email: cleanEmail });
      }
      const code = genCode();
      const expires = Date.now() + CODE_TTL_MS;
      await db.execute({
        sql: "UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?",
        args: [code, expires, userId],
      });
      let sent = false;
      try { await sendVerificationCode(cleanEmail, cleanName, code); sent = true; } catch (e) { console.error("Email send failed:", e.message); }
      if (sent) {
        return res.json({ pending: true, email: cleanEmail });
      }
      if (IS_PROD) {
        return res.status(502).json({ error: "email_failed", message: "No pudimos enviarte el código. Intenta de nuevo en unos minutos." });
      }
    } else if (IS_PROD) {
      return res.status(503).json({ error: "email_disabled", message: "El registro no está disponible en este momento." });
    }

    // Solo en desarrollo local (sin correo): auto-verifica y entra directo.
    await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?", args: [userId] });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
    res.json({ token: signToken(rowToUser(rows[0])), user: rowToUser(rows[0]) });
  } catch (e) { serverError(res, e); }
});

app.post("/api/auth/verify-code", requireDb, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: "Email y código requeridos" });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.trim().toLowerCase()] });
    const row = rows[0];
    if (!row) return res.status(400).json({ error: "Código incorrecto" });
    // Una cuenta ya verificada NO devuelve sesión aquí: antes bastaba con
    // conocer el correo de alguien para obtener su token sin código alguno.
    if (row.email_verified) return res.status(409).json({ error: "already_verified", message: "Esta cuenta ya está verificada. Inicia sesión." });
    if (isLocked(row, "code")) return res.status(429).json({ error: "too_many", message: TOO_MANY });
    if (!row.verify_code || row.verify_code !== String(code).trim()) {
      await registerFail(row, "code");
      return res.status(400).json({ error: "Código incorrecto" });
    }
    if (row.verify_code_expires && Date.now() > row.verify_code_expires)
      return res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
    await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?", args: [row.id] });
    await clearFails(row, "code");
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
    const u = rowToUser(updated[0]);
    res.json({ token: signToken(u), user: u });
  } catch (e) { serverError(res, e); }
});

app.post("/api/auth/resend-code", requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    // Misma respuesta exista o no la cuenta: no revela qué correos están dados de alta.
    if (!row) return res.json({ ok: true });
    // Ya verificada → que inicie sesión. Antes devolvía un token sin código.
    if (row.email_verified) return res.json({ ok: true, alreadyVerified: true });
    if (!emailEnabled) {
      if (IS_PROD) return res.status(503).json({ error: "email_disabled", message: "No pudimos enviar el código." });
      // Solo en desarrollo local: auto-verifica.
      await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL WHERE id = ?", args: [row.id] });
      const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
      const u = rowToUser(updated[0]);
      return res.json({ ok: true, token: signToken(u), user: u });
    }
    // Enfriamiento: evita bombardear el buzón de alguien con reenvíos.
    const issuedAt = Number(row.verify_code_expires || 0) - CODE_TTL_MS;
    if (row.verify_code && Date.now() - issuedAt < CODE_RESEND_COOLDOWN_MS) return res.json({ ok: true });
    const code = genCode(); const expires = Date.now() + CODE_TTL_MS;
    await db.execute({ sql: "UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?", args: [code, expires, row.id] });
    try { await sendVerificationCode(row.email, row.name, code); }
    catch (e) {
      console.error("Email send failed:", e.message);
      return res.status(502).json({ error: "email_failed", message: "No pudimos enviarte el código. Intenta de nuevo en unos minutos." });
    }
    res.json({ ok: true });
  } catch (e) { serverError(res, e, "resend-code"); }
});

app.post("/api/auth/login", requireDb, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    if (row && isLocked(row, "login")) return res.status(429).json({ error: "too_many", message: TOO_MANY });
    if (!row || !password || !(await verifyPassword(password, row.password_hash))) {
      if (row) await registerFail(row, "login");
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }
    await clearFails(row, "login");
    const u = rowToUser(row);
    res.json({ token: signToken(u), user: u });
  } catch (e) { serverError(res, e, "login"); }
});

app.post("/api/auth/forgot-password", requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    if (row) {
      // Enfriamiento entre envíos (mismo motivo que en resend-code).
      const issuedAt = Number(row.reset_code_expires || 0) - CODE_TTL_MS;
      if (row.reset_code && Date.now() - issuedAt < CODE_RESEND_COOLDOWN_MS) return res.json({ ok: true });
      const code = genCode(); const expires = Date.now() + CODE_TTL_MS;
      await db.execute({ sql: "UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?", args: [code, expires, row.id] });
      if (emailEnabled) {
        try { await sendPasswordResetCode(row.email, row.name, code); } catch (e) {
          console.error("Email send failed:", e.message);
          // El código JAMÁS viaja en la respuesta en producción: quien pidiera
          // el reseteo de una cuenta ajena se quedaría con ella.
          if (IS_PROD) return res.status(502).json({ error: "email_failed", message: "No pudimos enviar el código. Intenta de nuevo en unos minutos." });
          return res.json({ ok: true, code });
        }
      } else if (!IS_PROD) {
        // Solo en desarrollo local, sin correo configurado.
        return res.json({ ok: true, code });
      }
    }
    res.json({ ok: true });
  } catch (e) { serverError(res, e, "forgot-password"); }
});

app.post("/api/auth/reset-password", requireDb, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ error: "Campos requeridos" });
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword))
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres y una mayúscula" });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.trim().toLowerCase()] });
    const row = rows[0];
    if (!row) return res.status(400).json({ error: "Código incorrecto" });
    if (isLocked(row, "code")) return res.status(429).json({ error: "too_many", message: TOO_MANY });
    if (!row.reset_code || row.reset_code !== String(code).trim()) {
      await registerFail(row, "code");
      return res.status(400).json({ error: "Código incorrecto" });
    }
    if (row.reset_code_expires && Date.now() > row.reset_code_expires)
      return res.status(400).json({ error: "El código expiró" });
    const hash = await hashPassword(newPassword);
    // Recuperar la contraseña también desbloquea el inicio de sesión.
    await db.execute({ sql: "UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?", args: [hash, row.id] });
    await clearFails(row, "code");
    await clearFails(row, "login");
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
    const u = rowToUser(updated[0]);
    res.json({ token: signToken(u), user: u });
  } catch (e) { serverError(res, e); }
});

app.get("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user.sub] });
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: rowToUser(rows[0]) });
  } catch (e) { serverError(res, e); }
});

// Cruza el email del usuario autenticado con las inscripciones (entradas).
app.get("/api/auth/my-tickets", requireDb, authMiddleware, async (req, res) => {
  try {
    const email = String(req.user.email || "").trim().toLowerCase();
    if (!email) return res.json({ tickets: [] });
    // Usa la columna indexada `email` (rápida) y, solo para registros antiguos
    // sin esa columna, recae en el escaneo del payload (no pierde trazabilidad).
    const { rows } = await db.execute({
      sql: `SELECT r.ticket_id, r.payload AS reg_payload, r.used, r.checked_in_at, r.created_at,
                   r.email AS reg_email, r.approved, r.resale_status, r.payment_status,
                   e.slug, e.payload AS event_payload, e.manual_sold_out
            FROM registrations r
            JOIN events e ON e.id = r.event_id
            WHERE r.cancelled = 0 AND r.payment_status != 'pending'
              AND (lower(r.email) = ? OR (r.email IS NULL AND lower(r.payload) LIKE ?))
            ORDER BY r.created_at DESC`,
      args: [email, `%${email}%`],
    });
    const tickets = [];
    for (const row of rows) {
      let data = {};
      try { data = JSON.parse(row.reg_payload); } catch { continue; }
      // Si la inscripción ya quedó atada a este correo (columna `email`), es
      // suya y punto. El repaso del formulario es solo para los registros
      // antiguos sin esa columna — y en eventos con aprobación el correo de la
      // cuenta puede no ser el que se escribió en el formulario, así que exigir
      // la coincidencia en el payload escondería la entrada.
      const linked = String(row.reg_email || "").trim().toLowerCase() === email;
      const match = linked || Object.values(data).some(
        (v) => typeof v === "string" && v.trim().toLowerCase() === email
      );
      if (!match) continue;
      let ev = {};
      try { ev = JSON.parse(row.event_payload); } catch { ev = {}; }
      tickets.push({
        id: row.ticket_id,
        used: Boolean(row.used),
        approved: row.approved == null ? true : Boolean(row.approved),
        requireApproval: Boolean(ev.requireApproval),
        // Reventa: solo tiene sentido ofrecer una entrada que se pagó.
        resale: row.resale_status || "none",
        paid: row.payment_status === "paid",
        checkedInAt: row.checked_in_at,
        createdAt: row.created_at,
        event: {
          slug: row.slug,
          title: ev.title || "Evento",
          startDate: ev.startDate || "",
          date: ev.date || "",
          // Solo URLs: aquí la portada es una miniatura de 56 px y arrastrar
          // cientos de KB en base64 por cada entrada no tiene sentido.
          headerImage: String(ev.headerImage || "").startsWith("http") ? ev.headerImage : "",
          imagePos: ev.imagePos || null,
          imageZoom: ev.imageZoom || null,
          city: ev.city || "",
          location: ev.location || "",
        },
      });
    }
    res.json({ tickets });
  } catch (e) { serverError(res, e); }
});

app.patch("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const { name } = body;
    if (name?.trim()) await db.execute({ sql: "UPDATE users SET name = ? WHERE id = ?", args: [name.trim().slice(0, 120), req.user.sub] });
    // Datos de inscripción rápida: solo claves conocidas; null borra.
    if (body.profile && typeof body.profile === "object") {
      await mergeProfile(req.user.sub, sanitizeProfile(body.profile));
    }
    // Foto de perfil: cadena = guardar, null/"" = eliminar
    if (Object.prototype.hasOwnProperty.call(body, "avatar")) {
      let avatar = body.avatar ? String(body.avatar) : null;
      // Si llega en base64, se sube a Cloudinary y se guarda la URL — así ningún
      // avatar nuevo entra como base64 (que pesa ~50 KB y ralentiza los listados).
      // Si Cloudinary no está configurado o falla, se conserva el base64 (sin
      // regresión respecto al comportamiento anterior).
      if (isDataUrl(avatar)) {
        const url = await uploadToCloudinary(avatar, { folder: "eventform/avatars" });
        if (url) avatar = url;
      }
      await db.execute({ sql: "UPDATE users SET avatar = ? WHERE id = ?", args: [avatar, req.user.sub] });
    }
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user.sub] });
    res.json({ user: rowToUser(rows[0]) });
  } catch (e) { serverError(res, e); }
});

app.post("/api/auth/change-password", requireDb, authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Campos requeridos" });
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword))
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres y una mayúscula" });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user.sub] });
    const row = rows[0];
    if (!row || !(await verifyPassword(currentPassword, row.password_hash)))
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    const hash = await hashPassword(newPassword);
    await db.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [hash, req.user.sub] });
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

app.delete("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Un solo batch atómico: o se borra todo o nada (antes era un DELETE por
    // evento, en serie, y un fallo a mitad dejaba la cuenta a medio borrar).
    await db.batch([
      { sql: "DELETE FROM registrations WHERE event_id IN (SELECT id FROM events WHERE host_id = ?)", args: [userId] },
      { sql: "DELETE FROM events WHERE host_id = ?", args: [userId] },
      { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
    ], "write");
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Legacy email link verification
app.get("/api/auth/verify-email/:token", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE verify_token = ?", args: [req.params.token] });
    if (!rows[0]) return res.status(400).json({ error: "Enlace inválido" });
    await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?", args: [rows[0].id] });
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [rows[0].id] });
    const u = rowToUser(updated[0]);
    res.json({ token: signToken(u), user: u });
  } catch (e) { serverError(res, e); }
});

// ─── Público ───────────────────────────────────────────────────────────────
app.get("/api/public/events/:slug", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!rows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = parseEvent(rows[0]);
    // Liberar reservas caducadas es una ESCRITURA y esto es una ruta de lectura
    // que se llama en cada visita. Solo tiene sentido si el evento cobra y hay
    // pasarela activa; si no, son dos viajes de red por visita para nada.
    if (paymentsEnabled && ev.isPaid && Number(ev.price) > 0) await releaseExpiredHolds(ev.id);

    // Aforo, reventa, organizador y caras de quienes van, en UN solo viaje.
    const [ocupRes, resaleRes, hostRes, carasRes] = await db.batch([
      { sql: `SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND cancelled = 0 AND resale_status != 'listed'`, args: [ev.id] },
      { sql: `SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND resale_status = 'listed' AND cancelled = 0`, args: [ev.id] },
      { sql: "SELECT name, email, avatar FROM users WHERE id = ?", args: [ev.hostId] },
      // Mismas cuatro caras que en Descubrir (ver parseAttendeePreview).
      { sql: `SELECT json_group_array(json_object('n', nm, 'i', ini, 'a', av)) AS caras FROM (
                SELECT CASE WHEN u2.name IS NOT NULL AND u2.name != '' THEN u2.name END AS nm,
                       upper(substr(COALESCE(NULLIF(u2.name, ''), t.email, '?'), 1, 1)) AS ini,
                       CASE WHEN u2.avatar LIKE 'http%' THEN u2.avatar END AS av,
                       t.created_at AS created_at
                  FROM (SELECT r2.email AS email, r2.created_at AS created_at
                          FROM registrations r2
                         WHERE r2.event_id = ? AND r2.cancelled = 0
                           AND r2.payment_status != 'pending'
                           AND r2.resale_status != 'listed'
                         ORDER BY r2.created_at ASC LIMIT 16) t
                  LEFT JOIN users u2 ON u2.email = t.email
                 ORDER BY (av IS NULL), (nm IS NULL), created_at ASC
                 LIMIT 4)`, args: [ev.id] },
    ], "read");
    ev.registrationCount = Number(ocupRes.rows[0]?.c || 0);
    ev.resaleAvailable = Number(resaleRes.rows[0]?.c || 0);
    ev.registrations = undefined;
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    const hostRows = hostRes.rows;
    ev.hostName = hostRows[0]?.name || "";
    ev.hostEmail = hostRows[0]?.email || "";
    // Solo se expone el avatar si es una URL (los base64 no viajan; ver Descubrir).
    const hostAv = hostRows[0]?.avatar;
    ev.hostAvatar = hostAv && String(hostAv).startsWith("http") ? hostAv : null;
    ev.attendeePreview = parseAttendeePreview(carasRes.rows[0]?.caras);
    // La página pública es lo que ve el asistente: tras una edición debe
    // reflejarse pronto, pero sin caché era 1 función + 4 consultas por visita.
    setCache(res, { cdn: 15, swr: 60 });
    res.json({ event: ev });
  } catch (e) { serverError(res, e); }
});

app.patch("/api/public/registrations/:ticketId/cancel", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT id, cancelled FROM registrations WHERE ticket_id = ?", args: [req.params.ticketId] });
    if (!rows[0]) return res.status(404).json({ error: "Registro no encontrado" });
    if (rows[0].cancelled) return res.json({ ok: true, already: true });
    await db.execute({ sql: "UPDATE registrations SET cancelled = 1 WHERE ticket_id = ?", args: [req.params.ticketId] });
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Información pública de una entrada por su ticket_id (para la página /t/:id).
app.get("/api/public/tickets/:ticketId", requireDb, async (req, res) => {
  try {
    const tid = String(req.params.ticketId || "").trim().toUpperCase();
    const { rows } = await db.execute({
      sql: `SELECT r.ticket_id, r.used, r.checked_in_at, r.cancelled, r.approved, e.slug, e.payload AS event_payload
            FROM registrations r JOIN events e ON e.id = r.event_id
            WHERE r.ticket_id = ?`,
      args: [tid],
    });
    if (!rows[0]) return res.status(404).json({ error: "Entrada no encontrada" });
    const row = rows[0];
    let ev = {};
    try { ev = JSON.parse(row.event_payload); } catch { ev = {}; }
    res.json({
      ticket: {
        id: row.ticket_id,
        used: Boolean(row.used),
        cancelled: Boolean(row.cancelled),
        approved: row.approved == null ? true : Boolean(row.approved),
        requireApproval: Boolean(ev.requireApproval),
        checkedInAt: row.checked_in_at,
        event: {
          slug: row.slug,
          title: ev.title || "Evento",
          startDate: ev.startDate || "",
          date: ev.date || "",
          startTime: ev.startTime || "",
          headerImage: ev.headerImage || "",
          imagePos: ev.imagePos || null,
          imageZoom: ev.imageZoom || null,
          city: ev.city || "",
          location: ev.location || "",
          // Personalización: la entrada se ve con la letra y el color del
          // evento, igual que su página.
          fontId: ev.fontId || null,
          themeColor: ev.themeColor || null,
        },
      },
    });
  } catch (e) { serverError(res, e); }
});

// La capacidad máxima ahora vive en ./capacity.js (la comparten las rutas y la
// recuperación de reservas caducadas en pagos).

app.post("/api/public/events/:slug/register", requireDb, optionalAuth, async (req, res) => {
  try {
    const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!evRows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = parseEvent(evRows[0]);
    if (ev.manualSoldOut) return res.status(403).json({ error: "sold_out" });
    // Los eventos de pago van por /orders: aquí se emitiría el QR sin cobrar.
    // Solo se bloquea si hay pasarela activa: mientras no la haya, el precio es
    // informativo y la inscripción sigue funcionando como hasta ahora (si no,
    // este cambio dejaría inservibles los eventos con precio ya publicados).
    if (paymentsEnabled && ev.isPaid && Number(ev.price) > 0) {
      return res.status(400).json({ error: "payment_required", message: "Este evento requiere pago. Usa el checkout." });
    }
    const { form, consentPrivacy, consentMarketing } = req.body || {};
    if (!consentPrivacy) return res.status(400).json({ error: "Debes aceptar la política de privacidad" });

    // Eventos con aprobación: el estado del QR vive en la cuenta del asistente
    // (es donde ve cuándo pasa de pendiente a activo), así que exige sesión.
    const needsApproval = Boolean(ev.requireApproval);
    if (needsApproval && !req.user) {
      return res.status(401).json({ error: "account_required" });
    }

    const max = capacityMaxOf(ev);
    const now = Date.now();

    // Entradas por persona. El anfitrión fija el tope (`maxPerUser`, 1 por
    // defecto) y el asistente pide cuántas quiere dentro de ese tope.
    const maxPerUser = Math.max(1, Math.min(Number(ev.maxPerUser) || 1, 20));
    const wanted = Math.floor(Number(req.body?.quantity) || 1);
    if (!Number.isFinite(wanted) || wanted < 1) {
      return res.status(400).json({ error: "Cantidad de entradas inválida." });
    }
    if (wanted > maxPerUser) {
      return res.status(403).json({ error: "limit_per_user", maxPerUser });
    }

    // Email del asistente (campo tipo email o primer valor con forma de correo)
    let recipientEmail = null, recipientName = null;
    if (form) {
      const emailField = (ev.fields || []).find(f => f.type === "email");
      recipientEmail = emailField ? form[emailField.id] : null;
      if (!recipientEmail) recipientEmail = Object.values(form).find((v) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || null;
      const nameField = (ev.fields || []).find(f => f.type === "text" && /nombre/i.test(f.label));
      recipientName = nameField ? form[nameField.id] : null;
    }
    // Con aprobación la entrada queda atada al correo de la cuenta, no al que
    // se escriba en el formulario: es ese cruce el que hace que "Mis tickets"
    // muestre el cambio de estado en cualquier dispositivo.
    const accountEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : null;
    const emailNorm = needsApproval
      ? accountEmail
      : (recipientEmail ? String(recipientEmail).trim().toLowerCase() : null);
    if (needsApproval && !recipientEmail) recipientEmail = accountEmail;

    const approved = needsApproval ? 0 : 1;
    const insertSql = `INSERT INTO registrations (id, event_id, ticket_id, payload, used, checked_in_at, consent_privacy, consent_marketing, created_at, email, approved) VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)`;
    // Una fila (y un QR) por entrada pedida.
    const ticketIds = Array.from({ length: wanted }, () => "TICKET-" + uid());
    const ticketId = ticketIds[0];
    const inserts = ticketIds.map((tid) => ({
      sql: insertSql,
      args: ["R" + uid(), ev.id, tid, JSON.stringify(form), consentPrivacy ? 1 : 0, consentMarketing ? 1 : 0, now, emailNorm, approved],
    }));
    // Las entradas en reventa no ocupan cupo (su asiento se está ofreciendo) y
    // las reservas de pago caducadas se liberan antes de contar.
    await releaseExpiredHolds(ev.id);
    const countSql = "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND cancelled = 0 AND resale_status != 'listed'";
    // Tope por persona: se cuenta por el correo con el que quedan atadas las
    // entradas, que es el mismo cruce que usa "Mis tickets".
    const mineSql = "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND cancelled = 0 AND lower(email) = ? AND resale_status != 'listed'";

    // Chequeo de cupo + inserción ATÓMICOS (evita sobreventa en simultáneo).
    let useFallback = false;
    let tx = null;
    try {
      tx = await db.transaction("write");
    } catch { useFallback = true; }

    if (tx) {
      try {
        if (max != null) {
          const { rows: cntRows } = await tx.execute({ sql: countSql, args: [ev.id] });
          // Se comprueba el lote entero: pedir 3 con 2 cupos libres no puede
          // dejar la mitad dentro.
          if (Number(cntRows[0]?.c || 0) + wanted > max) { await tx.rollback(); return res.status(403).json({ error: "sold_out" }); }
        }
        if (emailNorm && maxPerUser > 1) {
          const { rows: mineRows } = await tx.execute({ sql: mineSql, args: [ev.id, emailNorm] });
          const mine = Number(mineRows[0]?.c || 0);
          if (mine + wanted > maxPerUser) {
            await tx.rollback();
            return res.status(403).json({ error: "limit_per_user", maxPerUser, already: mine });
          }
        }
        for (const ins of inserts) await tx.execute(ins);
        await tx.commit();
      } catch (txErr) {
        try { await tx.rollback(); } catch { /* noop */ }
        // Si el driver no soporta transacciones interactivas, cae al modo simple.
        if (/transaction|not supported|unsupported/i.test(txErr?.message || "")) useFallback = true;
        else throw txErr;
      }
    }

    if (useFallback) {
      if (max != null) {
        const { rows: cntRows } = await db.execute({ sql: countSql, args: [ev.id] });
        if (Number(cntRows[0]?.c || 0) + wanted > max) return res.status(403).json({ error: "sold_out" });
      }
      if (emailNorm && maxPerUser > 1) {
        const { rows: mineRows } = await db.execute({ sql: mineSql, args: [ev.id, emailNorm] });
        const mine = Number(mineRows[0]?.c || 0);
        if (mine + wanted > maxPerUser) return res.status(403).json({ error: "limit_per_user", maxPerUser, already: mine });
      }
      for (const ins of inserts) await db.execute(ins);
    }

    // Recordar los datos personales de esta inscripción para la próxima (teléfono,
    // ciudad…). Solo si quien se inscribe es el dueño de la cuenta: con un
    // correo distinto está apuntando a otra persona y sus datos no son suyos.
    if (req.user?.sub && form) {
      const propio = !recipientEmail || String(recipientEmail).trim().toLowerCase() === accountEmail;
      if (propio) {
        try { await mergeProfile(req.user.sub, extractProfile(ev.fields || [], form)); }
        catch (e) { console.error("[perfil] no se pudo guardar:", e.message); }
      }
    }

    // Correo de confirmación. AWAIT antes de responder: en Vercel serverless la
    // función se congela tras res.json() y un envío fire-and-forget se cancela.
    if (emailEnabled && recipientEmail) {
      try {
        // Pendiente de aprobación → aviso sin QR; el correo con la entrada sale
        // al aprobar. Si no requiere aprobación, va una entrada por cada QR.
        // Un solo correo con todos los QR, no uno por entrada.
        if (needsApproval) await sendApprovalPending(recipientEmail, recipientName, ev);
        else await sendRegistrationConfirmation(recipientEmail, recipientName, ticketIds, ev);
      }
      catch (mailErr) { console.error("Error enviando correo de inscripción:", mailErr?.message); }
    }
    const registrations = ticketIds.map((tid) => ({
      id: tid, eventId: ev.id, data: form, ts: now, used: false, approved: !needsApproval,
    }));
    res.status(201).json({
      // `registration` (singular) se mantiene por compatibilidad: es la primera.
      registration: registrations[0],
      registrations,
      event: { id: ev.id, title: ev.title, slug: ev.slug },
    });
  } catch (e) { serverError(res, e); }
});

// ─── Pagos ─────────────────────────────────────────────────────────────────

// Desglose de una compra ANTES de pagar: el comprador ve el precio, el cargo
// por servicio y el total antes de decidir.
app.get("/api/public/events/:slug/quote", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!rows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = parseEvent(rows[0]);
    const qty = Math.max(1, Math.floor(Number(req.query.quantity) || 1));
    if (!ev.isPaid || !(Number(ev.price) > 0)) {
      return res.json({ free: true, quantity: qty, subtotal: 0, serviceFee: 0, total: 0 });
    }
    const q = computeOrder({ unitPrice: Number(ev.price), quantity: qty });
    // El comprador no tiene por qué ver el reparto interno.
    res.json({ free: false, quantity: q.quantity, unitPrice: q.unitPrice, subtotal: q.subtotal, serviceFee: q.serviceFee, total: q.total, currency: "COP" });
  } catch (e) { serverError(res, e); }
});

// Inicia el cobro: reserva los cupos y devuelve la URL del checkout.
app.post("/api/public/events/:slug/orders", requireDb, optionalAuth, async (req, res) => {
  try {
    if (!paymentsEnabled) return res.status(503).json({ error: "payments_disabled", message: "Los pagos no están habilitados todavía." });
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!rows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = parseEvent(rows[0]);
    if (ev.manualSoldOut) return res.status(403).json({ error: "sold_out" });

    const { form, quantity, consentPrivacy, consentMarketing } = req.body || {};
    if (!consentPrivacy) return res.status(400).json({ error: "Debes aceptar la política de privacidad" });
    if (ev.requireApproval && !req.user) return res.status(401).json({ error: "account_required" });

    // Correo del comprador: el de la cuenta manda, y si no, el del formulario.
    let email = req.user?.email || null;
    if (!email && form) {
      const campo = (ev.fields || []).find(f => f.type === "email");
      email = (campo ? form[campo.id] : null)
        || Object.values(form).find(v => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        || null;
    }
    if (!email) return res.status(400).json({ error: "Necesitamos un correo para enviarte las entradas." });

    const orden = await createOrder({
      event: ev,
      form, quantity, consentPrivacy, consentMarketing,
      buyerEmail: String(email).trim().toLowerCase(),
      buyerUserId: req.user?.sub || null,
      capacityMax: capacityMaxOf(ev),
      maxPerUser: Math.max(1, Math.min(Number(ev.maxPerUser) || 1, 20)),
      urls: { returnUrl: `${APP_URL}/pago/${"{ORDER}"}` },
    });

    res.status(201).json({
      orderId: orden.orderId,
      checkoutUrl: orden.checkoutUrl,
      reservedUntil: orden.reservedUntil,
      subtotal: orden.subtotal, serviceFee: orden.serviceFee, total: orden.total,
    });
  } catch (e) {
    if (e instanceof PaymentError) return res.status(e.status).json({ error: e.code, message: e.message, ...(e.raw || {}) });
    console.error("[POST /orders]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Estado de la orden — lo consulta la pantalla de resultado (PSE puede tardar).
app.get("/api/public/orders/:id", requireDb, async (req, res) => {
  try {
    const o = await getOrder(req.params.id);
    if (!o) return res.status(404).json({ error: "Orden no encontrada" });
    const { rows } = await db.execute({
      sql: "SELECT ticket_id, approved FROM registrations WHERE order_id = ? AND cancelled = 0 ORDER BY created_at",
      args: [o.id],
    });
    const { rows: evRows } = await db.execute({ sql: "SELECT slug FROM events WHERE id = ?", args: [o.event_id] });
    res.set("Cache-Control", "no-store");
    res.json({
      order: {
        id: o.id, status: o.status, total: o.total, subtotal: o.subtotal, serviceFee: o.service_fee,
        quantity: o.quantity, reservedUntil: o.reserved_until, checkoutUrl: o.checkout_url,
        eventSlug: evRows[0]?.slug || null,
        tickets: o.status === PAYMENT_STATUS.APPROVED
          ? rows.map(r => ({ id: r.ticket_id, approved: r.approved == null ? true : Boolean(r.approved), used: false }))
          : [],
      },
    });
  } catch (e) { serverError(res, e); }
});

// Webhook de la pasarela. Es la ÚNICA vía por la que una entrada pasa a válida:
// nunca se confía en la redirección del navegador, que el comprador puede
// falsificar o no completar.
app.post("/api/payments/webhook/:provider", requireDb, async (req, res) => {
  try {
    const provider = getPaymentProvider();
    if (req.params.provider !== provider.name) return res.status(404).json({ error: "Pasarela desconocida" });

    if (!provider.verifyWebhook({ headers: req.headers, rawBody: req.rawBody })) {
      console.warn("[webhook] firma inválida");
      return res.status(401).json({ error: "firma inválida" });
    }

    const evt = provider.parseWebhook({ headers: req.headers, body: req.body });
    const order = evt.orderId ? await getOrder(evt.orderId) : await getOrderByRef(evt.providerRef);
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });

    // Idempotencia: la pasarela reintenta hasta recibir 200.
    const clave = `${provider.name}:${evt.providerRef}:${evt.status}`;
    const primeraVez = await markWebhookSeen({ eventKey: clave, orderId: order.id, provider: provider.name, status: evt.status });
    if (!primeraVez) return res.json({ ok: true, duplicated: true });

    if (evt.status === PAYMENT_STATUS.APPROVED) {
      const r = await approveOrder(order.id);
      // Un solo correo con todas las entradas de la compra.
      if (r && !r.yaEstaba && emailEnabled && order.buyer_email) {
        const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [order.event_id] });
        const ev = parseEvent(evRows[0]);
        try {
          if (ev.requireApproval) await sendApprovalPending(order.buyer_email, null, ev);
          else await sendRegistrationConfirmation(order.buyer_email, null, r.ticketIds, ev);
        } catch (mailErr) { console.error("Error enviando entradas:", mailErr?.message); }
      }
      if (r?.resold?.length) console.log(`[reventa] ${r.resold.length} entrada(s) recompradas y devueltas`);
    } else if (evt.status === PAYMENT_STATUS.DECLINED) {
      await cancelOrder(order.id, PAYMENT_STATUS.DECLINED);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[webhook]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Reventa ───────────────────────────────────────────────────────────────

app.post("/api/public/tickets/:ticketId/resale", requireDb, optionalAuth, async (req, res) => {
  try {
    const r = req.body?.listed === false
      ? await unlistResale(req.params.ticketId, { email: req.user?.email })
      : await listForResale(req.params.ticketId, { email: req.user?.email });
    res.json(r);
  } catch (e) {
    if (e instanceof PaymentError) return res.status(e.status).json({ error: e.code, message: e.message });
    res.status(500).json({ error: e.message });
  }
});

/**
 * Sube la portada a Cloudinary si viene incrustada en base64.
 *
 * Hasta ahora solo se hacía con el avatar, así que TODA portada quedaba
 * guardada como `data:image/...` dentro del payload JSON del evento y viajaba
 * entera en cada respuesta: se midieron 2,65 MB en el listado público y es lo
 * que hacía lentas "Mis eventos", "Mis tickets" y la verificación de entradas.
 * Si Cloudinary no está configurado o la subida falla, se conserva el base64
 * antes que perder la imagen del usuario.
 */
async function normalizeCover(payload) {
  if (!payload || !isDataUrl(payload.headerImage)) return payload;
  try {
    const url = await uploadToCloudinary(payload.headerImage, { folder: "eventform/covers" });
    if (url) return { ...payload, headerImage: url };
  } catch (e) {
    console.error("[portada] no se pudo subir a Cloudinary:", e.message);
  }
  return payload;
}

// ─── Eventos (anfitrión) ───────────────────────────────────────────────────
app.get("/api/events", requireDb, authMiddleware, async (req, res) => {
  try {
    // La portada en base64 se recorta EN SQL, no al llegar. Con `SELECT *` el
    // resultado arrastraba cientos de KB por evento y Turso llegó a responder
    // "SQLITE_NOMEM: out of memory": la lista no cargaba en absoluto. Aquí se
    // sustituye por una marca y el cliente pinta el degradado; la imagen se
    // recupera en cuanto se migre a Cloudinary.
    const COLS = `id, host_id, slug, manual_sold_out, visibility, category, is_paid, price, created_at, updated_at,
      CASE WHEN json_extract(payload,'$.headerImage') LIKE 'data:%'
           THEN json_set(payload,'$.headerImage','') ELSE payload END AS payload,
      CASE WHEN json_extract(payload,'$.headerImage') LIKE 'data:%' THEN 1 ELSE 0 END AS cover_heavy`;
    const sql = req.user.role === "super_admin"
      ? { sql: `SELECT ${COLS} FROM events ORDER BY updated_at DESC`, args: [] }
      : { sql: `SELECT ${COLS} FROM events WHERE host_id = ? ORDER BY updated_at DESC`, args: [req.user.sub] };
    const { rows } = await db.execute(sql);
    const events = rows.map((r) => {
      const ev = parseEvent(r);
      ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
      ev.coverNeedsMigration = Boolean(r.cover_heavy);
      ev.registrations = [];
      return ev;
    });

    // Curación automática, de UNA en una. Migrar todas a la vez fue justo lo
    // que agotó la memoria: cada portada se lee entera para subirla. Así, cada
    // visita a "Mis eventos" arregla un evento y en pocas cargas no queda
    // ninguno pesado, sin picos de memoria.
    const pendiente = events.find((e) => e.coverNeedsMigration);
    if (pendiente && cloudinaryEnabled) {
      try {
        const { rows: full } = await db.execute({
          sql: "SELECT payload FROM events WHERE id = ?", args: [pendiente.id],
        });
        const data = JSON.parse(full[0].payload);
        if (isDataUrl(data.headerImage)) {
          const url = await uploadToCloudinary(data.headerImage, { folder: "eventform/covers" });
          if (url) {
            data.headerImage = url;
            await db.execute({ sql: "UPDATE events SET payload = ? WHERE id = ?", args: [JSON.stringify(data), pendiente.id] });
            pendiente.headerImage = url;
            pendiente.coverNeedsMigration = false;
          }
        }
      } catch (e) { console.error("[portada] migración perezosa falló:", e.message); }
    }

    // Inscripciones en UNA sola consulta agrupada (evita N+1). Se conservan
    // completas para no perder trazabilidad en CRM/Detalle/Dashboard.
    if (events.length) {
      const ids = events.map((e) => e.id);
      const placeholders = ids.map(() => "?").join(",");
      const { rows: regRows } = await db.execute({
        sql: `SELECT * FROM registrations WHERE cancelled = 0 AND payment_status != 'pending'
              AND event_id IN (${placeholders}) ORDER BY created_at DESC`,
        args: ids,
      });
      const byEvent = new Map(events.map((e) => [e.id, e]));
      for (const r of regRows) {
        const ev = byEvent.get(r.event_id);
        if (!ev) continue;
        ev.registrations.push({
          id: r.ticket_id, eventId: r.event_id, data: JSON.parse(r.payload),
          ts: r.created_at, used: Boolean(r.used), checkedInAt: r.checked_in_at,
          consentPrivacy: Boolean(r.consent_privacy), consentMarketing: Boolean(r.consent_marketing),
          approved: r.approved == null ? true : Boolean(r.approved),
          email: r.email || null,
        });
      }
    }
    res.json({ events });
  } catch (e) { serverError(res, e); }
});

app.post("/api/events", requireDb, authMiddleware, requireRole("host", "super_admin"), async (req, res) => {
  try {
    const payload = await normalizeCover(req.body);
    
    // Validar payload
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Datos inválidos. Envía un objeto de evento." });
    }
    if (!payload.title || !String(payload.title).trim()) {
      return res.status(400).json({ error: "El evento debe tener un título." });
    }
    // El selector ya no ofrece horas pasadas, pero el cliente se puede saltar
    // (borrador guardado de ayer, petición manual, reloj desajustado).
    if (startIsPast(payload)) {
      return res.status(400).json({ error: "start_in_past", message: "La fecha y hora de inicio ya pasaron. Elige un momento futuro." });
    }

    const id = payload.id || "E" + uid();
    // El cliente manda un slug derivado del título, así que dos eventos con el
    // mismo nombre chocaban contra el UNIQUE de `slug` y el INSERT reventaba con
    // un 500 ("Error al publicar"). Se pasa SIEMPRE por uniqueSlug, que añade
    // sufijo (-1, -2, …) si ya está tomado.
    const slug = await uniqueSlug(payload.slug || payload.title, id);
    const hostId = req.user.role === "super_admin" && payload.hostId ? payload.hostId : req.user.sub;
    const now = Date.now();
    // Las inscripciones viven en su tabla; copiarlas al payload solo lo engorda.
    const data = { ...payload, id, slug };
    delete data.registrations;
    
    // Ejecutar INSERT
    await db.execute({
      sql: `INSERT INTO events (id, host_id, slug, payload, manual_sold_out, visibility, category, is_paid, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, hostId, slug, JSON.stringify(data), payload.manualSoldOut ? 1 : 0, payload.visibility || "public", payload.category || null, payload.isPaid ? 1 : 0, payload.isPaid && payload.price ? Number(payload.price) : null, now, now],
    });
    
    // Recuperar el evento creado
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [id] });
    if (!rows[0]) {
      return res.status(500).json({ error: "El evento se creó pero no se pudo recuperar. Por favor, recarga la página." });
    }
    
    const ev = await attachRegs(parseEvent(rows[0]));
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    res.status(201).json({ event: ev });
  } catch (e) { 
    console.error("[POST /api/events] Error:", e.message);
    res.status(500).json({ error: e.message || "Error al crear el evento. Intenta de nuevo." }); 
  }
});

app.put("/api/events/:id", requireDb, authMiddleware, async (req, res) => {
  try {
    const eventId = req.params.id?.trim();
    if (!eventId) {
      return res.status(400).json({ error: "ID de evento inválido." });
    }

    const { rows: existing } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [eventId] });
    const row = existing[0];
    if (!row) return res.status(404).json({ error: "Evento no encontrado" });
    if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso para editar este evento" });
    
    const payload = await normalizeCover(req.body);
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Datos inválidos." });
    }

    const anterior = JSON.parse(row.payload || "{}");
    const cambiaInicio = (payload.startDate && payload.startDate !== anterior.startDate)
      || (payload.startTime && payload.startTime !== anterior.startTime);
    if (cambiaInicio && startIsPast({ ...anterior, ...payload })) {
      return res.status(400).json({ error: "start_in_past", message: "La fecha y hora de inicio ya pasaron. Elige un momento futuro." });
    }

    // Mismo motivo que en el POST: si el slug pedido ya lo usa OTRO evento, se
    // le añade sufijo en vez de dejar que falle el UNIQUE al guardar.
    const slug = payload.slug && payload.slug !== row.slug
      ? await uniqueSlug(payload.slug, row.id)
      : row.slug;
    // Antes se copiaban TODAS las inscripciones (con correos y respuestas) al
    // payload del evento en cada edición: duplicaba datos personales y hacía
    // crecer el payload que se lee en cada visita. Viven solo en su tabla.
    const data = { ...JSON.parse(row.payload), ...payload, id: row.id, slug };
    delete data.registrations;
    
    await db.execute({
      sql: `UPDATE events SET slug = ?, payload = ?, manual_sold_out = ?, visibility = ?, category = ?, is_paid = ?, price = ?, updated_at = ? WHERE id = ?`,
      args: [slug, JSON.stringify(data), payload.manualSoldOut ? 1 : 0, payload.visibility || "public", payload.category || null, payload.isPaid ? 1 : 0, payload.isPaid && payload.price ? Number(payload.price) : null, Date.now(), row.id],
    });
    
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [row.id] });
    const ev = await attachRegs(parseEvent(rows[0]));
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    res.json({ event: ev });
  } catch (e) { 
    console.error("[PUT /api/events/:id] Error:", e.message);
    res.status(500).json({ error: e.message || "Error al actualizar el evento." }); 
  }
});

app.patch("/api/events/:id/sold-out", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    const row = existing[0];
    if (!row) return res.status(404).json({ error: "No encontrado" });
    if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });
    const v = req.body.manualSoldOut ? 1 : 0;
    await db.execute({ sql: "UPDATE events SET manual_sold_out = ?, updated_at = ? WHERE id = ?", args: [v, Date.now(), req.params.id] });
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    const ev = await attachRegs(parseEvent(rows[0]));
    ev.manualSoldOut = Boolean(v);
    res.json({ event: ev });
  } catch (e) { serverError(res, e); }
});

app.delete("/api/events/:id", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    const row = existing[0];
    if (!row) return res.status(404).json({ error: "No encontrado" });
    if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });
    // SQLite no aplica el ON DELETE CASCADE sin `PRAGMA foreign_keys`, así que
    // las inscripciones quedaban huérfanas. Se borran en el mismo batch.
    await db.batch([
      { sql: "DELETE FROM registrations WHERE event_id = ?", args: [req.params.id] },
      { sql: "DELETE FROM events WHERE id = ?", args: [req.params.id] },
    ], "write");
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

app.post("/api/events/:id/check-in", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    if (!evRows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    if (req.user.role !== "super_admin" && evRows[0].host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });
    const { ticketId } = req.body || {};
    const { rows: regRows } = await db.execute({ sql: "SELECT * FROM registrations WHERE ticket_id = ? AND event_id = ?", args: [ticketId?.trim().toUpperCase(), req.params.id] });
    const regRow = regRows[0];
    if (!regRow) return res.json({ status: "nf" });
    if (regRow.cancelled) return res.json({ status: "cancelled" });
    // Sin pagar (checkout abandonado o devuelta) → no da acceso.
    if (regRow.payment_status && regRow.payment_status !== REG_PAYMENT.NOT_REQUIRED && regRow.payment_status !== REG_PAYMENT.PAID) {
      return res.json({ status: "unpaid", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload) } });
    }
    // Pendiente de aprobación → el QR no da acceso todavía.
    if (regRow.approved != null && !regRow.approved) {
      return res.json({ status: "pending", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload) } });
    }
    if (regRow.used) return res.json({ status: "used", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload), checkedInAt: regRow.checked_in_at } });
    const checkedInAt = Date.now();
    await db.execute({ sql: "UPDATE registrations SET used = 1, checked_in_at = ? WHERE id = ?", args: [checkedInAt, regRow.id] });
    res.json({ status: "ok", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload), checkedInAt } });
  } catch (e) { serverError(res, e); }
});

// Aprobar / revocar VARIAS inscripciones de una vez (normalmente todas las de
// una misma persona). Manda UN solo correo con todas las entradas aprobadas,
// en vez de uno por entrada.
app.patch("/api/events/:id/registrations/approval", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    if (!evRows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    if (req.user.role !== "super_admin" && evRows[0].host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });

    const ids = (Array.isArray(req.body?.ticketIds) ? req.body.ticketIds : [])
      .map(t => String(t || "").trim().toUpperCase()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: "Sin entradas que actualizar" });
    const approved = req.body?.approved === false ? 0 : 1;

    const placeholders = ids.map(() => "?").join(",");
    const { rows: regs } = await db.execute({
      sql: `SELECT * FROM registrations WHERE event_id = ? AND ticket_id IN (${placeholders})`,
      args: [req.params.id, ...ids],
    });
    if (!regs.length) return res.status(404).json({ error: "Inscripciones no encontradas" });

    // Solo las que cambian de verdad disparan correo.
    const nuevas = regs.filter(r => (r.approved == null ? true : Boolean(r.approved)) !== Boolean(approved));
    await db.execute({
      sql: `UPDATE registrations SET approved = ? WHERE event_id = ? AND ticket_id IN (${placeholders})`,
      args: [approved, req.params.id, ...ids],
    });

    if (approved && nuevas.length && emailEnabled) {
      const ev = parseEvent(evRows[0]);
      // Se agrupa por destinatario: cada persona recibe un único correo con
      // todas sus entradas, aunque el lote traiga varias personas.
      const porCorreo = new Map();
      for (const r of nuevas) {
        let data = {};
        try { data = JSON.parse(r.payload); } catch { /* payload ilegible */ }
        const nameField = (ev.fields || []).find(f => f.type === "text" && /nombre/i.test(f.label));
        const to = r.email
          || Object.values(data).find(v => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        if (!to) continue;
        if (!porCorreo.has(to)) porCorreo.set(to, { nombre: nameField ? data[nameField.id] : null, ids: [] });
        porCorreo.get(to).ids.push(r.ticket_id);
      }
      for (const [to, { nombre, ids: tids }] of porCorreo) {
        try { await sendRegistrationConfirmation(to, nombre, tids, ev); }
        catch (mailErr) { console.error("Error enviando entradas aprobadas:", mailErr?.message); }
      }
    }
    res.json({ ok: true, updated: ids.length, changed: nuevas.length, approved: Boolean(approved) });
  } catch (e) { serverError(res, e); }
});

// Aprobar / revocar una inscripción de un evento con "Requerir aprobación".
// Al aprobar, el QR de esa entrada queda activo de inmediato (el asistente lo
// ve en "Mis tickets") y se le envía la entrada por correo.
app.patch("/api/events/:id/registrations/:ticketId/approval", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    if (!evRows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    if (req.user.role !== "super_admin" && evRows[0].host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });

    const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
    const { rows: regRows } = await db.execute({
      sql: "SELECT * FROM registrations WHERE ticket_id = ? AND event_id = ?",
      args: [ticketId, req.params.id],
    });
    const regRow = regRows[0];
    if (!regRow) return res.status(404).json({ error: "Inscripción no encontrada" });

    const approved = req.body?.approved === false ? 0 : 1;
    const wasApproved = regRow.approved == null ? true : Boolean(regRow.approved);
    await db.execute({ sql: "UPDATE registrations SET approved = ? WHERE id = ?", args: [approved, regRow.id] });

    // Solo al pasar de pendiente a aprobado se manda la entrada con el QR.
    if (approved && !wasApproved && emailEnabled) {
      const ev = parseEvent(evRows[0]);
      let data = {};
      try { data = JSON.parse(regRow.payload); } catch { /* payload ilegible */ }
      const nameField = (ev.fields || []).find(f => f.type === "text" && /nombre/i.test(f.label));
      const name = nameField ? data[nameField.id] : null;
      const to = regRow.email
        || Object.values(data).find(v => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      if (to) {
        try { await sendRegistrationConfirmation(to, name, regRow.ticket_id, ev); }
        catch (mailErr) { console.error("Error enviando entrada aprobada:", mailErr?.message); }
      }
    }
    res.json({ ok: true, ticketId, approved: Boolean(approved) });
  } catch (e) { serverError(res, e); }
});

app.get("/api/admin/overview", requireDb, authMiddleware, requireRole("super_admin"), async (req, res) => {
  try {
    const { rows: users } = await db.execute({ sql: "SELECT COUNT(*) as c FROM users", args: [] });
    const { rows: events } = await db.execute({ sql: "SELECT COUNT(*) as c FROM events", args: [] });
    const { rows: regs } = await db.execute({ sql: "SELECT COUNT(*) as c FROM registrations", args: [] });
    const { rows: latestUsers } = await db.execute({ sql: "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 10", args: [] });
    const { rows: latestEvents } = await db.execute({ sql: "SELECT id, slug, host_id, created_at FROM events ORDER BY created_at DESC LIMIT 10", args: [] });
    res.json({
      totals: { users: Number(users[0]?.c || 0), events: Number(events[0]?.c || 0), registrations: Number(regs[0]?.c || 0) },
      latestUsers: latestUsers.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at })),
      latestEvents: latestEvents.map(e => ({ id: e.id, slug: e.slug, hostId: e.host_id, createdAt: e.created_at })),
    });
  } catch (e) { serverError(res, e); }
});

// Migra los avatares antiguos en base64 a URLs de Cloudinary. Se ejecuta en el
// servidor (que ya tiene las credenciales), así el admin no necesita terminal.
// Sube a Cloudinary las portadas que quedaron guardadas en base64.
app.post("/api/admin/migrate-event-images", requireDb, authMiddleware, requireOwner, async (req, res) => {
  try {
    const resultado = await migrateBase64EventImages({ apply: req.body?.apply !== false });
    if (resultado.error) return res.status(400).json(resultado);
    res.json(resultado);
  } catch (e) { serverError(res, e); }
});

app.post("/api/admin/migrate-avatars", requireDb, authMiddleware, requireOwner, async (req, res) => {
  try {
    const result = await migrateBase64Avatars({ apply: true });
    if (result.error === "cloudinary_no_config") {
      return res.status(400).json({ error: "Cloudinary no está configurado en el servidor (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET)." });
    }
    res.json(result);
  } catch (e) { serverError(res, e); }
});

// ─── Discover (público) ────────────────────────────────────────────────────
app.get("/api/public/events", requireDb, async (req, res) => {
  try {
    const { q, category, city, sort } = req.query;
    // Acotados: un `limit=100000` obligaba a leer y serializar toda la tabla.
    const limit = Math.min(Math.max(Math.floor(Number(req.query.limit) || 12), 1), 48);
    const page = Math.max(Math.floor(Number(req.query.page) || 1), 1);
    const offset = (page - 1) * limit;
    const today = new Date().toISOString().split("T")[0];

    const conditions = [
      "visibility = 'public'",
      `(json_extract(payload, '$.endDate') >= ?
        OR (json_extract(payload, '$.endDate') IS NULL AND json_extract(payload, '$.startDate') >= ?)
        OR (json_extract(payload, '$.endDate') = '' AND json_extract(payload, '$.startDate') >= ?))`,
    ];
    const args = [today, today, today];

    if (category) {
      // Los eventos sin categoría cuentan como "otro" por defecto.
      if (category === "otro") {
        conditions.push("(category = 'otro' OR category IS NULL OR category = '')");
      } else {
        conditions.push("category = ?"); args.push(category);
      }
    }
    if (city) { conditions.push("json_extract(payload, '$.city') = ?"); args.push(city); }
    if (q) {
      conditions.push("(json_extract(payload, '$.title') LIKE ? OR json_extract(payload, '$.city') LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }

    const where = "WHERE " + conditions.join(" AND ");

    // El conteo y el listado van en UN batch: con Turso cada execute es un
    // viaje de red y hacerlos en serie duplicaba la latencia de Descubrir.

    // Proyección esbelta: solo los campos que pinta la tarjeta del listado, en
    // vez de `events.*` (que arrastra el `payload` entero con decenas de campos
    // sin usar). El avatar del organizador se devuelve SOLO si es una URL: los
    // avatares en base64 pesan ~50 KB y, multiplicados por evento, hacían la
    // respuesta de varios MB; con base64 la tarjeta cae a la inicial. Se elimina
    // también la subconsulta de conteo de inscritos (el listado no la muestra).
    const [countRes, listRes] = await db.batch([
      { sql: `SELECT COUNT(*) as total FROM events ${where}`, args },
      {
      sql: `SELECT events.id, events.slug, events.category, events.is_paid, events.price,
                   json_extract(payload, '$.title')       AS title,
                   json_extract(payload, '$.city')        AS city,
                   -- El sitio concreto, no solo la ciudad: en el listado es lo
                   -- que de verdad ayuda a decidir si vas.
                   json_extract(payload, '$.location')    AS location,
                   json_extract(payload, '$.address')     AS address,
                   json_extract(payload, '$.isVirtual')   AS is_virtual,
                   json_extract(payload, '$.startDate')   AS start_date,
                   json_extract(payload, '$.startTime')   AS start_time,
                   json_extract(payload, '$.endDate')     AS end_date,
                   json_extract(payload, '$.endTime')     AS end_time,
                   -- Solo URLs: una portada guardada en base64 pesa cientos de
                   -- KB y viaja entera en cada carga del listado (se midieron
                   -- 2,65 MB para 5 eventos). Sin ella la tarjeta cae al
                   -- degradado, que es infinitamente mejor que 500 KB.
                   CASE WHEN json_extract(payload, '$.headerImage') LIKE 'http%'
                        THEN json_extract(payload, '$.headerImage') END AS header_image,
                   u.name AS host_name,
                   CASE WHEN u.avatar LIKE 'http%' THEN u.avatar END AS host_avatar,
                   -- Inscritos: hace falta para destacar lo que la gente ya
                   -- está llenando. Es una subconsulta por fila, pero solo por
                   -- las 24 de la página y va por el índice (event_id,cancelled).
                   (SELECT COUNT(*) FROM registrations r
                     WHERE r.event_id = events.id AND r.cancelled = 0
                       AND r.payment_status != 'pending') AS attendees,
                   -- Enlace al perfil del organizador desde la tarjeta.
                   events.host_id AS host_id,
                   -- Personalización del evento (color de la portada y tipografía):
                   -- dos campos cortos del payload, no la portada entera.
                   json_extract(payload, '$.themeColor') AS theme_color,
                   json_extract(payload, '$.fontId')     AS font_id,
                   -- Encuadre de la portada (posición y zoom elegidos al crear).
                   json_extract(payload, '$.imagePos.x') AS img_x,
                   json_extract(payload, '$.imagePos.y') AS img_y,
                   json_extract(payload, '$.imageZoom')  AS img_zoom,
                   -- Quiénes van: hasta CUATRO caras por evento. El LIMIT va en
                   -- la subconsulta interior a propósito — así el JOIN con users
                   -- se hace sobre 4 filas, no sobre las 900 inscripciones que
                   -- puede tener un evento grande. Del asistente sin cuenta solo
                   -- sale la inicial: su correo no viaja al cliente.
                   (SELECT json_group_array(json_object('n', nm, 'i', ini, 'a', av)) FROM (
                      SELECT CASE WHEN u2.name IS NOT NULL AND u2.name != '' THEN u2.name END AS nm,
                             upper(substr(COALESCE(NULLIF(u2.name, ''), t.email, '?'), 1, 1)) AS ini,
                             CASE WHEN u2.avatar LIKE 'http%' THEN u2.avatar END AS av,
                             t.created_at AS created_at
                        FROM (SELECT r2.email AS email, r2.created_at AS created_at
                                FROM registrations r2
                               WHERE r2.event_id = events.id AND r2.cancelled = 0
                                 AND r2.payment_status != 'pending'
                                 AND r2.resale_status != 'listed'
                               ORDER BY r2.created_at ASC LIMIT 16) t
                        LEFT JOIN users u2 ON u2.email = t.email
                       -- Primero quien tiene foto, luego quien tiene nombre y
                       -- por último por orden de inscripción: cuatro iniciales
                       -- grises no dicen nada, cuatro caras sí.
                       ORDER BY (av IS NULL), (nm IS NULL), created_at ASC
                       LIMIT 4)) AS attendee_preview
            FROM events
            LEFT JOIN users u ON u.id = events.host_id
            ${where}
            ORDER BY ${sort === "popular"
              ? "attendees DESC, COALESCE(json_extract(payload, '$.startDate'), '9999-99-99') ASC"
              : "COALESCE(json_extract(payload, '$.startDate'), '9999-99-99') ASC"}
            LIMIT ? OFFSET ?`,
        args: [...args, limit, offset],
      },
    ], "read");

    const total = Number(countRes.rows[0]?.total || 0);
    const events = listRes.rows.map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title || "Evento",
      city: r.city || "",
      location: r.location || "",
      address: r.address || "",
      isVirtual: Boolean(r.is_virtual),
      startDate: r.start_date || "",
      startTime: r.start_time || "",
      endDate: r.end_date || "",
      endTime: r.end_time || "",
      headerImage: r.header_image || "",
      category: r.category || null,
      isPaid: Boolean(r.is_paid),
      price: r.price != null ? Number(r.price) : null,
      hostName: r.host_name || "",
      hostAvatar: r.host_avatar || null,
      hostId: r.host_id || null,
      themeColor: r.theme_color || null,
      fontId: r.font_id || null,
      imagePos: r.img_x != null ? { x: Number(r.img_x), y: Number(r.img_y ?? 50) } : null,
      imageZoom: r.img_zoom != null ? Number(r.img_zoom) : null,
      attendees: Number(r.attendees || 0),
      attendeePreview: parseAttendeePreview(r.attendee_preview),
    }));

    // 30 s: suficiente para que una edición salga pronto en Descubrir y para
    // que el listado no golpee la base en cada visita.
    setCache(res, { cdn: 30, swr: 120 });
    res.json({ events, total, page, limit });
  } catch (e) { serverError(res, e); }
});

// Ciudades con eventos próximos, para poder agrupar por lugar en Descubrir.
app.get("/api/public/cities", requireDb, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { rows } = await db.execute({
      sql: `SELECT json_extract(payload, '$.city') AS city, COUNT(*) AS count FROM events
            WHERE visibility = 'public' AND json_extract(payload, '$.city') IS NOT NULL
              AND json_extract(payload, '$.city') != ''
              AND (json_extract(payload, '$.endDate') >= ?
                OR (json_extract(payload, '$.endDate') IS NULL AND json_extract(payload, '$.startDate') >= ?)
                OR (json_extract(payload, '$.endDate') = '' AND json_extract(payload, '$.startDate') >= ?))
            GROUP BY city ORDER BY count DESC, city ASC LIMIT 20`,
      args: [today, today, today],
    });
    setCache(res, { cdn: 120, swr: 300 });
    res.json({ cities: rows.map(r => ({ name: r.city, count: Number(r.count) })) });
  } catch (e) { serverError(res, e); }
});

app.get("/api/public/categories", requireDb, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    // Los eventos sin categoría (NULL o '') se agrupan en "otro" por defecto.
    const { rows } = await db.execute({
      sql: `SELECT COALESCE(NULLIF(category, ''), 'otro') as category, COUNT(*) as count FROM events
            WHERE visibility = 'public'
            AND (json_extract(payload, '$.endDate') >= ?
              OR (json_extract(payload, '$.endDate') IS NULL AND json_extract(payload, '$.startDate') >= ?)
              OR (json_extract(payload, '$.endDate') = '' AND json_extract(payload, '$.startDate') >= ?))
            GROUP BY COALESCE(NULLIF(category, ''), 'otro') ORDER BY count DESC`,
      args: [today, today, today],
    });
    setCache(res, { cdn: 120, swr: 300 });
    res.json({ categories: rows.map(r => ({ slug: r.category, count: Number(r.count) })) });
  } catch (e) { serverError(res, e); }
});

// Perfil público de un organizador: quién es y todo lo que ha hecho o va a
// hacer. Es la ficha a la que lleva su nombre desde cualquier tarjeta de
// Descubrir — sin esto, el nombre del organizador era texto muerto.
//
// Solo eventos PÚBLICOS: los privados y los de "solo enlace" no aparecen aquí
// ni aunque sean del mismo organizador.
app.get("/api/public/hosts/:id", requireDb, async (req, res) => {
  try {
    const hostId = String(req.params.id || "").trim();
    if (!hostId) return res.status(404).json({ error: "Organizador no encontrado" });
    const today = new Date().toISOString().split("T")[0];

    const proyeccion = `events.id, events.slug, events.category, events.is_paid, events.price,
             json_extract(payload, '$.title')     AS title,
             json_extract(payload, '$.city')      AS city,
             json_extract(payload, '$.location')  AS location,
             json_extract(payload, '$.address')   AS address,
             json_extract(payload, '$.isVirtual') AS is_virtual,
             json_extract(payload, '$.startDate') AS start_date,
             json_extract(payload, '$.startTime') AS start_time,
             json_extract(payload, '$.endDate')   AS end_date,
             json_extract(payload, '$.endTime')   AS end_time,
             json_extract(payload, '$.themeColor') AS theme_color,
             json_extract(payload, '$.fontId')     AS font_id,
             json_extract(payload, '$.imagePos.x') AS img_x,
             json_extract(payload, '$.imagePos.y') AS img_y,
             json_extract(payload, '$.imageZoom')  AS img_zoom,
             CASE WHEN json_extract(payload, '$.headerImage') LIKE 'http%'
                  THEN json_extract(payload, '$.headerImage') END AS header_image,
             (SELECT COUNT(*) FROM registrations r
               WHERE r.event_id = events.id AND r.cancelled = 0
                 AND r.payment_status != 'pending') AS attendees,
             -- Las mismas caras que en Descubrir: sin esto, aquí las tarjetas
             -- salían con el contador pelado y se veían de otra familia.
             (SELECT json_group_array(json_object('n', nm, 'i', ini, 'a', av)) FROM (
                SELECT CASE WHEN u2.name IS NOT NULL AND u2.name != '' THEN u2.name END AS nm,
                       upper(substr(COALESCE(NULLIF(u2.name, ''), t.email, '?'), 1, 1)) AS ini,
                       CASE WHEN u2.avatar LIKE 'http%' THEN u2.avatar END AS av,
                       t.created_at AS created_at
                  FROM (SELECT r2.email AS email, r2.created_at AS created_at
                          FROM registrations r2
                         WHERE r2.event_id = events.id AND r2.cancelled = 0
                           AND r2.payment_status != 'pending'
                           AND r2.resale_status != 'listed'
                         ORDER BY r2.created_at ASC LIMIT 16) t
                  LEFT JOIN users u2 ON u2.email = t.email
                 ORDER BY (av IS NULL), (nm IS NULL), created_at ASC
                 LIMIT 4)) AS attendee_preview`;
    // El corte por fecha es el mismo de Descubrir: cuenta endDate y, si no lo
    // hay, startDate.
    const vigente = `(json_extract(payload, '$.endDate') >= ?
        OR (json_extract(payload, '$.endDate') IS NULL AND json_extract(payload, '$.startDate') >= ?)
        OR (json_extract(payload, '$.endDate') = '' AND json_extract(payload, '$.startDate') >= ?))`;

    const [userRes, proxRes, pasadosRes] = await db.batch([
      { sql: "SELECT id, name, email, avatar, created_at FROM users WHERE id = ?", args: [hostId] },
      { sql: `SELECT ${proyeccion} FROM events
               WHERE host_id = ? AND visibility = 'public' AND ${vigente}
               ORDER BY COALESCE(json_extract(payload, '$.startDate'), '9999-99-99') ASC
               LIMIT 60`, args: [hostId, today, today, today] },
      { sql: `SELECT ${proyeccion} FROM events
               WHERE host_id = ? AND visibility = 'public' AND NOT ${vigente}
               ORDER BY COALESCE(json_extract(payload, '$.startDate'), '0000-00-00') DESC
               LIMIT 24`, args: [hostId, today, today, today] },
    ], "read");

    const u = userRes.rows[0];
    if (!u) return res.status(404).json({ error: "Organizador no encontrado" });

    const mapEv = (r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title || "Evento",
      city: r.city || "",
      location: r.location || "",
      address: r.address || "",
      isVirtual: Boolean(r.is_virtual),
      startDate: r.start_date || "",
      startTime: r.start_time || "",
      endDate: r.end_date || "",
      endTime: r.end_time || "",
      headerImage: r.header_image || "",
      themeColor: r.theme_color || null,
      fontId: r.font_id || null,
      imagePos: r.img_x != null ? { x: Number(r.img_x), y: Number(r.img_y ?? 50) } : null,
      imageZoom: r.img_zoom != null ? Number(r.img_zoom) : null,
      category: r.category || null,
      isPaid: Boolean(r.is_paid),
      price: r.price != null ? Number(r.price) : null,
      attendees: Number(r.attendees || 0),
      attendeePreview: parseAttendeePreview(r.attendee_preview),
    });

    const proximos = proxRes.rows.map(mapEv);
    const pasados  = pasadosRes.rows.map(mapEv);

    setCache(res, { cdn: 60, swr: 300 });
    res.json({
      host: {
        id: u.id,
        name: u.name || "Organizador",
        // El correo NO viaja: para escribirle está el botón de la página del
        // evento, que ya pasa por mailto sin publicar la dirección en un listado.
        avatar: u.avatar && String(u.avatar).startsWith("http") ? u.avatar : null,
        since: u.created_at || null,
        totalEvents: proximos.length + pasados.length,
        totalAttendees: [...proximos, ...pasados].reduce((n, e) => n + e.attendees, 0),
      },
      upcoming: proximos,
      past: pasados,
    });
  } catch (e) { serverError(res, e); }
});

app.get("/api/health", (_, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, needsConfig: true, error: "Agrega TURSO_URL en Vercel → Settings → Environment Variables" });
  // Diagnóstico: sin Cloudinary las portadas se guardan en base64 dentro del
  // payload y hacen lentas todas las listas. No expone ningún secreto.
  res.json({ ok: true, cloudinary: cloudinaryEnabled, email: emailEnabled, payments: paymentsEnabled });
});

// Inicializar DB y arrancar
if (dbReady) {
  initDb()
    .then(() => {
      if (!process.env.VERCEL) {
        app.listen(PORT, () => console.log(`TapIn API http://localhost:${PORT}`));
      }
    })
    .catch((e) => {
      console.error("DB init failed:", e);
      if (!process.env.VERCEL) process.exit(1);
    });
} else if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`TapIn API http://localhost:${PORT}`));
}

export default app;
