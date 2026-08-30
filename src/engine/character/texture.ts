import type { SpriteMap } from "../core/types";

/**
 * texture.ts — the tones a drawing does not bother with.
 *
 * The parts are drawn in flat fills with an edge tone: trousers `p` with a
 * `q` edge, a shirt `t` with `T`, shoes `b` on a `B` sole. That is enough to
 * read, and at 4× it reads as cardboard. These passes add what a light from
 * the upper front does to cloth, computed from the geometry so every leg
 * set, every walk frame and every wardrobe variant gets the same treatment
 * without anybody repainting thirty maps:
 *
 *  – a highlight (`r`) down the front of the near leg, where the thigh and
 *    shin face the light — one column, inside the front edge;
 *  – a crease (`Q`) at the back edge where a leg narrows from the row above:
 *    the fold behind a bending knee, the hollow behind the ankle;
 *  – shoes get a darker heel counter (`B`) and a toe-cap catch-light (`c`);
 *  – the shirt gets a highlight (`d`) over the near shoulder and pec, and
 *    from behind over both shoulder blades.
 *
 * The far leg is drawn a tone down by the pose compositor (`r` maps to `q`
 * there), so the highlight only ever sits on the leg nearer the camera — the
 * depth cue is the point.
 */

const TROUSER = new Set(["p", "q", "Q", "r"]);

type Run = { start: number; end: number };

function runs(row: string, isIn: (ch: string) => boolean): Run[] {
  const out: Run[] = [];
  let start = -1;
  for (let x = 0; x <= row.length; x++) {
    const inRun = x < row.length && isIn(row[x]);
    if (inRun && start < 0) start = x;
    if (!inRun && start >= 0) {
      out.push({ start, end: x - 1 });
      start = -1;
    }
  }
  return out;
}

const setAt = (row: string, x: number, ch: string) => row.slice(0, x) + ch + row.slice(x + 1);

/** Highlight down the front of the near leg, crease behind a bend. */
export function trouserTexture(map: SpriteMap): string[] {
  const out = [...map];
  let above: Run[] = [];
  for (let y = 0; y < out.length; y++) {
    const row = out[y];
    const here = runs(row, (ch) => TROUSER.has(ch));
    for (const r of here) {
      const width = r.end - r.start + 1;
      // a near-leg run: the front edge is a `q` with the fill behind it
      const nearFront = row[r.end] === "q" && row[r.end - 1] === "p";
      if (nearFront && width >= 4) out[y] = setAt(out[y], r.end - 1, "r");
      // the crease: the back of this run has come in from the row above
      const over = above.find((a) => a.end >= r.start && a.start <= r.end);
      if (over && r.start > over.start && row[r.start] === "q" && width >= 3) {
        out[y] = setAt(out[y], r.start, "Q");
      }
    }
    above = here;
  }
  return out;
}

/** A heel counter and a toe-cap catch-light on every shoe upper. */
export function shoeTexture(map: SpriteMap): string[] {
  const out = [...map];
  let prevHadUpper = false;
  for (let y = 0; y < out.length; y++) {
    const row = out[y];
    const uppers = runs(row, (ch) => ch === "b");
    for (const r of uppers) {
      const width = r.end - r.start + 1;
      if (width < 3) continue;
      out[y] = setAt(out[y], r.start, "B");
      // the top row of the upper catches the light at the toe
      if (!prevHadUpper) out[y] = setAt(out[y], r.end, "c");
    }
    prevHadUpper = uppers.length > 0;
  }
  return out;
}

/**
 * Shirt highlight. In profile the light sits on the near shoulder and the
 * top of the pec — the cells are found from the torso's own top edge, so a
 * widened or narrowed torso keeps it in the same place on the body.
 */
export function shirtTexture(map: SpriteMap, view: "profile" | "back" = "profile"): string[] {
  const out = [...map];
  const top = out.findIndex((row) => /[tT]/.test(row));
  if (top < 0) return out;
  const light = (y: number, xs: number[]) => {
    const row = out[y];
    if (!row) return;
    let r = row;
    for (const x of xs) if (r[x] === "t") r = setAt(r, x, "d");
    out[y] = r;
  };
  if (view === "profile") {
    const row1 = out[top + 1] ?? "";
    // the near edge of the shoulders is the last cloth cell of the widest row
    const edge = Math.max(row1.lastIndexOf("t"), row1.lastIndexOf("T"));
    if (edge < 0) return out;
    light(top + 1, [edge - 3, edge - 2]);
    light(top + 2, [edge - 4, edge - 3, edge - 2]);
    light(top + 3, [edge - 4, edge - 3]);
    light(top + 4, [edge - 4]);
  } else {
    const row1 = out[top + 1] ?? "";
    const left = row1.indexOf("t");
    const right = row1.lastIndexOf("t");
    if (left < 0) return out;
    light(top + 1, [left + 1, left + 2, right - 2, right - 1]);
    light(top + 2, [left + 1, right - 1]);
  }
  return out;
}
