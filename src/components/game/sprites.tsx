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
// Player — a strong athlete in a black sport t-shirt and navy trousers.
// 24×38 cells at cell=2 → 48×76 gp. Short sleeves: upper arms are shirt-black,
// forearms bare skin. Faces right; the engine flips him with scaleX.
//
// The frame set below is superseded by the part rig in
// game/apartment/player.ts; only the palette and the action table are still
// read by it. Three numbers in this header disagreed with the grid before —
// the rig has always been 24 wide and 38 tall.
// ---------------------------------------------------------------------------

export const PLAYER_PALETTE: Palette = {
  h: "#3a2a1e", // hair
  H: "#2b1e15", // hair shade / hair dark
  s: "#e0b48c", // skin
  S: "#c79a72", // skin shade — jaw, neck shadow, inner arm
  y: "#ead9a8", // skin highlight — pecs, bicep swell, forearm catch
  e: "#2f6b3f", // green eyes — muted
  t: "#1d1d24", // black sport t-shirt
  T: "#0a0a0e", // shirt deep shade — pec shadow, under-arm
  u: "#7a8f9f", // duvet — matches the bedroom's slate ramp
  U: "#687c8b", // duvet fold shade
  p: "#33415e", // trousers
  q: "#28344c", // trousers shade (back leg)
  Q: "#1e2839", // trousers deep shade (inner back leg mid-stride)
  k: "#2e4568", // cap crown (wardrobe-deletable zone)
  K: "#23344d", // cap brim/shade
  m: "#6d7278", // hood & pocket (wardrobe-deletable zone)
  M: "#565a60", // hood shade
  f: "#7a5c48", // stubble
  F: "#5f4636", // stubble shade
  b: "#d8d8d0", // sneakers
  B: "#8f9089", // soles
  g: "#43434b", // giria (kettlebell)
  G: "#5c5c66", // giria highlight
  R: "#9aa0a8", // barbell bar
  P: "#3f3f47", // barbell plates
  c: "#f0ede4", // cigarette / mug
  o: "#e07a30", // ember
  x: "#c96a28", // ember halo — the light the coal throws on skin and air
  v: "#b8b4ac", // cigarette smoke
  w: "#c9863f", // guitar top — the same honeyed spruce as the one on the wall
  W: "#8a5a28", // guitar rim / side shade
  n: "#3a2614", // guitar neck, fretboard, soundhole
};

// Rows 0–24: head, shoulders, full torso with arm definition, hips. Rows 25–37 are legs.
// 24 wide, fully volumetric: pec definition (T/y contrast), bicep swell (S inner edge),
// proper hand-length forearms (5 cells), tapered waist (12 cells).
// Sleeves end row 10; bare forearms rows 11–18.
const BODY = [
  "............hhhhhh............",
  "...........HhhhhhH............",
  "...........hhhhhhhh...........",
  "...........hSsshsSh...........",
  "...........hsssessh...........",
  "...........hssssff............",
  ".........sshsssshhss..........",
  "......ttTssTtTTtTssTt.........",
  "......ttTssyttytssTt..........",
  "....ttttTTssTTyTTssTTtttt.....",
  "....ttttTyssTyTTssTTtttt......",
  "....SSTtsstsssssTTSs..........",
  "....SSssstsssssTTSs...........",
  "...SSSssstsssssSSSs...........",
  "...SSSssstsssssSSSs...........",
  "...SSssstsssssSSSs............",
  "...SSssstsssstSSSs............",
  "....sssTttttttTss.............",
  ".....sssttttttss..............",
  ".....TttttttttttttT...........",
  ".....pppppppppppppp...........",
  ".....ppqpppppppppq............",
  ".....ppqpppppppppq............",
  ".....qpppppppppppq............",
  ".....qpppppppppppq............",
];

const LEGS_STAND = [
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......pppppp..pppppp.......",
  ".......qqqqqq..qqqqqq.......",
  ".......BBBBBB..BBBBBB.......",
];

const LEGS_STRIDE = [
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  "......pppppp....pppppp......",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....pppppp........pppppp...",
  ".....qqqqqq........qqqqqq...",
  "....BBBBBB........BBBBBB....",
];

const LEGS_PASS = [
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........pppppppppppp........",
  "........QQQQQQQQQQQQ........",
  ".......BBBBBBBBBBBB.........",
];

// Bent knees for petting the dog and for the low sambo entry.
const LEGS_BENT = [
  "......pppppp..pppppp.......",
  "......pppppp..pppppp.......",
  "......pppppp..pppppp.......",
  ".....pppppp....pppppp......",
  ".....pppppp....pppppp......",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....pppp..........pppp.....",
  "....qqqq........qqqq......",
  "...BBBB........BBBB.......",
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
  "........................",
  "........................",
  "...........hhhhhh........",
  "..........HhhhhhH........",
  "..........hhhhhhhh........",
  "..........hSssssSh........",
  "..........hsssessh........",
  "..........hssssss.........",
  "...........ssssh.........",
  ".....ttssTttttTssTTt.....",
  "....ttssTttyttssTTtt.....",
  "....ttTTssTTyTTssTTt.....",
  "....ttTyssTyTTssTTs......",
  "....SSTyssTysyssTss......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSc......",
  "....SsysstysystSSso......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......qqqqqq..qqqqqq......",
  ".......BBBBBB..BBBBBB......",
];

// …and taking a drag, hand at the mouth, ember bright, far hand on the rail.
const LEAN_B = [
  "........................",
  "........................",
  "...........hhhhhh........",
  "..........HhhhhhH........",
  "..........hhhhhhhh........",
  "..........hSssssSh........",
  "..........hsssessh........",
  "..........hsssscs.........",
  "...........ssshos.........",
  ".....ttssTttttTssyTTt.....",
  "....ttssTttyttssTtytt.....",
  "....ttTTssTTyTTssTTt.....",
  "....ttTyssTyTTssTTs.......",
  "....ttTyssTysyssTTt.......",
  "....SSTyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SSyssTysyssSSSs......",
  "....SsysstysystSSss......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".....ppppppppppppp.......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......pppppp..pppppp......",
  ".......qqqqqq..qqqqqq......",
  ".......BBBBBB..BBBBBB......",
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
const LEGS_TIPTOE = [
  ...LEGS_STAND.slice(0, 11),
  ".......bbbbb...bbbbb.......",
  ".......BBBBB...BBBBB.......",
];

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

export const PLAYER_W = 48; // gp (24 cells × 2)
export const PLAYER_H = 76; // gp (38 cells × 2)

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
  | "drink"
  | "reach"
  | "talk";

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
  reach: { frames: ["reach"], frameMs: 350, loops: 1 },
  talk: { frames: ["phoneA", "phoneB"], frameMs: 400, loops: 1 },
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
