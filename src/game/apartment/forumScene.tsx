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
  PixelText,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  steppedCone,
  steppedEllipse,
  steppedRoof,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { bandShade, courses, hash, plates, scatter, wearLane } from "@/engine/scene/groundKit";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";

/**
 * FORUM GDAŃSK — the plaza between the main station and the mall.
 *
 * You come up out of the SKM tunnel onto Targ Sienny with Gdańsk Główny behind
 * you — the long red-brick Dutch-renaissance station with its green copper
 * roofs and the clock tower — and in front of you the Radunia running in its
 * open channel, and across the water the Forum: two storeys of glass behind a
 * lattice of timber fins, a canopy over the doors, and a footbridge to reach
 * them. Trams pass on the street side, between you and the camera.
 *
 * It is the one place in the game that is unmistakably the city centre, and
 * the whole point of the SKM: you get on at a platform by a block of flats and
 * twenty minutes later you are here.
 *
 * PLANES
 *   Backdrop (0.3)  sky, the station and its tower, the Forum's upper box
 *   Middle (1)      the Forum facade across the canal, the far railing
 *   Ground (1)      the channel, the plaza slabs, the footbridge
 *   Static (1)      planters, benches, the kiosk, the totem, the tram stop
 *   Foreground      kerb, tram rails, the tram, the lamp columns, the vignette
 *   Effects         people, pigeons, the clock, the lamps after dark
 *
 * SCALE 38 px per metre. GROUND is y=150 as everywhere. The channel is behind
 * the walking band (y 116..146), so the water is a thing you stand at the
 * railing of, not a hole in the floor.
 */

const PPM = 38;
const m = (metres: number) => Math.round(metres * PPM);
const W = m(47); // 1786
const H = 180;
const GROUND = 150;
const KERB = 170;

/** Where things are, left to right. */
const Z = {
  /** the SKM stair down into the tunnel */
  skm: 110,
  /** the station's own doors, far left in the backdrop */
  station: 40,
  bench: 380,
  kiosk: 480,
  pigeons: 600,
  canal: 700,
  bin: 760,
  totem: 880,
  /** the footbridge and the Forum's doors */
  entrance: 990,
  bikes: 1180,
  tram: 1350,
  taxi: 1560,
} as const;

/* ================================================================== *
 * palette
 * ================================================================== */

const DAWN_CAST = "#8c86a8";
const DUSK_CAST = "#c98a52";
const NIGHT_CAST = "#141a24";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.14),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.16),
    night: dim(mat, NIGHT_CAST, 0.58),
  };
}

/** Gdańsk granite: the plaza is paved in it, the channel is lined with it. */
const GRANITE_MAT: Mat = {
  hi: "#a9a49a",
  base: "#8f8a80",
  mid: "#847f76",
  lo: "#756f66",
  deep: "#524e47",
};
/** The station's brick, dark red, with a hundred and twenty years on it. */
const BRICK_MAT: Mat = {
  hi: "#9a5040",
  base: "#7d3c30",
  mid: "#6f342a",
  lo: "#602c23",
  deep: "#3d1b15",
};
/** Copper roofs gone green. */
const COPPER_MAT: Mat = {
  hi: "#7fa892",
  base: "#5f8a74",
  mid: "#527a66",
  lo: "#466a58",
  deep: "#2d4a3a",
};
/** The Forum's timber fins: larch, weathering silver at the top. */
const LARCH_MAT: Mat = {
  hi: "#c9a874",
  base: "#a8865a",
  mid: "#987850",
  lo: "#866a46",
  deep: "#5a462e",
};
/** Sandstone dressings on the station. */
const SAND_MAT: Mat = {
  hi: "#e2d3b4",
  base: "#cdbc9a",
  mid: "#bfae8e",
  lo: "#ad9d80",
  deep: "#7d7059",
};

const GRANITE = ramp(GRANITE_MAT);
const BRICK = ramp(BRICK_MAT);
const COPPER = ramp(COPPER_MAT);
const LARCH = ramp(LARCH_MAT);
const SAND = ramp(SAND_MAT);
const STEEL = ramp(M.steel);
const LEAF = ramp(M.leaf);

