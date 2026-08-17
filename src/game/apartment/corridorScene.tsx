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
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  repeat,
  type SceneDef,
  SharedDefs,
  STEP_DROOP,
  STEP_FADE,
  STEP_SLIDE,
  steppedCone,
  steppedEllipse,
  steppedQuad,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";

// --- КОРИДОР / a modern Polish landing, floor 4 -------------------------------------

/**
 * Second pass. Same landing, rebuilt to the house standard.
 *
 * Four planes now, where there was one:
 *   middleBackground (0.88) — the world outside the stairwell window. Thirty
 *     metres away, so it barely lags; enough to feel like glass, not a mural.
 *   ground (1.0) — ceiling, walls, window, doors, every wall fitting, the
 *     tile. All hitboxes resolve here.
 *   staticObjects (1.0) — everything standing on the tile: the pram, the
 *     plant, the parcel, Pani Natalia and her bucket.
 *   Foreground (fixed) — the near edge. The corridor's own near corner at the
 *     left, the underside of the ceiling at the top, six pixels of tile at the
 *     bottom, and a spider on a thread that is very nearly in the lens.
 *
 * The lighting premise has not changed and it is still the whole model: this
 * floor has no daylight of its own except the stairwell window, and the ceiling
 * spots are on a twenty-second motion timer. So the window sets the palette —
 * the walls and tile are palette-shifted per phase rather than washed with an
 * overlay — and the sensor decides how much of it you can see. Pani Natalia
 * being on the landing counts as motion, which is why it is never dark while
 * she is working.
 *
 * All light is quantised: stepped cones, dithered edges, stepped floor pools,
 * no gradients and no ellipses anywhere. Transitions run on steps() so a light
 * coming up does it in three visible jumps rather than 460ms of subpixel fade,
 * and the lift leaves slide in four-pixel increments.
 *
 * Budget: ~560 live nodes, ~18 animations depending on phase. The four spot
 * cones account for 20 of those nodes and stay mounted at opacity 0 so the
 * stepped fade has something to fade; everything else static is precomputed to
 * a path at module load.
 */

const W = 560;
const H = 180;

/* Landmark rows. A landing is a stack of horizontal bands and these are them. */
const CEIL = 43; // underside of the suspended ceiling
const BAND = 103; // top of the graphite accent band — dado height, where a pram handle hits
const SKIRT = 144;
const FLOOR = 150; // tile surface
const CY = FLOOR - 2; // where contact shadows sit

/** Ceiling spots. 500 is dead — see Ceiling(). */
const SPOTS = [80, 230, 380, 500] as const;
const LIVE_SPOTS = [80, 230, 380] as const;

/* ================================================================== *
 * palette
 * ================================================================== */

/**
 * The two surfaces that dominate the frame get a real ramp per phase instead
 * of a tint rect over the top. This is the expensive-to-author, cheap-to-draw
 * option, and on a corridor — where 70% of the pixels are wall and floor — it
 * is the one that pays.
 */
const DAWN_CAST = "#8c86a8"; // the violet the sky is before it commits
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
const CEILING = ramp({
  hi: "#f0eee8",
  base: "#e8e6e0",
  mid: "#dcd9d1",
  lo: "#d0cec6",
  deep: "#b8b6ae",
});
const GRAPHITE = ramp(M.graphite);

const K = {
  glass: { dawn: "#c6c0d0", day: "#a8c2d4", dusk: "#c99a72", night: "#232a34" } as Record<
    Ph,
    string
  >,
  sky: { dawn: "#b0aec6", day: "#bcd2e0", dusk: "#d8a478", night: "#1b2029" } as Record<Ph, string>,
  scuff: "#bfbbb0",
  patch: "#ded9cf",
  /** the greige they used for the second overpaint, which was not the greige */
  overpaint: "#cfcabe",
  warm: "#ffd98a",
  green: "#3ddc84",
  amber: "#ff8a3a",
  ledDead: "#c9c7bf",
  brass: M.brass.base,
  leafDry: "#8a8a4a",
  gum: "#2e2c28",
  chalk: "#e2e0da",
} as const;

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/* --- ceiling --- */
const CEIL_SEAMS = pxPath([93, 186, 279, 372, 465].map((x) => [x, 0, 1, CEIL] as Rect));
const SPOT_HOUSINGS = bevelPaths(SPOTS.map((x) => [x - 6, 36, 12, 4] as Rect));
const SPOT_LENSES = pxPath(LIVE_SPOTS.map((x) => [x - 4, 40, 8, 2] as Rect));
const VENT_FINS = pxPath(repeat(6, 5, [303, 35, 2, 5]));
/** the panel that was lifted for the riser survey and never seated back flat */
const PANEL_LIFT = aoPaths([[279, 1, 93]]);

/* --- walls --- */
/** the floor numeral, painted by hand and cropped by the corner */
const NUMERAL_4 = pxPath([
  [0, 54, 5, 30],
  [0, 78, 18, 5],
  [13, 54, 5, 42],
]);
/** where a trolley wheel went through it */
const NUMERAL_SCUFF = pxPath([
  [2, 68, 9, 2],
  [8, 82, 6, 1],
]);
const WALL_SCUFFS = pxPath([
  [172, 128, 40, 6],
  [430, 132, 34, 4],
  [96, 136, 22, 3],
  /* the arc door 13 has worn where it swings past the wall */
  [164, 118, 4, 22],
  [166, 116, 2, 2],
]);
const ANCHOR_HOLES = pxPath([
  [340, 96, 2, 2],
  [352, 96, 2, 2],
  /* and the four from the frame that used to hang here, filled with the wrong filler */
  [234, 56, 2, 2],
  [272, 56, 2, 2],
  [234, 100, 2, 2],
  [272, 100, 2, 2],
]);
/** a tag, painted over twice, still legible if you know it's there */
const GRAFFITI = pxPath([
  [300, 114, 14, 2],
  [300, 118, 3, 8],
  [305, 122, 8, 2],
  [311, 114, 3, 12],
  [298, 126, 18, 2],
]);
/** paint that ran when they cut in the band and nobody came back with a rag */
const DRIP = pxPath([
  [244, 109, 2, 16],
  [245, 125, 1, 5],
]);

/* --- notice board above the pram --- */
const BOARD = bevelPaths([[168, 52, 34, 46]]);
const BOARD_PINS = pxPath([
  [174, 58, 1, 1],
  [190, 57, 1, 1],
  [176, 78, 1, 1],
  [192, 80, 1, 1],
]);
const BOARD_PAPERS = bevelPaths([
  [172, 57, 12, 17],
  [187, 56, 13, 18],
  [173, 77, 14, 16],
  [190, 79, 10, 14],
]);
const BOARD_LINES = pxPath([
  [174, 61, 8, 1],
  [174, 64, 6, 1],
  [174, 67, 9, 1],
  [189, 60, 9, 1],
  [189, 63, 7, 1],
  [175, 81, 10, 1],
  [175, 84, 8, 1],
  [175, 87, 11, 1],
  [192, 83, 6, 1],
]);

