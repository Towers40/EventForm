import { useEffect, useState } from "react";

/** ¿Se cumple la media query? Se actualiza al girar o redimensionar. */
export function useMediaQuery(query) {
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return Boolean(ok);
}

/** Corte de escritorio: a partir de aquí las pantallas usan columnas. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
