import { useEffect, useMemo, useState } from "react";
import {
  AOSet,
  aoPaths,
  Bev,
  Bicycle,
  BikeRack,
  bevelPaths,
  bicycle,
  bikeRack,
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
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  steppedQuad,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { gamePhase } from "@/lib/body";
import type { WorldState } from "@/lib/worldState";
import { propActor, SUITCASE_PALETTE, suitcaseMap, TROLLEY_PALETTE, trolleyMap } from "./bandProps";
import { NPCS } from "./npcs";
import { planMotion, SkmUnit } from "./skmTrain";
import {
  armStation,
  boardingOpen,
  CYCLE_S,
  DOOR_X,
  kt,
  STOP_X,
  secondsToDeparture,
  stationCycleOffsetS,
  stationPhase,
  TIMETABLE,
} from "./stationTimetable";

// --- GDAŃSK PRZYMORZE-UNIWERSYTET / the SKM platform -------------------------

/**
 * The northbound platform at Przymorze-Uniwersytet, one stop up the line from
 * Oliwa, at the point where the SKM runs in a shallow cutting between the
 * university and the Przymorze slab blocks.
 *
 * It is the third exterior in the game and the first one with a horizon: the
 * street and the district are both closed in by facades on the far side, and
 * this is not. The track runs away to the left toward Gdańsk and to the right
 * toward Sopot and Gdynia, and because there is nothing on the far side of the
 * cutting but a wire fence, you can see across Przymorze from here — the
 * falowiec, the trees along Obrońców Wybrzeża, and Alchemia standing up out of
 * Oliwa two kilometres south.
 *
 * ==================================================================
 * SCALE. Same key as the district and the street: a 1.75 m adult is 67 px, so
 *
 *     PPM = 38 px per metre, or 2.6 cm per pixel.
 *
 * Use `m()` for anything with a real dimension. The reference set for a
 * railway, all verified against the key:
 *
 *     adult                 1.75 m    67 px     platform height    0.76 m   29 px
 *     standard gauge        1.435 m   55 px     rail height        0.17 m    6 px
 *     sleeper pitch         0.60 m    23 px     sleeper length     2.60 m   99 px
 *     EMU body width        2.88 m   109 px     EMU roof           3.70 m  141 px
 *     EMU door opening      1.30 m    49 px     door head          2.00 m   76 px
 *     catenary height       5.20 m   198 px     mast pitch        55.00 m 2090 px
 *     platform bench        0.45 m    17 px     bin                1.00 m   38 px
 *     shelter head          2.40 m    91 px     name board         0.40 m   15 px
 *     tactile strip         0.60 m    23 px     yellow line        0.10 m    4 px
 *
 * The frame is 180 px — 4.74 m — and the player's feet are at 150, so there is
 * 3.95 m of air above the platform. The catenary at 5.2 m therefore does not
 * fit, the masts run off the top, and the wires are never seen from below in
 * this scene: they are drawn only in the far plane, over the cutting, where
 * perspective has brought them down into frame. That is the correct crop and
 * not a compromise.
 * ==================================================================
 *
 * GEOMETRY. This is the one thing to understand before changing anything here.
 * A platform is 0.76 m above the rail, and the player is standing on it, so the
 * track is *behind and below* — which in a side elevation means the rails sit
 * a few pixels above the platform surface line and are then hidden by it.
 *
 *     y=  0..62    sky
 *     y= 62..104   the far side: Przymorze, the falowiec, trees, Alchemia
 *     y=104..126   the cutting's far wall, the fence, the catenary masts
 *     y=126..150   THE TRACK: ballast, sleepers, both rails
 *     y=150        RAIL HEAD, and the platform surface line — the walking line
 *     y=150..180   the platform surface, seen in a shallow plan
 *
 * A train on this track has its wheels on y=150 and its body from 148 up to
 * 148 − 141 = 7, so it very nearly fills the frame and its roof is the last
 * thing in it. When a train is standing at the platform it hides the whole
 * background, which is exactly what a train does, and it is why the scene is
 * written so there is no train in it most of the time.
 *
 * FIVE PLANES — and the arithmetic that decides what goes in which.
 *
 * A parallax layer with factor f is drawn at scene x + (1−f)·camX, so content at
 * layer-x X is on screen only while X ∈ [f·camX, f·camX + viewportWidth]. With a
 * 2000 px platform, a 378 px viewport and f = 0.3, that means the far layer only
 * ever shows x 0…860 — everything drawn beyond it is invisible from every
 * position on the platform. The first version of this scene had Alchemia at
 * x = 1206 and three catenary masts at 190, 874 and 1558, and consequently
 * showed the towers never and the masts once.
 *
 * So the rule is: the further back a plane is, the *narrower* the strip of it
 * that will ever be seen, and anything physically beside the track belongs at
 * f = 1 no matter how tall it is.
 *
 *   farBackground (0.15) — sky, Alchemia, the falowiec, the tree line, the
 *     university. Two kilometres out. Only x 0…620 is ever on screen, so all of
 *     it lives in there and it drifts slowly past as the player walks.
 *   middleBackground (0.85) — the cutting's far wall, the palisade fence, the
 *     road and its sodium lamps, and the bridge at the Gdańsk end. Nearly local,
 *     so it spans the whole platform and the bridge is only in shot from the end
 *     it is actually at.
 *   ground (1.0) — the track, the platform, the coping, the tactile strip, the
 *     catenary masts and the platform lighting. All hitboxes here.
 *   staticObjects (1.0) — shelter, benches, bins, signage, the biletomat, the
 *     poster drum, the stair down to the underpass.
 *   gameplayObjects (1.0) — the train, when there is one, and the people.
 *
 * LIGHTING PREMISE. The cutting runs north–south, so the sun crosses it rather
 * than running along it: at dawn the east side of everything is lit and the
 * shadows fall left across the track, at midday everything is flat and the rail
 * heads glare, at dusk the shadows are long to the right and the falowiec's
 * west face is on fire. After dark the platform is lit by its own mast
 * luminaires, which on SKM are a hard cold white every eighteen metres, and by
 * the amber sodium of Obrońców Wybrzeża behind the fence — two temperatures,
 * cold above and warm behind, which is what a Polish station looks like at
 * night and the single most recognisable thing in the scene.
 *
 * STATE. Eight reads, all defensive; `world.station` need not exist.
 *
 *   weather    clear → overcast → rain → wet   the biggest change here
 *   season     green → autumn → bare           trees, and what is on the slabs
 *   crowd      0..3                            who is waiting
 *   lamps      auto → on → off
 *   board      boolean                         whether the CIP display is lit
 *   litter     0..2                            the state of the bin
 *   pigeons    boolean                         under the shelter roof
 *   announce   boolean                         the PA is working today
 *
 * WALKING. The platform has depth now: a ground band from 152 to 170, which is
 * the strip between the tactile line and the drainage channel — about half a
 * metre of drawn platform standing in for the three real metres behind the
 * yellow line. All furniture is planted at the *back* of the band (its drawn
 * baseline is the walking line at 150), so each big piece gets a shallow
 * blocker across the back lane and the player walks in front of it, which is
 * also the order the paint happens in. The one exception is the stair opening,
 * which is a hole in the middle of the platform: its blocker covers the front
 * lanes and the player passes behind it, along the lip.
 *
 * BUDGET. ~640 nodes at the busiest state (rain, autumn, crowd 3, night),
 * ~58 SMIL animations of which the trains are three and the timetable-driven
 * ones (signal, pigeons, doors) all run off the same negative-begin clock.
 * Zero gradients, zero ellipses, zero circles. The departure text is the one
 * live React element and it repaints only when a minute ticks over.
 */

/* ================================================================== *
 * key, palette, geometry
 * ================================================================== */

/** Pixels per metre. Do not change without redrawing everything. */
const PPM = 38;
/** A real dimension, in pixels, rounded to the grid. */
const m = (metres: number) => Math.round(metres * PPM);

/**
 * 52.6 m — 2000 px — standing in for the 210 m of a real four-car SKM platform
 * at this side-scroller's compression, and written in metres rather than as
 * 2000 so the next person can see the key it was laid out with.
 */
const W = m(52.6);

/** The one horizontal line everything is measured from: the rail head. */
const RAIL_Y = 150;

/**
 * Landmarks along the platform, in scene x. Named because half the file refers
 * to them and a platform laid out with literals drifts the first time anything
 * is inserted.
 */
const Z = {
  /** the stair down to the underpass, at the Gdańsk end */
  stairs: 150,
  /** the station name board on its post */
  nameBoard: 330,
  /** the ticket machine */
  biletomat: 470,
  /** the poster drum */
  drum: 585,
  /** the shelter: glass back, steel frame, bench inside */
  shelterL: 660,
  shelterR: 980,
  /** the departure display hangs off the shelter's Sopot end */
  board: 1010,
  /** the open middle of the platform */
  midBench: 1180,
  bin: 1290,
  /** the second name board, because platforms have two */
  nameBoard2: 1430,
  /** the far end, where the platform ramps down and the fence starts */
  rampL: 1780,
  end: 1960,
} as const;

/** Catenary mast positions — every 55 m, which at this key is 2090 px, so
 * this is one every 410 px: the compressed spacing a side-scroller needs to
 * read as a railway rather than as one lonely pole. */
const MASTS = [150, 560, 970, 1380, 1790] as const;

const K = {
  /**
   * The sky in four stepped bands, top to horizon, same stops as the engine's
   * PhaseSky with one interpolated so distance has four rungs to climb.
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
  /** SKM house colours: the yellow-and-blue of the Trójmiasto units. */
  skmBlue: "#12447c",
  skmBlueHi: "#1e5c9e",
  skmYellow: "#f2c218",
  skmYellowHi: "#ffdb52",
  /** PKP / SKM signage blue, which is darker than the livery */
  signBlue: "#0e3566",
  white: "#f2f2ee",
  cream: "#e8e2d2",
  /** the platform's own yellow safety line, repainted often and always chipped */
  safety: "#e8c445",
  safetyWorn: "#c9a52e",
  /** CIP departure display: amber dot matrix */
  led: "#ffb03a",
  ledDim: "#8a5f1e",
  ledGreen: "#7ee08c",
  /** status-lamp red — punchier than signal red, same stop as elektrykow's */
  ledRed: "#ff5050",
  red: "#c94040",
  rust: "#8a6a48",
  /** rail head, polished by traffic — the brightest thing in the scene by day */
  railTop: "#cdd2d6",
  railTopNight: "#5f666c",
} as const;

/** Concrete, brought toward the sky by distance for aerial perspective. */
const CONC: Record<Ph, Mat> = {
  dawn: dim(M.concrete, K.sky.dawn[3], 0.1),
  day: M.concrete,
  dusk: dim(M.concrete, K.sky.dusk[3], 0.16),
  night: dim(M.concrete, K.sky.night[1], 0.62),
};
/** Galvanised steel: masts, shelter frame, handrails. */
const GALV: Record<Ph, Mat> = {
  dawn: dim(M.steel, K.sky.dawn[2], 0.12),
  day: M.steel,
  dusk: dim(M.steel, K.sky.dusk[2], 0.2),
  night: dim(M.steel, K.sky.night[1], 0.58),
};
/** The render on the slab blocks across the cutting. */
const SLAB: Record<Ph, Mat> = {
  dawn: dim(M.render, K.sky.dawn[3], 0.3),
  day: dim(M.render, K.sky.day[3], 0.22),
  dusk: dim(M.render, K.sky.dusk[3], 0.34),
  night: dim(M.render, K.sky.night[1], 0.66),
};
/** Alchemia's dark composite cladding, two kilometres out and hazed. */
const CLAD: Record<Ph, Mat> = {
  dawn: dim(M.graphite, K.sky.dawn[2], 0.52),
  day: dim(M.graphite, K.sky.day[2], 0.44),
  dusk: dim(M.graphite, K.sky.dusk[1], 0.5),
  night: dim(M.graphite, K.sky.night[1], 0.5),
};
const LEAF: Record<Ph, Mat> = {
  dawn: dim(M.leaf, K.sky.dawn[3], 0.28),
  day: dim(M.leaf, K.sky.day[3], 0.18),
  dusk: dim(M.leaf, K.sky.dusk[2], 0.34),
  night: dim(M.leaf, K.sky.night[1], 0.7),
};

/* ================================================================== *
 * state
 * ================================================================== */

type Weather = "clear" | "overcast" | "rain" | "wet";
type Season = "green" | "autumn" | "bare";

/* ================================================================== *
 * WHICH station this is — the scene is generic
 * ================================================================== */

/**
 * One platform scene, many stations. An SKM stop is the most standardised
 * piece of architecture in the Trójmiasto — the same masts, the same shelter,
 * the same yellow line from Gdańsk to Gdynia — so the scene keeps ONE set of
 * furniture and varies the four things that actually differ from stop to
 * stop: the name on the boards, what stands across the cutting, where the
 * underpass lets you out, and what the direction sign promises next.
 *
 * The identity lives in `world.station.at`. Three writers, one reader:
 *  – the route map writes it BEFORE travelling here (LINE.stationAt);
 *  – the scene's own `enter` hook writes it when you arrive ON FOOT, from
 *    the counterpart scene the travel came from;
 *  – arriving from the train writes nothing and trusts the bag, which is how
 *    stepping off at the doors returns you to the platform you boarded from.
 * Everything else — boards, backdrop, exits, HUD, describe — reads the spec.
 */
export type StationId = "przymorze" | "zaspa";

export type StationSpec = {
  id: StationId;
  /** what the boards along the platform say */
  boardName: string;
  /** neighbours, for the direction sign under the departure display */
  prev: string;
  next: string;
  /** what stands across the cutting */
  backdrop: "przymorze" | "zaspa";
  /** where the underpass lets you out — null while it is shut for renovation */
  exit: { scene: string; spawnX: number } | null;
  describe: string;
};

export const STATIONS: Record<StationId, StationSpec> = {
  przymorze: {
    id: "przymorze",
    boardName: "PRZYMORZE-UNIWERSYTET",
    prev: "OLIWA",
    next: "ZASPA",
    backdrop: "przymorze",
    exit: { scene: "district", spawnX: 250 },
    describe:
      "The SKM platform at Przymorze-Uniwersytet: a long concrete island in a shallow cutting, the falowiec and Alchemia across the fence, trains on a timetable that does not care whether you are ready.",
  },
  zaspa: {
    id: "zaspa",
    boardName: "GDANSK ZASPA",
    prev: "PRZYMORZE-UNIW.",
    next: "SOPOT",
    backdrop: "zaspa",
    /** the underpass at Zaspa is shut for renovation — honest, and Polish */
    exit: null,
    describe:
      "The SKM platform at Gdańsk Zaspa: the same concrete island, but the wave blocks stand close here and their gable ends carry murals three storeys tall. The underpass is shut for renovation, so the platform is the whole world.",
  },
};

export interface StationState {
  at: StationId;
  weather: Weather;
  season: Season;
  crowd: number;
  lamps: "auto" | "on" | "off";
  board: boolean;
  litter: number;
  pigeons: boolean;
  announce: boolean;
}

const DEFAULTS: StationState = {
  at: "przymorze",
  weather: "clear",
  season: "autumn",
  crowd: 2,
  lamps: "auto",
  board: true,
  litter: 1,
  pigeons: true,
  announce: true,
};

/** Defensive read: the world need not carry a `station` slice at all. */
export function stationState(world: WorldState): StationState {
  const raw = (world as { station?: Partial<StationState> }).station;
  const merged = raw ? { ...DEFAULTS, ...raw } : DEFAULTS;
  /* an untrusted save may hold any string in `at` — clamp to a real station */
  if (!(merged.at in STATIONS)) merged.at = "przymorze";
  return merged;
}

/** The spec of the station this platform currently is. */
export function stationSpecOf(world: WorldState): StationSpec {
  return STATIONS[stationState(world).at];
}

const lampsOn = (s: StationState, ph: Ph) =>
  s.lamps === "on" || (s.lamps === "auto" && (ph === "night" || ph === "dawn"));

/**
 * The phase right now, off the wall clock — for object `when` gates, which get
 * the world but not the phase. It has to agree with what the runtime passes to
 * the art, and it does, because both go through the same `dayPhase`.
 */

/** Who is on the platform at this crowd level, at this hour. */
function whoIsWaiting(s: StationState, ph: Ph) {
  return {
    /** on the bench in the shelter, not going anywhere in a hurry */
    bench: s.crowd >= 1,
    /** at the platform edge looking down the line, as everyone does */
    looker: s.crowd >= 1,
    /** under the display, on the phone */
    phone: s.crowd >= 2,
    /** reading the timetable case as though it will have changed */
    reader: s.crowd >= 2,
    /** walking the length of the platform because the train is late */
    pacer: s.crowd >= 3,
    /** at the quiet end after dark, because you cannot smoke in the shelter */
    smoker: s.crowd >= 1 && (ph === "dusk" || ph === "night"),
    /** with a bag of kasza, by daylight, wherever the pigeons are */
    golebiarka: s.pigeons && s.crowd >= 1 && (ph === "dawn" || ph === "day"),
  };
}

/* ================================================================== *
 * PLANE 1 — the far side of the cutting (parallax 0.15), enriched pass
 *
 * The backdrop's job is to be two kilometres away, convincingly, all
 * day. What it gained:
 *   - a sky with weather in it: a sun that keeps the phase's hours
 *     (low and molten at dawn and dusk, behind the roofline), a
 *     crescent moon and deterministic stars at night, one contrail
 *     on a clear day
 *   - Oliwa's cathedral spires in the tree gap — the one landmark
 *     Przymorze actually looks at — and a radio mast at the Sopot
 *     end with its patient red light
 *   - the falowiec becomes a lived thing: stairwell verticals give
 *     it the wave rhythm, lift rooms bump its roofline, satellite
 *     dishes, balconies repainted in residents' colours, and one
 *     window flickering television-blue next to the insomniac
 *   - Alchemia gets roof plant, obstruction lights, and a dusk glint
 *   - the trees get lit crowns and a one-pixel wind sway
 *   - Zaspa gets the same roof-and-stairwell truth, a fourth mural,
 *     and a control tower with a lit cab and its own red light
 * ================================================================== */

/**
 * The sky, in six stepped bands rather than four.
 *
 * Four bands over 88 px of sky is a 22 px step, and at 4× on screen that is a
 * visible stripe with a hard edge — the horizon read as a join rather than as a
 * distance. Six bands halves the step, and the dithered seam over each one does
 * the rest. The palette still only has four stops, so the two extra bands are
 * interpolated where the jump was worst: between the zenith and the mid sky, and
 * either side of the horizon glow.
 */
const SKY_BANDS: Rect[] = [
  [0, 0, W, 14],
  [0, 14, W, 14],
  [0, 28, W, 14],
  [0, 42, W, 16],
  [0, 58, W, 16],
  [0, 74, W, 22],
];
/** Which palette stop each band takes, and how far it is mixed to the next. */
const BAND_MIX: readonly [number, number][] = [
  [0, 0],
  [0, 0.5],
  [1, 0],
  [1, 0.5],
  [2, 0],
  [2, 0.6],
];
/** Mix two hex colours, integer arithmetic, no CSS colour functions at runtime. */
function mixHex(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
/** The six band colours, per phase, computed once. */
const SKY_SIX: Record<Ph, string[]> = {
  dawn: [],
  day: [],
  dusk: [],
  night: [],
};
for (const ph of ["dawn", "day", "dusk", "night"] as Ph[]) {
  SKY_SIX[ph] = BAND_MIX.map(([i, k]) =>
    k === 0 ? K.sky[ph][i] : mixHex(K.sky[ph][i], K.sky[ph][Math.min(3, i + 1)], k),
  );
}

/** A stepped disc, two-pixel rows — the only circle this renderer owns. */
function discRects(cx: number, cy: number, r: number): Rect[] {
  const out: Rect[] = [];
  for (let dy = -r; dy <= r; dy += 2) {
    const w = Math.max(2, Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2));
    out.push([cx - Math.round(w / 2), cy + dy, w, 2]);
  }
  return out;
}
/**
 * Where the sun stands, per lit phase. Low at the day's two hinges — behind
 * the roofline and the trees, which occlude it for free because they are
 * painted later — and high and pale at noon. Night belongs to the moon.
 */
const SUN_AT: Record<string, { x: number; y: number; c: string } | undefined> = {
  day: { x: 560, y: 20, c: "#f6f2e0" },
  dawn: { x: 604, y: 64, c: "#f2a45c" },
  dusk: { x: 62, y: 62, c: "#e8703e" },
};
/** Deterministic stars: primes, not randomness, so the sky never crawls. */
const STARS = pxPath(
  Array.from({ length: 16 }, (_, i) => {
    const x = (i * 127 + 40) % W;
    const y = ((i * 53) % 38) + 4;
    return [x, y, 1, 1] as Rect;
  }),
);
const STARS_BRIGHT = pxPath([
  [236, 10, 2, 2],
  [510, 16, 2, 2],
  [1420, 8, 2, 2],
]);
/** One contrail, high and slow, on a clear day: two offset strokes fading. */
const CONTRAIL_A = pxPath([[420, 10, 150, 1]]);
const CONTRAIL_B = pxPath([[578, 9, 90, 1]]);
const CONTRAIL_PLANE = pxPath([[674, 8, 3, 1]]);

/**
 * Alchemia, two kilometres south over Oliwa.
 *
 * The brief is specific that these must not look like sprites pasted onto the
 * sky, so three things are done to them: the cladding ramp is mixed 44–52%
 * toward the horizon band of the sky, which is what aerial perspective actually
 * is; they are the *only* thing in the far plane with a hard vertical edge, so
 * the tree line and the falowiec have to be there to give them a base to stand
 * on; and they are cut off by neither the frame nor a clean line but by the
 * tree canopy in front of them.
 *
 * Proportions: four towers stepping down, the tallest 66 px, standing on the
 * horizon at y = 106. They were 44 px and half of that was hidden behind the
 * block in front, which left 22 px of dark rectangle reading as a hole in the
 * sky rather than as a building — so they are taller and narrower now, with a
 * clear 45 px of tower above the falowiec's roofline. A distant landmark has to
 * be *small in width* to read as distant; making it short as well just deletes
 * it.
 */
const ALCHEMIA: Rect[] = [
  [286, 40, 24, 66],
  [316, 52, 17, 54],
  [340, 44, 21, 62],
  [368, 58, 14, 48],
];
const ALCHEMIA_SET = bevelPaths(ALCHEMIA);
/** Curtain-wall grid, at this size two pixels of it per floor. */
const ALCHEMIA_GRID = pxPath([
  ...repeat(13, 5, [288, 42, 20, 1] as Rect, "y"),
  ...repeat(10, 5, [318, 54, 13, 1] as Rect, "y"),
  ...repeat(12, 5, [342, 46, 17, 1] as Rect, "y"),
  ...repeat(9, 5, [370, 60, 10, 1] as Rect, "y"),
]);
/** Roof plant on the two tallest, and the red lights aviation demands. */
const ALCHEMIA_ROOF = pxPath([
  [290, 38, 12, 2],
  [344, 42, 10, 2],
]);
const ALCHEMIA_AVI = pxPath([
  [295, 37, 2, 1],
  [348, 41, 2, 1],
]);
/** Lit floors after dark, deterministic so nothing flickers between frames. */
const ALCHEMIA_LIT = pxPath(
  ALCHEMIA.flatMap(([x, y, w, h], i) =>
    Array.from({ length: Math.floor(h / 5) }, (_, j) => [x + 2, y + 2 + j * 5, w - 4, 2] as Rect)
      .filter((_, j) => (i * 5 + j * 3) % 7 < 3)
      .map((r) => r),
  ),
);

/**
 * The falowiec — the kilometre-long wave block that is what Przymorze is, and
 * the one building that makes this unmistakably here rather than any other
 * suburb. Drawn as one long slab that runs off both ends of the frame, stepped
 * twice where the real one bends, with balcony bands rather than windows because
 * at this distance that is all you see of it.
 */
const FALOWIEC: Rect[] = [
  [0, 90, 150, 18],
  [150, 87, 190, 21],
  [340, 92, 120, 16],
  [460, 88, 210, 20],
];
const FALOWIEC_SET = bevelPaths(FALOWIEC);
/** Balcony bands: the horizontal stripe that a falowiec reads as. */
const FALOWIEC_BANDS = pxPath(
  FALOWIEC.flatMap(([x, y, w, h]) =>
    Array.from({ length: Math.floor((h - 4) / 4) }, (_, i) => [x, y + 3 + i * 4, w, 2] as Rect),
  ),
);
/** The stairwell towers, every ten flats — the verticals that give the wave
 * its beat. Without them the block is a ruled page; with them it is housing. */
const FALOWIEC_STAIRS = pxPath(
  FALOWIEC.flatMap(([x, y, w, h]) =>
    Array.from({ length: Math.floor((w - 20) / 34) }, (_, j) => [x + 17 + j * 34, y, 1, h] as Rect),
  ),
);
/** Lift rooms and vent stacks bumping the roofline, one per bend or so. */
const FALOWIEC_ROOFKIT = pxPath([
  [66, 87, 6, 3],
  [210, 84, 7, 3],
  [380, 89, 6, 3],
  [520, 85, 7, 3],
  [600, 85, 6, 3],
]);
/** Satellite dishes: two pale pixels aimed at the same satellite. */
const FALOWIEC_DISHES = pxPath([
  [120, 93, 2, 2],
  [470, 92, 2, 2],
]);
/** Balconies repainted in residents' colours — the block's only anarchy. */
const BALCONY_PAINT: [Rect, string][] = [
  [[38, 97, 4, 2], "#c98a8a"],
  [[214, 94, 4, 2], "#8ac9a0"],
  [[502, 95, 4, 2], "#c9c08a"],
];
/** Windows lit at night, in the gaps between the balcony bands. */
const FALOWIEC_LIT = pxPath(
  FALOWIEC.flatMap(([x, y, w, h], b) =>
    Array.from({ length: Math.floor((h - 4) / 4) }, (_, i) =>
      Array.from(
        { length: Math.floor(w / 9) },
        (_, j) => [x + j * 9 + 2, y + 3 + i * 4, 4, 2] as Rect,
      ).filter((_, j) => (b * 13 + i * 7 + j * 5) % 11 < 4),
    ).flat(),
  ),
);

/**
 * Oliwa's cathedral spires, in the gap the trees leave before Alchemia — the
 * one thing on this skyline older than everything else on it put together.
 * Hazed hard, because they are further than the towers.
 */
const OLIWA_SPIRES = pxPath([
  [252, 80, 3, 26],
  [251, 78, 5, 2],
  [253, 74, 1, 4],
  [259, 84, 2, 22],
  [258, 82, 4, 2],
  [259, 79, 1, 3],
]);
/** The radio mast at the Sopot end: a line, three stay ticks, one red eye. */
const RADIO_MAST = pxPath([
  [652, 72, 2, 34],
  [648, 82, 10, 1],
  [649, 94, 8, 1],
]);
const RADIO_EYE: Rect = [652, 70, 2, 2];

/**
 * The tree line along Obrońców Wybrzeża: poplars and limes, forty years old and
 * taller than the blocks in places. Drawn as stepped canopies rather than as
 * individual trees, because from here they are a texture and not objects.
 */
/**
 * One canopy, as five stepped rows.
 *
 * The widths are the whole thing. An earlier version derived them from
 * `1 − |i − 1.4| / 5`, which gives 0.72, 0.88, 0.88, 0.68, 0.48 — near enough
 * uniform that every tree came out a rectangle, and a row of rectangles along
 * the horizon reads as a wall, not as trees. These are hand-set to bulge low and
 * taper hard at the crown, which is the silhouette of a lime in leaf.
 */
const CANOPY_ROWS = [0.34, 0.72, 1, 0.86, 0.52] as const;
function canopy(cx: number, top: number, rx: number): Rect[] {
  return CANOPY_ROWS.map((k, i) => {
    const w = Math.max(3, Math.round(rx * 2 * k));
    return [cx - Math.round(w / 2), top + i * 4, w, 4] as Rect;
  });
}
const TREES: Rect[] = [
  ...canopy(20, 90, 18),
  ...canopy(90, 86, 24),
  ...canopy(160, 92, 16),
  ...canopy(232, 88, 22),
  ...canopy(400, 86, 26),
  ...canopy(470, 90, 18),
  ...canopy(536, 88, 24),
  ...canopy(610, 92, 16),
];
const TREES_PATH = pxPath(TREES);
/** The crown row of every canopy — the row the sky actually lights. */
const TREES_CROWNS = pxPath(TREES.filter((_, i) => i % CANOPY_ROWS.length === 0));
/**
 * The two bottom rows of every canopy, for autumn: one flat brown over the
 * whole silhouette read as floating slabs, and the underside shadow is what
 * the green season was getting for free from LEAF's own ramp.
 */
const TREES_UNDER = pxPath(
  TREES.filter((_, i) => i % CANOPY_ROWS.length >= CANOPY_ROWS.length - 2),
);
/** The trunks, one pixel wide, only where a canopy is low enough to show one. */
/** Under actual canopies — the far plane only ever shows x 0…~620, and the
 * first cut put four of six trunks beyond it, under nothing. */
const TRUNKS = pxPath([90, 232, 470, 610].map((x) => [x - 1, 104, 2, 8] as Rect));

/** The university's roof line, low and long, at the Sopot end. */
const UNIWERSYTET: Rect[] = [
  [430, 94, 210, 14],
  [30, 98, 150, 10],
];
const UNI_SET = bevelPaths(UNIWERSYTET);

/* ---- the Zaspa backdrop ----------------------------------------------------
 * At Zaspa the wave blocks are not a line on the horizon — they are the
 * neighbourhood, close enough that their gable ends carry the monumental
 * murals the district is famous for, three storeys tall and repainted every
 * festival. Two blocks, nearer and taller than Przymorze's, their gables
 * facing the line; the old airfield's control tower stands between them,
 * because Zaspa was a runway before it was anybody's address. */
const ZASPA_BLOCKS: Rect[] = [
  [40, 70, 240, 38],
  [340, 64, 300, 44],
];
const ZASPA_SET = bevelPaths(ZASPA_BLOCKS);
const ZASPA_BANDS = pxPath(
  ZASPA_BLOCKS.flatMap(([x, y, w, h]) =>
    Array.from({ length: Math.floor((h - 6) / 5) }, (_, i) => [x, y + 4 + i * 5, w, 2] as Rect),
  ),
);
/** Zaspa's blocks get the same truth as the falowiec: stairwell verticals
 * and a roofline with lift rooms on it. */
const ZASPA_STAIRS = pxPath(
  ZASPA_BLOCKS.flatMap(([x, y, w, h]) =>
    Array.from({ length: Math.floor((w - 24) / 40) }, (_, j) => [x + 20 + j * 40, y, 1, h] as Rect),
  ),
);
const ZASPA_ROOFKIT = pxPath([
  [96, 67, 7, 3],
  [200, 67, 6, 3],
  [420, 61, 7, 3],
  [560, 61, 6, 3],
]);
const ZASPA_LIT = pxPath(
  ZASPA_BLOCKS.flatMap(([x, y, w, h], b) =>
    Array.from({ length: Math.floor((h - 6) / 5) }, (_, i) =>
      Array.from(
        { length: Math.floor(w / 11) },
        (_, j) => [x + j * 11 + 3, y + 4 + i * 5, 5, 2] as Rect,
      ).filter((_, j) => (b * 17 + i * 5 + j * 3) % 9 < 3),
    ).flat(),
  ),
);
/** The murals on the gable ends: big flat fields, off-register, unmistakable. */
const ZASPA_MURALS: [Rect, string][] = [
  /* the gable at the right end of block one: a sun over a wave */
  [[262, 72, 18, 36], "#8a5a94"],
  [[265, 76, 12, 10], "#f2c218"],
  [[263, 90, 16, 6], "#3a7d84"],
  /* the gable at the left end of block two: a figure with a raised arm */
  [[340, 66, 18, 42], "#b3442e"],
  [[346, 72, 6, 14], "#e8e2d2"],
  [[344, 86, 10, 4], "#e8e2d2"],
  /* a third piece mid-block, where a stairwell face takes paint */
  [[470, 66, 14, 42], "#2d5236"],
  [[473, 74, 8, 8], "#f2c218"],
  /* and a fourth, newest, festival-fresh: a blue field with a white ring */
  [[560, 66, 12, 42], "#1e4a6e"],
  [[563, 76, 6, 6], "#e8e2d2"],
  [[565, 78, 2, 2], "#1e4a6e"],
];
/** The old airfield control tower, standing where the runway was. */
const ZASPA_TOWER: Rect[] = [
  [306, 78, 10, 30],
  [302, 70, 18, 10],
  [304, 66, 14, 4],
];
const ZASPA_TOWER_SET = bevelPaths(ZASPA_TOWER);
/** The cab's glazing band, and the light that stays on in it — somebody
 * keeps the tower, even now. Plus the red eye the airfield never gave up. */
const ZASPA_TOWER_GLASS = pxPath([[304, 72, 14, 3]]);
const ZASPA_TOWER_LIT = pxPath([[306, 72, 4, 3]]);
const ZASPA_TOWER_EYE: Rect = [310, 64, 2, 2];

function Backdrop({ ph, s }: { ph: Ph; s: StationState }) {
  const night = ph === "night";
  const bands = SKY_SIX[ph];
  const flat = s.weather === "overcast" || s.weather === "rain";
  const sun = SUN_AT[ph];
  /** aerial perspective, the same move the brief demands for Alchemia */
  const haze = (c: string, k: number) => mixHex(c, K.sky[ph][3], k);
  return (
    <g>
      <SharedDefs />
      {SKY_BANDS.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static sky bands, never reorder
        <g key={`sb${i}`}>
          {px(r[0] - 120, r[1], r[2] + 300, r[3], bands[i])}
          {flat ? (
            <rect
              x={r[0] - 120}
              y={r[1]}
              width={r[2] + 300}
              height={r[3]}
              fill="#9aa0a8"
              opacity={0.44}
            />
          ) : null}
        </g>
      ))}
      {/* the dithered seams, so four bands read as a gradient and not as stripes */}
      <path
        d={pxPath(SKY_BANDS.slice(1).map((r) => [r[0] - 120, r[1] - 3, r[2] + 300, 6] as Rect))}
        fill={dth("c", "25")}
        opacity={flat ? 0.22 : 0.36}
      />

      {/* the sun, when the phase has one and the weather lets it: a halo,
          the disc, and a flare line when it stands low. The skyline and the
          trees are painted later, so a low sun sets behind them for free. */}
      {!night && sun && !flat ? (
        <>
          <path d={pxPath(discRects(sun.x, sun.y, 11))} fill={sun.c} opacity={0.2} />
          <path d={pxPath(discRects(sun.x, sun.y, 6))} fill={sun.c} opacity={0.95} />
          {ph !== "day" ? (
            <path d={pxPath([[sun.x - 30, sun.y + 2, 60, 1]])} fill={sun.c} opacity={0.35} />
          ) : null}
        </>
      ) : null}
      {/* the moon and the stars, when the sky can hold them */}
      {night && !flat ? (
        <>
          <path d={STARS} fill="#c9d2e8" opacity={0.7} />
          <path d={STARS_BRIGHT} fill="#e8eefc" opacity={0.9}>
            <animate
              attributeName="opacity"
              values="0.9;0.4;0.9"
              dur="5s"
              repeatCount="indefinite"
            />
          </path>
          <path d={pxPath(discRects(588, 18, 6))} fill="#dfe3ee" opacity={0.9} />
          <path d={pxPath(discRects(585, 16, 5))} fill={bands[0]} />
        </>
      ) : null}
      {/* one contrail on a clear day, and the pixel writing it */}
      {ph === "day" && !flat ? (
        <>
          <path d={CONTRAIL_A} fill={K.white} opacity={0.25} />
          <path d={CONTRAIL_B} fill={K.white} opacity={0.15} />
          <path d={CONTRAIL_PLANE} fill={K.white} opacity={0.6} />
        </>
      ) : null}

      {s.at === "zaspa" ? (
        <>
          {/* Zaspa: the wave blocks ARE the neighbourhood here — near, tall,
           * gable murals facing the line, the old airfield tower between them */}
          <Bev set={ZASPA_TOWER_SET} mat={CLAD[ph]} />
          <path d={ZASPA_TOWER_GLASS} fill={night ? "#1a2230" : "#3a4a5a"} opacity={0.9} />
          {night ? <path d={ZASPA_TOWER_LIT} fill="#ffd98a" opacity={0.85} /> : null}
          {night ? (
            <path d={pxPath([ZASPA_TOWER_EYE])} fill={K.red}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="1;0.15;1;1"
                dur="3.1s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          <Bev set={ZASPA_SET} mat={SLAB[ph]} />
          <path d={ZASPA_BANDS} fill={SLAB[ph].lo} opacity={0.55} />
          <path d={ZASPA_STAIRS} fill={SLAB[ph].lo} opacity={0.45} />
          <path d={ZASPA_ROOFKIT} fill={SLAB[ph].lo} />
          {night ? <path d={ZASPA_LIT} fill="#ffd98a" opacity={0.6} /> : null}
          {/* one flat watches television with the lights off */}
          {night ? (
            <path d={pxPath([[420, 84, 5, 2]])} fill="#9ac4e8">
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.5;0.7;0.3;0.6;0.7;0.4;0.5"
                dur="3.7s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {ZASPA_MURALS.map(([r, c]) => (
            <path
              key={`${r[0]}-${r[1]}`}
              d={pxPath([r])}
              fill={c}
              opacity={night ? 0.4 : ph === "dusk" ? 0.6 : 0.8}
            />
          ))}
          {ph === "dusk" && !flat ? (
            <path d={pxPath(ZASPA_BLOCKS)} fill="#f2a65a" opacity={0.14} />
          ) : null}
        </>
      ) : (
        <>
          {/* Oliwa's spires first — they are behind everything, and hazed
           * hardest, because seven centuries is the furthest distance here */}
          <path d={OLIWA_SPIRES} fill={haze(night ? "#262438" : "#4e5a68", 0.55)} />
          {/* Przymorze: Alchemia, small and hazed, standing over Oliwa */}
          <Bev set={ALCHEMIA_SET} mat={CLAD[ph]} />
          <path d={ALCHEMIA_GRID} fill={CLAD[ph].lo} opacity={0.7} />
          <path d={ALCHEMIA_ROOF} fill={CLAD[ph].lo} />
          {night ? <path d={ALCHEMIA_LIT} fill="#ffd98a" opacity={0.7} /> : null}
          {!night ? <path d={ALCHEMIA_GRID} fill={K.glass[ph]} opacity={0.25} /> : null}
          {/* dusk: the curtain wall catches fire for a quarter of an hour */}
          {ph === "dusk" && !flat ? (
            <path
              d={pxPath(ALCHEMIA.map(([x, y, , h]) => [x, y, 3, h] as Rect))}
              fill="#f2a65a"
              opacity={0.4}
            />
          ) : null}
          {night ? (
            <path d={ALCHEMIA_AVI} fill={K.red}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="1;1;0.15;1"
                dur="2.6s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}

          {/* the falowiec */}
          <Bev set={FALOWIEC_SET} mat={SLAB[ph]} />
          <path d={FALOWIEC_BANDS} fill={SLAB[ph].lo} opacity={0.55} />
          <path d={FALOWIEC_STAIRS} fill={SLAB[ph].lo} opacity={0.45} />
          <path d={FALOWIEC_ROOFKIT} fill={SLAB[ph].lo} />
          <path d={FALOWIEC_DISHES} fill={K.white} opacity={0.5} />
          {ph === "day" && !flat
            ? BALCONY_PAINT.map(([r, c]) => (
                <path key={`bp${r[0]}`} d={pxPath([r])} fill={c} opacity={0.35} />
              ))
            : null}
          {night ? <path d={FALOWIEC_LIT} fill="#ffd98a" opacity={0.6} /> : null}
          {/* one flat on the third bend keeps odd hours — a window that goes
           * out, waits, and comes back. Somebody lives there. */}
          {night ? (
            <path d={pxPath([[384, 96, 4, 2]])} fill="#ffd98a">
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.9;0.9;0;0;0;0.9;0.9;0.9"
                dur="23s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* and two doors down, somebody watches television in the dark */}
          {night ? (
            <path d={pxPath([[520, 94, 4, 2]])} fill="#9ac4e8">
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.5;0.7;0.3;0.6;0.7;0.4;0.5"
                dur="3.7s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* dusk: the west face catches the last of the sun — the lighting
           * premise promises this and it is the one moment the block is the
           * brightest thing in the frame instead of the dullest */}
          {ph === "dusk" && !flat ? (
            <>
              <path
                d={pxPath(FALOWIEC.map(([x, y, w]) => [x, y, w, 3] as Rect))}
                fill="#f2a65a"
                opacity={0.5}
              />
              <path d={pxPath(FALOWIEC)} fill="#f2a65a" opacity={0.14} />
            </>
          ) : null}

          {/* the university */}
          <Bev set={UNI_SET} mat={dim(CONC[ph], K.sky[ph][3], 0.2)} />
        </>
      )}

      {/* the radio mast at the Sopot end, whichever skyline is up */}
      <path d={RADIO_MAST} fill={haze(night ? "#262438" : "#4e5a68", 0.4)} />
      {night ? (
        <path d={pxPath([RADIO_EYE])} fill={K.red}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.15;1;0.15;0.15"
            dur="2.6s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}

      {/* the trees, in front of whichever skyline is standing today — with
          lit crowns, and a one-pixel sway that is all the wind this plane
          can afford and all it needs */}
      <g>
        <path d={TRUNKS} fill={LEAF[ph].deep} />
        <path
          d={TREES_PATH}
          fill={s.season === "autumn" ? "#8a6a34" : s.season === "bare" ? "#6b5f52" : LEAF[ph].base}
          opacity={s.season === "bare" ? 0.5 : 1}
        />
        {s.season === "autumn" ? <path d={TREES_UNDER} fill="#66491f" opacity={0.75} /> : null}
        <path
          d={TREES_CROWNS}
          fill={s.season === "autumn" ? "#b3934a" : s.season === "bare" ? "#7d7264" : LEAF[ph].hi}
          opacity={s.season === "bare" ? 0.4 : 0.5}
        />
        <path d={TREES_PATH} fill={dth("n", "12")} opacity={0.3} />
        {s.season !== "bare" ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;1 0;0 0;-1 0;0 0"
            keyTimes="0;0.22;0.5;0.74;1"
            dur="11s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>

      {/* gulls: this is the coast and they follow the line */}
      {!flat ? (
        <g>
          <path
            d={pxPath([
              [520, 24, 5, 1],
              [524, 23, 4, 1],
              [1340, 32, 4, 1],
              [1343, 31, 4, 1],
              [1680, 20, 5, 1],
            ])}
            fill={night ? "#4a5060" : "#e8e6df"}
            opacity={0.75}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-40 -6;-90 2;-150 -4;-210 0"
              dur="58s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the cutting, the fence, the road lamps (parallax 0.85; the
 * masts themselves are drawn at 1.0, in the ground plane, beside the
 * track) — enriched pass
 *
 * This is the plane the eye rests on between trains, so it carries the
 * most history per pixel:
 *   - the wall becomes a real precast structure: lit panel arrises,
 *     formwork lift lines, weep holes with their stains, water streaks
 *     off the coping, efflorescence, a splash zone, one renewed panel
 *   - the graffiti war gets its full cast: the scrubbed ghost, LECHIA
 *     with drips, a crossed-out ARKA beside it (this is Gdańsk), a
 *     small M+K heart, and a silver throw-up on the bridge abutment
 *   - the fence: bar shadows cast onto the coping, a lit top rail, a
 *     ZAKAZ WSTĘPU plate zip-tied on, two bars pried apart where the
 *     short-cut goes, and a plastic bag that flutters forever
 *   - the catenary grows droppers, ceramic insulators, mast flank
 *     shading and ID plates — the difference between wires and OLE
 *   - the bridge gets its underworld: gloom under the deck, girder
 *     ribs, a bearing shelf with two roosting pigeons and what
 *     pigeons leave, a kerb line and an expansion tooth
 *   - the sodium lamps throw halos and wash the wall warm at night,
 *     and the third one is dying, which every sodium lamp is
 *   - the bus finally has visible windows (they were body-coloured);
 *     lit amber after dark. And a cat walks the coping at night.
 * ================================================================== */

/** The far wall of the cutting: a concrete retaining wall in 4 m panels. */
const CUT_WALL = pxPath([[0, 112, W, 24]]);
const CUT_PANELS = pxPath(repeat(14, 152, [0, 112, 2, 24] as Rect));
/** Every joint has a lit arris beside its shadow — panels are bodies. */
const CUT_PANELS_LIT = pxPath(repeat(14, 152, [2, 112, 1, 24] as Rect));
const CUT_COPING = pxPath([[0, 110, W, 3]]);
/** The coping is precast too: its joints, and the shadow it drops. */
const COPING_TICKS = pxPath(repeat(14, 152, [0, 110, 1, 3] as Rect));
const COPING_SHADOW = pxPath([[0, 113, W, 1]]);
/** Two formwork lift lines run the whole wall — the pour remembers. */
const WALL_LIFTS = pxPath([
  [0, 120, W, 1],
  [0, 128, W, 1],
]);
/** Weep holes, one per panel, and the stain each one has written. */
const WEEP_HOLES = pxPath(repeat(14, 152, [70, 124, 3, 3] as Rect));
const WEEP_STAINS = pxPath(repeat(14, 152, [71, 127, 1, 8] as Rect));
/** Water streaks off the coping, deterministic so they do not crawl. */
const WALL_STREAKS = pxPath(
  Array.from({ length: 18 }, (_, i) => {
    const x = (i * 173 + 30) % W;
    return [x, 114, 1, 4 + ((i * 3) % 6)] as Rect;
  }),
);
/** Efflorescence: the salt the wall sweats, in three pale patches. */
const WALL_SALT = pxPath([
  [548, 118, 22, 6],
  [1330, 121, 16, 5],
  [1836, 117, 19, 6],
]);
/** The splash zone at the foot, and the moss that has claimed it. */
const WALL_SPLASH = pxPath([[0, 131, W, 5]]);
const WALL_MOSS = pxPath(
  Array.from({ length: 12 }, (_, i) => {
    const x = (i * 241 + 88) % W;
    return [x, 133, 3, 2] as Rect;
  }),
);
/** One panel was recast after a strike — younger concrete, harder joints. */
const WALL_NEW_PANEL = pxPath([[458, 112, 148, 24]]);
const WALL_NEW_JOINTS = pxPath([
  [456, 112, 2, 24],
  [606, 112, 2, 24],
]);
/**
 * The wall's history. A railway retaining wall is a canvas and the railway
 * knows it: one tag has been painted over — the pale square where the jet
 * washer gave up — and a newer one is on the panel beside it, because the wall
 * always wins. LECHIA, because this is Gdańsk and it is always LECHIA.
 */
const WALL_GHOST = pxPath([[812, 116, 44, 14]]);
/** The roller left edges, and the ghost still shows through at one corner. */
const WALL_GHOST_EDGES = pxPath([
  [812, 116, 44, 1],
  [812, 129, 44, 1],
]);
const WALL_GHOST_BLEED = pxPath([[848, 124, 6, 4]]);
const WALL_TAG_AT = { x: 1148, y: 118 } as const;
/** Paint runs under the letters — sprayed fast, at night, over a shoulder. */
const TAG_DRIPS = pxPath([
  [1156, 130, 1, 4],
  [1174, 130, 1, 3],
  [1189, 130, 1, 5],
]);
/** The answer: ARKA, from over the water, struck through the same week. */
const RIVAL_AT = { x: 1232, y: 121 } as const;
const RIVAL_STRIKE = pxPath([[1230, 123, 22, 2]]);
/** And lower down the wall, quieter than either: M+K, with a heart. */
const HEART_AT = { x: 398, y: 122 } as const;
const HEART = pxPath([
  [416, 122, 2, 1],
  [419, 122, 2, 1],
  [416, 123, 5, 2],
  [417, 125, 3, 1],
  [418, 126, 1, 1],
]);
/** The kilometre plate on the wall: white enamel, black figures, exact. */
const KM_PLATE = pxPath([[1520, 115, 10, 14]]);

/** Weeds and buddleia out of the wall, which is what these walls grow. */
const CUT_WEEDS = pxPath([
  [140, 126, 3, 10],
  [143, 124, 2, 12],
  [412, 128, 2, 8],
  [700, 122, 3, 14],
  [703, 126, 2, 10],
  [1180, 128, 2, 8],
  [1466, 124, 3, 12],
  [1700, 127, 2, 9],
]);
/** The buddleia flowers in green season, purple, out of a wall, absurdly. */
const WEED_BLOOMS = pxPath([
  [141, 124, 3, 2],
  [701, 120, 3, 2],
  [1466, 122, 3, 2],
]);

/**
 * The palisade fence along the top of the wall. Every Polish railway boundary is
 * this fence, and the pitch of it — one bar every 11 cm — is the single most
 * recognisable texture in the whole scene, so it is drawn at true pitch rather
 * than simplified.
 */
const FENCE_BARS = pxPath(repeat(Math.floor(W / 6), 6, [0, 96, 2, 15] as Rect));
const FENCE_RAILS = pxPath([
  [0, 96, W, 2],
  [0, 106, W, 2],
]);
const FENCE_RAIL_HI = pxPath([[0, 96, W, 1]]);
/** The plate zip-tied to the bars, saying what every fence says. */
const FENCE_SIGN = pxPath([[878, 98, 28, 11]]);
const FENCE_SIGN_ROWS = pxPath([
  [881, 100, 22, 2],
  [881, 104, 18, 2],
]);
const FENCE_SIGN_TIES = pxPath([
  [880, 97, 1, 2],
  [903, 97, 1, 2],
]);
/** Two bars pried apart where the short-cut goes — kinked, not missing,
 * because palisade bends long before it breaks. */
const FENCE_BENT = pxPath([
  [1320, 96, 2, 5],
  [1322, 101, 2, 5],
  [1321, 106, 2, 5],
  [1328, 96, 2, 5],
  [1326, 101, 2, 5],
  [1327, 106, 2, 5],
]);
/** The plastic bag the fence caught in 2019. */
const BAG_AT = { x: 1510, y: 96 } as const;

/**
 * Catenary masts. 5.2 m to the wire, which is above the frame, so what is in
 * frame is the mast, the bracket and the registration arm reaching out over the
 * track — which is exactly what you see when you look up from a platform.
 */
function mast(x: number): Rect[] {
  return [
    [x, 0, 6, 136],
    [x - 2, 12, 10, 3],
    [x + 6, 14, 46, 2],
    [x + 50, 14, 2, 10],
    [x + 6, 24, 30, 2],
  ];
}
const MASTS_PATH = pxPath(MASTS.flatMap((x) => mast(x)));
/** The masts' shaded flanks — six pixels wide is a column, not a stripe. */
const MAST_FLANKS = pxPath(MASTS.map((x) => [x + 4, 0, 2, 136] as Rect));
const MAST_BASES = pxPath(MASTS.map((x) => [x - 4, 130, 14, 8] as Rect));
/** ID plates at eye level, one per mast, because every mast is somebody's. */
const MAST_PLATES = pxPath(MASTS.map((x) => [x + 1, 58, 4, 7] as Rect));
const MAST_PLATE_TICKS = pxPath(MASTS.map((x) => [x + 2, 60, 2, 1] as Rect));
/** Ceramic insulators where steel meets copper — the brown beads that make
 * a drawing of wires into overhead line equipment. */
const INSULATORS = pxPath(
  MASTS.flatMap(
    (x) =>
      [
        [x + 49, 12, 3, 3],
        [x + 6, 13, 3, 4],
        [x + 34, 22, 3, 3],
      ] as Rect[],
  ),
);
/** The contact wire and the catenary above it, in the only place they show. */
const WIRES = pxPath([
  [0, 16, W, 1],
  [0, 25, W, 1],
]);
/** Droppers every few metres, tying contact to catenary — the OLE rhythm. */
const DROPPERS = pxPath(repeat(Math.floor(W / 85), 85, [40, 17, 1, 8] as Rect));

/** The road bridge at the Gdańsk end, carrying Obrońców Wybrzeża over the line. */
const BRIDGE = {
  deck: pxPath([[0, 62, 150, 14]]),
  soffit: pxPath([[0, 76, 150, 4]]),
  parapet: pxPath([[0, 56, 150, 4], ...repeat(8, 18, [4, 44, 3, 13] as Rect)]),
  abutment: pxPath([[104, 80, 46, 56]]),
};
/** The deck in the round: kerb line, expansion tooth, lit parapet rail. */
const BRIDGE_KERB = pxPath([[0, 62, 150, 2]]);
const BRIDGE_TOOTH = pxPath([[147, 62, 3, 14]]);
const BRIDGE_PARAPET_HI = pxPath([[0, 56, 150, 1]]);
/** Girder ribs along the soffit — a bridge has bones. */
const BRIDGE_RIBS = pxPath(repeat(6, 24, [6, 76, 4, 4] as Rect));
/** The bearing shelf the deck actually sits on, and its damp. */
const BRIDGE_SHELF = pxPath([[104, 76, 46, 4]]);
const BRIDGE_DAMP = pxPath([
  [118, 84, 2, 22],
  [134, 84, 1, 16],
]);
/** Two pigeons roost on the shelf, and the abutment below them knows it. */
const BRIDGE_PIGEONS = pxPath([
  [112, 72, 4, 3],
  [115, 71, 2, 2],
  [126, 72, 4, 3],
  [129, 71, 2, 2],
]);
const PIGEON_STREAKS = pxPath([
  [113, 80, 2, 9],
  [127, 80, 2, 7],
]);
/** The silver throw-up on the abutment — the most reachable canvas here. */
const ABUT_TAG = pxPath([
  [108, 112, 14, 9],
  [124, 113, 14, 8],
]);
const ABUT_TAG_LINE = pxPath([[108, 121, 30, 1]]);
/** The gloom under the deck: two steps of it, and the cutting goes dark
 * before the bridge does — which is what standing under a bridge is. */
const UNDER_GLOOM_WIDE = pxPath([[0, 80, 104, 56]]);
const UNDER_GLOOM_CORE = pxPath([[0, 80, 68, 56]]);

/** Sodium street lamps on the road behind the fence — the warm half of the night. */
const ROAD_LAMPS = [absLamp(180), absLamp(640), absLamp(1100), absLamp(1560)];
function absLamp(x: number): { post: string; head: string; halo: string; wash: string; x: number } {
  return {
    x,
    post: pxPath([
      [x, 40, 3, 58],
      [x, 40, 16, 3],
    ]),
    head: pxPath([[x + 12, 40, 10, 5]]),
    halo: pxPath([[x + 8, 37, 18, 10]]),
    wash: pxPath([[x - 16, 110, 52, 26]]),
  };
}

function FarSide({ ph, s, lit }: { ph: Ph; s: StationState; lit: boolean }) {
  const night = ph === "night";
  const wall = CONC[ph];
  const green = s.season === "green";
  return (
    <g>
      {/* the road bridge at the Gdańsk end */}
      <path d={BRIDGE.deck} fill={wall.base} />
      <path d={BRIDGE_KERB} fill="#0d0f13" opacity={0.25} />
      <path d={BRIDGE_TOOTH} fill="#0d0f13" opacity={0.4} />
      <path d={BRIDGE.soffit} fill={wall.deep} />
      <path d={BRIDGE_RIBS} fill={wall.deep} />
      <path d={BRIDGE_RIBS} transform="translate(0,1)" fill="#0d0f13" opacity={0.3} />
      {/* a bus crosses it now and then — Obrońców Wybrzeża going about its
          day. The windows are their own path now (they used to be painted
          body-colour, a bus full of bus), lit amber after dark. */}
      <g opacity={0}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0;1;1;0;0;0;0"
          dur="41s"
          repeatCount="indefinite"
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;40 0;190 0;200 0;200 0;200 0;0 0"
          keyTimes="0;0.06;0.3;0.32;0.5;0.9;1"
          dur="41s"
          repeatCount="indefinite"
        />
        <path d={pxPath([[-34, 47, 30, 9]])} fill={night ? "#4a3438" : "#c9463c"} />
        <path
          d={pxPath([
            [-31, 49, 7, 4],
            [-22, 49, 7, 4],
            [-13, 49, 7, 4],
          ])}
          fill={night ? "#ffd98a" : "#cfe0ea"}
          opacity={0.9}
        />
        <path d={pxPath([[-34, 54, 30, 1]])} fill="#0d0f13" opacity={0.4} />
      </g>
      <path d={BRIDGE_PARAPET_HI} fill={GALV[ph].hi} opacity={0.5} />
      <path d={BRIDGE.parapet} fill={GALV[ph].base} />
      <path d={BRIDGE.abutment} fill={wall.mid} />
      <path d={BRIDGE.abutment} fill={dth("n", "12")} opacity={0.4} />
      <path d={BRIDGE_SHELF} fill={wall.deep} />
      <path d={BRIDGE_DAMP} fill="#0d0f13" opacity={0.3} />
      {/* the pigeons that live under every bridge, and their signature */}
      <path d={BRIDGE_PIGEONS} fill={night ? "#2a2d34" : "#5d6068"} />
      <path d={PIGEON_STREAKS} fill={K.white} opacity={0.3} />
      {/* the silver throw-up, at the exact height a stretched arm reaches */}
      <path d={ABUT_TAG} fill="#aab6be" opacity={night ? 0.3 : 0.45} />
      <path d={ABUT_TAG_LINE} fill="#23262b" opacity={0.5} />
      {/* the crow that owns the fence rail: lands, hops twice, leaves */}
      <g fill={night ? "#1e222c" : "#23262b"}>
        <path
          d={pxPath([
            [1245, 90, 6, 4],
            [1249, 88, 3, 3],
            [1243, 92, 2, 2],
          ])}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;1;1;1;1;0;0;0"
            dur="52s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;0 0;5 0;5 0;12 0;12 0;12 0;0 0"
            dur="52s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* street lamps on the road, behind the fence. Sodium: warm, patient,
          and the third one is dying — every sodium lamp is dying, this one
          has just got further along. */}
      {ROAD_LAMPS.map((l) => (
        <g key={`rl${l.x}`}>
          <path d={l.post} fill={GALV[ph].lo} />
          <path d={l.head} fill={lit ? "#ffb84a" : GALV[ph].mid} />
          {lit ? (
            l.x === 1100 ? (
              <g>
                <path d={l.head} fill="#ffd98a" opacity={0.5}>
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0.5;0.5;0.1;0.5;0.5;0.25;0.5"
                    dur="7s"
                    repeatCount="indefinite"
                  />
                </path>
                <path d={l.halo} fill="#ffb84a" opacity={0.12}>
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0.12;0.12;0.03;0.12;0.12;0.06;0.12"
                    dur="7s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            ) : (
              <g>
                <path d={l.head} fill="#ffd98a" opacity={0.5} />
                <path d={l.halo} fill="#ffb84a" opacity={0.12} />
              </g>
            )
          ) : null}
        </g>
      ))}

      {/* the fence along the boundary: bars, their shadows on the coping,
          the lit top rail, the sign, the pried gap, the bag */}
      <path d={FENCE_BARS} transform="translate(1,2)" fill="#0d0f13" opacity={0.15} />
      <path d={FENCE_BARS} fill={GALV[ph].mid} opacity={0.9} />
      <path d={FENCE_BENT} fill={GALV[ph].lo} />
      <path d={FENCE_RAILS} fill={GALV[ph].lo} />
      <path d={FENCE_RAIL_HI} fill={GALV[ph].hi} opacity={0.5} />
      <path d={FENCE_SIGN} fill={K.white} opacity={0.85} />
      <path d={FENCE_SIGN_ROWS} fill="#8a2424" opacity={0.8} />
      <path d={FENCE_SIGN_TIES} fill={GALV[ph].hi} opacity={0.8} />
      {/* the bag: caught in 2019, fluttering ever since */}
      <path d={pxPath([[BAG_AT.x, BAG_AT.y, 4, 3]])} fill={K.white} opacity={0.6}>
        <animateTransform
          attributeName="transform"
          type="translate"
          calcMode="discrete"
          values="0 0;1 0;0 1;1 1;0 0;1 0;0 0"
          dur="1.9s"
          repeatCount="indefinite"
        />
      </path>

      {/* the retaining wall */}
      <path d={CUT_WALL} fill={wall.base} />
      <path d={CUT_PANELS} fill={wall.deep} opacity={0.6} />
      <path d={CUT_PANELS_LIT} fill={wall.hi} opacity={0.35} />
      <path d={WALL_LIFTS} fill={wall.deep} opacity={0.25} />
      <path d={CUT_COPING} fill={wall.hi} />
      <path d={COPING_TICKS} fill={wall.deep} opacity={0.5} />
      <path d={COPING_SHADOW} fill="#0d0f13" opacity={0.3} />
      <path d={CUT_WALL} fill={dth("n", "06")} opacity={0.5} />
      {/* the one recast panel: younger concrete between harder joints */}
      <path d={WALL_NEW_PANEL} fill={wall.hi} opacity={0.15} />
      <path d={WALL_NEW_JOINTS} fill={wall.deep} opacity={0.8} />
      {/* what water does to concrete, given thirty years */}
      <path d={WALL_STREAKS} fill="#0d0f13" opacity={0.22} />
      <path d={WEEP_HOLES} fill="#0d0f13" opacity={0.6} />
      <path d={WEEP_STAINS} fill="#0d0f13" opacity={0.3} />
      <path d={WALL_SALT} fill={K.white} opacity={0.12} />
      <path d={WALL_SPLASH} fill="#0d0f13" opacity={0.18} />
      <path d={WALL_MOSS} fill={LEAF[ph].mid} opacity={night ? 0.4 : 0.7} />
      {/* the graffiti war, in order of events: the scrubbed ghost (the jet
          washer gave up before the paint did), LECHIA with its drips, the
          ARKA that answered from over the water — struck through the same
          week — and, lower and older than any of it, M+K in a heart */}
      <path d={WALL_GHOST} fill={wall.hi} opacity={0.4} />
      <path d={WALL_GHOST_EDGES} fill={wall.hi} opacity={0.3} />
      <path d={WALL_GHOST_BLEED} fill="#5a6a80" opacity={0.25} />
      <g transform={`translate(${WALL_TAG_AT.x} ${WALL_TAG_AT.y}) scale(2)`}>
        <path d={textPath("LECHIA", 0, 0)} fill={night ? "#5a6a80" : "#7ea0c0"} opacity={0.75} />
      </g>
      <path d={TAG_DRIPS} fill={night ? "#5a6a80" : "#7ea0c0"} opacity={0.55} />
      <g transform={`translate(${RIVAL_AT.x} ${RIVAL_AT.y})`}>
        <path d={textPath("ARKA", 0, 0)} fill={night ? "#8a7a3a" : "#c9b23c"} opacity={0.6} />
      </g>
      <path d={RIVAL_STRIKE} fill={night ? "#5a6a80" : "#7ea0c0"} opacity={0.8} />
      <g transform={`translate(${HEART_AT.x} ${HEART_AT.y})`}>
        <path d={textPath("M+K", 0, 0)} fill={night ? "#6a4a5a" : "#a86a86"} opacity={0.6} />
      </g>
      <path d={HEART} fill={night ? "#6a4a5a" : "#a86a86"} opacity={0.55} />
      {/* the kilometre plate: the one mark on this wall the railway put here */}
      <path d={KM_PLATE} fill={K.white} opacity={0.85} />
      <g transform={`translate(1522 117)`}>
        <path d={textPath("12", 0, 0)} fill="#23262b" opacity={0.9} />
      </g>
      <g transform={`translate(1523 124)`}>
        <path d={textPath("4", 0, 0)} fill="#23262b" opacity={0.9} />
      </g>
      <path
        d={CUT_WEEDS}
        fill={s.season === "bare" ? "#6b5f4a" : LEAF[ph].mid}
        opacity={night ? 0.5 : 0.9}
      />
      {green ? <path d={WEED_BLOOMS} fill="#8a6aa8" opacity={0.8} /> : null}
      {/* the warm wash the sodium throws on the wall — the road's half of
          the night arriving over the fence */}
      {lit && night
        ? ROAD_LAMPS.map((l) => (
            <path
              key={`wash${l.x}`}
              d={l.wash}
              fill="#ffb84a"
              opacity={l.x === 1100 ? 0.04 : 0.07}
            />
          ))
        : null}

      {/* the gloom under the bridge deck: the cutting goes dark before the
          bridge does, in two steps, over everything that stands in it */}
      <path d={UNDER_GLOOM_WIDE} fill="#0d0f13" opacity={0.3} />
      <path d={UNDER_GLOOM_CORE} fill="#0d0f13" opacity={0.15} />

      {/* the cat that walks the coping after dark: appears, crosses at cat
          pace, sits once mid-way because it owns the wall, and is gone */}
      {night ? (
        <g fill="#15171c">
          <path
            d={pxPath([
              [300, 104, 8, 3],
              [307, 102, 3, 3],
              [309, 100, 1, 2],
              [298, 101, 2, 4],
            ])}
            opacity={0}
          >
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0;1;1;1;1;0;0"
              keyTimes="0;0.04;0.3;0.35;0.62;0.63;1"
              dur="73s"
              repeatCount="indefinite"
            />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 0;130 0;130 0;280 0;280 0;0 0"
              keyTimes="0;0.04;0.3;0.35;0.62;0.63;1"
              dur="73s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/**
 * The overhead line equipment, at the same distance as the track it hangs over.
 */
function Catenary({ ph }: { ph: Ph }) {
  const night = ph === "night";
  return (
    <g>
      <path d={WIRES} fill={night ? "#3a4048" : "#6d7278"} opacity={0.7} />
      {/* the droppers: the rhythm that makes two lines into a system */}
      <path d={DROPPERS} fill={night ? "#3a4048" : "#6d7278"} opacity={0.5} />
      <path d={MASTS_PATH} fill={GALV[ph].base} />
      <path d={MAST_FLANKS} fill="#0d0f13" opacity={0.2} />
      <path d={INSULATORS} fill="#5a3a2a" />
      <path d={MAST_PLATES} fill={K.white} opacity={0.8} />
      <path d={MAST_PLATE_TICKS} fill="#23262b" opacity={0.8} />
      <path d={MAST_BASES} fill={CONC[ph].mid} />
      <path d={MAST_BASES} transform="translate(0,1)" fill="#0d0f13" opacity={0.2} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the track and the platform (parallax 1.0), enriched pass
 *
 * Same bones, more history. What got added, all deterministic:
 *   - the rails now have rusty webs under polished heads, four
 *     insulated joints with fishplates and bolts, and wheel-burn
 *     smears where the units brake
 *   - two sleepers were renewed in spring and are still pale;
 *     the ballast has a crest line and oil from the units
 *   - the coping declares its precast joints; one stretch of the
 *     yellow line was repainted and still holds its colour
 *   - the tactile studs glint on one corner and go smooth where
 *     the crowd stands; every fourth slab joint was recut and
 *     sealed black; one slab is a younger replacement; there is
 *     an expansion joint with bitumen squeezed proud
 *   - rain now also floods the four-foot and two slab hollows,
 *     and the puddles hold a pixel of sky
 *   - litter, a clogged grate in autumn, and three animated
 *     residents: a pigeon working the edge by day, a rat that
 *     owns the four-foot after midnight, one leaf that refuses
 *     to settle
 * ================================================================== */

/**
 * The track.
 *
 * Read from the back of the frame forward: the cess and its drainage, the far
 * rail, the sleeper ends, the near rail, and the ballast shoulder that the
 * platform is built against. Everything below y = RAIL_Y is platform and hides
 * the rest of it, which is what standing on a platform is like.
 *
 * The sleeper pitch is 0.60 m — 23 px — and is the strongest rhythm in the
 * scene. It is what makes the track read as track rather than as a grey band,
 * so it is drawn at true pitch across the whole 2000 px even though most of each
 * sleeper is buried.
 */
const BALLAST = pxPath([[0, 126, W, 24]]);
/** Ballast texture: two dither passes, one coarse and one fine. */
const BALLAST_TEX = pxPath([[0, 126, W, 24]]);
/** The shoulder has a crest — one darker line where the profile breaks. */
const BALLAST_CREST = pxPath([[0, 126, W, 1]]);
const SLEEPERS = pxPath(repeat(Math.ceil(W / 23), 23, [0, 132, 13, 16] as Rect));
/** Concrete sleepers, so the ends are pale where the ballast has worn off them. */
const SLEEPER_ENDS = pxPath(repeat(Math.ceil(W / 23), 23, [0, 132, 13, 3] as Rect));
/** Two sleepers were renewed in spring; concrete that young is still pale. */
const SLEEPERS_NEW = pxPath([
  [23 * 30, 132, 13, 16],
  [23 * 61, 132, 13, 16],
]);
/** What the units drip between the rails, in the metres where they idle. */
const TRACK_OIL = pxPath(
  Array.from({ length: 7 }, (_, i) => {
    const x = (i * 293 + 210) % W;
    return [x, 137, 8 + ((i * 3) % 8), 3] as Rect;
  }),
);
/** Standing water in the four-foot after rain. */
const TRACK_PUDDLES = pxPath(
  Array.from({ length: 10 }, (_, i) => {
    const x = (i * 197 + 60) % W;
    return [x, 139, 7 + ((i * 3) % 6), 2] as Rect;
  }),
);

/** Both rails, with the near one at the platform edge and polished on top. */
const RAIL_FAR = pxPath([
  [0, 131, W, 3],
  [0, 134, W, 2],
]);
const RAIL_FAR_TOP = pxPath([[0, 131, W, 1]]);
const RAIL_NEAR = pxPath([
  [0, 145, W, 4],
  [0, 149, W, 2],
]);
const RAIL_NEAR_TOP = pxPath([[0, 145, W, 1]]);
/** The webs rust; only the heads stay bright, because wheels do that. */
const RAIL_FAR_WEB_RUST = pxPath([[0, 133, W, 1]]);
const RAIL_NEAR_WEB_RUST = pxPath([[0, 147, W, 2]]);
/**
 * Four insulated joints in the near rail: the gap you would hear, the
 * fishplate over it, and the two bolt heads. The one piece of track detail
 * that reads at this scale and says somebody signals these lines.
 */
const RAIL_JOINT_X = [312, 782, 1294, 1730];
const RAIL_JOINT_GAPS = pxPath(RAIL_JOINT_X.map((x) => [x, 145, 1, 6] as Rect));
const RAIL_FISHPLATES = pxPath(RAIL_JOINT_X.map((x) => [x - 5, 146, 11, 3] as Rect));
const RAIL_FISHBOLTS = pxPath(
  RAIL_JOINT_X.flatMap(
    (x) =>
      [
        [x - 3, 147, 1, 1],
        [x + 3, 147, 1, 1],
      ] as Rect[],
  ),
);
/** Wheel-burn: brighter smears on the near head where the units brake. */
const RAIL_BURNISH = pxPath(
  Array.from({ length: 9 }, (_, i) => {
    const x = (i * 229 + 120) % W;
    return [x, 145, 10 + ((i * 5) % 12), 1] as Rect;
  }),
);
/** Rail fastenings at every sleeper — the detail that says this is modern track. */
const FASTENINGS = pxPath([
  ...repeat(Math.ceil(W / 23), 23, [1, 143, 3, 3] as Rect),
  ...repeat(Math.ceil(W / 23), 23, [9, 143, 3, 3] as Rect),
  ...repeat(Math.ceil(W / 23), 23, [1, 129, 3, 3] as Rect),
]);

/**
 * The platform.
 *
 * Precast slabs on a concrete edge beam, which is how every rebuilt SKM platform
 * is made, so it comes with three things that are always there: the coping unit
 * along the edge with its cast-in yellow, the tactile warning strip 0.60 m back
 * from it, and the joint every 1.5 m where the slabs meet. The joints run the
 * whole depth of the platform and are the only thing giving the surface a plan.
 */
const PLAT_SURFACE = pxPath([[0, RAIL_Y, W, 30]]);
/** The coping unit: the edge itself, in a harder grey than the slabs. */
const PLAT_COPING = pxPath([
  [0, RAIL_Y, W, 5],
  [0, RAIL_Y + 5, W, 1],
]);
/** The coping is precast in 2.5 m units, and every unit declares its joint. */
const COPING_JOINTS = pxPath(repeat(Math.ceil(W / 96), 96, [0, RAIL_Y, 1, 6] as Rect));
/** The yellow line, cast into the coping and repainted over the top of that. */
const PLAT_YELLOW = pxPath([[0, RAIL_Y + 1, W, 4]]);
/** Where the paint has gone: deterministic, so it does not crawl. */
const PLAT_YELLOW_WORN = pxPath(
  Array.from({ length: 46 }, (_, i) => {
    const x = (i * 137) % W;
    return [x, RAIL_Y + 1, 4 + ((i * 7) % 9), 4] as Rect;
  }),
);
/** The stretch the maintainer repainted last spring, still holding its colour. */
const YELLOW_FRESH = pxPath([[588, RAIL_Y + 1, 168, 4]]);
/** Tactile studs, 0.60 m back from the edge. */
const PLAT_TACTILE = pxPath(repeat(Math.ceil(W / 8), 8, [2, RAIL_Y + 9, 4, 4] as Rect));
/** Each stud catches light on one corner… */
const TACTILE_GLINTS = pxPath(repeat(Math.ceil(W / 8), 8, [2, RAIL_Y + 9, 1, 1] as Rect));
/** …and goes smooth where the crowd has stood on it for twenty years. */
const TACTILE_WORN = pxPath([[Z.shelterL - 6, RAIL_Y + 9, Z.shelterR - Z.shelterL + 12, 4]]);
/** Slab joints, every 1.5 m, running back from the edge. */
const PLAT_JOINTS = pxPath(repeat(Math.ceil(W / 57), 57, [0, RAIL_Y + 6, 1, 24] as Rect));
/** Every fourth joint was recut last year and sealed black. */
const JOINTS_SEALED = pxPath(repeat(Math.ceil(W / 228), 228, [57, RAIL_Y + 6, 1, 24] as Rect));
/** The joint parallel to the edge, where the coping beam meets the slabs. */
const PLAT_SEAM = pxPath([[0, RAIL_Y + 15, W, 1]]);
/** One slab is a replacement — younger concrete, and edges still crisp. */
const SLAB_PATCH = pxPath([[1141, RAIL_Y + 6, 55, 24]]);
const SLAB_PATCH_EDGE = pxPath([
  [1140, RAIL_Y + 6, 1, 24],
  [1196, RAIL_Y + 6, 1, 24],
]);
/** The expansion joint mid-platform, its bitumen squeezed proud in summer. */
const EXPANSION_JOINT = pxPath([
  [988, RAIL_Y + 6, 3, 24],
  [986, RAIL_Y + 14, 7, 2],
]);

/**
 * Wear. A platform is not a clean surface and this is the layer that says so:
 * the dark scuff line where everyone walks — 1.2 m back from the edge, because
 * that is where people stand — chewing gum, cigarette burns near the bins, and
 * the pale patch under the shelter where the rain never reaches.
 */
const PLAT_WEAR = pxPath([[0, RAIL_Y + 17, W, 6]]);
const PLAT_GUM = pxPath(
  Array.from({ length: 34 }, (_, i) => {
    const x = (i * 211 + 40) % W;
    const y = RAIL_Y + 14 + ((i * 5) % 12);
    return [x, y, 2, 2] as Rect;
  }),
);
const PLAT_DRY = pxPath([[Z.shelterL - 10, RAIL_Y + 6, Z.shelterR - Z.shelterL + 20, 24]]);

/**
 * Two cracks, where a precast slab has been loaded wrong for thirty years:
 * one radiating from a joint mid-platform, one at the far end where the water
 * gets in. Each is a one-pixel meander, hand-laid, because a generated crack
 * walks a random walk and a real one follows the weakness in the slab.
 */
const PLAT_CRACKS = pxPath([
  [846, RAIL_Y + 9, 1, 4],
  [847, RAIL_Y + 13, 1, 3],
  [846, RAIL_Y + 16, 1, 2],
  [845, RAIL_Y + 18, 2, 1],
  [847, RAIL_Y + 19, 1, 4],
  [1592, RAIL_Y + 12, 1, 3],
  [1591, RAIL_Y + 15, 1, 3],
  [1592, RAIL_Y + 18, 1, 2],
  [1593, RAIL_Y + 20, 1, 3],
  [1592, RAIL_Y + 23, 2, 1],
]);

/**
 * Cigarette ends, in the two places they actually collect: the downwind end of
 * the shelter, and around the bin — never in it. A few are burns rather than
 * butts, which is the difference between last week and last year.
 */
const PLAT_STUBS = pxPath([
  [700, RAIL_Y + 16, 2, 1],
  [706, RAIL_Y + 20, 2, 1],
  [698, RAIL_Y + 23, 2, 1],
  [712, RAIL_Y + 14, 2, 1],
  [703, RAIL_Y + 26, 2, 1],
  [1284, RAIL_Y + 18, 2, 1],
  [1296, RAIL_Y + 22, 2, 1],
  [1322, RAIL_Y + 16, 2, 1],
  [1290, RAIL_Y + 26, 2, 1],
  [1616, RAIL_Y + 15, 2, 1],
  [1622, RAIL_Y + 19, 2, 1],
]);
const PLAT_BURNS = pxPath([
  [708, RAIL_Y + 18, 1, 1],
  [1300, RAIL_Y + 20, 1, 1],
  [1618, RAIL_Y + 22, 1, 1],
]);

/** Dropped paper, a flattened cup, a bottle cap — ahead of the sweeper. */
const PLAT_LITTER = pxPath([
  [536, RAIL_Y + 21, 3, 2],
  [1462, RAIL_Y + 13, 2, 2],
  [872, RAIL_Y + 24, 2, 1],
]);

/**
 * Grass through the joints past the ramp, where the sweeper turns round. The
 * far end of every platform belongs to the plants; the tufts sit exactly on
 * the slab joints because that is the only place there is soil.
 */
const PLAT_TUFTS = pxPath([
  [1767, RAIL_Y + 6, 2, 3],
  [1769, RAIL_Y + 7, 1, 2],
  [1824, RAIL_Y + 6, 3, 3],
  [1881, RAIL_Y + 7, 2, 2],
  [1938, RAIL_Y + 6, 2, 3],
  [1940, RAIL_Y + 5, 1, 2],
]);

/** Autumn: what has blown off the trees onto the platform and into the cess. */
const LEAVES = pxPath(
  Array.from({ length: 60 }, (_, i) => {
    const x = (i * 167 + 90) % W;
    const y = i % 3 === 0 ? 138 + ((i * 3) % 8) : RAIL_Y + 8 + ((i * 7) % 20);
    return [x, y, 3, 2] as Rect;
  }),
);

/** Drainage: a channel along the back of the platform, and its gratings. */
const PLAT_CHANNEL = pxPath([[0, 176, W, 4]]);
const PLAT_GRATES = pxPath(repeat(Math.ceil(W / 220), 220, [40, 176, 26, 4] as Rect));
/** A clump of leaves has found the third grate and means to stay. */
const GRATE_CLOG = pxPath([
  [478, 175, 12, 3],
  [482, 173, 5, 2],
]);
/** Puddles hold the sky in the two hollows the slabs have settled into. */
const PLAT_PUDDLES = pxPath([
  [452, RAIL_Y + 16, 30, 3],
  [458, RAIL_Y + 19, 16, 1],
  [1358, RAIL_Y + 17, 24, 2],
]);
const PLAT_PUDDLE_GLINT = pxPath([
  [460, RAIL_Y + 16, 7, 1],
  [1364, RAIL_Y + 17, 5, 1],
]);

/**
 * Platform markings. Two things, both real and both useful: the "8" and "6" car
 * stop marks the driver brakes to, and the boarding zone hatching where the
 * doors will be. The hatching is the game telling the player where to stand
 * without a word of UI, which is what §10 asks for.
 */
const STOP_MARKS = pxPath([
  ...textRectsAt("8", 1898, RAIL_Y + 20),
  ...textRectsAt("6", 1420, RAIL_Y + 20),
  ...textRectsAt("4", 940, RAIL_Y + 20),
]);
function textRectsAt(text: string, x: number, y: number): Rect[] {
  // the pixel font at 2×, laid out by hand so the marks sit on the grid
  const rows: Record<string, string[]> = {
    "4": ["101", "101", "111", "001", "001"],
    "6": ["111", "100", "111", "101", "111"],
    "8": ["111", "101", "111", "101", "111"],
  };
  const g = rows[text];
  if (!g) return [];
  const out: Rect[] = [];
  for (const [ry, row] of g.entries()) {
    for (const [rx, c] of row.split("").entries()) {
      if (c === "1") out.push([x + rx * 2, y + ry * 2, 2, 2]);
    }
  }
  return out;
}
/**
 * The boarding hatching, which is the game telling the player where to stand
 * without a word of UI. It has to be legible or it is decoration: a bracket of
 * chevrons on the platform under each door, plus a solid stub against the
 * coping so the mark still reads when somebody is standing on it.
 */
const BOARD_ZONES = pxPath(
  DOOR_X.flatMap((cx) => [
    ...repeat(9, 6, [cx - 27, RAIL_Y + 18, 3, 8] as Rect),
    [cx - 28, RAIL_Y + 8, 56, 2] as Rect,
    [cx - 28, RAIL_Y + 8, 2, 8] as Rect,
    [cx + 26, RAIL_Y + 8, 2, 8] as Rect,
  ]),
);

function TrackAndPlatform({ ph, s }: { ph: Ph; s: StationState }) {
  const night = ph === "night";
  const conc = CONC[ph];
  const wet = s.weather === "rain" || s.weather === "wet";
  return (
    <g>
      {/* ballast and sleepers */}
      <path d={BALLAST} fill={night ? "#3a3d42" : "#7a756c"} />
      <path d={BALLAST_TEX} fill={dth("n", "25")} opacity={0.55} />
      <path d={BALLAST_TEX} fill={dth("c", "12")} opacity={night ? 0.06 : 0.18} />
      <path d={BALLAST_CREST} fill="#000" opacity={0.2} />
      <path d={SLEEPERS} fill={night ? "#4a4d52" : "#8e8a80"} />
      <path d={SLEEPERS_NEW} fill={night ? "#5e6168" : "#a4a096"} />
      <path d={SLEEPER_ENDS} fill={night ? "#5a5d62" : "#a8a49a"} />
      {/* the oil the units leave in the metres where they idle */}
      <path d={TRACK_OIL} fill="#14120e" opacity={night ? 0.35 : 0.3} />
      {/* rain floods the four-foot before it floods anything else */}
      {wet ? <path d={TRACK_PUDDLES} fill="#3a4450" opacity={0.55} /> : null}

      {/* the two rails. The near rail head is the brightest thing here by day. */}
      <path d={RAIL_FAR} fill={night ? "#4f5358" : "#6d7278"} />
      <path d={RAIL_FAR_WEB_RUST} fill="#6a4a34" opacity={night ? 0.25 : 0.45} />
      <path d={RAIL_FAR_TOP} fill={night ? K.railTopNight : K.railTop} opacity={0.8} />
      <path d={FASTENINGS} fill={night ? "#3f4348" : "#5f646a"} />
      <path d={RAIL_NEAR} fill={night ? "#54585d" : "#7d8085"} />
      <path d={RAIL_NEAR_WEB_RUST} fill="#6a4a34" opacity={night ? 0.25 : 0.45} />
      {/* the joints: fishplate, two bolts, and the gap the wheels count */}
      <path d={RAIL_FISHPLATES} fill={night ? "#464a50" : "#6a6e74"} />
      <path d={RAIL_FISHBOLTS} fill={night ? "#5c6066" : "#8d9096"} />
      <path d={RAIL_JOINT_GAPS} fill="#000" opacity={0.45} />
      <path d={RAIL_NEAR_TOP} fill={night ? K.railTopNight : K.railTop} />
      {/* wheel-burn: the braking metres shine harder than the rest */}
      <path d={RAIL_BURNISH} fill="#f2f5f8" opacity={night ? 0.25 : 0.5} />

      {/* the platform */}
      <path d={PLAT_SURFACE} fill={conc.base} />
      <path d={PLAT_SURFACE} fill={dth("n", "06")} opacity={0.45} />
      <path d={PLAT_DRY} fill={conc.hi} opacity={wet ? 0.35 : 0.14} />
      <path d={PLAT_COPING} fill={conc.mid} />
      <path d={PLAT_YELLOW} fill={night ? K.safetyWorn : K.safety} />
      <path d={PLAT_YELLOW_WORN} fill={conc.mid} opacity={0.55} />
      {/* the repainted stretch goes on over the wear, which is the point */}
      <path d={YELLOW_FRESH} fill={night ? K.safetyWorn : K.safety} opacity={0.75} />
      <path d={COPING_JOINTS} fill={conc.deep} opacity={0.4} />
      <path d={PLAT_TACTILE} fill={conc.lo} />
      <path d={TACTILE_GLINTS} fill={conc.hi} opacity={0.5} />
      <path d={TACTILE_WORN} fill={conc.base} opacity={0.45} />
      <path d={PLAT_JOINTS} fill={conc.deep} opacity={0.5} />
      <path d={JOINTS_SEALED} fill="#0e0c0a" opacity={0.65} />
      <path d={PLAT_SEAM} fill={conc.deep} opacity={0.45} />
      {/* the replacement slab: younger concrete, and it shows */}
      <path d={SLAB_PATCH} fill={conc.hi} opacity={0.25} />
      <path d={SLAB_PATCH_EDGE} fill={conc.deep} opacity={0.7} />
      {/* the expansion joint, bitumen proud of the surface since July */}
      <path d={EXPANSION_JOINT} fill="#14120e" opacity={0.7} />
      <path d={PLAT_WEAR} fill={dth("n", "12")} opacity={0.5} />
      <path d={PLAT_GUM} fill={night ? "#3a3d42" : "#6f6c66"} opacity={0.7} />
      <path d={PLAT_CRACKS} fill={conc.deep} opacity={0.7} />
      <path d={PLAT_STUBS} fill={night ? "#8a877e" : "#d8d4c8"} opacity={0.6} />
      <path d={PLAT_BURNS} fill="#2b2622" opacity={0.6} />
      <path d={PLAT_LITTER} fill={night ? "#9a978e" : "#e8e4da"} opacity={0.7} />
      <path
        d={PLAT_TUFTS}
        fill={s.season === "bare" ? "#6b5f4a" : LEAF[ph].mid}
        opacity={night ? 0.55 : 0.9}
      />
      <path d={STOP_MARKS} fill={conc.hi} opacity={0.55} />
      <path d={STOP_MARKS} fill={dth("n", "12")} opacity={0.3} />
      <path d={BOARD_ZONES} fill={night ? K.safetyWorn : K.safety} opacity={0.62} />
      {/* feet have stood on the hatching since it was painted, and it shows */}
      <path d={BOARD_ZONES} fill={dth("n", "12")} opacity={0.25} />
      <path d={PLAT_CHANNEL} fill={conc.deep} />
      <path d={PLAT_GRATES} fill={GALV[ph].deep} />
      {/* the third grate has been collecting leaves since October */}
      {s.season !== "green" ? (
        <path d={GRATE_CLOG} fill={s.season === "autumn" ? "#9a6f34" : "#6b5f4a"} opacity={0.85} />
      ) : null}
      {/* the duct lids along the back of the walk, two of them renewed */}
      <path d={DUCT_LIDS} fill={conc.mid} />
      <path d={DUCT_NEW} fill={conc.hi} opacity={0.7} />
      <path d={DUCT_JOINTS} fill={conc.deep} opacity={0.7} />
      <path d={DUCT_HOLES} fill="#171009" opacity={0.4} />
      {/* the units brake in the same metres every day, and the lane knows */}
      <path d={BRAKE_DUST} fill="#171009" opacity={0.12} />
      {/* where a bench stood before the shelter came: paint, and four bolts */}
      <path d={BENCH_GHOST} fill={conc.hi} opacity={0.35} />
      <path d={BENCH_GHOST_BOLTS} fill={conc.deep} opacity={0.8} />
      <path d={STOP_OIL} fill="#14120e" opacity={0.55} />

      {/* what the trees have dropped */}
      {s.season !== "green" ? (
        <path d={LEAVES} fill={s.season === "autumn" ? "#9a6f34" : "#6b5f4a"} opacity={0.8} />
      ) : null}
      {/* one leaf refuses to settle: it skitters in gusts, rests, goes again */}
      {s.season === "autumn" ? (
        <path d={pxPath([[300, RAIL_Y + 12, 3, 2]])} fill="#9a6f34" opacity={0.9}>
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;28 2;61 0;97 3;140 1;188 4;240 2;240 2;0 0"
            keyTimes="0;0.08;0.14;0.22;0.31;0.42;0.5;0.96;1"
            dur="19s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}

      {/* the residents. A pigeon works the edge by day — hop, hop, pause,
          hop — in discrete jumps because pigeons do not glide along the
          ground, they teleport in small amounts. */}
      {!night ? (
        <g fill="#5d6068">
          <path
            d={pxPath([
              [604, RAIL_Y + 3, 4, 3],
              [608, RAIL_Y + 2, 2, 2],
            ])}
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;6 0;6 0;13 0;13 0;21 0;21 0;27 0;27 0;0 0"
            keyTimes="0;0.07;0.2;0.27;0.45;0.52;0.7;0.77;0.97;1"
            dur="11s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* and the rat owns the four-foot after midnight: a long nothing, one
          dash along the sleepers, gone into the ballast */}
      {night ? (
        <g fill="#1d1f24" opacity={0.9}>
          <path
            d={pxPath([
              [420, 139, 5, 2],
              [417, 140, 3, 1],
            ])}
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;230 0;230 0"
            keyTimes="0;0.6;0.72;1"
            dur="37s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;0.9;0;0"
            keyTimes="0;0.58;0.73;1"
            dur="37s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}

      {/* rain sheen: the platform goes darker, the rail heads go bright,
          and the two hollows the slabs settled into hold the sky */}
      {wet ? (
        <>
          <rect x={0} y={RAIL_Y} width={W} height={30} fill="#2a3038" opacity={0.22} />
          <path d={RAIL_NEAR_TOP} fill="#e8ecef" opacity={0.5} />
          <path d={PLAT_PUDDLES} fill="#3a4450" opacity={0.5} />
          <path d={PLAT_PUDDLE_GLINT} fill="#c8d4e0" opacity={0.6} />
        </>
      ) : null}
    </g>
  );
}
/* ================================================================== *
 * PLANE 4 — platform furniture (parallax 1.0), enriched pass
 *
 * Every object keeps its geometry and gains its biography:
 *   - the shelter: dirt and droppings on the roof, a sky band and a
 *     frame shadow in every pane, a taped notice, a bench with a lit
 *     nose worn shiny in the three places people actually sit
 *   - bins with dark mouths, shaded sides and route stickers
 *   - the CIP grows pigeon spikes (they work), drain slots, screen
 *     glare, and hangers for the direction sign
 *   - the biletomat gets a shaded flank, screen bezel, kick scuffs,
 *     the worn patch where the queue stands, and one dropped receipt
 *   - the kasownik is rubbed bare either side of the slot
 *   - the drum: cap shadow, wrap seam, base grime, a date line
 *   - the timetable case: cast shadow, corner screws, a glare stripe,
 *     and one row printed red, because Saturdays are
 *   - the clock gains a SECOND hand on the same negative-begin trick
 *   - the signal gets its ladder rungs, lamp hoods and base cabinet
 *   - the stair gets tread nosings and dark cheek walls
 *   - masts get access doors and base bolts
 *   - life: sparrows by the bins on dry days, drips off both roof
 *     ends when it rains, the SOS beacon breathes at night
 * ================================================================== */

/**
 * The shelter. A rebuilt SKM shelter is a steel portal frame with a glazed back
 * and one glazed end, a shallow single-pitch roof, and a perforated steel bench
 * bolted to the back wall. It is 2.40 m to the underside of the roof, which is
 * 91 px, so the roof sits at y = 59 and the frame runs off nothing — it fits,
 * and it is the only structure on the platform that does.
 */
const SH = { l: Z.shelterL, r: Z.shelterR, roof: 56, head: 59, foot: RAIL_Y + 12 } as const;
const SHELTER_FRAME = pxPath([
  /* the four posts */
  [SH.l, SH.head, 5, SH.foot - SH.head],
  [SH.l + 104, SH.head, 4, SH.foot - SH.head],
  [SH.r - 108, SH.head, 4, SH.foot - SH.head],
  [SH.r - 5, SH.head, 5, SH.foot - SH.head],
  /* the head beam */
  [SH.l, SH.head, SH.r - SH.l, 4],
]);
/** The roof, oversailing the frame at both ends the way they always do. */
const SHELTER_ROOF = pxPath([
  [SH.l - 14, SH.roof, SH.r - SH.l + 28, 4],
  [SH.l - 14, SH.roof + 4, SH.r - SH.l + 28, 2],
]);
/** What lands on a roof and stays: grime in the drainage line, droppings. */
const SHELTER_ROOF_DIRT = pxPath([[SH.l - 14, SH.roof, SH.r - SH.l + 28, 6]]);
const ROOF_DROPPINGS = pxPath([
  [SH.l + 24, SH.roof, 2, 1],
  [SH.l + 90, SH.roof, 3, 1],
  [SH.r - 60, SH.roof, 2, 1],
]);
/** The glazed back, in four bays. */
const SHELTER_GLASS = pxPath([
  [SH.l + 6, SH.head + 6, 96, 62],
  [SH.l + 110, SH.head + 6, SH.r - SH.l - 224, 62],
  [SH.r - 106, SH.head + 6, 96, 62],
]);
/** The head beam owns the top of every pane: one line of shadow says so. */
const GLASS_TOP_SHADE = pxPath([
  [SH.l + 6, SH.head + 6, 96, 2],
  [SH.l + 110, SH.head + 6, SH.r - SH.l - 224, 2],
  [SH.r - 106, SH.head + 6, 96, 2],
]);
/** And each pane carries one pale band of sky, which is what glass does. */
const GLASS_SKY_BAND = pxPath([
  [SH.l + 8, SH.head + 10, 92, 3],
  [SH.l + 112, SH.head + 10, SH.r - SH.l - 228, 3],
  [SH.r - 104, SH.head + 10, 92, 3],
]);
/** A taped notice on the middle bay — choir concert, lost cat, who knows. */
const GLASS_NOTICE = pxPath([[SH.l + 150, SH.head + 20, 10, 13]]);
const GLASS_NOTICE_TAPE = pxPath([[SH.l + 153, SH.head + 18, 4, 2]]);
/**
 * The perforated bench inside it, at seat height — which is 0.45 m, 17 px,
 * exactly as the key at the top of the file says. It was drawn at 5 px for one
 * release, a thirteen-centimetre bench, and the woman sitting on it had to be
 * floated five pixels off the floor to compensate; both halves of that error
 * are gone now and her feet reach the platform.
 */
const SEAT_Y = RAIL_Y - 17;
const SHELTER_BENCH = pxPath([
  [SH.l + 20, SEAT_Y, SH.r - SH.l - 40, 4],
  /* the legs */
  [SH.l + 34, SEAT_Y + 4, 4, 13],
  [SH.r - 38, SEAT_Y + 4, 4, 13],
  [(SH.l + SH.r) / 2 - 2, SEAT_Y + 4, 4, 13],
]);
const BENCH_PERF = pxPath(
  repeat(Math.floor((SH.r - SH.l - 40) / 9), 9, [SH.l + 24, SEAT_Y + 1, 4, 2] as Rect),
);
/** The seat nose catches the light; three stretches of it are worn shiny,
 * because people sit where people have always sat. */
const BENCH_EDGE_HI = pxPath([[SH.l + 20, SEAT_Y, SH.r - SH.l - 40, 1]]);
const BENCH_SHINE = pxPath([
  [SH.l + 60, SEAT_Y, 18, 1],
  [(SH.l + SH.r) / 2 - 30, SEAT_Y, 22, 1],
  [SH.r - 90, SEAT_Y, 16, 1],
]);
const BENCH_SEAT_SHADOW = pxPath([[SH.l + 20, SEAT_Y + 4, SH.r - SH.l - 40, 2]]);
/** A litter bin under each end of the shelter, which is where they go. */
function binShape(x: number): Rect[] {
  return [
    [x, RAIL_Y - 24, 22, 24],
    [x - 2, RAIL_Y - 27, 26, 3],
    [x + 3, RAIL_Y - 22, 16, 3],
  ];
}
const BINS = pxPath([...binShape(Z.bin), ...binShape(SH.l + 22)]);
const BIN_HOOP = pxPath([
  [Z.bin - 3, RAIL_Y - 27, 28, 2],
  [SH.l + 19, RAIL_Y - 27, 28, 2],
]);
/** The mouth is dark, the shaded flank is darker, and the sticker is a route
 * map nobody has ever consulted. */
const BIN_MOUTHS = pxPath([
  [Z.bin + 3, RAIL_Y - 22, 16, 3],
  [SH.l + 25, RAIL_Y - 22, 16, 3],
]);
const BIN_SIDE_SHADE = pxPath([
  [Z.bin + 18, RAIL_Y - 24, 4, 24],
  [SH.l + 40, RAIL_Y - 24, 4, 24],
]);
const BIN_STICKERS = pxPath([
  [Z.bin + 4, RAIL_Y - 16, 6, 8],
  [SH.l + 26, RAIL_Y - 16, 6, 8],
]);

/**
 * The station name board. Polish practice is a long white board with the name in
 * blue, on two posts, hung at eye level along the platform — and there are two
 * of them, because a train stopping anywhere along the platform has to be able
 * to see one.
 */
/**
 * The name at 1×, not 2×.
 *
 * A Polish platform name board is about 2.4 m long and 0.4 m deep — 91 × 15 px
 * at this key. The first version set the name in the pixel font at double size,
 * which made the board 570 px long and 26 deep: a five-metre-tall sign fourteen
 * metres long, filling a third of the frame and reading as a fence. The letters
 * are 5 px tall now, which is small, and correct, and still perfectly legible
 * because the whole scene is rendered at 4× on screen.
 *
 * Generic: one geometry set per station in the spec table, precomputed once at
 * module scope, keyed by id — the artwork just picks the current station's.
 */
type NameBoardArt = {
  boards: string;
  posts: string;
  strip: string;
  text1: string;
  text2: string;
  /** the boards' centres, for the interaction objects */
  cx1: number;
  cx2: number;
};
function nameBoardArt(name: string): NameBoardArt {
  const w = name.length * 4 + 14;
  const one = (x: number) => ({
    board: [[x, 90, w, 15]] as Rect[],
    posts: [
      [x + 10, 105, 3, 45],
      [x + w - 13, 105, 3, 45],
    ] as Rect[],
    strip: [[x, 90, w, 2]] as Rect[],
  });
  const a = one(Z.nameBoard);
  const b = one(Z.nameBoard2);
  return {
    boards: pxPath([...a.board, ...b.board]),
    posts: pxPath([...a.posts, ...b.posts]),
    strip: pxPath([...a.strip, ...b.strip]),
    text1: textPath(name, Z.nameBoard + 7, 95),
    text2: textPath(name, Z.nameBoard2 + 7, 95),
    cx1: Z.nameBoard + Math.round(w / 2),
    cx2: Z.nameBoard2 + Math.round(w / 2),
  };
}
const NAME_ART: Record<StationId, NameBoardArt> = {
  przymorze: nameBoardArt(STATIONS.przymorze.boardName),
  zaspa: nameBoardArt(STATIONS.zaspa.boardName),
};

/**
 * The departure display. A CIP unit: amber dot matrix in a dark case, hung off
 * the shelter frame on a bracket, angled down the platform. Two lines, which is
 * what these have — the next service and the one after it.
 */
/**
 * A real CIP case is about 0.8 m deep, not the metre-and-a-bit this one spent
 * a release at: h=32 is 84 cm, three text rows still fit, and raising the case
 * to y=50 lifts its underside clear of everyone's heads — the man on the phone
 * used to stand with his ear inside the display.
 */
const CIP = { x: Z.board, y: 50, w: 150, h: 32 } as const;
const CIP_CASE = pxPath([
  [CIP.x, CIP.y, CIP.w, CIP.h],
  /* the bracket back to the shelter post */
  [CIP.x - 32, CIP.y + 12, 32, 4],
]);
const CIP_SCREEN = pxPath([[CIP.x + 3, CIP.y + 3, CIP.w - 6, CIP.h - 6]]);
/** The case in the round: a lit top edge, drain slots under, and the pigeon
 * spikes along the top, which — unusually for pigeon spikes — work. */
const CIP_TOP_HI = pxPath([[CIP.x, CIP.y, CIP.w, 1]]);
const CIP_DRAINS = pxPath(repeat(3, 12, [CIP.x + 10, CIP.y + CIP.h - 2, 4, 1] as Rect));
const CIP_SPIKES = pxPath(repeat(29, 5, [CIP.x + 3, CIP.y - 3, 1, 3] as Rect));
/** One horizontal glare across the glass, because the glass is real. */
const CIP_GLARE = pxPath([[CIP.x + 6, CIP.y + 5, 34, 2]]);

/**
 * The direction sign: an arrow either way with the next stations under it, which
 * is the thing that tells the player where they are in the world and which way
 * the railway goes. Hung under the departure display.
 */
const DIR_SIGN = pxPath([[CIP.x + 8, CIP.y + CIP.h + 4, CIP.w - 16, 13]]);
/** It hangs on two tabs, and hanging things have hardware. */
const DIR_HANGERS = pxPath([
  [CIP.x + 20, CIP.y + CIP.h, 2, 4],
  [CIP.x + CIP.w - 22, CIP.y + CIP.h, 2, 4],
]);

/** The ticket machine — a biletomat, tall, dark, with a lit screen. */
const BILETOMAT = pxPath([
  [Z.biletomat, RAIL_Y - 62, 34, 62],
  [Z.biletomat - 3, RAIL_Y - 66, 40, 5],
]);
const BILETOMAT_SCREEN = pxPath([[Z.biletomat + 5, RAIL_Y - 56, 24, 18]]);
const BILETOMAT_KIT = pxPath([
  /* keypad, card reader, ticket slot, coin return */
  ...repeat(3, 8, [Z.biletomat + 7, RAIL_Y - 34, 5, 5] as Rect),
  ...repeat(3, 8, [Z.biletomat + 7, RAIL_Y - 27, 5, 5] as Rect),
  [Z.biletomat + 24, RAIL_Y - 34, 6, 10],
  [Z.biletomat + 6, RAIL_Y - 18, 22, 3],
]);
/** Its shaded flank, the screen bezel, the kick scuffs, the patch of platform
 * the queue has polished, and this morning's dropped receipt. */
const BILETOMAT_SIDE = pxPath([[Z.biletomat + 30, RAIL_Y - 62, 4, 62]]);
const BILETOMAT_BEZEL = pxPath([
  [Z.biletomat + 4, RAIL_Y - 57, 26, 1],
  [Z.biletomat + 4, RAIL_Y - 57, 1, 20],
]);
const BILETOMAT_KICK = pxPath([[Z.biletomat + 2, RAIL_Y - 6, 30, 6]]);
const QUEUE_WEAR = pxPath([[Z.biletomat - 4, RAIL_Y + 2, 42, 5]]);
const RECEIPT = pxPath([[Z.biletomat + 40, RAIL_Y + 6, 4, 2]]);

/**
 * The poster drum: a cylindrical advertising column, which every Tri-City
 * station has one of. Drawn as a stepped cylinder so the poster wraps.
 */
const DRUM = pxPath([[Z.drum, RAIL_Y - 74, 30, 74]]);
const DRUM_SHADE = pxPath([
  [Z.drum, RAIL_Y - 74, 5, 74],
  [Z.drum + 25, RAIL_Y - 74, 5, 74],
]);
const DRUM_CAP = pxPath([
  [Z.drum - 2, RAIL_Y - 78, 34, 4],
  [Z.drum + 2, RAIL_Y - 2, 26, 2],
]);
/** The cap shades the paper, the paper has a wrap seam, the base has the
 * grime line every street cylinder has, and the poster has a date. */
const DRUM_CAP_SHADOW = pxPath([[Z.drum, RAIL_Y - 74, 30, 2]]);
const DRUM_SEAM = pxPath([[Z.drum + 16, RAIL_Y - 74, 1, 74]]);
const DRUM_BASE_GRIME = pxPath([[Z.drum, RAIL_Y - 10, 30, 10]]);
const DRUM_DATE = pxPath([
  [Z.drum + 8, RAIL_Y - 40, 14, 2],
  [Z.drum + 8, RAIL_Y - 36, 10, 2],
]);

/**
 * The timetable case, glazed, screwed to a post beside the name board — on the
 * Gdańsk side of it, between the stair and the board, where somebody coming up
 * the steps walks straight into it. It used to stand at nameBoard + NAME_W + 40,
 * which put it *inside* the ticket machine: two objects sharing twenty-four
 * pixels of platform, and the man written as "reading the timetable" standing
 * a hundred pixels from either of them, at the poster drum.
 */
const TT_X = Z.nameBoard - 70;
const TT_CASE = pxPath([[TT_X, RAIL_Y - 58, 40, 50]]);
const TT_POST = pxPath([[TT_X + 18, RAIL_Y - 8, 4, 8]]);
const TT_ROWS = pxPath(repeat(11, 4, [TT_X + 4, RAIL_Y - 52, 32, 2] as Rect, "y"));
/** Corner screws, a vertical glare down the glass, and one row printed red —
 * because Saturdays are. */
const TT_SCREWS = pxPath([
  [TT_X + 1, RAIL_Y - 57, 1, 1],
  [TT_X + 38, RAIL_Y - 57, 1, 1],
  [TT_X + 1, RAIL_Y - 10, 1, 1],
  [TT_X + 38, RAIL_Y - 10, 1, 1],
]);
const TT_GLARE = pxPath([[TT_X + 5, RAIL_Y - 50, 10, 34]]);
const TT_RED_ROW = pxPath([[TT_X + 4, RAIL_Y - 32, 32, 2]]);

/**
 * The kasownik — the yellow ticket validator on its own post, an arm's reach
 * from the machine that sold you the ticket, because the fine for an unpunched
 * ticket is the same as for no ticket at all and everybody has learned that
 * exactly once. Head at 1.4 m, which is elbow height, which is the point.
 */
const KAS = { x: 530 } as const;
const KAS_POST = pxPath([[KAS.x + 8, RAIL_Y - 34, 4, 34]]);
const KAS_BOX = pxPath([[KAS.x, RAIL_Y - 54, 20, 22]]);
const KAS_STRIPE = pxPath([[KAS.x, RAIL_Y - 54, 20, 3]]);
const KAS_SLOT = pxPath([[KAS.x + 4, RAIL_Y - 46, 12, 3]]);
const KAS_LED = pxPath([[KAS.x + 15, RAIL_Y - 51, 2, 2]]);
/** Rubbed bare either side of the slot by forty years of tickets and thumbs,
 * and shaded down its off side like everything with a body. */
const KAS_RUB = pxPath([
  [KAS.x + 2, RAIL_Y - 47, 2, 5],
  [KAS.x + 16, RAIL_Y - 47, 2, 5],
]);
const KAS_SIDE = pxPath([[KAS.x + 17, RAIL_Y - 54, 3, 22]]);

/**
 * The platform clock, on its own post by the shelter's Gdańsk end. The hands
 * are two one-pixel rects on SMIL rotations with a negative `begin`, exactly
 * the trick the trains use: the minute hand's hour and the hour hand's twelve
 * hours run off the document clock, so the clock reads the real time when the
 * scene mounts and keeps it without a single React render. A station clock
 * that told the wrong time would be worse than no clock — this one is right.
 */
const CLK = { cx: 643.5, cy: 54.5 } as const;
const CLK_POST = pxPath([[642, 64, 3, RAIL_Y - 64]]);
const CLK_FACE_SET = bevelPaths([[634, 45, 19, 19]]);
const CLK_DIAL = pxPath([[636, 47, 15, 15]]);
const CLK_TICKS = pxPath([
  [643, 48, 1, 1],
  [643, 60, 1, 1],
  [637, 54, 1, 1],
  [649, 54, 1, 1],
]);
const CLK_MIN_HAND = pxPath([[643, 48, 1, 7]]);
const CLK_HOUR_HAND = pxPath([[643, 51, 1, 4]]);
/** The second hand, one red pixel-line on the same trick, because a station
 * clock that visibly runs is worth three that might. */
const CLK_SEC_HAND = pxPath([[643, 47, 1, 8]]);

/**
 * The freestanding bench in the open middle of the platform — the one the
 * landmark table always promised at `midBench` and the platform never had.
 * Same key as the shelter bench: seat 0.45 m, back top 0.85 m. Somebody has
 * left one glove on the armrest end, and it will be there tomorrow too.
 */
const MB = { l: Z.midBench - 34, r: Z.midBench + 34 } as const;
const MID_BENCH = pxPath([
  /* back posts and two back rails */
  [MB.l + 4, RAIL_Y - 32, 3, 32],
  [MB.r - 7, RAIL_Y - 32, 3, 32],
  [MB.l, RAIL_Y - 32, MB.r - MB.l, 3],
  [MB.l, RAIL_Y - 26, MB.r - MB.l, 2],
  /* the seat and its legs */
  [MB.l, SEAT_Y, MB.r - MB.l, 4],
  [MB.l + 6, SEAT_Y + 4, 3, 13],
  [MB.r - 9, SEAT_Y + 4, 3, 13],
]);
const MID_BENCH_PERF = pxPath(
  repeat(Math.floor((MB.r - MB.l - 8) / 9), 9, [MB.l + 4, SEAT_Y + 1, 4, 2] as Rect),
);
const MID_BENCH_GLOVE = pxPath([[MB.r - 12, SEAT_Y - 2, 5, 2]]);
const MID_BENCH_BURN = pxPath([[MB.l + 14, SEAT_Y, 2, 1]]);
/** The back rail's shadow falls across the seat; the seat nose is lit; a
 * band sticker on the top rail is older than half the passengers. */
const MID_BENCH_SEAT_SHADOW = pxPath([[MB.l, SEAT_Y, MB.r - MB.l, 1]]);
const MID_BENCH_NOSE = pxPath([[MB.l, SEAT_Y, MB.r - MB.l, 1]]);
const MID_BENCH_STICKER = pxPath([[MB.l + 10, RAIL_Y - 31, 5, 4]]);

/**
 * The SOS pillar, mid-platform, blue with a green beacon — the newest thing
 * here by a decade and the only object nobody has ever touched, which is what
 * it is for.
 */
const SOS = { x: 1340 } as const;
const SOS_COL = pxPath([[SOS.x, 66, 12, RAIL_Y - 66]]);
const SOS_CAP = pxPath([[SOS.x - 2, 63, 16, 3]]);
const SOS_GRILLE = pxPath(repeat(3, 3, [SOS.x + 2, 74, 8, 1] as Rect, "y"));
const SOS_BTN = pxPath([[SOS.x + 4, 96, 4, 4]]);
const SOS_LAMP: readonly [number, number] = [SOS.x + 6, 68];
const SOS_BULB = bulbPaths([SOS_LAMP]);
/** Its lit arris, the camera above the grille, the instruction placard. */
const SOS_EDGE_HI = pxPath([[SOS.x, 66, 1, RAIL_Y - 66]]);
const SOS_CAM = pxPath([[SOS.x + 9, 70, 2, 2]]);
const SOS_PLACARD = pxPath([[SOS.x + 2, 104, 8, 6]]);

/**
 * The relay cabinet at the far end — signalling equipment in a grey steel box,
 * stencilled, vented, padlocked, standing on its own little plinth clear of
 * the water. Every platform has one and nobody looks at it, which is why it
 * has been tagged and the tag has been half-heartedly wiped.
 */
const CAB = { l: 1714, r: 1756 } as const;
const CAB_BODY_SET = bevelPaths([[CAB.l, RAIL_Y - 44, CAB.r - CAB.l, 44]]);
const CAB_PLINTH = pxPath([[CAB.l - 2, RAIL_Y - 3, CAB.r - CAB.l + 4, 3]]);
const CAB_SEAM = pxPath([[CAB.l + 20, RAIL_Y - 42, 1, 40]]);
const CAB_VENTS = pxPath([
  ...repeat(4, 3, [CAB.l + 4, RAIL_Y - 38, 12, 1] as Rect, "y"),
  ...repeat(4, 3, [CAB.l + 26, RAIL_Y - 38, 12, 1] as Rect, "y"),
]);
const CAB_LOCK = pxPath([[CAB.l + 18, RAIL_Y - 22, 5, 4]]);
const CAB_TAG_GHOST = pxPath([[CAB.l + 24, RAIL_Y - 16, 14, 8]]);
/** Drip line under the roof edge, the padlock's shackle, the cable duct into
 * the plinth, the lightning sticker, and the weeds at both corners. */
const CAB_DRIP = pxPath([[CAB.l - 1, RAIL_Y - 45, CAB.r - CAB.l + 2, 1]]);
const CAB_SHACKLE = pxPath([[CAB.l + 19, RAIL_Y - 24, 3, 2]]);
const CAB_CABLE = pxPath([[CAB.l + 8, RAIL_Y - 4, 4, 4]]);
const CAB_STICKER = pxPath([[CAB.l + 26, RAIL_Y - 36, 5, 6]]);
const CAB_STICKER_BOLT = pxPath([[CAB.l + 28, RAIL_Y - 34, 1, 3]]);
const CAB_WEEDS = pxPath([
  [CAB.l - 4, RAIL_Y - 4, 2, 4],
  [CAB.r + 2, RAIL_Y - 3, 2, 3],
]);

/**
 * The colour light signal at the Gdańsk end of the platform, for the track the
 * trains actually run on. Its aspect runs off the same SMIL clock as the
 * trains themselves: green while a service is coming, red the moment it has
 * passed — which means a player who has learned to read it knows the train is
 * coming before the announcement says so. That is not a gimmick; that is what
 * a signal is.
 */
const SIG = { x: 52 } as const;
const SIG_MAST = pxPath([[SIG.x + 5, 22, 4, 128]]);
const SIG_HEAD = pxPath([[SIG.x - 2, 20, 14, 28]]);
const SIG_LAMP_R: Rect = [SIG.x + 2, 24, 6, 6];
const SIG_LAMP_G: Rect = [SIG.x + 2, 36, 6, 6];
const SIG_PLATE = pxPath([[SIG.x + 2, 118, 10, 12]]);
/** The maintainer's ladder rungs, the hoods over both lamps, and the location
 * cabinet at the mast foot — the three things every signal actually has. */
const SIG_RUNGS = pxPath(repeat(12, 8, [SIG.x + 9, 34, 4, 1] as Rect, "y"));
const SIG_HOODS = pxPath([
  [SIG.x + 1, 23, 8, 1],
  [SIG.x + 1, 35, 8, 1],
]);
const SIG_BASE = pxPath([[SIG.x + 1, 140, 12, 10]]);
/** Aspect timeline: green ahead of each movement, red behind it. */
const SIG_TIMES = [
  0,
  TIMETABLE.expressEnter - 6,
  TIMETABLE.expressEnter + 1,
  TIMETABLE.arriveEnter - 6,
  TIMETABLE.arriveEnter + 1,
  TIMETABLE.departStart,
  TIMETABLE.departStart + 4,
  CYCLE_S,
]
  .map(kt)
  .join(";");
const SIG_GREEN_VALUES = "0;1;0;1;0;1;0;0";
const SIG_RED_VALUES = "1;0;1;0;1;0;1;1";

/**
 * The end-of-platform board past the ramp: red and white, the last thing on
 * the platform and the first thing a driver sees of it.
 */
const END_BOARD = pxPath([[1942, 100, 18, 18]]);
const END_BOARD_STRIPES = pxPath([
  [1942, 100, 6, 6],
  [1948, 106, 6, 6],
  [1954, 112, 6, 6],
]);
const END_POST = pxPath([[1949, 118, 3, 32]]);

/**
 * The drum's peeled corner — the flavor text has claimed for two releases that
 * "somebody has peeled a corner of it back to the poster underneath", and now
 * it is true: a stepped triangle of the old blue showing through the red, with
 * the curl of the peeled paper catching the light along its edge.
 */
const DRUM_PEEL_UNDER = pxPath([
  [Z.drum + 22, RAIL_Y - 74, 8, 4],
  [Z.drum + 25, RAIL_Y - 70, 5, 4],
  [Z.drum + 27, RAIL_Y - 66, 3, 3],
]);
const DRUM_PEEL_CURL = pxPath([
  [Z.drum + 21, RAIL_Y - 74, 2, 4],
  [Z.drum + 24, RAIL_Y - 70, 2, 4],
  [Z.drum + 26, RAIL_Y - 66, 2, 3],
]);

/**
 * The stair down to the underpass at the Gdańsk end, which is how the player
 * arrives and leaves. Drawn as a balustrade and a dark opening in the platform,
 * because the steps themselves go below the frame.
 */
/**
 * The opening, and the flight going down into it.
 *
 * Read as a hole rather than as a grating lying on the platform, which is what
 * the first version looked like: the treads recede *and* narrow as they descend,
 * so the flight reads in perspective, and the near lip of the opening is drawn
 * as a bright coping edge with the dark of the underpass immediately behind it.
 * That contrast — bright edge, black hole — is the whole trick.
 */
const STAIR_OPENING = pxPath([[Z.stairs - 38, RAIL_Y + 8, 76, 22]]);
const STAIR_LIP = pxPath([
  [Z.stairs - 40, RAIL_Y + 6, 80, 2],
  [Z.stairs - 40, RAIL_Y + 6, 2, 24],
  [Z.stairs + 38, RAIL_Y + 6, 2, 24],
]);
/** Five treads, each shorter and lower than the last. */
const STAIR_TREADS = pxPath(
  Array.from({ length: 5 }, (_, i) => {
    const inset = 4 + i * 5;
    return [Z.stairs - 38 + inset, RAIL_Y + 10 + i * 4, 76 - inset * 2, 2] as Rect;
  }),
);
/** The flight's dark cheek walls — the line that finishes the illusion of going down. */
const STAIR_CHEEKS = pxPath([
  [Z.stairs - 38, RAIL_Y + 8, 3, 22],
  [Z.stairs + 35, RAIL_Y + 8, 3, 22],
]);

/* ---- the fine grain of the stair ------------------------------------------
 * A flight into an underpass is five materials meeting: the coping the
 * platform slab ends in, the terrazzo treads with their brass nosings worn to
 * a line, the risers nobody ever cleans, the white glazed tile the PKP put on
 * every underpass wall in the country, and the dark. Each tread is built as a
 * face, a nosing, a riser and the pale path worn down its middle, and the
 * flight is lit from below by the underpass tubes, which is the one light in
 * this scene that comes UP. */
const STAIR_STEP = (i: number) => {
  const inset = 4 + i * 5;
  return { x: Z.stairs - 38 + inset, y: RAIL_Y + 10 + i * 4, w: 76 - inset * 2 };
};
/** The riser under each tread: two pixels of shadow, deeper each step down. */
const STAIR_RISERS = pxPath(
  Array.from({ length: 5 }, (_, i) => {
    const t = STAIR_STEP(i);
    return [t.x, t.y + 2, t.w, 2] as Rect;
  }),
);
/** The pale path worn down the middle of every tread, narrowing with depth. */
const STAIR_WEAR = pxPath(
  Array.from({ length: 5 }, (_, i) => {
    const t = STAIR_STEP(i);
    const w = Math.max(10, Math.round(t.w * 0.55) - i * 2);
    return [Z.stairs - Math.round(w / 2) + 3, t.y, w, 1] as Rect;
  }),
);
/** Brass nosings, worn to a bright line, chipped where the trolleys go. */
const STAIR_BRASS = pxPath(
  Array.from({ length: 5 }, (_, i) => {
    const t = STAIR_STEP(i);
    return [t.x + 2, t.y, t.w - 4, 1] as Rect;
  }),
);
const STAIR_BRASS_CHIPS = pxPath([
  [Z.stairs - 20, RAIL_Y + 10, 3, 1],
  [Z.stairs + 8, RAIL_Y + 14, 2, 1],
  [Z.stairs - 6, RAIL_Y + 22, 4, 1],
]);
/** The anti-slip strip on the top tread: yellow once, grey where feet land. */
const STAIR_TACTILE = pxPath([[Z.stairs - 30, RAIL_Y + 8, 60, 2]]);
const STAIR_TACTILE_WORN = pxPath([[Z.stairs - 14, RAIL_Y + 8, 28, 2]]);
/** The cheek walls are white glazed tile in 150 mm courses, grout dark. */
const STAIR_TILE_COURSES = pxPath([
  ...repeat(7, 3, [Z.stairs - 38, RAIL_Y + 9, 3, 1] as Rect, "y"),
  ...repeat(7, 3, [Z.stairs + 35, RAIL_Y + 9, 3, 1] as Rect, "y"),
]);
const STAIR_TILE_GRIME = pxPath([
  [Z.stairs - 38, RAIL_Y + 22, 3, 8],
  [Z.stairs + 35, RAIL_Y + 20, 3, 10],
]);
/** Grit kicked down the treads, and the wet the bottom two never lose. */
const STAIR_GRIT = pxPath([
  [Z.stairs - 24, RAIL_Y + 11, 1, 1],
  [Z.stairs + 12, RAIL_Y + 11, 2, 1],
  [Z.stairs - 8, RAIL_Y + 15, 1, 1],
  [Z.stairs + 18, RAIL_Y + 15, 1, 1],
  [Z.stairs - 2, RAIL_Y + 19, 2, 1],
  [Z.stairs + 6, RAIL_Y + 23, 1, 1],
]);
const STAIR_WET = pxPath([
  [Z.stairs - 12, RAIL_Y + 22, 24, 2],
  [Z.stairs - 8, RAIL_Y + 26, 16, 2],
]);
/** The drain slot at the foot, so the wet has somewhere to go and does not. */
const STAIR_DRAIN = pxPath([[Z.stairs - 6, RAIL_Y + 28, 12, 2]]);
const STAIR_DRAIN_SLOTS = pxPath(repeat(4, 3, [Z.stairs - 5, RAIL_Y + 28, 1, 2] as Rect));
/** The coping the platform ends in: a bevelled edge, not a line. */
const STAIR_COPING = bevelPaths([
  [Z.stairs - 42, RAIL_Y + 4, 84, 4],
  [Z.stairs - 42, RAIL_Y + 8, 4, 22],
  [Z.stairs + 38, RAIL_Y + 8, 4, 22],
]);
const STAIR_COPING_CHIPS = pxPath([
  [Z.stairs - 30, RAIL_Y + 4, 4, 1],
  [Z.stairs + 16, RAIL_Y + 5, 3, 2],
]);
/** The underpass tubes, throwing their light up the flight. */
const STAIR_UPLIGHT = tiers(
  (k) =>
    steppedQuad(
      RAIL_Y + 10,
      Z.stairs - Math.round(14 * k),
      Z.stairs + Math.round(14 * k),
      RAIL_Y + 30,
      Z.stairs - Math.round(34 * k),
      Z.stairs + Math.round(34 * k),
      4,
    ),
  "w",
  0.9,
);
/** The rail's brackets, and the shadow the rail throws down the cheek. */
const STAIR_RAIL_BRACKETS = pxPath([
  [Z.stairs - 44, RAIL_Y - 12, 3, 2],
  [Z.stairs + 41, RAIL_Y - 12, 3, 2],
  [Z.stairs - 44, RAIL_Y + 2, 3, 2],
  [Z.stairs + 41, RAIL_Y + 2, 3, 2],
]);
const STAIR_RAIL_SHADOW = pxPath([
  [Z.stairs - 41, RAIL_Y - 30, 1, 38],
  [Z.stairs + 44, RAIL_Y - 30, 1, 38],
]);
/** The balustrade: two standards, a top rail and a knee rail, sloping down. */
const STAIR_RAIL = pxPath([
  [Z.stairs - 44, RAIL_Y - 32, 3, 40],
  [Z.stairs + 41, RAIL_Y - 32, 3, 40],
  [Z.stairs - 44, RAIL_Y - 32, 88, 2],
  [Z.stairs - 44, RAIL_Y - 22, 88, 2],
  /* the rail turning down the flight */
  [Z.stairs - 44, RAIL_Y - 32, 2, 40],
]);
/** The sign over the stair: the underpass symbol and the exit arrow. */
const STAIR_SIGN = pxPath([[Z.stairs - 24, RAIL_Y - 50, 48, 12]]);
const STAIR_SIGN_HANGERS = pxPath([
  [Z.stairs - 14, RAIL_Y - 52, 2, 2],
  [Z.stairs + 12, RAIL_Y - 52, 2, 2],
]);

/** Mast luminaires: cold white LED, sharing the catenary masts' positions so
 * each bay reads as one upright rather than a forest of near-identical poles. */
function luminaire(x: number): Rect[] {
  return [
    [x, 0, 5, RAIL_Y - 4],
    [x - 12, 8, 30, 4],
    [x - 14, 12, 34, 3],
    [x - 3, RAIL_Y - 6, 11, 6],
  ];
}
const LUMINAIRES = pxPath(MASTS.flatMap((x) => luminaire(x)));
const LUM_LENS = pxPath(MASTS.map((x) => [x - 12, 12, 30, 2] as Rect));
/** Each mast has an access door at waist height and two base bolts, because
 * a pole with no door is a drawing of a pole. */
const MAST_DOORS = pxPath(MASTS.map((x) => [x + 1, RAIL_Y - 34, 3, 10] as Rect));
const MAST_BOLTS = pxPath(
  MASTS.flatMap(
    (x) =>
      [
        [x - 4, RAIL_Y - 2, 2, 2],
        [x + 7, RAIL_Y - 2, 2, 2],
      ] as Rect[],
  ),
);

/** The pool of light each one throws on the platform, when they are on. */
const LAMP_POOLS = MASTS.map((x) =>
  tiers(
    (k) => [
      [x - Math.round(150 * k), RAIL_Y + 2, Math.round(300 * k), 8],
      [x - Math.round(120 * k), RAIL_Y + 10, Math.round(240 * k), 10],
      [x - Math.round(90 * k), RAIL_Y + 20, Math.round(180 * k), 10],
    ],
    "c",
    1.5,
  ),
);
/** The point sources themselves: a hard core and a dithered star each. */
const LUM_BULBS = bulbPaths(MASTS.map((x) => [x + 3, 13] as const));

/**
 * Moths at the two mid-platform luminaires on a warm night — two pixels each,
 * wandering a lazy loop under the lens. Cold white LED collects fewer moths
 * than sodium ever did, so there are two and not a cloud, and they stay home
 * when it rains.
 */
const MOTH_HOMES = [563, 973] as const;

/** Sparrows work the bin end of the shelter on dry days, in the same discrete
 * hops as every small bird that has ever owned a platform. */
const SPARROWS: readonly [number, number][] = [
  [Z.bin - 22, RAIL_Y - 3],
  [Z.bin + 30, RAIL_Y - 2],
];

/* ---- v4 additional furniture ------------------------------------------- *
 * The rest of what a rebuilt SKM platform actually owns. Positions: the
 * wayfinding totem and the bike rack live off the stair, because that is
 * where feet arrive; the vending machine keeps the biletomat company; the
 * CCTV pole, the leaning rail and the grit box fill the long emptiness
 * between the SOS pillar and the relay cabinet. Anything that argues with
 * a prop from another layer can shift along its own x. */

/** The line-map totem by the stair: the first thing an arriving foot needs —
 * the line, its stations, and the red block that says YOU ARE HERE. */
const TOTEM_X = Z.stairs + 60;
const TOTEM_BODY = pxPath([[TOTEM_X, RAIL_Y - 60, 16, 60]]);
const TOTEM_HEAD = pxPath([[TOTEM_X - 2, RAIL_Y - 64, 20, 5]]);
const TOTEM_SIDE = pxPath([[TOTEM_X + 13, RAIL_Y - 60, 3, 60]]);
const TOTEM_MAP = pxPath([[TOTEM_X + 3, RAIL_Y - 54, 10, 34]]);
const TOTEM_LINE = pxPath([[TOTEM_X + 7, RAIL_Y - 51, 2, 28]]);
const TOTEM_STOPS = pxPath(repeat(6, 5, [TOTEM_X + 6, RAIL_Y - 50, 4, 2] as Rect, "y"));
const TOTEM_YOU = pxPath([[TOTEM_X + 5, RAIL_Y - 35, 6, 3]]);

/** Two hoops of bike rack past the totem: one bike locked properly, and one
 * hoop holding only a front wheel, which is a complete short story. */
/* at the very start of the platform, before the stair — you ride in, you
 * lock up, you go down; 250 put both hoops inside the timetable case */
const BIKE_X = 40;
/**
 * The rack and the bike on it come from propKit now — the same Sheffield
 * stands and the same bicycle every scene gets, instead of the third private
 * copy of a six-pixel wheel. The lone wheel somebody left chained to the
 * second stand is this platform's own detail and stays.
 */
const STATION_RACK = bikeRack(BIKE_X, RAIL_Y, 2, 30);
const STATION_BIKE = bicycle(BIKE_X + 4, RAIL_Y, 1);
function wheelRects(x: number, y: number): Rect[] {
  return [
    [x + 1, y, 4, 1],
    [x, y + 1, 6, 4],
    [x + 1, y + 5, 4, 1],
  ];
}
const LONE_WHEEL = pxPath([
  ...wheelRects(BIKE_X + 74, RAIL_Y - 7),
  [BIKE_X + 76, RAIL_Y - 9, 2, 2],
]);

/** The vending machine keeping the biletomat company — coffee and cans, the
 * second-brightest thing on the platform after dark. */
/* between the kasownik and the poster drum — 406 stood exactly where the
 * pigeon lady works, and a machine wearing a babcia is not furniture */
const VEND_X = 548;
const VEND_BODY = pxPath([[VEND_X, RAIL_Y - 58, 30, 58]]);
const VEND_SIDE = pxPath([[VEND_X + 26, RAIL_Y - 58, 4, 58]]);
const VEND_WINDOW = pxPath([[VEND_X + 4, RAIL_Y - 52, 16, 32]]);
const VEND_ROWS = pxPath(repeat(4, 8, [VEND_X + 6, RAIL_Y - 49, 12, 4] as Rect, "y"));
const VEND_PAY = pxPath([
  [VEND_X + 23, RAIL_Y - 48, 4, 8],
  [VEND_X + 23, RAIL_Y - 36, 4, 3],
]);
const VEND_HATCH = pxPath([[VEND_X + 4, RAIL_Y - 14, 20, 6]]);
const VEND_POOL = tiers(
  (k) => [
    [VEND_X + 15 - Math.round(26 * k), RAIL_Y + 2, Math.round(52 * k), 6],
    [VEND_X + 15 - Math.round(18 * k), RAIL_Y + 8, Math.round(36 * k), 6],
  ],
  "c",
  0.6,
);

/** The concrete planter mid-platform: municipal, immortal, mostly weeds. */
/* in the open run between the mid bench and the bin — 1058 planted it on
 * the phone man's toes under the departure display */
const PLANTER_X = 1230;
const PLANTER_BOX = pxPath([[PLANTER_X, RAIL_Y - 14, 30, 14]]);
const PLANTER_LIP = pxPath([[PLANTER_X - 2, RAIL_Y - 16, 34, 3]]);
const PLANTER_SIDE = pxPath([[PLANTER_X + 26, RAIL_Y - 14, 4, 14]]);
const PLANTER_SOIL = pxPath([[PLANTER_X + 3, RAIL_Y - 13, 24, 3]]);
const PLANTER_GREEN = pxPath([
  [PLANTER_X + 5, RAIL_Y - 18, 3, 5],
  [PLANTER_X + 11, RAIL_Y - 20, 2, 7],
  [PLANTER_X + 16, RAIL_Y - 17, 3, 4],
  [PLANTER_X + 22, RAIL_Y - 19, 2, 6],
]);
const PLANTER_BLOOMS = pxPath([
  [PLANTER_X + 11, RAIL_Y - 21, 2, 1],
  [PLANTER_X + 22, RAIL_Y - 20, 2, 1],
]);

/** The CCTV pole between the SOS pillar and nothing much: two cameras aimed
 * both ways down the platform, and the red dot that admits it. */
const CCTV_X = 1418;
const CCTV_POLE = pxPath([[CCTV_X + 4, 58, 3, RAIL_Y - 58]]);
const CCTV_ARM = pxPath([[CCTV_X - 5, 58, 21, 2]]);
const CCTV_CAMS = pxPath([
  [CCTV_X - 9, 60, 7, 4],
  [CCTV_X + 13, 60, 7, 4],
]);
const CCTV_LENSES = pxPath([
  [CCTV_X - 9, 61, 1, 2],
  [CCTV_X + 19, 61, 1, 2],
]);
const CCTV_LED: Rect = [CCTV_X + 5, 62, 1, 1];

/** The leaning rail — the bench for people who refuse benches. */
const LEAN = { l: 1578, r: 1638 } as const;
const LEAN_RAIL = pxPath([
  [LEAN.l, RAIL_Y - 26, LEAN.r - LEAN.l, 4],
  [LEAN.l + 6, RAIL_Y - 22, 3, 22],
  [LEAN.r - 9, RAIL_Y - 22, 3, 22],
]);
const LEAN_HI = pxPath([[LEAN.l, RAIL_Y - 26, LEAN.r - LEAN.l, 1]]);
const LEAN_SHINE = pxPath([[LEAN.l + 18, RAIL_Y - 26, 24, 1]]);

/** The grit box by the relay cabinet: safety orange, stencilled PIASEK,
 * hasped, and never once opened by anyone unofficial. */
/* clear of the man at the end (1690) — he watches the line, not the grit */
const GRIT_X = 1644;
const GRIT_BOX = pxPath([[GRIT_X, RAIL_Y - 18, 34, 18]]);
const GRIT_LID = pxPath([[GRIT_X - 2, RAIL_Y - 22, 38, 5]]);
const GRIT_LID_HI = pxPath([[GRIT_X - 2, RAIL_Y - 22, 38, 1]]);
const GRIT_SIDE = pxPath([[GRIT_X + 30, RAIL_Y - 18, 4, 18]]);
const GRIT_HASP = pxPath([[GRIT_X + 15, RAIL_Y - 17, 4, 5]]);

/** PA horns on the third mast, one aimed each way, sun-faded grey. */
const PA_X = MASTS[2] ?? MASTS[0];
const PA_HORNS = pxPath([
  [PA_X - 9, 26, 7, 5],
  [PA_X + 7, 26, 7, 5],
  [PA_X - 2, 27, 9, 3],
]);
const PA_MOUTHS = pxPath([
  [PA_X - 9, 27, 2, 3],
  [PA_X + 12, 27, 2, 3],
]);

/** Deeper volume on things that already stood here: the drum's cylinder
 * sheen, the stair's darkness gradient, the caps and flanks and undersides
 * that make a box read as a body. */
const DRUM_SPEC = pxPath([[Z.drum + 10, RAIL_Y - 74, 4, 74]]);
const STAIR_DEPTH = pxPath([[Z.stairs - 38, RAIL_Y + 18, 76, 12]]);
const BILETOMAT_CAP_SHADOW = pxPath([[Z.biletomat, RAIL_Y - 61, 34, 2]]);
const CIP_UNDER = pxPath([[CIP.x, CIP.y + CIP.h - 1, CIP.w, 1]]);
const SOS_SIDE = pxPath([[SOS.x + 10, 66, 2, RAIL_Y - 66]]);
const ROOF_SEAMS = pxPath([
  [SH.l + 40, SH.roof, 1, 4],
  [SH.l + 150, SH.roof, 1, 4],
  [SH.r - 60, SH.roof, 1, 4],
]);

/**
 * What the small screens spill after dark. The biletomat throws a cold blue
 * apron the size of one person; the departure display leaks amber onto the
 * platform under the shelter's end. Neither is lighting — both are just
 * screens being screens, and together with the mast LEDs and the sodium
 * behind the fence they make the four temperatures of a Polish platform.
 */
const BILETOMAT_POOL = tiers(
  (k) => [
    [Z.biletomat + 17 - Math.round(32 * k), RAIL_Y + 2, Math.round(64 * k), 7],
    [Z.biletomat + 17 - Math.round(22 * k), RAIL_Y + 9, Math.round(44 * k), 7],
  ],
  "c",
  0.7,
);
const CIP_CX = CIP.x + Math.round(CIP.w / 2);
const CIP_POOL = tiers(
  (k) => [
    [CIP_CX - Math.round(46 * k), RAIL_Y + 2, Math.round(92 * k), 7],
    [CIP_CX - Math.round(30 * k), RAIL_Y + 9, Math.round(60 * k), 7],
  ],
  "w",
  0.5,
);

/** The strip light under the shelter roof, and its pool on the dry patch. */
const SHELTER_STRIP = pxPath([[SH.l + 10, SH.head + 4, SH.r - SH.l - 20, 2]]);
const SHELTER_POOL = tiers(
  (k) => [
    [820 - Math.round(150 * k), RAIL_Y + 2, Math.round(300 * k), 9],
    [820 - Math.round(110 * k), RAIL_Y + 11, Math.round(220 * k), 10],
  ],
  "c",
  0.8,
);

/**
 * The dawn shaft. The cutting runs north–south, so first light comes across it
 * rather than along it: one raking quad falling onto the open middle of the
 * platform, gone by mid-morning, and only on a clear day. It is the one warm
 * thing at that hour.
 */
const DAWN_SHAFT = tiers(
  (k) =>
    steppedQuad(
      0,
      1280 - Math.round(90 * k),
      1280 + Math.round(90 * k),
      RAIL_Y + 26,
      1080 - Math.round(150 * k),
      1080 + Math.round(150 * k),
      10,
    ),
  "e",
  0.8,
);

/**
 * Wet night: every luminaire gets a second, upside-down existence in the
 * platform surface — a vertical smear under each mast, brighter where the
 * water stands in the wear line. The cheapest reflection there is, and the
 * most recognisable.
 */
const WET_GLARE_WIDE = pxPath(MASTS.map((x) => [x - 4, RAIL_Y + 3, 13, 24] as Rect));
const WET_GLARE_CORE = pxPath(MASTS.map((x) => [x - 1, RAIL_Y + 3, 7, 18] as Rect));

/* ---- v2 surface history ------------------------------------------------ *
 * The platform's own biography, one path per fact. */

/** The cable-duct lids along the back of the walk — every PKP platform's
 * spine: a line of concrete lids with pull-holes, some replaced and paler. */
const DUCT_LIDS = pxPath(repeat(Math.floor(W / 46), 46, [8, 166, 42, 4] as Rect));
const DUCT_JOINTS = pxPath(repeat(Math.floor(W / 46), 46, [50, 166, 2, 4] as Rect));
const DUCT_HOLES = pxPath(repeat(Math.floor(W / 46), 46, [26, 167, 3, 2] as Rect));
const DUCT_NEW = pxPath([
  [8 + 9 * 46, 166, 42, 4],
  [8 + 27 * 46, 166, 42, 4],
]);
/** Brake dust: the first lane darkens where the units stop, wheel by wheel. */
const BRAKE_DUST = pxPath([[STOP_X + 120, RAIL_Y + 1, 1560, 3]]);
/** The ghost of the bench that stood mid-platform before the shelter came. */
const BENCH_GHOST = pxPath([[1114, 156, 30, 3]]);
const BENCH_GHOST_BOLTS = pxPath([
  [1116, 158, 2, 2],
  [1140, 158, 2, 2],
]);
/** Oil off the gearboxes, on the ballast where the unit always stands. */
const STOP_OIL = pxPath(
  DOOR_X.flatMap((cx) => [
    [cx - 30, 136, 8, 3],
    [cx + 14, 139, 6, 2],
  ]),
);

/** Contact under the band props, at their own feet lines. */
const PROP_CONTACT = contactPaths([
  [1498, 44, 160],
  [858, 18, 163],
]);

/** Contact shadows: everything that stands on the platform gets one. */
const FURNITURE_CONTACT = contactPaths([
  [Z.biletomat - 2, 40, RAIL_Y],
  [Z.drum - 2, 34, RAIL_Y],
  [Z.bin - 2, 26, RAIL_Y],
  [SH.l + 20, 26, RAIL_Y],
  [SH.l, 8, RAIL_Y],
  [SH.r - 6, 8, RAIL_Y],
  [KAS.x + 6, 10, RAIL_Y],
  [640, 8, RAIL_Y],
  [MB.l + 2, MB.r - MB.l - 4, RAIL_Y],
  [SOS.x - 2, 16, RAIL_Y],
  [CAB.l - 3, CAB.r - CAB.l + 6, RAIL_Y],
  [SIG.x + 3, 10, RAIL_Y],
  [1946, 10, RAIL_Y],
  [TT_X + 14, 12, RAIL_Y],
  /* v4 furniture stands on the same platform */
  [TOTEM_X + 1, 14, RAIL_Y],
  [BIKE_X - 1, 49, RAIL_Y],
  [VEND_X - 2, 34, RAIL_Y],
  [PLANTER_X - 2, 34, RAIL_Y],
  [CCTV_X + 3, 6, RAIL_Y],
  [LEAN.l + 4, LEAN.r - LEAN.l - 8, RAIL_Y],
  [GRIT_X - 2, 38, RAIL_Y],
]);
/** Ambient occlusion where the shelter roof shades the platform behind it. */
const SHELTER_AO = aoPaths([[SH.l - 10, SH.head + 4, SH.r - SH.l + 20]]);

function Furniture({
  ph,
  s,
  lit,
  offsetS,
}: {
  ph: Ph;
  s: StationState;
  lit: boolean;
  offsetS: number;
}) {
  const night = ph === "night";
  const galv = GALV[ph];
  const conc = CONC[ph];
  const boardLit = s.board;
  const wet = s.weather === "rain" || s.weather === "wet";
  const begin = `${(-offsetS).toFixed(2)}s`;
  const spec = STATIONS[s.at];
  const nameArt = NAME_ART[s.at];
  /**
   * Where the clock's hands are right now, read once at mount — the same
   * negative-begin trick as the trains, on a 60 s, 3600 s and 43200 s cycle.
   */
  const clockBegin = useMemo(() => {
    const d = new Date();
    const intoMinute = d.getSeconds();
    const intoHour = d.getMinutes() * 60 + intoMinute;
    const intoHalfDay = (d.getHours() % 12) * 3600 + intoHour;
    return {
      second: `${-intoMinute}s`,
      minute: `${-intoHour}s`,
      hour: `${-intoHalfDay}s`,
    };
  }, []);
  return (
    <g>
      {/* the light poles go behind everything on the platform */}
      <path d={LUMINAIRES} fill={galv.base} />
      <path d={MAST_DOORS} fill={galv.deep} opacity={0.6} />
      <path d={MAST_BOLTS} fill={galv.deep} opacity={0.7} />
      <path d={LUM_LENS} fill={lit ? "#f6f8ff" : galv.hi} />
      {/* the PA horns on the third mast — silent in the art, loud in life */}
      <path d={PA_HORNS} fill={galv.mid} />
      <path d={PA_MOUTHS} fill="#101216" opacity={0.8} />
      {lit ? MASTS.map((x, i) => <Light key={`pool-${x}`} set={LAMP_POOLS[i]} op={0.9} />) : null}
      {lit ? (
        <g>
          <path d={LUM_BULBS.halo} fill="#e4eaec" opacity={0.2} />
          <path d={LUM_BULBS.core} fill="#f6f8ff" opacity={0.85} />
        </g>
      ) : null}
      {/* moths under the two mid-platform lenses, dry nights only */}
      {lit && night && !wet
        ? MOTH_HOMES.map((x, i) => (
            <path key={`moth-${x}`} d={pxPath([[x, 18, 2, 2]])} fill="#d8d4c8" opacity={0.7}>
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;5 -3;-3 4;7 2;-5 -2;2 5;0 0"
                dur={`${4.6 + i * 1.7}s`}
                repeatCount="indefinite"
              />
            </path>
          ))
        : null}

      {/* the colour light signal at the Gdańsk end, on the timetable's clock */}
      <path d={SIG_MAST} fill={GALV[ph].lo} />
      <path d={SIG_RUNGS} fill={GALV[ph].base} opacity={0.8} />
      <path d={SIG_BASE} fill={GALV[ph].lo} />
      <path d={SIG_HEAD} fill="#23262b" />
      <path d={SIG_HOODS} fill="#101216" />
      <path d={SIG_PLATE} fill={K.white} opacity={0.85} />
      <g transform={`translate(${SIG.x + 3} 120)`}>
        <path d={textPath("S1", 0, 0)} fill={K.signBlue} />
      </g>
      <path d={pxPath([SIG_LAMP_R])} fill="#3a2225" />
      <path d={pxPath([SIG_LAMP_G])} fill="#1e2b22" />
      <path d={pxPath([SIG_LAMP_R])} fill={K.red}>
        <animate
          attributeName="opacity"
          keyTimes={SIG_TIMES}
          values={SIG_RED_VALUES}
          dur={`${CYCLE_S}s`}
          begin={begin}
          calcMode="discrete"
          repeatCount="indefinite"
        />
      </path>
      <path d={pxPath([SIG_LAMP_G])} fill={K.ledGreen}>
        <animate
          attributeName="opacity"
          keyTimes={SIG_TIMES}
          values={SIG_GREEN_VALUES}
          dur={`${CYCLE_S}s`}
          begin={begin}
          calcMode="discrete"
          repeatCount="indefinite"
        />
      </path>

      {/* the stair down to the underpass: the dark first, then the light that
          comes up out of it, then the flight built tread by tread */}
      <path d={STAIR_OPENING} fill="#12141a" />
      <path d={STAIR_DEPTH} fill="#06070b" opacity={0.7} />
      <Light set={STAIR_UPLIGHT} op={night ? 1 : 0.55} />
      {/* the cheeks: white glazed tile, grouted, grimed toward the bottom */}
      <path d={STAIR_CHEEKS} fill={night ? "#8a8f8a" : "#c9cdc6"} opacity={0.9} />
      <path d={STAIR_TILE_COURSES} fill="#3a3d3a" opacity={0.6} />
      <path d={STAIR_TILE_GRIME} fill={dth("n", "25")} opacity={0.8} />
      {/* the treads: face, riser, brass nosing, the worn path, grit, wet */}
      <path d={STAIR_TREADS} fill={conc.base} />
      <path d={STAIR_RISERS} fill="#000" opacity={0.45} />
      <path d={STAIR_WEAR} fill={conc.hi} opacity={0.45} />
      <path d={STAIR_BRASS} fill={night ? "#a08a4a" : "#d9bc62"} opacity={0.9} />
      <path d={STAIR_BRASS_CHIPS} fill={conc.deep} />
      <path d={STAIR_TACTILE} fill={night ? K.safetyWorn : K.safety} opacity={0.8} />
      <path d={STAIR_TACTILE_WORN} fill={conc.mid} opacity={0.7} />
      <path d={STAIR_GRIT} fill={conc.deep} opacity={0.8} />
      <path d={STAIR_WET} fill="#2a3038" opacity={0.5} />
      <path d={STAIR_DRAIN} fill={galv.deep} />
      <path d={STAIR_DRAIN_SLOTS} fill="#000" opacity={0.6} />
      {/* the coping the slab ends in, and the rail on it */}
      <Bev set={STAIR_COPING} mat={CONC[ph]} />
      <path d={STAIR_COPING_CHIPS} fill={conc.deep} opacity={0.7} />
      <path d={STAIR_LIP} fill={conc.hi} opacity={0.5} />
      <path d={STAIR_RAIL_SHADOW} fill="#000" opacity={0.25} />
      <path d={STAIR_RAIL} fill={galv.base} />
      <path d={STAIR_RAIL} transform="translate(0,-1)" fill={galv.hi} opacity={0.45} />
      <path d={STAIR_RAIL_BRACKETS} fill={galv.deep} />
      <path d={STAIR_SIGN_HANGERS} fill={galv.base} />
      <path d={STAIR_SIGN} fill={spec.exit ? K.signBlue : "#8a2424"} />
      <g transform={`translate(${Z.stairs - 18} ${RAIL_Y - 46})`}>
        <path
          d={textPath(spec.exit ? "WYJSCIE" : "ZAMKNIETE", 0, 0)}
          fill={K.white}
          opacity={0.9}
        />
      </g>
      {spec.exit ? null : (
        <>
          {/* shut for renovation: mesh barriers across the mouth, tape over
           * the rail, and the notice nobody reads because everybody knows */}
          <path
            d={pxPath([
              ...repeat(9, 9, [Z.stairs - 40, RAIL_Y - 24, 2, 24] as Rect),
              [Z.stairs - 42, RAIL_Y - 24, 84, 2],
              [Z.stairs - 42, RAIL_Y - 12, 84, 2],
            ])}
            fill={galv.base}
          />
          <path
            d={pxPath(repeat(7, 12, [Z.stairs - 40, RAIL_Y - 19, 7, 3] as Rect))}
            fill={K.safety}
            opacity={0.8}
          />
          <path d={pxPath([[Z.stairs - 26, RAIL_Y - 40, 52, 14]])} fill={K.white} opacity={0.9} />
          <g transform={`translate(${Z.stairs - 22} ${RAIL_Y - 36})`}>
            <path d={textPath("REMONT", 0, 0)} fill="#8a2424" />
          </g>
        </>
      )}

      {/* the wayfinding totem: the line, its stations, YOU ARE HERE */}
      <path d={TOTEM_BODY} fill={night ? "#2b2e32" : "#3a3d42"} />
      <path d={TOTEM_SIDE} fill="#000" opacity={0.25} />
      <path d={TOTEM_HEAD} fill={K.signBlue} />
      <path d={TOTEM_MAP} fill={night ? "#c9c4b6" : K.white} />
      <path d={TOTEM_LINE} fill={K.signBlue} />
      <path d={TOTEM_STOPS} fill={K.signBlue} opacity={0.7} />
      <path d={TOTEM_YOU} fill={K.red} />
      {/* the bike rack: one bike locked properly, one hoop holding only a
          front wheel — the rest of that bike is somebody's bad morning */}
      <BikeRack set={STATION_RACK} ph={ph} />
      <Bicycle set={STATION_BIKE} ph={ph} colour="#7a2f3a" />
      <path d={LONE_WHEEL} fill="#23262b" opacity={0.9} />

      {/* the shelter */}
      <AOSet set={SHELTER_AO} op={0.5} />
      <path d={SHELTER_GLASS} fill={K.glass[ph]} opacity={night ? 0.5 : 0.42} />
      <path d={SHELTER_GLASS} fill={dth("c", "12")} opacity={0.3} />
      <path d={GLASS_TOP_SHADE} fill="#000" opacity={0.25} />
      <path d={GLASS_SKY_BAND} fill={K.glass[ph]} opacity={0.5} />
      {/* one pane has been scratched and one patch scrubbed — glass remembers */}
      <path d={pxPath([[SH.l + 128, SH.head + 14, 22, 12]])} fill={K.glass[ph]} opacity={0.35} />
      <path
        d={pxPath([
          [SH.r - 80, SH.head + 10, 1, 22],
          [SH.r - 78, SH.head + 16, 1, 14],
        ])}
        fill={galv.hi}
        opacity={0.35}
      />
      {/* the taped notice, and the tape outliving whatever it advertised */}
      <path d={GLASS_NOTICE} fill={night ? "#c9c4b6" : K.white} opacity={0.9} />
      <path
        d={pxPath([
          [SH.l + 152, SH.head + 23, 6, 1],
          [SH.l + 152, SH.head + 26, 5, 1],
          [SH.l + 152, SH.head + 29, 6, 1],
        ])}
        fill={K.signBlue}
        opacity={0.6}
      />
      <path d={GLASS_NOTICE_TAPE} fill={K.white} opacity={0.5} />
      <path d={SHELTER_FRAME} fill={galv.base} />
      <path d={SHELTER_ROOF} fill={galv.mid} />
      <path d={SHELTER_ROOF_DIRT} fill={dth("n", "12")} opacity={0.3} />
      <path d={ROOF_DROPPINGS} fill={K.white} opacity={0.45} />
      <path d={pxPath([[SH.l - 14, SH.roof, SH.r - SH.l + 28, 1]])} fill={galv.hi} />
      <path d={ROOF_SEAMS} fill={galv.lo} opacity={0.6} />
      {/* the strip light under the roof, and what it lands on */}
      <path d={SHELTER_STRIP} fill={lit ? "#f6f8ff" : galv.hi} opacity={lit ? 0.9 : 0.5} />
      {lit ? <Light set={SHELTER_POOL} op={0.9} /> : null}
      <path d={SHELTER_BENCH} fill={galv.lo} />
      <path d={BENCH_SEAT_SHADOW} fill="#000" opacity={0.2} />
      <path d={BENCH_PERF} fill="#2b2e32" opacity={0.6} />
      <path d={BENCH_EDGE_HI} fill={galv.hi} opacity={0.35} />
      <path d={BENCH_SHINE} fill={galv.hi} opacity={0.55} />
      {/* rain runs off both roof ends, one drip each, splash where it lands */}
      {wet ? (
        <>
          {[SH.l - 13, SH.r + 10].map((x, i) => (
            <path
              key={`drip-${x}`}
              d={pxPath([[x, SH.roof + 6, 1, 3]])}
              fill="#c8d4e0"
              opacity={0.7}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;0 84"
                dur={`${0.9 + i * 0.25}s`}
                repeatCount="indefinite"
              />
            </path>
          ))}
          <path
            d={pxPath([
              [SH.l - 14, RAIL_Y + 1, 3, 1],
              [SH.r + 9, RAIL_Y + 1, 3, 1],
            ])}
            fill="#c8d4e0"
            opacity={0.35}
          />
        </>
      ) : null}

      {/* bins */}
      <path d={BINS} fill={galv.mid} />
      <path d={BINS} fill={dth("c", "12")} opacity={0.2} />
      <path d={BIN_SIDE_SHADE} fill="#000" opacity={0.2} />
      <path d={BIN_MOUTHS} fill="#101215" opacity={0.8} />
      <path d={BIN_HOOP} fill={galv.hi} />
      <path d={BIN_STICKERS} fill={K.white} opacity={0.55} />
      {s.litter >= 2 ? (
        <path
          d={pxPath([
            [Z.bin + 2, RAIL_Y - 30, 6, 4],
            [Z.bin + 14, RAIL_Y - 29, 5, 3],
            [Z.bin - 6, RAIL_Y - 3, 5, 3],
          ])}
          fill={K.cream}
          opacity={0.8}
        />
      ) : null}
      {/* sparrows work the bin end on dry days — discrete hops, like the
          pigeon on the track, only smaller and busier */}
      {!night && !wet
        ? SPARROWS.map(([x, y], i) => (
            <path
              key={`spr-${x}`}
              d={pxPath([
                [x, y, 2, 2],
                [x + 2, y - 1, 1, 1],
              ])}
              fill="#4a4038"
              opacity={0.9}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                calcMode="discrete"
                values={
                  i === 0 ? "0 0;4 0;4 0;9 1;9 1;3 0;3 0;0 0" : "0 0;-5 0;-5 0;-9 1;-9 1;-2 0;0 0"
                }
                keyTimes={
                  i === 0 ? "0;0.1;0.3;0.38;0.6;0.68;0.92;1" : "0;0.12;0.4;0.5;0.72;0.8;0.95;1"
                }
                dur={`${6.5 + i * 2.3}s`}
                repeatCount="indefinite"
              />
            </path>
          ))
        : null}

      {/* the name boards — whichever station this platform is being today */}
      <path d={nameArt.posts} transform="translate(1,2)" fill="#000" opacity={0.15} />
      <path d={nameArt.posts} fill={galv.base} />
      <path d={nameArt.boards} transform="translate(1,2)" fill="#000" opacity={0.15} />
      <path d={nameArt.boards} fill={night ? "#c9c4b6" : K.white} />
      <path d={nameArt.strip} fill={K.signBlue} />
      <path d={nameArt.text1} fill={K.signBlue} />
      <path d={nameArt.text2} fill={K.signBlue} />

      {/* the departure display and the direction sign under it. The text is
       * live and lives in Effects, where it can tick; the art owns the case,
       * the dark of the screen, the cursor, and the amber it spills at night. */}
      <path d={CIP_CASE} fill="#23262b" />
      <path d={CIP_TOP_HI} fill="#3a3e44" />
      <path d={CIP_SPIKES} fill={galv.base} opacity={0.8} />
      <path d={CIP_DRAINS} fill="#101216" opacity={0.8} />
      <path d={CIP_UNDER} fill="#000" opacity={0.35} />
      <path d={CIP_SCREEN} fill={boardLit ? "#0d0f12" : "#1a1d22"} />
      <path d={CIP_GLARE} fill="#3a4048" opacity={0.4} />
      {boardLit ? (
        <g>
          {/* the cursor block that every one of these displays has */}
          <path d={pxPath([[CIP.x + CIP.w - 12, CIP.y + 7, 3, 5]])} fill={K.led}>
            <animate
              attributeName="opacity"
              values="1;1;0;0"
              dur="1.6s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </path>
          {night ? <Light set={CIP_POOL} op={0.9} /> : null}
        </g>
      ) : null}
      <path d={DIR_HANGERS} fill={galv.lo} />
      <path d={DIR_SIGN} fill={K.signBlue} />
      <g transform={`translate(${CIP.x + 12} ${CIP.y + CIP.h + 8})`}>
        {/* the neighbours, which is what a direction sign is actually for */}
        <path
          d={textPath(`< ${spec.prev}  ·  ${spec.next} >`, 0, 0)}
          fill={K.white}
          opacity={0.9}
        />
      </g>

      {/* the vending machine, keeping the biletomat company */}
      <path d={VEND_BODY} fill={night ? "#242e38" : "#31404e"} />
      <path d={VEND_SIDE} fill="#000" opacity={0.25} />
      <path d={VEND_WINDOW} fill={night ? "#16324e" : "#1e2a36"} />
      <path d={VEND_ROWS} fill="#c8503a" opacity={0.8} />
      <path d={VEND_WINDOW} fill={dth("c", "12")} opacity={0.3} />
      <path d={VEND_PAY} fill={galv.lo} />
      <path d={VEND_HATCH} fill="#101216" opacity={0.8} />
      {night ? <Light set={VEND_POOL} op={0.8} /> : null}

      {/* the biletomat */}
      <path d={BILETOMAT} fill={night ? "#2b2e32" : "#3a3d42"} />
      <path d={BILETOMAT_CAP_SHADOW} fill="#000" opacity={0.25} />
      <path d={BILETOMAT_SIDE} fill="#000" opacity={0.25} />
      <path d={BILETOMAT_KICK} fill="#000" opacity={0.2} />
      <path d={BILETOMAT_SCREEN} fill="#0f2a4a" />
      <path d={BILETOMAT_SCREEN} fill={dth("c", "12")} opacity={0.35} />
      <path d={BILETOMAT_BEZEL} fill="#000" opacity={0.4} />
      <g transform={`translate(${Z.biletomat + 7} ${RAIL_Y - 52})`}>
        <path d={textPath("BILET", 0, 0)} fill={K.skmYellow} />
      </g>
      <path d={BILETOMAT_KIT} fill={galv.lo} />
      <path d={pxPath([[Z.biletomat + 24, RAIL_Y - 34, 6, 3]])} fill={K.ledGreen} />
      {/* where the queue stands, and what the queue drops */}
      <path d={QUEUE_WEAR} fill={dth("n", "12")} opacity={0.35} />
      <path d={RECEIPT} fill={K.white} opacity={0.75} />
      {night ? <Light set={BILETOMAT_POOL} op={0.9} /> : null}

      {/* the kasownik, an arm's reach from the machine */}
      <path d={KAS_POST} fill={galv.base} />
      <path d={KAS_BOX} fill={night ? K.safetyWorn : K.safety} />
      <path d={KAS_SIDE} fill="#000" opacity={0.18} />
      <path d={KAS_STRIPE} fill={K.signBlue} />
      <path d={KAS_SLOT} fill="#23262b" />
      <path d={KAS_RUB} fill={night ? "#8a8578" : "#c9c4a8"} opacity={0.6} />
      <path d={KAS_LED} fill={K.ledGreen} opacity={0.9} />

      {/* the poster drum */}
      <path d={DRUM} fill={s.season === "autumn" ? "#8a3a44" : "#3a5f8a"} />
      <path d={DRUM} fill={dth("c", "12")} opacity={0.2} />
      <path d={DRUM_SHADE} fill="#000" opacity={0.18} />
      <path d={DRUM_SPEC} fill="#fff" opacity={0.08} />
      <path d={DRUM_CAP_SHADOW} fill="#000" opacity={0.3} />
      <path d={DRUM_SEAM} fill="#000" opacity={0.2} />
      <path d={DRUM_BASE_GRIME} fill={dth("n", "12")} opacity={0.35} />
      <path d={DRUM_CAP} fill={galv.mid} />
      <g transform={`translate(${Z.drum + 6} ${RAIL_Y - 66})`}>
        <path d={textPath("TEATR", 0, 0)} fill={K.cream} opacity={0.85} />
      </g>
      <g transform={`translate(${Z.drum + 6} ${RAIL_Y - 58})`}>
        <path d={textPath("MUZYKI", 0, 0)} fill={K.cream} opacity={0.7} />
      </g>
      <path d={DRUM_DATE} fill={K.cream} opacity={0.5} />
      {/* the peeled corner, and the older blue poster underneath it */}
      <path d={DRUM_PEEL_UNDER} fill={s.season === "autumn" ? "#3a5f8a" : "#8a3a44"} />
      <path d={DRUM_PEEL_CURL} fill={K.cream} opacity={0.8} />

      {/* the timetable case */}
      <path d={TT_CASE} transform="translate(1,2)" fill="#000" opacity={0.15} />
      <path d={TT_POST} fill={galv.base} />
      <path d={TT_CASE} fill={galv.deep} />
      <path d={pxPath([[TT_X + 2, RAIL_Y - 56, 36, 46]])} fill={night ? "#d8d4c8" : K.white} />
      <path d={TT_ROWS} fill={K.signBlue} opacity={0.5} />
      {/* the Saturday column, printed red like it always is */}
      <path d={TT_RED_ROW} fill={K.red} opacity={0.55} />
      {/* sun-bleach: the top rows have been in the light longest */}
      <path d={pxPath([[TT_X + 2, RAIL_Y - 56, 36, 12]])} fill={K.white} opacity={0.35} />
      <path d={TT_GLARE} fill={K.white} opacity={0.14} />
      <path d={TT_SCREWS} fill={galv.hi} opacity={0.8} />

      {/* the clock, keeping the real time on the document clock */}
      <path d={CLK_POST} fill={galv.base} />
      <Bev set={CLK_FACE_SET} mat={GALV[ph]} />
      <path d={CLK_DIAL} fill={night ? "#d8d4c8" : K.white} />
      <path d={CLK_TICKS} fill={K.signBlue} opacity={0.7} />
      <path d={CLK_MIN_HAND} fill="#23262b">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${CLK.cx} ${CLK.cy}`}
          to={`360 ${CLK.cx} ${CLK.cy}`}
          dur="3600s"
          begin={clockBegin.minute}
          repeatCount="indefinite"
        />
      </path>
      <path d={CLK_HOUR_HAND} fill="#23262b">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${CLK.cx} ${CLK.cy}`}
          to={`360 ${CLK.cx} ${CLK.cy}`}
          dur="43200s"
          begin={clockBegin.hour}
          repeatCount="indefinite"
        />
      </path>
      {/* the second hand: PKP red, sixty seconds, visibly alive */}
      <path d={CLK_SEC_HAND} fill={K.red} opacity={0.9}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${CLK.cx} ${CLK.cy}`}
          to={`360 ${CLK.cx} ${CLK.cy}`}
          dur="60s"
          begin={clockBegin.second}
          repeatCount="indefinite"
        />
      </path>
      <path d={pxPath([[643, 54, 1, 1]])} fill="#23262b" />

      {/* the mid-platform bench, its glove, and its one cigarette burn */}
      <path d={MID_BENCH} fill={galv.lo} />
      <path d={MID_BENCH_SEAT_SHADOW} fill="#000" opacity={0.25} />
      <path d={MID_BENCH_PERF} fill="#2b2e32" opacity={0.6} />
      <path d={MID_BENCH_NOSE} fill={galv.hi} opacity={0.3} />
      <path d={MID_BENCH_STICKER} fill={K.white} opacity={0.5} />
      <path d={MID_BENCH_BURN} fill="#2b2622" opacity={0.7} />
      <path d={MID_BENCH_GLOVE} fill="#8a3a44" opacity={0.9} />

      {/* the municipal planter: concrete forever, flowers optional */}
      <path d={PLANTER_BOX} fill={conc.mid} />
      <path d={PLANTER_SIDE} fill="#000" opacity={0.2} />
      <path d={PLANTER_BOX} fill={dth("n", "12")} opacity={0.3} />
      <path d={PLANTER_LIP} fill={conc.hi} />
      <path d={PLANTER_SOIL} fill="#2e2418" />
      <path
        d={PLANTER_GREEN}
        fill={s.season === "bare" ? "#6b5f4a" : LEAF[ph].mid}
        opacity={night ? 0.6 : 0.95}
      />
      {s.season === "green" ? <path d={PLANTER_BLOOMS} fill={K.red} opacity={0.85} /> : null}

      {/* the SOS pillar: blue, grille, button, and a beacon that never sleeps */}
      <path d={SOS_COL} fill={K.signBlue} />
      <path d={SOS_EDGE_HI} fill="#4d7ec4" opacity={0.6} />
      <path d={SOS_SIDE} fill="#000" opacity={0.22} />
      <path d={SOS_CAP} fill={galv.mid} />
      <path d={SOS_CAM} fill="#0a0c10" />
      <path d={SOS_GRILLE} fill="#0a2548" />
      <g transform={`translate(${SOS.x + 2} 84)`}>
        <path d={textPath("SOS", 0, 0)} fill={K.white} opacity={0.9} />
      </g>
      <path d={SOS_BTN} fill={K.white} opacity={0.85} />
      <path d={SOS_PLACARD} fill={K.white} opacity={0.6} />
      <path
        d={pxPath([
          [SOS_LAMP[0] - 1, SOS_LAMP[1], 3, 1],
          [SOS_LAMP[0], SOS_LAMP[1] - 1, 1, 3],
        ])}
        fill={K.ledGreen}
      />
      {night ? (
        <path d={SOS_BULB.halo} fill={K.ledGreen} opacity={0.2}>
          <animate
            attributeName="opacity"
            values="0.14;0.3;0.14"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}

      {/* the CCTV pole: two cameras, both ways, and the honest red dot */}
      <path d={CCTV_POLE} fill={galv.base} />
      <path d={CCTV_ARM} fill={galv.base} />
      <path d={CCTV_CAMS} fill="#23262b" />
      <path d={CCTV_LENSES} fill="#0a0c10" />
      {night ? (
        <path d={pxPath([CCTV_LED])} fill={K.ledRed}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;1;0;1"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* the leaning rail, polished in the middle by everyone in a hurry */}
      <path d={LEAN_RAIL} fill={galv.lo} />
      <path d={LEAN_HI} fill={galv.hi} opacity={0.35} />
      <path d={LEAN_SHINE} fill={galv.hi} opacity={0.6} />
      {/* the grit box: orange, stencilled, hasped, never once opened */}
      <path d={GRIT_BOX} fill={night ? "#8a4a1e" : "#c8702a"} />
      <path d={GRIT_SIDE} fill="#000" opacity={0.25} />
      <path d={GRIT_BOX} fill={dth("n", "12")} opacity={0.25} />
      <path d={GRIT_LID} fill={night ? "#9a561e" : "#d8813a"} />
      <path d={GRIT_LID_HI} fill="#f2a45c" opacity={0.6} />
      <path d={GRIT_HASP} fill={galv.lo} />
      <g transform={`translate(${GRIT_X + 6} ${RAIL_Y - 13})`}>
        <path d={textPath("PIASEK", 0, 0)} fill="#3a2a1a" opacity={0.8} />
      </g>

      {/* the relay cabinet at the far end, tagged and half-wiped */}
      <path d={CAB_PLINTH} fill={conc.deep} />
      <Bev set={CAB_BODY_SET} mat={GALV[ph]} />
      <path d={CAB_DRIP} fill={galv.hi} opacity={0.5} />
      <path d={CAB_SEAM} fill={galv.deep} opacity={0.7} />
      <path d={CAB_VENTS} fill={galv.deep} opacity={0.8} />
      <path d={CAB_SHACKLE} fill={galv.deep} />
      <path d={CAB_LOCK} fill="#3a3d42" />
      <path d={CAB_STICKER} fill={K.safety} opacity={0.8} />
      <path d={CAB_STICKER_BOLT} fill="#23262b" opacity={0.9} />
      <path d={CAB_CABLE} fill="#101216" opacity={0.7} />
      <path d={CAB_TAG_GHOST} fill={galv.hi} opacity={0.3} />
      <path d={CAB_WEEDS} fill={LEAF[ph].mid} opacity={night ? 0.5 : 0.8} />
      <g transform={`translate(${CAB.l + 4} ${RAIL_Y - 12})`}>
        <path d={textPath("SRK 04", 0, 0)} fill={K.white} opacity={0.55} />
      </g>

      {/* the end-of-platform board past the ramp */}
      <path d={END_BOARD} transform="translate(1,2)" fill="#000" opacity={0.15} />
      <path d={END_POST} fill={galv.base} />
      <path d={END_BOARD} fill={K.white} />
      <path d={END_BOARD_STRIPES} fill={K.red} />

      <Contact set={FURNITURE_CONTACT} op={night ? 0.35 : 0.7} />
      <Contact set={PROP_CONTACT} op={night ? 0.4 : 0.7} />

      {/* first light, raking across the open middle on a clear dawn */}
      {ph === "dawn" && s.weather === "clear" ? <Light set={DAWN_SHAFT} op={0.9} /> : null}

      {/* wet dark: the luminaires get their reflections */}
      {wet && lit ? (
        <g>
          <path d={WET_GLARE_WIDE} fill="#f6f8ff" opacity={0.07} />
          <path d={WET_GLARE_CORE} fill="#f6f8ff" opacity={0.12} />
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 5 — the trains (parallax 1.0)
 * ================================================================== */

/**
 * Both trains, animated entirely in SMIL.
 *
 * This is the part of the scene that had to be got right architecturally rather
 * than artistically. A train has to move smoothly, it has to be *behind* the
 * player because the player is standing on the platform in front of it, and the
 * scene's artwork is memoised on an art key so that walking about does not
 * re-render two thousand rects. Those three facts rule out driving it from React
 * state: anything that re-renders the train every frame re-renders the scene
 * every frame.
 *
 * So the timetable is baked into the SMIL timeline. One position track per train
 * carries the whole cycle — waiting off-stage, entering, braking to a stand,
 * waiting again, accelerating away — as a list of key times taken straight from
 * `stationTimetable`. Deceleration and acceleration are done with unevenly
 * spaced key frames rather than an easing function, because SMIL's
 * `calcMode="spline"` needs a control point per interval and four hand-placed
 * stops read better than any curve at this scale.
 *
 * `begin` is negative — the number of seconds we are already into the cycle when
 * the scene mounts — which drops the animation into the right frame instead of
 * starting the timetable over every time the player walks onto the platform.
 * That is also what keeps it in step with `boardingOpen()`, which the door
 * objects use and which is computed from the same clock.
 *
 * The track is no longer applied by a group *around* the train: it is handed to
 * the unit as a `MotionPlan` and the unit applies it itself. That is what lets
 * a train know how fast it is going — the wheels turn at the speed the body is
 * moving, the shell bobs over the joints while it rolls and stops bobbing when
 * it stops, the glass smears, the bogies haze under braking and put sand down
 * on the pull-away. One list of numbers, and everything physical about the
 * movement comes off it instead of being hand-timed twice.
 */

const T = TIMETABLE;

/**
 * The non-stop express: enters from Gdańsk, crosses, gone.
 *
 * It is the three-car set, 2270 px long, so it has to start further back than
 * the boardable two-car unit or its trailing cab is on screen while it is
 * supposed to be off-stage — and it covers the extra ground in the same 7.5 s,
 * which is exactly the point of an express.
 */
const EXPRESS = {
  keyTimes: [0, T.expressEnter, T.expressLeave, CYCLE_S].map(kt).join(";"),
  values: "-2400 0;-2400 0;2140 0;2140 0",
};

/**
 * The boardable service. Six stops in the position track:
 * off-stage, then four decelerating steps into the platform, the stand, then
 * three accelerating steps out.
 */
const ARRIVAL = {
  keyTimes: [
    0,
    T.arriveEnter,
    T.arriveEnter + 2,
    T.arriveEnter + 4,
    T.arriveEnter + 6,
    T.arriveStop,
    T.departStart,
    T.departStart + 2.5,
    T.departStart + 5,
    T.departEnd,
    CYCLE_S,
  ]
    .map(kt)
    .join(";"),
  /* the distances shorten into the stop and lengthen out of it */
  values: [
    -1820,
    -1820,
    -860,
    -260,
    STOP_X - 160,
    STOP_X,
    STOP_X,
    STOP_X + 160,
    STOP_X + 640,
    2140,
    2140,
  ]
    .map((x) => `${x} 0`)
    .join(";"),
};

/** The doors: shut, part, hold, close, shut. */
const DOORS = {
  keyTimes: [0, T.doorsOpen, T.doorsOpen + 1.2, T.doorsClose, T.doorsClose + 1.2, CYCLE_S]
    .map(kt)
    .join(";"),
  values: "0;0;24.5;24.5;0;0",
};

/**
 * Both position tracks, resolved into motion plans once at module scope.
 *
 * `planMotion` walks the key frames and precomputes everything derived from
 * them — direction, peak speed, the wheel angle at each frame, the bob, and the
 * speed gates for smear, wake, brake haze and sand. It is a few hundred
 * multiplications and it happens once for the life of the tab, which is the
 * whole reason the trains can be this alive without React seeing a frame of it.
 */
const EXPRESS_PLAN = planMotion(EXPRESS.keyTimes, EXPRESS.values, `${CYCLE_S}s`);
const ARRIVAL_PLAN = planMotion(ARRIVAL.keyTimes, ARRIVAL.values, `${CYCLE_S}s`);

function Trains({ ph, offsetS }: { ph: Ph; offsetS: number }) {
  const begin = `${(-offsetS).toFixed(2)}s`;
  return (
    <g>
      {/* The express, which does not stop here. Three cars, because the ones
          that run through are the full set — and because a longer train going
          past faster is the cheapest way to say that this is a real railway
          with somewhere else to be. */}
      <SkmUnit
        ph={ph}
        destination="SOPOT"
        via="GDYNIA"
        cars={3}
        lit
        crowding="quiet"
        motion={{ ...EXPRESS_PLAN, begin }}
      />

      {/* the one you can get on */}
      <SkmUnit
        ph={ph}
        destination="GDYNIA GL."
        lit
        crowding="normal"
        motion={{ ...ARRIVAL_PLAN, begin }}
        doors={{
          mode: "cycle",
          keyTimes: DOORS.keyTimes,
          values: DOORS.values,
          dur: `${CYCLE_S}s`,
          begin,
        }}
      />
    </g>
  );
}

/* ================================================================== *
 * the scene
 * ================================================================== */

function StationScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = stationState(world);
  const lit = lampsOn(s, ph);
  /**
   * Where we are in the timetable at the moment the artwork mounts. Read once:
   * re-reading it on a re-render would rewrite `begin` and restart every
   * animation, which is exactly the stutter this design exists to avoid.
   */
  const offsetS = useMemo(() => {
    armStation();
    return stationCycleOffsetS();
  }, []);

  return (
    <LayeredScene
      parallax={{ farBackground: 0.15, middleBackground: 0.85 }}
      farBackground={<Backdrop ph={ph} s={s} />}
      middleBackground={<FarSide ph={ph} s={s} lit={lit} />}
      ground={
        <>
          <Catenary ph={ph} />
          <TrackAndPlatform ph={ph} s={s} />
          {/* The trains draw here, between the track they run on and the
           * furniture that stands on the platform in front of them — masts,
           * track, train, shelter, player is the real back-to-front order,
           * and it means a berthed train shows *through* the shelter's glass
           * instead of swallowing the shelter whole. */}
          <Trains ph={ph} offsetS={offsetS} />
        </>
      }
      staticObjects={<Furniture ph={ph} s={s} lit={lit} offsetS={offsetS} />}
    />
  );
}

/**
 * The foreground: the near road, and the train that uses it.
 *
 * Przymorze-Uniwersytet has two tracks and the player is standing between them
 * — the up road behind the platform edge, and the down road in front of the
 * camera. A train on the near road passes *between the player and the viewer*,
 * right to left, toward Gdańsk.
 *
 * It is the biggest thing that happens in the scene and it costs almost
 * nothing. Because it is closer to the camera than anything else, it is drawn
 * larger than the berthed train — 1.28×, which at this key makes it a body four
 * and a half metres deep — and it is cropped hard by the top and bottom of the
 * frame, so what actually goes past is a wall of windows with the ground blurred
 * under it. It is over in four seconds.
 *
 * The timing lives in the timetable with everything else, early in the cycle, so
 * a player who has just come up the steps sees a train before they see anything
 * else — and so it never overlaps the service that berths at 46 s.
 */
const FRONT_EDGE = pxPath([
  [0, 178, W, 2],
  [0, 176, W, 1],
]);
const VIGNETTE = vignettePaths(W, 180);

/** How much bigger the near train is than the far one, being closer. */
const NEAR_SCALE = 1.28;
/**
 * Where the near train sits vertically. Its own rail head is below the frame —
 * the near road is lower than the platform we are standing on — so the body is
 * pushed down and the bogies never show.
 */
const NEAR_DROP = 42;

/**
 * The near train's path, in the train's OWN space rather than the scene's.
 *
 * The unit applies its own translate now, and it does so inside the 1.28×
 * group, so the numbers here are scene pixels divided by NEAR_SCALE: it comes
 * in from 2400 px right of the frame and leaves 2100 px left of it, which is
 * 1875 and −1640 in its own units. Getting this wrong is silent — the train
 * still crosses, it just starts and finishes on screen.
 */
const NEAR_TRAIN = {
  keyTimes: [0, T.nearEnter, T.nearLeave, CYCLE_S].map(kt).join(";"),
  /* right to left: in from beyond the Sopot end, out past the Gdańsk end */
  values: "1876 0;1876 0;-1642 0;-1642 0",
};
const NEAR_PLAN = planMotion(NEAR_TRAIN.keyTimes, NEAR_TRAIN.values, `${CYCLE_S}s`);

/**
 * What a train passing a metre and a half away does to everything behind it.
 *
 * It is between the player and the camera, so for four seconds it is the only
 * thing lighting the frame — which is to say it is the only thing *not*
 * lighting the frame. Two slabs travelling with it, a core the width of the
 * unit and a wider penumbra, drop the platform and the player into its shadow
 * and let them back out. It is one rect each and it is the single largest thing
 * the scene does with light.
 *
 * It rides the scene-space track, not the unit's, because it has to be square
 * to the frame rather than scaled with the body.
 */
const NEAR_LEN = Math.round(1700 * NEAR_SCALE);
const NEAR_SHADE_CORE = pxPath([[-40, 40, NEAR_LEN + 80, 140]]);
const NEAR_SHADE_SOFT = pxPath([[-140, 24, NEAR_LEN + 280, 156]]);
const NEAR_SHADE = {
  keyTimes: NEAR_TRAIN.keyTimes,
  values: "2400 0;2400 0;-2100 0;-2100 0",
};

function StationFront({ phase }: { phase: string }) {
  const ph = toPhase(phase);
  /* read once — see the note on Trains */
  const begin = useMemo(() => {
    armStation();
    return `${(-stationCycleOffsetS()).toFixed(2)}s`;
  }, []);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <path d={FRONT_EDGE} fill={CONC[ph].deep} opacity={0.7} />

      {/* its shadow arrives before it does and leaves after it */}
      <g>
        <path d={NEAR_SHADE_SOFT} fill="#171009" opacity={ph === "night" ? 0.14 : 0.1} />
        <path d={NEAR_SHADE_CORE} fill="#171009" opacity={ph === "night" ? 0.22 : 0.18} />
        <animateTransform
          attributeName="transform"
          type="translate"
          keyTimes={NEAR_SHADE.keyTimes}
          values={NEAR_SHADE.values}
          dur={`${CYCLE_S}s`}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </g>

      {/* The down train, on the near road, in front of everything.
       *
       * `dir={-1}` because it is running to the left, which now means the
       * left-hand cab leads it: the unit is double-ended, so the thing at the
       * front of a westbound train is a windscreen with a driver behind it and
       * headlights under it, and the thing at the back is a pair of red
       * markers. It used to be the same drawing shoved backwards.
       *
       * `ground` and `gear` are off because both are outside the crop — its own
       * rail head is 60 px below the bottom of the frame, so a contact shadow
       * and a set of bogies would be work done for nobody. */}
      <g transform={`translate(0 ${NEAR_DROP}) scale(${NEAR_SCALE})`}>
        <SkmUnit
          ph={ph}
          destination="GDANSK GL."
          dir={-1}
          lit
          crowding="busy"
          ground={false}
          gear={false}
          motion={{ ...NEAR_PLAN, begin }}
        />
      </g>

      <Vignette set={VIGNETTE} strength={ph === "night" ? 1.15 : 0.7} />
    </svg>
  );
}

/* ================================================================== *
 * the people waiting
 * ================================================================== */

/**
 * Everybody on the platform, and what they are doing.
 *
 * §4 of the brief is explicit that they must not all be doing the same thing at
 * the same time, which is the failure mode of a scene that places five copies of
 * one rig and lets them share a clock. Three things prevent it here:
 *
 *  – each one has a different action, chosen for the spot they are standing in.
 *    The man at the edge is looking down the line because that is what you do at
 *    the end of a platform; the woman under the display is on her phone because
 *    that is what you do while you wait; the one at the case is reading a
 *    timetable he has read already.
 *  – `NpcActor` seeds each rig's animation phase from its id, so two people
 *    playing the same idle are never on the same frame.
 *  – the pacer is a real actor stepped by the game loop, walking the length of
 *    the platform, so there is always one thing moving.
 *
 * They also react to the timetable. When the train is in, the ones who are
 * boarding turn toward the doors and walk — which is `actors` with a patrol,
 * not something animated here.
 */
/**
 * Every act in this table exists on the rig it is given to — which was not
 * always so: "lookDown" and "read" were never built, so the man at the edge
 * and the man at the case both silently fell back to plain idle and the two of
 * them stood there doing nothing in exactly the same way. Now the waiting man
 * folds his arms and checks his watch (`lean`, from his waiting rig), the
 * caller actually holds a call (`call`, from his phoning rig), the student
 * scans the timetable he has read already (`lookAround`), the smoker smokes,
 * and the pigeon lady doles out kasza (`count`, which at her station in front
 * of the flock reads as feeding, because context is most of acting).
 *
 * Each figure also has its own depth in the walking band — the looker right on
 * the edge line, the caller a step back, the pigeon lady out in front — so the
 * platform reads as a surface people are standing *on*, not a line they are
 * strung along.
 */
const WAITING = [
  /* the registry key is `waiting`; "waiting-man" is the rig's *id*, and using
   * it here meant NPCS["waiting-man"] was undefined and the man at the end was
   * a hitbox with nobody in it — the exact silent fallback this table exists
   * to prevent */
  { id: "looker", npc: "waiting", x: 1690, y: 153, facing: -1, act: "lean" },
  /* a step clear of the display, which he used to stand inside */
  { id: "phone", npc: "caller", x: 1054, y: 158, facing: 1, act: "call" },
  { id: "reader", npc: "student", x: 305, y: 155, facing: -1, act: "lookAround" },
  /* feet on the platform now that the bench is a real 0.45 m */
  { id: "bench", npc: "babcia", x: 830, y: RAIL_Y, facing: 1, act: "sit" },
  { id: "smoker", npc: "smoker", x: 1610, y: 154, facing: -1, act: "smoke" },
  { id: "golebiarka", npc: "golebiarka", x: 404, y: 161, facing: -1, act: "count" },
] as const;

function StationPeople({ world, ph }: { world: WorldState; ph: Ph }) {
  const s = stationState(world);
  const who = whoIsWaiting(s, ph);
  const shown = WAITING.filter((p) => who[p.id]);
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
    >
      {shown.map((p) => {
        const npc = NPCS[p.npc as keyof typeof NPCS];
        if (!npc) return null;
        return (
          <NpcActor
            key={p.id}
            npc={npc}
            objId={p.id === "bench" ? "station-bench-sitter" : `station-${p.id}`}
            x={p.x}
            y={p.y}
            facing={p.facing}
            shadow={p.id !== "bench"}
            action={npc.actions?.[p.act] ? p.act : undefined}
          />
        );
      })}
    </svg>
  );
}

/**
 * The platform flock: three pigeons working the paving in front of the pigeon
 * lady's spot. Their opacity runs off the timetable — gone for the near train,
 * gone for the stopping service, back a few seconds after each — with the same
 * negative `begin` as everything else on the clock.
 */
const GROUND_PIGEONS = [
  { x: 358, face: 1 as const, jitter: 0 },
  { x: 374, face: -1 as const, jitter: 0.7 },
  { x: 389, face: 1 as const, jitter: 1.3 },
] as const;
/**
 * The first cut of this timeline kept them away for six seconds either side of
 * every movement, which added up to three-quarters of the cycle — a pigeon
 * feature with no pigeons in it. Real ones are braver: they lift when
 * something actually passes and they are back on the crumbs while the berthed
 * train is still standing, so now the flock is down for about half the cycle
 * and the scatter reads as a reaction rather than an absence.
 */
const PIGEON_TIMES = [
  0,
  TIMETABLE.nearEnter - 1,
  TIMETABLE.nearLeave + 3,
  TIMETABLE.expressEnter - 1,
  TIMETABLE.expressLeave + 3,
  TIMETABLE.arriveEnter - 2,
  TIMETABLE.doorsOpen + 5,
  TIMETABLE.departStart - 1,
  TIMETABLE.departEnd + 3,
  CYCLE_S,
]
  .map(kt)
  .join(";");
const PIGEON_VALUES = "1;0;1;0;1;0;1;0;1;1";

/**
 * The departure display's text. It ticks, which is the whole point of the
 * object, and which is why it lives here rather than in the memoised art: the
 * case, the dark screen, the cursor and the amber spill are paint, but the
 * minutes are true. `secondsToDeparture` and `stationPhase` come off the same
 * clock as the SMIL trains, so the display never promises a train that is not
 * coming. State only changes when the text does, which is at most once a
 * second and usually once a minute.
 */
function DeparturesLive() {
  const [rows, setRows] = useState<readonly [string, string, string] | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const phase = stationPhase();
      /**
       * While a service is at (or crossing) the platform, the display is
       * physically behind the train — so the text goes dark rather than
       * floating over the carriages. The PA carries those moments instead,
       * which is the correct division of labour on a real platform.
       */
      if (phase === "arriving" || phase === "boarding" || phase === "leaving") {
        setRows(null);
      } else {
        const d = new Date();
        const mins = Math.max(1, Math.ceil(secondsToDeparture() / 60));
        const line1 = `GDYNIA GL.   ${mins} MIN`;
        /* Sopot-bound trains leave at :12 and :42, says the fiction — a time
         * that is always in the future, unlike the 15:58 that used to be
         * painted here and was wrong 1439 minutes a day. */
        const m = d.getMinutes();
        const sopotM = m < 12 ? 12 : m < 42 ? 42 : 12;
        const sopotH = (d.getHours() + (m >= 42 ? 1 : 0)) % 24;
        const line2 = `SOPOT        ${`${sopotH}`.padStart(2, "0")}:${`${sopotM}`.padStart(2, "0")}`;
        const hh = `${d.getHours()}`.padStart(2, "0");
        const mm = `${m}`.padStart(2, "0");
        const line3 = `SKM PERON 1    ${hh}:${mm}`;
        setRows((prev) =>
          prev && prev[0] === line1 && prev[1] === line2 && prev[2] === line3
            ? prev
            : [line1, line2, line3],
        );
      }
      timer = window.setTimeout(tick, 1000);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  if (!rows) return null;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <g transform={`translate(${CIP.x + 7} ${CIP.y + 7})`}>
        <path d={textPath(rows[0], 0, 0)} fill={K.led} />
      </g>
      <g transform={`translate(${CIP.x + 7} ${CIP.y + 15})`}>
        <path d={textPath(rows[1], 0, 0)} fill={K.led} opacity={0.75} />
      </g>
      <g transform={`translate(${CIP.x + 7} ${CIP.y + 23})`}>
        <path d={textPath(rows[2], 0, 0)} fill={K.ledDim} />
      </g>
    </svg>
  );
}

/**
 * The station's own atmosphere: the PA, the rain, and the pigeons.
 *
 * The announcement is the one piece of UI here, and it is deliberately not a
 * toast — it is a line of amber on the departure display's own colour, appearing
 * where an announcement would appear, at the moment the train is called. A
 * station telling you something out loud is the most characteristic thing about
 * a station and it should not arrive as a game notification.
 */
function StationEffects({
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
  const ph = toPhase(phase);
  const s = stationState(world);
  const night = ph === "night";
  const wet = s.weather === "rain";
  /* where we are in the timetable — read once, same rule as the trains */
  const offsetS = useMemo(() => {
    armStation();
    return stationCycleOffsetS();
  }, []);
  const begin = `${(-offsetS).toFixed(2)}s`;
  return (
    <>
      <StationPeople world={world} ph={ph} />

      {/* the departure display's text, which is alive */}
      {s.board ? <DeparturesLive /> : null}

      {/* the announcement, when the service is called */}
      {s.announce && !dialogueOpen ? <Announcement scale={scale} /> : null}

      {/* pigeons: the ones in the shelter roof, and the ones working the
       * platform by the pigeon lady — who scatter when anything comes through
       * and drift back when it has gone, off the same clock as the trains.
       * The payoff is that the flock lifting is the first sign of a train. */}
      {s.pigeons ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} 180`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          <path
            d={pxPath([
              [SH.l + 60, SH.roof - 4, 5, 4],
              [SH.l + 68, SH.roof - 3, 4, 3],
              [SH.r - 90, SH.roof - 4, 5, 4],
            ])}
            fill={night ? "#4a4d52" : "#6f6c66"}
          >
            <animate attributeName="opacity" values="1;1;0.9;1" dur="7s" repeatCount="indefinite" />
          </path>
          {!night ? (
            /* a shade darker than the wear line, or they vanish into it */
            <g fill={ph === "dusk" ? "#443f39" : "#57544d"}>
              <animate
                attributeName="opacity"
                keyTimes={PIGEON_TIMES}
                values={PIGEON_VALUES}
                dur={`${CYCLE_S}s`}
                begin={begin}
                calcMode="discrete"
                repeatCount="indefinite"
              />
              {GROUND_PIGEONS.map((p) => (
                <g key={`gp${p.x}`}>
                  <path d={pxPath([[p.x, 160, 5, 3]])} />
                  {/* the neck fleck — one shade off the body would vanish
                   * into the wear line the way the first cut did */}
                  <path d={pxPath([[p.x + (p.face === 1 ? 3 : 1), 160, 1, 1]])} fill="#c9c4b6" />
                  <path d={pxPath([[p.x + (p.face === 1 ? 4 : -1), 158, 2, 2]])}>
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values="0 0;0 0;0 2;0 2;0 0;0 0"
                      dur={`${2.1 + p.jitter}s`}
                      calcMode="discrete"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              ))}
            </g>
          ) : null}
        </svg>
      ) : null}

      {/* the plastic bag by the mid bench — still until the down train's
       * slipstream takes it: three tumbles along the platform, a slump, and
       * gone. Runs off the same negative-begin timetable clock as the train
       * that kicks it, so cause and effect stay welded together. */}
      {!wet ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} 180`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          <path
            d={pxPath([
              [1210, 160, 6, 5],
              [1212, 158, 3, 2],
            ])}
            fill={night ? "#8a8d92" : "#e8e6df"}
            opacity={0.8}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              keyTimes={`0;${kt(TIMETABLE.nearEnter + 5)};${kt(TIMETABLE.nearLeave + 1)};${kt(TIMETABLE.nearLeave + 3.5)};${kt(TIMETABLE.nearLeave + 6)};1`}
              values="0 0;0 0;-34 -4;-66 0;-92 -2;-92 -2"
              dur={`${CYCLE_S}s`}
              begin={begin}
              repeatCount="indefinite"
              calcMode="linear"
            />
            <animate
              attributeName="opacity"
              keyTimes={`0;${kt(TIMETABLE.nearLeave + 7)};${kt(TIMETABLE.nearLeave + 9)};0.985;1`}
              values="0.8;0.8;0;0;0.8"
              dur={`${CYCLE_S}s`}
              begin={begin}
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      ) : null}

      {/* rain, falling into the cutting and off the shelter roof */}
      {wet ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${W} 180`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          <g opacity={0.5}>
            <path
              d={pxPath(
                Array.from({ length: 90 }, (_, i) => {
                  const x = (i * 227) % W;
                  const y = (i * 53) % 170;
                  return [x, y, 1, 5] as Rect;
                }),
              )}
              fill="#cfe2ee"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 -12;-6 180"
                dur="0.9s"
                repeatCount="indefinite"
              />
            </path>
          </g>
          {/* the drip line off the shelter's oversail */}
          <path
            d={pxPath(repeat(14, 24, [SH.l - 10, SH.roof + 6, 1, 6] as Rect))}
            fill="#cfe2ee"
            opacity={0.4}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 90"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      ) : null}
    </>
  );
}

/**
 * The PA. A line of amber, in the display's own typeface, at the moment the
 * service is called — and then it goes away, which announcements do.
 */
function Announcement({ scale }: { scale: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const t = stationCycleOffsetS();
      const next =
        t >= TIMETABLE.arriveEnter - 6 && t < TIMETABLE.arriveStop
          ? "Pociąg SKM do Gdyni Głównej wjeżdża na peron pierwszy."
          : t >= TIMETABLE.doorsClose - 5 && t < TIMETABLE.departStart
            ? "Prosimy odsunąć się od krawędzi peronu. Drzwi zamykane."
            : t >= TIMETABLE.expressEnter - 4 && t < TIMETABLE.expressEnter + 2
              ? "Uwaga, pociąg przejeżdża przez peron pierwszy. Nie zatrzymuje się."
              : null;
      setText((prev) => (prev === next ? prev : next));
      timer = window.setTimeout(tick, 700);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  /**
   * Presentation is the engine's Monologue in its `announce` kind — the PA
   * strip: viewport-portalled, amber mono on a scrim, no typewriter. This
   * component keeps only what is the station's own: which line the timetable
   * calls for, and when.
   */
  return <Monologue kind="announce" scale={scale} text={text} />;
}

/* ================================================================== *
 * the definition
 * ================================================================== */

/**
 * The carriage doors, as interaction zones.
 *
 * §11 is explicit that the train must not be one big hitbox: the player has to
 * walk to a door. So there are four of them, each 40 px wide at the position the
 * corresponding door stops at, and each one only exists while the doors are
 * actually open — `when` is the timetable, so the prompt appears when the leaves
 * part and is gone before they shut.
 *
 * `approachX` is the door centre, so tapping one walks the player to the door
 * rather than to wherever the hitbox happens to start. The boarding hatching
 * painted on the platform under each of these is the visual half of the same
 * statement.
 */
const DOORS_AS_OBJECTS = DOOR_X.map((x, i) => ({
  id: `train-door-${i + 1}`,
  kind: "trainDoor",
  x,
  /** boarding happens at the edge — walk the player up to the yellow line */
  approachY: 152,
  /**
   * Wide on purpose.
   *
   * This was 26 — the half-width of the door opening, which is geometrically
   * honest and unplayable: 68 cm of platform, four times along a 52-metre
   * platform, inside a 22-second window. You had to be standing on the exact
   * spot when the doors opened or you could not get on, and there was nothing
   * telling you where the spot was.
   *
   * 96 is a third of the gap between doors, so the doors never compete with
   * each other and anywhere near one of them works. `approachX` still walks the
   * player to the door itself, so tapping it puts them in the opening rather
   * than wherever the hitbox started.
   */
  range: 96,
  width: 44,
  approachX: x,
  priority: 4,
  markerY: 96,
  when: () => boardingOpen(),
}));

/**
 * Hoisted and typed as RuntimeObject[] so the literals can carry the runtime
 * extras (approachY) without tripping the excess-property check that the
 * SceneDef half of the intersection would otherwise apply.
 */
const STATION_OBJECTS: import("@/engine").RuntimeObject[] = [
  /* --- the way out, at the Gdańsk end — one stairs object per station that
   * HAS an exit (the `to` payload is static, so each destination needs its
   * own object, gated on which station the platform currently is), plus the
   * closed mouth for the stations whose underpass is being renovated. --- */
  ...Object.values(STATIONS)
    .filter((sp) => sp.exit)
    .map((sp) => ({
      id: sp.id === "przymorze" ? "station-stairs" : `station-stairs-${sp.id}`,
      kind: "stairs",
      priority: 2,
      x: Z.stairs,
      range: 34,
      approachY: 155,
      to: {
        scene: (sp.exit as NonNullable<StationSpec["exit"]>).scene,
        spawnX: (sp.exit as NonNullable<StationSpec["exit"]>).spawnX,
      },
      when: (w: object) => stationState(w as WorldState).at === sp.id,
    })),
  {
    id: "station-stairs-closed",
    kind: "flavor",
    x: Z.stairs,
    range: 34,
    when: (w) => STATIONS[stationState(w as WorldState).at].exit === null,
  },
  /* --- the railway itself --- */
  { id: "station-signal", kind: "flavor", x: SIG.x + 5, range: 20 },
  /* --- the platform, end to end --- */
  { id: "station-timetable", kind: "flavor", x: TT_X + 20, range: 22 },
  {
    id: "station-name",
    kind: "flavor",
    x: NAME_ART.przymorze.cx1,
    range: 40,
    when: (w) => stationState(w as WorldState).at === "przymorze",
  },
  {
    id: "station-name-zaspa",
    kind: "flavor",
    x: NAME_ART.zaspa.cx1,
    range: 40,
    when: (w) => stationState(w as WorldState).at === "zaspa",
  },
  {
    id: "station-mural",
    kind: "flavor",
    x: 700,
    range: 60,
    markerY: 76,
    when: (w) => stationState(w as WorldState).at === "zaspa",
  },
  { id: "station-biletomat", kind: "biletomat", x: Z.biletomat + 17, range: 26 },
  /* the machine sells it, the post punches it, the conductor asks for it */
  { id: "station-kasownik", kind: "kasownik", x: KAS.x + 10, range: 20 },
  { id: "station-drum", kind: "flavor", x: Z.drum + 15, range: 20 },
  { id: "station-clock", kind: "flavor", x: 643, range: 14 },
  { id: "station-shelter", kind: "flavor", x: SH.l + 60, range: 44 },
  /* sitting down on the platform is the whole point of a platform */
  {
    id: "station-bench",
    kind: "sport",
    action: "sit",
    face: 1,
    x: 900,
    range: 46,
    approachY: 152,
  },
  { id: "station-board", kind: "flavor", priority: 1, x: CIP.x + CIP.w / 2, range: 40 },
  {
    id: "station-bench-2",
    kind: "sport",
    action: "sit",
    face: 1,
    x: Z.midBench,
    range: 30,
    approachY: 152,
  },
  /* flavor, not `bins`: the shared bins handler toggles world.street.binOpen,
   * so opening this bin used to open the one on Ulica Słoneczna — and the
   * written line about the coffee cups was unreachable */
  { id: "station-bin", kind: "flavor", x: Z.bin + 11, range: 18 },
  { id: "station-sos", kind: "flavor", x: SOS.x + 6, range: 18 },
  { id: "station-name-2", kind: "flavor", x: NAME_ART.przymorze.cx2, range: 40 },
  /* --- the band furniture: PKP property, abandoned property --- */
  { id: "station-trolley", kind: "flavor", x: 1520, y: 160, range: 20 },
  { id: "station-case", kind: "flavor", x: 866, y: 163, range: 14 },
  /* the edge. Looking down the line is a thing you do, and it is a warning */
  { id: "station-edge", kind: "flavor", x: 1660, range: 60, markerY: 120 },
  { id: "station-cabinet", kind: "flavor", x: CAB.l + 21, range: 18 },
  { id: "station-fence", kind: "flavor", x: 1900, range: 44 },
  /* --- the people --- */
  {
    id: "station-reader",
    kind: "npc",
    priority: 2,
    x: 305,
    range: 14,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).reader,
  },
  {
    id: "station-golebiarka",
    kind: "npc",
    priority: 2,
    x: 404,
    range: 14,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).golebiarka,
  },
  {
    id: "station-bench-sitter",
    kind: "npc",
    priority: 2,
    x: 830,
    range: 16,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).bench,
  },
  {
    id: "station-phone",
    kind: "npc",
    priority: 2,
    x: 1054,
    range: 14,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).phone,
  },
  {
    id: "station-smoker",
    kind: "npc",
    priority: 2,
    x: 1610,
    range: 14,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).smoker,
  },
  {
    id: "station-looker",
    kind: "npc",
    priority: 2,
    x: 1690,
    range: 14,
    when: (w) =>
      whoIsWaiting(stationState(w as WorldState), toPhase(gamePhase(w as WorldState))).looker,
  },
  /* --- and the train, when it is here --- */
  ...DOORS_AS_OBJECTS,
];

export const TRAIN_STATION_SCENE: RuntimeSceneDef<WorldState> = {
  id: "station",
  width: W,
  /**
   * The walking band: from just behind the yellow line to the drainage
   * channel. Furniture stands at the back of the band and blocks only the back
   * lane, so the player passes in front of it in the same order the paint
   * does; the stair opening is the one hole in the surface and blocks the
   * front lanes instead, so the player walks behind it along the lip.
   */
  ground: {
    top: 152,
    bottom: 170,
    /**
     * The platform is not a constant strip either: it ramps down past the
     * fence at the Sopot end (the drawn ramp at Z.rampL), and the first metre
     * at the Gdańsk end belongs to the bridge abutment's shadow and drain.
     * Both bends are painted where they happen; the feet just agree.
     */
    profile: [
      { x: 0, bottom: 162 },
      { x: 56, bottom: 170 },
      { x: Z.rampL, bottom: 170 },
      { x: 1892, bottom: 158 },
      { x: W, bottom: 158 },
    ],
    /**
     * What the surface is, where it differs: the tactile strip along the
     * yellow line (read back by live.surface), and the ramp's broom-finished
     * slope, which genuinely walks slower.
     */
    zones: [
      { x0: 0, x1: W, y0: 152, y1: 155, kind: "tactile" },
      { x0: Z.rampL, x1: W, y0: 155, y1: 170, kind: "ramp", speed: 0.94 },
    ],
    blockers: [
      /* the underpass opening */
      { x0: 110, y0: 157, x1: 192, y1: 170 },
      /* the biletomat, the drum, the two bins, the relay cabinet. The
       * biletomat's footprint ends at 504, and so must its blocker: train
       * door 1 stops at x=510 and boards from (510,152), and a blocker
       * reaching 512 put that approach point inside it — the auto-walk
       * stalled at the edge and the door could not be boarded by tap. */
      { x0: 466, y0: 152, x1: 504, y1: 158 },
      { x0: 583, y0: 152, x1: 617, y1: 158 },
      { x0: 678, y0: 152, x1: 712, y1: 158 },
      { x0: 1286, y0: 152, x1: 1320, y1: 158 },
      { x0: 1712, y0: 152, x1: 1758, y1: 158 },
      /* the v4 furniture is as solid as the rest: back lane only, and every
       * carriage-door approach point (DOOR_X at y=152) stays outside */
      { x0: BIKE_X - 2, y0: 152, x1: BIKE_X + 82, y1: 158 },
      { x0: TOTEM_X - 2, y0: 152, x1: TOTEM_X + 18, y1: 158 },
      { x0: VEND_X - 2, y0: 152, x1: VEND_X + 32, y1: 158 },
      { x0: PLANTER_X - 2, y0: 152, x1: PLANTER_X + 32, y1: 158 },
      { x0: GRIT_X - 2, y0: 152, x1: GRIT_X + 36, y1: 158 },
      /* the band furniture: the trolley and the case are depth-sorted props */
      { x0: 1498, y0: 154, x1: 1542, y1: 161 },
      { x0: 858, y0: 158, x1: 876, y1: 164 },
    ],
  },
  /**
   * WHICH station this platform is, resolved on arrival. Coming on foot, the
   * counterpart scene names the station; coming off the train, the bag was
   * already written by the route map (or is simply the stop you boarded at,
   * which is what stepping straight back off should mean).
   */
  enter: ({ updateWorld, counterpart }) => {
    const byFoot: Record<string, StationId> = { district: "przymorze" };
    const at = counterpart ? byFoot[counterpart] : undefined;
    if (at) {
      updateWorld(
        (w) =>
          ({
            ...w,
            station: { ...((w as unknown as { station?: object }).station ?? {}), at },
          }) as typeof w,
      );
    }
  },
  describe: (w) => stationSpecOf(w).describe,
  /**
   * Every world read the artwork performs, and nothing else. The timetable is
   * deliberately absent: the trains are animated in SMIL off the document clock,
   * so putting the train phase in here would remount the whole scene four times
   * a cycle and restart the animation it is trying to describe.
   */
  artKey: (w, ph) => {
    const s = stationState(w);
    /* crowd and pigeons are deliberately absent: everyone they gate lives in
     * Effects and the actor list, outside the memoised art, and keying on them
     * remounted the art (and restarted every SMIL clock) for no repainted
     * pixel. */
    return [ph, s.at, s.weather, s.season, s.lamps, s.board ? 1 : 0, s.litter].join("|");
  },
  /**
   * The one person who moves. A platform where nobody walks is a photograph, and
   * a pacer covering forty metres of it every twenty seconds is the cheapest
   * possible way to say that this is a place where people are waiting.
   */
  actors: [
    npcToActor(NPCS.walker, {
      x: 1240,
      patrol: { from: 1090, to: 1560, speed: 16, pauseMs: 3400 },
      visible: (world) =>
        whoIsWaiting(stationState(world), toPhase(gamePhase(world as WorldState))).pacer,
      z: 6,
    }),
    /* --- the band furniture, depth-sorted against everyone above --------- */
    propActor("station-trolley-prop", 1520, 160, trolleyMap(), TROLLEY_PALETTE),
    propActor("station-case-prop", 866, 163, suitcaseMap(), SUITCASE_PALETTE),
  ],
  objects: STATION_OBJECTS,
  Component: ({ world, phase }) => <StationScene world={world} phase={phase} />,
  /** Outdoors: the sun and the platform lights do all of it. */
  darkness: () => 0,
  Foreground: (p) => <StationFront phase={p.phase} />,
  Effects: StationEffects,
  idleLean: true,
};
