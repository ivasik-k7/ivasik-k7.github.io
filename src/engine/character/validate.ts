import type { PlayerConfig, SpriteMap } from "../core/types";
import { isDerivedFrame } from "./compile";
import { DEFAULT_ZONES, isBlank, isFigure, lettersOf, type ZoneTable } from "./zones";

/**
 * validate.ts — the rig's invariants, as named rules with messages.
 *
 * Every rule here was learned by shipping a frame that broke it: a hand left
 * in the air when the head bowed under it, a foot that floated when the shins
 * were shortened, a walk cycle naming a frame that no longer existed. None of
 * them is caught by the type checker, so they are caught here — at build
 * time in tests and the bench, never in the frame loop.
 *
 * Each rule has an id so a test can assert it *fires* on a bad fixture, and
 * a recipe can opt a frame out of one rule (`airborne`, `loose`) without
 * silencing the others.
 */

export type Severity = "error" | "warn";

export type RuleId =
  | "box"
  | "palette"
  | "floor"
  | "connected"
  | "faceless"
  | "duplicate"
  | "action-frames"
  | "action-empty"
  | "walk-frames"
  | "walk-variants";

export interface Issue {
  rule: RuleId;
  severity: Severity;
  frame?: string;
  message: string;
}

export interface ValidateOptions {
  /** frames allowed to float (lying in bed, airborne) */
  airborne?: ReadonlySet<string>;
  /** frames that are legitimately several pieces (a pile of clothes on the floor) */
  loose?: ReadonlySet<string>;
  /** frames for the ground-row check; default: the walk cycle plus `stand` */
  grounded?: readonly string[];
  zones?: ZoneTable;
}

function lastInkRow(map: SpriteMap): number {
  for (let y = map.length - 1; y >= 0; y--) {
    if ([...map[y]].some((ch) => !isBlank(ch))) return y;
  }
  return -1;
}

/**
 * Cells of the figure that nothing connects to the rest of it.
 *
 * Connectivity is eight-way and bridges a single empty row, because the rig
 * lifts a chin by moving the head up one row and that gap is a neck, not a
 * beheading. Props count as body — a hand on a guitar is attached through
 * the guitar. Anything else that is apart is reported; a frame that means to
 * be in pieces says so with `loose`.
 */
function detachedCells(map: SpriteMap, z: ZoneTable): number {
  const h = map.length;
  const w = map[0]?.length ?? 0;
  const seen = new Set<number>();
  const key = (x: number, y: number) => y * w + x;
  const sizes: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isFigure(z, map[y][x]) || seen.has(key(x, y))) continue;
      const stack = [key(x, y)];
      seen.add(key(x, y));
      let size = 0;
      while (stack.length) {
        const k = stack.pop() as number;
        size++;
        const cx = k % w;
        const cy = Math.floor(k / w);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nk = key(nx, ny);
            if (seen.has(nk) || !isFigure(z, map[ny][nx])) continue;
            seen.add(nk);
            stack.push(nk);
          }
        }
      }
      sizes.push(size);
    }
  }
  if (sizes.length <= 1) return 0;
  sizes.sort((a, b) => b - a);
  return sizes.slice(1).reduce((n, c) => n + c, 0);
}

export function validateCharacter(cfg: PlayerConfig, opts: ValidateOptions = {}): Issue[] {
  const z = opts.zones ?? DEFAULT_ZONES;
  const skin = lettersOf(z, "skin");
  const issues: Issue[] = [];
  const push = (rule: RuleId, severity: Severity, message: string, frame?: string) =>
    issues.push({ rule, severity, message, frame });
  const frames = cfg.frames;
  const names = Object.keys(frames);
  const rows = cfg.height / (cfg.cell ?? 2);
  const cols = cfg.width / (cfg.cell ?? 2);

  for (const n of names) {
    const m = frames[n];
    if (m.length !== rows || m.some((r) => r.length !== cols)) {
      push("box", "error", `frame is not ${cols}×${rows}`, n);
    }
  }

  for (const n of names) {
    outer: for (const row of frames[n]) {
      for (const ch of row) {
        if (!isBlank(ch) && !(ch in cfg.palette)) {
          push("palette", "error", `unknown palette key "${ch}"`, n);
          break outer;
        }
      }
    }
  }

  const grounded = opts.grounded ?? ["stand", ...cfg.walkCycle];
  for (const n of grounded) {
    const m = frames[n];
    if (!m) continue;
    const last = lastInkRow(m);
    if (last !== rows - 1) push("floor", "error", `feet off the floor (last ink row ${last})`, n);
  }

  for (const n of names) {
    if (opts.loose?.has(n) || isDerivedFrame(cfg, n)) continue;
    const loose = detachedCells(frames[n], z);
    if (loose > 0) push("connected", "warn", `${loose} body cell(s) detached from the figure`, n);
  }

  for (const n of names) {
    if (opts.airborne?.has(n) || isDerivedFrame(cfg, n)) continue;
    const hasSkin = frames[n].some((r) => [...r].some((ch) => skin.has(ch)));
    if (!hasSkin) push("faceless", "warn", "no skin anywhere", n);
  }

  const seen = new Map<string, string>();
  for (const n of names) {
    if (isDerivedFrame(cfg, n)) continue;
    const k = frames[n].join("\n");
    const other = seen.get(k);
    if (other) push("duplicate", "warn", `identical to "${other}"`, n);
    else seen.set(k, n);
  }

  for (const f of cfg.walkCycle) {
    if (!frames[f]) push("walk-frames", "error", `walkCycle names unknown frame "${f}"`);
  }
  if (cfg.walkCycle.length === 0) push("walk-frames", "error", "walkCycle is empty");
  if (cfg.walkStart !== undefined && (cfg.walkStart < 0 || cfg.walkStart >= cfg.walkCycle.length)) {
    push("walk-frames", "error", `walkStart ${cfg.walkStart} is outside the cycle`);
  }
  for (const v of cfg.walkVariants ?? []) {
    if (v.frames.length !== cfg.walkCycle.length) {
      push(
        "walk-variants",
        "error",
        `a walk variant has ${v.frames.length} frames, the cycle ${cfg.walkCycle.length}`,
      );
    }
    for (const f of v.frames) {
      // a null slot means "the cycle's own frame here"
      if (f !== null && !frames[f]) {
        push("walk-variants", "error", `walk variant names unknown frame "${f}"`);
      }
    }
  }

  for (const [id, def] of Object.entries(cfg.actions)) {
    for (const f of [
      ...def.frames,
      ...(def.enter ?? []),
      ...(def.exit ?? []),
      ...(def.abort ?? []),
    ]) {
      if (!frames[f]) push("action-frames", "error", `action "${id}" uses unknown frame "${f}"`);
    }
    if (def.frames.length === 0) push("action-empty", "error", `action "${id}" has no frames`);
    for (const ev of def.events ?? []) {
      if (ev.frame < 0 || ev.frame >= def.frames.length) {
        push(
          "action-frames",
          "error",
          `action "${id}" has an event at frame ${ev.frame} of ${def.frames.length}`,
        );
      }
    }
  }

  return issues;
}
