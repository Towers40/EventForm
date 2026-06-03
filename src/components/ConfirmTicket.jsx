import NavigateButtons from "./NavigateButtons.jsx";
import LocationMap from "./LocationMap.jsx";
import { NEGRO_PURO, AZUL_CLARO_BG, VERDE_CORPORATIVO, BLANCO_CONTRASTE } from "../lib/theme.js";

export default function ConfirmTicket({ ev, reg, onDone, standalone }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(reg.id)}&margin=10`;

  const inner = (
    <>
      {ev.headerImage && (
        <img src={ev.headerImage} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
      )}
      <div style={{ background: NEGRO_PURO, color: BLANCO_CONTRASTE, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: VERDE_CORPORATIVO }}>PASE DIGITAL</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "4px 0 0" }}>{ev.title}</h2>
      </div>
      <div style={{ padding: 28, background: AZUL_CLARO_BG, textAlign: "center" }}>
        <img src={qrUrl} alt="QR" style={{ width: 180, height: 180, borderRadius: 12, border: `2px solid ${NEGRO_PURO}` }} />
        <p style={{ fontFamily: "monospace", fontWeight: 800, marginTop: 12 }}>{reg.id}</p>
        <p style={{ fontSize: 13, color: "#4a5568", margin: "16px 0" }}>
          Guarda este QR. Solo permite un ingreso.
        </p>
        {ev.lat != null && <LocationMap lat={ev.lat} lng={ev.lng} height={140} />}
        <NavigateButtons lat={ev.lat} lng={ev.lng} label={ev.address || ev.location} />
        {onDone && (
          <button type="button" className="soft-btn soft-btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={onDone}>
            Volver
          </button>
        )}
      </div>
    </>
  );

  if (standalone) {
    return <div className="tf-screen" style={{ display: "block" }}>{inner}</div>;
  }

  return (
    <div style={{ border: `2px solid ${NEGRO_PURO}`, borderRadius: 20, overflow: "hidden" }}>
      {inner}
    </div>
  );
}
