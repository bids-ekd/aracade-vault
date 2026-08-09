"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/components/user-provider";
import { useTheme } from "@/components/theme-provider";

// Toggle claro/oscuro. Los dos iconos se renderizan siempre y es el CSS
// (:root[data-theme="…"] .theme-toggle .when-…) el que muestra uno u otro:
// si el icono dependiera del estado de React habría un desajuste de
// hidratación cuando el script inline ya dejó <html> en modo claro.
function ThemeToggle({ className }: { className?: string }) {
  const { toggleMode } = useTheme();
  return (
    <button
      className={"btn ghost theme-toggle" + (className ? " " + className : "")}
      onClick={toggleMode}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar entre modo claro y oscuro"
    >
      <span className="when-dark" aria-hidden="true">
        ☾
      </span>
      <span className="when-light" aria-hidden="true">
        ☀
      </span>
    </button>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  const isActive = (name: "home" | "biblioteca" | "salon" | "acerca-de" | "auth") => {
    if (name === "home") return pathname === "/";
    if (name === "biblioteca") return pathname === "/biblioteca" || pathname.startsWith("/juego");
    if (name === "salon") return pathname === "/salon";
    if (name === "acerca-de") return pathname === "/acerca-de";
    return pathname === "/auth";
  };

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("home") ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isActive("biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/acerca-de" className={isActive("acerca-de") ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        <ThemeToggle />
        {user ? (
          <button
            className="btn ghost auth-btn"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isActive("home") ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link href="/biblioteca" className={isActive("biblioteca") ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon" className={isActive("salon") ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/acerca-de" className={isActive("acerca-de") ? "active" : ""} onClick={close}>
          Acerca de
        </Link>
        <Link href="/auth" className={isActive("auth") ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <ThemeToggle className="theme-toggle-mobile" />
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
