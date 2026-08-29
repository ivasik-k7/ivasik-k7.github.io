import {
  AOSet,
  aoPaths,
  Bev,
  Bevel,
  bevelPaths,
  Contact,
  contactPaths,
  dth,
  LayeredScene,
  Light,
  type LightTier,
  M,
  type Mat,
  Monologue,
  NpcActor,
  type Ph,
  PixelText,
  px,
  pxPath,
  type Rect,
  type RuntimeSceneDef,
  repeat,
  SharedDefs,
  steppedCone,
  steppedEllipse,
  steppedQuad,
  tiers,
  toPhase,
  Vignette,
  vignettePaths,
} from "@/engine";
import { bandShade, courses, plates, wearLane } from "@/engine/scene/groundKit";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";

// --- ŻABKA / the 24h shop on the ground floor ---------------------------------------

/**
 * A modern Polish convenience store, the one on the corner of the block, open
 * at three in the morning because it is always open.
 *
 * Five planes:
 *   farBackground (0.86) — the street through the corner glazing. Pavement, the
 *     kerb, a bus shelter, the block opposite. The only thing in this scene the
 *     hour touches.
 *   middleBackground (1.0) — the suspended ceiling, the green fascia band, the
 *     back wall, department signage, the fridge-wall carcass, the cigarette
 *     gantry. Everything fixed to the building.
 *   ground (1.0) — light grey large-format tile, floor graphics, wet patches.
 *     All hitboxes resolve against this plane.
 *   staticObjects (1.0) — the fixtures and the people: café counter, roller
 *     grill, bakery case, gondola island, freezer chest, multideck, kiosk,
 *     till, the clerk, a customer.
 *   Foreground (fixed) — the near anti-theft pedestal, two ceiling danglers,
 *     six pixels of near tile.
 *
 * LIGHTING PREMISE, and it is the inverse of every other scene in this game.
 * The flat is lit by the hour. A Żabka is lit by a contract: five LED troffers
 * at 4000K, the same at 03:00 as at noon, and that flatness is the whole
 * character of the place. So the phase does almost nothing to the interior —
 * `darkness()` returns 0 and there is no cast over the room. What the hour
 * changes is (a) what is out on the pavement and (b) which direction the light
 * is going through the glass: in by day, out by night, where the shop throws a
 * cold rectangle onto the paving stones and everything walking past is a
 * silhouette. The three other sources are local and coloured: the multideck
 * (cold, and it spills on the floor), the roller grill (warm, low), and the
 * green fascia band (which tints the ceiling and nothing else).
 *
 * All light is quantised — stepped cones off the troffers, a stepped rectangle
 * on the pavement, dithered edges. No gradients, no ellipses. The scene mounts
 * its own green and cold-white dither, prefixed `zb-`.
 *
 * STATE. Twelve reads, all off `world.zabka`, all defensive:
 *
 *   hotdogs    0..4 on the rollers — and the fourth has been on since morning
 *   coffee     idle → grinding → pouring → done
 *   bakery     0 empty → 3 just delivered
 *   shelves    full → picked → bare
 *   freezer    closed → open
 *   floor      clean → wet → spill
 *   clerk      counter → restocking → away
 *   kiosk      idle → scanning → error
 *   customer   none → browsing → paying
 *   parcels    0..3 waiting on the pickup shelf
 *   delivery   boolean — roll crates parked in the aisle before six
 *   panelDead  boolean — the third troffer is going, and it is never fixed
 *
 * TRANSIENTS. `actionUi` drives the coffee pour and the grill tongs from
 * ZabkaEffects. The art holds what is true when nobody is being served.
 *
 * SIGNAGE. The kit's 3x5 font has no B, C, D, G, H, J, L, M, Q, S, U, V, X or
 * Y, which rules out WODA, LODY, NAPOJE and HOT DOG. That constraint turned out
 * to be a gift: KAWA, PIEKARNIA, ZAPIEKANKI, KANAPKI, PIWO, ZAPPKA, OTWARTE and
 * ERROR all fit, and every one of them is a sign this shop really carries. The
 * wordmark and the frog are hand-drawn below at 5x7 and 11x8 rather than set in
 * the font, because a fascia logotype is not body text.
 *
 * TRADEMARK. The mark below is a deliberately generic green frog and a
 * hand-drawn wordmark, not a trace of the real logo. If this ships anywhere
 * commercial, clear the name and mark first or swap both for your own.
 *
 * Budget: ~350 nodes at the busiest state, 23 animations, 16 of them on
 * calcMode="discrete" so nothing eases. Zero gradients, zero ellipses. The tile
 * floor is two paths, the ceiling grid three, the multideck's 48 facings seven.
 */

const W = 620;
const H = 180;

/* Landmark rows. A shop is a stack of horizontal bands and these are them. */
const VOID = 22; // black ceiling void above the grid
const GRID = 32; // underside of the suspended grid
const BAND = 34; // the green fascia band
const SIGN = 48; // department signage row
const FIX = 60; // top of the tall fixtures
const WORK = 108; // worktop height, café through grill
const TILL = 108; // counter top
const FLOOR = 150; // tile surface — same as every other scene, so feet line up
const CY = 149;

/** The five troffers. The third one is the one that goes. */
const TROFFERS = [64, 188, 312, 436, 560] as const;

/* ================================================================== *
 * palette
 * ================================================================== */

/** The brand green, and the lime the newer fit-outs put next to it. */
const ZGREEN: Mat = {
  hi: "#3fd07f",
  base: "#00a651",
  mid: "#00954a",
  lo: "#008541",
  deep: "#00602f",
};
const ZLIME: Mat = {
  hi: "#b6e06a",
  base: "#8cc63f",
  mid: "#7db336",
  lo: "#6d9e2e",
  deep: "#527a20",
};
/** Light grey porcelain, 40px format. A shop floor is brighter than a flat's. */
const SHOPFLOOR: Mat = {
  hi: "#d6d8da",
  base: "#c2c5c8",
  mid: "#b6b9bc",
  lo: "#a8abae",
  deep: "#8b8e91",
};
/** Gloss white wall panel, and the ceiling tile above it. */
const PANEL: Mat = {
  hi: "#fbfbfc",
  base: "#eef0f1",
  mid: "#e2e4e6",
  lo: "#d4d7d9",
  deep: "#b8bbbe",
};
const CEILTILE: Mat = {
  hi: "#f6f7f8",
  base: "#e8eaec",
  mid: "#dcdee0",
  lo: "#cdd0d2",
  deep: "#b2b5b8",
};
/** Chilled steel: multideck, grill, chest freezer. */
const COLDSTEEL: Mat = {
  hi: "#e4e9ec",
  base: "#c4cbd0",
  mid: "#b4bbc0",
  lo: "#a2a9ae",
  deep: "#7f868b",
};
/** Beech laminate worktop, the one every fit-out in the country uses. */
const BEECH: Mat = {
  hi: "#e0c79a",
  base: "#c9a877",
  mid: "#bb9a6a",
  lo: "#a8885b",
  deep: "#836941",
};

const K = {
  /** the pavement and the sky, per hour — the only phase-driven colours here */
  sky: { dawn: "#a8a2c0", day: "#bcd2e0", dusk: "#d8a478", night: "#141a24" } as Record<Ph, string>,
  paving: { dawn: "#8a8894", day: "#a8a6a2", dusk: "#a8886e", night: "#2a2f38" } as Record<
    Ph,
    string
  >,
  glass: "#cfe0e6",
  glassEdge: "#8fa6ac",
  void: "#191b1d",
  /** LED at 4000K, which is not warm and is not meant to be */
  led: "#eef6ff",
  ledDead: "#8f9498",
  /** the roller grill, and what is on it */
  grillWarm: "#ff9a3a",
  sausage: "#c2703a",
  sausageHi: "#d98a4e",
  sausageOld: "#8f5228",
  bun: "#d9ab6a",
  ketchup: "#c22a22",
  mustard: "#e0b429",
  /** the fridge's interior and the cans in it */
  chill: "#dff0f6",
  chillDeep: "#2e4048",
  energy: "#c8f03a",
  energyAlt: "#3ab0e0",
  beer: "#c9a24b",
  beerAlt: "#7a3a34",
  dairy: "#f0f0e8",
  frost: "#eaf6fa",
  /** signage, receipts, and the small red things */
  red: M.red.base,
  amber: "#e8a445",
  screen: "#12242e",
  screenText: "#7ee08c",
  errorRed: "#e04a3a",
  receipt: "#f4f2e8",
  gum: "#2e2c28",
  crate: "#2f6ab0",
  crateHi: "#4a86cc",
  cardboard: "#b08a5e",
  mop: "#e8c445",
  scuff: "#b0b3b6",
} as const;

/* ================================================================== *
 * state
 * ================================================================== */

export type CoffeeStage = "idle" | "grinding" | "pouring" | "done";
export type ShelfStage = "full" | "picked" | "bare";
export type FloorStage = "clean" | "wet" | "spill";
export type ClerkStage = "counter" | "restocking" | "away";
export type KioskStage = "idle" | "scanning" | "error";
export type CustomerStage = "none" | "browsing" | "paying";

const COFFEE_STAGES: readonly CoffeeStage[] = ["idle", "grinding", "pouring", "done"];
const SHELF_STAGES: readonly ShelfStage[] = ["full", "picked", "bare"];
const FLOOR_STAGES: readonly FloorStage[] = ["clean", "wet", "spill"];
const CLERK_STAGES: readonly ClerkStage[] = ["counter", "restocking", "away"];
const KIOSK_STAGES: readonly KioskStage[] = ["idle", "scanning", "error"];
const CUSTOMER_STAGES: readonly CustomerStage[] = ["none", "browsing", "paying"];

type ZabkaState = {
  hotdogs: 0 | 1 | 2 | 3 | 4;
  coffee: CoffeeStage;
  bakery: 0 | 1 | 2 | 3;
  shelves: ShelfStage;
  freezerOpen: boolean;
  floor: FloorStage;
  clerk: ClerkStage;
  kiosk: KioskStage;
  customer: CustomerStage;
  parcels: 0 | 1 | 2 | 3;
  delivery: boolean;
  panelDead: boolean;
};

function clampStage<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.trunc(v)))
    : fallback;
}

