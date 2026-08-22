import type { DialogueTree } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import type { Ctx } from "./types";

/**
 * The dialogue registry — every conversation in the game, by object id,
 * loaded lazily so each scene's words ride a chunk of their own instead of
 * the boot path. A value is either a finished tree or a builder that reads
 * the world at open time (the commerce trees embed the money line).
 *
 * The station deliberately reuses the street cast: the same regulars
 * commute, and npcMemory is bound per PERSON — being recognized on the
 * platform by the babcia you know from the yard is the entire point.
 */
type TreeSource = DialogueTree<Ctx> | ((world: WorldState) => DialogueTree<Ctx>);
type Loader = () => Promise<TreeSource>;

const street =
  (pick: string): Loader =>
  () =>
    import("./street").then((m) => (m.TREES as Record<string, DialogueTree<Ctx>>)[pick]);

export const DIALOGUE: Record<string, Loader> = {
  /* the building */
  "pani-natalia": () => import("./corridor").then((m) => m.NATALIA),
  marek: () => import("./parking").then((m) => m.MAREK),
  "lift-panel": () => import("./elevator").then((m) => m.LIFT_PANEL),

  /* the yard and the corner */
  smoker: street("smoker"),
  babcia: street("babcia"),
  zbyszek: street("zbyszek"),
  courier: street("courier"),
  trener: () => import("./gym").then((m) => m.TRENER),
  golebiarka: street("golebiarka"),
  student: street("student"),
  "waiting-man": street("waiting-man"),
  cashier: () => import("./zabka").then((m) => m.buildCashierTree),

  /* on the 17:40 */
  konduktor: () => import("./train").then((m) => m.buildConductorTree),
  jeanne: () => import("./train").then((m) => m.JEANNE),
  "train-spawacz": () => import("./train").then((m) => m.SPAWACZ),
  "train-pielegniarka": () => import("./train").then((m) => m.PIELEGNIARKA),

  /* on the platform — the same people, elsewhere in their day */
  "station-reader": street("student"),
  "station-bench-sitter": street("babcia"),
  "station-phone": street("waiting-man"),
  "station-looker": street("waiting-man"),
  "station-smoker": street("smoker"),
  "station-golebiarka": street("golebiarka"),

  /* Ulica Elektryków */
  bramkarz: () => import("./elektrykow").then((m) => m.BRAMKARZ),
  "queue-girl": () => import("./elektrykow").then((m) => m.QUEUE_GIRL),
  filozof: () => import("./elektrykow").then((m) => m.FILOZOF),
  starer: () => import("./elektrykow").then((m) => m.STARER),
  barmanka: () => import("./elektrykow").then((m) => m.buildBarmankaTree),
  frytkarz: () => import("./elektrykow").then((m) => m.buildFrytkarzTree),

  /* inside Turbina */
  "dj-booth": () => import("./raveclub").then((m) => m.DJ),
  "tired-girl": () => import("./raveclub").then((m) => m.TIRED),
  "club-cleaner": () => import("./raveclub").then((m) => m.CLEANER),
  "club-couple": () => import("./raveclub").then((m) => m.COUPLE),
  "wc-queue": () => import("./raveclub").then((m) => m.WC_QUEUE),
  "club-caller": () => import("./raveclub").then((m) => m.CLUB_CALLER),
  "club-technik": () => import("./raveclub").then((m) => m.TECHNIK),
  klubowy: () => import("./raveclub").then((m) => m.buildKlubowyTree),

  /* the Golf's tree is stateful; the handler passes the lock through */
};

const cache = new Map<string, TreeSource>();

/**
 * Open the conversation registered for an object id. First open in a session
 * awaits the scene's dialogue chunk (a few KB, usually already warm); every
 * later open is synchronous. Unknown ids fall back to Pan Marek, the game's
 * traditional answer to talking to someone unexpected.
 */
export function openDialogueFor(ctx: Ctx, id: string): void {
  const cached = cache.get(id);
  if (cached) {
    open(ctx, cached);
    return;
  }
  const load = DIALOGUE[id] ?? DIALOGUE.marek;
  void load().then((source) => {
    cache.set(id, source);
    open(ctx, source);
  });
}

function open(ctx: Ctx, source: TreeSource): void {
  const tree = typeof source === "function" ? source(ctx.world) : source;
  ctx.startDialogue(tree as DialogueTree<never>);
}
