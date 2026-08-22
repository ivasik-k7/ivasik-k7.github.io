# Scene Engine

A small, opinionated engine for cozy side-view pixel games: walk, look, poke
at things, talk, travel between scenes. It runs the game at
[ivasik-k7.github.io](https://ivasik-k7.github.io) and is written to be
reusable for games that are nothing like it — see the minimal complete game
at [`src/game/example/ExampleGame.tsx`](../game/example/ExampleGame.tsx)
(~200 lines, playable at `/example`).

## The five-minute version

```tsx
import { GameRuntime, type RuntimeConfig } from "@/engine";

const CONFIG: RuntimeConfig<World> = {
  scenes: { stop: STOP_SCENE, yard: () => import("./yard").then((m) => m.YARD) },
  start: { scene: "stop", x: 90 },
  initialWorld: { read: 0 },
  player: { width, height, cell, palette, frames, walkCycle, actions },
  handlers: { read: ({ obj, showToast }) => showToast(LINES[obj.id]) },
  objectLabel: (obj) => LABEL[obj.id],
};

<GameRuntime config={CONFIG} />;
```

A scene is artwork (an SVG component drawn on a `width × 180` logical canvas,
floor line at y=150) plus a list of objects (`{id, kind, x, range}`); a game
is scenes plus a player sprite rig plus a table of interaction handlers keyed
by object `kind`. The engine owns everything between: input (keyboard,
gamepad, touch), movement, camera, targeting, action animation, idle life,
cutscenes, dialogue, saves, travel.

## Design rules (the ones that matter)

- **React never runs the game.** One rAF loop owns simulation and writes
  per-frame values straight to DOM refs; React state changes only on rare
  events (scene switch, dialogue, toast, overlay). A world write repaints
  scene art only when its `artKey(world, phase)` fingerprint changes.
- **Fixed-step simulation** (default 120 Hz, bounded accumulator) — movement
  covers the same ground on a 30 Hz laptop and a 165 Hz monitor.
- **Everything heavy is lazy**: scene registry entries may be loaders
  (`() => Promise<SceneDef>`); the chunk loads behind the travel fade.
- **Everything optional is additive.** A plain `GameConfig` runs unchanged;
  `Runtime*` types only add optional capability on top.

## Concepts

| Concept | Where | In one line |
|---|---|---|
| Scene | `SceneDef` / `RuntimeSceneDef` | art component + objects + optional ground band, actors, lifecycle, artKey |
| Ground band | `ground: {top, bottom, blockers?}` | the floor becomes a walkable depth strip; omit it for the classic single line |
| Objects | `SceneObject` | interaction points: `kind` dispatches into your handler table; `to` makes a door |
| Targeting | `core/math.ts` | scored by distance bent by facing and priority, sticky, manually cyclable |
| Actions | `ActionDef` | enter → loop → exit frame animation with interrupt/abort semantics |
| Idle life | `core/idleBrain.ts` | breath, jittered blinks, flourishes after real idle time |
| Actors | `ActorDef` | scripted background characters stepped and culled by the loop |
| Cutscenes | `SeqStep[]` via `runSequence` | walk/say/hold/fx/travel beats; cancellable; cinematic letterbox |
| Dialogue | `systems/dialogue.ts` | branching trees with `when`/`locked`/`once` choices, moods, reactions |
| Lifecycle | `enter` / `exit` / `preload` | arrival, departure, and warm-behind-the-fade hooks per scene |
| Saves | `persist: {key, version}` | debounced, versioned localStorage; `migrate()` upgrades old slots |
| Debug | F3 / `RuntimeApi` | live frame provenance HUD; `onReady(api)` for tests and tooling |

## Module map

```
core/     pure, DOM-free, unit-tested: types, math/targeting, ground band,
          actionPlayer, idleBrain, cameraRig, sequencer, perf machinery
systems/  dialogue, save, inventory — pure logic
sprite/   character-map rig builders (npc, animal, player) — lazy registries
scene/    pixelKit art toolkit (materials, bevels, dither, LIGHT v2, 3×5 font)
audio/    procedural lofi, ambience, sfx, mumble voices
ui/       presentational React: actors, dialogue box, prompts, frame ticker
runtime/  GameRuntime — the loop and the DOM writes; orchestration only
```

The barrel (`index.ts`) exports the whole working surface. The intentionally
public part is what the table above names; sprite/scene-kit internals are
exported for this repo's authoring workflow and would be trimmed at the point
of packaging (see `docs/ARCHITECTURE.md`, Phase 7 notes).

## Verification & performance

- `npm test` — unit suites for every pure core module.
- `node scripts/drive-game.mjs <url> <shotDir>` — behavioral smoke against a
  running build (movement, ground band, saves, travel), with screenshots.
- `node scripts/bench-game.mjs <url> <out.json> [baseline.json]` — boot,
  per-scene entry cost and idle frame health; the checked-in baseline lives
  at `docs/bench-baseline.json`. Both drive the production build: append
  `?drive=1` to expose the `window.__game` handle outside dev.

Budgets the engine currently meets (headless Chrome, production build):
first paint < 500 ms, longest boot task ~115 ms, scene entry 50–150 ms
including first-visit chunk load, 60 fps at p95 ≤ 17 ms in the heaviest
scenes, stable heap across long travel/dialogue stress.

The full architecture audit, scorecard, phase history and risk register live
in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
