import { dim, dth, M, type Mat, type Ph, pxPath, type Rect, repeat, shift } from "@/engine";

// --- what goes past the window ----------------------------------------------

/**
 * The view out of a moving SKM carriage between Przymorze and Gdańsk.
 *
 * This is the part of the train that has to do the most work. §19 of the brief
 * is explicit that the scenery must not be "a generic scrolling background", and
 * the difference between a scrolling background and a journey is entirely in
 * three things: how many speeds there are, whether what goes past is *in an
 * order*, and whether anything ever interrupts it.
 *
 * ==================================================================
 * TWO THINGS WERE WRONG BEFORE ANY OF THAT
 *
 * 1. THE BAND WAS AT THE WRONG KEY. `VIEW.bottom` was 98, and the saloon reads
 *    its vertical key off that number: the sill of an EMU is 1.00 m above the
 *    floor, the floor is y=150, so FLOOR − VIEW.bottom is one metre in pixels.
 *    98 declared a metre to be 52 px while the player walks at 38 — every seat,
 *    pole and doorway in the carriage came out 37% oversized, and no amount of
 *    detail in here fixes a room built to the wrong ruler. The band is now
 *    72…112: a 2.05 m window head and a 1.00 m sill at the game's own key, and
 *    FLOOR − VIEW.bottom comes out at exactly 38.
 *
 * 2. THE PLANES DID NOT COVER THE WINDOW. Every plane was drawn twice and
 *    shifted by one period, which loops seamlessly but only covers 2 × period of
 *    scene. The lineside period is 420 px on a 1400 px scene: the fence posts,
 *    the masts, the entire nearest and fastest plane — the one doing all the
 *    work of saying *moving* — stopped three fifths of the way across and the
 *    right of every window had nothing in it. The near plane had the same hole
 *    at one end of its cycle. `Scroller` now works out how many copies the width
 *    actually needs.
 * ==================================================================
 *
 * ## Speeds
 *
 * Six planes, each on its own SMIL clock, at speeds that are the real ratio of
 * their distances rather than six numbers that looked right:
 *
 *   track       2 m out     3.4 s per period   sleepers, the adjacent rail
 *   lineside    6 m out     9 s                fences, masts, relay boxes, signals
 *   near       40 m out    26 s                sheds, sidings, walls, trees
 *   mid       250 m out    74 s                blocks, gasholder, the yard, a bridge
 *   far         2 km out  260 s                the skyline and the Stocznia cranes
 *   cloud      far          620 s              weather, which barely moves at all
 *
 * At those ratios the sleepers are a strobe, the catenary masts flick past
 * almost too fast to count, the cranes barely move, and the eye reads distance
 * without being told.
 *
 * ## Order
 *
 * One period of the mid plane is a *route*, not a texture: the depot at
 * Przymorze, the blocks along Obrońców Wybrzeża, the retail park, the works and
 * the gasholder, the shipyard, allotments and poplars, the canal bridge, then
 * the throat of the next station. It loops, because the line is a loop as far as
 * this game is concerned, but within one period things arrive in the order they
 * arrive in on the actual railway.
 *
 * ## Interruption
 *
 * The thing a real journey has that a loop does not is events: a bridge takes
 * the light away, a train comes the other way and fills the window for a second
 * and a half, a level crossing flashes past with its lights going. Those are
 * what stop the eye settling into the loop, and they are why `SHADE_CYCLE` is
 * exported — the saloon's own lighting animation must dip on the *same* frame
 * the bridge arrives, or the carriage goes dark to no cause.
 *
 * ## Seamlessness
 *
 * Every plane is drawn ⌈width / period⌉ + 1 times, back to back, and the strip
 * translates by exactly one period. That is the only way to loop with no visible
 * join, and it costs nothing but copies of paths that are merged into one path
 * per material anyway.
 */

/* ========================================================== the geometry === */

/** The game's key, shared with the player and every other scene. */
const PPM = 38;
const mm = (metres: number) => Math.round(metres * PPM);
/** The saloon floor, which is y=150 in every scene in the game. */
const FLOOR_Y = 150;

/**
 * The window band.
 *
 * Derived rather than typed: a low-floor EMU has its window head at 2.05 m and
 * its sill at 1.00 m above the saloon floor. The saloon reads the sill back out
 * of this to get its own metre, so these two numbers are load-bearing for the
 * whole of trainScene and should be changed in metres, never in pixels.
 */
export const VIEW = {
  top: FLOOR_Y - mm(2.05),
  bottom: FLOOR_Y - mm(1.0),
} as const;
const H = VIEW.bottom - VIEW.top;

/**
 * The horizon sits at the eye of whoever is looking, and the person looking is
 * standing: 1.62 m, sixteen pixels below the window head. That leaves 16 px of
 * sky and 24 px of ground, which is not the proportion you would choose but is
 * the proportion you get — most of what you see out of a train window is ground
 * going past too fast to resolve, and the skyline is a thin strip at the top
 * that you have to look up slightly to find.
 */
const EYE_M = 1.62;
const HORIZON = FLOOR_Y - mm(EYE_M);
/** Apparent height above the horizon, for anything standing on it. */
const sky = (px: number) => HORIZON - px;
const SKY_H = HORIZON - VIEW.top;
const GROUND_H = VIEW.bottom - HORIZON;

/** One period of each plane, in scene px. Wider = longer before it repeats. */
export const PERIOD = {
  track: 96,
  lineside: 420,
  near: 900,
  mid: 2400,
  far: 3600,
  cloud: 2000,
} as const;
/** Seconds per period. The ratios are the distances; the absolutes are the speed. */
export const SPEED_S = {
  track: 3.4,
  lineside: 9,
  near: 26,
  mid: 74,
  far: 260,
  cloud: 620,
} as const;

/** Which way the unit is running. The whole view reverses with it. */
export type Dir = 1 | -1;
export type Weather = "clear" | "rain";

/* ------------------------------------------------------------- palette ---- */

/**
 * Five sky bands rather than three. Three gave a horizon that stepped in one
 * hard jump from blue to pale; five gives a ramp you read as depth of air, and
 * the dither between them hides the banding at no cost.
 */
