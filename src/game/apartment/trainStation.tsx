import { useEffect, useMemo, useState } from "react";
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
  NpcActor,
  npcToActor,
  type Ph,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";
import { SkmUnit } from "./skmTrain";
import {
  armStation,
  boardingOpen,
  CYCLE_S,
  DOOR_X,
  kt,
  STOP_X,
  stationCycleOffsetS,
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
 */

/* ================================================================== *
 * key, palette, geometry
 * ================================================================== */

/** Pixels per metre. Do not change without redrawing everything. */
const PPM = 38;
/** A real dimension, in pixels, rounded to the grid. */
const m = (metres: number) => Math.round(metres * PPM);

/**
 * The platform is 210 m of railway, which is what a four-car SKM platform is,
 * and it is written as that rather than as 2000 so the next person can see what
 * it is meant to be.
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

export interface StationState {
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
  return raw ? { ...DEFAULTS, ...raw } : DEFAULTS;
}

const lampsOn = (s: StationState, ph: Ph) =>
  s.lamps === "on" || (s.lamps === "auto" && (ph === "night" || ph === "dawn"));

/** Who is on the platform at this crowd level. */
function whoIsWaiting(s: StationState) {
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
  };
}

/* ================================================================== *
 * PLANE 1 — the far side of the cutting (parallax 0.30)
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
/** The trunks, one pixel wide, only where a canopy is low enough to show one. */
const TRUNKS = pxPath([90, 430, 760, 1190, 1500, 1880].map((x) => [x - 1, 104, 2, 8] as Rect));

/** The university's roof line, low and long, at the Sopot end. */
const UNIWERSYTET: Rect[] = [
  [430, 94, 210, 14],
  [30, 98, 150, 10],
];
const UNI_SET = bevelPaths(UNIWERSYTET);

