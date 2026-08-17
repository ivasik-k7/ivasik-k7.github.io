import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HUD } from "@/components/game/Hud";
import { Panel } from "@/components/game/Panel";
import { StatusMenu } from "@/components/game/StatusMenu";
import { Terminal } from "@/components/game/Terminal";
import {
  type AmbienceName,
  ambience,
  FpsMeter,
  GameRuntime,
  lofiPlayer,
  type RuntimeApi,
  type RuntimeConfig,
} from "@/engine";
import type { PanelId, RoomId } from "@/lib/apartment";
import {
  type DayPhase,
  dayPhase,
  ITEM_LABEL,
  initialWorld,
  type WorldState,
} from "@/lib/worldState";
import { paletteForAppearanceCached } from "./appearance";
import { CharacterMonologue } from "./CharacterMonologue";
import { APARTMENT_HANDLERS } from "./handlers";
import { OUTSIDE_SCENES } from "./outsideScenes";
import { PLAYER } from "./player";
import { APARTMENT_SCENES } from "./scenes";
import { WardrobePanel } from "./WardrobePanel";

type Overlay =
  | { type: "panel"; id: PanelId }
  | { type: "terminal" }
  | { type: "menu" }
  | { type: "wardrobe" };

const SCENES = { ...APARTMENT_SCENES, ...OUTSIDE_SCENES };

/** What pressing E actually does, by object kind — shown on the interact chip. */
const VERB: Record<string, string> = {
  npc: "TALK",
  cashier: "TALK",
  dog: "PET",
  door: "ENTER",
  flatdoor: "ENTER",
  creakdoor: "ENTER",
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
/** Stable identity so onReady fires once, not on every EngineGame render. */
function exposeGameApi(api: RuntimeApi<WorldState>) {
  (window as unknown as { __game: RuntimeApi<WorldState> }).__game = api;
}

export function EngineGame() {
  const { t } = useTranslation();
  const [visited, setVisited] = useState<string[]>([]);
  // dev/test convenience: ?nointro drops straight in, ?scene=zabka spawns there
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const skipIntro = true;
  // const skipIntro = Boolean(params?.has("nointro"));
  const showFps = Boolean(params?.has("fps"));
  const showDebug = Boolean(params?.has("debug"));
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
        onOpenPanel={(id) => openOverlay({ type: "panel", id })}
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
      if (o.type === "panel") return <Panel key="panel" id={o.id} onClose={close} />;
      if (o.type === "terminal") return <Terminal key="terminal" onClose={close} />;
      if (o.type === "wardrobe")
        return (
          <WardrobePanel key="wardrobe" world={world} updateWorld={updateWorld} onClose={close} />
        );
      return (
        <StatusMenu
          key="menu"
          world={world}
          visited={visited}
          scenes={Object.keys(SCENES)}
          onClose={close}
        />
      );
    },
    renderExtras: showFps ? () => <FpsMeter /> : undefined,
    debug: showDebug,
    // dev/test hook: lets CDP scripts and Playwright drive the game directly
    onReady: import.meta.env.DEV ? exposeGameApi : undefined,
    menuOverlay: { type: "menu" },
    onSceneChange: (scene) => {
      ambience.set(AMBIENCE[scene] ?? "room");
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
