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

/**
 * One period of each plane, in scene px, and how long that period takes.
 *
 * These two tables together are the parallax, and they were wrong — not
 * slightly, but inverted. The old set wrote seconds-per-period as if that were
 * a speed and *also* varied the period, which cancels it: the resulting
 * px/s came out track 28, lineside 47, near 35, mid 32, far 14. The nearest
 * plane in the picture — the track, two metres away, the thing that is
 * supposed to be a strobe — crossed the window more slowly than the city
 * two hundred and fifty metres out. A thousandfold spread of distance was
 * rendered as a 3.4× spread of speed, in the wrong order.
 *
 * So speed is stated first, in px/s, and derived from 1/distance the way
 * parallax actually works. It is compressed — true ratio would put the track
 * at 700 px/s and the clouds at 0.14 — but it is monotonic, and the spread is
 * now ~190× instead of 3.4×.
 *
 *     plane      distance    px/s     what it reads as
 *     track           2 m     300     a blur you cannot count
 *     lineside        6 m     120     posts flicking, ~4/s
 *     near           40 m      46     sheds and trees streaming
 *     mid           250 m      16     the district drifting
 *     far          2000 m     4.5     the skyline barely turning
 *     cloud         far        1.6    going our way
 *
 * Periods are then chosen so no plane the eye can *read* shows two copies of
 * itself at once in a 1400 px window: lineside and near used to be 420 and
 * 900, which put three identical signals and three identical relay boxes on
 * screen simultaneously, in the fastest and most-watched plane of the six.
 */
const PX_S = {
  track: 300,
  lineside: 120,
  near: 46,
  mid: 16,
  far: 4.5,
  cloud: 1.6,
} as const;
export const PERIOD = {
  track: 96,
  lineside: 1680,
  near: 1800,
  mid: 2400,
  far: 3600,
  cloud: 2000,
} as const;
/** Seconds per period — derived, so the speed table above is the single truth. */
export const SPEED_S = {
  track: PERIOD.track / PX_S.track,
  lineside: PERIOD.lineside / PX_S.lineside,
  near: PERIOD.near / PX_S.near,
  mid: PERIOD.mid / PX_S.mid,
  far: PERIOD.far / PX_S.far,
  cloud: PERIOD.cloud / PX_S.cloud,
} as const;

/**
 * How much of the artificial light is on.
 *
 * Every lamp, lit window, crane strobe and headlight in this file used to be
 * gated on `ph === "night"` alone, which meant that at dusk — when the sky
 * ramp has already gone to `#3a2e52 → #e0925e` and the ground is nearly black
 * — the entire city was unlit. Dusk is the hour this scene is *about*: the
 * lights come on before the sky has finished going out, and that overlap is
 * most of the melancholy the brief is asking for.
 */
export const LAMPS_ON: Record<Ph, number> = { dawn: 0.35, day: 0, dusk: 0.72, night: 1 };

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
  /**
   * The sky is SKY_H tall, not H.
   *
   * This read `H / stops.length` — the whole window divided by five — which
   * put bands three, four and five at y 88, 96 and 104: at and below the
   * horizon, where `ViewGround` paints straight over them. Three of the five
   * colours in every ramp had never once been seen, and the gradient the
   * palette is built around was rendering as two flat strips.
   */
  const band = SKY_H / stops.length;
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
          stops.slice(1).map((_, i) => [-40, VIEW.top + (i + 1) * band - 1, width + 80, 2] as Rect),
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
/**
 * The rest of the skyline.
 *
 * A third of the far period used to be bare horizon — including a 558 px hole
 * between the shipyard and the city and a 302 px hole at the wrap. At this
 * plane's speed that hole is two minutes of empty sky, and it is the thing
 * the eye rests on when the near planes are moving too fast to read. Every
 * gap is now occupied, and by things that belong on this particular horizon:
 * the falowiec, Olivia Star, the stadium, the grain silos and the moraine
 * hills that close off the west side of the whole Tricity.
 */
