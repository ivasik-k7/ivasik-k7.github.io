import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WALK_SPEED,
  EDGE_MARGIN,
  FLOOR_Y,
  SCENE_HEIGHT,
  TRAVEL_FADE_IN_DELAY_MS,
  TRAVEL_FADE_OUT_MS,
  TRAVEL_SWITCH_AT_MS,
} from "../core/constants";
import { cameraTransform, nearestObject, viewportScale } from "../core/math";
import type { AnyWorld, FxInstance, GameConfig, InteractionCtx, SceneObject } from "../core/types";
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
import { PixelSprite } from "../ui/PixelSprite";

/**
 * GameRuntime — the engine's single component.
 *
 * Rendering philosophy, learned the hard way:
 *  - one requestAnimationFrame loop owns movement, camera, frames;
 *  - per-frame values are written straight to DOM refs (no React churn);
 *  - React state changes only on rare events: scene switch, overlay,
 *    toast, near-object change, fade.
 */
export function GameRuntime<W extends AnyWorld>({ config }: { config: GameConfig<W> }) {
  const { scenes, player, handlers, objectLabel } = config;

  // --- persisted start ---------------------------------------------------------
  const [restored] = useState(() =>
    config.persist ? loadGame<W>(config.persist.key, config.persist.version) : null,
  );

  // --- rare React state -------------------------------------------------------
  const [scene, setScene] = useState(restored?.scene ?? config.start.scene);
  const [world, setWorld] = useState<W>(restored?.world ?? config.initialWorld);
  const [dialogue, setDialogue] = useState<{ state: DialogueState; obj: SceneObject } | null>(null);
  const [overlay, setOverlay] = useState<unknown>(null);
  const [intro, setIntro] = useState(Boolean(config.renderIntro));
  const [fade, setFade] = useState<{ on: boolean; ms: number }>({ on: false, ms: 200 });
  const [near, setNear] = useState<SceneObject | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [fx, setFx] = useState<FxInstance[]>([]);
  const [actionUi, setActionUi] = useState<string | null>(null);
  const [movingUi, setMovingUi] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0, scale: 3 });
  const [phase, setPhase] = useState(() => config.dayPhase?.() ?? "day");

  // --- rAF-side refs ------------------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneElRef = useRef<HTMLDivElement>(null);
  const playerElRef = useRef<HTMLDivElement>(null);
  const monologueElRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Record<string, SVGGElement | null>>({});

  const pos = useRef({ x: restored?.x ?? config.start.x, facing: 1 as 1 | -1, walkDist: 0 });
  const keys = useRef({ left: false, right: false });
  const actionRef = useRef<{ id: string; start: number; onInterrupt?: () => void } | null>(null);
  const sceneRef = useRef(scene);
  const overlayRef = useRef<unknown>(overlay);
  const introRef = useRef(intro);
  const fadingRef = useRef(false);
  const nearRef = useRef<SceneObject | null>(null);
  const worldRef = useRef<W>(restored?.world ?? config.initialWorld);
  const dialogueRef = useRef<{ state: DialogueState; obj: SceneObject } | null>(null);
  const queuedToasts = useRef<number[]>([]);
  const toastSeq = useRef(0);
  const fxSeq = useRef(0);
  const movingRef = useRef(false);
  const viewRef = useRef(view);
  const gestureFired = useRef(false);

  sceneRef.current = scene;
  overlayRef.current = overlay;
  introRef.current = intro;
  viewRef.current = view;
  dialogueRef.current = dialogue;

  // --- autosave (debounced) ------------------------------------------------------
  useEffect(() => {
    const persist = config.persist;
    if (!persist) return;
    const timer = window.setTimeout(() => {
      saveGame(persist.key, {
        version: persist.version,
        world,
        scene,
        x: pos.current.x,
        savedAt: new Date().toISOString(),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [config.persist, world, scene]);

  const walkSpeed = player.walkSpeed ?? DEFAULT_WALK_SPEED;

  // --- world write path ----------------------------------------------------------
  const updateWorld = useCallback((patch: Partial<W> | ((w: W) => W)) => {
    const next =
      typeof patch === "function" ? patch(worldRef.current) : { ...worldRef.current, ...patch };
    worldRef.current = next;
    setWorld(next);
  }, []);

  // --- toasts ---------------------------------------------------------------------
  const showToast = useCallback((text: string) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((cur) => (cur?.id === toast.id ? null : cur));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const queueToast = useCallback(
    (text: string, delayMs: number) => {
      queuedToasts.current.push(window.setTimeout(() => showToast(text), delayMs));
    },
    [showToast],
  );

  const cancelQueuedToasts = useCallback(() => {
    for (const timer of queuedToasts.current) window.clearTimeout(timer);
    queuedToasts.current = [];
  }, []);

  // --- scene-change hook (ambience, music) --------------------------------------------
  useEffect(() => {
    config.onSceneChange?.(scene);
  }, [config.onSceneChange, scene]);

  // --- day phase -------------------------------------------------------------------
  useEffect(() => {
    if (!config.dayPhase) return;
    const timer = window.setInterval(() => setPhase(config.dayPhase?.() ?? "day"), 60_000);
    return () => window.clearInterval(timer);
  }, [config.dayPhase]);

  // --- sizing -----------------------------------------------------------------------
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (!el) return;
      setView({ w: el.clientWidth, h: el.clientHeight, scale: viewportScale(el.clientHeight) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // --- fx ---------------------------------------------------------------------------
  const spawnFx = useCallback((kind: string, x: number, ttlMs: number, data?: unknown) => {
    fxSeq.current += 1;
    const inst: FxInstance = { id: fxSeq.current, kind, x, data };
    setFx((cur) => [...cur.slice(-8), inst]);
    window.setTimeout(() => {
      setFx((cur) => cur.filter((f) => f.id !== inst.id));
    }, ttlMs);
  }, []);

  // --- actions -----------------------------------------------------------------------
  const startAction = useCallback((id: string, opts?: { onInterrupt?: () => void }) => {
    actionRef.current = { id, start: performance.now(), onInterrupt: opts?.onInterrupt };
    setActionUi(id);
  }, []);

  // --- travel & blackout ----------------------------------------------------------------
  const travel = useCallback((target: string, spawnX: number) => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setFade({ on: true, ms: TRAVEL_FADE_OUT_MS });
    window.setTimeout(() => {
      pos.current.x = spawnX;
      setScene(target);
      nearRef.current = null;
      setNear(null);
      window.setTimeout(() => {
        fadingRef.current = false;
        setFade({ on: false, ms: TRAVEL_FADE_OUT_MS });
      }, TRAVEL_FADE_IN_DELAY_MS);
    }, TRAVEL_SWITCH_AT_MS);
  }, []);

  const blackout = useCallback(
    (holdMs: number, text: string) => {
      fadingRef.current = true;
      setFade({ on: true, ms: 400 });
      window.setTimeout(() => {
        setFade({ on: false, ms: 400 });
        showToast(text);
        window.setTimeout(() => {
          fadingRef.current = false;
        }, 400);
      }, holdMs);
    },
    [showToast],
  );

  // --- interaction dispatch ----------------------------------------------------------------
  const makeCtx = useCallback(
    (obj: SceneObject): InteractionCtx<W> => ({
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
      scene: sceneRef.current,
    }),
    [blackout, queueToast, showToast, spawnFx, startAction, travel, updateWorld],
  );

  const interact = useCallback(
    (obj: SceneObject | null) => {
      if (!obj || fadingRef.current || actionRef.current || dialogueRef.current) return;
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
      handler?.(ctx);
    },
    [handlers, makeCtx, travel],
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
  useEffect(() => {
    const MODIFIERS = /^(Shift|Control|Alt|Meta)/;
    const onKeyDown = (event: KeyboardEvent) => {
      fireGesture();
      if (introRef.current) {
        if (!MODIFIERS.test(event.code)) setIntro(false);
        return;
      }
      if (dialogueRef.current) {
        switch (event.code) {
          case "KeyE":
          case "Enter":
          case "NumpadEnter":
          case "Space":
            event.preventDefault();
            dialogueAdvance();
            break;
          case "ArrowUp":
          case "KeyW":
            event.preventDefault();
            dialogueMoveCursor(-1);
            break;
          case "ArrowDown":
          case "KeyS":
            event.preventDefault();
            dialogueMoveCursor(1);
            break;
        }
        return;
      }
      if (overlayRef.current) {
        if (event.code === "Escape" || event.code === "Tab" || event.code === "KeyM") {
          event.preventDefault();
          setOverlay(null);
        }
        return;
      }
      switch (event.code) {
        case "ArrowLeft":
        case "KeyA":
          keys.current.left = true;
          event.preventDefault();
          break;
        case "ArrowRight":
        case "KeyD":
          keys.current.right = true;
          event.preventDefault();
          break;
        case "KeyE":
        case "Enter":
        case "NumpadEnter":
        case "Space":
          event.preventDefault();
          interact(nearRef.current);
          break;
        case "Tab":
        case "KeyM":
          if (config.menuOverlay !== undefined) {
            event.preventDefault();
            setOverlay(config.menuOverlay);
          }
          break;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") keys.current.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") keys.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [config.menuOverlay, dialogueAdvance, dialogueMoveCursor, fireGesture, interact]);

  // --- touch: hold edges to walk, tap middle to interact ----------------------------------------
  const pointerWalk = useCallback(
    (event: React.PointerEvent) => {
      fireGesture();
      if (introRef.current || overlayRef.current || fadingRef.current) return;
      if ((event.target as HTMLElement).closest("button")) return;
      const el = viewportRef.current;
      if (!el) return;
      const rel = (event.clientX - el.getBoundingClientRect().left) / el.clientWidth;
      if (rel < 0.38) keys.current.left = true;
      else if (rel > 0.62) keys.current.right = true;
      else interact(nearRef.current);
    },
    [fireGesture, interact],
  );

  const pointerStop = useCallback(() => {
    keys.current.left = false;
    keys.current.right = false;
  }, []);

  // --- game loop ----------------------------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const { scale, w: viewW, h: viewH } = viewRef.current;
      const def = scenes[sceneRef.current];
      if (!def) return;

      // action animation
      let actionFrame: string | null = null;
      const act = actionRef.current;
      if (act) {
        const adef = player.actions[act.id];
        const elapsed = now - act.start;
        const duration = adef.frames.length * adef.frameMs * adef.loops;
        const interrupted = adef.interruptible && (keys.current.left || keys.current.right);
        if (elapsed >= duration || interrupted) {
          if (interrupted) {
            act.onInterrupt?.();
            cancelQueuedToasts();
          }
          actionRef.current = null;
          setActionUi(null);
        } else {
          actionFrame = adef.frames[Math.floor(elapsed / adef.frameMs) % adef.frames.length];
        }
      }

      const paused =
        introRef.current ||
        overlayRef.current !== null ||
        fadingRef.current ||
        actionFrame !== null ||
        dialogueRef.current !== null;

      const p = pos.current;
      let moving = false;
      if (!paused) {
        let dir = 0;
        if (keys.current.left) dir -= 1;
        if (keys.current.right) dir += 1;
        if (dir !== 0) {
          p.facing = dir as 1 | -1;
          p.x = Math.max(
            EDGE_MARGIN,
            Math.min(def.width - EDGE_MARGIN, p.x + dir * walkSpeed * dt),
          );
          p.walkDist += Math.abs(dir * walkSpeed * dt);
          moving = true;
        }
      }

      if (moving !== movingRef.current) {
        movingRef.current = moving;
        setMovingUi(moving);
      }

      // proximity — only push to React on change
      const nearest = paused ? nearRef.current : nearestObject(def.objects, p.x);
      if ((nearest?.id ?? null) !== (nearRef.current?.id ?? null)) {
        nearRef.current = nearest;
        setNear(nearest);
      }

      // camera — the scene container pans; --cam (logical px) feeds parallax layers
      const cam = cameraTransform(p.x, def.width, scale, viewW, viewH);
      const sceneEl = sceneElRef.current;
      if (sceneEl) {
        sceneEl.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0)`;
        sceneEl.style.setProperty("--cam", String(cam.camLogical));
      }

      // player transform + the monologue anchor riding above their head
      const playerEl = playerElRef.current;
      if (playerEl) {
        const px = (p.x - player.width / 2) * scale;
        const py = (FLOOR_Y - player.height) * scale;
        playerEl.style.transform = `translate3d(${px}px, ${py}px, 0) scaleX(${p.facing})`;
      }
      const monoEl = monologueElRef.current;
      if (monoEl) {
        monoEl.style.transform = `translate3d(${p.x * scale}px, ${
          (FLOOR_Y - player.height - 4) * scale
        }px, 0)`;
      }

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
      const frame =
        actionFrame ??
        (moving
          ? player.walkCycle[Math.floor(p.walkDist / 16) % player.walkCycle.length]
          : idleFrame);
      for (const key of Object.keys(player.frames)) {
        const g = frameRefs.current[key];
        if (g) g.style.display = key === frame ? "" : "none";
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cancelQueuedToasts, player, scenes, walkSpeed]);

  // --- render ---------------------------------------------------------------------------------------
  const { scale } = view;
  const def = scenes[scene];
  const darkness = def.darkness?.(phase, world) ?? 0;
  const SceneArt = def.Component;
  const Foreground = def.Foreground;
  const Effects = def.Effects;

  // The scene artwork is hundreds of rects; keyboard INP dies if it
  // reconciles on every toast/near/action update. Repaint it only when
  // the world, phase or scene actually change.
  const sceneArtNode = useMemo(
    () => (
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${def.width} ${SCENE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <SceneArt world={world} phase={phase} />
      </svg>
    ),
    [SceneArt, def.width, world, phase],
  );
  const foregroundNode = useMemo(
    () => (Foreground ? <Foreground world={world} phase={phase} /> : null),
    [Foreground, world, phase],
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
    () => (
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${player.width} ${player.height}`}
      >
        {Object.keys(player.frames).map((key) => (
          <g
            key={key}
            ref={(el) => {
              frameRefs.current[key] = el;
            }}
            style={{ display: key === "stand" ? "" : "none" }}
          >
            <PixelSprite map={player.frames[key]} palette={player.palette} cell={player.cell} />
          </g>
        ))}
      </svg>
    ),
    [player],
  );

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
        <div
          ref={sceneElRef}
          className="absolute top-0 left-0 will-change-transform"
          style={{ width: def.width * scale, height: SCENE_HEIGHT * scale }}
        >
          {sceneArtNode}

          {effectsNode}

          {/* player */}
          <div
            ref={playerElRef}
            className="pixelated absolute top-0 left-0 will-change-transform"
            style={{ width: player.width * scale, height: player.height * scale }}
          >
            {playerNode}
          </div>

          {/* the character's inner monologue, spoken over their head */}
          <div ref={monologueElRef} className="absolute top-0 left-0 z-20 will-change-transform">
            <AnimatePresence>
              {toast && !intro && !overlay ? (
                <motion.div
                  key={toast.id}
                  className="-translate-x-1/2 pointer-events-none absolute max-w-64 border border-parchment/25 bg-black/85 px-2 py-1 text-center font-mono text-parchment/90"
                  style={{
                    transform: "translate(-50%, -100%)",
                    fontSize: Math.max(10, view.scale * 3.4),
                    lineHeight: 1.35,
                    width: "max-content",
                  }}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {toast.text}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {foregroundNode}

          {/* darkness (day phase / lights) */}
          <div
            className="pointer-events-none absolute inset-0 bg-[#0a1230] transition-opacity duration-500"
            style={{ opacity: darkness, mixBlendMode: "multiply" }}
          />
        </div>

        {/* HUD */}
        {!intro && !overlay ? (
          <>
            {config.renderHud?.(scene, world, phase)}
            {near && !toast ? (
              <p
                className="absolute bottom-16 left-1/2 -translate-x-1/2 text-parchment/80 text-sm tracking-[0.2em] sm:bottom-6"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                ▸ {objectLabel(near)} <span className="text-signal">[E]</span>
              </p>
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
            ? config.renderOverlay(overlay, () => setOverlay(null), world)
            : null}
        </AnimatePresence>

        {/* travel / blackout fade */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity"
          style={{ opacity: fade.on ? 1 : 0, transitionDuration: `${fade.ms}ms` }}
        />

        {/* intro splash */}
        {intro && config.renderIntro ? config.renderIntro(() => setIntro(false)) : null}
      </div>
    </div>
  );
}
