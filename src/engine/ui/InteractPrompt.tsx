import { AnimatePresence, motion } from "motion/react";
import { MARKER_Y } from "../core/constants";
import type { SceneObject } from "../core/types";
import { PixelFrame, PixelLabel } from "./PixelFrame";

/**
 * InteractPrompt — what [E] will do, bottom-right, in the game's own chrome.
 *
 * Built from the same parts as every other plate: a riveted PixelFrame, type
 * set in the 3x5 glyphs the street signs use, and a keycap that is itself a
 * small frame. Nothing here is browser type or a CSS border, so the prompt
 * reads as a thing the game is holding up rather than an overlay.
 *
 *   · the keycap presses on every dispatched interaction (`pulse`)
 *   · the verb sits above the object's name, in signal yellow
 *   · when more than one thing is in reach, the alternatives stack above as
 *     smaller plates — clickable, and switchable with ▲▼
 */

const PARCHMENT = "#e3d9c2";
const SIGNAL = "#fcee0a";

export function InteractPrompt({
  targets,
  activeId,
  pulse,
  label,
  verb,
  switchLabel,
  onInteract,
  onSelect,
}: {
  targets: SceneObject[];
  activeId: string | null;
  /** Increments on every dispatched interaction — presses the keycap. */
  pulse: number;
  label: (obj: SceneObject) => string;
  verb?: (obj: SceneObject) => string;
  /** the hint when more than one target is in reach */
  switchLabel?: string;
  onInteract: () => void;
  onSelect: (id: string) => void;
}) {
  const active = targets.find((o) => o.id === activeId) ?? null;
  const others = targets.filter((o) => o.id !== activeId).slice(0, 2);
  const verbText = active && verb ? verb(active) : null;

  return (
    <div className="pointer-events-none absolute right-4 bottom-5 z-30 flex flex-col items-end gap-1.5 [@media(pointer:coarse)]:bottom-24">
      <AnimatePresence>
        {others.map((o) => (
          <motion.div
            key={o.id}
            className="pointer-events-auto"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.14 }}
          >
            <PixelFrame
              u={2}
              tone="inset"
              rivets={false}
              scan={false}
              onClick={() => onSelect(o.id)}
              ariaLabel={label(o)}
            >
              <span className="block" style={{ padding: "3px 6px" }}>
                <PixelLabel text={label(o)} px={2} fill={PARCHMENT} opacity={0.5} />
              </span>
            </PixelFrame>
          </motion.div>
        ))}

        {targets.length > 1 ? (
          <motion.div
            key="switch-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PixelLabel
              text={switchLabel ?? "UP/DOWN SWITCH"}
              px={2}
              fill={PARCHMENT}
              opacity={0.3}
            />
          </motion.div>
        ) : null}

        {active ? (
          <motion.div
            key="chip"
            className="pointer-events-auto"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.16 }}
          >
            <PixelFrame u={3} tone="plate" onClick={onInteract} ariaLabel={label(active)}>
              <span className="flex items-center gap-2.5" style={{ padding: "6px 10px 6px 6px" }}>
                {/* the keycap: its own little frame, pressed on every use */}
                <motion.span
                  key={pulse}
                  className="flex items-center justify-center"
                  style={{
                    width: 26,
                    height: 26,
                    background: "#141410",
                    boxShadow:
                      "inset 0 0 0 2px rgba(252,238,10,0.7), inset 0 -4px 0 rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.1)",
                  }}
                  initial={pulse > 0 ? { y: 2, scaleY: 0.86 } : false}
                  animate={{ y: 0, scaleY: 1 }}
                  transition={{ duration: 0.18 }}
                >
                  <PixelLabel text="E" px={4} fill={SIGNAL} />
                </motion.span>

                <motion.span
                  key={active.id}
                  className="flex flex-col items-start gap-1"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  {verbText ? (
                    <PixelLabel text={verbText} px={2} fill={SIGNAL} opacity={0.8} />
                  ) : null}
                  <PixelLabel text={label(active)} px={3} fill={PARCHMENT} />
                </motion.span>
              </span>
            </PixelFrame>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * TargetMarker — a pixel chevron bobbing over the targeted object, drawn in
 * scene space so it rides the camera with the world. Position is static per
 * target; only the CSS bob animates.
 */
export function TargetMarker({ obj, scale }: { obj: SceneObject; scale: number }) {
  const size = Math.max(8, scale * 3.5);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-[360] text-signal"
      style={{
        transform: `translate3d(${obj.x * scale}px, ${(obj.markerY ?? MARKER_Y) * scale}px, 0)`,
      }}
    >
      <div className="engine-marker-bob" style={{ marginLeft: -size / 2 }}>
        <svg
          aria-hidden="true"
          width={size}
          height={(size * 4) / 7}
          viewBox="0 0 7 4"
          shapeRendering="crispEdges"
          className="drop-shadow-[0_0_3px_rgba(0,0,0,0.85)]"
        >
          <g fill="currentColor">
            <rect x="0" y="0" width="7" height="1" />
            <rect x="1" y="1" width="5" height="1" />
            <rect x="2" y="2" width="3" height="1" />
            <rect x="3" y="3" width="1" height="1" />
          </g>
        </svg>
      </div>
    </div>
  );
}
