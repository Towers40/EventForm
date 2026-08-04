// Interfaz de pasarela de pagos.
//
// Todo lo que sabe la app de pagos pasa por aquí, para que conectar ePayco (o
// cambiar de proveedor) sea escribir una implementación y no tocar las rutas.
//
// Un proveedor debe exponer:
//
//   name
//   async createCheckout({ order, event, buyer, urls })
//       → { checkoutUrl, providerRef, raw }
//       Crea el cobro en la pasarela. `order` ya trae el reparto calculado
//       (subtotal, cargo por servicio, comisión de TapIn, neto del organizador)
//       y `event.payoutAccountId` el identificador del organizador como
//       receptor del split.
//
//   verifyWebhook({ headers, rawBody })  → boolean
//       Comprueba la firma. Si devuelve false, la petición se descarta: sin
//       esto cualquiera podría confirmar pagos por su cuenta.
//
//   parseWebhook({ headers, body })
//       → { providerRef, orderId, status, amount, raw }
//       `status` normalizado: "approved" | "declined" | "pending" | "refunded".
//
//   async refund({ providerRef, amount, reason })
//       → { ok, refundRef, raw }
//
// Ninguna implementación debe tocar la base de datos: de eso se encarga quien
// llama, para que la lógica de negocio viva en un solo sitio.

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
});

// Estado de pago de cada inscripción (columna `payment_status`).
export const REG_PAYMENT = Object.freeze({
  NOT_REQUIRED: "not_required", // evento gratis
  PENDING: "pending",           // reserva el cupo, todavía sin QR válido
  PAID: "paid",
  EXPIRED: "expired",
  REFUNDED: "refunded",
});

// Minutos que se guarda el cupo mientras la persona termina de pagar. PSE
// abre el banco en otra pestaña y puede tardar, por eso no es un minuto.
export const HOLD_MINUTES = Number(process.env.PAYMENT_HOLD_MINUTES) || 20;

export class PaymentError extends Error {
  constructor(message, { code = "payment_error", status = 502, raw = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.raw = raw;
  }
}