function Backdrop({ ph, s }: { ph: Ph; s: StationState }) {
  const night = ph === "night";
  const bands = SKY_SIX[ph];
  const flat = s.weather === "overcast" || s.weather === "rain";
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

      {/* Alchemia, small and hazed, standing over Oliwa */}
      <Bev set={ALCHEMIA_SET} mat={CLAD[ph]} />
      <path d={ALCHEMIA_GRID} fill={CLAD[ph].lo} opacity={0.7} />
      {night ? <path d={ALCHEMIA_LIT} fill="#ffd98a" opacity={0.7} /> : null}
      {!night ? <path d={ALCHEMIA_GRID} fill={K.glass[ph]} opacity={0.25} /> : null}

      {/* the falowiec */}
      <Bev set={FALOWIEC_SET} mat={SLAB[ph]} />
      <path d={FALOWIEC_BANDS} fill={SLAB[ph].lo} opacity={0.55} />
      {night ? <path d={FALOWIEC_LIT} fill="#ffd98a" opacity={0.6} /> : null}

      {/* the university, and then the trees in front of all of it */}
      <Bev set={UNI_SET} mat={dim(CONC[ph], K.sky[ph][3], 0.2)} />
      <path d={TRUNKS} fill={LEAF[ph].deep} />
      <path
        d={TREES_PATH}
        fill={s.season === "autumn" ? "#8a6a34" : s.season === "bare" ? "#6b5f52" : LEAF[ph].base}
        opacity={s.season === "bare" ? 0.5 : 1}
      />
      <path d={TREES_PATH} fill={dth("n", "12")} opacity={0.3} />

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
 * PLANE 2 — the cutting, the fence, the masts (parallax 0.72)
 * ================================================================== */

/** The far wall of the cutting: a concrete retaining wall in 4 m panels. */
const CUT_WALL = pxPath([[0, 112, W, 24]]);
const CUT_PANELS = pxPath(repeat(14, 152, [0, 112, 2, 24] as Rect));
const CUT_COPING = pxPath([[0, 110, W, 3]]);
/** Weeds and buddleia out of the wall, which is what these walls grow. */
const CUT_WEEDS = pxPath([
  [140, 126, 3, 10],
  [143, 124, 2, 12],
  [412, 128, 2, 8],
  [700, 122, 3, 14],
  [703, 126, 2, 10],
  [1180, 128, 2, 8],
  [1466, 124, 3, 12],
  [1820, 127, 2, 9],
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
const MAST_BASES = pxPath(MASTS.map((x) => [x - 4, 130, 14, 8] as Rect));
/** The contact wire and the catenary above it, in the only place they show. */
const WIRES = pxPath([
  [0, 16, W, 1],
  [0, 25, W, 1],
]);

/** The road bridge at the Gdańsk end, carrying Obrońców Wybrzeża over the line. */
const BRIDGE = {
  deck: pxPath([[0, 62, 150, 14]]),
  soffit: pxPath([[0, 76, 150, 4]]),
  parapet: pxPath([[0, 56, 150, 4], ...repeat(8, 18, [4, 44, 3, 13] as Rect)]),
  abutment: pxPath([[104, 80, 46, 56]]),
};

/** Sodium street lamps on the road behind the fence — the warm half of the night. */
const ROAD_LAMPS = [absLamp(180), absLamp(640), absLamp(1100), absLamp(1560)];
function absLamp(x: number): { post: string; head: string; x: number } {
  return {
    x,
    post: pxPath([
      [x, 40, 3, 58],
      [x, 40, 16, 3],
    ]),
    head: pxPath([[x + 12, 40, 10, 5]]),
  };
}

function FarSide({ ph, s, lit }: { ph: Ph; s: StationState; lit: boolean }) {
  const night = ph === "night";
  const wall = CONC[ph];
  return (
    <g>
      {/* the road bridge at the Gdańsk end */}
      <path d={BRIDGE.deck} fill={wall.base} />
      <path d={BRIDGE.soffit} fill={wall.deep} />
      <path d={BRIDGE.parapet} fill={GALV[ph].base} />
      <path d={BRIDGE.abutment} fill={wall.mid} />
      <path d={BRIDGE.abutment} fill={dth("n", "12")} opacity={0.4} />

      {/* street lamps on the road, behind the fence */}
      {ROAD_LAMPS.map((l) => (
        <g key={`rl${l.x}`}>
          <path d={l.post} fill={GALV[ph].lo} />
          <path d={l.head} fill={lit ? "#ffb84a" : GALV[ph].mid} />
          {lit ? <path d={l.head} fill="#ffd98a" opacity={0.5} /> : null}
        </g>
      ))}

      {/* the fence along the boundary */}
      <path d={FENCE_BARS} fill={GALV[ph].mid} opacity={0.9} />
      <path d={FENCE_RAILS} fill={GALV[ph].lo} />

      {/* the retaining wall */}
      <path d={CUT_WALL} fill={wall.base} />
      <path d={CUT_PANELS} fill={wall.deep} opacity={0.6} />
      <path d={CUT_COPING} fill={wall.hi} />
      <path d={CUT_WALL} fill={dth("n", "06")} opacity={0.5} />
      <path
        d={CUT_WEEDS}
        fill={s.season === "bare" ? "#6b5f4a" : LEAF[ph].mid}
        opacity={night ? 0.5 : 0.9}
      />
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
      <path d={MASTS_PATH} fill={GALV[ph].base} />
      <path d={MAST_BASES} fill={CONC[ph].mid} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the track and the platform (parallax 1.0)
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
const SLEEPERS = pxPath(repeat(Math.ceil(W / 23), 23, [0, 132, 13, 16] as Rect));
/** Concrete sleepers, so the ends are pale where the ballast has worn off them. */
const SLEEPER_ENDS = pxPath(repeat(Math.ceil(W / 23), 23, [0, 132, 13, 3] as Rect));

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
/** The yellow line, cast into the coping and repainted over the top of that. */
const PLAT_YELLOW = pxPath([[0, RAIL_Y + 1, W, 4]]);
/** Where the paint has gone: deterministic, so it does not crawl. */
const PLAT_YELLOW_WORN = pxPath(
  Array.from({ length: 46 }, (_, i) => {
    const x = (i * 137) % W;
    return [x, RAIL_Y + 1, 4 + ((i * 7) % 9), 4] as Rect;
  }),
);
/** Tactile studs, 0.60 m back from the edge. */
const PLAT_TACTILE = pxPath(repeat(Math.ceil(W / 8), 8, [2, RAIL_Y + 9, 4, 4] as Rect));
/** Slab joints, every 1.5 m, running back from the edge. */
const PLAT_JOINTS = pxPath(repeat(Math.ceil(W / 57), 57, [0, RAIL_Y + 6, 1, 24] as Rect));
/** The joint parallel to the edge, where the coping beam meets the slabs. */
const PLAT_SEAM = pxPath([[0, RAIL_Y + 15, W, 1]]);

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
/** Boarding hatching under each door position, so the doors have a target. */
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
      <path d={SLEEPERS} fill={night ? "#4a4d52" : "#8e8a80"} />
      <path d={SLEEPER_ENDS} fill={night ? "#5a5d62" : "#a8a49a"} />

      {/* the two rails. The near rail head is the brightest thing here by day. */}
      <path d={RAIL_FAR} fill={night ? "#4f5358" : "#6d7278"} />
      <path d={RAIL_FAR_TOP} fill={night ? K.railTopNight : K.railTop} opacity={0.8} />
      <path d={FASTENINGS} fill={night ? "#3f4348" : "#5f646a"} />
      <path d={RAIL_NEAR} fill={night ? "#54585d" : "#7d8085"} />
      <path d={RAIL_NEAR_TOP} fill={night ? K.railTopNight : K.railTop} />

      {/* the platform */}
      <path d={PLAT_SURFACE} fill={conc.base} />
      <path d={PLAT_SURFACE} fill={dth("n", "06")} opacity={0.45} />
      <path d={PLAT_DRY} fill={conc.hi} opacity={wet ? 0.35 : 0.14} />
      <path d={PLAT_COPING} fill={conc.mid} />
      <path d={PLAT_YELLOW} fill={night ? K.safetyWorn : K.safety} />
      <path d={PLAT_YELLOW_WORN} fill={conc.mid} opacity={0.55} />
      <path d={PLAT_TACTILE} fill={conc.lo} />
      <path d={PLAT_JOINTS} fill={conc.deep} opacity={0.5} />
      <path d={PLAT_SEAM} fill={conc.deep} opacity={0.45} />
      <path d={PLAT_WEAR} fill={dth("n", "12")} opacity={0.5} />
      <path d={PLAT_GUM} fill={night ? "#3a3d42" : "#6f6c66"} opacity={0.7} />
      <path d={STOP_MARKS} fill={conc.hi} opacity={0.55} />
      <path d={BOARD_ZONES} fill={night ? K.safetyWorn : K.safety} opacity={0.62} />
      <path d={PLAT_CHANNEL} fill={conc.deep} />
      <path d={PLAT_GRATES} fill={GALV[ph].deep} />

      {/* what the trees have dropped */}
      {s.season !== "green" ? (
        <path d={LEAVES} fill={s.season === "autumn" ? "#9a6f34" : "#6b5f4a"} opacity={0.8} />
      ) : null}

      {/* rain sheen: the platform goes darker and the rail heads go bright */}
      {wet ? (
        <>
          <rect x={0} y={RAIL_Y} width={W} height={30} fill="#2a3038" opacity={0.22} />
          <path d={RAIL_NEAR_TOP} fill="#e8ecef" opacity={0.5} />
        </>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — platform furniture (parallax 1.0)
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
/** The glazed back, in four bays. */
const SHELTER_GLASS = pxPath([
  [SH.l + 6, SH.head + 6, 96, 62],
  [SH.l + 110, SH.head + 6, SH.r - SH.l - 224, 62],
  [SH.r - 106, SH.head + 6, 96, 62],
]);
/** The perforated bench inside it, at seat height. */
const SHELTER_BENCH = pxPath([
  [SH.l + 20, RAIL_Y - 5, SH.r - SH.l - 40, 4],
  [SH.l + 20, RAIL_Y - 1, SH.r - SH.l - 40, 2],
  /* the legs */
  [SH.l + 34, RAIL_Y + 1, 4, 11],
  [SH.r - 38, RAIL_Y + 1, 4, 11],
  [(SH.l + SH.r) / 2 - 2, RAIL_Y + 1, 4, 11],
]);
const BENCH_PERF = pxPath(
  repeat(Math.floor((SH.r - SH.l - 40) / 9), 9, [SH.l + 24, RAIL_Y - 4, 4, 2] as Rect),
);
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

/**
 * The station name board. Polish practice is a long white board with the name in
 * blue, on two posts, hung at eye level along the platform — and there are two
 * of them, because a train stopping anywhere along the platform has to be able
 * to see one.
 */
const NAME = "PRZYMORZE-UNIWERSYTET";
/**
 * The name at 1×, not 2×.
 *
 * A Polish platform name board is about 2.4 m long and 0.4 m deep — 91 × 15 px
 * at this key. The first version set the name in the pixel font at double size,
 * which made the board 570 px long and 26 deep: a five-metre-tall sign fourteen
 * metres long, filling a third of the frame and reading as a fence. The letters
 * are 5 px tall now, which is small, and correct, and still perfectly legible
 * because the whole scene is rendered at 4× on screen.
 */
const NAME_W = NAME.length * 4;
function nameBoard(x: number): { board: Rect[]; posts: Rect[] } {
  const w = NAME_W + 14;
  return {
    board: [[x, 100, w, 15]],
    posts: [
      [x + 10, 115, 3, 35],
      [x + w - 13, 115, 3, 35],
    ],
  };
}
const NB1 = nameBoard(Z.nameBoard);
const NB2 = nameBoard(Z.nameBoard2);
const NAME_BOARDS = pxPath([...NB1.board, ...NB2.board]);
const NAME_POSTS = pxPath([...NB1.posts, ...NB2.posts]);

/**
 * The departure display. A CIP unit: amber dot matrix in a dark case, hung off
 * the shelter frame on a bracket, angled down the platform. Two lines, which is
 * what these have — the next service and the one after it.
 */
const CIP = { x: Z.board, y: 62, w: 150, h: 40 } as const;
const CIP_CASE = pxPath([
  [CIP.x, CIP.y, CIP.w, CIP.h],
  /* the bracket back to the shelter post */
  [CIP.x - 32, CIP.y + 14, 32, 4],
]);
const CIP_SCREEN = pxPath([[CIP.x + 3, CIP.y + 3, CIP.w - 6, CIP.h - 6]]);

/**
 * The direction sign: an arrow either way with the next stations under it, which
 * is the thing that tells the player where they are in the world and which way
 * the railway goes. Hung under the departure display.
 */
const DIR_SIGN = pxPath([[CIP.x + 8, CIP.y + CIP.h + 4, CIP.w - 16, 15]]);

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

/** The timetable case, glazed, screwed to a post beside the name board. */
const TT_CASE = pxPath([[Z.nameBoard + NAME_W + 40, RAIL_Y - 58, 40, 50]]);
const TT_POST = pxPath([[Z.nameBoard + NAME_W + 58, RAIL_Y - 8, 4, 8]]);
const TT_ROWS = pxPath(repeat(11, 4, [Z.nameBoard + NAME_W + 44, RAIL_Y - 52, 32, 2] as Rect, "y"));

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

/** Mast luminaires: cold white LED, every 18 m, on their own columns. */
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

/** Contact shadows: everything that stands on the platform gets one. */
const FURNITURE_CONTACT = contactPaths([
  [Z.biletomat - 2, 40, RAIL_Y],
  [Z.drum - 2, 34, RAIL_Y],
  [Z.bin - 2, 26, RAIL_Y],
  [SH.l + 20, 26, RAIL_Y],
  [SH.l, 8, RAIL_Y],
  [SH.r - 6, 8, RAIL_Y],
]);
/** Ambient occlusion where the shelter roof shades the platform behind it. */
const SHELTER_AO = aoPaths([[SH.l - 10, SH.head + 4, SH.r - SH.l + 20]]);

function Furniture({ ph, s, lit }: { ph: Ph; s: StationState; lit: boolean }) {
  const night = ph === "night";
  const galv = GALV[ph];
  const conc = CONC[ph];
  const boardLit = s.board;
  return (
    <g>
      {/* the light poles go behind everything on the platform */}
      <path d={LUMINAIRES} fill={galv.base} />
      <path d={LUM_LENS} fill={lit ? "#f6f8ff" : galv.hi} />
      {lit ? MASTS.map((x, i) => <Light key={`pool-${x}`} set={LAMP_POOLS[i]} op={0.9} />) : null}

      {/* the stair down to the underpass */}
      <path d={STAIR_OPENING} fill="#12141a" />
      <path d={STAIR_TREADS} fill={conc.mid} opacity={0.75} />
      <path d={STAIR_LIP} fill={conc.hi} />
      <path d={STAIR_RAIL} fill={galv.base} />
      <path d={STAIR_SIGN} fill={K.signBlue} />
      <g transform={`translate(${Z.stairs - 18} ${RAIL_Y - 46})`}>
        <path d={textPath("WYJSCIE", 0, 0)} fill={K.white} opacity={0.9} />
      </g>

      {/* the shelter */}
      <AOSet set={SHELTER_AO} op={0.5} />
      <path d={SHELTER_GLASS} fill={K.glass[ph]} opacity={night ? 0.5 : 0.42} />
      <path d={SHELTER_GLASS} fill={dth("c", "12")} opacity={0.3} />
      <path d={SHELTER_FRAME} fill={galv.base} />
      <path d={SHELTER_ROOF} fill={galv.mid} />
      <path d={pxPath([[SH.l - 14, SH.roof, SH.r - SH.l + 28, 1]])} fill={galv.hi} />
      <path d={SHELTER_BENCH} fill={galv.lo} />
      <path d={BENCH_PERF} fill="#2b2e32" opacity={0.6} />

      {/* bins */}
      <path d={BINS} fill={galv.mid} />
      <path d={BIN_HOOP} fill={galv.hi} />
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

      {/* the name boards */}
      <path d={NAME_POSTS} fill={galv.base} />
      <path d={NAME_BOARDS} fill={night ? "#c9c4b6" : K.white} />
      <path
        d={pxPath([
          [Z.nameBoard, 100, NAME_W + 14, 2],
          [Z.nameBoard2, 100, NAME_W + 14, 2],
        ])}
        fill={K.signBlue}
      />
      <g transform={`translate(${Z.nameBoard + 7} 105)`}>
        <path d={textPath(NAME, 0, 0)} fill={K.signBlue} />
      </g>
      <g transform={`translate(${Z.nameBoard2 + 7} 105)`}>
        <path d={textPath(NAME, 0, 0)} fill={K.signBlue} />
      </g>

      {/* the departure display and the direction sign under it */}
      <path d={CIP_CASE} fill="#23262b" />
      <path d={CIP_SCREEN} fill={boardLit ? "#0d0f12" : "#1a1d22"} />
      {boardLit ? (
        <g>
          <g transform={`translate(${CIP.x + 7} ${CIP.y + 7})`}>
            <path d={textPath("15:42  SOPOT", 0, 0)} fill={K.led} />
          </g>
          <g transform={`translate(${CIP.x + 7} ${CIP.y + 16})`}>
            <path d={textPath("15:58  GDYNIA GL.", 0, 0)} fill={K.led} opacity={0.75} />
          </g>
          <g transform={`translate(${CIP.x + 7} ${CIP.y + 27})`}>
            <path d={textPath("SKM  PERON 1", 0, 0)} fill={K.ledDim} />
          </g>
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
        </g>
      ) : null}
      <path d={DIR_SIGN} fill={K.signBlue} />
      <g transform={`translate(${CIP.x + 12} ${CIP.y + CIP.h + 9})`}>
        <path d={textPath("SOPOT - GDYNIA", 0, 0)} fill={K.white} opacity={0.9} />
      </g>

      {/* the biletomat */}
      <path d={BILETOMAT} fill={night ? "#2b2e32" : "#3a3d42"} />
      <path d={BILETOMAT_SCREEN} fill="#0f2a4a" />
      <path d={BILETOMAT_SCREEN} fill={dth("c", "12")} opacity={0.35} />
      <g transform={`translate(${Z.biletomat + 7} ${RAIL_Y - 52})`}>
        <path d={textPath("BILET", 0, 0)} fill={K.skmYellow} />
      </g>
      <path d={BILETOMAT_KIT} fill={galv.lo} />
      <path d={pxPath([[Z.biletomat + 24, RAIL_Y - 34, 6, 3]])} fill={K.ledGreen} />

      {/* the poster drum */}
      <path d={DRUM} fill={s.season === "autumn" ? "#8a3a44" : "#3a5f8a"} />
      <path d={DRUM} fill={dth("c", "12")} opacity={0.2} />
      <path d={DRUM_SHADE} fill="#000" opacity={0.18} />
      <path d={DRUM_CAP} fill={galv.mid} />
      <g transform={`translate(${Z.drum + 6} ${RAIL_Y - 66})`}>
        <path d={textPath("TEATR", 0, 0)} fill={K.cream} opacity={0.85} />
      </g>
      <g transform={`translate(${Z.drum + 6} ${RAIL_Y - 58})`}>
        <path d={textPath("MUZYKI", 0, 0)} fill={K.cream} opacity={0.7} />
      </g>

      {/* the timetable case */}
      <path d={TT_POST} fill={galv.base} />
      <path d={TT_CASE} fill={galv.deep} />
      <path
        d={pxPath([[Z.nameBoard + NAME_W + 42, RAIL_Y - 56, 36, 46]])}
        fill={night ? "#d8d4c8" : K.white}
      />
      <path d={TT_ROWS} fill={K.signBlue} opacity={0.5} />

      <Contact set={FURNITURE_CONTACT} op={night ? 0.35 : 0.7} />
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
 * So the timetable is baked into the SMIL timeline. One `animateTransform` per
 * train carries the whole cycle — waiting off-stage, entering, braking to a
 * stand, waiting again, accelerating away — as a list of key times taken
 * straight from `stationTimetable`. Deceleration and acceleration are done with
 * unevenly spaced key frames rather than an easing function, because SMIL's
 * `calcMode="spline"` needs a control point per interval and four hand-placed
 * stops read better than any curve at this scale.
 *
 * `begin` is negative — the number of seconds we are already into the cycle when
 * the scene mounts — which drops the animation into the right frame instead of
 * starting the timetable over every time the player walks onto the platform.
 * That is also what keeps it in step with `boardingOpen()`, which the door
 * objects use and which is computed from the same clock.
 */

const T = TIMETABLE;

/** The non-stop express: enters from Gdańsk, crosses, gone. */
const EXPRESS = {
  keyTimes: [0, T.expressEnter, T.expressLeave, CYCLE_S].map(kt).join(";"),
  values: "-1820 0;-1820 0;2140 0;2140 0",
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

function Trains({ ph, offsetS }: { ph: Ph; offsetS: number }) {
  const begin = `${(-offsetS).toFixed(2)}s`;
  return (
    <g>
      {/* the express, which does not stop here */}
      <g>
        <SkmUnit ph={ph} destination="SOPOT" lit />
        <animateTransform
          attributeName="transform"
          type="translate"
          keyTimes={EXPRESS.keyTimes}
          values={EXPRESS.values}
          dur={`${CYCLE_S}s`}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </g>

      {/* the one you can get on */}
      <g>
        <SkmUnit
          ph={ph}
          destination="GDYNIA GL."
          lit
          doors={{
            mode: "cycle",
            keyTimes: DOORS.keyTimes,
            values: DOORS.values,
            dur: "96s",
            begin,
          }}
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          keyTimes={ARRIVAL.keyTimes}
          values={ARRIVAL.values}
          dur={`${CYCLE_S}s`}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </g>
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
        </>
      }
      staticObjects={<Furniture ph={ph} s={s} lit={lit} />}
      gameplayObjects={<Trains ph={ph} offsetS={offsetS} />}
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

const NEAR_TRAIN = {
  keyTimes: [0, T.nearEnter, T.nearLeave, CYCLE_S].map(kt).join(";"),
  /* right to left: in from beyond the Sopot end, out past the Gdańsk end */
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

      {/* the down train, on the near road, in front of everything */}
      <g>
        <g transform={`translate(0 ${NEAR_DROP}) scale(${NEAR_SCALE})`}>
          {/* `tail` because we see it going away from us to the left */}
          <SkmUnit ph={ph} destination="GDANSK GL." lit tail />
        </g>
        <animateTransform
          attributeName="transform"
          type="translate"
          keyTimes={NEAR_TRAIN.keyTimes}
          values={NEAR_TRAIN.values}
          dur={`${CYCLE_S}s`}
          begin={begin}
          repeatCount="indefinite"
          calcMode="linear"
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
const WAITING = [
  { id: "looker", npc: "waiting-man", x: 1690, facing: -1 as const, act: "lookDown" },
  { id: "phone", npc: "caller", x: 1080, facing: 1 as const, act: "phone" },
  { id: "reader", npc: "student", x: 570, facing: 1 as const, act: "read" },
  { id: "bench", npc: "babcia", x: 830, facing: 1 as const, act: "sit" },
] as const;

function StationPeople({ world }: { world: WorldState }) {
  const s = stationState(world);
  const who = whoIsWaiting(s);
  const shown = WAITING.filter((p) => {
    if (p.id === "bench") return who.bench;
    if (p.id === "looker") return who.looker;
    if (p.id === "phone") return who.phone;
    return who.reader;
  });
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
            /* the one on the bench sits on the shelter's own seat, not the floor */
            y={p.id === "bench" ? RAIL_Y - 5 : RAIL_Y}
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
  return (
    <>
      <StationPeople world={world} />

      {/* the announcement, when the service is called */}
      {s.announce && !dialogueOpen ? <Announcement scale={scale} /> : null}

      {/* pigeons in the shelter roof, which every shelter has */}
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
          <g opacity={0.35}>
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
  if (!text) return null;
  const font = Math.max(10, Math.round(2.6 * scale));
  return (
    <div
      className="pointer-events-none absolute right-0 left-0 flex justify-center"
      style={{ top: Math.round(10 * scale) }}
    >
      <div
        style={{
          background: "rgba(6,8,13,0.82)",
          padding: `${Math.round(scale)}px ${Math.round(3 * scale)}px`,
          maxWidth: "72%",
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: font, letterSpacing: "0.06em", color: "#ffb03a", opacity: 0.9 }}
        >
          {text}
        </span>
      </div>
    </div>
  );
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

export const TRAIN_STATION_SCENE: RuntimeSceneDef<WorldState> = {
  id: "station",
  width: W,
  /**
   * Every world read the artwork performs, and nothing else. The timetable is
   * deliberately absent: the trains are animated in SMIL off the document clock,
   * so putting the train phase in here would remount the whole scene four times
   * a cycle and restart the animation it is trying to describe.
   */
  artKey: (w, ph) => {
    const s = stationState(w);
    return [
      ph,
      s.weather,
      s.season,
      s.crowd,
      s.lamps,
      s.board ? 1 : 0,
      s.litter,
      s.pigeons ? 1 : 0,
    ].join("|");
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
      visible: (world) => whoIsWaiting(stationState(world)).pacer,
      z: 6,
    }),
  ],
  objects: [
    /* --- the way out, at the Gdańsk end --- */
    {
      id: "station-stairs",
      kind: "stairs",
      priority: 2,
      x: Z.stairs,
      range: 34,
      to: { scene: "district", spawnX: 250 },
    },
    /* --- the platform, end to end --- */
    { id: "station-name", kind: "flavor", x: Z.nameBoard + NAME_W / 2, range: 40 },
    { id: "station-timetable", kind: "flavor", x: Z.nameBoard + NAME_W + 60, range: 22 },
    { id: "station-biletomat", kind: "biletomat", x: Z.biletomat + 17, range: 26 },
    { id: "station-drum", kind: "flavor", x: Z.drum + 15, range: 20 },
    { id: "station-shelter", kind: "flavor", x: SH.l + 60, range: 44 },
    /* sitting down on the platform is the whole point of a platform */
    { id: "station-bench", kind: "sport", action: "sit", face: 1, x: 900, range: 46 },
    { id: "station-board", kind: "flavor", priority: 1, x: CIP.x + CIP.w / 2, range: 40 },
    { id: "station-bin", kind: "bins", x: Z.bin + 11, range: 18 },
    { id: "station-name-2", kind: "flavor", x: Z.nameBoard2 + NAME_W / 2, range: 40 },
    /* the edge. Looking down the line is a thing you do, and it is a warning */
    { id: "station-edge", kind: "flavor", x: 1660, range: 60, markerY: 120 },
    { id: "station-fence", kind: "flavor", x: 1900, range: 44 },
    /* --- the people --- */
    { id: "station-reader", kind: "npc", priority: 2, x: 570, range: 14 },
    { id: "station-bench-sitter", kind: "npc", priority: 2, x: 830, range: 16 },
    { id: "station-phone", kind: "npc", priority: 2, x: 1080, range: 14 },
    { id: "station-looker", kind: "npc", priority: 2, x: 1690, range: 14 },
    /* --- and the train, when it is here --- */
    ...DOORS_AS_OBJECTS,
  ],
  Component: ({ world, phase }) => <StationScene world={world} phase={phase} />,
  /** Outdoors: the sun and the platform lights do all of it. */
  darkness: () => 0,
  Foreground: (p) => <StationFront phase={p.phase} />,
  Effects: StationEffects,
  idleLean: true,
};
