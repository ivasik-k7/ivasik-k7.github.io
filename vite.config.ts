/// <reference types="vitest/config" />

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

/**
 * The build stamp.
 *
 * Read once, here, and substituted into the bundle as literals — the version
 * from package.json, the commit the build came from, and when it was made.
 * The alternative is what the title screen had before, which was the string
 * "BUILD 0.9 · DEV" typed into a JSX file, and which would have said 0.9 for
 * the rest of the project's life.
 *
 * Everything is wrapped: `git` is not present in every environment that can
 * run `vite build`, and a missing SHA should degrade to "unknown" rather than
 * fail the build.
 */
function buildInfo() {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  const git = (cmd: string, fallback: string) => {
    try {
      return (
        execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
          .toString()
          .trim() || fallback
      );
    } catch {
      return fallback;
    }
  };
  const sha = git("git rev-parse --short HEAD", "unknown");
  const dirty = git("git status --porcelain", "") !== "";
  return {
    version: String(pkg.version ?? "0.0.0"),
    commit: dirty ? `${sha}+` : sha,
    // date only: a title screen does not need to know the minute
    date: new Date().toISOString().slice(0, 10),
  };
}

// User site (ivasik-k7.github.io) is served from the domain root.
const BUILD = buildInfo();

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD.version),
    __BUILD_COMMIT__: JSON.stringify(BUILD.commit),
    __BUILD_DATE__: JSON.stringify(BUILD.date),
  },
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  base: "/",
  server: {
    /**
     * The dev server watches the project root, which means it also watches the
     * build output and the showcase PNGs — neither of which any module graph
     * has ever imported. Every watched file is a chokidar entry and a stat
     * cache line for the lifetime of the process.
     */
    watch: { ignored: ["**/dist/**", "**/showcase/**", "**/coverage/**"] },
  },
  build: {
    // nothing in production reads them, and generating them for a bundle this
    // size is the single most memory-hungry step of the build
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