/* --- floor --- */
/** large-format tile: joints every 70 across, two courses deep */
const TILE_JOINTS = pxPath([...repeat(8, 70, [70, FLOOR, 1, 30]), [0, 158, W, 1], [0, 174, W, 1]]);
const MATS = bevelPaths([
  [26, FLOOR, 40, 4],
  [124, FLOOR, 34, 3],
  [322, FLOOR, 34, 3],
]);
const MAT_BRISTLES = pxPath(repeat(6, 6, [30, 151, 2, 3]));
/** the gum somebody left in 2023 and the heel-marks around it */
const FLOOR_GRIME = pxPath([
  [210, 168, 3, 2],
  [211, 167, 1, 1],
  [96, 170, 2, 1],
  [148, 172, 6, 1],
  [152, 171, 3, 1],
]);
/** pram wheels, when the pram has been out and back */
const PRAM_TRACKS = pxPath([
  [176, 154, 2, 18],
  [196, 154, 2, 18],
]);

/* --- doors --- */
const D14_FRAME = bevelPaths([[20, 62, 50, 88]]);
const D14_LEAF = bevelPaths([[24, 66, 42, 84]]);
const D14_PANELS = bevelPaths([
  [30, 74, 30, 22],
  [30, 100, 30, 22],
  [30, 126, 30, 16],
]);
const D13_FRAME = bevelPaths([[118, 64, 46, 86]]);
const D13_LEAF = bevelPaths([[122, 68, 38, 82]]);
const D13_PANELS = bevelPaths([
  [126, 74, 30, 30],
  [126, 108, 30, 32],
]);
const D15_FRAME = bevelPaths([[316, 64, 46, 86]]);
const D15_LEAF = bevelPaths([[320, 68, 38, 82]]);
const D15_PANELS = bevelPaths([[324, 74, 30, 66]]);
/** a child measured against the architrave of 15, twice a year, in pencil */
const HEIGHT_MARKS = pxPath([
  [317, 128, 4, 1],
  [317, 121, 4, 1],
  [317, 115, 4, 1],
  [317, 110, 3, 1],
]);
const T_14 = textPath("14", 40, 73);
const T_13 = textPath("13", 138, 70);
const T_15 = textPath("15", 336, 70);
const T_METER = textPath("4152", 212, 93);
const T_METER_SHUT = textPath("4152", 215, 77);
const T_PPOZ = textPath("P", 396, 64);

/* --- lift --- */
const LIFT_PORTAL = bevelPaths([[426, 54, 56, 96]]);
const LEAF_L = bevelPaths([[432, 60, 22, 88]]);
const LEAF_R = bevelPaths([[454, 60, 22, 88]]);
/** Polish ground floor is P, not 0. The car spends its life between P and 4. */
const IND_SEQUENCE = ["P", "1", "2", "3"].map((d) => textPath(d, 446, 45));
const IND_ARROW = pxPath([
  [458, 45, 5, 1],
  [459, 46, 3, 1],
  [460, 47, 1, 1],
]);
/** the dent at kick height, from a wardrobe that went up in 2021 */
const LEAF_DENT = pxPath([
  [466, 124, 6, 3],
  [467, 127, 4, 1],
]);
const CAR_BUTTONS = pxPath(repeat(4, 5, [468, 85, 4, 3], "y"));

/* --- riser --- */
const RISER_BOX = bevelPaths([[204, 64, 34, 56]]);
const RISER_BREAKERS = bevelPaths(repeat(6, 4, [209, 72, 3, 10]));
const RISER_TRIPPED = pxPath([
  [213, 72, 3, 4],
  [221, 72, 3, 4],
]);

/* --- fittings --- */
const INTERCOM_BOX = bevelPaths([[88, 72, 18, 28]]);
const INTERCOM_GRILLE = pxPath(repeat(4, 3, [91, 91, 2, 4]));
const SWITCH_BOX = bevelPaths([
  [108, 88, 10, 13],
  [107, 128, 12, 12],
]);
/** two standby LEDs on one wall, one path, one animation */
const STANDBY_LEDS = pxPath([
  [102, 86, 2, 2],
  [111, 92, 4, 2],
]);
const PRINT_FRAME = bevelPaths([[238, 58, 30, 40]]);
const EXT_BOX = bevelPaths([[388, 70, 30, 44]]);

/* --- window --- */
const WIN_FRAME = bevelPaths([[490, 44, 68, 56]]);
const WIN_SILL = bevelPaths([[490, 96, 68, 4]]);
const SILL_AO = aoPaths([[491, 100, 66]]);
const BLIND_SLATS = [52, 56, 60, 64, 68, 72, 76, 80] as const;

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

/* --- contact shadows, all in one pass --- */
const CONTACTS = contactPaths([
  [280, 26, CY], // plant pot
  [170, 38, CY], // pram
  [64, 26, CY], // parcel
  [158, 20, CY], // shoes, scooter, bowl
]);

/* ================================================================== *
 * light — precomputed, quantised
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
/** the lens itself, so the fitting reads as the source and not just a hole */
const SPOT_SOURCES = pxPath(LIVE_SPOTS.map((x) => [x - 5, 40, 10, 3] as Rect));

/**
 * The window shaft. Daylight rakes down and to the left across the tile; at
 * dusk it goes long and amber, at dawn it is short, high and cold.
 */
const SHAFT: Record<Ph, ReturnType<typeof tiers> | null> = {
  dawn: tiers((s) => steppedQuad(48, 496, 552, FLOOR + 18, 500 - 40 * s, 552, 8), "c", 0.7),
  day: tiers((s) => steppedQuad(48, 496, 552, H, 480 - 60 * s, 556, 8), "c"),
  dusk: tiers((s) => steppedQuad(48, 496, 552, H, 440 - 90 * s, 558, 8), "e", 0.85),
  night: null,
};
/** what the streetlamp manages, which is not much */
const LAMP_WASH = tiers((s) => steppedQuad(48, 500, 548, H, 470 - 30 * s, 552, 8), "c", 0.32);

const EXIT_GLOW = bulbPaths([[499, 42]]);
/** dust turning over in the middle cone — one path, one animation */
const MOTES = pxPath([
  [214, 72, 1, 1],
  [228, 88, 1, 1],
  [240, 64, 1, 1],
  [232, 106, 1, 1],
  [220, 120, 1, 1],
]);

const VIG = vignettePaths(W, H);

/* ================================================================== *
 * state
 * ================================================================== */

/** Optional corridor flags, read defensively so this compiles unchanged. */
function extras(world: WorldState) {
  const c = (world.corridor ?? {}) as unknown as Record<string, boolean | undefined>;
  return {
    riserOpen: !!c.riserOpen,
    noticeRead: !!c.noticeRead,
  };
}

type Mode = "mop" | "rest" | "wring" | "away";

function modeFor(ph: Ph): Mode {
  if (ph === "dawn") return "mop";
  if (ph === "day") return "rest";
  if (ph === "dusk") return "wring";
  return "away";
}

/* ================================================================== *
 * PLANE 1 — outside the window (parallax 0.88)
 * drawn wider than the opening so it never runs dry
 * ================================================================== */

const BLOCK_WINDOWS = pxPath([
  [504, 66, 5, 5],
  [530, 64, 5, 5],
  [522, 84, 5, 5],
]);
const RAIN = pxPath([
  [502, 48, 1, 5],
  [517, 56, 1, 5],
  [534, 64, 1, 5],
  [545, 52, 1, 5],
  [509, 72, 1, 5],
]);

