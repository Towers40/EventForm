import { compressHeaderImage, compressAvatar } from "./images.js";

// Sube una imagen a Cloudinary (unsigned) y devuelve su URL.
// Si Cloudinary no está configurado o la subida falla, devuelve la imagen
// comprimida en base64 (comportamiento anterior) para no romper nada.
export async function uploadImage(file, { square = false } = {}) {
  const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Comprimir/redimensionar en el cliente antes de subir (subida más liviana).
  const dataUrl = square ? await compressAvatar(file) : await compressHeaderImage(file);

  if (!CLOUD || !PRESET) return dataUrl; // sin Cloudinary → base64

  try {
    const fd = new FormData();
    fd.append("file", dataUrl);
    fd.append("upload_preset", PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return data.secure_url || dataUrl;
  } catch {
    return dataUrl; // si falla la subida, respaldo en base64
  }
}
