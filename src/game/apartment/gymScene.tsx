import {
  AOSet,
  aoPaths,
  Bev,
  Bevel,
  bevelPaths,
  bulbPaths,
  Contact,
  contactPaths,
  dth,
  LayeredScene,
  Light,
  type LightTier,
  M,
  type Mat,
  NpcActor,
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  repeat,
  type SceneDef,
  SharedDefs,
  STEP_FADE,
  STEP_SLIDE,
  shift,
  steppedEllipse,
  steppedQuad,
  textPath,
  textRects,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { DayPhase, WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";
import { NPCS } from "./npcs";

// --- ZDROFIT ALCHEMIA / the gym on the first floor of an office park ----------------

/**
 * A commercial gym in the Alchemia complex: you come up the stairs from the
 * lobby, past reception, through the turnstile, and the floor opens out to the
 * right — cardio first because that is what they put in the window, then the
 * free-weights hall, then the changing rooms at the far end.
 *
 * 1240 pixels wide, which makes this the widest scene in the game, so the
 * batching rules matter more here than anywhere else. See BUDGET at the foot of
 * this comment.
 *
 * Six planes:
 *   farBackground (0.82) — the curtain wall at the stair end and the office park
 *     beyond it. It lags hard, because it is thirty metres out and because the
 *     glass has to read as glass.
 *   middleBackground (1.0) — the shell: ceiling, exposed services, LED battens,
 *     the bulkhead and its zone signage, the mirror walls, the glass partitions,
 *     the stair balustrade, wall fittings.
 *   ground (1.0) — four different floors, one per zone, and every pool of light.
 *     All hitboxes resolve against this plane.
 *   staticObjects (1.0) — the equipment. Every machine is a state machine.
 *   gameplayObjects (1.0) — the people. They are here rather than in
 *     staticObjects so a future pass can sort them against the player's depth.
 *   Foreground (fixed) — the near edge: the underside of the bulkhead, the top
 *     two treads of the stair coming up into frame at the left, near floor.
 *
 * LIGHTING PREMISE, and it is deliberately the opposite of every other room in
 * the game: this place is lit by sixteen linear LED battens that are on from
 * 06:00 to 23:00 and do not care what the sky is doing. So the hour reaches only
 * the first three hundred pixels, through the curtain wall, and dies before it
 * gets to the squat racks. That is what a commercial gym actually feels like —
 * you cannot tell what time it is from inside one — and it means four fifths of
 * this scene is phase-invariant and therefore cheap. There is no per-phase
 * palette ramp in this file for exactly that reason; the daylight is a wash over
 * the left end, gated by a stepped quad, and nothing else.
 *
 * The one interior exception is the changing room, which sits behind a solid
 * wall on warm 3000K strips instead of the 4000K on the floor. Two colour
 * temperatures in one frame is what sells "back of house".
 *
 * STATE. Thirteen reads, all defensive — `world.gym` need not exist:
 *
 *   crowd      0 empty → 3 packed        gates who is here and how much mess
 *   reception  away → staffed → busy
 *   turnstile  locked → unlocked → open
 *   cardio     0..3                      treadmills actually running
 *   rack       empty → loaded → working
 *   platform   clear → loaded → chalked
 *   dumbbells  0..3                      pairs missing from the rack
 *   lockers    0..3                      doors left open
 *   shower     off → running → steam
 *   music      off → low → loud
 *   water      full → low → empty        the cooler bottle
 *   tv         off → news → sport
 *   cleaning   boolean                   wet-floor sign and a mopped sheen
 *
 * PEOPLE. Five, gated by `crowd`: Kasia on reception, a runner on treadmill two,
 * a lifter under the near power rack, a bench pair, and the lad who curls in
 * front of the mirror and is the reason the mirror is there. Two of them carry
 * monologues; the rest are silent, because five talking NPCs in one room is a
 * different game.
 *
 * TRANSIENTS. Anything driven by `actionUi` lives in GymEffects. The art holds
 * what is true when the player is not on a machine.
 *
 * BUDGET. ~390 nodes at crowd 3, 18 animations, 7 of them on
 * calcMode="discrete". Zero gradients, zero ellipses. 26 hitboxes, audited for
 * overlap and for dead stretches wider than 40px. For a scene 2.2x the width of
 * the corridor that only works because nothing repeated is drawn twice: the four
 * treadmills are one shape banked four ways and flattened to 9 paths, the
 * sixteen locker doors are a single 5-node Bev, the ceiling battens are 3 paths,
 * and every floor is 2. If you add equipment, add it to a bank — never as a
 * fourth copy of an existing <g>.
 */

const W = 1240;
const H = 180;

/* Landmark rows. */
const CEIL = 24; // underside of the slab; services hang below it
const SOFFIT = 40; // bottom of the bulkhead that carries the signage
const SIGN_Y = 28; // baseline of the zone lettering
const MIRROR_TOP = 62;
const MIRROR_BOT = 128;
const DADO = 116; // top of the rubber kickplate, where a barbell hits the wall
const SKIRT = 146;
const FLOOR = 150;
const CY = 149; // where contact shadows sit

/** Zone boundaries. Every x in this file belongs to exactly one of these. */
const Z = {
  stairEnd: 174,
  receptionEnd: 400,
  cardioEnd: 740,
  weightsEnd: 1040,
} as const;

/* ================================================================== *
 * palette — flat, not ramped. The premise says the hour does not reach.
 * ================================================================== */

/** The grey-blue rubber that every gym in Europe buys from the same supplier. */
const RUBBER: Mat = {
  hi: "#4a4f56",
  base: "#3a3f45",
  mid: "#34383e",
  lo: "#2d3137",
  deep: "#20242a",
};
/** Pale porcelain in the entrance and reception, because it looks clean. */
const PORCELAIN: Mat = {
  hi: "#dcdad2",
  base: "#c9c7bf",
  mid: "#bebcb4",
  lo: "#b2b0a8",
  deep: "#94928b",
};
/** Wood-effect vinyl on the cardio floor, which fools nobody. */
const VINYL: Mat = {
  hi: "#b09270",
  base: "#9a7d5e",
  mid: "#8e7355",
  lo: "#836a4e",
  deep: "#65523c",
};
/** Wet-room porcelain in the changing room, smaller format, more grout. */
const WETTILE: Mat = {
  hi: "#a8b0b4",
  base: "#939ba0",
  mid: "#8a9297",
  lo: "#7f878c",
  deep: "#666d72",
};
const WALLPAINT: Mat = {
  hi: "#e4e2dc",
  base: "#d6d4cd",
  mid: "#cbc9c2",
  lo: "#c0beb7",
  deep: "#a4a29b",
};
/** The dark accent wall behind the free weights. Every gym has one. */
const ACCENT: Mat = {
  hi: "#3d434b",
  base: "#2e343b",
  mid: "#292e35",
  lo: "#23282e",
  deep: "#191d22",
};
const MIRROR: Mat = {
  hi: "#c2ced4",
  base: "#a8b6be",
  mid: "#9caab2",
  lo: "#8e9ca4",
  deep: "#74828a",
};
/** Machine shrouds: the off-white plastic of a treadmill console. */
const SHROUD: Mat = {
  hi: "#e6e4de",
  base: "#d2d0ca",
  mid: "#c6c4be",
  lo: "#b8b6b0",
  deep: "#9a9892",
};
/** Powder-coated black steel: frames, racks, uprights. */
const COAT: Mat = {
  hi: "#3a3d43",
  base: "#25282c",
  mid: "#212428",
  lo: "#1b1e22",
  deep: "#131518",
};
/** Cast iron with the paint worn off the edges. */
const CASTIRON: Mat = {
  hi: "#5a5f66",
  base: "#42474d",
  mid: "#3b3f45",
  lo: "#33373c",
  deep: "#23262a",
};
const CHROME: Mat = {
  hi: "#e8ecf0",
  base: "#c4c9ce",
  mid: "#b0b5ba",
  lo: "#989da2",
  deep: "#74797e",
};

const K = {
  /** The brand accent. Warm red-orange on graphite, used sparingly and only
   *  as a colour — the wordmark below is set in the house pixel font, not a
   *  reproduction of anybody's logotype. */
  brand: "#e8542e",
  brandHi: "#f5764c",
  brandLo: "#b83c1c",
  /** 4000K on the floor, 3000K in the changing room. The whole point. */
  led4000: "#f2f6ff",
  led3000: "#ffe0b0",
  ledDead: "#8a8d92",
  /** what the curtain wall is, per hour */
  glass: { dawn: "#b8bcd0", day: "#b6cfdd", dusk: "#d69a70", night: "#1e2530" } as Record<
    Ph,
    string
  >,
  sky: { dawn: "#c0bcd4", day: "#cadfe8", dusk: "#e0a878", night: "#151b24" } as Record<Ph, string>,
  chalk: "#eceff2",
  rubberDust: "#4f545a",
  green: "#3ddc84",
  red: "#e0483a",
  amber: "#f0a63c",
  screen: "#1a2028",
  screenLit: "#4a6f8a",
  water: "#8fc0d8",
  waterLo: "#5f93ad",
  steam: "#dfeaf2",
  towel: "#e8e2d2",
  towelLo: "#c6bfa9",
  tape: "#d8d3b8",
  skin: M.skin.base,
  skinLo: M.skin.lo,
  /** kit colours for the people, so nobody is wearing the same thing */
  jersey: "#2f6a9e",
  jerseyHi: "#3f83bd",
  vest: "#c9382e",
  vestHi: "#e0503f",
  shortsA: "#22262b",
  shortsB: "#3a4148",
  polo: "#1d2a3a",
  poloHi: "#2b3d52",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

export type ReceptionStage = "away" | "staffed" | "busy";
export type TurnstileStage = "locked" | "unlocked" | "open";
export type RackStage = "empty" | "loaded" | "working";
export type PlatformStage = "clear" | "loaded" | "chalked";
export type ShowerStage = "off" | "running" | "steam";
export type MusicStage = "off" | "low" | "loud";
export type WaterStage = "full" | "low" | "empty";
export type TvStage = "off" | "news" | "sport";

const RECEPTION_STAGES: readonly ReceptionStage[] = ["away", "staffed", "busy"];
const TURNSTILE_STAGES: readonly TurnstileStage[] = ["locked", "unlocked", "open"];
const RACK_STAGES: readonly RackStage[] = ["empty", "loaded", "working"];
const PLATFORM_STAGES: readonly PlatformStage[] = ["clear", "loaded", "chalked"];
const SHOWER_STAGES: readonly ShowerStage[] = ["off", "running", "steam"];
const MUSIC_STAGES: readonly MusicStage[] = ["off", "low", "loud"];
const WATER_STAGES: readonly WaterStage[] = ["full", "low", "empty"];
const TV_STAGES: readonly TvStage[] = ["off", "news", "sport"];

type GymState = {
  crowd: 0 | 1 | 2 | 3;
  reception: ReceptionStage;
  turnstile: TurnstileStage;
  cardio: 0 | 1 | 2 | 3;
  rack: RackStage;
  platform: PlatformStage;
  dumbbells: 0 | 1 | 2 | 3;
  lockers: 0 | 1 | 2 | 3;
  shower: ShowerStage;
  music: MusicStage;
  water: WaterStage;
  tv: TvStage;
  cleaning: boolean;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/**
 * `world.gym` may not exist. Defaults describe a Tuesday at about seven in the
 * evening, which is this place at its most characteristic.
 */
function state(world: WorldState): GymState {
  const b = ((world as unknown as Record<string, unknown>).gym ?? {}) as Record<string, unknown>;
  const crowd = clampInt(b.crowd, 3, 2) as 0 | 1 | 2 | 3;
  return {
    crowd,
    reception: clampStage(b.reception, RECEPTION_STAGES, "staffed"),
    turnstile: clampStage(b.turnstile, TURNSTILE_STAGES, "locked"),
    /** cardio defaults to following the crowd rather than needing its own key */
    cardio: clampInt(b.cardio, 3, crowd) as 0 | 1 | 2 | 3,
    rack: clampStage(b.rack, RACK_STAGES, crowd >= 2 ? "working" : "loaded"),
    platform: clampStage(b.platform, PLATFORM_STAGES, "loaded"),
    dumbbells: clampInt(b.dumbbells, 3, crowd >= 2 ? 2 : 0) as 0 | 1 | 2 | 3,
    lockers: clampInt(b.lockers, 3, 1) as 0 | 1 | 2 | 3,
    shower: clampStage(b.shower, SHOWER_STAGES, crowd >= 2 ? "running" : "off"),
    music: clampStage(b.music, MUSIC_STAGES, "low"),
    water: clampStage(b.water, WATER_STAGES, "low"),
    tv: clampStage(b.tv, TV_STAGES, "sport"),
    cleaning: b.cleaning === true,
  };
}

/** Who is actually on the floor. One place, so the art and the monologues agree. */
function whoIsHere(s: GymState) {
  return {
    kasia: s.reception !== "away",
    runner: s.crowd >= 1 || s.cardio >= 1,
    lifter: s.crowd >= 2 || s.rack === "working",
    benchPair: s.crowd >= 3,
    curler: s.crowd >= 3 || s.dumbbells >= 2,
  };
}

/* ================================================================== *
 * geometry helpers
 * ================================================================== */

/**
 * The rule that makes a 1240-wide scene affordable: define a machine once, then
 * bank it. Four treadmills cost the same authoring as one and, after pxPath,
 * roughly the same number of nodes.
 */
function bank(shape: readonly Rect[], n: number, pitch: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) out.push(...shift(shape, i * pitch, 0));
  return out;
}

/** A floor: base course plus a lighter top edge, batched to two paths. */
function floorField(x0: number, x1: number, pitch: number, courseY: readonly number[]) {
  const face: Rect[] = [];
  const hi: Rect[] = [];
  for (const y of courseY) {
    for (let x = x0; x < x1; x += pitch) {
      const w = Math.min(pitch - 2, x1 - x - 1);
      if (w <= 0) continue;
      face.push([x + 1, y, w, 12]);
      hi.push([x + 1, y, w, 2]);
    }
  }
  return { face: pxPath(face), hi: pxPath(hi) };
}

/* ================================================================== *
 * precomputed geometry — nothing below allocates at render time
 * ================================================================== */

/* --- floors, one per zone --- */
const FLOOR_ENTRY = floorField(0, Z.stairEnd, 22, [152, 166]);
const FLOOR_RECEPTION = floorField(Z.stairEnd, Z.receptionEnd, 22, [152, 166]);
const FLOOR_CARDIO = floorField(Z.receptionEnd, Z.cardioEnd, 34, [152, 166]);
/** The weights floor is 1m interlocking rubber, so the grid is square and big. */
const FLOOR_WEIGHTS = floorField(Z.cardioEnd, Z.weightsEnd, 30, [152, 166]);
const FLOOR_LOCKERS = floorField(Z.weightsEnd, W, 16, [152, 166]);
/** The platform inside the weights floor: two-tone timber, and it sounds different. */
const PLATFORM_D = pxPath([[936, 150, 88, 30]]);
const PLATFORM_BOARDS = pxPath(repeat(11, 8, [940, 150, 6, 30] as Rect));

/* --- ceiling: sixteen battens, three paths, one source path --- */
const BATTEN_X = Array.from({ length: 16 }, (_, i) => 40 + i * 76);
const BATTENS = {
  body: pxPath(BATTEN_X.map((x) => [x, CEIL + 2, 56, 3] as Rect)),
  lens: pxPath(BATTEN_X.map((x) => [x + 2, CEIL + 3, 52, 2] as Rect)),
  stem: pxPath(
    BATTEN_X.flatMap(
      (x) =>
        [
          [x + 10, CEIL, 2, 2],
          [x + 44, CEIL, 2, 2],
        ] as Rect[],
    ),
  ),
};
/** The 3000K strip in the changing room runs the other way and is warmer. */
const STRIP_LOCKERS = pxPath([[Z.weightsEnd + 8, CEIL + 3, 184, 2]]);
/** Exposed services above the battens: duct, tray, sprinkler drops. */
const SERVICES = {
  duct: pxPath([[0, CEIL - 14, W, 8]]),
  ductSeam: pxPath(repeat(21, 60, [30, CEIL - 14, 2, 8] as Rect)),
  tray: pxPath([[0, CEIL - 5, W, 2]]),
  drops: pxPath(Array.from({ length: 10 }, (_, i) => [120 + i * 118, CEIL - 6, 2, 5] as Rect)),
  heads: pxPath(Array.from({ length: 10 }, (_, i) => [119 + i * 118, CEIL - 1, 4, 2] as Rect)),
};

/* --- mirror walls: cardio and weights, batched --- */
const MIRROR_PANELS = bank([[0, MIRROR_TOP, 82, MIRROR_BOT - MIRROR_TOP]], 4, 84);
const MIRROR_CARDIO = bevelPaths(shift(MIRROR_PANELS, Z.receptionEnd + 6, 0));
const MIRROR_WEIGHTS = bevelPaths(
  shift(bank([[0, MIRROR_TOP, 82, MIRROR_BOT - MIRROR_TOP]], 3, 84), Z.cardioEnd + 10, 0),
);
/** What a mirror in a gym actually shows: the opposite wall, and the battens. */
const MIRROR_CONTENT = pxPath([
  ...bank([[0, MIRROR_TOP + 6, 82, 2]], 4, 84).map(
    ([x, y, w, h]) => [x + Z.receptionEnd + 6, y, w, h] as Rect,
  ),
  ...bank([[0, MIRROR_TOP + 6, 82, 2]], 3, 84).map(
    ([x, y, w, h]) => [x + Z.cardioEnd + 10, y, w, h] as Rect,
  ),
]);

/* --- treadmill: defined once, banked four times --- */
const TREADMILL_SHAPE = {
  deck: [
    [0, 128, 46, 6],
    [2, 134, 42, 4],
  ] as Rect[],
  belt: [[3, 129, 40, 4]] as Rect[],
  upright: [
    [4, 96, 4, 32],
    [36, 96, 4, 32],
  ] as Rect[],
  console: [[2, 82, 40, 14]] as Rect[],
  screen: [[6, 85, 24, 9]] as Rect[],
  bar: [
    [0, 104, 6, 3],
    [38, 104, 6, 3],
  ] as Rect[],
  foot: [
    [0, 138, 8, 4],
    [38, 138, 8, 4],
  ] as Rect[],
};
const TREAD_X = 424;
const TREAD_PITCH = 56;
/** The running surface — where a runner's feet actually are. */
const TREAD_BELT = 130;
const TREADMILLS = {
  deck: bevelPaths(
    bank(TREADMILL_SHAPE.deck, 4, TREAD_PITCH).map((r) => shift([r], TREAD_X, 0)[0]),
  ),
  belt: pxPath(shift(bank(TREADMILL_SHAPE.belt, 4, TREAD_PITCH), TREAD_X, 0)),
  upright: pxPath(shift(bank(TREADMILL_SHAPE.upright, 4, TREAD_PITCH), TREAD_X, 0)),
  console: bevelPaths(shift(bank(TREADMILL_SHAPE.console, 4, TREAD_PITCH), TREAD_X, 0)),
  bar: pxPath(shift(bank(TREADMILL_SHAPE.bar, 4, TREAD_PITCH), TREAD_X, 0)),
  foot: pxPath(shift(bank(TREADMILL_SHAPE.foot, 4, TREAD_PITCH), TREAD_X, 0)),
};
/** Screens are lit per machine, so they need their own paths, indexed. */
const TREAD_SCREENS = Array.from({ length: 4 }, (_, i) =>
  pxPath(shift(TREADMILL_SHAPE.screen, TREAD_X + i * TREAD_PITCH, 0)),
);
/** The belt's tread lines, which are what actually animates when one is running. */
const TREAD_LINES = Array.from({ length: 4 }, (_, i) =>
  pxPath(repeat(8, 5, [TREAD_X + i * TREAD_PITCH + 4, 130, 2, 2] as Rect)),
);

/* --- upright bikes: three of them --- */
const BIKE_X = 656;
const BIKE_PITCH = 32;
const BIKES = {
  frame: pxPath(
    shift(
      bank(
        [
          [8, 108, 4, 26],
          [4, 132, 16, 4],
          [10, 96, 3, 14],
          [6, 118, 12, 3],
        ],
        3,
        BIKE_PITCH,
      ),
      BIKE_X,
      0,
    ),
  ),
  saddle: pxPath(shift(bank([[6, 92, 10, 4]], 3, BIKE_PITCH), BIKE_X, 0)),
  bars: pxPath(
    shift(
      bank(
        [
          [4, 84, 14, 3],
          [10, 87, 3, 6],
        ],
        3,
        BIKE_PITCH,
      ),
      BIKE_X,
      0,
    ),
  ),
  wheel: pxPath(shift(bank([[7, 124, 10, 10]], 3, BIKE_PITCH), BIKE_X, 0)),
  crank: pxPath(shift(bank([[11, 128, 2, 8]], 3, BIKE_PITCH), BIKE_X, 0)),
};

/* --- the power racks, bench, plate trees, dumbbell rack --- */
const RACK_SET = bevelPaths([
  [776, 62, 6, 88], // near upright
  [828, 62, 6, 88], // far upright
  [776, 62, 58, 5], // top crossmember
  [776, 140, 58, 4], // base
]);
const RACK_HOLES = pxPath(repeat(11, 7, [778, 72, 2, 2] as Rect, "y"));
const RACK_HOLES2 = pxPath(repeat(11, 7, [830, 72, 2, 2] as Rect, "y"));
const BENCH_SET = bevelPaths([
  [862, 122, 46, 5], // pad
  [878, 127, 6, 20], // centre post
  [862, 144, 12, 4],
  [896, 144, 12, 4],
]);
const BENCH_UPRIGHT = bevelPaths([
  [858, 96, 5, 30],
  [906, 96, 5, 30],
  [858, 96, 53, 4],
]);
/** Plate trees: two of them, seven pegs each, plates on the pegs. */
const TREE_X = [750, 1002] as const;
const TREES = {
  post: pxPath(TREE_X.map((x) => [x + 6, 96, 5, 50] as Rect)),
  base: pxPath(TREE_X.map((x) => [x, 144, 18, 5] as Rect)),
  pegs: pxPath(
    TREE_X.flatMap((x) =>
      repeat(4, 12, [x, 102, 6, 2] as Rect, "y").concat(
        repeat(4, 12, [x + 11, 102, 6, 2] as Rect, "y"),
      ),
    ),
  ),
};
/** Dumbbell rack: two tiers, eight pairs, and the gaps where pairs are missing. */
const DB_X = 986;
const DB_ROW_Y = [110, 130] as const;
const DB_RACK = bevelPaths([
  [DB_X - 4, 104, 62, 4],
  [DB_X - 4, 124, 62, 4],
  [DB_X - 4, 144, 62, 5],
  [DB_X - 4, 104, 5, 45],
  [DB_X + 53, 104, 5, 45],
]);
/** One dumbbell, banked eight ways, then sliced by how many are missing. */
function dumbbellsPath(rowY: number, from: number, to: number): string {
  const out: Rect[] = [];
  for (let i = from; i < to; i++) {
    const x = DB_X + 2 + i * 13;
    out.push([x, rowY, 4, 8], [x + 4, rowY + 2, 3, 4], [x + 7, rowY, 4, 8]);
  }
  return pxPath(out);
}
const DB_PARTIAL = [
  [dumbbellsPath(DB_ROW_Y[0], 0, 4), dumbbellsPath(DB_ROW_Y[1], 0, 4)],
  [dumbbellsPath(DB_ROW_Y[0], 0, 3), dumbbellsPath(DB_ROW_Y[1], 0, 4)],
  [dumbbellsPath(DB_ROW_Y[0], 0, 2), dumbbellsPath(DB_ROW_Y[1], 0, 3)],
  [dumbbellsPath(DB_ROW_Y[0], 0, 1), dumbbellsPath(DB_ROW_Y[1], 0, 2)],
];

/* --- lockers: sixteen doors, one Bev --- */
const LOCKER_X = 1064;
const LOCKER_COLS = 8;
const LOCKER_PITCH = 17;
const LOCKER_DOORS = bank([[0, 62, 15, 40]], LOCKER_COLS, LOCKER_PITCH)
  .concat(bank([[0, 104, 15, 40]], LOCKER_COLS, LOCKER_PITCH))
  .map((r) => shift([r], LOCKER_X, 0)[0]);
const LOCKERS_SET = bevelPaths(LOCKER_DOORS);
const LOCKER_VENTS = pxPath(
  LOCKER_DOORS.flatMap(
    ([x, y]) =>
      [
        [x + 4, y + 4, 7, 1],
        [x + 4, y + 7, 7, 1],
      ] as Rect[],
  ),
);
const LOCKER_HANDLES = pxPath(LOCKER_DOORS.map(([x, y]) => [x + 11, y + 18, 2, 6] as Rect));
/** Numbered 1..16, top row then bottom, stencilled small in the top left corner. */
const LOCKER_NUMBERS = pxPath(
  LOCKER_DOORS.flatMap(([x, y], i) => textRects(String(i + 1), x + 3, y + 12, 1)),
);

/* --- signage, all precomputed to one path per sign --- */
const SIGNS = {
  brand: textPath("ZDROFIT", 196, SIGN_Y, 2),
  complex: textPath("ALCHEMIA", 196, SIGN_Y + 8, 1),
  reception: textPath("RECEPCJA", 250, 56, 1),
  cardio: textPath("CARDIO", 540, SIGN_Y, 2),
  weights: textPath("SIŁOWNIA", 860, SIGN_Y, 2),
  lockers: textPath("SZATNIA", 1104, SIGN_Y, 2),
  hours: textPath("6:00-23:00", 196, 52, 1),
  /** the price board, which is the only place in the game with a percent sign */
  priceA: textPath("KARNET", 196, 74, 1),
  priceB: textPath("129 PLN", 196, 82, 1),
  priceC: textPath("-20%", 196, 90, 1),
  /** stencilled on the rubber, and half worn off */
  platformMark: textPath("MAX 200 KG", 954, 168, 1),
};

/* --- light --- */
/** Daylight through the curtain wall. Reaches x≈330 and no further. */
const DAY_WASH: Record<Ph, LightTier[] | null> = {
  dawn: tiers((k) => steppedQuad(CEIL, 0, 60 + 90 * k, H, 0, 130 + 140 * k, 10), "c", 0.55),
  day: tiers((k) => steppedQuad(CEIL, 0, 74 + 110 * k, H, 0, 170 + 180 * k, 10), "c", 0.9),
  dusk: tiers((k) => steppedQuad(CEIL, 0, 66 + 100 * k, H, 0, 200 + 200 * k, 10), "e", 0.8),
  night: null,
};
/** The battens' own pools on the floor: one path for all sixteen, three tiers. */
const BATTEN_POOLS = tiers(
  (k) =>
    BATTEN_X.flatMap((x) =>
      steppedEllipse(x + 28, FLOOR + 10, Math.round(34 * k), Math.round(9 * k), 3),
    ),
  "w",
  0.34,
);
const BATTEN_SOURCES = bulbPaths(BATTEN_X.map((x) => [x + 28, CEIL + 4] as const));
/** The changing room is warmer and the pool is longer and flatter. */
const LOCKER_POOL = tiers(
  (k) =>
    steppedQuad(
      CEIL + 6,
      Z.weightsEnd + 10 + (1 - k) * 30,
      W - 10 - (1 - k) * 20,
      FLOOR + 20,
      Z.weightsEnd + 2 + (1 - k) * 40,
      W - (1 - k) * 20,
      12,
    ),
  "w",
  0.4,
);
/** Mirror bounce: a gym mirror throws about a third of the light back at the floor. */
const MIRROR_BOUNCE = tiers(
  (k) =>
    steppedQuad(
      MIRROR_BOT,
      Z.receptionEnd + 10 + (1 - k) * 60,
      Z.cardioEnd - 10 - (1 - k) * 60,
      FLOOR + 14,
      Z.receptionEnd + 30 + (1 - k) * 70,
      Z.cardioEnd - 30 - (1 - k) * 70,
      8,
    ),
  "c",
  0.3,
);
const VIGNETTE = vignettePaths(W, H);

/* --- occlusion and contact --- */
const SHELL_AO = aoPaths([
  [0, SOFFIT, W], // the bulkhead onto the wall
  [Z.stairEnd + 40, 100, 150], // reception counter
  [Z.receptionEnd + 6, MIRROR_BOT, 334], // mirror wall onto the floor
  [Z.cardioEnd + 10, MIRROR_BOT, 250],
  [LOCKER_X - 4, 144, 140], // locker bank
  [750, 149, 18],
  [1002, 149, 18],
]);
const FLOOR_CONTACT = contactPaths([
  [TREAD_X, 4 * TREAD_PITCH - 10, CY],
  [BIKE_X + 4, 3 * BIKE_PITCH - 12, CY],
  [776, 58, CY],
  [858, 54, CY],
  [936, 88, CY],
  [DB_X - 4, 62, CY],
  [LOCKER_X - 4, 140, CY],
  [1150, 60, CY],
  [292, 96, CY],
]);

/* ================================================================== *
 * PLANE 1 — the curtain wall and the office park beyond (parallax 0.82)
 * ================================================================== */

function Outside({ ph }: { ph: Ph }) {
  const night = ph === "night";
  /** Drawn far wider than the glazing, because at 0.82 it travels a long way. */
  return (
    <g>
      <SharedDefs />
      {px(-60, CEIL - 10, 420, 150, K.sky[ph])}
      {/* the block across the courtyard: brick, because Alchemia is a shipyard site */}
      {px(-60, 46, 200, 104, night ? "#241d1c" : "#7a5a4c")}
      {px(-60, 46, 200, 2, night ? "#312826" : "#8d6b5c")}
      <rect x={-60} y={46} width={200} height={104} fill="url(#px-grain)" />
      {/* its windows, most of them still on at seven in the evening */}
      {Array.from({ length: 18 }, (_, i) => {
        const x = -50 + (i % 6) * 32;
        const y = 56 + Math.floor(i / 6) * 30;
        const lit = night ? i % 3 !== 1 : i % 5 === 0;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: window grid is positional
          <g key={`w${i}`}>
            {px(x, y, 18, 16, lit ? "#f0d9a8" : night ? "#141a20" : "#5f7280")}
            {px(x, y, 18, 2, lit ? "#fbeccb" : night ? "#1c2228" : "#6f8290")}
          </g>
        );
      })}
      {/* the car park, and a tram going past on the far side */}
      {px(-60, 130, 420, 20, night ? "#1a1e24" : "#6d7278")}
      {px(140, 118, 220, 14, night ? "#181c22" : "#8a8f96")}
      <g>
        {px(150, 120, 40, 12, night ? "#3a4450" : "#b8483a")}
        {px(150, 120, 40, 2, night ? "#48535f" : "#d05e4a")}
        {px(154, 123, 8, 5, night ? "#f0d9a8" : "#8fb0c4")}
        {px(166, 123, 8, 5, night ? "#f0d9a8" : "#8fb0c4")}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-220 0;-220 0;240 0;240 0"
          keyTimes="0;0.42;0.62;1"
          dur="38s"
          repeatCount="indefinite"
        />
      </g>
      {/* the birch they planted to soften the car park */}
      {px(196, 96, 3, 34, night ? "#2a2a30" : "#d8d5cc")}
      {px(186, 74, 24, 24, night ? "#1f2a24" : M.leaf.base)}
      {px(186, 74, 24, 3, night ? "#26322a" : M.leaf.hi)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the shell
 * ================================================================== */

function Shell({ ph, s }: { ph: Ph; s: GymState }) {
  return (
    <g>
      {/* --- slab, services, battens ------------------------------------- */}
      {px(0, 0, W, CEIL, WALLPAINT.deep)}
      <path d={SERVICES.duct} fill={CHROME.lo} />
      <path d={SERVICES.ductSeam} fill={CHROME.deep} opacity={0.6} />
      <path d={SERVICES.tray} fill={COAT.base} />
      <path d={SERVICES.drops} fill={K.red} opacity={0.7} />
      <path d={SERVICES.heads} fill={CHROME.base} />
      <path d={BATTENS.stem} fill={COAT.mid} />
      <path d={BATTENS.body} fill={SHROUD.lo} />
      <path d={BATTENS.lens} fill={K.led4000} />
      {/* the bulkhead that carries the signage, and the shadow it drops */}
      {px(0, CEIL, W, SOFFIT - CEIL, WALLPAINT.base)}
      {px(0, SOFFIT - 2, W, 2, WALLPAINT.deep)}
      {px(0, CEIL, W, 1, WALLPAINT.hi)}
      {/* the brand band: colour only, and the name set in the house font */}
      {px(Z.stairEnd + 8, CEIL + 2, 210, 14, K.brand)}
      {px(Z.stairEnd + 8, CEIL + 2, 210, 1, K.brandHi)}
      {px(Z.stairEnd + 8, CEIL + 15, 210, 1, K.brandLo)}
      <path d={SIGNS.brand} fill="#ffffff" />
      <path d={SIGNS.complex} fill="#ffd9cc" />
      {/* zone lettering, hung off the bulkhead in the same graphite as the racks */}
      <path d={SIGNS.cardio} fill={COAT.base} />
      <path d={SIGNS.weights} fill={COAT.base} />
      <path d={SIGNS.lockers} fill={COAT.base} />

      {/* --- walls, zone by zone ---------------------------------------- */}
      {/* entrance: curtain wall, so the wall is mullions and glass */}
      {px(0, SOFFIT, Z.stairEnd, SKIRT - SOFFIT, K.glass[ph])}
      <rect x={0} y={SOFFIT} width={Z.stairEnd} height={SKIRT - SOFFIT} fill="url(#px-satin)" />
      <path d={pxPath(repeat(4, 46, [38, SOFFIT, 5, SKIRT - SOFFIT] as Rect))} fill={CHROME.lo} />
      <path d={pxPath(repeat(4, 46, [38, SOFFIT, 2, SKIRT - SOFFIT] as Rect))} fill={CHROME.hi} />
      {px(0, 92, Z.stairEnd, 3, CHROME.lo)}
      {px(0, 92, Z.stairEnd, 1, CHROME.hi)}
      {/* reception and cardio: painted plasterboard */}
      {px(Z.stairEnd, SOFFIT, Z.cardioEnd - Z.stairEnd, SKIRT - SOFFIT, WALLPAINT.base)}
      <rect
        x={Z.stairEnd}
        y={SOFFIT}
        width={Z.cardioEnd - Z.stairEnd}
        height={SKIRT - SOFFIT}
        fill="url(#px-roller)"
      />
      {/* weights: the dark accent wall, with a rubber kickplate a barbell has met */}
      {px(Z.cardioEnd, SOFFIT, Z.weightsEnd - Z.cardioEnd, SKIRT - SOFFIT, ACCENT.base)}
      <rect
        x={Z.cardioEnd}
        y={SOFFIT}
        width={Z.weightsEnd - Z.cardioEnd}
        height={SKIRT - SOFFIT}
        fill="url(#px-grain)"
      />
      {px(Z.cardioEnd, DADO, Z.weightsEnd - Z.cardioEnd, SKIRT - DADO, RUBBER.base)}
      {px(Z.cardioEnd, DADO, Z.weightsEnd - Z.cardioEnd, 1, RUBBER.hi)}
      <path
        d={pxPath([
          [948, DADO + 4, 14, 3],
          [966, DADO + 9, 9, 2],
          [1010, DADO + 6, 11, 2],
        ])}
        fill={RUBBER.deep}
      />
      {/* changing room: wet-room tile behind a solid wall */}
      {px(Z.weightsEnd, SOFFIT, W - Z.weightsEnd, SKIRT - SOFFIT, WETTILE.base)}
      <path
        d={pxPath(
          bank([[0, SOFFIT, 22, SKIRT - SOFFIT]], 10, 24).map(
            ([x, y, w, h]) => [x + Z.weightsEnd + 1, y, w, h] as Rect,
          ),
        )}
        fill={WETTILE.mid}
      />
      <path
        d={pxPath(
          bank([[0, SOFFIT, 22, 2]], 10, 24).map(
            ([x, y, w, h]) => [x + Z.weightsEnd + 1, y, w, h] as Rect,
          ),
        )}
        fill={WETTILE.hi}
      />
      <path d={STRIP_LOCKERS} fill={K.led3000} />
      {/* the partition between the floor and the changing room, with its doorway */}
      {px(Z.weightsEnd - 6, SOFFIT, 8, SKIRT - SOFFIT, WALLPAINT.lo)}
      {px(Z.weightsEnd - 6, SOFFIT, 2, SKIRT - SOFFIT, WALLPAINT.hi)}
      {px(Z.weightsEnd - 6, 96, 8, 50, ACCENT.deep)}
      {/* glass partitions between the other zones: frame, glass, manifestation dots */}
      {[Z.receptionEnd, Z.cardioEnd].map((x) => (
        <g key={`part${x}`}>
          {px(x - 3, SOFFIT, 6, SKIRT - SOFFIT, CHROME.lo)}
          {px(x - 3, SOFFIT, 2, SKIRT - SOFFIT, CHROME.hi)}
          <path d={pxPath(repeat(9, 12, [x - 1, 60, 2, 2] as Rect, "y"))} fill="#ffffff55" />
        </g>
      ))}
      {px(0, SKIRT, W, 4, COAT.base)}
      {px(0, SKIRT, W, 1, COAT.hi)}

      {/* --- the stair, which is how you get in and out ------------------ */}
      <Stair />
      {/* --- mirrors ----------------------------------------------------- */}
      <Bev set={MIRROR_CARDIO} mat={MIRROR} />
      <Bev set={MIRROR_WEIGHTS} mat={MIRROR} />
      <path d={MIRROR_CONTENT} fill={MIRROR.hi} opacity={0.7} />
      {/* the smears at hand height that a gym mirror always has */}
      <path
        d={pxPath([
          [452, 104, 18, 3],
          [612, 98, 12, 2],
          [806, 100, 20, 3],
          [900, 106, 14, 2],
        ])}
        fill="#ffffff"
        opacity={0.12}
      />
      {/* --- wall fittings ---------------------------------------------- */}
      <WallFittings ph={ph} s={s} />
    </g>
  );
}

/** The stair up from the lobby: treads, balustrade, and the way out. */
function Stair() {
  const treads: Rect[] = [];
  const risers: Rect[] = [];
  for (let i = 0; i < 6; i++) {
    treads.push([44 + i * 9, 150 - i * 5, 10, 2]);
    risers.push([44 + i * 9, 152 - i * 5, 10, 3]);
  }
  return (
    <g>
      {/* the void the stair comes up out of */}
      {px(38, 122, 66, 28, "#14171c")}
      <path d={pxPath(risers)} fill={PORCELAIN.lo} />
      <path d={pxPath(treads)} fill={PORCELAIN.hi} />
      <path d={pxPath(treads.map(([x, y, w]) => [x, y + 2, w, 1] as Rect))} fill={K.brand} />
      {/* glass balustrade with a steel handrail, which is the Alchemia detail */}
      {px(36, 96, 4, 54, CHROME.lo)}
      {px(100, 96, 4, 54, CHROME.lo)}
      <rect x={40} y={100} width={60} height={50} fill="#c2d6da" opacity={0.26} />
      {px(36, 96, 68, 3, CHROME.base)}
      {px(36, 96, 68, 1, CHROME.hi)}
      {/* the arrow on the newel post that tells you which way is out */}
      <path
        d={pxPath([
          [62, 104, 14, 2],
          [62, 102, 4, 6],
        ])}
        fill={COAT.base}
        opacity={0.7}
      />
    </g>
  );
}

function WallFittings({ ph, s }: { ph: Ph; s: GymState }) {
  return (
    <g>
      {/* --- entrance: poster, sanitiser, mat, the fire pictogram -------- */}
      <Bevel boxes={[[118, 58, 26, 36]]} mat={WALLPAINT} />
      {px(120, 60, 22, 32, K.brand)}
      {px(120, 60, 22, 10, K.brandLo)}
      <path
        d={pxPath([
          [124, 74, 14, 2],
          [124, 78, 10, 2],
          [124, 82, 12, 2],
        ])}
        fill="#ffffff88"
      />
      <Bevel boxes={[[154, 96, 10, 16]]} mat={SHROUD} />
      {px(156, 99, 6, 9, K.water)}
      {px(157, 112, 4, 3, SHROUD.lo)}
      {/* green running man, which never sleeps */}
      {px(20, 44, 20, 10, "#0d3d24")}
      {px(23, 46, 14, 6, K.green)}
      <path d={pxPath(steppedEllipse(30, 49, 12, 7, 2))} fill={dth("w", "12")} opacity={0.3} />
      {/* the entrance mat, which is always slightly wet */}
      {px(106, 152, 60, 8, COAT.mid)}
      {px(106, 152, 60, 1, COAT.hi)}
      <path d={pxPath(repeat(10, 6, [110, 154, 3, 5] as Rect))} fill={COAT.deep} />

      {/* --- reception: counter, screen, reader, shelf, board, cooler ---- */}
      <Reception s={s} />

      {/* --- cardio: TVs, fans, sanitiser station, towel bin ------------- */}
      <Bevel boxes={[[600, 58, 40, 24]]} mat={COAT} />
      {px(602, 60, 36, 20, s.tv === "off" ? K.screen : K.screenLit)}
      {s.tv !== "off" ? (
        <g>
          {/* news is a lower third; sport is a pitch and a scoreline */}
          {s.tv === "news" ? (
            <>
              {px(602, 74, 36, 6, "#c9382e")}
              <path d={pxPath([[605, 76, 20, 2]])} fill="#ffffff" opacity={0.8} />
            </>
          ) : (
            <>
              {px(604, 62, 32, 12, "#2f6a3e")}
              <path
                d={pxPath([
                  [604, 68, 32, 1],
                  [619, 62, 1, 12],
                ])}
                fill="#ffffff"
                opacity={0.4}
              />
              <PixelText x={606} y={76} text="2:1" fill="#ffffff" gap={0} />
            </>
          )}
          <rect x={602} y={60} width={36} height={20} fill="#a8ccff" opacity={0.06}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.06;0.11;0.05;0.09"
              dur="2.9s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {/* the wall fan nobody can agree about */}
      <Bevel boxes={[[688, 56, 18, 18]]} mat={SHROUD} />
      {px(690, 58, 14, 14, COAT.lo)}
      <path
        d={pxPath([
          [694, 58, 2, 14],
          [690, 64, 14, 2],
        ])}
        fill={CHROME.base}
        opacity={0.8}
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 697 65"
          to="360 697 65"
          dur="0.5s"
          repeatCount="indefinite"
        />
      </path>
      {/* the paper-towel-and-spray station, and the bin under it */}
      <Bevel boxes={[[716, 92, 14, 20]]} mat={SHROUD} />
      {px(718, 110, 10, 4, K.towel)}
      {px(732, 96, 6, 14, K.brand)}
      <Bevel boxes={[[714, 124, 18, 22]]} mat={COAT} />
      {px(716, 122, 14, 3, K.towel)}
      {px(718, 118, 9, 5, K.towelLo)}

      {/* --- weights: the speaker, the clock, the rules nobody reads ----- */}
      <Bevel boxes={[[772, 44, 14, 12]]} mat={COAT} />
      <path d={pxPath([[774, 46, 10, 8]])} fill={COAT.deep} />
      {s.music !== "off" ? (
        <path
          d={pxPath(steppedEllipse(779, 50, 12, 9, 2))}
          fill={dth("w", "12")}
          opacity={s.music === "loud" ? 0.4 : 0.22}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values={s.music === "loud" ? "0.4;0.18;0.4;0.24" : "0.22;0.12;0.22"}
            dur={s.music === "loud" ? "0.5s" : "1.1s"}
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the gym clock, which is the only clock in here and is four minutes fast */}
      <Bevel boxes={[[890, 44, 20, 14]]} mat={COAT} />
      {px(892, 46, 16, 10, "#0f1216")}
      <PixelText x={893} y={48} text={GYM_CLOCK[ph]} fill={K.red} gap={0} />
      {/* the laminated rules, curling at one corner */}
      {px(1010, 58, 20, 26, K.towel)}
      {px(1010, 58, 20, 4, K.brand)}
      <path
        d={pxPath([
          [1013, 66, 14, 1],
          [1013, 70, 11, 1],
          [1013, 74, 13, 1],
          [1013, 78, 8, 1],
        ])}
        fill={COAT.mid}
        opacity={0.6}
      />
      {px(1026, 80, 4, 4, WALLPAINT.hi)}

      {/* --- changing room: mirror, dryer, scale, shower doorway --------- */}
      <Lockers s={s} />
    </g>
  );
}

/** The hour on the wall clock. It is the only way to tell time in here. */
const GYM_CLOCK: Record<Ph, string> = {
  dawn: "6:34",
  day: "13:12",
  dusk: "19:04",
  night: "22:48",
};

function Reception({ s }: { s: GymState }) {
  const busy = s.reception === "busy";
  return (
    <g>
      {/* the wall behind the desk, in brand colour, with the name on it */}
      {px(220, 44, 150, 2, WALLPAINT.deep)}
      <path d={SIGNS.reception} fill={COAT.base} />
      <path d={SIGNS.hours} fill={COAT.mid} opacity={0.8} />
      {/* the price board, backlit, one line struck through */}
      <Bevel boxes={[[190, 68, 56, 30]]} mat={COAT} />
      {px(192, 70, 52, 26, "#12161b")}
      <path d={SIGNS.priceA} fill={K.towel} />
      <path d={SIGNS.priceB} fill={K.led4000} />
      <path d={SIGNS.priceC} fill={K.brandHi} />
      <path d={pxPath([[196, 84, 26, 1]])} fill={K.red} />
      {/* the counter: a solid-surface top on a graphite plinth */}
      <Bevel boxes={[[254, 100, 96, 6]]} mat={SHROUD} />
      <Bevel boxes={[[258, 106, 88, 40]]} mat={COAT} />
      {px(258, 106, 88, 2, K.brand)}
      <rect x={258} y={106} width={88} height={40} fill="url(#px-grain)" />
      {/* monitor, card reader, a bowl of hair ties, a tub of protein */}
      <Bevel boxes={[[296, 82, 26, 18]]} mat={COAT} />
      {px(298, 84, 22, 14, s.reception === "away" ? K.screen : K.screenLit)}
      {s.reception !== "away" ? (
        <path
          d={pxPath([
            [300, 86, 14, 2],
            [300, 90, 18, 2],
            [300, 94, 9, 2],
          ])}
          fill="#ffffff44"
        />
      ) : null}
      <Bevel boxes={[[330, 92, 10, 8]]} mat={SHROUD} />
      <path d={pxPath([[332, 94, 6, 2]])} fill={busy ? K.green : K.amber} />
      {px(266, 94, 10, 6, SHROUD.base)}
      {px(266, 94, 10, 1, SHROUD.hi)}
      <Bevel boxes={[[278, 88, 10, 12]]} mat={{ ...COAT, base: K.brand, hi: K.brandHi }} />
      {/* the shop shelf: shakers, bars, drinks, and the bananas by the till */}
      <Bevel boxes={[[288, 58, 46, 4]]} mat={SHROUD} />
      <path
        d={pxPath([
          [292, 48, 7, 10],
          [301, 50, 7, 8],
          [310, 47, 6, 11],
          [318, 51, 7, 7],
        ])}
        fill={K.brand}
      />
      <path
        d={pxPath([
          [292, 48, 7, 2],
          [301, 50, 7, 2],
          [310, 47, 6, 2],
          [318, 51, 7, 2],
        ])}
        fill={K.brandHi}
      />
      <path d={pxPath(repeat(5, 6, [290, 64, 4, 3] as Rect))} fill="#c9a24b" />
      {/* the water cooler, and what is left in the bottle */}
      <Bevel boxes={[[376, 104, 20, 42]]} mat={SHROUD} />
      {px(378, 84, 16, 20, "#b6c9d2")}
      {s.water !== "empty" ? (
        <g>
          {px(378, s.water === "full" ? 86 : 94, 16, s.water === "full" ? 18 : 10, K.water)}
          {px(378, s.water === "full" ? 86 : 94, 16, 1, "#bfe0f5")}
        </g>
      ) : null}
      <path
        d={pxPath([
          [382, 118, 8, 3],
          [384, 121, 3, 4],
        ])}
        fill={CHROME.base}
      />
      <path d={pxPath([[380, 112, 4, 3]])} fill={K.red} />
      <path d={pxPath([[388, 112, 4, 3]])} fill={K.water} />
      {/* the stack of cups, and the one on the floor that missed the bin */}
      {px(398, 100, 5, 8, K.towel)}
      {s.crowd >= 2 ? px(404, 146, 5, 4, K.towelLo) : null}
      {/* the turnstile: a waist-high tripod, and the light that tells you no */}
      <Turnstile stage={s.turnstile} />
      {/* the bench by the door where people sit to change their shoes */}
      <Bevel boxes={[[212, 128, 44, 5]]} mat={M.oak} />
      <path
        d={pxPath([
          [216, 133, 4, 14],
          [248, 133, 4, 14],
        ])}
        fill={COAT.base}
      />
      {s.crowd >= 1 ? (
        <g>
          {px(220, 122, 16, 7, K.jersey)}
          {px(220, 122, 16, 2, K.jerseyHi)}
          {px(238, 124, 10, 5, COAT.hi)}
        </g>
      ) : null}
    </g>
  );
}

function Turnstile({ stage }: { stage: TurnstileStage }) {
  const open = stage === "open";
  return (
    <g>
      {/* the pedestal */}
      <Bevel boxes={[[330, 112, 14, 34]]} mat={COAT} />
      {px(330, 112, 14, 2, CHROME.lo)}
      {/* the reader, and its verdict */}
      <path
        d={pxPath([[333, 116, 8, 5]])}
        fill={stage === "locked" ? K.red : K.green}
        style={{ transition: STEP_FADE }}
      />
      {/* three arms, and they turn a third of a revolution when you are let through */}
      <g
        style={{
          transition: STEP_SLIDE,
          transform: open ? "rotate(40deg)" : "none",
          transformOrigin: "337px 112px",
        }}
      >
        <path
          d={pxPath([
            [318, 110, 20, 3],
            [337, 110, 20, 3],
            [336, 112, 3, 16],
          ])}
          fill={CHROME.base}
        />
        <path
          d={pxPath([
            [318, 110, 20, 1],
            [337, 110, 20, 1],
          ])}
          fill={CHROME.hi}
        />
      </g>
      {/* the glass wing that stops you walking round it */}
      <rect x={344} y={108} width={4} height={38} fill="#c2d6da" opacity={0.3} />
      {px(344, 108, 4, 2, CHROME.lo)}
    </g>
  );
}

/** Which doors are open, and in which order, so the frame never flickers. */
const OPEN_ORDER = [3, 11, 6] as const;

function Lockers({ s }: { s: GymState }) {
  const openIdx = OPEN_ORDER.slice(0, s.lockers);
  return (
    <g>
      <Bev set={LOCKERS_SET} mat={SHROUD} />
      <path d={LOCKER_VENTS} fill={SHROUD.deep} opacity={0.7} />
      <path d={LOCKER_HANDLES} fill={COAT.base} />
      <path d={LOCKER_NUMBERS} fill={COAT.mid} opacity={0.75} />
      {/* the doors that are open, the dark inside them, and what is in there */}
      {openIdx.map((i) => {
        const [x, y] = LOCKER_DOORS[i];
        return (
          <g key={`op${i}`}>
            {px(x, y, 15, 40, "#15181c")}
            {px(x + 1, y + 1, 13, 38, "#1d2126")}
            {/* the door itself, swung back against its neighbour */}
            <g
              style={{
                transform: "scaleX(0.22)",
                transformOrigin: `${x + 15}px ${y}px`,
              }}
            >
              <Bevel boxes={[[x, y, 15, 40]]} mat={SHROUD} />
            </g>
            {i === 3 ? (
              <g>
                {/* a bag with a strap out of the door, which is why it will not shut */}
                {px(x + 2, y + 24, 11, 12, K.jersey)}
                {px(x + 2, y + 24, 11, 2, K.jerseyHi)}
                {px(x + 10, y + 34, 8, 2, K.jersey)}
              </g>
            ) : (
              <g>
                {px(x + 4, y + 6, 7, 18, K.vest)}
                {px(x + 4, y + 6, 7, 2, K.vestHi)}
                {px(x + 3, y + 30, 9, 6, COAT.hi)}
              </g>
            )}
          </g>
        );
      })}
      {/* a padlock left on one door, and the key that is not in it */}
      {s.lockers >= 1 ? (
        <path
          d={pxPath([
            [LOCKER_X + 30, 122, 5, 5],
            [LOCKER_X + 31, 119, 3, 3],
          ])}
          fill={M.brass.base}
        />
      ) : null}
      {/* the bench, the mirror, the dryer, the scale */}
      <Bevel boxes={[[1150, 128, 60, 5]]} mat={M.oak} />
      <path
        d={pxPath([
          [1154, 133, 4, 14],
          [1202, 133, 4, 14],
        ])}
        fill={COAT.base}
      />
      <path d={pxPath(repeat(6, 10, [1152, 129, 8, 1] as Rect))} fill={M.oak.lo} />
      {s.crowd >= 2 ? (
        <g>
          {px(1162, 122, 18, 7, K.towel)}
          {px(1162, 122, 18, 2, "#f4f0e4")}
          {px(1184, 124, 12, 5, K.jersey)}
        </g>
      ) : null}
      <Bevel boxes={[[1148, 62, 44, 44]]} mat={MIRROR} />
      {px(1152, 66, 36, 36, MIRROR.hi)}
      {px(1152, 66, 36, 8, MIRROR.base)}
      <Bevel boxes={[[1200, 74, 12, 16]]} mat={SHROUD} />
      {px(1202, 90, 8, 4, SHROUD.lo)}
      {/* the scale, and the digits it is showing nobody */}
      <Bevel boxes={[[1190, 140, 18, 8]]} mat={CHROME} />
      {px(1194, 142, 10, 4, "#12161b")}
      <PixelText x={1195} y={143} text="88" fill={K.led4000} gap={0} op={0.6} />
      {/* the doorway to the showers, and the light coming out of it */}
      {px(1218, 60, 22, 86, "#12161b")}
      {px(1218, 60, 22, 2, WETTILE.deep)}
      {px(1218, 60, 2, 86, WETTILE.lo)}
      {s.shower !== "off" ? (
        <g>
          <path
            d={pxPath(steppedQuad(60, 1220, 1240, 150, 1214, 1240, 10))}
            fill={dth("c", "25")}
            opacity={0.4}
          />
          {/* and the water on the floor coming out with it */}
          <path d={pxPath(steppedEllipse(1224, 156, 16, 5, 2))} fill={K.water} opacity={0.3} />
        </g>
      ) : null}
      {/* the hairdryer nobody uses and the bin everybody does */}
      <Bevel boxes={[[1132, 128, 14, 18]]} mat={COAT} />
      {px(1134, 126, 10, 3, K.towel)}
      {px(1136, 122, 7, 5, K.towelLo)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the floors
 * ================================================================== */

function Ground({ s }: { s: GymState }) {
  return (
    <g>
      {/* one floor per zone, and they meet on hard lines because they were laid
          by four different trades on four different days */}
      {px(0, FLOOR, Z.stairEnd, H - FLOOR, PORCELAIN.deep)}
      <path d={FLOOR_ENTRY.face} fill={PORCELAIN.base} />
      <path d={FLOOR_ENTRY.hi} fill={PORCELAIN.hi} />
      {px(Z.stairEnd, FLOOR, Z.receptionEnd - Z.stairEnd, H - FLOOR, PORCELAIN.deep)}
      <path d={FLOOR_RECEPTION.face} fill={PORCELAIN.mid} />
      <path d={FLOOR_RECEPTION.hi} fill={PORCELAIN.hi} />
      {px(Z.receptionEnd, FLOOR, Z.cardioEnd - Z.receptionEnd, H - FLOOR, VINYL.deep)}
      <path d={FLOOR_CARDIO.face} fill={VINYL.base} />
      <path d={FLOOR_CARDIO.hi} fill={VINYL.hi} />
      <rect
        x={Z.receptionEnd}
        y={FLOOR}
        width={Z.cardioEnd - Z.receptionEnd}
        height={H - FLOOR}
        fill="url(#px-wood)"
      />
      {px(Z.cardioEnd, FLOOR, Z.weightsEnd - Z.cardioEnd, H - FLOOR, RUBBER.deep)}
      <path d={FLOOR_WEIGHTS.face} fill={RUBBER.base} />
      <path d={FLOOR_WEIGHTS.hi} fill={RUBBER.hi} />
      <rect
        x={Z.cardioEnd}
        y={FLOOR}
        width={Z.weightsEnd - Z.cardioEnd}
        height={H - FLOOR}
        fill="url(#px-agg)"
      />
      {px(Z.weightsEnd, FLOOR, W - Z.weightsEnd, H - FLOOR, WETTILE.deep)}
      <path d={FLOOR_LOCKERS.face} fill={WETTILE.base} />
      <path d={FLOOR_LOCKERS.hi} fill={WETTILE.hi} />
      {/* the lifting platform, which is timber and sounds completely different */}
      <path d={PLATFORM_D} fill={M.oak.lo} />
      <path d={PLATFORM_BOARDS} fill={M.oak.base} />
      <path d={pxPath([[936, 150, 88, 2]])} fill={M.oak.hi} />
      <path d={SIGNS.platformMark} fill={M.oak.deep} opacity={0.55} />
      {/* the drop marks on the rubber either side of it, from years of bars */}
      <path
        d={pxPath([
          [928, 158, 6, 3],
          [1026, 160, 7, 3],
          [922, 168, 5, 2],
        ])}
        fill={RUBBER.deep}
        opacity={0.8}
      />
      {/* chalk trodden out of the weights hall and halfway across the cardio floor */}
      <path
        d={pxPath([
          [900, 172, 12, 2],
          [862, 166, 8, 2],
          [820, 174, 9, 2],
          [744, 170, 6, 2],
        ])}
        fill={K.chalk}
        opacity={0.28}
      />
      {/* the mopped sheen and the sign that goes with it */}
      {s.cleaning ? (
        <g>
          <path
            d={pxPath(steppedQuad(FLOOR + 4, 470, 700, H, 440, 730, 8))}
            fill={dth("c", "12")}
            opacity={0.45}
          />
          <Bevel boxes={[[586, 128, 16, 22]]} mat={M.enamel} />
          {px(600, 130, 4, 20, M.enamel.lo)}
          {px(591, 132, 5, 10, COAT.base)}
          {px(590, 144, 8, 2, COAT.base)}
        </g>
      ) : null}
      <Contact set={FLOOR_CONTACT} />
      <AOSet set={SHELL_AO} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — the equipment
 * ================================================================== */

function Cardio({ s }: { s: GymState }) {
  return (
    <g>
      {/* --- four treadmills, one shape banked four ways ----------------- */}
      <path d={TREADMILLS.upright} fill={COAT.base} />
      <Bev set={TREADMILLS.deck} mat={SHROUD} />
      <path d={TREADMILLS.belt} fill={COAT.deep} />
      <Bev set={TREADMILLS.console} mat={SHROUD} />
      <path d={TREADMILLS.bar} fill={COAT.mid} />
      <path d={TREADMILLS.foot} fill={COAT.lo} />
      {TREAD_SCREENS.map((d, i) => {
        const running = i < s.cardio;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: treadmill screens are positional
          <g key={`ts${i}`}>
            <path d={d} fill={running ? K.screenLit : K.screen} style={{ transition: STEP_FADE }} />
            {running ? (
              <>
                {/* the belt, moving, and the numbers going up */}
                <path d={TREAD_LINES[i]} fill={COAT.mid}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;5 0"
                    dur="0.22s"
                    repeatCount="indefinite"
                  />
                </path>
                <PixelText
                  x={TREAD_X + i * TREAD_PITCH + 8}
                  y={87}
                  text={["9.5", "12.0", "8.0", "10.5"][i]}
                  fill={K.green}
                  gap={0}
                />
              </>
            ) : null}
          </g>
        );
      })}
      {/* --- three bikes ------------------------------------------------- */}
      <path d={BIKES.frame} fill={COAT.base} />
      <path d={BIKES.wheel} fill={CASTIRON.base} />
      <path d={BIKES.saddle} fill={COAT.hi} />
      <path d={BIKES.bars} fill={CHROME.base} />
      <path d={BIKES.crank} fill={CHROME.lo}>
        {s.cardio >= 3 ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 668 132"
            to="360 668 132"
            dur="1.1s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      {/* a towel left over the bars of the middle bike, and a bottle in the cage */}
      {s.crowd >= 1 ? (
        <g>
          {px(690, 82, 14, 10, K.towel)}
          {px(690, 82, 14, 2, "#f4f0e4")}
          {px(700, 108, 5, 12, K.water)}
          {px(700, 108, 5, 2, "#bfe0f5")}
        </g>
      ) : null}
      {/* the stretching mats, rolled and stacked, one unrolled on the floor */}
      <path
        d={pxPath([
          [560, 116, 8, 30],
          [570, 116, 8, 30],
          [580, 118, 8, 28],
        ])}
        fill={K.brand}
      />
      <path
        d={pxPath([
          [560, 116, 8, 2],
          [570, 116, 8, 2],
          [580, 118, 8, 2],
        ])}
        fill={K.brandHi}
      />
      {s.crowd >= 2 ? (
        <g>
          {px(510, 168, 44, 5, K.brandLo)}
          {px(510, 168, 44, 1, K.brand)}
        </g>
      ) : null}
    </g>
  );
}

function Weights({ s }: { s: GymState }) {
  const loaded = s.rack !== "empty";
  const platLoaded = s.platform !== "clear";
  return (
    <g>
      {/* --- the pull-up and dip frame at the near end ------------------- */}
      <Bevel
        boxes={[
          [730, 60, 5, 86],
          [762, 60, 5, 86],
          [730, 60, 37, 5],
        ]}
        mat={COAT}
      />
      <path d={pxPath([[734, 66, 30, 3]])} fill={CHROME.base} />
      <path
        d={pxPath([
          [734, 92, 8, 3],
          [756, 92, 8, 3],
        ])}
        fill={CHROME.lo}
      />
      {/* the resistance band somebody left knotted round the bar */}
      {px(742, 68, 3, 22, "#3ddc84")}
      {px(742, 68, 3, 1, "#7ff0a8")}

      {/* --- plate trees, both of them ---------------------------------- */}
      <path d={TREES.base} fill={COAT.base} />
      <path d={TREES.post} fill={COAT.mid} />
      <path d={TREES.pegs} fill={CHROME.lo} />
      {/* the plates on the pegs: near tree full, far tree raided */}
      <path
        d={pxPath([
          [750, 100, 6, 6],
          [750, 112, 6, 6],
          [761, 100, 6, 6],
          [761, 112, 6, 6],
          [750, 124, 6, 5],
          [1002, 100, 6, 6],
          [1013, 100, 6, 6],
          [1002, 112, 6, 5],
        ])}
        fill={CASTIRON.base}
      />
      <path
        d={pxPath([
          [750, 100, 6, 1],
          [750, 112, 6, 1],
          [761, 100, 6, 1],
          [761, 112, 6, 1],
          [1002, 100, 6, 1],
          [1013, 100, 6, 1],
        ])}
        fill={CASTIRON.hi}
      />

      {/* --- the power rack --------------------------------------------- */}
      <Bev set={RACK_SET} mat={COAT} />
      <path d={RACK_HOLES} fill={COAT.deep} />
      <path d={RACK_HOLES2} fill={COAT.deep} />
      {/* the J-hooks, set for somebody a head shorter than the last person */}
      <path
        d={pxPath([
          [774, 100, 10, 3],
          [826, 100, 10, 3],
        ])}
        fill={COAT.hi}
      />
      {loaded ? (
        <g>
          {/* the bar in the hooks, and what is on it */}
          <path d={pxPath([[768, 98, 74, 3]])} fill={CHROME.base} />
          <path d={pxPath([[768, 98, 74, 1]])} fill={CHROME.hi} />
          <path
            d={pxPath([
              [768, 90, 5, 20],
              [774, 92, 4, 16],
              [832, 90, 5, 20],
              [838, 92, 4, 16],
            ])}
            fill={CASTIRON.base}
          />
          <path
            d={pxPath([
              [768, 90, 5, 2],
              [832, 90, 5, 2],
            ])}
            fill={CASTIRON.hi}
          />
          {/* the collars, one of which is on backwards */}
          <path
            d={pxPath([
              [779, 96, 3, 7],
              [828, 96, 3, 7],
            ])}
            fill={K.brand}
          />
        </g>
      ) : (
        /* empty: the bar is on the floor of the rack, which annoys everybody */
        <g>
          <path d={pxPath([[772, 142, 66, 3]])} fill={CHROME.lo} />
          <path d={pxPath([[772, 142, 66, 1]])} fill={CHROME.base} />
        </g>
      )}
      {/* the safeties, and the mat inside the rack */}
      <path d={pxPath([[776, 122, 58, 3]])} fill={COAT.hi} opacity={0.9} />
      {px(780, 146, 50, 4, RUBBER.mid)}

      {/* --- the bench press -------------------------------------------- */}
      <Bev set={BENCH_UPRIGHT} mat={COAT} />
      <Bev set={BENCH_SET} mat={COAT} />
      {px(862, 122, 46, 2, COAT.hi)}
      <rect x={862} y={122} width={46} height={5} fill="url(#px-weave)" />
      {s.crowd >= 3 ? null : (
        <g>
          {/* the bar racked, with a single plate a side, which tells its own story */}
          <path d={pxPath([[850, 98, 70, 3]])} fill={CHROME.base} />
          <path
            d={pxPath([
              [850, 92, 4, 15],
              [916, 92, 4, 15],
            ])}
            fill={CASTIRON.base}
          />
        </g>
      )}

      {/* --- the platform, the deadlift bar, the chalk ------------------- */}
      {platLoaded ? (
        <g>
          <path d={pxPath([[932, 140, 96, 3]])} fill={CHROME.base} />
          <path d={pxPath([[932, 140, 96, 1]])} fill={CHROME.hi} />
          {/* four plates a side, on the floor, which is where a deadlift starts */}
          <path
            d={pxPath([
              [932, 126, 6, 24],
              [939, 128, 5, 20],
              [1016, 126, 6, 24],
              [1023, 128, 5, 20],
            ])}
            fill={CASTIRON.base}
          />
          <path
            d={pxPath([
              [932, 126, 6, 2],
              [1016, 126, 6, 2],
            ])}
            fill={CASTIRON.hi}
          />
          <path
            d={pxPath([
              [932, 136, 6, 2],
              [1016, 136, 6, 2],
            ])}
            fill={K.brandLo}
          />
        </g>
      ) : null}
      {/* the chalk bowl, and the cloud of it if somebody has just been in it */}
      <Bevel boxes={[[920, 138, 14, 10]]} mat={COAT} />
      {px(922, 136, 10, 3, K.chalk)}
      {s.platform === "chalked" ? (
        <g>
          <path
            d={pxPath(steppedEllipse(927, 130, 16, 8, 2))}
            fill={dth("c", "12")}
            opacity={0.45}
          />
          <path
            d={pxPath([
              [944, 148, 10, 2],
              [1000, 148, 8, 2],
            ])}
            fill={K.chalk}
            opacity={0.5}
          />
        </g>
      ) : null}

      {/* --- the dumbbell rack, and the pairs that are not on it -------- */}
      <Bev set={DB_RACK} mat={COAT} />
      <path d={DB_PARTIAL[s.dumbbells][0]} fill={CASTIRON.base} />
      <path d={DB_PARTIAL[s.dumbbells][1]} fill={CASTIRON.base} />
      {/* the missing pairs, on the floor where they were put down */}
      {s.dumbbells >= 1 ? (
        <path
          d={pxPath([
            [1036, 142, 4, 7],
            [1040, 144, 3, 3],
            [1043, 142, 4, 7],
          ])}
          fill={CASTIRON.base}
        />
      ) : null}
      {s.dumbbells >= 2 ? (
        <path
          d={pxPath([
            [880, 160, 4, 7],
            [884, 162, 3, 3],
            [887, 160, 4, 7],
            [896, 162, 4, 7],
            [900, 164, 3, 3],
            [903, 162, 4, 7],
          ])}
          fill={CASTIRON.base}
        />
      ) : null}
      {s.dumbbells >= 3 ? (
        <path
          d={pxPath([
            [772, 164, 4, 7],
            [776, 166, 3, 3],
            [779, 164, 4, 7],
          ])}
          fill={CASTIRON.base}
        />
      ) : null}
      {/* kettlebells in a row, descending, one out of order */}
      <path
        d={pxPath([
          [956, 138, 10, 10],
          [958, 133, 6, 5],
          [970, 140, 9, 8],
          [972, 136, 5, 4],
          [982, 142, 8, 7],
          [984, 138, 4, 4],
        ])}
        fill={CASTIRON.base}
      />
      <path
        d={pxPath([
          [956, 138, 10, 2],
          [970, 140, 9, 2],
          [982, 142, 8, 2],
        ])}
        fill={CASTIRON.hi}
      />
      {/* the foam roller and the bench nobody has put back */}
      {px(1024, 168, 22, 6, K.brandLo)}
      {px(1024, 168, 22, 1, K.brand)}
      {/* a water bottle and a phone face-down on the rubber */}
      {s.crowd >= 2 ? (
        <g>
          {px(844, 138, 5, 12, K.water)}
          {px(844, 138, 5, 2, "#bfe0f5")}
          {px(852, 146, 8, 4, COAT.base)}
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 5 — the people
 * ================================================================== */

/**
 * Five figures, all built from the same 22x54 armature the corridor's Natalia
 * uses: head at the top, torso 24 tall, legs 16, and exactly one moving group
 * per person. Nobody gets two animations. The heads are at different heights on
 * purpose — a gym is the one room where everybody is a different size.
 */
// The hand-drawn Kasia, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Kasia({ s }: { s: GymState }) {
  const busy = s.reception === "busy";
  return (
    <g>
      {/* behind the counter, so only the top half of her is in frame */}
      {px(300, 66, 13, 5, "#2f2318")}
      {px(299, 70, 15, 4, "#3a2c1e")}
      {px(310, 70, 5, 12, "#2f2318")}
      {px(301, 74, 11, 9, K.skin)}
      {px(301, 80, 11, 3, K.skinLo)}
      <path
        d={pxPath([
          [303, 76, 2, 2],
          [308, 76, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(305, 81, 3, 1, "#b08668")}
      {/* the branded polo, and the lanyard */}
      {px(298, 84, 17, 18, K.polo)}
      {px(298, 84, 17, 2, K.poloHi)}
      {px(305, 86, 3, 10, K.brand)}
      {px(303, 96, 7, 4, K.towel)}
      {/* the arm that moves: either typing, or handing something over */}
      <g>
        {px(314, 88, 4, 10, K.polo)}
        {px(315, 96, 4, 5, K.skin)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={busy ? "0 316 90;-16 316 90;4 316 90;0 316 90" : "0 316 90;-5 316 90;0 316 90"}
          dur={busy ? "2.4s" : "7.5s"}
          repeatCount="indefinite"
        />
      </g>
      {px(294, 88, 4, 12, K.polo)}
      {px(294, 98, 4, 4, K.skin)}
    </g>
  );
}

/** On treadmill two, at 12.0, and he has been there twenty minutes. */
// The hand-drawn Runner, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Runner() {
  const x = TREAD_X + TREAD_PITCH + 12;
  return (
    <g>
      {px(x + 2, 60, 11, 4, "#2f2318")}
      {px(x + 1, 63, 13, 4, "#3a2c1e")}
      {px(x + 2, 67, 11, 9, K.skin)}
      {px(x + 2, 73, 11, 3, K.skinLo)}
      <path
        d={pxPath([
          [x + 4, 69, 2, 2],
          [x + 9, 69, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {/* vest, and the headphone band */}
      {px(x, 77, 15, 20, K.vest)}
      {px(x, 77, 15, 2, K.vestHi)}
      {px(x + 1, 62, 13, 2, COAT.base)}
      {px(x, 61, 3, 5, COAT.base)}
      {px(x + 12, 61, 3, 5, COAT.base)}
      {/* arms, held the way a man holds them when he is not really sprinting */}
      {px(x - 3, 80, 4, 12, K.skin)}
      {px(x + 14, 80, 4, 12, K.skin)}
      {/* the legs, which are the only thing that moves */}
      <g>
        {px(x + 1, 97, 5, 16, K.shortsA)}
        {px(x + 1, 111, 5, 12, K.skin)}
        {px(x, 123, 8, 5, K.towel)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`-14 ${x + 3} 99;16 ${x + 3} 99;-14 ${x + 3} 99`}
          dur="0.62s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        {px(x + 8, 97, 5, 16, K.shortsA)}
        {px(x + 8, 111, 5, 12, K.skin)}
        {px(x + 7, 123, 8, 5, K.towel)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`16 ${x + 10} 99;-14 ${x + 10} 99;16 ${x + 10} 99`}
          dur="0.62s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** Under the near rack, and he is on his last set, which is why it is slow. */
// The hand-drawn Lifter, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Lifter() {
  const x = 792;
  return (
    <g>
      <g>
        {/* the whole man dips, because that is what a squat is */}
        {px(x + 2, 74, 12, 4, "#241c14")}
        {px(x + 2, 78, 12, 9, K.skin)}
        {px(x + 2, 84, 12, 3, K.skinLo)}
        <path
          d={pxPath([
            [x + 4, 80, 2, 2],
            [x + 10, 80, 2, 2],
          ])}
          fill="#3d2a1a"
        />
        {px(x + 5, 85, 4, 1, "#8a5a4a")}
        {/* the beard that every man under a squat bar has */}
        {px(x + 3, 86, 10, 3, "#241c14")}
        {/* singlet and a belt */}
        {px(x, 89, 16, 22, K.shortsB)}
        {px(x, 89, 16, 2, "#4a525a")}
        {px(x, 105, 16, 5, M.oak.lo)}
        {px(x, 105, 16, 1, M.oak.base)}
        {/* the arms up on the bar */}
        {px(x - 4, 92, 5, 8, K.skin)}
        {px(x + 15, 92, 5, 8, K.skin)}
        {/* legs, thick, and the shoes with the heel */}
        {px(x + 1, 111, 6, 22, K.shortsA)}
        {px(x + 9, 111, 6, 22, K.shortsA)}
        {px(x, 133, 8, 6, COAT.base)}
        {px(x + 8, 133, 8, 6, COAT.base)}
        {px(x, 139, 16, 3, COAT.deep)}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 14;0 14;0 0;0 0"
          keyTimes="0;0.3;0.4;0.75;1"
          dur="5.2s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** On the bench, with a spotter who is not really watching. */
function BenchPair() {
  return (
    <g>
      {/* the lifter, on his back, which is a completely different silhouette */}
      {px(866, 112, 24, 10, K.jersey)}
      {px(866, 112, 24, 2, K.jerseyHi)}
      {px(890, 114, 10, 8, K.skin)}
      {px(893, 116, 2, 2, "#3d2a1a")}
      {px(858, 114, 9, 8, K.shortsA)}
      {px(852, 116, 8, 6, K.skin)}
      {/* the bar, coming down and going up, and it is the only thing moving */}
      <g>
        <path d={pxPath([[850, 104, 70, 3]])} fill={CHROME.base} />
        <path d={pxPath([[850, 104, 70, 1]])} fill={CHROME.hi} />
        <path
          d={pxPath([
            [848, 96, 5, 18],
            [854, 98, 4, 14],
            [914, 96, 5, 18],
            [920, 98, 4, 14],
          ])}
          fill={CASTIRON.base}
        />
        <path
          d={pxPath([
            [870, 100, 6, 10],
            [890, 100, 6, 10],
          ])}
          fill={K.skin}
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 8;0 8;0 0;0 0"
          keyTimes="0;0.34;0.42;0.8;1"
          dur="3.8s"
          repeatCount="indefinite"
        />
      </g>
      {/* the spotter, standing at the head of the bench, on his phone */}
      {px(838, 74, 12, 4, "#3a2c1e")}
      {px(838, 78, 12, 9, K.skin)}
      {px(838, 84, 12, 3, K.skinLo)}
      {px(836, 89, 16, 22, K.vest)}
      {px(836, 89, 16, 2, K.vestHi)}
      {px(837, 111, 6, 20, K.shortsA)}
      {px(845, 111, 6, 20, K.shortsA)}
      {px(836, 131, 8, 5, K.towel)}
      {px(844, 131, 8, 5, K.towel)}
      {px(850, 92, 4, 10, K.skin)}
      {px(852, 96, 4, 6, COAT.base)}
    </g>
  );
}

/** In front of the mirror, curling, and he is the reason the mirror is there. */
function Curler() {
  const x = 1014;
  return (
    <g>
      {px(x + 2, 72, 12, 4, "#241c14")}
      {px(x + 2, 76, 12, 9, K.skin)}
      {px(x + 2, 82, 12, 3, K.skinLo)}
      <path
        d={pxPath([
          [x + 4, 78, 2, 2],
          [x + 10, 78, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(x, 87, 16, 22, K.towel)}
      {px(x, 87, 16, 2, "#f4f0e4")}
      {px(x + 1, 109, 6, 22, K.shortsB)}
      {px(x + 9, 109, 6, 22, K.shortsB)}
      {px(x, 131, 8, 5, COAT.base)}
      {px(x + 8, 131, 8, 5, COAT.base)}
      {/* the arm and the dumbbell, and nothing else about him moves at all */}
      <g>
        {px(x - 4, 90, 5, 16, K.skin)}
        <path
          d={pxPath([
            [x - 8, 104, 4, 8],
            [x - 4, 106, 3, 4],
            [x - 1, 104, 4, 8],
          ])}
          fill={CASTIRON.base}
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x - 2} 92;-64 ${x - 2} 92;0 ${x - 2} 92`}
          dur="2.9s"
          repeatCount="indefinite"
        />
      </g>
      {px(x + 15, 90, 5, 14, K.skin)}
    </g>
  );
}

function People({ s }: { s: GymState }) {
  const who = whoIsHere(s);
  return (
    <g>
      {/* Kasia, the runner and the lifter are NpcActors in Effects now */}
      {who.benchPair ? <BenchPair /> : null}
      {who.curler ? <Curler /> : null}
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function GymScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world);
  return (
    <LayeredScene
      /* thirty metres of car park; it should lag hard */
      parallax={{ farBackground: 0.82, middleBackground: 1 }}
      farBackground={<Outside ph={ph} />}
      middleBackground={<Shell ph={ph} s={s} />}
      ground={<Ground s={s} />}
      staticObjects={
        <g>
          <Cardio s={s} />
          <Weights s={s} />
        </g>
      }
      gameplayObjects={<People s={s} />}
    />
  );
}

/* ================================================================== *
 * foreground
 * ================================================================== */

function GymFront({ world }: { world?: WorldState; phase?: string }) {
  const s = world ? state(world) : null;
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
        {/* the underside of the bulkhead, closing the top of the frame */}
        {px(0, 0, W, 10, WALLPAINT.deep)}
        <path d={pxPath([[0, 10, W, 4]])} fill={dth("n", "25")} opacity={0.5} />
        {/* the top two treads of the stair, coming up into frame at the left */}
        {px(0, 158, 40, 4, PORCELAIN.base)}
        {px(0, 158, 40, 1, PORCELAIN.hi)}
        {px(0, 162, 40, 5, PORCELAIN.lo)}
        {px(0, 166, 34, 4, PORCELAIN.base)}
        {px(0, 166, 34, 1, K.brand)}
        {/* near floor edge */}
        {px(0, H - 5, W, 5, RUBBER.deep)}
        {px(0, H - 5, W, 1, RUBBER.lo)}
        {/* steam drifting out of the changing-room doorway, very near the lens */}
        {s && s.shower === "steam" ? (
          <rect x={1120} y={0} width={120} height={H} fill={dth("c", "06")} opacity={0.6} />
        ) : null}
        <Vignette set={VIGNETTE} strength={0.7} />
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

const KASIA_LINES = [
  "Karnet wygasł w marcu, ale niech pan wejdzie.",
  "Trzecia osoba dzisiaj pyta o saunę. Nie ma sauny.",
  "O dwudziestej pierwszej gaszę światło na siłowni. Serio.",
  "Ktoś znowu zabrał hantle do szatni. Po co.",
  "Pan Krzysiek, tak? Widzę pana częściej niż własną siostrę.",
] as const;

const LIFTER_LINES = [
  "Jeszcze jedna seria. Ostatnia. Naprawdę.",
  "Kto zabrał dwudziestki. Kto.",
  "W poniedziałek klata, dziś nogi. System.",
  "Nie patrz na mnie, patrz na sztangę.",
] as const;

/**
 * A colour cast only, and only over the left end of the room. `darkness()`
 * returns zero here — a commercial gym is never dark — so this is the entire
 * contribution the hour makes, and it stops at x≈420.
 */
const CAST: Record<Ph, { fill: string; op: number }> = {
  dawn: { fill: "#8f8ab0", op: 0.12 },
  day: { fill: "#cadfe8", op: 0.07 },
  dusk: { fill: "#c46a3a", op: 0.13 },
  night: { fill: "#101822", op: 0.2 },
};
const CAST_MASK = pxPath(steppedQuad(0, 0, 420, H, 0, 340, 12));

function GymEffects({
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
  const wash = DAY_WASH[ph];
  return (
    <>
      {/* reception, the treadmill and the rack — all built people now */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {who.kasia ? (
          <NpcActor
            npc={NPCS.kasia}
            x={302}
            facing={1}
            /* the reception top is at y=100; nothing below it is visible */
            cropBelow={102}
          />
        ) : null}
        {who.runner ? (
          /* treadmill two — his feet are on the belt, not on the floor */
          <NpcActor
            npc={NPCS.runner}
            x={TREAD_X + TREAD_PITCH + 23}
            y={TREAD_BELT}
            facing={1}
            shadow={false}
          />
        ) : null}
        {who.lifter ? <NpcActor npc={NPCS.lifter} x={802} facing={-1} /> : null}
      </svg>
      {who.kasia ? (
        <NpcMonologue
          x={306}
          headY={72}
          scale={scale}
          speaker="Kasia"
          lines={KASIA_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {who.lifter ? (
        <NpcMonologue
          x={798}
          headY={76}
          scale={scale}
          speaker="Siłacz"
          lines={LIFTER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {/* steam out of the showers, and the smell of chlorine you cannot draw */}
      {s.shower !== "off" ? <Steam x={1222} y={70} scale={scale} /> : null}
      {s.shower === "steam" ? <Steam x={1206} y={54} scale={scale} slow /> : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* the hour, and it only reaches the first third of the room */}
          <path
            d={CAST_MASK}
            fill={cast.fill}
            opacity={cast.op}
            style={{ transition: STEP_FADE }}
          />
          {wash ? <Light set={wash} /> : null}
          {/* the battens, which are the actual lighting model in here */}
          <Light set={BATTEN_POOLS} />
          <path d={BATTEN_SOURCES.core} fill="#ffffff" opacity={0.9} />
          <path d={BATTEN_SOURCES.halo} fill={dth("w", "12")} opacity={0.3} />
          {/* mirror bounce, and the warm strip in the changing room */}
          <Light set={MIRROR_BOUNCE} />
          <Light set={LOCKER_POOL} />

          {/* --- transients ------------------------------------------------ */}
          {/* the player on a treadmill: the belt under them, and their own numbers */}
          {actionUi === "run" ? (
            <path
              d={pxPath(repeat(10, 5, [TREAD_X + 116, 130, 2, 2] as Rect))}
              fill={K.chalk}
              opacity={0.3}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;5 0"
                dur="0.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* a squat: the bar path, in four stepped ghosts */}
          {actionUi === "squat" ? (
            <path
              d={pxPath([
                [768, 98, 74, 2],
                [768, 110, 74, 2],
                [768, 122, 74, 2],
              ])}
              fill={dth("c", "25")}
              opacity={0.4}
            >
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.4;0.18;0.4;0.22"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* a deadlift: chalk off the hands at the top, and dust off the platform */}
          {actionUi === "deadlift" ? (
            <g>
              <path
                d={pxPath(steppedEllipse(980, 132, 26, 10, 2))}
                fill={dth("c", "12")}
                opacity={0.5}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.5;0.2;0.45;0.25"
                  dur="3.1s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={pxPath([[936, 148, 88, 2]])} fill={K.chalk} opacity={0.35} />
            </g>
          ) : null}
          {/* a press, and a swing, reusing the actions the other scenes already have */}
          {actionUi === "press" ? (
            <path
              d={pxPath([
                [850, 96, 70, 2],
                [850, 106, 70, 2],
              ])}
              fill={dth("c", "25")}
              opacity={0.4}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                calcMode="discrete"
                values="0 0;0 -4;0 0;0 3"
                dur="2.6s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {actionUi === "swing" ? (
            <path
              d={pxPath([
                [962, 120, 10, 8],
                [968, 108, 10, 8],
                [974, 96, 10, 8],
              ])}
              fill={dth("n", "25")}
              opacity={0.35}
            >
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.35;0.14;0.35;0.18"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* the music, as a pulse on the brand band, when it is loud */}
          {s.music === "loud" ? (
            <rect
              x={Z.stairEnd + 8}
              y={CEIL + 2}
              width={210}
              height={14}
              fill={K.brandHi}
              opacity={0.18}
            >
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.18;0.05;0.14;0.05"
                dur="0.52s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition
 * ================================================================== */

/**
 * Every world read the art performs. This scene is a plain SceneDef, which has
 * no artKey; if it migrates to RuntimeSceneDef, this is the key it wants.
 */
export function gymArtKey(world: WorldState, phase: string): string {
  const s = state(world);
  return [
    phase,
    s.crowd,
    s.reception,
    s.turnstile,
    s.cardio,
    s.rack,
    s.platform,
    s.dumbbells,
    s.lockers,
    s.shower,
    s.music,
    s.water,
    s.tv,
    s.cleaning ? 1 : 0,
  ].join("|");
}

export const GYM_SCENE: SceneDef<WorldState> = {
  id: "gym",
  width: W,
  objects: [
    /* --- the way in and out, which is the stair up from the lobby --- */
    {
      id: "stairs-alchemia",
      kind: "flatdoor",
      priority: 1,
      x: 70,
      range: 26,
      /* down to street level, landing on the pavement outside the door */
      to: { scene: "district", spawnX: 1000 },
    },
    { id: "gym-poster", kind: "flavor", x: 130, range: 12 },
    { id: "gym-sanitizer", kind: "flavor", x: 160, range: 8 },
    { id: "gym-prices", kind: "flavor", x: 210, range: 10 },
    { id: "gym-reception", kind: "flavor", x: 250, range: 22 },
    { id: "gym-shop", kind: "flavor", x: 300, range: 12 },
    { id: "gym-turnstile", kind: "openable", x: 336, range: 14 },
    /* "use" already has a handler in every other scene */
    { id: "gym-cooler", kind: "sport", action: "use", x: 386, range: 12 },
    /* --- cardio --- */
    { id: "gym-partition", kind: "flavor", x: 418, range: 18 },
    { id: "gym-treadmill", kind: "sport", action: "run", x: 484, range: 44 },
    { id: "gym-mats", kind: "sport", action: "stretch", x: 572, range: 16 },
    { id: "gym-tv", kind: "flavor", x: 620, range: 14 },
    { id: "gym-bike", kind: "sport", action: "cycle", x: 672, range: 22 },
    { id: "gym-fan", kind: "flavor", x: 700, range: 6 },
    { id: "gym-mirror", kind: "flavor", x: 716, range: 10 },
    /* --- weights --- */
    { id: "gym-pullup", kind: "sport", action: "pull", x: 746, range: 14 },
    { id: "gym-rack", kind: "sport", action: "squat", x: 802, range: 24 },
    { id: "gym-bench", kind: "sport", action: "press", x: 882, range: 22 },
    { id: "gym-chalk", kind: "flavor", x: 926, range: 8 },
    { id: "gym-platform", kind: "sport", action: "deadlift", x: 976, range: 26 },
    { id: "gym-kettlebells", kind: "sport", action: "swing", x: 1014, range: 10 },
    /* --- changing room --- */
    { id: "switch-szatnia", kind: "lamp", x: 1052, range: 10 },
    { id: "gym-lockers", kind: "openable", x: 1100, range: 30 },
    { id: "gym-bench-szatnia", kind: "flavor", x: 1162, range: 14 },
    { id: "gym-scale", kind: "flavor", x: 1196, range: 8 },
    { id: "gym-showers", kind: "flavor", x: 1226, range: 12 },
  ],
  Component: ({ world, phase }) => <GymScene world={world} phase={phase} />,
  /** A commercial gym is never dark. The battens do not care what time it is. */
  darkness: () => 0,
  Foreground: (p) => <GymFront {...p} />,
  Effects: GymEffects,
  idleLean: true,
};

/** Kept for parity with the other scenes' exports; the engine reads DayPhase. */
export type GymPhase = DayPhase;
