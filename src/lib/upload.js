import { compressHeaderImage, compressAvatar } from "./images.js";

// Sube una imagen a Cloudinary (unsigned) y devuelve su URL.
// Si Cloudinary no está configurado o la subida falla, devuelve la imagen
// comprimida en base64 (comportamiento anterior) para no romper nada.
export async function uploadImage(file, { square = false } = {}) {
  const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Comprimir/redimensionar en el cliente antes de subir (subida más liviana).
  const dataUrl = square ? await compressAvatar(file) : await compressHeaderImage(file);

  // Diagnóstico temporal: avisa si las variables no llegaron al build.
  if (!CLOUD || !PRESET) {
    console.warn("[Cloudinary] Variables ausentes en el build", { CLOUD, PRESET });
    alert("Cloudinary no está configurado en este build (las variables VITE_ no llegaron). Hay que redeployar SIN caché.");
    return dataUrl;
  }

  try {
    const fd = new FormData();
    fd.append("file", dataUrl);
    fd.append("upload_preset", PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      console.error("[Cloudinary] Error de subida:", res.status, data);
      alert("Cloudinary rechazó la subida: " + msg);
      throw new Error(msg);
    }
    return data.secure_url || dataUrl;
  } catch (e) {
    console.error("[Cloudinary] Falló la subida:", e);
    return dataUrl; // respaldo en base64
  }
}
