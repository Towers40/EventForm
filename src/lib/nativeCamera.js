import { isNative } from "./platform.js";

// Pide permiso de cámara en la app nativa (Capacitor) antes de iniciar el
// escáner. En web no hace nada: html5-qrcode pide el permiso del navegador.
// Si el plugin no está instalado, devuelve true y deja que html5-qrcode
// gestione el permiso por su cuenta (no rompe la web).
export async function ensureCameraPermission() {
  if (!isNative) return true;
  try {
    const spec = "@capacitor/camera";
    const { Camera } = await import(/* @vite-ignore */ spec);
    const status = await Camera.checkPermissions();
    if (status.camera === "granted" || status.camera === "limited") return true;
    const req = await Camera.requestPermissions({ permissions: ["camera"] });
    return req.camera === "granted" || req.camera === "limited";
  } catch {
    return true;
  }
}