const K = {
  sky: {
    dawn: ["#8ba3c4", "#a9b8cc", "#c9cfd8", "#e8cf9a"],
    day: ["#7fa8cc", "#93b8d6", "#a8c8e0", "#cfe2ee"],
    dusk: ["#4a3b63", "#7d5378", "#b96b8c", "#f2a65a"],
    night: ["#12142a", "#1a1830", "#232040", "#2c2a4a"],
  } as Record<Ph, string[]>,
  glass: { dawn: "#7a8894", day: "#8fa4b2", dusk: "#5e6472", night: "#2e3640" } as Record<
    Ph,
    string
  >,
  water: { dawn: "#4f6270", day: "#5a7482", dusk: "#4a4658", night: "#1c2230" } as Record<
    Ph,
    string
  >,
  waterHi: { dawn: "#8ea2ad", day: "#a8c0cc", dusk: "#b98a8c", night: "#3a4658" } as Record<
    Ph,
    string
  >,
  lit: "#ffd98a",
  litCold: "#dfe8ee",
  white: "#f4f4f0",
  red: "#c22b26",
  forumRed: "#b8232a",
  clockFace: "#f0e6c8",
  brand: "#1b4b96",
  mevo: "#2f7bd9",
  shade: "#171009",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

type ForumState = {
  crowd: 0 | 1 | 2 | 3;
  lamps: boolean;
  tramIn: boolean;
};

function state(_w: WorldState, ph: Ph): ForumState {
  return {
    crowd: ph === "day" ? 3 : ph === "dusk" ? 2 : ph === "dawn" ? 1 : 1,
    lamps: ph === "night" || ph === "dusk",
    tramIn: true,
  };
}

/* ================================================================== *
 * PLANE 1 — backdrop: sky, the station, the Forum's upper box
 * ================================================================== */

const SKY_BANDS: Rect[] = [
  [0, 0, W, 22],
  [0, 22, W, 24],
  [0, 46, W, 24],
  [0, 70, W, 50],
];

/* --- Gdańsk Główny: the long block, the two gables, the tower --- */
const STATION_BLOCK: Rect = [0, 78, 560, 72];
const STATION_SET = bevelPaths([STATION_BLOCK]);
/** Brick coursing: one course of headers every 6 px, a stretcher line between. */
const STATION_COURSES = pxPath(repeat(12, 6, [0, 80, 560, 1] as Rect, "y"));
const STATION_PLINTH = bevelPaths([[0, 138, 560, 12]]);
/** The arched windows of the hall, sandstone-dressed, in pairs. */
const STATION_WINDOWS: Rect[] = Array.from(
  { length: 9 },
  (_, i) => [24 + i * 58, 96, 22, 32] as Rect,
);
const STATION_WIN_GLASS = pxPath(STATION_WINDOWS);
const STATION_WIN_ARCH = pxPath(
  STATION_WINDOWS.flatMap(([x, y, w]) => [
    [x - 2, y - 2, w + 4, 2] as Rect,
    [x + 4, y - 4, w - 8, 2] as Rect,
    [x - 2, y, 2, 34] as Rect,
    [x + w, y, 2, 34] as Rect,
  ]),
);
const STATION_WIN_BARS = pxPath(
  STATION_WINDOWS.flatMap(([x, y, w, h]) => [
    [x + Math.round(w / 2), y, 1, h] as Rect,
    [x, y + 12, w, 1] as Rect,
  ]),
);
/** The string course, the cornice, the dentils under the eaves. */
const STATION_CORNICE = pxPath([
  [0, 78, 560, 3],
  [0, 92, 560, 1],
]);
const STATION_DENTILS = pxPath(repeat(70, 8, [2, 81, 4, 2] as Rect));
/** Two stepped gables in the Dutch manner, and the copper roof between them. */
const GABLE_A = pxPath(steppedRoof(140, 230, 78, 30, 10, 3));
const GABLE_B = pxPath(steppedRoof(380, 470, 78, 30, 10, 3));
const GABLE_TRIM = pxPath(
  [...steppedRoof(140, 230, 78, 30, 10, 3), ...steppedRoof(380, 470, 78, 30, 10, 3)].map(
    ([x, y, w]) => [x, y, w, 1] as Rect,
  ),
);
const ROOF_COPPER = pxPath([
  [0, 66, 140, 12],
  [230, 66, 150, 12],
  [470, 66, 90, 12],
]);
const ROOF_RIDGE = pxPath([
  [0, 66, 140, 1],
  [230, 66, 150, 1],
  [470, 66, 90, 1],
]);
const ROOF_SEAMS = pxPath([
  ...repeat(9, 16, [4, 67, 1, 11] as Rect),
  ...repeat(9, 16, [234, 67, 1, 11] as Rect),
  ...repeat(5, 16, [474, 67, 1, 11] as Rect),
]);
/** The clock tower: 48 m, so it goes out of the top of the frame. */
const TOWER: Rect = [286, 0, 44, 78];
const TOWER_SET = bevelPaths([TOWER]);
const TOWER_COURSES = pxPath(repeat(13, 6, [286, 2, 44, 1] as Rect, "y"));
const TOWER_BAND = pxPath([
  [284, 50, 48, 3],
  [284, 20, 48, 2],
]);
const TOWER_WINDOWS = pxPath([
  [300, 58, 16, 18],
  [296, 28, 8, 14],
  [312, 28, 8, 14],
]);
const TOWER_ARCH = pxPath([
  [298, 56, 20, 2],
  [302, 54, 12, 2],
]);
/** The clock: a stepped disc, its face, the twelve pips. */
const CLOCK_C = { x: 308, y: 36, r: 9 };
const CLOCK_RING = pxPath(steppedEllipse(CLOCK_C.x, CLOCK_C.y, CLOCK_C.r + 1, CLOCK_C.r + 1, 1));
const CLOCK_FACE = pxPath(steppedEllipse(CLOCK_C.x, CLOCK_C.y, CLOCK_C.r - 1, CLOCK_C.r - 1, 1));
const CLOCK_PIPS = pxPath(
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return [
      CLOCK_C.x + Math.round(Math.cos(a) * 6),
      CLOCK_C.y + Math.round(Math.sin(a) * 6),
      1,
      1,
    ] as Rect;
  }),
);
/** The hour hand, in twelve whole-pixel positions; the minute hand in twelve more. */
const HAND = (len: number) =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const out: Rect[] = [];
    for (let r = 0; r <= len; r++)
      out.push([
        CLOCK_C.x + Math.round(Math.cos(a) * r),
        CLOCK_C.y + Math.round(Math.sin(a) * r),
        1,
        1,
      ]);
    return pxPath(out);
  });
const HOUR_HANDS = HAND(4);
const MINUTE_HANDS = HAND(7);

/* --- the Forum's upper storey, far right, above the facade in the middle plane --- */
const FORUM_UPPER: Rect = [780, 40, 1000, 40];
const FORUM_UPPER_SET = bevelPaths([FORUM_UPPER]);
const FORUM_UPPER_FINS = pxPath(repeat(84, 12, [782, 42, 2, 36] as Rect));
const FORUM_UPPER_GLASS = pxPath(repeat(84, 12, [785, 44, 8, 32] as Rect));
const FORUM_ROOF = pxPath([[776, 36, 1010, 4]]);
const FORUM_ROOF_KIT = pxPath([
  [900, 28, 40, 8],
  [1300, 30, 26, 6],
  [1560, 26, 12, 10],
]);

/** Gulls, which is how you know this is the sea side of the country. */
const GULLS = pxPath([
  [620, 22, 3, 1],
  [623, 21, 3, 1],
  [626, 22, 3, 1],
  [1140, 14, 3, 1],
  [1143, 13, 3, 1],
  [1146, 14, 3, 1],
  [1420, 30, 2, 1],
  [1422, 29, 2, 1],
  [1424, 30, 2, 1],
]);

