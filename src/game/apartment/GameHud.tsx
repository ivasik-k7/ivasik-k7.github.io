import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { lofiPlayer } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The quiet top-left column: clock & place, sky, pocket & inventory,
 * and the cassette deck. Everything in the same bordered monospace style.
 */

const SKY_LABEL: Record<string, string> = {
  morning: "◔ MORNING",
  day: "○ CLEAR DAY",
  dusk: "◑ DUSK",
  night: "● NIGHT",
};

const ITEM_LABEL: Record<string, string> = {
  cigarettes: "REDS",
  lighter: "LIGHTER",
  parcel: "PARCEL",
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-parchment/20 bg-black/50 px-2 py-1 font-mono text-parchment/70 text-xs tracking-[0.15em]">
      {children}
    </div>
  );
}

export function GameHud({
  scene,
  world,
  phase,
}: {
  scene: string;
  world: WorldState;
  phase: string;
}) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useSyncExternalStore(
    (fn) => lofiPlayer.subscribe(fn),
    () => `${lofiPlayer.playing}:${lofiPlayer.track.name}:${lofiPlayer.volume}`,
  );

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    weekday: "short",
  }).format(now);
  const bars = Math.round(lofiPlayer.volume * 5);

  return (
    <div className="absolute top-3 left-4 flex flex-col gap-1">
      <Row>
        {hh}:{mm} <span className="text-parchment/50">{weekday.toUpperCase()}</span>
        <span className="text-parchment/40"> · </span>
        {t(`hud.${scene}`)}
      </Row>
      <Row>
        <span className="text-parchment/50">{SKY_LABEL[phase] ?? phase.toUpperCase()}</span>
        <span className="text-parchment/40"> · </span>
        <span className="text-signal/90">{world.money} zł</span>
        {world.inventory.map((item) => (
          <span key={item.itemId} className="text-parchment/50">
            {" · "}
            {ITEM_LABEL[item.itemId] ?? item.itemId.toUpperCase()}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </span>
        ))}
      </Row>
      <Row>
        <span className={lofiPlayer.playing ? "text-signal" : "text-parchment/40"}>♪ </span>
        <button
          type="button"
          aria-label="Play / pause music"
          className="hover:text-signal"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => lofiPlayer.toggle()}
        >
          {lofiPlayer.playing ? "❚❚" : "▶"}
        </button>{" "}
        <button
          type="button"
          aria-label="Next track"
          className="hover:text-signal"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => lofiPlayer.next()}
        >
          ⏭
        </button>{" "}
        <span className="text-parchment/60">{lofiPlayer.track.name}</span>{" "}
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
      </Row>
    </div>
  );
}
