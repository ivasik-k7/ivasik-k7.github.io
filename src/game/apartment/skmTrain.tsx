import {
  Bev,
  bevelPaths,
  dim,
  dth,
  type Mat,
  type Ph,
  pxPath,
  type Rect,
  repeat,
  shift,
  textPath,
} from "@/engine";

// --- the SKM unit ------------------------------------------------------------

/**
 * A modern Trójmiasto SKM electric unit, drawn once and used by every train in
 * the game: the express that crosses Przymorze without stopping, the service you
 * board, and anything that passes the window later.
 *
 * The reference is the Impuls the SKM runs now rather than the EN57 it ran for
 * fifty years — a flat-fronted low-floor unit, off-white with a deep blue skirt
 * and a yellow band, plug doors flush with the body side, a big single-piece
 * windscreen and a strip of LED destination display over it. Getting the *front*
 * right is what makes it read as this train and not a generic metro car: the
 * nose is nearly vertical with a shallow rake, the screen is enormous, and the
 * lights are a low horizontal cluster rather than round lamps.
 *
 * ==================================================================
 * SCALE, on the station's key of 38 px per metre. Rail head is y=150 and
 * everything below is measured up from it:
 *
 *   roof line            3.71 m    y=9    floor / platform  0.76 m   y=121
 *   window head          2.76 m    y=45   apron bottom      0.45 m   y=133
 *   window sill          1.76 m    y=83   wheel Ø           0.84 m   32 px
 *   yellow band          1.53 m    y=92   bogie wheelbase   2.50 m   95 px
 *   skirt top            1.39 m    y=97   door opening      1.30 m   49 px
 *
 *   end car             22.37 m  850 px   middle car       14.50 m  551 px
 *   coupled gap          0.50 m   19 px   nose rake         0.63 m   24 px
 *
 * TWO THINGS CHANGED HERE, and both are geometry rather than decoration:
 *
 * 1. The body used to stop at y=148, two pixels above the rail, with the wheels
 *    drawn from y=154 to y=164 — *below the rail head*. Nothing showed it at a
 *    platform, because the coping hides everything under y=121, but a train
 *    crossing on the far road was running on nothing. The apron now ends at
 *    y=133 (0.45 m), the wheels occupy y=118..150 and stand on the rail, and
 *    the visible slice between apron and railhead is the 0.45 m it should be.
 *
 * 2. The bogies are Jacobs bogies, shared between cars and sitting under the
 *    gangway, which is what an Impuls actually has and what makes the joint
 *    read correctly: two cars ride on three bogies, three cars on four. The old
 *    layout gave every car its own pair at an impossible 1.16 m wheelbase.
 *
 * Length is still 1700 px / 44.7 m by default, so every scene that lines up
 * against DOOR_LOCAL keeps lining up. `cars: 3` builds the real 59.7 m set for
 * the trains that only ever pass the window, where nothing has to board.
 *
 * ==================================================================
 * COST. Everything is precomputed at module scope, per car count, into one path
 * per material — a train is well over six hundred rectangles now that it has
 * decals, an interior, running gear and roof equipment, and it emits as about
 * forty <path> nodes no matter how many trains the scene puts on screen. The
 * geometry for a given car count is built once and cached; a second train is
 * free.
 * ==================================================================
 */

/* ------------------------------------------------------------ the key ----- */

const M = 38; // px per metre
const RAIL = 150; // scene y of the rail head
/** metres above the rail head → scene y */
const up = (m: number) => RAIL - Math.round(m * M);

/**
 * A pictogram written as rows of `#`, run-length encoded into rects on the way
 * out. Stickers are the one place in this file where legibility of the *source*
 * matters more than terseness — you have to be able to see the wheelchair.
 */
const glyph = (rows: readonly string[], ox = 0, oy = 0): Rect[] => {
  const out: Rect[] = [];
  rows.forEach((row, ry) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let w = 1;
        while (row[x + w] === "#") w++;
        out.push([ox + x, oy + ry, w, 1]);
        x += w;
      } else x++;
    }
  });
  return out;
};

/** A hollow rectangle, for frames, plates and bezels. */
const outline = (x: number, y: number, w: number, h: number, t = 1): Rect[] => [
  [x, y, w, t],
  [x, y + h - t, w, t],
  [x, y + t, t, h - 2 * t],
  [x + w - t, y + t, t, h - 2 * t],
];

/** Deterministic per-position noise, so weathering and passengers never flicker. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

export const TRAIN = {
  /** drawn length of the default two-car unit, and the local x of the nose */
  len: 1700,
  /** roof line and apron line, in scene y (the rail head is y=150) */
  roof: 9,
  skirt: up(0.45), // 133 — the bottom of the body side, not the rail
  /** saloon floor — and therefore the door threshold — at platform height */
  floor: 121,
  /** glazing */
  sill: 83,
  head: 45,
  /** livery bands */
  band: 92,
  bandH: 5,
  skirtTop: 97,
  /** door leaf openings: local x of the left edge of each 49 px opening */
  doors: [226, 676, 1056, 1506] as const,
  doorW: 49,
  /** where one car ends and the next begins */
  gangway: 840,
  /** running gear */
  rail: RAIL,
  wheelR: 16,
  wheelbase: 95,
} as const;

/** Door centres in the train's own space, for anything that has to line up. */
export const DOOR_LOCAL = TRAIN.doors.map((x) => x + TRAIN.doorW / 2);

/* ------------------------------------------------------------ livery ------ */

const LIVERY = {
  /** the body: warm off-white, never pure white — it is a train, it is filthy */
  shell: { hi: "#f2f0ea", base: "#e2dfd6", mid: "#d6d2c8", lo: "#c4c0b5", deep: "#a09c92" },
  /** the skirt band, SKM deep blue */
  blue: { hi: "#2b6aa8", base: "#12447c", mid: "#0f3b6c", lo: "#0c325c", deep: "#081f3c" },
  /** the band above it */
  yellow: { hi: "#ffdb52", base: "#f2c218", mid: "#dcae12", lo: "#c2990c", deep: "#8a6c06" },
  /** window frames and the door leaf edges */
  frame: { hi: "#8d949a", base: "#6d7278", mid: "#5f646a", lo: "#51565c", deep: "#383c41" },
  /** underfloor and bogie steel */
  steel: { hi: "#5a6067", base: "#43484e", mid: "#3a3e44", lo: "#2f3338", deep: "#22252a" },
} as const satisfies Record<string, Mat>;

/** Decal colours. Kept out of the livery because they never dim with the hour —
 *  retroreflective sheeting is *brighter* at night, which is the whole point. */
const DECAL = {
  plate: "#f4f4f0",
  ink: "#1a1d22",
  blue: "#1b4b96",
  red: "#c22b26",
  green: "#1f8a4c",
  amber: "#f2a516",
  star: "#ffd94a",
} as const;

/** Glass, per phase. Lit from inside after dark, which is most of the point. */
const GLASS: Record<Ph, string> = {
  dawn: "#7a8894",
  day: "#8fa4b2",
  dusk: "#5e6472",
  night: "#2e3640",
};
/** The saloon lighting seen through the glass — cold white, always on. */
const SALOON = "#e6ecd8";

/**
 * The interior, in two states. Not one palette dimmed: the *relationships*
 * invert. With the lights on, the far windows are the darkest thing in the
 * picture — black holes onto a night platform — and the ceiling is the
 * brightest. With them off in daylight, the far windows are the brightest thing
 * in the picture, because they are full of sky, and everything in front of them
 * is a silhouette. Dimming one palette cannot produce both.
 */
const INSIDE = {
  lit: {
    far: "#161c26",
    pillar: "#cdd3d8",
    farSeat: "#33506f",
    seat: "#2f4d72",
    head: "#1b2b45",
    welt: "#5b7ca6",
    arm: "#8f9298",
    table: "#dcded8",
    rack: "#c2c7cb",
    bag: "#6d6257",
    poster: "#b9c4cc",
    rail: "#b9bfc4",
    pole: "#c9ced2",
    body: "#39434c",
    ceil: "#eef2e0",
    light: "#fdffee",
    vent: "#b6bcc0",
  },
  unlit: {
    far: "#9db0bd",
    pillar: "#6d7a85",
    farSeat: "#33414f",
    seat: "#2b3a4a",
    head: "#1b2735",
    welt: "#485d72",
    arm: "#5b646c",
    table: "#7d858a",
    rack: "#79838b",
    bag: "#4a453f",
    poster: "#6c7780",
    rail: "#6f7a83",
    pole: "#79838b",
    body: "#2c3641",
    ceil: "#8e979d",
    light: "#a7b0b3",
    vent: "#69737a",
  },
} as const;
/** Dither, used for glass fall-off and for grime. One call, many opacities. */
const GRIME = dth("c", "12");

