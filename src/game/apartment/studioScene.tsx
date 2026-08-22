import {
  AnimalActor,
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
  type LightTier,
  M,
  type Mat,
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  type SceneRenderProps,
  SharedDefs,
  STEP_DROOP,
  STEP_FADE,
  STEP_SLIDE,
  steppedCone,
  steppedEllipse,
  steppedQuad,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { type DayPhase, roomDarkness, studioState, type WorldState } from "@/lib/worldState";
import { ANIMALS } from "./animals";

// --- KAWALERKA / the studio, floor 4 -------------------------------------------------

/**
 * Fifth pass. The whole flat in one room — entry, kitchen run, the door nook,
 * the balcony glass, the living corner — rebuilt to the house standard the
 * bedroom, bathroom and corridor already meet, and given real chores.
 *
 * PLANES
 *   farBackground 0.85 — the courtyard: sky, the block opposite, its windows,
 *     two birches, the yard lamp. Full width now; it used to stop at the glass
 *     and show its own absence at the pan extremes.
 *   middleBackground 1 — ceiling, the three wall fields, the kitchen window,
 *     the door nook, the balcony opening, the entry. Everything bolted down.
 *   ground — floor tile, oak boards, rugs, the contact/AO pass.
 *   staticObjects — the kitchen run, the fridge, the dog corner, the living
 *     furniture.
 *   gameplayObjects — the television, the guitar. Things whose state you read.
 *   Foreground (runtime z-15) — shoe bench, pouf, toy basket, near lip, vignette.
 *   Effects — cast, daylight, every lamp pool, transients, Gross. He lives here
 *     because this is the only plane that hears `actionUi`.
 *
 * LIGHTING PREMISE — five temperatures, never one:
 *   the sun shaft through the balcony glass (warm by day, low and orange at
 *   dusk, cool and steep at dawn); the north light of the kitchen window;
 *   incandescent ceiling spots and the pendant; the under-cabinet LED strip;
 *   and the appliances — oven ember, fridge cold, TV by channel, laptop lid.
 *   Artificial sources ride one gain: barely there at noon, everything at night.
 *
 * SCALE KEY — PPM = 38 px/m, from the corridor's table:
 *   adult 1.75 m = 67 px   door leaf 2.05 m = 78 px   worktop 0.90 m → top y116
 *   units bottom 1.50 m → y93   table 0.75 m → y121   sofa seat 0.45 m → y133
 *   55" TV 1.22×0.71 m = 46×27 px   fridge 0.60×1.90 m = 23×72 px
 *   window sill 1.21 m → y104   skirting 0.16 m = 6 px   handle 1.15 m → y106
 *   The old kitchen ran the hob 1.26 m wide and the fridge to match; both are
 *   now appliance-sized and the room stopped feeling like a showroom render.
 *
 * STATE — world reads, all in artKey: lights.studio, tv, radioOn, kettleOn,
 *   cookerState, doorOpening, windows["window-kitchen"], fridgeOpen, and the
 *   studio chore bag (dishesDone, binEmptied, bowlsFilled, guitarOut,
 *   plantWatered) with clock fallbacks — dishes pile up through the morning,
 *   the bin fills by dusk, the bowls empty between meals — plus the street's
 *   weather, read defensively, so rain on the glass matches the rain outside.
 *
 * TRANSIENTS — actionUi only, Effects only, never in artKey: steam at the
 *   kettle and the pot, smoke at the cracked window, the washing-up water,
 *   the sofa occluder while sitting, hearts and notes as one-shot SMIL.
 *
 * BUDGET — geometry precomputed at module scope; ~34 SMIL animations declared,
 *   most on calcMode="discrete" with negative begins; zero gradients, zero
 *   ellipses, zero motion/react.
 */

const W = 920;
const H = 180;

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);

// landmark rows — every height in the room hangs off these
const CEIL = 46; // ceiling line, 2.74 m over the floor
const FLOOR = 150; // engine floor
const SKIRT = FLOOR - 6; // 0.16 m of skirting
const CY = FLOOR - 1; // contact-shadow row
const LEAF_TOP = FLOOR - m(2.05); // 72 — every door leaf on this floor
const HANDLE_Y = FLOOR - m(1.15); // 106 — every handle, knob and switch
const WORKTOP = FLOOR - m(0.9); // 116 — the kitchen counter
const UNIT_TOP = FLOOR - m(2.2); // 66 — wall units, top
const UNIT_BOT = FLOOR - m(1.5); // 93 — wall units, bottom
const SILL = FLOOR - m(1.21); // 104 — the kitchen window sill
const SPOTS = [40, 232, 336, 462] as const; // ceiling downlights

// ---------------------------------------------------------------------------
// palette — the flat's own casts, shared with the bedroom next door
// ---------------------------------------------------------------------------

const DAWN_CAST = "#8f8ab0";
const DUSK_CAST = "#c46a3a";
const NIGHT_CAST = "#1b2a3a";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.16),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.15),
    night: dim(mat, NIGHT_CAST, 0.56),
  };
}

// the studio's own surfaces, kept from the old room so it stays the same flat
const GREIGE_MAT: Mat = {
  hi: "#d6d0c1",
  base: "#c9c2b2",
  mid: "#bcb5a5",
  lo: "#ada695",
  deep: "#8f8878",
};
const KWALL_MAT: Mat = {
  hi: "#efece3",
  base: "#e4e1d8",
  mid: "#d8d5ca",
  lo: "#c8c5b8",
  deep: "#a8a598",
};
const CLAY_MAT: Mat = {
  hi: "#dcc096",
  base: "#c9a878",
  mid: "#bd9c6c",
  lo: "#ab8b5e",
  deep: "#8f7148",
};
const TILE_MAT: Mat = {
  hi: "#dde6e2",
  base: "#cdd8d4",
  mid: "#c0ccc8",
  lo: "#b0bdb8",
  deep: "#94a19c",
};
const BOARD_MAT: Mat = {
  hi: "#c09a63",
  base: "#a8875a",
  mid: "#9c7d51",
  lo: "#8a6c45",
  deep: "#6f5636",
};
const STONE_MAT: Mat = {
  hi: "#b4b1a9",
  base: "#a5a29a",
  mid: "#98958d",
  lo: "#8a8780",
  deep: "#6f6c66",
};
const SOFA_MAT: Mat = {
  hi: "#848a92",
  base: "#6d7278",
  mid: "#62676d",
  lo: "#565b60",
  deep: "#43474c",
};
const WHITE_MAT: Mat = {
  hi: "#f6f4ee",
  base: "#e8e6e0",
  mid: "#dbd8d1",
  lo: "#c9c5b8",
  deep: "#a9a69c",
};

const GREIGE = ramp(GREIGE_MAT);
const KWALL = ramp(KWALL_MAT);
const CLAY = ramp(CLAY_MAT);
const TILE = ramp(TILE_MAT);
const BOARD = ramp(BOARD_MAT);
const STONE = ramp(STONE_MAT);
const SOFA = ramp(SOFA_MAT);
const OAK = ramp(M.oak);
const GRAPHITE = ramp(M.graphite);
const STEEL = ramp(M.steel);
const WHITE = ramp(WHITE_MAT);

/** Accents that are not materials. */
const K = {
  glass: { dawn: "#bfb8cf", day: "#a8c2d4", dusk: "#c99a72", night: "#232a34" } as Record<
    Ph,
    string
  >,
  sky: { dawn: "#a8a2c0", day: "#bcd2e0", dusk: "#d8a478", night: "#141a24" } as Record<Ph, string>,
  skyRain: { dawn: "#8e8ba0", day: "#9aa8b4", dusk: "#a08a80", night: "#10141c" } as Record<
    Ph,
    string
  >,
  block: { dawn: "#6a6880", day: "#8a8f98", dusk: "#8a6a58", night: "#1d2430" } as Record<
    Ph,
    string
  >,
  blockLit: "#ffd98a",
  warm: "#ffd98a",
  warmHi: "#fff8e0",
  cold: "#dff4ff",
  ledCool: "#eaf6ff",
  green: "#3ddc84",
  red: "#e84a3a",
  ember: "#e8843a",
  linen: "#e8e2d2",
  curtain: "#8d7a94",
  curtainLo: "#6f5e78",
  tulle: "#e4ddd2",
  rug: "#8d8a94",
  rugLo: "#6f6c78",
  rugPat: "#a09daa",
  throwRed: "#a4553f",
  duvet: "#7a8f9f",
  wallGhost: "#efe9da",
  wallWarm: "#d9d2bd",
  soil: "#4a3a2c",
  soilWet: "#382c20",
  water: "#7fb2d9",
  waterHi: "#a8d2ee",
  suds: "#f2f4ee",
  kibble: "#a06a3a",
  cardboard: "#b08a5e",
  flagBlue: "#3f6fd9",
  flagYellow: "#f2c832",
  tvFilm: "#d8b48a",
  tvBall: "#9fd6b0",
  tvStatic: "#9fc7d6",
  crt: "#a8c8b8",
} as const;

/** Hex mix toward a cast — for one-off prop colours that don't own a ramp. */
function mixHex(a: string, b: string, t: number): string {
  const ah = Number.parseInt(a.slice(1), 16);
  const bh = Number.parseInt(b.slice(1), 16);
  const ch = [16, 8, 0]
    .map((sh) => Math.round(((ah >> sh) & 255) * (1 - t) + ((bh >> sh) & 255) * t))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `#${ch}`;
}

/** The soft goods follow the room into the night like everything else. */
function pcol(hex: string, ph: Ph): string {
  if (ph === "night") return mixHex(hex, NIGHT_CAST, 0.5);
  if (ph === "dusk") return mixHex(hex, DUSK_CAST, 0.14);
  if (ph === "dawn") return mixHex(hex, DAWN_CAST, 0.15);
  return hex;
}

/** How much the artificial lights matter, per phase — ×0 when the switch is off. */
const GAIN: Record<Ph, number> = { dawn: 0.55, day: 0.18, dusk: 0.8, night: 1 };

// ---------------------------------------------------------------------------
// state — one defensive read, clamped, clock fallbacks for the chores
// ---------------------------------------------------------------------------

export type TvChannelPh = "off" | "film" | "football" | "static";
type Weather = "clear" | "overcast" | "rain";
const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain"];

interface StudioSt {
  lit: boolean;
  tv: TvChannelPh;
  radioOn: boolean;
  kettleOn: boolean;
  cooker: "off" | "open" | "on";
  opening: string | null;
  winOpen: boolean;
  winSmoked: boolean;
  fridgeOpen: boolean;
  /** dirty dishes still showing — chore not done and the clock says morning */
  dishes: boolean;
  /** the bin bag has crested the rim */
  binFull: boolean;
  /** the bowls are full — done, or it is a mealtime phase */
  fed: boolean;
  /** the guitar is on its stand rather than put away */
  guitarOut: boolean;
  plantWatered: boolean;
  weather: Weather;
}

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * The chore flags fall back to what the clock says, exactly as the old room
 * pretended they did — the difference is that the handlers now actually write
 * them, so a washed sink stays washed.
 */
function state(world: WorldState, ph: Ph): StudioSt {
  const chores = studioState(world);
  const street = ((world as unknown as Record<string, unknown>).street ?? {}) as Record<
    string,
    unknown
  >;
  const win = world.windows["window-kitchen"];
  return {
    lit: !!world.lights.studio,
    tv: world.tv,
    radioOn: world.radioOn,
    kettleOn: world.kettleOn,
    cooker: world.cookerState,
    opening: world.doorOpening,
    winOpen: !!win?.open,
    winSmoked: !!win?.smoked,
    fridgeOpen: world.fridgeOpen,
    dishes: !chores.dishesDone && (ph === "dawn" || ph === "day"),
    binFull: !chores.binEmptied && (ph === "dusk" || ph === "night"),
    // breakfast happens off-screen at dawn; by dusk the bowls are empty and
    // Gross is stirring until somebody actually feeds him
    fed: chores.bowlsFilled || ph === "dawn",
    guitarOut: chores.guitarOut || ph !== "night",
    plantWatered: chores.plantWatered,
    weather: clampStage(street.weather, WEATHERS, "clear"),
  };
}

// ---------------------------------------------------------------------------
// geometry — everything static built once, at module scope
// ---------------------------------------------------------------------------

/** Solid-colour tier builder for tints the kit's four letters don't carry. */
function localTiers(build: (k: number) => Rect[], solid: string, strength = 1): LightTier[] {
  return [
    { d: pxPath(build(1)), fill: solid, o: 0.07 * strength },
    { d: pxPath(build(0.78)), fill: solid, o: 0.08 * strength },
    { d: pxPath(build(0.52)), fill: solid, o: 0.1 * strength },
    { d: pxPath(build(0.3)), fill: solid, o: 0.12 * strength },
  ];
}

// the sun through the balcony glass — steep and cool at dawn, the long
// familiar diagonal by day, low and orange at dusk, gone at night
const SHAFT: Record<Ph, LightTier[] | null> = {
  dawn: tiers(
    (k) =>
      steppedQuad(
        56,
        552 + (1 - k) * 16,
        656 - (1 - k) * 16,
        H,
        508 + (1 - k) * 18,
        700 - (1 - k) * 18,
        8,
      ),
    "c",
    0.8,
  ),
  day: tiers(
    (k) =>
      steppedQuad(
        56,
        552 + (1 - k) * 18,
        656 - (1 - k) * 18,
        H,
        434 + (1 - k) * 24,
        622 - (1 - k) * 24,
        8,
      ),
    "w",
    1,
  ),
  dusk: tiers(
    (k) =>
      steppedQuad(
        56,
        552 + (1 - k) * 20,
        656 - (1 - k) * 20,
        H,
        408 + (1 - k) * 30,
        586 - (1 - k) * 30,
        10,
      ),
    "e",
    0.9,
  ),
  night: null,
};

