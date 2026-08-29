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
  SharedDefs,
  STEP_FADE,
  STEP_SLIDE,
  steppedEllipse,
  steppedQuad,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { bandShade, courses, plates, scatter, wearLane } from "@/engine/scene/groundKit";
import { type DayPhase, roomDarkness, type WorldState } from "@/lib/worldState";

// --- SYPIALNIA / the bedroom, floor 4 -----------------------------------------------

/**
 * Third pass. Sleep on one side, iron and code on the other — rebuilt to the
 * house standard and given a state machine per fixture.
 *
 * Five planes, where there were two:
 *   farBackground (0.88) — the yard beyond the glass. Twenty metres of enclosed
 *     courtyard, the block opposite, one streetlamp. It lags the window frame,
 *     which is the whole reason the glass reads as glass rather than as a
 *     picture of a window.
 *   middleBackground (1.0) — ceiling, cornice, wall, skirting, and everything
 *     hanging on the wall: polaroids, calendar, shelf, the icon, the sconce,
 *     the window frame, the curtains, the door, the radiator.
 *   ground (1.0) — floorboards, the rug, and every pool of light. All hitboxes
 *     resolve against this plane, at the original x positions.
 *   staticObjects (1.0) — desk, chair, girias, bed, bedside, wardrobe.
 *   Foreground (fixed) — the near edge: the underside of the ceiling, the very
 *     near end of the folded blanket at the bottom right, six pixels of board.
 *
 * LIGHTING PREMISE, and it drives every branch below. The window faces an
 * enclosed yard, so this room never gets the sun square on — only raked, and
 * only at the ends of the day. That makes the shaft across the floorboards the
 * entire daytime model: steep and cool at dawn, the familiar diagonal by day,
 * long and orange at dusk, gone at night. The curtains gate it in three stages,
 * which is the cheapest big lighting change in the flat.
 *
 * After dark there are three artificial sources and they are deliberately three
 * different temperatures: the sconce over the bed (warm, high), the bedside lamp
 * (warm, low, and it is the one that makes the pool on the rug), and the CRT
 * (green, and the only cold light in the room). Three colours of light in one
 * frame is what makes a bedroom at night look like a bedroom at night.
 *
 * All of it is quantised — stepped shafts, stepped pools, dithered edges. No
 * gradients and no ellipses anywhere. The CRT needs a green dither the kit does
 * not carry, so this scene mounts its own, prefixed `bd-`.
 *
 * STATE. Ten reads now, where there were four:
 *
 *   bed       made → slept → unmade
 *   desk      clear → working → buried
 *   pc        off → boot → terminal → idle
 *   curtains  open → half → drawn
 *   laundry   0 none → 1 chair → 2 chair and floor → 3 losing
 *   plant     0 thirsty → 1 → 2 lush
 *   weights   racked → out → chalked
 *   devotion  idle → rosary → candle
 *   alarmArmed, heating — booleans, each one changes real geometry
 *
 * plus the four this scene already read: lights.study, windows["window-yard"],
 * doorOpening, wardrobeOpen.
 *
 * TRANSIENTS. Anything driven by `actionUi` — a giria being swung, the barbell
 * pressed, a prayer said, a cigarette at the open sash — lives in
 * BedroomEffects. The art holds what is true when nobody is touching anything.
 * If this scene is migrated to RuntimeSceneDef, `bedroomArtKey` at the foot of
 * the file is already the correct key; wire it up and do not let it drift.
 *
 * ONE DELIBERATE RULE BREAK. The house standard is light from the top-left,
 * everywhere. When the tealight under the icon is lit, the icon is lit from
 * below, so its frame carries a warm underline along the bottom and the top
 * edge goes dark. That is the only inversion in the flat and it is there
 * because a candle under a picture is the one light source a person actually
 * places beneath a thing.
 *
 * Budget: ~340 nodes at the busiest state, 18 animations declared, 12 of them
 * on calcMode="discrete" so nothing eases. Zero gradients, zero ellipses. The
 * icon was ~60 rects and is now 30 paths with identical pixels. The dust motes
 * were 7 nodes and 21 animations and are now one path and one.
 */

const W = 560;
const H = 180;

/* Landmark rows. */
const CEIL = 46; // underside of the ceiling
const SILL = 104; // window sill
// DESK_TOP = 108 — kept as layout documentation
const BED_TOP = 114;
const SKIRT = 146;
const FLOOR = 150; // board surface
const CY = 149; // where contact shadows sit

/** The icon's field, kept exact — the recognition cues depend on it. */
const ICON_CX = 329;

/* ================================================================== *
 * palette
 * ================================================================== */

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

/** The sage-green emulsion somebody chose in about 2006 and never revisited. */
const WALL_MAT: Mat = {
  hi: "#c3c9bd",
  base: "#b6bdb1",
  mid: "#aeb5a9",
  lo: "#a7aea2",
  deep: "#8b9187",
};
/** Old pine boards, waxed twice and mopped a thousand times. */
const BOARD_MAT: Mat = {
  hi: "#bd9b6a",
  base: "#a8875a",
  mid: "#9e7d52",
  lo: "#96774e",
  deep: "#87693f",
};
const CEIL_MAT: Mat = {
  hi: "#f0ece2",
  base: "#e7e3d9",
  mid: "#ddd8cd",
  lo: "#d4cfc2",
  deep: "#bdb8ab",
};
/** A faded kilim that came from a market and has been walked on since. */
const KILIM_MAT: Mat = {
  hi: "#8d7e83",
  base: "#7e6f74",
  mid: "#74666b",
  lo: "#6d6066",
  deep: "#544a4f",
};

const WALL = ramp(WALL_MAT);
const BOARD = ramp(BOARD_MAT);
const CEILING = ramp(CEIL_MAT);
const KILIM = ramp(KILIM_MAT);
const OAK = ramp(M.oak);
const WALNUT = ramp({
  hi: "#75604a",
  base: "#5d4a37",
  mid: "#52402f",
  lo: "#43362a",
  deep: "#33291f",
});
const LINEN = ramp(M.linen);
const DUVET = ramp({
  hi: "#8ba2b3",
  base: "#7a8f9f",
  mid: "#71848f",
  lo: "#687c8b",
  deep: "#4f6270",
});
const IRON = ramp({
  hi: "#3a3d43",
  base: "#26282c",
  mid: "#222428",
  lo: "#1b1d20",
  deep: "#121417",
});
const GRAPHITE = ramp(M.graphite);
const LAMINATE = ramp(M.laminate);

const K = {
  /** what the glass is, per hour. No image — the yard plane behind supplies that. */
  glass: {
    dawn: "#c6bcd0",
    day: "#a8c2d4",
    dusk: "#c08a67",
    night: "#232a34",
  } as Record<Ph, string>,
  sky: { dawn: "#a8a2c0", day: "#bcd2e0", dusk: "#d8a478", night: "#141a24" } as Record<Ph, string>,
  /** nicotine bloom around the sconce, and the ghost where a poster hung */
  wallWarm: "#c2bfa9",
  wallCold: "#9fa79c",
  wallGhost: "#c3c9bd",
  cream: "#f2ede0",
  blanket: "#8a3a34",
  blanketHi: "#a34a3a",
  blanketLo: "#6d2c28",
  wool: "#6f6a63",
  woolHi: "#847e75",
  rose: "#b98b86",
  brass: M.brass.base,
  brassLo: M.brass.deep,
  warm: "#ffd98a",
  warmLo: "#8f8468",
  /** the CRT's phosphor, and the amber of a tealight */
  green: "#7ee08c",
  greenLo: "#3d5c45",
  candle: "#ffb14a",
  candleHi: "#ffd58a",
  red: "#d84a3a",
  leafDry: "#7a6a3a",
  chalk: "#e4e2da",
  dust: "#b39268",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

export type BedStage = "made" | "slept" | "unmade";
export type DeskStage = "clear" | "working" | "buried";
export type PcStage = "off" | "boot" | "terminal" | "idle";
export type CurtainStage = "open" | "half" | "drawn";
export type WeightStage = "racked" | "out" | "chalked";
export type DevotionStage = "idle" | "rosary" | "candle";

const BED_STAGES: readonly BedStage[] = ["made", "slept", "unmade"];
const DESK_STAGES: readonly DeskStage[] = ["clear", "working", "buried"];
const PC_STAGES: readonly PcStage[] = ["off", "boot", "terminal", "idle"];
const CURTAIN_STAGES: readonly CurtainStage[] = ["open", "half", "drawn"];
const WEIGHT_STAGES: readonly WeightStage[] = ["racked", "out", "chalked"];
const DEVOTION_STAGES: readonly DevotionStage[] = ["idle", "rosary", "candle"];

type BedroomState = {
  lightOn: boolean;
  winOpen: boolean;
  wardrobeOpen: boolean;
  opening: string | null;
  bed: BedStage;
  desk: DeskStage;
  pc: PcStage;
  curtains: CurtainStage;
  laundry: 0 | 1 | 2 | 3;
  plant: 0 | 1 | 2;
  weights: WeightStage;
  devotion: DevotionStage;
  alarmArmed: boolean;
  heating: boolean;
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
 * `world.bedroom` may not exist. Every key falls back to the state this room
 * was in before any of it was modelled, so a save from the previous pass loads
 * into exactly the frame it used to draw.
 */
function state(world: WorldState): BedroomState {
  const w = world as unknown as Record<string, unknown>;
  const b = (w.bedroom ?? {}) as Record<string, unknown>;
  const win = world.windows["window-yard"];
  return {
    lightOn: !!world.lights.study,
    winOpen: !!win?.open,
    wardrobeOpen: w.wardrobeOpen === true,
    opening: (w.doorOpening as string | null) ?? null,
    bed: clampStage(b.bed, BED_STAGES, "slept"),
    desk: clampStage(b.desk, DESK_STAGES, "working"),
    /** the old scene showed the terminal whenever it was not a dark night */
    pc: clampStage(b.pc, PC_STAGES, "terminal"),
    curtains: clampStage(b.curtains, CURTAIN_STAGES, "open"),
    laundry: clampInt(b.laundry, 3, 1) as 0 | 1 | 2 | 3,
    plant: clampInt(b.plant, 2, 1) as 0 | 1 | 2,
    weights: clampStage(b.weights, WEIGHT_STAGES, "racked"),
    devotion: clampStage(b.devotion, DEVOTION_STAGES, "idle"),
    alarmArmed: b.alarmArmed !== false,
    heating: b.heating !== false,
  };
}

/** Everything that puts light in the room after dark, in one place. */
function litSources(s: BedroomState, ph: Ph) {
  const screenOn = s.pc !== "off";
  return {
    sconce: s.lightOn,
    bedside: s.lightOn,
    screen: screenOn && (ph !== "night" || s.lightOn || s.pc === "idle"),
    candle: s.devotion === "candle",
  };
}

/** How far the shaft gets in, given the curtains. */
const CURTAIN_GATE: Record<CurtainStage, number> = { open: 1, half: 0.5, drawn: 0 };

/* ================================================================== *
 * scene-local dither: the kit has no green
 * ================================================================== */

function BedroomDefs() {
  return (
    <defs>
      <pattern id="bd-dg50" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.green} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={K.green} fillOpacity="0.55" />
      </pattern>
      <pattern id="bd-dg25" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.green} fillOpacity="0.5" />
      </pattern>
      <pattern id="bd-dg12" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.green} fillOpacity="0.45" />
        <rect x="2" y="2" width="1" height="1" fill={K.green} fillOpacity="0.45" />
      </pattern>
      {/* the tealight is warmer and redder than any LED in the flat */}
      <pattern id="bd-dc50" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.candle} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={K.candle} fillOpacity="0.55" />
      </pattern>
      <pattern id="bd-dc25" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.candle} fillOpacity="0.5" />
      </pattern>
    </defs>
  );
}

