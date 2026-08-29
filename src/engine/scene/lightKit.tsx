import type { ReactNode } from "react";
import {
  FLICKER,
  type Flicker,
  Light,
  type LightTier,
  type Ph,
  pxPath,
  type Rect,
  steppedCone,
  steppedEllipse,
  steppedQuad,
  type Tint,
  tiers,
} from "./pixelKit";

/**
 * The light kit — every way this game puts light into a scene, and every way
 * it takes it away.
 *
 * Built on `tiers()`: a light is four solid steps at whisper alpha, never a
 * gradient, and the eye reads the overlap as falloff. What this module adds
 * is the FIXTURES — the shapes light actually takes when it comes out of a
 * tube, a window, a door, a sign, a screen, a fire — and the SHADOWS, which
 * are the other half of light and the half most scenes forget.
 *
 *   const TUBE = fixture(400, 40, 150);           // a ceiling tube and its pool
 *   <Fixture set={TUBE} lit={lit} />
 *
 *   const SPILL = windowSpill([200, 60, 40, 50], 150, { reach: 30, skew: 12 });
 *   <Light set={SPILL} op={night ? 1 : 0} />
 *
 *   const SUN = sunFor(ph);
 *   <path d={castShadow([300, 100, 8, 50], SUN)} fill="#171009" opacity={SUN.op} />
 *
 * Everything is precomputed at module scope and painted as a handful of
 * <path> nodes. Nothing allocates at render.
 */

/* ================================================================== *
 * fixtures — a source, the cone it throws, the pool where it lands
 * ================================================================== */

export type FixtureSet = {
  /** the cone from the fitting to the floor */
  cone: readonly LightTier[];
  /** the pool on the floor */
  pool: readonly LightTier[];
  /** the fitting itself: diffuser, core, end caps */
  diffuser: string;
  core: string;
  caps: string;
};

/**
 * A ceiling fixture — a fluorescent tube, an LED batten, a strip light —
 * `w` wide at `y`, throwing down onto a floor at `floorY`. The cone opens to
 * `spread` at the floor; the pool is `spread` wide and `poolH` deep.
 */
export function fixture(
  x: number,
  y: number,
  floorY: number,
  opts: { w?: number; spread?: number; poolH?: number; tint?: Tint; strength?: number } = {},
): FixtureSet {
  const { w = 54, spread = 78, poolH = 8, tint = "w", strength = 0.7 } = opts;
  const half = Math.round(w / 2);
  return {
    cone: tiers(
      (k) => steppedCone(x, y + 4, Math.round(half * 0.9 * k), floorY, Math.round(spread * k), 6),
      tint,
      strength,
    ),
    pool: tiers(
      (k) => steppedEllipse(x, floorY + 1, Math.round(spread * k), Math.round(poolH * k), 3),
      tint,
      strength * 0.85,
    ),
    diffuser: pxPath([[x - half, y, w, 4]]),
    core: pxPath([[x - half + 5, y + 1, w - 10, 2]]),
    caps: pxPath([
      [x - half - 2, y, 2, 4],
      [x + half, y, 2, 4],
    ]),
  };
}

/** Paint a fixture. `lit` false leaves the dead fitting and no light. */
export function Fixture({
  set,
  lit = true,
  op = 1,
  flicker,
  diffuser = "#fff8e0",
  core = "#ffffff",
  caps = "#5d6266",
}: {
  set: FixtureSet;
  lit?: boolean;
  op?: number;
  flicker?: keyof typeof FLICKER | Flicker;
  diffuser?: string;
  core?: string;
  caps?: string;
}) {
  const body = (
    <g>
      <path d={set.caps} fill={caps} />
      <path d={set.diffuser} fill={lit ? diffuser : "#8a8f8a"} opacity={lit ? 0.92 : 0.6} />
      {lit ? <path d={set.core} fill={core} opacity={0.9} /> : null}
      {lit ? <Light set={set.cone} op={op} /> : null}
      {lit ? <Light set={set.pool} op={op} /> : null}
    </g>
  );
  if (!lit || !flicker) return body;
  const f = typeof flicker === "string" ? FLICKER[flicker] : flicker;
  return (
    <g>
      {body}
      <animate
        attributeName="opacity"
        calcMode="discrete"
        values={f.values}
        keyTimes={f.keyTimes}
        dur={f.dur}
        repeatCount="indefinite"
      />
    </g>
  );
}

