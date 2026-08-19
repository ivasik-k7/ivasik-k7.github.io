import {
  AOSet,
  aoPaths,
  Bev,
  Bevel,
  bevelPaths,
  bulbPaths,
  Contact,
  contactPaths,
  dim,
  dth,
  LayeredScene,
  Light,
  M,
  type Mat,
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  SharedDefs,
  STEP_DROOP,
  STEP_FADE,
  STEP_SLIDE,
  shift,
  steppedCable,
  steppedCone,
  steppedEllipse,
  steppedQuad,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";

// --- BALKON / flat 14, klatka B, fourth floor -------------------------------------

/**
 * Fourth pass, and the first one that uses the kits. This scene predates them:
 * it was carrying its own materials, its own Bevel, its own AO, its own Contact,
 * its own `Ph` and `toPhase`, and its own <defs> block of fourteen gradients. All
 * of that is gone. What it does now, it does through pixelKit and lightKit, the
 * same way the street and the corridor do.
 *
 * ==================================================================
 * SCALE, and this is the finding that changes how the whole scene reads. The
 * balcony was drawn 3.58 m tall. At the house key —
 *
 *     PPM = 38 px per metre, 2.6 cm per pixel
 *
 * — a slab-to-slab storey in this block is 2.80 m, which is 106 px, and the floor
 * line here is y150 like every other scene. So the underside of the balcony above
 * belongs at y44, not y14. It was 136 px of frame between soffit and slab: one and
 * a third storeys. Everything hanging off that was wrong with it:
 *
 *                       real      should be    was
 *   soffit height       2.80 m      106 px    136    a storey and a third
 *   terrace door        2.10 m       80 px    108    2.84 m — a shop front
 *   door width          1.47 m       56 px     82    2.16 m of opening
 *   window head         2.10 m       y 70     y 50
 *   window sill         0.90 m       y116     y100
 *   AC outdoor unit  0.79×0.55 m    30×21    30×18   the only one that was close
 *   skis                1.70 m       65 px     88    2.3 m of ski
 *   broom               1.40 m       53 px     52    fine
 *   bike wheel          0.68 m       26 px     20    0.53 m
 *
 * Narrowing the door is the fix that pays twice. At 56 px it is a real 1.47 m
 * double terrace door, and its centre lands on 44 — which is exactly where the
 * `door-living3` hitbox already was. That hitbox has been pointing 13 px left of
 * its own door since the first pass; it now points at the middle of it, and no
 * translation entry had to change to make that true.
 *
 * The Foreground is deliberately exempt from the key. It is a fixed near plane
 * cropped by the bottom of frame, so the parapet's 34 px of cap is a perspective
 * crop, not a 0.9 m wall. It is measured against the lens, not against the slab.
 * ==================================================================
 *
 * THE REST OF THE AUDIT:
 *
 *   1. FOURTEEN GRADIENTS, NINE ELLIPSES, FOUR POLYGONS, ONE CIRCLE. This scene
 *      held every banned primitive in the project, and it held all of them. A
 *      radial gradient on a lamp pool is the single fastest way to stop being
 *      pixel art: it is the one thing on screen with no pixel grid at all. Every
 *      pool is a steppedEllipse now, every cone a steppedCone, every sun band a
 *      steppedQuad through `tiers`, every glow a bulbPaths halo, every falloff a
 *      dithered band through `dth`, and both vignettes a `vignettePaths` set.
 *
 *   2. NOTHING WAS PRECOMPUTED. Every pixel was an inline `px()` call inside the
 *      render, including the ones that never change — the divider planks, the AC
 *      fins, the rail posts, the thirteen string-light bulbs, the jars, the mat
 *      ribs. Everything static is now a path built at module load, and everything
 *      repeated is banked: the divider's six plank lines are one path, the
 *      string lights are two, the slab joints one.
 *
 *   3. NO artKey, on a scene with eleven world reads.
 *
 *   4. FIVE LOOSE BOOLEANS. Twelve clamped stages now, deriving from the clock,
 *      with every legacy flag still overriding.
 *
 *   5. THE BALCONY COULD NOT SEE THE WEATHER IT WAS STANDING IN — which on a
 *      balcony is not a nicety, it is the premise. It reads `world.street` now:
 *      the washing comes off the line when it rains, the parapet cap and the
 *      flower box and the bike sheet take snow, the marigolds go bare in winter,
 *      the swallows leave with the season, the slab holds puddles, and the drip
 *      off the balcony above falls past the parapet in the near plane.
 *
 * SIX PLANES, where there were three:
 *   farBackground (0.64) — the deep interior: the far wall of the living room,
 *     the hallway beyond it, the bedroom's wardrobe wall, and the neighbour's
 *     parapet through the missing plank.
 *   middleBackground (0.84) — the near interior: the sofa, the cat on it, the
 *     television and its flicker, the тюль against the glass.
 *   ground (1.0) — the facade: render, both openings, glass, every fixture, the
 *     slab. All 17 hitboxes resolve here.
 *   staticObjects (1.0) — the eleven things standing on the slab.
 *   gameplayObjects (1.0) — the door leaf, which opens, and the rack, which
 *     folds. The two things with moving parts.
 *   Foreground (fixed) — the parapet, the rail, the string lights, the flower
 *     box, the hanging pot from the balcony above, the stray, the near drip.
 *
 * LIGHTING PREMISE, which was the one genuinely good thing about the old pass and
 * is kept whole: a balcony has an overhang, so the sun can only reach the back
 * wall when it is low. At dawn a cold band lands high on the render, at dusk a
 * deep orange one lands low and the rail posts throw their shadows up the wall,
 * at midday the overhang blocks it and only the outer slab burns while the wall
 * sits in bounce. At night the sun is replaced by six sources at three
 * temperatures: the bulkhead lamp, the string lights, the room through the
 * terrace glass, the bedroom through its window, the television, and whatever the
 * neighbour has on. Everything else follows.
 *
 * BUDGET. ~520 live nodes at the busiest state, 31 animations, 19 of them
 * calcMode="discrete". The old pass ran ~700 nodes with 26 animations and 14
 * gradients; the node count came down because the repeats are banked, and the
 * gradients came out entirely.
 */

const W = 310;
const H = 180;

const PPM = 38;
// @ts-expect-error TS6133 — the metre helper, kept beside PPM so the next
// piece of art in this file has it to hand.
const _m = (metres: number) => Math.round(metres * PPM);

/* Landmark rows. Every vertical in this file derives from these. */
const CEIL = 44; // underside of the balcony above — one storey, 2.80 m
const HEAD = FLOOR_HEAD(); // 70 — door and window head, 2.10 m
const SILL = 116; // window sill, 0.90 m
const FLOOR = 150; // the slab, as in every other scene
const CY = 149; // where contact shadows sit against the wall
const HANDLE = 110; // 1.05 m — door handle, window handle, the switch is above it

/** Declared as a function only so the row table above reads top to bottom. */
function FLOOR_HEAD() {
  return 150 - 80; // FLOOR - m(2.10)
}

/** The two openings. Both are holes in the wall, not boxes drawn over it. */
const DOOR = { x0: 16, x1: 72, gx0: 20, gx1: 68, gy0: 74, gy1: 144 } as const;
const WIN = { x0: 148, x1: 202, gx0: 152, gx1: 198, gy0: 76, gy1: 110 } as const;
/** The divider, and the plank that went missing in the storm. */
const DIV = { x0: 288, x1: 306, gapY0: 76, gapY1: 92 } as const;

/* ================================================================== *
 * palette
 * ================================================================== */

const DAWN_CAST = "#8c86a8";
const DUSK_CAST = "#c98a52";
const NIGHT_CAST = "#141a24";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.15),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.18),
    night: dim(mat, NIGHT_CAST, 0.6),
  };
}

/** The same render this block got in about 2008, and the street scene draws. */
const RENDER_MAT: Mat = {
  hi: "#e2d8c6",
  base: "#cfc4ae",
  mid: "#c2b7a1",
  lo: "#b8ad97",
  deep: "#9a9078",
};
/** The soffit is the same concrete as the slab but never sees the sun. */
const SOFFIT_MAT: Mat = {
  hi: "#b8ad97",
  base: "#a89d87",
  mid: "#9c9280",
  lo: "#8f8570",
  deep: "#756c59",
};
const FRAME_MAT: Mat = {
  hi: "#a4aab0",
  base: "#8a8d92",
  mid: "#7d8085",
  lo: "#6d7278",
  deep: "#54585d",
};
const DIVIDER_MAT: Mat = {
  hi: "#c8c1b1",
  base: "#b5ae9e",
  mid: "#aaa392",
  lo: "#a29b8c",
  deep: "#877f70",
};

const RENDER = ramp(RENDER_MAT);
const SOFF = ramp(SOFFIT_MAT);
const CONC = ramp(M.concrete);
const FRAME = ramp(FRAME_MAT);
const DIVIDER = ramp(DIVIDER_MAT);
const STEEL = ramp(M.steel);
const TIN = ramp(M.tin);
const WOOD = ramp(M.wood);
// @ts-expect-error TS6133 — the oak ramp, mixed and unused while the balcony
// furniture is reworked.
const _OAK = ramp(M.oak);
const LINEN = ramp(M.linen);
const LEAFM = ramp(M.leaf);

const K = {
  glass: { dawn: "#b9b3c6", day: "#8fa8b8", dusk: "#c08a63", night: "#232a34" } as Record<
    Ph,
    string
  >,
  glassLit: "#ffd98a",
  warm: "#ffd98a",
  warmHi: "#fff0c4",
  bulbOn: "#ffe6b0",
  bulbOff: "#b8b4a8",
  cream: "#f2ede0",
  white: "#f2f2ee",
  tulle: "#f4f0e4",
  renderDamp: "#a89e8a",
  renderPatch: "#c2b7a1",
  rust: "#8a6a4a",
  rustHi: "#a3805c",
  marigold: "#e8a445",
  marigoldHi: "#f2bd63",
  marigoldLo: "#d9832f",
  marigoldDead: "#8a7a4a",
  soil: "#4a3a2b",
  soilWet: "#3a2c1e",
  sprout: "#7fae76",
  ledRed: "#ff5050",
  ledBlue: "#7ea8e0",
  tv: "#9fc7d6",
  bird: "#2f3238",
  cat: "#4a4438",
  catHi: "#5d5648",
  water: "#6a7580",
  waterHi: "#8aa2b0",
  puddleNight: "#2f3a46",
  snow: "#eef4f8",
  snowLo: "#c8d6e0",
  ice: "#cfe0ea",
  leafDry: "#b07a3a",
  ash: "#d9d3c2",
  jar: "#aebfc9",
  jarHi: "#cddce4",
} as const;

/* ================================================================== *
 * state — a balcony runs on the clock and on the weather, in that order
 * ================================================================== */

export type LineStage = 0 | 1 | 2 | 3;
export type RackStage = "up" | "folded";
export type PlantStage = "thirsty" | "watered";
export type AshStage = "clean" | "used" | "full";
export type BikeStage = "bare" | "sheeted";
export type SwitchStage = "auto" | "on" | "off";
export type DoorStage = "shut" | "ajar";
export type CoffeeStage = "none" | "fresh" | "cold";
export type CatStage = "away" | "rail" | "asleep";
export type NeighbourStage = "away" | "home" | "smoking";
export type SwallowStage = "nest" | "flying" | "gone";

const RACKS: readonly RackStage[] = ["up", "folded"];
const PLANTS: readonly PlantStage[] = ["thirsty", "watered"];
const ASHES: readonly AshStage[] = ["clean", "used", "full"];
const BIKES: readonly BikeStage[] = ["bare", "sheeted"];
const SWITCHES: readonly SwitchStage[] = ["auto", "on", "off"];
const DOORS: readonly DoorStage[] = ["shut", "ajar"];
const COFFEES: readonly CoffeeStage[] = ["none", "fresh", "cold"];
const CATS: readonly CatStage[] = ["away", "rail", "asleep"];
const NEIGHBOURS: readonly NeighbourStage[] = ["away", "home", "smoking"];
const SWALLOWS: readonly SwallowStage[] = ["nest", "flying", "gone"];

type BalconyState = {
  line: LineStage;
  rack: RackStage;
  seedlings: PlantStage;
  flowers: PlantStage;
  ashtray: AshStage;
  bike: BikeStage;
  rail: SwitchStage;
  lamp: SwitchStage;
  door: DoorStage;
  coffee: CoffeeStage;
  cat: CatStage;
  neighbour: NeighbourStage;
  swallows: SwallowStage;
};

/* Both of these are the street's, verbatim, and belong in the kit — see the
 * hoist list at the foot of the file. */
function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/** What the flat behind the glass is doing. Three reads, all defensive. */
type Interior = { studio: boolean; study: boolean; tv: boolean };

function interior(world: WorldState): Interior {
  const l = (world.lights ?? {}) as unknown as Record<string, boolean | undefined>;
  const tv = (world as unknown as Record<string, unknown>).tv;
  return { studio: !!l.studio, study: !!l.study, tv: typeof tv === "string" && tv !== "off" };
}

/** What the street is doing, which on a balcony is most of the art direction. */
export type Weather = "clear" | "overcast" | "rain" | "wet" | "snow";
export type Season = "green" | "autumn" | "bare";
const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain", "wet", "snow"];
const SEASONS: readonly Season[] = ["green", "autumn", "bare"];

type Outside = { weather: Weather; season: Season };

function outside(world: WorldState): Outside {
  const s = ((world as unknown as Record<string, unknown>).street ?? {}) as Record<string, unknown>;
  return {
    weather: clampStage(s.weather, WEATHERS, "clear"),
    season: clampStage(s.season, SEASONS, "autumn"),
  };
}

