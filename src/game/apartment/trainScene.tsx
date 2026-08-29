import { useEffect, useState } from "react";
import {
  AOSet,
  aoPaths,
  Bev,
  Bicycle,
  bevelPaths,
  bicycle,
  Contact,
  contactPaths,
  dim,
  dth,
  LayeredScene,
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
  textPath,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { dayPhase, type WorldState } from "@/lib/worldState";
import { LINE } from "./stationTimetable";
import { SHADE_CYCLE, TrainWindowView, VIEW } from "./trainLandscape";
import { PASSENGERS } from "./trainPassengers";

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);

const W = 1400;
const FLOOR = 150;
const FRAME_H = 180;

const VPM_RAW = FLOOR - VIEW.bottom;
const VPM = VPM_RAW >= 26 && VPM_RAW <= 52 ? VPM_RAW : PPM;
const vm = (metres: number) => Math.round(metres * VPM);
const y = (metres: number) => FLOOR - vm(metres);

const CANT = Math.min(y(2.3), VIEW.top - 12);
const RACK_Y = CANT + 1;
const RACK_H = 4;
const GLASS_TOP = VIEW.top - 3;
const GLASS_BOTTOM = VIEW.bottom + 3;
const SEAT_BACK = y(1.15);
const SEAT_TOP = y(0.45);
const ARM_TOP = y(0.6);
const TABLE_TOP = y(0.72);

const Z = {
  wc: 46,
  doorL: 120,
  mpb: 162,
  map: 300,
  bay: [400, 620, 840, 1060] as const,
  doorR: 1280,
  bin: 1214,
  end: 1318,
} as const;

const K = {
  panel: "#dcd8ce",
  ceiling: "#e4e0d6",
  moquette: "#3f5a78",
  moquetteHi: "#54718f",
  insert: "#2f4763",
  fleck: "#7d94ac",
  shell: "#5a6068",
  shellHi: "#79808a",
  shellLo: "#3d4249",
  priority: "#6b4a72",
  priorityHi: "#87608f",
  pole: "#e8c445",
  poleHi: "#f6dc72",
  led: "#e6ecd8",
  ledAmber: "#ffb03a",
  floorBase: "#6d6a64",
  nosing: "#e8c445",
  /**
   * The partition glass.
   *
   * `K.glass[ph]` was being read and no such entry existed. It is not the
   * exterior glass of the station scenes — a saloon partition looks *into* a
   * lit carriage rather than out at the sky, so it stays dark and only picks
   * up the hour faintly, warm at dusk and nearly black at night.
   */
  glass: {
    dawn: "#2b333f",
    day: "#33404c",
    dusk: "#3a3540",
    night: "#1b2028",
  } as Record<Ph, string>,
  signBlue: "#0e3566",
  white: "#f2f2ee",
  grille: "#9a958b",
  access: "#1b4b96",
  red: "#c94040",
  green: "#3f9f5c",
  kasownik: "#e2701f",
  case: "#4a3f38",
  skin: "#a98d78",
  skinNight: "#8a7566",
  shade: "#151a20",
  mist: "#cfd8dc",
  wet: "#1b2430",
} as const;

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

export interface TrainState {
  toward: "gdansk" | "gdynia";
  crowd: number;
  seated: boolean;
  lights: boolean;
  weather: "clear" | "rain";
}

const DEFAULTS: TrainState = {
  toward: "gdynia",
  crowd: 2,
  seated: false,
  lights: true,
  weather: "clear",
};

export function trainState(world: WorldState): TrainState {
  const raw = world.train as Partial<TrainState> | undefined;
  return raw ? { ...DEFAULTS, ...raw } : DEFAULTS;
}

function boardingState(counterpart: string | undefined, hour: number): TrainState["toward"] {
  if (counterpart === "elektrykow" || counterpart === "raveclub") return "gdynia";
  if (counterpart === "district") return "gdansk";
  return hour >= 15 ? "gdynia" : "gdansk";
}

function crowdFor(hour: number): number {
  if (hour >= 6 && hour < 9) return 4;
  if (hour >= 15 && hour < 18) return 4;
  if (hour >= 9 && hour < 15) return 2;
  if (hour >= 18 && hour < 21) return 2;
  return 1;
}

const speckle = (rs: Rect[], step: number, seed: number, hit = 2): Rect[] => {
  const out: Rect[] = [];
  for (const [rx, ry, rw, rh] of rs) {
    for (let j = 0; j < rh; j += step) {
      for (let i = 0; i < rw; i += step) {
        if ((i * 7 + j * 13 + seed) % 5 < hit) out.push([rx + i, ry + j, 1, 1]);
      }
    }
  }
  return out;
};

const motif = (rs: Rect[]): Rect[] => {
  const out: Rect[] = [];
  for (const [rx, ry, rw, rh] of rs) {
    for (let j = 0; j + 1 < rh; j += 4) {
      const o = ((j / 4) | 0) % 2 ? 3 : 0;
      for (let i = o; i + 2 < rw; i += 6) {
        out.push([rx + i, ry + j, 2, 1]);
        if (i + 3 < rw) out.push([rx + i + 2, ry + j + 1, 1, 1]);
      }
    }
  }
  return out;
};

const brushedV = (rs: Rect[], step = 2): Rect[] => {
  const out: Rect[] = [];
  for (const [rx, ry, rw, rh] of rs) {
    for (let i = 1; i < rw; i += step) out.push([rx + i, ry, 1, rh]);
  }
  return out;
};

const brushedH = (rs: Rect[], step = 2): Rect[] => {
  const out: Rect[] = [];
  for (const [rx, ry, rw, rh] of rs) {
    for (let j = 1; j < rh; j += step) out.push([rx, ry + j, rw, 1]);
  }
  return out;
};

const grainH = (rs: Rect[], step: number, seed: number): Rect[] => {
  const out: Rect[] = [];
  for (const [rx, ry, rw, rh] of rs) {
    for (let j = 0; j < rh; j += step) {
      const w = 14 + ((j * 31 + seed) % 40);
      const off = (j * 53 + seed * 7) % Math.max(1, rw - w);
      out.push([rx + off, ry + j, w, 1]);
    }
  }
  return out;
};

