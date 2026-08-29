import type { ReactNode } from "react";
/**
 * pixelKit — the primitives every scene is built from.
 *
 * Extracted from balcony.tsx so the corridor (and everything after it) can be
 * built against the same rules instead of re-deriving them. Three things live
 * here and nowhere else:
 *
 *   1. The material ramps. Five tones per material, always in the same key
 *      order — hi, base, mid, lo, deep. A scene may add accents to its own K,
 *      but it must not invent a new ramp for a material that already exists.
 *   2. Edge light. Light comes from the top-left, everywhere, always: one lit
 *      pixel along the top and left, one shaded along the bottom and right.
 *      Bevel is how that gets drawn, and it batches — five nodes for any
 *      number of boxes of the same material.
 *   3. Light itself, quantised. No radial gradients, no ellipses, no smooth
 *      falloff. A light is two or three discrete tiers of whole-pixel rows,
 *      with ordered dither at the boundaries. That is how pixel art has always
 *      faked a gradient and it is the only thing that survives being drawn at
 *      integer scale next to hard-edged geometry.
 *
 * Everything that can be precomputed is a module-scope string. Nothing in here
 * allocates during render except the convenience wrappers, which say so.
 */

/* ================================================================== *
 * phase
 * ================================================================== */

export type Ph = "dawn" | "day" | "dusk" | "night";

export function toPhase(phase?: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

/* ================================================================== *
 * geometry — rects collapse into paths
 * ================================================================== */

export type Rect = readonly [x: number, y: number, w: number, h: number];

/** Many rects of one colour -> one <path>. The core memory primitive. */
export function pxPath(rects: readonly Rect[]): string {
  let d = "";
  for (const [x, y, w, h] of rects) {
    if (w > 0 && h > 0) d += `M${x} ${y}h${w}v${h}h${-w}z`;
  }
  return d;
}

export function shift(rects: readonly Rect[], dx: number, dy: number): Rect[] {
  return rects.map(([x, y, w, h]) => [x + dx, y + dy, w, h] as Rect);
}

/** Evenly spaced copies of one box — seams, fins, bristles, breakers. */
export function repeat(n: number, pitch: number, box: Rect, axis: "x" | "y" = "x"): Rect[] {
  const [x, y, w, h] = box;
  return Array.from({ length: n }, (_, i) =>
    axis === "x" ? ([x + i * pitch, y, w, h] as Rect) : ([x, y + i * pitch, w, h] as Rect),
  );
}

/* ================================================================== *
 * materials
 * ================================================================== */

export type Mat = { hi: string; base: string; mid: string; lo: string; deep: string };

export const M = {
  /* --- unchanged from balcony.tsx; do not retune without redoing that scene --- */
  render: { hi: "#e2d8c6", base: "#cfc4ae", mid: "#c2b7a1", lo: "#b8ad97", deep: "#9a9078" },
  concrete: { hi: "#b6b3ab", base: "#9d9a92", mid: "#918e86", lo: "#8b8880", deep: "#6f6c66" },
  wood: { hi: "#a8804f", base: "#8a623f", mid: "#7d5836", lo: "#6b4a2f", deep: "#513622" },
  steel: { hi: "#c8ccd2", base: "#8a8d92", mid: "#7d8085", lo: "#6d7278", deep: "#4f5358" },
  frame: { hi: "#a4aab0", base: "#8a8d92", mid: "#7d8085", lo: "#6d7278", deep: "#54585d" },
  leaf: { hi: "#6d9668", base: "#4e6b4e", mid: "#456045", lo: "#3a523c", deep: "#2c3f2e" },
  linen: { hi: "#f6f2e6", base: "#e8e2d2", mid: "#dad3c0", lo: "#c6bfa9", deep: "#a49d88" },
  tin: { hi: "#e2e6ea", base: "#b6bcc2", mid: "#a0a6ac", lo: "#868c92", deep: "#63686d" },

  /* --- interiors --- */
  /** greige emulsion, the colour every developer in the country buys */
  plaster: { hi: "#e2ded4", base: "#d6d2c8", mid: "#cdc9bf", lo: "#c4c0b5", deep: "#ada99f" },
  /** anthracite: accent bands, steel doors, skirting */
  graphite: { hi: "#5a5d62", base: "#4a4d52", mid: "#43464b", lo: "#3a3d42", deep: "#2b2e32" },
  /** white laminate door leaf */
  laminate: { hi: "#f0eee8", base: "#e2e0da", mid: "#d8d6d0", lo: "#c9c7bf", deep: "#a8a69e" },
  oak: { hi: "#bb9c6c", base: "#a8895e", mid: "#9a7c52", lo: "#8a6f48", deep: "#6b5434" },
  /** large-format porcelain floor tile — cooler and flatter than concrete */
  tile: { hi: "#b8b6b0", base: "#a09e97", mid: "#96948d", lo: "#8b8983", deep: "#6d6b66" },
  brass: { hi: "#e0c179", base: "#c9a24b", mid: "#b8913f", lo: "#a8863a", deep: "#7d6428" },
  /** fire equipment red */
  red: { hi: "#d85a50", base: "#b03030", mid: "#9e2b2b", lo: "#8a2424", deep: "#5f1818" },
  /** powder-coated yellow: buckets, wet-floor signs, warning triangles */
  enamel: { hi: "#f2d86a", base: "#e8c445", mid: "#d9b53a", lo: "#c9a52e", deep: "#9c7f22" },
  teal: { hi: "#459098", base: "#3a7d84", mid: "#337076", lo: "#2f6a70", deep: "#225056" },
  skin: { hi: "#f0c9a4", base: "#e0b48c", mid: "#d2a67e", lo: "#c79a72", deep: "#a67c58" },
} as const satisfies Record<string, Mat>;

/** Dim a whole ramp toward a night tone — for palette-shifted phases. */
export function dim(mat: Mat, mixWith: string, amount: number): Mat {
  const mix = (hex: string) => {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(mixWith.slice(1), 16);
    const ch = (sh: number) => {
      const va = (a >> sh) & 255;
      const vb = (b >> sh) & 255;
      return Math.round(va + (vb - va) * amount);
    };
    return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
  };
  return {
    hi: mix(mat.hi),
    base: mix(mat.base),
    mid: mix(mat.mid),
    lo: mix(mat.lo),
    deep: mix(mat.deep),
  };
}

/* ================================================================== *
 * edge light
 * ================================================================== */

export type BevelSet = {
  base: string;
  hi: string;
  mid: string;
  lo: string;
  deep: string;
};

/**
 * Precompute the five edge-light paths for any number of boxes. Call this at
 * module scope and render the result with <Bev>: five nodes total, whether the
 * set holds one box or forty.
 */
export function bevelPaths(boxes: readonly Rect[]): BevelSet {
  const base: Rect[] = [];
  const hi: Rect[] = [];
  const mid: Rect[] = [];
  const lo: Rect[] = [];
  const deep: Rect[] = [];
  for (const [x, y, w, h] of boxes) {
    base.push([x, y, w, h]);
    hi.push([x, y, w, 1]);
    mid.push([x, y + 1, 1, h - 1]);
    lo.push([x + w - 1, y, 1, h]);
    deep.push([x, y + h - 1, w, 1]);
  }
  return {
    base: pxPath(base),
    hi: pxPath(hi),
    mid: pxPath(mid),
    lo: pxPath(lo),
    deep: pxPath(deep),
  };
}

export function Bev({ set, mat, op }: { set: BevelSet; mat: Mat; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.base} fill={mat.base} />
      <path d={set.hi} fill={mat.hi} />
      <path d={set.mid} fill={mat.mid} />
      <path d={set.lo} fill={mat.lo} />
      <path d={set.deep} fill={mat.deep} />
    </g>
  );
}

