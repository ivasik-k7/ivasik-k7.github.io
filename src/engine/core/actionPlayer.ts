import type { ActionDef, ActionEvent } from "./types";

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
  /** frame-timed events already fired, as `${event index}@${loop}` */
  fired?: Set<string>;
};

export type ActionPhase = "enter" | "loop" | "exit" | null;

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
  /** Which part of the action the frame came from (the way out counts as exit). */
  phase: ActionPhase;
  /** In the loop: which of `frames` this is, and which pass of the loop. */
  frameIndex?: number;
  loop?: number;
};

const EMPTY: readonly string[] = [];

const step = (
  frame: string | null,
  done: boolean,
  natural: boolean,
  interrupted: boolean,
  unknown: boolean,
  phase: ActionPhase,
): ActionStep => ({ frame, done, natural, interrupted, unknown, phase });

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
    return step(null, true, false, false, true, null);
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
      return step(null, true, false, interrupted, false, null);
    }
    return step(out[Math.floor(t / def.frameMs)] ?? null, false, false, interrupted, false, "exit");
  }
  if (elapsed >= enterMs + loopMs + exitMs) {
    return step(null, true, true, false, false, null);
  }
  if (elapsed < enterMs) {
    return step(
      enter[Math.floor(elapsed / def.frameMs)] ?? null,
      false,
      false,
      false,
      false,
      "enter",
    );
  }
  if (elapsed < enterMs + loopMs) {
    const t = elapsed - enterMs;
    const i = Math.floor(t / def.frameMs);
    const frameIndex = i % def.frames.length;
    return {
      ...step(def.frames[frameIndex], false, false, false, false, "loop"),
      frameIndex,
      loop: Math.floor(i / def.frames.length),
    };
  }
  const t = elapsed - enterMs - loopMs;
  return step(exit[Math.floor(t / def.frameMs)] ?? null, false, false, false, false, "exit");
}

/**
 * The frame-timed events that come due on this tick's step, each once: an
 * event fires on the first tick that shows its frame in its loop (every loop
 * when it names none). Timed to the animation rather than a wall-clock timer,
 * so it pauses with the game and is cancelled with the action.
 */
export function dueEvents(run: ActionRun, def: ActionDef, s: ActionStep): ActionEvent[] {
  if (!def.events || s.phase !== "loop" || s.frameIndex === undefined) return [];
  const loop = s.loop ?? 0;
  if (!run.fired) run.fired = new Set();
  const fired = run.fired;
  const out: ActionEvent[] = [];
  def.events.forEach((ev, i) => {
    if (ev.frame !== s.frameIndex) return;
    if (ev.loop !== undefined && ev.loop !== loop) return;
    const key = `${i}@${loop}`;
    if (fired.has(key)) return;
    fired.add(key);
    out.push(ev);
  });
  return out;
}
