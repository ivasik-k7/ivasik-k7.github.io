import type { SeqStep } from "./runtime-types";
import type { AnyWorld } from "./types";

/**
 * sequencer.ts — the cutscene runner, out of the loop.
 *
 * A sequence is a list of beats; each blocks until it resolves (a walk
 * arrives, an action ends, a dialogue closes, a deadline passes), and beats
 * that are instant collapse in the same frame. The runner is pure over a
 * caller-owned run record and a narrow host interface, so every step type is
 * testable against a fake host — no browser, no runtime.
 */

/** One in-flight sequence. Caller-owned; the runner mutates the cursor. */
export type SeqRun<W extends AnyWorld> = {
  steps: SeqStep<W>[];
  i: number;
  entered: boolean;
  enteredAt: number;
  deadline: number;
  cinematic: boolean;
  resolve: (ok: boolean) => void;
};

export const newSeqRun = <W extends AnyWorld>(
  steps: SeqStep<W>[],
  cinematic: boolean,
  resolve: (ok: boolean) => void,
): SeqRun<W> => ({
  steps,
  i: 0,
  entered: false,
  enteredAt: 0,
  deadline: 0,
  cinematic,
  resolve,
});

/**
 * Everything a sequence can ask of the runtime. The runtime implements this
 * once, over its refs; a test implements it with a recorder.
 */
export type SeqHost<W extends AnyWorld> = {
  showToast(text: string): void;
  /** Cancel any current auto-walk and arm one toward x (and optional feet-y). */
  startWalk(x: number, y: number | undefined, deadline: number): void;
  walking(): boolean;
  setFacing(facing: 1 | -1): void;
  /** Pin a player frame; null releases it. */
  holdFrame(frame: string | null): void;
  startAction(id: string): void;
  actionRunning(): boolean;
  updateWorld(patch: Partial<W> | ((w: W) => W)): void;
  spawnFx(kind: string, x: number, ttlMs: number, data?: unknown): void;
  shakeCamera(intensity: number, ms: number): void;
  flash(color?: string, ms?: number): void;
  focusCamera(x: number | null, ms?: number): void;
  letterbox(on: boolean): void;
  travel(scene: string, spawnX?: number, spawnY?: number): void;
  fading(): boolean;
  /** Open a dialogue tree against the sequence's anchor object. */
  openDialogue(tree: unknown): void;
  dialogueOpen(): boolean;
  playSound(name: string): void;
  playerX(): number;
  /** Clamp a walk target into the scene margins / its ground band. */
  clampWalkX(x: number): number;
  clampWalkY(y: number): number;
  /** The interaction ctx for `{do}` steps, built on the anchor object. */
  makeCtx(): unknown;
  /**
   * True when this run is no longer the live one. A `{do}` step can cancel
   * the sequence (or start another) from inside a beat; without this check
   * the runner would keep advancing an orphaned run that was already
   * resolved false.
   */
  cancelled(run: SeqRun<W>): boolean;
};

/**
 * Advance the run. Returns true when the sequence has finished — the caller
 * resolves the promise and unwinds any cinematic state; false while a beat is
 * still blocking. Instant steps collapse in one call, guarded against a
 * pathological all-instant list.
 */
export function stepSequence<W extends AnyWorld>(
  run: SeqRun<W>,
  host: SeqHost<W>,
  now: number,
): boolean {
  let guard = 0;
  while (run.i < run.steps.length && guard++ < 32) {
    const step = run.steps[run.i] as Record<string, unknown>;
    if (!run.entered) {
      run.entered = true;
      run.enteredAt = now;
      run.deadline = 0;
      enterStep(run, host, step, now);
    }
    if (host.cancelled(run)) return false;
    if (!stepDone(run, host, step, now)) return false;
    run.i++;
    run.entered = false;
  }
  return run.i >= run.steps.length && !host.cancelled(run);
}

function enterStep<W extends AnyWorld>(
  run: SeqRun<W>,
  host: SeqHost<W>,
  step: Record<string, unknown>,
  at: number,
): void {
  if ("wait" in step) {
    run.deadline = at + Number(step.wait);
  } else if ("say" in step) {
    const text = String(step.say);
    host.showToast(text);
    run.deadline = at + Math.min(3200, 1200 + text.length * 28);
  } else if ("walkTo" in step) {
    host.startWalk(
      host.clampWalkX(Number(step.walkTo)),
      step.y === undefined ? undefined : host.clampWalkY(Number(step.y)),
      at + Number(step.timeoutMs ?? 8000),
    );
  } else if ("face" in step) {
    host.setFacing(step.face === -1 ? -1 : 1);
  } else if ("hold" in step) {
    host.holdFrame(String(step.hold));
    run.deadline = at + Number(step.forMs ?? 600);
  } else if ("action" in step) {
    host.startAction(String(step.action));
  } else if ("world" in step) {
    host.updateWorld(step.world as Partial<W>);
  } else if ("fx" in step) {
    const spec = step.fx as { kind: string; x?: number; ttlMs?: number; data?: unknown };
    host.spawnFx(spec.kind, spec.x ?? host.playerX(), spec.ttlMs ?? 900, spec.data);
  } else if ("shake" in step) {
    host.shakeCamera(Number(step.shake), Number(step.ms ?? 300));
  } else if ("flash" in step) {
    const spec = step.flash as { color?: string; ms?: number };
    host.flash(spec.color, spec.ms);
  } else if ("focus" in step) {
    host.focusCamera(step.focus as number | null, Number(step.ms ?? 500));
  } else if ("letterbox" in step) {
    host.letterbox(Boolean(step.letterbox));
  } else if ("travel" in step) {
    const spec = step.travel as { scene: string; spawnX?: number; spawnY?: number };
    host.travel(spec.scene, spec.spawnX, spec.spawnY);
  } else if ("dialogue" in step) {
    host.openDialogue(step.dialogue);
  } else if ("sound" in step) {
    host.playSound(String(step.sound));
  } else if ("do" in step) {
    (step.do as (ctx: unknown) => void)(host.makeCtx());
  } else if ("until" in step) {
    run.deadline = at + Number(step.timeoutMs ?? 10000);
  }
}

function stepDone<W extends AnyWorld>(
  run: SeqRun<W>,
  host: SeqHost<W>,
  step: Record<string, unknown>,
  at: number,
): boolean {
  if ("walkTo" in step) return !host.walking();
  if ("action" in step) return !host.actionRunning();
  if ("dialogue" in step) return !host.dialogueOpen();
  if ("travel" in step) return !host.fading();
  if ("until" in step) {
    return (step.until as () => boolean)() || at >= run.deadline;
  }
  if (run.deadline > 0) {
    if (at < run.deadline) return false;
    if ("hold" in step) host.holdFrame(null);
    return true;
  }
  return true;
}