/** Three tiers by hand, since tiers() only knows the kit's four tints. */
/** v2, matching the kit: solid low-alpha bands — phosphor glows, it doesn't speckle. */
function localTiers(
  build: (k: number) => Rect[],
  _ids: [string, string],
  solid: string,
): LightTier[] {
  return [
    { d: pxPath(build(1)), fill: solid, o: 0.07 },
    { d: pxPath(build(0.78)), fill: solid, o: 0.08 },
    { d: pxPath(build(0.52)), fill: solid, o: 0.1 },
    { d: pxPath(build(0.3)), fill: solid, o: 0.12 },
  ];
}

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/** Boards: alternating tone, edge lines, course seams, short joints. */
const BOARDS = (() => {
  const alt: Rect[] = [];
  for (let x = 15; x < W; x += 60) alt.push([x, FLOOR, Math.min(30, W - x), H - FLOOR]);
  return {
    alt: pxPath(alt),
    edge: pxPath(repeat(19, 30, [15, FLOOR, 1, H - FLOOR] as Rect)),
    /* board-end joints across the run, foreshortening toward the camera */
    seam: courses(0, W, FLOOR, H, { far: 7, near: 11 }).joints,
    joint: pxPath([
      [78, 150, 1, 8],
      [212, 158, 1, 10],
      [336, 150, 1, 8],
      [430, 168, 1, 8],
      [494, 158, 1, 10],
    ]),
  };
})();

/** No two boards came off the same tree. */
const BOARD_TONE = plates(0, W, FLOOR, H, {
  far: 7,
  near: 11,
  unit: 30,
  seed: 6,
  dark: 0.15,
  pale: 0.06,
});
const FLOOR_SHADE = bandShade(0, W, FLOOR, H);
/** Door to bed, and the short line from the desk to the weights. */
const FLOOR_WEAR = [wearLane(60, 380, FLOOR + 10, 3, 12), wearLane(200, 300, FLOOR + 15, 2, 13)];
/** The dust that lives under a bed, and the chalk that lives near a kettlebell. */
const UNDER_BED = scatter(320, 450, 170, 178, 9, 14, 1, 1);
const CHALK = scatter(258, 306, 164, 176, 6, 15, 1, 1);

/** The rug, and the nine diamonds worn into it. */
const RUG_MOTIF = (() => {
  const outer: Rect[] = [];
  const inner: Rect[] = [];
  for (let x = 304; x <= 432; x += 16) {
    outer.push([x, 161, 6, 6]);
    inner.push([x + 2, 163, 2, 2]);
  }
  return { outer: pxPath(outer), inner: pxPath(inner) };
})();

/** Radiator fins: 7 of them, two paths. */
const RADIATOR_FINS = (() => {
  const face: Rect[] = [];
  const hi: Rect[] = [];
  for (const x of [106, 112, 118, 124, 130, 136, 142]) {
    face.push([x, 114, 3, 26]);
    hi.push([x, 114, 1, 26]);
  }
  return { face: pxPath(face), hi: pxPath(hi) };
})();

/** Dust in the shaft: one path, one drift, one breath. Was 7 nodes, 21 animates. */
const MOTES_D = pxPath([
  [122, 128, 1, 1],
  [141, 146, 1, 1],
  [158, 134, 2, 2],
  [173, 158, 1, 1],
  [190, 142, 1, 1],
  [206, 164, 1, 1],
  [133, 112, 1, 1],
  [151, 122, 1, 1],
  [182, 152, 1, 1],
]);

/**
 * The shaft, per phase. Dawn comes in steep and cool because the sun is still
 * behind the block opposite; day is the diagonal this scene has always had;
 * dusk rakes long and low and reaches the rug.
 */
const SHAFT: Record<Ph, LightTier[] | null> = {
  dawn: tiers(
    (k) =>
      steppedQuad(
        SILL + 2,
        100 + (1 - k) * 14,
        142 - (1 - k) * 14,
        H,
        126 + (1 - k) * 14,
        186 - (1 - k) * 14,
        8,
      ),
    "c",
    0.8,
  ),
  day: tiers(
    (k) =>
      steppedQuad(
        SILL + 2,
        100 + (1 - k) * 16,
        156 - (1 - k) * 16,
        H,
        150 + (1 - k) * 20,
        232 - (1 - k) * 20,
        8,
      ),
    "w",
    1,
  ),
  dusk: tiers(
    (k) =>
      steppedQuad(
        124,
        104 + (1 - k) * 20,
        168 - (1 - k) * 20,
        H,
        228 + (1 - k) * 30,
        352 - (1 - k) * 30,
        10,
      ),
    "e",
    0.9,
  ),
  night: null,
};

/** The three warm pools, and the one green one. */
const SCONCE_POOL = tiers(
  (k) => steppedEllipse(394, 80, Math.round(46 * k), Math.round(30 * k), 2),
  "w",
  0.95,
);
const BEDSIDE_POOL = tiers(
  (k) => steppedEllipse(475, 112, Math.round(38 * k), Math.round(26 * k), 2),
  "w",
  0.9,
);
const FLOOR_POOL = tiers(
  (k) => steppedEllipse(420, 160, Math.round(72 * k), Math.round(20 * k), 2),
  "w",
  0.8,
);
const CRT_GLOW = localTiers(
  (k) => steppedEllipse(201, 91, Math.round(34 * k), Math.round(22 * k), 2),
  ["bd-dg25", "bd-dg50"],
  K.green,
);
const CANDLE_GLOW = localTiers(
  (k) => steppedEllipse(ICON_CX, 100, Math.round(26 * k), Math.round(20 * k), 2),
  ["bd-dc25", "bd-dc50"],
  K.candleHi,
);
const LAMP_SOURCES = bulbPaths([
  [394, 67],
  [475, 101],
]);

/** The stepped fall off the ceiling, replacing a linear gradient. */
const CEIL_FALL = [
  { d: pxPath([[0, 0, W, 8]]), f: dth("n", "25") },
  { d: pxPath([[0, 8, W, 8]]), f: dth("n", "12") },
  { d: pxPath([[0, 16, W, 10]]), f: dth("n", "06") },
];

const VIGNETTE = vignettePaths(W, H);

/* --- bevel sets, built once --- */

const DOOR_LEAF_SET = bevelPaths([
  [20, 62, 40, 88],
  [24, 68, 32, 34],
  [24, 106, 32, 36],
]);
const WIN_FRAME_SET = bevelPaths([[94, 52, 66, 56]]);
const DESK_SET = bevelPaths([
  [170, 108, 78, 5],
  [226, 115, 18, 26],
]);
const CRT_SET = bevelPaths([[182, 76, 38, 32]]);
const HEADBOARD_SET = bevelPaths([[322, 82, 126, 36]]);
const BEDSIDE_SET = bevelPaths([
  [456, 116, 34, 5],
  [460, 128, 26, 12],
]);
const WARDROBE_SET = bevelPaths([[494, 56, 54, 92]]);
const RADIATOR_SET = bevelPaths([[102, 112, 46, 30]]);
const CHAIR_SET = bevelPaths([
  [148, 112, 26, 5],
  [148, 84, 6, 28],
]);

const WALL_AO = aoPaths([
  [92, SILL + 4, 70], // window sill
  [206, 91, 44], // book shelf
  [170, 113, 78], // desk top
  [322, 118, 126], // headboard onto the duvet
  [456, 121, 34], // bedside top
  [102, 142, 46], // radiator
  [500, 56, 40], // suitcase on the wardrobe
]);

const FLOOR_CONTACT = contactPaths([
  [18, 46, CY],
  [144, 30, CY],
  [168, 82, CY],
  [250, 68, CY],
  [318, 134, CY],
  [454, 38, CY],
  [492, 56, CY],
]);

/* ================================================================== *
 * the icon — same pixels, grouped by colour into one path each
 * ================================================================== */

/**
 * Christ Pantocrator, 23x34 logical pixels, laid out symmetrically about
 * x=329. Recognition rests on four cues that survive at this size: the
 * cruciform nimbus, centre-parted hair past the shoulders with a full beard,
 * the red tunic under a blue mantle, and the two-finger blessing with the
 * gospel book. The rect coordinates below are unchanged from the previous pass
 * — only their grouping is. Do not retune them without redrawing the whole
 * portrait; at this scale every pixel is a cue.
 */
