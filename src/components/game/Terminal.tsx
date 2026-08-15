import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { experience, profile, projects, skills } from "@/lib/resume";

type Section = "about" | "experience" | "projects" | "skills" | "contact";

const SECTIONS: Array<{ id: Section; file: string }> = [
  { id: "about", file: "about.txt" },
  { id: "experience", file: "experience.log" },
  { id: "projects", file: "projects/" },
  { id: "skills", file: "skills.cfg" },
  { id: "contact", file: "contact.adr" },
];

function SectionBody({ section }: { section: Section }) {
  switch (section) {
    case "about":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-term-bright">{profile.name}</p>
          <p>
            {profile.title} · {profile.location}
          </p>
          <p className="leading-relaxed opacity-80">{profile.summary}</p>
        </div>
      );
    case "experience":
      return (
        <div className="flex flex-col gap-5">
          {experience.map((entry) => (
            <div key={`${entry.company}-${entry.period}`}>
              <p className="text-term-bright">
                {entry.role} @ {entry.company}
              </p>
              <p className="opacity-60">{entry.period}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {entry.notes.map((note) => (
                  <li key={note} className="opacity-80">
                    - {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "projects":
      return (
        <div className="flex flex-col gap-4">
          {projects.map((project) => (
            <div key={project.name}>
              {project.link ? (
                <a
                  className="text-term-bright underline-offset-4 hover:underline"
                  href={project.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.name} ↗
                </a>
              ) : (
                <p className="text-term-bright">{project.name}</p>
              )}
              <p className="opacity-80">{project.description}</p>
            </div>
          ))}
        </div>
      );
    case "skills":
      return (
        <div className="flex flex-col gap-3">
          {skills.map((book) => (
            <p key={book.title}>
              <span className="text-term-bright">{book.title.toLowerCase()}=</span>
              <span className="opacity-80">[{book.items.join(", ")}]</span>
            </p>
          ))}
        </div>
      );
    case "contact":
      return (
        <div className="flex flex-col gap-2">
          <a className="text-term-bright hover:underline" href={`mailto:${profile.email}`}>
            mail: {profile.email}
          </a>
          <a
            className="text-term-bright hover:underline"
            href={profile.github}
            target="_blank"
            rel="noreferrer"
          >
            github: ivasik-k7
          </a>
          <a
            className="text-term-bright hover:underline"
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            linkedin: ivan-kovtun
          </a>
        </div>
      );
  }
}

export function Terminal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("about");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = SECTIONS.findIndex((s) => s.id === section);
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSection(SECTIONS[(index + SECTIONS.length - 1) % SECTIONS.length].id);
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "Tab") {
        event.preventDefault();
        setSection(SECTIONS[(index + 1) % SECTIONS.length].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [section]);

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        role="dialog"
        aria-label={t("terminal.title")}
        className="flex h-full max-h-[560px] w-full max-w-3xl flex-col border-4 border-[#a8987322] bg-[#c9b995] p-2 shadow-2xl sm:p-3"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="crt-screen relative flex min-h-0 flex-1 flex-col bg-[#101d13] p-4 font-mono text-[13px] text-term sm:p-6">
          <div className="mb-4 flex items-center justify-between border-term/30 border-b pb-2">
            <span className="text-term-bright">ivan@home:~$ {t("terminal.prompt")}</span>
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              onClick={onClose}
              aria-label={t("ui.close")}
            >
              [ESC] {t("terminal.power")}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-8">
            <nav className="flex shrink-0 flex-row flex-wrap gap-x-4 gap-y-1 sm:w-44 sm:flex-col">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={
                    section === item.id
                      ? "text-left text-term-bright"
                      : "text-left opacity-50 hover:opacity-90"
                  }
                >
                  {section === item.id ? "> " : "  "}
                  {item.file}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <SectionBody section={section} />
              <p className="crt-cursor mt-6 inline-block bg-term-bright text-term-bright">_</p>
            </div>
          </div>
          <p className="mt-3 border-term/30 border-t pt-2 text-[11px] opacity-40">
            {t("terminal.hint")}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
