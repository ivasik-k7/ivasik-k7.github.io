// World-wide state that persists across all locations

export type LightRoom = "hallway" | "kitchen" | "living" | "study" | "bath";

export interface WindowState {
  open: boolean;
  smoked: boolean;
}

export type DayPhase = "morning" | "day" | "dusk" | "night";

export interface WorldState {
  // Global progression
  money: number; // złoty — Żabka runs
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
    skin: string;
    hair: string;
    beard: string;
    hat: string;
    shirt: string;
    trousers: string;
    shoes: string;
  };

  // The Golf, level -1
  golfLocked: boolean;

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
}

/** What the things in the pocket call themselves (HUD, status menu). */
export const ITEM_LABEL: Record<string, string> = {
  cigarettes: "REDS",
  lighter: "LIGHTER",
  parcel: "PARCEL",
  ticket: "BILET",
};

export const initialWorld: WorldState = {
  money: 50,
  inventory: [],
  lights: { studio: true, hallway: true, kitchen: true, living: true, study: true, bath: true },
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
    hat: "none",
    shirt: "default",
    trousers: "default",
    shoes: "default",
  },
  golfLocked: true,
  corridor: { parcelTaken: false, plantWatered: false, extOpen: false, liftOpen: false },
  street: { binOpen: false, paczkomatUsed: false },
  zabka: { fridgeOpen: false, freezerOpen: false },
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
