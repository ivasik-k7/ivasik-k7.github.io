import {
  AOSet,
  aoPaths,
  Bev,
  Bicycle,
  bevelPaths,
  bicycle,
  bulbPaths,
  Contact,
  cableY,
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
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  STEP_FADE,
  steppedCable,
  steppedCone,
  steppedEllipse,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { dayPhase, type WorldState } from "@/lib/worldState";
import {
  ABOARD_PALETTE,
  aboardMap,
  BARREL_PALETTE,
  barrelMap,
  CRATES_PALETTE,
  cratesMap,
  DRUM_PALETTE,
  drumMap,
  KOSZ_PALETTE,
  koszMap,
  PICNIC_PALETTE,
  picnicMap,
  propActor,
} from "./bandProps";
import { NPCS } from "./npcs";

// --- ULICA ELEKTRYKÓW / the yard at night ------------------------------------

/**
 * Ulica Elektryków, inside the old Gdańsk shipyard.
 *
 * ==================================================================
 * WHAT THIS PLACE IS. A service road between two assembly halls of the
 * Stocznia Gdańska, named for the electricians' workshops that lined it, shut
 * with the yard in the nineties and reopened a decade ago as the city's summer
 * street: container bars against the brick, food trailers on the concrete,
 * festoon bulbs strung where the crane cables ran, and a club in the end bay
 * of the far hall. Nothing here was built for nightlife and all of it is used
 * for nightlife, which is the entire look: the newest object on the street is
 * a menu board and the oldest is the hall it leans on.
 *
 * SCALE. House key, both axes: PPM = 38 px per metre, the same 67 px adult as
 * every other exterior. 1720 px is 45 m of street. The halls are the one thing
 * drawn *over* frame height on purpose — a shipyard hall is 18 m to the eaves
 * and the eaves simply do not fit, which is what standing next to one is like.
 *
 *     adult 1.75 m 67 px   container (20 ft) 6.06 m 230 px, 2.59 m 98 px high
 *     hall window bay 3.2 m 122 px           door leaf 2.10 m 80 px
 *     beer barrel table 1.10 m 42 px         portal crane leg 2.4 m 91 px wide
 *
 * SIX PLANES:
 *   farBackground (0.9) — the yard beyond: sky, the portal cranes (one of them
 *     floodlit magenta after dark, which the real street does), the hull
 *     halls, slipway gantries, the city's glow to the south.
 *   middleBackground — the two halls and everything bolted to them: brick
 *     piers, steel-arched windows, the chained works gate, the mural, the
 *     pipe bridge across the gap, the substation kiosk, posters over posters.
 *   ground — concrete plates with the shipyard rail pair still set into them,
 *     drains, weeds in the joints, cable ramps, chalk, bottle caps.
 *   staticObjects — the container bar, the frytki trailer, barrel tables,
 *     pallet bench, the event board, the queue barriers, portaloos, the
 *     generator, the bike pile.
 *   gameplayObjects — nothing painted; people are NpcActors and runtime actors.
 *   Effects — the crowd, the light: festoon strings, neon, the club door's
 *     strobe leak, food-stand steam, cigarette embers, and one man dancing
 *     alone by the bar, who is drawn by hand because the NPC rig does not know
 *     how to dance and he very much does.
 *
 * LIGHTING PREMISE. By day this street is a hangover: flat grey light, shut
 * hatches, gulls. The picture is built for dusk onward, when it runs on five
 * artificial temperatures — warm festoon bulbs overhead, the magenta club
 * neon, the cyan windows of the studio hall, the sodium bulkhead lamps on the
 * brick, the frytki trailer's white — against a sky that still has the yard's
 * crane silhouettes in it. Night is constructed, not filtered: every pool on
 * the concrete has a source overhead.
 *
 * STATE. Clock-derived like the street's, override bag `world.elektrykow`:
 *
 *   club     closed → prep → open → peak     day shut; dusk soundcheck; night on
 *   bar      closed → open                   the container hatch, dusk onward
 *   frytki   closed → open                   the trailer, dusk onward
 *   crowd    0..3                            night 3, dusk 2, day 0
 *   queue    0..2                            outside the club, night only
 *   festoon  auto/on/off                     the bulbs, dusk onward
 *
 * GROUND BAND. {150, 170} like the corridor pilot. Blockers on the things a
 * person genuinely walks around: barrel tables, the picnic table, the
 * generator, the portaloos, the bike pile, the crane leg.
 * ==================================================================
 */

const W = 1720;
const H = 180;
const FLOOR = 150;
const BAND_BOT = 170;

/** Unit boundaries. Every x in this file belongs to one of these. */
const Z = {
  skm: 46, // the stair up to the SKM viaduct, far left
  trafo: 148, // the brick substation kiosk
  halaA: 236, // hall A frontage 236..640 — the studio hall
  mural: 297, // the mural, on the hall's bricked-in first bay
  smoke: 612, // the smoking corner against hall A's right end
  gap: 640, // 640..758: the gap between the halls, pipe bridge overhead
  gate: 698, // the works gate in the gap's spur wall, chained
  bar: 768, // the 20ft container bar 768..998
  frytki: 1046, // the trailer 1046..1170
  board: 1210, // the event board
  crane: 1300, // the parked portal crane leg
  queue: 1352, // barriers 1352..1478
  club: 1490, // hall B frontage 1490..1720
  door: 1584, // the club door in it
  smokeYard: 1690, // the smokers by the dock fence corner
} as const;

/* ================================================================== *
 * palette
 * ================================================================== */

const DAWN_CAST = "#8d88ae";
const DUSK_CAST = "#d4813e";
const NIGHT_CAST = "#101828";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.18),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.16),
    night: dim(mat, NIGHT_CAST, 0.52),
  };
}

/** Shipyard brick: a hundred years of soot over what was once orange. */
const BRICK_MAT: Mat = {
  hi: "#9a6a52",
  base: "#875a46",
  mid: "#7a503e",
  lo: "#6b4536",
  deep: "#4e3228",
};
/** Hall B, the club's hall: the same brick, painted grey at some point. */
const BRICKB_MAT: Mat = {
  hi: "#8d8a84",
  base: "#7d7a74",
  mid: "#726f69",
  lo: "#66635d",
  deep: "#4c4a45",
};
/** Concrete plates the whole street is paved with. */
const PLATE_MAT: Mat = {
  hi: "#a09d95",
  base: "#918e86",
  mid: "#878479",
  lo: "#7d7a70",
  deep: "#615e56",
};
/** Corrugated steel: the container, the trailer skirt, the kiosk door. */
const CORR_MAT: Mat = {
  hi: "#5f8a96",
  base: "#4d7682",
  mid: "#436974",
  lo: "#3a5c66",
  deep: "#29434b",
};
const RUSTSTEEL_MAT: Mat = {
  hi: "#9a7a58",
  base: "#86664a",
  mid: "#795c42",
  lo: "#6a503a",
  deep: "#4c3a2b",
};
const STEEL_MAT: Mat = {
  hi: "#c8ccd2",
  base: "#9aa0a8",
  mid: "#868c94",
  lo: "#6d7278",
  deep: "#4f545a",
};
const TRAILER_MAT: Mat = {
  hi: "#e8e2d2",
  base: "#d6d0c0",
  mid: "#c8c2b2",
  lo: "#b8b2a2",
  deep: "#918c7e",
};

const BRICK = ramp(BRICK_MAT);
const BRICKB = ramp(BRICKB_MAT);
const PLATE = ramp(PLATE_MAT);
const CORR = ramp(CORR_MAT);
const RUST = ramp(RUSTSTEEL_MAT);
const STEEL = ramp(STEEL_MAT);
const TRAILER = ramp(TRAILER_MAT);
const WOOD = ramp(M.wood);

const K = {
  /** Same stops as the street's sky, so the two scenes share an evening. */
  sky: {
    dawn: ["#8ba3c4", "#a9b8cc", "#c9cfd8", "#e8cf9a"],
    day: ["#7fa8cc", "#93b8d6", "#a8c8e0", "#cfe2ee"],
    dusk: ["#4a3b63", "#7d5378", "#b96b8c", "#f2a65a"],
    night: ["#12142a", "#1a1830", "#232040", "#2c2a4a"],
  } as Record<Ph, string[]>,
  white: "#f2f2ee",
  cream: "#e8e2d2",
  /** the club's neon, and everything that catches it */
  neon: "#e858a8",
  neonDeep: "#a03a78",
  /** the studio hall's windows after dark */
  cyan: "#5ad8d8",
  cyanDeep: "#2a8a92",
  /** festoon bulbs — tungsten, not LED */
  bulb: "#ffca85",
  bulbHi: "#ffe6bc",
  /** sodium bulkhead lamps on the brick */
  sodium: "#ff9c3a",
  ledRed: "#ff5050",
  ledGreen: "#7ee08c",
  ledAmber: "#ffb03a",
  rust: "#9a7a58",
  rustDeep: "#6b4f36",
  gull: "#d8dade",
  weeds: "#4e6b3a",
  weedsDry: "#8a7a4a",
  chalk: "#e8e2d2",
  glassDark: "#20262e",
  puddle: "#3a4650",
  puddleHi: "#5a6a78",
  tarmacPaint: "#d8cf5a",
  frytki: "#e8b93a",
  ketchup: "#c94040",
  menuBoard: "#2b2e32",
  poster: "#d8cfba",
  posterOld: "#b0a68c",
  posterInk: "#33302a",
  posterPink: "#d86a9a",
  mural1: "#3a7d84",
  mural2: "#d4813e",
  mural3: "#e8e2d2",
  cable: "#1d2126",
  hiVis: "#d6e23f",
} as const;

/* ================================================================== *
 * state — the street runs on the clock; the bag overrides for dev/tests
 * ================================================================== */

export type ClubStage = "closed" | "prep" | "open" | "peak";
export type HatchStage = "closed" | "open";
export type FestoonStage = "auto" | "on" | "off";

const CLUBS: readonly ClubStage[] = ["closed", "prep", "open", "peak"];
const HATCHES: readonly HatchStage[] = ["closed", "open"];
const FESTS: readonly FestoonStage[] = ["auto", "on", "off"];

type ElektrykowState = {
  club: ClubStage;
  bar: HatchStage;
  frytki: HatchStage;
  crowd: 0 | 1 | 2 | 3;
  queue: 0 | 1 | 2;
  festoon: FestoonStage;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

export function elektrykowState(world: WorldState, ph: Ph): ElektrykowState {
  const s = ((world as unknown as Record<string, unknown>).elektrykow ?? {}) as Record<
    string,
    unknown
  >;
  const night = ph === "night";
  const dusk = ph === "dusk";
  const crowd = clampInt(s.crowd, 3, night ? 3 : dusk ? 2 : 0) as 0 | 1 | 2 | 3;
  return {
    club: clampStage(
      s.club,
      CLUBS,
      night ? (crowd >= 3 ? "peak" : "open") : dusk ? "prep" : "closed",
    ),
    bar: clampStage(s.bar, HATCHES, night || dusk ? "open" : "closed"),
    frytki: clampStage(s.frytki, HATCHES, night || dusk ? "open" : "closed"),
    crowd,
    queue: clampInt(s.queue, 2, night ? 2 : 0) as 0 | 1 | 2,
    festoon: clampStage(s.festoon, FESTS, "auto"),
  };
}

/**
 * The phase right now, off the wall clock — for object `when` gates and actor
 * `visible` gates, which get the world but not the phase. Same derivation the
 * runtime feeds the art, so the gate and the picture always agree.
 */
const phNow = () => toPhase(dayPhase(new Date().getHours()));

const festoonOn = (s: ElektrykowState, ph: Ph) =>
  s.festoon === "on" || (s.festoon === "auto" && (ph === "night" || ph === "dusk"));
const clubOn = (s: ElektrykowState) => s.club === "open" || s.club === "peak";
const isDark = (ph: Ph) => ph === "night" || ph === "dusk";

/* ================================================================== *
 * helpers
 * ================================================================== */

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

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
/* ================================================================== *
 * FAR — the yard beyond the street, enriched pass
 *
 * Same silhouette grammar as before, plus the things a Stocznia
 * skyline actually owes the viewer:
 *   - a sun that keeps yard hours (and a moon on the night shift)
 *   - clouds that drift instead of hanging
 *   - a hull on the slipway in red-lead primer, staged and lit
 *   - the three crosses of Plac Solidarnosci by the ECS block
 *   - a banded chimney with smoke leaning downwind
 *   - cranes upgraded: top tie chord, counterweight, rails, and a
 *     magenta pool the floodlit one drops on the apron after dark
 *   - the SKM sliding along the embankment, yellow stripe and all
 *   - apron furniture: lamp masts, a cable drum, a pipe stack,
 *     bollards, oil stains, one puddle that remembers the sky
 *   - FIX: the apron is now painted BEFORE the people, welding glow
 *     and props that stand on it — previously it was last and buried
 *     the walkers under itself.
 * ================================================================== */

/** The far horizon the silhouettes stand on. */
const HORIZON = 96;

/**
 * The portal cranes. Same construction as the ones the train window draws —
 * an A-frame on a gantry, the long jib, the shorter counter-jib, the hook
 * block — but nearer, so they get a third leg line and a cab. Five of them at
 * five heights, because they never match. The second one is the one the
 * street floodlights magenta after dark, which the real Elektrykow does, and
 * which is worth thirty pixels of anyone's night sky.
 */
function crane(x: number, h: number, span: number): Rect[] {
  const base = HORIZON + 1;
  const top = base - h;
  return [
    [x, top, 3, h], // front leg
    [x + 11, top + 4, 2, h - 4], // back leg
    [x - span + 12, top + 2, span, 2], // the jib
    [x - span + 12, top, span - 10, 1], // the tie chord above it
    [x + 13, top + 3, 14, 2], // counter-jib
    [x + 23, top, 5, 5], // the counterweight hanging off its end
    [x + 2, top - 3, 10, 3], // the machinery house
    [x - span + 20, top + 4, 1, 8], // hook fall
    [x - span + 19, top + 12, 3, 3], // hook block
    [x - 4, base - 3, 22, 3], // gantry bogies
    [x + 3, top + Math.round(h * 0.45), 6, 5], // the cab
  ];
}
/**
 * Tall enough to loom over the container and the trailer — a Stocznia portal
 * crane is seventy metres of steel and the street furniture is three; if the
 * bar can hide one, the sky is lying.
 */
const CRANE_X: [number, number, number][] = [
  [180, 70, 46],
  [420, 84, 58],
  [700, 62, 40],
  [1180, 76, 50],
  [1560, 66, 42],
];
const CRANES = pxPath(CRANE_X.flatMap(([x, h, s]) => crane(x, h, s)));
/** The lit one gets its own path so the flood can recolour it. */
const CRANE_LIT = pxPath(crane(420, 84, 58));
const CRANE_LIGHTS = pxPath(CRANE_X.map(([x, h]) => [x, HORIZON - h - 5, 2, 2] as Rect));
/** Every gantry runs on rails, and rails read as one dark line each. */
const CRANE_RAILS = pxPath(CRANE_X.map(([x]) => [x - 12, HORIZON + 2, 38, 1] as Rect));

/** The hull halls and slipway gantries behind the street's own halls. */
const YARD_SHEDS = pxPath([
  [60, HORIZON - 26, 150, 26],
  [95, HORIZON - 33, 80, 7], // the raised bay
  [240, HORIZON - 18, 120, 18],
  [820, HORIZON - 22, 170, 22],
  [1030, HORIZON - 15, 90, 15],
  [1330, HORIZON - 24, 130, 24],
]);
const YARD_SHED_ROOFS = pxPath([
  [60, HORIZON - 28, 150, 2],
  [820, HORIZON - 24, 170, 2],
  [1330, HORIZON - 26, 130, 2],
]);
/** Windows in the sheds that stay lit — a yard never fully sleeps. */
const YARD_WINDOWS = pxPath([
  [86, HORIZON - 16, 5, 4],
  [130, HORIZON - 16, 5, 4],
  [872, HORIZON - 13, 4, 4],
  [946, HORIZON - 13, 4, 4],
  [1368, HORIZON - 15, 5, 4],
]);
/** The ECS block: the rust cube on the skyline, left of everything. */
const ECS = pxPath([
  [8, HORIZON - 38, 44, 38],
  [16, HORIZON - 44, 28, 6],
]);
const ECS_GLAZING = pxPath(repeat(4, 10, [12, HORIZON - 32, 6, 22] as Rect));
/**
 * The three crosses of Plac Solidarnosci, with their anchors reduced to a
 * nub each. They stand in front of the first shed and clear its roofline,
 * because at forty-two metres they clear everything.
 */
const CROSSES = pxPath([
  [63, HORIZON - 40, 2, 40],
  [59, HORIZON - 31, 10, 2],
  [63, HORIZON - 28, 2, 2], // anchor nub
  [72, HORIZON - 36, 2, 36],
  [68, HORIZON - 27, 10, 2],
  [81, HORIZON - 40, 2, 40],
  [77, HORIZON - 31, 10, 2],
  [81, HORIZON - 28, 2, 2],
]);
/**
 * The hull on the slipway: a ship in red-lead primer, staged in scaffolding,
 * bridge and funnel already fitted. It lives in the gap between the sheds at
 * 600–810 and the crane at 700 works right over it, which is the point.
 */
const HULL = pxPath([
  [610, HORIZON - 14, 186, 14], // the plating
  [608, HORIZON - 11, 4, 11], // stern
  [796, HORIZON - 12, 8, 12], // bow, upper strake
  [802, HORIZON - 8, 6, 8], // bow, the rake stepping back
  [664, HORIZON - 20, 44, 6], // superstructure
  [672, HORIZON - 23, 14, 3], // bridge deck
  [700, HORIZON - 25, 2, 5], // mast
  [652, HORIZON - 24, 5, 10], // funnel
]);
/** Fresh primer patches where the welders were last week. */
const HULL_PRIMER = pxPath([
  [630, HORIZON - 12, 30, 6],
  [716, HORIZON - 10, 40, 5],
  [772, HORIZON - 13, 14, 8],
]);
/** The staging: ten uprights and the walkway plank along the sheer line. */
const HULL_SCAFF = pxPath([
  ...repeat(10, 19, [614, HORIZON - 17, 1, 17] as Rect),
  [610, HORIZON - 18, 196, 1],
]);
const HULL_LIGHTS = pxPath(repeat(5, 40, [622, HORIZON - 19, 2, 1] as Rect));
/** The banded chimney between the small shed and the fourth crane. */
const CHIMNEY = pxPath([
  [1132, HORIZON - 42, 6, 42],
  [1130, HORIZON - 43, 10, 2], // the cap
]);
const CHIMNEY_BANDS = pxPath([
  [1132, HORIZON - 32, 6, 3],
  [1132, HORIZON - 19, 6, 3],
]);
/** The city's glow along the horizon after dark: three stepped bands. */
const CITY_GLOW = [
  pxPath([[0, HORIZON - 4, W, 5]]),
  pxPath([[0, HORIZON - 8, W, 4]]),
  pxPath([[0, HORIZON - 11, W, 3]]),
];
/** The ground between horizon and the street's own paving. */
const FAR_APRON = pxPath([[0, HORIZON, W, FLOOR - HORIZON]]);
const FAR_APRON_JOINTS = pxPath(
  repeat(Math.ceil(W / 90), 90, [30, HORIZON, 1, FLOOR - HORIZON] as Rect),
);
/** What an apron collects: stains, one puddle, and the furniture. */
const APRON_STAINS = pxPath([
  [432, HORIZON + 8, 26, 3],
  [454, HORIZON + 11, 12, 2],
  [1070, HORIZON + 6, 18, 2],
]);
const APRON_PUDDLE = pxPath([[898, HORIZON + 10, 30, 2]]);
const APRON_MASTS = pxPath(repeat(6, 260, [140, HORIZON + 1, 1, 9] as Rect));
const APRON_MAST_HEADS = pxPath(repeat(6, 260, [139, HORIZON + 1, 3, 2] as Rect));
const APRON_BOLLARDS = pxPath(repeat(4, 380, [300, HORIZON + 13, 3, 4] as Rect));
/** A cable drum on its side, and a stack of pipe waiting for the hull. */
const APRON_DRUM = pxPath([[978, HORIZON + 5, 11, 11]]);
const APRON_DRUM_HUB = pxPath([[982, HORIZON + 9, 3, 3]]);
const APRON_PIPES = pxPath([
  [656, HORIZON + 12, 24, 3],
  [660, HORIZON + 9, 16, 3],
  [664, HORIZON + 6, 8, 3],
]);
/** Container stacks in the middle distance, port-coloured. */
const FAR_STACKS: [Rect, string][] = [
  [[540, HORIZON - 12, 60, 12], "#5a3f4e"],
  [[548, HORIZON - 22, 44, 10], "#3a5c66"],
  [[1240, HORIZON - 11, 54, 11], "#4e5966"],
  [[1470, HORIZON - 10, 48, 10], "#5b6235"],
];

/** Mix two hexes — the sky needs more rungs than the palette declares. */
function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * t);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Where the sun stands in each lit phase; night belongs to the moon. */
const SUN: Record<string, { x: number; y: number; c: string }> = {
  day: { x: 1250, y: 28, c: "#f8f2dc" },
  dawn: { x: 1420, y: 74, c: "#f2a45c" },
  dusk: { x: 140, y: 76, c: "#e8703e" },
};

