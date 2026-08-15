// Pixel sprites are authored as character maps: each character is one cell,
// each cell renders as a `cell`-sized SVG rect. "." is transparent.

import type { ReactNode } from "react";

export type Palette = Record<string, string>;

export function PixelMap({
  map,
  palette,
  cell = 2,
}: {
  map: string[];
  palette: Palette;
  cell?: number;
}) {
  const rects: ReactNode[] = [];
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const fill = palette[ch];
      if (!fill) continue;
      rects.push(
        <rect key={`${x}:${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={fill} />,
      );
    }
  }
  return <g shapeRendering="crispEdges">{rects}</g>;
}

// ---------------------------------------------------------------------------
// Player — a strong 185 cm athlete in a black sport t-shirt and navy trousers.
// 20×35 cells at cell=2 → 40×70 gp; floor y=150 puts his head at y=80.
// Short sleeves: upper arms are shirt-black, forearms bare skin.
// Faces right; the engine flips him with scaleX.
// ---------------------------------------------------------------------------

export const PLAYER_PALETTE: Palette = {
  h: "#3a2a1e", // hair
  H: "#2b1e15", // hair shade (back of the head)
  s: "#e0b48c", // skin
  S: "#c79a72", // skin shade (jaw shadow, far forearm)
  e: "#2f6b3f", // green eyes — muted so they read as eyes, not a glow
  t: "#1d1d24", // black sport t-shirt
  T: "#101016", // shirt shade — contour between arm and torso, hem shadow
  u: "#2e4568", // navy accents
  U: "#23344d", // navy shadow
  p: "#33415e", // trousers
  q: "#28344c", // trousers shade (back leg)
  b: "#d8d8d0", // sneakers
  B: "#8f9089", // soles
  g: "#43434b", // giria (kettlebell)
  G: "#5c5c66", // giria highlight
  R: "#9aa0a8", // barbell bar
  P: "#3f3f47", // barbell plates
  c: "#f0ede4", // cigarette / mug
  o: "#e07a30", // ember
};

// Rows 0–21: head, torso, hips. Rows 22–34 are supplied by a legs variant.
// Connected athletic silhouette: sloped 14-wide delts, arms attached to the
// torso with a dark contour line (T) instead of a gap, taper 14 → 12 → 10.
// Sleeves rows 8–11; bare forearms below.
const BODY = [
  "........hhhhh.......",
  ".......Hhhhhhh......",
  ".......Hhhhhhh......",
  ".......hSsssss......",
  ".......hsssses......",
  ".......hssssss......",
  "........SSsss.......",
  "......tttttttttt....",
  "....tttttttttttttt..",
  "....ttTttttttttTtt..",
  "....ttTttttttttTtt..",
  "....ttTttttttttTtt..",
  "....SSTttttttttTss..",
  "....SSTttttttttTss..",
  ".....SSTttttttTss...",
  ".....SSTttttttTss...",
  ".....tttttttttt.....",
  ".....TttttttttT.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  ".....qppppppppp.....",
  ".....qppppppppp.....",
];

const LEGS_STAND = [
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....qqqq..pppp.....",
  ".....bbbb..bbbb.....",
  ".....BBBB..BBBBB....",
];

const LEGS_STRIDE = [
  "....qqqq....pppp....",
  "....qqqq....pppp....",
  "....qqqq....pppp....",
  "....qqqq....pppp....",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...bbbb......bbbb...",
  "..BBBBB......BBBBB..",
];

const LEGS_PASS = [
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......qqpppppp......",
  "......bbbbbbbb......",
  ".....BBBBBBBBB......",
];

// Bent knees for petting the dog and for the low sambo entry.
const LEGS_BENT = [
  "....qqqqq..ppppp....",
  "....qqqqq..ppppp....",
  "....qqqqq..ppppp....",
  "...qqqq......pppp...",
  "...qqqq......pppp...",
  "...qq..........pp...",
  "...qq..........pp...",
  "...qq..........pp...",
  "...qq..........pp...",
  "...qq..........pp...",
  "...qq..........pp...",
  "...bbb........bbb...",
  "..BBBB........BBBB..",
];

interface Patch {
  r: number;
  c: number;
  rows: string[];
}

function compose(legs: string[], patches: Patch[] = []): string[] {
  const grid = [...BODY, ...legs].map((row) => row.split(""));
  for (const patch of patches) {
    patch.rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx];
        if (ch === ".") continue;
        const y = patch.r + dy;
        const x = patch.c + dx;
        if (grid[y] && x >= 0 && x < grid[y].length) grid[y][x] = ch;
      }
    });
  }
  return grid.map((row) => row.join(""));
}

const GIRIA = [".GG.", "g..g", "gggg", "gGgg", "gggg", ".gg."];

const BARBELL = ["PP................PP", "PPRRRRRRRRRRRRRRRRPP", "PP................PP"];

// Bare arm hanging straight down toward the dog.
const ARM_DOWN = ["ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss", "ss"];

// Leaning on the balcony railing (rail top ≈ sprite rows 16–17), cigarette in hand…
const LEAN_A = [
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.....",
  ".........hssses.....",
  ".........hsssss.....",
  "..........ssss......",
  "....tttttttttttt....",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttt.ss....",
  "...tttttttttt..ss...",
  "...tttttttttt...ss..",
  "...tttttttttt....ss.",
  "...tttttttttt....ssc",
  "...tttttttttt......o",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB.....",
];

// …and taking a drag, hand at the mouth, ember bright, far hand on the rail.
const LEAN_B = [
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.....",
  ".........hssses.....",
  ".........hsssssco...",
  "..........ssss.ss...",
  "....ttttttttttttss..",
  "...ttttttttttttttss.",
  "...tttttttttttttt...",
  "...tttttttttt.......",
  "...tttttttttt.......",
  "...tttttttttt.......",
  "...tttttttttt.......",
  "...ttttttttttss.....",
  "...ttttttttttss.....",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB.....",
];

// The same lean, hands empty — for idling on the balcony without a cigarette.
const stripSmoke = (map: string[]): string[] =>
  map.map((row) => row.replace("c", ".").replace("o", "."));

// On the phone with Mom, same railing lean as smoking: far arm on the rail,
// near hand holding the phone to the ear…
const LEAN_PHONE_A = [
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.gg..",
  ".........hssses.gg..",
  ".........hsssss.gs..",
  "..........ssss..s...",
  "....tttttttttttts...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttt.ss....",
  "...tttttttttt..ss...",
  "...tttttttttt...ss..",
  "...tttttttttt....ss.",
  "...tttttttttt....ss.",
  "...tttttttttt.......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB.....",
];

// …and a small nod while listening, the phone moving with the head.
const LEAN_PHONE_B = [
  "....................",
  "....................",
  "....................",
  "..........hhhh......",
  ".........hhhhhh.....",
  ".........hhhhhh.....",
  ".........hsssss.gg..",
  ".........hssses.gg..",
  ".........hsssss.gs..",
  "....tttttttttttts...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttt.ss....",
  "...tttttttttt..ss...",
  "...tttttttttt...ss..",
  "...tttttttttt....ss.",
  "...tttttttttt....ss.",
  "...tttttttttt.......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....pppppppppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....qqqq..pppp......",
  "....bbbb..bbbb......",
  "...BBBBB..BBBBB.....",
];

export type FrameName =
  | "stand"
  | "idleB"
  | "blink"
  | "lookBack"
  | "leanIdle"
  | "phoneA"
  | "phoneB"
  | "prayA"
  | "prayB"
  | "prayC"
  | "prayD"
  | "stretchA"
  | "stretchB"
  | "squat"
  | "stride"
  | "strideLow"
  | "pass"
  | "reach"
  | "sit"
  | "crouch"
  | "crouchB"
  | "swingDown"
  | "swingUp"
  | "pressRack"
  | "pressDip"
  | "pressUp"
  | "samboA"
  | "samboB"
  | "samboC"
  | "drinkA"
  | "drinkB"
  | "leanA"
  | "leanB";

const EMPTY_ROW = "....................";

// Head one pixel lower, chin row absorbed — the exhale of the idle breath.
const BODY_BREATHE = [EMPTY_ROW, ...BODY.slice(0, 6), ...BODY.slice(7)];

const withoutEye = (map: string[]): string[] => map.map((row) => row.replace(/e/g, "s"));
const shiftedDown = (map: string[]): string[] => [EMPTY_ROW, ...map.slice(0, map.length - 1)];

const STAND = compose(LEGS_STAND);
const STRIDE = compose(LEGS_STRIDE);

// Head turned to look over the shoulder: mirror only the head rows.
const LOOK_BACK = STAND.map((row, i) => (i <= 6 ? [...row].reverse().join("") : row));

// Full overhead stretch — bare forearms high, sleeves at the shoulder line.
const STRETCH_BODY = [
  "....ss........ss....",
  "....ss........ss....",
  "....ss..hhhh..ss....",
  "....ss.hhhhhh.ss....",
  "....ss.hhhhhh.ss....",
  "....ss.hsssss.ss....",
  "....ss.hssses.ss....",
  "....ss.hsssss.ss....",
  "....tt..ssss..tt....",
  "....tttttttttttt....",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "....tttttttttttt....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
];

// …and the same stretch up on the toes.
const LEGS_TIPTOE = [...LEGS_STAND.slice(0, 11), ".....bbbb..bbbb.....", ".......BB....BB....."];

// Deep squat: head six rows lower, thighs level, arms forward for balance.
const SQUAT = [
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  "........hhhh........",
  ".......hhhhhh.......",
  ".......hhhhhh.......",
  ".......hsssss.......",
  ".......hssses.......",
  ".......hsssss.......",
  "........ssss........",
  "...tttttttttttttt...",
  "...ttttttttttttttss.",
  "...ttttttttttttttss.",
  "...tttttttttttttt...",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....pppppppppp.....",
  ".....pppppppppp.....",
  "....pppppppppppp....",
  "....pppppppppppppp..",
  "...ppppppppppppppp..",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...pp.........ppp...",
  "...bbb.......bbbb...",
  "..BBBB.......BBBBB..",
];

// Sitting on the sofa: seat at world y=126 → hips at sprite row 23,
// thighs forward, shins down to the floor at row 34.
const SIT = [
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  EMPTY_ROW,
  "........hhhh........",
  ".......hhhhhh.......",
  ".......hhhhhh.......",
  ".......hsssss.......",
  ".......hssses.......",
  ".......hsssss.......",
  "........ssss........",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...tttttttttttttt...",
  "...ssttttttttttss...",
  "...ssttttttttttss...",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....tttttttttt.....",
  ".....ttttttttttss...",
  ".....pppppppppp.....",
  "....pppppppppppp....",
  "....pppppppppppppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............pppp..",
  "..............bbbb..",
  ".............BBBBB..",
];

export const PLAYER_FRAMES: Record<FrameName, string[]> = {
  stand: STAND,
  idleB: [...BODY_BREATHE, ...LEGS_STAND],
  blink: withoutEye(STAND),
  lookBack: LOOK_BACK,
  stretchA: [...STRETCH_BODY, ...LEGS_STAND],
  stretchB: [...STRETCH_BODY, ...LEGS_TIPTOE],
  squat: SQUAT,
  stride: STRIDE,
  strideLow: shiftedDown(STRIDE),
  pass: compose(LEGS_PASS),

  // one arm out toward whatever is being used — sleeve, then bare forearm
  reach: compose(LEGS_STAND, [{ r: 10, c: 16, rows: ["tsss", ".sss"] }]),

  sit: SIT,

  // reaching down toward the dog (its back is around rows 25–26)…
  crouch: compose(LEGS_BENT, [{ r: 16, c: 15, rows: ARM_DOWN }]),
  // …and the scratching motion, hand a pixel lower
  crouchB: compose(LEGS_BENT, [{ r: 17, c: 15, rows: ARM_DOWN }]),

  // kettlebell swing: giria hanging low in front, bare arms down the front line
  swingDown: compose(LEGS_STRIDE, [
    { r: 16, c: 15, rows: ["ss", "ss", "ss", "ss", "ss", "ss"] },
    { r: 22, c: 13, rows: GIRIA },
  ]),
  // top of the swing: giria driven to chest height, arms straight out
  swingUp: compose(LEGS_STAND, [
    { r: 11, c: 15, rows: ["ssss", "ssss"] },
    { r: 10, c: 16, rows: GIRIA },
  ]),

  // barbell at the chest…
  pressRack: compose(LEGS_STAND, [
    { r: 8, c: 0, rows: BARBELL },
    { r: 10, c: 3, rows: ["ss............ss"] },
  ]),
  // …the dip…
  pressDip: compose(LEGS_BENT, [
    { r: 8, c: 0, rows: BARBELL },
    { r: 10, c: 3, rows: ["ss............ss"] },
  ]),
  // …and overhead, split-jerk legs, bare arms locked out
  pressUp: compose(LEGS_STRIDE, [
    { r: 0, c: 0, rows: BARBELL },
    {
      r: 2,
      c: 4,
      rows: ["s..........s", "s..........s", "s..........s", "t..........t", "t..........t"],
    },
  ]),

  // sambo drill: grip-fighting arms forward…
  samboA: compose(LEGS_STRIDE, [{ r: 10, c: 16, rows: ["tsss", "ssss"] }]),
  // …a lower entry…
  samboB: compose(LEGS_BENT, [{ r: 13, c: 16, rows: ["sss.", "ssss"] }]),
  // …and the finish, pulling down through the throw
  samboC: compose(LEGS_BENT, [{ r: 12, c: 15, rows: ["ssss", "ss.."] }]),

  // tea: mug at the chest…
  drinkA: compose(LEGS_STAND, [{ r: 11, c: 14, rows: ["scc", ".cc"] }]),
  // …mug at the mouth, forearm raised in front of the chest
  drinkB: compose(LEGS_STAND, [
    { r: 5, c: 13, rows: ["scc", ".cc"] },
    { r: 7, c: 14, rows: ["ss", "ss", "ss", "ss"] },
  ]),

  leanA: LEAN_A,
  leanB: LEAN_B,
  leanIdle: stripSmoke(LEAN_A),
  phoneA: LEAN_PHONE_A,
  phoneB: LEAN_PHONE_B,

  // sign of the cross before the painting: forehead…
  prayA: compose(LEGS_STAND, [
    { r: 3, c: 13, rows: ["ss"] },
    { r: 4, c: 14, rows: ["s", "s", "s", "s"] },
  ]),
  // …chest…
  prayB: compose(LEGS_STAND, [{ r: 9, c: 12, rows: ["ss"] }]),
  // …shoulder…
  prayC: compose(LEGS_STAND, [{ r: 7, c: 13, rows: ["ss"] }]),
  // …then hands folded, a few words under his breath
  prayD: compose(LEGS_STAND, [{ r: 10, c: 11, rows: ["ssss"] }]),
};

// strideLow is the contact frame — one pixel lower, giving the walk its bob.
export const WALK_CYCLE: FrameName[] = ["strideLow", "stand", "pass", "stand"];

export const PLAYER_W = 40; // gp
export const PLAYER_H = 70; // gp

export type ActionId =
  | "swing"
  | "press"
  | "sambo"
  | "pet"
  | "smoke"
  | "call"
  | "pray"
  | "use"
  | "sit"
  | "drink";

export interface ActionDef {
  frames: FrameName[];
  frameMs: number;
  loops: number;
  /** Pressing a movement key cancels the action (for long, restful ones). */
  interruptible?: boolean;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  use: { frames: ["reach"], frameMs: 350, loops: 1 },
  // pick the giria up out of the squat, then swing
  swing: {
    frames: ["squat", "swingDown", "swingUp", "swingDown", "swingUp"],
    frameMs: 420,
    loops: 2,
  },
  // deadlift the bar, then clean → dip → jerk
  press: {
    frames: ["squat", "pressRack", "pressDip", "pressUp", "pressRack"],
    frameMs: 460,
    loops: 2,
  },
  // loosen up, then grips, entry, throw
  sambo: {
    frames: ["stretchA", "samboA", "samboB", "samboA", "samboC"],
    frameMs: 400,
    loops: 2,
  },
  pet: { frames: ["crouch", "crouchB"], frameMs: 420, loops: 3 },
  smoke: { frames: ["leanA", "leanB"], frameMs: 950, loops: 4, interruptible: true },
  call: { frames: ["phoneA", "phoneB"], frameMs: 900, loops: 5, interruptible: true },
  pray: {
    frames: ["prayA", "prayB", "prayC", "prayC", "prayD", "prayD", "prayD"],
    frameMs: 520,
    loops: 1,
    interruptible: true,
  },
  sit: { frames: ["sit"], frameMs: 5000, loops: 1, interruptible: true },
  drink: { frames: ["drinkA", "drinkB", "drinkB", "drinkA"], frameMs: 550, loops: 1 },
};

export function actionDuration(action: ActionDef): number {
  return action.frames.length * action.frameMs * action.loops;
}

// ---------------------------------------------------------------------------
// Gross — a small shiba, curled up and profoundly asleep. 18×9 cells at cell=2.
// ---------------------------------------------------------------------------

export const DOG_PALETTE: Palette = {
  d: "#b9853f", // coat
  D: "#8a5f2c", // coat shadow
  c: "#e8d5ae", // cream muzzle / tail tip
  k: "#2b2118", // nose, closed eye
};

export const DOG_SLEEPING = [
  "..............dd..",
  ".....dddddd..ddd..",
  "...dddddddddddddd.",
  "..dddddddddddddddc",
  ".ddddddddddddccddk",
  ".dddddddddddddccc.",
  "Dddddddddddddddd..",
  ".DDddddddddddDD...",
  "..................",
];

export const DOG_W = 36; // gp
export const DOG_H = 18; // gp

// Tiny heart that floats up when Gross gets pets. 5×4 cells.
export const HEART_PALETTE: Palette = { r: "#d96a6a" };
export const HEART = [".r.r.", "rrrrr", ".rrr.", "..r.."];
