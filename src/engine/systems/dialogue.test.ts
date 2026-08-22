import { describe, expect, it } from "vitest";
import {
  advanceDialogue,
  chooseDialogue,
  type DialogueState,
  type DialogueTree,
  defineTree,
  dialogueAtChoices,
  offeredChoices,
  openDialogue,
  validateTree,
} from "./dialogue";

/** A ctx with the runtime's flag store shape, so `once` has somewhere to live. */
function flagCtx() {
  const flags: Record<string, boolean> = {};
  return {
    flags,
    ctx: () => ({
      flag: (k: string) => flags[k] === true,
      setFlag: (k: string, on = true) => {
        flags[k] = on;
      },
    }),
  };
}

const bare = () => ({});

const TREE: DialogueTree<never> = {
  start: "hello",
  nodes: {
    hello: {
      lines: [{ speaker: "PANI", text: "Dzień dobry." }, { text: "She waits." }],
      choices: [
        { label: "Ask about the lift", next: "lift", id: "ask-lift", once: true },
        { label: "Buy tea", next: "tea", locked: () => "5 zł" as string | null },
        { label: "Leave" },
      ],
    },
    lift: { lines: [{ text: "Broken since March." }], next: "hello" },
    tea: { lines: [{ text: "Here you go." }] },
  },
} as DialogueTree<never>;

const open = (ctx: () => unknown = bare): DialogueState => {
  const step = openDialogue(TREE, ctx);
  if (step.kind !== "continue") throw new Error("expected continue");
  return step.state;
};

describe("dialogue", () => {
  it("types a line, then advances, then offers choices at the last line", () => {
    let state = open();
    expect(state.nodeId).toBe("hello");
    expect(dialogueAtChoices(state, bare)).toBe(false);
    // first advance finishes typing, second moves to the next line
    let step = advanceDialogue(state, bare);
    if (step.kind !== "continue") throw new Error();
    state = step.state;
    expect(state.lineDone).toBe(true);
    step = advanceDialogue(state, bare);
    if (step.kind !== "continue") throw new Error();
    state = step.state;
    expect(state.lineIndex).toBe(1);
    step = advanceDialogue(state, bare);
    if (step.kind !== "continue") throw new Error();
    state = step.state;
    expect(dialogueAtChoices(state, bare)).toBe(true);
  });

  it("follows a choice, auto-advances next, and records the visit history", () => {
    let state = open();
    const step = chooseDialogue(state, 0, bare);
    if (step.kind !== "continue") throw new Error();
    state = step.state;
    expect(state.nodeId).toBe("lift");
    // the single line, typed and advanced, auto-returns via `next`
    let s = advanceDialogue(state, bare);
    if (s.kind !== "continue") throw new Error();
    s = advanceDialogue(s.state, bare);
    if (s.kind !== "continue") throw new Error();
    expect(s.state.nodeId).toBe("hello");
    expect(s.state.visited).toEqual(["hello", "lift", "hello"]);
  });

  it("keeps a locked choice visible but inert", () => {
    const state = open();
    const offered = offeredChoices(TREE.nodes.hello, bare);
    expect(offered[1].lockedBy).toBe("5 zł");
    const step = chooseDialogue(state, 1, bare);
    expect(step.kind).toBe("continue");
    if (step.kind === "continue") expect(step.state.nodeId).toBe("hello");
  });

  it("ends on a choice without a next, handing back onEnd", () => {
    const state = open();
    const step = chooseDialogue(state, 2, bare);
    expect(step.kind).toBe("end");
  });

  it("spends a `once` choice through the ctx flag store", () => {
    const { ctx } = flagCtx();
    const state = open(ctx);
    expect(offeredChoices(TREE.nodes.hello, ctx)).toHaveLength(3);
    chooseDialogue(state, 0, ctx);
    const after = offeredChoices(TREE.nodes.hello, ctx);
    expect(after).toHaveLength(2);
    expect(after.map((c) => c.label)).toEqual(["Buy tea", "Leave"]);
  });

  it("offers `once` forever on a ctx that cannot remember — degrade, don't crash", () => {
    const state = open();
    chooseDialogue(state, 0, bare);
    expect(offeredChoices(TREE.nodes.hello, bare)).toHaveLength(3);
  });

  it("validates the authoring mistakes that bite silently", () => {
    const broken: DialogueTree<never> = {
      start: "a",
      nodes: {
        a: {
          lines: [{ text: "hi" }],
          next: "ghost",
          choices: [{ label: "again", once: true }],
        },
        island: { lines: [] },
      },
    } as DialogueTree<never>;
    const kinds = validateTree(broken)
      .map((p) => p.kind)
      .sort();
    expect(kinds).toEqual(["empty", "missing", "once-without-id", "unreachable"]);
  });
});

