import { useMemo, useState } from "react";
import { getCapacityMax } from "../lib/capacity.js";
import { CategoryIcon } from "../lib/categoryIcons.jsx";
import { useIsDesktop } from "../lib/useMediaQuery.js";
import "../styles/typeform.css";
import { coverImgStyle } from "../lib/images.js";

// ─── Dashboard del organizador ──────────────────────────────────────────────
//
// Pensado para responder, en este orden, lo que un organizador se pregunta:
//   1. ¿Hay algo que requiera mi acción?   → avisos (solicitudes por aprobar)
//   2. ¿Cómo voy?                          → 4 cifras grandes
//   3. ¿Va a más o a menos?                → inscripciones en el tiempo
//   4. ¿Qué es lo próximo?                 → próximo evento con accesos directos
//   5. ¿Qué funciona mejor?                → ranking de eventos (tocable)
// Dos filtros arriba (periodo y evento) gobiernan TODO lo de debajo; antes las
// cifras eran globales y el detalle por evento vivía escondido en un acordeón.

const TEXT  = "#ffffff";
const SUB   = "rgba(229,238,255,0.64)";
const MUTED = "rgba(229,238,255,0.42)";
const ACCENT = "var(--tf-accent)";
const MUJER = "#f2a2c0";
const DIA = 86400000;
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha del evento (YYYY-MM-DD), venga del campo nuevo o del viejo. */
const fechaDe = (ev) => ev.startDate || ev.date || "";
/** Hoy en local como YYYY-MM-DD (comparable como texto con fechaDe). */
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esProximo = (ev, hoy) => (ev.endDate || fechaDe(ev) || "9999") >= hoy;

