/* eslint-disable react-refresh/only-export-components --
   Este módulo es una TABLA DE DATOS, no un archivo de componentes: exporta el
   muestrario y unas medidas. Bg/Small/Title son fábricas de marcado internas
   (no se exportan), pero la regla las cuenta como componentes por empezar en
   mayúscula. Editar este archivo debe recargar la página entera, que es justo
   lo que ya hace. */

/**
 * Pósters de ideas de evento — el "muestrario" de la portada.
 *
 * Son SVG y no imágenes a propósito: pesan bytes en vez de kilobytes, se ven
 * nítidos en cualquier pantalla (la cinta los escala) y no hay que subir nada
 * a Cloudinary ni pedir una request más al abrir la app. Cada póster es una
 * mini-portada de flyer: fondo, un motivo gráfico y tipografía grande.
 *
 * Cada uno recibe `g(nombre)` para construir IDs únicos de <defs>: la cinta
 * pinta la lista DOS veces y, sin eso, los degradados se pisarían entre copias.
 */

const W = 300;
const H = 340;

const DIRS = {
  diag: { x1: "0", y1: "0", x2: "1", y2: "1" },
  down: { x1: "0", y1: "0", x2: "0", y2: "1" },
  side: { x1: "0", y1: "0", x2: "1", y2: "0" },
  up:   { x1: "0", y1: "1", x2: "1", y2: "0" },
};