const SKY: Record<Ph, string[]> = {
  dawn: ["#6d86ab", "#8ba3c4", "#b6c0cc", "#cfc7b6", "#e8d3ae"],
  day: ["#6f9cc6", "#7fa8cc", "#9dc0da", "#b4d0e2", "#c9dde9"],
  dusk: ["#3a2e52", "#4a3b63", "#8d5a78", "#c97a6a", "#e0925e"],
  night: ["#0b0d1e", "#12142a", "#1c1a34", "#24213c", "#2f2a44"],
};
const HAZE: Record<Ph, string> = {
  dawn: "#d8cfb8",
  day: "#c2d8e6",
  dusk: "#e0925e",
  night: "#2a2740",
};
/** The sun or the moon, and what it does to the air around it. */
const ORB: Record<Ph, { x: number; y: number; core: string; glow: string; r: number }> = {
  dawn: { x: 0.22, y: 0.72, core: "#ffe6b8", glow: "#f0c48a", r: 4 },
  day: { x: 0.68, y: 0.2, core: "#fffbe8", glow: "#e8eef2", r: 3 },
  dusk: { x: 0.78, y: 0.78, core: "#ffd08a", glow: "#e08a52", r: 5 },
  night: { x: 0.3, y: 0.24, core: "#e8ecf6", glow: "#7f88a8", r: 3 },
};
const GROUND_BAND: Record<Ph, string> = {
  dawn: "#4a4438",
  day: "#5a5347",
  dusk: "#3a2f2e",
  night: "#14161f",
};
/** Sodium lamps, lit windows, headlights, signal aspects. */
const LAMP = {
  sodium: "#ffb457",
  window: "#ffd98a",
  head: "#fff4d0",
  tail: "#d94a3a",
  green: "#4ad07a",
  red: "#e04a44",
  warn: "#ff5a4a",
} as const;

/**
 * Aerial perspective.
 *
 * What makes six planes read as six distances is not hue, it is *value*: the far
 * plane must be nearly as light as the sky and the nearest nearly black, with
 * everything else spaced between. An earlier version hazed far at 0.62 and mid
 * at 0.58 — a four percent difference — and the whole view came out as one brown
 * mass with no horizon in it.
 *
 * `far()` mixes toward the haze and `dark()` toward black; `depth()` picks
 * between them by distance so a plane's treatment follows from where it is
 * rather than from what somebody typed.
 */
const far = (mat: Mat, ph: Ph, k: number) => dim(mat, HAZE[ph], k);
const dark = (mat: Mat, ph: Ph, k: number) => dim(mat, ph === "night" ? "#05060a" : "#171b22", k);
const depth = (mat: Mat, ph: Ph, metres: number): Mat => {
  if (metres >= 900) return far(mat, ph, 0.78);
  if (metres >= 150) return dark(far(mat, ph, 0.34), ph, 0.3);
  if (metres >= 20) return dark(mat, ph, 0.62);
  return dark(mat, ph, ph === "night" ? 0.82 : 0.76);
};

/* ---------------------------------------------------------- primitives ---- */

/** A stepped disc, for anything round: the sun, a gasholder, a wheel. */
function disc(cx: number, cy: number, r: number): Rect[] {
  const out: Rect[] = [];
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (w > 0) out.push([cx - w, cy + dy, w * 2, 1]);
  }
  return out;
}
/** Deterministic noise, so nothing in the landscape ever flickers between frames. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The strip-scroller every plane is built on.
 *
 * It draws its children as many times as the width actually needs — not twice —
 * and translates the lot by exactly one period. Reversing `dir` runs the whole
 * journey the other way, which is what the unit does at Gdynia when it turns
 * round, and `pace` scales every clock at once for a service that is running
 * slow.
 */
function Scroller({
  period,
  seconds,
  width,
  dir = 1,
  pace = 1,
  children,
}: {
  period: number;
  seconds: number;
  width: number;
  dir?: Dir;
  pace?: number;
  children: React.ReactNode;
}) {
  const copies = Math.max(2, Math.ceil(width / period) + 1);
  const from = dir === 1 ? 0 : -period;
  const to = dir === 1 ? -period : 0;
  return (
    <g>
      {Array.from({ length: copies }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed strip copies
        <g key={`c${i}`} transform={i === 0 ? undefined : `translate(${i * period} 0)`}>
          {children}
        </g>
      ))}
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`${from} 0;${to} 0`}
        dur={`${(seconds * pace).toFixed(2)}s`}
        repeatCount="indefinite"
        calcMode="linear"
      />
    </g>
  );
}

/** A light that blinks: aircraft warnings, level crossings, a failing lamp. */
function Blink({
  d,
  fill,
  dur,
  values = "1;1;0.05;0.05;1",
  keyTimes = "0;0.42;0.46;0.92;1",
  opacity = 1,
}: {
  d: string;
  fill: string;
  dur: string;
  values?: string;
  keyTimes?: string;
  opacity?: number;
}) {
  return (
    <path d={d} fill={fill} opacity={opacity}>
      <animate
        attributeName="opacity"
        values={values}
        keyTimes={keyTimes}
        dur={dur}
        repeatCount="indefinite"
        calcMode="discrete"
      />
    </path>
  );
}

/* ============================================================== *
 * SKY — bands, the orb, weather
 * ============================================================== */

export function ViewSky({ ph, width }: { ph: Ph; width: number }) {
  const stops = SKY[ph];
  const band = H / stops.length;
  const orb = ORB[ph];
  const ox = Math.round(width * orb.x);
  const oy = Math.round(VIEW.top + SKY_H * orb.y);
  return (
    <g>
      {stops.map((c, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed sky bands
          key={`vs${i}`}
          x={-40}
          y={VIEW.top + i * band}
          width={width + 80}
          height={band + 1}
          fill={c}
        />
      ))}
      {/* dither the seams, which is cheaper and better than more bands */}
      <path
        d={pxPath(
          stops.slice(1).map((_, i) => [-40, VIEW.top + (i + 1) * band - 2, width + 80, 4] as Rect),
        )}
        fill={dth("c", "25")}
        opacity={0.3}
      />

      {/* the sun, or the moon, and the air lit up around it */}
      <path
        d={pxPath(disc(ox, oy, orb.r + 4))}
        fill={orb.glow}
        opacity={ph === "day" ? 0.2 : 0.3}
      />
      <path d={pxPath(disc(ox, oy, orb.r + 2))} fill={orb.glow} opacity={0.45} />
      <path d={pxPath(disc(ox, oy, orb.r))} fill={orb.core} />
      {ph === "night" ? (
        /* the moon's terminator, one rect, which is all it takes */
        <path d={pxPath(disc(ox - 2, oy - 1, orb.r - 1))} fill={SKY.night[1]} opacity={0.85} />
      ) : null}

      {/* stars, on a fixed lattice so they never crawl */}
      {ph === "night" ? (
        <path
          d={pxPath(
            Array.from({ length: 40 }, (_, i) => {
              const x = Math.round(hash(i * 3.1) * (width + 80)) - 40;
              const yy = VIEW.top + Math.round(hash(i * 7.7) * (SKY_H - 3));
              return [x, yy, 1, 1] as Rect;
            }),
          )}
          fill="#cfd6ea"
          opacity={0.55}
        />
      ) : null}
    </g>
  );
}