const ICON = {
  frameOuter: pxPath([[311, 47, 37, 48]]),
  frameFace: pxPath([[312, 48, 35, 46]]),
  frameTop: pxPath([[312, 48, 35, 2]]),
  frameBot: pxPath([[312, 92, 35, 2]]),
  rosetteTop: pxPath([
    [313, 49, 3, 3],
    [343, 49, 3, 3],
  ]),
  rosetteBot: pxPath([
    [313, 90, 3, 3],
    [343, 90, 3, 3],
  ]),
  innerLip: pxPath([[316, 52, 27, 38]]),
  ground0: pxPath([[317, 53, 25, 36]]),
  ground1: pxPath([[318, 54, 23, 33]]),
  ground2: pxPath([[318, 54, 23, 9]]),
  inscription: pxPath([
    [318, 55, 2, 2],
    [339, 55, 2, 2],
  ]),
  nimbus: pxPath([
    [326, 59, 7, 1],
    [324, 60, 11, 1],
    [323, 61, 13, 2],
    [322, 63, 15, 3],
    [321, 66, 17, 1],
    [322, 67, 15, 3],
    [323, 70, 13, 2],
    [324, 72, 11, 1],
  ]),
  nimbusLo: pxPath([[326, 73, 7, 1]]),
  cross: pxPath([
    [328, 59, 3, 3],
    [322, 65, 3, 3],
    [334, 65, 3, 3],
  ]),
  crossHi: pxPath([[329, 59, 1, 2]]),
  hair: pxPath([
    [324, 62, 11, 3],
    [325, 65, 1, 10],
    [332, 65, 1, 10],
    [326, 65, 7, 1],
    [327, 71, 5, 1],
    [326, 73, 7, 3],
  ]),
  hairLo: pxPath([
    [324, 65, 2, 16],
    [333, 65, 2, 16],
    [327, 76, 5, 2],
    [328, 78, 3, 1],
    [324, 78, 2, 4],
    [333, 78, 2, 4],
  ]),
  hairPart: pxPath([[329, 62, 1, 3]]),
  beardCore: pxPath([[329, 74, 1, 3]]),
  skin: pxPath([
    [326, 65, 7, 9],
    [322, 82, 1, 3],
    [324, 82, 1, 3],
    [321, 85, 5, 3],
  ]),
  skinLo: pxPath([
    [326, 66, 1, 8],
    [332, 66, 1, 8],
    [329, 69, 1, 2],
    [321, 85, 5, 1],
  ]),
  brow: pxPath([
    [327, 67, 1, 1],
    [331, 67, 1, 1],
  ]),
  pupil: pxPath([
    [327, 68, 1, 1],
    [331, 68, 1, 1],
  ]),
  mouth: pxPath([[328, 72, 3, 1]]),
  tunic: pxPath([
    [323, 78, 13, 1],
    [321, 79, 17, 1],
    [319, 80, 21, 8],
  ]),
  mantle: pxPath([
    [323, 78, 2, 1],
    [334, 78, 2, 1],
    [321, 79, 4, 1],
    [334, 79, 4, 1],
    [319, 80, 6, 8],
    [334, 80, 6, 8],
  ]),
  collar: pxPath([[326, 80, 7, 1]]),
  book: pxPath([[333, 83, 6, 5]]),
  bookGold: pxPath([
    [333, 83, 6, 1],
    [335, 84, 1, 3],
    [334, 85, 3, 1],
  ]),
  palm: pxPath([
    [348, 48, 2, 11],
    [349, 46, 3, 2],
  ]),
  palmLo: pxPath([[347, 53, 1, 4]]),
} as const;

/** Face-up (sconce) and face-under (tealight) are genuinely different palettes. */
function iconPalette(mode: "dark" | "sconce" | "candle") {
  const sconce = mode === "sconce";
  const candle = mode === "candle";
  return {
    gold: candle ? "#f0c882" : sconce ? "#e8c67e" : K.brass,
    goldLo: candle ? "#a87a38" : sconce ? "#c39a4e" : K.brassLo,
    skin: candle ? "#e8b283" : sconce ? "#e8bd94" : "#d8ac84",
    skinLo: candle ? "#b07a55" : sconce ? "#c99a72" : "#b98c66",
    tunic: candle ? "#a04038" : sconce ? "#93403a" : "#7f342f",
    mantle: candle ? "#40507a" : sconce ? "#3d5a86" : "#334b73",
    /** lit from below: the top edge loses its highlight, the bottom gains one */
    edgeTop: candle ? K.brassLo : sconce ? "#e6c274" : K.brass,
    edgeBot: candle ? "#ffd58a" : K.brassLo,
  };
}

function Icon({ mode }: { mode: "dark" | "sconce" | "candle" }) {
  const p = iconPalette(mode);
  return (
    <g>
      <path d={ICON.frameOuter} fill={K.brassLo} />
      <path d={ICON.frameFace} fill={K.brass} />
      <path d={ICON.frameTop} fill={p.edgeTop} />
      <path d={ICON.frameBot} fill={p.edgeBot} />
      <path d={ICON.rosetteTop} fill={mode === "sconce" ? "#f0d89a" : K.brass} />
      <path d={ICON.rosetteBot} fill={mode === "candle" ? "#f0d89a" : p.goldLo} />
      <path d={ICON.innerLip} fill={K.brassLo} />
      <path d={ICON.ground0} fill="#2a1f14" />
      <path d={ICON.ground1} fill="#3a2b1c" />
      <path d={ICON.ground2} fill="#48351f" />
      <path d={ICON.inscription} fill={p.goldLo} />
      <path d={ICON.nimbus} fill={p.gold} />
      <path d={ICON.nimbusLo} fill={p.goldLo} />
      <path d={ICON.cross} fill="#8a5a22" />
      <path d={ICON.crossHi} fill={mode === "dark" ? "#c9a45c" : "#f4dfa8"} />
      <path d={ICON.hairLo} fill="#33210f" />
      <path d={ICON.hair} fill="#3f2a1c" />
      <path d={ICON.hairPart} fill="#5f4230" />
      <path d={ICON.skin} fill={p.skin} />
      <path d={ICON.skinLo} fill={p.skinLo} />
      <path d={ICON.brow} fill="#8a6a4a" />
      <path d={ICON.pupil} fill="#33241a" />
      <path d={ICON.mouth} fill="#8a4a40" />
      <path d={ICON.beardCore} fill="#4d3423" />
      <path d={ICON.tunic} fill={p.tunic} />
      <path d={ICON.mantle} fill={p.mantle} />
      <path d={ICON.collar} fill={p.goldLo} />
      <path d={ICON.book} fill="#6e2b26" />
      <path d={ICON.bookGold} fill={p.gold} />
      {/* dried palm from a Palm Sunday nobody can date, tucked behind the frame */}
      <path d={ICON.palm} fill="#9a8a52" />
      <path d={ICON.palmLo} fill="#8d7e49" />
    </g>
  );
}

/* ================================================================== *
 * PLANE 1 — the yard beyond the glass (parallax 0.88)
 * ================================================================== */

function Yard({ ph }: { ph: Ph }) {
  const night = ph === "night";
  /** Drawn far wider than the opening so it never runs dry when it slides. */
  return (
    <g>
      {/* the defs live in the bottom-most plane of the scene and nowhere else */}
      <SharedDefs />
      <BedroomDefs />
      {px(40, 30, 200, 96, K.sky[ph])}
      {/* the block opposite, four floors of it, close enough to block the sun */}
      {px(40, 52, 200, 74, night ? "#1a2028" : "#8b8f8a")}
      {px(40, 52, 200, 2, night ? "#242b33" : "#9aa09a")}
      {px(40, 96, 200, 30, night ? "#151a20" : "#7a7e79")}
      {/* windows, most of them dark even in the evening */}
      {[
        { x: 82, y: 60, lit: night },
        { x: 96, y: 60, lit: false },
        { x: 110, y: 62, lit: !night },
        { x: 128, y: 60, lit: night },
        { x: 146, y: 62, lit: false },
        { x: 86, y: 80, lit: false },
        { x: 118, y: 82, lit: night },
        { x: 150, y: 80, lit: false },
      ].map((v) => (
        <g key={`${v.x}:${v.y}`}>
          {px(v.x, v.y, 8, 10, v.lit ? "#e8c98a" : night ? "#0f1319" : "#5f6b74")}
          {px(v.x, v.y, 8, 1, v.lit ? "#ffe0a8" : night ? "#161b22" : "#6f7b84")}
        </g>
      ))}
      {/* the streetlamp in the yard, which is the only thing out there at night */}
      {px(120, 66, 2, 40, night ? "#2a3038" : "#6d7278")}
      {night ? (
        <g>
          {px(116, 62, 10, 6, "#ffcf7a")}
          <path d={pxPath(steppedEllipse(121, 66, 12, 9, 2))} fill={dth("w", "25")} opacity={0.5}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.5;0.42;0.5;0.46"
              dur="6s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : (
        px(116, 62, 10, 6, "#8a8f96")
      )}
      {/* a tree that has been in that yard longer than the block has */}
      {px(156, 74, 3, 34, night ? "#1c2128" : "#5d4a37")}
      {px(148, 62, 20, 14, night ? "#1f2a24" : M.leaf.base)}
      {px(148, 62, 20, 2, night ? "#26322a" : M.leaf.hi)}
      {/* rain, two speeds, two paths */}
      {night ? (
        <g>
          <path
            d={pxPath([
              [96, 40, 1, 5],
              [122, 40, 1, 4],
              [148, 40, 1, 5],
            ])}
            fill="#9fb6c8"
            opacity={0.5}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-6 80"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d={pxPath([
              [108, 40, 1, 4],
              [136, 40, 1, 6],
              [160, 40, 1, 4],
            ])}
            fill="#9fb6c8"
            opacity={0.35}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-4 80"
              dur="2.1s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the wall and everything on it
 * ================================================================== */

function Plaster({ ph }: { ph: Ph }) {
  const wall = WALL[ph];
  const ceil = CEILING[ph];
  return (
    <g>
      {px(0, 0, W, CEIL, ceil.base)}
      {CEIL_FALL.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static precomputed list, never reorders
        <path key={i} d={c.d} fill={c.f} opacity={0.45} />
      ))}
      {/* the hairline crack running out from the corner, since the block settled */}
      <path
        d={pxPath([
          [64, 6, 22, 1],
          [86, 7, 14, 1],
          [96, 9, 1, 5],
        ])}
        fill={ceil.lo}
      />
      <path d={pxPath([[100, 8, 9, 1]])} fill={ceil.mid} />
      {/* cornice */}
      {px(0, CEIL - 4, W, 1, ceil.lo)}
      {px(0, CEIL - 3, W, 1, ceil.base)}
      {px(0, CEIL - 2, W, 2, ceil.deep)}
      {/* wall body, roller banding, grain */}
      {px(0, CEIL, W, SKIRT - CEIL, wall.base)}
      <rect x={0} y={CEIL} width={W} height={SKIRT - CEIL} fill="url(#px-roller)" />
      <rect x={0} y={CEIL} width={W} height={SKIRT - CEIL} fill="url(#px-grain)" />
      {/* damp bloom in the far corner, the kind you stop noticing */}
      <path
        d={pxPath([
          [0, 48, 26, 12],
          [4, 60, 12, 4],
        ])}
        fill={K.wallCold}
        opacity={0.85}
      />
      <path d={pxPath([[0, 48, 18, 6]])} fill="#98a095" opacity={0.8} />
      {/* the ghost rectangle where a poster hung through two tenancies */}
      {px(196, 62, 30, 22, K.wallGhost)}
      {px(196, 62, 30, 1, "#cbd0c4")}
      {px(208, 60, 2, 2, M.steel.lo)}
      {/* nicotine bloom around the sconce */}
      {px(370, 60, 38, 26, K.wallWarm)}
      {px(376, 62, 26, 16, "#c8c5ae")}
      {/* skirting, and the place a chair leg has gone through the paint */}
      {px(0, SKIRT, W, 4, GRAPHITE[ph].base)}
      {px(0, SKIRT, W, 1, GRAPHITE[ph].hi)}
      {px(214, SKIRT, 12, 4, GRAPHITE[ph].deep)}
    </g>
  );
}

