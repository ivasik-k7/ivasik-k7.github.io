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
   * Spoken only while true — evaluated when the node is entered, so a line
   * can comment on the rain, the hour, or what the player is carrying and
   * simply not exist otherwise. The remaining lines close ranks.
   */
  when?: (ctx: unknown) => boolean;
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

/**
 * One alternative reading of a node. Variants are what stop a character
 * repeating themselves verbatim: each visit picks a line-set according to
 * the node's `variantMode`, remembering the rotation in the ctx counter
 * store (persisted with the save) or, without one, for the session.
 */
export interface DialogueVariant<Ctx = unknown> {
  lines: DialogueLine[];
  /** In the rotation only while true — a rainy-day reading, a first-meeting one. */
  when?: (ctx: Ctx) => boolean;
}

export interface DialogueNode<Ctx = unknown> {
  /** The node's lines — or the fallback when every variant's `when` fails. */
  lines: DialogueLine[];
  /**
   * Alternative readings, one picked per visit (see DialogueVariant).
   *  - "exhaust" (default): play each once in order, then hold the last —
   *    the classic NPC who has news the first few times and a standing line after;
   *  - "cycle": loop through them forever;
   *  - "random": any of them, never the same one twice running.
   */
  variants?: DialogueVariant<Ctx>[];
  variantMode?: "exhaust" | "cycle" | "random";
  choices?: DialogueChoice<Ctx>[];
  /** Auto-advance target when there are no choices. */
  next?: string | ((ctx: Ctx) => string);
  onEnter?: (ctx: Ctx) => void;
  onEnd?: (ctx: Ctx) => void;
}

export interface DialogueTree<Ctx = unknown> {
  /** Stable name for persistence (variant rotation, seen-marks). */
  id?: string;
  start: string | ((ctx: Ctx) => string);
  nodes: Record<string, DialogueNode<Ctx>>;
}

/** Live dialogue position held by the runtime. */
export interface DialogueState {
  tree: DialogueTree<never>;
  nodeId: string;
  /**
   * The lines actually spoken THIS visit — the chosen variant, filtered by
   * each line's `when`. Everything that renders or advances reads these,
   * never `node.lines` directly.
   */
  lines: readonly DialogueLine[];
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

/* ------------------------------------------------------- line resolution -- */

type CounterCtx = {
  counter?: (key: string) => number;
  bump?: (key: string, by?: number) => number;
};

/** Rotation memory for ctxs without a counter store: per tree, per session. */
const sessionRotation = new WeakMap<DialogueTree<never>, Map<string, number>>();

function rotationRead(tree: DialogueTree<never>, ctx: unknown, key: string): number {
  const c = (ctx as CounterCtx)?.counter;
  if (c) return c(key);
  return sessionRotation.get(tree)?.get(key) ?? 0;
}

function rotationWrite(tree: DialogueTree<never>, ctx: unknown, key: string, value: number): void {
  const b = (ctx as CounterCtx)?.bump;
  if (b) {
    const cur = (ctx as CounterCtx).counter?.(key) ?? 0;
    if (value !== cur) b(key, value - cur);
    return;
  }
  let map = sessionRotation.get(tree);
  if (!map) {
    map = new Map();
    sessionRotation.set(tree, map);
  }
  map.set(key, value);
}

/**
 * The lines spoken on THIS visit to a node: pick a variant by the node's
 * rotation mode, then drop any line whose `when` says not today. Falls back
 * to the node's own lines when no variant qualifies. Visiting the node
 * advances the rotation — that is what makes the second conversation sound
 * different from the first.
 */
function resolveLines(
  tree: DialogueTree<never>,
  nodeId: string,
  node: DialogueNode<never> | undefined,
  ctx: unknown,
): readonly DialogueLine[] {
  if (!node) return [];
  let lines: DialogueLine[] = node.lines;
  const pool = node.variants?.filter((v) => {
    const when = v.when as ((c: unknown) => boolean) | undefined;
    return !when || when(ctx);
  });
  if (pool && pool.length > 0) {
    const key = `dlg.var:${tree.id ?? "t"}.${nodeId}`;
    const count = rotationRead(tree, ctx, key);
    const mode = node.variantMode ?? "exhaust";
    let idx: number;
    if (mode === "cycle") {
      idx = count % pool.length;
      rotationWrite(tree, ctx, key, count + 1);
    } else if (mode === "random") {
      // `count` remembers 1 + the previous pick, so a redraw can avoid it
      const prev = count - 1;
      if (pool.length === 1) {
        idx = 0;
      } else {
        idx = Math.floor(Math.random() * (pool.length - 1));
        if (idx >= prev && prev >= 0) idx += 1;
      }
      rotationWrite(tree, ctx, key, idx + 1);
    } else {
      // exhaust: each once, then hold the last reading
      idx = Math.min(count, pool.length - 1);
      if (count < pool.length) rotationWrite(tree, ctx, key, count + 1);
    }
    lines = pool[idx].lines;
  }
  const spoken = lines.filter((l) => {
    const when = l.when as ((c: unknown) => boolean) | undefined;
    return !when || when(ctx);
  });
  // every line begged off: keep the unfiltered set rather than a mute node
  return spoken.length > 0 ? spoken : lines;
}

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
    state: {
      tree,
      nodeId,
      lines: resolveLines(tree, nodeId, node, makeCtx()),
      lineIndex: 0,
      choiceIndex: 0,
      lineDone: false,
      visited: [nodeId],
    },
    onEnter: node?.onEnter as ((ctx: unknown) => void) | undefined,
  };
}

