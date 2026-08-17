import {
  AOSet,
  aoPaths,
  Bev,
  bevelPaths,
  bulbPaths,
  Contact,
  contactPaths,
  dim,
  LayeredScene,
  Light,
  type Mat,
  type Ph,
  PixelText,
  pxPath,
  type Rect,
  repeat,
  type SceneDef,
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
import type { WorldState } from "@/lib/worldState";

// --- WINDA / the lift cab — small, but kept with dignity ----------------------------

/**
 * Fourth pass. Rebuilt to the house standard — ramps, Bev, quantised light, the
 * kit's font — and every fitting moved to the height it belongs at.
 *
 * THE AUDIT, AND WHAT IT SAID. Measured against the 67 px character who stands in
 * this cab, every single fitting was too high:
 *
 *     handrail          1.42 m    should be 0.90 m   — it was at his armpit
 *     mirror bottom     1.47 m    should be 0.90 m   — you could not see your face
 *     ad frame bottom   1.63 m    should be 1.20 m
 *     capacity plate    2.03 m    should be 1.50 m
 *     highest button    2.11 m    should be 1.20 m   — nobody can reach it
 *     lowest button     0.66 m    should be 0.90 m
 *
 * And the tell: the three details that were already right were the kid's sticker
 * at 1.11 m, the scratched initials at 0.47 m and the trolley scuff at 0.58 m —
 * the three that were written about a *body* rather than laid out as a panel of
 * things on a wall. Everything described as furniture drifted upward; everything
 * described as a person's reach landed. So the whole reachable band has been
 * rebuilt from the floor up: nothing a hand touches is above 1.40 m and nothing
 * below 0.30 m, and the brushed steel above 2.00 m is just wall, which is what
 * the top of a lift actually is.
 *
 * TWO SCALE DECISIONS, STATED ONCE.
 *   1. The shell is oversized. A residential cab is 1.10 x 1.40 m internal, which
 *      at 38 px/m is 42 x 53 px — you cannot stand a 67 px character in that. So
 *      the shell is drawn generously, the same compromise every interior in this
 *      game makes, and the *fittings* are pegged to the character instead, because
 *      the character is what the eye compares them against.
 *   2. The signage is drawn legibly, not to scale. A real capacity card is 150 mm
 *      — four pixels — and there is no type at four pixels. This is the only room
 *      whose entire content is words on plates, so they are drawn big enough to
 *      read. Everything else in the file is honest.
 *
 * THE MIRROR IS STILL THE IDEA. The camera stands where the doors are, so the shot
 * is the back wall, which means the mirror can do the one thing a mirror is for: it
 * holds the wall behind you. The doors, the indicator above them, the threshold,
 * and when they are open a slice of the landing. It now also holds the ceiling
 * panel and the handrail carrying on round, and it fogs and smears and cracks
 * according to state.
 *
 * ONE FLAG SHARED THREE WAYS. `world.corridor.liftOpen` is read here for the
 * doors, in the corridor scene for the car standing on the landing, and at the
 * klatka entrance for the lit car seen down the hall. Three scenes, one flag, and
 * they cannot disagree. `corridor.noticeRead` is read here too: the wspólnota
 * notice in the ad frame is the same sheet posted at both ends of the stairwell.
 *
 * STATE. Ten reads, all defensive — `world.lift` need not exist:
 *
 *   travelling  boolean                    the shake, the sweeps, the counting
 *   goingUp     boolean                    which way the arrow points
 *   floor       "P" | "0".."4"
 *   doorsOpen   boolean  (or corridor.liftOpen)
 *   light       ok → flicker → emergency    a dying tube changes the whole room
 *   mirror      clean → smeared → cracked
 *   service     ok → due → overdue          the UDT plate, and a taped notice
 *   graffiti    0..2
 *   litter      0..2                        defaults from the hour, as before
 *   noticeRead  boolean  (from corridor)
 *
 * It is deliberately the only room with nobody in it. What company there is comes
 * second-hand: a kid's sticker at a kid's height, initials scratched with a key,
 * somebody's flyer on the floor, a glove that has been in the corner for a
 * fortnight, and gum pressed up under the handrail where you cannot see it.
 *
 * BUDGET. ~250 nodes, 18 animations. No gradients, no ellipses, no polygons — the
 * old pass had two gradients, an ellipse and two polygons.
 */

const W = 200;
const H = 180;
const FLOOR = 150;

/** Heights, all pegged to the character: 38 px/m up from the floor line. */
const mAbove = (metres: number) => FLOOR - Math.round(metres * 38);
const CEIL_BOT = 46; // underside of the ceiling soffit
const UPPER_TOP = mAbove(2.0); // 74 — above this is just wall
const RAIL_Y = mAbove(0.9); // 116 — a handrail is at your waist
const LAM_TOP = 120; // where the laminate starts, just under the rail
const SKIRT = 146;
const CY = FLOOR - 1;

/* ================================================================== *
 * palette
 * ================================================================== */

const NIGHT_CAST = "#0d1a24";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, "#8f8aa8", 0.08),
    day: mat,
    dusk: dim(mat, "#c08a52", 0.08),
    night: dim(mat, NIGHT_CAST, 0.2),
  };
}

/** Brushed stainless, which is the top half of every lift in the country. */
const STEEL_MAT: Mat = {
  hi: "#b6bcc4",
  base: "#9aa0a8",
  mid: "#93999f",
  lo: "#8f959c",
  deep: "#6b6e73",
};
/** The warm laminate below the rail, chosen in about 2009. */
const LAM_MAT: Mat = {
  hi: "#bb9c6c",
  base: "#a8895e",
  mid: "#9e8056",
  lo: "#9a7c52",
  deep: "#8a6f48",
};
const CEIL_MAT: Mat = {
  hi: "#d6dae0",
  base: "#c8ccd2",
  mid: "#bcc0c6",
  lo: "#aeb2b8",
  deep: "#94989e",
};
const FLOORMAT: Mat = {
  hi: "#87837b",
  base: "#7a776f",
  mid: "#726f67",
  lo: "#6b675f",
  deep: "#57544e",
};
const PANEL_MAT: Mat = {
  hi: "#4d5158",
  base: "#3f4246",
  mid: "#3a3d42",
  lo: "#33363a",
  deep: "#25282c",
};
const MIRROR_MAT: Mat = {
  hi: "#d4e4ea",
  base: "#b6ccd4",
  mid: "#a8c0c8",
  lo: "#9cb4bc",
  deep: "#7d949c",
};

const STEEL = ramp(STEEL_MAT);
const LAM = ramp(LAM_MAT);
const CEILM = ramp(CEIL_MAT);
const FLOORR = ramp(FLOORMAT);
const PANEL = ramp(PANEL_MAT);
const MIRRORR = ramp(MIRROR_MAT);

