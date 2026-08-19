import { useEffect, useState } from "react";
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
  M,
  type Mat,
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
  STEP_DROOP,
  STEP_FADE,
  STEP_SLIDE,
  shift,
  steppedCone,
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
import { NpcMonologue } from "./NpcMonologue";
import { NPCS } from "./npcs";

// --- KORYTARZ / klatka B, piętro 4 — the landing outside your own door -------------

/**
 * Third pass. Same landing, rebuilt to the house standard the street scene set.
 *
 * ==================================================================
 * SCALE. This scene was already at the house key and, like the street, nobody
 * had noticed. Floor to ceiling is FLOOR - CEIL = 107 px, and one storey in this
 * block is 2.80 m:
 *
 *     PPM = 38 px per metre, 2.6 cm per pixel.
 *
 * 560 px is 14.7 m of landing. Every existing hitbox x is unchanged — every one
 * of them has a translation entry — and the vertical dimensions have been
 * corrected against that key, which is free, because hitboxes only resolve in x:
 *
 *     adult   1.75 m  67 px     door leaf   2.05 m  78 px
 *     handle  1.05 m  40 px     lift door   0.95 m  36 px
 *     spyhole 1.60 m  61 px     skirting    0.16 m   6 px
 *
 * Five new hitboxes fill the four real gaps — 0…23, 306…325, 476…500 (which took
 * two) and 548…560 — which takes this from one interaction per 33 px to
 * one per 25, denser than the street, which is right: a landing is small and you
 * are standing in it. Nothing was added inside an existing range.
 * ==================================================================
 *
 * THE AUDIT. Five things were off-style measured against the rest of the
 * project, and one of them was a bug that cost the scene its whole far plane:
 *
 *   1. THE WINDOW WAS NOT A HOLE. OutsideView was drawn in middleBackground and
 *      then StairWindow painted an opaque `K.glass[ph]` rect over the aperture in
 *      the ground plane — and Walls painted a full-width rect over the rest of
 *      it. So the block opposite, the parallax, the rain and the three lit
 *      windows at night were all drawn every frame and none of them were ever
 *      visible. This is the same bug the klatka door had in the street file, and
 *      the same fix: a glazed opening is *rails around a hole*. The upper wall is
 *      now four rects that exclude the aperture, and the frame is a head, two
 *      jambs, a mullion and a bottom rail. The glass is a 0.18 tint and three
 *      stepped reflection strokes, so you see through it.
 *
 *   2. TWO-STATE COLOUR AND FIVE LOOSE BOOLEANS. Everything branched on
 *      `ph === "night"` or on a bare `world.corridor` flag while the street runs
 *      a clamped state machine that *derives from the clock* unless a flag
 *      overrides. Twelve stages now, same shape, same legacy fallbacks.
 *
 *   3. NO artKey. The scene was a plain SceneDef, so the art plane had no
 *      memoisation key at all and repainted on anything. It lists its reads now.
 *
 *   4. THE SCENE COULD NOT SEE THE WEATHER. The street already keeps
 *      `world.street.weather` and `.season`, and this landing has the only
 *      window in the building. It reads them now: rain on the outside of the
 *      glass, snow on the ledge and the parapet opposite, slush on the mats, a
 *      wet umbrella by 15 when it has been raining, condensation when it is
 *      cold. Same city, seen from the fourth floor.
 *
 *   5. ONE FLAT PLANE OF DAYLIGHT. Four planes became six, and the two outside
 *      ones are haze-ramped toward the horizon band exactly as the street's
 *      skyline is — from up here you can see the things the street can only see
 *      at ground level: the church spire, the water tower, the heating-plant
 *      stack and its beacon.
 *
 * SIX PLANES:
 *   farBackground (0.82) — PhaseSky, a cloud band, and the roofline: spire,
 *     tower, stack, beacon. Four hundred metres out, so it barely moves.
 *   middleBackground (0.94) — the block opposite, thirty metres away: render,
 *     slab band, seven windows with their own lives, the parapet and its
 *     pigeons, and the weather, which happens on the far side of the glass.
 *   ground (1.0) — ceiling, soffit, walls, the window opening, every wall
 *     fitting, the tile, the flight going down. All 23 hitboxes resolve here.
 *   staticObjects (1.0) — everything standing on the tile.
 *   gameplayObjects (1.0) — the three doors, the lift, the balustrade.
 *   Foreground (fixed) — the near corner, the underside of the ceiling, a
 *     sprinkler, near dust, and the spider that is very nearly in the lens.
 *
 * LIGHTING PREMISE, unchanged and still the whole model: this floor has no
 * daylight of its own except the stairwell window, and the ceiling spots are on
 * a twenty-second motion timer. The window sets the palette — walls and tile are
 * palette-shifted per phase rather than washed with an overlay — and the sensor
 * decides how much of it you can see. What is new is that the sensor is no longer
 * the only artificial source: there are eight now, at four temperatures.
 *
 *     3× ceiling spot        3000 K, wide, on the sensor
 *     1× lobby downlight     3000 K, in the lift soffit, on the lift's own
 *                            circuit, so the far end is never black — which is
 *                            also why nobody has ever reported the dead spot
 *     1× lift car            4000 K, cold, and the brightest thing here when
 *                            the doors are open
 *     3× under-door lines    2700 K, warm, one per flat, on their own hours
 *     1× exit sign           green, never sleeps, and a moth has noticed
 *     1× intercom screen     cold, 12 seconds a minute
 *     1× riser lamp          when the door is open
 *     1× stairwell, below    warm, up through the balustrade, on a timer
 *
 * All light is quantised: stepped cones, stepped pools, dithered edges, no
 * gradients, no ellipses, no circles. Transitions run on steps() so a light
 * coming up does it in three visible jumps, and the lift leaves slide in
 * four-pixel increments.
 *
 * ANIMATION. Everything repeated is banked to one path with one animation, and
 * every loop that could be caught at its reset point starts on a negative
 * `begin` — the cloud lesson from the street file, applied to the motes, the
 * detector, the LEDs and the spider. Anything that used to appear or vanish on a
 * state change is now mounted at opacity 0 and stepped, so nothing pops.
 *
 * BUDGET. ~640 live nodes at the busiest state, 36 animations, 21 of them on
 * calcMode="discrete". Zero gradients, zero ellipses, zero circles. The four
 * cones and their pools are 24 of those nodes and stay mounted so the stepped
 * fade has something to fade; everything else static is precomputed to a path at
 * module load.
 */

const W = 560;
const H = 180;

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);

/* Landmark rows. A landing is a stack of horizontal bands and these are them. */
const CEIL = 43; // underside of the suspended ceiling — 2.82 m
const SOFFIT = 51; // the dropped bulkhead over the lift
const BAND = 103; // top of the graphite accent band, where a pram handle hits
const SKIRT = 144;
const FLOOR = 150; // tile surface
const CY = FLOOR - 2; // where contact shadows sit

/**
 * Unit boundaries, for anyone adding to this landing. Every x in this file
 * belongs to exactly one of these, and none of them overlap:
 *
 *     0…8    near return wall (Foreground)   316…362  door 15
 *     8…20   the hand-painted numeral        362…388  the floor plaque
 *    20…68   door 14 — yours                 388…418  the fire point
 *    68…88   the mat and the parcel          418…428  the lift notice, the ROP
 *    88…106  the intercom                    428…480  the lift
 *   106…120  switch, socket, wall vent       480…490  the wayfinding plate
 *   118…164  door 13                         488…560  the window and its sill
 *   148…172  shoes, scooter, bowl            492…556  balustrade, flight down
 *   168…206  the board, the pram under it
 *   204…238  the riser                       Rows, in the same key:
 *   240…268  the print                         handle   1.15 m  y 106
 *   276…302  the monstera                      spyhole  1.60 m  y  89
 *   300…318  the tag behind it                 leaf top 2.05 m  y  72
 */
const LEAF_TOP = FLOOR - m(2.05); // 72 — every leaf on this landing starts here
const SPY_Y = FLOOR - m(1.6) - 1; // 88 — and every spyhole here
const HANDLE_Y = FLOOR - m(1.15); // 106 — and every handle, knob and lever here

/** The window opening. The wall is built around this, not over it. */
const APER = { x0: 494, x1: 552, y0: 50, y1: 96 } as const;
/** The lift opening: 0.95 m of door, centred on the lift-doors hitbox at 454. */
const LIFT = { x0: 436, x1: 472, head: 70, sill: 146 } as const;

/** Ceiling spots. 500 is dead — see Ceiling(). */
const SPOTS = [80, 230, 380, 500] as const;
const LIVE_SPOTS = [80, 230, 380] as const;
/** And the one in the lift soffit, which is on a different circuit entirely. */
const LOBBY_SPOT = 454;

/* ================================================================== *
 * palette
 * ================================================================== */

/**
 * The two surfaces that dominate the frame get a real ramp per phase instead of
 * a tint rect over the top. Expensive to author, cheap to draw, and on a
 * corridor — where 70% of the pixels are wall and floor — it is the one that
 * pays. Same three casts as the street, so the two agree about what an hour
 * looks like.
 */
const DAWN_CAST = "#8c86a8";
const DUSK_CAST = "#c98a52";
const NIGHT_CAST = "#141a24";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.15),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.16),
    night: dim(mat, NIGHT_CAST, 0.6),
  };
}

const PLASTER = ramp(M.plaster);
const TILE = ramp(M.tile);
const GRAPHITE = ramp(M.graphite);
const STEEL = ramp(M.steel);
const TIN = ramp(M.tin);
const LINEN = ramp(M.linen);
const OAK = ramp(M.oak);
const LAMINATE = ramp(M.laminate);
const CEILING = ramp({
  hi: "#f0eee8",
  base: "#e8e6e0",
  mid: "#dcd9d1",
  lo: "#d0cec6",
  deep: "#b8b6ae",
});

const K = {
  /**
   * The sky in four stepped bands, top to horizon — [3] is the band everything
   * outside mixes toward. Identical stops to the street's, because it is the
   * same sky twelve metres up.
   */
  sky: {
    dawn: ["#8ba3c4", "#a9b8cc", "#c9cfd8", "#e8cf9a"],
    day: ["#7fa8cc", "#93b8d6", "#a8c8e0", "#cfe2ee"],
    dusk: ["#4a3b63", "#7d5378", "#b96b8c", "#f2a65a"],
    night: ["#12142a", "#1a1830", "#232040", "#2c2a4a"],
  } as Record<Ph, string[]>,
  glass: { dawn: "#c6c0d0", day: "#a8c2d4", dusk: "#c99a72", night: "#232a34" } as Record<
    Ph,
    string
  >,
  glassLit: "#ffd98a",
  white: "#f2f2ee",
  cream: "#e8e2d2",
  curtain: "#e8e2d2",
  scuff: "#bfbbb0",
  patch: "#ded9cf",
  /** the greige they used for the second overpaint, which was not the greige */
  overpaint: "#cfcabe",
  warm: "#ffd98a",
  warmHi: "#fff8e0",
  green: "#3ddc84",
  greenDeep: "#0d3d24",
  amber: "#ff8a3a",
  ledAmber: "#ffb03a",
  ledRed: "#ff5050",
  ledBlue: "#7ea8e0",
  ledDead: "#c9c7bf",
  brass: M.brass.base,
  plaqueBlue: "#1e4478",
  plaqueBlueHi: "#2a5a94",
  courier: "#f5c518",
  noticeFlag: "#c94040",
  leafDry: "#8a8a4a",
  gum: "#2e2c28",
  chalk: "#e2e0da",
  snow: "#eef4f8",
  snowLo: "#c8d6e0",
  slush: "#8a9298",
  water: "#6a7580",
  waterHi: "#8fa0ad",
  rain: "#9fb6c8",
  pigeon: "#6d7278",
  pigeonHi: "#828890",
  hazard: "#e8c445",
} as const;

/* ================================================================== *
 * state — a landing runs on the same timetable the street does
 * ================================================================== */

export type LiftStage = "away" | "called" | "open";
export type SpotStage = "auto" | "on" | "off";
export type NataliaStage = "away" | "mop" | "wring" | "rest";
export type RiserStage = "shut" | "open" | "tripped";
export type ParcelStage = "waiting" | "taken";
export type PlantStage = "dry" | "watered";
export type PanelStage = "shut" | "open";
export type NoticeStage = "unread" | "read";
export type PramStage = "home" | "out";
/** Thirteen: a dog, a small child, and a lot of life. */
export type D13Stage = "quiet" | "awake" | "out";
/** Fifteen: quiet people, a newspaper at dawn, a menu at the other end of it. */
export type D15Stage = "quiet" | "paper" | "menu";

const LIFTS: readonly LiftStage[] = ["away", "called", "open"];
const SPOTSTAGE: readonly SpotStage[] = ["auto", "on", "off"];
const NATS: readonly NataliaStage[] = ["away", "mop", "wring", "rest"];
const RISERS: readonly RiserStage[] = ["shut", "open", "tripped"];
const PARCELS: readonly ParcelStage[] = ["waiting", "taken"];
const PLANTS: readonly PlantStage[] = ["dry", "watered"];
const PANELS: readonly PanelStage[] = ["shut", "open"];
const NOTICES: readonly NoticeStage[] = ["unread", "read"];
const PRAMS: readonly PramStage[] = ["home", "out"];
const D13S: readonly D13Stage[] = ["quiet", "awake", "out"];
const D15S: readonly D15Stage[] = ["quiet", "paper", "menu"];

type CorridorState = {
  lift: LiftStage;
  spots: SpotStage;
  natalia: NataliaStage;
  riser: RiserStage;
  parcel: ParcelStage;
  plant: PlantStage;
  ext: PanelStage;
  notice: NoticeStage;
  pram: PramStage;
  d13: D13Stage;
  d15: D15Stage;
  /** how much the stairwell is being used, which is what makes a block a block */
  traffic: 0 | 1 | 2 | 3;
};

/* These two are the street's, verbatim, and belong in the kit — see the hoist
 * list at the foot of the file. Duplicated here rather than imported from the
 * street scene, which must not become a dependency of anything. */
function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/**
 * Every key falls back to what the clock says. The legacy booleans this scene
 * used to read directly — `liftOpen`, `parcelTaken`, `plantWatered`, `extOpen`,
 * `noticeRead`, `riserOpen` — still win where they are set, so an old save loads
 * into the frame it used to draw. Read defensively, so `WorldState` needs no
 * change to compile.
 */
function state(world: WorldState, ph: Ph): CorridorState {
  const c = ((world as unknown as Record<string, unknown>).corridor ?? {}) as Record<
    string,
    unknown
  >;
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const traffic = clampInt(c.traffic, 3, night ? 0 : ph === "day" ? 2 : 1) as 0 | 1 | 2 | 3;
  return {
    lift: clampStage(
      c.lift,
      LIFTS,
      c.liftOpen === true ? "open" : traffic >= 2 ? "called" : "away",
    ),
    spots: clampStage(c.spots, SPOTSTAGE, "auto"),
    natalia: clampStage(
      c.natalia,
      NATS,
      ph === "dawn" ? "mop" : ph === "day" ? "rest" : ph === "dusk" ? "wring" : "away",
    ),
    riser: clampStage(c.riser, RISERS, c.riserOpen === true ? "open" : "shut"),
    parcel: clampStage(c.parcel, PARCELS, c.parcelTaken === true ? "taken" : "waiting"),
    plant: clampStage(c.plant, PLANTS, c.plantWatered === true ? "watered" : "dry"),
    ext: clampStage(c.ext, PANELS, c.extOpen === true ? "open" : "shut"),
    notice: clampStage(c.notice, NOTICES, c.noticeRead === true ? "read" : "unread"),
    pram: clampStage(c.pram, PRAMS, ph === "day" ? "out" : "home"),
    d13: clampStage(c.d13, D13S, ph === "day" ? "out" : dark ? "awake" : "quiet"),
    d15: clampStage(c.d15, D15S, ph === "dawn" ? "paper" : dark ? "menu" : "quiet"),
    traffic,
  };
}

