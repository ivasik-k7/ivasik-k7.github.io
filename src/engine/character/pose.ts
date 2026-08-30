import type { SpriteMap } from "../core/types";
import { mirrorRows, type Patch, patchMap, stackMaps } from "../sprite/characterBuilder";

/**
 * pose.ts — a frame as data, and pixels as the output.
 *
 * Until now every frame of the player was an imperative recipe: stack these
 * parts, patch these arms, then run this transform and that one, in an order
 * that mattered and was different from the frame next to it. The order is what
 * bit: a bun patched before the head was bowed lost a row to the bow; a bottle
 * patched before the chin was raised rode up with the face and left a gap to
 * the forearm. Nothing in the recipe said which coordinates a patch was in.
 *
 * A `Pose` says it. It has a lower half (legs, and how far the body sinks
 * into them or rises over them), an upper half (arm and prop patches, in the
 * standing body's coordinates), and a head (bowed, chin up, turned). The
 * builder applies them in one fixed order, and because the upper half is
 * described separately from the lower, the same arms can be put on a
 * different pair of legs: `overlay(drinking, seated)` is a man drinking on a
 * bench, and nobody drew him.
 *
 * Coordinates: patches in `arms` are in body coordinates (the standing
 * figure, head at rows 0-6, torso 7-19, legs 20+). A body drop moves them
 * with the body. Patches in `over` are also in body coordinates but are laid
 * on AFTER the head has moved — for the things that belong to the head's new
 * position, like a bottle at a raised chin — and are shifted by the body drop
 * only.
 */

export interface Pose {
  /** the parts above the legs, when not the rig's default (a back view) */
  upper?: readonly string[];
  /** the legs part */
  legs: string;
  /** the arm on the far side of the body — painted first */
  far?: readonly string[];
  /** the arm nearer the camera — painted over the far one and the torso */
  near?: readonly string[];
  /** things that are not an arm but move with the body: steam, a bottle at the hip */
  props?: readonly string[];
  /** columns the head+torso (and their arms) shift toward the facing — a runner's lean, a drunk's sway */
  lean?: number;
  /** rows the head+torso sink into the legs (a seat, a bent knee) */
  drop?: number;
  /** the body rides one row up over a straight leg (the walk's pass) */
  lift?: boolean;
  /** rows the whole figure moves up inside the box (negative: down) — a hang, a pull-up */
  rise?: number;
  /** what the head does, after the body has moved */
  head?: { bow?: number; chin?: boolean; turn?: boolean };
  /** patches applied after the head has moved and shifted by the drop (things at the mouth, arms on a seat) */
  over?: readonly string[];
  /** the posture pass (slouch) applies — standing and walking frames */
  posture?: boolean;
}

export interface PoseRig {
  parts: Readonly<Record<string, SpriteMap>>;
  patches: Readonly<Record<string, Patch>>;
  /** the parts stacked above the legs, in order (default head, torso) */
  upper?: readonly string[];
  /** rows in the head window (default 7) */
  headRows?: number;
  /** the row the legs start on in the standing figure (default 20) */
  legsRow?: number;
  /** the posture transform, if the spec has one */
  posture?: (m: SpriteMap) => string[];
}

const HEAD_ROWS = 7;
const LEGS_ROW = 20;

const blank = (map: SpriteMap) => ".".repeat(map[0]?.length ?? 24);

/** Shift the head rows down `depth` inside a window starting at `top`. */
export function bowHead(map: SpriteMap, depth = 1, top = 0, headRows = HEAD_ROWS): string[] {
  const empty = blank(map);
  const head = map.slice(top, top + headRows);
  return [
    ...map.slice(0, top),
    ...Array.from({ length: depth }, () => empty),
    ...head.slice(0, head.length - depth),
    ...map.slice(top + headRows),
  ];
}

/**
 * Tip the head back one row inside its window — a sip, a look up. The head
 * rises; the neck row stays put and is repeated, so the throat stretches
 * instead of a blank row appearing between chin and collar — which left the
 * head attached only through whatever he was drinking.
 */
export function raiseChin(map: SpriteMap, top = 0, headRows = HEAD_ROWS): string[] {
  const head = map.slice(top, top + headRows);
  const neck = head[headRows - 1];
  return [...map.slice(0, top), ...head.slice(1), neck, ...map.slice(top + headRows)];
}

/**
 * Lower the head+torso block into the legs by `depth` rows — bent knees and
 * sofas absorb height. Legs pixels win where the two overlap.
 */
export function dropBody(map: SpriteMap, depth: number, legsRow = LEGS_ROW): string[] {
  if (depth <= 0) return [...map];
  const empty = blank(map);
  const body = map.slice(0, legsRow - depth);
  const legs = map.slice(legsRow);
  const overlapTop = map.slice(legsRow - depth, legsRow);
  const merged = legs.map((legRow, i) => {
    if (i >= depth) return legRow;
    const bodyRow = overlapTop[i] ?? empty;
    return [...legRow]
      .map((ch, c) => (ch === "." || ch === " " ? (bodyRow[c] ?? ".") : ch))
      .join("");
  });
  return [...Array.from({ length: depth }, () => empty), ...body, ...merged];
}

