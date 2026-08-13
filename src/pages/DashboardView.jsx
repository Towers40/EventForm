import { useMemo, useState } from "react";
import { getCapacityMax } from "../lib/capacity.js";
import "../styles/typeform.css";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const TEXT   = "#eef1f7";
const SUB    = "rgba(238,241,247,0.64)";
const MUTED  = "rgba(238,241,247,0.42)";
const ACCENT = "#7fb3e6";
const OK     = "#5ee07f";
const HOMBRE = "#7fb3e6";
const MUJER  = "#f2a2c0";
const LINEA  = "rgba(255,255,255,0.12)";
const PISTA  = "rgba(255,255,255,0.08)";

/** Fecha del evento en formato YYYY-MM-DD, venga del campo nuevo o del viejo. */
const fechaDe = (ev) => ev.startDate || ev.date || "";

/**
 * Normaliza el género declarado en el formulario.
 *
 * No hay campo de género en el modelo: sale de una pregunta del formulario del
 * anfitrión, así que llegan textos libres ("Hombre", "F", "masculino"). Una "m"
 * suelta es ambigua (¿mujer o masculino?) y se cuenta como "otro" antes que
 * inventarse el dato.
 */
function generoDe(valor) {
  const v = String(valor ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/^(h|hombre|hombres|masculino|masc|male|man)$/.test(v)) return "h";
  if (/^(mujer|mujeres|femenino|fem|female|woman|f)$/.test(v)) return "m";
  return "otro";
}

const campoGeneroDe = (ev) =>
  (ev.fields || []).find((f) => /g[eé]ner|sexo/i.test(f.label || ""));

function metricasDe(ev) {
  const regs = ev.registrations || [];
  const reservadas = regs.length;
  const asistieron = regs.filter((r) => r.used).length;
  // "Entradas totales" es el aforo del evento. Si no se definió, no hay techo
  // contra el que medir y se muestra el propio número de reservas.
  const aforo = getCapacityMax(ev.capacity, ev);

  const campo = campoGeneroDe(ev);
  let hombres = 0, mujeres = 0, otros = 0;
  if (campo) {
    for (const r of regs) {
      const g = generoDe(r.data?.[campo.id]);
      if (g === "h") hombres++;
      else if (g === "m") mujeres++;
      else if (g) otros++;
    }
  }

  return {
    reservadas, asistieron, aforo, campo,
    hombres, mujeres, otros,
    conGenero: hombres + mujeres + otros,
    tasa: reservadas > 0 ? asistieron / reservadas : 0,
    ocupacion: aforo ? Math.min(1, reservadas / aforo) : 0,
  };
}

/** Anillo de progreso: el porcentaje se lee en el centro, como en un reloj. */
function Anillo({ pct = 0, valor, unidad, etiqueta, nota, color = ACCENT, size = 104, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PISTA} strokeWidth={stroke} />
          {p > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - p)}
              style={{ transition: "stroke-dashoffset .6s ease" }}
            />
          )}
        </svg>
        {/* Centrado real: alineación por línea base empujaba el número contra
            el borde de arriba del anillo. */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: TEXT, lineHeight: 1, letterSpacing: "-0.5px" }}>{valor}</span>
          {unidad && <span style={{ fontSize: 13, fontWeight: 600, color: SUB, lineHeight: 1, alignSelf: "center", marginTop: 5 }}>{unidad}</span>}
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUB }}>
          {etiqueta}
        </div>
        {nota && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{nota}</div>}
      </div>
    </div>
  );
}