/**
 * What the window can see of the street's world. Same keys and the same
 * vocabularies the street scene clamps, read defensively, because this landing
 * must not care whether anybody has been outside yet. This is the mirror move
 * the street made with `hallState` and `shopFront`, pointed the other way.
 */
export type Weather = "clear" | "overcast" | "rain" | "wet" | "snow";
export type Season = "green" | "autumn" | "bare";
const WEATHERS: readonly Weather[] = ["clear", "overcast", "rain", "wet", "snow"];
const SEASONS: readonly Season[] = ["green", "autumn", "bare"];
const LAMPS = ["auto", "on", "off"] as const;

type Outside = { weather: Weather; season: Season; lamps: boolean };

function outside(world: WorldState, ph: Ph): Outside {
  const s = ((world as unknown as Record<string, unknown>).street ?? {}) as Record<string, unknown>;
  const dark = ph === "night" || ph === "dusk";
  const weather = clampStage(s.weather, WEATHERS, "clear");
  const lamps = clampStage(s.lamps, LAMPS, "auto");
  return {
    weather,
    season: clampStage(s.season, SEASONS, "autumn"),
    lamps: lamps === "on" || (lamps === "auto" && (dark || (ph === "dawn" && weather !== "clear"))),
  };
}

const isWet = (o: Outside) => o.weather === "rain" || o.weather === "wet";
const isSnow = (o: Outside) => o.weather === "snow";
const isFlat = (o: Outside) =>
  o.weather === "overcast" || o.weather === "rain" || o.weather === "snow";
/** Cold enough for the glass to fog and the blind to come further down. */
const isCold = (o: Outside, ph: Ph) => isSnow(o) || ph === "night";

/* ================================================================== *
 * helpers — all four are hoist candidates, see the foot of the file
 * ================================================================== */

function bank(shape: readonly Rect[], n: number, pitch: number, dy = 0): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) out.push(...shift(shape, i * pitch, i * dy));
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

/** Mix a material toward the horizon band of the sky by k. The whole depth model. */
function hazeRamp(mat: Mat, k: number): Record<Ph, Mat> {
  const out = {} as Record<Ph, Mat>;
  for (const p of ["dawn", "day", "dusk", "night"] as const) out[p] = dim(mat, K.sky[p][3], k);
  return out;
}

/**
 * A wash from a lit aperture down onto the tile. Same helper as the street's
 * `spill`, with the bottom pinned to this scene's floor instead of its kerb.
 */
function wash(x0: number, x1: number, top: number, spread: number, tint: "w" | "c" | "e", g = 0.7) {
  return tiers(
    (k) =>
      steppedQuad(
        top,
        x0 + (1 - k) * spread,
        x1 - (1 - k) * spread,
        FLOOR + 12,
        x0 - spread + (1 - k) * spread,
        x1 + spread - (1 - k) * spread,
        8,
      ),
    tint,
    g,
  );
}

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/* --- ceiling --- */
/** A 600 mm suspended grid, which is 23 px, not the five seams that were here. */
const CEIL_GRID = pxPath(repeat(24, 23, [22, 0, 1, CEIL] as Rect));
const CEIL_CROSS = pxPath([
  [0, 14, W, 1],
  [0, 28, W, 1],
]);
/** Two access hatches, because a riser survey needs somewhere to start. */
const CEIL_HATCHES = bevelPaths([
  [256, 6, 46, 22],
  [408, 6, 34, 18],
]);
/** The panel that was lifted for that survey and never seated back flat. */
const PANEL_LIFT = aoPaths([[256, 28, 46]]);
const SPOT_HOUSINGS = bevelPaths(SPOTS.map((x) => [x - 6, 36, 12, 4] as Rect));
const SPOT_LENSES = pxPath(LIVE_SPOTS.map((x) => [x - 4, 40, 8, 2] as Rect));
const VENT_FINS = pxPath(repeat(6, 5, [303, 35, 2, 5]));
const TRAY = pxPath([
  [318, 38, 96, 2],
  [318, 38, 96, 1],
]);
/** The dropped bulkhead over the lift, and the AO it casts on the wall behind. */
const SOFFIT_BOX = bevelPaths([[418, CEIL, 72, SOFFIT - CEIL + 3]]);
const SOFFIT_AO = aoPaths([[418, SOFFIT + 3, 72]]);
const SOFFIT_LENS = pxPath([[LOBBY_SPOT - 5, SOFFIT + 1, 10, 2]]);

/* --- walls --- *
 * The upper band is four rects, not one, because the window is a hole in it. */
const WALL_UPPER: Rect[] = [
  [0, CEIL, APER.x0, BAND - CEIL],
  [APER.x1, CEIL, W - APER.x1, BAND - CEIL],
  [APER.x0, CEIL, APER.x1 - APER.x0, APER.y0 - CEIL],
  [APER.x0, APER.y1, APER.x1 - APER.x0, BAND - APER.y1],
];
const WALL_UPPER_D = pxPath(WALL_UPPER);
const WALL_LOWER = pxPath([[0, BAND + 6, W, SKIRT - BAND - 6]]);
/** The floor numeral, painted by hand and cropped by the near corner. */
const NUMERAL_4 = pxPath([
  [0, 56, 5, 30],
  [0, 80, 18, 5],
  [13, 56, 5, 42],
]);
/** Where a trolley wheel went through it. */
const NUMERAL_SCUFF = pxPath([
  [2, 70, 9, 2],
  [8, 84, 6, 1],
]);
const WALL_SCUFFS = pxPath([
  [172, 128, 40, 6],
  [430, 132, 34, 4],
  [96, 136, 22, 3],
  /* the arc door 13 has worn where it swings past the wall */
  [166, 118, 4, 22],
  [168, 116, 2, 2],
]);
const ANCHOR_HOLES = pxPath([
  [340, 96, 2, 2],
  [352, 96, 2, 2],
  /* and the four from the frame that used to hang here, filled with the wrong filler */
  [236, 58, 2, 2],
  [272, 58, 2, 2],
  [236, 100, 2, 2],
  [272, 100, 2, 2],
]);
/** A tag, painted over twice, still legible if you know it is there. */
const GRAFFITI = pxPath([
  [307, 112, 14, 2],
  [307, 116, 3, 8],
  [312, 120, 8, 2],
  [318, 112, 3, 12],
  [305, 124, 18, 2],
]);
/** Paint that ran when they cut in the band and nobody came back with a rag. */
const DRIP = pxPath([
  [246, 109, 2, 16],
  [247, 125, 1, 5],
]);
/** The trunking the graphite band is hiding, where it comes out to the riser. */
const CONDUIT = pxPath([
  [218, CEIL, 4, 25],
  [218, CEIL, 1, 25],
]);
/** The wall vent, low, which every stairwell has and no scene has drawn. */
const WALL_VENT = bevelPaths([[96, 130, 10, 8]]);
const WALL_VENT_FINS = pxPath(repeat(3, 3, [98, 132, 6, 1] as Rect, "y"));

/* --- the floor plaque and the flat directory --- *
 * These sit in the one stretch of upper wall this landing has spare, between
 * your own architrave and the intercom. They get no hitbox: 66…88 is inside the
 * `parcel` range already, and a second hitbox inside another one is how you end
 * up with the misaimed prompts the street file spent a page on. */
const PLAQUE = bevelPaths([[68, 54, 18, 20]]);
const PLATE_WAY = bevelPaths([[68, 78, 18, 22]]);

/* --- notice board above the pram --- */
const BOARD = bevelPaths([[168, 54, 34, 44]]);
const BOARD_PINS = pxPath([
  [174, 60, 1, 1],
  [190, 59, 1, 1],
  [176, 78, 1, 1],
  [192, 80, 1, 1],
]);
const BOARD_PAPERS = bevelPaths([
  [172, 59, 12, 16],
  [187, 58, 13, 17],
  [173, 77, 14, 15],
  [190, 79, 10, 13],
]);
const BOARD_LINES = pxPath([
  [174, 63, 8, 1],
  [174, 66, 6, 1],
  [174, 69, 9, 1],
  [189, 62, 9, 1],
  [189, 65, 7, 1],
  [175, 81, 10, 1],
  [175, 84, 8, 1],
  [175, 87, 11, 1],
  [192, 83, 6, 1],
]);
const BOARD_AO = aoPaths([[168, 98, 34]]);

/* --- floor --- */
/** Large-format tile: 700 mm joints across, two courses deep. */
const TILE_JOINTS = pxPath([...repeat(8, 70, [70, FLOOR, 1, 30]), [0, 158, W, 1], [0, 174, W, 1]]);
const MATS = bevelPaths([
  [26, FLOOR, 40, 4],
  [124, FLOOR, 34, 3],
  [322, FLOOR, 34, 3],
]);
const MAT_BRISTLES = pxPath(repeat(6, 6, [30, 151, 2, 3]));
/** The gum somebody left in 2023 and the heel-marks around it. */
const FLOOR_GRIME = pxPath([
  [210, 168, 3, 2],
  [211, 167, 1, 1],
  [96, 170, 2, 1],
  [148, 172, 6, 1],
  [152, 171, 3, 1],
]);
/** Pram wheels, when the pram has been out and back. */
const PRAM_TRACKS = pxPath([
  [176, 154, 2, 18],
  [196, 154, 2, 18],
]);
/** The hatched box in front of the fire point, and the stencil in it. */
const NO_STANDING = pxPath(bank([[386, 152, 3, 8]], 9, 4));

/* --- doors: leaf 2.05 m, frame 2.10 m, 0.95–1.00 m wide --- */
const D14_FRAME = bevelPaths([[20, LEAF_TOP - 4, 46, FLOOR - LEAF_TOP + 4]]);
const D14_LEAF = bevelPaths([[24, LEAF_TOP, 38, m(2.05)]]);
const D14_PANELS = bevelPaths([
  [30, 80, 26, 20],
  [30, 104, 26, 20],
  [30, 128, 26, 14],
]);
const D14_AO = aoPaths([[20, LEAF_TOP - 4, 46]]);
const D13_FRAME = bevelPaths([[118, LEAF_TOP - 4, 44, FLOOR - LEAF_TOP + 4]]);
const D13_LEAF = bevelPaths([[122, LEAF_TOP, 36, m(2.05)]]);
const D13_PANELS = bevelPaths([
  [126, 78, 28, 28],
  [126, 110, 28, 30],
]);
const D13_AO = aoPaths([[118, LEAF_TOP - 4, 44]]);
const D15_FRAME = bevelPaths([[316, LEAF_TOP - 4, 44, FLOOR - LEAF_TOP + 4]]);
const D15_LEAF = bevelPaths([[320, LEAF_TOP, 36, m(2.05)]]);
const D15_PANELS = bevelPaths([[324, 78, 28, 62]]);
const D15_AO = aoPaths([[316, LEAF_TOP - 4, 44]]);
/** A child measured against the architrave of 15, twice a year, in pencil. */
const HEIGHT_MARKS = pxPath([
  [317, 128, 4, 1],
  [317, 121, 4, 1],
  [317, 115, 4, 1],
  [317, 110, 3, 1],
]);
const T_14 = textPath("14", 38, 79);
const T_13 = textPath("13", 136, 79);
const T_15 = textPath("15", 334, 79);
const T_METER = textPath("4152", 212, 95);
const T_METER_SHUT = textPath("4152", 215, 79);

/* --- lift: rails around a hole, so the car is visible through it --- */
const LIFT_RAILS = pxPath([
  [428, 64, 52, 6],
  [428, 64, 8, 86],
  [472, 64, 8, 86],
  [428, LIFT.sill, 52, 4],
]);
const LIFT_RAILS_HI = pxPath([
  [428, 64, 52, 1],
  [428, 64, 2, 86],
]);
const LIFT_JAMB_AO = aoPaths([[LIFT.x0, LIFT.head, LIFT.x1 - LIFT.x0]]);
const LEAF_L = bevelPaths([[LIFT.x0, LIFT.head, 18, LIFT.sill - LIFT.head]]);
const LEAF_R = bevelPaths([[LIFT.x0 + 18, LIFT.head, 18, LIFT.sill - LIFT.head]]);
/** Polish ground floor is P, not 0. The car spends its life between P and 4. */
const IND_SEQUENCE = ["P", "1", "2", "3"].map((d) => textPath(d, 450, 55));
const IND_ARROW = pxPath([
  [460, 55, 5, 1],
  [461, 56, 3, 1],
  [462, 57, 1, 1],
]);
/** The dent at kick height, from a wardrobe that went up in 2021. */
const LEAF_DENT = pxPath([
  [462, 124, 6, 3],
  [463, 127, 4, 1],
]);
const CAR_BUTTONS = pxPath(repeat(4, 5, [466, 88, 4, 3], "y"));
const CALL_BOX = bevelPaths([[482, 92, 8, 16]]);

/* --- riser --- */
const RISER_BOX = bevelPaths([[204, 68, 34, 54]]);
const RISER_AO = aoPaths([[204, 122, 34]]);
const RISER_BREAKERS = bevelPaths(repeat(6, 4, [209, 74, 3, 10]));
const RISER_TRIPPED = pxPath([
  [213, 74, 3, 4],
  [221, 74, 3, 4],
]);

/* --- fittings --- */
const INTERCOM_BOX = bevelPaths([[88, 74, 18, 28]]);
const INTERCOM_GRILLE = pxPath(repeat(4, 3, [91, 93, 2, 4]));
const SWITCH_BOX = bevelPaths([
  [108, 88, 10, 13],
  [107, 128, 12, 12],
]);
/** Two standby LEDs on one wall, one path, one animation. */
const STANDBY_LEDS = pxPath([
  [102, 86, 2, 2],
  [111, 92, 4, 2],
]);
const PRINT_FRAME = bevelPaths([[240, 60, 28, 38]]);
const PRINT_AO = aoPaths([[240, 98, 28]]);
const EXT_BOX = bevelPaths([[388, 70, 30, 44]]);
const EXT_AO = aoPaths([[388, 114, 30]]);
/** The evacuation plan, which is the law, and which nobody has ever read. */
const EVAC_PLAN = bevelPaths([[388, 54, 30, 14]]);
const EVAC_GRID = pxPath([
  ...repeat(3, 3, [391, 58, 24, 1] as Rect, "y"),
  [398, 57, 1, 9],
  [408, 57, 1, 9],
]);
/** The dispenser somebody screwed up in 2020, and the tape where its sign was. */
const SANITISER = bevelPaths([[402, 118, 8, 14]]);
/** The call point. 90 mm square, which at 2.6 cm a pixel is very nearly nothing. */
const ROP = bevelPaths([[420, 96, 6, 6]]);
/** The camera in the ceiling corner, watching the lift and nothing else. */
const CAMERA = pxPath([
  [470, 30, 14, 6],
  [474, 36, 8, 3],
]);

