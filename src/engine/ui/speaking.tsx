import { createContext, type ReactNode, useContext } from "react";
import type { DialogueMood } from "../systems/dialogue";

/**
 * Who is talking, and what they are doing while they say it.
 *
 * A conversation used to change nothing about the person having it: the text
 * at the bottom of the screen swapped over and the sprite carried on mopping.
 * The dialogue already knows which line is showing and which object it is
 * attached to, so the only thing missing was a way for the character on the
 * other side of the screen to hear about it.
 *
 * This is published by the runtime and read by `NpcActor`, so a character
 * reacts wherever they are standing without every scene file having to thread
 * the state down by hand — there are seventeen of them across six scenes and
 * they would drift apart within a week.
 */
export type SpeakingState = {
  /** the scene object the conversation is with */
  objId: string;
  /** speaker tag on the line currently showing, if it has one */
  speaker?: string;
  /** the action id the speaker's rig should play for this line */
  act?: string;
  mood?: DialogueMood;
};

const SpeakingContext = createContext<SpeakingState | null>(null);

export function SpeakingProvider({
  value,
  children,
}: {
  value: SpeakingState | null;
  children: ReactNode;
}) {
  return <SpeakingContext.Provider value={value}>{children}</SpeakingContext.Provider>;
}

/** Null outside a runtime, so actors render normally in tests and studios. */
export function useSpeaking(): SpeakingState | null {
  return useContext(SpeakingContext);
}

/**
 * The action a character should be playing right now, given who the game is
 * talking to. Falls back through: the line's own `act`, the character's
 * standing talk reaction, then whatever the scene asked for.
 */
export function speakingAction(
  speaking: SpeakingState | null,
  objId: string,
  onTalk: string,
  fallback?: string,
): string | undefined {
  if (!speaking || speaking.objId !== objId) return fallback;
  return speaking.act ?? onTalk;
}
