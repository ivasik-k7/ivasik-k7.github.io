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
  "+": ["000", "010", "111", "010", "000"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "011", "000", "010"],
  "%": ["101", "001", "010", "100", "101"],
  ".": ["00", "00", "00", "00", "10"],
  ",": ["00", "00", "00", "01", "10"],
  ":": ["0", "1", "0", "1", "0"],
  "/": ["001", "001", "010", "100", "100"],
  " ": ["00", "00", "00", "00", "00"],
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
  Ę: { base: "E", mark: "below" },
  Ń: { base: "N", mark: "acute" },
  Ó: { base: "O", mark: "acute" },
  Ś: { base: "S", mark: "acute" },
  Ź: { base: "Z", mark: "acute" },
  Ż: { base: "Z", mark: "above" },
};

/** Lit pixels, run-length merged along each row. Accented letters add one rect. */
export function textRects(text: string, x: number, y: number, gap = 1): Rect[] {
  const out: Rect[] = [];
  let cx = x;
  for (const raw of text) {
    const acc = ACCENTS[raw];
    const ch = acc ? acc.base : raw;
    const rows = GLYPHS[ch] ?? GLYPHS[" "];
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

export function textPath(text: string, x: number, y: number, gap = 1): string {
  return pxPath(textRects(text, x, y, gap));
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
