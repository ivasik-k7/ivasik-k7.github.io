import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

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
  const [shown, setShown] = useState(0);
  const [bob, setBob] = useState(0);
  const still = useReducedMotion();
  const text = toast?.text ?? null;

  // ---- typewriter, restarted per toast -------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when a new toast arrives
  useEffect(() => {
    setShown(still && text ? text.length : 0);
  }, [toast?.id, still]);

  useEffect(() => {
    if (!text || still) return;
    if (shown >= text.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), 14);
    return () => window.clearTimeout(t);
  }, [text, shown, still]);

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
  /** the anchor floats 4 gp over the head; the tail closes that distance */
  const gap = 4;

  const crisp = {
    WebkitFontSmoothing: "none",
    MozOsxFontSmoothing: "unset",
    textRendering: "optimizeSpeed",
    fontVariantLigatures: "none",
  } as React.CSSProperties;

  const chamfer = [
    `${u * 2}px 0`,
    `calc(100% - ${u * 2}px) 0`,
    `calc(100% - ${u}px) ${u}px`,
    `100% ${u * 2}px`,
    `100% calc(100% - ${u * 2}px)`,
    `calc(100% - ${u}px) calc(100% - ${u}px)`,
    `calc(100% - ${u * 2}px) 100%`,
    `${u * 2}px 100%`,
    `${u}px calc(100% - ${u}px)`,
    `0 calc(100% - ${u * 2}px)`,
    `0 ${u * 2}px`,
    `${u}px ${u}px`,
  ].join(", ");
  const clip = `polygon(${chamfer})`;
  const scan = `repeating-linear-gradient(180deg, rgba(232,230,224,0.055) 0px, rgba(232,230,224,0.055) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${u * 2}px)`;

  const typing = text !== null && shown < text.length;

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
            {/* the frame: border layer, chamfered, fill inset one pixel */}
            <div
              style={{
                clipPath: clip,
                background: "rgba(232,230,224,0.32)",
                padding: u,
                maxWidth: Math.round(56 * scale),
              }}
            >
              <div
                className="text-center font-mono text-parchment/90"
                style={{
                  ...crisp,
                  clipPath: clip,
                  backgroundColor: "rgba(11,14,20,0.92)",
                  backgroundImage: scan,
                  boxShadow: `inset 0 ${u}px 0 rgba(232,230,224,0.10)`,
                  padding: `${u}px ${u * 2}px`,
                  fontSize: font,
                  lineHeight: `${lead}px`,
                  letterSpacing: 0,
                }}
              >
                {still ? text : text.slice(0, shown)}
                {typing ? (
                  <span
                    aria-hidden="true"
                    className="ml-px inline-block align-baseline bg-parchment/85"
                    style={{ width: u, height: font - u }}
                  />
                ) : null}
              </div>
            </div>

            {/* the tail: three pixel steps down toward the head */}
            <div className="relative" style={{ height: gap * u, marginLeft: "50%", width: u * 5 }}>
              <div
                style={{
                  position: "absolute",
                  left: -u * 2.5,
                  top: 0,
                  width: u * 5,
                  height: u,
                  background: "rgba(232,230,224,0.32)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -u * 1.5,
                  top: u,
                  width: u * 3,
                  height: u,
                  background: "rgba(232,230,224,0.32)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -u * 0.5,
                  top: u * 2,
                  width: u,
                  height: u,
                  background: "rgba(232,230,224,0.32)",
                }}
              />
              {/* fill, so the outline reads continuously into the bubble */}
              <div
                style={{
                  position: "absolute",
                  left: -u * 1.5,
                  top: 0,
                  width: u * 3,
                  height: u,
                  background: "rgba(11,14,20,0.92)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -u * 0.5,
                  top: u,
                  width: u,
                  height: u,
                  background: "rgba(11,14,20,0.92)",
                }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