/** Convenience for boxes that genuinely depend on state. Allocates — prefer Bev. */
export function Bevel({ boxes, mat, op }: { boxes: readonly Rect[]; mat: Mat; op?: number }) {
  return <Bev set={bevelPaths(boxes)} mat={mat} op={op} />;
}

/* ================================================================== *
 * texture + dither
 * ================================================================== */

const TINTS = {
  /** shadow / night — warm black, not blue: shadows share the room's warmth */
  n: "#171009",
  /** incandescent, LED-warm, anything artificial and friendly */
  w: "#ffca85",
  /** north daylight through glass — barely cool, never clinical */
  c: "#e4eaec",
  /** low sun */
  e: "#ffa25e",
  /** moonlight, cold LED, a phone screen — the one blue light this game has */
  b: "#9fb8ff",
} as const;

export type Tint = keyof typeof TINTS;
export type Density = "50" | "25" | "12" | "06";

/** `dth("w", "25")` -> a fill string. Compile-time safe, no template soup. */
export function dth(tint: Tint, d: Density): string {
  return `url(#px-d${tint}${d})`;
}

/**
 * v2: each dot carries half opacity. At integer scale a full-alpha dot next to
 * hard geometry reads as noise ("рябить"); at half alpha the same pattern
 * reads as tone. Every existing dth() call site softens for free.
 */
