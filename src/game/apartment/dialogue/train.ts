import { defineTree, playSfx } from "@/engine";
import { npcMemory } from "@/engine/systems/memory";
import type { WorldState } from "@/lib/worldState";
import { addToInventory, countOf } from "./commerce";
import type { Ctx } from "./types";

export function buildConductorTree(world: WorldState) {
  const hasTicket = countOf(world, "ticket") > 0;
  return defineTree<Ctx>(
    "konduktor",
    { npc: "konduktor" },
    {
      start: () => (hasTicket ? "valid" : "none"),
      nodes: {
        /* --- the ordinary branch --- */
        valid: {
          lines: [
            { speaker: "Konduktor", text: "Dobry wieczór. Bilecik proszę.", mood: "neutral" },
            { text: "You hand it over. He turns it the right way up without looking." },
            {
              speaker: "Konduktor",
              text: "Dziękuję. Zaspa następna.",
              mood: "warm",
            },
          ],
          choices: [
            {
              id: "weather",
              label: "Long shift?",
              next: "weather",
            },
            { label: "Thanks.", next: "off" },
          ],
        },
        weather: {
          lines: [
            {
              speaker: "Konduktor",
              text: "Od szóstej. Do dziesiątej. W czwartek wolne.",
              mood: "warm",
            },
            {
              speaker: "Konduktor",
              text: "Ale w czwartek zawsze coś jest.",
              mood: "sad",
            },
          ],
          next: "off",
        },

        /* --- no ticket --- */
        none: {
          lines: [
            { speaker: "Konduktor", text: "Bilecik proszę.", mood: "neutral" },
            { text: "You do not have one. He can see that you do not have one." },
          ],
          choices: [
            {
              id: "onboard",
              label: "Can I buy one from you? (6 zł)",
              when: (ctx) => ctx.world.money >= 6,
              next: "bought",
              effect: (ctx) => {
                playSfx("register");
                ctx.updateWorld((w) => ({
                  ...w,
                  money: w.money - 6,
                  inventory: addToInventory(w, "ticket"),
                }));
              },
            },
            {
              id: "fine",
              label: "I'll pay the fine.",
              locked: (ctx) => (ctx.world.money >= 80 ? null : "80 zł"),
              next: "fined",
              effect: (ctx) => {
                playSfx("coins");
                ctx.updateWorld((w) => ({ ...w, money: w.money - 80 }));
              },
            },
            { label: "I haven't got anything.", next: "broke" },
          ],
        },
        bought: {
          lines: [
            {
              speaker: "Konduktor",
              text: "Sześć. Z dopłatą. Następny raz w automacie na peronie.",
              mood: "neutral",
            },
            { text: "He writes it out by hand, tears it off, and hands it over." },
          ],
          next: "off",
        },
        fined: {
          lines: [
            {
              speaker: "Konduktor",
              text: "Osiemdziesiąt. Przykro mi, taka taryfa.",
              mood: "tense",
            },
            { text: "He does look sorry about it, which somehow makes it worse." },
          ],
          next: "off",
        },
        broke: {
          lines: [
            { speaker: "Konduktor", text: "Dowód poproszę.", mood: "tense" },
            {
              text: "He copies your name into a little book, very slowly, and does not look up.",
            },
            {
              speaker: "Konduktor",
              text: "Wysiadam w Zaspie. Kup bilet.",
              mood: "sad",
            },
          ],
          next: "off",
        },

        off: {
          lines: [{ text: "He moves down the carriage. Bilety do kontroli." }],
        },
      },
    },
  );
}

/**
 * Jeanne.
 *
 * A comedy of two people with no language in common, and the rule the whole
 * tree is written to is that neither of them is the joke. They are both trying
 * extremely hard, they are both being very polite about total failure, and over
 * about ninety seconds they successfully establish one fact — that this train
 * goes to Gdynia — and acquire one shared word.
 *
 * Three things make it work rather than just being a gag:
 *
 *  – she is never mocked for not speaking Polish and he is never mocked for not
 *    speaking French. The obstacle is the situation, not either person.
 *  – the French is real French and it is not translated. The player is in
 *    exactly the position the character is in, which is the joke: you also do
 *    not know what she said, and you also have to guess.
 *  – it pays off. `tak` becomes a running gag she adopts and starts bolting on
 *    to French sentences, and by the end that one syllable is doing the work of
 *    an entire language, which is roughly how this actually goes.
 */