function Door({ ph, s }: { ph: Ph; s: BedroomState }) {
  const open = s.opening === "door-living2";
  const leaf = LAMINATE[ph];
  return (
    <g>
      {px(14, 56, 52, 94, WALNUT[ph].lo)}
      {px(14, 56, 52, 2, WALNUT[ph].hi)}
      {px(16, 58, 48, 92, leaf.deep)}
      {open ? (
        <g>
          {px(20, 62, 40, 88, "#14161a")}
          {px(20, 62, 40, 10, "#1d2027")}
          {/* the hall, which is lit whether anyone is in it or not */}
          <path d={pxPath([[22, 66, 36, 80]])} fill={dth("w", "12")} opacity={0.35} />
        </g>
      ) : null}
      {/* the leaf swings in four stepped increments, not a smooth ease */}
      <g
        style={{
          transition: STEP_SLIDE,
          transform: open ? "scaleX(0.16)" : "none",
          transformOrigin: "20px 62px",
        }}
      >
        <Bev set={DOOR_LEAF_SET} mat={leaf} />
        {px(20, 62, 2, 88, K.cream)}
        <Bevel boxes={[[52, 100, 4, 5]]} mat={M.brass} />
        {/* a coat forgotten on the back of the door since the weather turned */}
        {px(28, 64, 12, 26, K.wool)}
        {px(28, 64, 12, 2, K.woolHi)}
        {px(30, 90, 8, 6, "#5e5952")}
        <rect x={28} y={64} width={12} height={26} fill="url(#px-weave)" />
      </g>
      {/* hook, and the robe that lives on it */}
      {px(84, 66, 8, 2, M.steel.lo)}
      {px(86, 68, 2, 3, M.steel.base)}
      {px(80, 70, 13, 44, K.rose)}
      {px(80, 70, 13, 2, "#c99e99")}
      {px(80, 84, 13, 1, "#a87c78")}
      {px(83, 92, 3, 22, "#a87c78")}
      {px(80, 114, 13, 4, "#a87c78")}
      <rect x={80} y={70} width={13} height={44} fill="url(#px-weave)" />
      {/* the switch, at the height a hand finds in the dark */}
      <Bevel boxes={[[70, 90, 10, 14]]} mat={M.laminate} />
      <path
        d={pxPath([[73, 94, 4, 6]])}
        fill={s.lightOn ? K.brass : "#8f8a7c"}
        style={{ transition: STEP_FADE }}
      />
    </g>
  );
}

