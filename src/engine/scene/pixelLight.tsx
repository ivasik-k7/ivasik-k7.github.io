/**
 * pixel-light — quantized light for the scene renderer.
 *
 * Replaces every <radialGradient>, <linearGradient> and <ellipse> glow in the
 * scenes with light that lives on the pixel grid. Two ideas do all the work:
 *
 *   1. TIERS, not falloff. A light is 2–4 discrete brightness steps, each one a
 *      stair-stepped shape built from whole-pixel rows. No interpolation.
 *   2. DITHER, not alpha ramps. The boundary between tiers is an ordered dither
 *      pattern at 50% / 25% / 12% density, which is how pixel art has always
 *      faked gradients. Alpha still varies between tiers, but never *within* one.
 *
 * Memory: every shape below is precomputed to a path string at module load and
 * emitted as ONE <path> node, not N rects. A 54x14 lamp pool that was 1 ellipse
 * + 1 animate becomes 3 paths and 0 animates; a 40-rect stepped disc drawn the
 * naive way would have been 40 nodes.
 *
 * Nothing here allocates during render.
 */

/* ================================================================== *
 * geometry -> path, at module scope
 * ================================================================== */

type Rect = readonly [x: number, y: number, w: number, h: number];

/** Many same-coloured rects -> one path. The single biggest node-count win. */
export function pxPath(rects: readonly Rect[]): string {
  let d = "";
  for (const [x, y, w, h] of rects) d += `M${x} ${y}h${w}v${h}h${-w}z`;
  return d;
}

/**
 * Stair-stepped ellipse as row spans. `step` is the row height in pixels —
 * 2 gives a chunky, obviously-hand-placed edge, 1 gives a smoother one that
 * still never antialiases. Half-widths are rounded to whole pixels.
 */
