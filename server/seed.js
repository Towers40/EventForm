import "dotenv/config";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { hashPassword } from "./auth.js";

const email = process.env.SUPER_ADMIN_EMAIL || "admin@eventform.co";
const password = process.env.SUPER_ADMIN_PASSWORD || "AdminEventForm2026!";
const name = process.env.SUPER_ADMIN_NAME || "Dueño TapIn";

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log("Super admin ya existe:", email);
  process.exit(0);
}

const id = "U" + nanoid(10).toUpperCase();
const hash = await hashPassword(password);
db.prepare(
  "INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, 'super_admin', ?)"
).run(id, email.toLowerCase(), hash, name, Date.now());

console.log("Super admin creado:");
console.log("  Email:", email);
console.log("  Contraseña:", password);
console.log("  (cámbiala en producción vía SUPER_ADMIN_* en .env antes de seed)");
