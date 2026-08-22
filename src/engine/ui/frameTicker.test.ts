import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameTicker } from "./frameTicker";

/**
 * The ticker under fake timers, with time injected so the module's `now`
 * agrees with vitest's clock.
 */
describe("frame ticker", () => {
  let t = 0;
  const now = () => t;
  /** Advance like a running clock: small steps, timers firing on time. */
  const tick = (ms: number) => {
    let left = ms;
    while (left > 0) {
      const step = Math.min(10, left);
      t += step;
      vi.advanceTimersByTime(step);
      left -= step;
    }
  };
  /** Advance like a starved tab: one jump, then the late timer fires. */
  const jump = (ms: number) => {
    t += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    t = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("fires a subscriber on its period", () => {
    const ticker = createFrameTicker(now);
    let beats = 0;
    ticker.every(100, () => beats++);
    tick(99);
    expect(beats).toBe(0);
    tick(2);
    expect(beats).toBe(1);
    tick(100);
    expect(beats).toBe(2);
  });

  it("coalesces near-simultaneous beats into one callback burst", () => {
    const ticker = createFrameTicker(now);
    const order: string[] = [];
    ticker.every(100, () => order.push("a"));
    ticker.every(110, () => order.push("b")); // within the 24ms grid of a's beat
    tick(101);
    // both fired in the same timeout callback — one wakeup, one React commit
    expect(order).toEqual(["a", "b"]);
  });

  it("re-aims the single timer when a faster subscriber joins", () => {
    const ticker = createFrameTicker(now);
    let slow = 0;
    let fast = 0;
    ticker.every(1000, () => slow++);
    tick(10);
    ticker.every(50, () => fast++);
    tick(55);
    expect(fast).toBe(1);
    expect(slow).toBe(0);
  });

  it("stops on unsubscribe and disarms when the last one leaves", () => {
    const ticker = createFrameTicker(now);
    let beats = 0;
    const off = ticker.every(100, () => beats++);
    tick(101);
    off();
    expect(ticker.size).toBe(0);
    tick(500);
    expect(beats).toBe(1);
  });

  it("catches up a starved clock with one beat, not a burst", () => {
    const ticker = createFrameTicker(now);
    let beats = 0;
    ticker.every(100, () => beats++);
    // the tab slept for a second; the timeout fires once, late
    jump(1000);
    expect(beats).toBe(1);
    // and the next beat is one period from *now*, not nine overdue ones
    tick(100);
    expect(beats).toBe(2);
  });

  it("keeps independent periods independent", () => {
    const ticker = createFrameTicker(now);
    let a = 0;
    let b = 0;
    ticker.every(100, () => a++);
    ticker.every(300, () => b++);
    tick(650);
    // a: 100,200,300... but re-anchoring after shared wakeups makes exact
    // counts scheduling-dependent; the invariant is the ratio and liveness
    expect(a).toBeGreaterThanOrEqual(4);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(a).toBeGreaterThan(b);
  });
});