export function ellipseRows(rx: number, ry: number, step: number): Rect[] {
  const out: Rect[] = [];
  for (let dy = -ry; dy < ry; dy += step) {
    // sample at the row's centre so the top and bottom rows aren't degenerate
    const t = 1 - ((dy + step / 2) / ry) ** 2;
    if (t <= 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    if (hw > 0) out.push([-hw, dy, hw * 2, step]);
  }
  return out;
}

export function offset(rects: readonly Rect[], cx: number, cy: number): Rect[] {
  return rects.map(([x, y, w, h]) => [x + cx, y + cy, w, h] as Rect);
}

/** The tier list a pool produces: outermost first, each subsequent tier brighter. */
export type LightTiers = readonly { d: string; o: number }[];

/** A light pool: outermost tier first, each subsequent tier brighter. */
export function pool(cx: number, cy: number, rx: number, ry: number, step = 2): LightTiers {
  return [
    { d: pxPath(offset(ellipseRows(rx, ry, step), cx, cy)), o: 0.07 },
    { d: pxPath(offset(ellipseRows(rx * 0.78, ry * 0.78, step), cx, cy)), o: 0.08 },
    { d: pxPath(offset(ellipseRows(rx * 0.52, ry * 0.52, step), cx, cy)), o: 0.1 },
    { d: pxPath(offset(ellipseRows(rx * 0.3, ry * 0.3, step), cx, cy)), o: 0.12 },
  ] as const;
}

/* ================================================================== *
 * defs — mount ONCE per <svg> root
 * ================================================================== */

const WARM = "#ffca85";
const SUN = "#ffe2a0";
const EMBER = "#ffa25e";
const NIGHT = "#171009";

/**
 * Ordered dither at four densities. Pattern content cannot resolve
 * `currentColor` against the referencing element, so each tint needs its own
 * set — hence the explicit `w` (warm), `s` (sun), `e` (ember), `n` (night)
 * families. Keep this list short; four tints x four densities is plenty.
 */
/** v2: dots carry half opacity, so remaining dither reads as tone, not noise. */
function Dither({ id, tint }: { id: string; tint: string }) {
  return (
    <>
      <pattern id={`${id}50`} width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={tint} fillOpacity="0.55" />
      </pattern>
      <pattern id={`${id}25`} width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.5" />
      </pattern>
      <pattern id={`${id}12`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={tint} fillOpacity="0.45" />
        <rect x="2" y="2" width="1" height="1" fill={tint} fillOpacity="0.45" />
      </pattern>
      <pattern id={`${id}06`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="1" height="1" fill={tint} fillOpacity="0.4" />
      </pattern>
    </>
  );
}

export function LightDefs() {
  return (
    <defs>
      <Dither id="dw" tint={WARM} />
      <Dither id="ds" tint={SUN} />
      <Dither id="de" tint={EMBER} />
      <Dither id="dn" tint={NIGHT} />
    </defs>
  );
}

/* ================================================================== *
 * lamp pools
 * ================================================================== */

/* Precomputed at load. Add one entry per fixture per scene. */
const POOLS = {
  /** the wall lamp's throw on the render */
  lampWall: pool(116, 70, 34, 26),
  /** the same lamp's pool on the concrete */
  lampFloor: pool(116, 158, 54, 14),
  /** warm spill from the living-room window */
  windowLiving: pool(57, 110, 54, 52, 2),
  /** the bedroom window, smaller */
  windowBed: pool(177, 90, 38, 34, 2),
} as const;

/** Render any tier list from `pool()` — the reusable form of <Pool>. */
const TINT_FILL: Record<"dw" | "ds" | "de", string> = { dw: WARM, ds: SUN, de: EMBER };

/** v2: solid stepped bands at whisper alpha — soft, warm, no speckle. */
export function TierLight({
  tiers,
  tint = "dw",
  boost = 1,
}: {
  tiers: LightTiers;
  tint?: "dw" | "ds" | "de";
  boost?: number;
}) {
  const fill = TINT_FILL[tint];
  return (
    <g>
      {tiers.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static tier list, never reorders
        <path key={i} d={t.d} fill={fill} opacity={t.o * boost} />
      ))}
    </g>
  );
}

export function Pool({
  which,
  tint = "dw",
  boost = 1,
}: {
  which: keyof typeof POOLS;
  tint?: "dw" | "ds" | "de";
  boost?: number;
}) {
  return <TierLight tiers={POOLS[which]} tint={tint} boost={boost} />;
}

/**
 * Flicker without smooth interpolation: discrete opacity steps on the whole
 * pool. `calcMode="discrete"` is the point — the value snaps, it does not ease.
 * One animate element per fixture instead of one per bulb.
 */
export function PoolFlicker({ which, dur = "6.5s" }: { which: keyof typeof POOLS; dur?: string }) {
  return (
    <g>
      <Pool which={which} />
      <animate
        attributeName="opacity"
        calcMode="discrete"
        values="1;0.9;1;0.94;1;0.86;1"
        dur={dur}
        repeatCount="indefinite"
      />
    </g>
  );
}

/* ================================================================== *
 * string lights — pixel stars, three flicker groups, five nodes total
 * ================================================================== */

const BULB_X = [14, 38, 62, 86, 110, 134, 158, 182, 206, 230, 254, 278, 300] as const;
const RAIL = 136;

/** bulb y alternates so the cord reads as a catenary */
const bulbY = (i: number) => RAIL + (i % 2 === 0 ? 8 : 11);

/** the lit filament: 3x3 plus-shape. Reads as a point source at pixel scale. */
const BULB_CORE = pxPath(
  BULB_X.flatMap((x, i) => {
    const y = bulbY(i);
    return [
      [x, y, 3, 1],
      [x + 1, y - 1, 1, 3],
      [x, y + 1, 3, 1],
    ] as Rect[];
  }),
);

/** unlit: just the dead glass */
const BULB_OFF = pxPath(
  BULB_X.flatMap((x, i) => {
    const y = bulbY(i);
    return [
      [x, y, 3, 3],
      [x, y, 3, 1],
    ] as Rect[];
  }),
);

/**
 * Three flicker groups on coprime durations. Splitting the bulbs by index mod 3
 * gives uncorrelated-looking flicker from 3 animate elements rather than 13,
 * and the halo path is shared per group.
 */
const HALO_GROUPS = [0, 1, 2].map((m) =>
  pxPath(
    BULB_X.flatMap((x, i) => {
      if (i % 3 !== m) return [];
      const cx = x + 1;
      const cy = bulbY(i);
      return [
        [cx - 3, cy, 7, 1],
        [cx, cy - 3, 1, 7],
        [cx - 2, cy - 2, 5, 5],
      ] as Rect[];
    }),
  ),
);

export function StringLights({ lit }: { lit: boolean }) {
  if (!lit) return <path d={BULB_OFF} fill="#b8b4a8" />;
  return (
    <g>
      {HALO_GROUPS.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static flicker groups, never reorder
        <path key={i} d={d} fill="url(#dw25)" opacity={0.55}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.55;0.4;0.6;0.45;0.55"
            dur={`${3.1 + i * 0.7}s`}
            repeatCount="indefinite"
          />
        </path>
      ))}
      <path d={BULB_CORE} fill="#fff4d4" />
    </g>
  );
}

/* ================================================================== *
 * sun bands — hard steps with a dithered leading edge
 * ================================================================== */

/**
 * A sunband is 3 stepped strips. `skew` is the pixel drop from left edge to
 * right, quantised into 6px stairs so the band still reads as a raked light
 * shaft crossing the wall.
 */
