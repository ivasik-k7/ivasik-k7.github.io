import { t } from "i18next";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PanelId } from "@/components/game/Hud";
import { HUD } from "@/components/game/Hud";
import { MenuScreen, type MenuTab, PANEL_TAB } from "@/components/game/MenuScreen";
import { Terminal } from "@/components/game/Terminal";
import {
  type AmbienceName,
  ambience,
  FpsMeter,
  GameRuntime,
  loadGame,
  lofiPlayer,
  Monologue,
  type RuntimeApi,
  type RuntimeConfig,
  type RuntimeSceneDef,
} from "@/engine";
import {
  bestTier,
  type DayPhase,
  dayPhase,
  ITEM_LABEL,
  initialWorld,
  recordTier,
  studioState,
  type WorldState,
} from "@/lib/worldState";
import { PauseMenu } from "../menu/PauseMenu";
import { PLACE_NAME, SAVE_KEY, SAVE_VERSION } from "../menu/saveSummary";
import { normalizeAppearance, paletteForAppearanceCached, playerForAppearance } from "./appearance";
import { OPENING_START, openingCutscene, openingEnd } from "./cutscenes";
import { APARTMENT_HANDLERS } from "./handlers";
import { OUTSIDE_SCENES } from "./outsideScenes";
import { PLAYER } from "./player";
import { RouteMap } from "./RouteMap";
import { APARTMENT_SCENES } from "./scenes";
import { WardrobePanel } from "./WardrobePanel";

/**
 * The two developer benches load only when somebody opens one. Importing them
 * statically pulled the whole cast and kennel into the boot path, and
 * enumerating either registry builds every rig in it — measured at 1.8 s of
 * frame assembly before the first paint, for a flat containing one dog and one
 * person.
 */
const NpcStudio = lazy(() => import("./NpcStudio").then((m) => ({ default: m.NpcStudio })));
const PlayerStudio = lazy(() =>
  import("./PlayerStudio").then((m) => ({ default: m.PlayerStudio })),
);
/** Minigames ride their own chunks; nobody pays for the bankomat at boot. */
const Bankomat = lazy(() => import("../minigames/Bankomat").then((m) => ({ default: m.Bankomat })));
const Guitar = lazy(() => import("../minigames/Guitar").then((m) => ({ default: m.Guitar })));
const Dance = lazy(() => import("../minigames/Dance").then((m) => ({ default: m.Dance })));
const Driving = lazy(() => import("../minigames/Driving").then((m) => ({ default: m.Driving })));
const BowlsGame = lazy(() => import("../minigames/Bowls").then((m) => ({ default: m.Bowls })));

type Overlay =
  | { type: "panel"; id: PanelId }
  | { type: "bankomat" }
  | { type: "guitar" }
  | { type: "dance" }
  | { type: "driving" }
  | { type: "bowls" }
  | { type: "terminal" }
  | { type: "menu" }
  | { type: "wardrobe" }
  | { type: "pause" }
  | { type: "routemap" };

/**
 * You should be able to start a conversation from conversational distance —
 * standing far enough apart to see each other, the way people actually talk on
 * a landing. Scene files size their hitboxes for objects you reach out and
 * touch; for people that reads as having to stand on their toes, so every NPC
 * gets a wider range here rather than in a dozen scene files that get rewritten.
 */
/** 64 game px is about 1.7 m at this scale: close enough to talk, far enough to see. */
const TALKING_DISTANCE = 64;

function widenPeople(scene: RuntimeSceneDef<WorldState>): RuntimeSceneDef<WorldState> {
  for (const obj of scene.objects) {
    if (obj.kind === "npc" || obj.kind === "cashier") {
      obj.range = Math.max(obj.range ?? 0, TALKING_DISTANCE);
    }
  }
  return scene;
}

/**
 * Every scene is a code-split chunk (see scenes.tsx / outsideScenes.tsx); the
 * widening applies as each one's loader resolves. The engine caches resolved
 * defs, so this runs once per scene per session.
 */
const SCENES = Object.fromEntries(
  Object.entries({ ...APARTMENT_SCENES, ...OUTSIDE_SCENES }).map(([key, load]) => [
    key,
    () => load().then(widenPeople),
  ]),
);

