import type { RuntimeSceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The world beyond the front door, one scene per file and one code-split
 * chunk per scene: corridor (the landing), the lift, the street, parking
 * level −1, Żabka, the Alchemia district, the gym, the SKM platform at
 * Przymorze-Uniwersytet, Ulica Elektryków at the Stocznia, and the club in
 * hall B. The engine resolves a loader on first travel toward it, holding
 * the travel fade until the chunk lands.
 */
export const OUTSIDE_SCENES: Record<string, () => Promise<RuntimeSceneDef<WorldState>>> = {
  district: () => import("./districtScene").then((m) => m.DISTRICT_SCENE),
  gym: () => import("./gymScene").then((m) => m.GYM_SCENE),
  corridor: () => import("./corridorScene").then((m) => m.CORRIDOR_SCENE),
  elevator: () => import("./elevatorScene").then((m) => m.ELEVATOR_SCENE),
  outside: () => import("./streetScene").then((m) => m.STREET_SCENE),
  parking: () => import("./parkingScene").then((m) => m.PARKING_SCENE),
  zabka: () => import("./zabkaScene").then((m) => m.ZABKA_SCENE),
  station: () => import("./trainStation").then((m) => m.TRAIN_STATION_SCENE),
  train: () => import("./trainScene").then((m) => m.TRAIN_SCENE),
  elektrykow: () => import("./elektrykowScene").then((m) => m.ELEKTRYKOW_SCENE),
  raveclub: () => import("./raveClubScene").then((m) => m.RAVE_CLUB_SCENE),
  forum: () => import("./forumScene").then((m) => m.FORUM_SCENE),
};
