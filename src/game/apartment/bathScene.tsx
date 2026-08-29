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
  type RuntimeSceneDef,
  repeat,
  type SceneRenderProps,
  SharedDefs,
  STEP_FADE,
  steppedCone,
  steppedEllipse,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { bandShade, courses, plates, scatter } from "@/engine/scene/groundKit";
import { type DayPhase, roomDarkness, type WorldState } from "@/lib/worldState";

// --- ŁAZIENKA / the bathroom, floor 4 -----------------------------------------------

/**
 * Third pass. Same room, rebuilt to the house standard, and given a state
 * machine per fixture instead of two booleans.
 *
 * Four planes, where there was effectively one:
 *   farBackground (1.0) — paint above the tile line, the tile field itself, the
 *     grout behind it, the damp bloom in the ceiling corner. Nothing here ever
 *     moves.
 *   middleBackground (1.0) — the wall's own fittings: the frosted window and
 *     whatever the sky is doing behind it, the two ceiling downlights, the
 *     round mirror with its LED halo, the extractor. The mirror is a plane of
 *     its own problem: it shows the opposite wall, and it fogs.
 *   ground (1.0) — anthracite floor, skirting, the drain, and every wet patch.
 *     All hitboxes resolve against this plane, at the original x positions.
 *   staticObjects (1.0) — the fixtures. Each one is a small state machine.
 *   Foreground (fixed) — the near edge: the underside of the ceiling, the robe
 *     on the back of the door hanging into frame, six pixels of near tile.
 *
 * The lighting premise, and it drives every branch below: this room has one
 * window and it is obscure glass, so it never gets an image of the outside,
 * only a flat wash whose colour is whatever hour it is. That wash is weak. So
 * for most of the day the room is lit by two ceiling LEDs and the mirror halo,
 * which means `lights.bath` matters more here than the phase does — the reverse
 * of the balcony. The two surfaces that own the frame (wall tile, floor tile)
 * are palette-shifted per phase rather than washed with a tint rect.
 *
 * All light is quantised: stepped cones off the downlights, a stepped ring for
 * the mirror halo, dithered edges, no gradients and no ellipses anywhere.
 *
 * STATE. Six fixtures now hold stages rather than flags, and every one of them
 * is read defensively — `world.bath` may not exist yet:
 *
 *   washer   off → fill → wash → spin → done   (legacy `washerOn` maps to wash)
 *   tub      empty → filling → full → draining
 *   fog      0 clear → 1 hazy → 2 fogged → 3 fogged, and drawn on
 *   towel    dry → damp → wet
 *   laundry  0 empty → 1 → 2 → 3 overflowing
 *   fern     0 thirsty → 1 → 2 lush
 *   paper    0 bare tube → 1 → 2 full
 *   lidUp, tapOn, spotTired — booleans, but each one changes real geometry
 *
 * ARTKEY. The art reads exactly the keys listed in `artKey` below and nothing
 * else. Add a world read, join it there in the same order, or the memoised
 * frame will go stale and you will spend an afternoon finding out why.
 *
 * TRANSIENTS. `actionUi` is not part of artKey and must not be, so anything
 * driven by an action in progress — the tap running, the shower, a flush —
 * lives in BathEffects, drawn over the top at the fixture's coordinates. The
 * art holds what is true when nobody is touching anything.
 *
 * Budget: ~320 nodes at the busiest stage combination, 28 animations declared
 * of which 12–16 mount at once. The tile field is two paths where it was ~60
 * rects; the floor is two where it was ~36. The inline <Bevel> calls are the
 * next thing to precompute if this ever needs to be cheaper — every one that
 * does not branch on state can move to module scope as bevelPaths + <Bev>.
 */

const W = 300;
const H = 180;

/* Landmark rows. A bathroom is a stack of horizontal bands and these are them. */
const CEIL = 42; // underside of the suspended ceiling
const TILE_TOP = 74; // where wall tile ends and paint begins
const SILL = 84; // window sill — the fern lives on it
const SKIRT = 146;
const FLOOR = 150; // floor tile surface
const CY = 149; // where contact shadows sit

/** Ceiling downlights. The left one is on its way out — see spotTired. */
const SPOTS = [106, 226] as const;

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
    dusk: dim(mat, DUSK_CAST, 0.15),
    night: dim(mat, NIGHT_CAST, 0.58),
  };
}

/** Large-format wall tile — cooler and glossier than the corridor's floor tile. */
const WALLTILE_MAT: Mat = {
  hi: "#ccd2d4",
  base: "#b9bfc2",
  mid: "#aeb4b7",
  lo: "#a4aaad",
  deep: "#8b9195",
};
const GROUT_MAT: Mat = {
  hi: "#a8aeb2",
  base: "#9aa0a4",
  mid: "#8f9599",
  lo: "#84898d",
  deep: "#6d7276",
};
/** Warm off-white emulsion above the tile line. */
const PAINT_MAT: Mat = {
  hi: "#e6e0d3",
  base: "#d9d2c4",
  mid: "#cec7b9",
  lo: "#c9c2b4",
  deep: "#aaa495",
};
/** Anthracite floor tile — darker than M.tile, which is the corridor's. */
const FLOORTILE_MAT: Mat = {
  hi: "#7f8589",
  base: "#6d7276",
  mid: "#63686c",
  lo: "#5a5f63",
  deep: "#474c50",
};
/** Sanitary ceramic. The only true white in the flat. */
const CERAMIC_MAT: Mat = {
  hi: "#f4f2ea",
  base: "#eceae2",
  mid: "#dedbd2",
  lo: "#cfccc2",
  deep: "#b4b1a8",
};
/** Matte black fittings — darker than M.graphite, which is skirting. */
const MATTE_MAT: Mat = {
  hi: "#4f5257",
  base: "#2b2d30",
  mid: "#26282b",
  lo: "#202225",
  deep: "#17181a",
};
const CHROME_MAT: Mat = {
  hi: "#e4e8ec",
  base: "#c9ced2",
  mid: "#b4b9bd",
  lo: "#9ba0a4",
  deep: "#7a7f83",
};
const FROSTED_MAT: Mat = {
  hi: "#e6efec",
  base: "#ccd6d4",
  mid: "#bfc9c7",
  lo: "#b0bab8",
  deep: "#96a09e",
};
const WICKER_MAT: Mat = {
  hi: "#b89a68",
  base: "#a08454",
  mid: "#937a4c",
  lo: "#84693e",
  deep: "#6a5330",
};

const LAMINATE = ramp(M.laminate);
const GRAPHITE = ramp(M.graphite);
const WICKER = ramp(WICKER_MAT);
const WALLTILE = ramp(WALLTILE_MAT);
const GROUT = ramp(GROUT_MAT);
const PAINT = ramp(PAINT_MAT);
const FLOORTILE = ramp(FLOORTILE_MAT);
const CERAMIC = ramp(CERAMIC_MAT);
const OAK = ramp(M.oak);
const CEILING = ramp({
  hi: "#efe9dc",
  base: "#e2dbcd",
  mid: "#d6cfc1",
  lo: "#cac3b5",
  deep: "#b0a99b",
});

const K = {
  /** what obscure glass does with the sky: no image, just a temperature */
  obscure: { dawn: "#c2c0d2", day: "#dde6e4", dusk: "#e0b48c", night: "#3a4250" } as Record<
    Ph,
    string
  >,
  led: "#ffe9b8",
  ledDead: "#8f8878",
  warm: "#ffd98a",
  /** standing water, and the same water lit */
  water: "#7fa8b8",
  waterHi: "#a8ccd8",
  waterDeep: "#4f7a8a",
  suds: "#dce8ec",
  foam: "#f0f6f8",
  /** the pink limescale that grows in the grout no matter what you buy */
  scale: "#b8a894",
  mould: "#4a4f42",
  sealant: "#d8d4c8",
  amber: "#c98a3f",
  towelTeal: "#5a8a8a",
  towelTealHi: "#6f9d9d",
  towelTealWet: "#3f6a6a",
  duck: "#e8c445",
  duckBeak: "#d9832f",
  hair: "#3a3128",
  glass: "#c2d6da",
  glassEdge: "#8fa6ac",
} as const;

/* ================================================================== *
 * state — every fixture is a stage, and none of the keys need exist
 * ================================================================== */

