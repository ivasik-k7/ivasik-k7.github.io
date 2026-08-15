import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  PixelMap,
  PLAYER_FRAMES,
  PLAYER_H,
  PLAYER_PALETTE,
  PLAYER_W,
} from "@/components/game/sprites";
import { profile, stats } from "@/lib/resume";

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 opacity-70">{label}</span>
      <span role="img" className="tracking-[-0.1em] text-signal" aria-label={`${value}/10`}>
        {"█".repeat(value)}
        <span className="opacity-25">{"█".repeat(10 - value)}</span>
      </span>
    </div>
  );
}

export function StatusMenu({
  dogPets,
  teaMade,
  onClose,
}: {
  dogPets: number;
  teaMade: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0810f5] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="w-full max-w-2xl font-mono text-parchment text-sm">
        <div className="mb-6 flex items-center justify-between border-parchment/20 border-b pb-3">
          <h2 className="tracking-[0.35em]">{t("menu.title")}</h2>
          <button
            type="button"
            className="opacity-50 hover:text-signal hover:opacity-100"
            onClick={onClose}
            aria-label={t("ui.close")}
          >
            [ESC]
          </button>
        </div>
        <div className="flex flex-col gap-8 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <svg
              aria-hidden="true"
              width={84}
              height={147}
              viewBox={`0 0 ${PLAYER_W} ${PLAYER_H}`}
              className="pixelated"
            >
              <PixelMap map={PLAYER_FRAMES.stand} palette={PLAYER_PALETTE} />
            </svg>
            <div className="text-center">
              <p className="text-parchment">{profile.name.toUpperCase()}</p>
              <p className="text-parchment/50 text-xs">{profile.title.toUpperCase()}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              {stats.map((stat) => (
                <StatBar key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
            <div className="flex flex-col gap-1 text-parchment/70">
              <p>
                {t("menu.condition")}:{" "}
                <span className="text-ember">
                  {teaMade ? t("menu.conditionTea") : t("menu.conditionOk")}
                </span>
              </p>
              <p>
                {t("menu.dogPets")}: <span className="text-ember">{dogPets}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1 text-parchment/50 text-xs">
              <p>{t("menu.controls.move")}</p>
              <p>{t("menu.controls.interact")}</p>
              <p>{t("menu.controls.menu")}</p>
            </div>
            <div className="flex gap-5 text-xs">
              <a
                className="text-ice hover:text-signal"
                href={profile.github}
                target="_blank"
                rel="noreferrer"
              >
                GITHUB
              </a>
              <a
                className="text-ice hover:text-signal"
                href={profile.linkedin}
                target="_blank"
                rel="noreferrer"
              >
                LINKEDIN
              </a>
              <a className="text-ice hover:text-signal" href={`mailto:${profile.email}`}>
                EMAIL
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
