import type { ReactNode } from "react";
import type {
  AnyWorld,
  GameConfig,
  InteractionCtx,
  SceneObject,
  SpriteMap,
  SpritePalette,
} from "./types";

/**
 * runtime-types.ts — the *additive* type surface for GameRuntime.
 *
 * Nothing in `core/types.ts` changes. Everything here either
 *  - infers from the existing types (SceneDefOf, SceneKeyOf), or
 *  - intersects optional fields onto them (RuntimeSceneDef, RuntimeObject),
 * so an untouched `GameConfig<W>` is still a valid `RuntimeConfig<W>`.
 */

/* ------------------------------------------------------------------ basics */

export type QualityTier = "high" | "medium" | "low";

/** The scene-definition shape of a world, read back out of the existing config. */
export type SceneDefOf<W extends AnyWorld> =
  GameConfig<W>["scenes"] extends Record<string, infer S>
    ? S
    : GameConfig<W>["scenes"][keyof GameConfig<W>["scenes"]];

export type SceneKeyOf<W extends AnyWorld> = keyof GameConfig<W>["scenes"] & string;

export type InputAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "run"
  | "interact"
  | "cancel"
  | "menu"
  | "targetNext"
  | "targetPrev"
  | "debug";

/* ---------------------------------------------------------------- ground */

/** An unwalkable rectangle in feet-space (a bench, a parked car, a planter). */
export type GroundBlocker = { x0: number; y0: number; x1: number; y1: number };

/**
 * A named patch of ground — what it is made of and how it walks. `kind` is
 * the game's vocabulary ("puddle", "sand", "crowd"); read it back with
 * `surfaceAt` for footstep sfx and effects. `speed` multiplies walk speed
 * while inside (0.6 = wading). First matching zone wins, so declare the
 * specific patch before the broad one. y-bounds default to the whole band.
 */
export type GroundZone = {
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
  kind: string;
  speed?: number;
};

/**
 * A control point bending the band's edges along x. Points define `top`,
 * `bottom` or both; each edge interpolates linearly across the points that
 * mention it and holds the band constant elsewhere — steps down to a cellar
 * door, a ramp, a platform tapering toward its nose.
 */
export type GroundProfilePoint = { x: number; top?: number; bottom?: number };

/**
 * The walkable depth band. `top` is the far feet line (small y), `bottom` the
 * near one (large y). Scenes without one get the degenerate {FLOOR_Y, FLOOR_Y}
 * band and behave exactly as before — a single line.
 */
export type GroundBand = {
  top: number;
  bottom: number;
  blockers?: readonly GroundBlocker[];
  /** Bends the edges along x — see GroundProfilePoint. */
  profile?: readonly GroundProfilePoint[];
  /** Named surface patches — see GroundZone. */
  zones?: readonly GroundZone[];
};

/* ------------------------------------------------------- objects & scenes */

/** Optional per-object metadata. Objects without any of it behave exactly as before. */
export type RuntimeObjectExtras = {
  /** Logical width, used for pointer hit-testing and marker centring. */
  width: number;
  /** Extra slack (logical px) around the hit box for touch. */
  hitPad: number;
  /** Where the player should stand to use this. Defaults to the object's own x. */
  approachX: number;
  /** Feet line to stand on while using this (ground-band scenes). */
  approachY: number;
  /** Consumed after one successful interaction — stops being a candidate. */
  once: boolean;
  /** Ignore repeat interactions for this long. */
  cooldownMs: number;
  /** Opt out of tap-to-walk for this object. */
  autoWalk: boolean;
  /** Announced to screen readers when focused. */
  ariaLabel: string;
};

export type RuntimeObject = SceneObject & Partial<RuntimeObjectExtras>;

/** A cheap scripted background character. Rendered and stepped by the runtime. */
export type ActorDef<W extends AnyWorld> = {
  id: string;
  width: number;
  height: number;
  cell: number;
  frames: Record<string, SpriteMap>;
  palette: SpritePalette;
  /** Frames cycled while walking, by distance travelled. */
  walkCycle?: string[];
  /** Frame shown while standing. Defaults to "stand" if present. */
  idleFrame?: string;
  x: number;
  /** Baseline override; defaults to the scene floor. */
  y?: number;
  facing?: 1 | -1;
  /** Simple back-and-forth patrol. */
  patrol?: { from: number; to: number; speed?: number; pauseMs?: number };
  /** Full manual control; return a partial pose. Called at most once per frame. */
  step?: (
    t: number,
    world: W,
  ) => { x?: number; y?: number; facing?: 1 | -1; frame?: string } | undefined;
  /** Hidden entirely (and skipped) when this returns false. */
  visible?: (world: W) => boolean;
  /** Stacking order relative to the player (player sits at 10). */
  z?: number;
};