export type WasherStage = "off" | "fill" | "wash" | "spin" | "done";
export type TubStage = "empty" | "filling" | "full" | "draining";
export type Damp = "dry" | "damp" | "wet";

const WASHER_STAGES: readonly WasherStage[] = ["off", "fill", "wash", "spin", "done"];
const TUB_STAGES: readonly TubStage[] = ["empty", "filling", "full", "draining"];
const DAMP_STAGES: readonly Damp[] = ["dry", "damp", "wet"];

type BathState = {
  lit: boolean;
  washer: WasherStage;
  tub: TubStage;
  fog: 0 | 1 | 2 | 3;
  towel: Damp;
  laundry: 0 | 1 | 2 | 3;
  fern: 0 | 1 | 2;
  paper: 0 | 1 | 2;
  lidUp: boolean;
  tapOn: boolean;
  spotTired: boolean;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/**
 * `world.bath` may not exist, and `washerOn` still does — the old boolean maps
 * to the middle of the new cycle so a save from before this pass keeps working.
 */
function state(world: WorldState): BathState {
  const w = world as unknown as Record<string, unknown>;
  const b = (w.bath ?? {}) as Record<string, unknown>;
  const legacy = w.washerOn === true;
  return {
    lit: !!world.lights.bath,
    washer: clampStage(b.washer, WASHER_STAGES, legacy ? "wash" : "off"),
    tub: clampStage(b.tub, TUB_STAGES, "empty"),
    fog: clampInt(b.fog, 3, 0) as 0 | 1 | 2 | 3,
    towel: clampStage(b.towel, DAMP_STAGES, "dry"),
    laundry: clampInt(b.laundry, 3, 1) as 0 | 1 | 2 | 3,
    fern: clampInt(b.fern, 2, 1) as 0 | 1 | 2,
    paper: clampInt(b.paper, 2, 2) as 0 | 1 | 2,
    lidUp: b.lidUp === true,
    tapOn: b.tapOn === true,
    spotTired: b.spotTired === true,
  };
}

/** True when anything in here is putting water vapour into the air. */
function humid(s: BathState): boolean {
  return s.tub === "filling" || s.tub === "full" || s.towel === "wet" || s.washer === "done";
}

/* ================================================================== *
 * precomputed geometry — nothing below allocates at render time
 * ================================================================== */

/** Large-format tile, 30x19 pitch, staggered every other course, 2px grout. */
const TILE_FIELD = (() => {
  const face: Rect[] = [];
  const hi: Rect[] = [];
  let row = 0;
  for (let y = TILE_TOP; y < FLOOR; y += 19, row++) {
    const stagger = row % 2 === 1 ? 15 : 0;
    for (let x = -15 + stagger; x < W; x += 30) {
      const x0 = Math.max(0, x + 1);
      const x1 = Math.min(W, x + 29);
      const y1 = Math.min(FLOOR - 1, y + 18);
      if (x1 <= x0) continue;
      face.push([x0, y + 1, x1 - x0, y1 - y - 1]);
      hi.push([x0, y + 1, x1 - x0, 2]);
    }
  }
  return { face: pxPath(face), hi: pxPath(hi) };
})();

/**
 * Anthracite floor: big tiles on a two-pixel grout, foreshortening toward the
 * camera. Two courses used to sit on a fixed 14 px pitch and the floor read as
 * a wall; the near course is taller now, and the room has a floor you look
 * down at.
 */
const FLOOR_FIELD = courses(0, W, FLOOR, H, { far: 10, near: 14, unit: 26, grout: 2 });
const FLOOR_TONE = plates(0, W, FLOOR, H, {
  far: 10,
  near: 14,
  unit: 26,
  seed: 8,
  dark: 0.1,
  pale: 0.08,
});
const FLOOR_SHADE = bandShade(0, W, FLOOR, H);
/** Hair by the basin. It is always by the basin. */
const FLOOR_HAIR = scatter(86, 130, 154, 168, 5, 21, 2, 1);

/** The mirror: a stepped octagon. Ring, glass, and the halo behind it. */
const MIRROR_RING: Rect[] = [
  [90, 54, 20, 2],
  [86, 56, 4, 2],
  [110, 56, 4, 2],
  [84, 58, 2, 24],
  [114, 58, 2, 24],
  [86, 82, 4, 2],
  [110, 82, 4, 2],
  [90, 84, 20, 2],
];
const MIRROR_GLASS: Rect[] = [
  [88, 58, 24, 24],
  [90, 56, 20, 2],
  [90, 82, 20, 2],
];
const MIRROR_RING_D = pxPath(MIRROR_RING);
const MIRROR_GLASS_D = pxPath(MIRROR_GLASS);
/** The halo is a ring two pixels outside the ring, in warm dither. */
const MIRROR_HALO_D = pxPath([
  [88, 51, 24, 3],
  [84, 53, 4, 3],
  [112, 53, 4, 3],
  [81, 56, 3, 28],
  [116, 56, 3, 28],
  [84, 84, 4, 3],
  [112, 84, 4, 3],
  [88, 86, 24, 3],
]);

/** What the mirror shows: the opposite wall, which is more tile and a doorway. */
const MIRROR_REFLECT_TILE = pxPath([
  [88, 58, 24, 1],
  [88, 66, 24, 1],
  [88, 76, 24, 1],
  [99, 58, 1, 24],
]);
const MIRROR_REFLECT_DOOR = pxPath([
  [88, 62, 7, 20],
  [88, 62, 7, 1],
]);

/** A finger dragged bottom-left to top-right, in five stair steps. */
const FOG_WIPE_D = pxPath([
  [88, 74, 6, 5],
  [92, 70, 6, 5],
  [96, 66, 6, 5],
  [100, 62, 6, 5],
  [104, 58, 7, 5],
]);
/** And once there is a clear patch, somebody always draws in it. */
const FOG_DOODLE_D = pxPath([
  [95, 63, 2, 2],
  [103, 63, 2, 2],
  [94, 70, 2, 1],
  [96, 72, 8, 1],
  [104, 70, 2, 1],
]);

/** Two downlight cones, and the pools they put on the floor. */
const SPOT_CONES = SPOTS.map((x) =>
  tiers((k) => steppedCone(x, CEIL + 5, Math.round(4 * k), FLOOR, Math.round(26 * k), 8), "w", 0.9),
);
const SPOT_POOLS = SPOTS.map((x) =>
  tiers((k) => steppedEllipse(x, FLOOR + 8, Math.round(30 * k), Math.round(7 * k), 2), "w", 0.8),
);
const SPOT_SOURCES = bulbPaths(SPOTS.map((x) => [x, CEIL + 4] as const));
/** The window's own contribution: weak, flat, and the width of the reveal. */
const WINDOW_WASH = tiers(
  (k) => steppedCone(158, SILL, Math.round(20 * k), FLOOR + 14, Math.round(34 * k), 8),
  "c",
  0.7,
);
/** The mirror halo lays a soft rectangle on the vanity top. */
const VANITY_WASH = tiers(
  (k) => steppedEllipse(100, 106, Math.round(26 * k), Math.round(9 * k), 2),
  "w",
  0.7,
);

const VIGNETTE = vignettePaths(W, H);

/* --- fixtures whose boxes never change, beveled once at module load --- */

const DOOR_SET = bevelPaths([
  [7, 61, 34, 89],
  [10, 66, 28, 36],
  [10, 108, 28, 36],
]);
const LADDER_SET = bevelPaths([
  [62, 72, 2, 46],
  [76, 72, 2, 46],
  ...repeat(5, 10, [62, 76, 16, 2] as Rect, "y"),
]);
const VANITY_SET = bevelPaths([
  [84, 112, 36, 26], // carcass
  [86, 116, 32, 9], // upper drawer
  [86, 127, 32, 9], // lower drawer
]);
const CISTERN_SET = bevelPaths([
  [146, 100, 22, 22],
  [148, 122, 18, 6],
  [150, 132, 14, 12],
]);
const TUB_SET = bevelPaths([
  [186, 112, 58, 6], // rim
  [188, 118, 54, 26], // acrylic front
]);
const WASHER_SET = bevelPaths([
  [248, 96, 34, 54],
  [250, 100, 30, 8],
]);
const BASKET_SET = bevelPaths([[285, 118, 14, 32]]);

/** Everything that hangs off the wall casts down onto what is under it. */
const WALL_AO = aoPaths([
  [4, 150, 40], // door architrave onto the floor
  [84, 138, 36], // the floating vanity, which is the point of a floating vanity
  [116, 77, 22], // cosmetics shelf
  [138, SILL, 40], // window sill
  [186, 118, 58], // tub rim
  [228, 91, 16], // corner shelf
  [248, 99, 34], // washer lid
  [62, 118, 16], // towel ladder
]);

/** What stands on the floor, and what that does to the floor. */
const FLOOR_CONTACT = contactPaths([
  [4, 40, CY],
  [150, 14, CY],
  [186, 58, CY],
  [248, 34, CY],
  [285, 14, CY],
  [236, 12, CY],
]);

/** Wear. None of this is optional. */
const GROUT_SCALE_D = pxPath([
  [92, 92, 30, 1],
  [86, 111, 8, 1],
  [188, 130, 1, 14],
  [232, 111, 12, 1],
  [148, 148, 20, 2],
]);
const TILE_CRACK_D = pxPath([
  [214, 96, 1, 12],
  [215, 102, 6, 1],
  [220, 102, 1, 5],
]);
const MOULD_D = pxPath([
  [188, 116, 2, 2],
  [190, 114, 1, 1],
  [242, 116, 2, 2],
  [186, 144, 3, 1],
]);
/** The single hair on the floor that survives every mop. */
const HAIR_D = pxPath([
  [172, 160, 4, 1],
  [176, 161, 3, 1],
  [179, 160, 2, 1],
]);
/** Two rows of screws where a cabinet used to be, before the vanity. */
const OLD_FIXINGS_D = pxPath([
  [126, 88, 2, 2],
  [134, 88, 2, 2],
  [126, 104, 2, 2],
  [134, 104, 2, 2],
]);

/* ================================================================== *
 * PLANE 1 — the wall itself
 * ================================================================== */

function Walls({ ph }: { ph: Ph }) {
  const paint = PAINT[ph];
  const tile = WALLTILE[ph];
  const grout = GROUT[ph];
  const ceil = CEILING[ph];
  return (
    <g>
      {/* the defs live in the bottom-most layer of the scene and nowhere else */}
      <SharedDefs />
      {/* paint above, grout ground, tile field over the top */}
      {px(0, CEIL, W, TILE_TOP - CEIL, paint.base)}
      <rect x={0} y={CEIL} width={W} height={TILE_TOP - CEIL} fill="url(#px-roller)" />
      {px(0, CEIL, W, 3, ceil.base)}
      {px(0, CEIL, W, 1, ceil.hi)}
      {px(0, TILE_TOP - 2, W, 2, paint.deep)}
      {px(0, TILE_TOP, W, FLOOR - TILE_TOP, grout.base)}
      <path d={TILE_FIELD.face} fill={tile.base} />
      <path d={TILE_FIELD.hi} fill={tile.hi} />
      <rect x={0} y={TILE_TOP} width={W} height={FLOOR - TILE_TOP} fill="url(#px-satin)" />
      {/* the accent course at eye level, one shade darker, because 2014 */}
      {px(0, 112, W, 1, grout.lo)}
      {px(0, 130, W, 1, grout.lo)}
      {/* limescale in the grout, a crack somebody siliconed instead of retiling */}
      <path d={GROUT_SCALE_D} fill={K.scale} opacity={0.5} />
      <path d={TILE_CRACK_D} fill={tile.deep} opacity={0.7} />
      {px(214, 96, 1, 12, K.sealant)}
      {/* the damp bloom in the ceiling corner, from the flat above, since 2021 */}
      {px(0, CEIL + 3, 34, 9, "#c9c0ac")}
      {px(0, CEIL + 3, 22, 5, "#bdb39c")}
      <rect x={0} y={CEIL + 3} width={34} height={9} fill="url(#px-grain)" />
      {/* four screws where the old cabinet hung, filled and never sanded */}
      <path d={OLD_FIXINGS_D} fill={paint.deep} opacity={0.55} />
      {/* the wall behind the machine is not the wall in front of the machine */}
      {px(246, 74, 38, 76, tile.mid)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — wall fittings: window, downlights, mirror, extractor
 * ================================================================== */

function Window({ ph, s }: { ph: Ph; s: BathState }) {
  const glow = K.obscure[ph];
  const night = ph === "night";
  /** Obscure glass condenses before anything else in the room does. */
  const wet = s.fog >= 2 || humid(s);
  return (
    <g>
      {/* reveal, then the frame, then the glass — the frame is thin uPVC */}
      {px(136, 48, 44, 38, GROUT[ph].lo)}
      <Bevel boxes={[[138, 50, 40, 34]]} mat={CERAMIC[ph]} />
      {px(141, 53, 34, 28, glow)}
      {px(141, 53, 34, 4, K.obscure.day)}
      {/* the ribbed pattern in the glass: vertical bars of brighter and duller */}
      <path
        d={pxPath([
          [143, 53, 2, 28],
          [149, 53, 2, 28],
          [157, 53, 1, 28],
          [163, 53, 2, 28],
          [171, 53, 2, 28],
        ])}
        fill={FROSTED_MAT.hi}
        opacity={0.45}
      />
      {px(157, 53, 1, 28, FROSTED_MAT.lo)}
      {px(141, 66, 34, 1, FROSTED_MAT.lo)}
      {/* tilt-and-turn handle, and the sill it never quite closes onto */}
      <Bevel boxes={[[155, 76, 5, 4]]} mat={CHROME_MAT} />
      {px(136, SILL, 44, 3, CERAMIC[ph].base)}
      {px(136, SILL, 44, 1, CERAMIC[ph].hi)}
      {/* condensation gathers at the bottom of the pane and runs */}
      {wet ? (
        <g>
          <path d={pxPath([[141, 74, 34, 7]])} fill={dth("c", "50")} opacity={0.6} />
          <path
            d={pxPath([
              [146, 62, 1, 12],
              [160, 58, 1, 16],
              [168, 66, 1, 8],
            ])}
            fill={K.waterHi}
            opacity={0.7}
          />
          <rect x={160} y={74} width={1} height={3} fill={K.waterHi} opacity={0.8}>
            <animate attributeName="y" values="58;80" dur="5.4s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.8;0.8;0"
              dur="5.4s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {/* a moth on the outside of the glass, which is as close as it will get */}
      {night ? (
        <g>
          <path
            d={pxPath([
              [152, 60, 3, 2],
              [153, 59, 1, 1],
            ])}
            fill="#7a7466"
            opacity={0.55}
          />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;5 -3;-2 4;3 2;0 0"
            dur="4.3s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
    </g>
  );
}

function Fern({ ph, stage }: { ph: Ph; stage: 0 | 1 | 2 }) {
  const leaf = stage === 0 ? dim(M.leaf, "#8a8a4a", 0.45) : M.leaf;
  const hi = stage === 2 ? leaf.hi : leaf.mid;
  /** Thirsty droops and goes olive; lush throws a new shoot at the window. */
  const fronds: Rect[] =
    stage === 0
      ? [
          [142, 78, 15, 5],
          [144, 82, 11, 2],
          [140, 80, 3, 3],
        ]
      : stage === 1
        ? [
            [142, 76, 16, 8],
            [145, 72, 10, 5],
          ]
        : [
            [141, 74, 18, 10],
            [144, 69, 12, 6],
            [148, 64, 5, 6],
            [138, 76, 4, 5],
            [158, 76, 4, 5],
          ];
  return (
    <g>
      <Bevel boxes={[[146, SILL - 6, 9, 6]]} mat={{ ...OAK[ph], base: "#8a5a3a" }} />
      <path d={pxPath(fronds)} fill={leaf.base} />
      <path d={pxPath(fronds.map(([x, y, w]) => [x, y, w, 1] as Rect))} fill={hi} />
      {stage === 0 ? <path d={pxPath([[156, 80, 3, 1]])} fill="#8a7a4a" /> : null}
      {stage === 2 ? <path d={pxPath([[150, 62, 1, 3]])} fill={M.leaf.hi} /> : null}
    </g>
  );
}

function Mirror({ ph, s }: { ph: Ph; s: BathState }) {
  const ringMat = s.lit ? CHROME_MAT : GROUT[ph];
  /**
   * The glass is not a colour, it is the opposite wall — which in here is more
   * tile and the edge of the doorway. Fog then eats it in three stages.
   */
  return (
    <g>
      {/* halo first, behind everything, so the ring reads as sitting in front */}
      {s.lit ? <path d={MIRROR_HALO_D} fill={dth("w", "25")} opacity={0.55} /> : null}
      <path d={MIRROR_GLASS_D} fill={s.lit ? "#b8ccd2" : "#8a9ba2"} />
      <path d={MIRROR_REFLECT_TILE} fill={s.lit ? "#cfdee2" : "#9fb0b6"} opacity={0.8} />
      <path d={MIRROR_REFLECT_DOOR} fill={s.lit ? "#dfe4dc" : "#a4aca6"} opacity={0.7} />
      {/* the reflection of the ceiling spot, which is why you can never see your chin */}
      {s.lit ? <path d={pxPath([[104, 60, 4, 3]])} fill="#f2f8fa" opacity={0.8} /> : null}
      <path d={MIRROR_RING_D} fill={ringMat.base} />
      <path
        d={pxPath([
          [90, 54, 20, 1],
          [84, 58, 1, 24],
        ])}
        fill={ringMat.hi}
      />
      {/* fog: three densities, and a wipe once somebody has needed the mirror */}
      {s.fog >= 1 ? (
        <path
          d={MIRROR_GLASS_D}
          fill={dth("c", s.fog >= 3 ? "50" : s.fog >= 2 ? "50" : "25")}
          opacity={s.fog >= 2 ? 0.85 : 0.5}
          style={{ transition: STEP_FADE }}
        />
      ) : null}
      {s.fog >= 3 ? (
        <g>
          <path d={FOG_WIPE_D} fill="#c6d8de" />
          <path d={FOG_WIPE_D} fill={dth("c", "12")} opacity={0.5} />
          <path d={FOG_DOODLE_D} fill="#cfdee2" />
        </g>
      ) : null}
      {/* two dried splashes on the glass, at toothbrush height, forever */}
      <path
        d={pxPath([
          [93, 78, 1, 1],
          [97, 80, 2, 1],
          [107, 77, 1, 1],
        ])}
        fill="#dfe8ea"
        opacity={0.5}
      />
    </g>
  );
}

function Ceiling({ s }: { s: BathState }) {
  return (
    <g>
      {/* the fittings themselves, always drawn; the light is in Effects */}
      <Bevel boxes={SPOTS.map((x) => [x - 5, CEIL, 10, 3] as Rect)} mat={MATTE_MAT} />
      <path
        d={pxPath(SPOTS.map((x) => [x - 3, CEIL + 3, 6, 2] as Rect))}
        fill={s.lit ? K.led : K.ledDead}
        style={{ transition: STEP_FADE }}
      />
      {/* extractor: the fins are static, the blade only turns when it has to */}
      <Bevel boxes={[[274, 48, 18, 14]]} mat={PAINT_MAT} />
      {px(276, 50, 14, 10, GROUT_MAT.deep)}
      <path
        d={pxPath([
          [277, 52, 12, 1],
          [277, 55, 12, 1],
          [277, 58, 12, 1],
        ])}
        fill={GROUT_MAT.hi}
        opacity={0.6}
      />
      {s.washer !== "off" || s.fog >= 2 ? (
        <g>
          <path
            d={pxPath([
              [282, 51, 1, 8],
              [279, 54, 8, 1],
            ])}
            fill={GROUT_MAT.hi}
            opacity={0.5}
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 283 55"
              to="360 283 55"
              dur="0.7s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the floor, and everything wet on it
 * ================================================================== */

function Ground({ ph, s }: { ph: Ph; s: BathState }) {
  const floor = FLOORTILE[ph];
  /** Water on the floor has three sources and they pool in different places. */
  const towelDrip = s.towel === "wet";
  const spinPuddle = s.washer === "spin" || s.washer === "done";
  const tubSpill = s.tub === "full" || s.tub === "draining";
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, GROUT[ph].deep)}
      <path d={FLOOR_FIELD.face} fill={floor.base} />
      <path d={FLOOR_TONE.dark} fill={floor.lo} opacity={0.5} />
      <path d={FLOOR_TONE.pale} fill={floor.hi} opacity={0.35} />
      <path d={FLOOR_FIELD.hi} fill={floor.hi} />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-agg)" />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#px-satin)" opacity={0.6} />
      <path d={FLOOR_HAIR} fill="#171009" opacity={0.35} />
      <path d={FLOOR_SHADE.footSoft} fill="#171009" opacity={0.08} />
      <path d={FLOOR_SHADE.foot} fill="#171009" opacity={0.14} />
      {px(0, SKIRT, W, 4, GRAPHITE[ph].base)}
      {px(0, SKIRT, W, 1, GRAPHITE[ph].hi)}
      {px(0, FLOOR, W, 1, floor.deep)}
      {/* the linear drain by the tub, which is the only part of the 2014 refit
          that was a good idea */}
      {px(176, 162, 20, 5, GROUT_MAT.deep)}
      <path d={pxPath(repeat(6, 3, [178, 163, 1, 3] as Rect))} fill="#3f4448" />
      {px(176, 162, 20, 1, CHROME_MAT.lo)}
      {/* wet patches. Each one names its own cause. */}
      {towelDrip ? (
        <g>
          <path d={pxPath(steppedEllipse(70, 156, 10, 3, 2))} fill={K.water} opacity={0.4} />
          <path d={pxPath(steppedEllipse(70, 155, 5, 2, 1))} fill={K.waterHi} opacity={0.35} />
        </g>
      ) : null}
      {spinPuddle ? (
        <g>
          <path d={pxPath(steppedEllipse(266, 158, 14, 4, 2))} fill={K.water} opacity={0.35} />
          <path d={pxPath(steppedEllipse(266, 157, 7, 2, 1))} fill={K.waterHi} opacity={0.3} />
        </g>
      ) : null}
      {tubSpill ? (
        <g>
          {/* footprints, mat to door, drying from the toes back */}
          <path
            d={pxPath([
              [196, 158, 6, 3],
              [184, 164, 6, 3],
              [170, 157, 5, 3],
              [156, 163, 5, 3],
            ])}
            fill={K.water}
            opacity={0.28}
          />
        </g>
      ) : null}
      {/* the hair, and the bottle cap that has lived under the washer for a year */}
      <path d={HAIR_D} fill={K.hair} opacity={0.7} />
      {px(244, 170, 3, 2, "#4a8a4a")}
      <path d={MOULD_D} fill={K.mould} opacity={0.6} />
      <Contact set={FLOOR_CONTACT} op={s.lit ? 0.9 : 0.55} />
      <AOSet set={WALL_AO} op={s.lit ? 0.9 : 0.6} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — the fixtures. Each one is a stage machine.
 * ================================================================== */

function Door({ ph }: { ph: Ph }) {
  const leaf = LAMINATE[ph];
  const trim = GRAPHITE[ph];
  return (
    <g>
      {/* architrave, leaf, two panels, and the gap the hall light gets through */}
      {px(4, 58, 40, 92, trim.lo)}
      {px(4, 58, 40, 1, trim.hi)}
      <Bev set={DOOR_SET} mat={leaf} />
      {px(12, 68, 24, 32, leaf.hi)}
      {px(12, 110, 24, 32, leaf.hi)}
      {/* lever handle and the thumbturn lock that has never once been used */}
      <Bevel
        boxes={[
          [34, 103, 8, 3],
          [39, 106, 3, 5],
        ]}
        mat={MATTE_MAT}
      />
      {px(34, 96, 3, 3, MATTE_MAT.base)}
      {/* hook on the back of the door — the robe is in the Foreground plane */}
      {px(20, 70, 3, 2, MATTE_MAT.base)}
      {/* the draught gap: hall light gets under the door whether you like it or not */}
      <path d={pxPath([[7, 147, 34, 3]])} fill={dth("n", "50")} opacity={0.5} />
      <path d={pxPath([[7, 147, 34, 1]])} fill={K.warm} opacity={0.22} />
    </g>
  );
}

function TowelLadder({ ph: _ph, s }: { ph: Ph; s: BathState }) {
  /**
   * A heated ladder, which is where towels live in a country that gets
   * properly cold. The towel is the room's humidity gauge: dry sits neat on
   * two rungs, damp sags past a third, wet reaches the fourth and drips.
   */
  const drop = s.towel === "dry" ? 0 : s.towel === "damp" ? 3 : 6;
  const body = s.towel === "wet" ? K.towelTealWet : K.towelTeal;
  const hi = s.towel === "wet" ? K.towelTeal : K.towelTealHi;
  return (
    <g>
      <Bev set={LADDER_SET} mat={MATTE_MAT} />
      {/* the feed pipe and the valve, down the wall into the floor */}
      {px(64, 118, 2, 28, MATTE_MAT.mid)}
      {px(64, 118, 1, 28, MATTE_MAT.hi)}
      <Bevel boxes={[[62, 138, 6, 5]]} mat={CHROME_MAT} />
      {/* the towel */}
      <g style={{ transition: "none" }}>
        {px(61, 88, 18, 14 + drop, body)}
        {px(61, 88, 18, 3, hi)}
        {px(61, 99 + drop, 18, 2, K.towelTealWet)}
        <rect x={61} y={88} width={18} height={14 + drop} fill="url(#px-weave)" />
        {/* the fold, and the label that always ends up on the outside */}
        {px(69, 88, 1, 14 + drop, hi)}
        {px(73, 90, 3, 2, M.linen.base)}
      </g>
      {s.towel !== "dry" ? (
        <rect x={69} y={102 + drop} width={1} height={3} fill={K.waterHi} opacity={0.8}>
          <animate
            attributeName="y"
            values={`${102 + drop};${FLOOR - 2}`}
            dur={s.towel === "wet" ? "2.9s" : "6.2s"}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.85;0.85;0"
            keyTimes="0;0.8;1"
            dur={s.towel === "wet" ? "2.9s" : "6.2s"}
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {/* a second towel, folded on the bottom rung, still in its creases */}
      {px(62, 108, 16, 8, M.linen.base)}
      {px(62, 108, 16, 2, M.linen.hi)}
      {px(62, 112, 16, 1, M.linen.lo)}
    </g>
  );
}

function Vanity({ ph, s }: { ph: Ph; s: BathState }) {
  const oak = OAK[ph];
  const ceramic = CERAMIC[ph];
  return (
    <g>
      {/* shelf over the basin: the three bottles that are always on it */}
      {px(116, 74, 22, 3, oak.base)}
      {px(116, 74, 22, 1, oak.hi)}
      <path d={pxPath([[118, 66, 4, 8]])} fill={K.amber} />
      <path d={pxPath([[118, 66, 4, 1]])} fill="#e0a860" />
      {px(124, 68, 4, 6, "#8aa06e")}
      {px(124, 68, 4, 1, "#9fb583")}
      {px(130, 64, 3, 10, K.amber)}
      {px(130, 63, 3, 2, MATTE_MAT.base)}
      {/* countertop and the basin sitting on it */}
      {px(82, 108, 40, 4, oak.hi)}
      {px(82, 111, 40, 1, oak.deep)}
      <Bevel boxes={[[86, 100, 30, 8]]} mat={ceramic} />
      {px(88, 102, 26, 5, ceramic.mid)}
      {px(88, 106, 26, 1, ceramic.lo)}
      {/* standing water in the basin, if the plug is in and the tap has run */}
      {s.tapOn ? (
        <g>
          {px(89, 104, 24, 3, K.water)}
          {px(89, 104, 24, 1, K.waterHi)}
        </g>
      ) : null}
      {/* the tap: matte black, tall spout, and the limescale ring under it */}
      <Bevel
        boxes={[
          [99, 88, 3, 12],
          [99, 88, 9, 3],
        ]}
        mat={MATTE_MAT}
      />
      {px(105, 91, 2, 3, MATTE_MAT.hi)}
      {px(96, 106, 8, 1, K.scale)}
      {/* toothbrush cup, two brushes, and the soap that is down to a sliver */}
      <Bevel boxes={[[112, 101, 7, 7]]} mat={ceramic} />
      {px(113, 97, 1, 5, "#a33a30")}
      {px(116, 96, 1, 6, "#33415a")}
      {px(113, 96, 2, 1, "#c9c2b0")}
      {px(116, 95, 2, 1, "#c9c2b0")}
      {px(88, 105, 5, 3, "#c9d68a")}
      {/* the floating carcass, two drawers, black bar handles */}
      <Bev set={VANITY_SET} mat={oak} />
      <path
        d={pxPath([
          [98, 119, 8, 2],
          [98, 130, 8, 2],
        ])}
        fill={MATTE_MAT.base}
      />
      <rect x={84} y={112} width={36} height={26} fill="url(#px-wood)" />
      {/* the bin, and the scales nobody has stood on since January */}
      <Bevel boxes={[[124, 132, 12, 14]]} mat={CHROME_MAT} />
      {px(124, 132, 12, 2, CHROME_MAT.hi)}
      {px(127, 130, 6, 2, MATTE_MAT.base)}
    </g>
  );
}

function Toilet({ ph, s }: { ph: Ph; s: BathState }) {
  const ceramic = CERAMIC[ph];
  return (
    <g>
      {/* the lid, when it is up, leans on the cistern — so it draws first */}
      {s.lidUp ? (
        <g>
          {px(149, 80, 16, 15, ceramic.base)}
          {px(149, 80, 16, 2, ceramic.hi)}
          {px(164, 82, 1, 13, ceramic.deep)}
          {px(149, 94, 16, 1, ceramic.deep)}
        </g>
      ) : null}
      <Bev set={CISTERN_SET} mat={ceramic} />
      {px(152, 144, 11, 6, ceramic.deep)}
      {/* dual flush plate */}
      <Bevel boxes={[[153, 96, 10, 4]]} mat={CHROME_MAT} />
      {px(158, 96, 1, 4, CHROME_MAT.deep)}
      {/* seat down over the pan, or the open bowl and the water in it */}
      {s.lidUp ? (
        <g>
          {px(150, 122, 14, 3, ceramic.deep)}
          {px(151, 124, 12, 3, K.water)}
          {px(151, 124, 12, 1, K.waterHi)}
        </g>
      ) : (
        <g>
          {px(148, 122, 18, 6, ceramic.base)}
          {px(148, 122, 18, 1, ceramic.hi)}
          {px(150, 124, 14, 2, ceramic.mid)}
        </g>
      )}
      {/* paper: full roll, half roll, or the bare tube and a spare on the lid */}
      <Bevel boxes={[[137, 108, 2, 8]]} mat={MATTE_MAT} />
      {s.paper === 2 ? (
        <g>
          <Bevel boxes={[[130, 106, 9, 9]]} mat={CERAMIC_MAT} />
          {px(133, 109, 3, 3, CERAMIC_MAT.deep)}
          {px(130, 115, 6, 3, CERAMIC_MAT.hi)}
        </g>
      ) : s.paper === 1 ? (
        <g>
          <Bevel boxes={[[133, 108, 6, 6]]} mat={CERAMIC_MAT} />
          {px(134, 110, 2, 2, CERAMIC_MAT.deep)}
        </g>
      ) : (
        <g>
          {px(135, 110, 3, 4, "#b09070")}
          {px(135, 110, 3, 1, "#c2a281")}
          {/* the spare, balanced on the cistern, which is where spares live */}
          <Bevel boxes={[[155, 92, 8, 8]]} mat={CERAMIC_MAT} />
          {px(158, 95, 2, 2, CERAMIC_MAT.deep)}
        </g>
      )}
      {/* brush in its holder, and the plunger nobody admits to owning */}
      <Bevel boxes={[[171, 134, 6, 16]]} mat={MATTE_MAT} />
      {px(172, 130, 4, 5, MATTE_MAT.hi)}
      {px(173, 126, 2, 5, MATTE_MAT.mid)}
      {/* the little shelf of things that end up behind a toilet */}
      {px(168, 112, 9, 2, OAK[ph].base)}
      {px(168, 112, 9, 1, OAK[ph].hi)}
      {px(170, 106, 3, 6, "#8aa06e")}
      {px(174, 108, 2, 4, K.amber)}
    </g>
  );
}

function TubZone({ ph, s }: { ph: Ph; s: BathState }) {
  const ceramic = CERAMIC[ph];
  /** Water level per stage. The tub's inside runs x190..240, floor at y142. */
  const level = s.tub === "empty" ? 0 : s.tub === "filling" ? 8 : s.tub === "full" ? 18 : 12;
  const waterY = 142 - level;
  return (
    <g>
      {/* the column: rain head, riser, diverter, hand shower on its bracket */}
      <Bevel
        boxes={[
          [196, 54, 16, 3],
          [202, 57, 4, 8],
          [203, 65, 2, 44],
        ]}
        mat={MATTE_MAT}
      />
      <path d={pxPath(repeat(6, 3, [197, 57, 1, 1] as Rect))} fill={MATTE_MAT.hi} opacity={0.7} />
      <Bevel boxes={[[198, 76, 8, 4]]} mat={MATTE_MAT} />
      <Bevel boxes={[[199, 80, 3, 9]]} mat={CHROME_MAT} />
      {px(200, 89, 1, 14, CHROME_MAT.lo)}
      {/* corner shelf: shampoo, conditioner, and the one that is empty */}
      <Bevel boxes={[[228, 88, 16, 3]]} mat={CHROME_MAT} />
      {px(230, 80, 4, 8, "#7a5aa0")}
      {px(230, 80, 4, 1, "#9478bd")}
      {px(236, 82, 4, 6, "#4a7a8a")}
      {px(236, 82, 4, 1, "#5f95a6")}
      {px(241, 84, 3, 4, "#c9c2b0")}
      {/* the tub */}
      <Bev set={TUB_SET} mat={ceramic} />
      {px(186, 142, 58, 8, ceramic.lo)}
      <rect x={188} y={118} width={54} height={26} fill="url(#px-satin)" />
      {/* the water, per stage */}
      {level > 0 ? (
        <g>
          {px(190, waterY, 50, level, K.water)}
          {px(190, waterY, 50, 1, K.waterHi)}
          <rect x={190} y={waterY} width={50} height={level} fill={dth("c", "12")} opacity={0.4} />
          {s.tub === "filling" ? (
            <g>
              {/* rising, and the surface is broken where the spout hits it */}
              <rect x={190} y={waterY} width={50} height={level} fill={K.water}>
                <animate
                  attributeName="y"
                  values="140;124"
                  dur="11s"
                  fill="freeze"
                  repeatCount="1"
                />
                <animate
                  attributeName="height"
                  values="2;18"
                  dur="11s"
                  fill="freeze"
                  repeatCount="1"
                />
              </rect>
              <path
                d={pxPath([
                  [232, waterY - 1, 8, 2],
                  [230, waterY + 1, 3, 1],
                ])}
                fill={K.foam}
                opacity={0.8}
              >
                <animate
                  attributeName="opacity"
                  values="0.8;0.5;0.85;0.6;0.8"
                  dur="1.3s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {s.tub === "full" ? (
            <g>
              {/* foam islands, and the duck that came with somebody's nephew */}
              <path
                d={pxPath([
                  [194, waterY, 14, 3],
                  [214, waterY, 10, 2],
                  [230, waterY, 8, 3],
                ])}
                fill={K.foam}
                opacity={0.75}
              />
              <g>
                <path
                  d={pxPath([
                    [206, waterY - 4, 8, 4],
                    [212, waterY - 7, 4, 3],
                  ])}
                  fill={K.duck}
                />
                <path d={pxPath([[215, waterY - 6, 2, 1]])} fill={K.duckBeak} />
                <path d={pxPath([[213, waterY - 6, 1, 1]])} fill={MATTE_MAT.base} />
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;1 -1;0 0;-1 1;0 0"
                  dur="3.4s"
                  repeatCount="indefinite"
                />
              </g>
              {/* the surface, moving just enough to not be a painting */}
              <rect x={190} y={waterY + 3} width={50} height={1} fill={K.waterHi} opacity={0.5}>
                <animate
                  attributeName="opacity"
                  values="0.5;0.25;0.45;0.3;0.5"
                  dur="4.9s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
          {s.tub === "draining" ? (
            <g>
              <rect x={190} y={waterY} width={50} height={level} fill={K.water}>
                <animate
                  attributeName="y"
                  values="130;142"
                  dur="9s"
                  fill="freeze"
                  repeatCount="1"
                />
                <animate
                  attributeName="height"
                  values="12;0"
                  dur="9s"
                  fill="freeze"
                  repeatCount="1"
                />
              </rect>
              {/* the vortex over the waste, four pixels going round */}
              <g>
                <path
                  d={pxPath([
                    [234, 138, 2, 1],
                    [238, 140, 1, 2],
                    [234, 143, 2, 1],
                    [231, 140, 1, 2],
                  ])}
                  fill={K.waterDeep}
                  opacity={0.8}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 235 141"
                    to="360 235 141"
                    dur="0.85s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            </g>
          ) : null}
        </g>
      ) : (
        <g>
          {/* dry: the tide line the water leaves, and the ring above it */}
          {px(190, 136, 50, 1, K.scale)}
          {px(190, 130, 50, 1, K.scale)}
          <path d={pxPath([[196, 138, 20, 2]])} fill={ceramic.hi} opacity={0.6} />
        </g>
      )}
      {/* the waste and the overflow */}
      <Bevel boxes={[[232, 140, 7, 4]]} mat={CHROME_MAT} />
      <Bevel boxes={[[236, 122, 6, 4]]} mat={CHROME_MAT} />
      {/* tub filler, and the drip that has outlived three washers */}
      <Bevel
        boxes={[
          [237, 104, 6, 3],
          [239, 107, 3, 4],
        ]}
        mat={CHROME_MAT}
      />
      <rect x={239} y={112} width={1} height={2} fill={K.waterHi}>
        <animate
          attributeName="y"
          values="112;112;138"
          keyTimes="0;0.68;1"
          dur="4.6s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0;0.9;0"
          keyTimes="0;0.68;0.84;1"
          dur="4.6s"
          repeatCount="indefinite"
        />
      </rect>
      {/* the glass screen over the near end, and the water spots on it */}
      <rect x={188} y={70} width={26} height={44} fill={K.glass} opacity={0.32} />
      <path
        d={pxPath([
          [188, 70, 26, 2],
          [188, 70, 2, 44],
          [212, 70, 2, 44],
        ])}
        fill={K.glassEdge}
      />
      <path
        d={pxPath([
          [194, 84, 1, 1],
          [199, 92, 2, 1],
          [205, 88, 1, 1],
          [196, 104, 1, 2],
          [208, 100, 1, 1],
        ])}
        fill="#e2eef0"
        opacity={0.5}
      />
      {/* the mat, which is damp whenever the tub has been */}
      {px(196, 151, 34, 4, s.tub === "empty" ? M.linen.base : M.linen.lo)}
      {px(196, 151, 34, 1, M.linen.hi)}
      <rect x={196} y={151} width={34} height={4} fill="url(#px-weave)" />
      {/* the bathroom scale, on its edge against the tub, because there is no room */}
      <Bevel boxes={[[236, 132, 11, 14]]} mat={CHROME_MAT} />
      {px(238, 135, 7, 6, MATTE_MAT.base)}
      <PixelText x={239} y={136} text="0.0" fill={K.led} op={0.5} />
    </g>
  );
}

function Washer({ ph, s }: { ph: Ph; s: BathState }) {
  const ceramic = CERAMIC[ph];
  const on = s.washer !== "off";
  const spinning = s.washer === "wash" || s.washer === "spin";
  const drumDur = s.washer === "spin" ? "0.28s" : "1.6s";
  /** The display tells you which stage it is in, and it is the only text in here. */
  const readout =
    s.washer === "fill" ? "40" : s.washer === "wash" ? "40" : s.washer === "spin" ? "1200" : "0:00";
  return (
    <g>
      {/* the whole box shakes on spin. Everything on top shakes with it. */}
      <g className={s.washer === "spin" ? "washer-rumble" : undefined}>
        <Bev set={WASHER_SET} mat={ceramic} />
        <rect x={248} y={96} width={34} height={54} fill="url(#px-satin)" />
        {/* control panel: dial, three programme LEDs, and the display */}
        <Bevel boxes={[[251, 102, 7, 5]]} mat={M.graphite} />
        <path
          d={pxPath([
            [259, 103, 2, 2],
            [263, 103, 2, 2],
          ])}
          fill={on ? K.led : K.ledDead}
        />
        <Bevel boxes={[[262, 101, 17, 7]]} mat={MATTE_MAT} />
        {on ? <PixelText x={264} y={102} text={readout} fill={K.led} /> : null}
        {/* porthole: bezel, glass, drum, and whatever the drum is doing */}
        <Bevel boxes={[[254, 111, 22, 22]]} mat={ceramic} />
        {px(256, 113, 18, 18, MATTE_MAT.lo)}
        {px(257, 114, 16, 16, "#2f3438")}
        {/* the drum itself */}
        <g>
          {spinning ? (
            <g>
              <path
                d={pxPath([
                  [259, 120, 12, 2],
                  [264, 115, 2, 12],
                  [261, 117, 2, 2],
                  [267, 124, 2, 2],
                ])}
                fill={s.washer === "spin" ? "#5f6a70" : "#4a5258"}
              />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 265 122"
                to="360 265 122"
                dur={drumDur}
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* water in the drum, rising while it fills */}
          {s.washer === "fill" ? (
            <rect x={258} y={126} width={14} height={4} fill={K.water} opacity={0.7}>
              <animate attributeName="y" values="128;120" dur="7s" fill="freeze" repeatCount="1" />
              <animate
                attributeName="height"
                values="2;10"
                dur="7s"
                fill="freeze"
                repeatCount="1"
              />
            </rect>
          ) : null}
          {/* suds against the glass while it washes */}
          {s.washer === "wash" ? (
            <path
              d={pxPath([
                [258, 118, 4, 3],
                [268, 124, 4, 3],
              ])}
              fill={K.suds}
              opacity={0.55}
            >
              <animate
                attributeName="opacity"
                values="0.55;0.3;0.5;0.35;0.55"
                dur="2.3s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* done: the load has settled at the bottom and the door is ajar */}
          {s.washer === "done" ? (
            <g>
              <path
                d={pxPath([
                  [258, 125, 14, 5],
                  [260, 123, 5, 2],
                ])}
                fill="#6a7278"
              />
              <path d={pxPath([[273, 113, 2, 18]])} fill={ceramic.hi} />
            </g>
          ) : (
            <path d={pxPath([[262, 118, 8, 8]])} fill="#3a4248" opacity={0.5} />
          )}
        </g>
        {/* the amber "running" lamp, discrete flicker so it never eases */}
        <path
          d={pxPath([[271, 103, 6, 3]])}
          fill={s.washer === "done" ? K.amber : on ? K.led : ceramic.deep}
        >
          {s.washer === "done" ? (
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="1;0.4;1;0.4"
              dur="1.8s"
              repeatCount="indefinite"
            />
          ) : null}
        </path>
        <path
          d={pxPath([
            [248, 146, 4, 4],
            [278, 146, 4, 4],
          ])}
          fill={M.graphite.base}
        />
      </g>
      {/* the hose, up the wall to the tap that was never boxed in */}
      <path
        d={pxPath([
          [283, 108, 3, 6],
          [284, 96, 3, 12],
          [284, 90, 3, 6],
        ])}
        fill={M.graphite.mid}
      />
      <Bevel boxes={[[282, 86, 6, 5]]} mat={CHROME_MAT} />
      {/* on top: detergent, softener, and the coins out of somebody's pockets */}
      <Bevel boxes={[[250, 86, 11, 10]]} mat={{ ...M.leaf, base: "#4a8a4a", hi: "#5fa05f" }} />
      {px(252, 88, 6, 3, M.linen.hi)}
      <Bevel boxes={[[263, 88, 7, 8]]} mat={{ ...M.teal, base: "#6a8ab8", hi: "#84a2c9" }} />
      <path
        d={pxPath([
          [272, 91, 9, 3],
          [272, 94, 9, 2],
        ])}
        fill={K.towelTeal}
      />
      <path d={pxPath([[272, 91, 9, 1]])} fill={K.towelTealHi} />
      <path
        d={pxPath([
          [277, 88, 2, 2],
          [280, 89, 2, 2],
        ])}
        fill={M.brass.base}
      />
    </g>
  );
}

function Basket({ ph, s }: { ph: Ph; s: BathState }) {
  /** 0 empty and lidded, 1 a sock escaping, 2 lid off, 3 losing the argument. */
  const lidOn = s.laundry <= 1;
  const w = WICKER[ph];
  return (
    <g>
      <Bev set={BASKET_SET} mat={w} />
      <path
        d={pxPath([
          [285, 126, 14, 2],
          [285, 134, 14, 2],
          [285, 142, 14, 2],
        ])}
        fill={w.lo}
      />
      <rect x={285} y={118} width={14} height={32} fill="url(#px-weave)" />
      {s.laundry >= 2 ? (
        <g>
          {/* the mound, and the lid balanced on top of it at an angle */}
          {px(285, 108, 14, 11, M.linen.base)}
          {px(285, 108, 14, 2, M.linen.hi)}
          {px(288, 104, 8, 5, K.towelTeal)}
          {px(288, 104, 8, 1, K.towelTealHi)}
          {px(283, 100, 12, 3, w.base)}
          {px(283, 100, 12, 1, w.hi)}
        </g>
      ) : null}
      {lidOn ? (
        <g>
          {px(284, 114, 16, 5, w.base)}
          {px(284, 114, 16, 2, w.hi)}
          {px(290, 112, 4, 2, w.lo)}
        </g>
      ) : null}
      {s.laundry === 1 ? (
        <g>
          {px(296, 119, 4, 8, M.linen.mid)}
          {px(296, 119, 4, 1, M.linen.hi)}
        </g>
      ) : null}
      {s.laundry === 3 ? (
        <g>
          {/* what has already given up and gone on the floor */}
          {px(272, 144, 12, 6, "#6a8ab8")}
          {px(272, 144, 12, 1, "#84a2c9")}
          {px(276, 141, 6, 3, M.linen.base)}
          {px(266, 147, 8, 3, K.towelTeal)}
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function BathArt({ world, phase }: SceneRenderProps<WorldState>) {
  const ph = toPhase(phase);
  const s = state(world);
  return (
    <LayeredScene
      parallax={{ farBackground: 1, middleBackground: 1 }}
      farBackground={<Walls ph={ph} />}
      middleBackground={
        <g>
          <Ceiling s={s} />
          <Window ph={ph} s={s} />
          <Fern ph={ph} stage={s.fern} />
          <Mirror ph={ph} s={s} />
        </g>
      }
      ground={<Ground ph={ph} s={s} />}
      staticObjects={
        <g>
          <Door ph={ph} />
          {/* the switch, inside the door where your wet hand already goes */}
          <Bevel boxes={[[50, 96, 9, 12]]} mat={M.laminate} />
          <path
            d={pxPath([[52, 99, 5, 6]])}
            fill={s.lit ? K.led : "#c9c2b4"}
            style={{ transition: STEP_FADE }}
          />
          <TowelLadder ph={ph} s={s} />
          <Vanity ph={ph} s={s} />
          <Toilet ph={ph} s={s} />
          <TubZone ph={ph} s={s} />
          <Washer ph={ph} s={s} />
          <Basket ph={ph} s={s} />
        </g>
      }
    />
  );
}

/* ================================================================== *
 * foreground — the near edge
 * ================================================================== */

function BathFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const s = world ? state(world) : null;
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
        {/* the underside of the ceiling, closing the top of the frame */}
        {px(0, 0, W, CEIL, CEILING[ph].base)}
        {px(0, CEIL - 2, W, 2, CEILING[ph].deep)}
        <rect x={0} y={0} width={W} height={CEIL} fill="url(#px-roller)" />
        {/* the robe on the back of the door, hanging into frame at the left */}
        {px(8, 70, 16, 62, "#8a9a9a")}
        {px(8, 70, 16, 3, "#a2b2b2")}
        {px(22, 73, 2, 59, "#6d7d7d")}
        {px(8, 96, 16, 2, "#7a8a8a")}
        {px(12, 98, 3, 22, "#7a8a8a")}
        <rect x={8} y={70} width={16} height={62} fill="url(#px-weave)" />
        {px(14, 132, 5, 4, "#8a9a9a")}
        {/* six pixels of near tile at the bottom, so the floor has a near edge */}
        {px(0, H - 6, W, 6, FLOORTILE[ph].deep)}
        {px(0, H - 6, W, 1, FLOORTILE[ph].lo)}
        {/* and the steam that has reached the lens */}
        {s && humid(s) ? (
          <rect x={0} y={0} width={W} height={H} fill={dth("c", "06")} opacity={0.5} />
        ) : null}
        <Vignette set={VIGNETTE} strength={s?.lit ? 0.7 : 1} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * effects — the light, and anything the player is doing right now
 * ================================================================== */

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.5 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

/**
 * A colour cast, not a second darkness. `darkness()` still owns brightness via
 * roomDarkness — this only says what temperature the room is at this hour, and
 * the numbers stay small on purpose. Raising them here fights the engine.
 */
const CAST: Record<Ph, { fill: string; lit: number; dark: number }> = {
  dawn: { fill: "#7a7aa0", lit: 0.05, dark: 0.14 },
  day: { fill: "#8fa8b8", lit: 0.02, dark: 0.07 },
  dusk: { fill: "#c07a42", lit: 0.06, dark: 0.16 },
  night: { fill: "#0e1420", lit: 0.08, dark: 0.24 },
};

function BathEffects({
  world,
  phase,
  scale,
  actionUi,
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
  const s = state(world);
  const cast = CAST[ph];
  return (
    <>
      {/* steam is real DOM, so it can blur without breaking the pixel grid */}
      {s.tub === "filling" || s.tub === "full" ? <Steam x={214} y={118} scale={scale} /> : null}
      {s.towel === "wet" ? <Steam x={68} y={84} scale={scale} slow /> : null}
      {s.washer === "done" ? <Steam x={264} y={92} scale={scale} slow /> : null}
      {actionUi === "shower" ? <Steam x={204} y={72} scale={scale} /> : null}
      {/* while he showers, the tub front and the glass screen come forward and
          occlude him from the knees down — standing IN the tub, not before it */}
      {actionUi === "shower" ? (
        <svg
          aria-hidden="true"
          className="pixelated pointer-events-none absolute"
          style={{
            left: 184 * scale,
            top: 68 * scale,
            width: 62 * scale,
            height: 84 * scale,
            zIndex: 20,
          }}
          viewBox="184 68 62 84"
          preserveAspectRatio="none"
        >
          <g shapeRendering="crispEdges">
            <Bev set={TUB_SET} mat={CERAMIC[ph]} />
            {px(186, 142, 58, 8, CERAMIC[ph].lo)}
            <rect x={188} y={118} width={54} height={26} fill="url(#px-satin)" />
            <rect x={188} y={70} width={26} height={44} fill={K.glass} opacity={0.42} />
            <path
              d={pxPath([
                [188, 70, 26, 2],
                [188, 70, 2, 44],
                [212, 70, 2, 44],
              ])}
              fill={K.glassEdge}
            />
          </g>
        </svg>
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
          {/* the hour's colour temperature. Flat, so it tints without smearing. */}
          <rect
            width={W}
            height={H}
            fill={cast.fill}
            opacity={s.lit ? cast.lit : cast.dark}
            style={{ transition: STEP_FADE }}
          />
          {/* the window's own weak wash, which is there whether the lights are or not */}
          <Light set={WINDOW_WASH} op={ph === "night" ? 0.2 : 0.75} />
          {/* the two downlights. The left one is dying — discrete, never eased. */}
          {SPOTS.map((x, i) => (
            <g
              key={x}
              opacity={s.lit ? 1 : 0}
              style={{ transition: `opacity ${380 + i * 120}ms steps(3, end)` }}
            >
              <g>
                <Light set={SPOT_CONES[i]} />
                <Light set={SPOT_POOLS[i]} />
                {i === 0 && s.spotTired ? (
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="1;0.55;1;1;0.35;1;1;1"
                    dur="3.7s"
                    repeatCount="indefinite"
                  />
                ) : null}
              </g>
            </g>
          ))}
          <path
            d={SPOT_SOURCES.core}
            fill="#fff8e0"
            opacity={s.lit ? 0.95 : 0}
            style={{ transition: STEP_FADE }}
          />
          {/* the mirror halo throws a flat pool onto the vanity top */}
          {s.lit ? <Light set={VANITY_WASH} /> : null}

          {/* --- transients. None of this is in artKey, which is why it is here. --- */}
          {/* the tap, running */}
          {actionUi === "use" || s.tapOn ? (
            <g>
              <rect x={100} y={94} width={2} height={10} fill={K.waterHi} opacity={0.85}>
                <animate
                  attributeName="opacity"
                  values="0.85;0.6;0.9;0.7;0.85"
                  dur="0.4s"
                  repeatCount="indefinite"
                />
              </rect>
              <path
                d={pxPath([
                  [97, 103, 8, 1],
                  [95, 104, 3, 1],
                  [104, 104, 3, 1],
                ])}
                fill={K.foam}
                opacity={0.7}
              >
                <animate
                  attributeName="opacity"
                  values="0.7;0.4;0.65;0.45;0.7"
                  dur="0.55s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {/* the shower, off the rain head, in three stepped curtains */}
          {actionUi === "bath" ? (
            <g>
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={pxPath(repeat(6, 3, [197 + i, 58, 1, 52] as Rect))}
                  fill={dth("c", "25")}
                  opacity={0.55}
                >
                  <animate
                    attributeName="opacity"
                    calcMode="discrete"
                    values="0.55;0.3;0.5"
                    dur={`${0.22 + i * 0.07}s`}
                    repeatCount="indefinite"
                  />
                </path>
              ))}
              <path d={pxPath(steppedEllipse(204, 138, 16, 4, 2))} fill={K.foam} opacity={0.4} />
            </g>
          ) : null}
          {/* the flush: the cistern emptying into the pan, then refilling */}
          {actionUi === "toilet" ? (
            <g>
              <path
                d={pxPath([
                  [152, 122, 10, 4],
                  [154, 126, 6, 2],
                ])}
                fill={K.waterHi}
                opacity={0.7}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 157 125"
                  to="360 157 125"
                  dur="0.7s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          ) : null}
          {/* the machine finishing: two beeps' worth of amber on the wall */}
          {s.washer === "done" ? (
            <rect x={248} y={96} width={40} height={20} fill={dth("w", "12")} opacity={0.4}>
              <animate
                attributeName="opacity"
                calcMode="discrete"
                values="0.4;0.1;0.4;0.1"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}
          {/* a fly, when it is warm enough to bother, doing laps of the extractor */}
          {(ph === "day" || ph === "dusk") && !humid(s) ? (
            <g>
              <rect x={250} y={64} width={1} height={1} fill="#2e3033" opacity={0.85} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;16 10;-8 22;12 6;-12 14;0 0"
                dur="8.1s"
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
 * definition — the original seven hitboxes, at the original x and range
 * ================================================================== */

export const BATH_SCENE: RuntimeSceneDef<WorldState> = {
  id: "bath",
  width: W,
  /**
   * A bathroom is small, and the band is small with it: eighteen pixels, which
   * at this key is the half-metre of tile between the fittings and the door.
   * Shallower than the rooms either side of it on purpose — a bathroom you can
   * stride about in does not read as a bathroom.
   */
  ground: {
    top: FLOOR,
    bottom: 168,
    /* one surface in here, and it is wet more often than it is dry */
    zones: [{ x0: 0, x1: W, kind: "tile" }],
  },
  spawnX: 44,
  /**
   * Every world read the art performs, in order. Adding a read without adding
   * it here is the one mistake this file cannot survive.
   */
  artKey: (w, ph) => {
    const s = state(w);
    return [
      ph,
      s.lit ? 1 : 0,
      s.washer,
      s.tub,
      s.fog,
      s.towel,
      s.laundry,
      s.fern,
      s.paper,
      s.lidUp ? 1 : 0,
      s.tapOn ? 1 : 0,
      s.spotTired ? 1 : 0,
    ].join("|");
  },
  objects: [
    { id: "door-hall3", kind: "door", x: 24, range: 22, to: { scene: "studio", spawnX: 432 } },
    { id: "switch-bath", kind: "lamp", x: 54, range: 12 },
    /* --- new flavor hitboxes; these need translation entries --- */
    { id: "towel-rail", kind: "flavor", x: 70, range: 8 },
    { id: "sink", kind: "sport", action: "use", x: 100, range: 20 },
    { id: "shelf-bath", kind: "flavor", x: 128, range: 6 },
    { id: "toilet", kind: "toilet", x: 156, range: 20 },
    { id: "floor-drain", kind: "flavor", x: 181, range: 5 },
    { id: "tub", kind: "bath", x: 212, range: 24 },
    { id: "scales", kind: "flavor", x: 241, range: 5 },
    { id: "washer", kind: "washer", x: 264, range: 18 },
    { id: "laundry-basket", kind: "flavor", x: 292, range: 10 },
  ],
  Component: BathArt,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.bath),
  Foreground: (p) => <BathFront {...p} />,
  Effects: BathEffects,
  idleLean: true,
};
