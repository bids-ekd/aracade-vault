"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actualizarContrasena } from "../actions";

export function NuevaContrasenaForm() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    const result = await actualizarContrasena(pass);

    if (result.ok) {
      router.push("/biblioteca");
    } else {
      setError(result.error);
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Nueva contraseña</label>
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
            <span className="spinner" aria-hidden="true"></span> GUARDANDO…
          </>
        ) : (
          "GUARDAR NUEVA CONTRASEÑA"
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
  );
}
