import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import { prefersReducedMotion, subscribeReducedMotion } from "../core/runtime-perf";

/**
 * Whether character animation should be running at all.
 *
 * Every NPC drives its own frame cycle from a `setInterval`, which is outside
 * the game loop and therefore outside everything the loop does to behave
 * itself — parking when the tab is hidden, throttling behind a dialogue,
 * skipping work for anything off camera. Measured standing still, that was 183
 * SVG node insertions a second, 62% of them for figures nobody could see, and
 * it carried on at full rate underneath a full-screen menu.
 *
 * The runtime publishes one boolean and the actors read it. Outside a runtime
 * it defaults to true, so studios and tests animate normally.
 */
const AnimationGate = createContext(true);

export function AnimationGateProvider({
  running,
  children,
}: {
  running: boolean;
  children: ReactNode;
}) {
  return <AnimationGate.Provider value={running}>{children}</AnimationGate.Provider>;
}

export function useAnimationGate(): boolean {
  return useContext(AnimationGate);
}

/**
 * Whether the player has asked for reduced motion.
 *
 * Six components had grown their own copy of this, each opening a
 * `MediaQueryList` and attaching a listener — and one of them was `NpcActor`,
 * so a street with seventeen people held seventeen of them for one boolean
 * that is the same for all of them. `useSyncExternalStore` over the engine's
 * shared subscription gives every caller the same answer from one source.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}
