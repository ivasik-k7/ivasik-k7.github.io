import { describe, expect, it } from "vitest";
import { newTalkState, resetTalk, stepTalk } from "./talkBrain";

const run = (speaking: boolean, ms: number, step = 40) => {
  const t = newTalkState();
  const frames: string[] = [];
  for (let now = 1000; now < 1000 + ms; now += step) frames.push(stepTalk(t, now, speaking));
  return frames;
};

describe("talk brain", () => {
  it("gestures while the words are his, and comes down between phrases", () => {
    const frames = run(true, 8000);
    const up = frames.filter((f) => f === "talkA" || f === "talkB").length;
    const down = frames.filter((f) => f === "stand" || f === "idleB").length;
    expect(up).toBeGreaterThan(40);
    expect(down).toBeGreaterThan(20);
    expect(frames).toContain("talkA");
    expect(frames).toContain("talkB");
    expect(frames).not.toContain("nod");
  });

  it("listens while the other side talks: still, with the odd nod", () => {
    const frames = run(false, 12000);
    expect(frames.filter((f) => f === "nod").length).toBeGreaterThan(3);
    expect(frames.filter((f) => f === "nod").length).toBeLessThan(frames.length / 4);
    expect(frames).not.toContain("talkA");
    expect(frames).not.toContain("talkB");
  });

  it("holds a beat for its length rather than flickering", () => {
    const frames = run(true, 4000, 20);
    let runs = 1;
    for (let i = 1; i < frames.length; i++) if (frames[i] !== frames[i - 1]) runs++;
    // ~4 s of beats at 450–1250 ms each, plus the breath toggling underneath
    expect(runs).toBeLessThan(16);
  });

  it("is deterministic and restarts cleanly", () => {
    const a = run(true, 3000);
    const b = run(true, 3000);
    expect(a).toEqual(b);
    const t = newTalkState();
    stepTalk(t, 5000, true);
    resetTalk(t);
    expect(t.beatAt).toBe(0);
  });
});
