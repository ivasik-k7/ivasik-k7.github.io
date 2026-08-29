import { pxPath, type Rect } from "./pixelKit";

/**
 * The ground kit — what turns a painted floor into a floor you are standing on.
 *
 * Every scene in the game draws its ground the same four ways, and the ones
 * that read as *flat* are the ones missing the same four things. This module
 * precomputes them, so a scene declares its floor in one call and gets back
 * the paths, and so that fifteen floors agree on how depth is drawn.
 *
 *  1. COURSES THAT FORESHORTEN. A tile row near the camera is taller than one
 *     by the wall. Every old floor laid its courses on a fixed pitch and read
 *     as wallpaper; `courses()` grows the pitch from `far` at the top of the
 *     band to `near` at the bottom, and the floor lies down.
 *
 *  2. TONE THAT VARIES. No two pours match, no two boards were the same tree,
 *     no two boxes of tile came from the same kiln. `plates()` picks a handful
 *     of courses or slabs to run darker or paler off a seeded hash, so the
 *     field stops being one colour without becoming noise.
 *
 *  3. WHERE PEOPLE WALK. A floor is polished pale along the line everyone
 *     takes and nowhere else. `wearLane()` lays that line, broken and slightly
 *     drifting, between the two x's the traffic actually runs between.
 *
 *  4. THE FOOT OF THE FRAME. The ground nearest the camera is out of the
 *     scene's light and under the frame's own vignette; two rows of warm dark
 *     at the bottom edge are what stop the floor running off the picture.
 *
 * Plus the small stuff a floor collects — `scatter()` for crumbs, grit,
 * leaves, stubs — and `cracks()` for the stepped diagonals concrete gets.
 *
 * Nothing here is a React component and nothing allocates at render time: call
 * at module scope, keep the paths, paint them with the scene's own materials.
 */

/** Deterministic per-position noise, so nothing on a floor ever crawls. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export type Courses = {
  /** the slab faces, one pixel inside their joints */
  face: string;
  /** the joint grid — both directions, one path */
  joints: string;
  /** the top edge of every slab, where the light lands */
  hi: string;
  /** the y of each course's top joint, for anything that wants to sit on a line */
  rows: number[];
};

/**
 * A field of courses that foreshorten toward the camera.
 *
 * `far` is the pitch of the row against the wall and `near` the pitch of the
 * row at the bottom of the band; rows in between are interpolated. `unit` is
 * the slab width, `stagger` shifts alternate rows by half a slab (stretcher
 * bond — pavements, tiles), and `grout` is the joint width in pixels. A
 * `unit` of 0 gives plain planks: courses with no cross-joints.
 */
export function courses(
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  opts: {
    far: number;
    near: number;
    unit?: number;
    stagger?: boolean;
    grout?: number;
  },
): Courses {
  const { far, near, unit = 0, stagger = false, grout = 1 } = opts;
  const face: Rect[] = [];
  const joints: Rect[] = [];
  const hi: Rect[] = [];
  const rows: number[] = [];
  const span = Math.max(1, bottom - top);
  let y = top;
  let row = 0;
  while (y < bottom) {
    const t = (y - top) / span;
    const pitch = Math.max(2, Math.round(far + (near - far) * t));
    const h = Math.min(pitch, bottom - y);
    rows.push(y);
    joints.push([x0, y, x1 - x0, grout]);
    if (h > grout) {
      if (unit > 0) {
        const shift = stagger && row % 2 === 1 ? Math.round(unit / 2) : 0;
        for (let x = x0 - unit + shift; x < x1; x += unit) {
          const fx0 = Math.max(x0, x + grout);
          const fx1 = Math.min(x1, x + unit);
          if (fx1 <= fx0) continue;
          face.push([fx0, y + grout, fx1 - fx0, h - grout]);
          hi.push([fx0, y + grout, fx1 - fx0, 1]);
          if (x >= x0) joints.push([x, y, grout, h]);
        }
      } else {
        face.push([x0, y + grout, x1 - x0, h - grout]);
        hi.push([x0, y + grout, x1 - x0, 1]);
      }
    }
    y += pitch;
    row++;
  }
  return { face: pxPath(face), joints: pxPath(joints), hi: pxPath(hi), rows };
}

/**
 * Tone variation: which slabs run dark and which run pale.
 *
 * Walks the same grid as `courses()` and hands back two paths of whole slabs,
 * chosen off a seeded hash so they never move. `dark` and `pale` are the
 * fraction of slabs in each set; keep them small — a floor with a third of
 * its tiles a different colour is a chessboard, not a floor.
 */
