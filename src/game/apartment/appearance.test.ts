import { describe, expect, it } from "vitest";
import { validateCharacter } from "@/engine";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";
import { uk } from "@/i18n/uk";
import {
  APPEARANCE_SLOTS,
  activeOutfit,
  applyOutfit,
  cycleOption,
  hoodAllowed,
  normalizeAppearance,
  OUTFITS,
  paletteForAppearance,
  playerForAppearance,
  rollAppearance,
  specForAppearance,
} from "./appearance";
import { PLAYER_VALIDATION } from "./player";

describe("normalizeAppearance", () => {
  it("fills a bare save with the drawn man", () => {
    const a = normalizeAppearance({});
    expect(a).toMatchObject({
      skin: "default",
      top: "tee",
      bottom: "trousers",
      feet: "sneakers",
      head: "none",
    });
  });
  it("resolves legacy shirt ids to a cut and a modern colour, once", () => {
    const a = normalizeAppearance({ shirt: "hoodie-grey" });
    expect(a.top).toBe("hoodie");
    expect(a.shirt).toBe("grey");
    const b = normalizeAppearance({ shirt: "sambo", trousers: "sambo", shoes: "black" });
    expect(b).toMatchObject({ top: "kurtka", shirt: "red", bottom: "shorts", feet: "boots" });
  });
  it("does not second-guess a save that already carries the shape", () => {
    const a = normalizeAppearance({ shirt: "hoodie-grey", top: "tee" });
    expect(a.top).toBe("tee");
    const b = normalizeAppearance({ shoes: "black", feet: "sneakers" });
    expect(b.feet).toBe("sneakers");
  });
  it("rejects colour ids the rails do not offer", () => {
    const a = normalizeAppearance({ skin: "zzz", hat: "purple", shirt: "neon" });
    expect(a.skin).toBe("default");
    expect(a.hat).toBe("navy");
    expect(a.shirt).toBe("default");
  });
  it("turns the old hat 'none' into no headwear, and keeps a hood only over a hoodie", () => {
    expect(normalizeAppearance({ hat: "none" }).head).toBe("none");
    expect(normalizeAppearance({ head: "hood", top: "jacket" }).head).toBe("none");
    expect(normalizeAppearance({ head: "hood", top: "hoodie" }).head).toBe("hood");
    expect(hoodAllowed("hoodie")).toBe(true);
    expect(hoodAllowed("tee")).toBe(false);
  });
  it("is idempotent", () => {
    const once = normalizeAppearance({ shirt: "hoodie-black", trousers: "grey" });
    expect(normalizeAppearance(once)).toEqual(once);
  });
});

describe("palette derivation", () => {
  it("hood zone is its own tone on a hoodie and plain shirt otherwise", () => {
    const hoodie = paletteForAppearance({ top: "hoodie", shirt: "grey" });
    const tee = paletteForAppearance({ top: "tee", shirt: "grey" });
    expect(hoodie.m).not.toBe(hoodie.t);
    expect(tee.m).toBe(tee.t);
  });
  it("shaved head and clean shave borrow the skin", () => {
    const p = paletteForAppearance({ hair: "shaved", beard: "none", skin: "deep" });
    expect(p.f).toBe(p.s);
    expect(p.h).toBe(p.S);
  });
  it("no headwear deletes the cap zone; a cap or beanie keeps it", () => {
    expect(paletteForAppearance({ head: "none" }).k).toBeUndefined();
    expect(paletteForAppearance({ head: "cap", hat: "red" }).k).toBe("#a33a30");
    expect(paletteForAppearance({ head: "beanie", hat: "red" }).k).toBe("#a33a30");
  });
});

describe("outfits", () => {
  it("apply, are detected, and compile clean", { timeout: 60_000 }, () => {
    for (const o of OUTFITS) {
      const a = applyOutfit(normalizeAppearance({}), o);
      expect(activeOutfit(a), o.id).toBe(o.id);
      const cfg = playerForAppearance(a);
      expect(
        validateCharacter(cfg, PLAYER_VALIDATION).filter((i) => i.severity === "error"),
      ).toEqual([]);
    }
  });
  it("a roll is always a valid, dressed man", () => {
    for (let i = 0; i < 20; i++) {
      const a = rollAppearance();
      expect(normalizeAppearance(a)).toEqual(a);
      expect(specForAppearance(a).garments.torso).toBe(a.top);
    }
  });
});

describe("rails", () => {
  it("cycle wraps and restarts from an unknown id", () => {
    const slot = APPEARANCE_SLOTS.find((s) => s.key === "hat");
    if (!slot) throw new Error("no hat rail");
    const ids = slot.options.map((o) => o.id);
    expect(cycleOption(slot, ids[ids.length - 1], 1)).toBe(ids[0]);
    expect(cycleOption(slot, "none", 1)).toBe(ids[0]);
  });
  it("every option and outfit has a label in every language", () => {
    const optionKey = (slotKey: string, id: string) => {
      const map: Record<string, Record<string, string>> = {
        skin: { default: "warm" },
        hair: { default: "chestnut" },
        beard: { default: "stubble", none: "cleanShave" },
        shirt: { default: "black" },
        trousers: { default: "navy", sambo: "red" },
        shoes: { default: "white", sambovki: "blue" },
      };
      return map[slotKey]?.[id] ?? id;
    };
    for (const cat of [en, uk, pl]) {
      const options = cat.wardrobe.option as Record<string, string>;
      for (const slot of APPEARANCE_SLOTS) {
        for (const o of slot.options) {
          expect(options[optionKey(slot.key, o.id)], `${slot.key}.${o.id}`).toBeTypeOf("string");
        }
      }
      for (const o of OUTFITS) {
        expect((cat.wardrobe.outfit as Record<string, string>)[o.id], o.id).toBeTypeOf("string");
        expect((cat.wardrobe.note as Record<string, string>)[o.id], `note ${o.id}`).toBeTypeOf(
          "string",
        );
      }
    }
  });
});