/** What a scene lifecycle hook gets to see and touch. */
export type SceneLifecycleCtx<W extends AnyWorld> = {
  world: W;
  updateWorld: (patch: Partial<W> | ((w: W) => W)) => void;
  /** The scene this hook belongs to. */
  scene: string;
  /** The scene on the other side of the travel (undefined on first mount). */
  counterpart?: string;
};

export type RuntimeSceneExtras<W extends AnyWorld> = {
  /**
   * Called on arrival — after the scene is on screen, on first mount and on
   * every travel here. The place to start scene-owned state or timers.
   */
  enter: (ctx: SceneLifecycleCtx<W>) => void;
  /** Called as the player leaves, at fade-out start. Release what enter took. */
  exit: (ctx: SceneLifecycleCtx<W>) => void;
  /**
   * Fired toward the DESTINATION scene the moment a travel starts, while the
   * fade still covers the screen — the seam for warming lazy chunks or assets.
   * Fire-and-forget: the travel never waits on it.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: void is deliberate — a plain `() => { warm(); }` must satisfy this without an explicit return
  preload: () => void | Promise<unknown>;
  /**
   * Cheap fingerprint of everything the scene artwork actually reads.
   * Without it, any world write repaints hundreds of rects; with it, the art
   * only re-renders when its own inputs change. The single biggest win here.
   */
  artKey: (world: W, phase: string) => string;
  /**
   * The runtime reads RuntimeObjectExtras (width, hitPad, approachX/Y, once,
   * cooldownMs…) off scene objects and always has — this override just lets a
   * RuntimeSceneDef literal *say so* without a cast. A plain SceneObject[] is
   * still valid: every extra is optional.
   */
  objects: RuntimeObject[];
  /** Background characters. */
  actors: ActorDef<W>[];
  /** Screen-reader description of the room. */
  describe: string | ((world: W) => string);
  /** Default spawn when travelling here without an explicit x. */
  spawnX: number;
  /** Culling granularity for <CullBox> children (logical px). */
  chunkWidth: number;
  /** Walkable depth band; omit for the classic single floor line. */
  ground: GroundBand;
};

export type RuntimeSceneDef<W extends AnyWorld> = SceneDefOf<W> & Partial<RuntimeSceneExtras<W>>;

/**
 * A scene entry in the runtime's registry: the def itself, or a loader for
 * it. A loader makes the scene its own code-split chunk — the runtime kicks
 * it the moment a travel starts toward it and holds the travel fade until it
 * lands, so a first visit costs a beat of black and every later visit is
 * free. Loaders are resolved once and cached for the session.
 */
export type SceneSource<W extends AnyWorld> =
  | RuntimeSceneDef<W>
  | (() => Promise<RuntimeSceneDef<W>>);

/* ------------------------------------------------------------- sequencing */

/** One beat of a cutscene. Steps run in order; each blocks until it resolves. */
export type SeqStep<W extends AnyWorld> =
  | { wait: number }
  | { say: string }
  | {
      walkTo: number;
      y?: number;
      timeoutMs?: number;
      /** walk speed as a fraction of normal — 0.5 is an unhurried morning */
      speed?: number;
    }
  | { face: 1 | -1 }
  | { hold: string; forMs: number }
  | {
      action: string;
      /**
       * Start the action again each time it ends, for as long as this holds —
       * a predicate, or `"narration"` for "while the queued lines are still
       * being read" (see `narrate`). A cigarette that lasts exactly as long as
       * the speech over it, on the game clock.
       */
      repeat?: (() => boolean) | "narration";
    }
  /**
   * Say several lines one after another *without blocking*: each waits for the
   * one before to have been read (the player's text speed), all on the game
   * clock. Pair with a blocking beat (a walk, an action) and `awaitNarration`.
   */
  | { narrate: readonly string[]; gapMs?: number }
  /** Block until the last `narrate` line has had its time on screen. */
  | { awaitNarration: true }
  | { world: Partial<W> | ((w: W) => W) }
  | { fx: { kind: string; x?: number; ttlMs?: number; data?: unknown } }
  | { shake: number; ms?: number }
  | { flash: { color?: string; ms?: number } }
  | { focus: number | null; ms?: number }
  | { letterbox: boolean }
  | { travel: { scene: string; spawnX?: number; spawnY?: number } }
  | { dialogue: unknown }
  | { sound: string }
  | { do: (ctx: RuntimeCtx<W>) => void }
  | { until: () => boolean; timeoutMs?: number };

