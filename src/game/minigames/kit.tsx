import { type ReactNode, useEffect, useRef, useState } from "react";
import { SharedDefs, Vignette, vignettePaths } from "@/engine/scene/pixelKit";

/**
 * The minigame kit — the shared stagecraft every minigame stands on.
 *
 * A minigame here is not a UI panel; it is a scene the game cuts to. The kit
 * owns the cut: a stepped iris in from black (film language, quantized to
 * pixels), letterbox bars that slide in like the sequencer's cinematic mode,
 * a slow camera breathe so the frame never sits dead still, and a verdict
 * card that arrives as a beat of its own instead of a caption. Games keep
 * their own loops and inputs; the kit keeps the theatre.
 *
 * Juice is deliberately physical: hit-stop freezes the world for a few
 * frames the way a landed hit should, shake displaces the whole stage, and
 * particles are a fixed pool of lit rectangles — quantized, pooled, cheap.
 */

/* ------------------------------------------------------------------ juice */

/** Hit-stop, shake and camera-breathe, folded into one per-frame offset. */
export class Juice {
  private freezeUntil = 0;
  private shakeUntil = 0;
  private shakeMag = 0;
  private seed = 1;

  /** Freeze the game clock for `ms` — call from the game's tick via `frozen`. */
  hitStop(ms: number) {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  shake(mag: number, ms: number) {
    this.shakeMag = mag;
    this.shakeUntil = performance.now() + ms;
  }

  /** Per-frame: whether the sim should skip, and the stage offset in px. */
  sample(now: number, t: number): { frozen: boolean; dx: number; dy: number } {
    const frozen = now < this.freezeUntil;
    let dx = 0;
    let dy = 0;
    if (now < this.shakeUntil) {
      // a deterministic 2-phase rattle, quantized to whole pixels
      this.seed = (this.seed * 16807) % 2147483647;
      dx = Math.round((((this.seed >> 3) % 3) - 1) * this.shakeMag);
      dy = Math.round((((this.seed >> 7) % 3) - 1) * this.shakeMag);
    }
    // the camera breathes: ±1px on a slow sine, so the frame is never inert
    dy += Math.round(Math.sin(t / 2400) * 1);
    return { frozen, dx, dy };
  }
}

/* -------------------------------------------------------------- particles */

export type ParticleSpawn = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** ms */
  life: number;
  color: string;
  size?: number;
  /** px/s² pulling down (sparks) or up (smoke, negative) */
  gravity?: number;
};

type Particle = ParticleSpawn & { born: number; el: SVGRectElement | null };

/**
 * A fixed pool of quantized particles. Render `pool.nodes` once inside the
 * stage; call `spawn` freely and `update` once per frame from the game loop.
 */
export function makeParticlePool(n = 48) {
  const slots: Particle[] = Array.from({ length: n }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    color: "",
    born: -1,
    el: null,
  }));
  let cursor = 0;
  const nodes = slots.map((_, i) => (
    <rect
      key={`p${
        // biome-ignore lint/suspicious/noArrayIndexKey: pool slots are positional
        i
      }`}
      ref={(el) => {
        slots[i].el = el;
      }}
      width={2}
      height={2}
      style={{ display: "none" }}
    />
  ));
  const spawn = (p: ParticleSpawn) => {
    const s = slots[cursor];
    cursor = (cursor + 1) % slots.length;
    Object.assign(s, p, { born: performance.now() });
    if (s.el) {
      s.el.setAttribute("fill", p.color);
      s.el.setAttribute("width", String(p.size ?? 2));
      s.el.setAttribute("height", String(p.size ?? 2));
    }
  };
  const update = (now: number, dt: number) => {
    for (const s of slots) {
      if (s.born < 0 || !s.el) continue;
      const age = now - s.born;
      if (age > s.life) {
        s.born = -1;
        s.el.style.display = "none";
        continue;
      }
      s.vy += (s.gravity ?? 0) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.el.style.display = "";
      s.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
      s.el.style.opacity = age > s.life * 0.6 ? "0.5" : "1";
    }
  };
  return { nodes, spawn, update };
}

/* ------------------------------------------------------------------ shell */

/**
 * The stage. Owns the iris cut, the letterbox, the breathing stage group,
 * the vignette and the verdict beat. The game passes its drawn scene as
 * children and moves `stageRef` itself every frame (juice offsets).
 */
export function MinigameShell({
  w,
  h,
  bg,
  children,
  stageRef,
  verdict,
  hint,
  maxWidth = "max-w-3xl",
}: {
  w: number;
  h: number;
  bg: string;
  children: ReactNode;
  stageRef?: React.Ref<SVGGElement>;
  verdict: string | null;
  hint: string;
  maxWidth?: string;
}) {
  const [iris, setIris] = useState<"closed" | "opening" | "open">("closed");
  useEffect(() => {
    const a = window.setTimeout(() => setIris("opening"), 60);
    const b = window.setTimeout(() => setIris("open"), 700);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);
  const vignette = useRef(vignettePaths(w, h)).current;
  /* the stepped aperture: frames of black collapsing outward in quantized steps */
  const steps = [1, 0.82, 0.62, 0.4, 0.18];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90">
      <div className={`relative w-full ${maxWidth} px-[4%]`}>
        {/* letterbox bars, sliding like the sequencer's cinematic mode */}
        <div
          className="pointer-events-none absolute inset-x-[4%] z-10 bg-black"
          style={{
            top: 0,
            height: iris === "open" ? "4%" : "50%",
            transition: "height 600ms steps(6, end)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-[4%] z-10 bg-black"
          style={{
            bottom: 0,
            height: iris === "open" ? "4%" : "50%",
            transition: "height 600ms steps(6, end)",
          }}
        />
        <svg
          aria-hidden="true"
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          shapeRendering="crispEdges"
          style={{ imageRendering: "pixelated" }}
        >
          <SharedDefs />
          <rect width={w} height={h} fill={bg} />
          <g ref={stageRef}>{children}</g>
          {/* iris frames on top of the stage, under the vignette */}
          {iris !== "open"
            ? steps.map((f, i) => (
                <g key={f} opacity={iris === "opening" ? Math.max(0, 1 - (i + 1) * 0.22) : 1}>
                  <rect x={0} y={0} width={w} height={(h / 2) * f} fill="#000" />
                  <rect x={0} y={h - (h / 2) * f} width={w} height={(h / 2) * f} fill="#000" />
                  <rect x={0} y={0} width={(w / 2) * f} height={h} fill="#000" />
                  <rect x={w - (w / 2) * f} y={0} width={(w / 2) * f} height={h} fill="#000" />
                </g>
              ))
            : null}
          <Vignette set={vignette} />
        </svg>
        {/* the verdict beat: a plate, not a caption */}
        {verdict ? (
          <div className="absolute inset-x-[4%] bottom-[-6%] z-20 flex justify-center">
            <div
              className="border border-parchment/25 bg-black/85 px-4 py-2 font-mono text-[12px] text-parchment/90"
              style={{ boxShadow: "0 3px 0 rgba(0,0,0,.6)" }}
            >
              {verdict}
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-center font-mono text-[11px] text-parchment/40">{hint}</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- tiers */

/** Map a hit ratio onto the three verdict tiers every minigame speaks in. */
export function tierOf(ratio: number, good = 0.8, fair = 0.5): 0 | 1 | 2 {
  return ratio >= good ? 2 : ratio >= fair ? 1 : 0;
}
