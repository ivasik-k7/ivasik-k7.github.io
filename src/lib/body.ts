import type { WorldState } from "./worldState";

/**
 * body.ts — the man himself, as numbers the world keeps.
 *
 * Until this file the hero had no inside. Beer made him walk drunk for two
 * minutes because a timer said so; every morning was the same morning because
 * the game read the hour off the player's PC and nothing he did left a mark.
 * Here is what he now carries between sessions:
 *
 *   body      energy, hunger, warmth, buzz, hangover — 0..100 each — and when
 *             he last slept. They drift with game time (`simulateBody`) and
 *             jump on events (`applyEvent`: eat, drink, sleep, train, smoke).
 *   habits    counts of what he does: all-time and today. Routine and its
 *             consequences grow out of these (the body, the flat, the voice).
 *   time      the game's own clock in minutes since day 0, 00:00. It starts
 *             at the real hour on a new game and advances at GAME_MIN_PER_SEC
 *             game minutes per real second while the game runs; sleep jumps it
 *             to the next morning. `dayPhase` reads it, not `new Date()`.
 *
 * Everything is a pure function of (world, dt/event) → world. The runtime
 * calls `simulateBody` on its game clock (so a paused game is a paused body);
 * handlers call `applyEvent`. What the numbers *look like* is decided by the
 * `body*` readers at the bottom — posture, gait, mood, layer — which the game
 * config plugs into the player's rig.
 */

// --- shape --------------------------------------------------------------------

export interface BodyState {
  /** rested → spent; sleep refills it */
  energy: number;
  /** fed → starving; food empties it */
  hunger: number;
  /** warm → frozen; the street at night takes it, a room gives it back */
  warmth: number;
  /** alcohol on board; decays */
  buzz: number;
  /** the morning after; built from buzz overnight, decays through the day */
  hangover: number;
  /** game minute he last woke */
  wokeAt: number;
  /** game minute until which the hair is wet from the shower (optional; old saves) */
  wetUntil?: number;
}

export interface Habits {
  smoked: number;
  smokedToday: number;
  trained: number;
  trainedToday: number;
  beers: number;
  beersToday: number;
  coffees: number;
  coffeesToday: number;
  meals: number;
  mealsToday: number;
  showers: number;
  prayers: number;
  nights: number;
  /** game day the dishes were last done (−1 = never) */
  dishesDay: number;
  /** game day the dog was last fed */
  bowlsDay: number;
  /** how far he has walked, in metres of game (px / 16) */
  walkedM: number;
}

export interface GameTime {
  /** minutes since day 0, 00:00 */
  minutes: number;
}

export interface Voice {
  /** game minute a thought key was last said */
  said: Record<string, number>;
  /** game minute anything was last said */
  lastAt: number;
}

export type BodySlices = {
  body?: BodyState;
  habits?: Habits;
  time?: GameTime;
  voice?: Voice;
};

// --- constants ------------------------------------------------------------------

/** game minutes per real second: a day is 24 real minutes */
export const GAME_MIN_PER_SEC = 1;
export const MINUTES_PER_DAY = 24 * 60;
/** the hour he wakes after a night's sleep */
export const WAKE_HOUR = 7;

/** per game hour, awake */
const ENERGY_PER_HOUR = -6.5; // ~15 h from 100 to 0
const HUNGER_PER_HOUR = 11; // ~9 h from 0 to 100
/** per game hour outdoors at night / indoors */
const WARMTH_OUT_NIGHT_PER_HOUR = -70;
const WARMTH_OUT_DAY_PER_HOUR = -12;
const WARMTH_IN_PER_HOUR = 90;
const BUZZ_PER_HOUR = -40; // a beer (35) is gone in under an hour
const HANGOVER_PER_HOUR = -9;
/** running spends the body faster */
const RUN_ENERGY_MULT = 2.2;
const RUN_HUNGER_MULT = 1.6;

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

// --- readers ----------------------------------------------------------------------

