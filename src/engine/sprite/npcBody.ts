import type { SpriteMap } from "../core/types";

/**
 * npcBody — the anatomy engine. Bones, not blobs.
 *
 * Round one of the enrichment pass replaced the old two-column arm with a
 * jointed limb: a shoulder, an elbow, a wrist and a hand, drawn as pixel
 * strokes between points. That one change is what makes everything after it
 * possible — an arm can now go anywhere, so a wave, a hand on a hip, a mop
 * held in both hands and a cigarette raised to the mouth are all the same
 * three numbers rather than four hand-drawn patches each.
 *
 * Everything here is whole pixels on a 24-column grid. No diagonals are ever
 * drawn as diagonals: a stroke walks its long axis one row at a time, which is
 * how a pixel artist draws an arm and the only thing that survives at 3x.
 */

export const W = 24;
export const HEAD_ROWS = 7;
export const TORSO_ROWS = 15;
export const LEG_ROWS = 16;
export const ROWS = HEAD_ROWS + TORSO_ROWS + LEG_ROWS; // 38
export const CENTRE = 12;

export type Cell = { x: number; y: number; z: string };
export type Span = readonly [start: number, text: string];

/** One row of the grid: transparent everywhere except the spans given. */
export function row(...spans: Span[]): string {
  const cells = new Array<string>(W).fill(".");
  for (const [start, text] of spans) {
    for (let i = 0; i < text.length; i++) {
      const x = start + i;
      if (x >= 0 && x < W) cells[x] = text[i];
    }
  }
  return cells.join("");
}

export const band = (start: number, len: number, zone: string): Span => [
  start,
  zone.repeat(Math.max(0, len)),
];

/** A symmetric row: an edge zone, a fill, and the mirror of the edge. */
export function shell(centre: number, half: number, fill: string, edge = fill): string {
  const len = half * 2;
  return row([centre - half, edge + fill.repeat(Math.max(0, len - 2)) + edge]);
}

/** Paint cells onto a map. The one way anything gets drawn over a body. */
export function stamp(map: SpriteMap, cells: readonly Cell[]): string[] {
  const out = map.map((r) => r.split(""));
  for (const { x, y, z } of cells) {
    if (y >= 0 && y < out.length && x >= 0 && x < W) out[y][x] = z;
  }
  return out.map((r) => r.join(""));
}

/**
 * A pixel stroke from one joint to another: walk the long axis, step the short
 * one, and lay down `thick` pixels across. This is a limb.
 */
