import type { IdleFlourish } from "./types";

/**
 * idleBrain.ts — what the character does while standing about.
 *
 * The old program was three wall-clock modulos — `now % 1700` for the breath,
 * `now % 4200` for the blink, `now % 11000` for a flourish. Three problems
 * came out of that, all of them visible:
 *
 *  – the blink derived from `stand` and the out-breath from `stand` minus a
 *    pixel, so every blink bounced the whole body up and back down;
 *  – the flourish was keyed to the wall clock rather than to how long he had
 *    actually been standing, so stopping at the wrong moment made him stretch
 *    overhead 200 ms later, and it fired during conversations;
 *  – and being modulo, it was perfectly regular. Metronomic idles are the
 *    single clearest tell that a character is a sprite rather than a person.
 *
 * What replaced it: the intervals are jittered from a cheap hash so no two
 * are the same length, and the flourish waits on real idle time and never
 * runs while the game is paused. The blink has since moved out altogether —
 * `faceBrain.ts` closes the eyes on whatever frame the body is showing, so it
 * no longer needs to know what the breath is doing.
 *
 * And the flourishes are no longer three fixed ones. The character config
 * may bring its own (`PlayerConfig.idles`: a yawn, a shiver, a look at the
 * watch) and the game says which of them fit the moment (`extra`: tired, cold,
 * on a platform). Those join the pool alongside the built-in stretch, look
 * and shift; a moment that lists one twice makes it twice as likely. Standing
 * still for a long time gets one more: the phone comes out (`longIdle`).
 */

/** He stands for at least this long before doing anything with it. */
const IDLE_FLOURISH_MIN = 7000;
const IDLE_FLOURISH_SPREAD = 9000;
/** standing this long without anything else brings the phone out */
const LONG_IDLE_MS = 26000;

const BUILTIN = ["stretch", "lookBack", "shift"] as const;

/**
 * Deterministic jitter — the same input always gives the same offset, so the
 * idle is reproducible frame to frame within one beat while still being
 * irregular across beats. `Math.random` would change the answer on every tick
 * and make the pose flicker.
 */
export function jitter(seed: number, span: number): number {
  let h = Math.imul(seed | 0, 2654435761);
  h ^= h >>> 15;
  return Math.abs(h) % Math.max(1, span);
}

/** How long he has been standing still, and what he does about it next. */
export type IdleState = {
  since: number;
  nextFlourish: number;
  /** index into the built-in pool, kept for the deterministic rotation */
  flourish: number;
  /** the flourish currently playing (id), or null between them */
  playing: string | null;
  /** the long-idle flourish has run this stand */
  longDone: boolean;
};

export const newIdleState = (): IdleState => ({
  since: 0,
  nextFlourish: 0,
  flourish: 0,
  playing: null,
  longDone: false,
});

/** Call when the character moves or acts — idle time starts over. */
export function resetIdle(idle: IdleState): void {
  idle.since = 0;
  idle.playing = null;
  idle.longDone = false;
}

export interface IdleOptions {
  /** the character's own flourishes, by id */
  flourishes?: Readonly<Record<string, IdleFlourish>>;
  /** ids from `flourishes` that fit right now; repeats weight the pick */
  extra?: readonly string[];
  /** the flourish for a long stand (default "phone" when the character has one) */
  longIdle?: string;
}

const clipLength = (f: IdleFlourish): number => f.frames.reduce((n, s) => n + s.ms, 0);
const clipFrame = (f: IdleFlourish, t: number): string => {
  let acc = 0;
  for (const s of f.frames) {
    acc += s.ms;
    if (t < acc) return s.f;
  }
  return f.frames[f.frames.length - 1]?.f ?? "stand";
};

/**
 * The idle frame for this tick. Call only while standing (not moving, no
 * action); the state advances itself and re-arms on the first tick after a
 * reset.
 */
export function stepIdle(
  idle: IdleState,
  now: number,
  paused: boolean,
  idleLean: boolean,
  opts: IdleOptions = {},
): string {
  if (idle.since === 0) {
    idle.since = now;
    idle.nextFlourish = now + IDLE_FLOURISH_MIN + jitter(now + 1, IDLE_FLOURISH_SPREAD);
    idle.playing = null;
    idle.longDone = false;
  }
  // the breath: down for a beat, up for a beat, the beat itself drifting
  const cycle = 1500 + jitter(Math.floor(now / 3400), 500);
  const out = now % cycle < cycle * 0.52;
  const breath = out ? "stand" : "idleB";
  let idleFrame = breath;

  if (paused || now < idle.nextFlourish) return idleFrame;

  const ft = now - idle.nextFlourish;
  const rearm = () => {
    idle.flourish = (idle.flourish + 1 + (jitter(now, 3) % 2)) % BUILTIN.length;
    idle.nextFlourish = now + IDLE_FLOURISH_MIN + jitter(now, IDLE_FLOURISH_SPREAD);
    idle.playing = null;
  };
  const done = (ms: number) => {
    if (ft >= ms) {
      rearm();
      return true;
    }
    return false;
  };

  // pick, once per flourish: the long-idle one when it is time and not yet
  // played, else one of the moment's extras, else the built-in rotation
  if (idle.playing === null) {
    const pool = opts.flourishes ?? {};
    const long = opts.longIdle ?? (pool.phone ? "phone" : undefined);
    if (long && pool[long] && !idle.longDone && now - idle.since >= LONG_IDLE_MS) {
      idle.playing = long;
      idle.longDone = true;
    } else {
      const extras = (opts.extra ?? []).filter((id) => pool[id]);
      // three times in four the moment's own thing, the fourth the ordinary
      if (extras.length > 0 && jitter(Math.floor(idle.nextFlourish), 4) !== 0) {
        idle.playing = extras[jitter(Math.floor(idle.nextFlourish) + 7, extras.length)];
      } else {
        idle.playing = idleLean ? "lean" : BUILTIN[idle.flourish];
      }
    }
  }

  const id = idle.playing;
  const own = opts.flourishes?.[id];
  if (own) {
    if (!done(clipLength(own))) idleFrame = clipFrame(own, ft);
  } else if (id === "lean") {
    if (!done(2600)) idleFrame = "leanIdle";
  } else if (id === "stretch") {
    if (!done(2400)) idleFrame = ft < 500 ? "stretchA" : ft < 1900 ? "stretchB" : "stretchA";
  } else if (id === "lookBack") {
    if (!done(1600)) idleFrame = "lookBack";
  } else {
    // the shortest one: weight off one foot and back, which is what
    // people actually do while they are waiting for nothing
    if (!done(2000)) idleFrame = ft < 1000 ? "idleB" : breath;
  }
  return idleFrame;
}
