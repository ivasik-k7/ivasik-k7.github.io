import type { SpriteMap } from "../core/types";
import type { Patch } from "../sprite/characterBuilder";

/**
 * morph.ts — proportion and garment passes over drawn parts.
 *
 * The parts of a character are still drawn, because at 24 columns a pixel
 * artist's decisions are better than a formula's. What used to be *fixed*
 * about them is not: every operation here takes a part or an arm patch and
 * moves it toward a different body or a different garment, and because the
 * operations work on runs of zone letters rather than on coordinates, one
 * pass applies to every leg set, every torso and every arm pose at once.
 *
 * Conventions shared with the rig these were written against:
 *   - the grid is 24 wide with the centre line between columns 11 and 12;
 *   - the figure faces right, so "near" is the high columns;
 *   - leg zones are p/q/Q (trousers), m (lit), s/S (skin), b/B (shoe);
 *   - a run is a horizontal stretch of cells all in the same zone set.
 */

export const GRID_W = 24;
export const CENTRE = 12;

const T = new Set(["."]);
const isBlank = (ch: string) => T.has(ch) || ch === " ";

type Run = { start: number; end: number };

/** Contiguous runs of `zones` cells on one row. */
function runs(row: string, zones: ReadonlySet<string>): Run[] {
  const out: Run[] = [];
  let start = -1;
  for (let x = 0; x <= row.length; x++) {
    const inZone = x < row.length && zones.has(row[x]);
    if (inZone && start < 0) start = x;
    if (!inZone && start >= 0) {
      out.push({ start, end: x - 1 });
      start = -1;
    }
  }
  return out;
}

const LEG_ZONES = new Set(["p", "q", "Q", "m", "s", "S", "b", "B"]);
const CLOTH_LEG = new Set(["p", "q", "Q", "m"]);
/** what a boot shaft covers: trouser, stripe, sock */
const BOOT_ZONES = new Set(["p", "q", "Q", "m", "a", "s", "S", "b", "B"]);
/** Everything a torso is made of, hood and hips included. */
export const TORSO_ZONES: ReadonlySet<string> = new Set([
  "t",
  "T",
  "l",
  "m",
  "M",
  "p",
  "q",
  "c",
  "a",
  "A",
  "s",
  "S",
  "y",
]);

/** Narrowing never touches a run thinner than this — a shin stays a shin. */
const MIN_NARROW_WIDTH = 5;

/**
 * Widen (or narrow, with a negative `by`) every run of `zones` on rows
 * [from, to], away from the centre line. A run that straddles the centre
 * (the hips, a torso) grows at both ends. The outer edge cell keeps its
 * letter so the silhouette edge survives; the cells inside it are fill.
 */
export function widenRuns(
  map: SpriteMap,
  from: number,
  to: number,
  by: number,
  zones: ReadonlySet<string> = LEG_ZONES,
): string[] {
  if (by === 0) return [...map];
  return map.map((row, y) => {
    if (y < from || y > to) return row;
    const cells = [...row];
    for (const r of runs(row, zones)) {
      const width = r.end - r.start + 1;
      const straddles = r.start < CENTRE && r.end >= CENTRE;
      const left = straddles || r.end < CENTRE;
      const right = straddles || r.start >= CENTRE;
      const edgeL = cells[r.start];
      const edgeR = cells[r.end];
      const fillL = width > 1 ? cells[r.start + 1] : edgeL;
      const fillR = width > 1 ? cells[r.end - 1] : edgeR;
      if (by > 0) {
        if (left && r.start - by >= 0) {
          cells[r.start] = fillL;
          for (let i = 1; i < by; i++) cells[r.start - i] = fillL;
          cells[r.start - by] = edgeL;
        }
        if (right && r.end + by < GRID_W) {
          cells[r.end] = fillR;
          for (let i = 1; i < by; i++) cells[r.end + i] = fillR;
          cells[r.end + by] = edgeR;
        }
      } else {
        const n = -by;
        if (width < MIN_NARROW_WIDTH) continue;
        if (width - n * ((left ? 1 : 0) + (right ? 1 : 0)) < 2) continue;
        if (left) {
          for (let i = 0; i < n; i++) cells[r.start + i] = ".";
          cells[r.start + n] = edgeL;
        }
        if (right) {
          for (let i = 0; i < n; i++) cells[r.end - i] = ".";
          cells[r.end - n] = edgeR;
        }
      }
    }
    return cells.join("");
  });
}

/**
 * Make the shins longer or shorter: duplicate row `at` `n` times (n > 0), or
 * remove rows `at-n+1 .. at` (n < 0). The row must be a plain shin row — one
 * that reads the same repeated, which is what a shin is.
 */
