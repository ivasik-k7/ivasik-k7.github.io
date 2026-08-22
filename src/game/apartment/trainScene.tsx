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
  M,
  type Mat,
  type Ph,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  textPath,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { SHADE_CYCLE, TrainWindowView, VIEW } from "./trainLandscape";

// --- inside the SKM, somewhere between Przymorze and Oliwa -------------------

/**
 * The saloon of a moving SKM unit.
 *
 * ==================================================================
 * THE SCALE, WHICH WAS WRONG
 *
 * This scene used to stretch its interior to 58 px per metre vertically while
 * the player stayed at the game's key of 38, on the argument that a 2.30 m
 * carriage only fills 87 px of a 150 px frame and the rest would be roof void.
 *
 * What that produced:
 *
 *     seat back  1.15 m  at 58 px/m =  67 px  = 1.00 × the player
 *     seat back  1.15 m  at 38 px/m =  44 px  = 0.66 × the player
 *     real:      1.15 m / 1.76 m person       = 0.65
 *
 * The seat backs were exactly as tall as the person walking past them, and
 * every object in the room was 53% too big. No amount of detail fixes a room
 * whose furniture is the size of its people; it only gives you more oversized
 * things to look at.
 *
 * The stretch is gone. One key, 38 px per metre, both axes, same as the player
 * and same as every exterior in the game. And the 63 px the stretch existed to
 * hide turns out not to be roof void at all — from inside a carriage you see the
 * *ceiling*, foreshortened, above your head, with its coves and vents and the
 * handrail and the straps hanging off it. That band is now the nearest surface
 * in the picture instead of the emptiest.
 *
 *   y   0– 63  ceiling from below: near cove, panels, vents, domes, far cove
 *   y  63      the cant rail, where ceiling meets far wall
 *   y  64– 72  luggage rack, its handrail, and the straps hanging off it
 *   y  72–112  the glazing (VIEW's band — see below)
 *   y 112–150  sill shelf, heater grilles, seats, skirting
 *   y 150–180  the floor from above, receding to the near edge
 *
 * A standing figure is now 66 px against the player's 67, so the scene can
 * finally have people standing in the aisle — which the old key made impossible,
 * and which is most of what was missing from a supposedly crowded commuter
 * train that read as an empty room with hats on the seats.
 *
 * WHERE THE KEY COMES FROM. The window band belongs to trainLandscape and this
 * file cannot see the numbers in it, so rather than assert a vertical key and
 * hope the two agree, the scene derives one: an EMU's window sill is 1.00 m
 * above the floor, VIEW.bottom is that sill, so FLOOR − VIEW.bottom is one metre
 * in pixels. Everything else is laid out in metres from there, and the guard on
 * VPM catches a landscape module authored against some other layout.
 * ==================================================================
 *
 * SIX PLANES:
 *   farBackground   — the view through the glass, and what the glass reflects.
 *   middleBackground— the ceiling and the far wall: openings, piers, heaters,
 *                     signage, the route map, the ends of the carriage.
 *   ground          — the floor, its wear, markings, litter, and the pools of
 *                     daylight the windows throw across it.
 *   staticObjects   — seats, tables, poles, doors, kasowniki, bins, bike, bags.
 *   gameplayObjects — the other passengers, seated and standing.
 *   Foreground      — the near side of the aisle, everything cut off by an edge
 *                     of the frame and everything *larger* than its opposite
 *                     number across the carriage.
 *
 * LIGHTING PREMISE. Two sources and they fight: cold white LED in the ceiling
 * coves, on all day, and whatever the hour is coming through the glass. Every
 * nineteen seconds a bridge takes the daylight for six tenths of a second and
 * the LED wins — on the wall, the seats and the floor at once.
 */

/* ------------------------------------------------------------- the keys --- */

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);

const W = 1400;
const FLOOR = 150;
const FRAME_H = 180;

const VPM_RAW = FLOOR - VIEW.bottom;
const VPM = VPM_RAW >= 26 && VPM_RAW <= 52 ? VPM_RAW : PPM;
const vm = (metres: number) => Math.round(metres * VPM);
/** Height above the floor, in metres, to scene y. */
const y = (metres: number) => FLOOR - vm(metres);

/** The cant rail: 2.30 m up, or high enough to clear the glazing, whichever. */
const CANT = Math.min(y(2.3), VIEW.top - 12);
const RACK_Y = CANT + 1;
const RACK_H = 4;
const GLASS_TOP = VIEW.top - 3;
const GLASS_BOTTOM = VIEW.bottom + 3;
const SEAT_BACK = y(1.15);
const SEAT_HEAD = y(0.95);
const SEAT_TOP = y(0.45);
const ARM_TOP = y(0.6);
const TABLE_TOP = y(0.72);
const HEAD_SEATED = y(1.32);
const HEAD_STANDING = y(1.75);

/** Where things are along the carriage. Unchanged: gameplay hangs off these. */
const Z = {
  wc: 46,
  doorL: 120,
  mpb: 158,
  map: 300,
  bay: [400, 620, 840, 1060] as const,
  doorR: 1280,
  bin: 1180,
  end: 1318,
} as const;

const K = {
  panel: "#dcd8ce",
  ceiling: "#e4e0d6",
  moquette: "#3f5a78",
  moquetteHi: "#54718f",
  insert: "#2f4763",
  fleck: "#7d94ac",
  priority: "#6b4a72",
  priorityHi: "#87608f",
  pole: "#e8c445",
  poleHi: "#f6dc72",
  led: "#e6ecd8",
  ledAmber: "#ffb03a",
  floorBase: "#6d6a64",
  nosing: "#e8c445",
  signBlue: "#0e3566",
  white: "#f2f2ee",
  grille: "#9a958b",
  access: "#1b4b96",
  red: "#c94040",
  green: "#3f9f5c",
  /** the kasownik: the orange of every ticket punch in Poland */
  kasownik: "#e2701f",
  case: "#4a3f38",
  skin: "#a98d78",
  skinNight: "#8a7566",
} as const;

/**
 * The bridge cadence, imported rather than declared.
 *
 * This used to be a 19-second guess typed here and a separate set of numbers
 * typed in trainLandscape's TunnelShade, and they never agreed: the carriage
 * went dark on its own schedule while the bridge went past on another. The
 * landscape owns the timetable now — it is the thing that knows where the
 * bridges are — and everything in here that has to respond to one reads its
 * keyTimes off SHADE_CYCLE.
 */
const BRIDGE = {
  dur: SHADE_CYCLE.dur,
  keyTimes: SHADE_CYCLE.keyTimes,
  daylight: SHADE_CYCLE.daylight,
  led: SHADE_CYCLE.shade,
} as const;

const PANEL: Record<Ph, Mat> = {
  dawn: dim(M.laminate, "#b6c0cc", 0.1),
  day: M.laminate,
  dusk: dim(M.laminate, "#e0925e", 0.12),
  night: dim(M.laminate, "#1c1a34", 0.3),
};
const FRAME: Record<Ph, Mat> = {
  dawn: M.frame,
  day: M.frame,
  dusk: dim(M.frame, "#e0925e", 0.14),
  night: dim(M.frame, "#1c1a34", 0.36),
};
const SEAT: Mat = {
  hi: K.moquetteHi,
  base: K.moquette,
  mid: "#37506a",
  lo: "#2f455c",
  deep: "#223346",
};
const SEAT_PRIORITY: Mat = {
  hi: K.priorityHi,
  base: K.priority,
  mid: "#5d4064",
  lo: "#4d3453",
  deep: "#39273e",
};
const WASH: Record<Ph, string> = {
  dawn: "#b7c8dc",
  day: "#fff4d8",
  dusk: "#ffb277",
  night: "#2a3350",
};

/* ================================================================== *
 * state
 * ================================================================== */

export interface TrainState {
  toward: "gdansk" | "gdynia";
  crowd: number;
  seated: boolean;
  lights: boolean;
}

const DEFAULTS: TrainState = { toward: "gdynia", crowd: 2, seated: false, lights: true };

