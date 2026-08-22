# Engine Architecture Audit & Modernization Roadmap

_Date: 2026-08-22 · Baseline commit: 0050bb0 · Auditor: engine modernization program (docs/ENGINE.txt)_

This is the deliverable required by ENGINE.txt §32 before major implementation:
current map, scorecard, findings, target architecture, migration plan, risk register.
It also folds in the one new **functional** requirement given alongside the program:

> The ground layer must stop being a single line. The player needs a walkable
> band with up/down movement (River City / Ringo-style depth).

---

## A. Current Architecture Map

```
src/engine/                     16 617 lines total
├── core/          (pure, no React/DOM — unit-testable by design)
│   ├── constants.ts   SCENE_HEIGHT=180, FLOOR_Y=150, speeds, targeting weights
│   ├── types.ts       game-agnostic contracts: SceneDef, SceneObject, PlayerConfig,
│   │                  ActionDef, InteractionCtx, GameConfig  (W = opaque world)
│   ├── runtime-types.ts  ADDITIVE extension surface: RuntimeSceneDef, ActorDef,
│   │                  SeqStep, RuntimeCtx, RuntimeApi, RuntimeConfig, SavePayload
│   ├── math.ts        viewportScale, cameraTransform, detectObjects (scored,
│   │                  facing-bent, priority-weighted targeting)
│   ├── runtime-perf.ts   Timers, GameClock (pausable), FxPool, QualityGovernor,
│   │                  BandStore, AtlasSprite (canvas rasterizer), keymap, gamepad
│   ├── runtime-cull.tsx  CullBox / CullStrip / useIsVisible over the band store
│   └── prefs.ts       persisted engine prefs (quality pin, motion, text speed)
├── systems/       (pure logic)
│   ├── dialogue.ts    branching trees: when/locked/once choices, moods, acts
│   ├── save.ts        versioned localStorage snapshot (version mismatch = discard)
│   └── inventory.ts   minimal
├── sprite/        character-map rig builders (npcBuilder, animalBuilder,
│                  characterBuilder, faces/hair/palette) — lazy registries
├── scene/         pixelKit (canonical art kit: materials, bevels, dither,
│                  LIGHT v2 tiers, 3×5 font), pixelLight presets, props, layers
├── audio/         procedural lofi, ambience, sfx, mumble voices
├── ui/            NpcActor, AnimalActor, DialogueBox, SpeechPanel, PixelFrame,
│                  PixelSprite, InteractPrompt, animation gate, speaking context
└── runtime/
    └── GameRuntime.tsx   2 738 lines — THE component: loop, input, camera,
                       sim, targeting, sequencer, idle brain, actions, actors,
                       fx, save, touch UI, dialogue wiring, debug HUD, render
```

**Runtime lifecycle** (all inside GameRuntime):
mount → restore save → single rAF loop (fixed-step sim @120 Hz, bounded
accumulator) → per-frame: pacing/parking → action player → gamepad poll →
sequencer → simulation (x movement only) → targeting (fingerprint-cached) →
camera rig (eased follow, look-ahead, bob, shake, zoom, DPR-snapped writes) →
DOM writes through domCache (skip-if-equal) → player frame selection
(forced > action > walk > idle-brain) → atlas blit or 2-node display flip →
actors (patrol/step, cull by band) → fx sweep → pausable clock → debug sample.

**React boundary** (healthy, measured): React state only for rare events
(scene, world, dialogue, overlay, toast, targets, fade, fx snapshots). All
per-frame values go straight to DOM via refs. ~0 renders/sec standing,
1.2–3.5/sec walking. `loopBag`/`inputBag` refresh callbacks without
re-subscribing; loop mounts once.

**Game side** (`src/game/`): 13 scenes (4 apartment + 9 outside) as
`RuntimeSceneDef<WorldState>` files; handlers table by `kind`; EngineGame.tsx
adapts menu/HUD/overlays; NPCs live either as inline `<NpcActor>` SVG figures
inside scene art (animated by per-NPC `setInterval` + React state, gated by
visibility) or as runtime `ActorDef`s stepped in the loop.