export const defaultBody = (wokeAt = 0): BodyState => ({
  energy: 85,
  hunger: 25,
  warmth: 100,
  buzz: 0,
  hangover: 0,
  wokeAt,
});

export const defaultHabits = (): Habits => ({
  smoked: 0,
  smokedToday: 0,
  trained: 0,
  trainedToday: 0,
  beers: 0,
  beersToday: 0,
  coffees: 0,
  coffeesToday: 0,
  meals: 0,
  mealsToday: 0,
  showers: 0,
  prayers: 0,
  nights: 0,
  dishesDay: -1,
  bowlsDay: -1,
  walkedM: 0,
});

/** A new game starts at the real hour, so the first day matches the window. */
export const startTime = (realHour = new Date().getHours(), realMinute = 0): GameTime => ({
  minutes: realHour * 60 + realMinute,
});

export const bodyState = (w: BodySlices): BodyState => w.body ?? defaultBody(gameTime(w).minutes);
export const habitsState = (w: BodySlices): Habits => w.habits ?? defaultHabits();
export const gameTime = (w: BodySlices): GameTime => w.time ?? startTime();
export const voiceState = (w: BodySlices): Voice => w.voice ?? { said: {}, lastAt: -1e9 };

export const gameDay = (w: BodySlices): number => Math.floor(gameTime(w).minutes / MINUTES_PER_DAY);
export const gameHour = (w: BodySlices): number =>
  Math.floor((gameTime(w).minutes % MINUTES_PER_DAY) / 60);
export const gameMinute = (w: BodySlices): number => gameTime(w).minutes % 60;
/** hours he has been awake */
export const awakeHours = (w: BodySlices): number =>
  Math.max(0, (gameTime(w).minutes - bodyState(w).wokeAt) / 60);

export type Phase = "morning" | "day" | "dusk" | "night";
export function phaseOfHour(hour: number): Phase {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "dusk";
  return "night";
}
export const gamePhase = (w: BodySlices): Phase => phaseOfHour(gameHour(w));

// --- what the numbers mean ------------------------------------------------------------

export interface BodyFlags {
  tired: boolean;
  exhausted: boolean;
  hungry: boolean;
  starving: boolean;
  cold: boolean;
  freezing: boolean;
  tipsy: boolean;
  drunk: boolean;
  hungover: boolean;
}

export function bodyFlags(w: BodySlices): BodyFlags {
  const b = bodyState(w);
  return {
    tired: b.energy < 35,
    exhausted: b.energy < 15,
    hungry: b.hunger > 65,
    starving: b.hunger > 88,
    cold: b.warmth < 45,
    freezing: b.warmth < 20,
    tipsy: b.buzz > 20,
    drunk: b.buzz > 45,
    hungover: b.hangover > 35,
  };
}

// --- time -------------------------------------------------------------------------

export interface Env {
  /** the scene is under the sky */
  outdoors: boolean;
  moving: boolean;
  running: boolean;
}

/**
 * Advance the body by `dtMin` game minutes. Pure; call on the game clock.
 * Returns the same object when nothing changed, so callers can skip a write.
 */
export function simulateBody<W extends BodySlices>(world: W, dtMin: number, env: Env): W {
  if (dtMin <= 0) return world;
  const h = dtMin / 60;
  const b = bodyState(world);
  const t = gameTime(world);
  const phase = phaseOfHour(Math.floor((t.minutes % MINUTES_PER_DAY) / 60));
  const night = phase === "night" || phase === "dusk";
  const energyRate = ENERGY_PER_HOUR * (env.running ? RUN_ENERGY_MULT : env.moving ? 1.25 : 1);
  const hungerRate = HUNGER_PER_HOUR * (env.running ? RUN_HUNGER_MULT : 1);
  const warmthRate = env.outdoors
    ? night
      ? WARMTH_OUT_NIGHT_PER_HOUR
      : WARMTH_OUT_DAY_PER_HOUR
    : WARMTH_IN_PER_HOUR;
  const next: BodyState = {
    ...b,
    energy: clamp(b.energy + energyRate * h),
    hunger: clamp(b.hunger + hungerRate * h),
    warmth: clamp(b.warmth + warmthRate * h),
    buzz: clamp(b.buzz + BUZZ_PER_HOUR * h),
    hangover: clamp(b.hangover + HANGOVER_PER_HOUR * h),
  };
  const habits = habitsState(world);
  const walked = env.moving ? (dtMin * 60 * (env.running ? 130 : 72)) / 16 : 0;
  return {
    ...world,
    body: next,
    time: { minutes: t.minutes + dtMin },
    habits: walked ? { ...habits, walkedM: habits.walkedM + walked } : habits,
  };
}

