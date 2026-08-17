import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hud } from "@/components/game/Hud";
import { Panel } from "@/components/game/Panel";
import { BalconyForeground, RoomScene } from "@/components/game/rooms";
import { StatusMenu } from "@/components/game/StatusMenu";
import {
  ACTIONS,
  type ActionId,
  actionDuration,
  type FrameName,
  HEART,
  HEART_PALETTE,
  PixelMap,
  PLAYER_FRAMES,
  PLAYER_H,
  PLAYER_PALETTE,
  PLAYER_W,
  WALK_CYCLE,
} from "@/components/game/sprites";
import { Terminal } from "@/components/game/Terminal";
import {
  FLOOR_Y,
  GAME_HEIGHT,
  nearestObject,
  type PanelId,
  PLAYER_START,
  ROOMS,
  type RoomId,
  type RoomObject,
  WALK_SPEED,
} from "@/lib/apartment";
import {
  type DayPhase,
  dayPhase,
  initialWorld,
  type LightRoom,
  roomDarkness,
  TV_CYCLE,
  type TvChannel,
  type WorldState,
} from "@/lib/worldState";

type Overlay = { type: "panel"; id: PanelId } | { type: "terminal" } | { type: "menu" } | null;

interface HeartFx {
  id: number;
  x: number;
}

let heartSeq = 0;

const TV_TOAST: Record<TvChannel, string> = {
  off: "toast.tvOff",
  film: "toast.tvFilm",
  football: "toast.tvFootball",
  static: "toast.tvStatic",
};

