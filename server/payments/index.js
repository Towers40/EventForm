import { createMockProvider } from "./providers/mock.js";

// Selector de pasarela. `PAYMENT_PROVIDER=mock` (por defecto en local) usa la
// simulada; cuando exista el adaptador de ePayco se registra aquí y basta
// cambiar la variable de entorno.
const APP_URL = process.env.APP_URL || "http://localhost:5173";

let cached = null;

export function getPaymentProvider() {
  if (cached) return cached;
  const nombre = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  switch (nombre) {
    case "mock":
      cached = createMockProvider({ appUrl: APP_URL });
      break;
    default:
      throw new Error(`Pasarela desconocida: "${nombre}". Valores válidos: mock.`);
  }
  return cached;
}

// Los cobros solo se aceptan si hay una pasarela real configurada. Con la
// simulada se permite únicamente fuera de producción, para que un despliegue
// mal configurado no acabe "cobrando" con la de mentira.
export const paymentsEnabled = (() => {
  const nombre = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  if (nombre === "mock") return process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENTS === "true";
  return true;
})();

export * from "./provider.js";
export * from "./pricing.js";