const shellFor = (ph: Ph): Mat =>
  ph === "night" ? dim(LIVERY.shell, "#141824", 0.5) : LIVERY.shell;
const blueFor = (ph: Ph): Mat => (ph === "night" ? dim(LIVERY.blue, "#0a0c16", 0.4) : LIVERY.blue);
const yellowFor = (ph: Ph): Mat =>
  ph === "night" ? dim(LIVERY.yellow, "#141020", 0.42) : LIVERY.yellow;
const frameFor = (ph: Ph): Mat =>
  ph === "night" ? dim(LIVERY.frame, "#0e1018", 0.44) : LIVERY.frame;
const steelFor = (ph: Ph): Mat =>
  ph === "night" ? dim(LIVERY.steel, "#0a0c12", 0.45) : LIVERY.steel;

/* =========================================================== pictograms === */

/**
 * The sticker library. Real rolling stock is *covered* in these — a door on an
 * Impuls carries a wheelchair plate, a bicycle plate, the open button, the
 * emergency release, a CCTV notice and a no-smoking roundel inside a metre and
 * a half of each other, and their clutter is a good part of why a photograph of
 * a train never looks as clean as a drawing of one.
 */
const ICON = {
  wheelchair: [
    "   ##    ",
    "   ##    ",
    "         ",
    "  ####   ",
    "  #  #   ",
    " ##  #   ",
    "##   ##  ",
    "#     #  ",
    "#    ##  ",
    " ##### # ",
    "  ###    ",
  ],
  bicycle: [
    "      ##   ",
    "  #####    ",
    " #   #   # ",
    "###  #  ###",
    "# # ### # #",
    "# #  #  # #",
    "###     ###",
  ],
  pram: [
    "     ####",
    "   ##   #",
    "  #     #",
    " #      #",
    "#########",
    "  #   #  ",
    " ### ### ",
    "  #   #  ",
  ],
  noSmoking: [
    "  ####  ",
    " #    # ",
    "#   ## #",
    "#  ## ##",
    "# ##   #",
    "###    #",
    " #    # ",
    "  ####  ",
  ],
  cctv: [
    "  #####  ",
    " #     # ",
    "#  ###  #",
    "#  ###  #",
    " #     # ",
    "  #####  ",
    "    #    ",
    "   ###   ",
  ],
  hammer: [
    "      ###",
    "     ####",
    "    ###  ",
    "   ##    ",
    "  ##     ",
    " ##      ",
    "##       ",
  ],
  extinguisher: ["  ##  ", " #  # ", " #### ", " #  # ", " #### ", " #  # ", " #### ", "  ##  "],
  firstAid: ["  ##  ", "  ##  ", "######", "######", "  ##  ", "  ##  "],
  wifi: ["  ###  ", " #   # ", "#  #  #", "  ###  ", "   #   ", "  ###  ", "   #   "],
  snowflake: ["# # # #", " # # # ", "  ###  ", "#######", "  ###  ", " # # # ", "# # # #"],
  arrowsOut: ["  #  #  ", " ##  ## ", "###  ###", " ##  ## ", "  #  #  "],
  bolt: ["   ##", "  ##  ", " ###  ", "#####", "  ##  ", " ##   ", "##    "],
  exit: ["#   ###", "#  #   ", "#### ##", "#  #  #", "#   ###"],
  toilet: [" #  #  ", "### ###", " #   # ", " #  ## ", "###  # ", " #  ## ", "     # "],
} as const;

/** A pictogram on its own plate: background rect, then the mark on top. */
type Decal = { plate: Rect; mark: Rect[]; plateFill: string; markFill: string };

const decal = (
  rows: readonly string[],
  x: number,
  y: number,
  plateFill: string,
  markFill: string,
  pad = 2,
): Decal => {
  const w = Math.max(...rows.map((r) => r.length)) + pad * 2;
  const h = rows.length + pad * 2;
  return {
    plate: [x, y, w, h],
    mark: glyph(rows, x + pad, y + pad),
    plateFill,
    markFill,
  };
};

/**
 * The EU co-financing plaque. Every Impuls the SKM bought came with Operational
 * Programme money and every one of them carries this: a blue rectangle with a
 * ring of yellow stars and a line of small type. It is the single most
 * Polish-rolling-stock detail available.
 */
const EU_PLAQUE = (x: number, y: number) => {
  const stars: Rect[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    stars.push([x + 9 + Math.round(Math.cos(a) * 6), y + 8 + Math.round(Math.sin(a) * 5), 1, 1]);
  }
  return { plate: [x, y, 19, 17] as Rect, stars };
};

/* =========================================================== geometry ===== */

type Cars = 2 | 3;

type Layout = {
  len: number;
  /** drawn body spans, per car */
  spans: [number, number][];
  /** local x of each door opening's left edge */
  doors: number[];
  /** x of each gangway centre */
  joints: number[];
  /** x of each bogie centre — Jacobs bogies sit on the joints */
  bogies: number[];
};

const CAR = { end: 850, mid: 551, gap: 19, nose: 24, cab: 160 } as const;

function layoutFor(cars: Cars): Layout {
  if (cars === 3) {
    return {
      len: 2270,
      spans: [
        [0, 830],
        [849, 1400],
        [1419, 2270],
      ],
      doors: [226, 676, 960, 1230, 1626, 2076],
      joints: [840, 1410],
      bogies: [120, 840, 1410, 2140],
    };
  }
  return {
    len: 1700,
    spans: [
      [0, 830],
      [849, 1700],
    ],
    doors: [...TRAIN.doors],
    joints: [840],
    bogies: [120, 840, 1570],
  };
}

/**
 * Window bays for one panel of body side, centred in the panel rather than
 * left-aligned — a train's glazing is symmetric about its door pillars and the
 * eye catches it immediately when it is not.
 */
function bays(from: number, to: number, pitch = 62, glass = 52): Rect[] {
  const span = to - from;
  const n = Math.floor((span + (pitch - glass)) / pitch);
  if (n <= 0) return [];
  const width = n * pitch - (pitch - glass);
  const start = from + Math.round((span - width) / 2);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    out.push([start + i * pitch, TRAIN.head, glass, TRAIN.sill - TRAIN.head]);
  }
  return out;
}

/** One wheel, stepped into something round enough at 32 px. */
function wheel(cx: number): Rect[] {
  return [
    [cx - 9, 118, 18, 2],
    [cx - 13, 120, 26, 3],
    [cx - 15, 123, 30, 4],
    [cx - 16, 127, 32, 10],
    [cx - 15, 137, 30, 4],
    [cx - 13, 141, 26, 3],
    [cx - 9, 144, 18, 4],
    [cx - 4, 148, 8, 2],
  ];
}
/** The brake disc inside it, a shade lighter than the tyre. */
function disc(cx: number): Rect[] {
  return [
    [cx - 6, 124, 12, 2],
    [cx - 9, 126, 18, 12],
    [cx - 6, 138, 12, 2],
    [cx - 2, 130, 4, 4],
  ];
}

type Geo = ReturnType<typeof buildGeo>;

