import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TURSO_URL = process.env.TURSO_URL;
const isVercel = Boolean(process.env.VERCEL);

export let db = null;
export let dbReady = false;

if (TURSO_URL) {
  // Turso HTTP — pure JS, funciona en cualquier plataforma
  db = createClient({ url: TURSO_URL, authToken: process.env.TURSO_TOKEN });
  dbReady = true;
} else if (!isVercel) {
  // Solo en local: SQLite en archivo
  try {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = createClient({ url: `file:${path.join(dataDir, "eventform.db")}` });
    dbReady = true;
  } catch (e) {
    console.error("Local DB init error:", e.message);
  }
}
// Vercel sin TURSO_URL → db = null, dbReady = false → rutas devuelven 503

export async function initDb() {
  if (!db) return;
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'host',
        email_verified INTEGER NOT NULL DEFAULT 0,
        verify_token TEXT,
        verify_code TEXT,
        verify_code_expires INTEGER,
        reset_code TEXT,
        reset_code_expires INTEGER,
        created_at INTEGER NOT NULL
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        payload TEXT NOT NULL,
        manual_sold_out INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (host_id) REFERENCES users(id)
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        ticket_id TEXT UNIQUE NOT NULL,
        payload TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        checked_in_at INTEGER,
        consent_privacy INTEGER NOT NULL DEFAULT 0,
        consent_marketing INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,
    },
    {
      // Órdenes de pago. Una orden agrupa las entradas de UNA compra (que
      // pueden ser varias) y guarda el reparto tal como se calculó en el
      // momento: si mañana cambia la comisión, lo ya cobrado no se reescribe.
      sql: `CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        buyer_email TEXT,
        buyer_user_id TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price INTEGER NOT NULL DEFAULT 0,
        subtotal INTEGER NOT NULL DEFAULT 0,
        service_fee INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        platform_fee INTEGER NOT NULL DEFAULT 0,
        organizer_net INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'COP',
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT,
        provider_ref TEXT,
        checkout_url TEXT,
        form_payload TEXT,
        consent_privacy INTEGER NOT NULL DEFAULT 0,
        consent_marketing INTEGER NOT NULL DEFAULT 0,
        reserved_until INTEGER,
        refunded_amount INTEGER NOT NULL DEFAULT 0,
        resale_of TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )`,
    },
    {
      // Eventos de webhook ya procesados. La pasarela reintenta hasta recibir
      // un 200, así que sin esta tabla una confirmación repetida emitiría los
      // QR dos veces.
      sql: `CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        provider TEXT,
        status TEXT,
        received_at INTEGER NOT NULL
      )`,
    },
    { sql: `CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_orders_event ON payment_orders(event_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_orders_ref ON payment_orders(provider_ref)` },
    // OJO: los índices sobre columnas que añade la migración de más abajo
    // (visibility, email, approved) NO pueden ir en este lote — en una base
    // nueva la columna todavía no existe y el batch entero falla.
  ], "deferred");

  // Migraciones. Turso es una base remota (HTTP): cada `db.execute` es un viaje
  // de red, y en el arranque en frío de la función serverless esos viajes se
  // suman al tiempo de la primera respuesta. Por eso se leen las columnas
  // existentes de una vez (una consulta por tabla) y solo se añaden las que
  // falten, en vez de lanzar siete ALTER a ciegas confiando en que fallen.
  const migrations = [
    ["events",        "visibility", "TEXT NOT NULL DEFAULT 'public'"],
    ["events",        "category",   "TEXT"],
    ["events",        "is_paid",    "INTEGER NOT NULL DEFAULT 0"],
    ["events",        "price",      "REAL"],
    ["registrations", "cancelled",  "INTEGER NOT NULL DEFAULT 0"],
    ["users",         "avatar",     "TEXT"],
    ["registrations", "email",      "TEXT"],
    // Eventos con "Requerir aprobación": la entrada nace en 0 (pendiente) y el
    // QR no sirve hasta que el anfitrión la aprueba. El DEFAULT 1 deja las
    // inscripciones ya existentes como aprobadas, que es como se comportaban.
    ["registrations", "approved",   "INTEGER NOT NULL DEFAULT 1"],
    // Pagos. `not_required` por defecto deja intactas las inscripciones de
    // eventos gratuitos y todo lo ya existente.
    ["registrations", "order_id",       "TEXT"],
    ["registrations", "payment_status", "TEXT NOT NULL DEFAULT 'not_required'"],
    // Reventa: la entrada sigue siendo válida mientras está en venta; solo
    // deja de serlo cuando otra persona ocupa el cupo.
    ["registrations", "resale_status",  "TEXT NOT NULL DEFAULT 'none'"], // none | listed | sold
    ["registrations", "resale_listed_at", "INTEGER"],
    // Cuenta del organizador como receptor del split en la pasarela.
    ["users", "payout_provider",   "TEXT"],
    ["users", "payout_account_id", "TEXT"],
    ["users", "payout_status",     "TEXT NOT NULL DEFAULT 'none'"], // none | pending | verified
  ];
  const tablas = [...new Set(migrations.map(m => m[0]))];
  const columnas = {};
  await Promise.all(tablas.map(async t => {
    const { rows } = await db.execute({ sql: `PRAGMA table_info(${t})`, args: [] });
    columnas[t] = new Set(rows.map(r => r.name));
  }));
  for (const [tabla, col, def] of migrations) {
    if (columnas[tabla].has(col)) continue;
    try {
      await db.execute({ sql: `ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`, args: [] });
    } catch (e) {
      const m = e.message?.toLowerCase() || "";
      if (!m.includes("duplicate column") && !m.includes("already has")) throw e;
    }
  }

  // Índices que dependen de columnas añadidas arriba: ya existen, así que aquí
  // sí se pueden crear (en el lote inicial reventaban con una base nueva).
  for (const sql of [
    "CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility)",
    // Índice para buscar entradas por email del asistente (vista "Mis tickets")
    "CREATE INDEX IF NOT EXISTS idx_reg_email ON registrations(email)",
    "CREATE INDEX IF NOT EXISTS idx_reg_order ON registrations(order_id)",
    // El listado de reventa filtra por evento + estado.
    "CREATE INDEX IF NOT EXISTS idx_reg_resale ON registrations(event_id, resale_status)",
  ]) {
    try { await db.execute({ sql, args: [] }); } catch { /* noop */ }
  }
}

export function parseEvent(row) {
  if (!row) return null;
  const ev = JSON.parse(row.payload);
  ev.id = row.id;
  ev.slug = row.slug;
  ev.hostId = row.host_id;
  ev.manualSoldOut = Boolean(row.manual_sold_out);
  ev.visibility = row.visibility || "public";
  ev.category = row.category || null;
  ev.isPaid = Boolean(row.is_paid);
  ev.price = row.price != null ? Number(row.price) : null;
  return ev;
}

export function slugify(text) {
  return String(text || "evento")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
