import { defineTree, playSfx } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { buy, canAfford } from "./commerce";
import type { Ctx } from "./types";

/** Inside Turbina. Vignette people: the gag rhythm is the characterization,
 * so these keep their exact shape — recognition here would break the joke. */

/** The DJ. Two answers and a wall. The wall is part of the set. */
export const DJ = defineTree<Ctx>(
  "dj",
  { npc: "dj-booth" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: "He lifts one headphone cup a centimetre. This is your entire audience window." },
          { speaker: "DJ", text: "No?", mood: "neutral" },
        ],
        choices: [
          { label: "Zagrasz coś...", next: "request" },
          { label: "Dobre to. Co to jest?", next: "what" },
          { label: "Nic, nic. Graj.", next: "bye" },
        ],
      },
      request: {
        lines: [
          { speaker: "DJ", text: "Nie.", mood: "neutral" },
          { text: "The headphone cup goes back down. The negotiation is complete." },
        ],
      },
      what: {
        lines: [
          {
            speaker: "DJ",
            text: "Białe winylowe, bez nalepki. Kupione w Oliwie za pięć złotych.",
            mood: "warm",
          },
          { speaker: "DJ", text: "Jak powiem ci tytuł, przestanie działać.", mood: "amused" },
        ],
        next: "bye",
      },
      bye: {
        lines: [{ text: "He nods once, at you or at the kick drum. Hard to say." }],
      },
    },
  },
);

/** On the sofa, heels in hand. The night's most honest person. */
export const TIRED = defineTree<Ctx>(
  "tired",
  { npc: "tired-girl" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Zmęczona",
            text: "Nie, nie trzeba mi wody. Siedzę. Strategicznie.",
            mood: "amused",
          },
        ],
        choices: [
          { label: "Dobra impreza?", next: "party" },
          { label: "Która godzina, wiesz?", next: "time" },
          { label: "Strategia to podstawa.", next: "bye" },
        ],
      },
      party: {
        lines: [
          {
            speaker: "Zmęczona",
            text: "Najlepsza od miesiąca. Dlatego siedzę. Trzeba umieć dawkować.",
            mood: "warm",
          },
          {
            speaker: "Zmęczona",
            text: "Jeszcze dwa kawałki i wracam. Może trzy. Może zaraz.",
            mood: "amused",
          },
        ],
        next: "start",
      },
      time: {
        lines: [
          {
            speaker: "Zmęczona",
            text: "Nie mów mi. Serio. W tym budynku nie ma godzin, jest tylko bas.",
            mood: "warm",
          },
        ],
        next: "start",
      },
      bye: {
        lines: [{ speaker: "Zmęczona", text: "No. Idź tańczyć. Ktoś musi, ja pilnuję sofy." }],
      },
    },
  },
);

/**
 * The couple. You are not joining a conversation, you are being empanelled:
 * they have been arguing one question all night and you are the third vote.
 * Whatever you answer, they immediately agree with each other against you,
 * which is what couples are for.
 */
export const COUPLE = defineTree<Ctx>(
  "couple",
  { npc: "club-couple" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Ola",
            text: "Dobra — TY rozstrzygniesz. Ten set jest lepszy niż w lipcu?",
            mood: "warm",
          },
          { speaker: "Kuba", text: "Bez sugestii. Po prostu powiedz.", mood: "amused" },
        ],
        choices: [
          { label: "Lepszy.", next: "better" },
          { label: "W lipcu było lepiej.", next: "july" },
          { label: "To ten sam set.", next: "same" },
          { label: "Nie wciągajcie mnie w to.", next: "out" },
        ],
      },
      better: {
        lines: [
          { speaker: "Ola", text: "No właśnie! Dziękuję!", mood: "warm" },
          { speaker: "Kuba", text: "On tak mówi, bo stoisz bliżej. Fizyka.", mood: "amused" },
          { speaker: "Ola", text: "...w sumie stoi bliżej.", mood: "neutral" },
          { text: "They are agreeing with each other against you within eight seconds. A record." },
        ],
      },
      july: {
        lines: [
          { speaker: "Kuba", text: "SŁYSZYSZ? Lipiec!", mood: "warm" },
          {
            speaker: "Ola",
            text: "Ciebie nie było w lipcu. Kuba, jego nie było w lipcu.",
            mood: "tense",
          },
          { speaker: "Kuba", text: "...nie było cię w lipcu?", mood: "neutral" },
          { text: "The panel's credibility collapses. The debate survives you intact." },
        ],
      },
      same: {
        lines: [
          { speaker: "Ola", text: "Ten sam?! Przejście w drugim kawałku—", mood: "tense" },
          {
            speaker: "Kuba",
            text: "—było identyczne. Dziękujemy. Sprawiedliwy człowiek.",
            mood: "warm",
          },
          { speaker: "Ola", text: "Sprawiedliwy. Głuchy, ale sprawiedliwy.", mood: "amused" },
        ],
      },
      out: {
        lines: [
          { speaker: "Kuba", text: "Mądry wybór.", mood: "amused" },
          { speaker: "Ola", text: "Tchórz.", mood: "amused" },
          { text: "They say it at exactly the same time, and clink bottles without looking." },
        ],
      },
    },
  },
);

