import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS, PixelLabel } from "@/engine";
import { BUILD } from "@/lib/build";
import { MenuPanel } from "./MenuPanel";
import { useMenuScale } from "./menuScale";
import { PROSE, SIGNAL } from "./menuStyle";
import { useMenuInput } from "./useMenuInput";

/**
 * Credits.
 *
 * A slow crawl rather than a list, and it keeps the street behind it, so this
 * reads as the end of something rather than as an about page. The scroll is
 * driven straight onto a transform on an animation frame — the same reason the
 * typewriter is: paying React to move a column of text is paying it to do a job
 * CSS already does.
 *
 * Laid out as role-and-names in two columns on a shared axis, centred in the
 * frame. The first version was a 230 px-wide left-aligned column inside a
 * 1090 px panel, which is the "a div was placed here" look, and it started 220
 * px below the fold so opening Credits gave you a heading and then a void.
 *
 * It loops. Nobody watches credits twice, but a crawl that stops and sits at
 * the bottom of the screen looks broken.
 */

const BASE_SPEED = 20;

type Entry = { role?: string; names: string[]; gap?: boolean };

/**
 * The music is listed by name because it is eight actual pieces now, and a
 * soundtrack listing is the one part of a credits roll people read. The rest is
 * kept short: this is a small game by one person and a long crawl would be a
 * pretence.
 */
const CREDITS: Entry[] = [
  { role: "OSIEDLE", names: ["a small game about a Wednesday", "in a block of flats"] },
  { role: "DESIGN, CODE, ART, WRITING", names: ["Ivan Kovtun"] },
  {
    role: "PLAYED IT FIRST, SAID WHAT WAS WRONG",
    names: [
      'Aliaksei "Bynov" Vilenski',
      "mishashaurma",
      "and everyone else who sat through a build",
    ],
  },
  {
    role: "THE CAST, AS THEMSELVES",
    names: [
      "Pani Natalia, who is always mopping",
      "Pan Marek from the fourth floor",
      "Babcia Krysia, on her bench",
      "Sąsiad, outside, having one more",
      "Pan Zbyszek, Trener, Pani Gołębiarka",
      "the Kurier, who is late",
      "the Pani from Żabka, who has seen it all",
      "and everyone waiting for the 512",
    ],
  },
  { role: "GROSS", names: ["as himself", "a very good dog"] },
  {
    role: "ALSO APPEARING",
    names: ["Kot Osiedlowy, on the bins", "Rudy", "Owczarek", "the spaniel from block 16"],
  },
  {
    role: "SHOT ON LOCATION",
    names: [
      "the flat, the study, the bathroom",
      "the balcony, the landing, the lift",
      "the yard, Żabka, parking −1",
      "the gym, and the osiedle itself",
    ],
  },
  { role: "MUSIC", names: MUSIC_TRACKS.map((t) => t.name.toLowerCase()) },
  {
    role: "SOUND",
    names: [
      "every effect synthesized in the browser —",
      "the kettle, the tram, the lift, the rain,",
      "the cistern, and one polite stream",
      "no samples, no files",
    ],
  },
  {
    role: "ENGINE",
    names: [
      "written from scratch for this game",
      "a fixed-step 120 Hz simulation,",
      "eight parallax layers, sprite rigs",
      "compiled from letter grids,",
      "and an adaptive quality governor",
    ],
  },
  {
    role: "BUILT WITH",
    names: [
      "React and TypeScript",
      "Vite",
      "a great deal of hand-written SVG",
      "and no third-party game engine",
    ],
  },
  {
    role: "OWES A DEBT TO",
    names: ["The Friends of Ringo Ishikawa", "Fading Afternoon", "— yeo"],
  },
  {
    role: "AND TO",
    names: [
      "every osiedle that looks like this one,",
      "which is most of them",
      "the yellow gas pipe on the render",
      "and the smell of a stairwell in October",
    ],
  },
  {
    role: "THANK YOU",
    names: ["to everyone who waited for the lift", "on the fourth floor", "and held the door"],
  },
  { gap: true, names: [] },
  {
    role: "THIS BUILD",
    names: [`version ${BUILD.version}`, BUILD.commit, BUILD.date].filter(Boolean),
  },
  { gap: true, names: [] },
  { names: ["Warsaw"] },
];

