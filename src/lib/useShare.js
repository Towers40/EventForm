import { useState, useEffect, useRef } from "react";
import { publicBaseUrl } from "./platform.js";

/**
 * Comparte un enlace. Usa la hoja nativa del sistema si existe (móvil) y, si
 * no, copia al portapapeles: en escritorio `navigator.share` no está en casi
 * ningún navegador y el botón se quedaría muerto.
 */
export function useShare() {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const compartir = async ({ url, title, text }) => {
    const abs = url.startsWith("http") ? url : `${publicBaseUrl()}${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ url: abs, title, text }); return; }
      catch { /* cancelado o no permitido → se copia */ }
    }
    try {
      await navigator.clipboard.writeText(abs);
      setCopiado(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 2200);
    } catch {
      window.prompt("Copia el enlace:", abs);
    }
  };
  return { compartir, copiado };
}