function Backdrop({ ph }: { ph: Ph }) {
  const night = ph === "night";
  const sky = K.sky[ph];
  const hour = new Date().getHours() % 12;
  const minute = Math.floor(new Date().getMinutes() / 5);
  return (
    <g>
      <SharedDefs />
      {SKY_BANDS.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static sky bands, never reorder
        <path key={`sky${i}`} d={pxPath([[r[0] - 60, r[1], r[2] + 120, r[3]]])} fill={sky[i]} />
      ))}
      {night ? (
        <path
          d={pxPath([
            [120, 8, 1, 1],
            [420, 14, 1, 1],
            [660, 6, 1, 1],
            [1010, 18, 1, 1],
            [1380, 10, 1, 1],
            [1620, 22, 1, 1],
          ])}
          fill="#e8ecf5"
          opacity={0.8}
        />
      ) : (
        <path d={GULLS} fill={night ? "#3a3f4a" : "#e8ecf0"} opacity={0.9} />
      )}

      {/* ---- Gdańsk Główny ---- */}
      <Bev set={STATION_SET} mat={BRICK[ph]} />
      <path d={STATION_COURSES} fill={BRICK[ph].deep} opacity={0.35} />
      <rect x={0} y={78} width={560} height={72} fill="url(#px-grain)" opacity={0.5} />
      <path d={STATION_CORNICE} fill={SAND[ph].base} />
      <path d={STATION_DENTILS} fill={SAND[ph].hi} />
      <Bev set={STATION_PLINTH} mat={SAND[ph]} />
      <path d={STATION_WIN_ARCH} fill={SAND[ph].base} />
      <path
        d={STATION_WIN_GLASS}
        fill={ph === "day" ? K.glass[ph] : K.lit}
        opacity={ph === "day" ? 1 : night ? 0.85 : 0.7}
      />
      <path d={STATION_WIN_BARS} fill={SAND[ph].deep} opacity={0.8} />
      {/* the roofs, copper, seamed, and the two gables */}
      <path d={ROOF_COPPER} fill={COPPER[ph].base} />
      <path d={ROOF_SEAMS} fill={COPPER[ph].deep} opacity={0.5} />
      <path d={ROOF_RIDGE} fill={COPPER[ph].hi} />
      <path d={GABLE_A} fill={BRICK[ph].base} />
      <path d={GABLE_B} fill={BRICK[ph].base} />
      <path d={GABLE_TRIM} fill={SAND[ph].base} />
      {/* the tower */}
      <Bev set={TOWER_SET} mat={BRICK[ph]} />
      <path d={TOWER_COURSES} fill={BRICK[ph].deep} opacity={0.35} />
      <path d={TOWER_BAND} fill={SAND[ph].base} />
      <path d={TOWER_ARCH} fill={SAND[ph].base} />
      <path d={TOWER_WINDOWS} fill={night ? "#1c2230" : K.glass[ph]} />
      <path d={CLOCK_RING} fill={SAND[ph].deep} />
      <path d={CLOCK_FACE} fill={night ? "#fff2c8" : K.clockFace} />
      <path d={CLOCK_PIPS} fill="#2b2419" />
      <path d={MINUTE_HANDS[minute]} fill="#2b2419" />
      <path d={HOUR_HANDS[hour]} fill="#2b2419" />
      {night ? <Light set={CLOCK_GLOW} /> : null}

      {/* ---- the Forum's upper storey, over the facade ---- */}
      <path d={FORUM_ROOF} fill={STEEL[ph].deep} />
      <path d={FORUM_ROOF_KIT} fill={STEEL[ph].lo} />
      <Bev set={FORUM_UPPER_SET} mat={LARCH[ph]} />
      <path d={FORUM_UPPER_GLASS} fill={night ? "#3a4658" : K.glass[ph]} />
      <path d={FORUM_UPPER_FINS} fill={LARCH[ph].hi} />
      {night ? (
        <path d={pxPath(repeat(21, 48, [790, 46, 6, 28] as Rect))} fill={K.lit} opacity={0.35} />
      ) : null}
    </g>
  );
}

const CLOCK_GLOW = tiers(
  (k) => steppedEllipse(CLOCK_C.x, CLOCK_C.y, Math.round(16 * k), Math.round(16 * k), 2),
  "w",
  0.8,
);

/* ================================================================== *
 * PLANE 2 — the Forum facade across the water, and the far railing
 * ================================================================== */

const FACADE: Rect = [620, 80, W - 620, 40];
const FACADE_SET = bevelPaths([FACADE]);
/** Timber fins on a 600 mm pitch, the whole width; glass between. */
const FINS = pxPath(repeat(Math.ceil((W - 620) / 23), 23, [622, 82, 3, 36] as Rect));
const FACADE_GLASS = pxPath(repeat(Math.ceil((W - 620) / 23), 23, [626, 84, 18, 32] as Rect));
const FACADE_TRANSOM = pxPath([[620, 100, W - 620, 1]]);
/** The canopy over the doors, and the doors: four leaves of glass in a black frame. */
const CANOPY = bevelPaths([[Z.entrance - 90, 76, 180, 8]]);
const CANOPY_UNDER = pxPath([[Z.entrance - 88, 84, 176, 2]]);
const DOORS_FRAME = pxPath([[Z.entrance - 60, 88, 120, 32]]);
const DOORS_GLASS = pxPath(repeat(4, 29, [Z.entrance - 57, 90, 26, 28] as Rect));
const DOORS_PULLS = pxPath([
  [Z.entrance - 4, 98, 2, 12],
  [Z.entrance + 2, 98, 2, 12],
]);
/** The word, in the operator's red, on the canopy fascia. */
const FORUM_LETTERS_X = Z.entrance - 24;
/** What is behind the glass on the ground floor: shopfronts, lit. */
const SHOP_LIGHT = pxPath([
  [640, 96, 300, 22],
  [1080, 96, 260, 22],
  [1400, 96, 340, 22],
]);
const SHOP_FIXTURES = pxPath([
  ...repeat(6, 48, [660, 104, 20, 12] as Rect),
  ...repeat(5, 50, [1100, 106, 16, 10] as Rect),
  ...repeat(7, 46, [1416, 102, 18, 14] as Rect),
]);
/** The far bank: granite coping over the channel, the railing on it. */
const FAR_COPING = bevelPaths([[600, 120, W - 600, 6]]);
const FAR_RAIL = pxPath([
  [600, 108, W - 600, 2],
  ...repeat(Math.ceil((W - 600) / 40), 40, [604, 110, 2, 10] as Rect),
]);
/** The footbridge to the doors: a flat span across the water, on two piers. */
const BRIDGE_DECK = bevelPaths([[Z.entrance - 40, 126, 80, 22]]);
const BRIDGE_PIERS = pxPath([
  [Z.entrance - 38, 132, 6, 16],
  [Z.entrance + 32, 132, 6, 16],
]);
const BRIDGE_RAILS = pxPath([
  [Z.entrance - 42, 116, 3, 12],
  [Z.entrance + 39, 116, 3, 12],
  [Z.entrance - 42, 116, 84, 2],
]);

