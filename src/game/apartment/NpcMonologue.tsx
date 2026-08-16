import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { mumble, voiceFor } from "@/engine";

/**
 * Ambient monologue: an NPC mutters to nobody in particular. A bubble
 * floats up over their head every so often, with a low mumble underneath.
 * Lines never repeat twice in a row.
 */
export function NpcMonologue({
  x,
  headY = 78,
  scale,
  speaker,
  lines,
  muted = false,
}: {
  /** NPC head center, logical px. */
  x: number;
  headY?: number;
  scale: number;
  speaker: string;
  lines: readonly string[];
  /** While true (dialogue open), the NPC keeps their thoughts to themselves. */
  muted?: boolean;
}) {
  const [line, setLine] = useState<string | null>(null);
  const lastIndex = useRef(-1);

  useEffect(() => {
    if (muted) {
      setLine(null);
      return;
    }
    let showTimer = 0;
    let hideTimer = 0;
    let alive = true;

    const cycle = (delayMs: number) => {
      showTimer = window.setTimeout(() => {
        if (!alive) return;
        let index = Math.floor(Math.random() * lines.length);
        if (index === lastIndex.current) index = (index + 1) % lines.length;
        lastIndex.current = index;
        const text = lines[index];
        setLine(text);
        mumble(text, voiceFor(speaker));
        hideTimer = window.setTimeout(() => {
          if (!alive) return;
          setLine(null);
          cycle(9000 + Math.random() * 8000);
        }, 4200);
      }, delayMs);
    };

    cycle(2500 + Math.random() * 4000);
    return () => {
      alive = false;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [lines, speaker, muted]);

  return (
    <AnimatePresence>
      {line ? (
        <motion.div
          key={line}
          className="pointer-events-none absolute z-10 max-w-56 border border-parchment/25 bg-black/85 px-2 py-1 text-center font-mono text-parchment/85"
          style={{
            left: x * scale,
            top: headY * scale,
            transform: "translate(-50%, -100%)",
            fontSize: Math.max(10, 4 * scale) * 0.8,
            lineHeight: 1.35,
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          {line}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
