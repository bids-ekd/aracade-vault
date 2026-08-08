"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AsteroidsCanvas } from "@/components/games/asteroids/asteroids-canvas";
import { useUser } from "@/components/user-provider";
import type { Game } from "@/lib/data";
import { getOrCreateGuestId } from "@/lib/guest-id";
import {
  guardarPuntuacionAsteroides,
  migrarPuntuacionesLocales,
} from "@/lib/supabase/score-actions";

const SCORES_STORAGE_KEY = "av_scores";
const MIGRATION_FLAG_KEY = "av_scores_migrated_asteroides";

type SavedScore = { game: string; score: number; name: string; at: number };

function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function GamePlayer({ game }: { game: Game }) {
  const { user, loading: userLoading } = useUser();
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
  // Solo ASTEROIDES persiste en Supabase; ahí, con sesión iniciada el nombre
  // deja de ser editable (se guarda con el display_name de la cuenta). El
  // resto del catálogo (mock, localStorage) sigue siendo editable siempre.
  const nameIsEditable = !(isRealEngine && user);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Para el resto del catálogo (simulado) el nivel sigue derivándose del score,
  // tal como antes; ASTEROIDES lo recibe en vivo del motor vía onStateChange.
  const displayLevel = isRealEngine ? level : 1 + Math.floor(score / 2500);

  useEffect(() => {
    if (isRealEngine) return;
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [isRealEngine, over, paused]);

  // Migración automática y silenciosa del histórico de av_scores ("asteroides")
  // a Supabase, una sola vez por navegador. Corre al montar esta pantalla (no
  // depende de que el jugador termine una partida). `migrationAttempted`
  // evita un doble intento concurrente (p. ej. el doble-invoke de efectos en
  // desarrollo); si el intento falla, se libera para reintentar en el
  // próximo montaje sin haber marcado el flag.
  const migrationAttempted = useRef(false);
  useEffect(() => {
    if (!isRealEngine) return;
    if (userLoading) return;
    if (migrationAttempted.current) return;
    if (localStorage.getItem(MIGRATION_FLAG_KEY) === "1") return;

    let historial: SavedScore[];
    try {
      historial = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY) || "[]");
    } catch {
      historial = [];
    }
    const entries = historial
      .filter((entry) => entry.game === "asteroides")
      .map((entry) => ({ score: entry.score, name: entry.name, at: entry.at }));

    if (entries.length === 0) return;

    migrationAttempted.current = true;
    const guestId = user ? null : getOrCreateGuestId();
    migrarPuntuacionesLocales(entries, guestId)
      .then((result) => {
        if (result.migrated > 0) {
          localStorage.setItem(MIGRATION_FLAG_KEY, "1");
        } else {
          migrationAttempted.current = false;
        }
      })
      .catch(() => {
        migrationAttempted.current = false;
      });
  }, [isRealEngine, userLoading, user]);

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
    setSaving(false);
    setSaveError(null);
    if (isRealEngine) setResetToken((t) => t + 1);
  };

  const handleSaveScore = async () => {
    if (!isRealEngine) {
      saveScore({ game: game.id, score, name });
      setSaved(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    const guestId = user ? null : getOrCreateGuestId();
    const result = await guardarPuntuacionAsteroides({ score, playerName: name, guestId });
    setSaving(false);

    if (result.ok) {
      setSaved(true);
    } else {
      setSaveError(result.error);
    }
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
              <>
                <div className="input-row">
                  <input
                    value={name}
                    readOnly={!nameIsEditable}
                    onChange={
                      nameIsEditable
                        ? (e) => setNameOverride(e.target.value.toUpperCase().slice(0, 10))
                        : undefined
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button className="btn yellow" onClick={handleSaveScore} disabled={saving}>
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveError && (
                  <div className="mono" style={{ color: "var(--magenta)", fontSize: 11 }}>
                    ▸ {saveError}
                  </div>
                )}
              </>
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
