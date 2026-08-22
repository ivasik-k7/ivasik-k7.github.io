import { defineTree, playSfx } from "@/engine";
import { learn, npcMemory } from "@/engine/systems/memory";
import type { WorldState } from "@/lib/worldState";
import { buy, canAfford } from "./commerce";
import type { Ctx } from "./types";

/** Ulica Elektryków: the people of the night shift. */

/**
 * The bouncer. The joke every real bouncer is in on: total, unhurried calm.
 * Nothing the player says raises his pulse, and the one thing that gets a full
 * sentence out of him is the cranes, because his grandfather painted them.
 */
export const BRAMKARZ = defineTree<Ctx>(
  "bramkarz",
  { npc: "bramkarz" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "bramkarz");
      const node = !m.met() ? "start" : "hello";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [{ speaker: "Bramkarz", text: "Dobry. Spokojnie, wszyscy wejdą.", mood: "neutral" }],
        next: "hub",
      },
      hello: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Bramkarz",
                text: "Znowu ty. Dobrze. Znajome twarze licza sie za pol osoby.",
                mood: "neutral",
              },
            ],
          },
          {
            lines: [
              { speaker: "Bramkarz", text: "Dobry. Kolejka tam, spokoj tutaj.", mood: "neutral" },
            ],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He stands the way the hall stands. Load-bearing." }],
        topics: true,
        choices: [
          {
            id: "brm-queue",
            label: "Duża kolejka dzisiaj?",
            next: "queue",
            againNext: "queueAgain",
          },
          {
            id: "brm-place",
            label: "Co to za miejsce w ogóle?",
            next: "place",
            againNext: "placeAgain",
          },
          { label: "To ja wchodzę.", next: "bye" },
        ],
      },
      queue: {
        lines: [
          { speaker: "Bramkarz", text: "Normalna. W sobotę stoi do rogu.", mood: "neutral" },
          {
            speaker: "Bramkarz",
            text: "Ludzie myślą, że selekcja. A ja po prostu liczę do stu dwudziestu. Przepisy przeciwpożarowe.",
            mood: "amused",
          },
        ],
        next: "hub",
      },
      queueAgain: {
        lines: [
          {
            speaker: "Bramkarz",
            text: "Ta sama co pięć minut temu. Kolejki nie rosną od pytania.",
            mood: "neutral",
          },
        ],
        next: "hub",
      },
      place: {
        lines: [
          {
            speaker: "Bramkarz",
            text: "Hala numer dwa. Dziadek malował te dźwigi, co tam stoją. Minię, przeciw rdzy.",
            mood: "warm",
          },
          {
            speaker: "Bramkarz",
            text: "Teraz ja pilnuję drzwi do jego hali. Jakby wiedział, to by się śmiał. Albo nie.",
            mood: "sad",
          },
        ],
        // what he told you travels: the cranes read differently now
        onEnter: (ctx) => learn(ctx, "cranes.minia"),
        interjections: [
          {
            id: "int-bramkarz-minia",
            text: "Minia, against the rust. Somebody's grandfather is the reason they're still standing.",
            once: true,
          },
        ],
        next: "hub",
      },
      placeAgain: {
        lines: [
          {
            speaker: "Bramkarz",
            text: "Mówiłem. Hala dwa. Historia się nie zmienia od powtarzania.",
            mood: "neutral",
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Bramkarz", text: "Butelka zostaje. Miłej nocy.", mood: "neutral" }],
      },
    },
  },
);

/** Front of the queue, an authority on rooms she has not entered yet. */
export const QUEUE_GIRL = defineTree<Ctx>(
  "queue-girl",
  { npc: "queue-girl" },
  {
    start: (ctx) => {
      npcMemory(ctx, "queue-girl").visit();
      return "start";
    },
    nodes: {
      start: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Dziewczyna z kolejki",
                text: "Słyszysz? Jak barierka drga, to znaczy że gra dobry. Fizyka.",
                mood: "warm",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Dziewczyna z kolejki",
                text: "Dalej stoimy. Barierka drga mocniej. Nauka nie kłamie.",
                mood: "amused",
              },
            ],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "The queue shuffles one philosophical centimeter." }],
        topics: true,
        choices: [
          { id: "qgl-long", label: "Długo stoicie?", next: "long", againNext: "longAgain" },
          { id: "qgl-who", label: "Kto dzisiaj gra?", next: "who", againNext: "whoAgain" },
          { label: "Powodzenia na bramce.", next: "bye" },
        ],
      },
      long: {
        lines: [
          {
            speaker: "Dziewczyna z kolejki",
            text: "Dwadzieścia minut. Ale w kolejce na Elektryków czas liczy się inaczej. Jak w saunie.",
            mood: "amused",
          },
        ],
        next: "hub",
      },
      longAgain: {
        lines: [
          {
            speaker: "Dziewczyna z kolejki",
            text: "Plus te pięć minut, co gadamy. Wliczam ci je.",
            mood: "amused",
          },
        ],
        next: "hub",
      },
      who: {
        lines: [
          {
            speaker: "Dziewczyna z kolejki",
            text: "Ktoś z Berlina. Albo z Gdyni. Na plakacie było małymi literami, a duże to była data.",
            mood: "amused",
          },
        ],
        next: "hub",
      },
      whoAgain: {
        lines: [
          {
            speaker: "Dziewczyna z kolejki",
            text: "Dalej nie wiem. Ale już go lubię. Tak działa kolejka.",
            mood: "warm",
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [
          { speaker: "Dziewczyna z kolejki", text: "Do zobaczenia w środku. Albo na frytkach." },
        ],
      },
    },
  },
);

