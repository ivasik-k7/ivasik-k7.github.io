import { describe, expect, it } from "vitest";
import { OUTSIDE_SCENES } from "@/game/apartment/outsideScenes";
import { APARTMENT_SCENES } from "@/game/apartment/scenes";
import { applyEvent, freshBody, simulateBody } from "./body";
import { HOME, nextThought, OUTDOORS, THOUGHT_GAP, THOUGHT_RULES } from "./thoughts";

const inside = { outdoors: false, moving: false, running: false };

describe("the inner voice", () => {
  it("says nothing to a rested man in the morning", () => {
    expect(nextThought(freshBody(9), "studio")).toBeNull();
  });

  it("notices hunger, more so in the shop, and does not repeat itself", () => {
    let w = freshBody(9);
    for (let i = 0; i < 25; i++) w = simulateBody(w, 10, inside); // ~4 h: hungry, not starving
    const onStreet = nextThought(w, "outside");
    expect(onStreet?.key).toBe("hungryStreet");
    const inShop = nextThought(w, "zabka");
    expect(inShop?.key).toBe("hungryZabka");
    // said: the gap holds, then the cooldown holds
    w = inShop?.world ?? w;
    expect(nextThought(w, "zabka")).toBeNull();
    w = simulateBody(w, THOUGHT_GAP + 1, inside);
    expect(nextThought(w, "zabka")?.key).not.toBe("hungryZabka");
  });

  it("the third cigarette gets a line, once", () => {
    let w = freshBody(8);
    w = applyEvent(w, { kind: "smoke" });
    w = applyEvent(w, { kind: "smoke" });
    expect(nextThought(w, "balcony")?.key).not.toBe("thirdCigarette");
    w = applyEvent(w, { kind: "smoke" });
    const t = nextThought(w, "balcony");
    expect(t?.key).toBe("thirdCigarette");
  });

  it("the morning after outranks the ordinary", () => {
    let w = freshBody(22);
    for (let i = 0; i < 3; i++) w = applyEvent(w, { kind: "beer" });
    w = applyEvent(w, { kind: "sleep" });
    expect(nextThought(w, "studio")?.key).toBe("hungover");
  });

  it("every rule has a distinct key", () => {
    const keys = THOUGHT_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every scene a rule names is a scene the game has", () => {
    const known = new Set([...Object.keys(APARTMENT_SCENES), ...Object.keys(OUTSIDE_SCENES)]);
    for (const r of THOUGHT_RULES) {
      for (const sc of r.scenes ?? []) expect(known.has(sc), `${r.key}: ${sc}`).toBe(true);
    }
    for (const sc of [...OUTDOORS, ...HOME]) expect(known.has(sc), sc).toBe(true);
  });
});