/** Fondo en degradado a sangre. */
function Bg({ id, from, to, dir = "diag" }) {
  return (
    <>
      <defs>
        <linearGradient id={id} {...DIRS[dir]}>
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

/** Texto pequeño en versalitas: el "kicker" y el pie del flyer. */
function Small({ x, y, children, fill, size = 11, anchor = "start", weight = 700 }) {
  return (
    <text
      x={x} y={y} fill={fill} fontSize={size} fontWeight={weight}
      letterSpacing="1.8" textAnchor={anchor}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {children}
    </text>
  );
}

/** Titular del flyer: una línea por elemento del array. */
function Title({ lines, x = 26, y, fill, size = 34, weight = 900, lh = 34, anchor = "start", letter = "-0.8", italic = false }) {
  return lines.map((t, i) => (
    <text
      key={i} x={x} y={y + i * lh} fill={fill} fontSize={size} fontWeight={weight}
      letterSpacing={letter} textAnchor={anchor}
      fontStyle={italic ? "italic" : "normal"}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {t}
    </text>
  ));
}

/* ────────────────────────────────────────────────────────────────────────────
   El muestrario. Orden pensado para que la cinta alterne color y densidad y
   no queden dos pósters parecidos pegados.
   ──────────────────────────────────────────────────────────────────────── */

export const POSTERS = [
  // 1 · Festival — atardecer, montañas y público.
  {
    id: "festival",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ff9d4d" to="#e0417c" dir="down" />
        <circle cx="150" cy="150" r="58" fill="#fff3c4" opacity="0.95" />
        <path d="M0 214 L74 148 L124 196 L186 132 L300 226 L300 340 L0 340 Z" fill="#7a1f4e" opacity="0.55" />
        <path d="M0 248 L62 196 L132 246 L206 188 L300 258 L300 340 L0 340 Z" fill="#4b1236" opacity="0.75" />
        <g fill="#2a0a20" opacity="0.85">
          {[24, 52, 78, 108, 140, 172, 202, 236, 266].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={296 - (i % 3) * 5} r="7" />
              <rect x={x - 8} y={302 - (i % 3) * 5} width="16" height="40" rx="7" />
            </g>
          ))}
        </g>
        <Small x={26} y={44} fill="rgba(255,255,255,0.9)">3 DÍAS · AL AIRE LIBRE</Small>
        <Title lines={["FESTIVAL"]} y={92} fill="#fff" size={38} />
        <Title lines={["DE MÚSICA"]} y={124} fill="rgba(255,255,255,0.92)" size={26} weight={500} letter="0.2" />
      </>
    ),
  },

  // 2 · Fiesta nocturna — ecualizador.
  {
    id: "dj",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#2b1055" to="#7b1f8f" dir="diag" />
        <defs>
          <radialGradient id={g("glow")} cx="0.5" cy="0.32" r="0.55">
            <stop offset="0" stopColor="#ff5ec7" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ff5ec7" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${g("glow")})`} />
        <g fill="#ffd6f5">
          {[12, 40, 30, 62, 44, 82, 56, 96, 48, 70, 34, 54].map((h, i) => (
            <rect key={i} x={22 + i * 22} y={252 - h} width="12" height={h + 22} rx="6" opacity={0.55 + (i % 4) * 0.14} />
          ))}
        </g>
        <circle cx="228" cy="86" r="34" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <circle cx="228" cy="86" r="10" fill="#fff" opacity="0.9" />
        <Small x={26} y={46} fill="rgba(255,255,255,0.82)">DJ SET · 10 PM</Small>
        <Title lines={["NOCHE", "ELÉCTRICA"]} y={112} fill="#fff" size={31} lh={31} />
        <Small x={26} y={308} fill="rgba(255,255,255,0.75)" size={10.5}>ENTRADA CON QR</Small>
      </>
    ),
  },

  // 3 · Cena entre amigos — plato servido, sobremesa.
  {
    id: "cena",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#20402f" to="#0e2318" dir="down" />
        <circle cx="150" cy="196" r="76" fill="#f2ead6" />
        <circle cx="150" cy="196" r="58" fill="none" stroke="#cbbb98" strokeWidth="2" />
        <g fill="#c1663f">
          <circle cx="128" cy="182" r="13" />
          <circle cx="168" cy="192" r="17" />
          <circle cx="142" cy="216" r="11" />
        </g>
        <g fill="#4f7a45">
          <ellipse cx="172" cy="170" rx="13" ry="7" transform="rotate(-24 172 170)" />
          <ellipse cx="122" cy="212" rx="11" ry="6" transform="rotate(18 122 212)" />
        </g>
        <g stroke="#e8dcc2" strokeWidth="3.5" strokeLinecap="round">
          <path d="M52 152 V240" />
          <path d="M52 152 M44 152 V178 M60 152 V178" />
          <path d="M248 158 V240" />
        </g>
        <path d="M240 158 q8 -18 16 0 q0 20 -8 22 q-8 -2 -8 -22" fill="#e8dcc2" />
        <Small x={26} y={46} fill="rgba(242,234,214,0.75)">MESA PARA 12</Small>
        <Title lines={["CENA", "ENTRE AMIGOS"]} y={94} fill="#f2ead6" size={25} lh={28} letter="-0.3" />
      </>
    ),
  },

  // 4 · Club de running.
  {
    id: "running",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#c9f24a" to="#3fa93a" dir="diag" />
        <circle cx="232" cy="76" r="42" fill="#fffbe0" opacity="0.85" />
        <g fill="none" stroke="#1c4a1a" strokeWidth="3" opacity="0.35">
          <path d="M-20 250 C 60 210, 120 300, 200 250 S 320 210, 340 246" />
          <path d="M-20 276 C 60 236, 120 326, 200 276 S 320 236, 340 272" />
        </g>
        <path d="M-10 300 C 70 262, 130 348, 210 300 S 320 264, 340 298" fill="none" stroke="#0f3a10" strokeWidth="16" strokeLinecap="round" opacity="0.55" />
        <g fill="#0f3a10" opacity="0.8">
          {[40, 96, 152, 208, 262].map((x, i) => (
            <ellipse key={x} cx={x} cy={262 + (i % 2) * 16} rx="9" ry="13" transform={`rotate(${i % 2 ? 16 : -14} ${x} ${262 + (i % 2) * 16})`} />
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(16,50,16,0.7)">TODOS LOS MARTES</Small>
        <Title lines={["CLUB DE", "RUNNING"]} y={104} fill="#12380f" size={35} lh={34} />
        <Small x={26} y={168} fill="rgba(16,50,16,0.8)" size={13} weight={800}>5K · 7K · 10K</Small>
      </>
    ),
  },

  // 5 · Cumpleaños — globos y confeti.
  {
    id: "cumple",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ffd9e5" to="#ff8fb1" dir="down" />
        <g>
          {[
            { x: 70, y: 128, r: 30, c: "#ff5c8a" },
            { x: 150, y: 104, r: 38, c: "#ffb03b" },
            { x: 230, y: 132, r: 27, c: "#7c6bff" },
          ].map((b) => (
            <g key={b.x}>
              <path d={`M${b.x} ${b.y + b.r} Q ${b.x + 10} ${b.y + b.r + 40} ${b.x - 4} ${b.y + b.r + 82}`} fill="none" stroke="rgba(90,30,60,0.35)" strokeWidth="1.6" />
              <ellipse cx={b.x} cy={b.y} rx={b.r} ry={b.r * 1.16} fill={b.c} />
              <ellipse cx={b.x - b.r * 0.32} cy={b.y - b.r * 0.34} rx={b.r * 0.24} ry={b.r * 0.34} fill="rgba(255,255,255,0.5)" transform={`rotate(-24 ${b.x - b.r * 0.32} ${b.y - b.r * 0.34})`} />
            </g>
          ))}
        </g>
        <g opacity="0.85">
          {[[34, 62, "#7c6bff"], [268, 84, "#ff5c8a"], [46, 232, "#ffb03b"], [262, 220, "#5ecfff"], [196, 60, "#5ecfff"], [110, 246, "#7c6bff"]].map(([x, y, c], i) => (
            <rect key={i} x={x} y={y} width="9" height="16" rx="3" fill={c} transform={`rotate(${i * 47} ${x} ${y})`} />
          ))}
        </g>
        <Title lines={["¡FELIZ", "CUMPLE!"]} y={262} fill="#6a1234" size={36} lh={34} />
        <Small x={26} y={320} fill="rgba(106,18,52,0.72)" size={10.5}>INVITA A TODA LA GENTE</Small>
      </>
    ),
  },

  // 6 · Networking — red de nodos.
  {
    id: "networking",
    render: (g) => {
      const nodes = [[62, 214], [128, 176], [196, 220], [246, 162], [96, 268], [178, 288], [166, 146]];
      const links = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 2], [1, 6], [6, 3]];
      return (
        <>
          <Bg id={g("bg")} from="#173a63" to="#0a1830" dir="diag" />
          <g stroke="#7fb3e6" strokeWidth="1.6" opacity="0.55">
            {links.map(([a, b], i) => (
              <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
            ))}
          </g>
          {nodes.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={i % 3 === 0 ? 15 : 10} fill="#7fb3e6" opacity="0.22" />
              <circle cx={x} cy={y} r={i % 3 === 0 ? 9 : 6} fill="#bfd9f2" />
            </g>
          ))}
          <Small x={26} y={46} fill="rgba(191,217,242,0.75)">AFTER OFFICE</Small>
          <Title lines={["NETWORKING"]} y={92} fill="#eef1f7" size={27} letter="-0.2" />
          <Title lines={["que sí conecta"]} y={122} fill="#7fb3e6" size={21} weight={400} letter="0" italic />
        </>
      );
    },
  },

  // 7 · Taller creativo — brochazo.
  {
    id: "taller",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#f0e3d2" to="#dcc3a6" dir="down" />
        <path d="M-10 210 C 60 172, 110 250, 176 206 S 290 168, 320 200 L320 262 C 280 236, 220 300, 156 262 S 40 240, -10 268 Z" fill="#d1502f" />
        <path d="M-10 250 C 70 226, 120 292, 186 254 S 296 226, 320 250 L320 300 C 270 282, 210 330, 140 300 S 30 296, -10 312 Z" fill="#2f4858" opacity="0.9" />
        <g fill="none" stroke="#2f4858" strokeWidth="3">
          <circle cx="238" cy="92" r="26" />
          <rect x="42" y="70" width="46" height="46" rx="6" transform="rotate(-12 65 93)" />
          <path d="M132 118 L156 72 L180 118 Z" />
        </g>
        <Small x={26} y={172} fill="rgba(47,72,88,0.72)">CUPOS LIMITADOS</Small>
        <Title lines={["TALLER"]} y={284} fill="#f3e7d7" size={38} />
        <Small x={26} y={312} fill="rgba(243,231,215,0.92)" size={13} weight={800}>CREATIVO</Small>
      </>
    ),
  },

  // 8 · Yoga al amanecer.
  {
    id: "yoga",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#d8e8b4" to="#3f6b3a" dir="down" />
        <circle cx="150" cy="98" r="46" fill="#fff8d8" opacity="0.55" />
        <circle cx="150" cy="150" r="70" fill="none" stroke="#fdf6e0" strokeWidth="3" opacity="0.95" />
        <circle cx="150" cy="150" r="52" fill="#f6f1e2" opacity="0.35" />
        <g fill="#1d3220">
          <circle cx="150" cy="126" r="14" />
          <path d="M150 144 c -16 0 -26 16 -26 32 l 52 0 c 0 -16 -10 -32 -26 -32 Z" />
          <path d="M118 194 q32 -14 64 0 q -6 12 -32 12 q -26 0 -32 -12 Z" />
          <path d="M112 176 q -16 4 -18 18 q 14 2 20 -8 Z" />
          <path d="M188 176 q 16 4 18 18 q -14 2 -20 -8 Z" />
        </g>
        <g stroke="#2f4230" strokeWidth="2" opacity="0.4">
          <path d="M40 250 q26 -22 52 0" fill="none" />
          <path d="M208 250 q26 -22 52 0" fill="none" />
        </g>
        <Small x={150} y={46} anchor="middle" fill="rgba(47,66,48,0.7)">SÁBADOS 6:30 AM</Small>
        <Title lines={["YOGA"]} x={150} y={292} anchor="middle" fill="#28381f" size={36} />
        <Small x={150} y={316} anchor="middle" fill="rgba(40,56,31,0.78)" size={12}>AL AMANECER</Small>
      </>
    ),
  },

  // 9 · Cine al aire libre.
  {
    id: "cine",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#101a3d" to="#050a1c" dir="down" />
        <g fill="#fff">
          {[[38, 44, 1.6], [92, 76, 1], [212, 38, 1.3], [268, 92, 1.8], [154, 58, 1], [246, 148, 1.2], [58, 122, 1]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={0.55 + (i % 3) * 0.15} />
          ))}
        </g>
        <circle cx="252" cy="66" r="20" fill="#f4f0d8" />
        <circle cx="243" cy="60" r="18" fill="#0b1230" />
        <defs>
          <linearGradient id={g("beam")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eaf3ff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#8fb8ff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect x="42" y="128" width="216" height="122" rx="6" fill={`url(#${g("beam")})`} />
        <rect x="42" y="128" width="216" height="122" rx="6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
        <path d="M126 164 L176 190 L126 216 Z" fill="#101a3d" opacity="0.55" />
        <g fill="#0a1024" opacity="0.9">
          {[70, 108, 150, 194, 234].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={288 + (i % 2) * 6} r="10" />
              <rect x={x - 13} y={296 + (i % 2) * 6} width="26" height="46" rx="10" />
            </g>
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(234,243,255,0.75)">TRAE TU MANTA</Small>
        <Title lines={["CINE"]} y={94} fill="#fff" size={34} />
        <Small x={26} y={112} fill="#8fb8ff" size={12} weight={800}>AL AIRE LIBRE</Small>
      </>
    ),
  },

  // 10 · Boda — arco y anillos.
  {
    id: "boda",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#fbf4e9" to="#e8d3b8" dir="down" />
        <path d="M84 250 V162 a66 66 0 0 1 132 0 V250" fill="none" stroke="#b08d57" strokeWidth="2.5" />
        <g fill="#c96a7a" opacity="0.9">
          {[[96, 116], [122, 88], [156, 78], [190, 90], [212, 118], [88, 158], [214, 156]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="7" />
              <circle cx={x - 8} cy={y + 6} r="5" fill="#e79aa4" />
              <circle cx={x + 8} cy={y + 6} r="5" fill="#e79aa4" />
            </g>
          ))}
        </g>
        <g fill="#6d8b5a" opacity="0.75">
          {[[110, 140], [186, 136], [140, 96], [172, 108]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="11" ry="5" transform={`rotate(${i * 40 - 30} ${x} ${y})`} />
          ))}
        </g>
        <g fill="none" stroke="#b08d57" strokeWidth="4">
          <circle cx="138" cy="212" r="20" />
          <circle cx="166" cy="212" r="20" />
        </g>
        <Title lines={["NOS CASAMOS"]} x={150} y={288} anchor="middle" fill="#7a5a33" size={23} weight={600} letter="1.4" />
        <Small x={150} y={312} anchor="middle" fill="rgba(122,90,51,0.72)">CONFIRMA TU ASISTENCIA</Small>
      </>
    ),
  },

  // 11 · Torneo gamer — píxeles.
  {
    id: "gamer",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#1b1140" to="#3a0f5c" dir="diag" />
        <g fill="#00e5ff" opacity="0.16">
          {Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 8 }, (_, c) => (
              <rect key={`${r}-${c}`} x={c * 38 + 4} y={r * 38 + 4} width="30" height="30" rx="3" opacity={(r + c) % 3 === 0 ? 1 : 0.35} />
            ))
          )}
        </g>
        <g transform="translate(150 200)">
          <rect x="-62" y="-30" width="124" height="60" rx="26" fill="#00e5ff" />
          <rect x="-48" y="-8" width="26" height="7" rx="3.5" fill="#1b1140" />
          <rect x="-38.5" y="-17.5" width="7" height="26" rx="3.5" fill="#1b1140" />
          <circle cx="34" cy="-8" r="6.5" fill="#1b1140" />
          <circle cx="18" cy="7" r="6.5" fill="#1b1140" />
        </g>
        <Small x={26} y={46} fill="rgba(0,229,255,0.85)">1 VS 1 · ELIMINACIÓN</Small>
        <Title lines={["TORNEO"]} y={96} fill="#fff" size={36} />
        <Title lines={["GAMER"]} y={128} fill="#00e5ff" size={36} />
        <Small x={26} y={306} fill="rgba(255,255,255,0.7)" size={10.5}>32 JUGADORES</Small>
      </>
    ),
  },

  // 12 · Brunch dominical.
  {
    id: "brunch",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ffe9c9" to="#ffb27a" dir="down" />
        <circle cx="150" cy="182" r="72" fill="#fffaf0" />
        <ellipse cx="140" cy="176" rx="34" ry="26" fill="#fff" />
        <circle cx="140" cy="176" r="15" fill="#ffb703" />
        <g transform="translate(196 202)">
          <path d="M-26 -18 h44 v26 a22 22 0 0 1 -44 0 Z" fill="#8c4b23" />
          <path d="M18 -12 h10 a11 11 0 0 1 0 22 h-10" fill="none" stroke="#8c4b23" strokeWidth="5" />
          <rect x="-30" y="10" width="52" height="6" rx="3" fill="#5f3116" />
        </g>
        <g stroke="#c96a2b" strokeWidth="3" strokeLinecap="round" opacity="0.7">
          <path d="M104 128 q6 -12 0 -22" fill="none" />
          <path d="M120 124 q6 -12 0 -22" fill="none" />
        </g>
        <Small x={26} y={46} fill="rgba(140,75,35,0.78)">DOMINGO · 11 AM</Small>
        <Title lines={["BRUNCH"]} y={96} fill="#7a3a12" size={37} />
        <Small x={26} y={306} fill="rgba(122,58,18,0.72)">MIMOSAS INCLUIDAS</Small>
      </>
    ),
  },

  // 13 · Mercado de diseño — toldo.
  {
    id: "mercado",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ffd45e" to="#e88b22" dir="down" />
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M${i * 50} 128 h50 v34 a25 17 0 0 1 -50 0 Z`} fill={i % 2 ? "#fff6e0" : "#c94f2c"} />
          ))}
        </g>
        <rect x="0" y="118" width={W} height="12" fill="#7a2f18" />
        <g fill="#7a2f18" opacity="0.9">
          <rect x="52" y="222" width="60" height="46" rx="6" />
          <rect x="124" y="206" width="52" height="62" rx="6" />
          <rect x="188" y="230" width="62" height="38" rx="6" />
          <rect x="30" y="268" width="240" height="10" rx="5" />
        </g>
        <g fill="#ffd45e">
          <circle cx="82" cy="240" r="9" />
          <circle cx="150" cy="230" r="9" />
          <circle cx="219" cy="246" r="9" />
        </g>
        <Small x={26} y={46} fill="rgba(122,47,24,0.8)">40 MARCAS LOCALES</Small>
        <Title lines={["MERCADO"]} y={96} fill="#7a2f18" size={31} />
        <Small x={26} y={306} fill="rgba(122,47,24,0.85)" size={12} weight={800}>DE DISEÑO INDEPENDIENTE</Small>
      </>
    ),
  },

  // 14 · Conferencia — escenario y público.
  {
    id: "conferencia",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#1e2a52" to="#0c1226" dir="down" />
        <defs>
          <linearGradient id={g("spot")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fb3e6" stopOpacity="0.55" />
            <stop offset="1" stopColor="#7fb3e6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M150 96 L246 262 H54 Z" fill={`url(#${g("spot")})`} />
        <g fill="#eef1f7">
          <circle cx="150" cy="184" r="13" />
          <path d="M150 200 c -17 0 -28 18 -28 38 h56 c 0 -20 -11 -38 -28 -38 Z" />
        </g>
        <g stroke="#7fb3e6" strokeWidth="3" strokeLinecap="round">
          <path d="M186 200 v26" />
        </g>
        <circle cx="186" cy="192" r="8" fill="#7fb3e6" />
        <rect x="40" y="262" width="220" height="8" rx="4" fill="#7fb3e6" opacity="0.5" />
        <g fill="#050a18">
          {[52, 96, 140, 186, 232].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={300 + (i % 2) * 5} r="11" />
              <rect x={x - 15} y={310 + (i % 2) * 5} width="30" height="34" rx="12" />
            </g>
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(127,179,230,0.85)">8 CHARLAS · 1 DÍA</Small>
        <Title lines={["CONFERENCIA"]} y={88} fill="#fff" size={25} letter="-0.2" />
      </>
    ),
  },

  // 15 · Karaoke.
  {
    id: "karaoke",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ff2e88" to="#5b1a9e" dir="up" />
        <g transform="translate(214 168) rotate(24)">
          <rect x="-14" y="-72" width="28" height="76" rx="14" fill="#f6f2ff" />
          <rect x="-8" y="-64" width="16" height="10" rx="5" fill="#5b1a9e" opacity="0.45" />
          <rect x="-8" y="-46" width="16" height="10" rx="5" fill="#5b1a9e" opacity="0.45" />
          <rect x="-6" y="4" width="12" height="52" rx="6" fill="#d9cfea" />
          <rect x="-16" y="54" width="32" height="10" rx="5" fill="#b9abd0" />
        </g>
        <g fill="#ffe6f4">
          {[[46, 128, 1], [84, 96, 0.8], [56, 224, 0.9]].map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
              <ellipse cx="0" cy="26" rx="12" ry="9" transform="rotate(-18 0 26)" />
              <rect x="8" y="-24" width="4.5" height="50" rx="2" />
              <path d="M12.5 -24 q20 4 20 18 q-8 -8 -20 -6 Z" />
            </g>
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(255,255,255,0.85)">SIN VERGÜENZA</Small>
        <Title lines={["NOCHE DE", "KARAOKE"]} y={278} fill="#fff" size={30} lh={31} />
      </>
    ),
  },

  // 16 · Fiesta en la terraza — skyline y bombillos.
  {
    id: "terraza",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#2b3f8f" to="#0b1030" dir="down" />
        <circle cx="66" cy="82" r="24" fill="#ffe9a8" opacity="0.9" />
        <g fill="#111a44">
          <rect x="8" y="200" width="52" height="140" />
          <rect x="70" y="164" width="42" height="176" />
          <rect x="122" y="216" width="58" height="124" />
          <rect x="190" y="150" width="46" height="190" />
          <rect x="246" y="196" width="48" height="144" />
        </g>
        <g fill="#ffd86b" opacity="0.85">
          {[[20, 214], [40, 214], [20, 240], [82, 180], [98, 180], [82, 206], [136, 230], [158, 230], [136, 256], [202, 166], [220, 166], [202, 194], [258, 210], [278, 210], [258, 238]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="10" height="12" rx="2" opacity={i % 3 ? 0.9 : 0.45} />
          ))}
        </g>
        <path d="M-6 118 Q 75 156 150 122 T 306 132" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" />
        <g fill="#fff3c4">
          {[24, 62, 100, 140, 180, 220, 258, 292].map((x, i) => (
            <circle key={x} cx={x} cy={132 + Math.sin(i * 1.1) * 12} r="5.5" opacity={0.75 + (i % 2) * 0.25} />
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(255,243,196,0.85)">ROOFTOP · 7 PM</Small>
        <Title lines={["FIESTA EN", "LA TERRAZA"]} y={294} fill="#fff" size={27} lh={28} />
      </>
    ),
  },

  // 17 · Ruta en bici.
  {
    id: "bici",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#5ee0a0" to="#0d7a63" dir="diag" />
        <path d="M-10 268 C 70 236, 130 296, 200 260 S 300 232, 320 250 L320 340 L-10 340 Z" fill="#0a4a41" opacity="0.7" />
        <g stroke="#eafff5" strokeWidth="5" fill="none">
          <circle cx="88" cy="196" r="42" />
          <circle cx="212" cy="196" r="42" />
          <path d="M88 196 L134 138 L188 138 L212 196 M134 138 L160 196 M188 138 L196 122" strokeWidth="5" strokeLinecap="round" />
        </g>
        <circle cx="88" cy="196" r="6" fill="#eafff5" />
        <circle cx="212" cy="196" r="6" fill="#eafff5" />
        <Small x={26} y={46} fill="rgba(10,74,65,0.85)">32 KM · NIVEL MEDIO</Small>
        <Title lines={["RUTA"]} y={94} fill="#08403a" size={38} />
        <Small x={26} y={120} fill="rgba(8,64,58,0.88)" size={14} weight={800}>EN BICI</Small>
        <Small x={26} y={310} fill="rgba(234,255,245,0.9)" size={11}>SALIMOS A LAS 6 AM</Small>
      </>
    ),
  },

  // 18 · Cata de vinos.
  {
    id: "cata",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#5c1230" to="#25060f" dir="down" />
        <g stroke="#e7c98f" strokeWidth="2.5" fill="none">
          {[[96, 0], [150, -16], [204, 0]].map(([x, dy], i) => (
            <g key={i} transform={`translate(${x} ${180 + dy})`}>
              <path d="M-26 -46 h52 a26 26 0 0 1 -52 0 Z" fill="#a01e4a" stroke="none" />
              <path d="M-26 -46 h52 v6 a26 26 0 0 1 -52 0 Z" />
              <path d="M-26 -46 a26 34 0 0 0 52 0" />
              <path d="M0 -12 v34" />
              <path d="M-18 24 h36" />
            </g>
          ))}
        </g>
        <g fill="#e7c98f" opacity="0.5">
          {[[44, 88], [258, 106], [70, 262], [240, 254]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} l8 -12 l8 12 l-8 12 Z`} />
          ))}
        </g>
        <Small x={26} y={46} fill="rgba(231,201,143,0.8)">6 ETIQUETAS · MALBEC A BLANCOS</Small>
        <Title lines={["CATA"]} y={288} fill="#f6e7c8" size={38} />
        <Small x={26} y={314} fill="#e7c98f" size={14} weight={800}>DE VINOS</Small>
      </>
    ),
  },

  // 19 · Música en vivo — banda pequeña.
  {
    id: "envivo",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#c9342c" to="#3b0a12" dir="down" />
        <defs>
          <radialGradient id={g("foco")} cx="0.5" cy="0.28" r="0.6">
            <stop offset="0" stopColor="#ffd66b" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffd66b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${g("foco")})`} />
        <g transform="translate(150 208) rotate(-18)">
          <ellipse cx="0" cy="34" rx="46" ry="42" fill="#f3d9a8" />
          <ellipse cx="0" cy="-12" rx="34" ry="32" fill="#f3d9a8" />
          <circle cx="0" cy="20" r="17" fill="#5e2410" />
          <rect x="-6" y="-108" width="12" height="82" rx="4" fill="#7a3417" />
          <rect x="-11" y="-124" width="22" height="20" rx="4" fill="#5e2410" />
          <g stroke="#5e2410" strokeWidth="1.4" opacity="0.7">
            <path d="M-4 -104 V56" /><path d="M0 -104 V56" /><path d="M4 -104 V56" />
          </g>
        </g>
        <g fill="#2a060c" opacity="0.85">
          {[36, 78, 122, 176, 224, 266].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={300 + (i % 2) * 6} r="11" />
              <rect x={x - 14} y={310 + (i % 2) * 6} width="28" height="34" rx="11" />
            </g>
          ))}
        </g>
        <Small x={26} y={44} fill="rgba(255,238,200,0.88)">BANDA EN VIVO</Small>
        <Title lines={["TOCATA"]} y={92} fill="#ffe9b8" size={37} />
      </>
    ),
  },

  // 20 · Voluntariado — comunidad que se organiza.
  {
    id: "voluntariado",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#7fd8c0" to="#0e5c58" dir="diag" />
        <circle cx="150" cy="182" r="78" fill="#0b3f3f" opacity="0.35" />
        <g fill="#effcf6">
          <path d="M150 138 c 22 -30 68 -18 68 16 c 0 30 -40 52 -68 74 c -28 -22 -68 -44 -68 -74 c 0 -34 46 -46 68 -16 Z" opacity="0.95" />
        </g>
        <g fill="#0e5c58">
          <path d="M150 158 c 0 22 -12 34 -26 38 c 8 -20 14 -28 26 -38 Z" />
          <path d="M150 158 c 0 22 12 34 26 38 c -8 -20 -14 -28 -26 -38 Z" />
        </g>
        <g fill="#effcf6" opacity="0.9">
          {[[52, 256], [96, 274], [204, 274], [248, 256]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="10" />
              <rect x={x - 13} y={y + 10} width="26" height="30" rx="11" />
            </g>
          ))}
        </g>
        <Small x={26} y={44} fill="rgba(11,63,63,0.85)">JORNADA AMBIENTAL</Small>
        <Title lines={["MANOS", "A LA OBRA"]} y={90} fill="#06403c" size={27} lh={29} />
      </>
    ),
  },

  // 21 · Club de lectura.
  {
    id: "lectura",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#f4e7cf" to="#c8a578" dir="down" />
        <g>
          <rect x="70" y="248" width="160" height="18" rx="4" fill="#8c5a2b" />
          <rect x="82" y="228" width="140" height="20" rx="4" fill="#b4452f" />
          <rect x="64" y="206" width="172" height="22" rx="4" fill="#2f5468" />
          <rect x="88" y="184" width="128" height="22" rx="4" fill="#6b7f3c" />
        </g>
        <g transform="translate(150 140)">
          <path d="M-62 -26 q30 -14 60 0 v56 q-30 -14 -60 0 Z" fill="#fffaf0" stroke="#8c5a2b" strokeWidth="2.5" />
          <path d="M62 -26 q-30 -14 -60 0 v56 q30 -14 60 0 Z" fill="#fffaf0" stroke="#8c5a2b" strokeWidth="2.5" />
          <g stroke="#c8a578" strokeWidth="2" opacity="0.8">
            <path d="M-50 -14 h34" /><path d="M-50 -2 h34" /><path d="M-50 10 h34" />
            <path d="M16 -14 h34" /><path d="M16 -2 h34" /><path d="M16 10 h34" />
          </g>
        </g>
        <Small x={26} y={44} fill="rgba(90,52,20,0.78)">UN LIBRO AL MES</Small>
        <Title lines={["CLUB DE"]} y={286} fill="#5a3414" size={26} />
        <Small x={26} y={314} fill="rgba(90,52,20,0.85)" size={13} weight={800}>LECTURA</Small>
      </>
    ),
  },

  // 22 · Noche de salsa.
  {
    id: "salsa",
    render: (g) => (
      <>
        <Bg id={g("bg")} from="#ffb03b" to="#c31432" dir="up" />
        <circle cx="150" cy="176" r="88" fill="#fff2cf" opacity="0.22" />
        <g fill="#3c0713">
          <g transform="translate(112 196)">
            <circle cx="0" cy="-52" r="13" />
            <path d="M-10 -36 q12 -8 24 2 l14 34 l-12 8 l-12 -24 l-4 42 l-14 -2 l4 -60 Z" />
            <path d="M2 6 l16 34 l-11 6 l-19 -34 Z" />
          </g>
          <g transform="translate(190 196) scale(-1 1)">
            <circle cx="0" cy="-56" r="13" />
            <path d="M-10 -40 q12 -8 24 2 l16 30 l-11 9 l-14 -22 l-2 44 l-14 -2 l1 -61 Z" />
            <path d="M4 4 l18 32 l-11 7 l-21 -33 Z" />
          </g>
        </g>
        <g fill="#fff2cf" opacity="0.85">
          {[[46, 96, 0.85], [252, 128, 0.7], [58, 250, 0.65]].map(([x, y, sc], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}>
              <ellipse cx="0" cy="22" rx="11" ry="8" transform="rotate(-18 0 22)" />
              <rect x="7" y="-22" width="4" height="46" rx="2" />
              <path d="M11 -22 q18 4 18 16 q-7 -7 -18 -5 Z" />
            </g>
          ))}
        </g>
        <Small x={26} y={44} fill="rgba(60,7,19,0.82)">ORQUESTA EN VIVO</Small>
        <Title lines={["NOCHE DE", "SALSA"]} y={286} fill="#fff4d6" size={30} lh={31} />
      </>
    ),
  },
];

export const POSTER_VIEWBOX = `0 0 ${W} ${H}`;
export const POSTER_RATIO = W / H;
