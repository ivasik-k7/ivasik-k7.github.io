import type { InteractionCtx } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The ctx every tree in this game closes over. At runtime it is the full
 * RuntimeCtx (flags, counters, walkTo, …) — trees that need the extras
 * duck-type through npcMemory/knows, which degrade safely in tests.
 */
export type Ctx = InteractionCtx<WorldState>;