/**
 * The body rides a row up: built on legs one row taller, the head's blank
 * crown row goes into the shoulders and the frame is cut back to size. The
 * head stays where it was; the torso is a row higher.
 */
export function liftBody(map: SpriteMap, headRows = HEAD_ROWS): string[] {
  return bowHead(map, 1, 0, headRows).slice(1);
}

/** Shift the rows above the legs `n` columns (positive = toward the facing). */
export function leanBody(map: SpriteMap, n: number, legsRow = LEGS_ROW): string[] {
  if (n === 0) return [...map];
  return map.map((row, y) => {
    if (y >= legsRow) return row;
    const w = row.length;
    if (n > 0) return ".".repeat(n) + row.slice(0, w - n);
    return row.slice(-n) + ".".repeat(-n);
  });
}

/** Pixels for a pose. */
export function buildPose(rig: PoseRig, pose: Pose): string[] {
  const headRows = rig.headRows ?? HEAD_ROWS;
  const legsRow = rig.legsRow ?? LEGS_ROW;
  const partNames = [...(pose.upper ?? rig.upper ?? ["head", "torso"]), pose.legs];
  const maps = partNames.map((n) => {
    const m = rig.parts[n];
    if (!m) throw new Error(`pose: unknown part "${n}"`);
    return m;
  });
  let m: string[] = stackMaps(...maps);
  const patch = (name: string, dr = 0) => {
    const p = rig.patches[name];
    if (!p) throw new Error(`pose: unknown patch "${name}"`);
    m = patchMap(m, dr ? { ...p, r: p.r + dr } : p);
  };
  for (const a of pose.far ?? []) patch(a);
  for (const a of pose.near ?? []) patch(a);
  for (const a of pose.props ?? []) patch(a);
  if (pose.lean) m = leanBody(m, pose.lean, legsRow);
  const drop = pose.drop ?? 0;
  if (drop) m = dropBody(m, drop, legsRow);
  if (pose.lift) m = liftBody(m, headRows);
  if (pose.rise) {
    const n = pose.rise;
    m =
      n > 0
        ? [...m.slice(n), ...Array.from({ length: n }, () => blank(m))]
        : [...Array.from({ length: -n }, () => blank(m)), ...m.slice(0, m.length + n)];
  }
  const top = drop;
  if (pose.head?.bow) m = bowHead(m, pose.head.bow, top, headRows);
  if (pose.head?.chin) m = raiseChin(m, top, headRows);
  if (pose.head?.turn) {
    // the lifted pass has lost its neck row into the shoulders
    const rows = pose.lift ? headRows - 2 : headRows - 1;
    m = mirrorRows(m, top, top + rows);
  }
  for (const o of pose.over ?? []) patch(o, drop);
  if (pose.posture && rig.posture) m = rig.posture(m);
  return m;
}

/**
 * The upper half of one pose on the lower half of another: `upper`'s arms,
 * head and over-patches on `lower`'s legs, drop and lift. An arm slot the
 * upper pose fills replaces the lower's (a hand holding a cup is not also
 * swinging); a slot it leaves empty keeps the lower's arm. Props and over
 * patches accumulate.
 *
 * When the lower body is dropped (a seat, a crouch), the upper's arms are
 * moved to `over` — laid on after the drop — because an arm drawn in standing
 * coordinates and then dropped loses every row that lands on the legs, and a
 * hand at the hip is exactly where the thigh now is.
 */
export function overlay(upper: Pose, lower: Pose): Pose {
  const dropped = (lower.drop ?? 0) > 0;
  const far = upper.far ?? lower.far;
  const near = upper.near ?? lower.near;
  return {
    upper: lower.upper,
    legs: lower.legs,
    drop: lower.drop,
    lift: lower.lift,
    lean: lower.lean,
    rise: lower.rise,
    far: dropped && upper.far ? lower.far : far,
    near: dropped && upper.near ? lower.near : near,
    props: [...(lower.props ?? []), ...(upper.props ?? [])],
    head: upper.head ?? lower.head,
    over: [
      ...(lower.over ?? []),
      ...(dropped ? [...(upper.far ?? []), ...(upper.near ?? [])] : []),
      ...(upper.over ?? []),
    ],
    posture: lower.posture,
  };
}

/** Build a table of poses into a table of frames. */
export function buildPoses(
  rig: PoseRig,
  poses: Readonly<Record<string, Pose>>,
): Record<string, string[]> {
  return Object.fromEntries(Object.entries(poses).map(([n, p]) => [n, buildPose(rig, p)]));
}