/** Cloud strata for the dark hours; two cumulus piles for the day. */
const CLOUD_STRATA = pxPath([
  [120, 22, 260, 2],
  [210, 26, 190, 1],
  [880, 14, 320, 2],
  [1010, 18, 200, 1],
  [1480, 30, 180, 2],
]);
const CLOUD_PUFFS = pxPath([
  ...steppedEllipse(360, 26, 46, 8, 2),
  ...steppedEllipse(392, 20, 30, 6, 2),
  ...steppedEllipse(1180, 36, 54, 9, 2),
  ...steppedEllipse(1224, 30, 34, 7, 2),
]);
const CLOUD_PUFF_SHADE = pxPath([
  [318, 30, 88, 3],
  [1130, 41, 104, 3],
]);
/**
 * Rank two of the yard: the gantry over the far slipway, a hull block, the
 * tank farm — one haze step lighter than the sheds in front of them, which is
 * the whole grammar of distance in a flat medium.
 */
const FAR_RANK2 = pxPath([
  [934, HORIZON - 44, 5, 44],
  [1052, HORIZON - 44, 5, 44],
  [930, HORIZON - 48, 132, 6],
  [1240, HORIZON - 30, 90, 30],
  [1252, HORIZON - 36, 44, 6],
  [286, HORIZON - 20, 34, 20],
  [326, HORIZON - 16, 26, 16],
]);
/** Martwa Wisla: one glinting line where the water shows between the sheds. */
const WATER_GLINT = pxPath([
  [380, HORIZON - 1, 60, 1],
  [1130, HORIZON - 1, 70, 1],
  [1470, HORIZON - 1, 50, 1],
]);

