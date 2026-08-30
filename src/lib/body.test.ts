import { describe, expect, it } from "vitest";
import {
  applyEvent,
  awakeHours,
  bodyFlags,
  bodyGait,
  bodyIdles,
  bodyMood,
  bodyPosture,
  bodyState,
  freshBody,
  gameDay,
  gameHour,
  gamePhase,
  isWet,
  MINUTES_PER_DAY,
  metTimes,
  simulateBody,
  sleepUntilMorning,
  WAKE_HOUR,
} from "./body";

const inside = { outdoors: false, moving: false, running: false };
const street = { outdoors: true, moving: true, running: false };

describe("the body", () => {
  it("a new game starts rested at the real hour", () => {
    const w = freshBody(9);
    expect(gameHour(w)).toBe(9);
    expect(gamePhase(w)).toBe("morning");
    expect(bodyFlags(w)).toMatchObject({ tired: false, hungry: false, cold: false, drunk: false });
  });

  it("time passes, energy goes, hunger comes", () => {
    let w = freshBody(9);
    for (let i = 0; i < 60; i++) w = simulateBody(w, 10, inside); // 10 game hours
    expect(gameHour(w)).toBe(19);
    expect(awakeHours(w)).toBeCloseTo(10, 1);
    expect(bodyState(w).energy).toBeLessThan(35);
    expect(bodyState(w).hunger).toBeGreaterThan(65);
    const f = bodyFlags(w);
    expect(f.tired && f.hungry).toBe(true);
    expect(bodyPosture(w)).toBe("slouched");
  });

  it("the street at night takes the warmth; a room gives it back", () => {
    let w = { ...freshBody(23) };
    // an hour of game on the street at night is a real minute of walking
    for (let i = 0; i < 12; i++) w = simulateBody(w, 5, street);
    expect(bodyFlags(w).cold).toBe(true);
    for (let i = 0; i < 6; i++) w = simulateBody(w, 5, inside); // half an hour in
    expect(bodyFlags(w).cold).toBe(false);
  });

  it("beer: buzz, a drunk gait, a smile; then it wears off; sleep turns it into a head", () => {
    let w = freshBody(20);
    w = applyEvent(w, { kind: "beer" });
    expect(bodyFlags(w).tipsy).toBe(true);
    expect(bodyGait(w)).toBeNull(); // one beer: tipsy, not drunk
    w = applyEvent(w, { kind: "beer" });
    expect(bodyGait(w)).toBe("drunk");
    expect(bodyMood(w)).toBe("smile");
    for (let i = 0; i < 12; i++) w = simulateBody(w, 10, inside);
    expect(bodyFlags(w).drunk).toBe(false);
    w = applyEvent(w, { kind: "beer" });
    w = applyEvent(w, { kind: "beer" });
    const slept = sleepUntilMorning(w);
    expect(gameHour(slept)).toBe(WAKE_HOUR);
    expect(bodyFlags(slept).hungover).toBe(true);
    expect(bodyMood(slept)).toBe("tense");
    expect(slept.habits.beersToday).toBe(0);
    expect(slept.habits.beers).toBe(4);
    expect(slept.habits.nights).toBe(1);
  });

  it("sleeping after midnight wakes the same morning; before it, the next", () => {
    const late = { ...freshBody(1) }; // 01:00 on day 0
    expect(gameDay(sleepUntilMorning(late))).toBe(0);
    const evening = { ...freshBody(23) };
    expect(gameDay(sleepUntilMorning(evening))).toBe(1);
    expect(sleepUntilMorning(evening).time.minutes).toBe(MINUTES_PER_DAY + WAKE_HOUR * 60);
  });

  it("food, coffee and training move the numbers the way they should", () => {
    let w = freshBody(12);
    for (let i = 0; i < 30; i++) w = simulateBody(w, 10, inside);
    const hungry = bodyState(w).hunger;
    w = applyEvent(w, { kind: "eat", what: "hotdog" });
    expect(bodyState(w).hunger).toBeLessThan(hungry - 30);
    const e = bodyState(w).energy;
    w = applyEvent(w, { kind: "coffee" });
    expect(bodyState(w).energy).toBeGreaterThan(e);
    w = applyEvent(w, { kind: "train", hard: true });
    expect(w.habits.trained).toBe(1);
    expect(bodyState(w).energy).toBeLessThan(e + 14);
    expect(w.habits.coffeesToday).toBe(1);
    expect(w.habits.mealsToday).toBe(1);
  });

  it("simulate returns the same object for no time", () => {
    const w = freshBody(9);
    expect(simulateBody(w, 0, inside)).toBe(w);
  });
});

describe("what shows on him", () => {
  it("wet hair for a while after the shower, then dry", () => {
    let w = freshBody(9);
    expect(isWet(w)).toBe(false);
    w = applyEvent(w, { kind: "shower" });
    expect(isWet(w)).toBe(true);
    for (let i = 0; i < 5; i++) w = simulateBody(w, 10, inside);
    expect(isWet(w)).toBe(false);
  });

  it("a heavy day's smoking brings the cough; the cold the shiver; tiredness the yawn", () => {
    let w = freshBody(9);
    expect(bodyIdles(w, false)).toEqual([]);
    for (let i = 0; i < 4; i++) w = applyEvent(w, { kind: "smoke" });
    expect(bodyIdles(w, false)).toContain("cough");
    w = { ...w, body: { ...w.body, energy: 20, warmth: 10 } };
    expect(bodyIdles(w, true)).toEqual(
      expect.arrayContaining(["yawn", "rubEyes", "shiver", "cough"]),
    );
    expect(bodyIdles(w, false)).not.toContain("shiver");
  });

  it("remembers who he has spoken to", () => {
    const w = { ...freshBody(9), met: { barmanka: { times: 3, lastDay: 0 } } };
    expect(metTimes(w, "barmanka")).toEqual({ times: 3, daysAgo: 0 });
    expect(metTimes(w, "nobody").times).toBe(0);
    const later = { ...w, time: { minutes: w.time.minutes + 3 * 1440 } };
    expect(metTimes(later, "barmanka").daysAgo).toBe(3);
  });
});
