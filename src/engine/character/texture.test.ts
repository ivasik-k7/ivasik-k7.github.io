import { describe, expect, it } from "vitest";
import { shirtTexture, shoeTexture, trouserTexture } from "./texture";

describe("texture passes", () => {
  it("lights the front of a near leg and creases behind a bend", () => {
    const legs = ["..qppppq..", "..qppppq..", "...qpppq..", "...qpppq.."];
    const t = trouserTexture(legs);
    expect(t[0]).toBe("..qppprq..");
    // the run came in from the left on row 2: a crease at its back edge
    expect(t[2]).toBe("...Qpprq..");
    // too narrow for a highlight, and nothing to crease against
    expect(trouserTexture(["..qpq..."])[0]).toBe("..qpq...");
  });

  it("leaves the far leg (already a tone down) alone", () => {
    expect(trouserTexture(["..Qqqqq..."])[0]).toBe("..Qqqqq...");
  });

  it("gives shoes a heel counter and a toe catch-light", () => {
    const t = shoeTexture(["..bbb...", "..bbbb..", "..BBBB.."]);
    expect(t[0]).toBe("..Bbc...");
    expect(t[1]).toBe("..Bbbb..");
    expect(t[2]).toBe("..BBBB..");
  });

  it("puts the shirt highlight on the near shoulder, found from the torso's own edge", () => {
    const torso = [
      "...TtttttT...",
      ".TtttttttttT.",
      ".TtttttttttT.",
      ".TtttttttttT.",
      ".TtttttttttT.",
    ];
    const t = shirtTexture(torso);
    // the edge is the T at column 11: light at 8–9, then 7–9 below it
    expect(t[1]).toBe(".TttttttddtT.");
    expect(t[2]).toBe(".TtttttdddtT.");
    expect(t[0]).toBe(torso[0]);
  });
});