export function stroke(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: string,
  thick = 2,
): Cell[] {
  const cells: Cell[] = [];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    for (let k = 0; k < thick; k++) cells.push({ x: x + k, y, z });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// proportions
// ---------------------------------------------------------------------------

export type Build = "slim" | "regular" | "stout";
export type Height = "short" | "average" | "tall";

/**
 * Half-widths, measured against the player standing next to them — he is the
 * only figure on screen for hours, so he is the ruler. His shoulders are
 * fifteen columns across and his hips twelve, over an eight-column head; the
 * old NPC numbers gave twelve and ten, which is why everybody in the street
 * read as narrower and younger than the man walking past them.
 */
const SHOULDER: Record<Build, number> = { slim: 6, regular: 7, stout: 8 };
const WAIST: Record<Build, number> = { slim: 5, regular: 6, stout: 7 };

/** Shin rows removed to make a shorter person; the feet stay on the floor. */
export const TRIM: Record<Height, number> = { short: 3, average: 1, tall: 0 };

/**
 * Where every landmark on this body is. Rows are given in the coordinates of
 * the *stacked* figure, so a pose can place a hand without knowing which part
 * it belongs to.
 */
export function anatomy(build: Build) {
  const sh = SHOULDER[build];
  const wa = WAIST[build];
  const legW = Math.max(2, wa - 1);
  const shoulderY = HEAD_ROWS + 1;
  return {
    sh,
    wa,
    legW,
    /** torso columns, inclusive */
    bodyL: CENTRE - sh,
    bodyR: CENTRE + sh - 1,
    /**
     * The shoulder joints, just outside the torso: a stroke is two pixels wide
     * and drawn rightwards from its anchor, so the left arm anchors two columns
     * clear of the body and the right one column clear. Any further in and the
     * arm paints over the chest it is meant to hang beside.
     */
    shoulderY,
    shoulderL: CENTRE - sh - 2,
    shoulderR: CENTRE + sh,
    /** seen edge-on, an arm hangs on the centre line rather than at the shoulder */
    shoulderSide: CENTRE - 1,
    /** a relaxed arm reaches to here */
    elbowY: shoulderY + UPPER_ARM,
    wristY: shoulderY + UPPER_ARM + FOREARM,
    /** hips and the leg tops */
    hipY: HEAD_ROWS + TORSO_ROWS,
    legL: CENTRE - wa,
    legR: CENTRE + wa - legW,
    headL: 8,
    headR: 15,
    floorY: ROWS - 1,
  };
}

export type Anatomy = ReturnType<typeof anatomy>;

// ---------------------------------------------------------------------------
// limbs
// ---------------------------------------------------------------------------

/** Where an arm's joints are, relative to its shoulder. Mirrored for the left. */
export type ArmPose = {
  /** elbow offset from the shoulder */
  elbow: readonly [dx: number, dy: number];
  /** wrist offset from the elbow */
  wrist: readonly [dx: number, dy: number];
  /**
   * Put the hand *here* — grid coordinates for the right arm, mirrored about
   * the centre line for the left — and let the elbow fall wherever two bones
   * of fixed length allow.
   *
   * Offsets are fine for an arm that is hanging or gesturing, but they cannot
   * express "the cigarette is at your lips": these shoulders are seven columns
   * out from the centre line and the mouth is three rows up, so the angle that
   * lands a hand on a mouth is not something anybody can eyeball. Every pose
   * that has to touch the body — a smoke, a phone at the ear, a hand over a
   * cough — names the target and lets the solver find the elbow.
   */
  to?: readonly [x: number, y: number];
  /** which way the elbow breaks: 1 swings it away from the body, -1 across it */
  bend?: 1 | -1;
  /** the hand reads as open, gripping, or hidden behind something */
  hand?: "open" | "grip" | "none";
};

/**
 * Two bones, one hand position, one elbow. Standard planar two-link inverse
 * kinematics: the elbow sits on the intersection of a circle of upper-arm
 * radius around the shoulder and one of forearm radius around the wrist, and
 * `bend` picks which of the two intersections is the elbow rather than the
 * one that would put it through the ribs.
 */
function solveElbow(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  bend: 1 | -1,
): { ex: number; ey: number; wx: number; wy: number } {
  let dx = tx - sx;
  let dy = ty - sy;
  let d = Math.hypot(dx, dy) || 0.001;
  // an arm cannot straighten past its own length, nor fold past its own elbow
  const far = UPPER_ARM + FOREARM - 0.5;
  const near = Math.abs(UPPER_ARM - FOREARM) + 0.5;
  const k = d > far ? far / d : d < near ? near / d : 1;
  dx *= k;
  dy *= k;
  d *= k;
  const along = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - along * along));
  const ux = dx / d;
  const uy = dy / d;
  return {
    ex: Math.round(sx + along * ux - bend * off * uy),
    ey: Math.round(sy + along * uy + bend * off * ux),
    wx: Math.round(sx + dx),
    wy: Math.round(sy + dy),
  };
}

export type Side = 1 | -1;

/**
 * One arm, from the shoulder out: sleeve to the elbow in cloth, forearm in
 * skin, and a hand — three pixels across the knuckles, two deep, with a shaded
 * pixel underneath so it reads as a hand and not a stump. Short sleeves stop
 * at the elbow; long ones carry the cloth to the wrist and get a cuff.
 */
/**
 * Segment lengths, in rows. A pose says which way the elbow and the wrist go;
 * it does not get to say how long the arm is. Authored offsets drifted between
 * a 2-row upper arm (`behindHead`) and a 5-row one (`rest`), which reads as a
 * person whose limbs change size depending on their mood — the single loudest
 * proportion error in the rig. Direction is kept, length is imposed.
 *
 * 6 and 5 puts a hanging hand's fingertips on the hip line, which is where a
 * hanging hand ends up.
 */
const UPPER_ARM = 6;
const FOREARM = 5;

/** Scale an offset to a fixed length, keeping its direction. */
function reach(v: readonly [number, number], len: number): [number, number] {
  const m = Math.hypot(v[0], v[1]);
  if (m === 0) return [0, 0];
  return [Math.round((v[0] * len) / m), Math.round((v[1] * len) / m)];
}