/** Cloud, on its own very slow clock: the only thing out there going our way. */
const CLOUD_SHAPES: Rect[] = [
  [80, sky(13), 90, 4],
  [96, sky(15), 58, 3],
  [120, sky(17), 26, 2],
  [420, sky(11), 120, 4],
  [450, sky(13), 70, 3],
  [900, sky(14), 74, 3],
  [920, sky(16), 40, 2],
  [1300, sky(10), 150, 4],
  [1340, sky(12), 90, 3],
  [1700, sky(12), 60, 3],
];

export function CloudPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const tint = ph === "night" ? "#2a2b40" : ph === "dusk" ? "#c98a72" : "#e8eef2";
  return (
    <Scroller period={PERIOD.cloud} seconds={SPEED_S.cloud} width={width} dir={dir} pace={pace}>
      <path d={pxPath(CLOUD_SHAPES)} fill={tint} opacity={ph === "night" ? 0.5 : 0.75} />
      <path
        d={pxPath(CLOUD_SHAPES.map(([x, yy, w, h]) => [x + 4, yy + h - 1, w - 8, 1] as Rect))}
        fill={HAZE[ph]}
        opacity={0.4}
      />
    </Scroller>
  );
}

/* ============================================================== *
 * FAR — the skyline, and the cranes
 * ============================================================== */

/**
 * The Stocznia cranes.
 *
 * The single most recognisable thing on the Gdańsk skyline and the one the brief
 * names, so they are drawn properly: a portal crane is a tall A-frame on a
 * gantry with a long horizontal jib and a shorter counter-jib, and the
 * silhouette that reads is the *jib* — a thin horizontal line very high up with
 * a hook block hanging off it. Six of them at different heights, because they
 * are never the same height, plus the slipway gantries behind. At night the tops
 * carry aircraft warning lights and those blink, which is the one bit of the far
 * plane that moves.
 */
function crane(x: number, h: number, span: number): Rect[] {
  const base = HORIZON + 1;
  const top = base - h;
  return [
    [x, top, 2, h],
    [x + 8, top + 3, 1, h - 3],
    [x - span + 9, top + 2, span, 1],
    [x + 9, top + 2, 10, 1],
    [x + 1, top - 2, 8, 2],
    [x - span + 15, top + 3, 1, 5],
    [x - 3, base - 2, 17, 2],
  ];
}
const CRANE_X: [number, number, number][] = [
  [300, 13, 26],
  [356, 10, 20],
  [408, 12, 23],
  [472, 9, 17],
  [532, 11, 21],
  [596, 8, 15],
];
const CRANES: Rect[] = CRANE_X.flatMap(([x, h, s]) => crane(x, h, s));
const CRANE_LIGHTS = pxPath(CRANE_X.map(([x, h]) => [x, HORIZON + 1 - h - 3, 2, 2] as Rect));

/** The slipway sheds and the hull halls behind them. */
const YARD_SHEDS: Rect[] = [
  [250, sky(6), 84, 7],
  [340, sky(8), 110, 9],
  [456, sky(5), 70, 6],
  [532, sky(7), 88, 8],
];
/** The city: St Mary's, the town hall, a power station, and a stand of blocks. */
const CITY: Rect[] = [
  /* Bazylika Mariacka — the one silhouette everybody knows */
  [1180, sky(11), 10, 12],
  [1178, sky(13), 14, 2],
  /* the town hall spire */
  [1236, sky(10), 3, 11],
  [1237, sky(13), 1, 3],
  /* the chimneys at Ołowianka, and the radio mast on the hill */
  [1320, sky(13), 3, 14],
  [1332, sky(11), 3, 12],
  [1420, sky(15), 1, 16],
  [1418, sky(9), 5, 1],
  /* and then the flats */
  ...repeat(9, 24, [1480, sky(6), 16, 7] as Rect),
  ...repeat(6, 28, [1720, sky(8), 20, 9] as Rect),
];
/** A stand of nothing much, so the far plane is not all landmark. */
const FAR_FILLER: Rect[] = [
  ...repeat(14, 32, [2000, sky(4), 22, 5] as Rect),
  ...repeat(10, 38, [2470, sky(5), 26, 6] as Rect),
  ...repeat(16, 28, [2880, sky(3), 18, 4] as Rect),
];
/** Lit windows, on a lattice: nine per slab, not one long smear. */
const FAR_LIGHTS = pxPath([
  ...repeat(9, 24, [1483, sky(5), 3, 2] as Rect),
  ...repeat(9, 24, [1489, sky(3), 3, 2] as Rect),
  ...repeat(6, 28, [1724, sky(6), 3, 2] as Rect),
  ...repeat(6, 28, [1731, sky(4), 3, 2] as Rect),
  ...repeat(14, 32, [2004, sky(3), 3, 2] as Rect),
]);

