// Subida a Cloudinary desde el servidor (unsigned, sin API secret — usa el mismo
// upload_preset que el cliente). Convierte un data URL base64 en una URL http.
// Comparte credenciales con el frontend, pero SIN el prefijo VITE_:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
// Se usa en dos sitios: el endpoint que guarda el avatar (para que ningún avatar
// nuevo entre como base64) y el script de migración de avatares antiguos.

const CLOUD  = process.env.CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.CLOUDINARY_UPLOAD_PRESET;
// Base configurable solo para pruebas (mock local); en producción no se define.
const API_BASE = process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com";

export const cloudinaryEnabled = Boolean(CLOUD && PRESET);

export function isDataUrl(v) {
  return typeof v === "string" && v.startsWith("data:");
}

// Devuelve la secure_url de Cloudinary, o null si no está configurado o falla
// (el llamador decide el respaldo: normalmente conservar el base64).
export async function uploadToCloudinary(dataUrl, { folder } = {}) {
  if (!cloudinaryEnabled || !isDataUrl(dataUrl)) return null;
  try {
    const fd = new FormData();
    fd.append("file", dataUrl);
    fd.append("upload_preset", PRESET);
    if (folder) fd.append("folder", folder);
    const res = await fetch(`${API_BASE}/v1_1/${CLOUD}/image/upload`, { method: "POST", body: fd });
    if (!res.ok) {
      console.error("[Cloudinary] Subida falló:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.secure_url || null;
  } catch (e) {
    console.error("[Cloudinary] Error de red:", e.message);
    return null;
  }
}