export function arm(
  a: Anatomy,
  side: Side,
  pose: ArmPose,
  opts: {
    sleeve?: "short" | "long" | "bare";
    cloth?: string;
    shade?: string;
    skin?: string;
    /** override the shoulder column — profile poses hang the arm on the body */
    at?: number;
    /**
     * A one-pixel seam down the body side of the upper arm. A sleeve the same
     * cloth as the torso it is hanging beside disappears into it, and all that
     * is left on screen is a hand floating at hip height. One dark column is
     * the whole fix, and it is what a pixel artist draws there anyway.
     */
    seam?: string;
  } = {},
): Cell[] {
  const cloth = opts.cloth ?? "t";
  const shadeZone = opts.shade ?? "T";
  const skin = opts.skin ?? "s";
  const sleeve = opts.sleeve ?? "short";

  const sx = opts.at ?? (side === 1 ? a.shoulderR : a.shoulderL);
  const sy = a.shoulderY;
  const { ex, ey, wx, wy } = joints(side, pose, sx, sy);

  const cells: Cell[] = [];
  if (opts.seam) {
    // down the inboard edge first, so the sleeve itself paints over the top of
    // wherever the seam and the limb happen to overlap
    const inboard = side === 1 ? sx - 1 : sx + 2;
    for (let y = sy; y <= Math.max(sy, ey); y++) cells.push({ x: inboard, y, z: opts.seam });
  }
  // upper arm: cloth unless the person is bare-armed
  cells.push(...stroke(sx, sy, ex, ey, sleeve === "bare" ? skin : cloth, 2));
  // forearm: cloth only if the sleeve is long
  cells.push(...stroke(ex, ey, wx, wy, sleeve === "long" ? cloth : skin, 2));
  if (sleeve === "long") {
    // a cuff, one shade darker, where the sleeve ends
    cells.push({ x: wx, y: wy - 1, z: shadeZone }, { x: wx + 1, y: wy - 1, z: shadeZone });
  } else if (sleeve === "short") {
    // the hem of the sleeve at the elbow
    cells.push({ x: ex, y: ey, z: shadeZone }, { x: ex + 1, y: ey, z: shadeZone });
  }

  // the hand
  const kind = pose.hand ?? "open";
  if (kind !== "none") {
    const hx = wx - (side === 1 ? 0 : 1);
    cells.push(
      { x: hx, y: wy + 1, z: skin },
      { x: hx + 1, y: wy + 1, z: skin },
      { x: hx + 2, y: wy + 1, z: skin },
      { x: hx, y: wy + 2, z: kind === "grip" ? "S" : skin },
      { x: hx + 1, y: wy + 2, z: "S" },
      { x: hx + 2, y: wy + 2, z: kind === "grip" ? "S" : "S" },
    );
    if (kind === "open") cells.push({ x: hx + 1, y: wy + 3, z: skin });
  }
  return cells;
}

/** The elbow and wrist of one arm, however the pose chose to say where they go. */
function joints(
  side: Side,
  pose: ArmPose,
  sx: number,
  sy: number,
): { ex: number; ey: number; wx: number; wy: number } {
  if (pose.to) {
    // targets are written for the right arm; the left one reads them in a mirror
    const tx = side === 1 ? pose.to[0] : 2 * CENTRE - 1 - pose.to[0];
    return solveElbow(sx, sy, tx, pose.to[1], ((pose.bend ?? 1) * side) as 1 | -1);
  }
  const [edx, edy] = reach(pose.elbow, UPPER_ARM);
  const [wdx, wdy] = reach(pose.wrist, FOREARM);
  const ex = sx + edx * side;
  const ey = sy + edy;
  return { ex, ey, wx: ex + wdx * side, wy: ey + wdy };
}

/** Where an arm's hand ends up — so a prop can be put *in* it. */
export function handAt(
  a: Anatomy,
  side: Side,
  pose: ArmPose,
  at?: number,
): { x: number; y: number } {
  const sx = at ?? (side === 1 ? a.shoulderR : a.shoulderL);
  const { wx, wy } = joints(side, pose, sx, a.shoulderY);
  return { x: wx, y: wy + 1 };
}

