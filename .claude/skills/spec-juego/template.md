# Template for a game-porting spec

This is what `/spec-juego` consults when writing `specs/NN-<slug>.md`. It follows the same header/scope/data-model/plan/acceptance/decisions/risks shape as the generic `/spec` template (`.agents/skills/spec/template.md`) — read that one too. This file only adds the parts that repeat on **every** game spec, so the skill doesn't reinvent them each time.

---

## Header

Same blockquote format as every spec in this repo:

```markdown
# SPEC NN — <Game name> (real game)

> **Status:** Draft
> **Depends on:** [05-asteroides-juego-real](./05-asteroides-juego-real.md), [06-tabla-juegos-supabase](./06-tabla-juegos-supabase.md), [07-leaderboard-asteroides](./07-leaderboard-asteroides.md)
> **Date:** YYYY-MM-DD
> **Objective:** One sentence — port <game> from references/started-games/<X>/ (or: build <game> from scratch) with a real engine and a real leaderboard.
```

Add the platform-generalization spec to `Depends on` too, once it has its own number — the registry (`lib/games/registry.ts` / `components/games/engine-registry.tsx`) it relies on comes from there, not from SPEC 05.

---

## Scope

Same `**In:**` / `**Out of scope (for future specs):**` split as the generic template. For a game spec, `**In:**` always covers: the catalog entry, the `.cover-<slug>` class, the ported/written engine, the canvas component, the two registry edits, and (if the leaderboard is real) the `games` row. `**Out of scope**` always covers: any mechanic from the reference implementation that isn't being ported yet, and any other game in `references/started-games/` — this spec ports exactly one.

---

## Data model

Three things, always in this order:

**1. The engine's public contract** (`components/games/<slug>/engine.ts`), following the shape `AsteroidsEngine` already established:

```ts
export type <Name>State = {
  score: number;
  lives?: number;   // omit the fields this game doesn't have
  level?: number;
  lines?: number;
  status?: "playing" | "won" | "gameover";
};

export type <Name>Input = { /* whatever this game's controls need */ };

export class <Name>Engine {
  constructor(width: number, height: number);
  reset(): void;
  update(dt: number, input: <Name>Input): void;
  draw(ctx: CanvasRenderingContext2D): void;
  getState(): <Name>State;
}
```

State note: the platform's shared contract lives in `lib/games/types.ts` as `GameEngineState` (`{ score, lives?, level?, lines?, status? }`) and `GameCanvasProps` (`{ paused, onStateChange, onGameOver }`). `<Name>State` above should be assignable to `GameEngineState` — don't invent a parallel shape.

**2. The canvas component** (`components/games/<slug>/<slug>-canvas.tsx`):

```tsx
export function <Name>Canvas(props: GameCanvasProps): JSX.Element;
```

Same responsibilities as `AsteroidsCanvas`: owns the `<canvas>`, DPR scaling, the `requestAnimationFrame` loop (dt clamped to 50ms, `lastTime` reset on resume), keyboard/mouse listeners with cleanup, and freezing completely when `paused` is true.

**3. If the leaderboard is real, the Supabase row:**

```sql
insert into public.games (slug, title, short, long, cat, cover, color, controls, best, plays)
values ('<slug>', '<TITLE>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', '<controls>', <best>, '<plays>');
```

---

## Implementation plan

Canonical 7-step shape — adjust step count only for genuine per-game complexity (e.g. a second canvas, async asset loading), never to skip one of these:

