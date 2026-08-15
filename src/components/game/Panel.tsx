import { motion } from "motion/react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { PanelId } from "@/lib/apartment";
import { profile, skills } from "@/lib/resume";

function LinksContent() {
  const { t } = useTranslation();
  const links = [
    { label: "GITHUB", href: profile.github },
    { label: "LINKEDIN", href: profile.linkedin },
    { label: "EMAIL", href: `mailto:${profile.email}` },
  ];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-parchment/70">{t("panel.links.flavor")}</p>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              className="text-ember underline-offset-4 hover:text-signal hover:underline"
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              ▸ {link.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-parchment/40 text-xs">{t("panel.links.stay")}</p>
    </div>
  );
}

function SkillsContent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-parchment/70">{t("panel.skills.flavor")}</p>
      {skills.map((book) => (
        <div key={book.title}>
          <h3 className="mb-1 text-ember">「{book.title}」</h3>
          <p className="text-parchment/80">{book.items.join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}

function AboutContent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-parchment/70">{t("panel.about.flavor")}</p>
      <p className="text-parchment/90 leading-relaxed">{profile.summary}</p>
      <p className="text-parchment/50 text-xs">
        {profile.name} — {profile.title}, {profile.location}
      </p>
    </div>
  );
}

const CONTENT: Record<PanelId, () => ReactElement> = {
  links: LinksContent,
  skills: SkillsContent,
  about: AboutContent,
};

export function Panel({ id, onClose }: { id: PanelId; onClose: () => void }) {
  const { t } = useTranslation();
  const Content = CONTENT[id];
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        role="dialog"
        aria-label={t(`panel.${id}.title`)}
        className="max-h-[80%] w-full max-w-lg overflow-y-auto border border-parchment/40 bg-[#131018f2] p-6 font-mono text-sm"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="mb-4 flex items-center justify-between border-parchment/20 border-b pb-2">
          <h2 className="tracking-[0.25em] text-parchment">{t(`panel.${id}.title`)}</h2>
          <button
            type="button"
            className="text-parchment/50 hover:text-signal"
            onClick={onClose}
            aria-label={t("ui.close")}
          >
            [ESC]
          </button>
        </div>
        <Content />
      </motion.div>
    </motion.div>
  );
}
