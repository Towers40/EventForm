import "dotenv/config";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { db, parseEvent, slugify } from "./db.js";
import {
  authMiddleware,
  hashPassword,
  requireRole,
  signToken,
  verifyPassword,
} from "./auth.js";
import { emailEnabled, sendVerificationCode, sendPasswordResetCode } from "./mailer.js";

function gen4() { return String(Math.floor(1000 + Math.random() * 9000)); }

const app = express();
const PORT = process.env.PORT || 3001;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || true,
    credentials: true,
  })
);
app.use(express.json({ limit: "6mb" }));

function uid() {
  return nanoid(10).toUpperCase();
}

function uniqueSlug(title, excludeId = null) {
  let base = slugify(title) || "evento";
  let slug = base;
  let n = 0;
  while (true) {
    const row = db
      .prepare("SELECT id FROM events WHERE slug = ?")
      .get(slug);
    if (!row || row.id === excludeId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

function rowToUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function getRegsForEvent(eventId) {
  return db
    .prepare(
      "SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at DESC"
    )
    .all(eventId)
    .map((r) => ({
      id: r.ticket_id,
      eventId: r.event_id,
      data: JSON.parse(r.payload),
      ts: r.created_at,
      used: Boolean(r.used),
      checkedInAt: r.checked_in_at,
      consentPrivacy: Boolean(r.consent_privacy),
      consentMarketing: Boolean(r.consent_marketing),
    }));
}

function attachRegs(ev) {
  ev.registrations = getRegsForEvent(ev.id);
  return ev;
}

// ─── Auth ───────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email?.trim() || !password || password.length < 8) {
    return res.status(400).json({ error: "Email y contraseña (mín. 8 caracteres) requeridos" });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: "La contraseña debe contener al menos una letra mayúscula" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: "Email ya registrado" });

  const id = "U" + uid();
  const hash = await hashPassword(password);
  const code = emailEnabled ? gen4() : null;
  const expires = emailEnabled ? Date.now() + 15 * 60 * 1000 : null;
  const verified = emailEnabled ? 0 : 1;

  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, email_verified, verify_code, verify_code_expires, created_at)
     VALUES (?, ?, ?, ?, 'host', ?, ?, ?, ?)`
  ).run(id, email.trim().toLowerCase(), hash, name?.trim() || "", verified, code, expires, Date.now());

  if (emailEnabled && code) {
    try { await sendVerificationCode(email.trim().toLowerCase(), name?.trim() || "", code); }
    catch (e) { console.error("Error sending code:", e.message); }
    return res.json({ pending: true, email: email.trim().toLowerCase() });
  }
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
  res.json({ token: signToken(user), user });
});

app.post("/api/auth/verify-code", (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Email y código requeridos" });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
  if (row.email_verified) {
    const user = rowToUser(row);
    return res.json({ token: signToken(user), user });
  }
  if (row.verify_code !== String(code).trim()) {
    return res.status(400).json({ error: "Código incorrecto" });
  }
  if (row.verify_code_expires && Date.now() > row.verify_code_expires) {
    return res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
  }
  db.prepare("UPDATE users SET email_verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?").run(row.id);
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(row.id));
  res.json({ token: signToken(user), user });
});

app.post("/api/auth/resend-code", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requerido" });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
  if (row.email_verified) return res.json({ ok: true });
  const code = gen4();
  const expires = Date.now() + 15 * 60 * 1000;
  db.prepare("UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?").run(code, expires, row.id);
  try { await sendVerificationCode(row.email, row.name, code); }
  catch (e) { return res.status(500).json({ error: "Error al enviar el correo" }); }
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requerido" });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!row) return res.json({ ok: true }); // No revelar si existe
  const code = gen4();
  const expires = Date.now() + 15 * 60 * 1000;
  db.prepare("UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?").run(code, expires, row.id);
  try { await sendPasswordResetCode(row.email, row.name, code); }
  catch (e) { console.error("Error sending reset code:", e.message); }
  res.json({ ok: true });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) return res.status(400).json({ error: "Todos los campos son requeridos" });
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres y una mayúscula" });
  }
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
  if (row.reset_code !== String(code).trim()) return res.status(400).json({ error: "Código incorrecto" });
  if (row.reset_code_expires && Date.now() > row.reset_code_expires) {
    return res.status(400).json({ error: "El código expiró. Solicita uno nuevo." });
  }
  const hash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?").run(hash, row.id);
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(row.id));
  res.json({ token: signToken(user), user });
});

// Keep legacy link-based verify for any old emails still pending
app.get("/api/auth/verify-email/:token", (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE verify_token = ?").get(req.params.token);
  if (!row) return res.status(400).json({ error: "Enlace inválido o ya utilizado" });
  db.prepare("UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?").run(row.id);
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(row.id));
  res.json({ token: signToken(user), user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email?.trim().toLowerCase());
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  const user = rowToUser(row);
  res.json({ token: signToken(user), user });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ user: rowToUser(row) });
});

app.patch("/api/auth/me", authMiddleware, (req, res) => {
  const { name } = req.body || {};
  if (name?.trim()) {
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), req.user.sub);
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  res.json({ user: rowToUser(row) });
});

app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Campos requeridos" });
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres y una mayúscula" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
    return res.status(401).json({ error: "Contraseña actual incorrecta" });
  }
  const hash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user.sub);
  res.json({ ok: true });
});

// ─── Público ────────────────────────────────────────────────────────────────
app.get("/api/public/events/:slug", (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Evento no encontrado" });
  const ev = parseEvent(row);
  const count = db
    .prepare("SELECT COUNT(*) as c FROM registrations WHERE event_id = ?")
    .get(ev.id).c;
  ev.registrationCount = count;
  ev.registrations = undefined;
  ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
  res.json({ event: ev });
});

app.post("/api/public/events/:slug/register", (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Evento no encontrado" });

  const ev = attachRegs(parseEvent(row));
  if (ev.manualSoldOut) {
    return res.status(403).json({ error: "sold_out", message: "Entradas agotadas" });
  }

  const { form, consentPrivacy, consentMarketing } = req.body || {};
  if (!consentPrivacy) {
    return res.status(400).json({ error: "Debes aceptar la política de privacidad" });
  }

  const maxMap = { "0-50": 50, "50-100": 100, "100-300": 300, "300+": 10000 };
  const max = maxMap[ev.capacity];
  if (max != null && ev.registrations.length >= max) {
    return res.status(403).json({ error: "sold_out", message: "Cupo lleno" });
  }

  const ticketId = "TICKET-" + uid();
  const reg = {
    id: ticketId,
    eventId: ev.id,
    data: form,
    ts: Date.now(),
    used: false,
    checkedInAt: null,
  };

  db.prepare(
    `INSERT INTO registrations (id, event_id, ticket_id, payload, used, checked_in_at, consent_privacy, consent_marketing, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`
  ).run(
    "R" + uid(),
    ev.id,
    ticketId,
    JSON.stringify(form),
    consentPrivacy ? 1 : 0,
    consentMarketing ? 1 : 0,
    Date.now()
  );

  res.status(201).json({ registration: reg, event: { id: ev.id, title: ev.title, slug: ev.slug } });
});

// ─── Eventos (anfitrión) ────────────────────────────────────────────────────
app.get("/api/events", authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === "super_admin") {
    rows = db.prepare("SELECT * FROM events ORDER BY updated_at DESC").all();
  } else {
    rows = db
      .prepare("SELECT * FROM events WHERE host_id = ? ORDER BY updated_at DESC")
      .all(req.user.sub);
  }
  const events = rows.map((r) => {
    const ev = attachRegs(parseEvent(r));
    ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
    return ev;
  });
  res.json({ events });
});

app.post("/api/events", authMiddleware, requireRole("host", "super_admin"), (req, res) => {
  const payload = req.body;
  const id = payload.id || "E" + uid();
  const slug = payload.slug || uniqueSlug(payload.title, id);
  const hostId = req.user.role === "super_admin" && payload.hostId ? payload.hostId : req.user.sub;
  const now = Date.now();
  const data = { ...payload, id, slug, registrations: payload.registrations || [] };

  db.prepare(
    `INSERT INTO events (id, host_id, slug, payload, manual_sold_out, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    hostId,
    slug,
    JSON.stringify(data),
    payload.manualSoldOut ? 1 : 0,
    now,
    now
  );

  const ev = attachRegs(parseEvent(db.prepare("SELECT * FROM events WHERE id = ?").get(id)));
  ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
  res.status(201).json({ event: ev });
});

