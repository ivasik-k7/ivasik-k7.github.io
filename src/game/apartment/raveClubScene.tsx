import { useEffect, useState } from "react";
import {
  AOSet,
  aoPaths,
  Bev,
  bevelPaths,
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
  type Ph,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  steppedCone,
  steppedEllipse,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { gamePhase } from "@/lib/body";
import type { WorldState } from "@/lib/worldState";
import { CRATES_PALETTE, cratesMap, DRUM_PALETTE, drumMap, propActor } from "./bandProps";
import { elektrykowState } from "./elektrykowScene";
import { NPCS } from "./npcs";

// --- TURBINA / inside the end bay of hall B ------------------------------------

/**
 * The rave, in the end bay of the club's hall.
 *
 * ==================================================================
 * WHAT THIS PLACE IS. One bay of a shipyard assembly hall, rented by the
 * night: the crane runway is still bolted to the trusses, the brick is still
 * soot-black above four metres, and somebody has hung a light rig where the
 * hook used to travel. Bar by the door, dance floor in the middle, DJ riser
 * against the far bulkhead under an LED wall made of salvaged panels that
 * don't quite match. Everything portable, because in October it all goes back
 * in the container.
 *
 * SCALE. House key, PPM = 38, one axis, same as the street outside: the bar
 * counter is 1.1 m, the riser 0.6 m, a speaker stack 2.2 m — furniture-sized
 * furniture, people-sized people. The hall itself is the exception again: its
 * trusses start at y 0 and the wall goes up out of frame, because that is what
 * a hall does.
 *
 * SIX PLANES:
 *   farBackground — the hall's far wall: black brick, the bricked clerestory,
 *     the LED wall, the crane runway beam with its dead hoist.
 *   middleBackground — the trusses and the rig bolted to them: moving heads,
 *     strobes, the mirror-less rig of a warehouse party; the bar's backwall,
 *     the flyer drift, the fire kit that the licence requires.
 *   ground — concrete with the floor's whole biography: the taped cable runs,
 *     the worn dance patch, spills, glitter that will outlive the building.
 *   staticObjects — the bar counter, sofas, the cable-drum table, speaker
 *     stacks, the DJ riser and booth, the drink crates, the mannequin.
 *   gameplayObjects — the crowd: three ranks of dancers, precomputed rects on
 *     out-of-phase SMIL beats, because forty NpcActors would melt the frame
 *     budget and a crowd reads as shapes anyway.
 *   Effects — everything that moves with the music: the colour washes, the
 *     cones, the strobe, the LED wall's life, the scanline/CRT layer over the
 *     whole picture, and the hallucination system.
 *
 * LIGHTING PREMISE. There is no ambient light in here at all — the room is
 * black and every visible surface is borrowing from a source: the LED wall,
 * four moving-head cones, the bar's backbar amber, two fire-exit greens that
 * never go out, and the strobe. The premise of the whole scene is the beat:
 * discrete SMIL cycles at 126 bpm equivalents, nothing eased, nothing smooth.
 *
 * THE SURREAL LAYER. Two mechanisms, deliberately separated:
 *   1. The permanent presentation: scanlines + a one-pixel RGB split on the
 *      brightest emitters + digital noise on the LED wall. Cheap, constant,
 *      quantised — the room seen through a tired sensor.
 *   2. HALLUCINATIONS: short, rare, timer-driven events (a doppelgänger of
 *      the crowd, a figure in the corridor that is not there on the second
 *      look, the room inverting for three frames, a sign that briefly says
 *      something it shouldn't). Owned by one component, gated on reduced
 *      motion and on dialogue, never two at once, 18–40 s apart. The player
 *      should finish a night here having seen four of them and being sure of
 *      two.
 *
 * STATE. The club borrows the street's clock state (elektrykowState): prep is
 * soundcheck — house lights on, floor empty; open is the night; peak turns
 * the strobe on and fills the last rank of the floor. Closed never renders —
 * the door outside is locked — but if a save lands here at 9 a.m. the scene
 * shows the morning-after: house lights, no crowd, a cleaner.
 * ==================================================================
 */

const W = 1180;
const H = 180;
const FLOOR = 150;
const BAND_BOT = 170;

/** Unit boundaries. */
const Z = {
  door: 40, // back out to the street
  cloak: 118, // the cloakroom window
  bar: 190, // bar counter 190..330
  chill: 380, // sofas 380..470
  floorL: 540, // the dance floor 540..820
  floorR: 820,
  dj: 900, // the riser 850..1000
  corridor: 1060, // to the WCs and the smoking yard
} as const;

/* ================================================================== *
 * palette — a black room and its emitters
 * ================================================================== */

/** The hall in the dark: barely-brick, read by rig light only. */
const DARKBRICK_MAT: Mat = {
  hi: "#3a3038",
  base: "#2e2630",
  mid: "#28212a",
  lo: "#221c24",
  deep: "#16121a",
};
/** The same hall with the house lights on (prep / morning-after). */
const HOUSEBRICK_MAT: Mat = {
  hi: "#7a6a5c",
  base: "#6a5c50",
  mid: "#5f5248",
  lo: "#544840",
  deep: "#3c342e",
};
const STEELDARK_MAT: Mat = {
  hi: "#4e5560",
  base: "#3e444e",
  mid: "#373d46",
  lo: "#2f343c",
  deep: "#21252b",
};
const RISER_MAT: Mat = {
  hi: "#4a4440",
  base: "#3a3532",
  mid: "#332f2c",
  lo: "#2b2825",
  deep: "#1d1b19",
};

const K = {
  neon: "#e858a8",
  neonDeep: "#a03a78",
  cyan: "#5ad8d8",
  cyanDeep: "#2a8a92",
  amber: "#ffb03a",
  bulb: "#ffca85",
  uv: "#7a5aff",
  uvDeep: "#4a34a8",
  ledGreen: "#7ee08c",
  ledRed: "#ff5050",
  white: "#f2f2ee",
  exitGreen: "#3f9f5c",
  skin: "#a98d78",
  skinDark: "#8a7566",
  hair: "#2b2521",
  crowd1: "#33404e",
  crowd2: "#455568",
  crowd3: "#3e3548",
  floor: "#2a262c",
  floorHouse: "#5d5a55",
  tape: "#d6e23f",
  spill: "#1d1a20",
  glitter: "#c9d2e8",
  ledPanel: "#0d0f14",
  flyer: "#d8cfba",
  flyerPink: "#d86a9a",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

type ClubMode = "house" | "prep" | "on" | "peak";

/** What the room is doing, derived from the street's clock state. */
function clubMode(world: WorldState, ph: Ph): ClubMode {
  const s = elektrykowState(world, ph);
  if (s.club === "peak") return "peak";
  if (s.club === "open") return "on";
  if (s.club === "prep") return "prep";
  return "house";
}

const isLive = (mode: ClubMode) => mode === "on" || mode === "peak";

/** The wall-clock phase, for `when` gates that get the world but not the phase. */

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
 * FAR — the hall's far wall
 * ================================================================== */

const WALL = pxPath([[0, 0, W, FLOOR]]);
/** The bricked clerestory band, high up, and its stone sills. */
const CLERESTORY = pxPath(repeat(7, 160, [40, 14, 96, 24] as Rect));
const CLERESTORY_SILLS = pxPath(repeat(7, 160, [36, 38, 104, 3] as Rect));
const CLERESTORY_INFILL = pxPath(
  Array.from({ length: 7 }, (_, i) => i).flatMap((i) =>
    repeat(6, 15, [46 + i * 160, 16, 1, 20] as Rect),
  ),
);
/** The crane runway: the beam the hook used to travel, and the dead hoist. */
const RUNWAY = pxPath([
  [0, 46, W, 6],
  [0, 52, W, 2],
]);
const HOIST = pxPath([
  [Z.chill + 30, 54, 26, 12],
  [Z.chill + 39, 66, 8, 8],
  [Z.chill + 41, 74, 4, 4],
]);
/** Wall coursing, and the soot line above old machine positions. */
const WALL_COURSES = pxPath(repeat(Math.floor(FLOOR / 12), 12, [0, 6, W, 1] as Rect, "y"));
const SOOT = pxPath([
  [Z.bar - 30, 58, 120, 60],
  [Z.floorL + 60, 62, 180, 56],
]);
/** Wall piers between clerestory bays. */
const WALL_PIERS = pxPath(repeat(8, 160, [20, 0, 12, FLOOR] as Rect));

/**
 * The LED wall behind the DJ: salvaged panels, and one of them is dead, which
 * is the most honest thing a rented LED wall can have. The panel grid is
 * far-plane geometry; the picture on it lives in Effects where it can move.
 */
const LEDW: Rect = [Z.dj - 78, 34, 156, 78];
const LEDW_FRAME = pxPath([
  [LEDW[0] - 4, LEDW[1] - 4, LEDW[2] + 8, 4],
  [LEDW[0] - 4, LEDW[1] + LEDW[3], LEDW[2] + 8, 4],
  [LEDW[0] - 4, LEDW[1] - 4, 4, LEDW[3] + 8],
  [LEDW[0] + LEDW[2], LEDW[1] - 4, 4, LEDW[3] + 8],
]);
const LEDW_PANEL_SEAMS = pxPath([
  ...repeat(3, 39, [LEDW[0] + 39, LEDW[1], 1, LEDW[3]] as Rect),
  ...repeat(2, 26, [LEDW[0], LEDW[1] + 26, LEDW[2], 1] as Rect, "y"),
]);
/** The dead panel: top-right, permanently dark. */
const LEDW_DEAD: Rect = [LEDW[0] + 117, LEDW[1], 39, 26];

/** The fire exit over the corridor mouth and its twin by the entrance. */
const EXIT_SIGNS: Rect[] = [
  [Z.door + 24, 52, 26, 12],
  [Z.corridor - 20, 52, 26, 12],
];

/**
 * The wall's own history, precomputed: the works-green dado every Polish
 * industrial interior wore to shoulder height, chipped back to brick where
 * chairs and decades hit it; the bay's stencilled number; conduit drops with
 * their junction boxes; efflorescence blooming up from the slab; the crane
 * runway's hook block parked at the quiet end with its chain hanging.
 */
const DADO_Y = 96;
const DADO = pxPath([[0, DADO_Y, W, FLOOR - DADO_Y]]);
const DADO_LINE = pxPath([[0, DADO_Y, W, 2]]);
const DADO_CHIPS = pxPath(
  Array.from({ length: 26 }, (_, i) => {
    const x = Math.round(hash(i * 71 + 3) * W);
    const y = DADO_Y + 4 + Math.round(hash(i * 73 + 6) * (FLOOR - DADO_Y - 10));
    return [x, y, 2 + Math.round(hash(i * 5) * 4), 2 + Math.round(hash(i * 7) * 2)] as Rect;
  }),
);
const CONDUIT_X = [150, 470, 860, 1120] as const;
const CONDUITS = pxPath(
  CONDUIT_X.flatMap(
    (x) =>
      [
        [x, 46, 3, FLOOR - 46],
        [x - 2, 88, 7, 8],
      ] as Rect[],
  ),
);
const EFFLOR = pxPath(
  Array.from({ length: 9 }, (_, i) => {
    const x = Math.round(hash(i * 83 + 4) * W);
    return [
      x,
      FLOOR - 8 - Math.round(hash(i * 89) * 6),
      10 + Math.round(hash(i * 11) * 14),
      3,
    ] as Rect;
  }),
);
const HOOK_BLOCK = pxPath([
  [1116, 54, 12, 9],
  [1120, 63, 4, 6],
  [1121, 69, 2, 3],
  /* the chain, swagged along the runway to the anchorage */
  [1128, 50, 2, 2],
  [1134, 52, 2, 2],
  [1140, 53, 2, 2],
  [1146, 52, 2, 2],
]);
/** One clerestory pane is plywood, not brick — the cheap year's repair. */
const PLY_PANE = pxPath([[40 + 3 * 160 + 24, 16, 30, 20]]);

/* ---- what people have written on the hall ---------------------------------
 * A club wall is a guestbook. The big piece behind the dance floor (fully
 * legible only in house light — the crowd stands in front of it all night);
 * the tag cluster by the corridor; the tally strokes by the bar, counting
 * nobody remembers what; a heart by the sofas; stickers wherever a sticker
 * fits; and the UV piece over the flyers that is nothing by day and the
 * room's second neon under the rig. */

/** The big piece: fat two-tone letterforms with drips, more shape than word. */
const GRAF_FILL = pxPath([
  [598, 104, 26, 30],
  [630, 100, 22, 34],
  [658, 106, 24, 28],
  [688, 102, 22, 32],
]);
const GRAF_HILITE = pxPath([
  [602, 108, 8, 20],
  [636, 104, 7, 24],
  [664, 110, 8, 18],
  [692, 106, 7, 22],
]);
const GRAF_OUTLINE = pxPath([
  [596, 102, 118, 2],
  [596, 134, 30, 2],
  [628, 132, 26, 2],
  [656, 134, 28, 2],
  [686, 132, 26, 2],
]);
const GRAF_DRIPS = pxPath([
  [606, 134, 2, 8],
  [644, 132, 2, 11],
  [672, 134, 2, 6],
  [700, 132, 2, 9],
]);
/** The corridor tags: three hands, three heights, one argument. */
const TAGS = pxPath([
  [1044, 106, 14, 2],
  [1050, 104, 2, 8],
  [1058, 110, 12, 2],
  [1062, 106, 2, 10],
  [1046, 120, 20, 2],
  [1052, 118, 2, 6],
]);
/** KASIA ♥ by the sofas — the plus-glyph heart the font already knows. */
const HEART_Y = 100;
/** Tally strokes by the bar's end: ||||  ||||  ||| — of what, nobody says. */
const TALLIES = pxPath([
  ...repeat(4, 4, [338, 106, 2, 10] as Rect),
  [336, 110, 18, 2],
  ...repeat(4, 4, [360, 106, 2, 10] as Rect),
  [358, 110, 18, 2],
  ...repeat(3, 4, [382, 106, 2, 10] as Rect),
]);
/** The UV piece over the flyers: invisible paint until the rig finds it. */
const UV_PIECE = pxPath([
  [392, 52, 18, 10],
  [414, 48, 14, 14],
  [432, 54, 16, 8],
  [452, 50, 12, 12],
  /* the drips it was signed with */
  [398, 62, 2, 5],
  [438, 62, 2, 4],
]);

function FarWall({ mode }: { mode: ClubMode }) {
  const live = isLive(mode);
  const brick = live ? DARKBRICK_MAT : HOUSEBRICK_MAT;
  return (
    <g>
      <SharedDefs />
      <path d={WALL} fill={brick.base} />
      <path d={WALL} fill="url(#px-stucco)" />
      <path d={WALL_COURSES} fill={brick.deep} opacity={0.35} />
      <path d={WALL_PIERS} fill={brick.mid} />
      {/* the dado: works green to shoulder height, chipped back to brick */}
      <path d={DADO} fill={live ? "#20302c" : "#44584e"} opacity={0.85} />
      <path d={DADO} fill="url(#px-roller)" />
      <path d={DADO_LINE} fill={live ? "#2c403a" : "#5a7064"} />
      <path d={DADO_CHIPS} fill={brick.base} />
      <path d={EFFLOR} fill={live ? "#3e3a42" : "#8d897e"} opacity={0.6} />
      <path d={SOOT} fill={dth("n", "25")} opacity={live ? 0.4 : 0.6} />
      {/* the bay's number, stencilled before anyone here was born */}
      <BigText x={560} y={66} text="B-2" k={3} fill={live ? "#3a3440" : "#8d897e"} op={0.5} />
      {/* the guestbook: the big piece, the tags, the tallies, the heart */}
      <path d={GRAF_OUTLINE} fill={live ? "#15121a" : "#26222c"} />
      <path d={GRAF_FILL} fill={K.neonDeep} opacity={live ? 0.55 : 0.8} />
      <path d={GRAF_HILITE} fill={K.cyan} opacity={live ? 0.4 : 0.65} />
      <path d={GRAF_DRIPS} fill={K.neonDeep} opacity={live ? 0.45 : 0.7} />
      <path d={TAGS} fill={live ? "#3e3a46" : "#d8cfba"} opacity={0.7} />
      <path d={TALLIES} fill={live ? "#3e3a46" : "#e8e2d2"} opacity={0.6} />
      <BigText
        x={352}
        y={HEART_Y - 8}
        text="KASIA + ?"
        k={1}
        fill={live ? "#4a3a46" : "#d86a9a"}
        op={0.75}
      />
      {/* the UV piece: a ghost of itself until the rig lights it (Effects) */}
      <path d={UV_PIECE} fill={live ? "#2c2836" : "#84807a"} opacity={live ? 0.5 : 0.3} />
      <path d={CONDUITS} fill={live ? "#242028" : "#57534a"} />
      <path d={CLERESTORY} fill={brick.lo} />
      <path d={CLERESTORY_INFILL} fill={brick.deep} opacity={0.5} />
      <path d={PLY_PANE} fill={live ? "#3a3228" : "#7d5836"} />
      <path d={CLERESTORY_SILLS} fill={brick.hi} opacity={0.7} />
      <path d={RUNWAY} fill={STEELDARK_MAT.base} />
      <path d={pxPath([[0, 46, W, 1]])} fill={STEELDARK_MAT.hi} opacity={0.6} />
      <path d={HOIST} fill={STEELDARK_MAT.lo} />
      <path d={HOOK_BLOCK} fill={STEELDARK_MAT.lo} />
      {/* the LED wall's carcass; its picture is painted in Effects */}
      <path d={LEDW_FRAME} fill="#101216" />
      <path d={pxPath([LEDW])} fill={K.ledPanel} />
      <path d={LEDW_PANEL_SEAMS} fill="#000" opacity={0.6} />
      {/* fire exits: the two lights that never move and never go out */}
      {EXIT_SIGNS.map((r) => (
        <g key={r[0]}>
          <path d={pxPath([r])} fill="#0d1a12" />
          <BigText x={r[0] + 3} y={r[1] + 3} text="WYJSCIE" k={1} fill={K.exitGreen} op={0.95} />
        </g>
      ))}
    </g>
  );
}

/* ================================================================== *
 * MID — trusses, the rig, the bar's backwall, the licence furniture
 * ================================================================== */

/** The roof trusses: three chords and the diagonals, the top 30 px of frame. */
const TRUSS = pxPath([
  [0, 0, W, 4],
  [0, 26, W, 3],
  ...repeat(Math.ceil(W / 60), 60, [10, 4, 3, 22] as Rect),
  ...repeat(Math.ceil(W / 60), 60, [40, 4, 2, 22] as Rect),
]);
/** The rig: a scaffold bar slung under the trusses over the floor. */
const RIG_BAR = pxPath([[Z.floorL - 40, 34, Z.floorR - Z.floorL + 80, 4]]);
const RIG_CLAMPS = pxPath(repeat(5, 80, [Z.floorL - 30, 30, 4, 4] as Rect));
/** Four moving heads and two strobe cans hung off it. */
const HEAD_X = [Z.floorL + 10, Z.floorL + 110, Z.floorR - 110, Z.floorR - 10] as const;
const HEADS = pxPath(
  HEAD_X.flatMap(
    (x) =>
      [
        [x - 4, 38, 8, 5],
        [x - 6, 43, 12, 9],
        [x - 3, 52, 6, 3],
      ] as Rect[],
  ),
);
const STROBE_X = [Z.floorL + 60, Z.floorR - 60] as const;
const STROBES = pxPath(
  STROBE_X.flatMap(
    (x) =>
      [
        [x - 8, 38, 16, 7],
        [x - 6, 45, 12, 2],
      ] as Rect[],
  ),
);
/** Cable looms taped along the truss down to the riser. */
const LOOMS = pxPath([
  [Z.floorL - 40, 30, 4, 4],
  [Z.floorR + 40, 38, Z.dj - Z.floorR - 40, 3],
  [Z.dj, 41, 3, 60],
]);

/* ---- the entrance end ------------------------------------------------------ */

/** The door back out: steel, push bar, the porthole pair from the other side. */
const DOOR_IN: Rect = [Z.door - 30, 70, 60, FLOOR - 70];
const DOOR_IN_SET = bevelPaths([DOOR_IN]);
const DOOR_IN_BAR = pxPath([[Z.door - 22, 112, 44, 4]]);
const DOOR_IN_GLASS = pxPath([
  [Z.door - 16, 86, 10, 10],
  [Z.door + 6, 86, 10, 10],
]);
/** The cloakroom: a hatch in a stud wall, numbered hooks behind. */
const CLOAK_WALL = pxPath([[Z.cloak - 34, 56, 68, FLOOR - 56]]);
const CLOAK_HATCH: Rect = [Z.cloak - 22, 78, 44, 30];
const CLOAK_RAIL = pxPath([[CLOAK_HATCH[0] + 3, CLOAK_HATCH[1] + 6, CLOAK_HATCH[2] - 6, 2]]);
const CLOAK_COATS = pxPath([
  [CLOAK_HATCH[0] + 5, CLOAK_HATCH[1] + 8, 6, 16],
  [CLOAK_HATCH[0] + 14, CLOAK_HATCH[1] + 8, 5, 14],
  [CLOAK_HATCH[0] + 24, CLOAK_HATCH[1] + 8, 6, 15],
  [CLOAK_HATCH[0] + 33, CLOAK_HATCH[1] + 8, 5, 12],
]);
const CLOAK_COUNTER = pxPath([
  [CLOAK_HATCH[0] - 3, CLOAK_HATCH[1] + CLOAK_HATCH[3], CLOAK_HATCH[2] + 6, 4],
]);
const CLOAK_SIGN: Rect = [Z.cloak - 20, 62, 40, 10];
/** The UV stamp lamp on the counter — the little violet theatre of entry. */
const UV_LAMP = pxPath([
  [Z.cloak + 26, CLOAK_HATCH[1] + CLOAK_HATCH[3] - 8, 10, 8],
  [Z.cloak + 28, CLOAK_HATCH[1] + CLOAK_HATCH[3] - 10, 6, 2],
]);
/** Earplug dispenser screwed to the cloak wall. The licence's best idea. */
const PLUGS: Rect = [Z.cloak - 30, 112, 12, 18];

/* ---- the bar ----------------------------------------------------------------- */

const BAR: Rect = [Z.bar, FLOOR - 42, 140, 42];
const BAR_SET = bevelPaths([BAR]);
const BAR_TOP = pxPath([[BAR[0] - 3, BAR[1] - 3, BAR[2] + 6, 5]]);
const BAR_FRONT_RIBS = pxPath(repeat(9, 15, [BAR[0] + 6, BAR[1] + 6, 3, BAR[3] - 12] as Rect));
/** The backbar against the wall: shelves, bottles, the fridge's cold square. */
const BACKBAR = pxPath([[Z.bar + 4, 62, 132, 40]]);
const BACKBAR_SHELVES = pxPath([
  [Z.bar + 8, 72, 124, 2],
  [Z.bar + 8, 88, 124, 2],
]);
const BACKBAR_BOTTLES = pxPath([
  ...repeat(12, 10, [Z.bar + 12, 62, 4, 10] as Rect),
  ...repeat(11, 11, [Z.bar + 14, 78, 4, 10] as Rect),
]);
const BAR_FRIDGE: Rect = [Z.bar + 100, FLOOR - 40, 34, 36];
const BAR_FRIDGE_GLASS = pxPath([
  [BAR_FRIDGE[0] + 4, BAR_FRIDGE[1] + 4, BAR_FRIDGE[2] - 8, BAR_FRIDGE[3] - 10],
]);
/** On the counter: the till's glow, a tip jar, a tower of cups. */
const BAR_TILL = pxPath([[Z.bar + 14, BAR[1] - 12, 14, 9]]);
const BAR_JAR = pxPath([[Z.bar + 36, BAR[1] - 8, 7, 6]]);
const BAR_CUPS = pxPath([
  [Z.bar + 116, BAR[1] - 10, 7, 8],
  [Z.bar + 124, BAR[1] - 7, 6, 5],
]);
/** The price board over the backbar, chalk. */
const BAR_BOARD: Rect = [Z.bar + 30, 40, 76, 18];

/* ---- the chill corner ---------------------------------------------------------- */

/** Two sofas that were curbside finds, and the cable-drum table. */
const SOFA_A: Rect = [Z.chill - 10, FLOOR - 30, 52, 30];
const SOFA_B: Rect = [Z.chill + 74, FLOOR - 28, 48, 28];
const SOFAS = bevelPaths([SOFA_A, SOFA_B]);
const SOFA_BACKS = pxPath([
  [SOFA_A[0], SOFA_A[1] - 12, SOFA_A[2], 14],
  [SOFA_B[0], SOFA_B[1] - 10, SOFA_B[2], 12],
]);
const SOFA_ARMS = pxPath([
  [SOFA_A[0] - 4, SOFA_A[1] - 6, 6, SOFA_A[3] + 6],
  [SOFA_A[0] + SOFA_A[2] - 2, SOFA_A[1] - 6, 6, SOFA_A[3] + 6],
  [SOFA_B[0] - 4, SOFA_B[1] - 5, 5, SOFA_B[3] + 5],
]);
const SOFA_SAG = pxPath([
  [SOFA_A[0] + 14, SOFA_A[1] + 2, 22, 3],
  [SOFA_B[0] + 12, SOFA_B[1] + 2, 20, 3],
]);
/**
 * The band furniture is depth-sorted prop actors (bandProps.ts), same pattern
 * as the street: the drum table in the chill corner and the crate stack by
 * the corridor. Their footprints live in `ground.blockers`, their shadows in
 * the art planes below.
 */
const CLUB_PROPS = {
  drum: { x: Z.chill + 53, y: 158 },
  crates: { x: Z.corridor - 52, y: 160 },
} as const;
/**
 * The mannequin, by the corridor mouth where the light barely reaches — a
 * hi-vis and a traffic cone on a dressmaker's pole. Nobody knows whose it is.
 * It has been here longer than the club has. Some nights people swear it has
 * moved, and the hallucination system agrees with them.
 */
const MQ_X = Z.corridor - 86;
const MANNEQUIN = pxPath([
  [MQ_X, FLOOR - 64, 10, 34], // torso
  [MQ_X + 2, FLOOR - 72, 6, 8], // head
  [MQ_X - 2, FLOOR - 84, 14, 12], // the cone
  [MQ_X + 3, FLOOR - 30, 3, 30], // the pole it stands on
  [MQ_X - 2, FLOOR - 2, 14, 2], // the base
]);
const MANNEQUIN_VEST = pxPath([[MQ_X, FLOOR - 62, 10, 18]]);
/** The flyer drift on the wall above the sofas: a decade of line-ups. */
const FLYERS = pxPath([
  [Z.chill - 8, 70, 18, 24],
  [Z.chill + 16, 66, 16, 22],
  [Z.chill + 38, 72, 18, 24],
  [Z.chill + 62, 68, 16, 20],
  [Z.chill + 86, 74, 18, 22],
  [Z.chill + 12, 96, 16, 20],
  [Z.chill + 56, 98, 18, 22],
]);
const FLYERS_PINK = pxPath([
  [Z.chill + 16, 66, 16, 8],
  [Z.chill + 86, 74, 18, 8],
  [Z.chill + 56, 98, 18, 7],
]);

/* ---- the dance floor edges ------------------------------------------------------ */

/** Speaker stacks flanking the floor: sub, mid, horn — 2.4 m of intent. */
function speakerStack(x: number): Rect[] {
  return [
    [x, FLOOR - 40, 44, 40], // the sub
    [x + 3, FLOOR - 72, 38, 32], // the mid
    [x + 8, FLOOR - 92, 28, 20], // the horn
  ];
}
const STACK_L = speakerStack(Z.floorL - 58);
const STACK_R = speakerStack(Z.floorR + 14);
const STACKS = bevelPaths([...STACK_L, ...STACK_R]);
/** Stickers: on the stacks, the fusebox, the runway column — sticker logic. */
const STICKERS: [Rect, string][] = [
  [[STACK_L[1][0] + 4, STACK_L[1][1] + 6, 5, 5], K.neon],
  [[STACK_L[0][0] + 30, STACK_L[0][1] + 8, 4, 4], K.cyan],
  [[STACK_R[1][0] + 26, STACK_R[1][1] + 10, 5, 4], K.amber],
  [[STACK_R[0][0] + 6, STACK_R[0][1] + 6, 4, 5], K.uv],
  /* the fusebox one lives at its coordinates directly — FUSEBOX is declared later */
  [[Z.corridor + 68, 106, 6, 5], K.neon],
  [[152, 100, 5, 5], K.cyan],
];

const STACK_CONES = pxPath(
  [STACK_L, STACK_R].flatMap(
    (st) =>
      [
        [st[0][0] + 12, st[0][1] + 10, 20, 20],
        [st[1][0] + 11, st[1][1] + 8, 16, 16],
        [st[2][0] + 8, st[2][1] + 6, 12, 8],
      ] as Rect[],
  ),
);
const STACK_CONE_HOLES = pxPath(
  [STACK_L, STACK_R].flatMap(
    (st) =>
      [
        [st[0][0] + 18, st[0][1] + 16, 8, 8],
        [st[1][0] + 16, st[1][1] + 13, 6, 6],
      ] as Rect[],
  ),
);

/* ---- the DJ riser ----------------------------------------------------------------- */

const RISER: Rect = [Z.dj - 66, FLOOR - 24, 132, 24];
const RISER_SET = bevelPaths([RISER]);
const RISER_SKIRT = pxPath(repeat(10, 13, [RISER[0] + 5, RISER[1] + 4, 3, RISER[3] - 8] as Rect));
/** The booth on it: a table of decks reading as silhouette + lit edges. */
const BOOTH: Rect = [Z.dj - 54, FLOOR - 58, 108, 34];
const BOOTH_SET = bevelPaths([BOOTH]);
const DECKS = pxPath([
  [Z.dj - 44, BOOTH[1] - 6, 24, 8], // left player
  [Z.dj + 20, BOOTH[1] - 6, 24, 8], // right player
  [Z.dj - 12, BOOTH[1] - 8, 24, 10], // the mixer, raised
]);
const DECK_JOGS = pxPath([
  [Z.dj - 38, BOOTH[1] - 4, 10, 4],
  [Z.dj + 26, BOOTH[1] - 4, 10, 4],
]);
const MIXER_LEDS = pxPath(repeat(5, 4, [Z.dj - 8, BOOTH[1] - 6, 2, 5] as Rect));
/** The monitor wedge beside the booth and the cable snake off the riser. */
const MONITOR = pxPath([
  [Z.dj + 46, RISER[1] - 12, 18, 12],
  [Z.dj + 48, RISER[1] - 14, 14, 2],
]);
const SNAKE = pxPath([
  [Z.dj - 70, FLOOR + 6, 40, 2],
  [Z.dj - 96, FLOOR + 10, 40, 2],
]);
/** REQUESTY: NIE — taped to the booth's face, in the band's eyeline. */
const NO_REQUESTS: Rect = [Z.dj - 26, BOOTH[1] + 8, 52, 12];

/* ---- the corridor end ---------------------------------------------------------------- */

/** The corridor mouth: a black opening with the WC sign and the yard door. */
const CORRIDOR = pxPath([[Z.corridor - 24, 64, 68, FLOOR - 64]]);
const CORRIDOR_FRAME = pxPath([
  [Z.corridor - 28, 60, 76, 4],
  [Z.corridor - 28, 64, 4, FLOOR - 64],
  [Z.corridor + 44, 64, 4, FLOOR - 64],
]);
const WC_SIGN: Rect = [Z.corridor - 18, 70, 22, 10];
/** The yard door inside the corridor's right wall, half-lit. */
const YARD_DOOR = pxPath([[Z.corridor + 14, 78, 26, FLOOR - 78]]);
/** The fuse cabinet by the corridor — the room's oldest resident. */
const FUSEBOX: Rect = [Z.corridor + 52, 84, 26, 36];
const FUSEBOX_SET = bevelPaths([FUSEBOX]);
const FUSEBOX_LABEL = pxPath([[FUSEBOX[0] + 4, FUSEBOX[1] + 4, 18, 6]]);

/* ---- contacts / AO ---------------------------------------------------------------------- */

const CONTACTS = contactPaths([
  [BAR[0], BAR[2], FLOOR] as const,
  [SOFA_A[0] - 4, SOFA_A[2] + 10, FLOOR] as const,
  [SOFA_B[0] - 4, SOFA_B[2] + 6, FLOOR] as const,
  [STACK_L[0][0], 44, FLOOR] as const,
  [STACK_R[0][0], 44, FLOOR] as const,
  [RISER[0], RISER[2], FLOOR] as const,
  [Z.corridor - 68, 56, FLOOR] as const,
]);
const RUNWAY_AO = aoPaths([[0, 54, W] as const]);

/* ================================================================== *
 * GROUND — the floor's biography
 * ================================================================== */

const FLOOR_BAND = pxPath([[0, FLOOR, W, H - FLOOR]]);
const FLOOR_JOINTS = pxPath(repeat(Math.ceil(W / 86), 86, [20, FLOOR, 1, H - FLOOR] as Rect));
/** The dance patch: concrete worn pale where ten thousand feet have been. */
const DANCE_WEAR = pxPath(
  steppedEllipse(Math.round((Z.floorL + Z.floorR) / 2), FLOOR + 14, 170, 13, 2),
);
/** Taped cable runs crossing the floor — gaffer, not paint. */
const TAPE_RUNS = pxPath([
  [Z.floorL - 40, FLOOR + 4, 3, H - FLOOR - 4],
  [Z.floorR + 40, FLOOR + 2, 3, H - FLOOR - 2],
  [Z.dj - 96, FLOOR + 9, 44, 3],
]);
/** Spills, and the glitter that no mop has ever fully beaten. */
const SPILLS = pxPath([
  ...steppedEllipse(Z.bar + 90, FLOOR + 12, 12, 3, 2),
  ...steppedEllipse(Z.chill + 40, FLOOR + 16, 8, 2, 2),
]);
const GLITTER = pxPath(
  Array.from({ length: 26 }, (_, i) => {
    const x = Z.floorL - 30 + Math.round(hash(i * 17) * (Z.floorR - Z.floorL + 60));
    const y = FLOOR + 2 + Math.round(hash(i * 23 + 4) * 18);
    return [x, y, 1, 1] as Rect;
  }),
);
/**
 * The hall's first life, painted on its floor: the beds of the machines that
 * were unbolted in the nineties — outline paint half worn away, the anchor
 * bolts still standing proud. One of them is under the dance floor, which is
 * the best joke in the room and nobody dancing has ever noticed it.
 */
const MACHINE_GHOSTS = pxPath([
  [250, 156, 60, 1],
  [250, 156, 1, 12],
  [309, 156, 1, 12],
  [250, 167, 26, 1],
  [292, 167, 18, 1],
  [700, 158, 80, 1],
  [700, 158, 1, 10],
  [779, 158, 1, 10],
  [700, 167, 34, 1],
  [750, 167, 30, 1],
]);
const ANCHOR_BOLTS = pxPath([
  [256, 160, 2, 2],
  [300, 160, 2, 2],
  [256, 164, 2, 2],
  [300, 164, 2, 2],
  [708, 161, 2, 2],
  [770, 161, 2, 2],
  [708, 165, 2, 2],
  [770, 165, 2, 2],
]);
/** Slab-by-slab variation and the joints that squeezed their tar out. */
const SLAB_DARK = pxPath(
  Array.from({ length: Math.ceil(W / 86) }, (_, i) => i)
    .filter((i) => hash(i * 13 + 6) > 0.6)
    .map((i) => [i * 86 + 21, FLOOR, 85, H - FLOOR] as Rect),
);
const TAR_JOINTS = pxPath(
  Array.from({ length: Math.ceil(W / 86) }, (_, i) => i)
    .filter((i) => hash(i * 19 + 2) > 0.55)
    .map((i) => [i * 86 + 19, FLOOR + Math.round(hash(i * 7) * 10), 3, 12] as Rect),
);
/** Heel scuffs radiating off the dance patch: short dark commas. */
const HEEL_SCUFFS = pxPath(
  Array.from({ length: 22 }, (_, i) => {
    const x = Z.floorL - 20 + Math.round(hash(i * 47 + 8) * (Z.floorR - Z.floorL + 40));
    const y = FLOOR + 3 + Math.round(hash(i * 53 + 2) * 20);
    return [x, y, 2 + Math.round(hash(i * 3) * 2), 1] as Rect;
  }),
);
/** Confetti from some birthday in June. Brooms give up; colours stay. */
const CONFETTI: [Rect, string][] = Array.from({ length: 14 }, (_, i) => {
  const x = Z.floorL - 40 + Math.round(hash(i * 61 + 5) * (Z.floorR - Z.floorL + 80));
  const y = FLOOR + 4 + Math.round(hash(i * 67 + 9) * 18);
  const c = [K.neon, K.cyan, K.uv, K.amber][i % 4];
  return [[x, y, 1, 1] as Rect, c];
});
/** Hazard tape on the floor along the riser's front edge. */
const HAZARD_TAPE = pxPath(
  Array.from({ length: 11 }, (_, i) => [RISER[0] - 2 + i * 13, FLOOR + 1, 7, 2] as Rect),
);
/** The sticky strip in front of the bar — a decade of sugar, faintly shinier. */
const STICKY_SHEEN = pxPath([[Z.bar - 10, 158, 160, H - 158]]);
/** The stacks and the riser stand ON the floor: pooled shadow under each. */
const HEAVY_SHADOWS = pxPath([
  ...steppedEllipse(STACK_L[0][0] + 22, FLOOR + 2, 28, 5, 2),
  ...steppedEllipse(STACK_R[0][0] + 22, FLOOR + 2, 28, 5, 2),
  ...steppedEllipse(Z.dj, FLOOR + 3, 72, 6, 2),
  ...steppedEllipse(BAR[0] + BAR[2] / 2, FLOOR + 2, 76, 5, 2),
]);
/** Cigarette burns by the yard door, gum everywhere feet wait. */
const BURNS = pxPath(
  Array.from({ length: 7 }, (_, i) => {
    const x = Z.corridor + 6 + Math.round(hash(i * 91 + 2) * 34);
    const y = FLOOR + 4 + Math.round(hash(i * 97 + 5) * 14);
    return [x, y, 2, 2] as Rect;
  }),
);
const GUM = pxPath([
  [Z.bar + 34, FLOOR + 9, 2, 2],
  [Z.bar + 96, FLOOR + 17, 2, 1],
  [Z.chill + 22, FLOOR + 13, 2, 2],
  [Z.floorL + 64, FLOOR + 7, 2, 1],
]);
/** The drag scratch from the night they moved the booth in. Still healing. */
const DRAG_SCRATCH = pxPath(
  Array.from(
    { length: 9 },
    (_, i) => [Z.dj - 40 - i * 22, FLOOR + 6 + Math.round(i * 0.7), 16, 1] as Rect,
  ),
);
/** Mop arcs, morning only: the cleaner's geometry, drying in stripes. */
const MOP_ARCS = pxPath([
  ...steppedEllipse(Z.floorL + 40, FLOOR + 12, 30, 6, 2).filter((_, i) => i % 2 === 0),
  ...steppedEllipse(Z.floorL + 110, FLOOR + 14, 34, 7, 2).filter((_, i) => i % 2 === 1),
]);
/** The lost trainer by the sofa — the cleaner's favourite genre of relic. */
const LOST_SHOE = pxPath([
  [Z.chill + 16, 163, 9, 3],
  [Z.chill + 16, 161, 5, 2],
  [Z.chill + 24, 164, 2, 2],
]);
/** The overflow coats on wall hooks the cloakroom pretends not to see. */
const OVERFLOW_COATS = pxPath([
  [Z.cloak + 40, 92, 3, 3],
  [Z.cloak + 38, 95, 8, 22],
  [Z.cloak + 52, 92, 3, 3],
  [Z.cloak + 51, 95, 7, 18],
]);
/** The water pallet behind the bar's end: tomorrow, shrink-wrapped. */
const WATER_PALLET = pxPath([
  [BAR[0] + BAR[2] + 10, FLOOR - 26, 30, 22],
  [BAR[0] + BAR[2] + 8, FLOOR - 5, 34, 5],
  ...repeat(4, 8, [BAR[0] + BAR[2] + 12, FLOOR - 24, 4, 8] as Rect),
]);
/** The cleaner's broom, parked against the corridor frame, mornings only. */
const BROOM = pxPath([
  [Z.corridor - 34, 96, 2, 48],
  [Z.corridor - 38, 144, 10, 6],
]);
/** The CO2 extinguisher by the exit, chained to its bracket. The licence. */
const EXTINGUISHER = pxPath([
  [Z.door + 64, FLOOR - 30, 10, 26],
  [Z.door + 66, FLOOR - 34, 6, 4],
  [Z.door + 70, FLOOR - 38, 3, 5],
  [Z.door + 62, FLOOR - 22, 2, 4],
]);
/** The clock that stopped at 4:23 one legendary morning. Never rewound. */
const CLOCK: Rect = [222, 60, 16, 16];
const CLOCK_FACE = pxPath([[CLOCK[0] + 2, CLOCK[1] + 2, 12, 12]]);
const CLOCK_HANDS = pxPath([
  [CLOCK[0] + 7, CLOCK[1] + 4, 2, 5],
  [CLOCK[0] + 9, CLOCK[1] + 8, 4, 2],
]);
/** Two cable loops slung off the truss — slack the rig keeps for itself. */
const CABLE_LOOPS = pxPath([
  ...Array.from({ length: 9 }, (_, i) => {
    const t = (i - 4) / 4;
    return [656 + i * 4, 30 + Math.round(10 * (1 - t * t)), 3, 2] as Rect;
  }),
  ...Array.from({ length: 7 }, (_, i) => {
    const t = (i - 3) / 3;
    return [806 + i * 4, 30 + Math.round(7 * (1 - t * t)), 3, 2] as Rect;
  }),
]);
/** The wall fan over the backbar: two frames of blade, one of sincerity. */
const FAN_HOUSING = pxPath([...steppedEllipse(Z.bar + 116, 52, 8, 7, 2), [Z.bar + 113, 60, 6, 4]]);
const FAN_BLADES_A = pxPath([
  [Z.bar + 112, 50, 9, 2],
  [Z.bar + 115, 47, 2, 8],
]);
const FAN_BLADES_B = pxPath([
  [Z.bar + 112, 48, 3, 2],
  [Z.bar + 118, 48, 3, 2],
  [Z.bar + 112, 54, 3, 2],
  [Z.bar + 118, 54, 3, 2],
]);
/** The booth's little brass lamp — the one warm thing in the rig's world. */
const BOOTH_LAMP = pxPath([
  [Z.dj + 34, BOOTH[1] - 12, 6, 3],
  [Z.dj + 36, BOOTH[1] - 9, 2, 5],
]);

function Ground({ mode }: { mode: ClubMode }) {
  const live = isLive(mode);
  return (
    <g>
      <path d={FLOOR_BAND} fill={live ? K.floor : K.floorHouse} />
      <path d={FLOOR_BAND} fill={dth("n", "12")} opacity={0.3} />
      <path d={FLOOR_BAND} fill="url(#px-agg)" opacity={live ? 0.4 : 0.8} />
      <path d={SLAB_DARK} fill="#000" opacity={live ? 0.1 : 0.07} />
      <path d={FLOOR_JOINTS} fill="#000" opacity={0.2} />
      <path d={TAR_JOINTS} fill="#0d0b08" opacity={0.6} />
      {/* the machine beds under everything — clearest with the house lights on */}
      <path d={MACHINE_GHOSTS} fill={K.tape} opacity={live ? 0.1 : 0.3} />
      <path d={ANCHOR_BOLTS} fill={live ? "#4a4440" : "#6d6a64"} />
      <path d={DANCE_WEAR} fill={live ? "#38333c" : "#6d6a64"} opacity={0.8} />
      <path d={HEEL_SCUFFS} fill="#000" opacity={live ? 0.25 : 0.35} />
      <path d={HEAVY_SHADOWS} fill="#000" opacity={live ? 0.3 : 0.18} />
      <path d={TAPE_RUNS} fill={K.tape} opacity={live ? 0.4 : 0.7} />
      <path d={HAZARD_TAPE} fill={K.tape} opacity={live ? 0.5 : 0.8} />
      <path d={STICKY_SHEEN} fill="#171009" opacity={live ? 0.14 : 0.08} />
      <path d={SPILLS} fill={K.spill} opacity={0.8} />
      <path d={BURNS} fill="#0d0b08" opacity={0.7} />
      <path d={GUM} fill="#0d0b08" opacity={0.55} />
      <path d={DRAG_SCRATCH} fill={live ? "#45404a" : "#7d7a72"} opacity={0.6} />
      {!live ? <path d={MOP_ARCS} fill="#8d8a80" opacity={0.35} /> : null}
      <path d={GLITTER} fill={K.glitter} opacity={live ? 0.5 : 0.25} />
      {CONFETTI.map(([r, c]) => (
        <path key={`${r[0]}-${r[1]}`} d={pxPath([r])} fill={c} opacity={live ? 0.5 : 0.35} />
      ))}
      <path d={pxPath([[0, H - 4, W, 4]])} fill="#000" opacity={0.3} />
    </g>
  );
}

/* ================================================================== *
 * the crowd — three ranks of dancers as precomputed rects
 * ================================================================== */

/**
 * Dancers, the way the train drew passengers: seeded rect figures, but alive.
 * Three ranks across the floor; each rank is ONE animated group on a discrete
 * two-frame bounce, and the three ranks run at 0.92 s, 0.96 s and 1.04 s — the
 * crowd never locks step, which is the difference between a rave and a chorus
 * line. Arms go up on the third rank only; a whole floor with its arms up is
 * a finale, not a Tuesday.
 */
type Rank = { bodies: Rect[]; heads: Rect[]; hair: Rect[]; arms: Rect[]; glow: Rect[] };

function rank(seed: number, y: number, n: number, x0: number, x1: number, arms: boolean): Rank {
  const r: Rank = { bodies: [], heads: [], hair: [], arms: [], glow: [] };
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = Math.round(x0 + t * (x1 - x0) + (hash(seed + i * 7) - 0.5) * 22);
    const top = y - 60 + Math.round(hash(seed + i * 13) * 4);
    r.heads.push([x - 4, top, 8, 8]);
    r.hair.push([x - 5, top - 1, 10, 3]);
    r.bodies.push([x - 7, top + 8, 14, 26]);
    r.bodies.push([x - 5, top + 34, 4, y - top - 34], [x + 1, top + 34, 4, y - top - 34]);
    if (arms && hash(seed + i * 29) > 0.4) {
      const lean = hash(seed + i * 31) > 0.5 ? 1 : -1;
      r.arms.push([x + lean * 8, top + 2, 3, 10], [x + lean * 10, top - 2, 3, 6]);
    } else {
      r.arms.push([x - 9, top + 12, 3, 10], [x + 6, top + 12, 3, 10]);
    }
    if (hash(seed + i * 37) > 0.72) r.glow.push([x + 3, top + 14, 3, 3]);
  }
  return r;
}

const RANKS = [
  { r: rank(11, 150, 7, Z.floorL + 8, Z.floorR - 8, false), dur: "0.96s", body: K.crowd3, dy: 2 },
  { r: rank(23, 158, 8, Z.floorL - 6, Z.floorR + 6, false), dur: "1.04s", body: K.crowd1, dy: 2 },
  { r: rank(37, 166, 6, Z.floorL + 20, Z.floorR - 20, true), dur: "0.92s", body: K.crowd2, dy: 3 },
] as const;

const RANK_PATHS = RANKS.map(({ r }) => ({
  bodies: pxPath(r.bodies),
  heads: pxPath(r.heads),
  hair: pxPath(r.hair),
  arms: pxPath(r.arms),
  glow: pxPath(r.glow),
}));

/** How many ranks are on the floor per mode. */
function ranksFor(mode: ClubMode): number {
  if (mode === "peak") return 3;
  if (mode === "on") return 2;
  return 0;
}

function Crowd({ mode }: { mode: ClubMode }) {
  const n = ranksFor(mode);
  if (n === 0) return null;
  return (
    <g>
      {RANK_PATHS.slice(0, n).map((p, i) => {
        const spec = RANKS[i];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed rank list
          <g key={i}>
            <animateTransform
              attributeName="transform"
              type="translate"
              calcMode="discrete"
              values={`0 0;0 ${-spec.dy};0 0;0 ${-spec.dy}`}
              dur={spec.dur}
              repeatCount="indefinite"
            />
            <path d={p.bodies} fill={spec.body} />
            <path d={p.arms} fill={spec.body} />
            <path d={p.heads} fill={K.skinDark} />
            <path d={p.hair} fill={K.hair} />
            <path d={p.glow} fill={K.amber} opacity={0.8} />
          </g>
        );
      })}
    </g>
  );
}