/**
 * A lamp on a column: the pool on the ground under it, and the halo round
 * the head. The column itself belongs to the scene.
 */
export function streetLamp(
  x: number,
  headY: number,
  groundY: number,
  opts: { reach?: number; tint?: Tint; strength?: number } = {},
) {
  const { reach = 96, tint = "c", strength = 0.55 } = opts;
  return {
    pool: tiers(
      (k) =>
        steppedEllipse(x, groundY + 10, Math.round(reach * k), Math.round(reach * 0.22 * k), 3),
      tint,
      strength,
    ),
    cone: tiers(
      (k) => steppedCone(x, headY, Math.round(10 * k), groundY, Math.round(reach * 0.7 * k), 8),
      tint,
      strength * 0.4,
    ),
    halo: tiers(
      (k) => steppedEllipse(x, headY, Math.round(14 * k), Math.round(10 * k), 2),
      tint,
      strength,
    ),
  };
}

/* ================================================================== *
 * spill — light that comes out of an opening onto a surface
 * ================================================================== */

/**
 * Light through a window landing on the floor: a stepped quad that starts the
 * width of the opening and spreads and shears as it falls, `reach` deep and
 * skewed `skew` pixels by the sun or the lamp behind it.
 */
export function windowSpill(
  opening: Rect,
  floorY: number,
  opts: { reach?: number; skew?: number; spread?: number; tint?: Tint; strength?: number } = {},
): readonly LightTier[] {
  const { reach = 26, skew = 0, spread = 10, tint = "w", strength = 0.9 } = opts;
  const [x, , w] = opening;
  const cx = x + w / 2;
  return tiers(
    (k) => {
      const top = (w / 2) * k;
      const bot = (w / 2 + spread) * k;
      const s = skew * k;
      return steppedQuad(
        floorY,
        Math.round(cx - top),
        Math.round(cx + top),
        floorY + Math.round(reach * k),
        Math.round(cx - bot + s),
        Math.round(cx + bot + s),
        4,
      );
    },
    tint,
    strength,
  );
}

/** Light out of a doorway: the same, but warm, wide and short. */
export function doorSpill(x: number, w: number, floorY: number, reach = 22, tint: Tint = "w") {
  return windowSpill([x, 0, w, 0], floorY, { reach, spread: 16, tint, strength: 1.2 });
}

/**
 * The glow of a lit room seen from outside, on the wall around its window —
 * the way a window is never just a bright rectangle at night.
 */
export function windowGlow(opening: Rect, tint: Tint = "w", strength = 0.6): readonly LightTier[] {
  const [x, y, w, h] = opening;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return tiers(
    (k) => steppedEllipse(cx, cy, Math.round((w / 2 + 10) * k), Math.round((h / 2 + 8) * k), 2),
    tint,
    strength,
  );
}

/* ================================================================== *
 * point sources — a bulb, a screen, a fire, a sign
 * ================================================================== */

/** A soft glow round a point: a candle, a phone screen, an indicator. */
export function glow(cx: number, cy: number, r: number, tint: Tint = "w", strength = 1) {
  return tiers(
    (k) => steppedEllipse(cx, cy, Math.round(r * k), Math.round(r * 0.7 * k), 2),
    tint,
    strength,
  );
}

/** The light a screen throws up onto a face and a wall: cold, upward, flat. */
export function screenLight(x: number, y: number, w: number, reach = 20) {
  return tiers(
    (k) =>
      steppedQuad(
        y - Math.round(reach * k),
        Math.round(x - 6 * k),
        Math.round(x + w + 6 * k),
        y,
        x,
        x + w,
        4,
      ),
    "b",
    0.8,
  );
}

export type NeonSet = {
  /** the tube itself */
  tube: string;
  /** the halo around it, three widening bands */
  halo: readonly string[];
  /** the throw onto the wall behind */
  wash: string;
};

/**
 * A neon tube in any colour — tiers are tint-locked, so neon carries its own
 * fill. Pass the letter/shape rects; you get the tube, three halo bands and the
 * wash it puts on the wall behind it.
 */