export function trainState(world: WorldState): TrainState {
  const raw = (world as { train?: Partial<TrainState> }).train;
  return raw ? { ...DEFAULTS, ...raw } : DEFAULTS;
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
/** A woven fleck on a lattice — moquette is a textile, not noise. */
const weave = (r: Rect, step = 4): Rect[] => {
  const [rx, ry, rw, rh] = r;
  const out: Rect[] = [];
  for (let j = 1; j < rh - 1; j += 3) {
    for (let i = ((j / 3) | 0) % 2 ? 2 : 0; i < rw - 1; i += step) out.push([rx + i, ry + j, 1, 1]);
  }
  return out;
};

/* ================================================================== *
 * the ceiling, seen from below
 * ================================================================== */

/**
 * Sixty-three pixels of it, and it is the nearest surface in the picture.
 *
 * From the top of the frame down: the near cove, directly over the player's
 * head and cut off by the frame; the near slope; the flat centre panel with the
 * vents, speakers and camera domes; the far slope; then the far cove, the bright
 * line running the length of the carriage just above the wall. Two coves,
 * because a carriage has two sides and from inside it you see both — the single
 * cove the old version drew was the tell that the ceiling was a backdrop rather
 * than a surface you are standing under.
 */
const CEIL_NEAR = Math.round(CANT * 0.11);
const CEIL_MID_TOP = Math.round(CANT * 0.3);
const CEIL_MID_BOT = Math.round(CANT * 0.72);
const CEIL_FAR = CANT - 6;

const CEILING = pxPath([[0, 0, W, CANT]]);
const CEIL_PANEL = pxPath([[0, CEIL_MID_TOP, W, CEIL_MID_BOT - CEIL_MID_TOP]]);
const CEIL_SLOPES = pxPath([
  [0, CEIL_NEAR, W, 2],
  [0, CEIL_MID_TOP - 2, W, 2],
  [0, CEIL_MID_BOT, W, 2],
  [0, CEIL_FAR - 2, W, 2],
]);
const CEIL_JOINTS = pxPath(
  repeat(Math.ceil(W / 110), 110, [54, CEIL_NEAR, 1, CEIL_FAR - CEIL_NEAR] as Rect),
);
const COVE_NEAR = pxPath([
  [0, 0, W, CEIL_NEAR],
  [0, CEIL_NEAR, W, 1],
]);
const COVE_FAR = pxPath([
  [0, CEIL_FAR, W, 4],
  [0, CEIL_FAR + 4, W, 2],
]);
const COVE_WASH = pxPath([
  [0, CEIL_NEAR + 1, W, 5],
  [0, CEIL_FAR - 6, W, 5],
]);
const CEIL_VENTS = pxPath(repeat(Math.ceil(W / 150), 150, [70, CEIL_MID_TOP + 5, 34, 4] as Rect));
const CEIL_VENT_SLATS = pxPath(
  repeat(Math.ceil(W / 150), 150, [72, CEIL_MID_TOP + 6, 30, 1] as Rect),
);
const SPEAKERS = pxPath([
  [Z.map + 40, CEIL_MID_BOT - 8, 12, 5],
  [Z.bay[2] + 40, CEIL_MID_BOT - 8, 12, 5],
]);
const DOMES = pxPath([
  [Z.bay[1] - 30, CEIL_MID_BOT - 9, 10, 6],
  [Z.bay[3] + 20, CEIL_MID_BOT - 9, 10, 6],
]);
const CANT_RAIL = pxPath([
  [0, CANT, W, 3],
  [0, CANT + 3, W, 1],
]);

/**
 * The luggage rack: a shelf tucked under the cant rail on brackets, with the far
 * handrail on its underside and the far straps hanging off that. There is not
 * much room between ceiling and window head on a modern EMU — nine pixels here —
 * and the rack, the rail and the straps all have to live in it, which is exactly
 * the crush it is in life.
 */
const RACK = pxPath([
  [0, RACK_Y, W, RACK_H],
  ...repeat(Math.ceil(W / 110), 110, [20, RACK_Y + RACK_H, 4, GLASS_TOP - RACK_Y - RACK_H] as Rect),
]);
const RACK_RAIL = pxPath([[0, RACK_Y + RACK_H, W, 2]]);
const RACK_BAGS = pxPath([
  [Z.bay[0] + 24, RACK_Y - 9, 46, 9],
  [Z.bay[0] + 30, RACK_Y - 12, 18, 3],
  [Z.bay[2] + 10, RACK_Y - 8, 34, 8],
  [Z.bay[3] + 40, RACK_Y - 7, 26, 7],
  [Z.map + 96, RACK_Y - 8, 30, 8],
]);
const FAR_STRAP_X = [Z.map + 120, Z.bay[1] - 60, Z.bay[2] + 20, Z.bay[3] + 30] as const;

/* ================================================================== *
 * the window wall
 * ================================================================== */

const WINDOWS: Rect[] = [
  [Z.map + 60, VIEW.top, 150, VIEW.bottom - VIEW.top],
  [Z.bay[1] - 40, VIEW.top, 150, VIEW.bottom - VIEW.top],
  [Z.bay[2] - 40, VIEW.top, 150, VIEW.bottom - VIEW.top],
  [Z.bay[3] - 40, VIEW.top, 130, VIEW.bottom - VIEW.top],
];
const DOOR_LIGHTS: Rect[] = [
  [Z.doorL - 18, VIEW.top + 4, 40, VIEW.bottom - VIEW.top - 8],
  [Z.doorR - 20, VIEW.top + 4, 40, VIEW.bottom - VIEW.top - 8],
];
const ALL_GLASS = [...WINDOWS, ...DOOR_LIGHTS];

const WINDOW_FRAMES = pxPath(
  ALL_GLASS.flatMap(
    ([x, gy, w, h]) =>
      [
        [x - 3, gy - 3, w + 6, 3],
        [x - 3, gy + h, w + 6, 3],
        [x - 3, gy - 3, 3, h + 6],
        [x + w, gy - 3, 3, h + 6],
      ] as Rect[],
  ),
);
const WINDOW_SEAL = pxPath(
  ALL_GLASS.flatMap(
    ([x, gy, w, h]) =>
      [
        [x - 1, gy - 1, w + 2, 1],
        [x - 1, gy + h, w + 2, 1],
        [x - 1, gy - 1, 1, h + 2],
        [x + w, gy - 1, 1, h + 2],
      ] as Rect[],
  ),
);
/** The mullion in the big panes: they are two lights each, not one. */
const MULLIONS = pxPath(
  WINDOWS.filter(([, , w]) => w > 140).map(
    ([x, gy, w, h]) => [x + Math.round(w / 2) - 2, gy, 4, h] as Rect,
  ),
);
const SILLS = pxPath(WINDOWS.map(([x, , w]) => [x - 5, GLASS_BOTTOM, w + 10, 4] as Rect));
const HOPPERS = pxPath(
  WINDOWS.flatMap(
    ([x, gy, w]) =>
      [[x + 26, gy + 3, w - 52, 6], ...repeat(3, 3, [x + 30, gy + 5, w - 60, 1] as Rect)] as Rect[],
  ),
);
const BLINDS = pxPath(
  WINDOWS.flatMap(
    ([x, gy, w]) =>
      [
        [x - 3, gy - 7, w + 6, 3],
        [x + 4, gy - 6, w - 8, 3],
      ] as Rect[],
  ),
);
const GLASS_SHEEN = pxPath(
  WINDOWS.flatMap(([x, gy, , h]) =>
    Array.from({ length: 9 }, (_, i) => [x + 12 + i * 6, gy + h - 8 - i * 5, 5, 5] as Rect).filter(
      (r) => r[1] > gy && r[1] < gy + h - 4,
    ),
  ),
);
const GLASS_SHEEN_2 = pxPath(
  WINDOWS.flatMap(([x, gy, w, h]) =>
    Array.from(
      { length: 7 },
      (_, i) => [x + w - 58 + i * 5, gy + h - 10 - i * 5, 4, 5] as Rect,
    ).filter((r) => r[1] > gy + 2 && r[1] < gy + h - 5),
  ),
);
const GLASS_DECAL = pxPath(
  WINDOWS.flatMap(([x, , w], i) =>
    i % 2 === 0 ? ([[x + w - 22, VIEW.bottom - 15, 16, 11]] as Rect[]) : [],
  ),
);
const GLASS_DECAL_MARK = pxPath(
  WINDOWS.flatMap(([x, , w], i) =>
    i % 2 === 0
      ? ([
          [x + w - 19, VIEW.bottom - 12, 5, 2],
          [x + w - 16, VIEW.bottom - 10, 2, 5],
        ] as Rect[])
      : [],
  ),
);
/** What the glass gives back: the cove line and the pale seat tops. */
const REFLECT_COVE = pxPath(
  ALL_GLASS.map(([x, gy, w, h]) => [x + 2, gy + Math.round(h * 0.24), w - 4, 2] as Rect),
);
const REFLECT_SEATS = pxPath(
  WINDOWS.flatMap(([x, gy, w, h]) => {
    const out: Rect[] = [];
    for (let i = 0; i < 3; i++) out.push([x + 14 + i * 46, gy + h - 10, 30, 7]);
    return out.filter((r) => r[0] + r[2] < x + w);
  }),
);

/* --------------------------------------------------------------- walls ---- */

const WALL_UPPER = pxPath([[0, CANT, W, GLASS_TOP - CANT]]);
const WALL_LOWER = pxPath([[0, GLASS_BOTTOM, W, FLOOR - GLASS_BOTTOM]]);
const PIER_RECTS: Rect[] = (() => {
  const openings = [...ALL_GLASS].sort((a, b) => a[0] - b[0]);
  const out: Rect[] = [];
  const h = GLASS_BOTTOM - GLASS_TOP;
  let cursor = 0;
  for (const [x, , w] of openings) {
    const left = x - 3;
    if (left > cursor) out.push([cursor, GLASS_TOP, left - cursor, h]);
    cursor = Math.max(cursor, x + w + 3);
  }
  if (cursor < W) out.push([cursor, GLASS_TOP, W - cursor, h]);
  return out;
})();
const PIERS = pxPath(PIER_RECTS);
const WALL_JOINTS = pxPath([
  ...PIER_RECTS.filter((r) => r[2] > 44).map(
    ([x, gy, w, h]) => [x + Math.round(w / 2), gy, 1, h] as Rect,
  ),
  ...repeat(Math.ceil(W / 220), 220, [40, GLASS_BOTTOM, 1, FLOOR - GLASS_BOTTOM] as Rect),
]);
/** Heater grilles under the windows, in the gaps between bays where they show. */
const HEATER_SPANS: Rect[] = [
  [Z.mpb - 4, GLASS_BOTTOM + 6, 78, 14],
  ...Z.bay.slice(0, 3).map((x) => [x + 128, GLASS_BOTTOM + 6, 88, 14] as Rect),
];
const HEATER = pxPath(HEATER_SPANS);
const HEATER_SLATS = pxPath(
  HEATER_SPANS.flatMap(([x, gy, w]) => repeat(Math.floor(w / 5), 5, [x + 2, gy + 3, 3, 9] as Rect)),
);
const SKIRT = pxPath([
  [0, FLOOR - 6, W, 6],
  [0, FLOOR - 7, W, 1],
]);
const SOCKETS = pxPath(Z.bay.map((x) => [x + 116, GLASS_BOTTOM + 8, 8, 6] as Rect));
const HOOKS = pxPath(
  PIER_RECTS.filter((r) => r[2] > 60).flatMap(
    ([x, , w]) =>
      [
        [x + Math.round(w / 2) - 1, GLASS_TOP + 4, 2, 4],
        [x + Math.round(w / 2) - 3, GLASS_TOP + 7, 6, 2],
      ] as Rect[],
  ),
);

/* ================================================================== *
 * seats — at the character's key, so a seat back is chest height
 * ================================================================== */

type BayParts = {
  headrest: Rect[];
  head_hi: Rect[];
  back: Rect[];
  insert: Rect[];
  arms: Rect[];
  cushion: Rect[];
  lip: Rect[];
  grab: Rect[];
  far: Rect[];
  far_hi: Rect[];
  table: Rect[];
  legs: Rect[];
};

/**
 * A bay: two facing pairs across a table, seen from the aisle, so the far pair
 * shows only as headrests over the near backs.
 *
 * Seven parts to a seat, not two. A back slab and a cushion is a bench and
 * nothing in it says anyone sat down; what says it is the headrest being its own
 * piece, the insert being a different weave from the surround, the armrest
 * standing proud on the aisle side, the cushion oversailing with a lip of shadow
 * under its nose, and the yellow grab handle on the top corner that everybody
 * walking the aisle puts a hand on.
 */
function seatBay(x: number): BayParts {
  const p: BayParts = {
    headrest: [],
    head_hi: [],
    back: [],
    insert: [],
    arms: [],
    cushion: [],
    lip: [],
    grab: [],
    far: [],
    far_hi: [],
    table: [],
    legs: [],
  };
  for (const sx of [x, x + 72]) {
    p.headrest.push([sx + 5, SEAT_BACK, 40, SEAT_HEAD - SEAT_BACK]);
    p.head_hi.push([sx + 7, SEAT_BACK + 1, 36, 1]);
    p.back.push([sx, SEAT_HEAD - 1, 50, SEAT_TOP - SEAT_HEAD + 1]);
    p.insert.push([sx + 9, SEAT_HEAD + 3, 32, SEAT_TOP - SEAT_HEAD - 7]);
    p.arms.push(
      [sx - 4, ARM_TOP, 6, SEAT_TOP - ARM_TOP + 3],
      [sx + 48, ARM_TOP, 6, SEAT_TOP - ARM_TOP + 3],
    );
    p.cushion.push([sx - 3, SEAT_TOP, 56, 7]);
    p.lip.push([sx - 3, SEAT_TOP + 5, 56, 2]);
    p.grab.push([sx + 39, SEAT_BACK - 3, 11, 4]);
    p.legs.push(
      [sx + 8, SEAT_TOP + 7, 8, FLOOR - SEAT_TOP - 7],
      [sx + 34, SEAT_TOP + 7, 8, FLOOR - SEAT_TOP - 7],
    );
  }
  p.far.push([x + 8, SEAT_BACK - 6, 34, 8], [x + 80, SEAT_BACK - 6, 34, 8]);
  p.far_hi.push([x + 10, SEAT_BACK - 5, 30, 1], [x + 82, SEAT_BACK - 5, 30, 1]);
  p.table.push(
    [x + 48, TABLE_TOP, 26, 3],
    [x + 58, TABLE_TOP + 3, 6, FLOOR - TABLE_TOP - 6],
    [x + 52, FLOOR - 4, 18, 3],
  );
  return p;
}

const BAYS = Z.bay.map((x) => seatBay(x));
const PRIORITY_BAY = 0;
const pick = (f: (b: BayParts) => Rect[], priority: boolean) =>
  BAYS.flatMap((b, i) => ((i === PRIORITY_BAY) === priority ? f(b) : []));

const SEATS_NEAR = bevelPaths(pick((b) => b.back, false));
const SEATS_NEAR_PRI = bevelPaths(pick((b) => b.back, true));
const SEATS_FAR = bevelPaths(BAYS.flatMap((b) => b.far));
const HEADRESTS = pxPath(pick((b) => b.headrest, false));
const HEADRESTS_PRI = pxPath(pick((b) => b.headrest, true));
const HEAD_HI = pxPath(BAYS.flatMap((b) => b.head_hi));
const FAR_HI = pxPath(BAYS.flatMap((b) => b.far_hi));
const INSERTS = pxPath(pick((b) => b.insert, false));
const INSERTS_PRI = pxPath(pick((b) => b.insert, true));
const CUSHIONS = pxPath(BAYS.flatMap((b) => b.cushion));
const CUSHION_LIP = pxPath(BAYS.flatMap((b) => b.lip));
const ARMRESTS = pxPath(BAYS.flatMap((b) => b.arms));
const SEAT_GRABS = pxPath(BAYS.flatMap((b) => b.grab));
const TABLES = pxPath(BAYS.flatMap((b) => b.table));
const SEAT_LEGS = pxPath(BAYS.flatMap((b) => b.legs));
const MOQUETTE_WEAVE = pxPath(
  BAYS.flatMap((b) => [...b.back, ...b.cushion].flatMap((r) => weave(r, 4))),
);
const INSERT_WEAVE = pxPath(BAYS.flatMap((b) => b.insert.flatMap((r) => weave(r, 3))));
const PRIORITY_SIGN = pxPath([[Z.bay[PRIORITY_BAY] - 24, GLASS_BOTTOM + 7, 12, 12]]);
const PRIORITY_MARK = pxPath([
  [Z.bay[PRIORITY_BAY] - 21, GLASS_BOTTOM + 9, 3, 3],
  [Z.bay[PRIORITY_BAY] - 22, GLASS_BOTTOM + 13, 6, 4],
  [Z.bay[PRIORITY_BAY] - 19, GLASS_BOTTOM + 13, 4, 2],
]);

/** What is on the tables: a cup with a lid, a phone, a folded paper. */
const TABLE_TOPS = pxPath([
  [Z.bay[0] + 52, TABLE_TOP - 7, 6, 7],
  [Z.bay[0] + 62, TABLE_TOP - 3, 8, 3],
  [Z.bay[2] + 54, TABLE_TOP - 4, 13, 4],
  [Z.bay[3] + 60, TABLE_TOP - 6, 5, 6],
]);
const CUP_LID = pxPath([
  [Z.bay[0] + 51, TABLE_TOP - 8, 8, 2],
  [Z.bay[3] + 59, TABLE_TOP - 7, 7, 2],
]);

/* --------------------------------------------------- poles, rails, stubs -- */

const POLE_X = [Z.doorL + 40, Z.bay[1] - 16, Z.bay[2] - 16, Z.bay[3] - 16, Z.doorR - 46] as const;
const POLES = pxPath(POLE_X.map((x) => [x, CANT + 2, 5, FLOOR - CANT - 2] as Rect));
const POLE_HI = pxPath(POLE_X.map((x) => [x, CANT + 2, 1, FLOOR - CANT - 2] as Rect));
const POLE_COLLAR = pxPath(
  POLE_X.flatMap(
    (x) =>
      [
        [x - 2, CANT + 2, 9, 3],
        [x - 1, FLOOR - 4, 7, 4],
      ] as Rect[],
  ),
);
/** Stub rails off the seat ends, which is what you actually hold on to. */
const STUB_RAILS = pxPath(
  Z.bay.flatMap(
    (x) =>
      [
        [x - 8, SEAT_BACK - 2, 4, 22],
        [x + 126, SEAT_BACK - 2, 4, 22],
      ] as Rect[],
  ),
);

/* --------------------------------------------------------------- doors ---- */

const DOOR_H = FLOOR - (VIEW.top - 8);
function doorLeaf(x: number): Rect[] {
  const half = Math.round(m(1.3) / 2);
  return [
    [x - half, VIEW.top - 8, half, DOOR_H],
    [x, VIEW.top - 8, half, DOOR_H],
  ];
}
const DOORS = bevelPaths([...doorLeaf(Z.doorL), ...doorLeaf(Z.doorR)]);
const DOOR_SPLIT = pxPath([
  [Z.doorL - 1, VIEW.top - 8, 2, DOOR_H],
  [Z.doorR - 1, VIEW.top - 8, 2, DOOR_H],
]);
const DOOR_HEAD = pxPath([
  [Z.doorL - m(1.3) / 2 - 3, VIEW.top - 11, m(1.3) + 6, 3],
  [Z.doorR - m(1.3) / 2 - 3, VIEW.top - 11, m(1.3) + 6, 3],
]);
const DOOR_NOSING = pxPath([
  [Z.doorL - m(1.3) / 2, FLOOR - 3, m(1.3), 3],
  [Z.doorR - m(1.3) / 2, FLOOR - 3, m(1.3), 3],
]);
const DOOR_EDGE = pxPath([
  [Z.doorL - 3, VIEW.top - 8, 3, DOOR_H],
  [Z.doorL + 1, VIEW.top - 8, 3, DOOR_H],
  [Z.doorR - 3, VIEW.top - 8, 3, DOOR_H],
  [Z.doorR + 1, VIEW.top - 8, 3, DOOR_H],
]);
const DOOR_BUTTON = pxPath([
  [Z.doorL + 30, GLASS_BOTTOM + 8, 8, 9],
  [Z.doorR - 40, GLASS_BOTTOM + 8, 8, 9],
]);
const DOOR_BUTTON_RING = pxPath([
  [Z.doorL + 28, GLASS_BOTTOM + 6, 12, 2],
  [Z.doorL + 28, GLASS_BOTTOM + 17, 12, 2],
  [Z.doorR - 42, GLASS_BOTTOM + 6, 12, 2],
  [Z.doorR - 42, GLASS_BOTTOM + 17, 12, 2],
]);
const DOOR_RELEASE = pxPath([
  [Z.doorL + 26, VIEW.top - 4, 15, 9],
  [Z.doorR - 42, VIEW.top - 4, 15, 9],
]);
/**
 * The kasownik by each door, orange, at hand height. There is no single object
 * that says "Polish local train" faster, and there was not one on board.
 */
const KASOWNIK = pxPath([
  [Z.doorL + 52, GLASS_BOTTOM + 4, 14, 20],
  [Z.doorR - 66, GLASS_BOTTOM + 4, 14, 20],
]);
const KASOWNIK_SLOT = pxPath([
  [Z.doorL + 55, GLASS_BOTTOM + 8, 8, 2],
  [Z.doorR - 63, GLASS_BOTTOM + 8, 8, 2],
]);
const KASOWNIK_LED = pxPath([
  [Z.doorL + 55, GLASS_BOTTOM + 13, 3, 3],
  [Z.doorR - 63, GLASS_BOTTOM + 13, 3, 3],
]);
const INTERCOM = pxPath([[Z.doorL + 72, GLASS_BOTTOM + 4, 10, 14]]);
const FIRST_AID = pxPath([[Z.doorR - 86, GLASS_TOP + 6, 16, 12]]);
const FIRST_AID_MARK = pxPath([
  [Z.doorR - 80, GLASS_TOP + 8, 4, 8],
  [Z.doorR - 83, GLASS_TOP + 11, 10, 2],
]);
const EXTINGUISHER = pxPath([
  [Z.wc + 36, FLOOR - 26, 11, 22],
  [Z.wc + 38, FLOOR - 29, 7, 3],
]);

/** The ends: the accessible toilet at one, the gangway door at the other. */
const WC_DOOR = pxPath([[Z.wc - 32, VIEW.top - 12, 64, FLOOR - VIEW.top + 12]]);
const WC_FRAME = pxPath([
  [Z.wc - 34, VIEW.top - 14, 68, 2],
  [Z.wc - 34, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
  [Z.wc + 32, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
]);
const WC_SIGN = pxPath([[Z.wc - 8, VIEW.top + 4, 16, 16]]);
const WC_MARK = pxPath([
  [Z.wc - 2, VIEW.top + 6, 4, 4],
  [Z.wc - 4, VIEW.top + 11, 8, 5],
  [Z.wc - 6, VIEW.top + 16, 5, 2],
]);
const WC_BUTTON = pxPath([[Z.wc + 20, GLASS_BOTTOM + 6, 8, 8]]);
const END_WALL = pxPath([[Z.end, CANT, W - Z.end, FLOOR - CANT]]);
const END_DOOR = pxPath([[Z.end + 14, VIEW.top - 12, 54, FLOOR - VIEW.top + 12]]);
const END_GLASS = pxPath([[Z.end + 24, VIEW.top - 2, 34, VIEW.bottom - VIEW.top]]);
const END_FRAME = pxPath([
  [Z.end + 12, VIEW.top - 14, 58, 2],
  [Z.end + 12, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
  [Z.end + 68, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
]);
/** Luggage stacked against the end bulkhead, because there always is some. */
const LUGGAGE = pxPath([
  [Z.end + 76, FLOOR - 30, 22, 30],
  [Z.end + 78, FLOOR - 33, 18, 3],
  [Z.end + 100, FLOOR - 20, 16, 20],
]);
const LUGGAGE_TRIM = pxPath([
  [Z.end + 76, FLOOR - 22, 22, 2],
  [Z.end + 100, FLOOR - 14, 16, 2],
]);

/* ------------------------------------------------------------ the map ----- */

/**
 * The line. `scene` is where getting off actually puts you; `spawnX` is the
 * spot on that scene's ground you land on — by the doors, by the steps, at the
 * bottom of the Stocznia stair. The route map reads both, so opening a new
 * station is one line here and zero lines there.
 */
export const LINE = [
  { id: "gdansk", name: "GDANSK GL.", scene: null as string | null, spawnX: 0 },
  { id: "stocznia", name: "STOCZNIA", scene: "elektrykow" as string | null, spawnX: 120 },
  { id: "politechnika", name: "POLITECHNIKA", scene: null as string | null, spawnX: 0 },
  { id: "oliwa", name: "OLIWA", scene: "district" as string | null, spawnX: 250 },
  { id: "przymorze", name: "PRZYMORZE-UNIW.", scene: "station" as string | null, spawnX: 520 },
  { id: "zaspa", name: "ZASPA", scene: null as string | null, spawnX: 0 },
  { id: "sopot", name: "SOPOT", scene: null as string | null, spawnX: 0 },
  { id: "gdynia", name: "GDYNIA GL.", scene: null as string | null, spawnX: 0 },
] as const;

const MAP_BOX: Rect = [Z.map - 60, GLASS_TOP + 4, 116, 40];
const MAP_SET = bevelPaths([MAP_BOX]);
const MAP_LINE = pxPath([[MAP_BOX[0] + 8, MAP_BOX[1] + 22, MAP_BOX[2] - 16, 2]]);
const MAP_TICKS = pxPath(
  LINE.map((_, i) => [MAP_BOX[0] + 10 + i * 13, MAP_BOX[1] + 18, 2, 10] as Rect),
);
const MAP_HERE = pxPath([
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 16, 6, 2],
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 26, 6, 2],
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 16, 2, 12],
  [MAP_BOX[0] + 12 + 4 * 13, MAP_BOX[1] + 16, 2, 12],
]);
const MAP_AHEAD = (toward: TrainState["toward"]) =>
  pxPath([
    toward === "gdynia"
      ? [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 22, MAP_BOX[2] - 16 - 4 * 13, 2]
      : [MAP_BOX[0] + 8, MAP_BOX[1] + 22, 4 * 13, 2],
  ] as Rect[]);
const TIMETABLE = pxPath([[Z.map + 62, GLASS_BOTTOM + 6, 34, 26]]);
const TIMETABLE_ROWS = pxPath(repeat(6, 4, [Z.map + 65, GLASS_BOTTOM + 10, 28, 2] as Rect));
const POSTER = pxPath([[Z.bin + 26, GLASS_BOTTOM + 4, 46, 30]]);
const POSTER_ART = pxPath([
  [Z.bin + 30, GLASS_BOTTOM + 8, 38, 14],
  [Z.bin + 30, GLASS_BOTTOM + 24, 24, 3],
  [Z.bin + 30, GLASS_BOTTOM + 28, 16, 2],
]);

/** The interior display, hung off the ceiling over the door. */
const CIP_BOX: Rect = [Z.doorL + 70, CEIL_MID_BOT - 4, 130, 16];
const CIP_SCREEN = pxPath([[CIP_BOX[0] + 3, CIP_BOX[1] + 3, CIP_BOX[2] - 6, CIP_BOX[3] - 6]]);
const CIP_GRID = pxPath(repeat(31, 4, [CIP_BOX[0] + 5, CIP_BOX[1] + 5, 1, 7] as Rect));
const CIP_MOUNT = pxPath([
  [CIP_BOX[0] + 20, CEIL_MID_BOT - 8, 3, 4],
  [CIP_BOX[0] + CIP_BOX[2] - 23, CEIL_MID_BOT - 8, 3, 4],
]);

/* ------------------------------------------------------- loose furniture --- */

const BIN = pxPath([
  [Z.bin, FLOOR - 24, 22, 24],
  [Z.bin - 2, FLOOR - 27, 26, 3],
]);
const BIN_SLOT = pxPath([[Z.bin + 4, FLOOR - 25, 14, 2]]);
const HAMMER = pxPath([
  [Z.bay[3] + 130, GLASS_BOTTOM + 6, 11, 7],
  [Z.bay[3] + 133, GLASS_BOTTOM + 8, 5, 3],
]);
const TIPUPS = pxPath([
  [Z.mpb, SEAT_TOP - 5, 34, 5],
  [Z.mpb + 40, SEAT_TOP - 5, 34, 5],
  [Z.mpb + 2, SEAT_TOP, 4, 14],
  [Z.mpb + 42, SEAT_TOP, 4, 14],
]);
const MPB_RAIL = pxPath([
  [Z.mpb - 6, GLASS_BOTTOM + 4, 90, 4],
  [Z.mpb - 6, GLASS_BOTTOM + 4, 4, 20],
  [Z.mpb + 80, GLASS_BOTTOM + 4, 4, 20],
]);
/** Somebody's bike, leaning on the rail. A 0.68 m wheel is 26 px now. */
const BIKE_WHEELS = pxPath([
  ...[Z.mpb + 8, Z.mpb + 60].flatMap(
    (cx) =>
      [
        [cx - 4, FLOOR - 27, 9, 2],
        [cx - 8, FLOOR - 25, 3, 6],
        [cx + 6, FLOOR - 25, 3, 6],
        [cx - 10, FLOOR - 19, 2, 8],
        [cx + 8, FLOOR - 19, 2, 8],
        [cx - 8, FLOOR - 11, 3, 6],
        [cx + 6, FLOOR - 11, 3, 6],
        [cx - 4, FLOOR - 5, 9, 2],
      ] as Rect[],
  ),
]);
const BIKE_FRAME = pxPath([
  [Z.mpb + 12, FLOOR - 23, 46, 3],
  [Z.mpb + 16, FLOOR - 20, 3, 14],
  [Z.mpb + 42, FLOOR - 22, 3, 16],
  [Z.mpb + 54, FLOOR - 31, 3, 9],
  [Z.mpb + 50, FLOOR - 33, 11, 3],
  [Z.mpb + 20, FLOOR - 28, 13, 3],
]);
const FLOOR_BAG = pxPath([
  [Z.bay[1] + 130, FLOOR - 16, 16, 16],
  [Z.bay[1] + 133, FLOOR - 19, 10, 3],
]);
const FLOOR_LITTER = pxPath([
  [Z.bay[2] + 150, FLOOR + 6, 5, 4],
  [Z.map + 150, FLOOR + 14, 7, 2],
]);

/* --------------------------------------------------------------- floor ---- */

/**
 * Thirty pixels of it, seen from above and receding toward the player. The
 * bands do the perspective: the strip against the wall is darkest because it is
 * in the shadow of the seats, the aisle is worn pale down its centre where
 * everyone walks, and the near edge darkens again as it leaves the light.
 */
const FLOOR_BAND = pxPath([[0, FLOOR, W, FRAME_H - FLOOR]]);
const FLOOR_UNDERSEAT = pxPath([[0, FLOOR, W, 5]]);
const AISLE_WEAR = pxPath([[0, FLOOR + 8, W, 11]]);
const FLOOR_NEAR = pxPath([[0, FRAME_H - 5, W, 5]]);
const FLOOR_JOINTS = pxPath(repeat(Math.ceil(W / 76), 76, [0, FLOOR, 1, FRAME_H - FLOOR] as Rect));
const FLOOR_MPB = pxPath([[Z.mpb - 8, FLOOR + 2, 96, 7]]);
const FLOOR_DOORMAT = pxPath([
  [Z.doorL - m(1.3) / 2, FLOOR, m(1.3), 4],
  [Z.doorR - m(1.3) / 2, FLOOR, m(1.3), 4],
]);
const FLOOR_SHEEN = pxPath([[0, FLOOR + 5, W, 2]]);
/**
 * The pools of daylight the windows throw. Parallel, because four pools at one
 * angle say one sun a long way off and four at different angles say four lamps
 * in the ceiling. They go out together when a bridge goes over.
 */
const LIGHT_POOLS = pxPath(
  WINDOWS.flatMap(([x, , w]) => {
    const out: Rect[] = [];
    for (let i = 0; i < 10; i++) out.push([x + 14 + i * 3, FLOOR + i * 3, w - 22, 3]);
    return out.filter((r) => r[1] < FRAME_H);
  }),
);
const WALL_WASH = pxPath([
  [0, GLASS_BOTTOM, W, 12],
  ...BAYS.flatMap((b) => b.headrest.map(([hx, hy, hw]) => [hx, hy, hw, 3] as Rect)),
]);

const RACK_AO = aoPaths([[0, RACK_Y + RACK_H, W]]);
const SEAT_CONTACT = contactPaths(BAYS.map((_, i) => [Z.bay[i], 122, FLOOR] as const));
const BIN_CONTACT = contactPaths([[Z.bin - 2, 26, FLOOR] as const]);
const BIKE_CONTACT = contactPaths([[Z.mpb - 4, 84, FLOOR] as const]);
const LUGGAGE_CONTACT = contactPaths([[Z.end + 76, 40, FLOOR] as const]);
const HEATER_AO = aoPaths(HEATER_SPANS.map(([x, gy, w]) => [x, gy + 14, w] as const));

/* ================================================================== *
 * the other passengers
 * ================================================================== */

/**
 * People, at last, at the same key as the player: a standing figure is 66 px
 * against the player's 67. Under the old stretch a standing passenger would
 * have been 102 px and the two side by side would have given the whole trick
 * away, so the scene had none — which is why an allegedly crowded commuter
 * train read as an empty room with hats on the seats.
 *
 * Four densities, precomputed, indexed by TrainState.crowd, which was carried in
 * the state and read by the artKey and used by absolutely nothing.
 */
type Riders = {
  heads: Rect[];
  hair: Rect[];
  bodies: Rect[];
  coats: Rect[];
  legs: Rect[];
  arms: Rect[];
  far: Rect[];
  glow: Rect[];
};

const STAND_X = [
  Z.doorL + 62,
  Z.mpb + 96,
  Z.bay[0] + 150,
  Z.bay[1] + 152,
  Z.bay[2] + 148,
  Z.doorR - 92,
] as const;

function ridersAt(threshold: number): Riders {
  const r: Riders = {
    heads: [],
    hair: [],
    bodies: [],
    coats: [],
    legs: [],
    arms: [],
    far: [],
    glow: [],
  };

  /* seated: heads over the near backs, backs of heads over the far ones */
  BAYS.forEach((b, k) => {
    b.headrest.forEach(([hx, , hw], j) => {
      const seed = k * 7 + j * 31;
      if (hash(seed) < threshold) return;
      const cx = hx + Math.round(hw / 2) + (hash(seed + 3) > 0.5 ? 2 : -2);
      const top = HEAD_SEATED + (hash(seed + 5) > 0.6 ? 1 : 0);
      r.heads.push([cx - 4, top, 9, 9]);
      r.hair.push([cx - 5, top - 1, 11, 4]);
      if (hash(seed + 9) > 0.55) r.hair.push([cx - 6, top + 2, 3, 5], [cx + 4, top + 2, 3, 5]);
      r.bodies.push([cx - 8, top + 9, 17, Math.max(2, SEAT_BACK - top - 8)]);
      if (hash(seed + 11) > 0.55) r.glow.push([cx + 4, top + 8, 4, 4]);
    });
    b.far.forEach(([fx, fy, fw], j) => {
      const seed = k * 13 + j * 47 + 5;
      if (hash(seed) < threshold + 0.1) return;
      r.far.push([fx + Math.round(fw / 2) - 4, fy - 6, 9, 7]);
    });
  });

  /* standing: in the aisle, one hand up on a pole or a strap */
  STAND_X.forEach((x, i) => {
    if (hash(x + i * 17) < threshold + 0.18) return;
    const top = HEAD_STANDING + (hash(x) > 0.5 ? 1 : 0);
    const lean = hash(x + 5) > 0.5 ? 1 : -1;
    r.heads.push([x - 4, top, 9, 9]);
    r.hair.push([x - 5, top - 1, 11, 4], [x - 5, top + 3, 2, 4], [x + 4, top + 3, 2, 4]);
    r.coats.push([x - 8, top + 9, 17, 24]);
    r.bodies.push([x - 7, top + 33, 15, 6]);
    r.legs.push([x - 6, top + 39, 5, FLOOR - top - 39], [x + 2, top + 39, 5, FLOOR - top - 39]);
    /* the raised arm, which is the reason anyone believes they are standing */
    r.arms.push([x + lean * 8, top + 10, 3, 14], [x + lean * 8, top + 8, 3, 4]);
    if (hash(x + 9) > 0.6) r.glow.push([x - 9, top + 18, 5, 6]);
  });
  return r;
}

const RIDERS = [1.01, 0.7, 0.44, 0.22, 0.0].map((t) => {
  const r = ridersAt(t);
  return {
    heads: pxPath(r.heads),
    hair: pxPath(r.hair),
    bodies: pxPath(r.bodies),
    coats: pxPath(r.coats),
    legs: pxPath(r.legs),
    arms: pxPath(r.arms),
    far: pxPath(r.far),
    glow: pxPath(r.glow),
  };
});

/* ================================================================== *
 * the planes
 * ================================================================== */

function TheView({ ph, lit, dir }: { ph: Ph; lit: boolean; dir: 1 | -1 }) {
  const mirror = ph === "night" ? 0.3 : ph === "dusk" ? 0.16 : 0.06;
  return (
    <g>
      <defs>
        <clipPath id="train-glass">
          <path d={pxPath(ALL_GLASS)} />
        </clipPath>
      </defs>
      <g clipPath="url(#train-glass)">
        <TrainWindowView ph={ph} width={W} dir={dir} />
        {lit ? (
          <>
            <path d={REFLECT_SEATS} fill={K.moquetteHi} opacity={mirror * 0.7} />
            <path d={REFLECT_COVE} fill={K.led} opacity={mirror} />
          </>
        ) : null}
      </g>
    </g>
  );
}

/** The ceiling and the far wall. */
function Saloon({ ph, s }: { ph: Ph; s: TrainState }) {
  const night = ph === "night";
  const panel = PANEL[ph];
  const frame = FRAME[ph];
  const lit = s.lights;
  return (
    <g>
      <SharedDefs />

      {/* ---- the ceiling, seen from below --------------------------------- */}
      <path d={CEILING} fill={panel.mid} />
      <path d={CEIL_PANEL} fill={lit ? K.ceiling : panel.base} opacity={night && !lit ? 0.6 : 1} />
      {lit ? <path d={COVE_WASH} fill={K.led} opacity={0.16} /> : null}
      <path d={CEIL_SLOPES} fill={panel.lo} opacity={0.4} />
      <path d={CEIL_JOINTS} fill={panel.lo} opacity={0.35} />
      <path d={CEIL_VENTS} fill={frame.lo} opacity={0.7} />
      <path d={CEIL_VENT_SLATS} fill={frame.deep} opacity={0.5} />
      <path d={SPEAKERS} fill={frame.mid} />
      <path d={DOMES} fill="#2b3138" />
      <path d={COVE_NEAR} fill={lit ? K.led : panel.lo} />
      <path d={COVE_FAR} fill={lit ? K.led : panel.lo} />
      {lit ? (
        <>
          <path d={COVE_NEAR} fill="#ffffff" opacity={0.3} />
          <path d={COVE_FAR} fill="#ffffff" opacity={0.3} />
        </>
      ) : null}
      <path d={CANT_RAIL} fill={panel.lo} />

      {/* the display, hung off the ceiling over the door */}
      <path d={CIP_MOUNT} fill={frame.lo} />
      <path d={pxPath([CIP_BOX])} fill="#23262b" />
      <path d={CIP_SCREEN} fill="#0d0f12" />
      <g transform={`translate(${CIP_BOX[0] + 7} ${CIP_BOX[1] + 6})`}>
        <path
          d={textPath(s.toward === "gdynia" ? "NEXT: ZASPA" : "NEXT: OLIWA", 0, 0)}
          fill={K.ledAmber}
        />
      </g>
      <path d={CIP_GRID} fill="#0d0f12" opacity={0.4} />

      {/* ---- the far wall -------------------------------------------------- */}
      <path d={WALL_UPPER} fill={panel.base} />
      <path d={PIERS} fill={panel.base} />
      <path d={PIERS} fill={dth("n", "06")} opacity={0.25} />
      <path d={WALL_LOWER} fill={panel.base} />
      <path d={WALL_LOWER} fill={dth("n", "06")} opacity={0.4} />
      <path d={WALL_JOINTS} fill={panel.lo} opacity={0.45} />
      <path d={SKIRT} fill={panel.lo} />
      <path d={HOOKS} fill={frame.mid} />
      <path d={SOCKETS} fill={panel.hi} />

      <AOSet set={HEATER_AO} op={0.3} />
      <path d={HEATER} fill={K.grille} opacity={night ? 0.5 : 0.8} />
      <path d={HEATER_SLATS} fill={panel.deep} opacity={0.55} />

      <AOSet set={RACK_AO} op={0.4} />
      <path d={RACK_BAGS} fill={frame.lo} opacity={0.9} />
      <path d={RACK} fill={frame.base} />
      <path d={RACK_RAIL} fill={K.pole} opacity={0.75} />

      {/* the glazing */}
      <path d={BLINDS} fill={panel.hi} />
      <path d={WINDOW_FRAMES} fill={frame.base} />
      <path d={MULLIONS} fill={frame.base} />
      <path d={WINDOW_SEAL} fill={frame.deep} opacity={0.85} />
      <path d={SILLS} fill={panel.hi} />
      <path d={HOPPERS} fill={frame.mid} opacity={0.8} />
      <path d={GLASS_SHEEN} fill="#ffffff" opacity={night ? 0.05 : 0.1} />
      <path d={GLASS_SHEEN_2} fill="#ffffff" opacity={night ? 0.03 : 0.07} />
      <path d={GLASS_DECAL} fill={K.white} opacity={0.75} />
      <path d={GLASS_DECAL_MARK} fill={K.red} />

      {/* the ends of the carriage */}
      <path d={WC_DOOR} fill={panel.mid} />
      <path d={WC_FRAME} fill={frame.base} />
      <path d={WC_SIGN} fill={K.access} />
      <path d={WC_MARK} fill={K.white} />
      <path d={WC_BUTTON} fill={K.access} opacity={0.8} />
      <path d={END_WALL} fill={panel.mid} />
      <path d={END_DOOR} fill={panel.base} />
      <path d={END_GLASS} fill={night ? "#14171d" : "#2a3038"} />
      <path d={END_FRAME} fill={frame.base} />

      {/* the route map, the timetable, the poster */}
      <Bev set={MAP_SET} mat={panel} />
      <path d={pxPath([[MAP_BOX[0] + 4, MAP_BOX[1] + 4, MAP_BOX[2] - 8, 8]])} fill={K.signBlue} />
      <g transform={`translate(${MAP_BOX[0] + 7} ${MAP_BOX[1] + 6})`}>
        <path d={textPath("SKM TROJMIASTO", 0, 0)} fill={K.white} opacity={0.9} />
      </g>
      <path d={MAP_LINE} fill={K.signBlue} opacity={0.35} />
      <path d={MAP_AHEAD(s.toward)} fill={K.signBlue} />
      <path d={MAP_TICKS} fill={K.signBlue} opacity={0.7} />
      <path d={MAP_HERE} fill={K.red} />
      <g transform={`translate(${MAP_BOX[0] + 8} ${MAP_BOX[1] + 32})`}>
        <path d={textPath("PRZYMORZE", 0, 0)} fill={panel.deep} opacity={0.8} />
      </g>
      <path d={TIMETABLE} fill={K.white} opacity={0.85} />
      <path d={TIMETABLE_ROWS} fill={panel.deep} opacity={0.4} />
      <path d={POSTER} fill={K.white} opacity={0.9} />
      <path d={POSTER_ART} fill={K.signBlue} opacity={0.55} />

      {/* signage and safety kit */}
      <path d={PRIORITY_SIGN} fill={K.access} />
      <path d={PRIORITY_MARK} fill={K.white} />
      <path d={FIRST_AID} fill={K.green} opacity={0.9} />
      <path d={FIRST_AID_MARK} fill={K.white} />
      <path d={HAMMER} fill={K.red} />
      <path d={EXTINGUISHER} fill={K.red} opacity={0.9} />
    </g>
  );
}

/**
 * The two lights, fighting. The warm strip along the window wall and the cold
 * LED fill are on inverse animations that cross over in a tenth of a second,
 * which is what going under the Kołobrzeska bridge does to a carriage. Nothing
 * else moves during it: the room changes colour and every object in it holds
 * still, exactly as it does in life.
 */
function DaylightWash({ ph, lit }: { ph: Ph; lit: boolean }) {
  if (ph === "night") return null;
  const peak = ph === "day" ? 0.22 : 0.3;
  return (
    <g>
      <path d={WALL_WASH} fill={WASH[ph]} opacity={peak}>
        <animate
          attributeName="opacity"
          values={BRIDGE.daylight
            .split(";")
            .map((v) => Number(v) * peak)
            .join(";")}
          keyTimes={BRIDGE.keyTimes}
          dur={BRIDGE.dur}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>
      {lit ? (
        <path d={WALL_WASH} fill={K.led} opacity={0}>
          <animate
            attributeName="opacity"
            values={BRIDGE.led
              .split(";")
              .map((v) => Number(v) * 0.18)
              .join(";")}
            keyTimes={BRIDGE.keyTimes}
            dur={BRIDGE.dur}
            repeatCount="indefinite"
            calcMode="linear"
          />
        </path>
      ) : null}
    </g>
  );
}

function Fittings({ ph, s }: { ph: Ph; s: TrainState }) {
  const frame = FRAME[ph];
  const panel = PANEL[ph];
  return (
    <g>
      {/* seats: far backs, then tables, then the near pairs part by part */}
      <Bev set={SEATS_FAR} mat={{ ...SEAT, base: SEAT.mid }} />
      <path d={FAR_HI} fill={SEAT.hi} opacity={0.5} />
      <path d={TABLES} fill={panel.base} />
      <path d={TABLE_TOPS} fill={K.white} opacity={0.85} />
      <path d={CUP_LID} fill="#5c4a3a" />
      <Contact set={SEAT_CONTACT} op={0.5} />
      <path d={SEAT_LEGS} fill={frame.mid} />
      <Bev set={SEATS_NEAR} mat={SEAT} />
      <Bev set={SEATS_NEAR_PRI} mat={SEAT_PRIORITY} />
      <path d={INSERTS} fill={K.insert} />
      <path d={INSERTS_PRI} fill={SEAT_PRIORITY.lo} />
      <path d={MOQUETTE_WEAVE} fill={K.fleck} opacity={0.35} />
      <path d={INSERT_WEAVE} fill={K.fleck} opacity={0.22} />
      <path d={HEADRESTS} fill={SEAT.mid} />
      <path d={HEADRESTS_PRI} fill={SEAT_PRIORITY.mid} />
      <path d={HEAD_HI} fill={K.moquetteHi} opacity={0.6} />
      <path d={CUSHIONS} fill={SEAT.base} />
      <path d={CUSHION_LIP} fill={SEAT.deep} opacity={0.7} />
      <path d={ARMRESTS} fill={frame.base} />
      <path d={SEAT_GRABS} fill={K.pole} />
      <path d={STUB_RAILS} fill={K.pole} opacity={0.85} />

      {/* poles */}
      <path d={POLES} fill={K.pole} />
      <path d={POLE_HI} fill={K.poleHi} />
      <path d={POLE_COLLAR} fill={frame.mid} />

      {/* the multipurpose bay */}
      <path d={MPB_RAIL} fill={K.pole} opacity={0.85} />
      <path d={TIPUPS} fill={SEAT.mid} />
      <Contact set={BIKE_CONTACT} op={0.45} />
      <path d={BIKE_WHEELS} fill="#2a2d33" />
      <path d={BIKE_FRAME} fill="#3f6f52" />

      {/* the doors and everything bolted around them */}
      <Bev set={DOORS} mat={panel} />
      <path d={DOOR_SPLIT} fill={frame.deep} />
      <path d={DOOR_EDGE} fill={K.nosing} opacity={0.9} />
      <path d={DOOR_HEAD} fill={frame.lo} />
      <path d={DOOR_RELEASE} fill={K.red} opacity={0.85} />
      <path d={DOOR_BUTTON_RING} fill={frame.deep} />
      <path d={DOOR_BUTTON} fill="#4a5a4e" />
      <path d={DOOR_NOSING} fill={K.nosing} />
      <path d={KASOWNIK} fill={K.kasownik} />
      <path d={KASOWNIK_SLOT} fill="#15171b" />
      <path d={KASOWNIK_LED} fill={K.green} />
      <path d={INTERCOM} fill={frame.mid} />

      {/* the bin, the bags, the luggage against the end wall */}
      <Contact set={BIN_CONTACT} op={0.4} />
      <path d={BIN} fill={frame.mid} />
      <path d={BIN_SLOT} fill="#15171b" />
      <path d={FLOOR_BAG} fill={K.case} />
      <Contact set={LUGGAGE_CONTACT} op={0.4} />
      <path d={LUGGAGE} fill={K.case} />
      <path d={LUGGAGE_TRIM} fill={frame.mid} opacity={0.7} />

      {/* the daylight lands here rather than in the wall plane, because what it
          most has to fall on is the seats, and the seats are painted after */}
      <DaylightWash ph={ph} lit={s.lights} />
    </g>
  );
}

function Passengers({ ph, s }: { ph: Ph; s: TrainState }) {
  const r = RIDERS[Math.max(0, Math.min(4, Math.round(s.crowd)))];
  const night = ph === "night";
  return (
    <g>
      <path d={r.far} fill="#2f3740" opacity={0.75} />
      <path d={r.legs} fill={night ? "#242a31" : "#2f3742"} />
      <path d={r.bodies} fill={night ? "#2b323b" : "#3a434e"} />
      <path d={r.coats} fill={night ? "#33404e" : "#455568"} />
      <path d={r.arms} fill={night ? "#33404e" : "#455568"} />
      <path d={r.heads} fill={night ? K.skinNight : K.skin} />
      <path d={r.hair} fill="#2b2521" />
      <path d={r.glow} fill={K.ledAmber} opacity={night ? 0.8 : 0.35} />
    </g>
  );
}

function Floor({ ph, s }: { ph: Ph; s: TrainState }) {
  const night = ph === "night";
  return (
    <g>
      {/* Grey speckled lino. The floor of a lit carriage is lighter than the
          seats, not darker — it used to be #4a4d52 and read as a pit. */}
      <path d={FLOOR_BAND} fill={night ? "#4f4c48" : K.floorBase} />
      <path d={FLOOR_BAND} fill={dth("n", "12")} opacity={0.32} />
      <path d={FLOOR_UNDERSEAT} fill="#000" opacity={0.16} />
      <path d={FLOOR_JOINTS} fill="#000" opacity={0.07} />
      <path d={AISLE_WEAR} fill={dth("n", "12")} opacity={0.3} />
      <path d={FLOOR_NEAR} fill="#000" opacity={0.12} />
      <path d={FLOOR_MPB} fill={K.access} opacity={0.4} />
      <path d={FLOOR_DOORMAT} fill={K.nosing} opacity={0.25} />
      {s.lights ? <path d={FLOOR_SHEEN} fill={K.led} opacity={0.1} /> : null}
      <path d={FLOOR_LITTER} fill={K.white} opacity={0.5} />

      {ph !== "night" ? (
        <path d={LIGHT_POOLS} fill={WASH[ph]} opacity={ph === "day" ? 0.26 : 0.19}>
          <animate
            attributeName="opacity"
            values={BRIDGE.daylight
              .split(";")
              .map((v) => Number(v) * (ph === "day" ? 0.26 : 0.19))
              .join(";")}
            keyTimes={BRIDGE.keyTimes}
            dur={BRIDGE.dur}
            repeatCount="indefinite"
            calcMode="linear"
          />
        </path>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * the scene
 * ================================================================== */

function TrainInterior({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = trainState(world);
  return (
    <LayeredScene
      farBackground={<TheView ph={ph} lit={s.lights} dir={s.toward === "gdynia" ? 1 : -1} />}
      middleBackground={<Saloon ph={ph} s={s} />}
      ground={<Floor ph={ph} s={s} />}
      staticObjects={<Fittings ph={ph} s={s} />}
      gameplayObjects={<Passengers ph={ph} s={s} />}
      parallax={{ farBackground: 1, middleBackground: 1 }}
    />
  );
}

/* ================================================================== *
 * the near side of the carriage
 * ================================================================== */

/**
 * What is in front of the player, and the whole reason the carriage reads as a
 * place you are standing in rather than a wall you are standing against.
 *
 * There were two objects here. There are six now, and they are on the near side
 * of the aisle, which means they are *bigger* than their opposite numbers
 * across the carriage rather than the same size drawn darker: the near seat back
 * is 1.35× the far one, the near pole is a pixel wider, and the near rack is a
 * band along the very top of the frame. Everything is cut off by an edge,
 * because nothing on the near side of a carriage fits in the view.
 */
const NEAR_SCALE = 1.35;
const NEAR_SEAT_TOP = FRAME_H - Math.round((FLOOR - SEAT_BACK) * NEAR_SCALE * 0.62);
const FRONT_SEAT: Rect[] = [
  [Z.bay[1] + 30, NEAR_SEAT_TOP + 8, 150, FRAME_H - NEAR_SEAT_TOP],
  [Z.bay[1] + 27, NEAR_SEAT_TOP, 156, 9],
];
const FRONT_SEAT_GRAB: Rect[] = [[Z.bay[1] + 150, NEAR_SEAT_TOP - 5, 14, 6]];
const FRONT_POLE: Rect[] = [[Z.bay[2] + 60, 0, 7, FRAME_H]];
/** The near luggage rack along the top edge, and its underside in shadow. */
const FRONT_RACK: Rect[] = [
  [0, 0, W, 5],
  [0, 5, W, 2],
];
/** The near handrail the straps hang from, just under it. */
const FRONT_RAIL: Rect[] = [[0, 9, W, 4]];
const FRONT_SET = bevelPaths(FRONT_SEAT);
const FRONT_WEAVE = pxPath(FRONT_SEAT.flatMap((r) => weave(r, 5)));
const VIGNETTE = vignettePaths(W, FRAME_H);
const NEAR_STRAP_X = [
  Z.map + 40,
  Z.bay[0] + 60,
  Z.bay[1] + 200,
  Z.bay[3] + 40,
  Z.doorR - 120,
] as const;

function TrainFront({ phase }: { phase: string }) {
  const ph = toPhase(phase);
  const frame = FRAME[ph];
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} ${FRAME_H}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <path d={pxPath(FRONT_RACK)} fill={frame.lo} />
      <path d={pxPath(FRONT_RAIL)} fill={K.pole} opacity={0.7} />
      <Bev set={FRONT_SET} mat={{ ...SEAT, base: SEAT.lo, hi: SEAT.mid }} />
      <path d={FRONT_WEAVE} fill={K.fleck} opacity={0.18} />
      <path d={pxPath(FRONT_SEAT_GRAB)} fill={K.pole} opacity={0.8} />
      <path d={pxPath(FRONT_POLE)} fill={K.pole} opacity={0.85} />
      <path d={pxPath(FRONT_POLE)} fill="#000" opacity={0.2} />
      <Vignette set={VIGNETTE} strength={ph === "night" ? 1 : 0.6} />
    </svg>
  );
}

/**
 * The carriage's own movement.
 *
 * The rocking is applied to the straps and to nothing else. Rocking the whole
 * interior would look better for about two seconds and then break every hitbox
 * in the scene, because the runtime's collision is in scene coordinates and does
 * not know the artwork has moved. Straps are what a passenger actually watches
 * to know a train is moving, and they cost one animated group each.
 *
 * Two ranks of them now, which is the point of having a near side at all: the
 * near straps are twice the size of the far ones and swing on a longer period,
 * and two periods that do not divide into each other read as a carriage on
 * bogies rather than a room on a swing.
 */
function TrainEffects({
  world,
  phase,
  scale,
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
  const s = trainState(world);
  const ph = toPhase(phase);
  const strapTop = RACK_Y + RACK_H + 1;
  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${FRAME_H}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        {/* far rank: off the rack rail, hanging in front of the glass */}
        {FAR_STRAP_X.map((x, i) => (
          <path
            key={`far${x}`}
            d={pxPath([
              [x, strapTop, 2, 12],
              [x - 2, strapTop + 12, 6, 6],
              [x - 1, strapTop + 14, 4, 3],
            ])}
            fill={K.pole}
            opacity={0.8}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`-2 ${x} ${strapTop};2 ${x} ${strapTop};-2 ${x} ${strapTop}`}
              dur={`${2.4 + i * 0.19}s`}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </path>
        ))}
        {/* near rank: off the near rail at the top of the frame, twice the size */}
        {NEAR_STRAP_X.map((x, i) => (
          <path
            key={`near${x}`}
            d={pxPath([
              [x, 13, 3, 22],
              [x - 4, 35, 11, 11],
              [x - 2, 38, 7, 5],
            ])}
            fill={K.pole}
            opacity={0.9}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`-3 ${x} 13;3 ${x} 13;-3 ${x} 13`}
              dur={`${3.1 + i * 0.23}s`}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </path>
        ))}
        {/* the cup: one pixel, fast, out of phase with everything */}
        <g>
          <path d={CUP_LID} fill="#6d5847" opacity={0.9} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 1;0 0;0 -1;0 0"
            dur="0.9s"
            repeatCount="indefinite"
            calcMode="linear"
          />
        </g>
      </svg>
      {!dialogueOpen ? <Announce scale={scale} toward={s.toward} ph={ph} /> : null}
    </>
  );
}

/** The on-board announcement, in the display's amber, every so often. */
function Announce({ scale, toward }: { scale: number; toward: TrainState["toward"]; ph: Ph }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const lines =
      toward === "gdynia"
        ? ["Następna stacja: Gdańsk Zaspa.", "Pociąg SKM do Gdyni Głównej."]
        : ["Następna stacja: Gdańsk Oliwa.", "Pociąg SKM do Gdańska Głównego."];
    let i = 0;
    let timer = 0;
    const cycle = () => {
      setText(lines[i % lines.length]);
      timer = window.setTimeout(() => {
        setText(null);
        timer = window.setTimeout(() => {
          i += 1;
          cycle();
        }, 22_000);
      }, 5200);
    };
    timer = window.setTimeout(cycle, 3400);
    return () => window.clearTimeout(timer);
  }, [toward]);
  if (!text) return null;
  return (
    <div
      className="pointer-events-none absolute right-0 left-0 flex justify-center"
      style={{ top: Math.round(8 * scale) }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: Math.max(10, Math.round(2.6 * scale)),
          letterSpacing: "0.06em",
          color: "#ffb03a",
          background: "rgba(6,8,13,0.8)",
          padding: `${Math.round(scale)}px ${Math.round(3 * scale)}px`,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export const TRAIN_SCENE: RuntimeSceneDef<WorldState> = {
  id: "train",
  width: W,
  artKey: (w, ph) => {
    const s = trainState(w);
    return [ph, s.toward, s.crowd, s.lights ? 1 : 0, s.seated ? 1 : 0].join("|");
  },
  objects: [
    {
      id: "train-exit-l",
      kind: "trainExit",
      priority: 2,
      x: Z.doorL,
      range: 30,
      to: { scene: "station", spawnX: 520 },
    },
    { id: "train-map", kind: "routemap", priority: 2, x: Z.map - 2, range: 30 },
    ...Z.bay.map((x, i) => ({
      id: `train-seat-${i + 1}`,
      kind: "sport",
      action: "sit",
      face: 1 as const,
      x: x + 60,
      range: 54,
    })),
    { id: "train-window", kind: "flavor", x: Z.bay[2] + 40, range: 60, markerY: GLASS_TOP + 10 },
    { id: "train-pole", kind: "flavor", x: Z.bay[3] - 16, range: 16 },
    { id: "train-display", kind: "flavor", x: Z.doorL + 135, range: 40, markerY: CIP_BOX[1] + 8 },
    { id: "train-bin", kind: "flavor", x: Z.bin + 11, range: 18 },
    { id: "train-hammer", kind: "flavor", x: Z.bay[3] + 136, range: 14 },
    { id: "train-kasownik", kind: "flavor", x: Z.doorL + 59, range: 20 },
    { id: "train-bike", kind: "flavor", x: Z.mpb + 36, range: 44 },
    { id: "train-timetable", kind: "flavor", x: Z.map + 79, range: 24 },
    { id: "train-poster", kind: "flavor", x: Z.bin + 49, range: 26, markerY: GLASS_BOTTOM + 6 },
    { id: "train-wc", kind: "flavor", x: Z.wc, range: 34 },
    { id: "train-luggage", kind: "flavor", x: Z.end + 88, range: 26 },
    { id: "train-gangway", kind: "flavor", x: Z.end + 41, range: 30 },
    { id: "train-exit-r", kind: "flavor", x: Z.doorR, range: 28 },
  ],
  Component: ({ world, phase }) => <TrainInterior world={world} phase={phase} />,
  darkness: () => 0,
  Foreground: (p) => <TrainFront phase={p.phase} />,
  Effects: TrainEffects,
};
