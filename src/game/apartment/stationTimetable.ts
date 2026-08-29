/**
 * The timetable.
 *
 * Everything that happens on the platform runs off one repeating cycle, and
 * this module is the only place that knows how long it is or what is in it.
 * Two things read it and they have to agree exactly:
 *
 *  – the artwork, which animates the trains with SVG SMIL. SMIL runs on the
 *    document clock, so the scene mounts its animations with a *negative*
 *    `begin` equal to however far into the cycle we already are, which drops
 *    them straight into the right frame instead of starting the timetable over
 *    every time the player walks onto the platform.
 *  – the scene's objects, whose `when` predicates decide whether a carriage
 *    door can be interacted with. Those are evaluated by the runtime every
 *    frame against the world, and the world knows nothing about trains, so they
 *    ask this module instead.
 *
 * Keeping the schedule as a pure function of the wall clock is what makes those
 * two agree without a subscription, a store, or a copy of the position in
 * React state. Nothing here re-renders anything.
 *
 * It is deliberately not in the save. A timetable is not a fact about the
 * player; it is a fact about the railway, and it keeps running whether or not
 * anybody is standing on the platform — which is also why the epoch is set once
 * and never reset. Come back to the station twenty minutes later and you catch
 * whatever is due, which is the whole feeling of a station.
 */

/** One full cycle. Long enough that a train is an event, short enough to wait. */
export const CYCLE_S = 96;

/**
 * The schedule, in seconds into the cycle.
 *
 * The gaps matter as much as the trains. §8 of the brief asks that the
 * boardable train not be sitting there when the scene loads — the player should
 * have time to walk the platform, read the board, watch something go past and
 * notice where they are — so the first 46 s have no train you can get on, and
 * the express at 20 s is there to prove the railway works before it matters.
 */
export const TIMETABLE = {
  /**
   * The down train, on the near road, right to left toward Gdańsk.
   *
   * In the foreground — between the player and the camera — so it is the one
   * event on the platform with real weight to it: for four seconds the whole
   * frame is a train going past a metre and a half away, and then it is gone and
   * the station is quiet again. Early in the cycle, so it is the first thing a
   * player who has just walked up the steps sees.
   */
  nearEnter: 7,
  nearLeave: 12.5,
  /** the non-stop express toward Sopot, on the far road: enters, crosses, gone */
  expressEnter: 20,
  expressLeave: 27.5,
  /** the boardable service: starts braking into the platform */
  arriveEnter: 46,
  /** wheels stopped */
  arriveStop: 54,
  /** doors released */
  doorsOpen: 55.4,
  /** doors closing — the player has 22 s of boarding, which is generous and
      still feels like it might leave without you */
  doorsClose: 77.5,
  /** moving again */
  departStart: 79.5,
  /** out of the frame */
  departEnd: 88,
} as const;

/**
 * Where the unit stands when it has stopped, as a translate on the drawn train.
 *
 * The train art is drawn with its leading cab at x = TRAIN.len, i.e. hard
 * against the right of its own local space, so a translate of 0 puts the cab at
 * the far end of the platform and negative values back it toward Gdańsk.
 */
export const STOP_X = 260;

/**
 * Door centres in scene x when the unit is stopped. These are the only places
 * boarding is possible, and the numbers are the door offsets in the train art
 * plus STOP_X — kept here rather than derived so the scene's object list and
 * the artwork cannot drift apart without one of them being obviously wrong.
 */
export const DOOR_X = [510, 960, 1340, 1790] as const;

export type StationPhase = "quiet" | "express" | "arriving" | "boarding" | "leaving";

/** Set on first mount, then never again — see the note on the epoch above. */
let epoch = 0;

/** Called by the scene when it mounts. Idempotent. */
export function armStation(now = performance.now()): void {
  if (epoch === 0) epoch = now;
}

/** Seconds into the current cycle. */
export function stationCycleOffsetS(now = performance.now()): number {
  if (epoch === 0) armStation(now);
  return ((now - epoch) / 1000) % CYCLE_S;
}

export function stationPhase(now = performance.now()): StationPhase {
  const t = stationCycleOffsetS(now);
  const T = TIMETABLE;
  if (t >= T.expressEnter && t < T.expressLeave) return "express";
  if (t >= T.arriveEnter && t < T.doorsOpen) return "arriving";
  if (t >= T.doorsOpen && t < T.doorsClose) return "boarding";
  if (t >= T.doorsClose && t < T.departEnd) return "leaving";
  return "quiet";
}

/**
 * Whether a door can be boarded right now.
 *
 * Half a second is shaved off each end of the doors-open window so that the
 * interact prompt never appears over a door still visibly sliding, and never
 * survives into the frame where it has visibly shut. The player should be
 * reading the doors, not the prompt.
 */
export function boardingOpen(now = performance.now()): boolean {
  const t = stationCycleOffsetS(now);
  return t >= TIMETABLE.doorsOpen + 0.5 && t <= TIMETABLE.doorsClose - 0.5;
}

/** Seconds until the doors shut, for the countdown on the platform display. */
export function secondsToDeparture(now = performance.now()): number {
  const t = stationCycleOffsetS(now);
  if (t < TIMETABLE.arriveEnter) return TIMETABLE.arriveEnter - t;
  if (t < TIMETABLE.doorsClose) return TIMETABLE.doorsClose - t;
  return CYCLE_S - t + TIMETABLE.arriveEnter;
}

/** A cycle fraction, for SMIL `keyTimes`. */
export const kt = (seconds: number) => (seconds / CYCLE_S).toFixed(4);

/**
 * The line — data, not art: it lives here so the route map (in the boot
 * chunk) can read it without dragging the whole train scene along.
 *
 * `scene` is where getting off actually puts you; `scene` is where getting off actually puts you; `spawnX` is the
 * spot on that scene's ground you land on — by the doors, by the steps, at the
 * bottom of the Stocznia stair. The route map reads both, so opening a new
 * station is one line here and zero lines there.
 */
/**
 * `stationAt` is the generic-platform switch: stops that share the one
 * "station" scene carry the identity the scene should wake up wearing, and
 * the route map writes it into `world.station.at` before the travel. Opening
 * another stop on the line is one entry here plus a spec in trainStation's
 * STATIONS table — no new scene.
 */
export const LINE = [
  /* the terminus: up the tunnel stair onto Targ Sienny, the Forum across the water */
  { id: "gdansk", name: "GDANSK GL.", scene: "forum" as string | null, spawnX: 170 },
  { id: "stocznia", name: "STOCZNIA", scene: "elektrykow" as string | null, spawnX: 120 },
  { id: "politechnika", name: "POLITECHNIKA", scene: null as string | null, spawnX: 0 },
  { id: "oliwa", name: "OLIWA", scene: "district" as string | null, spawnX: 250 },
  {
    id: "przymorze",
    name: "PRZYMORZE-UNIW.",
    scene: "station" as string | null,
    spawnX: 520,
    stationAt: "przymorze" as string | undefined,
  },
  {
    id: "zaspa",
    name: "ZASPA",
    scene: "station" as string | null,
    spawnX: 520,
    stationAt: "zaspa" as string | undefined,
  },
  { id: "sopot", name: "SOPOT", scene: null as string | null, spawnX: 0 },
  { id: "gdynia", name: "GDYNIA GL.", scene: null as string | null, spawnX: 0 },
] as const;
