# Scene Engine

A small, opinionated engine for cozy side-scrolling pixel games: walk, look,
poke at things, talk to people, travel between scenes. Built from the lessons
of this project's first two attempts — the proven feel of the original
apartment game, generalized so any scene, any story, any game can run on it.

**Status:** core runtime, dialogue, audio, save, inventory — working and
verified (`/engine` route runs the full apartment on it). Scene-graphics
tooling — partially done, roadmap below.

---

## 1. Design principles (learned the hard way)

1. **Fixed logical resolution.** Every scene is 180 logical px tall, floor
   line at y = 150, width free. The viewport scales by an *integer* factor
   (2–6, `floor(viewportHeight / 180)`). This is why the player always has
   the right proportions and pixels stay crisp. Scenes with arbitrary sizes
   were the root cause of the "character isn't where it should be" failure.

2. **One rAF loop, zero React churn.** The loop owns input → movement →
   action animation → proximity → camera, and writes transforms straight to
   DOM refs. React state changes only on rare events (scene switch, toast,
   overlay, near-object change). This is why the original felt smooth and
   the first World System didn't.

3. **Proximity, not hitboxes.** Interaction is "stand near + press E / tap
   center", with a visible `▸ OBJECT [E]` prompt. Clickable invisible
   rectangles are unclear and break on touch.

4. **Data describes, handlers act, scenes draw.** Objects are data
   (`{id, kind, x, range}`); verbs are handler functions keyed by `kind`;
   artwork is hand-crafted SVG per scene. The engine never guesses at
   graphics — generated "object boxes" were the second root failure.

5. **The engine is game-agnostic.** It knows nothing about kettles or
   Żabka. Games plug in scenes, sprites, handlers, HUD, overlays, i18n.

---

## 2. Architecture (clean layers)

```
src/engine/
├── core/            pure domain — no React, no DOM
│   ├── constants.ts   SCENE_HEIGHT=180, FLOOR_Y=150, fade timings…
│   ├── types.ts       SceneDef, SceneObject, GameConfig, InteractionCtx…
│   └── math.ts        viewportScale, cameraTransform, nearestObject
├── systems/         pure game systems — testable without a browser
│   ├── dialogue.ts    branching trees, choices, effects
│   ├── inventory.ts   items, qty, money helpers
│   └── save.ts        versioned localStorage snapshots
├── scene/           scene-authoring toolkit
│   ├── layers.tsx     LayeredScene — the 8-layer depth structure
│   └── artkit.tsx     px(), PhaseSky, floorBand, stripes, DoorwayArt
├── audio/           services
│   └── lofi.ts        procedural lofi player (WebAudio, no asset files)
├── ui/              presentational React components
│   ├── PixelSprite.tsx  crisp run-length sprite renderer
│   ├── DialogueBox.tsx  typewriter panel with choices
│   └── AudioHud.tsx     mini cassette-deck player
├── runtime/
│   └── GameRuntime.tsx  the loop, input, camera, travel, orchestration
└── index.ts         public API — games import only from "@/engine"
```

**Dependency rule:** `core ← systems/scene/audio ← ui ← runtime`. Nothing in
`core` imports React; nothing in the engine imports from the game.

---

## 3. The 8-layer scene structure

The engine's canonical depth model, first-class in `scene/layers.tsx`:

| # | Layer             | Purpose                              | Typical content                        | Where |
|---|-------------------|--------------------------------------|----------------------------------------|-------|
| 0 | Far background    | Establishes location and atmosphere  | Sky, distant buildings, trees          | `LayeredScene.farBackground` |
| 1 | Middle background | Gives depth                          | Houses, walls, hills, large vegetation | `LayeredScene.middleBackground` |
| 2 | Ground            | Defines where the player moves       | Roads, grass, pavement, floor tiles    | `LayeredScene.ground` |
| 3 | Static objects    | Makes the location believable        | Benches, lamps, signs, bins            | `LayeredScene.staticObjects` |
| 4 | Gameplay objects  | Objects with interaction/collision   | Doors, chests, vehicles                | `LayeredScene.gameplayObjects` |
| 5 | Characters        | Main readable actors                 | Player, NPCs                           | drawn by the runtime |
| 6 | Foreground        | Adds framing and depth               | Bushes, fences, parapets, roof edges   | `SceneDef.Foreground` |
| 7 | Effects           | Adds mood and feedback               | Rain, smoke, light, dust, hearts       | `SceneDef.Effects` |

Layers 0–4 are SVG groups composed back-to-front inside the scene's artwork.
Layer 5 is the runtime's player/NPC pass. Layer 6 is a self-positioned
overlay in front of characters. Layer 7 gets `{world, phase, fx, scale,
actionUi}` and renders DOM/motion effects (steam, notes, hearts — all ported).

```tsx
function StreetScene({ world, phase }: SceneRenderProps<W>) {
  return (
    <LayeredScene
      farBackground={<PhaseSky id="street-sky" phase={phase} width={640} />}
      middleBackground={<PanelBuilding x={40} />}
      ground={floorBand(640, "#8d8478", "#6f675c")}
      staticObjects={<><Bench x={150} /><Lamp x={300} /></>}
      gameplayObjects={<DoorwayArt x={520} />}
    />
  );
}
```

