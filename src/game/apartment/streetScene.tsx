import {
  AOSet,
  aoPaths,
  Bev,
  Bevel,
  bevelPaths,
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
  type Ph,
  PhaseSky,
  PixelText,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  STEP_FADE,
  STEP_SLIDE,
  StreetLamp,
  shift,
  steppedCable,
  steppedEllipse,
  steppedQuad,
  steppedRoof,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";

// --- ULICA SŁONECZNA / the street, and the scene the whole game hangs off -----------

/**
 * Fourth pass. Same street, rebuilt to the house standard — ramps instead of
 * flat hex, Bev instead of hand-stacked edges, quantised light instead of
 * gradients, and a state machine per object instead of five booleans.
 *
 * ==================================================================
 * SCALE. This scene was already at the house key and nobody had noticed: one
 * storey was written as 2.8 m ≈ 104 px, which is 37.1 px/m, and the three people
 * measure 66–72 px for 1.75 m. So it snaps to the same key as the gym and the
 * district with no redrawing at all:
 *
 *     PPM = 38 px per metre, 2.6 cm per pixel.
 *
 * 1280 px is 33.7 m of frontage. Every existing hitbox x is unchanged, because
 * every one of them has a translation entry; seven new ones fill the gaps, which
 * takes this from one interaction per 43 px to one per 35 — bath density.
 *
 *     adult 1.75 m  67 px    storey  2.80 m  106 px
 *     door  2.10 m  80 px    kerb    0.12 m    5 px
 *     bin   1.10 m  42 px    bus    12.00 m  456 px
 * ==================================================================
 *
 * Six planes:
 *   farBackground (0.9) — PhaseSky, clouds, a plane, and the whole west
 *     skyline: kamienice, the church, the water tower, the heating-plant stack
 *     with its plume, the crane that has not moved since March, the wire and
 *     its crows.
 *   middleBackground (1.0) — the two blocks: render, slab bands, first-floor
 *     sills (seven households, each a different life), the gas pipe, klatka B
 *     with its timer light, the whole Żabka shopfront and its interior, the
 *     passage, block 16 with its bankomat.
 *   ground (1.0) — pavement, kerb, asphalt, the worn tracks where people
 *     actually walk, covers, hopscotch, gum. All 37 hitboxes resolve here.
 *   staticObjects (1.0) — street furniture, twelve pieces of it.
 *   gameplayObjects (1.0) — the people and the animals.
 *   Foreground (fixed) — hedges, the planter, the parked crossover, a near
 *     bollard, the car that goes past, and — when the board says so — a 12 m
 *     bus that fills the near plane and blocks the entire street for nine
 *     seconds. That bus is the reason the countdown board exists.
 *
 * LIGHTING PREMISE. Outside, so the sun runs the day and the street runs the
 * night, and the point of this street is that its night light comes from seven
 * different places at four temperatures: two sodium-ish lamps (warm, wide), the
 * Żabka fascia and window (cold green-white, and the brightest thing here), the
 * klatka stair light on a 34-second timer, the paczkomat's backlit crown, the
 * bus board, the bankomat, and whichever first-floor windows are awake. At dawn
 * a shaft comes down the passage between the blocks and lands on the pavement,
 * which is the only time the sun reaches the building line.
 *
 * STATE. Nineteen reads. The signature of this scene is that most of them
 * *derive from the clock* unless a world flag overrides — a street runs on a
 * timetable, not on flags. Legacy `world.street` booleans still map in:
 *
 *   zabka      closed → open → busy      night shuts the grille; crowd fills it
 *   paczkomat  idle → scanning → open    (legacy paczkomatUsed → open)
 *   bins       0 emptied → 3 overflowing (legacy binsEmptied → 0)
 *   binOpen    boolean                   (legacy)
 *   kosz       0..2
 *   bus        none → due → arriving      the board, and the thing itself
 *   cat        away → pavement → bench   (legacy catFed → catFed)
 *   babcia     away → feeding → wrapped
 *   smoker     away → phone → smoking
 *   klatka     off → timer → on
 *   trzepak    bare → rug → beating
 *   bankomat   ok → queue → broken
 *   bikes      0..3
 *   crowd      0..3
 *   lamps      auto → on → off
 *   weather    clear → overcast → rain → wet → snow
 *   season     green → autumn → bare
 *   catFed, heniek — booleans that change real geometry
 *
 * ARTKEY. The art reads exactly what `artKey` joins and nothing else. The old
 * key was `JSON.stringify(w.street)`, which was honest but repainted on every
 * unrelated flag; this one lists the reads.
 *
 * TRANSIENTS. `actionUi` is never in artKey, so anything the player is doing —
 * opening a locker, lifting a lid, feeding the cat — lives in StreetEffects.
 *
 * BUDGET. ~560 nodes at the busiest state, 46 animations, 18 of them on
 * calcMode="discrete". Zero gradients, zero ellipses, zero circles — the old
 * pass had three gradients and used <circle> for smoke. Wide scene, so
 * everything repeated is banked: the render fields are 2 paths each, the grille
 * is 2 where it was 35, the snow ledges are one path for the whole street.
 */

const STREET_W = 1280;
const H = 180;

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);

/* Landmark rows. A street elevation is a stack of bands and these are them. */
const SLAB_TOP = 36; // the floor slab band between storeys
const FASCIA_TOP = 46; // Żabka's sign band
const FASCIA_BOT = 70;
const SHOP_HEAD = 75; // top of the glass wall
const PLINTH_TOP = 138;
const GROUND = 150;
const KERB = 166;
const ROAD = 169;
const CY = GROUND - 1;

/** Unit boundaries. Every x in this file belongs to one of these. */
const Z = {
  silka: 60, //  1.6 m — the cellar gym door at the very left
  block14: 584, // 13.8 m — render, klatka B, and Żabka
  passage: 892, //  8.1 m — the gap between the blocks
  block16: 1250, //  9.4 m — the second block
  end: STREET_W,
} as const;

/** Żabka's frontage, and the klatka's, kept where they already were. */
const ZAB = { x0: 300, x1: 580, doorX: 430, doorW: 52 } as const;
const KLATKA = { x0: 146, x1: 240 } as const;

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
    dusk: dim(mat, DUSK_CAST, 0.2),
    night: dim(mat, NIGHT_CAST, 0.6),
  };
}

/** Block 14: the warm render everybody's block got in about 2008. */
const R14_MAT: Mat = {
  hi: "#ddd3c0",
  base: "#cfc4ae",
  mid: "#c4baa4",
  lo: "#b8ad97",
  deep: "#9a9078",
};
/** Block 16: the same job, three years later, in the cold grey they had left. */
const R16_MAT: Mat = {
  hi: "#c9cfd3",
  base: "#b9c0c4",
  mid: "#adb4b8",
  lo: "#a2a9ad",
  deep: "#878e92",
};
const PLINTH_MAT: Mat = {
  hi: "#9a9184",
  base: "#8d8478",
  mid: "#847b70",
  lo: "#7a7268",
  deep: "#625b53",
};
const WALK_MAT: Mat = {
  hi: "#a8a59d",
  base: "#9d9a92",
  mid: "#94918a",
  lo: "#8b8880",
  deep: "#73706a",
};
const ASPHALT_MAT: Mat = {
  hi: "#6d6a64",
  base: "#5d5a55",
  mid: "#54514d",
  lo: "#4a4844",
  deep: "#383633",
};
const FRAME_MAT: Mat = {
  hi: "#9a9488",
  base: "#8a8578",
  mid: "#7d786c",
  lo: "#6f6a5e",
  deep: "#57534a",
};
const STEEL_MAT: Mat = {
  hi: "#c8ccd2",
  base: "#9aa0a8",
  mid: "#868c94",
  lo: "#6d7278",
  deep: "#4f545a",
};
const ZABKA_MAT: Mat = {
  hi: "#0d7d46",
  base: "#0a6b3c",
  mid: "#095f35",
  lo: "#07522e",
  deep: "#053f23",
};
const GRILLE_MAT: Mat = {
  hi: "#8f9299",
  base: "#7a7d84",
  mid: "#6d7077",
  lo: "#5d6066",
  deep: "#454850",
};
const HEDGE_MAT: Mat = {
  hi: "#46624a",
  base: "#33503a",
  mid: "#2e4834",
  lo: "#2c4632",
  deep: "#1f3324",
};

const R14 = ramp(R14_MAT);
const R16 = ramp(R16_MAT);
const PLINTH = ramp(PLINTH_MAT);
const WALK = ramp(WALK_MAT);
const ROADM = ramp(ASPHALT_MAT);
const FRAME = ramp(FRAME_MAT);
const STEEL = ramp(STEEL_MAT);
const ZAB_M = ramp(ZABKA_MAT);
const GRILLE = ramp(GRILLE_MAT);
const HEDGE = ramp(HEDGE_MAT);
const OAK = ramp(M.oak);

const K = {
  /**
   * The sky in four stepped bands, top to horizon — index [3] is the horizon
   * band the skyline mixes toward. Same stops as the engine's PhaseSky, with
   * one band interpolated so distance has four rungs to climb.
   */
  sky: {
    dawn: ["#8ba3c4", "#a9b8cc", "#c9cfd8", "#e8cf9a"],
    day: ["#7fa8cc", "#93b8d6", "#a8c8e0", "#cfe2ee"],
    dusk: ["#4a3b63", "#7d5378", "#b96b8c", "#f2a65a"],
    night: ["#12142a", "#1a1830", "#232040", "#2c2a4a"],
  } as Record<Ph, string[]>,
  glass: { dawn: "#b6b0c8", day: "#a8c2d4", dusk: "#c98a62", night: "#2a3138" } as Record<
    Ph,
    string
  >,
  glassLit: "#ffd98a",
  glassLitWarm: "#f2b96a",
  curtain: "#e8e2d2",
  white: "#f2f2ee",
  cream: "#e8e2d2",
  renderPatch: "#c3b8a2",
  renderDamp: "#a89e8a",
  plaqueBlue: "#1e4478",
  /** the yellow gas pipe, as inevitable as the render itself */
  gas: "#e8c445",
  gasLo: "#c9a52e",
  gas16: "#c9c46a",
  rust: "#9a7a58",
  led: "#7ee08c",
  ledAmber: "#ffb03a",
  ledRed: "#ff5050",
  ledBlue: "#7ea8e0",
  inpost: "#f5c518",
  inpostHi: "#fbe06a",
  chalk: "#e8e2d2",
  leafDry: "#b07a3a",
  leafDead: "#7a5a34",
  snow: "#eef4f8",
  snowLo: "#c8d6e0",
  grit: "#8a7a5e",
  water: "#6a7580",
  waterHi: "#8fa0ad",
  puddleNight: "#3a4650",
  skin: "#e0b48c",
  skinShade: "#c79a72",
  hoodie: "#4a5866",
  hoodieLo: "#3e4b57",
  coat: "#5d4a66",
  coatLo: "#4e3d57",
  beret: "#7c3040",
  quilt: "#3f4a3a",
  bagRed: "#c9463c",
  cat: "#5a4a3e",
  catHi: "#6d5c4c",
  pigeon: "#6d7278",
  pigeonHi: "#828890",
  bus: "#c9463c",
  busHi: "#e05a50",
  hotdog: "#e8843a",
  fridge: "#b8e6ff",
} as const;

/* ================================================================== *
 * state — a street runs on a timetable, so most of this derives from the clock
 * ================================================================== */

export type ShopStage = "closed" | "open" | "busy";
export type PaczkomatStage = "idle" | "scanning" | "open";
export type BusStage = "none" | "due" | "arriving";
export type CatStage = "away" | "pavement" | "bench";
export type BabciaStage = "away" | "feeding" | "wrapped";
export type SmokerStage = "away" | "phone" | "smoking";
export type KlatkaStage = "off" | "timer" | "on";
export type TrzepakStage = "bare" | "rug" | "beating";
export type BankomatStage = "ok" | "queue" | "broken";
export type LampStage = "auto" | "on" | "off";
export type Weather = "clear" | "overcast" | "rain" | "wet" | "snow";
export type Season = "green" | "autumn" | "bare";

const SHOP: readonly ShopStage[] = ["closed", "open", "busy"];
const PACZ: readonly PaczkomatStage[] = ["idle", "scanning", "open"];
const BUSS: readonly BusStage[] = ["none", "due", "arriving"];
const CATS: readonly CatStage[] = ["away", "pavement", "bench"];
const BABS: readonly BabciaStage[] = ["away", "feeding", "wrapped"];
const SMOKS: readonly SmokerStage[] = ["away", "phone", "smoking"];
const KLATS: readonly KlatkaStage[] = ["off", "timer", "on"];
const TRZS: readonly TrzepakStage[] = ["bare", "rug", "beating"];
const BANKS: readonly BankomatStage[] = ["ok", "queue", "broken"];
const LAMPS: readonly LampStage[] = ["auto", "on", "off"];
const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain", "wet", "snow"];
const SEASONS: readonly Season[] = ["green", "autumn", "bare"];

type StreetState = {
  zabka: ShopStage;
  paczkomat: PaczkomatStage;
  bins: 0 | 1 | 2 | 3;
  binOpen: boolean;
  kosz: 0 | 1 | 2;
  bus: BusStage;
  cat: CatStage;
  catFed: boolean;
  babcia: BabciaStage;
  smoker: SmokerStage;
  heniek: boolean;
  klatka: KlatkaStage;
  trzepak: TrzepakStage;
  bankomat: BankomatStage;
  bikes: 0 | 1 | 2 | 3;
  crowd: 0 | 1 | 2 | 3;
  lamps: LampStage;
  weather: Weather;
  season: Season;
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
 * Every key falls back to what the clock says, which is what the previous pass
 * did with plain booleans — Żabka shuts at night, the bins fill through the day
 * and go out at dawn, the babcia goes in when it gets cold. The legacy flags
 * (`paczkomatUsed`, `binsEmptied`, …) still override, so an old save loads into
 * the frame it used to draw.
 */
function state(world: WorldState, ph: Ph): StreetState {
  const s = ((world as unknown as Record<string, unknown>).street ?? {}) as Record<string, unknown>;
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const crowd = clampInt(s.crowd, 3, night ? 0 : 2) as 0 | 1 | 2 | 3;
  /** the legacy booleans, which still win where they are set */
  const legacyUsed = s.paczkomatUsed === true;
  const legacyEmptied = s.binsEmptied === true;
  return {
    zabka: clampStage(s.zabka, SHOP, night ? "closed" : crowd >= 2 ? "busy" : "open"),
    paczkomat: clampStage(s.paczkomat, PACZ, legacyUsed ? "open" : "idle"),
    bins: clampInt(s.bins, 3, legacyEmptied ? 0 : ph === "dawn" ? 0 : ph === "day" ? 1 : 2) as
      | 0
      | 1
      | 2
      | 3,
    binOpen: s.binOpen === true,
    kosz: clampInt(s.kosz, 2, legacyEmptied ? 0 : dark ? 2 : 1) as 0 | 1 | 2,
    bus: clampStage(s.bus, BUSS, night ? "none" : "due"),
    cat: clampStage(s.cat, CATS, night ? "bench" : "pavement"),
    catFed: s.catFed === true,
    babcia: clampStage(s.babcia, BABS, night ? "away" : ph === "dusk" ? "wrapped" : "feeding"),
    smoker: clampStage(s.smoker, SMOKS, ph === "day" ? "phone" : "smoking"),
    heniek: s.heniek !== false,
    klatka: clampStage(s.klatka, KLATS, dark ? "timer" : "off"),
    trzepak: clampStage(s.trzepak, TRZS, ph === "day" || ph === "dawn" ? "rug" : "bare"),
    bankomat: clampStage(s.bankomat, BANKS, night ? "broken" : crowd >= 3 ? "queue" : "ok"),
    bikes: clampInt(s.bikes, 3, ph === "day" || ph === "dawn" ? 1 : 2) as 0 | 1 | 2 | 3,
    crowd,
    lamps: clampStage(s.lamps, LAMPS, "auto"),
    weather: clampStage(s.weather, WEATHERS, "clear"),
    season: clampStage(s.season, SEASONS, "autumn"),
  };
}

function lampsOn(s: StreetState, ph: Ph): boolean {
  if (s.lamps === "on") return true;
  if (s.lamps === "off") return false;
  return ph === "night" || ph === "dusk" || (ph === "dawn" && s.weather !== "clear");
}
const isWet = (s: StreetState) => s.weather === "rain" || s.weather === "wet";
const isSnow = (s: StreetState) => s.weather === "snow";
const isFlat = (s: StreetState) =>
  s.weather === "overcast" || s.weather === "rain" || s.weather === "snow";
/** Cold enough that coats close, breath shows and the babcia goes inside. */
const isCold = (s: StreetState, ph: Ph) => isSnow(s) || ph === "night" || ph === "dusk";

/* ================================================================== *
 * helpers
 * ================================================================== */

function bank(shape: readonly Rect[], n: number, pitch: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) out.push(...shift(shape, i * pitch, 0));
  return out;
}
/** Integer-scaled pixel text. Non-integer k takes the letters off the grid. */
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

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/** The pavement: 500 mm slabs, two courses in frame, and the worn tracks. */
const PAVING = (() => {
  const face: Rect[] = [];
  const hi: Rect[] = [];
  const slab = m(0.5);
  let row = 0;
  for (let y = GROUND; y < KERB; y += 8, row++) {
    const stagger = row % 2 === 1 ? Math.round(slab / 2) : 0;
    for (let x = -slab + stagger; x < STREET_W; x += slab) {
      const x0 = Math.max(0, x + 1);
      const x1 = Math.min(STREET_W, x + slab - 1);
      if (x1 <= x0) continue;
      face.push([x0, y, x1 - x0, 7]);
      hi.push([x0, y, x1 - x0, 1]);
    }
  }
  return { face: pxPath(face), hi: pxPath(hi) };
})();
/** Where everybody actually walks: klatka to Żabka, Żabka to the stop, and the
 *  diagonal from the passage to the bins. Worn a shade lighter than the rest. */
const TRACKS = pxPath([
  [150, 152, 120, 6],
  [430, 152, 90, 6],
  [700, 153, 60, 5],
  [1040, 152, 90, 6],
]);
const KERB_LINE = pxPath([[0, KERB, STREET_W, 3]]);
const ASPHALT_WEAR = pxPath([
  [80, 172, 40, 2],
  [500, 174, 60, 2],
  [980, 171, 36, 2],
  [300, 170, 90, 2],
]);
/** Three covers, three utilities, and the drain at the kerb. */
const MANHOLE = pxPath([[920, 158, 22, 8]]);
const MANHOLE_SLOTS = pxPath(repeat(4, 4, [924, 160, 2, 4] as Rect));
const DRAIN = pxPath([[660, KERB, 18, 3]]);
const DRAIN_SLOTS = pxPath(repeat(4, 4, [662, KERB, 2, 3] as Rect));
const COVER_GAS = pxPath([[268, GROUND + 4, m(0.4), 7]]);
const COVER_TEL = pxPath([[1108, GROUND + 3, m(0.7), 9]]);
/** Hopscotch some kid chalked in April and the rain has nearly finished. */
const HOPSCOTCH = pxPath(
  (
    [
      [700, 154],
      [700, 162],
      [714, 154],
      [714, 162],
      [728, 158],
    ] as const
  ).flatMap(
    ([hx, hy]) =>
      [
        [hx, hy, 13, 1],
        [hx, hy, 1, 8],
        [hx + 12, hy, 1, 8],
        [hx, hy + 7, 13, 1],
      ] as Rect[],
  ),
);
/** Grass in the joints, gum, a bottle cap, the small wear layer. */
const JOINT_GRASS = pxPath([
  [118, 147, 3, 3],
  [422, 148, 2, 2],
  [704, 147, 3, 3],
  [1058, 148, 2, 2],
]);
const GUM = pxPath([
  [266, 156, 2, 2],
  [292, 162, 2, 1],
  [318, 154, 1, 2],
  [412, 160, 2, 2],
  [498, 157, 2, 1],
  [640, 164, 2, 2],
  [812, 162, 2, 2],
  [968, 155, 2, 2],
  [1102, 161, 2, 1],
  [1196, 157, 2, 2],
]);
/** Cigarette ends. All of them within a metre of where the smoker stands. */
const STUBS = pxPath([
  [238, GROUND - 2, 2, 1],
  [243, GROUND - 1, 2, 1],
  [266, GROUND - 2, 2, 1],
  [252, GROUND + 4, 2, 1],
  [274, GROUND + 6, 1, 2],
]);

/* --- the render fields, and the slab bands --- */
const R14_BODY = bevelPaths([[Z.silka, 0, Z.block14 - Z.silka - 4, GROUND]]);
const R16_BODY = bevelPaths([[Z.passage, 0, Z.block16 - Z.passage, GROUND]]);
const R14_JOINTS = pxPath([
  [238, 0, 2, PLINTH_TOP],
  [420, 0, 2, PLINTH_TOP],
  [60, 90, Z.block14 - Z.silka - 4, 1],
]);
const R16_JOINTS = pxPath([
  [1070, 0, 2, PLINTH_TOP],
  [Z.passage, 90, Z.block16 - Z.passage, 1],
]);
const SLAB_14 = pxPath([
  [60, SLAB_TOP, 520, 2],
  [60, SLAB_TOP + 2, 520, 6],
  [60, SLAB_TOP + 8, 520, 2],
]);
const SLAB_16 = pxPath([
  [Z.passage, SLAB_TOP, 358, 2],
  [Z.passage, SLAB_TOP + 2, 358, 6],
]);
/** The plinth, and the two places shoulders and bags have polished it. */
const PLINTH_14 = bevelPaths([[60, PLINTH_TOP, 520, GROUND - PLINTH_TOP]]);
const PLINTH_16 = bevelPaths([[Z.passage, PLINTH_TOP, 358, GROUND - PLINTH_TOP]]);
const PLINTH_WORN = pxPath([
  [140, 140, 60, 8],
  [300, 141, 40, 6],
  [1044, 141, 50, 7],
]);
/** The gas pipe. Block 14 kept it yellow; block 16 painted over it twice. */
const GAS_14 = {
  run: pxPath([[60, 128, 202, 4]]),
  hi: pxPath([[60, 128, 202, 1]]),
  lo: pxPath([[60, 132, 202, 1]]),
  brackets: pxPath([
    [96, 126, 4, 8],
    [196, 126, 4, 8],
  ]),
  riser: pxPath([[262, 108, 4, 24]]),
  riserHi: pxPath([[262, 108, 1, 24]]),
  valve: pxPath([[258, 104, 12, 5]]),
};
const GAS_16 = pxPath([
  [Z.passage, 124, 158, 4],
  [1100, 124, 150, 4],
]);
/** Drainpipe on 14, its brackets, and the rust bloom at the shoe. */
const PIPE_14 = {
  body: pxPath([[560, 0, 8, GROUND]]),
  hi: pxPath([[560, 0, 2, GROUND]]),
  brackets: pxPath([
    [557, 62, 14, 4],
    [557, 116, 14, 4],
  ]),
  rust: pxPath([[561, 120, 6, 26]]),
};
/** Cable run and a satellite dish nobody has used since the fibre came. */
const CABLES = pxPath([
  [60, 66, 176, 1],
  [232, 60, 3, 10],
  [Z.passage + 8, 62, 150, 1],
]);

/* --- Żabka --- */
const ZAB_FASCIA = bevelPaths([[ZAB.x0, FASCIA_TOP, ZAB.x1 - ZAB.x0, FASCIA_BOT - FASCIA_TOP]]);
const ZAB_AWNING = pxPath([
  [ZAB.x0, FASCIA_BOT, ZAB.x1 - ZAB.x0, 3],
  [ZAB.x0, FASCIA_BOT + 3, ZAB.x1 - ZAB.x0, 2],
]);
const ZAB_GLASSWALL = pxPath([[302, SHOP_HEAD, 276, GROUND - SHOP_HEAD]]);
/** The grille: two paths where the old pass emitted thirty-five rects. */
const ZAB_GRILLE = {
  slats: pxPath(bank([[304, 79, 7, 71]], 23, 12)),
  rails: pxPath(repeat(12, 6, [302, 82, 276, 2] as Rect, "y")),
  box: pxPath([
    [302, SHOP_HEAD, 276, 4],
    [302, 146, 276, 4],
  ]),
};
/** The mosaic frog tile the chain puts on every fascia, as a 17px block. */
const ZAB_MARK = pxPath([
  [310, 50, 17, 17],
  [314, 54, 9, 9],
]);

/* --- klatka B --- */
const KLATKA_CANOPY = pxPath([[KLATKA.x0, 56, KLATKA.x1 - KLATKA.x0 - 10, 4]]);
const KLATKA_SET = bevelPaths([[158, 70, 60, 80]]);
const KLATKA_GLASS = pxPath([[163, 75, 50, 75]]);

/* --- block 16 --- */
const B16_ENTRY = bevelPaths([[1054, 70, 52, 80]]);
const B16_PARTER = bevelPaths([
  [920, 84, 34, 42],
  [1160, 84, 34, 42],
]);

/* --- everything with a horizontal top edge, for when it snows --- */
const SNOW_LEDGES = pxPath([
  [60, SLAB_TOP, 520, 2],
  [Z.passage, SLAB_TOP, 358, 2],
  [60, 128, 202, 1],
  [Z.passage, 124, 158, 1],
  [1100, 124, 150, 1],
  [ZAB.x0, FASCIA_TOP - 1, ZAB.x1 - ZAB.x0, 2],
  [ZAB.x0, FASCIA_BOT, ZAB.x1 - ZAB.x0, 1],
  [60, PLINTH_TOP - 1, 520, 1],
  [Z.passage, PLINTH_TOP - 1, 358, 1],
  [KLATKA.x0, 55, KLATKA.x1 - KLATKA.x0 - 10, 1],
  [1040, 57, 76, 1],
  [508, 55, 70, 1], // the bus shelter roof
  [780, 97, 48, 1], // the bench back
  [780, 119, 52, 1], // the bench seat
  [690, 95, 74, 1], // bin lids
  [846, 105, 18, 1], // the litter bin
  [618, 73, 48, 1], // the paczkomat crown
  [956, 111, 34, 1], // the trzepak top bar
]);

const PACZ_SET = bevelPaths([[618, 74, 48, 76]]);
const BUSSTOP_SET = bevelPaths([
  [508, 56, 70, 4],
  [510, 60, 4, 90],
  [572, 60, 4, 90],
]);
const BANKOMAT_SET = bevelPaths([[986, 84, 34, 46]]);
const NOTICE_SET = bevelPaths([[122, 76, 40, 40]]);
// @ts-expect-error TS6133 — staged for the kiosk pass
const _KIOSK_SET = bevelPaths([[1188, 92, 44, 58]]);

/* --- occlusion and contact --- */
const STREET_AO = aoPaths([
  [60, SLAB_TOP + 8, 520], // slab band onto the render
  [Z.passage, SLAB_TOP + 8, 358],
  [ZAB.x0, FASCIA_BOT + 5, ZAB.x1 - ZAB.x0], // the awning onto the glass
  [KLATKA.x0, 60, KLATKA.x1 - KLATKA.x0 - 10], // klatka canopy
  [1040, 62, 76],
  [508, 60, 70], // shelter roof
  [60, GROUND, 520], // both plinths onto the pavement
  [Z.passage, GROUND, 358],
]);
const STREET_CONTACT = contactPaths([
  [14, 42, CY],
  [276, 18, CY],
  [508, 74, CY],
  [618, 48, CY],
  [690, 74, CY],
  [780, 52, CY],
  [846, 16, CY],
  [872, 48, CY],
  [956, 32, CY],
  [1026, 24, CY],
  [1188, 44, CY],
]);

/* ================================================================== *
 * light — quantised, no gradients and no ellipses anywhere
 * ================================================================== */

const LAMP_X = [40, 945] as const;
/** 5 m columns, so the head is at the top of frame and the cone opens downward. */
const LAMP_CONES = tiers(
  (k) =>
    LAMP_X.flatMap((x) =>
      steppedQuad(
        44,
        x - Math.round(14 * k),
        x + Math.round(14 * k),
        GROUND,
        x - Math.round(54 * k),
        x + Math.round(54 * k),
        10,
      ),
    ),
  "w",
  0.85,
);
const LAMP_POOLS = tiers(
  (k) =>
    LAMP_X.flatMap((x) =>
      steppedEllipse(x, GROUND + 10, Math.round(m(2.6) * k), Math.round(m(0.5) * k), 3),
    ),
  "w",
  0.6,
);
const LAMP_HALO = bulbPaths(LAMP_X.map((x) => [x, 46] as const));

function spill(x0: number, x1: number, top: number, spread: number, tint: "w" | "c", g = 0.7) {
  return tiers(
    (k) =>
      steppedQuad(
        top,
        x0 + (1 - k) * spread,
        x1 - (1 - k) * spread,
        KERB,
        x0 - spread + (1 - k) * spread,
        x1 + spread - (1 - k) * spread,
        8,
      ),
    tint,
    g,
  );
}
/** Żabka is the brightest thing on this street and it is the wrong colour. */
const SPILL_ZABKA = spill(302, 578, SHOP_HEAD, 40, "c", 0.9);
const SPILL_FASCIA = tiers(
  (k) =>
    steppedQuad(
      FASCIA_TOP,
      ZAB.x0 + (1 - k) * 30,
      ZAB.x1 - (1 - k) * 30,
      110,
      ZAB.x0 - 20,
      ZAB.x1 + 20,
      8,
    ),
  "c",
  0.5,
);
const SPILL_KLATKA = spill(163, 213, 75, 18, "w", 0.7);
const SPILL_PACZ = spill(618, 666, 74, 14, "w", 0.4);
const SPILL_BANK = spill(986, 1020, 84, 12, "c", 0.35);
const SPILL_SILKA = spill(18, 52, 100, 10, "w", 0.45);
const SPILL_BOARD = tiers(
  (k) => steppedEllipse(534, 58, Math.round(26 * k), Math.round(12 * k), 2),
  "w",
  0.3,
);
/** The passage lamp, thirty metres in, throwing a wedge back at the street. */
const SPILL_PASSAGE = tiers(
  (k) => steppedQuad(44, 700 - 14 * k, 720 + 14 * k, GROUND, 660 - 40 * k, 760 + 40 * k, 10),
  "w",
  0.45,
);
/** First-floor windows that are awake, each dropping a small box of light. */
const SILL_X = [84, 132, 252, 296, 430, 478, 526, 924, 972, 1020, 1164, 1212] as const;
const SILL_SPILL = tiers(
  (k) =>
    SILL_X.flatMap((x) =>
      steppedQuad(37, x + (1 - k) * 8, x + 24 - (1 - k) * 8, 74, x - 8, x + 32, 8),
    ),
  "w",
  0.22,
);
/** Dawn comes down the passage between the blocks. The only time it reaches. */
const DAWN_SHAFT = tiers(
  (k) =>
    steppedQuad(
      0,
      584 + (1 - k) * 80,
      892 - (1 - k) * 80,
      GROUND + 18,
      640 + (1 - k) * 60,
      980 - (1 - k) * 60,
      10,
    ),
  "e",
  0.85,
);
const DAY_SHAFT = tiers(
  (k) => steppedQuad(0, 584 + (1 - k) * 60, 892 - (1 - k) * 60, GROUND + 18, 620, 940, 12),
  "w",
  0.4,
);
const VIGNETTE = vignettePaths(STREET_W, H);

/* ==================================================================== *
 * PLANE 1 — sky and skyline. Replacement block for street.tsx.
 *
 * Drops in over CLOUD_BANKS / Clouds / SKYLINE / Skyline. Needs two new kit
 * exports, steppedRoof and steppedCable, added to the import list.
 *
 * WHAT WAS OFF-STYLE, measured across the whole project:
 *
 *   Five <polygon> elements and one stroked bezier — and they were the only
 *   five polygons and the only stroked curve in any scene. bath, bedroom,
 *   district, gym, corridor and zabka have none. A polygon roof gets
 *   antialiased on its diagonal and sits off the grid, and a 1 px stroke on a
 *   Q-curve is the one thing in an SVG that cannot be put on the grid at all.
 *   Every roof here is now steppedRoof() and the wire is steppedCable(), both
 *   of which reproduce the old eaves and ridge coordinates exactly.
 *
 *   Two-state colour. The skyline branched on `dark ? a : b` while every other
 *   surface in the game runs the four-phase ramp. A distant block does not have
 *   two colours, it has four.
 *
 *   No atmospheric perspective, which is why 440 px of city read as one piece of
 *   cardboard. Distance is contrast, not size: everything now mixes toward the
 *   horizon band of K.sky[ph] by how far away it is — the plant and the crane at
 *   34%, the church and the far slabs at 20%, the kamienice at 9% — and overcast
 *   adds another 12% to all of them, because that is what haze does.
 *
 *   A cloud reset that popped. The banks started on screen at x=80 and
 *   translated +1400, so every 420 s a cloud vanished from mid-sky and
 *   reappeared. All three now start and finish off-frame and are staggered with
 *   negative begin, so the loop point is never visible and the sky is not empty
 *   at t=0.
 *
 *   `s` was passed in and only `season` was read. Weather now reaches this
 *   plane: snow lies along every roof course, overcast flattens the whole city,
 *   and the plant's plume stands up in cold air instead of drifting.
 *
 * WHAT WAS ADDED. Chimney pots and TV aerials on the kamienice, because a
 * Polish roofline is mostly chimneys; a clock on the church tower; the lit
 * windows split into three groups on coprime cycles so the city wakes unevenly
 * instead of all at once; a dithered haze band along the base of the skyline,
 * which does more for depth than anything else here; bare-tree branch structure
 * instead of a colour swap; and the crows now sit on the cable at the y the
 * cable is actually at, computed with cableY() rather than guessed.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * depth — distance is contrast, and contrast is a mix toward the horizon
 * -------------------------------------------------------------------- */

/**
 * Mix a material toward the horizon band of the sky by `k`. This is the whole
 * depth model: the far things are not smaller, they are closer to the sky.
 */
function hazeRamp(mat: Mat, k: number): Record<Ph, Mat> {
  const out = {} as Record<Ph, Mat>;
  for (const p of ["dawn", "day", "dusk", "night"] as const) {
    out[p] = dim(mat, K.sky[p][3], k);
  }
  return out;
}

/** Poured concrete slabs, which is what the far skyline is made of. */
const SK_SLAB_MAT: Mat = {
  hi: "#b6bcc6",
  base: "#a2a8b6",
  mid: "#989eaa",
  lo: "#8e94a4",
  deep: "#767c8c",
};
/** The heating plant and the water tower: older, greyer, more stained. */
const SK_PLANT_MAT: Mat = {
  hi: "#b8b0b0",
  base: "#a8a0a0",
  mid: "#9c9494",
  lo: "#948c8c",
  deep: "#7a7272",
};
/** Church stone, which is the palest thing on the horizon. */
const SK_STONE_MAT: Mat = {
  hi: "#c2c6d0",
  base: "#aeb2be",
  mid: "#a4a8b4",
  lo: "#9a9eaa",
  deep: "#828694",
};
/** Three kamienice, three different stucco colours, because that is Oliwa. */
const SK_KAM_A_MAT: Mat = {
  hi: "#d8bc90",
  base: "#c4a878",
  mid: "#b89c6c",
  lo: "#a88c60",
  deep: "#8a7148",
};
const SK_KAM_B_MAT: Mat = {
  hi: "#d4a89c",
  base: "#c09488",
  mid: "#b4887c",
  lo: "#a67c72",
  deep: "#8a6258",
};
const SK_KAM_C_MAT: Mat = {
  hi: "#bcc8ac",
  base: "#a8b498",
  mid: "#9ca88c",
  lo: "#8c9a7c",
  deep: "#727e64",
};
/** Roof tile, which on a kamienica is always this red-brown under the dirt. */
const SK_TILE_MAT: Mat = {
  hi: "#8a5a4e",
  base: "#75483e",
  mid: "#6a4036",
  lo: "#5d382e",
  deep: "#452720",
};
const SK_CRANE_MAT: Mat = {
  hi: "#5d5a68",
  base: "#4a4653",
  mid: "#433f4c",
  lo: "#3a3843",
  deep: "#2b2a32",
};

/* Distance bands. The number is how much of the horizon each one has taken on. */
const SK_FAR = hazeRamp(SK_SLAB_MAT, 0.34); // the plant, the crane, the right slabs
const SK_MID = hazeRamp(SK_SLAB_MAT, 0.2); // the left slabs
const SK_STONE = hazeRamp(SK_STONE_MAT, 0.2); // the church
const SK_PLANT = hazeRamp(SK_PLANT_MAT, 0.34);
const SK_CRANE = hazeRamp(SK_CRANE_MAT, 0.3);
const SK_KAM_A = hazeRamp(SK_KAM_A_MAT, 0.09); // the kamienice, nearest of the lot
const SK_KAM_B = hazeRamp(SK_KAM_B_MAT, 0.09);
const SK_KAM_C = hazeRamp(SK_KAM_C_MAT, 0.09);
const SK_TILE = hazeRamp(SK_TILE_MAT, 0.11);
const SK_TREE = hazeRamp(M.leaf, 0.07);
const SK_TREE_BARE = hazeRamp(
  { hi: "#7a7060", base: "#6b6350", mid: "#615a48", lo: "#57503f", deep: "#433d30" },
  0.07,
);

/* -------------------------------------------------------------------- *
 * clouds — three banks that start and finish off-frame
 * -------------------------------------------------------------------- */

/**
 * Each bank is drawn off the left edge and travels far enough to leave on the
 * right, so the reset happens where nobody can see it. `offset` is a negative
 * begin, which starts the timeline part-way through and spreads the banks out
 * at t=0 instead of leaving an empty sky for the first two minutes.
 */
const CLOUD_BANKS = [
  {
    d: pxPath([
      [-60, 14, 34, 6],
      [-52, 10, 18, 5],
      [-56, 19, 26, 3],
    ]),
    under: pxPath([[-56, 19, 26, 3]]),
    dur: 420,
    to: 1400,
    offset: 120,
  },
  {
    d: pxPath([
      [-120, 26, 48, 6],
      [-108, 21, 26, 6],
      [-114, 32, 36, 3],
    ]),
    under: pxPath([[-114, 32, 36, 3]]),
    dur: 330,
    to: 1460,
    offset: 250,
  },
  {
    d: pxPath([
      [-200, 8, 28, 5],
      [-192, 4, 14, 4],
      [-196, 13, 20, 3],
    ]),
    under: pxPath([[-196, 13, 20, 3]]),
    dur: 500,
    to: 1560,
    offset: 60,
  },
  /** one thin cirrus band, high up, which only shows when the sky is clear */
  {
    d: pxPath([
      [-160, 6, 60, 2],
      [-130, 4, 34, 2],
    ]),
    under: pxPath([]),
    dur: 620,
    to: 1520,
    offset: 400,
  },
] as const;

function Clouds({ dark, flat, clear }: { dark: boolean; flat: boolean; clear: boolean }) {
  const tint = dark ? "#6a7080" : "#e8ecf0";
  const shade = dark ? "#565c6a" : "#c4cbd4";
  return (
    <g opacity={flat ? 0.9 : 0.72}>
      {CLOUD_BANKS.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cloud banks are static, never reorder
        <g key={i} opacity={i === 3 && !clear ? 0 : 1}>
          <path d={c.d} fill={tint} />
          {/* the underside, one shade down, which is what makes it a cloud */}
          <path d={c.under} fill={shade} />
          <path d={c.d} fill={dth("c", "25")} opacity={0.28} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0 0;${c.to} 0`}
            dur={`${c.dur}s`}
            begin={`-${c.offset}s`}
            repeatCount="indefinite"
          />
        </g>
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------- *
 * skyline geometry — every pitch is steppedRoof, every cable steppedCable
 * -------------------------------------------------------------------- */

/** The wire, and where it actually is, so the crows can sit on it. */
const SK_WIRE = { x0: 560, y0: 44, x1: 960, y1: 46, sag: 16 } as const;
const SK_WIRE_D = pxPath(
  steppedCable(SK_WIRE.x0, SK_WIRE.y0, SK_WIRE.x1, SK_WIRE.y1, SK_WIRE.sag, 8),
);
const skWireY = (x: number) =>
  cableY(SK_WIRE.x0, SK_WIRE.y0, SK_WIRE.x1, SK_WIRE.y1, SK_WIRE.sag, x);
/** Two crows, each sitting on the cable at the height the cable is at. */
const SK_CROWS = [694, 744] as const;

const SK = {
  /** the far pair of slabs and the near pair, kept at their original x */
  slabsFar: pxPath([
    [650, 74, 26, 62],
    [688, 82, 20, 54],
  ]),
  slabsMid: pxPath([
    [470, 96, 30, 40],
    [506, 88, 22, 48],
  ]),
  /** the slab window grids, which is what makes them read as housing */
  slabGrid: pxPath([
    ...repeat(6, 10, [654, 80, 18, 1] as Rect, "y"),
    ...repeat(5, 10, [691, 88, 14, 1] as Rect, "y"),
    ...repeat(4, 10, [474, 102, 22, 1] as Rect, "y"),
    ...repeat(5, 9, [509, 94, 16, 1] as Rect, "y"),
  ]),
  /** the church: nave, tower, stepped spire, cross, and a clock */
  church: pxPath([
    [598, 92, 34, 44],
    [606, 60, 16, 76],
  ]),
  spire: pxPath(steppedRoof(606, 622, 60, 22, 0, 2)),
  cross: pxPath([
    [613, 32, 2, 8],
    [610, 35, 8, 2],
  ]),
  clock: pxPath([[610, 70, 8, 8]]),
  clockHands: pxPath([
    [613, 72, 2, 3],
    [614, 74, 3, 2],
  ]),
  /** the water tower: cap, tank, three legs */
  tower: pxPath([
    [768, 58, 28, 20],
    [766, 56, 32, 4],
    [772, 78, 5, 58],
    [787, 78, 5, 58],
    [779, 90, 6, 46],
  ]),
  towerCap: pxPath(steppedRoof(766, 798, 56, 12, 0, 2)),
  /** the heating plant */
  stack: pxPath([[830, 30, 12, 106]]),
  stackDark: pxPath([[838, 30, 4, 106]]),
  stackBandRed: pxPath([
    [829, 34, 14, 6],
    [829, 62, 14, 6],
  ]),
  stackBandWhite: pxPath([[829, 48, 14, 6]]),
  /** the crane that has not moved since March */
  crane: pxPath([
    [884, 36, 2, 46],
    [858, 36, 54, 2],
    [876, 38, 2, 10],
    [904, 38, 1, 12],
    [902, 50, 5, 4],
  ]),
  /* --- the three kamienice, walls and stepped roofs --- */
  kamA: pxPath([[576, 86, 72, 50]]),
  kamACourse: pxPath([[576, 86, 72, 3]]),
  kamARoof: pxPath(steppedRoof(576, 648, 86, 20, 48, 2)),
  kamB: pxPath([[652, 90, 64, 46]]),
  kamBCourse: pxPath([[652, 90, 64, 3]]),
  kamBRoof: pxPath(steppedRoof(652, 716, 90, 18, 44, 2)),
  kamC: pxPath([[720, 88, 42, 48]]),
  kamCCourse: pxPath([[720, 88, 42, 3]]),
  kamCRoof: pxPath(steppedRoof(720, 762, 88, 18, 26, 2)),
  /** kamienica windows, in courses, because they are always in courses */
  kamWindows: pxPath([
    ...bank([[582, 96, 6, 8]], 5, 13),
    ...bank([[582, 112, 6, 8]], 5, 13),
    ...bank([[658, 100, 5, 7]], 5, 12),
    ...bank([[658, 116, 5, 7]], 5, 12),
    ...bank([[726, 98, 5, 7]], 3, 12),
    ...bank([[726, 114, 5, 7]], 3, 12),
  ]),
  /**
   * Chimney pots and aerials. A Polish roofline is mostly chimneys, and the old
   * pass had none at all — which is most of why the roofs read as blank wedges.
   */
  chimneys: pxPath([
    [584, 60, 5, 9],
    [604, 58, 4, 10],
    [636, 62, 5, 7],
    [660, 66, 4, 8],
    [690, 64, 5, 10],
    [706, 68, 4, 6],
    [728, 64, 4, 8],
    [750, 66, 5, 7],
  ]),
  chimneyPots: pxPath([
    [584, 58, 5, 2],
    [604, 56, 4, 2],
    [636, 60, 5, 2],
    [660, 64, 4, 2],
    [690, 62, 5, 2],
    [706, 66, 4, 2],
    [728, 62, 4, 2],
    [750, 64, 5, 2],
  ]),
  /** one TV aerial and one dish, which is the other half of a roofline */
  aerial: pxPath([
    [668, 52, 1, 14],
    [664, 54, 9, 1],
    [665, 57, 7, 1],
    [666, 60, 5, 1],
  ]),
  dish: pxPath([
    [736, 58, 6, 6],
    [738, 64, 1, 4],
  ]),
  /* --- the park line, nearest of the far things --- */
  treeCanopy: pxPath([
    [566, 118, 28, 18],
    [572, 112, 18, 8],
    [578, 108, 8, 6],
    [646, 122, 24, 14],
    [652, 116, 14, 8],
    [760, 118, 30, 18],
    [766, 112, 20, 8],
    [772, 108, 10, 6],
    [806, 122, 26, 14],
    [812, 116, 16, 8],
    [852, 118, 30, 18],
    [858, 112, 20, 8],
    [864, 108, 10, 6],
    [534, 116, 26, 20],
    [540, 110, 16, 10],
  ]),
  /** the lit top of every canopy, which is the only modelling they get */
  treeLit: pxPath([
    [572, 112, 18, 2],
    [652, 116, 14, 2],
    [766, 112, 20, 2],
    [812, 116, 16, 2],
    [858, 112, 20, 2],
    [540, 110, 16, 2],
  ]),
  /** bare trees are a trunk and branch structure, not a colour swap */
  bareTrunks: pxPath([
    [578, 118, 3, 18],
    [656, 122, 3, 14],
    [772, 118, 3, 18],
    [818, 122, 3, 14],
    [864, 118, 3, 18],
    [545, 116, 3, 20],
  ]),
  bareBranches: pxPath([
    [572, 116, 14, 1],
    [576, 112, 8, 1],
    [652, 120, 11, 1],
    [766, 116, 14, 1],
    [770, 112, 8, 1],
    [814, 120, 11, 1],
    [858, 116, 14, 1],
    [540, 114, 12, 1],
  ]),
} as const;

/**
 * The lit windows, split three ways on coprime cycles. The old pass turned the
 * whole city on at the same instant and left it on; a city wakes unevenly.
 */
const SK_LIT = [
  pxPath([
    [476, 102, 4, 4],
    [654, 80, 4, 4],
    [664, 112, 4, 4],
    [584, 98, 4, 5],
    [700, 102, 3, 5],
  ]),
  pxPath([
    [510, 94, 4, 4],
    [664, 88, 4, 4],
    [694, 92, 4, 4],
    [608, 114, 4, 5],
    [732, 100, 3, 5],
  ]),
  pxPath([
    [654, 100, 4, 4],
    [611, 70, 6, 8],
    [660, 118, 4, 5],
    [754, 116, 3, 5],
  ]),
] as const;

/**
 * Snow lies on the ridge and the upper courses of every roof, and on the
 * chimney pots, the slab tops and the tower cap. One path for the lot.
 */
const SK_SNOW = pxPath([
  ...steppedRoof(576, 648, 86, 20, 48, 2)
    .slice(4)
    .map(([x, y, w]) => [x, y, w, 1] as Rect),
  ...steppedRoof(652, 716, 90, 18, 44, 2)
    .slice(4)
    .map(([x, y, w]) => [x, y, w, 1] as Rect),
  ...steppedRoof(720, 762, 88, 18, 26, 2)
    .slice(4)
    .map(([x, y, w]) => [x, y, w, 1] as Rect),
  ...steppedRoof(606, 622, 60, 22, 0, 2)
    .slice(3)
    .map(([x, y, w]) => [x, y, w, 1] as Rect),
  ...steppedRoof(766, 798, 56, 12, 0, 2)
    .slice(1)
    .map(([x, y, w]) => [x, y, w, 1] as Rect),
  [584, 57, 5, 1],
  [604, 55, 4, 1],
  [636, 59, 5, 1],
  [660, 63, 4, 1],
  [690, 61, 5, 1],
  [706, 65, 4, 1],
  [728, 61, 4, 1],
  [750, 63, 5, 1],
  [650, 73, 26, 1],
  [688, 81, 20, 1],
  [470, 95, 30, 1],
  [506, 87, 22, 1],
  [768, 57, 28, 1],
]);

/**
 * The haze band along the base of the skyline. This one path does more for the
 * sense of distance than every other change in this block put together — it is
 * the reason the city sits behind the street instead of on top of it.
 */
const SK_HAZE = pxPath([
  [440, 124, 540, 6],
  [440, 130, 540, 6],
  [440, 136, 540, 4],
]);

/* -------------------------------------------------------------------- *
 * the plane
 * -------------------------------------------------------------------- */

function Skyline({ ph, s }: { ph: Ph; s: StreetState }) {
  const dark = ph === "night" || ph === "dusk";
  const flat = isFlat(s);
  const snow = isSnow(s);
  const bare = s.season === "bare";
  const tree = bare ? SK_TREE_BARE[ph] : SK_TREE[ph];
  return (
    <g>
      {/* ---- band 3: the plant, the crane, the tower, the far slabs -------- */}
      <path d={SK.slabsFar} fill={SK_FAR[ph].base} />
      <path
        d={pxPath([
          [650, 74, 26, 1],
          [688, 82, 20, 1],
        ])}
        fill={SK_FAR[ph].hi}
      />
      <path d={SK.slabGrid} fill={SK_FAR[ph].lo} opacity={0.55} />
      <path d={SK.tower} fill={SK_PLANT[ph].base} />
      <path d={SK.towerCap} fill={SK_PLANT[ph].lo} />
      <path d={pxPath([[766, 56, 32, 1]])} fill={SK_PLANT[ph].hi} />
      {/* the plant: stack, its bands, its beacon */}
      <path d={SK.stack} fill={SK_PLANT[ph].base} />
      <path d={SK.stackDark} fill={SK_PLANT[ph].lo} />
      <path
        d={SK.stackBandRed}
        fill={dim({ ...SK_PLANT[ph], base: "#c05050" }, K.sky[ph][3], 0.3).base}
      />
      <path d={SK.stackBandWhite} fill={SK_PLANT[ph].hi} />
      <path d={pxPath([[834, 26, 4, 4]])} fill={K.ledRed}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.15;1;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
      </path>
      {/* the plume. In cold air it stands up instead of drifting off. */}
      {[0, 3.4, 6.8].map((d) => (
        <path
          key={d}
          d={pxPath([
            [830, 18, 14, 8],
            [836, 12, 12, 6],
          ])}
          fill={dth("c", "25")}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            values="0;0.45;0"
            begin={`${d}s`}
            dur="10s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values={snow ? "0 0;4 -8;8 -16;12 -24" : "0 0;12 -6;26 -14;44 -22"}
            begin={`${d}s`}
            dur="10s"
            repeatCount="indefinite"
          />
        </path>
      ))}
      {/* the crane, and the light on the end of the jib */}
      <path d={SK.crane} fill={SK_CRANE[ph].base} />
      <path d={pxPath([[858, 36, 54, 1]])} fill={SK_CRANE[ph].hi} />
      <path d={pxPath([[884, 32, 3, 3]])} fill={K.ledRed}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.1;1;1"
          dur="3.4s"
          repeatCount="indefinite"
        />
      </path>

      {/* ---- band 2: the church and the near slabs ------------------------- */}
      <path d={SK.slabsMid} fill={SK_MID[ph].base} />
      <path
        d={pxPath([
          [470, 96, 30, 1],
          [506, 88, 22, 1],
        ])}
        fill={SK_MID[ph].hi}
      />
      <path d={SK.church} fill={SK_STONE[ph].base} />
      <path
        d={pxPath([
          [598, 92, 34, 1],
          [606, 60, 16, 1],
        ])}
        fill={SK_STONE[ph].hi}
      />
      <path d={SK.spire} fill={SK_TILE[ph].mid} />
      <path
        d={pxPath(steppedRoof(606, 622, 60, 22, 0, 2).map(([x, y, w]) => [x, y, w, 1] as Rect))}
        fill={SK_TILE[ph].hi}
      />
      <path d={SK.cross} fill={SK_STONE[ph].hi} />
      {/* the clock, which every church tower in Oliwa has and which is slow */}
      <path d={SK.clock} fill={SK_STONE[ph].hi} />
      <path d={SK.clockHands} fill={SK_STONE[ph].deep} />

      {/* ---- band 1: the kamienice, which are older than anything else ----- */}
      <path d={SK.kamARoof} fill={SK_TILE[ph].base} />
      <path d={SK.kamBRoof} fill={SK_TILE[ph].mid} />
      <path d={SK.kamCRoof} fill={SK_TILE[ph].base} />
      {/* the course lines up the pitch, which is what makes it read as tile */}
      <path
        d={pxPath(
          [
            ...steppedRoof(576, 648, 86, 20, 48, 2),
            ...steppedRoof(652, 716, 90, 18, 44, 2),
            ...steppedRoof(720, 762, 88, 18, 26, 2),
          ].map(([x, y, w]) => [x, y, w, 1] as Rect),
        )}
        fill={SK_TILE[ph].hi}
        opacity={0.5}
      />
      <path d={SK.kamA} fill={SK_KAM_A[ph].base} />
      <path d={SK.kamACourse} fill={SK_KAM_A[ph].lo} />
      <path d={pxPath([[576, 86, 4, 50]])} fill={SK_KAM_A[ph].hi} />
      <path d={SK.kamB} fill={SK_KAM_B[ph].base} />
      <path d={SK.kamBCourse} fill={SK_KAM_B[ph].lo} />
      <path d={pxPath([[652, 90, 4, 46]])} fill={SK_KAM_B[ph].hi} />
      <path d={SK.kamC} fill={SK_KAM_C[ph].base} />
      <path d={SK.kamCCourse} fill={SK_KAM_C[ph].lo} />
      <path d={pxPath([[720, 88, 4, 48]])} fill={SK_KAM_C[ph].hi} />
      <path d={SK.kamWindows} fill={dark ? "#3f4650" : "#5a5a6a"} />
      {/* chimneys, pots, an aerial and a dish. A roofline is mostly chimneys. */}
      <path d={SK.chimneys} fill={SK_KAM_A[ph].lo} />
      <path d={SK.chimneyPots} fill={SK_TILE[ph].deep} />
      <path d={SK.aerial} fill={SK_CRANE[ph].base} />
      <path d={SK.dish} fill={SK_PLANT[ph].hi} />

      {/* ---- the windows that are awake, in three groups on three cycles --- */}
      {dark
        ? SK_LIT.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lit-window groups are static
            <path key={i} d={d} fill={K.glassLit} opacity={0.9}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values={["0.9;0.9;0.9;0.25", "0.9;0.25;0.9;0.9", "0.25;0.9;0.9;0.9"][i]}
                dur={`${170 + i * 43}s`}
                repeatCount="indefinite"
              />
            </path>
          ))
        : null}

      {/* ---- snow, on every ridge and pot in one path ---------------------- */}
      {snow ? <path d={SK_SNOW} fill={K.snow} opacity={0.85} /> : null}

      {/* ---- the park line, nearest of the far things ---------------------- */}
      {bare ? (
        <g>
          <path d={SK.bareTrunks} fill={tree.base} />
          <path d={SK.bareBranches} fill={tree.lo} />
        </g>
      ) : (
        <g>
          <path d={SK.treeCanopy} fill={tree.base} />
          <path d={SK.treeLit} fill={tree.hi} />
        </g>
      )}

      {/* ---- the haze band, which is what puts the city behind the street -- */}
      <path d={SK_HAZE} fill={dth("c", "50")} opacity={flat ? 0.5 : 0.28} />
      <path d={pxPath([[440, 130, 540, 10]])} fill={K.sky[ph][3]} opacity={flat ? 0.3 : 0.16} />

      {/* ---- the wire, and the two crows that own it ----------------------- */}
      <path d={SK_WIRE_D} fill="#3a3b3a" />
      {SK_CROWS.map((cx, i) => {
        const cy = skWireY(cx);
        return (
          <g key={cx}>
            <path
              d={pxPath([
                [cx, cy - 3, 4, 3],
                [cx + 3, cy - 5, 2, 2],
              ])}
              fill="#22201e"
            />
            {i === 1 ? (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={`0 ${cx} ${cy};0 ${cx} ${cy};-9 ${cx} ${cy};0 ${cx} ${cy}`}
                dur="9.5s"
                repeatCount="indefinite"
              />
            ) : null}
          </g>
        );
      })}

      {/* ---- a plane, high up, keeping its own time ------------------------ */}
      <g>
        <path
          d={pxPath([
            [0, 18, 7, 2],
            [2, 16, 2, 6],
            [-10, 19, 9, 1],
          ])}
          fill={SK_FAR[ph].hi}
        />
        <path d={pxPath([[0, 20, 1, 1]])} fill={K.ledRed}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0;1;0;1"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-40 0;-40 0;1340 40;1340 40"
          keyTimes="0;0.5;0.94;1"
          dur="300s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the blocks
 * ================================================================== */

type Life = "plain" | "curtains" | "plant" | "lit" | "blinds" | "tv" | "cat" | "dish";

/**
 * A first-floor window, cropped by the frame. Seven of these on block 14 and
 * five on 16, and each one is a different household — which is the cheapest
 * possible way to make a block of flats feel occupied.
 */
function SillWindow({
  x,
  ph,
  life = "plain",
  snow,
}: {
  x: number;
  ph: Ph;
  life?: Life;
  snow?: boolean;
}) {
  const night = ph === "night";
  const dark = night || ph === "dusk";
  /** who is awake, and when */
  const lit =
    (life === "lit" && ph !== "day") ||
    (life === "tv" && dark) ||
    (life === "curtains" && ph === "dawn");
  const glass = lit ? K.glassLit : dark ? K.glass.night : K.glass[ph];
  return (
    <g>
      {/* the window sits deep in the wall, which is what a reveal is */}
      {px(x - 3, 0, 30, 30, FRAME[ph].deep)}
      {px(x - 1, 0, 26, 27, FRAME[ph].base)}
      {px(x, 0, 24, 24, glass)}
      {!dark ? px(x, 0, 24, 9, "#bcd2e0") : null}
      {px(x + 11, 0, 2, 24, FRAME[ph].base)}
      {lit ? px(x, 0, 24, 24, "#ffe6a8") : null}
      {life === "curtains" ? (
        <g>
          {px(x, 0, 5, 24, K.curtain)}
          {px(x + 19, 0, 5, 24, K.curtain)}
          {px(x + 5, 0, 2, 18, "#d8d3c5")}
          {px(x + 17, 0, 2, 15, "#d8d3c5")}
          {lit ? px(x + 8, 6, 8, 18, "#c9a878") : null}
        </g>
      ) : null}
      {life === "blinds" ? (
        <g>
          {px(x, 0, 24, dark ? 20 : 10, "#d8d3c5")}
          <path d={pxPath(repeat(dark ? 4 : 2, 4, [x, 4, 24, 1] as Rect, "y"))} fill="#b8b3a4" />
        </g>
      ) : null}
      {life === "plant" ? (
        <g>
          {px(x + 3, 17, 7, 7, "#8a5a3a")}
          {px(x + 3, 17, 7, 2, "#9a6a46")}
          {px(x + 2, 11, 9, 6, M.leaf.base)}
          {px(x + 4, 8, 4, 4, M.leaf.mid)}
          {px(x + 14, 19, 6, 5, "#8a5a3a")}
          {px(x + 14, 14, 6, 5, M.leaf.mid)}
          {px(x + 20, 18, 3, 6, "#7a7a4a")}
        </g>
      ) : null}
      {life === "tv" && dark ? (
        <rect x={x + 4} y={6} width={16} height={16} fill="#9fc7d6" opacity={0.55}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.55;0.22;0.5;0.28;0.55"
            dur="1.9s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {life === "cat" ? (
        <g>
          {px(x + 7, 15, 11, 9, dark ? "#2b2f36" : "#3a3f47")}
          {px(x + 7, 12, 3, 4, dark ? "#2b2f36" : "#3a3f47")}
          {px(x + 12, 12, 3, 4, dark ? "#2b2f36" : "#3a3f47")}
          <path
            d={pxPath([
              [x + 8, 16, 2, 1],
              [x + 13, 16, 2, 1],
            ])}
            fill={dark ? "#c9a24b" : "#8fa86a"}
          />
          <rect x={x + 17} y={21} width={5} height={2} fill={dark ? "#2b2f36" : "#3a3f47"}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${x + 17} 22;-16 ${x + 17} 22;6 ${x + 17} 22;0 ${x + 17} 22`}
              dur="6.2s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {/* the concrete sill, its drip shadow, and what ends up on sills */}
      {px(x - 4, 30, 32, 4, R14[ph].mid)}
      {px(x - 4, 30, 32, 1, R14[ph].hi)}
      {snow ? px(x - 4, 29, 32, 2, K.snow) : null}
      {life === "plain" ? px(x + 16, 26, 5, 4, "#aebfc9") : null}
      {life === "dish" ? (
        <g>
          {px(x + 26, 4, 3, 14, STEEL[ph].lo)}
          {px(x + 22, 2, 11, 11, "#d8d5cc")}
          {px(x + 24, 4, 7, 7, "#b8b5ac")}
          {px(x + 27, 12, 2, 4, STEEL[ph].lo)}
        </g>
      ) : null}
    </g>
  );
}

function Plaque({ x, y, digits }: { x: number; y: number; digits: string }) {
  return (
    <g>
      {px(x, y, 26, 14, K.plaqueBlue)}
      {px(x + 1, y + 1, 24, 12, "#2a5a94")}
      {px(x + 3, y + 3, 20, 2, K.white)}
      <PixelText x={x + 7} y={y + 7} text={digits} fill={K.white} />
    </g>
  );
}

/** Gablota: the housing-association notices, half of them expired. */
function NoticeBoard({ ph }: { ph: Ph }) {
  return (
    <g>
      <Bev set={NOTICE_SET} mat={OAK[ph]} />
      {px(124, 78, 36, 36, "#d8d3c5")}
      <rect x={124} y={78} width={36} height={36} fill="url(#px-satin)" opacity={0.5} />
      {px(127, 81, 14, 18, K.white)}
      <path
        d={pxPath([
          [128, 83, 12, 1],
          [128, 86, 10, 1],
          [128, 89, 11, 1],
          [128, 92, 7, 1],
        ])}
        fill="#8a8578"
      />
      {px(143, 84, 14, 12, K.gas)}
      <path
        d={pxPath([
          [145, 87, 10, 1],
          [145, 90, 7, 1],
        ])}
        fill="#7a6a2a"
      />
      {px(127, 102, 12, 10, K.bagRed)}
      {px(142, 100, 16, 12, K.white)}
      {px(144, 103, 12, 1, "#8a8578")}
      {/* the corner that has been curling since spring */}
      {px(155, 100, 4, 4, R14[ph].base)}
      {px(140, 114, 3, 3, "#8a8578")}
    </g>
  );
}

/* ==================================================================== *
 * KLATKA B — replacement block for street.tsx
 *
 * Drops in over the existing KlatkaB. The module-scope geometry goes up with the
 * other KLATKA_* constants; the components go where the old one was.
 *
 * THE SAME MOVE AS THE ŻABKA, AND IT PAYS BETTER HERE. This door leads to the
 * lift, and the lift leads to the corridor scene — which is floor four of this
 * exact stairwell, and which already keeps `world.corridor`. Three of its keys
 * are visible from the pavement if you look through the glass:
 *
 *   liftOpen     the car is at the ground floor with its doors open and its
 *                light on, twelve metres down the hall, straight ahead
 *   parcelTaken  before you take it, the courier's slip is taped to the inside
 *                of the entrance glass — which is the thing that tells you to go
 *                up in the first place
 *   noticeRead   the housing-association notice is posted at both ends of the
 *                stairwell; unread it is square and has a red corner, read it
 *                has been there long enough to curl
 *
 * So the entrance is now a preview of the scene behind it, and the parcel slip
 * gives the player a reason to open the door. The old block invented a hall with
 * nothing in it and a notice that never changed.
 *
 * ONE DUPLICATE REMOVED. The old block put a pram in the ground-floor hall, but
 * the corridor scene already has a pram on the fourth-floor landing at x=189 —
 * one stairwell, one pram, and it is upstairs. What is actually chained in a
 * Polish ground-floor hall is bicycles, so that is what is in there now, and the
 * fire officer's letters are about those instead.
 *
 * What else this pass adds:
 *   CANOPY    the slab, its drip edge, the two struts, a caged bulkhead lamp on
 *             the same timer circuit as the stair light — so the two go out
 *             together, which is the detail that tells you it is one circuit —
 *             the KLATKA B panel, and moths after dark.
 *   DOOR      a proper leaf and fixed sidelight instead of one sheet with a bar
 *             down it. The opening is 163..213, which is 1.32 m: a 28 px leaf at
 *             0.74 m and a 22 px sidelight at 0.58 m, which is what a klatka
 *             entrance actually is.
 *             Closer arm, pull handle at the height hands reach, electric
 *             strike, kick plate scuffed to bare metal, and the leaf easing
 *             itself shut on its closer whenever the street is busy.
 *   GLASS     ZAMKNIJ on the leaf, the flats board on the sidelight, the courier
 *             slip, the notice, and the leaflets jammed in the meeting stile.
 *   HALL      through the leaf: the dado, the first flight going up, the mat,
 *             and the lift at the end of it. Through the sidelight: the bank of
 *             twenty-four letterboxes, which is the single most recognisable
 *             thing in any Polish klatka.
 *   DOMOFON   name list, keypad, speaker grille, camera lens with a glint, the
 *             RFID pad, the LED that never sleeps, and the code somebody wrote
 *             on the casing in biro.
 *   WALL      the meter cupboard with its padlock and lightning decal, the fire
 *             brigade key box, the trunking, and the tiled entrance surround
 *             with its step — which is where the snow and the puddle go.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * state and geometry — put this with the other KLATKA_* constants
 * -------------------------------------------------------------------- */

/**
 * What is visible of the corridor scene from the pavement. Same keys and the
 * same defaults as that scene's own reader, read defensively, because the street
 * must not care whether anybody has been upstairs yet.
 */
type HallState = {
  liftOpen: boolean;
  noticeRead: boolean;
  parcelTaken: boolean;
};

function hallState(world: WorldState): HallState {
  const c = ((world as unknown as Record<string, unknown>).corridor ?? {}) as Record<
    string,
    unknown
  >;
  return {
    liftOpen: c.liftOpen === true,
    noticeRead: c.noticeRead === true,
    parcelTaken: c.parcelTaken === true,
  };
}

/** Klatka colours. The hall is 3000K on a timer, not the shop's 4000K. */
const KLK = {
  timer: "#ffe0a8",
  timerDim: "#6a6250",
  hallWall: "#b8b0a0",
  hallWallLo: "#9a9282",
  hallDado: "#6b6a5e",
  hallFloor: "#7a7268",
  tread: "#a8a49a",
  treadNose: "#c2beb4",
  liftDoor: "#8a9094",
  liftDoorHi: "#a3a9ad",
  liftCar: "#f0e8d4",
  liftIndicator: "#e0483a",
  box: "#8a8f96",
  boxFace: "#9aa0a6",
  boxSlot: "#3a3d43",
  boxNumber: "#c9c4b6",
  meter: "#8a9094",
  meterDoor: "#7a8084",
  bolt: "#e8c445",
  fire: "#b03a2c",
  courier: "#f5c518",
  notice: "#f2f2ee",
  noticeOld: "#ded9c8",
  noticeFlag: "#c94040",
  leaflet: "#e8e2d2",
  tile: "#8a8578",
  tileHi: "#9a9488",
  tileLo: "#6f6a5e",
  bike: "#7a3b35",
  bikeAlt: "#2b5aa8",
  wedge: "#8a623f",
} as const;

/* --- the canopy and what hangs off it --- */
const KL_CANOPY_DRIP = pxPath([[KLATKA.x0, 60, KLATKA.x1 - KLATKA.x0 - 10, 2]]);
const KL_STRUTS = pxPath([
  [150, 60, 3, 9],
  [222, 60, 3, 9],
]);
/** The bulkhead lamp, and the wire cage somebody fitted after the third one went. */
const KL_LAMP = pxPath([[181, 62, 14, 7]]);
const KL_LAMP_CAGE = pxPath([
  [181, 62, 1, 7],
  [185, 62, 1, 7],
  [189, 62, 1, 7],
  [193, 62, 1, 7],
  [181, 65, 14, 1],
]);
const KL_LAMP_BRACKET = pxPath([[184, 60, 8, 2]]);
/** The letter panel. This is klatka B and the block wants you to know it. */
const KL_PANEL = bevelPaths([[192, 46, 21, 11]]);

/* --- the door: a leaf and a fixed sidelight, not one sheet --- */
const KL_LEAF = { x: 163, w: 28, gx: 165, gw: 24, gy: 80, gh: 58 } as const;
const KL_SIDE = { x: 191, w: 22, gx: 193, gw: 18, gy: 80, gh: 62 } as const;
/**
 * Rails, not boxes. A glazed door is four rails around a hole, and if these were
 * filled bevelPaths they would paint over the hall you are meant to see through.
 */
const KL_LEAF_RAILS = pxPath([
  [163, 74, 28, 6],
  [163, 138, 28, 10],
  [163, 74, 2, 74],
  [189, 74, 2, 74],
]);
const KL_LEAF_RAILS_HI = pxPath([
  [163, 74, 28, 1],
  [163, 74, 1, 74],
]);
const KL_SIDE_RAILS = pxPath([
  [191, 74, 22, 6],
  [191, 142, 22, 6],
  [191, 74, 2, 74],
  [211, 74, 2, 74],
]);
const KL_SIDE_RAILS_HI = pxPath([
  [191, 74, 22, 1],
  [191, 74, 1, 74],
]);
const KL_LEAF_GLASS = pxPath([[KL_LEAF.gx, KL_LEAF.gy, KL_LEAF.gw, KL_LEAF.gh]]);
const KL_SIDE_GLASS = pxPath([[KL_SIDE.gx, KL_SIDE.gy, KL_SIDE.gw, KL_SIDE.gh]]);
/** Closer arm, pull handle, electric strike, and the kick plate. */
const KL_CLOSER = pxPath([
  [166, 76, 20, 3],
  [184, 77, 6, 2],
]);
const KL_HANDLE = pxPath([[185, 100, 3, 16]]);
const KL_HANDLE_HI = pxPath([[185, 100, 3, 2]]);
const KL_STRIKE = pxPath([[191, 104, 2, 9]]);
const KL_KICK = pxPath([[165, 138, 24, 9]]);
/** The scuff where every boot in the block has hit the kick plate. */
const KL_KICK_WEAR = pxPath([
  [168, 140, 8, 4],
  [180, 141, 5, 3],
]);

/* --- the hall, through the leaf --- */
const KL_HALL_BACK = pxPath([[KL_LEAF.gx, KL_LEAF.gy, KL_LEAF.gw, KL_LEAF.gh]]);
const KL_HALL_DADO = pxPath([[KL_LEAF.gx, 112, KL_LEAF.gw, 3]]);
const KL_HALL_FLOOR = pxPath([[KL_LEAF.gx, 128, KL_LEAF.gw, 10]]);
/** The first flight, going up out of sight — 175 mm risers like every other. */
const KL_STAIRS = pxPath([
  [165, 132, 7, 2],
  [165, 128, 6, 2],
  [165, 124, 5, 2],
  [165, 120, 4, 2],
]);
const KL_STAIR_NOSE = pxPath([
  [165, 132, 7, 1],
  [165, 128, 6, 1],
  [165, 124, 5, 1],
  [165, 120, 4, 1],
]);
/** The lift, at the far end of the hall, twelve metres in. */
const KL_LIFT = pxPath([[173, 98, 12, 32]]);
const KL_LIFT_SPLIT = pxPath([[178, 98, 2, 32]]);
const KL_LIFT_CAR = pxPath([[174, 100, 10, 28]]);
const KL_LIFT_IND = pxPath([[176, 95, 6, 2]]);
/** The mat just inside the door, which is where the leaflets end up. */
const KL_MAT = pxPath([[165, 134, 24, 4]]);
const KL_LEAFLETS = pxPath([
  [167, 133, 5, 2],
  [174, 134, 6, 2],
  [180, 132, 4, 2],
]);
/** The bicycles chained in the hall. The pram is upstairs, in the corridor. */
const KL_BIKES = {
  wheels: pxPath([
    [166, 118, 8, 8],
    [176, 120, 7, 7],
  ]),
  hubs: pxPath([
    [169, 121, 2, 2],
    [179, 123, 2, 2],
  ]),
  frame: pxPath([
    [170, 114, 8, 3],
    [172, 110, 3, 5],
  ]),
};

/* --- the sidelight: twenty-four letterboxes, three across --- */
const KL_BOXES = (() => {
  const face: Rect[] = [];
  const slot: Rect[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const bx = KL_SIDE.gx + c * 6;
      const by = 100 + r * 6;
      face.push([bx, by, 5, 5]);
      slot.push([bx + 1, by + 1, 3, 1]);
    }
  }
  return { face: pxPath(face), slot: pxPath(slot) };
})();

/* --- the domofon, which is a whole assembly and not a grey box --- */
const KL_DOMOFON = bevelPaths([[226, 94, 15, 32]]);
const KL_DOM_GRILLE = pxPath(bank([[228, 97, 1, 1]], 6, 2));
const KL_DOM_NAMES = pxPath([[228, 100, 11, 9]]);
const KL_DOM_NAMELINES = pxPath(repeat(3, 3, [229, 101, 9, 1] as Rect, "y"));
const KL_DOM_KEYS = pxPath(
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [229 + c * 3, 111 + r * 3, 2, 2] as Rect)),
);
const KL_DOM_LENS = pxPath([[237, 100, 3, 3]]);
const KL_DOM_RFID = pxPath([[228, 121, 11, 4]]);
/** The code somebody wrote on the casing in biro, and nobody has cleaned off. */
const KL_DOM_BIRO = pxPath([
  [230, 128, 1, 3],
  [232, 128, 3, 1],
  [232, 130, 3, 1],
  [236, 128, 1, 3],
]);
const KL_DOM_TRUNK = pxPath([[231, 62, 3, 32]]);

/* --- the wall: meter cupboard, fire key box, tiled surround, step --- */
const KL_METER = bevelPaths([[218, 94, 8, 38]]);
const KL_METER_DOOR = pxPath([[219, 96, 6, 34]]);
const KL_METER_HASP = pxPath([
  [223, 110, 3, 5],
  [224, 108, 1, 2],
]);
const KL_METER_BOLT = pxPath([
  [221, 100, 2, 3],
  [220, 103, 3, 1],
  [221, 104, 2, 3],
]);
const KL_FIREBOX = bevelPaths([[219, 136, 7, 9]]);
const KL_FIREBOX_GLASS = pxPath([[220, 138, 5, 5]]);
/** The tiled entrance surround, and the 60 mm step up into the door. */
const KL_SURROUND = bevelPaths([[154, PLINTH_TOP, 68, GROUND - PLINTH_TOP]]);
const KL_SURROUND_TILE = pxPath(bank([[156, 141, 4, 5]], 16, 4));
const KL_STEP = pxPath([[156, 146, 64, 4]]);
const KL_MAT_OUT = pxPath([[162, 147, 52, 3]]);
const KL_MAT_RIBS = pxPath(bank([[164, 148, 2, 2]], 12, 4));

/* -------------------------------------------------------------------- *
 * components
 * -------------------------------------------------------------------- */

/**
 * What is behind the entrance glass. The lift and the notice come from
 * `world.corridor`, so the hall you see is the hall you walk into.
 */
function KlatkaHall({ ph, on, hall }: { ph: Ph; on: boolean; hall: HallState }) {
  return (
    <g>
      {/* the hall itself: wall, dado, floor, all of it three metres deep */}
      <path d={KL_HALL_BACK} fill={on ? KLK.hallWall : KLK.hallWallLo} />
      <path d={KL_HALL_DADO} fill={KLK.hallDado} />
      <path d={KL_HALL_FLOOR} fill={KLK.hallFloor} />
      {/* the first flight, going up and out of frame the way stairs do */}
      <path d={KL_STAIRS} fill={on ? KLK.tread : KLK.hallWallLo} />
      <path d={KL_STAIR_NOSE} fill={on ? KLK.treadNose : KLK.hallDado} />
      {/* the bicycles chained in the hall — the pram is upstairs, in the corridor */}
      <path d={KL_BIKES.wheels} fill="#22201e" />
      <path d={KL_BIKES.hubs} fill={STEEL[ph].lo} />
      <path d={KL_BIKES.frame} fill={KLK.bike} />
      {/* the lift at the end. Open and lit, or shut with its indicator on. */}
      <path d={KL_LIFT} fill={KLK.liftDoor} />
      {hall.liftOpen ? (
        <g>
          <path d={KL_LIFT_CAR} fill={KLK.liftCar} />
          <path d={pxPath([[174, 100, 10, 2]])} fill="#fff8e4" />
          {/* the mirror in the back of the car, which every lift in Poland has */}
          <path d={pxPath([[177, 106, 5, 14]])} fill="#cfd8dc" opacity={0.7} />
        </g>
      ) : (
        <g>
          <path d={KL_LIFT_SPLIT} fill={KLK.hallDado} />
          <path d={pxPath([[173, 98, 12, 1]])} fill={KLK.liftDoorHi} />
        </g>
      )}
      {/* the floor indicator over the doors, which is red and always has been */}
      <path d={KL_LIFT_IND} fill={hall.liftOpen ? KLK.liftIndicator : "#5d3a34"}>
        {hall.liftOpen ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;1;0.3;1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      {/* the mat, and the leaflets that end up on it by the middle of the morning */}
      <path d={KL_MAT} fill="#4a4438" />
      {ph === "dawn" || ph === "day" ? (
        <path d={KL_LEAFLETS} fill={KLK.leaflet} opacity={0.9} />
      ) : null}
      {/* the notice, posted at both ends of the stairwell, on the hall wall above
          the lift — inside the leaf aperture, because the sidelight is letterboxes */}
      <path d={pxPath([[166, 81, 13, 8]])} fill={hall.noticeRead ? KLK.noticeOld : KLK.notice} />
      <path
        d={pxPath([
          [167, 84, 9, 1],
          [167, 86, 6, 1],
        ])}
        fill="#8a8578"
      />
      {hall.noticeRead ? (
        /* read: it has been up long enough for the corner to curl off the wall */
        <path d={pxPath([[176, 81, 3, 3]])} fill={KLK.hallWall} />
      ) : (
        /* unread: the red corner the association puts on anything urgent */
        <path d={pxPath([[176, 81, 3, 3]])} fill={KLK.noticeFlag} />
      )}
    </g>
  );
}

/** The domofon. A whole assembly, and the wall around it tells its own story. */
function KlatkaDomofon({ ph }: { ph: Ph }) {
  return (
    <g>
      {/* the trunking bringing the pair down from the riser */}
      <path d={KL_DOM_TRUNK} fill="#6d6a62" />
      <path d={pxPath([[231, 62, 1, 32]])} fill="#7d7a72" />
      <Bev set={KL_DOMOFON} mat={{ ...STEEL[ph], base: KLK.box, hi: KLK.boxFace }} />
      {/* the speaker grille, the name list, the keypad, the reader pad */}
      <path d={KL_DOM_GRILLE} fill="#4a4d52" />
      <path d={KL_DOM_NAMES} fill="#c9c4b6" />
      <path d={KL_DOM_NAMELINES} fill="#6d6a62" />
      <path d={KL_DOM_KEYS} fill={STEEL[ph].lo} />
      <path d={KL_DOM_RFID} fill="#4a4d52" />
      <path d={pxPath([[232, 122, 3, 2]])} fill={STEEL[ph].base} opacity={0.7} />
      {/* the camera, and the glint that tells you it is a lens and not a hole */}
      <path d={KL_DOM_LENS} fill="#1b2026" />
      <path d={pxPath([[238, 100, 1, 1]])} fill="#c9d8e0" opacity={0.8} />
      {/* the LED that never sleeps */}
      <path d={pxPath([[230, 116, 2, 2]])} fill={K.led}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.4;1;1"
          dur="3.2s"
          repeatCount="indefinite"
        />
      </path>
      {/* and the code somebody wrote on the casing in biro */}
      <path d={KL_DOM_BIRO} fill="#2b4f9e" opacity={0.55} />
    </g>
  );
}

/**
 * Klatka B. The stair light is on a 34-second timer, and so is the bulkhead
 * lamp over the door — same circuit, same button, so they go out together.
 */
function KlatkaB({ ph, s, hall }: { ph: Ph; s: StreetState; hall: HallState }) {
  const dark = ph === "night" || ph === "dusk";
  const on = s.klatka !== "off";
  const timer = s.klatka === "timer";
  const snow = isSnow(s);
  const wet = isWet(s);
  /** Somebody goes in and out every twenty seconds while the street is busy. */
  const traffic = s.crowd >= 2;
  /** The timer's own cycle, shared by the stair light and the bulkhead lamp. */
  const timerVals = "0.28;0.28;0;0;0.28";
  return (
    <g>
      {/* ---- the canopy, its struts, and the letter panel ------------------ */}
      <path d={KLATKA_CANOPY} fill="#d8e4ec" opacity={0.6} />
      <path d={pxPath([[KLATKA.x0, 55, KLATKA.x1 - KLATKA.x0 - 10, 1]])} fill="#eef4f8" />
      <path d={KL_CANOPY_DRIP} fill="#a8b4bc" opacity={0.7} />
      <path d={KL_STRUTS} fill={STEEL[ph].lo} />
      {snow ? (
        <path d={pxPath([[KLATKA.x0, 54, KLATKA.x1 - KLATKA.x0 - 10, 2]])} fill={K.snow} />
      ) : null}
      <Bev set={KL_PANEL} mat={{ ...STEEL[ph], base: "#1e4478", hi: "#2a5a94" }} />
      <BigText x={199} y={48} text="B" fill={K.white} k={2} />
      <Plaque x={162} y={46} digits="14" />

      {/* ---- the bulkhead lamp, caged, on the same timer as the stairs ----- */}
      <path d={KL_LAMP_BRACKET} fill={STEEL[ph].lo} />
      <path d={KL_LAMP} fill={on ? KLK.timer : "#c9c4b6"}>
        {timer ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;1;0.35;0.35;1"
            dur="34s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      <path d={KL_LAMP_CAGE} fill={STEEL[ph].deep} opacity={0.55} />
      {/* the moths, which only exist because the lamp does */}
      {dark && on ? (
        <g>
          {[0, 1].map((i) => (
            <rect
              key={i}
              x={176 + i * 20}
              y={64 + i * 3}
              width={2}
              height={2}
              fill="#e8dfc0"
              opacity={0.7}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0; ${6 - i * 3} ${-4 + i}; ${-5 + i * 2} ${5 - i}; ${3 + i} 2; 0 0`}
                dur={`${2.6 + i * 0.7}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </g>
      ) : null}

      {/* ---- the tiled surround and the step up into the door -------------- */}
      <Bev
        set={KL_SURROUND}
        mat={{ hi: KLK.tileHi, base: KLK.tile, mid: KLK.tile, lo: KLK.tileLo, deep: KLK.tileLo }}
      />
      <path d={KL_SURROUND_TILE} fill={KLK.tileHi} opacity={0.3} />
      <path d={KL_STEP} fill={KLK.tileHi} />
      <path d={pxPath([[156, 146, 64, 1]])} fill="#a8a49a" />
      <path d={KL_MAT_OUT} fill="#4a4438" />
      <path d={KL_MAT_RIBS} fill="#5d5648" />
      {wet ? <path d={pxPath([[156, 146, 64, 2]])} fill={K.waterHi} opacity={0.22} /> : null}
      {snow ? <path d={pxPath([[156, 145, 64, 2]])} fill={K.snow} /> : null}

      {/* ---- the door: base glass, then the hall behind it ----------------- */}
      <Bev set={KLATKA_SET} mat={FRAME[ph]} />
      <path d={KLATKA_GLASS} fill={dark ? "#232a30" : K.glass[ph]} />
      {/* everything you can see through the glass, drawn once and clipped by the
          two panes that are cut into the frame */}
      <KlatkaHall ph={ph} on={on} hall={hall} />
      {/* the twenty-four letterboxes, behind the fixed sidelight */}
      <path d={KL_SIDE_GLASS} fill={on ? KLK.hallWall : KLK.hallWallLo} />
      <path d={KL_BOXES.face} fill={KLK.boxFace} />
      <path d={KL_BOXES.slot} fill={KLK.boxSlot} />
      <path
        d={pxPath(repeat(6, 6, [KL_SIDE.gx, 100, KL_SIDE.gw, 1] as Rect, "y"))}
        fill={KLK.box}
      />
      {/* the flats board over them, which is how you find a name */}
      <path d={pxPath([[194, 84, 16, 9]])} fill="#e8e2d2" />
      <PixelText x={195} y={86} text="1-24" fill="#4a4438" gap={1} op={0.85} />

      {/* ---- the stair light, spilling out of both panes ------------------- */}
      {on ? (
        <g>
          <path d={KL_LEAF_GLASS} fill={KLK.timer} opacity={s.klatka === "on" ? 0.32 : 0.28}>
            {timer ? (
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values={timerVals}
                dur="34s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
          <path d={KL_SIDE_GLASS} fill={KLK.timer} opacity={s.klatka === "on" ? 0.26 : 0.22}>
            {timer ? (
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.22;0.22;0;0;0.22"
                dur="34s"
                repeatCount="indefinite"
              />
            ) : null}
          </path>
        </g>
      ) : null}

      {/* ---- the fixed sidelight: rails, stile, strike, leaflets ----------- */}
      <path d={KL_SIDE_RAILS} fill={FRAME[ph].base} />
      <path d={KL_SIDE_RAILS_HI} fill={FRAME[ph].hi} />
      <path d={KL_STRIKE} fill={STEEL[ph].base} />
      <path d={pxPath([[191, 106, 2, 5]])} fill={STEEL[ph].deep} />
      {ph === "dawn" || ph === "day" ? (
        <path
          d={pxPath([
            [189, 112, 4, 2],
            [189, 116, 3, 2],
          ])}
          fill={KLK.leaflet}
          opacity={0.85}
        />
      ) : null}

      {/* ---- the leaf, which swings on its closer when the street is busy --
             Rails and a glazed panel, so the hall stays visible through it and
             stays put while the leaf moves. Scale about the hinge at x=163. */}
      <g transform="translate(163 0)">
        <g>
          {traffic ? (
            <animateTransform
              attributeName="transform"
              type="scale"
              calcMode="spline"
              values="1 1;1 1;0.42 1;0.62 1;0.88 1;1 1;1 1"
              keyTimes="0;0.55;0.63;0.7;0.78;0.88;1"
              keySplines="0 0 1 1;0.2 0 0.6 1;0.4 0 0.8 1;0.4 0 0.8 1;0.4 0 1 1;0 0 1 1"
              dur="21s"
              repeatCount="indefinite"
            />
          ) : null}
          <g transform="translate(-163 0)">
            {/* the glazing: the cheaper unit they put in after 2016, so it reads
                a shade greener than the sidelight beside it */}
            <path d={KL_LEAF_GLASS} fill={dark ? "#1e252b" : K.glass[ph]} opacity={0.3} />
            <path d={KL_LEAF_RAILS} fill={FRAME[ph].base} />
            <path d={KL_LEAF_RAILS_HI} fill={FRAME[ph].hi} />
            <path d={KL_CLOSER} fill={STEEL[ph].lo} />
            <path d={KL_KICK} fill={STEEL[ph].mid} />
            <path d={pxPath([[165, 138, 24, 1]])} fill={STEEL[ph].hi} />
            <path d={KL_KICK_WEAR} fill={STEEL[ph].hi} opacity={0.5} />
            {/* ZAMKNIJ, which is on the inside of every klatka door in the country */}
            <PixelText x={166} y={126} text="ZAMKNIJ" fill="#c94040" gap={0} op={0.8} />
            {/* the courier's slip, taped on until somebody goes up for the parcel */}
            {!hall.parcelTaken ? (
              <g>
                <path d={pxPath([[167, 92, 16, 11]])} fill={KLK.courier} />
                <path d={pxPath([[167, 92, 16, 3]])} fill="#d8a810" />
                <path
                  d={pxPath([
                    [169, 97, 10, 1],
                    [169, 100, 7, 1],
                  ])}
                  fill="#6b5410"
                />
                <path d={pxPath([[166, 91, 18, 1]])} fill="#d8d3b8" opacity={0.8} />
              </g>
            ) : null}
            <path d={KL_HANDLE} fill={STEEL[ph].base} />
            <path d={KL_HANDLE_HI} fill={STEEL[ph].hi} />
            {/* the smear at exactly the height everybody grabs it */}
            <path d={pxPath([[178, 102, 7, 10]])} fill="#ffffff" opacity={0.06} />
          </g>
        </g>
      </g>

      {/* ---- the wall: meters, key box, domofon --------------------------- */}
      <Bev set={KL_METER} mat={{ ...STEEL[ph], base: KLK.meter, hi: "#a3a9ad" }} />
      <path d={KL_METER_DOOR} fill={KLK.meterDoor} />
      <path d={KL_METER_BOLT} fill={KLK.bolt} opacity={0.85} />
      <path d={KL_METER_HASP} fill="#2e3033" />
      <Bev set={KL_FIREBOX} mat={{ ...STEEL[ph], base: KLK.fire, hi: "#c9503f" }} />
      <path d={KL_FIREBOX_GLASS} fill="#cfe0e6" opacity={0.7} />
      <KlatkaDomofon ph={ph} />
    </g>
  );
}

/* ==================================================================== *
 * THREE CHANGES OUTSIDE THIS BLOCK
 *
 * 1. In StreetScene's middleBackground, pass the hall state in:
 *
 *        <KlatkaB ph={ph} s={s} hall={hallState(world)} />
 *
 * 2. In STREET_SCENE.artKey, join the three new reads — otherwise the entrance
 *    keeps showing a lift that has moved and a parcel that has been collected:
 *
 *        const h = hallState(w);
 *        ... , h.liftOpen ? 1 : 0, h.noticeRead ? 1 : 0, h.parcelTaken ? 1 : 0,
 *
 *    (If you took the Żabka block too, that is `f.*` and `h.*` both appended.)
 *
 * 3. One new hitbox, in the 16 px gap between podezd-door (168–208) and
 *    domofon (224–236):
 *
 *        { id: "klatka-meters", kind: "flavor", x: 216, range: 8 },
 *
 *    It needs a translation entry like the other new ids.
 *
 * OPTIONAL, AND WORTH IT. The courier slip is now a visible hook: when
 * `!parcelTaken` the entrance is telling the player to go upstairs. If you want
 * to make that louder, gate a one-line hint on it in StreetEffects rather than
 * adding another NPC — the slip is doing the work already.
 *
 * NOTE ON THE TIMER. The stair light and the bulkhead lamp share one 34 s
 * animate cycle with matching `values`, so they extinguish on the same frame.
 * SMIL starts every timeline at document begin, so they stay in step without
 * being wired together. If you ever give the klatka its own push-button action,
 * both should restart from it.
 * ==================================================================== */

/* ==================================================================== *
 * ŻABKA SHOPFRONT — replacement block for street.tsx
 *
 * Drops in over the existing ZabkaFascia / Zabka / ZabkaInterior trio. The
 * module-scope geometry goes up with the other ZAB_* constants; the components
 * go where the old ones were.
 *
 * THE ONE THING THAT MATTERS MOST HERE. There is already a Żabka interior scene
 * behind that door with its own `world.zabka` state — hotdogs, coffee, shelves,
 * clerk, customer, delivery. The old shopfront invented its own shop: a roller
 * that was always full, a clerk who was never there, shelves that never emptied.
 * This pass reads the real state, so the four sausages you count through the
 * window are the four that are on the grill when you walk in, the gondola has
 * gaps in it if the shelves are picked, and if the clerk is restocking she is
 * not behind the till in either scene. Same shop, seen from outside.
 *
 * That means two changes outside this block, both listed at the foot of the file:
 * Zabka now takes a `shop` prop, and the street's artKey has to join those reads
 * or the window will go stale while the room behind it does not.
 *
 * Palette is taken from the interior scene rather than invented, so the two
 * agree: 4000K LED (#eef6ff — cold, and not meant to be warm), the grill's
 * #ff9a3a, sausages at #c2703a, the chiller at #dff0f6, crates at #2f6ab0.
 * The old block lit this window warm amber at dusk, which was the one wrong
 * note in the whole street — a Żabka at dusk is the only cold light on it.
 *
 * What else this pass adds:
 *   FASCIA      bird spikes, and the droppings that prove they went on late; the
 *               fixing bolts; a stainless extract cowl cut straight through the
 *               sign band, because the unit was never vented for a hot-dog
 *               roller; a CZYNNE panel; a projecting blade sign, which is the
 *               only reason blade signs exist.
 *   GLAZING     mullions, head rail, manifestation dots, a taped crack, two promo
 *               posters at real prices, the 18+ decal, the CCTV notice.
 *   DOOR        closer arm, chime sensor, kick plate, the payment decal row, and
 *               PCHAĆ / ZAMKNIĘTE — which needed the diacritics the kit gained.
 *   STALLRISER  the tiled band that takes every trolley in the district.
 *   INTERIOR    battens, danglers, three gondolas with product bands and white
 *               shelf-edge rails, press rack, dump bin, basket stack, security
 *               mirror, the cold wall with bottle silhouettes and a compressor
 *               light, coffee machine, roller grill, till, the cigarette gantry
 *               with its doors shut because the law says so, and Pani z Żabki.
 *   CLOSED      grille, padlock, shutter box, and the night light they leave on,
 *               which is what makes a shut shop read as shut and not as absent.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * geometry and palette — put this with the other ZAB_* constants
 * -------------------------------------------------------------------- */

/**
 * Shop colours, lifted from the interior scene so the two never disagree. If
 * you change one of these, change it there too — they are the same shop.
 */
const ZK = {
  /** 4000K. The interior scene calls this "the colour of a shop at 3 a.m." */
  led: "#eef6ff",
  ledDim: "#b8c8d4",
  tile: "#1e4033",
  tileHi: "#2c5844",
  tileLo: "#152e25",
  shelf: "#8a6a4a",
  shelfHi: "#a37f5a",
  crisp: "#e8a445",
  drink: "#3ab0e0",
  energy: "#c8f03a",
  sweet: "#c22a22",
  dairy: "#f0f0e8",
  chill: "#dff0f6",
  chillDeep: "#2e4048",
  beer: "#c9a24b",
  grillWarm: "#ff9a3a",
  sausage: "#c2703a",
  sausageHi: "#d98a4e",
  coffee: "#5a3f2c",
  crema: "#c98a5a",
  roller: "#b0b5ba",
  gantry: "#3a4148",
  apron: "#0d7d46",
  apronHi: "#16a05c",
  mirror: "#aebfc9",
  screen: "#12242e",
  screenText: "#7ee08c",
  crate: "#2f6ab0",
  crateHi: "#4a86cc",
  cardboard: "#b08a5e",
  spike: "#8a8f96",
  dropping: "#e4e6e0",
} as const;

/**
 * What is visible of the shop from the pavement. Same keys and the same
 * vocabularies as the interior scene's `state()`, read defensively, because the
 * street must not care whether anybody has been inside yet.
 */
type ShopFront = {
  hotdogs: 0 | 1 | 2 | 3 | 4;
  coffee: "idle" | "grinding" | "pouring" | "done";
  shelves: "full" | "picked" | "bare";
  clerk: "counter" | "restocking" | "away";
  customer: "none" | "browsing" | "paying";
  delivery: boolean;
};

const SF_COFFEE = ["idle", "grinding", "pouring", "done"] as const;
const SF_SHELVES = ["full", "picked", "bare"] as const;
const SF_CLERK = ["counter", "restocking", "away"] as const;
const SF_CUSTOMER = ["none", "browsing", "paying"] as const;

function shopFront(world: WorldState): ShopFront {
  const b = ((world as unknown as Record<string, unknown>).zabka ?? {}) as Record<string, unknown>;
  return {
    hotdogs: clampInt(b.hotdogs, 4, 3) as 0 | 1 | 2 | 3 | 4,
    coffee: clampStage(b.coffee, SF_COFFEE, "idle"),
    shelves: clampStage(b.shelves, SF_SHELVES, "full"),
    clerk: clampStage(b.clerk, SF_CLERK, "counter"),
    customer: clampStage(b.customer, SF_CUSTOMER, "browsing"),
    delivery: b.delivery === true,
  };
}

/** The three panes, and the stallriser that cuts across the bottom of them. */
const ZAB_PANE_L = { x: 306, w: 114 } as const;
const ZAB_PANE_R = { x: 488, w: 84 } as const;
const ZAB_GLASS_TOP = 78;
const ZAB_GLASS_BOT = 142; // where the stallriser takes over
const ZAB_STALL = bevelPaths([[302, ZAB_GLASS_BOT, 276, GROUND - ZAB_GLASS_BOT]]);
/** 100 mm tiles, and the three places boots have chipped them. */
const ZAB_STALL_TILE = pxPath(bank([[304, 144, 3, 4]], 68, 4));
const ZAB_STALL_KICK = pxPath([
  [352, 143, 14, 3],
  [438, 144, 10, 2],
  [508, 143, 12, 3],
]);

/** Mullions, head rail, and the manifestation dots so nobody walks into it. */
const ZAB_MULLIONS = pxPath([
  [302, SHOP_HEAD, 4, GROUND - SHOP_HEAD],
  [420, SHOP_HEAD, 4, GROUND - SHOP_HEAD],
  [482, SHOP_HEAD, 4, GROUND - SHOP_HEAD],
  [574, SHOP_HEAD, 4, GROUND - SHOP_HEAD],
]);
const ZAB_MULLION_HI = pxPath([
  [302, SHOP_HEAD, 2, GROUND - SHOP_HEAD],
  [420, SHOP_HEAD, 2, GROUND - SHOP_HEAD],
  [482, SHOP_HEAD, 2, GROUND - SHOP_HEAD],
  [574, SHOP_HEAD, 2, GROUND - SHOP_HEAD],
]);
const ZAB_HEADRAIL = pxPath([[302, SHOP_HEAD, 276, 3]]);
const ZAB_DOTS = pxPath([...bank([[312, 112, 2, 2]], 9, 12), ...bank([[492, 112, 2, 2]], 6, 12)]);
const ZAB_SKYREFLECT = pxPath([
  [ZAB_PANE_L.x, ZAB_GLASS_TOP, ZAB_PANE_L.w, 4],
  [ZAB_PANE_R.x, ZAB_GLASS_TOP, ZAB_PANE_R.w, 4],
  [435, ZAB_GLASS_TOP, 42, 4],
]);
const ZAB_PANE_FILL = pxPath([
  [ZAB_PANE_L.x, ZAB_GLASS_TOP, ZAB_PANE_L.w, ZAB_GLASS_BOT - ZAB_GLASS_TOP],
  [ZAB_PANE_R.x, ZAB_GLASS_TOP, ZAB_PANE_R.w, ZAB_GLASS_BOT - ZAB_GLASS_TOP],
  [435, ZAB_GLASS_TOP, 42, ZAB_GLASS_BOT - ZAB_GLASS_TOP],
]);
/** The crack somebody taped in February and nobody has glazed since. */
const ZAB_CRACK = pxPath([
  [398, 96, 1, 18],
  [399, 106, 5, 1],
  [403, 106, 1, 9],
]);
const ZAB_TAPE = pxPath([[394, 102, 12, 3]]);

/** Fascia furniture: spikes, bolts, droppings, and the cowl cut through it. */
const ZAB_SPIKES = pxPath(bank([[302, FASCIA_TOP - 3, 1, 3]], 46, 6));
const ZAB_BOLTS = pxPath(bank([[308, FASCIA_BOT - 3, 2, 2]], 12, 24));
const ZAB_DROPPINGS = pxPath([
  [336, FASCIA_TOP, 2, 9],
  [404, FASCIA_TOP, 1, 6],
  [468, FASCIA_TOP, 2, 12],
  [530, FASCIA_TOP, 1, 5],
]);
const ZAB_COWL = bevelPaths([[558, 48, 18, 18]]);
const ZAB_COWL_FINS = pxPath(repeat(4, 4, [561, 52, 12, 2] as Rect, "y"));
/** The greasy shadow the cowl has printed on the fascia above itself. */
const ZAB_GREASE = pxPath([[556, FASCIA_TOP, 22, 3]]);
/** The blade sign, projecting out over the pavement on its bracket. */
const ZAB_BLADE = bevelPaths([[286, 28, 15, 26]]);
const ZAB_BLADE_ARM = pxPath([
  [300, 36, 6, 3],
  [286, 26, 15, 2],
]);

/* --- interior: ceiling, gondolas, cold wall, counter, gantry --- */
const ZAB_BATTENS = pxPath([
  [312, 80, 102, 3],
  [492, 80, 76, 3],
]);
/** Promo danglers on nylon, which sway for a while after the door swings. */
const ZAB_DANGLERS = pxPath([
  [322, 84, 1, 4],
  [318, 88, 9, 7],
  [354, 84, 1, 6],
  [350, 90, 9, 7],
  [386, 84, 1, 3],
  [382, 87, 9, 7],
]);
const ZAB_DANGLER_TOPS = pxPath([
  [318, 88, 9, 2],
  [350, 90, 9, 2],
  [382, 87, 9, 2],
]);
/** Three gondolas seen end-on, their shelf edges, and the white price rails. */
const ZAB_GONDOLAS = {
  body: pxPath([
    [316, 96, 22, 46],
    [344, 100, 18, 42],
    [368, 104, 14, 38],
  ]),
  shelves: pxPath([
    ...repeat(4, 10, [316, 106, 22, 2] as Rect, "y"),
    ...repeat(3, 11, [344, 112, 18, 2] as Rect, "y"),
    ...repeat(3, 10, [368, 116, 14, 2] as Rect, "y"),
  ]),
  rails: pxPath([
    ...repeat(4, 10, [316, 108, 22, 1] as Rect, "y"),
    ...repeat(3, 11, [344, 114, 18, 1] as Rect, "y"),
  ]),
};
/**
 * What is on the shelves, as colour bands — nobody reads a label at 2.6 cm/px.
 * Indexed by the interior scene's `shelves` stage, so a picked shop has gaps in
 * the same places from both sides of the glass.
 */
const ZAB_STOCK: Record<ShopFront["shelves"], Record<string, string>> = {
  full: {
    crisp: pxPath([
      [318, 98, 18, 7],
      [346, 102, 14, 8],
    ]),
    dairy: pxPath([
      [318, 108, 18, 7],
      [370, 128, 10, 6],
    ]),
    drink: pxPath([
      [318, 118, 18, 7],
      [370, 106, 10, 8],
    ]),
    sweet: pxPath([
      [318, 128, 18, 7],
      [346, 126, 14, 6],
    ]),
  },
  picked: {
    crisp: pxPath([[318, 98, 11, 7]]),
    dairy: pxPath([
      [318, 108, 18, 7],
      [370, 128, 10, 6],
    ]),
    drink: pxPath([
      [325, 118, 11, 7],
      [370, 106, 10, 8],
    ]),
    sweet: pxPath([[318, 128, 8, 7]]),
  },
  bare: {
    crisp: pxPath([[318, 98, 5, 7]]),
    dairy: pxPath([[329, 108, 7, 7]]),
    drink: pxPath([[370, 106, 5, 8]]),
    sweet: pxPath([]),
  },
};
/** The press rack against the near mullion, four shelves of it. */
const ZAB_PRESS = {
  frame: pxPath([[306, 98, 8, 32]]),
  shelves: pxPath(repeat(4, 8, [306, 104, 8, 1] as Rect, "y")),
  papers: pxPath([
    [307, 99, 6, 5],
    [307, 107, 6, 5],
    [307, 115, 6, 5],
    [307, 123, 6, 5],
  ]),
};
/** The wire dump bin of whatever is 2+1 this fortnight. */
const ZAB_DUMPBIN = {
  mesh: pxPath(repeat(3, 5, [386, 128, 15, 1] as Rect, "y")),
  rim: pxPath([
    [386, 124, 15, 1],
    [386, 141, 15, 1],
  ]),
  stock: pxPath([
    [388, 120, 5, 6],
    [394, 118, 5, 8],
    [390, 126, 9, 5],
  ]),
};
/** The stack of baskets by the door, which is never where it should be. */
const ZAB_BASKETS = pxPath([
  [402, 130, 15, 4],
  [403, 134, 13, 4],
  [402, 138, 15, 4],
]);
const ZAB_BASKET_RIMS = pxPath([
  [402, 130, 15, 1],
  [402, 138, 15, 1],
]);
/** The convex security mirror in the corner, angled at the till. */
const ZAB_MIRROR = bevelPaths([[402, 80, 15, 12]]);
/** The cold wall: three doors, their mullions, shelf lines, bottle silhouettes. */
const ZAB_COLD = {
  box: pxPath([[488, 88, 20, 54]]),
  mullions: pxPath([
    [494, 88, 2, 54],
    [501, 88, 2, 54],
  ]),
  shelves: pxPath(repeat(4, 13, [488, 98, 20, 2] as Rect, "y")),
  rowA: pxPath(bank([[489, 92, 2, 6]], 6, 3)),
  rowB: pxPath(bank([[489, 105, 2, 6]], 6, 3)),
  rowC: pxPath(bank([[489, 118, 2, 6]], 6, 3)),
  rowD: pxPath(bank([[489, 131, 2, 6]], 6, 3)),
};
/** The counter run, and the gantry over it with the doors shut. */
const ZAB_COUNTER = bevelPaths([[508, 120, 64, 22]]);
const ZAB_GANTRY = bevelPaths([[508, 80, 64, 18]]);
const ZAB_GANTRY_DOORS = pxPath([
  [510, 82, 30, 14],
  [541, 82, 29, 14],
]);
const ZAB_GANTRY_HANDLES = pxPath([
  [538, 84, 2, 10],
  [568, 84, 2, 10],
]);
const ZAB_COFFEE = bevelPaths([[512, 100, 12, 20]]);
const ZAB_ROLLER = bevelPaths([[528, 106, 18, 14]]);
const ZAB_ROLLER_BARS = pxPath(bank([[530, 114, 14, 1]], 3, 3));
/** The grill takes four, and which four are on it comes from world.zabka. */
const ZAB_SAUSAGES: readonly Rect[] = [
  [530, 108, 14, 2],
  [530, 111, 14, 2],
  [530, 114, 14, 2],
  [530, 117, 14, 2],
];
const ZAB_TILL = bevelPaths([[548, 110, 10, 10]]);

/** Door furniture: closer arm, kick plate, chime sensor, decals. */
const ZAB_DOOR_CLOSER = pxPath([
  [438, 80, 26, 3],
  [462, 81, 8, 2],
]);
const ZAB_DOOR_KICK = pxPath([[433, 132, 46, 10]]);
const ZAB_CHIME = pxPath([[450, 72, 8, 3]]);
/** The row of payment decals every Polish shop door carries. */
const ZAB_DECALS = pxPath([
  [438, 120, 7, 5],
  [447, 120, 7, 5],
  [456, 120, 7, 5],
  [465, 120, 7, 5],
]);

/* -------------------------------------------------------------------- *
 * components
 * -------------------------------------------------------------------- */

/** ŻABKA at 2× on the grid. 1.5× put every odd stroke on a half pixel. */
function ZabkaFascia({ dim: dimmed }: { dim: boolean }) {
  const ink = dimmed ? "#8fae9c" : K.white;
  return (
    <g>
      <BigText x={350} y={51} text="ŻABKA" fill={ink} k={2} gap={2} />
      {/* the rule under the wordmark, and the hours panel beside it */}
      <path d={pxPath([[350, 64, 46, 1]])} fill={ink} opacity={0.6} />
      <PixelText x={470} y={62} text="CZYNNE 6-23" fill={ink} gap={1} op={dimmed ? 0.5 : 0.8} />
    </g>
  );
}

function Zabka({ ph, s, shop }: { ph: Ph; s: StreetState; shop: ShopFront }) {
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const open = s.zabka !== "closed";
  const busy = s.zabka === "busy";
  const snow = isSnow(s);
  const wet = isWet(s);
  /**
   * Shop glass reads dark in daylight and cold-bright after dark. Cold, not
   * warm: the interior is 4000K, and this is the only cold light on the street.
   */
  const glass = open ? (dark ? "#cfe4ee" : K.glass.night) : "#1b2a22";
  return (
    <g>
      {/* ---- the blade sign, which is how you see it from the tram stop ----- */}
      <path d={ZAB_BLADE_ARM} fill={STEEL[ph].lo} />
      <Bev set={ZAB_BLADE} mat={ZAB_M[ph]} />
      <path d={pxPath([[289, 32, 9, 9]])} fill={K.white} />
      <path d={pxPath([[291, 34, 5, 5]])} fill={ZAB_M[ph].base} />
      <path
        d={pxPath([
          [288, 44, 11, 1],
          [288, 48, 11, 1],
        ])}
        fill={K.white}
        opacity={0.7}
      />
      {snow ? <path d={pxPath([[286, 27, 15, 2]])} fill={K.snow} /> : null}

      {/* ---- the fascia ---------------------------------------------------- */}
      <Bev set={ZAB_FASCIA} mat={ZAB_M[ph]} />
      {/* the mosaic frog, the only part of the branding that is a shape */}
      <path d={ZAB_MARK} fill={K.white} />
      <path d={pxPath([[314, 54, 9, 9]])} fill={ZAB_M[ph].base} />
      <path d={pxPath([[316, 56, 5, 5]])} fill={K.white} />
      <ZabkaFascia dim={night} />
      <path d={ZAB_BOLTS} fill={ZAB_M[ph].deep} opacity={0.7} />
      {/* the extract cowl, cut through a sign that was never meant to have one */}
      <path d={ZAB_GREASE} fill="#0a3b26" opacity={0.5} />
      <Bev set={ZAB_COWL} mat={STEEL[ph]} />
      <path d={ZAB_COWL_FINS} fill={STEEL[ph].deep} />
      {/* bird spikes, and the droppings that prove they went on late */}
      <path d={ZAB_SPIKES} fill={ZK.spike} opacity={0.8} />
      <path d={ZAB_DROPPINGS} fill={ZK.dropping} opacity={0.4} />
      {/* the backlight; after dark the tube at the far end is the one that goes */}
      {!night ? (
        <rect
          x={ZAB.x0}
          y={FASCIA_TOP}
          width={ZAB.x1 - ZAB.x0}
          height={FASCIA_BOT - FASCIA_TOP}
          fill={ZK.led}
          opacity={0.06}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.06;0.06;0.02;0.07;0.06"
            dur="13s"
            repeatCount="indefinite"
          />
        </rect>
      ) : (
        <rect
          x={490}
          y={FASCIA_TOP}
          width={90}
          height={FASCIA_BOT - FASCIA_TOP}
          fill="#000000"
          opacity={0.18}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.18;0.18;0.34;0.18;0.26;0.18"
            dur="9s"
            repeatCount="indefinite"
          />
        </rect>
      )}
      {/* a pigeon on the fascia anyway, because the spikes are 40 mm apart */}
      {!night ? (
        <g>
          <path
            d={pxPath([
              [430, FASCIA_TOP - 8, 11, 6],
              [440, FASCIA_TOP - 11, 5, 4],
            ])}
            fill={K.pigeon}
          />
          <path d={pxPath([[430, FASCIA_TOP - 8, 11, 2]])} fill={K.pigeonHi} />
          <path d={pxPath([[444, FASCIA_TOP - 10, 2, 1]])} fill="#c9a24b" />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;4 0;4 0;-3 0;0 0"
            dur="6.8s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* the awning, its drip edge, the CCTV dome under it, and the chime */}
      <path d={ZAB_AWNING} fill={ZAB_M[ph].hi} />
      <path d={pxPath([[ZAB.x0, FASCIA_BOT + 3, ZAB.x1 - ZAB.x0, 2]])} fill={ZAB_M[ph].deep} />
      {snow ? (
        <path d={pxPath([[ZAB.x0, FASCIA_BOT - 1, ZAB.x1 - ZAB.x0, 2]])} fill={K.snow} />
      ) : null}
      <path d={pxPath([[306, 72, 7, 4]])} fill={STEEL[ph].deep} />
      <path d={pxPath([[308, 73, 3, 2]])} fill="#1b2026" />
      <path d={ZAB_CHIME} fill={STEEL[ph].lo} />

      {/* ---- the glass, and the shop behind it ----------------------------- */}
      <path d={ZAB_GLASSWALL} fill={ZAB_M[ph].deep} />
      <path d={ZAB_PANE_FILL} fill={glass} />
      {open ? <ZabkaInterior ph={ph} s={s} shop={shop} busy={busy} dark={dark} /> : null}
      {/* the sky in the top of every pane, which is what makes it read as glass */}
      {!dark ? <path d={ZAB_SKYREFLECT} fill="#bcd2e0" opacity={0.5} /> : null}
      <path d={ZAB_MULLIONS} fill={ZAB_M[ph].base} />
      <path d={ZAB_MULLION_HI} fill={ZAB_M[ph].hi} />
      <path d={ZAB_HEADRAIL} fill={open && dark ? "#dfeef6" : FRAME[ph].deep} />
      <path d={ZAB_DOTS} fill={K.white} opacity={0.3} />
      <path d={ZAB_CRACK} fill="#dfe8ea" opacity={0.7} />
      <path d={ZAB_TAPE} fill="#d8d3b8" opacity={0.8} />

      {/* ---- the poster layer, taped on from the inside -------------------- */}
      <path d={pxPath([[310, 84, 26, 18]])} fill={K.gas} />
      <path d={pxPath([[310, 84, 26, 4]])} fill={K.gasLo} />
      <PixelText x={314} y={90} text="2+1" fill="#7a3a1a" gap={1} />
      <PixelText x={313} y={97} text="GRATIS" fill="#7a6a2a" gap={0} op={0.9} />
      <path d={pxPath([[342, 84, 26, 18]])} fill={K.bagRed} />
      <PixelText x={345} y={88} text="9,99" fill={K.white} gap={1} />
      <path d={pxPath([[345, 96, 18, 3]])} fill={K.white} opacity={0.8} />
      {/* the 18+ decal, which is the law, and the CCTV notice under it */}
      <path d={pxPath([[404, 84, 12, 12]])} fill="#1b2026" />
      <PixelText x={406} y={87} text="18" fill={K.white} gap={0} />
      <path d={pxPath([[404, 100, 12, 9]])} fill="#2b3138" />
      <path d={pxPath([[407, 103, 5, 3]])} fill={K.ledRed} opacity={0.7} />

      {/* ---- the door ------------------------------------------------------ */}
      {px(ZAB.doorX, SHOP_HEAD, ZAB.doorW, GROUND - SHOP_HEAD, ZAB_M[ph].base)}
      {px(ZAB.doorX, SHOP_HEAD, 2, GROUND - SHOP_HEAD, ZAB_M[ph].hi)}
      {px(ZAB.doorX + ZAB.doorW - 2, SHOP_HEAD, 2, GROUND - SHOP_HEAD, ZAB_M[ph].deep)}
      <path d={ZAB_DOOR_CLOSER} fill={STEEL[ph].lo} />
      <path d={ZAB_DOOR_KICK} fill={STEEL[ph].mid} />
      <path d={pxPath([[433, 132, 46, 1]])} fill={STEEL[ph].hi} />
      <path d={pxPath([[438, 84, 20, 13]])} fill={K.white} />
      <PixelText x={440} y={86} text="6-23" fill={ZAB_M[ph].base} />
      <path d={pxPath([[440, 93, 16, 1]])} fill={ZAB_M[ph].base} />
      <PixelText
        x={440}
        y={110}
        text={open ? "PCHAĆ" : "ZAMKNIĘTE"}
        fill={open ? K.white : "#8fae9c"}
        gap={open ? 1 : 0}
        op={0.85}
      />
      <path d={ZAB_DECALS} fill={ZK.drink} opacity={0.75} />
      <path
        d={pxPath([
          [438, 120, 7, 1],
          [456, 120, 7, 1],
        ])}
        fill={K.gas}
        opacity={0.8}
      />
      {/* the handle, and the smear at exactly the height everybody grabs it */}
      {px(470, 108, 3, 12, STEEL[ph].base)}
      {px(470, 108, 3, 2, STEEL[ph].hi)}
      <path d={pxPath([[462, 110, 7, 8]])} fill="#ffffff" opacity={0.07} />

      {/* ---- the stallriser, which takes every trolley in the district ----- */}
      <Bev
        set={ZAB_STALL}
        mat={{ hi: ZK.tileHi, base: ZK.tile, mid: ZK.tile, lo: ZK.tileLo, deep: ZK.tileLo }}
      />
      <path d={ZAB_STALL_TILE} fill={ZK.tileHi} opacity={0.35} />
      <path d={ZAB_STALL_KICK} fill={ZK.tileLo} opacity={0.8} />
      {wet ? (
        <path d={pxPath([[302, ZAB_GLASS_BOT, 276, 3]])} fill={K.waterHi} opacity={0.2} />
      ) : null}
      {snow ? <path d={pxPath([[302, ZAB_GLASS_BOT - 1, 276, 2]])} fill={K.snow} /> : null}

      {/* ---- shut: grille, padlock, shutter box, and the light left on ----- */}
      {!open ? (
        <g>
          {/* the night light inside, glowing through the slats — this is what
              makes a shut shop read as shut rather than as simply absent */}
          <path
            d={pxPath([
              [ZAB_PANE_L.x, 90, ZAB_PANE_L.w, 50],
              [ZAB_PANE_R.x, 90, ZAB_PANE_R.w, 50],
            ])}
            fill="#2a4a3a"
          />
          <path d={pxPath([[490, 96, 20, 44]])} fill={ZK.chillDeep} opacity={0.5} />
          <path d={ZAB_GRILLE.box} fill={GRILLE[ph].deep} />
          <path d={ZAB_GRILLE.slats} fill={GRILLE[ph].base} />
          <path d={ZAB_GRILLE.rails} fill={GRILLE[ph].lo} />
          {/* the shutter box, tucked up behind the awning */}
          <path d={pxPath([[302, 71, 276, 5]])} fill={GRILLE[ph].mid} />
          <path d={pxPath([[302, 71, 276, 1]])} fill={GRILLE[ph].hi} />
          {/* the padlock and hasp at the bottom rail */}
          <path d={pxPath([[430, 140, 8, 7]])} fill="#2e3033" />
          <path d={pxPath([[432, 136, 4, 5]])} fill={STEEL[ph].base} />
          <path d={pxPath([[433, 142, 2, 2]])} fill={M.brass.base} />
        </g>
      ) : null}

      {/* ---- the delivery, when the interior scene says there is one ------- */}
      {shop.delivery || ph === "dawn" ? (
        <g>
          <Bevel
            boxes={[
              [492, 128, 22, 10],
              [492, 138, 22, 10],
              [516, 134, 20, 8],
            ]}
            mat={{ ...STEEL[ph], base: ZK.crate, hi: ZK.crateHi }}
          />
          <path d={pxPath([[494, 130, 18, 6]])} fill="#d8e4ec" />
          {/* the bread cage, which always turns up before anybody is there */}
          <path d={pxPath([[540, 120, 26, 26]])} fill={STEEL[ph].lo} />
          <path d={pxPath(repeat(4, 7, [540, 124, 26, 1] as Rect, "y"))} fill={STEEL[ph].base} />
          <path
            d={pxPath([
              [543, 126, 8, 5],
              [553, 126, 9, 5],
              [543, 133, 9, 5],
            ])}
            fill={ZK.cardboard}
          />
        </g>
      ) : null}
    </g>
  );
}

/**
 * What is behind the glass. Every stage here comes from the same `world.zabka`
 * the interior scene reads, so the shop you see is the shop you walk into.
 */
function ZabkaInterior({
  ph,
  s,
  shop,
  busy,
  dark,
}: {
  ph: Ph;
  s: StreetState;
  shop: ShopFront;
  busy: boolean;
  dark: boolean;
}) {
  const wall = dark ? "#5d6a70" : "#39434c";
  const stock = ZAB_STOCK[shop.shelves];
  /** The grill holds four. Which of the four are on it is world state. */
  const onGrill = ZAB_SAUSAGES.slice(0, shop.hotdogs);
  return (
    <g>
      {/* the back wall of the shop, and the battens that let you see any of it */}
      <path d={ZAB_PANE_FILL} fill={wall} opacity={0.9} />
      <path d={ZAB_BATTENS} fill={dark ? ZK.led : "#c9d2d8"} />
      <path d={ZAB_BATTENS} fill={dth("c", "25")} opacity={dark ? 0.5 : 0.2} />
      {/* the danglers, still swaying from the last person through the door */}
      <g>
        <path d={ZAB_DANGLERS} fill={ZK.sweet} />
        <path d={ZAB_DANGLER_TOPS} fill={K.gas} />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 352 84;0.9 352 84;-0.7 352 84;0.3 352 84;0 352 84"
          dur="11s"
          repeatCount="indefinite"
        />
      </g>
      {/* the press rack against the near mullion */}
      <path d={ZAB_PRESS.frame} fill={STEEL[ph].lo} />
      <path d={ZAB_PRESS.papers} fill="#d8d3c5" />
      <path d={ZAB_PRESS.shelves} fill={STEEL[ph].deep} />
      {/* three gondolas end-on. The gaps are the interior scene's gaps. */}
      <path d={ZAB_GONDOLAS.body} fill={ZK.shelf} />
      <path d={stock.crisp} fill={ZK.crisp} />
      <path d={stock.dairy} fill={ZK.dairy} />
      <path d={stock.drink} fill={ZK.drink} />
      <path d={stock.sweet} fill={ZK.sweet} />
      <path d={ZAB_GONDOLAS.shelves} fill={ZK.shelfHi} />
      <path d={ZAB_GONDOLAS.rails} fill={K.white} opacity={0.75} />
      {/* the electronic shelf label on the end of the first gondola */}
      <path d={pxPath([[320, 98, 13, 6]])} fill={ZK.screen} />
      <PixelText x={322} y={99} text="4,99" fill={K.ledAmber} gap={0} op={0.85} />
      {/* the dump bin of whatever is 2+1 this fortnight */}
      <path d={ZAB_DUMPBIN.stock} fill={ZK.sweet} />
      <path d={ZAB_DUMPBIN.mesh} fill={STEEL[ph].base} opacity={0.8} />
      <path d={ZAB_DUMPBIN.rim} fill={STEEL[ph].base} />
      {/* the basket stack, never where it should be */}
      <path d={ZAB_BASKETS} fill={ZK.drink} />
      <path d={ZAB_BASKET_RIMS} fill="#6fc8ea" />
      {/* the convex mirror in the corner, angled at the till */}
      <Bev set={ZAB_MIRROR} mat={STEEL[ph]} />
      <path d={pxPath([[404, 82, 11, 8]])} fill={ZK.mirror} />
      <path d={pxPath([[405, 83, 6, 3]])} fill="#c9d8e0" opacity={0.7} />

      {/* ---- the counter zone, through the right pane --------------------- */}
      {/* the cold wall: three doors, and the cans you can just make out */}
      <path d={ZAB_COLD.box} fill={ZK.chill} />
      <path d={ZAB_COLD.rowA} fill={ZK.energy} opacity={0.85} />
      <path d={ZAB_COLD.rowB} fill={ZK.drink} opacity={0.85} />
      <path d={ZAB_COLD.rowC} fill={ZK.beer} opacity={0.85} />
      <path d={ZAB_COLD.rowD} fill={ZK.dairy} opacity={0.85} />
      <path d={ZAB_COLD.shelves} fill="#f2fbff" />
      <path d={ZAB_COLD.mullions} fill={STEEL[ph].lo} />
      <path d={pxPath([[488, 88, 20, 2]])} fill="#f8ffff" />
      {/* the compressor light, which cycles on its own schedule */}
      <path d={pxPath([[506, 138, 2, 2]])} fill={ZK.screenText}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;1;0.2;0.2"
          dur="17s"
          repeatCount="indefinite"
        />
      </path>
      {/* the cigarette gantry, doors shut, because the law says they have to be */}
      <Bev set={ZAB_GANTRY} mat={{ ...STEEL[ph], base: ZK.gantry, hi: "#4d5560" }} />
      <path d={ZAB_GANTRY_DOORS} fill="#2b3138" />
      <path d={ZAB_GANTRY_HANDLES} fill={STEEL[ph].lo} />
      <PixelText x={512} y={90} text="18" fill="#5d656e" gap={0} op={0.8} />
      {/* the coffee machine, and what it is doing right now */}
      <Bev set={ZAB_COFFEE} mat={{ ...STEEL[ph], base: "#3a4148", hi: "#4d5560" }} />
      <path d={pxPath([[514, 102, 8, 4]])} fill={ZK.coffee} />
      <path d={pxPath([[516, 112, 4, 6]])} fill={K.cream} />
      {shop.coffee !== "idle" ? <path d={pxPath([[516, 112, 4, 2]])} fill={ZK.crema} /> : null}
      {shop.coffee === "pouring" ? (
        <path d={pxPath([[517, 107, 2, 5]])} fill={ZK.coffee}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.6;1"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      <path
        d={pxPath([[515, 108, 6, 2]])}
        fill={shop.coffee === "grinding" ? K.ledRed : ZK.screenText}
        opacity={0.7}
      />
      {/* the roller grill, and the sausages that are actually on it */}
      <Bev set={ZAB_ROLLER} mat={{ ...STEEL[ph], base: ZK.roller, hi: "#c8ccd2" }} />
      <path d={pxPath([[529, 108, 16, 10]])} fill="#2b2118" />
      <path d={ZAB_ROLLER_BARS} fill={STEEL[ph].hi} opacity={0.6} />
      {onGrill.length > 0 ? (
        <g>
          <path d={pxPath(onGrill)} fill={ZK.sausage} />
          <path d={pxPath(onGrill.map(([x, y, w]) => [x, y, w, 1] as Rect))} fill={ZK.sausageHi} />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;1 0;2 0;0 0"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      <path d={pxPath([[528, 104, 18, 2]])} fill={ZK.grillWarm} opacity={0.55}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.55;0.42;0.55;0.48"
          dur="4.7s"
          repeatCount="indefinite"
        />
      </path>
      {/* the till, its screen, and the scratch cards under the counter glass */}
      <Bev set={ZAB_TILL} mat={{ ...STEEL[ph], base: "#4d5560", hi: "#5f6a75" }} />
      <path d={pxPath([[550, 112, 6, 4]])} fill={dark ? "#c9d8e0" : "#8a9298"} />
      <path d={pxPath([[560, 114, 10, 6]])} fill={ZK.screen} />
      <path
        d={pxPath([
          [561, 115, 2, 4],
          [564, 115, 2, 4],
          [567, 115, 2, 4],
        ])}
        fill={ZK.crisp}
        opacity={0.8}
      />
      {/* Pani z Żabki. At the counter, restocking an aisle, or out the back. */}
      {shop.clerk !== "away" ? (
        <g
          style={{
            transition: STEP_SLIDE,
            transform: shop.clerk === "restocking" ? "translate(-186px, 8px)" : "none",
          }}
        >
          <path d={pxPath([[560, 98, 12, 5]])} fill="#8a4a3a" />
          <path d={pxPath([[561, 102, 11, 8]])} fill={K.skin} />
          <path d={pxPath([[561, 107, 11, 3]])} fill={K.skinShade} />
          <path
            d={pxPath([
              [563, 104, 2, 2],
              [568, 104, 2, 2],
            ])}
            fill="#3d2a1a"
          />
          <path d={pxPath([[560, 110, 12, 12]])} fill={ZK.apron} />
          <path d={pxPath([[560, 110, 12, 2]])} fill={ZK.apronHi} />
          {/* the arm that scans, and it goes faster when there is a queue */}
          <g>
            <path d={pxPath([[556, 112, 5, 8]])} fill={ZK.apron} />
            <path d={pxPath([[555, 118, 5, 4]])} fill={K.skin} />
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 559 113;-15 559 113;5 559 113;0 559 113"
              dur={busy ? "2.6s" : "6.4s"}
              repeatCount="indefinite"
            />
          </g>
        </g>
      ) : null}
      {/* the counter, drawn last on this side so it crops her at the waist */}
      <Bev set={ZAB_COUNTER} mat={OAK[ph]} />
      <path d={pxPath([[508, 120, 64, 2]])} fill={OAK[ph].hi} />
      <path d={pxPath([[512, 126, 56, 1]])} fill={OAK[ph].lo} />

      {/* ---- the people on the floor -------------------------------------- */}
      {/* the customer: browsing does a lap, paying stands at the till */}
      {shop.customer === "browsing" ? (
        <g opacity={0.9}>
          <path
            d={pxPath([
              [356, 110, 8, 32],
              [357, 104, 6, 7],
            ])}
            fill="#2b3138"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;28 0;28 0;-14 0;-14 0;0 0"
            keyTimes="0;0.12;0.3;0.55;0.72;0.9;1"
            dur="38s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {shop.customer === "paying" ? (
        <g opacity={0.9}>
          <path
            d={pxPath([
              [540, 110, 9, 32],
              [541, 103, 7, 8],
            ])}
            fill="#2b3138"
          />
          <path d={pxPath([[549, 122, 6, 5]])} fill={ZK.drink} />
        </g>
      ) : null}
      {/* and the queue behind them, which on this street is permanent at 17:40 */}
      {busy ? (
        <g>
          <path
            d={pxPath([
              [512, 108, 9, 34],
              [513, 101, 7, 8],
            ])}
            fill="#33404a"
          />
          <path
            d={pxPath([
              [524, 112, 9, 30],
              [525, 105, 7, 8],
            ])}
            fill="#2b3138"
          />
          <path d={pxPath([[533, 124, 6, 5]])} fill={ZK.drink} />
        </g>
      ) : null}
      {/* one more body deep in the shop when the street itself is busy */}
      {s.crowd >= 3 ? (
        <path
          d={pxPath([
            [440, 106, 8, 32],
            [441, 99, 7, 8],
          ])}
          fill="#2f3a44"
          opacity={0.7}
        />
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * TWO CHANGES OUTSIDE THIS BLOCK
 *
 * 1. In StreetScene's middleBackground, pass the shop state in:
 *
 *        <Zabka ph={ph} s={s} shop={shopFront(world)} />
 *
 * 2. In STREET_SCENE.artKey, join the six new reads. Without this the window
 *    keeps showing the shop as it was when the frame was memoised, while the
 *    room behind the door has moved on — which is the exact bug the artKey
 *    comment in that file warns about:
 *
 *        artKey: (w, ph) => {
 *          const p = toPhase(ph);
 *          const s = state(w, p);
 *          const f = shopFront(w);
 *          return [
 *            ph, s.zabka, s.paczkomat, s.bins, s.binOpen ? 1 : 0, s.kosz,
 *            s.bus, s.cat, s.catFed ? 1 : 0, s.babcia, s.smoker,
 *            s.heniek ? 1 : 0, s.klatka, s.trzepak, s.bankomat, s.bikes,
 *            s.crowd, s.lamps, s.weather, s.season,
 *            f.hotdogs, f.coffee, f.shelves, f.clerk, f.customer,
 *            f.delivery ? 1 : 0,
 *          ].join("|");
 *        },
 *
 * OPTIONAL. Pani z Żabki is now visible from the pavement, so she can be talked
 * to from out here. The interior scene already has her lines under CLERK_LINES
 * and calls her "Pani z Żabki"; if you want her on the street, add a hitbox
 *
 *        { id: "zabka-clerk", kind: "npc", priority: 2, x: 566, range: 10 },
 *
 * which sits in the gap between zabka-door (434–478) and waiting-man (484–508),
 * and a Monologue (kind ambient) at x=566, headY=98 in StreetEffects gated on
 * `shop.clerk === "counter"`.
 * ==================================================================== */

/** Block 16 and its machines. Colder than fourteen in every respect. */
const B6K = {
  door: "#c9ccc4", // PVC, not the aluminium fourteen got
  doorLo: "#adb0a8",
  doorHi: "#dfe2da",
  bars: "#4a4e52", // kraty
  parterLit: "#c9863f",
  curtain: "#e8e2d2",
  flowerA: "#c9463c",
  flowerB: "#e8a445",
  cellar: "#1b2026",
  cellarBar: "#5d6066",
  loggia: "#8fa8b8",
  loggiaFrame: "#a8aeb2",
  antiPoster: "#7a8084",
  tag: "#2b5aa8",
  tagAlt: "#c94040",
  plaqueEu: "#1e4478",
  ratGuard: "#6d7278",
  flagBracket: "#8a8f96",
  planter: "#8d8478",
  planterHi: "#9a9184",
  shrub: "#3d573d",
  shrubHi: "#4a6b4a",
  soil: "#4a3a2b",
  /** the two banks: the current one is blue, the older one is green */
  bankA: "#1e5aa8",
  bankAHi: "#2f74c9",
  bankB: "#1e7a4a",
  bankBHi: "#2a9a5e",
  atmBody: "#3a4148",
  atmBodyHi: "#4d5560",
  atmDark: "#2b3138",
  screenOn: "#16283f",
  screenOff: "#1b2026",
  hood: "#22262c",
  bezel: "#3ddc84",
  mirror: "#aebfc9",
  notice: "#f2f2ee",
  worn: "#a8a59d",
} as const;

/* --- the block's own wear, up where nobody has ever drawn it --- */
/** The loggia somebody glazed in a profile that does not match anybody else's. */
const B16_LOGGIA = pxPath([[1000, 0, 40, 34]]);
const B16_LOGGIA_FRAME = pxPath([
  [1000, 0, 40, 2],
  [1000, 32, 40, 2],
  [1000, 0, 2, 34],
  [1018, 0, 2, 34],
  [1038, 0, 2, 34],
]);
/** The grey overpaint on the gas pipe, flaked back to the yellow underneath. */
const B16_GAS_FLAKE = pxPath([
  [948, 125, 9, 3],
  [1012, 124, 6, 2],
  [1168, 125, 11, 3],
]);
/** Basement windows along the plinth. Every blok has them; no scene draws them. */
const B16_CELLARS = pxPath([
  [906, 140, 20, 8],
  [962, 140, 20, 8],
  [1196, 140, 20, 8],
]);
const B16_CELLAR_BARS = pxPath([
  ...bank([[909, 140, 1, 8]], 4, 5),
  ...bank([[965, 140, 1, 8]], 4, 5),
  ...bank([[1199, 140, 1, 8]], 4, 5),
]);
/** Anti-poster paint on the plinth, and the tags that went on it anyway. */
const B16_ANTIPOSTER = pxPath([[Z.passage, 140, 358, 5]]);
const B16_TAGS = pxPath([
  [1002, 142, 3, 6],
  [1005, 142, 7, 2],
  [1010, 144, 3, 4],
  [1120, 143, 3, 5],
  [1123, 143, 6, 2],
]);
/** The drainpipe at the far end, and the rat guard round the foot of it. */
const B16_PIPE = pxPath([[1240, 0, 7, GROUND - 8]]);
const B16_PIPE_HI = pxPath([[1240, 0, 2, GROUND - 8]]);
const B16_PIPE_GUARD = pxPath([[1237, GROUND - 12, 13, 4]]);
/** The thermomodernisation plaque, which nobody has read since 2011. */
const B16_EU_PLAQUE = bevelPaths([[1228, 96, 18, 14]]);

/* --- the parter flats: one barred, one lived in --- */
const B16_BARS = pxPath([...bank([[925, 87, 2, 36]], 5, 6), [921, 86, 32, 2], [921, 122, 32, 2]]);
const B16_FLOWERBOX = pxPath([[1160, 122, 34, 5]]);
const B16_FLOWERS = pxPath([
  [1163, 117, 5, 5],
  [1171, 116, 5, 6],
  [1180, 118, 5, 4],
  [1187, 117, 4, 5],
]);
/** The SPRZEDAM sign in the right-hand window. It has been there since spring. */
const B16_FORSALE = pxPath([[1163, 92, 28, 9]]);

/* --- the entrance: PVC, flush threshold, cheaper everything --- */
/* NB: no bevelPaths for the leaf and sidelight — a glazed door is rails around a
 * hole. Filled boxes here would paint over the hall, which is the bug the klatka
 * had. See B16_DOOR_RAILS / B16_SIDE_RAILS below. */
const B16_LEAF_GLASS = pxPath([[1058, 80, 22, 56]]);
const B16_SIDE_GLASS = pxPath([[1086, 80, 16, 60]]);
const B16_DOOR_RAILS = pxPath([
  [1056, 74, 26, 6],
  [1056, 136, 26, 10],
  [1056, 74, 2, 72],
  [1080, 74, 2, 72],
]);
const B16_SIDE_RAILS = pxPath([
  [1084, 74, 20, 6],
  [1084, 140, 20, 6],
  [1084, 74, 2, 72],
  [1102, 74, 2, 72],
]);
const B16_HANDLE = pxPath([[1077, 102, 3, 14]]);
const B16_KICK = pxPath([[1058, 136, 22, 8]]);
/** The lamp over the door, on the same photocell as the street lamps. */
const B16_LAMP = pxPath([[1073, 63, 12, 6]]);
const B16_LAMP_BRACKET = pxPath([[1076, 61, 6, 2]]);
/** The cheap domofon: no camera, no reader pad, a speaker and eight buttons. */
const B16_DOMOFON = bevelPaths([[1108, 96, 13, 24]]);
const B16_DOM_GRILLE = pxPath(bank([[1110, 99, 1, 1]], 5, 2));
const B16_DOM_KEYS = pxPath(
  [0, 1, 2, 3].flatMap((r) => [0, 1].map((c) => [1110 + c * 5, 104 + r * 4, 3, 2] as Rect)),
);
/** The flag bracket. Empty, because it is not the eleventh of November. */
const B16_FLAG_BRACKET = pxPath([
  [1044, 70, 7, 3],
  [1044, 70, 2, 7],
]);
/** The mat, and the butts from the people who smoke outside their own door. */
const B16_MAT = pxPath([[1058, 146, 44, 4]]);
const B16_MAT_RIBS = pxPath(bank([[1060, 147, 2, 2]], 10, 4));
const B16_BUTTS = pxPath([
  [1046, GROUND - 2, 2, 1],
  [1052, GROUND - 1, 2, 1],
  [1108, GROUND - 2, 2, 1],
]);

/* --- the donica the hedge-16 hitbox has been pointing at all along --- */
const B16_PLANTER = bevelPaths([[1108, 132, 24, 18]]);
const B16_PLANTER_SOIL = pxPath([[1110, 132, 20, 3]]);
const B16_SHRUB = pxPath([
  [1110, 120, 20, 13],
  [1114, 116, 12, 5],
  [1118, 113, 5, 4],
]);
const B16_SHRUB_HI = pxPath([
  [1110, 120, 20, 2],
  [1114, 116, 12, 2],
]);

/* --- the main cash machine: the current generation, blue bank --- */
const BK_CANOPY = pxPath([[982, 78, 42, 5]]);
const BK_FASCIA = pxPath([[986, 84, 34, 7]]);
const BK_SCREEN = pxPath([[990, 93, 22, 15]]);
/** The little mirror above the screen, for seeing who is behind you. */
const BK_MIRROR = pxPath([[990, 89, 22, 3]]);
/** The rubber hood over the keypad, which is the shape you actually recognise. */
const BK_HOOD = pxPath([[989, 108, 24, 4]]);
const BK_KEYS = pxPath(
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [992 + c * 6, 113 + r * 5, 4, 3] as Rect)),
);
/** Card slot with its anti-skimming bezel, receipt slot, cash mouth. */
const BK_CARD = pxPath([[1013, 93, 5, 11]]);
const BK_CARD_BEZEL = pxPath([[1013, 93, 5, 2]]);
const BK_RECEIPT = pxPath([[1014, 110, 4, 5]]);
const BK_CASH = pxPath([[992, 126, 22, 4]]);
const BK_CASH_LIP = pxPath([[992, 126, 22, 1]]);
const BK_CCTV = pxPath([
  [1016, 85, 5, 4],
  [1017, 86, 3, 2],
]);
/** The fee notice on the wall beside it, in the smallest type ever printed. */
const BK_NOTICE = pxPath([[974, 96, 10, 13]]);
const BK_BIN = bevelPaths([[974, 118, 9, 13]]);
/** The patch of pavement worn pale by everybody standing in the same spot. */
const BK_WORN = pxPath([[986, 150, 34, 7]]);

/* --- the other bank's machine: the older through-the-wall unit --- */
const BK16_RECESS = bevelPaths([[1126, 86, 30, 46]]);
const BK16_BODY = pxPath([[1130, 90, 22, 38]]);
const BK16_SIGN = pxPath([[1126, 80, 30, 7]]);
const BK16_SCREEN = pxPath([[1133, 96, 16, 13]]);
const BK16_HOOD = pxPath([[1132, 109, 18, 3]]);
const BK16_KEYS = pxPath(
  [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [1134 + c * 5, 113 + r * 4, 3, 2] as Rect)),
);
const BK16_CARD = pxPath([[1149, 96, 4, 9]]);
const BK16_CASH = pxPath([[1134, 122, 14, 3]]);
const BK16_WORN = pxPath([[1128, 150, 26, 6]]);

/* -------------------------------------------------------------------- *
 * components
 * -------------------------------------------------------------------- */

/**
 * Somebody at a cash machine. Shoulders hunched over the keypad because the
 * hood does not actually stop anybody seeing, and shifting weight while they
 * wait for the notes.
 */
function AtmUser({ x, tone }: { x: number; tone: string }) {
  return (
    <g>
      <g>
        <path d={pxPath([[x + 1, 82, 13, 4]])} fill="#3d2a1a" />
        <path d={pxPath([[x + 1, 86, 13, 10]])} fill={K.skin} />
        <path d={pxPath([[x + 1, 92, 13, 4]])} fill={K.skinShade} />
        <path d={pxPath([[x, 96, 15, 24]])} fill={tone} />
        <path d={pxPath([[x, 96, 15, 2]])} fill="#4d5560" />
        {/* the arm on the keypad, which is the only part of them that moves */}
        <path d={pxPath([[x - 4, 100, 5, 12]])} fill={tone} />
        <path d={pxPath([[x - 5, 111, 5, 4]])} fill={K.skin} />
        <path d={pxPath([[x + 1, 120, 6, 26]])} fill="#2a2f36" />
        <path d={pxPath([[x + 8, 120, 6, 26]])} fill="#2a2f36" />
        <path d={pxPath([[x, 146, 8, 4]])} fill="#2f2921" />
        <path d={pxPath([[x + 8, 146, 8, 4]])} fill="#2f2921" />
        {/* the weight shift, which is what waiting for notes looks like */}
        <animateTransform
          attributeName="transform"
          type="translate"
          calcMode="discrete"
          values="0 0;0 0;1 0;1 0;0 0;-1 0;0 0"
          dur="9.4s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** The current machine: blue bank, lobby-style unit, on block 16's flank. */
function Bankomat({ ph, s }: { ph: Ph; s: StreetState }) {
  const broken = s.bankomat === "broken";
  const lit = lampsOn(s, ph);
  const dark = ph === "night" || ph === "dusk";
  return (
    <g>
      {/* the worn patch, under everything, because it is in the pavement */}
      <path d={BK_WORN} fill={B6K.worn} opacity={0.5} />
      {/* the canopy that keeps the rain off the screen and nothing else */}
      <path d={BK_CANOPY} fill={STEEL[ph].base} />
      <path d={pxPath([[982, 78, 42, 1]])} fill={STEEL[ph].hi} />
      {isSnow(s) ? <path d={pxPath([[982, 77, 42, 2]])} fill={K.snow} /> : null}
      {/* the fee notice, in the smallest type ever printed */}
      <path d={BK_NOTICE} fill={B6K.notice} opacity={0.9} />
      <path d={pxPath(repeat(4, 3, [976, 99, 6, 1] as Rect, "y"))} fill="#8a8578" opacity={0.7} />
      {/* the machine */}
      <Bev set={BANKOMAT_SET} mat={{ ...FRAME[ph], base: B6K.atmBody, hi: B6K.atmBodyHi }} />
      <path d={pxPath([[988, 86, 30, 42]])} fill={B6K.atmDark} />
      {/* the bank's band across the top, which is the only branding on it */}
      <path d={BK_FASCIA} fill={broken ? "#3a4650" : B6K.bankA} />
      <path d={pxPath([[986, 84, 34, 1]])} fill={broken ? "#4a5866" : B6K.bankAHi} />
      <PixelText x={990} y={85} text="24 H" fill={K.white} gap={1} op={broken ? 0.3 : 0.85} />
      {/* the mirror for seeing who is standing behind you */}
      <path d={BK_MIRROR} fill={B6K.mirror} opacity={0.75} />
      {/* the screen */}
      <path d={BK_SCREEN} fill={broken ? B6K.screenOff : B6K.screenOn} />
      {broken ? (
        <g>
          {/* the A4 somebody taped over it, and the tape */}
          <path d={pxPath([[990, 95, 22, 11]])} fill={B6K.notice} />
          <PixelText x={994} y={98} text="AWARIA" fill="#8a3030" gap={0} op={0.9} />
          <path d={pxPath([[989, 94, 24, 1]])} fill="#d8d3b8" opacity={0.8} />
          <path d={pxPath([[989, 106, 24, 1]])} fill="#d8d3b8" opacity={0.8} />
        </g>
      ) : (
        <g>
          <PixelText x={992} y={97} text="PIN" fill={K.ledBlue} />
          <rect x={992} y={103} width={16} height={1} fill={K.ledBlue}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.15;1"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </rect>
          {/* the attract loop, which cycles whether anybody is there or not */}
          <rect x={990} y={93} width={22} height={15} fill={B6K.bankAHi} opacity={0.1}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.1;0.1;0.03;0.03;0.1"
              dur="11s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      )}
      {/* the rubber hood, the keypad under it, and the keypad backlight */}
      <path d={BK_HOOD} fill={B6K.hood} />
      <path d={BK_KEYS} fill={broken ? "#3a4048" : "#4d5560"} />
      {!broken && dark ? <path d={BK_KEYS} fill={K.ledBlue} opacity={0.25} /> : null}
      {/* card slot with its anti-skim bezel, receipt slot, cash mouth */}
      <path d={BK_CARD} fill="#5d656e" />
      <path d={BK_CARD_BEZEL} fill={broken ? "#4a5058" : B6K.bezel} />
      {!broken ? (
        <path d={BK_CARD_BEZEL} fill={B6K.bezel} opacity={0.6}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.6;0.2;0.6;0.6"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </path>
      ) : (
        /* shut: the shutter is across the slot */
        <path d={pxPath([[1013, 95, 5, 3]])} fill="#2b3138" />
      )}
      <path d={BK_RECEIPT} fill="#1b2026" />
      <path d={BK_CASH} fill="#1b2026" />
      <path d={BK_CASH_LIP} fill="#5d656e" />
      <path d={BK_CCTV} fill={B6K.hood} />
      <path d={pxPath([[1018, 86, 1, 1]])} fill="#c9d8e0" opacity={0.8} />
      {/* the receipt bin, overflowing when the machine is out and nobody empties it */}
      <Bev set={BK_BIN} mat={{ ...STEEL[ph], base: "#4d6350", hi: "#5f7a63" }} />
      <path d={pxPath([[975, 116, 7, 3]])} fill="#3f5244" />
      <path
        d={pxPath(
          broken
            ? [
                [976, 112, 5, 5],
                [979, 110, 4, 4],
              ]
            : [[976, 114, 5, 3]],
        )}
        fill={B6K.notice}
        opacity={0.85}
      />
      {/* The queue, unless the machine is out. Their legs disappear behind the
          telecom cabinet, which is drawn later in staticObjects — that is the
          correct depth: they are standing behind it, which is where you stand. */}
      {s.bankomat === "queue" ? <AtmUser x={1028} tone="#3a4650" /> : null}
      {s.bankomat === "queue" && s.crowd >= 3 ? <AtmUser x={1046} tone="#5d4a66" /> : null}
      {/* and the light it throws, which is the only cold light on this block */}
      {lit && !broken ? (
        <path d={pxPath(steppedEllipse(1002, 152, 22, 5, 2))} fill={dth("c", "25")} opacity={0.3} />
      ) : null}
    </g>
  );
}

/**
 * The other bank's machine: the older through-the-wall unit, further along. When
 * the main one is out, this is where the queue goes — which is the only reason
 * anybody knows it is there.
 */
function Bankomat16({ ph, s }: { ph: Ph; s: StreetState }) {
  const inherited = s.bankomat === "broken";
  const lit = lampsOn(s, ph);
  const dark = ph === "night" || ph === "dusk";
  return (
    <g>
      <path d={BK16_WORN} fill={B6K.worn} opacity={inherited ? 0.5 : 0.28} />
      {/* the recess it is set into, because through-the-wall units are let in */}
      <Bev set={BK16_RECESS} mat={{ ...R16[ph], base: R16[ph].deep, hi: R16[ph].lo }} />
      <path d={BK16_SIGN} fill={B6K.bankB} />
      <path d={pxPath([[1126, 80, 30, 1]])} fill={B6K.bankBHi} />
      <PixelText x={1132} y={81} text="24 H" fill={K.white} gap={1} op={0.8} />
      <path d={BK16_BODY} fill={B6K.atmBody} />
      <path d={pxPath([[1130, 90, 22, 1]])} fill={B6K.atmBodyHi} />
      {/* the screen: an older, smaller, greener one */}
      <path d={BK16_SCREEN} fill={B6K.screenOn} />
      <PixelText x={1135} y={99} text="PIN" fill={K.led} op={0.85} />
      <rect x={1135} y={105} width={12} height={1} fill={K.led}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.15;1"
          dur="2.1s"
          repeatCount="indefinite"
        />
      </rect>
      <path d={BK16_HOOD} fill={B6K.hood} />
      <path d={BK16_KEYS} fill="#4d5560" />
      {dark ? <path d={BK16_KEYS} fill={K.led} opacity={0.2} /> : null}
      <path d={BK16_CARD} fill="#5d656e" />
      <path d={pxPath([[1149, 96, 4, 2]])} fill={B6K.bezel} opacity={0.7} />
      <path d={BK16_CASH} fill="#1b2026" />
      <path d={pxPath([[1134, 122, 14, 1]])} fill="#5d656e" />
      {/* when the other one is out, the whole street comes here instead */}
      {inherited ? (
        <g>
          <AtmUser x={1158} tone="#4a5866" />
          {s.crowd >= 2 ? <AtmUser x={1176} tone="#3f4a3a" /> : null}
        </g>
      ) : null}
      {lit ? (
        <path
          d={pxPath(steppedEllipse(1141, 152, 16, 4, 2))}
          fill={dth("c", "25")}
          opacity={0.22}
        />
      ) : null}
    </g>
  );
}

/** The entrance to sixteen. It goes nowhere, and it is specified accordingly. */
function Entrance16({ ph, s }: { ph: Ph; s: StreetState }) {
  const dark = ph === "night" || ph === "dusk";
  const lit = lampsOn(s, ph);
  return (
    <g>
      {/* the canopy, and the flag bracket that is empty except in November */}
      <path d={pxPath([[1040, 58, 76, 4]])} fill="#d8e4ec" opacity={0.6} />
      <path d={pxPath([[1040, 57, 76, 1]])} fill="#eef4f8" />
      <path
        d={pxPath([
          [1044, 62, 3, 8],
          [1108, 62, 3, 8],
        ])}
        fill={STEEL[ph].lo}
      />
      {isSnow(s) ? <path d={pxPath([[1040, 56, 76, 2]])} fill={K.snow} /> : null}
      <path d={B16_FLAG_BRACKET} fill={B6K.flagBracket} />
      {/* the lamp over the door, on the same photocell as the street */}
      <path d={B16_LAMP_BRACKET} fill={STEEL[ph].lo} />
      <path d={B16_LAMP} fill={lit ? "#ffe0a8" : "#c9c4b6"} />
      {/* the opening: a flush threshold, because sixteen was built to the newer spec */}
      <Bev set={B16_ENTRY} mat={{ ...FRAME[ph], base: "#4a5459" }} />
      {/* what you can see of the hall, which is not much and not yours */}
      <path d={B16_LEAF_GLASS} fill={dark ? "#232a30" : K.glass[ph]} />
      <path d={B16_SIDE_GLASS} fill={dark ? "#232a30" : K.glass[ph]} />
      {dark ? (
        <g>
          <path d={B16_LEAF_GLASS} fill={K.glassLit} opacity={0.22} />
          <path d={B16_SIDE_GLASS} fill={K.glassLit} opacity={0.18} />
          {/* the letterbox bank, a shade of it, deep in the hall */}
          <path d={pxPath([[1088, 100, 12, 30]])} fill="#6d6a62" opacity={0.5} />
        </g>
      ) : null}
      {/* PVC, not aluminium: fatter rails, and it has yellowed */}
      <path d={B16_DOOR_RAILS} fill={B6K.door} />
      <path d={pxPath([[1056, 74, 26, 1]])} fill={B6K.doorHi} />
      <path d={B16_SIDE_RAILS} fill={B6K.door} />
      <path d={pxPath([[1084, 74, 20, 1]])} fill={B6K.doorHi} />
      <path d={B16_KICK} fill={B6K.doorLo} />
      <path d={B16_HANDLE} fill={STEEL[ph].base} />
      <path d={pxPath([[1077, 102, 3, 2]])} fill={STEEL[ph].hi} />
      <path d={pxPath([[1070, 104, 7, 8]])} fill="#ffffff" opacity={0.06} />
      {/* the mat, and the butts from the people who smoke outside their own door */}
      <path d={B16_MAT} fill="#4a4438" />
      <path d={B16_MAT_RIBS} fill="#5d5648" />
      <path d={B16_BUTTS} fill={K.white} opacity={0.5} />
      <Plaque x={1058} y={46} digits="16" />
      {/* the cheap domofon: a speaker, eight buttons, no camera, no reader */}
      <Bev set={B16_DOMOFON} mat={{ ...STEEL[ph], base: "#8a9094", hi: "#a3a9ad" }} />
      <path d={B16_DOM_GRILLE} fill="#4a4d52" />
      <path d={B16_DOM_KEYS} fill={STEEL[ph].lo} />
      <path d={pxPath([[1117, 116, 2, 2]])} fill={K.led}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.4;1;1"
          dur="4.1s"
          repeatCount="indefinite"
        />
      </path>
      {/* the donica the hedge-16 hitbox has been pointing at all along */}
      <Bev
        set={B16_PLANTER}
        mat={{
          hi: B6K.planterHi,
          base: B6K.planter,
          mid: B6K.planter,
          lo: "#7a7268",
          deep: "#625b53",
        }}
      />
      <path d={B16_PLANTER_SOIL} fill={B6K.soil} />
      <path d={B16_SHRUB} fill={s.season === "bare" ? "#5d5442" : B6K.shrub} />
      <path d={B16_SHRUB_HI} fill={s.season === "bare" ? "#6d6450" : B6K.shrubHi} />
      {isSnow(s) ? <path d={B16_SHRUB_HI} fill={K.snow} opacity={0.85} /> : null}
      {/* the cigarette stubbed out in the soil, which is what donicas are for */}
      <path d={pxPath([[1122, 132, 2, 2]])} fill={K.white} opacity={0.5} />
    </g>
  );
}

function Block16({ ph, s }: { ph: Ph; s: StreetState }) {
  const dark = ph === "night" || ph === "dusk";
  const snow = isSnow(s);
  return (
    <g>
      <Bev set={R16_BODY} mat={R16[ph]} />
      <rect x={Z.passage} y={0} width={358} height={GROUND} fill="url(#px-roller)" />
      <path d={R16_JOINTS} fill={R16[ph].mid} />
      <path d={SLAB_16} fill={R16[ph].lo} />
      {/* the loggia somebody glazed in a profile nobody else on the block used */}
      <path d={B16_LOGGIA} fill={dark ? "#2f3a44" : B6K.loggia} opacity={0.75} />
      <path d={B16_LOGGIA_FRAME} fill={B6K.loggiaFrame} />
      <SillWindow x={924} ph={ph} life="blinds" snow={snow} />
      <SillWindow x={972} ph={ph} life="tv" snow={snow} />
      <SillWindow x={1020} ph={ph} life="lit" snow={snow} />
      <SillWindow x={1164} ph={ph} life="curtains" snow={snow} />
      <SillWindow x={1212} ph={ph} life="plant" snow={snow} />
      <Bev set={PLINTH_16} mat={{ ...PLINTH[ph], base: "#8a9094", hi: "#9aa0a4" }} />
      {/* anti-poster paint on the plinth, and the tags that went on it anyway */}
      <path d={B16_ANTIPOSTER} fill={B6K.antiPoster} opacity={0.35} />
      <path d={B16_TAGS} fill={B6K.tag} opacity={0.7} />
      <path d={pxPath([[1120, 143, 3, 5]])} fill={B6K.tagAlt} opacity={0.7} />
      {/* the gas pipe, painted over twice, flaking back to yellow in three places */}
      <path d={GAS_16} fill={K.gas16} />
      <path
        d={pxPath([
          [Z.passage, 124, 158, 1],
          [1100, 124, 150, 1],
        ])}
        fill="#d8d47a"
      />
      <path d={B16_GAS_FLAKE} fill={K.gas} opacity={0.8} />
      {/* the basement windows, which every blok has and no scene ever draws */}
      <path d={B16_CELLARS} fill={B6K.cellar} />
      <path d={B16_CELLAR_BARS} fill={B6K.cellarBar} />
      {/* the extract fan in the middle one, turning because the laundry is on */}
      <path
        d={pxPath([
          [970, 142, 1, 5],
          [968, 144, 5, 1],
        ])}
        fill={B6K.cellarBar}
        opacity={0.6}
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 970.5 144.5"
          to="360 970.5 144.5"
          dur="1.3s"
          repeatCount="indefinite"
        />
      </path>

      {/* ---- the two ground-floor flats: one barred, one lived in --------- */}
      <Bev set={B16_PARTER} mat={FRAME[ph]} />
      {/* left: blinds permanently down, and kraty, because it is a parter flat */}
      <path d={pxPath([[923, 87, 28, 36]])} fill={dark ? K.glass.night : K.glass[ph]} />
      <path d={pxPath([[936, 87, 2, 36]])} fill={FRAME[ph].deep} />
      <path d={pxPath([[923, 87, 28, 14]])} fill="#d8d3c5" />
      <path d={pxPath(repeat(3, 4, [923, 91, 28, 1] as Rect, "y"))} fill="#b8b3a4" />
      <path d={B16_BARS} fill={B6K.bars} />
      {/* right: lit, warm, and somebody in there watches the street */}
      <path d={pxPath([[1163, 87, 28, 36]])} fill={dark ? K.glassLit : K.glass[ph]} />
      <path d={pxPath([[1176, 87, 2, 36]])} fill={FRAME[ph].deep} />
      {dark ? <path d={pxPath([[1166, 92, 10, 14]])} fill={B6K.parterLit} /> : null}
      {/* the curtain that twitches, which is the most honest animation on the block */}
      <g>
        <path d={pxPath([[1163, 87, 7, 36]])} fill={B6K.curtain} opacity={0.9} />
        <animateTransform
          attributeName="transform"
          type="translate"
          calcMode="discrete"
          values="0 0;0 0;0 0;0 0;3 0;3 0;0 0"
          dur="27s"
          repeatCount="indefinite"
        />
      </g>
      <path d={pxPath([[1184, 87, 7, 36]])} fill={B6K.curtain} opacity={0.9} />
      {/* the SPRZEDAM sign that has been up since spring */}
      <path d={B16_FORSALE} fill={B6K.notice} />
      <PixelText x={1164} y={94} text="SPRZEDAM" fill="#8a3030" gap={0} op={0.9} />
      {/* and the flower box, which is the only maintained thing on this elevation */}
      <path d={B16_FLOWERBOX} fill={B6K.soil} />
      <path d={pxPath([[1160, 122, 34, 2]])} fill="#5d4a37" />
      {s.season === "bare" ? (
        <path d={pxPath([[1164, 119, 26, 3]])} fill="#5d5442" />
      ) : (
        <g>
          <path d={B16_FLOWERS} fill={B6K.flowerA} />
          <path d={pxPath([[1171, 116, 5, 6]])} fill={B6K.flowerB} />
        </g>
      )}
      {/* the hedges the two flats hide behind */}
      <path
        d={pxPath([
          [914, 126, 46, 24],
          [1154, 126, 46, 24],
        ])}
        fill={HEDGE[ph].lo}
      />
      <path
        d={pxPath([
          [920, 120, 32, 10],
          [1160, 120, 32, 10],
        ])}
        fill={HEDGE[ph].base}
      />
      {snow ? (
        <path
          d={pxPath([
            [920, 119, 32, 2],
            [1160, 119, 32, 2],
          ])}
          fill={K.snow}
        />
      ) : null}

      {/* ---- the entrance, the machines, and the far end ------------------ */}
      <Entrance16 ph={ph} s={s} />
      <Bankomat16 ph={ph} s={s} />
      {/* the drainpipe at the far end, and the rat guard round the foot of it */}
      <path d={B16_PIPE} fill={R16[ph].mid} />
      <path d={B16_PIPE_HI} fill={R16[ph].hi} />
      <path d={B16_PIPE_GUARD} fill={B6K.ratGuard} />
      {/* the thermomodernisation plaque nobody has read since 2011 */}
      <Bev set={B16_EU_PLAQUE} mat={{ ...STEEL[ph], base: B6K.plaqueEu, hi: "#2a5a94" }} />
      <path d={pxPath([[1230, 98, 14, 3]])} fill="#e8c445" opacity={0.8} />
      <path
        d={pxPath(repeat(3, 3, [1231, 103, 12, 1] as Rect, "y"))}
        fill={K.white}
        opacity={0.5}
      />
      {snow ? <path d={pxPath([[1228, 95, 18, 2]])} fill={K.snow} /> : null}
    </g>
  );
}

/* ==================================================================== *
 * ONE CHANGE OUTSIDE THIS BLOCK
 *
 * `Bankomat16` is called from inside `Block16`, so the only thing to do is
 * delete the two stray lines that used to stand in for it. In the old Block16,
 * at the end, remove:
 *
 *        {px(1120, 100, 12, 18, STEEL[ph].lo)}
 *        {px(1122, 103, 8, 8, "#c9c4b6")}
 *
 * That was the unexplained grey box the `bankomat-16` hitbox was pointing 21 px
 * to the right of. The real machine is at 1126..1156 now, centred on the hitbox.
 *
 * NO ARTKEY CHANGE. This block reads `s.bankomat`, `s.crowd`, `s.weather`,
 * `s.season` and `lampsOn(s, ph)`, every one of which artKey already joins.
 *
 * WHAT THE HITBOXES NOW POINT AT, all verified:
 *   bankomat       989..1017  the blue bank's machine at 986..1020
 *   cabinet       1020..1056  the telecom cabinet at 1026..1050 (unchanged)
 *   plaque-16     1057..1067  the 16 plaque at 1058..1084
 *   klatka-16     1068..1096  the PVC door leaf at 1056..1082
 *   hedge-16      1098..1122  the donica at 1108..1132 — was pointing at nothing
 *   bankomat-16   1127..1155  the green bank's machine at 1126..1156 — was
 *                             pointing 21 px right of a 12 px grey box
 *   parter-window 1165..1189  the lived-in flat at 1160..1194
 *
 * OPTIONAL — the machines as light sources. Both throw a small pool already, in
 * component. If you want them in the proper light pass instead, the tiers are:
 *
 *        const SPILL_ATM_A = spill(986, 1020, 84, 12, "c", 0.35);
 *        const SPILL_ATM_B = spill(1126, 1156, 86, 10, "c", 0.28);
 *
 * and gate the second on `s.bankomat === "broken"` so the light follows the queue.
 * ==================================================================== */

/* ================================================================== *
 * PLANE 3 — the pavement
 * ================================================================== */

function Pavement({ ph, s }: { ph: Ph; s: StreetState }) {
  const walk = WALK[ph];
  const wet = isWet(s);
  const snow = isSnow(s);
  return (
    <g>
      {px(0, GROUND, STREET_W, KERB - GROUND, walk.deep)}
      <path d={PAVING.face} fill={walk.base} />
      <path d={PAVING.hi} fill={walk.hi} />
      <rect x={0} y={GROUND} width={STREET_W} height={KERB - GROUND} fill="url(#px-agg)" />
      <path d={TRACKS} fill={walk.hi} opacity={0.7} />
      {/* kerb, gutter, asphalt, and the patches in it */}
      <path d={KERB_LINE} fill={walk.hi} />
      {px(0, ROAD, STREET_W, H - ROAD, ROADM[ph].base)}
      {px(0, ROAD, STREET_W, 1, ROADM[ph].hi)}
      <rect x={0} y={ROAD} width={STREET_W} height={H - ROAD} fill="url(#px-agg)" />
      <path d={ASPHALT_WEAR} fill={ROADM[ph].lo} />
      {/* covers, the manhole, the drain */}
      <path d={MANHOLE} fill="#6d6a62" />
      <path d={pxPath([[920, 158, 22, 1]])} fill="#7d7a72" />
      <path d={MANHOLE_SLOTS} fill="#5a5750" />
      <path d={DRAIN} fill="#5a5750" />
      <path d={DRAIN_SLOTS} fill="#3f3d38" />
      <path d={COVER_GAS} fill={walk.lo} />
      <path d={COVER_TEL} fill={walk.lo} />
      {/* the long shadows off both blocks */}
      <path
        d={pxPath([
          [60, GROUND, 520, 4],
          [Z.passage, GROUND, 358, 4],
        ])}
        fill={dth("n", "25")}
        opacity={0.5}
      />
      {/* hopscotch, gum, grass, stubs — the layer that makes a pavement real */}
      <path d={HOPSCOTCH} fill={K.chalk} opacity={snow ? 0 : 0.65} />
      <path d={JOINT_GRASS} fill={s.season === "bare" ? "#5d5442" : M.leaf.base} />
      <path d={GUM} fill="#6d6a62" opacity={0.7} />
      <path d={STUBS} fill={K.white} opacity={0.5} />
      {px(508, 160, 3, 2, K.bagRed)}
      {/* what the season leaves on the slabs */}
      {s.season === "autumn" ? (
        <path
          d={pxPath([
            [150, 158, 3, 2],
            [214, 163, 2, 2],
            [286, 155, 3, 2],
            [368, 161, 2, 2],
            [452, 157, 3, 2],
            [546, 164, 2, 2],
            [630, 156, 3, 2],
            [718, 162, 2, 2],
            [806, 158, 3, 2],
            [892, 164, 2, 2],
            [986, 156, 3, 2],
            [1072, 161, 2, 2],
            [1160, 157, 3, 2],
            [1232, 163, 2, 2],
          ])}
          fill={K.leafDry}
        />
      ) : null}
      {/* the puddle that survives everything, and the ripple in it */}
      <path
        d={pxPath(steppedEllipse(655, 161, wet ? 22 : 15, wet ? 4 : 3, 2))}
        fill={ph === "night" || ph === "dusk" ? K.puddleNight : K.water}
        opacity={0.7}
      />
      <path
        d={pxPath(steppedEllipse(653, 160, 9, 1, 1))}
        fill={ph === "night" || ph === "dusk" ? "#5d7a8a" : K.waterHi}
        opacity={0.6}
      />
      {wet ? (
        <g>
          {/* everything darkens, and the shopfront comes back up out of the slabs */}
          <rect
            x={0}
            y={GROUND}
            width={STREET_W}
            height={KERB - GROUND}
            fill="#1a2430"
            opacity={0.26}
          />
          <path d={pxPath([[302, GROUND + 2, 276, 7]])} fill={ZAB_M.day.hi} opacity={0.2} />
          <path d={pxPath([[163, GROUND + 2, 50, 5]])} fill={K.glassLit} opacity={0.14} />
          <path
            d={pxPath([
              ...steppedEllipse(240, GROUND + 11, m(1.1), m(0.15), 2),
              ...steppedEllipse(760, GROUND + 13, m(0.9), m(0.13), 2),
              ...steppedEllipse(1120, GROUND + 10, m(1.0), m(0.14), 2),
            ])}
            fill={K.water}
            opacity={0.35}
          />
        </g>
      ) : null}
      {snow ? (
        <g>
          <rect
            x={0}
            y={GROUND}
            width={STREET_W}
            height={KERB - GROUND}
            fill={K.snow}
            opacity={0.6}
          />
          <path d={pxPath([[0, GROUND, STREET_W, 2]])} fill={K.snow} />
          {/* gritted where people actually go in, and footprints in the rest */}
          <path
            d={pxPath([
              [430, GROUND + 2, 60, 12],
              [160, GROUND + 2, 44, 12],
              [1054, GROUND + 3, 52, 11],
            ])}
            fill={K.grit}
            opacity={0.5}
          />
          <path
            d={pxPath([
              [180, GROUND + 6, 5, 3],
              [196, GROUND + 10, 5, 3],
              [214, GROUND + 5, 5, 3],
              [232, GROUND + 9, 5, 3],
              [412, GROUND + 7, 5, 3],
              [428, GROUND + 11, 5, 3],
              [1030, GROUND + 6, 5, 3],
              [1046, GROUND + 10, 5, 3],
            ])}
            fill={K.snowLo}
          />
        </g>
      ) : null}
      <Contact set={STREET_CONTACT} op={ph === "night" ? 0.5 : 0.9} />
      <AOSet set={STREET_AO} op={ph === "night" ? 0.6 : 0.95} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — street furniture, twelve pieces of it
 * ================================================================== */

/* ==================================================================== *
 * PRZYSTANEK 512 — replacement block for street.tsx
 *
 * Drops in over the existing BusStop. The module-scope geometry goes up with the
 * other BUSSTOP_* constants; the component goes where the old one was.
 *
 * NO NEW WORLD READS. Unlike the Żabka and the klatka, there is no scene behind
 * this thing, so there is nothing to mirror — everything here comes from the
 * `s` the street already has: `bus` drives the board and the splash, `crowd`
 * puts people on the bench, `weather` and `season` do the rest. Which means
 * **artKey does not change for this block.** That is the whole diff.
 *
 * WHAT IT HAS TO AGREE WITH INSTEAD. Two things in the same file:
 *   – the bus's destination blind reads "512 OSIEDLE", so the board's second row
 *     reads OSIEDLE and not something invented;
 *   – Heniek stands at x=488 and steps forward when `bus === "arriving"`, so the
 *     board flashes and the puddle gets splashed on the same stage. One event,
 *     three things reacting to it.
 *
 * TWO MEASUREMENT FIXES.
 *   1. The bench was at y=122, which at 38 px/m is 0.74 m off the ground — a
 *      bar stool. A bench seat is 0.45 m, which is y=133. It is now at 133, with
 *      its legs going down to the pavement instead of hanging in the air.
 *   2. The `puddle` hitbox is at x=578 but Pavement draws the puddle at x=655,
 *      seventy-seven pixels away and under the paczkomat. The art belongs at the
 *      kerb here — a bus pulling in and soaking everybody waiting is the single
 *      most universal Polish bus-stop experience — so the one-line move is at the
 *      foot of this file, and the splash below lands in it.
 *
 * WHAT MAKES IT A POLISH STOP RATHER THAN A GENERIC ONE:
 *   – one rear panel is chipboard, because the glass got smashed and glass costs
 *     money; the timetable case is screwed to the chipboard, because that is
 *     where there was something to screw into
 *   – the timetable is a real ZTM-shaped case: stop name header, route number,
 *     and three columns because dni powszednie, soboty and święta are three
 *     different services
 *   – a backlit citylight advert, which is the only thing at the stop anybody
 *     has maintained, and which is a light source after dark
 *   – the plate on the pole carries the route number and the post number, 02,
 *     because every stop in the country is 01 on one side and 02 on the other
 *   – flyposting on the pole and the ghost rectangles where the last lot was
 *     scraped off
 *   – scratched-in initials on the glass, gum and tickets under the bench, a
 *     cigarette burn melted into the seat
 *   – BUS painted on the asphalt and the boarding kerb raised to meet the door
 *   – a bin bolted to the post with an ashtray on its lid
 *   – and in winter, the swept patch in front of the bench that somebody from
 *     the block does without being asked
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * geometry and palette — put this with the other BUSSTOP_* constants
 * -------------------------------------------------------------------- */

/** Stop colours. The board is amber-on-black; the citylight is 5000K. */
const BSK = {
  frame: "#4a4e52",
  frameHi: "#6d7278",
  frameLo: "#383c40",
  roof: "#8fa4ae",
  roofHi: "#a8bcc4",
  glass: "#b8ccd8",
  glassNight: "#2f353c",
  /** the chipboard that went in where the glass came out */
  board: "#a8845a",
  boardHi: "#bd9a6c",
  boardLo: "#8a6a44",
  screw: "#6d6a62",
  case: "#e8e2d2",
  caseHead: "#1e4478",
  caseRule: "#8a8578",
  /** the citylight: 5000K behind a poster, and the only maintained thing here */
  cityLight: "#f4f8ff",
  cityFrame: "#5d656e",
  poster: "#c9463c",
  posterAlt: "#e8c445",
  bench: "#8a623f",
  benchHi: "#a1794f",
  benchBurn: "#4a3524",
  plate: "#1e4478",
  plateHi: "#2a5a94",
  pole: "#8a9094",
  poleLo: "#6d7278",
  bin: "#4d6350",
  binLid: "#3f5244",
  boardDark: "#1b1f24",
  ticket: "#d9d3c2",
  gum: "#6d6a62",
  scratch: "#dfe8ea",
  paint: "#c9a24b",
  ghost: "#9aa8b0",
} as const;

/** The shelter is one module: 508..578 is 1.84 m, which is what a single bay is. */
const BS = { x0: 508, x1: 578, back0: 516, back1: 570 } as const;
const BS_SEAT = 133; // 0.45 m — a bench, not a bar stool
const BS_ROOF = 53;

/* --- the roof: translucent panel, ribs, drip edge --- */
const BS_ROOF_SLAB = bevelPaths([[BS.x0 - 2, BS_ROOF, BS.x1 - BS.x0 + 2, 7]]);
const BS_ROOF_RIBS = pxPath(bank([[514, BS_ROOF + 1, 2, 5]], 5, 14));
const BS_ROOF_DRIP = pxPath([[BS.x0 - 2, BS_ROOF + 7, BS.x1 - BS.x0 + 2, 2]]);

/* --- the rear: one chipboard panel, one glazed, and the scars on both --- */
const BS_BACK_GLASS = pxPath([[BS.back0, 62, BS.back1 - BS.back0, 86]]);
/** The panel that got smashed, and the chipboard that went in instead. */
const BS_CHIPBOARD = pxPath([[516, 62, 30, 48]]);
const BS_CHIP_SCREWS = pxPath([
  [518, 64, 2, 2],
  [542, 64, 2, 2],
  [518, 106, 2, 2],
  [542, 106, 2, 2],
]);
/** Initials scratched into the glass that is left. */
const BS_SCRATCH = pxPath([
  [552, 124, 1, 7],
  [553, 124, 4, 1],
  [556, 124, 1, 4],
  [559, 126, 5, 1],
  [561, 124, 1, 7],
]);

/* --- the timetable case, screwed to the chipboard --- */
const BS_CASE = bevelPaths([[516, 64, 30, 44]]);
const BS_CASE_HEAD = pxPath([[517, 65, 28, 7]]);
/** Three columns, because dni powszednie / soboty / święta are three services. */
const BS_CASE_COLS = pxPath([
  [527, 80, 1, 26],
  [536, 80, 1, 26],
]);
const BS_CASE_ROWS = pxPath(repeat(9, 3, [518, 82, 26, 1] as Rect, "y"));
const BS_CASE_GLARE = pxPath([
  [517, 65, 12, 42],
  [530, 65, 4, 42],
]);

/* --- the citylight: backlit, and the only maintained thing at the stop --- */
const BS_CITY = bevelPaths([[548, 64, 22, 54]]);
const BS_CITY_FACE = pxPath([[550, 66, 18, 50]]);
const BS_CITY_ART = pxPath([
  [550, 66, 18, 18],
  [552, 90, 14, 4],
  [552, 98, 10, 3],
]);
/** The bottom corner nobody re-glued after the last poster change. */
const BS_CITY_PEEL = pxPath([[550, 110, 6, 6]]);

/* --- the bench: perforated steel on two legs, at a real 0.45 m --- */
const BS_BENCH = bevelPaths([[518, BS_SEAT, 50, 6]]);
const BS_BENCH_PERF = pxPath(bank([[521, BS_SEAT + 2, 2, 2]], 12, 4));
const BS_BENCH_LEGS = pxPath([
  [520, BS_SEAT + 6, 4, GROUND - BS_SEAT - 6],
  [562, BS_SEAT + 6, 4, GROUND - BS_SEAT - 6],
]);
/** The cigarette burn melted into the seat, which is on every bench in Poland. */
const BS_BENCH_BURN = pxPath([
  [538, BS_SEAT + 1, 3, 2],
  [545, BS_SEAT + 2, 2, 2],
]);
/** Gum and tickets under it. */
const BS_UNDER = pxPath([
  [528, 147, 3, 2],
  [542, 148, 5, 2],
  [534, 145, 2, 2],
  [552, 147, 4, 2],
]);

/* --- the LED board: two rows, route and destination --- */
const BS_BOARD = bevelPaths([[518, 40, 32, 16]]);
const BS_BOARD_FACE = pxPath([[519, 41, 30, 14]]);

/* --- the pole, the plate, the bin bolted to it --- */
const BS_POLE = pxPath([[578, 44, 4, GROUND - 44]]);
const BS_POLE_HI = pxPath([[578, 44, 1, GROUND - 44]]);
const BS_PLATE = bevelPaths([[566, 42, 24, 16]]);
/** The bus pictogram on the plate: a body, two windows, two wheels. */
const BS_PICTO = pxPath([
  [568, 45, 9, 6],
  [569, 46, 3, 3],
  [573, 46, 3, 3],
  [569, 51, 2, 2],
  [574, 51, 2, 2],
]);
/** Flyposting on the pole, and the ghosts of the last lot scraped off. */
const BS_FLYPOST = pxPath([
  [572, 96, 12, 10],
  [574, 110, 10, 8],
]);
const BS_FLYPOST_GHOST = pxPath([
  [573, 82, 11, 9],
  [575, 122, 9, 7],
]);
const BS_BIN = bevelPaths([[574, 118, 12, 22]]);
const BS_BIN_LID = pxPath([[573, 116, 14, 3]]);
const BS_BIN_ASH = pxPath([[576, 114, 6, 2]]);
const BS_BIN_POST = pxPath([[579, 140, 3, 10]]);

/* --- the ground: boarding kerb, tactile strip, road marking --- */
const BS_BOARD_KERB = pxPath([[BS.x0, 150, BS.x1 - BS.x0, 3]]);
const BS_TACTILE = pxPath(
  Array.from({ length: 2 }, (_, r) =>
    Array.from({ length: 22 }, (_, c) => [510 + c * 3, 153 + r * 3, 2, 2] as Rect),
  ).flat(),
);
/** The zigzag and the word, which is what stops cars parking on the stop. */
const BS_ROAD_ZIGZAG = pxPath(
  Array.from({ length: 9 }, (_, i) => [508 + i * 8, 170 + (i % 2) * 3, 6, 2] as Rect),
);

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

/**
 * Przystanek Słoneczna 02. One shelter bay, a board that counts down, and the
 * bus it counts down to — which arrives in the Foreground plane and soaks the
 * puddle this thing is standing next to.
 */
function BusStop({ ph, s }: { ph: Ph; s: StreetState }) {
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const lit = lampsOn(s, ph);
  const snow = isSnow(s);
  const wet = isWet(s);
  const coming = s.bus === "arriving";
  const dead = s.bus === "none";
  /** The countdown. Zero when it is pulling in, a dash when the day is over. */
  const mins = coming ? "0" : dead ? "-" : ph === "dawn" ? "4" : ph === "day" ? "7" : "12";
  /** Somebody is always sitting on it except at night and in the rain. */
  const seated = s.crowd >= 2 && !night;
  return (
    <g>
      {/* ---- the road: the zigzag and the word, so nobody parks on it ------- */}
      <path d={BS_ROAD_ZIGZAG} fill={BSK.paint} opacity={0.55} />
      <PixelText x={536} y={174} text="BUS" fill={BSK.paint} gap={1} op={0.5} />
      {/* the boarding kerb, raised to meet the door, and its tactile strip */}
      <path d={BS_BOARD_KERB} fill={WALK[ph].hi} />
      <path d={BS_TACTILE} fill={snow ? K.snowLo : "#c9a24b"} opacity={0.7} />

      {/* ---- the frame and the roof ---------------------------------------- */}
      <Bev set={BUSSTOP_SET} mat={{ ...STEEL[ph], base: BSK.frame, hi: BSK.frameHi }} />
      <Bev set={BS_ROOF_SLAB} mat={{ ...STEEL[ph], base: BSK.roof, hi: BSK.roofHi }} />
      <path d={BS_ROOF_RIBS} fill={BSK.frameLo} opacity={0.6} />
      <path d={BS_ROOF_DRIP} fill={BSK.frameLo} />
      {snow ? (
        <path d={pxPath([[BS.x0 - 2, BS_ROOF - 2, BS.x1 - BS.x0 + 2, 3]])} fill={K.snow} />
      ) : null}

      {/* ---- the rear: what is left of the glass, and the chipboard -------- */}
      <path d={BS_BACK_GLASS} fill={dark ? BSK.glassNight : BSK.glass} />
      <rect
        x={BS.back0}
        y={62}
        width={BS.back1 - BS.back0}
        height={86}
        fill="url(#px-satin)"
        opacity={0.45}
      />
      {/* the panel that got smashed. Glass costs money; chipboard does not. */}
      <path d={BS_CHIPBOARD} fill={BSK.board} />
      <path d={pxPath([[516, 62, 30, 2]])} fill={BSK.boardHi} />
      <path d={pxPath([[516, 108, 30, 2]])} fill={BSK.boardLo} />
      <rect x={516} y={62} width={30} height={48} fill="url(#px-wood)" opacity={0.5} />
      <path d={BS_CHIP_SCREWS} fill={BSK.screw} />
      {/* and the initials somebody scratched into the glass that survived */}
      <path d={BS_SCRATCH} fill={BSK.scratch} opacity={0.5} />

      {/* ---- the timetable, screwed to the chipboard ----------------------- */}
      <Bev set={BS_CASE} mat={{ ...STEEL[ph], base: BSK.case, hi: "#f4f0e4" }} />
      <path d={BS_CASE_HEAD} fill={BSK.caseHead} />
      <PixelText x={518} y={66} text="SŁONECZNA" fill={K.white} gap={0} op={0.9} />
      <PixelText x={518} y={74} text="512" fill={BSK.caseHead} gap={1} />
      <PixelText x={533} y={74} text="02" fill={BSK.caseRule} gap={1} op={0.8} />
      {/* three columns, because weekdays, Saturdays and holidays are three services */}
      <path d={BS_CASE_COLS} fill={BSK.caseRule} opacity={0.7} />
      <path d={BS_CASE_ROWS} fill={BSK.caseRule} opacity={0.45} />
      {/* the glare on the case glass, which is why nobody can read it at dusk */}
      <path d={BS_CASE_GLARE} fill="#ffffff" opacity={dark ? 0.05 : 0.14} />

      {/* ---- the citylight: backlit, and the only maintained thing here ---- */}
      <Bev set={BS_CITY} mat={{ ...STEEL[ph], base: BSK.cityFrame, hi: "#767e88" }} />
      <path d={BS_CITY_FACE} fill={lit ? BSK.cityLight : "#8a9298"} />
      <path d={BS_CITY_ART} fill={BSK.poster} />
      <path d={pxPath([[552, 90, 14, 1]])} fill={BSK.posterAlt} />
      <path d={BS_CITY_PEEL} fill={lit ? "#dfe8f0" : "#7a828a"} />
      {lit ? (
        <rect x={550} y={66} width={18} height={50} fill={BSK.cityLight} opacity={0.12}>
          {/* one of the two tubes behind it is on its way out */}
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.12;0.12;0.12;0.04;0.12"
            dur="23s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}

      {/* ---- the bench, at 0.45 m, with its legs on the ground ------------- */}
      <path d={BS_BENCH_LEGS} fill={STEEL[ph].lo} />
      <Bev set={BS_BENCH} mat={{ ...OAK[ph], base: BSK.bench, hi: BSK.benchHi }} />
      <path d={BS_BENCH_PERF} fill={BSK.frameLo} opacity={0.5} />
      <path d={BS_BENCH_BURN} fill={BSK.benchBurn} opacity={0.7} />
      <path d={BS_UNDER} fill={BSK.ticket} opacity={0.8} />
      <path d={pxPath([[534, 145, 2, 2]])} fill={BSK.gum} />

      {/* ---- who is on it ------------------------------------------------- */}
      {seated ? (
        <g>
          {/* the woman with the shopping, bags between her feet */}
          <path d={pxPath([[521, 101, 11, 5]])} fill="#7c3040" />
          <path d={pxPath([[522, 105, 10, 8]])} fill={K.skin} />
          <path d={pxPath([[522, 110, 10, 3]])} fill={K.skinShade} />
          <path d={pxPath([[520, 113, 14, 20]])} fill={K.coat} />
          <path d={pxPath([[520, 113, 14, 2]])} fill="#6a5675" />
          <path d={pxPath([[521, BS_SEAT + 6, 5, 11]])} fill="#8a8578" />
          <path d={pxPath([[528, BS_SEAT + 6, 5, 11]])} fill="#8a8578" />
          <path
            d={pxPath([
              [520, 145, 6, 5],
              [528, 145, 6, 5],
            ])}
            fill="#3a3129"
          />
          <path d={pxPath([[534, 140, 9, 10]])} fill={K.bagRed} />
          <path d={pxPath([[534, 140, 9, 2]])} fill="#d85a50" />
          {s.crowd >= 3 ? (
            <g>
              {/* and the teenager at the far end, hood up, looking at nothing */}
              <path d={pxPath([[550, 100, 13, 7]])} fill="#3a4148" />
              <path d={pxPath([[552, 106, 10, 7]])} fill={K.skin} />
              <path d={pxPath([[552, 110, 10, 3]])} fill={K.skinShade} />
              <path d={pxPath([[550, 113, 14, 20]])} fill={K.hoodie} />
              <path d={pxPath([[551, BS_SEAT + 6, 5, 11]])} fill="#2e3033" />
              <path d={pxPath([[558, BS_SEAT + 6, 5, 11]])} fill="#2e3033" />
              <path
                d={pxPath([
                  [550, 145, 6, 5],
                  [558, 145, 6, 5],
                ])}
                fill="#8a8f96"
              />
              {/* the phone, and the only light on his face */}
              <path d={pxPath([[556, 118, 4, 6]])} fill="#22262c" />
              <rect x={557} y={119} width={2} height={4} fill="#9fc7d6" opacity={0.8}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.8;0.55;0.85;0.6"
                  dur="4.5s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
        </g>
      ) : null}
      {/* the glove somebody left on the bench, which will be there all week */}
      {snow && !seated ? <path d={pxPath([[550, BS_SEAT - 3, 8, 4]])} fill="#7c3040" /> : null}

      {/* ---- the LED board, which is what the bus exists to justify -------- */}
      <Bev set={BS_BOARD} mat={{ ...STEEL[ph], base: BSK.boardDark, hi: "#3a4148" }} />
      <path d={BS_BOARD_FACE} fill="#0d1116" />
      <PixelText x={521} y={43} text="512" fill={dead ? "#4a5a52" : K.ledAmber} />
      <PixelText x={540} y={43} text={mins} fill={dead ? "#4a5a52" : coming ? K.ledRed : K.led} />
      {/* row two: the destination, and it says what the bus's blind says */}
      <PixelText
        x={520}
        y={50}
        text="OSIEDLE"
        fill={dead ? "#3f4a44" : K.ledAmber}
        gap={1}
        op={0.85}
      />
      {coming ? (
        <rect x={518} y={40} width={32} height={16} fill={K.ledRed} opacity={0.14}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.14;0.03;0.14"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}

      {/* ---- the pole, the plate, the flyposting, the bin ------------------ */}
      <path d={BS_POLE} fill={BSK.pole} />
      <path d={BS_POLE_HI} fill="#a3a9ad" />
      <Bev set={BS_PLATE} mat={{ ...STEEL[ph], base: BSK.plate, hi: BSK.plateHi }} />
      <path d={BS_PICTO} fill={K.white} opacity={0.9} />
      <PixelText x={579} y={45} text="512" fill={K.white} gap={1} />
      <PixelText x={579} y={52} text="02" fill="#a8c0dc" gap={1} op={0.9} />
      {/* the ghosts of the last lot of flyposting, and this lot on top of them */}
      <path d={BS_FLYPOST_GHOST} fill={BSK.ghost} opacity={0.35} />
      <path d={BS_FLYPOST} fill={BSK.case} opacity={0.85} />
      <path
        d={pxPath([
          [574, 99, 8, 1],
          [574, 102, 6, 1],
          [576, 113, 6, 1],
        ])}
        fill={BSK.caseRule}
        opacity={0.7}
      />
      {/* the bin bolted to the post, and the ashtray on its lid */}
      <path d={BS_BIN_POST} fill={BSK.poleLo} />
      <Bev set={BS_BIN} mat={{ ...HEDGE[ph], base: BSK.bin, hi: "#5f7a63" }} />
      <path d={BS_BIN_LID} fill={BSK.binLid} />
      <path d={BS_BIN_ASH} fill="#3a3a38" />
      {s.kosz >= 1 ? (
        <path
          d={pxPath([
            [576, 112, 6, 4],
            [582, 111, 4, 5],
          ])}
          fill={BSK.ticket}
          opacity={0.85}
        />
      ) : null}
      {s.kosz >= 2 ? <path d={pxPath([[586, 147, 4, 2]])} fill={BSK.ticket} /> : null}

      {/* ---- weather ------------------------------------------------------ */}
      {/* the drip line off the roof, which is why nobody stands at the edge */}
      {wet ? (
        <g>
          <path
            d={pxPath([[BS.x0 - 2, BS_ROOF + 9, BS.x1 - BS.x0 + 2, 1]])}
            fill={K.waterHi}
            opacity={0.4}
          />
          <path
            d={pxPath(
              Array.from({ length: 6 }, (_, i) => [512 + i * 12, BS_ROOF + 10, 1, 5] as Rect),
            )}
            fill={K.waterHi}
            opacity={0.45}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 88"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* the patch somebody from the block sweeps without being asked */}
      {snow ? (
        <g>
          <path d={pxPath([[518, 150, 50, 6]])} fill={BSK.paint} opacity={0.2} />
          <path d={pxPath([[518, BS_SEAT - 2, 50, 2]])} fill={K.snow} />
        </g>
      ) : null}
      {/* and the splash, when it pulls in and soaks everybody waiting */}
      {coming && (wet || snow) ? (
        <g>
          <path d={pxPath(steppedEllipse(578, 158, 26, 6, 2))} fill={K.waterHi} opacity={0.35}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;0;0.35;0.5;0.2;0"
              dur="26s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d={pxPath([
              [562, 148, 3, 4],
              [570, 144, 2, 5],
              [582, 147, 3, 4],
              [588, 150, 2, 3],
            ])}
            fill={K.waterHi}
            opacity={0}
          >
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;0;0.6;0.3;0"
              dur="26s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * ONE CHANGE OUTSIDE THIS BLOCK — and it is a bug fix, not a feature.
 *
 * In Pavement, the puddle is drawn at x=655, but the `puddle` hitbox is at
 * x=578. Seventy-seven pixels apart: the art is under the paczkomat and the
 * hitbox is at the bus stop, so the thing you can interact with is not the thing
 * you can see. Move the art to the kerb, where it belongs and where the splash
 * above lands:
 *
 *        {/* the puddle that survives everything, and the ripple in it *\/}
 *        <path
 *          d={pxPath(steppedEllipse(578, 161, wet ? 22 : 15, wet ? 4 : 3, 2))}
 *          ...
 *        <path
 *          d={pxPath(steppedEllipse(576, 160, 9, 1, 1))}
 *          ...
 *
 * (655 → 578 on the first, 653 → 576 on the ripple. Nothing else changes; the
 * three wet-weather puddles at 240 / 760 / 1120 stay where they are.)
 *
 * NO ARTKEY CHANGE. This block reads only `s.bus`, `s.crowd`, `s.kosz`,
 * `s.weather`, `s.season` and `s.lamps`, all of which artKey already joins.
 *
 * OPTIONAL — the citylight as a light source. It is backlit and it is the
 * brightest thing between the klatka and the passage, so it earns a spill:
 *
 *        const SPILL_CITYLIGHT = spill(548, 570, 66, 14, "c", 0.4);
 *
 * and in StreetEffects, beside the other spills:
 *
 *        {lit ? <Light set={SPILL_CITYLIGHT} op={dark ? 1 : 0.2} /> : null}
 *
 * OPTIONAL — Heniek already reacts to `bus === "arriving"` by stepping forward.
 * If you want the beat to land harder, his fourth line ("O, jedzie. No proszę.
 * Cud na Słonecznej.") could be forced to the front of the queue on that stage
 * rather than left to the rotation.
 * ==================================================================== */

/* ==================================================================== *
 * PACZKOMAT — replacement block for street.tsx
 *
 * Drops in over Paczkomat. Module-scope geometry goes up with the other
 * PACZ_* constants. `PACZ_SET` is unchanged, and so are `STREET_CONTACT` and
 * `artKey` — this is the first of these blocks that needs nothing outside it.
 *
 * THE GOOD NEWS FROM THE AUDIT. The machine is 48 x 76 px, which is 1.26 x 2.00 m
 * — and 2.00 m is exactly right. The door pitch is 14 px, which is 0.37 m, and an
 * InPost locker face is 0.38 m wide. So the *module* was right. Whoever set this
 * out knew the dimension.
 *
 * WHAT WAS WRONG WAS THE ARRANGEMENT, in two ways:
 *
 *   1. EVERY LOCKER WAS THE SAME SIZE. All 18 were 9 px = 0.24 m, which is
 *      between an A (8 cm) and a B (19 cm), so it is neither. A real paczkomat is
 *      a *mixed* stack — A's at the top where a padded envelope goes, B's in the
 *      middle, C's (41 cm) at the bottom so nobody has to lift a big parcel down
 *      from head height. A uniform 6 x 3 grid reads as post-office pigeonholes,
 *      which is why it did not look like a paczkomat however yellow it was. The
 *      column is A, A, B, B, C, C now, top to bottom, which fits the 57 px of
 *      stack height available almost to the pixel.
 *
 *   2. THE SCREEN WAS INSIDE THE LOCKER GRID. On the real machine the terminal is
 *      its own bay: screen, barcode scanner, card reader and return slot stacked
 *      in a column beside the lockers, with the camera above. A screen with locker
 *      doors above and below it is not a thing that exists. There is a terminal
 *      bay now, on the left, and two locker columns beside it — which makes this a
 *      small machine, and a small machine is right for a passage between two
 *      blocks.
 *
 * THE STATE INSIGHT. `scanning` and `open` both mean a person is standing there
 * right now — you do not scan your own code and no locker opens by itself. The
 * old machine operated itself in an empty passage. Now `scanning` puts somebody
 * at the terminal with their hand on it, and `open` puts them at the locker with
 * their arm inside it, reaching the other way. Same person, mirrored.
 *
 * WHAT ELSE IS IN HERE
 *   – the weather canopy, because these get bolted to walls and rained on
 *   – the concrete pad it stands on, and the four bolts through its feet
 *   – the machine ID, GDA01, which every one of them carries and couriers quote
 *   – the barcode scanner window, the card reader for paid returns, the return
 *     slot, and the camera above the screen
 *   – the LED strip under the crown that lights the locker faces after dark
 *   – scratches round the two C lockers, because those are the ones that get
 *     used and kicked shut
 *   – a dent in the bottom corner from a shopping trolley
 *   – the courier's route label on the terminal bay, curling at one corner
 *   – gum on the pad and a peeled-off airway label nobody picked up
 *   – at `crowd >= 3`, the parcel somebody could not carry, left on the pad
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * geometry — put this with the other PACZ_* constants
 * -------------------------------------------------------------------- */

/** InPost yellows and the greys of the terminal bay. */
const PZ = {
  yellow: "#f5c518",
  yellowHi: "#fbe06a",
  yellowLo: "#d8a810",
  doorGloss: "#f8d84a",
  handle: "#8a6d2f",
  hinge: "#a3811f",
  bay: "#2b2a27",
  bayHi: "#3d3b37",
  case: "#3a3833",
  caseHi: "#4d4a45",
  canopy: "#4d4a45",
  canopyHi: "#63605a",
  pad: "#8d8478",
  padHi: "#9a9184",
  bolt: "#5d5a55",
  screenIdle: "#16283f",
  screenOk: "#123021",
  screenFrame: "#12161b",
  scanner: "#2a2f36",
  reader: "#4d5560",
  slot: "#1b2026",
  label: "#f2f2ee",
  labelRule: "#8a8578",
  parcel: "#c9a878",
  parcelTape: "#e8e2d2",
  scratch: "#c9a52e",
  dark: "#2e3033",
  ledStrip: "#fff0a8",
} as const;

/** The machine: 48 x 76 px, which is 1.26 x 2.00 m. Both correct as they were. */
const PZ_X0 = 618;
const PZ_X1 = 666;
const PZ_TOP = 74;
/** The terminal bay on the left, and two locker columns beside it. */
const PZ_BAY = { x: PZ_X0, w: 18 } as const;
const PZ_COLS = [638, 652] as const;
const PZ_DOOR_W = 12;
/**
 * A real column, top to bottom: two A's for envelopes, two B's, then two C's at
 * the bottom so nobody lifts a big parcel down from head height.
 * Heights are the real faces at 38 px/m: A = 3, B = 7, C = 16.
 */
const PZ_STACK: readonly { y: number; h: number; size: "A" | "B" | "C" }[] = [
  { y: 84, h: 3, size: "A" },
  { y: 88, h: 3, size: "A" },
  { y: 92, h: 7, size: "B" },
  { y: 100, h: 7, size: "B" },
  { y: 108, h: 16, size: "C" },
  { y: 125, h: 16, size: "C" },
];
/** The one that is open: the first C in the right column, so the parcel shows. */
const PZ_OPEN_COL = 1;
const PZ_OPEN_ROW = 4;

const PZ_CANOPY = pxPath([[PZ_X0 - 2, PZ_TOP - 5, PZ_X1 - PZ_X0 + 4, 5]]);
const PZ_CANOPY_HI = pxPath([[PZ_X0 - 2, PZ_TOP - 5, PZ_X1 - PZ_X0 + 4, 1]]);
/** The backlit crown, which is the only branding on it. */
const PZ_CROWN = pxPath([[PZ_X0, PZ_TOP, PZ_X1 - PZ_X0, 8]]);
const PZ_CROWN_HI = pxPath([[PZ_X0, PZ_TOP, PZ_X1 - PZ_X0, 1]]);
/** The LED strip under the crown that lights the locker faces after dark. */
const PZ_LED = pxPath([[PZ_X0 + 1, PZ_TOP + 8, PZ_X1 - PZ_X0 - 2, 1]]);
/** The terminal bay: screen, scanner, reader, return slot, camera. */
const PZ_BAY_FACE = pxPath([[PZ_BAY.x, 82, PZ_BAY.w, 62]]);
const PZ_CAMERA = pxPath([[625, 84, 4, 3]]);
const PZ_SCREEN_FRAME = pxPath([[619, 90, 16, 14]]);
const PZ_SCREEN = pxPath([[620, 91, 14, 12]]);
const PZ_SCANNER = pxPath([[620, 106, 14, 6]]);
const PZ_READER = pxPath([[622, 115, 11, 8]]);
const PZ_READER_SLOT = pxPath([[623, 117, 9, 2]]);
/** The wrzutnia — the return slot, which is the half of it nobody remembers. */
const PZ_RETURN = pxPath([[620, 127, 14, 5]]);
const PZ_RETURN_LIP = pxPath([[620, 127, 14, 1]]);
/** The courier's route label, curling at one corner. */
const PZ_LABEL = pxPath([[620, 135, 14, 8]]);
const PZ_LABEL_RULES = pxPath([
  [621, 137, 10, 1],
  [621, 140, 7, 1],
]);
const PZ_LABEL_CURL = pxPath([[631, 141, 3, 2]]);

/** The concrete pad, and the four bolts through the feet. */
const PZ_PAD = pxPath([[PZ_X0 - 4, 146, PZ_X1 - PZ_X0 + 8, 4]]);
const PZ_PAD_HI = pxPath([[PZ_X0 - 4, 146, PZ_X1 - PZ_X0 + 8, 1]]);
const PZ_BOLTS = pxPath([
  [PZ_X0 + 1, 144, 2, 2],
  [PZ_X1 - 3, 144, 2, 2],
]);
/** The dent a shopping trolley put in the bottom corner. */
const PZ_DENT = pxPath([
  [PZ_X0, 138, 4, 6],
  [PZ_X0, 141, 6, 3],
]);
/** Scratches round the two C lockers, which are the ones that get kicked shut. */
const PZ_SCRATCHES = pxPath([
  [636, 124, 5, 1],
  [650, 141, 6, 1],
  [664, 116, 1, 5],
]);
/** Gum on the pad, and an airway label nobody picked up. */
const PZ_LITTER = pxPath([
  [612, 148, 2, 2],
  [670, 147, 5, 3],
]);
/** At crowd 3, the parcel somebody could not carry, left standing on the pad. */
const PZ_ORPHAN = pxPath([
  [668, 132, 14, 14],
  [668, 132, 14, 2],
]);
const PZ_ORPHAN_TAPE = pxPath([
  [674, 132, 3, 14],
  [668, 138, 14, 2],
]);

/** The locker faces, precomputed per column so only the open one is skipped. */
const PZ_FACES = PZ_COLS.flatMap((cx, ci) =>
  PZ_STACK.map((d, ri) => ({ ci, ri, x: cx, y: d.y, h: d.h, size: d.size })),
);
const PZ_DOORS_ALL = pxPath(PZ_FACES.map((f) => [f.x, f.y, PZ_DOOR_W, f.h] as Rect));
/** The gloss line along the top of every door, which is what makes it plastic. */
const PZ_GLOSS_ALL = pxPath(PZ_FACES.map((f) => [f.x + 1, f.y + 1, PZ_DOOR_W - 3, 1] as Rect));
/** Handles: a pull recess on the A's, a proper grab on the B's and C's. */
const PZ_HANDLES_ALL = pxPath(
  PZ_FACES.map((f) =>
    f.size === "A"
      ? ([f.x + PZ_DOOR_W - 4, f.y + 1, 2, 1] as Rect)
      : ([f.x + PZ_DOOR_W - 4, f.y + Math.floor(f.h / 2) - 1, 2, 3] as Rect),
  ),
);
const PZ_HINGES_ALL = pxPath(
  PZ_FACES.filter((f) => f.size !== "A").map(
    (f) => [f.x, f.y + Math.floor(f.h / 2) - 1, 1, 3] as Rect,
  ),
);
/** And the same three, minus the door that is standing open. */
const PZ_isOpen = (f: { ci: number; ri: number }) => f.ci === PZ_OPEN_COL && f.ri === PZ_OPEN_ROW;
const PZ_DOORS_SHUT = pxPath(
  PZ_FACES.filter((f) => !PZ_isOpen(f)).map((f) => [f.x, f.y, PZ_DOOR_W, f.h] as Rect),
);
const PZ_GLOSS_SHUT = pxPath(
  PZ_FACES.filter((f) => !PZ_isOpen(f)).map((f) => [f.x + 1, f.y + 1, PZ_DOOR_W - 3, 1] as Rect),
);
const PZ_HANDLES_SHUT = pxPath(
  PZ_FACES.filter((f) => !PZ_isOpen(f)).map((f) =>
    f.size === "A"
      ? ([f.x + PZ_DOOR_W - 4, f.y + 1, 2, 1] as Rect)
      : ([f.x + PZ_DOOR_W - 4, f.y + Math.floor(f.h / 2) - 1, 2, 3] as Rect),
  ),
);
/** The open aperture, and the parcel sitting in the dark of it. */
const PZ_APERTURE = (() => {
  const f = PZ_FACES.find(PZ_isOpen) ?? PZ_FACES[0];
  return {
    hole: pxPath([[f.x, f.y, PZ_DOOR_W, f.h]]),
    parcel: pxPath([[f.x + 2, f.y + 5, PZ_DOOR_W - 5, f.h - 7]]),
    tape: pxPath([[f.x + 2, f.y + 8, PZ_DOOR_W - 5, 1]]),
    /** the leaf, swung back flat against the column beside it */
    leaf: pxPath([[f.x + PZ_DOOR_W, f.y, 3, f.h]]),
    y: f.y,
    h: f.h,
  };
})();

/* -------------------------------------------------------------------- *
 * the person, because scanning and open both mean somebody is here
 * -------------------------------------------------------------------- */

/**
 * Somebody at the paczkomat. `reach` is which way the arm goes: left for the
 * terminal, right into an open locker. It is the same person either way, which
 * is the point — one animation, mirrored.
 */
// function PaczkomatUser({ x, reach }: { x: number; reach: "left" | "right" }) {
//   const left = reach === "left";
//   return (
//     <g>
//       <g>
//         {/* head, and the hood up because it is a passage between two blocks */}
//         <path d={pxPath([[x + 1, 80, 14, 5]])} fill="#3a4148" />
//         <path d={pxPath([[x + 2, 85, 12, 10]])} fill={K.skin} />
//         <path d={pxPath([[x + 2, 91, 12, 4]])} fill={K.skinShade} />
//         <path
//           d={pxPath([
//             [x + 4, 87, 2, 2],
//             [x + 10, 87, 2, 2],
//           ])}
//           fill="#3d2a1a"
//         />
//         {/* the coat, and the bag over the far shoulder */}
//         <path d={pxPath([[x, 95, 16, 26]])} fill={K.hoodie} />
//         <path d={pxPath([[x, 95, 16, 2]])} fill="#56657a" />
//         <path
//           d={pxPath([[left ? x + 13 : x, 99, 4, 16]])}
//           fill={K.hoodieLo}
//         />
//         {/* the arm that does the work, out toward the machine */}
//         <path
//           d={pxPath([[left ? x - 5 : x + 16, 99, 5, 11]])}
//           fill={K.hoodie}
//         />
//         <path
//           d={pxPath([[left ? x - 7 : x + 20, 108, 5, 4]])}
//           fill={K.skin}
//         />
//         {/* jeans and trainers */}
//         <path
//           d={pxPath([
//             [x + 1, 121, 6, 24],
//             [x + 9, 121, 6, 24],
//           ])}
//           fill="#2a2f36"
//         />
//         <path
//           d={pxPath([
//             [x, 145, 8, 5],
//             [x + 8, 145, 8, 5],
//           ])}
//           fill="#8a8f96"
//         />
//         <path d={pxPath([[x, 145, 16, 1]])} fill="#aeb2b8" />
//         {/* the weight shift of somebody reading a screen they cannot rush */}
//         <animateTransform
//           attributeName="transform"
//           type="translate"
//           calcMode="discrete"
//           values="0 0;0 0;1 0;1 0;0 0;-1 0;0 0"
//           dur="10.6s"
//           repeatCount="indefinite"
//         />
//       </g>
//     </g>
//   );
// }

/* -------------------------------------------------------------------- *
 * the machine
 * -------------------------------------------------------------------- */

/** InPost paczkomat: 2.00 m of yellow certainty, and one door that opens. */
function Paczkomat({ ph, s }: { ph: Ph; s: StreetState }) {
  const open = s.paczkomat === "open";
  const scanning = s.paczkomat === "scanning";
  const dark = ph === "night" || ph === "dusk";
  const lit = lampsOn(s, ph);
  const snow = isSnow(s);
  return (
    <g>
      {/* the pad it is bolted to, and what has collected on it */}
      <path d={PZ_PAD} fill={PZ.pad} />
      <path d={PZ_PAD_HI} fill={PZ.padHi} />
      <path d={PZ_LITTER} fill={PZ.labelRule} opacity={0.6} />

      {/* the canopy, because these get bolted to walls and rained on */}
      <path d={PZ_CANOPY} fill={PZ.canopy} />
      <path d={PZ_CANOPY_HI} fill={PZ.canopyHi} />
      {snow ? (
        <path d={pxPath([[PZ_X0 - 2, PZ_TOP - 7, PZ_X1 - PZ_X0 + 4, 3]])} fill={K.snow} />
      ) : null}

      {/* the case */}
      <Bev set={PACZ_SET} mat={{ ...FRAME[ph], base: PZ.case, hi: PZ.caseHi }} />
      <path d={pxPath([[PZ_X1 - 4, 82, 4, 64]])} fill="#2e2c28" />
      <path d={PZ_BOLTS} fill={PZ.bolt} />
      <path d={PZ_DENT} fill="#2e2c28" />

      {/* the backlit crown, which is the only branding on it */}
      <path d={PZ_CROWN} fill={PZ.yellow} />
      <path d={PZ_CROWN_HI} fill={PZ.yellowHi} />
      <PixelText x={620} y={PZ_TOP + 2} text="PACZKOMAT" fill="#5a4408" gap={0} op={0.85} />
      {lit ? (
        <path d={PZ_CROWN} fill={PZ.yellowHi} opacity={0.18}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.18;0.18;0.18;0.08;0.18"
            dur="19s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the LED strip under it that lights the locker faces after dark */}
      {lit ? <path d={PZ_LED} fill={PZ.ledStrip} opacity={0.7} /> : null}

      {/* ---- the terminal bay: its own column, the way it really is -------- */}
      <path d={PZ_BAY_FACE} fill={PZ.bay} />
      <path d={pxPath([[PZ_BAY.x, 82, PZ_BAY.w, 1]])} fill={PZ.bayHi} />
      {/* the machine ID, which couriers quote down the phone */}
      <PixelText x={620} y={84} text="GDA01" fill={PZ.yellowLo} gap={0} op={0.8} />
      {/* the camera above the screen */}
      <path d={PZ_CAMERA} fill="#12161b" />
      <path d={pxPath([[627, 85, 1, 1]])} fill="#c9d8e0" opacity={0.8} />
      {/* the screen: idle prompt, a code going in, or OK */}
      <path d={PZ_SCREEN_FRAME} fill={PZ.screenFrame} />
      <path d={PZ_SCREEN} fill={open ? PZ.screenOk : PZ.screenIdle} />
      {open ? (
        <g>
          <PixelText x={623} y={94} text="OK" fill={K.led} />
          <path d={pxPath([[621, 99, 12, 1]])} fill={K.led} opacity={0.6} />
        </g>
      ) : scanning ? (
        <g>
          <PixelText x={622} y={94} text="1 2" fill={K.ledBlue} gap={0} />
          <path d={pxPath([[621, 99, 12, 1]])} fill={K.ledBlue}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.2;1"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : (
        <g>
          <PixelText x={623} y={94} text="12" fill={K.ledBlue} />
          <path d={pxPath([[621, 99, 12, 1]])} fill={K.ledBlue}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.2;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      )}
      {/* the barcode scanner window, and its red sweep */}
      <path d={PZ_SCANNER} fill={PZ.scanner} />
      <path d={pxPath([[621, 108, 3, 3]])} fill={K.ledRed} opacity={0.85}>
        <animate
          attributeName="x"
          calcMode="discrete"
          values="621;624;627;630;627;624"
          dur="3.6s"
          repeatCount="indefinite"
        />
      </path>
      {/* the card reader for paid returns, and the return slot under it */}
      <path d={PZ_READER} fill={PZ.reader} />
      <path d={PZ_READER_SLOT} fill="#22262c" />
      <path d={pxPath([[623, 121, 3, 1]])} fill={scanning ? K.led : "#5d656e"} />
      <path d={PZ_RETURN} fill={PZ.slot} />
      <path d={PZ_RETURN_LIP} fill={PZ.reader} />
      {/* the courier's route label, curling at one corner */}
      <path d={PZ_LABEL} fill={PZ.label} opacity={0.9} />
      <path d={PZ_LABEL_RULES} fill={PZ.labelRule} opacity={0.7} />
      <path d={PZ_LABEL_CURL} fill={PZ.bay} />

      {/* ---- the lockers: A, A, B, B, C, C, top to bottom ----------------- */}
      {open ? (
        <g>
          {/* the aperture, the leaf swung back, and the parcel in the dark */}
          <path d={PZ_APERTURE.hole} fill={PZ.dark} />
          <path d={PZ_APERTURE.parcel} fill={PZ.parcel} />
          <path d={PZ_APERTURE.tape} fill={PZ.parcelTape} />
          <path d={PZ_APERTURE.leaf} fill={PZ.yellowLo} />
          <path d={PZ_DOORS_SHUT} fill={PZ.yellow} />
          <path d={PZ_GLOSS_SHUT} fill={PZ.doorGloss} />
          <path d={PZ_HANDLES_SHUT} fill={PZ.handle} />
        </g>
      ) : (
        <g>
          <path d={PZ_DOORS_ALL} fill={PZ.yellow} />
          <path d={PZ_GLOSS_ALL} fill={PZ.doorGloss} />
          <path d={PZ_HANDLES_ALL} fill={PZ.handle} />
        </g>
      )}
      <path d={PZ_HINGES_ALL} fill={PZ.hinge} opacity={0.6} />
      {/* scratches round the two C's, which are the ones that get kicked shut */}
      <path d={PZ_SCRATCHES} fill={PZ.scratch} opacity={0.55} />
      {snow ? <path d={pxPath([[PZ_X0, PZ_TOP - 1, PZ_X1 - PZ_X0, 1]])} fill={K.snow} /> : null}

      {/* ---- and whoever is standing at it -------------------------------- *
       * `scanning` and `open` both mean a person is here: you do not scan your
       * own code and no locker opens by itself. Same figure, mirrored arm.     */}
      {/* {scanning ? <PaczkomatUser x={638} reach="left" /> : null}
      {open ? <PaczkomatUser x={634} reach="right" /> : null} */}
      {/* the parcel somebody could not carry, left standing on the pad */}
      {s.crowd >= 3 && !open ? (
        <g>
          <path d={PZ_ORPHAN} fill={PZ.parcel} />
          <path d={PZ_ORPHAN_TAPE} fill={PZ.parcelTape} opacity={0.85} />
        </g>
      ) : null}
      {/* the glow it puts on the pad, which is the only light in the passage */}
      {lit ? (
        <path
          d={pxPath(steppedEllipse(642, 152, 22, 5, 2))}
          fill={dth("w", "25")}
          opacity={dark ? 0.35 : 0.15}
        />
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * NOTHING TO CHANGE OUTSIDE THIS BLOCK
 *
 * `PACZ_SET` is still bevelPaths([[618, 74, 48, 76]]) and still correct — 1.26 x
 * 2.00 m. `STREET_CONTACT`'s [618, 48, CY] entry still spans the machine.
 * `artKey` already joins `s.paczkomat` and `s.crowd`. This is the first of these
 * blocks that is self-contained.
 *
 * THE LOCKER STACK, if you ever retune it. PZ_STACK holds the real InPost face
 * heights at 38 px/m — A = 3 px (8 cm), B = 7 px (19 cm), C = 16 px (41 cm) — with
 * 1 px between doors. The six of them plus gaps come to 57 px in the 60 px of
 * stack height between the crown and the base, so there is almost no slack: if
 * you add a locker, take one out.
 *
 * WHY TWO COLUMNS AND NOT THREE. 48 px of width is 1.26 m. The terminal bay needs
 * 18 px (0.47 m) and each locker column is a 14 px (0.37 m) module, so two
 * columns is what fits. That makes this one of the small machines, which is the
 * right one for a passage between two blocks — the big multi-bay ones go outside
 * shops. If you ever want three columns, the machine has to grow to 62 px, and
 * then PACZ_SET, the STREET_CONTACT span and the `planter` hitbox at 664..704 all
 * have to move with it.
 *
 * OPTIONAL — the crown as a light source. It is backlit and it is the only lit
 * thing in the passage, so it earns a proper spill instead of the pool drawn in
 * component:
 *
 *        const SPILL_PACZKOMAT = spill(618, 666, 74, 16, "w", 0.45);
 *
 * and in StreetEffects, beside the other spills:
 *
 *        {lit ? <Light set={SPILL_PACZKOMAT} op={dark ? 1 : 0.25} /> : null}
 * ==================================================================== */

/* ==================================================================== *
 * STREET FURNITURE — replacement block for street.tsx
 *
 * Drops in over Segregacja and StreetFurniture, and adds the six small
 * components they now delegate to. Module-scope geometry goes up with the other
 * furniture constants; the four old *_SET consts it supersedes are listed at the
 * foot of the file for deletion.
 *
 * FOUR DIMENSION FIXES, and one of them is the worst error in the scene.
 *
 *   1. TRZEPAK. The top bar was at y=112, which at 38 px/m is 1.00 m. You hang a
 *      carpet over a trzepak and beat it — at 1.00 m you would be beating it at
 *      knee height. The bar is at y=88 now, which is 1.63 m, and the frame is a
 *      metre wide instead of 0.84 m. It also gained the second rail every trzepak
 *      has and the concrete footings it stands in. This is the fix that changes
 *      how the whole middle of the street reads, because it is the tallest thing
 *      on the pavement between the bins and the bankomat.
 *
 *   2. BENCH. Seat at y=120 is 0.79 m — a bar stool, exactly the bug the bus
 *      stop had. Seat is 0.45 m (y=133), backrest top 0.85 m (y=118). The
 *      backrest was 1.37 m tall, which is a church pew.
 *
 *   3. WHEELIE BINS. 1.21 m to the lid; a 240-litre bin is 1.07 m. Lowered, and
 *      narrowed by nothing because 0.53 m was already right.
 *
 *   4. BIKE STANDS. 0.63 m, and a Sheffield stand is 0.75 m — which is also what
 *      the district scene uses, so the two scenes now agree.
 *
 * ONE THING THE BINS WERE MISSING. Three fractions. Poland collects four —
 * plastik i metal, papier, szkło, and BIO — and the brown one is the one every
 * estate got last and nobody wanted. There are four bins now, at a 20 px pitch
 * so they still fit between the paczkomat and the cat, and the fourth one is
 * brown and says so.
 *
 * NO NEW WORLD READS. `s.bins`, `s.binOpen`, `s.kosz`, `s.bikes`, `s.trzepak`,
 * `s.zabka`, `s.crowd`, `s.season`, `s.weather`, `s.lamps` — all already joined.
 * **artKey does not change.**
 *
 * WHAT ELSE IS IN HERE
 *   – a wiata: the fenced enclosure the bins stand in, with a carrier bag caught
 *     on the upwind post and flapping
 *   – the collection schedule laminated to the wall above them, which is the only
 *     document on this street anybody has ever actually needed
 *   – flattened cardboard leaned against the papier bin, a crate of bottles by
 *     the szkło bin, and at `bins === 3` the gabaryty: a broken chair on the
 *     pavement, because bulky-waste day is the first Saturday and this is not it
 *   – chipped RFID stickers and the administration's stencilled 14 on every bin
 *   – an anti-lying divider in the middle of the bench, because that is what
 *     councils do now, and the worn patch of pavement in front of it
 *   – the trzepak's paint worn to bare metal exactly where carpets rub, rust runs
 *     down both posts, and chalk on the concrete because kids use it as a goal
 *   – a cut lock left hanging on the bike rack and a bent hoop
 *   – the post box's rain hood over the slot and its collection-times plate
 *   – the cabinet's cable gland, its warning triangle, and a status LED you can
 *     just see through the vent slots
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * palette and geometry — put this with the other furniture constants
 * -------------------------------------------------------------------- */

/** Furniture colours. Municipal, which means green, grey and whatever was left. */
const FK = {
  /** the four fractions, in the order the law lists them */
  plastik: "#d9b93c",
  plastikLid: "#b89c2e",
  plastikHi: "#f0d05a",
  papier: "#4a90d9",
  papierLid: "#3a7cbf",
  papierHi: "#66a8ed",
  szklo: "#5f7a63",
  szkloLid: "#4d6350",
  szkloHi: "#749279",
  bio: "#8a6a3a",
  bioLid: "#6d5230",
  bioHi: "#a3814a",
  binDark: "#26282c",
  chip: "#d8d3c2",
  stencil: "#ffffff",
  wiata: "#7a8084",
  wiataHi: "#949aa0",
  bag: "#2e3033",
  bagHi: "#43474c",
  cardboard: "#b08a5e",
  cardboardLo: "#8a6a44",
  bottleHi: "#8fae94",
  chair: "#8a623f",
  chairLo: "#6b4a2f",
  schedule: "#f2f2ee",
  scheduleRule: "#8a8578",
  /** the bench: cast-iron ends, timber slats */
  iron: "#3a3d43",
  ironHi: "#4d5158",
  slat: "#8a623f",
  slatHi: "#a1794f",
  slatLo: "#6b4a2f",
  worn: "#a8a59d",
  /** the trzepak: galvanised, and worn to bare metal where the carpets go */
  galv: "#8f8a7c",
  galvHi: "#a39e90",
  galvBare: "#c2beb4",
  rust: "#9a7a58",
  footing: "#8d8478",
  chalkMark: "#e8e2d2",
  /** the bin, the rack, the box, the cabinet */
  kosz: "#4d6350",
  koszHi: "#5f7a63",
  koszLo: "#3f5244",
  liner: "#d9d3c2",
  burn: "#2a2a28",
  rackSteel: "#9aa0a8",
  lockBlue: "#2b5aa8",
  post: "#b03a2c",
  postHi: "#c9503f",
  postLo: "#7a281e",
  trumpet: "#f0d8d0",
  cab: "#8a9099",
  cabHi: "#a3a9b2",
  cabDoor: "#7a8086",
  warn: "#e8c445",
  ledGreen: "#3ddc84",
} as const;

/* --- SEGREGACJA: four bins, in a fenced enclosure --- */
const SG_X = 688;
const SG_PITCH = 20;
const SG_W = 18;
const SG_TOP = 110; // 1.05 m to the lid, which is what a 240 L bin is
const SG_BODY_H = 32;
/** The wiata: the enclosure the bins live in, and its top rail. */
const SG_WIATA_POSTS = pxPath([
  [684, 96, 3, GROUND - 96],
  [768, 96, 3, GROUND - 96],
]);
const SG_WIATA_RAIL = pxPath([
  [684, 96, 87, 3],
  [684, 120, 87, 2],
]);
/** The carrier bag caught on the upwind post, which has been there for weeks. */
const SG_SNAG = pxPath([
  [680, 104, 6, 8],
  [682, 112, 3, 5],
]);
/** The collection schedule, laminated to the wall, and read by everybody. */
const SG_SCHEDULE = pxPath([[700, 80, 26, 14]]);
const SG_SCHEDULE_HEAD = pxPath([[700, 80, 26, 3]]);
const SG_SCHEDULE_GRID = pxPath([
  ...repeat(4, 3, [702, 85, 22, 1] as Rect, "y"),
  [708, 84, 1, 9],
  [716, 84, 1, 9],
]);
/** Flattened cardboard leaned on the papier bin, which is where it always goes. */
const SG_CARDBOARD = pxPath([[703, 116, 7, 26]]);
/** A crate of bottles beside the szkło bin, because the bin is full of bottles. */
const SG_CRATE = pxPath([[729, 134, 15, 9]]);
const SG_CRATE_TOPS = pxPath(bank([[731, 131, 2, 3]], 5, 3));
/** Gabaryty. Bulky-waste day is the first Saturday and this is not it. */
/** Leaning on the enclosure post, over the bag, because that is how a dumped
 *  chair ends up — not standing neatly on the pavement inside the paczkomat. */
const SG_CHAIR = pxPath([
  [666, 118, 16, 4],
  [667, 122, 3, 11],
  [678, 122, 3, 11],
  [678, 106, 4, 13],
]);
const SG_BAG = pxPath([
  [670, 132, 16, 18],
  [674, 128, 8, 5],
]);

/* --- POST BOX --- */
const PB_BOX = bevelPaths([[276, 104, 18, 26]]);
/** The slot, and the rain hood over it, which is the shape you recognise. */
const PB_HOOD = pxPath([[277, 109, 16, 3]]);
const PB_SLOT = pxPath([[279, 112, 12, 2]]);
const PB_TRUMPET = pxPath([
  [280, 118, 8, 2],
  [279, 116, 2, 4],
  [287, 115, 2, 3],
  [285, 120, 3, 2],
]);
/** The collection-times plate, which says 15:00 and has done for years. */
const PB_PLATE = pxPath([[279, 123, 12, 5]]);
const PB_FIXINGS = pxPath([
  [275, 107, 2, 2],
  [293, 107, 2, 2],
  [275, 126, 2, 2],
  [293, 126, 2, 2],
]);
const PB_RUST = pxPath([[276, 127, 18, 3]]);

/* --- SANDWICH BOARD --- */
const SB_OUT = bevelPaths([[296, 112, 18, 34]]);
const SB_CHALK = pxPath([
  [299, 118, 12, 2],
  [299, 122, 9, 2],
  [299, 136, 11, 1],
  [299, 139, 7, 1],
]);
const SB_BASE = pxPath([[294, 146, 22, 3]]);
const SB_FOLDED = pxPath([[298, 106, 8, 44]]);
const SB_CHAIN = pxPath([[296, 136, 12, 2]]);

/* --- BENCH: seat at 0.45 m, back at 0.85 m --- */
const BN_X0 = 780;
const BN_X1 = 832;
const BN_SEAT = 133;
const BN_BACK = 118;
/** Cast-iron end frames, which is what a municipal bench actually stands on. */
const BN_ENDS = bevelPaths([
  [BN_X0, BN_BACK, 4, GROUND - BN_BACK],
  [BN_X1 - 4, BN_BACK, 4, GROUND - BN_BACK],
]);
const BN_SEAT_SLATS = pxPath([
  [BN_X0, BN_SEAT, 52, 3],
  [BN_X0, BN_SEAT + 4, 52, 3],
]);
const BN_SEAT_HI = pxPath([
  [BN_X0, BN_SEAT, 52, 1],
  [BN_X0, BN_SEAT + 4, 52, 1],
]);
const BN_BACK_SLATS = pxPath([
  [BN_X0 + 2, BN_BACK, 48, 3],
  [BN_X0 + 2, BN_BACK + 5, 48, 3],
  [BN_X0 + 2, BN_BACK + 10, 48, 3],
]);
const BN_BACK_HI = pxPath([
  [BN_X0 + 2, BN_BACK, 48, 1],
  [BN_X0 + 2, BN_BACK + 5, 48, 1],
]);
/** The anti-lying divider, because that is what councils do now. */
const BN_DIVIDER = pxPath([
  [804, BN_SEAT - 7, 4, 8],
  [803, BN_SEAT - 9, 6, 2],
]);
/** Initials carved into the third slat, and the gum under the seat. */
const BN_CARVED = pxPath([
  [806, BN_SEAT + 1, 1, 2],
  [808, BN_SEAT + 1, 1, 2],
  [807, BN_SEAT + 2, 1, 1],
]);
const BN_GUM = pxPath([
  [794, BN_SEAT + 8, 3, 2],
  [816, BN_SEAT + 9, 2, 2],
]);
/** The pavement worn pale in front of it by everybody's heels. */
const BN_WORN = pxPath([[782, 150, 48, 7]]);

/* --- KOSZ: rim at 1.05 m --- */
const KZ_BODY = bevelPaths([[845, 114, 18, 22]]);
const KZ_RIM = pxPath([[843, 112, 22, 3]]);
const KZ_ASH = pxPath([[846, 110, 5, 2]]);
const KZ_POST = pxPath([[852, 136, 4, 14]]);
const KZ_BASE = pxPath([[848, 146, 12, 4]]);
const KZ_LINER = pxPath([[846, 115, 16, 3]]);
const KZ_BURNS = pxPath([
  [849, 112, 2, 2],
  [857, 113, 2, 1],
]);

/* --- BIKE RACK: Sheffield stands at 0.75 m --- */
const BR_HOOPS = pxPath(bank([[872, GROUND - m(0.75), 2, m(0.75)]], 4, 12));
const BR_RAIL = pxPath([[870, GROUND - m(0.75), 46, 2]]);
const BR_FOOTINGS = pxPath(bank([[870, 146, 6, 4]], 4, 12));
/** The one that never moves: flat tyre, rusted chain, and a ghost where a wheel was. */
const BR_DEAD = {
  tyre: pxPath([[874, 130, 13, 13]]),
  hub: pxPath([[877, 133, 7, 7]]),
  flat: pxPath([[874, 141, 13, 3]]),
  rust: pxPath([[873, 126, 4, 4]]),
};
/** A lock somebody cut and left hanging, which is how you know a bike went. */
const BR_CUTLOCK = pxPath([
  [892, 128, 3, 9],
  [892, 135, 7, 3],
  [897, 130, 2, 5],
]);

/* --- TRZEPAK: top bar at 1.63 m, which is the height you beat a carpet at --- */
const TZ_X0 = 940;
const TZ_X1 = 981;
const TZ_TOP = 88;
const TZ_MID = 112;
const TZ_FRAME = pxPath([
  [TZ_X0, TZ_TOP, 3, GROUND - TZ_TOP],
  [TZ_X1 - 3, TZ_TOP, 3, GROUND - TZ_TOP],
  [TZ_X0, TZ_TOP, TZ_X1 - TZ_X0, 3],
  [TZ_X0, TZ_MID, TZ_X1 - TZ_X0, 2],
]);
const TZ_FRAME_HI = pxPath([[TZ_X0, TZ_TOP, TZ_X1 - TZ_X0, 1]]);
/** Worn to bare metal exactly where thirty years of carpets have rubbed. */
const TZ_BARE = pxPath([
  [948, TZ_TOP, 12, 3],
  [966, TZ_TOP, 9, 3],
]);
/** Rust running down both posts from the top welds. */
const TZ_RUST = pxPath([
  [TZ_X0, TZ_TOP + 4, 2, 14],
  [TZ_X1 - 3, TZ_TOP + 6, 2, 10],
  [TZ_X0, 132, 3, 14],
]);
const TZ_FOOTINGS = pxPath([
  [TZ_X0 - 3, 144, 9, 6],
  [TZ_X1 - 6, 144, 9, 6],
]);
/** Chalk on the concrete, because a trzepak is also a goal. */
const TZ_CHALK = pxPath([
  [936, 156, 22, 1],
  [936, 156, 1, 6],
  [957, 156, 1, 6],
]);
const TZ_RUG = pxPath([[944, TZ_TOP + 3, 33, 34]]);
const TZ_RUG_BANDS = pxPath([
  [944, TZ_TOP + 7, 33, 2],
  [944, TZ_TOP + 15, 33, 2],
  [944, TZ_TOP + 23, 33, 2],
]);

/* --- TELECOM CABINET --- */
const CB_BODY = bevelPaths([[1026, 104, 24, 44]]);
const CB_DOOR = pxPath([[1028, 106, 20, 40]]);
const CB_VENTS = pxPath(repeat(4, 4, [1030, 110, 16, 2] as Rect, "y"));
const CB_LOCK = pxPath([[1044, 124, 3, 5]]);
const CB_LABEL = pxPath([[1030, 132, 12, 6]]);
const CB_GLAND = pxPath([[1032, 146, 12, 4]]);
const CB_STICKERS = pxPath([
  [1030, 140, 8, 5],
  [1040, 141, 6, 4],
]);
/** The warning triangle, which is on every one of these in the country. */
const CB_WARN = pxPath([
  [1042, 108, 6, 2],
  [1043, 110, 4, 2],
  [1044, 112, 2, 2],
]);

/* --- COUNCIL SIGN at the square end --- */
const CS_POST = pxPath([[1236, 96, 4, GROUND - 96]]);
const CS_PLATE = bevelPaths([[1224, 84, 46, 14]]);
const CS_ARROW = pxPath([
  [1258, 89, 9, 3],
  [1264, 87, 3, 7],
]);
const CS_PLATE2 = pxPath([[1230, 100, 34, 8]]);

/* -------------------------------------------------------------------- *
 * components
 * -------------------------------------------------------------------- */

/** Four fractions, in a fenced enclosure, in the order the law lists them. */
function Segregacja({ ph, s }: { ph: Ph; s: StreetState }) {
  const over = s.bins >= 3;
  const snow = isSnow(s);
  const bins: Array<{ body: string; lid: string; hi: string; label?: string }> = [
    { body: FK.plastik, lid: FK.plastikLid, hi: FK.plastikHi },
    { body: FK.papier, lid: FK.papierLid, hi: FK.papierHi },
    { body: FK.szklo, lid: FK.szkloLid, hi: FK.szkloHi },
    { body: FK.bio, lid: FK.bioLid, hi: FK.bioHi, label: "BIO" },
  ];
  return (
    <g>
      {/* the enclosure, which is what the bins are supposed to stand inside */}
      <path d={SG_WIATA_POSTS} fill={FK.wiata} />
      <path d={SG_WIATA_RAIL} fill={FK.wiata} />
      <path d={pxPath([[684, 96, 87, 1]])} fill={FK.wiataHi} />
      {/* the carrier bag caught on the upwind post, there for weeks */}
      <g>
        <path d={SG_SNAG} fill={FK.liner} opacity={0.8} />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 684 104;6 684 104;-3 684 104;4 684 104;0 684 104"
          dur="3.7s"
          repeatCount="indefinite"
        />
      </g>
      {/* the collection schedule, the only document here anybody has needed */}
      <path d={SG_SCHEDULE} fill={FK.schedule} />
      <path d={SG_SCHEDULE_HEAD} fill={FK.papierLid} />
      <path d={SG_SCHEDULE_GRID} fill={FK.scheduleRule} opacity={0.6} />

      {bins.map((b, i) => {
        const bx = SG_X + i * SG_PITCH;
        const lifted = i === 0 && s.binOpen;
        const lidY = over ? SG_TOP - 4 : SG_TOP;
        return (
          <g key={b.body}>
            <Bevel
              boxes={[[bx, SG_TOP + 3, SG_W, SG_BODY_H]]}
              mat={{ hi: b.hi, base: b.body, mid: b.lid, lo: b.lid, deep: b.lid }}
            />
            {/* the two mouldings every wheelie bin has across its front */}
            <path
              d={pxPath([
                [bx + 2, SG_TOP + 9, SG_W - 4, 2],
                [bx + 2, SG_TOP + 22, SG_W - 4, 2],
              ])}
              fill={b.lid}
            />
            {/* the fraction label, and the pictogram nobody looks at */}
            <path d={pxPath([[bx + 3, SG_TOP + 13, 12, 8]])} fill="#00000022" />
            <path d={pxPath([[bx + 5, SG_TOP + 15, 4, 3]])} fill={b.body} />
            {b.label ? (
              <PixelText
                x={bx + 4}
                y={SG_TOP + 26}
                text={b.label}
                fill={FK.stencil}
                gap={1}
                op={0.6}
              />
            ) : (
              <PixelText x={bx + 5} y={SG_TOP + 26} text="14" fill={FK.stencil} gap={1} op={0.45} />
            )}
            {/* the chipped RFID sticker the council put on in 2021 */}
            <path d={pxPath([[bx + 13, SG_TOP + 7, 3, 3]])} fill={FK.chip} opacity={0.8} />
            {lifted ? (
              <g>
                {/* the lid up against the fence, and what is actually in there */}
                <path d={pxPath([[bx - 3, SG_TOP - 18, 24, 5]])} fill={b.lid} />
                <path d={pxPath([[bx - 3, SG_TOP - 18, 24, 1]])} fill={b.hi} />
                <path d={pxPath([[bx + 1, SG_TOP - 5, SG_W - 2, 8]])} fill="#2e3033" />
                <path
                  d={pxPath([
                    [bx + 3, SG_TOP - 3, 5, 5],
                    [bx + 9, SG_TOP - 2, 6, 4],
                    [bx + 6, SG_TOP - 4, 4, 3],
                  ])}
                  fill="#aebfc9"
                />
              </g>
            ) : (
              <g>
                <path d={pxPath([[bx - 2, lidY, 22, 4]])} fill={b.lid} />
                <path d={pxPath([[bx - 2, lidY, 22, 1]])} fill={b.hi} />
                <path d={pxPath([[bx + 17, lidY + 2, 3, 3]])} fill={STEEL[ph].lo} />
                {/* full: the lid will not sit down and there is paper in the gap */}
                {s.bins >= 2 ? (
                  <path
                    d={pxPath([
                      [bx + 2, lidY + 1, 7, 5],
                      [bx + 10, lidY + 2, 6, 4],
                    ])}
                    fill={FK.liner}
                  />
                ) : null}
              </g>
            )}
            {/* the wheels, and the axle you can see between them */}
            <path
              d={pxPath([
                [bx + 2, 142, 5, 8],
                [bx + 11, 142, 5, 8],
              ])}
              fill={FK.binDark}
            />
            <path d={pxPath([[bx + 6, 144, 6, 2]])} fill={STEEL[ph].deep} />
            {snow ? <path d={pxPath([[bx - 2, lidY - 1, 22, 2]])} fill={K.snow} /> : null}
          </g>
        );
      })}

      {/* flattened cardboard on the papier bin, and bottles by the szkło one */}
      <path d={SG_CARDBOARD} fill={FK.cardboard} />
      <path d={pxPath([[703, 116, 7, 2]])} fill={FK.cardboardLo} />
      <path d={SG_CRATE} fill={FK.papierLid} />
      <path d={SG_CRATE_TOPS} fill={FK.bottleHi} />
      <path d={pxPath([[729, 134, 15, 1]])} fill={FK.papierHi} />

      {/* the gabaryty, because bulky-waste day is the first Saturday */}
      {over ? (
        <g>
          <path d={SG_BAG} fill={FK.bag} />
          <path d={pxPath([[670, 132, 16, 2]])} fill={FK.bagHi} />
          <path d={SG_CHAIR} fill={FK.chair} />
          <path d={pxPath([[666, 118, 16, 1]])} fill={FK.slatHi} />
          <path d={pxPath([[678, 106, 4, 2]])} fill={FK.chairLo} />
        </g>
      ) : null}
      {/* emptied at dawn: lids square, and one wrapper left behind */}
      {s.bins === 0 ? <path d={pxPath([[766, 147, 4, 2]])} fill={FK.liner} /> : null}
      {/* the crow that works this enclosure and knows the schedule better than we do */}
      {s.bins >= 2 && ph !== "night" ? (
        <g>
          <path
            d={pxPath([
              [770, SG_TOP - 8, 10, 5],
              [779, SG_TOP - 11, 5, 4],
            ])}
            fill="#22201e"
          />
          <path d={pxPath([[783, SG_TOP - 10, 2, 1]])} fill="#4a4438" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            calcMode="discrete"
            values={`0 775 ${SG_TOP - 3};0 775 ${SG_TOP - 3};22 775 ${SG_TOP - 3};0 775 ${SG_TOP - 3}`}
            dur="3.1s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
    </g>
  );
}

/** The bench. Seat at 0.45 m this time, on cast-iron ends. */
function Bench({ ph, s }: { ph: Ph; s: StreetState }) {
  const snow = isSnow(s);
  return (
    <g>
      <path d={BN_WORN} fill={FK.worn} opacity={0.45} />
      <Bev set={BN_ENDS} mat={{ ...STEEL[ph], base: FK.iron, hi: FK.ironHi }} />
      <path d={BN_BACK_SLATS} fill={FK.slat} />
      <path d={BN_BACK_HI} fill={FK.slatHi} />
      <path d={BN_SEAT_SLATS} fill={FK.slat} />
      <path d={BN_SEAT_HI} fill={FK.slatHi} />
      <path d={pxPath([[BN_X0, BN_SEAT + 7, 52, 1]])} fill={FK.slatLo} />
      {/* the anti-lying divider, because that is what councils do now */}
      <path d={BN_DIVIDER} fill={FK.iron} />
      <path d={pxPath([[803, BN_SEAT - 9, 6, 1]])} fill={FK.ironHi} />
      <path d={BN_CARVED} fill={FK.slatLo} />
      <path d={BN_GUM} fill="#6d6a62" opacity={0.8} />
      <path d={pxPath([[794, 147, 3, 2]])} fill={K.bagRed} />
      {/* leaves land on a bench before they land anywhere else */}
      {s.season === "autumn" ? (
        <path
          d={pxPath([
            [788, BN_SEAT - 2, 3, 2],
            [818, BN_SEAT - 2, 2, 2],
            [826, BN_BACK - 2, 3, 2],
          ])}
          fill={K.leafDry}
        />
      ) : null}
      {snow ? (
        <path
          d={pxPath([
            [BN_X0, BN_SEAT - 2, 52, 2],
            [BN_X0 + 2, BN_BACK - 2, 48, 2],
          ])}
          fill={K.snow}
        />
      ) : null}
    </g>
  );
}

/** The litter bin, rim at 1.05 m, filling like everything else on this street. */
function Kosz({ ph, s }: { ph: Ph; s: StreetState }) {
  return (
    <g>
      <path d={KZ_POST} fill={STEEL[ph].lo} />
      <path d={KZ_BASE} fill={STEEL[ph].deep} />
      <Bev set={KZ_BODY} mat={{ ...HEDGE[ph], base: FK.kosz, hi: FK.koszHi }} />
      <path d={pxPath([[847, 116, 2, 18]])} fill={FK.koszHi} />
      <path d={KZ_RIM} fill={FK.koszLo} />
      {/* the liner bag lip, tucked over the rim the way they always are */}
      <path d={KZ_LINER} fill={FK.liner} opacity={0.75} />
      {/* the ashtray on top, and the burns round it */}
      <path d={KZ_ASH} fill="#3a3a38" />
      <path d={KZ_BURNS} fill={FK.burn} opacity={0.7} />
      {s.kosz >= 1 ? (
        <path
          d={pxPath([
            [848, 108, 6, 5],
            [854, 106, 5, 6],
          ])}
          fill={FK.liner}
        />
      ) : null}
      {s.kosz >= 2 ? (
        <g>
          <path d={pxPath([[851, 104, 4, 4]])} fill={FK.papier} />
          <path d={pxPath([[858, 105, 4, 4]])} fill={K.bagRed} />
          <path d={pxPath([[864, 148, 5, 2]])} fill={FK.liner} />
        </g>
      ) : null}
      {isSnow(s) ? <path d={pxPath([[843, 111, 22, 2]])} fill={K.snow} /> : null}
    </g>
  );
}

/** Sheffield stands at 0.75 m, which is what the district scene uses too. */
function BikeRack({ ph, s }: { ph: Ph; s: StreetState }) {
  return (
    <g>
      <path d={BR_FOOTINGS} fill={FK.footing} opacity={0.6} />
      <path d={BR_HOOPS} fill={FK.rackSteel} />
      <path d={BR_RAIL} fill={FK.rackSteel} />
      <path d={pxPath([[870, GROUND - m(0.75), 46, 1]])} fill={STEEL[ph].hi} />
      {/* the bent hoop, which somebody reversed into and nobody replaced */}
      <path d={pxPath([[908, GROUND - m(0.75) + 2, 2, 6]])} fill={FK.rackSteel} />
      {/* the one that never moves: flat tyre, rusted chain, one wheel and a ghost */}
      <path d={BR_DEAD.tyre} fill="#22201e" />
      <path d={BR_DEAD.hub} fill={STEEL[ph].lo} />
      <path d={BR_DEAD.flat} fill="#1a1917" />
      <path d={BR_DEAD.rust} fill={FK.rust} />
      {s.bikes >= 2 ? (
        <g>
          <path d={pxPath([[890, 130, 13, 13]])} fill="#22201e" />
          <path d={pxPath([[893, 133, 7, 7]])} fill={STEEL[ph].lo} />
          <path d={pxPath([[882, 124, 14, 7]])} fill="#7a3b35" />
          <path d={pxPath([[880, 122, 6, 3]])} fill="#22201e" />
        </g>
      ) : (
        /* no bike: just the lock somebody cut and left hanging on the hoop */
        <path d={BR_CUTLOCK} fill={FK.lockBlue} />
      )}
      {s.bikes >= 3 ? (
        <g>
          <path d={pxPath([[902, 136, 8, 8]])} fill="#22201e" />
          <path d={pxPath([[906, 131, 10, 6]])} fill="#d478a8" />
          <path d={pxPath([[908, 128, 4, 4]])} fill={K.cream} />
          {/* and the child seat on the back of it */}
          <path d={pxPath([[898, 124, 7, 6]])} fill="#3a4650" />
        </g>
      ) : null}
      {isSnow(s) ? <path d={pxPath([[870, GROUND - m(0.75) - 1, 46, 2]])} fill={K.snow} /> : null}
    </g>
  );
}

/**
 * The trzepak. Top bar at 1.63 m, because that is the height you beat a carpet
 * at — it was at 1.00 m, which would have you doing it on your knees.
 */
function Trzepak({ s }: { ph: Ph; s: StreetState }) {
  const beating = s.trzepak === "beating";
  return (
    <g>
      <path d={TZ_CHALK} fill={FK.chalkMark} opacity={0.4} />
      <path d={TZ_FOOTINGS} fill={FK.footing} />
      <path d={TZ_FRAME} fill={FK.galv} />
      <path d={TZ_FRAME_HI} fill={FK.galvHi} />
      {/* worn to bare metal exactly where thirty years of carpets have rubbed */}
      <path d={TZ_BARE} fill={FK.galvBare} />
      <path d={TZ_RUST} fill={FK.rust} opacity={0.75} />
      {s.trzepak !== "bare" ? (
        <g>
          <path d={TZ_RUG} fill="#8a3a34" />
          <path d={TZ_RUG_BANDS} fill="#c9a24b" />
          <path d={pxPath([[944, TZ_TOP + 3, 33, 1]])} fill="#a34a3a" />
          <path d={pxPath([[944, TZ_TOP + 35, 33, 2]])} fill="#6d2c28" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={
              beating
                ? `0 960 ${TZ_TOP + 3};7 960 ${TZ_TOP + 3};-5 960 ${TZ_TOP + 3};4 960 ${TZ_TOP + 3};0 960 ${TZ_TOP + 3}`
                : `0 960 ${TZ_TOP + 3};1.6 960 ${TZ_TOP + 3};-1.2 960 ${TZ_TOP + 3};0 960 ${TZ_TOP + 3}`
            }
            dur={beating ? "1.1s" : "6.8s"}
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* the dust, which is the entire point of a trzepak */}
      {beating ? (
        <path
          d={pxPath(steppedEllipse(960, TZ_TOP + 20, 26, 16, 3))}
          fill={dth("n", "12")}
          opacity={0.4}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.4;0.14;0.38;0.18;0.4"
            dur="1.1s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {isSnow(s) ? (
        <path d={pxPath([[TZ_X0, TZ_TOP - 1, TZ_X1 - TZ_X0, 2]])} fill={K.snow} />
      ) : null}
    </g>
  );
}

/** The telecom cabinet, with its stickers, its dent and its little green LED. */
function Cabinet({ ph, s }: { ph: Ph; s: StreetState }) {
  return (
    <g>
      <Bev set={CB_BODY} mat={{ ...STEEL[ph], base: FK.cab, hi: FK.cabHi }} />
      <path d={CB_DOOR} fill={FK.cabDoor} />
      <path d={pxPath([[1028, 106, 20, 1]])} fill={FK.cabHi} />
      <path d={CB_VENTS} fill="#5d636a" />
      {/* the status LED you can just see through the second vent slot */}
      <path d={pxPath([[1042, 118, 2, 2]])} fill={FK.ledGreen} opacity={0.7}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.7;0.7;0.25;0.7"
          dur="5.3s"
          repeatCount="indefinite"
        />
      </path>
      <path d={CB_LOCK} fill={STEEL[ph].deep} />
      <path d={CB_WARN} fill={FK.warn} opacity={0.85} />
      <path d={CB_LABEL} fill={FK.schedule} opacity={0.7} />
      <path d={pxPath(repeat(2, 3, [1031, 134, 10, 1] as Rect, "y"))} fill={FK.scheduleRule} />
      <path d={CB_STICKERS} fill="#a33a30" opacity={0.8} />
      <path d={CB_GLAND} fill="#6d737a" />
      {/* the dent in the bottom corner from whatever reversed into it */}
      <path d={pxPath([[1026, 142, 5, 4]])} fill="#6d737a" />
      {isSnow(s) ? <path d={pxPath([[1026, 103, 24, 2]])} fill={K.snow} /> : null}
    </g>
  );
}

function StreetFurniture({ ph, s }: { ph: Ph; s: StreetState }) {
  const snow = isSnow(s);
  const lit = lampsOn(s, ph);
  return (
    <g>
      {/* ---- the post box, its rain hood and its collection plate ---------- */}
      <Bev set={PB_BOX} mat={{ ...FRAME[ph], base: FK.post, hi: FK.postHi }} />
      <path d={pxPath([[278, 106, 14, 3]])} fill={FK.postLo} />
      <path d={PB_HOOD} fill={FK.postLo} />
      <path d={PB_SLOT} fill="#2a1a16" />
      {/* the Poczta Polska trumpet, which is what is actually on the box */}
      <path d={PB_TRUMPET} fill={FK.trumpet} opacity={0.75} />
      {/* the collection-times plate, which has said the same thing for years */}
      <path d={PB_PLATE} fill={FK.schedule} opacity={0.85} />
      <path d={pxPath([[281, 125, 8, 1]])} fill={FK.scheduleRule} />
      <path d={PB_FIXINGS} fill={STEEL[ph].deep} opacity={0.7} />
      <path d={PB_RUST} fill={FK.rust} opacity={0.5} />
      {snow ? <path d={pxPath([[276, 103, 18, 2]])} fill={K.snow} /> : null}

      {/* ---- the sandwich board: out while the shop is open ---------------- */}
      {s.zabka !== "closed" ? (
        <g>
          <Bev set={SB_OUT} mat={{ ...FRAME[ph], base: K.cream, hi: "#f4f0e4" }} />
          <path d={pxPath([[296, 112, 18, 3]])} fill={ZAB_M[ph].base} />
          <path d={pxPath([[314, 114, 3, 32]])} fill="#c9c4b6" />
          <path d={SB_CHALK} fill={ZAB_M[ph].base} opacity={0.8} />
          <path d={pxPath([[299, 128, 13, 6]])} fill={K.bagRed} />
          <path d={pxPath([[300, 130, 5, 2]])} fill={K.white} />
          <path d={SB_BASE} fill="#c9c4b6" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 305 148;0 305 148;1.5 305 148;-1 305 148;0 305 148"
            dur="17s"
            repeatCount="indefinite"
          />
        </g>
      ) : (
        /* folded flat and chained to the downpipe for the night */
        <g>
          <path d={SB_FOLDED} fill={K.cream} />
          <path d={pxPath([[298, 106, 8, 2]])} fill="#f4f0e4" />
          <path d={pxPath([[298, 128, 8, 2]])} fill={ZAB_M[ph].base} />
          <path d={SB_CHAIN} fill={STEEL[ph].lo} />
        </g>
      )}

      <BusStop ph={ph} s={s} />
      <Paczkomat ph={ph} s={s} />
      <Segregacja ph={ph} s={s} />
      <Bench ph={ph} s={s} />
      <Kosz ph={ph} s={s} />
      <BikeRack ph={ph} s={s} />
      <Trzepak ph={ph} s={s} />
      <Cabinet ph={ph} s={s} />

      {/* ---- the two lamps, and the moment at dusk when they cannot decide -- */}
      <StreetLamp x={40} on={lit} />
      <StreetLamp x={945} on={lit} />
      {ph === "dusk" && s.lamps === "auto" ? (
        <path
          d={pxPath(LAMP_X.map((x) => [x - 8, 40, 16, 8] as Rect))}
          fill={K.glassLit}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;0.5;0;0.35;0;0.6;0.3;0.6"
            dur="9s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}

      {/* ---- the council sign at the square end --------------------------- */}
      <path d={CS_POST} fill={STEEL[ph].lo} />
      <path d={pxPath([[1236, 96, 1, GROUND - 96]])} fill={STEEL[ph].hi} />
      <Bev set={CS_PLATE} mat={{ ...STEEL[ph], base: "#2b5a8a", hi: "#3a6b9e" }} />
      <PixelText x={1228} y={88} text="OSIEDLE" fill="#e8e6de" />
      <path d={CS_ARROW} fill="#e8e6de" opacity={0.85} />
      {/* the smaller plate under it, for whatever they added in 2019 */}
      <path d={CS_PLATE2} fill="#1e4478" />
      <path
        d={pxPath(repeat(2, 3, [1233, 102, 22, 1] as Rect, "y"))}
        fill="#8aa8c8"
        opacity={0.7}
      />
      {snow ? <path d={pxPath([[1224, 83, 46, 2]])} fill={K.snow} /> : null}

      {/* the concrete planter lives in the Foreground plane; this is its shadow
          on the pavement, so the two planes agree about where it stands */}
      <path d={pxPath([[678, 160, 64, 3]])} fill={dth("n", "25")} opacity={0.4} />
    </g>
  );
}

/* ==================================================================== *
 * FOUR CHANGES OUTSIDE THIS BLOCK
 *
 * 1. Delete four now-superseded consts from street.tsx. Each was used only by
 *    the old StreetFurniture and is replaced by the geometry above:
 *
 *        BENCH_SET     -> BN_ENDS / BN_SEAT_SLATS / BN_BACK_SLATS
 *        KOSZ_SET      -> KZ_BODY
 *        CABINET_SET   -> CB_BODY
 *        POSTBOX_SET   -> PB_BOX
 *
 * 2. Two entries in STREET_CONTACT move with their objects:
 *
 *        [690, 74, CY]   ->  [684, 87, CY]    the bins, now four in an enclosure
 *        [956, 32, CY]   ->  [937, 47, CY]    the trzepak, now 940..981
 *
 * 3. THE CAT. Its bench pose was drawn to a bench whose seat was at y=120. The
 *    seat is at 133 now, so the cat is lying 13 px above it. In the `s.cat ===
 *    "bench"` branch of Cat, add 13 to every y:
 *
 *        94 -> 107   90 -> 103   87 -> 100   92 -> 105   100 -> 113   101 -> 114
 *
 *    Nothing else in Cat changes, and the pavement pose is untouched.
 *
 * 4. Optional, and only if the aim bothers you: the `bench` hitbox is at
 *    820..840 while the bench is at 780..832, so it covers the right end and
 *    8 px of empty pavement. `x: 806, range: 26` would centre it. The id and
 *    kind stay the same, so the translation still resolves — but `babcia` sits
 *    at 782..818, so the two would overlap by 12 px and the NPC has priority 2.
 *    Leaving it aimed at the far end is the safer read; your call.
 *
 * NO ARTKEY CHANGE. Everything here reads `s.bins`, `s.binOpen`, `s.kosz`,
 * `s.bikes`, `s.trzepak`, `s.zabka`, `s.season`, `s.weather`, `s.lamps` and
 * `lampsOn(s, ph)` — all of which artKey already joins.
 * ==================================================================== */

/* ================================================================== *
 * PLANE 5 — people and animals, all 66–72 px because that is 1.75 m
 * ================================================================== */

/** The smoker. Hood up when it is cold, phone out when it is not. */
// The hand-drawn Smoker, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Smoker({ ph, s }: { ph: Ph; s: StreetState }) {
  const x = 244;
  const cold = isCold(s, ph);
  const phone = s.smoker === "phone";
  return (
    <g>
      {cold ? (
        <g>
          {px(x + 2, 78, 15, 5, K.hoodie)}
          {px(x + 1, 82, 17, 7, "#3a4148")}
          {px(x + 2, 79, 13, 1, "#56657a")}
          {px(x + 5, 85, 10, 8, K.skin)}
          {px(x + 5, 89, 10, 4, K.skinShade)}
        </g>
      ) : (
        <g>
          {px(x + 3, 78, 13, 6, "#3d2a1a")}
          {px(x + 3, 78, 13, 2, "#503a26")}
          {px(x + 4, 84, 11, 9, K.skin)}
          {px(x + 4, 89, 11, 4, K.skinShade)}
          {px(x + 3, 86, 2, 3, K.skinShade)}
          {px(x + 15, 86, 2, 3, K.skinShade)}
          {px(x, 92, 19, 5, "#3a4148")}
        </g>
      )}
      <path
        d={pxPath([
          [x + 7, cold ? 87 : 86, 2, 2],
          [x + 12, cold ? 87 : 86, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(x + 8, cold ? 92 : 91, 5, 1, "#b08668")}
      {/* the hoodie, and the drawstrings */}
      {px(x, 94, 19, 24, K.hoodie)}
      {px(x, 94, 19, 2, "#56657a")}
      {px(x + 14, 96, 5, 22, K.hoodieLo)}
      {px(x + 4, 106, 11, 8, K.hoodieLo)}
      {px(x + 4, 106, 11, 1, "#56657a")}
      <path
        d={pxPath([
          [x + 6, 96, 1, 9],
          [x + 11, 96, 1, 9],
        ])}
        fill={K.cream}
      />
      {/* the right arm up with the cigarette, and the ember */}
      {px(x + 16, 96, 4, 9, K.hoodie)}
      {px(x + 17, 103, 4, 4, K.skin)}
      {px(x + 20, 104, 5, 2, K.white)}
      <path d={pxPath([[x + 25, 104, 2, 2]])} fill="#e86a3a">
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.35;1;0.5;0.35"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </path>
      {/* the left hand: phone in the day, pocket when it is cold */}
      {phone && !cold ? (
        <g>
          {px(x - 4, 100, 4, 8, K.hoodie)}
          {px(x - 5, 106, 4, 4, K.skin)}
          {px(x - 7, 99, 5, 8, "#22262c")}
          <rect x={x - 6} y={100} width={3} height={6} fill="#9fc7d6" opacity={0.8}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.8;0.55;0.85;0.6;0.8"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        px(x - 2, 102, 5, 10, K.hoodieLo)
      )}
      {/* joggers and sneakers */}
      <path
        d={pxPath([
          [x + 3, 118, 6, 27],
          [x + 11, 118, 6, 27],
        ])}
        fill="#2e3033"
      />
      <path
        d={pxPath([
          [x + 5, 118, 1, 26],
          [x + 13, 118, 1, 26],
        ])}
        fill="#4a4d52"
      />
      <path
        d={pxPath([
          [x + 2, 145, 8, 5],
          [x + 11, 145, 8, 5],
        ])}
        fill="#8a8f96"
      />
      <path d={pxPath([[x + 2, 145, 17, 1]])} fill="#aeb2b8" />
    </g>
  );
}

/** Babcia Krysia. Feeds the birds by day, buttons up at dusk, indoors by night. */
// The hand-drawn Babcia, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Babcia({ ph: _ph, s }: { ph: Ph; s: StreetState }) {
  const x = 790;
  const feeding = s.babcia === "feeding";
  return (
    <g>
      {/* beret and silver hair */}
      {px(x + 3, 86, 13, 4, K.beret)}
      {px(x + 8, 84, 2, 2, K.beret)}
      {px(x + 2, 89, 15, 2, "#8a3a50")}
      <path
        d={pxPath([
          [x + 3, 91, 3, 3],
          [x + 14, 91, 3, 3],
        ])}
        fill="#c9c4b6"
      />
      {/* face, and the glasses catching whatever light there is */}
      {px(x + 5, 91, 11, 8, K.skin)}
      {px(x + 5, 96, 11, 3, K.skinShade)}
      <path
        d={pxPath([
          [x + 6, 93, 3, 2],
          [x + 11, 93, 3, 2],
        ])}
        fill="#d8e4ec"
      />
      {px(x + 9, 94, 2, 1, STEEL.day.lo)}
      {px(x + 8, 98, 5, 1, "#b08668")}
      {/* the coat; at dusk the collar goes up and a scarf appears */}
      {px(x + 1, 100, 18, 15, K.coat)}
      {px(x + 1, 100, 18, 2, "#6a5675")}
      {px(x + 15, 102, 4, 13, K.coatLo)}
      <path
        d={pxPath([
          [x + 9, 104, 2, 2],
          [x + 9, 109, 2, 2],
        ])}
        fill="#c9a24b"
      />
      {!feeding ? (
        <g>
          {px(x + 3, 99, 14, 4, "#8a3a50")}
          {px(x + 3, 99, 14, 1, "#9c4a60")}
          {px(x + 2, 103, 4, 9, "#8a3a50")}
        </g>
      ) : null}
      {px(x, 113, 20, 8, K.coat)}
      {px(x, 113, 20, 1, "#6a5675")}
      {feeding ? (
        <g>
          {/* one hand out, scattering, and the crumbs on their way down */}
          {px(x + 18, 112, 6, 4, K.skin)}
          {px(x + 22, 110, 4, 3, "#c9a24b")}
          {[0, 0.8, 1.7].map((d) => (
            <rect key={d} x={x + 26} y={114} width={1} height={1} fill="#d8c9a6" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                begin={`${d}s`}
                dur="2.6s"
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;7 32"
                begin={`${d}s`}
                dur="2.6s"
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </g>
      ) : (
        <g>
          {px(x + 6, 115, 8, 3, K.skin)}
          {px(x + 5, 114, 10, 2, K.coatLo)}
        </g>
      )}
      {/* stockings and boots */}
      <path
        d={pxPath([
          [x + 4, 121, 5, 24],
          [x + 11, 121, 5, 24],
        ])}
        fill="#8a8578"
      />
      <path
        d={pxPath([
          [x + 3, 145, 7, 5],
          [x + 11, 145, 7, 5],
        ])}
        fill="#3a3129"
      />
      {/* the red bag leaning on her boot, and the stick she says she does not need */}
      {px(x + 20, 130, 13, 18, K.bagRed)}
      {px(x + 20, 130, 13, 2, "#d85a50")}
      <path
        d={pxPath([
          [x + 21, 127, 3, 4],
          [x + 28, 127, 3, 4],
        ])}
        fill="#a33a30"
      />
      {px(x + 23, 133, 7, 7, K.gas)}
      {px(x + 24, 126, 5, 5, "#c9a24b")}
      {px(x - 4, 112, 2, 36, "#6b4a2f")}
      {px(x - 6, 110, 6, 3, "#8a623f")}
    </g>
  );
}

/** Pan Heniek, waiting. Leans out to look down the road; steps up when it comes. */
// The hand-drawn Pan Heniek, kept for one release while the built one proves
// itself across every bus state. Delete once he has.
// @ts-expect-error TS6133
function _Heniek({ ph, s }: { ph: Ph; s: StreetState }) {
  const x = 488;
  const night = ph === "night";
  const coming = s.bus === "arriving";
  return (
    <g
      style={{
        transition: STEP_SLIDE,
        transform: coming ? "translate(6px, 0)" : "none",
      }}
    >
      {/* flat cap and a face that has waited before */}
      {px(x + 2, 82, 15, 4, K.quilt)}
      {px(x + 1, 84, 8, 2, "#4d5a46")}
      {px(x + 4, 86, 11, 9, K.skin)}
      {px(x + 4, 91, 11, 4, K.skinShade)}
      <path
        d={pxPath([
          [x + 6, 88, 2, 2],
          [x + 11, 88, 2, 2],
        ])}
        fill="#3d2a1a"
      />
      {px(x + 6, 93, 7, 1, "#8a8578")}
      {/* quilted jacket, hands behind the back */}
      {px(x, 95, 19, 26, K.quilt)}
      {px(x, 95, 19, 2, "#4d5a46")}
      <path
        d={pxPath([
          [x, 101, 19, 1],
          [x, 108, 19, 1],
        ])}
        fill="#33402f"
      />
      {px(x + 15, 97, 4, 24, "#33402f")}
      {px(x + 2, 118, 6, 5, K.skin)}
      <path
        d={pxPath([
          [x + 3, 121, 6, 24],
          [x + 10, 121, 6, 24],
        ])}
        fill="#4a4438"
      />
      <path
        d={pxPath([
          [x + 2, 145, 8, 5],
          [x + 10, 145, 8, 5],
        ])}
        fill="#2f2921"
      />
      {/* the string bag, or the umbrella when it is that sort of evening */}
      {night || isWet(s) ? (
        <g>
          {px(x + 19, 100, 2, 44, "#2e3033")}
          {px(x + 14, 96, 12, 4, "#2b4f9e")}
          {px(x + 14, 96, 12, 1, "#3a63bd")}
        </g>
      ) : (
        <g>
          {px(x + 19, 124, 11, 20, "#a89a72")}
          {px(x + 19, 124, 11, 2, "#c2b48c")}
          {px(x + 22, 128, 5, 6, M.leaf.base)}
          <path
            d={pxPath([
              [x + 21, 120, 3, 5],
              [x + 26, 120, 3, 5],
            ])}
            fill="#a89a72"
          />
        </g>
      )}
      {!coming ? (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 9} 148;0 ${x + 9} 148;-3 ${x + 9} 148;0 ${x + 9} 148;0 ${x + 9} 148`}
          dur="11s"
          repeatCount="indefinite"
        />
      ) : null}
    </g>
  );
}

/** The courtyard cat. Owns the bench after dark. */
function Cat({ s }: { s: StreetState }) {
  const coat = K.cat;
  const coatHi = K.catHi;
  if (s.cat === "bench") {
    const x = 796;
    return (
      <g>
        {px(x, 94, 24, 10, coat)}
        {px(x, 94, 24, 2, coatHi)}
        {px(x + 19, 90, 9, 8, coat)}
        <path
          d={pxPath([
            [x + 20, 87, 3, 4],
            [x + 25, 87, 3, 4],
          ])}
          fill={coat}
        />
        <path
          d={pxPath([
            [x + 21, 92, 2, 1],
            [x + 25, 92, 2, 1],
          ])}
          fill="#c9a24b"
        />
        <rect x={x - 4} y={100} width={8} height={3} fill={coat}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 4} 101;-10 ${x + 4} 101;4 ${x + 4} 101;0 ${x + 4} 101`}
            dur="7.4s"
            repeatCount="indefinite"
          />
        </rect>
        {/* the flank that rises and falls, which is the whole trick */}
        <rect x={x + 4} y={92} width={14} height={4} fill={coatHi} opacity={0.9}>
          <animate attributeName="y" values="92;91;92" dur="4.6s" repeatCount="indefinite" />
        </rect>
      </g>
    );
  }
  const x = 760;
  return (
    <g>
      {px(x + 2, 128, 12, 20, coat)}
      {px(x + 2, 128, 12, 2, coatHi)}
      {px(x + 3, 118, 11, 11, coat)}
      {px(x + 3, 114, 4, 5, coat)}
      <path
        d={pxPath([
          [x + 4, 116, 2, 2],
          [x + 11, 116, 2, 2],
        ])}
        fill="#3f342c"
      />
      <path
        d={pxPath([
          [x + 5, 122, 2, 2],
          [x + 10, 122, 2, 2],
        ])}
        fill={s.catFed ? K.led : "#c9a24b"}
      />
      {px(x + 7, 125, 2, 1, "#b98b86")}
      <path
        d={pxPath([
          [x + 1, 144, 6, 5],
          [x + 9, 144, 6, 5],
        ])}
        fill={coat}
      />
      <g>
        <path
          d={pxPath([
            [x + 14, 134, 3, 14],
            [x + 14, 146, 7, 3],
          ])}
          fill={coat}
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 15} 136;-7 ${x + 15} 136;3 ${x + 15} 136;-4 ${x + 15} 136;0 ${x + 15} 136`}
          dur="5.8s"
          repeatCount="indefinite"
        />
      </g>
      {/* the ear that twitches once every eight seconds */}
      <rect x={x + 10} y={114} width={4} height={5} fill={coat}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 12} 119;0 ${x + 12} 119;-18 ${x + 12} 119;0 ${x + 12} 119;0 ${x + 12} 119`}
          dur="8.2s"
          repeatCount="indefinite"
        />
      </rect>
      {s.catFed ? (
        <g>
          {px(x + 20, 143, 10, 5, "#8fa8b8")}
          {px(x + 21, 144, 8, 2, "#b08668")}
        </g>
      ) : null}
    </g>
  );
}

/** Pigeons: pecking, waiting, or — when the bus comes — gone. */
function Pigeon({
  x,
  delay = 0,
  mode = "peck",
}: {
  x: number;
  delay?: number;
  mode?: "peck" | "idle";
}) {
  return (
    <g>
      {px(x, 146, 5, 3, K.pigeon)}
      {px(x, 146, 5, 1, K.pigeonHi)}
      <path
        d={pxPath([
          [x + 1, 149, 1, 1],
          [x + 3, 149, 1, 1],
        ])}
        fill="#a3542f"
      />
      <g>
        {px(x + 4, 144, 3, 3, "#8a8f96")}
        {px(x + 6, 145, 2, 1, "#c9a24b")}
        {px(x + 5, 145, 1, 1, "#2e3033")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={
            mode === "peck"
              ? `0 ${x + 4} 147;26 ${x + 4} 147;0 ${x + 4} 147;0 ${x + 4} 147`
              : `0 ${x + 4} 147;0 ${x + 4} 147;-14 ${x + 4} 147;0 ${x + 4} 147`
          }
          dur={mode === "peck" ? "2.3s" : "5.1s"}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

function People({ ph: _ph, s }: { ph: Ph; s: StreetState }) {
  /** When the bus is pulling in, the flock leaves. That is the payoff. */
  const flock = s.bus !== "arriving";
  return (
    <g>
      {/* the smoker and the babcia are NpcActors in the Effects plane now */}
      {/* Pan Heniek is an NpcActor in the Effects plane now */}
      {s.cat !== "away" ? <Cat s={s} /> : null}
      {flock ? (
        <g>
          <Pigeon x={540} />
          <Pigeon x={556} delay={0.9} mode="idle" />
          {s.babcia === "feeding" ? (
            <g>
              <Pigeon x={746} delay={1.6} />
              <Pigeon x={764} delay={0.4} />
              <Pigeon x={828} delay={2.1} />
              <Pigeon x={842} delay={1.1} mode="idle" />
            </g>
          ) : (
            <Pigeon x={746} delay={1.6} mode="idle" />
          )}
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function StreetScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world, ph);
  const dark = ph === "night" || ph === "dusk";
  return (
    <LayeredScene
      parallax={{ farBackground: 0.9, middleBackground: 1 }}
      farBackground={
        <g>
          <SharedDefs />
          <PhaseSky id="street-sky" phase={phase} width={STREET_W} />
          <Clouds dark={dark} flat={isFlat(s)} clear={s.weather === "clear"} />
          <Skyline ph={ph} s={s} />
        </g>
      }
      middleBackground={
        <g>
          {/* ---------------- BLOCK 14 ---------------- */}
          <Bev set={R14_BODY} mat={R14[ph]} />
          <rect x={Z.silka} y={0} width={520} height={GROUND} fill="url(#px-roller)" />
          <path d={R14_JOINTS} fill={R14[ph].mid} />
          <path d={SLAB_14} fill={R14[ph].lo} />
          <path d={pxPath([[60, SLAB_TOP + 2, 520, 6]])} fill={R14[ph].base} />
          {/* the newer render patch, and the damp where the pipe leaks */}
          {px(268, 96, 34, 26, K.renderPatch)}
          {px(268, 96, 34, 1, "#d2c7b1")}
          {px(62, 118, 22, 32, K.renderDamp)}
          {px(62, 118, 14, 12, "#9c9280")}
          <SillWindow x={84} ph={ph} life="curtains" snow={isSnow(s)} />
          <SillWindow x={132} ph={ph} life="lit" snow={isSnow(s)} />
          <SillWindow x={252} ph={ph} life="plant" snow={isSnow(s)} />
          <SillWindow x={296} ph={ph} life="tv" snow={isSnow(s)} />
          <SillWindow x={430} ph={ph} life="blinds" snow={isSnow(s)} />
          <SillWindow x={478} ph={ph} life="cat" snow={isSnow(s)} />
          <SillWindow x={526} ph={ph} life="dish" snow={isSnow(s)} />
          {/* the gas pipe, as inevitable as the render */}
          <path d={GAS_14.run} fill={K.gas} />
          <path d={GAS_14.hi} fill="#f2d86a" />
          <path d={GAS_14.lo} fill={K.gasLo} />
          <path d={GAS_14.brackets} fill={K.gasLo} />
          <path d={GAS_14.riser} fill={K.gas} />
          <path d={GAS_14.riserHi} fill="#f2d86a" />
          <path d={GAS_14.valve} fill={K.gasLo} />
          {/* the drainpipe, its brackets, and the rust at the shoe */}
          <path d={PIPE_14.body} fill={R14[ph].mid} />
          <path d={PIPE_14.hi} fill={R14[ph].hi} />
          <path d={PIPE_14.brackets} fill={FRAME[ph].base} />
          <path d={PIPE_14.rust} fill={K.rust} />
          <path d={CABLES} fill="#6d6a62" />
          <Bev set={PLINTH_14} mat={PLINTH[ph]} />
          <path d={PLINTH_WORN} fill={PLINTH[ph].hi} opacity={0.7} />
          {/* graffiti: a tag, a heart, and the square somebody scrubbed */}
          <path d={pxPath([[96, 116, 40, 20]])} fill="#00000012" />
          <path
            d={pxPath([
              [100, 120, 3, 14],
              [103, 120, 8, 3],
              [108, 123, 3, 5],
              [103, 128, 8, 3],
            ])}
            fill="#2b5aa8"
          />
          <path
            d={pxPath([
              [114, 118, 3, 16],
              [117, 122, 6, 3],
              [122, 125, 3, 9],
              [128, 126, 4, 4],
              [133, 126, 4, 4],
              [130, 130, 5, 3],
              [131, 133, 3, 2],
            ])}
            fill="#c94040"
          />
          <NoticeBoard ph={ph} />
          <KlatkaB ph={ph} s={s} hall={hallState(world)} />
          <Zabka ph={ph} s={s} shop={shopFront(world)} />
          {/* ---------------- BLOCK 16 ---------------- */}
          <Block16 ph={ph} s={s} />
          <Bankomat ph={ph} s={s} />
          {/* snow on every horizontal edge in the street, in one path */}
          {isSnow(s) ? <path d={SNOW_LEDGES} fill={K.snow} opacity={0.9} /> : null}
        </g>
      }
      ground={<Pavement ph={ph} s={s} />}
      staticObjects={<StreetFurniture ph={ph} s={s} />}
      gameplayObjects={<People ph={ph} s={s} />}
    />
  );
}

/* ==================================================================== *
 * FOREGROUND — replacement block for street.tsx
 *
 * Drops in over the BUS constant and StreetFront. Everything else in the file
 * stays as it is.
 *
 * THE BUS WAS WRONG IN NINE DIMENSIONS OUT OF TEN. I measured it against a
 * Solaris Urbino 12, which is what runs a route like this, and only the length
 * was right:
 *
 *                      real      should be    was
 *   length             12.00 m      456 px    456   ok
 *   height to roof      3.05 m      116 px     92   24 px short
 *   window band         1.20 m       46 px     26   half height
 *   tyre diameter       1.05 m       40 px     10   a dark strip
 *   front overhang      2.70 m      103 px     56   axle in the wrong place
 *   wheelbase           5.90 m      224 px    284   axles too far apart
 *   rear overhang       3.40 m      129 px    116
 *   double door         1.25 m       48 px      9   a letterbox slot
 *
 * And the ground line was worse than any of those: the wheels bottomed out at
 * y=150, which is the *pavement* surface. A bus serving a kerbside stop stands
 * on the road. It stands at y=172 now, so it is 22 px taller at the bottom as
 * well as 24 px taller at the top — 116 px of frame, which is what 3.05 m of
 * bus actually is, and which is why it blocks the street.
 *
 * WHAT A BUS NEEDS TO LOOK LIKE A BUS. Not more detail — the right four things.
 * A vehicle reads from its glazing line, its wheel arches, its door rhythm and
 * its roof. So: one continuous window band at the correct 1.35–2.55 m, wheel
 * arches actually cut into the skirt with 1.05 m tyres showing under them, a
 * 1-2-2 door layout at the real spacings (front single, middle and rear double),
 * and an air-conditioning hump on the roof, because every one of these has one
 * and it is the silhouette you recognise from the end of the street.
 *
 * AND THE DOORS OPEN. The old bus drove up, sat there for nine seconds with its
 * doors shut, and drove off. The leaves now slide outward on the same 26 s
 * timeline, keyed to the window when it is stationary — 0.38 to 0.60 — with a
 * passenger stepping down out of the middle one, the brake lights on while it is
 * stopped, and the indicator flashing before it pulls in. That is the whole
 * event: approach, indicate, stop, open, unload, close, go.
 *
 * NEW NEAR-PLANE OBJECTS, and the reason each one belongs on this street:
 *   – overhead cables, three of them, sagging between the blocks with a bird
 *     sitting on the middle one. Every Polish estate has these and no scene ever
 *     draws them; they also give the near plane something at the top of frame,
 *     which it did not have.
 *   – a bare branch across the top left corner, leafed or not by season
 *   – the near kerb, its gutter, a drain grate and the puddle that stands in it
 *   – snow banked along the kerb, ploughed there and grey by the second day
 *   – the crossover, enriched: wing mirror, wiper, plate, tail light, and a
 *     parking ticket under the wiper that only appears by day
 *   – a scooter chained to the near bollard, which is where they always are
 *   – a bicycle leaned against the near hedge, going nowhere
 *   – a carrier bag tumbling across the near lane on the wind
 *   – a cyclist crossing the near lane, because somebody always is
 *   – near rain: bigger, faster streaks than the Effects layer, which is what
 *     rain nearer the lens looks like
 *
 * NO ARTKEY CHANGE. Reads `s.bus`, `s.season`, `s.weather` and the phase, all of
 * which artKey already joins.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * the bus — put this where the old BUS constant was
 * -------------------------------------------------------------------- */

/** It stands on the road, not on the pavement. Everything derives from this. */
const BUS_GND = 172;
const BUS_LEN = m(12.0); // 456
const BUS_ROOF = BUS_GND - m(3.05); // 56
const BUS_SILL = BUS_GND - m(1.35); // 121 — bottom of the glazing
const BUS_HEAD = BUS_GND - m(2.55); // 75  — top of the glazing
const BUS_SKIRT = BUS_GND - m(0.37); // 158 — bottom of the body panels
/** Front overhang 2.70 m, wheelbase 5.90 m, rear overhang 3.40 m. */
const BUS_AXLE_F = m(2.7); // 103
const BUS_AXLE_R = BUS_AXLE_F + m(5.9); // 327
const BUS_TYRE = m(1.05); // 40
/** 1-2-2: a single leaf at the front, doubles in the middle and at the back. */
const BUS_DOORS = [
  { x: 46, w: m(0.79), leaves: 1 },
  { x: 178, w: m(1.25), leaves: 2 },
  { x: 330, w: m(1.25), leaves: 2 },
] as const;

const BUS = {
  /** roof, and the AC hump that is the silhouette you recognise */
  roof: pxPath([[0, BUS_ROOF, BUS_LEN, 8]]),
  roofHi: pxPath([[0, BUS_ROOF, BUS_LEN, 1]]),
  ac: pxPath([
    [300, BUS_ROOF - 6, 100, 7],
    [306, BUS_ROOF - 8, 88, 2],
  ]),
  hatches: pxPath([
    [120, BUS_ROOF + 1, 30, 5],
    [220, BUS_ROOF + 1, 30, 5],
  ]),
  /** the body, and the skirt below the sill */
  body: pxPath([[0, BUS_ROOF + 8, BUS_LEN, BUS_SKIRT - BUS_ROOF - 8]]),
  skirt: pxPath([[0, BUS_SKIRT, BUS_LEN, BUS_GND - BUS_SKIRT]]),
  /** one continuous glazing band, which is what makes it read as a bus */
  glazing: pxPath([[44, BUS_HEAD, BUS_LEN - 76, BUS_SILL - BUS_HEAD]]),
  /** and the pillars that break it up, at real bay spacings */
  pillars: pxPath(
    [76, 122, 172, 232, 274, 324, 384, 426].map(
      (x) => [x, BUS_HEAD, 6, BUS_SILL - BUS_HEAD] as Rect,
    ),
  ),
  /** the windscreen, which on a low-floor bus is nearly the whole front */
  screen: pxPath([[3, BUS_HEAD - 5, 40, BUS_SILL - BUS_HEAD + 19]]),
  /** the destination blind, in the fascia above the screen */
  blind: pxPath([[8, BUS_ROOF + 2, 96, 12]]),
  /** wheel arches cut into the skirt, and the tyres under them */
  arches: pxPath([
    [BUS_AXLE_F - BUS_TYRE / 2, BUS_SKIRT - 12, BUS_TYRE, 12],
    [BUS_AXLE_R - BUS_TYRE / 2, BUS_SKIRT - 12, BUS_TYRE, 12],
  ]),
  tyres: pxPath([
    [BUS_AXLE_F - BUS_TYRE / 2, BUS_GND - BUS_TYRE + 8, BUS_TYRE, BUS_TYRE - 8],
    [BUS_AXLE_R - BUS_TYRE / 2, BUS_GND - BUS_TYRE + 8, BUS_TYRE, BUS_TYRE - 8],
  ]),
  hubs: pxPath([
    [BUS_AXLE_F - 9, BUS_GND - 24, 18, 16],
    [BUS_AXLE_R - 9, BUS_GND - 24, 18, 16],
  ]),
  /** the advert wrap along the lower body, which every one of these carries */
  wrap: pxPath([[0, BUS_SILL + 5, BUS_LEN, 14]]),
  /** lights: heads and indicators at the front, tails at the back */
  heads: pxPath([[0, BUS_GND - 38, 13, 12]]),
  indicF: pxPath([[0, BUS_GND - 26, 13, 6]]),
  tails: pxPath([[BUS_LEN - 13, BUS_GND - 38, 13, 12]]),
  indicR: pxPath([[BUS_LEN - 13, BUS_GND - 26, 13, 6]]),
  /** the engine grille and the exhaust at the back */
  grille: pxPath([[BUS_LEN - 28, BUS_HEAD, 24, 44]]),
  grilleFins: pxPath(repeat(6, 6, [BUS_LEN - 26, BUS_HEAD + 3, 20, 2] as Rect, "y")),
  exhaust: pxPath([[BUS_LEN - 18, BUS_GND - 6, 16, 4]]),
  /** the mirror on its stalk, which sticks out past the nose */
  mirror: pxPath([
    [-8, BUS_HEAD - 3, 10, 3],
    [-9, BUS_HEAD, 5, 12],
  ]),
  /** the next-stop LED strip on the side above the windows */
  ledStrip: pxPath([[92, BUS_HEAD - 7, 80, 6]]),
  /** the mud the skirt collects and nobody washes off */
  mud: pxPath([
    [130, BUS_GND - 8, 60, 6],
    [200, BUS_GND - 6, 40, 4],
    [350, BUS_GND - 8, 50, 6],
  ]),
};

/** The door apertures, the leaves that slide out of them, and the edge stripes. */
const BUS_DOOR_HOLES = pxPath(
  BUS_DOORS.map((d) => [d.x, BUS_HEAD, d.w, BUS_SKIRT - BUS_HEAD] as Rect),
);
const BUS_DOOR_LEAVES = BUS_DOORS.flatMap((d) =>
  d.leaves === 1
    ? [{ x: d.x, w: d.w, dir: -1 }]
    : [
        { x: d.x, w: d.w / 2, dir: -1 },
        { x: d.x + d.w / 2, w: d.w / 2, dir: 1 },
      ],
);
/** The yellow edge every bus door in Poland has down its closing face. */
const BUS_DOOR_EDGES = pxPath(
  BUS_DOORS.flatMap((d) =>
    d.leaves === 1
      ? ([[d.x + d.w - 2, BUS_HEAD, 2, BUS_SKIRT - BUS_HEAD]] as Rect[])
      : ([
          [d.x + d.w / 2 - 2, BUS_HEAD, 2, BUS_SKIRT - BUS_HEAD],
          [d.x + d.w / 2, BUS_HEAD, 2, BUS_SKIRT - BUS_HEAD],
        ] as Rect[]),
  ),
);
/** The button beside each door, and the wheelchair symbol on the middle one. */
const BUS_DOOR_BUTTONS = pxPath(BUS_DOORS.map((d) => [d.x - 5, BUS_GND - 62, 4, 6] as Rect));
const BUS_WHEELCHAIR = pxPath([
  [196, BUS_SILL + 8, 10, 8],
  [199, BUS_SILL + 6, 3, 3],
]);
/** Passengers, as silhouettes: seated heads at the sill, one standing at a pole. */
const BUS_PAX = pxPath([
  [92, BUS_HEAD + 12, 10, BUS_SILL - BUS_HEAD - 12],
  [136, BUS_HEAD + 14, 9, BUS_SILL - BUS_HEAD - 14],
  [150, BUS_HEAD + 11, 10, BUS_SILL - BUS_HEAD - 11],
  [246, BUS_HEAD + 2, 9, BUS_SILL - BUS_HEAD - 2],
  [290, BUS_HEAD + 13, 10, BUS_SILL - BUS_HEAD - 13],
  [396, BUS_HEAD + 12, 9, BUS_SILL - BUS_HEAD - 12],
  [408, BUS_HEAD + 15, 10, BUS_SILL - BUS_HEAD - 15],
]);
/** The driver, behind the screen, at the height a driver actually sits. */
const BUS_DRIVER = pxPath([
  [20, BUS_GND - 76, 14, 22],
  [23, BUS_GND - 84, 9, 9],
]);
/** The one getting off at the middle door, drawn only while it is stopped. */
const BUS_ALIGHT = pxPath([
  [196, BUS_GND - 62, 14, 40],
  [198, BUS_GND - 72, 11, 11],
]);

/* -------------------------------------------------------------------- *
 * the rest of the near plane
 * -------------------------------------------------------------------- */

/** Foreground colours. Everything here is nearer, so it is a shade stronger. */
const FGK = {
  cable: "#2a2c2e",
  cableHi: "#3d4144",
  bird: "#22201e",
  branch: "#4a4038",
  branchLeaf: "#a8763a",
  kerb: "#b5b2aa",
  gutter: "#4a4844",
  grate: "#3f3d38",
  puddle: "#5d7a8a",
  puddleHi: "#8fa0ad",
  snowBank: "#dfe8ee",
  snowGrey: "#b8c2ca",
  car: "#23262c",
  carHi: "#31353d",
  carDark: "#1a1c20",
  carGlass: "#2c3038",
  lamp: "#e8f0f8",
  tail: "#c94040",
  plate: "#e8e6e0",
  ticket: "#f2f2ee",
  scooter: "#2b3138",
  scooterHi: "#4d5560",
  scooterPanel: "#c9463c",
  bike: "#2f6a9e",
  bagLitter: "#d9d3c2",
  busBody: "#c9463c",
  busHi: "#e05a50",
  busSkirt: "#8a2f24",
  busRoof: "#5f6a70",
  busGlass: "#2a3a44",
  busGlassNight: "#ffe8b8",
  busWrap: "#f2f2ee",
  busDoor: "#7a281e",
  busEdge: "#e8c445",
  busGrille: "#3a3d43",
  hub: "#8a8f96",
  tyre: "#141618",
  mud: "#6b5f4c",
} as const;

/** Three cables sagging between the blocks, which every estate has. */
const FG_CABLES = [
  "M 0 14 Q 320 30 640 16 Q 960 4 1280 20",
  "M 0 22 Q 320 40 640 25 Q 960 12 1280 29",
  "M 0 9 Q 400 21 800 11 Q 1040 5 1280 13",
] as const;
/** The bird on the middle cable, which shuffles and then does not. */
const FG_BIRD = pxPath([
  [636, 21, 5, 3],
  [640, 19, 3, 2],
  [637, 24, 1, 2],
  [639, 24, 1, 2],
]);
/** A branch across the top left, leafed or not according to the season. */
const FG_BRANCH = pxPath([
  [0, 2, 210, 4],
  [96, 6, 80, 3],
  [150, 9, 60, 3],
]);
const FG_BRANCH_LEAVES = pxPath([
  [22, 6, 20, 8],
  [64, 6, 16, 9],
  [118, 9, 18, 8],
  [172, 12, 20, 8],
]);
/** The near kerb, its gutter, the grate, and the puddle that stands in it. */
const FG_KERB = pxPath([[0, 166, STREET_W, 4]]);
const FG_KERB_HI = pxPath([[0, 166, STREET_W, 1]]);
const FG_GUTTER = pxPath([[0, 170, STREET_W, 3]]);
const FG_GRATE = pxPath([[398, 168, 22, 4]]);
const FG_GRATE_SLOTS = pxPath(bank([[401, 168, 2, 4]], 5, 4));
/** Snow ploughed against the kerb, grey by the second day. */
const FG_SNOWBANK = pxPath([
  [0, 162, 260, 8],
  [300, 163, 340, 7],
  [700, 162, 300, 8],
  [1040, 164, 240, 6],
]);

/** The parked crossover. Nose, mirror, wiper, plate, tail light. */
const FG_CAR = {
  shadow: pxPath([[880, 176, 170, 4]]),
  lower: pxPath([[880, 164, 170, 16]]),
  upper: pxPath([[906, 154, 130, 12]]),
  upperHi: pxPath([[906, 154, 130, 2]]),
  glass: pxPath([[940, 156, 60, 7]]),
  /** the wing mirror on its stalk, which is the give-away that it is a car */
  mirror: pxPath([
    [1030, 150, 9, 7],
    [1036, 157, 3, 3],
  ]),
  wiper: pxPath([
    [944, 163, 44, 1],
    [944, 160, 2, 4],
  ]),
  drl: pxPath([[914, 158, 11, 3]]),
  tail: pxPath([[1042, 168, 7, 5]]),
  plate: pxPath([[952, 172, 26, 5]]),
  /** and the ticket under the wiper, which only ever appears by day */
  ticket: pxPath([[960, 158, 12, 8]]),
};
/** A scooter chained to the near bollard, where they always are. */
const FG_SCOOTER = {
  wheels: pxPath([
    [252, 166, 12, 12],
    [292, 166, 12, 12],
  ]),
  hubs: pxPath([
    [255, 169, 6, 6],
    [295, 169, 6, 6],
  ]),
  body: pxPath([
    [258, 158, 40, 9],
    [264, 152, 22, 7],
  ]),
  panel: pxPath([[266, 154, 18, 4]]),
  bars: pxPath([
    [286, 146, 3, 8],
    [280, 144, 14, 3],
  ]),
  chain: pxPath([[262, 162, 42, 2]]),
};
/** A bicycle leaned on the near hedge at the left, going nowhere. */
const FG_BIKE = {
  wheels: pxPath([
    [56, 158, 16, 16],
    [88, 158, 16, 16],
  ]),
  frame: pxPath([
    [66, 150, 3, 10],
    [68, 146, 26, 3],
    [80, 152, 3, 8],
    [94, 148, 3, 12],
  ]),
  bars: pxPath([[62, 144, 12, 3]]),
  saddle: pxPath([[90, 143, 10, 3]]),
};
/** A carrier bag on the wind, across the near lane. */
const FG_BAG = pxPath([
  [0, 168, 8, 9],
  [2, 164, 5, 5],
]);
/** A cyclist in the near lane, because somebody always is. */
const FG_CYCLIST = {
  wheels: pxPath([
    [0, 158, 18, 18],
    [34, 158, 18, 18],
  ]),
  frame: pxPath([
    [12, 148, 3, 12],
    [14, 144, 26, 3],
    [26, 150, 3, 10],
    [40, 146, 3, 14],
  ]),
  rider: pxPath([
    [18, 118, 15, 26],
    [20, 108, 12, 11],
    [30, 126, 12, 4],
    [16, 144, 7, 12],
    [26, 144, 7, 12],
  ]),
  helmet: pxPath([[19, 105, 14, 5]]),
};

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

// The street's Foreground, wired out while the parapet art is reworked.
// @ts-expect-error TS6133
function _StreetFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = world ? state(world, ph) : null;
  const snow = s ? isSnow(s) : false;
  const wet = s ? isWet(s) : false;
  const rain = s?.weather === "rain";
  const bare = s?.season === "bare";
  const autumn = s?.season === "autumn";
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const arriving = s?.bus === "arriving";
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${STREET_W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* ---- the 512, at the kerb, standing on the road ------------------ *
         * Drawn first of the near objects because it is the furthest of them:
         * it pulls up against the player's kerb, so the hedges, the parked car
         * and the near lane all pass in front of it.                          */}
        {arriving ? (
          <g>
            <g>
              {/* body, roof, AC hump, skirt */}
              <path d={BUS.skirt} fill={FGK.busSkirt} />
              <path d={BUS.body} fill={FGK.busBody} />
              <path d={BUS.roof} fill={FGK.busRoof} />
              <path d={BUS.roofHi} fill="#7a858c" />
              <path d={BUS.ac} fill="#4d565c" />
              <path d={BUS.hatches} fill="#6d7880" />
              <path d={pxPath([[0, BUS_ROOF + 8, BUS_LEN, 2]])} fill={FGK.busHi} />
              {/* the advert wrap along the lower body */}
              <path d={BUS.wrap} fill={FGK.busWrap} opacity={0.92} />
              <path d={pxPath([[40, BUS_SILL + 7, 120, 4]])} fill={FGK.busBody} opacity={0.5} />
              <path d={pxPath([[240, BUS_SILL + 7, 90, 4]])} fill="#2b5aa8" opacity={0.4} />
              {/* one continuous glazing band, which is what reads as a bus */}
              <path d={BUS.glazing} fill={dark ? FGK.busGlassNight : FGK.busGlass} opacity={0.95} />
              <path d={BUS_PAX} fill={dark ? "#6b4a30" : "#1e2a32"} opacity={0.75} />
              <path d={BUS.pillars} fill={FGK.busBody} />
              <path d={pxPath([[44, BUS_HEAD, BUS_LEN - 76, 2]])} fill={FGK.busHi} />
              {/* the windscreen and the driver behind it */}
              <path d={BUS.screen} fill={dark ? "#1e2a32" : FGK.busGlass} opacity={0.95} />
              <path d={BUS_DRIVER} fill={dark ? "#4a3a2a" : "#1a2228"} opacity={0.8} />
              <path d={pxPath([[3, BUS_HEAD - 5, 40, 2]])} fill={FGK.busHi} />
              {/* the destination blind, which is the whole point of a bus */}
              <path d={BUS.blind} fill="#12161b" />
              <PixelText x={12} y={BUS_ROOF + 5} text="512 OSIEDLE" fill={K.ledAmber} gap={1} />
              {/* the next-stop strip on the side */}
              <path d={BUS.ledStrip} fill="#12161b" />
              <PixelText
                x={96}
                y={BUS_HEAD - 6}
                text="OSIEDLE"
                fill={K.ledAmber}
                gap={1}
                op={0.8}
              />
              {/* the engine grille and the exhaust at the back */}
              <path d={BUS.grille} fill={FGK.busGrille} />
              <path d={BUS.grilleFins} fill="#22262a" />
              <path d={BUS.exhaust} fill="#22262a" />

              {/* --- the doors, and they open --- */}
              <path d={BUS_DOOR_HOLES} fill="#141a1e" />
              {BUS_DOOR_LEAVES.map((l, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: two door leaves, fixed order
                <g key={i}>
                  <g>
                    <path
                      d={pxPath([[l.x, BUS_HEAD, l.w, BUS_SKIRT - BUS_HEAD]])}
                      fill={FGK.busDoor}
                    />
                    <path
                      d={pxPath([[l.x + 2, BUS_HEAD + 3, l.w - 4, BUS_SILL - BUS_HEAD - 3]])}
                      fill={dark ? FGK.busGlassNight : FGK.busGlass}
                      opacity={0.9}
                    />
                    {/* the leaves slide outward while it is stopped, 0.38..0.60 */}
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={`0 0;0 0;${l.dir * (l.w - 2)} 0;${l.dir * (l.w - 2)} 0;0 0;0 0`}
                      keyTimes="0;0.38;0.43;0.58;0.62;1"
                      dur="26s"
                      repeatCount="indefinite"
                    />
                  </g>
                </g>
              ))}
              <path d={BUS_DOOR_EDGES} fill={FGK.busEdge} opacity={0.9} />
              <path d={BUS_DOOR_BUTTONS} fill={FGK.busEdge} />
              <path d={BUS_WHEELCHAIR} fill={FGK.busWrap} opacity={0.8} />
              {/* somebody stepping down out of the middle door while it is open */}
              <g opacity={0}>
                <path d={BUS_ALIGHT} fill="#2b3138" />
                <animate
                  attributeName="opacity"
                  values="0;0;0.9;0.9;0;0"
                  keyTimes="0;0.44;0.47;0.56;0.59;1"
                  dur="26s"
                  repeatCount="indefinite"
                />
              </g>

              {/* --- wheels: arches cut into the skirt, 1.05 m tyres under --- */}
              <path d={BUS.arches} fill="#141a1e" />
              <path d={BUS.tyres} fill={FGK.tyre} />
              <path d={BUS.hubs} fill={FGK.hub} />
              <path
                d={pxPath([
                  [BUS_AXLE_F - 4, BUS_GND - 20, 8, 8],
                  [BUS_AXLE_R - 4, BUS_GND - 20, 8, 8],
                ])}
                fill="#5d6266"
              />
              <path d={BUS.mud} fill={FGK.mud} opacity={0.35} />

              {/* --- lights: heads, tails, brakes on while stopped --- */}
              <path d={BUS.heads} fill={dark ? "#fff0c8" : FGK.lamp} />
              <path d={BUS.tails} fill={FGK.tail} />
              <path d={BUS.tails} fill="#ff6a5a">
                {/* the brakes are on for as long as it is standing there */}
                <animate
                  attributeName="opacity"
                  values="0;0;1;1;0;0"
                  keyTimes="0;0.3;0.34;0.6;0.64;1"
                  dur="26s"
                  repeatCount="indefinite"
                />
              </path>
              {/* and the indicator, which goes on before it pulls in */}
              <path d={BUS.indicF} fill={FGK.busEdge} opacity={0}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0;0.9;0;0.9;0;0.9;0;0"
                  keyTimes="0;0.2;0.24;0.27;0.3;0.33;0.36;0.39;1"
                  dur="26s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={BUS.indicR} fill={FGK.busEdge} opacity={0}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0;0.9;0;0.9;0;0.9;0;0"
                  keyTimes="0;0.62;0.66;0.69;0.72;0.75;0.78;0.81;1"
                  dur="26s"
                  repeatCount="indefinite"
                />
              </path>
              {/* the mirror, which sticks out past the nose */}
              <path d={BUS.mirror} fill={FGK.busGrille} />
              {snow ? <path d={pxPath([[0, BUS_ROOF - 2, BUS_LEN, 3]])} fill={K.snow} /> : null}
            </g>
            {/* approach, indicate, stop for nine seconds, then go */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-520 0;-520 0;470 0;470 0;1420 0;1420 0"
              keyTimes="0;0.16;0.36;0.62;0.86;1"
              dur="26s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}

        {/* ---- the near kerb, the gutter, the grate and the puddle --------- */}
        <path d={FG_KERB} fill={FGK.kerb} />
        <path d={FG_KERB_HI} fill="#c6c3bb" />
        <path d={FG_GUTTER} fill={FGK.gutter} />
        <path d={FG_GRATE} fill={FGK.grate} />
        <path d={FG_GRATE_SLOTS} fill="#1e1f22" />
        {wet ? (
          <g>
            <path
              d={pxPath(steppedEllipse(410, 171, 30, 3, 2))}
              fill={dark ? FGK.puddle : FGK.puddleHi}
              opacity={0.55}
            />
            <path d={pxPath(steppedEllipse(406, 170, 12, 1, 1))} fill="#c8d8e2" opacity={0.4} />
          </g>
        ) : null}
        {snow ? (
          <g>
            <path d={FG_SNOWBANK} fill={FGK.snowBank} />
            <path
              d={pxPath([
                [0, 168, 260, 2],
                [700, 168, 300, 2],
              ])}
              fill={FGK.snowGrey}
            />
          </g>
        ) : null}

        {/* ---- the hedges framing the walk, layered greens ----------------- */}
        <path
          d={pxPath([
            [-6, 138, 56, 42],
            [520, 156, 46, 24],
            [1230, 148, 56, 32],
          ])}
          fill={HEDGE[ph].lo}
        />
        <path
          d={pxPath([
            [2, 130, 36, 14],
            [528, 150, 28, 10],
            [1240, 140, 32, 12],
          ])}
          fill={bare ? "#4a4438" : HEDGE[ph].base}
        />
        <path
          d={pxPath([
            [12, 124, 18, 10],
            [20, 121, 8, 6],
            [536, 146, 14, 7],
            [1250, 135, 16, 8],
          ])}
          fill={bare ? "#5a5446" : HEDGE[ph].hi}
        />
        {snow ? (
          <path
            d={pxPath([
              [2, 129, 36, 2],
              [12, 123, 18, 2],
              [528, 149, 28, 2],
              [1240, 139, 32, 2],
            ])}
            fill={K.snow}
          />
        ) : null}
        {/* the bicycle leaned on the hedge, going nowhere */}
        <path d={FG_BIKE.wheels} fill={FGK.tyre} />
        <path d={FG_BIKE.frame} fill={FGK.bike} />
        <path d={FG_BIKE.bars} fill={FGK.scooter} />
        <path d={FG_BIKE.saddle} fill={FGK.scooter} />

        {/* ---- the concrete planter and the marigolds in it ---------------- */}
        <path d={pxPath([[680, 162, 60, 18]])} fill={PLINTH[ph].base} />
        <path d={pxPath([[680, 162, 60, 3]])} fill={PLINTH[ph].hi} />
        <path d={pxPath([[680, 176, 60, 4]])} fill={PLINTH[ph].lo} />
        {/* the chip out of the rim, and the butts in the soil */}
        <path d={pxPath([[712, 162, 7, 3]])} fill={PLINTH[ph].lo} />
        <path
          d={pxPath([
            [692, 163, 2, 1],
            [706, 164, 2, 1],
          ])}
          fill={K.white}
          opacity={0.5}
        />
        {bare ? (
          <path d={pxPath([[684, 158, 52, 5]])} fill="#5d5442" />
        ) : (
          <g>
            <path d={pxPath([[690, 160, 40, 3]])} fill={HEDGE[ph].base} />
            <path d={pxPath([[686, 156, 8, 7]])} fill="#e8a445" />
            <path d={pxPath([[700, 154, 8, 8]])} fill={K.gas} />
            <path d={pxPath([[716, 156, 8, 7]])} fill="#d9832f" />
            <path d={pxPath([[694, 152, 3, 6]])} fill="#4a6b4a" />
          </g>
        )}
        {snow ? <path d={pxPath([[680, 161, 60, 2]])} fill={K.snow} /> : null}

        {/* ---- the parked crossover, properly kitted out ------------------- */}
        <path d={FG_CAR.shadow} fill="#0d0f12" opacity={0.5} />
        <path d={FG_CAR.lower} fill={FGK.carDark} />
        <path d={FG_CAR.upper} fill={FGK.car} />
        <path d={FG_CAR.upperHi} fill={FGK.carHi} />
        <path d={FG_CAR.glass} fill={dark ? "#161a20" : FGK.carGlass} />
        <path d={FG_CAR.wiper} fill="#15171a" />
        <path d={FG_CAR.mirror} fill={FGK.car} />
        <path d={FG_CAR.drl} fill={dark ? "#fff0c8" : FGK.lamp} />
        <path d={FG_CAR.tail} fill={FGK.tail} opacity={dark ? 0.9 : 0.7} />
        <path d={FG_CAR.plate} fill={FGK.plate} />
        <path d={pxPath([[953, 173, 3, 3]])} fill="#1e4478" />
        {/* the ticket under the wiper, which is only ever there by day */}
        {!night ? (
          <g>
            <path d={FG_CAR.ticket} fill={FGK.ticket} />
            <path
              d={pxPath([
                [962, 161, 8, 1],
                [962, 164, 6, 1],
              ])}
              fill="#8a8578"
            />
          </g>
        ) : null}
        {snow ? <path d={pxPath([[906, 153, 130, 3]])} fill={K.snow} /> : null}

        {/* ---- the bollard, and the scooter chained to it ------------------ */}
        <path d={pxPath([[300, 150, 7, 30]])} fill="#4a4e52" />
        <path
          d={pxPath([
            [300, 150, 7, 3],
            [300, 162, 7, 3],
          ])}
          fill={K.cream}
        />
        <path d={FG_SCOOTER.wheels} fill={FGK.tyre} />
        <path d={FG_SCOOTER.hubs} fill={FGK.hub} />
        <path d={FG_SCOOTER.body} fill={FGK.scooter} />
        <path d={FG_SCOOTER.panel} fill={FGK.scooterPanel} />
        <path d={FG_SCOOTER.bars} fill={FGK.scooterHi} />
        <path d={FG_SCOOTER.chain} fill="#5d6266" />

        {/* ---- the near lane: the car, the cyclist, the bag on the wind ---- */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-420 0;-420 0;1560 0;1560 0"
            keyTimes="0;0.74;0.855;1"
            dur="54s"
            repeatCount="indefinite"
          />
          <path d={pxPath([[0, 152, 210, 28]])} fill="#2b3a52" />
          <path d={pxPath([[0, 152, 210, 3]])} fill="#3d5070" />
          <path d={pxPath([[24, 140, 150, 13]])} fill="#22303f" />
          <path
            d={pxPath([
              [30, 143, 60, 8],
              [100, 143, 60, 8],
            ])}
            fill="#4a6076"
          />
          <path d={pxPath([[0, 158, 6, 8]])} fill={dark ? "#fff0c8" : "#e8f0f8"} />
          <path d={pxPath([[204, 158, 6, 8]])} fill="#c94040" />
          <path
            d={pxPath([
              [30, 176, 34, 4],
              [150, 176, 34, 4],
            ])}
            fill="#141618"
          />
        </g>
        {/* the cyclist, who is out unless it is snowing */}
        {!snow ? (
          <g>
            <g>
              <path d={FG_CYCLIST.wheels} fill={FGK.tyre} />
              <path d={FG_CYCLIST.frame} fill={FGK.bike} />
              <path d={FG_CYCLIST.rider} fill="#3a4650" />
              <path d={FG_CYCLIST.helmet} fill="#c9463c" />
              {dark ? <path d={pxPath([[52, 164, 4, 3]])} fill="#ff6a5a" /> : null}
            </g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="1340 0;1340 0;-80 0;-80 0"
              keyTimes="0;0.42;0.72;1"
              dur="38s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}
        {/* the carrier bag on the wind, which crosses once every twenty seconds */}
        <g>
          <path d={FG_BAG} fill={FGK.bagLitter} opacity={0.85} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-30 0;-30 0;300 -14;700 6;1040 -8;1330 4;1330 4"
            keyTimes="0;0.2;0.38;0.55;0.72;0.9;1"
            dur="21s"
            repeatCount="indefinite"
          />
        </g>

        {/* ---- overhead: the cables, the bird, the branch ------------------ */}
        {FG_CABLES.map((d, i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: cables are static spans
            key={i}
            d={d}
            stroke={i === 2 ? FGK.cableHi : FGK.cable}
            strokeWidth="1"
            fill="none"
            opacity={i === 2 ? 0.55 : 0.8}
          />
        ))}
        <g>
          <path d={FG_BIRD} fill={FGK.bird} />
          <animateTransform
            attributeName="transform"
            type="rotate"
            calcMode="discrete"
            values="0 638 24;0 638 24;-10 638 24;0 638 24;0 638 24"
            dur="8.6s"
            repeatCount="indefinite"
          />
        </g>
        <path d={FG_BRANCH} fill={FGK.branch} />
        {!bare ? (
          <path
            d={FG_BRANCH_LEAVES}
            fill={autumn ? FGK.branchLeaf : HEDGE[ph].base}
            opacity={0.95}
          />
        ) : null}
        {snow ? (
          <path
            d={pxPath([
              [0, 1, 210, 2],
              [96, 5, 80, 2],
            ])}
            fill={K.snow}
          />
        ) : null}

        {/* ---- weather nearest the lens ------------------------------------ */}
        {rain ? (
          <path
            d={pxPath(
              Array.from(
                { length: 22 },
                (_, i) =>
                  [((i * 173) % (STREET_W + 60)) - 30, ((i * 61) % 200) - 20, 2, 12] as Rect,
              ),
            )}
            fill="#c2d4e0"
            opacity={0.4}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-26 210"
              dur="0.45s"
              repeatCount="indefinite"
            />
          </path>
        ) : null}
        {wet ? (
          <rect x={0} y={ROAD} width={STREET_W} height={H - ROAD} fill="#101a26" opacity={0.3} />
        ) : null}
        <Vignette set={VIGNETTE} strength={night ? 1 : 0.6} />
      </g>
    </svg>
  );
}

/* ==================================================================== *
 * NOTES
 *
 * DRAW ORDER. The bus is first of the near objects, not last, because it pulls
 * up against the player's kerb — so the hedges, the planter, the parked car, the
 * bollard and the near lane all pass in front of it. That is what makes the
 * street read as having depth rather than as a bus pasted over a backdrop.
 *
 * THE 26 s TIMELINE, so anything you add to it stays in step:
 *
 *     0.00 – 0.16   off frame left, waiting
 *     0.16 – 0.36   approach                      front indicator 0.20 – 0.39
 *     0.36 – 0.62   stopped at the kerb           brakes 0.30 – 0.64
 *                                                 doors open 0.38 – 0.62
 *                                                 passenger off 0.44 – 0.59
 *     0.62 – 0.86   pulls away                    rear indicator 0.62 – 0.81
 *     0.86 – 1.00   off frame right
 *
 * The bus stop's board already flashes red on `bus === "arriving"` and Heniek
 * already steps forward on it, so all three are on the same event.
 *
 * ONE THING WORTH KNOWING. `BUS_TYRE` is 40 px and `BUS_TYRE / 2` is used in the
 * arch and tyre paths, so it must stay even or the wheels come off the pixel
 * grid. If you retune it, keep it even.
 *
 * NO ARTKEY CHANGE — reads `s.bus`, `s.season`, `s.weather` and the phase.
 * ==================================================================== */

/* ================================================================== *
 * effects
 * ================================================================== */

const SMOKER_LINES = [
  "Tu człowiek mieszka całe życie, a nowych mord co chwilę przybywa.",
  "Kurwa, paczka kosztuje teraz jak porządny obiad.",
  "Dobra, stoję pięć minut i idę. Nie mam dziś czasu.",
  "Znowu coś wiercą od rana. Co oni tam budują?",
  "Wszyscy mnie znają, a jak trzeba coś załatwić, to nagle nikt nie zna.",
  "Spokojnie, ja tu tylko stoję i palę. Nic się nie dzieje.",
] as const;

const BABCIA_LINES = [
  "Gołębie mnie już poznają. Ten szary przychodzi codziennie.",
  "Kotek to przynajmniej człowieka wysłucha. Nie tak jak ludzie.",
  "Ja tu mieszkam trzydzieści lat. Ja wiem, co się tutaj dzieje.",
  "W nocy znowu ktoś chodził po klatce. Słyszałam. O drugiej siedemnaście.",
  "Ta pani z trzeciego piętra znowu wyrzuciła śmieci nie do tego kontenera.",
  "Nie patrz tak na mnie, ja tylko pytam. Z ciekawości.",
] as const;

const HENIEK_LINES = [
  "No kurwa, ile można czekać na ten autobus?!",
  "Pięć minut. Jasne. Tablica kłamie już od dwudziestu.",
  "Kiedyś jeździł normalnie. Teraz człowiek nie wie, czy w ogóle przyjedzie.",
  "Jak ten autobus zaraz nie przyjedzie, to mnie szlag trafi.",
  "No oczywiście. Jak mam być punktualnie, to akurat dzisiaj go nie ma.",
  "Kurwa, zimno, wieje, a oni sobie chyba jaja robią.",
  "O, jedzie! No łaskawca się znalazł.",
  "To jest jakiś żart. Co miesiąc drożej, a autobusów coraz mniej.",
  "Jeszcze pięć minut i idę pieszo. Mam dosyć tego czekania.",
  "No wreszcie, kurwa. Ile można?!",
] as const;

/** The hour, as a colour over everything. Outdoors this is most of the model. */
const CAST: Record<Ph, { fill: string; op: number }> = {
  dawn: { fill: DAWN_CAST, op: 0.18 },
  day: { fill: "#fff4d8", op: 0.05 },
  dusk: { fill: DUSK_CAST, op: 0.2 },
  night: { fill: NIGHT_CAST, op: 0.4 },
};

/** Rain in three sheets, snow in three drifts. One path, one animation each. */
const RAIN_SHEETS = [0, 1, 2].map((i) =>
  pxPath(
    Array.from(
      { length: 56 },
      (_, j) =>
        [
          ((j * 149 + i * 47) % (STREET_W + 40)) - 20,
          ((j * 53 + i * 29) % 200) - 20,
          1,
          i === 0 ? 7 : i === 1 ? 5 : 4,
        ] as Rect,
    ),
  ),
);
const SNOW_SHEETS = [0, 1, 2].map((i) =>
  pxPath(
    Array.from(
      { length: 44 },
      (_, j) =>
        [
          ((j * 163 + i * 61) % (STREET_W + 40)) - 20,
          ((j * 71 + i * 37) % 200) - 20,
          i === 0 ? 2 : 1,
          i === 0 ? 2 : 1,
        ] as Rect,
    ),
  ),
);
/** Leaves crossing the pavement, because nothing here stands still. */
const LEAF_SEEDS = [
  { x: 180, d: "19s", b: "0s", y: 150 },
  { x: 520, d: "24s", b: "6s", y: 156 },
  { x: 860, d: "21s", b: "11s", y: 152 },
  { x: 1120, d: "26s", b: "3s", y: 158 },
] as const;
/** The moths that live in every street lamp. */
const MOTHS = [0, 1, 2] as const;

function StreetEffects({
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
  const s = state(world, ph);
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const lit = lampsOn(s, ph);
  const open = s.zabka !== "closed";
  return (
    <>
      {/* the pavement's regulars, built from the NPC rig */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${STREET_W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {s.smoker !== "away" ? <NpcActor npc={NPCS.smoker} x={254} facing={1} /> : null}
        {s.babcia !== "away" ? (
          <NpcActor npc={NPCS.babcia} x={800} facing={1} shadow={false} />
        ) : null}
        {s.heniek ? (
          <NpcActor
            npc={NPCS.waiting}
            objId="waiting-man"
            /* he steps to the kerb when the bus is finally coming */
            x={s.bus === "arriving" ? 502 : 496}
            facing={1}
            action={s.bus === "arriving" ? "notice" : undefined}
          />
        ) : null}
      </svg>
      {s.smoker !== "away" ? (
        <Monologue
          x={254}
          headY={74}
          scale={scale}
          speaker="Smoker"
          lines={SMOKER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.babcia !== "away" ? (
        <Monologue
          x={800}
          headY={82}
          scale={scale}
          speaker="Babcia Krysia"
          lines={BABCIA_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.heniek ? (
        <Monologue
          x={498}
          headY={78}
          scale={scale}
          speaker="Pan Heniek"
          lines={HENIEK_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${STREET_W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* the hour */}
          <rect
            width={STREET_W}
            height={H}
            fill={CAST[ph].fill}
            opacity={CAST[ph].op}
            style={{ transition: STEP_FADE }}
          />
          {/* the sun, which only reaches the building line down the passage */}
          {ph === "dawn" ? <Light set={DAWN_SHAFT} /> : null}
          {ph === "day" && s.weather === "clear" ? <Light set={DAY_SHAFT} /> : null}
          {/* seven artificial sources at four temperatures */}
          <g opacity={lit ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={LAMP_CONES} />
            <Light set={LAMP_POOLS} />
            <path d={LAMP_HALO.halo} fill={dth("w", "12")} opacity={0.35} />
            <path d={LAMP_HALO.core} fill="#fff8e0" opacity={0.9} />
            {/* and the moths, which only exist because the lamps do */}
            {LAMP_X.map((x) => (
              <g key={x}>
                {MOTHS.map((i) => (
                  <rect
                    key={i}
                    x={x - 6 + i * 6}
                    y={46 + i * 3}
                    width={2}
                    height={2}
                    fill="#e8dfc0"
                    opacity={0.7}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={`0 0; ${8 - i * 3} ${-5 + i}; ${-6 + i * 2} ${7 - i}; ${4 + i} 3; 0 0`}
                      dur={`${2.4 + i * 0.6}s`}
                      repeatCount="indefinite"
                    />
                  </rect>
                ))}
              </g>
            ))}
          </g>
          {open ? (
            <>
              <Light set={SPILL_ZABKA} op={dark ? 1 : 0.3} />
              <Light set={SPILL_FASCIA} op={dark ? 0.9 : 0.2} />
            </>
          ) : null}
          {s.klatka !== "off" ? <Light set={SPILL_KLATKA} op={dark ? 1 : 0.25} /> : null}
          <Light set={SPILL_PACZ} op={night ? 1 : 0.2} />
          {s.bankomat !== "broken" ? <Light set={SPILL_BANK} op={dark ? 1 : 0.2} /> : null}
          {s.crowd >= 1 || dark ? <Light set={SPILL_SILKA} op={dark ? 1 : 0.3} /> : null}
          {s.bus !== "none" ? <Light set={SPILL_BOARD} op={dark ? 1 : 0.3} /> : null}
          {dark ? <Light set={SPILL_PASSAGE} /> : null}
          {dark ? <Light set={SILL_SPILL} /> : null}

          {/* weather */}
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
              {/* the bounce off the slabs, and the drip line off Żabka's awning */}
              <path
                d={pxPath(
                  Array.from({ length: 32 }, (_, i) => [20 + i * 40, GROUND + 2, 2, 1] as Rect),
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
              <path
                d={pxPath(
                  Array.from(
                    { length: 14 },
                    (_, i) => [310 + i * 20, FASCIA_BOT + 6, 1, 5] as Rect,
                  ),
                )}
                fill={K.waterHi}
                opacity={0.45}
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;0 74"
                  dur="0.85s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {s.weather === "snow" ? (
            <g>
              {SNOW_SHEETS.map((d, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static snow sheets
                <path key={i} d={d} fill={K.snow} opacity={0.75 - i * 0.18}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0 0;${-20 - i * 9} 200`}
                    dur={`${3.4 + i * 1.1}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}
            </g>
          ) : null}
          {s.weather === "overcast" ? (
            <rect width={STREET_W} height={H} fill="#9aa4ac" opacity={0.14} />
          ) : null}
          {s.season === "autumn" && s.weather !== "snow" ? (
            <g>
              {LEAF_SEEDS.map((sd) => (
                <g key={sd.x}>
                  <path
                    d={pxPath([
                      [sd.x, sd.y, 3, 2],
                      [sd.x + 1, sd.y - 1, 1, 1],
                    ])}
                    fill={K.leafDry}
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;60 -6;140 2;230 -4;320 0"
                    dur={sd.d}
                    begin={sd.b}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;1;0"
                    dur={sd.d}
                    begin={sd.b}
                    repeatCount="indefinite"
                  />
                </g>
              ))}
            </g>
          ) : null}
          {/* the manhole breathes when it is cold enough to see it */}
          {isSnow(s) || ph === "dawn" ? (
            <path d={pxPath([[924, 150, 14, 8]])} fill={dth("c", "12")} opacity={0.4}>
              <animate
                attributeName="opacity"
                values="0.4;0.12;0.35;0.15;0.4"
                dur="7.4s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}

          {/* --- transients: none of this is in artKey, which is why it is here --- */}
          {actionUi === "paczkomat" ? (
            <path
              d={pxPath(steppedEllipse(642, 100, 26, 18, 2))}
              fill={dth("c", "25")}
              opacity={0.4}
            >
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.4;0.15;0.4;0.2"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {actionUi === "bins" ? (
            <path d={pxPath([[688, 90, 74, 6]])} fill={dth("n", "25")} opacity={0.4} />
          ) : null}
          {actionUi === "smoke" ? (
            <path d={pxPath([[268, 100, 2, 2]])} fill={K.white} opacity={0.5} />
          ) : null}
          <Vignette set={VIGNETTE} strength={night ? 0.4 : 0} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition — all 30 original hitboxes at their original x, plus 7 new
 * ================================================================== */

export const STREET_SCENE: RuntimeSceneDef<WorldState> = {
  id: "outside",
  width: STREET_W,
  /**
   * Every world read the art performs. The old key was JSON.stringify(w.street),
   * which repainted on flags the art never looked at; this one lists them.
   */
  artKey: (w, ph) => {
    const p = toPhase(ph);
    const s = state(w, p);
    return [
      ph,
      s.zabka,
      s.paczkomat,
      s.bins,
      s.binOpen ? 1 : 0,
      s.kosz,
      s.bus,
      s.cat,
      s.catFed ? 1 : 0,
      s.babcia,
      s.smoker,
      s.heniek ? 1 : 0,
      s.klatka,
      s.trzepak,
      s.bankomat,
      s.bikes,
      s.crowd,
      s.lamps,
      s.weather,
      s.season,
    ].join("|");
  },
  objects: [
    { id: "graffiti", kind: "flavor", x: 112, range: 14 },
    { id: "notice-board", kind: "flavor", x: 142, range: 12 },
    { id: "plaque-14", kind: "flavor", x: 162, range: 5 },
    {
      id: "podezd-door",
      kind: "creakdoor",
      x: 188,
      range: 20,
      to: { scene: "elevator", spawnX: 100 },
    },
    { id: "domofon", kind: "flavor", x: 230, range: 6 },
    { id: "smoker", kind: "npc", priority: 2, x: 254, range: 18 },
    /* --- new: the post box --- */
    { id: "postbox", kind: "flavor", x: 284, range: 10 },
    { id: "sandwich-board", kind: "flavor", x: 306, range: 10 },
    { id: "zabka-window", kind: "flavor", x: 360, range: 24 },
    { id: "zabka-hours", kind: "flavor", x: 412, range: 14 },
    {
      id: "zabka-door",
      kind: "creakdoor",
      x: 456,
      range: 22,
      to: { scene: "zabka", spawnX: 60 },
    },
    { id: "waiting-man", kind: "npc", priority: 2, x: 496, range: 12 },
    { id: "bus-stop", kind: "flavor", x: 528, range: 16 },
    /* --- new: the adverts on the shelter glass --- */
    { id: "shelter-ad", kind: "flavor", x: 556, range: 12 },
    { id: "puddle", kind: "flavor", x: 578, range: 10 },
    { id: "hedge", kind: "flavor", x: 610, range: 10 },
    { id: "paczkomat", kind: "paczkomat", x: 644, range: 18 },
    /* --- new: the planter --- */
    { id: "planter", kind: "flavor", x: 684, range: 20 },
    { id: "bins", kind: "bins", x: 724, range: 20 },
    { id: "cat", kind: "flavor", x: 768, range: 10 },
    { id: "babcia", kind: "npc", priority: 2, x: 800, range: 18 },
    { id: "bench", kind: "flavor", x: 830, range: 10 },
    { id: "kosz", kind: "flavor", x: 856, range: 10 },
    { id: "bike-rack", kind: "flavor", x: 894, range: 16 },
    { id: "manhole", kind: "flavor", x: 930, range: 10 },
    { id: "vybivalka", kind: "flavor", x: 974, range: 12 },
    { id: "bankomat", kind: "flavor", x: 1003, range: 14 },
    /* --- new: the telecom cabinet --- */
    { id: "cabinet", kind: "flavor", x: 1038, range: 18 },
    { id: "plaque-16", kind: "flavor", x: 1062, range: 5 },
    { id: "klatka-16", kind: "flavor", x: 1082, range: 14 },
    /* --- new: the hedge in front of block 16 --- */
    { id: "hedge-16", kind: "flavor", x: 1110, range: 12 },
    { id: "bankomat-16", kind: "flavor", x: 1141, range: 14 },
    { id: "parter-window", kind: "flavor", x: 1177, range: 12 },
    /* --- new: the RUCH kiosk --- */
    { id: "kiosk", kind: "flavor", x: 1206, range: 16 },
    {
      id: "district-door",
      kind: "door",
      priority: 1,
      x: 1252,
      range: 24,
      to: { scene: "district", spawnX: 56 },
    },
  ],
  Component: ({ world, phase }) => <StreetScene world={world} phase={phase} />,
  darkness: (phase) => (phase === "night" ? 0.32 : phase === "dusk" ? 0.16 : 0),
  // Foreground: (p) => <StreetFront {...p} />,
  Effects: StreetEffects,
  idleLean: true,
};