// the kitchen window's north light — never a shaft, just a wash on the sink run
const WINDOW_WASH = tiers(
  (k) =>
    steppedQuad(
      52,
      218 + (1 - k) * 14,
      276 - (1 - k) * 14,
      FLOOR + 12,
      200 + (1 - k) * 20,
      296 - (1 - k) * 20,
      8,
    ),
  "c",
  0.7,
);
const WINDOW_WASH_OP: Record<Ph, number> = { dawn: 0.55, day: 1, dusk: 0.45, night: 0.12 };

// ceiling downlights: entry, kitchen ×2, the nook — cone + floor pool + lens
const SPOT_XS = SPOTS;
const SPOT_CONES = SPOT_XS.map((x) =>
  tiers(
    (k) => steppedCone(x, CEIL + 5, Math.round(4 * k), FLOOR, Math.round(24 * k), 8),
    "w",
    0.85,
  ),
);
const SPOT_POOLS = SPOT_XS.map((x) =>
  tiers((k) => steppedEllipse(x, FLOOR + 6, Math.round(28 * k), Math.round(7 * k), 2), "w", 0.7),
);
const SPOT_SOURCES = bulbPaths(SPOT_XS.map((x) => [x, CEIL + 3] as const));

// the pendant over the kitchen table
const PENDANT_POOL = tiers(
  (k) => steppedCone(156, 80, Math.round(7 * k), 124, Math.round(26 * k), 6),
  "w",
  0.95,
);
const PENDANT_TABLE = tiers(
  (k) => steppedEllipse(156, 122, Math.round(30 * k), Math.round(7 * k), 2),
  "w",
  0.8,
);
const PENDANT_SOURCE = bulbPaths([[156, 76]]);

// the arc lamp leaning over the coffee table
const ARC_POOL = tiers(
  (k) => steppedCone(821, 84, Math.round(9 * k), 148, Math.round(34 * k), 8),
  "w",
  0.9,
);
const ARC_SOURCE = bulbPaths([[821, 80]]);

// the small lamp on the side table
const SIDELAMP_POOL = tiers(
  (k) => steppedEllipse(905, 106, Math.round(30 * k), Math.round(22 * k), 2),
  "w",
  0.85,
);
const SIDELAMP_SOURCE = bulbPaths([[905, 104]]);

// the LED strip under the wall units — two cool washes onto the worktop
const UNDERCAB_L = tiers(
  (k) =>
    steppedQuad(
      94,
      120 + (1 - k) * 20,
      208 - (1 - k) * 20,
      124,
      116 + (1 - k) * 20,
      212 - (1 - k) * 20,
      4,
    ),
  "c",
  0.55,
);
const UNDERCAB_R = tiers(
  (k) =>
    steppedQuad(
      94,
      288 + (1 - k) * 18,
      372 - (1 - k) * 18,
      124,
      284 + (1 - k) * 18,
      376 - (1 - k) * 18,
      4,
    ),
  "c",
  0.55,
);

// appliance light — cold spill from the open fridge, ember from the oven,
// the TV's temperature depends on what is on
const FRIDGE_WASH = localTiers(
  (k) =>
    steppedQuad(
      80,
      368 + (1 - k) * 10,
      386 - (1 - k) * 10,
      FLOOR + 4,
      344 + (1 - k) * 20,
      396 - (1 - k) * 20,
      8,
    ),
  K.ledCool,
  1.8,
);
const FRIDGE_FLOOR = localTiers(
  (k) => steppedEllipse(372, FLOOR + 2, Math.round(30 * k), Math.round(7 * k), 2),
  K.ledCool,
  1.6,
);
const OVEN_GLOW = tiers(
  (k) => steppedEllipse(322, 134, Math.round(26 * k), Math.round(16 * k), 2),
  "e",
  1.8,
);
const OVEN_OPEN_GLOW = tiers(
  (k) => steppedEllipse(322, 140, Math.round(30 * k), Math.round(12 * k), 2),
  "e",
  1.6,
);
const TV_GLOW: Record<Exclude<TvChannelPh, "off">, LightTier[]> = {
  film: localTiers(
    (k) => steppedEllipse(751, 98, Math.round(52 * k), Math.round(34 * k), 2),
    K.tvFilm,
    2.2,
  ),
  football: localTiers(
    (k) => steppedEllipse(751, 98, Math.round(52 * k), Math.round(34 * k), 2),
    K.tvBall,
    2.2,
  ),
  static: localTiers(
    (k) => steppedEllipse(751, 98, Math.round(52 * k), Math.round(34 * k), 2),
    K.tvStatic,
    2.2,
  ),
};
const TV_FLOOR = localTiers(
  (k) => steppedEllipse(751, FLOOR + 2, Math.round(40 * k), Math.round(8 * k), 2),
  K.tvStatic,
  2,
);
const LAPTOP_GLOW = tiers(
  (k) => steppedEllipse(809, 122, Math.round(16 * k), Math.round(10 * k), 2),
  "c",
  1.1,
);

// dust in the shaft: one path, one drift (plus a nearer, faster set in Front)
const MOTES_D = pxPath([
  [560, 120, 1, 1],
  [578, 138, 1, 1],
  [596, 108, 2, 2],
  [612, 148, 1, 1],
  [630, 126, 1, 1],
  [648, 156, 1, 1],
  [571, 96, 1, 1],
  [605, 132, 1, 1],
]);
const MOTES_FRONT_D = pxPath([
  [520, 130, 2, 2],
  [590, 160, 2, 2],
  [660, 120, 2, 2],
]);

// ambient occlusion — one set per plane, rendered once at the plane's end
const WALL_AO = aoPaths([
  [116, UNIT_BOT, 94], // left wall units onto the splashback
  [284, UNIT_BOT, 92], // right run
  [306, 78, 34], // the hood canopy
  [210, SILL + 4, 74], // window sill
  [112, 120, 264], // worktop lip onto the carcass
  [512, 92, 22], // the nook prints
  [512, 142, 24], // radiator onto the skirting
  [728, 112, 46], // the TV onto the wall
  [846, 102, 44], // the under-flag shelf
  [66, 58, 40], // the hall wardrobe crown
  [676, 90, 44], // the bookshelf crown
]);
const FLOOR_CONTACT = contactPaths([
  [14, 62, CY], // shoe bench
  [126, 62, CY], // kitchen table + stools
  [344, 18, CY], // pedal bin
  [377, 24, CY], // fridge
  [514, 22, CY], // monstera pot
  [532, 18, CY], // the robot dock
  [560, 14, CY], // food sack
  [576, 36, CY], // bowls mat
  [616, 48, CY], // the dog bed
  [712, 88, CY], // media unit
  [766, 20, CY], // guitar stand
  [780, 18, CY], // arc lamp base
  [792, 64, CY], // coffee table
  [816, 102, CY], // sofa
  [894, 22, CY], // side table
]);

// bevel sets for the big fixed boxes
const FRONTDOOR_LEAF = bevelPaths([
  [16, 70, 40, 80],
  [20, 76, 32, 30],
  [20, 112, 32, 32],
]);
const WARDROBE_SET = bevelPaths([[66, 56, 32, 92]]);
const WINDOW_FRAME = bevelPaths([[210, 46, 74, 6]]);
const BATH_LEAF = bevelPaths([
  [414, LEAF_TOP, 36, 78],
  [418, 78, 28, 28],
  [418, 112, 28, 32],
]);
const STUDY_LEAF = bevelPaths([
  [470, LEAF_TOP, 36, 78],
  [474, 78, 28, 28],
  [474, 112, 28, 32],
]);
const RADIATOR_SET = bevelPaths([[512, 118, 24, 26]]);
const FRIDGE_SET = bevelPaths([
  [377, 78, 24, 22],
  [377, 102, 24, 44],
]);
const HOOD_SET = bevelPaths([
  [304, 74, 38, 5],
  [316, 48, 14, 26],
]);
const MICRO_SET = bevelPaths([[344, 70, 30, 22]]);
const TABLE_SET = bevelPaths([[126, 121, 60, 5]]);
const MEDIA_SET = bevelPaths([[712, 128, 88, 20]]);
const CTABLE_SET = bevelPaths([[792, 132, 64, 4]]);
const SOFA_SET = bevelPaths([
  [816, 116, 16, 32], // left arm
  [902, 116, 16, 32], // right arm
  [830, 108, 74, 10], // back rail
]);
const SIDETABLE_SET = bevelPaths([[894, 124, 22, 4]]);
const SHELF_SET = bevelPaths([[676, 90, 44, 58]]);
const FLAGSHELF_SET = bevelPaths([[846, 96, 44, 4]]);

// the floor, in a handful of paths
const FLOOR_TILE = (() => {
  const rows: Rect[] = [];
  for (let y = 158; y < H; y += 12) rows.push([0, y, 406, 1]);
  const cols: Rect[] = [];
  for (let x = 13; x < 406; x += 26) cols.push([x, FLOOR, 1, H - FLOOR]);
  return { rows: pxPath(rows), cols: pxPath(cols) };
})();
const FLOOR_BOARDS = (() => {
  const seams: Rect[] = [];
  for (const y of [158, 166, 174]) seams.push([406, y, W - 406, 1]);
  const joints = pxPath([
    [470, 150, 1, 8],
    [548, 158, 1, 8],
    [618, 150, 1, 8],
    [694, 166, 1, 8],
    [742, 150, 1, 8],
    [858, 158, 1, 8],
  ]);
  return { seams: pxPath(seams), joints };
})();

const VIG = vignettePaths(W, H);

// the opposite block's windows: a grid, and the handful that are lit at night
const YARD_WINDOWS = (() => {
  const grid: Rect[] = [];
  for (let fx = 30; fx < W; fx += 74) {
    for (const fy of [76, 104]) grid.push([fx, fy, 10, 14]);
  }
  return pxPath(grid);
})();
const YARD_LIT = pxPath([
  [104, 104, 10, 14],
  [326, 76, 10, 14],
  [400, 104, 10, 14],
  [622, 104, 10, 14],
  [696, 76, 10, 14],
  [844, 104, 10, 14],
]);
/** The two windows that punch through the balcony glazing after dark. */
const YARD_LIT_NEAR = pxPath([
  [578, 76, 10, 14],
  [622, 104, 10, 14],
]);

/* === PLANE 1 — farBackground: the courtyard ==================================== */

