import {
  awakeHours,
  type BodySlices,
  bodyFlags,
  gameDay,
  gameHour,
  gameTime,
  habitsState,
  voiceState,
} from "./body";

/**
 * thoughts.ts — the inner voice, given something to know.
 *
 * Every line the hero says to himself used to be a reaction to an object: he
 * touched the kettle and thought about the kettle. This is the other half —
 * what he thinks because of how he is: hungry past a Żabka, cold on the
 * platform, the third cigarette before nine, the morning after.
 *
 * A rule is a key (an i18n id under `body.`), a condition on the world, a
 * cooldown in game minutes, and a weight. `nextThought` picks the heaviest
 * rule that fires and is off cooldown, records that it was said, and hands
 * back the key. The runtime polls it every couple of seconds while nothing
 * else is on screen; a global gap keeps him from narrating himself.
 */

export interface ThoughtRule {
  key: string;
  when: (w: BodySlices, scene: string) => boolean;
  /** game minutes before this line may come again */
  cooldown: number;
  weight: number;
  /** only in these scenes (default: anywhere) */
  scenes?: readonly string[];
}

/** game minutes between any two thoughts */
export const THOUGHT_GAP = 45;

/** scene ids under the sky — see game/apartment/scenes.tsx and outsideScenes.tsx */
export const OUTDOORS = new Set([
  "outside",
  "district",
  "elektrykow",
  "forum",
  "parking",
  "station",
  "balcony",
]);
/** the flat's rooms */
export const HOME = ["studio", "study", "bath", "balcony"];

export const THOUGHT_RULES: readonly ThoughtRule[] = [
  // --- hunger ---
  {
    key: "hungry",
    when: (w) => bodyFlags(w).hungry && !bodyFlags(w).starving,
    cooldown: 180,
    weight: 3,
  },
  { key: "starving", when: (w) => bodyFlags(w).starving, cooldown: 90, weight: 6 },
  {
    key: "hungryZabka",
    when: (w) => bodyFlags(w).hungry,
    cooldown: 240,
    weight: 7,
    scenes: ["zabka"],
  },
  {
    key: "hungryStreet",
    when: (w) => bodyFlags(w).hungry,
    cooldown: 300,
    weight: 4,
    scenes: ["outside", "district"],
  },
  // --- energy ---
  {
    key: "tired",
    when: (w) => bodyFlags(w).tired && !bodyFlags(w).exhausted,
    cooldown: 200,
    weight: 3,
  },
  { key: "exhausted", when: (w) => bodyFlags(w).exhausted, cooldown: 90, weight: 6 },
  {
    key: "tiredHome",
    when: (w) => bodyFlags(w).tired && gameHour(w) >= 21,
    cooldown: 240,
    weight: 5,
    scenes: HOME,
  },
  {
    key: "longDay",
    when: (w) => awakeHours(w) > 16,
    cooldown: 360,
    weight: 5,
  },
  // --- warmth ---
  {
    key: "cold",
    when: (w, s) => OUTDOORS.has(s) && bodyFlags(w).cold && !bodyFlags(w).freezing,
    cooldown: 120,
    weight: 4,
  },
  {
    key: "freezing",
    when: (w, s) => OUTDOORS.has(s) && bodyFlags(w).freezing,
    cooldown: 60,
    weight: 7,
  },
  {
    key: "warmAgain",
    when: (w, s) => !OUTDOORS.has(s) && bodyFlags(w).cold,
    cooldown: 240,
    weight: 3,
  },
  // --- drink ---
  {
    key: "tipsy",
    when: (w) => bodyFlags(w).tipsy && !bodyFlags(w).drunk,
    cooldown: 120,
    weight: 4,
  },
  { key: "drunk", when: (w) => bodyFlags(w).drunk, cooldown: 60, weight: 6 },
  {
    key: "hungover",
    when: (w) => bodyFlags(w).hungover && gameHour(w) < 12,
    cooldown: 180,
    weight: 6,
  },
  {
    key: "hungoverLater",
    when: (w) => bodyFlags(w).hungover && gameHour(w) >= 12,
    cooldown: 240,
    weight: 3,
  },
  // --- habits ---
  {
    key: "thirdCigarette",
    when: (w) => habitsState(w).smokedToday === 3,
    cooldown: 600,
    weight: 5,
  },
  {
    key: "packDay",
    when: (w) => habitsState(w).smokedToday >= 6,
    cooldown: 600,
    weight: 5,
  },
  {
    key: "secondCoffee",
    when: (w) => habitsState(w).coffeesToday >= 2,
    cooldown: 600,
    weight: 3,
  },
  {
    key: "trainedToday",
    when: (w) => habitsState(w).trainedToday >= 1 && bodyFlags(w).tired,
    cooldown: 400,
    weight: 4,
  },
  {
    key: "trainedStreak",
    when: (w) => habitsState(w).trained > 0 && habitsState(w).trained % 5 === 0,
    cooldown: 1440,
    weight: 4,
  },
  {
    key: "noMealToday",
    when: (w) => habitsState(w).mealsToday === 0 && awakeHours(w) > 6,
    cooldown: 300,
    weight: 4,
  },
  {
    key: "dishesWaiting",
    when: (w) => gameDay(w) - habitsState(w).dishesDay >= 2,
    cooldown: 400,
    weight: 3,
    scenes: ["studio"],
  },
  {
    key: "dogUnfed",
    when: (w) => habitsState(w).bowlsDay < gameDay(w) && gameHour(w) >= 17,
    cooldown: 300,
    weight: 4,
    scenes: ["studio"],
  },
  // --- the hour ---
  {
    key: "earlyMorning",
    when: (w) => gameHour(w) >= 5 && gameHour(w) < 7,
    cooldown: 600,
    weight: 3,
  },
  {
    key: "lateNightOut",
    when: (w, s) => OUTDOORS.has(s) && gameHour(w) >= 1 && gameHour(w) < 5,
    cooldown: 300,
    weight: 4,
  },
  {
    key: "homeLate",
    when: (w) => gameHour(w) >= 23 || gameHour(w) < 4,
    cooldown: 600,
    weight: 3,
    scenes: ["studio"],
  },
];

export interface Thought {
  key: string;
  world: BodySlices;
}

/**
 * The thought for this moment, if any: the heaviest rule that applies and is
 * off cooldown, with the world updated to remember it was said.
 */
export function nextThought<W extends BodySlices>(
  world: W,
  scene: string,
  rules: readonly ThoughtRule[] = THOUGHT_RULES,
): { key: string; world: W } | null {
  const now = gameTime(world).minutes;
  const voice = voiceState(world);
  if (now - voice.lastAt < THOUGHT_GAP) return null;
  let best: ThoughtRule | null = null;
  for (const r of rules) {
    if (r.scenes && !r.scenes.includes(scene)) continue;
    const last = voice.said[r.key];
    if (last !== undefined && now - last < r.cooldown) continue;
    if (!r.when(world, scene)) continue;
    if (!best || r.weight > best.weight) best = r;
  }
  if (!best) return null;
  return {
    key: best.key,
    world: {
      ...world,
      voice: { said: { ...voice.said, [best.key]: now }, lastAt: now },
    },
  };
}