function buildGeo(cars: Cars) {
  const L = layoutFor(cars);
  const len = L.len;
  const noseX = len - CAR.nose;
  const { roof, skirt, floor, sill, head, band, bandH, skirtTop, doorW } = TRAIN;

  /* ---- shell ------------------------------------------------------------ */

  /** Five steps over 0.63 m, which at this key is the whole rake of an Impuls. */
  const nose: Rect[] = [
    [len - 6, roof + 16, 6, skirt - roof - 22],
    [len - 12, roof + 9, 6, skirt - roof - 13],
    [len - 18, roof + 5, 6, skirt - roof - 8],
    [len - 24, roof + 2, 6, skirt - roof - 4],
  ];
  const body: Rect[] = [
    ...L.spans.map(([a, b], i) => {
      const last = i === L.spans.length - 1;
      return [a, roof, (last ? noseX : b) - a, skirt - roof] as Rect;
    }),
    ...nose,
  ];
  const bodySet = bevelPaths(body);

  /** The roof camber: two steps of shadow so the shell is not a flat slab. */
  const camber = pxPath([
    ...L.spans.map(([a, b], i) => [a, roof, (i === L.spans.length - 1 ? noseX : b) - a, 2] as Rect),
    ...L.spans.map(
      ([a, b], i) => [a + 2, roof + 2, (i === L.spans.length - 1 ? noseX : b) - a - 4, 1] as Rect,
    ),
  ]);
  /** Rain gutter under the roof edge, and the drip line it leaves on the shell. */
  const gutter = pxPath(
    L.spans.map(
      ([a, b], i) => [a, roof + 3, (i === L.spans.length - 1 ? noseX : b) - a, 1] as Rect,
    ),
  );

  /* ---- glazing ---------------------------------------------------------- */

  /** Window panels: between car end, doors, and the cab. */
  const windows: Rect[] = [];
  L.spans.forEach(([a, b], i) => {
    const last = i === L.spans.length - 1;
    const right = last ? len - CAR.cab : b;
    const inCar = L.doors.filter((d) => d > a && d < right);
    let cursor = a + 14;
    for (const d of inCar) {
      windows.push(...bays(cursor, d - 8));
      cursor = d + doorW + 8;
    }
    windows.push(...bays(cursor, right - 14));
  });

  const windowGlass = pxPath(windows);
  const windowFrames = pxPath(
    windows.flatMap(([x, y, w, h]) => outline(x - 2, y - 2, w + 4, h + 4, 2)),
  );
  /** The rubber inside the frame, which is what actually reads as a train window. */
  const windowSeal = pxPath(windows.flatMap(([x, y, w, h]) => outline(x - 1, y - 1, w + 2, h + 2)));
  /** Panel seams between bays: the body side is bolted plate, not one skin. */
  const seams = pxPath(
    windows.map(([x, , w]) => [x + w + 4, roof + 4, 1, sill + 8 - roof] as Rect),
  );

  /* ---- the saloon, seen through the glass -------------------------------- */

  /**
   * What you see through a train window, painted back to front: the far side
   * glazing with the daylight still in it, the far row of seats against that,
   * the aisle, then the near row with heads above it. Drawing it in that order
   * is the whole trick. The old version filled one flat lit panel and hung two
   * seat blocks on it, and a flat panel is what makes a drawn train read as a
   * cardboard cut-out even when every exterior detail is right.
   *
   * The vertical budget inside the 38 px of glass, measured off the floor:
   *
   *   y=45   2.00 m   ceiling, light diffusers, air vents
   *   y=51   1.84 m   luggage rack and what is on it
   *   y=56   1.71 m   horizontal grab rail
   *   y=55   1.74 m   standing heads
   *   y=62   1.55 m   seated heads
   *   y=68   1.39 m   headrests, far seat backs
   *   y=72   1.29 m   near seat backs
   *   y=83   1.00 m   the sill, below which it is all body side
   *
   * Which is why a passenger reads at all: a seated head has six pixels of
   * clear air between the headrest and the grab rail, and that gap is the only
   * place a person can be seen. Move the seats up two pixels and the saloon
   * goes empty.
   */

  /** Impuls seating alternates: airline rows, then a facing bay with a table. */
  const bayType = (i: number) => (i % 3 === 1 ? "table" : "rows");

  /** The far side of the car: its own glazing, on its own pillar pitch so the
   *  eye never mistakes it for a mirror of the near side. */
  const farGlass = pxPath(windows.map(([x, y, w]) => [x + 1, y + 2, w - 2, 25] as Rect));
  const farPillars = pxPath(
    windows.flatMap(
      ([x, y, w]) =>
        [
          [x + 14, y + 2, 5, 25],
          [x + w - 19, y + 2, 5, 25],
        ] as Rect[],
    ),
  );
  const farSeats = pxPath(
    windows.flatMap(
      ([x, y, w]) =>
        [
          [x + 3, y + 21, 17, 9],
          [x + w - 20, y + 21, 17, 9],
        ] as Rect[],
    ),
  );

  /** Ceiling: the diffuser strip, the air vents beside it, a CCTV dome. */
  const ceiling = pxPath(windows.map(([x, y, w]) => [x + 1, y, w - 2, 4] as Rect));
  const diffusers = pxPath(windows.map(([x, y, w]) => [x + 6, y + 1, w - 12, 2] as Rect));
  const vents = pxPath(windows.flatMap(([x, y]) => repeat(5, 6, [x + 8, y + 4, 3, 1] as Rect)));
  const domes = pxPath(
    windows.flatMap(([x, y, w], i) =>
      i % 4 === 2 ? ([[x + Math.round(w / 2) - 3, y + 4, 6, 3]] as Rect[]) : [],
    ),
  );

  /** Luggage rack, and the bags people actually put on it. */
  const rack = pxPath(windows.map(([x, y, w]) => [x + 2, y + 6, w - 4, 2] as Rect));
  const bags = pxPath(
    windows.flatMap(([x, y, w]) => {
      const out: Rect[] = [];
      if (hash(x) > 0.5) out.push([x + 8, y + 1, 13, 5], [x + 24, y + 2, 9, 4]);
      else if (hash(x + 9) > 0.55) out.push([x + w - 23, y + 2, 12, 4]);
      return out;
    }),
  );
  /** The route diagram and the advertising frame on the far wall. */
  const posters = pxPath(
    windows.flatMap(([x, y, w], i) =>
      i % 3 === 0 ? ([[x + Math.round(w / 2) - 8, y + 9, 16, 9]] as Rect[]) : [],
    ),
  );
  const grabRail = pxPath(windows.map(([x, y, w]) => [x + 1, y + 11, w - 2, 1] as Rect));
  const poles = pxPath(
    windows.flatMap(([x, y, w, h], i) =>
      bayType(i) === "table"
        ? ([[x + Math.round(w / 2) - 1, y, 2, h]] as Rect[])
        : ([[x + w - 5, y, 2, h]] as Rect[]),
    ),
  );

  /**
   * The near row. A seat is a back, a darker headrest, a bright welt along the
   * top of the moquette and an armrest nub on the aisle side — four rects that
   * at this size read as upholstery rather than a box, which one rect never
   * does.
   */
  const seatBacks: Rect[] = [];
  const headrests: Rect[] = [];
  const welts: Rect[] = [];
  const armrests: Rect[] = [];
  const tables: Rect[] = [];
  windows.forEach(([x, y, w, h], i) => {
    const bottom = y + h;
    const seat = (sx: number, sw: number) => {
      seatBacks.push([sx, y + 27, sw, bottom - (y + 27)]);
      headrests.push([sx + 1, y + 23, sw - 2, 5]);
      welts.push([sx + 2, y + 28, sw - 4, 1]);
      armrests.push([sx + sw, y + 31, 2, 2]);
    };
    if (bayType(i) === "table") {
      seat(x + 2, 15);
      seat(x + w - 17, 15);
      tables.push([x + 19, y + 33, 15, 2], [x + 25, y + 35, 3, bottom - (y + 35)]);
    } else {
      seat(x + 1, 15);
      seat(x + 18, 15);
      seat(x + 35, 15);
    }
  });
  const seatBackPath = pxPath(seatBacks);
  const headrestPath = pxPath(headrests);
  const weltPath = pxPath(welts);
  const armrestPath = pxPath(armrests);
  const tablePath = pxPath(tables);

  /**
   * Riders. Seeded off each bay's own x so a train that passes twice is carrying
   * the same people, and precomputed at three densities — a Sunday morning
   * service and the 07:41 into Gdańsk are not the same train, and the difference
   * is entirely in the glass.
   */
  const ridersAt = (t: number) => {
    const out: Rect[] = [];
    windows.forEach(([x, y, w], i) => {
      const spots = bayType(i) === "table" ? [x + 5, x + w - 14] : [x + 4, x + 21, x + 38];
      spots.forEach((sx, k) => {
        if (hash(x + k * 31 + i) < t) return;
        const hy = y + 17 + Math.round(hash(x + k * 7) * 2);
        out.push([sx, hy, 6, 6], [sx - 2, hy + 6, 10, 9]);
      });
      /* someone standing in the aisle, behind the near seats */
      if (hash(x * 1.7 + 5) > t + 0.12) {
        const sx = x + 12 + Math.round(hash(x + 3) * (w - 30));
        out.push([sx, y + 10, 6, 6], [sx - 1, y + 16, 8, 17]);
      }
    });
    return pxPath(out);
  };
  const ridersQuiet = ridersAt(0.68);
  const ridersNormal = ridersAt(0.42);
  const ridersBusy = ridersAt(0.14);

  /** Reflection across the glass, condensation at the bottom of it after dark. */
  const sheen = pxPath(
    windows.flatMap(([x, y]) => {
      const out: Rect[] = [];
      for (let k = 0; k < 8; k++) out.push([x + 4 + k * 5, y + 2 + k * 4, 5, 4]);
      return out;
    }),
  );
  const condensation = pxPath(windows.map(([x, y, w, h]) => [x + 1, y + h - 7, w - 2, 6] as Rect));
  /** The emergency hammer, which lives on the glass and not on the body. */
  const glassMarks = pxPath(
    windows.flatMap(([x, y, w], i) => (i % 2 === 0 ? ([[x + w - 9, y + 3, 6, 6]] as Rect[]) : [])),
  );

  /**
   * The vestibule, seen through the door glass and straight into when the leaves
   * are open: the far door on the other side of the car, a handrail, the tip-up
   * seats in the multipurpose bay, and a bin.
   */
  const vestibule: Rect[] = [];
  const vestibuleDark: Rect[] = [];
  L.doors.forEach((x, i) => {
    vestibuleDark.push([x + 9, head + 6, doorW - 18, floor - head - 16]);
    vestibule.push(
      [x + 3, head + 8, 2, 44],
      [x + doorW - 6, head + 8, 2, 44],
      [x + Math.round(doorW / 2) - 1, head + 6, 2, floor - head - 16],
    );
    if (i % 2 === 1) vestibule.push([x + doorW - 14, head + 46, 10, 4]);
    else vestibule.push([x + 6, head + 52, 7, 12]);
  });
  const vestibulePath = pxPath(vestibule);
  const vestibuleFar = pxPath(vestibuleDark);
  /** Somebody waiting by the doors, which is where people actually stand. */
  const doorRiders = pxPath(
    L.doors.flatMap((x, i) => {
      if (hash(x + i) < 0.4) return [];
      const sx = x + 12 + Math.round(hash(x) * 16);
      return [
        [sx, head + 14, 7, 7],
        [sx - 1, head + 21, 9, 20],
      ] as Rect[];
    }),
  );

  /** Side destination displays, one per car, above the window line. */
  const sideDisplays = L.spans.map(([a]) => ({ x: a + 150, y: 28, w: 96 }));
  const sideDisplayBox = pxPath(sideDisplays.map((d) => [d.x, d.y, d.w, 12] as Rect));
  const sideDisplayGrid = pxPath(
    sideDisplays.flatMap((d) => repeat(24, 4, [d.x + 2, d.y + 2, 1, 8] as Rect)),
  );

  /* ---- doors ------------------------------------------------------------ */

  const doorJamb = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x - 2, head, 2, floor - head],
          [x + doorW, head, 2, floor - head],
          [x - 2, head - 2, doorW + 4, 2],
        ] as Rect[],
    ),
  );
  const doorVoid = pxPath(L.doors.map((x) => [x, head, doorW, floor - head] as Rect));
  const doorStep = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x - 2, floor, doorW + 4, 3],
          [x + 2, floor + 3, doorW - 4, 2],
        ] as Rect[],
    ),
  );
  /** The retractable gap-filler under the threshold, extended at a platform. */
  const doorTread = pxPath(L.doors.map((x) => [x + 3, floor + 5, doorW - 6, 2] as Rect));

  const LEAF_W = doorW / 2;
  const leavesL = L.doors.map((x) => [x, head, LEAF_W, floor - head] as Rect);
  const leavesR = L.doors.map((x) => [x + LEAF_W, head, LEAF_W, floor - head] as Rect);
  const leafLSet = bevelPaths(leavesL);
  const leafRSet = bevelPaths(leavesR);
  /**
   * Leaf glazing, one path per leaf rather than one for both.
   *
   * It used to be a single path holding the glass of every leaf on the train,
   * rendered inside a group that translated by `-slide` — so when the doors
   * opened, the right-hand leaves slid right and their glass slid left with the
   * left-hand ones, straight out through the body side. The same group was also
   * given `opacity: doors.mode === "open" ? 0 : 1`, which hid the glazing
   * outright rather than moving it, and never fired at all in `cycle` mode
   * because that mode's name is neither "open" nor "shut".
   *
   * Two paths, each in the group that carries its own leaf, and the glass goes
   * where the leaf goes.
   */
  const glassOf = (leaves: Rect[]) =>
    pxPath(leaves.map(([x, y]) => [x + 3, y + 6, LEAF_W - 6, 44] as Rect));
  const sealOf = (leaves: Rect[]) =>
    pxPath(leaves.map(([x, y]) => [x + 2, y + 5, LEAF_W - 4, 1] as Rect));
  const leafGlassL = glassOf(leavesL);
  const leafGlassR = glassOf(leavesR);
  const leafSealL = sealOf(leavesL);
  const leafSealR = sealOf(leavesR);
  /** The closing edge: black rubber on one leaf, and the TSI contrast strip. */
  const leafEdgeL = pxPath(leavesL.map(([x, y, w, h]) => [x + w - 2, y, 2, h] as Rect));
  const leafEdgeR = pxPath(leavesR.map(([x, y, , h]) => [x, y, 2, h] as Rect));
  const leafBandL = pxPath(leavesL.map(([x, y, w]) => [x + 1, y + 52, w - 2, 3] as Rect));
  const leafBandR = pxPath(leavesR.map(([x, y, w]) => [x + 1, y + 52, w - 2, 3] as Rect));

  /** The open button, its LED ring, and the yellow the SKM paints round its doors. */
  const buttonBody = pxPath(L.doors.map((x) => [x + doorW + 4, 76, 7, 9] as Rect));
  const buttonRing = pxPath(L.doors.flatMap((x) => outline(x + doorW + 3, 75, 9, 11)));
  const buttonMark = pxPath(
    L.doors.flatMap((x) => glyph(ICON.arrowsOut, x + doorW + 4, 78).map((r) => r)),
  );
  const doorSurround = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x - 5, head - 5, doorW + 10, 3],
          [x - 5, head - 5, 3, floor - head + 5],
          [x + doorW + 2, head - 5, 3, floor - head + 5],
        ] as Rect[],
    ),
  );
  /** Grab handles either side of the opening, yellow, which is a rule not a choice. */
  const doorHandles = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x - 8, 62, 2, 34],
          [x + doorW + 12, 62, 2, 34],
        ] as Rect[],
    ),
  );

  /* ---- decals ----------------------------------------------------------- */

  /**
   * Placed door by door: an accessibility plate on the left of the opening, a
   * notice cluster on the right under the button, and the emergency release
   * below that. Alternating doors get the wheelchair or the bicycle, which is
   * how the real sets are marked — not every door takes a bike.
   */
  const platesBlue: Rect[] = [];
  const marksWhite: Rect[] = [];
  const platesWhite: Rect[] = [];
  const marksInk: Rect[] = [];
  const platesRed: Rect[] = [];
  const marksOnRed: Rect[] = [];
  const platesGreen: Rect[] = [];
  const marksOnGreen: Rect[] = [];

  const push = (d: Decal) => {
    if (d.plateFill === DECAL.blue) {
      platesBlue.push(d.plate);
      marksWhite.push(...d.mark);
    } else if (d.plateFill === DECAL.red) {
      platesRed.push(d.plate);
      marksOnRed.push(...d.mark);
    } else if (d.plateFill === DECAL.green) {
      platesGreen.push(d.plate);
      marksOnGreen.push(...d.mark);
    } else {
      platesWhite.push(d.plate);
      marksInk.push(...d.mark);
    }
  };

  /**
   * What a door actually carries.
   *
   * This was six plates per door — wheelchair, pram, no-smoking, CCTV, hammer
   * and a green exit sign — plus a three-icon comfort cluster per car and two
   * more on the cab car. Fifteen white plates on a two-car unit, each 13×15 px
   * at a key where that is 34 by 39 centimetres. At the scale the game renders
   * at, the side of the train became a noticeboard: the signage was the first
   * thing the eye found and it read as interface stuck onto the artwork rather
   * than as a train.
   *
   * A real Impuls door has one accessibility pictogram beside it, the door
   * button, and a small do-not-lean strip. The emergency release is behind a
   * flap and you cannot see it from the platform at all. So: one decal per door,
   * alternating wheelchair and bicycle the way the real units alternate, at
   * `pad = 1` — 11×13 px, which is 29 by 34 cm and about right for a decal you
   * are meant to read from two metres.
   *
   * The rest is not deleted from the icon set, only from the train. There is a
   * carriage interior in this game and that is where a first-aid or a CCTV
   * sticker belongs — close enough to be worth drawing.
   */
  L.doors.forEach((x, i) => {
    const accessible = i % 2 === 1;
    push(
      decal(accessible ? ICON.wheelchair : ICON.bicycle, x - 16, 90, DECAL.blue, DECAL.plate, 1),
    );
  });

  /** One per unit, on the cab car, where the real one is. */
  push(decal(ICON.extinguisher, len - 138, 100, DECAL.plate, DECAL.red, 1));

  const decalPlateBlue = pxPath(platesBlue);
  const decalPlateWhite = pxPath(platesWhite);
  const decalPlateRed = pxPath(platesRed);
  const decalPlateGreen = pxPath(platesGreen);
  const decalMarkWhite = pxPath(marksWhite);
  const decalMarkInk = pxPath(marksInk);
  const decalMarkOnRed = pxPath(marksOnRed);
  const decalMarkOnGreen = pxPath(marksOnGreen);

  /** EU plaque, one per car, low on the white above the band. */
  const plaques = L.spans.map(([a]) => EU_PLAQUE(a + 96, 84));
  const plaquePlate = pxPath(plaques.map((p) => p.plate));
  const plaqueStars = pxPath(plaques.flatMap((p) => p.stars));

  /** Jacking points: yellow chevrons on the apron where the lifts go. */
  const jackPoints = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 46, 124, 8, 2],
          [x - 44, 126, 4, 2],
          [x + 38, 124, 8, 2],
          [x + 40, 126, 4, 2],
        ] as Rect[],
    ),
  );
  /** TSI retroreflective end markings, and the high-voltage triangle by the pan. */
  const reflectors = pxPath(
    L.spans.flatMap(
      ([a, b], i) =>
        [
          [a + 3, 100, 4, 22],
          [(i === L.spans.length - 1 ? noseX : b) - 7, 100, 4, 22],
        ] as Rect[],
    ),
  );
  const hvTriangle = pxPath([
    [L.bogies[1] - 90, 24, 2, 2],
    [L.bogies[1] - 92, 26, 6, 2],
    [L.bogies[1] - 94, 28, 10, 2],
    [L.bogies[1] - 96, 30, 14, 2],
  ]);
  const hvBolt = pxPath(glyph(ICON.bolt, L.bogies[1] - 92, 25));

  /** Graffiti, for the trains that have been sitting in Gdynia Cisowa a while. */
  const graffiti = pxPath([
    [len - 700, 104, 3, 16],
    [len - 697, 102, 12, 3],
    [len - 692, 105, 3, 14],
    [len - 686, 108, 14, 3],
    [len - 684, 100, 3, 20],
    [len - 675, 104, 10, 3],
    [len - 668, 107, 3, 13],
    [len - 660, 101, 3, 19],
    [len - 657, 101, 11, 3],
    [len - 650, 110, 3, 10],
  ]);

  /* ---- livery bands ----------------------------------------------------- */

  const skirtBand = pxPath([[0, skirtTop, noseX, skirt - skirtTop]]);
  const skirtHi = pxPath([[0, skirtTop, noseX, 1]]);
  const bandStripe = pxPath([[0, band, noseX + 2, bandH]]);
  const bandShade = pxPath([[0, band + bandH - 1, noseX + 2, 1]]);
  /** The cab flash: the SKM's signature, stepped so it stays pixel art. */
  const flash = pxPath(
    Array.from({ length: 14 }, (_, i) => [len - 210 + i * 13, 96 + i * 3, 13, 5] as Rect),
  );
  const flashEdge = pxPath(
    Array.from({ length: 14 }, (_, i) => [len - 210 + i * 13, 94 + i * 3, 13, 2] as Rect),
  );

  /* ---- gangway ---------------------------------------------------------- */

  const gangway = pxPath(
    L.joints.flatMap(
      (x) =>
        [
          [x - 10, roof + 6, 19, floor - roof - 6],
          [x - 4, floor, 7, skirt - floor],
        ] as Rect[],
    ),
  );
  const gangwayRibs = pxPath(
    L.joints.flatMap((x) => repeat(6, 3, [x - 9, roof + 8, 1, floor - roof - 10] as Rect)),
  );
  const gangwayHood = pxPath(L.joints.map((x) => [x - 11, roof + 4, 21, 3] as Rect));

  /* ---- cab -------------------------------------------------------------- */

  const screen = pxPath([
    [len - 150, head - 8, 118, 58],
    [len - 32, head - 3, 8, 48],
    [len - 24, head + 1, 6, 40],
  ]);
  const screenMask = pxPath([
    [len - 152, head - 10, 130, 3],
    [len - 152, head + 50, 122, 3],
    [len - 152, head - 10, 3, 62],
  ]);
  /** Sun visor, pulled halfway down on the driver's side. */
  const visor = pxPath([[len - 148, head - 6, 60, 9]]);
  const wipers = pxPath([
    [len - 104, head + 42, 52, 2],
    [len - 54, head + 26, 2, 17],
    [len - 56, head + 24, 6, 2],
    [len - 40, head + 40, 16, 2],
  ]);
  const washers = pxPath([
    [len - 120, head - 12, 3, 2],
    [len - 70, head - 12, 3, 2],
  ]);
  /** The driver: a head and shoulders at the desk, right of the screen. */
  const driver = pxPath([
    [len - 62, head + 14, 9, 9],
    [len - 66, head + 23, 17, 22],
  ]);
  const desk = pxPath([[len - 150, head + 38, 96, 12]]);
  const deskGlow = pxPath([
    [len - 142, head + 40, 26, 4],
    [len - 110, head + 40, 14, 4],
  ]);

  /** Destination display: a dot-matrix strip with the grid drawn over it. */
  const destBox = pxPath([[len - 152, roof + 5, 122, 17]]);
  const destGrid = pxPath(repeat(30, 4, [len - 150, roof + 6, 1, 15] as Rect));
  const destBezel = pxPath(outline(len - 154, roof + 3, 126, 21, 2));

  /** Headlights: a low horizontal cluster in a black bezel, not round lamps. */
  const lampBezel = pxPath([
    [len - 154, 96, 32, 22],
    [len - 48, 96, 28, 22],
  ]);
  const lights = pxPath([
    [len - 150, 100, 24, 7],
    [len - 44, 100, 20, 7],
  ]);
  const lightLens = pxPath([
    ...repeat(4, 6, [len - 149, 101, 4, 5] as Rect),
    ...repeat(3, 6, [len - 43, 101, 4, 5] as Rect),
  ]);
  const tailLights = pxPath([
    [len - 150, 109, 24, 5],
    [len - 44, 109, 20, 5],
  ]);
  /** Number plate on the nose, horn grille under the screen, front handrails. */
  const numberPlate = pxPath([[len - 108, 96, 44, 11]]);
  const hornGrille = pxPath(repeat(7, 3, [len - 100, 86, 2, 7] as Rect));
  const frontRails = pxPath([
    [len - 158, 60, 2, 34],
    [len - 18, 60, 2, 30],
  ]);
  /** Coupler, hoses, plough. A Scharfenberg head is a box and two pipes at this key. */
  const plough = pxPath([
    [len - 34, 126, 34, 10],
    [len - 26, 136, 26, 6],
    [len - 20, 142, 20, 4],
  ]);
  const coupler = pxPath([
    [len - 16, 116, 16, 12],
    [len - 22, 119, 6, 6],
  ]);
  const hoses = pxPath([
    [len - 30, 118, 2, 8],
    [len - 26, 120, 2, 7],
  ]);
  /** The cab side door, with its window, handle and step. */
  const cabDoor = pxPath(outline(len - 176, head - 2, 34, floor - head + 2, 2));
  const cabDoorGlass = pxPath([[len - 170, head + 3, 22, 30]]);
  const cabDoorFittings = pxPath([
    [len - 150, head + 40, 5, 3],
    [len - 174, floor, 30, 3],
  ]);
  /** The camera arm that replaced the mirror. */
  const cameraArm = pxPath([
    [len - 160, 30, 12, 2],
    [len - 152, 24, 3, 7],
    [len - 155, 21, 8, 4],
  ]);

  /* ---- roof ------------------------------------------------------------- */

  const roofLine = pxPath([[0, roof, noseX, 3]]);
  const acUnits = pxPath(
    L.spans.flatMap(
      ([a, b], i) =>
        [
          [a + 120, roof - 5, 130, 5],
          [a + 124, roof - 7, 122, 2],
          ...(i === L.spans.length - 1 && b - a > 700
            ? ([[a + 470, roof - 5, 120, 5]] as Rect[])
            : []),
        ] as Rect[],
    ),
  );
  const acGrilles = pxPath(
    L.spans.flatMap(([a]) => repeat(14, 8, [a + 126, roof - 4, 4, 3] as Rect)),
  );
  /**
   * The pantograph is folded. This is 25 kV overhead and the pan is up in
   * reality, but the wire is above the frame in this scene, so a pan drawn up
   * would run out of the top of the picture and read as a mistake. Folded is
   * the honest crop — and folded still gets its well, its arms, its four
   * insulators and the earthing switch beside it.
   */
  const panWell = pxPath([[L.bogies[1] - 100, roof - 3, 170, 3]]);
  const panArms = pxPath([
    [L.bogies[1] - 94, roof - 6, 86, 3],
    [L.bogies[1] - 20, roof - 8, 68, 2],
    [L.bogies[1] - 90, roof - 8, 10, 2],
  ]);
  const insulators = pxPath([
    [L.bogies[1] - 98, roof - 9, 4, 4],
    [L.bogies[1] - 30, roof - 9, 4, 4],
    [L.bogies[1] + 30, roof - 9, 4, 4],
    [L.bogies[1] + 62, roof - 9, 4, 4],
  ]);
  const hvDuct = pxPath([[L.bogies[1] + 66, roof - 4, 300, 3]]);
  const antennas = pxPath([
    [L.spans[0][0] + 300, roof - 12, 2, 8],
    [L.spans[0][0] + 299, roof - 14, 4, 2],
    [len - 260, roof - 10, 8, 4],
    [len - 200, roof - 9, 12, 3],
  ]);
  const roofWalk = pxPath(
    L.spans.flatMap(([a, b], i) =>
      repeat(Math.max(1, Math.floor(((i === L.spans.length - 1 ? noseX : b) - a - 40) / 24)), 24, [
        a + 20,
        roof + 1,
        14,
        1,
      ] as Rect),
    ),
  );

  /* ---- underframe and running gear -------------------------------------- */

  const underframe = pxPath([[0, floor, noseX - 2, skirt - floor]]);
  /** Equipment: converter, batteries, air reservoirs, and the cable run. */
  const boxes: Rect[] = [];
  L.spans.forEach(([a, b], i) => {
    const right = i === L.spans.length - 1 ? noseX : b;
    boxes.push([a + 60, floor + 2, 120, 14], [a + 200, floor + 4, 70, 11]);
    if (right - a > 600) boxes.push([a + 430, floor + 2, 110, 14], [a + 560, floor + 5, 60, 9]);
  });
  const underBoxes = pxPath(boxes);
  const underBoxSet = bevelPaths(boxes);
  const airTanks = pxPath(
    L.spans.flatMap(
      ([a]) =>
        [
          [a + 300, floor + 6, 96, 8],
          [a + 296, floor + 8, 4, 4],
          [a + 396, floor + 8, 4, 4],
        ] as Rect[],
    ),
  );
  const cabling = pxPath(
    L.spans.map(
      ([a, b], i) =>
        [a + 20, floor + 16, (i === L.spans.length - 1 ? noseX : b) - a - 40, 2] as Rect,
    ),
  );

  const bogieFrames = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 64, 126, 128, 12],
          [x - 58, 138, 116, 4],
        ] as Rect[],
    ),
  );
  /** Air springs, primary coils, dampers, axle boxes. */
  const suspension = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 40, 120, 24, 7],
          [x + 16, 120, 24, 7],
          [x - 56, 128, 6, 8],
          [x + 50, 128, 6, 8],
          [x - 34, 132, 3, 9],
          [x - 30, 130, 3, 9],
          [x + 28, 132, 3, 9],
          [x + 32, 130, 3, 9],
        ] as Rect[],
    ),
  );
  const axleBoxes = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 55, 122, 16, 8],
          [x + 39, 122, 16, 8],
        ] as Rect[],
    ),
  );
  /** Sandboxes, and the ETCS antenna slung between the axles. */
  const sanders = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 62, 130, 7, 10],
          [x + 55, 130, 7, 10],
          [x - 58, 140, 3, 6],
          [x + 57, 140, 3, 6],
        ] as Rect[],
    ),
  );
  const antenna = pxPath(L.bogies.map((x) => [x - 14, 138, 28, 5] as Rect));

  const wheels = pxPath(
    L.bogies.flatMap((x) => [...wheel(x - TRAIN.wheelbase / 2), ...wheel(x + TRAIN.wheelbase / 2)]),
  );
  const discs = pxPath(
    L.bogies.flatMap((x) => [...disc(x - TRAIN.wheelbase / 2), ...disc(x + TRAIN.wheelbase / 2)]),
  );
  const tyres = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - TRAIN.wheelbase / 2 - 16, 131, 32, 3],
          [x + TRAIN.wheelbase / 2 - 16, 131, 32, 3],
        ] as Rect[],
    ),
  );

  /* ---- weathering ------------------------------------------------------- */

  /** Brake dust over the bogies, and the mud the valance throws up. */
  const brakeDust = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 70, 112, 140, 21],
          [x - 50, 104, 100, 8],
        ] as Rect[],
    ),
  );
  /** Water streaks under every window, which is what actually ages a train. */
  const streaks = pxPath(
    windows.flatMap(([x, y, w, h]) => {
      const out: Rect[] = [];
      for (let i = 0; i < 5; i++) {
        const sx = x + 4 + Math.round(hash(x + i * 13) * (w - 8));
        out.push([sx, y + h + 3, 1, 4 + Math.round(hash(x + i) * 9)]);
      }
      return out;
    }),
  );
  const roofGrime = pxPath(
    L.spans.map(
      ([a, b], i) => [a, roof + 3, (i === L.spans.length - 1 ? noseX : b) - a, 7] as Rect,
    ),
  );

  return {
    len,
    doors: L.doors,
    spans: L.spans,
    bogies: L.bogies,
    noseX,
    bodySet,
    camber,
    gutter,
    windowGlass,
    windowFrames,
    windowSeal,
    seams,
    farGlass,
    farPillars,
    farSeats,
    ceiling,
    diffusers,
    vents,
    domes,
    rack,
    bags,
    posters,
    grabRail,
    poles,
    seatBackPath,
    headrestPath,
    weltPath,
    armrestPath,
    tablePath,
    ridersQuiet,
    ridersNormal,
    ridersBusy,
    sheen,
    condensation,
    glassMarks,
    vestibulePath,
    vestibuleFar,
    doorRiders,
    sideDisplays,
    sideDisplayBox,
    sideDisplayGrid,
    doorJamb,
    doorVoid,
    doorStep,
    doorTread,
    leafLSet,
    leafRSet,
    leafGlassL,
    leafGlassR,
    leafSealL,
    leafSealR,
    leafEdgeL,
    leafEdgeR,
    leafBandL,
    leafBandR,
    buttonBody,
    buttonRing,
    buttonMark,
    doorSurround,
    doorHandles,
    decalPlateBlue,
    decalPlateWhite,
    decalPlateRed,
    decalPlateGreen,
    decalMarkWhite,
    decalMarkInk,
    decalMarkOnRed,
    decalMarkOnGreen,
    plaquePlate,
    plaqueStars,
    jackPoints,
    reflectors,
    hvTriangle,
    hvBolt,
    graffiti,
    skirtBand,
    skirtHi,
    bandStripe,
    bandShade,
    flash,
    flashEdge,
    gangway,
    gangwayRibs,
    gangwayHood,
    screen,
    screenMask,
    visor,
    wipers,
    washers,
    driver,
    desk,
    deskGlow,
    destBox,
    destGrid,
    destBezel,
    lampBezel,
    lights,
    lightLens,
    tailLights,
    numberPlate,
    hornGrille,
    frontRails,
    plough,
    coupler,
    hoses,
    cabDoor,
    cabDoorGlass,
    cabDoorFittings,
    cameraArm,
    roofLine,
    acUnits,
    acGrilles,
    panWell,
    panArms,
    insulators,
    hvDuct,
    antennas,
    roofWalk,
    underframe,
    underBoxes,
    underBoxSet,
    airTanks,
    cabling,
    bogieFrames,
    suspension,
    axleBoxes,
    sanders,
    antenna,
    wheels,
    discs,
    tyres,
    brakeDust,
    streaks,
    roofGrime,
  };
}