function Yard({ ph, rain }: { ph: Ph; rain: boolean }) {
  const sky = rain ? K.skyRain[ph] : K.sky[ph];
  const night = ph === "night";
  return (
    <g>
      {/* the defs live in the bottom-most plane of the scene and nowhere else */}
      <SharedDefs />
      {px(0, 0, W, 96, sky)}
      {px(0, 34, W, 2, rain ? "#00000018" : "#ffffff14")}
      {/* the block opposite, full width — it used to stop at the glass */}
      {px(0, 64, W, 86, K.block[ph])}
      {px(0, 64, W, 2, night ? "#232c3a" : "#ffffff22")}
      <path d={YARD_WINDOWS} fill={night ? "#10141c" : "#00000026"} />
      {night ? <path d={YARD_LIT_NEAR} fill={K.blockLit} opacity={1} /> : null}
      {night ? (
        <path d={YARD_LIT} fill={K.blockLit} opacity={0.8}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.8;0.8;0.55;0.8"
            dur="7s"
            begin="-3s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* two birches in the yard, out by the bins */}
      <g style={{ transformOrigin: "258px 140px" }}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 258 140;-1 258 140;0 258 140;1 258 140;0 258 140"
          dur="9s"
          begin="-2s"
          repeatCount="indefinite"
        />
        {px(255, 92, 3, 48, "#c8c2b4")}
        {px(244, 78, 26, 18, night ? "#28372c" : "#5e7a52")}
        {px(248, 72, 16, 8, night ? "#2e3f32" : "#6b8a5e")}
      </g>
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 622 140;1 622 140;0 622 140;-1 622 140;0 622 140"
          dur="11s"
          begin="-6s"
          repeatCount="indefinite"
        />
        {px(620, 96, 3, 44, "#c8c2b4")}
        {px(608, 80, 28, 20, night ? "#28372c" : "#5e7a52")}
      </g>
      {/* the yard lamp comes on with the streetlights */}
      {px(700, 96, 2, 44, "#3a3e44")}
      {px(696, 92, 10, 5, "#4a4e55")}
      {ph === "dusk" || night ? (
        <g>
          {px(698, 94, 6, 2, K.warmHi)}
          <path d={pxPath(steppedEllipse(701, 118, 16, 22, 2))} fill={K.warm} opacity={0.12} />
        </g>
      ) : null}
      {/* one crow crossing the yard, unhurried */}
      {!night ? (
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-960 -14"
            dur="52s"
            begin="-20s"
            repeatCount="indefinite"
          />
          {px(912, 34, 4, 1, "#2a2d33")}
          {px(913, 33, 2, 1, "#2a2d33")}
        </g>
      ) : null}
      {/* rain over the yard — two sheets, offset */}
      {rain ? (
        <g opacity={0.45}>
          <path d={pxPath(repeat(24, 40, [4, 0, 1, 8] as Rect))} fill="#c8d4de">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -20;6 160"
              dur="1.1s"
              repeatCount="indefinite"
            />
          </path>
          <path d={pxPath(repeat(24, 40, [22, 0, 1, 7] as Rect))} fill="#b6c4d0">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -80;5 100"
              dur="0.9s"
              begin="-0.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* === PLANE 2 — middleBackground: the shell of the room ========================= */

function Ceiling({ ph }: { ph: Ph }) {
  return (
    <g>
      {px(0, 0, W, CEIL, KWALL[ph].hi)}
      <rect x={0} y={0} width={W} height={CEIL} fill="url(#px-roller)" opacity={0.3} />
      {/* stepped falloff instead of a gradient */}
      <path d={pxPath([[0, 0, W, 8]])} fill={dth("n", "12")} />
      <path d={pxPath([[0, 8, W, 8]])} fill={dth("n", "06")} />
      {/* cornice */}
      {px(0, CEIL - 4, W, 2, KWALL[ph].base)}
      {px(0, CEIL - 2, W, 2, KWALL[ph].lo)}
      {/* the settlement crack over the living corner, painted over once already */}
      <path
        d={pxPath([
          [688, 0, 1, 6],
          [689, 6, 1, 4],
        ])}
        fill={KWALL[ph].lo}
        opacity={0.4}
      />
      {/* downlight trims */}
      {SPOT_XS.map((x) => (
        <g key={x}>
          {px(x - 4, CEIL - 2, 8, 2, "#4a4e55")}
          {px(x - 3, CEIL, 6, 2, "#2e3238")}
        </g>
      ))}
      {/* smoke alarm, blinking its one red eye every nine seconds */}
      {px(464, 40, 10, 4, "#e2ded2")}
      {px(466, 44, 6, 2, "#c9c5b8")}
      <path d={pxPath([[471, 42, 1, 1]])} fill={K.red}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0;0;0;1;0"
          dur="9s"
          begin="-4s"
          repeatCount="indefinite"
        />
      </path>
      {/* the pendant drop over the kitchen table */}
      {px(155, CEIL, 2, 22, "#3a3e44")}
    </g>
  );
}

function Walls({ ph }: { ph: Ph }) {
  return (
    <g>
      {/* three fields: greige entry, kitchen off-white, clay living */}
      {px(0, CEIL, 112, FLOOR - CEIL, GREIGE[ph].base)}
      <rect x={0} y={CEIL} width={112} height={FLOOR - CEIL} fill="url(#px-roller)" opacity={0.5} />
      {px(108, CEIL, 4, FLOOR - CEIL, GREIGE[ph].deep)}
      {/* the kitchen field is rails around the window's hole — the yard shows through */}
      <path
        d={pxPath([
          [112, CEIL, 292, 6],
          [112, 52, 104, 52],
          [278, 52, 126, 52],
          [112, 104, 292, FLOOR - 104],
        ])}
        fill={KWALL[ph].base}
      />
      <rect
        x={112}
        y={CEIL}
        width={104}
        height={FLOOR - CEIL}
        fill="url(#px-stucco)"
        opacity={0.4}
      />
      <rect
        x={278}
        y={CEIL}
        width={126}
        height={FLOOR - CEIL}
        fill="url(#px-stucco)"
        opacity={0.4}
      />
      {px(404, CEIL, 2, FLOOR - CEIL, CLAY[ph].deep)}
      {/* the clay field likewise skips the balcony opening */}
      <path
        d={pxPath([
          [406, CEIL, 122, FLOOR - CEIL],
          [680, CEIL, 240, FLOOR - CEIL],
          [528, CEIL, 152, 8],
        ])}
        fill={CLAY[ph].base}
      />
      <rect
        x={406}
        y={CEIL}
        width={122}
        height={FLOOR - CEIL}
        fill="url(#px-roller)"
        opacity={0.55}
      />
      <rect
        x={680}
        y={CEIL}
        width={240}
        height={FLOOR - CEIL}
        fill="url(#px-roller)"
        opacity={0.55}
      />
      {/* the splashback tile, two runs either side of the window */}
      {px(112, UNIT_BOT, 100, WORKTOP - UNIT_BOT, TILE[ph].base)}
      {px(284, UNIT_BOT, 120, WORKTOP - UNIT_BOT, TILE[ph].base)}
      <path
        d={pxPath([
          [112, 100, 100, 1],
          [284, 100, 120, 1],
          [112, 108, 100, 1],
          [284, 108, 120, 1],
        ])}
        fill={TILE[ph].lo}
        opacity={0.7}
      />
      <path
        d={pxPath([
          [140, UNIT_BOT, 1, 23],
          [168, UNIT_BOT, 1, 23],
          [196, UNIT_BOT, 1, 23],
          [312, UNIT_BOT, 1, 23],
          [340, UNIT_BOT, 1, 23],
          [368, UNIT_BOT, 1, 23],
        ])}
        fill={TILE[ph].lo}
        opacity={0.7}
      />
      {/* skirting, all the way round */}
      {px(0, SKIRT, W, 4, KWALL[ph].mid)}
      {px(0, SKIRT, W, 1, KWALL[ph].hi)}
      {px(0, SKIRT + 4, W, 2, KWALL[ph].deep)}
      {/* scuffs: the sofa leg, years of the same chair */}
      {px(836, SKIRT, 10, 4, CLAY[ph].deep)}
      {px(190, SKIRT, 8, 4, KWALL[ph].deep)}
      {/* the ghost where a poster hung through two tenancies, above the TV */}
      {px(756, 56, 30, 22, CLAY[ph].hi)}
      <path
        d={pxPath([
          [756, 56, 30, 1],
          [756, 77, 30, 1],
          [756, 56, 1, 22],
          [785, 56, 1, 22],
        ])}
        fill="#e8d2a8"
        opacity={0.6}
      />
      {/* two screw holes, and the tape corners that outlived the poster */}
      <path
        d={pxPath([
          [760, 60, 1, 1],
          [781, 60, 1, 1],
        ])}
        fill={CLAY[ph].deep}
      />
      <path
        d={pxPath([
          [756, 56, 3, 2],
          [783, 56, 3, 2],
          [756, 75, 3, 2],
        ])}
        fill="#d9cdb0"
        opacity={0.8}
      />
      {px(770, 53, 2, 2, M.brass.lo)}
      {/* sockets and their day jobs */}
      {px(100, 126, 8, 8, KWALL[ph].hi)}
      {px(103, 129, 2, 2, KWALL[ph].deep)}
      {px(166, 98, 12, 8, KWALL[ph].hi)}
      <path
        d={pxPath([
          [169, 101, 2, 2],
          [173, 101, 2, 2],
        ])}
        fill={KWALL[ph].deep}
      />
      {px(456, 126, 8, 8, CLAY[ph].hi)}
      {px(459, 129, 2, 2, CLAY[ph].deep)}
      {px(782, 126, 8, 8, CLAY[ph].hi)}
      {px(785, 129, 2, 2, CLAY[ph].deep)}
      <AOSet set={WALL_AO} op={0.8} />
    </g>
  );
}

function Entry({ ph, opening, lit }: { ph: Ph; opening: string | null; lit: boolean }) {
  const open = opening === "frontdoor";
  return (
    <g>
      {/* the front door: steel frame, anthracite leaf, two locks like everyone's */}
      {px(10, 64, 52, 86, STEEL[ph].lo)}
      {px(12, 66, 48, 84, STEEL[ph].base)}
      {open ? (
        <g>
          {px(16, 70, 40, 80, "#14161a")}
          {px(16, 70, 40, 8, "#1d2027")}
          {/* the corridor's own light leaking in */}
          <path d={pxPath([[18, 74, 36, 74]])} fill={dth("w", "12")} opacity={0.4} />
        </g>
      ) : null}
      <g
        style={{
          transition: STEP_SLIDE,
          transform: open ? "scaleX(0.16)" : "none",
          transformOrigin: "16px 70px",
        }}
      >
        <Bev set={FRONTDOOR_LEAF} mat={GRAPHITE[ph]} />
        <rect x={16} y={70} width={40} height={80} fill="url(#px-satin)" opacity={0.35} />
        {/* spyhole at eye height, brass ring */}
        {px(34, 87, 4, 4, M.brass.lo)}
        {px(35, 88, 2, 2, "#14161a")}
        {/* handle and the two locks */}
        <Bevel boxes={[[48, HANDLE_Y, 5, 4]]} mat={M.brass} />
        {px(49, HANDLE_Y + 8, 3, 3, M.brass.lo)}
        {px(49, HANDLE_Y + 14, 3, 3, M.brass.lo)}
        {/* the chain, in its parked position */}
        {px(20, 92, 1, 6, "#6d6650")}
        {px(20, 98, 4, 1, "#6d6650")}
      </g>
      {/* the hall wardrobe: one oak door, one mirror */}
      <Bev set={WARDROBE_SET} mat={OAK[ph]} />
      <rect x={66} y={56} width={32} height={92} fill="url(#px-wood)" opacity={0.5} />
      {px(80, 56, 2, 92, OAK[ph].deep)}
      {/* the mirror door reflects the room's own light, or doesn't */}
      {px(
        84,
        60,
        12,
        84,
        lit ? "#c3ccd2" : ph === "night" ? "#2e3742" : ph === "dusk" ? "#a8887a" : "#9aa6ae",
      )}
      <path
        d={pxPath([
          [85, 62, 2, 78],
          [88, 64, 1, 70],
        ])}
        fill="#ffffff"
        opacity={lit ? 0.35 : 0.15}
      />
      {px(74, HANDLE_Y - 4, 2, 8, M.brass.base)}
      {px(96, HANDLE_Y - 4, 2, 8, M.brass.base)}
      {/* dry cleaning ticket still taped to the mirror edge */}
      {px(84, 70, 4, 6, K.linen)}
      {/* intercom on the strip by the kitchen: one green standby eye */}
      {px(100, 86, 8, 12, K.linen)}
      {px(101, 87, 6, 5, "#2a2d33")}
      {px(102, 94, 4, 1, "#c9c5b8")}
      <path d={pxPath([[105, 96, 1, 1]])} fill={K.green}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;1;0.3;1"
          dur="6s"
          begin="-2s"
          repeatCount="indefinite"
        />
      </path>
      {/* key hooks: his, the spare, the one nobody can place */}
      {px(98, 104, 14, 2, OAK[ph].mid)}
      <path
        d={pxPath([
          [100, 106, 1, 3],
          [105, 106, 1, 3],
          [110, 106, 1, 3],
        ])}
        fill={M.brass.lo}
      />
      {px(99, 109, 3, 4, M.brass.base)}
      {px(109, 109, 3, 4, "#8a4a3a")}
      {/* the light switch, on the kitchen side where you actually reach it */}
      {px(117, HANDLE_Y - 2, 10, 12, KWALL[ph].hi)}
      {px(120, HANDLE_Y + (lit ? 0 : 3), 4, 4, lit ? M.brass.base : KWALL[ph].lo)}
    </g>
  );
}

function KitchenWindow({ ph, s }: { ph: Ph; s: StudioSt }) {
  const glass = K.glass[ph];
  const night = ph === "night";
  return (
    <g>
      {/* a glazed opening is rails around a hole — the yard shows through */}
      <Bev set={WINDOW_FRAME} mat={KWALL[ph]} />
      {px(212, 52, 4, 52, KWALL[ph].mid)}
      {px(278, 52, 4, 52, KWALL[ph].mid)}
      {px(245, 52, 4, 52, KWALL[ph].mid)}
      {/* fixed pane — a temperature over the yard, not a picture of one */}
      <rect x={216} y={52} width={29} height={52} fill={glass} opacity={night ? 0.55 : 0.32} />
      <rect x={216} y={52} width={29} height={52} fill="url(#px-satin)" opacity={0.35} />
      {ph === "day" ? (
        <path d={pxPath([[216, 52, 29, 10]])} fill={dth("c", "25")} opacity={0.5} />
      ) : null}
      {/* opening sash */}
      {s.winOpen ? (
        <g>
          <g style={{ transform: "scaleX(0.45)", transformOrigin: "249px 52px" }}>
            <rect x={249} y={52} width={29} height={52} fill={glass} opacity={0.7} />
            {px(274, 74, 3, 8, STEEL[ph].base)}
          </g>
          {/* outside air finding its way in */}
          <path d={pxPath([[247, 52, 5, 52]])} fill={dth("c", "50")} opacity={0.5}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.5;0.35;0.5;0.4"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : (
        <g>
          <rect x={249} y={52} width={29} height={52} fill={glass} opacity={night ? 0.55 : 0.32} />
          <rect x={249} y={52} width={29} height={52} fill="url(#px-satin)" opacity={0.35} />
          {px(253, 56, 3, 32, night ? "#2e3742" : "#c3d4de")}
          {px(272, 76, 3, 6, STEEL[ph].base)}
        </g>
      )}
      {/* rain on the glass, when there is rain to be on it */}
      {s.weather === "rain" ? (
        <g opacity={0.6}>
          <path
            d={pxPath([
              [222, 54, 1, 6],
              [236, 62, 1, 8],
              [258, 56, 1, 7],
              [270, 68, 1, 6],
            ])}
            fill={K.waterHi}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 34"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* sill, herb pot, the glass someone left */}
      {px(208, SILL, 78, 4, KWALL[ph].hi)}
      {px(208, SILL + 4, 78, 2, KWALL[ph].lo)}
      {px(218, SILL - 8, 10, 8, M.red.lo)}
      {px(219, SILL - 12, 8, 4, M.leaf.base)}
      {px(221, SILL - 14, 4, 2, M.leaf.hi)}
      {px(262, SILL - 7, 6, 7, "#c3d4de")}
      {px(263, SILL - 5, 4, 4, "#a8c2d4")}
    </g>
  );
}

function DoorsNook({
  ph,
  s,
  bathLit,
  studyLit,
}: {
  ph: Ph;
  s: StudioSt;
  bathLit: boolean;
  studyLit: boolean;
}) {
  return (
    <g>
      <InteriorDoor
        ph={ph}
        x={410}
        open={s.opening === "door-bath"}
        lit={bathLit}
        set={BATH_LEAF}
      />
      {/* two frames between the doors: the parents, and Gross as a puppy */}
      {px(455, 82, 8, 10, OAK[ph].lo)}
      {px(456, 83, 6, 8, K.linen)}
      {px(457, 85, 4, 4, "#8a8368")}
      {px(455, 96, 8, 8, M.brass.lo)}
      {px(456, 97, 6, 6, "#c9a878")}
      {px(457, 98, 3, 3, "#a06a3a")}
      <InteriorDoor
        ph={ph}
        x={466}
        open={s.opening === "door-study"}
        lit={studyLit}
        set={STUDY_LEAF}
      />
      {/* transom vent over the bathroom, and the conduit they ran to the spot */}
      {px(422, 54, 20, 8, CLAY[ph].lo)}
      <path
        d={pxPath([
          [424, 56, 16, 1],
          [424, 59, 16, 1],
        ])}
        fill={CLAY[ph].deep}
      />
      {px(492, 52, 8, 6, K.linen)}
      {px(494, 54, 4, 2, "#8a8368")}
      <path
        d={pxPath([
          [468, 51, 24, 1],
          [466, 51, 2, 2],
        ])}
        fill={CLAY[ph].lo}
      />
      {/* the radiator, ticking as it heats */}
      <Bev set={RADIATOR_SET} mat={WHITE[ph]} />
      <path
        d={pxPath([
          [515, 120, 3, 22],
          [521, 120, 3, 22],
          [527, 120, 3, 22],
        ])}
        fill={WHITE[ph].mid}
      />
      <path
        d={pxPath([
          [515, 120, 1, 22],
          [521, 120, 1, 22],
          [527, 120, 1, 22],
        ])}
        fill={WHITE[ph].hi}
      />
      {px(534, 138, 3, 4, M.brass.base)}
      {px(512, 144, 2, 6, WHITE[ph].lo)}
      {px(533, 144, 2, 6, WHITE[ph].lo)}
      {/* heat shimmer on the wall above, cold phases only */}
      {ph !== "day" ? (
        <path d={pxPath([[512, 106, 24, 12]])} fill={dth("w", "12")} opacity={0.5} />
      ) : null}
      {/* two prints above: the Hutsul print from home, a city map */}
      {px(509, 62, 13, 17, OAK[ph].lo)}
      {px(510, 63, 11, 15, K.linen)}
      <path
        d={pxPath([
          [511, 66, 9, 2],
          [513, 70, 5, 2],
          [511, 74, 9, 1],
        ])}
        fill="#a4553f"
      />
      {px(526, 64, 12, 15, M.graphite.base)}
      {px(527, 65, 10, 13, "#d8d5ca")}
      <path
        d={pxPath([
          [528, 67, 3, 1],
          [532, 69, 4, 1],
          [529, 72, 5, 1],
          [531, 74, 3, 1],
        ])}
        fill="#6a7280"
      />
    </g>
  );
}

/** A white-panel interior door in a clay wall. Swings in stepped increments. */
function InteriorDoor({
  ph,
  x,
  open,
  lit,
  set,
}: {
  ph: Ph;
  x: number;
  open: boolean;
  lit: boolean;
  set: ReturnType<typeof bevelPaths>;
}) {
  return (
    <g>
      {px(x, 66, 44, 84, CLAY[ph].deep)}
      {px(x + 2, 68, 40, 82, WHITE[ph].lo)}
      {open ? (
        <g>
          {px(x + 4, LEAF_TOP, 36, 78, "#14161a")}
          {px(x + 4, LEAF_TOP, 36, 8, "#1d2027")}
          {lit ? (
            <path
              d={pxPath([[x + 6, LEAF_TOP + 4, 32, 72]])}
              fill={dth("w", "12")}
              opacity={0.45}
            />
          ) : null}
        </g>
      ) : null}
      <g
        style={{
          transition: STEP_SLIDE,
          transform: open ? "scaleX(0.16)" : "none",
          transformOrigin: `${x + 4}px ${LEAF_TOP}px`,
        }}
      >
        <Bev set={set} mat={WHITE[ph]} />
        <Bevel boxes={[[x + 34, HANDLE_Y, 5, 4]]} mat={M.brass} />
        {px(x + 35, HANDLE_Y + 6, 2, 3, M.brass.lo)}
      </g>
      {/* the warm line under a lived-in door */}
      {!open && lit ? (
        <path d={pxPath([[x + 4, 148, 36, 2]])} fill={dth("w", "25")} opacity={0.7} />
      ) : null}
    </g>
  );
}

function BalconyWall({ ph, s }: { ph: Ph; s: StudioSt }) {
  const glass = K.glass[ph];
  const open = s.opening === "balcony";
  return (
    <g>
      {/* transom strip and head rail */}
      {px(528, CEIL, 152, 10, CLAY[ph].base)}
      {px(528, 54, 152, 4, OAK[ph].mid)}
      {/* jambs */}
      {px(528, 54, 18, 96, CLAY[ph].base)}
      {px(542, 54, 4, 96, OAK[ph].mid)}
      {px(662, 54, 18, 96, CLAY[ph].base)}
      {px(662, 54, 4, 96, OAK[ph].mid)}
      {/* bottom rail and track */}
      {px(546, 144, 116, 6, OAK[ph].mid)}
      {px(546, 144, 116, 1, OAK[ph].hi)}
      {/* fixed pane 546–602 — a tint over the yard, never a painting of it */}
      <rect
        x={546}
        y={58}
        width={56}
        height={86}
        fill={glass}
        opacity={ph === "night" ? 0.38 : 0.28}
      />
      <rect x={546} y={58} width={56} height={86} fill="url(#px-satin)" opacity={0.3} />
      {ph === "night" && s.lit ? (
        <path
          d={pxPath([
            [566, 66, 2, 44],
            [584, 78, 1, 30],
          ])}
          fill={K.warm}
          opacity={0.14}
        />
      ) : null}
      {px(602, 54, 4, 96, OAK[ph].base)}
      {/* sliding leaf 606–662, shifted along its track when someone is going out */}
      <g style={{ transition: STEP_SLIDE, transform: open ? "translateX(-54px)" : "none" }}>
        {px(606, 54, 4, 96, OAK[ph].base)}
        {px(658, 54, 4, 96, OAK[ph].base)}
        <rect
          x={610}
          y={58}
          width={48}
          height={86}
          fill={glass}
          opacity={ph === "night" ? 0.38 : 0.28}
        />
        <rect x={610} y={58} width={48} height={86} fill="url(#px-satin)" opacity={0.3} />
        {px(654, 96, 3, 10, STEEL[ph].base)}
      </g>
      {open ? (
        <path d={pxPath([[604, 58, 6, 86]])} fill={dth("c", "50")} opacity={0.5}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.5;0.3;0.5;0.4"
            dur="3.1s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* rain running down the big glass */}
      {s.weather === "rain" ? (
        <g opacity={0.55}>
          <path
            d={pxPath([
              [556, 62, 1, 9],
              [578, 76, 1, 7],
              [594, 60, 1, 8],
              [622, 70, 1, 9],
              [640, 88, 1, 7],
              [652, 62, 1, 6],
            ])}
            fill={K.waterHi}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 70"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* reflections: three stepped strokes, nothing smooth */}
      <path
        d={pxPath([
          [552, 64, 2, 60],
          [560, 72, 1, 44],
          [618, 66, 2, 56],
        ])}
        fill="#ffffff"
        opacity={ph === "night" ? 0.06 : 0.14}
      />
      {/* curtain rail, the tulle, and the heavy plum curtain bunched right */}
      {px(532, 52, 144, 2, M.brass.lo)}
      <g style={{ transformOrigin: "560px 54px" }}>
        {s.winOpen || open ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 560 54;-2 560 54;1 560 54;0 560 54"
            dur="6.4s"
            repeatCount="indefinite"
          />
        ) : null}
        {px(548, 54, 34, 88, K.tulle)}
        <path
          d={pxPath([
            [552, 54, 1, 88],
            [560, 54, 1, 88],
            [568, 54, 1, 88],
            [576, 54, 1, 88],
          ])}
          fill="#ffffff"
          opacity={0.5}
        />
      </g>
      {px(652, 54, 24, 92, K.curtain)}
      <rect x={652} y={54} width={24} height={92} fill="url(#px-weave)" opacity={0.6} />
      <path
        d={pxPath([
          [656, 54, 2, 92],
          [664, 54, 2, 92],
          [671, 54, 2, 92],
        ])}
        fill={K.curtainLo}
      />
      {px(650, 108, 28, 4, K.curtainLo)}
    </g>
  );
}

/* === PLANE 3 — ground: the floor ============================================== */

function Floor({ ph, s }: { ph: Ph; s: StudioSt }) {
  return (
    <g>
      {/* stone tile from the door to the nook, oak boards beyond */}
      {px(0, FLOOR, 406, H - FLOOR, STONE[ph].base)}
      <rect x={0} y={FLOOR} width={406} height={H - FLOOR} fill="url(#px-agg)" opacity={0.4} />
      <path d={FLOOR_TILE.rows} fill={STONE[ph].lo} opacity={0.7} />
      <path d={FLOOR_TILE.cols} fill={STONE[ph].lo} opacity={0.5} />
      {px(402, FLOOR, 6, H - FLOOR, OAK[ph].lo)}
      {px(408, FLOOR, W - 408, H - FLOOR, BOARD[ph].base)}
      <rect
        x={408}
        y={FLOOR}
        width={W - 408}
        height={H - FLOOR}
        fill="url(#px-wood)"
        opacity={0.5}
      />
      <path d={FLOOR_BOARDS.seams} fill={BOARD[ph].lo} />
      <path d={FLOOR_BOARDS.joints} fill={BOARD[ph].deep} opacity={0.7} />
      {/* the doormat, ribbed, older than the door */}
      {px(14, 152, 48, 14, pcol("#6f5e48", ph))}
      <path d={pxPath(repeat(6, 8, [16, 154, 4, 10] as Rect))} fill={pcol("#5e4e3a", ph)} />
      {px(14, 152, 48, 1, pcol("#8a7658", ph))}
      {/* the kitchen runner — grey stripes, permanently slightly crooked */}
      {px(190, 156, 110, 20, pcol("#8d8a94", ph))}
      <path d={pxPath(repeat(9, 12, [194, 158, 6, 16] as Rect))} fill={pcol("#7f7c88", ph)} />
      {px(190, 156, 110, 1, pcol("#a09daa", ph))}
      {px(296, 174, 4, 2, pcol("#7f7c88", ph))}
      {/* the living rug: wool, a border, one corner that never lies flat */}
      {px(748, 152, 164, 26, pcol(K.rug, ph))}
      <rect x={748} y={152} width={164} height={26} fill="url(#px-weave)" opacity={0.5} />
      <path
        d={pxPath([
          [752, 154, 156, 1],
          [752, 175, 156, 1],
          [752, 154, 1, 22],
          [907, 154, 1, 22],
        ])}
        fill={pcol(K.rugPat, ph)}
      />
      <path
        d={pxPath([
          [780, 162, 8, 2],
          [820, 168, 8, 2],
          [864, 160, 8, 2],
        ])}
        fill={pcol(K.rugPat, ph)}
        opacity={0.7}
      />
      {px(748, 152, 8, 3, pcol(K.rugLo, ph))}
      {/* dust where the mop does not reach */}
      <path
        d={pxPath([
          [238, 151, 26, 1],
          [446, 151, 22, 1],
          [700, 151, 24, 1],
        ])}
        fill={KWALL[ph].deep}
        opacity={0.6}
      />
      {/* slippers outside the bathroom, toes to the door */}
      <path
        d={pxPath([
          [438, 146, 8, 3],
          [448, 146, 8, 3],
        ])}
        fill={pcol("#8d6a5a", ph)}
      />
      <path
        d={pxPath([
          [438, 146, 8, 1],
          [448, 146, 8, 1],
        ])}
        fill={pcol("#a4826e", ph)}
      />
      {/* the rope toy that migrated to the nook and was abandoned there */}
      <path
        d={pxPath([
          [498, 146, 7, 3],
          [500, 145, 3, 1],
        ])}
        fill={pcol("#7d6448", ph)}
      />
      {/* paw prints between the bed and the bowls, faint, in dog order */}
      <path
        d={pxPath([
          [590, 160, 2, 2],
          [596, 166, 2, 2],
          [604, 158, 2, 2],
          [612, 164, 2, 2],
          [620, 157, 2, 2],
        ])}
        fill={BOARD[ph].deep}
        opacity={0.45}
      />
      {/* one sock that never made it to the wash, under the sofa's shadow */}
      {px(806, 154, 7, 3, "#5e5952")}
      {px(806, 154, 7, 1, "#6f6a62")}
      {/* the guitar pick that fell and was declared lost */}
      {px(786, 162, 2, 2, "#c9762a")}
      <Contact set={FLOOR_CONTACT} op={s.lit ? 0.9 : 0.6} />
    </g>
  );
}

/* === PLANE 4 — staticObjects: the kitchen run ================================= */

function Kitchen({ ph, s }: { ph: Ph; s: StudioSt }) {
  const ledOn = s.lit;
  return (
    <g>
      {/* wall units, left run: three doors and the open shelf over the kettle */}
      <Bevel boxes={[[116, UNIT_TOP, 94, UNIT_BOT - UNIT_TOP]]} mat={KWALL[ph]} />
      <path
        d={pxPath([
          [146, UNIT_TOP, 1, 27],
          [178, UNIT_TOP, 1, 27],
        ])}
        fill={KWALL[ph].deep}
      />
      <path
        d={pxPath([
          [136, 88, 8, 1],
          [168, 88, 8, 1],
          [196, 88, 8, 1],
        ])}
        fill={KWALL[ph].deep}
      />
      {/* wall units, right of the window: one door, then the hood, the microwave */}
      <Bevel boxes={[[284, UNIT_TOP, 22, UNIT_BOT - UNIT_TOP]]} mat={KWALL[ph]} />
      {px(292, 88, 8, 1, KWALL[ph].deep)}
      <Bev set={HOOD_SET} mat={STEEL[ph]} />
      {px(308, 76, 30, 2, STEEL[ph].deep)}
      {s.cooker === "on" ? (
        <path d={pxPath([[310, 80, 26, 2]])} fill={dth("w", "25")} opacity={0.8} />
      ) : null}
      {/* the microwave in its niche, clock forever unset after the last outage */}
      <Bevel boxes={[[344, UNIT_TOP, 30, UNIT_BOT - UNIT_TOP]]} mat={KWALL[ph]} />
      <Bev set={MICRO_SET} mat={GRAPHITE[ph]} />
      {px(348, 74, 16, 14, "#1d2027")}
      {px(350, 76, 12, 10, "#12141a")}
      {px(366, 74, 6, 14, GRAPHITE[ph].lo)}
      {/* the unset clock: two green dots, blinking since the last outage */}
      <path
        d={pxPath([
          [368, 78, 1, 1],
          [368, 80, 1, 1],
        ])}
        fill={K.green}
        opacity={0.8}
      >
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.8;0;0.8"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>
      {/* the LED strip under the units */}
      <path
        d={pxPath([
          [118, UNIT_BOT, 92, 1],
          [286, UNIT_BOT, 88, 1],
        ])}
        fill={ledOn ? K.ledCool : KWALL[ph].deep}
        opacity={ledOn ? 0.9 : 0.6}
      />
      {/* spice shelf on the splashback — the small jars run the whole kitchen */}
      {px(126, 100, 36, 2, OAK[ph].base)}
      {px(126, 100, 36, 1, OAK[ph].hi)}
      <path
        d={pxPath([
          [129, 94, 5, 6],
          [136, 93, 5, 7],
          [143, 94, 5, 6],
          [150, 95, 5, 5],
        ])}
        fill="#8a6a3a"
      />
      <path
        d={pxPath([
          [129, 94, 5, 2],
          [136, 93, 5, 2],
          [143, 94, 5, 2],
          [150, 95, 5, 2],
        ])}
        fill="#c9a24b"
      />
      {/* the kitchen clock, five minutes fast on purpose */}
      {px(186, 50, 12, 12, K.linen)}
      {px(186, 50, 12, 1, "#f6f0e0")}
      {px(187, 51, 10, 10, "#f2ede0")}
      <path
        d={pxPath([
          [191, 53, 2, 4],
          [193, 56, 3, 1],
        ])}
        fill="#3a3e44"
      />
      {/* worktop and the graphite carcass under it */}
      {px(112, WORKTOP, 264, 4, OAK[ph].base)}
      {px(112, WORKTOP, 264, 1, OAK[ph].hi)}
      {px(112, WORKTOP + 4, 264, 2, OAK[ph].deep)}
      {px(112, 122, 264, 28, GRAPHITE[ph].base)}
      <rect x={112} y={122} width={264} height={28} fill="url(#px-satin)" opacity={0.25} />
      <path
        d={pxPath([
          [148, 122, 1, 28],
          [180, 122, 1, 28],
          [212, 122, 1, 28],
          [280, 122, 1, 28],
          [308, 122, 1, 28],
          [336, 122, 1, 28],
        ])}
        fill={GRAPHITE[ph].deep}
      />
      {/* drawer fronts left, then door handles */}
      <path
        d={pxPath([
          [116, 128, 28, 1],
          [116, 138, 28, 1],
        ])}
        fill={GRAPHITE[ph].deep}
      />
      <path
        d={pxPath([
          [126, 124, 8, 1],
          [126, 131, 8, 1],
          [126, 141, 8, 1],
          [160, 126, 8, 1],
          [192, 126, 8, 1],
          [288, 126, 8, 1],
        ])}
        fill={STEEL[ph].base}
      />
      {/* plinth */}
      {px(112, 146, 264, 4, GRAPHITE[ph].deep)}
      {/* the tea towel through the oven rail, striped */}
      {px(196, 122, 10, 14, K.linen)}
      <path
        d={pxPath([
          [196, 125, 10, 1],
          [196, 130, 10, 1],
        ])}
        fill="#a4553f"
      />
      {/* kettle on its base, spout to the wall */}
      {px(160, 114, 20, 2, GRAPHITE[ph].lo)}
      <Bevel boxes={[[162, 100, 15, 14]]} mat={STEEL[ph]} />
      {px(176, 102, 3, 8, STEEL[ph].lo)}
      {px(166, 98, 8, 2, STEEL[ph].base)}
      <path d={pxPath([[164, 110, 2, 2]])} fill={s.kettleOn ? "#4a90d9" : STEEL[ph].deep}>
        {s.kettleOn ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.5;1"
            dur="1.2s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      {/* its cord, to the socket that also feeds the machine */}
      <path
        d={pxPath([
          [178, 112, 1, 4],
          [173, 104, 1, 1],
        ])}
        fill="#4a4e55"
      />
      {/* the small table, two stools — one usually holding a jacket */}
      <Bev set={TABLE_SET} mat={OAK[ph]} />
      <rect x={126} y={121} width={60} height={5} fill="url(#px-wood)" opacity={0.5} />
      <path
        d={pxPath([
          [130, 126, 3, 24],
          [179, 126, 3, 24],
        ])}
        fill={OAK[ph].lo}
      />
      {px(132, 136, 48, 2, OAK[ph].mid)}
      {/* stools tucked in, mostly */}
      <path
        d={pxPath([
          [138, 130, 14, 3],
          [140, 133, 2, 17],
          [148, 133, 2, 17],
        ])}
        fill={OAK[ph].mid}
      />
      <path
        d={pxPath([
          [160, 130, 14, 3],
          [162, 133, 2, 17],
          [170, 133, 2, 17],
        ])}
        fill={OAK[ph].mid}
      />
      {ph === "dawn" ? (
        <g>
          {/* breakfast: the bowl, the mug, the board with bread */}
          {px(136, 117, 8, 4, "#3f6fd9")}
          {px(148, 116, 5, 5, K.linen)}
          {px(158, 118, 12, 3, OAK[ph].lo)}
          {px(161, 116, 6, 2, "#c9a24b")}
        </g>
      ) : (
        <g>
          {/* the fruit bowl that keeps the table honest */}
          {px(146, 117, 14, 4, TILE[ph].lo)}
          <path
            d={pxPath([
              [148, 115, 4, 2],
              [153, 114, 4, 3],
              [150, 113, 3, 2],
            ])}
            fill="#c9762a"
          />
        </g>
      )}
      {ph === "dusk" || ph === "night" ? (
        <g>
          {/* the jacket over the far stool */}
          {px(159, 127, 16, 8, "#4a5a48")}
          {px(159, 127, 16, 2, "#5a6a58")}
          <path d={pxPath([[162, 135, 4, 6]])} fill="#42513f" />
        </g>
      ) : null}
      {/* the speaker, playing or not */}
      <Bevel boxes={[[190, 104, 14, 12]]} mat={GRAPHITE[ph]} />
      <path d={pxPath([[193, 107, 8, 6]])} fill={GRAPHITE[ph].deep} />
      <path d={pxPath([[201, 105, 1, 1]])} fill={s.radioOn ? K.green : "#4a4d52"} />
      {s.radioOn ? (
        <g>
          <rect x={193} y={109} width={2} height={3} fill={K.green} opacity={0.8}>
            <animate
              attributeName="height"
              calcMode="discrete"
              values="3;5;2;4"
              dur="0.9s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              calcMode="discrete"
              values="109;107;110;108"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x={196} y={108} width={2} height={4} fill={K.green} opacity={0.8}>
            <animate
              attributeName="height"
              calcMode="discrete"
              values="4;2;5;3"
              dur="1.1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="y"
              calcMode="discrete"
              values="108;110;107;109"
              dur="1.1s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {/* dish rack; the pan never fully dries */}
      {px(206, 112, 20, 4, STEEL[ph].lo)}
      <path
        d={pxPath([
          [208, 104, 2, 8],
          [213, 104, 2, 8],
          [218, 104, 2, 8],
        ])}
        fill={s.dishes ? KWALL[ph].lo : K.linen}
      />
      {px(222, 106, 4, 6, STEEL[ph].base)}
      {/* the sink: rim, tap, and the morning's dishes until somebody deals with them */}
      {px(228, 114, 44, 2, STEEL[ph].hi)}
      {px(230, WORKTOP, 40, 2, STEEL[ph].mid)}
      {px(246, 98, 3, 16, STEEL[ph].base)}
      {px(246, 96, 10, 3, STEEL[ph].hi)}
      {px(254, 99, 2, 3, STEEL[ph].lo)}
      {s.dishes ? (
        <g>
          {/* the stack: two plates, the pot, a mug at an angle */}
          <path
            d={pxPath([
              [232, 110, 14, 2],
              [234, 108, 10, 2],
            ])}
            fill={KWALL[ph].lo}
          />
          {px(236, 102, 10, 6, STEEL[ph].mid)}
          {px(237, 100, 3, 2, STEEL[ph].lo)}
          {px(250, 108, 6, 6, "#a8c2d4")}
        </g>
      ) : null}
      {/* washing-up liquid and the sponge that has seen things */}
      {px(262, 104, 4, 10, K.green)}
      {px(263, 102, 2, 2, "#2a8a5a")}
      {px(268, 110, 6, 4, "#e8c832")}
      {/* knife strip and the leaning board */}
      {px(278, 96, 24, 2, GRAPHITE[ph].lo)}
      <path
        d={pxPath([
          [281, 98, 2, 9],
          [287, 98, 2, 8],
          [293, 98, 2, 10],
          [299, 98, 2, 7],
        ])}
        fill={STEEL[ph].base}
      />
      <path
        d={pxPath([
          [281, 96, 2, 2],
          [287, 96, 2, 2],
          [293, 96, 2, 2],
          [299, 96, 2, 2],
        ])}
        fill={OAK[ph].lo}
      />
      {px(284, 102, 14, 14, OAK[ph].base)}
      {px(284, 102, 14, 1, OAK[ph].hi)}
      {/* the cooker: induction top, oven below, the display that knows the time */}
      {px(308, 112, 28, 4, "#14161a")}
      <path
        d={pxPath([
          [312, 113, 6, 2],
          [324, 113, 6, 2],
        ])}
        fill={s.cooker === "on" ? K.ember : "#2e3238"}
      />
      {s.cooker === "on" ? (
        <path d={pxPath([[312, 113, 6, 2]])} fill="#ff9e58">
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.6;1;0.8"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      <Bevel boxes={[[308, 118, 28, 28]]} mat={GRAPHITE[ph]} />
      {px(310, 121, 24, 2, STEEL[ph].base)}
      <PixelText
        x={312}
        y={125}
        text={s.cooker === "on" ? "18:40" : "12:00"}
        fill={s.cooker === "on" ? K.ember : "#5a5e66"}
        gap={0}
      />
      {s.cooker === "open" ? (
        <g>
          {/* the door is down: racks, the tray that remembers Friday */}
          {px(310, 130, 24, 14, "#1d2027")}
          <path
            d={pxPath([
              [312, 134, 20, 1],
              [312, 139, 20, 1],
            ])}
            fill="#4a4e55"
          />
          {px(314, 137, 14, 2, STEEL[ph].lo)}
          {px(306, 144, 32, 4, GRAPHITE[ph].hi)}
        </g>
      ) : (
        <g>
          {px(312, 132, 20, 10, s.cooker === "on" ? "#3a2a20" : "#1d2027")}
          {s.cooker === "on" ? (
            <rect x={314} y={134} width={16} height={6} fill={K.ember} opacity={0.5}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.5;0.7;0.45;0.6"
                dur="2.1s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}
        </g>
      )}
      {/* the pot, only when something is actually cooking */}
      {s.cooker === "on" ? (
        <g>
          {px(312, 104, 16, 8, STEEL[ph].base)}
          {px(312, 104, 16, 1, STEEL[ph].hi)}
          {px(310, 103, 20, 2, STEEL[ph].lo)}
          {px(328, 106, 4, 2, STEEL[ph].deep)}
        </g>
      ) : null}
      {/* the pedal bin, and at dusk the bag that has crested the rim */}
      <Bevel boxes={[[346, 122, 16, 26]]} mat={STEEL[ph]} />
      {px(346, 122, 16, 2, STEEL[ph].hi)}
      {px(352, 146, 6, 2, STEEL[ph].deep)}
      {s.binFull ? (
        <g>
          {px(347, 114, 14, 8, "#3a4048")}
          {px(349, 112, 8, 4, "#4a525c")}
          {px(352, 110, 4, 3, "#2e343c")}
          {/* the flattened box leaning beside it, waiting for the trip down */}
          {px(338, 128, 6, 20, K.cardboard)}
          {px(338, 128, 6, 2, "#c9a24b")}
        </g>
      ) : null}
      {/* the espresso machine — it hisses like it's judging you */}
      <Bevel boxes={[[356, 98, 18, 18]]} mat={GRAPHITE[ph]} />
      {px(358, 100, 14, 4, STEEL[ph].base)}
      {px(361, 108, 8, 3, STEEL[ph].lo)}
      {px(362, 111, 6, 5, K.linen)}
      <path d={pxPath([[370, 100, 2, 2]])} fill={s.lit ? K.warm : "#4a4d52"} opacity={0.9} />
      {/* its cord to the shared socket */}
      <path
        d={pxPath([
          [372, 108, 1, 8],
          [368, 104, 1, 1],
        ])}
        fill="#4a4e55"
      />
    </g>
  );
}

function Fridge({ ph, s }: { ph: Ph; s: StudioSt }) {
  return (
    <g>
      {s.fridgeOpen ? (
        <g>
          {/* the box, open: shelves, the light that still works */}
          {px(377, 78, 24, 72, WHITE[ph].lo)}
          {px(379, 80, 20, 66, "#e8f2f6")}
          <path
            d={pxPath([
              [379, 96, 20, 1],
              [379, 112, 20, 1],
              [379, 128, 20, 1],
            ])}
            fill="#b0c2ca"
          />
          {/* eggs, butter, yesterday's soup; the milk in the door that left with it */}
          {px(381, 90, 6, 6, K.linen)}
          {px(389, 91, 5, 5, "#e8c832")}
          {px(382, 104, 8, 8, STEEL[ph].base)}
          {px(392, 106, 5, 6, "#a4553f")}
          {px(383, 120, 5, 8, "#f2f4ee")}
          {px(390, 122, 6, 6, M.leaf.base)}
          {ph === "dawn" ? px(382, 131, 8, 5, "#f2e6c0") : null}
          <rect x={379} y={80} width={20} height={66} fill={K.ledCool} opacity={0.2}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.2;0.3;0.2"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </rect>
          {/* the door, swung to the left over the counter */}
          {px(352, 78, 25, 68, WHITE[ph].base)}
          {px(352, 78, 25, 2, WHITE[ph].hi)}
          {px(352, 144, 25, 2, WHITE[ph].deep)}
          <path
            d={pxPath([
              [354, 84, 21, 6],
              [354, 94, 21, 6],
            ])}
            fill="#dce4e8"
          />
        </g>
      ) : (
        <g>
          <Bev set={FRIDGE_SET} mat={WHITE[ph]} />
          <rect x={377} y={78} width={24} height={68} fill="url(#px-satin)" opacity={0.3} />
          {px(377, 100, 24, 2, WHITE[ph].deep)}
          {px(378, 82, 2, 14, STEEL[ph].base)}
          {px(378, 104, 2, 20, STEEL[ph].base)}
          {/* the door archive: magnets, the shopping list, a postcard from home */}
          {px(384, 84, 5, 6, "#dfe8ec")}
          {px(390, 86, 3, 3, K.red)}
          {px(382, 106, 7, 9, K.linen)}
          <path
            d={pxPath([
              [383, 108, 5, 1],
              [383, 111, 4, 1],
            ])}
            fill="#8a8368"
          />
          {px(391, 108, 7, 5, K.flagBlue)}
          {px(391, 111, 7, 2, K.flagYellow)}
          {px(386, 122, 6, 7, "#c9a878")}
          {px(387, 123, 4, 4, "#8a6a3a")}
        </g>
      )}
      {px(377, 146, 24, 4, GRAPHITE[ph].deep)}
      {/* the three-litre jars on top — the debt carried quietly */}
      <path
        d={pxPath([
          [380, 68, 6, 10],
          [388, 70, 6, 8],
          [396, 68, 5, 10],
        ])}
        fill="#b8c9b0"
        opacity={0.8}
      />
      <path
        d={pxPath([
          [381, 67, 4, 1],
          [389, 69, 4, 1],
          [397, 67, 3, 1],
        ])}
        fill={M.brass.base}
      />
      <path
        d={pxPath([
          [381, 70, 1, 7],
          [389, 72, 1, 5],
        ])}
        fill="#ffffff"
        opacity={0.4}
      />
    </g>
  );
}

function DogCorner({ ph, s }: { ph: Ph; s: StudioSt }) {
  return (
    <g>
      {/* the robot vacuum on its dock, holding the line of the truce */}
      {px(532, 138, 4, 12, GRAPHITE[ph].base)}
      {px(532, 138, 4, 1, GRAPHITE[ph].hi)}
      <Bevel boxes={[[536, 142, 15, 8]]} mat={GRAPHITE[ph]} />
      {px(541, 143, 4, 2, STEEL[ph].base)}
      <path d={pxPath([[534, 140, 1, 1]])} fill={K.green}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.3;1;1"
          dur="3.2s"
          begin="-1s"
          repeatCount="indefinite"
        />
      </path>
      {/* the feed sack, rolled shut at the top */}
      {px(562, 128, 12, 22, pcol(K.cardboard, ph))}
      <rect x={562} y={128} width={12} height={22} fill="url(#px-weave)" opacity={0.4} />
      {px(562, 128, 12, 3, pcol("#8a6a3a", ph))}
      {px(564, 136, 8, 6, pcol("#8a4a3a", ph))}
      {/* the bowls on their mat; the water bobs, the kibble is a state read */}
      {px(576, 146, 36, 3, pcol("#6f5e48", ph))}
      {px(580, 141, 12, 6, "#3f6fd9")}
      {px(581, 142, 10, 2, K.water)}
      <rect x={581} y={142} width={10} height={1} fill={K.waterHi}>
        <animate
          attributeName="y"
          calcMode="discrete"
          values="142;143;142"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </rect>
      {px(596, 141, 12, 6, "#c9762a")}
      {s.fed ? (
        <path
          d={pxPath([
            [598, 140, 3, 2],
            [602, 139, 3, 2],
            [605, 141, 2, 1],
          ])}
          fill={K.kibble}
        />
      ) : (
        <path d={pxPath([[598, 143, 8, 1]])} fill="#8a5a2a" opacity={0.5} />
      )}
      {/* the bed he chose himself */}
      {px(616, 134, 48, 16, pcol("#6a5f48", ph))}
      {px(618, 132, 44, 4, pcol("#7d7058", ph))}
      {px(622, 138, 36, 10, pcol("#8f8268", ph))}
      <rect x={616} y={132} width={48} height={18} fill="url(#px-weave)" opacity={0.4} />
      {px(650, 134, 14, 6, pcol("#a4553f", ph))}
      {/* the toy of the week */}
      {px(604, 146, 6, 4, K.red)}
      {px(605, 145, 2, 1, "#ff8a7a")}
    </g>
  );
}

/* === PLANE 4b — staticObjects: the living corner ============================== */

function Living({ ph, s }: { ph: Ph; s: StudioSt }) {
  return (
    <g>
      {/* the leash coiled on the shelf's flank — walks happen from here */}
      {px(672, 96, 2, 3, M.brass.lo)}
      <path
        d={pxPath([
          [669, 99, 7, 2],
          [668, 101, 2, 6],
          [674, 101, 2, 6],
          [669, 107, 7, 2],
        ])}
        fill="#a4553f"
      />
      {/* the bookshelf, and the art brut shouting quietly above it */}
      {px(688, 52, 36, 34, OAK[ph].deep)}
      {px(690, 54, 32, 30, K.linen)}
      <path
        d={pxPath([
          [693, 58, 8, 10],
          [704, 62, 9, 8],
          [696, 72, 12, 6],
        ])}
        fill="#c94a3a"
      />
      <path
        d={pxPath([
          [705, 57, 5, 4],
          [694, 70, 4, 4],
        ])}
        fill="#3f6fd9"
      />
      <path d={pxPath([[700, 66, 6, 3]])} fill="#e8c832" />
      <Bev set={SHELF_SET} mat={OAK[ph]} />
      <rect x={676} y={90} width={44} height={58} fill="url(#px-wood)" opacity={0.5} />
      <path
        d={pxPath([
          [678, 106, 40, 2],
          [678, 124, 40, 2],
        ])}
        fill={OAK[ph].deep}
      />
      {/* top shelf: books at book angles, the pothos doing its slow escape */}
      <path
        d={pxPath([
          [679, 94, 4, 12],
          [684, 96, 4, 10],
          [689, 93, 3, 13],
          [693, 96, 4, 10],
        ])}
        fill="#5a6a8a"
      />
      <path
        d={pxPath([
          [684, 96, 4, 2],
          [693, 96, 4, 2],
        ])}
        fill="#8a4a3a"
      />
      {px(698, 98, 8, 8, M.red.lo)}
      <path
        d={pxPath([
          [700, 94, 6, 4],
          [706, 98, 4, 3],
          [708, 104, 4, 3],
        ])}
        fill={M.leaf.base}
      />
      {px(710, 96, 6, 10, K.linen)}
      {px(711, 98, 4, 5, "#8a8368")}
      {/* middle: the PS5 games, the dictionary, the box of cables */}
      <path
        d={pxPath([
          [679, 112, 3, 12],
          [683, 110, 3, 14],
          [687, 112, 3, 12],
        ])}
        fill="#f2f4ee"
      />
      <path d={pxPath([[683, 110, 3, 3]])} fill="#3f6fd9" />
      {px(692, 114, 12, 10, "#4a6a5a")}
      {px(706, 116, 10, 8, K.cardboard)}
      <path d={pxPath([[708, 118, 6, 2]])} fill="#4a4e55" />
      {/* bottom: the heavy books lying down, as heavy books do */}
      <path
        d={pxPath([
          [679, 138, 16, 4],
          [681, 134, 12, 4],
          [700, 140, 16, 3],
        ])}
        fill="#6a5a48"
      />
      <path d={pxPath([[681, 134, 12, 1]])} fill="#8a7658" />
      {/* the media unit: doors shut on the cable chaos */}
      <Bev set={MEDIA_SET} mat={OAK[ph]} />
      <rect x={712} y={128} width={88} height={20} fill="url(#px-wood)" opacity={0.5} />
      <path
        d={pxPath([
          [740, 128, 1, 20],
          [770, 128, 1, 20],
        ])}
        fill={OAK[ph].deep}
      />
      <path
        d={pxPath([
          [724, 136, 6, 1],
          [752, 136, 6, 1],
        ])}
        fill={STEEL[ph].base}
      />
      {/* router on the open end, one light that means everything is fine */}
      {px(776, 120, 16, 8, "#f2f4ee")}
      {px(778, 116, 2, 4, "#c9c5b8")}
      <path d={pxPath([[788, 123, 2, 2]])} fill={K.green}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;1;0.4;1"
          dur="2.1s"
          begin="-0.7s"
          repeatCount="indefinite"
        />
      </path>
      {/* PS5 standing beside the TV: white fins, blue seam when the room is dark */}
      {px(718, 112, 3, 16, "#f2f4ee")}
      {px(724, 112, 3, 16, "#f2f4ee")}
      {px(721, 114, 3, 14, "#1d2027")}
      {s.tv !== "off" ? <path d={pxPath([[721, 114, 3, 1]])} fill="#4a90d9" opacity={0.9} /> : null}
      {/* games stacked flat */}
      <path
        d={pxPath([
          [758, 124, 10, 2],
          [759, 122, 10, 2],
        ])}
        fill="#3f6fd9"
      />
      {/* the TV cable dropping behind the unit */}
      {px(750, 111, 1, 17, "#2e3238")}
      {/* the guitar on its stand — put away at night unless it has been out */}
      {s.guitarOut ? (
        <g>
          <path
            d={pxPath([
              [767, 146, 7, 3],
              [780, 146, 7, 3],
              [770, 138, 2, 9],
              [782, 138, 2, 9],
            ])}
            fill={GRAPHITE[ph].base}
          />
          {px(771, 122, 12, 24, "#c9762a")}
          {px(773, 126, 8, 17, "#b05e1e")}
          {px(775, 130, 4, 5, "#2e2218")}
          {px(776, 110, 2, 12, "#5a4632")}
          {px(774, 105, 6, 6, "#3a2c1e")}
          <path
            d={pxPath([
              [773, 106, 1, 1],
              [780, 106, 1, 1],
              [773, 109, 1, 1],
              [780, 109, 1, 1],
            ])}
            fill={M.brass.base}
          />
          <path d={pxPath([[776, 111, 1, 32]])} fill="#e8e2d2" opacity={0.5} />
        </g>
      ) : (
        <path
          d={pxPath([
            [767, 146, 7, 3],
            [780, 146, 7, 3],
            [770, 140, 2, 7],
            [782, 140, 2, 7],
          ])}
          fill={GRAPHITE[ph].base}
        />
      )}
      {/* the coffee table and its standing committee */}
      <Bev set={CTABLE_SET} mat={OAK[ph]} />
      <rect x={792} y={132} width={64} height={4} fill="url(#px-wood)" opacity={0.5} />
      <path
        d={pxPath([
          [796, 136, 3, 14],
          [849, 136, 3, 14],
        ])}
        fill={OAK[ph].lo}
      />
      {px(798, 142, 52, 2, OAK[ph].mid)}
      <path
        d={pxPath([
          [806, 138, 16, 4],
          [826, 139, 10, 3],
        ])}
        fill="#8a8368"
      />
      {/* the laptop, open to whatever was left running */}
      {px(798, 128, 24, 4, GRAPHITE[ph].base)}
      {px(800, 116, 20, 12, GRAPHITE[ph].lo)}
      {px(802, 118, 16, 9, ph === "night" && !s.lit ? "#1a2a28" : K.crt)}
      <path
        d={pxPath([
          [803, 120, 10, 1],
          [803, 123, 7, 1],
        ])}
        fill={ph === "night" && !s.lit ? "#2a4a44" : "#5a7a6e"}
      />
      <path d={pxPath([[812, 125, 2, 1]])} fill="#8fd0b8">
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;1;0;0"
          dur="1.1s"
          repeatCount="indefinite"
        />
      </path>
      {px(808, 112, 4, 4, "#c9c5b8")}
      {/* its charger, down the table leg to the socket the lamp also wants */}
      <path
        d={pxPath([
          [798, 130, 1, 4],
          [797, 134, 1, 14],
          [790, 147, 8, 1],
          [789, 132, 1, 15],
        ])}
        fill="#4a4e55"
      />
      {/* the mug, the phone face down, the remote out of reach of the sofa */}
      {px(824, 126, 7, 6, "#3f6fd9")}
      {px(831, 128, 2, 3, "#3556a8")}
      {px(836, 130, 9, 2, GRAPHITE[ph].base)}
      {px(845, 129, 8, 3, GRAPHITE[ph].lo)}
      <path d={pxPath([[846, 130, 1, 1]])} fill={K.red} opacity={0.8} />
      {/* the arc lamp leaning over all of it */}
      {px(780, 146, 18, 4, STEEL[ph].lo)}
      {px(786, 92, 3, 54, STEEL[ph].base)}
      <path
        d={pxPath([
          [787, 84, 8, 3],
          [794, 78, 10, 3],
          [803, 74, 12, 3],
          [814, 72, 10, 3],
        ])}
        fill={STEEL[ph].base}
      />
      {px(812, 74, 18, 8, s.lit ? "#e8c98a" : STEEL[ph].mid)}
      {px(812, 74, 18, 2, s.lit ? "#f2dda8" : STEEL[ph].hi)}
      {/* the sofa: slate, deep, one throw, two cushions, a blanket for the dog nights */}
      <Bev set={SOFA_SET} mat={SOFA[ph]} />
      {px(832, 118, 70, 15, SOFA[ph].mid)}
      <rect x={816} y={108} width={102} height={40} fill="url(#px-weave)" opacity={0.35} />
      {px(832, 133, 70, 7, SOFA[ph].base)}
      {px(832, 133, 70, 1, SOFA[ph].hi)}
      {px(832, 140, 70, 8, SOFA[ph].lo)}
      <path
        d={pxPath([
          [866, 118, 1, 15],
          [866, 133, 1, 7],
        ])}
        fill={SOFA[ph].deep}
      />
      {/* legs */}
      <path
        d={pxPath([
          [820, 148, 3, 2],
          [896, 148, 3, 2],
        ])}
        fill={OAK[ph].deep}
      />
      {/* cushions: one striped, one from the market */}
      {px(838, 120, 12, 10, "#a4553f")}
      <path
        d={pxPath([
          [840, 120, 2, 10],
          [845, 120, 2, 10],
        ])}
        fill="#8a4232"
      />
      {px(872, 120, 12, 10, "#c9a24b")}
      <path d={pxPath([[875, 123, 6, 4]])} fill="#a8823a" />
      {/* the throw over the left arm */}
      {px(814, 106, 20, 12, K.throwRed)}
      <rect x={814} y={106} width={20} height={12} fill="url(#px-weave)" opacity={0.5} />
      {px(814, 106, 20, 2, "#b8664e")}
      {/* the folded blanket on the right seat */}
      <path
        d={pxPath([
          [886, 128, 14, 5],
          [887, 126, 12, 2],
        ])}
        fill={K.duvet}
      />
      {/* the flag, and the shelf of small important things under it */}
      {px(850, 54, 46, 16, K.flagBlue)}
      {px(850, 70, 46, 15, K.flagYellow)}
      <path
        d={pxPath([
          [858, 54, 1, 31],
          [878, 54, 1, 31],
        ])}
        fill="#00000022"
      />
      <path
        d={pxPath([
          [851, 53, 2, 2],
          [893, 53, 2, 2],
        ])}
        fill={M.brass.base}
      />
      <Bev set={FLAGSHELF_SET} mat={OAK[ph]} />
      {/* on it: the framed three of them, a candle, the medal from Kharkiv juniors */}
      {px(850, 88, 8, 8, M.brass.lo)}
      {px(851, 89, 6, 6, K.linen)}
      {px(852, 91, 4, 3, "#8a8368")}
      {px(864, 90, 5, 6, "#e8e2d2")}
      {px(866, 88, 1, 2, "#8a8368")}
      <path
        d={pxPath([
          [876, 90, 6, 6],
          [878, 87, 2, 3],
        ])}
        fill={M.brass.base}
      />
      <path d={pxPath([[878, 92, 2, 2]])} fill={M.brass.deep} />
      {/* the side table and its lamp */}
      <Bev set={SIDETABLE_SET} mat={OAK[ph]} />
      <path
        d={pxPath([
          [896, 128, 2, 22],
          [912, 128, 2, 22],
        ])}
        fill={OAK[ph].lo}
      />
      {px(896, 138, 18, 2, OAK[ph].mid)}
      {/* headphones parked on the lower shelf */}
      <path
        d={pxPath([
          [900, 132, 8, 2],
          [899, 134, 2, 3],
          [907, 134, 2, 3],
        ])}
        fill={GRAPHITE[ph].base}
      />
      {px(902, 112, 6, 12, M.brass.lo)}
      {px(898, 102, 14, 10, s.lit ? "#e8c98a" : K.linen)}
      {px(898, 102, 14, 2, s.lit ? "#f2dda8" : "#f2ede0")}
    </g>
  );
}

/* === PLANE 5 — gameplayObjects: the television ================================ */

function Television({ ph, s }: { ph: Ph; s: StudioSt }) {
  const off = s.tv === "off";
  return (
    <g>
      {/* the panel: 55 inches of dark glass on a wall mount */}
      {px(746, 111, 10, 4, GRAPHITE[ph].deep)}
      {px(749, 115, 4, 12, GRAPHITE[ph].deep)}
      {px(726, 82, 50, 31, "#14161a")}
      {px(728, 84, 46, 27, off ? (ph === "night" && !s.lit ? "#0c0e12" : "#1a1d24") : "#10131a")}
      {off ? (
        <path
          d={pxPath([
            [732, 86, 8, 10],
            [742, 90, 4, 14],
          ])}
          fill={s.lit ? "#262b34" : "#171b22"}
        />
      ) : null}
      {s.tv === "film" ? (
        <g>
          {px(728, 84, 46, 27, "#5e4a34")}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="discrete"
              values="0 0;-4 0;-8 0;0 0"
              dur="8s"
              repeatCount="indefinite"
            />
            {px(732, 90, 18, 12, "#b08a5e")}
            {px(754, 88, 14, 16, "#7d6448")}
            {px(748, 94, 6, 8, "#e8cba0")}
          </g>
          {px(728, 84, 46, 3, "#0c0e12")}
          {px(728, 108, 46, 3, "#0c0e12")}
        </g>
      ) : null}
      {s.tv === "football" ? (
        <g>
          {px(728, 84, 46, 27, "#2a5a34")}
          {px(728, 100, 46, 2, "#3a7a44")}
          <path
            d={pxPath([
              [734, 92, 2, 4],
              [752, 96, 2, 4],
              [764, 90, 2, 4],
            ])}
            fill="#e84a3a"
          />
          <path
            d={pxPath([
              [742, 94, 2, 4],
              [758, 92, 2, 4],
            ])}
            fill="#f2f4ee"
          />
          <rect x={746} y={98} width={2} height={2} fill="#f2f4ee">
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="discrete"
              values="0 0;8 -2;16 0;10 2;0 0"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </rect>
          {px(730, 86, 12, 5, "#0c0e12")}
          <PixelText x={731} y={87} text="0:2" fill="#f2f4ee" gap={0} />
        </g>
      ) : null}
      {s.tv === "static" ? (
        <g>
          <rect x={728} y={84} width={46} height={27} fill="#3a4048">
            <animate
              attributeName="fill"
              calcMode="discrete"
              values="#3a4048;#4a525c;#343a42;#454d58"
              dur="0.32s"
              repeatCount="indefinite"
            />
          </rect>
          <path
            d={pxPath([
              [730, 88, 10, 1],
              [748, 94, 14, 1],
              [736, 102, 18, 1],
              [756, 86, 10, 1],
            ])}
            fill="#c8ced6"
            opacity={0.5}
          >
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.5;0.2;0.6;0.3"
              dur="0.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* standby eye: red asleep, green awake */}
      <path d={pxPath([[770, 112, 2, 1]])} fill={off ? K.red : K.green} opacity={0.9} />
    </g>
  );
}

/** The monstera by the nook. Watering it has visible consequences. */
function Monstera({ watered }: { watered: boolean }) {
  const leaf = watered ? M.leaf : dim(M.leaf, "#8f8878", 0.35);
  return (
    <g>
      {px(516, 132, 18, 18, "#a05a3a")}
      {px(516, 132, 18, 2, "#b86a46")}
      {px(518, 134, 14, 3, watered ? K.soilWet : K.soil)}
      <g transform={watered ? undefined : "translate(0,5)"} style={{ transition: STEP_DROOP }}>
        <path
          d={pxPath([
            [523, 104, 2, 30],
            [527, 112, 2, 22],
            [519, 116, 2, 18],
          ])}
          fill={leaf.lo}
        />
        <path
          d={pxPath([
            [512, 96, 12, 10],
            [524, 88, 12, 12],
            [516, 108, 10, 8],
            [528, 104, 10, 8],
          ])}
          fill={leaf.base}
        />
        <path
          d={pxPath([
            [514, 98, 4, 4],
            [528, 92, 4, 4],
            [530, 106, 4, 3],
          ])}
          fill={leaf.hi}
        />
        {watered ? <path d={pxPath([[536, 96, 5, 6]])} fill={leaf.hi} /> : null}
      </g>
    </g>
  );
}

/** The pendant over the kitchen table. The cord lives in the ceiling. */
function Pendant({ ph, lit }: { ph: Ph; lit: boolean }) {
  return (
    <g>
      {px(148, 68, 16, 8, lit ? "#e8c98a" : STEEL[ph].mid)}
      {px(148, 68, 16, 2, lit ? "#f2dda8" : STEEL[ph].hi)}
      {px(150, 76, 12, 1, lit ? "#f2dda8" : STEEL[ph].lo)}
      {px(154, 66, 4, 2, STEEL[ph].lo)}
    </g>
  );
}

/* === composition ============================================================== */

function StudioArt({ world, phase }: SceneRenderProps<WorldState>) {
  const ph = toPhase(phase);
  const s = state(world, ph);
  return (
    <LayeredScene
      parallax={{ farBackground: 0.85, middleBackground: 1 }}
      farBackground={<Yard ph={ph} rain={s.weather === "rain"} />}
      middleBackground={
        <g>
          <Ceiling ph={ph} />
          <Walls ph={ph} />
          <Entry ph={ph} opening={s.opening} lit={s.lit} />
          <KitchenWindow ph={ph} s={s} />
          <DoorsNook ph={ph} s={s} bathLit={!!world.lights.bath} studyLit={!!world.lights.study} />
          <BalconyWall ph={ph} s={s} />
        </g>
      }
      ground={<Floor ph={ph} s={s} />}
      staticObjects={
        <g>
          <Kitchen ph={ph} s={s} />
          <Pendant ph={ph} lit={s.lit} />
          <Fridge ph={ph} s={s} />
          <Monstera watered={s.plantWatered} />
          <DogCorner ph={ph} s={s} />
          <Living ph={ph} s={s} />
        </g>
      }
      gameplayObjects={<Television ph={ph} s={s} />}
    />
  );
}

/* === foreground ================================================================ */

function StudioFront(p: SceneRenderProps<WorldState>) {
  const ph = toPhase(p.phase);
  const lit = !!p.world.lights.studio;
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
        {/* the shoe bench inside the door — boots toes-in, because that is how they come off */}
        {px(14, 148, 62, 6, OAK[ph].base)}
        {px(14, 148, 62, 1, OAK[ph].hi)}
        <path
          d={pxPath([
            [18, 154, 4, 22],
            [66, 154, 4, 22],
          ])}
          fill={OAK[ph].lo}
        />
        {px(20, 142, 50, 6, pcol("#8d6a7a", ph))}
        <rect x={20} y={142} width={50} height={6} fill="url(#px-weave)" opacity={0.5} />
        <path
          d={pxPath([
            [22, 162, 12, 8],
            [32, 166, 4, 4],
          ])}
          fill={pcol("#3a3e44", ph)}
        />
        <path d={pxPath([[22, 162, 12, 2]])} fill={pcol("#4a4e55", ph)} />
        <path
          d={pxPath([
            [44, 166, 10, 5],
            [56, 166, 10, 5],
          ])}
          fill="#f2f4ee"
        />
        <path
          d={pxPath([
            [44, 166, 10, 1],
            [56, 166, 10, 1],
          ])}
          fill="#c9c5b8"
        />
        {/* the toy basket by the balcony — wicker, chewed at the rim */}
        {px(556, 160, 44, 20, pcol("#a8865a", ph))}
        <rect x={556} y={160} width={44} height={20} fill="url(#px-weave)" opacity={0.7} />
        {px(556, 160, 44, 2, pcol("#c9a878", ph))}
        {px(574, 158, 6, 4, pcol(K.red, ph))}
        {px(584, 156, 8, 6, pcol("#3f6fd9", ph))}
        {px(562, 158, 6, 4, pcol("#c9a24b", ph))}
        {/* the pouf that drifts around the living corner */}
        {px(700, 158, 46, 22, pcol("#8a5038", ph))}
        <rect x={700} y={158} width={46} height={22} fill="url(#px-weave)" opacity={0.5} />
        {px(700, 158, 46, 3, pcol("#a4553f", ph))}
        <path d={pxPath([[720, 168, 8, 2]])} fill={pcol("#6d3f2c", ph)} />
        {/* near dust, drifting the wrong way because it is near */}
        <path d={MOTES_FRONT_D} fill="#fff6da" opacity={0.5}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-8 10;4 22;-5 8;0 0"
            dur="23s"
            begin="-7s"
            repeatCount="indefinite"
          />
        </path>
        {/* six pixels of near floor, so feet have an edge to sit behind */}
        {px(0, H - 6, 406, 6, STONE[ph].deep)}
        {px(406, H - 6, W - 406, 6, BOARD[ph].deep)}
        {px(0, H - 6, W, 1, BOARD[ph].lo)}
        {/* edge reveals */}
        {px(0, 0, 6, H, GREIGE[ph].deep)}
        {px(W - 6, 0, 6, H, CLAY[ph].deep)}
        <Vignette set={VIG} strength={lit ? 0.75 : 1} />
      </g>
    </svg>
  );
}

/* === effects =================================================================== */

/** A colour cast, not a second darkness — roomDarkness still owns brightness. */
const CAST: Record<Ph, { fill: string; lit: number; dark: number }> = {
  dawn: { fill: DAWN_CAST, lit: 0.05, dark: 0.13 },
  day: { fill: "#ffd9a0", lit: 0.03, dark: 0.07 },
  dusk: { fill: DUSK_CAST, lit: 0.06, dark: 0.15 },
  night: { fill: NIGHT_CAST, lit: 0.08, dark: 0.22 },
};

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.6 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

const HEART_D = pxPath([
  [1, 0, 2, 1],
  [4, 0, 2, 1],
  [0, 1, 7, 2],
  [1, 3, 5, 1],
  [2, 4, 3, 1],
  [3, 5, 1, 1],
]);
const NOTE_D = pxPath([
  [0, 4, 2, 2],
  [2, 0, 1, 5],
  [3, 0, 2, 1],
  [4, 1, 1, 2],
]);
const NOTE2_D = pxPath([
  [0, 4, 2, 2],
  [2, 0, 1, 5],
  [5, 4, 2, 2],
  [7, 0, 1, 5],
  [3, 0, 5, 1],
]);

function StudioEffects({
  world,
  phase,
  fx,
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
  const s = state(world, ph);
  const gain = s.lit ? GAIN[ph] : 0;
  const cast = CAST[ph];
  const shaft = SHAFT[ph];
  const chores = studioState(world);
  const gross =
    actionUi === "pet"
      ? ANIMALS.gross.reactions?.onPet
      : actionUi
        ? ANIMALS.gross.reactions?.onNotice
        : ph === "dusk" && !chores.bowlsFilled
          ? ANIMALS.gross.reactions?.onCall
          : undefined;
  return (
    <>
      {/* steam is real DOM, so it can blur without breaking the pixel grid */}
      {world.kettleOn ? <Steam x={166} y={92} scale={scale} /> : null}
      {s.cooker === "on" ? <Steam x={318} y={94} scale={scale} slow /> : null}
      {actionUi === "smoke" && s.winOpen ? <Steam x={258} y={56} scale={scale} /> : null}
      {/* Gross, in the plane that can hear actionUi */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <AnimalActor animal={ANIMALS.gross} x={644} y={140} shadow={false} action={gross} />
      </svg>
      {/* his radio notes, when the kitchen is playing */}
      {world.radioOn ? (
        <div
          className="pointer-events-none absolute text-parchment"
          style={{ left: 192 * scale, top: 88 * scale, fontSize: 7 * scale }}
        >
          <span className="note">♪</span>
          <span className="note note-2">♬</span>
        </div>
      ) : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* (1) the cast */}
          <rect
            width={W}
            height={H}
            fill={cast.fill}
            opacity={s.lit ? cast.lit : cast.dark}
            style={{ transition: STEP_FADE }}
          />
          {/* (2) daylight */}
          {shaft ? (
            <g style={{ pointerEvents: "none" }}>
              <Light set={shaft} />
              <path d={MOTES_D} fill="#fff6da" opacity={0.75}>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;5 -12;-3 -22;4 -8;0 0"
                  dur="16s"
                  begin="-5s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          <Light set={WINDOW_WASH} op={WINDOW_WASH_OP[ph]} />
          {/* (3) the artificial sources, all riding the one gain */}
          {gain > 0.05 ? (
            <g>
              {SPOT_CONES.map((set, i) => (
                <g key={SPOT_XS[i]}>
                  <Light set={set} op={gain} />
                  <Light set={SPOT_POOLS[i]} op={gain * 0.8} />
                </g>
              ))}
              <Light set={PENDANT_POOL} op={gain} />
              <Light set={PENDANT_TABLE} op={gain * 0.8} />
              <Light set={UNDERCAB_L} op={gain * 0.7} />
              <Light set={UNDERCAB_R} op={gain * 0.7} />
              <Light set={ARC_POOL} op={gain} />
              <Light set={SIDELAMP_POOL} op={gain * 0.85} />
              {/* (4) the sources themselves */}
              <path d={SPOT_SOURCES.core} fill={K.warmHi} opacity={0.9 * gain} />
              <path d={PENDANT_SOURCE.core} fill={K.warmHi} opacity={0.95 * gain} />
              <path d={ARC_SOURCE.core} fill={K.warmHi} opacity={0.9 * gain} />
              <path d={SIDELAMP_SOURCE.core} fill={K.warmHi} opacity={0.85 * gain} />
            </g>
          ) : null}
          {/* (5) appliance light — these do not care about the switch */}
          {s.fridgeOpen ? (
            <g>
              <Light set={FRIDGE_WASH} op={s.lit ? 0.6 : 1} />
              <Light set={FRIDGE_FLOOR} op={0.8} />
            </g>
          ) : null}
          {s.cooker === "on" ? <Light set={OVEN_GLOW} /> : null}
          {s.cooker === "open" ? <Light set={OVEN_OPEN_GLOW} op={0.7} /> : null}
          {s.tv !== "off" ? (
            <g>
              <g>
                <Light set={TV_GLOW[s.tv]} op={s.lit ? 0.5 : 1} />
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="1;0.85;1;0.92;1"
                  dur="2.7s"
                  repeatCount="indefinite"
                />
              </g>
              {roomDarkness(ph === "dawn" ? "morning" : ph, s.lit) > 0.3 ? (
                <Light set={TV_FLOOR} op={0.7} />
              ) : null}
            </g>
          ) : null}
          {ph === "night" && !s.lit ? <Light set={LAPTOP_GLOW} /> : null}
          {/* (8) ambient life */}
          {gross === undefined ? (
            <g>
              <path
                d={pxPath([
                  [652, 118, 3, 1],
                  [652, 116, 3, 1],
                  [654, 117, 1, 1],
                ])}
                fill="#e8e4d8"
                opacity={0.7}
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  calcMode="discrete"
                  values="0 0;1 -2;2 -4;3 -6;0 0"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0.7;0.5;0.3;0"
                  dur="3.6s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {ph === "night" && s.lit ? (
            <g>
              <rect x={826} y={70} width={2} height={2} fill="#e8dfc0" opacity={0.8} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;8 -5;-4 6;5 3;0 0"
                dur="4.1s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {ph === "dusk" && s.binFull ? (
            <g>
              <rect x={354} y={108} width={1} height={1} fill="#2a2d33" />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;6 -4;-3 -8;4 2;0 0"
                dur="3.2s"
                begin="-1s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* (9) hearts and notes, one-shot SMIL — spawned by the handlers */}
          {fx
            .filter((f) => f.kind === "heart")
            .map((f) => (
              <g key={f.id} transform={`translate(${f.x - 3} 120)`}>
                <path d={HEART_D} fill="#e05a6e">
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;0 -20"
                    dur="1s"
                    fill="freeze"
                    repeatCount="1"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;1;0"
                    keyTimes="0;0.6;1"
                    dur="1s"
                    fill="freeze"
                    repeatCount="1"
                  />
                </path>
              </g>
            ))}
          {fx
            .filter((f) => f.kind === "note")
            .map((f) => (
              <g key={f.id} transform={`translate(${f.x} 112)`}>
                <path d={f.id % 2 ? NOTE2_D : NOTE_D} fill={K.linen}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;3 -12;-2 -24"
                    dur="1.5s"
                    fill="freeze"
                    repeatCount="1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.15;0.7;1"
                    dur="1.5s"
                    fill="freeze"
                    repeatCount="1"
                  />
                </path>
              </g>
            ))}
        </g>
      </svg>
      {/* while he sits, the sofa's seat edge comes forward and holds him */}
      {actionUi === "sit" ? (
        <svg
          aria-hidden="true"
          className="pixelated pointer-events-none absolute"
          style={{
            left: 830 * scale,
            top: 126 * scale,
            width: 74 * scale,
            height: 26 * scale,
            zIndex: 20,
          }}
          viewBox="830 126 74 26"
          preserveAspectRatio="none"
        >
          <g shapeRendering="crispEdges">
            {px(832, 133, 70, 7, SOFA[ph].base)}
            {px(832, 133, 70, 1, SOFA[ph].hi)}
            {px(832, 140, 70, 8, SOFA[ph].lo)}
            <rect x={832} y={133} width={70} height={15} fill="url(#px-weave)" opacity={0.35} />
          </g>
        </svg>
      ) : null}
    </>
  );
}

/* === the scene ================================================================= */

function studioArtKey(w: WorldState, phase: string): string {
  const ph = toPhase(phase);
  const s = state(w, ph);
  return [
    ph,
    s.lit ? 1 : 0,
    s.tv,
    s.radioOn ? 1 : 0,
    s.kettleOn ? 1 : 0,
    s.cooker,
    s.opening ?? "-",
    s.winOpen ? 1 : 0,
    s.winSmoked ? 1 : 0,
    s.fridgeOpen ? 1 : 0,
    s.dishes ? 1 : 0,
    s.binFull ? 1 : 0,
    s.fed ? 1 : 0,
    s.guitarOut ? 1 : 0,
    s.plantWatered ? 1 : 0,
    s.weather,
    w.lights.bath ? 1 : 0,
    w.lights.study ? 1 : 0,
  ].join("|");
}

export const STUDIO_SCENE: RuntimeSceneDef<WorldState> = {
  id: "studio",
  width: W,
  spawnX: 70,
  artKey: studioArtKey,
  objects: [
    {
      id: "frontdoor",
      kind: "flatdoor",
      x: 37,
      range: 22,
      priority: 1,
      to: { scene: "corridor", spawnX: 46 },
    },
    { id: "wardrobe-hall", kind: "openable", x: 85, range: 14 },
    { id: "keys", kind: "flavor", x: 104, range: 6 },
    { id: "switch", kind: "lamp", x: 122, range: 12 },
    { id: "spices", kind: "flavor", x: 143, range: 10 },
    { id: "table", kind: "flavor", x: 156, range: 6 },
    { id: "kettle", kind: "kettle", x: 169, range: 14 },
    { id: "speaker", kind: "radio", x: 197, range: 10 },
    { id: "dishrack", kind: "flavor", x: 217, range: 10 },
    { id: "window-kitchen", kind: "window", x: 247, range: 16 },
    { id: "sink-kitchen", kind: "dishes", x: 247, range: 6 },
    { id: "knives", kind: "flavor", x: 288, range: 10 },
    { id: "cooker", kind: "cooker", x: 322, range: 14 },
    { id: "bin", kind: "binbag", x: 352, range: 8 },
    { id: "espresso", kind: "flavor", x: 374, range: 12 },
    { id: "fridge", kind: "openable", x: 376, range: 16 },
    { id: "jars", kind: "flavor", x: 396, range: 5 },
    {
      id: "door-bath",
      kind: "flatdoor",
      x: 432,
      range: 18,
      priority: 1,
      to: { scene: "bath", spawnX: 44 },
    },
    {
      id: "door-study",
      kind: "flatdoor",
      x: 488,
      range: 18,
      priority: 1,
      to: { scene: "study", spawnX: 44 },
    },
    { id: "radiator", kind: "flavor", x: 510, range: 9 },
    { id: "plant-studio", kind: "plant", x: 524, range: 7 },
    { id: "roomba", kind: "flavor", x: 541, range: 6 },
    {
      id: "balcony",
      // the hitbox sits on the sliding leaf; the fixed pane does not open
      kind: "flatdoor",
      x: 610,
      range: 14,
      priority: 1,
      to: { scene: "balcony", spawnX: 48 },
    },
    { id: "dogbowls", kind: "bowls", x: 594, range: 10 },
    { id: "dogbed", kind: "flavor", x: 630, range: 8 },
    { id: "dog", kind: "dog", x: 648, range: 18, priority: 2 },
    { id: "artbrut", kind: "flavor", x: 696, range: 10 },
    { id: "bookshelf", kind: "panel", x: 700, range: 5, data: "skills" },
    { id: "tv", kind: "tv", x: 726, range: 10 },
    { id: "ps5", kind: "flavor", x: 746, range: 6 },
    { id: "guitar", kind: "guitar", x: 774, range: 14, priority: 1 },
    { id: "laptop", kind: "computer", x: 812, range: 8 },
    { id: "phone", kind: "panel", x: 836, range: 5, data: "links" },
    { id: "sofa", kind: "sport", x: 862, range: 10, action: "sit", face: -1 },
    { id: "flag", kind: "flavor", x: 872, range: 7 },
    { id: "sidetable", kind: "flavor", x: 904, range: 10 },
  ],
  Component: StudioArt,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.studio),
  Foreground: (p) => <StudioFront {...p} />,
  Effects: StudioEffects,
  idleLean: true,
};
