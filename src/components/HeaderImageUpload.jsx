import { useState } from "react";
import { compressHeaderImage } from "../lib/images.js";
import {
  inputStyle,
  NEGRO_PURO,
  NEGRO_MUTED_70,
  VERDE_PASTEL_BG,
  BLANCO_CONTRASTE,
} from "../lib/theme.js";

function Lbl({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

export default function HeaderImageUpload({ image, onChange }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const dataUrl = await compressHeaderImage(file);
      onChange(dataUrl);
    } catch (ex) {
      setErr(ex.message || "Error al procesar la imagen.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div
      style={{
        border: "1px solid #b8d4f0",
        borderRadius: 12,
        padding: 20,
        background: "linear-gradient(135deg, #e8f4fd 0%, #f0f6fc 100%)",
        marginBottom: 0,
      }}
    >
      <Lbl>Imagen de encabezado</Lbl>
      <p style={{ fontSize: 12, color: "#5c6b7a", marginBottom: 12 }}>
        Opcional. Se mostrará en inscripción y boleto. Recomendado: formato horizontal 16:9.
      </p>
      {image && (
        <img
          src={image}
          alt="Vista previa portada"
          style={{
            width: "100%",
            maxHeight: 160,
            objectFit: "cover",
            borderRadius: 10,
            border: `2px solid ${NEGRO_PURO}`,
            marginBottom: 12,
            display: "block",
          }}
        />
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: busy ? "wait" : "pointer",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#0d3b66",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            flex: "1 1 auto",
          }}
        >
          {busy ? "Procesando…" : image ? "Cambiar imagen" : "Subir imagen"}
          <input type="file" accept="image/*" hidden onChange={onFile} disabled={busy} />
        </label>
        {image && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              ...inputStyle,
              width: "auto",
              flex: "0 0 auto",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Quitar
          </button>
        )}
      </div>
      {err && <p style={{ color: "#991b1b", fontSize: 12, marginTop: 8, fontWeight: 700 }}>{err}</p>}
    </div>
  );
}