function DitherSet({ k, tint }: { k: string; tint: string }) {
  return (
    <>
      <pattern id={`px-d${k}50`} width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={tint} fillOpacity="0.55" />
      </pattern>
      <pattern id={`px-d${k}25`} width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.5" />
      </pattern>
      <pattern id={`px-d${k}12`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.45" />
        <rect x="2" y="2" width="1" height="1" fill={tint} fillOpacity="0.45" />
      </pattern>
      <pattern id={`px-d${k}06`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="1" height="1" fill={tint} fillOpacity="0.4" />
      </pattern>
    </>
  );
}

/**
 * Mount exactly ONCE per document. Every scene SVG can reference url(#px-…)
 * regardless of which <svg> the defs ended up in, so this belongs either at
 * app root in a zero-size sprite svg or in the bottom-most layer of the
 * current scene — never in more than one place at a time. Duplicate ids make
 * the document invalid and leave the losing definitions in memory.
 */
export function SharedDefs() {
  return (
    <defs>
      {/* --- surface texture, 4–18px pitch, 4–10% opacity in use --- */}
      <pattern id="px-grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="1" width="1" height="1" fill="#fffaf0" opacity="0.07" />
        <rect x="3" y="4" width="1" height="1" fill="#000000" opacity="0.07" />
      </pattern>
      <pattern id="px-stucco" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect x="0" y="2" width="1" height="1" fill="#000000" opacity="0.06" />
        <rect x="3" y="0" width="1" height="1" fill="#ffffff" opacity="0.08" />
        <rect x="2" y="3" width="1" height="1" fill="#ffffff" opacity="0.04" />
      </pattern>
      <pattern id="px-agg" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="1" height="1" fill="#ffffff" opacity="0.1" />
        <rect x="4" y="3" width="2" height="1" fill="#000000" opacity="0.07" />
        <rect x="2" y="5" width="1" height="1" fill="#ffffff" opacity="0.06" />
      </pattern>
      <pattern id="px-wood" width="9" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="9" height="1" fill="#000000" opacity="0.07" />
        <rect x="3" y="2" width="4" height="1" fill="#ffffff" opacity="0.05" />
      </pattern>
      <pattern id="px-weave" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="2" height="2" fill="#ffffff" opacity="0.06" />
        <rect x="2" y="2" width="2" height="2" fill="#000000" opacity="0.06" />
      </pattern>
      {/* roller banding: what a wall painted by one man in an afternoon looks like */}
      <pattern id="px-roller" width="18" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="6" height="6" fill="#000000" opacity="0.035" />
        <rect x="11" y="0" width="2" height="6" fill="#ffffff" opacity="0.045" />
      </pattern>
      {/* satin porcelain: a faint cross-hatch that only shows in raking light */}
      <pattern id="px-satin" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="8" height="1" fill="#ffffff" opacity="0.045" />
        <rect x="0" y="4" width="1" height="4" fill="#000000" opacity="0.04" />
      </pattern>
      {/* --- ordered dither, four tints x four densities --- */}
      <DitherSet k="n" tint={TINTS.n} />
      <DitherSet k="w" tint={TINTS.w} />
      <DitherSet k="c" tint={TINTS.c} />
      <DitherSet k="e" tint={TINTS.e} />
      <DitherSet k="b" tint={TINTS.b} />
      {/* --- surface patterns, second set: the ones the ground and the walls
          asked for once each scene grew a floor. All 4–12 px pitch, all under
          10% so they read as material and never as a print. --- */}
      <pattern id="px-brick" width="12" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="5" width="12" height="1" fill="#000000" opacity="0.12" />
        <rect x="5" y="0" width="1" height="5" fill="#000000" opacity="0.1" />
        <rect x="0" y="0" width="5" height="1" fill="#ffffff" opacity="0.06" />
      </pattern>
      <pattern id="px-tile" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="10" height="1" fill="#000000" opacity="0.1" />
        <rect x="0" y="0" width="1" height="10" fill="#000000" opacity="0.1" />
        <rect x="1" y="1" width="8" height="1" fill="#ffffff" opacity="0.05" />
      </pattern>
      <pattern id="px-asphalt" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect x="1" y="0" width="1" height="1" fill="#ffffff" opacity="0.07" />
        <rect x="3" y="3" width="1" height="1" fill="#000000" opacity="0.1" />
        <rect x="0" y="2" width="1" height="1" fill="#000000" opacity="0.05" />
      </pattern>
      <pattern id="px-cobble" width="8" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="8" height="1" fill="#000000" opacity="0.14" />
        <rect x="3" y="1" width="1" height="5" fill="#000000" opacity="0.1" />
        <rect x="0" y="1" width="3" height="1" fill="#ffffff" opacity="0.08" />
      </pattern>
      <pattern id="px-water" width="12" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="1" width="6" height="1" fill="#ffffff" opacity="0.08" />
        <rect x="7" y="3" width="4" height="1" fill="#000000" opacity="0.08" />
      </pattern>
      <pattern id="px-rust" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="2" height="1" fill="#8a4a2a" opacity="0.18" />
        <rect x="4" y="5" width="1" height="1" fill="#8a4a2a" opacity="0.14" />
        <rect x="5" y="1" width="1" height="1" fill="#c26a3a" opacity="0.08" />
      </pattern>
      <pattern id="px-corrugated" width="6" height="3" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="6" height="1" fill="#ffffff" opacity="0.07" />
        <rect x="0" y="2" width="6" height="1" fill="#000000" opacity="0.09" />
      </pattern>
    </defs>
  );
}

/* ================================================================== *
 * occlusion + contact
 * ================================================================== */

/**
 * Ambient occlusion under a lip, sill or overhang. Three dithered rows read
 * the same as the old five-rect alpha stack and cost three nodes.
 */
export function AO({ x, y, w, op = 1 }: { x: number; y: number; w: number; op?: number }) {
  return (
    <g opacity={op}>
      <path d={pxPath([[x, y, w, 2]])} fill={TINTS.n} opacity={0.22} />
      <path d={pxPath([[x, y + 2, w, 2]])} fill={TINTS.n} opacity={0.13} />
      <path d={pxPath([[x, y + 4, w, 1]])} fill={TINTS.n} opacity={0.07} />
    </g>
  );
}

/** Precomputed form of AO, for a plane's worth of lips at once. */
export function aoPaths(spans: readonly (readonly [x: number, y: number, w: number])[]) {
  const a: Rect[] = [];
  const b: Rect[] = [];
  const c: Rect[] = [];
  for (const [x, y, w] of spans) {
    a.push([x, y, w, 2]);
    b.push([x, y + 2, w, 2]);
    c.push([x, y + 4, w, 1]);
  }
  return { a: pxPath(a), b: pxPath(b), c: pxPath(c) };
}

export function AOSet({ set, op = 1 }: { set: ReturnType<typeof aoPaths>; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.a} fill={TINTS.n} opacity={0.22} />
      <path d={set.b} fill={TINTS.n} opacity={0.13} />
      <path d={set.c} fill={TINTS.n} opacity={0.07} />
    </g>
  );
}

/** What a thing standing on the floor does to the floor. Two nodes. */
export function contactPaths(spans: readonly (readonly [x: number, w: number, y: number])[]) {
  const hard: Rect[] = [];
  const soft: Rect[] = [];
  for (const [x, w, y] of spans) {
    hard.push([x, y, w, 2]);
    soft.push([x - 1, y + 2, w + 2, 1]);
  }
  return { hard: pxPath(hard), soft: pxPath(soft) };
}

export function Contact({ set, op = 1 }: { set: ReturnType<typeof contactPaths>; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.hard} fill={TINTS.n} opacity={0.26} />
      <path d={set.soft} fill={TINTS.n} opacity={0.12} />
    </g>
  );
}

/* ================================================================== *
 * quantised light
 * ================================================================== */

