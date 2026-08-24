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
  Monologue,
  NpcActor,
  npcToActor,
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  STEP_FADE,
  STEP_SLIDE,
  shift,
  steppedEllipse,
  steppedQuad,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";

// --- GDAŃSK OLIWA / the Alchemia district, at street level --------------------------

/**
 * The pavement in front of Alchemia: two coffee places, an office block, the
 * door to Zdrofit, a surface car park, and the tram stop you arrive at. The
 * first exterior in the game, and the first scene where the hour does
 * everything — which makes it the exact inverse of the gym it leads into.
 *
 * ==================================================================
 * SCALE. This scene is drawn to a measured key and everything in it is a real
 * dimension. The key was taken from the people already in the game: Natalia is
 * 66 px, the lifter and the runner are 68 px, so a 1.75 m adult is 67 px and
 *
 *     PPM = 38 px per metre, or 2.6 cm per pixel.
 *
 * Use `m()` for anything with a real size rather than typing the pixel value,
 * so the next person can see what it is meant to be. At this key the 180 px
 * frame is 4.74 m tall, of which 150 px is above the pavement — 3.95 m. That is
 * the single most important consequence in this file: **a 4.5 m office ground
 * floor is 171 px and does not fit.** The buildings therefore run off the top
 * of frame and we see plinth, glazing and fascia only, which is also exactly
 * what you see standing on a pavement looking at a building. Nothing here is
 * shrunk to fit. Reference dimensions, all verified against the key:
 *
 *     adult                1.75 m    67 px      kerb upstand      0.12 m   5 px
 *     door head            2.10 m    80 px      paving slab       0.50 m  19 px
 *     shopfront head       3.00 m   114 px      bollard           0.90 m  34 px
 *     car length           4.40 m   167 px      bench seat        0.45 m  17 px
 *     car height           1.45 m    55 px      café table        0.75 m  29 px
 *     car track            1.80 m    68 px      litter bin        1.00 m  38 px
 *     wheel                0.65 m    25 px      bicycle           1.75 m  67 px
 *     parking bay          2.50 m    95 px      tram gauge        1.435 m 55 px
 *
 * Anything taller than 3.95 m — lampposts, trees, the towers, the crane, the
 * parasols at full height — is cropped by the frame on purpose, and the crop is
 * the composition.
 * ==================================================================
 *
 * Six planes:
 *   farBackground (0.86) — the sky in stepped bands, the Alchemia towers rising
 *     out of frame over the car park, the crane on the next plot, the SKM
 *     viaduct, gulls. It lags hard because it is hundreds of metres out.
 *   middleBackground (1.0) — the back edge of the pavement: every facade,
 *     shopfront, fascia and door, and what is visible through the glass. The
 *     office lobby and both café interiors are drawn behind their own glazing,
 *     which is where most of the detail in this scene actually lives.
 *   ground (1.0) — the pavement: slabs, kerb, tactile paving, gullies, covers,
 *     gum, leaves, and every shadow the buildings throw. All hitboxes here.
 *   staticObjects (1.0) — street furniture, café seating, the cars, the barrier.
 *   gameplayObjects (1.0) — people.
 *   Foreground (fixed) — the road: kerb edge, asphalt, a tram rail, a vehicle
 *     going past, and a tree branch across the top of the frame.
 *
 * LIGHTING PREMISE. Outside, so the sun is the model and it is the only scene
 * where that is true. The pavement runs roughly east–west with the buildings on
 * the north side, so the sun rakes along it: at dawn a long shadow from every
 * upright thrown to the right, at midday short shadows straight down and the
 * glazing going flat and bright, at dusk long shadows to the left and the west
 * glass on fire. After dark the sun's job is taken over by four separate
 * artificial sources at four temperatures — the street lamps on a photocell
 * (cold), the café windows (warm), the office lobby (cold and very bright,
 * because nobody turns a lobby off), and car headlights. That is what makes a
 * street at night look like a street at night.
 *
 * STATE. Thirteen reads, all defensive — `world.district` need not exist:
 *
 *   weather   clear → overcast → rain → wet    the biggest single change here
 *   season    green → autumn → bare            trees, and what is on the slabs
 *   cafeA     closed → open → busy             shutter, A-board, chairs, queue
 *   cafeB     closed → open → busy
 *   parking   0..4                             cars in the bays
 *   barrier   down → up
 *   bins      0..2                             overflow, and the gulls it brings
 *   lamps     auto → on → off
 *   crowd     0..3                             who is on the pavement
 *   delivery  none → courier → van
 *   roadworks boolean                          the trench that is always there
 *   market    boolean                          the Friday food truck
 *   zdrofitOpen boolean                        whether the gym sign is lit
 *
 * TRANSIENTS live in DistrictEffects. The art holds what is true when the player
 * is not doing anything.
 *
 * BUDGET. ~360 nodes at the busiest state, 14 animations, 9 of them on
 * calcMode="discrete". Zero gradients, zero ellipses. 25 hitboxes, audited for
 * overlap and for dead stretches. At 1760 wide that only
 * works because everything repeated is banked: four cars are one shape in four
 * colours flattened by part, the paving is 2 paths, the tower glazing is 3, the
 * bike stands and café chairs are 1 each.
 *
 * NAMES. The two cafés are invented so as not to put words in a real business's
 * mouth. The office block letters are my best recollection of the Alchemia
 * building names and are one constant each to change if they are wrong. The
 * Zdrofit fascia is the name set in the house pixel font — a colour and a word,
 * not a reproduction of anybody's logotype.
 */

const W = 1760;
const H = 180;

/* ================================================================== *
 * the scale key
 * ================================================================== */

/** Pixels per metre. Derived from the figures already in the game. Do not retune. */
const PPM = 38;
/** Metres to pixels. Use this for anything with a real-world size. */
const m = (metres: number) => Math.round(metres * PPM);

/* Landmark rows, all expressed as heights above the pavement. */
const GROUND = 150; // pavement surface, 0.00 m
const KERB = 168; // where the slabs stop and the carriageway starts
const ROAD = 171;
const DOOR_HEAD = GROUND - m(2.1); // 70
const SILL = GROUND - m(0.9); // 116 — where a shopfront's stallriser stops
const SHOP_HEAD = GROUND - m(3.0); // 36 — glazing head, underside of the fascia
const FASCIA_TOP = GROUND - m(3.6); // 13 — top of the sign band
const CY = GROUND - 1; // where contact shadows sit

/** Zone boundaries. Every x in this file belongs to exactly one of these. */
const Z = {
  /** tram stop and the SKM footbridge you arrive by */
  stop: 250,
  /** the specialty roastery */
  cafeA: 560,
  /** the office block */
  aurum: 880,
  /** the gym's own ground-floor unit, under the same block */
  zdrofit: 1090,
  /** open plot: surface parking, sky above it */
  parking: 1470,
  /** the bakery kiosk and the crossing back toward the city */
  end: W,
} as const;

/** The building names on the fascias. One constant each, easy to correct. */
const NAME_OFFICE = "AURUM";
const NAME_OFFICE2 = "ARGON";
const NAME_CAFE_A = "PALARNIA";
const NAME_CAFE_A2 = "ORBITA";
const NAME_CAFE_B = "PIEKARNIA";

/* ================================================================== *
 * palette
 * ================================================================== */

const DAWN_CAST = "#8d88ae";
const DUSK_CAST = "#d4813e";
const NIGHT_CAST = "#0f1626";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.2),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.22),
    night: dim(mat, NIGHT_CAST, 0.62),
  };
}

/** Grey concrete paving, 500 mm square, laid by the developer and never relaid. */
const SLAB_MAT: Mat = {
  hi: "#a8a49c",
  base: "#948f88",
  mid: "#8a857e",
  lo: "#7e7a73",
  deep: "#66625c",
};
/** The darker banded course that runs along the kerb line. */
const BAND_MAT: Mat = {
  hi: "#6d6a64",
  base: "#5a5752",
  mid: "#52504b",
  lo: "#4a4844",
  deep: "#383634",
};
const ASPHALT: Mat = {
  hi: "#4e5157",
  base: "#3e4147",
  mid: "#383b41",
  lo: "#32353a",
  deep: "#24262a",
};
/** Sandstone-effect precast on the café building — the warm one on the street. */
const STONE_MAT: Mat = {
  hi: "#d6c6a8",
  base: "#c2b294",
  mid: "#b6a688",
  lo: "#a89a7e",
  deep: "#8a7d64",
};
/** Dark composite cladding on the office block. Alchemia is a dark building. */
const CLAD_MAT: Mat = {
  hi: "#4a5058",
  base: "#383e45",
  mid: "#32373d",
  lo: "#2c3137",
  deep: "#1e2226",
};
/** Polished granite plinth, which is what the first metre of an office is. */
const GRANITE_MAT: Mat = {
  hi: "#787f86",
  base: "#5e646b",
  mid: "#565b61",
  lo: "#4c5157",
  deep: "#383c41",
};
const COAT_MAT: Mat = {
  hi: "#3a3d43",
  base: "#25282c",
  mid: "#212428",
  lo: "#1b1e22",
  deep: "#131518",
};
const CHROME_MAT: Mat = {
  hi: "#e8ecf0",
  base: "#c4c9ce",
  mid: "#b0b5ba",
  lo: "#989da2",
  deep: "#74797e",
};

const SLAB = ramp(SLAB_MAT);
const BAND = ramp(BAND_MAT);
const ROADMAT = ramp(ASPHALT);
const STONE = ramp(STONE_MAT);
const CLAD = ramp(CLAD_MAT);
const GRANITE = ramp(GRANITE_MAT);
const COAT = ramp(COAT_MAT);
const CHROME = ramp(CHROME_MAT);
const OAK = ramp(M.oak);
const LEAF = ramp(M.leaf);

