import {
  AOSet,
  aoPaths,
  Bev,
  bevelPaths,
  bulbPaths,
  Contact,
  cableY,
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
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  STEP_FADE,
  steppedCable,
  steppedCone,
  steppedEllipse,
  textPath,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { dayPhase, type WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";
import { NPCS } from "./npcs";

// --- ULICA ELEKTRYKÓW / the yard at night ------------------------------------

/**
 * Ulica Elektryków, inside the old Gdańsk shipyard.
 *
 * ==================================================================
 * WHAT THIS PLACE IS. A service road between two assembly halls of the
 * Stocznia Gdańska, named for the electricians' workshops that lined it, shut
 * with the yard in the nineties and reopened a decade ago as the city's summer
 * street: container bars against the brick, food trailers on the concrete,
 * festoon bulbs strung where the crane cables ran, and a club in the end bay
 * of the far hall. Nothing here was built for nightlife and all of it is used
 * for nightlife, which is the entire look: the newest object on the street is
 * a menu board and the oldest is the hall it leans on.
 *
 * SCALE. House key, both axes: PPM = 38 px per metre, the same 67 px adult as
 * every other exterior. 1720 px is 45 m of street. The halls are the one thing
 * drawn *over* frame height on purpose — a shipyard hall is 18 m to the eaves
 * and the eaves simply do not fit, which is what standing next to one is like.
 *
 *     adult 1.75 m 67 px   container (20 ft) 6.06 m 230 px, 2.59 m 98 px high
 *     hall window bay 3.2 m 122 px           door leaf 2.10 m 80 px
 *     beer barrel table 1.10 m 42 px         portal crane leg 2.4 m 91 px wide
 *
 * SIX PLANES:
 *   farBackground (0.9) — the yard beyond: sky, the portal cranes (one of them
 *     floodlit magenta after dark, which the real street does), the hull
 *     halls, slipway gantries, the city's glow to the south.
 *   middleBackground — the two halls and everything bolted to them: brick
 *     piers, steel-arched windows, the chained works gate, the mural, the
 *     pipe bridge across the gap, the substation kiosk, posters over posters.
 *   ground — concrete plates with the shipyard rail pair still set into them,
 *     drains, weeds in the joints, cable ramps, chalk, bottle caps.
 *   staticObjects — the container bar, the frytki trailer, barrel tables,
 *     pallet bench, the event board, the queue barriers, portaloos, the
 *     generator, the bike pile.
 *   gameplayObjects — nothing painted; people are NpcActors and runtime actors.
 *   Effects — the crowd, the light: festoon strings, neon, the club door's
 *     strobe leak, food-stand steam, cigarette embers, and one man dancing
 *     alone by the bar, who is drawn by hand because the NPC rig does not know
 *     how to dance and he very much does.
 *
 * LIGHTING PREMISE. By day this street is a hangover: flat grey light, shut
 * hatches, gulls. The picture is built for dusk onward, when it runs on five
 * artificial temperatures — warm festoon bulbs overhead, the magenta club
 * neon, the cyan windows of the studio hall, the sodium bulkhead lamps on the
 * brick, the frytki trailer's white — against a sky that still has the yard's
 * crane silhouettes in it. Night is constructed, not filtered: every pool on
 * the concrete has a source overhead.
 *
 * STATE. Clock-derived like the street's, override bag `world.elektrykow`:
 *
 *   club     closed → prep → open → peak     day shut; dusk soundcheck; night on
 *   bar      closed → open                   the container hatch, dusk onward
 *   frytki   closed → open                   the trailer, dusk onward
 *   crowd    0..3                            night 3, dusk 2, day 0
 *   queue    0..2                            outside the club, night only
 *   festoon  auto/on/off                     the bulbs, dusk onward
 *
 * GROUND BAND. {150, 170} like the corridor pilot. Blockers on the things a
 * person genuinely walks around: barrel tables, the picnic table, the
 * generator, the portaloos, the bike pile, the crane leg.
 * ==================================================================
 */

const W = 1720;
const H = 180;
const FLOOR = 150;
const BAND_BOT = 170;

/** Unit boundaries. Every x in this file belongs to one of these. */
const Z = {
  skm: 46, // the stair up to the SKM viaduct, far left
  trafo: 148, // the brick substation kiosk
  halaA: 236, // hall A frontage 236..640 — the studio hall
  mural: 297, // the mural, on the hall's bricked-in first bay
  smoke: 612, // the smoking corner against hall A's right end
  gap: 640, // 640..758: the gap between the halls, pipe bridge overhead
  gate: 698, // the works gate in the gap's spur wall, chained
  bar: 768, // the 20ft container bar 768..998
  frytki: 1046, // the trailer 1046..1170
  board: 1210, // the event board
  crane: 1300, // the parked portal crane leg
  queue: 1352, // barriers 1352..1478
  club: 1490, // hall B frontage 1490..1720
  door: 1584, // the club door in it
  smokeYard: 1690, // the smokers by the dock fence corner
} as const;

/* ================================================================== *
 * palette
 * ================================================================== */

const DAWN_CAST = "#8d88ae";
const DUSK_CAST = "#d4813e";
const NIGHT_CAST = "#101828";

function ramp(mat: Mat): Record<Ph, Mat> {
  return {
    dawn: dim(mat, DAWN_CAST, 0.18),
    day: mat,
    dusk: dim(mat, DUSK_CAST, 0.16),
    night: dim(mat, NIGHT_CAST, 0.52),
  };
}

/** Shipyard brick: a hundred years of soot over what was once orange. */
const BRICK_MAT: Mat = {
  hi: "#9a6a52",
  base: "#875a46",
  mid: "#7a503e",
  lo: "#6b4536",
  deep: "#4e3228",
};
/** Hall B, the club's hall: the same brick, painted grey at some point. */
const BRICKB_MAT: Mat = {
  hi: "#8d8a84",
  base: "#7d7a74",
  mid: "#726f69",
  lo: "#66635d",
  deep: "#4c4a45",
};
/** Concrete plates the whole street is paved with. */
const PLATE_MAT: Mat = {
  hi: "#a09d95",
  base: "#918e86",
  mid: "#878479",
  lo: "#7d7a70",
  deep: "#615e56",
};
/** Corrugated steel: the container, the trailer skirt, the kiosk door. */
const CORR_MAT: Mat = {
  hi: "#5f8a96",
  base: "#4d7682",
  mid: "#436974",
  lo: "#3a5c66",
  deep: "#29434b",
};
const RUSTSTEEL_MAT: Mat = {
  hi: "#9a7a58",
  base: "#86664a",
  mid: "#795c42",
  lo: "#6a503a",
  deep: "#4c3a2b",
};
const STEEL_MAT: Mat = {
  hi: "#c8ccd2",
  base: "#9aa0a8",
  mid: "#868c94",
  lo: "#6d7278",
  deep: "#4f545a",
};
const TRAILER_MAT: Mat = {
  hi: "#e8e2d2",
  base: "#d6d0c0",
  mid: "#c8c2b2",
  lo: "#b8b2a2",
  deep: "#918c7e",
};

const BRICK = ramp(BRICK_MAT);
const BRICKB = ramp(BRICKB_MAT);
const PLATE = ramp(PLATE_MAT);
const CORR = ramp(CORR_MAT);
const RUST = ramp(RUSTSTEEL_MAT);
const STEEL = ramp(STEEL_MAT);
const TRAILER = ramp(TRAILER_MAT);
const WOOD = ramp(M.wood);

const K = {
  /** Same stops as the street's sky, so the two scenes share an evening. */
  sky: {
    dawn: ["#8ba3c4", "#a9b8cc", "#c9cfd8", "#e8cf9a"],
    day: ["#7fa8cc", "#93b8d6", "#a8c8e0", "#cfe2ee"],
    dusk: ["#4a3b63", "#7d5378", "#b96b8c", "#f2a65a"],
    night: ["#12142a", "#1a1830", "#232040", "#2c2a4a"],
  } as Record<Ph, string[]>,
  white: "#f2f2ee",
  cream: "#e8e2d2",
  /** the club's neon, and everything that catches it */
  neon: "#e858a8",
  neonDeep: "#a03a78",
  /** the studio hall's windows after dark */
  cyan: "#5ad8d8",
  cyanDeep: "#2a8a92",
  /** festoon bulbs — tungsten, not LED */
  bulb: "#ffca85",
  bulbHi: "#ffe6bc",
  /** sodium bulkhead lamps on the brick */
  sodium: "#ff9c3a",
  ledRed: "#ff5050",
  ledGreen: "#7ee08c",
  ledAmber: "#ffb03a",
  rust: "#9a7a58",
  rustDeep: "#6b4f36",
  gull: "#d8dade",
  weeds: "#4e6b3a",
  weedsDry: "#8a7a4a",
  chalk: "#e8e2d2",
  glassDark: "#20262e",
  puddle: "#3a4650",
  puddleHi: "#5a6a78",
  tarmacPaint: "#d8cf5a",
  frytki: "#e8b93a",
  ketchup: "#c94040",
  menuBoard: "#2b2e32",
  poster: "#d8cfba",
  posterOld: "#b0a68c",
  posterInk: "#33302a",
  posterPink: "#d86a9a",
  mural1: "#3a7d84",
  mural2: "#d4813e",
  mural3: "#e8e2d2",
  cable: "#1d2126",
  hiVis: "#d6e23f",
} as const;

/* ================================================================== *
 * state — the street runs on the clock; the bag overrides for dev/tests
 * ================================================================== */

export type ClubStage = "closed" | "prep" | "open" | "peak";
export type HatchStage = "closed" | "open";
export type FestoonStage = "auto" | "on" | "off";

const CLUBS: readonly ClubStage[] = ["closed", "prep", "open", "peak"];
const HATCHES: readonly HatchStage[] = ["closed", "open"];
const FESTS: readonly FestoonStage[] = ["auto", "on", "off"];

type ElektrykowState = {
  club: ClubStage;
  bar: HatchStage;
  frytki: HatchStage;
  crowd: 0 | 1 | 2 | 3;
  queue: 0 | 1 | 2;
  festoon: FestoonStage;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

export function elektrykowState(world: WorldState, ph: Ph): ElektrykowState {
  const s = ((world as unknown as Record<string, unknown>).elektrykow ?? {}) as Record<
    string,
    unknown
  >;
  const night = ph === "night";
  const dusk = ph === "dusk";
  const crowd = clampInt(s.crowd, 3, night ? 3 : dusk ? 2 : 0) as 0 | 1 | 2 | 3;
  return {
    club: clampStage(
      s.club,
      CLUBS,
      night ? (crowd >= 3 ? "peak" : "open") : dusk ? "prep" : "closed",
    ),
    bar: clampStage(s.bar, HATCHES, night || dusk ? "open" : "closed"),
    frytki: clampStage(s.frytki, HATCHES, night || dusk ? "open" : "closed"),
    crowd,
    queue: clampInt(s.queue, 2, night ? 2 : 0) as 0 | 1 | 2,
    festoon: clampStage(s.festoon, FESTS, "auto"),
  };
}

/**
 * The phase right now, off the wall clock — for object `when` gates and actor
 * `visible` gates, which get the world but not the phase. Same derivation the
 * runtime feeds the art, so the gate and the picture always agree.
 */
const phNow = () => toPhase(dayPhase(new Date().getHours()));

const festoonOn = (s: ElektrykowState, ph: Ph) =>
  s.festoon === "on" || (s.festoon === "auto" && (ph === "night" || ph === "dusk"));
const clubOn = (s: ElektrykowState) => s.club === "open" || s.club === "peak";
const isDark = (ph: Ph) => ph === "night" || ph === "dusk";

/* ================================================================== *
 * helpers
 * ================================================================== */

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

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/* ================================================================== *
 * FAR — the yard beyond the street
 * ================================================================== */

/** The far horizon the silhouettes stand on. */
const HORIZON = 96;

/**
 * The portal cranes. Same construction as the ones the train window draws —
 * an A-frame on a gantry, the long jib, the shorter counter-jib, the hook
 * block — but nearer, so they get a third leg line and a cab. Five of them at
 * five heights, because they never match. The second one is the one the
 * street floodlights magenta after dark, which the real Elektryków does, and
 * which is worth thirty pixels of anyone's night sky.
 */
function crane(x: number, h: number, span: number): Rect[] {
  const base = HORIZON + 1;
  const top = base - h;
  return [
    [x, top, 3, h], // front leg
    [x + 11, top + 4, 2, h - 4], // back leg
    [x - span + 12, top + 2, span, 2], // the jib
    [x + 13, top + 3, 14, 2], // counter-jib
    [x + 2, top - 3, 10, 3], // the machinery house
    [x - span + 20, top + 4, 1, 8], // hook fall
    [x - span + 19, top + 12, 3, 3], // hook block
    [x - 4, base - 3, 22, 3], // gantry bogies
    [x + 3, top + Math.round(h * 0.45), 6, 5], // the cab
  ];
}
/**
 * Tall enough to loom over the container and the trailer — a Stocznia portal
 * crane is seventy metres of steel and the street furniture is three; if the
 * bar can hide one, the sky is lying.
 */
const CRANE_X: [number, number, number][] = [
  [180, 70, 46],
  [420, 84, 58],
  [700, 62, 40],
  [1180, 76, 50],
  [1560, 66, 42],
];
const CRANES = pxPath(CRANE_X.flatMap(([x, h, s]) => crane(x, h, s)));
/** The lit one gets its own path so the flood can recolour it. */
const CRANE_LIT = pxPath(crane(420, 84, 58));
const CRANE_LIGHTS = pxPath(CRANE_X.map(([x, h]) => [x, HORIZON - h - 5, 2, 2] as Rect));

/** The hull halls and slipway gantries behind the street's own halls. */
const YARD_SHEDS = pxPath([
  [60, HORIZON - 26, 150, 26],
  [95, HORIZON - 33, 80, 7], // the raised bay
  [240, HORIZON - 18, 120, 18],
  [820, HORIZON - 22, 170, 22],
  [1030, HORIZON - 15, 90, 15],
  [1330, HORIZON - 24, 130, 24],
]);
const YARD_SHED_ROOFS = pxPath([
  [60, HORIZON - 28, 150, 2],
  [820, HORIZON - 24, 170, 2],
  [1330, HORIZON - 26, 130, 2],
]);
/** Windows in the sheds that stay lit — a yard never fully sleeps. */
const YARD_WINDOWS = pxPath([
  [86, HORIZON - 16, 5, 4],
  [130, HORIZON - 16, 5, 4],
  [872, HORIZON - 13, 4, 4],
  [946, HORIZON - 13, 4, 4],
  [1368, HORIZON - 15, 5, 4],
]);
/** The ECS block: the rust cube on the skyline, left of everything. */
const ECS = pxPath([
  [8, HORIZON - 38, 44, 38],
  [16, HORIZON - 44, 28, 6],
]);
const ECS_GLAZING = pxPath(repeat(4, 10, [12, HORIZON - 32, 6, 22] as Rect));
/** The city's glow along the horizon after dark: three stepped bands. */
const CITY_GLOW = [
  pxPath([[0, HORIZON - 4, W, 5]]),
  pxPath([[0, HORIZON - 8, W, 4]]),
  pxPath([[0, HORIZON - 11, W, 3]]),
];
/** The ground between horizon and the street's own paving. */
const FAR_APRON = pxPath([[0, HORIZON, W, FLOOR - HORIZON]]);
const FAR_APRON_JOINTS = pxPath(
  repeat(Math.ceil(W / 90), 90, [30, HORIZON, 1, FLOOR - HORIZON] as Rect),
);
/** Container stacks in the middle distance, port-coloured. */
const FAR_STACKS: [Rect, string][] = [
  [[540, HORIZON - 12, 60, 12], "#5a3f4e"],
  [[548, HORIZON - 22, 44, 10], "#3a5c66"],
  [[1240, HORIZON - 11, 54, 11], "#4e5966"],
  [[1470, HORIZON - 10, 48, 10], "#5b6235"],
];

function FarPlane({ ph }: { ph: Ph }) {
  const sky = K.sky[ph];
  const night = ph === "night";
  const dark = isDark(ph);
  const sil = night ? "#262438" : ph === "dusk" ? "#4e3a55" : ph === "dawn" ? "#6d7290" : "#7d8a99";
  const silFar = night
    ? "#1e1c30"
    : ph === "dusk"
      ? "#413050"
      : ph === "dawn"
        ? "#7d82a0"
        : "#8d9aa8";
  return (
    <g>
      <SharedDefs />
      {/* the sky, four stepped bands */}
      <path d={pxPath([[0, 0, W, 34]])} fill={sky[0]} />
      <path d={pxPath([[0, 34, W, 26]])} fill={sky[1]} />
      <path d={pxPath([[0, 60, W, 22]])} fill={sky[2]} />
      <path d={pxPath([[0, 82, W, H - 82]])} fill={sky[3]} />
      {/* stars, only when the sky can hold them */}
      {night ? (
        <path
          d={pxPath(
            Array.from({ length: 22 }, (_, i) => {
              const x = Math.round(hash(i * 31) * W);
              const y = Math.round(hash(i * 47 + 5) * 52) + 4;
              return [x, y, 1, 1] as Rect;
            }),
          )}
          fill="#c9d2e8"
          opacity={0.7}
        />
      ) : null}
      {/* the city's glow, south, behind everything */}
      {dark ? (
        <g>
          <path d={CITY_GLOW[0]} fill={K.sodium} opacity={0.14} />
          <path d={CITY_GLOW[1]} fill={K.sodium} opacity={0.08} />
          <path d={CITY_GLOW[2]} fill={K.sodium} opacity={0.04} />
        </g>
      ) : null}
      {/* ECS, the sheds, the stacks */}
      <path d={ECS} fill={dark ? "#332220" : "#7d4a3a"} />
      <path d={ECS_GLAZING} fill={dark ? "#4e3a3a" : "#a8b8c4"} opacity={0.8} />
      <path d={YARD_SHEDS} fill={silFar} />
      <path d={YARD_SHED_ROOFS} fill={sil} />
      {FAR_STACKS.map(([r, c]) => (
        <path
          key={r[0]}
          d={pxPath([r])}
          fill={dark ? dim({ hi: c, base: c, mid: c, lo: c, deep: c }, NIGHT_CAST, 0.5).base : c}
        />
      ))}
      <path d={YARD_WINDOWS} fill={dark ? K.ledAmber : "#c8d2da"} opacity={dark ? 0.9 : 0.5} />
      {/* the cranes */}
      <path d={CRANES} fill={sil} />
      {/* the floodlit one: magenta after dark, plain steel by day */}
      {dark ? (
        <>
          <path d={CRANE_LIT} fill={K.neonDeep} opacity={0.85} />
          <path d={CRANE_LIT} fill={K.neon} opacity={0.35} />
        </>
      ) : null}
      {/* aircraft lights on the jib tops, blinking out of phase */}
      {dark ? (
        <path d={CRANE_LIGHTS} fill={K.ledRed}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.15;1;1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* gulls, day only — at night they have somewhere better to be */}
      {!dark ? (
        <g>
          {[300, 760, 1240].map((x, i) => (
            <path
              key={x}
              d={pxPath([
                [x, 30 + i * 9, 3, 1],
                [x + 4, 29 + i * 9, 3, 1],
              ])}
              fill={K.gull}
              opacity={0.8}
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0;${60 + i * 30} ${-4 + i * 2};${140 + i * 40} 2;0 0`}
                dur={`${34 + i * 9}s`}
                repeatCount="indefinite"
              />
            </path>
          ))}
        </g>
      ) : null}
      {/* the apron between the halls' backs and the horizon */}
      <path d={FAR_APRON} fill={dark ? "#2a2a3a" : "#8d8a80"} />
      <path d={FAR_APRON_JOINTS} fill="#000" opacity={0.12} />
    </g>
  );
}

/* ================================================================== *
 * MID — the halls, and everything bolted to them
 * ================================================================== */

/* ---- hall A: the studio hall, 236..640 --------------------------------- */

const HA = { x0: Z.halaA, x1: Z.gap } as const;
const HA_BODY = bevelPaths([[HA.x0, 0, HA.x1 - HA.x0, FLOOR]]);
/** Brick piers between the window bays — a hall wall is piers, not surface. */
const HA_PIERS = pxPath(repeat(4, 122, [HA.x0, 0, 14, FLOOR] as Rect));
const HA_PIER_EDGE = pxPath(repeat(4, 122, [HA.x0 + 12, 0, 2, FLOOR] as Rect));
/** Brick coursing: every fourth course reads, the rest is texture. */
const HA_COURSES = pxPath(
  repeat(Math.floor(FLOOR / 12), 12, [HA.x0, 8, HA.x1 - HA.x0, 1] as Rect, "y"),
);
/**
 * The steel-arched windows in the second and third bays, y 28..104. The arch
 * is a stepped head — a polygon would antialias. Small panes on a lattice; a
 * few are broken and boarded, and after dark the whole lattice goes cyan,
 * because somebody rents the hall as studios and they work nights. The first
 * bay has no window: it was bricked in decades ago and carries the mural.
 */
const HA_WIN: Rect[] = [378, 500].map((x) => [x, 38, 78, 66] as Rect);
const HA_WIN_ARCH = pxPath(
  HA_WIN.flatMap(
    ([x, y, w]) =>
      [
        [x + 6, y - 6, w - 12, 6],
        [x + 14, y - 10, w - 28, 4],
      ] as Rect[],
  ),
);
const HA_WIN_GLASS = pxPath([
  ...HA_WIN,
  ...HA_WIN.map(([x, y, w]) => [x + 6, y - 6, w - 12, 6] as Rect),
  ...HA_WIN.map(([x, y, w]) => [x + 14, y - 10, w - 28, 4] as Rect),
]);
const HA_WIN_LATTICE = pxPath(
  HA_WIN.flatMap(([x, y, w, h]) => [
    ...repeat(Math.floor(w / 13), 13, [x + 12, y - 8, 1, h + 8] as Rect),
    ...repeat(Math.floor(h / 14), 14, [x, y + 6, w, 1] as Rect, "y"),
  ]),
);
/** The boarded panes: plywood over two of them, and one honest hole. */
const HA_WIN_BOARD = pxPath([
  [HA_WIN[0][0] + 13, HA_WIN[0][1] + 34, 24, 26],
  [HA_WIN[1][0] + 52, HA_WIN[1][1] + 6, 24, 26],
]);
const HA_WIN_BROKEN = pxPath([
  [HA_WIN[1][0] + 14, HA_WIN[1][1] + 22, 5, 4],
  [HA_WIN[1][0] + 17, HA_WIN[1][1] + 25, 3, 3],
]);
const HA_SILLS = pxPath(HA_WIN.map(([x, y, w]) => [x - 3, y + 66, w + 6, 4] as Rect));
/** The lintel band and the painted works sign above the windows, ghosted. */
const HA_BAND = pxPath([[HA.x0, 20, HA.x1 - HA.x0, 4]]);
/** Downpipes on the piers, with the collars that hold them. */
const HA_PIPES = pxPath(
  [360, 482].flatMap(
    (x) =>
      [
        [x, 0, 4, FLOOR - 4],
        [x - 1, 34, 6, 3],
        [x - 1, 98, 6, 3],
        [x - 2, FLOOR - 10, 8, 10], // the shoe
      ] as Rect[],
  ),
);
/** The damp under a leaking pipe joint, and the moss line at the plinth. */
const HA_DAMP = pxPath([
  [352, 96, 22, 54],
  [474, 118, 20, 32],
]);
const HA_PLINTH = pxPath([[HA.x0, FLOOR - 16, HA.x1 - HA.x0, 16]]);
const HA_MOSS = pxPath(repeat(26, 16, [HA.x0 + 3, FLOOR - 4, 6, 3] as Rect));

/* ---- the mural, on the hall's bricked-in first bay ----------------------- */

/**
 * The first bay (250..344) lost its window decades ago — the infill brick is
 * a shade off the original, which is its own bit of history — and carries the
 * mural: a tug hauling a hull section, painted by somebody good, weathered by
 * ten winters. Big flat fields, off-register on purpose — a wall painting
 * drapes over brick coursing and loses its edges.
 */
const BAY1 = { x0: 250, x1: 344 } as const;
const BAY1_INFILL = pxPath([[BAY1.x0, 28, BAY1.x1 - BAY1.x0, 122]]);
const BAY1_ARCH = pxPath([
  [BAY1.x0 + 6, 22, BAY1.x1 - BAY1.x0 - 12, 6],
  [BAY1.x0 + 14, 18, BAY1.x1 - BAY1.x0 - 28, 4],
]);
const BAY1_JOINTS = pxPath(repeat(6, 15, [BAY1.x0 + 6, 32, 1, 114] as Rect));
const MURAL_FIELD = pxPath([[Z.mural - 45, 42, 90, 86]]);
/** The hull section: sheer line stepping down toward a raked bow. */
const MURAL_HULL = pxPath([
  [Z.mural - 26, 58, 52, 8],
  [Z.mural - 31, 66, 60, 8],
  [Z.mural - 36, 74, 68, 8],
  [Z.mural - 39, 82, 74, 14],
]);
const MURAL_SUPER = pxPath([
  [Z.mural + 6, 48, 18, 10],
  [Z.mural + 10, 44, 4, 4],
]);
const MURAL_PORTHOLES = pxPath([
  [Z.mural - 18, 86, 3, 3],
  [Z.mural - 6, 86, 3, 3],
  [Z.mural + 6, 86, 3, 3],
  [Z.mural + 18, 86, 3, 3],
]);
/** The painted crane hook coming down into frame — the yard signing itself. */
const MURAL_HOOK = pxPath([
  [Z.mural - 36, 42, 2, 12],
  [Z.mural - 39, 54, 8, 3],
  [Z.mural - 38, 57, 3, 4],
]);
/** The tug, low and dark, shouldering the bow. */
const MURAL_TUG = pxPath([
  [Z.mural - 42, 100, 26, 12],
  [Z.mural - 36, 94, 10, 6],
  [Z.mural - 33, 90, 4, 4],
]);
const MURAL_WAVES = pxPath([
  ...repeat(4, 22, [Z.mural - 43, 114, 12, 3] as Rect),
  ...repeat(4, 22, [Z.mural - 33, 120, 10, 2] as Rect),
  /* the tug's bow wave, brighter */
  [Z.mural - 44, 110, 8, 3],
]);
const MURAL_GULLS = pxPath([
  [Z.mural + 26, 50, 4, 1],
  [Z.mural + 31, 49, 4, 1],
  [Z.mural + 18, 58, 4, 1],
]);
const MURAL_WEAR = pxPath([
  [Z.mural - 24, 42, 7, 86],
  [Z.mural + 28, 42, 5, 86],
]);

/* ---- the works gate, in the gap's spur wall ------------------------------ */

const GATE: Rect = [Z.gate - 28, 92, 56, FLOOR - 92];
const GATE_SET = bevelPaths([GATE]);
const GATE_RIBS = pxPath(repeat(4, 13, [GATE[0] + 6, GATE[1] + 4, 3, GATE[3] - 8] as Rect));
const GATE_SPLIT = pxPath([[Z.gate - 1, GATE[1], 2, GATE[3]]]);
const GATE_CHAIN = pxPath([
  [Z.gate - 8, 114, 16, 3],
  [Z.gate - 5, 117, 10, 8],
]);
const GATE_SIGN: Rect = [Z.gate - 22, 98, 44, 12];

/* ---- posters, over posters, over posters -------------------------------- */

/**
 * The poster drift under the studio windows: this month's lineup pasted over
 * last month's, over a festival that was two summers ago. Torn corners show
 * the strata — the whole history of the street in three layers of paper.
 */
const POSTERS_OLD = pxPath([
  [382, 112, 30, 34],
  [504, 114, 26, 32],
]);
const POSTERS_MID = pxPath([
  [388, 110, 30, 36],
  [510, 112, 28, 34],
  [540, 116, 22, 30],
]);
const POSTERS_NEW: Rect[] = [
  [394, 108, 32, 38],
  [516, 110, 30, 36],
];
const POSTERS_ART = pxPath([
  [398, 114, 24, 12],
  [400, 130, 20, 3],
  [400, 136, 14, 2],
  [520, 116, 22, 10],
  [522, 130, 16, 3],
]);
const POSTERS_TORN = pxPath([
  [394, 142, 8, 4],
  [538, 110, 8, 5],
]);

/* ---- the substation kiosk at 148 ---------------------------------------- */

const TRAFO: Rect = [Z.trafo - 34, 74, 68, FLOOR - 74];
const TRAFO_SET = bevelPaths([TRAFO]);
const TRAFO_ROOF = pxPath([
  [TRAFO[0] - 3, TRAFO[1] - 5, TRAFO[2] + 6, 5],
  [TRAFO[0] - 1, TRAFO[1] - 7, TRAFO[2] + 2, 2],
]);
const TRAFO_DOOR = pxPath([[Z.trafo - 16, 92, 32, FLOOR - 92]]);
const TRAFO_DOOR_RIBS = pxPath(repeat(4, 4, [Z.trafo - 12, 96, 24, 1] as Rect, "y"));
const TRAFO_SIGN: Rect = [Z.trafo - 12, 78, 24, 11];
/** The lightning bolt on the warning sign — a zigzag, not a cross. */
const TRAFO_BOLT = pxPath([
  [Z.trafo - 1, 79, 4, 2],
  [Z.trafo - 3, 81, 4, 2],
  [Z.trafo, 83, 4, 2],
  [Z.trafo - 2, 85, 3, 3],
]);
/** Cables in conduit off the kiosk, up the hall wall — the street's name. */
const TRAFO_CONDUIT = pxPath([
  [Z.trafo + 32, 108, HA.x0 - Z.trafo - 32, 3],
  [HA.x0 - 6, 40, 3, 68],
  [Z.trafo + 46, 104, 4, 4],
  [HA.x0 - 8, 60, 7, 4],
]);

/* ---- the SKM stair at 46 ------------------------------------------------ */

const SKM_STAIR = pxPath([
  // the flight, going up left out of frame: risers as courses
  ...Array.from({ length: 9 }, (_, i) => [Z.skm - 34 + i * 7, 66 + i * 9, 62 - i * 7, 4] as Rect),
]);
const SKM_RAIL = pxPath([
  [Z.skm - 36, 58, 3, 88],
  [Z.skm + 28, 92, 3, 56],
  [Z.skm - 36, 58, 66, 3],
]);
const SKM_SIGN: Rect = [Z.skm - 26, 34, 78, 16];
const SKM_POST = pxPath([[Z.skm + 8, 50, 4, 100]]);
/** The palisade fence from the stair to the substation. */
const FENCE_A = pxPath([
  ...repeat(9, 8, [Z.skm + 40, 108, 3, FLOOR - 108] as Rect),
  [Z.skm + 38, 112, 74, 3],
  [Z.skm + 38, 136, 74, 3],
]);

/* ---- the gap, 640..758: pipe bridge and the smoking corner --------------- */

/**
 * The pipe bridge: two steam mains and a cable tray crossing the street
 * between the halls, on a lattice truss. Every real shipyard street has one
 * and it is the single strongest "industry overhead" the scene can buy.
 */
const BRIDGE_TRUSS = pxPath([
  [Z.gap - 6, 22, Z.bar - Z.gap + 18, 4],
  [Z.gap - 6, 40, Z.bar - Z.gap + 18, 3],
  ...repeat(6, 22, [Z.gap - 2, 25, 2, 15] as Rect),
  ...repeat(6, 22, [Z.gap + 8, 25, 2, 15] as Rect),
]);
const BRIDGE_PIPES = pxPath([
  [Z.gap - 6, 28, Z.bar - Z.gap + 18, 5],
  [Z.gap - 6, 34, Z.bar - Z.gap + 18, 3],
]);
const BRIDGE_LAGGING = pxPath(repeat(5, 26, [Z.gap + 2, 27, 4, 7] as Rect));
/** The back wall of the gap: the yard shows through over the brick spur that
 * closes it off, and the works gate sits in the spur. */
const GAP_SPUR = pxPath([[Z.gap, 84, 118, FLOOR - 84]]);
const GAP_SPUR_TOP = pxPath([[Z.gap, 82, 118, 2]]);
const GAP_SPUR_COURSES = pxPath(repeat(5, 12, [Z.gap, 90, 118, 1] as Rect, "y"));
const GAP_RAZOR = pxPath(repeat(14, 8, [Z.gap + 2, 78, 4, 4] as Rect));
/** The smoking corner: a sand bucket, a rail to lean on, stubs. */
const SMOKE_RAIL = pxPath([
  [Z.smoke - 20, 116, 3, 34],
  [Z.smoke + 24, 116, 3, 34],
  [Z.smoke - 20, 116, 47, 3],
]);
const SMOKE_BUCKET = pxPath([
  [Z.smoke + 30, FLOOR - 14, 12, 14],
  [Z.smoke + 28, FLOOR - 16, 16, 3],
]);

/* ---- hall B: the club's hall, 1490..1720 -------------------------------- */

const HB = { x0: Z.club, x1: W } as const;
const HB_BODY = bevelPaths([[HB.x0, 0, HB.x1 - HB.x0, FLOOR]]);
const HB_PIERS = pxPath(repeat(2, 122, [HB.x0, 0, 14, FLOOR] as Rect));
const HB_COURSES = pxPath(
  repeat(Math.floor(FLOOR / 12), 12, [HB.x0, 8, HB.x1 - HB.x0, 1] as Rect, "y"),
);
/** Its windows are bricked up — the club needs the dark. Ghost arches. */
const HB_GHOSTS = pxPath([
  [HB.x0 + 32, 38, 70, 66],
  [HB.x0 + 140, 38, 70, 66],
]);
const HB_GHOST_ARCH = pxPath([
  [HB.x0 + 38, 32, 58, 6],
  [HB.x0 + 146, 32, 58, 6],
]);
const HB_GHOST_INFILL = pxPath([
  ...repeat(5, 13, [HB.x0 + 36, 44, 1, 58] as Rect),
  ...repeat(5, 13, [HB.x0 + 144, 44, 1, 58] as Rect),
]);
/** The club door: steel double leaf in the first bay, portholes lit inside. */
const DOOR: Rect = [Z.door - 40, 70, 80, FLOOR - 70];
const DOOR_SET = bevelPaths([DOOR]);
const DOOR_SPLIT = pxPath([[Z.door - 1, DOOR[1], 2, DOOR[3]]]);
const DOOR_PORTHOLES = pxPath([
  [Z.door - 22, 88, 12, 12],
  [Z.door + 10, 88, 12, 12],
]);
const DOOR_PUSHBAR = pxPath([
  [Z.door - 30, 116, 26, 4],
  [Z.door + 4, 116, 26, 4],
]);
const DOOR_HEAD = pxPath([[DOOR[0] - 4, DOOR[1] - 4, DOOR[2] + 8, 4]]);
const DOOR_STEP = pxPath([[DOOR[0] - 2, FLOOR - 3, DOOR[2] + 4, 3]]);
/**
 * The neon: TURBINA, tube lettering on a blackened steel frame over the door.
 * Two passes — the deep magenta tube body, then the bright core one pixel in.
 * The R flickers, because a neon with all its letters is a neon from a
 * renderer, not from a shipyard.
 */
const NEON_FRAME = pxPath([[Z.door - 66, 36, 132, 26]]);
const NEON_TEXT_X = Z.door - 56;
const NEON_TEXT_Y = 42;
/** The mounting brackets and the cable running down to the meter box. */
const NEON_MOUNT = pxPath([
  [Z.door - 60, 62, 4, 6],
  [Z.door + 54, 62, 4, 6],
]);
/** The bulkhead lamp over the door and the CCTV looking down the queue. */
const DOOR_LAMP = pxPath([
  [Z.door - 52, 64, 10, 5],
  [Z.door - 50, 69, 6, 2],
]);
const DOOR_CCTV = pxPath([
  [Z.door + 48, 66, 8, 5],
  [Z.door + 54, 68, 4, 2],
]);
/** The decibel notice and the house-rules board beside the door. */
const RULES_BOARD: Rect = [Z.door + 52, 92, 26, 34];
/** A-board on the pavement: tonight's names, chalked. */
const ABOARD = pxPath([
  [Z.queue - 34, FLOOR - 30, 26, 30],
  [Z.queue - 36, FLOOR - 32, 30, 3],
]);
const ABOARD_CHALK = pxPath([
  [Z.queue - 30, FLOOR - 26, 18, 2],
  [Z.queue - 30, FLOOR - 21, 14, 2],
  [Z.queue - 30, FLOOR - 16, 16, 2],
  [Z.queue - 30, FLOOR - 11, 10, 2],
]);

/** The dock fence at the far right, past the club, and its locked gate. */
const DOCK_FENCE = pxPath([
  ...repeat(7, 8, [W - 52, 104, 3, FLOOR - 104] as Rect),
  [W - 54, 108, 56, 3],
  [W - 54, 134, 56, 3],
]);

/* ================================================================== *
 * GROUND — concrete plates, the rail pair, the wear of a street
 * ================================================================== */

const PLATES = (() => {
  const joints: Rect[] = [];
  for (let x = 0; x < W; x += 86) joints.push([x, FLOOR, 1, H - FLOOR]);
  joints.push([0, FLOOR + 11, W, 1]);
  return pxPath(joints);
})();
const APRON = pxPath([[0, FLOOR, W, H - FLOOR]]);
/**
 * The shipyard rail pair, still set into the plates, running the whole
 * street. Two steel lines with the flangeway groove beside each — the single
 * strongest thing the ground can say about where this is. They catch every
 * light the street turns on.
 */
const RAIL_Y = [157, 165] as const;
const RAILS = pxPath(RAIL_Y.map((y) => [0, y, W, 2] as Rect));
const RAIL_GROOVE = pxPath(RAIL_Y.map((y) => [0, y + 2, W, 1] as Rect));
/** Weeds in the plate joints and along the rails, dry by autumn. */
const WEEDS = pxPath(
  Array.from({ length: 30 }, (_, i) => {
    const x = Math.round(hash(i * 13) * W);
    const y = FLOOR + 2 + Math.round(hash(i * 29 + 3) * 16);
    return [x, y - 3, 2, 3] as Rect;
  }),
);
/** Drain channel across the street in the gap, grated. */
const DRAIN = pxPath([[Z.gap + 30, FLOOR + 4, 60, 4]]);
const DRAIN_SLOTS = pxPath(repeat(12, 5, [Z.gap + 32, FLOOR + 5, 2, 2] as Rect));
/** Yellow cable ramps where the generator's cables cross the walking line. */
const CABLE_RAMPS = pxPath([
  [Z.frytki + 138, FLOOR + 6, 26, 4],
  [Z.bar + 246, FLOOR + 12, 26, 4],
]);
const CABLE_RUNS = pxPath([
  [Z.frytki + 130, FLOOR + 8, 8, 2],
  [Z.frytki + 164, FLOOR + 8, 30, 2],
  [Z.bar + 236, FLOOR + 14, 10, 2],
  [Z.bar + 272, FLOOR + 14, 24, 2],
]);
/** The puddle in the worn plate by the yard — rimlit at night by the neon. */
const PUDDLE = pxPath(steppedEllipse(Z.board + 60, FLOOR + 14, 24, 5, 2));
const PUDDLE_RIM = pxPath([[Z.board + 40, FLOOR + 10, 40, 1]]);
/** Paint on the plates: an old crane road marking, half gone. */
const YARD_MARKING = pxPath([...repeat(4, 40, [Z.halaA + 20, FLOOR + 20, 22, 3] as Rect)]);
/** Bottle caps trodden into the concrete around the bar. */
const CAPS = pxPath(
  Array.from({ length: 9 }, (_, i) => {
    const x = Z.bar + 20 + Math.round(hash(i * 7) * 220);
    const y = FLOOR + 4 + Math.round(hash(i * 11 + 2) * 14);
    return [x, y, 2, 1] as Rect;
  }),
);
/** Stubs by the smoking corner and outside the club. */
const STUBS = pxPath([
  ...Array.from(
    { length: 6 },
    (_, i) => [Z.smoke - 12 + i * 5, FLOOR + 6 + (i % 3) * 4, 2, 1] as Rect,
  ),
  ...Array.from(
    { length: 5 },
    (_, i) => [Z.smokeYard - 18 + i * 6, FLOOR + 8 + (i % 2) * 5, 2, 1] as Rect,
  ),
]);
/** Chalk hopscotch nobody who drew it plays anymore — daytime kids exist here too. */
const CHALK_SUN = pxPath([
  [Z.trafo + 60, FLOOR + 16, 10, 8],
  [Z.trafo + 63, FLOOR + 12, 4, 4],
  [Z.trafo + 72, FLOOR + 18, 4, 4],
]);

function Ground({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const p = PLATE[ph];
  const night = ph === "night";
  return (
    <g>
      <path d={APRON} fill={p.base} />
      <path d={APRON} fill={dth("n", "06")} opacity={0.5} />
      <path d={PLATES} fill={p.deep} opacity={0.5} />
      {/* the walked line, worn pale mid-band */}
      <path d={pxPath([[0, FLOOR + 8, W, 8]])} fill={p.hi} opacity={0.25} />
      <path d={pxPath([[0, H - 4, W, 4]])} fill="#000" opacity={0.14} />
      <path d={RAILS} fill={night ? "#6d7480" : "#7d838c"} />
      <path d={RAIL_GROOVE} fill="#000" opacity={0.35} />
      <path d={WEEDS} fill={K.weedsDry} opacity={0.8} />
      <path d={DRAIN} fill={p.deep} />
      <path d={DRAIN_SLOTS} fill="#000" opacity={0.5} />
      <path d={YARD_MARKING} fill={K.tarmacPaint} opacity={0.22} />
      <path d={CHALK_SUN} fill={K.chalk} opacity={ph === "day" || ph === "dawn" ? 0.4 : 0.15} />
      <path d={PUDDLE} fill={night ? K.puddle : "#7a828c"} opacity={0.8} />
      <path d={PUDDLE_RIM} fill={K.puddleHi} opacity={0.5} />
      {night ? (
        <path d={pxPath([[Z.board + 46, FLOOR + 12, 26, 2]])} fill={K.neon} opacity={0.3} />
      ) : null}
      <path d={CABLE_RUNS} fill={K.cable} />
      <path d={CABLE_RAMPS} fill={K.hiVis} opacity={0.8} />
      <path
        d={pxPath([
          [Z.frytki + 138, FLOOR + 7, 26, 1],
          [Z.bar + 246, FLOOR + 13, 26, 1],
        ])}
        fill="#000"
        opacity={0.3}
      />
      {s.crowd >= 1 ? <path d={CAPS} fill="#b8912e" opacity={0.7} /> : null}
      <path d={STUBS} fill={K.cream} opacity={0.5} />
    </g>
  );
}

/* ================================================================== *
 * STATIC — the furniture of a street that gets built every April
 * ================================================================== */

/* ---- the container bar, 768..998 ---------------------------------------- */

const CONT: Rect = [Z.bar, FLOOR - 98, 230, 98];
const CONT_SET = bevelPaths([CONT]);
const CONT_CORR = pxPath(repeat(27, 8, [CONT[0] + 5, CONT[1] + 4, 3, CONT[3] - 8] as Rect));
const CONT_CORNERS = pxPath([
  [CONT[0], CONT[1], 6, CONT[3]],
  [CONT[0] + CONT[2] - 6, CONT[1], 6, CONT[3]],
]);
/** The serving hatch cut into it, with the flap propped up as an awning. */
const HATCH: Rect = [Z.bar + 76, FLOOR - 74, 104, 42];
const HATCH_DARK = pxPath([HATCH]);
const HATCH_FLAP = pxPath([
  [HATCH[0] - 4, HATCH[1] - 12, HATCH[2] + 8, 6],
  [HATCH[0] - 2, HATCH[1] - 7, 3, 8],
  [HATCH[0] + HATCH[2] - 1, HATCH[1] - 7, 3, 8],
]);
/** The counter across the hatch and what stands on it. */
const HATCH_COUNTER = pxPath([[HATCH[0] - 4, HATCH[1] + HATCH[3] - 4, HATCH[2] + 8, 6]]);
const HATCH_TAPS = pxPath([
  [HATCH[0] + 14, HATCH[1] + HATCH[3] - 14, 3, 10],
  [HATCH[0] + 13, HATCH[1] + HATCH[3] - 16, 5, 3],
]);
const HATCH_CUPS = pxPath([
  [HATCH[0] + 68, HATCH[1] + HATCH[3] - 10, 6, 6],
  [HATCH[0] + 76, HATCH[1] + HATCH[3] - 8, 6, 4],
]);
/** Backbar glow inside: shelves of bottles reading as lit rows after dark. */
const HATCH_SHELVES = pxPath([
  [HATCH[0] + 8, HATCH[1] + 8, HATCH[2] - 16, 3],
  [HATCH[0] + 8, HATCH[1] + 20, HATCH[2] - 16, 3],
]);
const HATCH_BOTTLES = pxPath([
  ...repeat(9, 9, [HATCH[0] + 12, HATCH[1] + 2, 4, 6] as Rect),
  ...repeat(8, 10, [HATCH[0] + 14, HATCH[1] + 14, 4, 6] as Rect),
]);
/** BAR PRĄD, stencilled on the container over the hatch. */
/** High enough that the propped hatch flap never cuts the lettering. */
const BAR_SIGN_Y = FLOOR - 96;
/** The closed state: a padlocked roller shutter over the hatch. */
const HATCH_SHUT = pxPath([HATCH, [HATCH[0] - 2, HATCH[1] - 3, HATCH[2] + 4, 3]]);
const HATCH_SHUT_RIBS = pxPath(repeat(9, 5, [HATCH[0], HATCH[1] + 3, HATCH[2], 1] as Rect, "y"));
/** The blackboard menu hung on the container's left end. */
const BAR_MENU: Rect = [Z.bar + 14, FLOOR - 66, 40, 44];
const BAR_MENU_LINES = pxPath([
  [BAR_MENU[0] + 5, BAR_MENU[1] + 8, 26, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 15, 30, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 22, 22, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 29, 28, 2],
  [BAR_MENU[0] + 5, BAR_MENU[1] + 36, 18, 2],
]);

/* ---- the barrel tables and the pallet bench ------------------------------ */

/** Beer barrels stood on end as tables, 1.1 m, in the walking band. */
const BARREL_X = [Z.bar + 258, Z.bar + 302, Z.frytki - 42] as const;
const BARREL_Y = [162, 156, 164] as const;
function barrel(x: number, footY: number): Rect[] {
  return [
    [x - 10, footY - 42, 20, 42],
    [x - 11, footY - 42, 22, 3],
    [x - 11, footY - 26, 22, 2],
    [x - 11, footY - 12, 22, 2],
  ];
}
const BARRELS = BARREL_X.map((x, i) => bevelPaths(barrel(x, BARREL_Y[i])));
/** The chime hoops, over the bevel — a barrel without them is a crate. */
const BARREL_RINGS = pxPath(
  BARREL_X.flatMap(
    (x, i) =>
      [
        [x - 11, BARREL_Y[i] - 40, 22, 2],
        [x - 11, BARREL_Y[i] - 26, 22, 2],
        [x - 11, BARREL_Y[i] - 12, 22, 2],
      ] as Rect[],
  ),
);
/** What is on them: glasses, a folded flyer, somebody's tobacco tin. */
const BARREL_TOPS = pxPath([
  [BARREL_X[0] - 5, BARREL_Y[0] - 47, 4, 5],
  [BARREL_X[0] + 2, BARREL_Y[0] - 45, 5, 3],
  [BARREL_X[1] - 3, BARREL_Y[1] - 46, 6, 4],
  [BARREL_X[2] - 6, BARREL_Y[2] - 46, 4, 4],
  [BARREL_X[2] + 1, BARREL_Y[2] - 45, 6, 3],
]);
/** The pallet bench against hall A, by the smoking corner. */
const PALLETS = pxPath([
  [Z.smoke - 76, FLOOR - 18, 44, 18],
  [Z.smoke - 76, FLOOR - 20, 44, 3],
  ...repeat(5, 9, [Z.smoke - 73, FLOOR - 16, 3, 14] as Rect),
]);

/* ---- the frytki trailer, 1046..1170 -------------------------------------- */

const TRAIL: Rect = [Z.frytki, FLOOR - 76, 124, 70];
const TRAIL_SET = bevelPaths([TRAIL]);
const TRAIL_HATCH: Rect = [Z.frytki + 22, FLOOR - 62, 80, 34];
/** The awning band carries the trailer's name; scallops hang under it. */
const TRAIL_AWNING = pxPath([
  [TRAIL_HATCH[0] - 8, TRAIL_HATCH[1] - 13, TRAIL_HATCH[2] + 16, 8],
  ...repeat(6, 16, [TRAIL_HATCH[0] - 6, TRAIL_HATCH[1] - 5, 8, 3] as Rect),
]);
const TRAIL_SIGN_X = TRAIL_HATCH[0] + Math.round(TRAIL_HATCH[2] / 2) - 14;
const TRAIL_COUNTER = pxPath([
  [TRAIL_HATCH[0] - 4, TRAIL_HATCH[1] + TRAIL_HATCH[3] - 3, TRAIL_HATCH[2] + 8, 5],
]);
const TRAIL_FRYER = pxPath([
  [TRAIL_HATCH[0] + 50, TRAIL_HATCH[1] + 10, 22, 18],
  [TRAIL_HATCH[0] + 54, TRAIL_HATCH[1] + 6, 14, 4],
]);
const TRAIL_BOTTLES = pxPath([
  [TRAIL_HATCH[0] + 6, TRAIL_HATCH[1] + 22, 5, 9],
  [TRAIL_HATCH[0] + 13, TRAIL_HATCH[1] + 22, 5, 9],
]);
const TRAIL_WHEEL = pxPath([
  [Z.frytki + 14, FLOOR - 8, 16, 8],
  [Z.frytki + 18, FLOOR - 6, 8, 6],
  [Z.frytki + 94, FLOOR - 8, 16, 8],
  [Z.frytki + 98, FLOOR - 6, 8, 6],
]);
const TRAIL_JACK = pxPath([[Z.frytki + 116, FLOOR - 10, 4, 10]]);
/** FRYTKI, painted on the trailer's brow. */
/** Its menu board on the counter end and the ketchup pump beside the hatch. */
const TRAIL_MENU: Rect = [Z.frytki + 106, FLOOR - 58, 16, 26];
const TRAIL_SHUT = pxPath([TRAIL_HATCH]);
const TRAIL_SHUT_RIBS = pxPath(
  repeat(7, 5, [TRAIL_HATCH[0], TRAIL_HATCH[1] + 2, TRAIL_HATCH[2], 1] as Rect, "y"),
);
/** The picnic table by the trailer, in the band. */
const PICNIC = pxPath([
  [Z.frytki + 152, 158 - 26, 44, 4],
  [Z.frytki + 158, 158 - 22, 5, 22],
  [Z.frytki + 185, 158 - 22, 5, 22],
  [Z.frytki + 146, 158 - 14, 14, 3],
  [Z.frytki + 188, 158 - 14, 14, 3],
]);
/** The generator behind the trailer's offside, cable to the ramp. */
const GEN: Rect = [Z.frytki + 128, FLOOR - 26, 34, 22];
const GEN_SET = bevelPaths([GEN]);
const GEN_VENTS = pxPath(repeat(4, 6, [GEN[0] + 5, GEN[1] + 5, 3, 12] as Rect));
const GEN_LED = pxPath([[GEN[0] + 28, GEN[1] + 4, 2, 2]]);

/* ---- the yard: event board, crane leg, bikes ----------------------------- */

/** The event board: a scaffold billboard with this season's lineup. */
const BOARD: Rect = [Z.board - 50, 58, 100, 64];
const BOARD_SET = bevelPaths([BOARD]);
const BOARD_LEGS = pxPath([
  [Z.board - 44, 122, 5, FLOOR - 122],
  [Z.board + 39, 122, 5, FLOOR - 122],
  [Z.board - 46, 132, 92, 3],
]);
const BOARD_PAPER = pxPath([[BOARD[0] + 5, BOARD[1] + 5, BOARD[2] - 10, BOARD[3] - 10]]);
const BOARD_ART = pxPath([
  [BOARD[0] + 12, BOARD[1] + 12, BOARD[2] - 24, 16],
  [BOARD[0] + 12, BOARD[1] + 34, 40, 3],
  [BOARD[0] + 12, BOARD[1] + 40, 52, 3],
  [BOARD[0] + 12, BOARD[1] + 46, 34, 3],
]);
const BOARD_TEAR = pxPath([[BOARD[0] + BOARD[2] - 18, BOARD[1] + 44, 13, 12]]);

/**
 * The parked portal crane leg: one foot of a crane that has stood on the
 * street's own rails since the eighties, fenced at the base, too expensive to
 * move and too listed to scrap. It goes up out of frame — you are standing
 * under it, which no background crane can do.
 */
const CRANE_LEG = pxPath([
  [Z.crane - 14, 0, 12, FLOOR - 4],
  [Z.crane + 10, 0, 10, FLOOR - 4],
  ...repeat(7, 20, [Z.crane - 2, 8, 12, 3] as Rect), // lattice bracing
  [Z.crane - 20, FLOOR - 12, 46, 8], // the bogie beam
  [Z.crane - 16, FLOOR - 4, 12, 4],
  [Z.crane + 12, FLOOR - 4, 12, 4], // wheels on the rails
]);
const CRANE_LEG_PLATE = pxPath([[Z.crane - 8, 96, 22, 12]]);
/** The bike pile against the board's legs — nobody drives here. */
const BIKES = pxPath([
  // three overlapping frames, drawn as wheels + bars
  [Z.board + 62, FLOOR - 22, 2, 8],
  [Z.board + 56, FLOOR - 16, 14, 2],
  [Z.board + 54, FLOOR - 14, 3, 12],
  [Z.board + 70, FLOOR - 14, 3, 12],
  [Z.board + 76, FLOOR - 20, 2, 8],
  [Z.board + 71, FLOOR - 13, 14, 2],
  [Z.board + 84, FLOOR - 13, 3, 11],
  [Z.board + 92, FLOOR - 18, 12, 2],
  [Z.board + 90, FLOOR - 12, 3, 10],
  [Z.board + 102, FLOOR - 12, 3, 10],
]);

/* ---- the queue, 1352..1478 ----------------------------------------------- */

const BARRIER_X = [Z.queue, Z.queue + 44, Z.queue + 88] as const;
const BARRIERS = pxPath(
  BARRIER_X.flatMap(
    (x) =>
      [
        [x, 126, 3, FLOOR - 126],
        [x + 34, 126, 3, FLOOR - 126],
        [x + 2, 128, 33, 3],
        [x + 2, 140, 33, 2],
      ] as Rect[],
  ),
);
/** The portaloos beyond the queue, against hall B's first pier. */
const LOO_X = [Z.club + 8, Z.club + 40] as const;
const LOOS = bevelPaths(LOO_X.map((x) => [x, FLOOR - 74, 28, 74] as Rect));
const LOO_ROOFS = pxPath(LOO_X.map((x) => [x - 2, FLOOR - 78, 32, 4] as Rect));
const LOO_DOORS = pxPath(LOO_X.map((x) => [x + 4, FLOOR - 64, 20, 60] as Rect));
const LOO_LOCKS = pxPath(LOO_X.map((x) => [x + 20, FLOOR - 40, 3, 5] as Rect));
const LOO_VENTS = pxPath(LOO_X.map((x) => [x + 8, FLOOR - 71, 12, 3] as Rect));

/* ---- the festoon strings -------------------------------------------------- */

/**
 * Three spans of festoon bulbs: hall A's corner to a pole by the bar, the
 * pole to the trailer, the trailer to the event board. Sagging catenaries via
 * steppedCable, bulbs hung off cableY every 26 px. The poles are their own
 * objects — scaffold standards with concrete feet, because somebody put them
 * up in April and will take them down in October.
 */
/** At the container's corner casting and by the board — never through the
 * lettering or the hatch, which the first placement managed to do to both. */
const POLE_X = [Z.bar + 226, Z.board - 62] as const;
const FEST_SPANS: [number, number, number, number, number][] = [
  [Z.gap - 12, 44, POLE_X[0], 52, 14],
  [POLE_X[0], 52, POLE_X[1], 56, 16],
  [POLE_X[1], 56, Z.club + 6, 48, 14],
];
const FEST_WIRES = pxPath(
  FEST_SPANS.flatMap(([x0, y0, x1, y1, sag]) => steppedCable(x0, y0, x1, y1, sag, 8)),
);
const FEST_BULB_PTS: [number, number][] = FEST_SPANS.flatMap(([x0, y0, x1, y1, sag]) => {
  const pts: [number, number][] = [];
  for (let x = x0 + 18; x < x1 - 8; x += 26) pts.push([x, cableY(x0, y0, x1, y1, sag, x) + 3]);
  return pts;
});
const FEST_BULBS = bulbPaths(FEST_BULB_PTS);
const FEST_POLES = pxPath(
  POLE_X.flatMap(
    (x) =>
      [
        [x - 2, 48, 4, FLOOR - 48],
        [x - 8, FLOOR - 8, 16, 8],
      ] as Rect[],
  ),
);

/* ---- bulkhead lamps on the brick ------------------------------------------ */

/** On the piers and on hall B's blank wall — never in front of the glass. */
const BULKHEAD_X = [365, 487, Z.club + 190] as const;
const BULKHEADS = pxPath(
  BULKHEAD_X.flatMap(
    (x) =>
      [
        [x - 5, 58, 10, 6],
        [x - 3, 64, 6, 2],
      ] as Rect[],
  ),
);

/* ---- shadows and contact -------------------------------------------------- */

const CONTACTS = contactPaths([
  [CONT[0] + 2, CONT[2] - 4, FLOOR] as const,
  [TRAIL[0] + 4, TRAIL[2] - 8, FLOOR] as const,
  [GEN[0], GEN[2], FLOOR - 4] as const,
  [BOARD[0] + 6, 8, FLOOR] as const,
  [Z.board + 33, 8, FLOOR] as const,
  [LOO_X[0], 28, FLOOR] as const,
  [LOO_X[1], 28, FLOOR] as const,
  [Z.crane - 20, 46, FLOOR - 4] as const,
]);
const BARREL_CONTACTS = contactPaths(BARREL_X.map((x, i) => [x - 11, 22, BARREL_Y[i]] as const));
const HALL_AO = aoPaths([
  [HA.x0, FLOOR - 2, HA.x1 - HA.x0] as const,
  [HB.x0, FLOOR - 2, HB.x1 - HB.x0] as const,
]);

/* ================================================================== *
 * light — precomputed tiers for everything that glows
 * ================================================================== */

/** The festoon: pools on the concrete under each span's low point. */
const FEST_POOLS = tiers(
  (k) =>
    FEST_SPANS.flatMap(([x0, , x1]) => {
      const cx = Math.round((x0 + x1) / 2);
      return steppedEllipse(cx, 160, Math.round(((x1 - x0) / 2 + 10) * k), Math.round(12 * k), 2);
    }),
  "w",
  1.1,
);
/** The neon's wash on the pavement and the queue. */
/**
 * The neon's wash on the pavement — magenta, so it cannot come from tiers()
 * (which only knows the four house tints): two stepped ellipses in the neon's
 * own colours, accumulated the same way.
 */
const NEON_POOL_WIDE = pxPath(steppedEllipse(Z.door, 158, 90, 13, 2));
const NEON_POOL_CORE = pxPath(steppedEllipse(Z.door, 158, 52, 9, 2));
/** The studio hall's cyan panes land a lattice on the street. */
const CYAN_POOL = tiers(
  (k) =>
    HA_WIN.flatMap(([x, , w]) =>
      steppedEllipse(x + w / 2, 159, Math.round((w / 2 + 8) * k), Math.round(10 * k), 2),
    ),
  "c",
  0.8,
);
/** The bar hatch and the trailer hatch throw warm counters of light. */
const HATCH_POOL = tiers(
  (k) => steppedEllipse(Z.bar + 128, 160, Math.round(70 * k), Math.round(12 * k), 2),
  "w",
  1,
);
const TRAIL_POOL = tiers(
  (k) => steppedEllipse(Z.frytki + 62, 160, Math.round(52 * k), Math.round(11 * k), 2),
  "w",
  0.9,
);
/** The bulkhead lamps: sodium cones down the brick. */
const BULKHEAD_CONES = tiers(
  (k) =>
    BULKHEAD_X.flatMap((x) => steppedCone(x, 64, Math.round(6 * k), FLOOR, Math.round(26 * k), 6)),
  "e",
  0.9,
);
const BULKHEAD_GLOW = bulbPaths(BULKHEAD_X.map((x) => [x, 61] as [number, number]));
/** The door lamp's small pool where the bouncer stands. */
const DOOR_POOL = tiers(
  (k) => steppedEllipse(Z.door - 47, 156, Math.round(22 * k), Math.round(8 * k), 2),
  "w",
  0.8,
);

const VIGNETTE = vignettePaths(W, H);

/* ================================================================== *
 * MID plane component
 * ================================================================== */

function Halls({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const brick = BRICK[ph];
  const brickB = BRICKB[ph];
  const steel = STEEL[ph];
  const rust = RUST[ph];
  const dark = isDark(ph);
  const night = ph === "night";
  const studioLit = dark; // the studios work nights
  return (
    <g>
      {/* ---- the SKM stair and fence, far left --------------------------- */}
      <path d={SKM_POST} fill={steel.mid} />
      <path d={SKM_STAIR} fill={PLATE[ph].mid} />
      <path d={SKM_RAIL} fill={steel.base} />
      <path d={pxPath([SKM_SIGN])} fill="#0e3566" />
      <BigText
        x={SKM_SIGN[0] + 5}
        y={SKM_SIGN[1] + 3}
        text="SKM STOCZNIA"
        k={1}
        fill={K.white}
        op={0.95}
      />
      <path
        d={pxPath([[SKM_SIGN[0], SKM_SIGN[1] + 11, SKM_SIGN[2], 1]])}
        fill={K.white}
        opacity={0.4}
      />
      <path d={FENCE_A} fill={steel.lo} />

      {/* ---- the substation kiosk ----------------------------------------- */}
      <Bev set={TRAFO_SET} mat={brick} />
      <path d={TRAFO_ROOF} fill={rust.base} />
      <path d={TRAFO_DOOR} fill={CORR[ph].base} />
      <path d={TRAFO_DOOR_RIBS} fill={CORR[ph].deep} opacity={0.6} />
      <path d={pxPath([TRAFO_SIGN])} fill={K.cream} opacity={0.9} />
      <path d={TRAFO_BOLT} fill={K.ledRed} opacity={0.85} />
      <path d={TRAFO_CONDUIT} fill={steel.lo} />

      {/* ---- hall A -------------------------------------------------------- */}
      <Bev set={HA_BODY} mat={brick} />
      <path d={pxPath([[HA.x0, 0, HA.x1 - HA.x0, FLOOR]])} fill="url(#px-stucco)" />
      <path d={HA_COURSES} fill={brick.deep} opacity={0.3} />
      <path d={HA_PIERS} fill={brick.mid} />
      <path d={HA_PIER_EDGE} fill={brick.deep} opacity={0.6} />
      <path d={HA_BAND} fill={brick.deep} opacity={0.5} />
      {/* the ghost of STOCZNIA GDANSKA in whitewash on the lintel band */}
      <BigText
        x={HA.x0 + 96}
        y={8}
        text="WYDZIAL ELEKTRYCZNY W-4"
        k={2}
        fill={K.cream}
        op={dark ? 0.13 : 0.22}
      />
      {/* the bricked-in first bay, and the mural on it */}
      <path d={BAY1_INFILL} fill={brick.lo} />
      <path d={BAY1_JOINTS} fill={brick.deep} opacity={0.3} />
      <path d={BAY1_ARCH} fill={brick.mid} />
      <path d={MURAL_FIELD} fill={K.mural1} opacity={dark ? 0.5 : 0.75} />
      <path d={MURAL_HULL} fill={K.mural2} opacity={dark ? 0.6 : 0.9} />
      <path d={MURAL_SUPER} fill={K.mural3} opacity={dark ? 0.45 : 0.7} />
      <path d={MURAL_PORTHOLES} fill={K.posterInk} opacity={0.7} />
      <path d={MURAL_HOOK} fill={K.posterInk} opacity={0.8} />
      <path d={MURAL_TUG} fill={K.posterInk} opacity={0.85} />
      <path d={MURAL_WAVES} fill={K.mural3} opacity={dark ? 0.35 : 0.55} />
      <path d={MURAL_GULLS} fill={K.mural3} opacity={dark ? 0.35 : 0.6} />
      <path d={MURAL_WEAR} fill={brick.base} opacity={0.55} />
      {/* the windows */}
      <path d={HA_WIN_GLASS} fill={studioLit ? "#173a40" : K.glassDark} />
      {studioLit ? (
        <>
          <path d={HA_WIN_GLASS} fill={K.cyanDeep} opacity={0.45} />
          <path
            d={pxPath(HA_WIN.map(([x, y, w]) => [x + 8, y + 10, w - 30, 18] as Rect))}
            fill={K.cyan}
            opacity={0.3}
          />
        </>
      ) : (
        <path
          d={pxPath(HA_WIN.map(([x, y, w]) => [x + 6, y + 4, w - 40, 12] as Rect))}
          fill="#5a6a78"
          opacity={0.3}
        />
      )}
      <path d={HA_WIN_LATTICE} fill={steel.deep} />
      <path d={HA_WIN_ARCH} fill={brick.mid} />
      <path d={HA_WIN_BOARD} fill={WOOD[ph].base} />
      <path d={HA_WIN_BROKEN} fill={night ? "#0d1014" : "#2a3038"} />
      <path d={HA_SILLS} fill={brick.hi} />
      {/* rainwater goods and the damp they made */}
      <path d={HA_DAMP} fill={dth("n", "25")} opacity={0.5} />
      <path d={HA_PIPES} fill={rust.mid} />
      {/* the poster drift */}
      <path d={POSTERS_OLD} fill={K.posterOld} opacity={0.85} />
      <path d={POSTERS_MID} fill={K.poster} opacity={0.9} />
      <path d={pxPath(POSTERS_NEW)} fill={K.white} />
      <path d={POSTERS_ART} fill={K.posterPink} opacity={0.85} />
      <path
        d={pxPath([
          [POSTERS_NEW[0][0] + 4, POSTERS_NEW[0][1] + 30, 24, 2],
          [POSTERS_NEW[1][0] + 4, POSTERS_NEW[1][1] + 30, 20, 2],
        ])}
        fill={K.posterInk}
        opacity={0.8}
      />
      <path d={POSTERS_TORN} fill={brick.base} />
      <path d={HA_PLINTH} fill={dth("n", "12")} opacity={0.5} />
      <path d={HA_MOSS} fill={K.weeds} opacity={0.4} />

      {/* ---- the gap: spur wall, the gate in it, razor wire, pipe bridge ---- */}
      <path d={GAP_SPUR} fill={brick.lo} />
      <path d={GAP_SPUR_TOP} fill={brick.hi} />
      <path d={GAP_SPUR_COURSES} fill={brick.deep} opacity={0.3} />
      <path d={GAP_RAZOR} fill={steel.base} opacity={0.7} />
      <Bev set={GATE_SET} mat={CORR[ph]} />
      <path d={GATE_RIBS} fill={CORR[ph].deep} opacity={0.55} />
      <path d={GATE_SPLIT} fill="#000" opacity={0.4} />
      <path d={GATE_CHAIN} fill={steel.base} />
      <path d={pxPath([GATE_SIGN])} fill={K.cream} opacity={0.85} />
      <BigText
        x={GATE_SIGN[0] + 4}
        y={GATE_SIGN[1] + 3}
        text="TEREN STOCZNI"
        k={1}
        fill={K.posterInk}
        op={0.8}
      />
      <path d={SMOKE_RAIL} fill={steel.mid} />
      <path d={SMOKE_BUCKET} fill={M.enamel.base} />
      <path d={BRIDGE_TRUSS} fill={rust.lo} />
      <path d={BRIDGE_PIPES} fill={rust.base} />
      <path d={BRIDGE_LAGGING} fill={M.linen.lo} opacity={0.8} />

      {/* ---- hall B and the club face -------------------------------------- */}
      <Bev set={HB_BODY} mat={brickB} />
      <path d={pxPath([[HB.x0, 0, HB.x1 - HB.x0, FLOOR]])} fill="url(#px-roller)" />
      <path d={HB_COURSES} fill={brickB.deep} opacity={0.25} />
      <path d={HB_PIERS} fill={brickB.mid} />
      <path d={HB_GHOSTS} fill={brickB.lo} />
      <path d={HB_GHOST_ARCH} fill={brickB.mid} />
      <path d={HB_GHOST_INFILL} fill={brickB.deep} opacity={0.4} />
      {/* the door */}
      <path d={DOOR_HEAD} fill={brickB.deep} />
      <Bev set={DOOR_SET} mat={M.graphite} />
      <path d={DOOR_SPLIT} fill="#000" opacity={0.5} />
      <path d={DOOR_PUSHBAR} fill={STEEL[ph].base} />
      <path d={DOOR_PORTHOLES} fill={clubOn(s) ? "#3a1030" : "#15171b"} />
      <path d={DOOR_STEP} fill={M.enamel.base} opacity={0.6} />
      <path d={DOOR_LAMP} fill={M.graphite.base} />
      <path d={DOOR_CCTV} fill={M.graphite.mid} />
      {/* the neon frame; the tubes are painted in Effects so they can flicker */}
      <path d={NEON_FRAME} fill="#17191d" />
      <path d={NEON_MOUNT} fill={M.graphite.lo} />
      {!dark ? (
        /* by day the neon is grey glass — you can read it but it is asleep */
        <BigText x={NEON_TEXT_X} y={NEON_TEXT_Y} text="TURBINA" k={3} fill="#4e5860" op={0.9} />
      ) : null}
      {/* the rules board */}
      <path d={pxPath([RULES_BOARD])} fill={K.cream} opacity={0.9} />
      <path
        d={pxPath([
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 4, 20, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 9, 16, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 14, 18, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 19, 12, 2],
          [RULES_BOARD[0] + 3, RULES_BOARD[1] + 26, 20, 3],
        ])}
        fill={K.posterInk}
        opacity={0.7}
      />
      {/* the dock fence past everything */}
      <path d={DOCK_FENCE} fill={steel.lo} />

      {/* bulkhead lamp housings (their light lives in Effects) */}
      <path d={BULKHEADS} fill={M.graphite.base} />

      <AOSet set={HALL_AO} op={0.35} />
    </g>
  );
}

/* ================================================================== *
 * STATIC plane component
 * ================================================================== */

function Furniture({ ph, s }: { ph: Ph; s: ElektrykowState }) {
  const steel = STEEL[ph];
  const dark = isDark(ph);
  const barOpen = s.bar === "open";
  const frytOpen = s.frytki === "open";
  return (
    <g>
      <Contact set={CONTACTS} op={0.45} />

      {/* ---- the container bar --------------------------------------------- */}
      <Bev set={CONT_SET} mat={CORR[ph]} />
      <path d={CONT_CORR} fill={CORR[ph].deep} opacity={0.45} />
      <path d={CONT_CORNERS} fill={CORR[ph].lo} />
      {/* rust streaks off the roof seams — it has wintered here */}
      <path
        d={pxPath([
          [CONT[0] + 34, CONT[1] + 4, 3, 26],
          [CONT[0] + 190, CONT[1] + 4, 3, 34],
        ])}
        fill={K.rustDeep}
        opacity={0.5}
      />
      <BigText
        x={Z.bar + 82}
        y={BAR_SIGN_Y}
        text="BAR PRAD"
        k={2}
        fill={dark ? K.bulbHi : K.cream}
        op={dark ? 0.95 : 0.8}
      />
      {barOpen ? (
        <>
          <path d={HATCH_DARK} fill="#241d14" />
          <path d={HATCH_SHELVES} fill={M.wood.mid} />
          <path
            d={HATCH_BOTTLES}
            fill={dark ? K.ledAmber : "#8a7448"}
            opacity={dark ? 0.85 : 0.7}
          />
          <path d={HATCH_FLAP} fill={CORR[ph].hi} />
          <path d={HATCH_COUNTER} fill={M.wood.base} />
          <path d={HATCH_TAPS} fill={steel.hi} />
          <path d={HATCH_CUPS} fill={K.white} opacity={0.85} />
        </>
      ) : (
        <>
          <path d={HATCH_SHUT} fill={CORR[ph].lo} />
          <path d={HATCH_SHUT_RIBS} fill={CORR[ph].deep} opacity={0.6} />
          <path d={pxPath([[Z.bar + 124, HATCH[1] + HATCH[3] - 6, 8, 8]])} fill={steel.deep} />
        </>
      )}
      <path d={pxPath([BAR_MENU])} fill={K.menuBoard} />
      <path d={BAR_MENU_LINES} fill={K.chalk} opacity={barOpen ? 0.75 : 0.3} />

      {/* ---- barrels and pallets -------------------------------------------- */}
      <Contact set={BARREL_CONTACTS} op={0.4} />
      {BARRELS.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed barrel list
        <Bev key={i} set={b} mat={RUST[ph]} />
      ))}
      <path d={BARREL_RINGS} fill={RUST[ph].deep} opacity={0.8} />
      {s.crowd >= 1 ? <path d={BARREL_TOPS} fill={K.white} opacity={0.8} /> : null}
      <path d={PALLETS} fill={WOOD[ph].base} />
      <path d={pxPath([[Z.smoke - 76, FLOOR - 20, 44, 1]])} fill={WOOD[ph].hi} />

      {/* ---- the frytki trailer ---------------------------------------------- */}
      <Bev set={TRAIL_SET} mat={TRAILER[ph]} />
      <path d={TRAIL_WHEEL} fill="#2a2d33" />
      <path d={TRAIL_JACK} fill={steel.mid} />
      {/* the fryer's flue on the roof — the steam in Effects rises off it */}
      <path d={pxPath([[TRAIL[0] + 97, TRAIL[1] - 6, 5, 6]])} fill={steel.lo} />
      {frytOpen ? (
        <>
          <path d={pxPath([TRAIL_HATCH])} fill="#2b2118" />
          <path d={TRAIL_FRYER} fill={steel.base} />
          <path d={TRAIL_BOTTLES} fill={K.ketchup} />
          <path d={pxPath([[TRAIL_HATCH[0] + 20, TRAIL_HATCH[1] + 24, 5, 9]])} fill={K.frytki} />
          <path d={TRAIL_COUNTER} fill={M.laminate.base} />
        </>
      ) : (
        <>
          <path d={TRAIL_SHUT} fill={TRAILER[ph].lo} />
          <path d={TRAIL_SHUT_RIBS} fill={TRAILER[ph].deep} opacity={0.5} />
        </>
      )}
      <path d={TRAIL_AWNING} fill={K.ketchup} opacity={0.9} />
      <path
        d={pxPath(repeat(6, 16, [TRAIL_HATCH[0] + 2, TRAIL_HATCH[1] - 5, 8, 3] as Rect))}
        fill={K.white}
        opacity={0.85}
      />
      {/* the name, white on the awning band — where a trailer keeps its name */}
      <BigText
        x={TRAIL_SIGN_X}
        y={TRAIL_HATCH[1] - 11}
        text="FRYTKI"
        k={1}
        fill={K.white}
        op={0.95}
      />
      <path d={pxPath([TRAIL_MENU])} fill={K.menuBoard} />
      <path
        d={pxPath([
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 5, 10, 2],
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 11, 8, 2],
          [TRAIL_MENU[0] + 3, TRAIL_MENU[1] + 17, 10, 2],
        ])}
        fill={K.chalk}
        opacity={0.6}
      />
      <path d={PICNIC} fill={WOOD[ph].base} />
      <Bev set={GEN_SET} mat={M.enamel} />
      <path d={GEN_VENTS} fill={M.enamel.deep} />
      <path d={GEN_LED} fill={frytOpen || s.bar === "open" ? K.ledGreen : K.ledRed} />

      {/* ---- the yard --------------------------------------------------------- */}
      <path d={CRANE_LEG} fill={steel.lo} />
      <path d={pxPath([[Z.crane - 14, 0, 3, FLOOR - 4]])} fill={steel.base} />
      <path d={CRANE_LEG_PLATE} fill={K.cream} opacity={0.8} />
      <BigText x={Z.crane - 5} y={99} text="K-1" k={1} fill={K.posterInk} op={0.8} />
      <Bev set={BOARD_SET} mat={M.graphite} />
      <path d={BOARD_LEGS} fill={steel.mid} />
      <path d={BOARD_PAPER} fill={K.white} opacity={0.95} />
      <path d={BOARD_ART} fill={K.neonDeep} opacity={0.85} />
      <BigText x={BOARD[0] + 12} y={BOARD[1] + 14} text="LATO NA" k={1} fill={K.white} op={0.9} />
      <BigText x={BOARD[0] + 12} y={BOARD[1] + 21} text="STOCZNI" k={1} fill={K.white} op={0.9} />
      <path d={BOARD_TEAR} fill={K.posterOld} />
      <path d={BIKES} fill="#3f6f52" opacity={0.9} />

      {/* ---- the queue and the loos ------------------------------------------- */}
      <path d={BARRIERS} fill={steel.base} />
      <path
        d={pxPath(BARRIER_X.map((x) => [x + 2, 133, 33, 4] as Rect))}
        fill={K.hiVis}
        opacity={0.35}
      />
      <path d={ABOARD} fill={K.menuBoard} />
      <path d={ABOARD_CHALK} fill={K.chalk} opacity={0.7} />
      <Bev set={LOOS} mat={M.teal} />
      <path d={LOO_ROOFS} fill={M.teal.deep} />
      <path d={LOO_DOORS} fill={M.teal.lo} />
      <path d={LOO_LOCKS} fill={s.queue >= 2 ? K.ledRed : K.ledGreen} />
      <path d={LOO_VENTS} fill={M.teal.deep} />

      {/* ---- festoon hardware (the light itself lives in Effects) ------------- */}
      <path d={FEST_POLES} fill={steel.mid} />
      <path d={FEST_WIRES} fill={K.cable} />
    </g>
  );
}

/* ================================================================== *
 * the scene component
 * ================================================================== */

function ElektrykowScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = elektrykowState(world, ph);
  return (
    <LayeredScene
      farBackground={<FarPlane ph={ph} />}
      middleBackground={<Halls ph={ph} s={s} />}
      ground={<Ground ph={ph} s={s} />}
      staticObjects={<Furniture ph={ph} s={s} />}
      parallax={{ farBackground: 0.88, middleBackground: 1 }}
    />
  );
}

/* ================================================================== *
 * EFFECTS — the people and the light
 * ================================================================== */

/**
 * The man dancing alone by the bar, drawn by hand because the NPC rig cannot
 * dance and he can. Two poses on a discrete flip, arms in two places, weight
 * on alternating feet — the universal shuffle of a man who has decided the
 * night is good. He is the scene's "what is that guy doing" and the answer is:
 * exactly what it looks like.
 */
function SoloDancer({ x, night }: { x: number; night: boolean }) {
  const skin = night ? "#8a7566" : "#a98d78";
  const top = night ? "#33404e" : "#455568";
  const feet = FLOOR;
  const headY = feet - 62;
  return (
    <g>
      <g>
        {/* pose A */}
        <path
          d={pxPath([
            [x - 4, headY, 9, 9], // head
            [x - 7, headY + 9, 15, 22], // torso
            [x - 13, headY + 6, 6, 3], // left arm up-out
            [x - 15, headY + 1, 4, 6],
            [x + 8, headY + 14, 6, 3], // right arm out
            [x - 6, headY + 31, 5, feet - headY - 31], // legs apart
            [x + 3, headY + 31, 5, feet - headY - 31],
          ])}
          fill={top}
          opacity={1}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0;1;0"
            dur="0.92s"
            repeatCount="indefinite"
          />
        </path>
        {/* pose B */}
        <path
          d={pxPath([
            [x - 4, headY + 2, 9, 9],
            [x - 7, headY + 11, 15, 22],
            [x + 8, headY + 4, 6, 3], // right arm up
            [x + 11, headY - 2, 4, 6],
            [x - 12, headY + 16, 6, 3], // left arm out
            [x - 4, headY + 33, 5, feet - headY - 33],
            [x + 2, headY + 33, 5, feet - headY - 33],
          ])}
          fill={top}
          opacity={0}
        >
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;1;0;1"
            dur="0.92s"
            repeatCount="indefinite"
          />
        </path>
        {/* the head and hands stay skin in both poses */}
        <path d={pxPath([[x - 3, headY + 1, 7, 8]])} fill={skin} />
        <path d={pxPath([[x - 4, headY, 9, 3]])} fill="#2b2521" />
      </g>
      {/* his shadow keeps the beat with him */}
      <path d={pxPath([[x - 8, feet - 1, 17, 2]])} fill="#171009" opacity={0.2}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.2;0.12;0.2;0.12"
          dur="0.92s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

const PHILOSOPHER_LINES = [
  "Kiedyś tu spawali statki. Teraz spawamy się my.",
  "To nie jest upadek przemysłu. To jest zmiana zmiany.",
  "Trzymam ścianę. Ktoś musi.",
] as const;
const STARER_LINES = ["...", "Ta cegła. Patrz na tę cegłę.", "Wszystko się zgadza."] as const;
const QUEUE_LINES = [
  "Mówią, że selekcja dzisiaj ostra.",
  "Stoimy dwadzieścia minut. Bas czuć w barierkach.",
  "Jak nas nie wpuszczą, idziemy na frytki i też będzie dobrze.",
] as const;
const BARMAN_LINES = [
  "Grzaniec się kończy, mówię od razu.",
  "Kubek zwrotny. Kaucja pięć złotych. Taki świat.",
] as const;
const FRYTKARZ_LINES = [
  "Świeży olej od siedemnastej!",
  "Majonez czy ketchup? Nie ma 'i to i to'. Jest 'i to i to' za złotówkę.",
] as const;

function ElektrykowEffects({
  world,
  phase,
  scale,
  actionUi,
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
  const s = elektrykowState(world, ph);
  const night = ph === "night";
  const dark = isDark(ph);
  const fest = festoonOn(s, ph);
  const club = clubOn(s);
  return (
    <>
      {/* the street's people, built from the NPC rig */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {/* the bouncer, planted by the door whenever the club is running */}
        {club || s.club === "prep" ? (
          <NpcActor npc={NPCS.bramkarz} objId="bramkarz" x={Z.door - 58} facing={1} />
        ) : null}
        {/* the queue: two of them at crowd, one at dusk */}
        {s.queue >= 1 ? (
          <NpcActor npc={NPCS.raverka} objId="queue-girl" x={Z.queue + 18} facing={1} />
        ) : null}
        {s.queue >= 2 ? <NpcActor npc={NPCS.caller} x={Z.queue + 62} facing={1} /> : null}
        {/* the barman in his hatch, cut off at the counter */}
        {s.bar === "open" ? (
          <NpcActor
            npc={NPCS.barmanka}
            objId="bar-prad"
            x={Z.bar + 128}
            facing={-1}
            shadow={false}
            cropBelow={HATCH[1] + HATCH[3]}
          />
        ) : null}
        {/* the frytkarz in his trailer */}
        {s.frytki === "open" ? (
          <NpcActor
            npc={NPCS.frytkarz}
            objId="frytki-stand"
            x={Z.frytki + 62}
            facing={-1}
            shadow={false}
            cropBelow={TRAIL_HATCH[1] + TRAIL_HATCH[3]}
          />
        ) : null}
        {/* the philosopher holding up hall A */}
        {s.crowd >= 1 ? (
          <NpcActor npc={NPCS.filozof} objId="filozof" x={Z.smoke - 40} facing={1} />
        ) : null}
        {/* the man communing with the brickwork. He is fine. Probably. */}
        {s.crowd >= 2 ? (
          <NpcActor npc={NPCS.starer} objId="starer" x={Z.mural + 58} facing={1} />
        ) : null}
        {/* the solo dancer, hand-animated */}
        {s.crowd >= 2 ? <SoloDancer x={Z.bar + 220} night={night} /> : null}
      </svg>

      {/* what they say, unprompted */}
      {s.crowd >= 1 && !dialogueOpen ? (
        <NpcMonologue
          x={Z.smoke - 40}
          headY={84}
          scale={scale}
          speaker="Filozof"
          lines={PHILOSOPHER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.crowd >= 2 ? (
        <NpcMonologue
          x={Z.mural + 58}
          headY={84}
          scale={scale}
          speaker="Ten Gość"
          lines={STARER_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.queue >= 1 ? (
        <NpcMonologue
          x={Z.queue + 18}
          headY={84}
          scale={scale}
          speaker="Dziewczyna z kolejki"
          lines={QUEUE_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.bar === "open" ? (
        <NpcMonologue
          x={Z.bar + 128}
          headY={HATCH[1] + 4}
          scale={scale}
          speaker="Barmanka"
          lines={BARMAN_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.frytki === "open" ? (
        <NpcMonologue
          x={Z.frytki + 62}
          headY={TRAIL_HATCH[1] + 4}
          scale={scale}
          speaker="Frytkarz"
          lines={FRYTKARZ_LINES}
          muted={dialogueOpen}
        />
      ) : null}

      {/* the light */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/* the hour's cast over everything */}
          <rect
            width={W}
            height={H}
            fill={
              ph === "night"
                ? NIGHT_CAST
                : ph === "dusk"
                  ? DUSK_CAST
                  : ph === "dawn"
                    ? DAWN_CAST
                    : "#000"
            }
            opacity={ph === "night" ? 0.22 : ph === "dusk" ? 0.1 : ph === "dawn" ? 0.08 : 0}
            style={{ transition: STEP_FADE }}
          />

          {/* festoon bulbs and their pools */}
          <g opacity={fest ? 1 : 0} style={{ transition: STEP_FADE }}>
            <path d={FEST_BULBS.halo} fill={dth("w", "12")} opacity={0.5} />
            <path d={FEST_BULBS.core} fill={K.bulbHi} opacity={0.95} />
            <Light set={FEST_POOLS} op={dark ? 1 : 0.25} />
          </g>

          {/* the studio hall's cyan lattice on the street */}
          {dark ? <Light set={CYAN_POOL} /> : null}

          {/* bulkhead sodium lamps down the brick */}
          {dark ? (
            <>
              <Light set={BULKHEAD_CONES} />
              <path d={BULKHEAD_GLOW.halo} fill={dth("e", "12")} opacity={0.4} />
              <path d={BULKHEAD_GLOW.core} fill={K.sodium} opacity={0.9} />
            </>
          ) : null}

          {/* the hatches' warm counters */}
          {s.bar === "open" ? <Light set={HATCH_POOL} op={dark ? 1 : 0.25} /> : null}
          {s.frytki === "open" ? <Light set={TRAIL_POOL} op={dark ? 1 : 0.25} /> : null}
          {club || s.club === "prep" ? <Light set={DOOR_POOL} op={dark ? 1 : 0.2} /> : null}

          {/* the neon, lit: deep tube, bright core, the R dropping out */}
          {dark ? (
            <g>
              <BigText
                x={NEON_TEXT_X + 1}
                y={NEON_TEXT_Y + 1}
                text="TURBINA"
                k={3}
                fill={K.neonDeep}
                op={0.9}
              />
              <BigText x={NEON_TEXT_X} y={NEON_TEXT_Y} text="TURBINA" k={3} fill={K.neon} />
              {/* the sick letter: a patch over the R that flickers it off */}
              <g>
                <path
                  d={pxPath([[NEON_TEXT_X + 36, NEON_TEXT_Y - 2, 14, 18]])}
                  fill="#17191d"
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0;0;0;0.85;0;0;0.85;0;0"
                    dur="7.3s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
              <path d={NEON_POOL_WIDE} fill={K.neonDeep} opacity={0.1} />
              <path d={NEON_POOL_CORE} fill={K.neon} opacity={0.12} />
              {/* the neon's wash up the brick around the frame */}
              <path d={pxPath([[Z.door - 78, 28, 156, 44]])} fill={K.neon} opacity={0.08} />
            </g>
          ) : null}

          {/* the club leaking through the portholes: a slow strobe pulse */}
          {club ? (
            <g>
              <path d={DOOR_PORTHOLES} fill={K.neon} opacity={0.5}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.5;0.15;0.6;0.2;0.45;0.1"
                  dur="1.9s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={DOOR_PORTHOLES} fill={K.cyan} opacity={0}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;0.4;0;0;0.3;0"
                  dur="2.7s"
                  repeatCount="indefinite"
                />
              </path>
              {/* the bass you can see: the door seam breathing light */}
              <path d={pxPath([[Z.door - 1, DOOR[1], 2, DOOR[3]]])} fill={K.neon} opacity={0.2}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.2;0.5;0.2;0.45;0.2"
                  dur="0.96s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}

          {/* steam off the fryer's flue on the trailer roof — two breaths,
              each dead for most of its cycle so they never stack into a slab */}
          {s.frytki === "open"
            ? [0, 4.5].map((d) => (
                <path
                  key={d}
                  d={pxPath([
                    [TRAIL[0] + 96, TRAIL[1] - 6, 7, 4],
                    [TRAIL[0] + 99, TRAIL[1] - 10, 5, 4],
                  ])}
                  fill={dth("c", "25")}
                  opacity={0}
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.45;0.2;0;0;0"
                    begin={`${d}s`}
                    dur="9s"
                    repeatCount="indefinite"
                  />
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0 0;2 -6;4 -12;5 -16;5 -16;5 -16"
                    begin={`${d}s`}
                    dur="9s"
                    repeatCount="indefinite"
                  />
                </path>
              ))
            : null}

          {/* cigarette embers at the smoking corner and by the dock fence */}
          {dark && s.crowd >= 1 ? (
            <>
              <path d={pxPath([[Z.smoke - 34, 106, 2, 2]])} fill={K.sodium}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.9;0.25;0.25;0.9"
                  dur="3.4s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={pxPath([[Z.smokeYard - 6, 104, 2, 2]])} fill={K.sodium}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.25;0.9;0.25;0.25"
                  dur="4.1s"
                  repeatCount="indefinite"
                />
              </path>
            </>
          ) : null}

          {/* the generator's breath, cold mornings */}
          {ph === "dawn" && (s.bar === "open" || s.frytki === "open") ? (
            <path d={pxPath([[GEN[0] + 30, GEN[1] - 6, 6, 4]])} fill={dth("c", "25")} opacity={0.4}>
              <animate
                attributeName="opacity"
                values="0.4;0.1;0.35;0.15"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}

          {/* --- transients: what the player is doing, never in artKey ------- */}
          {actionUi === "smoke" ? (
            <path d={pxPath([[Z.smoke + 4, 100, 2, 2]])} fill={K.white} opacity={0.5} />
          ) : null}

          <Vignette set={VIGNETTE} strength={night ? 0.5 : 0.15} />
        </g>
      </svg>
    </>
  );
}

/* ================================================================== *
 * definition
 * ================================================================== */

export const ELEKTRYKOW_SCENE: RuntimeSceneDef<WorldState> = {
  id: "elektrykow",
  width: W,
  spawnX: 120,
  /**
   * The street is a walkable band, not a line: 150 is the building line where
   * the doors, hatches and signs live; 170 the nearest plate course. The rails
   * are set flush — you walk over them, which is the point of them.
   */
  ground: {
    top: FLOOR,
    bottom: BAND_BOT,
    blockers: [
      /* the barrel tables — you walk around a table, not through it */
      ...BARREL_X.map((x, i) => ({
        x0: x - 12,
        y0: BARREL_Y[i] - 8,
        x1: x + 12,
        y1: BARREL_Y[i] + 2,
      })),
      /* the picnic table */
      { x0: Z.frytki + 146, y0: 150, x1: Z.frytki + 202, y1: 160 },
      /* the generator */
      { x0: GEN[0] - 2, y0: FLOOR - 6, x1: GEN[0] + GEN[2] + 2, y1: FLOOR + 2 },
      /* the crane leg's bogie beam */
      { x0: Z.crane - 22, y0: FLOOR - 6, x1: Z.crane + 26, y1: FLOOR + 2 },
      /* the bike pile */
      { x0: Z.board + 52, y0: FLOOR - 4, x1: Z.board + 106, y1: FLOOR + 4 },
    ],
  },
  /** Every world read the art performs, and nothing else. */
  artKey: (w, ph) => {
    const p = toPhase(ph);
    const s = elektrykowState(w, p);
    return [ph, s.club, s.bar, s.frytki, s.crowd, s.queue, s.festoon].join("|");
  },
  /**
   * People drifting: one walker doing the bar–club circuit, one doing the
   * frytki run, both only when the street is awake. Stepped by the loop, so
   * they depth-sort against the player in the band.
   */
  actors: [
    npcToActor(NPCS.spacer, {
      x: Z.bar + 40,
      y: 162,
      patrol: { from: Z.bar - 60, to: Z.queue - 30, speed: 17, pauseMs: 3600 },
      visible: (world) => elektrykowState(world as WorldState, phNow()).crowd >= 2,
      z: 6,
    }),
    npcToActor(NPCS.spacerka, {
      x: Z.frytki - 80,
      y: 156,
      facing: -1,
      patrol: { from: Z.gap - 40, to: Z.frytki + 60, speed: 13, pauseMs: 5200 },
      visible: (world) => elektrykowState(world as WorldState, phNow()).crowd >= 1,
      z: 6,
    }),
  ],
  describe:
    "Ulica Elektryków: a shipyard street at night — brick halls, container bars, festoon lights, a queue outside the club under a magenta neon, cranes on the skyline.",
  objects: [
    /* --- the way in and out: the SKM stair --- */
    { id: "elektrykow-skm", kind: "trainDoor", priority: 2, x: Z.skm, range: 34 },
    { id: "elektrykow-fence", kind: "flavor", x: Z.skm + 74, range: 18 },
    /* --- the electricians' street --- */
    { id: "trafo-kiosk", kind: "flavor", x: Z.trafo, range: 26 },
    { id: "trafo-sign", kind: "flavor", x: Z.trafo + 4, range: 10, markerY: 78 },
    { id: "hala-posters", kind: "flavor", x: 420, range: 30 },
    { id: "hala-gate", kind: "flavor", x: Z.gate, range: 24 },
    { id: "hala-windows", kind: "flavor", x: 540, range: 40, markerY: 60 },
    { id: "hala-mural", kind: "flavor", x: Z.mural, range: 40, markerY: 66 },
    {
      id: "starer",
      kind: "npc",
      priority: 2,
      x: Z.mural + 58,
      range: 16,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 2,
    },
    /* --- the gap --- */
    { id: "pipe-bridge", kind: "flavor", x: Z.gap + 12, range: 24, markerY: 40 },
    {
      id: "filozof",
      kind: "npc",
      priority: 2,
      x: Z.smoke - 40,
      range: 16,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 1,
    },
    { id: "pallet-bench", kind: "sport", action: "sit", face: 1, x: Z.smoke - 54, range: 20 },
    { id: "smoke-corner", kind: "sport", action: "smoke", x: Z.smoke, range: 20 },
    /* --- the bar --- */
    { id: "bar-menu", kind: "flavor", x: Z.bar + 34, range: 16 },
    { id: "bar-prad", kind: "barman", priority: 2, x: Z.bar + 128, range: 30 },
    { id: "barrel-1", kind: "flavor", x: BARREL_X[0], y: BARREL_Y[0], range: 16 },
    {
      id: "solo-dancer",
      kind: "flavor",
      x: Z.bar + 220,
      range: 20,
      when: (w) => elektrykowState(w as WorldState, phNow()).crowd >= 2,
    },
    /* --- the frytki --- */
    { id: "frytki-stand", kind: "frytki", priority: 2, x: Z.frytki + 62, range: 30 },
    { id: "frytki-menu", kind: "flavor", x: Z.frytki + 114, range: 12 },
    {
      id: "picnic-table",
      kind: "sport",
      action: "sit",
      face: -1,
      x: Z.frytki + 174,
      y: 158,
      range: 22,
    },
    { id: "generator", kind: "flavor", x: GEN[0] + 17, range: 18 },
    /* --- the yard --- */
    { id: "event-board", kind: "flavor", x: Z.board, range: 30, markerY: 64 },
    { id: "bike-pile", kind: "flavor", x: Z.board + 80, range: 20 },
    { id: "yard-rails", kind: "flavor", x: Z.board + 140, y: 160, range: 22 },
    { id: "crane-leg", kind: "flavor", x: Z.crane, range: 28, markerY: 60 },
    { id: "yard-puddle", kind: "flavor", x: Z.board + 60, y: 164, range: 14 },
    /* --- the queue and the club --- */
    { id: "queue-barriers", kind: "flavor", x: Z.queue + 44, range: 30 },
    {
      id: "queue-girl",
      kind: "npc",
      priority: 2,
      x: Z.queue + 18,
      range: 14,
      when: (w) => elektrykowState(w as WorldState, phNow()).queue >= 1,
    },
    { id: "club-aboard", kind: "flavor", x: Z.queue - 22, range: 14 },
    {
      id: "bramkarz",
      kind: "npc",
      priority: 2,
      x: Z.door - 58,
      range: 18,
      when: (w) => {
        const s = elektrykowState(w as WorldState, phNow());
        return clubOn(s) || s.club === "prep";
      },
    },
    { id: "club-door", kind: "clubdoor", priority: 2, x: Z.door, range: 26 },
    { id: "club-neon", kind: "flavor", x: Z.door, range: 40, markerY: 40 },
    { id: "club-rules", kind: "flavor", x: RULES_BOARD[0] + 12, range: 14 },
    { id: "portaloo", kind: "portaloo", x: LOO_X[0] + 14, range: 20 },
    /* --- past the club --- */
    { id: "dock-fence", kind: "flavor", x: W - 30, range: 26 },
  ],
  Component: ({ world, phase }) => <ElektrykowScene world={world} phase={phase} />,
  /** Outdoors and self-lit: the sky and the sources do all of it. */
  darkness: () => 0,
  Effects: ElektrykowEffects,
  idleLean: true,
};
