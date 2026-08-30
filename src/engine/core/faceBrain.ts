import { jitter } from "./idleBrain";

/**
 * faceBrain.ts — the eyelids, on their own clock.
 *
 * The blink used to live inside the idle brain, which meant it existed only
 * while he stood still: walk, talk, smoke or swing a kettlebell and the eyes
 * stayed open for the whole of it, and a sprite that never blinks while it
 * does anything is a sprite you stop believing in about a minute in.
 *
 * Now the face is its own layer. This keeps time for the lids — when they
 * next close and how long they stay closed — and the runtime asks it, after
 * the body has picked its frame, whether to show that frame's eyes-closed
 * twin (see `character/compile.ts`). The body never knows.
 *
 * Timing: people blink every two to six seconds and a blink lasts about a
 * sixth of a second. Two blinks in quick succession happen, so the gap is
 * jittered with a floor rather than clamped to a comfortable average; the
 * jitter is hashed from the clock so a paused game resumes mid-blink rather
 * than re-rolling.
 */

export const BLINK_MS = 170;
const GAP_MIN = 1800;
const GAP_SPREAD = 4200;

export type FaceState = {
  /** when the lids next close (0 = not yet armed) */
  nextBlink: number;
  /** the lids are down until this time */
  openAt: number;
  /** the look on the face, and when it fades (0 = until cleared) */
  mood: string | null;
  moodUntil: number;
};

export const newFaceState = (): FaceState => ({
  nextBlink: 0,
  openAt: 0,
  mood: null,
  moodUntil: 0,
});

/**
 * Put a look on the face for `ms` (0 = until cleared). Re-setting the same
 * mood extends it; a different one replaces it — the last thing that
 * happened to him is what shows.
 */
export function setMood(face: FaceState, mood: string | null, now: number, ms = 0): void {
  face.mood = mood;
  face.moodUntil = mood && ms > 0 ? now + ms : 0;
}

/** The mood this tick, letting an expired one fade back to neutral. */
export function currentMood(face: FaceState, now: number): string | null {
  if (face.mood && face.moodUntil && now >= face.moodUntil) {
    face.mood = null;
    face.moodUntil = 0;
  }
  return face.mood;
}

/** True while the eyes are shut this tick. Advances the state. */
export function stepFace(face: FaceState, now: number): boolean {
  if (face.nextBlink === 0) {
    face.nextBlink = now + 600 + jitter(now, GAP_SPREAD);
    return false;
  }
  if (now < face.nextBlink) return false;
  if (face.openAt === 0) face.openAt = face.nextBlink + BLINK_MS;
  if (now < face.openAt) return true;
  // lids up; arm the next one from when they opened, so a long frame does
  // not turn into a long stare
  face.nextBlink = face.openAt + GAP_MIN + jitter(face.openAt, GAP_SPREAD);
  face.openAt = 0;
  return false;
}

/** Force the lids open and rearm — used when a frame is held for inspection. */
export function resetFace(face: FaceState, now: number): void {
  face.openAt = 0;
  face.nextBlink = now + GAP_MIN + jitter(now, GAP_SPREAD);
}
