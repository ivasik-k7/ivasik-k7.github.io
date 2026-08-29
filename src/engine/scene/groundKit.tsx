import {
  Bev,
  type BevelSet,
  bevelPaths,
  clipRects,
  hash,
  type Mat,
  pick,
  pxPath,
  type Rect,
  steppedEllipse,
} from "./pixelKit";

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

/** Re-exported: the same noise the rest of the kit uses. */
export { hash };

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
    const w = Math.min(run - Math.round(hash(seed + i * 5) * 8), x1 - x - 2);
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

/* ================================================================== *
 * more floors — the ones the scenes kept building by hand
 * ================================================================== */

/**
 * Boards running TOWARD the camera: their long joints are vertical and spread
 * apart as they come forward, which is the strongest perspective cue a floor
 * can carry. `unit` is the board width at the wall; boards widen by `spread`
 * per pixel of depth. End joints are scattered off the seed.
 */
export function planksToward(
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  opts: { unit: number; spread?: number; seed?: number; ends?: number },
): { joints: string; ends: string; tone: string } {
  const { unit, spread = 0.02, seed = 11, ends = 0.35 } = opts;
  const joints: Rect[] = [];
  const endRects: Rect[] = [];
  const tone: Rect[] = [];
  const cx = (x0 + x1) / 2;
  const n = Math.ceil((x1 - x0) / unit) + 2;
  for (let i = -Math.ceil(n / 2); i <= Math.ceil(n / 2); i++) {
    // each joint is a vertical run whose x drifts away from the centre with depth
    let y = top;
    while (y < bottom) {
      const t = (y - top) / Math.max(1, bottom - top);
      const w = unit * (1 + spread * (y - top) * 8);
      const x = Math.round(cx + i * w - unit / 2);
      const h = Math.min(bottom - y, 6);
      if (x >= x0 && x < x1) {
        joints.push([x, y, 1, h]);
        if (hash(seed + i * 31 + y) < ends * 0.12) endRects.push([x + 1, y, Math.round(w) - 1, 1]);
      }
      if (t < 0.01 && hash(seed * 3 + i) < 0.18 && x >= x0) {
        tone.push([x + 1, top, Math.max(1, Math.round(w) - 1), bottom - top]);
      }
      y += h;
    }
  }
  const box: Rect = [x0, top, x1 - x0, bottom - top];
  return {
    joints: pxPath(clipRects(joints, box)),
    ends: pxPath(clipRects(endRects, box)),
    tone: pxPath(clipRects(tone, box)),
  };
}

/**
 * Herringbone parquet: alternating short blocks laid at right angles, as the
 * two families of stepped rects they resolve to on the grid. `unit` is the
 * block length; blocks are `unit/3` wide.
 */
export function herringbone(x0: number, x1: number, top: number, bottom: number, unit = 12) {
  const a: Rect[] = [];
  const b: Rect[] = [];
  const w = Math.max(2, Math.round(unit / 3));
  let row = 0;
  for (let y = top; y < bottom; y += w, row++) {
    for (let x = x0 - unit; x < x1; x += unit) {
      const shift = (row * w) % unit;
      const rx = x + shift;
      const fx0 = Math.max(x0, rx);
      const fx1 = Math.min(x1, rx + unit - 1);
      if (fx1 <= fx0) continue;
      ((row + Math.floor((rx - x0) / unit)) % 2 === 0 ? a : b).push([fx0, y, fx1 - fx0, w - 1]);
    }
  }
  const box: Rect = [x0, top, x1 - x0, bottom - top];
  return { a: pxPath(clipRects(a, box)), b: pxPath(clipRects(b, box)) };
}

/**
 * Setts / cobbles: a stagger-bond of small stones whose size and tone jitter
 * off the seed, so a yard reads as laid by hand rather than printed. Returns
 * the stone faces, the joints, and the stones that catch the light.
 */