/** The WC queue: solidarity, physics, and a door that answers to nobody. */
export const WC_QUEUE = defineTree<Ctx>(
  "wc-queue",
  { npc: "wc-queue" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Kolejka do WC",
            text: "Koniec kolejki jest tu. Kolejka to ja.",
            mood: "neutral",
          },
        ],
        choices: [
          { label: "Długo stoisz?", next: "long" },
          { label: "A co tam się dzieje w środku?", next: "inside" },
          { label: "Trzymaj pozycję.", next: "bye" },
        ],
      },
      long: {
        lines: [
          {
            speaker: "Kolejka do WC",
            text: "Trzy kawałki. Czas mierzę w kawałkach, zegarki tu umierają.",
            mood: "amused",
          },
        ],
        next: "start",
      },
      inside: {
        lines: [
          {
            speaker: "Kolejka do WC",
            text: "Teorie są trzy: poprawia makijaż, płacze, albo znalazła lepszą imprezę.",
            mood: "amused",
          },
          {
            speaker: "Kolejka do WC",
            text: "Obstawiam lepszą imprezę. Drzwi się nie ruszyły od DWÓCH kawałków.",
            mood: "warm",
          },
        ],
        next: "start",
      },
      bye: {
        lines: [
          { speaker: "Kolejka do WC", text: "Pozycji się nie trzyma. Pozycję się PRZEŻYWA." },
        ],
      },
    },
  },
);

/**
 * The man on the phone by the door. The joke is structural: he can't hear
 * you either, so the dialogue itself has to shout — and the one quiet line
 * lands only when you lean in.
 */
export const CLUB_CALLER = defineTree<Ctx>(
  "club-caller",
  { npc: "club-caller" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Człowiek z telefonem",
            text: "ALO? NIE, NIE TY. ZNACZY TY TEŻ NIE.",
            mood: "tense",
          },
          {
            text: "He points at the phone, then at the ceiling, then at his ear. A whole sentence.",
          },
        ],
        choices: [
          { label: "KTO DZWONI?", next: "who" },
          { label: "WYJDŹ NA ZEWNĄTRZ!", next: "outside" },
          { label: "Leave him to the bass.", next: "bye" },
        ],
      },
      who: {
        lines: [
          {
            speaker: "Człowiek z telefonem",
            text: "MAMA! PYTA CZY ZIMNO! W KLUBIE! CZY ZIMNO!",
            mood: "amused",
          },
          { text: "You both consider the question. It is, objectively, quite warm." },
        ],
        next: "start",
      },
      outside: {
        lines: [
          { speaker: "Człowiek z telefonem", text: "CO?!", mood: "neutral" },
          { text: "You point at the door. He looks at it like a fresh idea in an old field." },
          { speaker: "Człowiek z telefonem", text: "...aha. No tak.", mood: "warm" },
          { text: "The quietest thing he has said all night. He does not go outside." },
        ],
      },
      bye: {
        lines: [
          { text: "He gives you a thumbs up meant for somebody on the other end of the phone." },
        ],
      },
    },
  },
);