/* --- window: a head, two jambs, a mullion and a bottom rail --- */
const WIN_RAILS = pxPath([
  [488, 44, 70, 6],
  [488, APER.y1, 70, 4],
  [488, 44, 6, 56],
  [APER.x1, 44, 6, 56],
  [520, APER.y0, 3, APER.y1 - APER.y0],
]);
const WIN_RAILS_HI = pxPath([
  [488, 44, 70, 1],
  [488, 44, 2, 56],
  [520, APER.y0, 1, APER.y1 - APER.y0],
]);
const WIN_REVEAL_AO = aoPaths([[APER.x0, APER.y0, APER.x1 - APER.x0]]);
/** Three stepped strokes of reflection. A pane with no reflection is a hole. */
const WIN_REFLECT = pxPath([
  [498, 88, 12, 1],
  [504, 76, 14, 1],
  [528, 82, 16, 1],
]);
const WIN_SILL = bevelPaths([[486, APER.y1, 74, 4]]);
const SILL_AO = aoPaths([[486, APER.y1 + 4, 74]]);
const BLIND_SLATS = [54, 58, 62, 66, 70, 74, 78, 82] as const;

/* --- stairs --- */
const TREADS = bevelPaths([
  [494, 112, 52, 4],
  [500, 124, 46, 4],
  [506, 136, 40, 4],
]);
const NOSINGS = pxPath([
  [494, 115, 52, 1],
  [500, 127, 46, 1],
  [506, 139, 40, 1],
]);
const BALUSTRADE_AO = aoPaths([[492, 108, 64]]);

/* --- contact shadows, all in one pass --- */
const CONTACTS = contactPaths([
  [288, 26, CY], // plant pot
  [188, 38, CY], // pram
  [76, 26, CY], // parcel
  [158, 20, CY], // shoes, scooter, bowl
  [382, 22, CY], // the bucket, wherever it is standing
  [432, 18, CY], // the wet-floor sign
]);

/* ================================================================== *
 * light — precomputed, quantised, nine sources
 * ================================================================== */

/** A ceiling spot: cone from the fitting to the floor, plus its pool. */
const SPOT_CONES = LIVE_SPOTS.map((x) =>
  tiers((s) => steppedCone(x, CEIL, Math.round(8 * s), FLOOR, Math.round(46 * s), 6), "w"),
);
const SPOT_POOLS = LIVE_SPOTS.map((x) =>
  tiers(
    (s) => steppedEllipse(x, 152, Math.round(46 * s), Math.max(2, Math.round(7 * s)), 2),
    "w",
    0.7,
  ),
);
/** The lenses, so the fittings read as sources and not as holes. */
const SPOT_SOURCES = pxPath(LIVE_SPOTS.map((x) => [x - 5, 40, 10, 3] as Rect));
/**
 * The lobby downlight in the soffit. On the lift's own circuit, so it never goes
 * out — which is the answer to "why is the far end of this landing not black".
 */
const LOBBY_CONE = tiers(
  (s) => steppedCone(LOBBY_SPOT, SOFFIT, Math.round(7 * s), FLOOR, Math.round(38 * s), 6),
  "w",
  0.55,
);
const LOBBY_POOL = tiers(
  (s) => steppedEllipse(LOBBY_SPOT, 152, Math.round(38 * s), Math.max(2, Math.round(6 * s)), 2),
  "w",
  0.45,
);
const LOBBY_HALO = bulbPaths([[LOBBY_SPOT, SOFFIT + 2]]);

/**
 * The window shaft, off the actual aperture this time. Daylight rakes down and
 * to the left across the tile; at dusk it goes long and amber, at dawn it is
 * short, high and cold, and under cloud there is no shaft at all — only the
 * flat wash, which is what overcast means.
 */
const SHAFT: Record<Ph, ReturnType<typeof tiers> | null> = {
  dawn: tiers(
    (s) => steppedQuad(APER.y0, APER.x0, APER.x1, FLOOR + 18, APER.x0 - 40 * s, APER.x1, 8),
    "c",
    0.7,
  ),
  day: tiers(
    (s) => steppedQuad(APER.y0, APER.x0, APER.x1, H, APER.x0 - 70 * s, APER.x1 + 4, 8),
    "c",
  ),
  dusk: tiers(
    (s) => steppedQuad(APER.y0, APER.x0, APER.x1, H, APER.x0 - 110 * s, APER.x1 + 6, 8),
    "e",
    0.85,
  ),
  night: null,
};
/** Overcast: no shaft, just the aperture bleeding onto the tile. */
const DIFFUSE = wash(APER.x0, APER.x1, APER.y0, 34, "c", 0.42);
/** What the streetlamp twelve metres down manages, which is not much. */
const LAMP_WASH = tiers(
  (s) => steppedQuad(APER.y0, APER.x0 + 4, APER.x1, H, APER.x0 - 30 * s, APER.x1 + 2, 8),
  "c",
  0.32,
);
/** The lift car: 4000 K, and the brightest thing on this landing when it is here. */
const LIFT_WASH = wash(LIFT.x0, LIFT.x1, LIFT.head, 40, "c", 0.9);
/** Three doors, three sets of hours, three warm lines on the tile. */
const UNDER_14 = wash(24, 62, 146, 14, "w", 0.5);
const UNDER_13 = wash(122, 158, 146, 14, "w", 0.5);
const UNDER_15 = wash(320, 356, 146, 14, "w", 0.45);
/** The riser lamp, and the intercom screen, both small and both real. */
const RISER_WASH = wash(206, 236, 70, 14, "w", 0.35);
const INTERCOM_WASH = wash(90, 104, 76, 10, "c", 0.25);
/** Up through the balustrade from the flight below, on somebody else's timer. */
const STAIR_WASH = tiers(
  (s) => steppedQuad(FLOOR, 496, 552, 106, 500 - 20 * s, 548 + 8 * s, 6),
  "w",
  0.4,
);
/** The exit sign never sleeps. It is green, so it gets its own pool, not a tier. */
const EXIT_GLOW = bulbPaths([[499, 42]]);
const EXIT_POOL = pxPath(steppedEllipse(499, 60, 26, 10, 2));
/** Dust turning over in the middle cone — one path, one animation. */
const MOTES = pxPath([
  [214, 72, 1, 1],
  [228, 88, 1, 1],
  [240, 64, 1, 1],
  [232, 106, 1, 1],
  [220, 120, 1, 1],
]);

const VIG = vignettePaths(W, H);

/* ================================================================== *
 * PLANE 1 — sky and roofline, seen through 58 px of glass (parallax 0.82)
 * ================================================================== */

/* Distance bands, same numbers the street uses for the same landmarks. */
const SK_STONE = hazeRamp(
  { hi: "#c2c6d0", base: "#aeb2be", mid: "#a4a8b4", lo: "#9a9eaa", deep: "#828694" },
  0.2,
);
const SK_PLANT = hazeRamp(
  { hi: "#b8b0b0", base: "#a8a0a0", mid: "#9c9494", lo: "#948c8c", deep: "#7a7272" },
  0.34,
);
const SK_TILE = hazeRamp(
  { hi: "#8a5a4e", base: "#75483e", mid: "#6a4036", lo: "#5d382e", deep: "#452720" },
  0.11,
);

/** The church, the tower, the plant. The three things you can see from a fourth floor. */
const SK = {
  spire: pxPath(steppedRoof(494, 506, 70, 16, 0, 2)),
  spireBody: pxPath([[497, 70, 6, 26]]),
  cross: pxPath([
    [499, 50, 2, 5],
    [497, 52, 6, 1],
  ]),
  tower: pxPath([
    [532, 62, 14, 10],
    [530, 60, 18, 2],
    [534, 72, 3, 24],
    [542, 72, 3, 24],
  ]),
  towerCap: pxPath(steppedRoof(530, 548, 60, 7, 0, 2)),
  stack: pxPath([[514, 46, 6, 50]]),
  stackDark: pxPath([[518, 46, 2, 50]]),
  stackBands: pxPath([
    [513, 50, 8, 3],
    [513, 60, 8, 3],
  ]),
  beacon: pxPath([[515, 42, 3, 3]]),
  /** the far ridgeline, which is where the city stops being individual buildings */
  ridge: pxPath([
    [440, 82, 52, 14],
    [552, 78, 48, 18],
    [506, 86, 26, 10],
  ]),
  haze: pxPath([
    [440, 84, 160, 5],
    [440, 89, 160, 7],
  ]),
} as const;

/** One cloud band, off-frame at both ends, on a negative begin so t=0 is not empty. */
const CLOUD = pxPath([
  [430, 56, 34, 5],
  [438, 52, 18, 4],
  [434, 61, 26, 3],
]);