export function cobbles(
  x0: number,
  x1: number,
  top: number,
  bottom: number,
  opts: { size?: number; seed?: number; far?: number; near?: number } = {},
) {
  const { size = 7, seed = 13, far = size - 1, near = size + 2 } = opts;
  const faces: Rect[] = [];
  const glints: Rect[] = [];
  const dark: Rect[] = [];
  const span = Math.max(1, bottom - top);
  let y = top;
  let row = 0;
  while (y < bottom) {
    const h = Math.max(2, Math.round(far + (near - far) * ((y - top) / span)));
    const stagger = row % 2 ? Math.round(size / 2) : 0;
    for (let x = x0 - size + stagger; x < x1; x += size) {
      const jitter = pick(seed + row * 7 + x, 2);
      const fx0 = Math.max(x0, x + 1);
      const fx1 = Math.min(x1, x + size - jitter);
      const fh = Math.min(bottom - y - 1, h - 1);
      if (fx1 <= fx0 || fh <= 0) continue;
      faces.push([fx0, y + 1, fx1 - fx0, fh]);
      const r = hash(seed * 5 + row * 13 + x);
      if (r > 0.82) glints.push([fx0, y + 1, fx1 - fx0, 1]);
      else if (r < 0.14) dark.push([fx0, y + 1, fx1 - fx0, fh]);
    }
    y += h;
    row++;
  }
  return { faces: pxPath(faces), glints: pxPath(glints), dark: pxPath(dark) };
}

/* ================================================================== *
 * stairs — built once here, because they were built by hand four times
 * ================================================================== */

export type Flight = {
  /** the whole flight as a silhouette */
  mass: string;
  /** the walking surfaces */
  treads: string;
  /** the bright leading edge of every tread */
  nosings: string;
  /** the vertical face under every tread */
  risers: string;
  /** the worn path down the middle of each tread */
  wear: string;
  /** both cheek walls, as a bevel set */
  cheeks: BevelSet;
  /** where the flight ends: the landing rect */
  landing: Rect;
  /** the treads themselves, for anything that wants to stand on one */
  steps: Rect[];
};

/**
 * A flight of stairs in any of the three ways this game draws them.
 *
 *  - `"down"`: into the ground, seen from above — each tread shorter and lower
 *    than the last, disappearing into a dark opening (the underpass).
 *  - `"left"` / `"right"`: up the face of a wall, in elevation — each tread
 *    `going` wide and `rise` tall, climbing toward that side.
 *
 * `x, y` is the foot of the flight on the ground line; `w` the tread width
 * (for "down") or the flight's depth into the wall (for elevation flights).
 */
export function flight(opts: {
  x: number;
  y: number;
  w: number;
  steps: number;
  dir: "down" | "left" | "right";
  rise?: number;
  going?: number;
  cheek?: number;
}): Flight {
  const { x, y, w, steps, dir, rise = 7, going = 7, cheek = 3 } = opts;
  const stepRects: Rect[] = [];
  const treads: Rect[] = [];
  const nosings: Rect[] = [];
  const risers: Rect[] = [];
  const wear: Rect[] = [];
  let cheeks: Rect[] = [];
  let landing: Rect;
  if (dir === "down") {
    for (let i = 0; i < steps; i++) {
      const inset = Math.round((i * w) / (steps * 2.4));
      const sx = x - Math.round(w / 2) + inset;
      const sw = w - inset * 2;
      const sy = y + i * going;
      stepRects.push([sx, sy, sw, going]);
      treads.push([sx, sy, sw, Math.max(1, going - 2)]);
      nosings.push([sx, sy, sw, 1]);
      risers.push([sx, sy + Math.max(1, going - 2), sw, 2]);
      const ww = Math.max(4, Math.round(sw * 0.5) - i);
      wear.push([x - Math.round(ww / 2), sy, ww, 1]);
    }
    const depth = steps * going;
    cheeks = [
      [x - Math.round(w / 2) - cheek, y, cheek, depth],
      [x + Math.round(w / 2), y, cheek, depth],
    ];
    landing = [x - Math.round(w / 2), y + depth, w, 2];
  } else {
    const sgn = dir === "right" ? 1 : -1;
    for (let i = 0; i < steps; i++) {
      const sy = y - (i + 1) * rise;
      const sx = dir === "right" ? x + i * going : x - (i + 1) * going;
      const sw = dir === "right" ? (steps - i) * going : (steps - i) * going;
      const rx = dir === "right" ? sx : x - steps * going + i * going;
      // each tread runs from its riser to the end of the flight, so the mass is solid
      const full: Rect = dir === "right" ? [sx, sy, sw, rise] : [rx, sy, sw, rise];
      stepRects.push(full);
      treads.push([full[0], sy, full[2], 2]);
      nosings.push([dir === "right" ? sx : full[0] + full[2] - going, sy, going, 1]);
      risers.push([
        dir === "right" ? sx + going - 1 : full[0] + full[2] - going,
        sy + 2,
        1,
        rise - 2,
      ]);
      wear.push([dir === "right" ? sx + 1 : full[0] + full[2] - going + 1, sy, going - 2, 1]);
    }
    const topY = y - steps * rise;
    const farX = dir === "right" ? x + steps * going : x - steps * going;
    cheeks = [[Math.min(farX, farX - sgn * cheek), topY, cheek, y - topY]];
    landing = [dir === "right" ? farX : farX - w, topY - 2, w, 2];
  }
  return {
    mass: pxPath(stepRects),
    treads: pxPath(treads),
    nosings: pxPath(nosings),
    risers: pxPath(risers),
    wear: pxPath(wear),
    cheeks: bevelPaths(cheeks),
    landing,
    steps: stepRects,
  };
}