function FarPlane({ ph }: { ph: Ph }) {
  const sky = K.sky[ph];
  const night = ph === "night";
  const dark = isDark(ph);
  const sil = night ? "#262438" : ph === "dusk" ? "#4e3a55" : ph === "dawn" ? "#6d7290" : "#7d8a99";
  const silFar = night
    ? "#1e1c30"
    : ph === "dusk"
      ? "#413050"
      : ph === "dawn"
        ? "#7d82a0"
        : "#8d9aa8";
  const rank2 = mixHex(silFar, sky[3], 0.45);
  const sun = SUN[ph];
  const hullPaint = dark ? "#3c2723" : "#7c4038";
  const hullPrimer = dark ? "#57352c" : "#a8624e";
  return (
    <g>
      <SharedDefs />
      {/* the sky: seven stepped bands, the honest pixel gradient */}
      <path d={pxPath([[0, 0, W, 20]])} fill={sky[0]} />
      <path d={pxPath([[0, 20, W, 15]])} fill={mixHex(sky[0], sky[1], 0.5)} />
      <path d={pxPath([[0, 35, W, 13]])} fill={sky[1]} />
      <path d={pxPath([[0, 48, W, 12]])} fill={mixHex(sky[1], sky[2], 0.5)} />
      <path d={pxPath([[0, 60, W, 11]])} fill={sky[2]} />
      <path d={pxPath([[0, 71, W, 11]])} fill={mixHex(sky[2], sky[3], 0.5)} />
      <path d={pxPath([[0, 82, W, H - 82]])} fill={sky[3]} />
      {/* the sun keeps yard hours: high and pale at noon, low and molten at
          the day's two hinges, with a flare line laid along the haze */}
      {!night && sun ? (
        <>
          <path d={pxPath(steppedEllipse(sun.x, sun.y, 13, 11, 2))} fill={sun.c} opacity={0.25} />
          <path d={pxPath(steppedEllipse(sun.x, sun.y, 7, 6, 2))} fill={sun.c} opacity={0.95} />
          {ph !== "day" ? (
            <path d={pxPath([[sun.x - 34, sun.y + 2, 68, 1]])} fill={sun.c} opacity={0.35} />
          ) : null}
        </>
      ) : null}
      {/* the moon takes the night shift — a crescent bitten out by the sky */}
      {night ? (
        <>
          <path d={pxPath(steppedEllipse(1380, 26, 7, 7, 2))} fill="#dfe3ee" opacity={0.9} />
          <path d={pxPath(steppedEllipse(1377, 24, 6, 6, 2))} fill={sky[0]} />
        </>
      ) : null}
      {/* the weather: strata scudding at night and dusk, cumulus by day —
          and all of it drifts, slowly enough that you only catch it if you
          stay a while, which is the correct speed for weather */}
      {dark ? (
        <g>
          <path d={CLOUD_STRATA} fill={mixHex(sky[1], "#8d88ae", 0.3)} opacity={0.4} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;46 0;0 0"
            dur="290s"
            repeatCount="indefinite"
          />
        </g>
      ) : (
        <g>
          <path d={CLOUD_PUFFS} fill="#f2f4f6" opacity={ph === "dawn" ? 0.5 : 0.85} />
          <path d={CLOUD_PUFF_SHADE} fill={mixHex(sky[1], "#8d9aa8", 0.5)} opacity={0.5} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;38 0;0 0"
            dur="340s"
            repeatCount="indefinite"
          />
        </g>
      )}
      {/* stars, only when the sky can hold them — and three of the bright
          ones breathe */}
      {night ? (
        <>
          <path
            d={pxPath(
              Array.from({ length: 22 }, (_, i) => {
                const x = Math.round(hash(i * 31) * W);
                const y = Math.round(hash(i * 47 + 5) * 52) + 4;
                return [x, y, 1, 1] as Rect;
              }),
            )}
            fill="#c9d2e8"
            opacity={0.7}
          />
          <path
            d={pxPath([
              [420, 12, 2, 2],
              [980, 8, 2, 2],
              [1500, 18, 2, 2],
            ])}
            fill="#e8eefc"
          >
            <animate
              attributeName="opacity"
              values="0.9;0.3;0.9"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </path>
        </>
      ) : null}
      {/* the city's glow, south, behind everything */}
      {dark ? (
        <g>
          <path d={CITY_GLOW[0]} fill={K.sodium} opacity={0.14} />
          <path d={CITY_GLOW[1]} fill={K.sodium} opacity={0.08} />
          <path d={CITY_GLOW[2]} fill={K.sodium} opacity={0.04} />
        </g>
      ) : null}
      {/* haze over the horizon: the air between here and the far slips */}
      <path d={pxPath([[0, HORIZON - 14, W, 14]])} fill={sky[3]} opacity={0.35} />
      {/* the water, glinting in the gaps the sheds leave — and breathing */}
      <path d={WATER_GLINT} fill={dark ? "#5a7a9a" : "#c8dae8"}>
        <animate
          attributeName="opacity"
          values={dark ? "0.5;0.75;0.5" : "0.7;0.9;0.7"}
          dur="6s"
          repeatCount="indefinite"
        />
      </path>
      {/* the floodlit crane leaves a smear of itself on the water at night */}
      {dark ? <path d={pxPath([[396, HORIZON - 1, 30, 1]])} fill={K.neon} opacity={0.25} /> : null}
      {/* THE APRON, painted now — before anyone stands on it. It used to be
          painted last, and it buried the walkers under itself. */}
      <path d={FAR_APRON} fill={dark ? "#2a2a3a" : "#8d8a80"} />
      <path d={FAR_APRON} fill={dth("n", "25")} opacity={0.16} />
      <path d={FAR_APRON_JOINTS} fill="#000" opacity={0.12} />
      <path d={APRON_STAINS} fill="#0e0c0a" opacity={0.18} />
      {/* the puddle remembers whatever the sky is doing */}
      <path d={APRON_PUDDLE} fill={sky[2]} opacity={dark ? 0.3 : 0.4} />
      <path
        d={pxPath([[904, HORIZON + 10, 6, 1]])}
        fill={dark ? "#8aa4c4" : "#eef4f8"}
        opacity={0.5}
      />
      {/* rank two: the yard beyond the yard, one haze step lighter */}
      <path d={FAR_RANK2} fill={rank2} />
      {/* ECS, the sheds, the stacks */}
      <path d={ECS} fill={dark ? "#332220" : "#7d4a3a"} />
      <path d={ECS_GLAZING} fill={dark ? "#4e3a3a" : "#a8b8c4"} opacity={0.8} />
      {/* its letters — two pale pixels are all EUROPEJSKIE needs from here */}
      <path
        d={pxPath([
          [14, HORIZON - 42, 8, 2],
          [26, HORIZON - 42, 6, 2],
        ])}
        fill={dark ? "#8a6a5a" : "#e8e2d2"}
        opacity={0.7}
      />
      <path d={YARD_SHEDS} fill={silFar} />
      <path d={YARD_SHED_ROOFS} fill={sil} />
      {/* the three crosses, in front of the first shed and taller than it:
          weathered steel by day, floodlit bone-white after dark */}
      <path d={CROSSES} fill={dark ? "#d8d2c2" : sil} opacity={dark ? 0.85 : 1} />
      {dark ? <path d={CROSSES} transform="translate(0,1)" fill="#d8d2c2" opacity={0.15} /> : null}
      {/* the hull on the slipway: primer red, staged, its own small skyline */}
      <path d={HULL} fill={hullPaint} />
      <path d={HULL_PRIMER} fill={hullPrimer} opacity={0.8} />
      <path d={HULL_SCAFF} fill={silFar} opacity={0.85} />
      {dark ? <path d={HULL_LIGHTS} fill={K.ledAmber} opacity={0.85} /> : null}
      {FAR_STACKS.map(([r, c]) => (
        <path
          key={r[0]}
          d={pxPath([r])}
          fill={dark ? dim({ hi: c, base: c, mid: c, lo: c, deep: c }, NIGHT_CAST, 0.5).base : c}
        />
      ))}
      <path d={YARD_WINDOWS} fill={dark ? K.ledAmber : "#c8d2da"} opacity={dark ? 0.9 : 0.5} />
      {/* the chimney: banded, capped, its smoke leaning downwind in three
          puffs that are born, drift, and thin out on a stagger */}
      <path d={CHIMNEY} fill={sil} />
      <path d={CHIMNEY_BANDS} fill={dark ? "#5a3030" : "#a84a3a"} opacity={0.85} />
      {[0, 2.7, 5.4].map((begin) => (
        <path key={begin} d={pxPath([[1133, 50, 4, 3]])} fill={dark ? "#3a3a4a" : "#c8ccd2"}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;11 -15"
            dur="8s"
            begin={`${begin}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.5;0.4;0"
            dur="8s"
            begin={`${begin}s`}
            repeatCount="indefinite"
          />
        </path>
      ))}
      {dark ? (
        <path d={pxPath([[1131, HORIZON - 44, 2, 2]])} fill={K.ledRed}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.1;1"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the rails first, then the cranes that ride them */}
      <path d={CRANE_RAILS} fill="#000" opacity={0.25} />
      <path d={CRANES} fill={sil} />
      {/* the floodlit one: magenta after dark, plain steel by day — and it
          drops a pool of its own colour on the apron below */}
      {dark ? (
        <>
          <path d={pxPath([[392, HORIZON + 1, 60, 4]])} fill={K.neonDeep} opacity={0.14} />
          <path d={pxPath([[404, HORIZON + 1, 34, 2]])} fill={K.neon} opacity={0.12} />
          <path d={CRANE_LIT} fill={K.neonDeep} opacity={0.85} />
          <path d={CRANE_LIT} fill={K.neon} opacity={0.35} />
        </>
      ) : null}
      {/* aircraft lights on the jib tops, blinking out of phase */}
      {dark ? (
        <path d={CRANE_LIGHTS} fill={K.ledRed}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.15;1;1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* two crane cabs with the light left on — somebody clocks off last */}
      {dark ? (
        <path
          d={pxPath([
            [186, 60, 2, 2],
            [1186, 57, 2, 2],
          ])}
          fill={K.ledAmber}
          opacity={0.9}
        />
      ) : null}
      {/* the lit crane WORKS: its trolley crawls the jib, pauses, comes back.
          Nothing else in the far plane earns a stare like a crane doing a
          night shift, and it costs two rectangles. */}
      <g fill={dark ? "#181628" : sil}>
        <path
          d={pxPath([
            [378, 11, 6, 4],
            [380, 15, 2, 6],
          ])}
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 0;40 0;40 0;12 0;12 0;0 0"
          keyTimes="0;0.1;0.38;0.55;0.8;0.9;1"
          dur="47s"
          repeatCount="indefinite"
        />
      </g>
      {/* apron furniture: the lamp masts (lit after dark), the bollards,
          the cable drum on its side, the pipe stack waiting for the hull */}
      <path d={APRON_MASTS} fill={dark ? "#20202c" : "#5c5850"} />
      <path d={APRON_MAST_HEADS} fill={dark ? K.sodium : "#6a665e"} opacity={dark ? 0.9 : 1} />
      {dark ? (
        <path
          d={pxPath(repeat(6, 260, [134, HORIZON + 3, 13, 6] as Rect))}
          fill={K.sodium}
          opacity={0.08}
        />
      ) : null}
      <path d={APRON_BOLLARDS} fill={dark ? "#20202c" : "#5c5850"} />
      <path d={APRON_DRUM} fill={dark ? "#4a3826" : "#8a6a48"} />
      <path d={APRON_DRUM_HUB} fill="#000" opacity={0.4} />
      <path d={APRON_PIPES} fill={dark ? "#2e3040" : "#6a7280"} />
      <path
        d={pxPath([
          [656, HORIZON + 12, 2, 3],
          [660, HORIZON + 9, 2, 3],
          [664, HORIZON + 6, 2, 3],
        ])}
        fill="#000"
        opacity={0.35}
      />
      {/* the SKM slides along the embankment, blue with its yellow stripe,
          windows amber after dark — always on time, always going somewhere */}
      <g>
        <path d={pxPath([[-70, HORIZON + 2, 62, 7]])} fill={night ? "#1c2b4a" : "#2a4f92"} />
        <path d={pxPath([[-70, HORIZON + 7, 62, 2]])} fill="#e8c31f" opacity={0.9} />
        <path
          d={pxPath(repeat(7, 8, [-66, HORIZON + 3, 4, 2] as Rect))}
          fill={dark ? K.ledAmber : "#c4d6ec"}
          opacity={0.9}
        />
        <path d={pxPath([[-9, HORIZON + 4, 1, 2]])} fill="#f4f8ff" opacity={dark ? 0.9 : 0.4} />
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`0 0;${W + 160} 0;${W + 160} 0`}
          keyTimes="0;0.42;1"
          dur="58s"
          repeatCount="indefinite"
        />
      </g>
      {/* somebody welding in the far shed — the yard's own strobe, three
          blue-white blinks and a long dark */}
      {dark ? (
        <g>
          <path d={pxPath([[870, 80, 6, 5]])} fill="#cfe4ff">
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;0;0;0.9;0;0.7;0;0.9;0;0;0;0;0;0;0;0;0;0"
              dur="9.5s"
              repeatCount="indefinite"
            />
          </path>
          <path d={pxPath([[862, 76, 22, 12]])} fill={dth("c", "25")} opacity={0}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;0;0;0.5;0;0.4;0;0.5;0;0;0;0;0;0;0;0;0;0"
              dur="9.5s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* two people crossing the far apron — far enough to be nobody,
          near enough to prove the yard is not a backdrop */}
      <g fill={sil} opacity={0.6}>
        <path
          d={pxPath([
            [240, 99, 3, 7],
            [241, 97, 2, 2],
          ])}
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;320 0;320 0;0 0"
            keyTimes="0;0.45;0.55;1"
            dur="84s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d={pxPath([
            [1420, 102, 3, 7],
            [1421, 100, 2, 2],
          ])}
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-260 0;-260 0;0 0"
            keyTimes="0;0.4;0.52;1"
            dur="66s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      {/* gulls, day only — at night they have somewhere better to be */}
      {!dark ? (
        <g>
          {[300, 760, 1240].map((x, i) => (
            <path
              key={x}
              d={pxPath([
                [x, 30 + i * 9, 3, 1],
                [x + 4, 29 + i * 9, 3, 1],
              ])}
              fill={K.gull}
              opacity={0.8}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0;${60 + i * 30} ${-4 + i * 2};${140 + i * 40} 2;0 0`}
                dur={`${34 + i * 9}s`}
                repeatCount="indefinite"
              />
            </path>
          ))}
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * MID — the halls, and everything bolted to them
 * ================================================================== */

/* ---- hall A: the studio hall, 236..640 --------------------------------- */

const HA = { x0: Z.halaA, x1: Z.gap } as const;
const HA_BODY = bevelPaths([[HA.x0, 0, HA.x1 - HA.x0, FLOOR]]);
/** Brick piers between the window bays — a hall wall is piers, not surface. */
const HA_PIERS = pxPath(repeat(4, 122, [HA.x0, 0, 14, FLOOR] as Rect));
const HA_PIER_EDGE = pxPath(repeat(4, 122, [HA.x0 + 12, 0, 2, FLOOR] as Rect));
/** Brick coursing: every fourth course reads, the rest is texture. */
const HA_COURSES = pxPath(
  repeat(Math.floor(FLOOR / 12), 12, [HA.x0, 8, HA.x1 - HA.x0, 1] as Rect, "y"),
);
/**
 * The steel-arched windows in the second and third bays, y 28..104. The arch
 * is a stepped head — a polygon would antialias. Small panes on a lattice; a
 * few are broken and boarded, and after dark the whole lattice goes cyan,
 * because somebody rents the hall as studios and they work nights. The first
 * bay has no window: it was bricked in decades ago and carries the mural.
 */
const HA_WIN: Rect[] = [378, 500].map((x) => [x, 38, 78, 66] as Rect);
const HA_WIN_ARCH = pxPath(
  HA_WIN.flatMap(
    ([x, y, w]) =>
      [
        [x + 6, y - 6, w - 12, 6],
        [x + 14, y - 10, w - 28, 4],
      ] as Rect[],
  ),
);
const HA_WIN_GLASS = pxPath([
  ...HA_WIN,
  ...HA_WIN.map(([x, y, w]) => [x + 6, y - 6, w - 12, 6] as Rect),
  ...HA_WIN.map(([x, y, w]) => [x + 14, y - 10, w - 28, 4] as Rect),
]);
const HA_WIN_LATTICE = pxPath(
  HA_WIN.flatMap(([x, y, w, h]) => [
    ...repeat(Math.floor(w / 13), 13, [x + 12, y - 8, 1, h + 8] as Rect),
    ...repeat(Math.floor(h / 14), 14, [x, y + 6, w, 1] as Rect, "y"),
  ]),
);
/** The boarded panes: plywood over two of them, and one honest hole. */
const HA_WIN_BOARD = pxPath([
  [HA_WIN[0][0] + 13, HA_WIN[0][1] + 34, 24, 26],
  [HA_WIN[1][0] + 52, HA_WIN[1][1] + 6, 24, 26],
]);
const HA_WIN_BROKEN = pxPath([
  [HA_WIN[1][0] + 14, HA_WIN[1][1] + 22, 5, 4],
  [HA_WIN[1][0] + 17, HA_WIN[1][1] + 25, 3, 3],
]);
const HA_SILLS = pxPath(HA_WIN.map(([x, y, w]) => [x - 3, y + 66, w + 6, 4] as Rect));
/** The lintel band and the painted works sign above the windows, ghosted. */
const HA_BAND = pxPath([[HA.x0, 20, HA.x1 - HA.x0, 4]]);
/** Downpipes on the piers, with the collars that hold them. */
const HA_PIPES = pxPath(
  [360, 482].flatMap(
    (x) =>
      [
        [x, 0, 4, FLOOR - 4],
        [x - 1, 34, 6, 3],
        [x - 1, 98, 6, 3],
        [x - 2, FLOOR - 10, 8, 10], // the shoe
      ] as Rect[],
  ),
);
/** The damp under a leaking pipe joint, and the moss line at the plinth. */
const HA_DAMP = pxPath([
  [352, 96, 22, 54],
  [474, 118, 20, 32],
]);
const HA_PLINTH = pxPath([[HA.x0, FLOOR - 16, HA.x1 - HA.x0, 16]]);
const HA_MOSS = pxPath(repeat(26, 16, [HA.x0 + 3, FLOOR - 4, 6, 3] as Rect));

/* ---- the mural, on the hall's bricked-in first bay ----------------------- */

/**
 * The first bay (250..344) lost its window decades ago — the infill brick is
 * a shade off the original, which is its own bit of history — and carries the
 * mural: a tug hauling a hull section, painted by somebody good, weathered by
 * ten winters. Big flat fields, off-register on purpose — a wall painting
 * drapes over brick coursing and loses its edges.
 */
const BAY1 = { x0: 250, x1: 344 } as const;
const BAY1_INFILL = pxPath([[BAY1.x0, 28, BAY1.x1 - BAY1.x0, 122]]);
const BAY1_ARCH = pxPath([
  [BAY1.x0 + 6, 22, BAY1.x1 - BAY1.x0 - 12, 6],
  [BAY1.x0 + 14, 18, BAY1.x1 - BAY1.x0 - 28, 4],
]);
const BAY1_JOINTS = pxPath(repeat(6, 15, [BAY1.x0 + 6, 32, 1, 114] as Rect));
const MURAL_FIELD = pxPath([[Z.mural - 45, 42, 90, 86]]);
/** The hull section: sheer line stepping down toward a raked bow. */
const MURAL_HULL = pxPath([
  [Z.mural - 26, 58, 52, 8],
  [Z.mural - 31, 66, 60, 8],
  [Z.mural - 36, 74, 68, 8],
  [Z.mural - 39, 82, 74, 14],
]);
const MURAL_SUPER = pxPath([
  [Z.mural + 6, 48, 18, 10],
  [Z.mural + 10, 44, 4, 4],
]);
const MURAL_PORTHOLES = pxPath([
  [Z.mural - 18, 86, 3, 3],
  [Z.mural - 6, 86, 3, 3],
  [Z.mural + 6, 86, 3, 3],
  [Z.mural + 18, 86, 3, 3],
]);
/** The painted crane hook coming down into frame — the yard signing itself. */
const MURAL_HOOK = pxPath([
  [Z.mural - 36, 42, 2, 12],
  [Z.mural - 39, 54, 8, 3],
  [Z.mural - 38, 57, 3, 4],
]);
/** The tug, low and dark, shouldering the bow. */
const MURAL_TUG = pxPath([
  [Z.mural - 42, 100, 26, 12],
  [Z.mural - 36, 94, 10, 6],
  [Z.mural - 33, 90, 4, 4],
]);
const MURAL_WAVES = pxPath([
  ...repeat(4, 22, [Z.mural - 43, 114, 12, 3] as Rect),
  ...repeat(4, 22, [Z.mural - 33, 120, 10, 2] as Rect),
  /* the tug's bow wave, brighter */
  [Z.mural - 44, 110, 8, 3],
]);
const MURAL_GULLS = pxPath([
  [Z.mural + 26, 50, 4, 1],
  [Z.mural + 31, 49, 4, 1],
  [Z.mural + 18, 58, 4, 1],
]);
const MURAL_WEAR = pxPath([
  [Z.mural - 24, 42, 7, 86],
  [Z.mural + 28, 42, 5, 86],
]);

/* ---- the works gate, in the gap's spur wall ------------------------------ */

const GATE: Rect = [Z.gate - 28, 92, 56, FLOOR - 92];
const GATE_SET = bevelPaths([GATE]);
const GATE_RIBS = pxPath(repeat(4, 13, [GATE[0] + 6, GATE[1] + 4, 3, GATE[3] - 8] as Rect));
const GATE_SPLIT = pxPath([[Z.gate - 1, GATE[1], 2, GATE[3]]]);
const GATE_CHAIN = pxPath([
  [Z.gate - 8, 114, 16, 3],
  [Z.gate - 5, 117, 10, 8],
]);
const GATE_SIGN: Rect = [Z.gate - 22, 98, 44, 12];

/* ---- posters, over posters, over posters -------------------------------- */

/**
 * The poster drift under the studio windows: this month's lineup pasted over
 * last month's, over a festival that was two summers ago. Torn corners show
 * the strata — the whole history of the street in three layers of paper.
 */
const POSTERS_OLD = pxPath([
  [382, 112, 30, 34],
  [504, 114, 26, 32],
]);
const POSTERS_MID = pxPath([
  [388, 110, 30, 36],
  [510, 112, 28, 34],
  [540, 116, 22, 30],
]);
const POSTERS_NEW: Rect[] = [
  [394, 108, 32, 38],
  [516, 110, 30, 36],
];
const POSTERS_ART = pxPath([
  [398, 114, 24, 12],
  [400, 130, 20, 3],
  [400, 136, 14, 2],
  [520, 116, 22, 10],
  [522, 130, 16, 3],
]);
const POSTERS_TORN = pxPath([
  [394, 142, 8, 4],
  [538, 110, 8, 5],
]);

/* ---- the substation kiosk at 148 ---------------------------------------- */

const TRAFO: Rect = [Z.trafo - 34, 74, 68, FLOOR - 74];
const TRAFO_SET = bevelPaths([TRAFO]);
const TRAFO_ROOF = pxPath([
  [TRAFO[0] - 3, TRAFO[1] - 5, TRAFO[2] + 6, 5],
  [TRAFO[0] - 1, TRAFO[1] - 7, TRAFO[2] + 2, 2],
]);
const TRAFO_DOOR = pxPath([[Z.trafo - 16, 92, 32, FLOOR - 92]]);
const TRAFO_DOOR_RIBS = pxPath(repeat(4, 4, [Z.trafo - 12, 96, 24, 1] as Rect, "y"));
const TRAFO_SIGN: Rect = [Z.trafo - 12, 78, 24, 11];
/** The lightning bolt on the warning sign — a zigzag, not a cross. */
const TRAFO_BOLT = pxPath([
  [Z.trafo - 1, 79, 4, 2],
  [Z.trafo - 3, 81, 4, 2],
  [Z.trafo, 83, 4, 2],
  [Z.trafo - 2, 85, 3, 3],
]);
/** Cables in conduit off the kiosk, up the hall wall — the street's name. */
const TRAFO_CONDUIT = pxPath([
  [Z.trafo + 32, 108, HA.x0 - Z.trafo - 32, 3],
  [HA.x0 - 6, 40, 3, 68],
  [Z.trafo + 46, 104, 4, 4],
  [HA.x0 - 8, 60, 7, 4],
]);

/* ---- the SKM stair at 46 ------------------------------------------------ */

const SKM_STAIR = pxPath([
  // the flight, going up left out of frame: risers as courses
  ...Array.from({ length: 9 }, (_, i) => [Z.skm - 34 + i * 7, 66 + i * 9, 62 - i * 7, 4] as Rect),
]);
const SKM_RAIL = pxPath([
  [Z.skm - 36, 58, 3, 88],
  [Z.skm + 28, 92, 3, 56],
  [Z.skm - 36, 58, 66, 3],
]);
const SKM_SIGN: Rect = [Z.skm - 26, 34, 78, 16];
const SKM_POST = pxPath([[Z.skm + 8, 50, 4, 100]]);
/** The palisade fence from the stair to the substation. */
const FENCE_A = pxPath([
  ...repeat(9, 8, [Z.skm + 40, 108, 3, FLOOR - 108] as Rect),
  [Z.skm + 38, 112, 74, 3],
  [Z.skm + 38, 136, 74, 3],
]);

/* ---- the gap, 640..758: pipe bridge and the smoking corner --------------- */

/**
 * The pipe bridge: two steam mains and a cable tray crossing the street
 * between the halls, on a lattice truss. Every real shipyard street has one
 * and it is the single strongest "industry overhead" the scene can buy.
 */
const BRIDGE_TRUSS = pxPath([
  [Z.gap - 6, 22, Z.bar - Z.gap + 18, 4],
  [Z.gap - 6, 40, Z.bar - Z.gap + 18, 3],
  ...repeat(6, 22, [Z.gap - 2, 25, 2, 15] as Rect),
  ...repeat(6, 22, [Z.gap + 8, 25, 2, 15] as Rect),
]);
const BRIDGE_PIPES = pxPath([
  [Z.gap - 6, 28, Z.bar - Z.gap + 18, 5],
  [Z.gap - 6, 34, Z.bar - Z.gap + 18, 3],
]);
const BRIDGE_LAGGING = pxPath(repeat(5, 26, [Z.gap + 2, 27, 4, 7] as Rect));
/** The back wall of the gap: the yard shows through over the brick spur that
 * closes it off, and the works gate sits in the spur. */
const GAP_SPUR = pxPath([[Z.gap, 84, 118, FLOOR - 84]]);
const GAP_SPUR_TOP = pxPath([[Z.gap, 82, 118, 2]]);
const GAP_SPUR_COURSES = pxPath(repeat(5, 12, [Z.gap, 90, 118, 1] as Rect, "y"));
const GAP_RAZOR = pxPath(repeat(14, 8, [Z.gap + 2, 78, 4, 4] as Rect));
/** The smoking corner: a sand bucket, a rail to lean on, stubs. */
const SMOKE_RAIL = pxPath([
  [Z.smoke - 20, 116, 3, 34],
  [Z.smoke + 24, 116, 3, 34],
  [Z.smoke - 20, 116, 47, 3],
]);
const SMOKE_BUCKET = pxPath([
  [Z.smoke + 30, FLOOR - 14, 12, 14],
  [Z.smoke + 28, FLOOR - 16, 16, 3],
]);

/* ---- hall B: the club's hall, 1490..1720 -------------------------------- */

const HB = { x0: Z.club, x1: W } as const;
const HB_BODY = bevelPaths([[HB.x0, 0, HB.x1 - HB.x0, FLOOR]]);
const HB_PIERS = pxPath(repeat(2, 122, [HB.x0, 0, 14, FLOOR] as Rect));
const HB_COURSES = pxPath(
  repeat(Math.floor(FLOOR / 12), 12, [HB.x0, 8, HB.x1 - HB.x0, 1] as Rect, "y"),
);
/** Its windows are bricked up — the club needs the dark. Ghost arches. */
const HB_GHOSTS = pxPath([
  [HB.x0 + 32, 38, 70, 66],
  [HB.x0 + 140, 38, 70, 66],
]);
const HB_GHOST_ARCH = pxPath([
  [HB.x0 + 38, 32, 58, 6],
  [HB.x0 + 146, 32, 58, 6],
]);
const HB_GHOST_INFILL = pxPath([
  ...repeat(5, 13, [HB.x0 + 36, 44, 1, 58] as Rect),
  ...repeat(5, 13, [HB.x0 + 144, 44, 1, 58] as Rect),
]);
/** The club door: steel double leaf in the first bay, portholes lit inside. */
const DOOR: Rect = [Z.door - 40, 70, 80, FLOOR - 70];
const DOOR_SET = bevelPaths([DOOR]);
const DOOR_SPLIT = pxPath([[Z.door - 1, DOOR[1], 2, DOOR[3]]]);
const DOOR_PORTHOLES = pxPath([
  [Z.door - 22, 88, 12, 12],
  [Z.door + 10, 88, 12, 12],
]);
const DOOR_PUSHBAR = pxPath([
  [Z.door - 30, 116, 26, 4],
  [Z.door + 4, 116, 26, 4],
]);
const DOOR_HEAD = pxPath([[DOOR[0] - 4, DOOR[1] - 4, DOOR[2] + 8, 4]]);
const DOOR_STEP = pxPath([[DOOR[0] - 2, FLOOR - 3, DOOR[2] + 4, 3]]);
/**
 * The neon: TURBINA, tube lettering on a blackened steel frame over the door.
 * Two passes — the deep magenta tube body, then the bright core one pixel in.
 * The R flickers, because a neon with all its letters is a neon from a
 * renderer, not from a shipyard.
 */
const NEON_FRAME = pxPath([[Z.door - 66, 36, 132, 26]]);
const NEON_TEXT_X = Z.door - 56;
const NEON_TEXT_Y = 42;
/** The mounting brackets and the cable running down to the meter box. */
const NEON_MOUNT = pxPath([
  [Z.door - 60, 62, 4, 6],
  [Z.door + 54, 62, 4, 6],
]);
/** The bulkhead lamp over the door and the CCTV looking down the queue. */
const DOOR_LAMP = pxPath([
  [Z.door - 52, 64, 10, 5],
  [Z.door - 50, 69, 6, 2],
]);
const DOOR_CCTV = pxPath([
  [Z.door + 48, 66, 8, 5],
  [Z.door + 54, 68, 4, 2],
]);
/** The decibel notice and the house-rules board beside the door. */
const RULES_BOARD: Rect = [Z.door + 52, 92, 26, 34];
/** A-board on the pavement: tonight's names, chalked. */
/** The dock fence at the far right, past the club, and its locked gate. */
const DOCK_FENCE = pxPath([
  ...repeat(7, 8, [W - 52, 104, 3, FLOOR - 104] as Rect),
  [W - 54, 108, 56, 3],
  [W - 54, 134, 56, 3],
]);

/* ================================================================== *
 * GROUND — concrete plates, the rail pair, the wear of a street
 * ================================================================== */

const PLATES = (() => {
  const joints: Rect[] = [];
  for (let x = 0; x < W; x += 86) joints.push([x, FLOOR, 1, H - FLOOR]);
  joints.push([0, FLOOR + 11, W, 1]);
  return pxPath(joints);
})();
const APRON = pxPath([[0, FLOOR, W, H - FLOOR]]);

/* ---- the plates, plate by plate --------------------------------------------
 * A yard is paved one slab at a time over forty years, and no two pours
 * match: some plates darker, one or two renewed and paler, tar squeezed out
 * of the joints that move, cracks across the ones that carry the crane. All
 * of it precomputed, one path per treatment. */

/** Every third-ish plate runs darker; a couple were re-poured and run pale. */
const PLATE_DARK = pxPath(
  Array.from({ length: Math.ceil(W / 86) }, (_, i) => i)
    .filter((i) => hash(i * 17 + 2) > 0.62)
    .map((i) => [i * 86 + 1, FLOOR, 85, H - FLOOR] as Rect),
);
const PLATE_PALE = pxPath(
  Array.from({ length: Math.ceil(W / 86) }, (_, i) => i)
    .filter((i) => hash(i * 31 + 5) > 0.87)
    .map((i) => [i * 86 + 1, FLOOR, 85, H - FLOOR] as Rect),
);
/** Tar bleeding out of the joints that work the hardest. */
const TAR_JOINTS = pxPath(
  Array.from({ length: Math.ceil(W / 86) }, (_, i) => i)
    .filter((i) => hash(i * 7 + 3) > 0.55)
    .flatMap((i) => {
      const x = i * 86;
      const y0 = FLOOR + Math.round(hash(i * 11) * 8);
      return [
        [x - 1, y0, 3, 8 + Math.round(hash(i * 13) * 12)],
        [x - 2, y0 + 4, 5, 2],
      ] as Rect[];
    }),
);
/** Cracks: stepped diagonals across the plates that carry the crane road. */
const CRACKS = pxPath(
  [3, 7, 11, 14, 16].flatMap((i) => {
    const x0 = i * 86 + 8 + Math.round(hash(i * 5) * 40);
    const y0 = FLOOR + 2 + Math.round(hash(i * 9) * 6);
    const out: Rect[] = [];
    let x = x0;
    let y = y0;
    for (let s = 0; s < 6; s++) {
      out.push([x, y, 3 + Math.round(hash(i + s) * 3), 1]);
      x += 3 + Math.round(hash(i * s + 2) * 3);
      y += hash(i * 3 + s) > 0.4 ? 2 : 1;
      if (y > H - 3) break;
    }
    return out;
  }),
);
/**
 * The sett apron through the gap: the cobbled road the plates replaced
 * everywhere else still shows where the gate traffic kept it. Joint grid over
 * a tinted field — two paths for a whole surface change.
 */
const SETTS_FIELD: Rect = [Z.gap - 6, FLOOR, 130, H - FLOOR];
const SETTS_JOINTS = pxPath([
  ...repeat(Math.ceil(130 / 9), 9, [SETTS_FIELD[0] + 4, FLOOR, 1, H - FLOOR] as Rect),
  ...repeat(Math.ceil((H - FLOOR) / 5), 5, [SETTS_FIELD[0], FLOOR + 4, 130, 1] as Rect, "y"),
]);
const SETTS_GLINT = pxPath(
  Array.from({ length: 14 }, (_, i) => {
    const x = SETTS_FIELD[0] + 3 + Math.round(hash(i * 19) * 122);
    const y = FLOOR + 2 + Math.round(hash(i * 23 + 7) * 24);
    return [x, y, 2, 1] as Rect;
  }),
);
/** Ballast shadow between the rails — they were laid in a bed, not painted. */
const RAIL_BED = pxPath([[0, 156, W, 12]]);
const BED_STONES = pxPath(
  Array.from({ length: 60 }, (_, i) => {
    const x = Math.round(hash(i * 41 + 9) * W);
    const y = 158 + Math.round(hash(i * 43 + 3) * 7);
    return [x, y, 1, 1] as Rect;
  }),
);
/** The desire line: the diagonal everyone actually walks, stair to bar. */
const DESIRE_PATH = pxPath(
  Array.from({ length: 10 }, (_, i) => [150 + i * 62, 157 + Math.round(i * 0.9), 48, 4] as Rect),
);
/** Splash-back staining where the plates meet the walls. */
const SPLASH_STAIN = pxPath([
  [HA.x0, FLOOR, HA.x1 - HA.x0, 3],
  [HB.x0, FLOOR, HB.x1 - HB.x0, 3],
]);
/** A manhole in the yard, ringed, with its two pick holes. */
const MANHOLE = pxPath(steppedEllipse(1408, 163, 11, 4, 2));
const MANHOLE_RING = pxPath([
  [1398, 160, 21, 1],
  [1398, 166, 21, 1],
]);
const MANHOLE_PICKS = pxPath([
  [1403, 162, 2, 2],
  [1412, 162, 2, 2],
]);
/** The second, smaller puddle in a working joint; wet fringe by the big one. */
const PUDDLE_2 = pxPath(steppedEllipse(602, 168, 12, 3, 2));
/** Broken glass around the bar — it glitters only when the bulbs are on. */
const GLASS_GLITTER = pxPath(
  Array.from({ length: 8 }, (_, i) => {
    const x = Z.bar + 140 + Math.round(hash(i * 37 + 4) * 190);
    const y = FLOOR + 6 + Math.round(hash(i * 29 + 11) * 16);
    return [x, y, 1, 1] as Rect;
  }),
);
/**
 * The shipyard rail pair, still set into the plates, running the whole
 * street. Two steel lines with the flangeway groove beside each — the single
 * strongest thing the ground can say about where this is. They catch every
 * light the street turns on.
 */
const RAIL_Y = [157, 165] as const;
const RAILS = pxPath(RAIL_Y.map((y) => [0, y, W, 2] as Rect));
const RAIL_GROOVE = pxPath(RAIL_Y.map((y) => [0, y + 2, W, 1] as Rect));
/** Weeds in the plate joints and along the rails, dry by autumn. */
const WEEDS = pxPath(
  Array.from({ length: 30 }, (_, i) => {
    const x = Math.round(hash(i * 13) * W);
    const y = FLOOR + 2 + Math.round(hash(i * 29 + 3) * 16);
    return [x, y - 3, 2, 3] as Rect;
  }),
);
/** Drain channel across the street in the gap, grated. */
const DRAIN = pxPath([[Z.gap + 30, FLOOR + 4, 60, 4]]);
const DRAIN_SLOTS = pxPath(repeat(12, 5, [Z.gap + 32, FLOOR + 5, 2, 2] as Rect));
/** Yellow cable ramps where the generator's cables cross the walking line. */
const CABLE_RAMPS = pxPath([
  [Z.frytki + 138, FLOOR + 6, 26, 4],
  [Z.bar + 246, FLOOR + 12, 26, 4],
]);
const CABLE_RUNS = pxPath([
  [Z.frytki + 130, FLOOR + 8, 8, 2],
  [Z.frytki + 164, FLOOR + 8, 30, 2],
  [Z.bar + 236, FLOOR + 14, 10, 2],
  [Z.bar + 272, FLOOR + 14, 24, 2],
]);
/** The puddle in the worn plate by the yard — rimlit at night by the neon. */
const PUDDLE = pxPath(steppedEllipse(Z.board + 60, FLOOR + 14, 24, 5, 2));
const PUDDLE_RIM = pxPath([[Z.board + 40, FLOOR + 10, 40, 1]]);
/** Paint on the plates: an old crane road marking, half gone. */
const YARD_MARKING = pxPath([...repeat(4, 40, [Z.halaA + 20, FLOOR + 20, 22, 3] as Rect)]);
/** Bottle caps trodden into the concrete around the bar. */
const CAPS = pxPath(
  Array.from({ length: 9 }, (_, i) => {
    const x = Z.bar + 20 + Math.round(hash(i * 7) * 220);
    const y = FLOOR + 4 + Math.round(hash(i * 11 + 2) * 14);
    return [x, y, 2, 1] as Rect;
  }),
);
/** Stubs by the smoking corner and outside the club. */
const STUBS = pxPath([
  ...Array.from(
    { length: 6 },
    (_, i) => [Z.smoke - 12 + i * 5, FLOOR + 6 + (i % 3) * 4, 2, 1] as Rect,
  ),
  ...Array.from(
    { length: 5 },
    (_, i) => [Z.smokeYard - 18 + i * 6, FLOOR + 8 + (i % 2) * 5, 2, 1] as Rect,
  ),
]);
/** Chalk hopscotch nobody who drew it plays anymore — daytime kids exist here too. */
const CHALK_SUN = pxPath([
  [Z.trafo + 60, FLOOR + 16, 10, 8],
  [Z.trafo + 63, FLOOR + 12, 4, 4],
  [Z.trafo + 72, FLOOR + 18, 4, 4],
]);
/** Sleeper ends between the rails — the bed the rails were laid in. */
const SLEEPERS = pxPath(repeat(Math.ceil(W / 26), 26, [8, 159, 3, 6] as Rect));
/** Oil where machines stood; sand spilt around the smokers' bucket. */
const OIL_STAINS = pxPath([
  ...steppedEllipse(Z.crane - 44, 163, 16, 4, 2),
  ...steppedEllipse(Z.bar - 44, 167, 12, 3, 2),
]);
const SAND_SPILL = pxPath(steppedEllipse(Z.smoke + 36, 164, 10, 3, 2));
/**
 * The painted truth of the ground profile: a kerb along the left bend (the
 * stair landing's upstand) and rubble filling the strip the right bend takes
 * away. Terrain the feet obey must be terrain the eye can read.
 */
const LEFT_KERB = pxPath([
  [0, 154, 148, 1],
  [0, 155, 150, 3],
]);
const RIGHT_RUBBLE = pxPath(
  Array.from({ length: 18 }, (_, i) => {
    const x = 1652 + Math.round(hash(i * 7 + 1) * 62);
    const y = 163 + Math.round(hash(i * 13 + 4) * 13);
    return [x, y, 2 + Math.round(hash(i * 3) * 3), 2] as Rect;
  }),
);

function Ground({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const p = PLATE[ph];
  const night = ph === "night";
  return (
    <g>
      <path d={APRON} fill={p.base} />
      <path d={APRON} fill={dth("n", "06")} opacity={0.5} />
      <path d={APRON} fill="url(#px-agg)" opacity={0.7} />
      {/* no two pours match: darker plates, two renewed pale ones, and the
          joints that work squeeze their tar out */}
      <path d={PLATE_DARK} fill="#171009" opacity={0.09} />
      <path d={PLATE_PALE} fill={p.hi} opacity={0.16} />
      <path d={PLATES} fill={p.deep} opacity={0.5} />
      <path d={TAR_JOINTS} fill="#14120e" opacity={0.6} />
      <path d={CRACKS} fill={p.deep} opacity={0.75} />
      {/* the sett apron the gate traffic kept alive through the gap */}
      <path d={pxPath([SETTS_FIELD])} fill={p.mid} />
      <path d={pxPath([SETTS_FIELD])} fill={dth("n", "12")} opacity={0.4} />
      <path d={SETTS_JOINTS} fill={p.deep} opacity={0.6} />
      <path d={SETTS_GLINT} fill={p.hi} opacity={0.5} />
      {/* the walked line, worn pale mid-band, and the diagonal everyone takes */}
      <path d={pxPath([[0, FLOOR + 8, W, 8]])} fill={p.hi} opacity={0.25} />
      <path d={DESIRE_PATH} fill={p.hi} opacity={0.14} />
      <path d={SPLASH_STAIN} fill={dth("n", "25")} opacity={0.5} />
      <path d={pxPath([[0, H - 4, W, 4]])} fill="#000" opacity={0.14} />
      {/* the rail bed: the strip the rails were laid in, stones and all */}
      <path d={RAIL_BED} fill="#171009" opacity={0.08} />
      <path d={BED_STONES} fill={p.deep} opacity={0.7} />
      <path d={SLEEPERS} fill="#000" opacity={0.1} />
      <path d={RAILS} fill={night ? "#6d7480" : "#7d838c"} />
      <path d={RAIL_GROOVE} fill="#000" opacity={0.35} />
      {/* the running edge catches the sky — one bright line, and the rails
          become steel instead of paint */}
      <path
        d={pxPath(RAIL_Y.map((y) => [0, y, W, 1] as Rect))}
        fill="#a8b0ba"
        opacity={night ? 0.25 : 0.45}
      />
      <path d={OIL_STAINS} fill="#171009" opacity={0.25} />
      <path d={SAND_SPILL} fill="#c9b489" opacity={0.35} />
      <path d={LEFT_KERB} fill={p.hi} />
      <path d={pxPath([[0, 156, 150, 2]])} fill="#000" opacity={0.25} />
      <path d={RIGHT_RUBBLE} fill={p.deep} opacity={0.9} />
      <path d={WEEDS} fill={K.weedsDry} opacity={0.8} />
      <path d={DRAIN} fill={p.deep} />
      <path d={DRAIN_SLOTS} fill="#000" opacity={0.5} />
      <path d={YARD_MARKING} fill={K.tarmacPaint} opacity={0.22} />
      <path d={CHALK_SUN} fill={K.chalk} opacity={ph === "day" || ph === "dawn" ? 0.4 : 0.15} />
      <path d={PUDDLE} fill={night ? K.puddle : "#7a828c"} opacity={0.8} />
      <path d={PUDDLE_RIM} fill={K.puddleHi} opacity={0.5} />
      <path d={PUDDLE_2} fill={night ? K.puddle : "#7a828c"} opacity={0.7} />
      {/* petrol on the oil at daylight: one iridescent fringe pixel-row */}
      {!night ? (
        <path d={pxPath([[Z.crane - 52, 161, 10, 1]])} fill={K.cyanDeep} opacity={0.3} />
      ) : null}
      {night ? (
        <path d={pxPath([[Z.board + 46, FLOOR + 12, 26, 2]])} fill={K.neon} opacity={0.3} />
      ) : null}
      <path d={MANHOLE} fill={p.lo} />
      <path d={MANHOLE_RING} fill={p.deep} opacity={0.7} />
      <path d={MANHOLE_PICKS} fill="#171009" opacity={0.6} />
      {night && s.bar === "open" ? <path d={GLASS_GLITTER} fill="#e8f2ff" opacity={0.7} /> : null}
      <path d={CABLE_RUNS} fill={K.cable} />
      <path d={CABLE_RAMPS} fill={K.hiVis} opacity={0.8} />
      <path
        d={pxPath([
          [Z.frytki + 138, FLOOR + 7, 26, 1],
          [Z.bar + 246, FLOOR + 13, 26, 1],
        ])}
        fill="#000"
        opacity={0.3}
      />
      {s.crowd >= 1 ? <path d={CAPS} fill="#b8912e" opacity={0.7} /> : null}
      <path d={STUBS} fill={K.cream} opacity={0.5} />
    </g>
  );
}

/* ================================================================== *
 * STATIC — the furniture of a street that gets built every April
 * ================================================================== */

/* ---- the container bar, 768..998 ---------------------------------------- */

const CONT: Rect = [Z.bar, FLOOR - 98, 230, 98];
const CONT_SET = bevelPaths([CONT]);
/**
 * The roof, seen edge-on from slightly above: a lit top face overhanging the
 * front by two pixels, corner castings at both ends, and the box's whole
 * volume arrives with it — a rectangle became a container.
 */
const CONT_ROOF = pxPath([[CONT[0] - 2, CONT[1] - 5, CONT[2] + 4, 5]]);
const CONT_ROOF_LIP = pxPath([[CONT[0] - 2, CONT[1] - 1, CONT[2] + 4, 1]]);
const CONT_CASTINGS = pxPath([
  [CONT[0] - 3, CONT[1] - 6, 7, 8],
  [CONT[0] + CONT[2] - 4, CONT[1] - 6, 7, 8],
  [CONT[0] - 3, FLOOR - 8, 7, 8],
  [CONT[0] + CONT[2] - 4, FLOOR - 8, 7, 8],
]);
const CONT_ROOF_KIT = pxPath([
  /* the flue of the mulled-wine pot, and an abandoned aerial */
  [CONT[0] + 158, CONT[1] - 11, 5, 6],
  [CONT[0] + 40, CONT[1] - 12, 2, 7],
  [CONT[0] + 36, CONT[1] - 12, 10, 2],
]);
const CONT_CORR = pxPath(repeat(27, 8, [CONT[0] + 5, CONT[1] + 4, 3, CONT[3] - 8] as Rect));
const CONT_CORNERS = pxPath([
  [CONT[0], CONT[1], 6, CONT[3]],
  [CONT[0] + CONT[2] - 6, CONT[1], 6, CONT[3]],
]);
/** The serving hatch cut into it, with the flap propped up as an awning. */
const HATCH: Rect = [Z.bar + 76, FLOOR - 74, 104, 42];
const HATCH_DARK = pxPath([HATCH]);
const HATCH_FLAP = pxPath([
  [HATCH[0] - 4, HATCH[1] - 12, HATCH[2] + 8, 6],
  [HATCH[0] - 2, HATCH[1] - 7, 3, 8],
  [HATCH[0] + HATCH[2] - 1, HATCH[1] - 7, 3, 8],
]);
/** The counter across the hatch and what stands on it. */
const HATCH_COUNTER = pxPath([[HATCH[0] - 4, HATCH[1] + HATCH[3] - 4, HATCH[2] + 8, 6]]);
const HATCH_TAPS = pxPath([
  [HATCH[0] + 14, HATCH[1] + HATCH[3] - 14, 3, 10],
  [HATCH[0] + 13, HATCH[1] + HATCH[3] - 16, 5, 3],
]);
const HATCH_CUPS = pxPath([
  [HATCH[0] + 68, HATCH[1] + HATCH[3] - 10, 6, 6],
  [HATCH[0] + 76, HATCH[1] + HATCH[3] - 8, 6, 4],
]);
/** Backbar glow inside: shelves of bottles reading as lit rows after dark. */
const HATCH_SHELVES = pxPath([
  [HATCH[0] + 8, HATCH[1] + 8, HATCH[2] - 16, 3],
  [HATCH[0] + 8, HATCH[1] + 20, HATCH[2] - 16, 3],
]);
const HATCH_BOTTLES = pxPath([
  ...repeat(9, 9, [HATCH[0] + 12, HATCH[1] + 2, 4, 6] as Rect),
  ...repeat(8, 10, [HATCH[0] + 14, HATCH[1] + 14, 4, 6] as Rect),
]);
/** BAR PRĄD, stencilled on the container over the hatch. */
/** High enough that the propped hatch flap never cuts the lettering. */
const BAR_SIGN_Y = FLOOR - 96;
/** The closed state: a padlocked roller shutter over the hatch. */
const HATCH_SHUT = pxPath([HATCH, [HATCH[0] - 2, HATCH[1] - 3, HATCH[2] + 4, 3]]);
const HATCH_SHUT_RIBS = pxPath(repeat(9, 5, [HATCH[0], HATCH[1] + 3, HATCH[2], 1] as Rect, "y"));
/** The blackboard menu hung on the container's left end. */
const BAR_MENU: Rect = [Z.bar + 14, FLOOR - 66, 40, 44];
const BAR_MENU_LINES = pxPath([
  [BAR_MENU[0] + 5, BAR_MENU[1] + 8, 26, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 15, 30, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 22, 22, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 29, 28, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 36, 18, 2],
]);

/* ---- the furniture that stands IN the band -------------------------------- */

/**
 * Everything a person can walk around lives here, as depth-sorted prop actors
 * (see bandProps.ts): the engine sorts them against the player by feet line,
 * so walking behind a barrel puts the barrel in front of you — which is the
 * entire difference between furniture and wallpaper. Each prop carries three
 * duties in three places: its sprite (an actor), its footprint (a blocker in
 * `ground`), and its shadow (painted in the art planes below every figure).
 *
 *   id            x      feet   what
 *   crates        760    158    empties by the container's left corner
 *   barrel-c      966    165    plain keg, front row
 *   barrel-a     1008    156    keg with last night's cups
 *   barrel-b     1030    167    keg with cups, nearest the walk
 *   drum-table    588    164    cable drum, the gap's found furniture
 *   kosz         1200    167    the green bin the picnic table feeds
 *   picnic       1220    160    the A-frame table (sit BEHIND it: the near
 *                               bench and tabletop then paint over your lap)
 *   aboard       1330    157    tonight's chalk, moved out for the queue
 */
type PropSpec = { id: string; x: number; y: number; w: number };
const PROPS: readonly PropSpec[] = [
  { id: "prop-crates", x: 760, y: 158, w: 30 },
  { id: "prop-barrel-c", x: 966, y: 165, w: 22 },
  { id: "prop-barrel-a", x: 1008, y: 156, w: 22 },
  { id: "prop-barrel-b", x: 1030, y: 167, w: 22 },
  { id: "prop-drum", x: 588, y: 164, w: 32 },
  /**
   * The bin stood at x=1200, which put its footprint UNDER the picnic table's:
   * 1192..1208 against the table's 1194..1246, with two pixels of clear y
   * between them. Nothing looked wrong, and the bin could not be used — the
   * approach point could not escape one blocker without landing in the other,
   * so `nearestWalkable` bounced it back and forth and the walk stalled short.
   * Moved clear of the table's left leg, which is also where a bin goes.
   */
  { id: "prop-kosz", x: 1176, y: 167, w: 14 },
  { id: "prop-picnic", x: 1220, y: 160, w: 58 },
  { id: "prop-aboard", x: 1330, y: 157, w: 26 },
] as const;
const P = Object.fromEntries(PROPS.map((p) => [p.id, p])) as Record<string, PropSpec>;

/** The pallet bench against hall A, by the smoking corner (back line — flat art sorts correctly there). */
const PALLETS = pxPath([
  [Z.smoke - 76, FLOOR - 18, 44, 18],
  [Z.smoke - 76, FLOOR - 20, 44, 3],
  ...repeat(5, 9, [Z.smoke - 73, FLOOR - 16, 3, 14] as Rect),
]);

/* ---- the frytki trailer, 1046..1170 -------------------------------------- */

const TRAIL: Rect = [Z.frytki, FLOOR - 76, 124, 70];
const TRAIL_SET = bevelPaths([TRAIL]);
const TRAIL_HATCH: Rect = [Z.frytki + 22, FLOOR - 62, 80, 34];
/** The awning band carries the trailer's name; scallops hang under it. */
const TRAIL_AWNING = pxPath([
  [TRAIL_HATCH[0] - 8, TRAIL_HATCH[1] - 13, TRAIL_HATCH[2] + 16, 8],
  ...repeat(6, 16, [TRAIL_HATCH[0] - 6, TRAIL_HATCH[1] - 5, 8, 3] as Rect),
]);
const TRAIL_SIGN_X = TRAIL_HATCH[0] + Math.round(TRAIL_HATCH[2] / 2) - 14;
const TRAIL_COUNTER = pxPath([
  [TRAIL_HATCH[0] - 4, TRAIL_HATCH[1] + TRAIL_HATCH[3] - 3, TRAIL_HATCH[2] + 8, 5],
]);
const TRAIL_FRYER = pxPath([
  [TRAIL_HATCH[0] + 50, TRAIL_HATCH[1] + 10, 22, 18],
  [TRAIL_HATCH[0] + 54, TRAIL_HATCH[1] + 6, 14, 4],
]);
const TRAIL_BOTTLES = pxPath([
  [TRAIL_HATCH[0] + 6, TRAIL_HATCH[1] + 22, 5, 9],
  [TRAIL_HATCH[0] + 13, TRAIL_HATCH[1] + 22, 5, 9],
]);
const TRAIL_WHEEL = pxPath([
  [Z.frytki + 14, FLOOR - 8, 16, 8],
  [Z.frytki + 18, FLOOR - 6, 8, 6],
  [Z.frytki + 94, FLOOR - 8, 16, 8],
  [Z.frytki + 98, FLOOR - 6, 8, 6],
]);
const TRAIL_JACK = pxPath([[Z.frytki + 116, FLOOR - 10, 4, 10]]);
/** The roof edge, and the drawbar with its jockey wheel — a trailer is a
 * vehicle that was towed here in April, and the hitch is the proof. */
const TRAIL_ROOF = pxPath([[TRAIL[0] - 2, TRAIL[1] - 4, TRAIL[2] + 4, 4]]);
const TRAIL_ROOF_LIP = pxPath([[TRAIL[0] - 2, TRAIL[1], TRAIL[2] + 4, 1]]);
const TRAIL_HITCH = pxPath([
  [TRAIL[0] - 16, FLOOR - 20, 16, 3],
  [TRAIL[0] - 22, FLOOR - 17, 8, 3],
  [TRAIL[0] - 20, FLOOR - 14, 3, 9],
  [TRAIL[0] - 22, FLOOR - 6, 7, 6],
]);
/** FRYTKI, painted on the trailer's brow. */
/** Its menu board on the counter end and the ketchup pump beside the hatch. */
const TRAIL_MENU: Rect = [Z.frytki + 106, FLOOR - 58, 16, 26];
const TRAIL_SHUT = pxPath([TRAIL_HATCH]);
const TRAIL_SHUT_RIBS = pxPath(
  repeat(7, 5, [TRAIL_HATCH[0], TRAIL_HATCH[1] + 2, TRAIL_HATCH[2], 1] as Rect, "y"),
);
/** The generator behind the trailer's offside, cable to the ramp. */
const GEN: Rect = [Z.frytki + 128, FLOOR - 26, 34, 22];
const GEN_SET = bevelPaths([GEN]);
const GEN_VENTS = pxPath(repeat(4, 6, [GEN[0] + 5, GEN[1] + 5, 3, 12] as Rect));
const GEN_LED = pxPath([[GEN[0] + 28, GEN[1] + 4, 2, 2]]);

/* ---- the yard: event board, crane leg, bikes ----------------------------- */

/** The event board: a scaffold billboard with this season's lineup. */
const BOARD: Rect = [Z.board - 50, 58, 100, 64];
const BOARD_SET = bevelPaths([BOARD]);
const BOARD_LEGS = pxPath([
  [Z.board - 44, 122, 5, FLOOR - 122],
  [Z.board + 39, 122, 5, FLOOR - 122],
  [Z.board - 46, 132, 92, 3],
]);
const BOARD_PAPER = pxPath([[BOARD[0] + 5, BOARD[1] + 5, BOARD[2] - 10, BOARD[3] - 10]]);
const BOARD_ART = pxPath([
  [BOARD[0] + 12, BOARD[1] + 12, BOARD[2] - 24, 16],
  [BOARD[0] + 12, BOARD[1] + 34, 40, 3],
  [BOARD[0] + 12, BOARD[1] + 40, 52, 3],
  [BOARD[0] + 12, BOARD[1] + 46, 34, 3],
]);
const BOARD_TEAR = pxPath([[BOARD[0] + BOARD[2] - 18, BOARD[1] + 44, 13, 12]]);

/**
 * The parked portal crane leg: one foot of a crane that has stood on the
 * street's own rails since the eighties, fenced at the base, too expensive to
 * move and too listed to scrap. It goes up out of frame — you are standing
 * under it, which no background crane can do.
 */
const CRANE_LEG = pxPath([
  [Z.crane - 14, 0, 12, FLOOR - 4],
  [Z.crane + 10, 0, 10, FLOOR - 4],
  ...repeat(7, 20, [Z.crane - 2, 8, 12, 3] as Rect), // lattice bracing
  [Z.crane - 20, FLOOR - 12, 46, 8], // the bogie beam
  [Z.crane - 16, FLOOR - 4, 12, 4],
  [Z.crane + 12, FLOOR - 4, 12, 4], // wheels on the rails
]);
const CRANE_LEG_PLATE = pxPath([[Z.crane - 8, 96, 22, 12]]);
/** The bikes against the board's legs — nobody drives here. Two of them,
 *  leaned into each other the way they get left, both from propKit. */
const BOARD_BIKE_A = bicycle(Z.board + 50, FLOOR, 1);
const BOARD_BIKE_B = bicycle(Z.board + 62, FLOOR, -1);

/* ---- the queue, 1352..1478 ----------------------------------------------- */

const BARRIER_X = [Z.queue, Z.queue + 44, Z.queue + 88] as const;
const BARRIERS = pxPath(
  BARRIER_X.flatMap(
    (x) =>
      [
        [x, 126, 3, FLOOR - 126],
        [x + 34, 126, 3, FLOOR - 126],
        [x + 2, 128, 33, 3],
        [x + 2, 140, 33, 2],
      ] as Rect[],
  ),
);
/** The portaloos beyond the queue, against hall B's first pier. */
const LOO_X = [Z.club + 8, Z.club + 40] as const;
const LOOS = bevelPaths(LOO_X.map((x) => [x, FLOOR - 74, 28, 74] as Rect));
const LOO_ROOFS = pxPath(LOO_X.map((x) => [x - 2, FLOOR - 78, 32, 4] as Rect));
const LOO_DOORS = pxPath(LOO_X.map((x) => [x + 4, FLOOR - 64, 20, 60] as Rect));
const LOO_LOCKS = pxPath(LOO_X.map((x) => [x + 20, FLOOR - 40, 3, 5] as Rect));
const LOO_VENTS = pxPath(LOO_X.map((x) => [x + 8, FLOOR - 71, 12, 3] as Rect));

/* ---- the festoon strings -------------------------------------------------- */

/**
 * Three spans of festoon bulbs: hall A's corner to a pole by the bar, the
 * pole to the trailer, the trailer to the event board. Sagging catenaries via
 * steppedCable, bulbs hung off cableY every 26 px. The poles are their own
 * objects — scaffold standards with concrete feet, because somebody put them
 * up in April and will take them down in October.
 */
/** At the container's corner casting and by the board — never through the
 * lettering or the hatch, which the first placement managed to do to both. */
const POLE_X = [Z.bar + 226, Z.board - 62] as const;
/**
 * The festoon breaker on the first pole: a grey box, a conduit down to the
 * plates, and a toggle the player can actually throw — the street's lights
 * answer to it, which makes it the most honest interaction here.
 */
const BREAKER: Rect = [POLE_X[0] - 7, 116, 12, 16];
const BREAKER_CONDUIT = pxPath([
  [POLE_X[0] - 2, 132, 3, FLOOR - 132],
  [POLE_X[0] - 2, 108, 3, 8],
]);
const BREAKER_LEVER = pxPath([
  [BREAKER[0] + 3, BREAKER[1] + 5, 6, 3],
  [BREAKER[0] + 5, BREAKER[1] + 8, 2, 4],
]);
const FEST_SPANS: [number, number, number, number, number][] = [
  [Z.gap - 12, 44, POLE_X[0], 52, 14],
  [POLE_X[0], 52, POLE_X[1], 56, 16],
  [POLE_X[1], 56, Z.club + 6, 48, 14],
];
const FEST_WIRES = pxPath(
  FEST_SPANS.flatMap(([x0, y0, x1, y1, sag]) => steppedCable(x0, y0, x1, y1, sag, 8)),
);
const FEST_BULB_PTS: [number, number][] = FEST_SPANS.flatMap(([x0, y0, x1, y1, sag]) => {
  const pts: [number, number][] = [];
  for (let x = x0 + 18; x < x1 - 8; x += 26) pts.push([x, cableY(x0, y0, x1, y1, sag, x) + 3]);
  return pts;
});
const FEST_BULBS = bulbPaths(FEST_BULB_PTS);
const FEST_POLES = pxPath(
  POLE_X.flatMap(
    (x) =>
      [
        [x - 2, 48, 4, FLOOR - 48],
        [x - 8, FLOOR - 8, 16, 8],
      ] as Rect[],
  ),
);

/* ---- bulkhead lamps on the brick ------------------------------------------ */

/** On the piers and on hall B's blank wall — never in front of the glass. */
const BULKHEAD_X = [365, 487, Z.club + 190] as const;
const BULKHEADS = pxPath(
  BULKHEAD_X.flatMap(
    (x) =>
      [
        [x - 5, 58, 10, 6],
        [x - 3, 64, 6, 2],
      ] as Rect[],
  ),
);

/* ---- shadows and contact -------------------------------------------------- */

const CONTACTS = contactPaths([
  [CONT[0] + 2, CONT[2] - 4, FLOOR] as const,
  [TRAIL[0] + 4, TRAIL[2] - 8, FLOOR] as const,
  [GEN[0], GEN[2], FLOOR - 4] as const,
  [BOARD[0] + 6, 8, FLOOR] as const,
  [Z.board + 33, 8, FLOOR] as const,
  [LOO_X[0], 28, FLOOR] as const,
  [LOO_X[1], 28, FLOOR] as const,
  [Z.crane - 20, 46, FLOOR - 4] as const,
]);
/** Contact under every band prop, at that prop's own feet line. */
const PROP_CONTACTS = contactPaths(
  PROPS.map((p) => [Math.round(p.x - p.w / 2), p.w, p.y] as const),
);

/**
 * A cast shadow: rows walking down-right off the object's foot, thinning as
 * they go — the sun is up-left, so every shadow on this street agrees. Length
 * scales with the thing's height; the group that renders these fades with the
 * phase (full at day, gone at night, when the festoon pools take over).
 */
function skewShadow(cx: number, footY: number, w: number, len: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 1; i <= len; i++) {
    const shrink = Math.round((w * i) / (len * 2.2));
    out.push([Math.round(cx - w / 2 + i * 3 + shrink / 2), footY + i, Math.max(2, w - shrink), 1]);
  }
  return out;
}
const PROP_SUN_SHADOWS = pxPath(PROPS.flatMap((p) => skewShadow(p.x, p.y, p.w + 4, 4)));
const STATIC_SUN_SHADOWS = pxPath([
  ...skewShadow(CONT[0] + CONT[2] / 2, FLOOR, CONT[2] + 6, 8),
  ...skewShadow(TRAIL[0] + 62, FLOOR, TRAIL[2] + 4, 7),
  ...skewShadow(Z.trafo, FLOOR, TRAFO[2] + 4, 6),
  ...skewShadow(Z.board, FLOOR, 96, 6),
  ...skewShadow(LOO_X[0] + 14, FLOOR, 30, 6),
  ...skewShadow(LOO_X[1] + 14, FLOOR, 30, 6),
  ...skewShadow(Z.crane + 2, FLOOR, 48, 7),
  ...skewShadow(GEN[0] + GEN[2] / 2, FLOOR, GEN[2] + 2, 4),
  ...POLE_X.flatMap((x) => skewShadow(x + 4, FLOOR, 6, 7)),
  ...skewShadow(Z.skm + 8, FLOOR, 10, 6),
]);
const HALL_AO = aoPaths([
  [HA.x0, FLOOR - 2, HA.x1 - HA.x0] as const,
  [HB.x0, FLOOR - 2, HB.x1 - HB.x0] as const,
]);

/* ================================================================== *
 * light — precomputed tiers for everything that glows
 * ================================================================== */

/** The festoon: pools on the concrete under each span's low point. */
const FEST_POOLS = tiers(
  (k) =>
    FEST_SPANS.flatMap(([x0, , x1]) => {
      const cx = Math.round((x0 + x1) / 2);
      return steppedEllipse(cx, 160, Math.round(((x1 - x0) / 2 + 10) * k), Math.round(12 * k), 2);
    }),
  "w",
  1.1,
);
/** The neon's wash on the pavement and the queue. */
/**
 * The neon's wash on the pavement — magenta, so it cannot come from tiers()
 * (which only knows the four house tints): two stepped ellipses in the neon's
 * own colours, accumulated the same way.
 */
const NEON_POOL_WIDE = pxPath(steppedEllipse(Z.door, 158, 90, 13, 2));
const NEON_POOL_CORE = pxPath(steppedEllipse(Z.door, 158, 52, 9, 2));
/** The studio hall's cyan panes land a lattice on the street. */
const CYAN_POOL = tiers(
  (k) =>
    HA_WIN.flatMap(([x, , w]) =>
      steppedEllipse(x + w / 2, 159, Math.round((w / 2 + 8) * k), Math.round(10 * k), 2),
    ),
  "c",
  0.8,
);
/** The bar hatch and the trailer hatch throw warm counters of light. */
const HATCH_POOL = tiers(
  (k) => steppedEllipse(Z.bar + 128, 160, Math.round(70 * k), Math.round(12 * k), 2),
  "w",
  1,
);
const TRAIL_POOL = tiers(
  (k) => steppedEllipse(Z.frytki + 62, 160, Math.round(52 * k), Math.round(11 * k), 2),
  "w",
  0.9,
);
/** The bulkhead lamps: sodium cones down the brick. */
const BULKHEAD_CONES = tiers(
  (k) =>
    BULKHEAD_X.flatMap((x) => steppedCone(x, 64, Math.round(6 * k), FLOOR, Math.round(26 * k), 6)),
  "e",
  0.9,
);
const BULKHEAD_GLOW = bulbPaths(BULKHEAD_X.map((x) => [x, 61] as [number, number]));
/** The door lamp's small pool where the bouncer stands. */
const DOOR_POOL = tiers(
  (k) => steppedEllipse(Z.door - 47, 156, Math.round(22 * k), Math.round(8 * k), 2),
  "w",
  0.8,
);

const VIGNETTE = vignettePaths(W, H);

/* ================================================================== *
 * MID plane component — enriched pass
 *
 * Everything added here is built ONLY from symbols the module already
 * has (HA, HB, DOOR, FLOOR, HA_WIN, the sign rects, the palettes),
 * so it drops straight in. The additions are all *form* passes:
 *   - parapet coping + soot wash at the top of both halls
 *   - sun from the upper-left: lit left arris, shaded right arris
 *   - a sky-light / ground-dark tonal split down each facade
 *   - contact shadow where the walls meet the street
 *   - piers lifted a half-tone so they read as standing proud
 *   - per-window: grime on the glass, drips off the sills,
 *     light-spill onto the brick when the studios are on,
 *     spalled brick around some openings
 *   - the door gets a kickplate, hinges, a hand-worn patch,
 *     and a slit of club light under the leaf
 *   - small drop shadows under every sign and board
 * ================================================================== */

function Halls({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const brick = BRICK[ph];
  const brickB = BRICKB[ph];
  const steel = STEEL[ph];
  const rust = RUST[ph];
  const dark = isDark(ph);
  const night = ph === "night";
  const studioLit = dark; // the studios work nights

  const haW = HA.x1 - HA.x0;
  const hbW = HB.x1 - HB.x0;
  const SHADE = "#171009"; // the one shadow ink the reveals already use
  const SKY = "#e8f0f6"; // cold sky-light for top-of-wall lift
  // stunt materials: every slot the same ink, spread over the real brick
  // mat so any extra fields the Mat type carries stay satisfied. They let
  // a whole Bev set be repainted as one thing — a cast shadow, a rim of
  // light, a grain — without knowing a single rect inside it.
  const matShade = { ...brick, base: SHADE, mid: SHADE, hi: SHADE, lo: SHADE, deep: SHADE };
  const matLite = {
    ...brick,
    base: brick.hi,
    mid: brick.hi,
    hi: brick.hi,
    lo: brick.hi,
    deep: brick.hi,
  };
  const g25 = dth("n", "25");
  const matGrain = { ...brick, base: g25, mid: g25, hi: g25, lo: g25, deep: g25 };

  return (
    <g>
      {/* ---- the SKM stair and fence, far left ---------------------------
          Everything here is lit by the same offset-pair trick: the shape is
          painted once in its highlight tone, then again one pixel lower in
          its body tone. Whatever the geometry is, every upward-facing edge
          — tread noses, rail tops, picket heads — catches the light, and
          no constant needs to be known for it to work. */}
      {/* the post: cast shadow behind it, a lit left arris, rust weeping down */}
      <path d={SKM_POST} transform="translate(2,2)" fill={SHADE} opacity={0.15} />
      <path d={SKM_POST} fill={steel.hi} />
      <path d={SKM_POST} transform="translate(1,0)" fill={steel.mid} />
      <path d={SKM_POST} transform="translate(1,0)" fill={dth("n", "25")} opacity={0.2} />
      {/* the stair: shadow it casts, the dark riser under-edge, then the
          treads — the hi layer peeks out one pixel above the mid layer,
          so every tread nose is a line of light */}
      <path d={SKM_STAIR} transform="translate(2,3)" fill={SHADE} opacity={0.2} />
      <path d={SKM_STAIR} transform="translate(1,1)" fill={PLATE[ph].deep} />
      <path d={SKM_STAIR} fill={PLATE[ph].hi} />
      <path d={SKM_STAIR} transform="translate(0,1)" fill={PLATE[ph].mid} />
      {/* checker-plate grain, and the dull grey where the boots always land */}
      <path d={SKM_STAIR} transform="translate(0,1)" fill={dth("n", "12")} opacity={0.25} />
      <path d={SKM_STAIR} transform="translate(0,1)" fill="url(#px-stucco)" opacity={0.15} />
      {/* the rail lays its thin shadow across the treads, then takes a glint */}
      <path d={SKM_RAIL} transform="translate(2,3)" fill={SHADE} opacity={0.22} />
      <path d={SKM_RAIL} fill={steel.hi} />
      <path d={SKM_RAIL} transform="translate(0,1)" fill={steel.base} />
      <path d={pxPath([SKM_SIGN])} fill="#0e3566" />
      {/* enamel plates have a rolled edge — one faint line inside the border */}
      <path
        d={pxPath([
          [SKM_SIGN[0] + 1, SKM_SIGN[1] + 1, SKM_SIGN[2] - 2, 1],
          [SKM_SIGN[0] + 1, SKM_SIGN[1] + SKM_SIGN[3] - 2, SKM_SIGN[2] - 2, 1],
          [SKM_SIGN[0] + 1, SKM_SIGN[1] + 2, 1, SKM_SIGN[3] - 4],
          [SKM_SIGN[0] + SKM_SIGN[2] - 2, SKM_SIGN[1] + 2, 1, SKM_SIGN[3] - 4],
        ])}
        fill={K.white}
        opacity={0.18}
      />
      <BigText
        x={SKM_SIGN[0] + 5}
        y={SKM_SIGN[1] + 3}
        text="SKM STOCZNIA"
        k={1}
        fill={K.white}
        op={0.95}
      />
      <path
        d={pxPath([[SKM_SIGN[0], SKM_SIGN[1] + 11, SKM_SIGN[2], 1]])}
        fill={K.white}
        opacity={0.4}
      />
      {/* four bolt heads hold the plate to the post */}
      <path
        d={pxPath([
          [SKM_SIGN[0] + 1, SKM_SIGN[1] + 1, 1, 1],
          [SKM_SIGN[0] + SKM_SIGN[2] - 2, SKM_SIGN[1] + 1, 1, 1],
          [SKM_SIGN[0] + 1, SKM_SIGN[1] + SKM_SIGN[3] - 2, 1, 1],
          [SKM_SIGN[0] + SKM_SIGN[2] - 2, SKM_SIGN[1] + SKM_SIGN[3] - 2, 1, 1],
        ])}
        fill={steel.hi}
        opacity={0.8}
      />
      {/* the sign is a plate on a post — give it a cast edge and a rust bleed */}
      <path
        d={pxPath([[SKM_SIGN[0] + 1, SKM_SIGN[1] + SKM_SIGN[3], SKM_SIGN[2], 2]])}
        fill={SHADE}
        opacity={0.35}
      />
      <path
        d={pxPath([
          [SKM_SIGN[0] + 2, SKM_SIGN[1] + SKM_SIGN[3] + 2, 1, 8],
          [SKM_SIGN[0] + SKM_SIGN[2] - 3, SKM_SIGN[1] + SKM_SIGN[3] + 2, 1, 5],
        ])}
        fill={rust.base}
        opacity={0.5}
      />
      {/* the little supplementary plate under it: peron, arrow up the stairs */}
      <path
        d={pxPath([[SKM_SIGN[0] + 2, SKM_SIGN[1] + SKM_SIGN[3] + 4, SKM_SIGN[2] - 14, 7]])}
        fill={K.white}
        opacity={0.75}
      />
      <path
        d={pxPath([
          [SKM_SIGN[0] + 4, SKM_SIGN[1] + SKM_SIGN[3] + 6, 9, 2],
          [SKM_SIGN[0] + 15, SKM_SIGN[1] + SKM_SIGN[3] + 6, 4, 2],
          [SKM_SIGN[0] + 17, SKM_SIGN[1] + SKM_SIGN[3] + 5, 2, 1],
          [SKM_SIGN[0] + 17, SKM_SIGN[1] + SKM_SIGN[3] + 8, 2, 1],
        ])}
        fill={K.posterInk}
        opacity={0.75}
      />
      {/* the fence: picket heads lit, its long shadow laid down behind it */}
      <path d={FENCE_A} transform="translate(1,2)" fill={SHADE} opacity={0.12} />
      <path d={FENCE_A} fill={steel.mid} />
      <path d={FENCE_A} transform="translate(0,1)" fill={steel.lo} />

      {/* ---- the substation kiosk ----------------------------------------- */}
      {/* the whole kiosk gets three full-body passes: the shadow it throws
          onto whatever stands behind it, a rim of light peeking one pixel
          above every top edge, and — after the true body — a grain that
          keeps the render from ever reading as flat colour */}
      <g transform="translate(3,4)" opacity={0.18}>
        <Bev set={TRAFO_SET} mat={matShade} />
      </g>
      <g transform="translate(0,-1)">
        <Bev set={TRAFO_SET} mat={matLite} />
      </g>
      <Bev set={TRAFO_SET} mat={brick} />
      <g opacity={0.07}>
        <Bev set={TRAFO_SET} mat={matGrain} />
      </g>
      {/* the roof: first the eaves shadow it drops onto its own brick, then
          a lit ridge line, then the seam grain of old sheet metal */}
      <path d={TRAFO_ROOF} transform="translate(1,3)" fill={SHADE} opacity={0.25} />
      <path d={TRAFO_ROOF} fill={rust.hi} />
      <path d={TRAFO_ROOF} transform="translate(0,1)" fill={rust.base} />
      <path d={TRAFO_ROOF} transform="translate(0,1)" fill={dth("n", "12")} opacity={0.18} />
      {/* the door is set INTO the kiosk: the shade layer is painted full-size
          and the leaf one pixel in — the reveal owns the top and left edges
          without a single new constant */}
      <path d={TRAFO_DOOR} fill={SHADE} opacity={0.6} />
      <path d={TRAFO_DOOR} transform="translate(1,1)" fill={CORR[ph].base} />
      <path d={TRAFO_DOOR} transform="translate(1,1)" fill="#000" opacity={0.12} />
      {/* each corrugation gets a lit left lip beside its dark groove */}
      <path d={TRAFO_DOOR_RIBS} transform="translate(0,1)" fill={CORR[ph].hi} opacity={0.25} />
      <path d={TRAFO_DOOR_RIBS} transform="translate(1,1)" fill={CORR[ph].deep} opacity={0.6} />
      {/* oxidation creeping up the sheet, and a fine grain over the leaf */}
      <path d={TRAFO_DOOR} transform="translate(1,1)" fill={rust.base} opacity={0.1} />
      <path d={TRAFO_DOOR} transform="translate(1,1)" fill={dth("n", "12")} opacity={0.15} />
      {/* a louvred vent above the plate — the transformer has to breathe.
          Anchored to the sign's x-range so it stays on the kiosk face;
          nudge the -12 if the sign sits close under the eaves. */}
      <path
        d={pxPath([[TRAFO_SIGN[0] + 1, TRAFO_SIGN[1] - 12, TRAFO_SIGN[2] - 2, 8]])}
        fill={SHADE}
        opacity={0.5}
      />
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 2, TRAFO_SIGN[1] - 11, TRAFO_SIGN[2] - 4, 1],
          [TRAFO_SIGN[0] + 2, TRAFO_SIGN[1] - 8, TRAFO_SIGN[2] - 4, 1],
          [TRAFO_SIGN[0] + 2, TRAFO_SIGN[1] - 5, TRAFO_SIGN[2] - 4, 1],
        ])}
        fill={steel.base}
        opacity={0.8}
      />
      {/* the warning plate: cream, red-rimmed, screwed at the corners,
          the bolt glyph over it and one line of NIE DOTYKAC ink below */}
      <path d={pxPath([TRAFO_SIGN])} fill={K.cream} opacity={0.9} />
      <path
        d={pxPath([
          [TRAFO_SIGN[0], TRAFO_SIGN[1], TRAFO_SIGN[2], 1],
          [TRAFO_SIGN[0], TRAFO_SIGN[1] + TRAFO_SIGN[3] - 1, TRAFO_SIGN[2], 1],
          [TRAFO_SIGN[0], TRAFO_SIGN[1] + 1, 1, TRAFO_SIGN[3] - 2],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] - 1, TRAFO_SIGN[1] + 1, 1, TRAFO_SIGN[3] - 2],
        ])}
        fill={K.ledRed}
        opacity={0.6}
      />
      <path
        d={pxPath([[TRAFO_SIGN[0] + 2, TRAFO_SIGN[1] + TRAFO_SIGN[3] - 4, TRAFO_SIGN[2] - 4, 2]])}
        fill={K.posterInk}
        opacity={0.65}
      />
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 1, TRAFO_SIGN[1] + 1, 1, 1],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] - 2, TRAFO_SIGN[1] + 1, 1, 1],
          [TRAFO_SIGN[0] + 1, TRAFO_SIGN[1] + TRAFO_SIGN[3] - 2, 1, 1],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] - 2, TRAFO_SIGN[1] + TRAFO_SIGN[3] - 2, 1, 1],
        ])}
        fill={steel.hi}
        opacity={0.8}
      />
      <path
        d={pxPath([[TRAFO_SIGN[0] + 1, TRAFO_SIGN[1] + TRAFO_SIGN[3], TRAFO_SIGN[2], 1]])}
        fill={SHADE}
        opacity={0.35}
      />
      {/* rust bleeds off the plate's screws, and the stencilled unit number
          sits below, half-eaten by the weather */}
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 1, TRAFO_SIGN[1] + TRAFO_SIGN[3] + 1, 1, 6],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] - 2, TRAFO_SIGN[1] + TRAFO_SIGN[3] + 1, 1, 4],
        ])}
        fill={rust.base}
        opacity={0.5}
      />
      <BigText
        x={TRAFO_SIGN[0] + 1}
        y={TRAFO_SIGN[1] + TRAFO_SIGN[3] + 9}
        text="ST-4"
        k={1}
        fill={K.cream}
        op={0.3}
      />
      {/* the LED breathes a one-pixel halo after dark */}
      {dark ? (
        <>
          <path d={TRAFO_BOLT} transform="translate(1,0)" fill={K.ledRed} opacity={0.15} />
          <path d={TRAFO_BOLT} transform="translate(-1,0)" fill={K.ledRed} opacity={0.15} />
          <path d={TRAFO_BOLT} transform="translate(0,1)" fill={K.ledRed} opacity={0.15} />
          <path d={TRAFO_BOLT} transform="translate(0,-1)" fill={K.ledRed} opacity={0.15} />
        </>
      ) : null}
      <path d={TRAFO_BOLT} fill={K.ledRed} opacity={0.85} />
      {/* the conduit stands off the wall: shadow behind, light along its top */}
      <path d={TRAFO_CONDUIT} transform="translate(1,2)" fill={SHADE} opacity={0.2} />
      <path d={TRAFO_CONDUIT} fill={steel.base} />
      <path d={TRAFO_CONDUIT} transform="translate(0,1)" fill={steel.lo} />
      {/* a stepped hairline crack wanders from the eaves down past the plate */}
      <path
        d={pxPath([
          [TRAFO_SIGN[0] - 3, TRAFO_SIGN[1] - 11, 1, 6],
          [TRAFO_SIGN[0] - 4, TRAFO_SIGN[1] - 5, 1, 7],
          [TRAFO_SIGN[0] - 3, TRAFO_SIGN[1] + 2, 1, 9],
          [TRAFO_SIGN[0] - 2, TRAFO_SIGN[1] + 11, 1, 6],
        ])}
        fill={brick.deep}
        opacity={0.55}
      />
      {/* rising damp at the plinth, its contact shadow, and what grows there */}
      <path
        d={pxPath([[TRAFO_SIGN[0] - 6, FLOOR - 13, TRAFO_SIGN[2] + 12, 13]])}
        fill={dth("n", "25")}
        opacity={0.4}
      />
      <path
        d={pxPath([[TRAFO_SIGN[0] - 6, FLOOR - 3, TRAFO_SIGN[2] + 12, 3]])}
        fill={SHADE}
        opacity={0.2}
      />
      <path
        d={pxPath([
          [TRAFO_SIGN[0] - 4, FLOOR - 4, 3, 4],
          [TRAFO_SIGN[0] - 2, FLOOR - 6, 1, 2],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] + 1, FLOOR - 3, 2, 3],
          [TRAFO_SIGN[0] + TRAFO_SIGN[2] + 4, FLOOR - 5, 1, 5],
        ])}
        fill={K.weeds}
        opacity={0.6}
      />
      {/* someone's tag, small and fast, at exactly spray-can height */}
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 2, FLOOR - 26, 6, 2],
          [TRAFO_SIGN[0] + 3, FLOOR - 24, 2, 5],
          [TRAFO_SIGN[0] + 9, FLOOR - 25, 2, 6],
          [TRAFO_SIGN[0] + 12, FLOOR - 23, 4, 2],
        ])}
        fill={K.posterPink}
        opacity={0.55}
      />
      {/* the milk crate somebody sits on to smoke, and the bottle they left:
          the crate gets a lit top edge, two dark slots, a contact shadow */}
      <path d={pxPath([[TRAFO_SIGN[0] + 3, FLOOR - 1, 14, 1]])} fill={SHADE} opacity={0.3} />
      <path d={pxPath([[TRAFO_SIGN[0] + 4, FLOOR - 9, 11, 9]])} fill="#2a5f9e" />
      <path d={pxPath([[TRAFO_SIGN[0] + 4, FLOOR - 9, 11, 1]])} fill="#4d84c4" />
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 6, FLOOR - 7, 2, 4],
          [TRAFO_SIGN[0] + 10, FLOOR - 7, 2, 4],
        ])}
        fill="#14324f"
        opacity={0.9}
      />
      <path
        d={pxPath([
          [TRAFO_SIGN[0] + 19, FLOOR - 5, 2, 5],
          [TRAFO_SIGN[0] + 19, FLOOR - 7, 1, 2],
        ])}
        fill="#2e5d3a"
      />
      <path d={pxPath([[TRAFO_SIGN[0] + 19, FLOOR - 5, 1, 2]])} fill="#6fae7c" opacity={0.6} />

      {/* ---- hall A -------------------------------------------------------- */}
      <Bev set={HA_BODY} mat={brick} />
      <path d={pxPath([[HA.x0, 0, haW, FLOOR]])} fill="url(#px-stucco)" />
      {/* a second, coarser grain over the stucco so big fields never go flat */}
      <path d={pxPath([[HA.x0, 0, haW, FLOOR]])} fill={dth("n", "25")} opacity={0.06} />
      <path d={HA_COURSES} fill={brick.deep} opacity={0.3} />
      {/* the tonal life of the wall: sky lifts the top, the street stains
          the bottom — three quiet bands and the facade suddenly has height */}
      <path
        d={pxPath([[HA.x0, 0, haW, Math.round(FLOOR * 0.3)]])}
        fill={SKY}
        opacity={dark ? 0.03 : 0.06}
      />
      <path
        d={pxPath([[HA.x0, Math.round(FLOOR * 0.72), haW, Math.round(FLOOR * 0.28)]])}
        fill={SHADE}
        opacity={0.07}
      />
      <path d={pxPath([[HA.x0, FLOOR - 9, haW, 9]])} fill={SHADE} opacity={0.1} />
      <path d={pxPath([[HA.x0, FLOOR - 3, haW, 3]])} fill={SHADE} opacity={0.2} />
      {/* parapet: one lit coping stone, one line of shadow it throws */}
      <path d={pxPath([[HA.x0, 0, haW, 2]])} fill={brick.hi} opacity={0.5} />
      <path d={pxPath([[HA.x0, 2, haW, 2]])} fill={brick.deep} opacity={0.4} />
      <path d={pxPath([[HA.x0, 4, haW, 8]])} fill={SHADE} opacity={0.1} />
      {/* the sun comes over the left shoulder: lit arris left, dark right */}
      <path d={pxPath([[HA.x0, 0, 2, FLOOR]])} fill={brick.hi} opacity={0.35} />
      <path d={pxPath([[HA.x1 - 6, 0, 6, FLOOR]])} fill={SHADE} opacity={0.14} />
      <path d={pxPath([[HA.x1 - 2, 0, 2, FLOOR]])} fill={SHADE} opacity={0.25} />
      <path d={HA_PIERS} fill={brick.mid} />
      {/* the piers stand proud of the wall — a half-tone forward */}
      <path d={HA_PIERS} fill={brick.hi} opacity={0.1} />
      <path d={HA_PIER_EDGE} fill={brick.deep} opacity={0.6} />
      <path d={HA_BAND} fill={brick.deep} opacity={0.5} />
      {/* the ghost of STOCZNIA GDANSKA in whitewash on the lintel band */}
      <BigText
        x={HA.x0 + 96}
        y={8}
        text="WYDZIAL ELEKTRYCZNY W-4"
        k={2}
        fill={K.cream}
        op={dark ? 0.13 : 0.22}
      />
      {/* the bricked-in first bay, and the mural on it */}
      <path d={BAY1_INFILL} fill={brick.lo} />
      <path d={BAY1_JOINTS} fill={brick.deep} opacity={0.3} />
      <path d={BAY1_ARCH} fill={brick.mid} />
      <path d={MURAL_FIELD} fill={K.mural1} opacity={dark ? 0.5 : 0.75} />
      {/* the paint has chalked — a dither pass eats the pigment unevenly */}
      <path d={MURAL_FIELD} fill={dth("n", "12")} opacity={0.14} />
      <path d={MURAL_HULL} fill={K.mural2} opacity={dark ? 0.6 : 0.9} />
      {!dark ? <path d={MURAL_HULL} fill={K.white} opacity={0.07} /> : null}
      <path d={MURAL_SUPER} fill={K.mural3} opacity={dark ? 0.45 : 0.7} />
      <path d={MURAL_PORTHOLES} fill={K.posterInk} opacity={0.7} />
      <path d={MURAL_HOOK} fill={K.posterInk} opacity={0.8} />
      <path d={MURAL_TUG} fill={K.posterInk} opacity={0.85} />
      <path d={MURAL_WAVES} fill={K.mural3} opacity={dark ? 0.35 : 0.55} />
      <path d={MURAL_GULLS} fill={K.mural3} opacity={dark ? 0.35 : 0.6} />
      <path d={MURAL_WEAR} fill={brick.base} opacity={0.55} />
      {/* the windows */}
      <path d={HA_WIN_GLASS} fill={studioLit ? "#173a40" : K.glassDark} />
      {studioLit ? (
        <>
          <path d={HA_WIN_GLASS} fill={K.cyanDeep} opacity={0.45} />
          <path
            d={pxPath(HA_WIN.map(([x, y, w]) => [x + 8, y + 10, w - 30, 18] as Rect))}
            fill={K.cyan}
            opacity={0.3}
          />
        </>
      ) : (
        <>
          <path
            d={pxPath(HA_WIN.map(([x, y, w]) => [x + 6, y + 4, w - 40, 12] as Rect))}
            fill="#5a6a78"
            opacity={0.3}
          />
          {/* a colder second reflection low in the glass — the street's light */}
          <path
            d={pxPath(HA_WIN.map(([x, y, w, h]) => [x + 4, y + h - 10, w - 14, 3] as Rect))}
            fill="#5a6a78"
            opacity={0.18}
          />
        </>
      )}
      {/* decades of grime settle at the top of every pane */}
      <path
        d={pxPath(HA_WIN.map(([x, y, w]) => [x + 2, y + 2, w - 4, 5] as Rect))}
        fill="#000"
        opacity={0.28}
      />
      <path d={HA_WIN_LATTICE} fill={steel.deep} />
      <path d={HA_WIN_ARCH} fill={brick.mid} />
      <path d={HA_WIN_BOARD} fill={WOOD[ph].base} />
      <path d={HA_WIN_BROKEN} fill={night ? "#0d1014" : "#2a3038"} />
      {/* the reveal: a wall half a metre thick owns the top and left of every
          opening — two dark lines that buy the whole facade its depth */}
      <path
        d={pxPath(
          HA_WIN.flatMap(
            ([x, y, w, h]) =>
              [
                [x, y, w, 2],
                [x, y, 2, h],
              ] as Rect[],
          ),
        )}
        fill={SHADE}
        opacity={0.45}
      />
      {/* and the sun catches the opposite jamb — the reveal has two sides */}
      <path
        d={pxPath(HA_WIN.map(([x, y, w, h]) => [x + w - 1, y + 2, 1, h - 2] as Rect))}
        fill={brick.hi}
        opacity={0.3}
      />
      <path d={HA_SILLS} fill={brick.hi} />
      {/* and the sill throws its own shadow down the brick */}
      <path
        d={pxPath(HA_WIN.map(([x, y, w]) => [x - 3, y + 70, w + 6, 2] as Rect))}
        fill={SHADE}
        opacity={0.3}
      />
      {/* rain runs off the sill ends and writes two thin streaks each */}
      <path
        d={pxPath(
          HA_WIN.flatMap(
            ([x, y, w]) =>
              [
                [x + 4, y + 73, 1, 13],
                [x + w - 8, y + 73, 1, 9],
              ] as Rect[],
          ),
        )}
        fill={SHADE}
        opacity={0.22}
      />
      {/* lit studios spill onto the brick below the openings */}
      {studioLit ? (
        <path
          d={pxPath(HA_WIN.map(([x, y, w]) => [x - 3, y + 72, w + 6, 11] as Rect))}
          fill={K.cyan}
          opacity={0.07}
        />
      ) : null}
      {/* spalled brick where the frost got in around some of the openings —
          a dark pocket and the one lit lip under it */}
      <path
        d={pxPath(
          HA_WIN.flatMap(([x, y, w, h], i) =>
            i % 2 === 0
              ? ([
                  [x - 10, y + 16, 6, 4],
                  [x + w + 4, y + h - 20, 8, 5],
                ] as Rect[])
              : ([[x + w + 6, y + 6, 5, 4]] as Rect[]),
          ),
        )}
        fill={brick.deep}
        opacity={0.55}
      />
      <path
        d={pxPath(
          HA_WIN.flatMap(([x, y, w, h], i) =>
            i % 2 === 0
              ? ([
                  [x - 10, y + 20, 6, 1],
                  [x + w + 4, y + h - 15, 8, 1],
                ] as Rect[])
              : ([[x + w + 6, y + 10, 5, 1]] as Rect[]),
          ),
        )}
        fill={brick.hi}
        opacity={0.4}
      />
      {/* rainwater goods and the damp they made */}
      <path d={HA_DAMP} fill={dth("n", "25")} opacity={0.5} />
      <path d={HA_PIPES} fill={rust.mid} />
      {/* the pipe stands off the wall on brackets — its shadow says so */}
      <path d={HA_PIPES} fill={SHADE} opacity={0.12} transform="translate(2,0)" />
      {/* the poster drift */}
      <path d={POSTERS_OLD} fill={K.posterOld} opacity={0.85} />
      <path d={POSTERS_MID} fill={K.poster} opacity={0.9} />
      <path d={pxPath(POSTERS_NEW)} fill={K.white} />
      {/* the newest sheets still curl — tape at the top, lift at the foot */}
      <path
        d={pxPath(
          POSTERS_NEW.flatMap(
            ([x, y, w]) =>
              [
                [x + Math.round(w / 2) - 2, y - 1, 4, 2],
                [x + 1, y - 1, 3, 2],
              ] as Rect[],
          ),
        )}
        fill={K.white}
        opacity={0.55}
      />
      <path
        d={pxPath(POSTERS_NEW.map(([x, y, w, h]) => [x, y + h - 2, w, 2] as Rect))}
        fill={SHADE}
        opacity={0.18}
      />
      <path d={POSTERS_ART} fill={K.posterPink} opacity={0.85} />
      <path
        d={pxPath([
          [POSTERS_NEW[0][0] + 4, POSTERS_NEW[0][1] + 30, 24, 2],
          [POSTERS_NEW[1][0] + 4, POSTERS_NEW[1][1] + 30, 20, 2],
        ])}
        fill={K.posterInk}
        opacity={0.8}
      />
      <path d={POSTERS_TORN} fill={brick.base} />
      <path d={HA_PLINTH} fill={dth("n", "12")} opacity={0.5} />
      <path d={HA_MOSS} fill={K.weeds} opacity={0.4} />

      {/* ---- the gap: spur wall, the gate in it, razor wire, pipe bridge ---- */}
      <path d={GAP_SPUR} fill={brick.lo} />
      <path d={GAP_SPUR_TOP} fill={brick.hi} />
      <path d={GAP_SPUR_COURSES} fill={brick.deep} opacity={0.3} />
      <path d={GAP_RAZOR} fill={steel.base} opacity={0.7} />
      <Bev set={GATE_SET} mat={CORR[ph]} />
      <path d={GATE_RIBS} fill={CORR[ph].deep} opacity={0.55} />
      <path d={GATE_SPLIT} fill="#000" opacity={0.4} />
      <path d={GATE_CHAIN} fill={steel.base} />
      <path d={pxPath([GATE_SIGN])} fill={K.cream} opacity={0.85} />
      <BigText
        x={GATE_SIGN[0] + 4}
        y={GATE_SIGN[1] + 3}
        text="TEREN STOCZNI"
        k={1}
        fill={K.posterInk}
        op={0.8}
      />
      {/* the sign is screwed to the sheet — shadow under, rust bleeding off it */}
      <path
        d={pxPath([[GATE_SIGN[0] + 1, GATE_SIGN[1] + GATE_SIGN[3], GATE_SIGN[2], 2]])}
        fill="#000"
        opacity={0.3}
      />
      <path
        d={pxPath([
          [GATE_SIGN[0] + 2, GATE_SIGN[1] + GATE_SIGN[3] + 2, 1, 9],
          [GATE_SIGN[0] + GATE_SIGN[2] - 3, GATE_SIGN[1] + GATE_SIGN[3] + 2, 1, 6],
        ])}
        fill={rust.base}
        opacity={0.55}
      />
      {/* the street shadow crosses the gap too */}
      <path d={pxPath([[HA.x1, FLOOR - 4, HB.x0 - HA.x1, 4]])} fill={SHADE} opacity={0.16} />
      <path d={SMOKE_RAIL} fill={steel.mid} />
      <path d={SMOKE_BUCKET} fill={M.enamel.base} />
      <path d={BRIDGE_TRUSS} fill={rust.lo} />
      <path d={BRIDGE_PIPES} fill={rust.base} />
      <path d={BRIDGE_LAGGING} fill={M.linen.lo} opacity={0.8} />
      {/* the pipes are round: one dark line along their bellies */}
      <path d={BRIDGE_PIPES} fill={SHADE} opacity={0.2} transform="translate(0,2)" />

      {/* ---- hall B and the club face -------------------------------------- */}
      <Bev set={HB_BODY} mat={brickB} />
      <path d={pxPath([[HB.x0, 0, hbW, FLOOR]])} fill="url(#px-roller)" />
      <path d={pxPath([[HB.x0, 0, hbW, FLOOR]])} fill={dth("n", "25")} opacity={0.05} />
      <path d={HB_COURSES} fill={brickB.deep} opacity={0.25} />
      {/* the same tonal architecture as hall A — sky above, street below */}
      <path
        d={pxPath([[HB.x0, 0, hbW, Math.round(FLOOR * 0.3)]])}
        fill={SKY}
        opacity={dark ? 0.03 : 0.05}
      />
      <path
        d={pxPath([[HB.x0, Math.round(FLOOR * 0.72), hbW, Math.round(FLOOR * 0.28)]])}
        fill={SHADE}
        opacity={0.07}
      />
      <path d={pxPath([[HB.x0, FLOOR - 9, hbW, 9]])} fill={SHADE} opacity={0.1} />
      <path d={pxPath([[HB.x0, FLOOR - 3, hbW, 3]])} fill={SHADE} opacity={0.2} />
      <path d={pxPath([[HB.x0, 0, hbW, 2]])} fill={brickB.hi} opacity={0.5} />
      <path d={pxPath([[HB.x0, 2, hbW, 2]])} fill={brickB.deep} opacity={0.4} />
      <path d={pxPath([[HB.x0, 4, hbW, 8]])} fill={SHADE} opacity={0.1} />
      {/* hall B's left face looks into the gap — it lives in borrowed shadow */}
      <path d={pxPath([[HB.x0, 0, 5, FLOOR]])} fill={SHADE} opacity={0.2} />
      <path d={pxPath([[HB.x1 - 2, 0, 2, FLOOR]])} fill={SHADE} opacity={0.18} />
      <path d={HB_PIERS} fill={brickB.mid} />
      <path d={HB_PIERS} fill={brickB.hi} opacity={0.1} />
      <path d={HB_GHOSTS} fill={brickB.lo} />
      <path d={HB_GHOST_ARCH} fill={brickB.mid} />
      <path d={HB_GHOST_INFILL} fill={brickB.deep} opacity={0.4} />
      {/* the infill was laid in a hurry, in a different mortar */}
      <path d={HB_GHOST_INFILL} fill={dth("n", "12")} opacity={0.2} />
      {/* the door */}
      <path d={DOOR_HEAD} fill={brickB.deep} />
      <Bev set={DOOR_SET} mat={M.graphite} />
      <path d={DOOR_SPLIT} fill="#000" opacity={0.5} />
      {/* steel kickplate along the foot of both leaves, with its lit top edge */}
      <path
        d={pxPath([[DOOR[0] + 2, DOOR[1] + DOOR[3] - 8, DOOR[2] - 4, 6]])}
        fill={steel.mid}
        opacity={0.6}
      />
      <path
        d={pxPath([[DOOR[0] + 2, DOOR[1] + DOOR[3] - 8, DOOR[2] - 4, 1]])}
        fill={steel.hi}
        opacity={0.5}
      />
      {/* hinges on the outer stiles */}
      <path
        d={pxPath([
          [DOOR[0] + 1, DOOR[1] + 6, 2, 3],
          [DOOR[0] + 1, DOOR[1] + DOOR[3] - 14, 2, 3],
          [DOOR[0] + DOOR[2] - 3, DOOR[1] + 6, 2, 3],
          [DOOR[0] + DOOR[2] - 3, DOOR[1] + DOOR[3] - 14, 2, 3],
        ])}
        fill={steel.base}
        opacity={0.7}
      />
      <path d={DOOR_PUSHBAR} fill={STEEL[ph].base} />
      {/* a thousand hands have found the same spot by the bar */}
      <path
        d={pxPath([
          [DOOR[0] + Math.round(DOOR[2] * 0.55), DOOR[1] + Math.round(DOOR[3] * 0.42), 7, 11],
        ])}
        fill={M.graphite.hi}
        opacity={0.22}
      />
      <path d={DOOR_PORTHOLES} fill={clubOn(s) ? "#3a1030" : "#15171b"} />
      {clubOn(s) ? <path d={DOOR_PORTHOLES} fill="#d95fb8" opacity={0.25} /> : null}
      {/* the door sits IN the wall: reveal shadow top and left of the leaf */}
      <path
        d={pxPath([
          [DOOR[0] - 2, DOOR[1] - 2, DOOR[2] + 4, 2],
          [DOOR[0] - 2, DOOR[1] - 2, 2, DOOR[3] + 2],
        ])}
        fill={SHADE}
        opacity={0.5}
      />
      {/* and the lit jamb on the right closes the box */}
      <path
        d={pxPath([[DOOR[0] + DOOR[2] + 1, DOOR[1], 1, DOOR[3]]])}
        fill={brickB.hi}
        opacity={0.35}
      />
      {/* when the club is on, its light leaks under the leaves */}
      {clubOn(s) ? (
        <path
          d={pxPath([[DOOR[0] + 3, DOOR[1] + DOOR[3] - 1, DOOR[2] - 6, 1]])}
          fill="#d95fb8"
          opacity={0.8}
        />
      ) : null}
      <path d={DOOR_STEP} fill={M.enamel.base} opacity={0.6} />
      {/* the threshold's top face — one lit line, and the step has thickness */}
      <path
        d={pxPath([[DOOR[0] - 2, FLOOR - 4, DOOR[2] + 4, 1]])}
        fill={M.enamel.hi}
        opacity={0.7}
      />
      {/* what queues leave behind: scuffs and trodden gum at the threshold */}
      <path
        d={pxPath([
          [DOOR[0] - 5, FLOOR - 3, 2, 1],
          [DOOR[0] + 6, FLOOR - 2, 3, 1],
          [DOOR[0] + DOOR[2] - 4, FLOOR - 3, 2, 1],
        ])}
        fill={SHADE}
        opacity={0.5}
      />
      <path d={DOOR_LAMP} fill={M.graphite.base} />
      <path d={DOOR_CCTV} fill={M.graphite.mid} />
      {/* the lamp's throw lives in Effects — but a breath of it stays on the
          brick here so the housing never floats loose of the wall */}
      {dark ? (
        <path
          d={pxPath([[DOOR[0] - 8, DOOR[1] - 14, DOOR[2] + 16, 12]])}
          fill="#ffd9a0"
          opacity={0.06}
        />
      ) : null}
      {/* the neon frame; the tubes are painted in Effects so they can flicker */}
      <path d={NEON_FRAME} fill="#17191d" />
      {/* the frame box hangs off the wall — its shadow drops behind it */}
      <path d={NEON_FRAME} fill={SHADE} opacity={0.25} transform="translate(2,2)" />
      <path d={NEON_FRAME} fill="#17191d" />
      <path d={NEON_MOUNT} fill={M.graphite.lo} />
      {!dark ? (
        /* by day the neon is grey glass — you can read it but it is asleep */
        <BigText x={NEON_TEXT_X} y={NEON_TEXT_Y} text="TURBINA" k={3} fill="#4e5860" op={0.9} />
      ) : null}
      {/* the rules board */}
      <path
        d={pxPath([[RULES_BOARD[0] + 1, RULES_BOARD[1] + RULES_BOARD[3], RULES_BOARD[2], 2]])}
        fill={SHADE}
        opacity={0.3}
      />
      <path d={pxPath([RULES_BOARD])} fill={K.cream} opacity={0.9} />
      <path
        d={pxPath([
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 4, 20, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 9, 16, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 14, 18, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 19, 12, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 26, 20, 3],
        ])}
        fill={K.posterInk}
        opacity={0.7}
      />
      {/* four screws hold the rules to the wall */}
      <path
        d={pxPath([
          [RULES_BOARD[0] + 1, RULES_BOARD[1] + 1, 1, 1],
          [RULES_BOARD[0] + RULES_BOARD[2] - 2, RULES_BOARD[1] + 1, 1, 1],
          [RULES_BOARD[0] + 1, RULES_BOARD[1] + RULES_BOARD[3] - 2, 1, 1],
          [RULES_BOARD[0] + RULES_BOARD[2] - 2, RULES_BOARD[1] + RULES_BOARD[3] - 2, 1, 1],
        ])}
        fill={steel.deep}
        opacity={0.8}
      />
      {/* the dock fence past everything */}
      <path d={DOCK_FENCE} fill={steel.lo} />

      {/* bulkhead lamp housings (their light lives in Effects) */}
      <path d={BULKHEADS} fill={M.graphite.base} />
      {/* each housing hangs a pixel of shadow under itself */}
      <path d={BULKHEADS} fill={SHADE} opacity={0.3} transform="translate(1,2)" />
      <path d={BULKHEADS} fill={M.graphite.base} />

      <AOSet set={HALL_AO} op={0.35} />
      {/* a second, tighter AO pass — same set, lower alpha, reads as depth
          rather than dirt because it doubles only where shadow already lives */}
      <AOSet set={HALL_AO} op={0.12} />
    </g>
  );
}

