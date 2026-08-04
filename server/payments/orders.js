import { db, parseEvent } from "../db.js";
import { capacityMaxOf } from "../capacity.js";
import { computeOrder, computeRefund } from "./pricing.js";
import { getPaymentProvider, PAYMENT_STATUS, REG_PAYMENT, HOLD_MINUTES, PaymentError } from "./index.js";

const uid = () => Math.random().toString(36).slice(2, 12).toUpperCase();
const now = () => Date.now();

// ── Cupos ───────────────────────────────────────────────────────────────────

/**
 * Marca como caducadas las reservas que nadie terminó de pagar. Se llama ANTES
 * de cualquier conteo de aforo: sin esto, un checkout abandonado bloquearía el
 * cupo para siempre. Se hace por demanda y no con una tarea programada porque
 * en serverless no hay proceso vivo que la ejecute.
 */
export async function releaseExpiredHolds(eventId, tx = db) {
  await tx.execute({
    sql: `UPDATE registrations SET cancelled = 1, payment_status = ?
          WHERE event_id = ? AND cancelled = 0 AND payment_status = ?
            AND order_id IN (SELECT id FROM payment_orders WHERE status = ? AND reserved_until < ?)`,
    args: [REG_PAYMENT.EXPIRED, eventId, REG_PAYMENT.PENDING, PAYMENT_STATUS.PENDING, now()],
  });
  await tx.execute({
    sql: `UPDATE payment_orders SET status = ?, updated_at = ?
          WHERE event_id = ? AND status = ? AND reserved_until < ?`,
    args: [PAYMENT_STATUS.EXPIRED, now(), eventId, PAYMENT_STATUS.PENDING, now()],
  });
}

/**
 * Entradas que ocupan cupo. Las puestas en reventa NO cuentan: su asiento se
 * ofrece de nuevo, aunque la entrada siga siendo válida para su dueño hasta que
 * alguien la compre.
 */
export async function countOccupied(eventId, tx = db) {
  const { rows } = await tx.execute({
    sql: `SELECT COUNT(*) AS c FROM registrations
          WHERE event_id = ? AND cancelled = 0 AND resale_status != 'listed'`,
    args: [eventId],
  });
  return Number(rows[0]?.c || 0);
}

// ── Crear la orden ──────────────────────────────────────────────────────────

/**
 * Reserva los cupos y crea el cobro. Las inscripciones nacen en `pending`: ya
 * ocupan asiento pero su QR todavía no sirve, y solo pasan a `paid` cuando la
 * pasarela confirma por webhook. Emitir el QR antes de cobrar sería regalar la
 * entrada a quien abandone el checkout.
 */
