/**
 * memory.ts — what the world remembers about you, and you about it.
 *
 * A facade over the runtime's persisted flag/counter stores (the same
 * duck-typed ctx dialogue.ts writes through), owning the key grammar so
 * authors never type a raw key and two NPCs never collide. Everything here
 * is what makes a conversation feel like it is happening between people who
 * have met before:
 *
 *   const pani = npcMemory(ctx, "cashier");
 *   pani.visits()        // how many conversations
 *   pani.minutesSince()  // "back already?" vs "long time"
 *   pani.warmth()        // drifts up when you're decent, down when tiresome
 *   pani.knows("name")   // did she ever tell you?
 *
 * On a ctx without stores (bare tests, previews) reads return their cold
 * defaults and writes do nothing — the same degradation contract dialogue's
 * `once` follows.
 */

type Stores = {
  flag?: (key: string) => boolean;
  setFlag?: (key: string, on?: boolean) => void;
  counter?: (key: string) => number;
  bump?: (key: string, by?: number) => number;
};

const asStores = (ctx: unknown): Stores => (ctx ?? {}) as Stores;

/** Write an absolute value into a counter store that only knows how to add. */
function put(s: Stores, key: string, value: number): void {
  if (!s.bump) return;
  const cur = s.counter?.(key) ?? 0;
  if (value !== cur) s.bump(key, value - cur);
}

/** Injectable clock for tests; minutes granularity is plenty for people. */
let nowMinutes = () => Math.floor(Date.now() / 60_000);
export function _setMemoryClock(fn: (() => number) | null): void {
  nowMinutes = fn ?? (() => Math.floor(Date.now() / 60_000));
}

export interface NpcMemory {
  /** Ever spoken at all. `meet()` is idempotent. */
  met(): boolean;
  meet(): void;
  /** Conversations held. `visit()` bumps and touches the recency clock. */
  visits(): number;
  visit(): void;
  /** Real-world minutes since the last `visit()`/`touch()`; Infinity when never. */
  minutesSince(): number;
  daysSince(): number;
  touch(): void;
  /**
   * Social temperature, an integer around 0. Drifts up when the player is
   * decent, down when tiresome — read it in variant/choice `when`s to pick a
   * register, never show it as a number.
   */
  warmth(): number;
  warm(by?: number): void;
  /** Facts this person has told you — "name", "grandsonInGdynia". */
  knows(fact: string): boolean;
  learn(fact: string): void;
  /** Was this identified choice ever picked — reads dialogue's own seen-mark. */
  asked(choiceId: string): boolean;
}

export function npcMemory(ctx: unknown, id: string): NpcMemory {
  const s = asStores(ctx);
  const K = {
    met: `npc:${id}.met`,
    visits: `npc:${id}.visits`,
    at: `npc:${id}.at`,
    warmth: `npc:${id}.warmth`,
    fact: (f: string) => `npc:${id}.k:${f}`,
  };
  const minutesSince = () => {
    const at = s.counter?.(K.at) ?? 0;
    return at > 0 ? Math.max(0, nowMinutes() - at) : Number.POSITIVE_INFINITY;
  };
  return {
    met: () => s.flag?.(K.met) === true,
    meet: () => s.setFlag?.(K.met),
    visits: () => s.counter?.(K.visits) ?? 0,
    visit: () => {
      s.setFlag?.(K.met);
      s.bump?.(K.visits, 1);
      put(s, K.at, nowMinutes());
    },
    minutesSince,
    daysSince: () => {
      const m = minutesSince();
      return Number.isFinite(m) ? Math.floor(m / 1440) : Number.POSITIVE_INFINITY;
    },
    touch: () => put(s, K.at, nowMinutes()),
    warmth: () => s.counter?.(K.warmth) ?? 0,
    warm: (by = 1) => {
      s.bump?.(K.warmth, by);
    },
    knows: (fact) => s.flag?.(K.fact(fact)) === true,
    learn: (fact) => s.setFlag?.(K.fact(fact)),
    asked: (choiceId) => s.flag?.(`dlg.seen:${choiceId}`) === true,
  };
}

/**
 * Player-side knowledge about the world itself — the cross-light store.
 * A look at the cranes `learn`s something; a conversation elsewhere `knows`
 * it and reads differently. Same grammar, `k:` namespace.
 */
export function knows(ctx: unknown, fact: string): boolean {
  return asStores(ctx).flag?.(`k:${fact}`) === true;
}

export function learn(ctx: unknown, fact: string): void {
  asStores(ctx).setFlag?.(`k:${fact}`);
}
