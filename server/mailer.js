import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  APP_URL = "http://localhost:5173",
} = process.env;

export const emailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// Remitente: SIEMPRE el correo autenticado (SMTP_USER) para que SPF/DKIM de
// Gmail validen y el mensaje no caiga en spam. (Usar un dominio sin autenticar
// como noreply@eventform.co haría fallar SPF → spam.) Para mejorar aún más la
// entregabilidad conviene publicar SPF, DKIM y DMARC del dominio remitente.
const FROM = `EventForm <${SMTP_USER}>`;
const REPLY_TO = EMAIL_FROM || SMTP_USER;

function emailLayout(content) {
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,sans-serif">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0d3b66;padding:28px 40px;text-align:center">
      <span style="color:#4ade80;font-size:24px">●</span>
      <span style="color:#fff;font-size:18px;font-weight:800;margin-left:8px">EventForm</span>
    </div>
    <div style="padding:40px">${content}</div>
  </div></body></html>`;
}

export async function sendVerificationCode(email, name, code) {
  if (!emailEnabled) return;
  const firstName = (name || "anfitrión").split(" ")[0];
  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to: email,
    subject: "Tu código de verificación — EventForm",
    text: `Hola ${firstName},\n\nTu código de verificación de EventForm es: ${code}\nVálido por 15 minutos.\n\nSi no creaste esta cuenta, ignora este mensaje.`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">Hola ${firstName} 👋</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 28px">
        Ingresa este código para confirmar tu cuenta en <strong>EventForm Colombia</strong>:
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

export async function sendRegistrationConfirmation(email, name, ticketId, event) {
  if (!emailEnabled) return;
  const firstName = (name || "asistente").split(" ")[0];
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(ticketId)}&bgcolor=ffffff&color=000000&margin=12&qzone=2`;
  const dateStr = event.startDate && event.startTime
    ? `${event.startDate} · ${event.startTime}`
    : event.startDate || "Fecha por confirmar";
  const loc = [event.city, event.location || event.address].filter(Boolean).join(" — ") || "Lugar por confirmar";
  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to: email,
    subject: `Tu entrada para ${event.title} — EventForm`,
    text: `¡Hola ${firstName}, estás inscrito!\n\nEvento: ${event.title}\nFecha: ${dateStr}\nLugar: ${loc}\n\nID de tu entrada: ${ticketId}\nPresenta el código QR de este correo en la entrada. Solo permite un ingreso.`,
    html: emailLayout(`
      <h2 style="color:#0d1b2a;font-size:20px;font-weight:700;margin:0 0 12px">¡Hola ${firstName}, estás inscrito! 🎉</h2>
      <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 24px">
        Tu registro para <strong>${event.title}</strong> ha sido confirmado. Guarda este correo.
      </p>
      <div style="background:#f0f6fc;border-radius:12px;padding:16px 20px;margin-bottom:28px">
        <p style="margin:0 0 6px;font-size:14px;color:#0d3b66;font-weight:700">📅 ${dateStr}</p>
        <p style="margin:0;font-size:14px;color:#0d3b66;font-weight:700">📍 ${loc}</p>
      </div>
      <div style="text-align:center;margin:0 0 28px">
        <img src="${qrUrl}" alt="QR de acceso" style="width:180px;height:180px;border-radius:12px;border:2px solid #0d3b66;display:block;margin:0 auto"/>
        <p style="font-family:monospace;font-weight:800;font-size:13px;color:#0d3b66;margin:12px 0 4px;letter-spacing:1px">${ticketId}</p>
        <p style="color:#718096;font-size:12px;margin:0">Presenta este QR en la entrada. Solo permite un ingreso.</p>
      </div>
    `),
  });
}

export async function sendPasswordResetCode(email, name, code) {
  if (!emailEnabled) return;
  const firstName = (name || "usuario").split(" ")[0];
  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to: email,
    subject: "Código para restablecer tu contraseña — EventForm",
    text: `Hola ${firstName},\n\nUsa este código para restablecer tu contraseña de EventForm: ${code}\nVálido por 15 minutos.\n\nSi no solicitaste esto, ignora este mensaje.`,
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
