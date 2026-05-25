import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiEnabled } from "../lib/api.js";
import "../styles/typeform.css";

export default function LoginPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!apiEnabled) {
    return (
      <div className="tf-screen">
        <div className="tf-body">
          <h1 className="tf-question">Modo local</h1>
          <p className="tf-hint">
            Configura VITE_API_URL en .env y ejecuta el servidor (npm run dev en /server).
          </p>
          <Link to="/app" className="soft-btn soft-btn-primary" style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}>
            Continuar sin cuenta
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      nav("/app");
    } catch (ex) {
      setErr(ex.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tf-screen">
      <div className="tf-body">
        <h1 className="tf-question">
          {mode === "login" ? "Inicia sesión como anfitrión" : "Crea tu cuenta de anfitrión"}
        </h1>
        <p className="tf-hint">Gestiona eventos, inscripciones y check-in QR.</p>
        <form onSubmit={submit} style={{ marginTop: 24 }}>
          {mode === "register" && (
            <input
              className="tf-input-line"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 20 }}
            />
          )}
          <input
            className="tf-input-line"
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ marginBottom: 20 }}
          />
          <input
            className="tf-input-line"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {err && <p style={{ color: "#991b1b", marginTop: 12, fontWeight: 700 }}>{err}</p>}
          <button type="submit" className="soft-btn soft-btn-primary" style={{ width: "100%", marginTop: 28 }} disabled={busy}>
            {busy ? "…" : mode === "login" ? "Entrar" : "Registrarme"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ marginTop: 20, background: "none", border: "none", color: "#0d3b66", fontWeight: 700, cursor: "pointer" }}
        >
          {mode === "login" ? "¿Nuevo? Crear cuenta" : "Ya tengo cuenta"}
        </button>
      </div>
    </div>
  );
}