app.put("/api/events/:id", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) {
    return res.status(403).json({ error: "Sin permiso" });
  }

  const payload = req.body;
  const slug = payload.slug || row.slug;
  const data = { ...JSON.parse(row.payload), ...payload, id: row.id, slug };
  const regs = getRegsForEvent(row.id);
  data.registrations = regs;

  db.prepare(
    `UPDATE events SET slug = ?, payload = ?, manual_sold_out = ?, updated_at = ? WHERE id = ?`
  ).run(
    slug,
    JSON.stringify(data),
    payload.manualSoldOut ? 1 : 0,
    Date.now(),
    row.id
  );

  const ev = attachRegs(parseEvent(db.prepare("SELECT * FROM events WHERE id = ?").get(row.id)));
  ev.publicUrl = `${APP_URL}/e/${ev.slug}`;
  res.json({ event: ev });
});

app.patch("/api/events/:id/sold-out", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  const manualSoldOut = req.body.manualSoldOut ? 1 : 0;
  db.prepare("UPDATE events SET manual_sold_out = ?, updated_at = ? WHERE id = ?").run(
    manualSoldOut,
    Date.now(),
    req.params.id
  );
  const ev = attachRegs(parseEvent(db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id)));
  ev.manualSoldOut = Boolean(manualSoldOut);
  res.json({ event: ev });
});

