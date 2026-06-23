import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "./platform.js";

// Escucha enlaces entrantes en la app nativa (Capacitor) y navega dentro de la
// SPA. Ej: abrir https://eventform.app/e/mi-evento desde fuera abre la app en
// esa ruta. En web no hace nada (los enlaces los maneja el navegador).
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative) return undefined;
    let remove;
    let activeListener;

    (async () => {
      try {
        const spec = "@capacitor/app";
        const { App } = await import(/* @vite-ignore */ spec);
        activeListener = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            const path = `${u.pathname}${u.search}`;
            if (path && path !== "/") navigate(path);
          } catch {
            /* url no parseable */
          }
        });
        remove = () => activeListener?.remove();
      } catch {
        /* plugin no instalado */
      }
    })();

    return () => { remove?.(); };
  }, [navigate]);
}

// Componente sin UI para usar el hook dentro del Router.
export default function DeepLinks() {
  useDeepLinks();
  return null;
}
