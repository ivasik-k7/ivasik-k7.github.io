import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RoomId } from "@/lib/apartment";

/** Quiet top-left panel: real clock, weekday, current room. */
export function Hud({ room }: { room: RoomId }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    weekday: "short",
  }).format(now);

  return (
    <div className="absolute top-3 left-4 border border-parchment/20 bg-black/50 px-2 py-1 font-mono text-parchment/70 text-xs tracking-[0.2em]">
      {hh}:{mm} <span className="text-parchment/50">{weekday.toUpperCase()}</span>
      <span className="text-parchment/40"> · </span>
      {t(`hud.${room}`)}
    </div>
  );
}
