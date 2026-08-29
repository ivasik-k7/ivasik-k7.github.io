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
 */

/** He stands for at least this long before doing anything with it. */
const IDLE_FLOURISH_MIN = 7000;
const IDLE_FLOURISH_SPREAD = 9000;
const IDLE_FLOURISHES = 3;

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
  flourish: number;
};

export const newIdleState = (): IdleState => ({
  since: 0,
  nextFlourish: 0,
  flourish: 0,
});

/** Call when the character moves or acts — idle time starts over. */
export function resetIdle(idle: IdleState): void {
  idle.since = 0;
}

/**
 * The idle frame for this tick. Call only while standing (not moving, no
 * action); the state advances itself and re-arms on the first tick after a
 * reset.
 */
export function stepIdle(idle: IdleState, now: number, paused: boolean, idleLean: boolean): string {
  if (idle.since === 0) {
    idle.since = now;
    idle.nextFlourish = now + IDLE_FLOURISH_MIN + jitter(now + 1, IDLE_FLOURISH_SPREAD);
  }
  // the breath: down for a beat, up for a beat, the beat itself drifting
  const cycle = 1500 + jitter(Math.floor(now / 3400), 500);
  const out = now % cycle < cycle * 0.52;
  const breath = out ? "stand" : "idleB";
  let idleFrame = breath;

  if (!paused && now >= idle.nextFlourish) {
    const ft = now - idle.nextFlourish;
    const pick = idle.flourish;
    const done = (ms: number) => {
      if (ft >= ms) {
        idle.flourish = (pick + 1 + (jitter(now, 3) % 2)) % IDLE_FLOURISHES;
        idle.nextFlourish = now + IDLE_FLOURISH_MIN + jitter(now, IDLE_FLOURISH_SPREAD);
        return true;
      }
      return false;
    };
    if (idleLean) {
      if (!done(2600)) idleFrame = "leanIdle";
    } else if (pick === 0) {
      if (!done(2400)) {
        idleFrame = ft < 500 ? "stretchA" : ft < 1900 ? "stretchB" : "stretchA";
      }
    } else if (pick === 1) {
      if (!done(1600)) idleFrame = "lookBack";
    } else {
      // the shortest one: weight off one foot and back, which is what
      // people actually do while they are waiting for nothing
      if (!done(2000)) idleFrame = ft < 1000 ? "idleB" : breath;
    }
  }
  return idleFrame;
}