const isWet = (o: Outside) => o.weather === "rain" || o.weather === "wet";
const isSnow = (o: Outside) => o.weather === "snow";
const isFlat = (o: Outside) =>
  o.weather === "overcast" || o.weather === "rain" || o.weather === "snow";
/** Nothing dries and nothing gets left out. */
const isFoul = (o: Outside) => o.weather === "rain" || o.weather === "snow";

/**
 * Every key falls back to what the clock and the weather say. The five legacy
 * booleans — `lights.balcony`, `balcony.watered`, `.flowersWatered`, `.smoked`,
 * `.bikeCovered` — still win where they are set, so an old save loads into the
 * frame it used to draw.
 */
function state(world: WorldState, ph: Ph, o: Outside): BalconyState {
  const b = ((world as unknown as Record<string, unknown>).balcony ?? {}) as Record<
    string,
    unknown
  >;
  const l = (world.lights ?? {}) as unknown as Record<string, boolean | undefined>;
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const drying = (ph === "day" || ph === "dawn") && !isFoul(o);
  return {
    line: clampInt(
      b.line,
      3,
      isFoul(o) ? 0 : ph === "day" ? 3 : ph === "dawn" ? 2 : dark ? 1 : 0,
    ) as 0 | 1 | 2 | 3,
    rack: clampStage(b.rack, RACKS, drying ? "up" : "folded"),
    seedlings: clampStage(
      b.seedlings,
      PLANTS,
      b.watered === true || isWet(o) ? "watered" : "thirsty",
    ),
    flowers: clampStage(
      b.flowers,
      PLANTS,
      b.flowersWatered === true || isWet(o) ? "watered" : "thirsty",
    ),
    ashtray: clampStage(b.ashtray, ASHES, b.smoked === true ? "used" : dark ? "used" : "clean"),
    bike: clampStage(b.bike, BIKES, b.bikeCovered === true || isSnow(o) ? "sheeted" : "bare"),
    rail: clampStage(b.rail, SWITCHES, l.balcony === true ? "on" : "auto"),
    lamp: clampStage(b.lamp, SWITCHES, "auto"),
    /* the door stands open on a clear day, which is the entire point of a balcony */
    door: clampStage(b.door, DOORS, ph === "day" && o.weather === "clear" ? "ajar" : "shut"),
    coffee: clampStage(b.coffee, COFFEES, ph === "dawn" ? "fresh" : ph === "day" ? "cold" : "none"),
    cat: clampStage(b.cat, CATS, night ? "asleep" : ph === "dusk" ? "rail" : "away"),
    neighbour: clampStage(
      b.neighbour,
      NEIGHBOURS,
      night ? "home" : ph === "dusk" ? "smoking" : "away",
    ),
    swallows: clampStage(
      b.swallows,
      SWALLOWS,
      o.season === "bare" ? "gone" : dark || ph === "dawn" ? "flying" : "nest",
    ),
  };
}

/** The bulkhead over the door. Auto means: on with the rail, or when the room is. */
function lampOn(s: BalconyState, i: Interior, ph: Ph): boolean {
  if (s.lamp === "on") return true;
  if (s.lamp === "off") return false;
  const dark = ph === "night" || ph === "dusk";
  return s.rail === "on" || (dark && i.studio);
}
const railOn = (s: BalconyState, ph: Ph) =>
  s.rail === "on" || (s.rail === "auto" && (ph === "night" || ph === "dusk"));

/* ================================================================== *
 * helpers — all four are hoist candidates, see the foot of the file
 * ================================================================== */

function bank(shape: readonly Rect[], n: number, pitch: number, dy = 0): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) out.push(...shift(shape, i * pitch, i * dy));
  return out;
}

/** Integer-scaled pixel text. Non-integer k takes the letters off the grid. */
// The scene's own display type, drawn but not yet hung.
// @ts-expect-error TS6133
function _BigText({
  x,
  y,
  text,
  fill,
  k = 2,
  gap = 1,
  op,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  k?: number;
  gap?: number;
  op?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d={textPath(text, 0, 0, gap)} fill={fill} opacity={op} />
    </g>
  );
}

/** A lit aperture washing down onto the slab. The street calls this `spill`. */
function wash(x0: number, x1: number, top: number, spread: number, tint: "w" | "c" | "e", g = 0.7) {
  return tiers(
    (k) =>
      steppedQuad(
        top,
        x0 + (1 - k) * spread,
        x1 - (1 - k) * spread,
        FLOOR + 22,
        x0 - spread + (1 - k) * spread,
        x1 + spread - (1 - k) * spread,
        8,
      ),
    tint,
    g,
  );
}

/**
 * A horizontal band of sun, nested about a centre row. This is how the sun gets
 * under an overhang: not as a polygon with a gradient in it, but as four stepped
 * bands that tighten toward the middle.
 */
function sunBand(cy: number, half: number, tint: "w" | "c" | "e", g = 0.7) {
  return tiers((k) => steppedQuad(cy - half * k, 0, W, cy + half * k, 0, W, 6), tint, g);
}

/* ================================================================== *
 * precomputed geometry — the soffit
 * ================================================================== */

/** The soffit slab, its drip groove, and the board marks in the concrete. */
const SOFFIT_MARKS = pxPath(bank([[0, 8, W, 1]], 4, 9));
const SOFFIT_GROOVE = pxPath([
  [0, CEIL - 6, W, 2],
  [0, CEIL - 4, W, 1],
]);
const SOFFIT_AO = aoPaths([[0, CEIL, W]]);
/** The hook the line hangs off, and the one at the far end. */
const LINE_HOOKS = pxPath([
  [24, 28, 3, 7],
  [292, 26, 3, 7],
]);
/** The line itself. A slack cord is a catenary, and the kit has one. */
const LINE_CORD = pxPath(steppedCable(26, 34, 292, 32, 9, 6));
/** Six pegs living on it permanently, whether there is washing or not. */
const LINE_PEGS: readonly Rect[] = [
  [58, 34, 3, 4],
  [80, 36, 3, 4],
  [104, 35, 3, 4],
  [130, 36, 3, 4],
  [172, 35, 3, 4],
  [196, 34, 3, 4],
];
const PEGS_D = pxPath(LINE_PEGS);
const PEGS_HI = pxPath(LINE_PEGS.map(([x, y, w]) => [x, y, w, 1] as Rect));
/** The swallows' nest, wedged in the corner above the AC unit — which is why
 *  they picked it: the condenser is the warmest thing on this elevation. */
const NEST = pxPath([
  [232, 34, 18, 10],
  [236, 36, 10, 5],
]);
const NEST_AO = aoPaths([[232, 44, 18]]);
/** The mount for the pot that hangs from the balcony above, in the near plane. */
const POT_STRAPS = pxPath([
  [10, 0, 1, 14],
  [26, 0, 1, 14],
]);

/* ================================================================== *
 * the wall
 * ================================================================== */

/**
 * The render, drawn as five rects that exclude both openings. This is the
 * lesson the klatka door and the corridor window both taught: a glazed opening
 * is a hole with rails around it, and anything drawn over the aperture paints
 * out the plane you built behind it.
 */
const WALL: Rect[] = [
  [0, CEIL, DOOR.x0, FLOOR - CEIL],
  [DOOR.x1, CEIL, WIN.x0 - DOOR.x1, FLOOR - CEIL],
  [WIN.x1, CEIL, W - WIN.x1, FLOOR - CEIL],
  [DOOR.x0, CEIL, DOOR.x1 - DOOR.x0, DOOR.gy0 - CEIL - 8],
  [WIN.x0, SILL + 4, WIN.x1 - WIN.x0, FLOOR - SILL - 4],
];
const WALL_D = pxPath(WALL);
/** Trowel courses in the render, banked. */
const WALL_COURSES = pxPath([
  [0, 90, DOOR.x0, 1],
  [DOOR.x1, 90, WIN.x0 - DOOR.x1, 1],
  [WIN.x1, 90, W - WIN.x1, 1],
]);
/** The vertical bands where the render was floated in lifts. */
const WALL_LIFTS = pxPath(
  ([80, 108, 136, 208, 250, 274] as const).flatMap(
    (x) =>
      [
        [x, CEIL, 3, FLOOR - CEIL],
        [x, CEIL, 1, FLOOR - CEIL],
      ] as Rect[],
  ),
);
/** Damage the building has stopped apologising for. */
const WALL_CRACK = pxPath([
  [126, 82, 1, 26],
  [127, 82, 1, 26],
  [127, 108, 1, 14],
  [124, 96, 3, 1],
]);
const WALL_PATCH = pxPath([[236, 96, 22, 20]]);
const WALL_DAMP = pxPath([
  [0, 130, 20, 20],
  [276, 124, 14, 26],
]);
const WALL_RUSTRUN = pxPath([
  [214, 68, 4, 22],
  [218, 68, 2, 14],
]);

/* --- the terrace door: rails around a hole --- */
const DOOR_RAILS = pxPath([
  [DOOR.x0, HEAD - 4, DOOR.x1 - DOOR.x0, 8],
  [DOOR.x0, HEAD - 4, 4, FLOOR - HEAD + 4],
  [DOOR.x1 - 4, HEAD - 4, 4, FLOOR - HEAD + 4],
  [DOOR.x0, DOOR.gy1, DOOR.x1 - DOOR.x0, 6],
]);
const DOOR_RAILS_HI = pxPath([
  [DOOR.x0, HEAD - 4, DOOR.x1 - DOOR.x0, 1],
  [DOOR.x0, HEAD - 4, 2, FLOOR - HEAD + 4],
]);
const DOOR_STILE = pxPath([[42, DOOR.gy0, 4, DOOR.gy1 - DOOR.gy0]]);
const DOOR_AO = aoPaths([[DOOR.gx0, DOOR.gy0, DOOR.gx1 - DOOR.gx0]]);
/** Three stepped strokes of reflection. A pane with none is a hole. */
const DOOR_REFLECT = pxPath([
  [24, 132, 12, 1],
  [28, 118, 14, 1],
  [50, 104, 14, 1],
  [56, 88, 10, 1],
]);
/** The tape over the crack, and the sticker somebody's kid put there. */
const DOOR_TAPE = pxPath([
  [26, 122, 16, 2],
  [30, 112, 1, 12],
]);
/** тюль, hanging inside, in three panels so the draught can move the middle one. */
const TULLE_SIDES = pxPath([
  [DOOR.gx0, DOOR.gy0, 8, DOOR.gy1 - DOOR.gy0],
  [DOOR.gx1 - 8, DOOR.gy0, 8, DOOR.gy1 - DOOR.gy0],
]);
const TULLE_MID = pxPath([[38, DOOR.gy0, 10, 48]]);

/* --- the bedroom window --- */
const WIN_RAILS = pxPath([
  [WIN.x0, HEAD - 4, WIN.x1 - WIN.x0, 8],
  [WIN.x0, HEAD - 4, 4, SILL - HEAD + 4],
  [WIN.x1 - 4, HEAD - 4, 4, SILL - HEAD + 4],
  [WIN.x0, WIN.gy1, WIN.x1 - WIN.x0, 6],
  [173, WIN.gy0, 3, WIN.gy1 - WIN.gy0],
]);
const WIN_RAILS_HI = pxPath([
  [WIN.x0, HEAD - 4, WIN.x1 - WIN.x0, 1],
  [WIN.x0, HEAD - 4, 2, SILL - HEAD + 4],
]);
const WIN_REFLECT = pxPath([
  [156, 102, 10, 1],
  [160, 90, 12, 1],
  [180, 84, 12, 1],
]);
const WIN_CILL = bevelPaths([[145, SILL, 60, 4]]);
const WIN_AO = aoPaths([
  [WIN.gx0, WIN.gy0, WIN.gx1 - WIN.gx0],
  [145, SILL + 4, 60],
]);

/* --- fixtures --- */
/** The awning nobody has let down since 2019, rolled in its box. */
const AWNING = bevelPaths([[20, 46, 100, 8]]);
const AWNING_BRACKETS = pxPath(bank([[30, 54, 3, 4]], 4, 28));
/** The bulkhead lamp, its bracket, and the cage that went on after the third one. */
const LAMP_BOX = bevelPaths([[112, 76, 12, 10]]);
const LAMP_BRACKET = pxPath([[116, 72, 4, 4]]);
const LAMP_CAGE = pxPath([
  [112, 76, 1, 10],
  [116, 76, 1, 10],
  [120, 76, 1, 10],
  [112, 81, 12, 1],
]);
const LAMP_AO = aoPaths([[112, 86, 12]]);
/** The switch, at 1.05 m, where your hand already goes — and now, for the first
 *  time, actually underneath the `switch-balcony` hitbox. */