const K = {
  /** the sky, in four bands per phase: zenith down to horizon */
  sky: {
    dawn: ["#4e5680", "#7a7aa0", "#b09ab0", "#e0b4a0"],
    day: ["#6d9ec9", "#8fb8d8", "#b4d0e4", "#d6e4ee"],
    dusk: ["#33405e", "#7a5a80", "#c9724e", "#f0a45c"],
    night: ["#080d18", "#10182a", "#1c2740", "#2c3a52"],
  } as Record<Ph, readonly string[]>,
  /** glass, unlit, per phase — it is a mirror of the sky more than a window */
  glass: { dawn: "#9a9ab8", day: "#a8c6da", dusk: "#c98a62", night: "#161c28" } as Record<
    Ph,
    string
  >,
  /** and glass with a lit room behind it, which does not change with the hour */
  glassLit: "#f0dfb8",
  lobbyLit: "#e4eef4",
  /** Zdrofit's band. A colour and a word. */
  brand: "#e8542e",
  snow: "#eef4f8",
  brandHi: "#f5764c",
  brandLo: "#b83c1c",
  /** the café's own green, because every roastery in Poland picked one */
  cafe: "#2f5c48",
  cafeHi: "#3f7a5e",
  cafeCream: "#f0e6d2",
  lamp: "#f4f6ff",
  lampWarm: "#ffd98a",
  neon: "#ff7a4a",
  green: "#3ddc84",
  red: "#e0483a",
  amber: "#f0a63c",
  white: "#e8e6e0",
  water: "#7fa8b8",
  waterHi: "#b8d4e0",
  gum: "#2e2c28",
  leafDry: "#a8763a",
  leafDead: "#7a5a34",
  moss: "#4a5c3a",
  gull: "#e4e6e8",
  gullDark: "#5d6266",
  tape: "#f0d040",
  cone: "#e0562c",
  skin: M.skin.base,
  skinLo: M.skin.lo,
  coat: "#3a4450",
  coatB: "#6a4a3a",
  hiVis: "#d8e04a",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

export type Weather = "clear" | "overcast" | "rain" | "wet" | "snow";
export type Season = "green" | "autumn" | "bare";
export type CafeStage = "closed" | "open" | "busy";
export type BarrierStage = "down" | "up";
export type LampStage = "auto" | "on" | "off";
export type DeliveryStage = "none" | "courier" | "van";

const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain", "wet", "snow"];
const SEASONS: readonly Season[] = ["green", "autumn", "bare"];
const CAFE_STAGES: readonly CafeStage[] = ["closed", "open", "busy"];
const BARRIER_STAGES: readonly BarrierStage[] = ["down", "up"];
const LAMP_STAGES: readonly LampStage[] = ["auto", "on", "off"];
const DELIVERY_STAGES: readonly DeliveryStage[] = ["none", "courier", "van"];

type DistrictState = {
  weather: Weather;
  season: Season;
  cafeA: CafeStage;
  cafeB: CafeStage;
  parking: 0 | 1 | 2 | 3 | 4;
  barrier: BarrierStage;
  bins: 0 | 1 | 2;
  lamps: LampStage;
  crowd: 0 | 1 | 2 | 3;
  delivery: DeliveryStage;
  roadworks: boolean;
  market: boolean;
  zdrofitOpen: boolean;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/** Defaults describe a Tuesday morning in October, which is this street at its most itself. */
function state(world: WorldState): DistrictState {
  const b = ((world as unknown as Record<string, unknown>).district ?? {}) as Record<
    string,
    unknown
  >;
  return {
    weather: clampStage(b.weather, WEATHERS, "overcast"),
    season: clampStage(b.season, SEASONS, "autumn"),
    cafeA: clampStage(b.cafeA, CAFE_STAGES, "open"),
    cafeB: clampStage(b.cafeB, CAFE_STAGES, "open"),
    parking: clampInt(b.parking, 4, 3) as 0 | 1 | 2 | 3 | 4,
    barrier: clampStage(b.barrier, BARRIER_STAGES, "down"),
    bins: clampInt(b.bins, 2, 1) as 0 | 1 | 2,
    lamps: clampStage(b.lamps, LAMP_STAGES, "auto"),
    crowd: clampInt(b.crowd, 3, 2) as 0 | 1 | 2 | 3,
    delivery: clampStage(b.delivery, DELIVERY_STAGES, "courier"),
    roadworks: b.roadworks !== false,
    market: b.market === true,
    zdrofitOpen: b.zdrofitOpen !== false,
  };
}

/** The lamps are on a photocell unless somebody has overridden them. */
function lampsOn(s: DistrictState, ph: Ph): boolean {
  if (s.lamps === "on") return true;
  if (s.lamps === "off") return false;
  return ph === "night" || ph === "dusk" || (ph === "dawn" && s.weather !== "clear");
}

/** Wet ground reflects, and that changes half the drawing decisions downstream. */
function isWet(s: DistrictState): boolean {
  return s.weather === "rain" || s.weather === "wet";
}

const isSnow = (s: DistrictState) => s.weather === "snow";

function whoIsHere(s: DistrictState) {
  return {
    barista: s.cafeA !== "closed",
    smoker: s.crowd >= 1,
    courier: s.delivery === "courier",
    walker: s.crowd >= 2,
    queue: s.cafeA === "busy" || s.cafeB === "busy",
  };
}

/* ================================================================== *
 * geometry helpers
 * ================================================================== */

/** Define a thing once, then bank it. The rule that makes 1760 px affordable. */
function bank(shape: readonly Rect[], n: number, pitch: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) out.push(...shift(shape, i * pitch, 0));
  return out;
}

/** Integer-scaled pixel text, for anything bigger than a plaque. */
function BigText({
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
  /** MUST be an integer, or the letters stop sitting on the pixel grid. */
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

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/** The pavement: 500 mm slabs in a stretcher bond, two courses in frame. */
const PAVING = (() => {
  const face: Rect[] = [];
  const hi: Rect[] = [];
  const slab = m(0.5);
  let row = 0;
  for (let y = GROUND; y < KERB; y += 9, row++) {
    const stagger = row % 2 === 1 ? Math.round(slab / 2) : 0;
    for (let x = -slab + stagger; x < W; x += slab) {
      const x0 = Math.max(0, x + 1);
      const x1 = Math.min(W, x + slab - 1);
      if (x1 <= x0) continue;
      face.push([x0, y, x1 - x0, 8]);
      hi.push([x0, y, x1 - x0, 1]);
    }
  }
  return { face: pxPath(face), hi: pxPath(hi) };
})();

/** Tactile paving at the crossing: 25 mm blisters, 65 mm centres. Two paths. */
const TACTILE = (() => {
  const studs: Rect[] = [];
  for (let y = GROUND + 1; y < KERB; y += 3) {
    for (let x = 1660; x < 1740; x += 3) studs.push([x, y, 2, 2]);
  }
  return pxPath(studs);
})();

/** Kerb, gutter, gullies, covers. Everything a pavement edge actually has. */
const KERB_LINE = pxPath([[0, KERB, W, m(0.12)]]);
const GULLIES = pxPath(
  Array.from({ length: 6 }, (_, i) => [180 + i * 300, KERB + 6, m(0.45), 4] as Rect),
);
const COVERS = pxPath([
  [312, GROUND + 4, m(0.6), 9],
  [742, GROUND + 8, m(0.45), 7],
  [1198, GROUND + 3, m(0.6), 9],
  [1602, GROUND + 7, m(0.45), 7],
]);
/** Chewing gum. A pavement in front of a coffee shop is mostly this. */
const GUM = pxPath([
  [286, 156, 2, 2],
  [304, 163, 2, 1],
  [330, 152, 1, 2],
  [352, 159, 2, 2],
  [408, 165, 1, 2],
  [470, 154, 2, 2],
  [516, 161, 2, 1],
  [922, 158, 2, 2],
  [1512, 156, 2, 2],
  [1548, 164, 1, 2],
]);

/* --- sky, in four stepped bands, one path each --- */
const SKY_BANDS: Rect[] = [
  [0, 0, W, 22],
  [0, 22, W, 26],
  [0, 48, W, 24],
  [0, 72, W, 40],
];

/* --- the towers over the car park, cropped by the frame --- */
const TOWER_A: Rect = [1120, 0, 168, 118];
const TOWER_B: Rect = [1300, 0, 132, 104];
const TOWER_GLAZING = pxPath([
  ...bank([[0, 6, 18, 12]], 8, 21).flatMap((r) =>
    bank([r], 6, 0).map(([x, y, w, h]) => [x + 1126, y, w, h] as Rect),
  ),
]);
/** Curtain-wall grid: one path for the horizontals, one for the verticals. */
const TOWER_GRID = {
  horiz: pxPath([
    ...repeat(6, 20, [1120, 12, 168, 2] as Rect, "y"),
    ...repeat(5, 20, [1300, 16, 132, 2] as Rect, "y"),
  ]),
  vert: pxPath([
    ...repeat(9, 21, [1124, 0, 2, 118] as Rect),
    ...repeat(7, 19, [1304, 0, 2, 104] as Rect),
  ]),
};
/** The tower windows that are lit at night, deterministic so they do not flicker. */
const TOWER_LIT = pxPath(
  bank([[0, 6, 18, 12]], 8, 21)
    .flatMap((r, i) => bank([r], 6, 0).map((rr, j) => [rr, i, j] as const))
    .filter(([, i, j]) => (i * 7 + j * 3) % 5 < 2)
    .map(([[x, y, w, h], , j]) => [x + 1126, y + j * 20, w, h] as Rect),
);
/** The crane on the next plot, because there is always one. */
const CRANE = pxPath([
  [1520, 0, 4, 112],
  [1440, 18, 200, 3],
  [1440, 21, 3, 8],
  [1596, 21, 3, 14],
  [1520, 0, 4, 4],
]);

/* --- the SKM viaduct at the stop end --- */
const VIADUCT = {
  deck: pxPath([[0, 40, Z.stop - 40, 10]]),
  soffit: pxPath([[0, 50, Z.stop - 40, 3]]),
  balustrade: pxPath([...repeat(11, 20, [6, 26, 2, 14] as Rect), [0, 24, Z.stop - 40, 3]]),
  pier: pxPath([[176, 50, m(0.6), 100]]),
};

/* --- shopfront glazing, banked per unit --- */
/** One 1.2 m glazing bay: glass, and the mullion on its right. */
function glazing(x0: number, x1: number, top: number, bottom: number) {
  const bay = m(1.2);
  const n = Math.floor((x1 - x0) / bay);
  return {
    glass: pxPath(
      Array.from({ length: n }, (_, i) => [x0 + i * bay + 2, top, bay - 4, bottom - top] as Rect),
    ),
    mullion: pxPath(
      Array.from({ length: n + 1 }, (_, i) => [x0 + i * bay, top, 3, bottom - top] as Rect),
    ),
    head: pxPath([[x0, top - 3, x1 - x0, 3]]),
  };
}
const GLAZE_CAFE_A = glazing(266, 512, SHOP_HEAD, SILL);
const GLAZE_AURUM = glazing(Z.cafeA + 24, 856, SHOP_HEAD, GROUND);
const GLAZE_ZDROFIT = glazing(908, 1064, SHOP_HEAD, GROUND);
const GLAZE_CAFE_B = glazing(1496, 1620, SHOP_HEAD, SILL);

/* --- cars, side-on and rear-on, defined once each --- */
/** A hatchback seen from the side: 4.40 m long, 1.45 m tall, 0.65 m wheels. */
// @ts-expect-error TS6133 — staged for the parked-cars pass
function _carSide(x: number) {
  const L = m(4.4); // 167
  const roof = GROUND - m(1.45); // 95
  const shoulder = GROUND - m(1.0); // 112
  const sill = GROUND - m(0.55); // 129
  return {
    lower: [[x, sill, L, m(0.42)]] as Rect[],
    upper: [[x + 10, shoulder, L - 27, sill - shoulder]] as Rect[],
    roof: [[x + 34, roof, 90, shoulder - roof + 2]] as Rect[],
    glass: [
      [x + 30, roof + 4, 22, 13],
      [x + 56, roof + 4, 26, 13],
      [x + 86, roof + 4, 20, 13],
      [x + 110, roof + 4, 16, 13],
    ] as Rect[],
    tyre: [
      [x + 22, GROUND - m(0.65), m(0.65), m(0.62)],
      [x + 118, GROUND - m(0.65), m(0.65), m(0.62)],
    ] as Rect[],
    hub: [
      [x + 28, GROUND - m(0.48), m(0.32), m(0.3)],
      [x + 124, GROUND - m(0.48), m(0.32), m(0.3)],
    ] as Rect[],
    lampF: [[x + 1, shoulder + 6, 7, 5]] as Rect[],
    lampR: [[x + L - 8, shoulder + 6, 7, 5]] as Rect[],
  };
}
/** Parked nose-in, so what you walk past is the boot: 1.80 m track, 1.45 m tall. */
function carRear(x: number) {
  const T = m(1.8); // 68
  const roof = GROUND - m(1.45);
  return {
    lower: [[x, GROUND - m(0.8), T, m(0.68)]] as Rect[],
    upper: [[x + 3, GROUND - m(1.2), T - 6, m(0.4)]] as Rect[],
    roof: [[x + 7, roof, T - 14, m(0.26)]] as Rect[],
    glass: [[x + 11, roof + 3, T - 22, 12]] as Rect[],
    lampR: [
      [x + 2, GROUND - m(0.74), 10, 6],
      [x + T - 12, GROUND - m(0.74), 10, 6],
    ] as Rect[],
    plate: [[x + 26, GROUND - m(0.48), 16, 6]] as Rect[],
    bumper: [[x, GROUND - m(0.32), T, 6]] as Rect[],
    tyre: [
      [x, GROUND - m(0.3), 8, 10],
      [x + T - 8, GROUND - m(0.3), 8, 10],
    ] as Rect[],
  };
}

/** Four bays, 2.50 m each, and the cars are batched by part across all of them. */
const BAY_PITCH = m(2.5); // 95
const BAY_X = Z.zdrofit + 26;
const PARKED = Array.from({ length: 4 }, (_, i) => carRear(BAY_X + i * BAY_PITCH + 13));
const BAY_LINES = pxPath(
  Array.from(
    { length: 5 },
    (_, i) => [BAY_X + i * BAY_PITCH, GROUND + 2, 2, KERB - GROUND] as Rect,
  ),
);
const CAR_COLOURS = ["#8a8f96", "#2f3e52", "#7a3a34", "#c9c4b6"] as const;
/** Parts that are the same colour on every car collapse into one path each. */
// @ts-expect-error TS6133 — staged for the parked-cars pass
const _PARKED_SHARED = {
  glass: pxPath(PARKED.flatMap((c) => c.glass)),
  lamps: pxPath(PARKED.flatMap((c) => c.lampR)),
  plate: pxPath(PARKED.flatMap((c) => c.plate)),
  bumper: pxPath(PARKED.flatMap((c) => c.bumper)),
  tyre: pxPath(PARKED.flatMap((c) => c.tyre)),
};

/* --- street furniture, banked --- */
/** Sheffield stands: 0.75 m tall, 1.00 m apart, which is what they actually are. */
const BIKE_STANDS = pxPath(
  bank(
    [
      [0, GROUND - m(0.75), 3, m(0.75)],
      [m(0.7), GROUND - m(0.75), 3, m(0.75)],
      [0, GROUND - m(0.75), m(0.7) + 3, 3],
    ],
    4,
    m(1.0),
  ).map(([x, y, w, h]) => [x + 96, y, w, h] as Rect),
);
/** Bollards: 0.90 m, at 1.50 m centres along the kerb. */
const BOLLARDS = (() => {
  const shape: Rect[] = [[0, GROUND - m(0.9), m(0.16), m(0.9)]];
  const out: Rect[] = [];
  for (const [x0, n] of [
    [Z.aurum + 20, 5],
    [Z.parking + 14, 3],
  ] as const) {
    out.push(...bank(shape, n, m(1.5)).map(([x, y, w, h]) => [x + x0, y, w, h] as Rect));
  }
  return { body: pxPath(out), hi: pxPath(out.map(([x, y, w]) => [x, y, w, 2] as Rect)) };
})();
/** Café chairs and tables, out only when the place is open. */
const CAFE_SET = (() => {
  const table: Rect[] = [
    [0, GROUND - m(0.75), m(0.7), 3],
    [m(0.3), GROUND - m(0.72), 4, m(0.72)],
    [m(0.2), CY, m(0.3), 2],
  ];
  const chair: Rect[] = [
    [0, GROUND - m(0.45), m(0.42), 3],
    [0, GROUND - m(0.45), 3, m(0.45)],
    [m(0.36), GROUND - m(0.45), 3, m(0.45)],
    [m(0.36), GROUND - m(0.85), 4, m(0.4)],
  ];
  const groups: Rect[] = [];
  for (const gx of [292, 400, 496]) {
    groups.push(...shift(table, gx, 0));
    groups.push(...shift(chair, gx - m(0.6), 0));
    groups.push(...shift(chair, gx + m(0.75), 0));
  }
  return pxPath(groups);
})();
/** Planter troughs: 1.20 x 0.50 m, and the hedge in them. */
const TROUGHS = (() => {
  const shape: Rect[] = [[0, GROUND - m(0.5), m(1.2), m(0.5)]];
  const out = bank(shape, 3, m(1.4)).map(([x, y, w, h]) => [x + 528, y, w, h] as Rect);
  return {
    box: pxPath(out),
    hi: pxPath(out.map(([x, y, w]) => [x, y, w, 2] as Rect)),
    hedge: pxPath(out.map(([x, y, w]) => [x + 2, y - m(0.35), w - 4, m(0.35)] as Rect)),
  };
})();

/* --- the static masses, beveled once at module load. Boxes never change; only
 *     the material does, so bevelPaths + <Bev mat={RAMP[ph]}> is the right shape. */
const TOWERS_SET = bevelPaths([TOWER_A, TOWER_B]);
const MASS_CAFE_A = bevelPaths([[Z.stop, 0, Z.cafeA - Z.stop, GROUND]]);
const MASS_AURUM = bevelPaths([[Z.cafeA, 0, Z.aurum - Z.cafeA, GROUND]]);
const MASS_ZDROFIT = bevelPaths([[Z.aurum, 0, Z.zdrofit - Z.aurum, GROUND]]);
const MASS_CAFE_B = bevelPaths([[Z.parking, 0, W - Z.parking, GROUND]]);
const PLINTH_SET = bevelPaths([
  [Z.cafeA, GROUND - m(1.0), Z.aurum - Z.cafeA, m(1.0)],
  [Z.aurum, GROUND - m(1.0), Z.zdrofit - Z.aurum, m(1.0)],
]);
const RETAINING_SET = bevelPaths([[0, 96, 176, GROUND - 96]]);
const SHELTER_SET = bevelPaths([
  [196, GROUND - m(2.5), m(3.2), 4],
  [200, GROUND - m(2.44), 4, m(2.44)],
  [316, GROUND - m(2.44), 4, m(2.44)],
]);
const BINS_SET = bevelPaths([
  [318, GROUND - m(1.0), m(0.4), m(1.0)],
  [336, GROUND - m(1.0), m(0.4), m(1.0)],
]);
const PLOT_WALL_SET = bevelPaths([[Z.zdrofit, GROUND - m(0.6), Z.parking - Z.zdrofit, m(0.6)]]);
const STALLRISER_SET = bevelPaths([
  [262, SILL, 254, GROUND - SILL],
  [1492, SILL, 132, GROUND - SILL],
]);

/* --- shadows: the sun rakes along the pavement, so uprights throw sideways --- */
/** Shadow direction and length per phase, in metres of throw. */
const SUN: Record<Ph, { dx: number; len: number; op: number } | null> = {
  dawn: { dx: 1, len: 3.4, op: 0.3 },
  day: { dx: 0.25, len: 0.7, op: 0.24 },
  dusk: { dx: -1, len: 3.8, op: 0.28 },
  night: null,
};
/** Uprights that cast: bollards, stands, trees, poles, bins. x and width only. */
const CASTERS: readonly (readonly [x: number, w: number])[] = [
  [96, 76],
  [Z.aurum + 20, 60],
  [Z.parking + 14, 40],
  [214, 8],
  [538, 8],
  [1004, 8],
  [1360, 8],
  [1650, 8],
];

/* --- light --- */
/** Street lamps: 5 m columns, so the head is off-frame and only the pool is in it. */
const LAMP_X = [140, 520, 900, 1280, 1660] as const;
const LAMP_POOLS = tiers(
  (k) =>
    LAMP_X.flatMap((x) =>
      steppedEllipse(x, GROUND + 12, Math.round(m(2.4) * k), Math.round(m(0.6) * k), 3),
    ),
  "c",
  0.5,
);
const LAMP_COLUMNS = pxPath(LAMP_X.map((x) => [x - 2, 0, 5, GROUND] as Rect));
/** Warm boxes of light out of the café windows onto the slabs. */
const CAFE_SPILL_A = tiers(
  (k) =>
    steppedQuad(
      SILL,
      270 + (1 - k) * 40,
      508 - (1 - k) * 40,
      KERB + 6,
      258 + (1 - k) * 50,
      520 - (1 - k) * 50,
      8,
    ),
  "w",
  0.7,
);
const CAFE_SPILL_B = tiers(
  (k) =>
    steppedQuad(
      SILL,
      1500 + (1 - k) * 24,
      1616 - (1 - k) * 24,
      KERB + 4,
      1490 + (1 - k) * 30,
      1626 - (1 - k) * 30,
      8,
    ),
  "w",
  0.6,
);
/** The lobby, which nobody turns off, and which is the brightest thing at night. */
const LOBBY_SPILL = tiers(
  (k) =>
    steppedQuad(
      GROUND - m(2.9),
      Z.cafeA + 30 + (1 - k) * 60,
      850 - (1 - k) * 60,
      KERB + 8,
      Z.cafeA + 10 + (1 - k) * 70,
      866 - (1 - k) * 70,
      8,
    ),
  "c",
  0.75,
);
/** And the gym's own unit, when it is open. */
const GYM_SPILL = tiers(
  (k) =>
    steppedQuad(
      GROUND - m(2.9),
      914 + (1 - k) * 30,
      1058 - (1 - k) * 30,
      KERB + 6,
      902 + (1 - k) * 36,
      1070 - (1 - k) * 36,
      8,
    ),
  "w",
  0.6,
);
const VIGNETTE = vignettePaths(W, H);

/* --- occlusion and contact --- */
const STREET_AO = aoPaths([
  [266, SILL, 246], // café A stallriser
  [Z.cafeA + 24, GROUND - 4, 296], // the office glazing meeting the granite
  [908, GROUND - 4, 156],
  [1496, SILL, 124],
  [0, FASCIA_TOP + 6, W], // every fascia drops a line onto its own glazing
  [528, GROUND - m(0.5), 152], // troughs
]);
const STREET_CONTACT = contactPaths([
  [96, 76, CY],
  [292, 240, CY],
  [528, 152, CY],
  [BAY_X, 4 * BAY_PITCH, CY],
  [Z.aurum + 20, 60, CY],
  [1496, 130, CY],
  [206, 20, CY],
  [1352, 22, CY],
]);

/* ================================================================== *
 * PLANE 1 — sky, towers, viaduct (parallax 0.86)
 * ================================================================== */

function Backdrop({ ph, s }: { ph: Ph; s: DistrictState }) {
  const night = ph === "night";
  const bands = K.sky[ph];
  const flat = s.weather === "overcast" || s.weather === "rain";
  return (
    <g>
      <SharedDefs />
      {/* the sky, in four stepped bands. Overcast flattens them toward the middle. */}
      {SKY_BANDS.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static sky bands, never reorder
        <g key={`sb${i}`}>
          {px(r[0] - 80, r[1], r[2] + 200, r[3], bands[i])}
          {flat ? (
            <rect
              x={r[0] - 80}
              y={r[1]}
              width={r[2] + 200}
              height={r[3]}
              fill="#9aa0a8"
              opacity={0.42}
            />
          ) : null}
        </g>
      ))}
      {/* the dithered seam between bands, so they read as a gradient and not stripes */}
      <path
        d={pxPath(SKY_BANDS.slice(1).map((r) => [r[0] - 80, r[1] - 3, r[2] + 200, 6] as Rect))}
        fill={dth("c", "25")}
        opacity={flat ? 0.2 : 0.35}
      />
      {/* the two towers over the car park, cropped by the frame at 3.95 m */}
      <Bev set={TOWERS_SET} mat={CLAD[ph]} />
      <path d={TOWER_GLAZING} fill={K.glass[ph]} />
      {night ? <path d={TOWER_LIT} fill={K.lobbyLit} opacity={0.85} /> : null}
      <path d={TOWER_GRID.vert} fill={CLAD[ph].lo} />
      <path d={TOWER_GRID.horiz} fill={CLAD[ph].mid} />
      {/* their names, small, high up, the way they actually are */}
      <BigText x={1132} y={104} text={NAME_OFFICE} fill={K.white} k={1} op={0.55} />
      <BigText x={1312} y={92} text={NAME_OFFICE2} fill={K.white} k={1} op={0.5} />
      {/* the crane on the next plot, with its light on at night */}
      <path d={CRANE} fill={night ? "#3a3f46" : "#e8c445"} opacity={0.9} />
      {night ? (
        <path d={pxPath([[1519, 0, 3, 3]])} fill={K.red}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;1;0;0"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the SKM viaduct at the stop end, and its concrete pier */}
      <path d={VIADUCT.deck} fill={GRANITE[ph].base} />
      <path d={VIADUCT.soffit} fill={GRANITE[ph].deep} />
      <path d={VIADUCT.balustrade} fill={COAT[ph].base} />
      <path d={VIADUCT.pier} fill={GRANITE[ph].mid} />
      {/* a train across it, twice an hour, and you only see the windows */}
      <g>
        <path d={pxPath([[0, 26, 190, 14]])} fill={night ? "#2a3038" : "#c9c4b6"} />
        <path d={pxPath([[0, 26, 190, 2]])} fill={night ? "#3a4048" : "#dcd7c9"} />
        <path
          d={pxPath(repeat(9, 21, [6, 30, 14, 7] as Rect))}
          fill={night ? K.glassLit : "#5f7280"}
        />
        <path d={pxPath([[0, 36, 190, 2]])} fill={K.brandLo} opacity={0.7} />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-210 0;-210 0;280 0;280 0"
          keyTimes="0;0.46;0.64;1"
          dur="44s"
          repeatCount="indefinite"
        />
      </g>
      {/* gulls. This is the coast, and they know where the bins are. */}
      {!flat ? (
        <g>
          <path
            d={pxPath([
              [420, 18, 5, 1],
              [424, 17, 4, 1],
              [560, 30, 4, 1],
              [563, 29, 4, 1],
              [700, 12, 5, 1],
            ])}
            fill={K.gullDark}
            opacity={0.7}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;40 -8;90 4;150 -6;210 2"
              dur="21s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the facades
 * ================================================================== */

function Facades({
  ph,
  s,
  gym,
  world,
}: {
  ph: Ph;
  s: DistrictState;
  gym: GymFront;
  world: WorldState;
}) {
  return (
    <g>
      {/* --- the back of the pavement, from the stop to the crossing ------ */}
      <StopEnd ph={ph} s={s} />
      <CafeA ph={ph} s={s} roasting={isRoasting(world, s, ph)} />
      <Aurum ph={ph} s={s} />
      <ZdrofitFront ph={ph} s={s} gym={gym} />
      <ParkingPlot ph={ph} s={s} />
      <CafeB ph={ph} s={s} />
    </g>
  );
}

function StopEnd({ ph, s }: { ph: Ph; s: DistrictState }) {
  // @ts-expect-error TS6133 — staged for the rain pass
  const _wet = isWet(s);
  return (
    <g>
      {/* the retaining wall the viaduct steps come down to */}
      <Bev set={RETAINING_SET} mat={GRANITE[ph]} />
      <rect x={0} y={96} width={176} height={GROUND - 96} fill="url(#px-agg)" />
      {/* the steps down from the platform: 175 mm rise, 280 mm going */}
      <path
        d={pxPath(
          Array.from(
            { length: 7 },
            (_, i) => [10 + i * m(0.28), GROUND - m(0.175) * (7 - i), m(0.28) + 1, 3] as Rect,
          ),
        )}
        fill={GRANITE[ph].hi}
      />
      {/* graffiti on the wall, painted over once and coming back through */}
      <path
        d={pxPath([
          [24, 112, 30, 3],
          [30, 115, 3, 10],
          [48, 115, 3, 8],
          [60, 118, 18, 3],
        ])}
        fill={ph === "night" ? "#2a3040" : "#4a5a7a"}
        opacity={0.5}
      />
      {px(20, 108, 64, 22, GRANITE[ph].hi)}
      <rect x={20} y={108} width={64} height={22} fill="url(#px-grain)" opacity={0.7} />
      {/* the tram shelter: 2.50 m to the underside of the canopy */}
      <Bev set={SHELTER_SET} mat={COAT[ph]} />
      <rect x={204} y={GROUND - m(2.3)} width={112} height={m(1.9)} fill="#c2d6da" opacity={0.24} />
      <path d={pxPath([[204, GROUND - m(2.3), 112, 2]])} fill={CHROME[ph].lo} />
      {/* the bench inside it, and the timetable case */}
      <path
        d={pxPath([
          [214, GROUND - m(0.45), m(2.2), 4],
          [216, GROUND - m(0.42), 4, m(0.42)],
          [292, GROUND - m(0.42), 4, m(0.42)],
        ])}
        fill={OAK[ph].base}
      />
      <Bevel boxes={[[224, GROUND - m(1.9), m(0.9), m(0.7)]]} mat={COAT[ph]} />
      {px(227, GROUND - m(1.85), m(0.8), m(0.6), K.white)}
      <PixelText x={230} y={GROUND - m(1.8)} text="9 10" fill={COAT[ph].base} gap={1} op={0.7} />
      <path
        d={pxPath(repeat(7, 4, [230, GROUND - m(1.62), 22, 1] as Rect, "y"))}
        fill={COAT[ph].mid}
        opacity={0.4}
      />
      {/* the ticket machine, 1.40 m, with its screen and its card reader */}
      <Bevel boxes={[[266, GROUND - m(1.4), m(0.5), m(1.4)]]} mat={COAT[ph]} />
      {px(269, GROUND - m(1.32), m(0.36), m(0.28), ph === "night" ? K.lobbyLit : K.glass[ph])}
      <path d={pxPath([[270, GROUND - m(0.92), 8, 4]])} fill={K.green} />
      {/* the e-scooters somebody has left across the tactile paving */}
      {s.crowd >= 1 ? (
        <g>
          <path
            d={pxPath([
              [110, GROUND - m(1.05), 3, m(1.0)],
              [104, GROUND - m(1.1), m(0.4), 3],
              [110, GROUND - m(0.1), m(0.9), 3],
              [140, GROUND - m(0.24), m(0.24), m(0.24)],
            ])}
            fill={COAT[ph].base}
          />
          <path d={pxPath([[104, GROUND - m(1.1), m(0.4), 1]])} fill={K.brand} />
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * PALARNIA ORBITA — replacement block for district.tsx
 *
 * Your coordinate frame, unchanged: unit 250..560, fascia 258..518, glazing
 * 266..512, stallriser 262..516, door 476..512. `MASS_CAFE_A`, `GLAZE_CAFE_A` and
 * `STALLRISER_SET` are untouched, so this drops in. Every x derives from the eight
 * constants in `CAX`.
 *
 * SCOPE, STATED UP FRONT. This is the *shopfront* only — the fascia, the awning,
 * the flue, the glazing furniture, the door and the stallriser. `CafeAInterior`
 * already draws the counter, the machine, the grinder, the retail shelf, the menu
 * board and the person at the window table, so nothing here reaches behind the
 * glass. That is deliberate: the corridor block taught me what happens when you
 * assume a component is barer than it is and end up drawing a second spyhole on a
 * door that already had one.
 *
 * SIX DEFECTS.
 *
 *   A  THE CLOSED SHUTTER CLOSES THE LEFT THIRD OF THE WINDOW. `repeat(26, 3, …)`
 *      is 26 slats at a 3 px pitch — 77 px of shutter over a 246 px window. Shut
 *      the café and two thirds of the glazing is still wide open. It takes 82.
 *   B  The stallriser tiles run 13 px past the stallriser: 24 at a pitch of 11
 *      from x266 ends at 529, and the stallriser ends at 516.
 *   C  The awning valance hangs 7 px past the awning bar — 14 scallops to 525
 *      against a fascia ending at 518.
 *   D  The door is a filled `<Bevel>` box with 85 %-opaque glass over it, so the
 *      frame colour shows through the glazing. Fourth time: klatka, blok16,
 *      Zdrofit, here. A glazed door is rails round a hole.
 *   E  The opening hours are at 0.71 m, on the stallriser, at knee height. Nobody
 *      has ever read them. They belong on the door glass at eye level.
 *   F  The flue at 256..267 overlaps the glazing's left edge and, being drawn
 *      last, cuts across the fascia band. It has moved to the party wall on the
 *      right, which is where a roastery flue actually runs.
 *
 * Every height was already right — fascia 3.61 m, glazing head 3.00 m,
 * stallriser 0.89 m, door head 2.11 m. Only the handle moved, from 0.92 m to
 * 1.07 m.
 *
 * WHAT MAKES IT A PALARNIA AND NOT A CAFÉ. A roastery has one thing no café has,
 * and it was drawn as an afterthought: **the flue**. So it is now the feature. It
 * runs up the party wall with its brackets, a chaff duct beside it, and the soot
 * it has printed on the sandstone since it went in — and on a `roasting` day the
 * haze drifts across the top of the frame, which is the only way to draw a smell.
 *
 * The other thing a specialty place has is **gooseneck spot lamps** on the fascia
 * rather than a backlit box. Three of them, and after dark they throw three
 * stepped cones down onto the sign, which is the light that says third-wave
 * rather than chain.
 *
 * PLUS: bird spikes and the droppings that prove they went on late; the awning's
 * winding crank down the pier and its folding arms; a round sign hanging off the
 * awning's front edge; a frosted privacy band along the bottom of the glazing;
 * condensation above it when it is cold, because a roastery is warm; the cellar
 * vent and the hose bib in the stallriser; the scuffs where chairs are dragged in
 * every evening; a chipped tile; the address stencilled on; a bay tree in a
 * planter by the door; and on the door itself a closer, a shop bell on a spring,
 * a letterbox, a kick plate and the smear at exactly the height of a hand.
 *
 * ONE NEW READ. `roasting`, off `world.district`, defaulting to a weekday
 * daytime — the fascia even says PALIMY W CZWARTKI, so the building tells you
 * when. It drives the plume, the flue's warm tint and the haze.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * state
 * -------------------------------------------------------------------- */

/**
 * Whether the drum is on. Read defensively; the default is a daytime roast while
 * the place is open, which is what the fascia advertises.
 */
function isRoasting(world: WorldState, s: DistrictState, ph: Ph): boolean {
  const d = ((world as unknown as Record<string, unknown>).district ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof d.roasting === "boolean") return d.roasting;
  return s.cafeA !== "closed" && (ph === "day" || ph === "dawn");
}

/* -------------------------------------------------------------------- *
 * palette
 * -------------------------------------------------------------------- */

const CA = {
  green: "#2f5c48",
  greenHi: "#3f7a5e",
  greenLo: "#1e4033",
  greenDeep: "#142c23",
  cream: "#f0e6d2",
  creamLo: "#d8cdb6",
  /** the tile on the stallriser, and the one that has been chipped for years */
  tile: "#4a6b5c",
  tileNight: "#2a3a34",
  tileHi: "#5d8070",
  tileChip: "#8a8578",
  /** the awning: canvas, its valance, and the bar it rolls on */
  canvas: "#2f5c48",
  canvasAlt: "#f0e6d2",
  canvasLo: "#1e4033",
  arm: "#b0b5ba",
  crank: "#9aa0a8",
  /** the gooseneck spots, which are what a specialty fascia has instead of a box */
  goose: "#2b2e32",
  gooseShade: "#3d4147",
  gooseLamp: "#ffe6b0",
  /** the flue, the chaff duct, and what they have done to the sandstone */
  flue: "#b0b5ba",
  flueHi: "#c8ccd2",
  flueBracket: "#74797e",
  chaff: "#8a8f96",
  soot: "#4a4038",
  /** the glass: frosted at the bottom, fogged above it when it is cold */
  frost: "#dfe8e4",
  fog: "#cfe0e6",
  /** the door */
  bell: "#c9a24b",
  bellSpring: "#8a8f96",
  letterbox: "#8a8f96",
  kick: "#b0b5ba",
  /** the hanging sign, the planter, the spikes */
  signFace: "#f0e6d2",
  signRim: "#1e4033",
  planter: "#8d8478",
  planterHi: "#9a9184",
  bay: "#3d573d",
  bayHi: "#4a6b4a",
  trunk: "#6b5540",
  spike: "#8a8f96",
  dropping: "#e4e6e0",
  neon: "#ff7a4a",
} as const;

/* -------------------------------------------------------------------- *
 * geometry — eight constants, everything derives from them
 * -------------------------------------------------------------------- */

const CAX = {
  unit0: 250,
  unit1: 560,
  fascia0: 258,
  fascia1: 518,
  glass0: 266,
  glass1: 512,
  door0: 476,
  door1: 512,
} as const;
const CA_FW = CAX.fascia1 - CAX.fascia0; // 260
const CA_GW = CAX.glass1 - CAX.glass0; // 246

/* --- the fascia --- */
const CA_BAND = pxPath([[CAX.fascia0, FASCIA_TOP, CA_FW, SHOP_HEAD - FASCIA_TOP]]);
const CA_BAND_HI = pxPath([[CAX.fascia0, FASCIA_TOP, CA_FW, 2]]);
const CA_BAND_LO = pxPath([[CAX.fascia0, SHOP_HEAD - 2, CA_FW, 2]]);
const CA_BOLTS = pxPath(repeat(15, 17, [CAX.fascia0 + 6, SHOP_HEAD - 5, 2, 2] as Rect));
const CA_SPIKES = pxPath(repeat(43, 6, [CAX.fascia0, FASCIA_TOP - 3, 1, 3] as Rect));
const CA_DROPPINGS = pxPath([
  [302, FASCIA_TOP, 2, 8],
  [388, FASCIA_TOP, 1, 5],
  [462, FASCIA_TOP, 2, 11],
]);

/* --- three gooseneck spots, which is what a specialty fascia has --- */
const CA_GOOSE_X = [300, 370, 440] as const;
const CA_GOOSE_ARMS = pxPath(
  CA_GOOSE_X.flatMap(
    (x) =>
      [
        [x, 6, 2, 8],
        [x, 5, 6, 2],
      ] as Rect[],
  ),
);
const CA_GOOSE_SHADES = pxPath(CA_GOOSE_X.map((x) => [x + 4, 4, 9, 4] as Rect));
const CA_GOOSE_LAMPS = pxPath(CA_GOOSE_X.map((x) => [x + 6, 8, 5, 1] as Rect));

/* --- the awning: valance sized to the bar this time --- */
const CA_AWN_BAR = pxPath([[CAX.fascia0, SHOP_HEAD - 6, CA_FW, 4]]);
const CA_AWN_LIP = pxPath([[CAX.fascia0, SHOP_HEAD + 6, CA_FW, 2]]);
/** Pitch 20 x 13 from x259 lands the last scallop at 517, one inside the bar. */
const CA_AWN_SCALLOPS = pxPath(
  Array.from({ length: 13 }, (_, i) => [259 + i * 20, SHOP_HEAD - 2, 18, 8] as Rect),
);
const CA_AWN_STRIPES = pxPath(
  Array.from({ length: 13 }, (_, i) => [268 + i * 20, SHOP_HEAD - 2, 9, 8] as Rect),
);
/** The folding arms, visible under it when it is out. */
const CA_AWN_ARMS = pxPath([
  [286, SHOP_HEAD - 4, 2, 10],
  [488, SHOP_HEAD - 4, 2, 10],
]);
/** And the winding crank hanging down the pier, which is how it gets out. */
const CA_AWN_CRANK = pxPath([
  [520, SHOP_HEAD - 4, 3, 30],
  [519, SHOP_HEAD + 26, 5, 3],
]);
/** The rolled bundle, when it is wet or shut. */
const CA_AWN_ROLLED = pxPath([[CAX.fascia0, SHOP_HEAD - 7, CA_FW, 6]]);

/* --- the round sign hanging off the awning's front edge --- */
const CA_HANGSIGN_CHAIN = pxPath([
  [462, SHOP_HEAD + 8, 1, 6],
  [470, SHOP_HEAD + 8, 1, 6],
]);
const CA_HANGSIGN = bevelPaths([[456, SHOP_HEAD + 14, 20, 14]]);
const CA_HANGSIGN_FACE = pxPath([[458, SHOP_HEAD + 16, 16, 10]]);

/* --- the stallriser: tiles that stop where it stops --- */
/** 22 at a pitch of 11 from x266 ends at 507, inside the stallriser's 516. */
const CA_TILES = pxPath(
  Array.from({ length: 22 }, (_, i) => [266 + i * 11, SILL + 3, 10, 10] as Rect),
);
const CA_TILES_HI = pxPath(
  Array.from({ length: 22 }, (_, i) => [266 + i * 11, SILL + 3, 10, 2] as Rect),
);
const CA_TILES_ROW2 = pxPath(
  Array.from({ length: 22 }, (_, i) => [266 + i * 11, SILL + 15, 10, 10] as Rect),
);
/** The one that has been chipped since before anybody worked here. */
const CA_TILE_CHIP = pxPath([
  [365, SILL + 3, 5, 4],
  [365, SILL + 7, 3, 3],
]);
/** The cellar vent, and the hose bib the pavement gets washed with. */
const CA_VENT = pxPath([[280, 138, 20, 10]]);
const CA_VENT_FINS = pxPath(repeat(4, 5, [283, 140, 14, 1] as Rect, "y"));
const CA_BIB = pxPath([
  [466, 128, 8, 4],
  [469, 132, 3, 5],
]);
/** The scuffs where the chairs are dragged in every evening. */
const CA_SCUFFS = pxPath([
  [292, 128, 26, 2],
  [396, 130, 20, 2],
  [440, 128, 18, 2],
]);

/* --- the glass: a frosted privacy band, and the fog above it --- */
const CA_FROST = pxPath([[CAX.glass0 + 2, 102, CAX.door0 - CAX.glass0 - 4, 14]]);
const CA_FROST_EDGE = pxPath([[CAX.glass0 + 2, 102, CAX.door0 - CAX.glass0 - 4, 1]]);
const CA_FOG = pxPath([[CAX.glass0 + 2, 86, CAX.door0 - CAX.glass0 - 4, 16]]);

/* --- the door: rails round a hole --- */
const CA_DOOR_RAILS = pxPath([
  [CAX.door0, DOOR_HEAD, CAX.door1 - CAX.door0, 4],
  [CAX.door0, 142, CAX.door1 - CAX.door0, 8],
  [CAX.door0, DOOR_HEAD, 3, GROUND - DOOR_HEAD],
  [CAX.door1 - 3, DOOR_HEAD, 3, GROUND - DOOR_HEAD],
]);
const CA_DOOR_RAILS_HI = pxPath([
  [CAX.door0, DOOR_HEAD, CAX.door1 - CAX.door0, 1],
  [CAX.door0, DOOR_HEAD, 1, GROUND - DOOR_HEAD],
]);
const CA_DOOR_PANE = pxPath([
  [CAX.door0 + 3, DOOR_HEAD + 4, CAX.door1 - CAX.door0 - 6, 138 - DOOR_HEAD],
]);
const CA_DOOR_CLOSER = pxPath([
  [480, DOOR_HEAD + 5, 22, 3],
  [500, DOOR_HEAD + 6, 5, 2],
]);
/** A shop bell on a spring, which is the sound of the door and cannot be drawn. */
const CA_BELL_SPRING = pxPath([[492, DOOR_HEAD + 8, 1, 5]]);
const CA_BELL = pxPath([
  [490, DOOR_HEAD + 13, 5, 4],
  [491, DOOR_HEAD + 17, 3, 1],
]);
const CA_HANDLE = pxPath([[502, GROUND - m(1.2), 3, m(0.3)]]);
const CA_HANDLE_HI = pxPath([[502, GROUND - m(1.2), 3, 2]]);
const CA_SMEAR = pxPath([[494, GROUND - m(1.18), 7, 9]]);
const CA_LETTERBOX = pxPath([[484, GROUND - m(0.95), 16, 3]]);
const CA_KICK = pxPath([[CAX.door0 + 4, 142, CAX.door1 - CAX.door0 - 8, 7]]);
const CA_MAT = pxPath([[CAX.door0, 146, CAX.door1 - CAX.door0, 4]]);

/* --- the shutter, sized to the window it is meant to close --- */
const CA_SHUT_N = Math.floor((CA_GW - 2) / 3) + 1; // 82
const CA_SHUTTER = pxPath(
  Array.from(
    { length: CA_SHUT_N },
    (_, i) => [CAX.glass0 + i * 3, SHOP_HEAD, 2, GROUND - SHOP_HEAD] as Rect,
  ),
);
const CA_SHUTTER_RAILS = pxPath([
  [CAX.glass0, SHOP_HEAD + 20, CA_GW, 2],
  [CAX.glass0, SHOP_HEAD + 50, CA_GW, 2],
  [CAX.glass0, SHOP_HEAD + 80, CA_GW, 2],
]);
const CA_SHUTTER_BOX = pxPath([[262, SHOP_HEAD - 4, 254, 5]]);
const CA_PADLOCK = pxPath([
  [386, 142, 8, 7],
  [388, 138, 4, 5],
]);

/* --- the flue, on the party wall where it belongs --- */
const CA_FLUE = pxPath([[540, 0, m(0.3), 116]]);
const CA_FLUE_HI = pxPath([[540, 0, 3, 116]]);
const CA_FLUE_BRACKETS = pxPath([
  [537, 30, 17, 3],
  [537, 80, 17, 3],
]);
/** The chaff duct beside it, fatter and matt, which is the other half of a roaster. */
const CA_CHAFF = pxPath([[527, 0, 10, 72]]);
const CA_CHAFF_SEAMS = pxPath(repeat(3, 24, [527, 18, 10, 2] as Rect, "y"));
/** And what the two of them have printed on the sandstone since they went in. */
const CA_SOOT = pxPath([
  [534, 4, 22, 34],
  [538, 38, 14, 22],
]);

/* --- a bay tree in a planter by the door --- */
const CA_PLANTER = bevelPaths([[518, 122, 20, 28]]);
const CA_PLANTER_RIM = pxPath([[518, 122, 20, 3]]);
const CA_BAY_TRUNK = pxPath([[526, 100, 3, 24]]);
const CA_BAY = pxPath([
  [518, 84, 20, 18],
  [522, 78, 12, 8],
]);
const CA_BAY_HI = pxPath([
  [518, 84, 20, 3],
  [522, 78, 12, 3],
]);

/* --- light: the spots, the window, the hanging sign, the roast haze --- */
const CA_LIGHT_SPOTS = tiers(
  (k) =>
    CA_GOOSE_X.flatMap((x) =>
      steppedQuad(9, x + 6 - 2 * k, x + 11 + 2 * k, SHOP_HEAD, x - 14 * k, x + 26 * k, 4),
    ),
  "w",
  0.6,
);
const CA_LIGHT_WINDOW = tiers(
  (k) =>
    steppedQuad(
      SILL,
      CAX.glass0 + (1 - k) * 40,
      CAX.glass1 - (1 - k) * 40,
      GROUND + 16,
      CAX.glass0 - 30,
      CAX.glass1 + 30,
      8,
    ),
  "w",
  0.75,
);
const CA_LIGHT_SIGN = tiers(
  (k) => steppedEllipse(466, SHOP_HEAD + 21, Math.round(20 * k), Math.round(16 * k), 2),
  "w",
  0.35,
);
/** The haze off the flue, drifting across the top of frame. The only way to draw a smell. */
const CA_HAZE = pxPath([
  [520, 2, 36, 8],
  [512, 8, 26, 5],
]);

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

/**
 * Palarnia Orbita. A green band, a window somebody has frosted the bottom of, and
 * a flue up the party wall that is the whole reason the place is called a
 * roastery rather than a café.
 */
function CafeA({ ph, s, roasting }: { ph: Ph; s: DistrictState; roasting: boolean }) {
  const open = s.cafeA !== "closed";
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const lit = lampsOn(s, ph);
  const wet = isWet(s);
  const snow = isSnow(s);
  const awningOut = open && !wet && !snow;
  /** Warm inside, cold out. A roastery fogs its own window. */
  const fogged = open && (snow || (wet && (ph === "dawn" || dark)));
  return (
    <g>
      {/* ---- precast sandstone, and what the flue has done to it ----------- */}
      <Bev set={MASS_CAFE_A} mat={STONE[ph]} />
      <rect
        x={CAX.unit0}
        y={0}
        width={CAX.unit1 - CAX.unit0}
        height={GROUND}
        fill="url(#px-stucco)"
      />
      <path d={CA_SOOT} fill={CA.soot} opacity={0.28} />

      {/* ---- the flue and the chaff duct, up the party wall ---------------- */}
      <path d={CA_CHAFF} fill={CA.chaff} />
      <path d={CA_CHAFF_SEAMS} fill={CA.flueBracket} opacity={0.7} />
      <path d={CA_FLUE} fill={roasting ? "#c4c0b4" : CA.flue} />
      <path d={CA_FLUE_HI} fill={CA.flueHi} />
      <path d={CA_FLUE_BRACKETS} fill={CA.flueBracket} />

      {/* ---- the fascia --------------------------------------------------- */}
      <path d={CA_BAND} fill={CA.green} />
      <path d={CA_BAND_HI} fill={CA.greenHi} />
      <path d={CA_BAND_LO} fill={CA.greenLo} />
      <BigText x={276} y={FASCIA_TOP + 4} text={NAME_CAFE_A} fill={CA.cream} k={2} />
      <BigText x={432} y={FASCIA_TOP + 7} text={NAME_CAFE_A2} fill={CA.cream} k={1} op={0.8} />
      {/* the fascia tells you when they roast, and the plume above agrees with it */}
      <PixelText
        x={276}
        y={FASCIA_TOP + 16}
        text="PALIMY W CZWARTKI"
        fill={CA.creamLo}
        gap={0}
        op={0.75}
      />
      <path d={CA_BOLTS} fill={CA.greenDeep} opacity={0.6} />
      <path d={CA_SPIKES} fill={CA.spike} opacity={0.7} />
      <path d={CA_DROPPINGS} fill={CA.dropping} opacity={0.4} />
      {snow ? <path d={pxPath([[CAX.fascia0, FASCIA_TOP - 1, CA_FW, 2]])} fill={K.snow} /> : null}

      {/* ---- three gooseneck spots, not a backlit box ---------------------- */}
      <path d={CA_GOOSE_ARMS} fill={CA.goose} />
      <path d={CA_GOOSE_SHADES} fill={CA.gooseShade} />
      <path
        d={CA_GOOSE_LAMPS}
        fill={lit ? CA.gooseLamp : "#8a8578"}
        style={{ transition: STEP_FADE }}
      />

      {/* ---- the stallriser, tiled to its own end this time ---------------- */}
      <Bev set={STALLRISER_SET} mat={GRANITE[ph]} />
      <path d={CA_TILES} fill={night ? CA.tileNight : CA.tile} />
      <path d={CA_TILES_ROW2} fill={night ? CA.tileNight : CA.tile} />
      <path d={CA_TILES_HI} fill={night ? "#33463f" : CA.tileHi} />
      <path d={CA_TILE_CHIP} fill={CA.tileChip} />
      <path d={CA_SCUFFS} fill={GRANITE[ph].deep} opacity={0.5} />
      <path d={CA_VENT} fill="#2a2f2c" />
      <path d={CA_VENT_FINS} fill={GRANITE[ph].hi} opacity={0.5} />
      <path d={CA_BIB} fill={CHROME[ph].base} />

      {/* ---- the glazing, and the interior which is drawn elsewhere -------- */}
      <path d={GLAZE_CAFE_A.glass} fill={open ? K.glassLit : K.glass[ph]} />
      <CafeAInterior ph={ph} s={s} />
      {/* the frosted privacy band along the bottom, which every café has */}
      <path d={CA_FROST} fill={CA.frost} opacity={0.62} />
      <path d={CA_FROST_EDGE} fill={CA.frost} opacity={0.85} />
      {/* and the fog above it, because it is warm in there */}
      {fogged ? (
        <g>
          <path d={CA_FOG} fill={dth("c", "50")} opacity={0.5} />
          <path d={pxPath([[380, 88, 1, 3]])} fill={CA.fog} opacity={0.8}>
            <animate attributeName="y" values="88;114" dur="5.8s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.8;0.8;0"
              keyTimes="0;0.85;1"
              dur="5.8s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      <path d={GLAZE_CAFE_A.mullion} fill={COAT[ph].base} />
      <path d={GLAZE_CAFE_A.head} fill={COAT[ph].mid} />

      {/* ---- the door: rails round a hole --------------------------------- */}
      <path d={CA_DOOR_PANE} fill={open ? K.glassLit : K.glass[ph]} opacity={0.6} />
      <path d={CA_DOOR_RAILS} fill={COAT[ph].base} />
      <path d={CA_DOOR_RAILS_HI} fill={COAT[ph].hi} />
      <path d={CA_DOOR_CLOSER} fill={CHROME[ph].lo} />
      {/* the shop bell on its spring, which is the sound of the place */}
      <path d={CA_BELL_SPRING} fill={CA.bellSpring} />
      <path d={CA_BELL} fill={CA.bell} />
      <path d={CA_LETTERBOX} fill={CA.letterbox} />
      <path d={CA_KICK} fill={CA.kick} />
      <path d={CA_HANDLE} fill={CHROME[ph].hi} />
      <path d={CA_HANDLE_HI} fill="#f2f6fa" />
      {/* the smear at exactly the height of a hand */}
      <path d={CA_SMEAR} fill="#ffffff" opacity={0.07} />
      <path d={CA_MAT} fill="#3a3d43" />
      {/* the hours, at eye level on the glass, where they can be read */}
      <PixelText x={486} y={GROUND - m(1.55)} text="7-19" fill={CA.cream} gap={1} op={0.85} />

      {/* ---- open: the sign in the door and the awning out ---------------- */}
      {open ? (
        <g>
          <path d={pxPath([[478, DOOR_HEAD + 8, 26, 9]])} fill={CA.neon} opacity={0.12} />
          <PixelText x={480} y={DOOR_HEAD + 10} text="OPEN" fill={CA.neon} gap={1} />
          {/* one tube in it has always been on the way out */}
          {dark ? (
            <path d={pxPath([[478, DOOR_HEAD + 8, 26, 9]])} fill={CA.neon} opacity={0.2}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.2;0.2;0.06;0.2;0.2;0.2;0.1;0.2"
                dur="6.1s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
        </g>
      ) : (
        /* ---- shut: the shutter, all 246 px of window this time ---------- */
        <g>
          <path d={CA_SHUTTER} fill={CHROME[ph].lo} />
          <path d={CA_SHUTTER_RAILS} fill={CHROME[ph].deep} />
          <path d={CA_SHUTTER_BOX} fill={CHROME[ph].deep} />
          <path d={pxPath([[262, SHOP_HEAD - 4, 254, 1]])} fill={CHROME[ph].base} />
          <path d={CA_PADLOCK} fill="#2e3033" />
          <path d={pxPath([[388, 138, 4, 2]])} fill={CHROME[ph].base} />
          {/* the light they leave on over the machine, through the slats */}
          <path d={CA_SHUTTER_RAILS} fill={K.glassLit} opacity={0.08} />
        </g>
      )}

      {/* ---- the awning: valance sized to its own bar --------------------- */}
      {awningOut ? (
        <g>
          <path d={CA_AWN_BAR} fill={CA.canvas} />
          <path d={CA_AWN_ARMS} fill={CA.arm} />
          <path d={CA_AWN_SCALLOPS} fill={CA.canvas} />
          <path d={CA_AWN_STRIPES} fill={CA.canvasAlt} />
          <path d={CA_AWN_LIP} fill={CA.canvasLo} />
          {snow ? (
            <path d={pxPath([[CAX.fascia0, SHOP_HEAD - 7, CA_FW, 2]])} fill={K.snow} />
          ) : null}
        </g>
      ) : (
        <path d={CA_AWN_ROLLED} fill={CA.canvas} />
      )}
      {/* the crank hangs down the pier whether the awning is out or not */}
      <path d={CA_AWN_CRANK} fill={CA.crank} />
      {/* the round sign hanging off the front edge, when it is out */}
      {awningOut ? (
        <g>
          <path d={CA_HANGSIGN_CHAIN} fill={CA.bellSpring} />
          <Bev set={CA_HANGSIGN} mat={{ ...COAT[ph], base: CA.signRim, hi: CA.greenHi }} />
          <path d={CA_HANGSIGN_FACE} fill={CA.signFace} />
          <PixelText x={460} y={SHOP_HEAD + 18} text="KAWA" fill={CA.greenLo} gap={0} op={0.9} />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 466 ${SHOP_HEAD + 14};1.2 466 ${SHOP_HEAD + 14};-0.9 466 ${SHOP_HEAD + 14};0 466 ${SHOP_HEAD + 14}`}
            dur="8.3s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}

      {/* ---- a bay tree by the door -------------------------------------- */}
      <Bev
        set={CA_PLANTER}
        mat={{
          hi: CA.planterHi,
          base: CA.planter,
          mid: CA.planter,
          lo: "#7a7268",
          deep: "#625b53",
        }}
      />
      <path d={CA_PLANTER_RIM} fill={CA.planterHi} />
      <path d={CA_BAY_TRUNK} fill={CA.trunk} />
      <path d={CA_BAY} fill={s.season === "bare" ? "#5d5442" : CA.bay} />
      <path d={CA_BAY_HI} fill={s.season === "bare" ? "#6d6450" : CA.bayHi} />
      {snow ? <path d={CA_BAY_HI} fill={K.snow} opacity={0.85} /> : null}

      {/* ---- and the haze, on a day the drum is on ------------------------ */}
      {roasting ? (
        <g>
          <path d={CA_HAZE} fill={dth("c", "25")} opacity={0.32}>
            <animate
              attributeName="opacity"
              values="0.32;0.14;0.28;0.16;0.32"
              dur="13s"
              repeatCount="indefinite"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-18 -4;-40 2;-60 -3;-80 0"
              dur="26s"
              repeatCount="indefinite"
            />
          </path>
          {/* the flue runs warm, which is the only tell at street level */}
          <path d={pxPath([[540, 0, m(0.3), 40]])} fill="#e8c9a0" opacity={0.18} />
        </g>
      ) : null}

      {/* ---- the roastery's light, once the lamps call it evening: gooseneck
          spots down the fascia, the window's warm box on the slabs, and the
          hanging sign's small halo */}
      {lit && open ? (
        <g>
          <Light set={CA_LIGHT_SPOTS} />
          <Light set={CA_LIGHT_WINDOW} />
          <Light set={CA_LIGHT_SIGN} />
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * WHAT TO CHANGE OUTSIDE THIS BLOCK
 *
 * 1. PASS `roasting` IN. In `Facades`, where CafeA is called:
 *
 *        <CafeA ph={ph} s={s} roasting={isRoasting(world, s, ph)} />
 *
 *    `Facades` needs `world` threading through if it does not already have it —
 *    it is in `DistrictScene`, so it is one extra prop. (If you took the Zdrofit
 *    block, `Facades` already takes `world` for `gymFront`.)
 *
 * 2. JOIN THE NEW READ in `districtArtKey`, after `s.cafeA`:
 *
 *        isRoasting(w, state(w), toPhase(ph)) ? 1 : 0,
 *
 *    or, simpler, join `world.district.roasting` directly. Without it the plume
 *    freezes on whatever it was when the frame was memoised.
 *
 * 3. THE LIGHT, in `DistrictEffects`, beside the other spills:
 *
 *        {lit ? <Light set={CA_LIGHT_SPOTS} op={dark ? 1 : 0.2} /> : null}
 *        {s.cafeA !== "closed" ? <Light set={CA_LIGHT_WINDOW} op={dark ? 1 : 0.3} /> : null}
 *        {lit && s.cafeA !== "closed" ? <Light set={CA_LIGHT_SIGN} op={dark ? 1 : 0.15} /> : null}
 *
 *    These replace whatever single `SPILL_CAFE_A` you have — there are three
 *    sources on this frontage, not one.
 *
 * 4. NOTHING ELSE MOVES. `MASS_CAFE_A`, `GLAZE_CAFE_A` and `STALLRISER_SET` are
 *    unchanged; so are `cafe-orbita-window`, `cafe-orbita-hours` and
 *    `cafe-orbita-door`. `CafeAInterior` is untouched and still called in the same
 *    place, between the glazing and the mullions.
 *
 * 5. ONE THING OUTSIDE THIS COMPONENT, WORTH KNOWING. `StopEnd` draws the tram
 *    shelter canopy at 196..318, which crosses into the café's zone — the café
 *    starts at 250 — by 68 px. `CafeA` is drawn after `StopEnd`, so the café's
 *    sandstone cuts the shelter's right-hand third off. Either pull the shelter
 *    back to end at 248, or accept that the café was built up against it, in
 *    which case the shelter wants a visible upstand where the two meet rather
 *    than just vanishing.
 *
 * GEOMETRY, FOR THE RECORD. Unit 250..560, fascia 258..518, glazing 266..512,
 * stallriser 262..516, door 476..512 — your frame. Shutter 82 slats covering
 * 266..509. Tiles 22 at pitch 11, ending 507. Valance 13 scallops at pitch 20,
 * ending 517. Flue on the party wall at 540..551, chaff duct 527..537. Handle
 * centre 1.07 m, hours vinyl 1.55 m, frosted band 0.89–1.26 m.
 * ==================================================================== */

/** What is behind the glass, which is where a coffee shop actually is. */
function CafeAInterior({ ph, s }: { ph: Ph; s: DistrictState }) {
  const open = s.cafeA !== "closed";
  if (!open) return null;
  const back = "#7a6a52";
  return (
    <g opacity={0.9}>
      {/* the back wall, the shelf of bags, the board */}
      {px(266, SHOP_HEAD + 4, 246, SILL - SHOP_HEAD - 4, back)}
      {px(266, SHOP_HEAD + 4, 246, 3, "#8d7c60")}
      <path d={pxPath([[286, GROUND - m(2.3), 90, 3]])} fill={OAK[ph].base} />
      <path
        d={pxPath(
          bank([[0, GROUND - m(2.28), 8, m(0.28)]], 9, 10).map(
            ([x, y, w, h]) => [x + 290, y, w, h] as Rect,
          ),
        )}
        fill={K.cafe}
      />
      <Bevel boxes={[[398, GROUND - m(2.4), m(1.6), m(0.9)]]} mat={COAT[ph]} />
      <PixelText
        x={404}
        y={GROUND - m(2.32)}
        text="ESPRESSO"
        fill={K.cafeCream}
        gap={1}
        op={0.75}
      />
      <PixelText x={404} y={GROUND - m(2.14)} text="FILTER" fill={K.cafeCream} gap={1} op={0.6} />
      <PixelText x={452} y={GROUND - m(2.32)} text="11" fill={K.amber} gap={1} op={0.8} />
      <PixelText x={452} y={GROUND - m(2.14)} text="14" fill={K.amber} gap={1} op={0.8} />
      {/* the counter: 1.05 m, which is why you can only see baristas from the chest */}
      <Bevel boxes={[[272, GROUND - m(1.05), 200, m(1.05) - (GROUND - SILL)]]} mat={OAK[ph]} />
      {px(272, GROUND - m(1.05), 200, 3, OAK[ph].hi)}
      {/* the machine: two groups, and the grinder beside it */}
      <Bevel boxes={[[300, GROUND - m(1.5), m(0.9), m(0.45)]]} mat={CHROME[ph]} />
      <path
        d={pxPath([
          [304, GROUND - m(1.14), 6, 8],
          [318, GROUND - m(1.14), 6, 8],
        ])}
        fill={CHROME[ph].deep}
      />
      <path d={pxPath([[302, GROUND - m(1.46), 30, 2]])} fill={K.cafe} />
      <Bevel boxes={[[340, GROUND - m(1.55), m(0.32), m(0.5)]]} mat={COAT[ph]} />
      {/* the pastry case, the cups, the tip jar with nothing in it */}
      <path d={pxPath([[358, GROUND - m(1.35), m(1.1), m(0.3)]])} fill="#cfe0e4" opacity={0.7} />
      <path
        d={pxPath([
          [364, GROUND - m(1.24), 10, 5],
          [378, GROUND - m(1.24), 12, 5],
          [394, GROUND - m(1.24), 9, 5],
        ])}
        fill="#c08a4a"
      />
      <path
        d={pxPath(
          bank([[0, GROUND - m(1.16), 5, 6]], 6, 7).map(
            ([x, y, w, h]) => [x + 420, y, w, h] as Rect,
          ),
        )}
        fill={K.cafeCream}
      />
      {/* the two tables inside, and the person who has been at one for three hours */}
      <path d={pxPath([[286, GROUND - m(0.75), m(0.6), 3]])} fill={OAK[ph].lo} />
      {s.cafeA === "busy" ? (
        <g>
          {px(290, GROUND - m(1.5), 12, m(0.5), K.coat)}
          {px(290, GROUND - m(1.62), 11, m(0.14), K.skin)}
          {px(292, GROUND - m(1.7), 9, 4, "#3a2c1e")}
        </g>
      ) : null}
    </g>
  );
}

function Aurum({ ph, s }: { ph: Ph; s: DistrictState }) {
  const night = ph === "night";
  return (
    <g>
      {/* dark composite cladding, and the granite plinth that is the first metre */}
      <Bev set={MASS_AURUM} mat={CLAD[ph]} />
      <rect x={Z.cafeA} y={0} width={Z.aurum - Z.cafeA} height={GROUND} fill="url(#px-grain)" />
      <Bev set={PLINTH_SET} mat={GRANITE[ph]} />
      {/* full-height lobby glazing, 2.90 m, floor to soffit */}
      <path
        d={GLAZE_AURUM.glass}
        fill={night ? K.lobbyLit : K.glass[ph]}
        opacity={night ? 0.9 : 1}
      />
      <Lobby ph={ph} s={s} />
      <path d={GLAZE_AURUM.mullion} fill={COAT[ph].base} />
      <path d={GLAZE_AURUM.head} fill={COAT[ph].mid} />
      {/* the revolving door: 2.0 m drum, which is 76 px across */}
      <g>
        <path d={pxPath([[700, GROUND - m(2.6), m(2.0), 4]])} fill={COAT[ph].base} />
        <rect
          x={702}
          y={GROUND - m(2.56)}
          width={m(1.9)}
          height={m(2.56)}
          fill="#c2d6da"
          opacity={0.22}
        />
        <path
          d={pxPath([
            [700, GROUND - m(2.56), 3, m(2.56)],
            [774, GROUND - m(2.56), 3, m(2.56)],
          ])}
          fill={CHROME[ph].lo}
        />
        {/* the two leaves you can see, turning slowly because somebody just came out */}
        <g>
          <path d={pxPath([[736, GROUND - m(2.5), 3, m(2.5)]])} fill={CHROME[ph].base} />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;-18 0;-36 0;18 0;0 0"
            dur="9s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      {/* the building name, etched on the glass beside the door, at eye height */}
      <BigText x={790} y={GROUND - m(1.75)} text={NAME_OFFICE} fill={K.white} k={2} op={0.75} />
      <PixelText x={790} y={GROUND - m(1.5)} text="1-4" fill={K.white} gap={1} op={0.45} />
      {/* the canopy over the entrance, out 2 m, and the downlights under it */}
      <path d={pxPath([[688, GROUND - m(2.9), m(2.6), 5]])} fill={CLAD[ph].hi} />
      <path d={pxPath([[688, GROUND - m(2.9) + 5, m(2.6), 3]])} fill={CLAD[ph].deep} />
      <path
        d={pxPath(
          bank([[0, GROUND - m(2.82), 5, 2]], 4, 22).map(
            ([x, y, w, h]) => [x + 700, y, w, h] as Rect,
          ),
        )}
        fill={night ? K.lamp : CHROME[ph].lo}
      />
      {/* the stub bin and the smoking spot nobody admits is a smoking spot */}
      <Bevel boxes={[[Z.cafeA + 12, GROUND - m(1.0), m(0.3), m(1.0)]]} mat={COAT[ph]} />
      <path d={pxPath([[Z.cafeA + 13, GROUND - m(1.0), 9, 3]])} fill={CHROME[ph].base} />
      {s.crowd >= 1 ? (
        <path
          d={pxPath([
            [Z.cafeA + 6, GROUND - 3, 2, 1],
            [Z.cafeA + 26, GROUND - 2, 2, 1],
            [Z.cafeA + 34, GROUND - 4, 1, 1],
          ])}
          fill={K.white}
          opacity={0.6}
        />
      ) : null}
      {/* the intercom, the plaque, the sticker somebody put on the mullion */}
      <Bevel boxes={[[682, GROUND - m(1.5), m(0.24), m(0.4)]]} mat={CHROME[ph]} />
      <path d={pxPath([[858, GROUND - m(1.6), m(0.5), m(0.7)]])} fill={CHROME[ph].hi} />
      <PixelText x={861} y={GROUND - m(1.52)} text="24/7" fill={COAT[ph].base} gap={1} op={0.7} />
      <path d={pxPath([[Z.cafeA + 22, GROUND - m(1.35), 7, 7]])} fill={K.brand} opacity={0.7} />
    </g>
  );
}

/** Depth inside depth: the lobby, seen through 2.9 m of glass. */
function Lobby({ ph, s }: { ph: Ph; s: DistrictState }) {
  const night = ph === "night";
  return (
    <g opacity={night ? 0.95 : 0.55}>
      {/* the back wall and the lift core beyond it */}
      {px(Z.cafeA + 26, GROUND - m(2.85), 296, m(2.85), night ? "#d8e2e8" : "#8a9aa4")}
      {px(Z.cafeA + 26, GROUND - m(2.85), 296, 4, night ? "#eef4f8" : "#9aaab4")}
      {px(802, GROUND - m(2.5), m(1.5), m(2.5), night ? "#b8c8d2" : "#6d7c86")}
      <path d={pxPath([[806, GROUND - m(2.4), m(0.6), m(2.3)]])} fill={CHROME[ph].base} />
      {/* the reception desk: 1.10 m, so the guard is visible from the chest up */}
      <Bevel boxes={[[620, GROUND - m(1.1), m(2.4), m(1.1)]]} mat={OAK[ph]} />
      {px(620, GROUND - m(1.1), m(2.4), 3, OAK[ph].hi)}
      <path d={pxPath([[634, GROUND - m(1.35), m(0.5), m(0.28)]])} fill={COAT[ph].base} />
      {/* the guard, who is always there and never looks up */}
      {px(660, GROUND - m(1.55), 14, m(0.45), K.coat)}
      {px(661, GROUND - m(1.68), 12, m(0.13), K.skin)}
      {px(662, GROUND - m(1.76), 10, 4, "#2f2318")}
      {/* the barriers, the plant, the two chairs nobody sits in */}
      <path
        d={pxPath(
          bank([[0, GROUND - m(1.0), 4, m(1.0)]], 4, 26).map(
            ([x, y, w, h]) => [x + 700, y, w, h] as Rect,
          ),
        )}
        fill={CHROME[ph].lo}
      />
      <path d={pxPath([[840, GROUND - m(1.4), m(0.5), m(0.5)]])} fill={LEAF[ph].base} />
      <path d={pxPath([[844, GROUND - m(0.9), m(0.3), m(0.9)]])} fill={COAT[ph].mid} />
      {/* and the courier waiting at the desk, if there is one */}
      {s.delivery === "van" ? (
        <g>
          {px(600, GROUND - m(1.75), 15, m(0.6), K.hiVis)}
          {px(601, GROUND - m(1.88), 13, m(0.13), K.skin)}
        </g>
      ) : null}
    </g>
  );
}

/** The gym's own ground-floor unit. This is the door the player came out of. */
/* ==================================================================== *
 * ZDROFIT FRONT — replacement block for district.tsx
 *
 * Coordinate frame kept exactly as you have it: unit 880..1090, fascia band
 * 896..1076, glazing 908..1064, door pair 976..1044. Nothing moves sideways, so
 * `MASS_ZDROFIT`, `GLAZE_ZDROFIT` and `PLINTH_SET` are all untouched and this
 * drops straight in. (This is the 1760-wide district, not the 980 rework — the
 * heights are identical between them, only the x differs, so if you ever port it
 * the only thing to change is the five x constants at the top of the geometry.)
 *
 * FIVE GEOMETRY DEFECTS.
 *
 *   A  THE STAIRCASE RUNS OUT THROUGH THE SHOPFRONT. Twelve treads from x940 at a
 *      pitch of 11 puts the last one at 1061..1073, and the glazing ends at 1064.
 *      Nine pixels of flight are drawn on the cladding outside the window. It now
 *      starts at 916 and ends at 1049, entirely behind glass.
 *   B  The door glass overhangs its own frame by one pixel: frame 976..1044, glass
 *      980..1045.
 *   C  The door is a filled `<Bevel>` box with 85 %-opaque glass laid over it, so
 *      the frame colour shows through the glazing. Same filled-box-over-an-aperture
 *      bug as the klatka and blok16 doors — a glazed door is rails round a hole.
 *   D  The lobby fill starts at y44 but the glazing starts at y36, leaving eight
 *      pixels of window with nothing behind it.
 *   E  The extract grille's last louvre is one pixel below the grille.
 *
 * Every height was already right, which is worth saying: fascia 3.61 m, glazing
 * head 3.00 m, door head 2.21 m, A-board 0.89 m, and the stair at 0.184 m rise on
 * a 0.29 m going is a real stair. Nothing needed re-measuring.
 *
 * THE COHERENCE MOVE. Behind this glass is the gym scene, and it keeps
 * `world.gym` — `reception`, `turnstile`, `crowd` and the rest. The old frontage
 * showed a stair going up into nothing. Now the top of the flight shows **the
 * landing you actually arrive at**: the reception desk, Kasia behind it when
 * `reception !== "away"`, and the turnstile's LED red on `locked` and green on
 * `unlocked`. Same club, seen from the pavement. If you took the Żabka shopfront
 * block, this is the same contract.
 *
 * WHAT ELSE IS IN HERE, and why each thing belongs on a Polish gym frontage:
 *   – frosted window vinyl: two figures, one squatting, one running. This is the
 *     single most recognisable thing about a gym shopfront and it was missing.
 *   – SIŁOWNIA under the wordmark, because the fascia should say what it is
 *   – a projecting blade sign, so the club is visible from down the street
 *   – the class timetable in a frame on the lobby wall, and the price sheet taped
 *     inside the right-hand pane
 *   – a raking handrail following the flight at 0.9 m above the nosings, which is
 *     the line that makes a drawn stair read as a stair
 *   – a member on the flight when the club is busy, stepping up the rake
 *   – the lobby: mat, leaflet stand, bin, and the brand stripe on every nosing
 *   – doors as rails: closer arms, kick plates, a card reader on the pier for
 *     after-hours entry, PCHAĆ on the leaf, and the payment decal row
 *   – bird spikes and droppings on the fascia, its fixing bolts, and one tube at
 *     the far end on its way out
 *   – the grease stain under the extract grille the building never planned for
 *   – condensation on the glass in the cold, because it is warm in there
 *   – and when it is shut: the roller grille, its box, a padlock, and the night
 *     light still on behind the slats
 *
 * LIGHT. Four sources, all quantised through the kit's light primitives: the
 * backlit fascia washing down the cladding, the lobby spilling onto the slabs, the
 * blade sign's own small halo, and the two indicator points inside. If your kit is
 * split, `tiers` / `steppedQuad` / `steppedEllipse` / `Light` / `dth` come from
 * LightKit and the rest from pixelKit; the import line is at the top.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * state — what is visible of the gym from the pavement
 * -------------------------------------------------------------------- */

/**
 * The same keys the gym scene defines, read defensively, because the district
 * must not care whether anybody has been upstairs yet. Only the three you can
 * actually see through a ground-floor window are here.
 */
type GymFront = {
  reception: "away" | "staffed" | "busy";
  turnstile: "locked" | "unlocked" | "open";
  crowd: 0 | 1 | 2 | 3;
};
const GF_RECEPTION = ["away", "staffed", "busy"] as const;
const GF_TURNSTILE = ["locked", "unlocked", "open"] as const;

function gymFront(world: WorldState): GymFront {
  const g = ((world as unknown as Record<string, unknown>).gym ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T =>
    typeof v === "string" && (all as readonly string[]).includes(v) ? (v as T) : d;
  return {
    reception: pick(g.reception, GF_RECEPTION, "staffed"),
    turnstile: pick(g.turnstile, GF_TURNSTILE, "locked"),
    crowd:
      typeof g.crowd === "number" && Number.isFinite(g.crowd)
        ? (Math.max(0, Math.min(3, Math.trunc(g.crowd))) as 0 | 1 | 2 | 3)
        : (2 as 0 | 1 | 2 | 3),
  };
}

/* -------------------------------------------------------------------- *
 * palette
 * -------------------------------------------------------------------- */

const ZF = {
  /** the brand, and the two tones the band is lit and unlit */
  band: "#e8542e",
  bandHi: "#f5764c",
  bandLo: "#b83c1c",
  bandDark: "#8a3520",
  ink: "#ffffff",
  inkSub: "#ffd9cc",
  bolt: "#a8452a",
  /** the lobby: warm 3000 K when open, dead grey when shut */
  lobbyLit: "#d8d2c2",
  lobbyDark: "#33383e",
  lobbyFloor: "#8a8478",
  lobbyFloorDark: "#3a3f45",
  tread: "#e2ded2",
  treadDark: "#4a5058",
  rail: "#c8ccd2",
  railDark: "#5d6266",
  desk: "#3a4148",
  deskTop: "#5d656e",
  screen: "#7ea8e0",
  turnRed: "#e0483a",
  turnGreen: "#3ddc84",
  /** frosted vinyl, which is the signature of a gym window */
  frost: "#eef4f8",
  poster: "#f2f2ee",
  posterRule: "#8a8578",
  leaflet: "#e8e2d2",
  bin: "#2e3338",
  mat: "#3a3d43",
  matRib: "#4d5158",
  /** the glass, and what happens to it when it is warm inside and cold out */
  fog: "#cfe0e6",
  /** the shutter, when the club is shut */
  shutter: "#8f9299",
  shutterLo: "#5d6066",
  shutterBox: "#6d7077",
  padlock: "#2e3033",
  /** the grille the building never planned for, and its stain */
  grille: "#b0b5ba",
  grilleDeep: "#74797e",
  grease: "#6b5f4c",
  spike: "#8a8f96",
  dropping: "#e4e6e0",
  cardReader: "#2b3138",
} as const;

/* -------------------------------------------------------------------- *
 * geometry — five x constants at the top; everything derives from them
 * -------------------------------------------------------------------- */

const ZFX = {
  unit0: 880,
  unit1: 1090,
  fascia0: 896,
  fascia1: 1076,
  glass0: 908,
  glass1: 1064,
  door0: 976,
  door1: 1044,
} as const;

/* --- the fascia --- */
const ZF_BAND = pxPath([
  [ZFX.fascia0, FASCIA_TOP, ZFX.fascia1 - ZFX.fascia0, SHOP_HEAD - FASCIA_TOP],
]);
const ZF_BAND_HI = pxPath([[ZFX.fascia0, FASCIA_TOP, ZFX.fascia1 - ZFX.fascia0, 2]]);
const ZF_BAND_LO = pxPath([[ZFX.fascia0, SHOP_HEAD - 2, ZFX.fascia1 - ZFX.fascia0, 2]]);
/** Fixing bolts along the bottom, at the fitter's spacing. */
const ZF_BOLTS = pxPath(repeat(11, 17, [ZFX.fascia0 + 6, SHOP_HEAD - 5, 2, 2] as Rect));
/** Bird spikes along the top, and the droppings that prove they went on late. */
const ZF_SPIKES = pxPath(repeat(30, 6, [ZFX.fascia0, FASCIA_TOP - 3, 1, 3] as Rect));
const ZF_DROPPINGS = pxPath([
  [934, FASCIA_TOP, 2, 8],
  [1002, FASCIA_TOP, 1, 5],
  [1048, FASCIA_TOP, 2, 10],
]);
/** The tube at the far end is on its way out, which is why that end is dimmer. */
const ZF_DEAD_END = pxPath([[1012, FASCIA_TOP + 2, 62, SHOP_HEAD - FASCIA_TOP - 4]]);

/* --- the blade sign, projecting out over the pavement --- */
const ZF_BLADE_ARM = pxPath([
  [ZFX.fascia0 - 4, 24, 6, 3],
  [ZFX.unit0 + 2, 14, 14, 2],
]);
const ZF_BLADE = bevelPaths([[ZFX.unit0 + 2, 16, 14, 30]]);
const ZF_BLADE_MARK = pxPath([
  [ZFX.unit0 + 5, 20, 8, 3],
  [ZFX.unit0 + 5, 26, 8, 3],
  [ZFX.unit0 + 5, 32, 8, 3],
]);

/* --- the lobby, behind the glass. Fills the glazing, not eight pixels short. --- */
const ZF_LOBBY = pxPath([
  [ZFX.glass0 + 2, SHOP_HEAD, ZFX.glass1 - ZFX.glass0 - 4, GROUND - SHOP_HEAD],
]);
const ZF_LOBBY_FLOOR = pxPath([[ZFX.glass0 + 2, 143, 68, 7]]);
/**
 * The flight: twelve treads from x916, so the last lands at 1049 and the whole
 * run is behind glass. 0.184 m rise on a 0.29 m going, which is a real stair.
 */
const ZF_TREAD_N = 12;
const ZF_TREAD_X = 916;
const ZF_GOING = m(0.28); // 11
const ZF_RISE = m(0.175); // 7
const ZF_STAIR = pxPath(
  Array.from(
    { length: ZF_TREAD_N },
    (_, i) => [ZF_TREAD_X + i * ZF_GOING, GROUND - ZF_RISE * (i + 1), ZF_GOING + 1, 3] as Rect,
  ),
);
/** The brand stripe on every nosing, which they do in every club. */
const ZF_NOSINGS = pxPath(
  Array.from(
    { length: ZF_TREAD_N },
    (_, i) => [ZF_TREAD_X + i * ZF_GOING, GROUND - ZF_RISE * (i + 1) + 2, ZF_GOING, 1] as Rect,
  ),
);
/**
 * The handrail, 0.9 m above the nosings — the raking line that makes a drawn
 * stair read as a stair. Clipped where it would leave the glazing at the top.
 */
const ZF_RAIL = pxPath(
  Array.from({ length: ZF_TREAD_N }, (_, i) => i)
    .map(
      (i) =>
        [ZF_TREAD_X + i * ZF_GOING, GROUND - ZF_RISE * (i + 1) - m(0.9), ZF_GOING + 1, 2] as Rect,
    )
    .filter((r) => r[1] >= SHOP_HEAD + 4),
);
const ZF_RAIL_POSTS = pxPath([
  [936, 100, 3, 43],
  [1000, 58, 3, 37],
]);

/* --- the landing at the top: the desk, the turnstile, and who is on them --- */
const ZF_DESK = bevelPaths([[1036, 58, 26, 14]]);
const ZF_DESK_TOP = pxPath([[1036, 58, 26, 2]]);
const ZF_DESK_SCREEN = pxPath([[1040, 52, 8, 6]]);
/** Kasia, behind it, cropped by the desk the way anybody behind a desk is. */
const ZF_KASIA = pxPath([
  [1050, 44, 9, 4],
  [1051, 48, 7, 6],
  [1049, 54, 11, 5],
]);
/** The turnstile, at the top of the flight, and its verdict. */
const ZF_TURN_POST = pxPath([[1022, 62, 6, 18]]);
const ZF_TURN_ARMS = pxPath([
  [1010, 60, 16, 2],
  [1026, 60, 14, 2],
]);
const ZF_TURN_LED = pxPath([[1023, 64, 4, 3]]);

/* --- the lobby's furniture --- */
const ZF_MAT = pxPath([[ZFX.glass0 + 4, 145, 60, 5]]);
const ZF_MAT_RIBS = pxPath(repeat(14, 4, [ZFX.glass0 + 6, 146, 2, 3] as Rect));
const ZF_LEAFLETS = bevelPaths([[914, 118, 12, 25]]);
const ZF_LEAFLET_SHELVES = pxPath(repeat(4, 6, [915, 122, 10, 1] as Rect, "y"));
const ZF_BIN = bevelPaths([[960, 128, 11, 15]]);
const ZF_BIN_LID = pxPath([[959, 126, 13, 3]]);
/** The class timetable, framed on the lobby wall above the flight. */
const ZF_TIMETABLE = bevelPaths([[930, 58, 30, 34]]);
const ZF_TIMETABLE_FACE = pxPath([[932, 60, 26, 30]]);
const ZF_TIMETABLE_GRID = pxPath([
  ...repeat(6, 4, [934, 70, 22, 1] as Rect, "y"),
  [942, 68, 1, 22],
  [950, 68, 1, 22],
]);

/* --- the vinyl on the glass: the signature of a gym window --- */
/** A squat: feet apart, hips down, a bar across the shoulders. */
const ZF_VINYL_SQUAT = pxPath([
  [920, 62, 9, 4],
  [922, 66, 5, 8],
  [918, 70, 4, 3],
  [927, 70, 4, 3],
  [920, 74, 4, 10],
  [925, 74, 4, 10],
  [918, 84, 6, 3],
  [925, 84, 6, 3],
  [912, 60, 25, 2],
]);
/** A run: one leg forward, one back, arms opposed. */
const ZF_VINYL_RUN = pxPath([
  [950, 58, 8, 4],
  [951, 62, 6, 12],
  [946, 64, 4, 8],
  [957, 66, 5, 7],
  [948, 74, 5, 11],
  [955, 74, 5, 9],
  [944, 85, 7, 3],
  [957, 83, 7, 3],
]);
/** The price sheet taped inside the narrow right-hand pane. */
const ZF_PRICES = pxPath([[1046, 70, 16, 30]]);
const ZF_PRICES_RULES = pxPath([
  [1048, 78, 12, 1],
  [1048, 84, 9, 1],
  [1048, 90, 11, 1],
]);

/* --- the doors: rails round a hole, not a filled box --- */
const ZF_DOOR_HEAD = GROUND - m(2.2); // 66
const ZF_DOOR_RAILS = pxPath([
  [ZFX.door0, ZF_DOOR_HEAD, ZFX.door1 - ZFX.door0, 4],
  [ZFX.door0, 142, ZFX.door1 - ZFX.door0, 8],
  [ZFX.door0, ZF_DOOR_HEAD, 4, GROUND - ZF_DOOR_HEAD],
  [ZFX.door1 - 4, ZF_DOOR_HEAD, 4, GROUND - ZF_DOOR_HEAD],
  [1008, ZF_DOOR_HEAD, 4, GROUND - ZF_DOOR_HEAD],
]);
const ZF_DOOR_RAILS_HI = pxPath([
  [ZFX.door0, ZF_DOOR_HEAD, ZFX.door1 - ZFX.door0, 1],
  [ZFX.door0, ZF_DOOR_HEAD, 1, GROUND - ZF_DOOR_HEAD],
]);
/** The two panes, sized off the rails so neither can overhang. */
const ZF_DOOR_PANES = pxPath([
  [ZFX.door0 + 4, ZF_DOOR_HEAD + 4, 1008 - ZFX.door0 - 4, 138 - ZF_DOOR_HEAD],
  [1012, ZF_DOOR_HEAD + 4, ZFX.door1 - 4 - 1012, 138 - ZF_DOOR_HEAD],
]);
const ZF_CLOSERS = pxPath([
  [982, ZF_DOOR_HEAD + 5, 20, 3],
  [1016, ZF_DOOR_HEAD + 5, 20, 3],
]);
const ZF_HANDLES = pxPath([
  [1000, GROUND - m(1.15), 3, m(0.35)],
  [1018, GROUND - m(1.15), 3, m(0.35)],
]);
const ZF_KICKS = pxPath([
  [ZFX.door0 + 5, 142, 1008 - ZFX.door0 - 6, 7],
  [1013, 142, ZFX.door1 - 5 - 1013, 7],
]);
/** The payment decal row, which every door in the country carries. */
const ZF_DECALS = pxPath([
  [982, 126, 6, 5],
  [990, 126, 6, 5],
  [998, 126, 6, 5],
]);
/** The card reader on the pier, for members who come before staff do. */
const ZF_READER = bevelPaths([[1066, 100, 7, 14]]);
const ZF_READER_FACE = pxPath([[1067, 103, 5, 6]]);
/** The mat outside, which is always wet. */
const ZF_MAT_OUT = pxPath([[ZFX.door0, 146, ZFX.door1 - ZFX.door0, 4]]);

/* --- the extract grille, with the last louvre inside it this time --- */
const ZF_GRILLE = bevelPaths([[1066, GROUND - m(2.7), m(0.6), m(0.5)]]);
const ZF_GRILLE_FINS = pxPath(repeat(4, 4, [1068, GROUND - m(2.66), 19, 2] as Rect, "y"));
/** And the stain it has printed down the cladding since it went in. */
const ZF_GREASE = pxPath([
  [1070, GROUND - m(2.2), 14, 18],
  [1074, GROUND - m(1.75), 6, 10],
]);

/* --- the A-board --- */
const ZF_ABOARD = bevelPaths([[1044, GROUND - m(0.9), m(0.78), m(0.9)]]);
const ZF_ABOARD_FACE = pxPath([[1046, GROUND - m(0.86), m(0.68), m(0.68)]]);
const ZF_ABOARD_LEGS = pxPath([[1044, GROUND - 4, m(0.78), 4]]);

/* --- the shutter, for when the club is shut --- */
const ZF_SHUTTER_BOX = pxPath([[ZFX.glass0 - 2, SHOP_HEAD, ZFX.glass1 - ZFX.glass0 + 4, 6]]);
const ZF_SHUTTER = pxPath(
  Array.from(
    { length: Math.floor((GROUND - SHOP_HEAD - 6) / 5) },
    (_, i) => [ZFX.glass0, SHOP_HEAD + 6 + i * 5, ZFX.glass1 - ZFX.glass0, 4] as Rect,
  ),
);
const ZF_SHUTTER_SEAMS = pxPath(
  Array.from(
    { length: Math.floor((GROUND - SHOP_HEAD - 6) / 5) },
    (_, i) => [ZFX.glass0, SHOP_HEAD + 10 + i * 5, ZFX.glass1 - ZFX.glass0, 1] as Rect,
  ),
);
const ZF_PADLOCK = pxPath([
  [1004, 142, 8, 7],
  [1006, 138, 4, 5],
]);

/* --- light: four sources, all quantised --- */
/** The band is backlit, so it washes the cladding under itself. */
const ZF_LIGHT_FASCIA = tiers(
  (k) =>
    steppedQuad(
      SHOP_HEAD,
      ZFX.fascia0 + (1 - k) * 30,
      ZFX.fascia1 - (1 - k) * 30,
      110,
      ZFX.fascia0 - 20,
      ZFX.fascia1 + 20,
      8,
    ),
  "w",
  0.55,
);
/** And the lobby throws a box of warm light out onto the slabs. */
const ZF_LIGHT_LOBBY = tiers(
  (k) =>
    steppedQuad(
      120,
      ZFX.glass0 + (1 - k) * 34,
      ZFX.glass1 - (1 - k) * 34,
      GROUND + 16,
      ZFX.glass0 - 26,
      ZFX.glass1 + 26,
      8,
    ),
  "w",
  0.7,
);
/** The blade sign's own small halo. */
const ZF_LIGHT_BLADE = tiers(
  (k) => steppedEllipse(ZFX.unit0 + 9, 31, Math.round(18 * k), Math.round(22 * k), 2),
  "w",
  0.4,
);

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

/**
 * The gym's frontage. A backlit band, a window with people frosted onto it, and
 * a flight of stairs going up to a reception desk that is either staffed or not.
 */
function ZdrofitFront({ ph, s, gym }: { ph: Ph; s: DistrictState; gym: GymFront }) {
  const open = s.zdrofitOpen;
  const lit = lampsOn(s, ph);
  const dark = ph === "night" || ph === "dusk";
  const snow = isSnow(s);
  const wet = isWet(s);
  /** Warm inside, cold out: a gym window fogs from the bottom up. */
  const fogged = open && (snow || (wet && (ph === "dawn" || dark)));
  return (
    <g>
      {/* ---- the shell, the plinth is drawn with Aurum's in PLINTH_SET ------ */}
      <Bev set={MASS_ZDROFIT} mat={CLAD[ph]} />

      {/* ---- the blade sign, so the club is visible from down the street --- */}
      <path d={ZF_BLADE_ARM} fill={CHROME[ph].lo} />
      <Bev set={ZF_BLADE} mat={{ ...COAT[ph], base: ZF.band, hi: ZF.bandHi }} />
      <path d={ZF_BLADE_MARK} fill={ZF.ink} opacity={0.9} />
      {snow ? <path d={pxPath([[ZFX.unit0 + 2, 15, 14, 2]])} fill={K.snow} /> : null}

      {/* ---- the fascia ---------------------------------------------------- */}
      <path d={ZF_BAND} fill={ZF.band} />
      <path d={ZF_BAND_HI} fill={ZF.bandHi} />
      <path d={ZF_BAND_LO} fill={ZF.bandLo} />
      {/* the tube at the far end is going, which is why that end sits darker */}
      <path d={ZF_DEAD_END} fill={ZF.bandDark} opacity={0.35}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.35;0.35;0.35;0.12;0.35"
          dur="17s"
          repeatCount="indefinite"
        />
      </path>
      <BigText x={914} y={FASCIA_TOP + 4} text="ZDROFIT" fill={ZF.ink} k={2} />
      {/* the fascia should say what the place is, and it did not */}
      <PixelText x={914} y={FASCIA_TOP + 17} text="SIŁOWNIA" fill={ZF.inkSub} gap={0} op={0.9} />
      <PixelText x={1040} y={FASCIA_TOP + 17} text="6-23" fill={ZF.inkSub} gap={1} op={0.75} />
      <path d={ZF_BOLTS} fill={ZF.bolt} opacity={0.7} />
      {/* bird spikes, and the droppings that show they went on late */}
      <path d={ZF_SPIKES} fill={ZF.spike} opacity={0.75} />
      <path d={ZF_DROPPINGS} fill={ZF.dropping} opacity={0.4} />
      {snow ? (
        <path
          d={pxPath([[ZFX.fascia0, FASCIA_TOP - 1, ZFX.fascia1 - ZFX.fascia0, 2]])}
          fill={K.snow}
        />
      ) : null}

      {/* ---- the glazing, and the lobby behind all of it -------------------- */}
      <path d={GLAZE_ZDROFIT.glass} fill={open ? K.glassLit : K.glass[ph]} />
      {/* the lobby now fills the glazing instead of stopping 8 px short */}
      <path d={ZF_LOBBY} fill={open ? ZF.lobbyLit : ZF.lobbyDark} opacity={0.85} />
      <path d={ZF_LOBBY_FLOOR} fill={open ? ZF.lobbyFloor : ZF.lobbyFloorDark} />

      {/* the class timetable, framed on the wall above the flight */}
      <Bev set={ZF_TIMETABLE} mat={COAT[ph]} />
      <path d={ZF_TIMETABLE_FACE} fill={open ? ZF.poster : "#5d656e"} />
      <PixelText x={933} y={62} text="GRAFIK" fill={ZF.posterRule} gap={0} op={0.85} />
      <path d={ZF_TIMETABLE_GRID} fill={ZF.posterRule} opacity={0.5} />

      {/* the flight: twelve treads, 916..1049, all of it behind glass */}
      <path d={ZF_STAIR} fill={open ? ZF.tread : ZF.treadDark} />
      <path d={ZF_NOSINGS} fill={ZF.band} opacity={open ? 0.9 : 0.35} />
      {/* the raking handrail, 0.9 m above the nosings */}
      <path d={ZF_RAIL} fill={open ? ZF.rail : ZF.railDark} />
      <path d={ZF_RAIL_POSTS} fill={CHROME[ph].lo} />

      {/* the landing you actually arrive at, which the gym scene knows about */}
      <path d={ZF_TURN_ARMS} fill={CHROME[ph].base} />
      <path d={ZF_TURN_POST} fill={COAT[ph].base} />
      <path
        d={ZF_TURN_LED}
        fill={gym.turnstile === "locked" ? ZF.turnRed : ZF.turnGreen}
        opacity={open ? 1 : 0.3}
        style={{ transition: STEP_FADE }}
      />
      <Bev set={ZF_DESK} mat={{ ...COAT[ph], base: ZF.desk, hi: ZF.deskTop }} />
      <path d={ZF_DESK_TOP} fill={ZF.band} opacity={0.8} />
      {open && gym.reception !== "away" ? (
        <g>
          <path d={ZF_DESK_SCREEN} fill={ZF.screen} opacity={0.8} />
          <path d={ZF_KASIA} fill="#2f3a44" />
          <path d={pxPath([[1051, 48, 7, 3]])} fill={K.skin} />
        </g>
      ) : (
        <path d={ZF_DESK_SCREEN} fill="#2b3138" />
      )}

      {/* a member on the flight when the club is busy, stepping up the rake */}
      {open && gym.crowd >= 2 ? (
        <g opacity={0.85}>
          <path
            d={pxPath([
              [956, 88, 11, 22],
              [957, 80, 9, 8],
              [954, 110, 5, 12],
              [962, 110, 5, 12],
            ])}
            fill="#3a4650"
          />
          <path d={pxPath([[957, 80, 9, 3]])} fill={K.skin} />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;11 -7;22 -14;33 -21;44 -28;0 0"
            dur="9.6s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}

      {/* the lobby's furniture, at the bottom where you walk in */}
      <path d={ZF_MAT} fill={ZF.mat} />
      <path d={ZF_MAT_RIBS} fill={ZF.matRib} />
      <Bev set={ZF_LEAFLETS} mat={COAT[ph]} />
      <path d={ZF_LEAFLET_SHELVES} fill={ZF.leaflet} />
      <Bev set={ZF_BIN} mat={{ ...COAT[ph], base: ZF.bin }} />
      <path d={ZF_BIN_LID} fill={ZF.matRib} />

      {/* ---- the vinyl on the glass, which is the signature of the thing ---- */}
      <path d={ZF_VINYL_SQUAT} fill={ZF.frost} opacity={0.72} />
      <path d={ZF_VINYL_RUN} fill={ZF.frost} opacity={0.72} />
      {/* the price sheet taped inside the narrow pane */}
      <path d={ZF_PRICES} fill={open ? ZF.poster : "#6d7278"} />
      <path d={ZF_PRICES_RULES} fill={ZF.posterRule} opacity={0.6} />
      <path d={pxPath([[1048, 72, 11, 4]])} fill={ZF.band} opacity={0.85} />

      {/* condensation, because it is warm in there and cold out here */}
      {fogged ? (
        <g>
          <path
            d={pxPath([[ZFX.glass0 + 2, 96, ZFX.glass1 - ZFX.glass0 - 4, 52]])}
            fill={dth("c", "50")}
            opacity={0.55}
          />
          <path
            d={pxPath([[ZFX.glass0 + 2, 84, ZFX.glass1 - ZFX.glass0 - 4, 12]])}
            fill={dth("c", "25")}
            opacity={0.45}
          />
          {/* and one run down the inside of the glass */}
          <path d={pxPath([[996, 100, 1, 3]])} fill={ZF.fog} opacity={0.8}>
            <animate attributeName="y" values="100;144" dur="6.4s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.8;0.8;0"
              keyTimes="0;0.85;1"
              dur="6.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}

      {/* the mullions and head last, so they sit in front of everything */}
      <path d={GLAZE_ZDROFIT.mullion} fill={COAT[ph].base} />
      <path d={GLAZE_ZDROFIT.head} fill={COAT[ph].mid} />
      {/* the CCTV in the reveal, watching the door */}
      <path d={pxPath([[ZFX.glass0 + 2, SHOP_HEAD + 2, 7, 4]])} fill={COAT[ph].deep} />
      <path d={pxPath([[ZFX.glass0 + 4, SHOP_HEAD + 3, 3, 2]])} fill="#1b2026" />

      {/* ---- the doors: rails round a hole ---------------------------------- */}
      <path d={ZF_DOOR_PANES} fill={open ? K.glassLit : K.glass[ph]} opacity={0.55} />
      <path d={ZF_DOOR_RAILS} fill={COAT[ph].base} />
      <path d={ZF_DOOR_RAILS_HI} fill={COAT[ph].hi} />
      <path d={ZF_CLOSERS} fill={CHROME[ph].lo} />
      <path d={ZF_KICKS} fill={CHROME[ph].mid} />
      <path d={ZF_HANDLES} fill={CHROME[ph].hi} />
      {/* set tight and centred, because the pane is 28 px and vinyl is set tight */}
      <PixelText
        x={983}
        y={GROUND - m(1.9)}
        text="OTWARTE"
        fill={ZF.band}
        gap={0}
        op={open ? 0.9 : 0.3}
      />
      <PixelText x={987} y={GROUND - m(1.72)} text="6-23" fill={K.white} gap={1} op={0.6} />
      <PixelText x={1016} y={GROUND - m(1.9)} text="PCHAĆ" fill={K.white} gap={1} op={0.55} />
      <path d={ZF_DECALS} fill="#3f7ab8" opacity={0.7} />
      <path d={ZF_MAT_OUT} fill={ZF.mat} />
      <path d={pxPath([[ZFX.door0, 146, ZFX.door1 - ZFX.door0, 1]])} fill={ZF.matRib} />
      {/* the card reader on the pier, for members who arrive before staff do */}
      <Bev set={ZF_READER} mat={{ ...COAT[ph], base: ZF.cardReader }} />
      <path d={ZF_READER_FACE} fill={open ? ZF.turnGreen : ZF.turnRed} opacity={0.8} />

      {/* ---- the A-board, out on the slabs while the club is open ---------- */}
      {open ? (
        <g>
          <Bev set={ZF_ABOARD} mat={COAT[ph]} />
          <path d={ZF_ABOARD_FACE} fill={ZF.band} />
          <PixelText x={1048} y={GROUND - m(0.78)} text="-20%" fill={ZF.ink} gap={1} />
          <PixelText x={1048} y={GROUND - m(0.6)} text="KARNET" fill={ZF.ink} gap={1} op={0.85} />
          <path d={ZF_ABOARD_LEGS} fill={COAT[ph].deep} />
          {snow ? (
            <path d={pxPath([[1044, GROUND - m(0.9) - 1, m(0.78), 2]])} fill={K.snow} />
          ) : null}
        </g>
      ) : null}

      {/* ---- the extract grille, and the stain it has printed ------------- */}
      <path d={ZF_GREASE} fill={ZF.grease} opacity={0.3} />
      <Bev set={ZF_GRILLE} mat={{ ...CHROME[ph], base: ZF.grille }} />
      <path d={ZF_GRILLE_FINS} fill={ZF.grilleDeep} />

      {/* ---- shut: the roller grille, its box, and the light left on ------ */}
      {!open ? (
        <g>
          <path d={ZF_SHUTTER} fill={ZF.shutter} />
          <path d={ZF_SHUTTER_SEAMS} fill={ZF.shutterLo} />
          <path d={ZF_SHUTTER_BOX} fill={ZF.shutterBox} />
          <path
            d={pxPath([[ZFX.glass0 - 2, SHOP_HEAD, ZFX.glass1 - ZFX.glass0 + 4, 1]])}
            fill={ZF.grille}
          />
          <path d={ZF_PADLOCK} fill={ZF.padlock} />
          <path d={pxPath([[1006, 138, 4, 2]])} fill={CHROME[ph].base} />
          {/* the night light still on behind the slats, which is how you know */}
          <path d={ZF_SHUTTER_SEAMS} fill={K.glassLit} opacity={0.1} />
        </g>
      ) : null}

      {/* ---- the four light sources, once the lamps decide it is evening ----
          fascia backwash on the cladding, the lobby's box of warm light on the
          slabs, and the blade sign's own small halo. The fourth source is the
          dead tube, and its light is the absence at the far end of the band. */}
      {lit && open ? (
        <g>
          <Light set={ZF_LIGHT_FASCIA} />
          <Light set={ZF_LIGHT_LOBBY} />
          <Light set={ZF_LIGHT_BLADE} />
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * WHAT TO CHANGE OUTSIDE THIS BLOCK
 *
 * 1. PASS THE GYM STATE IN. In `Facades`, where ZdrofitFront is called:
 *
 *        <ZdrofitFront ph={ph} s={s} gym={gymFront(world)} />
 *
 *    `Facades` will need `world` threading through if it does not have it — it is
 *    already in `DistrictScene`, so it is one extra prop on `Facades`.
 *
 * 2. JOIN THE THREE NEW READS in `districtArtKey`, after `s.zdrofitOpen`:
 *
 *        const g = gymFront(w);
 *        ... , g.reception, g.turnstile, g.crowd,
 *
 *    Without this the frontage freezes: Kasia stays at a desk she has left, and
 *    the turnstile LED keeps showing a verdict that has changed. Same trap the
 *    Żabka shopfront had.
 *
 * 3. THE LIGHT, in `DistrictEffects`, beside the other spills:
 *
 *        {s.zdrofitOpen ? <Light set={ZF_LIGHT_FASCIA} op={dark ? 1 : 0.25} /> : null}
 *        {s.zdrofitOpen ? <Light set={ZF_LIGHT_LOBBY} op={dark ? 1 : 0.3} /> : null}
 *        {lit ? <Light set={ZF_LIGHT_BLADE} op={dark ? 1 : 0.2} /> : null}
 *
 *    If you already have a `SPILL_GYM` in there, these replace it — it was a
 *    single spill where there are three sources.
 *
 * 4. NOTHING ELSE MOVES. `MASS_ZDROFIT`, `GLAZE_ZDROFIT` and `PLINTH_SET` are
 *    unchanged, and so is every hitbox: `zdrofit-window`, `zdrofit-entrance`,
 *    `zdrofit-board` and `zdrofit-grille` all still sit on what they name.
 *
 * IMPORTS. If your kit is split, `tiers`, `steppedQuad`, `steppedEllipse`, `Light`
 * and `dth` come from LightKit; `Bev`, `Bevel`, `bevelPaths`, `px`, `pxPath`,
 * `repeat`, `PixelText`, `BigText` and `STEP_FADE` from pixelKit. If it is not
 * split, they all come from "@/engine" as they do now and this needs no import
 * change at all.
 *
 * GEOMETRY, FOR THE RECORD. Unit 880..1090, fascia 896..1076, glazing 908..1064,
 * doors 976..1044 — your frame, unchanged. The flight is twelve treads from x916
 * ending at 1049, entirely behind glass; 0.184 m rise, 0.29 m going, handrail
 * 0.9 m above the nosings. Door head 2.21 m, handles 0.97 m, A-board 0.89 m.
 * Every x derives from the eight constants in ZFX, so porting this to the
 * 980-wide district means editing those eight and nothing else.
 * ==================================================================== */

function ParkingPlot({ ph, s }: { ph: Ph; s: DistrictState }) {
  return (
    <g>
      {/* the open plot: a low wall, a hedge, and the flank of the next block */}
      <Bev set={PLOT_WALL_SET} mat={GRANITE[ph]} />
      <path
        d={pxPath([[Z.zdrofit, GROUND - m(1.4), Z.parking - Z.zdrofit, m(0.8)]])}
        fill={s.season === "bare" ? "#5d5442" : LEAF[ph].base}
      />
      <path
        d={pxPath([[Z.zdrofit, GROUND - m(1.4), Z.parking - Z.zdrofit, 3]])}
        fill={s.season === "bare" ? "#6d6450" : LEAF[ph].hi}
      />
      <rect
        x={Z.zdrofit}
        y={GROUND - m(1.4)}
        width={Z.parking - Z.zdrofit}
        height={m(0.8)}
        fill="url(#px-grain)"
      />
      {/* the mesh fence behind the hedge, 1.80 m, which is what they always use */}
      <path
        d={pxPath([
          [Z.zdrofit, GROUND - m(1.8), Z.parking - Z.zdrofit, 2],
          ...repeat(20, 19, [Z.zdrofit + 8, GROUND - m(1.8), 2, m(0.5)] as Rect),
        ])}
        fill={CHROME[ph].deep}
        opacity={0.55}
      />
      {/* the P sign, on its own post, 2.20 m to the underside */}
      <path d={pxPath([[1352, GROUND - m(2.6), m(0.14), m(2.6)]])} fill={CHROME[ph].lo} />
      <Bevel
        boxes={[[1340, GROUND - m(2.9), m(0.7), m(0.7)]]}
        mat={{ ...COAT[ph], base: "#1d4a8a", hi: "#2f63ad" }}
      />
      <BigText x={1348} y={GROUND - m(2.8)} text="P" fill="#ffffff" k={2} />
      {/* the barrier: a 3 m arm, down across the entrance or up out of the way */}
      <Bevel
        boxes={[[1440, GROUND - m(1.1), m(0.35), m(1.1)]]}
        mat={{ ...COAT[ph], base: K.cone, hi: "#f07a4a" }}
      />
      <g
        style={{
          transition: STEP_SLIDE,
          transform: s.barrier === "up" ? "rotate(-78deg)" : "none",
          transformOrigin: `1444px ${GROUND - m(1.0)}px`,
        }}
      >
        <path d={pxPath([[1330, GROUND - m(1.02), m(3.0), 4]])} fill={K.white} />
        <path
          d={pxPath(
            bank([[0, GROUND - m(1.02), 14, 4]], 5, 28).map(
              ([x, y, w, h]) => [x + 1336, y, w, h] as Rect,
            ),
          )}
          fill={K.cone}
        />
      </g>
      {/* the pay machine beside it, and the sign nobody reads */}
      <Bevel boxes={[[1408, GROUND - m(1.35), m(0.45), m(1.35)]]} mat={COAT[ph]} />
      {px(1411, GROUND - m(1.28), m(0.32), m(0.24), ph === "night" ? K.lobbyLit : K.glass[ph])}
      <path d={pxPath([[1412, GROUND - m(0.9), 8, 4]])} fill={K.amber} />
      {/* the puddle in the corner of the plot that never dries out */}
      {isWet(s) ? (
        <g>
          <path
            d={pxPath(steppedEllipse(1250, GROUND + 12, m(1.6), m(0.2), 2))}
            fill={K.water}
            opacity={0.4}
          />
          <path
            d={pxPath(steppedEllipse(1250, GROUND + 10, m(0.8), 2, 1))}
            fill={K.waterHi}
            opacity={0.35}
          />
        </g>
      ) : null}
    </g>
  );
}

function CafeB({ ph, s }: { ph: Ph; s: DistrictState }) {
  const open = s.cafeB !== "closed";
  return (
    <g>
      {/* a smaller, plainer building — a bakery with a serving hatch, not a café */}
      <Bev set={MASS_CAFE_B} mat={STONE[ph]} />
      <rect x={Z.parking} y={0} width={W - Z.parking} height={GROUND} fill="url(#px-stucco)" />
      {px(1488, FASCIA_TOP, 140, SHOP_HEAD - FASCIA_TOP, "#8a3a2c")}
      {px(1488, FASCIA_TOP, 140, 2, "#a34c3a")}
      <BigText x={1500} y={FASCIA_TOP + 6} text={NAME_CAFE_B} fill={K.cafeCream} k={1} />
      {/* stallriser drawn with cafe A's, in STALLRISER_SET */}
      <path d={GLAZE_CAFE_B.glass} fill={open ? K.glassLit : K.glass[ph]} />
      {open ? (
        <g opacity={0.9}>
          {/* the trays of bread, which is the whole window display */}
          {px(1496, SHOP_HEAD + 4, 124, SILL - SHOP_HEAD - 4, "#6b5a44")}
          <path
            d={pxPath([
              [1500, GROUND - m(2.2), 116, 3],
              [1500, GROUND - m(1.7), 116, 3],
              [1500, GROUND - m(1.2), 116, 3],
            ])}
            fill={OAK[ph].lo}
          />
          <path
            d={pxPath([
              ...bank([[0, GROUND - m(2.4), 16, m(0.2)]], 6, 20).map(
                ([x, y, w, h]) => [x + 1504, y, w, h] as Rect,
              ),
              ...bank([[0, GROUND - m(1.9), 13, m(0.2)]], 7, 17).map(
                ([x, y, w, h]) => [x + 1502, y, w, h] as Rect,
              ),
              ...bank([[0, GROUND - m(1.4), 18, m(0.2)]], 5, 23).map(
                ([x, y, w, h]) => [x + 1504, y, w, h] as Rect,
              ),
            ])}
            fill="#c08a4a"
          />
          <path
            d={pxPath(
              bank([[0, GROUND - m(2.4), 16, 2]], 6, 20).map(
                ([x, y, w, h]) => [x + 1504, y, w, h] as Rect,
              ),
            )}
            fill="#dda868"
          />
        </g>
      ) : null}
      <path d={GLAZE_CAFE_B.mullion} fill={COAT[ph].base} />
      <path d={GLAZE_CAFE_B.head} fill={COAT[ph].mid} />
      {/* the serving hatch: 1.1 m sill, which is the whole business model */}
      <Bevel boxes={[[1636, GROUND - m(2.1), m(1.1), m(1.0)]]} mat={COAT[ph]} />
      {px(1639, GROUND - m(2.06), m(1.0), m(0.92), open ? K.glassLit : "#2a2f36")}
      {open ? (
        <g>
          <path d={pxPath([[1640, GROUND - m(1.2), m(1.0), 4]])} fill={OAK[ph].hi} />
          <path
            d={pxPath([
              [1644, GROUND - m(1.32), 7, 5],
              [1654, GROUND - m(1.32), 7, 5],
            ])}
            fill={K.cafeCream}
          />
        </g>
      ) : null}
      {/* the crossing: tactile paving, a belisha post, and the far kerb dropped */}
      <path d={pxPath([[1700, GROUND - m(2.4), m(0.14), m(2.4)]])} fill={CHROME[ph].lo} />
      <path
        d={pxPath(
          bank([[0, GROUND - m(2.4), 5, m(0.4)]], 6, m(0.4)).map(
            ([x, y, w, h]) => [x + 1699, y, w, h] as Rect,
          ),
        )}
        fill={K.white}
      />
      <Bevel
        boxes={[[1690, GROUND - m(2.9), m(0.6), m(0.6)]]}
        mat={{ ...COAT[ph], base: "#1d4a8a", hi: "#2f63ad" }}
      />
      <path d={pxPath([[1694, GROUND - m(2.82), 15, 15]])} fill="#ffffff" opacity={0.85} />
      <path d={pxPath([[1699, GROUND - m(2.76), 5, 10]])} fill="#1d4a8a" />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the pavement
 * ================================================================== */

function Pavement({ ph, s }: { ph: Ph; s: DistrictState }) {
  const slab = SLAB[ph];
  const wet = isWet(s);
  const sun = SUN[ph];
  return (
    <g>
      {px(0, GROUND, W, H - GROUND, slab.deep)}
      <path d={PAVING.face} fill={slab.base} />
      <path d={PAVING.hi} fill={slab.hi} />
      <rect x={0} y={GROUND} width={W} height={KERB - GROUND} fill="url(#px-agg)" />
      {/* the banded course along the kerb, which is always a different stone */}
      <path d={pxPath([[0, KERB - 6, W, 6]])} fill={BAND[ph].base} />
      <path d={pxPath([[0, KERB - 6, W, 1]])} fill={BAND[ph].hi} />
      {/* kerb, gutter, gullies */}
      <path d={KERB_LINE} fill={BAND[ph].hi} />
      <path d={pxPath([[0, KERB + m(0.12), W, 3]])} fill={ROADMAT[ph].base} />
      <path d={GULLIES} fill={ROADMAT[ph].deep} />
      {/* tactile paving at the crossing, and the covers, and the gum */}
      <path d={TACTILE} fill={s.weather === "clear" ? "#c9a24b" : "#a8883f"} opacity={0.85} />
      <path d={COVERS} fill={BAND[ph].mid} />
      <path d={GUM} fill={K.gum} opacity={0.7} />
      {/* what the season leaves on the slabs */}
      {s.season === "autumn" ? (
        <path
          d={pxPath([
            [280, 158, 3, 2],
            [316, 164, 2, 2],
            [352, 155, 3, 2],
            [430, 162, 2, 2],
            [520, 157, 3, 2],
            [1120, 160, 3, 2],
            [1186, 154, 2, 2],
            [1240, 165, 3, 2],
            [1300, 158, 2, 2],
            [1420, 163, 3, 2],
          ])}
          fill={K.leafDry}
        />
      ) : null}
      {s.season === "bare" ? (
        <path
          d={pxPath([
            [300, 160, 4, 2],
            [1150, 162, 5, 2],
            [1330, 158, 4, 2],
          ])}
          fill={K.leafDead}
          opacity={0.7}
        />
      ) : null}
      {/* moss in the joints on the north side, where the sun never gets */}
      <path
        d={pxPath([
          [612, GROUND + 1, 40, 1],
          [700, GROUND + 1, 26, 1],
          [820, GROUND + 1, 34, 1],
        ])}
        fill={K.moss}
        opacity={0.5}
      />
      {/* the parking bays, which are painted on and half worn off */}
      <path d={BAY_LINES} fill={K.white} opacity={0.55} />
      {/* the shadows the uprights throw, which is the sun doing the lighting */}
      {sun ? (
        <path
          d={pxPath(
            CASTERS.flatMap(([x, w]) =>
              steppedQuad(
                GROUND,
                x,
                x + w,
                GROUND + Math.round(m(sun.len) * 0.28),
                x + Math.round(m(sun.len) * sun.dx),
                x + w + Math.round(m(sun.len) * sun.dx),
                4,
              ),
            ),
          )}
          fill={dth("n", "50")}
          opacity={sun.op}
        />
      ) : null}
      {/* and the long shadow the whole building throws across the plot at dusk */}
      {ph === "dusk" ? (
        <path
          d={pxPath(
            steppedQuad(GROUND, Z.zdrofit, Z.parking, KERB, Z.zdrofit - 60, Z.parking - 60, 6),
          )}
          fill={dth("n", "25")}
          opacity={0.35}
        />
      ) : null}
      {/* wet: the slabs go dark and start reflecting the shopfronts */}
      {wet ? (
        <g>
          <rect x={0} y={GROUND} width={W} height={KERB - GROUND} fill="#1a2430" opacity={0.28} />
          <path
            d={pxPath([
              [266, GROUND + 2, 246, 6],
              [908, GROUND + 2, 156, 5],
              [1496, GROUND + 2, 124, 5],
            ])}
            fill={K.glassLit}
            opacity={0.16}
          />
          {/* the puddles that always form in the same three dips */}
          <path
            d={pxPath(steppedEllipse(392, GROUND + 12, m(1.2), m(0.16), 2))}
            fill={K.water}
            opacity={0.35}
          />
          <path
            d={pxPath(steppedEllipse(742, GROUND + 14, m(0.9), m(0.13), 2))}
            fill={K.water}
            opacity={0.32}
          />
          <path
            d={pxPath(steppedEllipse(1560, GROUND + 11, m(1.0), m(0.14), 2))}
            fill={K.water}
            opacity={0.3}
          />
        </g>
      ) : null}
      {/* the trench that has been open since before anybody worked here */}
      {s.roadworks ? (
        <g>
          <path d={pxPath([[1108, GROUND + 2, m(2.2), 14]])} fill={ROADMAT[ph].deep} />
          <path d={pxPath([[1108, GROUND + 2, m(2.2), 2]])} fill={K.tape} opacity={0.8} />
          <path
            d={pxPath(
              bank([[0, GROUND - m(1.0), 3, m(1.0)]], 4, 26).map(
                ([x, y, w, h]) => [x + 1106, y, w, h] as Rect,
              ),
            )}
            fill={K.cone}
          />
          <path d={pxPath([[1106, GROUND - m(1.0), 82, 3]])} fill={K.tape} />
          <path d={pxPath([[1106, GROUND - m(0.7), 82, 2]])} fill={K.white} opacity={0.6} />
        </g>
      ) : null}
      <Contact set={STREET_CONTACT} op={ph === "night" ? 0.5 : 0.9} />
      <AOSet set={STREET_AO} op={ph === "night" ? 0.6 : 0.95} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — the street
 * ================================================================== */

function StreetKit({ ph, s }: { ph: Ph; s: DistrictState }) {
  const open = s.cafeA !== "closed";
  return (
    <g>
      {/* lamp columns, 5 m, so only the bottom two thirds is in frame */}
      <path d={LAMP_COLUMNS} fill={COAT[ph].base} />
      <path d={pxPath(LAMP_X.map((x) => [x - 2, 0, 2, GROUND] as Rect))} fill={COAT[ph].hi} />
      {/* bike stands and the bikes on them: 1.75 m long, 1.05 m tall */}
      <path d={BIKE_STANDS} fill={CHROME[ph].lo} />
      {s.crowd >= 1 ? <Bicycle x={100} ph={ph} /> : null}
      {s.crowd >= 3 ? <Bicycle x={176} ph={ph} /> : null}
      {/* bollards along the kerb */}
      <path d={BOLLARDS.body} fill={COAT[ph].base} />
      <path d={BOLLARDS.hi} fill={K.white} opacity={0.5} />
      {/* the trees: 0.30 m trunks in 1.2 m pits, canopies off the top of frame */}
      {[214, 538, 1004, 1360, 1650].map((x) => (
        <g key={`tr${x}`}>
          <path d={pxPath([[x - 20, GROUND - 2, 40, 4]])} fill={BAND[ph].deep} />
          <path
            d={pxPath([[x - 6, 0, m(0.3), GROUND]])}
            fill={s.season === "bare" ? "#5d5040" : M.wood.lo}
          />
          <path
            d={pxPath([[x - 6, 0, 3, GROUND]])}
            fill={s.season === "bare" ? "#6d6050" : M.wood.base}
          />
          {/* the guard rail every newly planted street tree in Poland has */}
          <path
            d={pxPath([
              [x - 14, GROUND - m(0.8), 3, m(0.8)],
              [x + 11, GROUND - m(0.8), 3, m(0.8)],
              [x - 14, GROUND - m(0.8), 28, 2],
            ])}
            fill={COAT[ph].mid}
          />
        </g>
      ))}
      {/* café seating, out when it is open and dry */}
      {open && !isWet(s) ? (
        <g>
          <path d={CAFE_SET} fill={COAT[ph].base} />
          <path
            d={pxPath([
              [294, GROUND - m(0.78), 10, 3],
              [402, GROUND - m(0.78), 8, 3],
            ])}
            fill={K.cafeCream}
          />
          {/* the A-board, and the ashtray on the far table */}
          <Bevel boxes={[[344, GROUND - m(0.9), m(0.55), m(0.9)]]} mat={COAT[ph]} />
          {px(346, GROUND - m(0.86), m(0.45), m(0.7), "#2a2f2c")}
          <PixelText x={348} y={GROUND - m(0.78)} text="KAWA" fill={K.cafeCream} gap={1} />
          <PixelText x={348} y={GROUND - m(0.6)} text="12" fill={K.amber} gap={1} />
        </g>
      ) : (
        /* closed or raining: stacked and chained to the downpipe */
        <g>
          <path
            d={pxPath([
              [290, GROUND - m(1.1), m(0.5), m(1.1)],
              [310, GROUND - m(1.0), m(0.5), m(1.0)],
              [286, GROUND - m(0.8), m(1.3), 3],
            ])}
            fill={COAT[ph].base}
          />
          <path d={pxPath([[286, GROUND - m(0.55), m(1.4), 2]])} fill={CHROME[ph].deep} />
        </g>
      )}
      {/* planter troughs and the box hedge in them */}
      <path d={TROUGHS.box} fill={GRANITE[ph].base} />
      <path d={TROUGHS.hi} fill={GRANITE[ph].hi} />
      <path d={TROUGHS.hedge} fill={s.season === "bare" ? "#5d5442" : LEAF[ph].base} />
      <path
        d={pxPath([
          [530, GROUND - m(0.85), 44, 2],
          [583, GROUND - m(0.85), 44, 2],
        ])}
        fill={s.season === "bare" ? "#6d6450" : LEAF[ph].hi}
      />
      {/* the bins: 1.0 m, and what they look like when nobody has emptied them */}
      <Bins ph={ph} level={s.bins} />
      {/* the cars in the bays, batched by part */}
      {Array.from({ length: s.parking }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: bays are positional; the array is the layout
        <g key={`car${i}`}>
          <path d={pxPath(PARKED[i].lower)} fill={CAR_COLOURS[i]} />
          <path d={pxPath(PARKED[i].upper)} fill={CAR_COLOURS[i]} />
          <path d={pxPath(PARKED[i].roof)} fill={CAR_COLOURS[i]} />
          <path
            d={pxPath([
              ...PARKED[i].lower.map(([x, y, w]) => [x, y, w, 2] as Rect),
              ...PARKED[i].roof.map(([x, y, w]) => [x, y, w, 1] as Rect),
            ])}
            fill="#ffffff"
            opacity={0.18}
          />
        </g>
      ))}
      {s.parking > 0 ? (
        <g>
          <path
            d={pxPath(PARKED.slice(0, s.parking).flatMap((c) => c.glass))}
            fill={ph === "night" ? "#141a22" : K.glass[ph]}
          />
          <path
            d={pxPath(PARKED.slice(0, s.parking).flatMap((c) => c.bumper))}
            fill={COAT[ph].mid}
          />
          <path
            d={pxPath(PARKED.slice(0, s.parking).flatMap((c) => c.tyre))}
            fill={COAT[ph].deep}
          />
          <path
            d={pxPath(PARKED.slice(0, s.parking).flatMap((c) => c.lampR))}
            fill={K.red}
            opacity={0.8}
          />
          <path d={pxPath(PARKED.slice(0, s.parking).flatMap((c) => c.plate))} fill={K.white} />
        </g>
      ) : null}
      {/* the delivery van on the loading bay, if there is one */}
      {s.delivery === "van" ? <Van x={600} ph={ph} /> : null}
      {/* the courier's bike, dumped on the kerb because he is inside */}
      {s.delivery === "courier" ? (
        <g>
          <Bicycle x={452} ph={ph} cargo />
        </g>
      ) : null}
      {/* the Friday food truck, when it is Friday */}
      {s.market ? <FoodTruck x={1180} ph={ph} /> : null}
    </g>
  );
}

/** 1.75 m long, 1.05 m tall, and the wheels are 0.67 m, which is a 700c. */
function Bicycle({ x, ph, cargo }: { x: number; ph: Ph; cargo?: boolean }) {
  const wheel = m(0.67);
  const hub = GROUND - wheel / 2;
  return (
    <g>
      <path
        d={pxPath([
          [x, GROUND - wheel, wheel, wheel],
          [x + m(1.05), GROUND - wheel, wheel, wheel],
        ])}
        fill={COAT[ph].deep}
      />
      <path
        d={pxPath([
          [x + 4, GROUND - wheel + 4, wheel - 8, wheel - 8],
          [x + m(1.05) + 4, GROUND - wheel + 4, wheel - 8, wheel - 8],
        ])}
        fill="none"
      />
      <path
        d={pxPath([
          [x + 10, hub - m(0.35), 3, m(0.35)],
          [x + 12, GROUND - m(0.95), m(0.85), 3],
          [x + m(0.62), hub - m(0.3), 3, m(0.3)],
          [x + m(1.0), hub - m(0.4), 3, m(0.4)],
        ])}
        fill={cargo ? K.brand : "#2f6a9e"}
      />
      <path d={pxPath([[x + 8, GROUND - m(1.02), m(0.42), 3]])} fill={COAT[ph].base} />
      <path d={pxPath([[x + m(0.58), GROUND - m(0.9), m(0.24), 4]])} fill={COAT[ph].base} />
      {cargo ? (
        <g>
          {/* the insulated box, which is 0.45 m cubed and always slightly open */}
          <Bevel
            boxes={[[x + m(0.5), GROUND - m(1.4), m(0.45), m(0.45)]]}
            mat={{ ...COAT[ph], base: K.brand, hi: K.brandHi }}
          />
          <path d={pxPath([[x + m(0.52), GROUND - m(1.4), 13, 3]])} fill={K.brandLo} />
        </g>
      ) : null}
    </g>
  );
}

/** A 5.5 m panel van, 2.5 m tall, so its roof is 95 px up and still in frame. */
function Van({ x, ph }: { x: number; ph: Ph }) {
  return (
    <g>
      <Bevel
        boxes={[[x, GROUND - m(2.5), m(5.5), m(2.16)]]}
        mat={{ ...CHROME[ph], base: "#d2d0ca", hi: "#e6e4de" }}
      />
      <path d={pxPath([[x + m(4.3), GROUND - m(2.3), m(1.1), m(0.7)]])} fill={K.glass[ph]} />
      <path d={pxPath([[x + m(0.2), GROUND - m(2.2), m(2.6), m(1.2)]])} fill="#c2c0ba" />
      <PixelText
        x={x + 14}
        y={GROUND - m(1.9)}
        text="DOSTAWA"
        fill={COAT[ph].base}
        gap={1}
        op={0.7}
      />
      <path
        d={pxPath([
          [x + m(0.7), GROUND - m(0.34), m(0.65), m(0.34)],
          [x + m(4.2), GROUND - m(0.34), m(0.65), m(0.34)],
        ])}
        fill={COAT[ph].deep}
      />
      <path d={pxPath([[x + m(5.4), GROUND - m(1.6), 6, 6]])} fill={K.amber} />
      {/* the hazards, because he is on the pavement and he knows it */}
      <path d={pxPath([[x + 2, GROUND - m(1.5), 7, 6]])} fill={K.amber}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.15;1;0.15"
          dur="1.1s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

/** The Friday truck: a 4 m trailer with a hatch and a queue in front of it. */
function FoodTruck({ x, ph }: { x: number; ph: Ph }) {
  return (
    <g>
      <Bevel
        boxes={[[x, GROUND - m(2.4), m(4.0), m(2.0)]]}
        mat={{ ...COAT[ph], base: "#3f6b7a", hi: "#5f8f9e" }}
      />
      <path d={pxPath([[x + m(0.6), GROUND - m(2.0), m(2.6), m(0.9)]])} fill={K.glassLit} />
      <path d={pxPath([[x + m(0.5), GROUND - m(2.5), m(2.8), 5]])} fill="#2c4a55" />
      <path d={pxPath([[x + m(0.6), GROUND - m(1.1), m(2.6), 4]])} fill={OAK[ph].hi} />
      <PixelText x={x + 30} y={GROUND - m(2.34)} text="ZAPIEKANKI" fill={K.cafeCream} gap={1} />
      <path
        d={pxPath([
          [x + m(0.5), GROUND - m(0.4), m(0.6), m(0.4)],
          [x + m(2.9), GROUND - m(0.4), m(0.6), m(0.4)],
        ])}
        fill={COAT[ph].deep}
      />
      <path d={pxPath([[x - 6, GROUND - m(0.9), 6, m(0.9)]])} fill={CHROME[ph].lo} />
    </g>
  );
}

function Bins({ ph, level }: { ph: Ph; level: 0 | 1 | 2 }) {
  return (
    <g>
      {/* two 1.0 m bins on the same post, because the council does recycling */}
      <Bev set={BINS_SET} mat={COAT[ph]} />
      <path d={pxPath([[318, GROUND - m(1.0), 15, 3]])} fill="#2f6a3e" />
      <path d={pxPath([[336, GROUND - m(1.0), 15, 3]])} fill="#c9a24b" />
      {level >= 1 ? (
        <path
          d={pxPath([
            [320, GROUND - m(1.1), 9, 5],
            [338, GROUND - m(1.08), 11, 4],
          ])}
          fill={K.white}
          opacity={0.85}
        />
      ) : null}
      {level >= 2 ? (
        <g>
          {/* overflowing, and a cup on the slabs, and the gull that came for it */}
          <path
            d={pxPath([
              [316, GROUND - m(1.22), 13, 6],
              [334, GROUND - m(1.2), 15, 6],
              [352, GROUND - 8, 7, 8],
            ])}
            fill={K.white}
            opacity={0.85}
          />
          <g>
            <path
              d={pxPath([
                [362, GROUND - 12, 13, 7],
                [374, GROUND - 16, 6, 5],
              ])}
              fill={K.gull}
            />
            <path d={pxPath([[362, GROUND - 12, 13, 2]])} fill={K.gullDark} />
            <path d={pxPath([[378, GROUND - 15, 3, 2]])} fill={K.amber} />
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="discrete"
              values="0 0;3 0;3 -2;0 0;-2 0;0 0"
              dur="4.6s"
              repeatCount="indefinite"
            />
          </g>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 5 — people, all 67 px tall because that is 1.75 m
 * ================================================================== */

/** Behind the counter, so she is cut off at 1.05 m like everyone behind a counter. */
// The hand-drawn Barista, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Barista({ ph: _ph }: { ph: Ph }) {
  const x = 316;
  const head = GROUND - m(1.72);
  return (
    <g>
      {px(x + 1, head, 12, 4, "#2f2318")}
      {px(x, head + 3, 14, 4, "#3a2c1e")}
      {px(x + 1, head + 7, 12, 9, K.skin)}
      {px(x + 1, head + 13, 12, 3, K.skinLo)}
      <path
        d={pxPath([
          [x + 3, head + 9, 2, 2],
          [x + 9, head + 9, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(x - 1, head + 17, 16, m(0.42), K.cafe)}
      {px(x - 1, head + 17, 16, 2, K.cafeHi)}
      {px(x + 2, head + 24, 10, m(0.28), "#243d33")}
      {/* the arm on the group head, which is the only thing that moves */}
      <g>
        {px(x - 5, head + 20, 5, m(0.3), K.cafe)}
        {px(x - 5, head + 30, 5, 4, K.skin)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x - 3} ${head + 22};-14 ${x - 3} ${head + 22};4 ${x - 3} ${head + 22};0 ${x - 3} ${head + 22}`}
          dur="4.3s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** By the stub bin outside the office, in a coat, because it is October. */
// The hand-drawn Smoker, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Smoker({ ph: _ph }: { ph: Ph }) {
  const x = 586;
  const head = GROUND - m(1.75);
  return (
    <g>
      {px(x + 2, head, 11, 4, "#241c14")}
      {px(x + 2, head + 4, 11, 9, K.skin)}
      {px(x + 2, head + 10, 11, 3, K.skinLo)}
      <path
        d={pxPath([
          [x + 4, head + 6, 2, 2],
          [x + 9, head + 6, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {/* the coat, 0.75 m of it, and the lanyard he has not taken off */}
      {px(x, head + 14, 15, m(0.75), K.coat)}
      {px(x, head + 14, 15, 2, "#4a5460")}
      {px(x + 6, head + 16, 3, m(0.3), K.brand)}
      {px(x + 1, head + 42, 6, m(0.5), "#2a2f36")}
      {px(x + 8, head + 42, 6, m(0.5), "#2a2f36")}
      {px(x, head + 61, 8, 5, COAT.day.base)}
      {px(x + 8, head + 61, 8, 5, COAT.day.base)}
      {/* the hand and the cigarette, which is the moving part */}
      <g>
        {px(x + 15, head + 18, 4, m(0.34), K.coat)}
        {px(x + 15, head + 31, 4, 4, K.skin)}
        {px(x + 18, head + 30, 4, 1, K.white)}
        {px(x + 22, head + 30, 1, 1, K.cone)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          calcMode="discrete"
          values={`0 ${x + 16} ${head + 20};-52 ${x + 16} ${head + 20};-52 ${x + 16} ${head + 20};0 ${x + 16} ${head + 20};0 ${x + 16} ${head + 20}`}
          dur="11s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** The courier, at the café door, in the shell jacket, on his phone. */
// The hand-drawn Courier, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Courier() {
  const x = 502;
  const head = GROUND - m(1.72);
  return (
    <g>
      {px(x + 1, head - 4, 13, 6, K.brandLo)}
      {px(x + 1, head - 4, 13, 2, K.brand)}
      {px(x + 2, head + 2, 11, 9, K.skin)}
      {px(x + 2, head + 8, 11, 3, K.skinLo)}
      <path
        d={pxPath([
          [x + 4, head + 4, 2, 2],
          [x + 9, head + 4, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(x, head + 12, 15, m(0.62), K.brand)}
      {px(x, head + 12, 15, 2, K.brandHi)}
      {px(x - 3, head + 14, 4, m(0.4), K.brandLo)}
      {px(x + 1, head + 36, 6, m(0.52), "#22262b")}
      {px(x + 8, head + 36, 6, m(0.52), "#22262b")}
      {px(x, head + 56, 8, 5, K.white)}
      {px(x + 8, head + 56, 8, 5, K.white)}
      {/* the phone, held at the angle a man holds a phone he is annoyed by */}
      {px(x + 15, head + 16, 4, m(0.3), K.brand)}
      {px(x + 15, head + 27, 5, 4, K.skin)}
      {px(x + 17, head + 24, 4, 6, COAT.day.base)}
      <path d={pxPath([[x + 18, head + 25, 2, 4]])} fill={K.lobbyLit}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.7;1;0.85"
          dur="3.3s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

/** Walking past with a cup, which is the single most Alchemia thing there is. */
// The hand-drawn Walker, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Walker({ ph: _ph }: { ph: Ph }) {
  const x = 1130;
  const head = GROUND - m(1.68);
  return (
    <g>
      <g>
        {px(x + 1, head, 12, 8, "#5d3f2a")}
        {px(x + 2, head + 7, 11, 9, K.skin)}
        {px(x + 2, head + 13, 11, 3, K.skinLo)}
        <path
          d={pxPath([
            [x + 4, head + 9, 2, 2],
            [x + 9, head + 9, 2, 2],
          ])}
          fill="#3d2a1a"
        />
        {px(x, head + 8, 3, m(0.4), "#5d3f2a")}
        {px(x + 12, head + 8, 3, m(0.4), "#5d3f2a")}
        {px(x, head + 17, 15, m(0.66), K.coatB)}
        {px(x, head + 17, 15, 2, "#8a6250")}
        {px(x + 1, head + 42, 6, m(0.5), "#2a2f36")}
        {px(x + 8, head + 42, 6, m(0.5), "#2a2f36")}
        {px(x, head + 61, 8, 5, COAT.day.mid)}
        {px(x + 8, head + 61, 8, 5, COAT.day.mid)}
        {/* the tote on one shoulder and the cup in the other hand */}
        {px(x + 14, head + 20, 4, m(0.34), K.coatB)}
        {px(x + 14, head + 33, 5, 4, K.skin)}
        {px(x + 15, head + 29, 5, 7, K.cafeCream)}
        {px(x + 15, head + 29, 5, 2, "#8a6a4a")}
        {px(x - 4, head + 22, 4, m(0.5), "#4a5a3a")}
        {/* one gentle bob, so she reads as walking without a walk cycle */}
        <animateTransform
          attributeName="transform"
          type="translate"
          calcMode="discrete"
          values="0 0;0 -1;0 0;0 -1"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** The square's cast is drawn as NpcActors in the Effects plane now. */
function People(_props: { ph: Ph; s: DistrictState }) {
  return null;
}

/* ================================================================== *
 * scene
 * ================================================================== */

function DistrictScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world);
  return (
    <LayeredScene
      /* the towers are hundreds of metres out; they should barely move */
      parallax={{ farBackground: 0.86, middleBackground: 1 }}
      farBackground={<Backdrop ph={ph} s={s} />}
      middleBackground={<Facades ph={ph} s={s} gym={gymFront(world)} world={world} />}
      ground={<Pavement ph={ph} s={s} />}
      staticObjects={<StreetKit ph={ph} s={s} />}
      gameplayObjects={<People ph={ph} s={s} />}
    />
  );
}

/* ================================================================== *
 * foreground — the road, which is nearer than the player
 * ================================================================== */

function DistrictFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = world ? state(world) : null;
  const wet = s ? isWet(s) : false;
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
        {/* a branch across the top of the frame, because the canopies are up there */}
        <path
          d={pxPath([
            [180, 0, 260, 4],
            [300, 4, 90, 3],
            [420, 3, 140, 4],
          ])}
          fill={s?.season === "bare" ? "#4a4038" : M.wood.deep}
        />
        {s?.season !== "bare" ? (
          <path
            d={pxPath([
              [206, 4, 22, 8],
              [252, 4, 18, 10],
              [318, 7, 20, 8],
              [446, 7, 24, 9],
              [502, 6, 18, 8],
            ])}
            fill={s?.season === "autumn" ? "#a8763a" : LEAF[ph].base}
          />
        ) : null}
        {/* the tram wire, one pixel, which is all a wire ever is */}
        <path d={pxPath([[0, 16, W, 1]])} fill="#2e3033" opacity={0.5} />
        {/* the carriageway, nearer than the pavement, with the rail in it */}
        {px(0, ROAD, W, H - ROAD, ROADMAT[ph].base)}
        {px(0, ROAD, W, 1, ROADMAT[ph].hi)}
        <rect x={0} y={ROAD} width={W} height={H - ROAD} fill="url(#px-agg)" />
        {/* the tram rail: 1.435 m gauge, so 55 px, and only one rail is in frame */}
        <path d={pxPath([[0, 176, W, 2]])} fill={CHROME[ph].lo} />
        <path d={pxPath([[0, 176, W, 1]])} fill={CHROME[ph].hi} />
        <path d={pxPath([[0, 178, W, 2]])} fill={ROADMAT[ph].deep} />
        {wet ? (
          <rect x={0} y={ROAD} width={W} height={H - ROAD} fill="#101a26" opacity={0.3} />
        ) : null}
        <Vignette set={VIGNETTE} strength={ph === "night" ? 1 : 0.6} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * effects
 * ================================================================== */

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.5 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

const BARISTA_LINES = [
  "Na miejscu czy na wynos?",
  "Filtr dzisiaj etiopski. Nie, nie jest kwaśny.",
  "Ten pan z siłowni znowu bierze podwójne espresso o dwudziestej drugiej.",
  "Kurier stoi w drzwiach od dziesięciu minut i patrzy w telefon.",
  "O siódmej otwierałam sama. Mgła była taka, że nie widziałam Argonu.",
] as const;

const SMOKER_LINES = [
  "Jeszcze jeden i wracam na górę. Serio.",
  "Piętnaście minut. Tak mówiłem godzinę temu.",
  "Kurwa, znowu zapalniczka nie działa.",
  "Nie palę dużo. Tylko jak wychodzę. I jak wracam.",
  "Wrócę za chwilę. Co może pójść nie tak?",
  "Znowu ktoś zostawił śmieci pod klatką. Ludzie to jednak mają talent.",
  "Dobra, ostatni. Naprawdę ostatni.",
  "Szef dzwoni? Nie widziałem telefonu.",
  "Miałem dzisiaj nic nie pić. Na szczęście jeszcze jest rano.",
  "Mewy tu są większe niż na Zaspie. I bardziej bezczelne.",
] as const;

/** The hour, as a colour over everything. Outdoors this is the whole model. */
const CAST: Record<Ph, { fill: string; op: number }> = {
  dawn: { fill: DAWN_CAST, op: 0.2 },
  day: { fill: "#fff4d8", op: 0.05 },
  dusk: { fill: DUSK_CAST, op: 0.22 },
  night: { fill: NIGHT_CAST, op: 0.46 },
};

/** Rain: three sheets at three speeds, one path and one animation each. */
const RAIN_SHEETS = [0, 1, 2].map((i) =>
  pxPath(
    Array.from(
      { length: 60 },
      (_, j) =>
        [
          ((j * 137 + i * 43) % (W + 40)) - 20,
          ((j * 53 + i * 29) % 200) - 20,
          1,
          i === 0 ? 7 : i === 1 ? 5 : 4,
        ] as Rect,
    ),
  ),
);

function DistrictEffects({
  world,
  phase,
  scale,
  actionUi,
  dialogueOpen,
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
  const s = state(world);
  const who = whoIsHere(s);
  const cast = CAST[ph];
  const lit = lampsOn(s, ph);
  const night = ph === "night";
  return (
    <>
      {/* the square's people, built from the rig */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {who.barista ? (
          /* behind the hatch he serves from, cut off at the stallriser */
          <NpcActor npc={NPCS.barista} x={428} facing={1} cropBelow={SILL} shadow={false} />
        ) : null}
        {who.smoker ? <NpcActor npc={NPCS.smoker} x={593} facing={-1} /> : null}
        {who.smoker ? <NpcActor npc={NPCS.caller} x={934} facing={-1} /> : null}
        {who.courier ? <NpcActor npc={NPCS.courier} x={509} facing={1} /> : null}
        {/* the walker is a runtime actor: he actually crosses the square */}
      </svg>
      {who.barista ? (
        <Monologue
          x={322}
          headY={GROUND - m(1.72)}
          scale={scale}
          speaker="Barista"
          lines={BARISTA_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {who.smoker ? (
        <Monologue
          x={592}
          headY={GROUND - m(1.75)}
          scale={scale}
          speaker="Pan z Aurum"
          lines={SMOKER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {/* steam off a cup, off the extract flue, off a manhole when it is cold */}
      {s.cafeA !== "closed" ? <Steam x={344} y={GROUND - m(0.9)} scale={scale} slow /> : null}
      {s.cafeA !== "closed" ? <Steam x={Z.stop + 4} y={24} scale={scale} /> : null}
      {ph === "dawn" && isWet(s) ? <Steam x={742} y={GROUND + 2} scale={scale} slow /> : null}
      {who.smoker ? <Steam x={608} y={GROUND - m(1.4)} scale={scale} slow /> : null}
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
            fill={cast.fill}
            opacity={cast.op}
            style={{ transition: STEP_FADE }}
          />
          {/* the four artificial sources, at four temperatures */}
          <g opacity={lit ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={LAMP_POOLS} />
            <path
              d={bulbPaths(LAMP_X.map((x) => [x, 6] as const)).halo}
              fill={dth("c", "12")}
              opacity={0.3}
            />
          </g>
          {s.cafeA !== "closed" ? <Light set={CAFE_SPILL_A} op={night ? 1 : 0.35} /> : null}
          {s.cafeB !== "closed" ? <Light set={CAFE_SPILL_B} op={night ? 1 : 0.3} /> : null}
          <Light set={LOBBY_SPILL} op={night ? 1 : 0.25} />
          {s.zdrofitOpen ? <Light set={GYM_SPILL} op={night ? 1 : 0.3} /> : null}

          {/* rain, three sheets, and the bounce off the slabs */}
          {s.weather === "rain" ? (
            <g>
              {RAIN_SHEETS.map((d, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static rain sheets
                <path key={i} d={d} fill="#a8bccc" opacity={0.4 - i * 0.08}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0 0;${-8 - i * 3} 200`}
                    dur={`${0.7 + i * 0.25}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}
              <path
                d={pxPath(
                  Array.from({ length: 26 }, (_, i) => [40 + i * 68, GROUND + 2, 2, 1] as Rect),
                )}
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
          {/* overcast flattens the whole frame, which is most of the year here */}
          {s.weather === "overcast" ? (
            <rect width={W} height={H} fill="#9aa4ac" opacity={0.14} />
          ) : null}

          {/* a car going past on the near carriageway, headlights at night */}
          <g>
            <g transform={`translate(0 ${ROAD - m(1.45) - 2})`}>
              <path d={pxPath([[0, 22, m(4.4), 20]])} fill="#2f3e52" />
              <path d={pxPath([[14, 6, m(3.0), 18]])} fill="#2f3e52" />
              <path d={pxPath([[24, 9, 80, 11]])} fill={night ? "#141a22" : K.glass[ph]} />
              <path d={pxPath([[0, 22, m(4.4), 2]])} fill="#43536b" />
              <path
                d={pxPath([
                  [18, 38, 24, 10],
                  [110, 38, 24, 10],
                ])}
                fill={COAT.day.deep}
              />
              {night ? (
                <>
                  <path d={pxPath([[0, 28, 6, 5]])} fill={K.lamp} />
                  <path d={pxPath([[160, 28, 6, 5]])} fill={K.red} />
                  <path
                    d={pxPath(steppedQuad(26, -60, 0, 44, -130, 6, 6))}
                    fill={dth("c", "12")}
                    opacity={0.4}
                  />
                </>
              ) : null}
            </g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`${W + 40} 0;${W + 40} 0;-200 0;-200 0`}
              keyTimes="0;0.55;0.78;1"
              dur="27s"
              repeatCount="indefinite"
            />
          </g>

          {/* --- transients --- */}
          {actionUi === "smoke" ? (
            <path d={pxPath([[598, GROUND - m(1.5), 2, 2]])} fill={K.white} opacity={0.5} />
          ) : null}
          {actionUi === "use" ? (
            <path
              d={pxPath(steppedEllipse(344, GROUND - m(0.8), m(0.5), m(0.16), 2))}
              fill={dth("w", "25")}
              opacity={0.5}
            />
          ) : null}
          {/* a pigeon on the slabs whenever the bins are worth it */}
          {s.bins >= 1 ? (
            <g>
              <path
                d={pxPath([
                  [404, GROUND - 8, 11, 6],
                  [414, GROUND - 11, 5, 4],
                ])}
                fill="#6d7278"
              />
              <path d={pxPath([[404, GROUND - 8, 11, 2]])} fill="#8d939b" />
              <animateTransform
                attributeName="transform"
                type="translate"
                calcMode="discrete"
                values="0 0;5 0;5 0;12 0;8 0;0 0"
                dur="8.4s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition
 * ================================================================== */

/** Every world read the art performs, in order, for when this gets an artKey. */
export function districtArtKey(world: WorldState, phase: string): string {
  const s = state(world);
  return [
    phase,
    s.weather,
    s.season,
    s.cafeA,
    s.cafeB,
    s.parking,
    s.barrier,
    s.bins,
    s.lamps,
    s.crowd,
    s.delivery,
    s.roadworks ? 1 : 0,
    s.market ? 1 : 0,
    s.zdrofitOpen ? 1 : 0,
  ].join("|");
}

export const DISTRICT_SCENE: RuntimeSceneDef<WorldState> = {
  id: "district",
  width: W,
  /**
   * THE PAVEMENT, which this scene has been drawing all along.
   *
   * GROUND is the shopfront line and KERB is where the slabs stop; the eighteen
   * pixels between them are half a metre of pavement that nobody could stand on.
   * The band takes all of it but the last two, so the feet can reach the kerb
   * and never the carriageway — a square you can be crossed diagonally is worth
   * more than one you can be walked along.
   *
   * The lamp columns get blockers because they are the one thing drawn standing
   * ON the pavement rather than against a building, and walking through a
   * lamp post is the single most obvious tell that a scene has no floor.
   */
  ground: {
    top: GROUND,
    bottom: KERB - 2,
    zones: [
      { x0: 0, x1: W, y0: KERB - 5, y1: KERB - 2, kind: "kerb" },
      { x0: 0, x1: W, kind: "slabs" },
    ],
    blockers: LAMP_X.map((x) => ({ x0: x - 5, y0: GROUND, x1: x + 8, y1: GROUND + 5 })),
  },
  /**
   * Somebody actually walking across the square, stepped in the game loop
   * rather than in React: a patrol between the kiosk and the crossing, with a
   * pause at each end for the traffic. A square with nobody crossing it is a
   * photograph, not a place.
   */
  actors: [
    npcToActor(NPCS.walker, {
      x: 1180,
      patrol: { from: 1020, to: 1340, speed: 15, pauseMs: 2800 },
      visible: (world) => whoIsHere(state(world)).walker,
      z: 6,
    }),
  ],
  objects: [
    /* --- the stop end: this is how you get to the rest of the city --- */
    {
      id: "district-steps",
      kind: "flatdoor",
      priority: 1,
      x: 40,
      range: 30,
      to: { scene: "outside", spawnX: 1240 },
    },
    { id: "district-bikes", kind: "flavor", x: 130, range: 22 },
    { id: "district-shelter", kind: "flavor", x: 234, range: 28 },
    /**
     * Up onto the SKM platform. The viaduct is already drawn overhead in the
     * far plane at this end of the square, so the stair goes where the stair
     * would actually be — under it.
     */
    {
      id: "district-skm",
      kind: "stairs",
      priority: 2,
      x: 250,
      range: 26,
      to: { scene: "station", spawnX: 150 },
    },
    { id: "district-ticket", kind: "flavor", x: 274, range: 10 },
    /* --- café A --- */
    { id: "cafe-orbita-tables", kind: "flavor", x: 300, range: 14 },
    { id: "district-bins", kind: "flavor", x: 334, range: 18 },
    { id: "cafe-orbita-board", kind: "flavor", x: 360, range: 8 },
    { id: "cafe-orbita", kind: "sport", action: "use", x: 412, range: 30 },
    { id: "cafe-orbita-door", kind: "flavor", x: 474, range: 26 },
    { id: "district-troughs", kind: "flavor", x: 552, range: 26 },
    /* --- the office --- */
    { id: "aurum-stub-bin", kind: "flavor", x: 600, range: 18 },
    { id: "aurum-lobby", kind: "flavor", x: 660, range: 34 },
    { id: "aurum-door", kind: "flavor", x: 738, range: 32 },
    { id: "aurum-plaque", kind: "flavor", x: 816, range: 30 },
    /* --- the gym. This is the one that matters. --- */
    { id: "zdrofit-window", kind: "flavor", x: 906, range: 46 },
    {
      id: "zdrofit-entrance",
      kind: "flatdoor",
      priority: 1,
      x: 1000,
      range: 40,
      /* land the player on the pavement outside the gym's own stair */
      to: { scene: "gym", spawnX: 70 },
    },
    { id: "zdrofit-board", kind: "flavor", x: 1054, range: 10 },
    /* --- the plot and the parking --- */
    { id: "district-trench", kind: "flavor", x: 1130, range: 34 },
    { id: "district-parking", kind: "flavor", x: 1240, range: 60 },
    { id: "district-parking-sign", kind: "flavor", x: 1348, range: 20 },
    { id: "district-paystation", kind: "flavor", x: 1414, range: 14 },
    { id: "district-barrier", kind: "openable", x: 1444, range: 14 },
    /* --- café B and the crossing --- */
    { id: "piekarnia-window", kind: "flavor", x: 1548, range: 46 },
    { id: "piekarnia-hatch", kind: "sport", action: "use", x: 1648, range: 26 },
    { id: "district-crossing", kind: "flavor", x: 1708, range: 32 },
  ],
  Component: ({ world, phase }) => <DistrictScene world={world} phase={phase} />,
  /** Outdoors: the sun and the lamps do it all, so nothing global here. */
  darkness: () => 0,
  Foreground: (p) => <DistrictFront {...p} />,
  Effects: DistrictEffects,
  idleLean: true,
};
