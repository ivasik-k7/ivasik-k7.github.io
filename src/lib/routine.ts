import { type BodySlices, gameDay, habitsState } from "./body";
import type { WorldState } from "./worldState";

/**
 * routine.ts — what a night does to the flat and what months do to the body.
 *
 * The body file knows numbers. This one knows the flat: every morning the
 * sink fills again, the bin is full again, the dog wants breakfast again —
 * the chores are a daily loop, not a checklist done once for ever. And the
 * gym leaves a mark that outlasts the session: enough of it and the wardrobe's
 * `build` goes up a step, which the parametric rig turns into shoulders.
 */

/** sessions at which the build moves up a step */
export const BUILD_STEPS: readonly {
  at: number;
  build: NonNullable<WorldState["appearance"]["build"]>;
}[] = [
  { at: 8, build: "lean" },
  { at: 20, build: "athletic" },
  { at: 40, build: "heavy" },
  { at: 70, build: "powerlifter" },
];

const BUILD_ORDER: readonly NonNullable<WorldState["appearance"]["build"]>[] = [
  "slight",
  "lean",
  "athletic",
  "heavy",
  "powerlifter",
];

/** The build the training count has earned — never below where he started. */
export function earnedBuild(
  trained: number,
  base: NonNullable<WorldState["appearance"]["build"]>,
): NonNullable<WorldState["appearance"]["build"]> {
  let best = base;
  for (const step of BUILD_STEPS) {
    if (trained >= step.at && BUILD_ORDER.indexOf(step.build) > BUILD_ORDER.indexOf(best)) {
      best = step.build;
    }
  }
  return best;
}

/**
 * The morning: the chores come back, and the body the gym has made shows.
 * Call after `sleepUntilMorning`.
 */
export function morningAfter(w: WorldState): WorldState {
  const habits = habitsState(w as BodySlices);
  const studio = w.studio ?? {
    dishesDone: false,
    binEmptied: false,
    bowlsFilled: false,
    guitarOut: false,
    plantWatered: false,
  };
  const base = w.appearance.build ?? "athletic";
  const build = earnedBuild(habits.trained, base);
  return {
    ...w,
    studio: { ...studio, dishesDone: false, binEmptied: false, bowlsFilled: false },
    appearance: build === base ? w.appearance : { ...w.appearance, build },
    // a night without the dog fed is a day he remembers
    habits: {
      ...habits,
      bowlsDay: studio.bowlsFilled ? gameDay(w as BodySlices) - 1 : habits.bowlsDay,
    },
  };
}
