"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getGameEngine, GameEngineSlot } from "@/components/games/engine-registry";
import { useTheme } from "@/components/theme-provider";
import { useTouchDevice } from "@/components/games/use-touch-device";
import { useUser } from "@/components/user-provider";
import type { Game } from "@/lib/data";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { hasRealEngine } from "@/lib/games/registry";
import { SKIN_IDS, SKIN_LABELS, SKINNED_GAME_SLUGS, isSkinId } from "@/lib/games/skins";
import { TOUCH_ENABLED_GAME_SLUGS } from "@/lib/games/touch";
import type { GameEngineState } from "@/lib/games/types";
import { guardarPuntuacion, migrarPuntuacionesLocales } from "@/lib/supabase/score-actions";

const SCORES_STORAGE_KEY = "av_scores";

type SavedScore = { game: string; score: number; name: string; at: number };

function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

const INITIAL_ENGINE_STATE: GameEngineState = { score: 0, lives: 3, level: 1 };

// Store vacío para `useSyncExternalStore`: nunca notifica cambios, solo sirve
// para distinguir "render de servidor" (false) de "ya hidratado" (true).
const subscribeNunca = () => () => {};
const snapshotCliente = () => true;
const snapshotServidor = () => false;

// Orientación del viewport, para el aviso "GIRÁ TU DISPOSITIVO" (SPEC 11).
// A diferencia de `hydrated`, esto SÍ cambia en caliente cuando el jugador
// rota el dispositivo, así que se suscribe de verdad al evento "change" del
// MediaQueryList en vez de usar el store vacío. Snapshot de servidor `false`
// (nunca portrait) por el mismo motivo que `hydrated`: el servidor no puede
// evaluar matchMedia.
const PORTRAIT_QUERY = "(orientation: portrait)";
function subscribePortrait(onChange: () => void) {
  const mql = window.matchMedia(PORTRAIT_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
function snapshotPortraitCliente() {
  return window.matchMedia(PORTRAIT_QUERY).matches;
}
function snapshotPortraitServidor() {
  return false;
}

// Compara campo a campo antes de reemplazar el estado: onStateChange llega
// ~60 veces por segundo, casi siempre con el mismo valor. Un objeto nuevo en
// cada frame anularía el bail-out de re-render que React hace cuando el
// estado no cambió (a diferencia de los setState primitivos que reemplazó).
function engineStateEquals(a: GameEngineState, b: GameEngineState) {
  return (
    a.score === b.score &&
    a.lives === b.lives &&
    a.level === b.level &&
    a.lines === b.lines &&
    a.status === b.status
  );
}

export function GamePlayer({ game }: { game: Game }) {
  const { user, loading: userLoading } = useUser();
  // Skin + modo claro/oscuro: la paleta se resuelve en la plataforma y baja
  // al motor como prop. Cambiarla NO remonta el canvas (no entra en
  // `resetToken`), así que cambiar de skin a media partida es gratis.
  const { skin, skinId, setSkinId } = useTheme();
  // getGameEngine devuelve siempre la misma referencia de componente para un
  // slug dado (ver components/games/engine-registry.ts): así React
  // reconcilia el mismo tipo entre renders y nunca remonta el canvas. Se
  // renderiza a través de <GameEngineSlot engine={Engine} .../> —no
  // directamente <Engine .../>— porque el linter de React Compiler
  // (react-hooks/static-components) no puede verificar que el resultado de
  // una llamada a función sea un componente estable cuando se usa como tag
  // JSX; como prop sí lo acepta.
  const Engine = getGameEngine(game.id);
  const isRealEngine = Engine !== undefined;
  // Piloto táctil (SPEC 11): solo Asteroides está en TOUCH_ENABLED_GAME_SLUGS
  // hoy, así que para el resto del catálogo `touchEnabled` da false y nada de
  // lo que sigue (aviso de rotación, touch-action: none) se activa.
  // hasRealEngine(game.id) angosta el tipo de game.id a RealGameSlug antes de
  // consultar el array tipado — sin el guard, TypeScript rechaza pasar un
  // `string` genérico a `.includes()` de un `readonly RealGameSlug[]`.
  const touchEnabled = hasRealEngine(game.id) && TOUCH_ENABLED_GAME_SLUGS.includes(game.id);
  const isTouch = useTouchDevice();
  const isPortrait = useSyncExternalStore(
    subscribePortrait,
    snapshotPortraitCliente,
    snapshotPortraitServidor,
  );
  // Bloquea el CRT y fuerza pausa del motor sin desmontarlo (ver el `style`
  // condicional más abajo): así una rotación accidental a mitad de partida no
  // pierde el progreso, a diferencia de condicionar el JSX del propio
  // GameEngineSlot.
  const orientationBlocked = touchEnabled && isTouch && isPortrait;
  const [engineState, setEngineState] = useState<GameEngineState>(INITIAL_ENGINE_STATE);
  const score = engineState.score;
  // Para el resto del catálogo (simulado) vidas/nivel siguen fijos/derivados
  // del score, tal como antes; un motor real los recibe en vivo vía
  // onStateChange y puede omitir el que no le aplique (undefined oculta la
  // tarjeta correspondiente del HUD, ver más abajo).
  const lives = isRealEngine ? engineState.lives : 3;
  const level = isRealEngine ? engineState.level : 1 + Math.floor(score / 2500);
  // A diferencia de vidas/nivel, el resto del catálogo (mock) no tiene un
  // equivalente derivable de líneas: queda undefined salvo que un motor real
  // (hoy solo Tetris) lo reporte, ocultando la tarjeta en todos los demás.
  const lines = isRealEngine ? engineState.lines : undefined;
  const [resetToken, setResetToken] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // user resuelve de forma asíncrona (sesión real de Supabase). En vez de
  // capturar un valor fijo con useState (que se congelaría en "INVITADO" si
  // todavía no había resuelto al montar), el nombre se deriva en cada render
  // y solo se guarda localmente si el jugador edita sus iniciales a mano.
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = nameOverride ?? (user ? user.name : "INVITADO");
  // Solo los juegos con motor real persisten en Supabase; ahí, con sesión
  // iniciada el nombre deja de ser editable (se guarda con el display_name
  // de la cuenta). El resto del catálogo (mock, localStorage) sigue siendo
  // editable siempre.
  const nameIsEditable = !(isRealEngine && user);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // El selector de skin se monta después de hidratar: su valor sale de
  // localStorage (av_skin), que el servidor no puede conocer, y renderizarlo
  // en el HTML inicial provocaría un desajuste de hidratación en el <select>.
  // useSyncExternalStore con snapshot de servidor `false` es la forma que no
  // dispara react-hooks/set-state-in-effect (un setState dentro de un efecto
  // sería una cascada de renders para el compilador de React).
  // El canvas NO espera a esto — recibe la skin correcta desde el primer
  // render de cliente, así que no hay parpadeo de paleta en el juego.
  const hydrated = useSyncExternalStore(subscribeNunca, snapshotCliente, snapshotServidor);
  const showSkinPicker = hydrated && isRealEngine && SKINNED_GAME_SLUGS.includes(game.id);

  useEffect(() => {
    if (isRealEngine) return;
    if (over || paused) return;
    const t = setInterval(
      () => setEngineState((s) => ({ ...s, score: s.score + Math.floor(10 + Math.random() * 90) })),
      220,
    );
    return () => clearInterval(t);
  }, [isRealEngine, over, paused]);

  // Migración automática y silenciosa del histórico de av_scores de ESTE
  // juego hacia Supabase, una sola vez por navegador (flag por juego:
  // av_scores_migrated_<slug>). Corre al montar esta pantalla (no depende de
  // que el jugador termine una partida). `migrationAttempted` evita un doble
  // intento concurrente (p. ej. el doble-invoke de efectos en desarrollo); si
  // el intento falla, se libera para reintentar en el próximo montaje sin
  // haber marcado el flag.
  const migrationFlagKey = `av_scores_migrated_${game.id}`;
  const migrationAttempted = useRef(false);
  useEffect(() => {
    if (!isRealEngine) return;
    if (userLoading) return;
    if (migrationAttempted.current) return;
    if (localStorage.getItem(migrationFlagKey) === "1") return;

    let historial: SavedScore[];
    try {
      historial = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY) || "[]");
    } catch {
      historial = [];
    }
    const entries = historial
      .filter((entry) => entry.game === game.id)
      .map((entry) => ({ score: entry.score, name: entry.name, at: entry.at }));

    if (entries.length === 0) return;

    migrationAttempted.current = true;
    const guestId = user ? null : getOrCreateGuestId();
    migrarPuntuacionesLocales(game.id, entries, guestId)
      .then((result) => {
        if (result.migrated > 0) {
          localStorage.setItem(migrationFlagKey, "1");
        } else {
          migrationAttempted.current = false;
        }
      })
      .catch(() => {
        migrationAttempted.current = false;
      });
  }, [isRealEngine, userLoading, user, game.id, migrationFlagKey]);

  const handleStateChange = useCallback((next: GameEngineState) => {
    setEngineState((prev) => (engineStateEquals(prev, next) ? prev : next));
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setEngineState((prev) => ({ ...prev, score: finalScore }));
    setOver(true);
  }, []);

  const endGame = () => setOver(true);
  const restart = () => {
    setEngineState(INITIAL_ENGINE_STATE);
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
    const result = await guardarPuntuacion({ gameSlug: game.id, score, playerName: name, guestId });
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
          {lives !== undefined && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {lines !== undefined && (
            <div className="hud-stat lines">
              <div className="l">Líneas</div>
              <div className="v">{String(lines).padStart(3, "0")}</div>
            </div>
          )}
          {level !== undefined && (
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(level).padStart(2, "0")}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          {showSkinPicker && (
            <label className="skin-picker">
              <span className="l">Skin</span>
              <select
                value={skinId}
                onChange={(e) => {
                  if (isSkinId(e.target.value)) setSkinId(e.target.value);
                }}
              >
                {SKIN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SKIN_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          )}
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

      {orientationBlocked && (
        <div className="crt">
          <div className="crt-screen">
            <div className="rotate-notice">
              <div className="rotate-icon" aria-hidden="true">
                ⟳
              </div>
              <div className="pixel neon-yellow" style={{ fontSize: 18 }}>
                GIRÁ TU DISPOSITIVO
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
                {game.title.toUpperCase()} SE JUEGA EN HORIZONTAL
              </div>
            </div>
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>
      )}

      {/* Se mantiene montado incluso con orientationBlocked (oculto por CSS,
          no removido del árbol): así el motor no se reinicia si el jugador
          rota el dispositivo a mitad de partida. */}
      <div className="crt" style={orientationBlocked ? { display: "none" } : undefined}>
        <div className="crt-screen">
          <div className="game-arena">
            {Engine ? (
              <GameEngineSlot
                key={resetToken}
                engine={Engine}
                paused={paused || over || orientationBlocked}
                skin={skin}
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
            <h2>{engineState.status === "won" ? "¡VICTORIA!" : "FIN DEL JUEGO"}</h2>
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
