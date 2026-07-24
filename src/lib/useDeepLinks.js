import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "./platform.js";

// Escucha enlaces entrantes en la app nativa (Capacitor) y navega dentro de la
// SPA. Ej: abrir https://tapin.app/e/mi-evento desde fuera abre la app en
// esa ruta. En web no hace nada (los enlaces los maneja el navegador).
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative) return undefined;
    let removeUrlListener;
    let removeBackListener;

    (async () => {
      try {
        const spec = "@capacitor/app";
        const { App } = await import(/* @vite-ignore */ spec);
        const urlListener = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const u = new URL(url);
            const path = `${u.pathname}${u.search}`;
            if (path && path !== "/") navigate(path);
          } catch {
            /* url no parseable */
          }
        });
        removeUrlListener = () => urlListener?.remove();

        // Botón atrás por hardware (Android): si hay un paso previo en el
        // historial (ya sea de react-router o de las vistas internas de
        // HostApp), retrocede un paso; si no queda nada, cierra la app en vez
        // de dejarla en un estado roto.
        const backListener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        removeBackListener = () => backListener?.remove();
      } catch {
        /* plugin no instalado */
      }
    })();

    return () => { removeUrlListener?.(); removeBackListener?.(); };
  }, [navigate]);
}

// Componente sin UI para usar el hook dentro del Router.
export default function DeepLinks() {
  useDeepLinks();
  return null;
}