/** Move to a node, carrying the history and handing back its enter effect. */
function enter(state: DialogueState, nodeId: string, ctx: unknown): DialogueStep {
  const node = state.tree.nodes[nodeId];
  return {
    kind: "continue",
    state: {
      ...state,
      nodeId,
      lines: resolveLines(state.tree, nodeId, node, ctx),
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
  if (state.lineIndex < state.lines.length - 1) {
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
    return enter(state, asFn(node.next as string | ((c: unknown) => string), makeCtx), makeCtx());
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
const seenKey = (id: string) => `dlg.seen:${id}`;
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
  const ctx = makeCtx();
  // a taken `once` choice is spent from here on (persisted via the ctx flags);
  // any identified choice is remembered as asked-before, so the panel can
  // dim topics the player has already been through
  if (choice.once && choice.id) {
    (ctx as FlagCtx)?.setFlag?.(onceKey(choice.id));
  }
  if (choice.id) {
    (ctx as FlagCtx)?.setFlag?.(seenKey(choice.id));
  }
  // resolve the branch against the pre-effect world, then run the effect
  const target =
    typeof choice.next === "function"
      ? (choice.next as (ctx: unknown) => string)(ctx)
      : choice.next;
  if (choice.effect) (choice.effect as (ctx: unknown) => void)(ctx);
  if (target) return enter(state, target, ctx);
  return { kind: "end", onEnd: node.onEnd as ((ctx: unknown) => void) | undefined };
}

/** A choice as the panel sees it: label, why it cannot be taken, and memory. */
export type OfferedChoice = DialogueChoice<never> & {
  lockedBy: string | null;
  /** The player has picked this before — panels dim it to "already asked". */
  seenBefore: boolean;
};

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
  // one ctx per evaluation: the world cannot move inside a single call, and
  // authors with impure predicates should see them run once per choice, not
  // three times (the ctx itself is a point-in-time snapshot either way)
  const ctx = makeCtx();
  const out: OfferedChoice[] = [];
  for (const c of node.choices) {
    const when = c.when as ((ctx: unknown) => boolean) | undefined;
    if (when && !when(ctx)) continue;
    if (onceSeen(ctx, c)) continue;
    const locked = c.locked as ((ctx: unknown) => string | null) | undefined;
    out.push({
      ...c,
      lockedBy: locked ? locked(ctx) : null,
      seenBefore: Boolean(c.id && (ctx as FlagCtx)?.flag?.(seenKey(c.id))),
    });
  }
  return out;
}

/** True when the current node's last line is shown and it has choices. */
export function dialogueAtChoices(state: DialogueState, makeCtx: () => unknown): boolean {
  const node = state.tree.nodes[state.nodeId];
  return (
    offeredChoices(node, makeCtx).length > 0 &&
    state.lineIndex === state.lines.length - 1 &&
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
    const hasVariantLines = (node.variants ?? []).some((v) => v.lines.length > 0);
    if (node.lines.length === 0 && !hasVariantLines) problems.push({ kind: "empty", node: id });
    for (const v of node.variants ?? []) {
      if (v.lines.length === 0) problems.push({ kind: "empty", node: id });
    }
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