const SWITCH_BOX = bevelPaths([[112, HANDLE - 2, 8, 11]]);
/** The AC outdoor unit: 0.79 × 0.55 m, its fins, its bracket, its drip. */
const AC_BOX = bevelPaths([[220, 46, 30, 21]]);
const AC_FINS = pxPath(bank([[224, 49, 2, 15]], 6, 4));
const AC_FINS_HI = pxPath(bank([[224, 49, 1, 15]], 6, 4));
const AC_AO = aoPaths([[220, 67, 30]]);
const AC_CONDUIT = pxPath([
  [250, 52, 8, 2],
  [256, 52, 2, 34],
  [256, 52, 1, 34],
  [256, 86, 14, 2],
]);
const AC_DRIPLINE = pxPath([[232, 67, 2, 6]]);
/** The dish nobody has watched since the fibre came. */
const DISH = pxPath([
  [252, 84, 14, 13],
  [254, 86, 10, 9],
  [257, 97, 3, 6],
  [246, 88, 7, 2],
]);
/** The meter box, and the run down from it. */
const METER = bevelPaths([[272, 88, 12, 14]]);
const METER_RUN = pxPath([
  [276, 102, 2, 16],
  [276, 118, 8, 2],
]);
/** The drainpipe, its two brackets, and the rust bloom at the joint. */
const PIPE = pxPath([[262, 0, 7, FLOOR]]);
const PIPE_HI = pxPath([[262, 0, 2, FLOOR]]);
const PIPE_LO = pxPath([[268, 0, 1, FLOOR]]);
const PIPE_BRACKETS = bevelPaths([
  [260, 60, 11, 4],
  [260, 112, 11, 4],
]);
const PIPE_RUST = pxPath([
  [263, 64, 5, 10],
  [264, 120, 4, 22],
]);
/** The divider, and the plank that went in the storm. Six lines, one path. */
const DIV_BODY: Rect[] = [
  [DIV.x0, 30, DIV.x1 - DIV.x0, DIV.gapY0 - 30],
  [DIV.x0, DIV.gapY1, DIV.x1 - DIV.x0, FLOOR - DIV.gapY1],
];
const DIV_BODY_D = pxPath(DIV_BODY);
const DIV_PLANKS = pxPath(
  ([38, 50, 62, 100, 112, 124, 136] as const).flatMap(
    (y) =>
      [
        [DIV.x0, y, DIV.x1 - DIV.x0, 1],
        [DIV.x0, y + 1, DIV.x1 - DIV.x0, 1],
      ] as Rect[],
  ),
);
const DIV_POSTS = pxPath([
  [DIV.x0, 30, 3, FLOOR - 30],
  [DIV.x1 - 2, 30, 2, FLOOR - 30],
]);
/** The two ragged ends where the plank tore out. */
const DIV_TEAR = pxPath([
  [DIV.x0, DIV.gapY0 - 2, 6, 2],
  [DIV.x0 + 9, DIV.gapY0 - 3, 5, 3],
  [DIV.x0 + 4, DIV.gapY1, 7, 2],
]);

/* ================================================================== *
 * the slab
 * ================================================================== */

/** 500 mm joints, two courses in frame, and the fall toward the drain. */
const SLAB_JOINTS = pxPath([
  ...bank([[19, FLOOR, 1, 16]], 7, 42),
  [0, 164, W, 1],
  [0, 165, W, 1],
  [0, 174, W, 1],
]);
const SLAB_AO = aoPaths([[0, FLOOR, W]]);
/** The floor drain, which is the reason the slab has a fall at all. */
const DRAIN = pxPath([[148, 168, 12, 6]]);
const DRAIN_SLOTS = pxPath(bank([[149, 169, 1, 4]], 4, 3));
/** The puddle that never quite goes, and the ripple in it. */
const PUDDLE = pxPath(steppedEllipse(168, 172, 16, 4, 2));
const PUDDLE_WET = pxPath(steppedEllipse(168, 172, 24, 6, 2));
const PUDDLE_HI = pxPath(steppedEllipse(166, 171, 9, 1, 1));
/** What ends up on a balcony slab: grit, a bottle cap, two cigarette ends. */
const SLAB_GRIT = pxPath([
  [96, 166, 2, 2],
  [102, 172, 2, 2],
  [58, 170, 3, 1],
  [212, 168, 2, 1],
  [266, 168, 6, 2],
]);
const SLAB_PAINT = pxPath([
  [200, 152, 22, 3],
  [206, 155, 10, 2],
  [120, 160, 8, 2],
]);
/** The doormat, its ribs, and the boot-scraper edge. */
const MAT = bevelPaths([[18, FLOOR, 36, 9]]);
const MAT_RIBS = pxPath(bank([[22, 152, 2, 6]], 6, 6));

/* --- contact shadows and occlusion, one pass each --- */
const CONTACTS = contactPaths([
  [9, 16, CY], // boots
  [70, 28, CY], // stool
  [94, 16, CY], // folded chair
  [106, 22, CY], // watering can
  [150, 52, CY], // the rack, when it is up
  [184, 18, CY], // skis and poles
  [197, 10, CY], // broom
  [218, 40, CY], // seedling boxes
  [237, 22, CY], // the bag of soil
  [252, 28, CY], // crate of jars
  [280, 50, CY], // the bicycle
]);

/* ================================================================== *
 * light — quantised, six sources, zero gradients
 * ================================================================== */

/** The bulkhead: a cone down the wall and a pool on the slab. */
const LAMP_CONE = tiers(
  (k) => steppedCone(118, 86, Math.round(10 * k), FLOOR, Math.round(52 * k), 6),
  "w",
  0.85,
);
const LAMP_POOL = tiers(
  (k) => steppedEllipse(118, 158, Math.round(50 * k), Math.max(2, Math.round(9 * k)), 2),
  "w",
  0.7,
);
const LAMP_HALO = bulbPaths([[118, 81]]);
/** The string lights. Thirteen bulbs, one halo path, one core path. */
const BULB_X = [14, 38, 62, 86, 110, 134, 158, 182, 206, 230, 254, 278, 300] as const;
const BULB_Y = (i: number) => 140 + (i % 2 === 0 ? 8 : 11);
const BULB_HALOS = bulbPaths(BULB_X.map((x, i) => [x + 1, BULB_Y(i) + 1] as const));
const BULB_CORES: readonly Rect[] = BULB_X.map((x, i) => [x, BULB_Y(i), 3, 3] as Rect);
const BULBS_D = pxPath(BULB_CORES);
const BULBS_HI = pxPath(BULB_CORES.map(([x, y, w]) => [x, y, w, 1] as Rect));
/** Two flicker groups on coprime cycles, so the run never pulses as one thing. */
const BULBS_A = pxPath(BULB_CORES.filter((_, i) => i % 2 === 0));
const BULBS_B = pxPath(BULB_CORES.filter((_, i) => i % 2 === 1));
/** The rail lights throw a low wash back at the slab and up under the parapet. */
const RAIL_WASH = tiers(
  (k) => steppedQuad(FLOOR + 26, 0, W, FLOOR + 4, (1 - k) * 40, W - (1 - k) * 40, 6),
  "w",
  0.5,
);

/** The room, through the terrace glass. Cold-warm, and it reaches the slab. */
const ROOM_WASH = wash(DOOR.gx0, DOOR.gx1, DOOR.gy0, 30, "w", 0.8);
/** With the door ajar, the same light comes out of a 26 px gap instead. */
const AJAR_WASH = wash(44, 70, DOOR.gy0, 22, "w", 0.9);
/** The bedroom, which is a smaller, later, quieter version of the same thing. */
const BED_WASH = wash(WIN.gx0, WIN.gx1, WIN.gy0, 22, "w", 0.45);
/** The television, which is the only cold light out here. */
const TV_WASH = wash(24, 64, 96, 24, "c", 0.4);
/** The neighbour, through the plank that went missing. */
const NB_WASH = tiers(
  (k) => steppedQuad(DIV.gapY0, DIV.x0, DIV.x1, FLOOR, DIV.x0 - 26 * k, DIV.x1, 6),
  "w",
  0.35,
);

/**
 * The sun. A balcony has an overhang, so the only question the lighting model
 * ever asks is how low the sun is.
 */
const SUN_DAWN = sunBand(76, 22, "c", 0.6); // high on the render, and cold
const SUN_DUSK = sunBand(118, 26, "e", 0.85); // low, deep, and all the way back
const SUN_DAY = sunBand(FLOOR + 14, 12, "w", 0.5); // only the outer slab burns
/** What the overhang does about it: a dithered band down the top of the wall. */
const OVERHANG = pxPath([
  [0, CEIL, W, 3],
  [0, CEIL + 3, W, 3],
  [0, CEIL + 6, W, 4],
]);
/** And the shadows the rail posts throw back up the wall when the sun is low. */
const POST_X = [20, 90, 160, 230, 296] as const;
const POST_SHADOWS = pxPath(POST_X.map((x) => [x + 2, 96, 6, FLOOR - 96] as Rect));

const VIG = vignettePaths(W, H);

/* ================================================================== *
 * PLANE 1 — the deep interior (parallax 0.64)
 * drawn wider than both apertures so it never runs dry when it slides
 * ================================================================== */