/** Paint a flight in a material: mass, treads, risers, nosings, wear, cheeks. */
export function Stairs({ set, mat, op }: { set: Flight; mat: Mat; op?: number }) {
  return (
    <g opacity={op}>
      <path d={set.mass} fill={mat.lo} />
      <path d={set.treads} fill={mat.base} />
      <path d={set.risers} fill={mat.deep} opacity={0.8} />
      <path d={set.wear} fill={mat.hi} opacity={0.45} />
      <path d={set.nosings} fill={mat.hi} />
      <Bev set={set.cheeks} mat={mat} />
    </g>
  );
}

/* ================================================================== *
 * street furniture that is part of the ground
 * ================================================================== */

/** Kerb stones: a bevelled edge in `unit` lengths, with the joints between. */
export function kerbStones(x0: number, x1: number, y: number, h: number, unit = 40) {
  const set = bevelPaths([[x0, y, x1 - x0, h]]);
  const joints: Rect[] = [];
  for (let x = x0 + unit; x < x1; x += unit) joints.push([x, y, 1, h]);
  return { set, joints: pxPath(joints) };
}

/** A drainage grate: the frame, and the slots across it. */
export function grate(x: number, y: number, w: number, h: number, pitch = 3) {
  const slots: Rect[] = [];
  for (let sx = x + 2; sx < x + w - 1; sx += pitch) slots.push([sx, y + 1, 1, h - 2]);
  return { frame: pxPath([[x, y, w, h]]), slots: pxPath(slots), rim: pxPath([[x, y, w, 1]]) };
}

/** A manhole cover: the disc, its ring, the two pick holes. */
export function manhole(cx: number, cy: number, rx = 11, ry = 4) {
  return {
    disc: pxPath(steppedEllipse(cx, cy, rx, ry, 2)),
    ring: pxPath([
      [cx - rx + 1, cy - ry + 1, rx * 2 - 2, 1],
      [cx - rx + 1, cy + ry - 2, rx * 2 - 2, 1],
    ]),
    picks: pxPath([
      [cx - Math.round(rx / 2), cy - 1, 2, 2],
      [cx + Math.round(rx / 2) - 2, cy - 1, 2, 2],
    ]),
  };
}

/** Painted line, dashed or solid, with `worn` of it gone in seeded bites. */
export function paintLine(
  x0: number,
  x1: number,
  y: number,
  h = 2,
  opts: { dash?: number; gap?: number; worn?: number; seed?: number } = {},
) {
  const { dash = 0, gap = 0, worn = 0.25, seed = 17 } = opts;
  const paint: Rect[] = [];
  const wear: Rect[] = [];
  const step = dash > 0 ? dash + gap : x1 - x0;
  for (let x = x0; x < x1; x += step) {
    const w = Math.min(dash > 0 ? dash : x1 - x0, x1 - x);
    paint.push([x, y, w, h]);
    for (let wx = x; wx < x + w; wx += 9) {
      if (hash(seed + wx * 3 + y) < worn) wear.push([wx, y, 4 + pick(wx, 5), h]);
    }
  }
  return { paint: pxPath(paint), wear: pxPath(clipRects(wear, [x0, y, x1 - x0, h])) };
}

/** A zebra crossing: `n` bars across the road, worn at the kerbs. */
export function zebra(x: number, y: number, w: number, h: number, n = 6) {
  const bar = Math.round(w / (n * 2 - 1));
  const bars: Rect[] = [];
  for (let i = 0; i < n; i++) bars.push([x + i * bar * 2, y, bar, h]);
  return pxPath(bars);
}

