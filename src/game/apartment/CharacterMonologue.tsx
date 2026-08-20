import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { SpeechPanel, SpeechTail, SpeechText } from "@/engine";

/**
 * The player's inner voice, drawn in the same chrome as NpcMonologue:
 * whole game pixels only, chamfered corners cut with clip-path, scanlines
 * over a near-black fill, a lit top edge, a typewriter with a block cursor,
 * and a stepped pixel tail down toward the head it belongs to.
 *
 * No nameplate and no voice — these are thoughts, not speech. The runtime
 * anchors this component above the player's head and hands it the current
 * toast; everything here is presentation.
 */

function useReducedMotion() {
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

export function CharacterMonologue({
  toast,
  scale,
}: {
  toast: { id: number; text: string } | null;
  scale: number;
}) {
  const [bob, setBob] = useState(0);
  const still = useReducedMotion();
  const text = toast?.text ?? null;

  // ---- typewriter, restarted per toast -------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when a new toast arrives
  useEffect(() => {}, [toast?.id, still]);

  // The typewriter lives in `SpeechText` now. It used to chain a `setTimeout`
  // per character, so a busy main thread dropped letters and the thought typed
  // itself out visibly slower while walking than while standing still. The
  // replacement derives the letter count from elapsed time on an animation
  // frame, which skips ahead on a slow frame rather than falling behind.

  // ---- one whole pixel of bob, never a fraction -----------------------------
  useEffect(() => {
    if (!text || still) {
      setBob(0);
      return;
    }
    const t = window.setInterval(() => setBob((b) => (b === 0 ? -1 : 0)), 720);
    return () => window.clearInterval(t);
  }, [text, still]);

  // one game pixel, in CSS px
  const u = Math.max(1, Math.round(scale));
  const font = Math.max(9, Math.round(3 * scale));
  const lead = font + u * 2;

  return (
    <AnimatePresence>
      {toast && text ? (
        <motion.div
          key={toast.id}
          className="pointer-events-none absolute top-0 left-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: still ? 0 : 0.16, ease: "linear" }}
        >
          <div
            style={{
              transform: "translate(-50%, -100%)",
              width: "max-content",
              marginTop: bob * u,
              filter: `drop-shadow(0 ${u}px 0 rgba(0,0,0,0.55))`,
            }}
          >
            {/* the same riveted plate the clock and the interact chip are cut
                from — a thought the character has is the game talking, and it
                should come out of the game's own furniture */}
            <SpeechPanel u={u} tone="say" rivets={false} maxWidth={Math.round(56 * scale)}>
              <SpeechText
                key={text}
                text={text}
                done={still}
                u={u}
                pace={0.78}
                fontSize={font}
                lineHeight={lead}
                className="font-mono text-parchment/90"
              />
            </SpeechPanel>

            <SpeechTail u={u} tone="say" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
