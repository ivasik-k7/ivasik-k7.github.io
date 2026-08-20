import { createNpc, type NpcConfig } from "@/engine";
import { lazyRegistry } from "@/engine/sprite/lazyRegistry";

/**
 * The cast — everybody on the osiedle who is not Ivan.
 *
 * Each of them is a dozen lines because the builder owns the anatomy: you say
 * who they are and what they are doing, and it draws them. A new neighbour is
 * one entry in this file, not a new sprite sheet.
 *
 * The look choices are doing real work. Natalia's kerchief and apron say
 * "cleaner" before she says a word; Marek's hi-vis says he came from a shift;
 * the babcia's shawl and stoop say she has been on that bench since 1994. The
 * lines are theirs — Ukrainian for Natalia, Polish for everyone else, because
 * that is who lives here.
 */

const NPCS_FACTORIES: Record<string, () => NpcConfig> = {
  /** The stairwell, every morning. From Poltava, and homesick with it. */
  natalia: () =>
    createNpc({
      id: "pani-natalia",
      name: "Pani Natalia",
      build: "slim",
      height: "short",
      doing: "washing",
      look: {
        skin: "fair",
        hair: "grey",
        hairStyle: "bun",
        hat: "kerchief",
        hatColour: "sky",
        top: "jumper",
        topColour: "teal",
        bottom: "trousers",
        bottomColour: "navy",
        shoes: "boots",
        shoeColour: "black",
        accent: "apron",
        accentColour: "cream",
        prop: "mop",
      },
      lines: [
        "Знову хтось наслідив по свіжому...",
        "Вдома зараз абрикоси. А тут — сходи.",
        "Донечка дзвонила. Каже, все добре. Каже.",
        "Ще два поверхи, і чай.",
      ],
    }),

  /** By the Octavia, one cigarette into a bad week. */
  marek: () =>
    createNpc({
      id: "pan-marek",
      name: "Pan Marek",
      build: "stout",
      height: "short",
      doing: "smoking",
      look: {
        skin: "tan",
        hair: "grey",
        hairStyle: "receding",
        face: "moustache",
        top: "jacket",
        topColour: "charcoal",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "boots",
        shoeColour: "brown",
        accent: "vest",
        accentColour: "hiVis",
        prop: "cigarette",
      },
      lines: [
        "Kurwa, znowu ktoś zajął moje miejsce.",
        "Osiemnaście lat na tym parkingu. Osiemnaście.",
        "Zimą to auto wstaje gorzej niż ja.",
      ],
    }),

  /** The one outside the klatka, permanently quitting on Monday. */
  smoker: () =>
    createNpc({
      id: "smoker",
      name: "Sąsiad",
      build: "regular",
      height: "average",
      doing: "smoking",
      look: {
        skin: "fair",
        hair: "black",
        hairStyle: "crop",
        face: "stubble",
        top: "hoodie",
        topColour: "charcoal",
        bottom: "jeans",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "black",
        prop: "cigarette",
      },
      lines: ["Rzucam od poniedziałku.", "...Nie pytaj od którego.", "Ładny wieczór, nie?"],
    }),

  /** The bench by block 14 is hers, and the pigeons know it. */
  babcia: () =>
    createNpc({
      id: "babcia",
      name: "Babcia Krysia",
      build: "stout",
      height: "short",
      doing: "sitting",
      look: {
        skin: "pale",
        hair: "white",
        hairStyle: "bun",
        face: "old",
        hat: "kerchief",
        hatColour: "maroon",
        top: "coat",
        topColour: "plum",
        bottom: "skirt",
        bottomColour: "charcoal",
        shoes: "shoes",
        shoeColour: "black",
        accent: "shawl",
        accentColour: "grey",
        prop: "bag",
      },
      lines: [
        "Za moich czasów tu było pole.",
        "Ty jesteś ten z czternastki? Wysoki wyrosłeś.",
        "Nie karm ich chlebem. Kaszą.",
      ],
    }),

  /** Outside the shop, on the phone to somebody who is not listening either. */
  caller: () =>
    createNpc({
      id: "caller",
      name: "Sąsiad z telefonem",
      build: "regular",
      height: "average",
      doing: "phoning",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "receding",
        head: "square",
        brow: "heavy",
        nose: "hook",
        mouth: "set",
        face: "stubble",
        top: "jacket",
        topColour: "brick",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "shoes",
        shoeColour: "brown",
        propColour: "charcoal",
      },
      lines: [
        "...no i mówię jej: nie moja sprawa.",
        "Halo? Halo. Nic nie słychać.",
        "Dobra, oddzwonię. Oddzwonię!",
      ],
    }),

  /** Żabka, night shift, philosophical about it. */
  zbyszek: () =>
    createNpc({
      id: "zbyszek",
      name: "Pan Zbyszek",
      build: "regular",
      height: "short",
      doing: "waiting",
      look: {
        skin: "fair",
        hair: "grey",
        hairStyle: "receding",
        top: "shirt",
        topColour: "green",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "shoes",
        shoeColour: "black",
        accent: "lanyard",
        accentColour: "green",
      },
      lines: ["Kawa czy energetyk? Bo to różne filozofie.", "O tej porze to już tylko my dwaj."],
    }),

  /** The cellar gym, four decades of squats, one opinion about your hips. */
  trener: () =>
    createNpc({
      id: "trener",
      name: "Trener",
      build: "stout",
      height: "short",
      doing: "standing",
      look: {
        skin: "tan",
        hair: "grey",
        hairStyle: "crop",
        face: "moustache",
        hat: "cap",
        hatColour: "navy",
        top: "tracksuit",
        topColour: "teal",
        bottom: "tracksuit",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "white",
        accent: "lanyard",
        accentColour: "mustard",
        prop: "clipboard",
      },
      lines: [
        "Plecy proste. Zawsze proste.",
        "Ta gira jest starsza od ciebie i nigdy nie narzekała.",
        "Odpoczynek to część serii. Nie wstyd.",
      ],
    }),

  /** The square, with a bag of kasza and a full census of the pigeons. */
  golebiarka: () =>
    createNpc({
      id: "golebiarka",
      name: "Pani Gołębiarka",
      build: "slim",
      height: "short",
      doing: "standing",
      look: {
        skin: "pale",
        hair: "white",
        hairStyle: "bun",
        face: "old",
        hat: "kerchief",
        hatColour: "plum",
        top: "coat",
        topColour: "olive",
        bottom: "skirt",
        bottomColour: "brown",
        shoes: "boots",
        shoeColour: "black",
        accent: "scarf",
        accentColour: "maroon",
        prop: "shopping",
      },
      lines: ["Ten siwy to Zbyszek. Po prezesie.", "Gołąb wszystko widzi. Dlatego tak patrzy."],
    }),

  /** InPost, a hundred and twenty parcels, four hours left. */
  courier: () =>
    createNpc({
      id: "courier",
      name: "Kurier",
      build: "regular",
      height: "short",
      doing: "walking",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "crop",
        hat: "cap",
        hatColour: "mustard",
        top: "jacket",
        topColour: "mustard",
        bottom: "workpants",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "black",
        accent: "backpack",
        accentColour: "charcoal",
        prop: "shopping",
      },
      lines: ["Kovtun? Nie? To nie podpisujesz.", "Apka mówi, że dam radę."],
    }),

  /** Żabka at 2am, sesja, energy drinks, unshakeable optimism. */
  student: () =>
    createNpc({
      id: "student",
      name: "Student",
      build: "slim",
      height: "average",
      doing: "standing",
      look: {
        skin: "fair",
        hair: "chestnut",
        hairStyle: "curly",
        top: "hoodie",
        topColour: "maroon",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "trainers",
        shoeColour: "white",
        accent: "backpack",
        accentColour: "forest",
        prop: "phone",
      },
      lines: ["Kolokwium o ósmej.", "Spanie jest dla ludzi po sesji."],
    }),

  /** Waiting outside the shop for someone who said two minutes. */
  waiting: () =>
    createNpc({
      id: "waiting-man",
      name: "Czekający",
      build: "regular",
      height: "short",
      doing: "waiting",
      look: {
        skin: "tan",
        hair: "brown",
        hairStyle: "short",
        face: "stubble",
        top: "shirt",
        topColour: "navy",
        bottom: "trousers",
        bottomColour: "grey",
        shoes: "shoes",
        shoeColour: "brown",
        accent: "tie",
        accentColour: "maroon",
      },
      lines: ["Czekam na żonę. Dwie minuty, powiedziała.", "Czterdzieści minut temu."],
    }),
  /** Behind the Żabka counter at whatever hour you turn up. */
  clerk: () =>
    createNpc({
      id: "zabka-clerk",
      name: "Pani z Żabki",
      build: "regular",
      height: "short",
      doing: "serving",
      look: {
        skin: "fair",
        hair: "chestnut",
        hairStyle: "ponytail",
        top: "shirt",
        topColour: "green",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "white",
        accent: "lanyard",
        accentColour: "white",
      },
      lines: ["Dzień dobry. Reklamówka?", "Kawa dziś dobrze idzie.", "Paragon w środku."],
    }),

  /** Somebody in front of you in the queue, deciding. */
  shopper: () =>
    createNpc({
      id: "zabka-customer",
      name: "Klient",
      build: "slim",
      height: "short",
      doing: "waiting",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "undercut",
        top: "hoodie",
        topColour: "navy",
        texture: "worn",
        bottom: "jeans",
        bottomColour: "denim",
        shoes: "trainers",
        shoeColour: "grey",
        prop: "shopping",
      },
      lines: ["...a jednak wezmę tę drugą.", "Zaraz, gdzie ja mam kartę."],
    }),

  /** Reception at the gym: a fob, a smile, and the playlist is hers. */
  kasia: () =>
    createNpc({
      id: "gym-kasia",
      name: "Kasia",
      build: "slim",
      height: "short",
      doing: "serving",
      look: {
        skin: "fair",
        hair: "blond",
        hairStyle: "ponytail",
        top: "tshirt",
        topColour: "black",
        bottom: "tracksuit",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "white",
        accent: "lanyard",
        accentColour: "red",
      },
      lines: ["Karnet poproszę.", "Szatnia po prawej.", "Playlista moja, uprzedzam."],
    }),

  /** Treadmill two, twenty minutes in, watching the street go past. */
  runner: () =>
    createNpc({
      id: "gym-runner",
      name: "Biegacz",
      build: "slim",
      height: "average",
      doing: "running",
      look: {
        skin: "tan",
        hair: "black",
        hairStyle: "crop",
        top: "tank",
        topColour: "sky",
        bottom: "shorts",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "red",
      },
      lines: ["...", "Jeszcze dwa kilometry."],
    }),

  /** Under the rack, between sets, considering the universe. */
  lifter: () =>
    createNpc({
      id: "gym-lifter",
      name: "Pakerz",
      build: "stout",
      height: "short",
      doing: "lifting",
      look: {
        skin: "tan",
        hair: "brown",
        hairStyle: "shaved",
        face: "beard",
        top: "tank",
        topColour: "maroon",
        bottom: "shorts",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "black",
        accent: "belt",
        accentColour: "brown",
      },
      lines: ["Jeszcze jedna.", "Oddychaj, to połowa roboty."],
    }),

  /** Café Orbita, behind the machine, one eye on the queue. */
  barista: () =>
    createNpc({
      id: "cafe-barista",
      name: "Barista",
      build: "slim",
      height: "short",
      doing: "serving",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "topknot",
        face: "stubble",
        top: "shirt",
        topColour: "denim",
        texture: "check",
        bottom: "jeans",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "white",
        accent: "apron",
        accentColour: "charcoal",
      },
      lines: ["Flat white? Zaraz będzie.", "Ziarno dziś etiopskie.", "Na miejscu czy na wynos?"],
    }),

  /** Somebody crossing the square who has somewhere to be. */
  walker: () =>
    createNpc({
      id: "district-walker",
      name: "Przechodzień",
      build: "regular",
      height: "short",
      doing: "walking",
      look: {
        skin: "pale",
        hair: "brown",
        hairStyle: "curtains",
        top: "coat",
        topColour: "olive",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "shoes",
        shoeColour: "brown",
        accent: "scarf",
        accentColour: "maroon",
        prop: "umbrella",
      },
      lines: ["Przepraszam.", "Zimno dziś, nie?"],
    }),
};

/**
 * Built on first access, not on import. Eighteen rigs is 0.4 s of frame
 * assembly and the flat needs one of them; the rest arrive as the player
 * walks into the scenes they live in.
 */
export const NPCS: Record<string, NpcConfig> = lazyRegistry(NPCS_FACTORIES);

/** Every id in the cast, without building anybody. */
export const NPC_IDS = Object.keys(NPCS_FACTORIES);
