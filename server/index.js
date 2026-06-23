import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { db, dbReady, initDb, parseEvent, slugify } from "./db.js";

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
  requireRole,
  signToken,
  verifyPassword,
} from "./auth.js";
import { emailEnabled, sendVerificationCode, sendPasswordResetCode, sendRegistrationConfirmation } from "./mailer.js";

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
app.use(express.json({ limit: "6mb" }));

function uid() { return nanoid(10).toUpperCase(); }
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

function rowToUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, avatar: row.avatar || null, createdAt: row.created_at };
}

async function getRegsForEvent(eventId) {
  const { rows } = await db.execute({
    sql: "SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at DESC",
    args: [eventId],
  });
  return rows.map((r) => ({
    id: r.ticket_id, eventId: r.event_id, data: JSON.parse(r.payload),
    ts: r.created_at, used: Boolean(r.used), checkedInAt: r.checked_in_at,
    consentPrivacy: Boolean(r.consent_privacy), consentMarketing: Boolean(r.consent_marketing),
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
    // Prefiltro por SQL (el email está dentro del payload JSON de la inscripción)
    const { rows } = await db.execute({
      sql: `SELECT r.ticket_id, r.payload AS reg_payload, r.used, r.checked_in_at, r.created_at,
                   e.slug, e.payload AS event_payload, e.manual_sold_out
            FROM registrations r
            JOIN events e ON e.id = r.event_id
            WHERE r.cancelled = 0 AND lower(r.payload) LIKE ?
            ORDER BY r.created_at DESC`,
      args: [`%${email}%`],
    });
    const tickets = [];
    for (const row of rows) {
      let data = {};
      try { data = JSON.parse(row.reg_payload); } catch { continue; }
      // Verifica coincidencia exacta del email en algún valor del formulario
      const match = Object.values(data).some(
        (v) => typeof v === "string" && v.trim().toLowerCase() === email
      );
      if (!match) continue;
      let ev = {};
      try { ev = JSON.parse(row.event_payload); } catch { ev = {}; }
      tickets.push({
        id: row.ticket_id,
        used: Boolean(row.used),
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
      const avatar = body.avatar ? String(body.avatar) : null;
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
    const { rows: cnt } = await db.execute({ sql: "SELECT COUNT(*) as c FROM registrations WHERE event_id = ? AND cancelled = 0", args: [ev.id] });
    ev.registrationCount = Number(cnt[0]?.c || 0);
    ev.registrations = undefined;
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    const { rows: hostRows } = await db.execute({ sql: "SELECT name, email FROM users WHERE id = ?", args: [ev.hostId] });
    ev.hostName = hostRows[0]?.name || "";
    ev.hostEmail = hostRows[0]?.email || "";
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

app.post("/api/public/events/:slug/register", requireDb, async (req, res) => {
  try {
    const { rows: evRows } = await db.execute({ sql: "SELECT * FROM events WHERE slug = ?", args: [req.params.slug] });
    if (!evRows[0]) return res.status(404).json({ error: "Evento no encontrado" });
    const ev = await attachRegs(parseEvent(evRows[0]));
    if (ev.manualSoldOut) return res.status(403).json({ error: "sold_out" });
    const { form, consentPrivacy, consentMarketing } = req.body || {};
    if (!consentPrivacy) return res.status(400).json({ error: "Debes aceptar la política de privacidad" });
    const maxMap = { "under-50": 49, "0-50": 50, "50-100": 100, "100-300": 300, "300+": 10000 };
    const customMax = ev.capacity === "under-50" ? Number(ev.capacityCustom) : null;
    const max = customMax > 0 && customMax < 50 ? customMax : maxMap[ev.capacity];
    if (max != null && ev.registrations.length >= max) return res.status(403).json({ error: "sold_out" });
    const ticketId = "TICKET-" + uid();
    await db.execute({
      sql: `INSERT INTO registrations (id, event_id, ticket_id, payload, used, checked_in_at, consent_privacy, consent_marketing, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
      args: ["R" + uid(), ev.id, ticketId, JSON.stringify(form), consentPrivacy ? 1 : 0, consentMarketing ? 1 : 0, Date.now()],
    });
    // Send confirmation email if attendee provided email field
    if (emailEnabled && form) {
      const emailField = (ev.fields || []).find(f => f.type === "email");
      const nameField = (ev.fields || []).find(f => f.type === "text" && /nombre/i.test(f.label));
      const recipientEmail = emailField ? form[emailField.id] : null;
      const recipientName = nameField ? form[nameField.id] : null;
      if (recipientEmail) sendRegistrationConfirmation(recipientEmail, recipientName, ticketId, ev).catch(() => {});
    }
    res.status(201).json({ registration: { id: ticketId, eventId: ev.id, data: form, ts: Date.now(), used: false }, event: { id: ev.id, title: ev.title, slug: ev.slug } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Eventos (anfitrión) ───────────────────────────────────────────────────
app.get("/api/events", requireDb, authMiddleware, async (req, res) => {
  try {
    const sql = req.user.role === "super_admin"
      ? { sql: "SELECT * FROM events ORDER BY updated_at DESC", args: [] }
      : { sql: "SELECT * FROM events WHERE host_id = ? ORDER BY updated_at DESC", args: [req.user.sub] };
    const { rows } = await db.execute(sql);
    const events = await Promise.all(rows.map(async (r) => {
      const ev = await attachRegs(parseEvent(r));
      ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
      return ev;
    }));
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
    const slug = payload.slug || await uniqueSlug(payload.title, id);
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

    const slug = payload.slug || row.slug;
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
    if (regRow.used) return res.json({ status: "used", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload), checkedInAt: regRow.checked_in_at } });
    const checkedInAt = Date.now();
    await db.execute({ sql: "UPDATE registrations SET used = 1, checked_in_at = ? WHERE id = ?", args: [checkedInAt, regRow.id] });
    res.json({ status: "ok", reg: { id: regRow.ticket_id, data: JSON.parse(regRow.payload), checkedInAt } });
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

    if (category) { conditions.push("category = ?"); args.push(category); }
    if (city) { conditions.push("json_extract(payload, '$.city') = ?"); args.push(city); }
    if (q) {
      conditions.push("(json_extract(payload, '$.title') LIKE ? OR json_extract(payload, '$.city') LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }

    const where = "WHERE " + conditions.join(" AND ");

    const { rows: countRows } = await db.execute({ sql: `SELECT COUNT(*) as total FROM events ${where}`, args });
    const total = Number(countRows[0]?.total || 0);

    const { rows } = await db.execute({
      sql: `SELECT *, (SELECT COUNT(*) FROM registrations r WHERE r.event_id = events.id) as reg_count
            FROM events ${where}
            ORDER BY COALESCE(json_extract(payload, '$.startDate'), '9999-99-99') ASC
            LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), offset],
    });

    const events = rows.map(r => {
      const ev = parseEvent(r);
      ev.regCount = Number(r.reg_count || 0);
      ev.registrations = undefined;
      ev.fields = undefined;
      return ev;
    });

    res.json({ events, total, page: Number(page), limit: Number(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/public/categories", requireDb, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const { rows } = await db.execute({
      sql: `SELECT category, COUNT(*) as count FROM events
            WHERE visibility = 'public' AND category IS NOT NULL AND category != ''
            AND (json_extract(payload, '$.endDate') >= ?
              OR (json_extract(payload, '$.endDate') IS NULL AND json_extract(payload, '$.startDate') >= ?)
              OR (json_extract(payload, '$.endDate') = '' AND json_extract(payload, '$.startDate') >= ?))
            GROUP BY category ORDER BY count DESC`,
      args: [today, today, today],
    });
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
        app.listen(PORT, () => console.log(`EventForm API http://localhost:${PORT}`));
      }
    })
    .catch((e) => {
      console.error("DB init failed:", e);
      if (!process.env.VERCEL) process.exit(1);
    });
} else if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`EventForm API http://localhost:${PORT}`));
}

export default app;
