"use client";

import Link from "next/link";
import { useState } from "react";
import { enviarCorreoRecuperacion } from "../actions";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    const result = await enviarCorreoRecuperacion(email);

    if (result.ok) {
      setSent(true);
    } else {
      setError(result.error);
    }
    setSending(false);
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
            RECUPERAR CONTRASEÑA
          </div>
        </div>

        {!sent ? (
          <>
            <form onSubmit={submit}>
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
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
                    <span className="spinner" aria-hidden="true"></span> ENVIANDO…
                  </>
                ) : (
                  "ENVIAR ENLACE DE RECUPERACIÓN"
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
            </form>

            <Link href="/auth" className="btn ghost" style={{ width: "100%", marginTop: 10 }}>
              VOLVER A INICIAR SESIÓN
            </Link>
          </>
        ) : (
          <div className="terminal-success">
            <div className="term-bar">
              <span className="dot r"></span>
              <span className="dot y"></span>
              <span className="dot g"></span>
              <span className="term-title">VAULT-OS // TERMINAL</span>
            </div>
            <div className="term-body">
              <div className="line">
                <span className="prompt">vault@arcade:~$</span> ./send_recovery --to={email}
              </div>
              <div className="line dim">[OK] Conectando con servidor…</div>
              <div className="line dim">[OK] Generando enlace de recuperación…</div>
              <div className="line success">
                &gt; SI EL CORREO EXISTE, RECIBIRÁS UN ENLACE PARA DEFINIR UNA NUEVA CONTRASEÑA.
                <span className="caret">_</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <Link href="/auth" className="btn ghost">
                  VOLVER A INICIAR SESIÓN
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