export function neon(rects: readonly Rect[]): NeonSet {
  const grow = (n: number) =>
    rects.map(([x, y, w, h]) => [x - n, y - n, w + 2 * n, h + 2 * n] as Rect);
  const b = rects.reduce(
    (acc, [x, y, w, h]) => [
      Math.min(acc[0], x),
      Math.min(acc[1], y),
      Math.max(acc[2], x + w),
      Math.max(acc[3], y + h),
    ],
    [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ],
  );
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  return {
    tube: pxPath(rects),
    halo: [pxPath(grow(1)), pxPath(grow(3)), pxPath(grow(6))],
    wash: pxPath(
      steppedEllipse(
        cx,
        cy,
        Math.round((b[2] - b[0]) / 2 + 16),
        Math.round((b[3] - b[1]) / 2 + 12),
        3,
      ),
    ),
  };
}

export function Neon({
  set,
  color,
  lit = true,
  flicker,
}: {
  set: NeonSet;
  color: string;
  lit?: boolean;
  flicker?: keyof typeof FLICKER | Flicker;
}) {
  if (!lit) return <path d={set.tube} fill={color} opacity={0.35} />;
  const body = (
    <g>
      <path d={set.wash} fill={color} opacity={0.06} />
      <path d={set.halo[2]} fill={color} opacity={0.08} />
      <path d={set.halo[1]} fill={color} opacity={0.14} />
      <path d={set.halo[0]} fill={color} opacity={0.3} />
      <path d={set.tube} fill={color} />
      <path d={set.tube} fill="#ffffff" opacity={0.55} transform="translate(0,-1)" />
    </g>
  );
  if (!flicker) return body;
  const f = typeof flicker === "string" ? FLICKER[flicker] : flicker;
  return (
    <g>
      {body}
      <animate
        attributeName="opacity"
        calcMode="discrete"
        values={f.values}
        keyTimes={f.keyTimes}
        dur={f.dur}
        repeatCount="indefinite"
      />
    </g>
  );
}

/* ================================================================== *
 * the sun — direction, length, and the shadows it makes
 * ================================================================== */

export type Sun = { dx: number; len: number; op: number } | null;

/**
 * Where the sun is, per phase, as a shadow recipe: `dx` the sideways throw per
 * unit of height, `len` the fraction of an object's height its shadow runs,
 * `op` how dark. Night is null — no sun, no cast shadows, only the lamps.
 */
export const SUNS: Record<Ph, Sun> = {
  dawn: { dx: 1.1, len: 1.6, op: 0.3 },
  day: { dx: 0.3, len: 0.5, op: 0.24 },
  dusk: { dx: -1.2, len: 1.8, op: 0.28 },
  night: null,
};
export const sunFor = (ph: Ph): Sun => SUNS[ph];

/**
 * The shadow an upright throws along the ground. `upright` is the thing —
 * a post, a person, a bollard — and the shadow starts at its foot and runs
 * `len × height` sideways in the sun's direction, foreshortened to a third of
 * that in depth, in four-pixel courses so it stays on the grid.
 */
export function castShadow(upright: Rect, sun: Sun, groundY?: number): string {
  if (!sun) return "";
  const [x, y, w, h] = upright;
  const foot = groundY ?? y + h;
  const run = Math.round(h * sun.len);
  const depth = Math.max(3, Math.round(run * 0.22));
  const dx = Math.round(run * sun.dx);
  return pxPath(steppedQuad(foot, x, x + w, foot + depth, x + dx, x + w + dx, 3));
}

/** Shadows for many uprights at once: one path. */
export function castShadows(uprights: readonly Rect[], sun: Sun, groundY?: number): string {
  if (!sun) return "";
  return uprights.map((u) => castShadow(u, sun, groundY)).join("");
}

/**
 * A shaft of sun through an opening onto a wall or floor: the raking band that
 * says "morning" or "evening" in one shape. `skew` is how far the band drops
 * across its width.
 */