1. **Catalog row.** Apply the `insert` above with the Supabase MCP's `apply_migration` (show the SQL, ask for confirmation first). Verify afterward with `execute_sql` that the row exists with the expected values. If the leaderboard stays mock instead, this step is skipped and the game gets a `lib/data.ts` entry like the other 8.
2. **Cover art.** Add `.cover-<slug>` (and `::before`/`::after` as needed) to the "Cover art generators" block in `app/globals.css`, with a color distinct from same-category siblings.
3. **Engine.** Port or write `components/games/<slug>/engine.ts` — isolated, not connected to any screen yet. Apply every relevant row from the Phase 2 port checklist.
4. **Canvas component.** `components/games/<slug>/<slug>-canvas.tsx` — DPR sizing, input listeners with cleanup, pause freezing the loop entirely, `onStateChange`/`onGameOver` wired to `getState()`. Still not connected to any screen.
5. **Registry.** Add `"<slug>"` to `REAL_GAME_SLUGS` in `lib/games/registry.ts`, and its `dynamic()` entry to `GAME_ENGINES` in `components/games/engine-registry.tsx`. **From this step on, the game is playable end to end at `/juego/<slug>/jugar` without touching `game-player.tsx`, `score-actions.ts`, `salon-hall.tsx`, or `app/juego/[id]/page.tsx`** — the whole point of the platform refactor those specs did.
6. **Leaderboard verification.** Confirm `/salon` and `/juego/<slug>` show real Supabase data for this game, and that saving a score from the end-of-game modal persists correctly (with the existing rate-limit and guest/session identity rules applying unchanged).
7. **Final review.** `npm run lint` and `npm run build` clean; manual playthrough of every mechanic in scope; confirm every other game in the catalog (`asteroides` included) still works exactly as before.

---

## Acceptance criteria

Always include these, plus whatever is specific to this game's mechanics:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `/biblioteca` shows a new card for the game, with its own `.cover-<slug>` and a color distinct from other same-category games.
- [ ] `/juego/<slug>` (detail) shows the approved copy and the right controls label.
- [ ] `/juego/<slug>/jugar` renders the real canvas: every control in scope works, matching the reference implementation's rules.
- [ ] The external HUD (`player-hud`) shows exactly the fields this game reports (`score` always; `lives`/`level`/`lines` only if the engine sends them) and stays in sync with whatever the canvas draws internally, if it draws anything.
- [ ] Pause freezes the game completely (nothing moves, input is ignored); resume continues without a physics jump.
- [ ] The end-of-game modal opens correctly and, if the leaderboard is real, saving a score persists it in Supabase under this game's row and respects the 10s rate-limit.
- [ ] "Play again" starts a fresh run (new engine instance via remount) with score/lives/level/lines back to their initial values.
- [ ] `/salon` and `/juego/<slug>` show real leaderboard data for this game, if in scope; every other game (including `asteroides`) keeps showing exactly what it showed before this spec.
- [ ] No regressions in any other game in the catalog.

---

## Decisions

Always carry these forward unless the user explicitly overrides them for this game — restate them briefly with a one-line reason, don't just link back:

- **Yes:** engine is DOM-free (`engine.ts`), wrapped by a `"use client"` canvas component that owns all the React/browser integration. Same split as Asteroids — keeps the port close to the reference source and isolates risk.
- **Yes:** game-over overlays and restart shortcuts are removed from the engine; the platform's existing modal owns end of game.
- **Yes:** restart is a `key={resetToken}` remount, never an imperative `reset()` exposed by the canvas component.
- **Yes (if leaderboard is real):** the same anti-abuse controls as SPEC 07 apply unchanged — score range `CHECK`, 10s rate-limit trigger, RLS tying `user_id` to `auth.uid()`. No new controls are invented per game.

---

## Risks

Always list, plus anything specific to this game found during Phase 2 triage:

| Risk                                                                                                                           | Mitigation                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| A mechanic present in the reference implementation gets silently dropped during the port                                       | The Phase 2 port-checklist report is attached to this spec's history; acceptance criteria enumerate every in-scope mechanic explicitly |
| Forgetting the second registry entry (`components/games/engine-registry.tsx`) after adding the slug to `lib/games/registry.ts` | `Record<RealGameSlug, …>` makes this a TypeScript compile error, not a silent runtime gap — step 5 of the plan calls out both edits    |
| A cheated/implausible score from a modified client (same residual risk as SPEC 07, inherited unchanged)                        | Accepted; server-side replay validation remains out of scope until it becomes a real problem                                           |
