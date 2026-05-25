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

export async function sendVerificationEmail(email, name, token) {
  if (!emailEnabled) return;
  const link = `${APP_URL}/verify-email?token=${token}`;
  const firstName = (name || "anfitrión").split(" ")[0];

  await transporter.sendMail({
    from: EMAIL_FROM || `EventForm <${SMTP_USER}>`,
    to: email,
    subject: "Confirma tu cuenta en EventForm Colombia",
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <body style="margin:0;padding:0;background:#f5f7fa;font-family:system-ui,sans-serif">
        <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
          <div style="background:#0d3b66;padding:32px 40px;text-align:center">
            <span style="color:#4ade80;font-size:28px">●</span>
            <span style="color:#fff;font-size:20px;font-weight:800;margin-left:8px">EventForm</span>
          </div>
          <div style="padding:40px">
            <h2 style="color:#0d1b2a;font-size:22px;font-weight:700;margin:0 0 12px">
              Hola ${firstName} 👋
            </h2>
            <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 28px">
              Gracias por registrarte en <strong>EventForm Colombia</strong>.
              Haz clic en el botón para confirmar tu correo electrónico y acceder a tu cuenta.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${link}"
                 style="display:inline-block;padding:16px 36px;background:#0d3b66;color:#fff;
                        text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">
                Confirmar mi cuenta →
              </a>
            </div>
            <p style="color:#718096;font-size:13px;line-height:1.6;margin:0 0 8px">
              Si el botón no funciona, copia este enlace en tu navegador:
            </p>
            <p style="color:#0d3b66;font-size:12px;word-break:break-all;margin:0 0 28px">
              ${link}
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px" />
            <p style="color:#a0aec0;font-size:12px;margin:0">
              Si no creaste esta cuenta en EventForm, puedes ignorar este mensaje con seguridad.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}