/* -------------------------------------------------------- interaction ctx */

/** Everything the runtime adds on top of the original InteractionCtx. */
export type RuntimeCtxExtras<W extends AnyWorld> = {
  /** Walk the player to a logical x (and feet-y in ground-band scenes). Resolves true on arrival, false if cancelled. */
  walkTo(x: number, opts?: { y?: number; timeoutMs?: number }): Promise<boolean>;
  /** Pin the camera to a point (or null to follow the player again). */
  focusCamera(x: number | null, ms?: number): void;
  /** Eased zoom multiplier around the current focus. 1 = normal. */
  zoom(mult: number, ms?: number): void;
  flash(color?: string, ms?: number): void;
  letterbox(on: boolean): void;
  /** Ignore player input without pausing the simulation. */
  lockInput(on: boolean): void;
  runSequence(
    steps: SeqStep<W>[],
    opts?: { cinematic?: boolean; skippable?: boolean },
  ): Promise<boolean>;
  cancelSequence(): void;
  /** setTimeout on the *game* clock: pauses with the game, dies with the runtime. */
  after(ms: number, fn: () => void): number;
  cancelAfter(id: number): void;
  /** Runtime-owned, persisted flag store — no need to widen your world type. */
  flag(key: string): boolean;
  setFlag(key: string, on?: boolean): void;
  counter(key: string): number;
  bump(key: string, by?: number): number;
  /** True exactly once per key, ever (persisted). */
  once(key: string): boolean;
  saveNow(): void;
  playSound(name: string, opts?: { volume?: number; rate?: number }): void;
  quality(): QualityTier;
  reducedMotion(): boolean;
  /** Force a player frame until cleared with null. */
  setPlayerFrame(frame: string | null): void;
  /** Game-clock milliseconds. */
  now(): number;
  playerAt(): { x: number; y: number; facing: 1 | -1 };
  setTarget(id: string): void;
  vibrate(ms: number): void;
};

export type RuntimeCtx<W extends AnyWorld> = InteractionCtx<W> & RuntimeCtxExtras<W>;

/* ------------------------------------------------------------------ stats */

export type RuntimeStats = {
  fps: number;
  frameMs: number;
  emaMs: number;
  simSteps: number;
  quality: QualityTier;
  fxAlive: number;
  candidates: number;
  band: { x0: number; x1: number };
  domWrites: number;
  domSkips: number;
  commits: number;
  alarms: number;
  timers: number;
  heapMb: number | null;
  spriteMode: "dom" | "canvas";
  mountedFrames: number;
  /**
   * What the character is doing this instant. Sampled in the loop into a ref
   * rather than into React state: a developer overlay that re-rendered the
   * tree every time the frame changed would measure its own overhead rather
   * than the game's.
   */
  live: LiveState;
};

/** The animation state of the player, as of the last simulated frame. */
export type LiveState = {
  /** the body frame the animator chose (never a derived twin) */
  frame: string;
  /** the frame actually drawn — the body frame or its eyes-closed twin */
  drawn: string;
  /** feet-y in the ground band (FLOOR_Y in single-line scenes) */
  y: number;
  /** the ground zone underfoot (null between zones / zone-less scenes) */
  surface: string | null;
  /** the object currently holding interaction focus */
  target: string | null;
  /** the frame shown on the tick before, so a transition is visible as a pair */
  prevFrame: string;
  /** the running action, if any */
  action: string | null;
  /** 0..1 through that action, or 0 when nothing is running */
  actionProgress: number;
  /** why the current frame was chosen */
  source: "forced" | "action" | "walk" | "talk" | "idle";
  moving: boolean;
  facing: 1 | -1;
  x: number;
  scene: string;
};

/* -------------------------------------------------------------------- api */