**Confirmed strengths to preserve** (ENGINE.txt §30 — verified in code):
refs-over-state; artKey gating; paletteKey pinning; DOM write skipping; SMIL
pause behind overlays; fixed-step sim; camera DPR quantization; parallax
without CSS custom properties; FxPool; owned Timers + pausable GameClock;
lazy sprite frames + idle prewarm; atlas mode; actor frame-subset mounting
(the district fix); park-when-hidden; buffered interact; enter/exit/abort
action bridging; scored sticky targeting; dialogue when/locked/once semantics.

---

## B. Architecture Scorecard (0–10)

| Dimension | Score | Why |
|---|---|---|
| Modularity | 6 | core/systems/ui layering is real and enforced (core has no React). But `runtime/` is one 2 738-line component holding ~10 systems that only communicate through closure scope. |
| Extensibility | 5 | Adding one movement axis touches ~15 sites inside GameRuntime. `InputAction` is a closed union; sequencer steps are a closed union; both require engine edits to extend. Handlers-by-kind and RuntimeSceneExtras are good extension seams. |
| Reusability | 7 | The engine genuinely knows nothing about the game (checked: no game imports). SpriteMap/palette contracts are portable. The 1D ground contract is the biggest genre limiter. |
| Performance | 8 | The best-engineered dimension; every optimization is annotated with the measurement that motivated it. Remaining known costs: per-NPC `setInterval`+setState animation for inline NpcActors, full scene-art re-render on artKey change (no partial invalidation), monologue anchored to one player only. |
| Testability | 3 | 11 tests, none touch the engine. Movement, targeting-in-context, sequencer, action player, idle brain, camera rig and save restore are all untestable without mounting the god component in jsdom. The pure-core discipline exists but the logic that matters most lives in the component. |
| Maintainability | 6 | Comment quality is exceptional (each hack carries its measurement). But GameRuntime's systems share ~40 refs; changing one path requires whole-file comprehension. |
| API quality | 6 | Single barrel, additive runtime-types (a plain GameConfig still works — genuinely good). But the barrel exports internals (TEXT_MS, bevel paths) alongside the public surface; no public/internal split. |
| Separation of concerns | 5 | Sim/render/UI separation inside the loop is by convention, not structure. Touch buttons, debug HUD and travel fade are hardcoded into the runtime's render. |
| Resource management | 7 | Timers/clock/pool ownership is clean and disposed. Sprite rigs cached + lazy. No leak findings (stress-verified per ENGINE.txt §2). |
| Developer experience | 7 | Studios (lazy), debug HUD with live frame provenance, `window.__game`-style RuntimeApi. Missing: perf regression harness, engine docs. |
| Public-release readiness | 3 | No package boundary, no docs/examples, engine + game in one src tree, legacy duplicates still present (components/game/ApartmentGame, lib/apartment). |

---

## C. Critical Findings

**P0 — none.** The runtime is healthy: no leaks, stable renders, measured
frame discipline. Nothing demands an emergency fix.

**P1**
1. **The 1D ground contract** (constants.ts FLOOR_Y; pos={x,facing}; camera,
   targeting, walkTo, save, actors, touch — all x-only). Blocks the requested
   feature and most genre reuse. This is the program's first structural change.
2. **GameRuntime is a god component.** Movement, action playback, idle brain,
   sequencer, camera rig and targeting cache are pure state machines trapped
   in a component. They cannot be tested, reused, or evolved independently.
   Root cause: the second-pass optimizations were (correctly) built ref-first,
   but the refs were never grouped into owned modules.
3. **Zero engine tests.** Every future phase needs a regression net first.

**P2**
4. Inline `<NpcActor>` animation runs on per-NPC `setInterval` + React state —
   the last per-frame React path. Correctly gated (visibility, animation gate,
   reduced motion) but still N timers and N setState/beat in NPC-heavy scenes.
   Direction: one shared ticker (or the loop) advancing frame indices.
5. Closed `InputAction`/keymap: target-cycling squats on ArrowUp/Down + W/S,
   exactly the keys vertical movement needs. Needs a deliberate rebind.
6. `SavePayload` grows fields ad hoc (flags/counters/sceneX bolted on);
   migrate() exists but there is no schema description or versioned test.