function OutsideView({ ph }: { ph: Ph }) {
  const night = ph === "night";
  return (
    <g>
      {/* sky, and the block that has been opposite since 2006 */}
      {px(482, 40, 84, 66, K.sky[ph])}
      {px(482, 40, 84, 12, night ? "#232a34" : dim(M.tin, K.sky[ph], 0.5).base)}
      {px(494, 58, 54, 48, night ? "#1b2029" : "#8fa8b8")}
      {px(494, 58, 54, 2, night ? "#242b36" : "#9fb6c4")}
      {!night ? (
        <g>
          {px(500, 68, 12, 10, "#7d97a8")}
          {px(524, 64, 14, 12, "#7d97a8")}
          {px(500, 88, 12, 10, "#7d97a8")}
          {/* their dish, and the pigeons that sit on their parapet not ours */}
          {px(540, 70, 7, 7, "#a8a49a")}
          {px(494, 56, 54, 2, "#a8a49a")}
          {px(508, 52, 4, 4, "#6d7278")}
          {px(514, 53, 4, 3, "#6d7278")}
        </g>
      ) : (
        <g>
          {/* three windows awake, one of them watching something */}
          <path d={BLOCK_WINDOWS} fill={K.warm} opacity={0.85}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.85;0.85;0.6;0.85;0.85;0.4;0.85"
              dur="53s"
              repeatCount="indefinite"
            />
          </path>
          {px(516, 72, 5, 5, "#9fc7d6")}
          <rect x={516} y={72} width={5} height={5} fill="#9fc7d6" opacity={0.5}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.5;0.2;0.45;0.15;0.5"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </rect>
          {/* rain, on the outside of the glass where it belongs */}
          <g>
            <path d={RAIN} fill="#9fb6c8" opacity={0.45} />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 44"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </g>
        </g>
      )}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the landing itself. Hitboxes live here.
 * ================================================================== */

function Ceiling({ ph, lit }: { ph: Ph; lit: boolean }) {
  const c = CEILING[ph];
  return (
    <g>
      {px(0, 0, W, CEIL, c.base)}
      <path d={CEIL_SEAMS} fill={c.mid} />
      {px(0, 26, W, 1, c.mid)}
      {px(0, CEIL - 3, W, 3, c.lo)}
      {px(0, CEIL - 3, W, 1, c.mid)}
      {/* the panel they lifted for the riser survey and never seated flat */}
      <AOSet set={PANEL_LIFT} op={0.7} />
      {/* fittings */}
      <Bev set={SPOT_HOUSINGS} mat={dim(M.tin, c.base, 0.4)} />
      <path d={SPOT_LENSES} fill={lit ? "#fff8e0" : "#cfcdc6"} />
      {/* the one over the window has been cold for a year and nobody has
          reported it, because that end of the landing has the window */}
      {px(496, 40, 8, 2, K.ledDead)}
      {/* smoke detector, blinking the way they do at 3am */}
      {px(152, 34, 16, 6, c.base)}
      {px(152, 34, 16, 1, c.hi)}
      {px(154, 32, 12, 2, c.hi)}
      {px(156, 40, 8, 1, c.lo)}
      <rect x={158} y={37} width={2} height={2} fill="#ff5050">
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0;0;1;0;0"
          dur="8s"
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
      {px(410, 38, 60, 2, c.deep)}
      {px(438, 40, 1, 4, "#4a4d52")}
    </g>
  );
}

function Walls({ ph }: { ph: Ph }) {
  const p = PLASTER[ph];
  const g = GRAPHITE[ph];
  return (
    <g>
      {/* upper wall, rollered by one man in an afternoon */}
      {px(0, CEIL, W, BAND - CEIL, p.base)}
      <rect x={0} y={CEIL} width={W} height={BAND - CEIL} fill="url(#px-roller)" />
      {px(0, CEIL, W, 1, p.hi)}
      {/* the floor numeral, and the trolley that went through it */}
      <path d={NUMERAL_4} fill={p.lo} />
      <path d={NUMERAL_SCUFF} fill={p.mid} />
      {/* the ghost of the bigger frame that hung here before the print */}
      {px(232, 52, 42, 52, p.hi)}
      {px(232, 52, 42, 1, p.base)}
      {/* graphite accent band, hiding the trunking */}
      {px(0, BAND, W, 6, g.base)}
      {px(0, BAND, W, 1, g.hi)}
      {px(0, BAND + 5, W, 1, g.deep)}
      <path d={DRIP} fill={g.mid} />
      {/* lower wall, scuffed where prams and trolleys pass */}
      {px(0, BAND + 6, W, SKIRT - BAND - 6, p.mid)}
      <rect x={0} y={BAND + 6} width={W} height={SKIRT - BAND - 6} fill="url(#px-roller)" />
      <path d={WALL_SCUFFS} fill={K.scuff} opacity={0.5} />
      {/* filled and not repainted; overpainted twice and still legible */}
      {px(266, 116, 12, 10, K.patch)}
      {px(266, 116, 12, 1, "#e6e2d8")}
      <path d={GRAFFITI} fill={K.overpaint} opacity={0.55} />
      <path d={ANCHOR_HOLES} fill={p.deep} opacity={0.6} />
      {/* skirting with its LED channel */}
      {px(0, SKIRT, W, 6, g.base)}
      {px(0, SKIRT, W, 1, g.hi)}
      {px(0, SKIRT + 4, W, 1, g.deep)}
      <rect x={0} y={CEIL} width={W} height={SKIRT - CEIL} fill="url(#px-grain)" />
    </g>
  );
}

function NoticeBoard() {
  return (
    <g>
      <Bev set={BOARD} mat={M.wood} />
      <rect x={168} y={52} width={34} height={46} fill="url(#px-wood)" />
      <Bev set={BOARD_PAPERS} mat={M.linen} />
      <path d={BOARD_LINES} fill="#8a8d92" opacity={0.7} />
      <path d={BOARD_PINS} fill="#c94040" />
      {/* the one about the water being off, from March */}
      {px(189, 58, 9, 2, "#a33a30")}
      {px(174, 79, 10, 2, "#3f5b7a")}
    </g>
  );
}

function StairWindow({ ph }: { ph: Ph }) {
  const night = ph === "night";
  // the blind comes further down after dark, the way people do it
  const blindH = night ? 34 : ph === "dusk" ? 24 : 16;
  const slats = BLIND_SLATS.filter((y) => y < 48 + blindH - 2);
  return (
    <g>
      <Bev set={WIN_FRAME} mat={dim(M.tin, PLASTER[ph].base, 0.45)} />
      {px(496, 48, 56, 48, K.glass[ph])}
      {/* the mullion, and the handle somebody painted over */}
      {px(522, 48, 2, 48, M.tin.lo)}
      {px(524, 70, 5, 3, PLASTER[ph].base)}
      {/* condensation, low in the pane, on the cold nights */}
      {night ? px(496, 84, 56, 12, "#cfe0ea", "cond") : null}
      {night ? px(496, 84, 26, 12, "#cfe0ea", "cond2") : null}
      {/* roller blind, one slat bent since the handle went */}
      {px(496, 48, 56, blindH, M.linen.base)}
      {px(496, 48, 56, 1, M.linen.hi)}
      {px(496, 48 + blindH - 2, 56, 2, M.linen.lo)}
      <path d={pxPath(slats.map((y) => [496, y, 56, 1] as Rect))} fill={M.linen.mid} />
      {px(516, 48 + blindH - 4, 12, 1, M.linen.deep)}
      {px(522, 48 + blindH, 2, 5, M.linen.lo)}
      {/* sill */}
      <Bev set={WIN_SILL} mat={dim(M.tin, PLASTER[ph].base, 0.3)} />
      <AOSet set={SILL_AO} op={0.8} />
      {/* the burn from whoever smokes out of this window, and their tin */}
      {px(534, 94, 4, 2, "#6b5f4c")}
      {px(532, 90, 10, 6, M.tin.base)}
      {px(532, 90, 10, 1, M.tin.hi)}
      {px(534, 92, 6, 2, M.tin.deep)}
      {/* a wasp that got in in August and did not get out */}
      {px(546, 94, 3, 2, "#8a6d2f")}
      {px(546, 94, 1, 2, "#2e3033")}
      {/* a pigeon feather caught in the gasket */}
      {px(492, 93, 5, 1, M.linen.mid)}
      {px(491, 92, 2, 3, M.linen.lo)}
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
      {px(554, 92, 6, 4, M.tin.base)}
      {px(554, 92, 6, 1, M.tin.hi)}
      {px(555, 93, 4, 2, "#7d97a8")}
      {asleep ? (
        <g>
          {px(502, 88, 24, 8, coat)}
          {px(502, 88, 24, 2, coatHi)}
          {px(520, 84, 9, 8, coat)}
          {px(521, 82, 3, 3, coat)}
          {px(526, 82, 3, 3, coat)}
          {px(522, 87, 2, 1, K.brass)}
          {px(526, 87, 2, 1, K.brass)}
          <rect x={498} y={93} width={7} height={3} fill={coat}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 505 94;-9 505 94;3 505 94;0 505 94"
              dur="8.4s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x={506} y={86} width={12} height={4} fill={coatHi}>
            <animate attributeName="y" values="86;85;86" dur="4.8s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <g>
          {px(506, 84, 11, 12, coat)}
          {px(506, 84, 11, 2, coatHi)}
          {px(505, 76, 12, 9, coat)}
          {px(505, 73, 4, 4, coat)}
          {px(506, 78, 2, 2, "#8fa86a")}
          {px(513, 78, 2, 2, "#8fa86a")}
          {px(509, 81, 2, 1, "#b98b86")}
          {px(504, 93, 5, 3, coat)}
          <g>
            {px(517, 88, 3, 8, coat)}
            {px(517, 93, 7, 3, coat)}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 518 90;-6 518 90;4 518 90;-3 518 90;0 518 90"
              dur="6.2s"
              repeatCount="indefinite"
            />
          </g>
          <rect x={512} y={73} width={4} height={4} fill={coat}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 514 77;0 514 77;-20 514 77;0 514 77;0 514 77"
              dur="9.5s"
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
function Door14({ ph }: { ph: Ph }) {
  const warm = ph === "night" || ph === "dusk";
  return (
    <g>
      <Bev set={D14_FRAME} mat={M.steel} />
      <Bev set={D14_LEAF} mat={M.graphite} />
      <Bev set={D14_PANELS} mat={{ ...M.graphite, base: "#454850" }} />
      {/* bar handle, lock, spyhole */}
      {px(56, 92, 3, 30, M.tin.base)}
      {px(56, 92, 3, 2, M.tin.hi)}
      {px(52, 124, 4, 3, M.steel.mid)}
      {px(34, 84, 3, 3, "#2e3033")}
      {px(34, 84, 3, 1, M.steel.base)}
      <path d={T_14} fill={M.laminate.base} />
      {/* the no-adverts sticker, half scraped off by somebody's thumbnail */}
      {px(46, 128, 12, 8, M.laminate.mid)}
      {px(48, 130, 8, 1, "#8a8d92")}
      {px(48, 133, 6, 1, "#8a8d92")}
      {px(54, 128, 4, 3, M.graphite.mid)}
      {/* warm line under your own door in the evening */}
      {warm ? px(26, 147, 38, 2, "#ffcf7a", "u14") : null}
    </g>
  );
}

/** 13: white laminate, brass knob, a dog, a small child, a lot of life. */
function Door13({ ph }: { ph: Ph }) {
  const lightsOn = ph === "dusk" || ph === "night";
  return (
    <g>
      <Bev set={D13_FRAME} mat={M.steel} />
      <Bev set={D13_LEAF} mat={M.laminate} />
      <Bev set={D13_PANELS} mat={{ ...M.laminate, base: M.laminate.mid }} />
      {px(152, 104, 4, 5, K.brass)}
      {px(152, 108, 4, 2, M.brass.lo)}
      {px(130, 82, 3, 3, "#2e3033")}
      <path d={T_13} fill={M.steel.base} />
      {/* the wreath that has outlasted three seasons */}
      {px(134, 84, 14, 14, M.leaf.base)}
      {px(136, 86, 10, 10, M.laminate.mid)}
      {px(133, 88, 3, 6, M.leaf.mid)}
      {px(146, 88, 3, 6, M.leaf.mid)}
      {px(139, 82, 5, 4, "#a33a30")}
      {/* stickers at the height of whoever put them there */}
      {px(128, 130, 5, 5, "#e8c445")}
      {px(135, 132, 4, 4, "#4a90d9")}
      {px(141, 129, 5, 4, "#c94040")}
      {/* and the smudges at the height of whoever waits to go out */}
      {px(124, 138, 10, 6, M.laminate.lo)}
      {px(126, 140, 4, 2, M.laminate.deep)}
      {/* light under the door, and somebody crossing it now and then */}
      {lightsOn ? (
        <g>
          {px(122, 147, 38, 2, "#ffcf7a")}
          <rect x={128} y={147} width={9} height={2} fill="#5d4a30">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 0;22 0;0 0;0 0"
              keyTimes="0;0.7;0.78;0.86;1"
              dur="26s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
    </g>
  );
}

/** 15: oak veneer, quiet people, a newspaper at dawn, a child growing. */
function Door15({ ph }: { ph: Ph }) {
  return (
    <g>
      <Bev set={D15_FRAME} mat={M.steel} />
      <Bev set={D15_LEAF} mat={M.oak} />
      <Bev set={D15_PANELS} mat={{ ...M.oak, base: M.oak.mid }} />
      <rect x={320} y={68} width={38} height={82} fill="url(#px-wood)" />
      {px(324, 106, 30, 1, M.oak.deep)}
      {px(350, 104, 4, 5, M.graphite.hi)}
      {px(328, 82, 3, 3, "#2e3033")}
      <path d={T_15} fill={M.oak.deep} />
      {/* the sticker they actually mean */}
      {px(334, 118, 16, 9, M.laminate.base)}
      {px(336, 120, 12, 1, "#a33a30")}
      {px(336, 123, 9, 1, "#8a8d92")}
      {/* pencil, on the architrave, twice a year */}
      <path d={HEIGHT_MARKS} fill="#8a8578" opacity={0.8} />
      {/* the felt pad that stops it banging at six in the morning */}
      {px(358, 106, 3, 3, M.linen.lo)}
      {/* the morning paper, leaning; the takeaway menu, at the other end of the day */}
      {ph === "dawn" ? (
        <g>
          {px(340, 136, 12, 14, M.linen.base)}
          {px(340, 136, 12, 2, M.linen.hi)}
          {px(342, 140, 8, 1, "#8a8d92")}
          {px(342, 143, 6, 1, "#8a8d92")}
        </g>
      ) : null}
      {ph === "dusk" || ph === "night" ? (
        <g>
          {px(336, 146, 18, 4, M.linen.mid)}
          {px(336, 146, 18, 1, M.linen.hi)}
          {px(340, 148, 6, 1, "#a33a30")}
        </g>
      ) : null}
    </g>
  );
}

/* --- the lift --------------------------------------------------------- */

/** The car. One metre behind the doors, so it lives on the wall plane. */
function LiftCar() {
  return (
    <g>
      {px(432, 60, 44, 88, M.graphite.base)}
      {px(432, 60, 44, 6, "#fff8e0")}
      {/* mirror, and your own blurred reflection standing where you stand */}
      {px(434, 66, 40, 60, "#7d8a92")}
      {px(436, 68, 36, 56, "#8e9aa2")}
      {px(446, 78, 14, 46, "#6d7a84")}
      {px(448, 70, 10, 9, "#7d8a92")}
      {px(434, 100, 40, 2, M.tin.base)}
      {/* the ad frame, empty since the agency folded */}
      {px(436, 70, 12, 16, M.graphite.mid)}
      {px(438, 72, 8, 12, M.graphite.hi)}
      {/* buttons — 4 is lit because you are on 4 */}
      {px(466, 82, 8, 26, M.graphite.lo)}
      <path d={CAR_BUTTONS} fill={M.steel.base} />
      {px(468, 85, 4, 3, K.warm)}
      {px(434, 126, 40, 22, M.graphite.lo)}
      {px(434, 126, 40, 1, M.graphite.hi)}
      {/* the free paper somebody left on the floor */}
      {px(452, 140, 14, 6, M.linen.mid)}
      {px(452, 140, 14, 1, M.linen.hi)}
    </g>
  );
}

/** The doors, the indicator, and the button worn shiny in the middle. */
function LiftFront({ open }: { open: boolean }) {
  return (
    <g>
      <Bev set={LIFT_PORTAL} mat={M.steel} />
      {!open ? px(430, 58, 48, 92, "#2b2e32") : null}
      {/* leaves. Four-pixel steps, because a leaf that slides smoothly is a
          leaf that spends 640ms not being pixel art. */}
      <g style={{ transition: STEP_SLIDE, transform: open ? "translateX(-20px)" : "none" }}>
        <Bev set={LEAF_L} mat={M.steel} />
        {px(434, 62, 2, 84, M.steel.hi)}
        {px(448, 62, 1, 84, M.steel.mid)}
      </g>
      <g style={{ transition: STEP_SLIDE, transform: open ? "translateX(20px)" : "none" }}>
        <Bev set={LEAF_R} mat={M.steel} />
        {px(472, 62, 2, 84, M.steel.hi)}
        {px(457, 62, 1, 84, M.steel.mid)}
        {/* the dent at kick height, from a wardrobe that went up in 2021 */}
        <path d={LEAF_DENT} fill={M.steel.lo} />
      </g>
      {open ? px(453, 60, 2, 88, "#14161a", "gap") : null}
      {px(430, 148, 48, 2, M.steel.mid)}
      {/* indicator. One segment of the display has been dead for months. */}
      {px(440, 42, 28, 11, "#14161a")}
      {px(440, 42, 28, 1, M.graphite.lo)}
      {open ? (
        <g>
          <PixelText x={446} y={45} text="4" fill={K.green} />
          {px(454, 45, 3, 1, K.green)}
          {px(455, 46, 1, 3, K.green)}
        </g>
      ) : (
        <g>
          {/* one <path>, one animation, four floors */}
          <path d={IND_SEQUENCE[0]} fill={K.brass}>
            <animate
              attributeName="d"
              calcMode="discrete"
              values={IND_SEQUENCE.join(";")}
              dur="11s"
              repeatCount="indefinite"
            />
          </path>
          <path d={IND_ARROW} fill={K.brass}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.2;1"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      )}
      {px(447, 47, 1, 1, "#14161a")}
      {/* call button, and the inspection sticker that expired in April */}
      {px(484, 92, 8, 14, M.steel.base)}
      {px(484, 92, 8, 1, M.steel.hi)}
      {px(485, 95, 6, 6, open ? K.green : M.laminate.base)}
      {px(486, 96, 4, 4, open ? "#7bf0ae" : M.laminate.lo)}
      {px(484, 110, 8, 6, M.linen.base)}
      {px(485, 112, 6, 1, "#a33a30")}
    </g>
  );
}

/** The A4 by the lift, and the older one curling underneath it. */
function LiftNotice() {
  return (
    <g>
      {px(412, 72, 16, 21, M.linen.lo)}
      {px(414, 70, 16, 22, M.linen.base)}
      {px(414, 70, 16, 1, M.linen.hi)}
      {px(416, 73, 12, 2, "#a33a30")}
      <path d={pxPath([78, 81, 84].map((y) => [416, y, 11, 1] as Rect))} fill="#8a8d92" />
      {px(416, 87, 7, 1, "#8a8d92")}
      {px(413, 69, 6, 3, "#d8e4ec")}
      {/* the bottom corner has come unstuck and the draft knows it */}
      <g>
        {px(426, 88, 4, 4, M.linen.mid)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 426 88;0 426 88;-14 426 88;2 426 88;0 426 88"
          dur="13s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/* --- wall fittings ---------------------------------------------------- */

function Intercom() {
  return (
    <g>
      <Bev set={INTERCOM_BOX} mat={M.graphite} />
      {px(90, 75, 14, 14, "#141a24")}
      {/* standby, with the occasional look at whoever is downstairs */}
      <g>
        {px(91, 76, 12, 12, "#1b3a5c")}
        {px(93, 79, 4, 9, "#2b5aa8")}
        {px(98, 82, 3, 6, "#24406e")}
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.62;0.66;0.78;0.82;1"
          dur="42s"
          repeatCount="indefinite"
        />
      </g>
      <path d={INTERCOM_GRILLE} fill={M.graphite.hi} />
      {px(100, 91, 4, 4, M.steel.base)}
      {/* the lens, and the code somebody wrote on tape beside it */}
      {px(95, 69, 4, 3, M.graphite.hi)}
      {px(96, 70, 2, 1, "#8fb0c4")}
      {px(86, 102, 10, 4, M.linen.base)}
      {px(88, 103, 6, 1, "#8a8d92")}
    </g>
  );
}

function LightSwitch() {
  return (
    <g>
      <Bev set={SWITCH_BOX} mat={M.laminate} />
      {px(110, 91, 6, 7, M.laminate.mid)}
      {px(109, 131, 8, 6, M.laminate.mid)}
      {px(110, 133, 2, 2, M.steel.base)}
      {px(114, 133, 2, 2, M.steel.base)}
      {/* somebody charges their phone from the corridor socket. Still here. */}
      {px(112, 137, 4, 3, M.laminate.hi)}
      {px(113, 140, 2, 8, "#e2e0da")}
      {px(113, 147, 6, 2, "#e2e0da")}
    </g>
  );
}

/** The electrical riser: meters, breakers, and a padlock nobody uses. */
function Riser({ open }: { open: boolean }) {
  return (
    <g>
      <Bev set={RISER_BOX} mat={dim(M.tin, M.plaster.base, 0.4)} />
      {open ? (
        <g>
          {px(206, 66, 30, 52, M.graphite.lo)}
          {px(208, 70, 26, 14, M.graphite.deep)}
          <Bev set={RISER_BREAKERS} mat={M.laminate} />
          <path d={RISER_TRIPPED} fill="#a33a30" />
          {px(208, 88, 26, 16, M.tin.base)}
          {px(210, 91, 22, 8, M.graphite.deep)}
          <path d={T_METER} fill={M.laminate.mid} />
          <rect x={230} y={100} width={2} height={2} fill="#ff5050">
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0;0;1"
              dur="1.9s"
              repeatCount="indefinite"
            />
          </rect>
          {px(208, 106, 26, 10, M.graphite.base)}
          {px(210, 108, 8, 6, M.steel.base)}
          {/* the step-ladder somebody keeps in here, against the rules */}
          {px(222, 104, 3, 14, M.tin.lo)}
          {px(226, 106, 3, 12, M.tin.lo)}
          {/* the door itself, swung flat against the wall */}
          {px(196, 64, 8, 56, M.plaster.lo)}
          {px(196, 64, 2, 56, M.plaster.base)}
        </g>
      ) : (
        <g>
          {px(206, 66, 30, 52, M.plaster.lo)}
          {px(206, 66, 30, 1, M.plaster.base)}
          {px(206, 92, 30, 1, M.plaster.deep)}
          {/* the little window over the meter */}
          {px(212, 74, 18, 10, M.graphite.deep)}
          {px(213, 75, 16, 8, "#3a4148")}
          <path d={T_METER_SHUT} fill="#8fa86a" />
          {/* hasp, padlock, warning triangle */}
          {px(232, 88, 4, 8, M.steel.base)}
          {px(231, 92, 6, 5, M.steel.lo)}
          {px(210, 100, 14, 12, M.enamel.base)}
          {px(210, 100, 14, 1, M.enamel.hi)}
          {px(216, 104, 2, 5, "#2e3033")}
          {px(216, 110, 2, 1, "#2e3033")}
          {/* an electrician's sticker, and a takeaway's over the top of it */}
          {px(226, 102, 9, 6, M.linen.base)}
          {px(227, 104, 7, 1, "#a33a30")}
          {px(228, 108, 7, 4, "#4a90d9")}
        </g>
      )}
    </g>
  );
}

function FramedPrint() {
  return (
    <g>
      <Bev set={PRINT_FRAME} mat={M.graphite} />
      {px(241, 61, 24, 34, M.linen.hi)}
      {px(243, 63, 20, 30, "#f0eee8")}
      {/* a cheap abstract: a horizon, a sun, three strokes */}
      {px(245, 70, 16, 12, "#7a8f9f")}
      {px(245, 70, 16, 4, "#8ea3b2")}
      {px(255, 66, 5, 5, K.brass)}
      {px(245, 84, 16, 3, M.tin.mid)}
      {px(247, 88, 9, 1, M.tin.base)}
      {/* glass catching the near spot, dust on the top rail, one corner low */}
      <path
        d={pxPath([
          [243, 88, 8, 1],
          [245, 82, 10, 1],
          [249, 74, 8, 1],
        ])}
        fill="#ffffff"
        opacity={0.12}
      />
      {px(238, 56, 30, 2, M.graphite.hi)}
      {px(240, 57, 26, 1, "#c9c7bf")}
      {px(266, 96, 2, 3, M.graphite.mid)}
    </g>
  );
}

/** Fire point: extinguisher behind glass, blanket, and the tag that expired. */
function ExtCabinet({ open }: { open: boolean }) {
  return (
    <g>
      <Bev set={EXT_BOX} mat={M.red} />
      {open ? (
        <g>
          {px(390, 72, 26, 40, M.red.deep)}
          {px(396, 80, 10, 28, M.red.hi)}
          {px(396, 80, 10, 1, "#e8756a")}
          {px(398, 76, 6, 5, "#2e3033")}
          {px(404, 78, 5, 2, M.steel.base)}
          {px(407, 80, 2, 10, "#2e3033")}
          {px(397, 92, 8, 4, M.linen.base)}
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
          {px(408, 92, 3, 7, M.linen.base)}
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
          {px(412, 90, 3, 7, M.linen.base)}
        </g>
      )}
      {/* the sign above it never goes out, and the tag below it expired in April */}
      {px(392, 62, 22, 8, "#a33a30")}
      <path d={T_PPOZ} fill="#f0eee8" />
      {px(402, 64, 12, 1, "#f0eee8")}
      {px(402, 67, 8, 1, "#f0eee8")}
      {px(400, 116, 8, 5, M.linen.base)}
      {px(401, 118, 6, 1, "#a33a30")}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — things standing on the tile
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
      {!watered ? px(285, 133, 3, 1, "#8a7a62", "dry1") : null}
      {!watered ? px(291, 134, 4, 1, "#8a7a62", "dry2") : null}
      {watered ? px(278, 146, 24, 3, "#7d8a8e", "saucer") : null}
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
            repeatCount="indefinite"
          />
        </g>
      </g>
      {watered ? (
        <g>
          {px(296, 94, 2, 2, "#bfe0f5")}
          {px(285, 100, 2, 2, "#bfe0f5")}
          {/* a new shoot, tightly rolled */}
          {px(295, 100, 3, 8, "#74a26e")}
        </g>
      ) : (
        <g>
          {/* the leaf that gave up, on the tiles */}
          {px(302, 152, 9, 4, K.leafDry)}
          {px(303, 151, 5, 1, "#9a9a5e")}
          {px(276, 118, 6, 6, "#8a8a52")}
        </g>
      )}
    </g>
  );
}

/**
 * The pram lives on the landing because it does not fit in the flat. It goes
 * out with them in the daytime, and the recycling bag it hides goes with it.
 */
function PramCluster({ ph }: { ph: Ph }) {
  if (ph === "day") {
    return (
      <g>
        {/* out. What is left is the bag they meant to take down, and a dummy. */}
        {px(178, 128, 16, 22, "#c9c5ba")}
        {px(178, 128, 16, 2, M.linen.hi)}
        {px(180, 132, 8, 6, "#4a90d9")}
        <rect x={178} y={128} width={16} height={22} fill="url(#px-weave)" />
        {px(204, 166, 4, 3, "#e8a4c0")}
        {px(205, 165, 2, 1, M.linen.base)}
      </g>
    );
  }
  return (
    <g>
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
  );
}

/** Their shoes, the child's scooter, and the dog's bowl. All outside, always. */
function ShoesCluster() {
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
    </g>
  );
}

/** The parcel on your mat, or the tape it left behind. */
function ParcelCluster({ taken }: { taken: boolean }) {
  if (taken) {
    return (
      <g>
        {px(70, 149, 12, 2, M.linen.mid)}
        {px(76, 148, 5, 3, K.brass)}
        {/* and the courier's note, still stuck to your door */}
        {px(60, 118, 9, 6, M.linen.base)}
        {px(61, 120, 6, 1, "#8a8d92")}
      </g>
    );
  }
  return (
    <g>
      <Bevel boxes={[[66, 132, 22, 18]]} mat={M.brass} />
      <rect x={66} y={132} width={22} height={18} fill="url(#px-grain)" />
      {px(74, 132, 5, 18, M.brass.deep)}
      {px(66, 138, 22, 1, M.brass.lo)}
      {px(68, 140, 8, 6, M.linen.base)}
      {px(69, 142, 6, 1, "#8a8d92")}
      {px(82, 134, 4, 4, "#c94040")}
    </g>
  );
}

/* --- Pani Natalia ----------------------------------------------------- */

/** Her kit, which stays on the landing even when she does not. */
function CleaningKit({ parked }: { parked: boolean }) {
  const bx = parked ? 366 : 394;
  return (
    <g>
      <Bevel boxes={[[bx, 132, 16, 18]]} mat={M.enamel} />
      {px(bx - 1, 131, 18, 3, M.enamel.lo)}
      {px(bx + 3, 135, 10, 3, M.concrete.lo)}
      {px(bx + 4, 135, 4, 1, M.concrete.hi)}
      {px(bx + 2, 128, 12, 4, M.tin.base)}
      {/* the water still moving, when she has just been at it */}
      {!parked ? (
        <rect x={bx + 3} y={135} width={10} height={2} fill="#a8b0ae">
          <animate attributeName="y" values="135;136;135" dur="3.2s" repeatCount="indefinite" />
        </rect>
      ) : null}
      {/* her radio, on the rim, three bars of something from home */}
      {px(bx + 12, 122, 9, 7, M.graphite.base)}
      {px(bx + 12, 122, 9, 1, M.graphite.hi)}
      {px(bx + 20, 118, 1, 5, M.tin.base)}
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
      {parked ? (
        <g>
          {/* mop stood in the bucket, handle against the wall, clogs beside it */}
          {px(bx + 6, 84, 3, 50, M.oak.base)}
          {px(bx + 6, 84, 1, 50, M.oak.hi)}
          {px(bx + 2, 126, 11, 6, M.linen.lo)}
          {px(bx + 18, 144, 7, 6, "#3a7d84")}
          {px(bx + 18, 144, 7, 1, "#459098")}
          {px(bx + 26, 145, 7, 5, "#3a7d84")}
        </g>
      ) : null}
    </g>
  );
}

function WetFloorSign({ x }: { x: number }) {
  return (
    <g>
      <Bevel boxes={[[x, 128, 16, 22]]} mat={M.enamel} />
      {px(x + 14, 130, 4, 20, M.enamel.lo)}
      {px(x + 5, 132, 5, 10, "#2e3033")}
      {px(x + 4, 144, 8, 2, "#2e3033")}
    </g>
  );
}

function Natalia({ x, mode }: { x: number; mode: Mode }) {
  if (mode === "away") return null;
  const bend = mode === "wring";
  const headY = bend ? 88 : 84;
  const swing =
    mode === "mop"
      ? { v: "0;7;-6;0", dur: "3.4s" }
      : mode === "wring"
        ? { v: "14;18;12;14", dur: "2.2s" }
        : { v: "-4;-3;-4", dur: "9s" };
  return (
    <g>
      <g transform={bend ? `translate(0,4) rotate(6 ${x + 13} 148)` : undefined}>
        {/* kerchief, knotted at the nape */}
        {px(x + 7, headY, 12, 4, "#8cc0e0")}
        {px(x + 5, headY + 3, 16, 5, "#7ab0d4")}
        {px(x + 17, headY + 3, 4, 5, "#68a0c6")}
        {px(x + 20, headY + 8, 3, 3, "#68a0c6")}
        {px(x + 6, headY + 2, 3, 2, M.linen.lo)}
        {/* face */}
        {px(x + 7, headY + 8, 12, 9, M.skin.base)}
        {px(x + 7, headY + 14, 12, 3, M.skin.lo)}
        {px(x + 9, headY + 10, 2, 2, "#3d2a1a")}
        {px(x + 14, headY + 10, 2, 2, "#3d2a1a")}
        {px(x + 11, headY + 15, 4, 1, "#b08668")}
        {px(x + 10, headY + 17, 6, 2, M.skin.lo)}
        {/* tunic and apron */}
        {px(x + 4, 103, 18, 24, M.teal.base)}
        {px(x + 4, 103, 18, 2, M.teal.hi)}
        {px(x + 17, 105, 5, 22, M.teal.lo)}
        {px(x + 8, 116, 8, 7, M.teal.lo)}
        {px(x + 8, 116, 8, 1, M.teal.hi)}
        {px(x + 4, 110, 18, 1, M.teal.deep)}
        {/* left arm */}
        {mode === "rest" ? (
          <g>
            {px(x + 1, 105, 4, 12, M.teal.base)}
            {px(x + 1, 115, 5, 4, M.skin.base)}
          </g>
        ) : (
          <g>
            {px(x + 1, 105, 4, 15, M.teal.base)}
            {px(x + 1, 118, 4, 5, M.skin.base)}
          </g>
        )}
        {/* skirt band, legs, boots */}
        {px(x + 5, 127, 16, 6, M.graphite.base)}
        {px(x + 7, 133, 5, 12, M.graphite.hi)}
        {px(x + 14, 133, 5, 12, M.graphite.hi)}
        {px(x + 7, 133, 12, 2, M.graphite.base)}
        {px(x + 5, 145, 8, 5, "#2e3033")}
        {px(x + 14, 145, 8, 5, "#2e3033")}
        {px(x + 5, 145, 17, 1, M.graphite.lo)}
      </g>
      {/* the arm and the mop, which is the part that actually moves */}
      <g>
        {px(x + 21, 105, 4, 11, M.teal.lo)}
        {px(x + 22, 114, 4, 5, M.skin.base)}
        {px(x + 24, 80, 3, 66, M.oak.base)}
        {px(x + 24, 80, 1, 66, M.oak.hi)}
        {px(x + 20, 146, 12, 4, M.linen.lo)}
        {px(x + 20, 148, 12, 2, M.linen.deep)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={swing.v
            .split(";")
            .map((a) => `${a} ${x + 24} 110`)
            .join(";")}
          dur={swing.dur}
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/* --- floor ------------------------------------------------------------ */

function Floor({ ph, mode }: { ph: Ph; mode: Mode }) {
  const t = TILE[ph];
  const wet = mode === "mop" || mode === "wring";
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, t.base)}
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-satin)" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-agg)" />
      <path d={TILE_JOINTS} fill={t.lo} />
      {px(0, FLOOR, W, 2, t.deep)}
      {px(0, FLOOR + 2, W, 1, t.mid)}
      {/* the arc she has just done, still drying */}
      {wet ? (
        <g>
          {px(330, 152, 110, 26, t.hi)}
          <rect x={340} y={156} width={40} height={1} fill="#c9ccc8" opacity={0.6}>
            <animate attributeName="x" values="336;396;336" dur="7s" repeatCount="indefinite" />
          </rect>
          {px(346, 168, 60, 1, t.mid)}
        </g>
      ) : (
        <path
          d={pxPath([
            [60, 156, 90, 1],
            [300, 160, 70, 1],
          ])}
          fill={t.hi}
        />
      )}
      {ph === "day" ? <path d={PRAM_TRACKS} fill={t.lo} opacity={0.7} /> : null}
      <path d={FLOOR_GRIME} fill={K.gum} opacity={0.55} />
      {/* somebody's child drew here in chalk and somebody's mother half removed it */}
      {px(148, 176, 10, 1, K.chalk)}
      {px(152, 174, 1, 4, K.chalk)}
      {/* mats: yours coarse, theirs newer */}
      <Bev set={MATS} mat={M.graphite} />
      <path d={MAT_BRISTLES} fill={M.graphite.lo} />
      <Contact set={CONTACTS} />
      {/* the stair flight going down, behind the balustrade */}
      {px(494, 104, 62, 46, "#26282c")}
      <Bev set={TREADS} mat={M.concrete} />
      <path d={NOSINGS} fill={M.graphite.lo} />
      {/* a mitten that has been on the third step since February */}
      {px(512, 132, 8, 5, "#c94040")}
      {px(512, 132, 8, 1, "#e05a50")}
      {px(519, 133, 3, 3, "#c94040")}
    </g>
  );
}

function Balustrade() {
  return (
    <g>
      {px(492, 100, 3, 50, M.steel.base)}
      {px(492, 100, 64, 2, M.steel.base)}
      {px(492, 100, 64, 1, M.steel.hi)}
      {px(495, 102, 58, 22, "#d8e4ec")}
      <rect x={495} y={102} width={58} height={22} fill="#0d1016" opacity={0.55} />
      {px(520, 102, 1, 22, "#d8e4ec")}
      {/* the bracket, and the handrail where four hundred hands have been */}
      {px(508, 118, 3, 4, M.steel.lo)}
      {px(500, 100, 30, 1, M.steel.hi)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — foreground: the near edge of the corridor
 * ================================================================== */

const NEAR_CORNER = bevelPaths([[0, 0, 7, H]]);

function CorridorFront({ phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const p = PLASTER[ph];
  const t = TILE[ph];
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
        {px(60, 6, 200, 3, M.tin.lo)}
        {px(60, 6, 200, 1, M.tin.base)}
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
        <Vignette set={VIG} strength={0.8} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function CorridorScene({ world, phase }: { world: WorldState; phase?: string }) {
  const c = world.corridor;
  const x = extras(world);
  const ph = toPhase(phase);
  const mode = modeFor(ph);
  return (
    <LayeredScene
      /* the block opposite is thirty metres out; the lag should be felt, not seen */
      parallax={{ middleBackground: 0.88 }}
      middleBackground={
        <g>
          {/* mounted once for the whole document — see pixelKit.SharedDefs */}
          <SharedDefs />
          <OutsideView ph={ph} />
        </g>
      }
      ground={
        <g>
          <Ceiling ph={ph} lit />
          <Walls ph={ph} />
          <NoticeBoard />
          <StairWindow ph={ph} />
          <Floor ph={ph} mode={mode} />
          {c.liftOpen ? <LiftCar /> : null}
          <Intercom />
          <LightSwitch />
          <Riser open={x.riserOpen} />
          <FramedPrint />
          <ExtCabinet open={c.extOpen} />
          <LiftNotice />
          {/* the two standby LEDs on this stretch of wall, one animation between them */}
          <path d={STANDBY_LEDS} fill={K.green}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.3;1"
              dur="3.4s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      }
      staticObjects={
        <g>
          <Monstera watered={c.plantWatered} />
          <PramCluster ph={ph} />
          <ShoesCluster />
          <ParcelCluster taken={c.parcelTaken} />
          <SillCat ph={ph} />
          <Natalia x={362} mode={mode} />
          <CleaningKit parked={mode === "away"} />
          {mode === "mop" ? <WetFloorSign x={424} /> : null}
        </g>
      }
      gameplayObjects={
        <g>
          <Door14 ph={ph} />
          <Door13 ph={ph} />
          <Door15 ph={ph} />
          <LiftFront open={c.liftOpen} />
          <Balustrade />
        </g>
      }
    />
  );
}

/* ================================================================== *
 * effects — the sensor, the window, and what the hour does to a landing
 * ================================================================== */

const NATALIA_MONOLOGUES = [
  "Ой, знову хтось наслідив... тільки ж помила.",
  "Дома яблука вже попадали, мабуть. А я тут підлоги тру.",
  "Спина болить... а Олежко знову дзвонив, грошей просить.",
  "«Pani Natalio, dziękujemy»... А додому коли, хто скаже?",
  "Мама казала — на пів року. Четвертий рік пішов.",
  "Тринадцята квартира знову без капців ходить. Ну добре.",
] as const;

/** How dark the landing gets, by phase, with the sensor on and off. */
const SENSOR: Record<Ph, { lit: number; dark: number }> = {
  dawn: { lit: 0.06, dark: 0.28 },
  day: { lit: 0.03, dark: 0.16 },
  dusk: { lit: 0.09, dark: 0.34 },
  night: { lit: 0.13, dark: 0.46 },
};

function CorridorEffects({
  phase,
  moving,
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
  const mode = modeFor(ph);
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (moving) {
      setIdle(false);
      return;
    }
    const timer = window.setTimeout(() => setIdle(true), 20_000);
    return () => window.clearTimeout(timer);
  }, [moving]);

  /* she counts as motion. It is never dark while she is working. */
  const lit = !idle || mode === "mop" || mode === "wring";
  const shaft = SHAFT[ph];

  return (
    <>
      {mode !== "away" ? (
        <NpcMonologue
          x={375}
          headY={mode === "wring" ? 86 : 82}
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
          {/* the window keeps its own light regardless of the sensor */}
          {shaft ? <Light set={shaft} /> : <Light set={LAMP_WASH} />}
          {/* the spots come up one after another, the way they always do */}
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
            fill="#fff8e0"
            opacity={lit ? 0.95 : 0}
            style={{ transition: STEP_FADE }}
          />
          {/* the LED skirting strip is always on, quietly */}
          <rect x={0} y={SKIRT} width={W} height={2} fill={K.warm} opacity={lit ? 0.35 : 0.22} />
          <rect x={0} y={SKIRT - 2} width={W} height={2} fill={dth("w", "25")} opacity={0.4} />
          {/* dust, turning over in the middle cone — one path, one animation */}
          {lit ? (
            <g>
              <path d={MOTES} fill="#fff6da" opacity={0.7} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;6 -14;-4 -26;3 -8;0 0"
                dur="17s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* one fly, doing laps, only when it is warm enough to bother */}
          {ph === "day" || ph === "dusk" ? (
            <g>
              <rect x={230} y={60} width={1} height={1} fill="#2e3033" opacity={0.85} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;18 12;-6 26;14 8;-14 18;0 0"
                dur="7.5s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* emergency wayfinding never sleeps, and a moth has noticed */}
          <rect x={486} y={38} width={26} height={8} fill="#0d3d24" opacity={0.95} />
          <rect x={489} y={40} width={20} height={4} fill={K.green} />
          <path d={EXIT_GLOW.halo} fill={dth("w", "12")} opacity={0.35} />
          {ph === "night" ? (
            <g>
              <rect x={514} y={40} width={2} height={2} fill="#e8dfc0" opacity={0.8} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;7 -4;-3 5;4 3;0 0"
                dur="4.3s"
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
 * definition — hitbox x and range unchanged from the first pass
 * ================================================================== */

export const CORRIDOR_SCENE: SceneDef<WorldState> = {
  id: "corridor",
  width: W,
  objects: [
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
    { id: "stairwell-cat", kind: "flavor", x: 512, range: 12 },
    {
      id: "stairs-down",
      kind: "stairs",
      priority: 1,
      x: 532,
      range: 16,
      to: { scene: "outside", spawnX: 196 },
    },
  ],
  Component: ({ world, phase }) => <CorridorScene world={world} phase={phase} />,
  /* the sensor and the palette do the darkening; nothing left for the engine */
  darkness: () => 0,
  Foreground: (p) => <CorridorFront {...p} />,
  Effects: CorridorEffects,
  idleLean: true,
};
