import { useEffect, useMemo, useState } from "react";
import { FLOOR_Y } from "../core/constants";
import type { ActorDef } from "../core/runtime-types";
import type { AnyWorld, SpriteMap } from "../core/types";
import type { NpcConfig } from "../sprite/npcBuilder";
import { PixelSprite } from "./PixelSprite";

/**
 * NpcActor — a built NPC, standing in a scene and doing something.
 *
 * Scenes are SVG drawn in logical scene units, so this renders as a <g> with
 * the sprite's feet on the floor line and its centre on `x` — the same place
 * the runtime puts the player. Drop one in a scene's gameplayObjects layer and
 * it lives there: breathing, working, turning to face you when you speak.
 *
 *   <NpcActor npc={NATALIA} x={375} action={dialogueOpen ? "talk" : undefined} />
 *
 * With no `action` it plays whatever the NPC does by default — mopping,
 * smoking, sitting, waiting. Pass one to override for a beat: a reaction.
 */
/**
 * The frame an NPC is showing right now. Exported because previews, portraits
 * and the casting studio all need the animation without the scene placement.
 */
/**
 * Where in its loop a character starts. Everyone stepping onto the same frame
 * at the same moment is the tell that a street is a screensaver: four people
 * blinking in unison, four hands going to four pockets together. Seeded on the
 * id, so it is stable across reloads and different for every person.
 */
function phaseOf(id: string, length: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return length > 0 ? (h >>> 0) % length : 0;
}

export function useNpcFrame(npc: NpcConfig, action?: string, playing = true): SpriteMap {
  const id = action ?? npc.idleAction;
  const def = npc.actions[id] ?? npc.actions[npc.idleAction];
  const frames = useMemo(() => def?.frames ?? ["stand"], [def]);
  const start = phaseOf(npc.id, frames.length);
  const [i, setI] = useState(start);
  const still = useStill();

  useEffect(() => {
    setI(start);
    if (!playing || still || frames.length < 2) return;
    const timer = window.setInterval(
      () => setI((n) => (n + 1) % frames.length),
      def?.frameMs ?? 500,
    );
    return () => window.clearInterval(timer);
  }, [frames, def?.frameMs, playing, still, start]);

  return npc.frames[frames[i] ?? "stand"] ?? npc.frames.stand;
}

export function NpcActor({
  npc,
  x,
  y = FLOOR_Y,
  action,
  facing = 1,
  playing = true,
  opacity,
  shadow = true,
  cropBelow,
}: {
  npc: NpcConfig;
  /** scene x, in logical px — the figure is centred on it */
  x: number;
  /** the line the feet stand on; defaults to the scene floor */
  y?: number;
  /** override the idle behaviour — usually a reaction */
  action?: string;
  facing?: 1 | -1;
  playing?: boolean;
  opacity?: number;
  /** the contact shadow under the feet; off for anyone already sitting on art */
  shadow?: boolean;
  /**
   * Scene y below which this person is not drawn — for anyone standing behind a
   * counter, a desk or a parapet. Cheaper and crisper than a clip path: the
   * rows simply are not emitted, so nothing bleeds through the furniture.
   */
  cropBelow?: number;
}) {
  const frame = useNpcFrame(npc, action, playing);
  const cell = npc.cell ?? 2;
  const left = Math.round(x - npc.width / 2);
  // Ground the sprite by the frame it is *showing*, not by how tall the person
  // is standing up. A seated frame is shorter than a standing one — that is
  // the whole point of sitting down — so anchoring at the bottom row puts the
  // soles on the floor and the hips on the bench without the scene having to
  // know either number.
  const height = groundedRows(frame) * cell;
  const top = Math.round(y - height);
  // behind a counter: keep only the rows above the cut, and lose the shadow,
  // because you cannot see the floor they are standing on
  const visible =
    cropBelow === undefined
      ? frame
      : frame.slice(0, Math.max(0, Math.ceil((cropBelow - top) / cell)));
  const grounded = shadow && cropBelow === undefined;

  return (
    <g
      transform={
        facing === -1
          ? `translate(${left + npc.width} ${top}) scale(-1 1)`
          : `translate(${left} ${top})`
      }
      opacity={opacity}
    >
      {grounded ? (
        // a person standing on a floor darkens the floor: three stepped rows,
        // widest at the feet, so the figure is planted rather than pasted
        <g fill="#171009" shapeRendering="crispEdges">
          <rect
            x={npc.width / 2 - 9 * cell}
            y={height - cell}
            width={18 * cell}
            height={cell}
            opacity={0.18}
          />
          <rect
            x={npc.width / 2 - 6 * cell}
            y={height - cell * 2}
            width={12 * cell}
            height={cell}
            opacity={0.13}
          />
        </g>
      ) : null}
      <PixelSprite map={visible} palette={npc.palette} cell={cell} />
    </g>
  );
}

/** Rows down to the lowest painted pixel — a seated frame is padded below. */
function groundedRows(frame: SpriteMap): number {
  for (let i = frame.length - 1; i >= 0; i--) if (/[^.]/.test(frame[i])) return i + 1;
  return frame.length;
}

function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setStill(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return still;
}

/**
 * Hand an NPC to the runtime's actor system, which steps and culls them in the
 * game loop rather than in React — the right home for anyone who walks.
 */
export function npcToActor<W extends AnyWorld>(
  npc: NpcConfig,
  opts: {
    x: number;
    y?: number;
    facing?: 1 | -1;
    patrol?: { from: number; to: number; speed?: number; pauseMs?: number };
    visible?: (world: W) => boolean;
    z?: number;
  },
): ActorDef<W> {
  return {
    id: npc.id,
    width: npc.width,
    height: npc.height,
    cell: npc.cell ?? 2,
    frames: npc.frames,
    palette: npc.palette,
    walkCycle: [...npc.walkCycle],
    idleFrame: "stand",
    x: opts.x,
    y: opts.y,
    facing: opts.facing,
    patrol: opts.patrol,
    visible: opts.visible,
    z: opts.z,
  };
}
