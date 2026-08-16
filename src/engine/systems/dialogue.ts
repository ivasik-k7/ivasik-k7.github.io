/**
 * Dialogue system — branching trees with choices.
 *
 * A tree is a map of nodes. Each node plays its lines one keypress at a
 * time (typewriter-rendered by the DialogueBox), then either presents
 * choices, auto-advances to `next`, or ends. Effects run against the same
 * InteractionCtx games use for object handlers, so a dialogue choice can
 * hand out items, set flags, start actions or travel.
 */

export interface DialogueLine {
  /** Speaker tag shown above the text; omit for narration. */
  speaker?: string;
  text: string;
}

export interface DialogueChoice<Ctx = unknown> {
  label: string;
  /**
   * Node to jump to; omit to end the dialogue after the effect.
   * A function branches on live state (evaluated BEFORE the effect runs,
   * so "can they afford it?" checks see the pre-purchase world).
   */
  next?: string | ((ctx: Ctx) => string);
  effect?: (ctx: Ctx) => void;
}

export interface DialogueNode<Ctx = unknown> {
  lines: DialogueLine[];
  choices?: DialogueChoice<Ctx>[];
  /** Auto-advance target when there are no choices. */
  next?: string;
  onEnter?: (ctx: Ctx) => void;
  onEnd?: (ctx: Ctx) => void;
}

export interface DialogueTree<Ctx = unknown> {
  start: string;
  nodes: Record<string, DialogueNode<Ctx>>;
}

/** Live dialogue position held by the runtime. */
export interface DialogueState {
  tree: DialogueTree<never>;
  nodeId: string;
  lineIndex: number;
  choiceIndex: number;
  /** The line finished typing; next press advances instead of revealing. */
  lineDone: boolean;
}

export function openDialogue(tree: DialogueTree<never>): DialogueState {
  return { tree, nodeId: tree.start, lineIndex: 0, choiceIndex: 0, lineDone: false };
}

export type DialogueStep =
  | { kind: "continue"; state: DialogueState }
  | { kind: "end"; onEnd?: (ctx: unknown) => void };

/**
 * Advance one step: finish typing → next line → choices/auto-next → end.
 * Choice selection is applied separately via `chooseDialogue`.
 */
export function advanceDialogue(state: DialogueState): DialogueStep {
  const node = state.tree.nodes[state.nodeId];
  if (!state.lineDone) {
    return { kind: "continue", state: { ...state, lineDone: true } };
  }
  if (state.lineIndex < node.lines.length - 1) {
    return {
      kind: "continue",
      state: { ...state, lineIndex: state.lineIndex + 1, lineDone: false },
    };
  }
  // last line shown
  if (node.choices && node.choices.length > 0) {
    // stay — the box is showing choices; selection happens via chooseDialogue
    return { kind: "continue", state };
  }
  if (node.next) {
    return {
      kind: "continue",
      state: { ...state, nodeId: node.next, lineIndex: 0, choiceIndex: 0, lineDone: false },
    };
  }
  return { kind: "end", onEnd: node.onEnd as ((ctx: unknown) => void) | undefined };
}

export function chooseDialogue(
  state: DialogueState,
  index: number,
  makeCtx: () => unknown,
): DialogueStep {
  const node = state.tree.nodes[state.nodeId];
  const choice = node.choices?.[index];
  if (!choice) return { kind: "continue", state };
  // resolve the branch against the pre-effect world, then run the effect
  const target =
    typeof choice.next === "function"
      ? (choice.next as (ctx: unknown) => string)(makeCtx())
      : choice.next;
  if (choice.effect) (choice.effect as (ctx: unknown) => void)(makeCtx());
  if (target) {
    return {
      kind: "continue",
      state: { ...state, nodeId: target, lineIndex: 0, choiceIndex: 0, lineDone: false },
    };
  }
  return { kind: "end", onEnd: node.onEnd as ((ctx: unknown) => void) | undefined };
}

/** True when the current node's last line is shown and it has choices. */
export function dialogueAtChoices(state: DialogueState): boolean {
  const node = state.tree.nodes[state.nodeId];
  return Boolean(
    node.choices &&
      node.choices.length > 0 &&
      state.lineIndex === node.lines.length - 1 &&
      state.lineDone,
  );
}
