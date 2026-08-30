import { motionPref, qualityPin, subscribePrefs } from "./prefs";
import type { InputAction, QualityTier } from "./runtime-types";

/**
 * runtime-perf.ts — the machinery under GameRuntime's hot loop.
 *
 * House rules for everything in this file:
 *  - no React, so it stays unit-testable in isolation;
 *  - no allocation inside anything a frame calls (pools and reused objects
 *    instead of fresh arrays/objects, so the GC never pauses a pan);
 *  - every subscription and timer is owned by something disposable.
 */

export const nowMs = (): number =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/* ------------------------------------------------------------------ timers */

/**
 * Every timeout the runtime opens goes through here, so unmount closes all of
 * them. The original scattered `window.setTimeout` calls across travel,
 * blackout, toasts and fx and leaked each one on unmount.
 */
export class Timers {
  private live = new Set<number>();

  after(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.live.delete(id);
      fn();
    }, ms);
    this.live.add(id);
    return id;
  }

  every(fn: () => void, ms: number): number {
    const id = window.setInterval(fn, ms);
    this.live.add(id);
    return id;
  }

  clear(id: number | undefined): void {
    if (id === undefined) return;
    window.clearTimeout(id);
    window.clearInterval(id);
    this.live.delete(id);
  }

  disposeAll(): void {
    for (const id of this.live) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    this.live.clear();
  }

  get size(): number {
    return this.live.size;
  }
}

/* -------------------------------------------------------------- game clock */

type Alarm = { id: number; at: number; fn: () => void };

/**
 * A pausable clock. `after` schedules on *game* time, so a callback armed
 * before a dialogue opens fires the right distance after it closes — and
 * nothing fires after unmount.
 */
export class GameClock {
  t = 0;
  private alarms: Alarm[] = [];
  private seq = 0;

  advance(dtMs: number): void {
    if (dtMs > 0) this.t += dtMs;
    if (this.alarms.length === 0 || this.alarms[0].at > this.t) return;
    let n = 0;
    while (n < this.alarms.length && this.alarms[n].at <= this.t) n++;
    const due = this.alarms.splice(0, n);
    for (const a of due) a.fn();
  }

  after(ms: number, fn: () => void): number {
    const alarm: Alarm = { id: ++this.seq, at: this.t + Math.max(0, ms), fn };
    let i = this.alarms.length;
    while (i > 0 && this.alarms[i - 1].at > alarm.at) i--;
    this.alarms.splice(i, 0, alarm);
    return alarm.id;
  }

  cancel(id: number): void {
    const i = this.alarms.findIndex((a) => a.id === id);
    if (i >= 0) this.alarms.splice(i, 1);
  }

  clear(): void {
    this.alarms.length = 0;
  }

  get pending(): number {
    return this.alarms.length;
  }
}

/* ------------------------------------------------------------------ fx pool */

export type FxSlot = {
  id: number;
  kind: string;
  x: number;
  data?: unknown;
  bornAt: number;
  ttl: number;
  alive: boolean;
};

/**
 * Fixed-capacity pool. Slot objects are recycled, so a fireworks-heavy scene
 * allocates once and never again, and expiry is swept in the loop instead of
 * arming one `setTimeout` per particle.
 */
export class FxPool {
  private slots: FxSlot[] = [];
  private snap: FxSlot[] = [];
  private dirty = true;
  private seq = 0;

  constructor(private capacity = 24) {}

  spawn(kind: string, x: number, ttlMs: number, data: unknown, t: number): FxSlot {
    let slot: FxSlot | undefined;
    for (const s of this.slots) {
      if (!s.alive) {
        slot = s;
        break;
      }
    }
    if (!slot) {
      if (this.slots.length < this.capacity) {
        slot = { id: 0, kind: "", x: 0, bornAt: 0, ttl: 0, alive: false };
        this.slots.push(slot);
      } else {
        // full: steal whichever slot dies soonest
        slot = this.slots[0];
        for (const s of this.slots) if (s.bornAt + s.ttl < slot.bornAt + slot.ttl) slot = s;
      }
    }
    slot.id = ++this.seq;
    slot.kind = kind;
    slot.x = x;
    slot.data = data;
    slot.bornAt = t;
    slot.ttl = ttlMs;
    slot.alive = true;
    this.dirty = true;
    return slot;
  }

  /** Returns true when membership changed, which is the only time React hears. */
  sweep(t: number): boolean {
    let changed = false;
    for (const s of this.slots) {
      if (s.alive && t - s.bornAt >= s.ttl) {
        s.alive = false;
        s.data = undefined; // drop payload references so they can be collected
        changed = true;
      }
    }
    if (changed) this.dirty = true;
    return changed;
  }

