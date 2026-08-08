---
name: spec-juego
description: Designs the spec for adding a new game with a real engine and leaderboard to Arcade Vault. Detects whether the game comes from references/started-games/, runs a port checklist, defines the catalog entry and the engine contract, and writes specs/NN-<slug>.md in Draft status. Use it before porting or writing any game.
disable-model-invocation: true
argument-hint: "<game-slug> or a short description of the game"
---

# /spec-juego — Guided spec designer for a new game

This skill is a specialized sibling of `/spec`, scoped to one recurring feature: adding a game with a real engine and a real leaderboard to Arcade Vault. **You don't write code here.** Your job is to triage the source material, ask the questions that are specific to porting or building a game, and produce `specs/NN-<slug>.md` in `Draft` status.

## Philosophy

SPEC 05 (Asteroids' engine), SPEC 06 (the `games` table) and SPEC 07 (the real leaderboard) took three specs and a platform refactor to get one game working end to end. That work is done: the platform now supports N real games through a small registry, so adding the next one should be a single guided spec, not archaeology through three prior specs. This skill exists to carry that hard-won shape forward — read it once from the canonical specs, apply it every time after.

Read `template.md` (in the same directory as this skill) for the full spec structure. It extends the generic `/spec` template with the sections a game-porting spec always needs.

## Command flow

- Follow the five phases in order. **Do not skip phases**, especially Phase 2 (source triage) — skipping it is exactly how a mid-implementation surprise happens (the game turns out to need audio, mouse input, or a second canvas).
- Your replies must be in the same language as the initial prompt. E.g.: if the initial prompt is in Spanish, your replies must be in Spanish; if it is in English, your replies must be in English.

### Phase 1 — Understand the platform

Before asking anything about the new game, load the current state of the platform:

1. Read the project-memory file, if one exists. Try in order and stop at the first hit: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `README.md`.
2. List `specs/` to find the next sequential number.
3. Read `specs/05-asteroides-juego-real.md`, `specs/06-tabla-juegos-supabase.md` and `specs/07-leaderboard-asteroides.md` — these are the canonical reference for what "a game with a real engine and leaderboard" means in this repo. Also read the spec that generalized the platform beyond a single game, if one exists (look for it in `specs/` by content, not by a fixed number).
4. Read `lib/games/registry.ts` (which slugs already have a real engine) and `components/games/engine-registry.tsx` (which component plays each one) to know the current state of the registry — the new game adds one entry to each, it never edits the mechanism itself.
5. Read the `/* Cover art generators */` block in `app/globals.css` to see the existing `.cover-*` classes and their color palette, so the new one is visually distinct.
6. Read the relevant guide under `node_modules/next/dist/docs/` before making any decision that touches Next.js routing, Server Components, Server Actions, or `next/dynamic` — this project pins a Next.js version with breaking changes from what most training data assumes.

If `$ARGUMENTS` is empty, ask for the game's slug or a one-sentence description before continuing.

### Phase 2 — Source triage

Determine whether the game comes from `references/started-games/<X>/` or is written from scratch.

**If it comes from a reference folder:**

1. Read its `game.js` (or equivalent), `README.md`, and `CLAUDE.md` if present.
2. Run the **port checklist** below against it.
3. Present the findings as a table — axis → what the original does → what the port must do — **before** moving to Phase 3's questions. This report is what prevents discovering mid-implementation that the game needs audio, mouse input, `localStorage`, or a second canvas.

**If it's written from scratch:** skip the checklist and ask directly what mechanics the game has, using the same categories as the checklist (input model, HUD placement, counters, restart) as your question framework.

**Port checklist** (built from comparing the three games under `references/started-games/` — they vary far more than the one existing port, Asteroids, suggests):

| Axis               | What to check in the original                                                                                                                                   | Port rule                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM globals        | `document`, `canvas`, `ctx` referenced at module scope                                                                                                          | The engine never touches them; `draw(ctx)` receives the context as a parameter                                                                                                                        |
| Clock              | `performance.now()` used inside game classes                                                                                                                    | Replace with an internal `elapsed` accumulator fed by `dt`                                                                                                                                            |
| Other browser APIs | `localStorage`, `getComputedStyle` reading CSS custom properties, `new Audio()`                                                                                 | Bake fixed values into the engine, or pass them in through config — never read the DOM/CSSOM from inside the engine                                                                                   |
| Boot               | `init(); requestAnimationFrame(loop)` firing at script load                                                                                                     | No side effects on import; the engine only starts on an explicit `reset()`                                                                                                                            |
| Input model        | polling `keys{}` object (Asteroids-style) vs. a `switch` inside the `keydown` handler (Tetris-style) vs. mouse move + canvas click hit-testing (Arkanoid-style) | Normalize all of it to one flat `Input` object delivered every frame via `update(dt, input)`; edge-triggered actions (e.g. "shoot", "hard drop") are detected by the canvas component, not the engine |
| HUD                | drawn inside the canvas (Asteroids, Arkanoid) vs. DOM elements with `.textContent` (Tetris)                                                                     | Decide explicitly: redraw it on canvas, or drop it and rely entirely on the external HUD via `onStateChange` — don't silently keep a DOM HUD, the platform has no slot for one                        |
| Overlays           | game over / pause / win screens                                                                                                                                 | All removed from the engine — the platform's existing modal owns end-of-game — and surfaced instead through `status` in `GameEngineState`                                                             |
| Counters           | score/lives/level vs. score/lines/level (no lives) vs. a win state                                                                                              | Map onto `GameEngineState` (`lib/games/types.ts`); fields that don't apply to this game stay `undefined`, which hides their HUD tile automatically                                                    |
| Multiple canvases  | Tetris has `#board` + `#next-canvas`                                                                                                                            | Either carve out a dedicated region of the single canvas the platform gives you, or have the canvas component internally mount a second `<canvas>` — the platform only renders one component per game |
| Assets             | spritesheet PNGs, MP3s (Arkanoid)                                                                                                                               | Under `public/games/<slug>/`; load them asynchronously and don't start the loop until they resolve                                                                                                    |
| Restart            | `initGame()` on a keypress, a DOM restart button                                                                                                                | Never inside the engine — the platform remounts the canvas component via `key={resetToken}`                                                                                                           |
| `dt`               | seconds vs. milliseconds, capped or uncapped                                                                                                                    | Seconds, clamped to 50ms per frame, with the loop's `lastTime` reset on resume so pausing never produces one giant catch-up frame                                                                     |

### Phase 3 — Clarify through questions

Ask in blocks of 3 to 5, with concrete options and your recommendation marked, same style as `/spec`. Categories specific to this skill:

- **Catalog entry.** `title`, `short`, `long`, `cat` (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `color` (must differ from every color already in use by a same-category game), `cover` (new `.cover-<slug>` class), `best`/`plays` placeholders, `controls`.
- **State contract.** `score` is mandatory. Which of `lives`, `level`, `lines` does this game actually have? Whatever is omitted hides its HUD tile automatically — confirm that's the intended external HUD for this game.
- **Controls.** Exact keys, which need `preventDefault` (arrow keys always do, to stop page scroll), which are edge-triggered (detected once per press, not held).
- **Scope vs. the original.** Which mechanics from the reference game are in, which are explicitly deferred to a future spec (this mirrors `/spec`'s scope questions, but anchored to "what does the reference implementation have that we are NOT porting now").
- **Leaderboard.** Does this game join the real `scores` schema (default: yes, same table/RLS/rate-limit as the rest, just a new `games` row and a new registry entry) or does it stay mock/`localStorage` for now?

### Phase 4 — Develop the spec section by section

Same discipline as `/spec`: one section at a time, shown in markdown, confirmed before moving on. Use `template.md` for the exact shape, including the two sections it adds beyond the generic template (the registry entries and the Supabase migration for the `games` row).

### Phase 5 — Save the spec

1. Determine the next number from `specs/`.
2. Slug from the game's name (e.g. `tetris`, `arkanoid`).
3. Confirm the filename with the user before writing.
4. Write `specs/NN-<slug>.md`, status `Draft`.
5. Seed `specs/.spec-config.yml` if missing, exactly as `/spec` does — check first, never overwrite an existing one.
6. Confirm to the user: path of the file, reminder that it's `Draft`, and that the next step is `/spec-impl NN-<slug>`. **Stop here.**

## Hard rules

- **Never write code during this command.** Only the spec's `.md` file at the end.
- **Never propose implementing the spec after saving it.**
- **Never mark the spec `Approved`.**
- **Never skip the source-triage phase** when the game comes from `references/started-games/` — that report is the highest-value output of this skill.
- **The spec must always list both registry edits**: the slug added to `REAL_GAME_SLUGS` in `lib/games/registry.ts`, and its `dynamic()` entry added to `GAME_ENGINES` in `components/games/engine-registry.tsx`. Forgetting the second one is a TypeScript compile error (`Record<RealGameSlug, …>` requires every key), but the spec should say so explicitly rather than relying on the implementer to hit the error.
- **If the leaderboard is real**, the spec's implementation plan must include the `insert into public.games (...)` SQL statement and prescribe applying it with the Supabase MCP's `apply_migration` (showing the SQL and asking for confirmation first), followed by a verification query via `execute_sql` confirming the row exists and has the expected values.
- **Never assume decisions the user did not confirm.**

## Tone when asking questions

Same as `/spec`: direct, specific, numbered when there are several. No hedging language.

## Arguments

If invoked as `/spec-juego tetris`, use `tetris` as the slug and confirm it maps to `references/started-games/03-tetris/` before reading anything else. If invoked with a description instead of a slug, derive a candidate slug and confirm it in Phase 5 like `/spec` does. If invoked with no arguments, ask for the game first.