/** Tactile paving: studs on a grid, and the one corner of each that glints. */
export function tactile(x: number, y: number, w: number, h: number, pitch = 4) {
  const studs: Rect[] = [];
  const glints: Rect[] = [];
  for (let sy = y; sy < y + h - 1; sy += pitch) {
    for (let sx = x; sx < x + w - 1; sx += pitch) {
      studs.push([sx, sy, 2, 2]);
      glints.push([sx, sy, 1, 1]);
    }
  }
  return { studs: pxPath(studs), glints: pxPath(glints) };
}

/** Tyre tracks: two lanes of rubber `gap` apart, broken where the tread lifted. */
export function tyreTracks(x0: number, x1: number, y: number, gap = 8, seed = 19) {
  return [wearLane(x0, x1, y, 2, seed), wearLane(x0, x1, y + gap, 2, seed + 1)];
}

/* ================================================================== *
 * what lands on a floor
 * ================================================================== */

/** Fallen leaves: two shapes, scattered, `n` of them. */
export function leaves(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  seed = 23,
): string {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.round(hash(seed + i * 7) * (x1 - x0 - 4));
    const y = y0 + Math.round(hash(seed * 3 + i * 11) * (y1 - y0 - 2));
    if (pick(seed + i, 2)) out.push([x, y, 3, 2], [x + 3, y + 1, 1, 1]);
    else out.push([x, y, 2, 2]);
  }
  return pxPath(out);
}

/** Grass coming up through the joints: tufts of two or three blades. */
export function tufts(x0: number, x1: number, y: number, n: number, seed = 29): string {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + Math.round(hash(seed + i * 13) * (x1 - x0 - 4));
    const h = 2 + pick(seed * 2 + i, 3);
    out.push([x, y - h, 1, h], [x + 2, y - h + 1, 1, h - 1]);
    if (pick(seed + i * 3, 2)) out.push([x + 1, y - h - 1, 1, 1]);
  }
  return pxPath(out);
}

/** A cluster of puddles in a hollow. */
export function puddles(cx: number, cy: number, n: number, seed = 31) {
  return Array.from({ length: n }, (_, i) =>
    puddle(
      cx + Math.round((hash(seed + i * 5) - 0.5) * 60),
      cy + Math.round((hash(seed * 3 + i) - 0.5) * 10),
      6 + pick(seed + i, 12),
      2 + pick(seed * 7 + i, 3),
    ),
  );
}

/** Snow caps: what settles on the top edge of every rect, `depth` deep. */
export function snowCaps(rects: readonly Rect[], depth = 2): string {
  return pxPath(rects.map(([x, y, w]) => [x, y - depth, w, depth] as Rect));
}

/* ================================================================== *
 * the composer — a whole floor in one call
 * ================================================================== */

export type GroundLayer = { d: string; fill: string; opacity?: number };

export type GroundSpec = {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  mat: Mat;
  /** what it is made of */
  kind: "slabs" | "tiles" | "boards" | "planks" | "cobbles" | "concrete" | "asphalt";
  /** slab/tile/board width; ignored for concrete and asphalt */
  unit?: number;
  /** the pitch at the wall and at the frame */
  far?: number;
  near?: number;
  /** stretcher bond */
  stagger?: boolean;
  /** joint width */
  grout?: number;
  /** where the traffic runs, as [x0, x1] pairs at the band's mid-depth */
  worn?: readonly (readonly [number, number])[];
  /** the surface pattern to lay over it, one of the SharedDefs ids */
  pattern?: string;
  patternOpacity?: number;
  seed?: number;
  /** grit, gum, leaves */
  litter?: number;
  /** shade the foot of the frame */
  foot?: boolean;
};

/**
 * Everything a floor needs, in the order it has to be painted, from one spec.
 * Returns plain layers so a scene can splice its own things in between —
 * the drain, the puddle, the rug — and paint the lot with <GroundPaint>.
 *
 *   const FLOOR = groundLayers({ x0: 0, x1: W, top: 150, bottom: 170, mat: STONE,
 *     kind: "tiles", unit: 26, worn: [[70, 400]], pattern: "px-agg" });
 *   <GroundPaint layers={FLOOR} />
 */
