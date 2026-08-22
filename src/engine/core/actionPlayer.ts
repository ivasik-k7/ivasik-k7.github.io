import type { ActionDef } from "./types";

/**
 * actionPlayer.ts — the action animation state machine, out of the loop.
 *
 * An action plays enter once, loops `frames`, plays exit once. An interrupt
 * (the player pressing a direction during an interruptible action) does not
 * cut on the spot: it stops the loop where it is and plays the way out —
 * `abort` when the author provided a shorter one, the full exit otherwise.
 *
 * Pure apart from mutating the caller-owned run record, so the whole timing
 * table — enter/loop/exit boundaries, interrupts, empty aborts — is testable
 * with numbers instead of a browser.
 */

/** The caller-owned record of a running action. */
export type ActionRun = {
  id: string;
  start: number;
  onInterrupt?: () => void;
  /** the frames being played on the way out, once the action is leaving */
  leaving?: readonly string[];
  leftAt?: number;
};

export type ActionStep = {
  /** Frame to show this tick; null when the action produced none. */
  frame: string | null;
  /** The action ended this tick — the caller clears its run. */
  done: boolean;
  /** It ended by playing out naturally — release the buffered interact. */
  natural: boolean;
  /** The interrupt fired this tick — run the caller's side effects. */
  interrupted: boolean;
  /** The id names no ActionDef — drop it (and warn, in dev). */
  unknown: boolean;
};

const EMPTY: readonly string[] = [];

export function stepAction(
  run: ActionRun,
  def: ActionDef | undefined,
  now: number,
  wantsMove: boolean,
  inputLocked: boolean,
): ActionStep {
  if (!def) {
    // An unknown action id used to throw inside the frame loop — again on the
    // next frame and every frame after, and the game was gone. A typo in
    // content must not be a hard lock: drop it and carry on.
    return { frame: null, done: true, natural: false, interrupted: false, unknown: true };
  }
  const elapsed = now - run.start;
  const enter = def.enter ?? EMPTY;
  const exit = def.exit ?? EMPTY;
  const enterMs = enter.length * def.frameMs;
  const loopMs = def.frames.length * def.frameMs * def.loops;
  const exitMs = exit.length * def.frameMs;

  let interrupted = false;
  // interruptible only through the loop: during enter the pose isn't held
  // yet, and during the natural exit the action is already on its way out —
  // re-entering `leaving` there would restart the walk-away the player is
  // watching finish
  if (
    !run.leaving &&
    def.interruptible &&
    wantsMove &&
    !inputLocked &&
    elapsed >= enterMs &&
    elapsed < enterMs + loopMs
  ) {
    run.leaving = def.abort ?? exit;
    run.leftAt = now;
    interrupted = true;
  }
  if (run.leaving) {
    const out = run.leaving;
    const t = now - (run.leftAt ?? now);
    if (t >= out.length * def.frameMs) {
      return { frame: null, done: true, natural: false, interrupted, unknown: false };
    }
    return {
      frame: out[Math.floor(t / def.frameMs)] ?? null,
      done: false,
      natural: false,
      interrupted,
      unknown: false,
    };
  }
  if (elapsed >= enterMs + loopMs + exitMs) {
    return { frame: null, done: true, natural: true, interrupted: false, unknown: false };
  }
  let frame: string | null;
  if (elapsed < enterMs) {
    frame = enter[Math.floor(elapsed / def.frameMs)] ?? null;
  } else if (elapsed < enterMs + loopMs) {
    const t = elapsed - enterMs;
    frame = def.frames[Math.floor(t / def.frameMs) % def.frames.length];
  } else {
    const t = elapsed - enterMs - loopMs;
    frame = exit[Math.floor(t / def.frameMs)] ?? null;
  }
  return { frame, done: false, natural: false, interrupted: false, unknown: false };
}
