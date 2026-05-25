import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import "../styles/typeform.css";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState("verifying"); // verifying | ok | error
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setErrMsg("El enlace de verificación no es válido.");
      return;
    }
    api.verifyEmail(token)
      .then(({ token: jwt, user }) => {
        loginWithToken(jwt, user);
        const draft = localStorage.getItem("ef_pending_draft");
        setStatus("ok");
        setTimeout(() => {
          // Si hay un draft guardado lo conservamos; HostApp lo cargará
          nav("/app", { replace: true });
        }, 1800);
      })
      .catch((e) => {
        setStatus("error");
        setErrMsg(e.message || "El enlace ya fue utilizado o no es válido.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tf-screen">
      <div className="tf-body" style={{ textAlign: "center" }}>
        {status === "verifying" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 24, opacity: 0.4 }}>⏳</div>
            <h2 className="tf-question">Verificando tu correo…</h2>
            <p className="tf-hint">Un momento, por favor.</p>
          </>
        )}
        {status === "ok" && (
          <>
            <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
            <h2 className="tf-question">
              ¡Correo confirmado!
            </h2>
            <p className="tf-hint">
              Tu cuenta está activa. Redirigiendo a tu evento…
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
            <h2 className="tf-question">Enlace inválido</h2>
            <p className="tf-hint">{errMsg}</p>
            <button
              type="button"
              className="soft-btn soft-btn-primary"
              style={{ marginTop: 28 }}
              onClick={() => nav("/login")}
            >
              Ir al inicio de sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
