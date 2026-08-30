import { describe, expect, it } from "vitest";
import { type ActionRun, stepAction } from "./actionPlayer";
import type { ActionDef } from "./types";

/** frameMs 100: enter 0–199 (e1,e2), loop 200–599 (a,b,a,b), exit 600–699 (x1). */
const DEF: ActionDef = {
  frames: ["a", "b"],
  frameMs: 100,
  loops: 2,
  interruptible: true,
  enter: ["e1", "e2"],
  exit: ["x1"],
  abort: ["ab"],
};

const run = (start = 0): ActionRun => ({ id: "swing", start });

describe("action player", () => {
  it("plays enter, loop and exit at the authored times", () => {
    const r = run();
    expect(stepAction(r, DEF, 0, false, false).frame).toBe("e1");
    expect(stepAction(r, DEF, 150, false, false).frame).toBe("e2");
    expect(stepAction(r, DEF, 200, false, false).frame).toBe("a");
    expect(stepAction(r, DEF, 350, false, false).frame).toBe("b");
    expect(stepAction(r, DEF, 400, false, false).frame).toBe("a"); // second loop
    expect(stepAction(r, DEF, 650, false, false).frame).toBe("x1");
  });

  it("finishes naturally after enter+loop+exit", () => {
    const r = run();
    const end = stepAction(r, DEF, 700, false, false);
    expect(end.done).toBe(true);
    expect(end.natural).toBe(true);
    expect(end.frame).toBeNull();
  });

  it("drops an unknown action id instead of throwing every frame", () => {
    const end = stepAction(run(), undefined, 0, false, false);
    expect(end.unknown).toBe(true);
    expect(end.done).toBe(true);
    expect(end.natural).toBe(false);
  });

  it("interrupts into the abort frames once the enter phase is over", () => {
    const r = run();
    const step = stepAction(r, DEF, 300, true, false);
    expect(step.interrupted).toBe(true);
    expect(step.frame).toBe("ab");
    expect(step.done).toBe(false);
    // the abort plays out, then the action ends — not "naturally"
    const end = stepAction(r, DEF, 401, true, false);
    expect(end.done).toBe(true);
    expect(end.natural).toBe(false);
    expect(end.interrupted).toBe(false); // fired once, on the flip
  });

  it("never interrupts during the enter phase, locked input, or a non-interruptible action", () => {
    expect(stepAction(run(), DEF, 150, true, false).interrupted).toBe(false);
    expect(stepAction(run(), DEF, 300, true, true).interrupted).toBe(false);
    const solid: ActionDef = { ...DEF, interruptible: false };
    expect(stepAction(run(), solid, 300, true, false).interrupted).toBe(false);
  });

  it("falls back to the exit frames when no abort is authored", () => {
    const noAbort: ActionDef = { ...DEF, abort: undefined };
    const r = run();
    const step = stepAction(r, noAbort, 300, true, false);
    expect(step.interrupted).toBe(true);
    expect(step.frame).toBe("x1");
  });

  it("ends the same tick on an explicitly empty abort", () => {
    const cut: ActionDef = { ...DEF, abort: [] };
    const r = run();
    const step = stepAction(r, cut, 300, true, false);
    expect(step.interrupted).toBe(true);
    expect(step.done).toBe(true);
    expect(step.frame).toBeNull();
  });
});

describe("interrupt windows", () => {
  it("never interrupts during the natural exit — the action is already leaving", () => {
    const r = run();
    // exit phase is 600–699; walking there must not restart the way out
    const step = stepAction(r, DEF, 650, true, false);
    expect(step.interrupted).toBe(false);
    expect(step.frame).toBe("x1");
    expect(stepAction(r, DEF, 700, true, false).natural).toBe(true);
  });
});

describe("frame-timed events", () => {
  it("fire once per frame per loop, on the game clock, and not outside the loop", async () => {
    const { dueEvents } = await import("./actionPlayer");
    const def = {
      enter: ["e"],
      frames: ["a", "b"],
      exit: ["x"],
      frameMs: 100,
      loops: 2,
      events: [
        { frame: 1, sound: "thud" },
        { frame: 0, loop: 1, toast: "second" },
      ],
    };
    const run = { id: "t", start: 0 };
    const at = (now: number) => dueEvents(run, def, stepAction(run, def, now, false, false));
    expect(at(50)).toEqual([]); // enter
    expect(at(100)).toEqual([]); // a, loop 0
    expect(at(210).map((e) => e.sound)).toEqual(["thud"]); // b, loop 0
    expect(at(220)).toEqual([]); // same frame, already fired
    expect(at(300).map((e) => e.toast)).toEqual(["second"]); // a, loop 1
    expect(at(410).map((e) => e.sound)).toEqual(["thud"]); // b, loop 1 — every loop
    expect(at(520)).toEqual([]); // exit
  });
});