export function FarPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const night = ph === "night";
  const mat = depth(M.concrete, ph, 2000);
  const steel = far(M.steel, ph, 0.72);
  return (
    <Scroller period={PERIOD.far} seconds={SPEED_S.far} width={width} dir={dir} pace={pace}>
      <path d={pxPath(YARD_SHEDS)} fill={mat.mid} />
      <path d={pxPath(CRANES)} fill={night ? "#3a3244" : steel.lo} />
      <path d={pxPath(CITY)} fill={mat.base} />
      <path d={pxPath(FAR_FILLER)} fill={mat.mid} opacity={0.9} />
      {night ? (
        <>
          <path d={FAR_LIGHTS} fill={LAMP.window} opacity={0.55} />
          <Blink d={CRANE_LIGHTS} fill={LAMP.warn} dur="2.6s" opacity={0.9} />
        </>
      ) : null}
    </Scroller>
  );
}

/* ============================================================== *
 * MID — the route, in the order you meet it
 * ============================================================== */

/**
 * One period of the mid plane is the journey. The x ranges below are the
 * segments and the comments are the brief's own list of them; the export exists
 * so a debug overlay can label what is currently going past, which is the
 * fastest way to check that the order still reads.
 */
export const MID_SEGMENTS: { from: number; to: number; what: string }[] = [
  { from: 0, to: 260, what: "the depot: sidings, containers, a shunter" },
  { from: 260, to: 620, what: "the blocks along Obrońców Wybrzeża, and the road" },
  { from: 620, to: 900, what: "the retail park: a shed, a totem, a car park" },
  { from: 900, to: 1240, what: "the works: sheds, a gasholder, a chimney, scrap" },
  { from: 1240, to: 1660, what: "the shipyard: hull halls, cranes close in, a bow" },
  { from: 1660, to: 1900, what: "open ground: allotments, poplars, floodlights" },
  { from: 1900, to: 2120, what: "the canal: the truss bridge, water, a barge" },
  { from: 2120, to: 2400, what: "the throat of the next station" },
];

/** The depot at the start of the period: containers, sidings, a shunter. */
const DEPOT: Rect[] = [
  [10, sky(5), 60, 6],
  [80, sky(4), 44, 5],
  [130, sky(7), 70, 8],
  /* containers, stacked two high */
  [20, sky(3), 26, 4],
  [48, sky(3), 26, 4],
  [20, sky(7), 26, 4],
  /* the shunter, standing */
  [206, sky(4), 34, 5],
  [206, sky(5), 34, 1],
];
/** Slab blocks: the long ones along the road. */
const MID_BLOCKS: Rect[] = [
  ...repeat(4, 92, [270, sky(13), 82, 14] as Rect),
  ...repeat(2, 104, [640, sky(10), 88, 11] as Rect),
];
/** Balcony banding, which is all you see of a block at speed. */
const MID_BANDS = pxPath(
  MID_BLOCKS.flatMap(([x, yy, w, h]) =>
    Array.from(
      { length: Math.floor((h - 3) / 4) },
      (_, i) => [x + 2, yy + 3 + i * 4, w - 4, 1] as Rect,
    ),
  ),
);
/** The road in front of them, its lamp columns and its crash barrier. */
const ROAD: Rect[] = [[260, HORIZON + 3, 380, 3]];
const LAMP_COLUMNS: Rect[] = repeat(7, 56, [276, sky(9), 1, 12] as Rect).flatMap(
  ([x, yy, w, h]) => [[x, yy, w, h] as Rect, [x, yy, 4, 1] as Rect],
);
const LAMP_HEADS = pxPath(repeat(7, 56, [277, sky(9), 3, 1] as Rect));
/** Traffic on it, on its own clock, going the other way because it always is. */
const CARS: Rect[] = [
  [0, HORIZON + 1, 9, 3],
  [0, HORIZON, 5, 1],
  [40, HORIZON + 1, 7, 3],
  [96, HORIZON + 1, 11, 3],
  [96, HORIZON, 6, 1],
  [150, HORIZON + 1, 8, 3],
];

/** The retail park: one big shed, a totem sign, and a car park full of nothing. */
const RETAIL: Rect[] = [
  [640, sky(8), 150, 9],
  [640, sky(9), 150, 1],
  [800, sky(11), 4, 12],
  [796, sky(14), 12, 4],
];
const CARPARK = pxPath(repeat(12, 9, [660, HORIZON + 4, 6, 2] as Rect));

/** Industrial: sheds with monitor roofs, a gasholder, a chimney, a scrap crane. */
const MID_SHEDS: Rect[] = [
  [910, sky(8), 118, 9],
  [910, sky(10), 118, 2],
  [1040, sky(6), 82, 7],
  [1130, sky(9), 96, 10],
];
const GASHOLDER: Rect[] = [
  ...disc(1070, sky(9), 12).filter((r) => r[1] <= HORIZON),
  [1058, sky(12), 24, 1],
];
const CHIMNEY: Rect[] = [
  [1204, sky(20), 4, 21],
  [1202, sky(20), 8, 2],
];
/** The smoke off it, which drifts and is the only soft edge in the picture. */
const SMOKE: Rect[] = [
  [1206, sky(24), 5, 3],
  [1210, sky(27), 8, 3],
  [1216, sky(29), 11, 3],
];
const SCRAP: Rect[] = [
  [1150, sky(4), 40, 5],
  [1168, sky(11), 2, 8],
  [1150, sky(12), 22, 1],
];

/** The hull halls, the cranes standing over them, and a bow in the water. */
const MID_YARD: Rect[] = [
  [1250, sky(10), 130, 11],
  [1390, sky(13), 104, 14],
  [1508, sky(8), 96, 9],
];
const SHIP_BOW: Rect[] = [
  [1610, sky(9), 40, 10],
  [1646, sky(11), 8, 3],
  [1610, sky(2), 44, 3],
];
const YARD_CRANES: Rect[] = [
  ...crane(1300, 17, 30),
  ...crane(1440, 15, 26),
  ...crane(1560, 18, 32),
];

/** Allotments: sheds the size of a wardrobe, poplars, and a floodlit pitch. */
const ALLOTMENTS: Rect[] = repeat(7, 34, [1670, sky(3), 13, 4] as Rect);
const POPLARS: Rect[] = [1690, 1748, 1812, 1874, 1930].flatMap((x) => [
  [x, sky(15), 3, 16] as Rect,
  [x - 2, sky(12), 7, 9] as Rect,
  [x - 1, sky(17), 5, 4] as Rect,
]);
const FLOODLIGHTS: Rect[] = [1710, 1790, 1860].flatMap((x) => [
  [x, sky(18), 2, 19] as Rect,
  [x - 3, sky(20), 8, 3] as Rect,
]);
const FLOOD_GLOW = pxPath([1710, 1790, 1860].map((x) => [x - 4, sky(21), 10, 3] as Rect));

