/**
 * monologue.ts — the rules of short-form speech, with no DOM in them.
 *
 * Everything a character says outside a dialogue tree — ambient muttering,
 * scripted one-liners, the player's inner voice, a PA announcement — is a
 * "monologue", and they all share three rules that used to live in three
 * different files in three different flavours:
 *
 *   1. THE FLOOR. One voice per channel. Five NPCs in one shop take turns
 *      rather than stacking five bubbles; the player's thought does not fight
 *      the shopkeeper's mutter because they hold different channels. The old
 *      implementation was a module-level mutex private to NpcMonologue, which
 *      meant it could arbitrate only between identical siblings.
 *
 *   2. PRIORITY. The mutex knew none: whoever grabbed the floor kept it, so a
 *      scripted line had to wait for a random mutter to finish. Here a higher
 *      priority takes the floor immediately and the sitting holder is told it
 *      has been evicted, so its bubble clears on the same frame.
 *
 *   3. DWELL. How long a line stays up, derived from its length. There were
 *      three formulas in the codebase for the same judgement — a fixed 3000,
 *      `1800 + len*48`, and `min(3200, 1200 + len*28)` — which is how the same
 *      sentence got three different lifetimes depending on who spoke it. This
 *      is the one formula now; the toast's fixed 3000 and the sequencer's
 *      capped beat remain theirs on purpose (a cutscene owns its own tempo),
 *      but anything new reads the clock from here.
 *
 * Pure module: no React, no timers, no DOM. The component in ui/Monologue.tsx
 * owns scheduling; this owns the decisions. Tested in monologue.test.ts.
 */

/** What kind of utterance this is — it decides tone, anchor and voice. */
export type MonologueKind = "speech" | "thought" | "ambient" | "announce" | "narrate";

/**
 * Who competes with whom. World speech shares one floor; the player's head is
 * its own; screen-level text (PA, narration) is its own. A thought does not
 * silence a shopkeeper, and a station announcement talks over both — which is
 * exactly what a station announcement does.
 */
export type MonologueChannel = "world" | "player" | "screen";

export const CHANNEL_OF: Record<MonologueKind, MonologueChannel> = {
  speech: "world",
  ambient: "world",
  thought: "player",
  announce: "screen",
  narrate: "screen",
};

/**
 * How long a line stays on screen, from its length. The floor keeps a short
 * "no" from blinking away; the ceiling keeps a rambler from squatting on the
 * channel while four other people wait for the floor.
 */
export function dwellMs(text: string): number {
  return Math.min(7200, Math.max(2000, 1800 + text.length * 48));
}

type Holder = {
  token: object;
  priority: number;
  onEvicted?: () => void;
};

const floors = new Map<MonologueChannel, Holder>();

/**
 * Ask for the floor on a channel.
 *
 * Returns true if it is yours — either it was free, you already held it, or
 * your priority beats the sitting holder's, in which case they are told they
 * lost it before you get the true. Equal priority does NOT evict: two idle
 * mutterers take turns instead of thrashing.
 */
export function acquireVoice(
  channel: MonologueChannel,
  token: object,
  priority = 0,
  onEvicted?: () => void,
): boolean {
  const sitting = floors.get(channel);
  if (!sitting || sitting.token === token) {
    floors.set(channel, { token, priority, onEvicted });
    return true;
  }
  if (priority > sitting.priority) {
    sitting.onEvicted?.();
    floors.set(channel, { token, priority, onEvicted });
    return true;
  }
  return false;
}

/** Give the floor back. A no-op unless you actually hold it. */
export function releaseVoice(channel: MonologueChannel, token: object): void {
  if (floors.get(channel)?.token === token) floors.delete(channel);
}

/** Who holds a channel right now — for tests and debugging only. */
export function voiceHolder(channel: MonologueChannel): object | null {
  return floors.get(channel)?.token ?? null;
}

/** Drop every floor. Tests only; the game never needs a global hush. */
export function resetVoices(): void {
  floors.clear();
}