function OutsideFar({ ph, o }: { ph: Ph; o: Outside }) {
  const flat = isFlat(o);
  return (
    <g>
      <PhaseSky id="corridor-sky" phase={ph} width={W} />
      {/* the horizon band the whole roofline mixes toward */}
      {px(430, 80, 180, 26, K.sky[ph][3])}
      {/* one cloud, crossing in four minutes */}
      <g opacity={flat ? 0.9 : 0.68}>
        <path d={CLOUD} fill={ph === "night" || ph === "dusk" ? "#6a7080" : "#e8ecf0"} />
        <path d={pxPath([[434, 61, 26, 3]])} fill={ph === "night" ? "#565c6a" : "#c4cbd4"} />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;220 0"
          dur="240s"
          begin="-90s"
          repeatCount="indefinite"
        />
      </g>
      {/* the far ridge, and the haze that puts it behind everything else */}
      <path d={SK.ridge} fill={SK_STONE[ph].lo} />
      <path d={SK.haze} fill={dth("c", "50")} opacity={flat ? 0.5 : 0.28} />
      {/* the church: spire, cross, and a clock that is slow */}
      <path d={SK.spireBody} fill={SK_STONE[ph].base} />
      <path d={SK.spire} fill={SK_TILE[ph].mid} />
      <path d={SK.cross} fill={SK_STONE[ph].hi} />
      {/* the water tower */}
      <path d={SK.tower} fill={SK_PLANT[ph].base} />
      <path d={SK.towerCap} fill={SK_PLANT[ph].lo} />
      {/* the heating plant, its bands, and the beacon on the top of the stack */}
      <path d={SK.stack} fill={SK_PLANT[ph].base} />
      <path d={SK.stackDark} fill={SK_PLANT[ph].lo} />
      <path
        d={SK.stackBands}
        fill={dim({ ...SK_PLANT[ph], base: "#c05050" }, K.sky[ph][3], 0.3).base}
      />
      <path d={SK.beacon} fill={K.ledRed}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="1;0.15;1;1"
          dur="2.6s"
          begin="-1.1s"
          repeatCount="indefinite"
        />
      </path>
      {/* the plume, which stands up in cold air instead of drifting off */}
      {[0, 4.2].map((d) => (
        <path key={d} d={pxPath([[512, 34, 8, 6]])} fill={dth("c", "25")} opacity={0}>
          <animate
            attributeName="opacity"
            values="0;0.4;0"
            begin={`${d}s`}
            dur="11s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values={isSnow(o) ? "0 0;2 -6;4 -12;6 -18" : "0 0;8 -5;18 -11;30 -17"}
            begin={`${d}s`}
            dur="11s"
            repeatCount="indefinite"
          />
        </path>
      ))}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the block opposite, thirty metres out (parallax 0.94)
 * ================================================================== */

const OPP_MAT: Mat = {
  hi: "#ddd3c0",
  base: "#cfc4ae",
  mid: "#c4baa4",
  lo: "#b8ad97",
  deep: "#9a9078",
};
const OPP = hazeRamp(OPP_MAT, 0.12);
/** Their windows, in courses, because they are always in courses. */
const OPP_WINDOWS = pxPath([...bank([[464, 78, 7, 8]], 6, 20), ...bank([[464, 94, 7, 8]], 6, 20)]);
const OPP_SILLS = pxPath([...bank([[463, 86, 9, 2]], 6, 20), ...bank([[463, 102, 9, 2]], 6, 20)]);
/** Three of them awake, on three cycles, so the block wakes unevenly. */
const OPP_LIT = [
  pxPath([
    [464, 78, 7, 8],
    [524, 94, 7, 8],
  ]),
  pxPath([[504, 78, 7, 8]]),
  pxPath([
    [544, 78, 7, 8],
    [484, 94, 7, 8],
  ]),
] as const;
const OPP_PARAPET = pxPath([[456, 70, 150, 4]]);
const OPP_DISH = pxPath([
  [576, 80, 8, 8],
  [579, 88, 2, 4],
]);
const OPP_PIGEONS = pxPath([
  [498, 66, 5, 4],
  [506, 67, 4, 3],
  [560, 66, 5, 4],
]);
/** Rain and snow, on the far side of the glass, where they belong. */
const OUT_RAIN = pxPath([
  [438, 46, 1, 6],
  [456, 58, 1, 6],
  [474, 50, 1, 6],
  [492, 66, 1, 6],
  [512, 54, 1, 6],
  [530, 70, 1, 6],
  [548, 48, 1, 6],
  [566, 62, 1, 6],
]);
const OUT_SNOW = pxPath([
  [440, 44, 2, 2],
  [462, 56, 1, 1],
  [480, 48, 2, 2],
  [500, 68, 1, 1],
  [518, 52, 2, 2],
  [536, 72, 1, 1],
  [554, 46, 2, 2],
  [572, 60, 1, 1],
]);

function OutsideBlock({ ph, o }: { ph: Ph; o: Outside }) {
  const dark = ph === "night" || ph === "dusk";
  const snow = isSnow(o);
  return (
    <g>
      {/* the block that has been opposite since 2006 */}
      {px(456, 70, 150, 40, OPP[ph].base)}
      <rect x={456} y={70} width={150} height={40} fill="url(#px-roller)" opacity={0.5} />
      <path d={OPP_PARAPET} fill={OPP[ph].lo} />
      {px(456, 70, 150, 1, OPP[ph].hi)}
      {px(456, 90, 150, 2, OPP[ph].mid)}
      <path d={OPP_WINDOWS} fill={dark ? "#2b3138" : K.glass[ph]} />
      <path d={OPP_SILLS} fill={OPP[ph].hi} />
      {dark
        ? OPP_LIT.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lit-window groups are static
            <path key={i} d={d} fill={K.glassLit} opacity={0.9}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values={["0.9;0.9;0.9;0.25", "0.9;0.25;0.9;0.9", "0.25;0.9;0.9;0.9"][i]}
                dur={`${170 + i * 43}s`}
                begin={`-${40 + i * 25}s`}
                repeatCount="indefinite"
              />
            </path>
          ))
        : null}
      {/* one of them has a television on, and it is the same one every night */}
      {dark ? (
        <rect x={526} y={96} width={5} height={5} fill="#9fc7d6" opacity={0.5}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.5;0.2;0.45;0.15;0.5"
            dur="2.2s"
            begin="-0.7s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {/* their dish, and the pigeons that sit on their parapet and not ours */}
      <path d={OPP_DISH} fill={dark ? "#7a7a74" : "#d8d5cc"} />
      {!dark ? (
        <g>
          <path d={OPP_PIGEONS} fill={K.pigeon} />
          <path d={pxPath([[498, 66, 5, 1]])} fill={K.pigeonHi} />
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;3 0;3 0;-2 0;0 0"
            dur="9.4s"
            begin="-3s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {snow ? <path d={pxPath([[456, 69, 150, 2]])} fill={K.snow} /> : null}
      {/* the weather, on the outside of the glass */}
      {o.weather === "rain" ? (
        <g>
          <path d={OUT_RAIN} fill={K.rain} opacity={0.45} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-6 40"
            dur="1.3s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {snow ? (
        <g>
          <path d={OUT_SNOW} fill={K.snow} opacity={0.8} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-14 44"
            dur="4.6s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {o.weather === "overcast" ? (
        <rect x={430} y={40} width={180} height={70} fill="#9aa4ac" opacity={0.16} />
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the landing itself. Hitboxes resolve here.
 * ================================================================== */

function Ceiling({ ph, lit }: { ph: Ph; lit: boolean }) {
  const c = CEILING[ph];
  return (
    <g>
      {px(0, 0, W, CEIL, c.base)}
      <rect x={0} y={0} width={W} height={CEIL} fill="url(#px-grain)" opacity={0.5} />
      {/* a 600 mm grid, which is what a suspended ceiling is */}
      <path d={CEIL_GRID} fill={c.mid} />
      <path d={CEIL_CROSS} fill={c.mid} />
      {px(0, CEIL - 3, W, 3, c.lo)}
      {px(0, CEIL - 3, W, 1, c.mid)}
      {/* two access hatches, and the one they never seated flat again */}
      <Bev set={CEIL_HATCHES} mat={{ ...c, base: c.mid, hi: c.base }} />
      <AOSet set={PANEL_LIFT} op={0.7} />
      {/* the fittings */}
      <Bev set={SPOT_HOUSINGS} mat={dim(M.tin, c.base, 0.4)} />
      <path d={SPOT_LENSES} fill={lit ? K.warmHi : "#cfcdc6"} />
      {/* the one over the window has been cold for a year and nobody has reported
          it, because that end of the landing has the window and the lift light */}
      {px(496, 40, 8, 2, K.ledDead)}
      {/* smoke detector, blinking the way they do at 3 a.m. */}
      {px(152, 34, 16, 6, c.base)}
      {px(152, 34, 16, 1, c.hi)}
      {px(154, 32, 12, 2, c.hi)}
      {px(156, 40, 8, 1, c.lo)}
      <rect x={158} y={37} width={2} height={2} fill={K.ledRed}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0;0;1;0;0"
          dur="8s"
          begin="-2.6s"
          repeatCount="indefinite"
        />
      </rect>
      {/* extract grille, furred with dust on the leeward side of every fin */}
      {px(300, 33, 34, 8, c.lo)}
      {px(300, 33, 34, 1, c.mid)}
      <path d={VENT_FINS} fill={c.deep} />
      <rect x={300} y={33} width={34} height={8} fill="url(#px-grain)" />
      {px(302, 41, 30, 1, "#a8a49a")}
      {/* the cable tray nobody was supposed to see, and its zip-tie tail */}
      <path d={TRAY} fill={c.deep} />
      {px(346, 40, 1, 4, "#4a4d52")}
    </g>
  );
}

/** The dropped bulkhead over the lift, and the downlight in it. */
function LiftSoffit({ ph }: { ph: Ph }) {
  const c = CEILING[ph];
  return (
    <g>
      <Bev set={SOFFIT_BOX} mat={{ ...c, base: c.mid, hi: c.base }} />
      {px(418, SOFFIT + 1, 72, 2, c.lo)}
      <AOSet set={SOFFIT_AO} op={0.8} />
      {px(LOBBY_SPOT - 6, SOFFIT - 2, 12, 3, dim(M.tin, c.base, 0.4).base)}
      <path d={SOFFIT_LENS} fill={K.warmHi} />
    </g>
  );
}

function Walls({ ph, o }: { ph: Ph; o: Outside }) {
  const p = PLASTER[ph];
  const g = GRAPHITE[ph];
  return (
    <g>
      {/* upper wall, rollered by one man in an afternoon — and holed for the
          window, which is the whole reason the far plane is visible at all */}
      <path d={WALL_UPPER_D} fill={p.base} />
      {WALL_UPPER.map((r) => (
        <rect
          key={`${r[0]}-${r[1]}`}
          x={r[0]}
          y={r[1]}
          width={r[2]}
          height={r[3]}
          fill="url(#px-roller)"
        />
      ))}
      {px(0, CEIL, W, 1, p.hi)}
      {/* the floor numeral, and the trolley that went through it */}
      <path d={NUMERAL_4} fill={p.lo} />
      <path d={NUMERAL_SCUFF} fill={p.mid} />
      {/* the ghost of the bigger frame that hung here before the print */}
      {px(234, 54, 42, 50, p.hi)}
      {px(234, 54, 42, 1, p.base)}
      <path d={ANCHOR_HOLES} fill={p.deep} opacity={0.6} />
      {/* the conduit dropping to the riser, and the vent down by the skirting */}
      <path d={CONDUIT} fill={dim(M.tin, p.base, 0.35).base} />
      {/* graphite accent band, hiding the trunking */}
      {px(0, BAND, W, 6, g.base)}
      {px(0, BAND, W, 1, g.hi)}
      {px(0, BAND + 5, W, 1, g.deep)}
      <path d={DRIP} fill={g.mid} />
      {/* lower wall, scuffed where prams and trolleys pass */}
      <path d={WALL_LOWER} fill={p.mid} />
      <rect x={0} y={BAND + 6} width={W} height={SKIRT - BAND - 6} fill="url(#px-roller)" />
      <path d={WALL_SCUFFS} fill={K.scuff} opacity={0.5} />
      {/* filled and not repainted; overpainted twice and still legible */}
      {px(268, 116, 12, 10, K.patch)}
      {px(268, 116, 12, 1, "#e6e2d8")}
      <path d={GRAFFITI} fill={K.overpaint} opacity={0.55} />
      <Bev set={WALL_VENT} mat={dim(M.tin, p.mid, 0.4)} />
      <path d={WALL_VENT_FINS} fill={p.deep} />
      {/* skirting. No cove light in it: a lit line running the full 14.7 m read
          as a seam between two planes rather than as a fitting, so it is gone. */}
      {px(0, SKIRT, W, 6, g.base)}
      {px(0, SKIRT, W, 1, g.hi)}
      {px(0, SKIRT + 4, W, 1, g.deep)}
      <rect x={0} y={CEIL} width={W} height={SKIRT - CEIL} fill="url(#px-grain)" />
      {/* and the damp bloom under the sill, from the winter the seal went */}
      {isWet(o) || isSnow(o) ? px(490, 106, 26, 12, dim(p, K.water, 0.18).lo, "damp") : null}
    </g>
  );
}

/**
 * The floor plaque and the flat directory. Same enamelled blue plate the street
 * uses for its block numbers, so a plaque reads as a plaque in both scenes — and
 * the number is BigText at k=2, because 2× is the only scale that keeps the pixel
 * font on the grid.
 */
function Wayfinding({ ph }: { ph: Ph }) {
  const plate = { ...STEEL[ph], base: K.plaqueBlue, hi: K.plaqueBlueHi };
  return (
    <g>
      <Bev set={PLAQUE} mat={plate} />
      {px(69, 55, 16, 18, "#2a5a94")}
      {px(71, 57, 12, 1, K.white)}
      <BigText x={73} y={59} text="4" fill={K.white} k={2} />
      {/* the directory: three flats, and the arrow to the flight down */}
      <Bev set={PLATE_WAY} mat={plate} />
      {px(69, 79, 16, 20, "#2a5a94")}
      <PixelText x={71} y={81} text="13" fill={K.white} gap={0} op={0.85} />
      <PixelText x={71} y={88} text="14" fill={K.white} gap={0} op={0.85} />
      <PixelText x={71} y={95} text="15" fill={K.white} gap={0} op={0.85} />
      {px(79, 84, 5, 1, K.white)}
      {px(82, 83, 1, 3, K.white)}
      {/* and the screw somebody over-tightened, which has cracked the enamel */}
      {px(84, 97, 2, 2, "#8a9298")}
    </g>
  );
}

function NoticeBoard({ ph, read }: { ph: Ph; read: boolean }) {
  return (
    <g>
      <Bev set={BOARD} mat={OAK[ph]} />
      <rect x={168} y={54} width={34} height={44} fill="url(#px-wood)" />
      <AOSet set={BOARD_AO} op={0.75} />
      <Bev set={BOARD_PAPERS} mat={LINEN[ph]} />
      <path d={BOARD_LINES} fill="#8a8d92" opacity={0.7} />
      <path d={BOARD_PINS} fill={K.noticeFlag} />
      {/* the one about the water being off, from March */}
      {px(189, 60, 9, 2, "#a33a30")}
      {px(174, 79, 10, 2, "#3f5b7a")}
      {/*
       * The association posts the same notice at both ends of the stairwell, so
       * this is the sheet the street's klatka shows through its glass. Unread it
       * is square and flagged; read, it has been up long enough to curl.
       */}
      <g style={{ transition: STEP_FADE, opacity: read ? 0 : 1 }}>
        {px(196, 56, 4, 4, K.noticeFlag)}
      </g>
      <g style={{ transition: STEP_FADE, opacity: read ? 1 : 0 }}>
        {px(196, 56, 4, 4, OAK[ph].mid)}
        {px(196, 56, 4, 1, OAK[ph].hi)}
      </g>
    </g>
  );
}

function FramedPrint({ ph }: { ph: Ph }) {
  return (
    <g>
      <Bev set={PRINT_FRAME} mat={GRAPHITE[ph]} />
      <AOSet set={PRINT_AO} op={0.7} />
      {px(243, 63, 22, 32, LINEN[ph].hi)}
      {px(245, 65, 18, 28, "#f0eee8")}
      {/* a cheap abstract: a horizon, a sun, three strokes */}
      {px(247, 72, 14, 11, "#7a8f9f")}
      {px(247, 72, 14, 4, "#8ea3b2")}
      {px(256, 68, 5, 5, K.brass)}
      {px(247, 85, 14, 3, TIN[ph].mid)}
      {px(249, 89, 8, 1, TIN[ph].base)}
      {/* glass catching the near spot, dust on the top rail, one corner low */}
      <path
        d={pxPath([
          [245, 88, 8, 1],
          [247, 82, 10, 1],
          [251, 74, 8, 1],
        ])}
        fill="#ffffff"
        opacity={0.12}
      />
      {px(240, 58, 28, 2, GRAPHITE[ph].hi)}
      {px(242, 59, 24, 1, "#c9c7bf")}
      {px(266, 96, 2, 3, GRAPHITE[ph].mid)}
    </g>
  );
}

function StairWindow({ ph, o }: { ph: Ph; o: Outside }) {
  const cold = isCold(o, ph);
  /** The blind comes further down after dark, the way people do it. */
  const blindH = ph === "night" ? 26 : ph === "dusk" ? 18 : 12;
  const slats = BLIND_SLATS.filter((y) => y < APER.y0 + blindH - 2);
  return (
    <g>
      {/* the glass: a tint and three reflections, so you see the city through it */}
      {px(APER.x0, APER.y0, APER.x1 - APER.x0, APER.y1 - APER.y0, K.glass[ph], "glass")}
      <rect
        x={APER.x0}
        y={APER.y0}
        width={APER.x1 - APER.x0}
        height={APER.y1 - APER.y0}
        fill={K.glass[ph]}
        opacity={0.18}
      />
      <path d={WIN_REFLECT} fill="#ffffff" opacity={ph === "night" ? 0.08 : 0.16} />
      {/* condensation, low in the pane, on the cold nights */}
      {cold ? px(APER.x0, 84, APER.x1 - APER.x0, 12, "#cfe0ea", "cond") : null}
      {cold ? px(APER.x0, 84, 26, 12, "#cfe0ea", "cond2") : null}
      {/* the roller blind, one slat bent since the handle went */}
      {px(APER.x0, APER.y0, APER.x1 - APER.x0, blindH, LINEN[ph].base)}
      {px(APER.x0, APER.y0, APER.x1 - APER.x0, 1, LINEN[ph].hi)}
      {px(APER.x0, APER.y0 + blindH - 2, APER.x1 - APER.x0, 2, LINEN[ph].lo)}
      <path
        d={pxPath(slats.map((y) => [APER.x0, y, APER.x1 - APER.x0, 1] as Rect))}
        fill={LINEN[ph].mid}
      />
      {px(516, APER.y0 + blindH - 4, 12, 1, LINEN[ph].deep)}
      {/* the pull cord, which swings when the door of 15 goes */}
      <g>
        {px(521, APER.y0 + blindH, 1, 9, LINEN[ph].lo)}
        {px(520, APER.y0 + blindH + 9, 3, 2, LINEN[ph].mid)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 521 ${APER.y0 + blindH};0 521 ${APER.y0 + blindH};2.5 521 ${APER.y0 + blindH};-1.5 521 ${APER.y0 + blindH};0 521 ${APER.y0 + blindH}`}
          dur="19s"
          begin="-6s"
          repeatCount="indefinite"
        />
      </g>
      {/* the frame: a head, two jambs, a mullion and a bottom rail */}
      <path d={WIN_RAILS} fill={dim(M.tin, PLASTER[ph].base, 0.45).base} />
      <path d={WIN_RAILS_HI} fill={dim(M.tin, PLASTER[ph].base, 0.45).hi} />
      <AOSet set={WIN_REVEAL_AO} op={0.85} />
      {/* the handle somebody painted over */}
      {px(524, 70, 5, 3, PLASTER[ph].base)}
      {/* the sill */}
      <Bev set={WIN_SILL} mat={dim(M.tin, PLASTER[ph].base, 0.3)} />
      <AOSet set={SILL_AO} op={0.8} />
      {/* the burn from whoever smokes out of this window, and their tin */}
      {px(534, 92, 4, 2, "#6b5f4c")}
      {px(532, 88, 10, 6, TIN[ph].base)}
      {px(532, 88, 10, 1, TIN[ph].hi)}
      {px(534, 90, 6, 2, TIN[ph].deep)}
      {/* a wasp that got in in August and did not get out */}
      {px(546, 92, 3, 2, "#8a6d2f")}
      {px(546, 92, 1, 2, "#2e3033")}
      {/* a pigeon feather caught in the gasket */}
      {px(490, 91, 5, 1, LINEN[ph].mid)}
      {px(489, 90, 2, 3, LINEN[ph].lo)}
      {/* snow on the outer ledge, which is the only snow that gets indoors */}
      {isSnow(o) ? px(486, APER.y1 - 1, 8, 2, K.snow, "ledge") : null}
    </g>
  );
}

/** The cat that used to own the stairwell and now owns the sill. */
function SillCat({ ph }: { ph: Ph }) {
  const asleep = ph === "night" || ph === "dusk";
  const coat = "#4a4440";
  const coatHi = "#5a534e";
  return (
    <g>
      {/* somebody puts a saucer out. Nobody admits to it. */}
      {px(552, 92, 6, 4, TIN[ph].base)}
      {px(552, 92, 6, 1, TIN[ph].hi)}
      {px(553, 93, 4, 2, "#7d97a8")}
      {asleep ? (
        <g>
          {px(500, 88, 24, 8, coat)}
          {px(500, 88, 24, 2, coatHi)}
          {px(518, 84, 9, 8, coat)}
          {px(519, 82, 3, 3, coat)}
          {px(524, 82, 3, 3, coat)}
          {px(520, 87, 2, 1, K.brass)}
          {px(524, 87, 2, 1, K.brass)}
          <rect x={496} y={93} width={7} height={3} fill={coat}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 503 94;-9 503 94;3 503 94;0 503 94"
              dur="8.4s"
              begin="-2s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x={504} y={86} width={12} height={4} fill={coatHi}>
            <animate attributeName="y" values="86;85;86" dur="4.8s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <g>
          {px(504, 84, 11, 12, coat)}
          {px(504, 84, 11, 2, coatHi)}
          {px(503, 76, 12, 9, coat)}
          {px(503, 73, 4, 4, coat)}
          {px(504, 78, 2, 2, "#8fa86a")}
          {px(511, 78, 2, 2, "#8fa86a")}
          {px(507, 81, 2, 1, "#b98b86")}
          {px(502, 93, 5, 3, coat)}
          <g>
            {px(515, 88, 3, 8, coat)}
            {px(515, 93, 7, 3, coat)}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 516 90;-6 516 90;4 516 90;-3 516 90;0 516 90"
              dur="6.2s"
              begin="-1.4s"
              repeatCount="indefinite"
            />
          </g>
          <rect x={510} y={73} width={4} height={4} fill={coat}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 512 77;0 512 77;-20 512 77;0 512 77;0 512 77"
              dur="9.5s"
              begin="-4s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      )}
    </g>
  );
}

/* --- doors ------------------------------------------------------------ */

/** Yours: anthracite steel, bar handle, and a number the developer chose. */
function Door14({ ph, s }: { ph: Ph; s: CorridorState }) {
  const warm = ph === "night" || ph === "dusk";
  return (
    <g>
      <Bev set={D14_FRAME} mat={STEEL[ph]} />
      <AOSet set={D14_AO} op={0.8} />
      <Bev set={D14_LEAF} mat={GRAPHITE[ph]} />
      <Bev
        set={D14_PANELS}
        mat={{ ...GRAPHITE[ph], base: dim(M.graphite, "#ffffff", 0.08).base }}
      />
      {/* bar handle centred on 1.15 m, lock below it, spyhole at 1.60 m */}
      {px(54, HANDLE_Y - 14, 3, 30, TIN[ph].base)}
      {px(54, HANDLE_Y - 14, 3, 2, TIN[ph].hi)}
      {px(50, HANDLE_Y + 22, 4, 3, STEEL[ph].mid)}
      {px(32, SPY_Y, 3, 3, "#2e3033")}
      {px(32, SPY_Y, 3, 1, STEEL[ph].base)}
      <path d={T_14} fill={LAMINATE[ph].base} />
      {/* the no-adverts sticker, half scraped off by somebody's thumbnail */}
      {px(44, 130, 12, 8, LAMINATE[ph].mid)}
      {px(46, 132, 8, 1, "#8a8d92")}
      {px(46, 135, 6, 1, "#8a8d92")}
      {px(52, 130, 4, 3, GRAPHITE[ph].mid)}
      {/* the courier's card, tucked in the frame until you take the parcel */}
      <g style={{ transition: STEP_FADE, opacity: s.parcel === "taken" ? 1 : 0 }}>
        {px(62, 110, 5, 8, K.courier)}
        {px(62, 110, 5, 2, "#d8a810")}
      </g>
      {/* warm line under your own door in the evening */}
      <g style={{ transition: STEP_FADE, opacity: warm ? 1 : 0 }}>
        {px(26, 147, 34, 2, "#ffcf7a")}
      </g>
    </g>
  );
}

/** 13: white laminate, brass knob, a dog, a small child, a lot of life. */
function Door13({ ph, s }: { ph: Ph; s: CorridorState }) {
  const on = s.d13 === "awake";
  return (
    <g>
      <Bev set={D13_FRAME} mat={STEEL[ph]} />
      <AOSet set={D13_AO} op={0.8} />
      <Bev set={D13_LEAF} mat={LAMINATE[ph]} />
      <Bev set={D13_PANELS} mat={{ ...LAMINATE[ph], base: LAMINATE[ph].mid }} />
      {px(152, HANDLE_Y, 4, 5, K.brass)}
      {px(152, HANDLE_Y + 4, 4, 2, M.brass.lo)}
      {px(128, SPY_Y, 3, 3, "#2e3033")}
      <path d={T_13} fill={STEEL[ph].base} />
      {/* the wreath that has outlasted three seasons */}
      {px(132, 88, 14, 14, M.leaf.base)}
      {px(134, 90, 10, 10, LAMINATE[ph].mid)}
      {px(131, 92, 3, 6, M.leaf.mid)}
      {px(144, 92, 3, 6, M.leaf.mid)}
      {px(137, 86, 5, 4, "#a33a30")}
      {/* stickers at the height of whoever put them there */}
      {px(126, 130, 5, 5, "#e8c445")}
      {px(133, 132, 4, 4, "#4a90d9")}
      {px(139, 129, 5, 4, "#c94040")}
      {/* and the smudges at the height of whoever waits to go out */}
      {px(122, 138, 10, 6, LAMINATE[ph].lo)}
      {px(124, 140, 4, 2, LAMINATE[ph].deep)}
      {/* the dog, on the other side of it, when the flat is out */}
      {s.d13 === "out" ? (
        <g>
          {px(122, 140, 3, 4, "#7a6a55")}
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;0 0;0 0;2 0;0 0;-1 0;0 0"
            dur="14s"
            begin="-5s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* light under the door, and somebody crossing it now and then */}
      <g style={{ transition: STEP_FADE, opacity: on ? 1 : 0 }}>
        {px(122, 147, 34, 2, "#ffcf7a")}
        <rect x={128} y={147} width={9} height={2} fill="#5d4a30">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;18 0;0 0;0 0"
            keyTimes="0;0.7;0.78;0.86;1"
            dur="26s"
            begin="-9s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
    </g>
  );
}

/** 15: oak veneer, quiet people, a newspaper at dawn, a child growing. */
function Door15({ ph, s, o }: { ph: Ph; s: CorridorState; o: Outside }) {
  return (
    <g>
      <Bev set={D15_FRAME} mat={STEEL[ph]} />
      <AOSet set={D15_AO} op={0.8} />
      <Bev set={D15_LEAF} mat={OAK[ph]} />
      <Bev set={D15_PANELS} mat={{ ...OAK[ph], base: OAK[ph].mid }} />
      <rect x={320} y={72} width={36} height={78} fill="url(#px-wood)" />
      {px(324, HANDLE_Y + 2, 28, 1, OAK[ph].deep)}
      {px(348, HANDLE_Y, 4, 5, GRAPHITE[ph].hi)}
      {px(326, SPY_Y, 3, 3, "#2e3033")}
      <path d={T_15} fill={OAK[ph].deep} />
      {/* the sticker they actually mean */}
      {px(332, 118, 16, 9, LAMINATE[ph].base)}
      {px(334, 120, 12, 1, "#a33a30")}
      {px(334, 123, 9, 1, "#8a8d92")}
      {/* pencil, on the architrave, twice a year */}
      <path d={HEIGHT_MARKS} fill="#8a8578" opacity={0.8} />
      {/* the felt pad that stops it banging at six in the morning */}
      {px(356, 108, 3, 3, LINEN[ph].lo)}
      {/* the morning paper, and the takeaway menu at the other end of the day */}
      <g style={{ transition: STEP_FADE, opacity: s.d15 === "paper" ? 1 : 0 }}>
        {px(340, 136, 12, 14, LINEN[ph].base)}
        {px(340, 136, 12, 2, LINEN[ph].hi)}
        {px(342, 140, 8, 1, "#8a8d92")}
        {px(342, 143, 6, 1, "#8a8d92")}
      </g>
      <g style={{ transition: STEP_FADE, opacity: s.d15 === "menu" ? 1 : 0 }}>
        {px(336, 146, 18, 4, LINEN[ph].mid)}
        {px(336, 146, 18, 1, LINEN[ph].hi)}
        {px(340, 148, 6, 1, "#a33a30")}
      </g>
      {/* the umbrella, open to dry, when it has been raining out there */}
      <g style={{ transition: STEP_FADE, opacity: isWet(o) ? 1 : 0 }}>
        {px(358, 128, 12, 14, "#2b4f9e")}
        {px(358, 128, 12, 2, "#3a63bd")}
        {px(363, 142, 2, 8, "#2e3033")}
        {px(361, 149, 6, 1, K.waterHi)}
      </g>
      {/* light under the door whenever anybody is up in there */}
      <g style={{ transition: STEP_FADE, opacity: s.d15 === "quiet" ? 0 : 1 }}>
        {px(320, 147, 34, 2, "#ffcf7a")}
      </g>
    </g>
  );
}

/* --- the lift --------------------------------------------------------- */

/** The car, one metre behind the doors, so it lives on the wall plane. */
function LiftCar({ ph }: { ph: Ph }) {
  const x0 = LIFT.x0;
  const w = LIFT.x1 - LIFT.x0;
  return (
    <g>
      {px(x0, LIFT.head, w, LIFT.sill - LIFT.head, GRAPHITE[ph].base)}
      {px(x0, LIFT.head, w, 5, K.warmHi)}
      {/* mirror, and your own blurred reflection standing where you stand */}
      {px(x0 + 2, LIFT.head + 8, w - 4, 52, "#7d8a92")}
      {px(x0 + 4, LIFT.head + 10, w - 8, 48, "#8e9aa2")}
      {px(x0 + 12, LIFT.head + 20, 12, 40, "#6d7a84")}
      {px(x0 + 14, LIFT.head + 12, 8, 9, "#7d8a92")}
      {px(x0 + 2, 102, w - 4, 2, TIN[ph].base)}
      {/* the ad frame, empty since the agency folded */}
      {px(x0 + 3, LIFT.head + 4, 10, 14, GRAPHITE[ph].mid)}
      {px(x0 + 5, LIFT.head + 6, 6, 10, GRAPHITE[ph].hi)}
      {/* buttons on the side wall — 4 is lit because you are on 4 */}
      {px(464, 84, 8, 26, GRAPHITE[ph].lo)}
      <path d={CAR_BUTTONS} fill={STEEL[ph].base} />
      {px(466, 88, 4, 3, K.warm)}
      {px(x0, 124, w, 22, GRAPHITE[ph].lo)}
      {px(x0, 124, w, 1, GRAPHITE[ph].hi)}
      {/* the free paper somebody left on the floor */}
      {px(x0 + 8, 138, 14, 6, LINEN[ph].mid)}
      {px(x0 + 8, 138, 14, 1, LINEN[ph].hi)}
    </g>
  );
}

/** The doors, the indicator, and the button worn shiny in the middle. */
function LiftFront({ ph, s }: { ph: Ph; s: CorridorState }) {
  const open = s.lift === "open";
  const called = s.lift === "called";
  const slide = 18 - 1;
  return (
    <g>
      {/* the shaft behind, so an open door is a hole and not a grey rect */}
      {px(LIFT.x0, LIFT.head, LIFT.x1 - LIFT.x0, LIFT.sill - LIFT.head, "#14161a")}
      {open ? <LiftCar ph={ph} /> : null}
      <AOSet set={LIFT_JAMB_AO} op={0.9} />
      {/* leaves. Four-pixel steps, because a leaf that slides smoothly is a leaf
          that spends 640 ms not being pixel art. */}
      <g style={{ transition: STEP_SLIDE, transform: open ? `translateX(-${slide}px)` : "none" }}>
        <Bev set={LEAF_L} mat={STEEL[ph]} />
        {px(LIFT.x0 + 2, LIFT.head + 2, 2, 72, STEEL[ph].hi)}
        {px(LIFT.x0 + 16, LIFT.head + 2, 1, 72, STEEL[ph].mid)}
      </g>
      <g style={{ transition: STEP_SLIDE, transform: open ? `translateX(${slide}px)` : "none" }}>
        <Bev set={LEAF_R} mat={STEEL[ph]} />
        {px(LIFT.x1 - 4, LIFT.head + 2, 2, 72, STEEL[ph].hi)}
        {px(LIFT.x0 + 19, LIFT.head + 2, 1, 72, STEEL[ph].mid)}
        <path d={LEAF_DENT} fill={STEEL[ph].lo} />
      </g>
      {/* the meeting stile, dark, so the closed pair reads as two leaves */}
      {px(LIFT.x0 + 17, LIFT.head, 2, LIFT.sill - LIFT.head, open ? "#14161a" : "#2b2e32")}
      {/* the portal: rails around the opening */}
      <path d={LIFT_RAILS} fill={STEEL[ph].base} />
      <path d={LIFT_RAILS_HI} fill={STEEL[ph].hi} />
      {px(428, LIFT.sill, 52, 2, STEEL[ph].mid)}
      {/* the indicator. One segment of the display has been dead for months. */}
      {px(444, 52, 24, 11, "#14161a")}
      {px(444, 52, 24, 1, GRAPHITE[ph].lo)}
      {open ? (
        <g>
          <PixelText x={450} y={55} text="4" fill={K.green} />
          {px(458, 55, 3, 1, K.green)}
          {px(459, 56, 1, 3, K.green)}
        </g>
      ) : (
        <g>
          {/* one path, one animation, four floors — and when it has been called,
              it counts twice as fast, which is the only feedback a lift gives */}
          <path d={IND_SEQUENCE[0]} fill={called ? K.ledAmber : K.brass}>
            <animate
              attributeName="d"
              calcMode="discrete"
              values={IND_SEQUENCE.join(";")}
              dur={called ? "5.5s" : "11s"}
              repeatCount="indefinite"
            />
          </path>
          <path d={IND_ARROW} fill={called ? K.ledAmber : K.brass}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.2;1"
              dur={called ? "0.7s" : "1.4s"}
              repeatCount="indefinite"
            />
          </path>
        </g>
      )}
      {px(451, 57, 1, 1, "#14161a")}
      {/* call button, and the inspection sticker that expired in April */}
      <Bev set={CALL_BOX} mat={STEEL[ph]} />
      {px(483, 95, 6, 6, open || called ? K.green : LAMINATE[ph].base)}
      {px(484, 96, 4, 4, open || called ? "#7bf0ae" : LAMINATE[ph].lo)}
      {px(482, 110, 8, 6, LINEN[ph].base)}
      {px(483, 112, 6, 1, "#a33a30")}
    </g>
  );
}

/** The A4 by the lift, and the older one curling underneath it. */
// The lift notice, drawn but not hung — the call site at the bottom of the
// file is still commented out while the board art is settled.
// @ts-expect-error TS6133
function _LiftNotice({ ph }: { ph: Ph }) {
  return (
    <g>
      {px(410, 72, 16, 21, LINEN[ph].lo)}
      {px(412, 70, 16, 22, LINEN[ph].base)}
      {px(412, 70, 16, 1, LINEN[ph].hi)}
      {px(414, 73, 12, 2, "#a33a30")}
      <path d={pxPath([78, 81, 84].map((y) => [414, y, 11, 1] as Rect))} fill="#8a8d92" />
      {px(414, 87, 7, 1, "#8a8d92")}
      {px(411, 69, 6, 3, "#d8e4ec")}
      {/* the bottom corner has come unstuck and the draft knows it */}
      <g>
        {px(424, 88, 4, 4, LINEN[ph].mid)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 424 88;0 424 88;-14 424 88;2 424 88;0 424 88"
          dur="13s"
          begin="-4.5s"
          repeatCount="indefinite"
        />
      </g>
      {/* the call point beside it. 90 mm, which is very nearly nothing. */}
      <Bev set={ROP} mat={{ ...M.red, base: "#b03a2c", hi: "#c9503f" }} />
      {px(422, 98, 2, 2, K.white)}
    </g>
  );
}

/* --- wall fittings ---------------------------------------------------- */

function Intercom({ ph }: { ph: Ph }) {
  return (
    <g>
      <Bev set={INTERCOM_BOX} mat={GRAPHITE[ph]} />
      {px(90, 77, 14, 14, "#141a24")}
      {/* standby, with the occasional look at whoever is downstairs */}
      <g>
        {px(91, 78, 12, 12, "#1b3a5c")}
        {px(93, 81, 4, 9, "#2b5aa8")}
        {px(98, 84, 3, 6, "#24406e")}
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.62;0.66;0.78;0.82;1"
          dur="42s"
          begin="-14s"
          repeatCount="indefinite"
        />
      </g>
      <path d={INTERCOM_GRILLE} fill={GRAPHITE[ph].hi} />
      {px(100, 93, 4, 4, STEEL[ph].base)}
      {/* the lens, and the code somebody wrote on tape beside it */}
      {px(95, 71, 4, 3, GRAPHITE[ph].hi)}
      {px(96, 72, 2, 1, "#8fb0c4")}
      {px(86, 104, 10, 4, LINEN[ph].base)}
      {px(88, 105, 6, 1, "#8a8d92")}
    </g>
  );
}

/**
 * The switch that overrides the sensor. The rocker is static art: the press
 * itself is a transient, and transients live in Effects, because `actionUi` must
 * never reach artKey — see the note at the foot of the file.
 */
function LightSwitch({ ph }: { ph: Ph }) {
  return (
    <g>
      <Bev set={SWITCH_BOX} mat={LAMINATE[ph]} />
      {px(110, 91, 6, 7, LAMINATE[ph].mid)}
      {px(110, 91, 6, 1, LAMINATE[ph].hi)}
      {px(109, 131, 8, 6, LAMINATE[ph].mid)}
      {px(110, 133, 2, 2, STEEL[ph].base)}
      {px(114, 133, 2, 2, STEEL[ph].base)}
      {/* somebody charges their phone from the corridor socket. Still here. */}
      {px(112, 137, 4, 3, LAMINATE[ph].hi)}
      {px(113, 140, 2, 8, "#e2e0da")}
      {px(113, 147, 6, 2, "#e2e0da")}
    </g>
  );
}

/** The electrical riser: meters, breakers, and a padlock nobody uses. */
function Riser({ ph, stage }: { ph: Ph; stage: RiserStage }) {
  const open = stage === "open";
  return (
    <g>
      <Bev set={RISER_BOX} mat={dim(M.tin, PLASTER[ph].base, 0.4)} />
      <AOSet set={RISER_AO} op={0.7} />
      {open ? (
        <g>
          {px(206, 70, 30, 50, GRAPHITE[ph].lo)}
          {px(208, 72, 26, 14, GRAPHITE[ph].deep)}
          <Bev set={RISER_BREAKERS} mat={LAMINATE[ph]} />
          <path d={RISER_TRIPPED} fill="#a33a30" />
          {px(208, 90, 26, 16, TIN[ph].base)}
          {px(210, 93, 22, 8, GRAPHITE[ph].deep)}
          <path d={T_METER} fill={LAMINATE[ph].mid} />
          <rect x={230} y={102} width={2} height={2} fill={K.ledRed}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0;0;1"
              dur="1.9s"
              begin="-0.6s"
              repeatCount="indefinite"
            />
          </rect>
          {px(208, 108, 26, 10, GRAPHITE[ph].base)}
          {px(210, 110, 8, 6, STEEL[ph].base)}
          {/* the step-ladder somebody keeps in here, against the rules */}
          {px(222, 106, 3, 14, TIN[ph].lo)}
          {px(226, 108, 3, 12, TIN[ph].lo)}
          {/* the door itself, swung flat against the wall */}
          {px(196, 68, 8, 54, PLASTER[ph].lo)}
          {px(196, 68, 2, 54, PLASTER[ph].base)}
        </g>
      ) : (
        <g>
          {px(206, 70, 30, 50, PLASTER[ph].lo)}
          {px(206, 70, 30, 1, PLASTER[ph].base)}
          {px(206, 94, 30, 1, PLASTER[ph].deep)}
          {/* the little window over the meter */}
          {px(212, 76, 18, 10, GRAPHITE[ph].deep)}
          {px(213, 77, 16, 8, "#3a4148")}
          <path d={T_METER_SHUT} fill={stage === "tripped" ? "#c94040" : "#8fa86a"} />
          {/* hasp, padlock, warning triangle */}
          {px(232, 90, 4, 8, STEEL[ph].base)}
          {px(231, 94, 6, 5, STEEL[ph].lo)}
          {px(210, 102, 14, 12, M.enamel.base)}
          {px(210, 102, 14, 1, M.enamel.hi)}
          {px(216, 106, 2, 5, "#2e3033")}
          {px(216, 112, 2, 1, "#2e3033")}
          {/* an electrician's sticker, and a takeaway's over the top of it */}
          {px(226, 104, 9, 6, LINEN[ph].base)}
          {px(227, 106, 7, 1, "#a33a30")}
          {px(228, 110, 7, 4, "#4a90d9")}
        </g>
      )}
    </g>
  );
}

/** Fire point: extinguisher behind glass, blanket, the plan, and the hatched box. */
function FirePoint({ ph, open }: { ph: Ph; open: boolean }) {
  return (
    <g>
      {/* the evacuation plan, which is the law and which nobody has read */}
      <Bev set={EVAC_PLAN} mat={{ ...STEEL[ph], base: K.plaqueBlue, hi: K.plaqueBlueHi }} />
      {px(390, 56, 26, 10, "#dfe6ee")}
      <path d={EVAC_GRID} fill="#7d8792" opacity={0.8} />
      {px(404, 61, 6, 2, "#2e8a4a")}
      {px(409, 60, 2, 4, "#2e8a4a")}
      <Bev set={EXT_BOX} mat={M.red} />
      <AOSet set={EXT_AO} op={0.7} />
      {open ? (
        <g>
          {px(390, 72, 26, 40, M.red.deep)}
          {px(396, 80, 10, 28, M.red.hi)}
          {px(396, 80, 10, 1, "#e8756a")}
          {px(398, 76, 6, 5, "#2e3033")}
          {px(404, 78, 5, 2, STEEL[ph].base)}
          {px(407, 80, 2, 10, "#2e3033")}
          {px(397, 92, 8, 4, LINEN[ph].base)}
          {/* the folded blanket beside it */}
          {px(408, 96, 8, 12, M.red.mid)}
          {px(408, 96, 8, 2, M.red.hi)}
          {/* the glass door, swung wide */}
          {px(378, 70, 10, 44, "#d8e4ec")}
          {px(378, 70, 2, 44, "#e8f0f5")}
          {px(378, 70, 10, 1, "#f0f6fa")}
        </g>
      ) : (
        <g>
          {px(391, 73, 24, 38, "#c6d6e2")}
          {px(391, 73, 24, 2, "#e8f0f5")}
          {px(396, 80, 9, 26, M.red.mid)}
          {px(398, 76, 6, 5, "#28292c")}
          {px(408, 92, 3, 7, LINEN[ph].base)}
          {/* reflection, quantised into three strokes, and the latch */}
          <path
            d={pxPath([
              [395, 104, 6, 1],
              [398, 94, 8, 1],
              [402, 82, 7, 1],
            ])}
            fill="#ffffff"
            opacity={0.16}
          />
          {px(412, 90, 3, 7, LINEN[ph].base)}
        </g>
      )}
      {/* the sign never goes out, and the tag below it expired in April */}
      {px(392, 62, 22, 8, "#a33a30")}
      <PixelText x={394} y={64} text="PPOZ" fill="#f0eee8" gap={0} op={0.95} />
      {px(400, 116, 8, 5, LINEN[ph].base)}
      {px(401, 118, 6, 1, "#a33a30")}
      {/* the dispenser from 2020, half empty, and the tape where its sign was */}
      <Bev set={SANITISER} mat={{ ...LAMINATE[ph], base: "#dfe4e8" }} />
      {px(404, 124, 4, 7, "#bcd2e0")}
      {px(404, 132, 4, 2, STEEL[ph].lo)}
      {px(402, 116, 8, 1, "#d8d3b8")}
    </g>
  );
}

/** The camera in the ceiling corner, watching the lift and nothing else. */
function Camera({ ph }: { ph: Ph }) {
  return (
    <g>
      <path d={CAMERA} fill={GRAPHITE[ph].base} />
      {px(470, 30, 14, 1, GRAPHITE[ph].hi)}
      {px(476, 38, 3, 2, "#12161b")}
      {px(477, 38, 1, 1, "#c9d8e0")}
      <rect x={482} y={32} width={2} height={2} fill={K.ledRed} opacity={0.7}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.7;0.7;0.2;0.7"
          dur="5.3s"
          begin="-1.9s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — things standing on the tile
 * ================================================================== */

/** The monstera. Droops and yellows if you forget it. */
function Monstera({ watered }: { watered: boolean }) {
  const dark = watered ? "#3f6b46" : "#5a6b46";
  const mid = watered ? "#4e7a52" : "#6b7a4a";
  const hi = watered ? "#63915f" : "#7a8552";
  return (
    <g>
      {/* the pot, and the supermarket price sticker still on the back of it */}
      <Bevel boxes={[[280, 130, 20, 18]]} mat={M.concrete} />
      {px(282, 128, 16, 3, M.concrete.lo)}
      <rect x={280} y={130} width={20} height={18} fill="url(#px-agg)" />
      {px(296, 140, 4, 3, M.linen.base)}
      {px(282, 132, 16, 4, watered ? "#4a3f33" : "#7a6a55")}
      <g style={{ transition: STEP_FADE, opacity: watered ? 0 : 1 }}>
        {px(285, 133, 3, 1, "#8a7a62")}
        {px(291, 134, 4, 1, "#8a7a62")}
      </g>
      <g style={{ transition: STEP_FADE, opacity: watered ? 1 : 0 }}>
        {px(278, 146, 24, 3, "#7d8a8e")}
      </g>
      {/* somebody stubs cigarettes in it, which is its own small tragedy */}
      {px(292, 133, 3, 2, M.linen.base)}
      {px(294, 133, 1, 1, "#4a4438")}
      {/* stems */}
      {px(288, 104, 3, 26, dark)}
      {px(292, 110, 2, 20, dark)}
      {px(285, 112, 2, 18, dark)}
      {/* leaves — lifted when watered, folded down when not. One sway for all. */}
      <g transform={watered ? undefined : "translate(0,6)"} style={{ transition: STEP_DROOP }}>
        <g>
          {px(276, 94, 14, 13, mid)}
          {px(276, 94, 14, 2, hi)}
          {px(280, 98, 3, 7, "#2f4a35")}
          {px(285, 100, 3, 5, "#2f4a35")}
          {px(291, 88, 15, 15, watered ? hi : mid)}
          {px(291, 88, 15, 2, watered ? "#74a26e" : hi)}
          {px(296, 92, 3, 8, "#2f4a35")}
          {px(301, 94, 3, 6, "#2f4a35")}
          {px(282, 84, 10, 10, watered ? hi : "#8a8a52")}
          {px(282, 84, 10, 1, watered ? "#74a26e" : "#9a9a5e")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 289 106;1.5 289 106;-1 289 106;0 289 106"
            dur="9s"
            begin="-3s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      <g style={{ transition: STEP_FADE, opacity: watered ? 1 : 0 }}>
        {px(296, 94, 2, 2, "#bfe0f5")}
        {px(285, 100, 2, 2, "#bfe0f5")}
        {/* a new shoot, tightly rolled */}
        {px(295, 100, 3, 8, "#74a26e")}
      </g>
      <g style={{ transition: STEP_FADE, opacity: watered ? 0 : 1 }}>
        {/* the leaf that gave up, on the tiles */}
        {px(302, 152, 9, 4, K.leafDry)}
        {px(303, 151, 5, 1, "#9a9a5e")}
        {px(276, 118, 6, 6, "#8a8a52")}
      </g>
    </g>
  );
}

/**
 * The pram lives on the landing because it does not fit in the flat. It goes out
 * with them in the daytime, and the recycling bag it hides goes with it. Both
 * states stay mounted and step, so the changeover does not pop.
 */
function PramCluster({ out }: { out: boolean }) {
  return (
    <g>
      <g style={{ transition: STEP_FADE, opacity: out ? 0 : 1 }}>
        <Bevel
          boxes={[[172, 114, 34, 22]]}
          mat={{ hi: "#6b7c8c", base: "#5a6a7a", mid: "#526070", lo: "#475464", deep: "#333f4c" }}
        />
        {px(176, 110, 22, 6, "#4a5866")}
        {px(178, 106, 14, 5, "#3f4b57")}
        {px(174, 136, 9, 9, "#2e3033")}
        {px(194, 136, 9, 9, "#2e3033")}
        {px(176, 138, 5, 5, M.steel.base)}
        {px(196, 138, 5, 5, M.steel.base)}
        {/* the rain cover, bundled on top, never folded properly once */}
        {px(180, 108, 12, 5, "#c9c5ba")}
        {px(180, 108, 12, 1, M.linen.hi)}
        {/* and the mud it brought back up four flights */}
        {px(174, 146, 6, 2, "#6b5f4c")}
        {px(196, 146, 5, 2, "#6b5f4c")}
      </g>
      <g style={{ transition: STEP_FADE, opacity: out ? 1 : 0 }}>
        {/* out. What is left is the bag they meant to take down, and a dummy. */}
        {px(178, 128, 16, 22, "#c9c5ba")}
        {px(178, 128, 16, 2, M.linen.hi)}
        {px(180, 132, 8, 6, "#4a90d9")}
        <rect x={178} y={128} width={16} height={22} fill="url(#px-weave)" />
        {px(204, 166, 4, 3, "#e8a4c0")}
        {px(205, 165, 2, 1, M.linen.base)}
      </g>
    </g>
  );
}

/** Their shoes, the child's scooter, and the dog's bowl. All outside, always. */
function ShoesCluster({ o }: { o: Outside }) {
  return (
    <g>
      {px(163, 142, 9, 8, "#5d4a37")}
      {px(163, 142, 9, 2, "#6d5842")}
      {px(163, 148, 9, 2, "#3f3229")}
      {px(162, 134, 8, 7, M.graphite.base)}
      {px(162, 134, 8, 2, M.graphite.hi)}
      {/* the scooter, folded flat and leaning where it always leans */}
      {px(150, 120, 3, 28, "#c94040")}
      {px(150, 120, 1, 28, "#e05a50")}
      {px(148, 118, 8, 3, M.graphite.base)}
      {px(148, 144, 6, 6, "#2e3033")}
      {px(152, 132, 8, 2, "#c94040")}
      {/* the bowl. Stainless, dented, licked clean. */}
      {px(157, 145, 8, 5, M.tin.base)}
      {px(157, 145, 8, 1, M.tin.hi)}
      {px(158, 146, 6, 2, M.tin.deep)}
      {/* and the slush somebody walked up four flights, when it is that sort of week */}
      <g style={{ transition: STEP_FADE, opacity: isSnow(o) || isWet(o) ? 1 : 0 }}>
        {px(160, 152, 12, 3, K.slush)}
        {px(162, 153, 6, 1, K.waterHi)}
      </g>
    </g>
  );
}

/** The parcel on your mat, or the tape it left behind. */
function ParcelCluster({ taken }: { taken: boolean }) {
  return (
    <g>
      <g style={{ transition: STEP_FADE, opacity: taken ? 0 : 1 }}>
        <Bevel boxes={[[66, 132, 22, 18]]} mat={M.brass} />
        <rect x={66} y={132} width={22} height={18} fill="url(#px-grain)" />
        {px(74, 132, 5, 18, M.brass.deep)}
        {px(66, 138, 22, 1, M.brass.lo)}
        {px(68, 140, 8, 6, M.linen.base)}
        {px(69, 142, 6, 1, "#8a8d92")}
        {px(82, 134, 4, 4, "#c94040")}
      </g>
      <g style={{ transition: STEP_FADE, opacity: taken ? 1 : 0 }}>
        {px(70, 149, 12, 2, M.linen.mid)}
        {px(76, 148, 5, 3, K.brass)}
      </g>
    </g>
  );
}

/* --- Pani Natalia ----------------------------------------------------- */

/**
 * Her kit, which stays on the landing even when she does not. It is drawn at one
 * x and translated, so the bucket slides between her pitch and the wall on
 * STEP_SLIDE instead of teleporting when the hour turns.
 */
function CleaningKit({ ph, parked, working }: { ph: Ph; parked: boolean; working: boolean }) {
  const bx = 366;
  return (
    <g style={{ transition: STEP_SLIDE, transform: parked ? "none" : "translateX(28px)" }}>
      <Bevel boxes={[[bx, 132, 16, 18]]} mat={M.enamel} />
      {px(bx - 1, 131, 18, 3, M.enamel.lo)}
      {px(bx + 3, 135, 10, 3, M.concrete.lo)}
      {px(bx + 4, 135, 4, 1, M.concrete.hi)}
      {px(bx + 2, 128, 12, 4, TIN[ph].base)}
      {/* the water still moving, when she has just been at it */}
      {working ? (
        <rect x={bx + 3} y={135} width={10} height={2} fill="#a8b0ae">
          <animate attributeName="y" values="135;136;135" dur="3.2s" repeatCount="indefinite" />
        </rect>
      ) : null}
      {/* her radio, on the rim, three bars of something from home */}
      {px(bx + 12, 122, 9, 7, GRAPHITE[ph].base)}
      {px(bx + 12, 122, 9, 1, GRAPHITE[ph].hi)}
      {px(bx + 20, 118, 1, 5, TIN[ph].base)}
      <path
        d={pxPath([
          [bx + 14, 126, 1, 2],
          [bx + 16, 125, 1, 3],
          [bx + 18, 127, 1, 1],
        ])}
        fill={K.green}
      >
        <animate
          attributeName="d"
          calcMode="discrete"
          values={[
            pxPath([
              [bx + 14, 126, 1, 2],
              [bx + 16, 125, 1, 3],
              [bx + 18, 127, 1, 1],
            ]),
            pxPath([
              [bx + 14, 125, 1, 3],
              [bx + 16, 127, 1, 1],
              [bx + 18, 124, 1, 4],
            ]),
            pxPath([
              [bx + 14, 127, 1, 1],
              [bx + 16, 124, 1, 4],
              [bx + 18, 126, 1, 2],
            ]),
          ].join(";")}
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
      {/* mop stood in the bucket, handle against the wall, clogs beside it */}
      <g style={{ transition: STEP_FADE, opacity: parked ? 1 : 0 }}>
        {px(bx + 6, 84, 3, 50, OAK[ph].base)}
        {px(bx + 6, 84, 1, 50, OAK[ph].hi)}
        {px(bx + 2, 126, 11, 6, LINEN[ph].lo)}
        {px(bx + 18, 144, 7, 6, "#3a7d84")}
        {px(bx + 18, 144, 7, 1, "#459098")}
        {px(bx + 26, 145, 7, 5, "#3a7d84")}
      </g>
    </g>
  );
}

function WetFloorSign({ ph, up }: { ph: Ph; up: boolean }) {
  const x = 424;
  return (
    <g style={{ transition: STEP_FADE, opacity: up ? 1 : 0 }}>
      <Bevel boxes={[[x, 128, 16, 22]]} mat={M.enamel} />
      {px(x + 14, 130, 4, 20, M.enamel.lo)}
      {px(x + 5, 132, 5, 10, "#2e3033")}
      {px(x + 4, 144, 8, 2, "#2e3033")}
      {px(x + 2, 148, 12, 2, dim(M.enamel, TILE[ph].base, 0.4).lo)}
    </g>
  );
}

/** The bag by 13 at the end of the day, which somebody keeps meaning to take down. */
function RecyclingBag({ out }: { out: boolean }) {
  return (
    <g style={{ transition: STEP_FADE, opacity: out ? 1 : 0 }}>
      {px(108, 134, 14, 16, "#2e3033")}
      {px(108, 134, 14, 2, "#43474c")}
      {px(112, 130, 7, 5, "#2e3033")}
      {px(110, 138, 5, 4, "#4a90d9")}
    </g>
  );
}

/* --- floor ------------------------------------------------------------ */

function Floor({ ph, s, o }: { ph: Ph; s: CorridorState; o: Outside }) {
  const t = TILE[ph];
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, t.base)}
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-satin)" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-agg)" />
      <path d={TILE_JOINTS} fill={t.lo} />
      {px(0, FLOOR, W, 2, t.deep)}
      {px(0, FLOOR + 2, W, 1, t.mid)}
      {/* the sheen along the two lines everybody walks, and nothing else — the
          landing does not hold water even straight after she has been at it */}
      <path
        d={pxPath([
          [60, 156, 90, 1],
          [300, 160, 70, 1],
        ])}
        fill={t.hi}
      />
      {s.pram === "out" ? <path d={PRAM_TRACKS} fill={t.lo} opacity={0.7} /> : null}
      <path d={FLOOR_GRIME} fill={K.gum} opacity={0.55} />
      {/* somebody's child drew here in chalk and somebody's mother half removed it */}
      {px(148, 176, 10, 1, K.chalk)}
      {px(152, 174, 1, 4, K.chalk)}
      {/* the hatched box in front of the fire point, and the four letters that
          fit inside it — the full NIE ZASTAWIAĆ would be 78 px, which is most of
          the way to the lift */}
      <path d={NO_STANDING} fill={K.hazard} opacity={0.35} />
      <PixelText x={394} y={162} text="PPOZ" fill={K.hazard} gap={0} op={0.45} />
      {/* mats: yours coarse, theirs newer */}
      <Bev set={MATS} mat={GRAPHITE[ph]} />
      <rect x={26} y={FLOOR} width={40} height={4} fill="url(#px-weave)" opacity={0.6} />
      <path d={MAT_BRISTLES} fill={GRAPHITE[ph].lo} />
      {/* the wet print off the mats when it is doing something out there */}
      {isWet(o) || isSnow(o) ? (
        <path
          d={pxPath([
            [30, 156, 26, 2],
            [128, 155, 20, 2],
            [326, 156, 22, 2],
          ])}
          fill={K.waterHi}
          opacity={0.18}
        />
      ) : null}
      <Contact set={CONTACTS} />
      {/* the stair flight going down, behind the balustrade */}
      {px(492, 106, 64, 44, "#26282c")}
      <Bev set={TREADS} mat={M.concrete} />
      <path d={NOSINGS} fill={GRAPHITE[ph].lo} />
      {/* a mitten that has been on the third step since February */}
      {px(512, 132, 8, 5, "#c94040")}
      {px(512, 132, 8, 1, "#e05a50")}
      {px(519, 133, 3, 3, "#c94040")}
    </g>
  );
}

function Balustrade({ ph }: { ph: Ph }) {
  return (
    <g>
      <AOSet set={BALUSTRADE_AO} op={0.6} />
      {px(492, 106, 3, 44, STEEL[ph].base)}
      {px(492, 106, 64, 2, STEEL[ph].base)}
      {px(492, 106, 64, 1, STEEL[ph].hi)}
      {px(495, 108, 58, 22, "#d8e4ec")}
      <rect x={495} y={108} width={58} height={22} fill="#0d1016" opacity={0.55} />
      {px(520, 108, 1, 22, "#d8e4ec")}
      {/* the bracket, and the handrail where four hundred hands have been */}
      {px(508, 124, 3, 4, STEEL[ph].lo)}
      {px(500, 106, 30, 1, STEEL[ph].hi)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 5 — Foreground: the near edge of the corridor
 * ================================================================== */

const NEAR_CORNER = bevelPaths([[0, 0, 7, H]]);
const NEAR_CONDUIT = pxPath([
  [60, 6, 200, 3],
  [60, 6, 200, 1],
]);
/** Dust nearer the lens: bigger, and it moves faster, because it is nearer. */
const NEAR_MOTES = pxPath([
  [64, 60, 2, 2],
  [148, 96, 2, 2],
  [268, 44, 2, 2],
  [352, 112, 2, 2],
  [452, 72, 2, 2],
]);

function CorridorFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const o = world
    ? outside(world, ph)
    : { weather: "clear" as Weather, season: "autumn" as Season, lamps: false };
  const p = PLASTER[ph];
  const t = TILE[ph];
  const night = ph === "night";
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
        {/* the near corner of the landing — the wall you have just walked past */}
        <Bev set={NEAR_CORNER} mat={p} />
        {px(6, 0, 1, H, p.deep)}
        {px(7, 0, 2, H, dth("n", "25"))}
        {/* the underside of the ceiling, and the conduit they ran late */}
        {px(0, 0, W, 5, p.deep)}
        {px(0, 5, W, 2, dth("n", "50"))}
        {px(0, 7, W, 1, dth("n", "25"))}
        <path d={NEAR_CONDUIT} fill={M.tin.lo} />
        {/* a sprinkler head, close enough to read as bigger than the ceiling ones */}
        {px(118, 8, 10, 4, M.brass.base)}
        {px(118, 8, 10, 1, M.brass.hi)}
        {px(120, 12, 6, 3, M.brass.lo)}
        {px(122, 15, 2, 3, M.tin.hi)}
        {/* the spider that has been let alone because it is up there */}
        <g>
          {px(150, 8, 1, 14, "#5a5750")}
          {px(148, 22, 4, 3, "#2e2c28")}
          {px(147, 21, 1, 2, "#2e2c28")}
          {px(152, 21, 1, 2, "#2e2c28")}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;0 9;0 4;0 0"
            dur="34s"
            begin="-11s"
            repeatCount="indefinite"
          />
        </g>
        {/* near dust, drifting the wrong way across the frame, because it is near */}
        <g>
          <path d={NEAR_MOTES} fill="#fff6da" opacity={night ? 0.14 : 0.22} />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;-9 12;4 26;-6 8;0 0"
            dur="23s"
            begin="-7s"
            repeatCount="indefinite"
          />
        </g>
        {/* six pixels of tile at the very bottom, to sit the shot behind */}
        {px(0, H - 6, W, 6, t.mid)}
        {px(0, H - 6, W, 1, t.lo)}
        {px(0, H - 3, W, 1, t.deep)}
        {/* a receipt somebody dropped between the lift and their door */}
        {px(36, H - 5, 11, 4, M.linen.hi)}
        {px(38, H - 4, 6, 1, "#a8a49a")}
        {/* and, in that sort of week, the grit that comes in on everybody's boots */}
        {isSnow(o) ? (
          <path
            d={pxPath([
              [92, H - 4, 3, 1],
              [204, H - 3, 2, 1],
              [318, H - 4, 3, 1],
              [446, H - 3, 2, 1],
            ])}
            fill="#8a7a5e"
            opacity={0.6}
          />
        ) : null}
        <Vignette set={VIG} strength={night ? 1 : 0.8} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function CorridorScene({ world, phase }: { world: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = state(world, ph);
  const o = outside(world, ph);
  return (
    <LayeredScene
      /**
       * The roofline is four hundred metres out and the block opposite is thirty,
       * so the lag between them is the only cue that says one is behind the
       * other — and both are only visible because the wall now has a hole in it.
       */
      parallax={{ farBackground: 0.82, middleBackground: 0.94 }}
      farBackground={
        <g>
          {/* mounted once for the whole document — see pixelKit.SharedDefs */}
          <SharedDefs />
          <OutsideFar ph={ph} o={o} />
        </g>
      }
      middleBackground={<OutsideBlock ph={ph} o={o} />}
      ground={
        <g>
          <Ceiling ph={ph} lit />
          <LiftSoffit ph={ph} />
          <Walls ph={ph} o={o} />
          <StairWindow ph={ph} o={o} />
          <NoticeBoard ph={ph} read={s.notice === "read"} />
          <FramedPrint ph={ph} />
          <Wayfinding ph={ph} />
          <Floor ph={ph} s={s} o={o} />
          <Intercom ph={ph} />
          <LightSwitch ph={ph} />
          <Riser ph={ph} stage={s.riser} />
          <FirePoint ph={ph} open={s.ext === "open"} />
          {/* <LiftNotice ph={ph} /> */}
          <Camera ph={ph} />
          {/* the two standby LEDs on this stretch of wall, one animation between them */}
          <path d={STANDBY_LEDS} fill={K.green}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.3;1"
              dur="3.4s"
              begin="-1.1s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      }
      staticObjects={
        <g>
          <Monstera watered={s.plant === "watered"} />
          <PramCluster out={s.pram === "out"} />
          <ShoesCluster o={o} />
          <RecyclingBag out={s.d13 === "awake"} />
          <ParcelCluster taken={s.parcel === "taken"} />
          <SillCat ph={ph} />
          {/* Pani Natalia is an NpcActor now — she lives in the Effects plane,
              where she can hear the dialogue open and stop mopping to answer */}
          <CleaningKit
            ph={ph}
            parked={s.natalia === "away" || s.natalia === "rest"}
            working={s.natalia === "mop" || s.natalia === "wring"}
          />
          <WetFloorSign ph={ph} up={s.natalia === "mop" || s.natalia === "wring"} />
        </g>
      }
      gameplayObjects={
        <g>
          <Door14 ph={ph} s={s} />
          <Door13 ph={ph} s={s} />
          <Door15 ph={ph} s={s} o={o} />
          <LiftFront ph={ph} s={s} />
          <Balustrade ph={ph} />
        </g>
      }
    />
  );
}

/* ================================================================== *
 * effects — the sensor, the window, and what the hour does to a landing
 * ================================================================== */

const NATALIA_MONOLOGUES = [
  "Господи, як же хочеться зараз просто сісти.",
  "Треба буде щось дітям передати, коли поїду.",
  "Ще трохи — і додому. Найкраща частина дня.",
  "Цікаво, яка там погода вдома... Треба ввечері подивитися.",
  "Мама казала, що яблука вже почали достигати. От би зараз домашніх яблук.",
  "Ой, руки вже зовсім сухі від цієї хімії.",
  "Добре, що сьогодні роботи менше. Може, раніше додому піду.",
  "Знову хтось сміття біля дверей залишив... Ну невже важко донести?",
] as const;

/** How dark the landing gets, by phase, with the sensor on and off. */
const SENSOR: Record<Ph, { lit: number; dark: number }> = {
  dawn: { lit: 0.06, dark: 0.28 },
  day: { lit: 0.03, dark: 0.16 },
  dusk: { lit: 0.09, dark: 0.34 },
  night: { lit: 0.13, dark: 0.46 },
};

function CorridorEffects({
  world,
  phase,
  scale,
  actionUi,
  moving,
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
  const o = outside(world, ph);
  const night = ph === "night";
  const dark = night || ph === "dusk";

  /**
   * The sensor. Twenty seconds of nobody moving and it drops the landing. Any
   * interaction counts as movement, which is why the timer restarts on actionUi
   * as well — pressing the switch you can see on the wall should not leave you
   * standing in the dark.
   */
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (moving || actionUi) {
      setIdle(false);
      return;
    }
    const timer = window.setTimeout(() => setIdle(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [moving, actionUi]);

  const busy = s.natalia === "mop" || s.natalia === "wring";
  /* She counts as motion. It is never dark while she is working. */
  const lit =
    s.spots === "on" || (s.spots !== "off" && (!idle || busy || s.traffic >= 2 || !!actionUi));
  const shaft = SHAFT[ph];
  const daylight = ph !== "night" && !isFlat(o);

  /**
   * What she is doing right now. The hour sets the shift — mopping, wringing out
   * at the bucket, a rest on the handle — and a conversation interrupts all of
   * it, because a person stops working to talk to you.
   */
  const natalia =
    s.natalia === "away"
      ? null
      : dialogueOpen
        ? NPCS.natalia.reactions.onTalk
        : s.natalia === "wring"
          ? "wring"
          : s.natalia === "rest"
            ? "rest"
            : "work";

  return (
    <>
      {natalia ? (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0"
        >
          <NpcActor npc={NPCS.natalia} x={368} action={natalia} facing={-1} />
        </svg>
      ) : null}
      {s.natalia !== "away" ? (
        <NpcMonologue
          x={375}
          headY={s.natalia === "wring" ? 86 : 82}
          scale={scale}
          speaker="Pani Natalia"
          lines={NATALIA_MONOLOGUES}
          muted={dialogueOpen}
        />
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
          {/* the sensor's verdict. Flat, so it tints without smearing. */}
          <rect
            width={W}
            height={H}
            fill="#070a10"
            opacity={lit ? SENSOR[ph].lit : SENSOR[ph].dark}
            style={{ transition: STEP_FADE }}
          />

          {/* --- daylight. The window keeps its own light regardless of the sensor,
                 and under cloud there is no shaft at all — only the wash. --- */}
          {daylight && shaft ? <Light set={shaft} /> : null}
          {ph !== "night" && isFlat(o) ? <Light set={DIFFUSE} /> : null}
          {night && o.lamps ? <Light set={LAMP_WASH} /> : null}

          {/* --- the spots, coming up one after another the way they always do --- */}
          {LIVE_SPOTS.map((x, i) => (
            <g
              key={x}
              opacity={lit ? 1 : 0}
              style={{ transition: `opacity ${420 + i * 130}ms steps(3, end)` }}
            >
              <Light set={SPOT_CONES[i]} />
              <Light set={SPOT_POOLS[i]} />
            </g>
          ))}
          <path
            d={SPOT_SOURCES}
            fill={K.warmHi}
            opacity={lit ? 0.95 : 0}
            style={{ transition: STEP_FADE }}
          />
          {/* --- the lobby downlight, which is on the lift's circuit and never
                 goes out. It is the reason the far end is legible at 3 a.m. --- */}
          <g opacity={lit ? 1 : 0.55} style={{ transition: STEP_FADE }}>
            <Light set={LOBBY_CONE} />
            <Light set={LOBBY_POOL} />
            <path d={LOBBY_HALO.halo} fill={dth("w", "12")} opacity={0.3} />
            <path d={LOBBY_HALO.core} fill={K.warmHi} opacity={0.8} />
          </g>

          {/* --- the lift car: 4000 K, cold, and the brightest thing here --- */}
          <g
            opacity={s.lift === "open" ? 1 : 0}
            style={{ transition: "opacity 560ms steps(4, end)" }}
          >
            <Light set={LIFT_WASH} />
          </g>

          {/* --- three doors, three sets of hours, three warm lines on the tile --- */}
          <g opacity={dark ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={UNDER_14} />
          </g>
          <g opacity={s.d13 === "awake" ? 1 : 0} style={{ transition: STEP_FADE }}>
            <Light set={UNDER_13} />
          </g>
          <g opacity={s.d15 === "quiet" ? 0 : 1} style={{ transition: STEP_FADE }}>
            <Light set={UNDER_15} />
          </g>

          {/* --- the small sources: the riser lamp, the intercom, the stairwell --- */}
          {s.riser === "open" ? <Light set={RISER_WASH} op={dark ? 1 : 0.4} /> : null}
          {dark ? <Light set={INTERCOM_WASH} op={0.7} /> : null}
          {s.traffic >= 1 || dark ? <Light set={STAIR_WASH} op={dark ? 1 : 0.35} /> : null}

          {/* --- dust, turning over in the middle cone — one path, one animation --- */}
          {lit ? (
            <g>
              <path d={MOTES} fill="#fff6da" opacity={0.7} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;6 -14;-4 -26;3 -8;0 0"
                dur="17s"
                begin="-5s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* one fly, doing laps, only when it is warm enough to bother */}
          {(ph === "day" || ph === "dusk") && !isSnow(o) ? (
            <g>
              <rect x={230} y={60} width={1} height={1} fill="#2e3033" opacity={0.85} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;18 12;-6 26;14 8;-14 18;0 0"
                dur="7.5s"
                begin="-2.4s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}

          {/* --- emergency wayfinding never sleeps, and a moth has noticed --- */}
          <rect x={486} y={38} width={26} height={8} fill={K.greenDeep} opacity={0.95} />
          <rect x={489} y={40} width={20} height={4} fill={K.green} />
          <path d={EXIT_GLOW.halo} fill={dth("w", "12")} opacity={0.35} />
          <path d={EXIT_POOL} fill={K.green} opacity={dark ? 0.1 : 0.05} />
          {night ? (
            <g>
              <rect x={514} y={40} width={2} height={2} fill="#e8dfc0" opacity={0.8} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;7 -4;-3 5;4 3;0 0"
                dur="4.3s"
                begin="-1.7s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}

          {/* --- transients. None of this is in artKey, which is why it is here. --- */}
          {actionUi === "switch" ? (
            <path d={pxPath([[108, 86, 12, 16]])} fill={dth("w", "25")} opacity={0.5} />
          ) : null}
          {actionUi === "parcel" ? (
            <path d={pxPath(steppedEllipse(77, 146, 20, 5, 2))} fill={dth("w", "25")} opacity={0.4}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.4;0.15;0.4;0.2"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {actionUi === "plant" ? (
            <g>
              {[0, 0.5, 1.1].map((d) => (
                <rect key={d} x={289} y={112} width={1} height={2} fill="#bfe0f5" opacity={0}>
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    begin={`${d}s`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;0 18"
                    begin={`${d}s`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </rect>
              ))}
            </g>
          ) : null}
          {actionUi === "riser" ? (
            <path d={pxPath([[206, 68, 32, 54]])} fill={dth("w", "25")} opacity={0.45} />
          ) : null}
          {actionUi === "extcabinet" ? (
            <path d={pxPath([[388, 70, 30, 44]])} fill={dth("c", "25")} opacity={0.3} />
          ) : null}
          {actionUi === "notice" ? (
            <path d={pxPath([[168, 54, 34, 44]])} fill={dth("w", "12")} opacity={0.4} />
          ) : null}
          {actionUi === "liftdoors" ? (
            <path d={pxPath([[482, 92, 8, 16]])} fill={dth("c", "25")} opacity={0.5}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.5;0.15;0.5"
                dur="0.9s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          <Vignette set={VIG} strength={night ? 0.4 : 0} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition — all 17 original hitboxes at their original x, plus 5 new
 * ================================================================== */

export const CORRIDOR_SCENE: RuntimeSceneDef<WorldState> = {
  id: "corridor",
  width: W,
  /**
   * Every world read the art performs, and nothing else. This scene had no
   * artKey at all, so the art plane repainted on any world change; these are the
   * fifteen reads that can actually alter a pixel — twelve of its own and the
   * three the window borrows from the street.
   */
  artKey: (w, ph) => {
    const p = toPhase(ph);
    const s = state(w, p);
    const o = outside(w, p);
    return [
      ph,
      s.lift,
      s.spots,
      s.natalia,
      s.riser,
      s.parcel,
      s.plant,
      s.ext,
      s.notice,
      s.pram,
      s.d13,
      s.d15,
      s.traffic,
      o.weather,
      o.season,
      o.lamps ? 1 : 0,
    ].join("|");
  },
  objects: [
    /* --- new: the hand-painted floor numeral in the corner --- */
    { id: "floor-numeral", kind: "flavor", x: 10, range: 10 },
    { id: "door-flat", kind: "creakdoor", x: 45, range: 22, to: { scene: "studio", spawnX: 40 } },
    { id: "parcel", kind: "parcel", x: 77, range: 12 },
    { id: "intercom", kind: "flavor", x: 97, range: 10 },
    { id: "switch", kind: "flavor", x: 113, range: 7 },
    { id: "neighbor-a", kind: "flavor", x: 141, range: 16 },
    { id: "shoes", kind: "flavor", x: 166, range: 6 },
    { id: "pram", kind: "flavor", x: 189, range: 14 },
    { id: "riser", kind: "flavor", x: 220, range: 14 },
    { id: "print", kind: "flavor", x: 253, range: 14 },
    { id: "plant", kind: "plant", x: 290, range: 16 },
    /* --- new: the tag, painted over twice, still legible --- */
    { id: "graffiti", kind: "flavor", x: 315, range: 9 },
    { id: "neighbor-b", kind: "flavor", x: 339, range: 14 },
    { id: "pani-natalia", kind: "npc", priority: 2, x: 375, range: 18 },
    { id: "ext-cabinet", kind: "extcabinet", x: 403, range: 14 },
    { id: "notice", kind: "flavor", x: 421, range: 7 },
    {
      id: "lift-doors",
      kind: "liftdoors",
      priority: 1,
      x: 454,
      range: 22,
      to: { scene: "elevator", spawnX: 100 },
    },
    /* --- new: the call button, and the inspection sticker that expired --- */
    { id: "call-button", kind: "flavor", x: 482, range: 6 },
    /* --- new: the window, the tin on the sill, and the wasp --- */
    { id: "stair-window", kind: "flavor", x: 494, range: 6 },
    { id: "stairwell-cat", kind: "flavor", x: 512, range: 12 },
    {
      id: "stairs-down",
      kind: "stairs",
      priority: 1,
      x: 532,
      range: 16,
      to: { scene: "outside", spawnX: 196 },
    },
    /* --- new: the saucer nobody admits to putting out --- */
    { id: "saucer", kind: "flavor", x: 554, range: 6 },
  ],
  Component: ({ world, phase }) => <CorridorScene world={world} phase={phase} />,
  /* the sensor and the palette do the darkening; nothing left for the engine */
  darkness: () => 0,
  Foreground: (p) => <CorridorFront {...p} />,
  Effects: CorridorEffects,
  idleLean: true,
};

/* ==================================================================== *
 * WHAT HAS TO HAPPEN OUTSIDE THIS FILE
 *
 * 1. FIVE TRANSLATION ENTRIES, for the five new ids. Without them the
 *    interaction prompt resolves to the key:
 *
 *        floor-numeral   the 4 somebody painted by hand, and the trolley
 *        graffiti        the tag, painted over twice
 *        call-button     the button, and the sticker that expired in April
 *        stair-window    the glass, the tin, the wasp, the feather
 *        saucer          the saucer nobody admits to
 *
 *    Three existing entries now cover more than they did and are worth a reread:
 *    `notice` also takes in the call point beside it, `switch` also explains that
 *    it overrides the sensor, and `plant` can mention the saucer.
 *
 * 2. FIVE NEW `actionUi` TAGS, if the interaction layer wants the transients
 *    that are already wired in CorridorEffects: "switch", "plant", "riser",
 *    "extcabinet", "notice". The two that already exist — "parcel" and
 *    "liftdoors" — are handled too. Anything not emitted simply never fires;
 *    none of this is in artKey, so none of it costs a repaint.
 *
 * 3. OPTIONAL WORLD KEYS. Nothing here requires a `WorldState` change: every
 *    read goes through `clampStage` / `clampInt` on an untyped record, and the
 *    six legacy booleans (`liftOpen`, `parcelTaken`, `plantWatered`, `extOpen`,
 *    `noticeRead`, `riserOpen`) still win where they are set. If you want the new
 *    stages to be settable, add them to the `corridor` slice with the exported
 *    types above: LiftStage, SpotStage, NataliaStage, RiserStage, ParcelStage,
 *    PlantStage, PanelStage, NoticeStage, PramStage, D13Stage, D15Stage.
 *
 * 4. THE STREET'S SIDE OF THE MIRROR. The street's klatka already reads
 *    `world.corridor.liftOpen`, `.noticeRead` and `.parcelTaken`. Those three
 *    still mean what they meant, because `lift`, `notice` and `parcel` fall back
 *    to them. If you start setting `corridor.lift = "called"`, the street's hall
 *    will show the car away, which is correct — the car is on its way up here.
 *
 * 5. SIX HELPERS THAT ARE NOW IN TWO FILES AND BELONG IN THE KIT. Each is
 *    byte-identical in street.tsx and here, and each is the sort of thing the
 *    next scene will need on its first day:
 *
 *        pixelKit:  bank(shape, n, pitch)        banked repeats with an offset
 *                   BigText                      integer-scaled pixel text
 *                   clampStage / clampInt        the state-reader guards
 *        lightKit:  ramp(mat)                    the four-phase material ramp
 *                   hazeRamp(mat, k)             mix toward the horizon band
 *                   spill / wash(x0,x1,top,…)    an aperture onto the ground
 *
 *    `wash` here and `spill` there differ only in which row they land on; one
 *    helper taking the ground row as an argument covers both. Until they move,
 *    these two files each keep their own copy — this scene must not import from
 *    street.tsx, and street.tsx must not import from this one.
 *
 * ==================================================================== *
 * SECOND PASS — what still made this look like the older scene, and what was
 * done about it. Recorded because the same list will apply to the next scene.
 *
 *   – The far plane was drawn and then painted over. Fixed by holing the wall;
 *     this is the single largest visual change in the file and it cost four
 *     rects. Same class of bug as the klatka door's filled bevel.
 *   – Two-state colour on everything outside. Now four-phase ramps and haze,
 *     which is what makes the block opposite sit behind the glass.
 *   – Five loose booleans where the street has a clamped state machine. Twelve
 *     stages with clock defaults and legacy overrides.
 *   – No artKey. Fifteen listed reads.
 *   – One light source that mattered. Nine, at four temperatures, and the lobby
 *     downlight in particular fixes the "the far end is a black hole at night"
 *     problem without touching the sensor premise.
 *   – Objects appearing and vanishing on a state change: pram, parcel, papers,
 *     umbrella, wet-floor sign, the notice flag. All mounted and stepped now,
 *     which is the pattern the spot cones were already using.
 *   – Every loop started at t=0, so a fresh mount showed five things beginning
 *     at once. Negative `begin` on all of them.
 *   – Vertical dimensions unchecked against the house key: the door leaves were
 *     2.21 m and the lift opening was 1.16 m. 2.05 m and 0.95 m now, with the
 *     lift opening centred on its own hitbox rather than 5 px off it.
 *   – No occlusion. Fourteen aoPaths sets: architraves, sill, board, print,
 *     riser, cabinet, soffit, lift jamb, balustrade.
 *   – Typography was two door numbers and a meter reading. It is now also the
 *     floor plaque, the flat directory, PPOZ, the floor stencil and the lift
 *     indicator — all through PixelText / textPath, none of it hand-drawn.
 *   – The scene could not see the weather it was standing in.
 *
 * PERFORMANCE. Net node count is up about 15% on the first pass, not the 2–3×
 * the detail suggests, because the additions are banked: the ceiling grid is one
 * path where it would have been 24 rects, the blind slats one, the floor stencil
 * one, the letterbox-style breaker rows one, the opposite block's 12 windows two.
 * Animation count went 18 → 36 but 21 of those are calcMode="discrete" with
 * durations over 3 s, which is the cheap kind. The two things worth watching if
 * this scene ever gets slow: the four `url(#px-roller)` rects on the holed wall
 * (they exist because a pattern cannot be applied to a path fill and a hi-line
 * at once), and the six `<Light>` sets that are mounted at opacity 0 for the
 * stepped fade. Both are deliberate and both are cheaper than the alternative.
 * ==================================================================== */
