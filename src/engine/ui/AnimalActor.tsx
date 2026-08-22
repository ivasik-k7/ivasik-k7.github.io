import { useEffect, useMemo, useState } from "react";
import { FLOOR_Y } from "../core/constants";
import type { SpriteMap } from "../core/types";
import type { AnimalConfig } from "../sprite/animalBuilder";
import { useReducedMotion } from "./animationGate";
import { frameTicker } from "./frameTicker";
import { PixelSprite } from "./PixelSprite";

/**
 * AnimalActor — a built animal, on a floor, doing something.
 *
 * The same job `NpcActor` does for people, and a separate component for the
 * same reason the rig is separate: an animal is not a short person. It is
 * grounded on the frame it is showing rather than on a standing height, which
 * matters far more here than it does for a person — a dog asleep is a third of
 * the height of the same dog on its feet, and the pose it is in changes minute
 * to minute. And its contact shadow is a long low smear rather than the round
 * one under a pair of shoes, because what is touching the floor is four feet
 * two thirds of a metre apart, or a whole flank.
 *
 *   <AnimalActor animal={ANIMALS.gross} x={648} action={petting ? "pet" : undefined} />
 *
 * With no `action` it plays whatever the animal does by default. Pass one to
 * override for a beat: a reaction.
 */

/**
 * Where in its loop an animal starts. Seeded on the id so that two cats on the
 * same street are not blinking in time with each other, and so that the same
 * animal comes back on the same frame across a reload.
 */
function phaseOf(id: string, length: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return length > 0 ? (h >>> 0) % length : 0;
}

/** The frame an animal is showing right now, without the scene placement. */
export function useAnimalFrame(animal: AnimalConfig, action?: string, playing = true): SpriteMap {
  const id = action ?? animal.idleAction;
  const def = animal.actions[id] ?? animal.actions[animal.idleAction];
  const frames = useMemo(() => def?.frames ?? ["stand"], [def]);
  const start = phaseOf(animal.id, frames.length);
  const [i, setI] = useState(start);
  const still = useReducedMotion();

  useEffect(() => {
    setI(start);
    if (!playing || still || frames.length < 2) return;
    // shared ticker — see frameTicker.ts; one timer for the whole kennel
    return frameTicker.every(def?.frameMs ?? 500, () => setI((n) => (n + 1) % frames.length));
  }, [frames, def?.frameMs, playing, still, start]);

  return animal.frames[frames[i] ?? "stand"] ?? animal.frames.stand;
}

export function AnimalActor({
  animal,
  x,
  y = FLOOR_Y,
  action,
  facing = 1,
  playing = true,
  opacity,
  shadow = true,
}: {
  animal: AnimalConfig;
  /** scene x, in logical px — the animal is centred on it */
  x: number;
  /** the line the feet stand on; defaults to the scene floor */
  y?: number;
  /** override the default behaviour — usually a reaction */
  action?: string;
  facing?: 1 | -1;
  playing?: boolean;
  opacity?: number;
  /** off for anyone already lying on painted art that has its own shadow */
  shadow?: boolean;
}) {
  const frame = useAnimalFrame(animal, action, playing);
  const cell = animal.cell ?? 2;
  const left = Math.round(x - animal.width / 2);
  // Grounded on the frame being shown and not on the animal's standing height.
  // A curled dog is eight rows tall where the same dog on its feet is twenty,
  // and both of them are on the same floor.
  const height = groundedRows(frame) * cell;
  const top = Math.round(y - height);
  const { from, to } = footprint(frame);
  const width = Math.max(1, to - from + 1);

  return (
    <g
      transform={
        facing === -1
          ? `translate(${left + animal.width} ${top}) scale(-1 1)`
          : `translate(${left} ${top})`
      }
      opacity={opacity}
    >
      {shadow ? (
        // measured off the frame's own bottom row: four feet throw a shadow as
        // wide as the animal's stance, and a sleeping one throws it under the
        // whole flank. A fixed ellipse would sit under a curled dog like a
        // dinner plate under a cat.
        <g fill="#171009" shapeRendering="crispEdges">
          <rect
            x={(from - 1.5) * cell}
            y={height - cell}
            width={(width + 3) * cell}
            height={cell}
            opacity={0.18}
          />
          <rect
            x={(from + 0.5) * cell}
            y={height - cell * 2}
            width={Math.max(1, width - 1) * cell}
            height={cell}
            opacity={0.1}
          />
        </g>
      ) : null}
      <PixelSprite map={frame} palette={animal.palette} cell={cell} />
    </g>
  );
}

/** Rows down to the lowest painted pixel — every pose is padded below. */
function groundedRows(frame: SpriteMap): number {
  for (let i = frame.length - 1; i >= 0; i--) if (/[^.]/.test(frame[i])) return i + 1;
  return frame.length;
}

/** The columns actually touching the floor, so the shadow is the right width. */
function footprint(frame: SpriteMap): { from: number; to: number } {
  for (let i = frame.length - 1; i >= 0; i--) {
    const row = frame[i];
    if (!/[^.]/.test(row)) continue;
    let from = row.length;
    let to = 0;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "." && row[x] !== " ") {
        from = Math.min(from, x);
        to = Math.max(to, x);
      }
    }
    return { from, to };
  }
  return { from: 0, to: 0 };
}
