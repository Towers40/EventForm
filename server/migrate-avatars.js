// Migración única: sube a Cloudinary los avatares que hoy están en base64 en la
// tabla `users` y reemplaza el valor por la URL resultante. Es idempotente
// (solo toca filas cuyo avatar empieza por "data:") y seguro (modo simulación
// por defecto: no escribe nada hasta que se pasa --apply).
//
// Uso (desde la carpeta server/, con las variables de entorno de producción):
//   TURSO_URL=... TURSO_TOKEN=... \
//   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_UPLOAD_PRESET=... \
//   node migrate-avatars.js            # simulación: muestra qué haría
//   node migrate-avatars.js --apply    # aplica los cambios
//
// En local (sin TURSO_URL) actúa sobre server/data/eventform.db.

import "dotenv/config";
import { db, dbReady } from "./db.js";
import { uploadToCloudinary, cloudinaryEnabled, isDataUrl } from "./cloudinary.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!dbReady || !db) {
    console.error("✗ Base de datos no configurada. Define TURSO_URL/TURSO_TOKEN (o usa el archivo local).");
    process.exit(1);
  }
  if (!cloudinaryEnabled) {
    console.error("✗ Cloudinary no configurado. Define CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET.");
    process.exit(1);
  }

  const { rows } = await db.execute({
    sql: "SELECT id, email, avatar FROM users WHERE avatar LIKE 'data:%'",
    args: [],
  });

  console.log(`Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN (usa --apply para escribir)"}`);
  console.log(`Avatares en base64 por migrar: ${rows.length}\n`);
  if (rows.length === 0) { console.log("Nada que migrar. ✔"); process.exit(0); }

  let ok = 0, fallo = 0;
  for (const u of rows) {
    const etiqueta = u.email || u.id;
    if (!isDataUrl(u.avatar)) continue;
    const kb = Math.round(u.avatar.length / 1024);
    if (!APPLY) {
      console.log(`  · ${etiqueta} — base64 de ~${kb} KB → se subiría a Cloudinary`);
      ok++;
      continue;
    }
    const url = await uploadToCloudinary(u.avatar, { folder: "eventform/avatars" });
    if (!url) {
      console.log(`  ✗ ${etiqueta} — la subida falló, se deja el base64`);
      fallo++;
      continue;
    }
    await db.execute({ sql: "UPDATE users SET avatar = ? WHERE id = ?", args: [url, u.id] });
    console.log(`  ✔ ${etiqueta} — ${kb} KB → ${url}`);
    ok++;
  }

  console.log(`\nResumen: ${ok} ${APPLY ? "migrados" : "por migrar"}${fallo ? `, ${fallo} fallidos` : ""}.`);
  if (!APPLY) console.log("Ejecuta de nuevo con --apply para aplicar los cambios.");
  process.exit(fallo ? 1 : 0);
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
