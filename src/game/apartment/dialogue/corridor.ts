import { defineTree } from "@/engine";
import { npcMemory } from "@/engine/systems/memory";
import type { Ctx } from "./types";

/**
 * Pani Natalia, who keeps this building clean and her thoughts at home.
 *
 * The naturalness pass, everywhere in this folder, follows one rule: every
 * line the trees already had stays word for word. What is added around them
 * is the behavior of a person — a greeting that knows you, answers that get
 * shorter the second time you ask, and the very occasional thought of your
 * own. Nothing announces itself.
 */
export const NATALIA = defineTree<Ctx>(
  "natalia",
  { npc: "pani-natalia" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "pani-natalia");
      const node = !m.met() ? "start" : m.minutesSince() < 4 ? "again" : "hello";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          {
            speaker: "Pani Natalia",
            text: "Ой, добрий день... Ви з чотирнадцятої? Обережно, я тут щойно помила.",
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
              { speaker: "Pani Natalia", text: "О, добрий день. Обережно там біля ліфта — мокро." },
            ],
          },
          {
            lines: [
              {
                speaker: "Pani Natalia",
                text: "Добрий день, сусіде. Знову по сходах? Добре робите.",
              },
            ],
          },
          { lines: [{ speaker: "Pani Natalia", text: "Добрий. Я тут, де завжди." }] },
        ],
        next: "hub",
      },
      again: {
        lines: [
          {
            speaker: "Pani Natalia",
            text: "Ви щось забули? Чи просто так ходите туди-сюди по моїй мокрій підлозі?",
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "She wrings the mop like it owes her money." }],
        variantMode: "cycle",
        variants: [
          { lines: [{ text: "She wrings the mop like it owes her money." }] },
          { lines: [{ text: "The bucket water has gone the color of the stairwell." }] },
        ],
        topics: true,
        choices: [
          { id: "nat-work", label: "Як вам тут працюється?", next: "work", againNext: "workAgain" },
          {
            id: "nat-home",
            label: "Звідки ви, пані Наталю?",
            next: "home",
            againNext: "homeAgain",
          },
          { label: "Тримайтеся. Гарного дня.", next: "bye" },
        ],
      },
      work: {
        lines: [
          {
            speaker: "Pani Natalia",
            text: "Та як... Три під'їзди зранку, офіс увечері. Руки вже не мої, а швабрині.",
          },
          {
            speaker: "Pani Natalia",
            text: "Люди тут чемні, «dziękuję» кажуть. Але сходи від того чистішими самі не стають.",
          },
        ],
        next: "hub",
      },
      workAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Pani Natalia",
                text: "Так само, як вчора. Три під'їзди. Швабра та сама.",
              },
            ],
          },
          { lines: [{ speaker: "Pani Natalia", text: "Працюється. Ви краще під ноги дивіться." }] },
        ],
        next: "hub",
      },
      home: {
        lines: [
          {
            speaker: "Pani Natalia",
            text: "З-під Полтави я. Там зараз яблука, повний сад — а зривати нікому.",
          },
          {
            speaker: "Pani Natalia",
            text: "Син там, з бабусею. Дзвонить: «мамо, коли приїдеш?» А я що скажу...",
          },
          {
            speaker: "Pani Natalia",
            text: "Казала собі — на пів року. Четвертий рік доліки. Ну нічого. Нічого.",
          },
        ],
        interjections: [
          {
            id: "int-natalia-year",
            text: "Fourth year. You stop saying 'this year' out loud around the second.",
            once: true,
          },
        ],
        next: "hub",
      },
      homeAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              { speaker: "Pani Natalia", text: "Я ж розказувала. З-під Полтави." },
              { text: "She says it to the floor, not to you." },
            ],
          },
          {
            lines: [
              {
                speaker: "Pani Natalia",
                text: "Звідти, де яблука. Не питайте більше, бо заплачу.",
              },
            ],
          },
        ],
        next: "hub",
      },
      bye: {
        lines: [
          {
            speaker: "Pani Natalia",
            text: "І вам. Йдіть попід стінкою, там сухо. І светр вдягніть, холодає!",
          },
        ],
      },
    },
  },
);

export const TREES = { "pani-natalia": NATALIA };
