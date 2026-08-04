import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  RESEND_API_KEY,
  RESEND_FROM,
  APP_URL = "http://localhost:5173",
} = process.env;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
// Habilitado si hay Resend (preferido) o SMTP.
export const emailEnabled = Boolean(RESEND_API_KEY) || smtpConfigured;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// Remitente. Con Resend debe ser un dominio verificado (RESEND_FROM).
// Con SMTP (Gmail), el correo autenticado para que SPF/DKIM validen.
const FROM = RESEND_API_KEY
  ? (RESEND_FROM || EMAIL_FROM || "TapIn <onboarding@resend.dev>")
  : `TapIn <${SMTP_USER}>`;
const REPLY_TO = EMAIL_FROM || SMTP_USER || undefined;

// Envío unificado: usa Resend (HTTP API) si hay API key; si no, SMTP.
// attachments: [{ filename, content: Buffer, cid, contentType }]
async function deliver({ to, subject, html, text, attachments = [] }) {
  if (!emailEnabled) return;
  if (RESEND_API_KEY) {
    const body = {
      from: FROM,
      to: [to],
      subject,
      html,
      text,
      ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      ...(attachments.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_id: a.cid })) }
        : {}),
    };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }
  await transporter.sendMail({ from: FROM, replyTo: REPLY_TO, to, subject, html, text, attachments });
}

function emailLayout(content) {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0d3b66;padding:28px 40px;text-align:center">
      <span style="color:#4ade80;font-size:24px">●</span>
      <span style="color:#fff;font-size:18px;font-weight:800;margin-left:8px">TapIn</span>
    </div>
    <div style="padding:40px">${content}</div>
  </div></body></html>`;
}

export async function sendVerificationCode(email, name, code) {
  if (!emailEnabled) return;
  const firstName = (name || "anfitrión").split(" ")[0];
  await deliver({
    to: email,
    subject: "Tu código de verificación — TapIn",
    text: `Hola ${firstName},\n\nTu código de verificación de TapIn es: ${code}\nVálido por 15 minutos.\n\nSi no creaste esta cuenta, ignora este mensaje.`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">Hola ${firstName} 👋</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 28px">
        Ingresa este código para confirmar tu cuenta en <strong>TapIn Colombia</strong>:
      </p>
      <div style="text-align:center;margin:32px 0">
        <div style="display:inline-block;background:#f0f6fc;border:2px solid #0d3b66;border-radius:12px;padding:20px 40px">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#0d3b66">${code}</span>
        </div>
        <p style="color:#718096;font-size:13px;margin:16px 0 0">Válido por 15 minutos</p>
      </div>
      <p style="color:#a0aec0;font-size:12px;margin:0">Si no creaste esta cuenta, ignora este mensaje.</p>
    `),
  });
}

