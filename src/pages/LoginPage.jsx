import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, apiEnabled } from "../lib/api.js";
import "../styles/typeform.css";

// Si se llegó al login desde una página de evento que exige cuenta (los que
// requieren aprobación), se vuelve allí tras entrar en vez de ir a /app.
function consumeReturnTo() {
  try {
    const to = sessionStorage.getItem("ef_return_to");
    sessionStorage.removeItem("ef_return_to");
    if (to && to.startsWith("/")) return to;
  } catch { /* noop */ }
  return "/app";
}

// mode: login | forgot | reset
export default function LoginPage() {
  const { login, loginWithToken } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!apiEnabled) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <h1 className="tf-question">Modo local</h1>
          <p className="tf-hint">Configura VITE_API_URL en .env y ejecuta el servidor.</p>
          <Link to="/app" className="soft-btn soft-btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>
            Continuar sin cuenta
          </Link>
        </div>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login(email, password);
      nav(consumeReturnTo());
    } catch (ex) {
      setErr(ex.message || "Credenciales incorrectas");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await api.forgotPassword(email);
      if (res.code) {
        // Email not configured — server returned the code directly
        setResetCode(res.code);
        setMsg(`Sin configuración de correo — código: ${res.code}`);
      } else {
        setMsg(`Código enviado a ${email}. Revisa tu bandeja de entrada y spam.`);
      }
      setMode("reset");
    } catch (ex) {
      setErr(ex.message || "Error al enviar el código");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setErr("");
    if (newPw.length < 8 || !/[A-Z]/.test(newPw)) {
      setErr("La contraseña debe tener al menos 8 caracteres y una mayúscula.");
      return;
    }
    setBusy(true);
    try {
      const { token: jwt, user } = await api.resetPassword(email, resetCode, newPw);
      loginWithToken(jwt, user);
      nav(consumeReturnTo());
    } catch (ex) {
      setErr(ex.message || "Código incorrecto o expirado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tf-screen">
      <div className="tf-body">

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <>
            <button type="button" onClick={() => nav("/app")} style={{ background: "none", border: "none", color: "#8fa3b1", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "0 0 20px", display: "block" }}>
              ← Inicio
            </button>
            <h1 className="tf-question">Inicia sesión</h1>
            <p className="tf-hint">Accede a tu cuenta de TapIn.</p>
            <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
              <input
                className="tf-input-line"
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ marginBottom: 24 }}
                autoFocus
              />
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  className="tf-input-line"
                  type={showPw ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 52 }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#8fa3b1", fontWeight: 700 }}>
                  {showPw ? "Ocultar" : "Ver"}
                </button>
              </div>
              <div style={{ marginBottom: 24 }}>
                <button type="button" onClick={() => { setMode("forgot"); setErr(""); }} style={{ background: "none", border: "none", color: "#7fb3e6", fontSize: 13, cursor: "pointer", fontWeight: 700, padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              {err && <p style={{ color: "#991b1b", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{err}</p>}
              <button type="submit" className="soft-btn soft-btn-primary" style={{ width: "100%", fontSize: 15, padding: "16px" }} disabled={busy}>
                {busy ? "Entrando…" : "Entrar →"}
              </button>
            </form>
            <div style={{ marginTop: 28, textAlign: "center" }}>
              <p style={{ color: "#8fa3b1", fontSize: 14 }}>
                ¿No tienes cuenta?{" "}
                <Link to="/app?register=1" style={{ color: "#7fb3e6", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  Crear una gratis
                </Link>
              </p>
            </div>
          </>
        )}

        {/* ── OLVIDÉ CONTRASEÑA ── */}
        {mode === "forgot" && (
          <>
            <button type="button" onClick={() => { setMode("login"); setErr(""); }} style={{ background: "none", border: "none", color: "#8fa3b1", cursor: "pointer", fontSize: 13, marginBottom: 28, padding: 0 }}>
              ← Volver al login
            </button>
            <h1 className="tf-question">¿Olvidaste tu contraseña?</h1>
            <p className="tf-hint">Escribe tu correo y te enviamos un código de 4 dígitos para crear una nueva contraseña.</p>
            <form onSubmit={handleForgot} style={{ marginTop: 24 }}>
              <input
                className="tf-input-line"
                type="email"
                placeholder="Tu correo registrado"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
              {err && <p style={{ color: "#991b1b", fontWeight: 700, margin: "12px 0 0", fontSize: 14 }}>{err}</p>}
              <button type="submit" className="soft-btn soft-btn-primary" style={{ width: "100%", marginTop: 28, fontSize: 15, padding: "16px" }} disabled={busy}>
                {busy ? "Enviando…" : "Enviar código →"}
              </button>
            </form>
          </>
        )}

        {/* ── RESTABLECER ── */}
        {mode === "reset" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 20 }}>📩</div>
            <h1 className="tf-question">Nueva contraseña</h1>
            <p className="tf-hint" style={{ marginBottom: 8 }}>Ingresa el código de 4 dígitos enviado a</p>
            <p style={{ fontWeight: 800, fontSize: 15, color: "#7fb3e6", marginBottom: 28 }}>{email}</p>
            <form onSubmit={handleReset}>
              <input
                className="tf-input-line"
                type="text"
                inputMode="numeric"
                placeholder="Código de 4 dígitos"
                value={resetCode}
                onChange={e => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                style={{ marginBottom: 24, fontSize: 24, letterSpacing: 8, textAlign: "center" }}
                autoFocus
              />
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  className="tf-input-line"
                  type={showPw ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  style={{ paddingRight: 52 }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#8fa3b1", fontWeight: 700 }}>
                  {showPw ? "Ocultar" : "Ver"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: newPw.length >= 8 && /[A-Z]/.test(newPw) ? "#16a34a" : "#8fa3b1", marginBottom: 20 }}>
                {newPw.length >= 8 && /[A-Z]/.test(newPw) ? "✓ Contraseña válida" : "Mín. 8 caracteres · una mayúscula"}
              </p>
              {err && <p style={{ color: "#991b1b", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{err}</p>}
              <button type="submit" className="soft-btn soft-btn-primary" style={{ width: "100%", fontSize: 15, padding: "16px" }} disabled={busy || resetCode.length < 4 || !newPw}>
                {busy ? "Guardando…" : "Establecer nueva contraseña →"}
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button type="button" onClick={handleForgot} style={{ background: "none", border: "none", color: "#7fb3e6", cursor: "pointer", fontSize: 13, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }} disabled={busy}>
                Reenviar código
              </button>
            </div>
            {msg && <p style={{ fontSize: 13, color: "#16a34a", textAlign: "center", marginTop: 8, fontWeight: 700 }}>{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
