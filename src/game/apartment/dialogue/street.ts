import { defineTree } from "@/engine";
import { knows, learn, npcMemory } from "@/engine/systems/memory";
import type { Ctx } from "./types";

/** The street's regulars. Shared with the SKM platform on purpose: the same
 * people commute, and being recognized somewhere else is the whole point. */

export const SMOKER = defineTree<Ctx>(
  "smoker",
  { npc: "smoker" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "smoker");
      const node = !m.met() ? "start" : m.minutesSince() < 4 ? "again" : "hello";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          { speaker: "Smoker", text: "Ej. Sąsiad z czternastki, nie? Ognia nie trzeba, mam." },
        ],
        next: "hub",
      },
      hello: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          { lines: [{ speaker: "Smoker", text: "O, sąsiad. Ta jedna, ostatnia. Jak zawsze." }] },
          { lines: [{ speaker: "Smoker", text: "Cześć. Stoję, oddycham. Po swojemu." }] },
        ],
        next: "hub",
      },
      again: {
        lines: [{ speaker: "Smoker", text: "No co. Jeszcze się tli. Wracaj za dwie minuty." }],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He taps the ash with a craftsman's precision." }],
        topics: true,
        choices: [
          { id: "smk-day", label: "Ciężki dzień?", next: "day", againNext: "dayAgain" },
          {
            id: "smk-health",
            label: "Szkodzi zdrowiu, wiesz.",
            next: "health",
            againNext: "healthAgain",
          },
          { label: "Trzymaj się.", next: "bye" },
        ],
      },
      day: {
        lines: [
          {
            speaker: "Smoker",
            text: "Normalny. Osiem godzin magazynu, godzina w korku. Ta jedna tutaj to moja własna.",
          },
        ],
        next: "hub",
      },
      dayAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Smoker",
                text: "Taki sam jak wtedy, jak pytałeś. Magazyn się nie zmienia.",
              },
            ],
          },
          { lines: [{ speaker: "Smoker", text: "Ciężki. Następne pytanie." }] },
        ],
        next: "hub",
      },
      health: {
        lines: [
          { speaker: "Smoker", text: "Wiem. Rzucam od poniedziałku." },
          { speaker: "Smoker", text: "...Nie pytaj od którego." },
        ],
        next: "hub",
      },
      healthAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          { lines: [{ speaker: "Smoker", text: "Mówiłem. Od poniedziałku." }] },
          {
            lines: [
              {
                speaker: "Smoker",
                text: "Poniedziałek był. Doszedłem do środy. Środa to już coś.",
              },
            ],
          },
          {
            lines: [
              { text: "He looks at you. He looks at the cigarette. He taps the ash." },
              { text: "Some conversations are complete without words.", voice: "inner" },
            ],
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Smoker", text: "No. Pozdrów windę, jak działa." }],
      },
    },
  },
);

export const BABCIA = defineTree<Ctx>(
  "babcia",
  { npc: "babcia" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "babcia");
      const node = !m.met() ? "start" : "hello";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          {
            speaker: "Babcia Krysia",
            text: "Siadaj, siadaj. Ławka duża, a plotki jeszcze większe.",
          },
        ],
        next: "hub",
      },
      hello: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Babcia Krysia",
                text: "O, jesteś. Siadaj, właśnie miałam nikomu nie mówić jednej rzeczy.",
              },
            ],
          },
          {
            lines: [{ speaker: "Babcia Krysia", text: "Siadaj. Kefir się grzeje, plotki stygną." }],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "She pats the bench. The bench has heard everything." }],
        topics: true,
        choices: [
          {
            id: "bab-gossip",
            label: "Co słychać na osiedlu?",
            next: "gossip",
            againNext: "gossipAgain",
          },
          { id: "bab-bag", label: "Ciężka ta torba?", next: "bag", againNext: "bagAgain" },
          { label: "Miłego dnia, pani Krysiu.", next: "bye" },
        ],
      },
      gossip: {
        lines: [
          {
            speaker: "Babcia Krysia",
            text: "Z trzynastki bliźniaki nie śpią. Z piętnastki cisza — podejrzane.",
          },
          {
            speaker: "Babcia Krysia",
            text: "A ten z kapturem? Dobry chłopak. Śmieci mi wynosi. Tylko pali jak komin.",
          },
        ],
        next: "hub",
      },
      gossipAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Babcia Krysia",
                text: "Od rana nic nowego. Ale dzień młody, ludzie starzy — coś będzie.",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Babcia Krysia",
                text: "Jakbyś tak często sprzątał, jak pytasz o plotki...",
              },
            ],
          },
        ],
        next: "hub",
      },
      bag: {
        lines: [
          {
            speaker: "Babcia Krysia",
            text: "Kartofle, kefir i chleb. Pół życia w jednej siatce, panie.",
          },
        ],
        next: "hub",
      },
      bagAgain: {
        lines: [
          { speaker: "Babcia Krysia", text: "Ta sama torba co wczoraj. Cięższa o jeden dzień." },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Babcia Krysia", text: "Idź, idź. I czapkę noś, bo wieje." }],
      },
    },
  },
);

