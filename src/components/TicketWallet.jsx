import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiEnabled } from "../lib/api.js";
import { coverImgStyle } from "../lib/images.js";
import { eventTint } from "../lib/dominantColor.js";
import { getNavigationLinks } from "../lib/navigation.js";
import { addToCalendar, downloadTicketPdf, fechaLarga, hora12, lugarDe } from "../lib/ticketExport.js";
import { publicBaseUrl } from "../lib/platform.js";
import { qrUrlFor } from "./PendingQr.jsx";

// ─── Ticket electrónico a pantalla completa ─────────────────────────────────
//
// Se abre al tocar cualquier parte de una entrada en "Mis tickets". La entrada
// es una tarjeta clara (para que el QR se lea con cualquier brillo) con la
// portada del evento arriba, como una boleta. Debajo, tres acciones:
//   · Ver evento
//   · Cancelar entrada (evento gratuito) o Revender (entrada pagada)
//   · Más: calendario, cómo llegar, PDF y contactar al organizador
// Con varias entradas del mismo evento, se pasan deslizando a los lados.

const ico = (d, s = 24) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  ojo: ico(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  cancelar: ico(<><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>),
  revender: ico(<><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>),
  mas: ico(<path d="M12 5v14M5 12h14" />),
  calendario: ico(<><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" /></>, 20),
  ruta: ico(<path d="m3 11 19-8-8 19-2-9-9-2z" />, 20),
  pdf: ico(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5" /></>, 20),
  correo: ico(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>, 20),
};

function Accion({ icono, etiqueta, onClick, tono }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", color: tono || "#fff", padding: 0, minWidth: 84 }}>
      <span style={{ width: 62, height: 62, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.06)", display: "grid", placeItems: "center" }}>
        {icono}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{etiqueta}</span>
    </button>
  );
}

export default function TicketWallet({ grupo, token, onClose, onCancel, onResaleChange }) {
  const nav = useNavigate();
  const { slug, items } = grupo;
  const [detalle, setDetalle] = useState(null);   // evento completo (organizador, mapa…)
  const [idx, setIdx] = useState(0);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState("");
  const [aviso, setAviso] = useState("");
  const tiraRef = useRef(null);

  const ev = { ...grupo.event, ...(detalle || {}) };
  const actual = items[Math.min(idx, items.length - 1)] || items[0];
  const tinte = eventTint(ev.themeColor);
  const pasado = (() => { const d = ev.endDate || ev.startDate || ev.date; return d ? new Date(d + "T23:59:59") < new Date() : false; })();
  const esPago = Boolean(actual?.paid);
  const enReventa = actual?.resale === "listed";

  // Datos que la lista no trae (organizador, redes, mapa).
  useEffect(() => {
    let vivo = true;
    if (apiEnabled && slug) api.publicEvent(slug).then((r) => { if (vivo) setDetalle(r.event); }).catch(() => {});
    return () => { vivo = false; };
  }, [slug]);

  // Sin desplazamiento de la página de debajo; Escape cierra.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", tecla);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", tecla); };
  }, [onClose]);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3200); };
  const urlEvento = `${publicBaseUrl()}/e/${slug}`;

  const revender = async () => {
    if (!token) return avisar("Inicia sesión para revender tu entrada.");
    setBusy("resale");
    try {
      await api.ticketResale(token, actual.id, !enReventa);
      onResaleChange?.(actual.id, enReventa ? "none" : "listed");
      avisar(enReventa ? "Entrada retirada de la reventa." : "Entrada puesta en reventa. Sigue siendo tuya hasta que alguien la compre.");
    } catch (e) { avisar(e.message || "No se pudo actualizar la reventa."); }
    finally { setBusy(""); }
  };

  const comoLlegar = () => {
    const links = getNavigationLinks(ev.lat, ev.lng, ev.title);
    const lugar = lugarDe(ev);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const url = links ? (ios ? links.apple : links.google)
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`;
    window.open(url, "_blank", "noopener");
  };

  const opciones = [
    { key: "cal", icono: I.calendario, titulo: "Añadir al calendario", sub: "Con fecha, hora y lugar ya puestos",
      visible: Boolean(ev.startDate || ev.date),
      run: () => { if (!addToCalendar(ev, actual.id, urlEvento)) avisar("Este evento aún no tiene fecha."); } },
    { key: "ruta", icono: I.ruta, titulo: "Cómo llegar", sub: lugarDe(ev) || "", visible: Boolean(lugarDe(ev) || ev.lat != null), run: comoLlegar },
    { key: "pdf", icono: I.pdf, titulo: busy === "pdf" ? "Generando PDF…" : "Descargar PDF", sub: "Tu entrada con el QR, para guardar o imprimir",
      visible: actual?.approved !== false,
      run: async () => {
        setBusy("pdf");
        try { await downloadTicketPdf(ev, actual.id, { indice: idx + 1, total: items.length }); }
        catch (e) { avisar(e.message || "No se pudo generar el PDF."); }
        finally { setBusy(""); }
      } },
    { key: "org", icono: I.correo, titulo: "Contactar al organizador", sub: ev.organizerName || ev.hostName || "", visible: Boolean(ev.hostEmail),
      run: () => { window.location.href = `mailto:${ev.hostEmail}?subject=${encodeURIComponent("Consulta: " + (ev.title || "evento"))}`; } },
  ].filter((o) => o.visible);

  const alDesplazar = () => {
    const el = tiraRef.current; if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  const cuando = hora12(ev.startTime) ? `${hora12(ev.startTime)}${hora12(ev.endTime) ? ` – ${hora12(ev.endTime)}` : ""}` : "";

  return (
    <div role="dialog" aria-modal="true" aria-label={`Entrada: ${ev.title || "evento"}`}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "#0b0b0d", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      {/* Tinte del evento arriba, como en su página. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: "0 0 auto 0", height: 420, background: tinte ? tinte.glow : "linear-gradient(180deg, rgba(255,255,255,0.14), transparent)", pointerEvents: "none" }} />

      <div style={{ position: "relative", maxWidth: 460, margin: "0 auto", padding: "calc(14px + var(--ef-top-offset, 0px) + env(safe-area-inset-top)) 18px 40px" }}>
        <button type="button" onClick={onClose} aria-label="Cerrar entrada"
          style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", marginBottom: 18 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        {/* Entradas: una por pantalla, deslizables */}
        <div ref={tiraRef} onScroll={alDesplazar}
          style={{ display: "flex", overflowX: items.length > 1 ? "auto" : "hidden", scrollSnapType: "x mandatory", scrollbarWidth: "none", margin: "0 -18px", WebkitOverflowScrolling: "touch" }}>
          {items.map((t, i) => {
            const pendiente = t.approved === false;
            return (
              <div key={t.id} style={{ flex: "0 0 100%", scrollSnapAlign: "center", padding: "0 18px", boxSizing: "border-box" }}>
                <div style={{ position: "relative", background: "#ffffff", color: "#0b0b0d", borderRadius: 22, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
                  {/* Portada como cabecera de la boleta, con su muesca */}
                  <div style={{ position: "relative", aspectRatio: "16 / 9", background: "linear-gradient(135deg,#2a2b30,#151618)", overflow: "hidden" }}>
                    {ev.headerImage && <img src={ev.headerImage} alt="" style={coverImgStyle(ev.imagePos, ev.imageZoom)} />}
                  </div>
                  <span aria-hidden="true" style={{ position: "absolute", top: -17, left: "50%", marginLeft: -22, width: 44, height: 34, borderRadius: "50%", background: "#0b0b0d" }} />

                  <div style={{ padding: "18px 20px 18px", textAlign: "center" }}>
                    <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{ev.title || "Evento"}</div>
                    <div style={{ fontSize: 13.5, color: "#6b7078", marginTop: 4 }}>
                      {items.length > 1 ? `Entrada ${i + 1} de ${items.length}` : (ev.location || ev.city || "Entrada general")}
                    </div>

                    <div style={{ position: "relative", width: "min(250px, 70%)", margin: "14px auto 6px", aspectRatio: "1 / 1" }}>
                      <img src={qrUrlFor(t.id, 600)} alt={pendiente ? "QR pendiente de aprobación" : "Código QR de acceso"}
                        style={{ width: "100%", height: "100%", display: "block", opacity: t.used ? 0.22 : pendiente ? 0.3 : 1, filter: pendiente ? "blur(5px)" : "none" }} />
                      {(t.used || pendiente) && (
                        <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: "#f1f2f4", color: "#0b0b0d", fontSize: 14.5, fontWeight: 600, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
                          {t.used
                            ? <><svg width={18} height={18} viewBox="0 0 24 24" fill="#0b0b0d" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12.5 2.7 2.7L16 9.8" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>Ya escaneada</>
                            : <>Pendiente de aprobación</>}
                        </span>
                      )}
                    </div>
                    <div className="ef-app-font" style={{ fontSize: 12.5, color: "#8b9099", fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.04em" }}>
                      {t.id}{t.resale === "listed" ? " · en reventa" : ""}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, paddingTop: 14, borderTop: "1px dashed #d5d8de", fontSize: 14, fontWeight: 500 }}>
                      <span style={{ textTransform: "capitalize" }}>{fechaLarga(ev.startDate || ev.date)}</span>
                      <span>{cuando}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {items.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }} aria-hidden="true">
            {items.map((t, i) => <span key={t.id} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 6, background: i === idx ? "#fff" : "rgba(255,255,255,0.3)", transition: "width .2s" }} />)}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", justifyContent: "space-around", gap: 8, marginTop: 30 }}>
          <Accion icono={I.ojo} etiqueta="Ver evento" onClick={() => nav(`/e/${slug}`)} />
          {!pasado && actual && !actual.used && (
            esPago
              ? <Accion icono={I.revender} etiqueta={busy === "resale" ? "…" : enReventa ? "Quitar reventa" : "Revender"} onClick={revender} />
              : <Accion icono={I.cancelar} etiqueta="Cancelar" tono="#fca5a5" onClick={() => onCancel(actual.id)} />
          )}
          <Accion icono={I.mas} etiqueta="Más" onClick={() => setMenu(true)} />
        </div>

        {aviso && (
          <p role="status" style={{ margin: "22px auto 0", maxWidth: 360, textAlign: "center", fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 14px", lineHeight: 1.4 }}>{aviso}</p>
        )}
      </div>

      {/* Menú "Más" */}
      {menu && (
        <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 2, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} role="menu"
            style={{ width: "100%", maxWidth: 480, background: "#1c1d21", borderRadius: "24px 24px 0 0", padding: "10px 10px calc(18px + env(safe-area-inset-bottom))" }}>
            <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.25)", margin: "4px auto 10px" }} />
            {opciones.map((o) => (
              <button key={o.key} type="button" role="menuitem" className="ef-hover-fill" disabled={busy === "pdf" && o.key === "pdf"}
                onClick={async () => { await o.run(); if (o.key !== "pdf") setMenu(false); else setMenu(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "13px 12px", border: "none", borderRadius: 14, background: "transparent", color: "#fff", cursor: "pointer" }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center", flexShrink: 0 }}>{o.icono}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 500 }}>{o.titulo}</span>
                  {o.sub && <span style={{ display: "block", fontSize: 13, color: "rgba(229,238,255,0.56)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.sub}</span>}
                </span>
              </button>
            ))}
            <button type="button" className="soft-btn soft-btn-ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setMenu(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
