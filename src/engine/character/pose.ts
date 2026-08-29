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
  /** the legs part */
  legs: string;
  /** patches on the standing body, before it moves (arms, held things) */
  arms?: readonly string[];
  /** rows the head+torso sink into the legs (a seat, a bent knee) */
  drop?: number;
  /** the body rides one row up over a straight leg (the walk's pass) */
  lift?: boolean;
  /** what the head does, after the body has moved */
  head?: { bow?: number; chin?: boolean; turn?: boolean };
  /** patches applied after the head has moved (things at the mouth) */
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

/** Tip the head back one row inside its window — a sip, a look up. */
export function raiseChin(map: SpriteMap, top = 0, headRows = HEAD_ROWS): string[] {
  const empty = blank(map);
  const head = map.slice(top, top + headRows);
  return [...map.slice(0, top), ...head.slice(1), empty, ...map.slice(top + headRows)];
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

/** Pixels for a pose. */
export function buildPose(rig: PoseRig, pose: Pose): string[] {
  const headRows = rig.headRows ?? HEAD_ROWS;
  const legsRow = rig.legsRow ?? LEGS_ROW;
  const partNames = [...(rig.upper ?? ["head", "torso"]), pose.legs];
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
  for (const a of pose.arms ?? []) patch(a);
  const drop = pose.drop ?? 0;
  if (drop) m = dropBody(m, drop, legsRow);
  if (pose.lift) m = liftBody(m, headRows);
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
 * head and over-patches on `lower`'s legs, drop and lift. The result is what
 * the two would have been drawn as together.
 */
export function overlay(upper: Pose, lower: Pose): Pose {
  return {
    legs: lower.legs,
    drop: lower.drop,
    lift: lower.lift,
    arms: [...(lower.arms ?? []), ...(upper.arms ?? [])],
    head: upper.head ?? lower.head,
    over: [...(lower.over ?? []), ...(upper.over ?? [])],
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
