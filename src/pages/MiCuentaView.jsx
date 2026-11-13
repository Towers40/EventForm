import { useState, useRef } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { uploadImage } from "../lib/upload.js";
import { PROFILE_KEYS } from "../../shared/profileFields.js";
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

  // Migración de avatares antiguos (base64 → Cloudinary). Visible para el admin:
  // super_admin (por rol) o el dueño (email = SUPER_ADMIN_EMAIL, flag isOwner
  // que devuelve el servidor en /api/auth/me).
  const isSuperAdmin = user?.role === "super_admin" || user?.isOwner;
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState({ text: "", ok: false });
  // Sube a Cloudinary lo que quedó guardado en base64. Es lo que más pesa en
  // las respuestas: una portada incrustada son cientos de KB que viajan en
  // cada carga de Descubrir.
  const migrar = (fn, nombre) => async () => {
    setMigrateBusy(true);
    setMigrateMsg({ text: "", ok: false });
    try {
      const r = await fn(token);
      const txt = r.scanned === 0
        ? `No quedan ${nombre} en base64. Todo migrado. ✔`
        : `Migradas ${r.migrated} de ${r.scanned}${r.failed ? ` (${r.failed} fallidas)` : ""}.`;
      setMigrateMsg({ text: txt, ok: !r.failed });
    } catch (ex) {
      setMigrateMsg({ text: ex?.message || "No se pudo migrar.", ok: false });
    } finally {
      setMigrateBusy(false);
    }
  };
  const handleMigrateAvatars = migrar(api.migrateAvatars, "avatares");
  const handleMigrateCovers = migrar(api.migrateEventImages, "portadas");

  return (
    <div className="cuenta">
      <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", color: "#ffffff", margin: "8px 0 22px" }}>Mi cuenta</h1>

      {/* Ordenador: dos columnas — quién eres (foto e información) a la
          izquierda; inscripciones, seguridad y sesión a la derecha. En móvil
          se apilan en el mismo orden de siempre. */}
      <div className="cuenta-cols">
      <div className="cuenta-col">
      {/* Foto de perfil */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ffffff" }}>Foto de perfil</h2>
        </div>
        <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: avatar ? "transparent" : "var(--tf-surface-2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 600, color: "#fff" }}>
            {avatar ? <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="soft-btn soft-btn-ghost ef-hover-fill" style={{ fontSize: 15 }} disabled={avatarBusy} onClick={() => avatarInputRef.current?.click()}>
              {avatarBusy ? "Guardando…" : avatar ? "Cambiar foto" : "Subir foto"}
            </button>
            {avatar && (
              <button type="button" className="soft-btn ef-hover-fill" style={{ fontSize: 15, background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14 }} disabled={avatarBusy} onClick={handleRemoveAvatar}>
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ffffff" }}>Información personal</h2>
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
          <p style={{ fontSize: 16, color: "rgba(229,238,255,0.5)", marginBottom: 24, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            {user?.email}
          </p>
          <label style={{ fontSize: 11, fontWeight: 800, color: "#8fa3b1", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            Miembro desde
          </label>
          <p style={{ fontSize: 14, color: "rgba(229,238,255,0.5)", marginBottom: 20 }}>
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "—"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 15 }} disabled={nameBusy}>
              {nameBusy ? "Guardando…" : "Guardar nombre"}
            </button>
            {nameMsg && <span style={{ fontSize: 13, color: nameMsg.startsWith("✓") ? "#34d399" : "#f87171", fontWeight: 700 }}>{nameMsg}</span>}
          </div>
        </form>
      </div>

      </div>
      <div className="cuenta-col">
      {/* Datos para inscribirse con un clic */}
      <DatosInscripcion user={user} token={token} patchUser={patchUser} />

      {/* Cambiar contraseña */}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="panel-card-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ffffff" }}>Cambiar contraseña</h2>
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
            <button type="submit" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 15 }} disabled={pwBusy || !curPw || !newPw}>
              {pwBusy ? "Cambiando…" : "Cambiar contraseña"}
            </button>
            {pwMsg.text && <span style={{ fontSize: 13, color: pwMsg.ok ? "#34d399" : "#f87171", fontWeight: 700 }}>{pwMsg.text}</span>}
          </div>
        </form>
      </div>

      {/* Administrador — migración de avatares (solo super admin) */}
      {isSuperAdmin && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <div className="panel-card-header">
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ffffff" }}>Administrador</h2>
          </div>
          <div style={{ padding: 20 }}>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#8fa3b1", lineHeight: 1.5 }}>
              Sube a Cloudinary las imágenes antiguas guardadas en base64 y las
              reemplaza por su URL. Es seguro repetirlo: solo toca las que aún estén
              en base64. <strong style={{ color: "#fbbf24" }}>Las portadas incrustadas son
              lo que más pesa</strong> — una sola puede añadir cientos de KB a cada carga
              de Descubrir.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="soft-btn soft-btn-primary ef-hover-fill" style={{ fontSize: 15 }} disabled={migrateBusy} onClick={handleMigrateCovers}>
                {migrateBusy ? "Migrando…" : "Migrar portadas de eventos"}
              </button>
              <button type="button" className="soft-btn soft-btn-secondary ef-hover-fill" style={{ fontSize: 15 }} disabled={migrateBusy} onClick={handleMigrateAvatars}>
                {migrateBusy ? "Migrando…" : "Migrar avatares"}
              </button>
              {migrateMsg.text && <span style={{ fontSize: 13, color: migrateMsg.ok ? "#34d399" : "#f87171", fontWeight: 700 }}>{migrateMsg.text}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Cerrar sesión */}
      <div className="panel-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: "#ffffff", fontSize: 14 }}>Cerrar sesión</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8fa3b1" }}>Salir de tu cuenta en este dispositivo</p>
        </div>
        <button type="button" className="soft-btn ef-hover-fill" style={{ background: "rgba(220,38,38,0.14)", color: "#fca5a5", border: "none", borderRadius: 14, fontSize: 15, padding: "0 18px", whiteSpace: "nowrap", flexShrink: 0 }} onClick={logout}>
          Cerrar sesión
        </button>
      </div>

      {/* Eliminar cuenta */}
      <div className="panel-card" style={{ padding: 20, borderColor: "rgba(220,38,38,0.35)", borderWidth: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "#f87171", fontSize: 14 }}>Zona de peligro: Eliminar cuenta</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8fa3b1" }}>
              Esta acción eliminará permanentemente tu cuenta, todos tus eventos y registros. No se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="soft-btn ef-hover-fill"
            style={{ background: "rgba(220,38,38,0.12)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, fontSize: 13, padding: "10px 18px", whiteSpace: "nowrap" }}
            onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); setDeleteErr(""); }}
          >
            Eliminar cuenta
          </button>
        </div>
      </div>

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
            background: "var(--tf-sheet)", borderRadius: 22, padding: 28, maxWidth: 380,
            border: "1px solid rgba(220,38,38,0.3)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            backdropFilter: "blur(20px)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 500, color: "#fca5a5" }}>
              ¿Estás seguro?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(229,238,255,0.6)", lineHeight: 1.6 }}>
              Esta acción eliminará:
            </p>
            <ul style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 13, color: "rgba(229,238,255,0.5)" }}>
              <li>Tu cuenta de anfitrión</li>
              <li>Todos tus eventos</li>
              <li>Todos los registros e inscripciones</li>
            </ul>
            <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
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
              <p style={{ color: "#f87171", fontWeight: 700, fontSize: 13, margin: "0 0 12px" }}>
                ⚠️ {deleteErr}
              </p>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  flex: 1, padding: "10px 16px", background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  fontWeight: 600, color: "#ffffff"
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