function FarSide({ ph, s }: { ph: Ph; s: ForumState }) {
  const night = ph === "night";
  const litInside = night || ph === "dusk" || ph === "dawn";
  return (
    <g>
      <Bev set={FACADE_SET} mat={STEEL[ph]} />
      <path d={FACADE_GLASS} fill={K.glass[ph]} />
      {litInside ? (
        <path d={SHOP_LIGHT} fill={K.lit} opacity={0.55} />
      ) : (
        <path d={SHOP_LIGHT} fill="#ffffff" opacity={0.18} />
      )}
      <path d={SHOP_FIXTURES} fill={litInside ? "#8a6a3a" : "#5d6266"} opacity={0.7} />
      <path d={FACADE_TRANSOM} fill={STEEL[ph].deep} />
      <path d={FINS} fill={LARCH[ph].base} />
      <path d={FINS} transform="translate(1,0)" fill={LARCH[ph].lo} opacity={0.6} />
      {/* the entrance: canopy, fascia, the word, the doors */}
      <Bev set={CANOPY} mat={STEEL[ph]} />
      <path d={CANOPY_UNDER} fill={K.shade} opacity={0.3} />
      <PixelText x={FORUM_LETTERS_X} y={77} text="FORUM" fill={K.forumRed} gap={2} />
      <path d={DOORS_FRAME} fill="#1a1d22" />
      <path d={DOORS_GLASS} fill={litInside ? K.lit : K.glass[ph]} opacity={litInside ? 0.7 : 1} />
      <path d={DOORS_PULLS} fill={STEEL[ph].hi} />
      {/* the far bank and the bridge */}
      <Bev set={FAR_COPING} mat={GRANITE[ph]} />
      <path d={FAR_RAIL} fill={STEEL[ph].lo} />
      <path d={BRIDGE_RAILS} fill={STEEL[ph].lo} />
      <path d={BRIDGE_PIERS} fill={GRANITE[ph].deep} />
      <Bev set={BRIDGE_DECK} mat={GRANITE[ph]} />
      {s.crowd >= 2 ? (
        <path
          d={pxPath([
            [Z.entrance + 8, 108, 6, 6],
            [Z.entrance + 7, 114, 8, 12],
          ])}
          fill="#39434c"
          opacity={0.85}
        />
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — ground: the channel, the slabs, the bridge landing
 * ================================================================== */

/** The Radunia in its channel: water between two granite walls. */
const CHANNEL_WALL_FAR = pxPath([[560, 126, W - 560, 4]]);
const WATER: Rect = [560, 130, W - 560, 16];
const WATER_RIPPLES = pxPath(
  Array.from(
    { length: 40 },
    (_, i) =>
      [
        572 + i * 30 + Math.round(hash(i) * 10),
        133 + (i % 4) * 3,
        8 + Math.round(hash(i * 3) * 8),
        1,
      ] as Rect,
  ),
);
const WATER_WEED = pxPath([
  [640, 142, 30, 2],
  [1210, 143, 22, 2],
  [1580, 141, 26, 2],
]);
const NEAR_COPING = bevelPaths([[560, 146, W - 560, 4]]);
const CHANNEL_END = bevelPaths([[556, 126, 6, 24]]);
/** The plaza: granite slabs on a 600 mm module, foreshortening. */
const SLABS = courses(0, W, GROUND, KERB, { far: 5, near: 8, unit: m(0.6), stagger: true });
const SLAB_TONE = plates(0, W, GROUND, KERB, {
  far: 5,
  near: 8,
  unit: m(0.6),
  stagger: true,
  seed: 41,
  dark: 0.1,
  pale: 0.08,
});
const SLAB_SHADE = bandShade(0, W, GROUND, KERB);
/** Where everybody walks: out of the tunnel, along the water, to the bridge, to the tram. */
const SLAB_WEAR = [
  wearLane(140, 960, GROUND + 8, 3, 42),
  wearLane(1020, 1400, GROUND + 9, 3, 43),
  wearLane(1000, 1010, GROUND + 3, 6, 44),
];
const SLAB_GRIT = scatter(0, W, GROUND + 3, KERB - 3, 40, 45, 1, 1);
const SLAB_GUM = scatter(300, 1500, GROUND + 4, KERB - 4, 12, 46, 2, 1);
/** The kerb, and the tram platform's edge stone in a paler granite. */
const KERB_LINE = pxPath([[0, KERB - 2, W, 2]]);
const KERB_TACTILE = pxPath(repeat(Math.ceil(120 / 4), 4, [Z.tram - 60, GROUND + 4, 2, 2] as Rect));
/** The bridge landing: the slabs run onto it. */
const LANDING = pxPath([[Z.entrance - 40, GROUND - 4, 80, 4]]);

function Ground({ ph }: { ph: Ph }) {
  const night = ph === "night";
  const g = GRANITE[ph];
  return (
    <g>
      {/* the channel: far wall, water, near wall */}
      <path d={CHANNEL_WALL_FAR} fill={g.deep} />
      <path d={pxPath([WATER])} fill={K.water[ph]} />
      <path d={pxPath([WATER])} fill={dth("n", "12")} opacity={0.4} />
      <path d={WATER_RIPPLES} fill={K.waterHi[ph]} opacity={0.6}>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;6 0;12 0;18 0;24 0;30 0"
          keyTimes="0;0.2;0.4;0.6;0.8;1"
          dur="9s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
      </path>
      <path d={WATER_WEED} fill="#3a5a3a" opacity={0.6} />
      {/* the reflection of the lit facade in the water after dark */}
      {night ? (
        <path d={pxPath(repeat(30, 46, [640, 131, 8, 14] as Rect))} fill={K.lit} opacity={0.12} />
      ) : null}
      <Bev set={CHANNEL_END} mat={g} />
      <Bev set={NEAR_COPING} mat={g} />
      {/* the plaza */}
      {pxRect(0, GROUND, W, KERB - GROUND, g.lo)}
      <path d={SLABS.face} fill={g.base} />
      <path d={SLAB_TONE.dark} fill={g.lo} opacity={0.5} />
      <path d={SLAB_TONE.pale} fill={g.hi} opacity={0.4} />
      <path d={SLABS.hi} fill={g.hi} opacity={0.6} />
      <path d={SLABS.joints} fill={g.deep} opacity={0.45} />
      <rect x={0} y={GROUND} width={W} height={KERB - GROUND} fill="url(#px-agg)" opacity={0.5} />
      {SLAB_WEAR.map((d) => (
        <path key={d.slice(0, 14)} d={d} fill="#fff" opacity={0.09} />
      ))}
      <path d={SLAB_GRIT} fill={g.deep} opacity={0.4} />
      <path d={SLAB_GUM} fill="#6d6a62" opacity={0.6} />
      <path d={LANDING} fill={g.hi} opacity={0.6} />
      <path d={KERB_TACTILE} fill="#c9a24b" opacity={0.8} />
      <path d={KERB_LINE} fill={g.hi} />
      <path d={SLAB_SHADE.footSoft} fill={K.shade} opacity={0.08} />
      <path d={SLAB_SHADE.foot} fill={K.shade} opacity={0.14} />
    </g>
  );
}

function pxRect(x: number, y: number, w: number, h: number, fill: string) {
  return <path d={pxPath([[x, y, w, h]])} fill={fill} />;
}

/* ================================================================== *
 * PLANE 4 — the furniture of a square
 * ================================================================== */

/** The SKM stair down into the tunnel: a railed opening in the plaza with the sign over it. */
const SKM_WELL: Rect = [Z.skm - 46, GROUND - 2, 92, 20];
const SKM_WELL_INNER = pxPath([[Z.skm - 42, GROUND, 84, 16]]);
const SKM_STEPS_DOWN = pxPath(
  Array.from(
    { length: 5 },
    (_, i) => [Z.skm - 40 + i * 4, GROUND + 2 + i * 3, 80 - i * 8, 2] as Rect,
  ),
);
const SKM_RAILS = pxPath([
  [Z.skm - 48, GROUND - 26, 3, 26],
  [Z.skm + 45, GROUND - 26, 3, 26],
  [Z.skm - 48, GROUND - 26, 96, 3],
  ...repeat(11, 9, [Z.skm - 44, GROUND - 23, 2, 21] as Rect),
]);
const SKM_SIGN_POST = pxPath([[Z.skm - 2, GROUND - 92, 4, 66]]);
const SKM_SIGN = bevelPaths([[Z.skm - 34, GROUND - 106, 68, 16]]);
const SKM_SIGN_BAND = pxPath([[Z.skm - 34, GROUND - 93, 68, 3]]);
/** Down: a shaft, then a head that narrows toward the tunnel. */
const SKM_SIGN_ARROW = pxPath([
  [Z.skm + 18, GROUND - 104, 2, 7],
  [Z.skm + 14, GROUND - 98, 10, 2],
  [Z.skm + 16, GROUND - 96, 6, 2],
  [Z.skm + 18, GROUND - 94, 2, 1],
]);
/** Planters: granite boxes with the municipal shrubs, which blockers hide behind. */
const PLANTER_X = [250, 820, 1090, 1480] as const;
const PLANTERS = bevelPaths(PLANTER_X.map((x) => [x, GROUND - 16, 56, 18] as Rect));
const PLANTER_SOIL = pxPath(PLANTER_X.map((x) => [x + 3, GROUND - 16, 50, 2] as Rect));
const PLANTER_SHRUBS = pxPath(
  PLANTER_X.flatMap((x) => [
    ...steppedEllipse(x + 14, GROUND - 24, 12, 9, 2),
    ...steppedEllipse(x + 40, GROUND - 22, 13, 8, 2),
    ...steppedEllipse(x + 27, GROUND - 28, 9, 7, 2),
  ]),
);
const PLANTER_SHRUB_HI = pxPath(
  PLANTER_X.flatMap((x) => [
    [x + 8, GROUND - 30, 8, 2] as Rect,
    [x + 32, GROUND - 27, 10, 2] as Rect,
  ]),
);
/** The bench, Gdańsk pattern: cast-iron ends, hardwood slats. */
const BENCH_SLATS = pxPath(repeat(4, 4, [Z.bench - 30, GROUND - 18, 60, 3] as Rect, "y"));
const BENCH_BACK = pxPath(repeat(3, 4, [Z.bench - 30, GROUND - 32, 60, 2] as Rect, "y"));
const BENCH_ENDS = pxPath([
  [Z.bench - 32, GROUND - 34, 3, 34],
  [Z.bench + 29, GROUND - 34, 3, 34],
  [Z.bench - 32, GROUND - 20, 62, 2],
]);
/** The kiosk: a Ruch box, green, with its window full of things. */
const KIOSK_SET = bevelPaths([[Z.kiosk - 28, GROUND - 80, 56, 82]]);
const KIOSK_ROOF = bevelPaths([[Z.kiosk - 32, GROUND - 86, 64, 6]]);
const KIOSK_WINDOW = pxPath([[Z.kiosk - 22, GROUND - 68, 44, 30]]);
const KIOSK_STOCK = pxPath([
  ...repeat(5, 8, [Z.kiosk - 20, GROUND - 64, 6, 8] as Rect),
  ...repeat(6, 7, [Z.kiosk - 20, GROUND - 52, 5, 6] as Rect),
  [Z.kiosk - 20, GROUND - 44, 40, 4],
]);
const KIOSK_HATCH = pxPath([[Z.kiosk - 8, GROUND - 36, 16, 20]]);
const KIOSK_SIGN = pxPath([[Z.kiosk - 24, GROUND - 78, 48, 8]]);
/** The litter bin, and the totem with the map of the mall. */
const BIN_SET = bevelPaths([[Z.bin - 7, GROUND - 34, 14, 36]]);
const BIN_MOUTH = pxPath([[Z.bin - 5, GROUND - 30, 10, 5]]);
const BIN_ASH = pxPath([[Z.bin - 3, GROUND - 36, 6, 3]]);
const TOTEM_SET = bevelPaths([[Z.totem - 12, GROUND - 90, 24, 92]]);
const TOTEM_SCREEN = pxPath([[Z.totem - 9, GROUND - 84, 18, 50]]);
const TOTEM_MAP = pxPath([
  [Z.totem - 6, GROUND - 78, 12, 8],
  [Z.totem - 6, GROUND - 66, 5, 6],
  [Z.totem + 1, GROUND - 66, 5, 6],
  [Z.totem - 6, GROUND - 56, 12, 2],
  [Z.totem - 3, GROUND - 50, 6, 6],
]);
/** MEVO bike share: six docks, four bikes. */
const MEVO_RAIL = pxPath([[Z.bikes - 60, GROUND - 6, 120, 4]]);
const MEVO_DOCKS = pxPath(repeat(6, 20, [Z.bikes - 58, GROUND - 22, 4, 18] as Rect));
const MEVO_BIKES = pxPath(
  [0, 1, 3, 4].flatMap((i) => {
    const x = Z.bikes - 54 + i * 20;
    return [
      [x, GROUND - 26, 12, 2],
      [x + 2, GROUND - 20, 2, 14],
      [x + 8, GROUND - 20, 2, 14],
      [x - 2, GROUND - 8, 6, 6],
      [x + 8, GROUND - 8, 6, 6],
    ] as Rect[];
  }),
);
const MEVO_POST = bevelPaths([[Z.bikes + 66, GROUND - 60, 10, 60]]);
const MEVO_HEAD = pxPath([[Z.bikes + 64, GROUND - 68, 14, 10]]);
/** The tram stop: the shelter, the pole with its sign, the timetable case. */
const TRAM_SHELTER = bevelPaths([
  [Z.tram - 70, GROUND - 96, 140, 5],
  [Z.tram - 68, GROUND - 92, 4, 92],
  [Z.tram + 62, GROUND - 92, 4, 92],
]);
const TRAM_GLASS = pxPath([[Z.tram - 62, GROUND - 88, 122, 70]]);
const TRAM_BENCH = pxPath([
  [Z.tram - 50, GROUND - 18, 60, 4],
  [Z.tram - 48, GROUND - 14, 4, 14],
  [Z.tram + 4, GROUND - 14, 4, 14],
]);
const TRAM_CASE = bevelPaths([[Z.tram + 20, GROUND - 74, 30, 40]]);
const TRAM_CASE_PAPER = pxPath([[Z.tram + 23, GROUND - 70, 24, 32]]);
const TRAM_CASE_LINES = pxPath(repeat(7, 4, [Z.tram + 25, GROUND - 66, 20, 1] as Rect, "y"));
const TRAM_POLE = pxPath([[Z.tram + 74, GROUND - 110, 4, 110]]);
const TRAM_SIGN = bevelPaths([[Z.tram + 62, GROUND - 124, 28, 16]]);
/** The taxi rank sign, and the rank itself is on the road in the foreground. */
const TAXI_POST = pxPath([[Z.taxi, GROUND - 80, 3, 80]]);
const TAXI_SIGN = bevelPaths([[Z.taxi - 20, GROUND - 92, 44, 14]]);
/** Lamp columns along the water, 6 m, the heads out of frame. */
const LAMP_X = [320, 700, 1060, 1440] as const;
const LAMP_COLUMNS = pxPath(LAMP_X.map((x) => [x - 2, 0, 5, GROUND] as Rect));
const LAMP_BASES = bevelPaths(LAMP_X.map((x) => [x - 5, GROUND - 10, 11, 12] as Rect));
/** Contact shadows under everything standing on the slabs. */
const FURNITURE_CONTACT = contactPaths([
  ...PLANTER_X.map((x) => [x - 1, 58, GROUND + 1] as const),
  [Z.bench - 32, 64, GROUND] as const,
  [Z.kiosk - 30, 60, GROUND + 1] as const,
  [Z.bin - 8, 16, GROUND + 1] as const,
  [Z.totem - 13, 26, GROUND + 1] as const,
  [Z.bikes - 62, 140, GROUND - 1] as const,
  [Z.tram - 70, 150, GROUND] as const,
  [Z.taxi - 2, 7, GROUND] as const,
  ...LAMP_X.map((x) => [x - 6, 13, GROUND + 1] as const),
]);
const FURNITURE_AO = aoPaths([
  [Z.kiosk - 28, GROUND - 80 + 82 - 4, 56],
  [Z.tram - 62, GROUND - 88, 122],
]);

function Furniture({ ph, s }: { ph: Ph; s: ForumState }) {
  const night = ph === "night";
  const g = GRANITE[ph];
  const st = STEEL[ph];
  const green = LEAF[ph];
  const skm = { hi: "#2b6aa8", base: "#12447c", mid: "#0f3b6c", lo: "#0c325c", deep: "#081f3c" };
  return (
    <g>
      <Contact set={FURNITURE_CONTACT} op={night ? 0.4 : 0.8} />
      {/* the SKM stair down: the well, its steps going under, the rail round it */}
      <Bev set={bevelPaths([SKM_WELL])} mat={g} />
      <path d={SKM_WELL_INNER} fill={night ? "#0e1118" : "#2b2d34"} />
      <path d={SKM_STEPS_DOWN} fill={g.lo} opacity={0.8} />
      <path
        d={pxPath([[Z.skm - 30, GROUND + 10, 60, 4]])}
        fill={K.lit}
        opacity={night ? 0.45 : 0.2}
      />
      <path d={SKM_RAILS} fill={st.base} />
      <path d={SKM_RAILS} transform="translate(0,1)" fill={st.deep} opacity={0.4} />
      <path d={SKM_SIGN_POST} fill={st.lo} />
      <Bev set={SKM_SIGN} mat={skm} />
      <path d={SKM_SIGN_BAND} fill="#f2c218" />
      <PixelText x={Z.skm - 30} y={GROUND - 102} text="SKM" fill={K.white} gap={1} />
      <path d={SKM_SIGN_ARROW} fill={K.white} />
      {/* planters */}
      <Bev set={PLANTERS} mat={g} />
      <path d={PLANTER_SOIL} fill="#3a2a18" />
      <path d={PLANTER_SHRUBS} fill={green.base} />
      <path d={PLANTER_SHRUB_HI} fill={green.hi} opacity={0.7} />
      {/* the bench */}
      <path d={BENCH_ENDS} fill="#2b2e32" />
      <path d={BENCH_BACK} fill={M.oak.base} />
      <path d={BENCH_SLATS} fill={M.oak.hi} />
      {/* the kiosk */}
      <AOSet set={FURNITURE_AO} op={0.7} />
      <Bev
        set={KIOSK_SET}
        mat={{ hi: "#3f7a5a", base: "#2f6448", mid: "#2a5a40", lo: "#245038", deep: "#153020" }}
      />
      <Bev set={KIOSK_ROOF} mat={st} />
      <path d={KIOSK_SIGN} fill="#f4f4f0" />
      <PixelText x={Z.kiosk - 14} y={GROUND - 76} text="KIOSK" fill="#2f6448" gap={1} />
      <path d={KIOSK_WINDOW} fill={night ? K.lit : K.glass[ph]} opacity={night ? 0.9 : 1} />
      <path d={KIOSK_STOCK} fill={night ? "#8a6a3a" : "#5d6266"} opacity={0.8} />
      <path d={KIOSK_HATCH} fill="#1a1d22" opacity={0.7} />
      {/* bin, totem */}
      <Bev set={BIN_SET} mat={st} />
      <path d={BIN_MOUTH} fill="#111" />
      <path d={BIN_ASH} fill={st.deep} />
      <Bev
        set={TOTEM_SET}
        mat={{ hi: "#3a3f45", base: "#23262b", mid: "#1f2226", lo: "#1a1d21", deep: "#0d0f12" }}
      />
      <path d={TOTEM_SCREEN} fill={night ? "#1c2a3a" : "#dfe6ec"} />
      <path d={TOTEM_MAP} fill={K.forumRed} opacity={0.85} />
      <PixelText x={Z.totem - 9} y={GROUND - 30} text="FORUM" fill={K.white} gap={1} />
      {/* MEVO */}
      <path d={MEVO_RAIL} fill={st.lo} />
      <path d={MEVO_DOCKS} fill={st.base} />
      <path d={MEVO_BIKES} fill={K.mevo} />
      <Bev set={MEVO_POST} mat={st} />
      <path d={MEVO_HEAD} fill={K.mevo} />
      {/* the tram stop */}
      <path d={TRAM_GLASS} fill="#c2d6da" opacity={0.22} />
      <Bev set={TRAM_SHELTER} mat={st} />
      <path d={TRAM_BENCH} fill={M.oak.base} />
      <Bev set={TRAM_CASE} mat={st} />
      <path d={TRAM_CASE_PAPER} fill={K.white} />
      <path d={TRAM_CASE_LINES} fill={st.mid} opacity={0.5} />
      <path d={TRAM_POLE} fill={st.base} />
      <Bev
        set={TRAM_SIGN}
        mat={{ hi: "#3a8fd6", base: "#1b6bb3", mid: "#175f9f", lo: "#13528a", deep: "#0b2f52" }}
      />
      <PixelText x={Z.tram + 66} y={GROUND - 120} text="8 12" fill={K.white} gap={1} />
      {/* taxi */}
      <path d={TAXI_POST} fill={st.base} />
      <Bev
        set={TAXI_SIGN}
        mat={{ hi: "#ffe27a", base: "#f2c218", mid: "#dcae12", lo: "#c2990c", deep: "#8a6c06" }}
      />
      <PixelText x={Z.taxi - 12} y={GROUND - 88} text="TAXI" fill="#1a1d22" gap={1} />
      {/* the lamp columns */}
      <path d={LAMP_COLUMNS} fill={st.mid} />
      <path d={pxPath(LAMP_X.map((x) => [x - 2, 0, 2, GROUND] as Rect))} fill={st.hi} />
      <Bev set={LAMP_BASES} mat={st} />
      {s.crowd >= 3 ? (
        <path
          d={pxPath([
            [Z.bench - 20, GROUND - 40, 8, 8],
            [Z.bench - 22, GROUND - 32, 12, 14],
          ])}
          fill="#39434c"
          opacity={0}
        />
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * effects — people, pigeons, the light after dark
 * ================================================================== */

const LAMP_POOLS = tiers(
  (k) =>
    LAMP_X.flatMap((x) =>
      steppedEllipse(x, GROUND + 10, Math.round(m(2.6) * k), Math.round(m(0.6) * k), 3),
    ),
  "c",
  0.55,
);
const LAMP_CONES = tiers(
  (k) =>
    LAMP_X.flatMap((x) => steppedCone(x, 0, Math.round(10 * k), GROUND, Math.round(70 * k), 8)),
  "c",
  0.22,
);
const ENTRANCE_SPILL = tiers(
  (k) => steppedEllipse(Z.entrance, GROUND + 4, Math.round(60 * k), Math.round(12 * k), 3),
  "w",
  0.6,
);
const KIOSK_SPILL = tiers(
  (k) => steppedEllipse(Z.kiosk, GROUND + 6, Math.round(34 * k), Math.round(8 * k), 3),
  "w",
  0.5,
);

const PIGEONS: readonly (readonly [x: number, y: number])[] = [
  [Z.pigeons - 14, GROUND + 6],
  [Z.pigeons + 4, GROUND + 11],
  [Z.pigeons + 22, GROUND + 4],
  [Z.pigeons + 30, GROUND + 13],
];

function Effects({ phase }: { phase: string }) {
  const ph = toPhase(phase);
  const s = state({} as WorldState, ph);
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
        {s.lamps ? (
          <>
            <Light set={LAMP_CONES} op={night ? 1 : 0.5} />
            <Light set={LAMP_POOLS} op={night ? 1 : 0.6} />
            <Light set={ENTRANCE_SPILL} op={night ? 1 : 0.5} />
            <Light set={KIOSK_SPILL} op={night ? 1 : 0.4} />
          </>
        ) : null}
        {/* pigeons working the slabs by the bench, in the discrete hops pigeons make */}
        {!night
          ? PIGEONS.map(([x, y], i) => (
              <g key={`pg${x}`} fill="#5d6068">
                <path
                  d={pxPath([
                    [x, y, 4, 3],
                    [x + 4, y - 1, 2, 2],
                  ])}
                />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  calcMode="discrete"
                  values={`0 0;${5 + i} 0;${5 + i} 0;${11 + i * 2} 0;${11 + i * 2} 0;${4 + i} 0;0 0`}
                  keyTimes="0;0.1;0.3;0.4;0.7;0.8;1"
                  dur={`${9 + i * 2}s`}
                  repeatCount="indefinite"
                />
              </g>
            ))
          : null}
        {/* the people who are always here */}
        {s.crowd >= 1 ? (
          <NpcActor npc={NPCS.waiting} x={Z.tram - 20} y={GROUND + 6} facing={1} action="lean" />
        ) : null}
        {s.crowd >= 2 ? (
          <NpcActor npc={NPCS.caller} x={Z.bench + 60} y={GROUND + 12} facing={-1} action="call" />
        ) : null}
        {s.crowd >= 3 ? (
          <NpcActor
            npc={NPCS.student}
            x={Z.totem - 40}
            y={GROUND + 10}
            facing={1}
            action="lookAround"
          />
        ) : null}
        {s.crowd >= 2 ? (
          <NpcActor npc={NPCS.courier} x={Z.bikes - 90} y={GROUND + 8} facing={-1} />
        ) : null}
      </g>
    </svg>
  );
}

/* ================================================================== *
 * foreground — kerb, rails, the tram, the vignette
 * ================================================================== */

const ROAD = pxPath([[0, KERB, W, H - KERB]]);
const RAILS = pxPath([
  [0, KERB + 3, W, 1],
  [0, KERB + 7, W, 1],
]);
/** A Pesa Jazz Duo, side on, red and white, sliding through between stops. */
const TRAM_LEN = 720;
const TRAM_BODY = bevelPaths([[0, 104, TRAM_LEN, 70]]);
const TRAM_BAND = pxPath([[0, 130, TRAM_LEN, 8]]);
const TRAM_WINDOWS = pxPath(repeat(Math.floor(TRAM_LEN / 48), 48, [10, 110, 36, 22] as Rect));
const TRAM_DOORS = pxPath([120, 300, 480, 620].flatMap((x) => [[x, 108, 30, 60] as Rect]));
const TRAM_DOOR_GLASS = pxPath([120, 300, 480, 620].flatMap((x) => [[x + 3, 112, 24, 22] as Rect]));
const TRAM_SKIRT = pxPath([[0, 168, TRAM_LEN, 6]]);
const TRAM_ROOF = pxPath([[4, 100, TRAM_LEN - 8, 4]]);
const TRAM_PANTO = pxPath([
  [300, 92, 40, 2],
  [318, 86, 4, 8],
]);
const TRAM_NOSE = pxPath(steppedRoof(TRAM_LEN - 14, TRAM_LEN + 14, 174, 70, 14, 6));
const FORUM_VIGNETTE = vignettePaths(W, H);

function Foreground({ phase }: { phase: string }) {
  const ph = toPhase(phase);
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
        <path d={ROAD} fill={night ? "#1a1c20" : "#3a3d42"} />
        <path d={RAILS} fill={night ? "#5a5f66" : "#8d9096"} />
        {/* the tram: in from the right, a stop, and away left */}
        <g>
          <g opacity={0.96}>
            <Bev
              set={TRAM_BODY}
              mat={{
                hi: "#e8e6df",
                base: "#d8d5cc",
                mid: "#c8c5bc",
                lo: "#b3b0a8",
                deep: "#7d7a72",
              }}
            />
            <path d={TRAM_ROOF} fill="#6d7278" />
            <path d={TRAM_PANTO} fill="#3a3f45" />
            <path d={TRAM_BAND} fill={K.forumRed} />
            <path d={TRAM_WINDOWS} fill={night ? K.lit : "#2e3640"} opacity={night ? 0.8 : 1} />
            <path d={TRAM_DOORS} fill={K.forumRed} />
            <path d={TRAM_DOOR_GLASS} fill={night ? K.lit : "#2e3640"} opacity={night ? 0.8 : 1} />
            <path d={TRAM_SKIRT} fill="#23262b" />
            <path d={TRAM_NOSE} fill="#d8d5cc" />
          </g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`${W + 40} 0;${W + 40} 0;${Z.tram - 360} 0;${Z.tram - 360} 0;${-TRAM_LEN - 60} 0;${-TRAM_LEN - 60} 0`}
            keyTimes="0;0.55;0.68;0.8;0.92;1"
            dur="70s"
            repeatCount="indefinite"
            calcMode="linear"
          />
        </g>
        <Vignette set={FORUM_VIGNETTE} strength={night ? 1.1 : 0.7} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * the scene
 * ================================================================== */

function ForumScene({ world, phase }: { world: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = state(world, ph);
  return (
    <LayeredScene
      /* the facade is twelve metres away across the water, and the footbridge in
         it has to land on the plaza in the ground plane: it moves with the ground */
      parallax={{ farBackground: 0.3, middleBackground: 1 }}
      farBackground={<Backdrop ph={ph} />}
      middleBackground={<FarSide ph={ph} s={s} />}
      ground={<Ground ph={ph} />}
      staticObjects={<Furniture ph={ph} s={s} />}
    />
  );
}

export const FORUM_SCENE: RuntimeSceneDef<WorldState> = {
  id: "forum",
  width: W,
  spawnX: Z.skm,
  /**
   * The plaza: twenty pixels of granite between the channel railing and the
   * kerb. Everything standing on it is a blocker; the SKM well is a hole and
   * you walk round it.
   */
  ground: {
    top: GROUND,
    bottom: KERB - 2,
    zones: [
      { x0: Z.tram - 62, x1: Z.tram + 62, y0: GROUND, y1: GROUND + 7, kind: "tactile" },
      { x0: 0, x1: W, kind: "granite" },
    ],
    blockers: [
      { x0: Z.skm - 48, y0: GROUND, x1: Z.skm + 48, y1: GROUND + 17 },
      ...PLANTER_X.map((x) => ({ x0: x - 1, y0: GROUND, x1: x + 57, y1: GROUND + 3 })),
      { x0: Z.bench - 33, y0: GROUND, x1: Z.bench + 33, y1: GROUND + 2 },
      { x0: Z.kiosk - 30, y0: GROUND, x1: Z.kiosk + 30, y1: GROUND + 3 },
      { x0: Z.bin - 8, y0: GROUND, x1: Z.bin + 8, y1: GROUND + 2 },
      { x0: Z.totem - 13, y0: GROUND, x1: Z.totem + 13, y1: GROUND + 2 },
      { x0: Z.bikes - 62, y0: GROUND, x1: Z.bikes + 78, y1: GROUND + 2 },
      { x0: Z.tram - 70, y0: GROUND, x1: Z.tram - 60, y1: GROUND + 2 },
      { x0: Z.tram + 60, y0: GROUND, x1: Z.tram + 80, y1: GROUND + 2 },
      ...LAMP_X.map((x) => ({ x0: x - 6, y0: GROUND, x1: x + 7, y1: GROUND + 3 })),
    ],
  },
  artKey: (_w, ph) => ph,
  describe: "Targ Sienny. The station behind you, the Radunia in its channel, the Forum across it.",
  actors: [
    npcToActor(NPCS.spacer, {
      x: 500,
      y: GROUND + 12,
      patrol: { from: 200, to: 1300, speed: 16, pauseMs: 2200 },
      z: 6,
    }),
  ],
  objects: [
    { id: "forum-station", kind: "flavor", x: Z.station, range: 30, approachY: GROUND + 4 },
    /* down into the tunnel, and onto the SKM */
    /* the object sits at the well's right edge, where you step onto the top tread */
    {
      id: "forum-skm",
      kind: "trainDoor",
      priority: 2,
      x: Z.skm + 40,
      range: 50,
      approachX: Z.skm + 60,
      approachY: GROUND + 8,
    },
    {
      id: "forum-bench",
      kind: "sport",
      action: "sit",
      face: 1,
      x: Z.bench,
      range: 30,
      approachY: GROUND + 5,
    },
    { id: "forum-kiosk", kind: "flavor", x: Z.kiosk, range: 28, approachY: GROUND + 6 },
    { id: "forum-pigeons", kind: "flavor", x: Z.pigeons, range: 24, approachY: GROUND + 4 },
    { id: "forum-canal", kind: "flavor", x: Z.canal, range: 40, approachY: GROUND + 2 },
    { id: "forum-bin", kind: "flavor", x: Z.bin, range: 14, approachY: GROUND + 5 },
    { id: "forum-totem", kind: "flavor", x: Z.totem, range: 18, approachY: GROUND + 5 },
    {
      id: "forum-entrance",
      kind: "flavor",
      priority: 1,
      x: Z.entrance,
      range: 44,
      approachY: GROUND + 2,
    },
    { id: "forum-bikes", kind: "flavor", x: Z.bikes, range: 40, approachY: GROUND + 6 },
    { id: "forum-tram", kind: "flavor", x: Z.tram, range: 50, approachY: GROUND + 5 },
    { id: "forum-taxi", kind: "flavor", x: Z.taxi, range: 24, approachY: GROUND + 4 },
  ],
  Component: ({ world, phase }) => <ForumScene world={world} phase={phase} />,
  darkness: (phase) => (phase === "night" ? 0.16 : phase === "dusk" ? 0.05 : 0),
  Foreground: (p) => <Foreground {...p} />,
  Effects: Effects,
  idleLean: true,
};
