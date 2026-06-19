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
    { sql: `CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id)` },
  ], "deferred");

  // Migrations — ALTER TABLE fails silently if column already exists
  const migrations = [
    "ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'",
    "ALTER TABLE events ADD COLUMN category TEXT",
    "ALTER TABLE events ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE events ADD COLUMN price REAL",
  ];
  for (const sql of migrations) {
    try {
      await db.execute({ sql, args: [] });
    } catch (e) {
      if (!e.message?.includes("duplicate column") && !e.message?.includes("already exists")) throw e;
    }
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
