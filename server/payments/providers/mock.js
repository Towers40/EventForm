import crypto from "crypto";
import { PAYMENT_STATUS } from "../provider.js";

// Pasarela simulada para desarrollo y pruebas.
//
// No mueve dinero: expone una página local donde se aprueba o rechaza el pago a
// mano y dispara el mismo webhook firmado que enviaría una pasarela real. Sirve
// para probar el flujo completo (reserva de cupo, confirmación, emisión del QR,
// caducidad y devoluciones) sin credenciales ni cobros de verdad.
export function createMockProvider({ secret = process.env.PAYMENT_MOCK_SECRET || "mock-secret", appUrl }) {
  const sign = (body) => crypto.createHmac("sha256", secret).update(body).digest("hex");

  return {
    name: "mock",

    async createCheckout({ order, urls }) {
      const providerRef = "MOCK-" + crypto.randomBytes(6).toString("hex").toUpperCase();
      const qs = new URLSearchParams({
        ref: providerRef,
        order: order.id,
        amount: String(order.total),
        ret: urls?.returnUrl || `${appUrl}/pago/${order.id}`,
      });
      return { checkoutUrl: `${appUrl}/pago/simulado?${qs}`, providerRef, raw: { simulated: true } };
    },

    verifyWebhook({ headers, rawBody }) {
      const recibida = headers["x-mock-signature"] || headers["X-Mock-Signature"];
      if (!recibida || typeof rawBody !== "string") return false;
      const esperada = sign(rawBody);
      // Comparación en tiempo constante: comparar con === filtra secretos.
      const a = Buffer.from(String(recibida));
      const b = Buffer.from(esperada);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },

    parseWebhook({ body }) {
      const estados = {
        approved: PAYMENT_STATUS.APPROVED,
        declined: PAYMENT_STATUS.DECLINED,
        pending: PAYMENT_STATUS.PENDING,
        refunded: PAYMENT_STATUS.REFUNDED,
      };
      return {
        providerRef: body?.reference || null,
        orderId: body?.order_id || null,
        status: estados[body?.status] || PAYMENT_STATUS.PENDING,
        amount: Number(body?.amount) || 0,
        raw: body,
      };
    },

    async refund({ providerRef, amount }) {
      return { ok: true, refundRef: `MOCKREF-${providerRef}-${amount}`, raw: { simulated: true } };
    },

    // Solo del simulador: firma un cuerpo para poder disparar el webhook desde
    // la página de prueba o desde un script.
    _sign: sign,
  };
}