export function extendRows(map: SpriteMap, at: number, n: number): string[] {
  if (n === 0) return [...map];
  const out = [...map];
  if (n > 0) {
    const row = out[at];
    out.splice(at, 0, ...Array.from({ length: n }, () => row));
    return out;
  }
  const remove = Math.min(-n, at);
  out.splice(at - remove + 1, remove);
  return out;
}

/** Push a map down `n` rows, dropping rows off the bottom (used for lying poses). */
export function shiftRows(map: SpriteMap, n: number): string[] {
  if (n === 0) return [...map];
  const width = map[0]?.length ?? GRID_W;
  const empty = ".".repeat(width);
  if (n > 0) return [...Array.from({ length: n }, () => empty), ...map.slice(0, map.length - n)];
  return [...map.slice(-n), ...Array.from({ length: -n }, () => empty)];
}

// ---------------------------------------------------------------------------
// patches
// ---------------------------------------------------------------------------

type Cell = { x: number; y: number; z: string };

function patchCells(p: Patch): Cell[] {
  const out: Cell[] = [];
  p.rows.forEach((row, dy) => {
    [...row].forEach((z, dx) => {
      if (!isBlank(z)) out.push({ x: p.c + dx, y: p.r + dy, z });
    });
  });
  return out;
}

function cellsToPatch(cells: readonly Cell[], fallback: Patch): Patch {
  if (cells.length === 0) return { r: fallback.r, c: fallback.c, rows: [] };
  let minX = GRID_W;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  const rows = Array.from({ length: maxY - minY + 1 }, () =>
    new Array<string>(maxX - minX + 1).fill("."),
  );
  for (const c of cells) rows[c.y - minY][c.x - minX] = c.z;
  return { r: minY, c: minX, rows: rows.map((r) => r.join("")) };
}

/**
 * Move a patch's cells outward with the shoulders: everything left of the
 * centre line goes `d` columns left, everything on or right of it `d` right.
 * A hanging arm follows its shoulder; a pair of raised arms opens with the
 * chest. Cells pushed off the grid are dropped.
 */
export function shiftSides(p: Patch, d: number): Patch {
  if (d === 0) return p;
  const cells = patchCells(p)
    .map((c) => ({ ...c, x: c.x < CENTRE ? c.x - d : c.x + d }))
    .filter((c) => c.x >= 0 && c.x < GRID_W);
  return cellsToPatch(cells, p);
}

const SKIN = new Set(["s", "S", "y"]);
const CLOTH = new Set(["t", "T"]);

export type Anchor = readonly [x: number, y: number];

/**
 * Re-dress an arm patch for a sleeve length.
 *
 * The patches were drawn in short sleeves: cloth to the elbow, skin below, a
 * hand at the end. Which cells are the hand is not written down anywhere, so
 * it is worked out from the one thing every arm agrees on — the forearm
 * starts where the cloth stops. Skin is walked outward from the cloth, cell
 * to cell, and the `hand` cells furthest along that walk are the hand. That
 * survives the arm bending back up to the face (a phone, a cigarette, an
 * explaining hand), where "furthest from the shoulder" would have dressed
 * the hand and bared the elbow.
 *
 * Long sleeve: everything skin between cloth and hand becomes cloth. No
 * sleeve: the cloth becomes skin. Patches with no cloth at all (a bare arm
 * reaching for a kettlebell) fall back to distance from the shoulder anchors.
 */