---

## 4. What exists today

### Runtime (`GameRuntime`)
- integer-scale viewport, camera follow with clamping
- keyboard (layout-independent, `event.code`) + touch (edge-hold / tap-center / on-screen buttons)
- walk/idle/blink/stretch/look-back/lean animation program
- action animations with interruption + auto-cancelled queued toasts
- proximity prompt, toasts, scene-travel fade, blackout moments
- day-phase darkness overlay per scene
- overlays (game-supplied panels/terminal/menu), intro splash
- ephemeral FX bus (`spawnFx`) for hearts and similar
- autosave/restore (`persist: {key, version}`)

### Dialogue (`systems/dialogue` + `DialogueBox`)
- branching nodes, sequential lines, speaker tags
- choices with effects that receive the full `InteractionCtx`
  (a choice can give items, set flags, start actions, travel)
- typewriter rendering, keyboard (E advance, ↑/↓ select) and touch
- pauses the world while open

### Audio (`audio/lofi` + `AudioHud`)
- fully procedural lofi: warm detuned-triangle pads through a lowpass,
  soft sine bass, vinyl crackle bed, felt kick + paper rim (swung)
- 4 built-in tracks (KITCHEN RADIO, RAINY BALCONY, NIGHT TRAM, WARM MILK)
- ~2.5 s equal-gain crossfades between tracks; no hard cuts anywhere
- HUD deck: play/pause, next, 5-bar volume; persists to localStorage
- unlocked on the first user gesture (intro keypress/tap)

### Inventory & save
- pure helpers (`addItem`, `removeItem`, `hasItem`, `spend`)
- versioned save slots; bumping the version invalidates stale saves

### Proof
- `/engine` runs the original six-room apartment (art, verbs, feel — 1:1)
  assembled in `src/game/apartment/` (~3 small files: scenes, handlers, config).
- `/engine?nointro` (dev) skips the splash for fast testing.

---

## 5. Roadmap

### Phase A — scene-graphics completion *(next)*
- [ ] **Parallax.** Per-layer scroll factors (far 0.3, middle 0.6, ground 1.0).
      Runtime publishes camera X as a CSS variable on the scene container;
      `LayeredScene` applies `translateX(calc(var(--cam-x) * factor))` per layer.
- [ ] **Art kit growth.** Post-Soviet prop library as composable functions:
      panel-building facades, benches, kiosks, lamp posts, mailboxes,
      elevator doors, shop shelving, counters. Each ≤ 40 lines of `px()` runs.
- [ ] **Palette module.** The shared muted-cinematic palette (warm wood,
      enamel, brass…) exported from the engine so scenes stay consistent.
- [ ] **Weather effects.** Engine-level `Rain`, `Snow`, `Dust` components for
      layer 7, phase-aware.

### Phase B — inhabitants
- [ ] **NPC system.** `SceneDef.npcs`: sprite, x, facing, idle/wander
      behavior; rendered in the character pass; exposed as proximity objects
      (kind `npc`) so handlers open dialogues.
- [ ] **Schedules.** NPC presence by day phase (the babushka is outside only
      in the morning).

### Phase C — world texture
- [ ] **Sound effects.** Small WebAudio synth cues (door creak, switch click,
      kettle) triggered from handlers via `ctx.playSfx(name)`.
- [ ] **Scene transition variants.** `slide` (street → street) alongside `fade`.
- [ ] **Conditional exits.** Doors that need an item/flag (`hasItem(world, "key")`).
- [ ] **Cutscene primitives.** Scripted walk-to-x / face / wait / say steps.

### Phase D — content on the engine (this project)
- [ ] Building corridor (під'їзд): mailboxes, notice board, neighbor's door,
      elevator, stairs — hallway's front door becomes a real exit.
- [ ] Elevator interior: button panel (1 → outside, 4 → corridor), mirror, graffiti.
- [ ] Outside the building: panel facade, bench, Zhiguli, path right to Żabka.
- [ ] Żabka: shelves, drink fridges, hot-dog counter, cashier **dialogue**
      (buy cigarettes — money + inventory + choices, the full system demo).
- [ ] Migrate `/` to the engine build once it's at parity, retire the legacy component.

### Phase E — tooling (later)
- [ ] Dev overlay: object ranges, floor line, camera bounds visualized.
- [ ] Scene screenshot harness for visual regression.
- [ ] Optional in-browser scene inspector (click an object → jump to its def).

---

## 6. Quality bar (what "done" means for a scene)

- Reads at a glance: silhouettes and big color masses first, detail second.
- All five artwork layers present; no floating objects — everything sits on
  the ground line or hangs from something.
- Every interactable has artwork at its `x`, a sensible `range`, an i18n
  label (`obj.*`) and a flavor/verb (`flavor.*` / handler).
- Lighting matches the phase-of-day system; interiors respond to their lamp.
- Walk the whole width: camera never shows past the edges; prompts never
  overlap the toast area; touch controls reachable.