/** Stair-stepped ellipse as whole-pixel rows. step 2 = deliberately chunky. */
export function steppedEllipse(cx: number, cy: number, rx: number, ry: number, step = 2): Rect[] {
  const out: Rect[] = [];
  for (let dy = -ry; dy < ry; dy += step) {
    const t = 1 - ((dy + step / 2) / ry) ** 2;
    if (t <= 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    if (hw > 0) out.push([cx - hw, cy + dy, hw * 2, step]);
  }
  return out;
}

/**
 * A cone of light from a ceiling fitting. Stepped trapezoid, widening as it
 * falls. `step` is the stair height — 6 reads as a light shaft, 2 reads as a
 * smooth edge that still never antialiases.
 */
export function steppedCone(
  cx: number,
  yTop: number,
  hwTop: number,
  yBot: number,
  hwBot: number,
  step = 6,
): Rect[] {
  const out: Rect[] = [];
  const span = yBot - yTop;
  for (let y = yTop; y < yBot; y += step) {
    const h = Math.min(step, yBot - y);
    const t = (y + h / 2 - yTop) / span;
    const hw = Math.round(hwTop + (hwBot - hwTop) * t);
    out.push([cx - hw, y, hw * 2, h]);
  }
  return out;
}

/**
 * A raking shaft — daylight through a window landing on a floor. Left and
 * right edges each interpolate independently, so the shaft can shear.
 */
export function steppedQuad(
  yTop: number,
  l0: number,
  r0: number,
  yBot: number,
  l1: number,
  r1: number,
  step = 8,
): Rect[] {
  const out: Rect[] = [];
  const span = yBot - yTop;
  for (let y = yTop; y < yBot; y += step) {
    const h = Math.min(step, yBot - y);
    const t = (y + h / 2 - yTop) / span;
    const l = Math.round(l0 + (l1 - l0) * t);
    const r = Math.round(r0 + (r1 - r0) * t);
    if (r > l) out.push([l, y, r - l, h]);
  }
  return out;
}

/**
 * A pitched roof as whole-pixel courses. The only correct way to draw a diagonal
 * in this project: a <polygon> gets antialiased and lands off the grid, so a
 * pitch is a stack of rects, each one inset from the last.
 *
 * `rise` is the height from eaves to ridge, `ridgeW` the width of the flat ridge
 * (0 gives a point, which is what a spire is), `step` the course height — 2 reads
 * as a tiled roof, 1 as slate, 3 as corrugated.
 */
export function steppedRoof(
  x0: number,
  x1: number,
  yEaves: number,
  rise: number,
  ridgeW = 0,
  step = 2,
): Rect[] {
  const out: Rect[] = [];
  const w = x1 - x0;
  const n = Math.max(1, Math.round(rise / step));
  const maxInset = Math.max(0, Math.round((w - ridgeW) / 2));
  for (let i = 0; i < n; i++) {
    const inset = Math.round((maxInset * (i + 1)) / n);
    const cw = w - inset * 2;
    if (cw <= 0) break;
    out.push([x0 + inset, yEaves - (i + 1) * step, cw, step]);
  }
  return out;
}

/**
 * A cable sagging between two points, quantised to whole pixels. Replaces the
 * bezier-with-a-stroke that every earlier pass reached for — a 1 px stroke on a
 * curve is the one thing in an SVG that cannot be made to sit on the grid.
 *
 * `sag` is the drop at midspan. Pair it with cableY() to hang things off it.
 */
export function steppedCable(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  step = 8,
): Rect[] {
  const out: Rect[] = [];
  for (let x = x0; x < x1; x += step) {
    const w = Math.min(step, x1 - x);
    out.push([x, cableY(x0, y0, x1, y1, sag, x + w / 2), w, 1]);
  }
  return out;
}

/** Where a steppedCable actually is at x, so birds and lamps can sit on it. */
export function cableY(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  sag: number,
  x: number,
): number {
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
}

export type LightTier = { d: string; fill: string; o: number };

/**
 * v2: four SOLID tiers at low alpha instead of dithered ones. Quantized still —
 * the steps are visible bands, which is the honest pixel-art gradient — but
 * each band is calm tone, not speckle. The eye reads overlap, so the tiers
 * accumulate: edge ≈ .07, core ≈ .07+.08+.10+.12.
 */
export function tiers(build: (scale: number) => Rect[], tint: Tint, strength = 1): LightTier[] {
  const fill = TINTS[tint];
  return [
    { d: pxPath(build(1)), fill, o: 0.07 * strength },
    { d: pxPath(build(0.78)), fill, o: 0.08 * strength },
    { d: pxPath(build(0.52)), fill, o: 0.1 * strength },
    { d: pxPath(build(0.3)), fill, o: 0.12 * strength },
  ];
}

export function Light({ set, op = 1 }: { set: readonly LightTier[]; op?: number }) {
  return (
    <g opacity={op}>
      {set.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static tier list, never reorders
        <path key={i} d={t.d} fill={t.fill} opacity={t.o} />
      ))}
    </g>
  );
}

/** A point source at pixel scale: a 3x3 plus, and a 7x7 dithered star. */
export function bulbPaths(points: readonly (readonly [x: number, y: number])[]) {
  const core: Rect[] = [];
  const halo: Rect[] = [];
  for (const [x, y] of points) {
    core.push([x - 1, y, 3, 1], [x, y - 1, 1, 3]);
    halo.push([x - 3, y, 7, 1], [x, y - 3, 1, 7], [x - 2, y - 2, 5, 5]);
  }
  return { core: pxPath(core), halo: pxPath(halo) };
}

/** Stepped frame instead of a radial vignette. Three nodes. */
export function vignettePaths(w: number, h: number) {
  return [
    {
      d: pxPath([
        [0, 0, w, 6],
        [0, h - 8, w, 8],
        [0, 0, 8, h],
        [w - 8, 0, 8, h],
      ]),
      fill: TINTS.n,
    },
    {
      d: pxPath([
        [0, 6, w, 6],
        [0, h - 16, w, 8],
        [8, 0, 8, h],
        [w - 16, 0, 8, h],
      ]),
      fill: TINTS.n,
    },
    {
      d: pxPath([
        [0, 12, w, 8],
        [0, h - 26, w, 10],
        [16, 0, 10, h],
        [w - 26, 0, 10, h],
      ]),
      fill: TINTS.n,
    },
  ];
}

export function Vignette({
  set,
  strength = 1,
}: {
  set: ReturnType<typeof vignettePaths>;
  strength?: number;
}) {
  // v2: solid rings at a whisper — the frame should be felt, never seen
  const o = [0.1, 0.07, 0.05];
  return (
    <g>
      {set.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static rings, never reorder
        <path key={i} d={v.d} fill={v.fill} opacity={(o[i] ?? 0.05) * strength} />
      ))}
    </g>
  );
}

/**
 * Stepped transitions. A light that fades in over 400ms of smooth interpolation
 * is a light that spends 400ms not being pixel art. steps() fixes that for free.
 */
export const STEP_FADE = "opacity 460ms steps(3, end)";
export const STEP_SLIDE = "transform 640ms steps(5, end)";
export const STEP_DROOP = "transform 600ms steps(2, end)";