/** Imperative handle handed to `config.onReady`, for tests and debug tooling. */
export type RuntimeApi<W extends AnyWorld> = {
  interact(id?: string): void;
  travel(scene: string, spawnX?: number, spawnY?: number): void;
  walkTo(x: number, y?: number): Promise<boolean>;
  runSequence(
    steps: SeqStep<W>[],
    opts?: { cinematic?: boolean; skippable?: boolean },
  ): Promise<boolean>;
  getWorld(): W;
  updateWorld(patch: Partial<W> | ((w: W) => W)): void;
  getStats(): RuntimeStats;
  /**
   * The animation state right now, without the debug HUD having to be up.
   * `getStats` only fills in while debug sampling runs; this is always live
   * and costs a struct copy.
   */
  getLive(): LiveState;
  /**
   * Play an action by name, the way an interaction handler would. Developer
   * tooling needs this to exercise a pose without hunting for the object in
   * the world that happens to trigger it.
   */
  startAction(id: string): void;
  /** A look on his face — "smile" | "sad" | "tense" | "surprise" — for `ms`. */
  setMood(mood: string | null, ms?: number): void;
  /** A gait override — "drunk" — for `ms` (0 = until cleared with null). */
  setGait(id: string | null, ms?: number): void;
  /** A layer over the body — something in his hand — for `ms` (0 = until stopped). */
  startLayer(id: string, ms?: number): void;
  stopLayer(id?: string): void;
  /** Stop whatever action is running and hand control back to walk/idle. */
  stopAction(): void;
  /**
   * Pin one frame on screen, ignoring walk, idle and actions alike, so a pose
   * can be studied still. `null` releases it.
   */
  holdFrame(frame: string | null): void;
  saveNow(): void;
};

/* ----------------------------------------------------------------- config */

export type RuntimePersist<W extends AnyWorld> = NonNullable<GameConfig<W>["persist"]> &
  Partial<{
    /** Repair or upgrade a loaded save before it is applied. Return null to discard. */
    migrate: (saved: unknown, fromVersion: number) => unknown | null;
    /** Autosave debounce. Default 800ms. */
    autosaveMs: number;
  }>;

export type RuntimeConfigExtras<W extends AnyWorld> = {
  /** Fixed simulation rate. Default 120Hz — movement stops depending on frame rate. */
  simHz: number;
  /** Backlog guard: substeps per frame before time is dropped. Default 5. */
  maxSubsteps: number;
  /** Render cap; 0 = uncapped (still vsync-bound). Default 0. */
  maxFps: number;
  /** Rate while a dialogue/overlay/intro is up. Default 24. */
  pausedHz: number;
  /** Park the whole loop when the tab or viewport is hidden. Default true. */
  pauseWhenHidden: boolean;
  /** "canvas" collapses the player's hundreds of rects into one node. Default "auto". */
  spriteMode: "auto" | "dom" | "canvas";
  /** Cell count above which "auto" picks canvas. Default 2400. */
  spriteAtlasThreshold: number;
  /** Mount sprite frames on demand, prewarming the rest when idle. Default true. */
  lazySpriteFrames: boolean;
  /** Downgrade `quality` when frames get long. Default true. */
  adaptiveQuality: boolean;
  targetFps: number;
  onQualityChange: (tier: QualityTier) => void;
  reducedMotion: "auto" | boolean;
  keymap: Partial<Record<InputAction, string[]>>;
  gamepad: boolean;
  /** Tap an object in the world to target it. Default true. */
  pointerPicking: boolean;
  /** Picking an out-of-range object walks there, then interacts. Default true. */
  autoWalkToTargets: boolean;
  /** Interact presses during an action fire when it ends. Default 220ms. */
  inputBufferMs: number;
  fxCapacity: number;
  /** Restore your last x when re-entering a scene without an explicit spawn. */
  rememberSceneX: boolean;
  showAllMarkers: boolean;
  debug: boolean;
  renderDebug: (stats: RuntimeStats) => ReactNode;
  onSound: (name: string, opts?: { volume?: number; rate?: number }) => void;
  onReady: (api: RuntimeApi<W>) => void;
};

/** What GameRuntime accepts. A plain GameConfig<W> satisfies it unchanged. */
export type RuntimeConfig<W extends AnyWorld> = Omit<GameConfig<W>, "persist" | "scenes"> &
  Partial<RuntimeConfigExtras<W>> & {
    persist?: RuntimePersist<W>;
    /** Scene defs, or loaders for code-split scenes. A plain GameConfig fits. */
    scenes: Record<string, SceneSource<W>>;
  };

/* ------------------------------------------------------------------ saves */

export type SavePayload<W extends AnyWorld> = {
  version: number;
  world: W;
  scene: string;
  x: number;
  savedAt: string;
  /** Feet-y in the ground band. Absent in old saves — restored as FLOOR_Y. */
  y?: number;
  facing?: 1 | -1;
  flags?: Record<string, true>;
  counters?: Record<string, number>;
  sceneX?: Record<string, number>;
  sceneY?: Record<string, number>;
  /** Objects consumed by `once` — without this they resurrect on reload. */
  consumed?: string[];
};