/* ================================================================== *
 * MID + STATIC plane components
 * ================================================================== */

function Rig({ mode }: { mode: ClubMode }) {
  const live = isLive(mode);
  const brick = live ? DARKBRICK_MAT : HOUSEBRICK_MAT;
  return (
    <g>
      <path d={TRUSS} fill={STEELDARK_MAT.lo} />
      <path d={RIG_BAR} fill={STEELDARK_MAT.base} />
      <path d={RIG_CLAMPS} fill={STEELDARK_MAT.hi} opacity={0.7} />
      <path d={HEADS} fill={STEELDARK_MAT.deep} />
      <path d={STROBES} fill={STEELDARK_MAT.mid} />
      <path d={LOOMS} fill="#15171b" />
      <AOSet set={RUNWAY_AO} op={0.3} />

      {/* the entrance end */}
      <path d={CLOAK_WALL} fill={brick.mid} />
      <path d={pxPath([CLOAK_HATCH])} fill="#181420" />
      <path d={CLOAK_RAIL} fill={STEELDARK_MAT.hi} />
      <path d={CLOAK_COATS} fill="#3e3548" />
      <path d={CLOAK_COUNTER} fill={M.wood.base} />
      <path d={pxPath([CLOAK_SIGN])} fill="#17191d" />
      <BigText
        x={CLOAK_SIGN[0] + 4}
        y={CLOAK_SIGN[1] + 3}
        text="SZATNIA"
        k={1}
        fill={K.cyan}
        op={0.9}
      />
      <path d={UV_LAMP} fill={K.uvDeep} />
      <path d={pxPath([PLUGS])} fill={M.enamel.base} />
      <path d={pxPath([[PLUGS[0] + 3, PLUGS[1] + 4, 6, 3]])} fill={M.enamel.deep} />
      <Bev set={DOOR_IN_SET} mat={M.graphite} />
      <path d={DOOR_IN_BAR} fill={STEELDARK_MAT.hi} />
      <path d={DOOR_IN_GLASS} fill="#3a3244" />

      {/* the bar's backwall */}
      <path d={BACKBAR} fill={brick.lo} />
      <path d={BACKBAR_SHELVES} fill={M.wood.mid} />
      <path d={BACKBAR_BOTTLES} fill={live ? K.amber : "#8a7448"} opacity={live ? 0.9 : 0.7} />
      <path d={pxPath([BAR_BOARD])} fill="#17191d" />
      <path
        d={pxPath([
          [BAR_BOARD[0] + 5, BAR_BOARD[1] + 4, 28, 2],
          [BAR_BOARD[0] + 5, BAR_BOARD[1] + 9, 34, 2],
          [BAR_BOARD[0] + 5, BAR_BOARD[1] + 14, 24, 2],
          [BAR_BOARD[0] + 48, BAR_BOARD[1] + 4, 16, 2],
          [BAR_BOARD[0] + 48, BAR_BOARD[1] + 9, 12, 2],
        ])}
        fill={K.white}
        opacity={0.55}
      />

      {/* the flyer wall */}
      <path d={FLYERS} fill={K.flyer} opacity={0.8} />
      <path d={FLYERS_PINK} fill={K.flyerPink} opacity={0.7} />

      {/* the corridor end */}
      <path d={CORRIDOR} fill="#0d0b10" />
      <path d={YARD_DOOR} fill="#1d1a22" />
      <path d={CORRIDOR_FRAME} fill={brick.hi} opacity={0.6} />
      <path d={pxPath([WC_SIGN])} fill="#17191d" />
      <BigText x={WC_SIGN[0] + 4} y={WC_SIGN[1] + 3} text="WC" k={1} fill={K.cyan} op={0.85} />
      <Bev set={FUSEBOX_SET} mat={STEELDARK_MAT} />
      <path d={FUSEBOX_LABEL} fill={M.enamel.base} opacity={0.8} />
    </g>
  );
}

