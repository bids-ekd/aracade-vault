"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { crearCuenta, iniciarSesion } from "./actions";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    const result =
      tab === "in" ? await iniciarSesion(email, pass) : await crearCuenta(user, email, pass);

    if (result.ok) {
      if (tab === "in") {
        // Navegación completa: iniciarSesion corre en el server y establece la
        // sesión vía cookies; el cliente browser (UserProvider) recién se entera
        // de la sesión nueva al reinicializarse, no con una navegación soft.
        window.location.href = "/biblioteca";
      } else {
        // crearCuenta no deja sesión activa (falta confirmar el email), así que
        // no hay estado de auth que sincronizar y la navegación soft es segura.
        router.push("/biblioteca");
      }
    } else {
      setError(result.error);
      setSending(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => changeTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => changeTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            disabled={sending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {sending ? (
              <>
                <span className="spinner" aria-hidden="true"></span>{" "}
                {tab === "in" ? "ENTRANDO…" : "CREANDO CUENTA…"}
              </>
            ) : tab === "in" ? (
              "ENTRAR AL VAULT"
            ) : (
              "CREAR Y JUGAR"
            )}
          </button>
          {error && (
            <div
              className="pixel neon-magenta"
              role="alert"
              style={{ fontSize: 10, marginTop: 14, letterSpacing: "0.06em" }}
            >
              ⚠ {error}
            </div>
          )}
          {tab === "in" && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <Link
                href="/auth/recuperar"
                className="mono"
                style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.06em" }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