/* ================================================================== *
 * STATIC plane component
 * ================================================================== */

function Furniture({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const steel = STEEL[ph];
  const dark = isDark(ph);
  const barOpen = s.bar === "open";
  const frytOpen = s.frytki === "open";
  return (
    <g>
      <Contact set={CONTACTS} op={0.45} />

      {/* ---- the container bar --------------------------------------------- */}
      <Bev set={CONT_SET} mat={CORR[ph]} />
      <path d={CONT_ROOF} fill={CORR[ph].hi} />
      <path d={CONT_ROOF_LIP} fill={CORR[ph].deep} />
      <path d={CONT_ROOF_KIT} fill={CORR[ph].lo} />
      <path d={CONT_CASTINGS} fill={CORR[ph].deep} />
      <path d={CONT_CORR} fill={CORR[ph].deep} opacity={0.45} />
      <path d={CONT_CORNERS} fill={CORR[ph].lo} />
      {/* rust streaks off the roof seams — it has wintered here */}
      <path
        d={pxPath([
          [CONT[0] + 34, CONT[1] + 4, 3, 26],
          [CONT[0] + 190, CONT[1] + 4, 3, 34],
        ])}
        fill={K.rustDeep}
        opacity={0.5}
      />
      <BigText
        x={Z.bar + 82}
        y={BAR_SIGN_Y}
        text="BAR PRAD"
        k={2}
        fill={dark ? K.bulbHi : K.cream}
        op={dark ? 0.95 : 0.8}
      />
      {barOpen ? (
        <>
          <path d={HATCH_DARK} fill="#241d14" />
          <path d={HATCH_SHELVES} fill={M.wood.mid} />
          <path
            d={HATCH_BOTTLES}
            fill={dark ? K.ledAmber : "#8a7448"}
            opacity={dark ? 0.85 : 0.7}
          />
          <path d={HATCH_FLAP} fill={CORR[ph].hi} />
          <path d={HATCH_COUNTER} fill={M.wood.base} />
          <path d={HATCH_TAPS} fill={steel.hi} />
          <path d={HATCH_CUPS} fill={K.white} opacity={0.85} />
        </>
      ) : (
        <>
          <path d={HATCH_SHUT} fill={CORR[ph].lo} />
          <path d={HATCH_SHUT_RIBS} fill={CORR[ph].deep} opacity={0.6} />
          <path d={pxPath([[Z.bar + 124, HATCH[1] + HATCH[3] - 6, 8, 8]])} fill={steel.deep} />
        </>
      )}
      <path d={pxPath([BAR_MENU])} fill={K.menuBoard} />
      <path d={BAR_MENU_LINES} fill={K.chalk} opacity={barOpen ? 0.75 : 0.3} />

      {/* ---- the band props' ground truth ------------------------------------ *
       * The furniture itself is depth-sorted actors; what the ART owns is the
       * proof they stand on the ground — contact darkening under every foot,
       * and one shared sun direction when there is a sun to cast it. */}
      <Contact set={PROP_CONTACTS} op={0.45} />
      <g
        opacity={ph === "day" ? 0.2 : ph === "dawn" ? 0.14 : ph === "dusk" ? 0.07 : 0}
        style={{ transition: STEP_FADE }}
      >
        <path d={PROP_SUN_SHADOWS} fill="#171009" />
        <path d={STATIC_SUN_SHADOWS} fill="#171009" />
      </g>
      <path d={PALLETS} fill={WOOD[ph].base} />
      <path d={pxPath([[Z.smoke - 76, FLOOR - 20, 44, 1]])} fill={WOOD[ph].hi} />

      {/* ---- the frytki trailer ---------------------------------------------- */}
      <Bev set={TRAIL_SET} mat={TRAILER[ph]} />
      <path d={TRAIL_ROOF} fill={TRAILER[ph].hi} />
      <path d={TRAIL_ROOF_LIP} fill={TRAILER[ph].deep} opacity={0.7} />
      <path d={TRAIL_WHEEL} fill="#2a2d33" />
      {/* wheel hubs read as wheels only with a lit rim arc */}
      <path
        d={pxPath([
          [Z.frytki + 16, FLOOR - 8, 4, 1],
          [Z.frytki + 96, FLOOR - 8, 4, 1],
        ])}
        fill={steel.hi}
        opacity={0.7}
      />
      <path d={TRAIL_HITCH} fill={steel.mid} />
      <path d={TRAIL_JACK} fill={steel.mid} />
      {/* the fryer's flue on the roof — the steam in Effects rises off it */}
      <path d={pxPath([[TRAIL[0] + 97, TRAIL[1] - 6, 5, 6]])} fill={steel.lo} />
      {frytOpen ? (
        <>
          <path d={pxPath([TRAIL_HATCH])} fill="#2b2118" />
          <path d={TRAIL_FRYER} fill={steel.base} />
          <path d={TRAIL_BOTTLES} fill={K.ketchup} />
          <path d={pxPath([[TRAIL_HATCH[0] + 20, TRAIL_HATCH[1] + 24, 5, 9]])} fill={K.frytki} />
          <path d={TRAIL_COUNTER} fill={M.laminate.base} />
        </>
      ) : (
        <>
          <path d={TRAIL_SHUT} fill={TRAILER[ph].lo} />
          <path d={TRAIL_SHUT_RIBS} fill={TRAILER[ph].deep} opacity={0.5} />
        </>
      )}
      <path d={TRAIL_AWNING} fill={K.ketchup} opacity={0.9} />
      <path
        d={pxPath(repeat(6, 16, [TRAIL_HATCH[0] + 2, TRAIL_HATCH[1] - 5, 8, 3] as Rect))}
        fill={K.white}
        opacity={0.85}
      />
      {/* the name, white on the awning band — where a trailer keeps its name */}
      <BigText
        x={TRAIL_SIGN_X}
        y={TRAIL_HATCH[1] - 11}
        text="FRYTKI"
        k={1}
        fill={K.white}
        op={0.95}
      />
      <path d={pxPath([TRAIL_MENU])} fill={K.menuBoard} />
      <path
        d={pxPath([
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 5, 10, 2],
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 11, 8, 2],
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 17, 10, 2],
        ])}
        fill={K.chalk}
        opacity={0.6}
      />
      <Bev set={GEN_SET} mat={M.enamel} />
      {/* the generator's top face — a box has a lid, not just a front */}
      <path d={pxPath([[GEN[0] - 1, GEN[1] - 3, GEN[2] + 2, 3]])} fill={M.enamel.hi} />
      <path d={pxPath([[GEN[0] - 1, GEN[1] - 1, GEN[2] + 2, 1]])} fill={M.enamel.lo} />
      <path d={GEN_VENTS} fill={M.enamel.deep} />
      <path d={GEN_LED} fill={frytOpen || s.bar === "open" ? K.ledGreen : K.ledRed} />

      {/* ---- the yard --------------------------------------------------------- */}
      <path d={CRANE_LEG} fill={steel.lo} />
      <path d={pxPath([[Z.crane - 14, 0, 3, FLOOR - 4]])} fill={steel.base} />
      <path d={CRANE_LEG_PLATE} fill={K.cream} opacity={0.8} />
      <BigText x={Z.crane - 5} y={99} text="K-1" k={1} fill={K.posterInk} op={0.8} />
      <Bev set={BOARD_SET} mat={M.graphite} />
      <path d={BOARD_LEGS} fill={steel.mid} />
      <path d={BOARD_PAPER} fill={K.white} opacity={0.95} />
      <path d={BOARD_ART} fill={K.neonDeep} opacity={0.85} />
      <BigText x={BOARD[0] + 12} y={BOARD[1] + 14} text="LATO NA" k={1} fill={K.white} op={0.9} />
      <BigText x={BOARD[0] + 12} y={BOARD[1] + 21} text="STOCZNI" k={1} fill={K.white} op={0.9} />
      <path d={BOARD_TEAR} fill={K.posterOld} />
      <Bicycle set={BOARD_BIKE_B} ph={ph} colour="#2b2b2b" />
      <Bicycle set={BOARD_BIKE_A} ph={ph} colour="#3f6f52" />

      {/* ---- the queue and the loos ------------------------------------------- */}
      <path d={BARRIERS} fill={steel.base} />
      <path
        d={pxPath(BARRIER_X.map((x) => [x + 2, 133, 33, 4] as Rect))}
        fill={K.hiVis}
        opacity={0.35}
      />
      <Bev set={LOOS} mat={M.teal} />
      <path d={LOO_ROOFS} fill={M.teal.deep} />
      <path d={LOO_DOORS} fill={M.teal.lo} />
      <path d={LOO_LOCKS} fill={s.queue >= 2 ? K.ledRed : K.ledGreen} />
      <path d={LOO_VENTS} fill={M.teal.deep} />

      {/* ---- festoon hardware (the light itself lives in Effects) ------------- */}
      <path d={FEST_POLES} fill={steel.mid} />
      <path d={FEST_WIRES} fill={K.cable} />
      {/* the breaker that owns the bulbs */}
      <path d={BREAKER_CONDUIT} fill={steel.lo} />
      <path d={pxPath([BREAKER])} fill={M.graphite.base} />
      <path d={pxPath([[BREAKER[0], BREAKER[1], BREAKER[2], 1]])} fill={M.graphite.hi} />
      <path d={BREAKER_LEVER} fill={K.ledRed} />
    </g>
  );
}

