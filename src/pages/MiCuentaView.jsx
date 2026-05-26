import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/typeform.css";

export default function MiCuentaView() {
  const { user, token, logout, loginWithToken } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setNameBusy(true);
    try {
      const { user: u } = await api.updateMe(token, name.trim());
      loginWithToken(token, u);
      setNameMsg("✓ Nombre actualizado");
    } catch (ex) {
      setNameMsg(ex.message || "Error al guardar");
    } finally {
      setNameBusy(false);
      setTimeout(() => setNameMsg(""), 3000);
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (newPw.length < 8 || !/[A-Z]/.test(newPw)) {
      setPwMsg({ text: "Mínimo 8 caracteres y una mayúscula.", ok: false });
      return;
    }
    setPwBusy(true);
    try {
      await api.changePassword(token, curPw, newPw);
      setPwMsg({ text: "✓ Contraseña actualizada", ok: true });
      setCurPw(""); setNewPw("");
    } catch (ex) {
      setPwMsg({ text: ex.message || "Error al cambiar contraseña", ok: false });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0d1b2a", marginBottom: 28 }}>Mi cuenta</h1>

      {/* Info de cuenta */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0d1b2a" }}>Información personal</h2>
        </div>
        <form onSubmit={saveName} style={{ padding: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Nombre
          </label>
          <input
            className="tf-input-line"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ marginBottom: 20, fontSize: 16 }}
          />
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Correo electrónico
          </label>
          <p style={{ fontSize: 16, color: "#5c6b7a", marginBottom: 24, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
            {user?.email}
          </p>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Miembro desde
          </label>
          <p style={{ fontSize: 14, color: "#5c6b7a", marginBottom: 20 }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="soft-btn soft-btn-primary" style={{ fontSize: 13 }} disabled={nameBusy}>
              {nameBusy ? "Guardando…" : "Guardar nombre"}
            </button>
            {nameMsg && <span style={{ fontSize: 13, color: nameMsg.startsWith("✓") ? "#16a34a" : "#e53e3e", fontWeight: 700 }}>{nameMsg}</span>}
          </div>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0d1b2a" }}>Cambiar contraseña</h2>
        </div>
        <form onSubmit={changePw} style={{ padding: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Contraseña actual
          </label>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <input
              className="tf-input-line"
              type={showPw ? "text" : "password"}
              value={curPw}
              onChange={e => setCurPw(e.target.value)}
              placeholder="••••••••"
              style={{ paddingRight: 52 }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#8fa3b1", fontWeight: 700 }}>
              {showPw ? "Ocultar" : "Ver"}
            </button>
          </div>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Nueva contraseña
          </label>
          <input
            className="tf-input-line"
            type={showPw ? "text" : "password"}
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Mín. 8 caracteres y una mayúscula"
            style={{ marginBottom: 8 }}
          />
          <p style={{ fontSize: 12, color: "#8fa3b1", marginBottom: 20 }}>
            {newPw.length >= 8 && /[A-Z]/.test(newPw) ? "✓ Contraseña válida" : "Mínimo 8 caracteres · al menos una mayúscula"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="soft-btn soft-btn-primary" style={{ fontSize: 13 }} disabled={pwBusy || !curPw || !newPw}>
              {pwBusy ? "Cambiando…" : "Cambiar contraseña"}
            </button>
            {pwMsg.text && <span style={{ fontSize: 13, color: pwMsg.ok ? "#16a34a" : "#e53e3e", fontWeight: 700 }}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>

      {/* Cerrar sesión */}
      <div className="panel-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: "#0d1b2a", fontSize: 14 }}>Cerrar sesión</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8fa3b1" }}>Salir de tu cuenta en este dispositivo</p>
        </div>
        <button type="button" className="soft-btn" style={{ background: "#fff", color: "#e53e3e", border: "1px solid #fed7d7", borderRadius: 10, fontSize: 13, padding: "10px 18px" }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