function Windowsill({ ph, s }: { ph: Ph; s: BedroomState }) {
  const glass = K.glass[ph];
  const night = ph === "night";
  const day = ph === "day";
  const drawn = s.curtains === "drawn";
  const half = s.curtains === "half";
  /** Curtain widths per stage: open is tied back, drawn meets in the middle. */
  const leftW = drawn ? 32 : half ? 18 : 9;
  const rightW = drawn ? 32 : half ? 18 : 9;
  return (
    <g>
      {/* rod and finials */}
      {px(86, 48, 82, 2, WALNUT[ph].base)}
      {px(86, 48, 82, 1, WALNUT[ph].hi)}
      <Bevel
        boxes={[
          [84, 47, 3, 4],
          [166, 47, 3, 4],
        ]}
        mat={M.brass}
      />
      {/* frame and glazing bars */}
      <Bev set={WIN_FRAME_SET} mat={LAMINATE[ph]} />
      {px(96, 54, 62, 52, LAMINATE[ph].mid)}
      {px(100, 58, 26, 44, glass)}
      {px(128, 58, 26, 44, glass)}
      <rect x={100} y={58} width={26} height={44} fill="url(#px-satin)" opacity={0.6} />
      {day ? <path d={pxPath([[100, 58, 26, 12]])} fill={dth("c", "25")} opacity={0.5} /> : null}
      {px(125, 58, 4, 44, LAMINATE[ph].base)}
      {px(96, 78, 62, 1, LAMINATE[ph].lo)}
      {/* the right sash, which is the one that opens */}
      {s.winOpen ? (
        <g>
          {px(128, 58, 26, 44, night ? "#151a20" : "#8fb0c4")}
          <g style={{ transform: "scaleX(0.45)", transformOrigin: "128px 58px" }}>
            {px(128, 58, 26, 44, glass)}
            {px(150, 78, 3, 8, M.steel.base)}
          </g>
          {/* the cold edge of outside, coming in */}
          <path d={pxPath([[126, 58, 5, 44]])} fill={dth("c", "50")} opacity={0.5}>
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
          {px(132, 60, 4, 30, night ? "#2e3742" : "#c3d4de")}
          {px(148, 78, 3, 8, M.steel.base)}
        </g>
      )}
      {/* curtains. Drawn kills the shaft, which is the point of drawing them. */}
      <g>
        {px(96, 52, leftW, 58, LINEN[ph].base)}
        {px(96, 52, leftW, 2, K.cream)}
        {px(99, 56, 2, 50, LINEN[ph].lo)}
        {px(96, 84, leftW, 3, LINEN[ph].lo)}
        <rect x={96} y={52} width={leftW} height={58} fill="url(#px-weave)" />
      </g>
      <g style={{ transformOrigin: "154px 52px" }}>
        {px(158 - rightW, 52, rightW, 58, LINEN[ph].base)}
        {px(158 - rightW, 52, rightW, 2, K.cream)}
        {px(152, 56, 2, 50, LINEN[ph].lo)}
        {px(158 - rightW, 84, rightW, 3, LINEN[ph].lo)}
        <rect x={158 - rightW} y={52} width={rightW} height={58} fill="url(#px-weave)" />
        {s.winOpen ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 154 52;-4 154 52;1 154 52;0 154 52"
            dur="5.2s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>
      {/* sill */}
      {px(92, SILL, 70, 4, CEILING[ph].lo)}
      {px(92, SILL, 70, 1, CEILING[ph].hi)}
      {/* the plant, leaning at the light, in three states of gratitude */}
      <Plant ph={ph} stage={s.plant} />
      {/* glass ashtray, two ends in it, and the lighter beside */}
      <Bevel boxes={[[140, 99, 12, 5]]} mat={M.tin} />
      <path
        d={pxPath([
          [142, 100, 4, 1],
          [147, 101, 3, 1],
        ])}
        fill={K.cream}
      />
      {px(154, 101, 3, 3, "#a33a30")}
      {/* radiator, and the towel that is always on it */}
      <Bev set={RADIATOR_SET} mat={CEILING[ph]} />
      <path d={RADIATOR_FINS.face} fill={CEILING[ph].mid} />
      <path d={RADIATOR_FINS.hi} fill={CEILING[ph].hi} />
      {px(102, 140, 46, 2, CEILING[ph].deep)}
      <path
        d={pxPath([
          [102, 144, 3, 4],
          [145, 144, 3, 4],
        ])}
        fill={M.steel.lo}
      />
      {px(115, SILL + 4, 15, 30, LINEN[ph].base)}
      {px(115, SILL + 4, 15, 2, K.cream)}
      {px(115, 122, 15, 1, LINEN[ph].lo)}
      {px(117, 136, 11, 3, LINEN[ph].lo)}
      <rect x={115} y={SILL + 4} width={15} height={30} fill="url(#px-weave)" />
      {/* the valve, open or shut, and the heat it puts on the wall */}
      <Bevel boxes={[[100, 138, 4, 6]]} mat={s.heating ? M.brass : M.steel} />
      {s.heating ? (
        <path d={pxPath([[102, 108, 46, 4]])} fill={dth("w", "12")} opacity={0.4} />
      ) : null}
    </g>
  );
}

function Plant({ ph: _ph, stage }: { ph: Ph; stage: 0 | 1 | 2 }) {
  const leaf = stage === 0 ? dim(M.leaf, K.leafDry, 0.5) : M.leaf;
  /** Thirsty hangs over the pot rim; lush has put out two new stems. */
  const fronds: Rect[] =
    stage === 0
      ? [
          [99, 92, 4, 2],
          [107, 93, 4, 2],
          [103, 90, 2, 5],
        ]
      : stage === 1
        ? [
            [103, 88, 2, 8],
            [99, 86, 5, 2],
            [105, 90, 6, 2],
            [100, 92, 4, 2],
          ]
        : [
            [103, 84, 2, 12],
            [99, 82, 6, 2],
            [105, 86, 7, 2],
            [98, 90, 6, 2],
            [106, 92, 6, 2],
            [107, 78, 4, 2],
            [110, 80, 2, 6],
          ];
  return (
    <g>
      <Bevel boxes={[[99, 96, 10, 8]]} mat={{ ...M.brass, base: "#a8613f", hi: "#bd7350" }} />
      {px(101, SILL, 6, 1, "#8a4e33")}
      <path d={pxPath(fronds)} fill={leaf.base} />
      <path d={pxPath(fronds.map(([x, y, w]) => [x, y, w, 1] as Rect))} fill={leaf.hi} />
      {stage === 0 ? <path d={pxPath([[97, 90, 3, 2]])} fill={K.leafDry} /> : null}
      {stage === 2 ? <path d={pxPath([[104, 76, 1, 4]])} fill={M.leaf.hi} /> : null}
    </g>
  );
}

function DeskWall({ ph, s }: { ph: Ph; s: BedroomState }) {
  return (
    <g>
      {/* four polaroids taped in a crooked row */}
      <path
        d={pxPath([
          [172, 62, 13, 15],
          [186, 64, 13, 15],
          [172, 79, 13, 15],
        ])}
        fill={K.cream}
      />
      <path
        d={pxPath([
          [177, 60, 5, 3],
          [191, 62, 5, 3],
          [176, 77, 5, 3],
        ])}
        fill="#e4dfcd"
      />
      {px(173, 63, 11, 9, "#8ba0a8")}
      {px(175, 65, 4, 4, "#5d7480")}
      {px(187, 65, 11, 9, "#a89075")}
      {px(190, 67, 5, 4, "#7d6a55")}
      {px(173, 80, 11, 9, "#9aa88b")}
      {px(176, 82, 4, 4, "#6d7a61")}
      {/* wall calendar, one date ringed in red, and it has passed */}
      {px(228, 60, 22, 26, K.cream)}
      {px(228, 60, 22, 5, K.blanket)}
      {px(230, 62, 8, 1, K.cream)}
      <path d={pxPath(repeat(4, 4, [230, 66, 18, 1] as Rect, "y"))} fill="#b9b4a4" />
      {px(238, 73, 4, 4, "#a33a30")}
      {px(239, 74, 2, 2, K.cream)}
      {px(238, 58, 2, 3, M.steel.lo)}
      {/* shelf: three books, a cassette, and dust on the top edge */}
      {px(206, 88, 44, 3, OAK[ph].lo)}
      {px(206, 88, 44, 1, OAK[ph].base)}
      <path
        d={pxPath([
          [208, 91, 3, 2],
          [246, 91, 3, 2],
        ])}
        fill={WALNUT[ph].deep}
      />
      {px(208, 76, 5, 12, "#3f5b7a")}
      {px(213, 74, 4, 14, "#7a3a3a")}
      {px(217, 77, 6, 11, "#6b6a4a")}
      {px(223, 78, 3, 10, "#8a6d2f")}
      <path
        d={pxPath([
          [208, 76, 5, 1],
          [213, 74, 4, 1],
          [217, 77, 6, 1],
        ])}
        fill="#ffffff22"
      />
      {px(230, 80, 12, 8, IRON[ph].base)}
      {px(232, 82, 8, 4, IRON[ph].hi)}
      <path
        d={pxPath([
          [233, 83, 2, 2],
          [237, 83, 2, 2],
        ])}
        fill={M.steel.hi}
      />
      {/* cord from the sconce down to the switch, sagging where cords sag */}
      <path
        d={pxPath([
          [400, 66, 1, 26],
          [400, 92, 6, 1],
        ])}
        fill="#6a6455"
      />
      {s.lightOn ? <path d={pxPath([[400, 66, 1, 6]])} fill="#8a8368" /> : null}
    </g>
  );
}

function BedWall({ s }: { s: BedroomState }) {
  const mode = s.devotion === "candle" ? "candle" : s.lightOn ? "sconce" : "dark";
  return (
    <g>
      <Icon mode={mode} />
      {/* the rosary: on the frame, in a hand on the bed, or beside the tealight */}
      {s.devotion === "idle" ? (
        <g>
          <path
            d={pxPath([
              [310, 94, 1, 8],
              [309, 102, 3, 1],
              [310, 103, 1, 3],
            ])}
            fill="#7a6a45"
          />
          <path d={pxPath([[309, 106, 3, 3]])} fill={K.brass} />
        </g>
      ) : null}
      {s.devotion === "rosary" ? (
        <path
          d={pxPath([
            [352, 116, 8, 2],
            [358, 118, 3, 3],
          ])}
          fill="#7a6a45"
        />
      ) : null}
      {/* the tealight, on a saucer on the shelf under the icon */}
      {s.devotion === "candle" ? (
        <g>
          {px(324, 96, 12, 2, CEIL_MAT.lo)}
          {px(326, 92, 7, 4, K.cream)}
          <path d={pxPath([[329, 88, 1, 4]])} fill={K.candleHi}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.7;1;0.85;1"
              dur="1.7s"
              repeatCount="indefinite"
            />
          </path>
          <path d={pxPath([[328, 90, 3, 2]])} fill={K.candle} opacity={0.8} />
        </g>
      ) : null}
      {/* reading sconce over the bed */}
      <Bevel boxes={[[392, 56, 4, 6]]} mat={M.steel} />
      <Bevel boxes={[[386, 62, 16, 3]]} mat={M.brass} />
      <path
        d={pxPath([[387, 65, 14, 5]])}
        fill={s.lightOn ? K.warm : K.warmLo}
        style={{ transition: STEP_FADE }}
      />
      <path
        d={pxPath([[389, 70, 10, 2]])}
        fill={s.lightOn ? "#ffe6b0" : "#7d7460"}
        style={{ transition: STEP_FADE }}
      />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the boards
 * ================================================================== */

function Ground({ ph, s }: { ph: Ph; s: BedroomState }) {
  const board = BOARD[ph];
  const rug = KILIM[ph];
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, board.base)}
      <path d={BOARDS.alt} fill={board.mid} />
      <path d={BOARDS.edge} fill={board.deep} opacity={0.7} />
      <path d={BOARDS.seam} fill={board.deep} opacity={0.5} />
      <path d={BOARDS.joint} fill={board.deep} opacity={0.6} />
      <path d={BOARD_TONE.dark} fill={board.lo} opacity={0.5} />
      <path d={BOARD_TONE.pale} fill={board.hi} opacity={0.3} />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-wood)" />
      {px(0, FLOOR, W, 1, board.deep)}
      {FLOOR_WEAR.map((d) => (
        <path key={d.slice(0, 12)} d={d} fill="#fff" opacity={0.07} />
      ))}
      <path d={CHALK} fill="#e8e4dc" opacity={0.5} />
      <path d={UNDER_BED} fill="#171009" opacity={0.25} />
      <path d={FLOOR_SHADE.footSoft} fill="#171009" opacity={0.08} />
      <path d={FLOOR_SHADE.foot} fill="#171009" opacity={0.14} />
      {/* the rug: faded kilim, fringe at both ends, worn through in the middle */}
      {px(292, 152, 160, 26, rug.base)}
      {px(292, 152, 160, 2, rug.hi)}
      {px(296, 156, 152, 2, "#a8968c")}
      {px(296, 172, 152, 2, rug.lo)}
      {px(300, 160, 144, 8, "#8a5f56")}
      <path d={RUG_MOTIF.outer} fill="#a8968c" />
      <path d={RUG_MOTIF.inner} fill={rug.lo} />
      <path
        d={pxPath([
          [290, 154, 2, 22],
          [452, 154, 2, 22],
        ])}
        fill="#b6a89a"
      />
      <rect x={292} y={152} width={160} height={26} fill="url(#px-weave)" />
      {/* dust gathering along the skirting, where a mop does not reach */}
      <path
        d={pxPath([
          [240, 151, 30, 1],
          [462, 151, 26, 1],
        ])}
        fill={K.dust}
        opacity={0.7}
      />
      {/* what has ended up on the floor, per laundry stage */}
      {s.laundry >= 2 ? (
        <g>
          {px(228, 164, 18, 6, "#4a5a7a")}
          {px(228, 164, 18, 1, "#5f7095")}
          {px(232, 161, 8, 3, K.wool)}
        </g>
      ) : null}
      {s.laundry >= 3 ? (
        <g>
          {px(470, 164, 20, 7, LINEN[ph].base)}
          {px(470, 164, 20, 1, LINEN[ph].hi)}
          {px(504, 170, 12, 4, "#7a3a3a")}
        </g>
      ) : null}
      <Contact set={FLOOR_CONTACT} op={s.lightOn ? 0.9 : 0.6} />
      <AOSet set={WALL_AO} op={s.lightOn ? 0.9 : 0.65} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — the furniture
 * ================================================================== */

function Desk({ ph, s }: { ph: Ph; s: BedroomState }) {
  const oak = OAK[ph];
  const on = s.pc !== "off";
  return (
    <g>
      {/* top, apron, one drawer bank */}
      <Bev set={DESK_SET} mat={oak} />
      <path
        d={pxPath([
          [174, 115, 4, 33],
          [240, 115, 4, 33],
        ])}
        fill={oak.lo}
      />
      <path
        d={pxPath([
          [228, 117, 14, 10],
          [228, 129, 14, 10],
        ])}
        fill={oak.mid}
      />
      <path
        d={pxPath([
          [233, 121, 4, 2],
          [233, 133, 4, 2],
        ])}
        fill={K.brass}
      />
      <rect x={170} y={108} width={78} height={5} fill="url(#px-wood)" />
      {/* the CRT: beige box, and what is on it depends on the stage */}
      <Bev
        set={CRT_SET}
        mat={{ hi: "#d8c9a6", base: "#c9b995", mid: "#bdac88", lo: "#b3a988", deep: "#8f866a" }}
      />
      {px(184, 78, 34, 26, "#b3a988")}
      {px(186, 80, 30, 22, on ? "#2a4535" : "#1c2a22")}
      {px(188, 82, 26, 18, on ? "#213a2b" : "#1a2620")}
      <Screen stage={s.pc} />
      {/* the sticky note that has been on the bezel since the first pass */}
      {px(220, 84, 6, 10, "#e8d98a")}
      <path
        d={pxPath([
          [221, 86, 4, 1],
          [221, 89, 3, 1],
        ])}
        fill="#a89a52"
      />
      {px(194, 108, 16, 2, "#b3a988")}
      {px(192, 110, 20, 3, "#a89e80")}
      {/* keyboard, mouse, and the mug that goes cold every evening */}
      {px(184, 103, 26, 4, "#c6c1ae")}
      {px(184, 103, 26, 1, "#d8d3c0")}
      {px(186, 105, 22, 1, "#8f8a7c")}
      <Bevel boxes={[[214, 104, 7, 3]]} mat={M.tin} />
      <Bevel boxes={[[172, 98, 10, 10]]} mat={M.teal} />
      {px(174, 100, 6, 2, M.teal.deep)}
      {px(182, 101, 3, 5, M.teal.base)}
      {/* the desk in three states of surrender */}
      {s.desk !== "clear" ? (
        <g>
          {/* the formal papers, squared off, one page curling */}
          {px(170, 104, 14, 4, K.cream)}
          {px(171, 103, 13, 1, LINEN[ph].base)}
          <path
            d={pxPath([
              [172, 105, 9, 1],
              [172, 107, 6, 1],
            ])}
            fill="#b9b4a4"
          />
          <Bevel boxes={[[242, 100, 7, 8]]} mat={M.tin} />
          <path
            d={pxPath([
              [243, 94, 1, 6],
              [245, 93, 1, 7],
              [247, 95, 1, 5],
            ])}
            fill="#2b5aa8"
          />
        </g>
      ) : null}
      {s.desk === "buried" ? (
        <g>
          {/* a second stack, a plate, and a glass nobody has taken to the kitchen */}
          {px(222, 104, 18, 4, K.cream)}
          {px(223, 102, 16, 2, LINEN[ph].hi)}
          {px(212, 98, 12, 5, "#d8d3c0")}
          {px(212, 98, 12, 1, "#e8e3d0")}
          {px(230, 96, 6, 12, "#b6c9d2")}
          {px(230, 102, 6, 6, "#8fb0c4")}
        </g>
      ) : null}
      {/* headphones on the desk edge, cable down the leg, strip with its red eye */}
      <path
        d={pxPath([
          [219, 113, 3, 8],
          [222, 113, 1, 6],
        ])}
        fill={IRON[ph].base}
      />
      {px(219, 121, 5, 3, IRON[ph].hi)}
      <path
        d={pxPath([
          [216, 100, 1, 8],
          [210, 124, 1, 14],
          [196, 138, 15, 1],
        ])}
        fill="#4a4e55"
      />
      {px(184, 138, 14, 5, IRON[ph].hi)}
      <path d={pxPath([[186, 140, 2, 2]])} fill={K.red}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.5;1;1"
          dur="4s"
          repeatCount="indefinite"
        />
      </path>
      {/* wastebasket, fuller the worse the desk gets */}
      <Bevel boxes={[[178, 132, 16, 16]]} mat={{ ...M.graphite, base: "#6b6a5e", hi: "#7d7c6f" }} />
      {s.desk !== "clear" ? (
        <path
          d={pxPath([
            [181, 128, 6, 5],
            [187, 130, 5, 4],
          ])}
          fill={K.cream}
        />
      ) : null}
      {s.desk === "buried" ? (
        <path
          d={pxPath([
            [196, 145, 5, 4],
            [174, 144, 4, 4],
          ])}
          fill={K.cream}
        />
      ) : null}
      {/* the chair, pushed out at an angle, wearing yesterday's jumper */}
      <Bev set={CHAIR_SET} mat={WALNUT[ph]} />
      <path
        d={pxPath([
          [150, 117, 4, 31],
          [168, 117, 4, 31],
          [150, 132, 22, 2],
        ])}
        fill={WALNUT[ph].lo}
      />
      {s.laundry >= 1 ? (
        <g>
          {px(140, 88, 12, 30, K.wool)}
          {px(140, 88, 12, 2, K.woolHi)}
          {px(142, 100, 8, 1, "#5c574f")}
          {px(140, 114, 6, 8, "#5c574f")}
          <rect x={140} y={88} width={12} height={30} fill="url(#px-weave)" />
        </g>
      ) : null}
      {s.laundry >= 2 ? (
        <g>
          {px(152, 92, 14, 22, "#4a5a7a")}
          {px(152, 92, 14, 2, "#5f7095")}
        </g>
      ) : null}
    </g>
  );
}

/**
 * The screen. Only the kit's glyph subset exists, which is why the terminal is
 * typing case numbers rather than prose — and which turns out to be exactly
 * what a man doing his own paperwork at eleven at night would have on it.
 */
function Screen({ stage }: { stage: PcStage }) {
  if (stage === "off") return null;
  if (stage === "boot") {
    return (
      <g>
        <PixelText x={190} y={83} text="1024" fill={K.green} />
        <PixelText x={190} y={90} text="OK" fill={K.green} />
        <rect x={190} y={97} width={4} height={2} fill={K.green}>
          <animate
            attributeName="width"
            calcMode="discrete"
            values="4;10;16;22"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
    );
  }
  if (stage === "idle") {
    return (
      <g>
        {/* screensaver: two pixels going round the inside of the bezel */}
        <path d={pxPath([[190, 84, 2, 2]])} fill={K.green}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;22 0;22 14;0 14;0 0"
            dur="9.4s"
            repeatCount="indefinite"
          />
        </path>
        <path d={pxPath([[200, 92, 1, 1]])} fill={K.greenLo} />
      </g>
    );
  }
  return (
    <g>
      <PixelText x={190} y={82} text="AKT 14" fill={K.green} />
      <PixelText x={190} y={89} text="KOPIA" fill={K.green} />
      <PixelText x={190} y={96} text="OK" fill="#5cbf6c" />
      {/* the cursor, blinking on a hard edge */}
      <rect x={202} y={96} width={3} height={5} fill={K.green}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;1;0;0"
          dur="1.1s"
          repeatCount="indefinite"
        />
      </rect>
      {/* phosphor flicker, stepped, so it never eases */}
      <rect x={186} y={80} width={30} height={22} fill="#a8ffbc" opacity={0.05}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.05;0.1;0.04;0.08"
          dur="3.7s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

function IronCorner({ ph, s }: { ph: Ph; s: BedroomState }) {
  const iron = IRON[ph];
  const out = s.weights !== "racked";
  return (
    <g>
      {/* chalk smudges on the wall where hands go */}
      <path
        d={pxPath([
          [258, 120, 12, 3],
          [276, 126, 8, 2],
        ])}
        fill="#c9ccc4"
        opacity={0.8}
      />
      {/* one medal on a nail, ribbon faded to brick */}
      <path d={pxPath([[266, 94, 1, 12]])} fill={K.blanket} />
      {px(264, 94, 5, 2, K.blanketHi)}
      <Bevel boxes={[[263, 106, 6, 6]]} mat={M.brass} />
      {px(266, 92, 2, 2, M.steel.lo)}
      {/* the two girias. Out means dragged onto the boards, handles turned. */}
      <g transform={out ? "translate(-6,4)" : undefined}>
        <Bevel boxes={[[254, 128, 20, 18]]} mat={iron} />
        {px(258, 121, 12, 9, iron.base)}
        {px(259, 122, 10, 2, iron.hi)}
        {px(260, 123, 8, 4, WALL[ph].base)}
        {px(257, 141, 14, 2, iron.deep)}
      </g>
      <g transform={out ? "translate(8,2)" : undefined}>
        <Bevel boxes={[[276, 134, 16, 14]]} mat={iron} />
        {px(279, 128, 10, 8, iron.base)}
        {px(280, 129, 8, 2, iron.hi)}
        {px(281, 130, 6, 3, WALL[ph].base)}
      </g>
      {/* barbell against the wall, one collar loose, towel over it when in use */}
      {px(296, 68, 4, 80, M.steel.base)}
      {px(296, 68, 1, 80, M.steel.hi)}
      <Bevel
        boxes={[
          [293, 64, 10, 7],
          [292, 140, 12, 8],
        ]}
        mat={iron}
      />
      {px(291, 134, 3, 5, M.steel.lo)}
      {out ? (
        <g>
          {px(290, 96, 16, 10, LINEN[ph].base)}
          {px(290, 96, 16, 2, LINEN[ph].hi)}
          <rect x={290} y={96} width={16} height={10} fill="url(#px-weave)" />
        </g>
      ) : null}
      {/* skipping rope coiled on the boards */}
      <path
        d={pxPath([
          [252, 160, 16, 3],
          [254, 163, 12, 3],
        ])}
        fill={iron.hi}
      />
      <path
        d={pxPath([
          [250, 158, 4, 3],
          [266, 165, 4, 3],
        ])}
        fill="#a33a30"
      />
      {/* chalk bowl, and the cloud of it when somebody has just gripped */}
      <Bevel boxes={[[272, 155, 10, 6]]} mat={WALNUT[ph]} />
      {px(273, 154, 8, 2, K.chalk)}
      {s.weights === "chalked" ? (
        <path d={pxPath(steppedEllipse(277, 152, 12, 4, 2))} fill={dth("c", "12")} opacity={0.45} />
      ) : null}
    </g>
  );
}

function Bed({ ph, s }: { ph: Ph; s: BedroomState }) {
  const duvet = DUVET[ph];
  const linen = LINEN[ph];
  const made = s.bed === "made";
  const unmade = s.bed === "unmade";
  return (
    <g>
      <Bev set={HEADBOARD_SET} mat={OAK[ph]} />
      <path
        d={pxPath([
          [328, 90, 114, 1],
          [328, 112, 114, 1],
        ])}
        fill={OAK[ph].lo}
      />
      <rect x={322} y={82} width={126} height={36} fill="url(#px-wood)" />
      {/* pillows: squared when made, one dented when slept in, both shoved when not */}
      {px(330, 94, 36, 18, linen.base)}
      {px(332, 92, 32, 4, K.cream)}
      {px(330, 108, 36, 3, linen.lo)}
      {px(372, 94, 36, 18, linen.base)}
      {px(374, 92, 32, 4, K.cream)}
      {px(372, 108, 36, 3, linen.lo)}
      {made ? (
        <path
          d={pxPath([
            [336, 96, 24, 2],
            [378, 96, 24, 2],
          ])}
          fill={K.cream}
        />
      ) : (
        <path d={pxPath([[336, 98, 22, 4]])} fill={linen.lo} />
      )}
      {unmade ? <path d={pxPath([[376, 100, 26, 5]])} fill={linen.lo} /> : null}
      {/* the duvet */}
      {px(320, BED_TOP, 130, 34, duvet.base)}
      {px(320, BED_TOP, 130, 4, duvet.hi)}
      <rect x={320} y={BED_TOP} width={130} height={34} fill="url(#px-weave)" />
      {made ? (
        <g>
          {/* pulled flat, hospital corners, one crease across the middle */}
          <path d={pxPath([[320, 130, 130, 1]])} fill={duvet.lo} />
          <path d={pxPath([[320, 138, 130, 10]])} fill={duvet.mid} />
        </g>
      ) : (
        <g>
          {/* the folds it falls into when a person has been in it */}
          <path
            d={pxPath([
              [324, 122, 60, 1],
              [340, 128, 90, 1],
              [360, 118, 1, 22],
              [396, 120, 1, 18],
            ])}
            fill={duvet.lo}
          />
          <path d={pxPath([[320, 138, 130, 10]])} fill={duvet.lo} />
        </g>
      )}
      {unmade ? (
        <g>
          {/* thrown back: the sheet underneath, and the corner escaped at the side */}
          {px(320, BED_TOP, 44, 20, linen.base)}
          {px(320, BED_TOP, 44, 2, K.cream)}
          {px(360, 116, 6, 26, duvet.deep)}
          {px(318, 128, 4, 18, linen.base)}
          {px(318, 128, 4, 2, K.cream)}
        </g>
      ) : (
        <path d={pxPath([[318, 128, 4, 18]])} fill={linen.base} />
      )}
      {/* folded red wool blanket at the foot, which never moves */}
      {px(322, 140, 126, 6, K.blanket)}
      {px(322, 140, 126, 1, K.blanketHi)}
      {px(322, 145, 126, 1, K.blanketLo)}
      <path
        d={pxPath([
          [340, 141, 2, 4],
          [404, 141, 2, 4],
        ])}
        fill={K.blanketLo}
      />
      {/* the paperback, face-down, spine cracked — on the bed or on the table */}
      {s.bed === "made" ? null : (
        <g>
          {px(340, 120, 16, 8, "#c9b995")}
          {px(340, 120, 16, 2, "#d8c9a6")}
          {px(342, 123, 12, 1, "#a89a75")}
          {px(339, 119, 2, 9, K.blanket)}
        </g>
      )}
      {/* slippers, one kicked sideways, further out the later it is */}
      <path
        d={pxPath([
          [336, 166, 14, 7],
          [354, 168, 13, 6],
        ])}
        fill="#6d5f52"
      />
      <path
        d={pxPath([
          [336, 166, 14, 2],
          [354, 168, 13, 2],
        ])}
        fill="#7f7062"
      />
      {px(338, 167, 8, 2, "#544a40")}
      {/* bedside table */}
      <Bev set={BEDSIDE_SET} mat={OAK[ph]} />
      <path
        d={pxPath([
          [458, 121, 4, 27],
          [484, 121, 4, 27],
        ])}
        fill={OAK[ph].lo}
      />
      {px(462, 133, 6, 2, K.brass)}
      {/* the lamp */}
      <Bevel
        boxes={[[468, 96, 14, 10]]}
        mat={{
          ...M.brass,
          base: s.lightOn ? "#e8c98a" : "#8f8674",
          hi: s.lightOn ? "#f2dda8" : "#9c937f",
        }}
      />
      <path
        d={pxPath([
          [474, 106, 2, 8],
          [470, 114, 10, 2],
        ])}
        fill={K.brassLo}
      />
      {/* the alarm clock, and it knows what time it is */}
      <Bevel boxes={[[456, 106, 17, 10]]} mat={IRON[ph]} />
      {px(457, 107, 15, 8, "#151a20")}
      <Clock ph={ph} armed={s.alarmArmed} />
      {/* water, half gone, and the pills beside it */}
      {px(486, 106, 6, 10, "#b6c9d2")}
      {px(486, 110, 6, 6, "#8fb0c4")}
      {px(486, 106, 1, 10, M.steel.hi)}
      {px(478, 112, 5, 4, K.cream)}
      {/* the photo frame, laid face-down, which is its own small story */}
      {px(470, 114, 12, 3, WALNUT[ph].base)}
      {px(470, 114, 12, 1, WALNUT[ph].hi)}
    </g>
  );
}

/**
 * The hour, from the kit's 3x5 font. `gap={0}` because a segment readout has no
 * letter-spacing, and because at gap 1 the widest string overruns the housing.
 */
const CLOCK_TIME: Record<Ph, string> = {
  dawn: "6:14",
  day: "13:42",
  dusk: "19:05",
  night: "3:20",
};

function Clock({ ph, armed }: { ph: Ph; armed: boolean }) {
  return (
    <g>
      <PixelText x={458} y={108} text={CLOCK_TIME[ph]} fill={K.red} gap={0} />
      {/* the alarm dot only shows if it is actually set */}
      {armed ? <path d={pxPath([[470, 113, 2, 2]])} fill={K.red} /> : null}
      {/* and the whole readout pulses on the second, discretely */}
      <rect x={457} y={107} width={15} height={8} fill="#151a20" opacity={0}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0;0;0.35;0"
          dur="2s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

function Wardrobe({ ph, s }: { ph: Ph; s: BedroomState }) {
  const oak = OAK[ph];
  return (
    <g>
      {/* the suitcase on top, dusty, packed for nothing in particular */}
      <Bevel
        boxes={[[500, 44, 40, 12]]}
        mat={{ hi: "#8f6f4c", base: "#7a5c3f", mid: "#6d5238", lo: "#5f4630", deep: "#463322" }}
      />
      {px(500, 49, 40, 1, "#5f4630")}
      {px(516, 42, 8, 3, WALNUT[ph].deep)}
      <path
        d={pxPath([
          [506, 48, 3, 4],
          [532, 48, 3, 4],
        ])}
        fill={K.brass}
      />
      <path d={pxPath([[500, 44, 40, 1]])} fill={K.dust} opacity={0.5} />
      {s.wardrobeOpen ? (
        <g>
          {px(494, 56, 54, 92, "#2c2620")}
          {px(496, 58, 50, 88, "#241f1a")}
          {px(498, 62, 46, 2, M.steel.base)}
          {/* hanging clothes, uneven, and the gap where today's came from */}
          <path
            d={pxPath([
              [500, 64, 6, 34],
              [507, 64, 5, 30],
              [513, 64, 6, 36],
              [520, 64, 5, 28],
              [526, 64, 6, 32],
              [533, 64, 5, 26],
            ])}
            fill="#3f4a3a"
          />
          {px(500, 64, 6, 34, "#4a5a7a")}
          {px(507, 64, 5, 30, "#a33a30")}
          {px(513, 64, 6, 36, LINEN[ph].base)}
          {px(526, 64, 6, 32, K.wool)}
          {px(533, 64, 5, 26, "#7a5c3f")}
          <path d={pxPath([[500, 64, 38, 2]])} fill={dth("n", "50")} opacity={0.6} />
          {/* shelf: folded things, a shoebox, and the boots that live in the bottom */}
          {px(496, 104, 50, 2, oak.lo)}
          {px(500, 108, 16, 8, LINEN[ph].base)}
          {px(500, 108, 16, 2, K.cream)}
          {px(518, 108, 14, 8, DUVET[ph].base)}
          {px(518, 108, 14, 2, DUVET[ph].hi)}
          {px(534, 106, 12, 10, "#8a7a5e")}
          {px(534, 106, 12, 2, "#9d8b6c")}
          {px(500, 120, 44, 26, "#1d1915")}
          {px(504, 130, 16, 12, "#8a8f96")}
          {px(506, 132, 12, 8, "#6d7178")}
          {px(524, 134, 14, 10, WALNUT[ph].base)}
        </g>
      ) : (
        <g>
          <Bev set={WARDROBE_SET} mat={oak} />
          {px(520, 58, 2, 88, oak.lo)}
          <path
            d={pxPath([
              [498, 60, 20, 42],
              [498, 106, 20, 38],
            ])}
            fill={oak.mid}
          />
          <path
            d={pxPath([
              [499, 61, 18, 2],
              [499, 107, 18, 2],
            ])}
            fill={oak.lo}
          />
          {/* the mirror door, catching a sliver of the room it faces */}
          {px(524, 60, 20, 66, "#7f8d95")}
          {px(524, 60, 20, 2, "#a6b3ba")}
          {px(526, 64, 16, 26, "#8fa3ac")}
          {px(526, 92, 16, 30, "#6d7c85")}
          {px(529, 96, 6, 18, "#7f8d95")}
          {/* and, if the lamp is on, the lamp is in it */}
          {s.lightOn ? <path d={pxPath([[530, 70, 5, 4]])} fill={K.warm} opacity={0.7} /> : null}
          <path
            d={pxPath([
              [514, 100, 3, 9],
              [524, 100, 3, 9],
            ])}
            fill={K.brass}
          />
          {/* a tie left over the door edge */}
          {px(536, 56, 3, 22, "#4a5a7a")}
          {px(535, 78, 5, 8, "#3f4d6b")}
        </g>
      )}
      {/* boots by the door, toes pointing in, because that is how they come off */}
      <path
        d={pxPath([
          [20, 160, 16, 10],
          [38, 162, 15, 9],
        ])}
        fill="#4a3a2b"
      />
      <path
        d={pxPath([
          [20, 160, 16, 2],
          [38, 162, 15, 2],
        ])}
        fill={WALNUT[ph].base}
      />
      <path
        d={pxPath([
          [20, 168, 16, 2],
          [38, 169, 15, 2],
        ])}
        fill="#2f251c"
      />
      {/* one sock that never made it to the wash */}
      {px(470, 170, 10, 4, LINEN[ph].lo)}
      {px(470, 170, 10, 1, LINEN[ph].base)}
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function BedroomScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world);
  const src = litSources(s, ph);
  const gate = CURTAIN_GATE[s.curtains];
  const shaft = SHAFT[ph];
  return (
    <LayeredScene
      /* the yard is twenty metres back; it should lag the window frame */
      parallax={{ farBackground: 0.88, middleBackground: 1 }}
      farBackground={<Yard ph={ph} />}
      middleBackground={
        <g>
          <Plaster ph={ph} />
          <Door ph={ph} s={s} />
          <Windowsill ph={ph} s={s} />
          <DeskWall ph={ph} s={s} />
          <BedWall s={s} />
        </g>
      }
      ground={
        <g>
          <Ground ph={ph} s={s} />
          {/* the shaft lands on the boards, and the dust lives in it */}
          {shaft && gate > 0 ? (
            <g style={{ pointerEvents: "none" }}>
              <Light set={shaft} op={gate} />
              <g opacity={gate}>
                <path d={MOTES_D} fill="#fff6da" opacity={0.75}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;5 -12;-3 -22;4 -8;0 0"
                    dur="16s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            </g>
          ) : null}
          {/* and the pool the bedside lamp puts on the rug */}
          {src.bedside ? <Light set={FLOOR_POOL} /> : null}
        </g>
      }
      staticObjects={
        <g>
          <Desk ph={ph} s={s} />
          <IronCorner ph={ph} s={s} />
          <Bed ph={ph} s={s} />
          <Wardrobe ph={ph} s={s} />
        </g>
      }
      gameplayObjects={<g>{/* hitboxes only */}</g>}
    />
  );
}

/* ================================================================== *
 * foreground — the near edge
 * ================================================================== */

function BedroomFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
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
        {/* six pixels of near board, so the floor has an edge to sit behind */}
        {px(0, H - 6, W, 6, BOARD[ph].deep)}
        {px(0, H - 6, W, 1, BOARD[ph].lo)}
        {/* the very near end of the folded blanket, bottom right, out of frame */}
        {px(470, H - 14, 90, 14, K.blanketLo)}
        {px(470, H - 14, 90, 2, K.blanket)}
        {px(470, H - 12, 90, 1, K.blanketHi)}
        <Vignette set={VIGNETTE} strength={s?.lightOn ? 0.75 : 1} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * effects — the light, and anything the player is doing right now
 * ================================================================== */

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

/**
 * A colour cast, not a second darkness — `darkness()` still owns brightness via
 * roomDarkness. Small numbers on purpose; raising them here fights the engine.
 */
const CAST: Record<Ph, { fill: string; lit: number; dark: number }> = {
  dawn: { fill: DAWN_CAST, lit: 0.05, dark: 0.13 },
  day: { fill: "#ffd9a0", lit: 0.03, dark: 0.07 },
  dusk: { fill: DUSK_CAST, lit: 0.06, dark: 0.15 },
  night: { fill: NIGHT_CAST, lit: 0.08, dark: 0.22 },
};

function BedroomEffects({
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
  const s = state(world);
  const src = litSources(s, ph);
  const cast = CAST[ph];
  return (
    <>
      {/* the mug is always a little too hot to drink and always goes cold */}
      {s.desk !== "clear" ? <Steam x={175} y={94} scale={scale} slow /> : null}
      {actionUi === "smoke" && s.winOpen ? <Steam x={138} y={60} scale={scale} /> : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          <rect
            width={W}
            height={H}
            fill={cast.fill}
            opacity={s.lightOn ? cast.lit : cast.dark}
            style={{ transition: STEP_FADE }}
          />
          {/* three sources, three temperatures, and they overlap on the bed */}
          <g opacity={src.sconce ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={SCONCE_POOL} />
          </g>
          <g opacity={src.bedside ? 1 : 0} style={{ transition: `opacity 520ms steps(3, end)` }}>
            <Light set={BEDSIDE_POOL} />
          </g>
          <path
            d={LAMP_SOURCES.core}
            fill="#fff8e0"
            opacity={s.lightOn ? 0.95 : 0}
            style={{ transition: STEP_FADE }}
          />
          {src.screen ? <Light set={CRT_GLOW} /> : null}
          {src.candle ? (
            <g>
              <Light set={CANDLE_GLOW} />
              {/* a tealight is never steady, and it is never smooth about it */}
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="1;0.82;1;0.9;0.78;1"
                dur="2.3s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}

          {/* --- transients --- */}
          {/* a giria being swung: the arc it travels, in four stepped ghosts */}
          {actionUi === "swing" ? (
            <g>
              <path
                d={pxPath([
                  [262, 118, 12, 10],
                  [270, 108, 12, 10],
                  [276, 96, 12, 10],
                ])}
                fill={dth("n", "25")}
                opacity={0.4}
              >
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.4;0.15;0.4;0.2"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </path>
              {/* chalk coming off the handle */}
              <path
                d={pxPath(steppedEllipse(272, 112, 14, 6, 2))}
                fill={dth("c", "12")}
                opacity={0.4}
              />
            </g>
          ) : null}
          {/* the barbell pressed: the bar bends, the plates blur at the ends */}
          {actionUi === "press" ? (
            <path
              d={pxPath([
                [292, 60, 12, 8],
                [292, 136, 12, 8],
              ])}
              fill={dth("n", "25")}
              opacity={0.45}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                calcMode="discrete"
                values="0 0;0 -3;0 0;0 2"
                dur="2.6s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* praying: the icon gets a little more light than the room does */}
          {actionUi === "pray" ? (
            <path
              d={pxPath(steppedEllipse(ICON_CX, 72, 30, 26, 2))}
              fill={dth("w", "12")}
              opacity={0.5}
            >
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.5;0.35;0.5"
                dur="3.9s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* a moth at the sconce, once it is the only warm thing in the room */}
          {ph === "night" && s.lightOn ? (
            <g>
              <rect x={402} y={70} width={2} height={2} fill="#e8dfc0" opacity={0.8} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;8 -5;-4 6;5 3;0 0"
                dur="4.1s"
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
 * definition — hitbox ids, kinds, x and range unchanged
 * ================================================================== */

/**
 * Every world read the art performs, in order. This scene is still a plain
 * SceneDef, which has no artKey; if it migrates to RuntimeSceneDef, this is the
 * key it wants, and every new read must be joined here in the same order.
 */
export function bedroomArtKey(world: WorldState, phase: string): string {
  const s = state(world);
  return [
    phase,
    s.lightOn ? 1 : 0,
    s.winOpen ? 1 : 0,
    s.wardrobeOpen ? 1 : 0,
    s.opening ?? "-",
    s.bed,
    s.desk,
    s.pc,
    s.curtains,
    s.laundry,
    s.plant,
    s.weights,
    s.devotion,
    s.alarmArmed ? 1 : 0,
    s.heating ? 1 : 0,
  ].join("|");
}

export const BEDROOM_SCENE: RuntimeSceneDef<WorldState> = {
  id: "study",
  width: W,
  /**
   * The room you train in, so the floor has to be a floor.
   *
   * Half a metre from the wall out, and the rug that is already painted at
   * x=304..440 is a named zone rather than a picture of one — the kettlebell and
   * the barbell live on it, and standing on it is the difference between
   * swinging a giria over boards and swinging it over something that will not
   * mark them.
   */
  ground: {
    top: FLOOR,
    bottom: 170,
    zones: [
      { x0: 300, x1: 444, y0: 158, y1: 170, kind: "rug" },
      { x0: 0, x1: W, kind: "boards" },
    ],
  },
  objects: [
    {
      id: "door-living2",
      kind: "flatdoor",
      priority: 1,
      x: 40,
      range: 20,
      to: { scene: "studio", spawnX: 488 },
    },
    { id: "switch-bed", kind: "lamp", x: 76, range: 12 },
    { id: "window-yard", kind: "window", x: 127, range: 16 },
    { id: "computer", kind: "computer", x: 201, range: 20 },
    { id: "giria", kind: "sport", action: "swing", x: 270, range: 14, approachY: 162 },
    { id: "barbell", kind: "sport", action: "press", x: 296, range: 10, approachY: 162 },
    { id: "painting", kind: "sport", action: "pray", x: 329, range: 10 },
    { id: "bed", kind: "bed", x: 385, range: 24, face: 1, data: "about", approachY: 152 },
    { id: "wardrobe", kind: "openable", x: 520, range: 18 },
  ],
  Component: ({ world, phase }) => <BedroomScene world={world} phase={phase} />,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.study),
  Foreground: (p) => <BedroomFront {...p} />,
  Effects: BedroomEffects,
  idleLean: true,
};
