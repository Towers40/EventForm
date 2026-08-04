// Aviso de despliegue que NO es producción.
//
// Vercel crea una URL de preview por cada push y quedan vivas para siempre.
// Son idénticas a producción a simple vista, así que es fácil abrir una vieja
// desde el panel de Vercel y creer que los cambios no se aplicaron. Se
// perdieron varias rondas de depuración por esto. El aviso del pie no bastaba:
// las páginas públicas (/discover, /e/:slug) ni siquiera lo tienen.
//
// En producción no pinta nada.

const PROD_URL = "https://event-form-navy.vercel.app";

export default function BuildBanner() {
  if (typeof __BUILD_ENV__ === "undefined" || __BUILD_ENV__ === "production") return null;

  const aquiVoy = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/app";

  return (
    <>
      {/* La barra es fija: se empuja el contenido para no tapar encabezados. */}
      <style>{`body { padding-top: 34px !important; }`}</style>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 34, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: "#fbbf24", color: "#1a1200",
        fontSize: 12.5, fontWeight: 700, letterSpacing: "0.01em",
        padding: "0 12px", boxSizing: "border-box",
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          ⚠️ Versión de prueba ({__BUILD_ENV__} · {__BUILD_ID__}) — no es producción
        </span>
        <a
          href={PROD_URL + aquiVoy}
          style={{
            flexShrink: 0, background: "#1a1200", color: "#fbbf24",
            textDecoration: "none", borderRadius: 100, padding: "3px 12px",
            fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap",
          }}
        >
          Ir a producción →
        </a>
      </div>
    </>
  );
}
