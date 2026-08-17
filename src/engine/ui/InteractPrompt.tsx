import { AnimatePresence, motion } from "motion/react";
import { MARKER_Y } from "../core/constants";
import type { SceneObject } from "../core/types";

/**
 * InteractPrompt — the gamified "what will [E] do" chip, bottom-right.
 *
 * Anatomy: a physical-looking keycap, the verb in small caps above the
 * object's name, and — when several things are in reach — a dim stack of
 * the alternatives, each clickable, switchable with ▲▼. The whole chip is
 * a button too, so on touch it doubles as the interact control.
 */
export function InteractPrompt({
  targets,
  activeId,
  pulse,
  label,
  verb,
  onInteract,
  onSelect,
}: {
  targets: SceneObject[];
  activeId: string | null;
  /** Increments on every dispatched interaction — presses the keycap. */
  pulse: number;
  label: (obj: SceneObject) => string;
  verb?: (obj: SceneObject) => string;
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
          <motion.button
            key={o.id}
            type="button"
            className="pointer-events-auto border border-parchment/15 bg-black/60 px-2 py-0.5 font-mono text-[10px] text-parchment/45 tracking-[0.18em] hover:border-parchment/40 hover:text-parchment/85"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.14 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(o.id)}
          >
            ◦ {label(o)}
          </motion.button>
        ))}
        {targets.length > 1 ? (
          <motion.p
            key="switch-hint"
            className="font-mono text-[9px] text-parchment/30 tracking-[0.25em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            ▲▼ SWITCH
          </motion.p>
        ) : null}
        {active ? (
          <motion.button
            key="chip"
            type="button"
            aria-label={label(active)}
            className="pointer-events-auto flex items-center gap-2.5 border border-parchment/30 bg-black/80 py-1.5 pr-3 pl-1.5 shadow-[0_3px_0_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.16 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onInteract}
          >
            <motion.span
              key={pulse}
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center border border-signal/70 bg-[#141410] font-mono text-signal text-sm shadow-[inset_0_-3px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]"
              initial={pulse > 0 ? { y: 2, scaleY: 0.88 } : false}
              animate={{ y: 0, scaleY: 1 }}
              transition={{ duration: 0.18 }}
            >
              E
            </motion.span>
            <motion.span
              key={active.id}
              className="flex flex-col items-start gap-0.5 leading-none"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
            >
              {verbText ? (
                <span className="font-mono text-[8px] text-signal/75 tracking-[0.32em]">
                  {verbText}
                </span>
              ) : null}
              <span className="font-mono text-parchment text-xs tracking-[0.2em]">
                {label(active)}
              </span>
            </motion.span>
          </motion.button>
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
      className="pointer-events-none absolute top-0 left-0 z-20 text-signal"
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
