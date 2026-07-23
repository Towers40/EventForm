// Migración única (línea de comandos): sube a Cloudinary los avatares que hoy
// están en base64 en la tabla `users` y reemplaza el valor por la URL. Seguro:
// modo simulación por defecto; solo escribe con --apply. Idempotente.
//
// Uso (desde server/, con las variables de entorno de producción):
//   TURSO_URL=... TURSO_TOKEN=... \
//   CLOUDINARY_CLOUD_NAME=... CLOUDINARY_UPLOAD_PRESET=... \
//   node migrate-avatars.js            # simulación
//   node migrate-avatars.js --apply    # aplica
//
// En local (sin TURSO_URL) actúa sobre server/data/eventform.db.
// Alternativa sin terminal: el botón "Migrar avatares" en Mi cuenta (super admin).

import "dotenv/config";
import { dbReady } from "./db.js";
import { cloudinaryEnabled } from "./cloudinary.js";
import { migrateBase64Avatars } from "./avatarMigration.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!dbReady) {
    console.error("✗ Base de datos no configurada. Define TURSO_URL/TURSO_TOKEN (o usa el archivo local).");
    process.exit(1);
  }
  if (!cloudinaryEnabled) {
    console.error("✗ Cloudinary no configurado. Define CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET.");
    process.exit(1);
  }

  console.log(`Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN (usa --apply para escribir)"}`);
  const r = await migrateBase64Avatars({
    apply: APPLY,
    onProgress: (it) => {
      if (it.status === "pending") console.log(`  · ${it.email} — base64 de ~${it.kb} KB → se subiría a Cloudinary`);
      else if (it.status === "ok") console.log(`  ✔ ${it.email} — ${it.kb} KB → ${it.url}`);
      else console.log(`  ✗ ${it.email} — la subida falló, se deja el base64`);
    },
  });

  console.log(`\nAvatares en base64 encontrados: ${r.scanned}`);
  if (r.scanned === 0) { console.log("Nada que migrar. ✔"); process.exit(0); }
  console.log(`Resumen: ${APPLY ? `${r.migrated} migrados` : `${r.scanned} por migrar`}${r.failed ? `, ${r.failed} fallidos` : ""}.`);
  if (!APPLY) console.log("Ejecuta de nuevo con --apply para aplicar los cambios.");
  process.exit(r.failed ? 1 : 0);
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