/* ================================================================== *
 * the scene component
 * ================================================================== */

function ElektrykowScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = elektrykowState(world, ph);
  return (
    <LayeredScene
      farBackground={<FarPlane ph={ph} />}
      middleBackground={<Halls ph={ph} s={s} />}
      ground={<Ground ph={ph} s={s} />}
      staticObjects={<Furniture ph={ph} s={s} />}
      parallax={{ farBackground: 0.88, middleBackground: 1 }}
    />
  );
}

/* ================================================================== *
 * EFFECTS — the people and the light
 * ================================================================== */

const PHILOSOPHER_LINES = [
  "Kiedyś tu spawali statki. Teraz spawamy się my.",
  "To nie jest upadek przemysłu. To jest zmiana zmiany.",
  "Trzymam ścianę. Ktoś musi.",
] as const;
const STARER_LINES = ["...", "Ta cegła. Patrz na tę cegłę.", "Wszystko się zgadza."] as const;
const QUEUE_LINES = [
  "Mówią, że selekcja dzisiaj ostra.",
  "Stoimy dwadzieścia minut. Bas czuć w barierkach.",
  "Jak nas nie wpuszczą, idziemy na frytki i też będzie dobrze.",
] as const;
const BARMAN_LINES = [
  "Grzaniec się kończy, mówię od razu.",
  "Kubek zwrotny. Kaucja pięć złotych. Taki świat.",
] as const;
const FRYTKARZ_LINES = [
  "Świeży olej od siedemnastej!",
  "Majonez czy ketchup? Nie ma 'i to i to'. Jest 'i to i to' za złotówkę.",
] as const;

