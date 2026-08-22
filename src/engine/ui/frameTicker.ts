/**
 * frameTicker.ts — one clock for every inline actor.
 *
 * Every NpcActor/AnimalActor used to own a `setInterval`: N figures meant N
 * live timers, each waking the JS thread alone and committing its own React
 * update — measured at ~23–32 commits/sec in NPC-heavy scenes. This module
 * owns a single timeout, armed to the next due beat. Subscribers due within
 * the same coalescing window fire in the same callback, so React batches
 * their state updates into one commit, and an idle scene holds exactly one
 * pending timer however many characters are breathing in it.
 */

type Sub = { period: number; next: number; cb: () => void };

/** Beats landing within this window share one callback (and one commit). */
const GRID_MS = 24;

export type FrameTicker = {
  /** Fire cb every periodMs until the returned unsubscribe is called. */
  every(periodMs: number, cb: () => void): () => void;
  /** Live subscriber count — for diagnostics. */
  readonly size: number;
};

export function createFrameTicker(now: () => number = () => performance.now()): FrameTicker {
  const subs = new Set<Sub>();
  let timer: number | null = null;

  const disarm = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const arm = () => {
    if (timer !== null || subs.size === 0) return;
    let due = Number.POSITIVE_INFINITY;
    for (const s of subs) due = Math.min(due, s.next);
    timer = window.setTimeout(fire, Math.max(0, due - now()));
  };

  const fire = () => {
    timer = null;
    const t = now();
    for (const s of subs) {
      if (s.next <= t + GRID_MS) {
        // re-anchor on the shared clock: a starved background tab catches up
        // with one beat instead of a burst of them
        s.next = t + s.period;
        s.cb();
      }
    }
    arm();
  };

  return {
    every(periodMs: number, cb: () => void): () => void {
      const sub: Sub = { period: Math.max(16, periodMs), next: now() + Math.max(16, periodMs), cb };
      subs.add(sub);
      // the new beat may land before the armed one — re-aim
      disarm();
      arm();
      return () => {
        subs.delete(sub);
        if (subs.size === 0) disarm();
      };
    },
    get size() {
      return subs.size;
    },
  };
}

/** The shared instance every inline actor subscribes to. */
export const frameTicker = createFrameTicker();