// --- events -----------------------------------------------------------------------

export type BodyEvent =
  | { kind: "eat"; what: "hotdog" | "frytki" | "meal" | "snack" }
  | { kind: "coffee" }
  | { kind: "grzaniec" }
  | { kind: "beer" }
  | { kind: "water" }
  | { kind: "smoke" }
  | { kind: "train"; hard?: boolean }
  | { kind: "shower" }
  | { kind: "pray" }
  | { kind: "dishes" }
  | { kind: "bowls" }
  | { kind: "sleep" }
  | { kind: "nap" };

const bump = (h: Habits, all: keyof Habits, today: keyof Habits): Habits => ({
  ...h,
  [all]: (h[all] as number) + 1,
  [today]: (h[today] as number) + 1,
});

/** The morning: energy back, the buzz turned into a head, the day's counters cleared. */
export function sleepUntilMorning<W extends BodySlices>(world: W): W {
  const b = bodyState(world);
  const t = gameTime(world);
  const hour = Math.floor((t.minutes % MINUTES_PER_DAY) / 60);
  // going to bed after midnight still wakes the same calendar morning
  const day = Math.floor(t.minutes / MINUTES_PER_DAY) + (hour >= WAKE_HOUR ? 1 : 0);
  const wake = day * MINUTES_PER_DAY + WAKE_HOUR * 60;
  const hoursSlept = (wake - t.minutes) / 60;
  const h = habitsState(world);
  return {
    ...world,
    time: { minutes: wake },
    body: {
      energy: clamp(Math.min(100, 55 + hoursSlept * 6)),
      hunger: clamp(b.hunger * 0.5 + 35),
      warmth: 100,
      buzz: 0,
      hangover: clamp(b.buzz * 1.6 + b.hangover * 0.3),
      wokeAt: wake,
    },
    habits: {
      ...h,
      nights: h.nights + 1,
      smokedToday: 0,
      trainedToday: 0,
      beersToday: 0,
      coffeesToday: 0,
      mealsToday: 0,
    },
  };
}

export function applyEvent<W extends BodySlices>(world: W, ev: BodyEvent): W {
  const b = bodyState(world);
  const h = habitsState(world);
  const day = gameDay(world);
  const set = (patch: Partial<BodyState>, habits: Habits = h): W => ({
    ...world,
    body: {
      ...b,
      ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, clamp(v as number)])),
    },
    habits,
  });
  switch (ev.kind) {
    case "eat": {
      const fill =
        ev.what === "snack" ? 18 : ev.what === "hotdog" ? 38 : ev.what === "frytki" ? 45 : 60;
      return set(
        { hunger: b.hunger - fill, energy: b.energy + 4, buzz: b.buzz - 4 },
        bump(h, "meals", "mealsToday"),
      );
    }
    case "coffee":
      return set(
        {
          energy: b.energy + 14,
          hunger: b.hunger - 4,
          hangover: b.hangover - 10,
          warmth: b.warmth + 15,
        },
        bump(h, "coffees", "coffeesToday"),
      );
    case "grzaniec":
      return set(
        { warmth: b.warmth + 40, buzz: b.buzz + 14, hunger: b.hunger - 6 },
        bump(h, "beers", "beersToday"),
      );
    case "beer":
      return set(
        { buzz: b.buzz + 36, hunger: b.hunger - 6, warmth: b.warmth + 6, energy: b.energy - 3 },
        bump(h, "beers", "beersToday"),
      );
    case "water":
      return set({ buzz: b.buzz - 6, hangover: b.hangover - 8, hunger: b.hunger + 1 });
    case "smoke":
      return set({ hunger: b.hunger - 3, energy: b.energy + 2 }, bump(h, "smoked", "smokedToday"));
    case "train":
      return set(
        { energy: b.energy - (ev.hard ? 14 : 9), hunger: b.hunger + 9, warmth: b.warmth + 5 },
        bump(h, "trained", "trainedToday"),
      );
    case "shower": {
      const out = set(
        { energy: b.energy + 6, hangover: b.hangover - 15, warmth: b.warmth + 30 },
        { ...h, showers: h.showers + 1 },
      );
      // the hair stays wet for a while after
      return { ...out, body: { ...out.body, wetUntil: gameTime(world).minutes + 40 } };
    }
    case "pray":
      return set({}, { ...h, prayers: h.prayers + 1 });
    case "dishes":
      return set({}, { ...h, dishesDay: day });
    case "bowls":
      return set({}, { ...h, bowlsDay: day });
    case "nap":
      return set({ energy: b.energy + 25, hangover: b.hangover - 10 });
    case "sleep":
      return sleepUntilMorning(world);
  }
}

