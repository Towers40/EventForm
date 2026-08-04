import "dotenv/config";
import express from "express";
import cors from "cors";
import { customAlphabet } from "nanoid";
import { db, dbReady, initDb, parseEvent, slugify } from "./db.js";
import { uploadToCloudinary, isDataUrl } from "./cloudinary.js";
import { migrateBase64Avatars } from "./avatarMigration.js";

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
import { capacityMaxOf } from "./capacity.js";
import { getPaymentProvider, paymentsEnabled, PAYMENT_STATUS, REG_PAYMENT, PaymentError, computeOrder } from "./payments/index.js";
import {
  createOrder, getOrder, getOrderByRef, approveOrder, cancelOrder, markWebhookSeen,
  releaseExpiredHolds, countOccupied, listForResale, unlistResale, countResaleListed, refundTicket,
} from "./payments/orders.js";

const app = express();
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
function gen4() { return String(Math.floor(1000 + Math.random() * 9000)); }

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

function rowToUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, avatar: row.avatar || null, createdAt: row.created_at, isOwner: isOwnerEmail(row.email) };
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

    // Try to send verification email
    if (emailEnabled) {
      const code = gen4();
      const expires = Date.now() + 15 * 60 * 1000;
      await db.execute({
        sql: "UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?",
        args: [code, expires, userId],
      });
      let sent = false;
      try { await sendVerificationCode(cleanEmail, cleanName, code); sent = true; } catch (e) { console.error("Email send failed:", e.message); }
      if (sent) {
        return res.json({ pending: true, email: cleanEmail });
      }
      // Email failed → fall through to auto-verify below
    }

    // No email configured or email failed → auto-verify and log in directly
    await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?", args: [userId] });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] });
    res.json({ token: signToken(rowToUser(rows[0])), user: rowToUser(rows[0]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/verify-code", requireDb, async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: "Email y código requeridos" });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.trim().toLowerCase()] });
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    if (row.email_verified) { const u = rowToUser(row); return res.json({ token: signToken(u), user: u }); }
    if (row.verify_code !== String(code).trim()) return res.status(400).json({ error: "Código incorrecto" });
    if (row.verify_code_expires && Date.now() > row.verify_code_expires)
      return res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
    await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?", args: [row.id] });
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
    const u = rowToUser(updated[0]);
    res.json({ token: signToken(u), user: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/resend-code", requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    if (row.email_verified) { const u = rowToUser(row); return res.json({ ok: true, token: signToken(u), user: u }); }
    if (!emailEnabled) {
      // No email configured → auto-verify
      await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL WHERE id = ?", args: [row.id] });
      const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
      const u = rowToUser(updated[0]);
      return res.json({ ok: true, token: signToken(u), user: u });
    }
    const code = gen4(); const expires = Date.now() + 15 * 60 * 1000;
    await db.execute({ sql: "UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?", args: [code, expires, row.id] });
    let sent = false;
    try { await sendVerificationCode(row.email, row.name, code); sent = true; } catch {}
    if (!sent) {
      // Email failed → auto-verify
      await db.execute({ sql: "UPDATE users SET email_verified = 1, verify_code = NULL WHERE id = ?", args: [row.id] });
      const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
      const u = rowToUser(updated[0]);
      return res.json({ ok: true, token: signToken(u), user: u });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", requireDb, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash)))
      return res.status(401).json({ error: "Credenciales incorrectas" });
    const u = rowToUser(row);
    res.json({ token: signToken(u), user: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/forgot-password", requireDb, async (req, res) => {
  try {
    const { email } = req.body || {};
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email?.trim().toLowerCase()] });
    const row = rows[0];
    if (row) {
      const code = gen4(); const expires = Date.now() + 15 * 60 * 1000;
      await db.execute({ sql: "UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?", args: [code, expires, row.id] });
      if (emailEnabled) {
        try { await sendPasswordResetCode(row.email, row.name, code); } catch (e) {
          console.error("Email send failed:", e.message);
          // Return code directly so user can still reset even if email fails
          return res.json({ ok: true, code });
        }
      } else {
        // No email configured — return code directly in response
        return res.json({ ok: true, code });
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/reset-password", requireDb, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) return res.status(400).json({ error: "Campos requeridos" });
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword))
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres y una mayúscula" });
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email.trim().toLowerCase()] });
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
    if (row.reset_code !== String(code).trim()) return res.status(400).json({ error: "Código incorrecto" });
    if (row.reset_code_expires && Date.now() > row.reset_code_expires)
      return res.status(400).json({ error: "El código expiró" });
    const hash = await hashPassword(newPassword);
    await db.execute({ sql: "UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?", args: [hash, row.id] });
    const { rows: updated } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [row.id] });
    const u = rowToUser(updated[0]);
    res.json({ token: signToken(u), user: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user.sub] });
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: rowToUser(rows[0]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
          headerImage: ev.headerImage || "",
          city: ev.city || "",
          location: ev.location || "",
        },
      });
    }
    res.json({ tickets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const { name } = body;
    if (name?.trim()) await db.execute({ sql: "UPDATE users SET name = ? WHERE id = ?", args: [name.trim(), req.user.sub] });
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/auth/me", requireDb, authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    // Obtener todos los eventos del usuario
    const { rows: events } = await db.execute({ sql: "SELECT id FROM events WHERE host_id = ?", args: [userId] });
    const eventIds = events.map(e => e.id);
    // Eliminar todas las registraciones de esos eventos
    if (eventIds.length > 0) {
      for (const eventId of eventIds) {
        await db.execute({ sql: "DELETE FROM registrations WHERE event_id = ?", args: [eventId] });
      }
      // Eliminar todos los eventos
      await db.execute({ sql: "DELETE FROM events WHERE host_id = ?", args: [userId] });
    }
    // Eliminar al usuario
    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Público ───────────────────────────────────────────────────────────────
app.get("/api/public/events/:slug", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!rows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = parseEvent(rows[0]);
    // El aforo que ve el público descuenta las entradas ofrecidas en reventa:
    // esos asientos vuelven a estar disponibles.
    await releaseExpiredHolds(ev.id);
    ev.registrationCount = await countOccupied(ev.id);
    ev.resaleAvailable = await countResaleListed(ev.id);
    ev.registrations = undefined;
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    const { rows: hostRows } = await db.execute({ sql: "SELECT name, email, avatar FROM users WHERE id = ?", args: [ev.hostId] });
    ev.hostName = hostRows[0]?.name || "";
    ev.hostEmail = hostRows[0]?.email || "";
    // Solo se expone el avatar si es una URL (los base64 no viajan; ver Descubrir).
    const hostAv = hostRows[0]?.avatar;
    ev.hostAvatar = hostAv && String(hostAv).startsWith("http") ? hostAv : null;
    // La página pública es lo que ve el asistente: tras una edición debe
    // reflejarse casi al instante, así que la caché compartida es mínima.
    res.set("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=10");
    res.json({ event: ev });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/public/registrations/:ticketId/cancel", requireDb, async (req, res) => {
  try {
    const { rows } = await db.execute({ sql: "SELECT id, cancelled FROM registrations WHERE ticket_id = ?", args: [req.params.ticketId] });
    if (!rows[0]) return res.status(404).json({ error: "Registro no encontrado" });
    if (rows[0].cancelled) return res.json({ ok: true, already: true });
    await db.execute({ sql: "UPDATE registrations SET cancelled = 1 WHERE ticket_id = ?", args: [req.params.ticketId] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
          city: ev.city || "",
          location: ev.location || "",
        },
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// ─── Eventos (anfitrión) ───────────────────────────────────────────────────
app.get("/api/events", requireDb, authMiddleware, async (req, res) => {
  try {
    const sql = req.user.role === "super_admin"
      ? { sql: "SELECT * FROM events ORDER BY updated_at DESC", args: [] }
      : { sql: "SELECT * FROM events WHERE host_id = ? ORDER BY updated_at DESC", args: [req.user.sub] };
    const { rows } = await db.execute(sql);
    const events = rows.map((r) => {
      const ev = parseEvent(r);
      ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
      ev.registrations = [];
      return ev;
    });

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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/events", requireDb, authMiddleware, requireRole("host", "super_admin"), async (req, res) => {
  try {
    const payload = req.body;
    
    // Validar payload
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Datos inválidos. Envía un objeto de evento." });
    }
    if (!payload.title || !String(payload.title).trim()) {
      return res.status(400).json({ error: "El evento debe tener un título." });
    }

    const id = payload.id || "E" + uid();
    // El cliente manda un slug derivado del título, así que dos eventos con el
    // mismo nombre chocaban contra el UNIQUE de `slug` y el INSERT reventaba con
    // un 500 ("Error al publicar"). Se pasa SIEMPRE por uniqueSlug, que añade
    // sufijo (-1, -2, …) si ya está tomado.
    const slug = await uniqueSlug(payload.slug || payload.title, id);
    const hostId = req.user.role === "super_admin" && payload.hostId ? payload.hostId : req.user.sub;
    const now = Date.now();
    const data = { ...payload, id, slug, registrations: payload.registrations || [] };
    
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
    
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Datos inválidos." });
    }

    // Mismo motivo que en el POST: si el slug pedido ya lo usa OTRO evento, se
    // le añade sufijo en vez de dejar que falle el UNIQUE al guardar.
    const slug = payload.slug && payload.slug !== row.slug
      ? await uniqueSlug(payload.slug, row.id)
      : row.slug;
    const regs = await getRegsForEvent(row.id);
    const data = { ...JSON.parse(row.payload), ...payload, id: row.id, slug, registrations: regs };
    
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/events/:id", requireDb, authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [req.params.id] });
    const row = existing[0];
    if (!row) return res.status(404).json({ error: "No encontrado" });
    if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) return res.status(403).json({ error: "Sin permiso" });
    await db.execute({ sql: "DELETE FROM events WHERE id = ?", args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Migra los avatares antiguos en base64 a URLs de Cloudinary. Se ejecuta en el
// servidor (que ya tiene las credenciales), así el admin no necesita terminal.
app.post("/api/admin/migrate-avatars", requireDb, authMiddleware, requireOwner, async (req, res) => {
  try {
    const result = await migrateBase64Avatars({ apply: true });
    if (result.error === "cloudinary_no_config") {
      return res.status(400).json({ error: "Cloudinary no está configurado en el servidor (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET)." });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Discover (público) ────────────────────────────────────────────────────
app.get("/api/public/events", requireDb, async (req, res) => {
  try {
    const { q, category, city, page = 1, limit = 12 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
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

    const { rows: countRows } = await db.execute({ sql: `SELECT COUNT(*) as total FROM events ${where}`, args });
    const total = Number(countRows[0]?.total || 0);

    // Proyección esbelta: solo los campos que pinta la tarjeta del listado, en
    // vez de `events.*` (que arrastra el `payload` entero con decenas de campos
    // sin usar). El avatar del organizador se devuelve SOLO si es una URL: los
    // avatares en base64 pesan ~50 KB y, multiplicados por evento, hacían la
    // respuesta de varios MB; con base64 la tarjeta cae a la inicial. Se elimina
    // también la subconsulta de conteo de inscritos (el listado no la muestra).
    const { rows } = await db.execute({
      sql: `SELECT events.id, events.slug, events.category, events.is_paid, events.price,
                   json_extract(payload, '$.title')       AS title,
                   json_extract(payload, '$.city')        AS city,
                   json_extract(payload, '$.startDate')   AS start_date,
                   json_extract(payload, '$.startTime')   AS start_time,
                   json_extract(payload, '$.endDate')     AS end_date,
                   json_extract(payload, '$.endTime')     AS end_time,
                   json_extract(payload, '$.headerImage') AS header_image,
                   u.name AS host_name,
                   CASE WHEN u.avatar LIKE 'http%' THEN u.avatar END AS host_avatar
            FROM events
            LEFT JOIN users u ON u.id = events.host_id
            ${where}
            ORDER BY COALESCE(json_extract(payload, '$.startDate'), '9999-99-99') ASC
            LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), offset],
    });

    const events = rows.map(r => ({
      id: r.id,
      slug: r.slug,
      title: r.title || "Evento",
      city: r.city || "",
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
    }));

    // Caché corta. Antes era s-maxage=60 + swr=120: tras editar un evento, el
    // CDN de Vercel podía seguir sirviendo la versión vieja hasta ~3 minutos y
    // el cambio "no salía" en Descubrir. `max-age=0` obliga además al navegador
    // a revalidar en vez de aplicar su caché heurística.
    res.set("Cache-Control", "public, max-age=0, s-maxage=10, stale-while-revalidate=20");
    res.json({ events, total, page: Number(page), limit: Number(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    res.set("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
    res.json({ categories: rows.map(r => ({ slug: r.category, count: Number(r.count) })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/health", (_, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, needsConfig: true, error: "Agrega TURSO_URL en Vercel → Settings → Environment Variables" });
  res.json({ ok: true });
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
