import { useTranslation } from "react-i18next";
import { Panel } from "@/components/game/Panel";
import { StatusMenu } from "@/components/game/StatusMenu";
import {
  ACTIONS,
  PLAYER_FRAMES,
  PLAYER_H,
  PLAYER_PALETTE,
  PLAYER_W,
  WALK_CYCLE,
} from "@/components/game/sprites";
import { Terminal } from "@/components/game/Terminal";
import { type AmbienceName, ambience, type GameConfig, GameRuntime, lofiPlayer } from "@/engine";
import type { PanelId } from "@/lib/apartment";
import { dayPhase, initialWorld, type WorldState } from "@/lib/worldState";
import { GameHud } from "./GameHud";
import { APARTMENT_HANDLERS } from "./handlers";
import { OUTSIDE_SCENES } from "./outsideScenes";
import { APARTMENT_SCENES } from "./scenes";

type Overlay = { type: "panel"; id: PanelId } | { type: "terminal" } | { type: "menu" };

const SCENES = { ...APARTMENT_SCENES, ...OUTSIDE_SCENES };

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
};

/**
 * The full game, assembled on the Scene Engine: the original apartment
 * plus the stairwell, the lift, the yard and the Żabka on the corner.
 */
export function EngineGame() {
  const { t } = useTranslation();
  // dev/test convenience: ?nointro drops straight in, ?scene=zabka spawns there
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const skipIntro = Boolean(params?.has("nointro"));
  const devScene = params?.get("scene");
  const devX = Number(params?.get("x"));

  const config: GameConfig<WorldState> = {
    scenes: SCENES,
    start:
      devScene && SCENES[devScene]
        ? { scene: devScene, x: Number.isFinite(devX) && devX > 0 ? devX : 100 }
        : { scene: "studio", x: 70 },
    initialWorld,
    player: {
      width: PLAYER_W,
      height: PLAYER_H,
      palette: PLAYER_PALETTE,
      frames: PLAYER_FRAMES,
      walkCycle: WALK_CYCLE,
      actions: ACTIONS,
    },
    handlers: APARTMENT_HANDLERS,
    objectLabel: (obj) => t(`obj.${obj.id}`),
    dayPhase: () => dayPhase(new Date().getHours()),
    renderHud: (scene, world, phase) => <GameHud scene={scene} world={world} phase={phase} />,
    renderOverlay: (overlay, close, world) => {
      const o = overlay as Overlay;
      if (o.type === "panel") return <Panel key="panel" id={o.id} onClose={close} />;
      if (o.type === "terminal") return <Terminal key="terminal" onClose={close} />;
      return (
        <StatusMenu key="menu" dogPets={world.dogPets} teaMade={world.kettleOn} onClose={close} />
      );
    },
    menuOverlay: { type: "menu" },
    onSceneChange: (scene) => ambience.set(AMBIENCE[scene] ?? "room"),
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
