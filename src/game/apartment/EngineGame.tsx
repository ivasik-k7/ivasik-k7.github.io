import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { HUD } from "@/components/game/Hud";
import { MenuScreen, type MenuTab, PANEL_TAB } from "@/components/game/MenuScreen";
import { Terminal } from "@/components/game/Terminal";
import {
  type AmbienceName,
  ambience,
  FpsMeter,
  GameRuntime,
  lofiPlayer,
  type RuntimeApi,
  type RuntimeConfig,
  type RuntimeSceneDef,
} from "@/engine";
import type { PanelId, RoomId } from "@/lib/apartment";
import {
  type DayPhase,
  dayPhase,
  ITEM_LABEL,
  initialWorld,
  type WorldState,
} from "@/lib/worldState";
import { PauseMenu } from "../menu/PauseMenu";
import { PLACE_NAME, SAVE_KEY, SAVE_VERSION } from "../menu/saveSummary";
import { paletteForAppearanceCached } from "./appearance";
import { CharacterMonologue } from "./CharacterMonologue";
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

type Overlay =
  | { type: "panel"; id: PanelId }
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

function widenPeople(scenes: Record<string, RuntimeSceneDef<WorldState>>) {
  for (const scene of Object.values(scenes)) {
    for (const obj of scene.objects) {
      if (obj.kind === "npc" || obj.kind === "cashier") {
        obj.range = Math.max(obj.range ?? 0, TALKING_DISTANCE);
      }
    }
  }
  return scenes;
}

const SCENES = widenPeople({ ...APARTMENT_SCENES, ...OUTSIDE_SCENES });

/** What pressing E actually does, by object kind — shown on the interact chip. */
const VERB: Record<string, string> = {
  npc: "TALK",
  cashier: "TALK",
  dog: "PET",
  door: "ENTER",
  flatdoor: "ENTER",
  creakdoor: "ENTER",
  trainDoor: "BOARD",
  biletomat: "BUY",
  konduktor: "TALK",
  trainExit: "GET OFF",
  routemap: "READ",
  stairs: "ENTER",
  liftdoors: "OPEN",
  liftbutton: "CALL",
  liftpanel: "PRESS",
  panel: "VIEW",
  computer: "USE",
  openable: "OPEN",
  zfridge: "OPEN",
  zfreezer: "OPEN",
  extcabinet: "OPEN",
  bins: "OPEN",
  parcel: "TAKE",
  paczkomat: "CHECK",
  sport: "TRAIN",
  bed: "REST",
  tv: "WATCH",
  radio: "LISTEN",
  kettle: "BREW",
  coffee: "BREW",
  cooker: "COOK",
  plant: "WATER",
  lamp: "SWITCH",
  window: "LOOK",
  flavor: "LOOK",
  car: "LOOK",
  mycar: "KEYS",
  guitar: "PLAY",
  bath: "SHOWER",
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
};

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

function exposeGameApi(api: RuntimeApi<WorldState>) {
  runtimeApi = api;
  if (import.meta.env.DEV) {
    (window as unknown as { __game: RuntimeApi<WorldState> }).__game = api;
  }
}

export function EngineGame({ onQuit }: { onQuit?: () => void } = {}) {
  const { t } = useTranslation();
  const [visited, setVisited] = useState<string[]>([]);
  const [here, setHere] = useState<string>("studio");
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
  const devX = Number(params?.get("x"));
  const devWorld = params
    ? {
        ...initialWorld,
        appearance: {
          skin: params.get("skin") ?? initialWorld.appearance.skin,
          hair: params.get("hair") ?? initialWorld.appearance.hair,
          beard: params.get("beard") ?? initialWorld.appearance.beard,
          hat: params.get("hat") ?? initialWorld.appearance.hat,
          shirt: params.get("shirt") ?? initialWorld.appearance.shirt,
          trousers: params.get("trousers") ?? initialWorld.appearance.trousers,
          shoes: params.get("shoes") ?? initialWorld.appearance.shoes,
        },
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
        : { scene: "studio", x: 70 },
    initialWorld: devWorld,
    player: PLAYER,
    handlers: APARTMENT_HANDLERS,
    objectLabel: (obj) => t(`obj.${obj.id}`),
    objectVerb: (obj) => VERB[obj.kind] ?? "USE",
    dayPhase: () => dayPhase(new Date().getHours()),
    renderHud: (scene, world, phase, openOverlay) => (
      <HUD
        room={scene as RoomId}
        phase={phase as DayPhase}
        visited={visited}
        onOpenMenu={() => openOverlay({ type: "menu" })}
        pocket={{
          money: `${world.money} zł`,
          items: world.inventory.map((item) => {
            const label = ITEM_LABEL[item.itemId] ?? item.itemId.toUpperCase();
            return item.quantity > 1 ? `${label} ×${item.quantity}` : label;
          }),
        }}
      />
    ),
    playerAppearance: (w) => paletteForAppearanceCached(w.appearance),
    renderMonologue: (toast, scale) => <CharacterMonologue toast={toast} scale={scale} />,
    renderOverlay: (overlay, close, world, updateWorld) => {
      const o = overlay as Overlay;
      if (o.type === "pause")
        return (
          <PauseMenu
            key="pause"
            onResume={close}
            onQuit={() => {
              close();
              onQuit?.();
            }}
            place={PLACE_NAME[here] ?? here}
          />
        );
      if (o.type === "routemap")
        return (
          <RouteMap
            key="routemap"
            here={here === "station" ? "przymorze" : "oliwa"}
            onClose={close}
            onTravel={(scene, x) => {
              close();
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
