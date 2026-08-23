import {
  AOSet,
  aoPaths,
  Bev,
  bevelPaths,
  Contact,
  contactPaths,
  dim,
  dth,
  Light,
  type LightTier,
  type Mat,
  type Ph,
  pxPath,
  type Rect,
  repeat,
  shift,
  steppedEllipse,
  steppedQuad,
  textPath,
  tiers,
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
 *   cab, end face to
 *   the first door       3.82 m  145 px
 *
 * ==================================================================
 * V2 — WHAT CHANGED, and why each change is geometry rather than decoration.
 *
 * 1. THE UNIT IS DOUBLE-ENDED. It had one cab, at the right-hand end, and a
 *    blunt body end at the other — which is not an Impuls, and which made
 *    direction a lie. A train "going away to the left" was the same drawing
 *    shoved backwards with its tail lamps lit: cab trailing, plough trailing,
 *    destination display facing the wrong way. Both ends are cabs now, built
 *    once and mirrored (`flipX`), so the unit is intrinsically bidirectional
 *    and `dir` only has to say which cab is *leading*. Nothing has to be
 *    reflected at render time, no text ends up backwards, and the top-left
 *    light stays top-left.
 *
 * 2. THE CAB FITS. The old cab claimed 160 px it did not have: the last
 *    passenger door ends 145 px from the nose, so the windscreen, the driver's
 *    door and the lamp bezel were all drawn straight over the top of it. The
 *    cab is laid out inside 145 px now, and every element is placed by its
 *    distance from the end face (`kb`) so the same numbers build both ends.
 *
 * 3. IT STANDS ON SOMETHING. A train drawn with nothing under it reads as a
 *    sticker. The unit now paints its own ground: the boxed-in dark between the
 *    apron and the rail head, a deeper pool under each bogie, a contact line on
 *    the platform coping, and — after dark — the light its windows and its open
 *    doors throw across the platform. That light moves with the train, so a
 *    unit pulling in sweeps its own windows along the coping.
 *
 * 4. IT HAS WEIGHT WHEN IT MOVES. The unit owns its own translate now (`motion`)
 *    instead of being dragged along by a group in the scene, which means it can
 *    read its own speed. From one keyframe list it derives: wheel rotation
 *    (exact — degrees are distance over radius, interpolated linearly, so the
 *    wheels slow to a stand with the train), a 1 px body bob over the rail
 *    joints that stops when the train stops, motion smear on the glass, a dust
 *    wake off the trailing end, brake haze on deceleration and a sand puff on
 *    the pull-away. One source of truth for where the train is and how fast.
 *
 * 5. THE BODY HAS TURN. Ambient occlusion under the roof gutter, a tone ramp
 *    down the body side, the out-of-light bottom of the skirt with a line of
 *    ballast bounce under it, two catch lights along the tumblehome, and — the
 *    one honestly asymmetric thing on the vehicle — the nose rakes shaded
 *    against each other, because the left-hand nose faces the light and the
 *    right-hand one turns away from it.
 *
 * ==================================================================
 * COST. Everything is precomputed at module scope, per car count, into one path
 * per material — a train is well over eight hundred rectangles now, and it emits
 * as about seventy <path> nodes no matter how many trains the scene puts on
 * screen. The geometry for a given car count is built once and cached; a second
 * train is free. Motion plans are built once at module scope by the scene and
 * carry every derived animation string with them, so the component allocates
 * nothing per frame and nothing per render.
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
  /** drawn length of the default two-car unit */
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
  /**
   * The cab, from the end face to the first passenger door. Not a free choice:
   * the last door on a two-car unit ends 145 px from the nose and on a three-car
   * unit it ends 145 px from the nose too, so this is the space there is.
   */
  cabLen: 145,
  /** running gear */
  rail: RAIL,
  wheelR: 16,
  wheelbase: 95,
} as const;

/** Door centres in the train's own space, for anything that has to line up. */
export const DOOR_LOCAL = TRAIN.doors.map((x) => x + TRAIN.doorW / 2);

/** Which way a unit is running. 1 = to the right, -1 = to the left. */
export type TrainDir = 1 | -1;

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
/** Warm shadow, the same warm black the rest of the game shades with. */
const SHADE = "#171009";

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
/** Dust off the running gear: brake haze, the wake, sand on the pull-away. */
const DUST = dth("n", "25");

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
 *
 * It sits on the blue skirt, which is where a real one sits, and it therefore
 * needs a white keyline or it is a blue plate on a blue body.
 */
