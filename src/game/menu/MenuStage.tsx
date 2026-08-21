import { useEffect, useRef, useState } from "react";
import { NpcActor, SCENE_HEIGHT } from "@/engine";
import { NPCS } from "@/game/apartment/npcs";
import { STREET_SCENE } from "@/game/apartment/streetScene";
import { initialWorld } from "@/lib/worldState";

/**
 * The menu stage — the yard outside block 14 at dusk, from a camera that never
 * quite settles.
 *
 * This is not a picture of the game behind some buttons. It is the game's own
 * street scene, the same component the runtime mounts when the player walks out
 * of the flat, at the hour when the lamps have just come on. The surest way for
 * a menu to look like it belongs to the same game as the scenes is for it to be
 * one.
 *
 * It fills the screen. An earlier version laid the street along the bottom 46%
 * under a CSS gradient sky, which kept the art small but meant the top half of
 * the title screen was a painted rectangle that belonged to no scene, with a
 * seam across the middle where the two met. The scene already has a sky — four
 * stepped bands, drifting cloud banks, a skyline that mixes toward the horizon —
 * so the whole frame is now given to it and the scale works out at viewport
 * height ÷ 180 ≈ 4×, which is the scale the game itself runs at. Standing on
 * the title screen and standing in the street are now the same picture.
 *
 * What makes it a stage rather than a screenshot:
 *
 *  – the camera drifts, slowly, across a street far wider than the frame;
 *  – the neighbour is out on the step having a cigarette and the babcia is on
 *    her bench, both animating themselves;
 *  – the light is pushed back under a wash and a vignette, so type laid over it
 *    stays readable without a panel behind it.
 *
 * It costs one SVG and two actors, and the drift is written straight onto a
 * transform on an animation frame — no React state per frame — and stops when
 * the tab is hidden or the player has asked for reduced motion.
 */

/**
 * Where the camera sits, in street units. The frame is about 290 units wide at
 * this scale, so this is the left edge of it.
 *
 * Chosen by looking at four of them. 150 frames the door of block 14 and fills
 * the screen with render and shopfront — a good picture of a wall. 700 and 980
 * are the bank and the cashpoint, which are the two dullest things on the
 * street. 400 is the one with a sky in it: the Żabka's green edge on the left,
 * the bus stop and its timetable in the middle, the paczkomat, and then the old
 * townhouses and the church spire receding into the haze behind. Three planes
 * of depth and the dusk sky above them, which is the whole mood in one frame.
 */
const CAMERA_X = 400;

/** How far the camera travels, in CSS px, and how long one pass takes. */
const DRIFT_PX = 150;
const DRIFT_MS = 52_000;

export function MenuStage({ still = false }: { still?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * How far through the pan we are, in ms, kept across restarts.
   *
   * Without this the camera snapped. The effect re-runs whenever the tab is
   * hidden or shown, and it used to take a fresh `performance.now()` as its
   * origin — so coming back to the tab restarted the pass at k=0 and the whole
   * street jumped up to 150 px sideways in a single frame. The phase is stored
   * here on the way out and used as the origin on the way back in, so the pan
   * resumes exactly where it stopped.
   */
  const phase = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || still || hidden) return;
    let raf = 0;
    const origin = performance.now() - phase.current;
    let elapsed = phase.current;
    const tick = (now: number) => {
      elapsed = now - origin;
      // a slow triangle rather than a sine: the turn at each end is what makes
      // it read as a camera being held rather than as an animation looping
      const t = (elapsed % (DRIFT_MS * 2)) / DRIFT_MS;
      const k = t < 1 ? t : 2 - t;
      el.style.transform = `translate3d(${(-DRIFT_PX * k).toFixed(1)}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      phase.current = elapsed;
    };
  }, [still, hidden]);

  const Art = STREET_SCENE.Component;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0a0d14]">
      {/* The element is wider than the frame by exactly the drift, so panning
          never runs off the end of the picture into the background colour. */}
      <div
        ref={ref}
        className="absolute inset-y-0 left-0"
        style={{ width: `calc(100% + ${DRIFT_PX}px)`, willChange: "transform" }}
      >
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`${CAMERA_X} 0 ${STREET_SCENE.width - CAMERA_X} ${SCENE_HEIGHT}`}
          preserveAspectRatio="xMinYMax slice"
          className="pixelated block h-full w-full"
        >
          <Art world={initialWorld} phase="dusk" />
          {/* One person, placed inside the frame the camera actually holds —
              at his street position he was outside it and the title screen had
              nobody in it. He is out for a cigarette by the bus stop, which is
              enough: two figures on an empty street start to look like a
              crowd scene, and this one is about somebody waiting alone. */}
          <NpcActor npc={NPCS.smoker} x={612} facing={-1} />
        </svg>
      </div>

      {/* dusk wash, then a vignette: type has to sit on this and stay legible */}
      <div className="absolute inset-0 bg-[#0a1230] opacity-[0.34] mix-blend-multiply" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(122% 92% at 52% 40%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.66) 100%)",
        }}
      />
      {/* The ground the menu column stands on. It runs left-to-right rather than
          top-to-bottom, because the options are a column down the left and the
          thing they have to stay legible against is the lit shopfront behind
          them, not the pavement. */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: "56%",
          background:
            "linear-gradient(90deg, rgba(6,8,13,0.90) 0%, rgba(6,8,13,0.70) 44%, rgba(6,8,13,0) 100%)",
        }}
      />
      {/* and a little weight at the top and bottom, for the title and the stamp */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: "34%",
          background: "linear-gradient(180deg, rgba(6,8,13,0.62) 0%, rgba(6,8,13,0) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: "22%",
          background: "linear-gradient(180deg, rgba(6,8,13,0) 0%, rgba(6,8,13,0.58) 100%)",
        }}
      />
    </div>
  );
}