/** Holding up hall A. Two beers into the philosophy of post-industry. */
export const FILOZOF = defineTree<Ctx>(
  "filozof",
  { npc: "filozof" },
  {
    start: (ctx) => {
      npcMemory(ctx, "filozof").visit();
      return "start";
    },
    nodes: {
      start: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Filozof",
                text: "Patrz. Sto lat temu tu się spawało kadłuby. A teraz co? Teraz się spawamy my.",
                mood: "neutral",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Filozof",
                text: "O, wróciłeś. Ściana stoi, teza stoi. Wszystko stoi oprócz stoczni.",
                mood: "warm",
              },
            ],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He recalibrates his lean by a degree." }],
        topics: true,
        choices: [
          { id: "fil-deep", label: "Głębokie.", next: "deep", againNext: "deepAgain" },
          { id: "fil-work", label: "Pracowałeś tu?", next: "work", againNext: "workAgain" },
          { label: "Trzymaj się ściany.", next: "bye" },
        ],
      },
      deep: {
        lines: [
          {
            speaker: "Filozof",
            text: "Nie moje. Z muralu. Ale mural mówi prawdę.",
            mood: "amused",
          },
          {
            speaker: "Filozof",
            text: "Wszystko tu mówi prawdę po drugim piwie. Po czwartym zaczyna kłamać.",
            mood: "warm",
          },
        ],
        next: "hub",
      },
      deepAgain: {
        lines: [
          {
            speaker: "Filozof",
            text: "Głębokie było za pierwszym razem. Teraz to już fundament.",
            mood: "amused",
          },
        ],
        next: "hub",
      },
      work: {
        lines: [
          {
            speaker: "Filozof",
            text: "Ojciec. Wydział elektryczny, W-cztery. Tam, gdzie napis.",
            mood: "sad",
          },
          {
            speaker: "Filozof",
            text: "Mówił: synu, prąd jest jak rzeka. Ja robię w IT. Też rzeka, tylko zimniejsza.",
            mood: "neutral",
          },
        ],
        next: "hub",
      },
      workAgain: {
        lines: [
          {
            speaker: "Filozof",
            text: "Ojciec, W-cztery. Nie pytaj trzeci raz, bo się wzruszę.",
            mood: "sad",
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Filozof", text: "Ściana i ja mamy umowę. Idź, idź." }],
      },
    },
  },
);

/**
 * The man studying the brickwork from six centimetres. The rule of this tree:
 * he is never explained. He is having a completely coherent experience that
 * the player is simply not equipped to share, and both of them are fine.
 */
export const STARER = defineTree<Ctx>(
  "starer",
  { npc: "starer" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: "He is very close to the wall. He does not turn around." },
          { speaker: "Ten Gość", text: "Widzisz to?", mood: "neutral" },
        ],
        choices: [
          { label: "Widzę... cegłę.", next: "brick" },
          { label: "Wszystko w porządku?", next: "ok" },
          { label: "Back away slowly.", next: "bye" },
        ],
      },
      brick: {
        lines: [
          { speaker: "Ten Gość", text: "Nie tę. Tę obok.", mood: "neutral" },
          {
            text: "You look at the one beside it. It is, in every measurable way, an identical brick.",
          },
          { speaker: "Ten Gość", text: "No właśnie.", mood: "warm" },
        ],
        next: "bye2",
      },
      ok: {
        lines: [
          { speaker: "Ten Gość", text: "W najlepszym. Wszystko się zgadza.", mood: "warm" },
          { text: "He says it with the deep peace of a man whose accounts have finally balanced." },
        ],
        next: "bye2",
      },
      bye: {
        lines: [{ text: "You back away. He does not notice. The brick has him now." }],
      },
      bye2: {
        lines: [{ text: "You leave him to it. Somewhere in there is a very good night out." }],
      },
    },
  },
);

