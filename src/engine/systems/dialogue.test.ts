import { describe, expect, it } from "vitest";
import {
  advanceDialogue,
  chooseDialogue,
  type DialogueState,
  type DialogueTree,
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