app.delete("/api/events/:id", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No encontrado" });
  if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) {
    return res.status(403).json({ error: "Sin permiso" });
  }
  db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/events/:id/check-in", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Evento no encontrado" });
  if (req.user.role !== "super_admin" && row.host_id !== req.user.sub) {
    return res.status(403).json({ error: "Sin permiso" });
  }

  const { ticketId } = req.body || {};
  const regRow = db
    .prepare("SELECT * FROM registrations WHERE ticket_id = ? AND event_id = ?")
    .get(ticketId?.trim().toUpperCase(), req.params.id);

  if (!regRow) return res.json({ status: "nf" });
  if (regRow.used) {
    return res.json({
      status: "used",
      reg: {
        id: regRow.ticket_id,
        data: JSON.parse(regRow.payload),
        checkedInAt: regRow.checked_in_at,
      },
    });
  }

  const checkedInAt = Date.now();
  db.prepare("UPDATE registrations SET used = 1, checked_in_at = ? WHERE id = ?").run(
    checkedInAt,
    regRow.id
  );

  res.json({
    status: "ok",
    reg: {
      id: regRow.ticket_id,
      data: JSON.parse(regRow.payload),
      checkedInAt,
    },
  });
});

// ─── Super admin ──────────────────────────────────────────────────────────────
app.get("/api/admin/overview", authMiddleware, requireRole("super_admin"), (req, res) => {
  const hosts = db
    .prepare("SELECT id, email, name, role, created_at FROM users WHERE role = 'host'")
    .all()
    .map(rowToUser);
  const eventCount = db.prepare("SELECT COUNT(*) as c FROM events").get().c;
  const regCount = db.prepare("SELECT COUNT(*) as c FROM registrations").get().c;
  const events = db
    .prepare(
      `SELECT e.*, u.email as host_email, u.name as host_name FROM events e
       JOIN users u ON u.id = e.host_id ORDER BY e.updated_at DESC LIMIT 100`
    )
    .all()
    .map((r) => ({
      ...attachRegs(parseEvent(r)),
      hostEmail: r.host_email,
      hostName: r.host_name,
      publicUrl: `${APP_URL}/e/${r.slug}`,
    }));

  res.json({ hosts, events, stats: { eventCount, regCount, hostCount: hosts.length } });
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`EventForm API http://localhost:${PORT}`);
});