/** The canal: a lattice truss seen side on, the water, a barge tied up. */
const BRIDGE_TRUSS: Rect[] = [
  [1910, sky(14), 190, 2],
  [1910, sky(2), 190, 3],
  ...repeat(10, 20, [1912, sky(14), 2, 13] as Rect),
  /* the diagonals, stepped */
  ...Array.from({ length: 9 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => [1916 + i * 20 + j * 4, sky(13) + j * 2, 4, 2] as Rect),
  ).flat(),
];
const WATER: Rect[] = [[1900, HORIZON + 2, 210, 6]];
const WATER_GLINT: Rect[] = [
  [1930, HORIZON + 3, 14, 1],
  [1970, HORIZON + 5, 22, 1],
  [2030, HORIZON + 4, 18, 1],
  [2074, HORIZON + 6, 12, 1],
];
const BARGE: Rect[] = [
  [1990, HORIZON, 54, 3],
  [2028, sky(4), 12, 5],
];

/** The next station: a canopy, a name board, and people waiting under it. */
const NEXT_STATION: Rect[] = [
  [2150, sky(11), 200, 2],
  [2154, sky(9), 2, 10],
  [2244, sky(9), 2, 10],
  [2340, sky(9), 2, 10],
  [2180, sky(6), 44, 5],
];
const PLATFORM: Rect[] = [[2140, HORIZON + 1, 220, 3]];
const WAITING: Rect[] = [2196, 2214, 2270, 2300, 2312].flatMap((x) => [
  [x, sky(5), 3, 3] as Rect,
  [x - 1, sky(2), 5, 4] as Rect,
]);
/** The signal gantry on the approach, with its aspects. */
const SIGNAL_GANTRY: Rect[] = [
  [2380, sky(17), 2, 18],
  [2360, sky(17), 24, 2],
  [2364, sky(15), 4, 6],
  [2374, sky(15), 4, 6],
];

export function MidPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const night = ph === "night";
  const slab = depth(M.render, ph, 250);
  const steel = dark(far(M.steel, ph, 0.3), ph, 0.34);
  const conc = dark(far(M.concrete, ph, 0.32), ph, 0.3);
  const leaf = dark(far(M.leaf, ph, 0.3), ph, 0.36);
  const wood = dark(M.wood, ph, 0.42);
  return (
    <Scroller period={PERIOD.mid} seconds={SPEED_S.mid} width={width} dir={dir} pace={pace}>
      {/* the depot */}
      <path d={pxPath(DEPOT)} fill={steel.mid} />
      {/* the blocks and their road */}
      <path d={pxPath(MID_BLOCKS)} fill={slab.base} />
      <path d={MID_BANDS} fill={slab.lo} opacity={0.6} />
      <path d={pxPath(ROAD)} fill={conc.deep} />
      <path d={pxPath(LAMP_COLUMNS)} fill={steel.deep} opacity={0.8} />
      {/* the retail park */}
      <path d={pxPath(RETAIL)} fill={steel.base} />
      <path d={CARPARK} fill={conc.lo} opacity={0.8} />
      {/* the works */}
      <path d={pxPath(MID_SHEDS)} fill={steel.mid} />
      <path d={pxPath(GASHOLDER)} fill={steel.lo} />
      <path d={pxPath(CHIMNEY)} fill={conc.mid} />
      <path d={pxPath(SMOKE)} fill={HAZE[ph]} opacity={night ? 0.14 : 0.3} />
      <path d={pxPath(SCRAP)} fill={steel.deep} opacity={0.85} />
      {/* the shipyard */}
      <path d={pxPath(MID_YARD)} fill={conc.mid} />
      <path d={pxPath(YARD_CRANES)} fill={night ? "#39374a" : steel.lo} />
      <path d={pxPath(SHIP_BOW)} fill={dark(M.red, ph, 0.44).lo} />
      {/* open ground */}
      <path d={pxPath(ALLOTMENTS)} fill={wood.base} />
      <path d={pxPath(POPLARS)} fill={leaf.base} />
      <path d={pxPath(FLOODLIGHTS)} fill={steel.deep} />
      {/* the canal */}
      <path d={pxPath(WATER)} fill={night ? "#101828" : dim(M.concrete, HAZE[ph], 0.5).lo} />
      <path d={pxPath(WATER_GLINT)} fill={HAZE[ph]} opacity={night ? 0.25 : 0.6} />
      <path d={pxPath(BARGE)} fill={steel.deep} />
      <path d={pxPath(BRIDGE_TRUSS)} fill={night ? "#3f3a4a" : steel.deep} />
      {/* the next station */}
      <path d={pxPath(PLATFORM)} fill={conc.base} />
      <path d={pxPath(NEXT_STATION)} fill={conc.base} />
      <path d={pxPath(WAITING)} fill={dark(M.concrete, ph, 0.8).deep} />
      <path d={pxPath(SIGNAL_GANTRY)} fill={steel.deep} />
      <path d={pxPath([[2365, sky(14), 2, 2]])} fill={LAMP.green} opacity={0.9} />

      {night ? (
        <>
          <path d={LAMP_HEADS} fill={LAMP.sodium} opacity={0.8} />
          <path d={FLOOD_GLOW} fill="#dfe8ff" opacity={0.5} />
          <path
            d={pxPath([
              ...repeat(4, 92, [276, sky(12), 4, 2] as Rect),
              ...repeat(4, 92, [286, sky(8), 4, 2] as Rect),
              ...repeat(2, 104, [646, sky(9), 4, 2] as Rect),
              [2184, sky(5), 6, 2],
            ])}
            fill={LAMP.window}
            opacity={0.65}
          />
        </>
      ) : null}
    </Scroller>
  );
}

