import { useCallback, useState } from "react";
import { PixelLabel, playSfx, prose, proseQuiet, RULE, SIGNAL } from "@/engine";
import { useMenuInput } from "../menu/useMenuInput";
import { LINE } from "./stationTimetable";

/**
 * The route map, read close up.
 *
 * §18 asks for this to preserve immersion rather than open "an unrelated
 * fullscreen UI", so it is the *same diagram* that is painted on the bulkhead,
 * enlarged — a horizontal line, a tick and a name per station, the one you are
 * at ringed, and the one you have selected marked. It is not a list of levels
 * with a Travel button.
 *
 * What makes it honest: only the two stations this game actually has are
 * selectable. The rest are drawn, and named, and greyed with a reason, in exactly
 * the way a locked dialogue choice states its own condition. A map that offered
 * eight destinations and delivered two would be worse than a map that offers two
 * and shows you where the line goes.
 */

const PARCHMENT = "#e3d9c2";
/** SKM line colour, off the real diagram. */
const LINE_BLUE = "#1e5c9e";

export function RouteMap({
  here,
  onClose,
  onTravel,
}: {
  /** the station id the player boarded at, ringed on the diagram */
  here: string;
  onClose: () => void;
  onTravel: (scene: string, spawnX: number) => void;
}) {
  const reachable = LINE.map((st, i) => ({ ...st, i })).filter((st) => st.scene);
  const [pick, setPick] = useState(() => {
    const other = reachable.findIndex((st) => st.id !== here);
    return other < 0 ? 0 : other;
  });

  const move = useCallback(
    (d: number) => {
      setPick((p) => {
        const n = (p + d + reachable.length) % reachable.length;
        if (n !== p) playSfx("click");
        return n;
      });
    },
    [reachable.length],
  );

  const go = useCallback(() => {
    const target = reachable[pick];
    if (!target?.scene) return;
    playSfx("chime");
    /* each station knows where its stair puts you — LINE carries the spawn */
    onTravel(target.scene, target.spawnX);
  }, [pick, reachable, onTravel]);

  const selected = reachable[pick];

  /**
   * Arrows, WASD, Enter and Escape, through the same hook the menus use — so
   * this is navigable by keyboard and by pad without a single event handler on a
   * non-interactive element, and it behaves identically to every other screen.
   */
  useMenuInput(true, {
    onHorizontal: move,
    onVertical: move,
    onConfirm: go,
    onCancel: onClose,
  });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      {/* the ground. A button, because clicking off the map puts it back. */}
      <button
        type="button"
        aria-label="Put the map back"
        className="absolute inset-0"
        style={{ background: "rgba(6,8,13,0.86)" }}
        onClick={onClose}
      />

      {/* the panel is the thing on the wall, so it keeps its proportions */}
      <div className="relative w-full max-w-3xl px-[7%] text-left">
        <div className="mb-1 flex items-center gap-3">
          <PixelLabel text="SKM TROJMIASTO" px={3} fill={SIGNAL} opacity={0.9} />
          <span style={{ flex: 1, height: 2, background: RULE }} />
        </div>
        <p style={{ ...proseQuiet(12), marginBottom: 22 }}>
          Linia 1 · Gdańsk Główny — Gdynia Główna
        </p>

        {/* the diagram */}
        <div className="relative" style={{ height: 96 }}>
          <div
            className="absolute"
            style={{ left: 0, right: 0, top: 30, height: 3, background: LINE_BLUE }}
          />
          {LINE.map((st, i) => {
            const isHere = st.id === here;
            const isPick = selected?.id === st.id;
            const open = Boolean(st.scene);
            const left = `${(i / (LINE.length - 1)) * 100}%`;
            const at = reachable.findIndex((r) => r.id === st.id);
            return (
              <button
                key={st.id}
                type="button"
                disabled={!open}
                aria-label={st.name}
                aria-current={isPick}
                className="absolute flex flex-col items-center disabled:cursor-default"
                style={{ left, top: 18, transform: "translateX(-50%)" }}
                onClick={() => {
                  if (at >= 0) setPick(at);
                }}
                onDoubleClick={go}
              >
                {/* the tick on the line, and the ring for where we are */}
                <span
                  style={{
                    width: isHere ? 13 : 7,
                    height: isHere ? 13 : 7,
                    marginTop: isHere ? 6 : 9,
                    background: isPick ? SIGNAL : open ? PARCHMENT : "rgba(227,217,194,0.3)",
                    outline: isHere ? `2px solid ${SIGNAL}` : undefined,
                    outlineOffset: 2,
                  }}
                />
                {/* the names alternate above and below, the way a diagram does
                    it when they will not fit side by side */}
                <span
                  className="absolute whitespace-nowrap"
                  style={{
                    ...proseQuiet(10),
                    top: i % 2 === 0 ? 30 : -16,
                    color: isPick
                      ? SIGNAL
                      : open
                        ? "rgba(227,217,194,0.8)"
                        : "rgba(227,217,194,0.32)",
                  }}
                >
                  {st.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* what happens if you press it */}
        <div className="mt-6 flex items-baseline gap-3">
          <PixelLabel text="GET OFF AT" px={2} fill={PARCHMENT} opacity={0.45} />
          <PixelLabel text={selected?.name ?? "—"} px={3} fill={SIGNAL} />
        </div>
        <p style={{ ...prose(12), marginTop: 6, maxWidth: 460 }}>
          {selected?.id === here
            ? "Where you got on. You could just stay on and go round again."
            : "The doors will open on the right."}
        </p>
        <p style={{ ...proseQuiet(11), marginTop: 14 }}>
          ←→ pick · e get off there · esc put it back
        </p>
        <p style={{ ...proseQuiet(10), marginTop: 4, opacity: 0.6 }}>
          The greyed stations are on the line but not yet in the game.
        </p>
      </div>
    </div>
  );
}