/** The tech, coiling the rig's veins. Eight loops. Always eight. */
export const TECHNIK = defineTree<Ctx>(
  "technik",
  { npc: "club-technik" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Technik",
            text: "Ostrożnie, kable. Wczoraj ktoś tańczył, dziś ja zwijam.",
            mood: "neutral",
          },
        ],
        choices: [
          { label: "Dużo tego.", next: "much" },
          { label: "Osiem zwojów?", next: "eight" },
          { label: "Nie przeszkadzam.", next: "bye" },
        ],
      },
      much: {
        lines: [
          {
            speaker: "Technik",
            text: "Czterysta metrów. Rig wisi na sześciu trybach i mojej opinii o węzłach.",
            mood: "amused",
          },
        ],
        next: "start",
      },
      eight: {
        lines: [
          {
            speaker: "Technik",
            text: "Osiem. Kabel pamięta. Zwiniesz na siedem — na imprezie odda ci to z odsetkami.",
            mood: "warm",
          },
          {
            text: "He says it the way the trainer talks about backs. Some knowledge is load-bearing.",
          },
        ],
        next: "start",
      },
      bye: {
        lines: [{ speaker: "Technik", text: "No. I nie deptać po XLR-ach." }],
      },
    },
  },
);

/** The morning after. She has cleaned worse and says so. */
export const CLEANER = defineTree<Ctx>(
  "cleaner",
  { npc: "club-cleaner" },
  {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            speaker: "Pani Sprzątająca",
            text: "Ostrożnie, tu mokre. I brokat. Brokat jest wszędzie.",
            mood: "neutral",
          },
        ],
        choices: [
          { label: "Ciężka noc była?", next: "night" },
          { label: "Co ludzie zostawiają?", next: "lost" },
          { label: "Powodzenia z brokatem.", next: "bye" },
        ],
      },
      night: {
        lines: [
          {
            speaker: "Pani Sprzątająca",
            text: "Dla nich? Chyba dobra. Dla podłogi — średnia.",
            mood: "amused",
          },
        ],
        next: "start",
      },
      lost: {
        lines: [
          {
            speaker: "Pani Sprzątająca",
            text: "Jedna kurtka, cztery telefony, jeden but. Jeden!",
            mood: "amused",
          },
          {
            speaker: "Pani Sprzątająca",
            text: "Jak ktoś wyszedł w jednym bucie i nie wrócił, to znaczy, że noc była naprawdę dobra.",
            mood: "warm",
          },
        ],
        next: "start",
      },
      bye: {
        lines: [{ speaker: "Pani Sprzątająca", text: "Brokat wygra. Ale ja mam etat." }],
      },
    },
  },
);

/** The club bar: free tap water, priced everything else, closed cards at 3. */
export function buildKlubowyTree(world: WorldState) {
  const buys = [
    {
      label: "Woda. (0 zł)",
      next: "water",
      effect: () => playSfx("pour"),
    },
    {
      label: "Izotonik. (10 zł)",
      next: canAfford(10),
      effect: (ctx: Ctx) => buy(ctx, "izotonik", 10),
    },
    {
      label: "Piwo. (15 zł)",
      next: canAfford(15),
      effect: (ctx: Ctx) => buy(ctx, "beer", 15),
    },
    { label: "Nic. Odpoczywam od basu.", next: "bye" },
  ];
  return defineTree<Ctx>(
    "klubowy",
    { npc: "klubowy" },
    {
      start: "start",
      nodes: {
        start: {
          lines: [
            { text: `You have ${world.money} zł on you. He reads lips; everyone here does.` },
            { speaker: "Barman", text: "NO? CO PODAĆ?", mood: "neutral" },
          ],
          choices: buys,
        },
        water: {
          lines: [
            { speaker: "Barman", text: "KRANÓWA. DARMOWA. PIJ.", mood: "warm" },
            {
              text: "It is the best water you have ever drunk. Every water at 1 a.m. on a dance floor is.",
            },
          ],
          next: "more",
        },
        "sold-10": {
          lines: [{ speaker: "Barman", text: "MĄDRY WYBÓR. ELEKTROLITY.", mood: "warm" }],
          next: "more",
        },
        "sold-15": {
          lines: [{ speaker: "Barman", text: "PIĘTNAŚCIE. KUBEK NA BAR WRACA.", mood: "neutral" }],
          next: "more",
        },
        short: {
          lines: [{ speaker: "Barman", text: "MAŁO. WODA JEST DARMOWA.", mood: "amused" }],
          next: "more",
        },
        more: {
          lines: [{ speaker: "Barman", text: "COŚ JESZCZE?" }],
          choices: buys,
        },
        bye: {
          lines: [{ text: "He is already three orders ahead. The bar swallows you back out." }],
        },
      },
    },
  );
}

export const TREES = {
  "dj-booth": DJ,
  "tired-girl": TIRED,
  "club-cleaner": CLEANER,
  "club-couple": COUPLE,
  "wc-queue": WC_QUEUE,
  "club-caller": CLUB_CALLER,
  "club-technik": TECHNIK,
};
