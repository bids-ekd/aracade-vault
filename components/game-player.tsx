"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AsteroidsCanvas } from "@/components/games/asteroids/asteroids-canvas";
import { useUser } from "@/components/user-provider";
import type { Game } from "@/lib/data";

const SCORES_STORAGE_KEY = "av_scores";

type SavedScore = { game: string; score: number; name: string; at: number };

function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useUser();
  // ASTEROIDES es, por ahora, el único juego con motor real: cuando `controls`
  // es "teclado" se monta AsteroidsCanvas en vez de la simulación mock.
  const isRealEngine = game.controls === "teclado";
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [resetToken, setResetToken] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // user resuelve de forma asíncrona (sesión real de Supabase). En vez de
  // capturar un valor fijo con useState (que se congelaría en "INVITADO" si
  // todavía no había resuelto al montar), el nombre se deriva en cada render
  // y solo se guarda localmente si el jugador edita sus iniciales a mano.
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = nameOverride ?? (user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  // Para el resto del catálogo (simulado) el nivel sigue derivándose del score,
  // tal como antes; ASTEROIDES lo recibe en vivo del motor vía onStateChange.
  const displayLevel = isRealEngine ? level : 1 + Math.floor(score / 2500);

  useEffect(() => {
    if (isRealEngine) return;
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [isRealEngine, over, paused]);

  const handleStateChange = useCallback(
    (state: { score: number; lives: number; level: number }) => {
      setScore(state.score);
      setLives(state.lives);
      setLevel(state.level);
    },
    [],
  );

  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  const endGame = () => setOver(true);
  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isRealEngine) setResetToken((t) => t + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juego/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            {isRealEngine ? (
              <AsteroidsCanvas
                key={resetToken}
                paused={paused || over}
                onStateChange={handleStateChange}
                onGameOver={handleGameOver}
              />
            ) : (
              <>
                <div className="grid-floor"></div>
                <div className="enemy e1"></div>
                <div className="enemy e2"></div>
                <div className="enemy e3"></div>
                <div className="player-ship"></div>
              </>
            )}
          </div>
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setNameOverride(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