export function ApartmentGame() {
  const { t } = useTranslation();

  const [room, setRoom] = useState<RoomId>(PLAYER_START.room);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [intro, setIntro] = useState(true);
  const [fade, setFade] = useState<{ on: boolean; ms: number }>({ on: false, ms: 200 });
  const [world, setWorld] = useState<WorldState>(initialWorld);
  const [phase, setPhase] = useState<DayPhase>(() => dayPhase(new Date().getHours()));
  const [near, setNear] = useState<RoomObject | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [hearts, setHearts] = useState<HeartFx[]>([]);
  const [actionUi, setActionUi] = useState<ActionId | null>(null);
  const [view, setView] = useState({ w: 0, h: 0, scale: 3 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<Record<string, SVGGElement | null>>({});

  const pos = useRef({ x: PLAYER_START.x, facing: 1, walkDist: 0 });
  const keys = useRef({ left: false, right: false });
  const actionRef = useRef<{ id: ActionId; start: number } | null>(null);
  const roomRef = useRef<RoomId>(room);
  const overlayRef = useRef<Overlay>(overlay);
  const introRef = useRef(intro);
  const fadingRef = useRef(false);
  const nearRef = useRef<RoomObject | null>(null);
  const worldRef = useRef<WorldState>(initialWorld);
  const phaseRef = useRef<DayPhase>(phase);
  const callTimers = useRef<number[]>([]);
  const toastSeq = useRef(0);
  const viewRef = useRef(view);

  roomRef.current = room;
  overlayRef.current = overlay;
  introRef.current = intro;
  phaseRef.current = phase;
  viewRef.current = view;

  /** Single write path for world state: keeps the React state and the rAF-side ref in sync. */
  const updateWorld = useCallback(
    (patch: Partial<WorldState> | ((w: WorldState) => WorldState)) => {
      const next =
        typeof patch === "function" ? patch(worldRef.current) : { ...worldRef.current, ...patch };
      worldRef.current = next;
      setWorld(next);
    },
    [],
  );

  const showToast = useCallback((text: string) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // --- day phase: real clock, re-checked every minute --------------------------
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase(dayPhase(new Date().getHours()));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // --- sizing ---------------------------------------------------------------
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const scale = Math.max(2, Math.min(6, Math.floor(h / GAME_HEIGHT)));
      setView({ w, h, scale });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Off-screen moments (toilet, bath): slow fade to black, hold, fade back, then the toast.
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

  // --- interactions -----------------------------------------------------------
  const interact = useCallback(
    (obj: RoomObject | null) => {
      if (!obj || fadingRef.current || actionRef.current) return;
      if (obj.kind !== "door") {
        pos.current.facing = obj.face ?? (obj.x >= pos.current.x ? 1 : -1);
      }
      const startAction = (id: ActionId) => {
        actionRef.current = { id, start: performance.now() };
        setActionUi(id);
      };
      switch (obj.kind) {
        case "door": {
          if (!obj.to) return;
          fadingRef.current = true;
          setFade({ on: true, ms: 200 });
          window.setTimeout(() => {
            pos.current.x = obj.to?.spawnX ?? PLAYER_START.x;
            setRoom(obj.to?.room ?? PLAYER_START.room);
            nearRef.current = null;
            setNear(null);
            window.setTimeout(() => {
              fadingRef.current = false;
              setFade({ on: false, ms: 200 });
            }, 60);
          }, 220);
          break;
        }
        case "lamp": {
          startAction("use");
          // Lamps only exist in interior rooms, so the current room is a LightRoom.
          const lightRoom = roomRef.current as LightRoom;
          const nextOn = !worldRef.current.lights[lightRoom];
          updateWorld((w) => ({ ...w, lights: { ...w.lights, [lightRoom]: nextOn } }));
          showToast(t(nextOn ? "toast.lightsOn" : "toast.lightsOff"));
          break;
        }
        case "tv": {
          startAction("use");
          const next = TV_CYCLE[(TV_CYCLE.indexOf(worldRef.current.tv) + 1) % TV_CYCLE.length];
          updateWorld({ tv: next });
          showToast(t(TV_TOAST[next]));
          break;
        }
        case "radio": {
          startAction("use");
          const nextOn = !worldRef.current.radioOn;
          updateWorld({ radioOn: nextOn });
          showToast(t(nextOn ? "toast.radioOn" : "toast.radioOff"));
          break;
        }
        case "kettle": {
          if (worldRef.current.kettleOn) {
            startAction("drink");
            showToast(t("toast.drink"));
          } else {
            startAction("use");
            updateWorld({ kettleOn: true });
            showToast(t("toast.kettle"));
          }
          break;
        }
        case "window": {
          const id = obj.id as keyof WorldState["windows"];
          const win = worldRef.current.windows[id];
          if (!win.open) {
            startAction("use");
            updateWorld((w) => ({
              ...w,
              windows: { ...w.windows, [id]: { open: true, smoked: false } },
            }));
            showToast(t("toast.windowOpen"));
          } else if (!win.smoked) {
            startAction("smoke");
            updateWorld((w) => ({
              ...w,
              windows: { ...w.windows, [id]: { open: true, smoked: true } },
            }));
            showToast(t("toast.windowSmoke"));
          } else {
            startAction("use");
            updateWorld((w) => ({
              ...w,
              windows: { ...w.windows, [id]: { open: false, smoked: false } },
            }));
            showToast(t("toast.windowClose"));
          }
          break;
        }
        case "toilet": {
          blackout(1000, t("toast.toilet"));
          break;
        }
        case "bath": {
          blackout(2000, t("toast.tub"));
          break;
        }
        case "washer": {
          startAction("use");
          const nextOn = !worldRef.current.washerOn;
          updateWorld({ washerOn: nextOn });
          showToast(t(nextOn ? "toast.washerOn" : "toast.washerOff"));
          break;
        }
        case "openable": {
          startAction("use");
          const key = obj.id === "fridge" ? "fridgeOpen" : "wardrobeOpen";
          const nextOpen = !worldRef.current[key];
          updateWorld({ [key]: nextOpen });
          showToast(t(`toast.${obj.id}${nextOpen ? "Open" : "Close"}`));
          break;
        }
        case "sport": {
          if (!obj.action) return;
          startAction(obj.action);
          showToast(t(`toast.${obj.id}`));
          if (obj.action === "call") {
            // the rest of the conversation, cancelled if he walks away
            callTimers.current = [
              window.setTimeout(() => showToast(t("toast.call2")), 3200),
              window.setTimeout(() => showToast(t("toast.call3")), 6600),
            ];
          }
          if (obj.action === "pray") {
            callTimers.current = [window.setTimeout(() => showToast(t("toast.pray2")), 2400)];
          }
          break;
        }
        case "dog": {
          startAction("pet");
          const pets = worldRef.current.dogPets + 1;
          updateWorld({ dogPets: pets });
          showToast(t(`dog.${pets % 4}`));
          heartSeq += 1;
          const heart = { id: heartSeq, x: obj.x + (pets % 3) * 6 - 6 };
          setHearts((current) => [...current.slice(-4), heart]);
          window.setTimeout(() => {
            setHearts((current) => current.filter((h) => h.id !== heart.id));
          }, 1100);
          break;
        }
        case "flavor": {
          showToast(t(`flavor.${obj.id}`));
          break;
        }
        case "panel": {
          if (obj.panel) setOverlay({ type: "panel", id: obj.panel });
          break;
        }
        case "computer": {
          setOverlay({ type: "terminal" });
          break;
        }
      }
    },
    [blackout, showToast, t, updateWorld],
  );

  // --- keyboard input ---------------------------------------------------------
  // Matches on event.code (physical key), so QWERTY letters keep working on
  // Cyrillic and any other keyboard layout.
  useEffect(() => {
    const MODIFIER_CODES = /^(Shift|Control|Alt|Meta)/;
    const onKeyDown = (event: KeyboardEvent) => {
      if (introRef.current) {
        if (!MODIFIER_CODES.test(event.code)) {
          setIntro(false);
        }
        return;
      }
      if (overlayRef.current) {
        if (event.code === "Escape") {
          event.preventDefault();
          setOverlay(null);
        }
        if (overlayRef.current.type === "menu" && (event.code === "Tab" || event.code === "KeyM")) {
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
          event.preventDefault();
          setOverlay({ type: "menu" });
          break;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        keys.current.left = false;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        keys.current.right = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [interact]);

  // --- touch: hold screen edges to walk, tap middle to interact ---------------
  const pointerWalk = useCallback(
    (event: React.PointerEvent) => {
      if (introRef.current || overlayRef.current || fadingRef.current) return;
      if ((event.target as HTMLElement).closest("button")) return;
      const el = viewportRef.current;
      if (!el) return;
      const rel = (event.clientX - el.getBoundingClientRect().left) / el.clientWidth;
      if (rel < 0.38) {
        keys.current.left = true;
      } else if (rel > 0.62) {
        keys.current.right = true;
      } else {
        interact(nearRef.current);
      }
    },
    [interact],
  );

  const pointerStop = useCallback(() => {
    keys.current.left = false;
    keys.current.right = false;
  }, []);

  // --- game loop ---------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const { scale, w: viewW, h: viewH } = viewRef.current;
      const roomDef = ROOMS[roomRef.current];

      // action animation state
      let actionFrame: FrameName | null = null;
      const act = actionRef.current;
      if (act) {
        const def = ACTIONS[act.id];
        const elapsed = now - act.start;
        const interrupted = def.interruptible && (keys.current.left || keys.current.right);
        if (elapsed >= actionDuration(def) || interrupted) {
          actionRef.current = null;
          setActionUi(null);
          if (interrupted && (act.id === "call" || act.id === "pray")) {
            // walking off mid-sentence: drop the queued lines
            for (const timer of callTimers.current) window.clearTimeout(timer);
            callTimers.current = [];
          }
        } else {
          actionFrame = def.frames[Math.floor(elapsed / def.frameMs) % def.frames.length];
        }
      }

      const paused =
        introRef.current ||
        overlayRef.current !== null ||
        fadingRef.current ||
        actionFrame !== null;

      const p = pos.current;
      let moving = false;
      if (!paused) {
        let dir = 0;
        if (keys.current.left) dir -= 1;
        if (keys.current.right) dir += 1;
        if (dir !== 0) {
          p.facing = dir;
          const nx = p.x + dir * WALK_SPEED * dt;
          p.x = Math.max(20, Math.min(roomDef.width - 20, nx));
          p.walkDist += Math.abs(dir * WALK_SPEED * dt);
          moving = true;
        }
      }

      // nearest interactable — only push to React when it changes
      const nearest = paused ? nearRef.current : nearestObject(roomDef, p.x);
      if ((nearest?.id ?? null) !== (nearRef.current?.id ?? null)) {
        nearRef.current = nearest;
        setNear(nearest);
      }

      // camera
      const roomPx = roomDef.width * scale;
      const sceneTop = Math.max(0, (viewH - GAME_HEIGHT * scale) / 2);
      let worldX: number;
      if (roomPx <= viewW) {
        worldX = (viewW - roomPx) / 2;
      } else {
        const cam = Math.max(0, Math.min(p.x * scale - viewW / 2, roomPx - viewW));
        worldX = -cam;
      }
      const scene = sceneRef.current;
      if (scene) {
        scene.style.transform = `translate3d(${worldX}px, ${sceneTop}px, 0)`;
      }

      // player transform + frame
      const player = playerRef.current;
      if (player) {
        const px = (p.x - PLAYER_W / 2) * scale;
        const py = (FLOOR_Y - PLAYER_H) * scale;
        player.style.transform = `translate3d(${px}px, ${py}px, 0) scaleX(${p.facing})`;
      }
      // idle life: breathing bob, blinks, and every ~11s a flourish —
      // an overhead stretch up to the toes, or a glance over the shoulder.
      let idleFrame: FrameName = "stand";
      if (!moving && !actionFrame) {
        const breath: FrameName = now % 1700 < 850 ? "stand" : "idleB";
        idleFrame = now % 4200 < 170 ? "blink" : breath;
        const IDLE_SPAN = 11000;
        const idlePhase = now % IDLE_SPAN;
        if (idlePhase > 8000) {
          const flourish = Math.floor(now / IDLE_SPAN) % 2;
          const ft = idlePhase - 8000;
          if (roomRef.current === "balcony") {
            // on the balcony he just leans on the railing and watches the courtyard
            idleFrame = ft < 2600 ? "leanIdle" : breath;
          } else if (flourish === 0) {
            idleFrame =
              ft < 500 ? "stretchA" : ft < 1900 ? "stretchB" : ft < 2400 ? "stretchA" : breath;
          } else {
            idleFrame = ft < 1600 ? "lookBack" : breath;
          }
        }
      }
      const frame: FrameName =
        actionFrame ??
        (moving ? WALK_CYCLE[Math.floor(p.walkDist / 16) % WALK_CYCLE.length] : idleFrame);
      for (const key of Object.keys(PLAYER_FRAMES)) {
        const g = frameRefs.current[key];
        if (g) g.style.display = key === frame ? "" : "none";
      }

      if (import.meta.env.DEV) {
        (window as unknown as { __game?: object }).__game = {
          room: roomRef.current,
          x: Math.round(p.x),
          frame,
          phase: phaseRef.current,
        };
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- render --------------------------------------------------------------------
  const { scale } = view;
  const roomDef = ROOMS[room];

  // Interior rooms darken with the day phase and their own light; the balcony art
  // paints its own sky, so it only gets a thin night tint.
  const darkness =
    room === "balcony" ? (phase === "night" ? 0.3 : 0) : roomDarkness(phase, world.lights[room]);

  // Cigarette at an open window: puffs rise from the window itself.
  const smokeWindow =
    actionUi === "smoke" && room !== "balcony"
      ? roomDef.objects.find((o) => o.kind === "window")
      : undefined;

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
          ref={sceneRef}
          className="absolute top-0 left-0 will-change-transform"
          style={{ width: roomDef.width * scale, height: GAME_HEIGHT * scale }}
        >
          <RoomScene room={room} width={roomDef.width} world={world} phase={phase} />

          {/* kettle steam */}
          {world.kettleOn && room === "kitchen" ? (
            <div
              className="pointer-events-none absolute"
              style={{ left: 80 * scale, top: 88 * scale }}
            >
              <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
              <div
                className="steam steam-2"
                style={{ width: 3 * scale, height: 3 * scale, marginLeft: 5 * scale }}
              />
            </div>
          ) : null}

          {/* radio notes */}
          {world.radioOn && room === "kitchen" ? (
            <div
              className="pointer-events-none absolute text-parchment"
              style={{ left: 250 * scale, top: 62 * scale, fontSize: 6 * scale }}
            >
              <span className="note">♪</span>
              <span className="note note-2">♬</span>
            </div>
          ) : null}

          {/* hearts above Gross */}
          <AnimatePresence>
            {room === "living"
              ? hearts.map((heart) => (
                  <motion.div
                    key={heart.id}
                    className="pointer-events-none absolute"
                    style={{ left: heart.x * scale, width: 10 * scale, height: 8 * scale }}
                    initial={{ top: 122 * scale, opacity: 1 }}
                    animate={{ top: 100 * scale, opacity: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  >
                    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 10 8">
                      <PixelMap map={HEART} palette={HEART_PALETTE} />
                    </svg>
                  </motion.div>
                ))
              : null}
          </AnimatePresence>

          {/* player */}
          <div
            ref={playerRef}
            className="pixelated absolute top-0 left-0 will-change-transform"
            style={{ width: PLAYER_W * scale, height: PLAYER_H * scale }}
          >
            <svg
              aria-hidden="true"
              width="100%"
              height="100%"
              viewBox={`0 0 ${PLAYER_W} ${PLAYER_H}`}
            >
              {(Object.keys(PLAYER_FRAMES) as FrameName[]).map((key) => (
                <g
                  key={key}
                  ref={(el) => {
                    frameRefs.current[key] = el;
                  }}
                  style={{ display: key === "stand" ? "" : "none" }}
                >
                  <PixelMap map={PLAYER_FRAMES[key]} palette={PLAYER_PALETTE} />
                </g>
              ))}
            </svg>
          </div>

          {/* the parapet passes in front of the player */}
          {room === "balcony" ? <BalconyForeground /> : null}

          {/* cigarette smoke over the railing */}
          {actionUi === "smoke" && room === "balcony" ? (
            <div
              className="pointer-events-none absolute"
              style={{ left: 122 * scale, top: 88 * scale }}
            >
              <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
              <div
                className="steam steam-2"
                style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
              />
            </div>
          ) : null}

          {/* cigarette smoke at an open window */}
          {smokeWindow ? (
            <div
              className="pointer-events-none absolute"
              style={{ left: smokeWindow.x * scale, top: 82 * scale }}
            >
              <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
              <div
                className="steam steam-2"
                style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
              />
            </div>
          ) : null}

          {/* day-phase + per-room-light darkness */}
          <div
            className="pointer-events-none absolute inset-0 bg-[#0a1230] transition-opacity duration-500"
            style={{ opacity: darkness, mixBlendMode: "multiply" }}
          />
          {world.tv !== "off" && room === "living" && darkness > 0.3 ? (
            <div
              className="pointer-events-none absolute"
              style={{
                left: 52 * scale,
                top: 84 * scale,
                width: 100 * scale,
                height: 70 * scale,
                background: "radial-gradient(closest-side, #9fc7d666, transparent)",
              }}
            />
          ) : null}
        </div>

        {/* HUD */}
        {!intro && !overlay ? (
          <>
            <Hud room={room} />
            <div
              className="absolute bottom-16 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-6"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <AnimatePresence>
                {toast ? (
                  <motion.p
                    key={toast.id}
                    className="max-w-md px-4 text-center text-parchment text-sm leading-relaxed"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {toast.text}
                  </motion.p>
                ) : null}
              </AnimatePresence>
              {near && !toast ? (
                <p className="text-parchment/80 text-sm tracking-[0.2em]">
                  ▸ {t(`obj.${near.id}`)} <span className="text-signal">[E]</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="absolute top-3 right-4 bg-black/50 px-2 py-1 text-parchment/70 text-xs tracking-[0.2em] hover:text-signal"
              onClick={() => setOverlay({ type: "menu" })}
            >
              {t("ui.menu")} [TAB]
            </button>

            {/* touch controls */}
            <div
              className="absolute right-0 bottom-0 left-0 hidden justify-between p-4 [@media(pointer:coarse)]:flex"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label={t("ui.left")}
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
                  aria-label={t("ui.right")}
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
                aria-label={t("ui.interact")}
                className="h-14 w-14 border border-signal/50 bg-black/40 text-signal text-xl active:bg-signal/20"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => interact(nearRef.current)}
              >
                ●
              </button>
            </div>
          </>
        ) : null}

        {/* overlays */}
        <AnimatePresence>
          {overlay?.type === "panel" ? (
            <Panel key="panel" id={overlay.id} onClose={() => setOverlay(null)} />
          ) : null}
          {overlay?.type === "terminal" ? (
            <Terminal key="terminal" onClose={() => setOverlay(null)} />
          ) : null}
          {overlay?.type === "menu" ? (
            <StatusMenu
              key="menu"
              world={world}
              visited={[room]}
              scenes={Object.keys(ROOMS)}
              onClose={() => setOverlay(null)}
            />
          ) : null}
        </AnimatePresence>

        {/* room-transition / off-screen fade */}
        <div
          className="pointer-events-none absolute inset-0 bg-black transition-opacity"
          style={{ opacity: fade.on ? 1 : 0, transitionDuration: `${fade.ms}ms` }}
        />

        {/* intro */}
        {intro ? (
          <button
            type="button"
            className="absolute inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-6 bg-[#0a0810] text-center"
            onClick={() => setIntro(false)}
          >
            <p className="text-parchment/50 text-xs tracking-[0.4em]">{t("intro.small")}</p>
            <h1 className="font-mono text-2xl text-parchment tracking-[0.35em] sm:text-4xl">
              {t("intro.title")}
            </h1>
            <p className="max-w-sm px-6 text-parchment/60 text-sm leading-relaxed">
              {t("intro.sub")}
            </p>
            <p className="mt-4 animate-pulse text-signal text-sm tracking-[0.3em]">
              {t("intro.start")}
            </p>
          </button>
        ) : null}
      </div>
    </div>
  );
}
