/**
 * Scene Engine — a small, opinionated engine for cozy side-scrolling
 * pixel games (walk, look, poke at things, talk, travel between scenes).
 *
 * Layers:
 *   core/     pure types, constants, math — no React, no DOM
 *   systems/  dialogue, inventory, save — pure logic
 *   audio/    procedural lofi soundtrack (WebAudio)
 *   ui/       presentational React components
 *   runtime/  GameRuntime — the loop, input, camera, orchestration
 */

// audio
export { type AmbienceName, ambience } from "./audio/ambience";
export { LOFI_TRACKS, LofiPlayer, type LofiTrack, lofiPlayer } from "./audio/lofi";
export { playSfx, type SfxName } from "./audio/sfx";
export { mumble, type VoiceProfile, voiceFor } from "./audio/voice";
// core
export * from "./core/constants";
export * from "./core/math";
// runtime v2 — culling, sequencing, actors, adaptive quality
export { CullBox, CullStrip, useIsVisible, useVisibleBand } from "./core/runtime-cull";
export type {
  ActorDef,
  InputAction,
  QualityTier,
  RuntimeApi,
  RuntimeConfig,
  RuntimeCtx,
  RuntimeObject,
  RuntimeSceneDef,
  RuntimeStats,
  SeqStep,
} from "./core/runtime-types";
export type {
  ActionDef,
  AnyWorld,
  FxInstance,
  GameConfig,
  InteractionCtx,
  InteractionHandler,
  PlayerConfig,
  SceneDef,
  SceneObject,
  SceneRenderProps,
  SpriteMap,
  SpritePalette,
} from "./core/types";
// runtime
export { GameRuntime } from "./runtime/GameRuntime";
// scene composition & art kit
export * from "./scene/artkit";
export * from "./scene/layers";
export * from "./scene/pixelKit";
export {
  BANDS,
  bandPath,
  LightDefs,
  type LightTiers,
  Pool,
  PoolFlicker,
  pool,
  StringLights,
  SunBand,
  TierLight,
} from "./scene/pixelLight";
export * from "./scene/props";
// sprites & characters
export {
  CharacterBuilder,
  createCharacter,
  mirrorMap,
  mirrorRows,
  type Patch,
  patchMap,
  replaceColor,
  shiftDown,
  stackMaps,
} from "./sprite/characterBuilder";
// systems
export * from "./systems/dialogue";
export * from "./systems/inventory";
export * from "./systems/save";
// ui
export { AudioHud } from "./ui/AudioHud";
export { DialogueBox } from "./ui/DialogueBox";
export { FpsMeter } from "./ui/FpsMeter";
export { InteractPrompt, TargetMarker } from "./ui/InteractPrompt";
export { PixelSprite } from "./ui/PixelSprite";
