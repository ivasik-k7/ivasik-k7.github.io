import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireVoice,
  CHANNEL_OF,
  dwellMs,
  releaseVoice,
  resetVoices,
  voiceHolder,
} from "./monologue";

describe("monologue floors", () => {
  beforeEach(() => resetVoices());

  it("grants a free floor and holds it against equal priority", () => {
    const a = {};
    const b = {};
    expect(acquireVoice("world", a)).toBe(true);
    expect(acquireVoice("world", b)).toBe(false);
    expect(voiceHolder("world")).toBe(a);
  });

  it("is idempotent for the current holder", () => {
    const a = {};
    expect(acquireVoice("world", a)).toBe(true);
    expect(acquireVoice("world", a)).toBe(true);
  });

  it("lets a higher priority evict, and tells the loser", () => {
    const a = {};
    const b = {};
    const evicted = vi.fn();
    acquireVoice("world", a, 0, evicted);
    expect(acquireVoice("world", b, 1)).toBe(true);
    expect(evicted).toHaveBeenCalledTimes(1);
    expect(voiceHolder("world")).toBe(b);
  });

  it("does not evict on equal priority", () => {
    const a = {};
    const evicted = vi.fn();
    acquireVoice("world", a, 2, evicted);
    expect(acquireVoice("world", {}, 2)).toBe(false);
    expect(evicted).not.toHaveBeenCalled();
  });

  it("keeps channels independent", () => {
    const npc = {};
    const player = {};
    expect(acquireVoice("world", npc)).toBe(true);
    expect(acquireVoice("player", player)).toBe(true);
    expect(voiceHolder("world")).toBe(npc);
    expect(voiceHolder("player")).toBe(player);
  });

  it("release is a no-op for a non-holder", () => {
    const a = {};
    acquireVoice("world", a);
    releaseVoice("world", {});
    expect(voiceHolder("world")).toBe(a);
    releaseVoice("world", a);
    expect(voiceHolder("world")).toBe(null);
  });

  it("maps every kind onto a channel", () => {
    expect(CHANNEL_OF.speech).toBe("world");
    expect(CHANNEL_OF.ambient).toBe("world");
    expect(CHANNEL_OF.thought).toBe("player");
    expect(CHANNEL_OF.announce).toBe("screen");
    expect(CHANNEL_OF.narrate).toBe("screen");
  });

  it("dwell grows with length inside hard bounds", () => {
    expect(dwellMs("")).toBe(2000);
    expect(dwellMs("Nie pytaj.")).toBe(2280);
    expect(dwellMs("x".repeat(400))).toBe(7200);
  });
});
