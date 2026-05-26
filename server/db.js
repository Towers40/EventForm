import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Modo local: archivo SQLite. Modo producción: Turso cloud
const TURSO_URL = process.env.TURSO_URL;
const isVercel = Boolean(process.env.VERCEL);

let dbPath;
if (!TURSO_URL) {
  // Local o Vercel sin Turso → usar /tmp en Vercel, ./data localmente
  dbPath = isVercel
    ? "file:/tmp/eventform.db"
    : `file:${path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "eventform.db")}`;
  if (!isVercel) {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }
}

export const db = createClient(
  TURSO_URL
    ? { url: TURSO_URL, authToken: process.env.TURSO_TOKEN }
    : { url: dbPath }
);

export async function initDb() {
  // Tablas principales
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
}

export function parseEvent(row) {
  if (!row) return null;
  const ev = JSON.parse(row.payload);
  ev.id = row.id;
  ev.slug = row.slug;
  ev.hostId = row.host_id;
  ev.manualSoldOut = Boolean(row.manual_sold_out);
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
