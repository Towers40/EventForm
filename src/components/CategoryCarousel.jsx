import { useEffect, useRef } from "react";
import { CategoryIcon, categoryRgba } from "../lib/categoryIcons.jsx";
import { useMediaQuery } from "../lib/useMediaQuery.js";

/**
 * Carrusel circular de categorías (Descubrir).
 *
 * Los círculos de categoría giran en bucle continuo, sin principio ni fin.
 * La interacción cambia según el dispositivo:
 *
 *  · Con ratón: al entrar el cursor el carrusel frena hasta pararse y el
 *    icono que está debajo crece (con un halo de su color). Al salir, sigue.
 *    También se puede arrastrar o deslizar con dos dedos en el trackpad.
 *  · En táctil no hay "hover": el dedo lo atrapa al tocarlo, se desliza a los
 *    lados con inercia y, a los 2 s de soltarlo, vuelve a girar solo. El
 *    círculo que pasa por el centro es el que se agranda (como una lupa),
 *    así siempre hay uno destacado aunque no se toque nada.
 *
 * Al elegir una categoría el carrusel se queda quieto con ella a la vista (en
 * móvil, centrada bajo la lupa), para no perder de vista el filtro puesto.
 *
 * Por qué JS y no una animación CSS como la cinta de destacados: hay que poder
 * arrastrarlo, soltarlo con inercia y frenarlo con suavidad, y eso no se
 * compone con una animación CSS. Aun así sólo se escribe `transform` (lo mueve
 * la GPU, sin reflujo) y el bucle se duerme cuando está quieto o fuera de
 * pantalla.
 *
 * El bucle: se pintan COPIAS veces las categorías. La copia #1 es la "real"
 * (accesible y enfocable); las demás son decorado (aria-hidden, sin tab). El
 * desplazamiento x vive en [W, 2W) —W = ancho de una copia— y al salirse se
 * corrige sumando o restando W: como las copias son idénticas, no se nota.
 */

const COPIAS = 5;
const REAL = 1;               // índice de la copia accesible
const VEL_RATON = 28;         // px/s de deriva en ordenador
const VEL_TACTIL = 22;        // px/s en móvil
const REANUDAR_MS = 2200;     // pausa tras tocarlo/deslizarlo antes de seguir
const UMBRAL_ARRASTRE = 6;    // px antes de considerar que es arrastre y no toque
const AUMENTO = 0.3;          // escala extra del icono destacado (1 → 1,3)