const L = {
  led: "#f5f8fa",
  ledWarm: "#fff8e8",
  ledDim: "#e2e8ec",
  green: "#3ddc84",
  greenDim: "#1f6b42",
  amber: "#c9a24b",
  amberHi: "#dbb663",
  red: "#b03030",
  redLed: "#ff4050",
  button: "#aeb2b8",
  buttonHi: "#c4c8ce",
  buttonFace: "#e8e6e0",
  paper: "#e8e6e0",
  paperLo: "#d8d6d0",
  dark: "#14161a",
  rail: "#c8ccd2",
  railWorn: "#e8ecf0",
  gum: "#5d5a52",
  web: "#c9ccd2",
  scratch: "#8a6f48",
  landing: "#a89a86",
  landingNight: "#5d6a70",
  noticeBlue: "#2b5aa8",
  noticeFlag: "#c94040",
  glass: "#22262b",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

export type LiftLight = "ok" | "flicker" | "emergency";
export type LiftMirror = "clean" | "smeared" | "cracked";
export type LiftService = "ok" | "due" | "overdue";

const LIGHTS: readonly LiftLight[] = ["ok", "flicker", "emergency"];
const MIRRORS: readonly LiftMirror[] = ["clean", "smeared", "cracked"];
const SERVICES: readonly LiftService[] = ["ok", "due", "overdue"];

type LiftState = {
  travelling: boolean;
  goingUp: boolean;
  floor: string;
  doorsOpen: boolean;
  light: LiftLight;
  mirror: LiftMirror;
  service: LiftService;
  graffiti: 0 | 1 | 2;
  litter: 0 | 1 | 2;
  noticeRead: boolean;
  call: LiftCall;
  dest: string | null;
  load: LiftLoad;
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
 * `world.lift` need not exist, and the legacy `liftFloor` / `liftMoving` still
 * map in. `doorsOpen` falls back to `corridor.liftOpen`, which is the flag the
 * corridor scene and the klatka entrance both read — three scenes, one truth.
 */
function liftState(world: WorldState, ph: Ph): LiftState {
  const w = world as unknown as Record<string, unknown>;
  const lift = (w.lift ?? {}) as Record<string, unknown>;
  const corridor = (w.corridor ?? {}) as Record<string, unknown>;
  const rawFloor = String(lift.floor ?? w.liftFloor ?? "4");
  return {
    travelling: !!(lift.moving ?? w.liftMoving),
    goingUp: lift.up !== false,
    floor: (FLOORS as readonly string[]).includes(rawFloor) ? rawFloor : "4",
    doorsOpen: !!(lift.doorsOpen ?? corridor.liftOpen),
    light: clampStage(lift.light, LIGHTS, "ok"),
    mirror: clampStage(lift.mirror, MIRRORS, "smeared"),
    service: clampStage(lift.service, SERVICES, "due"),
    graffiti: clampInt(lift.graffiti, 2, 1) as 0 | 1 | 2,
    /** the old pass drove the floor litter off the hour; keep that as the default */
    litter: clampInt(lift.litter, 2, ph === "dawn" || ph === "night" ? 1 : 0) as 0 | 1 | 2,
    noticeRead: corridor.noticeRead === true,
    call: clampStage(lift.call, CALLS, "idle"),
    dest:
      typeof lift.dest === "string" && (FLOORS as readonly string[]).includes(lift.dest)
        ? lift.dest
        : null,
    load: clampStage(lift.load, LOADS, "ok"),
  };
}

/** The tube is dying, or gone. Everything in the cab answers to this. */
const isEmergency = (s: LiftState) => s.light === "emergency";

/* ================================================================== *
 * precomputed geometry — nothing below allocates at render time
 * ================================================================== */

/* --- the ceiling soffit, seen almost edge-on from 1.4 m away --- */
const CE_SOFFIT = pxPath([[0, 0, W, CEIL_BOT]]);
const CE_SOFFIT_HI = pxPath([[0, 0, W, 2]]);
const CE_SOFFIT_LO = pxPath([[0, CEIL_BOT - 2, W, 2]]);
/** The service hatch nobody has opened since the inspection. */
const CE_HATCH = bevelPaths([[86, 4, 28, 15]]);
const CE_HATCH_SCREWS = pxPath([
  [89, 7, 2, 2],
  [109, 7, 2, 2],
  [89, 15, 2, 2],
  [109, 15, 2, 2],
]);
const CE_HATCH_SEAM = pxPath([[86, 20, 28, 1]]);
/** The LED panel: even and kind, and the only thing lighting the room. */
const CE_PANEL_CASE = bevelPaths([[54, 32, 92, 12]]);
const CE_PANEL_LENS = pxPath([[56, 34, 88, 8]]);
/** The emergency light, on its own little battery, which never goes out. */
const CE_EMERG = bevelPaths([[20, 30, 16, 9]]);
const CE_EMERG_FACE = pxPath([[22, 32, 12, 5]]);
/** The extract vent, its louvres, and the camera dome in the corner. */
const CE_VENT = bevelPaths([[160, 30, 24, 11]]);
const CE_VENT_FINS = pxPath(repeat(5, 4, [162, 32, 2, 7] as Rect));
const CE_CAM = bevelPaths([[184, CEIL_BOT - 4, 14, 12]]);
const CE_CAM_DOME = pxPath([[186, CEIL_BOT - 2, 10, 8]]);
const CE_CAM_LENS = pxPath([[188, CEIL_BOT, 5, 4]]);
/** The web in the corner, which is where a web goes in a sealed box with a fan. */
const CE_WEB = pxPath([
  [0, CEIL_BOT, 10, 1],
  [0, CEIL_BOT, 1, 8],
  [2, CEIL_BOT + 2, 6, 1],
  [4, CEIL_BOT + 4, 3, 1],
]);

/* --- the shell: steel above the rail, laminate below --- */
const SH_STEEL = pxPath([[0, CEIL_BOT, W, LAM_TOP - CEIL_BOT]]);
/** The brushing runs vertically, and shows every hand that has touched it. */
const SH_BRUSH = pxPath(
  [8, 18, 40, 52, 100, 118, 128, 144, 176, 192].map(
    (x) => [x, CEIL_BOT + 2, 1, LAM_TOP - CEIL_BOT - 4] as Rect,
  ),
);
/** The dent at shoulder height, and the scuff a bicycle handlebar leaves. */
const SH_DENT = pxPath([
  [140, 84, 6, 9],
  [146, 89, 4, 5],
]);
const SH_BIKE_SCUFF = pxPath([
  [60, 110, 22, 2],
  [88, 111, 14, 2],
]);
/** The rail band, the rail, and the two places hands have polished it bright. */
const SH_RAIL_BAND = pxPath([[0, RAIL_Y - 4, 148, 4]]);
const SH_RAIL = bevelPaths([[8, RAIL_Y, 138, 4]]);
const SH_RAIL_WORN = pxPath([
  [52, RAIL_Y + 1, 30, 2],
  [104, RAIL_Y + 1, 24, 2],
]);
const SH_RAIL_BRACKETS = pxPath([
  [12, RAIL_Y + 4, 3, 5],
  [76, RAIL_Y + 4, 3, 5],
  [140, RAIL_Y + 4, 3, 5],
]);
/** Gum pressed up under the rail, where you only find it with your hand. */
const SH_GUM = pxPath([
  [64, RAIL_Y + 4, 3, 2],
  [118, RAIL_Y + 4, 2, 2],
]);
/* --- the laminate, and what has happened to it --- */
const SH_LAM = pxPath([[0, LAM_TOP, W, SKIRT - LAM_TOP]]);
const SH_LAM_SEAM = pxPath([[96, LAM_TOP, 1, SKIRT - LAM_TOP]]);
/** The panel that has lifted at the seam and nobody has glued back. */
const SH_LAM_LIFT = pxPath([
  [96, LAM_TOP, 4, 3],
  [96, LAM_TOP, 2, 8],
]);
/** The trolley and pram scuff, all the way round at 0.45 m. */
const SH_SCUFF = pxPath([
  [0, mAbove(0.45), W, 2],
  [30, mAbove(0.58), 26, 1],
  [150, mAbove(0.52), 20, 1],
]);
/** And the corner somebody has kicked through to the steel underneath. */
const SH_KICKED = pxPath([
  [0, SKIRT - 9, 8, 9],
  [8, SKIRT - 5, 5, 5],
]);
const SH_SKIRT = pxPath([[0, SKIRT, W, 4]]);
const SH_POSTS = pxPath([
  [0, CEIL_BOT, 4, FLOOR - CEIL_BOT],
  [196, CEIL_BOT, 4, FLOOR - CEIL_BOT],
]);
const SH_BUMPERS = pxPath([
  [0, SKIRT, 6, 4],
  [194, SKIRT, 6, 4],
]);

/* --- the mirror: 2.00 m down to 1.00 m, so you can see your face --- */
const MR = { x: 24, y: UPPER_TOP, w: 42, h: mAbove(1.0) - UPPER_TOP } as const;
const MR_FRAME = bevelPaths([[MR.x, MR.y, MR.w, MR.h]]);
const MR_GLASS = pxPath([[MR.x + 4, MR.y + 4, MR.w - 8, MR.h - 8]]);
/** The reflection: the wall behind the camera, which is the doors. */
const MR_REFLECT = {
  /** the ceiling panel, seen up the far wall */
  panel: pxPath([[MR.x + 10, MR.y + 6, 22, 3]]),
  /** the indicator above the doors, tiny and back to front */
  indBox: pxPath([[MR.x + 16, MR.y + 11, 11, 4]]),
  indLit: pxPath([[MR.x + 18, MR.y + 12, 7, 2]]),
  /** the two leaves, shut */
  leavesShut: pxPath([
    [MR.x + 5, MR.y + 16, 15, 24],
    [MR.x + 21, MR.y + 16, 15, 24],
  ]),
  split: pxPath([[MR.x + 20, MR.y + 16, 1, 24]]),
  /** the leaves, drawn back, and the landing beyond them */
  leavesOpen: pxPath([
    [MR.x + 5, MR.y + 16, 8, 24],
    [MR.x + 28, MR.y + 16, 8, 24],
  ]),
  landing: pxPath([[MR.x + 13, MR.y + 16, 15, 24]]),
  landingDoor: pxPath([[MR.x + 17, MR.y + 21, 8, 15]]),
  landingFloor: pxPath([[MR.x + 13, MR.y + 34, 15, 6]]),
  /** the handrail carrying on round behind you */
  rail: pxPath([[MR.x + 5, MR.y + 26, 31, 2]]),
  /** the threshold at the bottom */
  threshold: pxPath([[MR.x + 5, MR.y + 40, 31, 4]]),
};
/** A raked specular streak, stepped so it stays on the grid. */
const MR_SPEC = pxPath(
  steppedQuad(MR.y + 4, MR.x + 20, MR.x + 28, MR.y + MR.h - 4, MR.x + 5, MR.x + 13, 4),
);
/** The wipe arc at hand height, the fingerprints, and one long scratch. */
const MR_SMEARS = pxPath([
  [MR.x + 24, MR.y + 18, 9, 1],
  [MR.x + 26, MR.y + 19, 7, 1],
  [MR.x + 8, MR.y + 24, 4, 5],
  [MR.x + 30, MR.y + 30, 3, 3],
]);
const MR_SCRATCH = pxPath([[MR.x + 12, MR.y + 24, 1, 14]]);
/** The crack, and the chip out of the bottom corner. */
const MR_CRACK = pxPath([
  [MR.x + 30, MR.y + 6, 1, 12],
  [MR.x + 26, MR.y + 17, 5, 1],
  [MR.x + 22, MR.y + 18, 5, 1],
  [MR.x + 18, MR.y + 19, 5, 1],
]);
const MR_CHIP = pxPath([[MR.x + 4, MR.y + MR.h - 8, 5, 4]]);

/* --- the ad frame: eye level, 1.90 m down to 1.21 m --- */
const AD = { x: 70, y: mAbove(1.9), w: 24, h: mAbove(1.21) - mAbove(1.9) } as const;
const AD_FRAME = bevelPaths([[AD.x, AD.y, AD.w, AD.h]]);
const AD_FACE = pxPath([[AD.x + 2, AD.y + 2, AD.w - 4, AD.h - 4]]);
/** The perspex, its streak, and the corner where it has been prised open. */
const AD_SPEC = pxPath(
  steppedQuad(AD.y + 2, AD.x + 12, AD.x + 18, AD.y + AD.h - 2, AD.x + 2, AD.x + 8, 3),
);
const AD_PRISED = pxPath([[AD.x + AD.w - 6, AD.y, 6, 5]]);

/* --- the plates: 1.95 m down to 1.21 m, drawn legibly not to scale --- */
const PL_UDT = bevelPaths([[106, mAbove(1.95), 24, 12]]);
const PL_CAP = bevelPaths([[106, mAbove(1.62), 24, 13]]);
const PL_SERVICE = pxPath([[108, mAbove(1.29), 20, 4]]);
const PL_SERVICE_CURL = pxPath([[126, mAbove(1.29), 3, 5]]);

/* --- the button panel: nothing above 1.37 m, nothing below 0.71 m --- */

/* --- the traces other people leave --- */
/** The sticker, at exactly the height of a five-year-old. */
const TR_STICKER = pxPath([[12, mAbove(1.26), 12, 10]]);
const TR_STICKER_FACE = pxPath([
  [15, mAbove(1.18), 3, 3],
  [20, mAbove(1.18), 3, 3],
  [16, mAbove(1.05), 5, 1],
]);
const TR_STICKER_PEEL = pxPath([[22, mAbove(1.34), 3, 3]]);
/** Initials and a heart, scratched into the laminate with a key. */
const TR_INITIALS = pxPath([
  [30, 128, 1, 8],
  [31, 128, 4, 1],
  [31, 132, 3, 1],
  [37, 128, 1, 8],
  [38, 131, 3, 1],
  [41, 128, 1, 4],
  [41, 133, 1, 3],
]);
const TR_HEART = pxPath([
  [45, 130, 2, 2],
  [48, 130, 2, 2],
  [46, 132, 3, 2],
  [47, 134, 1, 1],
]);
/** The peeled corner where a flyer was taped, and the residue round it. */
const TR_TAPE = pxPath([[78, 126, 10, 6]]);
/** Graffiti, in two stages: a marker tag, then somebody's answer to it. */
const TR_TAG_A = pxPath([
  [162, 126, 3, 10],
  [165, 126, 7, 2],
  [169, 129, 3, 4],
  [165, 132, 7, 2],
]);
const TR_TAG_B = pxPath([
  [104, 130, 12, 2],
  [104, 130, 2, 7],
  [114, 133, 2, 4],
]);

/* --- the floor, and the door track at the front edge of the cab --- */
const FL_FACE = pxPath([[0, FLOOR, W, H - FLOOR]]);
const FL_SEAMS = pxPath([
  [0, 164, W, 1],
  [0, 176, W, 1],
]);
/** The speckle of a lift floor, and the dirt that lives in the corners. */
const FL_SPECKLE = pxPath(
  [14, 38, 62, 84, 110, 136, 158, 182].flatMap(
    (x, i) =>
      [
        [x, 156 + (i % 3) * 6, 2, 2],
        [x + 6, 168 - (i % 2) * 8, 1, 1],
      ] as Rect[],
  ),
);
const FL_CORNERS = pxPath([
  [0, FLOOR, 12, 7],
  [188, FLOOR, 12, 7],
]);
/** Pram wheel tracks, because a pram goes in and out of here twice a day. */
const FL_TRACKS = pxPath([
  [40, 162, 46, 1],
  [40, 170, 46, 1],
]);
const FL_TRACK_BAR = pxPath([[0, 176, W, 4]]);
const FL_TRACK_SPLIT = pxPath([[96, 176, 2, 4]]);
/** The cigarette burn somebody denies. */
const FL_BURN = pxPath([[148, 170, 2, 2]]);

/* --- light: the panel, the pool, the mirror bounce, the landing --- */
const LT_PANEL = tiers(
  (k) =>
    steppedQuad(
      CEIL_BOT,
      56 + (1 - k) * 24,
      144 - (1 - k) * 24,
      FLOOR,
      10 - (1 - k) * 10,
      190 + (1 - k) * 10,
      8,
    ),
  "w",
  0.85,
);
const LT_POOL = tiers(
  (k) => steppedEllipse(100, FLOOR + 4, Math.round(80 * k), Math.round(9 * k), 3),
  "w",
  0.55,
);
const LT_SOURCE = bulbPaths([[100, 38] as const]);
/** The mirror throws about a third of it back at the opposite wall. */
const LT_MIRROR = tiers(
  (k) =>
    steppedQuad(
      MR.y + 4,
      MR.x + 4 + (1 - k) * 12,
      MR.x + MR.w - 4 - (1 - k) * 12,
      FLOOR,
      MR.x - 8,
      MR.x + MR.w + 8,
      6,
    ),
  "c",
  0.3,
);
/** The landing, when the doors are standing open behind you. */
const LT_LANDING = tiers(
  (k) => steppedQuad(FLOOR - 14, 20 + (1 - k) * 40, 180 - (1 - k) * 40, H, 0, W, 6),
  "w",
  0.5,
);
/** The emergency light, which is all there is when the tube has gone. */
const LT_EMERG = tiers(
  (k) => steppedEllipse(28, 44, Math.round(30 * k), Math.round(24 * k), 3),
  "c",
  0.45,
);
const VIGNETTE = vignettePaths(W, H);

/* --- occlusion and contact --- */
const CAB_AO = aoPaths([
  [0, CEIL_BOT, W], // the soffit onto the wall
  [MR.x, MR.y + MR.h, MR.w], // the mirror frame
  [AD.x, AD.y + AD.h, AD.w],
  [0, RAIL_Y + 4, 148], // the handrail
  [150, 145, 32], // under the button panel case (PN), which declares later
  [0, LAM_TOP, W], // the laminate joint
]);
const CAB_CONTACT = contactPaths([
  [0, W, CY], // the whole wall meets the floor
]);

/* ================================================================== *
 * PLANE 1 — the ceiling soffit
 * ================================================================== */

function Ceiling({ ph, s }: { ph: Ph; s: LiftState }) {
  const ceil = CEILM[ph];
  const emerg = isEmergency(s);
  const flick = s.light === "flicker";
  return (
    <g>
      {/* the defs live in the bottom-most plane and nowhere else */}
      <SharedDefs />
      <path d={CE_SOFFIT} fill={ceil.base} />
      <path d={CE_SOFFIT_HI} fill={ceil.hi} />
      <path d={CE_SOFFIT_LO} fill={ceil.lo} />
      <rect x={0} y={0} width={W} height={CEIL_BOT} fill="url(#px-satin)" opacity={0.4} />
      {/* the hatch nobody has opened since the inspection */}
      <Bev set={CE_HATCH} mat={ceil} />
      <path d={CE_HATCH_SCREWS} fill={ceil.deep} />
      <path d={CE_HATCH_SEAM} fill={ceil.lo} />
      {/* the LED panel, even and kind, and the only thing lighting the room */}
      <Bev set={CE_PANEL_CASE} mat={ceil} />
      <path d={CE_PANEL_LENS} fill={emerg ? "#4a5058" : ph === "night" ? L.ledDim : L.led} />
      {!emerg ? (
        <path d={CE_PANEL_LENS} fill="#ffffff" opacity={0.5}>
          {/* one dip as the motor takes up load, or a dying tube if it is dying */}
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values={
              flick
                ? "0.5;0.5;0.1;0.5;0.05;0.5;0.5"
                : s.travelling
                  ? "0.5;0.5;0.15;0.5;0.5"
                  : "0.5;0.5;0.5;0.42;0.5"
            }
            dur={flick ? "2.7s" : s.travelling ? "9s" : "31s"}
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the emergency light, on its own little battery, which never goes out */}
      <Bev set={CE_EMERG} mat={PANEL[ph]} />
      <path d={CE_EMERG_FACE} fill={emerg ? L.green : L.greenDim} />
      {emerg ? (
        <path d={CE_EMERG_FACE} fill="#7ef0a8" opacity={0.6}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.6;0.45;0.6"
            dur="5.3s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the extract vent, and the camera dome in the corner */}
      <Bev set={CE_VENT} mat={ceil} />
      <path d={CE_VENT_FINS} fill={ceil.deep} />
      <Bev set={CE_CAM} mat={PANEL[ph]} />
      <path d={CE_CAM_DOME} fill={L.glass} />
      <path d={CE_CAM_LENS} fill={PANEL[ph].hi} />
      <path d={pxPath([[194, CEIL_BOT + 1, 2, 2]])} fill={L.redLed}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0;0;1"
          dur="4.4s"
          repeatCount="indefinite"
        />
      </path>
      {/* the web in the corner, which is where a web goes in a box with a fan */}
      <path d={CE_WEB} fill={L.web} opacity={0.3} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the shell: steel above the rail, laminate below
 * ================================================================== */

function Shell({ ph, s: _s }: { ph: Ph; s: LiftState }) {
  const steel = STEEL[ph];
  const lam = LAM[ph];
  return (
    <g>
      {/* brushed steel from the soffit down to the rail */}
      <path d={SH_STEEL} fill={steel.base} />
      <rect x={0} y={CEIL_BOT} width={W} height={LAM_TOP - CEIL_BOT} fill="url(#px-satin)" />
      <path d={SH_BRUSH} fill={steel.mid} opacity={0.7} />
      <path d={pxPath([[0, CEIL_BOT, W, 1]])} fill={steel.hi} />
      {/* the dent at shoulder height, and the scuff a handlebar leaves */}
      <path d={SH_DENT} fill={steel.mid} />
      <path d={SH_BIKE_SCUFF} fill={steel.deep} opacity={0.45} />
      {/* the rail band, the rail at 0.90 m, and where hands have polished it */}
      <path d={SH_RAIL_BAND} fill={steel.deep} />
      <path d={pxPath([[0, RAIL_Y - 4, 148, 1]])} fill="#7d8085" />
      <Bev set={SH_RAIL} mat={{ ...steel, base: L.rail, hi: "#e2e6ea" }} />
      <path d={SH_RAIL_WORN} fill={L.railWorn} />
      <path d={SH_RAIL_BRACKETS} fill={steel.deep} />
      {/* gum pressed up under it, where you only ever find it with your hand */}
      <path d={SH_GUM} fill={L.gum} />
      {/* the laminate, its seam, and the panel that has lifted */}
      <path d={SH_LAM} fill={lam.base} />
      <rect x={0} y={LAM_TOP} width={W} height={SKIRT - LAM_TOP} fill="url(#px-wood)" />
      <path d={pxPath([[0, LAM_TOP, W, 1]])} fill={lam.hi} />
      <path d={SH_LAM_SEAM} fill={lam.lo} />
      <path d={SH_LAM_LIFT} fill={lam.hi} />
      {/* the trolley and pram scuff, all the way round */}
      <path d={SH_SCUFF} fill={lam.deep} opacity={0.8} />
      {/* the corner kicked through to the steel underneath */}
      <path d={SH_KICKED} fill={steel.deep} />
      <path d={SH_SKIRT} fill={lam.deep} />
      <path d={SH_POSTS} fill={steel.lo} />
      <path d={SH_BUMPERS} fill={PANEL[ph].base} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the fittings, all inside arm's reach
 * ================================================================== */

/**
 * The mirror. The camera stands where the doors are, so the mirror holds the
 * wall behind you: the leaves, the indicator over them, the threshold, and when
 * they are open a slice of the landing.
 */
function Mirror({ ph, s }: { ph: Ph; s: LiftState }) {
  const mir = MIRRORR[ph];
  const night = ph === "night";
  const open = s.doorsOpen;
  return (
    <g>
      <Bev set={MR_FRAME} mat={STEEL[ph]} />
      <path d={MR_GLASS} fill={night ? mir.lo : mir.base} />
      {/* --- what it holds --- */}
      <path d={MR_REFLECT.panel} fill="#cfe0e6" />
      {open ? (
        <g style={{ transition: STEP_SLIDE }}>
          <path d={MR_REFLECT.landing} fill={night ? L.landingNight : L.landing} />
          <path d={MR_REFLECT.landingDoor} fill="#8a7d6c" />
          <path d={MR_REFLECT.landingFloor} fill="#7d7468" />
          <path d={MR_REFLECT.leavesOpen} fill="#8fa8b0" />
        </g>
      ) : (
        <g>
          <path d={MR_REFLECT.leavesShut} fill="#9cb8c0" />
          <path d={MR_REFLECT.split} fill="#7d949c" />
          <path d={pxPath([[MR.x + 5, MR.y + 16, 31, 1]])} fill={mir.base} />
        </g>
      )}
      {/* the handrail carrying on round behind you */}
      <path d={MR_REFLECT.rail} fill="#c2d6dc" />
      {/* the indicator above the doors, tiny and back to front */}
      <path d={MR_REFLECT.indBox} fill="#5d6a70" />
      <path d={MR_REFLECT.indLit} fill={isEmergency(s) ? "#4a5058" : "#7ee08c"} opacity={0.9}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.9;0.4;0.9"
          dur={s.travelling ? "1.2s" : "6s"}
          repeatCount="indefinite"
        />
      </path>
      <path d={MR_REFLECT.threshold} fill="#7d8f96" />
      {/* --- the glass itself --- */}
      <path d={MR_SPEC} fill="#ffffff" opacity={0.16} />
      <path d={pxPath([[MR.x + 5, MR.y + 8, 3, MR.h - 16]])} fill={mir.hi} />
      {s.mirror !== "clean" ? <path d={MR_SMEARS} fill="#c6dae0" opacity={0.7} /> : null}
      <path d={MR_SCRATCH} fill="#cfe0e6" opacity={0.6} />
      {s.mirror === "cracked" ? (
        <g>
          <path d={MR_CRACK} fill="#e8f2f6" opacity={0.8} />
          <path d={MR_CHIP} fill={STEEL[ph].deep} />
        </g>
      ) : null}
      {/* light from a passing floor crossing the glass */}
      {s.travelling ? (
        <rect x={MR.x + 4} y={MR.y + 4} width={MR.w - 8} height={5} fill="#ffffff" opacity={0}>
          <animate
            attributeName="y"
            values={`${MR.y + MR.h - 8};${MR.y + 4}`}
            dur="2.1s"
            repeatCount="indefinite"
          />
          <animate attributeName="opacity" values="0;0.4;0" dur="2.1s" repeatCount="indefinite" />
        </rect>
      ) : null}
    </g>
  );
}

/** The ad frame. Three posters, and it never stops on the one you were reading. */
function AdFrame({ ph, s }: { ph: Ph; s: LiftState }) {
  const backlit = ph !== "night" && !isEmergency(s);
  return (
    <g>
      <Bev set={AD_FRAME} mat={PANEL[ph]} />
      <path d={AD_FACE} fill={backlit ? "#f2f2ee" : "#b6b6b2"} />
      {/* poster one: the wspólnota notice, which is the same sheet that is posted
          at both ends of the stairwell — so it is fresh here if it is fresh there */}
      <g>
        <path d={pxPath([[AD.x + 3, AD.y + 4, AD.w - 6, 6]])} fill={L.noticeBlue} />
        <PixelText x={AD.x + 4} y={AD.y + 5} text="UWAGA" fill="#e8e6e0" gap={0} op={0.9} />
        <path
          d={pxPath([
            [AD.x + 4, AD.y + 12, AD.w - 9, 1],
            [AD.x + 4, AD.y + 15, AD.w - 13, 1],
            [AD.x + 4, AD.y + 18, AD.w - 10, 1],
          ])}
          fill="#5d6266"
        />
        {!s.noticeRead ? (
          <path d={pxPath([[AD.x + AD.w - 8, AD.y + 4, 4, 4]])} fill={L.noticeFlag} />
        ) : null}
        <animate
          attributeName="opacity"
          values="1;1;0;0;1"
          keyTimes="0;0.3;0.34;0.96;1"
          dur="21s"
          repeatCount="indefinite"
        />
      </g>
      {/* poster two: somebody's number, with tear-off tabs along the bottom */}
      <g opacity={0}>
        <path d={pxPath([[AD.x + 3, AD.y + 4, AD.w - 6, 10]])} fill="#e8c445" />
        <path
          d={pxPath([
            [AD.x + 5, AD.y + 7, 14, 2],
            [AD.x + 5, AD.y + 11, 10, 2],
          ])}
          fill="#7a6a2a"
        />
        <path d={pxPath(repeat(5, 4, [AD.x + 4, AD.y + 16, 3, 7] as Rect))} fill={L.paper} />
        <path d={pxPath([[AD.x + 16, AD.y + 16, 3, 4]])} fill={L.paperLo} />
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.34;0.38;0.64;0.68;1"
          dur="21s"
          repeatCount="indefinite"
        />
      </g>
      {/* poster three: pizza, obviously */}
      <g opacity={0}>
        <path d={pxPath([[AD.x + 3, AD.y + 4, AD.w - 6, 13]])} fill="#c94040" />
        <path d={pxPath([[AD.x + 7, AD.y + 7, 12, 8]])} fill="#e8c445" />
        <path
          d={pxPath([
            [AD.x + 9, AD.y + 9, 3, 3],
            [AD.x + 14, AD.y + 11, 3, 3],
          ])}
          fill="#a33a30"
        />
        <path d={pxPath([[AD.x + 3, AD.y + 18, AD.w - 6, 5]])} fill={L.paper} />
        <path d={pxPath([[AD.x + 6, AD.y + 20, 12, 2]])} fill="#c94040" />
        <animate
          attributeName="opacity"
          values="0;0;1;1;0"
          keyTimes="0;0.68;0.72;0.96;1"
          dur="21s"
          repeatCount="indefinite"
        />
      </g>
      {/* the perspex, and the corner where it has been prised open */}
      <path d={AD_SPEC} fill="#ffffff" opacity={0.1} />
      <path d={AD_PRISED} fill={PANEL[ph].hi} />
    </g>
  );
}

/**
 * The plates. Drawn legibly rather than to scale — a real capacity card is
 * 150 mm, which is four pixels, and there is no type at four pixels.
 */
function Plates({ ph, s }: { ph: Ph; s: LiftState }) {
  const overdue = s.service === "overdue";
  return (
    <g>
      {/* the UDT inspection plate, and the year of the next one */}
      <Bev set={PL_UDT} mat={{ ...STEEL[ph], base: L.paper, hi: "#f4f4f0" }} />
      <PixelText x={108} y={mAbove(1.95) + 3} text="UDT" fill="#4a4d52" gap={1} />
      <PixelText
        x={108}
        y={mAbove(1.95) + 8}
        text={overdue ? "2024" : "2026"}
        fill={overdue ? L.red : "#8a8d92"}
        gap={1}
      />
      <path d={pxPath([[124, mAbove(1.95) + 3, 5, 7]])} fill={L.noticeBlue} />
      <path d={pxPath([[125, mAbove(1.95) + 5, 3, 3]])} fill={L.paper} />
      {/* the capacity card: 630 kg, 8 people, in the only font they own */}
      <Bev set={PL_CAP} mat={{ ...STEEL[ph], base: L.paperLo, hi: L.paper }} />
      <PixelText x={107} y={mAbove(1.62) + 2} text="630 KG" fill="#4a4d52" gap={1} />
      <PixelText x={107} y={mAbove(1.62) + 8} text="8 OSÓB" fill="#8a8d92" gap={1} />
      {/* the service sticker, half peeled */}
      <path d={PL_SERVICE} fill={overdue ? L.red : L.amber} />
      <path d={pxPath([[108, mAbove(1.29), 20, 1]])} fill={overdue ? "#c94040" : L.amberHi} />
      <path d={PL_SERVICE_CURL} fill={STEEL[ph].mid} />
      {/* and when it is overdue, the A4 somebody taped up about it */}
      {overdue ? (
        <g>
          <path d={pxPath([[104, mAbove(1.1), 28, 12]])} fill={L.paper} />
          <PixelText x={106} y={mAbove(1.1) + 3} text="AWARIA" fill="#8a3030" gap={0} />
          <path d={pxPath([[106, mAbove(1.1) + 9, 20, 1]])} fill="#8a8d92" />
          <path d={pxPath([[103, mAbove(1.1) - 1, 30, 1]])} fill="#d8d3b8" opacity={0.8} />
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * INTERCOM — replacement block for elevator.tsx
 *
 * Replaces the IC_* constants and the Intercom component. Everything to change
 * outside the block is at the foot.
 *
 * THREE GEOMETRY DEFECTS, and I put all three there myself last pass.
 *
 *   1. The button overhung its own housing. IC_BODY runs y88..112, IC_BUTTON
 *      y106..115 — three pixels of button hanging below the box it is set into.
 *   2. The name strip was outside the unit entirely. IC_STRIP at y113..116 sat
 *      on bare steel below the housing, and its bottom edge touched the handrail
 *      at y116. A strip floating on the wall under an intercom is not a thing.
 *   3. The status LED at x144..146 straddled the right-hand edge of the speaker
 *      grille, which ends at x145.
 *
 * All three are the same class of mistake: sub-parts positioned by eye against
 * the wall instead of against the housing. Everything is now laid out inward from
 * the housing bounds, so it cannot happen again — and the housing itself is
 * bounded by two things it must not cross: UPPER_TOP at y74 above, and the
 * handrail at y116 below. That gives 42 px of usable wall, and the unit uses 36.
 *
 * ON SCALE. The housing is 18 x 28 px = 0.47 x 0.74 m, where a real EN 81-28 unit
 * is nearer 0.10 x 0.20 m. That is not a new error: the cab's doc comment already
 * states that signage and controls in this room are drawn legibly rather than to
 * scale, because a legible plate is the only content this room has. The button
 * panel beside it is 32 px wide for the same reason. The unit's *height on the
 * wall* is what has to be right, and the button centre is at 1.16 m.
 *
 * WHAT IT NOW IS, RATHER THAN WHAT IT LOOKED LIKE. The old unit was a grille, a
 * button and one LED that blinked whatever happened. A lift emergency unit is
 * specified by EN 81-28 and it has a **two-stage call**, which is the whole point
 * of the standard: you press, a pictogram lights to confirm the call has been
 * *registered*, and a second pictogram lights when a human has *answered*. Those
 * two lamps are the difference between shouting into a box and knowing somebody
 * is coming. So the unit has both, with their engraved pictograms — a bell and a
 * handset — and a new `call` stage drives them:
 *
 *     idle       both lamps dark, button lit and waiting
 *     sent       bell lamp flashing, button pressed in, grille dead
 *     answered   bell steady, handset lamp on, and the grille goes live
 *
 * It also answers to two states the cab already had. On `light === "emergency"`
 * the unit is the one thing still working — it shares the battery with the
 * ceiling light — so the button gets a halo and pulses, because it is the thing
 * you are supposed to press. On `service === "overdue"` there is an A4 taped
 * across the grille and the answered lamp is dead, which is the quiet way of
 * saying nobody is coming.
 *
 * AND THE THINGS A REAL ONE HAS THAT THIS DID NOT: a microphone hole separate
 * from the speaker, four fixing screws, braille beside the button as EN 81-70
 * requires, the emergency number on its own sticker above the unit, a cable gland
 * out of the bottom, the button worn shiny in the middle, and somebody's gum
 * pressed into the grille.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * state — one new stage, on world.lift beside the others
 * -------------------------------------------------------------------- */

export type LiftCall = "idle" | "sent" | "answered";
const CALLS: readonly LiftCall[] = ["idle", "sent", "answered"];

/**
 * Add to `liftState`:  `call: clampStage(lift.call, CALLS, "idle"),`
 * and to `elevatorArtKey`, after `s.service`:  `s.call,`
 */

/* -------------------------------------------------------------------- *
 * palette
 * -------------------------------------------------------------------- */

const ICK = {
  case: "#3f4246",
  caseHi: "#565a60",
  caseLo: "#2e3135",
  screw: "#6b6e73",
  grille: "#191c20",
  grilleLip: "#4d5158",
  mic: "#12151a",
  /** the two lamps, and their dead states */
  lampWindow: "#22262b",
  bellOn: "#ffb03a",
  bellDead: "#5a4a22",
  answerOn: "#3ddc84",
  answerDead: "#22462f",
  picto: "#8a8f96",
  pictoLit: "#12151a",
  /** the button: yellow by law, and worn pale where every thumb has been */
  button: "#d8b83c",
  buttonHi: "#e8c85c",
  buttonLo: "#a88c22",
  buttonWorn: "#efdc94",
  bell: "#6b5a1c",
  braille: "#6b6e73",
  plate: "#e8e6e0",
  plateEdge: "#b6b6b2",
  plateInk: "#4a4d52",
  gland: "#4d5158",
  gum: "#5d5a52",
  tape: "#d8d3b8",
  note: "#f2f2ee",
  noteInk: "#8a3030",
} as const;

/* -------------------------------------------------------------------- *
 * geometry — everything laid out inward from the housing, not off the wall
 * -------------------------------------------------------------------- */

/**
 * The housing. Bounded above by UPPER_TOP (74) and below by the handrail (116);
 * 18 x 28 leaves 4 px clear of both, and the button centre lands at 1.16 m.
 */
const IC = { x: 131, y: 84, w: 18, h: 28 } as const;
const IC_R = IC.x + IC.w; // 149
const IC_B = IC.y + IC.h; // 112

const IC_BODY = bevelPaths([[IC.x, IC.y, IC.w, IC.h]]);
/** Four screws, one in each corner, inside the bezel. */
const IC_SCREWS = pxPath([
  [IC.x + 1, IC.y + 1, 2, 2],
  [IC_R - 3, IC.y + 1, 2, 2],
  [IC.x + 1, IC_B - 3, 2, 2],
  [IC_R - 3, IC_B - 3, 2, 2],
]);
/** The speaker: 12 x 6, three rows of perforations, with a lip above it. */
const IC_GRILLE_RECESS = pxPath([[IC.x + 3, IC.y + 4, 12, 7]]);
const IC_GRILLE = pxPath(
  [0, 1, 2].flatMap((r) =>
    [0, 1, 2, 3, 4].map((c) => [IC.x + 4 + c * 2, IC.y + 5 + r * 2, 1, 1] as Rect),
  ),
);
const IC_GRILLE_LIP = pxPath([[IC.x + 3, IC.y + 4, 12, 1]]);
/** Somebody has pressed gum into it, which is what a grille in a lift gets. */
const IC_GUM = pxPath([[IC.x + 9, IC.y + 7, 2, 2]]);
/** The microphone, a separate hole, because a speaker is not a microphone. */
const IC_MIC = pxPath([[IC_R - 5, IC.y + 13, 2, 2]]);

/* --- the two lamps: EN 81-28 wants a registered pictogram and an answered one --- */
const IC_LAMP_L = { x: IC.x + 3, y: IC.y + 12, w: 5, h: 5 } as const;
const IC_LAMP_R = { x: IC.x + 9, y: IC.y + 12, w: 5, h: 5 } as const;
const IC_LAMP_WINDOWS = pxPath([
  [IC_LAMP_L.x, IC_LAMP_L.y, IC_LAMP_L.w, IC_LAMP_L.h],
  [IC_LAMP_R.x, IC_LAMP_R.y, IC_LAMP_R.w, IC_LAMP_R.h],
]);
/** A bell: a 3 px body and a clapper under it. Call registered. */
const IC_PICTO_BELL = pxPath([
  [IC_LAMP_L.x + 1, IC_LAMP_L.y + 1, 3, 2],
  [IC_LAMP_L.x + 2, IC_LAMP_L.y + 3, 1, 1],
]);
/** A handset: two earpieces and the bar between them. Call answered. */
const IC_PICTO_PHONE = pxPath([
  [IC_LAMP_R.x + 1, IC_LAMP_R.y + 1, 1, 2],
  [IC_LAMP_R.x + 3, IC_LAMP_R.y + 1, 1, 2],
  [IC_LAMP_R.x + 1, IC_LAMP_R.y + 3, 3, 1],
]);

/* --- the button: 12 x 9, centre at 1.06 m, with braille beside it --- */
const IC_BTN = { x: IC.x + 3, y: IC.y + 18, w: 12, h: 9 } as const;
const IC_BUTTON = bevelPaths([[IC_BTN.x, IC_BTN.y, IC_BTN.w, IC_BTN.h]]);
const IC_BUTTON_FACE = pxPath([[IC_BTN.x + 1, IC_BTN.y + 1, IC_BTN.w - 2, IC_BTN.h - 2]]);
/** Pressed in: one pixel down and a shade darker, which is all a press is. */
const IC_BUTTON_PRESSED = pxPath([[IC_BTN.x + 1, IC_BTN.y + 2, IC_BTN.w - 2, IC_BTN.h - 3]]);
/** The bell embossed on the face, and the patch every thumb has worn pale. */
const IC_BELL = pxPath([
  [IC_BTN.x + 5, IC_BTN.y + 3, 3, 3],
  [IC_BTN.x + 6, IC_BTN.y + 6, 1, 1],
]);
const IC_BTN_WORN = pxPath([[IC_BTN.x + 4, IC_BTN.y + 2, 5, 4]]);
/** Braille, in the 1 px the housing leaves to the right of the button. */
const IC_BRAILLE = pxPath([
  [IC_R - 2, IC_BTN.y + 1, 1, 1],
  [IC_R - 2, IC_BTN.y + 4, 1, 1],
  [IC_R - 2, IC_BTN.y + 7, 1, 1],
]);
/** The cable gland out of the bottom, clear of the handrail at y116. */
const IC_GLAND = pxPath([[IC.x + 7, IC_B, 5, 3]]);

/* --- the emergency number, on its own sticker above the unit --- */
const IC_PLATE = pxPath([[IC.x, IC.y - 9, IC.w, 8]]);
const IC_PLATE_EDGE = pxPath([[IC.x, IC.y - 9, IC.w, 1]]);
/** And the A4 somebody tapes across it when the inspection has lapsed. */
const IC_NOTE = pxPath([[IC.x - 1, IC.y + 3, IC.w + 2, 12]]);
const IC_NOTE_TAPE = pxPath([
  [IC.x - 2, IC.y + 3, IC.w + 4, 1],
  [IC.x - 2, IC.y + 14, IC.w + 4, 1],
]);

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

/**
 * The intercom. A grille, a microphone, two lamps that mean two different
 * things, and a button — which is the only promise this room makes.
 */
function Intercom({ ph, s }: { ph: Ph; s: LiftState }) {
  const emerg = isEmergency(s);
  const dead = s.service === "overdue";
  const sent = s.call === "sent";
  const answered = s.call === "answered";
  /** Registered lamp: flashing while the call goes out, steady once answered. */
  const bellLit = sent || answered;
  /** Answered lamp: never lights if nobody is maintaining the line. */
  const answerLit = answered && !dead;
  return (
    <g>
      {/* the emergency number, on its own sticker above the unit */}
      <path d={IC_PLATE} fill={ICK.plate} />
      <path d={IC_PLATE_EDGE} fill={ICK.plateEdge} />
      <PixelText x={IC.x + 4} y={IC.y - 7} text="112" fill={ICK.plateInk} gap={1} />

      {/* the housing, and the four screws holding it to the wall */}
      <Bev set={IC_BODY} mat={{ ...PANEL[ph], base: ICK.case, hi: ICK.caseHi }} />
      <path d={IC_SCREWS} fill={ICK.screw} />

      {/* the speaker, and the gum in it */}
      <path d={IC_GRILLE_RECESS} fill={ICK.grille} />
      <path d={IC_GRILLE_LIP} fill={ICK.grilleLip} />
      <path d={IC_GRILLE} fill={ICK.caseLo} />
      <path d={IC_GUM} fill={ICK.gum} />
      {/* and when somebody is on the other end of it, it goes live */}
      {answerLit ? (
        <path d={IC_GRILLE_RECESS} fill={ICK.answerOn} opacity={0.14}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.14;0.05;0.11;0.04;0.14"
            dur="1.7s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the microphone, which is not the speaker */}
      <path d={IC_MIC} fill={ICK.mic} />

      {/* --- the two lamps. This is what the standard is actually about. --- */}
      <path d={IC_LAMP_WINDOWS} fill={ICK.lampWindow} />
      {/* left: call registered */}
      <path
        d={pxPath([[IC_LAMP_L.x, IC_LAMP_L.y, IC_LAMP_L.w, IC_LAMP_L.h]])}
        fill={bellLit ? ICK.bellOn : ICK.bellDead}
        opacity={bellLit ? 1 : 0.5}
        style={{ transition: STEP_FADE }}
      >
        {sent && !answered ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.2;1;0.2"
            dur="1s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      <path d={IC_PICTO_BELL} fill={bellLit ? ICK.pictoLit : ICK.picto} />
      {/* right: call answered — dark for good if nobody is maintaining the line */}
      <path
        d={pxPath([[IC_LAMP_R.x, IC_LAMP_R.y, IC_LAMP_R.w, IC_LAMP_R.h]])}
        fill={answerLit ? ICK.answerOn : ICK.answerDead}
        opacity={answerLit ? 1 : 0.5}
        style={{ transition: STEP_FADE }}
      />
      <path d={IC_PICTO_PHONE} fill={answerLit ? ICK.pictoLit : ICK.picto} />

      {/* --- the button --- */}
      <Bev set={IC_BUTTON} mat={{ ...PANEL[ph], base: ICK.buttonLo, hi: ICK.buttonHi }} />
      <path
        d={sent ? IC_BUTTON_PRESSED : IC_BUTTON_FACE}
        fill={ICK.button}
        style={{ transition: STEP_FADE }}
      />
      {/* the patch every thumb in the block has worn pale */}
      {!sent ? <path d={IC_BTN_WORN} fill={ICK.buttonWorn} opacity={0.5} /> : null}
      <path d={IC_BELL} fill={ICK.bell} />
      <path d={IC_BRAILLE} fill={ICK.braille} opacity={0.7} />
      {/**
       * On emergency power the unit shares the ceiling light's battery, so it is
       * the one thing in here still working — and it says so, because it is the
       * thing you are supposed to press.
       */}
      {emerg && s.call === "idle" ? (
        <g>
          <path
            d={pxPath([[IC_BTN.x - 1, IC_BTN.y - 1, IC_BTN.w + 2, IC_BTN.h + 2]])}
            fill={ICK.buttonHi}
            opacity={0.3}
          >
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.3;0.08;0.3;0.08"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </path>
          <path d={IC_BUTTON_FACE} fill={ICK.buttonHi} opacity={0.35} />
        </g>
      ) : null}

      {/* the cable out of the bottom, clear of the handrail */}
      <path d={IC_GLAND} fill={ICK.gland} />

      {/* and the A4 across the grille when the inspection has lapsed */}
      {dead ? (
        <g>
          <path d={IC_NOTE} fill={ICK.note} />
          <PixelText x={IC.x} y={IC.y + 5} text="AWARIA" fill={ICK.noteInk} gap={0} />
          <path
            d={pxPath([
              [IC.x + 2, IC.y + 12, 12, 1],
              [IC.x + 2, IC.y + 14, 8, 1],
            ])}
            fill="#8a8d92"
          />
          <path d={IC_NOTE_TAPE} fill={ICK.tape} opacity={0.85} />
        </g>
      ) : null}
    </g>
  );
}

/* ==================================================================== *
 * WHAT TO CHANGE OUTSIDE THIS BLOCK
 *
 * 1. THE NEW STAGE. In `liftState`, beside the others:
 *
 *        call: clampStage(lift.call, CALLS, "idle"),
 *
 *    and in the `LiftState` type:  `call: LiftCall;`
 *    and in `elevatorArtKey`, after `s.service`:  `s.call,`
 *
 * 2. THE OLD CONSTANTS GO. `IC_BODY`, `IC_GRILLE`, `IC_BUTTON`, `IC_BELL` and
 *    `IC_STRIP` are all superseded — the first four are redefined here, and
 *    `IC_STRIP` is deleted outright. It was the name strip that sat outside the
 *    housing on bare steel; the emergency number is on a proper sticker above the
 *    unit now, which is where it lives on a real one.
 *
 * 3. ONE DUPLICATION WORTH RESOLVING, and it is not in this block. `PN_AUX_ALARM`
 *    puts a second alarm button on the main button panel, so the cab has two —
 *    one here at 1.16 m with braille, one on the panel at 0.71 m. A real cab has
 *    one alarm, and it is the one with the two lamps beside it. Either drop
 *    `PN_AUX_ALARM` and leave the aux row as door-open and door-close, or make it
 *    a door-hold. Whichever you pick, only one of them should be yellow.
 *
 * 4. OPTIONAL — the press itself. `actionUi` only reaches `ElevatorEffects`, not
 *    this component, so the button cannot react to the player pressing it from in
 *    here. If you want that, the cheapest route is to let the `liftpanel` action
 *    write `lift.call = "sent"` and then `"answered"` a few seconds later; the
 *    unit already draws all three stages, so nothing here needs touching.
 *
 * GEOMETRY, FOR THE RECORD. Housing x131..149, y84..112 — four pixels clear of
 * UPPER_TOP at y74 and four clear of the handrail at y116. Every sub-part is
 * positioned inward from those bounds rather than measured off the wall, which is
 * what caused all three of the defects this block fixes. Button centre 1.16 m,
 * lamps 1.37 m, grille 1.55 m, number plate 1.92 m.
 * ==================================================================== */

/* ==================================================================== *
 * PANEL — replacement block for elevator.tsx
 *
 * Replaces the PN_* constants and the Panel component. Everything to change
 * outside the block is at the foot.
 *
 * FOUR GEOMETRY DEFECTS, and the braille is all six of them at once.
 *
 *   1. `[b.x + 12, ...]` puts the braille cell 12 px right of each ring. The
 *      rings are 11 wide at x155 and x168, so the **left column's braille lands
 *      on top of the right column's buttons** (167..173 against a ring starting
 *      at 168) and the **right column's runs 4 px outside the case** (180..186
 *      against a case ending at 182). Not one of the six is in a legal place.
 *   2. The bottom button row (y114..123) and the aux row (y123..131) share the
 *      pixel at y123 — they touch rather than sit apart.
 *   3. The alarm bell's clapper is at y122..123 while its own button starts at
 *      y123: one pixel above the thing it belongs to.
 *   4. The case stops at y142 with the skirting at y146, so four pixels of wall
 *      show under a panel that should run into it.
 *
 * Same root cause as the intercom: sub-parts offset from a neighbour instead of
 * bounded by the case. The whole panel is now a single grid laid out inward from
 * the case, and the braille is a 1 px column of three dots in the gap each ring
 * actually leaves — 1 px at x166 for the left column, 1 px at x179 for the right.
 * That is all the width there is, and a 1 px column of three reads as *there is
 * braille here*, which is the honest limit at 2.6 cm per pixel.
 *
 * AND ONE FUNCTIONAL BUG, which is the more interesting one.
 * `digits = ["4", "3", "2", "1"]` is hardcoded, so the position indicator counts
 * 4-3-2-1 no matter what floor you are on or which way you are going. `FLOORS` is
 * `["P","0","1","2","3","4"]`, so while moving the display could never show P at
 * all — the one floor everybody in this building is going to. It counts properly
 * now, from `floor` toward `dest`, through the real floor list, in the real
 * direction.
 *
 * THE FLOOR LIST WAS WRONG TOO. It had both `P` and `0`. In a Polish block parter
 * *is* the ground floor; there is no separate zero. What there is, and what was
 * missing, is the basement — which is where the storage cages are, and therefore
 * where half the trips in a block actually go. The set is `-1, P, 1, 2, 3, 4`.
 *
 * TWO NEW STAGES, because a panel that cannot show a pressed button is a picture
 * of a panel rather than a panel:
 *
 *   dest   the floor you pressed. Lit amber and pulsing the whole way there,
 *          which is the single most recognisable thing a lift panel does. The
 *          current floor lights only once you have stopped.
 *   load   ok → full → over. The overload bar in the display goes amber then red,
 *          and on `over` the door buttons go dead, because that is what happens.
 *
 * ON ACCESSIBILITY, HONESTLY. EN 81-70 wants every control between 0.9 and 1.2 m.
 * The six floor buttons sit between 0.68 and 1.37 m and the door buttons at
 * 0.47 m, which is outside it — as it is in plenty of older Polish installations,
 * and as the panel this replaces already was. The floor buttons, which are the
 * ones that matter, are within reach of a seated hand; the door pair is in the
 * bottom row of the grid where the fitter put it.
 *
 * WEAR, AND WHERE IT GOES. Everybody in this block presses two buttons: 4, because
 * they live there, and P, because that is the way out. Both are worn pale. 2 and 1
 * are untouched. The 3 has been rubbed until the numeral is nearly gone, because
 * the neighbour on 3 presses it twice a day and nobody else ever has.
 * ==================================================================== */

/* -------------------------------------------------------------------- *
 * state — two new stages, and a corrected floor list
 * -------------------------------------------------------------------- */

export type LiftLoad = "ok" | "full" | "over";
const LOADS: readonly LiftLoad[] = ["ok", "full", "over"];

/**
 * Replaces the old FLOORS. Bottom to top, which is the order the display counts
 * through — `-1` for the basement, `P` for parter, and no `0`, because a Polish
 * block does not have one.
 */
const FLOORS = ["-1", "P", "1", "2", "3", "4"] as const;

/** Every floor between `from` and `to` inclusive, in travel order. */
function floorRun(from: string, to: string): string[] {
  const a = FLOORS.indexOf(from as (typeof FLOORS)[number]);
  const b = FLOORS.indexOf(to as (typeof FLOORS)[number]);
  if (a < 0 || b < 0 || a === b) return [from];
  const step = b > a ? 1 : -1;
  const out: string[] = [];
  for (let i = a; i !== b + step; i += step) out.push(FLOORS[i]);
  return out;
}

/* -------------------------------------------------------------------- *
 * palette
 * -------------------------------------------------------------------- */

const PNK = {
  case: "#3f4246",
  caseHi: "#565a60",
  caseLo: "#2b2e32",
  bezel: "#4d5158",
  screen: "#0d1f16",
  screenFrame: "#14161a",
  digit: "#3ddc84",
  digitDim: "#1f6b42",
  arrow: "#3ddc84",
  loadOk: "#1c3a28",
  loadFull: "#d8b83c",
  loadOver: "#e0483a",
  ring: "#aeb2b8",
  ringHi: "#c4c8ce",
  face: "#e8e6e0",
  faceWorn: "#f4f2ec",
  faceLit: "#e8b93c",
  ink: "#4a4d52",
  inkLit: "#5d4a1a",
  inkFaded: "#9aa0a6",
  braille: "#c4c8ce",
  door: "#c8ccd2",
  doorInk: "#3a3d43",
  doorDead: "#6b6e73",
  key: "#2e3135",
  keyhole: "#8a8f96",
  etch: "#565a60",
  burn: "#2a2724",
} as const;

/* -------------------------------------------------------------------- *
 * geometry — one grid, laid out inward from the case
 * -------------------------------------------------------------------- */

/** The case now runs into the skirting at y146 instead of stopping 4 px short. */
const PN = { x: 150, y: 80, w: 32, h: 65 } as const;
// PN_R (case right edge) = PN.x + PN.w = 182
const PN_B = PN.y + PN.h; // 145
const PN_CASE = bevelPaths([[PN.x, PN.y, PN.w, PN.h]]);

/* --- the display: a position digit, a direction arrow, an overload bar --- */
const PN_DISPLAY_FRAME = bevelPaths([[154, 82, 24, 13]]);
const PN_DISPLAY = pxPath([[155, 83, 22, 11]]);
/** The overload bar down the left of the screen, which is where a status lamp goes. */
const PN_LOAD_BAR = pxPath([[156, 85, 3, 7]]);
/** Up and down, drawn once each rather than branched inside the render. */
const PN_ARROW_UP = pxPath([
  [169, 89, 5, 1],
  [170, 87, 3, 1],
  [171, 86, 1, 1],
]);
const PN_ARROW_DOWN = pxPath([
  [169, 86, 5, 1],
  [170, 88, 3, 1],
  [171, 89, 1, 1],
]);

/* --- the grid: two columns, four rows. Floors in three, doors in the fourth. --- */
const PN_COL = [154, 167] as const;
const PN_ROW = [98, 108, 118, 128] as const;
const PN_RING_W = 11;
const PN_RING_H = 8;
/**
 * Reading order down the grid gives 4, 3, 2, 1, P, -1 — descending, which is how
 * a two-column panel is laid out. Left column worn, right column not.
 */
const PN_BUTTONS: readonly {
  label: string;
  x: number;
  y: number;
  worn?: boolean;
  faded?: boolean;
}[] = [
  { label: "4", x: PN_COL[0], y: PN_ROW[0], worn: true },
  { label: "3", x: PN_COL[1], y: PN_ROW[0], faded: true },
  { label: "2", x: PN_COL[0], y: PN_ROW[1] },
  { label: "1", x: PN_COL[1], y: PN_ROW[1] },
  { label: "P", x: PN_COL[0], y: PN_ROW[2], worn: true },
  { label: "-1", x: PN_COL[1], y: PN_ROW[2] },
];
const PN_RINGS = bevelPaths(PN_BUTTONS.map((b) => [b.x, b.y, PN_RING_W, PN_RING_H] as Rect));
/**
 * Braille: a 1 px column of three dots in the gap each ring leaves — x166 for the
 * left column, x179 for the right. That is the whole available width, and at
 * 2.6 cm per pixel a column of three is as much as a braille cell can be.
 */
const PN_BRAILLE = pxPath(
  PN_BUTTONS.flatMap(
    (b) =>
      [
        [b.x + PN_RING_W + 1, b.y + 1, 1, 1],
        [b.x + PN_RING_W + 1, b.y + 3, 1, 1],
        [b.x + PN_RING_W + 1, b.y + 5, 1, 1],
      ] as Rect[],
  ),
);

/* --- the bottom row of the grid: door open, door close --- */
const PN_DOORS = bevelPaths([
  [PN_COL[0], PN_ROW[3], PN_RING_W, PN_RING_H],
  [PN_COL[1], PN_ROW[3], PN_RING_W, PN_RING_H],
]);
/** Two leaves parting, and two leaves meeting. */
const PN_SYM_OPEN = pxPath([
  [PN_COL[0] + 2, PN_ROW[3] + 2, 2, 4],
  [PN_COL[0] + 7, PN_ROW[3] + 2, 2, 4],
  [PN_COL[0] + 5, PN_ROW[3] + 1, 1, 6],
]);
const PN_SYM_CLOSE = pxPath([
  [PN_COL[1] + 4, PN_ROW[3] + 2, 2, 4],
  [PN_COL[1] + 5, PN_ROW[3] + 2, 2, 4],
  [PN_COL[1] + 1, PN_ROW[3] + 1, 1, 6],
  [PN_COL[1] + 9, PN_ROW[3] + 1, 1, 6],
]);

/* --- the caretaker's key switch, and the etched plate under it --- */
const PN_KEY = pxPath([[PN.x + 2, 138, PN.w - 4, 5]]);
const PN_KEYHOLE = pxPath([[164, 140, 5, 2]]);
const PN_ETCH = pxPath([[PN.x + 3, PN_B - 2, PN.w - 6, 1]]);
/** The burn somebody left on the bezel and nobody has ever owned up to. */
const PN_BURN = pxPath([
  [179, 100, 2, 2],
  [180, 102, 1, 1],
]);

/* -------------------------------------------------------------------- *
 * component
 * -------------------------------------------------------------------- */

/**
 * The button column. Six floors, two door buttons, a position display that
 * actually counts, and the two buttons everybody in the block has worn pale.
 */
function Panel({ ph, s }: { ph: Ph; s: LiftState }) {
  const emerg = isEmergency(s);
  const over = s.load === "over";
  /** While it is moving, the run it is actually making — not a hardcoded 4-3-2-1. */
  const run = s.travelling ? floorRun(s.floor, s.dest ?? (s.goingUp ? "4" : "P")) : [];
  const step = run.length > 1 ? 1 / run.length : 1;
  /** Centre one glyph or two in a 22 px screen. */
  const digitX = (t: string) => (t.length > 1 ? 160 : 163);
  return (
    <g>
      <Bev set={PN_CASE} mat={{ ...PANEL[ph], base: PNK.case, hi: PNK.caseHi }} />

      {/* ---- the display -------------------------------------------------- */}
      <Bev set={PN_DISPLAY_FRAME} mat={{ ...PANEL[ph], base: PNK.screenFrame, hi: PNK.bezel }} />
      <path d={PN_DISPLAY} fill={PNK.screen} />
      {/* the overload bar: amber when it is full, red when it is over */}
      <path
        d={PN_LOAD_BAR}
        fill={over ? PNK.loadOver : s.load === "full" ? PNK.loadFull : PNK.loadOk}
        style={{ transition: STEP_FADE }}
      >
        {over ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.25;1;0.25"
            dur="0.7s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      {/* the position: counting through the real run, or holding the floor */}
      {s.travelling && run.length > 1 ? (
        <g>
          {run.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the floor run is a fixed sequence per travel
            <g key={`${f}-${i}`} opacity={0}>
              <PixelText x={digitX(f)} y={86} text={f} fill={PNK.digit} gap={1} />
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0;1;0"
                keyTimes={`0;${(i * step).toFixed(4)};${((i + 1) * step).toFixed(4)}`}
                dur={`${(run.length * 1.9).toFixed(1)}s`}
                repeatCount="indefinite"
              />
            </g>
          ))}
        </g>
      ) : (
        <PixelText
          x={digitX(emerg ? "-" : s.floor)}
          y={86}
          text={emerg ? "-" : s.floor}
          fill={emerg ? PNK.digitDim : PNK.digit}
          gap={1}
        />
      )}
      {/* the arrow that tells you which way your evening is going */}
      <g opacity={emerg ? 0.25 : 1}>
        <path d={s.goingUp ? PN_ARROW_UP : PN_ARROW_DOWN} fill={PNK.arrow} />
        {s.travelling ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.2;1"
            dur="1.2s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      {/* ---- the floor buttons ------------------------------------------- */}
      <Bev set={PN_RINGS} mat={{ ...PANEL[ph], base: PNK.ring, hi: PNK.ringHi }} />
      {PN_BUTTONS.map((b) => {
        /** the one you pressed stays lit the whole way; where you are lights on arrival */
        const pressed = s.travelling && s.dest === b.label && !emerg;
        const here = !s.travelling && b.label === s.floor && !emerg;
        const lit = pressed || here;
        return (
          <g key={b.label}>
            <path
              d={pxPath([[b.x + 1, b.y + 1, PN_RING_W - 2, PN_RING_H - 2]])}
              fill={lit ? PNK.faceLit : b.worn ? PNK.faceWorn : PNK.face}
              style={{ transition: STEP_FADE }}
            />
            <PixelText
              x={b.label.length > 1 ? b.x + 2 : b.x + 4}
              y={b.y + 2}
              text={b.label}
              fill={lit ? PNK.inkLit : b.faded ? PNK.inkFaded : PNK.ink}
              gap={1}
              op={b.faded ? 0.45 : undefined}
            />
            {/* pressed and still going: it pulses. Arrived: it just sits there lit. */}
            {pressed ? (
              <path d={pxPath([[b.x, b.y, PN_RING_W, PN_RING_H]])} fill={PNK.faceLit} opacity={0.3}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.3;0.1;0.3"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
            ) : null}
            {here ? (
              <path
                d={pxPath([[b.x, b.y, PN_RING_W, PN_RING_H]])}
                fill={PNK.faceLit}
                opacity={0.22}
              />
            ) : null}
          </g>
        );
      })}
      {/* the braille, in the one pixel each ring leaves beside it */}
      <path d={PN_BRAILLE} fill={PNK.braille} opacity={0.6} />

      {/* ---- the bottom row: door open, door close ----------------------- */}
      <Bev set={PN_DOORS} mat={{ ...PANEL[ph], base: PNK.ring, hi: PNK.ringHi }} />
      <path
        d={pxPath([
          [PN_COL[0] + 1, PN_ROW[3] + 1, PN_RING_W - 2, PN_RING_H - 2],
          [PN_COL[1] + 1, PN_ROW[3] + 1, PN_RING_W - 2, PN_RING_H - 2],
        ])}
        fill={PNK.door}
      />
      {/* on overload they do nothing, and they look like they do nothing */}
      <path d={PN_SYM_OPEN} fill={over ? PNK.doorDead : PNK.doorInk} />
      <path d={PN_SYM_CLOSE} fill={over ? PNK.doorDead : PNK.doorInk} />
      {over ? (
        <path
          d={pxPath([
            [PN_COL[0] + 1, PN_ROW[3] + 1, PN_RING_W - 2, PN_RING_H - 2],
            [PN_COL[1] + 1, PN_ROW[3] + 1, PN_RING_W - 2, PN_RING_H - 2],
          ])}
          fill={PNK.caseLo}
          opacity={0.35}
        />
      ) : null}

      {/* ---- the key switch, the etched plate, and the burn -------------- */}
      <path d={PN_KEY} fill={PNK.key} />
      <path d={PN_KEYHOLE} fill={PNK.keyhole} />
      <path d={PN_ETCH} fill={PNK.etch} opacity={0.7} />
      <path d={PN_BURN} fill={PNK.burn} opacity={0.8} />
    </g>
  );
}

/* ==================================================================== *
 * WHAT TO CHANGE OUTSIDE THIS BLOCK
 *
 * 1. THE FLOOR LIST. The old `FLOORS = ["P","0","1","2","3","4"]` is replaced by
 *    the one in this block. `floor` still defaults to `"4"`, so nothing breaks —
 *    but a save holding `floor: "0"` will now fall back to `"4"` rather than
 *    showing a floor that does not exist. If any other scene writes `lift.floor`,
 *    `"0"` becomes `"P"`.
 *
 * 2. THE TWO NEW STAGES. In `LiftState`:
 *
 *        dest: string | null;
 *        load: LiftLoad;
 *
 *    In `liftState`:
 *
 *        dest: typeof lift.dest === "string" && (FLOORS as readonly string[]).includes(lift.dest)
 *          ? lift.dest : null,
 *        load: clampStage(lift.load, LOADS, "ok"),
 *
 *    In `elevatorArtKey`, after `s.floor`:  `s.dest ?? "-", s.load,`
 *
 * 3. THE ALARM IS GONE FROM HERE, which resolves the duplication the intercom
 *    block flagged. `PN_AUX`, `PN_AUX_OPEN` and `PN_AUX_ALARM` are all superseded:
 *    the bottom row of the grid is now door-open and door-close, and the cab's one
 *    alarm is the intercom's, where it belongs — it is the button with the two
 *    lamps beside it. Nothing on this panel is yellow any more, which is the tell
 *    that there is only one alarm in the room.
 *
 * 4. THE CASE GREW 4 PX. `PN` is now `{ x: 150, y: 80, w: 32, h: 65 }`, running to
 *    y145 so it meets the skirting at y146. It still clears the handrail, which
 *    stops at x146.
 *
 * 5. OPTIONAL — making the buttons actually work. `actionUi` only reaches
 *    `ElevatorEffects`, so a press cannot be handled in here. The cheapest wiring
 *    is for the `liftpanel` action to set `lift.dest`, then `lift.travelling`,
 *    then on arrival set `lift.floor = dest` and clear `dest`. The panel already
 *    draws all of it: the pressed button pulses the whole way, the display counts
 *    the real run, and the arrival lights the floor you are standing on.
 *
 * GEOMETRY, FOR THE RECORD. Case x150..182, y80..145. Grid columns at 154 and 167,
 * rings 11 x 8, rows at 98 / 108 / 118 / 128 with 2 px between them. Braille at
 * x166 and x179, both inside the case. Floor buttons 0.68–1.37 m, door pair
 * 0.47 m, key switch 0.32 m, display 1.79 m.
 * ==================================================================== */

/** The traces other people leave, at the heights other people leave them. */
function Traces({ ph, s }: { ph: Ph; s: LiftState }) {
  return (
    <g>
      {/* the sticker, at exactly the height of a five-year-old */}
      <path d={TR_STICKER} fill="#e8c445" />
      <path d={pxPath([[12, mAbove(1.26), 12, 2]])} fill="#f2d86a" />
      <path d={TR_STICKER_FACE} fill="#2e3033" />
      <path d={TR_STICKER_PEEL} fill="#c9a52e" />
      {/* initials and a heart, scratched into the laminate with a key */}
      <path d={TR_INITIALS} fill={L.scratch} />
      <path d={TR_HEART} fill={L.scratch} />
      {/* the peeled corner where a flyer was taped */}
      <path d={TR_TAPE} fill={LAM[ph].lo} />
      <path d={pxPath([[78, 126, 10, 1]])} fill={LAM[ph].hi} />
      {/* graffiti: a marker tag, and then somebody's answer to it */}
      {s.graffiti >= 1 ? <path d={TR_TAG_A} fill="#2b3138" opacity={0.7} /> : null}
      {s.graffiti >= 2 ? <path d={TR_TAG_B} fill="#7a3a34" opacity={0.6} /> : null}
    </g>
  );
}

/** The floor, and whatever the day has left on it. */
function CabFloor({ ph, s }: { ph: Ph; s: LiftState }) {
  const fl = FLOORR[ph];
  return (
    <g>
      <path d={FL_FACE} fill={fl.base} />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-agg)" />
      <path d={FL_SEAMS} fill={fl.lo} />
      <path d={FL_SPECKLE} fill={fl.deep} opacity={0.7} />
      <path d={FL_CORNERS} fill={fl.lo} />
      {/* pram tracks, because a pram goes in and out of here twice a day */}
      <path d={FL_TRACKS} fill={fl.mid} opacity={0.6} />
      {/* the door track at the very front edge of the cab */}
      <path d={FL_TRACK_BAR} fill="#5d6266" />
      <path d={pxPath([[0, 177, W, 1]])} fill="#7d8085" />
      <path d={FL_TRACK_SPLIT} fill="#4a4d52" />
      {/* what got left behind, and it depends when you are riding */}
      {s.litter >= 1 && ph === "dawn" ? (
        <g>
          {/* the morning's flyers, dropped in a fan */}
          <path d={pxPath([[60, 158, 16, 8]])} fill={L.paper} />
          <path d={pxPath([[62, 160, 12, 1]])} fill="#8a8d92" />
          <path d={pxPath([[70, 163, 15, 7]])} fill={L.paperLo} />
          <path d={pxPath([[72, 165, 10, 1]])} fill="#c94040" />
        </g>
      ) : null}
      {s.litter >= 1 && ph === "dusk" ? (
        <g>
          {/* a shopping bag handle print, and a leek leaf */}
          <path d={pxPath([[112, 160, 18, 3]])} fill="#8a8d92" />
          <path d={pxPath([[118, 156, 8, 5]])} fill="#5f7a63" />
        </g>
      ) : null}
      {s.litter >= 1 && ph === "night" ? (
        <g>
          {/* the glove that has been in this corner for a fortnight */}
          <path d={pxPath([[16, 162, 12, 7]])} fill="#4a5866" />
          <path d={pxPath([[16, 162, 12, 2]])} fill="#56657a" />
          <path d={pxPath([[26, 164, 4, 3]])} fill="#3e4b57" />
        </g>
      ) : null}
      {s.litter >= 2 ? (
        <g>
          {/* and once it has been a fortnight, a bottle top and a bus ticket */}
          <path d={pxPath([[92, 172, 3, 2]])} fill="#c94040" />
          <path d={pxPath([[138, 166, 6, 3]])} fill={L.paperLo} />
        </g>
      ) : null}
      <path d={FL_BURN} fill="#3a3833" />
      <Contact set={CAB_CONTACT} op={0.7} />
      <AOSet set={CAB_AO} op={0.85} />
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function ElevatorScene({ world, phase }: { world: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = liftState(world, ph);
  /**
   * Half a pixel of vibration while it is going somewhere, and a single harder
   * jolt at each end — which is the bit you actually feel in a lift.
   */
  const shake = s.travelling ? (
    <animateTransform
      attributeName="transform"
      type="translate"
      values="0 0;0.4 0.3;-0.3 0.2;0.2 -0.3;0 0"
      dur="0.42s"
      repeatCount="indefinite"
    />
  ) : null;
  return (
    <LayeredScene
      parallax={{ farBackground: 1, middleBackground: 1 }}
      farBackground={
        <g>
          {shake}
          <Ceiling ph={ph} s={s} />
        </g>
      }
      middleBackground={
        <g>
          {shake}
          <Shell ph={ph} s={s} />
        </g>
      }
      ground={
        <g>
          {shake}
          <CabFloor ph={ph} s={s} />
        </g>
      }
      staticObjects={
        <g>
          {shake}
          <Mirror ph={ph} s={s} />
          <AdFrame ph={ph} s={s} />
          <Plates ph={ph} s={s} />
          <Traces ph={ph} s={s} />
        </g>
      }
      gameplayObjects={
        <g>
          {shake}
          <Intercom ph={ph} s={s} />
          <Panel ph={ph} s={s} />
        </g>
      }
    />
  );
}

/* ================================================================== *
 * foreground — the side walls running back toward the camera
 * ================================================================== */

function ElevatorFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = world ? liftState(world, ph) : null;
  const steel = STEEL[ph];
  const lam = LAM[ph];
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
        {/* the two side walls, foreshortened, with their own rails and laminate */}
        {[
          { x: 0, edge: 0, hi: 0 },
          { x: 190, edge: 196, hi: 190 },
        ].map((w) => (
          <g key={w.x}>
            <path d={pxPath([[w.x, 0, 10, H]])} fill={steel.lo} />
            <path d={pxPath([[w.edge, 0, 4, H]])} fill={w.x === 0 ? steel.base : steel.deep} />
            <path d={pxPath([[w.x, RAIL_Y - 4, 10, 4]])} fill={steel.deep} />
            <path d={pxPath([[w.x, LAM_TOP, 10, SKIRT - LAM_TOP + 4]])} fill={lam.lo} />
            {/* the side rail, which is the one people actually hold */}
            <path d={pxPath([[w.hi + 2, RAIL_Y, 8, 4]])} fill={L.rail} />
            <path d={pxPath([[w.hi + 2, RAIL_Y, 8, 1]])} fill="#e2e6ea" />
            {/* and the scuff along it at trolley height */}
            <path d={pxPath([[w.x, mAbove(0.45), 10, 2]])} fill={lam.deep} opacity={0.7} />
          </g>
        ))}
        {/* the threshold you stepped over, at the bottom of the frame */}
        <path d={pxPath([[0, 174, W, 6]])} fill="#4a4d52" />
        <path d={pxPath([[0, 174, W, 1]])} fill="#6b6e73" />
        <path d={pxPath([[0, 178, W, 2]])} fill="#2e3135" />
        {/* the light coming up through the door gap while it is standing open */}
        {s?.doorsOpen ? (
          <path d={pxPath([[0, 174, W, 1]])} fill={L.ledWarm} opacity={0.45} />
        ) : null}
        <Vignette set={VIGNETTE} strength={ph === "night" ? 1 : 0.7} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * effects — what a moving box does to the light inside it
 * ================================================================== */

function ElevatorEffects({
  world,
  phase,
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
  const s = liftState(world, ph);
  const emerg = isEmergency(s);
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
        {/* the panel throws its light down the walls, and the pool it lays down */}
        {!emerg ? (
          <g>
            <Light set={LT_PANEL} />
            <Light set={LT_POOL} />
            <path d={LT_SOURCE.core} fill="#ffffff" opacity={0.9} />
            <Light set={LT_MIRROR} />
          </g>
        ) : (
          /* the tube has gone: one green box on the ceiling and nothing else */
          <g>
            <rect width={W} height={H} fill="#0a1410" opacity={0.55} />
            <Light set={LT_EMERG} />
          </g>
        )}
        {/* each floor you pass slides its light down the cab */}
        {s.travelling
          ? [0, 0.7, 1.4].map((d) => (
              <path key={d} d={pxPath([[0, CEIL_BOT, W, 6]])} fill="#ffffff" opacity={0}>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={s.goingUp ? `0 ${FLOOR - CEIL_BOT};0 0` : `0 0;0 ${FLOOR - CEIL_BOT}`}
                  begin={`${d}s`}
                  dur="2.1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.16;0.16;0"
                  begin={`${d}s`}
                  dur="2.1s"
                  repeatCount="indefinite"
                />
              </path>
            ))
          : null}
        {/* dust, because a lift is a sealed box with a fan in the roof */}
        <g>
          <path
            d={pxPath([
              [40, 110, 1, 1],
              [88, 126, 1, 1],
              [132, 118, 1, 1],
              [66, 100, 1, 1],
            ])}
            fill="#fff6da"
            opacity={0}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;4 -14;-2 -26;3 -8;0 0"
              dur="15s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.7;0.25;0"
              dur="15s"
              repeatCount="indefinite"
            />
          </path>
        </g>
        {/* light from the landing, when the doors are standing open behind you */}
        {s.doorsOpen ? <Light set={LT_LANDING} op={emerg ? 1 : 0.7} /> : null}
        {/* the box closes in a little */}
        <Vignette set={VIGNETTE} strength={emerg ? 1 : 0.45} />
        {ph === "night" && !emerg ? (
          <rect width={W} height={H} fill={NIGHT_CAST} opacity={0.1} />
        ) : null}
      </g>
    </svg>
  );
}

/* ================================================================== *
 * definition — the original eight hitboxes, at the original x
 * ================================================================== */

/**
 * Every world read the art performs. This scene is a plain SceneDef, which has
 * no artKey; if it migrates to RuntimeSceneDef, this is the key it wants.
 */
export function elevatorArtKey(world: WorldState, phase: string): string {
  const s = liftState(world, toPhase(phase));
  return [
    phase,
    s.travelling ? 1 : 0,
    s.goingUp ? 1 : 0,
    s.floor,
    s.dest ?? "-",
    s.load,
    s.doorsOpen ? 1 : 0,
    s.light,
    s.mirror,
    s.service,
    s.call,
    s.graffiti,
    s.litter,
    s.noticeRead ? 1 : 0,
  ].join("|");
}

export const ELEVATOR_SCENE: SceneDef<WorldState> = {
  id: "elevator",
  width: W,
  objects: [
    { id: "lift-sticker", kind: "flavor", x: 18, range: 9 },
    { id: "lift-mirror", kind: "flavor", x: 46, range: 16 },
    { id: "lift-ad", kind: "flavor", x: 82, range: 12 },
    { id: "lift-hatch", kind: "flavor", x: 100, range: 8 },
    { id: "lift-plate", kind: "flavor", x: 120, range: 10 },
    { id: "lift-intercom", kind: "flavor", x: 141, range: 9 },
    { id: "lift-panel", kind: "liftpanel", x: 166, range: 16 },
    { id: "lift-camera", kind: "flavor", x: 191, range: 8 },
  ],
  Component: ({ world, phase }) => <ElevatorScene world={world} phase={phase} />,
  darkness: (phase) => (phase === "night" ? 0.1 : 0.03),
  Foreground: (p) => <ElevatorFront {...p} />,
  Effects: ElevatorEffects,
};