export function sleevePatch(
  p: Patch,
  sleeve: "short" | "long" | "none",
  anchors: readonly Anchor[],
  hand = 4,
): Patch {
  if (sleeve === "short") return p;
  const cells = patchCells(p);
  if (sleeve === "none") {
    return cellsToPatch(
      cells.map((c) => (c.z === "t" ? { ...c, z: "s" } : c.z === "T" ? { ...c, z: "S" } : c)),
      p,
    );
  }
  const skin = cells.filter((c) => SKIN.has(c.z));
  const cloth = cells.filter((c) => CLOTH.has(c.z));
  const at = new Map<string, Cell>();
  for (const c of skin) at.set(`${c.x},${c.y}`, c);
  const neighbours = (c: Cell): Cell[] => {
    const out: Cell[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const n = at.get(`${c.x + dx},${c.y + dy}`);
        if (n) out.push(n);
      }
    }
    return out;
  };
  // distance along the skin from the cloth (multi-source BFS)
  const dist = new Map<Cell, number>();
  const queue: Cell[] = [];
  for (const c of skin) {
    const touchesCloth = cloth.some((k) => Math.abs(k.x - c.x) <= 1 && Math.abs(k.y - c.y) <= 1);
    if (touchesCloth) {
      dist.set(c, 0);
      queue.push(c);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const d = dist.get(c) ?? 0;
    for (const n of neighbours(c)) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  // skin the walk never reached (no cloth in the patch, or an island): rank
  // it by distance from its nearest shoulder instead
  const groups = new Map<number, { cell: Cell; d: number }[]>();
  const ranked: { cell: Cell; d: number }[] = [];
  for (const c of skin) {
    const d = dist.get(c);
    if (d !== undefined) {
      ranked.push({ cell: c, d });
      continue;
    }
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    anchors.forEach((a, i) => {
      const dd = Math.hypot(c.x - a[0], c.y - a[1]);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    const g = groups.get(best) ?? [];
    g.push({ cell: c, d: bestD });
    groups.set(best, g);
  }
  const keep = new Set<Cell>();
  // one hand per connected skin component that the cloth reaches
  const comps = new Map<Cell, Cell>();
  const rootOf = (c: Cell): Cell => {
    let r = c;
    while (comps.get(r) !== r && comps.has(r)) r = comps.get(r) as Cell;
    return r;
  };
  for (const { cell } of ranked) comps.set(cell, cell);
  for (const { cell } of ranked) {
    for (const n of neighbours(cell)) {
      if (!dist.has(n)) continue;
      const a = rootOf(cell);
      const b = rootOf(n);
      if (a !== b) comps.set(a, b);
    }
  }
  const byComp = new Map<Cell, { cell: Cell; d: number }[]>();
  for (const r of ranked) {
    const root = rootOf(r.cell);
    const g = byComp.get(root) ?? [];
    g.push(r);
    byComp.set(root, g);
  }
  // the hand is whole distance layers, never half of one: take layers from
  // the far end until there are at least `hand` cells, so a palm three cells
  // wide keeps all three rather than two and a stray cuff pixel
  for (const g of [...byComp.values(), ...groups.values()]) {
    g.sort((a, b) => b.d - a.d);
    let n = 0;
    for (const { cell, d } of g) {
      if (n >= hand && d !== g[n - 1].d) break;
      keep.add(cell);
      n++;
    }
  }
  return cellsToPatch(
    cells.map((c) => {
      if (!SKIN.has(c.z) || keep.has(c)) return c;
      return { ...c, z: c.z === "S" ? "T" : "t" };
    }),
    p,
  );
}

// ---------------------------------------------------------------------------
// legs — hems, cuffs, stripes, boots
// ---------------------------------------------------------------------------

/** Bare legs from row `knee` down to (not including) row `ankle`. */
export function shortsPass(legs: SpriteMap, knee: number, ankle: number): string[] {
  return legs.map((row, y) => {
    if (y < knee || y >= ankle) return row;
    return [...row]
      .map((z) => (z === "p" || z === "m" ? "s" : z === "q" || z === "Q" ? "S" : z))
      .join("");
  });
}

/** An elastic cuff: the last shin row above the ankle in the shade tone. */
export function cuffPass(legs: SpriteMap, ankle: number): string[] {
  return legs.map((row, y) =>
    y === ankle - 1 ? [...row].map((z) => (CLOTH_LEG.has(z) ? "q" : z)).join("") : row,
  );
}

/** A stripe down the outer seam of each leg, rows [from, to]. */
export function stripePass(legs: SpriteMap, from: number, to: number): string[] {
  return legs.map((row, y) => {
    if (y < from || y > to) return row;
    const cells = [...row];
    for (const r of runs(row, CLOTH_LEG)) {
      const straddles = r.start < CENTRE && r.end >= CENTRE;
      if (straddles) continue;
      const outer = r.end < CENTRE ? r.start : r.end;
      cells[outer] = "a";
    }
    return cells.join("");
  });
}

/**
 * Boots: the shaft climbs `shaft` rows above the ankle and the ankle row
 * itself is leather rather than sock. Shoe rows are left as drawn.
 */
export function bootsPass(legs: SpriteMap, ankle: number, shaft: number): string[] {
  return legs.map((row, y) => {
    if (y < ankle - shaft || y > ankle) return row;
    const cells = [...row];
    for (const r of runs(row, BOOT_ZONES)) {
      let outer = -1;
      for (let x = r.start; x <= r.end; x++) {
        if (cells[x] === "b" || cells[x] === "B") continue;
        cells[x] = "b";
        outer = x;
        if (r.end < CENTRE && outer === -1) outer = x;
      }
      // the shaft's outer edge, on the side away from the centre
      if (r.end < CENTRE) {
        for (let x = r.start; x <= r.end; x++) {
          if (cells[x] === "b" && row[x] !== "b") {
            cells[x] = "B";
            break;
          }
        }
      } else if (outer >= 0) cells[outer] = "B";
    }
    return cells.join("");
  });
}

/** No shoes: the shoe rows are feet. */
export function barefootPass(legs: SpriteMap): string[] {
  return legs.map((row) => [...row].map((z) => (z === "b" ? "s" : z === "B" ? "S" : z)).join(""));
}

/** Sandals: the shoe's upper is skin, the sole stays. */
export function sandalsPass(legs: SpriteMap, ankle: number): string[] {
  return legs.map((row, y) =>
    y === ankle + 1 ? [...row].map((z) => (z === "b" ? "s" : z)).join("") : row,
  );
}

// ---------------------------------------------------------------------------
// head & torso
// ---------------------------------------------------------------------------

const HAIR_OR_CAP = new Set(["h", "H", "k", "K", "i"]);

/**
 * The hood up: hair and cap rows become hood, the face stays. The hood is the
 * hoodie's own cloth — base fill with a shade rim along the crown and the
 * back — not the lighter pocket tone, which read as a helmet.
 */
export function hoodUpPass(head: SpriteMap, rows: readonly number[]): string[] {
  const first = Math.min(...rows);
  return head.map((row, y) => {
    if (!rows.includes(y)) return row;
    const cells = [...row];
    const rs = runs(row, new Set([...HAIR_OR_CAP, "m", "M"]));
    for (const r of rs) {
      for (let x = r.start; x <= r.end; x++) cells[x] = y === first ? "T" : "t";
      cells[r.start] = "T";
      cells[r.end] = "T";
    }
    return cells.join("");
  });
}

/** A beanie: the cap zone pulled down over the hair to the brow. */
export function beaniePass(head: SpriteMap, rows: readonly number[]): string[] {
  return head.map((row, y) => {
    if (!rows.includes(y)) return row;
    const cells = [...row];
    for (const r of runs(row, new Set([...HAIR_OR_CAP, "m", "M"]))) {
      for (let x = r.start; x <= r.end; x++) cells[x] = "k";
      cells[r.end] = "K";
      cells[r.start] = "K";
    }
    return cells.join("");
  });
}

/** Repaint one row's cloth run, keeping the edge letters. */
function repaintRow(row: string, fill: string, zones: ReadonlySet<string> = CLOTH): string {
  const cells = [...row];
  for (const r of runs(row, zones)) {
    for (let x = r.start + 1; x < r.end; x++) cells[x] = fill;
  }
  return cells.join("");
}

/** Collar: the trapezius row in shade. */
export function collarPass(torso: SpriteMap): string[] {
  return torso.map((row, y) =>
    y === 0 ? [...row].map((z) => (z === "t" ? "T" : z)).join("") : row,
  );
}

/** A tank top: the shoulders are skin, two cells in from each edge, on the delt rows. */
export function tankPass(torso: SpriteMap, rows: readonly number[] = [1, 2, 3]): string[] {
  return torso.map((row, y) => {
    if (!rows.includes(y)) return row;
    const cells = [...row];
    const rs = runs(row, new Set(["t", "T", "m", "M"]));
    if (rs.length === 0) return row;
    const r = { start: rs[0].start, end: rs[rs.length - 1].end };
    cells[r.start] = "S";
    cells[r.start + 1] = "s";
    cells[r.end - 1] = "s";
    cells[r.end] = "S";
    return cells.join("");
  });
}

/** Ribbed hem: the last cloth row before the hips in shade. */
export function ribbedPass(torso: SpriteMap, hipRow: number): string[] {
  return torso.map((row, y) => (y === hipRow - 1 ? repaintRow(row, "T") : row));
}

/** A belt across the waist, in the prop-light zone (a kurtka's white belt). */
export function beltPass(torso: SpriteMap, hipRow: number): string[] {
  return torso.map((row, y) => (y === hipRow - 1 ? repaintRow(row, "c") : row));
}

/**
 * An open front: a zip up the chest with the shade of the cloth beside it,
 * and the lapels folding back from the collar above it. The figure faces
 * right so the front is the right-hand edge of each row.
 */
export function openFrontPass(torso: SpriteMap, hipRow: number): string[] {
  return torso.map((row, y) => {
    if (y < 1 || y >= hipRow - 1) return row;
    const cells = [...row];
    const rs = runs(row, new Set(["t", "T", "m", "M"]));
    const r = rs[rs.length - 1];
    if (!r) return row;
    const zip = r.end - 3;
    if (zip <= r.start + 1) return row;
    if (y <= 2) {
      // lapels: two shade cells either side of the opening
      cells[zip - 1] = "T";
      cells[zip] = "T";
      cells[zip + 1] = "T";
    } else {
      cells[zip - 1] = "T";
      cells[zip] = "c";
    }
    return cells.join("");
  });
}