/** Two rooms and a hallway, at two removes. Lit or not, that is the only state. */
function DeepInterior({ i, s, ph }: { i: Interior; s: BalconyState; ph: Ph }) {
  const dark = (ph === "night" || ph === "dusk") && !i.studio;
  const wall = dark ? "#2b2620" : i.studio ? "#c9a878" : ph === "dusk" ? "#b08a62" : "#8a7a62";
  const wallLo = dark ? "#221e19" : i.studio ? "#b08c5e" : "#75664f";
  const floor = dark ? "#241f19" : "#8a5a3a";
  const bedLit = i.study;
  const nb = s.neighbour !== "away";
  return (
    <g>
      {/* ---- the living room, behind the terrace door ---- */}
      {px(4, 60, 78, 100, dark ? "#1d1a16" : wall)}
      {px(4, 60, 78, 22, wallLo)}
      <rect x={4} y={60} width={78} height={100} fill="url(#px-grain)" />
      {px(4, 130, 78, 30, floor)}
      {px(4, 130, 78, 2, dark ? "#2f2921" : "#9a6a46")}
      {/* the pool the ceiling light lays on the far wall, stepped, not radial */}
      {i.studio ? (
        <g>
          <path
            d={pxPath(steppedEllipse(44, 96, 34, 26, 3))}
            fill={dth("w", "25")}
            opacity={0.35}
          />
          {px(44, 60, 1, 14, "#4a4438")}
          {px(38, 74, 13, 7, K.warm)}
          {px(38, 74, 13, 1, K.warmHi)}
          {px(40, 81, 9, 2, "#ffe6b0")}
        </g>
      ) : null}
      {/* the bookshelf, and the spines you can just make out */}
      {px(8, 96, 20, 34, dark ? "#241f19" : "#6b4a2f")}
      {px(8, 96, 20, 1, dark ? "#2f2921" : "#8a623f")}
      <path d={pxPath(bank([[10, 100, 16, 2]], 3, 11))} fill={dark ? "#2f2921" : "#8a623f"} />
      {!dark ? (
        <g>
          <path
            d={pxPath([
              [10, 102, 3, 9],
              [14, 101, 3, 10],
              [18, 102, 3, 9],
              [22, 103, 3, 8],
            ])}
            fill="#7a3a3a"
          />
          <path
            d={pxPath([
              [14, 101, 3, 1],
              [22, 103, 3, 1],
            ])}
            fill="#3f5b7a"
          />
        </g>
      ) : null}
      {/* the hallway beyond, which is depth inside depth */}
      {px(68, 76, 14, 54, dark ? "#141210" : "#3a3128")}
      {px(68, 76, 2, 54, dark ? "#1c1917" : "#4a4034")}
      {/* ---- the bedroom, behind the smaller window ---- */}
      {px(140, 58, 70, 56, bedLit ? "#8a7250" : "#2b2620")}
      {px(140, 58, 70, 14, bedLit ? "#75603f" : "#221e19")}
      <rect x={140} y={58} width={70} height={56} fill="url(#px-grain)" />
      {bedLit ? (
        <g>
          <path
            d={pxPath(steppedEllipse(170, 88, 26, 20, 3))}
            fill={dth("w", "25")}
            opacity={0.3}
          />
          {px(163, 80, 12, 7, K.warm)}
          {px(163, 80, 12, 1, K.warmHi)}
        </g>
      ) : null}
      {/* the wardrobe, and the chair with yesterday's clothes on it */}
      {px(186, 84, 24, 30, bedLit ? "#6b4a2f" : "#241f19")}
      {px(186, 84, 24, 2, bedLit ? "#8a623f" : "#2f2921")}
      {px(146, 94, 20, 20, bedLit ? "#7a8f9f" : "#26221d")}
      {px(146, 94, 20, 3, bedLit ? "#8ba2b3" : "#2d2823")}
      {/* ---- the neighbour's balcony, through the missing plank ---- */}
      {px(284, 56, 34, 48, nb || ph !== "night" ? "#8f8a80" : "#2a2a30")}
      {px(284, 56, 34, 1, "#a09a90")}
      {px(284, 88, 34, 16, ph === "night" ? "#22222a" : "#7a766d")}
      {/* their chair, their laundry, and their light when they are in */}
      <Bevel
        boxes={[[290, 66, 9, 18]]}
        mat={{ hi: "#c25a48", base: "#b04a3a", mid: "#a04434", lo: "#8f3c2e", deep: "#743024" }}
      />
      {px(286, 58, 20, 2, "#a8a49a")}
      {px(292, 60, 5, 9, LINEN.day.base)}
      {px(292, 60, 5, 1, LINEN.day.hi)}
      <g style={{ transition: STEP_FADE, opacity: nb ? 1 : 0 }}>
        {px(300, 58, 8, 10, K.glassLit)}
        {px(300, 58, 8, 1, "#fff0c4")}
      </g>
      {/* and the ember, when they are out there smoking at dusk */}
      {s.neighbour === "smoking" ? (
        <path d={pxPath([[297, 74, 2, 2]])} fill="#e86a3a">
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.35;1;0.5;0.35"
            dur="3.4s"
            begin="-1.2s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the near interior (parallax 0.84)
 * ================================================================== */

function NearInterior({ i, ph }: { i: Interior; ph: Ph }) {
  const dark = (ph === "night" || ph === "dusk") && !i.studio;
  return (
    <g>
      {/* the sofa, back to the glass, and the cat that owns it */}
      {px(14, 112, 40, 26, dark ? "#3a3630" : "#6d7278")}
      {px(14, 108, 40, 6, dark ? "#464038" : "#7d828a")}
      {px(14, 108, 40, 1, dark ? "#514a41" : "#8d939b")}
      {px(18, 104, 12, 6, dark ? "#464038" : "#7d828a")}
      {px(38, 102, 10, 8, dark ? "#3f3a34" : "#5f646a")}
      <g>
        {px(40, 98, 9, 6, dark ? "#2f3238" : "#3a3f47")}
        {px(40, 95, 2, 3, dark ? "#2f3238" : "#3a3f47")}
        {px(45, 95, 2, 3, dark ? "#2f3238" : "#3a3f47")}
        {px(41, 99, 1, 1, "#c9cdd4")}
        {px(46, 99, 1, 1, "#c9cdd4")}
        <rect x={49} y={100} width={5} height={2} fill={dark ? "#2f3238" : "#3a3f47"}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 49 101;-14 49 101;6 49 101;0 49 101"
            dur="5.6s"
            begin="-1.9s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
      {/* the television, and the flicker it puts on their floor */}
      {px(56, 100, 20, 14, "#22201e")}
      {px(56, 100, 20, 1, "#3a3630")}
      {i.tv ? (
        <g>
          <rect x={58} y={102} width={16} height={10} fill={K.tv} opacity={0.75}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.75;0.4;0.7;0.45;0.75"
              dur="1.8s"
              begin="-0.6s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x={50} y={128} width={32} height={8} fill={K.tv} opacity={0.18}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.18;0.08;0.16;0.1;0.18"
              dur="1.8s"
              begin="-0.6s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        px(58, 102, 16, 10, "#31343a")
      )}
      {px(54, 114, 24, 4, dark ? "#2f2921" : "#5d4a37")}
      {/* the rug, and the low table with a mug on it */}
      {px(10, 140, 46, 10, dark ? "#2b2620" : "#7e6f74")}
      {px(10, 140, 46, 1, dark ? "#332d26" : "#8f7f84")}
      {px(14, 142, 38, 2, dark ? "#332d26" : "#a8968c")}
      {/* the bedside lamp in the other room, nearer than the wardrobe */}
      {i.study ? (
        <g>
          {px(196, 96, 8, 12, "#c9a878")}
          {px(196, 96, 8, 1, K.warmHi)}
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the facade. Hitboxes resolve here.
 * ================================================================== */

function Soffit({ ph, o, s }: { ph: Ph; o: Outside; s: BalconyState }) {
  const c = SOFF[ph];
  return (
    <g>
      {px(0, 0, W, CEIL, c.base)}
      <rect x={0} y={0} width={W} height={CEIL} fill="url(#px-agg)" />
      {/* the board marks the shuttering left in 1974, and the drip groove */}
      <path d={SOFFIT_MARKS} fill={c.mid} opacity={0.6} />
      <path d={SOFFIT_GROOVE} fill={c.lo} />
      {px(0, CEIL - 1, W, 1, c.deep)}
      <AOSet set={SOFFIT_AO} op={0.85} />
      {/* the line, its hooks, and the pegs that live on it whatever the weather */}
      <path d={LINE_HOOKS} fill={STEEL[ph].lo} />
      <path d={LINE_CORD} fill="#3a3b3a" />
      <path d={PEGS_D} fill="#c94040" />
      <path d={PEGS_HI} fill="#e05a50" />
      {/* the nest above the AC unit, which is why they chose it */}
      <g style={{ transition: STEP_FADE, opacity: s.swallows === "gone" ? 0.55 : 1 }}>
        <path d={NEST} fill="#8a7a62" />
        {px(232, 34, 18, 1, "#a3927a")}
        {px(236, 36, 10, 3, "#6b5f4c")}
        <AOSet set={NEST_AO} op={0.5} />
      </g>
      {/* two of them looking out of it, when they are home */}
      {s.swallows === "nest" ? (
        <g>
          <path
            d={pxPath([
              [236, 32, 3, 3],
              [241, 32, 3, 3],
            ])}
            fill={K.bird}
          />
          {px(236, 32, 3, 1, "#464a52")}
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;0 0;1 0;0 0;0 -1;0 0"
            dur="11s"
            begin="-3.5s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* the hook the pot above hangs from, and the drip line when it rains */}
      {isWet(o) ? (
        <path d={pxPath(bank([[12, CEIL - 2, 1, 4]], 11, 28))} fill={K.waterHi} opacity={0.45}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 12"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {isSnow(o) ? px(0, CEIL - 2, W, 1, K.snowLo, "sfr") : null}
    </g>
  );
}

function Facade({ ph, o }: { ph: Ph; o: Outside }) {
  const r = RENDER[ph];
  return (
    <g>
      {/* the render, drawn around both openings */}
      <path d={WALL_D} fill={r.base} />
      {WALL.map((b) => (
        <rect
          key={`${b[0]}-${b[1]}`}
          x={b[0]}
          y={b[1]}
          width={b[2]}
          height={b[3]}
          fill="url(#px-roller)"
        />
      ))}
      <path d={WALL_LIFTS} fill={r.mid} />
      <path d={WALL_COURSES} fill={r.lo} />
      {px(0, CEIL, W, 1, r.hi)}
      {/* the newer patch, the damp at both ends, the crack, the rust run */}
      <path d={WALL_PATCH} fill={K.renderPatch} />
      {px(236, 96, 22, 1, "#d2c7b1")}
      <path d={WALL_DAMP} fill={K.renderDamp} />
      {px(0, 130, 14, 8, "#9c9280")}
      <path d={WALL_CRACK} fill={r.lo} />
      <path d={WALL_RUSTRUN} fill={K.rust} />
      {px(214, 68, 1, 22, K.rustHi)}
      <rect x={0} y={CEIL} width={W} height={FLOOR - CEIL} fill="url(#px-grain)" />
      {/* the awning, rolled, and the brackets it hangs on */}
      <Bev
        set={AWNING}
        mat={{ hi: "#8f6b57", base: "#7a5a48", mid: "#6d5040", lo: "#5f4638", deep: "#472f22" }}
      />
      <path d={AWNING_BRACKETS} fill={STEEL[ph].lo} />
      {isSnow(o) ? px(20, 45, 100, 2, K.snow, "awsn") : null}
    </g>
  );
}

/** The terrace door: a hole, four rails, two panes, and a leaf that opens. */
function TerraceDoor({ ph, i, s }: { ph: Ph; i: Interior; s: BalconyState }) {
  const dark = ph === "night" || ph === "dusk";
  const lit = dark && i.studio;
  const ajar = s.door === "ajar";
  return (
    <g>
      {/* the glass: a tint over the interior planes, and three reflections */}
      <rect
        x={DOOR.gx0}
        y={DOOR.gy0}
        width={DOOR.gx1 - DOOR.gx0}
        height={DOOR.gy1 - DOOR.gy0}
        fill={K.glass[ph]}
        opacity={dark ? 0.5 : 0.3}
      />
      {lit ? (
        <rect
          x={DOOR.gx0}
          y={DOOR.gy0}
          width={DOOR.gx1 - DOOR.gx0}
          height={DOOR.gy1 - DOOR.gy0}
          fill={K.glassLit}
          opacity={0.14}
        />
      ) : null}
      {/* тюль on the inside — the middle panel moves when the door is open */}
      <g opacity={0.44}>
        <path d={TULLE_SIDES} fill={K.tulle} />
        <g>
          <path d={TULLE_MID} fill={K.tulle} />
          {ajar ? (
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;3 1;-2 0;1 1;0 0"
              dur="7.4s"
              begin="-2.2s"
              repeatCount="indefinite"
            />
          ) : null}
        </g>
      </g>
      <path d={DOOR_REFLECT} fill="#ffffff" opacity={dark ? 0.08 : 0.17} />
      {/* condensation at night, low in the panes */}
      {ph === "night" ? (
        <g opacity={0.28}>
          {px(DOOR.gx0, 128, 22, 16, K.ice)}
          {px(46, 132, 22, 12, K.ice)}
        </g>
      ) : null}
      {/* the leaf that opens. Four-pixel steps, about the hinge at x68. */}
      <g style={{ transition: STEP_SLIDE, transform: ajar ? "translateX(-21px)" : "none" }}>
        <path d={DOOR_STILE} fill={FRAME[ph].base} />
        {px(42, DOOR.gy0, 1, DOOR.gy1 - DOOR.gy0, FRAME[ph].hi)}
        {px(45, DOOR.gy0, 1, DOOR.gy1 - DOOR.gy0, FRAME[ph].deep)}
        {/* the handle, at 1.05 m, where a handle is */}
        {px(38, HANDLE, 3, 12, STEEL[ph].hi)}
        {px(38, HANDLE, 3, 2, "#e2e6ea")}
      </g>
      {/* the gap itself, when it is open: the room, edge-on */}
      {ajar ? px(46, DOOR.gy0, 22, DOOR.gy1 - DOOR.gy0, lit ? "#6b4a30" : "#1a1815", "gap") : null}
      {/* the rails, last, so nothing is drawn over the frame */}
      <path d={DOOR_RAILS} fill={FRAME[ph].base} />
      <path d={DOOR_RAILS_HI} fill={FRAME[ph].hi} />
      <AOSet set={DOOR_AO} op={0.8} />
      {/* tape over a crack, and a sticker somebody's kid put there */}
      <path d={DOOR_TAPE} fill="#d8d3b8" opacity={0.85} />
      {px(58, DOOR.gy1 - 18, 7, 7, "#d9832f")}
      {px(58, DOOR.gy1 - 18, 7, 1, "#eda152")}
      {px(60, DOOR.gy1 - 16, 3, 3, K.cream)}
      {/* the threshold, and the mat outside it */}
      {px(DOOR.x0, FLOOR - 2, DOOR.x1 - DOOR.x0, 2, TIN[ph].lo)}
      <Bev
        set={MAT}
        mat={{ hi: "#87786a", base: "#6b5f4c", mid: "#615644", lo: "#544a3b", deep: "#3f382d" }}
      />
      <rect x={18} y={FLOOR} width={36} height={9} fill="url(#px-weave)" opacity={0.6} />
      <path d={MAT_RIBS} fill="#5a5040" />
    </g>
  );
}

/** The bedroom window, its cill, and the pot of something on it. */
function BedroomWindow({ ph, i, o }: { ph: Ph; i: Interior; o: Outside }) {
  const dark = ph === "night" || ph === "dusk";
  return (
    <g>
      <rect
        x={WIN.gx0}
        y={WIN.gy0}
        width={WIN.gx1 - WIN.gx0}
        height={WIN.gy1 - WIN.gy0}
        fill={K.glass[ph]}
        opacity={dark ? 0.5 : 0.32}
      />
      {dark && i.study ? (
        <rect
          x={WIN.gx0}
          y={WIN.gy0}
          width={WIN.gx1 - WIN.gx0}
          height={WIN.gy1 - WIN.gy0}
          fill={K.glassLit}
          opacity={0.12}
        />
      ) : null}
      <path d={WIN_REFLECT} fill="#ffffff" opacity={dark ? 0.07 : 0.16} />
      <path d={WIN_RAILS} fill={FRAME[ph].base} />
      <path d={WIN_RAILS_HI} fill={FRAME[ph].hi} />
      {px(194, HANDLE - 22, 3, 8, STEEL[ph].hi)}
      <Bev set={WIN_CILL} mat={dim(M.tin, RENDER[ph].base, 0.3)} />
      <AOSet set={WIN_AO} op={0.8} />
      {/* the pot of something on the cill, and the ring it has left */}
      {px(180, SILL - 6, 12, 6, WOOD[ph].base)}
      {px(180, SILL - 6, 12, 1, WOOD[ph].hi)}
      {o.season === "bare" ? (
        <g>
          {px(183, SILL - 10, 3, 5, "#5d5442")}
          {px(187, SILL - 9, 2, 4, "#5d5442")}
        </g>
      ) : (
        <g>
          {px(182, SILL - 11, 4, 6, LEAFM[ph].hi)}
          {px(186, SILL - 12, 4, 7, LEAFM[ph].base)}
          {px(186, SILL - 12, 2, 7, LEAFM[ph].hi)}
        </g>
      )}
      {px(178, SILL, 16, 1, RENDER[ph].lo)}
      {isSnow(o) ? px(145, SILL - 1, 60, 2, K.snow, "cisn") : null}
    </g>
  );
}

/** Everything bolted to this wall: the lamp, the switch, the AC, the meters. */
function Fixtures({ ph, on, o }: { ph: Ph; on: boolean; o: Outside }) {
  return (
    <g>
      {/* ---- the bulkhead lamp, caged, and its bracket ---- */}
      <path d={LAMP_BRACKET} fill={STEEL[ph].lo} />
      <Bev
        set={LAMP_BOX}
        mat={{ ...TIN[ph], base: on ? K.warm : "#c9c4b6", hi: on ? K.warmHi : "#d8d3c5" }}
      />
      <path d={LAMP_CAGE} fill={STEEL[ph].deep} opacity={0.5} />
      <AOSet set={LAMP_AO} op={0.6} />
      {/* ---- the switch, at 1.05 m, finally under its own hitbox ---- */}
      <Bev
        set={SWITCH_BOX}
        mat={{ hi: "#f2efe4", base: "#e2ded2", mid: "#d4d0c4", lo: "#c2beb2", deep: "#a09c92" }}
      />
      {px(114, HANDLE + 1, 4, 5, on ? "#c9a24b" : "#8f8a7c")}
      {px(114, HANDLE + 1, 4, 1, on ? "#e6c479" : "#9c978a")}
      {/* ---- the AC unit: 0.79 × 0.55 m, its fins, its conduit, its drip ---- */}
      <Bev
        set={AC_BOX}
        mat={{ hi: "#d8d3c6", base: "#c9c4b6", mid: "#bcb7a9", lo: "#aca79a", deep: "#8d887c" }}
      />
      {px(222, 48, 26, 17, "#b0aba0")}
      <path d={AC_FINS} fill="#a09b90" />
      <path d={AC_FINS_HI} fill="#bab5aa" />
      <AOSet set={AC_AO} op={0.7} />
      <path d={AC_CONDUIT} fill="#6b6558" />
      <path d={AC_DRIPLINE} fill={STEEL[ph].base} />
      {/* the drip it has never fixed, which is why there is a stain below it */}
      <rect x={232} y={73} width={2} height={3} fill="#a8c2d4" opacity={0.8}>
        <animate
          attributeName="y"
          calcMode="discrete"
          values="73;92;111;130;146"
          dur="3.2s"
          begin="-1.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.9;0.9;0.9;0.5;0"
          dur="3.2s"
          begin="-1.4s"
          repeatCount="indefinite"
        />
      </rect>
      {px(230, 146, 6, 2, dim(M.concrete, K.water, 0.3).lo)}
      {/* ---- the dish nobody has watched since the fibre came ---- */}
      <path d={DISH} fill="#d8d5cc" />
      {px(252, 84, 14, 1, "#eceae2")}
      {px(254, 86, 10, 9, "#bcb9b0")}
      {/* ---- meters, the run down from them, and the drainpipe ---- */}
      <Bev
        set={METER}
        mat={{ hi: "#d8d3c6", base: "#c9c4b6", mid: "#bcb7a9", lo: "#aca79a", deep: "#8d887c" }}
      />
      {px(273, 89, 10, 12, "#b0aba0")}
      <PixelText x={274} y={91} text="14" fill="#5d5a52" gap={0} op={0.8} />
      <path d={METER_RUN} fill="#6b6558" />
      <path d={PIPE} fill={RENDER[ph].lo} />
      <path d={PIPE_HI} fill={RENDER[ph].mid} />
      <path d={PIPE_LO} fill={RENDER[ph].deep} />
      <Bev set={PIPE_BRACKETS} mat={WOOD[ph]} />
      <path d={PIPE_RUST} fill={K.rust} />
      {isWet(o) ? <path d={pxPath([[263, 0, 5, FLOOR]])} fill={K.waterHi} opacity={0.14} /> : null}
    </g>
  );
}

/** The divider, and the plank that went in the storm. */
function Divider({ ph, o }: { ph: Ph; o: Outside }) {
  const d = DIVIDER[ph];
  return (
    <g>
      <path d={DIV_BODY_D} fill={d.base} />
      {DIV_BODY.map((b) => (
        <rect key={b[1]} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="url(#px-wood)" />
      ))}
      <path d={DIV_PLANKS} fill={d.lo} />
      <path d={DIV_POSTS} fill={d.hi} />
      {px(DIV.x1 - 2, 30, 2, FLOOR - 30, d.deep)}
      {/* the two ragged ends where it tore out */}
      <path d={DIV_TEAR} fill={d.deep} />
      {px(DIV.x0, DIV.gapY0 - 1, DIV.x1 - DIV.x0, 1, d.mid)}
      {px(DIV.x0, DIV.gapY1, DIV.x1 - DIV.x0, 1, d.mid)}
      {isSnow(o) ? px(DIV.x0, 29, DIV.x1 - DIV.x0, 2, K.snow, "dvsn") : null}
    </g>
  );
}

function Slab({ ph, o, s }: { ph: Ph; o: Outside; s: BalconyState }) {
  const c = CONC[ph];
  const wet = isWet(o);
  const dark = ph === "night" || ph === "dusk";
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, c.base)}
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-agg)" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-satin)" opacity={0.5} />
      <path d={SLAB_JOINTS} fill={c.lo} />
      {px(0, FLOOR, W, 2, c.deep)}
      {px(0, FLOOR + 2, W, 1, c.mid)}
      <AOSet set={SLAB_AO} op={0.8} />
      {/* the drain, which is the reason the slab has a fall at all */}
      <path d={DRAIN} fill="#7f7d76" />
      {px(148, 168, 12, 1, "#93918a")}
      <path d={DRAIN_SLOTS} fill="#5f5d57" />
      {/* the puddle that never quite goes, bigger when it has been raining */}
      <path d={wet ? PUDDLE_WET : PUDDLE} fill={dark ? K.puddleNight : K.waterHi} opacity={0.5} />
      <path d={PUDDLE_HI} fill={dark ? "#5d7a8a" : "#bcd2e0"} opacity={0.4} />
      <path d={SLAB_GRIT} fill="#4a4438" opacity={0.7} />
      <path d={SLAB_PAINT} fill="#6b5540" opacity={0.8} />
      {/* what the season leaves on the concrete */}
      {o.season === "autumn" ? (
        <path
          d={pxPath([
            [42, 162, 3, 2],
            [136, 170, 2, 2],
            [214, 158, 3, 2],
            [286, 166, 2, 2],
          ])}
          fill={K.leafDry}
        />
      ) : null}
      {wet ? (
        <g>
          <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="#1a2430" opacity={0.24} />
          {/* the wall coming back up out of the wet concrete */}
          <path
            d={pxPath([[DOOR.gx0, FLOOR + 2, DOOR.gx1 - DOOR.gx0, 8]])}
            fill={K.glassLit}
            opacity={0.12}
          />
        </g>
      ) : null}
      {isSnow(o) ? (
        <g>
          <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill={K.snow} opacity={0.5} />
          {px(0, FLOOR, W, 2, K.snow)}
          {/* swept, because you have to get to the door and to the line */}
          <path
            d={pxPath([
              [16, FLOOR + 2, 44, 14],
              [120, FLOOR + 3, 60, 12],
            ])}
            fill={c.base}
            opacity={0.75}
          />
          <path
            d={pxPath([
              [66, FLOOR + 6, 5, 3],
              [82, FLOOR + 11, 5, 3],
              [100, FLOOR + 5, 5, 3],
            ])}
            fill={K.snowLo}
          />
        </g>
      ) : null}
      <Contact set={CONTACTS} op={dark ? 0.5 : 0.9} />
      {/* the television, on the concrete, when the door is open and it is dark */}
      {s.door === "ajar" && dark ? (
        <rect x={46} y={FLOOR} width={26} height={12} fill={K.tv} opacity={0.1}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.1;0.04;0.09;0.05;0.1"
            dur="1.8s"
            begin="-0.6s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — the eleven things standing on the slab
 * ================================================================== */

/** Stool, tin-can ashtray, lighter. The ashtray fills as the day goes on. */
function Stool({ ph, stage }: { ph: Ph; stage: AshStage }) {
  return (
    <g>
      {px(58, 126, 24, 4, WOOD[ph].base)}
      {px(58, 126, 24, 1, WOOD[ph].hi)}
      {px(58, 129, 24, 1, WOOD[ph].deep)}
      <rect x={58} y={126} width={24} height={4} fill="url(#px-wood)" />
      {px(60, 130, 3, 19, WOOD[ph].lo)}
      {px(60, 130, 1, 19, WOOD[ph].base)}
      {px(77, 130, 3, 19, WOOD[ph].lo)}
      {px(61, 140, 18, 2, WOOD[ph].lo)}
      {/* the tin, and what is in it */}
      <Bevel boxes={[[64, 118, 9, 8]]} mat={M.tin} />
      {px(65, 120, 7, 2, "#9aa0a8")}
      <g style={{ transition: STEP_FADE, opacity: stage === "clean" ? 0 : 1 }}>
        {px(66, 116, 2, 3, K.cream)}
        {px(69, 117, 2, 2, K.ash)}
      </g>
      <g style={{ transition: STEP_FADE, opacity: stage === "full" ? 1 : 0 }}>
        {px(63, 115, 2, 3, K.cream)}
        {px(71, 116, 2, 2, K.ash)}
        {px(74, 148, 3, 1, K.cream)}
        {px(88, 147, 3, 1, K.cream)}
      </g>
      {/* the lighter, which moves depending on who used it last */}
      {px(stage === "clean" ? 74 : 78, 122, 4, 4, "#c94040")}
      {px(stage === "clean" ? 74 : 78, 122, 4, 1, "#e05a50")}
    </g>
  );
}

/** The watering can and the hose that has never coiled right. */
function WateringCan({ ph, used }: { ph: Ph; used: boolean }) {
  return (
    <g>
      <Bevel
        boxes={[[98, 130, 16, 18]]}
        mat={{ hi: "#7d9c88", base: "#5d7a6a", mid: "#526d5f", lo: "#465e52", deep: "#35473e" }}
      />
      {px(114, 132, 6, 3, "#5d7a6a")}
      {px(118, 128, 4, 5, "#5d7a6a")}
      {px(100, 124, 3, 7, "#4e6b5c")}
      {px(100, 124, 12, 2, "#4e6b5c")}
      {px(100, 124, 12, 1, "#658474")}
      <g style={{ transition: STEP_FADE, opacity: used ? 1 : 0 }}>
        {px(116, 135, 3, 2, "#a8c2d4")}
        <path d={pxPath(steppedEllipse(120, 152, 9, 2, 1))} fill={K.waterHi} opacity={0.4} />
      </g>
      {/* the hose, coiled the way hoses coil */}
      {px(122, 160, 16, 4, "#3f5b4a")}
      {px(122, 160, 16, 1, "#517059")}
      {px(126, 164, 12, 4, "#4a6b56")}
      {px(124, 158, 4, 3, "#3f5b4a")}
      {px(138, 161, 5, 2, TIN[ph].base)}
    </g>
  );
}

/** The folding rack. Up while the sun is, folded flat against the wall after. */
function DryingRack({ ph, s }: { ph: Ph; s: BalconyState }) {
  const up = s.rack === "up";
  return (
    <g>
      {/* up: two frames, four bars, and what is over them */}
      <g style={{ transition: STEP_FADE, opacity: up ? 1 : 0 }}>
        {px(124, 100, 2, 48, STEEL[ph].base)}
        {px(124, 100, 1, 48, STEEL[ph].hi)}
        {px(174, 100, 2, 48, STEEL[ph].base)}
        {px(174, 100, 1, 48, STEEL[ph].hi)}
        <path d={pxPath(bank([[126, 104, 48, 1]], 4, 8))} fill={STEEL[ph].base} />
        <path d={pxPath(bank([[126, 105, 48, 1]], 4, 8))} fill={STEEL[ph].deep} />
        {px(126, 146, 48, 2, STEEL[ph].lo)}
        {/* socks, and a tea towel over the middle bar */}
        {px(130, 102, 6, 9, LINEN[ph].base)}
        {px(130, 102, 6, 1, LINEN[ph].hi)}
        {px(138, 102, 6, 9, "#7c8ba3")}
        {px(138, 102, 6, 1, "#93a2ba")}
        {px(148, 110, 14, 12, "#c94040")}
        {px(148, 110, 14, 1, "#e05a50")}
        {px(161, 112, 1, 10, "#9a2f2a")}
        <rect x={148} y={110} width={14} height={12} fill="url(#px-weave)" />
        {px(128, 126, 10, 8, LINEN[ph].mid)}
        {px(128, 126, 10, 1, LINEN[ph].hi)}
      </g>
      {/* folded: leaning where the `laundry` hitbox actually points */}
      <g style={{ transition: STEP_FADE, opacity: up ? 0 : 1 }}>
        {px(160, 96, 12, 52, STEEL[ph].base)}
        {px(160, 96, 3, 52, STEEL[ph].hi)}
        {px(171, 96, 1, 52, STEEL[ph].deep)}
        <path d={pxPath(bank([[162, 108, 8, 1]], 3, 12))} fill={STEEL[ph].lo} />
        {px(161, 146, 10, 3, STEEL[ph].lo)}
      </g>
    </g>
  );
}

/** Seedling boxes, labelled on lolly sticks, and the bag of soil they came from. */
function Seedlings({ ph, s, o }: { ph: Ph; s: BalconyState; o: Outside }) {
  const wet = s.seedlings === "watered";
  const bare = o.season === "bare";
  const sprouts = [
    { x: 204, y: 124, h: 8 },
    { x: 212, y: 121, h: 11 },
    { x: 220, y: 125, h: 7 },
    { x: 228, y: 122, h: 10 },
  ] as const;
  return (
    <g>
      {/* the bag of soil, slumped, drawn first so the crate can overlap it */}
      <g>
        {px(226, 126, 22, 22, "#5d4a37")}
        {px(226, 126, 22, 1, "#75604a")}
        {px(247, 128, 1, 20, "#43362a")}
        <PixelText x={228} y={130} text="ZIEMIA" fill="#c9bda6" gap={0} op={0.7} />
        {px(228, 138, 14, 5, "#8a7a52")}
      </g>
      {/* the box, its soil, and whether the soil is wet */}
      {px(200, 132, 36, 16, WOOD[ph].base)}
      {px(200, 132, 36, 1, WOOD[ph].hi)}
      {px(235, 132, 1, 16, WOOD[ph].deep)}
      <rect x={200} y={132} width={36} height={16} fill="url(#px-wood)" />
      {px(200, 137, 36, 1, WOOD[ph].lo)}
      {px(202, 134, 32, 2, wet ? K.soilWet : K.soil)}
      {/* the sprouts, which stand up when they have been watered */}
      <g transform={wet ? undefined : "translate(0,2)"} style={{ transition: STEP_DROOP }}>
        {sprouts.map((sp) => (
          <g key={sp.x}>
            {px(sp.x, sp.y, 4, sp.h, bare ? "#6b6350" : wet ? LEAFM[ph].hi : LEAFM[ph].base)}
            {px(sp.x, sp.y, 2, sp.h, bare ? "#7a7060" : K.sprout)}
            {px(sp.x - 1, sp.y - 3, 6, 3, bare ? "#6b6350" : LEAFM[ph].base)}
            {px(sp.x - 1, sp.y - 3, 3, 1, bare ? "#7a7060" : LEAFM[ph].hi)}
          </g>
        ))}
      </g>
      {/* the one that did not make it, and the labels on lolly sticks */}
      <g style={{ transition: STEP_FADE, opacity: wet && !bare ? 0 : 1 }}>
        {px(232, 127, 3, 6, "#7a7a4a")}
      </g>
      {px(206, 126, 2, 8, K.cream)}
      {px(205, 124, 4, 3, K.cream)}
      {px(222, 128, 2, 6, K.cream)}
      <g style={{ transition: STEP_FADE, opacity: wet ? 1 : 0 }}>
        <path
          d={pxPath([
            [206, 131, 1, 1],
            [216, 131, 1, 1],
            [226, 131, 1, 1],
          ])}
          fill="#bfe0f5"
        />
      </g>
      {isSnow(o) ? px(200, 131, 36, 2, K.snow, "sdsn") : null}
    </g>
  );
}

/** Skis and poles, cobwebbed into the corner. 1.70 m, not 2.3. */
function Skis({ ph }: { ph: Ph }) {
  return (
    <g>
      {[178, 184].map((x, i) => (
        <g key={x}>
          {px(x, 84 - i * 2, 5, 65 + i * 2, "#c94040")}
          {px(x, 84 - i * 2, 2, 65 + i * 2, "#e05a50")}
          {px(x + 4, 84 - i * 2, 1, 65 + i * 2, "#9a2f2a")}
          {px(x, 84 - i * 2, 5, 2, K.cream)}
          {px(x, 112 + i * 2, 5, 6, "#2f3238")}
        </g>
      ))}
      {/* the poles, 1.30 m, and the baskets on the ends of them */}
      {px(190, 100, 2, 49, STEEL[ph].base)}
      {px(190, 100, 1, 49, STEEL[ph].hi)}
      {px(188, 102, 6, 2, STEEL[ph].lo)}
      {px(189, 143, 5, 4, STEEL[ph].lo)}
      {/* and the web that says how long they have been there */}
      <g opacity={0.4}>
        {px(174, 86, 6, 1, K.cream)}
        {px(174, 86, 1, 8, K.cream)}
        {px(175, 92, 5, 1, K.cream)}
      </g>
    </g>
  );
}

/** The crate of empty jars, newspaper packed between them. */
function Crate({ ph }: { ph: Ph }) {
  const jars: readonly Rect[] = [
    [242, 118, 8, 8],
    [252, 117, 8, 9],
    [261, 119, 6, 7],
  ];
  return (
    <g>
      {px(240, 124, 26, 24, WOOD[ph].base)}
      {px(240, 124, 26, 1, WOOD[ph].hi)}
      {px(265, 124, 1, 24, WOOD[ph].deep)}
      <rect x={240} y={124} width={26} height={24} fill="url(#px-wood)" />
      {px(240, 135, 26, 1, WOOD[ph].lo)}
      <path d={pxPath(bank([[244, 128, 2, 16]], 3, 8))} fill={WOOD[ph].lo} />
      {jars.map((j) => (
        <g key={j[0]}>
          {px(j[0], j[1], j[2], j[3], K.jar)}
          {px(j[0], j[1], j[2], 2, K.jarHi)}
          {px(j[0] + j[2] - 1, j[1], 1, j[3], "#8fa0ab")}
          {px(j[0] + 1, j[1] - 2, j[2] - 2, 2, "#b0a692")}
        </g>
      ))}
      {px(240, 144, 26, 3, "#d8d3c2")}
    </g>
  );
}

/** The bicycle, wintering with dignity. 0.68 m wheels this time. */
function Bicycle({ ph, s, o }: { ph: Ph; s: BalconyState; o: Outside }) {
  const sheeted = s.bike === "sheeted";
  return (
    <g>
      {[256, 278].map((wx) => (
        <g key={wx}>
          {px(wx, 122, 26, 26, "#22201e")}
          {px(wx, 122, 26, 1, "#3a3630")}
          {px(wx + 3, 125, 20, 20, "#3a3630")}
          {px(wx + 8, 130, 10, 10, "#5d6266")}
          {px(wx + 8, 130, 10, 1, "#767c82")}
          {px(wx + 11, 133, 4, 4, STEEL[ph].base)}
        </g>
      ))}
      {px(268, 112, 24, 8, "#7a3b35")}
      {px(268, 112, 24, 1, "#9c4f48")}
      {px(291, 113, 1, 7, "#5d2b26")}
      {px(270, 120, 2, 14, "#7a3b35")}
      {px(286, 118, 2, 12, "#7a3b35")}
      {px(264, 108, 10, 4, "#22201e")}
      {px(264, 108, 10, 1, "#3a3630")}
      {px(290, 104, 7, 4, "#22201e")}
      {px(292, 100, 3, 5, STEEL[ph].base)}
      {px(274, 134, 12, 2, "#4a4438")}
      {px(256, 132, 4, 10, STEEL[ph].base)}
      {/* the crate on the back, which is what it is actually for */}
      {px(294, 114, 8, 6, WOOD[ph].lo)}
      {px(294, 114, 8, 1, WOOD[ph].base)}
      {/* the sheet: right over, or half off and slipping */}
      <g style={{ transition: STEP_FADE, opacity: sheeted ? 1 : 0 }}>
        {px(254, 100, 52, 44, "#b8bcc2")}
        {px(254, 100, 52, 2, "#d2d6dc")}
        {px(305, 102, 1, 42, "#93979d")}
        <path d={pxPath(bank([[266, 102, 1, 40]], 3, 20))} fill="#a4a8ae" />
        <rect x={254} y={100} width={52} height={44} fill="url(#px-weave)" />
        {isSnow(o) ? px(254, 99, 52, 2, K.snow, "bksn") : null}
      </g>
      <g style={{ transition: STEP_FADE, opacity: sheeted ? 0 : 1 }}>
        {px(280, 114, 24, 14, "#b8bcc2")}
        {px(280, 114, 24, 2, "#d2d6dc")}
        {px(303, 116, 1, 12, "#93979d")}
        {px(298, 128, 8, 6, "#a8acb2")}
      </g>
    </g>
  );
}

/** The washing on the line, which comes in when the weather turns. */
function Washing({ ph, count }: { ph: Ph; count: LineStage }) {
  return (
    <g>
      {/* the jeans, heavy, and they swing slowest */}
      <g style={{ transition: STEP_FADE, opacity: count >= 3 ? 1 : 0 }}>
        <g>
          {px(78, 38, 22, 28, "#7c8ba3")}
          {px(78, 38, 22, 2, "#93a2ba")}
          {px(99, 40, 1, 26, "#65738a")}
          <rect x={78} y={38} width={22} height={28} fill="url(#px-weave)" />
          {px(80, 52, 18, 1, "#6d7c94")}
          {px(78, 64, 22, 3, "#6d7c94")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-2 89 38;2.4 89 38;-1 89 38;-2 89 38"
            dur="6.4s"
            begin="-2.1s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      {/* the shirt */}
      <g style={{ transition: STEP_FADE, opacity: count >= 2 ? 1 : 0 }}>
        <g>
          {px(166, 38, 18, 22, LINEN[ph].base)}
          {px(166, 38, 18, 2, LINEN[ph].hi)}
          {px(183, 40, 1, 20, LINEN[ph].lo)}
          <rect x={166} y={38} width={18} height={22} fill="url(#px-weave)" />
          {px(162, 40, 5, 12, LINEN[ph].base)}
          {px(183, 40, 5, 12, LINEN[ph].base)}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="2 174 38;-2.6 174 38;1 174 38;2 174 38"
            dur="5.4s"
            begin="-0.9s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      {/* and the two towels that are always the last thing left out */}
      <g style={{ transition: STEP_FADE, opacity: count >= 1 ? 1 : 0 }}>
        <g>
          {px(126, 38, 8, 14, "#c94040")}
          {px(134, 38, 8, 14, "#c94040")}
          {px(126, 38, 16, 2, "#e05a50")}
          {px(141, 40, 1, 12, "#9a2f2a")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-1.5 130 38;2 130 38;-1.5 130 38"
            dur="4.6s"
            begin="-1.6s"
            repeatCount="indefinite"
          />
        </g>
      </g>
    </g>
  );
}

function Props({ ph, s, o }: { ph: Ph; s: BalconyState; o: Outside }) {
  return (
    <g>
      {/* boots by the door, one fallen over */}
      {px(2, 138, 13, 11, "#4a3a2b")}
      {px(2, 138, 13, 1, "#63503d")}
      {px(2, 148, 13, 1, "#2f2921")}
      {px(4, 132, 9, 7, "#3f3226")}
      {px(14, 142, 12, 7, "#4a3a2b")}
      {px(14, 142, 12, 1, "#63503d")}
      <Stool ph={ph} stage={s.ashtray} />
      {/* the folded chair, leaning where you stand to smoke */}
      {px(88, 96, 10, 53, STEEL[ph].lo)}
      {px(88, 96, 3, 53, STEEL[ph].hi)}
      {px(97, 96, 1, 53, STEEL[ph].deep)}
      {px(90, 108, 6, 34, STEEL[ph].mid)}
      {px(89, 142, 8, 3, "#4a4e52")}
      <WateringCan ph={ph} used={s.seedlings === "watered"} />
      <Skis ph={ph} />
      {/* the broom, leaning where it always leans */}
      {px(194, 96, 3, 53, WOOD[ph].base)}
      {px(194, 96, 1, 53, WOOD[ph].hi)}
      {px(192, 141, 8, 8, "#c9a24b")}
      {px(192, 141, 8, 1, "#dfb865")}
      <path d={pxPath(bank([[193, 147, 1, 3]], 4, 2))} fill="#a3803a" />
      <Seedlings ph={ph} s={s} o={o} />
      <Crate ph={ph} />
      <Bicycle ph={ph} s={s} o={o} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 5 — the two things with moving parts
 * ================================================================== */

/* TerraceDoor and DryingRack are both mounted in gameplayObjects: the leaf slides
 * and the rack folds, so they need to sit in front of the static props and to
 * repaint on their own stage rather than with the wall. */

/* ================================================================== *
 * PLANE 6 — Foreground: the parapet and everything on it
 * ================================================================== */

const RAIL = 136;
const CAP = 146;

/** The rail, its posts, and the rust weeping out of every fixing. */
const RAIL_BAR = pxPath([[0, RAIL, W, 4]]);
const RAIL_HI = pxPath([[0, RAIL, W, 1]]);
const RAIL_POSTS = pxPath(POST_X.map((x) => [x, RAIL + 4, 3, 8] as Rect));
const RAIL_POSTS_HI = pxPath(POST_X.map((x) => [x, RAIL + 4, 1, 8] as Rect));
const RAIL_RUST = pxPath(POST_X.map((x) => [x - 1, RAIL + 10, 5, 2] as Rect));
/** The festoon cord: four spans, one path, and it sags like a cord does. */
const FESTOON = pxPath([
  ...steppedCable(4, RAIL + 2, 78, RAIL + 2, 11, 6),
  ...steppedCable(78, RAIL + 2, 152, RAIL + 2, 11, 6),
  ...steppedCable(152, RAIL + 2, 226, RAIL + 2, 11, 6),
  ...steppedCable(226, RAIL + 2, 300, RAIL + 2, 11, 6),
]);
/** The parapet: cap, body, weep holes, and the flakes coming off it. */
const PARAPET = pxPath([[0, CAP, W, H - CAP]]);
const PARAPET_CAP = pxPath([
  [0, CAP, W, 2],
  [0, CAP + 2, W, 1],
]);
const PARAPET_JOINTS = pxPath(bank([[38, CAP, 1, 12]], 5, 62));
const PARAPET_WEEPS = pxPath(bank([[52, CAP + 22, 4, 3]], 4, 70));
const PARAPET_FLAKES = pxPath([
  [36, CAP + 6, 18, 6],
  [212, CAP + 10, 22, 5],
  [140, CAP + 14, 30, 1],
]);
const PARAPET_RUST = pxPath([
  [88, CAP + 4, 6, 10],
  [228, CAP + 4, 5, 8],
]);
/** The flower box on the rail, and the marigolds in it. */
const BOX = bevelPaths([[102, 128, 56, 16]]);
const BOX_SOIL = pxPath([[106, 130, 48, 3]]);
const FLOWER_X = [106, 118, 130, 142, 148] as const;
const FLOWER_TONES = ["#e8a445", "#f2bd63", "#d9832f", "#e8a445", "#d9832f"] as const;
/** The ivy that got up here on its own. */
const IVY = pxPath([
  [268, CAP - 2, 2, 32],
  [266, CAP + 2, 5, 4],
  [270, CAP + 8, 5, 4],
  [264, CAP + 14, 5, 4],
  [270, CAP + 20, 5, 4],
  [272, 128, 4, 8],
]);
/** The pot hanging off the balcony above, nearly out of frame. */
const POT = bevelPaths([[8, 12, 20, 12]]);

function BalconyFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const o = world ? outside(world) : { weather: "clear" as Weather, season: "autumn" as Season };
  const s = world
    ? state(world, ph, o)
    : state({} as WorldState, ph, { weather: "clear", season: "autumn" });
  const night = ph === "night";
  const lit = railOn(s, ph);
  const bare = o.season === "bare";
  const watered = s.flowers === "watered";
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* the underside of the balcony above, framing the top of the shot */}
        {px(0, 0, W, 4, dth("n", "50"))}
        {px(0, 4, W, 3, dth("n", "25"))}
        {/* and the pot that hangs off it, close enough to be nearly out of frame */}
        <path d={POT_STRAPS} fill="#4a4438" />
        <Bev set={POT} mat={WOOD[ph]} />
        {px(10, 24, 16, 3, WOOD[ph].lo)}
        {bare ? (
          <g>
            {px(14, 24, 2, 9, "#5d5442")}
            {px(20, 24, 2, 12, "#5d5442")}
          </g>
        ) : (
          <g>
            {px(12, 6, 4, 7, "#3f5b4a")}
            {px(18, 4, 4, 9, "#4e6b5c")}
            {px(18, 4, 2, 9, "#658474")}
            {px(22, 8, 5, 5, "#3f5b4a")}
            {px(14, 24, 2, 10, "#4e6b5c")}
            {px(20, 24, 2, 14, "#3f5b4a")}
            {px(19, 38, 4, 3, "#4e6b5c")}
          </g>
        )}

        {/* ---- the rail ---- */}
        <path d={RAIL_BAR} fill={STEEL[ph].lo} />
        <path d={RAIL_HI} fill={STEEL[ph].hi} />
        {px(0, RAIL + 3, W, 1, "#43474b")}
        <path d={RAIL_POSTS} fill={STEEL[ph].lo} />
        <path d={RAIL_POSTS_HI} fill={STEEL[ph].base} />
        <path d={RAIL_RUST} fill={K.rust} />
        {isSnow(o) ? px(0, RAIL - 1, W, 1, K.snow, "rlsn") : null}
        {isWet(o) ? px(0, RAIL, W, 1, K.ice, "rlwt") : null}

        {/* ---- the string lights, one cord and two flicker groups ---- */}
        <path d={FESTOON} fill="#3a3b3a" />
        <g style={{ transition: STEP_FADE, opacity: lit ? 1 : 0 }}>
          <path d={BULB_HALOS.halo} fill={dth("w", "12")} opacity={0.4} />
          <path d={BULBS_A} fill={K.bulbOn}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.82;1;0.9;1"
              dur="4.3s"
              begin="-1.3s"
              repeatCount="indefinite"
            />
          </path>
          <path d={BULBS_B} fill={K.bulbOn}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.9;1;0.78;1;0.9"
              dur="5.1s"
              begin="-2.7s"
              repeatCount="indefinite"
            />
          </path>
          <path d={BULB_HALOS.core} fill="#fff4d4" opacity={0.9} />
        </g>
        <g style={{ transition: STEP_FADE, opacity: lit ? 0 : 1 }}>
          <path d={BULBS_D} fill={K.bulbOff} />
          <path d={BULBS_HI} fill="#c8c4b8" />
        </g>

        {/* ---- the parapet ---- */}
        <path d={PARAPET} fill={CONC[ph].base} />
        <path d={PARAPET_CAP} fill={CONC[ph].hi} />
        <rect x={0} y={CAP} width={W} height={H - CAP} fill="url(#px-agg)" />
        <path d={PARAPET_JOINTS} fill={CONC[ph].mid} />
        <path d={PARAPET_FLAKES} fill={CONC[ph].hi} opacity={0.7} />
        <path d={PARAPET_RUST} fill="#9a7a58" />
        <path d={PARAPET_WEEPS} fill={CONC[ph].deep} />
        {px(0, 174, W, 4, CONC[ph].lo)}
        {px(0, 178, W, 2, CONC[ph].deep)}
        {isSnow(o) ? (
          <g>
            {px(0, CAP - 2, W, 3, K.snow)}
            <path d={pxPath(bank([[24, CAP + 1, 6, 1]], 8, 38))} fill={K.snowLo} />
          </g>
        ) : null}
        {isWet(o) ? px(0, CAP, W, 2, K.waterHi, "cpwt") : null}
        {o.season === "autumn" ? (
          <path
            d={pxPath([
              [64, CAP - 2, 3, 2],
              [186, CAP - 2, 2, 2],
              [252, CAP - 1, 3, 2],
            ])}
            fill={K.leafDry}
          />
        ) : null}

        {/* ---- the flower box ---- */}
        <Bev set={BOX} mat={WOOD[ph]} />
        <rect x={102} y={128} width={56} height={16} fill="url(#px-wood)" />
        {px(102, 134, 56, 1, WOOD[ph].lo)}
        {px(104, 142, 52, 2, WOOD[ph].lo)}
        <path d={BOX_SOIL} fill={watered ? K.soilWet : K.soil} />
        {bare ? (
          <g>
            {/* winter: the stalks, cut back, and the frost on the rim */}
            <path d={pxPath(bank([[108, 124, 2, 6]], 6, 8))} fill="#6b6350" />
            {px(106, 127, 48, 2, "#5d5442")}
          </g>
        ) : (
          <g>
            {px(106, 122, 46, 5, LEAFM[ph].base)}
            {px(106, 122, 46, 1, LEAFM[ph].hi)}
            {FLOWER_X.map((x, idx) => (
              <g key={x}>
                {px(x, 118 - (idx % 2), 8, 7, watered ? K.marigoldHi : FLOWER_TONES[idx])}
                {px(x, 118 - (idx % 2), 8, 1, "#f6d189")}
                {px(x + 2, 120 - (idx % 2), 4, 3, "#b8641f")}
                {px(x + 3, 125 - (idx % 2), 2, 5, "#3d573d")}
              </g>
            ))}
            {px(112, 120, 3, 8, LEAFM[ph].base)}
            {px(136, 119, 3, 9, LEAFM[ph].base)}
          </g>
        )}
        {/* the water that runs straight out of the bottom, every time */}
        <g style={{ transition: STEP_FADE, opacity: watered ? 1 : 0 }}>
          {px(110, 144, 4, 2, "#6b5540")}
          {px(132, 144, 5, 2, "#6b5540")}
        </g>
        {isSnow(o) ? px(102, 127, 56, 2, K.snow, "bxsn") : null}
        {/* a bee doing its rounds, when there is sun to do them in */}
        {(ph === "day" || ph === "dawn") && !bare && !isFoul(o) ? (
          <g>
            {px(124, 112, 3, 2, "#e8c445")}
            {px(125, 111, 1, 1, K.bird)}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;14 -6;26 4;8 8;-6 -4;0 0"
              dur="9s"
              begin="-3.4s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}

        {/* ---- the ivy, the mug on the rail, and the pegs by the lens ---- */}
        <path d={IVY} fill={bare ? "#5d5442" : "#3f5b4a"} />
        {!bare ? px(272, 128, 2, 8, "#658474") : null}
        <g style={{ transition: STEP_FADE, opacity: s.coffee === "none" ? 0 : 1 }}>
          {px(186, 126, 10, 10, "#3f6b7a")}
          {px(186, 126, 10, 2, "#5f8f9e")}
          {px(195, 128, 1, 8, "#2f545f")}
          {px(188, 128, 6, 2, s.coffee === "fresh" ? "#2c1a12" : "#2c4a55")}
          {px(196, 129, 3, 5, "#3f6b7a")}
        </g>
        {px(0, 118, 3, 2, "#3a3b3a")}
        {px(2, 119, 2, 5, "#c94040")}
        {px(2, 125, 2, 5, "#4a90d9")}

        {/* ---- the drip off the balcony above, in front of the parapet ---- */}
        {isWet(o) ? (
          <path d={pxPath(bank([[46, 0, 2, 9]], 6, 52))} fill={K.waterHi} opacity={0.4}>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 190"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </path>
        ) : null}
        <Vignette set={VIG} strength={night ? 1 : 0.7} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function BalconyScene({ world, phase }: { world: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const o = outside(world);
  const s = state(world, ph, o);
  const i = interior(world);
  const on = lampOn(s, i, ph);
  return (
    <LayeredScene
      /**
       * The room behind the glass is about two metres back and the far wall of it
       * another two, so they should lag by different amounts. That difference is
       * the only thing that makes a 48 px aperture read as a room rather than as
       * a picture of one.
       */
      parallax={{ farBackground: 0.64, middleBackground: 0.84 }}
      farBackground={
        <g>
          {/* mounted once for the whole document — see pixelKit.SharedDefs */}
          <SharedDefs />
          <DeepInterior i={i} s={s} ph={ph} />
        </g>
      }
      middleBackground={<NearInterior i={i} ph={ph} />}
      ground={
        <g>
          <Soffit ph={ph} o={o} s={s} />
          <Facade ph={ph} o={o} />
          <BedroomWindow ph={ph} i={i} o={o} />
          <Fixtures ph={ph} on={on} o={o} />
          <Divider ph={ph} o={o} />
          <Slab ph={ph} o={o} s={s} />
        </g>
      }
      staticObjects={<Props ph={ph} s={s} o={o} />}
      gameplayObjects={
        <g>
          <TerraceDoor ph={ph} i={i} s={s} />
          <DryingRack ph={ph} s={s} />
          <Washing ph={ph} count={s.line} />
        </g>
      }
    />
  );
}

/* ================================================================== *
 * effects — the day, and what each hour does to a balcony
 * ================================================================== */

/** The hour, as a colour over everything. Outdoors this is most of the model. */
const CAST: Record<Ph, { fill: string; op: number }> = {
  dawn: { fill: DAWN_CAST, op: 0.16 },
  day: { fill: "#fff6e0", op: 0.05 },
  dusk: { fill: DUSK_CAST, op: 0.18 },
  night: { fill: NIGHT_CAST, op: 0.34 },
};

/** Rain in three sheets, snow in three drifts. One path, one animation each. */
const RAIN_SHEETS = [0, 1, 2].map((i) =>
  pxPath(
    Array.from(
      { length: 26 },
      (_, j) =>
        [
          ((j * 149 + i * 47) % (W + 40)) - 20,
          ((j * 53 + i * 29) % 200) - 20,
          1,
          i === 0 ? 8 : i === 1 ? 6 : 4,
        ] as Rect,
    ),
  ),
);
const SNOW_SHEETS = [0, 1, 2].map((i) =>
  pxPath(
    Array.from(
      { length: 22 },
      (_, j) =>
        [
          ((j * 163 + i * 61) % (W + 40)) - 20,
          ((j * 71 + i * 37) % 200) - 20,
          i === 0 ? 2 : 1,
          i === 0 ? 2 : 1,
        ] as Rect,
    ),
  ),
);
/** The moths that live in every bulkhead lamp. */
const MOTHS = [
  { x: 106, y: 74, d: "2.7s", r: 9, b: "-0.9s" },
  { x: 128, y: 80, d: "3.4s", r: 7, b: "-2.2s" },
  { x: 120, y: 66, d: "2.2s", r: 6, b: "-1.5s" },
] as const;
/** The swallows leave at dawn and come back at dusk, over the parapet. */
const SWALLOW = pxPath([
  [0, 20, 4, 1],
  [3, 19, 3, 1],
]);

/**
 * Steam is a DOM element, not SVG: it is the one thing in this scene that wants a
 * real blur, and the CSS keyframe in the stylesheet does it better than any
 * amount of stepped opacity would.
 */
function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.55 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

function BalconyEffects({
  world,
  phase,
  scale,
  actionUi,
}: {
  world: WorldState;
  phase: string;
  fx: import("@/engine").FxInstance[];
  scale: number;
  actionUi: string | null;
  moving: boolean;
  dialogueOpen: boolean;
}) {
  const ph = toPhase(phase);
  const o = outside(world);
  const s = state(world, ph, o);
  const i = interior(world);
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const on = lampOn(s, i, ph);
  const lit = railOn(s, ph);
  const sun = !isFlat(o);
  return (
    <>
      {/* the cigarette, and the coffee that is still worth drinking */}
      {actionUi === "smoke" ? <Steam x={92} y={112} scale={scale} /> : null}
      {s.coffee === "fresh" ? <Steam x={188} y={120} scale={scale} slow /> : null}
      {/* and the AC unit, breathing, when it is cold enough to see it */}
      {isSnow(o) || ph === "dawn" ? <Steam x={236} y={50} scale={scale} slow /> : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* the hour */}
          <rect
            width={W}
            height={H}
            fill={CAST[ph].fill}
            opacity={CAST[ph].op}
            style={{ transition: STEP_FADE }}
          />

          {/* --- the sun, and the only question it ever asks: how low is it --- */}
          {ph === "dawn" && sun ? (
            <g>
              <Light set={SUN_DAWN} />
              <path d={POST_SHADOWS} fill={dth("n", "25")} opacity={0.12} />
            </g>
          ) : null}
          {ph === "day" && sun ? <Light set={SUN_DAY} /> : null}
          {ph === "dusk" && sun ? (
            <g>
              <Light set={SUN_DUSK} />
              <path d={POST_SHADOWS} fill={dth("n", "25")} opacity={0.16} />
            </g>
          ) : null}
          {/* what the overhang does about it, at every hour */}
          <path d={OVERHANG} fill={dth("n", "25")} opacity={night ? 0.5 : 0.3} />

          {/* --- the six artificial sources, at three temperatures --- */}
          <g opacity={on ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={LAMP_CONE} />
            <Light set={LAMP_POOL} />
            <path d={LAMP_HALO.halo} fill={dth("w", "12")} opacity={0.35} />
            <path d={LAMP_HALO.core} fill={K.warmHi} opacity={0.9} />
            {/* and the moths, which only exist because the lamp does */}
            {dark
              ? MOTHS.map((mo) => (
                  <rect
                    key={mo.x}
                    x={mo.x}
                    y={mo.y}
                    width={2}
                    height={2}
                    fill="#e8dfc0"
                    opacity={0.85}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={`0 0; ${mo.r} -${Math.round(mo.r / 2)}; -${Math.round(mo.r / 2)} ${mo.r}; ${Math.round(mo.r / 3)} ${Math.round(mo.r / 3)}; 0 0`}
                      dur={mo.d}
                      begin={mo.b}
                      repeatCount="indefinite"
                    />
                  </rect>
                ))
              : null}
          </g>
          <g opacity={lit ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={RAIL_WASH} />
          </g>
          {/* the room, through the glass — or through the gap, when it is open */}
          {dark && i.studio ? (
            <g>
              <Light
                set={s.door === "ajar" ? AJAR_WASH : ROOM_WASH}
                op={s.door === "ajar" ? 1 : 0.7}
              />
            </g>
          ) : null}
          {dark && i.study ? <Light set={BED_WASH} /> : null}
          {dark && i.tv ? (
            <g>
              <Light set={TV_WASH} op={0.5} />
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="1;0.55;0.95;0.6;1"
                dur="1.8s"
                begin="-0.6s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {s.neighbour !== "away" && dark ? <Light set={NB_WASH} /> : null}

          {/* --- weather --- */}
          {o.weather === "rain" ? (
            <g>
              {RAIN_SHEETS.map((d, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static rain sheets
                <path key={idx} d={d} fill="#a8bccc" opacity={0.4 - idx * 0.08}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0 0;${-8 - idx * 3} 200`}
                    dur={`${0.7 + idx * 0.25}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}
              {/* the bounce off the slab, which is what tells you it is raining */}
              <path
                d={pxPath(bank([[10, FLOOR + 4, 2, 1]], 15, 20))}
                fill={K.waterHi}
                opacity={0.35}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.35;0.12;0.3;0.15"
                  dur="0.4s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {o.weather === "snow" ? (
            <g>
              {SNOW_SHEETS.map((d, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static snow sheets
                <path key={idx} d={d} fill={K.snow} opacity={0.75 - idx * 0.18}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0 0;${-20 - idx * 9} 200`}
                    dur={`${3.4 + idx * 1.1}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}
            </g>
          ) : null}
          {o.weather === "overcast" ? (
            <rect width={W} height={H} fill="#9aa4ac" opacity={0.14} />
          ) : null}

          {/* --- the swallows, out at dawn and back at dusk --- */}
          {s.swallows === "flying" ? (
            <g>
              {["-0s", "-9s"].map((b) => (
                <g key={b}>
                  <path d={SWALLOW} fill={K.bird} />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={
                      ph === "dawn" ? "240 14;240 14;-20 0;-20 0" : "-20 0;-20 0;240 14;240 14"
                    }
                    keyTimes="0;0.7;0.92;1"
                    dur="26s"
                    begin={b}
                    repeatCount="indefinite"
                  />
                </g>
              ))}
            </g>
          ) : null}

          {/* --- transients. None of this is in artKey, which is why it is here. --- */}
          {actionUi === "lamp" ? (
            <path d={pxPath([[112, 74, 12, 14]])} fill={dth("w", "25")} opacity={0.5} />
          ) : null}
          {actionUi === "flowers" ? (
            <g>
              {[0, 0.6, 1.2].map((d) => (
                <rect key={d} x={128} y={116} width={1} height={2} fill="#bfe0f5" opacity={0}>
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    begin={`${d}s`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;0 14"
                    begin={`${d}s`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </rect>
              ))}
            </g>
          ) : null}
          {actionUi === "seedlings" ? (
            <path d={pxPath([[200, 118, 36, 30]])} fill={dth("w", "12")} opacity={0.4} />
          ) : null}
          {actionUi === "call" ? (
            <path d={pxPath([[140, 96, 16, 20]])} fill={dth("c", "25")} opacity={0.3} />
          ) : null}
          <Vignette set={VIG} strength={night ? 0.4 : 0} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition — all 15 original hitboxes at their original x, plus 2 new
 * ================================================================== */

export const BALCONY_SCENE: RuntimeSceneDef<WorldState> = {
  id: "balcony",
  width: W,
  /**
   * Every world read the art performs. This scene had no artKey at all, so the
   * art plane repainted on any world change; these are the seventeen reads that
   * can actually alter a pixel — thirteen of its own, three borrowed from the
   * flat behind the glass, and two from the street below.
   */
  artKey: (w, ph) => {
    const p = toPhase(ph);
    const o = outside(w);
    const s = state(w, p, o);
    const i = interior(w);
    return [
      ph,
      s.line,
      s.rack,
      s.seedlings,
      s.flowers,
      s.ashtray,
      s.bike,
      s.rail,
      s.lamp,
      s.door,
      s.coffee,
      s.cat,
      s.neighbour,
      s.swallows,
      i.studio ? 1 : 0,
      i.study ? 1 : 0,
      i.tv ? 1 : 0,
      o.weather,
      o.season,
    ].join("|");
  },
  objects: [
    { id: "boots", kind: "flavor", x: 10, range: 8 },
    /* --- new: the mat, and the one thing that fits in the gap at 18…24 --- */
    { id: "doormat", kind: "flavor", x: 21, range: 3 },
    {
      id: "door-living3",
      kind: "flatdoor",
      priority: 1,
      x: 44,
      range: 20,
      to: { scene: "studio", spawnX: 580 },
    },
    { id: "ashtray", kind: "flavor", x: 70, range: 8 },
    { id: "smoke", kind: "sport", action: "smoke", x: 96, range: 12 },
    { id: "switch-balcony", kind: "lamp", x: 116, range: 7 },
    { id: "flowers", kind: "flavor", x: 132, range: 7 },
    { id: "call", kind: "sport", action: "call", x: 148, range: 7 },
    { id: "laundry", kind: "flavor", x: 166, range: 8 },
    { id: "skis", kind: "flavor", x: 184, range: 7 },
    { id: "broom", kind: "flavor", x: 196, range: 5 },
    { id: "seedlings", kind: "flavor", x: 216, range: 10 },
    { id: "ac-unit", kind: "flavor", x: 234, range: 8 },
    { id: "crate", kind: "flavor", x: 252, range: 8 },
    /* --- new: the drainpipe, the dish and the meters, in the gap at 260…268 --- */
    { id: "drainpipe", kind: "flavor", x: 264, range: 4 },
    { id: "bicycle", kind: "flavor", x: 280, range: 13 },
    { id: "divider", kind: "flavor", x: 302, range: 8 },
  ],
  Component: ({ world, phase }) => <BalconyScene world={world} phase={phase} />,
  /* the cast and the sources do most of it; the engine takes the rest */
  darkness: (phase, world) => {
    const o = outside(world);
    const s = state(world, toPhase(phase), o);
    const lit = railOn(s, toPhase(phase));
    if (phase === "night") return lit ? 0.14 : 0.3;
    if (phase === "dusk") return lit ? 0.05 : 0.12;
    if (phase === "dawn") return 0.05;
    return 0;
  },
  Foreground: (p) => <BalconyFront {...p} />,
  Effects: BalconyEffects,
  idleLean: true,
};

/* ==================================================================== *
 * WHAT HAS TO HAPPEN OUTSIDE THIS FILE
 *
 * 1. TWO TRANSLATION ENTRIES, for the two new ids:
 *
 *        doormat     the mat, and the scraper nobody uses
 *        drainpipe   the pipe, the dish, the meters, the rust at the joint
 *
 *    Two existing entries are worth a reread now that they point at more than
 *    they did: `laundry` covers the line *and* the rack in both its states, and
 *    `divider` covers the missing plank and what you can see through it.
 *
 *    ONLY TWO, DELIBERATELY. This is already the densest scene in the game — 17
 *    interactions across 310 px is one per 18, against the street's one per 35
 *    and the corridor's one per 25 — and after the two above there is no gap left
 *    wider than 4 px. Adding more would mean nesting a hitbox inside another
 *    one's range, which is how you get the misaimed prompts the street file spent
 *    a page on. The right move here was aim, not count. Three were off:
 *
 *        switch-balcony  109…123  pointed at bare render; the switch was drawn
 *                                 at 102…110. The switch is at 112…120 now.
 *        door-living3     24…64   pointed 13 px left of an 82 px door. The door
 *                                 is a real 1.47 m and centres on 44.
 *        laundry         158…174  pointed at nothing at all once the rack folded
 *                                 itself away to 128…138. Folded, it now leans
 *                                 at 160…172.
 *
 * 2. FOUR NEW `actionUi` TAGS, if the interaction layer wants the transients that
 *    are already wired in BalconyEffects: "lamp", "flowers", "seedlings", "call".
 *    "smoke" already exists and is handled. Anything not emitted simply never
 *    fires; none of it is in artKey, so none of it costs a repaint.
 *
 * 3. NO `WorldState` CHANGE IS REQUIRED. Every read goes through clampStage /
 *    clampInt on an untyped record, and the five legacy flags — `lights.balcony`,
 *    `balcony.watered`, `.flowersWatered`, `.smoked`, `.bikeCovered` — still win
 *    where they are set. If you want the new stages settable, the exported types
 *    are LineStage, RackStage, PlantStage, AshStage, BikeStage, SwitchStage,
 *    DoorStage, CoffeeStage, CatStage, NeighbourStage, SwallowStage.
 *
 * 4. `stripes()` IS NO LONGER IMPORTED HERE. It was the only engine helper this
 *    scene used and it is now the only scene that used it. If nothing else in the
 *    project calls it, it can come out of the engine's surface; if something does,
 *    it should be documented alongside `repeat` and `bank`, because the three
 *    overlap and it is not obvious which to reach for.
 *
 * 5. SIX HELPERS THAT ARE NOW IN THREE FILES AND BELONG IN THE KITS. Each is
 *    byte-identical in street.tsx, corridor.tsx and here:
 *
 *        pixelKit:  bank(shape, n, pitch, dy)      banked repeats with an offset
 *                   BigText                        integer-scaled pixel text
 *                   clampStage / clampInt          the state-reader guards
 *        lightKit:  ramp(mat)                      the four-phase material ramp
 *                   hazeRamp(mat, k)               mix toward the horizon band
 *                   spill / wash / sunBand         apertures and bands onto the
 *                                                  ground row
 *
 *    Three copies is the point at which this stops being duplication and starts
 *    being a bug waiting to happen: the day the four-phase ramp changes, it has to
 *    change in three places or the scenes stop agreeing about what dusk looks
 *    like. This is the highest-value cleanup left in the scene system, and it is
 *    twenty minutes of work.
 *
 * ==================================================================== *
 * SECOND PASS — if the street is the quality bar, what still made this the older
 * scene, and what was done about it.
 *
 *   – It was 3.58 m tall. Now 2.80, and the door that was 2.16 m wide is 1.47 —
 *     which is what put the `door-living3` hitbox on its own door for the first
 *     time. Nothing else in the scene changed as much for as little.
 *   – Fourteen gradients, nine ellipses, four polygons and a circle: every banned
 *     primitive in the project, all of them here. Zero of each now.
 *   – Nothing was precomputed. Everything static is a module-load path, and the
 *     repeats are banked — the divider's plank lines, the AC fins, the rail posts,
 *     the mat ribs, the parapet joints, the slab joints, the crate slats, the
 *     thirteen bulbs, both weather sheets.
 *   – Its own Bevel, AO, Contact, Defs, Mat, Ph and toPhase. All deleted; the
 *     kit versions do all six, and the AO ramp in particular is better than the
 *     five hand-stacked rgba rows it replaced.
 *   – Three planes, and the two interiors were flattened into one. Six planes,
 *     and the far wall of the room now lags the sofa in front of it.
 *   – Five booleans. Thirteen stages, clock- and weather-derived.
 *   – No artKey on nineteen reads.
 *   – It could not see the weather, which on a balcony is the premise. It reads
 *     the street's now, and eleven things respond to it.
 *   – Objects appeared and vanished on a state change: the washing, the rack, the
 *     bike sheet, the ashtray, the mug, the water in the flower box. All mounted
 *     and stepped now.
 *   – Every loop started at t=0. Negative `begin` on all fifteen that could be
 *     caught at their reset.
 *   – The AC drip animated its `y` smoothly through 90 px, which is the one
 *     animation in the scene that was visibly not pixel art. It is on
 *     calcMode="discrete" in five steps now.
 *   – Typography: there was none at all. The meter box carries the flat number and
 *     the soil bag its label, both through PixelText, and BigText is available for
 *     anything larger that gets added later.
 *
 * PERFORMANCE. Node count is *down* about 25% on the old pass despite the scene
 * gaining two planes and eleven weather responses, because the repeats are banked
 * and the fourteen gradient definitions are gone — a <defs> block is cheap to
 * declare and expensive to composite, and this one was being composited eight
 * times a frame. Animations went 26 → 31, but 19 are discrete and the two
 * remaining smooth ones are the CSS steam, which is not our compositor's problem.
 * The one thing to watch: `Washing` keeps three garments mounted at opacity 0 so
 * the line can fill and empty without popping. That is 30 nodes doing nothing on
 * a rainy night, and it is the right trade — but if this scene ever needs to give
 * something back, that is where the slack is.
 * ==================================================================== */
