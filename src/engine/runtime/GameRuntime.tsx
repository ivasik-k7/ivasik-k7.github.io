import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WALK_SPEED,
  EDGE_MARGIN,
  FLOOR_Y,
  SCENE_HEIGHT,
  STICKY_MARGIN,
  TRAVEL_FADE_IN_DELAY_MS,
  TRAVEL_FADE_OUT_MS,
  TRAVEL_SWITCH_AT_MS,
} from "../core/constants";
import { cameraTransform, detectObjects, viewportScale } from "../core/math";
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
  QualityTier,
  RuntimeApi,
  RuntimeConfig,
  RuntimeCtx,
  RuntimeObject,
  RuntimeSceneDef,
  RuntimeStats,
  SavePayload,
  SeqStep,
} from "../core/runtime-types";
import type { AnyWorld, FxInstance, InteractionCtx, SceneObject } from "../core/types";
import {
  advanceDialogue,
  chooseDialogue,
  type DialogueState,
  type DialogueTree,
  dialogueAtChoices,
  openDialogue,
} from "../systems/dialogue";
import { loadGame, saveGame } from "../systems/save";
import { DialogueBox } from "../ui/DialogueBox";
import { InteractPrompt, TargetMarker } from "../ui/InteractPrompt";
import { PixelSprite } from "../ui/PixelSprite";

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
const QUALITY_VAR: Record<QualityTier, string> = { low: "0", medium: "1", high: "2" };

type ActorRuntime = {
  x: number;
  facing: 1 | -1;
  dist: number;
  dir: 1 | -1;
  pauseUntil: number;
  frame: string;
  hidden: boolean;
};

type SeqRun<W extends AnyWorld> = {
  steps: SeqStep<W>[];
  i: number;
  entered: boolean;
  enteredAt: number;
  deadline: number;
  cinematic: boolean;
  resolve: (ok: boolean) => void;
};