const GEO_CACHE = new Map<Cars, Geo>();
/** Geometry for a unit of `cars` cars, built once and kept. */
export function unitGeometry(cars: Cars = 2): Geo {
  let geo = GEO_CACHE.get(cars);
  if (!geo) {
    geo = buildGeo(cars);
    GEO_CACHE.set(cars, geo);
  }
  return geo;
}
/** Warm the default so the first train of the game costs nothing extra. */
const GEO2 = unitGeometry(2);

export const unitLength = (cars: Cars = 2) => unitGeometry(cars).len;
export const doorsFor = (cars: Cars = 2) => unitGeometry(cars).doors;
export const doorCentres = (cars: Cars = 2) =>
  unitGeometry(cars).doors.map((x) => x + TRAIN.doorW / 2);

/* ================================================================== *
 * the component
 * ================================================================== */

export type TrainDoors =
  | { mode: "shut" }
  | { mode: "open" }
  /**
   * SMIL-driven, keyed to the station's own cycle. `keyTimes` and `begin` come
   * from the timetable so the leaves part at the right second whether the
   * player arrived thirty seconds ago or five minutes ago.
   */
  | { mode: "cycle"; keyTimes: string; values: string; dur: string; begin: string };

/**
 * One unit. `lit` turns the saloon lighting on independently of the hour,
 * because a train's lights are on in daylight too and it is the single detail
 * that stops a daytime train reading as a cardboard cut-out.
 */
