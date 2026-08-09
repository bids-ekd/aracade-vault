import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono, Courier_Prime } from "next/font/google";
import { UserProvider } from "@/components/user-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import "./globals.css";

// Script inline que aplica el modo claro/oscuro ANTES del primer paint: corre
// de forma síncrona mientras el navegador parsea el HTML, así que no hay
// flash del tema por defecto (un useEffect corre después de pintar). Lee la
// misma clave que components/theme-provider.tsx (av_theme). Ver
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("av_theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}})()`;

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start-2p",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier-prime",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Juega online y compite por la mayor cantidad de puntos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="dark"
      suppressHydrationWarning
      className={`${pressStart2P.variable} ${jetBrainsMono.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="av-bg" />
        <div className="av-noise" />
        <ThemeProvider>
          <UserProvider>
            <div className="av-shell">
              <Nav />
              <main className="av-main">{children}</main>
              <footer className="mono border-t border-(--line) px-8 py-5 text-center text-[11px] tracking-[0.16em] text-(--ink-faint)">
                © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
              </footer>
            </div>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
