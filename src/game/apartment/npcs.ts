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

  /* --- Ulica Elektryków: the night shift ---------------------------------- */

  /** The door. Calm the way only very large men are calm. */
  bramkarz: () =>
    createNpc({
      id: "bramkarz",
      name: "Bramkarz",
      build: "stout",
      height: "tall",
      doing: "standing",
      look: {
        skin: "tan",
        hair: "black",
        hairStyle: "shaved",
        face: "beard",
        top: "jacket",
        topColour: "black",
        bottom: "trousers",
        bottomColour: "black",
        shoes: "boots",
        shoeColour: "black",
        accent: "lanyard",
        accentColour: "red",
      },
      lines: ["Spokojnie, wszyscy wejdą.", "Butelki zostają na zewnątrz.", "Dokumencik?"],
    }),

  /** The container bar's hatch, one winter per tattoo. */
  barmanka: () =>
    createNpc({
      id: "barmanka",
      name: "Barmanka",
      build: "slim",
      height: "average",
      doing: "serving",
      look: {
        skin: "fair",
        hair: "bleach",
        hairStyle: "undercut",
        top: "tshirt",
        topColour: "black",
        bottom: "jeans",
        bottomColour: "charcoal",
        shoes: "boots",
        shoeColour: "black",
        accent: "apron",
        accentColour: "charcoal",
      },
      lines: ["Grzaniec, piwo, woda. Reszta to marzenia.", "Kubek zwrotny! Kaucja!"],
    }),

  /** The frytki trailer. He has opinions about oil and they are correct. */
  frytkarz: () =>
    createNpc({
      id: "frytkarz",
      name: "Frytkarz",
      build: "stout",
      height: "short",
      doing: "serving",
      look: {
        skin: "ruddy",
        hair: "grey",
        hairStyle: "receding",
        face: "moustache",
        hat: "cap",
        hatColour: "white",
        top: "tshirt",
        topColour: "white",
        bottom: "workpants",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "black",
        accent: "apron",
        accentColour: "red",
      },
      lines: ["Świeży olej!", "Sól? Zawsze sól. Pytanie retoryczne."],
    }),

  /** Front of the queue, dressed for the room she has not entered yet. */
  raverka: () =>
    createNpc({
      id: "queue-girl",
      name: "Dziewczyna z kolejki",
      build: "slim",
      height: "average",
      doing: "waiting",
      look: {
        skin: "pale",
        hair: "black",
        hairStyle: "bob",
        top: "tank",
        topColour: "black",
        bottom: "shorts",
        bottomColour: "black",
        shoes: "boots",
        shoeColour: "black",
        accent: "scarf",
        accentColour: "pink",
        prop: "phone",
      },
      lines: ["Mówią, że selekcja ostra.", "Czuję bas w barierce. Dobry znak."],
    }),

  /** Holding up hall A with one shoulder and the discourse with the other. */
  filozof: () =>
    createNpc({
      id: "filozof",
      name: "Filozof",
      build: "regular",
      height: "average",
      doing: "leaning",
      look: {
        skin: "sallow",
        hair: "brown",
        hairStyle: "long",
        face: "stubble",
        top: "coat",
        topColour: "olive",
        bottom: "jeans",
        bottomColour: "black",
        shoes: "boots",
        shoeColour: "brown",
        prop: "bottle",
      },
      lines: [
        "Kiedyś tu spawali statki.",
        "To nie upadek przemysłu. To zmiana zmiany.",
        "Ściana sama się nie podeprze.",
      ],
    }),

  /** Six centimetres from the brickwork, studying it. He is fine. Probably. */
  starer: () =>
    createNpc({
      id: "starer",
      name: "Ten Gość",
      build: "slim",
      height: "tall",
      doing: "standing",
      look: {
        skin: "pale",
        hair: "ginger",
        hairStyle: "crop",
        top: "tshirt",
        topColour: "lilac",
        bottom: "trousers",
        bottomColour: "charcoal",
        shoes: "trainers",
        shoeColour: "white",
      },
      lines: ["...", "Ta cegła. Ta konkretna cegła.", "Wszystko się zgadza."],
    }),

  /** Doing the bar–club circuit. Again. There might be someone by the door. */
  spacer: () =>
    createNpc({
      id: "spacer",
      name: "Krążący",
      build: "regular",
      height: "average",
      doing: "walking",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "topknot",
        top: "shirt",
        topColour: "wine",
        texture: "check",
        bottom: "jeans",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "white",
      },
      lines: ["Zaraz wracam.", "Widziałeś może Kaśkę?"],
    }),

  /** Between the frytki and the gap, deciding between the frytki and the gap. */
  spacerka: () =>
    createNpc({
      id: "spacerka",
      name: "Krążąca",
      build: "slim",
      height: "short",
      doing: "walking",
      look: {
        skin: "fair",
        hair: "chestnut",
        hairStyle: "ponytail",
        top: "hoodie",
        topColour: "plum",
        bottom: "tracksuit",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "pink",
        prop: "coffee",
      },
      lines: ["Frytki czy jeszcze nie frytki...", "Zimno. Ale dobrze."],
    }),

  /* --- inside Turbina ------------------------------------------------------ */

  /** Behind the decks. Do not ask. He will not play it. */
  didzej: () =>
    createNpc({
      id: "dj-booth",
      name: "DJ",
      build: "regular",
      height: "average",
      doing: "working",
      look: {
        skin: "tan",
        hair: "black",
        hairStyle: "shaved",
        face: "beard",
        top: "tshirt",
        topColour: "black",
        bottom: "jeans",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "black",
        accent: "lanyard",
        accentColour: "charcoal",
      },
      lines: ["...", "Nie zagram. Niczego nie zagram."],
    }),

  /** The club bar. Has seen everything twice and poured water on most of it. */
  klubowy: () =>
    createNpc({
      id: "club-bar",
      name: "Barman",
      build: "slim",
      height: "tall",
      doing: "serving",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "short",
        face: "stubble",
        top: "shirt",
        topColour: "black",
        bottom: "trousers",
        bottomColour: "black",
        shoes: "shoes",
        shoeColour: "black",
        accent: "vest",
        accentColour: "charcoal",
      },
      lines: ["Woda darmowa. Kranówa.", "Karty zamykam o trzeciej. Doświadczenie."],
    }),

  /** On the sofa, heels in hand, negotiating with gravity. Winning, slowly. */
  zmeczona: () =>
    createNpc({
      id: "tired-girl",
      name: "Zmęczona",
      build: "slim",
      height: "short",
      doing: "sitting",
      look: {
        skin: "fair",
        hair: "blond",
        hairStyle: "long",
        top: "tshirt",
        topColour: "wine",
        bottom: "trousers",
        bottomColour: "black",
        shoes: "heels",
        shoeColour: "black",
      },
      lines: ["Sekundę siedzę. Sekundę.", "Nie mów która godzina."],
    }),

  /** Half of the couple by the bar — mid-thesis, drink as a pointer. */
  ola: () =>
    createNpc({
      id: "club-couple",
      name: "Ola",
      build: "slim",
      height: "average",
      doing: "standing",
      look: {
        skin: "olive",
        hair: "black",
        hairStyle: "fringe",
        top: "tank",
        topColour: "charcoal",
        bottom: "trousers",
        bottomColour: "black",
        shoes: "boots",
        shoeColour: "black",
        accent: "scarf",
        accentColour: "pink",
        prop: "bottle",
      },
      lines: ["To NIE jest ten sam set co w lipcu.", "Słuchaj basu, nie mnie."],
    }),

  /** The other half — losing the debate, enjoying the loss. */
  kuba: () =>
    createNpc({
      id: "club-kuba",
      name: "Kuba",
      build: "regular",
      height: "tall",
      doing: "leaning",
      look: {
        skin: "fair",
        hair: "brown",
        hairStyle: "curtains",
        face: "stubble",
        top: "tshirt",
        topColour: "white",
        bottom: "jeans",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "white",
      },
      lines: ["Dobra, dobra. Ten sam.", "W lipcu było wolniej. O dwa BPM."],
    }),

  /** Sixth in a queue of four. The WC has its own physics. */
  wcQueue: () =>
    createNpc({
      id: "wc-queue",
      name: "Kolejka do WC",
      build: "slim",
      height: "short",
      doing: "waiting",
      look: {
        skin: "pale",
        hair: "chestnut",
        hairStyle: "bob",
        top: "tshirt",
        topColour: "lilac",
        bottom: "shorts",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "white",
        prop: "phone",
      },
      lines: ["Pięć minut. Standard.", "Ktoś tam mieszka. Na pewno ktoś tam mieszka."],
    }),

  /** By the door, one finger in one ear, physics doing the rest. */
  klubowyCaller: () =>
    createNpc({
      id: "club-caller",
      name: "Człowiek z telefonem",
      build: "regular",
      height: "average",
      doing: "phoning",
      look: {
        skin: "tan",
        hair: "black",
        hairStyle: "topknot",
        top: "shirt",
        topColour: "wine",
        bottom: "jeans",
        bottomColour: "black",
        shoes: "trainers",
        shoeColour: "black",
      },
      lines: ["ALO? ALO. NIE SŁYSZĘ!", "JESTEM W TURBINIE! W TUR-BI-NIE!"],
    }),

  /** Cables in the morning: the man the whole rig actually belongs to. */
  technik: () =>
    createNpc({
      id: "club-technik",
      name: "Technik",
      build: "stout",
      height: "average",
      doing: "working",
      look: {
        skin: "ruddy",
        hair: "grey",
        hairStyle: "receding",
        face: "stubble",
        top: "tshirt",
        topColour: "black",
        bottom: "workpants",
        bottomColour: "charcoal",
        shoes: "boots",
        shoeColour: "black",
        accent: "belt",
        accentColour: "brown",
      },
      lines: ["Osiem zwojów. Zawsze osiem.", "Kto tak zwinął ten kabel? Kto?"],
    }),

  /** The morning after belongs to her and the broom. It always has. */
  sprzataczka: () =>
    createNpc({
      id: "club-cleaner",
      name: "Pani Sprzątająca",
      build: "regular",
      height: "short",
      doing: "washing",
      look: {
        skin: "tan",
        hair: "grey",
        hairStyle: "bun",
        hat: "kerchief",
        hatColour: "navy",
        top: "jumper",
        topColour: "grey",
        bottom: "trousers",
        bottomColour: "navy",
        shoes: "boots",
        shoeColour: "black",
        accent: "apron",
        accentColour: "sky",
        prop: "broom",
      },
      lines: ["Brokat. Wszędzie brokat.", "Kto tańczy, ten nie śmieci. Teoretycznie."],
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
