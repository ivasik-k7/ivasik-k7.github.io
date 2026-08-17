// The actual resume content. Edit freely — the game reads everything from here.

export const profile = {
  name: "Ivan Kovtun",
  title: "Solution Architect",
  location: "Gdansk, Poland",
  summary:
    "Privet, I'm Ivan, a solution architect and software engineer with a passion for building reliable, scalable systems. I enjoy mentoring engineers, leading architecture reviews, and driving cloud migrations and platform modernization.",
  email: "ivan.kovtun@dataart.com",
  github: "https://github.com/ivasik-k7",
  linkedin: "https://www.linkedin.com/in/ivankovtun7/",
};

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  notes: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: "Solution Architect",
    company: "DataArt",
    period: "2023 — present",
    notes: [
      "Own end-to-end architecture for client platforms: discovery, target design, delivery oversight.",
      "Lead cloud migrations and platform modernization across AWS and Azure.",
      "Mentor engineers and run architecture reviews across project teams.",
    ],
  },
  {
    role: "Senior Software Engineer",
    company: "DataArt",
    period: "2020 — 2023",
    notes: [
      "Built and operated distributed backend services and event-driven integrations.",
      "Drove observability, CI/CD, and infrastructure-as-code practices.",
    ],
  },
  {
    role: "Software Engineer",
    company: "Earlier adventures",
    period: "2016 — 2020",
    notes: [
      "Full-stack product work: APIs, data pipelines, and the occasional frontend.",
      "Learned that most outages are stories about people, not servers.",
    ],
  },
];

export interface SkillBook {
  /** Shown as a book on the shelf. */
  title: string;
  items: string[];
}

export const skills: SkillBook[] = [
  {
    title: "Architecture",
    items: [
      "System design",
      "Event-driven systems",
      "Domain modelling",
      "API design",
      "Cost & trade-off analysis",
    ],
  },
  {
    title: "Cloud & Platform",
    items: ["AWS", "Azure", "Kubernetes", "Terraform", "CI/CD", "Observability"],
  },
  {
    title: "Languages",
    items: ["Python", "TypeScript", "Go", "SQL"],
  },
  {
    title: "People",
    items: ["Technical leadership", "Mentoring", "Pre-sales & discovery", "Workshops"],
  },
];

// Ringo-style status screen stats, 0–10.
export const stats: Array<{ label: string; value: number }> = [
  { label: "ARCHITECTURE", value: 9 },
  { label: "CLOUD", value: 8 },
  { label: "CODE", value: 8 },
  { label: "PEOPLE", value: 7 },
  { label: "SAMBO", value: 7 },
  { label: "IRON", value: 8 },
];

export interface Project {
  name: string;
  description: string;
  link?: string;
}

export const projects: Project[] = [
  {
    name: "ivasik-k7.github.io",
    description: "This apartment. React 19, TanStack Router, Tailwind v4 — and one sleeping dog.",
    link: "https://github.com/ivasik-k7/ivasik-k7.github.io",
  },
  {
    name: "Open source & experiments",
    description: "Tools, infrastructure experiments, and half-finished ideas worth reading.",
    link: "https://github.com/ivasik-k7?tab=repositories",
  },
];