export async function createOrder({ event, form, quantity, consentPrivacy, consentMarketing, buyerEmail, buyerUserId, capacityMax, maxPerUser, urls }) {
  if (!event.isPaid || !(Number(event.price) > 0)) {
    throw new PaymentError("Este evento no es de pago.", { code: "not_paid", status: 400 });
  }
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const desglose = computeOrder({ unitPrice: Number(event.price), quantity: qty });

  await releaseExpiredHolds(event.id);

  // Aforo y tope por persona, con los cupos ya liberados.
  if (capacityMax != null) {
    const ocupados = await countOccupied(event.id);
    if (ocupados + qty > capacityMax) {
      throw new PaymentError("sold_out", { code: "sold_out", status: 403 });
    }
  }
  if (buyerEmail && maxPerUser > 1) {
    const { rows } = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM registrations
            WHERE event_id = ? AND cancelled = 0 AND lower(email) = ? AND resale_status != 'listed'`,
      args: [event.id, buyerEmail],
    });
    const mias = Number(rows[0]?.c || 0);
    if (mias + qty > maxPerUser) {
      throw new PaymentError("limit_per_user", { code: "limit_per_user", status: 403, raw: { maxPerUser, already: mias } });
    }
  }

  const orderId = "ORD" + uid();
  const reservedUntil = now() + HOLD_MINUTES * 60_000;
  const approved = event.requireApproval ? 0 : 1;

  await db.execute({
    sql: `INSERT INTO payment_orders
      (id, event_id, buyer_email, buyer_user_id, quantity, unit_price, subtotal, service_fee, total,
       platform_fee, organizer_net, currency, status, provider, form_payload,
       consent_privacy, consent_marketing, reserved_until, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'COP',?,?,?,?,?,?,?,?)`,
    args: [
      orderId, event.id, buyerEmail || null, buyerUserId || null, qty,
      desglose.unitPrice, desglose.subtotal, desglose.serviceFee, desglose.total,
      desglose.platformFee, desglose.organizerNet, PAYMENT_STATUS.PENDING,
      getPaymentProvider().name, JSON.stringify(form || {}),
      consentPrivacy ? 1 : 0, consentMarketing ? 1 : 0, reservedUntil, now(), now(),
    ],
  });

  // Una inscripción (y un QR) por entrada, todas atadas a la orden.
  const ticketIds = Array.from({ length: qty }, () => "TICKET-" + uid());
  for (const tid of ticketIds) {
    await db.execute({
      sql: `INSERT INTO registrations
        (id, event_id, ticket_id, payload, used, checked_in_at, consent_privacy, consent_marketing,
         created_at, email, approved, order_id, payment_status)
        VALUES (?,?,?,?,0,NULL,?,?,?,?,?,?,?)`,
      args: ["R" + uid(), event.id, tid, JSON.stringify(form || {}),
        consentPrivacy ? 1 : 0, consentMarketing ? 1 : 0, now(), buyerEmail || null,
        approved, orderId, REG_PAYMENT.PENDING],
    });
  }

  let checkout;
  try {
    checkout = await getPaymentProvider().createCheckout({
      order: { id: orderId, ...desglose },
      event,
      buyer: { email: buyerEmail },
      urls,
    });
  } catch (e) {
    // Si la pasarela no acepta el cobro, se sueltan los cupos en el acto en vez
    // de dejarlos bloqueados hasta que caduquen.
    await cancelOrder(orderId, PAYMENT_STATUS.DECLINED);
    throw new PaymentError(e.message || "No se pudo iniciar el pago.", { code: "checkout_failed" });
  }

  await db.execute({
    sql: `UPDATE payment_orders SET provider_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ?`,
    args: [checkout.providerRef, checkout.checkoutUrl, now(), orderId],
  });

  return { orderId, checkoutUrl: checkout.checkoutUrl, providerRef: checkout.providerRef, ticketIds, ...desglose, reservedUntil };
}

// ── Confirmar / rechazar ────────────────────────────────────────────────────

export async function getOrder(orderId) {
  const { rows } = await db.execute({ sql: "SELECT * FROM payment_orders WHERE id = ?", args: [orderId] });
  return rows[0] || null;
}

export async function getOrderByRef(providerRef) {
  const { rows } = await db.execute({ sql: "SELECT * FROM payment_orders WHERE provider_ref = ?", args: [providerRef] });
  return rows[0] || null;
}

/**
 * Registra el evento de webhook y dice si es la PRIMERA vez que se ve. Las
 * pasarelas reintentan hasta recibir un 200, así que sin esto una confirmación
 * repetida emitiría los QR (y los correos) por duplicado.
 */
export async function markWebhookSeen({ eventKey, orderId, provider, status }) {
  try {
    await db.execute({
      sql: `INSERT INTO payment_events (id, order_id, provider, status, received_at) VALUES (?,?,?,?,?)`,
      args: [eventKey, orderId || null, provider || null, status || null, now()],
    });
    return true;
  } catch (e) {
    if (/unique|constraint/i.test(e.message || "")) return false; // ya procesado
    throw e;
  }
}

export async function cancelOrder(orderId, status = PAYMENT_STATUS.DECLINED) {
  await db.execute({
    sql: `UPDATE registrations SET cancelled = 1, payment_status = ? WHERE order_id = ? AND payment_status = ?`,
    args: [REG_PAYMENT.EXPIRED, orderId, REG_PAYMENT.PENDING],
  });
  await db.execute({
    sql: `UPDATE payment_orders SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, now(), orderId],
  });
}

