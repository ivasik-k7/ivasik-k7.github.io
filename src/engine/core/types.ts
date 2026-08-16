import type { ComponentType, ReactNode } from "react";

/**
 * Scene Engine — core types.
 *
 * The engine is deliberately game-agnostic: it knows nothing about kettles,
 * dogs or Żabka. A game supplies scenes (artwork + object layout), a player
 * sprite sheet, and a table of interaction handlers keyed by object `kind`.
 * The engine owns the loop: input, movement, camera, proximity, action
 * animation, scene travel, toasts and overlays.
 */

// --- world state -------------------------------------------------------------

/** Games define their own world shape; the engine treats it as opaque. */
export type AnyWorld = object;

// --- player sprite -----------------------------------------------------------

/**
 * A pixel map: rows of palette characters ("." and " " are transparent),
 * rendered as crisp rects at `cell` logical px per character.
 */
export type SpriteMap = readonly string[];

export type SpritePalette = Readonly<Record<string, string>>;

export interface ActionDef {
  /** Frame names cycled while the action plays. */
  frames: readonly string[];
  /** ms per frame. */
  frameMs: number;
  /** Total loops of the frame list (duration = frames.length * frameMs * loops). */
  loops: number;
  /** Walking cancels the action instead of waiting it out. */
  interruptible?: boolean;
}

export interface PlayerConfig<F extends string = string> {
  /** Rendered size in logical px (cells × cell). */
  width: number;
  height: number;
  palette: SpritePalette;
  frames: Record<F, SpriteMap>;
  walkCycle: readonly F[];
  actions: Record<string, ActionDef>;
  /** Logical px per sprite cell (default 2). */
  cell?: number;
  walkSpeed?: number;
}

// --- scene objects -----------------------------------------------------------

export interface SceneObject {
  /** Unique across the whole game; also your i18n key suffix. */
  id: string;
  /** Dispatch key into the game's interaction handler table. */
  kind: string;
  /** Interaction center, in logical scene px. */
  x: number;
  /** Proximity radius; DEFAULT_RANGE when omitted. */
  range?: number;
  /** Doors: travel target. Handled by the engine's built-in `door` handler. */
  to?: { scene: string; spawnX: number };
  /** Sport-style objects: which player action animation to run. */
  action?: string;
  /** Force facing during interaction (sit facing the TV). */
  face?: 1 | -1;
  /** Free-form payload for game handlers (panel ids, prices, …). */
  data?: unknown;
}

// --- scenes ------------------------------------------------------------------

export interface SceneRenderProps<W extends AnyWorld = AnyWorld> {
  world: W;
  /** Real-world day phase or whatever the game passes through. */
  phase: string;
}

export interface SceneDef<W extends AnyWorld = AnyWorld> {
  id: string;
  /** Logical width; height is always SCENE_HEIGHT. */
  width: number;
  objects: SceneObject[];
  /** The artwork: an <svg> (or fragment) drawn on the width×180 canvas. */
  Component: ComponentType<SceneRenderProps<W>>;
  /**
   * 0..1 darkness multiplied over the scene (day phase, lights off).
   * Omit for scenes that paint their own sky/lighting.
   */
  darkness?: (phase: string, world: W) => number;
  /**
   * Drawn in front of the player (parapets, counters). Self-positioned:
   * the component brings its own absolutely-placed <svg> overlay.
   */
  Foreground?: ComponentType<SceneRenderProps<W>>;
  /** World-aware overlay FX inside the scene (steam, notes, hearts). */
  Effects?: ComponentType<
    SceneRenderProps<W> & {
      fx: FxInstance[];
      scale: number;
      actionUi: string | null;
      /** True while the player is walking — drive motion-sensor lights etc. */
      moving: boolean;
      /** True while a dialogue box is open — mute ambient chatter. */
      dialogueOpen: boolean;
    }
  >;
  /** Player leans instead of stretching during idle flourish. */
  idleLean?: boolean;
}

// --- ephemeral FX ------------------------------------------------------------

export interface FxInstance {
  id: number;
  kind: string;
  x: number;
  data?: unknown;
}

// --- interaction handlers ------------------------------------------------------

export interface InteractionCtx<W extends AnyWorld = AnyWorld> {
  obj: SceneObject;
  world: W;
  /** Single write path — keeps React state and the rAF-side ref in sync. */
  updateWorld: (patch: Partial<W> | ((w: W) => W)) => void;
  showToast: (text: string) => void;
  /** Run a player action animation (id must exist in PlayerConfig.actions). */
  startAction: (id: string, opts?: { onInterrupt?: () => void }) => void;
  /** Fade out, switch scene, fade in. */
  travel: (scene: string, spawnX: number) => void;
  /** Slow fade to black, hold, fade back, then toast (toilet, bath…). */
  blackout: (holdMs: number, text: string) => void;
  /** Hand an opaque overlay object to the game's overlay renderer. */
  openOverlay: (overlay: unknown) => void;
  /** Spawn a scene FX (heart above the dog…); auto-removed after ttlMs. */
  spawnFx: (kind: string, x: number, ttlMs: number, data?: unknown) => void;
  /** Queue a delayed toast, auto-cancelled if the current action is interrupted. */
  queueToast: (text: string, delayMs: number) => void;
  /** Open a branching dialogue (see systems/dialogue). */
  startDialogue: (tree: unknown) => void;
  /** Current scene id. */
  scene: string;
}

export type InteractionHandler<W extends AnyWorld = AnyWorld> = (ctx: InteractionCtx<W>) => void;

// --- runtime config ------------------------------------------------------------

export interface GameConfig<W extends AnyWorld = AnyWorld> {
  scenes: Record<string, SceneDef<W>>;
  start: { scene: string; x: number };
  initialWorld: W;
  player: PlayerConfig;
  /** Handler table by object kind. `door` is built in but can be overridden. */
  handlers: Record<string, InteractionHandler<W>>;
  /** Label for the "▸ OBJECT [E]" prompt. */
  objectLabel: (obj: SceneObject) => string;
  /** Day phase fed to scenes; re-evaluated every minute. */
  dayPhase?: () => string;
  /** Top-left HUD; receives the live scene id, world and day phase. */
  renderHud?: (scene: string, world: W, phase: string) => ReactNode;
  /** Overlay renderer (panels, terminal, menu). */
  renderOverlay?: (overlay: unknown, close: () => void, world: W) => ReactNode;
  /** Fired on mount and after every travel — drive ambience, music, weather. */
  onSceneChange?: (scene: string) => void;
  /** Menu overlay opened by TAB/M; opaque to the engine. */
  menuOverlay?: unknown;
  /** Intro splash; dismissed on any key/tap. Fires onFirstGesture. */
  renderIntro?: (dismiss: () => void) => ReactNode;
  /** First user gesture — the right moment to unlock the AudioContext. */
  onFirstGesture?: () => void;
  /** Extra fixed UI (audio player…), rendered above the viewport. */
  renderExtras?: () => ReactNode;
  /** Autosave world+position to localStorage; bump version to invalidate. */
  persist?: { key: string; version: number };
}
