import { useState } from "react";
import { uploadImage } from "../lib/upload.js";

function ImageIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

export default function HeaderImageUpload({ image, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (ex) {
      setErr(ex.message || "Error al procesar la imagen.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{
      position: "relative",
      aspectRatio: "16/10",
      overflow: "hidden",
      background: image ? "none" : "rgba(255,255,255,0.04)",
    }}>
      {image
        ? <img src={image} alt="portada" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(238,241,247,0.35)" }}>
            <ImageIcon />
            <span style={{ fontSize: 13 }}>Portada del evento</span>
          </div>
        )
      }

      {/* Upload trigger */}
      <label style={{
        position: "absolute", bottom: 12, right: 12,
        width: 42, height: 42, borderRadius: "50%",
        background: "rgba(255,255,255,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: busy ? "wait" : "pointer",
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        color: "#1a1e32",
        flexShrink: 0,
      }}>
        {busy ? <span style={{ fontSize: 11, fontWeight: 700 }}>…</span> : <ImageIcon />}
        <span style={{
          position: "absolute", bottom: 4, right: 4,
          background: "#1a1e32", borderRadius: "50%",
          width: 14, height: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 11, lineHeight: 1,
        }}>+</span>
        <input type="file" accept="image/*" hidden onChange={onFile} disabled={busy} />
      </label>

      {/* Remove button */}
      {image && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.55)", border: "none",
            borderRadius: 22, padding: "4px 10px",
            color: "#fff", fontSize: 11, cursor: "pointer",
          }}
        >
          Quitar
        </button>
      )}

      {err && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(220,38,38,0.8)", padding: "6px 12px",
          fontSize: 12, color: "#fff",
        }}>
          {err}
        </div>
      )}
    </div>
  );
}