/**
 * Steel remembers its lights: dashes on the rail heads under each festoon
 * span's low point, and magenta ones under the neon. The single cheapest way
 * to say "polished metal in a lit street" — the rails answer every source.
 */
const RAIL_GLINTS = pxPath(
  FEST_SPANS.flatMap(([x0, , x1]) => {
    const cx = Math.round((x0 + x1) / 2);
    return RAIL_Y.flatMap((y) =>
      Array.from({ length: 5 }, (_, i) => [cx - 22 + i * 10, y, 5, 1] as Rect),
    );
  }),
);
const RAIL_GLINTS_NEON = pxPath(
  RAIL_Y.flatMap((y) =>
    Array.from({ length: 5 }, (_, i) => [Z.door - 24 + i * 11, y, 5, 1] as Rect),
  ),
);
/** The deflated balloon somebody tied to the far barrier, still trying. */
const BALLOON_X = BARRIER_X[2] + 30;

function ElektrykowEffects({
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
  const s = elektrykowState(world, ph);
  const night = ph === "night";
  const dark = isDark(ph);
  const fest = festoonOn(s, ph);
  const club = clubOn(s);
  return (
    <>
      {/* the street's people, built from the NPC rig */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {/* the bouncer, planted by the door whenever the club is running */}
        {club || s.club === "prep" ? (
          <NpcActor npc={NPCS.bramkarz} objId="bramkarz" x={Z.door - 58} facing={1} />
        ) : null}
        {/* the queue: two of them at crowd, one at dusk */}
        {s.queue >= 1 ? (
          <NpcActor npc={NPCS.raverka} objId="queue-girl" x={Z.queue + 18} facing={1} />
        ) : null}
        {s.queue >= 2 ? <NpcActor npc={NPCS.caller} x={Z.queue + 62} facing={1} /> : null}
        {/* the barman in his hatch, cut off at the counter */}
        {s.bar === "open" ? (
          <NpcActor
            npc={NPCS.barmanka}
            objId="bar-prad"
            x={Z.bar + 128}
            facing={-1}
            shadow={false}
            cropBelow={HATCH[1] + HATCH[3]}
          />
        ) : null}
        {/* the frytkarz in his trailer */}
        {s.frytki === "open" ? (
          <NpcActor
            npc={NPCS.frytkarz}
            objId="frytki-stand"
            x={Z.frytki + 62}
            facing={-1}
            shadow={false}
            cropBelow={TRAIL_HATCH[1] + TRAIL_HATCH[3]}
          />
        ) : null}
        {/* the philosopher holding up hall A */}
        {s.crowd >= 1 ? (
          <NpcActor npc={NPCS.filozof} objId="filozof" x={Z.smoke - 40} facing={1} />
        ) : null}
        {/* the man communing with the brickwork. He is fine. Probably. */}
        {s.crowd >= 2 ? (
          <NpcActor npc={NPCS.starer} objId="starer" x={Z.mural + 58} facing={1} />
        ) : null}
      </svg>

      {/* what they say, unprompted */}
      {s.crowd >= 1 && !dialogueOpen ? (
        <Monologue
          x={Z.smoke - 40}
          headY={84}
          scale={scale}
          speaker="Filozof"
          lines={PHILOSOPHER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.crowd >= 2 ? (
        <Monologue
          x={Z.mural + 58}
          headY={84}
          scale={scale}
          speaker="Ten Gość"
          lines={STARER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.queue >= 1 ? (
        <Monologue
          x={Z.queue + 18}
          headY={84}
          scale={scale}
          speaker="Dziewczyna z kolejki"
          lines={QUEUE_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.bar === "open" ? (
        <Monologue
          x={Z.bar + 128}
          headY={HATCH[1] + 4}
          scale={scale}
          speaker="Barmanka"
          lines={BARMAN_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.frytki === "open" ? (
        <Monologue
          x={Z.frytki + 62}
          headY={TRAIL_HATCH[1] + 4}
          scale={scale}
          speaker="Frytkarz"
          lines={FRYTKARZ_LINES}
          muted={dialogueOpen}
        />
      ) : null}

      {/* the light */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* the hour's cast over everything */}
          <rect
            width={W}
            height={H}
            fill={
              ph === "night"
                ? NIGHT_CAST
                : ph === "dusk"
                  ? DUSK_CAST
                  : ph === "dawn"
                    ? DAWN_CAST
                    : "#000"
            }
            opacity={ph === "night" ? 0.22 : ph === "dusk" ? 0.1 : ph === "dawn" ? 0.08 : 0}
            style={{ transition: STEP_FADE }}
          />

          {/* festoon bulbs and their pools */}
          <g opacity={fest ? 1 : 0} style={{ transition: STEP_FADE }}>
            <path d={FEST_BULBS.halo} fill={dth("w", "12")} opacity={0.5} />
            <path d={FEST_BULBS.core} fill={K.bulbHi} opacity={0.95} />
            <Light set={FEST_POOLS} op={dark ? 1 : 0.25} />
            {/* the rails give the bulbs back */}
            {dark ? <path d={RAIL_GLINTS} fill={K.bulbHi} opacity={0.35} /> : null}
            {/* one tired bulb on the middle span, browning out now and then */}
            {FEST_BULB_PTS[8] ? (
              <path
                d={pxPath([[FEST_BULB_PTS[8][0] - 2, FEST_BULB_PTS[8][1] - 2, 6, 6]])}
                fill="#12142a"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0;0;0;0.7;0;0.7;0.7;0;0;0;0"
                  dur="13s"
                  repeatCount="indefinite"
                />
              </path>
            ) : null}
          </g>

          {/* the studio hall's cyan lattice on the street */}
          {dark ? <Light set={CYAN_POOL} /> : null}

          {/* bulkhead sodium lamps down the brick */}
          {dark ? (
            <>
              <Light set={BULKHEAD_CONES} />
              <path d={BULKHEAD_GLOW.halo} fill={dth("e", "12")} opacity={0.4} />
              <path d={BULKHEAD_GLOW.core} fill={K.sodium} opacity={0.9} />
            </>
          ) : null}

          {/* the hatches' warm counters */}
          {s.bar === "open" ? <Light set={HATCH_POOL} op={dark ? 1 : 0.25} /> : null}
          {s.frytki === "open" ? <Light set={TRAIL_POOL} op={dark ? 1 : 0.25} /> : null}
          {club || s.club === "prep" ? <Light set={DOOR_POOL} op={dark ? 1 : 0.2} /> : null}

          {/* the neon, lit: deep tube, bright core, the R dropping out */}
          {dark ? (
            <g>
              <BigText
                x={NEON_TEXT_X + 1}
                y={NEON_TEXT_Y + 1}
                text="TURBINA"
                k={3}
                fill={K.neonDeep}
                op={0.9}
              />
              <BigText x={NEON_TEXT_X} y={NEON_TEXT_Y} text="TURBINA" k={3} fill={K.neon} />
              {/* the sick letter: a patch over the R that flickers it off */}
              <g>
                <path
                  d={pxPath([[NEON_TEXT_X + 36, NEON_TEXT_Y - 2, 14, 18]])}
                  fill="#17191d"
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0;0;0;0.85;0;0;0.85;0;0"
                    dur="7.3s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
              <path d={NEON_POOL_WIDE} fill={K.neonDeep} opacity={0.1} />
              <path d={NEON_POOL_CORE} fill={K.neon} opacity={0.12} />
              {/* the rails run magenta where the sign owns them */}
              <path d={RAIL_GLINTS_NEON} fill={K.neon} opacity={0.3} />
              {/* the neon's wash up the brick around the frame */}
              <path d={pxPath([[Z.door - 78, 28, 156, 44]])} fill={K.neon} opacity={0.08} />
            </g>
          ) : null}

          {/* someone crosses the lit studio window — up there, working late */}
          {dark ? (
            <g>
              <path
                d={pxPath([
                  [HA_WIN[0][0] + 16, 50, 8, 22],
                  [HA_WIN[0][0] + 18, 46, 5, 5],
                ])}
                fill="#0d2226"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0;0;0.8;0.8;0.8;0;0;0;0;0"
                  dur="27s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;0 0;0 0;0 0;18 0;36 0;40 0;40 0;40 0;40 0;40 0"
                  dur="27s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}

          {/* the cat on the spur wall, night patrol, gone if you look twice */}
          {night ? (
            <g fill="#14110d">
              <path
                d={pxPath([
                  [Z.gap + 12, 76, 12, 5],
                  [Z.gap + 22, 73, 4, 4],
                  [Z.gap + 8, 74, 2, 5],
                ])}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0.9;0.9;0.9;0;0;0;0"
                  dur="44s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;0 0;40 0;84 0;90 0;90 0;90 0;0 0"
                  dur="44s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}

          {/* the balloon somebody tied to the far barrier — half-dead, still game */}
          <g>
            <path
              d={pxPath([
                [BALLOON_X, 132, 1, 8],
                [BALLOON_X - 2, 140, 5, 5],
                [BALLOON_X - 1, 145, 3, 2],
              ])}
              fill={K.posterPink}
              opacity={0.8}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={`-6 ${BALLOON_X} 132;7 ${BALLOON_X} 132;-6 ${BALLOON_X} 132`}
                dur="4.3s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
              />
            </path>
          </g>

          {/* the club leaking through the portholes: a slow strobe pulse */}
          {club ? (
            <g>
              <path d={DOOR_PORTHOLES} fill={K.neon} opacity={0.5}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.5;0.15;0.6;0.2;0.45;0.1"
                  dur="1.9s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={DOOR_PORTHOLES} fill={K.cyan} opacity={0}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0.4;0;0;0.3;0"
                  dur="2.7s"
                  repeatCount="indefinite"
                />
              </path>
              {/* the bass you can see: the door seam breathing light */}
              <path d={pxPath([[Z.door - 1, DOOR[1], 2, DOOR[3]]])} fill={K.neon} opacity={0.2}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.2;0.5;0.2;0.45;0.2"
                  dur="0.96s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}

          {/* steam off the fryer's flue on the trailer roof — two breaths,
              each dead for most of its cycle so they never stack into a slab */}
          {s.frytki === "open"
            ? [0, 4.5].map((d) => (
                <path
                  key={d}
                  d={pxPath([
                    [TRAIL[0] + 96, TRAIL[1] - 6, 7, 4],
                    [TRAIL[0] + 99, TRAIL[1] - 10, 5, 4],
                  ])}
                  fill={dth("c", "25")}
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.45;0.2;0;0;0"
                    begin={`${d}s`}
                    dur="9s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;2 -6;4 -12;5 -16;5 -16;5 -16"
                    begin={`${d}s`}
                    dur="9s"
                    repeatCount="indefinite"
                  />
                </path>
              ))
            : null}

          {/* cigarette embers at the smoking corner and by the dock fence */}
          {dark && s.crowd >= 1 ? (
            <>
              <path d={pxPath([[Z.smoke - 34, 106, 2, 2]])} fill={K.sodium}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.9;0.25;0.25;0.9"
                  dur="3.4s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={pxPath([[Z.smokeYard - 6, 104, 2, 2]])} fill={K.sodium}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.25;0.9;0.25;0.25"
                  dur="4.1s"
                  repeatCount="indefinite"
                />
              </path>
            </>
          ) : null}

          {/* the generator's breath, cold mornings */}
          {ph === "dawn" && (s.bar === "open" || s.frytki === "open") ? (
            <path d={pxPath([[GEN[0] + 30, GEN[1] - 6, 6, 4]])} fill={dth("c", "25")} opacity={0.4}>
              <animate
                attributeName="opacity"
                values="0.4;0.1;0.35;0.15"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}

          {/* --- transients: what the player is doing, never in artKey ------- */}
          {actionUi === "smoke" ? (
            <path d={pxPath([[Z.smoke + 4, 100, 2, 2]])} fill={K.white} opacity={0.5} />
          ) : null}

          <Vignette set={VIGNETTE} strength={night ? 0.5 : 0.15} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition
 * ================================================================== */

export const ELEKTRYKOW_SCENE: RuntimeSceneDef<WorldState> = {
  id: "elektrykow",
  width: W,
  spawnX: 120,
  /**
   * The street is a walkable band, not a line: 150 is the building line where
   * the doors, hatches and signs live; 170 the nearest plate course. The rails
   * are set flush — you walk over them, which is the point of them.
   */
  ground: {
    top: FLOOR,
    bottom: BAND_BOT,
    /**
     * The band is not a constant strip. At the far left the stair landing and
     * its fence own the back edge, so the walk starts a step nearer; past the
     * club the loading apron's rubble strip narrows the front edge toward the
     * dock gate. Both edges are painted where they bend (the kerb line, the
     * rubble), so the terrain and the picture make the same claim.
     */
    profile: [
      { x: 0, top: 158 },
      { x: 118, top: 158 },
      { x: 148, top: FLOOR },
      { x: 1636, bottom: BAND_BOT },
      { x: 1676, bottom: 163 },
      { x: W, bottom: 163 },
    ],
    /**
     * What the ground is made of, where it differs: the rail strip (read back
     * by live.surface), and the puddle, which genuinely wades — walking the
     * long way around it is now a real decision.
     */
    zones: [
      { x0: Z.board + 36, x1: Z.board + 84, y0: 160, y1: 169, kind: "puddle", speed: 0.8 },
      { x0: 0, x1: W, y0: 155, y1: 160, kind: "rails" },
    ],
    blockers: [
      /* the band furniture — footprints matched to the prop sprites above */
      { x0: P["prop-crates"].x - 16, y0: 152, x1: P["prop-crates"].x + 16, y1: 159 },
      { x0: P["prop-barrel-c"].x - 12, y0: 158, x1: P["prop-barrel-c"].x + 12, y1: 166 },
      { x0: P["prop-barrel-a"].x - 12, y0: 150, x1: P["prop-barrel-a"].x + 12, y1: 157 },
      { x0: P["prop-barrel-b"].x - 12, y0: 160, x1: P["prop-barrel-b"].x + 12, y1: 168 },
      { x0: P["prop-drum"].x - 17, y0: 156, x1: P["prop-drum"].x + 17, y1: 165 },
      { x0: P["prop-kosz"].x - 8, y0: 163, x1: P["prop-kosz"].x + 8, y1: 168 },
      /* the picnic table: the gap between it and the wall stays walkable, so
         sitting "at" it puts the player BEHIND the tabletop and the sort
         paints the table over his lap — the whole trick in one blocker */
      { x0: P["prop-picnic"].x - 26, y0: 154, x1: P["prop-picnic"].x + 26, y1: 161 },
      { x0: P["prop-aboard"].x - 13, y0: 152, x1: P["prop-aboard"].x + 13, y1: 158 },
      /* the generator */
      { x0: GEN[0] - 2, y0: FLOOR - 6, x1: GEN[0] + GEN[2] + 2, y1: FLOOR + 2 },
      /* the crane leg's bogie beam */
      { x0: Z.crane - 22, y0: FLOOR - 6, x1: Z.crane + 26, y1: FLOOR + 2 },
      /* the bike pile */
      { x0: Z.board + 52, y0: FLOOR - 4, x1: Z.board + 106, y1: FLOOR + 4 },
    ],
  },
  /** Every world read the art performs, and nothing else. */
  artKey: (w, ph) => {
    const p = toPhase(ph);
    const s = elektrykowState(w, p);
    return [ph, s.club, s.bar, s.frytki, s.crowd, s.queue, s.festoon].join("|");
  },
  /**
   * People drifting: one walker doing the bar–club circuit, one doing the
   * frytki run, both only when the street is awake. Stepped by the loop, so
   * they depth-sort against the player in the band.
   */
  actors: [
    npcToActor(NPCS.spacer, {
      x: Z.bar + 40,
      y: 162,
      patrol: { from: Z.bar - 60, to: Z.queue - 30, speed: 17, pauseMs: 3600 },
      visible: (world) => elektrykowState(world as WorldState, phNow()).crowd >= 2,
      z: 6,
    }),
    npcToActor(NPCS.spacerka, {
      x: Z.frytki - 80,
      y: 156,
      facing: -1,
      patrol: { from: Z.gap - 40, to: Z.frytki + 60, speed: 13, pauseMs: 5200 },
      visible: (world) => elektrykowState(world as WorldState, phNow()).crowd >= 1,
      z: 6,
    }),
    /* --- the furniture, depth-sorted against everyone above ------------- */
    propActor("prop-crates", P["prop-crates"].x, P["prop-crates"].y, cratesMap(), CRATES_PALETTE),
    propActor(
      "prop-barrel-c",
      P["prop-barrel-c"].x,
      P["prop-barrel-c"].y,
      barrelMap(false),
      BARREL_PALETTE,
    ),
    propActor(
      "prop-barrel-a",
      P["prop-barrel-a"].x,
      P["prop-barrel-a"].y,
      barrelMap(true),
      BARREL_PALETTE,
    ),
    propActor(
      "prop-barrel-b",
      P["prop-barrel-b"].x,
      P["prop-barrel-b"].y,
      barrelMap(true),
      BARREL_PALETTE,
    ),
    propActor("prop-drum", P["prop-drum"].x, P["prop-drum"].y, drumMap(), DRUM_PALETTE),
    propActor("prop-kosz", P["prop-kosz"].x, P["prop-kosz"].y, koszMap(), KOSZ_PALETTE),
    propActor("prop-picnic", P["prop-picnic"].x, P["prop-picnic"].y, picnicMap(), PICNIC_PALETTE),
    propActor("prop-aboard", P["prop-aboard"].x, P["prop-aboard"].y, aboardMap(), ABOARD_PALETTE),
  ],
  describe:
    "Ulica Elektryków: a shipyard street at night — brick halls, container bars, festoon lights, a queue outside the club under a magenta neon, cranes on the skyline.",
  objects: [
    /* --- the way in and out: the SKM stair --- */
    { id: "elektrykow-skm", kind: "trainDoor", priority: 2, x: Z.skm, range: 34 },
    { id: "elektrykow-fence", kind: "flavor", x: Z.skm + 74, range: 18 },
    /* --- the electricians' street --- */
    { id: "trafo-kiosk", kind: "flavor", x: Z.trafo, range: 26 },
    { id: "trafo-sign", kind: "flavor", x: Z.trafo + 4, range: 10, markerY: 78 },
    { id: "hala-posters", kind: "flavor", x: 420, range: 30 },
    { id: "hala-gate", kind: "flavor", x: Z.gate, range: 24 },
    { id: "hala-windows", kind: "flavor", x: 540, range: 40, markerY: 60 },
    { id: "hala-mural", kind: "flavor", x: Z.mural, range: 40, markerY: 66 },
    {
      id: "starer",
      kind: "npc",
      priority: 2,
      x: Z.mural + 58,
      range: 16,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 2,
    },
    /* --- the gap --- */
    { id: "pipe-bridge", kind: "flavor", x: Z.gap + 12, range: 24, markerY: 40 },
    {
      id: "filozof",
      kind: "npc",
      priority: 2,
      x: Z.smoke - 40,
      range: 16,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 1,
    },
    { id: "pallet-bench", kind: "sport", action: "sit", face: 1, x: Z.smoke - 54, range: 20 },
    { id: "smoke-corner", kind: "sport", action: "smoke", x: Z.smoke, range: 20 },
    { id: "drum-table", kind: "flavor", x: P["prop-drum"].x, y: P["prop-drum"].y - 4, range: 18 },
    /* --- the bar --- */
    {
      id: "bar-crates",
      kind: "flavor",
      x: P["prop-crates"].x,
      y: P["prop-crates"].y - 3,
      range: 16,
    },
    { id: "bar-menu", kind: "flavor", x: Z.bar + 34, range: 16 },
    { id: "bar-prad", kind: "barman", priority: 2, x: Z.bar + 128, range: 30, approachY: 153 },
    {
      id: "barrel-1",
      kind: "flavor",
      x: P["prop-barrel-a"].x,
      y: P["prop-barrel-a"].y + 3,
      range: 16,
    },
    {
      id: "festoon-switch",
      kind: "festoon",
      x: POLE_X[0],
      y: 152,
      range: 16,
      markerY: 114,
    },
    {
      id: "solo-dancer",
      kind: "flavor",
      x: Z.bar + 220,
      range: 20,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 2,
    },
    /* --- the frytki --- */
    {
      id: "frytki-stand",
      kind: "frytki",
      priority: 2,
      x: Z.frytki + 62,
      range: 30,
      approachY: 153,
    },
    { id: "frytki-menu", kind: "flavor", x: Z.frytki + 114, range: 12 },
    {
      /* sit at the table: the approach point is BEHIND it, in the pocket the
         blocker leaves open, so the tabletop then sorts over the player's lap */
      id: "picnic-table",
      kind: "sport",
      action: "sit",
      face: -1,
      x: P["prop-picnic"].x,
      y: 152,
      approachX: P["prop-picnic"].x,
      approachY: 152,
      range: 26,
    },
    { id: "street-kosz", kind: "flavor", x: P["prop-kosz"].x, y: P["prop-kosz"].y - 2, range: 14 },
    { id: "generator", kind: "flavor", x: GEN[0] + 17, range: 18 },
    /* --- the yard --- */
    { id: "event-board", kind: "flavor", x: Z.board, range: 30, markerY: 64 },
    { id: "bike-pile", kind: "flavor", x: Z.board + 80, range: 20 },
    { id: "yard-rails", kind: "flavor", x: Z.board + 140, y: 160, range: 22 },
    { id: "crane-leg", kind: "flavor", x: Z.crane, range: 28, markerY: 60 },
    { id: "yard-puddle", kind: "flavor", x: Z.board + 60, y: 164, range: 14 },
    /* --- the queue and the club --- */
    { id: "queue-barriers", kind: "flavor", x: Z.queue + 44, range: 30 },
    {
      id: "queue-girl",
      kind: "npc",
      priority: 2,
      x: Z.queue + 18,
      range: 14,
      when: (w) => elektrykowState(w as WorldState, phNow()).queue >= 1,
    },
    {
      id: "club-aboard",
      kind: "flavor",
      x: P["prop-aboard"].x,
      y: P["prop-aboard"].y + 2,
      range: 14,
    },
    {
      id: "bramkarz",
      kind: "npc",
      priority: 2,
      x: Z.door - 58,
      range: 18,
      when: (w) => {
        const s = elektrykowState(w as WorldState, phNow());
        return clubOn(s) || s.club === "prep";
      },
    },
    { id: "club-door", kind: "clubdoor", priority: 2, x: Z.door, range: 26, approachY: 152 },
    {
      id: "yard-welding",
      kind: "flavor",
      x: 950,
      range: 34,
      markerY: 84,
      when: (w) => {
        void w;
        return isDark(phNow());
      },
    },
    {
      id: "spur-cat",
      kind: "flavor",
      x: Z.gap + 58,
      range: 26,
      markerY: 76,
      when: (w) => {
        void w;
        return phNow() === "night";
      },
    },
    { id: "club-neon", kind: "flavor", x: Z.door, range: 40, markerY: 40 },
    { id: "club-rules", kind: "flavor", x: RULES_BOARD[0] + 12, range: 14 },
    { id: "portaloo", kind: "portaloo", x: LOO_X[0] + 14, range: 20 },
    /* --- past the club --- */
    { id: "dock-fence", kind: "flavor", x: W - 30, range: 26 },
  ],
  Component: ({ world, phase }) => <ElektrykowScene world={world} phase={phase} />,
  /** Outdoors and self-lit: the sky and the sources do all of it. */
  darkness: () => 0,
  Effects: ElektrykowEffects,
  idleLean: true,
};
