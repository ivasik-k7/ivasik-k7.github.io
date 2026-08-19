/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// User site (ivasik-k7.github.io) is served from the domain root.
export default defineConfig({
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
