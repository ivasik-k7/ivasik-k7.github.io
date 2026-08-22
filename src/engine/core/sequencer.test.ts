import { describe, expect, it } from "vitest";
import type { SeqStep } from "./runtime-types";
import { newSeqRun, type SeqHost, type SeqRun, stepSequence } from "./sequencer";

type W = { tea: number };

/** A host that records everything and lets a test flip its blocking state. */
function fakeHost() {
  const calls: string[] = [];
  const state = {
    walking: false,
    action: false,
    dialogue: false,
    fading: false,
    cancelledRun: null as SeqRun<W> | null,
  };
  const host: SeqHost<W> = {
    showToast: (t) => calls.push(`toast:${t}`),
    startWalk: (x, y, deadline) => {
      state.walking = true;
      calls.push(`walk:${x},${y ?? "-"},${deadline}`);
    },
    walking: () => state.walking,
    setFacing: (f) => calls.push(`face:${f}`),
    holdFrame: (f) => calls.push(`hold:${f}`),
    startAction: (id) => {
      state.action = true;
      calls.push(`action:${id}`);
    },
    actionRunning: () => state.action,
    updateWorld: () => calls.push("world"),
    spawnFx: (kind, x, ttl) => calls.push(`fx:${kind}@${x}/${ttl}`),
    shakeCamera: (i, ms) => calls.push(`shake:${i},${ms}`),
    flash: (c, ms) => calls.push(`flash:${c ?? "-"},${ms ?? "-"}`),
    focusCamera: (x, ms) => calls.push(`focus:${x},${ms}`),
    letterbox: (on) => calls.push(`letterbox:${on}`),
    travel: (s, x, y) => {
      state.fading = true;
      calls.push(`travel:${s},${x},${y ?? "-"}`);
    },
    fading: () => state.fading,
    openDialogue: () => {
      state.dialogue = true;
      calls.push("dialogue");
    },
    dialogueOpen: () => state.dialogue,
    playSound: (n) => calls.push(`sound:${n}`),
    playerX: () => 240,
    clampWalkX: (x) => Math.max(20, Math.min(x, 540)),
    clampWalkY: (y) => Math.max(150, Math.min(y, 170)),
    makeCtx: () => ({ marker: true }),
    cancelled: (run) => state.cancelledRun === run,
  };
  return { host, calls, state };
}

describe("sequencer", () => {
  it("collapses instant steps in one call and finishes", () => {
    const { host, calls } = fakeHost();
    const steps: SeqStep<W>[] = [
      { face: -1 },
      { world: { tea: 1 } },
      { fx: { kind: "heart" } },
      { shake: 3 },
      { flash: {} },
      { letterbox: true },
      { sound: "click" },
    ];
    const run = newSeqRun(steps, false, () => {});
    expect(stepSequence(run, host, 1000)).toBe(true);
    expect(calls).toEqual([
      "face:-1",
      "world",
      "fx:heart@240/900", // no x given: spawns at the player
      "shake:3,300",
      "flash:-,-",
      "letterbox:true",
      "sound:click",
    ]);
  });

  it("waits out a deadline, and a say's deadline scales with its text", () => {
    const { host } = fakeHost();
    const run = newSeqRun<W>([{ wait: 500 }, { say: "hi" }], false, () => {});
    expect(stepSequence(run, host, 1000)).toBe(false);
    expect(stepSequence(run, host, 1400)).toBe(false); // wait not over
    expect(stepSequence(run, host, 1500)).toBe(false); // wait over, say entered
    // "hi" = 1200 + 2*28 = 1256ms from entry at 1500
    expect(stepSequence(run, host, 2700)).toBe(false);
    expect(stepSequence(run, host, 2756)).toBe(true);
  });

  it("clamps a walk target and blocks until arrival", () => {
    const { host, calls, state } = fakeHost();
    const run = newSeqRun<W>([{ walkTo: 900, y: 200, timeoutMs: 5000 }], false, () => {});
    expect(stepSequence(run, host, 1000)).toBe(false);
    expect(calls[0]).toBe("walk:540,170,6000"); // x and y both clamped
    state.walking = false; // the runtime's auto-walk arrived
    expect(stepSequence(run, host, 1200)).toBe(true);
  });

  it("holds a frame for its duration and releases it on the way out", () => {
    const { host, calls } = fakeHost();
    const run = newSeqRun<W>([{ hold: "sit", forMs: 400 }], false, () => {});
    expect(stepSequence(run, host, 1000)).toBe(false);
    expect(calls).toEqual(["hold:sit"]);
    expect(stepSequence(run, host, 1400)).toBe(true);
    expect(calls).toEqual(["hold:sit", "hold:null"]);
  });

  it("blocks on actions, dialogues and travel until each clears", () => {
    const { host, state } = fakeHost();
    const run = newSeqRun<W>(
      [{ action: "swing" }, { dialogue: {} }, { travel: { scene: "gym" } }],
      false,
      () => {},
    );
    expect(stepSequence(run, host, 1000)).toBe(false);
    state.action = false;
    expect(stepSequence(run, host, 1100)).toBe(false); // dialogue now open
    state.dialogue = false;
    expect(stepSequence(run, host, 1200)).toBe(false); // travel now fading
    state.fading = false;
    expect(stepSequence(run, host, 1300)).toBe(true);
  });

  it("resolves an until by predicate or by timeout, whichever first", () => {
    let ready = false;
    const { host } = fakeHost();
    const byFlag = newSeqRun<W>([{ until: () => ready }], false, () => {});
    expect(stepSequence(byFlag, host, 1000)).toBe(false);
    ready = true;
    expect(stepSequence(byFlag, host, 1001)).toBe(true);
    const byTime = newSeqRun<W>([{ until: () => false, timeoutMs: 300 }], false, () => {});
    expect(stepSequence(byTime, host, 1000)).toBe(false);
    expect(stepSequence(byTime, host, 1301)).toBe(true);
  });

  it("hands {do} steps the anchor ctx", () => {
    const { host } = fakeHost();
    let got: unknown = null;
    const run = newSeqRun<W>([{ do: (ctx) => (got = ctx) }], false, () => {});
    expect(stepSequence(run, host, 1000)).toBe(true);
    expect(got).toEqual({ marker: true });
  });

  it("stops advancing a run that was cancelled from inside a {do} step", () => {
    const { host, calls, state } = fakeHost();
    const run: SeqRun<W> = newSeqRun(
      [{ do: () => (state.cancelledRun = run) }, { sound: "never" }],
      false,
      () => {},
    );
    expect(stepSequence(run, host, 1000)).toBe(false);
    expect(calls).not.toContain("sound:never");
  });
});