7. Legacy duplicates: components/game/ApartmentGame.tsx + lib/apartment.ts
   (old engine) still ship; `/world` demo route; two webfonts declared and
   unused (~157 KB dist dead weight, per prior audit).

**P3**
8. Barrel exports internals; no public/internal entry split.
9. `.probe.mjs` (tracked dev tool) floods `npm run lint` with 400+ diagnostics
   — the lint gate is currently meaningless. Exclude it in biome.
10. Sequencer `SeqStep` closed union — fine for now, revisit when games need
    custom steps (escape hatch `{do}` already exists).

---

## D. Target Architecture

Keep the shape that works: **one loop, refs-first, React for rare events.**
Change the internal organization, not the philosophy:

```
engine/core (pure, tested)
  movement.ts    ground band + blockers + auto-walk stepping   ← NEW (D1)
  targeting.ts   detectObjects + stickiness + cache            ← extracted
  cameraRig.ts   the eased rig as a pure class                 ← extracted
  actionPlayer.ts enter/loop/exit/abort frame selection        ← extracted
  idleBrain.ts   breath/blink/flourish state machine           ← extracted
  sequencer.ts   SeqStep runner as a pure class                ← extracted
engine/runtime
  GameRuntime.tsx orchestrates the above + owns DOM writes/React (goal ≤1200 lines)
engine/react (later phase)
  the presentational shell (touch controls, fades, debug HUD) as components
```

### D1. Ground band design (the new feature)

**Model.** A scene may declare a walkable band in feet-space:

```ts
type GroundBand = {
  top: number;      // farthest walkable feet line (smallest y), e.g. 150
  bottom: number;   // nearest walkable feet line (largest y),  e.g. 168
  blockers?: readonly { x0: number; y0: number; x1: number; y1: number }[];
};
// RuntimeSceneDef gains: ground?: GroundBand
```

No `ground` ⇒ degenerate band `{top: FLOOR_Y, bottom: FLOOR_Y}` — every
existing scene behaves **bit-identically**. SCENE_HEIGHT stays 180; the band
lives in the 150–178 strip scenes already paint as floor.

**Decisions** (made here, flagged for review):
- Player state becomes `{x, y, facing}`; `y` = feet line. Facing stays
  left/right only (side-view rig); pure vertical movement keeps facing and
  plays the same walk cycle — the beat-em-up convention.
- Vertical speed = `walkSpeedY ?? 0.62 × walkSpeed` (foreshortening feel).
  Diagonals apply both axes independently (classic, not normalized).
- Collision v1: feet-point vs band edges + axis-separated AABB blockers
  (move x, test, move y, test ⇒ natural wall sliding). No physics engine.
- **Input**: `up`/`down` become first-class InputActions on ArrowUp/W and
  ArrowDown/S. Target cycling moves to **Q / Z** (it was on the arrows).
  In dialogue, up/down keep moving the choice cursor. Gamepad: left-stick
  Y + dpad 12/13.
- **Depth sort**: in band scenes, player and runtime actors get
  `zIndex = 20 + round(feetY)`; the Foreground contract ("always in front")
  moves to z=300, monologue/markers above that. Non-band scenes keep legacy
  stacking untouched. Inline-art NpcActors cannot depth-sort (they live
  inside the scene SVG) — band scenes must place sortable characters as
  runtime actors, or behind counters/blockers the player can't cross.
- Objects gain optional `y` (default FLOOR_Y), `approachY`, `yRange`
  (depth tolerance, default 20). Targeting score adds `|dy|`; the dx gate is
  unchanged, so degenerate scenes score identically.
- `walkTo(x, y?)`, sequence `{walkTo, y?}`, doors `to.spawnY?`,
  `travel(scene, spawnX?, spawnY?)`, save gains `y` + per-scene remembered y.
  Old saves load with `y = FLOOR_Y` — no version bump.
- Touch: tap-to-walk sends `(x, y)` in band scenes; edge-hold stays x-only.
- Auto-walk gains stall detection (no progress ~600 ms ⇒ resolve false) so a
  blocker can't hang a cutscene until the 8 s deadline.

## E. Migration Plan