  clear(): boolean {
    let changed = false;
    for (const s of this.slots) {
      if (s.alive) {
        s.alive = false;
        s.data = undefined;
        changed = true;
      }
    }
    if (changed) this.dirty = true;
    return changed;
  }

  /** Stable array identity until membership actually changes — memo-friendly. */
  snapshot(): FxSlot[] {
    if (this.dirty) {
      this.snap = this.slots.filter((s) => s.alive);
      this.dirty = false;
    }
    return this.snap;
  }

  get aliveCount(): number {
    let n = 0;
    for (const s of this.slots) if (s.alive) n++;
    return n;
  }
}

/* ------------------------------------------------------- quality governor */

const RANK: Record<QualityTier, number> = { low: 0, medium: 1, high: 2 };

/**
 * Watches frame times and picks a quality tier, with asymmetric dwell times:
 * drop fast (900ms of pain), climb back slowly (4s of calm) so scenes never
 * oscillate. Scene art, Effects and Foreground get the tier as a CSS var and
 * a prop, and can shed work themselves.
 */
export class QualityGovernor {
  ema = 16.7;
  tier: QualityTier = "high";
  private mark = 0;

  constructor(
    private targetFps = 60,
    private onChange?: (tier: QualityTier) => void,
  ) {}

  reset(now: number): void {
    this.ema = 1000 / this.targetFps;
    this.mark = now;
  }

  sample(frameMs: number, now: number): void {
    // A player who has chosen a tier has taken the decision off us. Pinning
    // LOW on a fast machine is a real request — it is usually a battery — so
    // this is a floor as well as a ceiling, and the ema stops mattering.
    const pin = qualityPin();
    if (pin) {
      if (this.tier !== pin) {
        this.tier = pin;
        this.onChange?.(pin);
      }
      this.mark = now;
      return;
    }
    // ignore tab-switch spikes; they say nothing about steady-state cost
    if (!(frameMs > 0) || frameMs > 400) {
      this.mark = now;
      return;
    }
    this.ema += (frameMs - this.ema) * 0.08;
    const budget = 1000 / this.targetFps;
    const want: QualityTier =
      this.ema > budget * 1.45 ? "low" : this.ema > budget * 1.18 ? "medium" : "high";
    if (want === this.tier) {
      this.mark = now;
      return;
    }
    const dropping = RANK[want] < RANK[this.tier];
    if (now - this.mark < (dropping ? 900 : 4000)) return;
    this.mark = now;
    // drops jump straight to the tier we need; recoveries step up one rung
    this.tier = dropping ? want : RANK[this.tier] === 0 ? "medium" : "high";
    this.onChange?.(this.tier);
  }
}

/* ----------------------------------------------------------- visible band */

export type Band = { x0: number; x1: number };

export type BandStore = {
  get(): Band;
  set(x0: number, x1: number): void;
  subscribe(fn: () => void): () => void;
};

/**
 * The slice of the world currently on screen, quantized so a settled camera
 * stops notifying. Scene art wraps expensive regions in <CullBox> and they
 * unmount when the camera leaves — the difference between "hundreds of rects"
 * and "hundreds of rects per screen".
 */