export function groundLayers(spec: GroundSpec): GroundLayer[] {
  const {
    x0,
    x1,
    top,
    bottom,
    mat,
    kind,
    unit = 26,
    stagger = false,
    grout = 1,
    worn = [],
    pattern,
    patternOpacity = 0.4,
    seed = 7,
    litter = 0,
    foot = true,
  } = spec;
  const far = spec.far ?? (kind === "boards" ? 6 : kind === "cobbles" ? 6 : 7);
  const near = spec.near ?? far + 4;
  const L: GroundLayer[] = [];
  const box: Rect = [x0, top, x1 - x0, bottom - top];
  L.push({ d: pxPath([box]), fill: mat.lo });
  if (kind === "slabs" || kind === "tiles" || kind === "boards") {
    const c = courses(x0, x1, top, bottom, {
      far,
      near,
      unit: kind === "boards" ? 0 : unit,
      stagger,
      grout,
    });
    const t = plates(x0, x1, top, bottom, {
      far,
      near,
      unit: kind === "boards" ? 74 : unit,
      stagger,
      seed,
    });
    L.push({ d: c.face, fill: mat.base });
    L.push({ d: t.dark, fill: mat.lo, opacity: 0.5 });
    L.push({ d: t.pale, fill: mat.hi, opacity: 0.4 });
    if (pattern) L.push({ d: pxPath([box]), fill: `url(#${pattern})`, opacity: patternOpacity });
    L.push({ d: c.hi, fill: mat.hi, opacity: 0.5 });
    L.push({ d: c.joints, fill: mat.deep, opacity: 0.55 });
  } else if (kind === "planks") {
    const p = planksToward(x0, x1, top, bottom, { unit, seed });
    L.push({ d: pxPath([box]), fill: mat.base });
    L.push({ d: p.tone, fill: mat.lo, opacity: 0.45 });
    if (pattern) L.push({ d: pxPath([box]), fill: `url(#${pattern})`, opacity: patternOpacity });
    L.push({ d: p.joints, fill: mat.deep, opacity: 0.6 });
    L.push({ d: p.ends, fill: mat.deep, opacity: 0.5 });
  } else if (kind === "cobbles") {
    const c = cobbles(x0, x1, top, bottom, { size: unit, seed, far, near });
    L.push({ d: c.faces, fill: mat.base });
    L.push({ d: c.dark, fill: mat.lo, opacity: 0.6 });
    L.push({ d: c.glints, fill: mat.hi, opacity: 0.6 });
  } else {
    // concrete, asphalt: one pour with plates of tone and a few cracks
    const t = plates(x0, x1, top, bottom, {
      far: bottom - top,
      near: bottom - top,
      unit: 118,
      seed,
      dark: 0.2,
      pale: 0.06,
    });
    L.push({ d: pxPath([box]), fill: mat.base });
    L.push({ d: t.dark, fill: "#000000", opacity: 0.1 });
    L.push({ d: t.pale, fill: mat.hi, opacity: 0.3 });
    L.push({
      d: pxPath([box]),
      fill: `url(#${pattern ?? (kind === "asphalt" ? "px-asphalt" : "px-agg")})`,
      opacity: patternOpacity,
    });
    L.push({
      d: cracks(
        [
          [x0 + 60, top + 2],
          [x0 + Math.round((x1 - x0) * 0.55), top + 4],
        ],
        bottom,
        seed,
      ),
      fill: mat.deep,
    });
  }
  const midY = top + Math.round((bottom - top) * 0.45);
  worn.forEach(([wx0, wx1], i) => {
    L.push({ d: wearLane(wx0, wx1, midY, 3, seed + i), fill: "#ffffff", opacity: 0.08 });
  });
  if (litter > 0) {
    L.push({
      d: scatter(x0, x1, top + 3, bottom - 3, litter, seed + 5, 1, 1),
      fill: mat.deep,
      opacity: 0.5,
    });
  }
  if (foot) {
    const sh = bandShade(x0, x1, top, bottom);
    L.push({ d: sh.footSoft, fill: "#171009", opacity: 0.08 });
    L.push({ d: sh.foot, fill: "#171009", opacity: 0.14 });
  }
  return L;
}

/** Paint a layer list. One <path> per layer, nothing allocated at render. */
export function GroundPaint({ layers, op }: { layers: readonly GroundLayer[]; op?: number }) {
  return (
    <g opacity={op}>
      {layers.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static layer list, never reorders
        <path key={i} d={l.d} fill={l.fill} opacity={l.opacity} />
      ))}
    </g>
  );
}