/** `world.zabka` may not exist. Defaults describe the shop at about nine a.m. */
function state(world: WorldState): ZabkaState {
  const b = ((world as unknown as Record<string, unknown>).zabka ?? {}) as Record<string, unknown>;
  return {
    hotdogs: clampInt(b.hotdogs, 4, 3) as 0 | 1 | 2 | 3 | 4,
    coffee: clampStage(b.coffee, COFFEE_STAGES, "idle"),
    bakery: clampInt(b.bakery, 3, 2) as 0 | 1 | 2 | 3,
    shelves: clampStage(b.shelves, SHELF_STAGES, "full"),
    freezerOpen: b.freezerOpen === true,
    floor: clampStage(b.floor, FLOOR_STAGES, "clean"),
    clerk: clampStage(b.clerk, CLERK_STAGES, "counter"),
    kiosk: clampStage(b.kiosk, KIOSK_STAGES, "idle"),
    customer: clampStage(b.customer, CUSTOMER_STAGES, "browsing"),
    parcels: clampInt(b.parcels, 3, 2) as 0 | 1 | 2 | 3,
    delivery: b.delivery === true,
    panelDead: b.panelDead !== false,
  };
}

/* ================================================================== *
 * scene-local dither — the kit has no green, and shop LED is its own colour
 * ================================================================== */

function ZabkaDefs() {
  return (
    <defs>
      <pattern id="zb-dg50" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={ZGREEN.hi} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={ZGREEN.hi} fillOpacity="0.55" />
      </pattern>
      <pattern id="zb-dg25" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={ZGREEN.hi} fillOpacity="0.5" />
      </pattern>
      {/* 4000K, the colour of a shop at three in the morning */}
      <pattern id="zb-dl50" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.led} fillOpacity="0.55" />
        <rect x="1" y="1" width="1" height="1" fill={K.led} fillOpacity="0.55" />
      </pattern>
      <pattern id="zb-dl25" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.led} fillOpacity="0.5" />
      </pattern>
      <pattern id="zb-dl12" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.led} fillOpacity="0.45" />
        <rect x="2" y="2" width="1" height="1" fill={K.led} fillOpacity="0.45" />
      </pattern>
      {/* the grill, which is the only warm thing in the building */}
      <pattern id="zb-dh25" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill={K.grillWarm} fillOpacity="0.5" />
      </pattern>
      {/* speckle in the porcelain, coarser than the kit's aggregate */}
      <pattern id="zb-speck" width="9" height="9" patternUnits="userSpaceOnUse">
        <rect x="2" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
        <rect x="6" y="4" width="1" height="1" fill="#000000" opacity="0.07" />
        <rect x="3" y="7" width="1" height="1" fill="#000000" opacity="0.05" />
      </pattern>
    </defs>
  );
}

/** Three tiers by hand, since tiers() only knows the kit's four tints. */
/**
 * v2, matching the kit: four SOLID bands at whisper alpha instead of dithered
 * tiers — banding is the honest pixel gradient, speckle was just noise. The
 * pattern ids are kept in the signature so call sites stay untouched, but the
 * light itself is now pure brand colour.
 */
function localTiers(
  build: (k: number) => Rect[],
  _ids: [mid: string, outer: string],
  solid: string,
  strength = 1,
): LightTier[] {
  return [
    { d: pxPath(build(1)), fill: solid, o: 0.07 * strength },
    { d: pxPath(build(0.78)), fill: solid, o: 0.08 * strength },
    { d: pxPath(build(0.52)), fill: solid, o: 0.1 * strength },
    { d: pxPath(build(0.3)), fill: solid, o: 0.12 * strength },
  ];
}

/* ================================================================== *
 * the mark — hand-drawn, because a fascia logotype is not body text
 * ================================================================== */

/** 5x7 glyphs, only the five letters the wordmark needs. Ż keeps its dot. */
const LOGO_GLYPHS: Record<string, string[]> = {
  Z: ["00100", "11111", "00010", "00100", "01000", "10000", "11111"],
  A: ["00000", "01110", "10001", "10001", "11111", "10001", "10001"],
  B: ["00000", "11110", "10001", "11110", "10001", "10001", "11110"],
  K: ["00000", "10001", "10010", "11100", "10010", "10001", "10001"],
};

function logoPath(text: string, x: number, y: number, gap = 1): string {
  const out: Rect[] = [];
  let cx = x;
  for (const ch of text) {
    const rows = LOGO_GLYPHS[ch];
    if (!rows) {
      cx += 3 + gap;
      continue;
    }
    for (let r = 0; r < rows.length; r++) {
      let c = 0;
      while (c < 5) {
        if (rows[r][c] === "1") {
          let run = 1;
          while (c + run < 5 && rows[r][c + run] === "1") run++;
          out.push([cx + c, y + r, run, 1]);
          c += run;
        } else c++;
      }
    }
    cx += 5 + gap;
  }
  return pxPath(out);
}

/** A generic frog head — two eyes, two front feet. Not a trace of the real mark. */
const FROG_ROWS = [
  "..1111111..",
  ".111111111.",
  "11011111011",
  "11011111011",
  "11111111111",
  ".111111111.",
  "..1111111..",
  ".11.....11.",
];

function frogPath(x: number, y: number): string {
  const out: Rect[] = [];
  for (let r = 0; r < FROG_ROWS.length; r++) {
    let c = 0;
    while (c < FROG_ROWS[r].length) {
      if (FROG_ROWS[r][c] === "1") {
        let run = 1;
        while (c + run < FROG_ROWS[r].length && FROG_ROWS[r][c + run] === "1") run++;
        out.push([x + c, y + r, run, 1]);
        c += run;
      } else c++;
    }
  }
  return pxPath(out);
}

const FASCIA_LOGO = logoPath("ZABKA", 22, 35);
const FASCIA_FROG = frogPath(6, 35);
/** and the same frog repeated along the band, smaller, as wallpaper does */
const BAND_FROGS = pxPath(
  Array.from({ length: 6 }, (_, i) => [88 + i * 92, 37, 3, 3] as Rect).flatMap(
    ([x, y]) =>
      [
        [x, y, 3, 1],
        [x - 1, y + 1, 5, 1],
        [x, y + 2, 3, 1],
      ] as Rect[],
  ),
);

/* ================================================================== *
 * precomputed geometry
 * ================================================================== */

/** 40x wide porcelain, staggered every other course, 2px joints. */
/**
 * The shop floor: 40 cm porcelain in stretcher bond, foreshortening toward the
 * camera, with the odd tile from a different box. It was one fixed 15 px pitch
 * and read as a wall the shelves were standing against.
 */
const TILE_FIELD = courses(0, W, FLOOR, H, { far: 11, near: 15, unit: 40, stagger: true });
const TILE_TONE = plates(0, W, FLOOR, H, {
  far: 11,
  near: 15,
  unit: 40,
  stagger: true,
  seed: 3,
  dark: 0.1,
  pale: 0.08,
});
const FLOOR_SHADE = bandShade(0, W, FLOOR, H);
/** The aisle everybody walks: door, coffee, till. Polished a shade paler. */
const AISLE_WEAR = [wearLane(64, 560, FLOOR + 9, 3, 16), wearLane(120, 480, FLOOR + 14, 2, 17)];

/** The suspended grid: T-bars across and down, and the tile field between. */
const CEIL_GRID = {
  tee: pxPath([
    [0, VOID, W, 1],
    [0, GRID - 1, W, 1],
    ...repeat(16, 40, [0, VOID, 1, GRID - VOID] as Rect),
  ]),
  troffer: pxPath(TROFFERS.map((x) => [x - 26, VOID + 2, 52, 5] as Rect)),
  trofferCore: pxPath(TROFFERS.map((x) => [x - 24, VOID + 3, 48, 2] as Rect)),
  /** sprinkler heads, on the same grid, because they have to be */
  sprinkler: pxPath([
    [126, VOID + 1, 2, 3],
    [374, VOID + 1, 2, 3],
    [502, VOID + 1, 2, 3],
  ]),
};

/** Cable tray and duct in the black void above the grid. */
const VOID_KIT = pxPath([[0, 6, W, 3], [0, 12, W, 1], ...repeat(11, 60, [20, 9, 2, 3] as Rect)]);

/** The multideck: four shelves of cans, batched by colour. x462..534 */
const MULTIDECK = (() => {
  const rows = [70, 88, 106, 124];
  const energy: Rect[] = [];
  const energyAlt: Rect[] = [];
  const beer: Rect[] = [];
  const beerAlt: Rect[] = [];
  const dairy: Rect[] = [];
  const shelf: Rect[] = [];
  const strip: Rect[] = [];
  rows.forEach((y, r) => {
    shelf.push([464, y + 14, 68, 2]);
    strip.push([464, y + 13, 68, 1]);
    for (let i = 0; i < 12; i++) {
      const x = 465 + i * 6;
      const box: Rect = [x, y + 2, 5, 12];
      if (r === 0) (i % 3 === 0 ? energyAlt : energy).push(box);
      else if (r === 1) (i % 4 === 0 ? energyAlt : energy).push(box);
      else if (r === 2) (i % 3 === 0 ? beerAlt : beer).push(box);
      else dairy.push(box);
    }
  });
  const lid = (src: Rect[]): Rect[] => src.map(([x, y, w]) => [x, y, w, 1] as Rect);
  return {
    shelf: pxPath(shelf),
    strip: pxPath(strip),
    energy: pxPath(energy),
    energyAlt: pxPath(energyAlt),
    beer: pxPath(beer),
    beerAlt: pxPath(beerAlt),
    dairy: pxPath(dairy),
    lids: pxPath([...lid(energy), ...lid(energyAlt), ...lid(beer), ...lid(beerAlt), ...lid(dairy)]),
  };
})();

/** The gondola island, x354..418, three tiers on the near face. */
const GONDOLA_TIERS = [110, 124, 138] as const;
const GONDOLA = {
  shelf: pxPath(GONDOLA_TIERS.map((y) => [354, y + 12, 64, 2] as Rect)),
  rail: pxPath(GONDOLA_TIERS.map((y) => [354, y + 11, 64, 1] as Rect)),
};

/** Cigarette gantry: the closed doors the law requires, x566..618. */
const GANTRY = {
  door: pxPath(repeat(4, 13, [568, 62, 12, 40] as Rect)),
  handle: pxPath(repeat(4, 13, [573, 80, 3, 2] as Rect)),
};

