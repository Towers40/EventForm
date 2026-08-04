// Aritmética del dinero. Todo en PESOS ENTEROS: el COP no usa decimales en la
// práctica y trabajar con flotantes en dinero acaba en descuadres de un peso
// que no cierran contra los extractos de la pasarela.
//
// Reparto acordado:
//   · El comprador paga  P·N + cargo por servicio.
//   · El cargo por servicio cubre EXACTAMENTE la comisión de la pasarela
//     (con IVA), así que ni TapIn ni el organizador la asumen.
//   · De lo que queda (P·N), TapIn se lleva su comisión y el resto es del
//     organizador.

export const PRICING = {
  // Comisión de TapIn sobre el valor de las entradas (sin el cargo de servicio).
  platformFeePct: num(process.env.PLATFORM_FEE_PCT, 7),
  // Tarifa de la pasarela. Por defecto, la de tarjeta de ePayco (la más cara);
  // así el cargo cubre el peor caso y con PSE nunca queda corto.
  gateway: {
    percent: num(process.env.GATEWAY_FEE_PCT, 3.29),
    fixed:   num(process.env.GATEWAY_FEE_FIXED, 700),
    ivaPct:  num(process.env.GATEWAY_IVA_PCT, 19),
  },
  // El cargo se redondea hacia arriba a este múltiplo para no mostrar cifras
  // como "$2.387" al comprador.
  roundTo: num(process.env.SERVICE_FEE_ROUND, 50),
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const ceilTo = (v, step) => (step > 1 ? Math.ceil(v / step) * step : Math.ceil(v));

/**
 * Calcula el desglose de una compra.
 *
 * El cargo por servicio NO es un simple porcentaje del subtotal: la pasarela
 * cobra sobre el TOTAL que se le cobra al comprador, y ese total incluye el
 * propio cargo. Es una ecuación circular, así que se despeja el total:
 *
 *   T = subtotal + (T·p + f)·(1+iva)
 *   T = (subtotal + f·(1+iva)) / (1 − p·(1+iva))
 *
 * Cobrar en su lugar un "p% del subtotal" dejaría siempre corto el cargo y la
 * diferencia se la comería el organizador sin saberlo.
 */
export function computeOrder({ unitPrice, quantity, pricing = PRICING }) {
  const P = Math.max(0, Math.round(Number(unitPrice) || 0));
  const N = Math.max(1, Math.floor(Number(quantity) || 1));
  const subtotal = P * N;

  if (subtotal === 0) {
    return { unitPrice: 0, quantity: N, subtotal: 0, serviceFee: 0, total: 0, platformFee: 0, organizerNet: 0, gatewayFeeEstimate: 0 };
  }

  const iva = 1 + pricing.gateway.ivaPct / 100;
  const p = pricing.gateway.percent / 100;
  const f = pricing.gateway.fixed;

  const denom = 1 - p * iva;
  // Si la comisión porcentual con IVA llegara al 100% no habría total posible.
  if (denom <= 0) throw new Error("Configuración de tarifas inválida: la comisión de la pasarela es del 100% o más.");

  const totalExacto = (subtotal + f * iva) / denom;
  const serviceFee = Math.max(0, ceilTo(totalExacto - subtotal, pricing.roundTo));
  const total = subtotal + serviceFee;

  // Lo que la pasarela se llevará de ese total (estimado: el real depende del
  // medio de pago que elija el comprador).
  const gatewayFeeEstimate = Math.round((total * p + f) * iva);

  const platformFee = Math.round(subtotal * (pricing.platformFeePct / 100));
  const organizerNet = subtotal - platformFee;

  return { unitPrice: P, quantity: N, subtotal, serviceFee, total, platformFee, organizerNet, gatewayFeeEstimate };
}

/**
 * Devolución de una o varias entradas de una orden.
 *
 * Se devuelve el valor de la entrada, NUNCA el cargo por servicio: esa plata ya
 * se la quedó la pasarela y no se recupera. El reembolso se descuenta en
 * proporción de quien lo recibió: el organizador y TapIn.
 */
export function computeRefund({ order, quantity = null }) {
  const total = Math.max(1, Number(order.quantity) || 1);
  const n = Math.max(0, Math.min(Math.floor(Number(quantity ?? total)), total));
  if (n === 0) return { quantity: 0, refundAmount: 0, fromOrganizer: 0, fromPlatform: 0, notRefunded: 0 };

  const unit = Math.round(Number(order.subtotal) / total);
  const refundAmount = n === total ? Number(order.subtotal) : unit * n;

  // La parte de TapIn se calcula sobre lo devuelto y el resto sale del
  // organizador, para que los dos redondeos no dejen un peso suelto.
  const fromPlatform = Math.round(refundAmount * (PRICING.platformFeePct / 100));
  const fromOrganizer = refundAmount - fromPlatform;

  // Lo que el comprador no recupera: la parte proporcional del cargo.
  const notRefunded = Math.round((Number(order.serviceFee) || 0) * (n / total));

  return { quantity: n, refundAmount, fromOrganizer, fromPlatform, notRefunded };
}

/**
 * Reventa: A pone su entrada en reventa y B compra una entrada normal.
 *
 * No se le paga a A con la plata de B (eso obligaría a que cada asistente
 * fuera un receptor con KYC en la pasarela). Lo que ocurre es:
 *   · B hace una compra corriente → organizador y TapIn cobran como siempre.
 *   · A recibe una DEVOLUCIÓN de su compra original → el dinero vuelve por
 *     donde entró, sin cuentas de cobro ni dispersiones.
 * El resultado neto para cada parte es idéntico a un traspaso, y A pierde
 * exactamente el cargo por servicio, que es lo pactado.
 */
export function computeResale({ order, quantity = 1 }) {
  const r = computeRefund({ order, quantity });
  return {
    ...r,
    sellerRecovers: r.refundAmount,
    sellerLoses: r.notRefunded,
  };
}
