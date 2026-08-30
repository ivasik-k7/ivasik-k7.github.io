import { describe, expect, it } from "vitest";
import { layeredFrame, layerUpper, newLayerState, startLayer, stopLayer } from "./layerBrain";
import type { PlayerConfig } from "./types";

const cfg = {
  layers: { cig: { frames: ["cigDown", "cigLips"], frameMs: 100, bodies: ["stand"] } },
  layered: { stand: { cigDown: "stand+cigDown", cigLips: "stand+cigLips" } },
} as unknown as PlayerConfig;

describe("layer brain", () => {
  it("cycles the layer's clip on the clock and stops when told", () => {
    const st = newLayerState();
    expect(layerUpper(st, cfg, 0)).toBeNull();
    startLayer(st, "cig", 1000);
    expect(layerUpper(st, cfg, 1000)).toBe("cigDown");
    expect(layerUpper(st, cfg, 1150)).toBe("cigLips");
    expect(layerUpper(st, cfg, 1250)).toBe("cigDown");
    stopLayer(st, "other");
    expect(layerUpper(st, cfg, 1300)).not.toBeNull();
    stopLayer(st, "cig");
    expect(layerUpper(st, cfg, 1300)).toBeNull();
  });

  it("drops itself after its time, and re-arming extends without restarting", () => {
    const st = newLayerState();
    startLayer(st, "cig", 0, 1000);
    expect(layerUpper(st, cfg, 999)).not.toBeNull();
    startLayer(st, "cig", 500, 1000);
    expect(st.run?.start).toBe(0);
    expect(layerUpper(st, cfg, 1400)).not.toBeNull();
    expect(layerUpper(st, cfg, 1500)).toBeNull();
    expect(st.run).toBeNull();
  });

  it("picks the baked combination, or the body alone", () => {
    expect(layeredFrame(cfg, "stand", "cigDown")).toBe("stand+cigDown");
    expect(layeredFrame(cfg, "stand", null)).toBe("stand");
    expect(layeredFrame(cfg, "backStand", "cigDown")).toBe("backStand");
    expect(layeredFrame(cfg, "stand", "nope")).toBe("stand");
  });
});
