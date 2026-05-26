import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "eventform.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'host',
    email_verified INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    payload TEXT NOT NULL,
    manual_sold_out INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (host_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS registrations (
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
  );

  CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id);
  CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
  CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
`);

export function parseEvent(row) {
  if (!row) return null;
  const ev = JSON.parse(row.payload);
  ev.id = row.id;
  ev.slug = row.slug;
  ev.hostId = row.host_id;
  ev.manualSoldOut = Boolean(row.manual_sold_out);
  return ev;
}

// Migración idempotente
try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN verify_token TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN verify_code TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN verify_code_expires INTEGER"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN reset_code TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN reset_code_expires INTEGER"); } catch {}

export function slugify(text) {
  return String(text || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