export function createBandStore(quantum = 32): BandStore {
  let band: Band = { x0: Number.NEGATIVE_INFINITY, x1: Number.POSITIVE_INFINITY };
  const subs = new Set<() => void>();
  return {
    get: () => band,
    set(x0, x1) {
      const q0 = Math.floor(x0 / quantum) * quantum;
      const q1 = Math.ceil(x1 / quantum) * quantum;
      if (q0 === band.x0 && q1 === band.x1) return;
      band = { x0: q0, x1: q1 };
      for (const fn of subs) fn();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

export const OPEN_BAND: Band = {
  x0: Number.NEGATIVE_INFINITY,
  x1: Number.POSITIVE_INFINITY,
};

/* ---------------------------------------------------------- sprite atlas */

export type RasterAtlas = {
  canvas: HTMLCanvasElement;
  index: Record<string, number>;
  cols: number;
  rows: number;
  /** frames per atlas row — the sheet is a grid, not one strip */
  perRow: number;
  frameCount: number;
  cells: number;
};

/** Normalise the shapes PixelSprite maps come in to a grid of palette keys. */
export function mapToRows(map: unknown): string[][] | null {
  if (typeof map === "string") {
    const rows = map.split("\n").filter((r) => r.length > 0);
    return rows.length > 0 ? rows.map((r) => Array.from(r)) : null;
  }
  if (map && typeof map === "object" && !Array.isArray(map)) {
    const inner =
      (map as { rows?: unknown; data?: unknown }).rows ?? (map as { data?: unknown }).data;
    return inner === undefined ? null : mapToRows(inner);
  }
  if (!Array.isArray(map) || map.length === 0) return null;
  const head: unknown = map[0];
  if (typeof head === "string") return (map as string[]).map((r) => Array.from(r));
  if (Array.isArray(head)) {
    return (map as unknown[][]).map((r) => r.map((c) => (typeof c === "string" ? c : String(c))));
  }
  return null; // flat numeric buffers need a stride we can't infer — DOM path handles them
}

const TRANSPARENT_KEYS = new Set([" ", "", ".", "_", "\t"]);

/**
 * Bake every frame of a sprite into one atlas canvas at 1 canvas pixel per
 * sprite cell. A 20-frame character stops being ~1000 live SVG rects and
 * becomes a few KB of bitmap plus a single drawImage per frame change.
 *
 * Returns null on any shape it doesn't recognise, so callers fall back to DOM.
 */
export function rasterizeFrames(
  frames: Record<string, unknown>,
  palette: Record<string, string>,
): RasterAtlas | null {
  if (typeof document === "undefined") return null;
  const keys = Object.keys(frames);
  if (keys.length === 0) return null;

  const grids: string[][][] = [];
  let cols = 0;
  let rows = 0;
  for (const key of keys) {
    const grid = mapToRows(frames[key]);
    if (!grid) return null;
    grids.push(grid);
    if (grid.length > rows) rows = grid.length;
    for (const row of grid) if (row.length > cols) cols = row.length;
  }
  if (cols === 0 || rows === 0) return null;

  // A grid rather than a strip: with layered and mood twins a character runs
  // to a thousand frames, and a 24 000 px wide canvas is past what several
  // browsers will allocate. Roughly square instead.
  const perRow = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
  const canvas = document.createElement("canvas");
  canvas.width = cols * perRow;
  canvas.height = rows * Math.ceil(keys.length / perRow);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  for (let f = 0; f < grids.length; f++) {
    const grid = grids[f];
    const ox = (f % perRow) * cols;
    const oy = Math.floor(f / perRow) * rows;
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      let x = 0;
      while (x < row.length) {
        const key = row[x];
        const color = TRANSPARENT_KEYS.has(key) ? undefined : palette[key];
        if (!color || color === "transparent" || color === "none") {
          x++;
          continue;
        }
        // run-length the fill so a wide block of one colour is one call
        let run = 1;
        while (x + run < row.length && row[x + run] === key) run++;
        ctx.fillStyle = color;
        ctx.fillRect(ox + x, oy + y, run, 1);
        x += run;
      }
    }
  }

  const index: Record<string, number> = {};
  keys.forEach((key, i) => {
    index[key] = i;
  });
  return {
    canvas,
    index,
    cols,
    rows,
    perRow,
    frameCount: keys.length,
    cells: cols * rows * keys.length,
  };
}

/** Blits one atlas frame into a display canvas, skipping unchanged draws. */
export class AtlasSprite {
  private ctx: CanvasRenderingContext2D | null = null;
  private lastFrame = "";
  private lastW = 0;
  private lastH = 0;

  constructor(readonly atlas: RasterAtlas) {}

  attach(canvas: HTMLCanvasElement | null): void {
    if (!canvas) {
      this.ctx = null;
      return;
    }
    this.ctx = canvas.getContext("2d");
    this.lastFrame = "";
    this.lastW = 0;
  }

  invalidate(): void {
    this.lastFrame = "";
  }

  /** Returns true when it actually touched the canvas. */
  draw(frame: string, cssW: number, cssH: number, dpr: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const col = this.atlas.index[frame];
    if (col === undefined) return false;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    const resized = w !== this.lastW || h !== this.lastH;
    if (!resized && frame === this.lastFrame) return false;
    if (resized) {
      ctx.canvas.width = w;
      ctx.canvas.height = h;
      ctx.canvas.style.width = `${cssW}px`;
      ctx.canvas.style.height = `${cssH}px`;
      this.lastW = w;
      this.lastH = h;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(
      this.atlas.canvas,
      (col % this.atlas.perRow) * this.atlas.cols,
      Math.floor(col / this.atlas.perRow) * this.atlas.rows,
      this.atlas.cols,
      this.atlas.rows,
      0,
      0,
      w,
      h,
    );
    this.lastFrame = frame;
    return true;
  }

  dispose(): void {
    // detach only — the atlas canvas is owned by the useMemo above and must
    // survive a StrictMode unmount/remount cycle; zeroing it here left the
    // remounted sprite blitting from a 0×0 source (InvalidStateError storm)
    this.ctx = null;
  }
}

/* ------------------------------------------------------------------ input */

/**
 * The vertical keys are contextual, matching what the player sees:
 *  - in a ground-band scene ArrowUp/W walk away from the camera and
 *    ArrowDown/S toward it;
 *  - in a flat scene they cycle interaction targets, exactly as they always
 *    did — a flat room has nothing else for them to do, and losing the
 *    cycling gesture there was a regression;
 *  - in a dialogue they move the choice cursor either way.
 * Q/Z cycle targets unconditionally (the only way in a band scene), and the
 * gamepad shoulders and tap-to-pick always work.
 */
export const DEFAULT_KEYMAP: Record<InputAction, string[]> = {
  run: ["ShiftLeft", "ShiftRight"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  interact: ["KeyE", "Enter", "NumpadEnter", "Space"],
  cancel: ["Escape"],
  menu: ["Tab", "KeyM"],
  targetNext: ["KeyQ"],
  targetPrev: ["KeyZ"],
  debug: ["F3", "Backquote"],
};

/** One flat code→action map, built once, so keydown is a single lookup. */
export function buildKeymap(
  overrides?: Partial<Record<InputAction, string[]>>,
): Map<string, InputAction> {
  const merged: Record<InputAction, string[]> = { ...DEFAULT_KEYMAP, ...(overrides ?? {}) };
  const map = new Map<string, InputAction>();
  for (const action of Object.keys(merged) as InputAction[]) {
    for (const code of merged[action] ?? []) map.set(code, action);
  }
  return map;
}

export type PadState = {
  connected: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  interact: boolean;
  cancel: boolean;
  menu: boolean;
  next: boolean;
  prev: boolean;
};

export const newPadState = (): PadState => ({
  connected: false,
  left: false,
  right: false,
  up: false,
  down: false,
  interact: false,
  cancel: false,
  menu: false,
  next: false,
  prev: false,
});

/** Polled, not evented — a gamepad read costs nothing and allocates nothing here. */
export function readPad(out: PadState, deadzone = 0.35): PadState {
  out.connected = false;
  out.left = out.right = out.up = out.down = false;
  out.interact = out.cancel = out.menu = out.next = out.prev = false;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav?.getGamepads) return out;
  const pads = nav.getGamepads();
  for (const pad of pads) {
    if (!pad?.connected) continue;
    out.connected = true;
    const axis = pad.axes.length > 0 ? pad.axes[0] : 0;
    const axisY = pad.axes.length > 1 ? pad.axes[1] : 0;
    const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);
    if (axis < -deadzone || btn(14)) out.left = true;
    if (axis > deadzone || btn(15)) out.right = true;
    if (axisY < -deadzone || btn(12)) out.up = true;
    if (axisY > deadzone || btn(13)) out.down = true;
    if (btn(0)) out.interact = true;
    if (btn(1)) out.cancel = true;
    if (btn(9) || btn(8)) out.menu = true;
    if (btn(5)) out.next = true;
    if (btn(4)) out.prev = true;
  }
  return out;
}

/** Nearest object under a world-space x, for tap/click targeting. */
export function pickObject<T extends { id: string; x: number }>(
  objects: readonly T[],
  worldX: number,
  basePad = 16,
): T | null {
  let best: T | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const obj of objects) {
    const meta = obj as { width?: number; hitPad?: number };
    const reach = (meta.width ?? 0) / 2 + (meta.hitPad ?? 0) + basePad;
    const d = Math.abs(obj.x - worldX);
    if (d <= reach && d < bestD) {
      best = obj;
      bestD = d;
    }
  }
  return best;
}

/* ---------------------------------------------------------- reduced motion */

/**
 * Whether to hold everything still.
 *
 * Two sources, either of which is enough: the operating system's own
 * preference, and the game's MOTION setting. The setting can only ever add
 * stillness — there is no value of it that overrides an OS-level request to
 * stop moving things, because that request is usually made for a medical
 * reason and a game menu does not get to outvote it.
 */
export function prefersReducedMotion(): boolean {
  if (motionPref() === "reduce") return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Notifies on either source changing, so every consumer sees both. */
export function subscribeReducedMotion(fn: (on: boolean) => void): () => void {
  const emit = () => fn(prefersReducedMotion());
  const offPrefs = subscribePrefs(emit);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return offPrefs;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", emit);
  return () => {
    offPrefs();
    mq.removeEventListener("change", emit);
  };
}

/* -------------------------------------------------------------- misc utils */

/** Toggle GPU promotion, because a permanent will-change costs GPU memory. */
export function promote(el: HTMLElement | null, on: boolean, cache: { on: boolean }): void {
  if (!el || cache.on === on) return;
  cache.on = on;
  el.style.willChange = on ? "transform" : "auto";
}

export function heapMb(): number | null {
  const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === "number" ? Math.round(used / 1048576) : null;
}

export function idle(fn: () => void, timeout = 1200): () => void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}
