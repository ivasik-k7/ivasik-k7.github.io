import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blinkFrame } from "../character/compile";
import { type ActionRun, stepAction } from "../core/actionPlayer";
import { type CamRig, newCamRig, stepCamRig } from "../core/cameraRig";
import {
  DEFAULT_WALK_SPEED,
  EDGE_MARGIN,
  FLOOR_Y,
  SCENE_HEIGHT,
  TRAVEL_FADE_IN_DELAY_MS,
  TRAVEL_FADE_OUT_MS,
  TRAVEL_SWITCH_AT_MS,
  WALK_SPEED_Y_RATIO,
} from "../core/constants";
import { newFaceState, resetFace, stepFace } from "../core/faceBrain";
import { newGaitState, stepGait, walkSpan } from "../core/gait";
import {
  clampY,
  clampYAt,
  groundOf,
  hasDepth,
  planRoute,
  speedAt,
  stepOnGround,
  surfaceAt,
} from "../core/ground";
import { newIdleState, resetIdle, stepIdle } from "../core/idleBrain";
import { detectObjects, resolveActiveTarget, viewportScale } from "../core/math";
import { dwellMs } from "../core/monologue";
import { BandProvider } from "../core/runtime-cull";
import {
  AtlasSprite,
  buildKeymap,
  clamp,
  createBandStore,
  FxPool,
  GameClock,
  heapMb,
  idle,
  newPadState,
  nowMs,
  type PadState,
  pickObject,
  prefersReducedMotion,
  promote,
  QualityGovernor,
  rasterizeFrames,
  readPad,
  subscribeReducedMotion,
  Timers,
} from "../core/runtime-perf";
import type {
  ActorDef,
  InputAction,
  LiveState,
  RuntimeApi,
  RuntimeConfig,
  RuntimeCtx,
  RuntimeObject,
  RuntimeSceneDef,
  RuntimeStats,
  SavePayload,
  SeqStep,
} from "../core/runtime-types";
import { newSeqRun, type SeqHost, type SeqRun, stepSequence } from "../core/sequencer";
import { newTalkState, resetTalk, stepTalk } from "../core/talkBrain";
import type { AnyWorld, FxInstance, InteractionCtx, SceneObject } from "../core/types";
import {
  advanceDialogue,
  chooseDialogue,
  type DialogueState,
  type DialogueStep,
  type DialogueTree,
  dialogueAtChoices,
  offeredChoices,
  openDialogue,
} from "../systems/dialogue";
import { loadSlot, saveGame } from "../systems/save";
import { AnimationGateProvider } from "../ui/animationGate";
import { DialogueBox } from "../ui/DialogueBox";
import { InteractPrompt, TargetMarker } from "../ui/InteractPrompt";
import { PixelSprite } from "../ui/PixelSprite";
import { SpeakingProvider, type SpeakingState } from "../ui/speaking";

/**
 * GameRuntime — the engine's single component.
 *
 * Rendering philosophy, learned the hard way:
 *  - one requestAnimationFrame loop owns movement, camera, frames;
 *  - per-frame values are written straight to DOM refs (no React churn);
 *  - React state changes only on rare events: scene switch, overlay,
 *    toast, near-object change, fade.
 *
 * What the second pass added, and why:
 *  - fixed-step simulation (default 120Hz) with a bounded accumulator, so
 *    walking covers the same ground on a 30Hz laptop and a 165Hz monitor;
 *  - the loop *parks* when the tab or the viewport is hidden, and throttles to
 *    `pausedHz` behind dialogue and overlays, instead of burning a frame
 *    budget on a paused game;
 *  - `--vis-x0/--vis-x1` publish the visible slice of the world so scene art
 *    can unmount off-camera regions (see core/runtime-cull.tsx). This is the
 *    lever for "a lot of resources drawn": cost tracks screen, not scene;
 *  - `def.artKey` decouples scene-art re-renders from world identity. Without
 *    it, any world write repainted every rect in the room;
 *  - the player's frames can be baked into one atlas canvas, turning hundreds
 *    of live SVG rects into a single node and one drawImage per frame change;
 *  - fx are pooled, timers are owned, and `will-change` is granted only while
 *    something is actually moving, so idle GPU memory drops back;
 *  - every added capability is optional. An untouched GameConfig behaves
 *    exactly as it did, with the same keys, the same feel, the same handlers.
 */

const ARRIVE_EPS = 1.2;
const IDLE_PROMOTE_MS = 700;
const DETECT_SAFETY_MS = 400;
/** Auto-walk gives up once the gap stops shrinking for this long (blocked path). */
const WALK_STALL_MS = 600;

/* Stacking. Single-line scenes keep the legacy numbers (actors 5, player 10).
 * Ground-band scenes sort every figure by its feet line — z = BAND_BASE + y,
 * which tops out around 200 — and the fixed chrome sits above all of it. */
const Z_ACTOR_FLAT = 5;
const Z_PLAYER_FLAT = 10;
const Z_BAND_BASE = 20;
const Z_FOREGROUND = 300;

type ActorRuntime = {
  x: number;
  y: number;
  facing: 1 | -1;
  dist: number;
  dir: 1 | -1;
  pauseUntil: number;
  frame: string;
  hidden: boolean;
  z: number;
};

/**
 * The frames an actor can actually be asked to show.
 *
 * Every frame of every actor used to be mounted as a hidden `<g>`, on the
 * theory that toggling `display` is cheaper than mounting on demand. It is —
 * but the toggling only ever reaches the idle pose and the walk cycle, because
 * that is all `stepActors` selects from unless the actor brings its own
 * `step`. The rest was a whole sprite sheet of nodes that could never be
 * shown: one built dog put 7 605 hidden `<rect>`s into the district and took
 * scene entry from ~200 ms to about a second.
 *
 * An actor with a custom `step` can name any frame it likes, so that case
 * still mounts everything.
 */
function actorFrameNames<W extends AnyWorld>(actor: ActorDef<W>): string[] {
  if (actor.step) return Object.keys(actor.frames);
  const names = new Set<string>([actor.idleFrame ?? "stand", ...(actor.walkCycle ?? [])]);
  return [...names].filter((n) => actor.frames[n]);
}

/** A number from an untrusted save slot, or the fallback. */
const finiteOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * What renders while a code-split scene's chunk is still on the wire: a black
 * beat under the travel fade. Never simulated — the loop skips unresolved
 * scenes entirely.
 */
const PENDING_SCENE = Object.freeze({
  id: "__pending__",
  width: 320,
  objects: [] as SceneObject[],
  Component: () => null,
});