const FAR_FILLER: Rect[] = [
  /* 0–250: the wooded moraine ridge, stepped, closing the wrap */
  ...Array.from({ length: 11 }, (_, i) => {
    const x = i * 23;
    const h = 3 + Math.round(hash(i * 4.7) * 3);
    return [x, sky(h), 24, h + 2] as Rect;
  }),
  /* 620–1178: the falowiec — eight hundred metres of it, stepped twice, the
     one building that says Przymorze and nowhere else */
  [640, sky(7), 210, 8],
  [850, sky(8), 180, 9],
  [1030, sky(6), 140, 7],
  /* the grain silos at the port, a fat cluster of verticals */
  ...repeat(6, 11, [700, sky(11), 8, 5] as Rect),
  /* Olivia Star, the only tall thing in Gdańsk */
  [1100, sky(16), 9, 17],
  [1098, sky(17), 13, 2],
  /* 1880–2000: the stadium, a low amber ellipse of a thing */
  [1880, sky(6), 96, 5],
  [1892, sky(8), 72, 3],
  ...repeat(14, 40, [2000, sky(4), 22, 5] as Rect),
  /* 2438–2470 */
  [2430, sky(7), 44, 8],
  ...repeat(10, 38, [2470, sky(5), 26, 6] as Rect),
  /* 2838–2880: a church and its car park */
  [2838, sky(9), 6, 10],
  [2836, sky(11), 10, 2],
  [2848, sky(5), 34, 6],
  ...repeat(16, 28, [2880, sky(3), 18, 4] as Rect),
  /* 3298–3600: the ridge again, coming round to meet x=0 */
  ...Array.from({ length: 13 }, (_, i) => {
    const x = 3300 + i * 23;
    const h = 3 + Math.round(hash(i * 6.3) * 3);
    return [x, sky(h), 24, h + 2] as Rect;
  }),
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
  const lampsOn = LAMPS_ON[ph];
  const mat = depth(M.concrete, ph, 2000);
  const steel = far(M.steel, ph, 0.72);
  return (
    <Scroller period={PERIOD.far} seconds={SPEED_S.far} width={width} dir={dir} pace={pace}>
      <path d={pxPath(YARD_SHEDS)} fill={mat.mid} />
      <path d={pxPath(CRANES)} fill={night ? "#3a3244" : steel.lo} />
      <path d={pxPath(CITY)} fill={mat.base} />
      <path d={pxPath(FAR_FILLER)} fill={mat.mid} opacity={0.9} />
      {lampsOn > 0 ? (
        <>
          <path d={FAR_LIGHTS} fill={LAMP.window} opacity={0.55 * lampsOn} />
          <Blink d={CRANE_LIGHTS} fill={LAMP.warn} dur="2.6s" opacity={0.9 * lampsOn} />
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
/**
 * The road runs the whole way now.
 *
 * It was 380 px of a 2400 px period — sixteen percent — while `TrafficPlane`
 * ran its own continuous loop across the entire window forever. For the other
 * eighty-four percent six car-shaped rectangles slid along bare grass. A road
 * beside the line is the normal condition of this railway (Słowackiego and
 * Kartuska both do it for kilometres), so the road is continuous and the
 * traffic finally has something to be on.
 */
const ROAD: Rect[] = [
  [0, HORIZON + 3, PERIOD.mid, 3],
  /* the centre line, dashed, and a kerb on the far side */
  ...repeat(Math.ceil(PERIOD.mid / 34), 34, [0, HORIZON + 4, 12, 1] as Rect),
  [0, HORIZON + 2, PERIOD.mid, 1],
];
const LAMP_COLUMNS: Rect[] = repeat(7, 56, [276, sky(9), 1, 12] as Rect).flatMap(
  ([x, yy, w, h]) => [[x, yy, w, h] as Rect, [x, yy, 4, 1] as Rect],
);
const LAMP_HEADS = pxPath(repeat(7, 56, [277, sky(9), 3, 1] as Rect));
/** Traffic on it, on its own clock, going the other way because it always is. */
/**
 * Traffic: six identical rectangles became a road's worth of different
 * vehicles, seated on the tarmac rather than hovering two pixels over it.
 * `lead`/`tail` are the x offsets of the front and back of each body, so the
 * lamps can be put on the correct end when the train — and therefore the
 * apparent direction of the road — reverses.
 */
type Vehicle = { x: number; w: number; h: number; roof: number };
const TRAFFIC: Vehicle[] = [
  { x: 0, w: 9, h: 3, roof: 5 },
  { x: 44, w: 7, h: 3, roof: 4 },
  { x: 96, w: 13, h: 4, roof: 7 },
  { x: 150, w: 8, h: 3, roof: 5 },
  { x: 196, w: 22, h: 5, roof: 0 },
  { x: 254, w: 10, h: 3, roof: 6 },
  { x: 310, w: 17, h: 4, roof: 0 },
  { x: 366, w: 8, h: 3, roof: 5 },
];
const CAR_Y = HORIZON + 2;
const CARS: Rect[] = TRAFFIC.flatMap((v) =>
  v.roof
    ? [[v.x, CAR_Y, v.w, v.h] as Rect, [v.x + 1, CAR_Y - 1, v.roof, 1] as Rect]
    : [[v.x, CAR_Y - 1, v.w, v.h + 1] as Rect],
);
const TRAFFIC_PERIOD = 420;

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
/**
 * The chimney, and the smoke off it.
 *
 * There are only sixteen pixels of sky in this window — `sky(n)` above 16 is
 * outside the aperture and gets clipped — and this was drawn at sky(20) to
 * sky(29). The cap, and every pixel of the smoke that the comment calls "the
 * only soft edge in the picture", had never once appeared on screen. Brought
 * down into the frame: the stack now tops out two pixels under the head and
 * the plume leans away across the sky where it can be seen.
 */
const CHIMNEY: Rect[] = [
  [1204, sky(14), 4, 15],
  [1202, sky(14), 8, 2],
];
const SMOKE: Rect[] = [
  [1206, sky(15), 5, 2],
  [1211, sky(16), 8, 2],
  [1218, sky(16), 11, 2],
  [1228, sky(15), 13, 2],
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
/** Capped at sky(15) so the tophats stay inside the sixteen pixels of sky. */
const YARD_CRANES: Rect[] = [
  ...crane(1300, 14, 30),
  ...crane(1440, 13, 26),
  ...crane(1560, 15, 32),
];

/** Allotments: sheds the size of a wardrobe, poplars, and a floodlit pitch. */
const ALLOTMENTS: Rect[] = repeat(7, 34, [1670, sky(3), 13, 4] as Rect);
const POPLARS: Rect[] = [1690, 1748, 1812, 1874, 1930].flatMap((x) => [
  [x, sky(15), 3, 16] as Rect,
  [x - 2, sky(12), 7, 9] as Rect,
  [x - 1, sky(17), 5, 4] as Rect,
]);
/** Mast heads were at sky(20), four pixels above the window head. */
const FLOODLIGHTS: Rect[] = [1710, 1790, 1860].flatMap((x) => [
  [x, sky(12), 2, 13] as Rect,
  [x - 3, sky(14), 8, 3] as Rect,
]);
const FLOOD_GLOW = pxPath([1710, 1790, 1860].map((x) => [x - 4, sky(13), 10, 3] as Rect));

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
  const lampsOn = LAMPS_ON[ph];
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

      {lampsOn > 0 ? (
        <>
          <path d={LAMP_HEADS} fill={LAMP.sodium} opacity={0.8 * lampsOn} />
          <path d={FLOOD_GLOW} fill="#dfe8ff" opacity={0.5 * lampsOn} />
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
  /* headlights come on at dusk, not at midnight */
  const lit = ph === "night" || ph === "dusk";
  const body = dark(M.steel, ph, 0.5);
  /* the road runs against us, and keeps doing so when we reverse */
  const road = (dir * -1) as Dir;
  return (
    <Scroller
      period={TRAFFIC_PERIOD}
      seconds={TRAFFIC_PERIOD / (PX_S.mid * 2.6)}
      width={width}
      dir={road}
      pace={pace}
    >
      <path d={pxPath(CARS)} fill={body.mid} />
      {/* a couple of them are not grey, because no road is */}
      <path d={pxPath([CARS[4], CARS[10]])} fill={dark(M.red, ph, 0.45).base} opacity={0.85} />
      {lit ? (
        <>
          {/* headlights lead and tails trail — which end that is depends on
              which way the road is running, and the road reverses with us */}
          <path
            d={pxPath(
              TRAFFIC.map((v) => [road === 1 ? v.x + v.w - 1 : v.x - 1, CAR_Y, 2, 1] as Rect),
            )}
            fill={LAMP.head}
            opacity={0.85}
          />
          <path
            d={pxPath(TRAFFIC.map((v) => [road === 1 ? v.x : v.x + v.w - 1, CAR_Y, 1, 1] as Rect))}
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
const BARRIER: Rect[] = [[760, sky(5), 140, 9], ...repeat(8, 18, [764, sky(5), 2, 9] as Rect)];
/** And the tag somebody put on it, which is the only colour in the near plane. */
const GRAFFITI: Rect[] = [
  [790, sky(4), 3, 6],
  [793, sky(5), 9, 2],
  [800, sky(4), 3, 5],
  [808, sky(3), 12, 2],
  [812, sky(5), 3, 6],
];
const NEAR_SHEDS: Rect[] = [
  [50, sky(4), 62, 8],
  [50, sky(5), 62, 2],
  [320, sky(3), 48, 7],
  [560, sky(5), 72, 9],
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
/**
 * The second half of the near plane — nine hundred pixels that did not exist.
 *
 * The period was 900 against a 1400 px window, so the same shed, the same
 * wagon and the same level crossing were on screen two and a half times over.
 * Widening it to 1800 is only half the fix; the other half is that the new
 * half has to be *different things*, and these are the things that are
 * actually beside the line between Gdańsk and Gdynia: lock-up garages, the
 * back of a works, allotments, poplars and a scrapyard.
 */
/** Blaszaki — the metal lock-up garages, in a row, each a different tired colour. */
/** Two short terraces with a gap between them, not one 326 px slab. */
const GARAGE_X = [950, 996, 1042, 1130, 1176, 1222] as const;
const GARAGES: Rect[] = GARAGE_X.map((x) => [x, sky(3), 44, 12] as Rect);
const GARAGE_ROOF: Rect[] = [
  [948, sky(4), 140, 2],
  [1128, sky(4), 140, 2],
];
const GARAGE_DOORS: Rect[] = GARAGE_X.map((x) => [x + 6, sky(1), 32, 9] as Rect);
/** Which doors are which colour: rust, green, blue, rust, cream, green, rust. */
const GARAGE_TONE = [0, 1, 2, 3, 1, 0] as const;

/** The back of a works: brick, high windows, a stack of pallets against it. */
const WORKS_WALL: Rect[] = [
  [1300, sky(5), 240, 14],
  [1300, sky(6), 240, 2],
];
const WORKS_WINDOWS: Rect[] = Array.from({ length: 9 }, (_, i) => {
  const x = 1312 + i * 26;
  return [x, sky(4), 14, 5] as Rect;
});
const PALLETS: Rect[] = [
  ...repeat(5, 3, [1352, HORIZON + 4, 34, 2] as Rect, "y"),
  ...repeat(4, 3, [1420, HORIZON + 7, 26, 2] as Rect, "y"),
];

/** Allotments: sheds that are all different because everybody built their own. */
const ALLOT_SHEDS: Rect[] = [
  [1580, sky(4), 26, 9],
  [1578, sky(5), 30, 2],
  [1622, sky(4), 20, 9],
  [1620, sky(5), 24, 2],
  [1656, sky(5), 30, 10],
  [1654, sky(6), 34, 3],
  [1700, sky(2), 17, 7],
];
/** Bean canes and a greenhouse frame, which is what a działka looks like in July. */
const ALLOT_BITS: Rect[] = [
  ...repeat(6, 5, [1610, HORIZON - 6, 1, 7] as Rect),
  [1730, sky(4), 22, 9],
  ...repeat(4, 6, [1732, sky(4), 1, 9] as Rect),
];

/** Poplars, the tall thin ones that line every Polish railway. */
const NEAR_POPLARS: Rect[] = [1268, 1546, 1772].flatMap((x, i) => {
  const h = 8 + (i % 2) * 2;
  return [
    [x, HORIZON + 2 - h, 3, h] as Rect,
    [x - 3, HORIZON + 2 - h - 6, 9, 8] as Rect,
    [x - 2, HORIZON + 2 - h - 12, 7, 7] as Rect,
  ];
});

/** A scrapyard: stacked bodyshells and the grab that stacked them. */
const SCRAPYARD: Rect[] = [
  [1080, HORIZON - 3, 22, 7],
  [1084, HORIZON - 9, 18, 6],
  [1106, HORIZON - 2, 26, 6],
  [1110, HORIZON - 7, 20, 5],
  [1140, HORIZON - 4, 19, 8],
  /* the grab, folded down for the night */
  [1170, HORIZON - 5, 4, 9],
  [1170, HORIZON - 5, 26, 2],
  [1192, HORIZON - 3, 3, 5],
];

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
      {/* the works, furthest back of the near things */}
      <path d={pxPath(WORKS_WALL)} fill={dark(M.tile, ph, 0.6).base} />
      <path
        d={pxPath(WORKS_WINDOWS)}
        fill={night ? "#ffd98a" : dark(M.steel, ph, 0.72).deep}
        opacity={night ? 0.65 : 0.9}
      />
      <path d={pxPath(PALLETS)} fill={dark(M.oak, ph, 0.62).lo} />
      {/* the garages, and their seven tired doors */}
      <path d={pxPath(GARAGE_ROOF)} fill={steel.hi} opacity={0.7} />
      <path d={pxPath(GARAGES)} fill={steel.base} />
      {GARAGE_TONE.map((tone, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of garages
          key={`gd${i}`}
          d={pxPath([GARAGE_DOORS[i]])}
          fill={
            tone === 0
              ? dark(M.red, ph, 0.55).lo
              : tone === 1
                ? dark(M.leaf, ph, 0.6).deep
                : tone === 2
                  ? dark(M.steel, ph, 0.5).mid
                  : dark(M.render, ph, 0.55).hi
          }
          opacity={0.9}
        />
      ))}
      <path d={pxPath(SCRAPYARD)} fill={dark(M.red, ph, 0.68).deep} />
      <path d={pxPath(ALLOT_SHEDS)} fill={dark(M.oak, ph, 0.58).base} />
      <path d={pxPath(ALLOT_BITS)} fill={steel.lo} opacity={0.8} />
      <path d={pxPath(NEAR_POPLARS)} fill={leaf.deep} />
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
/**
 * A deterministic wobble, so that a row of things is a row of *things* rather
 * than a comb. `repeat()` stamps one box at one pitch, which is the right
 * primitive and the wrong result when it is the only one used: this file made
 * twenty-six such rows and every one of them was perfectly regular. One pixel
 * of scatter, seeded off the index, is the whole difference.
 */
const jit = (i: number, amp = 1) => Math.round((hash(i * 2.7) - 0.5) * 2 * amp);

/**
 * Sixteen hundred and eighty pixels of railway boundary, in four bays that do
 * not resemble each other.
 *
 * The period was 420, which at a 1400 px window meant five copies on screen —
 * so the same signal, the same kilometre post and the same relay cabinet
 * appeared three times at once, evenly spaced, in the plane the eye tracks
 * hardest. Nothing here is meant to be *studied*; it is a flicker, and the
 * flicker is what tells the body the train is moving. But a flicker with a
 * period of three seconds reads as a fault, and this one did.
 */
const LS = PERIOD.lineside;

/** Post-and-wire, the whole way, with a few posts that have given up. */
const FENCE: Rect[] = [
  ...Array.from({ length: Math.floor(LS / 30) }, (_, i) => {
    const x = i * 30 + jit(i, 1);
    /* one post in nine leans; two are missing entirely, which is what a
       railway fence looks like after thirty years beside a running line */
    const gone = i % 23 === 7 || i % 23 === 19;
    return gone ? null : ([x, HORIZON + 5 + (i % 9 === 4 ? 1 : 0), 2, 14] as Rect);
  }).filter((r): r is Rect => r !== null),
  [0, HORIZON + 7, LS, 1],
  [0, HORIZON + 12, LS, 1],
];

/** The cable trough, one concrete lid after another, all the way. */
const TROUGH: Rect[] = [
  [0, VIEW.bottom - 6, LS, 4],
  ...repeat(Math.ceil(LS / 14), 14, [0, VIEW.bottom - 6, 1, 4] as Rect),
];

/**
 * Catenary masts, eight to the period — about one every 1.7 seconds at this
 * plane's speed, which is the cadence of a real overhead line taken at speed
 * and the strongest single cue that this is electrified railway.
 */
const MAST_X = [96, 300, 512, 726, 940, 1150, 1362, 1566] as const;
const MASTS: Rect[] = MAST_X.map(
  (x, i) => [x + jit(i, 1), VIEW.top - 4, 5, HORIZON + 22 - VIEW.top] as Rect,
);
/** The bracket that carries the wire out over the track, off each mast. */
const BRACKETS: Rect[] = MAST_X.flatMap((x, i) => [
  [x + 5 + jit(i, 1), VIEW.top + 2, 22, 2] as Rect,
  /* the registration arm, angling back down to the wire */
  [x + 24 + jit(i, 1), VIEW.top + 4, 2, 3] as Rect,
]);

/** Two relay cabinets, different sizes, nowhere near each other. */
const RELAY_BOX: Rect[] = [
  [212, HORIZON + 6, 16, 13],
  [210, HORIZON + 4, 20, 2],
  [1044, HORIZON + 8, 11, 11],
  [1042, HORIZON + 6, 15, 2],
];

/** One kilometre post per kilometre, which is once per period. */
const KM_POST: Rect[] = [
  [352, HORIZON + 8, 2, 11],
  [349, HORIZON + 5, 8, 4],
];

/** A running signal, and a repeater a long way further on. */
const SIGNAL: Rect[] = [
  [388, sky(2), 2, 20],
  [385, sky(8), 8, 7],
  [1268, sky(0), 2, 17],
  [1265, sky(5), 8, 6],
];
const SIGNAL_LAMP = pxPath([[387, sky(6), 4, 3]]);
const SIGNAL_LAMP_2 = pxPath([[1267, sky(3), 4, 3]]);

/**
 * The things beside the track that are not equipment: a permanent-way hut, a
 * stack of spare sleepers, a gradient post, a whistle board, a speed board,
 * and the barrow somebody left out. Each appears once in the period.
 */
const PW_HUT: Rect[] = [
  [604, HORIZON - 6, 34, 25],
  [602, HORIZON - 8, 38, 3],
  [612, HORIZON + 6, 8, 13],
];
const SLEEPER_STACK: Rect[] = [
  ...repeat(4, 3, [820, HORIZON + 8, 40, 2] as Rect, "y"),
  [818, HORIZON + 7, 44, 1],
];
const GRADIENT_POST: Rect[] = [
  [980, HORIZON + 2, 2, 17],
  [972, HORIZON + 1, 9, 2],
  [981, HORIZON + 3, 9, 2],
];
const WHISTLE_BOARD: Rect[] = [
  [1420, HORIZON + 3, 2, 16],
  [1414, HORIZON - 2, 13, 8],
];
const SPEED_BOARD: Rect[] = [
  [1560, HORIZON + 4, 2, 15],
  [1554, HORIZON, 13, 7],
];
const BARROW: Rect[] = [
  [700, HORIZON + 13, 13, 4],
  [702, HORIZON + 17, 3, 3],
  [710, HORIZON + 17, 3, 3],
];

/**
 * The cess, and what grows in it.
 *
 * Thirteen of the window's forty rows — a third of the picture — used to be
 * two fence rails and nothing else: no ballast, no grass, no scrub, no path,
 * no rubbish. This is the strip a passenger's eye actually rests on when the
 * far distance is too slow and the track is too fast, and it was the emptiest
 * thing in the frame.
 */
const CESS_PATH: Rect[] = [
  [0, HORIZON + 19, LS, 3],
  ...Array.from({ length: Math.floor(LS / 23) }, (_, i) => {
    const x = i * 23 + jit(i, 3);
    return [x, HORIZON + 18 + (i % 3), 9, 1] as Rect;
  }),
];
const GRASS: Rect[] = Array.from({ length: Math.floor(LS / 11) }, (_, i) => {
  const x = i * 11 + jit(i * 1.3, 4);
  const h = 3 + Math.round(hash(i * 5.1) * 4);
  return [x, HORIZON + 20 - h, 1 + (i % 3 === 0 ? 1 : 0), h] as Rect;
});
/** Buddleia and bramble, in the clumps they actually grow in. */
const SCRUB: Rect[] = [126, 470, 742, 1096, 1332, 1622].flatMap((x0, k) =>
  Array.from({ length: 5 + (k % 3) }, (_, i) => {
    const x = x0 + i * 6 + jit(i + k * 7, 2);
    const h = 5 + Math.round(hash((i + k * 11) * 3.3) * 7);
    return [x, HORIZON + 19 - h, 4, h] as Rect;
  }),
);
/** What blows off a train and stays: a bottle, a bag, a length of pipe. */
const LINESIDE_JUNK: Rect[] = [
  [268, HORIZON + 16, 3, 3],
  [536, HORIZON + 17, 5, 2],
  [905, HORIZON + 16, 2, 3],
  [1188, HORIZON + 17, 7, 2],
  [1478, HORIZON + 16, 4, 3],
];

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
  const leaf = depth(M.leaf, ph, 6);
  return (
    <Scroller
      period={PERIOD.lineside}
      seconds={SPEED_S.lineside}
      width={width}
      dir={dir}
      pace={pace}
    >
      {/* what grows in the cess, behind everything built */}
      <path d={pxPath(SCRUB)} fill={leaf.deep} opacity={0.9} />
      <path d={pxPath(GRASS)} fill={leaf.mid} opacity={0.85} />
      <path d={pxPath(FENCE)} fill={steel.lo} opacity={0.85} />
      <path d={pxPath(MASTS)} fill={steel.mid} />
      <path d={pxPath(BRACKETS)} fill={steel.lo} />
      <path d={pxPath(PW_HUT)} fill={conc.mid} />
      <path d={pxPath(SLEEPER_STACK)} fill={depth(M.oak, ph, 6).lo} />
      <path d={pxPath(RELAY_BOX)} fill={conc.mid} />
      <path d={pxPath(KM_POST)} fill={conc.hi} opacity={0.8} />
      <path d={pxPath(GRADIENT_POST)} fill={conc.hi} opacity={0.75} />
      <path d={pxPath(WHISTLE_BOARD)} fill={conc.hi} opacity={0.8} />
      <path d={pxPath(SPEED_BOARD)} fill={conc.hi} opacity={0.8} />
      <path d={pxPath(BARROW)} fill={steel.deep} opacity={0.8} />
      <path d={pxPath(SIGNAL)} fill={steel.deep} />
      <path d={SIGNAL_LAMP} fill={LAMP.green} opacity={0.85} />
      <path d={SIGNAL_LAMP_2} fill={LAMP.warn} opacity={0.75} />
      <path d={pxPath(CESS_PATH)} fill={conc.lo} opacity={0.7} />
      <path d={pxPath(LINESIDE_JUNK)} fill={conc.hi} opacity={0.5} />
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
/**
 * The things that pass over the window, and the dark they throw.
 *
 * This used to be three dips a cycle timed against nothing. The comment
 * above claimed the saloon dimmed "on the same frame the bridge arrives", and
 * the correspondence did not exist: there was exactly one bridge, it was
 * drawn in the *mid* plane two hundred and fifty metres away, and at that
 * plane's speed its hundred and ninety pixels took the better part of a
 * minute to cross a window that was being dimmed for one and a tenth seconds,
 * three times, at unrelated moments.
 *
 * The error was putting the bridge in the wrong plane. A bridge you pass
 * *under* is not scenery in the distance — it is directly overhead, so it is
 * the fastest thing in the picture, and what you see of it is a soffit
 * sweeping across the top of the glass in about a second while the light
 * goes. So there is an overhead plane now, and the dimming is derived from
 * the same table that draws it. One structure, one shadow, same instant.
 */
const OVERHEAD_PERIOD = 1680;
const OVERHEAD_S = OVERHEAD_PERIOD / PX_S.lineside;

/**
 * Authored in time rather than in x, so the shade and the soffit cannot drift
 * apart: `at` is the fraction of the cycle at which the structure is directly
 * overhead, and the art is placed at whatever x that works out to.
 */
const OVERHEAD: readonly { at: number; w: number; depth: number; deck: number }[] = [
  /* the canal bridge: wide, deep, and the one that really takes the light */
  { at: 0.18, w: 132, depth: 0.82, deck: 9 },
  /* a footbridge between two halves of an estate */
  { at: 0.52, w: 58, depth: 0.46, deck: 5 },
  /* a road overbridge, and the shadow of its parapet */
  { at: 0.79, w: 96, depth: 0.64, deck: 7 },
];

/** Half the time each structure spends over the glass, as a cycle fraction. */
const halfSpan = (w: number) => w / 2 / OVERHEAD_PERIOD;
/** How fast the light goes as the edge crosses — one frame's worth. */
const EDGE = 0.004;

const shadeFrames = (): { keyTimes: string; daylight: string; shade: string } => {
  const times: number[] = [0];
  const day: number[] = [1];
  for (const o of OVERHEAD) {
    const h = halfSpan(o.w);
    times.push(o.at - h - EDGE, o.at - h, o.at + h, o.at + h + EDGE);
    day.push(1, 1 - o.depth, 1 - o.depth, 1);
  }
  times.push(1);
  day.push(1);
  return {
    keyTimes: times.map((t) => Math.min(1, Math.max(0, t)).toFixed(4)).join(";"),
    daylight: day.map((v) => v.toFixed(2)).join(";"),
    shade: day.map((v) => (1 - v).toFixed(2)).join(";"),
  };
};
const FRAMES = shadeFrames();

export const SHADE_CYCLE = {
  dur: `${OVERHEAD_S}s`,
  keyTimes: FRAMES.keyTimes,
  /** How much light is left: 1 outside, near zero under the canal bridge. */
  daylight: FRAMES.daylight,
  /** And the inverse, for anything that has to come *up* when the light goes. */
  shade: FRAMES.shade,
} as const;

/**
 * The soffits themselves, sweeping the top of the glass.
 *
 * Drawn as the underside only — a dark band with a lit lower edge where the
 * daylight catches the beam ends. You never see more of a bridge than this
 * from underneath it at speed.
 */
export function OverheadPlane({
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
  const conc = dark(M.concrete, ph, 0.78);
  const centre = Math.round(width / 2);
  return (
    <Scroller period={OVERHEAD_PERIOD} seconds={OVERHEAD_S} width={width} dir={dir} pace={pace}>
      {OVERHEAD.map((o) => {
        /* the x at which this structure is over the middle of the window at
           time `at` — the inverse of the Scroller's own transform */
        const x = Math.round((o.at * OVERHEAD_PERIOD + centre) % OVERHEAD_PERIOD) - o.w / 2;
        return (
          <g key={`oh${o.at}`}>
            <path d={pxPath([[x, VIEW.top - 4, o.w, o.deck + 4] as Rect])} fill={conc.deep} />
            <path d={pxPath([[x, VIEW.top + o.deck, o.w, 1] as Rect])} fill={conc.mid} />
            {/* the beam ends, catching what light gets under the deck */}
            <path
              d={pxPath(
                repeat(Math.max(2, Math.floor(o.w / 14)), 14, [
                  x + 3,
                  VIEW.top - 4,
                  3,
                  o.deck + 3,
                ] as Rect),
              )}
              fill={conc.lo}
              opacity={0.5}
            />
          </g>
        );
      })}
    </Scroller>
  );
}

export function TunnelShade({ width, pace = 1 }: { width: number; pace?: number }) {
  return (
    <rect x={-40} y={VIEW.top - 2} width={width + 80} height={H + 4} fill="#05060a">
      <animate
        attributeName="opacity"
        keyTimes={SHADE_CYCLE.keyTimes}
        values={SHADE_CYCLE.shade}
        /* the overhead plane's clock, not the mid plane's — this read
           SPEED_S.mid while the cycle it animates is derived from
           OVERHEAD_S, so the glass darkened on a different schedule from
           both the soffit above it and the saloon behind it */
        dur={`${(OVERHEAD_S * pace).toFixed(2)}s`}
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

/**
 * Rain on the glass, running the way the airflow takes it.
 *
 * The drift was hardcoded leftward, so on the southbound run the water
 * crawled up the window against a hundred kilometres an hour of slipstream.
 * A drop on a train window goes *backwards* relative to travel, always, and
 * which way that is depends on `dir`.
 */
export function RainOnGlass({ ph, dir = 1 }: { ph: Ph; dir?: Dir }) {
  const tint = ph === "night" ? "#8fa8c8" : "#e8f0f8";
  const drift = (n: number) => n * dir;
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
          values={`0 0;${drift(-6)} 2;${drift(-14)} 5;${drift(-24)} 9`}
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
      <OverheadPlane ph={ph} width={width} dir={dir} pace={pace} />
      {passing ? <PassingTrain ph={ph} width={width} dir={dir} /> : null}
      <TunnelShade width={width} pace={pace} />
      {weather === "rain" ? <RainOnGlass ph={ph} dir={dir} /> : null}
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