export function CreditsScreen({ onBack, still }: { onBack: () => void; still: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scale = useMenuScale();
  /**
   * The crawl's pace, as a multiplier. Down speeds it up, up slows it and will
   * run it backwards — because the one thing anybody ever wants from a credits
   * roll is to get back to a name that has just gone past.
   */
  const [rate, setRate] = useState(1);

  useMenuInput(true, {
    onVertical: (dy) => setRate((r) => Math.max(-3, Math.min(6, r + dy * 1.5))),
    onCancel: onBack,
    onConfirm: onBack,
  });

  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box || still) return;
    let raf = 0;
    let last = performance.now();
    /**
     * How far the crawl has travelled.
     *
     * The list is drawn one viewport *below* the window and travels until it is
     * entirely above it, so `y` runs over `viewport + list` and the type is
     * always either on screen or on its way onto it.
     *
     * Getting this wrong is what made the roll vanish for a few seconds every
     * time round: an earlier version translated by `-y` from zero, so the moment
     * the last line left the top there was a whole viewport-height of nothing,
     * and then the first line snapped back in at the top instead of rising from
     * the bottom.
     *
     * It starts part-way in, so opening Credits shows type straight away rather
     * than a heading over an empty box.
     */
    let y = -1;
    // measured every frame rather than captured once: the type size changes with
    // the window, and a stale loop length repeats early or sits on a gap
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const view = box.clientHeight;
      const span = el.scrollHeight + view;
      if (y < 0) y = view * 0.82;
      y = (((y + (dt / 1000) * BASE_SPEED * rateRef.current) % span) + span) % span;
      el.style.transform = `translate3d(0, ${(view - y).toFixed(1)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  return (
    <MenuPanel title="CREDITS" onBack={onBack} hint="↑↓ scroll   esc back">
      <div className="flex h-full">
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            maxWidth: 620,
            // the crawl fades out at both ends rather than being clipped
            maskImage:
              "linear-gradient(180deg, transparent 0%, #000 12%, #000 86%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, transparent 0%, #000 12%, #000 86%, transparent 100%)",
          }}
        >
          <div ref={ref} className="flex flex-col" style={{ willChange: "transform" }}>
            {CREDITS.map((entry, i) =>
              entry.gap ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: a spacer has no identity
                <span key={`gap-${i}`} style={{ height: scale.note * 6 }} />
              ) : (
                <Block key={entry.role ?? entry.names[0]} entry={entry} />
              ),
            )}
          </div>
        </div>
      </div>
    </MenuPanel>
  );
}

/**
 * The role in pixel caps, the names in prose underneath, both on the same left
 * edge as everything else in the menu.
 *
 * There was a version of this with the role right-aligned in one column and the
 * names left-aligned in another on a shared axis down the middle, the way a film
 * crawl does it. That is a better layout for a two-hundred-name roll and a worse
 * one for this: with three or four short lines per block the axis reads as a
 * gutter down the middle of the screen, and it stopped matching the single left
 * edge the rest of the menu hangs off.
 */
function Block({ entry }: { entry: Entry }) {
  const scale = useMenuScale();
  return (
    <div className="flex flex-col gap-1.5 py-3">
      {entry.role ? (
        <PixelLabel text={entry.role} px={scale.sub} fill={SIGNAL} opacity={0.42} />
      ) : null}
      {entry.names.map((n) => (
        <span key={n} style={{ ...PROSE.base(scale), color: "rgba(227,217,194,0.84)" }}>
          {n}
        </span>
      ))}
    </div>
  );
}