/* ================================================================== *
 * 3x5 pixel font — one node per string
 * ================================================================== */

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  A: ["111", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "111", "100", "111"],
  F: ["111", "100", "111", "100", "100"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "111"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  /** Ł — the stroke crosses the stem at mid height, which is all that reads at 3x5. */
  Ł: ["100", "100", "110", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "111", "001"],
  R: ["111", "101", "111", "110", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "-": ["000", "000", "111", "000", "000"],
  "'": ["1", "1", "0", "0", "0"],
  "×": ["000", "101", "010", "101", "000"],
  "(": ["01", "10", "10", "10", "01"],
  ">": ["100", "010", "001", "010", "100"],
  "<": ["001", "010", "100", "010", "001"],
  "*": ["101", "010", "111", "010", "101"],
  ")": ["10", "01", "01", "01", "10"],
  /**
   * Square brackets. Absent until now, which meant the menu's `[ESC] BACK`
   * fell through to the space glyph and rendered as `ESC  BACK` with two
   * unexplained holes in it. Two cells wide, like the round brackets.
   */
  "[": ["11", "10", "10", "10", "11"],
  "]": ["11", "01", "01", "01", "11"],
  /**
   * A real middle dot, one cell wide, sitting at x-height. It used to be
   * folded to a full stop, so `v0.1.0 · a1b2c3d` came out with a period
   * loose on the baseline between the two halves.
   */
  "·": ["0", "0", "1", "0", "0"],
  "+": ["000", "010", "111", "010", "000"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "011", "000", "010"],
  "%": ["101", "001", "010", "100", "101"],
  ".": ["00", "00", "00", "00", "10"],
  ",": ["00", "00", "00", "01", "10"],
  ":": ["0", "1", "0", "1", "0"],
  "/": ["001", "001", "010", "100", "100"],
  ";": ["0", "1", "0", "1", "1"],
  '"': ["101", "101", "000", "000", "000"],
  "&": ["010", "101", "010", "101", "011"],
  " ": ["00", "00", "00", "00", "00"],

  /*
   * Cyrillic, for the Ukrainian catalogue. Letters that share a shape with a
   * Latin capital reuse it (А В Е К М Н О Р С Т Х І); the rest are drawn.
   * Some cannot be told apart from their neighbours in three columns — Ж, Ш,
   * Щ, Ю, Ф get five, И and Ы get four — the same way W and M already lean
   * on the reader. Й and Ї are marks over И and І (see ACCENTS).
   */
  А: ["111", "101", "111", "101", "101"],
  Б: ["111", "100", "111", "101", "111"],
  В: ["110", "101", "110", "101", "110"],
  Г: ["111", "100", "100", "100", "100"],
  Ґ: ["001", "111", "100", "100", "100"],
  Д: ["011", "010", "010", "111", "101"],
  Е: ["111", "100", "111", "100", "111"],
  Є: ["111", "100", "110", "100", "111"],
  Ж: ["10101", "01110", "00100", "01110", "10101"],
  З: ["111", "001", "011", "001", "111"],
  И: ["1001", "1011", "1101", "1001", "1001"],
  І: ["111", "010", "010", "010", "111"],
  К: ["101", "101", "110", "101", "101"],
  Л: ["011", "101", "101", "101", "101"],
  М: ["101", "111", "111", "101", "101"],
  Н: ["101", "101", "111", "101", "101"],
  О: ["111", "101", "101", "101", "111"],
  П: ["111", "101", "101", "101", "101"],
  Р: ["111", "101", "111", "100", "100"],
  С: ["111", "100", "100", "100", "111"],
  Т: ["111", "010", "010", "010", "010"],
  У: ["101", "101", "111", "001", "110"],
  Ф: ["00100", "01110", "10101", "01110", "00100"],
  Х: ["101", "101", "010", "101", "101"],
  Ц: ["101", "101", "101", "111", "001"],
  Ч: ["101", "101", "111", "001", "001"],
  Ш: ["10101", "10101", "10101", "10101", "11111"],
  Щ: ["10101", "10101", "10101", "11111", "00001"],
  Ь: ["100", "100", "111", "101", "111"],
  Ю: ["10111", "10101", "11101", "10101", "10111"],
  Я: ["111", "101", "111", "011", "101"],
  /* the three Russian letters a name might still carry */
  Ы: ["1001", "1001", "1101", "1011", "1101"],
  Э: ["110", "001", "011", "001", "110"],
  Ё: ["111", "100", "111", "100", "111"],
};

/**
 * Polish diacritics, as a base letter plus a 1px combining mark. At 3x5 there is
 * no room for a sixth row inside the glyph, so the mark is drawn outside the cell:
 * `above` sits at y-2, `below` (the ogonek) at y+5, and the acute leans off the
 * top-right corner. Ł stays a real glyph because its stroke has to cut the stem,
 * not float near it.
 *
 * The mark costs one rect and the letters stay on the 3x5 grid, which is the only
 * reason a Polish sign can be set in this font at all.
 */
const ACCENTS: Record<string, { base: string; mark: "above" | "acute" | "below" }> = {
  Ą: { base: "A", mark: "below" },
  Ć: { base: "C", mark: "acute" },
  É: { base: "E", mark: "acute" },
  Ę: { base: "E", mark: "below" },
  Ń: { base: "N", mark: "acute" },
  Ó: { base: "O", mark: "acute" },
  Ś: { base: "S", mark: "acute" },
  Ź: { base: "Z", mark: "acute" },
  Ż: { base: "Z", mark: "above" },
  /* Cyrillic: the breve over И and the two dots over І, both a 1px mark above */
  Й: { base: "И", mark: "above" },
  Ї: { base: "І", mark: "above" },
};

/** Lit pixels, run-length merged along each row. Accented letters add one rect. */
/** Characters the font spells differently from the string that arrives. */
const FOLD: Record<string, string> = {
  "\u2212": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2019": "'",
  "\u2022": "\u00b7",
  /* every quotation mark the three languages use, to the one the font has */
  "\u00ab": '"',
  "\u00bb": '"',
  "\u201e": '"',
  "\u201d": '"',
  "\u201c": '"',
  "\u2026": ".",
};

/**
 * Say so, once per character, when a string asks for a glyph the font has not
 * got. Without this a missing character is drawn as a blank cell and looks
 * exactly like deliberate letterspacing — which is how `[ESC] BACK` shipped as
 * `ESC  BACK` and nobody noticed.
 */
const warned = new Set<string>();
function warnMissingGlyph(ch: string, text: string) {
  if (warned.has(ch)) return;
  warned.add(ch);
  console.warn(
    `[pixelFont] no glyph for ${JSON.stringify(ch)} — drawn blank in ${JSON.stringify(text)}`,
  );
}

export function textRects(text: string, x: number, y: number, gap = 1): Rect[] {
  const out: Rect[] = [];
  let cx = x;
  for (const ch0 of text.toUpperCase()) {
    const raw = FOLD[ch0] ?? ch0;
    const acc = ACCENTS[raw];
    const ch = acc ? acc.base : raw;
    const rows = GLYPHS[ch] ?? GLYPHS[" "];
    if (import.meta.env.DEV && !GLYPHS[ch] && ch !== " ") warnMissingGlyph(ch, text);
    const w = rows[0].length;
    if (acc) {
      if (acc.mark === "above") out.push([cx + 1, y - 2, 1, 1]);
      else if (acc.mark === "acute") out.push([cx + 2, y - 2, 1, 1]);
      else out.push([cx + 1, y + 5, 1, 1]);
    }
    for (let r = 0; r < rows.length; r++) {
      let c = 0;
      while (c < w) {
        if (rows[r][c] === "1") {
          let run = 1;
          while (c + run < w && rows[r][c + run] === "1") run++;
          out.push([cx + c, y + r, run, 1]);
          c += run;
        } else c++;
      }
    }
    cx += w + gap;
  }
  return out;
}

/** Advance width of a string in font units — what a DOM label needs to size itself. */
export function textWidth(text: string, gap = 1): number {
  let w = 0;
  for (const ch0 of text.toUpperCase()) {
    const raw = FOLD[ch0] ?? ch0;
    const acc = ACCENTS[raw];
    const rows = GLYPHS[acc ? acc.base : raw] ?? GLYPHS[" "];
    w += rows[0].length + gap;
  }
  return Math.max(0, w - gap);
}

export function textPath(text: string, x: number, y: number, gap = 1): string {
  return pxPath(textRects(text, x, y, gap));
}

/**
 * Whether this font can actually SET a string — every character resolves to a
 * real glyph rather than the blank-cell fallback. The glyph set is Latin plus
 * Polish combining marks; Cyrillic, French cedillas and anything else outside
 * it comes back false, and a renderer should fall back to a prose face for
 * that line instead of silently dropping the letters (which is how Ukrainian
 * dialogue once rendered as a row of commas). Spaces and unknown-but-foldable
 * punctuation count as covered.
 */
export function fontCovers(text: string): boolean {
  for (const ch0 of text.toUpperCase()) {
    const raw = FOLD[ch0] ?? ch0;
    const ch = ACCENTS[raw]?.base ?? raw;
    if (ch !== " " && !GLYPHS[ch]) return false;
  }
  return true;
}

/** The old version emitted one node per lit pixel — "14" cost 22 nodes. */
export function PixelText({
  x,
  y,
  text,
  fill,
  gap = 1,
  op,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  gap?: number;
  op?: number;
}) {
  return <path d={textPath(text, x, y, gap)} fill={fill} opacity={op} />;
}

/* ================================================================== *
 * noise — deterministic, so nothing ever crawls between frames
 * ================================================================== */

/** Per-position noise in [0,1). Same input, same output, every frame, every load. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Two-dimensional noise in [0,1), seeded. For anything laid out on a grid. */
export function noise2(x: number, y: number, seed = 0): number {
  return hash(x * 12.9898 + y * 78.233 + seed * 37.719);
}

/** Pick one of `n` off a seed — a colour from a palette, a variant from a set. */
export function pick(seed: number, n: number): number {
  return Math.min(n - 1, Math.floor(hash(seed) * n));
}

/* ================================================================== *
 * geometry — every shape a diagonal or a curve wants, on the grid
 * ================================================================== */

/** A hollow rectangle: frames, plates, bezels, window reveals. */
export function outline(x: number, y: number, w: number, h: number, t = 1): Rect[] {
  return [
    [x, y, w, t],
    [x, y + h - t, w, t],
    [x, y + t, t, h - 2 * t],
    [x + w - t, y + t, t, h - 2 * t],
  ];
}

/**
 * A straight line between two points, as whole pixels — Bresenham, with the
 * horizontal runs merged so a shallow line is a handful of rects and not a
 * pixel each. THE way to draw a diagonal here: a stroked <line> antialiases and
 * lands off the grid. `thick` widens it downward.
 */
export function steppedLine(x0: number, y0: number, x1: number, y1: number, thick = 1): Rect[] {
  const out: Rect[] = [];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  let runX = x;
  let runW = 0;
  for (;;) {
    runW++;
    const atEnd = x === ex && y === ey;
    const e2 = 2 * err;
    let stepY = false;
    if (e2 <= dx) {
      stepY = true;
    }
    if (atEnd || stepY) {
      out.push([Math.min(runX, runX + (runW - 1) * sx), y, runW, thick]);
      runW = 0;
    }
    if (atEnd) break;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (runW === 0) runX = x;
  }
  return out;
}

/** A ring: the band between two stepped ellipses, `t` pixels thick. */
export function steppedRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  t = 1,
  step = 1,
): Rect[] {
  const outer = steppedEllipse(cx, cy, rx, ry, step);
  const inner = steppedEllipse(cx, cy, rx - t, ry - t, step);
  const byY = new Map<number, Rect>();
  for (const r of inner) byY.set(r[1], r);
  const out: Rect[] = [];
  for (const [x, y, w, h] of outer) {
    const i = byY.get(y);
    if (!i) {
      out.push([x, y, w, h]);
      continue;
    }
    const [ix, , iw] = i;
    if (ix > x) out.push([x, y, ix - x, h]);
    if (ix + iw < x + w) out.push([ix + iw, y, x + w - ix - iw, h]);
  }
  return out;
}

