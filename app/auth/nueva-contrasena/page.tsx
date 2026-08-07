import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevaContrasenaForm } from "./nueva-contrasena-form";

export default async function NuevaContrasenaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/auth/recuperar");
  }

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
            DEFINIR NUEVA CONTRASEÑA
          </div>
        </div>

        <NuevaContrasenaForm />
      </div>
    </div>
  );
}