export default function CategoryCarousel({ categories, active, onSelect }) {
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const raton = useMediaQuery("(hover: hover) and (pointer: fine)");
  const quieto = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Todo el estado del movimiento va en una ref mutable: cambia 60 veces por
  // segundo y no debe provocar renders de React.
  const m = useRef({
    x: 0, W: 0, cw: 0, paso: 76, centros: [], items: [], listo: false,
    vel: 0,            // velocidad de deriva actual (se acerca a la deseada)
    inercia: 0,        // velocidad tras soltar un arrastre
    destino: null,     // x al que hay que llegar (centrar una categoría)
    arrastre: null,    // { id, x0, xUlt, tUlt, movido, vx, tipo }
    encima: false,     // ratón sobre el carrusel
    foco: false,       // foco de teclado dentro
    hastaT: 0,         // no reanudar la deriva antes de este instante
    activo: active,
    raton, quieto,
    visible: true,
    raf: 0, tPrev: 0, ultimaX: NaN,
    sinClick: false,
  });
  m.current.raton = raton;
  m.current.quieto = quieto;

  const n = categories.length;

  useEffect(() => {
    const s = m.current;
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    const ajustar = () => {
      if (!s.W || s.destino != null || s.foco) return;
      while (s.x < s.W) s.x += s.W;
      while (s.x >= 2 * s.W) s.x -= s.W;
    };

    const pintar = () => {
      if (s.x === s.ultimaX) return;
      s.ultimaX = s.x;
      track.style.transform = `translate3d(${(-s.x).toFixed(2)}px,0,0)`;
      // Lupa (sólo táctil): crece el que está cerca del centro.
      if (!s.raton) {
        const mitad = s.cw / 2, alcance = s.paso * 1.15;
        for (let i = 0; i < s.items.length; i++) {
          const d = Math.abs(s.centros[i] - s.x - mitad);
          let k = d >= alcance ? 0 : 1 - d / alcance;
          k = k * k * (3 - 2 * k); // suavizado
          const el = s.items[i];
          const prev = el._k ?? -1;
          if (Math.abs(prev - k) > 0.004) { el._k = k; el.style.setProperty("--k", k.toFixed(3)); }
        }
      }
    };

    const medir = () => {
      s.items = Array.from(track.children);
      s.centros = s.items.map(el => el.offsetLeft + el.offsetWidth / 2);
      s.cw = wrap.clientWidth;
      const W = s.items[n] ? s.items[n].offsetLeft - s.items[0].offsetLeft : 0;
      if (W <= 0) return;
      s.paso = W / n;
      if (!s.listo) {
        // Arranca con la copia real centrada.
        s.x = 1.5 * W - s.cw / 2;
        s.listo = true;
      }
      s.W = W;
      ajustar();
      s.ultimaX = NaN;
      pintar();
    };

    const deseada = (ahora) => {
      if (s.quieto || s.encima || s.foco || s.activo || s.arrastre || ahora < s.hastaT) return 0;
      return s.raton ? VEL_RATON : VEL_TACTIL;
    };

    const tick = (t) => {
      s.raf = 0;
      const dt = s.tPrev ? Math.min(0.05, (t - s.tPrev) / 1000) : 0;
      s.tPrev = t;
      const ahora = performance.now();

      if (!s.arrastre) {
        if (s.destino != null) {
          s.x += (s.destino - s.x) * (1 - Math.exp(-dt * 9));
          if (Math.abs(s.destino - s.x) < 0.3) { s.x = s.destino; s.destino = null; }
        } else if (s.inercia) {
          s.x += s.inercia * dt;
          s.inercia *= Math.exp(-dt * 3.4);
          if (Math.abs(s.inercia) < 8) s.inercia = 0;
        }
        const objetivo = deseada(ahora);
        // Arranca despacio y frena rápido: al pasar el cursor tiene que pararse ya.
        const tasa = objetivo > s.vel ? 1.4 : 8;
        s.vel += (objetivo - s.vel) * (1 - Math.exp(-dt * tasa));
        if (objetivo === 0 && s.vel < 0.05) s.vel = 0;
        s.x += s.vel * dt;
      }
      ajustar();
      pintar();

      const sigue = s.visible && (
        s.arrastre || s.destino != null || s.inercia || s.vel > 0 || deseada(ahora) > 0 || ahora < s.hastaT
      );
      if (sigue) s.raf = requestAnimationFrame(tick);
      else s.tPrev = 0;
    };

    s.despertar = () => {
      if (!s.raf && s.visible) { s.tPrev = 0; s.raf = requestAnimationFrame(tick); }
    };

    // Centra el elemento i (de cualquier copia). `exacto` = ese mismo nodo
    // (teclado); si no, la copia equivalente más cercana, para no dar media vuelta.
    s.centrar = (i, exacto) => {
      if (!s.W || i < 0) return;
      let d = s.centros[i] - s.cw / 2;
      if (!exacto) d += Math.round((s.x - d) / s.W) * s.W;
      s.destino = d; s.inercia = 0;
      s.despertar();
    };

    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      s.visible = e.isIntersecting;
      if (s.visible) s.despertar();
    });
    io.observe(wrap);

    // Trackpad: deslizar con dos dedos en horizontal mueve el carrusel (y no
    // dispara el "atrás" del navegador). El vertical se deja a la página.
    const rueda = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      s.x += e.deltaX; s.destino = null; s.inercia = 0;
      s.hastaT = performance.now() + REANUDAR_MS;
      s.despertar();
    };
    wrap.addEventListener("wheel", rueda, { passive: false });

    s.despertar();
    return () => {
      ro.disconnect(); io.disconnect();
      wrap.removeEventListener("wheel", rueda);
      cancelAnimationFrame(s.raf); s.raf = 0;
    };
  }, [n]);

  // Al cambiar a ratón/táctil se limpia la lupa (en ratón la pone el :hover).
  useEffect(() => {
    const s = m.current;
    s.ultimaX = NaN;
    if (raton) s.items.forEach(el => { el._k = 0; el.style.removeProperty("--k"); });
    s.despertar?.();
  }, [raton, quieto]);

  // Categoría elegida: quieto y con ella a la vista.
  useEffect(() => {
    const s = m.current;
    s.activo = active;
    if (active) {
      const i = REAL * n + categories.findIndex(c => c.slug === active);
      // En táctil siempre al centro (la lupa la destaca). Con ratón sólo si
      // quedó medio tapada por el borde difuminado: moverla bajo el cursor
      // desorienta.
      const fuera = Math.abs(s.centros[i] - s.x - s.cw / 2) > s.cw / 2 - s.paso;
      if (!s.raton || fuera) s.centrar?.(i, false);
    } else {
      s.hastaT = Math.max(s.hastaT, performance.now() + (s.raton ? 0 : 1200));
    }
    s.despertar?.();
  }, [active, n, categories]);

  // ── Punteros ────────────────────────────────────────────────────────────
  const onPointerEnter = (e) => {
    if (e.pointerType !== "mouse") return;
    m.current.encima = true; m.current.despertar?.();
  };
  const onPointerLeave = (e) => {
    if (e.pointerType !== "mouse") return;
    m.current.encima = false; m.current.despertar?.();
  };
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = m.current;
    s.arrastre = { id: e.pointerId, x0: e.clientX, xUlt: e.clientX, tUlt: e.timeStamp, movido: false, vx: 0, tipo: e.pointerType };
    s.destino = null; s.inercia = 0;
    if (e.pointerType !== "mouse") s.vel = 0; // el dedo lo atrapa en seco
    s.despertar?.();
  };
  const onPointerMove = (e) => {
    const s = m.current, a = s.arrastre;
    if (!a || a.id !== e.pointerId) return;
    if (!a.movido) {
      if (Math.abs(e.clientX - a.x0) < UMBRAL_ARRASTRE) return;
      a.movido = true;
      // La captura sólo al arrastrar: capturar en el pointerdown mandaría el
      // click al contenedor y los toques dejarían de elegir categoría.
      try { wrapRef.current.setPointerCapture(e.pointerId); } catch {}
    }
    const dx = e.clientX - a.xUlt;
    const dtm = Math.max(1, e.timeStamp - a.tUlt);
    a.vx = 0.75 * (-dx / dtm * 1000) + 0.25 * a.vx;
    a.xUlt = e.clientX; a.tUlt = e.timeStamp;
    s.x -= dx;
    s.despertar?.();
  };
  const soltar = (e, cancelado) => {
    const s = m.current, a = s.arrastre;
    if (!a || a.id !== e.pointerId) return;
    s.arrastre = null;
    if (a.movido) {
      // Si el dedo se quedó quieto antes de soltar, no hay lanzamiento.
      const parado = e.timeStamp - a.tUlt > 80;
      if (!cancelado && !parado) s.inercia = Math.max(-2600, Math.min(2600, a.vx));
      s.sinClick = true;
      setTimeout(() => { s.sinClick = false; }, 0);
    }
    if (a.tipo !== "mouse") s.hastaT = performance.now() + REANUDAR_MS;
    s.despertar?.();
  };
  const onClickCapture = (e) => {
    if (m.current.sinClick) { e.preventDefault(); e.stopPropagation(); m.current.sinClick = false; }
  };

  // Foco de teclado: se para y trae la categoría enfocada a la vista.
  const onFocus = (e) => {
    const el = e.target;
    if (!el.matches?.(":focus-visible")) return;
    const s = m.current;
    s.foco = true;
    s.centrar(s.items.indexOf(el), true);
  };
  const onBlur = (e) => {
    if (wrapRef.current?.contains(e.relatedTarget)) return;
    m.current.foco = false;
    m.current.despertar?.();
  };

  const copias = Array.from({ length: COPIAS }, (_, c) => c);

  return (
    <div
      ref={wrapRef}
      className={"ef-carrusel" + (raton ? "" : " ef-carrusel--lupa")}
      role="group"
      aria-label="Categorías"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => soltar(e, false)}
      onPointerCancel={(e) => soltar(e, true)}
      onClickCapture={onClickCapture}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div ref={trackRef} className="ef-carrusel-track">
        {copias.map(c => categories.map(cat => {
          const real = c === REAL;
          const sel = active === cat.slug;
          return (
            <button
              key={c + "-" + cat.slug}
              type="button"
              className={"ef-cat" + (sel ? " ef-cat--sel" : "") + (active && !sel ? " ef-cat--dim" : "")}
              onClick={() => onSelect(cat.slug)}
              title={real ? cat.label : undefined}
              aria-pressed={real ? sel : undefined}
              aria-hidden={real ? undefined : true}
              tabIndex={real ? 0 : -1}
              style={{ "--halo": categoryRgba(cat.slug, 0.55) }}
            >
              <span className="ef-cat-ico">
                <CategoryIcon slug={cat.slug} size={56} round />
              </span>
              <span className="ef-cat-txt">{cat.short || cat.label}</span>
            </button>
          );
        }))}
      </div>

      <style>{`
        /* Sale del margen del hero para que el bucle llegue a los bordes, que
           se difuminan con una máscara (no se ve dónde se corta). */
        .ef-carrusel {
          position: relative; overflow: hidden;
          margin: 22px -24px 0; padding: 20px 0 8px;
          touch-action: pan-y;            /* el vertical sigue siendo de la página */
          user-select: none; -webkit-user-select: none;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16%, #000 84%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0, #000 16%, #000 84%, transparent 100%);
        }
        @media (min-width: 900px) {
          .ef-carrusel { width: 780px; margin-left: calc(50% - 390px); margin-right: 0; }
        }
        .ef-carrusel-track { position: relative; display: flex; width: max-content; will-change: transform; }

        .ef-cat {
          --k: 0;
          flex: 0 0 78px; display: flex; flex-direction: column; align-items: center; gap: 9px;
          padding: 2px 0; margin: 0; background: transparent; border: none; cursor: pointer;
          font: inherit; color: inherit; -webkit-tap-highlight-color: transparent;
          transition: opacity .2s;
        }
        @media (min-width: 900px) { .ef-cat { flex-basis: 90px; } }
        .ef-cat:focus { outline: none; }

        .ef-cat-ico {
          position: relative; display: block; border-radius: 50%;
          transform: scale(calc(1 + var(--k) * ${AUMENTO}));
          transition: transform .32s cubic-bezier(.2,.8,.2,1);
        }
        /* Halo del color de la categoría, sólo en el destacado. */
        .ef-cat-ico::before {
          content: ""; position: absolute; inset: -10px; border-radius: 50%; z-index: -1;
          background: radial-gradient(circle, var(--halo) 0%, transparent 68%);
          opacity: calc(var(--k) * .8); transition: opacity .32s;
        }
        .ef-cat-ico > span { transition: outline-color .15s; outline: 2px solid transparent; outline-offset: 3px; }
        .ef-cat--sel .ef-cat-ico > span { outline-color: #ffffff; }
        .ef-cat:focus-visible .ef-cat-ico > span { outline-color: rgba(255,255,255,.7); }

        .ef-cat-txt {
          font-size: 12px; line-height: 1.2; white-space: nowrap; font-weight: 500;
          color: #ffffff; opacity: calc(.66 + var(--k) * .34);
          transform: translateY(calc(var(--k) * 8px));
          transition: transform .32s cubic-bezier(.2,.8,.2,1), opacity .2s;
        }
        .ef-cat--sel .ef-cat-txt { font-weight: 600; opacity: 1; }
        .ef-cat--dim { opacity: .42; }

        /* Ratón: el que está bajo el cursor crece (el carrusel ya se paró). */
        @media (hover: hover) and (pointer: fine) {
          .ef-cat:hover { --k: 1; opacity: 1; }
        }
        /* Táctil: la lupa la mueve el bucle fotograma a fotograma; con
           transición iría siempre por detrás del dedo. */
        .ef-carrusel--lupa .ef-cat-ico,
        .ef-carrusel--lupa .ef-cat-ico::before,
        .ef-carrusel--lupa .ef-cat-txt { transition: none; }
      `}</style>
    </div>
  );
}