/**
 * The cap of an arch over an opening `w` wide: the semicircle (or the segment
 * when `rise` is less than half the width), as rows. For station windows,
 * cellar doors, the tunnel mouth.
 */
export function steppedArch(x: number, yBase: number, w: number, rise: number, step = 1): Rect[] {
  const cx = x + w / 2;
  const out: Rect[] = [];
  const rx = w / 2;
  for (let dy = 0; dy < rise; dy += step) {
    const t = 1 - (dy / rise) ** 2;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, t)));
    if (hw > 0) out.push([Math.round(cx - hw), yBase - dy - step, hw * 2, step]);
  }
  return out;
}

/**
 * A pictogram written as rows of `#`, run-length encoded into rects. The one
 * place where legibility of the SOURCE beats terseness — you have to be able
 * to see the wheelchair in the code.
 */
export function glyphRects(rows: readonly string[], ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, ry) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let w = 1;
        while (row[x + w] === "#") w++;
        out.push([ox + x, oy + ry, w, 1]);
        x += w;
      } else x++;
    }
  });
  return out;
}

/** Mirror about a vertical axis. How a double-ended thing is built once. */
export function mirrorX(rects: readonly Rect[], axis: number): Rect[] {
  return rects.map(([x, y, w, h]) => [Math.round(2 * axis - x - w), y, w, h] as Rect);
}