export const ZBYSZEK = defineTree<Ctx>(
  "zbyszek",
  { npc: "zbyszek" },
  {
    start: (ctx) => {
      npcMemory(ctx, "zbyszek").visit();
      // the gołębiarka named her pigeon after "the Zbyszek" — if she told you,
      // he has heard about it, believe him
      return knows(ctx, "street.zbyszek-pigeon") && !npcMemory(ctx, "zbyszek").knows("pigeon-joke")
        ? "pigeon"
        : "start";
    },
    nodes: {
      pigeon: {
        lines: [
          { speaker: "Pan Zbyszek", text: "Idź przodem, ja jeszcze myślę." },
          {
            text: "So this is the Zbyszek the pigeon is named after. The resemblance is there.",
            voice: "inner",
          },
        ],
        onEnter: (ctx) => npcMemory(ctx, "zbyszek").learn("pigeon-joke"),
        next: "hub",
      },
      start: {
        lines: [
          {
            speaker: "Pan Zbyszek",
            text: "Idź przodem, ja jeszcze myślę. Nad życiem i nad piwem.",
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He is not in the queue. He is adjacent to the queue." }],
        topics: true,
        choices: [
          { id: "zby-queue", label: "Długa kolejka?", next: "queue", againNext: "queueAgain" },
          { id: "zby-reco", label: "Co pan poleca?", next: "reco", againNext: "recoAgain" },
          { label: "Na zdrowie, panie Zbyszku.", next: "bye" },
        ],
      },
      queue: {
        lines: [
          {
            speaker: "Pan Zbyszek",
            text: "Jedna osoba, a stoję dziesięć minut. Bo ta jedna osoba to ja. Zdecydować nie mogę.",
          },
        ],
        next: "hub",
      },
      queueAgain: {
        lines: [{ speaker: "Pan Zbyszek", text: "Dalej ta sama. Postęp jest, ale wewnętrzny." }],
        next: "hub",
      },
      reco: {
        lines: [
          {
            speaker: "Pan Zbyszek",
            text: "Hot dog bierz. Ale z tej bliższej rolki. Tamta się kręci od wtorku.",
          },
        ],
        next: "hub",
      },
      recoAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [{ speaker: "Pan Zbyszek", text: "Mówiłem — bliższa rolka. Nie testuj mnie." }],
          },
          {
            lines: [
              {
                speaker: "Pan Zbyszek",
                text: "Ta sama rada co zawsze. Dobra rada się nie starzeje. Tamta parówka — owszem.",
              },
            ],
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [
          { speaker: "Pan Zbyszek", text: "No. I paragon bierz, bo potem nie ma człowieka." },
        ],
      },
    },
  },
);

export const GOLEBIARKA = defineTree<Ctx>(
  "golebiarka",
  { npc: "golebiarka" },
  {
    start: (ctx) => {
      npcMemory(ctx, "golebiarka").visit();
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
                speaker: "Pani Gołębiarka",
                text: "Ostrożnie, młody. Zbyszek je. Jak je, to nie lubi publiczności.",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Pani Gołębiarka",
                text: "Znowu ty. Dobrze. Zbyszek już pytał, gdzie ten od kaszy.",
              },
            ],
          },
          { lines: [{ speaker: "Pani Gołębiarka", text: "Ciii. Trawienie." }] },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "The pigeons redistribute themselves around your shoes." }],
        topics: true,
        choices: [
          {
            id: "gol-zbyszek",
            label: "Który to Zbyszek?",
            next: "zbyszek",
            againNext: "zbyszekAgain",
          },
          {
            id: "gol-fountain",
            label: "Fontanna kiedyś działała?",
            next: "fountain",
            againNext: "fountainAgain",
          },
          { label: "Miłego dnia.", next: "bye" },
        ],
      },
      zbyszek: {
        lines: [
          {
            speaker: "Pani Gołębiarka",
            text: "Ten siwy z charakterem. Nazwałam po prezesie spółdzielni. Obaj gruchają, żaden nie słucha.",
          },
        ],
        // the name travels: Pan Zbyszek at the Żabka will hear about this
        onEnter: (ctx) => learn(ctx, "street.zbyszek-pigeon"),
        next: "hub",
      },
      zbyszekAgain: {
        lines: [
          {
            speaker: "Pani Gołębiarka",
            text: "Ten sam co wczoraj. Gołębie się nie przemianowują.",
          },
        ],
        next: "hub",
      },
      fountain: {
        lines: [
          {
            speaker: "Pani Gołębiarka",
            text: "Na Dzień Dziecka w dziewięćdziesiątym szóstym. Woda leciała do drugiej po południu.",
          },
          {
            speaker: "Pani Gołębiarka",
            text: "Pamiętam, bo Zbyszek pierwszy się kąpał. Znaczy — tamten Zbyszek. Prezes.",
          },
        ],
        next: "hub",
      },
      fountainAgain: {
        lines: [
          {
            speaker: "Pani Gołębiarka",
            text: "Dziewięćdziesiąty szósty. Data się nie zmieni, młody.",
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Pani Gołębiarka", text: "Kaszę bierz, nie chleb. Zapamiętaj." }],
      },
    },
  },
);

