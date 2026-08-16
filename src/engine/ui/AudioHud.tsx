import { useSyncExternalStore } from "react";
import { lofiPlayer } from "../audio/lofi";

/**
 * Tiny cassette-deck style player, styled to match the game HUD.
 * Sits under the clock panel; every control is a quiet monospace glyph.
 */
export function AudioHud() {
  const state = useSyncExternalStore(
    (fn) => lofiPlayer.subscribe(fn),
    () => `${lofiPlayer.playing}:${lofiPlayer.track.name}:${lofiPlayer.volume}`,
  );
  void state;

  const bars = Math.round(lofiPlayer.volume * 5);

  return (
    <div className="absolute top-12 left-4 flex items-center gap-2 border border-parchment/20 bg-black/50 px-2 py-1 font-mono text-parchment/70 text-xs tracking-[0.15em]">
      <span className={lofiPlayer.playing ? "text-signal" : "text-parchment/40"}>♪</span>
      <button
        type="button"
        aria-label="Play / pause music"
        className="hover:text-signal"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => lofiPlayer.toggle()}
      >
        {lofiPlayer.playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        aria-label="Next track"
        className="hover:text-signal"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => lofiPlayer.next()}
      >
        ⏭
      </button>
      <span className="min-w-[7.5rem] text-parchment/60">{lofiPlayer.track.name}</span>
      <button
        type="button"
        aria-label="Volume down"
        className="hover:text-signal"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => lofiPlayer.setVolume(lofiPlayer.volume - 0.2)}
      >
        −
      </button>
      <span aria-hidden="true" className="text-parchment/50">
        {"▮".repeat(bars)}
        {"▯".repeat(5 - bars)}
      </span>
      <button
        type="button"
        aria-label="Volume up"
        className="hover:text-signal"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => lofiPlayer.setVolume(lofiPlayer.volume + 0.2)}
      >
        +
      </button>
    </div>
  );
}