/** Mirror about a horizontal axis: reflections in water, in wet stone. */
export function mirrorY(rects: readonly Rect[], axis: number): Rect[] {
  return rects.map(([x, y, w, h]) => [x, Math.round(2 * axis - y - h), w, h] as Rect);
}

/** Scale about the origin, rounding to whole pixels. */
export function scaleRects(rects: readonly Rect[], k: number): Rect[] {
  return rects.map(
    ([x, y, w, h]) =>
      [
        Math.round(x * k),
        Math.round(y * k),
        Math.max(1, Math.round(w * k)),
        Math.max(1, Math.round(h * k)),
      ] as Rect,
  );
}

/** Clip a rect list to a box. Anything wholly outside is dropped. */
export function clipRects(rects: readonly Rect[], box: Rect): Rect[] {
  const [bx, by, bw, bh] = box;
  const out: Rect[] = [];
  for (const [x, y, w, h] of rects) {
    const x0 = Math.max(x, bx);
    const y0 = Math.max(y, by);
    const x1 = Math.min(x + w, bx + bw);
    const y1 = Math.min(y + h, by + bh);
    if (x1 > x0 && y1 > y0) out.push([x0, y0, x1 - x0, y1 - y0]);
  }
  return out;
}

/** The bounding box of a rect list, or null for none. */
export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const [x, y, w, h] of rects) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

/* ================================================================== *
 * volume — boxes that have a top and a side, cylinders that turn
 * ================================================================== */

export type BoxSet = {
  /** the front face, as a bevel set */
  face: BevelSet;
  /** the top face, `depth` tall, lit */
  top: string;
  /** the right side face, `depth` wide, turned from the light */
  side: string;
  /** the shadow the box throws on whatever is behind it */
  cast: string;
};

/**
 * A box in the game's fixed three-quarter view: the front face you already
 * had, plus a lit top face and a shaded right side `depth` pixels deep, and
 * the shadow it throws on the wall behind. This is what turns a rectangle into
 * a container, a cabinet, a bin, a parapet — anything that occupies space.
 *
 *   const CRATE = boxPaths([[100, 120, 30, 20]], 4);
 *   <Box set={CRATE} mat={M.wood} />
 */
export function boxPaths(boxes: readonly Rect[], depth = 3): BoxSet {
  const top: Rect[] = [];
  const side: Rect[] = [];
  const cast: Rect[] = [];
  for (const [x, y, w, h] of boxes) {
    top.push([x + depth, y - depth, w, depth]);
    for (let i = 0; i < depth; i++) top.push([x + i + 1, y - i - 1, depth - i - 1 + 1, 1]);
    side.push([x + w, y - depth, depth, h]);
    for (let i = 0; i < depth; i++) side.push([x + w + i, y - depth + i, 1, 1]);
    cast.push([x + w + depth, y + 2, 2, h - depth]);
  }
  return { face: bevelPaths(boxes), top: pxPath(top), side: pxPath(side), cast: pxPath(cast) };
}

export function Box({ set, mat, op }: { set: BoxSet; mat: Mat; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.cast} fill="#171009" opacity={0.2} />
      <path d={set.side} fill={mat.lo} />
      <path d={set.top} fill={mat.hi} />
      <Bev set={set.face} mat={mat} />
    </g>
  );
}

export type CylinderSet = { hi: string; base: string; lo: string; deep: string };

/**
 * A cylinder seen side-on — a pipe, a column, a drum, a bottle. Four bands
 * across the width (or the height, for a horizontal run): a highlight a fifth
 * in from the lit edge, the body, the turn into shade, and the deep edge. Reads
 * as round at any size from 4 px up.
 */
export function cylinderPaths(rects: readonly Rect[], horizontal = false): CylinderSet {
  const hi: Rect[] = [];
  const base: Rect[] = [];
  const lo: Rect[] = [];
  const deep: Rect[] = [];
  for (const [x, y, w, h] of rects) {
    if (horizontal) {
      const a = Math.max(1, Math.round(h * 0.18));
      const b = Math.max(1, Math.round(h * 0.34));
      const c = Math.max(1, Math.round(h * 0.28));
      hi.push([x, y + a, w, Math.max(1, Math.round(h * 0.16))]);
      base.push([x, y, w, a + b]);
      lo.push([x, y + a + b, w, c]);
      deep.push([x, y + a + b + c, w, Math.max(1, h - a - b - c)]);
    } else {
      const a = Math.max(1, Math.round(w * 0.18));
      const b = Math.max(1, Math.round(w * 0.34));
      const c = Math.max(1, Math.round(w * 0.28));
      hi.push([x + a, y, Math.max(1, Math.round(w * 0.16)), h]);
      base.push([x, y, a + b, h]);
      lo.push([x + a + b, y, c, h]);
      deep.push([x + a + b + c, y, Math.max(1, w - a - b - c), h]);
    }
  }
  return { hi: pxPath(hi), base: pxPath(base), lo: pxPath(lo), deep: pxPath(deep) };
}

export function Cylinder({ set, mat, op }: { set: CylinderSet; mat: Mat; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.base} fill={mat.base} />
      <path d={set.hi} fill={mat.hi} />
      <path d={set.lo} fill={mat.lo} />
      <path d={set.deep} fill={mat.deep} />
    </g>
  );
}

/* ================================================================== *
 * materials — make a ramp from one colour, mix two, age one
 * ================================================================== */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}