/** The library of arm positions. Everything an NPC does is two of these. */
export const ARM: Record<string, ArmPose> = {
  /** hanging, slightly out from the body */
  rest: { elbow: [0, 5], wrist: [1, 4] },
  /** dead straight down — formal, or asleep on the feet */
  straight: { elbow: [0, 5], wrist: [0, 4] },
  /** hand on the hip */
  hip: { elbow: [1, 5], wrist: [-2, 3], hand: "grip" },
  /** forearm up, palm open: mid-sentence */
  talk: { elbow: [1, 4], wrist: [2, -2] },
  talkWide: { elbow: [2, 4], wrist: [3, -1] },
  /** raised to the side and open: hello, and goodbye */
  waveUp: { elbow: [2, 2], wrist: [2, -4] },
  waveOut: { elbow: [3, 2], wrist: [3, -3] },
  /** both palms up at the waist */
  shrug: { elbow: [1, 5], wrist: [2, 0] },
  /** low and forward: sweeping, digging, holding a handle */
  workLow: { elbow: [1, 4], wrist: [3, 3], hand: "grip" },
  workHigh: { elbow: [1, 3], wrist: [3, 0], hand: "grip" },
  /** holding something at the chest */
  hold: { elbow: [0, 4], wrist: [2, -1], hand: "grip" },
  /**
   * Hands that have to touch the face. The head rows are fixed by `npcFace`:
   * 1 brow, 2 eyes, 3 cheek and ear, 4 nose, 5 mouth, 6 chin — and a hand is
   * drawn from the wrist downward, so the wrist goes one row above whatever it
   * is meant to be touching.
   */
  toFace: { elbow: [1, 3], wrist: [1, -4], to: [CENTRE + 2, 1], bend: 1 },
  /** folded across the middle */
  foldOver: { elbow: [1, 5], wrist: [-4, 1], hand: "none" },
  foldUnder: { elbow: [1, 5], wrist: [-4, 2], hand: "none" },
  /** in a pocket */
  pocket: { elbow: [0, 5], wrist: [-1, 3], hand: "none" },
  /** reaching out to hand something over */
  reach: { elbow: [1, 4], wrist: [4, 0] },
  /** carrying a bag: straight, a little forward of the seam */
  carry: { elbow: [0, 5], wrist: [1, 5], hand: "grip" },
  /** hands to the small of the back */
  back: { elbow: [1, 5], wrist: [-3, 2], hand: "none" },
  /** the arm that swings forward on a stride, seen from the side */
  swingFwd: { elbow: [1, 4], wrist: [2, 3] },
  swingBack: { elbow: [-1, 4], wrist: [-2, 3] },
  /** the hand at the mouth: a drink, a cough, a cigarette */
  toMouth: { elbow: [1, 3], wrist: [0, -3], to: [CENTRE + 1, 4], bend: 1, hand: "grip" },
  /**
   * Two hands on one handle, one above the other — a mop, a broom, a shovel.
   * The far arm reaches across to the upper grip and the near one takes the
   * lower, which is how anybody holds a pole they are actually working with,
   * and it is the difference between mopping a floor and standing beside a mop.
   */
  gripHigh: { elbow: [1, 3], wrist: [1, 1], to: [CENTRE + 1, 13], bend: 1, hand: "grip" },
  gripLow: { elbow: [1, 4], wrist: [2, 2], to: [CENTRE + 3, 18], bend: 1, hand: "grip" },
  /** halfway up: the hand at the collarbone, on its way to the mouth */
  toChin: { elbow: [1, 3], wrist: [0, -2], to: [CENTRE + 3, 6], bend: 1, hand: "grip" },
  /** the same, a beat later: knuckles against the lips */
  atLips: { elbow: [1, 3], wrist: [0, -3], to: [CENTRE, 4], bend: 1, hand: "grip" },
  /** holding a handset against the ear, which is where a phone call lives */
  toEar: { elbow: [1, 2], wrist: [0, -4], to: [CENTRE + 3, 2], bend: 1, hand: "grip" },
  /** held out flat, palm up: here, take it */
  offer: { elbow: [1, 4], wrist: [3, 1] },
  /** both hands together in front, counting change */
  count: { elbow: [1, 4], wrist: [1, 0] },
  /** arm up and out, greeting somebody across the street */
  hail: { elbow: [2, 1], wrist: [1, -5] },
  /** hand behind the head — the scratch, the shrug's cousin */
  behindHead: { elbow: [2, 1], wrist: [-2, -3], to: [CENTRE + 4, 0], bend: 1, hand: "none" },
  /** pointing at something */
  point: { elbow: [1, 4], wrist: [4, -1] },
  /**
   * Running arms. Nothing else in the library works for a run: a runner's
   * elbow stays bent at a right angle and the forearm pumps between the chest
   * and the hip, so the hand travels a short vertical arc rather than the long
   * pendulum of a walk.
   */
  pumpUp: { elbow: [1, 3], wrist: [0, -3], hand: "grip" },
  pumpMid: { elbow: [1, 4], wrist: [0, -1], hand: "grip" },
  pumpDown: { elbow: [0, 4], wrist: [-1, 1], hand: "grip" },
};
