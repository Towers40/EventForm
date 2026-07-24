// Identidad de marca TapIn, centralizada para usarla en toda la app.
export const BRAND_NAME    = "TapIn";
export const CONTACT_EMAIL = "tapinwalletcol@gmail.com";

// Logo TapIn: símbolo "contactless / tap" (un punto con ondas que se expanden),
// el mismo gesto de pagar o entrar acercando el celular — rápido, fácil, seguro.
// Reemplaza al antiguo círculo verde liso. Hereda el color con currentColor.
export function TapInMark({ size = 20, color = "currentColor", style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <circle cx="7" cy="17" r="2.4" fill={color} />
      <path d="M7 11 A6 6 0 0 1 13 17" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M7 6.5 A10.5 10.5 0 0 1 17.5 17" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