/** Cuadro con recuadro de valor a la izquierda y etiqueta a la derecha. */
function Cuadro({ valor, etiqueta, nota, color = ACCENT }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      border: `1px solid ${LINEA}`, borderRadius: 16,
      background: "rgba(255,255,255,0.04)", padding: "11px 13px",
    }}>
      <span style={{
        flexShrink: 0, minWidth: 44, height: 44, padding: "0 7px", borderRadius: 13,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}22`, border: `1px solid ${color}44`,
        color, fontSize: 17, fontWeight: 700, letterSpacing: "-0.4px",
      }}>
        {valor}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: TEXT }}>
          {etiqueta}
        </div>
        {nota && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{nota}</div>}
      </div>
    </div>
  );
}

/** Barra apilada hombre/mujer con su leyenda. */
function BarraGenero({ hombres, mujeres, otros }) {
  const total = hombres + mujeres + otros;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
  const leyenda = [
    { label: "Hombre", n: hombres, color: HOMBRE },
    { label: "Mujer",  n: mujeres, color: MUJER },
    ...(otros > 0 ? [{ label: "Otro / sin responder", n: otros, color: "rgba(255,255,255,0.28)" }] : []),
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: PISTA }}>
        {leyenda.map((l) => l.n > 0 && (
          <div key={l.label} title={`${l.label}: ${l.n}`}
            style={{ width: `${pct(l.n)}%`, background: l.color, transition: "width .5s ease" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        {leyenda.map((l) => (
          <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: SUB }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
            {l.label}
            <b style={{ color: TEXT, fontWeight: 700 }}>{l.n}</b>
            <span style={{ color: MUTED }}>{total > 0 ? `${Math.round(pct(l.n))}%` : "—"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Métricas de un evento concreto: anillos arriba, cuadros y barra debajo. */
function MetricasEvento({ ev }) {
  const m = metricasDe(ev);
  const entradasTotales = m.aforo ?? m.reservadas;
  const hayGenero = Boolean(m.campo) && m.conGenero > 0;

  return (
    <div style={{
      border: `1px solid ${LINEA}`, borderRadius: 18,
      background: "rgba(255,255,255,0.035)", padding: "20px 16px", marginTop: 12,
    }}>
      {/* Anillos: solo lo que es una proporción real */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 26, marginBottom: 22 }}>
        <Anillo
          pct={m.aforo ? m.ocupacion : (m.reservadas > 0 ? 1 : 0)}
          valor={m.aforo ? Math.round(m.ocupacion * 100) : m.reservadas}
          unidad={m.aforo ? "%" : null}
          etiqueta="Reservadas"
          nota={m.aforo ? `${m.reservadas} / ${m.aforo}` : "sin aforo definido"}
          color={ACCENT}
        />
        <Anillo
          pct={m.tasa}
          valor={m.reservadas > 0 ? Math.round(m.tasa * 100) : "—"}
          unidad={m.reservadas > 0 ? "%" : null}
          etiqueta="Asistencia"
          nota={`${m.asistieron} de ${m.reservadas} entraron`}
          color={OK}
        />
      </div>

      {/* Cuadros. Hombre y Mujer solo salen si el evento pregunta el género y
          alguien ha respondido: un "0 / sin datos" no es una métrica, es ruido. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: hayGenero ? 18 : 0 }}>
        <Cuadro valor={entradasTotales} etiqueta="Entradas totales"
                nota={m.aforo ? "aforo del evento" : "sin aforo definido"} />
        <Cuadro valor={m.reservadas} etiqueta="Reservadas" nota="entradas emitidas" color={ACCENT} />
        {hayGenero && (
          <Cuadro valor={m.hombres} etiqueta="Hombre" color={HOMBRE}
                  nota={`${Math.round((m.hombres / m.conGenero) * 100)}% del total`} />
        )}
        {hayGenero && (
          <Cuadro valor={m.mujeres} etiqueta="Mujer" color={MUJER}
                  nota={`${Math.round((m.mujeres / m.conGenero) * 100)}% del total`} />
        )}
      </div>

      {/* Reparto por género */}
      {hayGenero && (
        <div>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUB, margin: "0 0 10px" }}>
            Reparto por género
          </p>
          <BarraGenero hombres={m.hombres} mujeres={m.mujeres} otros={m.otros} />
        </div>
      )}
    </div>
  );
}

export default function DashboardView({ events }) {
  const [seleccionado, setSeleccionado] = useState(null);
  const [verEventos, setVerEventos] = useState(false);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const regs = events.flatMap((e) => e.registrations || []);
  const total = regs.length;
  const checkins = regs.filter((r) => r.used).length;

  // Años con eventos, más el año actual: el filtro nunca arranca vacío aunque
  // este año todavía no haya nada.
  const anios = useMemo(() => {
    const s = new Set([new Date().getFullYear()]);
    for (const ev of events) {
      const m = /^(\d{4})/.exec(fechaDe(ev));
      if (m) s.add(Number(m[1]));
    }
    return [...s].sort((a, b) => a - b);
  }, [events]);
  const anioMin = anios[0];
  const anioMax = anios[anios.length - 1];

  const { porMes, sinFecha, totalAnio } = useMemo(() => {
    const arr = Array(12).fill(0);
    let sin = 0;
    for (const ev of events) {
      const m = /^(\d{4})-(\d{2})/.exec(fechaDe(ev));
      if (!m) { sin++; continue; }
      if (Number(m[1]) === anio) arr[Number(m[2]) - 1]++;
    }
    return { porMes: arr, sinFecha: sin, totalAnio: arr.reduce((a, b) => a + b, 0) };
  }, [events, anio]);
  const maxMes = Math.max(1, ...porMes);

  const topEvent = useMemo(
    () => [...events].sort((a, b) => (b.registrations?.length || 0) - (a.registrations?.length || 0))[0],
    [events]
  );

  const listaEventos = useMemo(
    () => [...events].sort((a, b) => (fechaDe(b) || "").localeCompare(fechaDe(a) || "")),
    [events]
  );

  // Totales de todos los eventos juntos, para el resumen de "Eventos creados".
  const globales = useMemo(() => {
    let aforo = 0, hombres = 0, mujeres = 0, otros = 0, conGenero = 0;
    for (const ev of events) {
      const m = metricasDe(ev);
      if (m.aforo) aforo += m.aforo;
      hombres += m.hombres; mujeres += m.mujeres; otros += m.otros; conGenero += m.conGenero;
    }
    return { aforo, hombres, mujeres, otros, conGenero };
  }, [events]);

  // Recuadros compactos: antes ocupaban media pantalla en móvil porque el
  // subtítulo de "Tasa de asistencia" estiraba a las cuatro por igual.
  const stat = (label, value, extra) => (
    <div className="panel-card" style={{ padding: "12px 10px", textAlign: "center", ...extra }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: ACCENT, lineHeight: 1.15, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: TEXT, marginTop: 4, lineHeight: 1.25 }}>{label}</div>
    </div>
  );

  const btnAnio = (dir, disabled) => (
    <button
      type="button"
      onClick={() => setAnio((a) => a + dir)}
      disabled={disabled}
      aria-label={dir < 0 ? "Año anterior" : "Año siguiente"}
      style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.06)", border: `1px solid ${LINEA}`,
        color: disabled ? MUTED : TEXT, cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={dir < 0 ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, color: TEXT, margin: "0 0 8px", textAlign: "center" }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: "#8fa3b1", margin: "0 0 28px", textAlign: "center" }}>
        Visión global de tu actividad en TapIn
      </p>

      {/* Stats principales. "Eventos creados" es el que abre el detalle: dentro
          van las métricas generales y el listado para entrar evento por evento,
          en vez de tener la lista suelta al final de la página. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10, marginBottom: verEventos ? 12 : 24 }}>
        <button
          type="button"
          onClick={() => setVerEventos((v) => !v)}
          aria-expanded={verEventos}
          className="panel-card"
          style={{
            padding: "12px 10px", textAlign: "center", cursor: "pointer", position: "relative",
            background: verEventos ? "rgba(127,179,230,0.14)" : undefined,
            borderColor: verEventos ? "rgba(127,179,230,0.45)" : undefined,
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600, color: ACCENT, lineHeight: 1.15, letterSpacing: "-0.5px" }}>{events.length}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: TEXT, marginTop: 4, lineHeight: 1.25, display: "inline-flex", alignItems: "center", gap: 4 }}>
            Eventos creados
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={verEventos ? ACCENT : MUTED}
                 strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
                 style={{ transform: verEventos ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </button>
        {stat("Inscritos totales", total)}
        {stat("Check-ins totales", checkins)}
        {stat("Tasa de asistencia", total > 0 ? `${Math.round((checkins / total) * 100)}%` : "—")}
      </div>

      {/* ── Detalle de "Eventos creados" ── */}
      {verEventos && (
        <div className="panel-card" style={{ padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
            Métricas generales
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 26, marginBottom: 20 }}>
            <Anillo
              pct={globales.aforo ? Math.min(1, total / globales.aforo) : (total > 0 ? 1 : 0)}
              valor={globales.aforo ? Math.round(Math.min(1, total / globales.aforo) * 100) : total}
              unidad={globales.aforo ? "%" : null}
              etiqueta="Reservadas"
              nota={globales.aforo ? `${total} / ${globales.aforo}` : "sin aforos definidos"}
              color={ACCENT}
            />
            <Anillo
              pct={total > 0 ? checkins / total : 0}
              valor={total > 0 ? Math.round((checkins / total) * 100) : "—"}
              unidad={total > 0 ? "%" : null}
              etiqueta="Asistencia"
              nota={`${checkins} de ${total} entraron`}
              color={OK}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <Cuadro valor={events.length} etiqueta="Eventos" nota="creados en total" />
            <Cuadro valor={globales.aforo || total} etiqueta="Entradas totales"
                    nota={globales.aforo ? "suma de aforos" : "sin aforos definidos"} color={ACCENT} />
          </div>

          {globales.conGenero > 0 && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUB, margin: "0 0 10px" }}>
                Reparto por género
              </p>
              <BarraGenero hombres={globales.hombres} mujeres={globales.mujeres} otros={globales.otros} />
            </div>
          )}

          {/* Listado para entrar a cada evento */}
          <div style={{ borderTop: `1px solid ${LINEA}`, margin: "20px 0 14px" }} />
          <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 12px" }}>
            Elige un evento para ver sus métricas.
          </p>

          {listaEventos.length === 0 ? (
            <p style={{ color: "#8fa3b1", fontSize: 14, margin: 0 }}>Todavía no has creado ningún evento.</p>
          ) : listaEventos.map((ev) => {
            const abierto = seleccionado === ev.id;
            const nRegs = (ev.registrations || []).length;
            return (
              <div key={ev.id} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSeleccionado(abierto ? null : ev.id)}
                  aria-expanded={abierto}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 16, cursor: "pointer", textAlign: "left",
                    background: abierto ? "rgba(127,179,230,0.14)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${abierto ? "rgba(127,179,230,0.45)" : LINEA}`,
                    transition: "background .15s, border-color .15s",
                  }}
                >
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.title || "Evento sin título"}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                      {fechaDe(ev) || "Sin fecha"} · {nRegs} {nRegs === 1 ? "reserva" : "reservas"}
                    </span>
                  </span>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={abierto ? ACCENT : MUTED}
                       strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                       style={{ flexShrink: 0, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {abierto && <MetricasEvento ev={ev} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Evento con más inscritos */}
      {topEvent && (
        <div className="panel-card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            Evento con más inscritos
          </p>
          <p style={{ fontSize: 17, fontWeight: 600, color: TEXT, margin: "0 0 4px" }}>{topEvent.title}</p>
          <p style={{ fontSize: 13, color: ACCENT, fontWeight: 700, margin: 0 }}>
            {topEvent.registrations?.length || 0} inscritos
          </p>
        </div>
      )}

      {/* ── Eventos por mes ── */}
      <div className="panel-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Eventos por mes
          </p>
          {/* Filtro de año: arranca en el año actual y retrocede uno a uno. */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {btnAnio(-1, anio <= anioMin)}
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, minWidth: 46, textAlign: "center", letterSpacing: "-0.3px" }}>
              {anio}
            </span>
            {btnAnio(1, anio >= anioMax)}
          </div>
        </div>

        {porMes.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, color: n > 0 ? SUB : MUTED, width: 78, flexShrink: 0 }}>{MESES[i]}</span>
            <div style={{ flex: 1, background: PISTA, borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{
                width: `${(n / maxMes) * 100}%`, height: "100%",
                background: ACCENT, borderRadius: 999, transition: "width 0.4s",
              }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: n > 0 ? ACCENT : MUTED, width: 22, textAlign: "right" }}>{n}</span>
          </div>
        ))}

        <p style={{ fontSize: 12, color: MUTED, margin: "12px 0 0" }}>
          {totalAnio === 0
            ? `Sin eventos en ${anio}.`
            : `${totalAnio} ${totalAnio === 1 ? "evento" : "eventos"} en ${anio}.`}
          {sinFecha > 0 && ` ${sinFecha} sin fecha.`}
        </p>
      </div>

    </div>
  );
}