/** Traffic on the road behind the blocks, on its own clock. */
export function TrafficPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const night = ph === "night";
  const body = dark(M.steel, ph, 0.5);
  return (
    <Scroller
      period={260}
      seconds={SPEED_S.mid / 3.4}
      width={width}
      dir={(dir * -1) as Dir}
      pace={pace}
    >
      <path d={pxPath(CARS)} fill={body.mid} />
      {night ? (
        <>
          <path
            d={pxPath(
              CARS.filter((_, i) => i % 2 === 0).map(([x, yy]) => [x - 1, yy, 2, 1] as Rect),
            )}
            fill={LAMP.head}
            opacity={0.85}
          />
          <path
            d={pxPath(
              CARS.filter((_, i) => i % 2 === 0).map(([x, yy, w]) => [x + w - 1, yy, 1, 1] as Rect),
            )}
            fill={LAMP.tail}
            opacity={0.8}
          />
        </>
      ) : null}
    </Scroller>
  );
}

/* ============================================================== *
 * NEAR — the lineside proper: sheds, walls, sidings, trees
 * ============================================================== */

const NEAR_WALL: Rect[] = [
  [0, HORIZON + 3, 250, 8],
  [290, HORIZON + 2, 170, 9],
  [540, HORIZON + 4, 210, 7],
];
/** The sound barrier, which is the most modern thing out there and the ugliest. */
const BARRIER: Rect[] = [[760, sky(9), 140, 13], ...repeat(8, 18, [764, sky(9), 2, 13] as Rect)];
/** And the tag somebody put on it, which is the only colour in the near plane. */
const GRAFFITI: Rect[] = [
  [790, sky(6), 3, 7],
  [793, sky(7), 9, 2],
  [800, sky(6), 3, 6],
  [808, sky(5), 12, 2],
  [812, sky(8), 3, 7],
];
const NEAR_SHEDS: Rect[] = [
  [50, sky(5), 62, 9],
  [50, sky(7), 62, 2],
  [320, sky(3), 48, 8],
  [560, sky(6), 72, 10],
];
const NEAR_TREES: Rect[] = [170, 236, 440, 494, 700].flatMap((x) => [
  [x, sky(8), 3, 12] as Rect,
  [x - 4, sky(13), 11, 6] as Rect,
  [x - 2, sky(17), 7, 5] as Rect,
]);
/** A siding with a wagon standing on it, because there always is one. */
const WAGON: Rect[] = [
  [650, HORIZON + 1, 84, 9],
  [650, HORIZON - 1, 84, 2],
  ...repeat(4, 21, [656, HORIZON + 10, 10, 3] as Rect),
];
/**
 * A level crossing, going past with its lights on. The barrier is down because
 * we are on the railway and the road is not, which is the only relationship
 * those two things ever have.
 */
const CROSSING: Rect[] = [
  [860, sky(12), 2, 16],
  [858, sky(14), 6, 3],
  [864, sky(13), 22, 2],
];
const CROSSING_LIGHTS_A = pxPath([[858, sky(13), 3, 3]]);
const CROSSING_LIGHTS_B = pxPath([[864, sky(13), 3, 3]]);
/** A bus shelter on the road behind, with somebody in it. */
const SHELTER: Rect[] = [
  [400, sky(7), 34, 2],
  [400, sky(7), 2, 8],
  [432, sky(7), 2, 8],
  [412, sky(4), 4, 5],
];

export function NearPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const night = ph === "night";
  const conc = depth(M.concrete, ph, 40);
  const steel = dark(M.steel, ph, 0.66);
  const leaf = dark(M.leaf, ph, 0.68);
  return (
    <Scroller period={PERIOD.near} seconds={SPEED_S.near} width={width} dir={dir} pace={pace}>
      <path d={pxPath(NEAR_SHEDS)} fill={steel.base} />
      <path d={pxPath(SHELTER)} fill={steel.lo} />
      <path d={pxPath(NEAR_TREES)} fill={leaf.mid} />
      <path d={pxPath(BARRIER)} fill={conc.lo} />
      <path d={pxPath(GRAFFITI)} fill={night ? "#5a2f4a" : "#a8365e"} opacity={0.8} />
      <path d={pxPath(NEAR_WALL)} fill={conc.base} />
      <path d={pxPath(NEAR_WALL)} fill={dth("n", "12")} opacity={0.4} />
      <path d={pxPath(WAGON)} fill={dark(M.red, ph, 0.5).lo} />
      <path d={pxPath(CROSSING)} fill={conc.deep} />
      {/* the two lamps alternate, which is what a crossing actually does */}
      <Blink d={CROSSING_LIGHTS_A} fill={LAMP.red} dur="1.1s" values="1;0;1" keyTimes="0;0.5;1" />
      <Blink d={CROSSING_LIGHTS_B} fill={LAMP.red} dur="1.1s" values="0;1;0" keyTimes="0;0.5;1" />
    </Scroller>
  );
}

/* ============================================================== *
 * LINESIDE — six metres out, and going past far too fast to see
 * ============================================================== */

/**
 * Fence posts, catenary masts, relay cabinets, a signal, a kilometre post and
 * the cable troughing. Nothing here is meant to be *looked* at — at this speed
 * it is a flicker, and the flicker is what tells the body that the train is
 * moving. It is the most important plane of the six and the only one where the
 * detail genuinely does not matter; what matters is that it exists across the
 * whole width, which before it did not.
 */
const FENCE: Rect[] = [
  ...repeat(14, 30, [0, HORIZON + 5, 2, 14] as Rect),
  [0, HORIZON + 7, PERIOD.lineside, 1],
  [0, HORIZON + 12, PERIOD.lineside, 1],
];
/** The cable trough, running the whole way, one concrete lid after another. */
const TROUGH: Rect[] = [
  [0, VIEW.bottom - 6, PERIOD.lineside, 4],
  ...repeat(Math.ceil(PERIOD.lineside / 14), 14, [0, VIEW.bottom - 6, 1, 4] as Rect),
];
const MASTS: Rect[] = [
  [96, VIEW.top - 4, 5, HORIZON + 22 - VIEW.top],
  [300, VIEW.top - 4, 5, HORIZON + 22 - VIEW.top],
];
/** The bracket that carries the wire out over the track, off each mast. */
const BRACKETS: Rect[] = [
  [101, VIEW.top + 2, 22, 2],
  [305, VIEW.top + 2, 22, 2],
];
const RELAY_BOX: Rect[] = [
  [212, HORIZON + 6, 16, 13],
  [210, HORIZON + 4, 20, 2],
];
const KM_POST: Rect[] = [
  [352, HORIZON + 8, 2, 11],
  [349, HORIZON + 5, 8, 4],
];
const SIGNAL: Rect[] = [
  [388, sky(2), 2, 20],
  [385, sky(8), 8, 7],
];
const SIGNAL_LAMP = pxPath([[387, sky(6), 4, 3]]);

