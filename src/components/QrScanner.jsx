import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { NEGRO_PURO, NEGRO_MUTED_70, VERDE_PASTEL_BG } from "../lib/theme.js";

const SCANNER_ID = "eventform-qr-reader";

export default function QrScanner({ active, onScan, onError }) {
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return undefined;

    handledRef.current = false;
    let cancelled = false;
    const html5 = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = html5;

    const onSuccess = (decoded) => {
      if (handledRef.current || cancelled) return;
      handledRef.current = true;
      html5
        .stop()
        .then(() => html5.clear())
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
          setStatus("idle");
          onScanRef.current(decoded);
        });
    };

    setStatus("starting");
    setMessage("Solicitando acceso a la cámara…");

    html5
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        onSuccess,
        () => {}
      )
      .then(() => {
        if (!cancelled) {
          setStatus("scanning");
          setMessage("Apunta al código QR del boleto");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        const msg =
          err?.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en ajustes del navegador."
            : "No se pudo iniciar la cámara. Usa entrada manual o HTTPS.";
        setMessage(msg);
        onErrorRef.current?.(msg);
      });

    return () => {
      cancelled = true;
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        id={SCANNER_ID}
        style={{
          width: "100%",
          minHeight: 260,
          border: `2px solid ${NEGRO_PURO}`,
          borderRadius: 12,
          overflow: "hidden",
          background: VERDE_PASTEL_BG,
        }}
      />
      <p
        style={{
          fontSize: 13,
          color: NEGRO_MUTED_70,
          marginTop: 10,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {status === "error" ? message : message || "Iniciando escáner…"}
      </p>
      {status === "error" && (
        <p style={{ fontSize: 12, color: NEGRO_MUTED_70, textAlign: "center" }}>
          En iPhone/Android usa Chrome o Safari con HTTPS (o localhost en desarrollo).
        </p>
      )}
    </div>
  );
}
