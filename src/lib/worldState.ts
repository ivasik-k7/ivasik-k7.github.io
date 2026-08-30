// World-wide state that persists across all locations
import { freshBody } from "./body";

export type LightRoom = "hallway" | "kitchen" | "living" | "study" | "bath";

export interface WindowState {
  open: boolean;
  smoked: boolean;
}

export type DayPhase = "morning" | "day" | "dusk" | "night";

export interface WorldState {
  // Global progression
  money: number; // złoty — Żabka runs
  /** what the bankomat on block 16 believes you are worth */
  account: number;
  inventory: Array<{ itemId: string; quantity: number }>;

  // The flat
  lights: Record<string, boolean>;
  windows: Record<string, WindowState>;
  tv: "off" | "film" | "football" | "static";
  radioOn: boolean;
  kettleOn: boolean;
  cookerState: "off" | "open" | "on";
  doorOpening: string | null;
  fridgeOpen: boolean;
  wardrobeOpen: boolean;
  washerOn: boolean;
  dogPets: number;

  // Who you look like today (option ids per wardrobe slot)
  appearance: {
    // colours
    skin: string;
    hair: string;
    beard: string;
    hat: string;
    shirt: string;
    trousers: string;
    shoes: string;
    // shapes — added with the parametric rig; absent in older saves and filled
    // in by `normalizeAppearance`, so every reader sees all of them
    head?: "none" | "cap" | "beanie" | "hood";
    top?: "tee" | "tank" | "longsleeve" | "hoodie" | "jumper" | "jacket" | "kurtka" | "shirt";
    bottom?: "trousers" | "joggers" | "shorts" | "tracksuit";
    feet?: "sneakers" | "boots" | "sandals" | "barefoot";
    build?: "slight" | "lean" | "athletic" | "heavy" | "powerlifter";
    height?: "short" | "average" | "tall" | "towering";
    neck?: "thin" | "normal" | "thick";
    posture?: "upright" | "relaxed" | "slouched";
  };

  // The Golf, level -1
  golfLocked: boolean;

  // How well each minigame has ever gone: id -> best tier (0..2). Optional so
  // saves that predate the minigames still load; read through bestTier().
  minigames?: Record<string, number>;

  // The studio itself — chores and small habits. Optional so pre-existing
  // saves (which predate the field) still load; read through studioState().
  studio?: {
    dishesDone: boolean;
    binEmptied: boolean;
    bowlsFilled: boolean;
    guitarOut: boolean;
    plantWatered: boolean;
  };

  // The corridor, floor 4
  corridor: {
    parcelTaken: boolean;
    plantWatered: boolean;
    extOpen: boolean;
    liftOpen: boolean;
  };

  // Ulica Słoneczna
  street: {
    binOpen: boolean;
    paczkomatUsed: boolean;
  };

  // The Żabka downstairs
  zabka: {
    fridgeOpen: boolean;
    freezerOpen: boolean;
  };

  /**
   * The SKM unit you are riding in.
   *
   * `trainScene` has read this slice defensively since it was written and
   * nothing has ever written it, so the train ran toward Gdynia at crowd 2
   * with the lights on and clear weather for every journey the player ever
   * took, whichever stop they picked on the route map. The scene sets it on
   * arrival now (see TRAIN_SCENE.enter).
   *
   * Optional, and read through `trainState(world)` with defaults — the same
   * shape `studio` uses. A required field plus an `initialWorld` entry would
   * work for a new game and break every save written before it existed.
   */
  train?: {
    toward: "gdansk" | "gdynia";
    crowd: number;
    seated: boolean;
    lights: boolean;
    weather: "clear" | "rain";
  };

  /**
   * The man himself — see lib/body.ts. Energy, hunger, warmth, buzz and
   * hangover; what he has done, all-time and today; the game's own clock;
   * what his inner voice has already said. All optional so a save from before
   * he had an inside still loads: readers go through `bodyState(w)`,
   * `habitsState(w)`, `gameTime(w)`, and default to a rested man at the real
   * hour.
   */
  body?: import("./body").BodyState;
  habits?: import("./body").Habits;
  time?: import("./body").GameTime;
  voice?: import("./body").Voice;
  /** how often he has spoken to each person — see lib/body.ts and the dialogue trees */
  met?: Record<string, { times: number; lastDay: number }>;
}

/** What the things in the pocket call themselves (HUD, status menu). */
export const ITEM_LABEL: Record<string, string> = {
  cigarettes: "REDS",
  lighter: "LIGHTER",
  parcel: "PARCEL",
  ticket: "BILET",
  grzaniec: "GRZANIEC",
  beer: "PIWO",
  water: "WODA",
  izotonik: "IZOTONIK",
  earplugs: "STOPERY",
};

export const initialStudio: NonNullable<WorldState["studio"]> = {
  dishesDone: false,
  binEmptied: false,
  bowlsFilled: false,
  guitarOut: false,
  plantWatered: false,
};

/** The best tier ever reached in one minigame, 0 when never played well. */
export function bestTier(world: WorldState, id: string): number {
  return world.minigames?.[id] ?? 0;
}

/** Fold a fresh result into the record, keeping only the high-water mark. */
export function recordTier(world: WorldState, id: string, tier: number): WorldState {
  const prev = world.minigames?.[id] ?? -1;
  if (tier <= prev) return world;
  return { ...world, minigames: { ...world.minigames, [id]: tier } };
}

/** The studio chore bag with defaults for saves that predate it. */
export function studioState(world: WorldState): NonNullable<WorldState["studio"]> {
  return { ...initialStudio, ...world.studio };
}

export const initialWorld: WorldState = {
  money: 50,
  account: 1450,
  inventory: [],
  lights: {
    studio: true,
    hallway: true,
    kitchen: true,
    living: true,
    study: true,
    bath: true,
  },
  windows: {
    "window-kitchen": { open: false, smoked: false },
    "window-yard": { open: false, smoked: false },
  },
  tv: "off",
  radioOn: false,
  kettleOn: false,
  cookerState: "off",
  doorOpening: null,
  fridgeOpen: false,
  wardrobeOpen: false,
  washerOn: false,
  dogPets: 0,
  appearance: {
    skin: "default",
    hair: "default",
    beard: "default",
    hat: "navy",
    shirt: "default",
    trousers: "default",
    shoes: "default",
    head: "none",
    top: "tee",
    bottom: "trousers",
    feet: "sneakers",
    build: "athletic",
    height: "average",
    neck: "normal",
    posture: "upright",
  },
  golfLocked: true,
  studio: { ...initialStudio },
  corridor: {
    parcelTaken: false,
    plantWatered: false,
    extOpen: false,
    liftOpen: false,
  },
  street: { binOpen: false, paczkomatUsed: false },
  zabka: { fridgeOpen: false, freezerOpen: false },
  ...freshBody(),
  met: {},
};

export function dayPhase(hour: number): DayPhase {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "dusk";
  return "night";
}

export function roomDarkness(phase: DayPhase, lightOn: boolean): number {
  if (lightOn) return phase === "night" ? 0.08 : 0;
  switch (phase) {
    case "morning":
      return 0.12;
    case "day":
      return 0.06;
    case "dusk":
      return 0.55;
    case "night":
      return 0.78;
  }
}

export const TV_CYCLE = ["off", "film", "football", "static"] as const;
export type TvChannel = (typeof TV_CYCLE)[number];
