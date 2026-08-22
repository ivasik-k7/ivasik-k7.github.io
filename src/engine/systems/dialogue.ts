/**
 * Dialogue system — branching trees with conditions, gates and consequences.
 *
 * A tree is a map of nodes. Each node plays its lines one keypress at a time
 * (typewriter-rendered by the DialogueBox), then either presents choices,
 * auto-advances to `next`, or ends. Effects run against the same
 * InteractionCtx games use for object handlers, so a dialogue choice can hand
 * out items, set flags, start actions or travel.
 *
 * Three things make it more than a text player:
 *
 *  – a choice can be *conditional* (`when`), so it is not offered at all, or
 *    *gated* (`locked`), so it is offered greyed out with the reason showing.
 *    Those are different: one hides that a path exists, the other tells you
 *    what you would need. Both are needed and authors reach for the wrong one
 *    if only one exists.
 *  – nodes and choices can be `once`, which is what makes a character stop
 *    telling you the same story. The seen-set lives in the world, not in the
 *    tree, so it survives a save.
 *  – every node reports what it did, so the runtime can drive a reaction on
 *    the character who is speaking rather than leaving the sprite standing
 *    there while their text changes.
 */

export interface DialogueLine {
  /** Speaker tag shown above the text; omit for narration. */
  speaker?: string;
  text: string;
  /**
   * What the speaker is doing while this line is on screen — an action id on
   * the character rig. The runtime plays it, so a question can be asked with a
   * shrug and an apology delivered looking at the floor.
   */
  act?: string;
  /** Mood tag for the panel: colours the speaker plate and the voice. */
  mood?: DialogueMood;
}

export type DialogueMood = "neutral" | "warm" | "tense" | "sad" | "amused";

export interface DialogueChoice<Ctx = unknown> {
  label: string;
  /**
   * Node to jump to; omit to end the dialogue after the effect.
   * A function branches on live state (evaluated BEFORE the effect runs,
   * so "can they afford it?" checks see the pre-purchase world).
   */
  next?: string | ((ctx: Ctx) => string);
  effect?: (ctx: Ctx) => void;
  /** Offered only when this returns true. Absent means always offered. */
  when?: (ctx: Ctx) => boolean;
  /**
   * Shown but not selectable, with this string as the reason — "40 zł",
   * "you don't know her yet". Return null to leave it selectable.
   */
  locked?: (ctx: Ctx) => string | null;
  /** Offered once per save. Requires an `id` to remember it by. */
  once?: boolean;
  /** Stable identity for `once` and for dialogue history. */
  id?: string;
}

export interface DialogueNode<Ctx = unknown> {
  lines: DialogueLine[];
  choices?: DialogueChoice<Ctx>[];
  /** Auto-advance target when there are no choices. */
  next?: string | ((ctx: Ctx) => string);
  onEnter?: (ctx: Ctx) => void;
  onEnd?: (ctx: Ctx) => void;
}

export interface DialogueTree<Ctx = unknown> {
  start: string | ((ctx: Ctx) => string);
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
  /** Every node visited this conversation, in order — for the history view. */
  visited: readonly string[];
}

/**
 * A step can ask the runtime to do something on the way through. Returning it
 * rather than calling it keeps this module pure and testable, and keeps the
 * ordering — enter effects before the first line renders — in one place.
 */
export type DialogueStep =
  | { kind: "continue"; state: DialogueState; onEnter?: (ctx: unknown) => void }
  | { kind: "end"; onEnd?: (ctx: unknown) => void };

const asFn = <T>(v: T | ((ctx: unknown) => T), ctx: () => unknown): T =>
  typeof v === "function" ? (v as (c: unknown) => T)(ctx()) : v;

/** Trees already complained about, so authoring noise prints once, not per open. */
const validated = new WeakSet<DialogueTree<never>>();

export function openDialogue(tree: DialogueTree<never>, makeCtx: () => unknown): DialogueStep {
  // the authoring safety net, wired where every conversation passes: a broken
  // edge prints the moment the tree first opens in dev, not when a player
  // walks into the dead branch
  if (import.meta.env.DEV && !validated.has(tree)) {
    validated.add(tree);
    for (const p of validateTree(tree)) {
      console.warn(`dialogue: ${p.kind} node "${p.node}"${p.from ? ` (from ${p.from})` : ""}`);
    }
  }
  const nodeId = asFn(tree.start as string | ((c: unknown) => string), makeCtx);
  const node = tree.nodes[nodeId];
  return {
    kind: "continue",
    state: { tree, nodeId, lineIndex: 0, choiceIndex: 0, lineDone: false, visited: [nodeId] },
    onEnter: node?.onEnter as ((ctx: unknown) => void) | undefined,
  };
}

/** Move to a node, carrying the history and handing back its enter effect. */
function enter(state: DialogueState, nodeId: string): DialogueStep {
  const node = state.tree.nodes[nodeId];
  return {
    kind: "continue",
    state: {
      ...state,
      nodeId,
      lineIndex: 0,
      choiceIndex: 0,
      lineDone: false,
      visited: [...state.visited, nodeId],
    },
    onEnter: node?.onEnter as ((ctx: unknown) => void) | undefined,
  };
}

/**
 * Advance one step: finish typing → next line → choices/auto-next → end.
 * Choice selection is applied separately via `chooseDialogue`.
 */