export const COURIER = defineTree<Ctx>(
  "courier",
  { npc: "courier" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "courier");
      const node = m.met() ? "hello" : "start";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          {
            speaker: "Kurier",
            text: "Kovtun? Nie? To nie podpisujesz. Sekunda, szukam czternastki.",
          },
        ],
        next: "hub",
      },
      hello: {
        lines: [
          { speaker: "Kurier", text: "O, czternastka. Dziś nic dla ciebie. Chyba. Apka wie." },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "The van idles like it knows the route by heart." }],
        topics: true,
        choices: [
          {
            id: "cur-parcel",
            label: "To ja, z czternastki.",
            next: "parcel",
            againNext: "parcelAgain",
          },
          { id: "cur-day", label: "Ciężki dzień?", next: "day", againNext: "dayAgain" },
          { label: "Powodzenia.", next: "bye" },
        ],
      },
      parcel: {
        lines: [
          {
            speaker: "Kurier",
            text: "Serio? To i tak wrzuciłem do paczkomatu. Nawyk. Przepraszam.",
          },
        ],
        next: "hub",
      },
      parcelAgain: {
        lines: [
          { speaker: "Kurier", text: "Wiem, wiem. Czternastka. Paczkomat. Koło się zamyka." },
        ],
        next: "hub",
      },
      day: {
        lines: [
          {
            speaker: "Kurier",
            text: "Sto dwadzieścia paczek, cztery godziny. Apka mówi, że dam radę.",
          },
          { speaker: "Kurier", text: "Apka nigdy nie nosiła lodówki na trzecie piętro." },
        ],
        next: "hub",
      },
      dayAgain: {
        lines: [
          { speaker: "Kurier", text: "Sto dziesięć. Pytaj za godzinę, będzie dziewięćdziesiąt." },
        ],
        next: "hub",
      },
      bye: { lines: [{ speaker: "Kurier", text: "Dzięki. Miłego." }] },
    },
  },
);