function Furniture({ mode }: { mode: ClubMode }) {
  const live = isLive(mode);
  return (
    <g>
      <Contact set={CONTACTS} op={0.5} />

      {/* the bar */}
      <Bev set={BAR_SET} mat={RISER_MAT} />
      <path d={BAR_FRONT_RIBS} fill={RISER_MAT.deep} opacity={0.6} />
      {/* the counter's open end face — the bar is a box you could walk around */}
      <path d={pxPath([[BAR[0] + BAR[2], BAR[1] + 2, 4, BAR[3] - 2]])} fill={RISER_MAT.deep} />
      <path d={BAR_TOP} fill={M.wood.base} />
      <path d={pxPath([[BAR[0] - 3, BAR[1] - 3, BAR[2] + 6, 1]])} fill={M.wood.hi} />
      <path d={BAR_TILL} fill="#20242c" />
      <path
        d={pxPath([[Z.bar + 16, BAR[1] - 10, 10, 5]])}
        fill={live ? K.cyan : "#4e5860"}
        opacity={0.8}
      />
      <path d={BAR_JAR} fill={K.white} opacity={0.4} />
      <path d={BAR_CUPS} fill={K.white} opacity={0.8} />
      <path d={pxPath([BAR_FRIDGE])} fill={STEELDARK_MAT.base} />
      <path d={BAR_FRIDGE_GLASS} fill={live ? "#b8e6ff" : "#5a6a78"} opacity={live ? 0.5 : 0.4} />

      {/* the chill corner */}
      <Bev set={SOFAS} mat={dim(M.teal, "#101828", live ? 0.45 : 0.1)} />
      <path d={SOFA_BACKS} fill={dim(M.teal, "#101828", live ? 0.5 : 0.15).mid} />
      <path d={SOFA_ARMS} fill={dim(M.teal, "#101828", live ? 0.55 : 0.2).lo} />
      <path d={SOFA_SAG} fill="#000" opacity={0.25} />
      {/* seat top faces: one lit line each, and the sofas gain their depth */}
      <path
        d={pxPath([
          [SOFA_A[0] + 2, SOFA_A[1], SOFA_A[2] - 4, 2],
          [SOFA_B[0] + 2, SOFA_B[1], SOFA_B[2] - 4, 2],
        ])}
        fill={dim(M.teal, "#101828", live ? 0.3 : 0).hi}
        opacity={0.7}
      />
      <path d={MANNEQUIN} fill="#4e4a52" />
      <path d={MANNEQUIN_VEST} fill="#d6e23f" opacity={live ? 0.5 : 0.8} />
      {/* the relics: one trainer, the overflow coats, tomorrow's water */}
      <path d={LOST_SHOE} fill={live ? "#c8c4bc" : "#e8e2d2"} />
      <path d={pxPath([[Z.chill + 17, 164, 7, 1]])} fill="#000" opacity={0.3} />
      <path d={OVERFLOW_COATS} fill={live ? "#33303c" : "#4e4a56"} />
      <path d={WATER_PALLET} fill={live ? "#28303a" : "#3e4a56"} />
      <path
        d={pxPath([[BAR[0] + BAR[2] + 10, FLOOR - 27, 30, 2]])}
        fill={live ? "#3a4650" : "#5a6a78"}
        opacity={0.8}
      />
      {/* the broom holds the morning shift's whole authority */}
      {!live ? <path d={BROOM} fill={M.wood.base} /> : null}
      {/* the licence's furniture, and the room's two clocks: one stopped,
          one spinning */}
      <path d={EXTINGUISHER} fill={live ? "#7d2a26" : "#b03030"} />
      <path d={pxPath([CLOCK])} fill={STEELDARK_MAT.mid} />
      <path d={CLOCK_FACE} fill={live ? "#8d897e" : "#e8e2d2"} opacity={0.8} />
      <path d={CLOCK_HANDS} fill="#17191d" />
      <path d={CABLE_LOOPS} fill="#15171b" />
      <path d={FAN_HOUSING} fill={STEELDARK_MAT.base} />
      {live ? (
        <>
          <path d={FAN_BLADES_A} fill={STEELDARK_MAT.hi}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0;1;0"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </path>
          <path d={FAN_BLADES_B} fill={STEELDARK_MAT.hi} opacity={0}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;1;0;1"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </path>
        </>
      ) : (
        <path d={FAN_BLADES_A} fill={STEELDARK_MAT.hi} />
      )}
      <path d={BOOTH_LAMP} fill="#c9a24b" />

      {/* the stacks — with tops and shaded flanks: boxes, not posters */}
      <Bev set={STACKS} mat={STEELDARK_MAT} />
      <path
        d={pxPath(
          [STACK_L, STACK_R].flatMap((st) =>
            st.map(([x, y, w]) => [x + 1, y - 2, w - 2, 2] as Rect),
          ),
        )}
        fill={STEELDARK_MAT.hi}
        opacity={0.8}
      />
      <path
        d={pxPath(
          [STACK_L, STACK_R].flatMap((st) =>
            st.map(([x, y, w, h]) => [x + w - 3, y, 3, h] as Rect),
          ),
        )}
        fill={STEELDARK_MAT.deep}
        opacity={0.8}
      />
      <path d={STACK_CONES} fill="#15171b" />
      <path d={STACK_CONE_HOLES} fill="#000" />
      {/* sticker logic: wherever a sticker fits, a sticker is */}
      {STICKERS.map(([r, c]) => (
        <path key={`${r[0]}-${r[1]}`} d={pxPath([r])} fill={c} opacity={live ? 0.55 : 0.85} />
      ))}
      {/* the subs breathe when the room is on — one pixel, on the beat */}
      {live ? (
        <g>
          <path
            d={pxPath([
              [STACK_L[0][0] + 18, STACK_L[0][1] + 16, 8, 8],
              [STACK_R[0][0] + 18, STACK_R[0][1] + 16, 8, 8],
            ])}
            fill="#2a2d33"
          >
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.4;1;0.4"
              dur="0.96s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}

      {/* the riser and the booth */}
      <Bev set={RISER_SET} mat={RISER_MAT} />
      <path d={pxPath([[RISER[0] + 1, RISER[1], RISER[2] - 2, 1]])} fill={RISER_MAT.hi} />
      <path d={RISER_SKIRT} fill={RISER_MAT.deep} opacity={0.6} />
      <Bev set={BOOTH_SET} mat={STEELDARK_MAT} />
      <path d={DECKS} fill="#1b1e24" />
      <path d={DECK_JOGS} fill={live ? "#3a4250" : "#2b2e34"} />
      <path d={MIXER_LEDS} fill={live ? K.ledGreen : "#2f3338"} opacity={live ? 0.9 : 1} />
      <path d={MONITOR} fill={STEELDARK_MAT.lo} />
      <path d={SNAKE} fill="#15171b" />
      <path d={pxPath([NO_REQUESTS])} fill={K.flyer} opacity={0.85} />
      <BigText
        x={NO_REQUESTS[0] + 4}
        y={NO_REQUESTS[1] + 3}
        text="REQUESTY: NIE"
        k={1}
        fill="#33302a"
        op={0.9}
      />
    </g>
  );
}

/* ================================================================== *
 * the scene component
 * ================================================================== */

function RaveClubScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const mode = clubMode(world, ph);
  return (
    <LayeredScene
      farBackground={<FarWall mode={mode} />}
      middleBackground={<Rig mode={mode} />}
      ground={<Ground mode={mode} />}
      staticObjects={<Furniture mode={mode} />}
      gameplayObjects={<Crowd mode={mode} />}
      /**
       * No parallax indoors: the "far" wall is ten metres away, and the
       * Effects overlay paints the LED wall's picture and the exit-sign glow
       * at the same coordinates — a far plane that pans differently would
       * slide the picture out of its frame (it did; measured as a 35 px
       * offset at the DJ riser before this was pinned).
       */
      parallax={{ farBackground: 1, middleBackground: 1 }}
    />
  );
}

/* ================================================================== *
 * FOREGROUND — the near side of the room, always in front of everyone
 * ================================================================== */

/**
 * What is between the camera and the player, and the reason the hall reads
 * as a space you are standing IN: the near truss with a par can hung off it,
 * cut by the top of the frame; a scaffold standard at the chill corner's
 * edge; a flightcase parked just out of shot by the entrance; and — when the
 * room is on — the near rank of the crowd, heads and shoulders along the
 * bottom edge, bobbing on their own beats. They sit low (rows 164+), so they
 * only ever cover the ankles of a player who has walked right into them —
 * which is exactly what walking into the front row does.
 */
const NEAR_TRUSS = pxPath([
  [0, 0, W, 5],
  [0, 5, W, 2],
  ...repeat(Math.ceil(W / 90), 90, [30, 7, 3, 5] as Rect),
]);
const NEAR_PAR = pxPath([
  [648, 7, 4, 6],
  [644, 13, 12, 10],
  [646, 23, 8, 3],
]);
const NEAR_PAR_CABLE = pxPath(
  Array.from({ length: 6 }, (_, i) => {
    const t = (i - 2.5) / 2.5;
    return [658 + i * 4, 6 + Math.round(6 * (1 - t * t)), 3, 2] as Rect;
  }),
);
const NEAR_POLE = pxPath([[468, 0, 8, H]]);
const NEAR_POLE_HI = pxPath([[468, 0, 2, H]]);
const NEAR_CASE = pxPath([
  [0, 148, 46, H - 148],
  [0, 146, 46, 3],
  [40, 158, 6, 8],
  [8, 154, 22, 3],
]);
/** The near rank: five silhouettes, three beats, zero synchronisation. */
const NEAR_HEADS: { x: number; w: number; dur: string; d: number }[] = [
  { x: 566, w: 22, dur: "0.92s", d: 3 },
  { x: 612, w: 26, dur: "1.04s", d: 2 },
  { x: 668, w: 24, dur: "0.96s", d: 3 },
  { x: 728, w: 26, dur: "0.92s", d: 2 },
  { x: 784, w: 22, dur: "1.04s", d: 3 },
];
function nearHead(x: number, w: number): string {
  return pxPath([
    [x + Math.round(w / 2) - 6, 164, 12, 8], // the head
    [x, 172, w, H - 172], // the shoulders
    [x + Math.round(w / 2) - 8, 170, 16, 2], // the neck line
  ]);
}

function RaveFront({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const mode = clubMode(world, ph);
  const live = isLive(mode);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <path d={NEAR_TRUSS} fill="#101216" />
      <path d={NEAR_PAR_CABLE} fill="#0b0a10" />
      <path d={NEAR_PAR} fill="#15171b" />
      {/* the par's lens holds the current wash colour, dimly */}
      {live ? (
        <path d={pxPath([[646, 23, 8, 3]])} fill={K.neon} opacity={0.5}>
          <animate
            attributeName="fill"
            calcMode="discrete"
            values={`${K.neon};${K.cyan};${K.uv};${K.amber}`}
            dur="7.6s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      <path d={NEAR_POLE} fill="#0e1014" />
      <path d={NEAR_POLE_HI} fill="#1d2126" />
      <path d={NEAR_CASE} fill="#101216" />
      <path d={pxPath([[0, 146, 46, 1]])} fill="#22262c" />
      {/* the front row, from behind — the classic club shot */}
      {live
        ? NEAR_HEADS.map((h) => (
            <g key={h.x} fill="#0b0a10">
              <path d={nearHead(h.x, h.w)} />
              {/* the wash rims the heads it stands them against */}
              <path d={pxPath([[h.x + Math.round(h.w / 2) - 6, 164, 12, 1]])} fill="#3a2440" />
              <animateTransform
                attributeName="transform"
                type="translate"
                calcMode="discrete"
                values={`0 0;0 ${-h.d};0 0;0 ${-h.d}`}
                dur={h.dur}
                repeatCount="indefinite"
              />
            </g>
          ))
        : null}
    </svg>
  );
}

/* ================================================================== *
 * EFFECTS — the music made visible, and the things that are not there
 * ================================================================== */

/** The light everything else borrows from. Precomputed tiers. */
const WASH_FLOOR = tiers(
  (k) =>
    steppedEllipse(
      Math.round((Z.floorL + Z.floorR) / 2),
      158,
      Math.round(190 * k),
      Math.round(16 * k),
      2,
    ),
  "w",
  1,
);
const CONE_SETS = HEAD_X.map((x, i) =>
  tiers(
    (k) =>
      steppedCone(
        x + (i % 2 === 0 ? -20 : 20),
        54,
        Math.round(4 * k),
        FLOOR + 8,
        Math.round(30 * k),
        6,
      ),
    i % 2 === 0 ? "e" : "c",
    1.1,
  ),
);
const BAR_GLOW = tiers(
  (k) => steppedEllipse(Z.bar + 70, 152, Math.round(80 * k), Math.round(12 * k), 2),
  "w",
  0.9,
);
const UV_GLOW = tiers(
  (k) =>
    steppedEllipse(
      Z.cloak + 30,
      CLOAK_HATCH[1] + CLOAK_HATCH[3],
      Math.round(18 * k),
      Math.round(7 * k),
      2,
    ),
  "c",
  0.7,
);
const EXIT_GLOWS = tiers(
  (k) =>
    EXIT_SIGNS.flatMap((r) =>
      steppedEllipse(r[0] + 13, r[1] + 8, Math.round(16 * k), Math.round(6 * k), 2),
    ),
  "c",
  0.5,
);

/** Scanlines: the whole room through a tired sensor. One pattern, one rect. */
function ScanDefs() {
  return (
    <defs>
      <pattern id="club-scan" width="1" height="3" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="#000" fillOpacity="0.5" />
      </pattern>
      <pattern id="club-noise" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect x="1" y="2" width="1" height="1" fill="#fff" fillOpacity="0.5" />
        <rect x="3" y="0" width="1" height="1" fill="#fff" fillOpacity="0.3" />
      </pattern>
    </defs>
  );
}

/** The LED wall's picture: bars that jump on the beat, plus its dead panel. */
function LedWall({ mode }: { mode: ClubMode }) {
  const live = isLive(mode);
  if (!live) {
    return (
      <path
        d={pxPath([[LEDW[0] + 8, LEDW[1] + LEDW[3] - 14, 40, 8]])}
        fill={K.cyanDeep}
        opacity={0.3}
      />
    );
  }
  const cols = 12;
  const cw = Math.floor(LEDW[2] / cols);
  return (
    <g>
      {Array.from({ length: cols }, (_, i) => {
        const x = LEDW[0] + i * cw + 2;
        const h1 = 10 + Math.round(hash(i * 3) * 50);
        const h2 = 10 + Math.round(hash(i * 7 + 2) * 56);
        const h3 = 10 + Math.round(hash(i * 11 + 5) * 40);
        return (
          <g key={x}>
            <path
              d={pxPath([[x, LEDW[1] + LEDW[3] - h1, cw - 3, h1]])}
              fill={i % 3 === 0 ? K.neon : i % 3 === 1 ? K.cyan : K.uv}
              opacity={0.75}
            >
              <animate
                attributeName="d"
                calcMode="discrete"
                values={[h1, h2, h3, h2]
                  .map((h) => pxPath([[x, LEDW[1] + LEDW[3] - h, cw - 3, h]]))
                  .join(";")}
                dur={`${0.92 + (i % 4) * 0.08}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        );
      })}
      {/* the dead panel stays dead */}
      <path d={pxPath([LEDW_DEAD])} fill={K.ledPanel} />
      <path d={pxPath([LEDW_DEAD])} fill="url(#club-noise)" opacity={0.06} />
      {/* noise over the live picture */}
      <path d={pxPath([LEDW])} fill="url(#club-noise)" opacity={0.12} />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * the hallucination system
 * ------------------------------------------------------------------ */

/**
 * One event at a time, 18–40 s apart, each 0.9–2.4 s long. The room decides;
 * the player just catches it — or doesn't, which is the design. Everything
 * here is built from geometry the scene already owns, recoloured or displaced,
 * because a hallucination that introduces new objects is a cutscene.
 */
type HalluKind = "doppel" | "invert" | "figure" | "mannequin" | "sign" | "afterimage";

const HALLU_KINDS: readonly HalluKind[] = [
  "doppel",
  "invert",
  "figure",
  "mannequin",
  "sign",
  "afterimage",
];

function useHallucinations(active: boolean) {
  const [event, setEvent] = useState<HalluKind | null>(null);
  useEffect(() => {
    if (!active) {
      setEvent(null);
      return;
    }
    let alive = true;
    let timer = 0;
    const schedule = () => {
      const wait = 18000 + Math.random() * 22000;
      timer = window.setTimeout(() => {
        if (!alive) return;
        const kind = HALLU_KINDS[Math.floor(Math.random() * HALLU_KINDS.length)];
        setEvent(kind);
        const hold = kind === "invert" ? 900 : 1400 + Math.random() * 1000;
        timer = window.setTimeout(() => {
          if (!alive) return;
          setEvent(null);
          schedule();
        }, hold);
      }, wait);
    };
    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [active]);
  return event;
}

/** The still figure at the corridor mouth. On the second look: nobody. */
const FIGURE = pxPath([
  [Z.corridor + 2, 92, 8, 8],
  [Z.corridor, 100, 12, 26],
  [Z.corridor + 1, 126, 4, FLOOR - 126],
  [Z.corridor + 7, 126, 4, FLOOR - 126],
]);

function Hallucination({ kind }: { kind: HalluKind }) {
  switch (kind) {
    case "invert":
      /* three frames of the world's negative — the classic camera flash */
      return (
        <rect width={W} height={H} fill="#fff" style={{ mixBlendMode: "difference" }} opacity={0}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;0.9;0;0.9;0"
            dur="0.9s"
            repeatCount="1"
            fill="freeze"
          />
        </rect>
      );
    case "doppel":
      /* the crowd's third rank again, offset, magenta, half there */
      return (
        <g transform="translate(-26 0)" opacity={0.28}>
          <path d={RANK_PATHS[2].bodies} fill={K.neon} />
          <path d={RANK_PATHS[2].heads} fill={K.neon} />
          <animate
            attributeName="opacity"
            values="0;0.28;0.28;0"
            dur="1.6s"
            repeatCount="1"
            fill="freeze"
          />
        </g>
      );
    case "afterimage":
      /* the whole floor drags two ghosts for a second */
      return (
        <g>
          <g transform="translate(-8 0)" opacity={0.18}>
            <path d={RANK_PATHS[1].bodies} fill={K.cyan} />
          </g>
          <g transform="translate(8 0)" opacity={0.18}>
            <path d={RANK_PATHS[1].bodies} fill={K.neon} />
          </g>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="1.8s"
            repeatCount="1"
            fill="freeze"
          />
        </g>
      );
    case "figure":
      return (
        <g>
          <path d={FIGURE} fill="#0d0b10" opacity={0.9} />
          <path
            d={pxPath([
              [Z.corridor + 3, 95, 2, 2],
              [Z.corridor + 8, 95, 2, 2],
            ])}
            fill={K.neon}
            opacity={0.8}
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="2s"
            repeatCount="1"
            fill="freeze"
          />
        </g>
      );
    case "mannequin":
      /* the mannequin is suddenly ten pixels to the left. It has never moved. */
      return (
        <g>
          <path d={MANNEQUIN} fill="#0d0b10" opacity={0.9} transform="translate(-12 0)" />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="1.7s"
            repeatCount="1"
            fill="freeze"
          />
        </g>
      );
    case "sign":
      /* the WC sign has an opinion, briefly */
      return (
        <g>
          <path d={pxPath([WC_SIGN])} fill="#17191d" />
          <BigText
            x={WC_SIGN[0] + 2}
            y={WC_SIGN[1] + 3}
            text="WYJDZ"
            k={1}
            fill={K.neon}
            op={0.95}
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="1.4s"
            repeatCount="1"
            fill="freeze"
          />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */

/** A laser is a stepped diagonal — a stroked line would antialias. */
function beamRects(x0: number, y0: number, dx: number, steps: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < steps; i++) out.push([x0 + i * dx, y0 + i * 3, 2, 3]);
  return out;
}
const BEAMS = [
  pxPath(beamRects(Z.dj - 6, 46, -4, 34)),
  pxPath(beamRects(Z.dj - 14, 46, -6, 30)),
  pxPath(beamRects(Z.dj - 2, 46, -2, 34)),
];
/** Where phones go off in the crowd — two spots, never together. */
const FLASH_SPOTS: [number, number][] = [
  [Z.floorL + 70, 96],
  [Z.floorR - 90, 100],
];

const DJ_LINES = [
  "...",
  "Jeszcze godzina takiego i można iść wyżej.",
  "Nie, nie zagram. Niczego nie zagram.",
] as const;
const TIRED_LINES = [
  "Siedzę. Sekundę siedzę.",
  "Która jest? Nie mów. Nie chcę wiedzieć.",
  "Obcasy były błędem. Wszystko inne nie.",
] as const;
const OLA_LINES = [
  "To nie jest ten sam set co w lipcu.",
  "Słyszysz przejście? No właśnie. W lipcu nie było przejścia.",
  "Kuba. KUBA. Słuchaj basu, nie mnie.",
] as const;
const CALLER_LINES = [
  "ALO? ALO. NIE SŁYSZĘ CIĘ!",
  "JESTEM W TURBINIE! W TUR-BI-NIE!",
  "ODDZWONIĘ JAK BAS SKOŃCZY! ...ON NIE KOŃCZY!",
] as const;
const TECHNIK_LINES = ["Osiem zwojów. Zawsze osiem.", "Kto tak zwinął ten kabel. Kto."] as const;
const CLUB_BARMAN_LINES = [
  "Woda jest darmowa. Kranówa. Bohaterów się nie pyta.",
  "Zamknięte karty od trzeciej. Doświadczenie.",
] as const;

function RaveEffects({
  world,
  phase,
  fx,
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
  const mode = clubMode(world, ph);
  const live = isLive(mode);
  const peak = mode === "peak";
  const still =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const hallu = useHallucinations(live && !dialogueOpen && !still);
  return (
    <>
      {/* the people you can actually talk to */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {/* the DJ, standing ON the riser, cut at the booth's top edge — head
            and shoulders over the decks, which is all a crowd ever sees. He
            soundchecks at prep and plays the night; the morning is not his. */}
        {mode !== "house" ? (
          <NpcActor
            npc={NPCS.didzej}
            objId="dj-booth"
            x={Z.dj}
            y={RISER[1]}
            facing={-1}
            shadow={false}
            cropBelow={BOOTH[1] - 2}
          />
        ) : null}
        {/* the barman, behind the bar */}
        <NpcActor
          npc={NPCS.klubowy}
          objId="club-bar"
          x={Z.bar + 64}
          facing={1}
          shadow={false}
          cropBelow={BAR[1] + 2}
        />
        {/* the tired one on the sofa — she has sat down and that is that */}
        {live ? (
          <NpcActor
            npc={NPCS.zmeczona}
            objId="tired-girl"
            x={Z.chill + 98}
            facing={-1}
            shadow={false}
          />
        ) : null}
        {/* the couple by the bar's end, facing each other across a thesis.
            Both answer to the same object, so both turn when you interrupt. */}
        {live ? (
          <>
            <NpcActor npc={NPCS.ola} objId="club-couple" x={344} facing={1} />
            <NpcActor npc={NPCS.kuba} objId="club-couple" x={372} facing={-1} />
          </>
        ) : null}
        {/* sixth in the WC queue, an authority on the door's physics */}
        {live ? (
          <NpcActor npc={NPCS.wcQueue} objId="wc-queue" x={Z.corridor - 14} facing={1} />
        ) : null}
        {/* by the exit: one finger in one ear, volume doing the rest */}
        {live ? (
          <NpcActor npc={NPCS.klubowyCaller} objId="club-caller" x={Z.door + 42} facing={-1} />
        ) : null}
        {/* mornings belong to the cleaner AND the man coiling the rig's veins */}
        {mode === "house" || mode === "prep" ? (
          <NpcActor npc={NPCS.technik} objId="club-technik" x={Z.dj - 110} facing={1} />
        ) : null}
        {/* the cleaner, morning-after only */}
        {mode === "house" ? (
          <NpcActor npc={NPCS.sprzataczka} objId="club-cleaner" x={Z.floorL + 80} facing={1} />
        ) : null}
      </svg>

      {!dialogueOpen && live ? (
        <Monologue
          x={Z.chill + 98}
          headY={100}
          scale={scale}
          speaker="Zmęczona"
          lines={TIRED_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {!dialogueOpen && live ? (
        <Monologue
          x={Z.bar + 64}
          headY={BAR[1] - 40}
          scale={scale}
          speaker="Barman"
          lines={CLUB_BARMAN_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {!dialogueOpen && mode !== "house" ? (
        <Monologue
          x={Z.dj}
          headY={BOOTH[1] - 34}
          scale={scale}
          speaker="DJ"
          lines={DJ_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {!dialogueOpen && live ? (
        <Monologue
          x={344}
          headY={86}
          scale={scale}
          speaker="Ola"
          lines={OLA_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {!dialogueOpen && live ? (
        <Monologue
          x={Z.door + 42}
          headY={86}
          scale={scale}
          speaker="Człowiek z telefonem"
          lines={CALLER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {!dialogueOpen && !live ? (
        <Monologue
          x={Z.dj - 110}
          headY={88}
          scale={scale}
          speaker="Technik"
          lines={TECHNIK_LINES}
          muted={dialogueOpen}
        />
      ) : null}

      {/* the light, the picture, the impossible */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <ScanDefs />
        <g shapeRendering="crispEdges">
          {/* the LED wall's picture */}
          <LedWall mode={mode} />

          {live ? (
            <g>
              {/* the room's ONE ambient: the floor wash, colour-cycling on a
                  slow discrete beat so the whole crowd changes key together */}
              <g>
                <Light set={WASH_FLOOR} />
                <path
                  d={pxPath(steppedEllipse((Z.floorL + Z.floorR) / 2, 158, 180, 15, 2))}
                  fill={K.neon}
                  opacity={0.1}
                >
                  <animate
                    attributeName="fill"
                    calcMode="discrete"
                    values={`${K.neon};${K.cyan};${K.uv};${K.amber}`}
                    dur="7.6s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
              {/* four cones off the moving heads, swinging out of phase */}
              {CONE_SETS.map((set, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed head list
                <g key={i}>
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    calcMode="discrete"
                    values={`0 0;${14 + i * 4} 0;${-10 - i * 3} 0;4 0;0 0`}
                    dur={`${3.8 + i * 0.7}s`}
                    repeatCount="indefinite"
                  />
                  <Light set={set} />
                </g>
              ))}
              {/* the strobe: peak only. 48 discrete slots so each flash is a
                  quarter-second, not a half-second veil over the whole room */}
              {peak && !still ? (
                <rect width={W} height={H} fill="#fff" opacity={0}>
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values={Array.from({ length: 48 }, (_, i) =>
                      i === 17 ? "0.45" : i === 19 ? "0.35" : i === 38 ? "0.4" : "0",
                    ).join(";")}
                    dur="12s"
                    repeatCount="indefinite"
                  />
                </rect>
              ) : null}
              {/* the bar's amber and the UV at the cloak counter */}
              <Light set={BAR_GLOW} />
              <path
                d={pxPath([[Z.cloak + 24, CLOAK_HATCH[1] + CLOAK_HATCH[3] - 4, 14, 4]])}
                fill={K.uv}
                opacity={0.5}
              />
              <Light set={UV_GLOW} />

              {/* three lasers off the booth, taking turns across the crowd */}
              {BEAMS.map((d, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed beam list
                <path key={i} d={d} fill={i === 1 ? K.cyan : K.neon} opacity={0}>
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values={Array.from({ length: 12 }, (_, s) => (s % 3 === i ? "0.35" : "0")).join(
                      ";",
                    )}
                    dur={`${5.2 + i * 0.9}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}

              {/* the smoke machine coughs beside the riser; the cloud takes
                  the lasers with it as it crosses the floor */}
              {[0, 9].map((d) => (
                <path
                  key={d}
                  d={pxPath([
                    ...steppedEllipse(Z.dj - 84, 132, 26, 8, 2),
                    ...steppedEllipse(Z.dj - 108, 126, 18, 6, 2),
                  ])}
                  fill={dth("c", "25")}
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.55;0.35;0.15;0;0;0"
                    begin={`${d}s`}
                    dur="18s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;-60 -4;-140 -8;-210 -10;-260 -12;-260 -12;-260 -12"
                    begin={`${d}s`}
                    dur="18s"
                    repeatCount="indefinite"
                  />
                </path>
              ))}

              {/* the UV piece wakes up: the room's second neon, breathing */}
              <g>
                <path d={UV_PIECE} fill={K.uv} opacity={0.5}>
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0.5;0.7;0.55;0.75;0.5"
                    dur="3.7s"
                    repeatCount="indefinite"
                  />
                </path>
                <BigText x={396} y={66} text="JUTRO TEZ JEST NOC" k={1} fill={K.uv} op={0.8} />
              </g>

              {/* somebody's phone goes off in the crowd — two spots, never both */}
              {FLASH_SPOTS.map(([fx2, fy], i) => (
                <g key={fx2}>
                  <path
                    d={pxPath([
                      [fx2 - 1, fy - 1, 3, 3],
                      [fx2 - 3, fy - 3, 7, 7],
                    ])}
                    fill="#fff"
                    opacity={0}
                  >
                    <animate
                      attributeName="opacity"
                      calcMode="discrete"
                      values={Array.from({ length: 40 }, (_, s) =>
                        s === (i === 0 ? 13 : 29) ? "0.8" : "0",
                      ).join(";")}
                      dur={`${17 + i * 6}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              ))}

              {/* the old hoist catches a beam now and then — the hall winks */}
              <path d={pxPath([[1120, 56, 3, 3]])} fill={K.cyan} opacity={0}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0;0;0;0.8;0;0;0;0;0;0;0.7;0;0"
                  dur="21s"
                  repeatCount="indefinite"
                />
              </path>

              {/* one piece of confetti still falling from the truss. From June. */}
              <path d={pxPath([[Z.floorL + 96, 40, 2, 2]])} fill={K.neon} opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;0;0.8;0.8;0.7;0"
                  dur="26s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;0 0;6 30;-4 62;5 96;5 108"
                  dur="26s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : (
            /* house lights: flat, honest, unflattering — strip fittings */
            <g>
              <path
                d={pxPath(repeat(4, 300, [80, 8, 60, 4] as Rect))}
                fill="#e8e2d2"
                opacity={0.9}
              />
              <Light
                set={tiers(
                  (k) =>
                    steppedEllipse(W / 2, 150, Math.round(W * 0.45 * k), Math.round(18 * k), 2),
                  "c",
                  0.8,
                )}
              />
            </g>
          )}
          {/* the exits never go out, whatever the rig is doing */}
          <Light set={EXIT_GLOWS} />

          {/* what the player is doing */}
          {actionUi === "sambo" && live ? (
            <path d={pxPath(steppedEllipse(0, 0, 0, 0, 2))} fill="none" />
          ) : null}

          {/* the fusebox, poked: two sparks and a flicker, then it forgives */}
          {fx
            .filter((f) => f.kind === "spark")
            .map((f) => (
              <g key={f.id}>
                <path
                  d={pxPath([
                    [f.x - 2, 100, 2, 2],
                    [f.x + 3, 104, 2, 2],
                  ])}
                  fill={K.amber}
                >
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="1;0;1;0;0"
                    dur="0.9s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </path>
              </g>
            ))}

          {/* --- the surreal layer ------------------------------------------ */}
          {hallu ? <Hallucination kind={hallu} /> : null}

          {/* the RGB split on the brightest emitter: the exit signs and neon
              text get a one-pixel cyan/red echo — a tired sensor, not a filter */}
          {live ? (
            <g opacity={0.35}>
              {EXIT_SIGNS.map((r) => (
                <g key={r[0]}>
                  <BigText
                    x={r[0] + 2}
                    y={r[1] + 3}
                    text="WYJSCIE"
                    k={1}
                    fill={K.ledRed}
                    op={0.5}
                  />
                  <BigText x={r[0] + 4} y={r[1] + 3} text="WYJSCIE" k={1} fill={K.cyan} op={0.5} />
                </g>
              ))}
            </g>
          ) : null}

          {/* scanlines over everything, then the vignette */}
          {live ? <rect width={W} height={H} fill="url(#club-scan)" opacity={0.16} /> : null}
          <Vignette set={vignettePaths(W, H)} strength={live ? 0.9 : 0.3} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition
 * ================================================================== */

export const RAVE_CLUB_SCENE: RuntimeSceneDef<WorldState> = {
  id: "raveclub",
  width: W,
  spawnX: 90,
  ground: {
    top: FLOOR,
    bottom: BAND_BOT,
    /**
     * What the floor is made of where it matters: the dance floor by name
     * (live.surface reads it back), and the strip in front of the bar where
     * a decade of spilled sugar genuinely slows your soles.
     */
    zones: [
      { x0: Z.bar - 10, x1: Z.bar + 150, y0: 158, y1: BAND_BOT, kind: "sticky", speed: 0.92 },
      { x0: Z.floorL, x1: Z.floorR, kind: "dancefloor" },
    ],
    blockers: [
      /* the cable-drum table in the chill corner */
      {
        x0: CLUB_PROPS.drum.x - 17,
        y0: CLUB_PROPS.drum.y - 8,
        x1: CLUB_PROPS.drum.x + 17,
        y1: CLUB_PROPS.drum.y + 1,
      },
      /* the crate stack by the corridor */
      {
        x0: CLUB_PROPS.crates.x - 16,
        y0: CLUB_PROPS.crates.y - 6,
        x1: CLUB_PROPS.crates.x + 16,
        y1: CLUB_PROPS.crates.y + 1,
      },
    ],
  },
  /** The two pieces of furniture a person can genuinely walk around. */
  actors: [
    propActor("club-drum", CLUB_PROPS.drum.x, CLUB_PROPS.drum.y, drumMap(), DRUM_PALETTE),
    propActor(
      "club-crates-prop",
      CLUB_PROPS.crates.x,
      CLUB_PROPS.crates.y,
      cratesMap(),
      CRATES_PALETTE,
    ),
  ],
  artKey: (w, ph) => {
    const p = toPhase(ph);
    return [ph, clubMode(w, p)].join("|");
  },
  describe:
    "Inside the club: a black shipyard hall, a crowd on the dance floor, a DJ under an LED wall, moving lights, and every so often something you are not sure you saw.",
  objects: [
    /* --- out --- */
    {
      id: "club-exit",
      kind: "creakdoor",
      priority: 2,
      x: Z.door,
      range: 28,
      to: { scene: "elektrykow", spawnX: 1584 },
    },
    { id: "club-cloak", kind: "flavor", x: Z.cloak, range: 24 },
    { id: "club-earplugs", kind: "earplugs", x: Z.cloak - 24, range: 14 },
    { id: "club-stamp", kind: "sport", action: "use", x: Z.cloak + 30, range: 16 },
    /* --- the bar --- */
    { id: "club-bar", kind: "clubbar", priority: 2, x: Z.bar + 64, range: 34, approachY: 153 },
    { id: "club-board", kind: "flavor", x: Z.bar + 68, range: 26, markerY: 44 },
    { id: "club-fridge", kind: "flavor", x: BAR_FRIDGE[0] + 17, range: 16 },
    { id: "club-tally", kind: "flavor", x: 360, range: 16, markerY: 102 },
    { id: "club-clock", kind: "flavor", x: 230, range: 16, markerY: 62 },
    { id: "club-fan", kind: "flavor", x: Z.bar + 116, range: 18, markerY: 50 },
    { id: "club-sticky", kind: "flavor", x: Z.bar + 70, y: 164, range: 26 },
    { id: "club-pallet", kind: "flavor", x: BAR[0] + BAR[2] + 25, range: 16 },
    /* --- the corner --- */
    { id: "club-sofa", kind: "sport", action: "sitSofa", face: -1, x: SOFA_A[0] + 26, range: 24 },
    {
      id: "club-couple",
      kind: "npc",
      priority: 2,
      x: 358,
      range: 18,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "open" || s.club === "peak";
      },
    },
    { id: "club-heart", kind: "flavor", x: 366, range: 14, markerY: 90 },
    { id: "club-shoe", kind: "flavor", x: Z.chill + 20, y: 164, range: 14 },
    {
      id: "club-drum-table",
      kind: "flavor",
      x: CLUB_PROPS.drum.x,
      y: CLUB_PROPS.drum.y - 3,
      range: 18,
    },
    {
      id: "club-uv-wall",
      kind: "flavor",
      x: 424,
      range: 30,
      markerY: 50,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "open" || s.club === "peak";
      },
    },
    {
      id: "tired-girl",
      kind: "npc",
      priority: 2,
      x: Z.chill + 98,
      range: 16,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "open" || s.club === "peak";
      },
    },
    { id: "club-flyers", kind: "flavor", x: Z.chill + 40, range: 30, markerY: 66 },
    { id: "club-mannequin", kind: "flavor", x: MQ_X + 5, range: 16 },
    /* --- the floor --- */
    { id: "speaker-left", kind: "speaker", x: STACK_L[0][0] + 22, range: 24 },
    {
      id: "dance-floor",
      kind: "dance",
      priority: 1,
      x: (Z.floorL + Z.floorR) / 2,
      y: 160,
      range: 90,
      yRange: 22,
    },
    { id: "club-graffiti", kind: "flavor", x: 656, range: 34, markerY: 98 },
    { id: "club-machine-bed", kind: "flavor", x: 740, y: 163, range: 24 },
    { id: "speaker-right", kind: "speaker", x: STACK_R[0][0] + 22, range: 24 },
    { id: "club-hoist", kind: "flavor", x: 1122, range: 26, markerY: 52 },
    /* --- the booth --- */
    {
      id: "dj-booth",
      kind: "npc",
      priority: 2,
      x: Z.dj,
      range: 30,
      when: (w) =>
        elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState))).club !== "closed",
    },
    { id: "club-norequests", kind: "flavor", x: Z.dj, range: 20, markerY: BOOTH[1] + 4 },
    { id: "club-ledwall", kind: "flavor", x: Z.dj, range: 44, markerY: 40 },
    /* --- the back --- */
    {
      id: "club-crates",
      kind: "flavor",
      x: CLUB_PROPS.crates.x,
      y: CLUB_PROPS.crates.y - 3,
      range: 20,
    },
    { id: "club-tags", kind: "flavor", x: 1056, range: 20, markerY: 102 },
    {
      id: "wc-queue",
      kind: "npc",
      priority: 2,
      x: Z.corridor - 14,
      range: 14,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "open" || s.club === "peak";
      },
    },
    {
      id: "club-caller",
      kind: "npc",
      priority: 2,
      x: Z.door + 42,
      range: 14,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "open" || s.club === "peak";
      },
    },
    {
      id: "club-technik",
      kind: "npc",
      priority: 2,
      x: Z.dj - 110,
      range: 16,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "closed" || s.club === "prep";
      },
    },
    {
      id: "club-broom",
      kind: "flavor",
      x: Z.corridor - 33,
      range: 14,
      when: (w) => {
        const s = elektrykowState(w as WorldState, toPhase(gamePhase(w as WorldState)));
        return s.club === "closed" || s.club === "prep";
      },
    },
    { id: "club-wc", kind: "portaloo", x: Z.corridor - 6, range: 22 },
    { id: "club-fusebox", kind: "clubfuse", x: FUSEBOX[0] + 13, range: 18 },
    { id: "club-extinguisher", kind: "flavor", x: Z.door + 69, range: 14 },
    {
      id: "club-yarddoor",
      kind: "creakdoor",
      x: Z.corridor + 27,
      range: 20,
      to: { scene: "elektrykow", spawnX: 1690 },
    },
  ],
  Component: ({ world, phase }) => <RaveClubScene world={world} phase={phase} />,
  darkness: () => 0,
  Foreground: (p) => <RaveFront {...p} />,
  Effects: RaveEffects,
};