export const JEANNE = defineTree<Ctx>(
  "jeanne",
  { npc: "jeanne" },
  {
    start: "open",
    nodes: {
      open: {
        lines: [
          {
            speaker: "Jeanne",
            text: "Pardon — excusez-moi. C'est bien le train pour Gdynia ?",
            mood: "warm",
          },
          {
            text: "She has a map on her phone and the expression of someone on their fourth attempt.",
          },
        ],
        choices: [
          { id: "tak", label: "Tak. Gdynia.", next: "tak" },
          { id: "en", label: "Sorry — I don't speak French.", next: "english" },
          { id: "point", label: "Point at the route map on the wall.", next: "map" },
        ],
      },

      /* --- he answers in Polish, which she does not have either --- */
      tak: {
        lines: [
          { speaker: "Jeanne", text: "…Tak ?", mood: "amused" },
          { text: "She repeats it back with the rising tone of somebody filing a new word away." },
          {
            speaker: "Jeanne",
            text: "Tak. Tak, tak. D'accord. Et Gdynia, c'est… loin ?",
            mood: "warm",
          },
          { text: "You have no idea what the second half of that was." },
        ],
        choices: [
          { id: "tak2", label: "Tak.", next: "tak-wrong" },
          { id: "fingers", label: "Hold up four fingers.", next: "fingers" },
          { id: "map2", label: "Point at the route map.", next: "map" },
        ],
      },
      "tak-wrong": {
        lines: [
          { text: "It was not a yes-or-no question. You can see her deciding to let it go." },
          { speaker: "Jeanne", text: "Tak. Bien sûr. Tak.", mood: "amused" },
          {
            text: 'She says it the way you would say "right" to a man explaining something wrong.',
          },
        ],
        next: "settle",
      },
      fingers: {
        lines: [
          {
            speaker: "Jeanne",
            text: "Quatre ? Quatre arrêts ? Ah — quatre. Merci !",
            mood: "warm",
          },
          { text: "It was four. You are as surprised as she is." },
        ],
        next: "settle",
      },

      /* --- he tries English, which nearly works, which is worse --- */
      english: {
        lines: [
          {
            speaker: "Jeanne",
            text: "Ah — non, non. Français. Seulement français.",
            mood: "amused",
          },
          { speaker: "Jeanne", text: "Mais… Gdynia ? Oui ? Non ?", mood: "warm" },
          {
            text: "She holds the two words out like a fork and a spoon, hoping one of them is right.",
          },
        ],
        choices: [
          { id: "oui", label: "Oui. Gdynia.", next: "oui" },
          { id: "tak3", label: "Tak. — the only word you can offer her.", next: "tak" },
        ],
      },
      oui: {
        lines: [
          { speaker: "Jeanne", text: "Oui ! Vous parlez français !", mood: "warm" },
          { text: "You do not. That was the whole of it, and she is about to find that out." },
          { speaker: "Jeanne", text: "C'est formidable. Alors, je cherche la rue…", mood: "warm" },
          { text: "She is still going. You are nodding. This is the situation now." },
        ],
        next: "settle",
      },

      /* --- the thing that actually works, because it is not language --- */
      map: {
        lines: [
          {
            text: "You point at the diagram by the door. She stands, reads it, and finds Gdynia at the end of the line.",
          },
          { speaker: "Jeanne", text: "Ah ! Là. Gdynia Główna. Le dernier.", mood: "warm" },
          { speaker: "Jeanne", text: "Merci. Vraiment.", mood: "warm" },
        ],
        choices: [
          { id: "prosze", label: "Proszę.", next: "prosze" },
          { id: "nod", label: "Nod, and go back to the window.", next: "settle" },
        ],
      },
      prosze: {
        lines: [
          { speaker: "Jeanne", text: "Prosze.", mood: "amused" },
          { text: "She says it back carefully, with the wrong s, and looks pleased with herself." },
          {
            speaker: "Jeanne",
            text: "Prosze. Tak. Gdynia. Voilà — je parle polonais.",
            mood: "amused",
          },
        ],
        next: "settle",
      },

      settle: {
        lines: [
          { text: "She sits back. Outside, the sheds go past and then the cranes." },
          {
            speaker: "Jeanne",
            text: "…Tak ?",
            mood: "amused",
          },
          { text: "She is checking the word still works. It does." },
        ],
        choices: [
          { id: "yes", label: "Tak.", next: "end" },
          { id: "smile", label: "Say nothing, and look out of the window with her.", next: "end" },
        ],
      },
      end: {
        lines: [
          {
            text: "Four stops is not very long, and neither of you tries again. It is a comfortable sort of quiet.",
          },
        ],
      },
    },
  },
);