/** Stepped light. Five troffer cones, one pavement rectangle, two local spills. */
const TROFFER_CONES = TROFFERS.map((x) =>
  localTiers(
    (k) => steppedCone(x, GRID, Math.round(24 * k), FLOOR, Math.round(56 * k), 10),
    ["zb-dl25", "zb-dl12"],
    K.led,
    0.75,
  ),
);
const TROFFER_POOLS = TROFFERS.map((x) =>
  localTiers(
    (k) => steppedEllipse(x, FLOOR + 10, Math.round(52 * k), Math.round(10 * k), 2),
    ["zb-dl25", "zb-dl12"],
    K.led,
    0.6,
  ),
);
/** What the multideck does to the tile in front of it: cold, and it never stops. */
const FRIDGE_SPILL = tiers(
  (k) => steppedQuad(FLOOR, 462 + (1 - k) * 14, 534 - (1 - k) * 14, H, 448, 548, 6),
  "c",
  0.8,
);
/** The freezer lid, open: cold light climbs out and pools on the tile. */
const FREEZER_SPILL = localTiers(
  (k) => steppedEllipse(444, 124, Math.round(20 * k), Math.round(7 * k), 2),
  ["zb-dl25", "zb-dl12"],
  K.led,
  0.9,
);
/** The grill, warm and low, on the worktop and the wall behind it. */
const GRILL_GLOW = localTiers(
  (k) => steppedEllipse(240, 92, Math.round(34 * k), Math.round(22 * k), 2),
  ["zb-dh25", "zb-dh25"],
  K.grillWarm,
  0.7,
);
/** The green band tints the ceiling tile above it and nothing else. */
const BAND_BOUNCE = localTiers(
  (k) => steppedQuad(GRID - 6, 0 + (1 - k) * 40, W - (1 - k) * 40, BAND, 0, W, 3),
  ["zb-dg25", "zb-dg25"],
  ZGREEN.hi,
  0.5,
);
/**
 * At night the shop is the brightest thing on the street. This lives in the
 * STREET plane's coordinates, not the scene's — the pavement is at y96..118
 * back there, and drawing it in the Effects overlay would have put a warm
 * rectangle on the shop's own floor instead.
 */
const PAVEMENT_SPILL = localTiers(
  (k) => steppedQuad(96, 0 + (1 - k) * 18, 148 - (1 - k) * 18, 152, -30, 196, 6),
  ["zb-dl25", "zb-dl12"],
  K.led,
  0.85,
);

const VIGNETTE = vignettePaths(W, H);

/* --- bevel sets, built once --- */

const DOOR_SET = bevelPaths([
  [12, FIX, 20, 90],
  [32, FIX, 20, 90],
]);
const CAFE_SET = bevelPaths([
  [150, WORK, 52, 4],
  [150, WORK + 4, 52, 38],
]);
const GRILL_SET = bevelPaths([
  [206, WORK, 68, 4],
  [206, WORK + 4, 68, 38],
]);
const BAKERY_SET = bevelPaths([
  [278, 68, 56, 4],
  [278, WORK + 4, 56, 38],
]);
const MULTIDECK_SET = bevelPaths([[462, FIX, 72, 90]]);
const FREEZER_SET = bevelPaths([[424, 116, 32, 34]]);
/** The island's top edge — anyone on the far side is cut off here. */
const GONDOLA_TOP = 104;
const GONDOLA_SET = bevelPaths([[354, GONDOLA_TOP, 64, 46]]);
const KIOSK_SET = bevelPaths([[536, 76, 26, 74]]);
const COUNTER_SET = bevelPaths([
  [564, TILL, 54, 4],
  [564, TILL + 4, 54, 38],
]);
const BIN_SET = bevelPaths([[136, 120, 14, 30]]);

const WALL_AO = aoPaths([
  [0, BAND + 10, W], // under the fascia band
  [150, WORK + 4, 52], // café worktop
  [206, WORK + 4, 68], // grill worktop
  [278, WORK + 4, 56], // bakery
  [462, FIX + 90, 72], // multideck
  [564, TILL + 4, 54], // counter
  [354, 104, 64], // gondola top
]);

const FLOOR_CONTACT = contactPaths([
  [12, 40, CY],
  [136, 14, CY],
  [150, 52, CY],
  [206, 68, CY],
  [278, 56, CY],
  [354, 64, CY],
  [424, 32, CY],
  [462, 72, CY],
  [536, 26, CY],
  [564, 54, CY],
]);

/** Floor graphics: the arrows every fit-out puts down and nobody follows. */
const FLOOR_ARROWS = pxPath(
  [96, 216, 336, 456].flatMap(
    (x) =>
      [
        [x, 168, 12, 2],
        [x + 8, 166, 2, 6],
        [x + 10, 167, 2, 4],
      ] as Rect[],
  ),
);
/** Wear: scuffs on the tile where the trolleys turn, gum, a dropped receipt. */
const SCUFFS = pxPath([
  [58, 160, 22, 1],
  [180, 172, 30, 1],
  [340, 158, 18, 1],
  [520, 166, 26, 1],
  [600, 174, 14, 1],
]);
const GUM = pxPath([
  [122, 164, 2, 2],
  [268, 175, 2, 2],
  [402, 162, 2, 2],
  [498, 171, 2, 2],
]);

/* ================================================================== *
 * PLANE 1 — the street through the corner glazing (parallax 0.86)
 * ================================================================== */

