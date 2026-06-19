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
    from: `EventForm Colombia <${SMTP_USER}>`,
    to: email,
    subject: "Tu código de verificación — EventForm",
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

export async function sendPasswordResetCode(email, name, code) {
  if (!emailEnabled) return;
  const firstName = (name || "usuario").split(" ")[0];
  await transporter.sendMail({
    from: `EventForm Colombia <${SMTP_USER}>`,
    to: email,
    subject: "Código para restablecer tu contraseña — EventForm",
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