/**
 * The welder, twelve hours into a day that started at five.
 *
 * Short, because he is tired. Two exchanges and he is done talking, which is
 * the characterisation — a man being polite to a stranger while wanting very
 * much to be left alone, and the player being allowed to notice that and stop.
 */
export const SPAWACZ = defineTree<Ctx>(
  "spawacz",
  { npc: "spawacz" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "spawacz");
      const node = m.met() ? "met" : "open";
      m.visit();
      return node;
    },
    nodes: {
      // the revisit is quieter than the visit — that is the whole character
      met: {
        lines: [
          {
            text: "He recognizes you with one eyebrow. The eyebrow also says: still twelve hours.",
          },
          { speaker: "Spawacz", text: "Dobry.", mood: "neutral" },
        ],
        next: "quiet",
      },
      open: {
        lines: [
          { text: "He has a canvas bag between his boots and a hard hat on his knee." },
          { speaker: "Spawacz", text: "Dobry.", mood: "neutral" },
        ],
        choices: [
          { id: "shift", label: "Long one?", next: "shift" },
          { id: "yard", label: "You're off the yard?", next: "yard" },
          { label: "Nod, and leave him alone.", next: "quiet" },
        ],
      },
      shift: {
        lines: [
          { speaker: "Spawacz", text: "Dwanaście. Od piątej.", mood: "sad" },
          { speaker: "Spawacz", text: "W piątek to samo. W sobotę to samo.", mood: "sad" },
        ],
        next: "quiet",
      },
      yard: {
        lines: [
          { speaker: "Spawacz", text: "Stocznia. Co z niej zostało.", mood: "sad" },
          {
            text: "He tips his head at the window. The cranes are going past, four of them, still standing.",
          },
          {
            speaker: "Spawacz",
            text: "Dziadek tam robił. Ojciec robił. No i ja.",
            mood: "neutral",
          },
        ],
        next: "quiet",
      },
      quiet: {
        lines: [
          {
            text: "He shuts his eyes. He is not asleep — he is just not here for the next four stops.",
          },
        ],
      },
    },
  },
);

/**
 * The nurse, off a night shift and going home to sleep through the afternoon.
 * Friendlier than the welder and just as finished.
 */
export const PIELEGNIARKA = defineTree<Ctx>(
  "pielegniarka",
  { npc: "pielegniarka" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "pielegniarka");
      const node = m.met() ? "met" : "open";
      m.visit();
      return node;
    },
    nodes: {
      met: {
        lines: [
          {
            speaker: "Pielęgniarka",
            text: "O, to znowu pan. Ta sama linia, to samo zmęczenie.",
            mood: "warm",
          },
        ],
        next: "quiet",
      },
      open: {
        lines: [
          {
            speaker: "Pielęgniarka",
            text: "Dzień dobry. Albo dobry wieczór. Nie wiem już.",
            mood: "warm",
          },
        ],
        choices: [
          { id: "shift", label: "Nights?", next: "nights" },
          { id: "far", label: "Far to go?", next: "far" },
          { label: "Let her be.", next: "quiet" },
        ],
      },
      nights: {
        lines: [
          { speaker: "Pielęgniarka", text: "Trzy pod rząd. Dziś ostatnia.", mood: "neutral" },
          {
            speaker: "Pielęgniarka",
            text: "Idę spać o dziesiątej rano i budzę się, kiedy jest ciemno. Człowiek się przyzwyczaja.",
            mood: "sad",
          },
        ],
        next: "quiet",
      },
      far: {
        lines: [
          { speaker: "Pielęgniarka", text: "Zaspa. Dwa przystanki.", mood: "warm" },
          {
            speaker: "Pielęgniarka",
            text: "Wystarczy, żeby zasnąć i się nie obudzić na czas.",
            mood: "amused",
          },
        ],
        next: "quiet",
      },
      quiet: {
        lines: [
          {
            text: "She goes back to her phone, holding it the way you hold something you are not reading.",
          },
        ],
      },
    },
  },
);

export const TREES = {
  jeanne: JEANNE,
  "train-spawacz": SPAWACZ,
  "train-pielegniarka": PIELEGNIARKA,
};
