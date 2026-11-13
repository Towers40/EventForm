// Exportar una entrada: evento de calendario (.ics / Google) y PDF.
// Sin dependencias: el PDF es una sola página con la entrada dibujada en un
// canvas e incrustada como JPEG (lo que el formato PDF admite tal cual).
import { qrUrlFor } from "../components/PendingQr.jsx";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "Fecha por confirmar";
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DIAS[d.getDay()]} ${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}`;
}
export function hora12(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
export const lugarDe = (ev) => [ev?.location, ev?.address && ev.address !== ev.location ? ev.address : null, ev?.city]
  .filter(Boolean).filter((v, i, a) => a.findIndex((x) => String(v).includes(x) || String(x).includes(v)) === i).join(", ");

// ── Calendario ──────────────────────────────────────────────────────────────
// Las horas del evento son de Colombia (UTC−5, sin horario de verano): se
// pasan a UTC para que el calendario las coloque bien en cualquier zona.
function utc(fecha, hora, masHoras = 0) {
  const f = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || "");
  if (!f) return null;
  const h = /^(\d{1,2}):(\d{2})/.exec(hora || "");
  const d = new Date(Date.UTC(+f[1], +f[2] - 1, +f[3], (h ? +h[1] : 9) + 5 + masHoras, h ? +h[2] : 0));
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function rango(ev) {
  const inicio = utc(ev.startDate || ev.date, ev.startTime);
  if (!inicio) return null;
  const fin = (ev.endTime || ev.endDate) && utc(ev.endDate || ev.startDate || ev.date, ev.endTime || ev.startTime, ev.endTime ? 0 : 2);
  return { inicio, fin: fin && fin > inicio ? fin : utc(ev.startDate || ev.date, ev.startTime, 2) };
}
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Abre el calendario del dispositivo con el evento ya rellenado. */
export function addToCalendar(ev, ticketId, urlEvento) {
  const r = rango(ev);
  if (!r) return false;
  const lugar = lugarDe(ev);
  const detalle = `Tu entrada: ${ticketId}\n${urlEvento}`;
  // Android: Google Calendar abre el evento listo para guardar.
  if (/android/i.test(navigator.userAgent)) {
    const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title || "Evento", dates: `${r.inicio}/${r.fin}`, details: detalle, location: lugar });
    window.open(`https://calendar.google.com/calendar/render?${q}`, "_blank", "noopener");
    return true;
  }
  // iPhone, Mac y demás: archivo .ics, que el sistema abre en su calendario.
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TapIn//Entradas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${ticketId}@tapin`, `DTSTAMP:${utc(new Date().toISOString().slice(0, 10), "00:00", -5) }`,
    `DTSTART:${r.inicio}`, `DTEND:${r.fin}`, `SUMMARY:${esc(ev.title || "Evento")}`,
    lugar ? `LOCATION:${esc(lugar)}` : null, `DESCRIPTION:${esc(detalle)}`, `URL:${urlEvento}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.title || "Evento")}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  descargar(new Blob([ics], { type: "text/calendar;charset=utf-8" }), `${slugArchivo(ev.title)}.ics`);
  return true;
}

const slugArchivo = (t) => (String(t || "evento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "evento").toLowerCase();

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── PDF ─────────────────────────────────────────────────────────────────────
async function cargar(url) {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    return await createImageBitmap(await r.blob());
  } catch { return null; }
}

function partir(ctx, texto, ancho, maxLineas) {
  const lineas = []; let linea = "";
  for (const palabra of String(texto).split(/\s+/)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > ancho && linea) { lineas.push(linea); linea = palabra; } else linea = prueba;
  }
  if (linea) lineas.push(linea);
  if (lineas.length > maxLineas) { lineas.length = maxLineas; lineas[maxLineas - 1] = lineas[maxLineas - 1].replace(/.{0,3}$/, "…"); }
  return lineas;
}

/** Dibuja la entrada (portada, datos y QR) y la descarga como PDF de una página. */
export async function downloadTicketPdf(ev, ticketId, { indice = 1, total = 1 } = {}) {
  const W = 1240, H = 1754; // A5 a 150 ppp
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);

  const [portada, qr] = await Promise.all([
    String(ev.headerImage || "").startsWith("http") ? cargar(ev.headerImage) : null,
    cargar(qrUrlFor(ticketId, 700)),
  ]);
  if (!qr) throw new Error("No se pudo generar el QR. Revisa tu conexión e inténtalo de nuevo.");

  // Portada (recorte "cover" con el encuadre del organizador).
  const AH = 520;
  if (portada) {
    const k = Math.max(W / portada.width, AH / portada.height) * Math.max(1, Number(ev.imageZoom) || 1);
    const w = portada.width * k, h = portada.height * k;
    const px = (Number(ev.imagePos?.x ?? 50)) / 100, py = (Number(ev.imagePos?.y ?? 50)) / 100;
    x.save(); x.beginPath(); x.rect(0, 0, W, AH); x.clip();
    x.drawImage(portada, (W - w) * px, (AH - h) * py, w, h);
    x.restore();
  } else {
    const g = x.createLinearGradient(0, 0, W, AH); g.addColorStop(0, "#1b1d21"); g.addColorStop(1, "#34d399");
    x.fillStyle = g; x.fillRect(0, 0, W, AH);
  }

  const F = "'Onest', 'Helvetica Neue', Arial, sans-serif";
  x.textAlign = "center"; x.fillStyle = "#0b0b0d";
  x.font = `600 62px ${F}`;
  let y = AH + 110;
  for (const l of partir(x, ev.title || "Evento", W - 160, 2)) { x.fillText(l, W / 2, y); y += 74; }
  x.fillStyle = "#5b606b"; x.font = `400 36px ${F}`;
  const cuando = [fechaLarga(ev.startDate || ev.date), hora12(ev.startTime)].filter(Boolean).join(" · ");
  x.fillText(cuando, W / 2, y + 6); y += 56;
  const lugar = lugarDe(ev);
  if (lugar) { for (const l of partir(x, lugar, W - 200, 2)) { x.fillText(l, W / 2, y + 6); y += 46; } }

  const Q = 560, qy = Math.max(y + 40, 900);
  x.imageSmoothingEnabled = false;
  x.drawImage(qr, (W - Q) / 2, qy, Q, Q);
  x.imageSmoothingEnabled = true;
  x.fillStyle = "#0b0b0d"; x.font = `600 34px ui-monospace, Menlo, monospace`;
  x.fillText(ticketId, W / 2, qy + Q + 56);
  x.fillStyle = "#5b606b"; x.font = `400 30px ${F}`;
  x.fillText(total > 1 ? `Entrada ${indice} de ${total} · Presenta este QR en la entrada` : "Presenta este QR en la entrada. Permite un solo ingreso.", W / 2, qy + Q + 108);
  x.fillStyle = "#9aa0aa"; x.font = `600 28px ${F}`;
  x.fillText("TapIn", W / 2, H - 60);

  const jpeg = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
  const img = new Uint8Array(await jpeg.arrayBuffer());
  descargar(pdfConJpeg(img, W, H), `entrada-${slugArchivo(ev.title)}.pdf`);
}

/** PDF mínimo de una página A5 con un JPEG a sangre. */
function pdfConJpeg(jpeg, w, h) {
  const enc = new TextEncoder();
  const PW = 419.53, PH = 595.28; // A5 en puntos
  const contenido = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  const partes = []; const offsets = []; let pos = 0;
  const push = (d) => { const b = typeof d === "string" ? enc.encode(d) : d; partes.push(b); pos += b.length; };
  const obj = (n, cuerpo) => { offsets[n] = pos; push(`${n} 0 obj\n`); cuerpo(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push("\nendstream"); });
  obj(5, () => push(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`));
  const xref = pos;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offsets[n]).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: "application/pdf" });
}
