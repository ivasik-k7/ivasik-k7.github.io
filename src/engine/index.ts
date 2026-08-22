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
export {
  type AudioGraph,
  LOFI_TRACKS,
  LofiPlayer,
  type LofiTrack,
  lofiPlayer,
  MUSIC_TRACKS,
  type MusicTrack,
} from "./audio/lofi";
export { playSfx, type SfxName, setSfxLevel } from "./audio/sfx";
export { mumble, type VoiceProfile, voiceFor } from "./audio/voice";
// core
export * from "./core/constants";
export * from "./core/ground";
export * from "./core/math";
export {
  DEFAULT_PREFS,
  type EnginePrefs,
  getPrefs,
  type MotionPref,
  motionPref,
  type QualityPref,
  qualityPin,
  setPrefs,
  subscribePrefs,
  TEXT_MS,
  type TextSpeedPref,
  textCharMs,
  voiceEnabled,
} from "./core/prefs";
// runtime v2 — culling, sequencing, actors, adaptive quality
export { CullBox, CullStrip, useIsVisible, useVisibleBand } from "./core/runtime-cull";
export type {
  ActorDef,
  GroundBand,
  GroundBlocker,
  InputAction,
  LiveState,
  QualityTier,
  RuntimeApi,
  RuntimeConfig,
  RuntimeCtx,
  RuntimeObject,
  RuntimeSceneDef,
  RuntimeStats,
  SceneLifecycleCtx,
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
export {
  ANIMAL_FURS,
  ANIMAL_TRIM,
  type AnimalCoat,
  type AnimalConfig,
  type AnimalDoing,
  type AnimalEars,
  type AnimalLook,
  type AnimalMuzzle,
  type AnimalPattern,
  type AnimalReactions,
  type AnimalSize,
  type AnimalSpec,
  type AnimalSpecies,
  type AnimalTail,
  type AnimalZone,
  animalPalette,
  createAnimal,
  type FurName,
  type TrimName,
} from "./sprite/animalBuilder";
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
// sprites & characters
export {
  createNpc,
  type FabricName,
  type HairName,
  NPC_FABRICS,
  NPC_HAIRS,
  NPC_SKINS,
  type NpcAccent,
  type NpcBottom,
  type NpcBrow,
  type NpcBuild,
  type NpcConfig,
  type NpcEars,
  type NpcEyeShape,
  type NpcFace,
  type NpcHairStyle,
  type NpcHat,
  type NpcHeadShape,
  type NpcHeight,
  type NpcLook,
  type NpcMouth,
  type NpcNose,
  type NpcProp,
  type NpcShoes,
  type NpcSpec,
  type NpcTexture,
  type NpcTop,
  npcPalette,
  type SkinName,
} from "./sprite/npcBuilder";
// systems
export * from "./systems/dialogue";
export * from "./systems/inventory";
export * from "./systems/save";
export { AnimalActor, useAnimalFrame } from "./ui/AnimalActor";
// ui
export { AudioHud } from "./ui/AudioHud";
export { AnimationGateProvider, useAnimationGate } from "./ui/animationGate";
export { DialogueBox } from "./ui/DialogueBox";
export { FpsMeter } from "./ui/FpsMeter";
export { InteractPrompt, TargetMarker } from "./ui/InteractPrompt";
export { NpcActor, npcToActor, useNpcFrame } from "./ui/NpcActor";
export {
  CRISP,
  chamferClip,
  type FrameTone,
  PixelFrame,
  PixelLabel,
  PixelMeter,
  scanlines,
} from "./ui/PixelFrame";
export { PixelSprite } from "./ui/PixelSprite";
export {
  SpeechPanel,
  SpeechStem,
  SpeechText,
  type SpeechTone,
} from "./ui/SpeechPanel";
export {
  SpeakingProvider,
  type SpeakingState,
  speakingAction,
  useSpeaking,
} from "./ui/speaking";
export {
  DIM,
  GROUND,
  PARCHMENT,
  prose,
  proseQuiet,
  RULE,
  SIGNAL,
} from "./ui/uiLook";