export function GameRuntime<W extends AnyWorld>({ config }: { config: RuntimeConfig<W> }) {
  const { scenes, player, handlers, objectLabel } = config;
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
    const raw = loadGame<W>(persist.key, persist.version) as SavePayload<W> | null;
    if (raw && persist.migrate) {
      return (persist.migrate(raw, persist.version) ?? null) as SavePayload<W> | null;
    }
    return raw;
  });

  // --- rare React state -------------------------------------------------------
  const [scene, setScene] = useState(restored?.scene ?? config.start.scene);
  const [world, setWorld] = useState<W>(restored?.world ?? config.initialWorld);
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
    x: restored?.x ?? config.start.x,
    facing: (restored?.facing ?? 1) as 1 | -1,
    walkDist: 0,
  });
  const keys = useRef({ left: false, right: false });
  const padRef = useRef<PadState>(newPadState());
  const padPrev = useRef<PadState>(newPadState());
  const padPresentRef = useRef(false);
  const actionRef = useRef<{ id: string; start: number; onInterrupt?: () => void } | null>(null);
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
  const camRig = useRef({
    x: Number.NaN, // NaN = snap to target on the first frame / after travel
    look: 0,
    bobT: 0,
    swayT: 0,
    shakeMag: 0,
    shakeUntil: 0,
    focusX: null as number | null,
    zoom: 1,
    zoomTarget: 1,
    zoomRate: 3.5,
  });
  const camStateRef = useRef({ pan: 0, zoom: 1, originX: 0, scale: 3 });
  const viewRef = useRef(view);
  const gestureFired = useRef(false);
  // last written DOM values — the tick skips writes (and the repaints/composites
  // they trigger) whenever a frame resolves to the same strings as the last one
  const domCache = useRef({
    scene: "",
    origin: "",
    cam: "",
    vis: "",
    quality: "",
    player: "",
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
  const usedRef = useRef<Map<string, number>>(new Map());
  const consumedRef = useRef<Set<string>>(new Set());
  const worldRevRef = useRef(0);
  const inputLockRef = useRef(false);
  const forcedFrameRef = useRef<string | null>(null);
  const bufferedInteractRef = useRef(0);
  const autoWalkRef = useRef<{
    x: number;
    deadline: number;
    interactId: string | null;
    resolve?: (ok: boolean) => void;
  } | null>(null);
  const seqRef = useRef<SeqRun<W> | null>(null);
  const ctxFactoryRef = useRef<((obj: SceneObject) => RuntimeCtx<W>) | null>(null);
  const detectRef = useRef({ x: Number.NaN, facing: 0, rev: -1, sceneKey: "", at: 0 });
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

  const def = scenes[scene] as RuntimeSceneDef<W>;
  const walkSpeed = player.walkSpeed ?? DEFAULT_WALK_SPEED;

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
      savedAt: new Date().toISOString(),
      facing: pos.current.facing,
      flags: flagsRef.current,
      counters: countersRef.current,
      sceneX: { ...sceneXRef.current, [sceneRef.current]: pos.current.x },
    };
    return payload;
  }, [persist]);

  const saveNow = useCallback(() => {
    if (!persist) return;
    const payload = buildSave();
    if (!payload) return;
    saveGame(persist.key, payload);
    saveDirtyRef.current = false;
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
    const timers = timersRef.current;
    const id = timers.after(() => {
      setToast((cur) => (cur?.id === toast.id ? null : cur));
    }, 3000);
    return () => timers.clear(id);
  }, [toast]);

  const queueToast = useCallback(
    (text: string, delayMs: number) => {
      queuedToasts.current.push(timersRef.current.after(() => showToast(text), delayMs));
    },
    [showToast],
  );

  const cancelQueuedToasts = useCallback(() => {
    for (const timer of queuedToasts.current) timersRef.current.clear(timer);
    queuedToasts.current = [];
  }, []);

  // --- scene-change hook (ambience, music) --------------------------------------------
  useEffect(() => {
    config.onSceneChange?.(scene);
  }, [config.onSceneChange, scene]);

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
    setFlashFx({ id: flashSeq.current, color, ms: reducedRef.current ? Math.min(ms, 120) : ms });
    timersRef.current.after(() => setFlashFx(null), ms + 80);
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
    actionRef.current = { id, start: nowMs(), onInterrupt: o?.onInterrupt };
    setActionUi(id);
    wakeRef.current();
  }, []);

  // --- auto-walk ------------------------------------------------------------------------
  const walkTo = useCallback((x: number, o?: { timeoutMs?: number }) => {
    cancelAutoWalkStatic(autoWalkRef);
    wakeRef.current();
    return new Promise<boolean>((resolve) => {
      autoWalkRef.current = {
        x,
        deadline: nowMs() + (o?.timeoutMs ?? 8000),
        interactId: null,
        resolve,
      };
    });
  }, []);

  // --- travel & blackout ----------------------------------------------------------------
  const travel = useCallback(
    (target: string, spawnX?: number) => {
      if (fadingRef.current) return;
      fadingRef.current = true;
      if (opts.rememberSceneX) sceneXRef.current[sceneRef.current] = pos.current.x;
      const timers = timersRef.current;
      setFade({ on: true, ms: reducedRef.current ? 90 : TRAVEL_FADE_OUT_MS });
      timers.after(() => {
        const nextDef = scenes[target] as RuntimeSceneDef<W> | undefined;
        const remembered = opts.rememberSceneX ? sceneXRef.current[target] : undefined;
        const fallback = nextDef?.spawnX ?? (nextDef ? nextDef.width / 2 : pos.current.x);
        pos.current.x = spawnX ?? remembered ?? fallback;
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
      }, TRAVEL_SWITCH_AT_MS);
    },
    [clearTargets, opts.rememberSceneX, scenes],
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
    (steps: SeqStep<W>[], o?: { cinematic?: boolean }) => {
      cancelSequence();
      const cinematic = o?.cinematic ?? false;
      if (cinematic) {
        inputLockRef.current = true;
        setCinema(true);
      }
      wakeRef.current();
      return new Promise<boolean>((resolve) => {
        seqRef.current = {
          steps,
          i: 0,
          entered: false,
          enteredAt: 0,
          deadline: 0,
          cinematic,
          resolve,
        };
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
          setDialogue({ state: openDialogue(tree as DialogueTree<never>), obj });
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
        playerAt: () => ({ x: pos.current.x, facing: pos.current.facing }),
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
      if (until > nowMs()) return;
      if (obj.kind !== "door") {
        pos.current.facing = obj.face ?? (obj.x >= pos.current.x ? 1 : -1);
      }
      const ctx = makeCtx(obj);
      const handler =
        handlers[obj.kind] ??
        (obj.kind === "door"
          ? () => {
              if (obj.to) travel(obj.to.scene, obj.to.spawnX);
            }
          : undefined);
      if (!handler) return;
      if (meta.cooldownMs) usedRef.current.set(obj.id, nowMs() + meta.cooldownMs);
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
      autoWalkRef.current = {
        x: clamp(meta.approachX ?? obj.x, EDGE_MARGIN, def.width - EDGE_MARGIN),
        deadline: nowMs() + 8000,
        interactId: obj.id,
      };
      wakeRef.current();
    },
    [def.width, interact, opts.autoWalkToTargets, selectTarget],
  );

  // --- dialogue input ---------------------------------------------------------------------------
  const dialogueAdvance = useCallback(() => {
    const cur = dialogueRef.current;
    if (!cur) return;
    if (dialogueAtChoices(cur.state)) {
      const step = chooseDialogue(cur.state, cur.state.choiceIndex, () => makeCtx(cur.obj));
      if (step.kind === "continue") setDialogue({ ...cur, state: step.state });
      else {
        step.onEnd?.(makeCtx(cur.obj));
        setDialogue(null);
      }
      return;
    }
    const step = advanceDialogue(cur.state);
    if (step.kind === "continue") setDialogue({ ...cur, state: step.state });
    else {
      step.onEnd?.(makeCtx(cur.obj));
      setDialogue(null);
    }
  }, [makeCtx]);

  const dialogueChoose = useCallback(
    (index: number) => {
      const cur = dialogueRef.current;
      if (!cur) return;
      const step = chooseDialogue(cur.state, index, () => makeCtx(cur.obj));
      if (step.kind === "continue") setDialogue({ ...cur, state: step.state });
      else {
        step.onEnd?.(makeCtx(cur.obj));
        setDialogue(null);
      }
    },
    [makeCtx],
  );

  const dialogueMoveCursor = useCallback((delta: number) => {
    const cur = dialogueRef.current;
    if (!cur || !dialogueAtChoices(cur.state)) return;
    const count = cur.state.tree.nodes[cur.state.nodeId].choices?.length ?? 0;
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
    debugAllowed: opts.debug,
  });
  inputBag.current = {
    keymap,
    interact,
    cycleTarget,
    dialogueAdvance,
    dialogueMoveCursor,
    fireGesture,
    menuOverlay: config.menuOverlay,
    debugAllowed: opts.debug,
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
        } else if (action === "targetNext") {
          event.preventDefault();
          bag.dialogueMoveCursor(-1);
        } else if (action === "targetPrev") {
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
      switch (action) {
        case "left":
          keys.current.left = true;
          event.preventDefault();
          break;
        case "right":
          keys.current.right = true;
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
        case "cancel":
          if (seqRef.current && !seqRef.current.cinematic) cancelSequence();
          cancelAutoWalkStatic(autoWalkRef);
          break;
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
    };
    // alt-tabbing mid-stride used to leave the player walking forever
    const releaseAll = () => {
      keys.current.left = false;
      keys.current.right = false;
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
      if (opts.pointerPicking && !inputLockRef.current) {
        // screen -> world, undoing pan and zoom about the current origin
        const cam = camStateRef.current;
        const local = cam.originX + (event.clientX - box.left - cam.originX - cam.pan) / cam.zoom;
        const picked = pickObject(
          (scenes[sceneRef.current] as RuntimeSceneDef<W>).objects as RuntimeObject[],
          local / cam.scale,
        );
        if (picked && !consumedRef.current.has(picked.id)) {
          engage(picked);
          return;
        }
      }
      interact(nearRef.current);
    },
    [engage, fireGesture, interact, opts.pointerPicking, scenes],
  );

  const pointerStop = useCallback(() => {
    keys.current.left = false;
    keys.current.right = false;
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
    scenes,
    player,
    walkSpeed,
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
    scenes,
    player,
    walkSpeed,
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

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const bag = loopBag.current;
      const cfg = bag.opts;
      const { scale, w: viewW, h: viewH } = viewRef.current;
      const sceneKey = sceneRef.current;
      const def = bag.scenes[sceneKey] as RuntimeSceneDef<W> | undefined;
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

      // --- action animation ---------------------------------------------------
      let actionFrame: string | null = null;
      const act = actionRef.current;
      if (act) {
        const adef = player.actions[act.id];
        const elapsed = now - act.start;
        const duration = adef.frames.length * adef.frameMs * adef.loops;
        const wantsMove =
          keys.current.left || keys.current.right || padRef.current.left || padRef.current.right;
        const interrupted = adef.interruptible && wantsMove && !inputLockRef.current;
        if (elapsed >= duration || interrupted) {
          if (interrupted) {
            act.onInterrupt?.();
            bag.cancelQueuedToasts();
          }
          actionRef.current = null;
          setActionUi(null);
          // a press that landed mid-action fires now instead of vanishing
          if (
            !interrupted &&
            bufferedInteractRef.current > 0 &&
            now - bufferedInteractRef.current <= cfg.inputBufferMs
          ) {
            bufferedInteractRef.current = 0;
            bag.interact(nearRef.current);
          }
        } else {
          actionFrame = adef.frames[Math.floor(elapsed / adef.frameMs) % adef.frames.length];
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

      // --- sequencer ----------------------------------------------------------
      if (seqRef.current && !fadingRef.current) stepSequence(now);

      const blocked = paused || actionFrame !== null;

      // --- simulation: fixed steps, bounded backlog ---------------------------
      const p = pos.current;
      let moving = false;
      let arrived = false;
      let simSteps = 0;
      if (blocked) {
        acc = 0;
      } else {
        const stepMs = 1000 / Math.max(15, cfg.simHz);
        while (acc >= stepMs && simSteps < cfg.maxSubsteps) {
          const dt = stepMs / 1000;
          let dir = 0;
          const manual =
            !inputLockRef.current &&
            (keys.current.left ||
              keys.current.right ||
              padRef.current.left ||
              padRef.current.right);
          if (manual) {
            if (keys.current.left || padRef.current.left) dir -= 1;
            if (keys.current.right || padRef.current.right) dir += 1;
            if (dir !== 0 && autoWalkRef.current) cancelAutoWalkStatic(autoWalkRef);
          } else if (autoWalkRef.current) {
            const gap = autoWalkRef.current.x - p.x;
            if (Math.abs(gap) <= ARRIVE_EPS || now > autoWalkRef.current.deadline) {
              arrived = true;
            } else {
              dir = gap > 0 ? 1 : -1;
            }
          }
          if (dir !== 0) {
            p.facing = dir as 1 | -1;
            p.x = clamp(p.x + dir * bag.walkSpeed * dt, EDGE_MARGIN, def.width - EDGE_MARGIN);
            // bounded, and aligned to the cycle so wrapping never skips a frame
            const span = 16 * Math.max(1, player.walkCycle.length) * 512;
            p.walkDist = (p.walkDist + Math.abs(dir * bag.walkSpeed * dt)) % span;
            moving = true;
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
          detect.facing !== p.facing ||
          detect.rev !== worldRevRef.current ||
          detect.sceneKey !== sceneKey ||
          now - detect.at > DETECT_SAFETY_MS;
        if (stale) {
          detect.x = p.x;
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

          const detected = detectObjects(cache.list, p.x, p.facing, worldRef.current);
          candidatesRef.current = detected.map((d) => d.obj);
          let active: SceneObject | null = null;
          if (detected.length > 0) {
            const locked = lockIdRef.current
              ? detected.find((d) => d.obj.id === lockIdRef.current)
              : undefined;
            if (locked) {
              active = locked.obj;
            } else {
              lockIdRef.current = null; // lock left range — release it
              const prev = nearRef.current
                ? detected.find((d) => d.obj.id === nearRef.current?.id)
                : undefined;
              // hysteresis: the current target keeps focus unless clearly beaten
              active =
                prev && prev.score <= detected[0].score + STICKY_MARGIN
                  ? prev.obj
                  : detected[0].obj;
            }
          } else {
            lockIdRef.current = null;
          }
          nearRef.current = active;
          bag.pushTargets(candidatesRef.current, active?.id ?? null);
        }
      }

      if (arrivedAt) {
        const target = candidatesRef.current.find((o) => o.id === arrivedAt);
        if (target) bag.interact(target);
      }

      // --- camera -------------------------------------------------------------
      // a rig, not a bolt: eased follow, look-ahead into the walk, step bob,
      // an idle breath, decaying shake, plus a cinematic focus and zoom
      const rig = camRig.current;
      const scrollable = def.width * scale > viewW;
      const focused = rig.focusX;
      const cam = cameraTransform(p.x, def.width, scale, viewW, viewH);
      const idealPan = focused === null ? cam.x : viewW / 2 - focused * scale;

      if (Number.isNaN(rig.x)) {
        rig.x = idealPan;
        rig.look = 0;
        rig.zoom = rig.zoomTarget;
      }
      // exponential ease toward the ideal position — frame-rate independent
      const follow = reduced ? 1 : 1 - Math.exp(-(frameMs / 1000) * 6.5);
      rig.x += (idealPan - rig.x) * follow;
      rig.zoom += (rig.zoomTarget - rig.zoom) * (1 - Math.exp(-(frameMs / 1000) * rig.zoomRate));
      if (Math.abs(rig.zoom - rig.zoomTarget) < 0.002) rig.zoom = rig.zoomTarget;
      // look-ahead: lean into the walk, settle back when standing
      const lookTarget =
        scrollable && moving && focused === null && !reduced ? -p.facing * 22 * scale : 0;
      rig.look += (lookTarget - rig.look) * (1 - Math.exp(-(frameMs / 1000) * 2.2));
      // step bob while walking, a slow breath while standing
      let bobY = 0;
      if (reduced) {
        rig.bobT = 0;
      } else if (moving) {
        rig.bobT += frameMs / 1000;
        bobY = Math.sin(rig.bobT * 13) * 0.3 * scale;
      } else {
        rig.bobT = 0;
        rig.swayT += frameMs / 1000;
        bobY = Math.sin(rig.swayT * 0.9) * 0.12 * scale;
      }
      // shake: random decaying offset
      let shakeX = 0;
      let shakeY = 0;
      if (now < rig.shakeUntil) {
        const left = (rig.shakeUntil - now) / 300;
        const mag = rig.shakeMag * Math.min(1, left);
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      } else {
        rig.shakeMag = 0;
      }

      // scale about the focus point, so pan math stays zoom-independent
      const originX = (focused === null ? p.x : focused) * scale;
      const originY = FLOOR_Y * scale;
      const zoom = rig.zoom;
      let panX = rig.x + rig.look + shakeX;
      if (scrollable || zoom !== 1) {
        // keep both scene edges outside the viewport under the composed transform
        const worldW = def.width * scale;
        const maxPan = originX * (zoom - 1);
        const minPan = viewW - originX - (worldW - originX) * zoom;
        panX = minPan > maxPan ? (minPan + maxPan) / 2 : clamp(panX, minPan, maxPan);
      }
      const panY = cam.y + bobY + shakeY;
      camStateRef.current.pan = panX;
      camStateRef.current.zoom = zoom;
      camStateRef.current.originX = originX;
      camStateRef.current.scale = scale;

      const dom = domCache.current;
      const sceneEl = sceneElRef.current;
      if (sceneEl) {
        // GPU promotion is granted while something moves and released when the
        // frame settles — a permanent will-change holds a layer forever
        const busy =
          moving ||
          fadingRef.current ||
          seqRef.current !== null ||
          now < rig.shakeUntil ||
          zoom !== rig.zoomTarget ||
          now - lastMoveAtRef.current < IDLE_PROMOTE_MS;
        promote(sceneEl, busy, promoteCache.current);

        // origin only matters while zoomed, so normal play writes it never
        const originT = zoom === 1 ? "" : `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
        if (originT !== dom.origin) {
          dom.origin = originT;
          sceneEl.style.transformOrigin = originT === "" ? "0 0" : originT;
          domCounters.current.writes += 1;
        }
        // the scene container is compositor-promoted, so its fractional
        // transform is cheap; write it only when it changed
        const sceneT =
          zoom === 1
            ? `translate3d(${panX}px, ${panY}px, 0)`
            : `translate3d(${panX}px, ${panY}px, 0) scale(${zoom.toFixed(4)})`;
        if (sceneT !== dom.scene) {
          dom.scene = sceneT;
          sceneEl.style.transform = sceneT;
          domCounters.current.writes += 1;
        } else {
          domCounters.current.skips += 1;
        }
        // --cam drives SVG parallax groups, which repaint on change in
        // browsers without composited SVG transforms — quantize to whole
        // logical pixels so a settled camera stops invalidating them
        const camV = String(scrollable ? Math.round(-panX / scale) : 0);
        if (camV !== dom.cam) {
          dom.cam = camV;
          sceneEl.style.setProperty("--cam", camV);
          domCounters.current.writes += 1;
        }
        // the slice of world on screen, for <CullBox> and for art that wants to
        // shed off-camera detail in CSS alone
        const visX0 = (originX + (0 - originX - panX) / zoom) / scale;
        const visX1 = (originX + (viewW - originX - panX) / zoom) / scale;
        const visV = `${Math.floor(visX0)} ${Math.ceil(visX1)}`;
        if (visV !== dom.vis) {
          dom.vis = visV;
          sceneEl.style.setProperty("--vis-x0", String(Math.floor(visX0)));
          sceneEl.style.setProperty("--vis-x1", String(Math.ceil(visX1)));
          band.set(visX0, visX1);
          domCounters.current.writes += 1;
        }
        const qV = QUALITY_VAR[gov.tier];
        if (qV !== dom.quality) {
          dom.quality = qV;
          sceneEl.style.setProperty("--quality", qV);
        }
      }

      // player transform + the monologue anchor riding above their head
      const playerEl = playerElRef.current;
      if (playerEl) {
        const px = (p.x - player.width / 2) * scale;
        const py = (FLOOR_Y - player.height) * scale;
        const playerT = `translate3d(${px}px, ${py}px, 0) scaleX(${p.facing})`;
        if (playerT !== dom.player) {
          dom.player = playerT;
          playerEl.style.transform = playerT;
          domCounters.current.writes += 1;
        } else {
          domCounters.current.skips += 1;
        }
      }
      const monoEl = monologueElRef.current;
      if (monoEl) {
        const monoT = `translate3d(${p.x * scale}px, ${
          (FLOOR_Y - player.height - 4) * scale
        }px, 0)`;
        if (monoT !== dom.mono) {
          dom.mono = monoT;
          monoEl.style.transform = monoT;
          domCounters.current.writes += 1;
        }
      }

      // --- player frame -------------------------------------------------------
      // idle life: breathing, blinks, and every ~11s a flourish
      let idleFrame = "stand";
      if (!moving && !actionFrame) {
        const breath = now % 1700 < 850 ? "stand" : "idleB";
        idleFrame = now % 4200 < 170 ? "blink" : breath;
        const IDLE_SPAN = 11000;
        const idlePhase = now % IDLE_SPAN;
        if (idlePhase > 8000) {
          const flourish = Math.floor(now / IDLE_SPAN) % 2;
          const ft = idlePhase - 8000;
          if (def.idleLean) {
            idleFrame = ft < 2600 ? "leanIdle" : breath;
          } else if (flourish === 0) {
            idleFrame =
              ft < 500 ? "stretchA" : ft < 1900 ? "stretchB" : ft < 2400 ? "stretchA" : breath;
          } else {
            idleFrame = ft < 1600 ? "lookBack" : breath;
          }
        }
      }
      let frame =
        forcedFrameRef.current ??
        actionFrame ??
        (moving
          ? player.walkCycle[Math.floor(p.walkDist / 16) % player.walkCycle.length]
          : idleFrame);

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
              facing: actor.facing ?? 1,
              dist: 0,
              dir: 1,
              pauseUntil: 0,
              frame: actor.idleFrame ?? "stand",
              hidden: false,
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
          const baseY = (actor.y ?? FLOOR_Y) - actor.height;
          const t = `translate3d(${(st.x - actor.width / 2) * scale}px, ${baseY * scale}px, 0) scaleX(${st.facing})`;
          if (el.dataset.t !== t) {
            el.dataset.t = t;
            el.style.transform = t;
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
          });
          sa.frames = 0;
          sa.since = now;
        }
      }
    }

    /** One beat at a time; instant steps collapse in the same frame. */
    function stepSequence(now: number) {
      const run = seqRef.current;
      if (!run) return;
      const bag = loopBag.current;
      const make = ctxFactoryRef.current;
      const anchor = (nearRef.current ??
        (bag.scenes[sceneRef.current] as RuntimeSceneDef<W>).objects[0]) as SceneObject;
      let guard = 0;
      while (run.i < run.steps.length && guard++ < 32) {
        const step = run.steps[run.i] as Record<string, unknown>;
        if (!run.entered) {
          run.entered = true;
          run.enteredAt = now;
          run.deadline = 0;
          enterStep(step, now, anchor);
        }
        if (!stepDone(step, now)) return;
        run.i++;
        run.entered = false;
      }
      if (run.i >= run.steps.length) {
        seqRef.current = null;
        if (run.cinematic) {
          inputLockRef.current = false;
          setCinema(false);
          camRig.current.focusX = null;
          camRig.current.zoomTarget = 1;
        }
        forcedFrameRef.current = null;
        run.resolve(true);
      }

      function enterStep(step: Record<string, unknown>, at: number, obj: SceneObject) {
        const run2 = seqRef.current;
        if (!run2) return;
        if ("wait" in step) {
          run2.deadline = at + Number(step.wait);
        } else if ("say" in step) {
          const text = String(step.say);
          bag.showToast(text);
          run2.deadline = at + Math.min(3200, 1200 + text.length * 28);
        } else if ("walkTo" in step) {
          cancelAutoWalkStatic(autoWalkRef);
          autoWalkRef.current = {
            x: clamp(
              Number(step.walkTo),
              EDGE_MARGIN,
              (bag.scenes[sceneRef.current] as RuntimeSceneDef<W>).width - EDGE_MARGIN,
            ),
            deadline: at + Number(step.timeoutMs ?? 8000),
            interactId: null,
          };
        } else if ("face" in step) {
          pos.current.facing = step.face === -1 ? -1 : 1;
        } else if ("hold" in step) {
          forcedFrameRef.current = String(step.hold);
          run2.deadline = at + Number(step.forMs ?? 600);
        } else if ("action" in step) {
          bag.startAction(String(step.action));
        } else if ("world" in step) {
          bag.updateWorld(step.world as Partial<W>);
        } else if ("fx" in step) {
          const spec = step.fx as { kind: string; x?: number; ttlMs?: number; data?: unknown };
          bag.spawnFx(spec.kind, spec.x ?? pos.current.x, spec.ttlMs ?? 900, spec.data);
        } else if ("shake" in step) {
          bag.shakeCamera(Number(step.shake), Number(step.ms ?? 300));
        } else if ("flash" in step) {
          const spec = step.flash as { color?: string; ms?: number };
          bag.flash(spec.color, spec.ms);
        } else if ("focus" in step) {
          bag.focusCamera(step.focus as number | null, Number(step.ms ?? 500));
        } else if ("letterbox" in step) {
          bag.letterbox(Boolean(step.letterbox));
        } else if ("travel" in step) {
          const spec = step.travel as { scene: string; spawnX?: number };
          bag.travel(spec.scene, spec.spawnX);
        } else if ("dialogue" in step) {
          setDialogue({ state: openDialogue(step.dialogue as DialogueTree<never>), obj });
        } else if ("sound" in step) {
          soundRef.current?.(String(step.sound));
        } else if ("do" in step) {
          if (make) (step.do as (c: RuntimeCtx<W>) => void)(make(obj));
        } else if ("until" in step) {
          run2.deadline = at + Number(step.timeoutMs ?? 10000);
        }
      }

      function stepDone(step: Record<string, unknown>, at: number): boolean {
        const run2 = seqRef.current;
        if (!run2) return false;
        if ("walkTo" in step) return autoWalkRef.current === null;
        if ("action" in step) return actionRef.current === null;
        if ("dialogue" in step) return dialogueRef.current === null;
        if ("travel" in step) return !fadingRef.current;
        if ("until" in step) {
          return (step.until as () => boolean)() || at >= run2.deadline;
        }
        if (run2.deadline > 0) {
          if (at < run2.deadline) return false;
          if ("hold" in step) forcedFrameRef.current = null;
          return true;
        }
        return true;
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
  const apiBag = useRef({ interact, travel, walkTo, runSequence, updateWorld, saveNow, scenes });
  apiBag.current = { interact, travel, walkTo, runSequence, updateWorld, saveNow, scenes };

  useEffect(() => {
    if (!config.onReady) return;
    const api: RuntimeApi<W> = {
      interact: (id) => {
        const bag = apiBag.current;
        const obj = id
          ? (candidatesRef.current.find((o) => o.id === id) ??
            (bag.scenes[sceneRef.current] as RuntimeSceneDef<W>).objects.find((o) => o.id === id) ??
            null)
          : nearRef.current;
        if (obj) bag.interact(obj);
      },
      travel: (scene, spawnX) => apiBag.current.travel(scene, spawnX),
      walkTo: (x) => apiBag.current.walkTo(x),
      runSequence: (steps, o) => apiBag.current.runSequence(steps, o),
      getWorld: () => worldRef.current,
      updateWorld: (patch) => apiBag.current.updateWorld(patch),
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: artKey stands in for world when provided
  const foregroundNode = useMemo(
    () => (Foreground ? <Foreground world={worldRef.current} phase={phase} /> : null),
    [Foreground, artWorld, artKey, phase],
  );
  const dialogueOpen = dialogue !== null;
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
          {Object.keys(actor.frames).map((key) => (
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

            {/* the character's inner monologue, spoken over their head */}
            <div
              ref={monologueElRef}
              className="absolute top-0 left-0 z-20"
              style={{ willChange: "transform" }}
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

            {/* the Foreground CONTRACT: in front of the player, always. The player
                div carries zIndex 10, so an unstyled scene Foreground (z auto)
                would paint behind him — this wrapper makes the promise true
                for every scene without each one remembering a z-index. */}
            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 15 }}>
              {foregroundNode}
            </div>

            {/* target markers — ride the world above the focused object */}
            {!intro && !overlay && !dialogue
              ? opts.showAllMarkers
                ? targets.list.map((obj) => <TargetMarker key={obj.id} obj={obj} scale={scale} />)
                : activeTarget && <TargetMarker obj={activeTarget} scale={scale} />
              : null}

            {/* darkness (day phase / lights) */}
            <div
              className="pointer-events-none absolute inset-0 bg-[#0a1230] transition-opacity duration-500"
              style={{ opacity: darkness, mixBlendMode: "multiply" }}
            />
          </div>
        </BandProvider>

        {/* HUD */}
        {!intro && !overlay ? (
          <>
            {config.renderHud?.(scene, world, phase, setOverlay)}
            {!dialogue ? (
              <InteractPrompt
                targets={targets.list}
                activeId={targets.activeId}
                pulse={promptPulse}
                label={objectLabel}
                verb={config.objectVerb}
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
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label="Walk left"
                  className="h-14 w-14 border border-parchment/30 bg-black/40 text-parchment text-xl active:bg-parchment/20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    keys.current.left = true;
                    cancelAutoWalkStatic(autoWalkRef);
                    wakeRef.current();
                  }}
                  onPointerUp={pointerStop}
                  onPointerLeave={pointerStop}
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Walk right"
                  className="h-14 w-14 border border-parchment/30 bg-black/40 text-parchment text-xl active:bg-parchment/20"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    keys.current.right = true;
                    cancelAutoWalkStatic(autoWalkRef);
                    wakeRef.current();
                  }}
                  onPointerUp={pointerStop}
                  onPointerLeave={pointerStop}
                >
                  ▶
                </button>
              </div>
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
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

/** Cancel an in-flight auto-walk from anywhere, resolving its promise as false. */
function cancelAutoWalkStatic(ref: { current: { resolve?: (ok: boolean) => void } | null }): void {
  const walk = ref.current;
  if (!walk) return;
  ref.current = null;
  walk.resolve?.(false);
}