/**
 * Pago aprobado: las entradas pasan a válidas y, si había entradas en reventa,
 * esta compra las "recompra" (ver consumeResaleTickets).
 * Devuelve los ticket_id emitidos para que quien llama mande UN correo.
 */
export async function approveOrder(orderId) {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.status === PAYMENT_STATUS.APPROVED) {
    return { order, ticketIds: await ticketIdsOf(orderId), yaEstaba: true, resold: [] };
  }

  // Pago que llega DESPUÉS de que la reserva caducara. Pasa de verdad: con PSE
  // el banco puede confirmar minutos más tarde. Las inscripciones ya se
  // anularon, así que aprobar sin más dejaría a la persona pagando sin entrada.
  if (order.status === PAYMENT_STATUS.EXPIRED) {
    const recuperado = await reviveExpiredOrder(order);
    if (!recuperado) {
      // Ya no hay cupo: se devuelve el dinero íntegro (incluido el cargo, que
      // aquí no es culpa del comprador) y la orden queda como devuelta.
      let refundOk = false;
      try {
        const res = await getPaymentProvider().refund({
          providerRef: order.provider_ref, amount: Number(order.total), reason: "reserva caducada sin cupo",
        });
        refundOk = Boolean(res?.ok);
      } catch (e) { console.error("[pagos] devolución de orden caducada fallida:", e.message); }
      await db.execute({
        sql: `UPDATE payment_orders SET status = ?, refunded_amount = ?, updated_at = ? WHERE id = ?`,
        args: [PAYMENT_STATUS.REFUNDED, refundOk ? Number(order.total) : 0, now(), order.id],
      });
      return { order, ticketIds: [], yaEstaba: false, resold: [], expiredNoSeats: true, refundOk };
    }
  }

  await db.execute({
    sql: `UPDATE registrations SET payment_status = ? WHERE order_id = ? AND cancelled = 0`,
    args: [REG_PAYMENT.PAID, orderId],
  });
  await db.execute({
    sql: `UPDATE payment_orders SET status = ?, reserved_until = NULL, updated_at = ? WHERE id = ?`,
    args: [PAYMENT_STATUS.APPROVED, now(), orderId],
  });

  const resold = await consumeResaleTickets(order.event_id, Number(order.quantity) || 1);
  return { order, ticketIds: await ticketIdsOf(orderId), yaEstaba: false, resold };
}

/**
 * Intenta devolver a la vida las inscripciones de una orden que caducó, si
 * todavía queda aforo. Devuelve false si el evento ya se llenó mientras tanto.
 */
async function reviveExpiredOrder(order) {
  const { rows } = await db.execute({ sql: "SELECT * FROM events WHERE id = ?", args: [order.event_id] });
  if (!rows[0]) return false;
  const ev = parseEvent(rows[0]);

  await releaseExpiredHolds(ev.id);
  const max = capacityMaxOf(ev);
  const cantidad = Number(order.quantity) || 1;
  if (max != null && (await countOccupied(ev.id)) + cantidad > max) return false;

  const r = await db.execute({
    sql: `UPDATE registrations SET cancelled = 0, payment_status = ?
          WHERE order_id = ? AND payment_status = ?`,
    args: [REG_PAYMENT.PENDING, order.id, REG_PAYMENT.EXPIRED],
  });
  if (!Number(r.rowsAffected)) return false;

  await db.execute({
    sql: `UPDATE payment_orders SET status = ?, updated_at = ? WHERE id = ?`,
    args: [PAYMENT_STATUS.PENDING, now(), order.id],
  });
  return true;
}