export function sunShaft(
  x0: number,
  x1: number,
  y: number,
  h: number,
  skew: number,
  tint: Tint = "e",
) {
  const cols = Math.ceil((x1 - x0) / 6);
  return tiers(
    (k) => {
      const out: Rect[] = [];
      const hh = Math.round(h * k);
      for (let c = 0; c < cols; c++) {
        const dy = Math.round((skew * c) / cols);
        out.push([x0 + c * 6, y + dy + Math.round((h - hh) / 2), 6, hh]);
      }
      return out;
    },
    tint,
    0.7,
  );
}

/* ================================================================== *
 * occlusion — the dark that gives light something to be against
 * ================================================================== */

/** The shadow under any overhang: a sill, a canopy, a shelf, a car. */
export function underShade(rects: readonly Rect[], depth = 3): readonly [string, string, string] {
  const a: Rect[] = [];
  const b: Rect[] = [];
  const c: Rect[] = [];
  for (const [x, y, w, h] of rects) {
    a.push([x, y + h, w, Math.max(1, Math.round(depth * 0.4))]);
    b.push([x, y + h + Math.round(depth * 0.4), w, Math.max(1, Math.round(depth * 0.4))]);
    c.push([x + 1, y + h + Math.round(depth * 0.8), w - 2, 1]);
  }
  return [pxPath(a), pxPath(b), pxPath(c)];
}

export function UnderShade({
  set,
  op = 1,
}: {
  set: readonly [string, string, string];
  op?: number;
}) {
  return (
    <g opacity={op}>
      <path d={set[0]} fill="#171009" opacity={0.24} />
      <path d={set[1]} fill="#171009" opacity={0.13} />
      <path d={set[2]} fill="#171009" opacity={0.07} />
    </g>
  );
}

/** The 1 px rim of light along the lit edge of a set of rects. */
export function rimLight(
  rects: readonly Rect[],
  side: "top" | "left" | "top-left" = "top-left",
): string {
  const out: Rect[] = [];
  for (const [x, y, w, h] of rects) {
    if (side !== "left") out.push([x, y, w, 1]);
    if (side !== "top") out.push([x, y, 1, h]);
  }
  return pxPath(out);
}

/** The corner shadow where a wall meets a floor: two rows, fading. */
export function cornerShade(x0: number, x1: number, y: number): readonly [string, string] {
  return [pxPath([[x0, y, x1 - x0, 2]]), pxPath([[x0, y + 2, x1 - x0, 2]])];
}

/* ================================================================== *
 * the hour — one wash per phase, and the colours things go
 * ================================================================== */

/**
 * The full-frame veil each phase lays over a scene, for the scenes that do
 * not palette-shift. Dawn is thin and violet, dusk warm, night blue and
 * deep. Paint it last, above everything but the lamps.
 */
export const PHASE_WASH: Record<Ph, { fill: string; op: number }> = {
  dawn: { fill: "#8c86a8", op: 0.1 },
  day: { fill: "#ffffff", op: 0 },
  dusk: { fill: "#c98a52", op: 0.12 },
  night: { fill: "#0a1230", op: 0.42 },
};

export function PhaseWash({
  ph,
  w,
  h,
  boost = 1,
}: {
  ph: Ph;
  w: number;
  h: number;
  boost?: number;
}) {
  const v = PHASE_WASH[ph];
  if (v.op === 0) return null;
  return <rect x={0} y={0} width={w} height={h} fill={v.fill} opacity={v.op * boost} />;
}

/** What glass does per phase: reflects the sky by day, shows the room at night. */
export const GLASS: Record<Ph, string> = {
  dawn: "#7a8894",
  day: "#8fa4b2",
  dusk: "#5e6472",
  night: "#2e3640",
};

/** The colour a lit window is from outside, per phase — warmer as it gets darker. */
export const LIT_WINDOW: Record<Ph, string> = {
  dawn: "#e8d29a",
  day: "#e8e0c8",
  dusk: "#ffcf7a",
  night: "#ffd98a",
};

/** Whether the lamps are on. Dusk and night, and dawn until it is properly light. */
export const lampsOn = (ph: Ph): boolean => ph !== "day";

/* ================================================================== *
 * convenience
 * ================================================================== */

/** Wrap children in a group that only shows after dark, fading in steps. */
export function AfterDark({ ph, children }: { ph: Ph; children: ReactNode }) {
  if (ph === "day") return null;
  return <g opacity={ph === "dawn" ? 0.5 : 1}>{children}</g>;
}