describe("dialogue variants (no verbatim repeats)", () => {
  const varTree = (mode?: "exhaust" | "cycle" | "random"): DialogueTree<never> =>
    ({
      id: "pani",
      start: "hello",
      nodes: {
        hello: {
          lines: [{ text: "fallback" }],
          variantMode: mode,
          variants: [
            { lines: [{ text: "first meeting" }] },
            { lines: [{ text: "second time" }] },
            { lines: [{ text: "standing line" }] },
          ],
        },
      },
    }) as DialogueTree<never>;

  const openLines = (tree: DialogueTree<never>, ctx: () => unknown): string => {
    const step = openDialogue(tree, ctx);
    if (step.kind !== "continue") throw new Error();
    return step.state.lines.map((l) => l.text).join("|");
  };

  it("exhausts variants in order then holds the last (persisted via counters)", () => {
    const counters: Record<string, number> = {};
    const ctx = () => ({
      counter: (k: string) => counters[k] ?? 0,
      bump: (k: string, by = 1) => {
        counters[k] = (counters[k] ?? 0) + by;
        return counters[k];
      },
    });
    const tree = varTree(); // default exhaust
    expect(openLines(tree, ctx)).toBe("first meeting");
    expect(openLines(tree, ctx)).toBe("second time");
    expect(openLines(tree, ctx)).toBe("standing line");
    expect(openLines(tree, ctx)).toBe("standing line"); // held
  });

  it("cycles forever in cycle mode, remembering per-session without a counter store", () => {
    const tree = varTree("cycle");
    const bare = () => ({});
    expect(openLines(tree, bare)).toBe("first meeting");
    expect(openLines(tree, bare)).toBe("second time");
    expect(openLines(tree, bare)).toBe("standing line");
    expect(openLines(tree, bare)).toBe("first meeting"); // wrapped
  });

  it("never repeats the same random variant twice running", () => {
    const tree = varTree("random");
    const bare = () => ({});
    let prev = openLines(tree, bare);
    for (let i = 0; i < 20; i++) {
      const next = openLines(tree, bare);
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it("skips variants whose `when` fails and falls back to node lines when none qualify", () => {
    const tree = {
      id: "t2",
      start: "n",
      nodes: {
        n: {
          lines: [{ text: "fallback" }],
          variants: [{ lines: [{ text: "never" }], when: () => false }],
        },
      },
    } as DialogueTree<never>;
    expect(openLines(tree, () => ({}))).toBe("fallback");
  });
});

describe("per-line conditions", () => {
  it("drops lines whose `when` says not today, keeping the rest in order", () => {
    let raining = true;
    const tree = {
      start: "n",
      nodes: {
        n: {
          lines: [
            { text: "always" },
            { text: "rain line", when: () => raining },
            { text: "closing" },
          ],
        },
      },
    } as DialogueTree<never>;
    const texts = () => {
      const step = openDialogue(tree, () => ({}));
      if (step.kind !== "continue") throw new Error();
      return step.state.lines.map((l) => l.text);
    };
    expect(texts()).toEqual(["always", "rain line", "closing"]);
    raining = false;
    expect(texts()).toEqual(["always", "closing"]);
  });
});

describe("seen-choice memory", () => {
  it("marks an identified choice as asked-before through the flag store", () => {
    const { ctx } = flagCtx();
    const state = open(ctx);
    expect(offeredChoices(TREE.nodes.hello, ctx).map((c) => c.seenBefore)).toEqual([
      false,
      false,
      false,
    ]);
    chooseDialogue(state, 0, ctx);
    // the once-choice is gone entirely; the others carry their memory flags
    const after = offeredChoices(TREE.nodes.hello, ctx);
    expect(after.map((c) => `${c.label}:${c.seenBefore}`)).toEqual([
      "Buy tea:false",
      "Leave:false",
    ]);
  });
});

describe("natural-conversation mechanics", () => {
  it("routes a re-asked question through againNext, where exhaust variants escalate", () => {
    const { ctx } = flagCtx();
    const counters: Record<string, number> = {};
    const full = () => ({
      ...(ctx() as object),
      counter: (k: string) => counters[k] ?? 0,
      bump: (k: string, by = 1) => {
        counters[k] = (counters[k] ?? 0) + by;
        return counters[k];
      },
    });
    const tree = defineTree(
      "smoker",
      { npc: "smoker" },
      {
        start: "hub",
        nodes: {
          hub: {
            lines: [{ speaker: "SMOKER", text: "No?" }],
            choices: [
              {
                id: "sm-quit",
                label: "When are you quitting?",
                next: "quit",
                againNext: "quitAgain",
              },
              { label: "Leave" },
            ],
          },
          quit: {
            lines: [{ speaker: "SMOKER", text: "Od poniedziałku. Zawsze od poniedziałku." }],
            next: "hub",
          },
          quitAgain: {
            lines: [{ text: "fallback" }],
            variantMode: "exhaust",
            variants: [
              { lines: [{ speaker: "SMOKER", text: "Mówiłem już. Poniedziałek." }] },
              { lines: [{ speaker: "SMOKER", text: "...", act: "smoke" }] },
            ],
            next: "hub",
          },
        },
      },
    ) as DialogueTree<never>;

    const s0 = openDialogue(tree, full);
    if (s0.kind !== "continue") throw new Error();
    // first ask: the real answer
    const first = chooseDialogue(s0.state, 0, full);
    if (first.kind !== "continue") throw new Error();
    expect(first.state.nodeId).toBe("quit");
    // second ask: the person reacts to being asked again — patiently
    const back = openDialogue(tree, full);
    if (back.kind !== "continue") throw new Error();
    const second = chooseDialogue(back.state, 0, full);
    if (second.kind !== "continue") throw new Error();
    expect(second.state.nodeId).toBe("quitAgain");
    expect(second.state.lines[0].text).toBe("Mówiłem już. Poniedziałek.");
    // third ask: just a look
    const back2 = openDialogue(tree, full);
    if (back2.kind !== "continue") throw new Error();
    const third = chooseDialogue(back2.state, 0, full);
    if (third.kind !== "continue") throw new Error();
    expect(third.state.lines[0].text).toBe("...");
  });

  it("lands the highest-weight qualifying interjection as an inner-voice line, once", () => {
    const { ctx } = flagCtx();
    const tree = defineTree(
      "t",
      {},
      {
        start: "n",
        nodes: {
          n: {
            lines: [{ speaker: "PANI", text: "Dobry." }],
            interjections: [
              { id: "int-a", text: "He dropped the 'dzień'.", once: true, weight: 2 },
              { id: "int-b", text: "Cold in here.", weight: 1 },
            ],
          },
        },
      },
    ) as DialogueTree<never>;
    const s1 = openDialogue(tree, ctx);
    if (s1.kind !== "continue") throw new Error();
    expect(s1.state.lines.map((l) => `${l.voice ?? "out"}:${l.text}`)).toEqual([
      "out:Dobry.",
      "inner:He dropped the 'dzień'.",
    ]);
    // the once-thought is spent; the lighter one takes its place next visit
    const s2 = openDialogue(tree, ctx);
    if (s2.kind !== "continue") throw new Error();
    expect(s2.state.lines[1].text).toBe("Cold in here.");
  });

  it("winds a drained hub down through exhaustedNext instead of leaving a dead menu", () => {
    const { ctx } = flagCtx();
    const tree = defineTree(
      "t2",
      {},
      {
        start: "hub",
        nodes: {
          hub: {
            lines: [{ speaker: "PANI", text: "Tak?" }],
            choices: [{ id: "only", label: "One question", once: true, next: "answer" }],
            exhaustedNext: "wrapup",
          },
          answer: { lines: [{ text: "An answer." }], next: "hub" },
          wrapup: { lines: [{ speaker: "PANI", text: "No dobra. Klienci czekają." }] },
        },
      },
    ) as DialogueTree<never>;
    const s1 = openDialogue(tree, ctx);
    if (s1.kind !== "continue") throw new Error();
    chooseDialogue(s1.state, 0, ctx); // spends the only topic
    // fresh conversation: hub line plays, then advances into the wind-down
    const s2 = openDialogue(tree, ctx);
    if (s2.kind !== "continue") throw new Error();
    let step = advanceDialogue(s2.state, ctx); // finish typing
    if (step.kind !== "continue") throw new Error();
    step = advanceDialogue(step.state, ctx); // no offered choices -> exhaustedNext
    if (step.kind !== "continue") throw new Error();
    expect(step.state.nodeId).toBe("wrapup");
    expect(step.state.lines[0].text).toBe("No dobra. Klienci czekają.");
  });

  it("validateTree catches duplicate choice ids and edge targets of again/exhausted", () => {
    const tree = {
      start: "a",
      nodes: {
        a: {
          lines: [{ text: "hi" }],
          exhaustedNext: "ghost1",
          choices: [
            { id: "dup", label: "x", next: "a" },
            { id: "dup", label: "y", next: "a" },
            { id: "z", label: "z", againNext: "ghost2", next: "a" },
          ],
        },
      },
    } as DialogueTree<never>;
    const kinds = validateTree(tree)
      .map((p) => p.kind)
      .sort();
    expect(kinds).toEqual(["duplicate-choice-id", "missing", "missing"]);
  });
});
