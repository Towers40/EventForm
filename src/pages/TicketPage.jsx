import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiEnabled } from "../lib/api.js";
import "../styles/typeform.css";

const DAYS_ES   = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fmt(dateStr, timeStr) {
  if (!dateStr) return "Fecha por confirmar";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y) return "Fecha por confirmar";
  const dt = new Date(y, m - 1, d);
  const base = `${DAYS_ES[dt.getDay()]}, ${d} ${MONTHS_ES[m - 1]} ${y}`;
  return timeStr ? `${base} · ${timeStr}` : base;
}

export default function TicketPage() {
  const { ticketId } = useParams();
  const id = String(ticketId || "").toUpperCase();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(id)}&bgcolor=ffffff&color=000000&margin=12&qzone=2`;
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    if (!apiEnabled) return;
    (async () => {
      try {
        const { ticket: t } = await api.publicTicket(id);
        setTicket(t);
      } catch { /* sin datos: igual mostramos el QR */ }
    })();
  }, [id]);

  const ev = ticket?.event;

  return (
    <div className="tf-screen" style={{ display: "block", overflowY: "auto", background: "linear-gradient(170deg, #1d2340 0%, #131628 100%)", minHeight: "100dvh" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "32px 16px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <span style={{ color: "#4ade80", fontSize: 20 }}>●</span>
          <span style={{ color: "#e8eaf0", fontWeight: 800, fontSize: 17, marginLeft: 8 }}>EventForm</span>
        </div>

        {ev && (
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#e8eaf0", margin: "0 0 6px" }}>{ev.title}</h1>
            <p style={{ fontSize: 13.5, color: "#c8dff0", margin: 0 }}>{fmt(ev.startDate || ev.date, ev.startTime)}</p>
            {(ev.city || ev.location) && (
              <p style={{ fontSize: 13, color: "rgba(232,234,240,0.55)", margin: "4px 0 0" }}>{[ev.location, ev.city].filter(Boolean).join(" — ")}</p>
            )}
          </div>
        )}

        {/* Tarjeta del QR */}
        <div style={{ background: "#1a1c1e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "26px 20px", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {ticket?.cancelled ? (
            <p style={{ color: "#fca5a5", fontWeight: 800, fontSize: 15, margin: "20px 0" }}>Esta entrada fue cancelada.</p>
          ) : (
            <>
              <img src={qrUrl} alt="QR de acceso" style={{ width: 220, height: 220, borderRadius: 12, display: "block", margin: "0 auto", background: "#fff", padding: 10 }} />
              <p style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#6b9fd4", margin: "14px 0 4px", letterSpacing: 1 }}>{id}</p>
              <p style={{ fontSize: 12, color: "#8fa3b1", margin: 0 }}>Presenta este QR en la entrada. Solo permite un ingreso.</p>
              {ticket?.used && (
                <p style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: "#fca5a5", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 10, padding: "8px 12px" }}>
                  Esta entrada ya fue utilizada para ingresar.
                </p>
              )}
            </>
          )}
        </div>

        {ev?.slug && (
          <a href={`/e/${ev.slug}`} className="soft-btn soft-btn-secondary" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 18, fontSize: 13 }}>Ver evento</a>
        )}
      </div>
    </div>
  );
}
