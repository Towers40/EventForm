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
        border: `2px solid ${NEGRO_PURO}`,
        borderRadius: 12,
        padding: 16,
        background: VERDE_PASTEL_BG,
        marginBottom: 20,
      }}
    >
      <Lbl>Imagen de encabezado (portada del evento)</Lbl>
      <p style={{ fontSize: 12, color: NEGRO_MUTED_70, marginBottom: 12 }}>
        Personaliza tu evento. Se mostrará en inscripción, boleto y panel admin. Recomendado: horizontal 16:9.
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
            ...inputStyle,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: busy ? "wait" : "pointer",
            width: "auto",
            flex: "1 1 160px",
            background: NEGRO_PURO,
            color: BLANCO_CONTRASTE,
            fontWeight: 800,
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
