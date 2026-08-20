import { useEffect, useId, useMemo, useState } from "react";
import { POSTERS, POSTER_RATIO, POSTER_VIEWBOX } from "../lib/eventPosters.jsx";

/**
 * Cinta de pósters en movimiento para la portada.
 *
 * Varias filas que se desplazan en sentidos alternos y a distinta velocidad:
 * el desfase es lo que da profundidad; si fueran iguales parecería una sola
 * imagen arrastrándose.
 *
 * El bucle es CSS puro (no requestAnimationFrame como la cinta de Descubrir):
 * cada fila pinta su lista DOS veces y la anima hasta -50%, que es exactamente
 * el ancho de UNA copia. El último fotograma es idéntico al primero, así que el
 * salto no se ve. Al ser transform, lo compone la GPU sin repintar, que es lo
 * que permite tener decenas de pósters moviéndose sin gastar batería.
 *
 * Es decoración: aria-hidden y sin foco, para que un lector de pantalla salte
 * directo al titular y a los botones.
 */

// Cuánto más que la ventana tiene que cubrir la pila. De más porque va girada:
// al rotar, las esquinas se salen y quedarían franjas de fondo a la vista.
const HOLGURA_X = 1.5;
const HOLGURA_Y = 1.3;

// Velocidad de deriva, en píxeles por segundo. La duración de cada fila se
// calcula a partir de aquí y de su ancho real: si se fijara la duración, las
// filas anchas correrían más que las estrechas.
const VELOCIDADES = [22, 30, 17, 26, 20, 33, 24];

function medidas(ancho) {
  if (ancho >= 1000) return { card: 196, gap: 18 };
  if (ancho >= 620)  return { card: 168, gap: 16 };
  return { card: 128, gap: 12 };
}

/** Cuántas filas y cuántos pósters por fila hacen falta para tapar la ventana. */
function rejillaPara(ancho, alto) {
  const { card, gap } = medidas(ancho);
  const altoCard = card / POSTER_RATIO;
  return {
    card,
    gap,
    filas:   Math.max(3, Math.ceil((alto  * HOLGURA_Y) / (altoCard + gap))),
    // +1 para que nunca se vea el corte entre la última tarjeta y la copia.
    porFila: Math.max(5, Math.ceil((ancho * HOLGURA_X) / (card + gap)) + 1),
  };
}

/**
 * Barajado determinista: cada fila necesita un ORDEN distinto para que no se
 * repita el mismo póster en vertical, pero tiene que salir igual en cada carga
 * (con Math.random cambiaría en cada render de React).
 */
function baraja(lista, semilla) {
  const a = [...lista];
  let s = semilla * 9301 + 49297;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Un póster. El `g(nombre)` que recibe `render` construye IDs únicos para los
 * <defs> del SVG: la cinta pinta cada lista dos veces y, sin prefijo, los
 * degradados de una copia pisarían los de la otra.
 */
function EventPoster({ poster }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = (nombre) => `p-${poster.id}-${raw}-${nombre}`;
  return (
    <svg
      viewBox={POSTER_VIEWBOX}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {poster.render(g)}
    </svg>
  );
}

export default function PosterMarquee() {
  const [rej, setRej] = useState(() => rejillaPara(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const alRedimensionar = () => {
      const siguiente = rejillaPara(window.innerWidth, window.innerHeight);
      setRej((prev) =>
        prev.card === siguiente.card && prev.filas === siguiente.filas && prev.porFila === siguiente.porFila
          ? prev
          : siguiente
      );
    };
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);

  const { card, gap, filas, porFila } = rej;
  const altoCard = card / POSTER_RATIO;

  const rows = useMemo(
    () =>
      Array.from({ length: filas }, (_, i) => {
        const orden = baraja(POSTERS, i + 1);
        const anchoCopia = porFila * (card + gap);
        return {
          posters: Array.from({ length: porFila }, (_, j) => orden[j % orden.length]),
          duracion: anchoCopia / VELOCIDADES[i % VELOCIDADES.length],
          reversa: i % 2 === 1,
          retraso: -i * 13,
        };
      }),
    [filas, porFila, card, gap]
  );

  return (
    <div className="tapin-mq" aria-hidden="true">
      <div className="tapin-mq-stack" style={{ gap }}>
        {rows.map((fila, i) => (
          <div className="tapin-mq-row" key={i}>
            <div
              className="tapin-mq-track"
              style={{
                gap,
                animationDuration: `${fila.duracion.toFixed(1)}s`,
                animationDirection: fila.reversa ? "reverse" : "normal",
                animationDelay: `${fila.retraso}s`,
              }}
            >
              {/* Dos copias: la segunda es la que hace invisible el salto. */}
              {[...fila.posters, ...fila.posters].map((p, j) => (
                <div
                  className="tapin-mq-card"
                  key={`${p.id}-${j}`}
                  style={{ flexBasis: card, width: card, height: altoCard }}
                >
                  <EventPoster poster={p} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Velo: apaga el centro para que el titular se lea sobre los pósters y
          difumina arriba y abajo contra el navy de la app, de modo que el
          borde de la pila no se note. */}
      <div className="tapin-mq-veil" />

      <style>{`
        .tapin-mq {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        /* La inclinación evita la retícula perfecta; el ancho de sobra tapa las
           esquinas que el giro deja al aire. */
        .tapin-mq-stack {
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${Math.round(HOLGURA_X * 100)}%;
          transform: translate(-50%, -50%) rotate(-4deg);
          display: flex;
          flex-direction: column;
          opacity: 0.92;
        }
        .tapin-mq-row { overflow: hidden; }
        .tapin-mq-track {
          display: flex;
          width: max-content;
          animation-name: tapin-mq-drift;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .tapin-mq-card {
          flex-grow: 0;
          flex-shrink: 0;
          border-radius: 18px;
          overflow: hidden;
          background: #0c1024;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 18px 40px rgba(0,0,0,0.45);
          contain: paint;
        }
        @keyframes tapin-mq-drift {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }

        .tapin-mq-veil {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(74% 54% at 50% 50%,
              rgba(9,12,26,0.95) 0%,
              rgba(9,12,26,0.86) 42%,
              rgba(9,12,26,0.42) 72%,
              rgba(9,12,26,0.06) 100%),
            linear-gradient(180deg,
              rgba(15,18,38,0.9) 0%,
              rgba(15,18,38,0.08) 20%,
              rgba(15,18,38,0.08) 80%,
              rgba(15,18,38,0.94) 100%);
        }

        /* Quien pide menos movimiento ve el mismo muestrario, quieto. */
        @media (prefers-reduced-motion: reduce) {
          .tapin-mq-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