export function LinesidePlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const steel = depth(M.steel, ph, 6);
  const conc = depth(M.concrete, ph, 6);
  return (
    <Scroller
      period={PERIOD.lineside}
      seconds={SPEED_S.lineside}
      width={width}
      dir={dir}
      pace={pace}
    >
      <path d={pxPath(FENCE)} fill={steel.lo} opacity={0.85} />
      <path d={pxPath(MASTS)} fill={steel.mid} />
      <path d={pxPath(BRACKETS)} fill={steel.lo} />
      <path d={pxPath(RELAY_BOX)} fill={conc.mid} />
      <path d={pxPath(KM_POST)} fill={conc.hi} opacity={0.8} />
      <path d={pxPath(SIGNAL)} fill={steel.deep} />
      <path d={SIGNAL_LAMP} fill={LAMP.green} opacity={0.85} />
      <path d={pxPath(TROUGH)} fill={conc.lo} />
    </Scroller>
  );
}

/* ============================================================== *
 * TRACK — two metres out, and a strobe
 * ============================================================== */

/**
 * The adjacent road and its sleepers, along the bottom four pixels of the pane.
 *
 * At 3.4 seconds a period this is not an image, it is a frequency, and it is the
 * single cheapest way to make a still picture feel like ninety kilometres an
 * hour. It is also the reason the ballast shoulder above it is drawn as a flat
 * dark band and nothing else: anything with detail in it at this distance would
 * strobe into mush, so it is deliberately empty.
 */
const SLEEPERS: Rect[] = repeat(8, 12, [0, VIEW.bottom - 4, 7, 3] as Rect);
const RAILS: Rect[] = [
  [0, VIEW.bottom - 5, PERIOD.track, 1],
  [0, VIEW.bottom - 1, PERIOD.track, 1],
];

export function TrackPlane({
  ph,
  width,
  dir = 1,
  pace = 1,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
}) {
  const steel = depth(M.steel, ph, 2);
  return (
    <Scroller period={PERIOD.track} seconds={SPEED_S.track} width={width} dir={dir} pace={pace}>
      <path d={pxPath(SLEEPERS)} fill={steel.deep} opacity={0.75} />
      <path d={pxPath(RAILS)} fill={steel.hi} opacity={ph === "night" ? 0.35 : 0.55} />
    </Scroller>
  );
}

/* ============================================================== *
 * the ground the whole thing stands on
 * ============================================================== */

/**
 * Without it every plane's silhouettes overlapped into one mass with no horizon
 * in it — the single thing that stopped the window reading as a view. A dark
 * band from the horizon to the bottom of the pane separates sky from earth,
 * gives the far planes something to sit on, and lets the near planes be
 * genuinely dark without disappearing.
 */
export function ViewGround({ ph, width }: { ph: Ph; width: number }) {
  return (
    <g>
      <rect x={-40} y={HORIZON} width={width + 80} height={GROUND_H + 2} fill={GROUND_BAND[ph]} />
      {/* the haze that collects along the horizon line itself */}
      <path
        d={pxPath([[-40, HORIZON, width + 80, 2]])}
        fill={HAZE[ph]}
        opacity={ph === "night" ? 0.18 : 0.42}
      />
      {/* the field between the horizon and the railway, one shade lighter */}
      <rect
        x={-40}
        y={HORIZON + 2}
        width={width + 80}
        height={6}
        fill={GROUND_BAND[ph]}
        opacity={0.5}
      />
      {/* the ballast shoulder nearest the train, darker again and empty */}
      <rect x={-40} y={VIEW.bottom - 9} width={width + 80} height={11} fill="#000" opacity={0.32} />
    </g>
  );
}

/* ============================================================== *
 * events: the things that interrupt the loop
 * ============================================================== */

/**
 * The bridges and cutting walls passing over the windows.
 *
 * Not drawn — *timed*. What happens when a train goes under a bridge is that the
 * carriage goes dark for half a second and comes back, and the way to get that
 * is one rectangle over the glass whose opacity is keyed to the moment the
 * bridge in the mid plane arrives. Drawing the underside would be more work and
 * less convincing.
 *
 * The cycle is exported because the saloon has to dim on the same frame: its
 * daylight wash and its LED fill read SHADE_CYCLE rather than carrying their own
 * copy of these numbers, and two animations that nearly agree read as a fault
 * rather than as a bridge.
 */
const SHADE_AT = (s: number) => (s / SPEED_S.mid).toFixed(4);
export const SHADE_CYCLE = {
  dur: `${SPEED_S.mid}s`,
  keyTimes: [
    0,
    SHADE_AT(17),
    SHADE_AT(17.5),
    SHADE_AT(18.6),
    SHADE_AT(19.1),
    SHADE_AT(46),
    SHADE_AT(46.4),
    SHADE_AT(47.2),
    SHADE_AT(47.6),
    SHADE_AT(61),
    SHADE_AT(61.5),
    SHADE_AT(63.4),
    SHADE_AT(63.9),
    1,
  ].join(";"),
  /** How much light is left: 1 outside, near zero under the canal bridge. */
  daylight: "1;1;0.28;0.28;1;1;0.45;0.45;1;1;0.18;0.18;1;1",
  /** And the inverse, for anything that has to come *up* when the light goes. */
  shade: "0;0;0.72;0.72;0;0;0.55;0.55;0;0;0.82;0.82;0;0",
} as const;

export function TunnelShade({ width, pace = 1 }: { width: number; pace?: number }) {
  return (
    <rect x={-40} y={VIEW.top - 2} width={width + 80} height={H + 4} fill="#05060a">
      <animate
        attributeName="opacity"
        keyTimes={SHADE_CYCLE.keyTimes}
        values={SHADE_CYCLE.shade}
        dur={`${(SPEED_S.mid * pace).toFixed(2)}s`}
        repeatCount="indefinite"
        calcMode="linear"
      />
    </rect>
  );
}