function Street({ ph }: { ph: Ph }) {
  const night = ph === "night";
  return (
    <g>
      {/* the defs live in the bottom-most plane and nowhere else */}
      <SharedDefs />
      <ZabkaDefs />
      {/* drawn far wider than the glazing so it never runs dry when it slides */}
      {px(-40, 30, 280, 70, K.sky[ph])}
      {/* the block opposite, and the shop below it that closed */}
      {px(-40, 44, 280, 52, night ? "#1c222a" : "#8f938e")}
      {px(-40, 44, 280, 2, night ? "#262d36" : "#9ea29c")}
      {px(-40, 78, 280, 18, night ? "#161b22" : "#7c807b")}
      {[
        { x: 4, lit: night },
        { x: 26, lit: false },
        { x: 48, lit: !night },
        { x: 78, lit: night },
        { x: 104, lit: false },
        { x: 130, lit: night },
      ].map((v) => (
        <g key={v.x}>
          {px(v.x, 52, 9, 11, v.lit ? "#e8c98a" : night ? "#0f1319" : "#5f6b74")}
          {px(v.x, 52, 9, 1, v.lit ? "#ffe0a8" : night ? "#161b22" : "#6f7b84")}
        </g>
      ))}
      {/* the bus shelter, which is where everyone eats the hot dog */}
      {px(64, 62, 46, 3, M.graphite.base)}
      {px(64, 62, 46, 1, M.graphite.hi)}
      {px(64, 65, 3, 32, M.graphite.mid)}
      {px(107, 65, 3, 32, M.graphite.mid)}
      {px(68, 66, 38, 26, night ? "#243040" : "#a8c2d4")}
      {px(70, 84, 34, 6, M.graphite.lo)}
      {/* the lit advertising panel in its end, on at all hours */}
      {px(110, 64, 12, 32, night ? "#e8e0c0" : "#dfe4e8")}
      {px(112, 66, 8, 28, night ? "#c93a4a" : "#b06a72")}
      {/* pavement, kerb, and the road going off the bottom */}
      {px(-40, 96, 280, 22, K.paving[ph])}
      <rect x={-40} y={96} width={280} height={22} fill="url(#zb-speck)" />
      {px(-40, 96, 280, 1, night ? "#3a4048" : "#b8b6b2")}
      {px(-40, 114, 280, 4, night ? "#1e232a" : "#8f8d89")}
      {px(-40, 118, 280, 34, night ? "#12161c" : "#5f6367")}
      {/* the paving joints, and the one slab that rocks when you stand on it */}
      <path
        d={pxPath(repeat(12, 24, [-36, 96, 1, 18] as Rect))}
        fill={night ? "#232830" : "#94928e"}
        opacity={0.6}
      />
      {px(40, 104, 24, 1, night ? "#2a3038" : "#8f8d89")}
      {/* a bike chained to the rack it has been chained to for a month */}
      {px(150, 88, 2, 10, M.steel.lo)}
      {px(170, 88, 2, 10, M.steel.lo)}
      {px(150, 88, 22, 2, M.steel.base)}
      {px(154, 82, 14, 8, night ? "#2a3038" : "#7a3b35")}
      {/* the recycling bins nobody empties, and a pigeon on them */}
      {px(196, 76, 16, 22, night ? "#1f2830" : "#3a7d84")}
      {px(196, 76, 16, 2, night ? "#28323c" : "#459098")}
      {px(214, 78, 14, 20, night ? "#1f2830" : "#8a6d2f")}
      {!night ? (
        <g>
          {px(200, 72, 7, 4, "#6d7278")}
          {px(206, 70, 4, 3, "#5d6266")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 203 74;0 203 74;-4 203 74;0 203 74;3 203 74;0 203 74"
            dur="8.3s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* rain, two speeds, two paths — it is Poland and it is probably raining */}
      {ph === "dusk" || night ? (
        <g>
          <path
            d={pxPath([
              [10, 30, 1, 5],
              [72, 30, 1, 4],
              [138, 30, 1, 5],
              [196, 30, 1, 4],
            ])}
            fill="#9fb6c8"
            opacity={0.45}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-8 90"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d={pxPath([
              [40, 30, 1, 4],
              [104, 30, 1, 6],
              [168, 30, 1, 4],
              [224, 30, 1, 5],
            ])}
            fill="#9fb6c8"
            opacity={0.3}
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;-5 90"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : null}
      {/* the shop's own light, landing on the paving stones */}
      {night || ph === "dusk" ? <Light set={PAVEMENT_SPILL} /> : null}
      {/* somebody walking past, which is all anyone out there ever does */}
      <g>
        <path
          d={pxPath([
            [0, 74, 7, 16],
            [1, 68, 5, 6],
            [0, 90, 3, 8],
            [4, 90, 3, 8],
          ])}
          fill={night ? "#0f1319" : "#3a3f47"}
        />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-20 0;-20 0;250 0;250 0"
          keyTimes="0;0.1;0.62;1"
          dur="34s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — ceiling, band, back wall, signage
 * ================================================================== */

function Ceiling({ s }: { s: ZabkaState }) {
  return (
    <g>
      {/* the black void, and the services running through it */}
      {px(0, 0, W, VOID, K.void)}
      <path d={VOID_KIT} fill="#2e3238" />
      <path d={pxPath([[0, 6, W, 1]])} fill="#3f444a" />
      {/* the suspended grid */}
      {px(0, VOID, W, GRID - VOID, CEILTILE.base)}
      <path d={CEIL_GRID.tee} fill={CEILTILE.deep} />
      <path d={CEIL_GRID.sprinkler} fill={M.brass.base} />
      {/* five troffers, and the third one is going */}
      <path d={CEIL_GRID.troffer} fill={PANEL.lo} />
      <path d={CEIL_GRID.trofferCore} fill={K.led} />
      {s.panelDead ? (
        <path d={pxPath([[TROFFERS[2] - 24, VOID + 3, 48, 2]])} fill={K.ledDead}>
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0;1;0;0;1;1;0"
            dur="2.9s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* dome cameras, ceiling speakers, and the air-con cassette */}
      <Bevel
        boxes={[
          [140, GRID, 10, 4],
          [468, GRID, 10, 4],
        ]}
        mat={PANEL}
      />
      <path
        d={pxPath([
          [142, GRID + 4, 6, 3],
          [470, GRID + 4, 6, 3],
        ])}
        fill="#2b2d30"
      />
      <path
        d={pxPath([
          [258, GRID, 8, 2],
          [530, GRID, 8, 2],
        ])}
        fill={PANEL.lo}
      />
      <Bevel boxes={[[340, VOID + 1, 40, 10]]} mat={PANEL} />
      <path d={pxPath(repeat(7, 5, [344, VOID + 4, 3, 5] as Rect))} fill={PANEL.deep} />
      {/* the green fascia band, the frog, the wordmark, and the wallpaper frogs */}
      {px(0, BAND, W, 10, ZGREEN.base)}
      {px(0, BAND, W, 1, ZGREEN.hi)}
      {px(0, BAND + 9, W, 1, ZGREEN.deep)}
      <path d={FASCIA_FROG} fill="#ffffff" />
      <path d={FASCIA_LOGO} fill="#ffffff" />
      <path d={BAND_FROGS} fill={ZLIME.hi} opacity={0.55} />
      <PixelText x={572} y={36} text="24/7" fill="#ffffff" gap={0} />
      {/* department signage, hung under the band */}
      {[
        { x: 152, w: 48, t: "KAWA" },
        { x: 210, w: 60, t: "ZAPIEKANKI" },
        { x: 280, w: 52, t: "PIEKARNIA" },
        { x: 356, w: 60, t: "KANAPKI" },
        { x: 464, w: 68, t: "PIWO" },
      ].map((d) => (
        <g key={d.x}>
          <Bevel boxes={[[d.x, SIGN, d.w, 9]]} mat={PANEL} />
          {px(d.x, SIGN, d.w, 2, ZGREEN.base)}
          <PixelText
            x={d.x + Math.max(2, Math.round((d.w - d.t.length * 4) / 2))}
            y={SIGN + 3}
            text={d.t}
            fill={ZGREEN.deep}
          />
        </g>
      ))}
    </g>
  );
}

function BackWall() {
  return (
    <g>
      {/* gloss white panel, and the joints between the sheets */}
      {px(0, BAND + 10, W, FLOOR - BAND - 10, PANEL.base)}
      <rect x={0} y={BAND + 10} width={W} height={FLOOR - BAND - 10} fill="url(#px-satin)" />
      <path
        d={pxPath(repeat(8, 78, [76, BAND + 10, 1, FLOOR - BAND - 10] as Rect))}
        fill={PANEL.lo}
      />
      {/* the skirting coving that gets scuffed by every roll cage */}
      {px(0, 144, W, 6, SHOPFLOOR.lo)}
      {px(0, 144, W, 1, SHOPFLOOR.hi)}
      <path
        d={pxPath([
          [210, 145, 40, 2],
          [430, 146, 30, 2],
        ])}
        fill={K.scuff}
        opacity={0.7}
      />
      {/* the small fixed things a shop wall carries and nobody looks at */}
      <Bevel boxes={[[338, 62, 12, 18]]} mat={M.red} />
      {px(340, 64, 8, 3, M.red.hi)}
      <Bevel boxes={[[338, 84, 12, 14]]} mat={PANEL} />
      {px(340, 86, 8, 8, "#c8dce2")}
      <Bevel boxes={[[418, 62, 34, 20]]} mat={PANEL} />
      <PixelText x={421} y={65} text="OTWARTE" fill={M.graphite.base} gap={0} />
      <PixelText x={430} y={72} text="24" fill={K.red} />
      {/* the clock every shop has, four minutes fast */}
      <Bevel boxes={[[300, 62, 18, 18]]} mat={M.graphite} />
      {px(302, 64, 14, 14, PANEL.hi)}
      <path
        d={pxPath([
          [308, 66, 1, 5],
          [309, 70, 4, 1],
        ])}
        fill={M.graphite.base}
      />
      {/* the noticeboard: the rota, a fire notice, and a lost-cat photocopy */}
      <Bevel boxes={[[104, 62, 30, 22]]} mat={BEECH} />
      <path
        d={pxPath([
          [107, 65, 11, 15],
          [120, 65, 11, 9],
          [120, 76, 8, 5],
        ])}
        fill={K.receipt}
      />
      <path
        d={pxPath([
          [108, 67, 8, 1],
          [108, 70, 6, 1],
          [108, 73, 7, 1],
        ])}
        fill="#b9b4a4"
      />
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — the tile
 * ================================================================== */

function Ground({ ph: _ph, s }: { ph: Ph; s: ZabkaState }) {
  return (
    <g>
      {px(0, FLOOR, W, H - FLOOR, SHOPFLOOR.mid)}
      <path d={TILE_FIELD.face} fill={SHOPFLOOR.base} />
      <path d={TILE_TONE.dark} fill={SHOPFLOOR.lo} opacity={0.4} />
      <path d={TILE_TONE.pale} fill={SHOPFLOOR.hi} opacity={0.45} />
      <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="url(#zb-speck)" />
      <path d={TILE_FIELD.hi} fill={SHOPFLOOR.hi} opacity={0.7} />
      <path d={TILE_FIELD.joints} fill={SHOPFLOOR.lo} opacity={0.6} />
      {px(0, FLOOR, W, 1, SHOPFLOOR.deep)}
      {AISLE_WEAR.map((d) => (
        <path key={d.slice(0, 12)} d={d} fill="#fff" opacity={0.09} />
      ))}
      <path d={FLOOR_SHADE.footSoft} fill="#171009" opacity={0.08} />
      <path d={FLOOR_SHADE.foot} fill="#171009" opacity={0.14} />
      {/* the entrance mat, and the anti-slip strip in front of it */}
      {px(6, 152, 52, 12, "#3f4448")}
      {px(6, 152, 52, 1, "#4f545a")}
      <rect x={6} y={152} width={52} height={12} fill="url(#px-weave)" />
      {px(60, 152, 4, 12, ZLIME.base)}
      {/* the arrows nobody follows, and the wear that shows where they do walk */}
      <path d={FLOOR_ARROWS} fill={ZLIME.base} opacity={0.5} />
      <path d={SCUFFS} fill={K.scuff} opacity={0.6} />
      <path d={GUM} fill={K.gum} opacity={0.7} />
      {/* a receipt somebody dropped between the till and the door */}
      {px(544, 170, 6, 3, K.receipt)}
      {px(544, 170, 6, 1, "#ffffff")}
      {/* the cable ramp over the till's power run */}
      {px(556, 158, 40, 3, M.enamel.lo)}
      <path d={pxPath(repeat(8, 5, [558, 158, 2, 3] as Rect))} fill={M.enamel.base} />
      {/* what the mop is dealing with today */}
      {s.floor !== "clean" ? (
        <g>
          <path
            d={pxPath(steppedEllipse(330, 166, 26, 7, 2))}
            fill={s.floor === "spill" ? "#c9a24b" : "#a8c2d4"}
            opacity={0.4}
          />
          <path
            d={pxPath(steppedEllipse(330, 164, 13, 3, 1))}
            fill={s.floor === "spill" ? "#dfb865" : "#cfe0ea"}
            opacity={0.4}
          />
        </g>
      ) : null}
      <Contact set={FLOOR_CONTACT} />
      <AOSet set={WALL_AO} />
    </g>
  );
}

/* ================================================================== *
 * PLANE 4 — fixtures
 * ================================================================== */

function Entrance({ ph, s }: { ph: Ph; s: ZabkaState }) {
  const night = ph === "night";
  return (
    <g>
      {/* the corner glazing: mullions, glass, and the street behind it */}
      <path
        d={pxPath([
          [0, FIX - 4, 146, 4],
          [0, FIX, 3, 90],
          [56, FIX, 4, 90],
          [143, FIX, 3, 90],
          [0, 146, 146, 4],
        ])}
        fill={M.graphite.base}
      />
      <path
        d={pxPath([
          [0, FIX - 4, 146, 1],
          [0, FIX, 1, 90],
        ])}
        fill={M.graphite.hi}
      />
      {/* the sliding doors, and the vinyl on them */}
      <Bev set={DOOR_SET} mat={{ ...COLDSTEEL, base: K.glass, mid: "#c2d4da", lo: "#b0c4ca" }} />
      <path
        d={pxPath([
          [14, 92, 16, 8],
          [34, 92, 16, 8],
        ])}
        fill={ZGREEN.base}
        opacity={0.85}
      />
      <path d={frogPath(16, 93)} fill="#ffffff" opacity={0.9} />
      <PixelText x={35} y={94} text="24" fill="#ffffff" />
      {/* the sensor above, and the mat that trips it */}
      {px(12, FIX - 8, 40, 4, M.graphite.mid)}
      <path d={pxPath([[30, FIX - 7, 3, 2]])} fill={K.errorRed} opacity={0.8}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.8;0.2;0.8;0.8"
          dur="3.3s"
          repeatCount="indefinite"
        />
      </path>
      {/* the anti-theft pedestal on the inside edge */}
      <Bevel boxes={[[60, 92, 8, 58]]} mat={PANEL} />
      {px(61, 94, 6, 54, "#e2e6e8")}
      <path d={pxPath([[62, 96, 4, 2]])} fill={ZGREEN.base} />
      {/* posters taped to the frontage, facing out, so we read them backwards */}
      {[
        { x: 66, y: 66, w: 22, h: 26 },
        { x: 92, y: 70, w: 20, h: 22 },
        { x: 116, y: 66, w: 24, h: 28 },
      ].map((p) => (
        <g key={p.x}>
          {px(p.x, p.y, p.w, p.h, K.receipt)}
          {px(p.x, p.y, p.w, 4, ZGREEN.base)}
          {px(p.x, p.y + p.h - 5, p.w, 5, K.red)}
          <path
            d={pxPath([
              [p.x + 2, p.y + 8, p.w - 6, 2],
              [p.x + 2, p.y + 13, p.w - 10, 2],
            ])}
            fill="#c2bdb0"
          />
        </g>
      ))}
      <PixelText x={120} y={80} text="1.99" fill={K.red} gap={0} />
      {/* the glass itself, over the top of everything behind it */}
      <rect x={3} y={FIX} width={53} height={90} fill={K.glass} opacity={0.16} />
      <rect x={60} y={FIX} width={83} height={90} fill={K.glass} opacity={0.16} />
      {night ? null : <path d={pxPath([[66, FIX, 18, 86]])} fill={dth("c", "12")} opacity={0.4} />}
      {/* the stack of baskets by the door, green, always slightly too full */}
      <Bevel boxes={[[72, 128, 22, 22]]} mat={ZGREEN} />
      <path
        d={pxPath(repeat(4, 5, [72, 130, 22, 1] as Rect, "y"))}
        fill={ZGREEN.hi}
        opacity={0.7}
      />
      {px(76, 124, 14, 4, ZGREEN.mid)}
      {/* the standing bar against the glass, and the two stools nobody moves */}
      {px(84, 116, 52, 4, BEECH.base)}
      {px(84, 116, 52, 2, BEECH.hi)}
      {px(84, 119, 52, 1, BEECH.deep)}
      <path
        d={pxPath([
          [88, 120, 2, 30],
          [130, 120, 2, 30],
        ])}
        fill={M.steel.lo}
      />
      {[98, 118].map((x) => (
        <g key={x}>
          <Bevel boxes={[[x, 130, 12, 3]]} mat={M.graphite} />
          {px(x + 5, 133, 2, 17, M.steel.base)}
          {px(x + 2, 148, 8, 2, M.steel.lo)}
        </g>
      ))}
      {/* somebody's finished cup and a crumpled napkin, left on the bar */}
      {px(104, 110, 7, 6, K.receipt)}
      {px(104, 110, 7, 2, ZGREEN.base)}
      {px(114, 113, 5, 3, "#e2ded0")}
      {/* the bin, and the lid that never quite shuts */}
      <Bev set={BIN_SET} mat={M.graphite} />
      {px(134, 118, 18, 3, M.graphite.hi)}
      {px(138, 116, 10, 2, M.graphite.mid)}
      {px(140, 121, 6, 3, "#5f5f5f")}
      {/* the wet floor sign, out whenever the floor is */}
      {s.floor !== "clean" ? (
        <g>
          <path
            d={pxPath([
              [304, 122, 12, 28],
              [316, 122, 12, 28],
            ])}
            fill={M.enamel.base}
          />
          <path d={pxPath([[304, 122, 24, 2]])} fill={M.enamel.hi} />
          <path
            d={pxPath([
              [308, 128, 4, 12],
              [318, 128, 4, 12],
            ])}
            fill={M.graphite.base}
          />
          {/* and the bucket it came with */}
          <Bevel boxes={[[286, 132, 16, 18]]} mat={{ ...M.teal, base: "#3a7d84" }} />
          {px(288, 128, 12, 4, M.steel.base)}
          {px(292, 100, 2, 32, BEECH.lo)}
        </g>
      ) : null}
    </g>
  );
}

function Cafe({ s }: { s: ZabkaState }) {
  const grinding = s.coffee === "grinding";
  const pouring = s.coffee === "pouring";
  const done = s.coffee === "done";
  return (
    <g>
      <Bev set={CAFE_SET} mat={BEECH} />
      {px(150, WORK + 4, 52, 38, BEECH.mid)}
      <rect x={150} y={WORK + 4} width={52} height={38} fill="url(#px-wood)" />
      {px(152, WORK + 10, 48, 1, BEECH.deep)}
      {/* the machine: black body, green cheek, screen, two spouts, drip tray */}
      <Bevel boxes={[[158, 64, 30, 44]]} mat={M.graphite} />
      {px(160, 66, 26, 40, "#2b2d30")}
      {px(184, 66, 4, 40, ZGREEN.base)}
      <Bevel boxes={[[162, 70, 16, 12]]} mat={{ ...M.graphite, base: K.screen }} />
      {grinding || pouring ? (
        <PixelText x={164} y={73} text="KAWA" fill={K.screenText} gap={0} />
      ) : (
        <PixelText x={166} y={73} text="OK" fill={K.screenText} />
      )}
      {/* the bean hopper on top, and the beans you can see through it */}
      {px(164, 58, 12, 6, "#3f444a")}
      {px(165, 59, 10, 4, "#4a3324")}
      <path
        d={pxPath([
          [166, 60, 2, 1],
          [170, 61, 2, 1],
          [173, 59, 2, 1],
        ])}
        fill="#5f4230"
      />
      {/* the group head and the cup under it */}
      {px(166, 88, 10, 4, M.steel.base)}
      {px(168, 92, 2, 3, M.steel.lo)}
      {px(173, 92, 2, 3, M.steel.lo)}
      {s.coffee !== "idle" ? (
        <g>
          {px(166, 96, 10, 10, K.receipt)}
          {px(166, 96, 10, 2, ZGREEN.base)}
          {done ? px(167, 98, 8, 3, "#3f2a1c") : null}
        </g>
      ) : null}
      {pouring ? (
        <rect x={170} y={95} width={2} height={4} fill="#5f4230">
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.6;1;0.75"
            dur="0.3s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {grinding ? (
        <path d={pxPath([[158, 64, 30, 44]])} fill={dth("n", "25")} opacity={0.25}>
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;1 0;0 0;0 1"
            dur="0.12s"
            repeatCount="indefinite"
          />
        </path>
      ) : null}
      {/* drip tray, and the ring of everything spilled on it */}
      {px(162, 106, 20, 2, M.steel.mid)}
      <path d={pxPath([[164, 106, 16, 1]])} fill="#5f4230" opacity={0.5} />
      {/* two cup towers, lids, sugar sticks, stirrers */}
      <path
        d={pxPath([
          [190, 88, 8, 20],
          [190, 88, 8, 1],
        ])}
        fill={K.receipt}
      />
      <path d={pxPath(repeat(5, 4, [190, 92, 8, 1] as Rect, "y"))} fill="#dcd8cc" />
      {px(190, 78, 8, 8, "#e2e6e8")}
      {px(152, 96, 8, 12, K.receipt)}
      {px(152, 96, 8, 2, ZLIME.base)}
      <path d={pxPath(repeat(4, 3, [153, 92, 1, 4] as Rect))} fill="#c2bdb0" />
      {/* the little milk fridge under the counter, with its own small light */}
      <Bevel boxes={[[152, 124, 20, 22]]} mat={COLDSTEEL} />
      {px(154, 126, 16, 18, K.chillDeep)}
      <path d={pxPath([[154, 126, 16, 1]])} fill={K.chill} opacity={0.7} />
      <path
        d={pxPath([
          [156, 130, 4, 10],
          [162, 130, 4, 10],
          [166, 132, 3, 8],
        ])}
        fill={K.dairy}
      />
    </g>
  );
}

function Grill({ s }: { s: ZabkaState }) {
  /** Five rollers. Sausages fill from the back; the fourth is this morning's. */
  const sausages = Array.from({ length: s.hotdogs }, (_, i) => i);
  return (
    <g>
      <Bev set={GRILL_SET} mat={BEECH} />
      {px(206, WORK + 4, 68, 38, BEECH.mid)}
      <rect x={206} y={WORK + 4} width={68} height={38} fill="url(#px-wood)" />
      {/* the microwave, for the zapiekanki, with its door shut and its clock wrong */}
      <Bevel boxes={[[206, 78, 32, 28]]} mat={COLDSTEEL} />
      {px(208, 80, 18, 24, K.screen)}
      {px(209, 81, 16, 22, "#1c3038")}
      <path d={pxPath(repeat(5, 3, [210, 82, 1, 20] as Rect))} fill="#2e4048" opacity={0.7} />
      {/* the clock that has said 0:00 since the last power cut */}
      <PixelText x={227} y={82} text="0:00" fill={K.errorRed} gap={0} />
      <path
        d={pxPath([
          [227, 92, 8, 2],
          [227, 96, 8, 2],
          [227, 100, 8, 2],
        ])}
        fill={COLDSTEEL.lo}
      />
      {/* the roller grill: steel pan, five chrome rollers, a warm floor to it */}
      <Bevel boxes={[[240, 84, 34, 22]]} mat={COLDSTEEL} />
      {px(242, 86, 30, 18, "#5f4a3a")}
      <path d={pxPath([[242, 86, 30, 1]])} fill={K.grillWarm} opacity={0.5} />
      <path
        d={pxPath(repeat(5, 4, [242, 96, 30, 1] as Rect, "y"))}
        fill={COLDSTEEL.hi}
        opacity={0.8}
      />
      {sausages.map((i) => (
        <g key={i}>
          {px(244, 88 + i * 4, 26, 3, i === 3 ? K.sausageOld : K.sausage)}
          {px(244, 88 + i * 4, 26, 1, i === 3 ? K.sausage : K.sausageHi)}
          {/* they turn, slowly, forever */}
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;1 0;0 0;-1 0"
            dur={`${2.6 + i * 0.4}s`}
            repeatCount="indefinite"
          />
        </g>
      ))}
      {/* the bun warmer above, and the tongs on their hook */}
      <Bevel boxes={[[240, 62, 34, 20]]} mat={COLDSTEEL} />
      {px(242, 64, 30, 16, "#c9a24b")}
      <rect x={242} y={64} width={30} height={16} fill="url(#zb-dh25)" opacity={0.3} />
      <path
        d={pxPath([
          [244, 68, 8, 8],
          [254, 68, 8, 8],
          [264, 68, 7, 8],
        ])}
        fill={K.bun}
      />
      <path
        d={pxPath([
          [244, 68, 8, 1],
          [254, 68, 8, 1],
          [264, 68, 7, 1],
        ])}
        fill="#e8c28a"
      />
      {px(276, 84, 2, 14, M.steel.base)}
      {px(274, 96, 6, 2, M.steel.lo)}
      {/* the condiment pumps, and the drip under the ketchup one */}
      <Bevel boxes={[[210, 108, 10, 16]]} mat={{ ...M.red, base: K.ketchup }} />
      <Bevel boxes={[[222, 108, 10, 16]]} mat={{ ...M.enamel, base: K.mustard }} />
      <path
        d={pxPath([
          [213, 104, 4, 4],
          [225, 104, 4, 4],
        ])}
        fill={M.graphite.base}
      />
      <path d={pxPath([[214, 124, 3, 2]])} fill={K.ketchup} opacity={0.7} />
      {/* napkins, paper sleeves, and the tray of tongs-for-the-bin */}
      {px(236, 112, 14, 8, K.receipt)}
      {px(236, 112, 14, 2, ZGREEN.base)}
      {px(254, 112, 16, 6, "#dcd8cc")}
      <path d={pxPath(repeat(4, 4, [255, 110, 2, 2] as Rect))} fill={K.receipt} />
      {/* the price card, wedged in the rail, corner curled */}
      {px(252, 122, 20, 8, K.receipt)}
      <PixelText x={254} y={124} text="4.49" fill={K.red} gap={0} />
    </g>
  );
}

function Bakery({ s }: { s: ZabkaState }) {
  /** Three tilted trays. Emptying goes back to front, as it does. */
  const trays = [
    { y: 78, n: s.bakery >= 3 ? 5 : s.bakery >= 2 ? 3 : s.bakery >= 1 ? 1 : 0, c: K.bun },
    { y: 92, n: s.bakery >= 2 ? 4 : s.bakery >= 1 ? 2 : 0, c: "#c9a877" },
    { y: 106, n: s.bakery >= 1 ? 4 : 1, c: "#b08a5e" },
  ];
  return (
    <g>
      {/* the case: steel base, glass front, three trays, a light in the top */}
      <Bev set={BAKERY_SET} mat={COLDSTEEL} />
      {px(278, 72, 56, 46, "#e8e4d8")}
      {px(278, 72, 56, 3, PANEL.hi)}
      <path d={pxPath([[280, 74, 52, 2]])} fill={K.led} opacity={0.8} />
      {trays.map((t) => (
        <g key={t.y}>
          {px(280, t.y + 8, 52, 2, COLDSTEEL.mid)}
          {px(280, t.y + 7, 52, 1, COLDSTEEL.hi)}
          <path
            d={pxPath(Array.from({ length: t.n }, (_, i) => [282 + i * 10, t.y, 9, 7] as Rect))}
            fill={t.c}
          />
          <path
            d={pxPath(Array.from({ length: t.n }, (_, i) => [282 + i * 10, t.y, 9, 1] as Rect))}
            fill="#e8c28a"
          />
          {/* the glaze and the poppy seeds, at this size, are two pixels each */}
          <path
            d={pxPath(Array.from({ length: t.n }, (_, i) => [285 + i * 10, t.y + 2, 3, 1] as Rect))}
            fill="#8a5a3a"
          />
        </g>
      ))}
      {/* the glass, over the front of all of it */}
      <rect x={278} y={72} width={56} height={46} fill={K.glass} opacity={0.18} />
      <path
        d={pxPath([
          [278, 72, 2, 46],
          [332, 72, 2, 46],
        ])}
        fill={K.glassEdge}
        opacity={0.6}
      />
      {/* tongs on a chain, paper bags in a slot, crumbs on the tray below */}
      {px(336, 84, 2, 10, M.steel.base)}
      {px(335, 94, 5, 3, M.steel.lo)}
      {px(280, 120, 18, 10, K.receipt)}
      <path d={pxPath(repeat(4, 4, [281, 118, 3, 3] as Rect))} fill="#e8e4d8" />
      <path
        d={pxPath([
          [302, 126, 24, 1],
          [306, 128, 14, 1],
        ])}
        fill="#c2a075"
        opacity={0.7}
      />
      {/* the price rail, and the card that has been wrong for a week */}
      {px(278, 130, 56, 6, PANEL.lo)}
      {px(278, 130, 56, 1, PANEL.hi)}
      <PixelText x={282} y={131} text="2.99" fill={M.graphite.base} gap={0} />
      <PixelText x={306} y={131} text="TANIE" fill={ZGREEN.deep} gap={0} />
    </g>
  );
}

function Gondola({ s }: { s: ZabkaState }) {
  /** How many facings survive per tier, by stock stage. */
  const n = s.shelves === "full" ? 8 : s.shelves === "picked" ? 5 : 2;
  const palette = ["#e8a445", "#c22a22", "#3ab0e0", "#8cc63f", "#e0b429", "#7a3a94"];
  return (
    <g>
      <Bev set={GONDOLA_SET} mat={PANEL} />
      <path d={GONDOLA.shelf} fill={PANEL.lo} />
      <path d={GONDOLA.rail} fill={PANEL.hi} />
      {/* the crisps, the sweets, the noodles — bright, because that is the job */}
      {GONDOLA_TIERS.map((y, t) => (
        <g key={y}>
          <path
            d={pxPath(
              Array.from({ length: n }, (_, i) => [356 + i * 8, y + 1, 7, 10] as Rect).filter(
                (_, i) => i % 2 === 0,
              ),
            )}
            fill={palette[t * 2]}
          />
          <path
            d={pxPath(
              Array.from({ length: n }, (_, i) => [356 + i * 8, y + 1, 7, 10] as Rect).filter(
                (_, i) => i % 2 === 1,
              ),
            )}
            fill={palette[t * 2 + 1]}
          />
          <path
            d={pxPath(Array.from({ length: n }, (_, i) => [356 + i * 8, y + 1, 7, 1] as Rect))}
            fill="#ffffff"
            opacity={0.35}
          />
          {/* the price strip under each tier */}
          <path d={pxPath([[354, y + 11, 64, 1]])} fill={ZGREEN.base} opacity={0.6} />
        </g>
      ))}
      {/* the hanging price rail on top, and the dump bin at the end */}
      {px(354, 98, 64, 7, PANEL.hi)}
      {px(354, 98, 64, 1, ZGREEN.base)}
      <PixelText x={358} y={99} text="2.49" fill={K.red} gap={0} />
      {s.shelves !== "bare" ? (
        <g>
          {px(340, 126, 14, 24, M.steel.lo)}
          <path d={pxPath(repeat(4, 6, [340, 128, 14, 1] as Rect, "y"))} fill={M.steel.base} />
          <path
            d={pxPath([
              [342, 122, 5, 5],
              [347, 124, 5, 4],
              [343, 128, 6, 4],
            ])}
            fill="#c22a22"
          />
        </g>
      ) : null}
      {/* the roll cages that arrived at three and are still in the aisle */}
      {s.delivery ? (
        <g>
          <path
            d={pxPath([
              [422, 122, 26, 28],
              [422, 122, 26, 2],
            ])}
            fill={K.crate}
          />
          {px(422, 122, 26, 2, K.crateHi)}
          <path d={pxPath(repeat(3, 9, [422, 130, 26, 2] as Rect, "y"))} fill={"#245c8a"} />
          {px(424, 116, 22, 6, K.cardboard)}
          {px(424, 116, 22, 1, "#c49c6e")}
        </g>
      ) : null}
    </g>
  );
}

function Freezer({ s }: { s: ZabkaState }) {
  return (
    <g>
      <Bev set={FREEZER_SET} mat={COLDSTEEL} />
      {px(426, 118, 28, 8, K.chillDeep)}
      {/* the ice cream inside, and the frost on everything */}
      <path
        d={pxPath([
          [428, 120, 5, 5],
          [434, 120, 5, 5],
          [440, 121, 5, 4],
          [446, 120, 6, 5],
        ])}
        fill="#e8a445"
      />
      <path
        d={pxPath([
          [428, 120, 5, 1],
          [434, 120, 5, 1],
          [446, 120, 6, 1],
        ])}
        fill="#f2c47a"
      />
      {/* the sliding glass lids: shut, or one shoved to the left */}
      {s.freezerOpen ? (
        <g>
          <rect x={426} y={116} width={14} height={4} fill={K.glass} opacity={0.4} />
          <path
            d={pxPath([
              [426, 116, 14, 1],
              [439, 116, 1, 4],
            ])}
            fill={K.glassEdge}
          />
          <path d={pxPath([[441, 118, 12, 3]])} fill={dth("c", "50")} opacity={0.6}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.6;0.35;0.55;0.4"
              dur="2.7s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      ) : (
        <g>
          <rect x={426} y={116} width={28} height={4} fill={K.glass} opacity={0.35} />
          <path
            d={pxPath([
              [426, 116, 28, 1],
              [439, 116, 2, 4],
            ])}
            fill={K.glassEdge}
          />
          <path
            d={pxPath([
              [430, 117, 8, 1],
              [444, 118, 6, 1],
            ])}
            fill={K.frost}
            opacity={0.7}
          />
        </g>
      )}
      {/* the temperature card taped to the end, and the frost line under it */}
      {px(424, 128, 12, 7, K.receipt)}
      <PixelText x={426} y={129} text="-18" fill={M.graphite.base} gap={0} />
      <path d={pxPath([[424, 144, 32, 2]])} fill={K.frost} opacity={0.4} />
    </g>
  );
}

function Multideck() {
  return (
    <g>
      {/* the carcass, the dark interior, and the four lit shelves */}
      <Bev set={MULTIDECK_SET} mat={COLDSTEEL} />
      {px(464, FIX + 2, 68, 86, K.chillDeep)}
      {px(464, FIX + 2, 68, 4, "#1e2c34")}
      <path d={MULTIDECK.shelf} fill={COLDSTEEL.lo} />
      <path d={MULTIDECK.strip} fill={K.chill} opacity={0.9} />
      <path d={MULTIDECK.energy} fill={K.energy} />
      <path d={MULTIDECK.energyAlt} fill={K.energyAlt} />
      <path d={MULTIDECK.beer} fill={K.beer} />
      <path d={MULTIDECK.beerAlt} fill={K.beerAlt} />
      <path d={MULTIDECK.dairy} fill={K.dairy} />
      <path d={MULTIDECK.lids} fill="#ffffff" opacity={0.4} />
      {/* the price rails, and the air curtain grille at the top */}
      <path
        d={pxPath(repeat(4, 18, [464, 82, 68, 2] as Rect, "y"))}
        fill={PANEL.base}
        opacity={0.9}
      />
      <path d={pxPath(repeat(8, 9, [466, 62, 5, 2] as Rect))} fill={COLDSTEEL.deep} />
      {/* the gap where the last of something was taken */}
      {px(500, 108, 6, 12, K.chillDeep)}
      {/* the cold air, falling out of it, which is why you feel it from the aisle */}
      <path d={pxPath([[464, 140, 68, 8]])} fill={dth("c", "25")} opacity={0.45}>
        <animate
          attributeName="opacity"
          calcMode="discrete"
          values="0.45;0.3;0.42;0.34"
          dur="4.6s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

function Kiosk({ s }: { s: ZabkaState }) {
  const err = s.kiosk === "error";
  return (
    <g>
      <Bev set={KIOSK_SET} mat={PANEL} />
      {px(536, 76, 26, 4, ZGREEN.base)}
      {/* the screen, which is either fine or is not */}
      <Bevel boxes={[[538, 82, 22, 20]]} mat={M.graphite} />
      {px(540, 84, 18, 16, err ? "#3a1416" : K.screen)}
      {err ? (
        <g>
          <PixelText x={542} y={88} text="ERROR" fill={K.errorRed} gap={0} />
          <PixelText x={546} y={95} text="24" fill={K.errorRed} gap={0} />
          <rect x={540} y={84} width={18} height={16} fill={K.errorRed} opacity={0.12}>
            <animate
              attributeName="opacity"
              calcMode="discrete"
              values="0.12;0;0.12;0"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        <g>
          <PixelText x={540} y={88} text="ZAPPKA" fill={K.screenText} gap={0} />
          {s.kiosk === "scanning" ? (
            <rect x={542} y={95} width={4} height={2} fill={K.screenText}>
              <animate
                attributeName="width"
                calcMode="discrete"
                values="4;8;12;14"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </rect>
          ) : (
            <PixelText x={546} y={95} text="OK" fill={K.screenText} />
          )}
        </g>
      )}
      {/* the scanner window, the card reader, the bagging shelf */}
      {px(538, 104, 22, 6, "#2b2d30")}
      <path d={pxPath([[540, 106, 18, 2]])} fill={err ? "#5f2a2a" : K.errorRed} opacity={0.7}>
        {!err ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="0.7;0.4;0.7"
            dur="2.1s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
      <Bevel boxes={[[540, 114, 14, 10]]} mat={M.graphite} />
      {px(542, 116, 10, 5, "#1c2c34")}
      {px(536, 128, 26, 3, PANEL.lo)}
      {/* the status beacon on the pole, green or amber, visible from the till */}
      {px(548, 68, 2, 8, M.steel.lo)}
      <path d={pxPath([[545, 62, 8, 6]])} fill={err ? K.amber : ZGREEN.base}>
        {err ? (
          <animate
            attributeName="opacity"
            calcMode="discrete"
            values="1;0.3;1;0.3"
            dur="0.9s"
            repeatCount="indefinite"
          />
        ) : null}
      </path>
    </g>
  );
}

function Counter({ s }: { s: ZabkaState }) {
  return (
    <g>
      {/* the cigarette gantry: four closed doors, because the law says closed */}
      <Bevel boxes={[[566, 60, 52, 44]]} mat={PANEL} />
      <path d={GANTRY.door} fill={M.graphite.lo} />
      <path d={pxPath(repeat(4, 13, [568, 62, 12, 1] as Rect))} fill={M.graphite.hi} />
      <path d={GANTRY.handle} fill={M.steel.base} />
      <Bevel boxes={[[604, 62, 12, 12]]} mat={PANEL} />
      <PixelText x={607} y={65} text="18" fill={K.red} />
      {/* the parcel pickup shelf above, and what is waiting on it */}
      {px(566, 56, 52, 4, PANEL.lo)}
      {px(566, 56, 52, 1, PANEL.hi)}
      {s.parcels > 0 ? (
        <path
          d={pxPath(
            Array.from({ length: s.parcels }, (_, i) => [570 + i * 15, 46, 13, 10] as Rect),
          )}
          fill={K.cardboard}
        />
      ) : null}
      {s.parcels > 0 ? (
        <path
          d={pxPath(Array.from({ length: s.parcels }, (_, i) => [570 + i * 15, 46, 13, 1] as Rect))}
          fill="#c49c6e"
        />
      ) : null}
      {/* the counter itself, green edge, and everything that lives on it */}
      <Bev set={COUNTER_SET} mat={PANEL} />
      {px(564, TILL, 54, 2, ZGREEN.base)}
      {px(564, TILL + 4, 54, 38, PANEL.mid)}
      <path d={pxPath([[566, TILL + 12, 50, 1]])} fill={PANEL.deep} />
      {/* the monitor, angled away, and the receipt printer beside it */}
      <Bevel boxes={[[568, 88, 22, 20]]} mat={M.graphite} />
      {px(570, 90, 18, 14, K.screen)}
      <PixelText x={572} y={92} text="12.98" fill={K.screenText} gap={0} />
      <path
        d={pxPath([
          [572, 100, 12, 1],
          [572, 102, 8, 1],
        ])}
        fill="#2e4048"
      />
      <Bevel boxes={[[594, 96, 12, 12]]} mat={PANEL} />
      {px(596, 94, 8, 3, K.receipt)}
      {/* the card terminal on its little stand, and what it is asking for */}
      <Bevel boxes={[[606, 96, 12, 12]]} mat={M.graphite} />
      {px(607, 98, 10, 7, K.screen)}
      <PixelText x={607} y={99} text="PIN" fill={K.screenText} gap={0} />
      {/* the impulse rack on the front: gum, lighters, and a charity box */}
      <path d={pxPath(repeat(6, 8, [566, 116, 6, 8] as Rect))} fill={ZLIME.base} />
      <path d={pxPath(repeat(6, 8, [566, 116, 6, 1] as Rect))} fill={ZLIME.hi} />
      <path d={pxPath(repeat(5, 6, [568, 128, 4, 9] as Rect))} fill={K.ketchup} />
      <Bevel boxes={[[602, 112, 14, 12]]} mat={{ ...M.enamel, base: "#e8c445" }} />
      {px(606, 110, 6, 3, M.graphite.base)}
      {/* the Żappka stand: a QR code, which at this size is a checkerboard */}
      {px(556, 96, 12, 12, K.receipt)}
      {px(556, 96, 12, 3, ZGREEN.base)}
      <path
        d={pxPath([
          [558, 100, 2, 2],
          [562, 100, 2, 2],
          [560, 102, 2, 2],
          [558, 104, 2, 2],
          [564, 104, 2, 2],
        ])}
        fill={M.graphite.base}
      />
      {/* the hand sanitiser nobody has touched since 2022, and a desk fan */}
      <Bevel boxes={[[550, 112, 8, 14]]} mat={PANEL} />
      {px(552, 110, 4, 3, M.graphite.base)}
      <Bevel boxes={[[592, 76, 12, 10]]} mat={M.graphite} />
      <path d={pxPath([[594, 78, 8, 6]])} fill={M.steel.lo}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 598 81"
          to="360 598 81"
          dur="0.4s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

/** The clerk. Behind the till, restocking the fridge, or on a break out back. */
// The hand-drawn Clerk, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Clerk({ s }: { s: ZabkaState }) {
  if (s.clerk === "away") return null;
  const atCounter = s.clerk === "counter";
  const x = atCounter ? 596 : 492;
  const y = atCounter ? 84 : 96;
  return (
    <g>
      {/* the green polo, the apron, and the lanyard everyone tucks in */}
      {px(x, y + 12, 14, 20, ZGREEN.base)}
      {px(x, y + 12, 14, 2, ZGREEN.hi)}
      {px(x + 1, y + 20, 12, 12, ZLIME.mid)}
      <path d={frogPath(x + 2, y + 22)} fill="#ffffff" opacity={0.9} />
      {px(x + 6, y + 12, 2, 8, M.graphite.base)}
      {/* head, hair, and the face turned three-quarters away */}
      {px(x + 3, y, 8, 10, M.skin.base)}
      {px(x + 3, y, 8, 3, "#3f2a1c")}
      {px(x + 3, y + 1, 1, 8, M.skin.lo)}
      {px(x + 9, y + 4, 1, 1, "#33241a")}
      {px(x + 3, y + 10, 8, 2, M.skin.mid)}
      {/* the arm, doing the one thing that stage implies */}
      {atCounter ? (
        <g>
          {px(x - 4, y + 16, 6, 3, ZGREEN.base)}
          {px(x - 6, y + 16, 3, 3, M.skin.base)}
          <animateTransform
            attributeName="transform"
            type="translate"
            calcMode="discrete"
            values="0 0;0 1;0 0;-1 0"
            dur="5.3s"
            repeatCount="indefinite"
          />
        </g>
      ) : (
        <g>
          {px(x + 12, y + 10, 4, 8, ZGREEN.base)}
          {px(x + 13, y + 6, 3, 5, M.skin.base)}
          {/* the crate of stock at their feet */}
          {px(x - 2, 138, 20, 12, K.crate)}
          {px(x - 2, 138, 20, 2, K.crateHi)}
        </g>
      )}
    </g>
  );
}

/** One customer: at the gondola deciding, or at the till already committed. */
// The hand-drawn Customer, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _Customer({ s }: { s: ZabkaState }) {
  if (s.customer === "none") return null;
  const paying = s.customer === "paying";
  /* paying stands in FRONT of the counter, so this draws over it */
  const x = paying ? 568 : 396;
  return (
    <g>
      {/* a coat, a bag, and the posture of a person who came in for one thing */}
      {px(x, 106, 15, 26, paying ? "#3a4a6a" : "#4a4438")}
      {px(x, 106, 15, 2, paying ? "#4f628a" : "#5d5648")}
      {px(x + 2, 132, 5, 18, M.graphite.lo)}
      {px(x + 8, 132, 5, 18, M.graphite.lo)}
      {px(x + 1, 148, 6, 2, "#2b2d30")}
      {px(x + 7, 148, 6, 2, "#2b2d30")}
      {px(x + 4, 94, 8, 12, M.skin.base)}
      {px(x + 4, 94, 8, 4, "#2f2418")}
      {px(x + 4, 95, 1, 10, M.skin.lo)}
      {/* the basket, or the phone held out at the reader */}
      {paying ? (
        <g>
          {px(x + 14, 112, 4, 6, M.graphite.base)}
          {px(x + 15, 113, 2, 3, "#4a7a8a")}
          {px(x + 12, 110, 4, 3, M.skin.base)}
        </g>
      ) : (
        <g>
          {px(x + 14, 118, 10, 9, ZGREEN.base)}
          {px(x + 14, 118, 10, 1, ZGREEN.hi)}
          {px(x + 16, 114, 6, 4, ZGREEN.mid)}
          {px(x + 12, 116, 4, 3, M.skin.base)}
        </g>
      )}
      {/* they shift their weight, because everybody does */}
      <animateTransform
        attributeName="transform"
        type="translate"
        calcMode="discrete"
        values="0 0;0 0;1 0;1 0;0 0"
        dur="11s"
        repeatCount="indefinite"
      />
    </g>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function ZabkaScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world);
  return (
    <LayeredScene
      /* the street is across the pavement; it should lag the glazing */
      parallax={{ farBackground: 0.86, middleBackground: 1 }}
      farBackground={<Street ph={ph} />}
      middleBackground={
        <g>
          <BackWall />
          <Ceiling s={s} />
        </g>
      }
      ground={<Ground ph={ph} s={s} />}
      staticObjects={
        <g>
          <Entrance ph={ph} s={s} />
          <Cafe s={s} />
          <Grill s={s} />
          <Bakery s={s} />
          <Gondola s={s} />
          <Freezer s={s} />
          <Multideck />
          <Kiosk s={s} />
          <Counter s={s} />
          {/* Clerk and Customer are NpcActors in the Effects plane now */}
        </g>
      }
      gameplayObjects={<g>{/* hitboxes only */}</g>}
    />
  );
}

/* ================================================================== *
 * foreground — the near edge
 * ================================================================== */

function ZabkaFront() {
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
        {/* two ceiling danglers, close enough to the lens to be cropped */}
        {[196, 452].map((x) => (
          <g key={x}>
            {px(x + 8, 0, 1, 14, "#b8bbbe")}
            {px(x, 14, 18, 14, K.receipt)}
            {px(x, 14, 18, 4, ZGREEN.base)}
            {px(x, 24, 18, 4, K.red)}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${x + 8} 14;-2 ${x + 8} 14;1 ${x + 8} 14;0 ${x + 8} 14`}
              dur={x === 196 ? "6.7s" : "8.1s"}
              repeatCount="indefinite"
            />
          </g>
        ))}
        {/* a promo pallet in the near plane — the aisle narrows, the player
            walks BEHIND the shrink-wrapped water and the depth is free */}
        {px(330, H - 30, 52, 6, "#8a6f48")}
        {px(332, H - 26, 48, 2, "#6b5434")}
        {px(334, H - 52, 44, 22, "#b8d4e2")}
        {px(334, H - 52, 44, 3, "#d4e8f2")}
        {px(334, H - 38, 44, 2, "#9fc0d2")}
        {[338, 349, 360, 371].map((x) => px(x, H - 50, 2, 18, "#7fa8c0", `wt${x}`))}
        {px(340, H - 60, 30, 8, K.receipt)}
        {px(340, H - 60, 30, 2, K.red)}
        {/* the basket stack by the door, cropped by the lens */}
        {px(44, H - 34, 30, 4, ZGREEN.deep)}
        {px(46, H - 30, 26, 4, ZGREEN.lo)}
        {px(44, H - 26, 30, 4, ZGREEN.base)}
        {px(46, H - 22, 26, 4, ZGREEN.lo)}
        {px(44, H - 18, 30, 4, ZGREEN.base)}
        {px(42, H - 14, 34, 3, ZGREEN.hi)}
        {/* one wobbler over the pallet, doing what wobblers do */}
        <g>
          {px(352, 0, 1, 10, "#b8bbbe")}
          {px(346, 10, 14, 10, K.red)}
          {px(346, 10, 14, 2, "#d85a50")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 352 10;-3 352 10;2 352 10;0 352 10"
            dur="5.3s"
            repeatCount="indefinite"
          />
        </g>
        {/* six pixels of near tile, so the floor has an edge to sit behind */}
        {px(0, H - 6, W, 6, SHOPFLOOR.lo)}
        {px(0, H - 6, W, 1, SHOPFLOOR.mid)}
        {/* a bright shop barely vignettes; this is here to hold the corners only */}
        <Vignette set={VIGNETTE} strength={0.45} />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * effects — the light, and anything being served right now
 * ================================================================== */

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.55 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

const CLERK_LINES = [
  "Żappkę ma pan?",
  "Hot dog zaraz będzie, jeszcze się grzeje.",
  "Kawa się parzy, chwilkę.",
  "Terminal znowu muli.",
  "Dostawa dopiero o trzeciej.",
  "Reklamówka? Trzydzieści groszy.",
  "Drobnych nie mam, przepraszam.",
];

function ZabkaEffects({
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
  const s = state(world);
  const night = ph === "night" || ph === "dusk";
  return (
    <>
      {/* counter staff and whoever is in front of you, cropped at the till */}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        {s.clerk === "counter" ? (
          <NpcActor npc={NPCS.clerk} x={590} facing={-1} cropBelow={TILL + 2} />
        ) : null}
        {s.customer === "paying" ? (
          /* at the till, in front of the counter, waiting for the terminal */
          <NpcActor npc={NPCS.shopper} x={558} facing={1} />
        ) : null}
        {s.customer === "browsing" ? (
          /* on the far side of the gondola island, cropped at its top edge so
             he reads as standing behind it rather than on top of the crates */
          <NpcActor npc={NPCS.shopper} x={382} facing={-1} cropBelow={GONDOLA_TOP} />
        ) : null}
      </svg>
      {/* the clerk says the four things a clerk says */}
      {s.clerk === "counter" ? (
        <Monologue
          x={600}
          headY={84}
          scale={scale}
          speaker="Pani z Żabki"
          lines={CLERK_LINES}
          muted={dialogueOpen}
        />
      ) : null}
      {s.coffee === "pouring" || s.coffee === "done" ? (
        <Steam x={170} y={90} scale={scale} />
      ) : null}
      {s.hotdogs > 0 ? <Steam x={256} y={80} scale={scale} slow /> : null}
      {s.freezerOpen ? <Steam x={440} y={112} scale={scale} slow /> : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <g shapeRendering="crispEdges">
          {/*
            No room-wide cast. The interior of a Żabka is the same colour at
            three in the morning as at noon, and that is the whole point of it.
            The hour only reaches the glazing.
          */}
          {night ? (
            <rect x={0} y={FIX - 4} width={146} height={94} fill="#0e1420" opacity={0.34} />
          ) : null}
          {/* the five troffers, and the third one going */}
          {TROFFERS.map((x, i) => (
            <g key={x} opacity={s.panelDead && i === 2 ? 0.75 : 1}>
              <Light set={TROFFER_CONES[i]} />
              <Light set={TROFFER_POOLS[i]} />
              {s.panelDead && i === 2 ? (
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0.75;0.2;0.75;0.75;0.35;0.75"
                  dur="2.9s"
                  repeatCount="indefinite"
                />
              ) : null}
            </g>
          ))}
          {/* the green band bouncing off the ceiling tile, and nothing else */}
          <Light set={BAND_BOUNCE} />
          {/* the multideck, spilling cold onto the tile in front of it, always */}
          <Light set={FRIDGE_SPILL} />
          {/* the grill, warm, low, and the only thing in here with a temperature */}
          {s.hotdogs > 0 ? <Light set={GRILL_GLOW} /> : null}
          {/* the freezer lid open: cold climbs out and sits on the tile */}
          {s.freezerOpen ? <Light set={FREEZER_SPILL} /> : null}

          {/* the fly. It does not interpolate — no fly ever has. */}
          {s.hotdogs > 0 ? (
            <rect width={1} height={1} fill="#26221c">
              <animate
                attributeName="x"
                calcMode="discrete"
                values="250;258;253;262;248;256;251;250"
                dur="2.3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                calcMode="discrete"
                values="82;78;86;80;84;77;83;82"
                dur="1.7s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}

          {/* moths at the glazing after dark — the shop is the brightest thing
              on the street, and they know it */}
          {night ? (
            <g fill={K.receipt} opacity={0.8}>
              <rect width={1} height={1}>
                <animate
                  attributeName="x"
                  calcMode="discrete"
                  values="30;38;33;42;28;36;30"
                  dur="3.1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y"
                  calcMode="discrete"
                  values="44;50;40;54;46;42;44"
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </rect>
              <rect width={1} height={1}>
                <animate
                  attributeName="x"
                  calcMode="discrete"
                  values="40;32;44;36;46;34;40"
                  dur="2.7s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y"
                  calcMode="discrete"
                  values="52;46;58;48;44;56;52"
                  dur="1.9s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}

          {/* --- transients --- */}
          {actionUi === "hotdog" ? (
            <g fill="#ffe6b8">
              <rect x={248} y={88} width={1} height={1}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="0;1;0;0;1;0"
                  dur="0.7s"
                  repeatCount="indefinite"
                />
              </rect>
              <rect x={262} y={86} width={1} height={1}>
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="1;0;0;1;0"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
          {actionUi === "coffee" ? (
            <g>
              <rect x={170} y={94} width={2} height={6} fill="#5f4230">
                <animate
                  attributeName="opacity"
                  calcMode="discrete"
                  values="1;0.55;1;0.7"
                  dur="0.24s"
                  repeatCount="indefinite"
                />
              </rect>
              <path
                d={pxPath(steppedEllipse(171, 100, 8, 3, 1))}
                fill={dth("w", "25")}
                opacity={0.4}
              />
            </g>
          ) : null}
          {actionUi === "hotdog" ? (
            <g>
              {/* the tongs come down, take one, and the grill gets brighter */}
              <path
                d={pxPath([
                  [252, 74, 2, 12],
                  [258, 74, 2, 12],
                  [252, 86, 8, 2],
                ])}
                fill={M.steel.base}
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  calcMode="discrete"
                  values="0 -6;0 0;0 4;0 0;0 -6"
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </path>
              <Light set={GRILL_GLOW} />
            </g>
          ) : null}
          {/* a fly, because there is always one, and it prefers the bakery */}
          {ph !== "night" ? (
            <g>
              <rect x={306} y={84} width={1} height={1} fill="#2e3033" opacity={0.85} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;14 10;-6 20;10 6;-10 12;0 0"
                dur="7.9s"
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
 * definition
 * ================================================================== */

/**
 * Every world read the art performs, in order. This scene is a plain SceneDef,
 * which has no artKey; if it migrates to RuntimeSceneDef, this is the key it
 * wants, and every new read must be joined here in the same order.
 */
export function zabkaArtKey(world: WorldState, phase: string): string {
  const s = state(world);
  return [
    phase,
    s.hotdogs,
    s.coffee,
    s.bakery,
    s.shelves,
    s.freezerOpen ? 1 : 0,
    s.floor,
    s.clerk,
    s.kiosk,
    s.customer,
    s.parcels,
    s.delivery ? 1 : 0,
    s.panelDead ? 1 : 0,
  ].join("|");
}

export const ZABKA_SCENE: RuntimeSceneDef<WorldState> = {
  artKey: zabkaArtKey,
  id: "zabka",
  width: W,
  /**
   * The aisle. The fit-out already paints direction arrows on the floor at
   * y=166..172 and nobody could ever stand on them, because the player was
   * pinned to the shelf line. Twenty pixels of tile now, which is the aisle a
   * Żabka this size actually has, and the arrows are underfoot where they belong.
   */
  ground: {
    top: FLOOR,
    bottom: 170,
    zones: [{ x0: 0, x1: W, kind: "tile" }],
  },
  objects: [
    {
      id: "door-street",
      kind: "door",
      priority: 1,
      x: 30,
      range: 24,
      to: { scene: "outside", spawnX: 450 },
    },
    { id: "baskets", kind: "flavor", x: 62, range: 8, approachY: 152 },
    { id: "standing-bar", kind: "flavor", x: 108, range: 24, approachY: 160 },
    { id: "coffee-machine", kind: "sport", action: "coffee", x: 176, range: 26 },
    { id: "hotdog-grill", kind: "sport", action: "hotdog", x: 244, range: 26 },
    { id: "bakery-case", kind: "flavor", x: 308, range: 26 },
    { id: "gondola", kind: "flavor", x: 386, range: 32 },
    { id: "freezer", kind: "openable", x: 440, range: 16 },
    { id: "fridge-wall", kind: "flavor", x: 498, range: 36 },
    { id: "self-checkout", kind: "flavor", x: 549, range: 13 },
    { id: "till", kind: "flavor", x: 591, range: 27 },
  ],
  Component: ({ world, phase }) => <ZabkaScene world={world} phase={phase} />,
  /* a shop is lit by contract, not by the hour — the room never dims */
  darkness: () => 0,
  Foreground: () => <ZabkaFront />,
  Effects: ZabkaEffects,
  idleLean: true,
};