export function advanceDialogue(state: DialogueState, makeCtx: () => unknown): DialogueStep {
  const node = state.tree.nodes[state.nodeId];
  if (!node) return { kind: "end" };
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
  if (offeredChoices(node, makeCtx).length > 0) {
    // stay — the box is showing choices; selection happens via chooseDialogue
    return { kind: "continue", state };
  }
  if (node.next) {
    return enter(state, asFn(node.next as string | ((c: unknown) => string), makeCtx));
  }
  return { kind: "end", onEnd: node.onEnd as ((ctx: unknown) => void) | undefined };
}

/**
 * The seen-set behind `once` choices. It lives in whatever the ctx offers as
 * a flag store — the runtime's is persisted with the save, which is exactly
 * the lifetime "once per save" promises. A ctx without one (a bare test ctx)
 * degrades to offering the choice every time rather than crashing.
 */
const onceKey = (id: string) => `dlg.once:${id}`;
type FlagCtx = { flag?: (key: string) => boolean; setFlag?: (key: string, on?: boolean) => void };

function onceSeen(ctx: unknown, choice: DialogueChoice<never>): boolean {
  if (!choice.once || !choice.id) return false;
  return Boolean((ctx as FlagCtx)?.flag?.(onceKey(choice.id)));
}

export function chooseDialogue(
  state: DialogueState,
  index: number,
  makeCtx: () => unknown,
): DialogueStep {
  const node = state.tree.nodes[state.nodeId];
  const choice = offeredChoices(node, makeCtx)[index];
  // a locked choice is visible but inert: selecting it is not an error, it
  // just does not go anywhere
  if (!choice || choice.lockedBy !== null) return { kind: "continue", state };
  // a taken `once` choice is spent from here on (persisted via the ctx flags)
  if (choice.once && choice.id) {
    (makeCtx() as FlagCtx)?.setFlag?.(onceKey(choice.id));
  }
  // resolve the branch against the pre-effect world, then run the effect
  const target =
    typeof choice.next === "function"
      ? (choice.next as (ctx: unknown) => string)(makeCtx())
      : choice.next;
  if (choice.effect) (choice.effect as (ctx: unknown) => void)(makeCtx());
  if (target) return enter(state, target);
  return { kind: "end", onEnd: node.onEnd as ((ctx: unknown) => void) | undefined };
}

/** A choice as the panel sees it: label, plus why it cannot be taken. */
export type OfferedChoice = DialogueChoice<never> & { lockedBy: string | null };

/**
 * The choices actually on offer at this node, in order, each carrying its lock
 * reason. `when` removes a choice entirely; `locked` keeps it and explains
 * itself. Evaluated fresh every render because the world moves underneath a
 * conversation — buy something in one branch and the next one may not afford.
 */
export function offeredChoices(
  node: DialogueNode<never> | undefined,
  makeCtx: () => unknown,
): OfferedChoice[] {
  if (!node?.choices) return [];
  const out: OfferedChoice[] = [];
  for (const c of node.choices) {
    const when = c.when as ((ctx: unknown) => boolean) | undefined;
    if (when && !when(makeCtx())) continue;
    if (onceSeen(makeCtx(), c)) continue;
    const locked = c.locked as ((ctx: unknown) => string | null) | undefined;
    out.push({ ...c, lockedBy: locked ? locked(makeCtx()) : null });
  }
  return out;
}

/** True when the current node's last line is shown and it has choices. */
export function dialogueAtChoices(state: DialogueState, makeCtx: () => unknown): boolean {
  const node = state.tree.nodes[state.nodeId];
  return (
    offeredChoices(node, makeCtx).length > 0 &&
    state.lineIndex === (node?.lines.length ?? 1) - 1 &&
    state.lineDone
  );
}

// ---------------------------------------------------------------------------
// authoring safety net
// ---------------------------------------------------------------------------

export type TreeProblem = {
  kind: "missing" | "unreachable" | "empty" | "once-without-id";
  node: string;
  from?: string;
};

/**
 * Static checks a tree can fail without anybody noticing until a player walks
 * into it: a `next` pointing at a node that does not exist, a node nothing can
 * reach, a node with no lines.
 *
 * Only the static edges are followed — a `next` computed from context could go
 * anywhere, so those are reported as reachable-from-here rather than resolved.
 * That is the honest limit of checking a tree without running it.
 */
export function validateTree(tree: DialogueTree<never>): TreeProblem[] {
  const problems: TreeProblem[] = [];
  const ids = new Set(Object.keys(tree.nodes));
  const reached = new Set<string>();
  const edge = (from: string, to: string | ((c: never) => string) | undefined) => {
    if (typeof to !== "string") return;
    if (!ids.has(to)) problems.push({ kind: "missing", node: to, from });
    else reached.add(to);
  };
  if (typeof tree.start === "string") {
    if (!ids.has(tree.start)) problems.push({ kind: "missing", node: tree.start, from: "start" });
    else reached.add(tree.start);
  } else {
    // a computed start could pick any node, so nothing is provably unreachable
    for (const id of ids) reached.add(id);
  }
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.lines.length === 0) problems.push({ kind: "empty", node: id });
    edge(id, node.next);
    for (const c of node.choices ?? []) {
      edge(id, c.next);
      // a `once` with nothing to remember it by silently repeats forever
      if (c.once && !c.id) problems.push({ kind: "once-without-id", node: id });
    }
  }
  for (const id of ids) {
    if (!reached.has(id)) problems.push({ kind: "unreachable", node: id });
  }
  return problems;
}