const weave = (r: Rect, step = 4): Rect[] => {
  const [rx, ry, rw, rh] = r;
  const out: Rect[] = [];
  for (let j = 1; j < rh - 1; j += 3) {
    for (let i = ((j / 3) | 0) % 2 ? 2 : 0; i < rw - 1; i += step) out.push([rx + i, ry + j, 1, 1]);
  }
  return out;
};

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
const CEIL_SLOPE_HI = pxPath([
  [0, CEIL_MID_TOP, W, 1],
  [0, CEIL_MID_BOT + 2, W, 1],
]);
const CEIL_JOINTS = pxPath(
  repeat(Math.ceil(W / 110), 110, [54, CEIL_NEAR, 1, CEIL_FAR - CEIL_NEAR] as Rect),
);
const CEIL_JOINT_HI = pxPath(
  repeat(Math.ceil(W / 110), 110, [55, CEIL_NEAR, 1, CEIL_FAR - CEIL_NEAR] as Rect),
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
const LIGHT_STRIP = pxPath([[0, CEIL_MID_TOP + 1, W, 2]]);
const LIGHT_STRIP_GLOW = pxPath([
  [0, CEIL_MID_TOP, W, 1],
  [0, CEIL_MID_TOP + 3, W, 2],
]);
const LIGHT_JOINTS = pxPath(repeat(Math.ceil(W / 88), 88, [40, CEIL_MID_TOP + 1, 1, 2] as Rect));
const LIGHT_DEAD: Rect = [Z.bay[2] + 40, CEIL_MID_TOP + 1, 88, 2];

const AD_SPANS = [
  [170, 132],
  [330, 96],
  [470, 150],
  [660, 132],
  [830, 168],
  [1040, 120],
  [1194, 96],
] as const;
const AD_FRAMES = pxPath(AD_SPANS.map(([x, w]) => [x, CEIL_MID_TOP + 7, w, 15] as Rect));
const AD_MOUNTS = pxPath(AD_SPANS.map(([x, w]) => [x, CEIL_MID_TOP + 6, w, 1] as Rect));
const AD_SHADOW = pxPath(AD_SPANS.map(([x, w]) => [x, CEIL_MID_TOP + 22, w, 2] as Rect));
const AD_GLARE = pxPath(
  AD_SPANS.map(([x, w]) => [x + 3, CEIL_MID_TOP + 8, Math.round(w * 0.3), 2] as Rect),
);
const AD_ART = AD_SPANS.map(([x, w], i) => ({
  key: `ad${x}`,
  band: pxPath([[x + 2, CEIL_MID_TOP + 9, w - 4, 6] as Rect]),
  lines: pxPath([
    [x + 5, CEIL_MID_TOP + 16, Math.round((w - 10) * 0.7), 1] as Rect,
    [x + 5, CEIL_MID_TOP + 18, Math.round((w - 10) * 0.45), 1] as Rect,
  ]),
  tone: i % 4,
}));

const CEIL_DUCT = pxPath([
  [0, CEIL_MID_TOP + 24, W, 3],
  [0, CEIL_MID_TOP + 24, W, 1],
]);
const CEIL_GRABS = pxPath(
  [214, 386, 558, 730, 902, 1074, 1246].flatMap((x) => [
    [x, CEIL_MID_BOT - 4, 2, 6] as Rect,
    [x - 3, CEIL_MID_BOT + 2, 8, 2] as Rect,
  ]),
);
const CEIL_GRAB_HI = pxPath(
  [214, 386, 558, 730, 902, 1074, 1246].map((x) => [x - 3, CEIL_MID_BOT + 2, 8, 1] as Rect),
);

const CEIL_VENTS = pxPath(repeat(Math.ceil(W / 150), 150, [70, CEIL_MID_TOP + 5, 34, 4] as Rect));
const CEIL_VENT_SLATS = pxPath(
  repeat(Math.ceil(W / 150), 150, [72, CEIL_MID_TOP + 6, 30, 1] as Rect),
);
const VENT_DUST = pxPath(repeat(Math.ceil(W / 150), 150, [70, CEIL_MID_TOP + 9, 34, 3] as Rect));
const CEIL_PERF = pxPath(
  speckle([[0, CEIL_MID_TOP + 2, W, CEIL_MID_BOT - CEIL_MID_TOP - 4]], 4, 3, 2),
);
const CEIL_GRAIN = pxPath(grainH([[0, CEIL_NEAR + 2, W, CEIL_FAR - CEIL_NEAR - 4]], 5, 11));
const SPEAKERS = pxPath([
  [Z.map + 40, CEIL_MID_BOT - 8, 12, 5],
  [Z.bay[2] + 40, CEIL_MID_BOT - 8, 12, 5],
]);
const SPEAKER_MESH = pxPath([
  ...repeat(3, 2, [Z.map + 42, CEIL_MID_BOT - 7, 8, 1] as Rect, "y"),
  ...repeat(3, 2, [Z.bay[2] + 42, CEIL_MID_BOT - 7, 8, 1] as Rect, "y"),
]);
const DOMES = pxPath([
  [Z.bay[1] - 30, CEIL_MID_BOT - 9, 10, 6],
  [Z.bay[3] + 20, CEIL_MID_BOT - 9, 10, 6],
]);
const DOME_GLINT = pxPath([
  [Z.bay[1] - 28, CEIL_MID_BOT - 8, 3, 1],
  [Z.bay[3] + 22, CEIL_MID_BOT - 8, 3, 1],
]);
const EXIT_SIGNS = pxPath([
  [Z.doorL - 26, CEIL_MID_BOT + 2, 18, 8],
  [Z.doorR - 26, CEIL_MID_BOT + 2, 18, 8],
]);
const EXIT_MARKS = pxPath([
  [Z.doorL - 22, CEIL_MID_BOT + 4, 3, 4],
  [Z.doorL - 18, CEIL_MID_BOT + 5, 6, 1],
  [Z.doorR - 22, CEIL_MID_BOT + 4, 3, 4],
  [Z.doorR - 18, CEIL_MID_BOT + 5, 6, 1],
]);
const NO_SMOKING = pxPath([
  [Z.map + 180, CEIL_MID_BOT - 6, 7, 7],
  [Z.bay[2] + 120, CEIL_MID_BOT - 6, 7, 7],
]);
const NO_SMOKING_BAR = pxPath([
  [Z.map + 181, CEIL_MID_BOT - 3, 5, 1],
  [Z.bay[2] + 121, CEIL_MID_BOT - 3, 5, 1],
]);
const CCTV_NOTICE = pxPath([[Z.bay[1] - 44, CEIL_MID_BOT - 7, 10, 7]]);
const CANT_RAIL = pxPath([
  [0, CANT, W, 3],
  [0, CANT + 3, W, 1],
]);
const CANT_RAIL_HI = pxPath([[0, CANT, W, 1]]);

const RACK = pxPath([
  [0, RACK_Y, W, RACK_H],
  ...repeat(Math.ceil(W / 110), 110, [20, RACK_Y + RACK_H, 4, GLASS_TOP - RACK_Y - RACK_H] as Rect),
]);
const RACK_HI = pxPath([[0, RACK_Y, W, 1]]);
const RACK_UNDER = pxPath([[0, RACK_Y + RACK_H, W, 1]]);
const RACK_RAIL = pxPath([[0, RACK_Y + RACK_H, W, 2]]);
const RACK_BAGS = pxPath([
  [Z.bay[0] + 24, RACK_Y - 9, 46, 9],
  [Z.bay[0] + 30, RACK_Y - 12, 18, 3],
  [Z.bay[2] + 10, RACK_Y - 8, 34, 8],
  [Z.bay[3] + 40, RACK_Y - 7, 26, 7],
  [Z.map + 96, RACK_Y - 8, 30, 8],
]);
const RACK_BAG_TRIM = pxPath([
  [Z.bay[0] + 24, RACK_Y - 4, 46, 2],
  [Z.bay[2] + 10, RACK_Y - 4, 34, 2],
  [Z.bay[3] + 40, RACK_Y - 3, 26, 2],
  [Z.map + 96, RACK_Y - 4, 30, 2],
]);
const RACK_BAG_HI = pxPath([
  [Z.bay[0] + 24, RACK_Y - 9, 46, 1],
  [Z.bay[2] + 10, RACK_Y - 8, 34, 1],
  [Z.bay[3] + 40, RACK_Y - 7, 26, 1],
  [Z.map + 96, RACK_Y - 8, 30, 1],
]);
const FAR_STRAP_X = [Z.map + 120, Z.bay[1] - 60, Z.bay[2] + 20, Z.bay[3] + 30] as const;

const SEAT_D = 26;
const KNEE = 46;
const BAY_W = SEAT_D * 2 + KNEE;
const SEAT_FIRST = 396;
const SEAT_BAYS = 7;

const STAND = { x0: 246, x1: 392 } as const;
const LEAN = { x0: 1090, x1: 1250 } as const;
const SEAT_X = Array.from({ length: SEAT_BAYS }, (_, i) => SEAT_FIRST + i * BAY_W);

const BACK_T = 6;
const PAN_D = 20;
const PAN_H = 6;
const ARM_H = 3;
const BACK_SEGS = 4;

const WIN_W = 78;
const LEAN_WIN: Rect = [LEAN.x0 + 14, VIEW.top, 92, VIEW.bottom - VIEW.top];
const WINDOWS: Rect[] = [
  ...SEAT_X.map(
    (x) => [x + Math.round((BAY_W - WIN_W) / 2), VIEW.top, WIN_W, VIEW.bottom - VIEW.top] as Rect,
  ),
  LEAN_WIN,
];
const DOOR_LIGHTS: Rect[] = [Z.doorL, Z.doorR].map((x) => {
  const g = DOOR_GLASS_AT(x);
  return [g.x, g.y, g.w, g.h] as Rect;
});
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
const WINDOW_FRAME_HI = pxPath(
  ALL_GLASS.flatMap(
    ([x, gy, w, h]) =>
      [
        [x - 3, gy - 3, w + 6, 1],
        [x - 3, gy - 3, 1, h + 6],
      ] as Rect[],
  ),
);
const WINDOW_FRAME_LO = pxPath(
  ALL_GLASS.flatMap(
    ([x, gy, w, h]) =>
      [
        [x + w + 2, gy - 3, 1, h + 6],
        [x - 3, gy + h + 2, w + 6, 1],
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
const MULLIONS = pxPath(
  WINDOWS.filter(([, , w]) => w > 140).map(
    ([x, gy, w, h]) => [x + Math.round(w / 2) - 2, gy, 4, h] as Rect,
  ),
);
const SILLS = pxPath(WINDOWS.map(([x, , w]) => [x - 5, GLASS_BOTTOM, w + 10, 4] as Rect));
const SILL_NOSE = pxPath(WINDOWS.map(([x, , w]) => [x - 5, GLASS_BOTTOM, w + 10, 1] as Rect));
const SILL_SHADOW = pxPath(WINDOWS.map(([x, , w]) => [x - 5, GLASS_BOTTOM + 4, w + 10, 2] as Rect));
const SILL_ITEMS = pxPath([
  [WINDOWS[1][0] + 12, GLASS_BOTTOM - 9, 4, 9],
  [WINDOWS[1][0] + 11, GLASS_BOTTOM - 11, 6, 2],
  [WINDOWS[4][0] + 40, GLASS_BOTTOM - 7, 6, 7],
  [WINDOWS[7][0] + 22, GLASS_BOTTOM - 3, 9, 3],
]);
const SILL_ITEM_LIDS = pxPath([[WINDOWS[4][0] + 39, GLASS_BOTTOM - 8, 8, 2]]);
const SILL_RINGS = pxPath([
  [WINDOWS[1][0] + 30, GLASS_BOTTOM + 1, 6, 1],
  [WINDOWS[6][0] + 18, GLASS_BOTTOM + 1, 5, 1],
]);
const HOPPERS = pxPath(
  WINDOWS.flatMap(
    ([x, gy, w]) =>
      [[x + 26, gy + 3, w - 52, 6], ...repeat(3, 3, [x + 30, gy + 5, w - 60, 1] as Rect)] as Rect[],
  ),
);
const HOPPER_CATCH = pxPath(
  WINDOWS.map(([x, gy, w]) => [x + Math.round(w / 2) - 3, gy + 9, 6, 2] as Rect),
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
const GLASS_SMUDGE = pxPath(
  WINDOWS.flatMap(([x, gy, w, h], i) =>
    i % 2 === 0
      ? ([
          [x + 18, gy + Math.round(h * 0.42), 14, 9],
          [x + 21, gy + Math.round(h * 0.42) - 3, 7, 3],
        ] as Rect[])
      : ([[x + w - 34, gy + Math.round(h * 0.46), 12, 8]] as Rect[]),
  ),
);
const GLASS_SCRATCH = pxPath([
  [WINDOWS[5][0] + 24, VIEW.top + 22, 1, 12],
  [WINDOWS[5][0] + 25, VIEW.top + 22, 10, 1],
  [WINDOWS[5][0] + 34, VIEW.top + 22, 1, 12],
  [WINDOWS[5][0] + 40, VIEW.top + 22, 1, 12],
  [WINDOWS[5][0] + 40, VIEW.top + 27, 8, 1],
]);
const GLASS_MIST = pxPath(
  WINDOWS.flatMap(
    ([x, gy, w, h]) =>
      [
        [x + 2, gy + h - 18, w - 4, 16],
        [x + 2, gy + 2, w - 4, 6],
      ] as Rect[],
  ),
);
const GLASS_DRIPS = pxPath(
  WINDOWS.flatMap(
    ([x, gy, w, h], i) =>
      [
        [x + 14 + ((i * 7) % 20), gy + h - 24, 1, 10],
        [x + w - 26 + ((i * 5) % 12), gy + h - 20, 1, 7],
      ] as Rect[],
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
const REFLECT_ADS = pxPath(
  WINDOWS.map(([x, gy, w, h]) => [x + 6, gy + Math.round(h * 0.12), w - 12, 3] as Rect),
);

const WALL_UPPER = pxPath([[0, CANT + 4, W, GLASS_TOP - CANT - 4]]);
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
const PIER_HI = pxPath(PIER_RECTS.map(([x, gy, , h]) => [x, gy, 1, h] as Rect));
const PIER_LO = pxPath(PIER_RECTS.map(([x, gy, w, h]) => [x + w - 1, gy, 1, h] as Rect));
const WALL_JOINTS = pxPath([
  ...PIER_RECTS.filter((r) => r[2] > 44).map(
    ([x, gy, w, h]) => [x + Math.round(w / 2), gy, 1, h] as Rect,
  ),
  ...repeat(Math.ceil(W / 220), 220, [40, GLASS_BOTTOM, 1, FLOOR - GLASS_BOTTOM] as Rect),
]);
const WALL_GRAIN = pxPath(grainH([[0, GLASS_BOTTOM + 2, W, FLOOR - GLASS_BOTTOM - 8]], 3, 5));
const WALL_SPECK = pxPath(speckle([[0, GLASS_BOTTOM, W, FLOOR - GLASS_BOTTOM]], 5, 17, 1));
const PIER_GRAIN = pxPath(
  grainH(
    PIER_RECTS.filter((r) => r[2] > 10).map(
      ([x, gy, w, h]) => [x + 1, gy + 2, w - 2, h - 4] as Rect,
    ),
    4,
    23,
  ),
);
const PIER_SPECK = pxPath(speckle(PIER_RECTS, 5, 31, 1));
const UPPER_GRAIN = pxPath(grainH([[0, CANT + 5, W, GLASS_TOP - CANT - 6]], 3, 41));
const WALL_JOINT_HI = pxPath(
  repeat(Math.ceil(W / 220), 220, [41, GLASS_BOTTOM, 1, FLOOR - GLASS_BOTTOM] as Rect),
);
const HEATER_SPANS: Rect[] = [
  ...SEAT_X.map((x) => [x + SEAT_D + 2, GLASS_BOTTOM + 6, KNEE - 4, 12] as Rect),
  [LEAN_WIN[0] + 4, GLASS_BOTTOM + 6, LEAN_WIN[2] - 8, 12],
];
const HEATER = pxPath(HEATER_SPANS);
const HEATER_SLATS = pxPath(
  HEATER_SPANS.flatMap(([x, gy, w]) => repeat(Math.floor(w / 5), 5, [x + 2, gy + 3, 3, 9] as Rect)),
);
const HEATER_TOP = pxPath(HEATER_SPANS.map(([x, gy, w]) => [x, gy, w, 1] as Rect));
const SKIRT = pxPath([
  [0, FLOOR - 6, W, 6],
  [0, FLOOR - 7, W, 1],
]);
const SKIRT_HI = pxPath([[0, FLOOR - 7, W, 1]]);
const SKIRT_SCUFF = pxPath(
  [Z.doorL, Z.doorR, Z.mpb + 40, Z.bay[2]].flatMap(
    (x) =>
      [
        [x - 30, FLOOR - 5, 60, 3],
        [x - 44, FLOOR - 4, 18, 2],
      ] as Rect[],
  ),
);
const SOCKETS = pxPath(SEAT_X.map((x) => [x + BAY_W - 12, GLASS_BOTTOM + 8, 8, 6] as Rect));
const SOCKET_LED = pxPath(SEAT_X.map((x) => [x + BAY_W - 6, GLASS_BOTTOM + 10, 2, 2] as Rect));
const HOOKS = pxPath(
  PIER_RECTS.filter((r) => r[2] > 60).flatMap(
    ([x, , w]) =>
      [
        [x + Math.round(w / 2) - 1, GLASS_TOP + 4, 2, 4],
        [x + Math.round(w / 2) - 3, GLASS_TOP + 7, 6, 2],
      ] as Rect[],
  ),
);

type BayParts = {
  headrest: Rect[];
  head_hi: Rect[];
  back: Rect[];
  back_shade: Rect[];
  insert: Rect[];
  arms: Rect[];
  arm_hi: Rect[];
  arm_bracket: Rect[];
  cushion: Rect[];
  cushion_hi: Rect[];
  lip: Rect[];
  nose: Rect[];
  welt: Rect[];
  seam: Rect[];
  slot: Rect[];
  pocket: Rect[];
  shell: Rect[];
  shell_hi: Rect[];
  shell_recess: Rect[];
  under: Rect[];
  grab: Rect[];
  far: Rect[];
  far_hi: Rect[];
  legs: Rect[];
  feet: Rect[];
};

function seatBay(x: number): BayParts {
  const p: BayParts = {
    headrest: [],
    head_hi: [],
    back: [],
    back_shade: [],
    insert: [],
    arms: [],
    arm_hi: [],
    arm_bracket: [],
    cushion: [],
    cushion_hi: [],
    lip: [],
    nose: [],
    welt: [],
    seam: [],
    slot: [],
    pocket: [],
    shell: [],
    shell_hi: [],
    shell_recess: [],
    under: [],
    grab: [],
    far: [],
    far_hi: [],
    legs: [],
    feet: [],
  };
  const seats: { sx: number; face: 1 | -1 }[] = [
    { sx: x, face: 1 },
    { sx: x + SEAT_D + KNEE, face: -1 },
  ];
  const backH = SEAT_TOP - SEAT_BACK;
  const seg = Math.ceil(backH / BACK_SEGS);
  for (const { sx, face } of seats) {
    const put = (lx: number, ly: number, lw: number, lh: number): Rect =>
      face === 1 ? [sx + lx, ly, lw, lh] : [sx + SEAT_D - lx - lw, ly, lw, lh];

    for (let j = 0; j < BACK_SEGS; j++) {
      const ly = SEAT_BACK + j * seg;
      const lh = Math.min(seg, SEAT_TOP - ly);
      if (lh <= 0) continue;
      p.back.push(put(j, ly, BACK_T, lh));
      if (j >= 2) p.back_shade.push(put(j + BACK_T - 2, ly, 2, lh));
    }
    p.headrest.push(put(0, SEAT_BACK - 5, BACK_T + 3, 6));
    p.head_hi.push(put(1, SEAT_BACK - 5, BACK_T + 1, 1));
    p.slot.push(put(0, SEAT_BACK + 1, BACK_T + 3, 1));
    p.grab.push(put(0, SEAT_BACK - 7, BACK_T + 3, 2));
    p.insert.push(put(2, SEAT_BACK + 8, BACK_T - 2, backH - 10));
    p.welt.push(put(BACK_T - 1, SEAT_BACK + 2, 1, backH - 3));
    p.seam.push(put(2, SEAT_BACK + 4, 1, backH - 7));
    p.pocket.push(put(0, SEAT_BACK + 11, 2, backH - 15));

    p.cushion.push(put(BACK_T, SEAT_TOP, PAN_D, PAN_H));
    p.cushion_hi.push(put(BACK_T, SEAT_TOP, PAN_D, 1));
    p.lip.push(put(BACK_T + PAN_D - 3, SEAT_TOP + 1, 3, PAN_H - 1));
    p.nose.push(put(BACK_T + PAN_D - 1, SEAT_TOP + 1, 1, PAN_H - 2));

    p.shell.push(put(BACK_T - 2, SEAT_TOP + PAN_H, PAN_D + 2, 4));
    p.shell_hi.push(put(BACK_T - 2, SEAT_TOP + PAN_H, PAN_D + 2, 1));
    p.shell_recess.push(put(BACK_T + 3, SEAT_TOP + PAN_H + 1, PAN_D - 8, 2));
    p.under.push(put(BACK_T + 2, SEAT_TOP + PAN_H + 4, PAN_D - 4, 2));

    p.arms.push(put(2, ARM_TOP, SEAT_D - 5, ARM_H));
    p.arm_hi.push(put(2, ARM_TOP, SEAT_D - 5, 1));
    p.arm_bracket.push(put(SEAT_D - 6, ARM_TOP + ARM_H, 3, SEAT_TOP - ARM_TOP - ARM_H));

    p.legs.push(put(BACK_T + 6, SEAT_TOP + PAN_H + 4, 6, FLOOR - SEAT_TOP - PAN_H - 4));
    p.feet.push(put(BACK_T + 3, FLOOR - 2, 12, 2));
  }
  p.far.push(
    [x + 2, SEAT_BACK - 10, BACK_T + 6, 6],
    [x + SEAT_D + KNEE + SEAT_D - BACK_T - 8, SEAT_BACK - 10, BACK_T + 6, 6],
  );
  p.far_hi.push(
    [x + 3, SEAT_BACK - 10, BACK_T + 4, 1],
    [x + SEAT_D + KNEE + SEAT_D - BACK_T - 7, SEAT_BACK - 10, BACK_T + 4, 1],
  );
  return p;
}

const BAYS = SEAT_X.map((x) => seatBay(x));

const SEATED_CAST = [
  "zGazeta",
  "spiacy",
  "babciaSiatka",
  "studentka",
  "biurowy",
  "zKwiatami",
  "kapturek",
  "zParasolem",
  "spawacz",
  "zKluczami",
] as const;

const SEATED = SEAT_X.map((x, i) => ({
  id: `train-rider-${i}`,
  npc: SEATED_CAST[i % SEATED_CAST.length],
  x: x + SEAT_D + Math.round(KNEE / 2),
  facing: (i % 2 === 0 ? 1 : -1) as 1 | -1,
  from: [1, 3, 2, 4, 1, 3, 2, 4, 2, 3][i],
}));

const STANDING = [
  { npc: "budowlaniec", x: Z.doorL + 74, y: 162, from: 2 },
  { npc: "pielegniarka", x: 470, y: 168, from: 3 },
  { npc: "jeanne", x: 742, y: 158, from: 3 },
  { npc: "zParasolem", x: 1024, y: 166, from: 4 },
  { npc: "kapturek", x: Z.doorR - 178, y: 160, from: 4 },
] as const;
const PRIORITY_BAY = 0;
const pick = (f: (b: BayParts) => Rect[], priority: boolean) =>
  BAYS.flatMap((b, i) => ((i === PRIORITY_BAY) === priority ? f(b) : []));

const SEATS_NEAR = bevelPaths(pick((b) => b.back, false));
const SEATS_NEAR_PRI = bevelPaths(pick((b) => b.back, true));
const SEATS_FAR = bevelPaths(BAYS.flatMap((b) => b.far));
const BACK_SHADE = pxPath(BAYS.flatMap((b) => b.back_shade));
const HEADRESTS = pxPath(pick((b) => b.headrest, false));
const HEADRESTS_PRI = pxPath(pick((b) => b.headrest, true));
const HEAD_HI = pxPath(BAYS.flatMap((b) => b.head_hi));
const FAR_HI = pxPath(BAYS.flatMap((b) => b.far_hi));
const INSERTS = pxPath(pick((b) => b.insert, false));
const INSERTS_PRI = pxPath(pick((b) => b.insert, true));
const CUSHIONS = pxPath(BAYS.flatMap((b) => b.cushion));
const CUSHION_HI = pxPath(BAYS.flatMap((b) => b.cushion_hi));
const CUSHION_LIP = pxPath(BAYS.flatMap((b) => b.lip));
const PAN_NOSE = pxPath(BAYS.flatMap((b) => b.nose));
const BACK_WELT = pxPath(BAYS.flatMap((b) => b.welt));
const BACK_SEAM = pxPath(BAYS.flatMap((b) => b.seam));
const HEAD_SLOT = pxPath(BAYS.flatMap((b) => b.slot));
const SEAT_POCKETS = pxPath(BAYS.flatMap((b) => b.pocket));
const SHELLS = pxPath(BAYS.flatMap((b) => b.shell));
const SHELL_HI = pxPath(BAYS.flatMap((b) => b.shell_hi));
const SHELL_RECESS = pxPath(BAYS.flatMap((b) => b.shell_recess));
const SEAT_UNDER = pxPath(BAYS.flatMap((b) => b.under));
const ARMRESTS = pxPath(BAYS.flatMap((b) => b.arms));
const ARMREST_HI = pxPath(BAYS.flatMap((b) => b.arm_hi));
const ARM_BRACKETS = pxPath(BAYS.flatMap((b) => b.arm_bracket));
const SEAT_GRABS = pxPath(BAYS.flatMap((b) => b.grab));
const SEAT_LEGS = pxPath(BAYS.flatMap((b) => b.legs));
const SEAT_FEET = pxPath(BAYS.flatMap((b) => b.feet));
const MOQUETTE_WEAVE = pxPath(
  BAYS.flatMap((b) => [...b.back, ...b.cushion].flatMap((r) => weave(r, 3))),
);
const INSERT_WEAVE = pxPath(BAYS.flatMap((b) => b.insert.flatMap((r) => weave(r, 3))));
const MOQUETTE_MOTIF = pxPath(motif(BAYS.flatMap((b) => [...b.back, ...b.cushion, ...b.headrest])));
const MOQUETTE_SPECK = pxPath(
  speckle(
    BAYS.flatMap((b) => [...b.back, ...b.cushion]),
    3,
    7,
    1,
  ),
);
const SEAT_PILE = pxPath(
  BAYS.flatMap((b) =>
    b.cushion.map(([cx, cy, cw, ch]) => [cx + 1, cy + ch - 2, cw - 2, 1] as Rect),
  ),
);

const SEAT_SCUFF = pxPath(
  BAYS.flatMap((b) => b.shell.map(([sx, sy, sw]) => [sx, sy + 2, sw, 2] as Rect)),
);
const SEAT_POLISH = pxPath(
  BAYS.flatMap((b) => b.headrest.map(([hx, hy, hw]) => [hx + 1, hy, hw - 2, 1] as Rect)),
);
/**
 * What people leave behind on the seats.
 *
 * Indexed off the ends of the row rather than by literal bay number: this
 * read `SEAT_X[7]` against a seven-bay row, so both of the far-end items
 * resolved to `undefined` and went into the path as `NaN` — which SVG drops
 * on the floor with a console error and no drawing, and which silently comes
 * back the next time anybody retunes `SEAT_BAYS`.
 */
const LEFTOVER_A = SEAT_X[Math.min(4, SEAT_X.length - 1)];
const LEFTOVER_B = SEAT_X[SEAT_X.length - 1];
const SEAT_LEFTOVERS = pxPath([
  [LEFTOVER_A + BACK_T + 4, SEAT_TOP - 3, 14, 3],
  [LEFTOVER_A + BACK_T + 6, SEAT_TOP - 5, 9, 2],
  [LEFTOVER_B + SEAT_D + KNEE + 6, SEAT_TOP - 9, 11, 9],
  [LEFTOVER_B + SEAT_D + KNEE + 9, SEAT_TOP - 11, 5, 2],
]);

const TABLE_BAYS = SEAT_X.filter((_, i) => i % 3 === 1);
const TABLES = pxPath(TABLE_BAYS.map((x) => [x + SEAT_D + 7, TABLE_TOP, KNEE - 14, 3] as Rect));
const TABLE_EDGE = pxPath(TABLE_BAYS.map((x) => [x + SEAT_D + 7, TABLE_TOP, KNEE - 14, 1] as Rect));
const TABLE_SHADOW = pxPath(
  TABLE_BAYS.map((x) => [x + SEAT_D + 7, TABLE_TOP + 3, KNEE - 14, 2] as Rect),
);
const TABLE_TOPS = pxPath(
  TABLE_BAYS.flatMap(
    (x, i) =>
      (i % 2 === 0
        ? [
            [x + SEAT_D + 11, TABLE_TOP - 7, 5, 7],
            [x + SEAT_D + 19, TABLE_TOP - 2, 8, 2],
          ]
        : [
            [x + SEAT_D + 12, TABLE_TOP - 3, 12, 3],
            [x + SEAT_D + 26, TABLE_TOP - 9, 4, 9],
          ]) as Rect[],
  ),
);
const CUP_LID = pxPath(
  TABLE_BAYS.filter((_, i) => i % 2 === 0).map(
    (x) => [x + SEAT_D + 10, TABLE_TOP - 8, 7, 2] as Rect,
  ),
);

const PRIORITY_X = WINDOWS[PRIORITY_BAY][0] + 5;
const PRIORITY_Y = VIEW.top + 5;
const PRIORITY_SIGN = pxPath([[PRIORITY_X, PRIORITY_Y, 14, 14]]);
const PRIORITY_MARK = pxPath([
  [PRIORITY_X + 6, PRIORITY_Y + 2, 3, 3],
  [PRIORITY_X + 4, PRIORITY_Y + 6, 6, 3],
  [PRIORITY_X + 3, PRIORITY_Y + 9, 8, 3],
]);
const PRIORITY_STRIPE = pxPath(
  BAYS[PRIORITY_BAY].headrest.map(([hx, hy, hw]) => [hx, hy + 2, hw, 2] as Rect),
);

const POLE_X = [
  Z.doorL + 46,
  STAND.x0 + 10,
  STAND.x1 - 12,
  LEAN.x0 + 4,
  LEAN.x1 - 46,
  Z.doorR - 46,
] as const;
const POLES = pxPath(POLE_X.map((x) => [x, CANT + 2, 5, FLOOR - CANT - 2] as Rect));
const POLE_HI = pxPath(POLE_X.map((x) => [x, CANT + 2, 1, FLOOR - CANT - 2] as Rect));
const POLE_LO = pxPath(POLE_X.map((x) => [x + 4, CANT + 2, 1, FLOOR - CANT - 2] as Rect));
const POLE_HANDS = pxPath(POLE_X.map((x) => [x, y(1.6), 5, y(0.9) - y(1.6)] as Rect));
const POLE_JOINT = pxPath(POLE_X.map((x) => [x - 1, y(1.75), 7, 2] as Rect));
const POLE_COLLAR = pxPath(
  POLE_X.flatMap(
    (x) =>
      [
        [x - 2, CANT + 2, 9, 3],
        [x - 1, FLOOR - 4, 7, 4],
      ] as Rect[],
  ),
);
const POLE_BRUSH = pxPath(
  brushedV(
    POLE_X.map((x) => [x + 1, CANT + 4, 4, FLOOR - CANT - 6] as Rect),
    2,
  ),
);
const REFLECT_POLES = POLE_X.flatMap((p) =>
  WINDOWS.filter(([x, , w]) => p > x + 8 && p < x + w - 8).map(
    ([, gy, , h]) => [p - 26, gy + 4, 3, h - 8] as Rect,
  ),
);
const REFLECT_POLES_PATH = pxPath(REFLECT_POLES);

const RAIL_X = [...SEAT_X.map((x) => x - 3), SEAT_X[SEAT_X.length - 1] + BAY_W];
const STUB_RAILS = pxPath(RAIL_X.map((x) => [x, SEAT_BACK - 4, 3, 18] as Rect));
const STUB_RAIL_HI = pxPath(RAIL_X.map((x) => [x, SEAT_BACK - 4, 1, 18] as Rect));
/* has to follow RAIL_X: it was declared eight lines above it and read a
   block-scoped const before its initialiser had run */
const RAIL_BRUSH = pxPath(
  brushedV(
    RAIL_X.map((x) => [x, SEAT_BACK - 4, 3, 18] as Rect),
    2,
  ),
);

const PERCH_Y = y(0.82);
const PERCH_X0 = LEAN.x0 + 8;
const PERCH_W = 104;
const PERCH = pxPath([[PERCH_X0, PERCH_Y, PERCH_W, 4]]);
const PERCH_HI = pxPath([[PERCH_X0, PERCH_Y, PERCH_W, 1]]);
const PERCH_LIP = pxPath([[PERCH_X0, PERCH_Y + 4, PERCH_W, 2]]);
const PERCH_WEAR = pxPath([[PERCH_X0 + 26, PERCH_Y, 54, 1]]);
const PERCH_STANDARDS = pxPath([
  [PERCH_X0 + 2, PERCH_Y + 6, 3, FLOOR - PERCH_Y - 6],
  [PERCH_X0 + PERCH_W - 5, PERCH_Y + 6, 3, FLOOR - PERCH_Y - 6],
]);
const PERCH_STANDARD_HI = pxPath([
  [PERCH_X0 + 2, PERCH_Y + 6, 1, FLOOR - PERCH_Y - 6],
  [PERCH_X0 + PERCH_W - 5, PERCH_Y + 6, 1, FLOOR - PERCH_Y - 6],
]);
const PERCH_FOOTRAIL = pxPath([[PERCH_X0 + 2, y(0.22), PERCH_W - 4, 3]]);
const PERCH_FOOT_HI = pxPath([[PERCH_X0 + 2, y(0.22), PERCH_W - 4, 1]]);
const PERCH_AO = aoPaths([[PERCH_X0, PERCH_Y + 6, PERCH_W]]);
const PERCH_CONTACT = contactPaths([
  [PERCH_X0 + 1, 5, FLOOR] as const,
  [PERCH_X0 + PERCH_W - 6, 5, FLOOR] as const,
]);

const PERCH_MOTIF = pxPath(motif([[PERCH_X0 + 1, PERCH_Y + 1, PERCH_W - 2, 3]]));
const PERCH_BRUSH = pxPath(
  brushedH(
    [
      [PERCH_X0 + 2, PERCH_Y + 6, 3, FLOOR - PERCH_Y - 6],
      [PERCH_X0 + PERCH_W - 5, PERCH_Y + 6, 3, FLOOR - PERCH_Y - 6],
      [PERCH_X0 + 2, y(0.22), PERCH_W - 4, 3],
    ],
    2,
  ),
);

const PARTITIONS: Rect[] = [
  [STAND.x1 - 4, CANT + 4, 5, FLOOR - CANT - 4],
  [LEAN.x0 - 5, CANT + 4, 5, FLOOR - CANT - 4],
];
const PARTITION_SET = bevelPaths(PARTITIONS);
const PARTITION_GLASS = pxPath([
  [STAND.x1 - 3, CANT + 10, 3, y(0.95) - CANT - 10],
  [LEAN.x0 - 4, CANT + 10, 3, y(0.95) - CANT - 10],
]);
const PARTITION_GRAB = pxPath([
  [STAND.x1 - 5, y(1.15), 7, 3],
  [LEAN.x0 - 6, y(1.15), 7, 3],
]);

const STAND_FLOOR = pxPath([
  [STAND.x0, FLOOR + 2, STAND.x1 - STAND.x0, FRAME_H - FLOOR - 4],
  [LEAN.x0, FLOOR + 2, LEAN.x1 - LEAN.x0, FRAME_H - FLOOR - 4],
]);
const STAND_FLOOR_EDGE = pxPath([
  [STAND.x0, FLOOR + 2, STAND.x1 - STAND.x0, 1],
  [LEAN.x0, FLOOR + 2, LEAN.x1 - LEAN.x0, 1],
]);

const DOOR_H = FLOOR - (VIEW.top - 8);
function doorLeaf(x: number): Rect[] {
  const half = Math.round(m(1.3) / 2);
  const gl = DOOR_GLASS_AT(x);
  const top = VIEW.top - 8;
  const out: Rect[] = [];
  for (const x0 of [x - half, x] as const) {
    const w = half;
    out.push([x0, top, w, gl.y - top]);
    out.push([x0, gl.y + gl.h, w, DOOR_H - (gl.y + gl.h - top)]);
    const l0 = Math.max(x0, gl.x);
    const l1 = Math.min(x0 + w, gl.x + gl.w);
    if (l0 > x0) out.push([x0, gl.y, l0 - x0, gl.h]);
    if (l1 < x0 + w) out.push([l1, gl.y, x0 + w - l1, gl.h]);
  }
  return out;
}
function DOOR_GLASS_AT(x: number): { x: number; y: number; w: number; h: number } {
  return { x: x - 18, y: VIEW.top + 4, w: 40, h: VIEW.bottom - VIEW.top - 8 };
}
const DOORS = bevelPaths([...doorLeaf(Z.doorL), ...doorLeaf(Z.doorR)]);
const DOOR_GRAIN = pxPath(
  grainH(
    [
      [Z.doorL - m(1.3) / 2, VIEW.top - 6, m(1.3), DOOR_H - 8],
      [Z.doorR - m(1.3) / 2, VIEW.top - 6, m(1.3), DOOR_H - 8],
    ],
    4,
    59,
  ),
);
const DOOR_SPLIT = pxPath([
  [Z.doorL - 1, VIEW.top - 8, 2, DOOR_H],
  [Z.doorR - 1, VIEW.top - 8, 2, DOOR_H],
]);
const DOOR_RUBBER = pxPath([
  [Z.doorL - 2, VIEW.top - 8, 4, DOOR_H],
  [Z.doorR - 2, VIEW.top - 8, 4, DOOR_H],
]);
const DOOR_HEAD = pxPath([
  [Z.doorL - m(1.3) / 2 - 3, VIEW.top - 11, m(1.3) + 6, 3],
  [Z.doorR - m(1.3) / 2 - 3, VIEW.top - 11, m(1.3) + 6, 3],
]);
const DOOR_HEAD_SHADOW = pxPath([
  [Z.doorL - m(1.3) / 2 - 3, VIEW.top - 8, m(1.3) + 6, 2],
  [Z.doorR - m(1.3) / 2 - 3, VIEW.top - 8, m(1.3) + 6, 2],
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
const DOOR_BUTTON_LED = pxPath([
  [Z.doorL + 32, GLASS_BOTTOM + 10, 4, 4],
  [Z.doorR - 38, GLASS_BOTTOM + 10, 4, 4],
]);
const DOOR_RELEASE = pxPath([
  [Z.doorL + 26, VIEW.top - 4, 15, 9],
  [Z.doorR - 42, VIEW.top - 4, 15, 9],
]);
const DOOR_EMERGENCY = pxPath([
  [Z.doorL + 44, VIEW.top - 4, 12, 9],
  [Z.doorR - 56, VIEW.top - 4, 12, 9],
]);
const DOOR_STICKER = pxPath([
  [Z.doorL - 14, VIEW.bottom - 22, 16, 10],
  [Z.doorR - 14, VIEW.bottom - 22, 16, 10],
]);
const DOOR_STICKER_ROWS = pxPath([
  [Z.doorL - 12, VIEW.bottom - 20, 12, 2],
  [Z.doorL - 12, VIEW.bottom - 17, 9, 2],
  [Z.doorR - 12, VIEW.bottom - 20, 12, 2],
  [Z.doorR - 12, VIEW.bottom - 17, 9, 2],
]);
const KASOWNIK = pxPath([
  [Z.doorL + 52, GLASS_BOTTOM + 4, 14, 20],
  [Z.doorR - 66, GLASS_BOTTOM + 4, 14, 20],
]);
const KASOWNIK_HI = pxPath([
  [Z.doorL + 52, GLASS_BOTTOM + 4, 14, 1],
  [Z.doorR - 66, GLASS_BOTTOM + 4, 14, 1],
]);
const KASOWNIK_SIDE = pxPath([
  [Z.doorL + 64, GLASS_BOTTOM + 4, 2, 20],
  [Z.doorR - 54, GLASS_BOTTOM + 4, 2, 20],
]);
const KASOWNIK_SLOT = pxPath([
  [Z.doorL + 55, GLASS_BOTTOM + 8, 8, 2],
  [Z.doorR - 63, GLASS_BOTTOM + 8, 8, 2],
]);
const KASOWNIK_RUB = pxPath([
  [Z.doorL + 54, GLASS_BOTTOM + 11, 10, 2],
  [Z.doorR - 64, GLASS_BOTTOM + 11, 10, 2],
]);
const KASOWNIK_LED = pxPath([
  [Z.doorL + 55, GLASS_BOTTOM + 13, 3, 3],
  [Z.doorR - 63, GLASS_BOTTOM + 13, 3, 3],
]);
const INTERCOM = pxPath([[Z.doorL + 72, GLASS_BOTTOM + 4, 10, 14]]);
const INTERCOM_MESH = pxPath(repeat(3, 3, [Z.doorL + 74, GLASS_BOTTOM + 6, 6, 1] as Rect, "y"));
const FIRST_AID = pxPath([[Z.doorR - 86, GLASS_TOP + 6, 16, 12]]);
const FIRST_AID_MARK = pxPath([
  [Z.doorR - 80, GLASS_TOP + 8, 4, 8],
  [Z.doorR - 83, GLASS_TOP + 11, 10, 2],
]);
const EXTINGUISHER = pxPath([
  [Z.wc + 36, FLOOR - 26, 11, 22],
  [Z.wc + 38, FLOOR - 29, 7, 3],
]);
const EXTINGUISHER_HI = pxPath([[Z.wc + 36, FLOOR - 26, 2, 22]]);
const EXTINGUISHER_LABEL = pxPath([[Z.wc + 37, FLOOR - 18, 9, 5]]);

const WC_DOOR = pxPath([[Z.wc - 32, VIEW.top - 12, 64, FLOOR - VIEW.top + 12]]);
const WC_SEAM = pxPath([[Z.wc, VIEW.top - 12, 1, FLOOR - VIEW.top + 12]]);
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
const WC_BUTTON_LED = pxPath([[Z.wc + 22, GLASS_BOTTOM + 8, 4, 4]]);
const END_WALL = pxPath([[Z.end, CANT, W - Z.end, FLOOR - CANT]]);
const END_DOOR = pxPath([[Z.end + 14, VIEW.top - 12, 54, FLOOR - VIEW.top + 12]]);
const END_GLASS = pxPath([[Z.end + 24, VIEW.top - 2, 34, VIEW.bottom - VIEW.top]]);
const GANGWAY_RIBS = pxPath(
  repeat(5, 7, [Z.end + 26, VIEW.top + 2, 3, VIEW.bottom - VIEW.top - 4] as Rect),
);
const END_FRAME = pxPath([
  [Z.end + 12, VIEW.top - 14, 58, 2],
  [Z.end + 12, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
  [Z.end + 68, VIEW.top - 14, 2, FLOOR - VIEW.top + 14],
]);
const LUGGAGE = pxPath([
  [Z.end + 34, FLOOR - 30, 22, 30],
  [Z.end + 36, FLOOR - 33, 18, 3],
  [Z.end + 58, FLOOR - 20, 16, 20],
]);
const LUGGAGE_TRIM = pxPath([
  [Z.end + 34, FLOOR - 22, 22, 2],
  [Z.end + 58, FLOOR - 14, 16, 2],
]);
const LUGGAGE_HI = pxPath([
  [Z.end + 34, FLOOR - 30, 22, 1],
  [Z.end + 58, FLOOR - 20, 16, 1],
]);
const LUGGAGE_SIDE = pxPath([
  [Z.end + 52, FLOOR - 30, 4, 30],
  [Z.end + 70, FLOOR - 20, 4, 20],
]);

const MAP_BOX: Rect = [Z.map - 50, GLASS_TOP + 2, 112, 44];
const MAP_SET = bevelPaths([MAP_BOX]);
const MAP_LINE = pxPath([[MAP_BOX[0] + 8, MAP_BOX[1] + 22, MAP_BOX[2] - 16, 2]]);
const MAP_TICKS = pxPath(
  LINE.map((_, i) => [MAP_BOX[0] + 10 + i * 13, MAP_BOX[1] + 18, 2, 10] as Rect),
);
const MAP_DOTS = pxPath(
  LINE.map((_, i) => [MAP_BOX[0] + 10 + i * 13, MAP_BOX[1] + 21, 2, 4] as Rect),
);
const MAP_HERE = pxPath([
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 16, 6, 2],
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 26, 6, 2],
  [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 16, 2, 12],
  [MAP_BOX[0] + 12 + 4 * 13, MAP_BOX[1] + 16, 2, 12],
]);
const MAP_GLARE = pxPath([[MAP_BOX[0] + 4, MAP_BOX[1] + 14, 26, 24]]);
const MAP_SCREWS = pxPath([
  [MAP_BOX[0] + 2, MAP_BOX[1] + 2, 1, 1],
  [MAP_BOX[0] + MAP_BOX[2] - 3, MAP_BOX[1] + 2, 1, 1],
  [MAP_BOX[0] + 2, MAP_BOX[1] + MAP_BOX[3] - 3, 1, 1],
  [MAP_BOX[0] + MAP_BOX[2] - 3, MAP_BOX[1] + MAP_BOX[3] - 3, 1, 1],
]);
const MAP_AHEAD = (toward: TrainState["toward"]) =>
  pxPath([
    toward === "gdynia"
      ? [MAP_BOX[0] + 8 + 4 * 13, MAP_BOX[1] + 22, MAP_BOX[2] - 16 - 4 * 13, 2]
      : [MAP_BOX[0] + 8, MAP_BOX[1] + 22, 4 * 13, 2],
  ] as Rect[]);
const TT_X = STAND.x1 - 34;
const TIMETABLE = pxPath([[TT_X, GLASS_TOP + 6, 30, 40]]);
const TIMETABLE_ROWS = pxPath(repeat(9, 4, [TT_X + 3, GLASS_TOP + 10, 24, 2] as Rect));
const TIMETABLE_RED = pxPath([[TT_X + 3, GLASS_TOP + 30, 24, 2]]);
const TIMETABLE_GLARE = pxPath([[TT_X + 2, GLASS_TOP + 7, 7, 38]]);
const POSTER = pxPath([[LEAN.x1 - 46, GLASS_BOTTOM + 4, 46, 30]]);
const POSTER_ART = pxPath([
  [LEAN.x1 - 42, GLASS_BOTTOM + 8, 38, 14],
  [LEAN.x1 - 42, GLASS_BOTTOM + 24, 24, 3],
  [LEAN.x1 - 42, GLASS_BOTTOM + 28, 16, 2],
]);
const POSTER_CURL = pxPath([
  [LEAN.x1 - 46, GLASS_BOTTOM + 32, 46, 2],
  [LEAN.x1 - 8, GLASS_BOTTOM + 4, 4, 6],
]);

const CIP_BOX: Rect = [Z.doorL + 70, CEIL_MID_BOT - 4, 130, 16];
const CIP_SCREEN = pxPath([[CIP_BOX[0] + 3, CIP_BOX[1] + 3, CIP_BOX[2] - 6, CIP_BOX[3] - 6]]);
const CIP_GRID = pxPath(repeat(31, 4, [CIP_BOX[0] + 5, CIP_BOX[1] + 5, 1, 7] as Rect));
const CIP_MOUNT = pxPath([
  [CIP_BOX[0] + 20, CEIL_MID_BOT - 8, 3, 4],
  [CIP_BOX[0] + CIP_BOX[2] - 23, CEIL_MID_BOT - 8, 3, 4],
]);
const CIP_TOP_HI = pxPath([[CIP_BOX[0], CIP_BOX[1], CIP_BOX[2], 1]]);
const CIP_UNDER = pxPath([[CIP_BOX[0], CIP_BOX[1] + CIP_BOX[3] - 1, CIP_BOX[2], 1]]);
const CIP_GLARE = pxPath([[CIP_BOX[0] + 5, CIP_BOX[1] + 4, 28, 2]]);

const BIN = pxPath([
  [Z.bin, FLOOR - 24, 22, 24],
  [Z.bin - 2, FLOOR - 27, 26, 3],
]);
const BIN_HI = pxPath([[Z.bin - 2, FLOOR - 27, 26, 1]]);
const BIN_SIDE = pxPath([[Z.bin + 18, FLOOR - 24, 4, 24]]);
const BIN_SLOT = pxPath([[Z.bin + 4, FLOOR - 25, 14, 2]]);
const BIN_FULL = pxPath([
  [Z.bin + 5, FLOOR - 29, 6, 4],
  [Z.bin + 13, FLOOR - 28, 4, 3],
]);
const HAMMER_X = STAND.x1 - 30;
const HAMMER = pxPath([
  [HAMMER_X + 2, GLASS_BOTTOM + 6, 11, 7],
  [HAMMER_X + 5, GLASS_BOTTOM + 8, 5, 3],
]);
const HAMMER_CASE = pxPath([[HAMMER_X, GLASS_BOTTOM + 4, 15, 11]]);
const TIPUPS = pxPath([
  [Z.mpb, SEAT_TOP - 5, 34, 5],
  [Z.mpb + 40, SEAT_TOP - 5, 34, 5],
  [Z.mpb + 2, SEAT_TOP, 4, 14],
  [Z.mpb + 42, SEAT_TOP, 4, 14],
]);
const TIPUP_HI = pxPath([
  [Z.mpb, SEAT_TOP - 5, 34, 1],
  [Z.mpb + 40, SEAT_TOP - 5, 34, 1],
]);
const MPB_RAIL = pxPath([
  [Z.mpb - 6, GLASS_BOTTOM + 4, 90, 4],
  [Z.mpb - 6, GLASS_BOTTOM + 4, 4, 20],
  [Z.mpb + 80, GLASS_BOTTOM + 4, 4, 20],
]);
const MPB_RAIL_HI = pxPath([[Z.mpb - 6, GLASS_BOTTOM + 4, 90, 1]]);
/** The bike in the multipurpose bay is propKit's, in the carriage's green. */
const MPB_BIKE = bicycle(Z.mpb + 10, FLOOR, 1);
const FLOOR_BAG = pxPath([
  [Z.bay[1] + 130, FLOOR - 16, 16, 16],
  [Z.bay[1] + 133, FLOOR - 19, 10, 3],
]);
const FLOOR_BAG_HI = pxPath([[Z.bay[1] + 130, FLOOR - 16, 16, 1]]);
const FLOOR_LITTER = pxPath([
  [Z.bay[2] + 150, FLOOR + 6, 5, 4],
  [Z.map + 150, FLOOR + 14, 7, 2],
]);

const FLOOR_BAND = pxPath([[0, FLOOR, W, FRAME_H - FLOOR]]);
const FLOOR_UNDERSEAT = pxPath([[0, FLOOR, W, 5]]);
const AISLE_WEAR = pxPath([[0, FLOOR + 8, W, 11]]);
const FLOOR_NEAR = pxPath([[0, FRAME_H - 5, W, 5]]);
const FLOOR_JOINTS = pxPath(repeat(Math.ceil(W / 76), 76, [0, FLOOR, 1, FRAME_H - FLOOR] as Rect));
const FLOOR_JOINT_HI = pxPath(
  repeat(Math.ceil(W / 76), 76, [1, FLOOR, 1, FRAME_H - FLOOR] as Rect),
);
const FLOOR_MPB = pxPath([[Z.mpb - 8, FLOOR + 2, 96, 7]]);
const FLOOR_DOORMAT = pxPath([
  [Z.doorL - m(1.3) / 2, FLOOR, m(1.3), 4],
  [Z.doorR - m(1.3) / 2, FLOOR, m(1.3), 4],
]);
const FLOOR_KEEPCLEAR = pxPath(
  [Z.doorL, Z.doorR].flatMap(
    (x) =>
      [
        [x - m(1.3) / 2, FLOOR + 16, m(1.3), 2],
        [x - m(1.3) / 2, FLOOR + 4, 2, 14],
        [x + m(1.3) / 2 - 2, FLOOR + 4, 2, 14],
      ] as Rect[],
  ),
);
const FLOOR_SHEEN = pxPath([[0, FLOOR + 5, W, 2]]);
const LINO_SPECK = pxPath(speckle([[0, FLOOR, W, FRAME_H - FLOOR]], 3, 13, 1));
const LINO_SPECK_2 = pxPath(speckle([[0, FLOOR, W, FRAME_H - FLOOR]], 6, 29, 2));
const FLOOR_ARCS = pxPath(
  [Z.doorL, Z.doorR].flatMap((x) =>
    Array.from({ length: 6 }, (_, i) => [x - 26 + i * 10, FLOOR + 3 + (i % 3), 8, 1] as Rect),
  ),
);
const FLOOR_GUM = pxPath(
  Array.from({ length: 9 }, (_, i) => {
    const x = (i * 173 + 90) % W;
    return [x, FLOOR + 6 + ((i * 5) % 14), 2, 2] as Rect;
  }),
);
const FLOOR_TICKET = pxPath([[Z.bay[1] + 60, FLOOR + 19, 6, 3]]);
const FLOOR_SEEDS = pxPath([
  [Z.bay[2] + 84, FLOOR + 15, 2, 1],
  [Z.bay[2] + 90, FLOOR + 18, 2, 1],
  [Z.bay[2] + 79, FLOOR + 20, 2, 1],
]);
const FLOOR_WET = pxPath([
  [Z.doorL - m(1.3) / 2 - 8, FLOOR + 2, m(1.3) + 16, 14],
  [Z.doorR - m(1.3) / 2 - 8, FLOOR + 2, m(1.3) + 16, 14],
]);
const FLOOR_PRINTS = pxPath(
  [Z.doorL, Z.doorR].flatMap((x) =>
    Array.from({ length: 5 }, (_, i) => [x + 26 + i * 17, FLOOR + 5 + (i % 2) * 7, 6, 3] as Rect),
  ),
);
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
const SEAT_CONTACT = contactPaths(
  BAYS.flatMap((b) => b.feet.map(([fx, , fw]) => [fx, fw, FLOOR] as const)),
);
const SEAT_AO = aoPaths(SEAT_X.map((x) => [x, SEAT_TOP + PAN_H + 4, BAY_W] as const));
const KNEE_SHADE = pxPath(
  SEAT_X.flatMap((x) => [
    [x + SEAT_D, SEAT_TOP - 2, KNEE, 8] as Rect,
    [x + SEAT_D, FLOOR - 6, KNEE, 6] as Rect,
  ]),
);
const KNEE_DEEP = pxPath(SEAT_X.map((x) => [x + SEAT_D, SEAT_TOP - 2, KNEE, 3] as Rect));
const BIN_CONTACT = contactPaths([[Z.bin - 2, 26, FLOOR] as const]);
const LUGGAGE_CONTACT = contactPaths([[Z.end + 34, 40, FLOOR] as const]);
const POLE_CONTACT = contactPaths(POLE_X.map((x) => [x - 2, 9, FLOOR] as const));
const HEATER_AO = aoPaths(HEATER_SPANS.map(([x, gy, w]) => [x, gy + 14, w] as const));

function TheView({
  ph,
  lit,
  dir,
  weather,
}: {
  ph: Ph;
  lit: boolean;
  dir: 1 | -1;
  weather: TrainState["weather"];
}) {
  const mirror = ph === "night" ? 0.3 : ph === "dusk" ? 0.16 : 0.06;
  return (
    <g>
      <defs>
        <clipPath id="train-glass">
          <path d={pxPath(ALL_GLASS)} />
        </clipPath>
      </defs>
      <g clipPath="url(#train-glass)">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 1;0 0;0 1;0 0;0 0;0 0;0 0"
          keyTimes="0;0.04;0.09;0.13;0.18;0.4;0.7;1"
          dur="2.3s"
          calcMode="discrete"
          repeatCount="indefinite"
        />
        <TrainWindowView ph={ph} width={W} dir={dir} weather={weather} />
        {lit ? (
          <>
            <path d={REFLECT_SEATS} fill={K.moquetteHi} opacity={mirror * 0.7} />
            <path d={REFLECT_COVE} fill={K.led} opacity={mirror} />
            <path d={REFLECT_ADS} fill={K.white} opacity={mirror * 0.5} />
            <path d={REFLECT_POLES_PATH} fill={K.pole} opacity={mirror * 0.45} />
          </>
        ) : null}
      </g>
    </g>
  );
}

function Saloon({ ph, s }: { ph: Ph; s: TrainState }) {
  const night = ph === "night";
  const panel = PANEL[ph];
  const frame = FRAME[ph];
  const lit = s.lights;
  const rain = s.weather === "rain";
  return (
    <g>
      <SharedDefs />

      <path d={CEILING} fill={panel.mid} />
      <path d={CEIL_PANEL} fill={lit ? K.ceiling : panel.base} opacity={night && !lit ? 0.6 : 1} />
      {lit ? <path d={COVE_WASH} fill={K.led} opacity={0.16} /> : null}
      <path d={CEIL_SLOPES} fill={panel.lo} opacity={0.4} />
      <path d={CEIL_SLOPE_HI} fill={panel.hi} opacity={0.35} />
      <path d={CEIL_JOINTS} fill={panel.lo} opacity={0.35} />
      <path d={CEIL_JOINT_HI} fill={panel.hi} opacity={0.25} />
      <path d={CEIL_GRAIN} fill={panel.hi} opacity={0.1} />
      <path d={CEIL_PERF} fill={panel.lo} opacity={0.16} />
      <path d={CEIL_VENTS} fill={frame.lo} opacity={0.7} />
      <path d={CEIL_VENT_SLATS} fill={frame.deep} opacity={0.5} />
      <path d={VENT_DUST} fill={panel.lo} opacity={0.18} />

      <path d={CEIL_DUCT} fill={panel.lo} opacity={0.55} />
      <path d={CEIL_GRABS} fill={frame.mid} opacity={0.8} />
      <path d={CEIL_GRAB_HI} fill={frame.hi} opacity={0.5} />
      <path d={LIGHT_STRIP} fill={lit ? K.led : panel.hi} opacity={lit ? 1 : 0.5} />
      {lit ? <path d={LIGHT_STRIP_GLOW} fill={K.led} opacity={0.3} /> : null}
      <path d={LIGHT_JOINTS} fill={panel.lo} opacity={0.5} />
      {lit ? (
        <path d={pxPath([LIGHT_DEAD])} fill={panel.mid} opacity={0.55}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.55;0.55;0.55;0.2;0.55;0.55"
            dur="6.7s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      <path d={EXIT_SIGNS} fill={K.green} opacity={0.85} />
      <path d={EXIT_MARKS} fill={K.white} opacity={0.9} />
      <path d={NO_SMOKING} fill={K.white} opacity={0.7} />
      <path d={NO_SMOKING_BAR} fill={K.red} opacity={0.8} />
      <path d={CCTV_NOTICE} fill={K.access} opacity={0.6} />

      <path d={AD_SHADOW} fill="#000" opacity={0.16} />
      <path d={AD_MOUNTS} fill={frame.deep} opacity={0.5} />
      <path d={AD_FRAMES} fill={night && !lit ? panel.lo : K.white} opacity={0.92} />
      {AD_ART.map((ad) => (
        <g key={ad.key}>
          <path
            d={ad.band}
            fill={
              ad.tone === 0
                ? K.signBlue
                : ad.tone === 1
                  ? "#8a3a44"
                  : ad.tone === 2
                    ? "#2f6b4a"
                    : "#b8862f"
            }
            opacity={night && !lit ? 0.3 : 0.55}
          />
          <path d={ad.lines} fill={panel.deep} opacity={0.45} />
        </g>
      ))}
      <path d={AD_GLARE} fill="#ffffff" opacity={0.2} />

      <path d={SPEAKERS} fill={frame.mid} />
      <path d={SPEAKER_MESH} fill={frame.deep} opacity={0.7} />
      <path d={DOMES} fill="#2b3138" />
      <path d={DOME_GLINT} fill="#8a929c" opacity={0.6} />
      <path d={COVE_NEAR} fill={lit ? K.led : panel.lo} />
      <path d={COVE_FAR} fill={lit ? K.led : panel.lo} />
      {lit ? (
        <>
          <path d={COVE_NEAR} fill="#ffffff" opacity={0.3} />
          <path d={COVE_FAR} fill="#ffffff" opacity={0.3} />
        </>
      ) : null}
      <path d={CANT_RAIL} fill={panel.lo} />
      <path d={CANT_RAIL_HI} fill={panel.hi} opacity={0.5} />

      <path d={CIP_MOUNT} fill={frame.lo} />
      <path d={pxPath([CIP_BOX])} fill="#23262b" />
      <path d={CIP_TOP_HI} fill="#3a3e44" />
      <path d={CIP_UNDER} fill="#000" opacity={0.4} />
      <path d={CIP_SCREEN} fill="#0d0f12" />
      <g transform={`translate(${CIP_BOX[0] + 7} ${CIP_BOX[1] + 6})`}>
        <path
          d={textPath(s.toward === "gdynia" ? "NEXT: ZASPA" : "NEXT: OLIWA", 0, 0)}
          fill={K.ledAmber}
        />
      </g>
      <path d={CIP_GRID} fill="#0d0f12" opacity={0.4} />
      <path d={CIP_GLARE} fill="#3a4048" opacity={0.35} />

      <path d={WALL_UPPER} fill={panel.base} />
      <path d={UPPER_GRAIN} fill={panel.hi} opacity={0.12} />
      <path d={PIERS} fill={panel.base} />
      <path d={PIERS} fill={dth("n", "06")} opacity={0.25} />
      <path d={PIER_GRAIN} fill={panel.hi} opacity={0.13} />
      <path d={PIER_SPECK} fill={panel.deep} opacity={0.12} />
      <path d={PIER_HI} fill={panel.hi} opacity={0.4} />
      <path d={PIER_LO} fill={panel.lo} opacity={0.5} />
      <path d={WALL_LOWER} fill={panel.base} />
      <path d={WALL_LOWER} fill={dth("n", "06")} opacity={0.4} />
      <path d={WALL_GRAIN} fill={panel.hi} opacity={0.12} />
      <path d={WALL_SPECK} fill={panel.deep} opacity={0.13} />
      <path d={WALL_JOINTS} fill={panel.lo} opacity={0.45} />
      <path d={WALL_JOINT_HI} fill={panel.hi} opacity={0.3} />
      <path d={SKIRT} fill={panel.lo} />
      <path d={SKIRT_HI} fill={panel.hi} opacity={0.4} />
      <path d={SKIRT_SCUFF} fill="#000" opacity={0.14} />
      <path d={HOOKS} fill={frame.mid} />
      <path d={SOCKETS} fill={panel.hi} />
      <path d={SOCKET_LED} fill={K.green} opacity={0.8} />

      <AOSet set={HEATER_AO} op={0.3} />
      <path d={HEATER} fill={K.grille} opacity={night ? 0.5 : 0.8} />
      <path d={HEATER_SLATS} fill={panel.deep} opacity={0.55} />
      <path d={HEATER_TOP} fill={panel.hi} opacity={0.5} />

      <AOSet set={RACK_AO} op={0.4} />
      <path d={RACK_BAGS} fill={frame.lo} opacity={0.9} />
      <path d={RACK_BAG_TRIM} fill={frame.deep} opacity={0.6} />
      <path d={RACK_BAG_HI} fill={frame.hi} opacity={0.4} />
      <path d={RACK} fill={frame.base} />
      <path d={RACK_HI} fill={frame.hi} opacity={0.5} />
      <path d={RACK_UNDER} fill="#000" opacity={0.25} />
      <path d={RACK_RAIL} fill={K.pole} opacity={0.75} />

      <path d={BLINDS} fill={panel.hi} />
      <path d={WINDOW_FRAMES} fill={frame.base} />
      <path d={WINDOW_FRAME_HI} fill={frame.hi} opacity={0.55} />
      <path d={WINDOW_FRAME_LO} fill={frame.deep} opacity={0.6} />
      <path d={MULLIONS} fill={frame.base} />
      <path d={WINDOW_SEAL} fill={frame.deep} opacity={0.85} />
      <path d={HOPPERS} fill={frame.mid} opacity={0.8} />
      <path d={HOPPER_CATCH} fill={frame.deep} opacity={0.7} />
      <path d={GLASS_SHEEN} fill="#ffffff" opacity={night ? 0.05 : 0.1} />
      <path d={GLASS_SHEEN_2} fill="#ffffff" opacity={night ? 0.03 : 0.07} />
      <path d={GLASS_DECAL} fill={K.white} opacity={0.75} />
      <path d={GLASS_DECAL_MARK} fill={K.red} />
      {rain ? (
        <>
          <path d={GLASS_MIST} fill={K.mist} opacity={night ? 0.16 : 0.22} />
          <path d={GLASS_DRIPS} fill="#e8eef0" opacity={0.3} />
        </>
      ) : null}
      <path d={GLASS_SMUDGE} fill="#ffffff" opacity={night ? 0.05 : 0.08} />
      <path d={GLASS_SCRATCH} fill="#ffffff" opacity={0.22} />
      <path d={SILLS} fill={panel.hi} />
      <path d={SILL_NOSE} fill={panel.hi} />
      <path d={SILL_SHADOW} fill="#000" opacity={0.14} />
      <path d={SILL_RINGS} fill={panel.lo} opacity={0.4} />
      <path d={SILL_ITEMS} fill={frame.lo} opacity={0.9} />
      <path d={SILL_ITEM_LIDS} fill="#5c4a3a" />

      <path d={WC_DOOR} fill={panel.mid} />
      <path d={WC_SEAM} fill={panel.lo} opacity={0.6} />
      <path d={WC_FRAME} fill={frame.base} />
      <path d={WC_SIGN} fill={K.access} />
      <path d={WC_MARK} fill={K.white} />
      <path d={WC_BUTTON} fill={K.access} opacity={0.8} />
      <path d={WC_BUTTON_LED} fill={K.green} opacity={0.7} />
      <path d={END_WALL} fill={panel.mid} />
      <path d={END_DOOR} fill={panel.base} />
      <path d={END_GLASS} fill={night ? "#14171d" : "#2a3038"} />
      <path d={GANGWAY_RIBS} fill="#1b1f26" opacity={0.55} />
      <path d={END_FRAME} fill={frame.base} />

      <Bev set={MAP_SET} mat={panel} />
      <path d={pxPath([[MAP_BOX[0] + 4, MAP_BOX[1] + 4, MAP_BOX[2] - 8, 8]])} fill={K.signBlue} />
      <g transform={`translate(${MAP_BOX[0] + 7} ${MAP_BOX[1] + 6})`}>
        <path d={textPath("SKM TROJMIASTO", 0, 0)} fill={K.white} opacity={0.9} />
      </g>
      <path d={MAP_LINE} fill={K.signBlue} opacity={0.35} />
      <path d={MAP_AHEAD(s.toward)} fill={K.signBlue} />
      <path d={MAP_TICKS} fill={K.signBlue} opacity={0.7} />
      <path d={MAP_DOTS} fill={K.white} opacity={0.8} />
      <path d={MAP_HERE} fill={K.red} />
      <g transform={`translate(${MAP_BOX[0] + 8} ${MAP_BOX[1] + 32})`}>
        <path d={textPath("PRZYMORZE", 0, 0)} fill={panel.deep} opacity={0.8} />
      </g>
      <path d={MAP_GLARE} fill="#ffffff" opacity={0.1} />
      <path d={MAP_SCREWS} fill={frame.deep} opacity={0.7} />
      <path d={TIMETABLE} fill={K.white} opacity={0.85} />
      <path d={TIMETABLE_ROWS} fill={panel.deep} opacity={0.4} />
      <path d={TIMETABLE_RED} fill={K.red} opacity={0.5} />
      <path d={TIMETABLE_GLARE} fill="#ffffff" opacity={0.14} />
      <path d={POSTER} fill={K.white} opacity={0.9} />
      <path d={POSTER_ART} fill={K.signBlue} opacity={0.55} />
      <path d={POSTER_CURL} fill="#000" opacity={0.12} />

      <Bev set={PARTITION_SET} mat={frame} />
      <path d={PARTITION_GLASS} fill={K.glass[ph]} opacity={night ? 0.5 : 0.4} />
      <path d={PARTITION_GRAB} fill={K.pole} opacity={0.9} />

      <path d={PRIORITY_SIGN} fill={K.access} />
      <path d={PRIORITY_MARK} fill={K.white} />
      <path d={FIRST_AID} fill={K.green} opacity={0.9} />
      <path d={FIRST_AID_MARK} fill={K.white} />
      <path d={HAMMER_CASE} fill={frame.lo} opacity={0.6} />
      <path d={HAMMER} fill={K.red} />
      <path d={EXTINGUISHER} fill={K.red} opacity={0.9} />
      <path d={EXTINGUISHER_HI} fill="#e88a80" opacity={0.4} />
      <path d={EXTINGUISHER_LABEL} fill={K.white} opacity={0.5} />
      <path d={DOOR_STICKER} fill={K.white} opacity={0.8} />
      <path d={DOOR_STICKER_ROWS} fill={K.red} opacity={0.7} />
    </g>
  );
}

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
      <Bev set={SEATS_FAR} mat={{ ...SEAT, base: SEAT.mid }} />
      <path d={FAR_HI} fill={SEAT.hi} opacity={0.5} />

      <path d={TABLE_SHADOW} fill="#000" opacity={0.22} />
      <path d={TABLES} fill={panel.base} />
      <path d={TABLE_EDGE} fill={panel.hi} opacity={0.7} />
      <path d={TABLE_TOPS} fill={K.white} opacity={0.85} />
      <path d={CUP_LID} fill="#5c4a3a" />

      <path d={KNEE_SHADE} fill={K.shade} opacity={0.28} />
      <path d={KNEE_DEEP} fill={K.shade} opacity={0.22} />
      <AOSet set={SEAT_AO} op={0.55} />
      <Contact set={SEAT_CONTACT} op={0.5} />

      <path d={SEAT_LEGS} fill={K.shellLo} />
      <path d={SEAT_FEET} fill={K.shell} />

      <path d={SEAT_UNDER} fill="#000" opacity={0.25} />
      <path d={SHELLS} fill={K.shell} />
      <path d={SHELL_HI} fill={K.shellHi} opacity={0.7} />
      <path d={SHELL_RECESS} fill={K.shellLo} opacity={0.6} />
      <path d={SEAT_SCUFF} fill="#000" opacity={0.18} />

      <Bev set={SEATS_NEAR} mat={SEAT} />
      <Bev set={SEATS_NEAR_PRI} mat={SEAT_PRIORITY} />
      <path d={INSERTS} fill={K.insert} />
      <path d={INSERTS_PRI} fill={SEAT_PRIORITY.lo} />
      <path d={MOQUETTE_MOTIF} fill={K.insert} opacity={0.5} />
      <path d={MOQUETTE_SPECK} fill={K.moquetteHi} opacity={0.28} />
      <path d={MOQUETTE_WEAVE} fill={K.fleck} opacity={0.3} />
      <path d={INSERT_WEAVE} fill={K.fleck} opacity={0.22} />
      <path d={BACK_SHADE} fill={SEAT.deep} opacity={0.5} />
      <path d={SEAT_POCKETS} fill={SEAT.deep} opacity={0.55} />
      <path d={BACK_SEAM} fill={SEAT.deep} opacity={0.45} />
      <path d={BACK_WELT} fill={K.moquetteHi} opacity={0.5} />

      <path d={CUSHIONS} fill={SEAT.base} />
      <path d={CUSHION_HI} fill={K.moquetteHi} opacity={0.6} />
      <path d={CUSHION_LIP} fill={SEAT.deep} opacity={0.7} />
      <path d={PAN_NOSE} fill={K.moquetteHi} opacity={0.4} />
      <path d={SEAT_PILE} fill={SEAT.deep} opacity={0.35} />

      <path d={HEAD_SLOT} fill="#000" opacity={0.35} />
      <path d={HEADRESTS} fill={SEAT.mid} />
      <path d={HEADRESTS_PRI} fill={SEAT_PRIORITY.mid} />
      <path d={PRIORITY_STRIPE} fill={K.priorityHi} opacity={0.7} />
      <path d={HEAD_HI} fill={K.moquetteHi} opacity={0.6} />
      <path d={SEAT_POLISH} fill={K.moquetteHi} opacity={0.4} />
      <path d={SEAT_GRABS} fill={K.pole} opacity={0.9} />

      <path d={ARM_BRACKETS} fill={K.shellLo} />
      <path d={ARMRESTS} fill={K.shell} />
      <path d={ARMREST_HI} fill={K.shellHi} opacity={0.8} />

      <path d={SEAT_LEFTOVERS} fill={K.white} opacity={0.55} />
      <path d={STUB_RAILS} fill={K.pole} opacity={0.85} />
      <path d={RAIL_BRUSH} fill={K.poleHi} opacity={0.25} />
      <path d={STUB_RAIL_HI} fill={K.poleHi} opacity={0.7} />

      <AOSet set={PERCH_AO} op={0.45} />
      <Contact set={PERCH_CONTACT} op={0.4} />
      <path d={PERCH_FOOTRAIL} fill={K.shellLo} />
      <path d={PERCH_FOOT_HI} fill={K.shellHi} opacity={0.6} />
      <path d={PERCH_STANDARDS} fill={K.shell} />
      <path d={PERCH_STANDARD_HI} fill={K.shellHi} opacity={0.7} />
      <path d={PERCH_LIP} fill={SEAT.deep} opacity={0.7} />
      <path d={PERCH} fill={SEAT.base} />
      <path d={PERCH_MOTIF} fill={K.insert} opacity={0.45} />
      <path d={PERCH_BRUSH} fill={K.shellHi} opacity={0.22} />
      <path d={PERCH_HI} fill={K.moquetteHi} opacity={0.6} />
      <path d={PERCH_WEAR} fill={K.moquetteHi} opacity={0.45} />

      <Contact set={POLE_CONTACT} op={0.4} />
      <path d={POLES} fill={K.pole} />
      <path d={POLE_BRUSH} fill={K.poleHi} opacity={0.22} />
      <path d={POLE_HI} fill={K.poleHi} />
      <path d={POLE_LO} fill="#000" opacity={0.18} />
      <path d={POLE_COLLAR} fill={frame.mid} />
      <path d={POLE_HANDS} fill="#000" opacity={0.12} />
      <path d={POLE_JOINT} fill={frame.mid} />

      <path d={MPB_RAIL} fill={K.pole} opacity={0.85} />
      <path d={MPB_RAIL_HI} fill={K.poleHi} opacity={0.7} />
      <path d={TIPUPS} fill={SEAT.mid} />
      <path d={TIPUP_HI} fill={K.moquetteHi} opacity={0.5} />
      <Bicycle set={MPB_BIKE} ph={ph} colour="#3f6f52" />

      <Bev set={DOORS} mat={panel} />
      <path d={DOOR_GRAIN} fill={panel.hi} opacity={0.12} />
      <path d={DOOR_SPLIT} fill={frame.deep} />
      <path d={DOOR_RUBBER} fill="#1b1f26" opacity={0.7} />
      <path d={DOOR_EDGE} fill={K.nosing} opacity={0.9} />
      <path d={DOOR_HEAD} fill={frame.lo} />
      <path d={DOOR_HEAD_SHADOW} fill="#000" opacity={0.25} />
      <path d={DOOR_RELEASE} fill={K.red} opacity={0.85} />
      <path d={DOOR_EMERGENCY} fill={K.white} opacity={0.75} />
      <path d={DOOR_BUTTON_RING} fill={frame.deep} />
      <path d={DOOR_BUTTON} fill="#4a5a4e" />
      <path d={DOOR_BUTTON_LED} fill={K.green} opacity={0.65} />
      <path d={DOOR_NOSING} fill={K.nosing} />
      <path d={KASOWNIK} fill={K.kasownik} />
      <path d={KASOWNIK_SIDE} fill="#000" opacity={0.2} />
      <path d={KASOWNIK_HI} fill="#f2a05c" opacity={0.6} />
      <path d={KASOWNIK_SLOT} fill="#15171b" />
      <path d={KASOWNIK_RUB} fill="#f2c9a0" opacity={0.35} />
      <path d={KASOWNIK_LED} fill={K.green} />
      <path d={INTERCOM} fill={frame.mid} />
      <path d={INTERCOM_MESH} fill={frame.deep} opacity={0.7} />

      <Contact set={BIN_CONTACT} op={0.4} />
      <path d={BIN} fill={frame.mid} />
      <path d={BIN_SIDE} fill="#000" opacity={0.2} />
      <path d={BIN_HI} fill={frame.hi} opacity={0.5} />
      <path d={BIN_SLOT} fill="#15171b" />
      <path d={BIN_FULL} fill={K.white} opacity={0.7} />
      <path d={FLOOR_BAG} fill={K.case} />
      <path d={FLOOR_BAG_HI} fill="#6d5c50" opacity={0.5} />
      <Contact set={LUGGAGE_CONTACT} op={0.4} />
      <path d={LUGGAGE} fill={K.case} />
      <path d={LUGGAGE_SIDE} fill="#000" opacity={0.22} />
      <path d={LUGGAGE_TRIM} fill={frame.mid} opacity={0.7} />
      <path d={LUGGAGE_HI} fill="#6d5c50" opacity={0.5} />

      <DaylightWash ph={ph} lit={s.lights} />
    </g>
  );
}

function Passengers({ s }: { s: TrainState }) {
  const shown = SEATED.filter((r) => s.crowd >= r.from);
  return (
    <g>
      {shown.map((r) => {
        const npc = PASSENGERS[r.npc as keyof typeof PASSENGERS];
        if (!npc) return null;
        return (
          <NpcActor
            key={r.id}
            npc={npc}
            objId={r.id}
            x={r.x}
            y={FLOOR}
            facing={r.facing}
            shadow={false}
            action={npc.actions?.sit ? "sit" : undefined}
          />
        );
      })}
    </g>
  );
}

function Floor({ ph, s }: { ph: Ph; s: TrainState }) {
  const night = ph === "night";
  const rain = s.weather === "rain";
  return (
    <g>
      <path d={FLOOR_BAND} fill={night ? "#4f4c48" : K.floorBase} />
      <path d={FLOOR_BAND} fill={dth("n", "12")} opacity={0.32} />
      <path d={LINO_SPECK} fill="#8d8a84" opacity={0.2} />
      <path d={LINO_SPECK_2} fill="#3f3d3a" opacity={0.16} />
      <path d={FLOOR_UNDERSEAT} fill="#000" opacity={0.16} />
      <path d={FLOOR_JOINTS} fill="#000" opacity={0.07} />
      <path d={FLOOR_JOINT_HI} fill="#ffffff" opacity={0.05} />
      <path d={AISLE_WEAR} fill={dth("n", "12")} opacity={0.3} />
      <path d={FLOOR_NEAR} fill="#000" opacity={0.12} />
      <path d={STAND_FLOOR} fill={K.shellLo} opacity={0.22} />
      <path d={STAND_FLOOR_EDGE} fill={K.nosing} opacity={0.35} />
      <path d={FLOOR_MPB} fill={K.access} opacity={0.4} />
      <path d={FLOOR_DOORMAT} fill={K.nosing} opacity={0.25} />
      <path d={FLOOR_KEEPCLEAR} fill={K.nosing} opacity={0.3} />
      {s.lights ? <path d={FLOOR_SHEEN} fill={K.led} opacity={0.1} /> : null}
      <path d={FLOOR_ARCS} fill="#000" opacity={0.08} />
      <path d={FLOOR_GUM} fill="#000" opacity={0.18} />
      <path d={FLOOR_LITTER} fill={K.white} opacity={0.5} />
      <path d={FLOOR_TICKET} fill={K.white} opacity={0.45} />
      <path d={FLOOR_SEEDS} fill="#3a3128" opacity={0.5} />
      {rain ? (
        <>
          <path d={FLOOR_WET} fill={K.wet} opacity={0.28} />
          <path d={FLOOR_PRINTS} fill={K.wet} opacity={0.22} />
        </>
      ) : null}

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

function TrainInterior({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = trainState(world);
  return (
    <LayeredScene
      farBackground={
        <TheView ph={ph} lit={s.lights} dir={s.toward === "gdynia" ? 1 : -1} weather={s.weather} />
      }
      middleBackground={<Saloon ph={ph} s={s} />}
      ground={<Floor ph={ph} s={s} />}
      staticObjects={<Fittings ph={ph} s={s} />}
      gameplayObjects={<Passengers s={s} />}
      parallax={{ farBackground: 1, middleBackground: 1 }}
    />
  );
}

const NEAR_SCALE = 1.35;
const AISLE = FLOOR + 12;

const NEAR_SEAT_D = Math.round(SEAT_D * NEAR_SCALE);
const NEAR_KNEE = Math.round(KNEE * NEAR_SCALE);
const NEAR_BAY_W = NEAR_SEAT_D * 2 + NEAR_KNEE;
const NEAR_BACK_T = Math.round(BACK_T * NEAR_SCALE);
const NEAR_PAN_D = Math.round(PAN_D * NEAR_SCALE);

const NEAR_SHOULDER = FRAME_H - 12;
const NEAR_BAY_X = Array.from(
  { length: Math.ceil(W / NEAR_BAY_W) + 2 },
  (_, i) => -NEAR_BAY_W + Math.round(NEAR_BAY_W / 2) + i * NEAR_BAY_W,
);
const NEAR_SHOULDERS: Rect[] = NEAR_BAY_X.flatMap((x) => [
  [x, NEAR_SHOULDER, NEAR_BACK_T + 4, FRAME_H - NEAR_SHOULDER] as Rect,
  [
    x + NEAR_BAY_W - NEAR_BACK_T - 4,
    NEAR_SHOULDER,
    NEAR_BACK_T + 4,
    FRAME_H - NEAR_SHOULDER,
  ] as Rect,
]);
const NEAR_SHOULDER_CAPS: Rect[] = NEAR_BAY_X.flatMap((x) => [
  [x - 1, NEAR_SHOULDER - 5, NEAR_BACK_T + 6, 6] as Rect,
  [x + NEAR_BAY_W - NEAR_BACK_T - 5, NEAR_SHOULDER - 5, NEAR_BACK_T + 6, 6] as Rect,
]);
const NEAR_SHOULDER_HI = pxPath(
  NEAR_SHOULDER_CAPS.map(([x, sy, w]) => [x + 1, sy, w - 2, 1] as Rect),
);
const NEAR_SHOULDER_SET = bevelPaths(NEAR_SHOULDERS);

const FRONT_BAY_X = Z.bay[1] + 27;
const FRONT_SEAT_TOP = FRAME_H - 40;
const FRONT_SEAT: Rect[] = [
  [FRONT_BAY_X, FRONT_SEAT_TOP, NEAR_BACK_T + 3, FRAME_H - FRONT_SEAT_TOP],
  [FRONT_BAY_X + 2, FRONT_SEAT_TOP - 1, NEAR_BACK_T + 3, FRAME_H - FRONT_SEAT_TOP],
  [
    FRONT_BAY_X + NEAR_BAY_W - NEAR_BACK_T - 3,
    FRONT_SEAT_TOP,
    NEAR_BACK_T + 3,
    FRAME_H - FRONT_SEAT_TOP,
  ],
  [
    FRONT_BAY_X + NEAR_BAY_W - NEAR_BACK_T - 5,
    FRONT_SEAT_TOP - 1,
    NEAR_BACK_T + 3,
    FRAME_H - FRONT_SEAT_TOP,
  ],
];
const FRONT_SEAT_CAPS: Rect[] = [
  [FRONT_BAY_X - 2, FRONT_SEAT_TOP - 8, NEAR_BACK_T + 8, 9],
  [FRONT_BAY_X + NEAR_BAY_W - NEAR_BACK_T - 6, FRONT_SEAT_TOP - 8, NEAR_BACK_T + 8, 9],
];
const FRONT_SEAT_CAP_HI = pxPath(
  FRONT_SEAT_CAPS.map(([x, cy, w]) => [x + 2, cy, w - 4, 2] as Rect),
);
const FRONT_SEAT_PANS: Rect[] = [
  [FRONT_BAY_X + NEAR_BACK_T + 3, FRAME_H - 20, NEAR_PAN_D, 6],
  [FRONT_BAY_X + NEAR_BAY_W - NEAR_BACK_T - 3 - NEAR_PAN_D, FRAME_H - 20, NEAR_PAN_D, 6],
];
const FRONT_SEAT_ARMS: Rect[] = [
  [FRONT_BAY_X + 2, FRAME_H - 30, NEAR_SEAT_D - 6, 4],
  [FRONT_BAY_X + NEAR_BAY_W - NEAR_SEAT_D + 4, FRAME_H - 30, NEAR_SEAT_D - 6, 4],
];
const FRONT_SEAT_GRAB: Rect[] = [
  [FRONT_BAY_X, FRONT_SEAT_TOP - 12, NEAR_BACK_T + 4, 4],
  [FRONT_BAY_X + NEAR_BAY_W - NEAR_BACK_T - 4, FRONT_SEAT_TOP - 12, NEAR_BACK_T + 4, 4],
];
const FRONT_SET = bevelPaths(FRONT_SEAT);
const FRONT_WEAVE = pxPath(FRONT_SEAT.flatMap((r) => weave(r, 4)));

const FRONT_POLE: Rect[] = [[Z.bay[2] + 60, 0, 7, FRAME_H]];
const FRONT_POLE_HI: Rect[] = [[Z.bay[2] + 60, 0, 1, FRAME_H]];
const FRONT_POLE_HAND: Rect[] = [[Z.bay[2] + 60, 60, 7, 46]];
const FRONT_RACK: Rect[] = [
  [0, 0, W, 5],
  [0, 5, W, 2],
];
const FRONT_RACK_HI: Rect[] = [[0, 0, W, 1]];
const FRONT_RAIL: Rect[] = [[0, 9, W, 4]];
const FRONT_RAIL_HI: Rect[] = [[0, 9, W, 1]];
const DEPTH_ENDS = [
  pxPath([
    [0, 0, 150, FRAME_H],
    [W - 150, 0, 150, FRAME_H],
  ]),
  pxPath([
    [0, 0, 88, FRAME_H],
    [W - 88, 0, 88, FRAME_H],
  ]),
  pxPath([
    [0, 0, 40, FRAME_H],
    [W - 40, 0, 40, FRAME_H],
  ]),
];
const NEAR_MOTIF = pxPath(motif(NEAR_SHOULDER_CAPS));
const FRONT_MOTIF = pxPath(motif([...FRONT_SEAT_CAPS, ...FRONT_SEAT_PANS]));
const VIGNETTE = vignettePaths(W, FRAME_H);
const NEAR_STRAP_X = [Z.map + 40, Z.bay[1] + 200, Z.doorR - 120] as const;

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
      <path d={pxPath(FRONT_RACK_HI)} fill={frame.hi} opacity={0.4} />
      <path d={pxPath(FRONT_RAIL)} fill={K.pole} opacity={0.7} />
      <path d={pxPath(FRONT_RAIL_HI)} fill={K.poleHi} opacity={0.6} />

      <path d={pxPath(NEAR_SHOULDER_CAPS)} fill={SEAT.mid} />
      <path d={NEAR_MOTIF} fill={K.insert} opacity={0.4} />
      <path d={NEAR_SHOULDER_HI} fill={K.moquetteHi} opacity={0.5} />
      <Bev set={NEAR_SHOULDER_SET} mat={{ ...SEAT, base: SEAT.lo, hi: SEAT.mid }} />

      <path d={pxPath(FRONT_SEAT_ARMS)} fill={K.shellLo} />
      <path d={pxPath(FRONT_SEAT_PANS)} fill={SEAT.lo} />
      <path d={pxPath(FRONT_SEAT_CAPS)} fill={SEAT.mid} />
      <path d={FRONT_SEAT_CAP_HI} fill={K.moquetteHi} opacity={0.45} />
      <Bev set={FRONT_SET} mat={{ ...SEAT, base: SEAT.lo, hi: SEAT.mid }} />
      <path d={FRONT_WEAVE} fill={K.fleck} opacity={0.16} />
      <path d={FRONT_MOTIF} fill={K.insert} opacity={0.35} />
      <path d={pxPath(FRONT_SEAT_GRAB)} fill={K.pole} opacity={0.8} />

      <path d={pxPath(FRONT_POLE)} fill={K.pole} opacity={0.85} />
      <path d={pxPath(FRONT_POLE)} fill="#000" opacity={0.2} />
      <path d={pxPath(FRONT_POLE_HI)} fill={K.poleHi} opacity={0.5} />
      <path d={pxPath(FRONT_POLE_HAND)} fill="#000" opacity={0.14} />
      <path d={DEPTH_ENDS[0]} fill="#0d1016" opacity={0.1} />
      <path d={DEPTH_ENDS[1]} fill="#0d1016" opacity={0.1} />
      <path d={DEPTH_ENDS[2]} fill="#0d1016" opacity={0.12} />
      <Vignette set={VIGNETTE} strength={ph === "night" ? 1 : 0.6} />
    </svg>
  );
}

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
  const CAST: Record<Ph, { fill: string; op: number } | null> = {
    dawn: { fill: "#8d95c4", op: 0.16 },
    day: null,
    dusk: { fill: "#e0925e", op: 0.2 },
    night: { fill: "#101828", op: 0.26 },
  };
  const cast = CAST[ph];
  return (
    <>
      {cast ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} ${FRAME_H}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          <rect x={0} y={0} width={W} height={FRAME_H} fill={cast.fill} opacity={cast.op} />
          {ph === "dusk" ? (
            <path
              d={pxPath([[0, SEAT_BACK - 2, W, 3] as Rect, [0, GLASS_BOTTOM + 2, W, 2] as Rect])}
              fill="#ffb877"
              opacity={0.3}
            />
          ) : null}
        </svg>
      ) : null}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${FRAME_H}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
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
        {NEAR_STRAP_X.map((x, i) => (
          <path
            key={`near${x}`}
            d={pxPath([
              [x, 13, 3, 15],
              [x - 3, 28, 9, 9],
              [x - 1, 31, 5, 4],
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
      {!dialogueOpen ? <Announce scale={scale} toward={s.toward} /> : null}
    </>
  );
}

function Announce({ scale, toward }: { scale: number; toward: TrainState["toward"] }) {
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
  return <Monologue kind="announce" scale={scale} text={text} />;
}

export const TRAIN_SCENE: RuntimeSceneDef<WorldState> = {
  id: "train",
  width: W,
  ground: {
    top: FLOOR,
    bottom: FLOOR + 22,
    profile: [
      { x: 0, top: FLOOR - 4, bottom: FLOOR + 18 },
      { x: Z.doorL - 40, top: FLOOR - 4, bottom: FLOOR + 18 },
      { x: Z.doorL + 30, top: FLOOR, bottom: FLOOR + 22 },
      { x: Z.doorR - 30, top: FLOOR, bottom: FLOOR + 22 },
      { x: Z.doorR + 40, top: FLOOR - 4, bottom: FLOOR + 18 },
      { x: W, top: FLOOR - 4, bottom: FLOOR + 18 },
    ],
    zones: [
      { x0: Z.mpb - 10, x1: Z.mpb + 80, kind: "mpb" },
      { x0: STAND.x0, x1: STAND.x1, kind: "rubber", speed: 0.96 },
      { x0: LEAN.x0, x1: LEAN.x1, kind: "rubber", speed: 0.96 },
      { x0: 0, x1: Z.doorL + 60, kind: "rubber", speed: 0.92 },
      { x0: Z.doorR - 60, x1: W, kind: "rubber", speed: 0.92 },
      { x0: 0, x1: W, kind: "lino" },
    ],
    blockers: [
      { x0: Z.mpb - 6, y0: FLOOR, x1: Z.mpb + 70, y1: FLOOR + 12 },
      { x0: PERCH_X0, y0: FLOOR, x1: PERCH_X0 + PERCH_W, y1: FLOOR + 8 },
      { x0: FRONT_BAY_X, y0: FLOOR + 14, x1: FRONT_BAY_X + NEAR_BAY_W, y1: FLOOR + 22 },
      { x0: Z.bay[2] + 58, y0: FLOOR + 8, x1: Z.bay[2] + 69, y1: FLOOR + 22 },
      { x0: Z.bin - 4, y0: FLOOR, x1: Z.bin + 20, y1: FLOOR + 10 },
      { x0: Z.end + 30, y0: FLOOR - 4, x1: Z.end + 78, y1: FLOOR + 12 },
    ],
  },
  actors: [
    npcToActor(PASSENGERS.konduktor, {
      x: Z.doorR - 118,
      y: AISLE,
      facing: -1,
      patrol: { from: Z.doorR - 138, to: Z.doorR - 98, speed: 9, pauseMs: 5200 },
    }),
    ...STANDING.map((p, i) =>
      npcToActor(PASSENGERS[p.npc as keyof typeof PASSENGERS], {
        x: p.x,
        y: p.y,
        facing: i % 2 === 0 ? 1 : -1,
        visible: (w: WorldState) => trainState(w).crowd >= p.from,
      }),
    ),
  ],
  enter: ({ updateWorld, counterpart }) => {
    const hour = new Date().getHours();
    const ph = dayPhase(hour);
    updateWorld((w) => ({
      ...w,
      train: {
        toward: boardingState(counterpart, hour),
        crowd: crowdFor(hour),
        seated: false,
        lights: ph === "night" || ph === "dusk" || ph === "morning",
        weather: w.train?.weather ?? "clear",
      },
    }));
  },
  artKey: (w, ph) => {
    const s = trainState(w);
    return [ph, s.toward, s.crowd, s.lights ? 1 : 0, s.seated ? 1 : 0, s.weather].join("|");
  },
  objects: [
    {
      id: "train-exit-l",
      kind: "trainExit",
      priority: 2,
      x: Z.doorL,
      range: 30,
      approachY: AISLE,
      to: { scene: "station", spawnX: 520 },
    },
    { id: "train-map", kind: "routemap", priority: 2, x: Z.map - 2, range: 30, approachY: AISLE },
    ...SEAT_X.filter((_, i) => i % 2 === 0).map((x, i) => ({
      id: `train-seat-${i + 1}`,
      kind: "sport",
      action: "sit",
      face: 1 as const,
      x: x + SEAT_D + Math.round(KNEE / 2),
      range: 40,
      approachY: FLOOR + 2,
    })),
    {
      id: "train-window",
      kind: "flavor",
      x: LEAN_WIN[0] + Math.round(LEAN_WIN[2] / 2),
      range: 60,
      markerY: GLASS_TOP + 10,
      approachY: FLOOR,
    },
    { id: "train-pole", kind: "flavor", x: STAND.x0 + 12, range: 18, approachY: AISLE },
    {
      id: "train-perch",
      kind: "sport",
      action: "lean",
      face: 1 as const,
      x: PERCH_X0 + Math.round(PERCH_W / 2),
      range: 52,
      approachY: FLOOR + 4,
    },
    {
      id: "train-display",
      kind: "flavor",
      x: Z.doorL + 135,
      range: 40,
      markerY: CIP_BOX[1] + 8,
      approachY: AISLE,
    },
    { id: "train-bin", kind: "flavor", x: Z.bin + 11, range: 18, approachY: FLOOR + 4 },
    { id: "train-hammer", kind: "flavor", x: HAMMER_X + 7, range: 14, approachY: FLOOR },
    { id: "train-kasownik", kind: "flavor", x: Z.doorL + 59, range: 20, approachY: AISLE },
    { id: "train-bike", kind: "flavor", x: Z.mpb + 36, range: 44, approachY: FLOOR + 16 },
    { id: "train-timetable", kind: "flavor", x: TT_X + 15, range: 24, approachY: FLOOR },
    {
      id: "train-poster",
      kind: "flavor",
      x: LEAN.x1 - 23,
      range: 26,
      markerY: GLASS_BOTTOM + 6,
      approachY: FLOOR,
    },
    { id: "train-wc", kind: "flavor", x: Z.wc, range: 34, approachY: AISLE },
    {
      id: "train-konduktor",
      kind: "konduktor",
      priority: 2,
      x: Z.doorR - 118,
      range: 44,
      approachY: AISLE,
    },
    { id: "train-luggage", kind: "flavor", x: Z.end + 46, range: 26, approachY: FLOOR + 14 },
    { id: "train-gangway", kind: "flavor", x: Z.end + 41, range: 30, approachY: AISLE },
    { id: "train-exit-r", kind: "flavor", x: Z.doorR, range: 28, approachY: AISLE },
  ],
  Component: ({ world, phase }) => <TrainInterior world={world} phase={phase} />,
  darkness: () => 0,
  Foreground: (p) => <TrainFront phase={p.phase} />,
  Effects: TrainEffects,
};