export function bandPath(W: number, y: number, h: number, skew: number): string {
  const cols = Math.ceil(W / 6);
  const rects: Rect[] = [];
  for (let c = 0; c < cols; c++) {
    const dy = Math.round((skew * c) / cols);
    rects.push([c * 6, y + dy, 6, h]);
  }
  return pxPath(rects);
}

const W = 310;

export const BANDS: Record<"dawn" | "day" | "dusk", { d: string; fill: string; o: number }[]> = {
  // low sun, gets under the overhang and lands high on the render
  dawn: [
    { d: bandPath(W, 50, 8, -14), fill: "url(#ds25)", o: 0.5 },
    { d: bandPath(W, 58, 30, -14), fill: "url(#ds50)", o: 0.34 },
    { d: bandPath(W, 88, 10, -14), fill: "url(#ds12)", o: 0.4 },
  ],
  // overhang blocks the wall; only the outer slab burns
  day: [
    { d: pxPath([[0, 138, W, 6]]), fill: "url(#ds25)", o: 0.5 },
    { d: pxPath([[0, 144, W, 14]]), fill: "url(#ds50)", o: 0.3 },
    { d: pxPath([[0, 158, W, 4]]), fill: "url(#ds12)", o: 0.4 },
  ],
  // low and orange, reaches all the way to the back wall
  dusk: [
    { d: bandPath(W, 94, 8, -16), fill: "url(#de25)", o: 0.55 },
    { d: bandPath(W, 102, 34, -16), fill: "url(#de50)", o: 0.36 },
    { d: bandPath(W, 136, 12, -16), fill: "url(#de12)", o: 0.45 },
  ],
};

export function SunBand({ ph }: { ph: "dawn" | "day" | "dusk" | "night" }) {
  if (ph === "night") return null;
  return (
    <g>
      {BANDS[ph].map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static tier list, never reorders
        <path key={i} d={b.d} fill={b.fill} opacity={b.o} />
      ))}
    </g>
  );
}

/* ================================================================== *
 * vignette — a dithered frame, not a radial gradient
 * ================================================================== */

const H = 180;

/** Four nested rings of decreasing density. 3 nodes, all on the grid. */
const VIG = [
  {
    d: pxPath([
      [0, 0, W, 6],
      [0, H - 8, W, 8],
      [0, 0, 8, H],
      [W - 8, 0, 8, H],
    ]),
    p: "dn50",
  },
  {
    d: pxPath([
      [0, 6, W, 6],
      [0, H - 16, W, 8],
      [8, 0, 8, H],
      [W - 16, 0, 8, H],
    ]),
    p: "dn25",
  },
  {
    d: pxPath([
      [0, 12, W, 8],
      [0, H - 26, W, 10],
      [16, 0, 10, H],
      [W - 26, 0, 10, H],
    ]),
    p: "dn12",
  },
] as const;

export function Vignette({ strength = 1 }: { strength?: number }) {
  // v2: solid rings at a whisper — felt, never seen
  const o = [0.1, 0.07, 0.05];
  return (
    <g>
      {VIG.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static rings, never reorder
        <path key={i} d={v.d} fill={NIGHT} opacity={(o[i] ?? 0.05) * strength} />
      ))}
    </g>
  );
}

/* ================================================================== *
 * AO / contact — one node each instead of five
 * ================================================================== */

/**
 * The old AO() stacked up to 5 rects with computed rgba strings. Three dither
 * rows read the same at pixel scale and cost 1 node.
 */
export function AO({ x, y, w, op = 1 }: { x: number; y: number; w: number; op?: number }) {
  return (
    <g opacity={op}>
      <path d={pxPath([[x, y, w, 2]])} fill={NIGHT} opacity={0.22} />
      <path d={pxPath([[x, y + 2, w, 2]])} fill={NIGHT} opacity={0.13} />
      <path d={pxPath([[x, y + 4, w, 1]])} fill={NIGHT} opacity={0.07} />
    </g>
  );
}

/* ================================================================== *
 * the purist option
 * ================================================================== */

/**
 * Everything above still tints with alpha over the base art. The fully
 * authentic route is palette shifting: no overlays at all, one material ramp
 * per phase, chosen at the top of the scene and threaded down.
 *
 *   const RAMPS: Record<Ph, typeof M> = { dawn: {...}, day: M, dusk: {...}, night: {...} };
 *   const mat = RAMPS[ph];
 *
 * Cost: 4x the palette to author and keep consistent. Benefit: zero overlay
 * nodes, zero alpha compositing, and light that actually looks hand-picked
 * rather than washed. Worth doing for the two or three materials that dominate
 * a scene's screen area (render, concrete) and leaving the rest on overlays.
 */