// --- what the body does to the sprite -------------------------------------------------

/** The posture the body imposes, or null to keep the wardrobe's. */
export function bodyPosture(w: BodySlices): "slouched" | null {
  const f = bodyFlags(w);
  return f.exhausted || f.hungover || (f.tired && f.hungry) ? "slouched" : null;
}

/** The gait the body imposes: drunk over tired over none. */
export function bodyGait(w: BodySlices): "drunk" | "tired" | null {
  const f = bodyFlags(w);
  if (f.drunk) return "drunk";
  if (f.exhausted || (f.tired && f.hungover)) return "tired";
  return null;
}

/** What the face does by default — the last event wins over this. */
export function bodyMood(w: BodySlices): "smile" | "sad" | "tense" | null {
  const f = bodyFlags(w);
  if (f.drunk || f.tipsy) return "smile";
  if (f.hungover) return "tense";
  if (f.freezing || f.starving) return "tense";
  if (f.exhausted && f.hungry) return "sad";
  return null;
}

/** How many times he has spoken to someone, and how many days ago last. */
export function metTimes(
  w: { met?: Record<string, { times: number; lastDay: number }> } & BodySlices,
  id: string,
): { times: number; daysAgo: number } {
  const m = w.met?.[id];
  if (!m) return { times: 0, daysAgo: Number.POSITIVE_INFINITY };
  return { times: m.times, daysAgo: gameDay(w) - m.lastDay };
}

/** True while the hair is still wet from the shower. */
export const isWet = (w: BodySlices): boolean => (bodyState(w).wetUntil ?? 0) > gameTime(w).minutes;

/** The layer the body asks for — hands in pockets when it is cold. */
export function bodyLayer(w: BodySlices, outdoors: boolean): "pockets" | null {
  const f = bodyFlags(w);
  return outdoors && f.cold ? "pockets" : null;
}

/** The idle flourishes the body makes likely, by id (see PlayerConfig.idles). */
export function bodyIdles(w: BodySlices, outdoors: boolean): string[] {
  const f = bodyFlags(w);
  const out: string[] = [];
  if (f.tired) out.push("yawn", "rubEyes");
  if (f.exhausted) out.push("yawn");
  if (outdoors && f.cold) out.push("shiver", "shiver");
  if (f.hungry) out.push("belly");
  if (f.hungover) out.push("temples");
  // a heavy day's smoking shows in the chest
  if (habitsState(w).smokedToday >= 4) out.push("cough");
  return out;
}

/** The world state a new game begins with — a rested man at the real hour. */
export function freshBody(realHour = new Date().getHours()): Required<BodySlices> {
  const time = startTime(realHour);
  return {
    time,
    body: defaultBody(time.minutes),
    habits: defaultHabits(),
    voice: { said: {}, lastAt: -1e9 },
  };
}

export type { WorldState };
