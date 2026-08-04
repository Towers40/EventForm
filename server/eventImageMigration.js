// Migración de portadas de evento base64 → URL de Cloudinary.
//
// Motivo: una portada guardada como `data:image/...` vive DENTRO del payload
// JSON del evento, así que viaja entera en cada respuesta. En producción se
// midió el listado de Descubrir devolviendo 2,65 MB para 5 eventos (~530 KB por
// evento) porque uno tenía la portada incrustada. Es el mismo problema que ya
// se resolvió con los avatares.
//
// Es idempotente: solo toca eventos cuya portada empieza por "data:".

import { db } from "./db.js";
import { uploadToCloudinary, cloudinaryEnabled, isDataUrl } from "./cloudinary.js";

export async function migrateBase64EventImages({ apply = false, onProgress } = {}) {
  if (!db) return { error: "db_no_config" };
  if (!cloudinaryEnabled) return { error: "cloudinary_no_config" };

  // IDs primero, SIN el payload. Traerlos todos con su portada incrustada era
  // justo lo que agotaba la memoria de Turso ("SQLITE_NOMEM"); cada payload se
  // lee después de uno en uno.
  const { rows: pendientes } = await db.execute({
    sql: `SELECT id, slug FROM events WHERE json_extract(payload, '$.headerImage') LIKE 'data:%'`,
    args: [],
  });

  const resultado = { scanned: pendientes.length, migrated: 0, failed: 0, items: [] };
  for (const ev of pendientes) {
    let data;
    if (!apply) {
      resultado.items.push({ slug: ev.slug, status: "pending" });
      onProgress?.({ slug: ev.slug, status: "pending" });
      continue;
    }
    const { rows: full } = await db.execute({ sql: "SELECT payload FROM events WHERE id = ?", args: [ev.id] });
    try { data = JSON.parse(full[0]?.payload || "{}"); } catch { continue; }
    if (!isDataUrl(data.headerImage)) continue;

    const kb = Math.round(data.headerImage.length / 1024);
    const url = await uploadToCloudinary(data.headerImage, { folder: "eventform/covers" });
    if (!url) {
      resultado.failed++;
      resultado.items.push({ slug: ev.slug, kb, status: "failed" });
      onProgress?.({ slug: ev.slug, kb, status: "failed" });
      continue;
    }

    data.headerImage = url;
    await db.execute({
      sql: "UPDATE events SET payload = ?, updated_at = ? WHERE id = ?",
      args: [JSON.stringify(data), Date.now(), ev.id],
    });
    resultado.migrated++;
    resultado.items.push({ slug: ev.slug, kb, status: "ok", url });
    onProgress?.({ slug: ev.slug, kb, status: "ok", url });
  }
  return resultado;
}