async function ticketIdsOf(orderId) {
  const { rows } = await db.execute({
    sql: "SELECT ticket_id FROM registrations WHERE order_id = ? AND cancelled = 0 ORDER BY created_at",
    args: [orderId],
  });
  return rows.map(r => r.ticket_id);
}

// ── Reventa ─────────────────────────────────────────────────────────────────

/**
 * Poner una entrada en reventa. No se anula: su dueño puede seguir yendo si
 * nadie la compra. Lo único que cambia es que su asiento vuelve a ofrecerse.
 */
export async function listForResale(ticketId, { email }) {
  const { rows } = await db.execute({
    sql: `SELECT r.*, o.status AS order_status FROM registrations r
          LEFT JOIN payment_orders o ON o.id = r.order_id
          WHERE r.ticket_id = ?`,
    args: [String(ticketId).trim().toUpperCase()],
  });
  const reg = rows[0];
  if (!reg) throw new PaymentError("Entrada no encontrada", { code: "not_found", status: 404 });
  if (email && String(reg.email || "").toLowerCase() !== String(email).toLowerCase()) {
    throw new PaymentError("Esta entrada no es tuya.", { code: "forbidden", status: 403 });
  }
  if (reg.cancelled) throw new PaymentError("Esta entrada está cancelada.", { code: "cancelled", status: 400 });
  if (reg.used) throw new PaymentError("Esta entrada ya se usó para ingresar.", { code: "used", status: 400 });
  if (reg.payment_status !== REG_PAYMENT.PAID) {
    throw new PaymentError("Solo se pueden revender entradas pagadas.", { code: "not_paid", status: 400 });
  }
  if (reg.resale_status === "listed") return { ok: true, already: true };

  await db.execute({
    sql: `UPDATE registrations SET resale_status = 'listed', resale_listed_at = ? WHERE id = ?`,
    args: [now(), reg.id],
  });
  return { ok: true };
}

export async function unlistResale(ticketId, { email }) {
  const { rows } = await db.execute({
    sql: "SELECT * FROM registrations WHERE ticket_id = ?",
    args: [String(ticketId).trim().toUpperCase()],
  });
  const reg = rows[0];
  if (!reg) throw new PaymentError("Entrada no encontrada", { code: "not_found", status: 404 });
  if (email && String(reg.email || "").toLowerCase() !== String(email).toLowerCase()) {
    throw new PaymentError("Esta entrada no es tuya.", { code: "forbidden", status: 403 });
  }
  if (reg.resale_status !== "listed") return { ok: true, already: true };
  await db.execute({ sql: `UPDATE registrations SET resale_status = 'none', resale_listed_at = NULL WHERE id = ?`, args: [reg.id] });
  return { ok: true };
}

/**
 * Cierra hasta `cantidad` reventas cuando entra una compra nueva, por orden de
 * antigüedad (primero quien lleva más tiempo esperando).
 *
 * Aquí está la decisión de diseño importante: al vendedor NO se le paga con el
 * dinero del comprador nuevo. Se le hace una DEVOLUCIÓN de su compra original,
 * que le devuelve el dinero por donde entró. Pagarle directamente obligaría a
 * que cada asistente fuera un receptor dado de alta en la pasarela, con su
 * KYC — inviable para un asistente cualquiera. El resultado neto es el mismo:
 * el organizador cobra una sola vez por el asiento y el vendedor recupera todo
 * menos el cargo por servicio.
 */
