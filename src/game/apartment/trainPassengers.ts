import { createNpc, type NpcConfig } from "@/engine";
import { lazyRegistry } from "@/engine/sprite/lazyRegistry";

/**
 * The 17:40 out of Gdańsk — everybody on it, and what their day was.
 *
 * A carriage at that hour is the most socially mixed room in the country and
 * that is the whole brief for this file: no two of these people had the same
 * kind of day, and you should be able to tell which had which without a word of
 * dialogue. The welder's overalls and the hard hat on his knee, the nurse's
 * lanyard, the tie loosened two stops ago, the hi-vis, the shopping bag between
 * the ankles, the flowers held upright so they do not get crushed — the look is
 * doing the writing.
 *
 * Most of them are scenery. They have no scene object, so the player cannot
 * target them and there is no prompt over them; they sit, they sway, they exist.
 * That is deliberate and it is what makes the three you *can* talk to feel like
 * a choice rather than a menu: a carriage where every passenger is a quest
 * giver is a lobby, not a train.
 *
 * The three who talk are the conductor, who is walking the train and will want
 * to see your ticket, and two people who are already sitting near you — which
 * is exactly the sample of a carriage you would actually speak to.
 */

const PASSENGER_FACTORIES: Record<string, () => NpcConfig> = {
  /* ------------------------------------------------------------ the one
   * who is going to ask you something
   * ------------------------------------------------------------------- */

  /**
   * The conductor. Walks the carriage end to end, and in Poland he is the one
   * piece of authority you meet on an ordinary evening — which is why the
   * ticket machine on the platform is worth the four złoty.
   */
  konduktor: () =>
    createNpc({
      id: "konduktor",
      name: "Konduktor",
      build: "regular",
      height: "tall",
      doing: "working",
      look: {
        skin: "tan",
        hair: "grey",
        hairStyle: "receding",
        hat: "cap",
        hatColour: "navy",
        face: ["moustache", "glasses"],
        top: "jacket",
        topColour: "navy",
        bottom: "trousers",
        bottomColour: "navy",
        shoes: "shoes",
        shoeColour: "black",
        accent: "lanyard",
        accentColour: "sky",
        prop: "clipboard",
        texture: "none",
      },
      lines: ["Bilety do kontroli.", "Dobry wieczór. Bilecik proszę.", "Następna Zaspa."],
    }),

  /**
   * Jeanne, in the seat next to yours, who does not speak a word of Polish.
   *
   * She is drawn as someone who put an outfit together this morning and it
   * worked — a good wool coat, a scarf tied rather than wound, heels she can
   * actually walk in, and the only person in the carriage whose posture is not
   * apologising for taking up a seat. On a train full of people going home from
   * a shift she stands out because she looks like she is going *somewhere*, and
   * that is the whole characterisation: everyone else is at the end of their
   * day and she is in the middle of hers.
   *
   * The scene she is in is a comedy, and the joke is not her. It is that two
   * polite adults with no language in common will work extremely hard to
   * establish approximately one fact.
   */
  jeanne: () =>
    createNpc({
      id: "jeanne",
      name: "Jeanne",
      build: "slim",
      height: "average",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "chestnut",
        hairStyle: "long",
        face: ["blusher"],
        top: "coat",
        topColour: "wine",
        bottom: "skirt",
        bottomColour: "charcoal",
        shoes: "heels",
        shoeColour: "black",
        accent: "scarf",
        accentColour: "cream",
        prop: "bag",
        propColour: "brown",
        texture: "knit",
      },
      /** Her own thoughts, which the player does not get a translation of. */
      lines: [
        "Bon. Trois heures de train et personne ne parle français.",
        "Gdynia. Gdy-nia. C'est joli, en fait.",
        "J'ai dit « tak » quatre fois. Je crois que ça veut dire oui.",
        "Il faisait plus chaud à Lyon.",
      ],
    }),

  /* --------------------------------------------------- the two who will talk */

  /**
   * Off the yard at Stocznia, and it shows in every line of him. Sits with his
   * knees apart taking up a seat and a half, which is accurate.
   */
  spawacz: () =>
    createNpc({
      id: "spawacz",
      name: "Spawacz",
      build: "stout",
      height: "average",
      doing: "sitting",
      look: {
        skin: "tan",
        hair: "brown",
        hairStyle: "crop",
        face: ["stubble", "tired"],
        top: "overalls",
        topColour: "denim",
        bottom: "workpants",
        bottomColour: "denim",
        shoes: "boots",
        shoeColour: "brown",
        accent: "vest",
        accentColour: "mustard",
        prop: "bag",
        propColour: "sand",
        texture: "worn",
      },
      lines: [
        "Dwanaście godzin. I jeszcze autobus.",
        "Kiedyś się tu robiło statki. Teraz się robi hale.",
        "Jak dojadę, to będzie ciemno. Zawsze jest ciemno.",
      ],
    }),

  /**
   * Coming off a shift at the hospital on Dębinki, still in the cardigan she
   * keeps for the tram because the ward is always too warm.
   */
  pielegniarka: () =>
    createNpc({
      id: "pielegniarka",
      name: "Pielęgniarka",
      build: "slim",
      height: "average",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "chestnut",
        hairStyle: "bun",
        face: ["tired"],
        top: "jumper",
        topColour: "teal",
        bottom: "trousers",
        bottomColour: "slate",
        shoes: "trainers",
        shoeColour: "white",
        accent: "lanyard",
        accentColour: "cream",
        prop: "phone",
        texture: "knit",
      },
      lines: [
        "Jeszcze dwadzieścia minut i będę w domu.",
        "Nocka za nockę. W piątek wolne, podobno.",
        "Nie zdążyłam zjeść. Znowu.",
      ],
    }),

  /* --------------------------------------------------------------- scenery
   * Nobody below here has a scene object. They are the carriage.
   * ------------------------------------------------------------------- */

  /** Tie loosened somewhere around Politechnika, coffee gone cold. */
  biurowy: () =>
    createNpc({
      id: "biurowy",
      name: "Biurowy",
      build: "regular",
      height: "average",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "black",
        hairStyle: "short",
        face: ["glasses"],
        top: "shirt",
        topColour: "sky",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "shoes",
        shoeColour: "black",
        accent: "tie",
        accentColour: "wine",
        prop: "coffee",
        texture: "pinstripe",
      },
      lines: ["..."],
    }),

  /** Asleep against the window since Oliwa, mouth open, and fair enough. */
  spiacy: () =>
    createNpc({
      id: "spiacy",
      name: "Śpiący",
      build: "regular",
      height: "short",
      doing: "sitting",
      look: {
        skin: "tan",
        hair: "black",
        hairStyle: "mullet",
        face: ["stubble", "tired"],
        hat: "beanie",
        hatColour: "moss",
        top: "hoodie",
        topColour: "charcoal",
        bottom: "tracksuit",
        bottomColour: "navy",
        shoes: "trainers",
        shoeColour: "grey",
        prop: "none",
        texture: "worn",
      },
      lines: ["..."],
    }),

  /** Two bags of shopping, one on each side, guarded with the ankles. */
  babciaSiatka: () =>
    createNpc({
      id: "babcia-siatka",
      name: "Babcia z siatką",
      build: "stout",
      height: "short",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "white",
        hairStyle: "bun",
        hat: "kerchief",
        hatColour: "wine",
        face: ["old", "glasses"],
        top: "coat",
        topColour: "plum",
        bottom: "skirt",
        bottomColour: "charcoal",
        shoes: "shoes",
        shoeColour: "black",
        accent: "shawl",
        accentColour: "cream",
        prop: "shopping",
        texture: "check",
      },
      lines: ["..."],
    }),

  /** Hood up, phone six inches from the face, headphones you can hear. */
  kapturek: () =>
    createNpc({
      id: "kapturek",
      name: "Chłopak w kapturze",
      build: "slim",
      height: "tall",
      doing: "leaning",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "crop",
        hat: "hood",
        hatColour: "charcoal",
        top: "hoodie",
        topColour: "charcoal",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "trainers",
        shoeColour: "white",
        accent: "backpack",
        accentColour: "moss",
        prop: "phone",
      },
      lines: ["..."],
    }),

  /** Site boots, hi-vis, and a beer he is being discreet about. */
  budowlaniec: () =>
    createNpc({
      id: "budowlaniec",
      name: "Budowlaniec",
      build: "stout",
      height: "tall",
      doing: "sitting",
      look: {
        skin: "tan",
        hair: "blond",
        hairStyle: "receding",
        face: ["stubble"],
        hat: "hardhat",
        hatColour: "mustard",
        top: "tshirt",
        topColour: "grey",
        bottom: "workpants",
        bottomColour: "moss",
        shoes: "boots",
        shoeColour: "brown",
        accent: "vest",
        accentColour: "mustard",
        prop: "bottle",
        texture: "worn",
      },
      lines: ["..."],
    }),

  /** Flowers held upright the whole way, so they arrive as flowers. */
  zKwiatami: () =>
    createNpc({
      id: "z-kwiatami",
      name: "Kobieta z kwiatami",
      build: "slim",
      height: "average",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "blond",
        hairStyle: "long",
        top: "coat",
        topColour: "sand",
        bottom: "skirt",
        bottomColour: "wine",
        shoes: "heels",
        shoeColour: "black",
        accent: "scarf",
        accentColour: "wine",
        prop: "flowers",
      },
      lines: ["..."],
    }),

  /** Reading a free paper cover to cover because it is free. */
  zGazeta: () =>
    createNpc({
      id: "z-gazeta",
      name: "Pan z gazetą",
      build: "regular",
      height: "average",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "grey",
        hairStyle: "receding",
        face: ["glasses", "moustache"],
        top: "jacket",
        topColour: "moss",
        bottom: "trousers",
        bottomColour: "brown",
        shoes: "shoes",
        shoeColour: "brown",
        prop: "newspaper",
        texture: "check",
      },
      lines: ["..."],
    }),

  /** Standing by the doors with an umbrella, two stops from home. */
  zParasolem: () =>
    createNpc({
      id: "z-parasolem",
      name: "Kobieta z parasolem",
      build: "regular",
      height: "short",
      doing: "waiting",
      look: {
        skin: "fair",
        hair: "brown",
        hairStyle: "bob",
        top: "coat",
        topColour: "slate",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "boots",
        shoeColour: "black",
        prop: "umbrella",
        propColour: "wine",
      },
      lines: ["..."],
    }),

  /** Student, going the other way, textbook she is not going to open. */
  studentka: () =>
    createNpc({
      id: "studentka",
      name: "Studentka",
      build: "slim",
      height: "average",
      doing: "sitting",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "ponytail",
        top: "jacket",
        topColour: "denim",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "trainers",
        shoeColour: "white",
        accent: "backpack",
        accentColour: "wine",
        prop: "phone",
      },
      lines: ["..."],
    }),

  /** Leaning on the pole by the gangway, keys already out. */
  zKluczami: () =>
    createNpc({
      id: "z-kluczami",
      name: "Pan z kluczami",
      build: "regular",
      height: "tall",
      doing: "leaning",
      look: {
        skin: "tan",
        hair: "brown",
        hairStyle: "short",
        face: ["stubble"],
        top: "jumper",
        topColour: "rust",
        bottom: "jeans",
        bottomColour: "slate",
        shoes: "shoes",
        shoeColour: "brown",
        prop: "keys",
      },
      lines: ["..."],
    }),
};

export const PASSENGER_IDS = Object.keys(PASSENGER_FACTORIES);

/**
 * Built on first access, like the rest of the cast. Thirteen rigs is about
 * 1.2 MB of frame data and none of it should be constructed to render the flat.
 */
export const PASSENGERS = lazyRegistry(PASSENGER_FACTORIES);