/** What pressing E actually does, by object kind — shown on the interact chip. */
/** Verb keys by object kind, resolved through `t("verb.*")` at render. */
const VERB: Record<string, string> = {
  npc: "talk",
  cashier: "talk",
  dog: "pet",
  door: "enter",
  flatdoor: "enter",
  creakdoor: "enter",
  trainDoor: "board",
  biletomat: "buy",
  kasownik: "punch",
  konduktor: "talk",
  trainExit: "getOff",
  routemap: "read",
  stairs: "enter",
  liftdoors: "open",
  liftbutton: "call",
  liftpanel: "press",
  panel: "view",
  computer: "use",
  openable: "open",
  zfridge: "open",
  zfreezer: "open",
  extcabinet: "open",
  bins: "open",
  parcel: "take",
  paczkomat: "check",
  sport: "train",
  bed: "rest",
  tv: "watch",
  radio: "listen",
  kettle: "brew",
  coffee: "brew",
  cooker: "cook",
  plant: "water",
  dishes: "wash",
  binbag: "empty",
  bowls: "feed",
  lamp: "switch",
  window: "look",
  flavor: "look",
  car: "look",
  mycar: "keys",
  guitar: "play",
  bath: "shower",
  /* Ulica Elektryków and the club */
  barman: "order",
  frytki: "order",
  clubbar: "order",
  clubdoor: "enter",
  portaloo: "use",
  dance: "dance",
  speaker: "feel",
  earplugs: "take",
  clubfuse: "peek",
  festoon: "switch",
  bankomat: "use",
};

/** Which sound bed each location breathes. */
const AMBIENCE: Record<string, AmbienceName> = {
  studio: "room",
  hallway: "room",
  kitchen: "room",
  living: "room",
  study: "room",
  bath: "room",
  balcony: "street",
  corridor: "stairwell",
  elevator: "stairwell",
  outside: "street",
  zabka: "shop",
  parking: "parking",
  gym: "stairwell",
  district: "street",
  forum: "street",
  /* the carriage had no bed at all and rode in silence */
  train: "train",
  elektrykow: "street",
  /* the club: the parking bed's low concrete rumble is the closest thing this
     game has to bass through a wall, which is exactly what it is */
  raveclub: "parking",
};

/**
 * Which SKM station a scene belongs to — for ringing "where you got on" on the
 * route map. Read off the scene the player was in *before* boarding, because
 * by the time the map is open the current scene is always "train".
 */
const SCENE_STATION: Record<string, string> = {
  /* "station" is resolved from world.station.at at scene change — the one
     scene here that is more than one place */
  district: "oliwa",
  forum: "gdansk",
  elektrykow: "stocznia",
  raveclub: "stocznia",
};

/** Which station the generic platform is being right now. */
function stationIdOf(world: WorldState | undefined): string {
  const at = (world as unknown as { station?: { at?: unknown } } | undefined)?.station?.at;
  return typeof at === "string" ? at : "przymorze";
}

/**
 * The full game, assembled on the Scene Engine: the original apartment
 * plus the stairwell, the lift, the yard and the Żabka on the corner.
 */
/**
 * Stable identity so `onReady` fires once, not on every EngineGame render.
 *
 * It also keeps a module-level handle on the runtime, because two overlays need
 * to move the player and `renderOverlay` is handed `world` and `updateWorld` but
 * not `travel` — and the route map's whole purpose is to travel. Rather than
 * widen the engine's overlay contract for one caller, the game holds on to the
 * api it is already given here.
 */
let runtimeApi: RuntimeApi<WorldState> | null = null;
/** Armed by a fresh mount; the opening plays once the runtime hands over its api. */
let openingPending = false;

function playOpening(api: RuntimeApi<WorldState>) {
  // start at once so the keys are his from the first frame — the sequence
  // itself opens on a beat of silence while the scene draws and the fade lifts
  api.runSequence(openingCutscene(), { cinematic: true, skippable: true }).then((finished) => {
    if (finished) return;
    // skipped: the flat still ends up the way the morning would have left it
    api.updateWorld(openingEnd);
    api.runSequence([{ say: t("cut.skip") }]);
  });
}

function exposeGameApi(api: RuntimeApi<WorldState>) {
  runtimeApi = api;
  if (openingPending) {
    openingPending = false;
    playOpening(api);
  }
  // dev always; production only when asked for by the drive/bench harness
  // (scripts/drive-game.mjs, scripts/bench-game.mjs) via ?drive=1 — perf
  // baselines must run against the real build, not the dev server
  if (import.meta.env.DEV || new URLSearchParams(window.location.search).has("drive")) {
    (window as unknown as { __game: RuntimeApi<WorldState> }).__game = api;
  }
}