export async function consumeResaleTickets(eventId, cantidad) {
  if (!(cantidad > 0)) return [];
  const { rows } = await db.execute({
    sql: `SELECT * FROM registrations
          WHERE event_id = ? AND resale_status = 'listed' AND cancelled = 0 AND used = 0
          ORDER BY resale_listed_at ASC LIMIT ?`,
    args: [eventId, cantidad],
  });

  const cerradas = [];
  for (const reg of rows) {
    const order = reg.order_id ? await getOrder(reg.order_id) : null;
    if (!order) continue;

    const devolucion = computeRefund({ order, quantity: 1 });
    let refundOk = false, refundRef = null;
    try {
      const res = await getPaymentProvider().refund({
        providerRef: order.provider_ref,
        amount: devolucion.refundAmount,
        reason: "resale",
      });
      refundOk = Boolean(res?.ok);
      refundRef = res?.refundRef || null;
    } catch (e) {
      // La devolución quedará pendiente de revisión manual, pero la entrada NO
      // se anula: sería lo peor de los dos mundos (sin entrada y sin dinero).
      console.error("[reventa] devolución fallida para", reg.ticket_id, e.message);
    }
    if (!refundOk) continue;

    await db.execute({
      sql: `UPDATE registrations SET cancelled = 1, resale_status = 'sold', payment_status = ? WHERE id = ?`,
      args: [REG_PAYMENT.REFUNDED, reg.id],
    });
    await db.execute({
      sql: `UPDATE payment_orders SET refunded_amount = refunded_amount + ?, status = ?, updated_at = ? WHERE id = ?`,
      args: [
        devolucion.refundAmount,
        devolucion.refundAmount >= Number(order.subtotal) ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
        now(), order.id,
      ],
    });
    cerradas.push({ ticketId: reg.ticket_id, email: reg.email, refundRef, ...devolucion });
  }
  return cerradas;
}

/** Cuántas entradas de este evento están ofrecidas en reventa. */
export async function countResaleListed(eventId) {
  const { rows } = await db.execute({
    sql: `SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND resale_status = 'listed' AND cancelled = 0`,
    args: [eventId],
  });
  return Number(rows[0]?.c || 0);
}

// ── Devolución a petición del asistente ─────────────────────────────────────

/**
 * Cancelar una entrada pagada. Devuelve el valor de la entrada pero nunca el
 * cargo por servicio: esa parte ya se la quedó la pasarela.
 */
export async function refundTicket(ticketId, { email } = {}) {
  const { rows } = await db.execute({
    sql: "SELECT * FROM registrations WHERE ticket_id = ?",
    args: [String(ticketId).trim().toUpperCase()],
  });
  const reg = rows[0];
  if (!reg) throw new PaymentError("Entrada no encontrada", { code: "not_found", status: 404 });
  if (email && String(reg.email || "").toLowerCase() !== String(email).toLowerCase()) {
    throw new PaymentError("Esta entrada no es tuya.", { code: "forbidden", status: 403 });
  }
  if (reg.used) throw new PaymentError("Esta entrada ya se usó para ingresar.", { code: "used", status: 400 });
  if (reg.payment_status !== REG_PAYMENT.PAID) {
    // Gratis o sin pagar: se cancela sin mover dinero.
    await db.execute({ sql: "UPDATE registrations SET cancelled = 1 WHERE id = ?", args: [reg.id] });
    return { ok: true, refunded: 0 };
  }

  const order = await getOrder(reg.order_id);
  const devolucion = computeRefund({ order, quantity: 1 });
  const res = await getPaymentProvider().refund({
    providerRef: order.provider_ref, amount: devolucion.refundAmount, reason: "cancelación del asistente",
  });
  if (!res?.ok) throw new PaymentError("La pasarela rechazó la devolución.", { code: "refund_failed" });

  await db.execute({
    sql: `UPDATE registrations SET cancelled = 1, payment_status = ?, resale_status = 'none' WHERE id = ?`,
    args: [REG_PAYMENT.REFUNDED, reg.id],
  });
  await db.execute({
    sql: `UPDATE payment_orders SET refunded_amount = refunded_amount + ?, status = ?, updated_at = ? WHERE id = ?`,
    args: [
      devolucion.refundAmount,
      Number(order.refunded_amount || 0) + devolucion.refundAmount >= Number(order.subtotal)
        ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
      now(), order.id,
    ],
  });
  return { ok: true, refunded: devolucion.refundAmount, notRefunded: devolucion.notRefunded };
}