export function SkmUnit({
  ph,
  doors = { mode: "shut" },
  lit,
  destination,
  tail = false,
  cars = 2,
  via,
  line = "SKM",
  unitNumber = "36WEa-005",
  uic = "94 51 2 620 005-9 PL-SKMT",
  stickers = true,
  crew = true,
  riders,
  crowding = "normal",
  interior = true,
  beyond,
  weathered = true,
  graffiti = false,
}: {
  ph: Ph;
  doors?: TrainDoors;
  /** saloon lighting; defaults to on after dark and off in full day */
  lit?: boolean;
  /** what the front display says — "SOPOT", "GDYNIA GŁÓWNA" */
  destination: string;
  /** seen from behind: red markers instead of headlights */
  tail?: boolean;
  /** two cars fills a platform; three is the real set, for trains that pass */
  cars?: Cars;
  /** alternates with the destination on the display, as the real ones do */
  via?: string;
  /** the route box left of the destination */
  line?: string;
  /** carried under the cab side window */
  unitNumber?: string;
  /** the twelve-digit vehicle number, carried low on the body */
  uic?: string;
  /** the whole decal layer; off for a train seen at 300 px where it is noise */
  stickers?: boolean;
  /** a driver at the desk */
  crew?: boolean;
  /** passengers in the saloon; defaults to whenever the lights are on */
  riders?: boolean;
  /** how full it is — a Sunday morning and the 07:41 are not the same train */
  crowding?: "quiet" | "normal" | "busy";
  /** the whole saloon layer; off for a train small enough that it is noise */
  interior?: boolean;
  /**
   * What shows through the far side windows. Pass the scene's own backdrop —
   * the platform canopy, a lit shelter, the sky over the bay — and the train
   * stops being a solid object with pictures of windows on it.
   */
  beyond?: string;
  /** brake dust, water streaks, roof grime */
  weathered?: boolean;
  /** it has been standing in Cisowa a while */
  graffiti?: boolean;
}) {
  const g = cars === 2 ? GEO2 : unitGeometry(cars);
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const inside = lit ?? ph !== "day";
  const people = riders ?? true;
  const int = inside ? INSIDE.lit : INSIDE.unlit;
  const riderPath =
    crowding === "busy" ? g.ridersBusy : crowding === "quiet" ? g.ridersQuiet : g.ridersNormal;
  const shell = shellFor(ph);
  const blue = blueFor(ph);
  const yellow = yellowFor(ph);
  const frame = frameFor(ph);
  const steel = steelFor(ph);
  const glass = GLASS[ph];
  const slide = doors.mode === "open" ? TRAIN.doorW / 2 : 0;
  const len = g.len;

  const leafAnim = (dir: -1 | 1) =>
    doors.mode === "cycle" ? (
      <animateTransform
        attributeName="transform"
        type="translate"
        keyTimes={doors.keyTimes}
        values={doors.values
          .split(";")
          .map((v) => `${dir * Number(v)} 0`)
          .join(";")}
        dur={doors.dur}
        begin={doors.begin}
        repeatCount="indefinite"
        calcMode="linear"
      />
    ) : null;

  /** Centred in the 112 px of usable display. */
  const destX = Math.max(2, Math.round((112 - destWidth(destination)) / 2));
  const viaX = via ? Math.max(2, Math.round((112 - destWidth(via)) / 2)) : 0;

  return (
    <g shapeRendering="crispEdges">
      {/* running gear first: everything else covers it */}
      <path d={g.wheels} fill={night ? "#1a1d21" : "#2b2e32"} />
      <path d={g.tyres} fill={steel.hi} opacity={0.55} />
      <path d={g.discs} fill={steel.base} />
      <path d={g.bogieFrames} fill={steel.lo} />
      <path d={g.suspension} fill={steel.mid} />
      <path d={g.axleBoxes} fill={steel.base} />
      <path d={g.sanders} fill={steel.deep} />
      <path d={g.antenna} fill="#5a4a2c" />
      <path d={g.underframe} fill={blue.deep} />
      <Bev set={g.underBoxSet} mat={steel} />
      <path d={g.airTanks} fill={steel.mid} />
      <path d={g.cabling} fill={steel.deep} />

      {/* the shell */}
      <Bev set={g.bodySet} mat={shell} />
      <path d={g.camber} fill={shell.hi} opacity={0.7} />
      <path d={g.gutter} fill={shell.deep} opacity={0.55} />
      <path d={g.roofLine} fill={shell.deep} opacity={0.5} />
      <path d={g.seams} fill={shell.deep} opacity={0.35} />

      {/* roof equipment */}
      <path d={g.roofWalk} fill={shell.lo} opacity={0.7} />
      <path d={g.acUnits} fill={frame.mid} />
      <path d={g.acGrilles} fill={frame.deep} opacity={0.8} />
      <path d={g.panWell} fill={frame.lo} />
      <path d={g.panArms} fill={frame.base} />
      <path d={g.insulators} fill={dark ? "#6a5a48" : "#9a8468"} />
      <path d={g.hvDuct} fill={frame.deep} opacity={0.85} />
      <path d={g.antennas} fill={frame.mid} />

      {/* the gangway between the cars, on its Jacobs bogie */}
      <path d={g.gangwayHood} fill="#1a1d22" />
      <path d={g.gangway} fill="#23262b" />
      <path d={g.gangwayRibs} fill="#33373d" />

      {/* livery: skirt, band, cab flash */}
      <path d={g.skirtBand} fill={blue.base} />
      <path d={g.skirtHi} fill={blue.hi} opacity={0.6} />
      <path d={g.bandStripe} fill={yellow.base} />
      <path d={g.bandShade} fill={yellow.lo} opacity={0.8} />
      <path d={g.flashEdge} fill={yellow.hi} opacity={0.85} />
      <path d={g.flash} fill={yellow.base} opacity={0.95} />

      {/* ---- the glass, and everything behind it, back to front -------- */}
      <path d={g.windowGlass} fill={inside ? "#232a33" : glass} />
      {interior ? (
        <>
          {/* the far side of the car */}
          <path d={g.farGlass} fill={beyond ?? int.far} />
          <path d={g.farPillars} fill={int.pillar} opacity={0.85} />
          <path d={g.posters} fill={int.poster} opacity={0.8} />
          <path d={g.farSeats} fill={int.farSeat} />
          {/* the aisle furniture */}
          <path d={g.rack} fill={int.rack} opacity={0.9} />
          <path d={g.bags} fill={int.bag} opacity={0.9} />
          <path d={g.grabRail} fill={int.rail} opacity={0.8} />
          {/* people, before the near seats, so the backs cut them off at the
              shoulder exactly as a seat back does */}
          {people ? <path d={riderPath} fill={int.body} opacity={0.85} /> : null}
          {/* the near row */}
          <path d={g.headrestPath} fill={int.head} />
          <path d={g.seatBackPath} fill={int.seat} />
          <path d={g.weltPath} fill={int.welt} opacity={0.9} />
          <path d={g.armrestPath} fill={int.arm} opacity={0.85} />
          <path d={g.tablePath} fill={int.table} opacity={0.9} />
          <path d={g.poles} fill={int.pole} opacity={0.8} />
          {/* ceiling last: it is nearest the glass at the top of the frame */}
          <path d={g.ceiling} fill={int.ceil} opacity={inside ? 0.95 : 0.7} />
          <path d={g.diffusers} fill={int.light} opacity={inside ? 1 : 0.6} />
          <path d={g.vents} fill={int.vent} opacity={0.8} />
          <path d={g.domes} fill="#2b3138" opacity={0.9} />
        </>
      ) : null}
      {/* and then the glass itself: fall-off, the reflected sky, condensation */}
      <path d={g.windowGlass} fill={GRIME} opacity={inside ? 0.2 : 0.45} />
      <path d={g.sheen} fill={dark ? "#9fc0da" : "#ffffff"} opacity={dark ? 0.07 : 0.13} />
      {night && inside ? <path d={g.condensation} fill={GRIME} opacity={0.4} /> : null}
      {stickers ? <path d={g.glassMarks} fill={DECAL.red} opacity={0.9} /> : null}
      <path d={g.windowSeal} fill={frame.deep} opacity={0.9} />
      <path d={g.windowFrames} fill={frame.base} />

      {/* doors: surround, void, then the leaves over it */}
      <path d={g.doorSurround} fill={yellow.base} />
      <path d={g.doorVoid} fill={inside ? "#c2c7bb" : "#1e2228"} />
      {interior ? (
        <>
          <path d={g.vestibuleFar} fill={beyond ?? int.far} opacity={inside ? 0.9 : 1} />
          <path d={g.vestibulePath} fill={int.rail} opacity={0.75} />
          {people ? <path d={g.doorRiders} fill={int.body} opacity={0.85} /> : null}
        </>
      ) : null}
      <path d={g.doorStep} fill={frame.lo} />
      <path d={g.doorTread} fill={frame.deep} />
      {/* Each leaf carries its own glazing, so the glass opens with the door.
          The grime matches the saloon windows — it was 0.34 over a lit pane,
          which took the one glazed thing on the door down to the same grey as
          the shell and made the whole doorway read as a lift. */}
      <g transform={slide ? `translate(${-slide} 0)` : undefined}>
        <Bev set={g.leafLSet} mat={shell} />
        <path d={g.leafGlassL} fill={inside ? SALOON : glass} opacity={inside ? 0.86 : 1} />
        <path d={g.leafGlassL} fill={GRIME} opacity={inside ? 0.14 : 0.32} />
        <path d={g.leafSealL} fill={frame.deep} opacity={0.7} />
        <path d={g.leafBandL} fill={yellow.base} opacity={0.9} />
        <path d={g.leafEdgeL} fill="#26292e" />
        {leafAnim(-1)}
      </g>
      <g transform={slide ? `translate(${slide} 0)` : undefined}>
        <Bev set={g.leafRSet} mat={shell} />
        <path d={g.leafGlassR} fill={inside ? SALOON : glass} opacity={inside ? 0.86 : 1} />
        <path d={g.leafGlassR} fill={GRIME} opacity={inside ? 0.14 : 0.32} />
        <path d={g.leafSealR} fill={frame.deep} opacity={0.7} />
        <path d={g.leafBandR} fill={yellow.base} opacity={0.9} />
        <path d={g.leafEdgeR} fill="#26292e" />
        {leafAnim(1)}
      </g>
      <path d={g.doorJamb} fill={frame.deep} />
      <path d={g.doorHandles} fill={yellow.mid} />
      <path d={g.buttonRing} fill={dark ? "#7ad86a" : "#3f4a44"} opacity={0.9} />
      <path d={g.buttonBody} fill={K_BUTTON(night)} />
      <path d={g.buttonMark} fill="#2a2410" opacity={0.8} />

      {/* the cab */}
      <path d={g.lampBezel} fill="#191c21" />
      <path d={g.screen} fill={night ? "#161b22" : "#6f8290"} />
      {crew ? (
        <>
          <path d={g.desk} fill="#20242a" opacity={0.85} />
          <path d={g.deskGlow} fill={dark ? "#3fd08a" : "#6f8a7c"} opacity={dark ? 0.9 : 0.5} />
          <path d={g.driver} fill={night ? "#20252c" : "#3a4149"} opacity={0.85} />
        </>
      ) : null}
      <path d={g.screen} fill={GRIME} opacity={0.4} />
      <path d={g.visor} fill="#2b3037" opacity={0.75} />
      <path d={g.screenMask} fill={frame.deep} />
      <path d={g.wipers} fill="#22262b" />
      <path d={g.washers} fill={frame.mid} />
      <path d={g.cabDoor} fill={frame.mid} opacity={0.8} />
      <path d={g.cabDoorGlass} fill={night ? "#1c222a" : glass} />
      <path d={g.cabDoorFittings} fill={frame.deep} />
      <path d={g.cameraArm} fill={frame.lo} />
      <path d={g.plough} fill={blue.deep} />
      <path d={g.coupler} fill={steel.base} />
      <path d={g.hoses} fill="#1f2227" />
      <path d={g.frontRails} fill={yellow.mid} />
      <path d={g.hornGrille} fill="#2a2e34" />

      {/* front destination display */}
      <path d={g.destBezel} fill="#0b0d10" />
      <path d={g.destBox} fill="#101216" />
      <g transform={`translate(${len - 148} ${TRAIN.roof + 9})`}>
        {via ? (
          <>
            <g opacity={1}>
              <path d={textPath(destination, destX, 0)} fill="#ffb03a" />
              <animate
                attributeName="opacity"
                values="1;1;0;0;1"
                keyTimes="0;0.45;0.5;0.95;1"
                dur="9s"
                repeatCount="indefinite"
              />
            </g>
            <g opacity={0}>
              <path d={textPath(via, viaX, 0)} fill="#ffb03a" />
              <animate
                attributeName="opacity"
                values="0;0;1;1;0"
                keyTimes="0;0.45;0.5;0.95;1"
                dur="9s"
                repeatCount="indefinite"
              />
            </g>
          </>
        ) : (
          <path d={textPath(destination, destX, 0)} fill="#ffb03a" />
        )}
      </g>
      <path d={g.destGrid} fill="#0b0d10" opacity={0.45} />

      {/* lamps last, so nothing dims them */}
      <path d={tail ? g.tailLights : g.lights} fill={tail ? "#e05050" : "#fff6d8"} />
      {!tail ? (
        <>
          <path d={g.lightLens} fill="#ffffff" opacity={dark ? 0.95 : 0.6} />
          <path d={g.tailLights} fill="#5a1c1c" opacity={0.7} />
        </>
      ) : (
        <path d={g.lights} fill="#3a3020" opacity={0.8} />
      )}

      {/* ---- the decal layer ------------------------------------------- */}
      {stickers ? (
        <>
          <path d={g.decalPlateWhite} fill={DECAL.plate} />
          <path d={g.decalPlateBlue} fill={DECAL.blue} />
          <path d={g.decalPlateRed} fill={DECAL.red} />
          <path d={g.decalPlateGreen} fill={DECAL.green} />
          <path d={g.decalMarkInk} fill={DECAL.ink} />
          <path d={g.decalMarkWhite} fill={DECAL.plate} />
          <path d={g.decalMarkOnRed} fill={DECAL.plate} />
          <path d={g.decalMarkOnGreen} fill={DECAL.plate} />
          <path d={g.plaquePlate} fill={DECAL.blue} />
          <path d={g.plaqueStars} fill={DECAL.star} />
          <path d={g.jackPoints} fill={yellow.base} />
          <path d={g.hvTriangle} fill={yellow.base} />
          <path d={g.hvBolt} fill={DECAL.red} />
          {/* retroreflective end stripes: brighter after dark, not dimmer */}
          <path d={g.reflectors} fill={dark ? "#fff2a8" : yellow.hi} opacity={dark ? 0.9 : 0.7} />

          {/* the operator's own lettering, at 2× and 3× the 3×5 font */}
          <g transform={`translate(${len - 300} 100) scale(3)`}>
            <path d={textPath(line, 0, 0)} fill={LIVERY.blue.base} />
          </g>
          <g transform={`translate(${len - 248} 104) scale(2)`}>
            <path d={textPath("TROJMIASTO", 0, 0)} fill={LIVERY.blue.mid} />
          </g>
          <g transform={`translate(${g.spans[0][0] + 210} 100) scale(2)`}>
            <path d={textPath("PKP SKM", 0, 0)} fill={LIVERY.blue.base} />
          </g>
          <g transform={`translate(${len - 176} 88)`}>
            <path d={textPath(unitNumber, 0, 0)} fill={frame.deep} />
          </g>
          <g transform={`translate(${g.spans[0][0] + 24} 125)`}>
            <path d={textPath(uic, 0, 0)} fill={shell.hi} opacity={0.75} />
          </g>
          <g transform={`translate(${len - 100} 99)`}>
            <path d={textPath(unitNumber, 0, 0)} fill="#e8e6df" />
          </g>
          <path d={g.numberPlate} fill="#14171c" opacity={0.55} />

          {/* side destination displays, one per car */}
          <path d={g.sideDisplayBox} fill="#101216" />
          {g.sideDisplays.map((d) => (
            <g key={d.x} transform={`translate(${d.x + 4} ${d.y + 3})`}>
              <path d={textPath(`${line} ${destination}`, 0, 0)} fill="#ffb03a" />
            </g>
          ))}
          <path d={g.sideDisplayGrid} fill="#0b0d10" opacity={0.4} />
        </>
      ) : null}

      {/* ---- weathering, over everything but the lamps ------------------ */}
      {weathered ? (
        <>
          <path d={g.streaks} fill={GRIME} opacity={0.5} />
          <path d={g.brakeDust} fill="#4a3a2c" opacity={0.22} />
          <path d={g.roofGrime} fill="#3a3d38" opacity={0.18} />
        </>
      ) : null}
      {graffiti ? <path d={g.graffiti} fill="#b6314f" opacity={0.85} /> : null}
    </g>
  );
}

const K_BUTTON = (night: boolean) => (night ? "#ffdb52" : "#f2c218");

/** How wide the destination text will be, so the display can be centred. */
export const destWidth = (text: string) => textWidthLocal(text);
function textWidthLocal(text: string) {
  // the 3×5 font is 3 wide plus a 1 px gap, and " " is 2 wide
  let w = 0;
  for (const ch of text) w += (ch === " " ? 2 : 3) + 1;
  return Math.max(0, w - 1);
}

/** Re-exported so scenes can lay out doors without importing the geometry twice. */
export const trainLength = TRAIN.len;
export { shift as shiftRects };
