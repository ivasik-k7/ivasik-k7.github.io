import type { PlayerConfig, SpriteMap } from "../core/types";

/**
 * validate.ts — the rig's invariants, as checks with messages.
 *
 * Every rule here was learned by shipping a frame that broke it: a hand left
 * in the air when the head bowed under it, a foot that floated when the shins
 * were shortened, two frames with different names and the same pixels. None
 * of them is caught by the type checker, so they are caught here — at build
 * time in tests and the bench, never in the frame loop.
 */

export type Severity = "error" | "warn";

export interface Issue {
  severity: Severity;
  frame?: string;
  message: string;
}

const SKIN = new Set(["s", "S", "y"]);
/** Zones that are not the figure: smoke, an ember's halo. */
const EFFECT = new Set(["v", "x"]);

function isBlank(ch: string | undefined): boolean {
  return ch === undefined || ch === "." || ch === " ";
}

/**
 * Cells of the figure that nothing connects to the rest of it.
 *
 * Connectivity is eight-way and bridges a single empty row, because the rig
 * lifts a chin by moving the head up one row and that gap is a neck, not a
 * beheading. Props count as body — a hand on a guitar is attached through
 * the guitar. A component that stands on the floor row is left alone: a
 * kettlebell set down, a pile of clothes.
 */
function detachedCells(map: SpriteMap): number {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  const ink = (x: number, y: number) => {
    const ch = map[y]?.[x];
    return !isBlank(ch) && !EFFECT.has(ch as string);
  };
  const seen = new Set<number>();
  const key = (x: number, y: number) => y * w + x;
  const comps: { size: number; floor: boolean }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink(x, y) || seen.has(key(x, y))) continue;
      const stack = [key(x, y)];
      seen.add(key(x, y));
      let size = 0;
      let floor = false;
      while (stack.length) {
        const k = stack.pop() as number;
        size++;
        const cx = k % w;
        const cy = Math.floor(k / w);
        if (cy === h - 1) floor = true;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nk = key(nx, ny);
            if (seen.has(nk) || !ink(nx, ny)) continue;
            seen.add(nk);
            stack.push(nk);
          }
        }
      }
      comps.push({ size, floor });
    }
  }
  if (comps.length <= 1) return 0;
  comps.sort((a, b) => b.size - a.size);
  return comps
    .slice(1)
    .filter((c) => !c.floor)
    .reduce((n, c) => n + c.size, 0);
}

function lastInkRow(map: SpriteMap): number {
  for (let y = map.length - 1; y >= 0; y--) {
    if ([...map[y]].some((ch) => !isBlank(ch))) return y;
  }
  return -1;
}

export interface ValidateOptions {
  /** frames allowed to float (lying in bed, airborne) */
  airborne?: ReadonlySet<string>;
  /** frames that are legitimately several pieces (smoke, water, a dropped pile) */
  loose?: ReadonlySet<string>;
  /** frames for the ground-row check; default: the walk cycle plus `stand` */
  grounded?: readonly string[];
}

export function validateCharacter(cfg: PlayerConfig, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const frames = cfg.frames;
  const names = Object.keys(frames);
  const rows = cfg.height / (cfg.cell ?? 2);
  const cols = cfg.width / (cfg.cell ?? 2);

  // 1. every frame is the box
  for (const n of names) {
    const m = frames[n];
    if (m.length !== rows || m.some((r) => r.length !== cols)) {
      issues.push({ severity: "error", frame: n, message: `frame is not ${cols}×${rows}` });
    }
  }

  // 2. palette keys
  for (const n of names) {
    for (const row of frames[n]) {
      for (const ch of row) {
        if (!isBlank(ch) && !(ch in cfg.palette)) {
          issues.push({ severity: "error", frame: n, message: `unknown palette key "${ch}"` });
          break;
        }
      }
    }
  }

  // 3. feet on the floor in the standing set
  const grounded = opts.grounded ?? ["stand", ...cfg.walkCycle];
  for (const n of grounded) {
    const m = frames[n];
    if (!m) continue;
    const last = lastInkRow(m);
    if (last !== rows - 1) {
      issues.push({
        severity: "error",
        frame: n,
        message: `feet off the floor (last ink row ${last})`,
      });
    }
  }

  // 4. body connectivity — a hand nobody is attached to
  for (const n of names) {
    if (opts.loose?.has(n)) continue;
    const loose = detachedCells(frames[n]);
    if (loose > 0) {
      issues.push({
        severity: "warn",
        frame: n,
        message: `${loose} body cell(s) detached from the figure`,
      });
    }
  }

  // 5. skin without a body: a hand floating in an all-cloth frame is fine,
  //    a whole skin blob off on its own is not (covered by 4) — here we only
  //    catch frames that lost their face
  for (const n of names) {
    if (opts.airborne?.has(n)) continue;
    const hasSkin = frames[n].some((r) => [...r].some((ch) => SKIN.has(ch)));
    if (!hasSkin) issues.push({ severity: "warn", frame: n, message: "no skin anywhere" });
  }

  // 6. identical frames under different names
  const seen = new Map<string, string>();
  for (const n of names) {
    const k = frames[n].join("\n");
    const other = seen.get(k);
    if (other) issues.push({ severity: "warn", frame: n, message: `identical to "${other}"` });
    else seen.set(k, n);
  }

  // 7. actions reference real frames, and the enter/exit are not the loop
  for (const [id, def] of Object.entries(cfg.actions)) {
    for (const f of [
      ...def.frames,
      ...(def.enter ?? []),
      ...(def.exit ?? []),
      ...(def.abort ?? []),
    ]) {
      if (!frames[f])
        issues.push({ severity: "error", message: `action "${id}" uses unknown frame "${f}"` });
    }
    if (def.frames.length === 0)
      issues.push({ severity: "error", message: `action "${id}" has no frames` });
  }

  return issues;
}
