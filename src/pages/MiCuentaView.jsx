import { useState, useRef } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { uploadImage } from "../lib/upload.js";
import "../styles/typeform.css";

export default function MiCuentaView() {
  const { user, token, logout, loginWithToken, patchUser } = useAuth();

  const avatarInputRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const initials = user?.name ? user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() : "?";

  const avatarKey = user ? `ef_avatar_${user.id || user.email}` : "ef_avatar";
  const avatar = user?.avatar || (() => { try { return localStorage.getItem(avatarKey); } catch { return null; } })();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const url = await uploadImage(file, { square: true });
      try { localStorage.setItem(avatarKey, url); } catch {}
      const { user: u } = await api.updateMe(token, { avatar: url });
      patchUser?.(u || { avatar: url });
    } catch (ex) {
      alert(ex?.message || "No se pudo guardar la foto.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      try { localStorage.removeItem(avatarKey); } catch {}
      const { user: u } = await api.updateMe(token, { avatar: null });
      patchUser?.(u || { avatar: null });
    } catch (ex) {
      alert(ex?.message || "No se pudo quitar la foto.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const [name, setName] = useState(user?.name || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
  const [pwBusy, setPwBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "eliminar mi cuenta") {
      setDeleteErr("Debes escribir 'eliminar mi cuenta' para confirmar");
      return;
    }
    setDeleteErr("");
    setDeleteBusy(true);
    try {
      await api.deleteAccount(token);
      logout();
    } catch (ex) {
      setDeleteErr(ex.message || "Error al eliminar la cuenta");
      setDeleteBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e8eaf0", marginBottom: 28 }}>Mi cuenta</h1>

      {/* Foto de perfil */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e8eaf0" }}>Foto de perfil</h2>
        </div>
        <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: avatar ? "transparent" : "linear-gradient(135deg, #0d3b66, #1a5f8a)", border: "3px solid rgba(107,159,212,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff" }}>
            {avatar ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 13 }} disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
              {avatarBusy ? "Guardando…" : avatar ? "Cambiar foto" : "Subir foto"}
            </button>
            {avatar && (
              <button type="button" className="soft-btn ef-hover-fill" style={{ fontSize: 13, background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10 }} disabled={avatarBusy} onClick={handleRemoveAvatar}>
                Quitar foto
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
          </div>
        </div>
      </div>

      {/* Info de cuenta */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e8eaf0" }}>Información personal</h2>
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
          <p style={{ fontSize: 16, color: "rgba(232,234,240,0.5)", marginBottom: 24, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            {user?.email}
          </p>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Miembro desde
          </label>
          <p style={{ fontSize: 14, color: "rgba(232,234,240,0.5)", marginBottom: 20 }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 13 }} disabled={nameBusy}>
              {nameBusy ? "Guardando…" : "Guardar nombre"}
            </button>
            {nameMsg && <span style={{ fontSize: 13, color: nameMsg.startsWith("✓") ? "#16a34a" : "#e53e3e", fontWeight: 700 }}>{nameMsg}</span>}
          </div>
        </form>
      </div>

      {/* Cambiar contraseña */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e8eaf0" }}>Cambiar contraseña</h2>
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
            <button type="submit" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 13 }} disabled={pwBusy || !curPw || !newPw}>
              {pwBusy ? "Cambiando…" : "Cambiar contraseña"}
            </button>
            {pwMsg.text && <span style={{ fontSize: 13, color: pwMsg.ok ? "#16a34a" : "#e53e3e", fontWeight: 700 }}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>

      {/* Cerrar sesión */}
      <div className="panel-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>Cerrar sesión</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8fa3b1" }}>Salir de tu cuenta en este dispositivo</p>
        </div>
        <button type="button" className="soft-btn ef-hover-fill" style={{ background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, fontSize: 13, padding: "10px 18px" }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>

      {/* Eliminar cuenta */}
      <div className="panel-card" style={{ padding: 20, borderColor: "rgba(220,38,38,0.35)", borderWidth: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#991b1b", fontSize: 14 }}>Zona de peligro: Eliminar cuenta</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8fa3b1" }}>
              Esta acción eliminará permanentemente tu cuenta, todos tus eventos y registros. No se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="soft-btn ef-hover-fill"
            style={{ background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, fontSize: 13, padding: "10px 18px", whiteSpace: "nowrap" }}
            onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); setDeleteErr(""); }}
          >
            Eliminar cuenta
          </button>
        </div>
      </div>

      {/* Modal de confirmación */}
      {deleteModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "rgba(20,22,40,0.95)", borderRadius: 20, padding: 28, maxWidth: 380,
            border: "1px solid rgba(220,38,38,0.3)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            backdropFilter: "blur(20px)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#fca5a5" }}>
              ¿Estás seguro?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(232,234,240,0.6)", lineHeight: 1.6 }}>
              Esta acción eliminará:
            </p>
            <ul style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 13, color: "rgba(232,234,240,0.5)" }}>
              <li>Tu cuenta de anfitrión</li>
              <li>Todos tus eventos</li>
              <li>Todos los registros e inscripciones</li>
            </ul>
            <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#e8eaf0" }}>
              Escribe "eliminar mi cuenta" para continuar:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteErr(""); }}
              placeholder="eliminar mi cuenta"
              className="tf-input-line"
              style={{ marginBottom: 12, fontSize: 14 }}
            />
            {deleteErr && (
              <p style={{ color: "#991b1b", fontWeight: 700, fontSize: 13, margin: "0 0 12px" }}>
                ⚠️ {deleteErr}
              </p>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  flex: 1, padding: "10px 16px", background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  fontWeight: 600, color: "#e8eaf0"
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteBusy || deleteConfirmText.toLowerCase() !== "eliminar mi cuenta"}
                style={{
                  flex: 1, padding: "10px 16px", background: "rgba(220,38,38,0.2)",
                  border: "1px solid rgba(220,38,38,0.4)", borderRadius: 8, cursor: deleteConfirmText.toLowerCase() === "eliminar mi cuenta" ? "pointer" : "not-allowed",
                  fontSize: 13, fontWeight: 600, color: "#fca5a5", opacity: deleteConfirmText.toLowerCase() === "eliminar mi cuenta" ? 1 : 0.5
                }}
              >
                {deleteBusy ? "Eliminando..." : "Eliminar permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