/** Mix two hexes: k=0 is a, k=1 is b. */
export function mixHex(a: string, b: string, k: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

/**
 * A five-tone ramp from one base colour. The highlight goes toward a warm
 * white and the shadows toward the game's warm black, which is what keeps a
 * generated material in the same family as the hand-picked ones in `M`.
 *
 *   const TEAL = matFrom("#3a7d84");
 */
export function matFrom(base: string, contrast = 1): Mat {
  return {
    hi: mixHex(base, "#fff4e0", 0.22 * contrast),
    base,
    mid: mixHex(base, "#171009", 0.08 * contrast),
    lo: mixHex(base, "#171009", 0.18 * contrast),
    deep: mixHex(base, "#171009", 0.38 * contrast),
  };
}

/** Mix two materials tone by tone. */
export function mixMat(a: Mat, b: Mat, k: number): Mat {
  return {
    hi: mixHex(a.hi, b.hi, k),
    base: mixHex(a.base, b.base, k),
    mid: mixHex(a.mid, b.mid, k),
    lo: mixHex(a.lo, b.lo, k),
    deep: mixHex(a.deep, b.deep, k),
  };
}

/** Brighten (k>0) or darken (k<0) a whole ramp, keeping its relationships. */
export function shade(mat: Mat, k: number): Mat {
  const to = k > 0 ? "#fff4e0" : "#171009";
  const a = Math.abs(k);
  return {
    hi: mixHex(mat.hi, to, a),
    base: mixHex(mat.base, to, a),
    mid: mixHex(mat.mid, to, a),
    lo: mixHex(mat.lo, to, a),
    deep: mixHex(mat.deep, to, a),
  };
}

/** The four phases of one material, on the game's standard casts. */
export function phased(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, "#8c86a8", 0.14),
    day: mat,
    dusk: dim(mat, "#c98a52", 0.16),
    night: dim(mat, "#141a24", 0.58),
  };
}

/* ================================================================== *
 * weathering — what time does to a surface
 * ================================================================== */

/** Water streaks running down from a line: under a sill, a gutter, a sign. */
export function streaks(x: number, y: number, w: number, n: number, seed = 1, maxLen = 12): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const sx = x + Math.round(hash(seed + i * 13) * (w - 1));
    out.push([sx, y, 1, 3 + Math.round(hash(seed * 3 + i) * maxLen)]);
  }
  return out;
}

/** Chips out of an edge: the corners bumpers and trolleys find. */
export function chips(x: number, y: number, w: number, n: number, seed = 2): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const sx = x + Math.round(hash(seed + i * 7) * (w - 4));
    out.push([sx, y, 2 + pick(seed + i, 3), 1 + pick(seed * 2 + i, 2)]);
  }
  return out;
}

/** Rust blooming out of fixings: a spot, and the run below it. */
export function rustRuns(points: readonly (readonly [x: number, y: number])[], len = 6): Rect[] {
  return points.flatMap(([x, y], i) => [
    [x - 1, y, 3, 2] as Rect,
    [x, y + 2, 1, 2 + pick(i * 11, len)] as Rect,
  ]);
}

/** A damp bloom on a wall: a body and a darker heart, stepped. */
export function dampBloom(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { body: Rect[]; heart: Rect[] } {
  return {
    body: steppedEllipse(cx, cy, rx, ry, 2),
    heart: steppedEllipse(cx, cy + 2, Math.round(rx * 0.5), Math.round(ry * 0.5), 2),
  };
}

/** Efflorescence: the salt line a damp patch leaves as it dries. */
export function saltLine(x: number, y: number, w: number, seed = 4): Rect[] {
  const out: Rect[] = [];
  for (let sx = x; sx < x + w; sx += 3 + pick(seed + sx, 4))
    out.push([sx, y + pick(seed * 2 + sx, 2), 2 + pick(sx, 3), 1]);
  return out;
}

/* ================================================================== *
 * SMIL — discrete animation, the only kind that stays pixel art
 * ================================================================== */

export type Flicker = { values: string; keyTimes?: string; dur: string };

/**
 * The flickers this game knows. All `calcMode="discrete"` — the value snaps,
 * it never eases — because a light that fades smoothly over 400 ms is a light
 * that spends 400 ms not being pixel art.
 */
export type FlickerKind = "dying" | "tube" | "flame" | "neon" | "crt" | "breathe" | "data";
export const FLICKER: Record<FlickerKind, Flicker> = {
  /** a fluorescent tube on its way out */
  dying: { values: "1;0.15;1;1;0.4;1;0.1;0.9;1;1", dur: "6.2s" },
  /** a healthy tube's barely-there mains hum */
  tube: { values: "1;0.94;1;0.97;1", dur: "3.4s" },
  /** a candle, a lighter, a match */
  flame: { values: "1;0.8;0.92;0.7;1;0.85;0.95;0.75;1", dur: "1.9s" },
  /** a neon letter with a bad transformer */
  neon: { values: "1;1;0.3;1;1;1;0.6;1", dur: "4.7s" },
  /** a CRT: a slow roll, then steady */
  crt: { values: "0.92;1;0.94;1;0.9;1", dur: "0.9s" },
  /** the standby LED on everything */
  breathe: { values: "1;0.55;1", keyTimes: "0;0.5;1", dur: "2.6s" },
  /** a router, a modem, a charger: irregular, busy */
  data: { values: "1;0;1;1;0;1;0;0;1", dur: "1.3s" },
};

/** Wrap anything in a discrete opacity flicker. */
export function Flick({
  kind,
  children,
  begin,
}: {
  kind: keyof typeof FLICKER | Flicker;
  children: ReactNode;
  begin?: string;
}) {
  const f = typeof kind === "string" ? FLICKER[kind] : kind;
  return (
    <g>
      {children}
      <animate
        attributeName="opacity"
        calcMode="discrete"
        values={f.values}
        keyTimes={f.keyTimes}
        dur={f.dur}
        begin={begin}
        repeatCount="indefinite"
      />
    </g>
  );
}

/**
 * A stepped translate: `frames` positions held in turn, the way a pigeon hops
 * or a leaf skitters. Returns the attribute props for an <animateTransform>.
 */
export function stepTranslate(
  frames: readonly (readonly [x: number, y: number])[],
  dur: string,
  holds?: readonly number[],
) {
  const values = frames.map(([x, y]) => `${x} ${y}`).join(";");
  const keyTimes = holds
    ? holds.map((t) => t.toFixed(3)).join(";")
    : frames.map((_, i) => (i / (frames.length - 1)).toFixed(3)).join(";");
  return {
    attributeName: "transform" as const,
    type: "translate" as const,
    calcMode: "discrete" as const,
    values,
    keyTimes,
    dur,
    repeatCount: "indefinite" as const,
  };
}