/**
 * A train the other way.
 *
 * Forty metres of unit at four metres' distance fills the entire window, so this
 * is not a silhouette on the horizon — it is the whole pane going dark except
 * for a strip of lit windows, for about a second and a half, once every fifty
 * seconds or so. It is the loudest event available and it costs one group.
 *
 * The long `dur` with a narrow keyTimes window is deliberate: SMIL has no
 * "every N seconds, briefly" so the sweep is a short segment of a long cycle
 * with the unit parked off-frame either side of it.
 */
const PASSING_LEN = 1600;
const PASSING_BODY: Rect[] = [[0, VIEW.top - 4, PASSING_LEN, H + 8]];
const PASSING_WINDOWS: Rect[] = repeat(26, 60, [30, VIEW.top + 6, 44, 16] as Rect);
const PASSING_DOORS: Rect[] = repeat(6, 260, [200, VIEW.top + 4, 26, H - 6] as Rect);
const PASSING_BAND: Rect[] = [
  [0, VIEW.bottom - 12, PASSING_LEN, 4],
  [0, VIEW.top - 2, PASSING_LEN, 3],
];

export function PassingTrain({
  ph,
  width,
  everyS = 53,
  dir = 1,
}: {
  ph: Ph;
  width: number;
  /** seconds between one unit and the next */
  everyS?: number;
  dir?: Dir;
}) {
  const night = ph === "night";
  const start = dir === 1 ? width + 120 : -PASSING_LEN - 120;
  const end = dir === 1 ? -PASSING_LEN - 120 : width + 120;
  /* the sweep occupies 1.6 s of the cycle; the rest is parked off-frame */
  const t0 = 0.62;
  const t1 = t0 + 1.6 / everyS;
  return (
    <g>
      <path d={pxPath(PASSING_BODY)} fill={night ? "#101319" : "#20242c"} />
      <path d={pxPath(PASSING_BAND)} fill={night ? "#243044" : "#39506e"} />
      <path
        d={pxPath(PASSING_WINDOWS)}
        fill={night ? "#f4f0d8" : "#8fa4b2"}
        opacity={night ? 0.9 : 0.75}
      />
      <path d={pxPath(PASSING_DOORS)} fill={night ? "#1a1f28" : "#2b3038"} />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`${start} 0;${start} 0;${end} 0;${end} 0`}
        keyTimes={`0;${t0.toFixed(4)};${t1.toFixed(4)};1`}
        dur={`${everyS}s`}
        repeatCount="indefinite"
        calcMode="linear"
      />
    </g>
  );
}

/**
 * Rain, on the glass rather than in the air.
 *
 * Rain seen through a train window is not falling, it is *streaking sideways*,
 * because the train is doing twenty-five metres a second and the rain is doing
 * five. So the streaks are near-horizontal, they live on the pane rather than in
 * the landscape, and they do not scroll with any plane — they belong to the
 * glass, which is not going anywhere.
 */
const RAIN_STREAKS: Rect[] = Array.from({ length: 46 }, (_, i) => {
  const x = Math.round(hash(i * 1.7) * 1500);
  const yy = VIEW.top + Math.round(hash(i * 5.3) * (H - 2));
  const len = 6 + Math.round(hash(i * 9.1) * 14);
  return [x, yy, len, 1] as Rect;
});
const RAIN_DROPS: Rect[] = Array.from({ length: 26 }, (_, i) => {
  const x = Math.round(hash(i * 3.7 + 11) * 1400);
  const yy = VIEW.top + Math.round(hash(i * 6.1 + 3) * (H - 3));
  return [x, yy, 2, 2] as Rect;
});

export function RainOnGlass({ ph }: { ph: Ph }) {
  const tint = ph === "night" ? "#8fa8c8" : "#e8f0f8";
  return (
    <g>
      <path d={pxPath(RAIN_STREAKS)} fill={tint} opacity={0.22}>
        <animate
          attributeName="opacity"
          values="0.22;0.1;0.26;0.14;0.22"
          dur="1.7s"
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>
      <path d={pxPath(RAIN_DROPS)} fill={tint} opacity={0.3}>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;-6 2;-14 5;-24 9"
          dur="2.3s"
          repeatCount="indefinite"
          calcMode="linear"
        />
      </path>
    </g>
  );
}

/* ============================================================== *
 * the whole view, composed
 * ============================================================== */

/**
 * Everything in the right order, so a scene can ask for the view rather than
 * assemble it. The saloon still clips this to its window openings — one clip
 * path over the lot, so the view through all four windows is continuous, which
 * is worth more than any amount of detail: a scene where each window scrolls its
 * own copy reads instantly as four televisions in a wall.
 */
export function TrainWindowView({
  ph,
  width,
  dir = 1,
  pace = 1,
  weather = "clear",
  passing = true,
}: {
  ph: Ph;
  width: number;
  dir?: Dir;
  pace?: number;
  weather?: Weather;
  passing?: boolean;
}) {
  return (
    <g>
      <ViewSky ph={ph} width={width} />
      <CloudPlane ph={ph} width={width} dir={dir} pace={pace} />
      <FarPlane ph={ph} width={width} dir={dir} pace={pace} />
      <ViewGround ph={ph} width={width} />
      <MidPlane ph={ph} width={width} dir={dir} pace={pace} />
      <TrafficPlane ph={ph} width={width} dir={dir} pace={pace} />
      <NearPlane ph={ph} width={width} dir={dir} pace={pace} />
      <LinesidePlane ph={ph} width={width} dir={dir} pace={pace} />
      <TrackPlane ph={ph} width={width} dir={dir} pace={pace} />
      {passing ? <PassingTrain ph={ph} width={width} dir={dir} /> : null}
      <TunnelShade width={width} pace={pace} />
      {weather === "rain" ? <RainOnGlass ph={ph} /> : null}
    </g>
  );
}

/** The metric facts other scenes are entitled to know about this window. */
export const VIEW_M = {
  head: 2.05,
  sill: 1.0,
  eye: EYE_M,
  pxPerMetre: PPM,
  horizon: HORIZON,
  skyPx: SKY_H,
  groundPx: GROUND_H,
} as const;

export { shift as shiftLandscape };