/** The container bar: mulled wine in a returnable cup, and the deposit saga. */
export function buildBarmankaTree(world: WorldState) {
  const buys = [
    {
      label: "Grzaniec. (15 zł)",
      next: canAfford(15),
      effect: (ctx: Ctx) => buy(ctx, "grzaniec", 15),
    },
    {
      label: "Piwo z kranu. (12 zł)",
      next: canAfford(12),
      effect: (ctx: Ctx) => buy(ctx, "beer", 12),
    },
    {
      label: "Woda. (6 zł)",
      next: canAfford(6),
      effect: (ctx: Ctx) => buy(ctx, "water", 6),
    },
    { label: "Nic, tylko się grzeję.", next: "bye" },
  ];
  return defineTree<Ctx>(
    "barmanka",
    { npc: "barmanka" },
    {
      start: "start",
      nodes: {
        start: {
          lines: [
            { text: `You have ${world.money} zł on you.` },
            {
              speaker: "Barmanka",
              text: "No? Grzaniec się kończy, mówię od razu.",
              mood: "neutral",
            },
          ],
          choices: buys,
        },
        "sold-15": {
          lines: [
            {
              speaker: "Barmanka",
              text: "Kubek zwrotny. Oddasz — dostaniesz piątaka. Nie oddasz — masz pamiątkę.",
              mood: "amused",
            },
          ],
          next: "more",
        },
        "sold-12": {
          lines: [{ speaker: "Barmanka", text: "Z pianą, bo umiem. Na zdrowie.", mood: "warm" }],
          next: "more",
        },
        "sold-6": {
          lines: [
            {
              speaker: "Barmanka",
              text: "Woda. Szanuję. Ktoś tu jeszcze planuje jutro.",
              mood: "amused",
            },
          ],
          next: "more",
        },
        short: {
          lines: [
            {
              speaker: "Barmanka",
              text: "Brakuje ci. Bankomat jest... nigdzie. Nie ma bankomatu. Witaj na stoczni.",
              mood: "amused",
            },
          ],
          next: "more",
        },
        more: {
          lines: [{ speaker: "Barmanka", text: "Coś jeszcze?" }],
          choices: buys,
        },
        bye: {
          lines: [{ speaker: "Barmanka", text: "Grzej się, grzej. Od tego jest kontener." }],
        },
      },
    },
  );
}

/** The frytki window. There is one menu item and a doctrine around it. */
export function buildFrytkarzTree(world: WorldState) {
  return defineTree<Ctx>(
    "frytkarz",
    { npc: "frytkarz" },
    {
      start: "start",
      nodes: {
        start: {
          lines: [
            { text: `You have ${world.money} zł on you.` },
            {
              speaker: "Frytkarz",
              text: "Frytki. Duże. Innych nie ma, małe to porażka.",
              mood: "neutral",
            },
          ],
          choices: [
            {
              label: "Duże frytki. (14 zł)",
              next: (ctx: Ctx) => (ctx.world.money >= 14 ? "sold" : "short"),
              effect: (ctx: Ctx) => {
                if (ctx.world.money < 14) return;
                playSfx("register");
                ctx.updateWorld((w) => ({ ...w, money: w.money - 14 }));
                ctx.startAction("hotdog");
              },
            },
            { label: "Majonez czy ketchup?", next: "sauce" },
            { label: "Może później.", next: "bye" },
          ],
        },
        sold: {
          lines: [
            {
              speaker: "Frytkarz",
              text: "Sól już jest. Sól jest zawsze. Pytanie było retoryczne.",
              mood: "amused",
            },
            {
              text: "They are too hot to eat and you eat them anyway, which is the whole point of frytki at night.",
            },
          ],
        },
        sauce: {
          lines: [
            { speaker: "Frytkarz", text: "Tak.", mood: "neutral" },
            {
              text: "You wait for more. There is no more. There is clearly a right answer and he is watching you find it.",
            },
          ],
          next: "start",
        },
        short: {
          lines: [
            {
              speaker: "Frytkarz",
              text: "Czternaście. Masz mniej. Wróć bogatszy albo głodniejszy, jedno z dwóch pomaga.",
              mood: "amused",
            },
          ],
        },
        bye: {
          lines: [{ speaker: "Frytkarz", text: "Będziesz. O drugiej wszyscy są." }],
        },
      },
    },
  );
}

export const TREES = {
  bramkarz: BRAMKARZ,
  "queue-girl": QUEUE_GIRL,
  filozof: FILOZOF,
  starer: STARER,
};
