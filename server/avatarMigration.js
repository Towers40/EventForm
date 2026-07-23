// Lógica de migración de avatares base64 → URL de Cloudinary, compartida por el
// script de línea de comandos (migrate-avatars.js) y por el endpoint de admin
// (POST /api/admin/migrate-avatars). Es idempotente: solo toca filas cuyo avatar
// empieza por "data:". Devuelve un resumen para reportar en ambos casos.

import { db } from "./db.js";
import { uploadToCloudinary, cloudinaryEnabled, isDataUrl } from "./cloudinary.js";

export async function migrateBase64Avatars({ apply = false, onProgress } = {}) {
  if (!db) return { error: "db_no_config" };
  if (!cloudinaryEnabled) return { error: "cloudinary_no_config" };

  const { rows } = await db.execute({
    sql: "SELECT id, email, avatar FROM users WHERE avatar LIKE 'data:%'",
    args: [],
  });

  const resultado = { scanned: rows.length, migrated: 0, failed: 0, items: [] };
  for (const u of rows) {
    if (!isDataUrl(u.avatar)) continue;
    const kb = Math.round(u.avatar.length / 1024);
    if (!apply) {
      resultado.items.push({ email: u.email, kb, status: "pending" });
      onProgress?.({ email: u.email, kb, status: "pending" });
      continue;
    }
    const url = await uploadToCloudinary(u.avatar, { folder: "eventform/avatars" });
    if (!url) {
      resultado.failed++;
      resultado.items.push({ email: u.email, kb, status: "failed" });
      onProgress?.({ email: u.email, kb, status: "failed" });
      continue;
    }
    await db.execute({ sql: "UPDATE users SET avatar = ? WHERE id = ?", args: [url, u.id] });
    resultado.migrated++;
    resultado.items.push({ email: u.email, kb, status: "ok", url });
    onProgress?.({ email: u.email, kb, status: "ok", url });
  }
  return resultado;
}