// Acepta una entrada o varias: quien reserva 3 recibe UN correo con los 3 QR,
// no tres correos sueltos.
export async function sendRegistrationConfirmation(email, name, ticketIds, event) {
  if (!emailEnabled) return;
  const ids = (Array.isArray(ticketIds) ? ticketIds : [ticketIds]).filter(Boolean);
  if (!ids.length) return;
  const varias = ids.length > 1;
  const firstName = (name || "asistente").split(" ")[0];
  const dateStr = event.startDate && event.startTime
    ? `${event.startDate} · ${event.startTime}`
    : event.startDate || "Fecha por confirmar";
  const loc = [event.city, event.location || event.address].filter(Boolean).join(" — ") || "Lugar por confirmar";

  const qrRemote = (id) => `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(id)}&bgcolor=ffffff&color=000000&margin=16&qzone=2`;

  // Cada QR se incrusta como adjunto inline (cid) para que no salga "en blanco"
  // ni dependa de cargar una imagen externa. Si falla, usa la URL remota.
  const attachments = [];
  const srcs = await Promise.all(ids.map(async (id, i) => {
    try {
      const r = await fetch(qrRemote(id), { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return qrRemote(id);
      const buf = Buffer.from(await r.arrayBuffer());
      const cid = `qrticket${i}`;
      attachments.push({ filename: `entrada-${i + 1}-qr.png`, content: buf, cid, contentType: "image/png" });
      return `cid:${cid}`;
    } catch { return qrRemote(id); }
  }));

  const bloques = ids.map((id, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${i === ids.length - 1 ? 28 : 20}px">
        <tr><td align="center" style="text-align:center">
          ${varias ? `<p style="font-size:12px;font-weight:800;color:#0d3b66;letter-spacing:1px;margin:0 0 10px;text-transform:uppercase">Entrada ${i + 1} de ${ids.length}</p>` : ""}
          <img src="${srcs[i]}" alt="QR de acceso" width="180" height="180" style="width:180px;height:180px;border-radius:12px;border:2px solid #0d3b66;background:#fff;display:inline-block"/>
          <p style="font-family:monospace;font-weight:800;font-size:13px;color:#0d3b66;margin:12px 0 4px;letter-spacing:1px">${id}</p>
          <p style="color:#718096;font-size:12px;margin:0">Presenta este QR en la entrada. Solo permite un ingreso.</p>
        </td></tr>
      </table>`).join("");

  await deliver({
    to: email,
    subject: varias
      ? `Tus ${ids.length} entradas para ${event.title} — TapIn`
      : `Tu entrada para ${event.title} — TapIn`,
    attachments,
    text: `¡Hola ${firstName}, ${varias ? `tus ${ids.length} lugares están confirmados` : "tu lugar está confirmado"}!\n\n`
      + `Evento: ${event.title}\nFecha: ${dateStr}\nLugar: ${loc}\n\n`
      + `${varias ? "IDs de tus entradas" : "ID de tu entrada"}: ${ids.join(", ")}\n`
      + `Presenta ${varias ? "un código QR por persona" : "el código QR de este correo"} en la entrada. Cada uno permite un solo ingreso.`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">
        ¡Hola ${firstName}, ${varias ? `tus ${ids.length} lugares están confirmados` : "tu lugar está confirmado"}! 🎉
      </h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px">
        Tu registro para <strong>${event.title}</strong> ha sido confirmado. Guarda este correo.
        ${varias ? "Cada acompañante entra con su propio código." : ""}
      </p>
      <div style="background:#f0f6fc;border-radius:12px;padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 6px;font-size:14px;color:#0d3b66;font-weight:700">📅 ${dateStr}</p>
        <p style="margin:0;font-size:14px;color:#0d3b66;font-weight:700">📍 ${loc}</p>
      </div>
      ${bloques}
    `),
  });
}

// Eventos con "Requerir aprobación": al inscribirse NO se manda el QR (todavía
// no sirve). El correo con la entrada se envía cuando el anfitrión aprueba,
// reutilizando sendRegistrationConfirmation.
export async function sendApprovalPending(email, name, event) {
  if (!emailEnabled) return;
  const firstName = (name || "asistente").split(" ")[0];
  const dateStr = event.startDate && event.startTime
    ? `${event.startDate} · ${event.startTime}`
    : event.startDate || "Fecha por confirmar";

  await deliver({
    to: email,
    subject: `Solicitud recibida para ${event.title} — TapIn`,
    text: `¡Hola ${firstName}! Recibimos tu solicitud para ${event.title} (${dateStr}).\n\nEste evento requiere la aprobación del organizador. Te avisamos en cuanto la revisen: tu entrada con código QR se activará automáticamente y podrás verla en la app, en "Mis tickets".`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">¡Hola ${firstName}! Recibimos tu solicitud ⏳</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px">
        Tu solicitud para <strong>${event.title}</strong> quedó registrada, pero este evento
        <strong>requiere la aprobación del organizador</strong>.
      </p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:14px;color:#9a3412;font-weight:700">📅 ${dateStr}</p>
        <p style="margin:0;font-size:14px;color:#9a3412">Tu código QR todavía no está activo.</p>
      </div>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0">
        En cuanto el organizador te apruebe, tu entrada se activa sola y te llega por correo.
        También puedes seguir el estado en la app, en <strong>Mis tickets</strong>.
      </p>
    `),
  });
}

export async function sendPasswordResetCode(email, name, code) {
  if (!emailEnabled) return;
  const firstName = (name || "usuario").split(" ")[0];
  await deliver({
    to: email,
    subject: "Código para restablecer tu contraseña — TapIn",
    text: `Hola ${firstName},\n\nUsa este código para restablecer tu contraseña de TapIn: ${code}\nVálido por 15 minutos.\n\nSi no solicitaste esto, ignora este mensaje.`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">Hola ${firstName}</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 28px">
        Usa este código para restablecer tu contraseña:
      </p>
      <div style="text-align:center;margin:32px 0">
        <div style="display:inline-block;background:#f0f6fc;border:2px solid #0d3b66;border-radius:12px;padding:20px 40px">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#0d3b66">${code}</span>
        </div>
        <p style="color:#718096;font-size:13px;margin:16px 0 0">Válido por 15 minutos</p>
      </div>
      <p style="color:#a0aec0;font-size:12px;margin:0">Si no solicitaste esto, ignora este mensaje.</p>
    `),
  });
}