/**
 * Datos que se reutilizan al inscribirse a un evento (además del nombre y el
 * correo de la cuenta). Se van guardando solos al inscribirse; aquí se ven, se
 * corrigen y se borran. El teléfono va siempre visible porque es el que casi
 * todos los eventos piden.
 */
function DatosInscripcion({ user, token, patchUser }) {
  const perfil = user?.profile || {};
  const [valores, setValores] = useState(() => ({ ...perfil }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const visibles = PROFILE_KEYS.filter((k) => k.key === "phone" || perfil[k.key] != null || valores[k.key]);
  const cambiado = PROFILE_KEYS.some((k) => (valores[k.key] || "") !== (perfil[k.key] || ""));

  const guardar = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const cambios = {};
      for (const { key } of PROFILE_KEYS) {
        const nuevo = String(valores[key] || "").trim();
        if (nuevo !== (perfil[key] || "")) cambios[key] = nuevo || null;
      }
      const { user: u } = await api.updateMe(token, { profile: cambios });
      patchUser({ profile: u.profile });
      setValores({ ...u.profile });
      setMsg("✓ Guardado");
    } catch (ex) {
      setMsg(ex.message || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-card" style={{ marginBottom: 20 }}>
      <div className="panel-card-header">
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ffffff" }}>Datos para inscribirte</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--tf-muted)", lineHeight: 1.45 }}>
          Con estos datos, tu nombre y tu correo te inscribes a un evento con un clic. Se guardan cuando te inscribes y puedes cambiarlos o borrarlos aquí.
        </p>
      </div>
      <form onSubmit={guardar} style={{ padding: 20 }}>
        {visibles.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label htmlFor={`perfil-${key}`} style={{ fontSize: 13, color: "var(--tf-muted)", display: "block", marginBottom: 8 }}>{label}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id={`perfil-${key}`}
                className="tf-input-line"
                value={valores[key] || ""}
                inputMode={key === "phone" ? "tel" : key === "age" ? "numeric" : undefined}
                autoComplete={key === "phone" ? "tel" : "off"}
                placeholder={key === "phone" ? "Ej. 300 123 4567" : ""}
                onChange={(e) => setValores((v) => ({ ...v, [key]: e.target.value }))}
                style={{ fontSize: 16, flex: 1 }}
              />
              {key !== "phone" && (
                <button type="button" aria-label={`Borrar ${label}`} title="Borrar"
                  onClick={() => setValores((v) => ({ ...v, [key]: "" }))}
                  className="soft-btn soft-btn-ghost" style={{ minHeight: 0, width: 52, padding: 0, color: "#fca5a5" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" className="soft-btn soft-btn-ghost" disabled={busy || !cambiado}>
            {busy ? "Guardando…" : "Guardar datos"}
          </button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "#34d399" : "#f87171", fontWeight: 600 }}>{msg}</span>}
        </div>
      </form>
    </div>
  );
}
