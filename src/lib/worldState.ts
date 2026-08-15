// Shared contract between the engine (ApartmentGame), room art (rooms.tsx) and data.
//
// CSS classes referenced by room art and defined in src/index.css:
//   .tulle-sway     — gentle curtain sway while a window is open
//   .washer-rumble  — washing machine shake while running
//   .tv-static      — animated static flicker on the TV screen
//   .dog-breathe, .crt-cursor, .meter-disc, .steam, .note — already exist

export type LightRoom = "hallway" | "kitchen" | "living" | "study" | "bath";

export type TvChannel = "off" | "film" | "football" | "static";

export interface WindowState {
  open: boolean;
  /** A cigarette has been smoked since this window was opened (next E closes it). */
  smoked: boolean;
}

export interface WorldState {
  /** Per-room lighting — the balcony is outside and has no light of its own. */
  lights: Record<LightRoom, boolean>;
  tv: TvChannel;
  radioOn: boolean;
  kettleOn: boolean;
  fridgeOpen: boolean;
  wardrobeOpen: boolean;
  washerOn: boolean;
  windows: {
    "window-kitchen": WindowState;
    "window-yard": WindowState;
  };
  dogPets: number;
}

export const initialWorld: WorldState = {
  lights: { hallway: true, kitchen: true, living: true, study: true, bath: true },
  tv: "off",
  radioOn: false,
  kettleOn: false,
  fridgeOpen: false,
  wardrobeOpen: false,
  washerOn: false,
  windows: {
    "window-kitchen": { open: false, smoked: false },
    "window-yard": { open: false, smoked: false },
  },
  dogPets: 0,
};

export const TV_CYCLE: TvChannel[] = ["off", "film", "football", "static"];

export type DayPhase = "morning" | "day" | "dusk" | "night";

/** Phase of day from a real-clock hour (0–23). */
export function dayPhase(hour: number): DayPhase {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "dusk";
  return "night";
}

/** How dark a room feels: 0 = fully lit, 1 = deepest dark. Balcony is always 0. */
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