export const STUDENT = defineTree<Ctx>(
  "student",
  { npc: "student" },
  {
    start: (ctx) => {
      npcMemory(ctx, "student").visit();
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
                speaker: "Student",
                text: "Panie, ta lodówka z energetykami to najlepsza półka w mieście.",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Student",
                text: "Znowu pan. Ja też znowu. Sesja nas wszystkich zapętliła.",
              },
            ],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He holds the energy drink like a lab sample." }],
        topics: true,
        choices: [
          { id: "stu-exam", label: "Sesja?", next: "exam", againNext: "examAgain" },
          { id: "stu-sleep", label: "Śpij więcej, młody.", next: "sleep", againNext: "sleepAgain" },
          { label: "Trzymaj się.", next: "bye" },
        ],
      },
      exam: {
        lines: [
          {
            speaker: "Student",
            text: "Kolokwium z analizy o ósmej. Plan jest taki: nie spać, to się nie zaśpię.",
          },
        ],
        next: "hub",
      },
      examAgain: {
        lines: [
          { speaker: "Student", text: "Dalej analiza. Analiza jest wieczna. Ja niekoniecznie." },
        ],
        next: "hub",
      },
      sleep: {
        lines: [
          { speaker: "Student", text: "Spanie jest dla ludzi po sesji. Czyli teoretycznych." },
        ],
        next: "hub",
      },
      sleepAgain: {
        lines: [
          {
            speaker: "Student",
            text: "Pan już to mówił. Brzmi pan jak moja mama. Ona też ma rację.",
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [{ speaker: "Student", text: "Powodzenia na siłce, widzę kettlebell w oczach." }],
      },
    },
  },
);

export const WAITING = defineTree<Ctx>(
  "waiting",
  { npc: "waiting-man" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "waiting-man");
      const node = m.met() && m.minutesSince() < 10 ? "still" : "start";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          { speaker: "Czekający", text: "Czekam na żonę. Powiedziała: dwie minuty, tylko chleb." },
        ],
        next: "hub",
      },
      still: {
        lines: [{ speaker: "Czekający", text: "Dalej stoję. Tak, dalej chleb. Nie, nie wyszła." }],
        next: "hub",
      },
      hub: {
        lines: [{ text: "He has achieved a stillness monks train decades for." }],
        topics: true,
        choices: [
          { id: "wai-time", label: "Dawno tak stoisz?", next: "time", againNext: "timeAgain" },
          { id: "wai-pain", label: "Znam ten ból.", next: "pain", againNext: "painAgain" },
          { label: "Powodzenia.", next: "bye" },
        ],
      },
      time: {
        lines: [
          {
            speaker: "Czekający",
            text: "Czterdzieści minut. Ale w Żabce czas płynie inaczej. Jak w kosmosie.",
          },
        ],
        next: "hub",
      },
      timeAgain: {
        lines: [
          { speaker: "Czekający", text: "Doliczaj sam od poprzedniego razu. Ja już nie liczę." },
        ],
        next: "hub",
      },
      pain: {
        lines: [
          {
            speaker: "Czekający",
            text: "Najgorsze, że wyjdzie z chlebem. I z pięcioma rzeczami, których nie ma na liście.",
          },
          { speaker: "Czekający", text: "Lista jest we mnie. Ja jestem listą." },
        ],
        next: "hub",
      },
      painAgain: {
        lines: [
          {
            speaker: "Czekający",
            text: "Wiem, że znasz. Wszyscy znamy. Dlatego stoimy osobno i razem.",
          },
        ],
        next: "hub",
      },
      bye: { lines: [{ speaker: "Czekający", text: "No. Stoję dalej. Taki sport." }] },
    },
  },
);

export const TREES = {
  smoker: SMOKER,
  babcia: BABCIA,
  zbyszek: ZBYSZEK,
  golebiarka: GOLEBIARKA,
  courier: COURIER,
  student: STUDENT,
  "waiting-man": WAITING,
};