export function plates(
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  opts: {
    far: number;
    near: number;
    unit: number;
    stagger?: boolean;
    seed?: number;
    dark?: number;
    pale?: number;
  },
): { dark: string; pale: string } {
  const { far, near, unit, stagger = false, seed = 1, dark = 0.14, pale = 0.06 } = opts;
  const darks: Rect[] = [];
  const pales: Rect[] = [];
  const span = Math.max(1, bottom - top);
  let y = top;
  let row = 0;
  while (y < bottom) {
    const t = (y - top) / span;
    const pitch = Math.max(2, Math.round(far + (near - far) * t));
    const h = Math.min(pitch, bottom - y);
    const shift = stagger && row % 2 === 1 ? Math.round(unit / 2) : 0;
    let i = 0;
    for (let x = x0 - unit + shift; x < x1; x += unit, i++) {
      const fx0 = Math.max(x0, x + 1);
      const fx1 = Math.min(x1, x + unit);
      if (fx1 <= fx0 || h <= 1) continue;
      const r = hash(seed * 97 + row * 31 + i * 7);
      if (r < dark) darks.push([fx0, y + 1, fx1 - fx0, h - 1]);
      else if (r > 1 - pale) pales.push([fx0, y + 1, fx1 - fx0, h - 1]);
    }
    y += pitch;
    row++;
  }
  return { dark: pxPath(darks), pale: pxPath(pales) };
}

/**
 * The walked line. Broken into short runs that drift a pixel up or down, so
 * it reads as wear rather than as a stripe somebody painted.
 */
export function wearLane(x0: number, x1: number, y: number, h: number, seed = 3): string {
  const out: Rect[] = [];
  const run = 22;
  for (let x = x0, i = 0; x < x1; x += run + 6, i++) {
    const w = Math.min(run - Math.round(hash(seed + i * 5) * 8), x1 - x);
    if (w <= 4) continue;
    const dy = Math.round(hash(seed * 3 + i) * 2) - 1;
    out.push([x + 2, y + dy, w, h]);
  }
  return pxPath(out);
}

/**
 * The foot of the frame, and the lip under the wall. Two rows each, in the
 * warm black the rest of the game shades with; paint at 0.14 and 0.07 for
 * the foot and half that for the lip, or the floor goes into a trench.
 */
export function bandShade(x0: number, x1: number, top: number, bottom: number) {
  return {
    lip: pxPath([[x0, top, x1 - x0, 2]]),
    foot: pxPath([[x0, bottom - 3, x1 - x0, 3]]),
    footSoft: pxPath([[x0, bottom - 6, x1 - x0, 3]]),
  };
}

/**
 * Small things on a floor — grit, crumbs, stubs, leaves, hair. `n` of them in
 * the box, `w`×`h` each, never on the same pixel twice thanks to the seed.
 */
export function scatter(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  seed = 5,
  w = 2,
  h = 1,
): string {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.round(hash(seed * 13 + i * 7) * (x1 - x0 - w));
    const y = y0 + Math.round(hash(seed * 29 + i * 11) * (y1 - y0 - h));
    out.push([x, y, w, h]);
  }
  return pxPath(out);
}

/**
 * Cracks: stepped diagonals, each one a run of short dashes stepping down a
 * pixel or two, starting where you say and wandering off toward the camera.
 */
export function cracks(
  starts: readonly (readonly [x: number, y: number])[],
  bottom: number,
  seed = 7,
): string {
  const out: Rect[] = [];
  starts.forEach(([sx, sy], i) => {
    let x = sx;
    let y = sy;
    for (let s = 0; s < 7; s++) {
      out.push([x, y, 3 + Math.round(hash(seed + i * 9 + s) * 3), 1]);
      x += (hash(seed * 2 + i + s) > 0.5 ? 1 : -1) * (2 + Math.round(hash(i * s + 2) * 3));
      y += hash(seed * 3 + i + s) > 0.4 ? 2 : 1;
      if (y > bottom - 2) break;
    }
  });
  return pxPath(out);
}

/**
 * A puddle that sits IN the floor: the water, a rim one pixel up where the
 * surface catches the light, and the darker wet fringe around it that is
 * what actually tells you the ground is not dry.
 */
export function puddle(cx: number, cy: number, rx: number, ry: number) {
  const water: Rect[] = [];
  const fringe: Rect[] = [];
  for (let dy = -ry; dy < ry; dy += 1) {
    const t = 1 - ((dy + 0.5) / ry) ** 2;
    if (t <= 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    if (hw > 0) water.push([cx - hw, cy + dy, hw * 2, 1]);
    const fw = Math.round((rx + 4) * Math.sqrt(Math.max(0, 1 - ((dy + 0.5) / (ry + 1)) ** 2)));
    if (fw > 0) fringe.push([cx - fw, cy + dy, fw * 2, 1]);
  }
  return {
    water: pxPath(water),
    fringe: pxPath(fringe),
    rim: pxPath([[cx - Math.round(rx * 0.5), cy - ry, Math.round(rx), 1]]),
  };
}