export function GameRuntime<W extends AnyWorld>({ config }: { config: RuntimeConfig<W> }) {
  const { scenes, player: basePlayer, handlers, objectLabel } = config;
  const persist = config.persist;

  // --- options (normalised once per render; renders are rare) -------------------
  const opts = {
    simHz: config.simHz ?? 120,
    maxSubsteps: config.maxSubsteps ?? 5,
    maxFps: config.maxFps ?? 0,
    pausedHz: config.pausedHz ?? 24,
    pauseWhenHidden: config.pauseWhenHidden ?? true,
    spriteMode: config.spriteMode ?? "auto",
    atlasThreshold: config.spriteAtlasThreshold ?? 2400,
    lazyFrames: config.lazySpriteFrames ?? true,
    adaptiveQuality: config.adaptiveQuality ?? true,
    targetFps: config.targetFps ?? 60,
    gamepad: config.gamepad ?? true,
    pointerPicking: config.pointerPicking ?? true,
    autoWalkToTargets: config.autoWalkToTargets ?? true,
    inputBufferMs: config.inputBufferMs ?? 220,
    fxCapacity: config.fxCapacity ?? 24,
    rememberSceneX: config.rememberSceneX ?? true,
    showAllMarkers: config.showAllMarkers ?? false,
    debug: config.debug ?? false,
    autosaveMs: persist?.autosaveMs ?? 800,
  };

  // --- persisted start ---------------------------------------------------------
  const [restored] = useState<SavePayload<W> | null>(() => {
    if (!persist) return null;
    // loadSlot hands old-version slots to migrate with their REAL version —
    // a bumped version upgrades players instead of wiping them
    return loadSlot<W>(persist.key, persist.version, persist.migrate) as SavePayload<W> | null;
  });

  // --- rare React state -------------------------------------------------------
  // truncated or hand-edited storage must not leak strings into the sim: a
  // slot that parses but carries the wrong shapes falls back field by field
  const [scene, setScene] = useState(
    typeof restored?.scene === "string" ? restored.scene : config.start.scene,
  );
  const [world, setWorld] = useState<W>(restored?.world ?? config.initialWorld);
  // the player this world dresses: same object back for the same look, so
  // everything keyed on `player.frames` (atlas, sprite sheet) stays put
  const player = useMemo(
    () => config.playerFor?.(world) ?? basePlayer,
    [config.playerFor, world, basePlayer],
  );
  const [dialogue, setDialogue] = useState<{ state: DialogueState; obj: SceneObject } | null>(null);
  const [overlay, setOverlay] = useState<unknown>(null);
  const [intro, setIntro] = useState(Boolean(config.renderIntro));
  const [fade, setFade] = useState<{ on: boolean; ms: number }>({ on: false, ms: 200 });
  const [targets, setTargets] = useState<{ list: SceneObject[]; activeId: string | null }>({
    list: [],
    activeId: null,
  });
  const [promptPulse, setPromptPulse] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [fx, setFx] = useState<FxInstance[]>([]);
  const [actionUi, setActionUi] = useState<string | null>(null);
  const [movingUi, setMovingUi] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0, scale: 3 });
  const [phase, setPhase] = useState(() => config.dayPhase?.() ?? "day");
  // added, all low-frequency
  const [reduced, setReduced] = useState(() =>
    config.reducedMotion === "auto" || config.reducedMotion === undefined
      ? prefersReducedMotion()
      : config.reducedMotion,
  );
  const [cinema, setCinema] = useState(false);
  const [flashFx, setFlashFx] = useState<{ id: number; color: string; ms: number } | null>(null);
  const [debugOn, setDebugOn] = useState(Boolean(opts.debug));
  const [stats, setStats] = useState<RuntimeStats | null>(null);
  const [mountedFrames, setMountedFrames] = useState<Set<string>>(() => {
    const all = Object.keys(player.frames);
    if (!opts.lazyFrames) return new Set(all);
    const seed = new Set<string>(["stand", "idleB", "blink", ...(player.walkCycle ?? [])]);
    return new Set(all.filter((k) => seed.has(k)));
  });

  // --- rAF-side refs ------------------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneElRef = useRef<HTMLDivElement>(null);
  const playerElRef = useRef<HTMLDivElement>(null);
  const playerCanvasRef = useRef<HTMLCanvasElement>(null);
  const monologueElRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Record<string, SVGGElement | null>>({});
  const actorElRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const actorFrameRefs = useRef<Record<string, SVGGElement | null>>({});
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const pos = useRef({
    x: finiteOr(restored?.x, config.start.x),
    y: finiteOr(restored?.y, config.start.y ?? FLOOR_Y),
    facing: (restored?.facing === -1 ? -1 : 1) as 1 | -1,
    walkDist: 0,
  });
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const padRef = useRef<PadState>(newPadState());
  const padPrev = useRef<PadState>(newPadState());
  const padPresentRef = useRef(false);
  const actionRef = useRef<ActionRun | null>(null);
  const sceneRef = useRef(scene);
  const overlayRef = useRef<unknown>(overlay);
  const introRef = useRef(intro);
  const fadingRef = useRef(false);
  // targeting: nearRef is the ACTIVE target; candidates back the prompt list;
  // lockId pins a manually chosen target until it leaves range
  const nearRef = useRef<SceneObject | null>(null);
  const candidatesRef = useRef<SceneObject[]>([]);
  const lockIdRef = useRef<string | null>(null);
  const targetsKeyRef = useRef("");
  const worldRef = useRef<W>(restored?.world ?? config.initialWorld);
  const dialogueRef = useRef<{ state: DialogueState; obj: SceneObject } | null>(null);
  const queuedToasts = useRef<number[]>([]);
  const toastSeq = useRef(0);
  const flashSeq = useRef(0);
  const movingRef = useRef(false);
  // the camera rig: eased position, look-ahead, walk bob, shake impulses,
  // plus a cinematic focus point and an eased zoom
  const camRig = useRef<CamRig>(null as unknown as CamRig);
  if (!camRig.current) camRig.current = newCamRig();
  const camStateRef = useRef({ pan: 0, panY: 0, zoom: 1, originX: 0, originY: 0, scale: 3 });
  const viewRef = useRef(view);
  const gestureFired = useRef(false);
  // last written DOM values — the tick skips writes (and the repaints/composites
  // they trigger) whenever a frame resolves to the same strings as the last one
  const domCache = useRef({
    scene: "",
    origin: "",
    cam: Number.NaN,
    vis: "",
    player: "",
    playerZ: "",
    mono: "",
    frame: "",
  });
  const domCounters = useRef({ writes: 0, skips: 0, commits: 0 });

  // owned side-effect resources
  const timersRef = useRef<Timers>(null as unknown as Timers);
  if (!timersRef.current) timersRef.current = new Timers();
  const clockRef = useRef<GameClock>(null as unknown as GameClock);
  if (!clockRef.current) clockRef.current = new GameClock();
  const fxPoolRef = useRef<FxPool>(null as unknown as FxPool);
  if (!fxPoolRef.current) fxPoolRef.current = new FxPool(opts.fxCapacity);
  const bandRef = useRef(createBandStore(32));
  const govRef = useRef<QualityGovernor>(null as unknown as QualityGovernor);
  const qualityChangeRef = useRef(config.onQualityChange);
  qualityChangeRef.current = config.onQualityChange;
  if (!govRef.current) {
    govRef.current = new QualityGovernor(opts.targetFps, (tier) => {
      qualityChangeRef.current?.(tier);
    });
  }

  // added runtime state that never needs a render
  const flagsRef = useRef<Record<string, true>>({ ...(restored?.flags ?? {}) });
  const countersRef = useRef<Record<string, number>>({ ...(restored?.counters ?? {}) });
  const sceneXRef = useRef<Record<string, number>>({ ...(restored?.sceneX ?? {}) });
  const sceneYRef = useRef<Record<string, number>>({ ...(restored?.sceneY ?? {}) });
  /** Where the last `enter` fired from — the counterpart handed to the next one. */
  const prevSceneRef = useRef<string | null>(null);
  /** Which scene `enter` already fired for, so a resolution re-render can't double it. */
  const enteredSceneRef = useRef<string | null>(null);
  const usedRef = useRef<Map<string, number>>(new Map());
  const consumedRef = useRef<Set<string>>(
    new Set(Array.isArray(restored?.consumed) ? restored.consumed : []),
  );
  const worldRevRef = useRef(0);
  const inputLockRef = useRef(false);
  const forcedFrameRef = useRef<string | null>(null);
  /**
   * The scene's parallax layers and how much of the pan each one cancels,
   * looked up once per scene rather than queried every frame.
   */
  const parallaxRef = useRef<{ el: SVGElement | HTMLElement; shift: number }[]>([]);
  /** The scene's SVG roots, so their SMIL clocks can be stopped together. */
  const smilRootsRef = useRef<SVGSVGElement[]>([]);
  const smilPausedRef = useRef(false);
  /** How long he has been standing still, and what he does about it next. */
  const idleRef = useRef(newIdleState());
  const faceRef = useRef(newFaceState());
  const gaitRef = useRef(newGaitState());
  const talkRef = useRef(newTalkState());
  const bufferedInteractRef = useRef(0);
  const autoWalkRef = useRef<{
    x: number;
    /** Target feet-y; undefined = keep the current depth (legacy behavior). */
    y?: number;
    deadline: number;
    interactId: string | null;
    resolve?: (ok: boolean) => void;
    /**
     * Stall detection: the smallest gap seen, and how much SIMULATED time has
     * passed without beating it. Simulated, not wall — see the note at the
     * detector itself.
     */
    lastGap: number;
    stalledMs: number;
    /** Waypoints still to walk after (x, y) — a route around furniture. */
    rest: { x: number; y: number }[];
    /** fraction of the normal walk speed */
    speed: number;
  } | null>(null);
  const seqRef = useRef<SeqRun<W> | null>(null);
  const ctxFactoryRef = useRef<((obj: SceneObject) => RuntimeCtx<W>) | null>(null);
  const detectRef = useRef({
    x: Number.NaN,
    y: Number.NaN,
    facing: 0,
    rev: -1,
    sceneKey: "",
    at: 0,
  });
  const objectCacheRef = useRef({ key: "", list: [] as SceneObject[] });
  const actorStateRef = useRef<Record<string, ActorRuntime>>({});
  const promoteCache = useRef({ on: false });
  const lastMoveAtRef = useRef(0);
  const saveDirtyRef = useRef(false);
  const wakeRef = useRef<() => void>(() => {});
  const parkRef = useRef<() => void>(() => {});
  const statAccum = useRef({ frames: 0, since: 0, simSteps: 0, frameMs: 16.7 });

  sceneRef.current = scene;
  overlayRef.current = overlay;
  introRef.current = intro;
  viewRef.current = view;
  dialogueRef.current = dialogue;

  // --- scene resolution ---------------------------------------------------------
  // A registry entry may be a loader (code-split scene). Resolved defs land in
  // sceneDefsRef; the current scene renders a black pending stub until its
  // chunk arrives (travel holds the fade for the same window).
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const sceneDefsRef = useRef<Record<string, RuntimeSceneDef<W>>>({});
  const sceneLoadingRef = useRef<Set<string>>(new Set());
  /** Failed loads back off (doubling from 1s) instead of retrying every poll. */
  const sceneRetryRef = useRef<Record<string, { at: number; delay: number }>>({});
  const [, bumpResolved] = useState(0);
  const resolveScene = useCallback((key: string): RuntimeSceneDef<W> | undefined => {
    const cached = sceneDefsRef.current[key];
    if (cached) return cached;
    const source = scenesRef.current[key] as
      | RuntimeSceneDef<W>
      | (() => Promise<RuntimeSceneDef<W>>)
      | undefined;
    if (!source) return undefined;
    if (typeof source !== "function") {
      sceneDefsRef.current[key] = source;
      return source;
    }
    const retry = sceneRetryRef.current[key];
    if (!sceneLoadingRef.current.has(key) && (!retry || nowMs() >= retry.at)) {
      sceneLoadingRef.current.add(key);
      source().then(
        (loaded) => {
          sceneDefsRef.current[key] = loaded;
          sceneLoadingRef.current.delete(key);
          delete sceneRetryRef.current[key];
          if (sceneRef.current === key) bumpResolved((n) => n + 1);
          wakeRef.current();
        },
        (err) => {
          sceneLoadingRef.current.delete(key);
          // back off doubling from 1s: the travel hold polls every 60ms and a
          // dead network must not answer that with ~166 fresh import() storms
          const delay = Math.min(8000, (sceneRetryRef.current[key]?.delay ?? 500) * 2);
          sceneRetryRef.current[key] = { at: nowMs() + delay, delay };
          console.error(`runtime: scene "${key}" failed to load`, err);
        },
      );
    }
    return undefined;
  }, []);
  /** Resolved def by key — the loop-side read (never kicks a load). */
  const getDef = useCallback(
    (key: string): RuntimeSceneDef<W> | undefined => sceneDefsRef.current[key],
    [],
  );
  // make sure the scene on screen (first mount, restores, travels) is loading
  useEffect(() => {
    resolveScene(scene);
  }, [scene, resolveScene]);

  const def = (sceneDefsRef.current[scene] ??
    resolveScene(scene) ??
    PENDING_SCENE) as RuntimeSceneDef<W>;
  const defResolved = def !== (PENDING_SCENE as RuntimeSceneDef<W>);
  const walkSpeed = player.walkSpeed ?? DEFAULT_WALK_SPEED;
  const walkSpeedY = player.walkSpeedY ?? walkSpeed * WALK_SPEED_Y_RATIO;
  /**
   * Depth to walk in this scene. It also decides what the vertical keys MEAN:
   * with depth they walk; without it they cycle targets, exactly as they did
   * before the ground grew a second axis — a flat room has nothing else for
   * up and down to do, and losing target cycling there was a regression.
   */
  const bandHasDepth = hasDepth(groundOf(def));

  // --- sprite atlas (opt-in, with a DOM fallback) --------------------------------
  const playerPalette = useMemo(
    () => (config.playerAppearance ? config.playerAppearance(world) : player.palette),
    [config.playerAppearance, world, player.palette],
  );
  // `playerAppearance` usually builds a fresh object per call, which would
  // re-rasterize (and re-render every PixelSprite) on every commit. Pin the
  // palette to its own content, so identity only changes when colours do.
  const paletteKey = JSON.stringify(playerPalette);
  const paletteKeyRef = useRef(paletteKey);
  const paletteRef = useRef(playerPalette);
  if (paletteKey !== paletteKeyRef.current) {
    paletteKeyRef.current = paletteKey;
    paletteRef.current = playerPalette;
  }
  const palette = paletteRef.current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: paletteKey pins the palette content
  const atlas = useMemo(() => {
    if (opts.spriteMode === "dom") return null;
    const cell = player.cell ?? 2;
    const cells =
      Object.keys(player.frames).length *
      Math.max(1, Math.round((player.width / cell) * (player.height / cell)));
    if (opts.spriteMode === "auto" && cells < opts.atlasThreshold) return null;
    const raster = rasterizeFrames(player.frames, paletteRef.current);
    return raster ? new AtlasSprite(raster) : null;
  }, [
    player.frames,
    player.width,
    player.height,
    player.cell,
    paletteKey,
    opts.spriteMode,
    opts.atlasThreshold,
  ]);

  useEffect(() => {
    if (!atlas) return;
    atlas.attach(playerCanvasRef.current);
    domCache.current.frame = "";
    return () => atlas.dispose();
  }, [atlas]);

  // --- autosave (debounced, idle, dirty-gated) -----------------------------------
  const buildSave = useCallback((): SavePayload<W> | null => {
    if (!persist) return null;
    const payload: SavePayload<W> = {
      version: persist.version,
      world: worldRef.current,
      scene: sceneRef.current,
      x: pos.current.x,
      y: pos.current.y,
      savedAt: new Date().toISOString(),
      facing: pos.current.facing,
      flags: flagsRef.current,
      counters: countersRef.current,
      sceneX: { ...sceneXRef.current, [sceneRef.current]: pos.current.x },
      sceneY: { ...sceneYRef.current, [sceneRef.current]: pos.current.y },
      consumed: [...consumedRef.current],
    };
    return payload;
  }, [persist]);

  const saveNow = useCallback(() => {
    if (!persist) return;
    const payload = buildSave();
    if (!payload) return;
    // a failed write (quota, private mode) stays dirty so the pagehide
    // flush and the next autosave keep trying instead of silently giving up
    if (saveGame(persist.key, payload)) saveDirtyRef.current = false;
  }, [buildSave, persist]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: world/scene changes are what mark the save dirty
  useEffect(() => {
    if (!persist) return;
    saveDirtyRef.current = true;
    const timers = timersRef.current;
    let cancelIdle: (() => void) | null = null;
    const id = timers.after(() => {
      cancelIdle = idle(() => {
        if (saveDirtyRef.current) saveNow();
      });
    }, opts.autosaveMs);
    return () => {
      timers.clear(id);
      cancelIdle?.();
    };
  }, [persist, world, scene, saveNow, opts.autosaveMs]);

  // flush on the way out — a debounce that never fires is a lost save
  useEffect(() => {
    if (!persist) return;
    const flush = () => {
      if (saveDirtyRef.current) saveNow();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [persist, saveNow]);

  // --- world write path ----------------------------------------------------------
  const updateWorld = useCallback((patch: Partial<W> | ((w: W) => W)) => {
    const next =
      typeof patch === "function" ? patch(worldRef.current) : { ...worldRef.current, ...patch };
    worldRef.current = next;
    worldRevRef.current += 1;
    setWorld(next);
  }, []);

  // --- toasts ---------------------------------------------------------------------
  const showToast = useCallback((text: string) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text });
    // narrate to assistive tech; the visual toast is decorative
    if (liveRegionRef.current) liveRegionRef.current.textContent = text;
  }, []);

  useEffect(() => {
    if (!toast) return;
    // the game clock: a toast shown just before the menu opens is still
    // there, with its time left, when the menu closes
    const clock = clockRef.current;
    // as long as the line needs to be read at the player's text speed
    const id = clock.after(dwellMs(toast.text), () => {
      setToast((cur) => (cur?.id === toast.id ? null : cur));
    });
    return () => clock.cancel(id);
  }, [toast]);

  const queueToast = useCallback(
    (text: string, delayMs: number) => {
      queuedToasts.current.push(clockRef.current.after(delayMs, () => showToast(text)));
    },
    [showToast],
  );

  const cancelQueuedToasts = useCallback(() => {
    for (const timer of queuedToasts.current) clockRef.current.cancel(timer);
    queuedToasts.current = [];
  }, []);

  // --- scene-change hook (ambience, music) --------------------------------------------
  useEffect(() => {
    // lifecycle: enter (and the game's onSceneChange) fire when the scene is
    // actually on screen — for a code-split scene that is when its chunk
    // lands, not when the black stub does
    if (!defResolved || enteredSceneRef.current === scene) return;
    enteredSceneRef.current = scene;
    config.onSceneChange?.(scene);
    def.enter?.({
      world: worldRef.current,
      updateWorld,
      scene,
      counterpart: prevSceneRef.current ?? undefined,
    });
    prevSceneRef.current = scene;
  }, [config.onSceneChange, scene, def, defResolved, updateWorld]);

  // --- day phase -------------------------------------------------------------------
  useEffect(() => {
    if (!config.dayPhase) return;
    const timers = timersRef.current;
    const id = timers.every(() => setPhase(config.dayPhase?.() ?? "day"), 60_000);
    return () => timers.clear(id);
  }, [config.dayPhase]);

  // --- reduced motion ----------------------------------------------------------------
  useEffect(() => {
    if (config.reducedMotion !== "auto" && config.reducedMotion !== undefined) {
      setReduced(config.reducedMotion);
      return;
    }
    return subscribeReducedMotion(setReduced);
  }, [config.reducedMotion]);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // --- sizing -----------------------------------------------------------------------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const node = viewportRef.current;
      if (!node) return;
      setView((cur) => {
        const next = {
          w: node.clientWidth,
          h: node.clientHeight,
          scale: viewportScale(node.clientHeight),
        };
        return cur.w === next.w && cur.h === next.h && cur.scale === next.scale ? cur : next;
      });
    };
    measure();
    // ResizeObserver beats window resize: it also catches layout changes around us
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // --- fx ---------------------------------------------------------------------------
  const spawnFx = useCallback((kind: string, x: number, ttlMs: number, data?: unknown) => {
    fxPoolRef.current.spawn(kind, x, ttlMs, data, clockRef.current.t);
    setFx(fxPoolRef.current.snapshot() as unknown as FxInstance[]);
    wakeRef.current();
  }, []);

  // --- camera controls -------------------------------------------------------------------
  const shakeCamera = useCallback((intensity: number, ms: number) => {
    if (reducedRef.current) return;
    const rig = camRig.current;
    rig.shakeMag = Math.max(rig.shakeMag, intensity);
    rig.shakeUntil = nowMs() + ms;
    wakeRef.current();
  }, []);

  const focusCamera = useCallback((x: number | null, _ms?: number) => {
    camRig.current.focusX = x;
    wakeRef.current();
  }, []);

  const zoomTo = useCallback((mult: number, ms = 600) => {
    const rig = camRig.current;
    rig.zoomTarget = clamp(mult, 0.5, 4);
    rig.zoomRate = reducedRef.current ? 60 : Math.max(0.5, 1200 / Math.max(60, ms));
    wakeRef.current();
  }, []);

  const flash = useCallback((color = "#ffffff", ms = 320) => {
    flashSeq.current += 1;
    const id = flashSeq.current;
    setFlashFx({ id, color, ms: reducedRef.current ? Math.min(ms, 120) : ms });
    // id-guarded: a second flash must not be cut down by the first one's timer
    timersRef.current.after(() => setFlashFx((cur) => (cur?.id === id ? null : cur)), ms + 80);
  }, []);

  const letterbox = useCallback((on: boolean) => setCinema(on), []);

  // --- targeting -----------------------------------------------------------------------
  // React only hears about targeting when the candidate list or the active
  // target actually change; the rAF loop compares against a fingerprint.
  const pushTargets = useCallback((list: SceneObject[], activeId: string | null) => {
    const key = `${list.map((o) => o.id).join(",")}|${activeId ?? ""}`;
    if (key === targetsKeyRef.current) return;
    targetsKeyRef.current = key;
    domCounters.current.commits += 1;
    setTargets({ list, activeId });
  }, []);

  const selectTarget = useCallback(
    (id: string) => {
      const next = candidatesRef.current.find((o) => o.id === id);
      if (!next) return;
      lockIdRef.current = id;
      nearRef.current = next;
      pushTargets(candidatesRef.current, id);
    },
    [pushTargets],
  );

  const cycleTarget = useCallback(
    (delta: number) => {
      const list = candidatesRef.current;
      if (list.length < 2) return;
      const idx = list.findIndex((o) => o.id === nearRef.current?.id);
      selectTarget(list[(Math.max(idx, 0) + delta + list.length) % list.length].id);
    },
    [selectTarget],
  );

  const clearTargets = useCallback(() => {
    nearRef.current = null;
    candidatesRef.current = [];
    lockIdRef.current = null;
    targetsKeyRef.current = "";
    detectRef.current.x = Number.NaN;
    setTargets({ list: [], activeId: null });
  }, []);

  // --- actions -----------------------------------------------------------------------
  const startAction = useCallback((id: string, o?: { onInterrupt?: () => void }) => {
    // the GAME clock: an action opened just before the pause menu must be
    // exactly where it was when the menu closes, not finished behind it
    actionRef.current = { id, start: clockRef.current.t, onInterrupt: o?.onInterrupt };
    setActionUi(id);
    wakeRef.current();
  }, []);

  // --- auto-walk ------------------------------------------------------------------------
  /**
   * Turn a walk request into a route. Scenes with furniture get a detour
   * around it (planRoute) instead of the old stall-against-the-bench; scenes
   * without blockers keep the straight walk, y-undefined still meaning
   * "hold this depth".
   */
  const planWalk = useCallback(
    (x: number, y: number | undefined) => {
      const def = getDef(sceneRef.current);
      const band = groundOf(def);
      if (!def || !band.blockers || band.blockers.length === 0) {
        return { x, y, rest: [] as { x: number; y: number }[] };
      }
      const route = planRoute(
        band,
        pos.current.x,
        pos.current.y,
        x,
        y ?? pos.current.y,
        EDGE_MARGIN,
        def.width - EDGE_MARGIN,
      );
      const first = route[0] ?? { x, y: y ?? pos.current.y };
      return { x: first.x, y: first.y as number | undefined, rest: route.slice(1) };
    },
    [getDef],
  );

  const planWalkRef = useRef(planWalk);
  planWalkRef.current = planWalk;

  const walkTo = useCallback(
    (x: number, o?: { y?: number; timeoutMs?: number }) => {
      cancelAutoWalkStatic(autoWalkRef);
      wakeRef.current();
      return new Promise<boolean>((resolve) => {
        // deadlines live on the game clock: a pause must not eat the walk
        const t = clockRef.current.t;
        const w = planWalk(x, o?.y);
        autoWalkRef.current = newAutoWalk(
          w.x,
          w.y,
          t + (o?.timeoutMs ?? 8000),
          null,
          resolve,
          w.rest,
        );
      });
    },
    [planWalk],
  );

  // --- travel & blackout ----------------------------------------------------------------
  const travel = useCallback(
    (target: string, spawnX?: number, spawnY?: number) => {
      if (fadingRef.current) return;
      fadingRef.current = true;
      if (opts.rememberSceneX) {
        sceneXRef.current[sceneRef.current] = pos.current.x;
        sceneYRef.current[sceneRef.current] = pos.current.y;
      }
      // lifecycle: the leaving scene releases; the destination starts loading
      // (its chunk, then its preload) behind the fade
      const fromKey = sceneRef.current;
      getDef(fromKey)?.exit?.({
        world: worldRef.current,
        updateWorld,
        scene: fromKey,
        counterpart: target,
      });
      const eager = resolveScene(target);
      void eager?.preload?.();
      let preloadFired = Boolean(eager);
      const timers = timersRef.current;
      setFade({ on: true, ms: reducedRef.current ? 90 : TRAVEL_FADE_OUT_MS });
      /**
       * The switch waits for a code-split destination: the fade holds black
       * while the chunk is on the wire, polling briefly instead of switching
       * to a scene that isn't there. A destination that never resolves
       * (network death, bad key) falls through after the deadline and lands
       * on the pending stub rather than wedging the fade forever.
       */
      const holdUntil = nowMs() + 10_000;
      const doSwitch = () => {
        const nextDef = getDef(target);
        if (!nextDef && scenesRef.current[target] && nowMs() < holdUntil) {
          resolveScene(target);
          timers.after(doSwitch, 60);
          return;
        }
        if (nextDef && !preloadFired) {
          preloadFired = true;
          void nextDef.preload?.();
        }
        const remembered = opts.rememberSceneX ? sceneXRef.current[target] : undefined;
        const fallback = nextDef?.spawnX ?? (nextDef ? nextDef.width / 2 : pos.current.x);
        pos.current.x = spawnX ?? remembered ?? fallback;
        const rememberedY = opts.rememberSceneX ? sceneYRef.current[target] : undefined;
        pos.current.y = clampYAt(
          groundOf(nextDef),
          pos.current.x,
          spawnY ?? rememberedY ?? FLOOR_Y,
        );
        camRig.current.x = Number.NaN;
        camRig.current.look = 0;
        camRig.current.focusX = null;
        fxPoolRef.current.clear();
        setFx(fxPoolRef.current.snapshot() as unknown as FxInstance[]);
        cancelAutoWalkStatic(autoWalkRef);
        actorStateRef.current = {};
        setScene(target);
        clearTargets();
        timers.after(() => {
          fadingRef.current = false;
          setFade({ on: false, ms: reducedRef.current ? 90 : TRAVEL_FADE_OUT_MS });
        }, TRAVEL_FADE_IN_DELAY_MS);
      };
      timers.after(doSwitch, TRAVEL_SWITCH_AT_MS);
    },
    [clearTargets, getDef, opts.rememberSceneX, resolveScene, updateWorld],
  );

  const blackout = useCallback(
    (holdMs: number, text: string) => {
      fadingRef.current = true;
      const timers = timersRef.current;
      setFade({ on: true, ms: 400 });
      timers.after(() => {
        setFade({ on: false, ms: 400 });
        showToast(text);
        timers.after(() => {
          fadingRef.current = false;
        }, 400);
      }, holdMs);
    },
    [showToast],
  );

  // --- flags / counters -------------------------------------------------------------------
  const flag = useCallback((key: string) => flagsRef.current[key] === true, []);
  const setFlag = useCallback((key: string, on = true) => {
    if (on) flagsRef.current[key] = true;
    else delete flagsRef.current[key];
    saveDirtyRef.current = true;
  }, []);
  const counter = useCallback((key: string) => countersRef.current[key] ?? 0, []);
  const bump = useCallback((key: string, by = 1) => {
    const next = (countersRef.current[key] ?? 0) + by;
    countersRef.current[key] = next;
    saveDirtyRef.current = true;
    return next;
  }, []);
  const onceOnly = useCallback(
    (key: string) => {
      if (flagsRef.current[key]) return false;
      setFlag(key);
      return true;
    },
    [setFlag],
  );

  const playSound = useCallback(
    (name: string, o?: { volume?: number; rate?: number }) => config.onSound?.(name, o),
    [config.onSound],
  );

  const vibrate = useCallback((ms: number) => {
    if (reducedRef.current) return;
    navigator.vibrate?.(ms);
  }, []);

  // --- sequences ----------------------------------------------------------------------------
  const cancelSequence = useCallback(() => {
    const run = seqRef.current;
    seqRef.current = null;
    if (!run) return;
    if (run.cinematic) {
      inputLockRef.current = false;
      setCinema(false);
      camRig.current.focusX = null;
      camRig.current.zoomTarget = 1;
    }
    forcedFrameRef.current = null;
    run.resolve(false);
  }, []);

  const runSequence = useCallback(
    (steps: SeqStep<W>[], o?: { cinematic?: boolean; skippable?: boolean }) => {
      cancelSequence();
      const cinematic = o?.cinematic ?? false;
      if (cinematic) {
        inputLockRef.current = true;
        setCinema(true);
      }
      wakeRef.current();
      return new Promise<boolean>((resolve) => {
        seqRef.current = newSeqRun(steps, cinematic, resolve, o?.skippable ?? false);
      });
    },
    [cancelSequence],
  );

  // --- interaction dispatch ----------------------------------------------------------------
  const makeCtx = useCallback(
    (obj: SceneObject): RuntimeCtx<W> => {
      const base: InteractionCtx<W> = {
        obj,
        world: worldRef.current,
        updateWorld,
        showToast,
        startAction,
        travel,
        blackout,
        openOverlay: setOverlay,
        spawnFx,
        queueToast,
        startDialogue: (tree) => {
          const step = openDialogue(tree as DialogueTree<never>, () => makeCtx(obj));
          if (step.kind === "continue") {
            step.onEnter?.(makeCtx(obj));
            setDialogue({ state: step.state, obj });
          }
        },
        shakeCamera,
        scene: sceneRef.current,
      };
      const extras = {
        walkTo,
        focusCamera,
        zoom: zoomTo,
        flash,
        letterbox,
        lockInput: (on: boolean) => {
          inputLockRef.current = on;
        },
        runSequence,
        cancelSequence,
        after: (ms: number, fn: () => void) => clockRef.current.after(ms, fn),
        cancelAfter: (id: number) => clockRef.current.cancel(id),
        flag,
        setFlag,
        counter,
        bump,
        once: onceOnly,
        saveNow,
        playSound,
        quality: () => govRef.current.tier,
        reducedMotion: () => reducedRef.current,
        setPlayerFrame: (frame: string | null) => {
          forcedFrameRef.current = frame;
        },
        now: () => clockRef.current.t,
        playerAt: () => ({ x: pos.current.x, y: pos.current.y, facing: pos.current.facing }),
        setTarget: selectTarget,
        vibrate,
      };
      return { ...base, ...extras } as RuntimeCtx<W>;
    },
    [
      blackout,
      bump,
      cancelSequence,
      counter,
      flag,
      flash,
      focusCamera,
      letterbox,
      onceOnly,
      playSound,
      queueToast,
      runSequence,
      saveNow,
      selectTarget,
      setFlag,
      shakeCamera,
      showToast,
      spawnFx,
      startAction,
      travel,
      updateWorld,
      vibrate,
      walkTo,
      zoomTo,
    ],
  );
  ctxFactoryRef.current = makeCtx;

  const interact = useCallback(
    (obj: SceneObject | null) => {
      if (!obj || fadingRef.current || dialogueRef.current || inputLockRef.current) return;
      if (actionRef.current) {
        // buffer the press instead of eating it — the action releases it
        bufferedInteractRef.current = nowMs();
        return;
      }
      const meta = obj as RuntimeObject;
      if (consumedRef.current.has(obj.id)) return;
      const until = usedRef.current.get(obj.id) ?? 0;
      if (until > clockRef.current.t) return;
      if (obj.kind !== "door") {
        pos.current.facing = obj.face ?? (obj.x >= pos.current.x ? 1 : -1);
      }
      const ctx = makeCtx(obj);
      const handler =
        handlers[obj.kind] ??
        (obj.kind === "door"
          ? () => {
              if (obj.to) travel(obj.to.scene, obj.to.spawnX, obj.to.spawnY);
            }
          : undefined);
      if (!handler) return;
      if (meta.cooldownMs) usedRef.current.set(obj.id, clockRef.current.t + meta.cooldownMs);
      if (meta.once) {
        consumedRef.current.add(obj.id);
        objectCacheRef.current.key = ""; // candidate list must be rebuilt
        detectRef.current.x = Number.NaN;
      }
      setPromptPulse((n) => n + 1); // press the keycap on the chip
      wakeRef.current();
      handler(ctx);
    },
    [handlers, makeCtx, travel],
  );

  /** Target it, walk to it if it's out of reach, then use it. */
  const engage = useCallback(
    (obj: SceneObject) => {
      const meta = obj as RuntimeObject;
      selectTarget(obj.id);
      const inRange = candidatesRef.current.some((o) => o.id === obj.id);
      if (inRange || !opts.autoWalkToTargets || meta.autoWalk === false) {
        interact(inRange ? obj : nearRef.current);
        return;
      }
      cancelAutoWalkStatic(autoWalkRef);
      // stand at the object's own depth when it declares one; stay put otherwise
      const w = planWalk(
        clamp(meta.approachX ?? obj.x, EDGE_MARGIN, def.width - EDGE_MARGIN),
        meta.approachY ?? obj.y,
      );
      autoWalkRef.current = newAutoWalk(
        w.x,
        w.y,
        clockRef.current.t + 8000,
        obj.id,
        undefined,
        w.rest,
      );
      wakeRef.current();
    },
    [def.width, interact, opts.autoWalkToTargets, planWalk, selectTarget],
  );

  /**
   * Apply a dialogue step. Every path in and out of a node goes through here
   * so `onEnter` actually fires — it was declared on `DialogueNode` from the
   * start and called from nowhere, which meant a node's entry effect silently
   * did nothing and authors had no way to tell.
   */
  const applyDialogueStep = useCallback(
    (cur: { state: DialogueState; obj: SceneObject }, step: DialogueStep) => {
      if (step.kind === "continue") {
        step.onEnter?.(makeCtx(cur.obj));
        setDialogue({ ...cur, state: step.state });
      } else {
        step.onEnd?.(makeCtx(cur.obj));
        setDialogue(null);
      }
    },
    [makeCtx],
  );

  // --- dialogue input ---------------------------------------------------------------------------
  const dialogueAdvance = useCallback(() => {
    const cur = dialogueRef.current;
    if (!cur) return;
    const ctx = () => makeCtx(cur.obj);
    if (dialogueAtChoices(cur.state, ctx)) {
      applyDialogueStep(cur, chooseDialogue(cur.state, cur.state.choiceIndex, ctx));
      return;
    }
    applyDialogueStep(cur, advanceDialogue(cur.state, ctx));
  }, [makeCtx, applyDialogueStep]);

  const dialogueChoose = useCallback(
    (index: number) => {
      const cur = dialogueRef.current;
      if (!cur) return;
      applyDialogueStep(
        cur,
        chooseDialogue(cur.state, index, () => makeCtx(cur.obj)),
      );
    },
    [makeCtx, applyDialogueStep],
  );

  const dialogueMoveCursor = useCallback((delta: number) => {
    const cur = dialogueRef.current;
    const ctx = () => ctxFactoryRef.current?.(cur?.obj as SceneObject) as unknown;
    if (!cur || !dialogueAtChoices(cur.state, ctx)) return;
    // the cursor walks the choices actually on offer, not every authored one,
    // or a hidden branch would leave a dead stop in the list
    const count = offeredChoices(cur.state.tree.nodes[cur.state.nodeId], ctx).length;
    if (count === 0) return;
    setDialogue({
      ...cur,
      state: {
        ...cur.state,
        choiceIndex: (cur.state.choiceIndex + delta + count) % count,
      },
    });
  }, []);

  // --- first gesture (audio unlock) -----------------------------------------------------------
  const fireGesture = useCallback(() => {
    if (gestureFired.current) return;
    gestureFired.current = true;
    config.onFirstGesture?.();
  }, [config]);

  // --- keyboard --------------------------------------------------------------------------------
  const keymap = useMemo(() => buildKeymap(config.keymap), [config.keymap]);
  // the listener reads live callbacks through this bag, so it subscribes once
  const inputBag = useRef({
    keymap,
    interact,
    cycleTarget,
    dialogueAdvance,
    dialogueMoveCursor,
    fireGesture,
    menuOverlay: config.menuOverlay,
    pauseOverlay: config.pauseOverlay,
    debugAllowed: opts.debug,
    hasDepth: bandHasDepth,
  });
  inputBag.current = {
    keymap,
    interact,
    cycleTarget,
    dialogueAdvance,
    dialogueMoveCursor,
    fireGesture,
    menuOverlay: config.menuOverlay,
    pauseOverlay: config.pauseOverlay,
    debugAllowed: opts.debug,
    hasDepth: bandHasDepth,
  };

  useEffect(() => {
    const MODIFIERS = /^(Shift|Control|Alt|Meta)/;
    const onKeyDown = (event: KeyboardEvent) => {
      const bag = inputBag.current;
      bag.fireGesture();
      wakeRef.current();
      if (introRef.current) {
        if (!MODIFIERS.test(event.code)) setIntro(false);
        return;
      }
      const action: InputAction | undefined = bag.keymap.get(event.code);
      if (dialogueRef.current) {
        if (action === "interact") {
          event.preventDefault();
          bag.dialogueAdvance();
        } else if (action === "up" || action === "targetNext") {
          event.preventDefault();
          bag.dialogueMoveCursor(-1);
        } else if (action === "down" || action === "targetPrev") {
          event.preventDefault();
          bag.dialogueMoveCursor(1);
        }
        return;
      }
      if (overlayRef.current) {
        if (action === "cancel" || action === "menu") {
          event.preventDefault();
          setOverlay(null);
        }
        return;
      }
      // a cinematic owns the keys; the one thing it may allow is being skipped
      if (inputLockRef.current) {
        const run = seqRef.current;
        if (action === "cancel" && run?.cinematic && run.skippable) {
          event.preventDefault();
          cancelSequence();
        }
        return;
      }
      switch (action) {
        case "left":
          keys.current.left = true;
          event.preventDefault();
          break;
        case "right":
          keys.current.right = true;
          event.preventDefault();
          break;
        case "up":
          // flat scene: the old target-cycling gesture; band scene: walk away
          if (bag.hasDepth) keys.current.up = true;
          else bag.cycleTarget(1);
          event.preventDefault();
          break;
        case "down":
          if (bag.hasDepth) keys.current.down = true;
          else bag.cycleTarget(-1);
          event.preventDefault();
          break;
        case "interact":
          event.preventDefault();
          bag.interact(nearRef.current);
          break;
        case "targetNext":
          event.preventDefault();
          bag.cycleTarget(1);
          break;
        case "targetPrev":
          event.preventDefault();
          bag.cycleTarget(-1);
          break;
        case "cancel": {
          // Escape is a stack: it backs out of whatever is innermost. Only when
          // there is nothing left to back out of does it mean "pause".
          const busy = Boolean(seqRef.current && !seqRef.current.cinematic);
          if (busy) cancelSequence();
          const walking = autoWalkRef.current !== null;
          cancelAutoWalkStatic(autoWalkRef);
          if (!busy && !walking && bag.pauseOverlay !== undefined) {
            event.preventDefault();
            setOverlay(bag.pauseOverlay);
          }
          break;
        }
        case "menu":
          if (bag.menuOverlay !== undefined) {
            event.preventDefault();
            setOverlay(bag.menuOverlay);
          }
          break;
        case "debug":
          if (bag.debugAllowed) setDebugOn((on) => !on);
          break;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = inputBag.current.keymap.get(event.code);
      if (action === "left") keys.current.left = false;
      if (action === "right") keys.current.right = false;
      if (action === "up") keys.current.up = false;
      if (action === "down") keys.current.down = false;
    };
    // alt-tabbing mid-stride used to leave the player walking forever
    const releaseAll = () => {
      keys.current.left = false;
      keys.current.right = false;
      keys.current.up = false;
      keys.current.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, [cancelSequence]);

  // --- touch: hold edges to walk, tap middle to interact or pick ---------------------------------
  const pointerWalk = useCallback(
    (event: React.PointerEvent) => {
      fireGesture();
      wakeRef.current();
      if (introRef.current || overlayRef.current || fadingRef.current) return;
      if ((event.target as HTMLElement).closest("button")) return;
      const el = viewportRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const rel = (event.clientX - box.left) / el.clientWidth;
      if (rel < 0.38) {
        keys.current.left = true;
        cancelAutoWalkStatic(autoWalkRef);
        return;
      }
      if (rel > 0.62) {
        keys.current.right = true;
        cancelAutoWalkStatic(autoWalkRef);
        return;
      }
      const sceneDef = getDef(sceneRef.current);
      if (opts.pointerPicking && !inputLockRef.current && sceneDef) {
        // screen -> world, undoing pan and zoom about the current origin
        const cam = camStateRef.current;
        const local = cam.originX + (event.clientX - box.left - cam.originX - cam.pan) / cam.zoom;
        const picked = pickObject(sceneDef.objects as RuntimeObject[], local / cam.scale);
        if (picked && !consumedRef.current.has(picked.id)) {
          engage(picked);
          return;
        }
        // nothing under the tap, nothing in reach: in a ground-band scene an
        // empty tap is "walk there" — the natural touch control for depth
        const band = groundOf(sceneDef);
        if (!nearRef.current && hasDepth(band)) {
          const localY =
            cam.originY + (event.clientY - box.top - cam.originY - cam.panY) / cam.zoom;
          walkTo(clamp(local / cam.scale, EDGE_MARGIN, sceneDef.width - EDGE_MARGIN), {
            y: clampY(band, localY / cam.scale),
          });
          return;
        }
      }
      interact(nearRef.current);
    },
    [engage, fireGesture, getDef, interact, opts.pointerPicking, walkTo],
  );

  const pointerStop = useCallback(() => {
    keys.current.left = false;
    keys.current.right = false;
    keys.current.up = false;
    keys.current.down = false;
  }, []);

  /** Touch walk buttons press virtual keys; the sim reads them like real ones. */
  const pressWalk = useCallback((dir: "left" | "right" | "up" | "down") => {
    keys.current[dir] = true;
    cancelAutoWalkStatic(autoWalkRef);
    wakeRef.current();
  }, []);

  // --- gamepad presence ---------------------------------------------------------------------------
  useEffect(() => {
    if (!opts.gamepad) return;
    const check = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let any = false;
      for (const pad of pads) if (pad?.connected) any = true;
      padPresentRef.current = any;
      if (any) wakeRef.current();
    };
    check();
    window.addEventListener("gamepadconnected", check);
    window.addEventListener("gamepaddisconnected", check);
    return () => {
      window.removeEventListener("gamepadconnected", check);
      window.removeEventListener("gamepaddisconnected", check);
      padPresentRef.current = false;
    };
  }, [opts.gamepad]);

  // --- park / wake --------------------------------------------------------------------------------
  useEffect(() => {
    if (!opts.pauseWhenHidden) return;
    const onVisibility = () => {
      if (document.hidden) parkRef.current();
      else wakeRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const el = viewportRef.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) wakeRef.current();
          else parkRef.current();
        },
        { threshold: 0 },
      );
      io.observe(el);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, [opts.pauseWhenHidden]);

  const statsRef = useRef<RuntimeStats | null>(stats);
  statsRef.current = stats;
  /**
   * The animation state, sampled every simulated frame. A ref and not state:
   * the debug HUD polls it, and a developer overlay that re-rendered React on
   * every frame change would be measuring itself rather than the game.
   */
  const liveRef = useRef<LiveState>({
    frame: "stand",
    y: FLOOR_Y,
    surface: null,
    target: null,
    prevFrame: "stand",
    action: null,
    actionProgress: 0,
    source: "idle",
    moving: false,
    facing: 1,
    x: 0,
    scene: "",
  });
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;

  // small stable bridges the loop reads without re-subscribing
  const dialogueAdvanceRef = useRef(dialogueAdvance);
  dialogueAdvanceRef.current = dialogueAdvance;
  const cycleTargetRef = useRef(cycleTarget);
  cycleTargetRef.current = cycleTarget;
  const menuRef = useRef(config.menuOverlay);
  menuRef.current = config.menuOverlay;
  const soundRef = useRef(config.onSound);
  soundRef.current = config.onSound;
  const debugRef = useRef(debugOn);
  debugRef.current = debugOn;
  const dprRef = useRef(1);
  dprRef.current = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const requestFrameRef = useRef<(frame: string) => void>(() => {});
  const pendingFrames = useRef<Set<string>>(new Set());
  requestFrameRef.current = (frame: string) => {
    if (pendingFrames.current.has(frame) || mountedFrames.has(frame)) return;
    pendingFrames.current.add(frame);
    setMountedFrames((cur) => {
      const next = new Set(cur);
      next.add(frame);
      return next;
    });
  };

  // --- loop bag: everything the tick reads, refreshed each render ---------------------------------
  const loopBag = useRef({
    getDef,
    player,
    walkSpeed,
    walkSpeedY,
    opts,
    interact,
    pushTargets,
    cancelQueuedToasts,
    showToast,
    updateWorld,
    travel,
    spawnFx,
    shakeCamera,
    flash,
    letterbox,
    focusCamera,
    zoomTo,
    startAction,
    cancelSequence,
    atlas,
  });
  loopBag.current = {
    getDef,
    player,
    walkSpeed,
    walkSpeedY,
    opts,
    interact,
    pushTargets,
    cancelQueuedToasts,
    showToast,
    updateWorld,
    travel,
    spawnFx,
    shakeCamera,
    flash,
    letterbox,
    focusCamera,
    zoomTo,
    startAction,
    cancelSequence,
    atlas,
  };

  // --- game loop ----------------------------------------------------------------------------------
  // Mounted once. Everything mutable arrives through refs, so a config change,
  // a world write or a new callback identity never restarts the loop.
  useEffect(() => {
    let raf = 0;
    let last = nowMs();
    let lastFrame = last - 16;
    let acc = 0;
    let parked = false;
    const clock = clockRef.current;
    const gov = govRef.current;
    const pool = fxPoolRef.current;
    const band = bandRef.current;
    gov.reset(last);
    statAccum.current.since = last;

    const park = () => {
      if (parked) return;
      parked = true;
      cancelAnimationFrame(raf);
      keys.current.left = false;
      keys.current.right = false;
      keys.current.up = false;
      keys.current.down = false;
    };
    const wake = () => {
      if (!parked) return;
      parked = false;
      last = nowMs();
      lastFrame = last - 16;
      acc = 0;
      raf = requestAnimationFrame(tick);
    };
    parkRef.current = park;
    wakeRef.current = wake;

    /**
     * The runtime's side of the sequencer contract. Built once per loop
     * mount; every method reads live state through refs, so the host never
     * goes stale and never re-subscribes anything.
     */
    const seqAnchor = (): SceneObject =>
      // a synthetic anchor when nothing is targeted in an objectless scene —
      // a {dialogue} or {do} beat must never hand `undefined` to a handler
      // or crash the speaking memo on `.id`
      nearRef.current ??
      loopBag.current.getDef(sceneRef.current)?.objects[0] ?? {
        id: "__seq__",
        kind: "__seq__",
        x: pos.current.x,
      };
    const seqHost: SeqHost<W> = {
      showToast: (text) => loopBag.current.showToast(text),
      startWalk: (x, y, deadline, speed) => {
        cancelAutoWalkStatic(autoWalkRef);
        const w = planWalkRef.current(x, y);
        autoWalkRef.current = newAutoWalk(w.x, w.y, deadline, null, undefined, w.rest, speed);
      },
      walking: () => autoWalkRef.current !== null,
      toastMs: dwellMs,
      setFacing: (facing) => {
        pos.current.facing = facing;
      },
      holdFrame: (frame) => {
        forcedFrameRef.current = frame;
      },
      startAction: (id) => loopBag.current.startAction(id),
      actionRunning: () => actionRef.current !== null,
      updateWorld: (patch) => loopBag.current.updateWorld(patch),
      spawnFx: (kind, x, ttlMs, data) => loopBag.current.spawnFx(kind, x, ttlMs, data),
      shakeCamera: (intensity, ms) => loopBag.current.shakeCamera(intensity, ms),
      flash: (color, ms) => loopBag.current.flash(color, ms),
      focusCamera: (x, ms) => loopBag.current.focusCamera(x, ms),
      letterbox: (on) => loopBag.current.letterbox(on),
      travel: (scene, spawnX, spawnY) => loopBag.current.travel(scene, spawnX, spawnY),
      fading: () => fadingRef.current,
      openDialogue: (tree) => {
        const obj = seqAnchor();
        const open = openDialogue(tree as DialogueTree<never>, () => ctxFactoryRef.current?.(obj));
        if (open.kind === "continue") {
          open.onEnter?.(ctxFactoryRef.current?.(obj));
          setDialogue({ state: open.state, obj });
        }
      },
      dialogueOpen: () => dialogueRef.current !== null,
      playSound: (name) => soundRef.current?.(name),
      playerX: () => pos.current.x,
      clampWalkX: (x) =>
        clamp(
          x,
          EDGE_MARGIN,
          (loopBag.current.getDef(sceneRef.current)?.width ?? SCENE_HEIGHT) - EDGE_MARGIN,
        ),
      clampWalkY: (y) => clampY(groundOf(loopBag.current.getDef(sceneRef.current)), y),
      makeCtx: () => ctxFactoryRef.current?.(seqAnchor()),
      cancelled: (run) => seqRef.current !== run,
    };

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const bag = loopBag.current;
      const cfg = bag.opts;
      const { scale, w: viewW, h: viewH } = viewRef.current;
      const sceneKey = sceneRef.current;
      const def = bag.getDef(sceneKey);
      if (!def) return;
      const player = bag.player;
      const reduced = reducedRef.current;

      // --- pacing -------------------------------------------------------------
      acc += Math.min(250, now - last);
      last = now;
      const paused =
        introRef.current ||
        overlayRef.current !== null ||
        fadingRef.current ||
        dialogueRef.current !== null;
      /**
       * Pausing throttled the loop and left everything else running. The scene
       * art animates itself with SVG SMIL — smoke, flicker, blinking lights —
       * and Blink repaints for every active `<animate>` on every frame whether
       * or not its value changed. So with a menu or a dialogue covering the
       * screen the game went on painting animations nobody could see; throttling
       * the callback saved 9% and pushed paint *up*.
       *
       * `pauseAnimations` freezes the SMIL clock without unmounting anything,
       * so the art resumes exactly where it stopped. Nothing is removed and
       * nothing is simplified — it just stops running while it is invisible.
       */
      // reduced motion stills the scene art too: the camera and actors already
      // hold, and the OS-level request does not get outvoted by the smoke
      const smilStill = paused || reduced;
      if (smilStill !== smilPausedRef.current) {
        smilPausedRef.current = smilStill;
        for (const svg of smilRootsRef.current) {
          if (smilStill) svg.pauseAnimations();
          else svg.unpauseAnimations();
        }
      }
      const minFrame = paused
        ? 1000 / Math.max(1, cfg.pausedHz)
        : cfg.maxFps > 0
          ? 1000 / cfg.maxFps
          : 0;
      if (minFrame > 0 && now - lastFrame < minFrame - 0.7) return;
      const frameMs = now - lastFrame;
      lastFrame = now;
      if (cfg.adaptiveQuality && !paused) gov.sample(frameMs, now);
      statAccum.current.frames += 1;
      statAccum.current.frameMs = frameMs;

      /**
       * Gameplay time. Everything an author times against — action frames,
       * cutscene beats, auto-walk deadlines, toast lifetimes — reads this
       * clock, and it stops when the game does. Wall-clock `now` stays for
       * pacing, input feel and the camera, which live in the player's time.
       */
      const gameNow = clock.t;

      // --- action animation (core/actionPlayer owns the timing table) ----------
      let actionFrame: string | null = null;
      const act = actionRef.current;
      if (act) {
        const wantsMove =
          keys.current.left ||
          keys.current.right ||
          keys.current.up ||
          keys.current.down ||
          padRef.current.left ||
          padRef.current.right ||
          padRef.current.up ||
          padRef.current.down;
        const step = stepAction(
          act,
          player.actions[act.id],
          gameNow,
          wantsMove,
          inputLockRef.current,
        );
        if (step.unknown && import.meta.env.DEV) {
          console.warn(`runtime: unknown action "${act.id}"`);
        }
        if (step.interrupted) {
          act.onInterrupt?.();
          bag.cancelQueuedToasts();
        }
        actionFrame = step.frame;
        if (step.done) {
          actionRef.current = null;
          setActionUi(null);
          // a press that landed mid-action fires now instead of vanishing —
          // but only when the action played out; an interrupt already means
          // the player asked for something else
          if (
            step.natural &&
            bufferedInteractRef.current > 0 &&
            now - bufferedInteractRef.current <= cfg.inputBufferMs
          ) {
            bufferedInteractRef.current = 0;
            bag.interact(nearRef.current);
          }
        }
      }
      if (
        bufferedInteractRef.current > 0 &&
        now - bufferedInteractRef.current > cfg.inputBufferMs
      ) {
        bufferedInteractRef.current = 0;
      }

      // --- gamepad (polled, edge-triggered, only once one exists) --------------
      if (cfg.gamepad && padPresentRef.current) {
        const pad = readPad(padRef.current);
        const prev = padPrev.current;
        if (pad.connected) {
          if (pad.interact && !prev.interact) {
            if (introRef.current) setIntro(false);
            else if (dialogueRef.current) dialogueAdvanceRef.current?.();
            else bag.interact(nearRef.current);
          }
          if (pad.next && !prev.next) cycleTargetRef.current?.(1);
          if (pad.prev && !prev.prev) cycleTargetRef.current?.(-1);
          if (pad.cancel && !prev.cancel && overlayRef.current !== null) setOverlay(null);
          if (pad.menu && !prev.menu && menuRef.current !== undefined) setOverlay(menuRef.current);
        }
        prev.connected = pad.connected;
        prev.left = pad.left;
        prev.right = pad.right;
        prev.interact = pad.interact;
        prev.cancel = pad.cancel;
        prev.menu = pad.menu;
        prev.next = pad.next;
        prev.prev = pad.prev;
      }

      // --- sequencer (core/sequencer owns the beats) ----------------------------
      // gated on pause and stepped on the game clock: a cutscene must not
      // advance — let alone travel — behind the pause menu
      if (seqRef.current && !fadingRef.current && !paused) {
        const running = seqRef.current;
        if (stepSequence(running, seqHost, gameNow)) {
          seqRef.current = null;
          if (running.cinematic) {
            inputLockRef.current = false;
            setCinema(false);
            camRig.current.focusX = null;
            camRig.current.zoomTarget = 1;
          }
          forcedFrameRef.current = null;
          running.resolve(true);
        }
      }

      const blocked = paused || actionFrame !== null;

      // --- simulation: fixed steps, bounded backlog, band-aware ---------------
      const p = pos.current;
      const ground = groundOf(def);
      let moving = false;
      let arrived = false;
      let simSteps = 0;
      if (blocked) {
        acc = 0;
      } else {
        const stepMs = 1000 / Math.max(15, cfg.simHz);
        while (acc >= stepMs && simSteps < cfg.maxSubsteps) {
          const dt = stepMs / 1000;
          let dirX = 0;
          let dirY = 0;
          const k = keys.current;
          const pad = padRef.current;
          const manual =
            !inputLockRef.current &&
            (k.left || k.right || k.up || k.down || pad.left || pad.right || pad.up || pad.down);
          if (manual) {
            if (k.left || pad.left) dirX -= 1;
            if (k.right || pad.right) dirX += 1;
            if (k.up || pad.up) dirY -= 1;
            if (k.down || pad.down) dirY += 1;
            if ((dirX !== 0 || dirY !== 0) && autoWalkRef.current) {
              cancelAutoWalkStatic(autoWalkRef);
            }
          } else if (autoWalkRef.current) {
            const walk = autoWalkRef.current;
            const gapX = walk.x - p.x;
            const gapY = walk.y === undefined ? 0 : clampYAt(ground, walk.x, walk.y) - p.y;
            const gap = Math.abs(gapX) + Math.abs(gapY);
            if (gap < walk.lastGap - 0.05) {
              walk.lastGap = gap;
              walk.stalledMs = 0;
            } else {
              /**
               * Stall time is SIMULATED time, not wall time.
               *
               * This loop runs at most `maxSubsteps` of `1/simHz` per frame and
               * then throws the backlog away, so on a frame that took 300 ms the
               * player advanced 42 ms worth of ground. Measuring the stall
               * against the wall clock therefore aborted walks that were not
               * stalled at all, they were merely on a scene heavy enough to drop
               * frames — and it did it non-deterministically, in the middle of
               * open platform, which is the worst possible bug to read from a
               * screenshot. Counting the substeps that failed to make progress
               * measures what the detector is actually for: the player is
               * pressed against something and the ground is not letting them
               * through.
               */
              walk.stalledMs += stepMs;
            }
            if (Math.abs(gapX) <= ARRIVE_EPS && Math.abs(gapY) <= ARRIVE_EPS) {
              const next = walk.rest.shift();
              if (next) {
                // a routed walk: the bench corner reached, aim at the next leg
                walk.x = next.x;
                walk.y = next.y;
                walk.lastGap = Number.POSITIVE_INFINITY;
                walk.stalledMs = 0;
              } else {
                arrived = true;
              }
            } else if (gameNow > walk.deadline) {
              // the old contract: a timeout still counts as "close enough"
              arrived = true;
            } else if (walk.stalledMs > WALK_STALL_MS) {
              // a blocker in the way: stop trying instead of moonwalking
              autoWalkRef.current = null;
              walk.resolve?.(false);
            } else {
              if (Math.abs(gapX) > ARRIVE_EPS) dirX = gapX > 0 ? 1 : -1;
              if (Math.abs(gapY) > ARRIVE_EPS) dirY = gapY > 0 ? 1 : -1;
            }
          }
          if (dirX !== 0 || dirY !== 0) {
            if (dirX !== 0) p.facing = dirX as 1 | -1;
            // the ground underfoot has a say: mud wades, ice hurries
            const surf = ground.zones ? speedAt(ground, p.x, p.y) : 1;
            // an auto-walk may ask for less than full pace (a slow morning)
            const pace = surf * (autoWalkRef.current?.speed ?? 1);
            const dx = dirX * bag.walkSpeed * pace * dt;
            const dy = dirY * bag.walkSpeedY * pace * dt;
            const next = stepOnGround(
              ground,
              p.x,
              p.y,
              dx,
              dy,
              EDGE_MARGIN,
              def.width - EDGE_MARGIN,
            );
            p.x = next.x;
            p.y = next.y;
            // attempted distance, not actual: pushing against an edge or a
            // blocker keeps the walk cycle alive, as it always has at the
            // scene margins. Bounded, and aligned to the cycle so wrapping
            // never skips a frame.
            p.walkDist = (p.walkDist + Math.abs(dx) + Math.abs(dy)) % walkSpan(player);
            moving = true;
          } else {
            // self-heal a stale save, a changed band, or a profile edge the
            // player is standing past while idle
            const settled = clampYAt(ground, p.x, p.y);
            if (settled !== p.y) p.y = settled;
          }
          acc -= stepMs;
          simSteps++;
          if (arrived) break;
        }
        if (simSteps >= cfg.maxSubsteps) acc = 0; // drop the backlog, don't chase it
      }
      statAccum.current.simSteps = simSteps;

      let arrivedAt: string | null = null;
      if (arrived) {
        const walk = autoWalkRef.current;
        autoWalkRef.current = null;
        arrivedAt = walk?.interactId ?? null;
        walk?.resolve?.(true);
        detectRef.current.x = Number.NaN; // force a fresh scan at the new spot
      }

      if (moving !== movingRef.current) {
        movingRef.current = moving;
        domCounters.current.commits += 1;
        setMovingUi(moving);
      }
      if (moving) lastMoveAtRef.current = now;
      if (moving) saveDirtyRef.current = true;

      // --- targeting ----------------------------------------------------------
      // facing-aware scored candidates, sticky focus, manual lock. Frozen while
      // paused so the target can't drift mid-dialogue/action; and recomputed
      // only when an input to the scoring actually moved.
      if (!blocked) {
        const detect = detectRef.current;
        const stale =
          Number.isNaN(detect.x) ||
          Math.abs(p.x - detect.x) > 0.5 ||
          Math.abs(p.y - detect.y) > 0.5 ||
          detect.facing !== p.facing ||
          detect.rev !== worldRevRef.current ||
          detect.sceneKey !== sceneKey ||
          now - detect.at > DETECT_SAFETY_MS;
        if (stale) {
          detect.x = p.x;
          detect.y = p.y;
          detect.facing = p.facing;
          detect.rev = worldRevRef.current;
          detect.sceneKey = sceneKey;
          detect.at = now;

          // `once` objects leave the pool; the filtered list is cached so this
          // isn't an allocation per frame
          const cache = objectCacheRef.current;
          const cacheKey = `${sceneKey}|${consumedRef.current.size}`;
          if (cache.key !== cacheKey) {
            cache.key = cacheKey;
            cache.list =
              consumedRef.current.size === 0
                ? def.objects
                : def.objects.filter((o) => !consumedRef.current.has(o.id));
          }

          const detected = detectObjects(cache.list, p.x, p.facing, worldRef.current, p.y);
          candidatesRef.current = detected.map((d) => d.obj);
          // manual lock while it lasts, then sticky hysteresis (core/math owns the rules)
          const resolved = resolveActiveTarget(
            detected,
            nearRef.current?.id ?? null,
            lockIdRef.current,
          );
          lockIdRef.current = resolved.lockId;
          nearRef.current = resolved.active;
          bag.pushTargets(candidatesRef.current, resolved.active?.id ?? null);
        }
      }

      if (arrivedAt) {
        const target = candidatesRef.current.find((o) => o.id === arrivedAt);
        if (target) bag.interact(target);
      }

      // --- camera (core/cameraRig owns the curves) ------------------------------
      const rig = camRig.current;
      const camView = stepCamRig(rig, {
        frameMs,
        now,
        reduced,
        moving,
        playerX: p.x,
        facing: p.facing,
        sceneW: def.width,
        scale,
        viewW,
        viewH,
      });
      const { panX, panY, zoom, originX, originY, scrollable } = camView;
      camStateRef.current.pan = panX;
      camStateRef.current.panY = panY;
      camStateRef.current.zoom = zoom;
      camStateRef.current.originX = originX;
      camStateRef.current.originY = originY;
      camStateRef.current.scale = scale;

      const dom = domCache.current;
      const sceneEl = sceneElRef.current;
      if (sceneEl) {
        // origin only matters while zoomed, so normal play writes it never
        const originT = zoom === 1 ? "" : `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
        if (originT !== dom.origin) {
          dom.origin = originT;
          sceneEl.style.transformOrigin = originT === "" ? "0 0" : originT;
          domCounters.current.writes += 1;
        }
        /**
         * The camera, snapped to whole device pixels.
         *
         * The idle "breath" is a sine of about a third of a pixel. As a float
         * it produced a different transform string on literally every frame —
         * measured at 60 writes a second with the player standing still — so
         * the `!== dom.scene` guard below never once fired and the compositor
         * re-laid the scene forever. Quantizing costs nothing and is *more*
         * correct here anyway: this is a `crispEdges` pixel-art game, and a
         * camera parked on a fractional pixel is what makes a still frame
         * shimmer. The parallax write below has always rounded; this is the
         * same rule applied to the layer that carries everything else.
         */
        const dpr = dprRef.current || 1;
        const snap = (v: number) => Math.round(v * dpr) / dpr;
        const px = snap(panX);
        const py = snap(panY);
        const sceneT =
          zoom === 1
            ? `translate3d(${px}px, ${py}px, 0)`
            : `translate3d(${px}px, ${py}px, 0) scale(${zoom.toFixed(4)})`;
        const sceneMoved = sceneT !== dom.scene;
        if (sceneMoved) {
          dom.scene = sceneT;
          sceneEl.style.transform = sceneT;
          domCounters.current.writes += 1;
        } else {
          domCounters.current.skips += 1;
        }
        /**
         * GPU promotion follows whether the transform is actually changing,
         * not whether the player is holding a key.
         *
         * It used to be released 700 ms after the last input — which, with a
         * camera that moved every frame forever, meant the one element
         * guaranteed to mutate was the one denied a compositor layer. Now a
         * settled camera really is settled, so releasing the layer is safe,
         * and anything that does move keeps it.
         */
        const busy =
          sceneMoved ||
          moving ||
          fadingRef.current ||
          seqRef.current !== null ||
          now < rig.shakeUntil ||
          zoom !== rig.zoomTarget ||
          now - lastMoveAtRef.current < IDLE_PROMOTE_MS;
        promote(sceneEl, busy, promoteCache.current);

        /**
         * Parallax. Written straight onto the layer elements, quantized to
         * whole logical pixels so a settled camera stops touching them at all.
         *
         * This used to publish a `--cam` custom property on the scene root and
         * let the layers read it in a `calc()`. Custom properties inherit, so
         * that invalidated the computed style of every node in the scene on
         * every pan — `UpdateLayoutTree` measured 326 ms standing still and
         * 1572 ms walking, which was the frame rate.
         */
        const camV = scrollable ? Math.round(-panX / scale) : 0;
        if (camV !== dom.cam) {
          dom.cam = camV;
          for (const layer of parallaxRef.current) {
            layer.el.style.transform = `translateX(${(camV * layer.shift).toFixed(2)}px)`;
          }
          domCounters.current.writes += parallaxRef.current.length;
        }
        // the slice of world on screen, for <CullBox> and anything else that
        // shrinks its work to what is actually in frame
        const visX0 = (originX + (0 - originX - panX) / zoom) / scale;
        const visX1 = (originX + (viewW - originX - panX) / zoom) / scale;
        const visV = `${Math.floor(visX0)} ${Math.ceil(visX1)}`;
        if (visV !== dom.vis) {
          dom.vis = visV;
          band.set(visX0, visX1);
        }
      }

      // player transform + the monologue anchor riding above their head
      const bandDepth = hasDepth(ground);
      const playerEl = playerElRef.current;
      if (playerEl) {
        const px = (p.x - player.width / 2) * scale;
        const py = (p.y - player.height) * scale;
        const playerT = `translate3d(${px}px, ${py}px, 0) scaleX(${p.facing})`;
        if (playerT !== dom.player) {
          dom.player = playerT;
          playerEl.style.transform = playerT;
          domCounters.current.writes += 1;
        } else {
          domCounters.current.skips += 1;
        }
        // depth sort: in a band scene the nearer figure paints in front
        const playerZ = bandDepth ? String(Z_BAND_BASE + Math.round(p.y)) : String(Z_PLAYER_FLAT);
        if (playerZ !== dom.playerZ) {
          dom.playerZ = playerZ;
          playerEl.style.zIndex = playerZ;
          domCounters.current.writes += 1;
        }
      }
      const monoEl = monologueElRef.current;
      if (monoEl) {
        const monoT = `translate3d(${p.x * scale}px, ${(p.y - player.height - 4) * scale}px, 0)`;
        if (monoT !== dom.mono) {
          dom.mono = monoT;
          monoEl.style.transform = monoT;
          domCounters.current.writes += 1;
        }
      }

      // --- player frame ---------------------------------------------------------
      // core/gait owns the legs: the cycle frame by distance, the push-off on a
      // start or a turn, the settle through the pass on a stop. It is skipped
      // under an action so a walk-away interrupt does not "start" a walk under
      // the abort frames and then settle once they are gone.
      let gaitFrame: string | null = null;
      if (!actionFrame) {
        const gait = stepGait(gaitRef.current, player, p.walkDist, moving, p.facing, now);
        p.walkDist = gait.walkDist;
        gaitFrame = gait.frame;
      } else {
        gaitRef.current.moving = false;
        gaitRef.current.settleFrame = null;
      }
      // core/talkBrain owns him for the length of a conversation: the game
      // clock is stopped under a dialogue, so this runs on `now`
      let talkFrame: string | null = null;
      const dlg = dialogueRef.current;
      if (dlg && !actionFrame && !gaitFrame) {
        const line = dlg.state.lines[dlg.state.lineIndex];
        const atChoices =
          dlg.state.lineDone &&
          dlg.state.lineIndex === dlg.state.lines.length - 1 &&
          offeredChoices(dlg.state.tree.nodes[dlg.state.nodeId], () =>
            ctxFactoryRef.current?.(dlg.obj),
          ).length > 0;
        const his = atChoices || (line !== undefined && !line.speaker);
        talkFrame = stepTalk(talkRef.current, now, his);
        resetIdle(idleRef.current);
      } else {
        resetTalk(talkRef.current);
      }
      // core/idleBrain owns the standing-about behaviour
      let idleFrame = "stand";
      if (!moving && !actionFrame && !gaitFrame && !talkFrame) {
        // a cutscene has him standing where it put him: he breathes, he does
        // not stretch or look over his shoulder in the middle of a line
        idleFrame = stepIdle(
          idleRef.current,
          now,
          paused || seqRef.current !== null,
          Boolean(def.idleLean || player.idleLean),
        );
      } else {
        resetIdle(idleRef.current);
      }
      let frame = forcedFrameRef.current ?? actionFrame ?? gaitFrame ?? talkFrame ?? idleFrame;
      // the face layer: the lids have their own clock, and close on whatever
      // the body is showing — walking, talking, lifting — not only at rest.
      // A held frame is for looking at, so it keeps its eyes open.
      if (forcedFrameRef.current) resetFace(faceRef.current, now);
      else if (stepFace(faceRef.current, now)) frame = blinkFrame(player.frames, frame);

      {
        const live = liveRef.current;
        if (live.frame !== frame) {
          live.prevFrame = live.frame;
          live.frame = frame;
        }
        const running = actionRef.current;
        const rdef = running ? player.actions[running.id] : null;
        live.action = running?.id ?? null;
        live.actionProgress = rdef
          ? Math.min(
              1,
              (gameNow - (running?.start ?? gameNow)) /
                (rdef.frames.length * rdef.frameMs * rdef.loops || 1),
            )
          : 0;
        live.source = forcedFrameRef.current
          ? "forced"
          : actionFrame
            ? "action"
            : gaitFrame
              ? "walk"
              : talkFrame
                ? "talk"
                : "idle";
        live.moving = moving;
        live.target = nearRef.current?.id ?? null;
        live.surface = ground.zones ? surfaceAt(ground, p.x, p.y) : null;
        live.facing = p.facing as 1 | -1;
        live.x = Math.round(p.x);
        live.y = Math.round(p.y);
        live.scene = sceneRef.current;
      }

      const atlasSprite = bag.atlas;
      if (atlasSprite) {
        // one node, one blit, and only when the frame or the size changed
        if (atlasSprite.draw(frame, player.width * scale, player.height * scale, dprRef.current)) {
          domCounters.current.writes += 1;
          dom.frame = frame;
        } else {
          domCounters.current.skips += 1;
        }
      } else {
        if (frameRefs.current[frame] === undefined && cfg.lazyFrames) {
          // not mounted yet: ask for it, keep showing the current frame
          requestFrameRef.current?.(frame);
          frame = dom.frame || frame;
        }
        // touch exactly two nodes on a frame switch instead of all ~50 every tick
        if (frame !== dom.frame) {
          const prevEl = frameRefs.current[dom.frame];
          if (prevEl) prevEl.style.display = "none";
          const nextEl = frameRefs.current[frame];
          if (nextEl) nextEl.style.display = "";
          dom.frame = frame;
          domCounters.current.writes += 1;
        } else {
          domCounters.current.skips += 1;
        }
      }

      // --- actors -------------------------------------------------------------
      const actors = def.actors;
      if (actors && actors.length > 0) {
        const visX0 = (originX + (0 - originX - panX) / zoom) / scale;
        const visX1 = (originX + (viewW - originX - panX) / zoom) / scale;
        for (const actor of actors) {
          const el = actorElRefs.current[actor.id];
          if (!el) continue;
          let st = actorStateRef.current[actor.id];
          if (!st) {
            st = {
              x: actor.x,
              y: actor.y ?? FLOOR_Y,
              facing: actor.facing ?? 1,
              dist: 0,
              dir: 1,
              pauseUntil: 0,
              frame: actor.idleFrame ?? "stand",
              /**
               * Read off the element, not assumed. Travel resets this state
               * table while a same-scene travel KEEPS the elements — and the
               * fade's bogus camera bounds may have display:none'd them a
               * frame earlier. A fresh state claiming "shown" would then agree
               * with the culling check forever and the write below would never
               * fire: every actor in the scene stayed invisible after the
               * second arrival. The element knows; trust the element.
               */
              hidden: el.style.display === "none",
              z: Number.NaN,
            };
            actorStateRef.current[actor.id] = st;
          }
          const shown = actor.visible ? actor.visible(worldRef.current) : true;
          // off-camera actors cost one bounds check and nothing else
          const onCamera =
            shown && st.x + actor.width >= visX0 - 48 && st.x - actor.width <= visX1 + 48;
          if (st.hidden !== !onCamera) {
            st.hidden = !onCamera;
            el.style.display = onCamera ? "" : "none";
          }
          if (!onCamera) continue;

          let actorMoving = false;
          if (!blocked) {
            const dt = frameMs / 1000;
            const custom = actor.step?.(clock.t, worldRef.current);
            if (custom) {
              if (custom.x !== undefined) {
                actorMoving = Math.abs(custom.x - st.x) > 0.01;
                st.x = custom.x;
              }
              if (custom.y !== undefined) {
                if (Math.abs(custom.y - st.y) > 0.01) actorMoving = true;
                st.y = clampYAt(ground, st.x, custom.y);
              }
              if (custom.facing) st.facing = custom.facing;
              if (custom.frame) st.frame = custom.frame;
            } else if (actor.patrol) {
              const { from, to, speed = 20, pauseMs = 1200 } = actor.patrol;
              if (now >= st.pauseUntil) {
                st.x += st.dir * speed * dt;
                st.dist += speed * dt;
                st.facing = st.dir;
                actorMoving = true;
                if (st.dir > 0 && st.x >= Math.max(from, to)) {
                  st.x = Math.max(from, to);
                  st.dir = -1;
                  st.pauseUntil = now + pauseMs;
                } else if (st.dir < 0 && st.x <= Math.min(from, to)) {
                  st.x = Math.min(from, to);
                  st.dir = 1;
                  st.pauseUntil = now + pauseMs;
                }
              }
            }
          }
          if (!actor.step) {
            const cycle = actor.walkCycle;
            st.frame =
              actorMoving && cycle && cycle.length > 0
                ? cycle[Math.floor(st.dist / 16) % cycle.length]
                : (actor.idleFrame ?? "stand");
          }
          const baseY = st.y - actor.height;
          const t = `translate3d(${(st.x - actor.width / 2) * scale}px, ${baseY * scale}px, 0) scaleX(${st.facing})`;
          if (el.dataset.t !== t) {
            el.dataset.t = t;
            el.style.transform = t;
            domCounters.current.writes += 1;
          }
          // depth sort against the player and each other in band scenes
          const z = bandDepth ? Z_BAND_BASE + Math.round(st.y) : (actor.z ?? Z_ACTOR_FLAT);
          if (z !== st.z) {
            st.z = z;
            el.style.zIndex = String(z);
            domCounters.current.writes += 1;
          }
          const shownKey = `${actor.id}:${st.frame}`;
          if (el.dataset.frame !== st.frame) {
            const prevEl = actorFrameRefs.current[`${actor.id}:${el.dataset.frame ?? ""}`];
            if (prevEl) prevEl.style.display = "none";
            const nextEl = actorFrameRefs.current[shownKey];
            if (nextEl) nextEl.style.display = "";
            el.dataset.frame = st.frame;
          }
        }
      }

      // --- fx sweep + clock ---------------------------------------------------
      if (pool.sweep(clock.t)) {
        domCounters.current.commits += 1;
        setFx(pool.snapshot() as unknown as FxInstance[]);
      }
      clock.advance(paused ? 0 : frameMs);

      // --- park when there is nothing left to animate -------------------------
      if (
        cfg.pauseWhenHidden &&
        typeof document !== "undefined" &&
        document.hidden &&
        !fadingRef.current
      ) {
        park();
        return;
      }

      // --- debug sampling (4Hz, only when the HUD is up) ----------------------
      if (debugRef.current) {
        const sa = statAccum.current;
        if (now - sa.since >= 250) {
          const bandNow = band.get();
          setStats({
            fps: Math.round((sa.frames * 1000) / (now - sa.since)),
            frameMs: Math.round(sa.frameMs * 100) / 100,
            emaMs: Math.round(gov.ema * 100) / 100,
            simSteps: sa.simSteps,
            quality: gov.tier,
            fxAlive: pool.aliveCount,
            candidates: candidatesRef.current.length,
            band: bandNow,
            domWrites: domCounters.current.writes,
            domSkips: domCounters.current.skips,
            commits: domCounters.current.commits,
            alarms: clock.pending,
            timers: timersRef.current.size,
            heapMb: heapMb(),
            spriteMode: bag.atlas ? "canvas" : "dom",
            mountedFrames: Object.keys(frameRefs.current).length,
            live: { ...liveRef.current },
          });
          sa.frames = 0;
          sa.since = now;
        }
      }
    }

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      parkRef.current = () => {};
      wakeRef.current = () => {};
    };
  }, []);

  // prewarm the rest of the sprite sheet once the browser is idle
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot warmup
  useEffect(() => {
    if (atlas || !opts.lazyFrames) return;
    const keys = Object.keys(player.frames);
    if (keys.length === mountedFrames.size) return;
    return idle(() => setMountedFrames(new Set(keys)));
  }, [atlas, player.frames, opts.lazyFrames]);

  // --- teardown ---------------------------------------------------------------------------
  useEffect(() => {
    const timers = timersRef.current;
    const clock = clockRef.current;
    return () => {
      timers.disposeAll();
      clock.clear();
      queuedToasts.current = [];
      fxPoolRef.current.clear();
    };
  }, []);

  // --- imperative handle -------------------------------------------------------------------
  // Built from a ref bag and handed over once: a debug stats sample must never
  // re-fire onReady, and a new callback identity must not either.
  /** The rig, for the api — read through a ref so swapping it does not respawn the handle. */
  const playerRef = useRef(player);
  playerRef.current = player;
  const apiBag = useRef({
    interact,
    travel,
    walkTo,
    runSequence,
    updateWorld,
    saveNow,
    getDef,
    startAction,
  });
  apiBag.current = {
    interact,
    travel,
    walkTo,
    runSequence,
    updateWorld,
    saveNow,
    getDef,
    startAction,
  };

  useEffect(() => {
    if (!config.onReady) return;
    const api: RuntimeApi<W> = {
      interact: (id) => {
        const bag = apiBag.current;
        const obj = id
          ? (candidatesRef.current.find((o) => o.id === id) ??
            bag.getDef(sceneRef.current)?.objects.find((o) => o.id === id) ??
            null)
          : nearRef.current;
        if (obj) bag.interact(obj);
      },
      travel: (scene, spawnX, spawnY) => apiBag.current.travel(scene, spawnX, spawnY),
      walkTo: (x, y) => apiBag.current.walkTo(x, y === undefined ? undefined : { y }),
      runSequence: (steps, o) => apiBag.current.runSequence(steps, o),
      getWorld: () => worldRef.current,
      updateWorld: (patch) => apiBag.current.updateWorld(patch),
      getLive: () => ({ ...liveRef.current }),
      startAction: (id: string) => {
        if (playerRef.current.actions[id]) apiBag.current.startAction(id);
      },
      stopAction: () => {
        actionRef.current = null;
        setActionUi(null);
      },
      holdFrame: (frame: string | null) => {
        forcedFrameRef.current = frame && playerRef.current.frames[frame] ? frame : null;
      },
      getStats: () =>
        statsRef.current ?? {
          fps: 0,
          frameMs: 0,
          emaMs: govRef.current.ema,
          simSteps: 0,
          quality: govRef.current.tier,
          fxAlive: fxPoolRef.current.aliveCount,
          candidates: candidatesRef.current.length,
          band: bandRef.current.get(),
          domWrites: domCounters.current.writes,
          domSkips: domCounters.current.skips,
          commits: domCounters.current.commits,
          alarms: clockRef.current.pending,
          timers: timersRef.current.size,
          heapMb: heapMb(),
          spriteMode: atlasRef.current ? "canvas" : "dom",
          mountedFrames: Object.keys(frameRefs.current).length,
          live: { ...liveRef.current },
        },
      saveNow: () => apiBag.current.saveNow(),
    };
    config.onReady(api);
  }, [config.onReady]);

  // --- render ---------------------------------------------------------------------------------------
  const { scale } = view;
  const activeTarget = targets.activeId
    ? (targets.list.find((o) => o.id === targets.activeId) ?? null)
    : null;
  const darkness = def.darkness?.(phase, world) ?? 0;
  const SceneArt = def.Component;
  const Foreground = def.Foreground;
  const Effects = def.Effects;

  // The scene artwork is hundreds of rects; keyboard INP dies if it
  // reconciles on every toast/near/action update. Repaint it only when
  // the world, phase or scene actually change — or, with def.artKey, only
  // when the inputs the art really reads change.
  const artKey = def.artKey ? def.artKey(world, phase) : null;
  const artWorld = artKey === null ? world : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: artKey stands in for world when provided
  const sceneArtNode = useMemo(
    () => (
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${def.width} ${SCENE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <SceneArt world={worldRef.current} phase={phase} />
      </svg>
    ),
    [SceneArt, def.width, artWorld, artKey, phase],
  );
  /**
   * Re-find the scene's parallax layers whenever the artwork remounts. Doing
   * it here rather than in the frame loop keeps a `querySelectorAll` out of
   * the hot path; a scene change is the only thing that can invalidate it.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the artwork node is the trigger, not an input
  useEffect(() => {
    const el = sceneElRef.current;
    parallaxRef.current = el
      ? Array.from(el.querySelectorAll<SVGElement>("[data-parallax]")).map((node) => ({
          el: node,
          shift: Number(node.dataset.parallax ?? 0),
        }))
      : [];
    smilRootsRef.current = el ? Array.from(el.querySelectorAll("svg")) : [];
    // a scene that mounts while the game is paused must arrive paused too
    if (smilPausedRef.current) for (const svg of smilRootsRef.current) svg.pauseAnimations();
    domCache.current.cam = Number.NaN;
  }, [sceneArtNode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the world through a ref, but must recompute when the art key says the art changed
  const foregroundNode = useMemo(
    () => (Foreground ? <Foreground world={worldRef.current} phase={phase} /> : null),
    [Foreground, artWorld, artKey, phase],
  );
  const dialogueOpen = dialogue !== null;
  /**
   * Stable per-(dialogue, world) ctx thunk for the box. Inline it and the
   * box's choices memo is dead — every runtime commit re-runs every author
   * predicate. Keyed on `world` so a mid-conversation world write still
   * re-evaluates `when`/`locked` exactly as the fresh-per-render contract
   * promised.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: world keys freshness, not a read
  const dialogueMakeCtx = useMemo(
    () => (dialogue ? () => makeCtx(dialogue.obj) as unknown : () => ({}) as unknown),
    [dialogue, makeCtx, world],
  );
  /**
   * What the character on the other side of the conversation is doing. Derived
   * from the line on screen so a shrug lands on the sentence it belongs to,
   * and published through context so every `NpcActor` in the scene can see it
   * without the scene threading it down by hand.
   */
  const speaking = useMemo<SpeakingState | null>(() => {
    if (!dialogue) return null;
    const line = dialogue.state.lines[dialogue.state.lineIndex];
    return {
      objId: dialogue.obj?.id ?? "__seq__",
      speaker: line?.speaker,
      act: line?.act,
      mood: line?.mood,
    };
  }, [dialogue]);
  const effectsNode = useMemo(
    () =>
      Effects ? (
        <Effects
          world={world}
          phase={phase}
          fx={fx}
          scale={scale}
          actionUi={actionUi}
          moving={movingUi}
          dialogueOpen={dialogueOpen}
        />
      ) : null,
    [Effects, world, phase, fx, scale, actionUi, movingUi, dialogueOpen],
  );
  const playerNode = useMemo(
    () =>
      atlas ? (
        <canvas ref={playerCanvasRef} className="block" style={{ imageRendering: "pixelated" }} />
      ) : (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${player.width} ${player.height}`}
        >
          {Object.keys(player.frames)
            .filter((key) => mountedFrames.has(key))
            .map((key) => (
              <g
                key={key}
                ref={(el) => {
                  frameRefs.current[key] = el;
                }}
                style={{ display: key === "stand" ? "" : "none" }}
              >
                <PixelSprite map={player.frames[key]} palette={palette} cell={player.cell} />
              </g>
            ))}
        </svg>
      ),
    [atlas, player, palette, mountedFrames],
  );

  const actorsNode = useMemo(() => {
    const actors = (def.actors ?? []) as ActorDef<W>[];
    if (actors.length === 0) return null;
    return actors.map((actor) => (
      <div
        key={actor.id}
        ref={(el) => {
          actorElRefs.current[actor.id] = el;
        }}
        className="pixelated absolute top-0 left-0"
        style={{
          width: actor.width * scale,
          height: actor.height * scale,
          zIndex: actor.z ?? 5,
        }}
      >
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${actor.width} ${actor.height}`}
        >
          {actorFrameNames(actor).map((key) => (
            <g
              key={key}
              ref={(el) => {
                actorFrameRefs.current[`${actor.id}:${key}`] = el;
              }}
              style={{ display: key === (actor.idleFrame ?? "stand") ? "" : "none" }}
            >
              <PixelSprite map={actor.frames[key]} palette={actor.palette} cell={actor.cell} />
            </g>
          ))}
        </svg>
      </div>
    ));
  }, [def.actors, scale]);

  // a fresh playerNode mounts with "stand" visible — drop the cached frame so
  // the next tick re-applies whatever frame is actually current
  // biome-ignore lint/correctness/useExhaustiveDependencies: playerNode identity marks the remount
  useEffect(() => {
    domCache.current.frame = "";
    atlas?.invalidate();
    if (atlas) atlas.attach(playerCanvasRef.current);
  }, [playerNode, atlas]);

  const describe =
    typeof def.describe === "function" ? def.describe(world) : (def.describe ?? null);

  return (
    <div className="fixed inset-0 flex touch-none select-none flex-col bg-black font-mono">
      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden"
        onPointerDown={pointerWalk}
        onPointerUp={pointerStop}
        onPointerLeave={pointerStop}
        onPointerCancel={pointerStop}
      >
        <BandProvider store={bandRef.current}>
          <AnimationGateProvider running={!dialogueOpen && overlay === null && !intro}>
            <SpeakingProvider value={speaking}>
              <div
                ref={sceneElRef}
                className="absolute top-0 left-0"
                style={{
                  width: def.width * scale,
                  height: SCENE_HEIGHT * scale,
                  contain: "layout style",
                }}
              >
                {sceneArtNode}

                {effectsNode}

                {actorsNode}

                {/* player */}
                <div
                  ref={playerElRef}
                  data-player=""
                  className="pixelated absolute top-0 left-0"
                  style={{
                    width: player.width * scale,
                    height: player.height * scale,
                    zIndex: 10,
                    willChange: "transform",
                  }}
                >
                  {playerNode}
                </div>

                {/* the character's inner monologue, spoken over their head —
                    above every depth-sorted figure (band z tops out ~200) */}
                <div
                  ref={monologueElRef}
                  className="absolute top-0 left-0"
                  style={{ willChange: "transform", zIndex: Z_FOREGROUND + 50 }}
                >
                  {config.renderMonologue ? (
                    config.renderMonologue(toast && !intro && !overlay ? toast : null, scale)
                  ) : (
                    <AnimatePresence>
                      {toast && !intro && !overlay ? (
                        <motion.div
                          key={toast.id}
                          aria-hidden="true"
                          className="-translate-x-1/2 pointer-events-none absolute max-w-64 border border-parchment/25 bg-black/85 px-2 py-1 text-center font-mono text-parchment/90"
                          style={{
                            transform: "translate(-50%, -100%)",
                            fontSize: Math.max(10, view.scale * 3.4),
                            lineHeight: 1.35,
                            width: "max-content",
                          }}
                          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: reduced ? 0 : -4 }}
                          transition={{ duration: reduced ? 0.08 : 0.2 }}
                        >
                          {toast.text}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  )}
                </div>

                {/* the Foreground CONTRACT: in front of the player, always. The
                player div carries zIndex 10 (or 20+feetY in a ground-band
                scene, which tops out near 200), so an unstyled scene
                Foreground (z auto) would paint behind him — this wrapper makes
                the promise true for every scene without each one remembering
                a z-index. */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ zIndex: Z_FOREGROUND }}
                >
                  {foregroundNode}
                </div>

                {/* target markers — ride the world above the focused object;
                    a cinematic has nothing to point at */}
                {!intro && !overlay && !dialogue && !cinema
                  ? opts.showAllMarkers
                    ? targets.list.map((obj) => (
                        <TargetMarker key={obj.id} obj={obj} scale={scale} />
                      ))
                    : activeTarget && <TargetMarker obj={activeTarget} scale={scale} />
                  : null}

                {/* darkness (day phase / lights) */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[#0a1230] transition-opacity duration-500"
                  style={{ opacity: darkness, mixBlendMode: "multiply" }}
                />
              </div>
            </SpeakingProvider>
          </AnimationGateProvider>
        </BandProvider>

        {/* HUD — and none of it while a cinematic has the screen */}
        {!intro && !overlay && !cinema ? (
          <>
            {config.renderHud?.(scene, world, phase, setOverlay)}
            {!dialogue ? (
              <InteractPrompt
                targets={targets.list}
                activeId={targets.activeId}
                pulse={promptPulse}
                label={objectLabel}
                verb={config.objectVerb}
                switchLabel={config.promptSwitchLabel?.()}
                onInteract={() => interact(nearRef.current)}
                onSelect={selectTarget}
              />
            ) : null}
            {config.renderExtras?.()}

            {/* touch controls */}
            <div
              className="absolute right-0 bottom-0 left-0 hidden justify-between p-4 [@media(pointer:coarse)]:flex"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              {bandHasDepth ? (
                /* a d-pad when the scene has depth: ▲ over ◀ ▼ ▶ */
                <div className="grid grid-cols-3 gap-1">
                  <div />
                  <WalkButton
                    label="Walk up"
                    glyph="▲"
                    dir="up"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                  <div />
                  <WalkButton
                    label="Walk left"
                    glyph="◀"
                    dir="left"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                  <WalkButton
                    label="Walk down"
                    glyph="▼"
                    dir="down"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                  <WalkButton
                    label="Walk right"
                    glyph="▶"
                    dir="right"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                </div>
              ) : (
                <div className="flex gap-3">
                  <WalkButton
                    label="Walk left"
                    glyph="◀"
                    dir="left"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                  <WalkButton
                    label="Walk right"
                    glyph="▶"
                    dir="right"
                    press={pressWalk}
                    stop={pointerStop}
                  />
                </div>
              )}
              <button
                type="button"
                aria-label="Interact"
                className="h-14 w-14 border border-signal/50 bg-black/40 text-signal text-xl active:bg-signal/20"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => interact(nearRef.current)}
              >
                ●
              </button>
            </div>
          </>
        ) : null}

        {/* dialogue */}
        {dialogue ? (
          <DialogueBox
            state={dialogue.state}
            makeCtx={dialogueMakeCtx}
            /* the HUD is built at u=3; the panel matches it rather than
               scaling with the viewport, or it reads lighter than the plates
               sitting beside it */
            u={3}
            onAdvance={dialogueAdvance}
            onChoose={dialogueChoose}
          />
        ) : null}

        {/* overlays */}
        <AnimatePresence>
          {overlay !== null && config.renderOverlay
            ? config.renderOverlay(overlay, () => setOverlay(null), world, updateWorld)
            : null}
        </AnimatePresence>

        {/* cinematic bars */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-black transition-[height] duration-500"
          style={{ height: cinema ? "9%" : 0 }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-black transition-[height] duration-500"
          style={{ height: cinema ? "9%" : 0 }}
        />

        {/* screen flash */}
        {flashFx ? (
          <motion.div
            key={flashFx.id}
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: flashFx.color }}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: flashFx.ms / 1000, ease: "easeOut" }}
          />
        ) : null}

        {/* travel / blackout fade */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity"
          style={{ opacity: fade.on ? 1 : 0, transitionDuration: `${fade.ms}ms` }}
        />

        {/* intro splash */}
        {intro && config.renderIntro ? config.renderIntro(() => setIntro(false)) : null}

        {/* what just happened, for screen readers */}
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only absolute h-px w-px overflow-hidden"
        />
        {describe ? <p className="sr-only absolute h-px w-px overflow-hidden">{describe}</p> : null}

        {/* debug HUD */}
        {debugOn && stats
          ? (config.renderDebug?.(stats) ?? (
              <div className="pointer-events-none absolute top-2 left-2 z-50 space-y-0.5 border border-parchment/20 bg-black/80 px-2 py-1 text-[10px] text-parchment/80 leading-tight">
                <div>
                  {stats.fps} fps · {stats.frameMs}ms (ema {stats.emaMs}) · q:{stats.quality}
                </div>
                <div>
                  sim {stats.simSteps}/frame · sprite {stats.spriteMode} · frames{" "}
                  {stats.mountedFrames}
                </div>
                <div>
                  dom w{stats.domWrites} / skip {stats.domSkips} · commits {stats.commits}
                </div>
                <div>
                  fx {stats.fxAlive} · near {stats.candidates} · alarms {stats.alarms} · timers{" "}
                  {stats.timers}
                </div>
                <div>
                  band {Math.round(stats.band.x0)}–{Math.round(stats.band.x1)}
                  {stats.heapMb === null ? "" : ` · heap ${stats.heapMb}MB`}
                </div>
                {/* what the character is actually doing. This was sampled and
                    plumbed all the way here and then not shown, which is why a
                    walk cycle with a standing pose in it survived so long: you
                    could not see the frame you were looking at. */}
                <div className="text-signal/80">
                  {stats.live.frame}
                  {stats.live.prevFrame === stats.live.frame ? "" : ` ← ${stats.live.prevFrame}`} ·{" "}
                  {stats.live.source}
                </div>
                <div>
                  {stats.live.action
                    ? `act ${stats.live.action} ${Math.round(stats.live.actionProgress * 100)}%`
                    : stats.live.moving
                      ? "walking"
                      : "idle"}{" "}
                  · {stats.live.scene} @{stats.live.x},{stats.live.y} · face{" "}
                  {stats.live.facing > 0 ? "→" : "←"}
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

/** One touch walk key. Press-and-hold; releasing (or sliding off) stops. */
function WalkButton({
  label,
  glyph,
  dir,
  press,
  stop,
}: {
  label: string;
  glyph: string;
  dir: "left" | "right" | "up" | "down";
  press: (dir: "left" | "right" | "up" | "down") => void;
  stop: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="h-14 w-14 border border-parchment/30 bg-black/40 text-parchment text-xl active:bg-parchment/20"
      onPointerDown={(e) => {
        e.stopPropagation();
        press(dir);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      {glyph}
    </button>
  );
}

/** Cancel an in-flight auto-walk from anywhere, resolving its promise as false. */
function cancelAutoWalkStatic(ref: { current: { resolve?: (ok: boolean) => void } | null }): void {
  const walk = ref.current;
  if (!walk) return;
  ref.current = null;
  walk.resolve?.(false);
}

/** A fresh auto-walk record, with the stall detector armed. */
function newAutoWalk(
  x: number,
  y: number | undefined,
  deadline: number,
  interactId: string | null,
  resolve?: (ok: boolean) => void,
  rest?: { x: number; y: number }[],
  speed = 1,
) {
  return {
    x,
    y,
    deadline,
    interactId,
    resolve,
    /** fraction of the normal walk speed — a cutscene can take its time */
    speed,
    lastGap: Number.POSITIVE_INFINITY,
    stalledMs: 0,
    /** waypoints still to walk after (x,y) — a route around furniture */
    rest: rest ?? [],
  };
}
