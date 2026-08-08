"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/components/user-provider";
import { seededScores, type Game } from "@/lib/data";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { createClient } from "@/lib/supabase/client";
import {
  getMejoresPuntuaciones,
  getMiMejorPuntuacion,
  type LeaderboardRow,
} from "@/lib/supabase/scores";

// Fila ya normalizada para el render, venga de seededScores() (mock) o de
// Supabase (ASTEROIDES) — mismo shape, la fuente de datos es transparente
// para el podio/tabla de abajo.
type DisplayRow = { rank: number; name: string; score: number; date: string };

function formatFecha(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export function SalonHall({ games }: { games: Game[] }) {
  const { user } = useUser();
  const [tab, setTab] = useState(games[0].id);
  const game = games.find((g) => g.id === tab)!;
  // Único juego con leaderboard real hoy (ver SPEC 07) — mismo criterio que
  // components/game-player.tsx (`isRealEngine`). El resto del catálogo sigue
  // con seededScores() mock, sin ningún cambio.
  const isAsteroides = game.controls === "teclado";

  const mockRows = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);

  // Se guarda junto al `tab` con el que se pidió: así "loading" y "ya cargó
  // pero está vacío" se derivan comparando `realData.tab` con el `tab`
  // actual, en vez de un setState síncrono al inicio del efecto (que
  // dispara un render en cascada innecesario).
  const [realData, setRealData] = useState<{
    tab: string;
    rows: LeaderboardRow[];
    mine: { rank: number; score: number } | null;
  } | null>(null);

  useEffect(() => {
    if (!isAsteroides) return;
    let cancelled = false;

    const supabase = createClient();
    const guestId = user ? null : getOrCreateGuestId();

    Promise.all([
      getMejoresPuntuaciones(supabase, tab, 12),
      getMiMejorPuntuacion(supabase, tab, guestId),
    ]).then(([best, mine]) => {
      if (cancelled) return;
      setRealData({ tab, rows: best, mine });
    });

    return () => {
      cancelled = true;
    };
  }, [isAsteroides, tab, user]);

  const dataForTab = realData?.tab === tab ? realData : null;
  const loadingReal = isAsteroides && !dataForTab;
  const realRows = dataForTab?.rows ?? [];
  const myBest = dataForTab?.mine ?? null;

  const rows: DisplayRow[] = isAsteroides
    ? realRows.map((r) => ({
        rank: r.rank,
        name: r.playerName,
        score: r.score,
        date: formatFecha(r.createdAt),
      }))
    : mockRows.map((r) => ({ rank: r.rank, name: r.name, score: r.score, date: r.date }));

  // "TU MEJOR MARCA": en ASTEROIDES también para invitados (identidad estable
  // vía guest_id, ver SPEC 07); en el resto del catálogo sigue siendo
  // exclusiva de usuarios con sesión, sin cambios.
  const showYouRow = isAsteroides ? myBest !== null : Boolean(user);
  const you = !showYouRow
    ? null
    : isAsteroides
      ? {
          rank: myBest!.rank,
          score: myBest!.score,
          name: user ? user.name : "INVITADO",
          // getMiMejorPuntuacion no expone la fecha de la mejor marca (solo
          // rank + score, tal como pide el spec) — no hay de dónde sacarla.
          date: "—",
        }
      : {
          rank: Math.floor(8 + (tab.length % 4)),
          score: mockRows[5]?.score - 2400 || 9999,
          name: user!.name,
          date: "11/05/2026",
        };

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {isAsteroides && loadingReal ? (
        <div
          className="mono"
          style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-dim)" }}
        >
          CARGANDO PUNTUACIONES…
        </div>
      ) : isAsteroides && rows.length === 0 ? (
        <div
          className="mono"
          style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-dim)" }}
        >
          SIN PUNTUACIONES TODAVÍA. ¡SÉ EL PRIMERO EN GRABAR TU MARCA!
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
                <div className="date">{rows[1].date}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
                >
                  CAMPEÓN
                </div>
                <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
                <div className="date">{rows[2].date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
                <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(you.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.name}
                  </div>
                  <div
                    className="sc"
                    style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
                  >
                    {you.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{you.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