const EU_PLAQUE = (x: number, y: number) => {
  const stars: Rect[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    stars.push([x + 9 + Math.round(Math.cos(a) * 6), y + 8 + Math.round(Math.sin(a) * 5), 1, 1]);
  }
  return { plate: [x, y, 19, 17] as Rect, key: outline(x - 1, y - 1, 21, 19), stars };
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

const CAR = { end: 850, mid: 551, gap: 19, nose: 24 } as const;

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
/**
 * The marks on the disc that let you see it turn. A four-armed cross would be
 * symmetric every quarter turn and read as still, so one arm carries a boss
 * near the rim and the eye locks onto that instead.
 */
function spokes(cx: number, cy: number): Rect[] {
  return [
    [cx - 9, cy - 1, 18, 2],
    [cx - 1, cy - 9, 2, 18],
    [cx + 4, cy - 6, 3, 3],
  ];
}

/** The centre of every wheel, so each one can be given its own rotation. */
const WHEEL_CY = 134;

type Geo = ReturnType<typeof buildGeo>;

function buildGeo(cars: Cars) {
  const L = layoutFor(cars);
  const len = L.len;
  const { roof, skirt, floor, sill, head, band, bandH, skirtTop, doorW, cabLen } = TRAIN;
  const NX = CAR.nose;
  /** the drawn body, nose face to nose face, and its width */
  const bodyL = NX;
  const bodyR = len - NX;
  const bodyW = bodyR - bodyL;

  /**
   * Mirror about the unit's own centre line. This is what makes the vehicle
   * double-ended for the price of one cab: every cab element is written once,
   * from the right-hand end face inward, and `flipX` builds the left-hand one.
   */
  const flipX = (rects: readonly Rect[]): Rect[] =>
    rects.map(([x, y, w, h]) => [len - x - w, y, w, h] as Rect);
  const both = (rects: readonly Rect[]): Rect[] => [...rects, ...flipX(rects)];
  /** A cab rect placed by the distance from the end face to its left edge. */
  const kb = (k: number, y: number, w: number, h: number): Rect => [len - k, y, w, h];

  /**
   * The saloon of each car — what is left after the cab at a unit end and the
   * end wall at a coupled end. Every piece of furniture inside and on top of the
   * car is placed against these rather than against the car span, which is what
   * stops the first car's luggage rack from being drawn inside the driver's cab.
   */
  const sal: [number, number][] = L.spans.map(([a, b], i) => [
    i === 0 ? cabLen : a + 14,
    i === L.spans.length - 1 ? len - cabLen : b - 14,
  ]);

  /* ---- shell ------------------------------------------------------------ */

  /** Five steps over 0.63 m, which at this key is the whole rake of an Impuls. */
  const noseB: Rect[] = [
    [len - 6, roof + 16, 6, skirt - roof - 22],
    [len - 12, roof + 9, 6, skirt - roof - 13],
    [len - 18, roof + 5, 6, skirt - roof - 8],
    [len - 24, roof + 2, 6, skirt - roof - 4],
  ];
  const noseA = flipX(noseB);
  const body: Rect[] = [
    ...L.spans.map(([a, b], i) => {
      const l = i === 0 ? bodyL : a;
      const r = i === L.spans.length - 1 ? bodyR : b;
      return [l, roof, r - l, skirt - roof] as Rect;
    }),
    ...noseB,
    ...noseA,
  ];
  const bodySet = bevelPaths(body);

  /** The x range of drawn body side, per car, for anything that runs its length. */
  const panels: [number, number][] = L.spans.map(([a, b], i) => [
    i === 0 ? bodyL : a,
    i === L.spans.length - 1 ? bodyR : b,
  ]);

  /** The roof camber: two steps of shadow so the shell is not a flat slab. */
  const camber = pxPath([
    ...panels.map(([a, b]) => [a, roof, b - a, 2] as Rect),
    ...panels.map(([a, b]) => [a + 2, roof + 2, b - a - 4, 1] as Rect),
  ]);
  /** Rain gutter under the roof edge, and the drip line it leaves on the shell. */
  const gutter = pxPath(panels.map(([a, b]) => [a, roof + 3, b - a, 1] as Rect));

  /* ---- glazing ---------------------------------------------------------- */

  /** Window panels: between the cab, the car end, and the doors. */
  const windows: Rect[] = [];
  sal.forEach(([from, to]) => {
    const inCar = L.doors.filter((d) => d > from && d < to);
    let cursor = from;
    for (const d of inCar) {
      windows.push(...bays(cursor, d - 8));
      cursor = d + doorW + 8;
    }
    windows.push(...bays(cursor, to));
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
  /** After dark the glazing bleeds a pixel of saloon light onto the frame. */
  const glassBleed = pxPath(windows.flatMap(([x, y, w, h]) => outline(x - 1, y - 1, w + 2, h + 2)));

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

  /**
   * Side destination displays, one per car, above the window line and centred in
   * the saloon so that they never land on a door pillar or inside a cab.
   */
  const sideDisplays = sal.map(([from, to]) => ({
    x: from + Math.round((to - from) / 2) - 48,
    y: 28,
    w: 96,
  }));
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
  /** The retractable gap-filler under the threshold, out only at a platform. */
  const doorTread = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x + 3, floor + 5, doorW - 6, 2],
          [x + 6, floor + 7, doorW - 12, 1],
        ] as Rect[],
    ),
  );
  /** The recess the leaves sit in: the surround throws a shadow onto them. */
  const doorAO = aoPaths(L.doors.map((x) => [x, head, doorW] as const));
  const doorCheeks = pxPath(
    L.doors.flatMap(
      (x) =>
        [
          [x, head, 2, floor - head],
          [x + doorW - 2, head, 2, floor - head],
        ] as Rect[],
    ),
  );

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
   * They go on the blue skirt, not on the nine pixels of white between the sill
   * and the band: nine pixels is 24 cm and nothing legible fits in it. On blue
   * the plate has to be white with a blue mark, which is also how the real ones
   * are printed.
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

  L.doors.forEach((x, i) => {
    const accessible = i % 2 === 1;
    push(
      decal(accessible ? ICON.wheelchair : ICON.bicycle, x - 18, 102, DECAL.plate, DECAL.blue, 1),
    );
  });

  /** One per unit, mid-car where the real one is, clear of every door. */
  push(decal(ICON.extinguisher, sal[0][0] + 250, 104, DECAL.plate, DECAL.red, 1));

  const decalPlateBlue = pxPath(platesBlue);
  const decalPlateWhite = pxPath(platesWhite);
  const decalPlateRed = pxPath(platesRed);
  const decalPlateGreen = pxPath(platesGreen);
  const decalMarkWhite = pxPath(marksWhite);
  const decalMarkInk = pxPath(marksInk);
  const decalMarkOnRed = pxPath(marksOnRed);
  const decalMarkOnGreen = pxPath(marksOnGreen);

  /** EU plaque, one per car, on the skirt with its keyline. */
  const plaques = sal.map(([from]) => EU_PLAQUE(from + 40, 104));
  const plaquePlate = pxPath(plaques.map((p) => p.plate));
  const plaqueKey = pxPath(plaques.flatMap((p) => p.key));
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
  /** TSI retroreflective end markings, at the ends of the *unit*, both of them. */
  const reflectors = pxPath(
    both([
      [len - NX - 6, 100, 4, 22],
      [len - NX - 12, 100, 2, 22],
    ]),
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

  const skirtBand = pxPath([[bodyL, skirtTop, bodyW, skirt - skirtTop]]);
  const skirtHi = pxPath([[bodyL, skirtTop, bodyW, 1]]);
  const bandStripe = pxPath([[bodyL - 2, band, bodyW + 4, bandH]]);
  const bandShade = pxPath([[bodyL - 2, band + bandH - 1, bodyW + 4, 1]]);
  /**
   * The cab flash: the SKM's signature. The yellow band turns down at the cab
   * and runs forward into the lower nose, stepped so it stays pixel art — and
   * now clipped to the body, which the old one was not: its last two steps sat
   * below the apron line, painting yellow over the plough.
   */
  const FLASH_N = 12;
  const flashB: Rect[] = Array.from(
    { length: FLASH_N },
    (_, i) => [len - 200 + i * 14, band + i * 3, 14, bandH] as Rect,
  );
  const flashEdgeB: Rect[] = Array.from(
    { length: FLASH_N },
    (_, i) => [len - 200 + i * 14, band - 2 + i * 3, 14, 2] as Rect,
  );
  const flash = pxPath(both(flashB));
  const flashEdge = pxPath(both(flashEdgeB));

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

  /* ---- the cab, built at the B end and mirrored to the A end ------------ *
   *
   * Every element is placed by `kb(k, …)` — k is the distance from the end face
   * to the element's left edge — so the whole cab is one set of numbers that
   * reads outward from the nose, and `flipX` builds the other end from it. The
   * budget is 145 px, which is what the last passenger door leaves.
   *
   *   k   0..24   nose rake, lamp cluster, plough, coupler, number plate
   *   k  26..106  the windscreen, and the desk and driver behind it
   *   k 106..140  the driver's own door, its window and its step
   *   k  28..140  the destination display, above all of it
   */

  const screenB: Rect[] = [
    kb(104, head - 8, 70, 58),
    kb(34, head - 4, 8, 50),
    kb(26, head + 1, 6, 42),
  ];
  const screen = pxPath(both(screenB));
  /** The rubber the screen is bonded into, and the pillar behind the driver. */
  const screenMask = pxPath(
    both([
      kb(106, head - 11, 82, 3),
      kb(106, head + 50, 74, 3),
      kb(106, head - 11, 3, 64),
      kb(26, head - 4, 2, 46),
    ]),
  );
  /**
   * What is behind the screen when nobody is driving.
   *
   * A cab drawn as one flat pane is the flattest thing on the vehicle, and half
   * the cabs on this train are always the trailing one — so the furniture goes
   * in at both ends and only the driver, his desk lighting and the sun visor's
   * shadow follow the direction of travel. Back wall, the seat he is not
   * sitting in, and the sky the top of the glass is holding.
   */
  const cabDark = pxPath(both([kb(103, head - 7, 14, 56)]));
  const cabSeat = pxPath(
    both([kb(78, head + 20, 15, 25), kb(77, head + 16, 13, 5), kb(63, head + 30, 3, 3)]),
  );
  const cabSky = pxPath(
    both([kb(100, head - 6, 62, 5), kb(94, head - 1, 50, 4), kb(84, head + 3, 34, 3)]),
  );
  /** Sun visor, pulled halfway down on the driver's side. */
  const visor = pxPath(both([kb(102, head - 6, 44, 9)]));
  const wipers = pxPath(
    both([
      kb(96, head + 42, 44, 2),
      kb(58, head + 26, 2, 17),
      kb(60, head + 24, 6, 2),
      kb(40, head + 38, 14, 2),
    ]),
  );
  const washers = pxPath(both([kb(90, head - 14, 3, 2), kb(56, head - 14, 3, 2)]));
  /** The driver: a head and shoulders at the desk, behind the screen. */
  const driverB = pxPath([kb(70, head + 14, 9, 9), kb(74, head + 23, 17, 22)]);
  const driverA = pxPath(flipX([kb(70, head + 14, 9, 9), kb(74, head + 23, 17, 22)]));
  /** The desk is furniture: it is in both cabs whether or not anyone is at it. */
  const desk = pxPath(both([kb(102, head + 38, 62, 12), kb(98, head + 36, 50, 2)]));
  const deskGlowB = pxPath([kb(96, head + 40, 22, 4), kb(70, head + 40, 12, 4)]);
  const deskGlowA = pxPath(flipX([kb(96, head + 40, 22, 4), kb(70, head + 40, 12, 4)]));

  /** Destination display: a dot-matrix strip with the grid drawn over it. */
  const destBoxB: Rect = kb(140, roof + 5, 112, 17);
  const destBox = pxPath(both([destBoxB]));
  const destGrid = pxPath(both(repeat(28, 4, kb(138, roof + 6, 1, 15))));
  const destBezel = pxPath(both(outline(len - 142, roof + 3, 116, 21, 2)));
  /** Where the text goes, per end, and how much room it has. */
  const destTextB = { x: len - 138, y: roof + 11 };
  const destTextA = { x: 30, y: roof + 11 };

  /** The cab side door, with its window, handle and step. */
  const cabDoor = pxPath(both(outline(len - 140, head - 2, 34, floor - head + 2, 2)));
  const cabDoorGlass = pxPath(both([kb(134, head + 3, 22, 30)]));
  const cabDoorFittings = pxPath(both([kb(114, head + 40, 5, 3), kb(138, floor, 30, 3)]));
  /**
   * The camera pod that replaced the mirror. It sits on the cab roof corner,
   * not on the body side: the side above the driver's door is where the
   * destination strip is, and a pod drawn there is a pod drawn underneath it.
   */
  const cameraArm = pxPath(both([kb(64, roof - 8, 12, 3), kb(60, roof - 12, 4, 5)]));
  /** Handrails: one beside the driver's door, one on the nose. */
  const frontRails = pxPath(both([kb(144, 60, 2, 34), kb(20, 60, 2, 30)]));
  const hornGrille = pxPath(both(repeat(5, 3, kb(22, 84, 2, 7))));

  /** Headlights: a low horizontal cluster in a black bezel, not round lamps. */
  const lampBezelB: Rect[] = [kb(48, 98, 40, 22), kb(8, 102, 8, 14)];
  const lampBezel = pxPath(both(lampBezelB));
  const lightsB: Rect[] = [kb(44, 102, 32, 6), kb(8, 104, 6, 4)];
  const lightsA = flipX(lightsB);
  const lights = pxPath(lightsB);
  const lightsFar = pxPath(lightsA);
  const lensB = pxPath(repeat(6, 5, kb(43, 103, 4, 4)));
  const lensA = pxPath(flipX(repeat(6, 5, kb(43, 103, 4, 4))));
  const tailB: Rect[] = [kb(44, 110, 32, 5), kb(20, 76, 8, 6)];
  const tailLights = pxPath(tailB);
  const tailLightsFar = pxPath(flipX(tailB));
  /** Number plate on the nose, and the horn grille above the lights. */
  const numberPlateB: Rect = kb(104, 118, 44, 11);
  const numberPlate = pxPath(both([numberPlateB]));
  const plateTextB = { x: len - 100, y: 121 };
  const plateTextA = { x: 60, y: 121 };
  /** Coupler, hoses, plough. A Scharfenberg head is a box and two pipes here. */
  const plough = pxPath(both([kb(34, 126, 34, 10), kb(26, 136, 26, 6), kb(20, 142, 20, 4)]));
  const coupler = pxPath(both([kb(16, 116, 16, 12), kb(22, 119, 6, 6)]));
  const hoses = pxPath(both([kb(30, 118, 2, 8), kb(26, 120, 2, 7)]));

  /**
   * The two nose rakes, shaded against each other. This is the one horizontally
   * asymmetric thing on the vehicle and it has to be: the light in this game
   * comes from the top left, so the left-hand nose faces it and the right-hand
   * nose turns away. Shading both the same would flatten the ends, and mirroring
   * the *shading* with the direction of travel would mean the sun moved when the
   * train did.
   */
  const noseLit = pxPath(noseA);
  const noseTurn = pxPath(noseB);
  const noseEdgeLit = pxPath([[0, roof + 18, 1, skirt - roof - 26]]);
  const noseEdgeTurn = pxPath([[len - 1, roof + 18, 1, skirt - roof - 26]]);

  /* ---- roof ------------------------------------------------------------- */

  const roofLine = pxPath([[bodyL, roof, bodyW, 3]]);
  const acUnits: Rect[] = [];
  const acGrilles: Rect[] = [];
  sal.forEach(([from, to]) => {
    const place = (x: number) => {
      acUnits.push([x, roof - 5, 130, 5], [x + 4, roof - 7, 122, 2]);
      acGrilles.push(...repeat(14, 8, [x + 6, roof - 4, 4, 3] as Rect));
    };
    place(from + 40);
    if (to - from > 520) place(to - 170);
  });
  const acUnitsPath = pxPath(acUnits);
  const acGrillesPath = pxPath(acGrilles);
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
    [sal[0][0] + 160, roof - 12, 2, 8],
    [sal[0][0] + 159, roof - 14, 4, 2],
    [sal[sal.length - 1][1] - 120, roof - 10, 8, 4],
    [sal[sal.length - 1][1] - 60, roof - 9, 12, 3],
  ]);
  const roofWalk = pxPath(
    panels.flatMap(([a, b]) =>
      repeat(Math.max(1, Math.floor((b - a - 40) / 24)), 24, [a + 20, roof + 1, 14, 1] as Rect),
    ),
  );

  /* ---- underframe and running gear -------------------------------------- */

  const underframe = pxPath([[bodyL, floor, bodyW, skirt - floor]]);
  /** Equipment: converter, batteries, air reservoirs, and the cable run. */
  const boxes: Rect[] = [];
  sal.forEach(([from, to]) => {
    boxes.push([from + 40, floor + 2, 120, 14], [from + 180, floor + 4, 70, 11]);
    if (to - from > 600) boxes.push([to - 260, floor + 2, 110, 14], [to - 130, floor + 5, 60, 9]);
  });
  const underBoxes = pxPath(boxes);
  const underBoxSet = bevelPaths(boxes);
  const airTanks = pxPath(
    sal.flatMap(([from, to]) => {
      const cx = from + Math.round((to - from) / 2);
      return [
        [cx - 48, floor + 6, 96, 8],
        [cx - 52, floor + 8, 4, 4],
        [cx + 48, floor + 8, 4, 4],
      ] as Rect[];
    }),
  );
  const cabling = pxPath([[bodyL + 20, floor + 16, bodyW - 40, 2]]);

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

  const wheelCentres = L.bogies.flatMap((x) => [x - TRAIN.wheelbase / 2, x + TRAIN.wheelbase / 2]);
  const wheels = pxPath(wheelCentres.flatMap((cx) => wheel(cx)));
  const discs = pxPath(wheelCentres.flatMap((cx) => disc(cx)));
  const spokeSet = wheelCentres.map((cx) => ({ cx, d: pxPath(spokes(cx, WHEEL_CY)) }));
  const tyres = pxPath(wheelCentres.map((cx) => [cx - 16, 131, 32, 3] as Rect));

  /* ---- form: what makes the side of a train not a flat slab -------------- */

  /** The deepest shadow on the body side is directly under the roof gutter. */
  const aoRoof = aoPaths(panels.map(([a, b]) => [a, roof + 4, b - a] as const));
  /** A tone ramp down the plain body side, sill to band. */
  const beltA = pxPath([[bodyL, sill + 2, bodyW, 3]]);
  const beltB = pxPath([[bodyL, sill + 5, bodyW, 4]]);
  /** The bottom of the skirt is out of the light; the ballast bounces into it. */
  const skirtDark = pxPath([[bodyL, skirt - 7, bodyW, 7]]);
  const skirtBounce = pxPath([[bodyL, skirt - 2, bodyW, 2]]);
  /** Two catch lights along the tumblehome. Nothing says "metal tube" faster. */
  const spec = pxPath([
    [bodyL, roof + 6, bodyW, 1],
    [bodyL, head - 7, bodyW, 1],
  ]);
  /** The body sits over its own running gear and shades it. */
  const gearShade = pxPath([[bodyL, skirt, bodyW, 3]]);

  /* ---- what the unit does to the ground it stands on --------------------- */

  /**
   * Between the apron and the rail head there is 0.45 m of daylight in which
   * you can see sleepers, and under a train there is not: it is boxed in on
   * three sides. Three rows of warm black, deepening upward, and a darker pool
   * under each bogie where the frames close it off completely.
   */
  const groundShade = [
    pxPath([[bodyL - 6, skirt, bodyW + 12, 5]]),
    pxPath([[bodyL - 6, skirt + 5, bodyW + 12, 6]]),
    pxPath([[bodyL - 6, skirt + 11, bodyW + 12, 6]]),
  ];
  const bogiePools = pxPath(L.bogies.map((x) => [x - 74, skirt + 3, 148, 14] as Rect));
  /** The line where the unit meets the platform coping in front of it. */
  const contact = contactPaths([[bodyL - 4, bodyW + 8, RAIL]]);

  /**
   * The light a lit saloon throws across the platform, and the much stronger
   * light that comes out of an open door.
   *
   * Strictly the platform is drawn below the train rather than in front of it,
   * so a ray from a window could not land there — but the eye does not trace
   * rays, it reads pools of light under bright things, and a train pulling in
   * at night sweeping its own windows along the coping is worth more than the
   * geometry it costs.
   */
  /**
   * One pool of light on the platform: a trapezoid that starts inside the
   * opening it comes from and spreads as it falls away. `s` shrinks the whole
   * thing toward the opening's own centre line, which is what `tiers` wants —
   * each brighter tier has to sit *inside* the one under it or the stack reads
   * as four separate slabs instead of one falling-off pool.
   */
  const pool = (x: number, w: number, drop: number, spread: number, s: number): Rect[] => {
    const cx = x + w / 2;
    const top = ((w - 8) / 2) * s;
    const bot = (w / 2 + spread) * s;
    return steppedQuad(
      RAIL,
      Math.round(cx - top),
      Math.round(cx + top),
      RAIL + 2 + Math.round(drop * s),
      Math.round(cx - bot),
      Math.round(cx + bot),
      4,
    );
  };
  /**
   * The bays are 52 px on a 62 px pitch, so a pool spreading nine pixels either
   * side meets its neighbours and seventeen windows become one flat band of glow
   * along the coping. Three keeps them separate, which is the whole point: you
   * should be able to count the windows in the light on the ground.
   */
  const spillWindows = tiers((s) => windows.flatMap(([x, , w]) => pool(x, w, 11, 3, s)), "c", 0.8);
  const spillDoors = tiers((s) => L.doors.flatMap((x) => pool(x, doorW, 24, 16, s)), "w", 1.35);

  /**
   * The beam. In side elevation a headlight throws forward and down, so it is a
   * long wedge along the track that lands on the coping about eight metres out.
   * `s` narrows it about its own axis and pulls it back, so the tiers stack into
   * a bright core near the lamp and a long faint reach past it. Built per end;
   * only the leading one is ever drawn.
   */
  const beamRects = (endX: number, way: TrainDir, s: number): Rect[] => {
    const out: Rect[] = [];
    const step = 10;
    const reach = Math.round(300 * (0.45 + 0.55 * s));
    for (let d = 0; d < reach; d += step) {
      const t = d / 300;
      const cy = 106 + 22 * t;
      const hh = (3 + 15 * t) * s;
      out.push([
        way > 0 ? endX + d : endX - d - step,
        Math.round(cy - hh),
        step,
        Math.max(2, Math.round(hh * 2)),
      ]);
    }
    return out;
  };
  const beamB = tiers((s) => beamRects(len, 1, s), "w", 1);
  const beamA = tiers((s) => beamRects(0, -1, s), "w", 1);
  /** The halo round the lamps themselves, and the red one at the other end. */
  const haloB = tiers(
    (s) => steppedEllipse(len - 26, 105, Math.round(30 * s), Math.round(15 * s)),
    "w",
    1.2,
  );
  const haloA = tiers(
    (s) => steppedEllipse(26, 105, Math.round(30 * s), Math.round(15 * s)),
    "w",
    1.2,
  );
  const glowRedB = pxPath(steppedEllipse(len - 26, 112, 20, 9, 3));
  const glowRedA = pxPath(steppedEllipse(26, 112, 20, 9, 3));
  const glowDestB = pxPath([[len - 144, roof + 2, 120, 23]]);
  const glowDestA = pxPath([[24, roof + 2, 120, 23]]);

  /* ---- motion ------------------------------------------------------------ */

  /**
   * Smear: solid horizontal streaks, not dither.
   *
   * This was a dither pattern over the glass and the skirt, and it read as a
   * filthy train rather than a fast one — a field of dots is texture, and speed
   * in pixel art is *directional*. Thin unbroken rows drawn along the direction
   * of travel are what the eye takes for motion, and they cost the same.
   */
  const smearGlass = pxPath(repeat(7, 6, [bodyL, head + 3, bodyW, 2] as Rect, "y"));
  const smearSkirt = pxPath(repeat(4, 8, [bodyL, band + 7, bodyW, 2] as Rect, "y"));
  const smearRoof = pxPath(repeat(3, 8, [bodyL, roof + 8, bodyW, 2] as Rect, "y"));
  /** The dust the unit drags off its trailing end, one wake per direction. */
  const wakeRects: Rect[] = [
    [len - NX, 116, 64, 5],
    [len - NX + 8, 121, 78, 6],
    [len - NX + 20, 127, 92, 8],
  ];
  const wakeB = pxPath(wakeRects);
  const wakeA = pxPath(flipX(wakeRects));
  /**
   * Brake haze. Kept low — it belongs in the running gear and the bottom of the
   * skirt, where hot discs actually throw dust, not over the whole body side.
   */
  const brakeHaze = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 76, skirt - 8, 152, 8],
          [x - 84, skirt, 168, 12],
        ] as Rect[],
    ),
  );
  const sandPuff = pxPath(
    L.bogies.flatMap(
      (x) =>
        [
          [x - 66, 142, 16, 6],
          [x + 52, 142, 16, 6],
          [x - 74, 146, 26, 4],
          [x + 50, 146, 26, 4],
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
  const roofGrime = pxPath(panels.map(([a, b]) => [a, roof + 3, b - a, 7] as Rect));

  return {
    len,
    doors: L.doors,
    spans: L.spans,
    sal,
    bogies: L.bogies,
    bodyL,
    bodyR,
    bodyW,
    bodySet,
    camber,
    gutter,
    windowGlass,
    windowFrames,
    windowSeal,
    seams,
    glassBleed,
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
    doorAO,
    doorCheeks,
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
    plaqueKey,
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
    cabDark,
    cabSeat,
    cabSky,
    visor,
    wipers,
    washers,
    driverA,
    driverB,
    desk,
    deskGlowA,
    deskGlowB,
    destBox,
    destGrid,
    destBezel,
    destTextA,
    destTextB,
    lampBezel,
    lights,
    lightsFar,
    lensA,
    lensB,
    tailLights,
    tailLightsFar,
    numberPlate,
    plateTextA,
    plateTextB,
    hornGrille,
    frontRails,
    plough,
    coupler,
    hoses,
    cabDoor,
    cabDoorGlass,
    cabDoorFittings,
    cameraArm,
    noseLit,
    noseTurn,
    noseEdgeLit,
    noseEdgeTurn,
    roofLine,
    acUnits: acUnitsPath,
    acGrilles: acGrillesPath,
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
    wheelCentres,
    spokeSet,
    discs,
    tyres,
    aoRoof,
    beltA,
    beltB,
    skirtDark,
    skirtBounce,
    spec,
    gearShade,
    groundShade,
    bogiePools,
    contact,
    spillWindows,
    spillDoors,
    beamA,
    beamB,
    haloA,
    haloB,
    glowRedA,
    glowRedB,
    glowDestA,
    glowDestB,
    smearGlass,
    smearSkirt,
    smearRoof,
    wakeA,
    wakeB,
    brakeHaze,
    sandPuff,
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
 * motion
 *
 * A train that is translated by a group in the scene is a picture being
 * slid about. A train that is *given its path* can read its own speed off
 * it, and everything that makes movement feel physical falls out of that
 * one list of numbers: how fast the wheels turn, whether the body is
 * bobbing over the joints, how much the glass smears, whether the bogies
 * are hazing with brake dust or spitting sand.
 *
 * The plan is built once, at module scope, by whoever owns the timetable.
 * `begin` is the only per-mount part, so the scene spreads the plan and
 * adds it: `motion={{ ...ARRIVAL_PLAN, begin }}`.
 * ================================================================== */

export type MotionTrack = { keyTimes: string; values: string };

export type MotionPlan = {
  /** the translate itself */
  keyTimes: string;
  values: string;
  dur: string;
  /** which way it is going: the sign of its largest single move */
  dir: TrainDir;
  /** fastest leg, px per second */
  peak: number;
  /** 0 / 0.35 / 0.7 / 1 by speed — smear, wake */
  fast: MotionTrack;
  /** 1 while the wheels are turning */
  rolling: MotionTrack;
  /** slowing hard */
  braking: MotionTrack;
  /** pulling away */
  launching: MotionTrack;
  /** cumulative wheel angle in degrees, one per keyframe */
  spin: number[];
  /** the 1 px body bob over the rail joints, on its own dense track */
  bob: MotionTrack;
};

/** Fastest thing on this railway, for scaling the speed cues against. */
const SPEED_REF = 480;

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Build the discrete track for a per-segment value. */
function segTrack(times: number[], f: (i: number) => number): MotionTrack {
  const vs = times.map((_, i) => (i < times.length - 1 ? f(i) : f(times.length - 2)));
  return {
    keyTimes: times.map((t) => t.toFixed(4)).join(";"),
    values: vs.map((v) => v.toFixed(3)).join(";"),
  };
}

export function planMotion(keyTimes: string, values: string, dur: string): MotionPlan {
  const times = keyTimes.split(";").map((t) => Number(t));
  const xs = values.split(";").map((v) => Number(v.trim().split(/\s+/)[0]));
  const durS = Number(dur.replace(/s$/, "")) || 1;
  const n = Math.min(times.length, xs.length);
  const speed: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = (times[i + 1] - times[i]) * durS;
    speed.push(dt > 0 ? (xs[i + 1] - xs[i]) / dt : 0);
  }
  const peak = speed.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  let big = 0;
  for (let i = 1; i < speed.length; i++) if (Math.abs(speed[i]) > Math.abs(speed[big])) big = i;
  const net = xs[n - 1] - xs[0];
  const dir: TrainDir = (speed[big] || net) < 0 ? -1 : 1;

  const quant = (v: number) => {
    const r = Math.abs(v) / SPEED_REF;
    if (r < 0.12) return 0;
    if (r < 0.38) return 0.35;
    if (r < 0.7) return 0.7;
    return 1;
  };

  const fast = segTrack(times, (i) => quant(speed[i] ?? 0));
  const rolling = segTrack(times, (i) => (Math.abs(speed[i] ?? 0) > 8 ? 1 : 0));
  const braking = segTrack(times, (i) => {
    const now = Math.abs(speed[i] ?? 0);
    const before = Math.abs(speed[i - 1] ?? 0);
    return before - now > 30 && now > 4 ? Math.min(1, (before - now) / 260) : 0;
  });
  const launching = segTrack(times, (i) => {
    const now = Math.abs(speed[i] ?? 0);
    const before = Math.abs(speed[i - 1] ?? 0);
    return now - before > 30 && before < 140 ? Math.min(1, (now - before) / 200) : 0;
  });

  /**
   * Wheel angle. Degrees are distance over radius, so a linearly interpolated
   * angle between two keyframes *is* constant angular velocity over that leg —
   * the wheels decelerate into the platform exactly as the body does, and hold
   * still while it stands, without a single extra keyframe.
   */
  const spin: number[] = [0];
  for (let i = 1; i < n; i++) {
    spin.push(spin[i - 1] + ((xs[i] - xs[i - 1]) / TRAIN.wheelR) * (180 / Math.PI));
  }

  /* the bob needs its own, denser track: one flip per length of rail */
  const bobKs: number[] = [];
  const bobVs: string[] = [];
  const putBob = (t: number, v: string) => {
    const last = bobKs[bobKs.length - 1];
    if (last !== undefined && same(last, t)) {
      bobVs[bobVs.length - 1] = v;
      return;
    }
    bobKs.push(t);
    bobVs.push(v);
  };
  const travel = xs.reduce((a, x, i) => (i ? a + Math.abs(x - xs[i - 1]) : 0), 0);
  const pitch = Math.max(46, Math.ceil(travel / 260 / 8) * 8);
  putBob(0, "0 0");
  let flip = 0;
  for (let i = 0; i < n - 1; i++) {
    const span = Math.abs(xs[i + 1] - xs[i]);
    if (span < 2) {
      flip = 0;
      putBob(times[i], "0 0");
      continue;
    }
    const steps = Math.floor(span / pitch);
    for (let s = 1; s <= steps; s++) {
      flip ^= 1;
      putBob(times[i] + (times[i + 1] - times[i]) * ((s * pitch) / span), flip ? "0 1" : "0 0");
    }
  }
  putBob(1, "0 0");

  return {
    keyTimes,
    values,
    dur,
    dir,
    peak,
    fast,
    rolling,
    braking,
    launching,
    spin,
    bob: { keyTimes: bobKs.map((t) => t.toFixed(4)).join(";"), values: bobVs.join(";") },
  };
}

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
  dir,
  motion,
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
  ground = true,
  gear = true,
  headlights = true,
}: {
  ph: Ph;
  doors?: TrainDoors;
  /** saloon lighting; defaults to on after dark and off in full day */
  lit?: boolean;
  /** what the display says — "SOPOT", "GDYNIA GŁÓWNA" */
  destination: string;
  /**
   * Which cab is leading. Both ends are cabs, so this only picks which one gets
   * the headlights, the beam, the driver and the lit destination strip, and
   * which end the dust trails off. Read from `motion` when there is one.
   */
  dir?: TrainDir;
  /**
   * Where the unit is over the cycle. The unit applies this itself and reads its
   * own speed off it — wheels, bob, smear, wake, brake haze, sand.
   */
  motion?: MotionPlan & { begin: string };
  /** two cars fills a platform; three is the real set, for trains that pass */
  cars?: Cars;
  /** alternates with the destination on the display, as the real ones do */
  via?: string;
  /** the route box left of the destination */
  line?: string;
  /** carried on the nose plate at both ends */
  unitNumber?: string;
  /** the twelve-digit vehicle number, carried low on the body */
  uic?: string;
  /** the whole decal layer; off for a train seen at 300 px where it is noise */
  stickers?: boolean;
  /** a driver at the leading desk */
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
  /**
   * Whether the unit paints its own ground: the boxed-in dark under the apron,
   * the contact line on the coping, the light it throws onto the platform. Off
   * for a train cropped so hard that its own footline is outside the frame.
   */
  ground?: boolean;
  /** the running gear; off for a train cropped above the apron */
  gear?: boolean;
  /** headlights, beam and halo */
  headlights?: boolean;
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
  const way: TrainDir = dir ?? motion?.dir ?? 1;
  const moving = motion !== undefined && motion.peak > 12;
  const cyc = doors.mode === "cycle" ? doors : null;

  const leafAnim = (d: -1 | 1) =>
    cyc ? (
      <animateTransform
        attributeName="transform"
        type="translate"
        keyTimes={cyc.keyTimes}
        values={cyc.values
          .split(";")
          .map((v) => `${d * Number(v)} 0`)
          .join(";")}
        dur={cyc.dur}
        begin={cyc.begin}
        repeatCount="indefinite"
        calcMode="linear"
      />
    ) : null;

  /**
   * How far open the doors are, 0..1, off the same numbers that slide the
   * leaves. Everything that reacts to a door — the LED ring, the gap filler,
   * the light on the platform — rides this, so nothing can drift out of step
   * with the leaves themselves.
   */
  const openNow = doors.mode === "open" ? 1 : 0;
  const openAnim = () =>
    cyc ? (
      <animate
        attributeName="opacity"
        keyTimes={cyc.keyTimes}
        values={cyc.values
          .split(";")
          .map((v) => (Number(v) / (TRAIN.doorW / 2)).toFixed(3))
          .join(";")}
        dur={cyc.dur}
        begin={cyc.begin}
        repeatCount="indefinite"
        calcMode="linear"
      />
    ) : null;

  /** A speed-derived opacity track, held per leg. */
  const gateAnim = (t: MotionTrack) =>
    motion ? (
      <animate
        attributeName="opacity"
        calcMode="discrete"
        keyTimes={t.keyTimes}
        values={t.values}
        dur={motion.dur}
        begin={motion.begin}
        repeatCount="indefinite"
      />
    ) : null;

  /** Centred in the 108 px of usable display. */
  const destX = Math.max(2, Math.round((108 - destWidth(destination)) / 2));
  const viaX = via ? Math.max(2, Math.round((108 - destWidth(via)) / 2)) : 0;
  const destAt = way > 0 ? g.destTextB : g.destTextA;
  const destBack = way > 0 ? g.destTextA : g.destTextB;

  /** The lit strip, one per end: the leading one bright, the trailing one flat. */
  const destStrip = (at: { x: number; y: number }, op: number) => (
    <g transform={`translate(${at.x} ${at.y})`} opacity={op}>
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
  );

  const beam: readonly LightTier[] = way > 0 ? g.beamB : g.beamA;
  const halo: readonly LightTier[] = way > 0 ? g.haloB : g.haloA;
  const beamOp = night ? 1 : dark ? 0.62 : 0.2;
  const wake = way > 0 ? g.wakeA : g.wakeB;

  return (
    <g shapeRendering="crispEdges">
      {/* ---- what the unit does to the ground it stands on -------------- */}
      {ground ? (
        <>
          {/* the 0.45 m between apron and rail head, boxed in by the train */}
          <path d={g.groundShade[0]} fill={SHADE} opacity={night ? 0.3 : 0.5} />
          <path d={g.groundShade[1]} fill={SHADE} opacity={night ? 0.2 : 0.34} />
          <path d={g.groundShade[2]} fill={SHADE} opacity={night ? 0.12 : 0.2} />
          <path d={g.bogiePools} fill={SHADE} opacity={night ? 0.28 : 0.4} />
          <Contact set={g.contact} op={night ? 0.5 : 1} />
          {/* and, after dark, the light it puts back */}
          {inside && dark ? <Light set={g.spillWindows} op={night ? 1 : 0.55} /> : null}
          {inside && dark ? (
            <g opacity={openNow}>
              <Light set={g.spillDoors} />
              {openAnim()}
            </g>
          ) : null}
        </>
      ) : null}

      {/* the beam, ahead of the leading cab and under the body */}
      {headlights ? (
        <>
          <Light set={beam} op={beamOp} />
          <Light set={halo} op={dark ? 1 : 0.4} />
        </>
      ) : null}

      {/* ---- running gear: it does not bob, the body bobs on it --------- */}
      {gear ? (
        <>
          <path d={g.wheels} fill={night ? "#1a1d21" : "#2b2e32"} />
          <path d={g.tyres} fill={steel.hi} opacity={0.55} />
          <path d={g.discs} fill={steel.base} />
          {/* the marks that let you see the wheels turn */}
          {motion && moving
            ? g.spokeSet.map((s) => (
                <g key={s.cx}>
                  <path d={s.d} fill={steel.hi} opacity={0.5} />
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    keyTimes={motion.keyTimes}
                    values={motion.spin.map((a) => `${a.toFixed(1)} ${s.cx} ${WHEEL_CY}`).join(";")}
                    dur={motion.dur}
                    begin={motion.begin}
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                </g>
              ))
            : g.spokeSet.map((s) => <path key={s.cx} d={s.d} fill={steel.hi} opacity={0.4} />)}
          <path d={g.bogieFrames} fill={steel.lo} />
          <path d={g.suspension} fill={steel.mid} />
          <path d={g.axleBoxes} fill={steel.base} />
          <path d={g.sanders} fill={steel.deep} />
          <path d={g.antenna} fill="#5a4a2c" />
          {/* sand goes down under the leading axles when it pulls away */}
          {motion ? (
            <g opacity={0}>
              <path d={g.sandPuff} fill={DUST} />
              {gateAnim(motion.launching)}
            </g>
          ) : null}
        </>
      ) : null}

      {/* ================================================================
          the body. Everything from here up rides the 1 px bob, so the shell
          works over the bogies while they stay on the rail — which is the
          whole difference between a train moving and a picture sliding.
          ================================================================ */}
      <g>
        {motion ? (
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            keyTimes={motion.bob.keyTimes}
            values={motion.bob.values}
            dur={motion.dur}
            begin={motion.begin}
            repeatCount="indefinite"
          />
        ) : null}

        {/* underframe */}
        <path d={g.underframe} fill={blue.deep} />
        <Bev set={g.underBoxSet} mat={steel} />
        <path d={g.airTanks} fill={steel.mid} />
        <path d={g.cabling} fill={steel.deep} />
        {/* the body shades its own running gear */}
        <path d={g.gearShade} fill={SHADE} opacity={0.3} />

        {/* the shell */}
        <Bev set={g.bodySet} mat={shell} />
        <path d={g.camber} fill={shell.hi} opacity={0.7} />
        <path d={g.gutter} fill={shell.deep} opacity={0.55} />
        <path d={g.roofLine} fill={shell.deep} opacity={0.5} />
        <path d={g.seams} fill={shell.deep} opacity={0.35} />
        {/* form: the shadow under the gutter, the ramp down the side, the
            out-of-light bottom of the skirt and the bounce off the ballast */}
        <AOSet set={g.aoRoof} op={0.85} />
        <path d={g.spec} fill={shell.hi} opacity={0.5} />
        <path d={g.beltA} fill={SHADE} opacity={0.07} />
        <path d={g.beltB} fill={SHADE} opacity={0.12} />

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
        <path d={g.skirtDark} fill={SHADE} opacity={0.22} />
        <path d={g.skirtBounce} fill={dark ? "#3a4a5e" : "#8a7f6a"} opacity={0.3} />
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
        {/* after dark the saloon bleeds a pixel of itself onto the frame */}
        {dark && inside ? <path d={g.glassBleed} fill={SALOON} opacity={0.22} /> : null}
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
        {/* the gap filler comes out with the leaves and goes back with them */}
        <g opacity={openNow}>
          <path d={g.doorTread} fill={frame.deep} />
          {openAnim()}
        </g>
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
        {/* the recess: the surround shades the leaves, the cheeks are deeper */}
        <AOSet set={g.doorAO} op={0.9} />
        <path d={g.doorCheeks} fill={SHADE} opacity={0.16} />
        <path d={g.doorJamb} fill={frame.deep} />
        <path d={g.doorHandles} fill={yellow.mid} />
        {/* the button: dark until the doors are released, then green */}
        <path d={g.buttonRing} fill={dark ? "#4a5a4e" : "#3f4a44"} />
        <g opacity={openNow}>
          <path d={g.buttonRing} fill="#7ad86a" />
          {openAnim()}
        </g>
        <path d={g.buttonBody} fill={K_BUTTON(night)} />
        <path d={g.buttonMark} fill="#2a2410" opacity={0.8} />

        {/* ---- the cabs, both of them ------------------------------------ */}
        <path d={g.lampBezel} fill="#191c21" />
        <path d={g.screen} fill={night ? "#161b22" : "#6f8290"} />
        {/* the sky the top of the glass is holding, and the dark at the back */}
        <path d={g.cabSky} fill={night ? "#26303c" : "#a8bccc"} opacity={0.55} />
        <path d={g.cabDark} fill={night ? "#0e1116" : "#39414a"} />
        <path d={g.cabSeat} fill={night ? "#1a1f26" : "#2f3740"} opacity={0.9} />
        <path d={g.desk} fill="#20242a" opacity={0.85} />
        {crew ? (
          <>
            <path
              d={way > 0 ? g.deskGlowB : g.deskGlowA}
              fill={dark ? "#3fd08a" : "#6f8a7c"}
              opacity={dark ? 0.9 : 0.5}
            />
            <path
              d={way > 0 ? g.driverB : g.driverA}
              fill={night ? "#20252c" : "#3a4149"}
              opacity={0.9}
            />
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
        {/* the rakes: one nose faces the light, the other turns away from it */}
        <path d={g.noseLit} fill={dth("c", "12")} opacity={dark ? 0.2 : 0.34} />
        <path d={g.noseEdgeLit} fill={shell.hi} opacity={0.5} />
        <path d={g.noseTurn} fill={dth("n", "12")} opacity={dark ? 0.3 : 0.4} />
        <path d={g.noseEdgeTurn} fill={shell.deep} opacity={0.55} />

        {/* the destination strips, and the plate under each nose number */}
        <path d={g.destBezel} fill="#0b0d10" />
        <path d={g.destBox} fill="#101216" />
        {destStrip(destAt, 1)}
        {destStrip(destBack, 0.5)}
        <path d={g.destGrid} fill="#0b0d10" opacity={0.45} />
        {dark ? (
          <path d={way > 0 ? g.glowDestB : g.glowDestA} fill="#ffb03a" opacity={0.1} />
        ) : null}

        {/* lamps last, so nothing dims them */}
        {headlights ? (
          <>
            {/* the leading end */}
            <path d={way > 0 ? g.lights : g.lightsFar} fill="#fff6d8" />
            <path d={way > 0 ? g.lensB : g.lensA} fill="#ffffff" opacity={dark ? 0.95 : 0.6} />
            {/* and the trailing end, which is red */}
            <path d={way > 0 ? g.tailLightsFar : g.tailLights} fill="#e05050" />
            {dark ? (
              <path d={way > 0 ? g.glowRedA : g.glowRedB} fill="#e05050" opacity={0.16} />
            ) : null}
            {/* the lamps that are not lit at either end */}
            <path d={way > 0 ? g.tailLights : g.tailLightsFar} fill="#5a1c1c" opacity={0.7} />
            <path d={way > 0 ? g.lightsFar : g.lights} fill="#3a3020" opacity={0.8} />
          </>
        ) : null}

        {/* ---- the decal layer ------------------------------------------- */}
        {stickers ? (
          <>
            <path d={g.numberPlate} fill="#14171c" opacity={0.55} />
            <path d={g.decalPlateWhite} fill={DECAL.plate} />
            <path d={g.decalPlateBlue} fill={DECAL.blue} />
            <path d={g.decalPlateRed} fill={DECAL.red} />
            <path d={g.decalPlateGreen} fill={DECAL.green} />
            <path d={g.decalMarkInk} fill={DECAL.ink} />
            <path d={g.decalMarkWhite} fill={DECAL.plate} />
            <path d={g.decalMarkOnRed} fill={DECAL.plate} />
            <path d={g.decalMarkOnGreen} fill={DECAL.plate} />
            <path d={g.plaqueKey} fill={DECAL.plate} opacity={0.85} />
            <path d={g.plaquePlate} fill={DECAL.blue} />
            <path d={g.plaqueStars} fill={DECAL.star} />
            <path d={g.jackPoints} fill={yellow.base} />
            <path d={g.hvTriangle} fill={yellow.base} />
            <path d={g.hvBolt} fill={DECAL.red} />
            {/* retroreflective end stripes: brighter after dark, not dimmer */}
            <path d={g.reflectors} fill={dark ? "#fff2a8" : yellow.hi} opacity={dark ? 0.9 : 0.7} />

            {/* the operator's own lettering, at 2× and 3× the 3×5 font */}
            <g transform={`translate(${g.sal[g.sal.length - 1][0] + 320} 100) scale(3)`}>
              <path d={textPath(line, 0, 0)} fill={LIVERY.blue.base} />
            </g>
            <g transform={`translate(${g.sal[g.sal.length - 1][0] + 372} 104) scale(2)`}>
              <path d={textPath("TROJMIASTO", 0, 0)} fill={LIVERY.blue.mid} />
            </g>
            <g transform={`translate(${g.sal[0][0] + 175} 100) scale(2)`}>
              <path d={textPath("PKP SKM", 0, 0)} fill={LIVERY.blue.base} />
            </g>
            <g transform={`translate(${g.sal[0][0] + 255} 125)`}>
              <path d={textPath(uic, 0, 0)} fill={shell.hi} opacity={0.75} />
            </g>
            {/* the unit number on both nose plates, which is where it lives */}
            <g transform={`translate(${g.plateTextB.x} ${g.plateTextB.y})`}>
              <path d={textPath(unitNumber, 0, 0)} fill="#e8e6df" />
            </g>
            <g transform={`translate(${g.plateTextA.x} ${g.plateTextA.y})`}>
              <path d={textPath(unitNumber, 0, 0)} fill="#e8e6df" />
            </g>

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

        {/* ---- and what speed does to all of it -------------------------- */}
        {motion ? (
          <>
            <g opacity={0}>
              <path d={g.smearRoof} fill={shell.hi} opacity={0.22} />
              <path d={g.smearGlass} fill={dark ? "#8fa8bc" : "#e8eef2"} opacity={0.26} />
              <path d={g.smearSkirt} fill={blue.hi} opacity={0.3} />
              {gateAnim(motion.fast)}
            </g>
            <g opacity={0}>
              <path d={g.brakeHaze} fill={DUST} />
              {gateAnim(motion.braking)}
            </g>
          </>
        ) : null}
      </g>

      {/* the wake drags off the trailing end, outside the bob */}
      {motion ? (
        <g opacity={0}>
          <path d={wake} fill={DUST} />
          {gateAnim(motion.fast)}
        </g>
      ) : null}

      {motion ? (
        <animateTransform
          attributeName="transform"
          type="translate"
          keyTimes={motion.keyTimes}
          values={motion.values}
          dur={motion.dur}
          begin={motion.begin}
          repeatCount="indefinite"
          calcMode="linear"
        />
      ) : null}
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