```
Phase 0 — Baseline & gates           ✅ DONE 2026-08-22 (.probe excluded from
                                     biome; lint/typecheck/test/build all green)
Phase 1 — Ground band, engine core   ✅ DONE 2026-08-22 (core/ground.ts, y in
                                     types/save/input/targeting; 16 new tests)
Phase 2 — Ground band, runtime       ✅ DONE 2026-08-22 (full GameRuntime wiring;
                                     corridor pilot ground:{150,170}; verified by
                                     scripts/drive-game.mjs — 7/7 checks, shots)
Phase 3 — Extraction                 ✅ DONE 2026-08-22: actionPlayer, idleBrain,
                                     cameraRig, sequencer (SeqHost interface,
                                     cancel-inside-{do} fixed), resolveActiveTarget
                                     — all pure core modules with unit suites;
                                     GameRuntime 2 738 → 2 689 lines of pure
                                     orchestration; live cutscene verified
Phase 4 — NPC animation unification  ✅ DONE 2026-08-22: ui/frameTicker.ts — one
                                     coalescing timeout for every inline
                                     NpcActor/AnimalActor (was N intervals, N
                                     commits/beat; now 1 + batched commits);
                                     street cast animation verified in shots
Phase 5 — Scene lifecycle & registry ✅ DONE 2026-08-22 (except the flagged
                                     proposal below): legacy engine deleted
                                     (ApartmentGame/rooms/StatusMenu/Panel +
                                     WALK_CYCLE + lib/apartment entirely —
                                     PanelId lives in Hud, room prop is the
                                     honest string), unused geist font dropped;
                                     scene lifecycle hooks landed — enter (on
                                     mount + every arrival), exit (at fade-out),
                                     preload (fired toward the destination
                                     behind the fade, never awaited); CI gained
                                     an engine-check job (lint/tc/test + drive
                                     harness vs the built bundle, bench JSON
                                     as artifact)

  ▶ FLAGGED FOR IVAN — scene code-splitting. The GameEntry chunk is now
    776 KB (233 KB gz); the scene art dominates it. The preload seam exists
    precisely so each scene's art can move to a lazy module warmed behind
    the travel fade. But it means splitting art out of every scene file —
    files your editor owns — so it should ride your editing flow, not mine.
    Mechanics when ready: SceneDef.Component per heavy scene becomes a
    lazy component; def.preload = () => import("./xxxArt"); fallback null
    is covered by the 220 ms fade.
Phase 6 — Diagnostics & perf harness ✅ DONE 2026-08-22: scripts/bench-game.mjs
                                     (boot/scene-entry/idle-frames, JSON +
                                     delta vs baseline; drives PROD via ?drive=1).
                                     Prod baseline docs/bench-baseline.json:
                                     first paint 704ms, longest boot task 211ms,
                                     scene entry 86–243ms, idle p95 33ms,
                                     heap 18–24MB (headless, relative numbers).
                                     REMAINING: CI thresholds
Phase 7 — Public API & packaging     public entry split, docs, minimal example
                                     game, packaging decision (single pkg first)
```

Each phase keeps the repo green (typecheck + tests + build) and is
independently shippable. Phases 1–2 are this session's work.

## F. Risk Register (phases 1–2)

| Risk | Affected | Mitigation / rollback |
|---|---|---|
| Key rebind surprises (W/S no longer cycle targets) | all scenes | Q/Z documented; dialogue arrows unchanged; config.keymap can restore old map per game |
| z-order regressions (Foreground 15→300, monologue/markers raised) | every scene | values chosen above any band z (≤200); verify with screenshot sweep; single-commit revert |
| Save shape gains y/sceneY | persistence | fields optional; absent ⇒ FLOOR_Y; no version bump; migrate() untouched |
| Band pilot exposes art assumptions (props painted at the floor line) | pilot scene only | pilot behind its own `ground` field; removing the field restores 1D exactly |
| detectObjects signature gains y | engine callers | appended optional param, defaulted; only GameRuntime calls it |
| Sim change breaks feel (speed, walk cycle) | player | dy contributes to walkDist identically; x speed untouched; fixed-step preserved |

---

_Report ends. Implementation begins with Phase 0._