function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]}` : "Sin fecha";
}
function diasHasta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  const objetivo = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / DIA);
}
const enDias = (n) => n == null ? "" : n <= 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// ── Género (solo si el formulario lo pregunta) ───────────────────────────────
function generoDe(valor) {
  const v = String(valor ?? "").trim().toLowerCase();
  if (!v) return null;
  if (/^(h|hombre|hombres|masculino|masc|male|man)$/.test(v)) return "h";
  if (/^(mujer|mujeres|femenino|fem|female|woman|f)$/.test(v)) return "m";
  return "otro";
}
function generoDeEventos(eventos) {
  let h = 0, m = 0, o = 0;
  for (const ev of eventos) {
    const campo = (ev.fields || []).find((f) => /g[eé]ner|sexo/i.test(f.label || ""));
    if (!campo) continue;
    for (const r of ev.registrations || []) {
      const g = generoDe(r.data?.[campo.id]);
      if (g === "h") h++; else if (g === "m") m++; else if (g) o++;
    }
  }
  return { h, m, o, total: h + m + o };
}

// ── Piezas ──────────────────────────────────────────────────────────────────
function Pildora({ activa, children, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      style={{
        height: 38, padding: "0 15px", borderRadius: 999, cursor: "pointer", flexShrink: 0,
        fontSize: 14, fontWeight: 500, whiteSpace: "nowrap",
        background: activa ? "#ffffff" : "transparent",
        border: activa ? "1px solid #ffffff" : "1px solid rgba(229,238,255,0.24)",
        color: activa ? "#000000" : "#ffffff",
      }}>
      {children}
    </button>
  );
}

function Kpi({ valor, etiqueta, nota, notaColor }) {
  return (
    <div className="panel-card" style={{ padding: "18px 10px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1, color: TEXT }}>{valor}</div>
      <div style={{ fontSize: 13.5, color: SUB, marginTop: 8 }}>{etiqueta}</div>
      {nota && <div style={{ fontSize: 12, color: notaColor || MUTED, marginTop: 4, fontWeight: notaColor ? 600 : 400 }}>{nota}</div>}
    </div>
  );
}

function Seccion({ titulo, accion, children, style }) {
  return (
    <section className="panel-card" style={{ padding: "18px 16px", marginBottom: 12, ...style }}>
      {(titulo || accion) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>{titulo}</h2>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

function Barra({ valor, max, color = ACCENT, alto = 6 }) {
  const p = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <div style={{ height: alto, borderRadius: alto, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", borderRadius: alto, background: p >= 90 ? "#f87171" : color, transition: "width .4s ease" }} />
    </div>
  );
}

function AccionChica({ children, onClick, icono }) {
  return (
    <button type="button" onClick={onClick} className="ef-hover-fill"
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        padding: "10px 4px 9px", border: "none", borderRadius: 14, cursor: "pointer",
        background: "rgba(255,255,255,0.08)", color: TEXT, fontSize: 12.5, fontWeight: 500,
      }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icono}</svg>
      {children}
    </button>
  );
}

/** Inscripciones agrupadas por día (o semana) en la ventana elegida. */
function GraficoInscripciones({ regs, rango, alto = 110 }) {
  const { cubos, total, previo } = useMemo(() => {
    const finHoy = new Date(); finHoy.setHours(23, 59, 59, 999);
    const dias = rango;
    const porSemana = dias > 31;
    const tam = porSemana ? 7 : 1;
    const n = Math.ceil(dias / tam);
    const inicio = finHoy.getTime() - dias * DIA + 1;
    const arr = Array.from({ length: n }, (_, i) => {
      const desde = new Date(inicio + i * tam * DIA);
      return { n: 0, desde };
    });
    let tot = 0, prev = 0;
    for (const r of regs) {
      const t = Number(r.ts) || 0;
      if (t >= inicio && t <= finHoy.getTime()) {
        const i = Math.min(n - 1, Math.floor((t - inicio) / (tam * DIA)));
        arr[i].n++; tot++;
      } else if (t >= inicio - dias * DIA && t < inicio) prev++;
    }
    return { cubos: arr, total: tot, previo: prev };
  }, [regs, rango]);

  const max = Math.max(1, ...cubos.map((c) => c.n));
  const delta = previo > 0 ? Math.round(((total - previo) / previo) * 100) : null;
  const etiqueta = (d) => `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: 13.5, color: SUB }}>inscripciones</span>
        {delta != null && (
          <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
            color: delta >= 0 ? "#6ee7b7" : "#fca5a5", background: delta >= 0 ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)" }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs. periodo anterior
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: cubos.length > 20 ? 2 : 5, height: alto }}
        role="img" aria-label={`${total} inscripciones en los últimos ${rango} días`}>
        {cubos.map((c, i) => (
          <div key={i} title={`${etiqueta(c.desde)}: ${c.n}`}
            style={{
              flex: 1, minWidth: 0, borderRadius: 4,
              height: c.n ? `${Math.max(8, (c.n / max) * 100)}%` : 3,
              background: c.n ? ACCENT : "rgba(255,255,255,0.12)",
              opacity: c.n ? 0.95 : 1,
            }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: MUTED, marginTop: 8 }}>
        <span>{etiqueta(cubos[0].desde)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

// ── Vista ───────────────────────────────────────────────────────────────────
export default function DashboardView({ events = [], onNew, onOpen, onValidate, onShare }) {
  const [periodo, setPeriodo] = useState("todos");     // proximos | pasados | todos
  const [eventoId, setEventoId] = useState("");         // "" = todos
  const [rango, setRango] = useState(30);               // días del gráfico
  const escritorio = useIsDesktop();
  const hoy = hoyISO();

  // Eventos dentro del periodo (sin borradores).
  const enPeriodo = useMemo(() => {
    const base = events.filter((e) => !e.isDraft);
    if (periodo === "proximos") return base.filter((e) => esProximo(e, hoy));
    if (periodo === "pasados") return base.filter((e) => !esProximo(e, hoy));
    return base;
  }, [events, periodo, hoy]);

  // Si el evento elegido sale del periodo, se vuelve a "Todos".
  const elegido = enPeriodo.find((e) => e.id === eventoId) || null;
  const alcance = useMemo(() => (elegido ? [elegido] : enPeriodo), [elegido, enPeriodo]);

  const m = useMemo(() => {
    const regs = alcance.flatMap((e) => e.registrations || []);
    const checkins = regs.filter((r) => r.used).length;
    let aforo = 0, conAforo = 0, regsConAforo = 0;
    for (const e of alcance) {
      const cap = getCapacityMax(e.capacity, e);
      if (cap) { aforo += cap; conAforo++; regsConAforo += (e.registrations || []).length; }
    }
    const semana = Date.now() - 7 * DIA;
    const pendientes = alcance
      .map((e) => ({ ev: e, n: (e.registrations || []).filter((r) => r.approved === false).length }))
      .filter((x) => x.n > 0);
    return {
      regs, checkins, aforo, conAforo, regsConAforo,
      nuevasSemana: regs.filter((r) => Number(r.ts) >= semana).length,
      proximos: alcance.filter((e) => esProximo(e, hoy)).length,
      pendientes,
      totalPendientes: pendientes.reduce((n, x) => n + x.n, 0),
    };
  }, [alcance, hoy]);

  const proximo = useMemo(() => {
    const lista = (elegido ? [elegido] : events.filter((e) => !e.isDraft))
      .filter((e) => esProximo(e, hoy) && fechaDe(e))
      .sort((a, b) => fechaDe(a).localeCompare(fechaDe(b)));
    return lista[0] || null;
  }, [events, elegido, hoy]);

  const ranking = useMemo(
    () => [...enPeriodo].sort((a, b) => (b.registrations?.length || 0) - (a.registrations?.length || 0)),
    [enPeriodo]
  );
  const genero = useMemo(() => generoDeEventos(alcance), [alcance]);

  // ── Vacío ──
  if (!events.filter((e) => !e.isDraft).length) {
    return (
      <div className="dash">
        <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 8px" }}>Dashboard</h1>
        <div className="panel-card" style={{ padding: "40px 24px", textAlign: "center", marginTop: 20 }}>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>Aún no hay datos</p>
          <p style={{ fontSize: 14.5, color: SUB, margin: "0 0 20px" }}>Crea tu primer evento y aquí verás inscripciones, asistencia y aforo.</p>
          {onNew && <button type="button" className="soft-btn soft-btn-primary" onClick={onNew}>Crear evento</button>}
        </div>
      </div>
    );
  }

  const total = m.regs.length;
  const ocupacion = m.aforo ? pct(m.regsConAforo, m.aforo) : null;
  const asistencia = pct(m.checkins, total);
  const diasProx = proximo ? diasHasta(fechaDe(proximo)) : null;

  const bloqueGrafico = (<>
      {/* ── 3. Evolución ── */}
      <Seccion titulo="Inscripciones"
        accion={
          <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" onClick={() => setRango(d)} aria-pressed={rango === d}
                style={{ height: 28, padding: "0 11px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                  background: rango === d ? "#ffffff" : "transparent", color: rango === d ? "#000" : SUB }}>
                {d} d
              </button>
            ))}
          </div>
        }>
        <GraficoInscripciones regs={m.regs} rango={rango} alto={escritorio ? 190 : 110} />
      </Seccion>

  </>);
  const bloqueProximo = (<>
      {/* ── 4. Próximo evento ── */}
      {proximo && (() => {
        const n = (proximo.registrations || []).length;
        const cap = getCapacityMax(proximo.capacity, proximo);
        return (
          <Seccion titulo={elegido ? "Este evento" : "Próximo evento"}
            accion={<span style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "rgba(52,211,153,0.14)", color: "#6ee7b7" }}>{enDias(diasProx)}</span>}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
              {proximo.headerImage
                ? <span style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", flexShrink: 0, display: "block" }}><img src={proximo.headerImage} alt="" width={52} height={52} style={coverImgStyle(proximo.imagePos, proximo.imageZoom)} /></span>
                : <CategoryIcon slug={proximo.category || "otro"} size={52} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proximo.title}</div>
                <div style={{ fontSize: 13.5, color: SUB, marginTop: 2 }}>
                  {fechaCorta(fechaDe(proximo))}{proximo.startTime ? ` · ${proximo.startTime}` : ""}{proximo.city ? ` · ${proximo.city}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 7 }}>
              <span style={{ color: SUB }}>Inscritos</span>
              <span style={{ fontWeight: 600 }}>{n}{cap ? <span style={{ color: MUTED, fontWeight: 400 }}> / {cap}</span> : ""}</span>
            </div>
            <Barra valor={n} max={cap || Math.max(n, 1)} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <AccionChica onClick={() => onOpen?.(proximo.id)} icono={<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>}>Inscritos</AccionChica>
              <AccionChica onClick={() => onShare?.(proximo)} icono={<><path d="M21.5 2.5 10.8 13.2" /><path d="M21.5 2.5 14.8 21.5l-4-8.3-8.3-4z" /></>}>Compartir</AccionChica>
              <AccionChica onClick={() => onValidate?.(proximo.id)} icono={<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>}>Escanear</AccionChica>
            </div>
          </Seccion>
        );
      })()}

  </>);
  const bloquePublico = (<>
      {/* Reparto por género: solo si algún formulario lo pregunta */}
      {genero.total > 0 && (
        <Seccion titulo="Público">
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
            {[[genero.h, "var(--tf-accent)"], [genero.m, MUJER], [genero.o, "rgba(255,255,255,0.35)"]].map(([n, c], i) => n > 0 && (
              <div key={i} style={{ width: `${(n / genero.total) * 100}%`, background: c }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, fontSize: 13, color: SUB }}>
            {[["Hombres", genero.h, "var(--tf-accent)"], ["Mujeres", genero.m, MUJER], ["Otro / sin responder", genero.o, "rgba(255,255,255,0.35)"]]
              .filter(([, n], i) => n > 0 || i < 2)
              .map(([l, n, c]) => (
                <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                  {l} <b style={{ color: TEXT, fontWeight: 600 }}>{pct(n, genero.total)}%</b>
                </span>
              ))}
          </div>
        </Seccion>
      )}

  </>);
  const bloqueRanking = (<>
      {/* ── 5. Ranking (solo con varios eventos en el filtro) ── */}
      {!elegido && ranking.length > 1 && (
        <Seccion titulo="Tus eventos" accion={<span style={{ fontSize: 12.5, color: MUTED }}>por inscritos</span>}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ranking.slice(0, 8).map((e, i) => {
              const n = (e.registrations || []).length;
              const cap = getCapacityMax(e.capacity, e);
              const ci = (e.registrations || []).filter((r) => r.used).length;
              return (
                <button key={e.id} type="button" className="ef-hover-fill" onClick={() => { setEventoId(e.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                    padding: "11px 6px", border: "none", borderRadius: 12, cursor: "pointer", background: "transparent", color: TEXT,
                    borderTop: i ? "1px solid var(--tf-divider)" : "none",
                  }}>
                  <span style={{ width: 18, fontSize: 13, color: MUTED, fontWeight: 600, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title || "Sin título"}</span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED, margin: "2px 0 6px" }}>
                      {fechaCorta(fechaDe(e))}{ci ? ` · ${ci} check-ins` : ""}
                    </span>
                    <Barra valor={n} max={cap || Math.max(...ranking.map((x) => (x.registrations || []).length), 1)} alto={4} />
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0, minWidth: 44 }}>
                    <span style={{ display: "block", fontSize: 17, fontWeight: 600 }}>{n}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: MUTED }}>{cap ? `de ${cap}` : "inscritos"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Seccion>
      )}

  </>);

  return (
    <div className="dash">
      <div className="dash-head">
      <div>
        <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "8px 0 6px" }}>Dashboard</h1>
        <p style={{ fontSize: 15, color: SUB, margin: "0 0 18px" }}>Lo importante de tus eventos, de un vistazo.</p>
      </div>

      {/* ── Filtros: gobiernan todo lo de abajo ── */}
      <div className="dash-filtros">
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
        {[["todos", "Todos"], ["proximos", "Próximos"], ["pasados", "Pasados"]].map(([k, l]) => (
          <Pildora key={k} activa={periodo === k} onClick={() => setPeriodo(k)}>{l}</Pildora>
        ))}
      </div>
      <label className="dash-select" style={{ position: "relative", display: "block", marginBottom: 18 }}>
        <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Evento</span>
        <select value={elegido ? elegido.id : ""} onChange={(e) => setEventoId(e.target.value)}
          style={{
            width: "100%", height: 48, padding: "0 44px 0 16px", borderRadius: 14, border: "none",
            background: "var(--tf-field)", color: TEXT, fontSize: 15.5, fontWeight: 500,
            appearance: "none", WebkitAppearance: "none", cursor: "pointer",
          }}>
          <option value="">Todos los eventos ({enPeriodo.length})</option>
          {enPeriodo.map((e) => (
            <option key={e.id} value={e.id}>{e.title || "Sin título"} · {fechaCorta(fechaDe(e))}</option>
          ))}
        </select>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={SUB} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", right: 16, top: 15, pointerEvents: "none" }} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </label>
      </div>
      </div>

      {/* ── 1. Lo que requiere acción ── */}
      {m.totalPendientes > 0 && (
        <button type="button" className="ef-hover-fill"
          onClick={() => onOpen?.(m.pendientes[0].ev.id, "pendientes")}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
            padding: "14px 16px", marginBottom: 12, border: "none", borderRadius: 18, cursor: "pointer",
            background: "rgba(251,191,36,0.14)", color: "#fbbf24",
          }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>
            {m.totalPendientes} {m.totalPendientes === 1 ? "solicitud por aprobar" : "solicitudes por aprobar"}
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
              {m.pendientes.length === 1 ? m.pendientes[0].ev.title : `En ${m.pendientes.length} eventos`} · su QR no funciona hasta que apruebes
            </span>
          </span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {/* ── 2. Cifras clave ── */}
      <div className="dash-kpis">
        <Kpi valor={total} etiqueta="Inscritos"
          nota={m.nuevasSemana > 0 ? `+${m.nuevasSemana} esta semana` : "sin nuevas esta semana"}
          notaColor={m.nuevasSemana > 0 ? "#6ee7b7" : null} />
        <Kpi valor={asistencia != null ? `${asistencia}%` : "—"} etiqueta="Asistencia"
          nota={`${m.checkins} de ${total} entraron`} />
        <Kpi valor={ocupacion != null ? `${ocupacion}%` : "—"} etiqueta="Ocupación"
          nota={m.aforo ? `${m.regsConAforo} de ${m.aforo} cupos` : "sin aforo definido"} />
        <Kpi valor={elegido ? (esProximo(elegido, hoy) ? enDias(diasHasta(fechaDe(elegido))) : "Pasado") : alcance.length}
          etiqueta={elegido ? "Estado" : "Eventos"}
          nota={elegido ? fechaCorta(fechaDe(elegido)) : `${m.proximos} ${m.proximos === 1 ? "próximo" : "próximos"}`} />
      </div>

      {/* Móvil: una columna (gráfico, próximo, público, ranking).
          Ordenador: dos columnas — lo que se analiza a la izquierda y lo que
          se hace (próximo evento, público) a la derecha. */}
      {escritorio ? (
        <div className="dash-cols">
          <div>{bloqueGrafico}{bloqueRanking}</div>
          <div>{bloqueProximo}{bloquePublico}</div>
        </div>
      ) : (
        <>{bloqueGrafico}{bloqueProximo}{bloquePublico}{bloqueRanking}</>
      )}

      {elegido && (
        <button type="button" className="soft-btn soft-btn-ghost" style={{ width: "100%", marginTop: 4 }} onClick={() => setEventoId("")}>
          Ver todos los eventos
        </button>
      )}
    </div>
  );
}