export function EngineGame({ onQuit }: { onQuit?: () => void } = {}) {
  const { t } = useTranslation();
  const [visited, setVisited] = useState<string[]>([]);
  const [here, setHere] = useState<string>("studio");
  // the last SKM station the player was at on foot — what the route map rings
  const [boardedAt, setBoardedAt] = useState<string>("przymorze");
  // dev/test convenience: ?nointro drops straight in, ?scene=zabka spawns there
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const skipIntro = true;
  // const skipIntro = Boolean(params?.has("nointro"));
  const showFps = Boolean(params?.has("fps"));
  const [studio, setStudio] = useState(Boolean(params?.has("npcs")));
  const [bench, setBench] = useState(Boolean(params?.has("player")));
  // the bench reads the frame rate off the runtime's debug sampler, which only
  // runs when debug is on — so opening it turns sampling on
  const showDebug = Boolean(params?.has("debug")) || bench;
  const devScene = params?.get("scene");
  /**
   * A new game has no save yet (New Game wipes the slot before this mounts).
   * That is the one moment the opening plays: he wakes by the dog and talks
   * you through the flat. A continued game starts where it was left.
   */
  const [fresh] = useState(() => {
    const isFresh = loadGame(SAVE_KEY, SAVE_VERSION) === null && !devScene;
    openingPending = isFresh;
    return isFresh;
  });
  const devX = Number(params?.get("x"));
  const devWorld = params
    ? {
        ...initialWorld,
        appearance: normalizeAppearance({
          ...initialWorld.appearance,
          ...Object.fromEntries(
            Object.keys(initialWorld.appearance)
              .filter((k) => params.has(k))
              .map((k) => [k, params.get(k) as string]),
          ),
        }),
      }
    : initialWorld;

  const config: RuntimeConfig<WorldState> = {
    scenes: SCENES,
    /**
     * The save. The runtime has owned autosave and restore since it was
     * written and nothing had ever configured it, so every session began in
     * the flat with fifty złoty and the title screen had no Continue to offer.
     *
     * It is always on. New Game does not turn persistence off — it wipes the
     * slot before mounting, so a fresh game still saves from its first step.
     */
    persist: { key: SAVE_KEY, version: SAVE_VERSION },
    start:
      devScene && SCENES[devScene]
        ? { scene: devScene, x: Number.isFinite(devX) && devX > 0 ? devX : 100 }
        : fresh
          ? { ...OPENING_START }
          : { scene: "studio", x: 70 },
    initialWorld: devWorld,
    player: PLAYER,
    promptSwitchLabel: () => t("prompt.switch"),
    playerFor: (w) => playerForAppearance(w.appearance),
    handlers: APARTMENT_HANDLERS,
    objectLabel: (obj) => t(`obj.${obj.id}`),
    /* "sport" covers both the gym rigs (TRAIN) and street/platform benches — the
     * action tells them apart: sitting down is not a workout. */
    objectVerb: (obj) =>
      t(
        `verb.${obj.kind === "sport" && obj.action?.startsWith("sit") ? "sit" : (VERB[obj.kind] ?? "use")}`,
      ),
    dayPhase: () => dayPhase(new Date().getHours()),
    renderHud: (scene, world, phase, openOverlay) => (
      <HUD
        /* the generic platform names itself by which station it currently is */
        room={scene === "station" ? `station-${stationIdOf(world)}` : scene}
        phase={phase as DayPhase}
        visited={visited}
        onOpenMenu={() => openOverlay({ type: "menu" })}
        pocket={{
          money: `${world.money} zł`,
          items: world.inventory.map((item) => {
            const label = t(`item.${item.itemId}`, {
              defaultValue: ITEM_LABEL[item.itemId] ?? item.itemId.toUpperCase(),
            });
            return item.quantity > 1 ? `${label} ×${item.quantity}` : label;
          }),
        }}
      />
    ),
    playerAppearance: (w) => paletteForAppearanceCached(w.appearance),
    renderMonologue: (toast, scale) => (
      <Monologue kind="thought" scale={scale} text={toast?.text ?? null} contentKey={toast?.id} />
    ),
    renderOverlay: (overlay, close, world, updateWorld) => {
      const o = overlay as Overlay;
      if (o.type === "driving")
        return (
          <Suspense key="driving" fallback={<div className="absolute inset-0 bg-black/85" />}>
            <Driving
              best={bestTier(world, "driving")}
              onClose={close}
              onVerdict={(tier) => updateWorld((w) => recordTier(w, "driving", tier))}
            />
          </Suspense>
        );
      if (o.type === "bowls")
        return (
          <Suspense key="bowls" fallback={<div className="absolute inset-0 bg-black/85" />}>
            <BowlsGame
              best={bestTier(world, "bowls")}
              onClose={close}
              onVerdict={(tier) =>
                updateWorld((w) => ({
                  ...recordTier(w, "bowls", tier),
                  /* however it went, he has been fed: the chore is done */
                  studio: { ...studioState(w), bowlsFilled: true },
                }))
              }
            />
          </Suspense>
        );
      if (o.type === "dance")
        return (
          <Suspense key="dance" fallback={<div className="absolute inset-0 bg-black/85" />}>
            <Dance
              best={bestTier(world, "dance")}
              onClose={close}
              onVerdict={(tier) => updateWorld((w) => recordTier(w, "dance", tier))}
            />
          </Suspense>
        );
      if (o.type === "guitar")
        return (
          <Suspense key="guitar" fallback={<div className="absolute inset-0 bg-black/85" />}>
            <Guitar
              best={bestTier(world, "guitar")}
              onClose={close}
              onVerdict={(tier) => updateWorld((w) => recordTier(w, "guitar", tier))}
            />
          </Suspense>
        );
      if (o.type === "bankomat")
        return (
          <Suspense key="bankomat" fallback={<div className="absolute inset-0 bg-black/85" />}>
            <Bankomat
              money={world.money}
              account={world.account ?? 0}
              onWithdraw={(amount) =>
                updateWorld((w) => ({
                  ...w,
                  money: w.money + amount,
                  account: (w.account ?? 0) - amount,
                }))
              }
              onClose={close}
            />
          </Suspense>
        );
      if (o.type === "pause")
        return (
          <PauseMenu
            key="pause"
            onResume={close}
            onQuit={() => {
              close();
              onQuit?.();
            }}
            place={t(`hud.${here}`, { defaultValue: PLACE_NAME[here] ?? here })}
          />
        );
      if (o.type === "routemap")
        return (
          <RouteMap
            key="routemap"
            here={boardedAt}
            onClose={close}
            onTravel={(scene, x, stationAt) => {
              close();
              /**
               * The generic platform: stops that share the "station" scene
               * carry which station it should wake up wearing. Written BEFORE
               * the travel, so the scene's first paint already has the right
               * name on its boards.
               */
              if (stationAt) {
                runtimeApi?.updateWorld(
                  (w) =>
                    ({
                      ...w,
                      station: {
                        ...((w as unknown as { station?: object }).station ?? {}),
                        at: stationAt,
                      },
                    }) as typeof w,
                );
              }
              runtimeApi?.travel(scene, x);
            }}
          />
        );
      if (o.type === "terminal") return <Terminal key="terminal" onClose={close} />;
      if (o.type === "wardrobe")
        return (
          <WardrobePanel key="wardrobe" world={world} updateWorld={updateWorld} onClose={close} />
        );
      // panels and the menu are the same book — the object just picks the page
      const tab: MenuTab = o.type === "panel" ? (PANEL_TAB[o.id] ?? "profile") : "profile";
      return (
        <MenuScreen
          key="menu"
          world={world}
          visited={visited}
          current={here}
          initialTab={tab}
          onClose={close}
        />
      );
    },
    renderExtras:
      showFps || studio || bench
        ? () => (
            <>
              {showFps ? <FpsMeter /> : null}
              <Suspense fallback={null}>
                {studio ? <NpcStudio onClose={() => setStudio(false)} /> : null}
                {bench ? <PlayerStudio onClose={() => setBench(false)} /> : null}
              </Suspense>
            </>
          )
        : undefined,
    debug: showDebug,
    // the bench shows the same numbers, better laid out and in the same visual
    // language; two overlapping readouts in the top-left corner is just noise
    // returning null would fall straight through the runtime's `?? default`,
    // so this hands back an empty fragment instead
    renderDebug: bench ? () => <></> : undefined,
    // dev/test hook: lets CDP scripts and Playwright drive the game directly
    onReady: exposeGameApi,
    menuOverlay: { type: "menu" },
    // Escape, when it has nothing else to back out of
    pauseOverlay: { type: "pause" },
    onSceneChange: (scene) => {
      ambience.set(AMBIENCE[scene] ?? "room");
      setHere(scene);
      if (scene === "station") setBoardedAt(stationIdOf(runtimeApi?.getWorld()));
      else if (SCENE_STATION[scene]) setBoardedAt(SCENE_STATION[scene]);
      setVisited((v) => (v.includes(scene) ? v : [...v, scene]));
    },
    onFirstGesture: () => {
      lofiPlayer.unlock();
      lofiPlayer.play();
      ambience.applyPending();
    },
    renderIntro: skipIntro
      ? undefined
      : (dismiss) => (
          <button
            type="button"
            className="absolute inset-0 z-40 flex cursor-pointer flex-col items-center justify-center gap-6 bg-[#0a0810] text-center"
            onClick={dismiss}
          >
            <p className="text-parchment/50 text-xs tracking-[0.4em]">{t("intro.small")}</p>
            <h1 className="font-mono text-2xl text-parchment tracking-[0.35em] sm:text-4xl">
              {t("intro.title")}
            </h1>
            <p className="max-w-sm px-6 text-parchment/60 text-sm leading-relaxed">
              {t("intro.sub")}
            </p>
            <p className="mt-4 animate-pulse text-signal text-sm tracking-[0.3em]">
              {t("intro.start")}
            </p>
          </button>
        ),
  };

  return <GameRuntime config={config} />;
}
